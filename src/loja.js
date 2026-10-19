import crypto from 'node:crypto';
import { transacao } from './db.js';

export const STATUS = {
  novo: 'Novo (WhatsApp)',
  aguardando_pagamento: 'Aguardando pagamento',
  pago: 'Pago / confirmado',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};
// Status em que a mercadoria já saiu do estoque
const BAIXA_ESTOQUE = new Set(['pago', 'enviado', 'entregue']);

export class ErroLoja extends Error {
  constructor(msg, status = 400) { super(msg); this.status = status; }
}

/* ---------- Catálogo ---------- */

export function listarCategorias(db) {
  return db.prepare('SELECT id, slug, nome, icone, ordem FROM categorias ORDER BY ordem, nome').all();
}

function montarProduto(p, variacoes) {
  return {
    id: p.id, slug: p.slug, nome: p.nome, descricao: p.descricao,
    preco: p.preco_cents, precoDe: p.preco_de_cents, tag: p.tag,
    destaque: !!p.destaque, ativo: !!p.ativo, imagens: JSON.parse(p.imagens),
    cores: [p.cor1, p.cor2],
    categoria: p.cat_slug ? { id: p.categoria_id, slug: p.cat_slug, nome: p.cat_nome, icone: p.cat_icone } : null,
    variacoes: variacoes.map(v => ({ id: v.id, rotulo: v.rotulo, estoque: v.estoque })),
  };
}

const SELECT_PRODUTO = `
  SELECT p.*, c.slug AS cat_slug, c.nome AS cat_nome, c.icone AS cat_icone
  FROM produtos p LEFT JOIN categorias c ON c.id = p.categoria_id`;

export function listarProdutos(db, { categoria, busca, destaque, incluirInativos = false } = {}) {
  const onde = [], args = [];
  if (!incluirInativos) onde.push('p.ativo = 1');
  if (categoria) { onde.push('c.slug = ?'); args.push(categoria); }
  if (destaque) onde.push('p.destaque = 1');
  if (busca) {
    onde.push("(p.nome LIKE ? ESCAPE '\\' OR p.descricao LIKE ? ESCAPE '\\')");
    const termo = `%${String(busca).replace(/[\\%_]/g, '\\$&')}%`;
    args.push(termo, termo);
  }
  const linhas = db.prepare(`${SELECT_PRODUTO} ${onde.length ? 'WHERE ' + onde.join(' AND ') : ''}
    ORDER BY p.destaque DESC, p.id DESC`).all(...args);
  const vars = db.prepare('SELECT * FROM variacoes ORDER BY ordem, id').all();
  const porProduto = Map.groupBy(vars, v => v.produto_id);
  return linhas.map(p => montarProduto(p, porProduto.get(p.id) ?? []));
}

export function buscarProduto(db, { slug, id }, { incluirInativos = false } = {}) {
  const p = db.prepare(`${SELECT_PRODUTO} WHERE ${slug ? 'p.slug = ?' : 'p.id = ?'}`).get(slug ?? id);
  if (!p || (!p.ativo && !incluirInativos)) return null;
  const vars = db.prepare('SELECT * FROM variacoes WHERE produto_id = ? ORDER BY ordem, id').all(p.id);
  return montarProduto(p, vars);
}

/* ---------- Carrinho e frete ---------- */

/* Recalcula o carrinho no servidor: preços e estoque sempre vêm do banco, nunca do navegador */
export function validarCarrinho(db, itens) {
  if (!Array.isArray(itens) || itens.length === 0) throw new ErroLoja('Sua sacola está vazia.');
  if (itens.length > 50) throw new ErroLoja('Sacola com itens demais.');
  const busca = db.prepare(`
    SELECT v.id AS variacao_id, v.rotulo, v.estoque, p.id AS produto_id, p.nome, p.preco_cents, p.ativo
    FROM variacoes v JOIN produtos p ON p.id = v.produto_id WHERE v.id = ?`);
  const somados = new Map();
  for (const it of itens) {
    const id = Number(it?.variacaoId), qtd = Number(it?.qtd);
    if (!Number.isInteger(id) || !Number.isInteger(qtd) || qtd < 1 || qtd > 20) throw new ErroLoja('Item inválido na sacola.');
    somados.set(id, (somados.get(id) ?? 0) + qtd);
  }
  const linhas = [];
  for (const [id, qtd] of somados) {
    const v = busca.get(id);
    if (!v || !v.ativo) throw new ErroLoja('Um produto da sua sacola não está mais disponível.');
    if (v.estoque < qtd) {
      throw new ErroLoja(v.estoque > 0
        ? `Só temos ${v.estoque} unidade(s) de ${v.nome} (${v.rotulo}).`
        : `${v.nome} (${v.rotulo}) esgotou.`, 409);
    }
    linhas.push({ produtoId: v.produto_id, variacaoId: v.variacao_id, nome: v.nome, rotulo: v.rotulo, preco: v.preco_cents, qtd });
  }
  const subtotal = linhas.reduce((s, l) => s + l.preco * l.qtd, 0);
  return { linhas, subtotal };
}

export function calcularFrete(subtotal, cfg) {
  return subtotal >= cfg.freteGratisCents ? 0 : cfg.freteFixoCents;
}

/* ---------- Pedidos ---------- */

function novoCodigo() {
  // sem letras ambíguas (0/O, 1/I)
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(8), b => alfabeto[b % alfabeto.length]).join('');
}

const texto = (v, max) => String(v ?? '').trim().slice(0, max);

export function criarPedido(db, { canal, itens, cliente = {} }, cfg) {
  const { linhas, subtotal } = validarCarrinho(db, itens);
  const frete = calcularFrete(subtotal, cfg);
  const status = canal === 'cartao' ? 'aguardando_pagamento' : 'novo';
  return transacao(db, () => {
    const codigo = novoCodigo();
    const id = db.prepare(`INSERT INTO pedidos
      (codigo, canal, status, cliente_nome, cliente_telefone, cliente_cidade, endereco, observacao, subtotal_cents, frete_cents, total_cents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      codigo, canal, status, texto(cliente.nome, 120), texto(cliente.telefone, 40), texto(cliente.cidade, 120),
      texto(cliente.endereco, 300), texto(cliente.observacao, 500), subtotal, frete, subtotal + frete).lastInsertRowid;
    const ins = db.prepare(`INSERT INTO itens_pedido (pedido_id, produto_id, variacao_id, nome, rotulo, preco_cents, qtd)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    for (const l of linhas) ins.run(id, l.produtoId, l.variacaoId, l.nome, l.rotulo, l.preco, l.qtd);
    return buscarPedido(db, { id });
  });
}

export function buscarPedido(db, { id, codigo, stripeSessionId }) {
  const [campo, valor] = id != null ? ['id', id] : codigo != null ? ['codigo', codigo] : ['stripe_session_id', stripeSessionId];
  const p = db.prepare(`SELECT * FROM pedidos WHERE ${campo} = ?`).get(valor);
  if (!p) return null;
  const itens = db.prepare('SELECT * FROM itens_pedido WHERE pedido_id = ? ORDER BY id').all(p.id);
  return {
    id: p.id, codigo: p.codigo, canal: p.canal, status: p.status, statusTexto: STATUS[p.status] ?? p.status,
    cliente: { nome: p.cliente_nome, telefone: p.cliente_telefone, cidade: p.cliente_cidade, endereco: p.endereco, observacao: p.observacao },
    subtotal: p.subtotal_cents, frete: p.frete_cents, total: p.total_cents,
    stripeSessionId: p.stripe_session_id, estoqueBaixado: !!p.estoque_baixado,
    criadoEm: p.criado_em, atualizadoEm: p.atualizado_em,
    itens: itens.map(i => ({ produtoId: i.produto_id, variacaoId: i.variacao_id, nome: i.nome, rotulo: i.rotulo, preco: i.preco_cents, qtd: i.qtd })),
  };
}

export function listarPedidos(db, { status } = {}) {
  const ids = status
    ? db.prepare('SELECT id FROM pedidos WHERE status = ? ORDER BY id DESC LIMIT 500').all(status)
    : db.prepare('SELECT id FROM pedidos ORDER BY id DESC LIMIT 500').all();
  return ids.map(({ id }) => buscarPedido(db, { id }));
}

/* Muda o status e mantém o estoque coerente: baixa ao confirmar, devolve ao cancelar */
export function mudarStatus(db, id, novo, extras = {}) {
  if (!STATUS[novo]) throw new ErroLoja('Status inválido.');
  return transacao(db, () => {
    const p = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
    if (!p) throw new ErroLoja('Pedido não encontrado.', 404);
    let baixado = p.estoque_baixado;
    const itens = db.prepare('SELECT variacao_id, qtd FROM itens_pedido WHERE pedido_id = ?').all(id);
    const ajusta = db.prepare('UPDATE variacoes SET estoque = estoque + ? WHERE id = ?');
    if (BAIXA_ESTOQUE.has(novo) && !baixado) {
      for (const i of itens) ajusta.run(-i.qtd, i.variacao_id);
      baixado = 1;
    } else if (novo === 'cancelado' && baixado) {
      for (const i of itens) ajusta.run(i.qtd, i.variacao_id);
      baixado = 0;
    }
    db.prepare(`UPDATE pedidos SET status = ?, estoque_baixado = ?, atualizado_em = datetime('now'),
      cliente_nome = COALESCE(?, cliente_nome), cliente_telefone = COALESCE(?, cliente_telefone),
      endereco = COALESCE(?, endereco) WHERE id = ?`).run(
      novo, baixado, extras.nome ?? null, extras.telefone ?? null, extras.endereco ?? null, id);
    return buscarPedido(db, { id });
  });
}

/* ---------- Mensagem do WhatsApp ---------- */

export const brl = c => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function mensagemWhatsApp(pedido) {
  const linhas = pedido.itens.map(i => `• ${i.qtd}x ${i.nome}${i.rotulo !== 'Único' ? ` (${i.rotulo})` : ''} — ${brl(i.preco * i.qtd)}`);
  const c = pedido.cliente;
  return [
    `Olá, Pantoja Intimeé! 👑`,
    `Quero fazer o pedido *#${pedido.codigo}*:`,
    '',
    ...linhas,
    '',
    `Subtotal: ${brl(pedido.subtotal)}`,
    `Frete: ${pedido.frete ? brl(pedido.frete) : 'grátis'}`,
    `*Total: ${brl(pedido.total)}*`,
    '',
    `Nome: ${c.nome}`,
    c.cidade ? `Cidade: ${c.cidade}` : null,
    c.endereco ? `Endereço: ${c.endereco}` : null,
    c.observacao ? `Obs.: ${c.observacao}` : null,
  ].filter(l => l != null).join('\n');
}
