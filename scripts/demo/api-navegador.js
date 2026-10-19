/* API da demonstração: imita o servidor (src/app.js + src/loja.js) dentro do navegador,
   guardando tudo no localStorage. Só é usada no arquivo gerado por scripts/gerar-demo.js. */

const CHAVE_DEMO = 'pi_demo_v1';
const CONFIG_DEMO = {
  whatsapp: '5563992783793', instagram: 'https://www.instagram.com/pantojaintimee01/',
  cartaoAtivo: true, freteFixo: 2000, freteGratisAPartir: 19900, demo: true,
};
const ADMIN_DEMO = { email: 'admin@pantojaintimee.com.br', senha: 'pantoja123' };
const STATUS_DEMO = {
  novo: 'Novo (WhatsApp)', aguardando_pagamento: 'Aguardando pagamento', pago: 'Pago / confirmado',
  enviado: 'Enviado', entregue: 'Entregue', cancelado: 'Cancelado',
};
const BAIXA_DEMO = new Set(['pago', 'enviado', 'entregue']);

const slugDemo = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'produto';
const agoraSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

function estadoInicialDemo() {
  const categorias = SEMENTE_DEMO.categorias.map((c, i) => ({ id: i + 1, slug: c.slug, nome: c.nome, icone: c.icone, ordem: i }));
  let vid = 0;
  const produtos = SEMENTE_DEMO.produtos.map((p, i) => ({
    id: i + 1, slug: slugDemo(p.nome), nome: p.nome, descricao: p.descricao, preco: p.preco, precoDe: p.de ?? null,
    categoriaId: categorias.find(c => c.slug === p.cat)?.id ?? null, tag: p.tag ?? '', destaque: !!p.destaque, ativo: true,
    imagens: [], cores: p.cor, variacoes: (p.variacoes ?? ['Único']).map(r => ({ id: ++vid, rotulo: r, estoque: p.estoque ?? 10 })),
  }));
  return { categorias, produtos, pedidos: [], seq: { cat: categorias.length, prod: produtos.length, var: vid, ped: 0 }, logado: false };
}

let E = (() => { try { return JSON.parse(localStorage.getItem(CHAVE_DEMO)) ?? estadoInicialDemo(); } catch { return estadoInicialDemo(); } })();
function salvarDemo() {
  try { localStorage.setItem(CHAVE_DEMO, JSON.stringify(E)); }
  catch { console.warn('Demonstração: não foi possível salvar no navegador (fotos grandes demais?).'); }
}
globalThis.__reiniciarDemo__ = () => { try { localStorage.removeItem(CHAVE_DEMO); } catch {} E = estadoInicialDemo(); };

class ErroDemo extends Error { constructor(m, status = 400) { super(m); this.status = status; } }

function produtoPublico(p) {
  const c = E.categorias.find(x => x.id === p.categoriaId);
  return {
    id: p.id, slug: p.slug, nome: p.nome, descricao: p.descricao, preco: p.preco, precoDe: p.precoDe, tag: p.tag,
    destaque: p.destaque, ativo: p.ativo, imagens: [...p.imagens], cores: [...p.cores],
    categoria: c ? { id: c.id, slug: c.slug, nome: c.nome, icone: c.icone } : null,
    variacoes: p.variacoes.map(v => ({ ...v })),
  };
}

function listarDemo({ categoria, busca, destaque, todos } = {}) {
  const termo = (busca ?? '').toLowerCase();
  return E.produtos
    .filter(p => todos || p.ativo)
    .filter(p => !categoria || E.categorias.find(c => c.id === p.categoriaId)?.slug === categoria)
    .filter(p => !destaque || p.destaque)
    .filter(p => !termo || p.nome.toLowerCase().includes(termo) || p.descricao.toLowerCase().includes(termo))
    .sort((a, b) => (b.destaque - a.destaque) || (b.id - a.id))
    .map(produtoPublico);
}

function validarDemo(itens) {
  if (!Array.isArray(itens) || !itens.length) throw new ErroDemo('Sua sacola está vazia.');
  const somados = new Map();
  for (const it of itens) somados.set(Number(it.variacaoId), (somados.get(Number(it.variacaoId)) ?? 0) + Number(it.qtd));
  const linhas = [];
  for (const [id, qtd] of somados) {
    const p = E.produtos.find(x => x.variacoes.some(v => v.id === id));
    const v = p?.variacoes.find(x => x.id === id);
    if (!p || !p.ativo) throw new ErroDemo('Um produto da sua sacola não está mais disponível.');
    if (v.estoque < qtd) throw new ErroDemo(v.estoque > 0 ? `Só temos ${v.estoque} unidade(s) de ${p.nome} (${v.rotulo}).` : `${p.nome} (${v.rotulo}) esgotou.`, 409);
    linhas.push({ produtoId: p.id, variacaoId: v.id, nome: p.nome, rotulo: v.rotulo, preco: p.preco, qtd });
  }
  const subtotal = linhas.reduce((s, l) => s + l.preco * l.qtd, 0);
  const frete = subtotal >= CONFIG_DEMO.freteGratisAPartir ? 0 : CONFIG_DEMO.freteFixo;
  return { linhas, subtotal, frete, total: subtotal + frete };
}

function pedidoCompleto(p) { return { ...p, statusTexto: STATUS_DEMO[p.status], itens: p.itens.map(i => ({ ...i })) }; }

function criarPedidoDemo(canal, itens, cliente = {}) {
  if (String(cliente.nome ?? '').trim().length < 2) throw new ErroDemo('Informe seu nome.');
  const { linhas, subtotal, frete, total } = validarDemo(itens);
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codigo = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => alfabeto[b % alfabeto.length]).join('');
  const t = (v, m) => String(v ?? '').trim().slice(0, m);
  const p = {
    id: ++E.seq.ped, codigo, canal, status: canal === 'cartao' ? 'aguardando_pagamento' : 'novo',
    cliente: { nome: t(cliente.nome, 120), telefone: t(cliente.telefone, 40), cidade: t(cliente.cidade, 120), endereco: t(cliente.endereco, 300), observacao: t(cliente.observacao, 500) },
    subtotal, frete, total, estoqueBaixado: false, criadoEm: agoraSql(), atualizadoEm: agoraSql(), itens: linhas,
  };
  E.pedidos.push(p);
  return p;
}

function mudarStatusDemo(id, novo) {
  if (!STATUS_DEMO[novo]) throw new ErroDemo('Status inválido.');
  const p = E.pedidos.find(x => x.id === id);
  if (!p) throw new ErroDemo('Pedido não encontrado.', 404);
  const ajusta = (sinal) => p.itens.forEach(i => {
    const v = E.produtos.flatMap(x => x.variacoes).find(x => x.id === i.variacaoId);
    if (v) v.estoque += sinal * i.qtd;
  });
  if (BAIXA_DEMO.has(novo) && !p.estoqueBaixado) { ajusta(-1); p.estoqueBaixado = true; }
  else if (novo === 'cancelado' && p.estoqueBaixado) { ajusta(1); p.estoqueBaixado = false; }
  p.status = novo; p.atualizadoEm = agoraSql();
  return pedidoCompleto(p);
}

function mensagemDemo(p) {
  const brlD = c => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const c = p.cliente;
  return [
    'Olá, Pantoja Intimeé! 👑', `Quero fazer o pedido *#${p.codigo}*:`, '',
    ...p.itens.map(i => `• ${i.qtd}x ${i.nome}${i.rotulo !== 'Único' ? ` (${i.rotulo})` : ''} — ${brlD(i.preco * i.qtd)}`), '',
    `Subtotal: ${brlD(p.subtotal)}`, `Frete: ${p.frete ? brlD(p.frete) : 'grátis'}`, `*Total: ${brlD(p.total)}*`, '',
    `Nome: ${c.nome}`, c.cidade ? `Cidade: ${c.cidade}` : null, c.endereco ? `Endereço: ${c.endereco}` : null, c.observacao ? `Obs.: ${c.observacao}` : null,
  ].filter(l => l != null).join('\n');
}

function salvarProdutoDemo(id, b = {}) {
  const nome = String(b.nome ?? '').trim().slice(0, 120);
  if (nome.length < 2) throw new ErroDemo('Informe o nome do produto.');
  if (!Number.isInteger(b.preco) || b.preco < 0) throw new ErroDemo('Preço inválido.');
  const variacoes = (b.variacoes ?? []).map(v => ({ id: v.id ? Number(v.id) : null, rotulo: String(v.rotulo ?? '').trim().slice(0, 40), estoque: Math.trunc(Number(v.estoque) || 0) })).filter(v => v.rotulo);
  if (!variacoes.length) throw new ErroDemo('Cadastre ao menos um tamanho/variação (use "Único" se não houver).');
  let p = id == null ? null : E.produtos.find(x => x.id === id);
  if (id != null && !p) throw new ErroDemo('Produto não encontrado.', 404);
  if (!p) {
    let slug = slugDemo(nome), n = 2;
    while (E.produtos.some(x => x.slug === slug)) slug = `${slugDemo(nome)}-${n++}`;
    p = { id: ++E.seq.prod, slug, variacoes: [] };
    E.produtos.push(p);
  }
  Object.assign(p, {
    nome, descricao: String(b.descricao ?? '').slice(0, 3000), preco: b.preco, precoDe: b.precoDe ?? null,
    categoriaId: b.categoriaId ? Number(b.categoriaId) : null, tag: String(b.tag ?? '').trim().slice(0, 24),
    destaque: !!b.destaque, ativo: b.ativo !== false,
    imagens: (b.imagens ?? []).filter(u => /^(data:image\/|https:\/\/)/.test(u)).slice(0, 12),
    cores: (b.cores ?? []).length === 2 ? b.cores : ['#a3122a', '#5b0a12'],
  });
  const antigas = new Map(p.variacoes.map(v => [v.id, v]));
  p.variacoes = variacoes.map(v => (v.id && antigas.has(v.id) ? { id: v.id, rotulo: v.rotulo, estoque: v.estoque } : { id: ++E.seq.var, rotulo: v.rotulo, estoque: v.estoque }));
  return produtoPublico(p);
}

/* Fotos: reduz para no máximo 900px e guarda como imagem embutida */
async function fotoParaDataUrl(arquivo) {
  const img = await createImageBitmap(arquivo);
  const escala = Math.min(1, 900 / Math.max(img.width, img.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.width * escala); cv.height = Math.round(img.height * escala);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', 0.8);
}

const exigirLogin = () => { if (!E.logado) throw new ErroDemo('Faça login para continuar.', 401); };

const ROTAS_DEMO = [
  ['GET', /^\/api\/config$/, () => CONFIG_DEMO],
  ['GET', /^\/api\/categorias$/, () => [...E.categorias].sort((a, b) => a.ordem - b.ordem)],
  ['GET', /^\/api\/produtos$/, (m, c, q) => listarDemo({ categoria: q.get('categoria'), busca: q.get('busca'), destaque: q.get('destaque') === '1' })],
  ['GET', /^\/api\/produtos\/([\w-]+)$/, (m) => {
    const p = E.produtos.find(x => x.slug === m[1] && x.ativo);
    if (!p) throw new ErroDemo('Produto não encontrado.', 404);
    return produtoPublico(p);
  }],
  ['POST', /^\/api\/carrinho\/validar$/, (m, c) => validarDemo(c?.itens)],
  ['POST', /^\/api\/pedidos\/whatsapp$/, (m, c) => {
    const p = criarPedidoDemo('whatsapp', c?.itens, c?.cliente);
    return { codigo: p.codigo, url: `https://wa.me/${CONFIG_DEMO.whatsapp}?text=${encodeURIComponent(mensagemDemo(p))}` };
  }],
  // Na demonstração o pagamento com cartão é simulado e aprovado na hora
  ['POST', /^\/api\/pedidos\/cartao$/, (m, c) => {
    const p = criarPedidoDemo('cartao', c?.itens, c?.cliente);
    mudarStatusDemo(p.id, 'pago');
    return { codigo: p.codigo, url: `/pedido/${p.codigo}?session_id=demo` };
  }],
  ['GET', /^\/api\/pedidos\/([A-Za-z0-9]+)$/, (m) => {
    const p = E.pedidos.find(x => x.codigo === m[1].toUpperCase());
    if (!p) throw new ErroDemo('Pedido não encontrado.', 404);
    const { codigo, canal, status, subtotal, frete, total, criadoEm, itens } = pedidoCompleto(p);
    return { codigo, canal, status, statusTexto: STATUS_DEMO[status], subtotal, frete, total, criadoEm, itens };
  }],
  ['POST', /^\/api\/admin\/login$/, (m, c) => {
    if (String(c?.email).trim().toLowerCase() !== ADMIN_DEMO.email || c?.senha !== ADMIN_DEMO.senha) throw new ErroDemo('E-mail ou senha incorretos.', 401);
    E.logado = true; return { email: ADMIN_DEMO.email };
  }],
  ['POST', /^\/api\/admin\/logout$/, () => { E.logado = false; return { ok: true }; }],
  ['GET', /^\/api\/admin\/eu$/, () => { exigirLogin(); return { email: ADMIN_DEMO.email, status: STATUS_DEMO }; }],
  ['PUT', /^\/api\/admin\/senha$/, () => { exigirLogin(); throw new ErroDemo('Na demonstração a senha não pode ser trocada.'); }],
  ['GET', /^\/api\/admin\/resumo$/, () => {
    exigirLogin();
    const mes = agoraSql().slice(0, 7);
    return {
      pedidosNovos: E.pedidos.filter(p => p.status === 'novo' || p.status === 'pago').length,
      faturamentoMes: E.pedidos.filter(p => BAIXA_DEMO.has(p.status) && p.criadoEm.startsWith(mes)).reduce((s, p) => s + p.total, 0),
      produtosAtivos: E.produtos.filter(p => p.ativo).length,
      estoqueBaixo: E.produtos.filter(p => p.ativo).flatMap(p => p.variacoes.filter(v => v.estoque <= 2).map(v => ({ nome: p.nome, rotulo: v.rotulo, estoque: v.estoque })))
        .sort((a, b) => a.estoque - b.estoque).slice(0, 20),
    };
  }],
  ['GET', /^\/api\/admin\/produtos$/, (m, c, q) => { exigirLogin(); return listarDemo({ todos: true, busca: q.get('busca') }); }],
  ['GET', /^\/api\/admin\/produtos\/(\d+)$/, (m) => {
    exigirLogin();
    const p = E.produtos.find(x => x.id === Number(m[1]));
    if (!p) throw new ErroDemo('Produto não encontrado.', 404);
    return produtoPublico(p);
  }],
  ['POST', /^\/api\/admin\/produtos$/, (m, c) => { exigirLogin(); return salvarProdutoDemo(null, c); }],
  ['PUT', /^\/api\/admin\/produtos\/(\d+)$/, (m, c) => { exigirLogin(); return salvarProdutoDemo(Number(m[1]), c); }],
  ['DELETE', /^\/api\/admin\/produtos\/(\d+)$/, (m) => { exigirLogin(); E.produtos = E.produtos.filter(p => p.id !== Number(m[1])); return { ok: true }; }],
  ['POST', /^\/api\/admin\/upload$/, async (m, c, q, form) => {
    exigirLogin();
    const arquivos = form.getAll('fotos').filter(f => /^image\//.test(f.type));
    if (!arquivos.length) throw new ErroDemo('Envie fotos em JPG, PNG, WEBP ou AVIF.');
    return { urls: await Promise.all(arquivos.map(fotoParaDataUrl)) };
  }],
  ['GET', /^\/api\/admin\/categorias$/, () => { exigirLogin(); return [...E.categorias].sort((a, b) => a.ordem - b.ordem); }],
  ['POST', /^\/api\/admin\/categorias$/, (m, c) => {
    exigirLogin();
    const nome = String(c?.nome ?? '').trim().slice(0, 40);
    if (nome.length < 2) throw new ErroDemo('Informe o nome da categoria.');
    if (E.categorias.some(x => x.slug === slugDemo(nome))) throw new ErroDemo('Já existe uma categoria com esse nome.');
    E.categorias.push({ id: ++E.seq.cat, slug: slugDemo(nome), nome, icone: c.icone || 'coracao', ordem: Math.max(0, ...E.categorias.map(x => x.ordem)) + 1 });
    return E.categorias;
  }],
  ['PUT', /^\/api\/admin\/categorias\/(\d+)$/, (m, c) => {
    exigirLogin();
    const cat = E.categorias.find(x => x.id === Number(m[1]));
    const nome = String(c?.nome ?? '').trim().slice(0, 40);
    if (nome.length < 2) throw new ErroDemo('Informe o nome da categoria.');
    if (cat) Object.assign(cat, { nome, icone: c.icone || 'coracao', ordem: Math.trunc(Number(c.ordem) || 0) });
    return E.categorias;
  }],
  ['DELETE', /^\/api\/admin\/categorias\/(\d+)$/, (m) => {
    exigirLogin();
    const id = Number(m[1]);
    E.categorias = E.categorias.filter(x => x.id !== id);
    E.produtos.forEach(p => { if (p.categoriaId === id) p.categoriaId = null; });
    return E.categorias;
  }],
  ['GET', /^\/api\/admin\/pedidos$/, (m, c, q) => {
    exigirLogin();
    return E.pedidos.filter(p => !q.get('status') || p.status === q.get('status')).slice().reverse().map(pedidoCompleto);
  }],
  ['PUT', /^\/api\/admin\/pedidos\/(\d+)\/status$/, (m, c) => { exigirLogin(); return mudarStatusDemo(Number(m[1]), c?.status); }],
];

globalThis.__DEMO_API__ = async (caminho, { metodo = 'GET', corpo, form } = {}) => {
  const url = new URL(caminho, 'http://demo.local');
  const rota = ROTAS_DEMO.find(([m, re]) => m === metodo && re.test(url.pathname));
  if (!rota) throw new ErroDemo('Rota não encontrada.', 404);
  const copia = corpo === undefined ? undefined : JSON.parse(JSON.stringify(corpo));
  const resposta = await rota[2](url.pathname.match(rota[1]), copia, url.searchParams, form);
  if (metodo !== 'GET') salvarDemo();
  return JSON.parse(JSON.stringify(resposta));
};

/* Alterna entre a loja e o painel dentro do mesmo arquivo */
function mostrarAppDemo() {
  const admin = location.hash.startsWith('#/admin');
  document.getElementById('demo-loja').hidden = admin;
  document.getElementById('demo-admin').hidden = !admin;
  document.getElementById('css-loja').disabled = admin;
  document.getElementById('css-admin').disabled = !admin;
  document.title = admin ? 'Painel · Pantoja Intimeé (demonstração)' : 'Pantoja Intimeé · Moda Íntima Feminina (demonstração)';
}
window.addEventListener('hashchange', mostrarAppDemo);
mostrarAppDemo();
// Links "#/…" trocam só o # (em quadros incorporados o clique comum pode sair da página)
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || e.defaultPrevented) return;
  e.preventDefault();
  location.hash = a.getAttribute('href').slice(1);
});
document.getElementById('demo-reiniciar').onclick = () => {
  if (!confirm('Apagar os pedidos e alterações da demonstração e voltar aos produtos de exemplo?')) return;
  globalThis.__reiniciarDemo__();
  try { localStorage.removeItem('pi_sacola_v2'); } catch {}
  location.hash = '/';
  location.reload();
};
