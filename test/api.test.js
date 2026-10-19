import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Stripe from 'stripe';
import { abrirBanco, semear, garantirAdmin } from '../src/db.js';
import { criarApp } from '../src/app.js';

const WEBHOOK_SECRET = 'whsec_teste';
let servidor, base, db, stripe;
const criadas = [];

before(async () => {
  db = abrirBanco(':memory:');
  semear(db);
  garantirAdmin(db, 'dona@loja.com', 'senha-forte-123');
  stripe = new Stripe('sk_test_falso');
  // Substitui as chamadas de rede do Stripe
  stripe.checkout.sessions.create = async (params) => {
    const s = { id: `cs_test_${criadas.length + 1}`, url: 'https://checkout.stripe.test/pagar', ...params };
    criadas.push(s);
    return s;
  };
  stripe.checkout.sessions.retrieve = async (id) => ({ id, payment_status: 'unpaid', metadata: criadas.find(s => s.id === id)?.metadata });
  const cfg = {
    whatsapp: '5563999999999', instagram: '', baseUrl: 'https://loja.test', freteFixoCents: 2000, freteGratisCents: 19900,
    pastaUploads: fs.mkdtempSync(path.join(os.tmpdir(), 'pi-up-')), sessaoSegredo: 'segredo', cookieSeguro: false,
    stripeWebhookSecret: WEBHOOK_SECRET,
  };
  servidor = criarApp({ db, cfg, stripe }).listen(0);
  await new Promise(r => servidor.once('listening', r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
after(() => servidor.close());

const req = async (caminho, { metodo = 'GET', corpo, cookie, headers = {} } = {}) => {
  const r = await fetch(base + caminho, {
    method: metodo,
    headers: { ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
    body: typeof corpo === 'string' ? corpo : corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, dados: await r.json().catch(() => null), headers: r.headers };
};
const variacao = (nome, rotulo) => db.prepare(`SELECT v.* FROM variacoes v JOIN produtos p ON p.id = v.produto_id WHERE p.nome = ? AND v.rotulo = ?`).get(nome, rotulo);

async function login() {
  const r = await req('/api/admin/login', { metodo: 'POST', corpo: { email: 'dona@loja.com', senha: 'senha-forte-123' } });
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie').split(';')[0];
}

test('catálogo: categorias, filtro, busca e produto', async () => {
  const cats = await req('/api/categorias');
  assert.ok(cats.dados.some(c => c.slug === 'pijamas'));
  const calcinhas = await req('/api/produtos?categoria=calcinhas');
  assert.ok(calcinhas.dados.length > 0);
  assert.ok(calcinhas.dados.every(p => p.categoria.slug === 'calcinhas'));
  const busca = await req('/api/produtos?busca=borboleta');
  assert.equal(busca.dados.length, 1);
  const prod = await req(`/api/produtos/${busca.dados[0].slug}`);
  assert.deepEqual(prod.dados.variacoes.map(v => v.rotulo), ['P', 'M', 'G']);
  assert.equal((await req('/api/produtos/nao-existe')).status, 404);
  // busca com caracteres curinga não quebra nem lista tudo
  assert.equal((await req('/api/produtos?busca=%25')).dados.length, 0);
});

test('carrinho usa o preço do banco e calcula o frete', async () => {
  const v = variacao('Calcinha Borboleta Brilho', 'M');
  const r = await req('/api/carrinho/validar', { metodo: 'POST', corpo: { itens: [{ variacaoId: v.id, qtd: 2, preco: 1 }] } });
  assert.equal(r.status, 200);
  assert.equal(r.dados.subtotal, 5990 * 2);
  assert.equal(r.dados.frete, 2000);
  const kit = variacao('Kit Presente Rosa Encantada', 'M');
  const gratis = await req('/api/carrinho/validar', { metodo: 'POST', corpo: { itens: [{ variacaoId: kit.id, qtd: 2 }] } });
  assert.equal(gratis.dados.frete, 0);
  const demais = await req('/api/carrinho/validar', { metodo: 'POST', corpo: { itens: [{ variacaoId: v.id, qtd: 11 }] } });
  assert.equal(demais.status, 409);
  assert.equal((await req('/api/carrinho/validar', { metodo: 'POST', corpo: { itens: [] } })).status, 400);
});

test('pedido pelo WhatsApp: cria pedido, gera mensagem e só baixa estoque ao confirmar', async () => {
  const v = variacao('Conjunto Cereja', 'G');
  const r = await req('/api/pedidos/whatsapp', { metodo: 'POST', corpo: { itens: [{ variacaoId: v.id, qtd: 2 }], cliente: { nome: 'Maria', cidade: 'Palmas - TO' } } });
  assert.equal(r.status, 201);
  assert.match(r.dados.url, /^https:\/\/wa\.me\/5563999999999\?text=/);
  const msg = decodeURIComponent(r.dados.url.split('text=')[1]);
  assert.match(msg, /2x Conjunto Cereja \(G\)/);
  assert.match(msg, new RegExp(`#${r.dados.codigo}`));
  assert.match(msg, /Cidade: Palmas - TO/);
  assert.equal(variacao('Conjunto Cereja', 'G').estoque, v.estoque);

  const cookie = await login();
  const ped = (await req('/api/admin/pedidos', { cookie })).dados.find(p => p.codigo === r.dados.codigo);
  assert.equal(ped.status, 'novo');
  await req(`/api/admin/pedidos/${ped.id}/status`, { metodo: 'PUT', corpo: { status: 'pago' }, cookie });
  assert.equal(variacao('Conjunto Cereja', 'G').estoque, v.estoque - 2);
  await req(`/api/admin/pedidos/${ped.id}/status`, { metodo: 'PUT', corpo: { status: 'enviado' }, cookie });
  assert.equal(variacao('Conjunto Cereja', 'G').estoque, v.estoque - 2, 'não baixa duas vezes');
  await req(`/api/admin/pedidos/${ped.id}/status`, { metodo: 'PUT', corpo: { status: 'cancelado' }, cookie });
  assert.equal(variacao('Conjunto Cereja', 'G').estoque, v.estoque, 'devolve ao cancelar');
});

test('pedido exige nome do cliente', async () => {
  const v = variacao('Conjunto Cereja', 'P');
  const r = await req('/api/pedidos/whatsapp', { metodo: 'POST', corpo: { itens: [{ variacaoId: v.id, qtd: 1 }], cliente: { nome: '' } } });
  assert.equal(r.status, 400);
});

test('cartão (Stripe): cria checkout e confirma pelo webhook assinado', async () => {
  const v = variacao('Sutiã Renda Rubi', '42');
  const r = await req('/api/pedidos/cartao', { metodo: 'POST', corpo: { itens: [{ variacaoId: v.id, qtd: 1 }], cliente: { nome: 'Ana' } } });
  assert.equal(r.status, 201);
  assert.equal(r.dados.url, 'https://checkout.stripe.test/pagar');
  const sessao = criadas.at(-1);
  assert.equal(sessao.line_items[0].price_data.unit_amount, 8990);
  assert.equal(sessao.line_items[0].price_data.currency, 'brl');
  assert.equal(sessao.shipping_options[0].shipping_rate_data.fixed_amount.amount, 2000);
  assert.equal(sessao.success_url, `https://loja.test/pedido/${r.dados.codigo}?session_id={CHECKOUT_SESSION_ID}`);

  const pend = await req(`/api/pedidos/${r.dados.codigo}`);
  assert.equal(pend.dados.status, 'aguardando_pagamento');

  const evento = JSON.stringify({
    id: 'evt_1', type: 'checkout.session.completed',
    data: { object: { id: sessao.id, payment_status: 'paid', metadata: { pedido: r.dados.codigo },
      customer_details: { name: 'Ana Souza', phone: '+5563988887777', address: { line1: 'Rua A, 10', city: 'Palmas', state: 'TO', postal_code: '77000-000' } } } },
  });
  // assinatura inválida é recusada
  const ruim = await req('/api/stripe/webhook', { metodo: 'POST', corpo: evento, headers: { 'stripe-signature': 't=1,v1=errada' } });
  assert.equal(ruim.status, 400);
  const assinatura = stripe.webhooks.generateTestHeaderString({ payload: evento, secret: WEBHOOK_SECRET });
  const ok = await req('/api/stripe/webhook', { metodo: 'POST', corpo: evento, headers: { 'stripe-signature': assinatura } });
  assert.equal(ok.status, 200);

  const pago = await req(`/api/pedidos/${r.dados.codigo}`);
  assert.equal(pago.dados.status, 'pago');
  assert.equal(variacao('Sutiã Renda Rubi', '42').estoque, v.estoque - 1);
  // dados pessoais não aparecem na página pública do pedido
  assert.equal(pago.dados.cliente, undefined);

  // reenvio do mesmo evento não baixa o estoque de novo
  await req('/api/stripe/webhook', { metodo: 'POST', corpo: evento, headers: { 'stripe-signature': assinatura } });
  assert.equal(variacao('Sutiã Renda Rubi', '42').estoque, v.estoque - 1);
});

test('painel exige login e bloqueia senha errada', async () => {
  assert.equal((await req('/api/admin/pedidos')).status, 401);
  assert.equal((await req('/api/admin/produtos', { cookie: 'pi_admin=forjado.assinatura' })).status, 401);
  const r = await req('/api/admin/login', { metodo: 'POST', corpo: { email: 'dona@loja.com', senha: 'errada' } });
  assert.equal(r.status, 401);
});

test('painel: cria, edita variações e oculta produto', async () => {
  const cookie = await login();
  const cats = await req('/api/admin/categorias', { cookie });
  const novo = await req('/api/admin/produtos', { metodo: 'POST', cookie, corpo: {
    nome: 'Conjunto Teste', preco: 9990, categoriaId: cats.dados[0].id, variacoes: [{ rotulo: 'P', estoque: 3 }, { rotulo: 'M', estoque: 1 }],
    imagens: ['/uploads/x.jpg', 'javascript:alert(1)'],
  } });
  assert.equal(novo.status, 201);
  assert.equal(novo.dados.slug, 'conjunto-teste');
  assert.deepEqual(novo.dados.imagens, ['/uploads/x.jpg']);
  const [vp] = novo.dados.variacoes;
  const editado = await req(`/api/admin/produtos/${novo.dados.id}`, { metodo: 'PUT', cookie, corpo: {
    ...novo.dados, preco: 10990, categoriaId: novo.dados.categoria.id, ativo: false,
    variacoes: [{ id: vp.id, rotulo: 'P', estoque: 5 }, { rotulo: 'GG', estoque: 2 }],
  } });
  assert.equal(editado.status, 200);
  assert.deepEqual(editado.dados.variacoes.map(v => [v.rotulo, v.estoque]), [['P', 5], ['GG', 2]]);
  assert.equal(editado.dados.variacoes[0].id, vp.id, 'mantém o id da variação existente');
  assert.equal((await req('/api/produtos/conjunto-teste')).status, 404, 'produto oculto some da loja');
  // produto oculto não pode ser comprado
  const compra = await req('/api/carrinho/validar', { metodo: 'POST', corpo: { itens: [{ variacaoId: vp.id, qtd: 1 }] } });
  assert.equal(compra.status, 400);
  const dup = await req('/api/admin/produtos', { metodo: 'POST', cookie, corpo: { nome: 'Conjunto Teste', preco: 100, variacoes: [{ rotulo: 'Único', estoque: 1 }] } });
  assert.equal(dup.dados.slug, 'conjunto-teste-2');
  assert.equal((await req('/api/admin/produtos', { metodo: 'POST', cookie, corpo: { nome: 'Sem var', preco: 100, variacoes: [] } })).status, 400);
});

test('rotas da loja devolvem a página e o painel tem a sua', async () => {
  for (const p of ['/', '/loja', '/produto/qualquer', '/finalizar', '/pedido/ABC']) {
    const r = await fetch(base + p);
    assert.equal(r.status, 200);
    assert.match(await r.text(), /<main id="app">/);
  }
  assert.match(await (await fetch(base + '/admin')).text(), /admin\.js/);
  assert.equal((await fetch(base + '/api/nada')).status, 404);
});
