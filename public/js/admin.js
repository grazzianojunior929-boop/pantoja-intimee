import { ICONES, NOMES_ICONES, esc, brl, midia, ilustracao, api, DEMO } from './comum.js';

const $ = (s, el = document) => el.querySelector(s);
const raiz = $('#raiz');
let STATUS = {};

/* Abas ficam no # da página (na demonstração: #/admin/<aba>, para não misturar com a loja) */
const hrefAba = (id) => (DEMO ? `#/admin/${id}` : `#${id}`);
const abaAtual = () => (DEMO ? location.hash.replace(/^#\/admin\/?/, '') : location.hash.slice(1));
const irAba = (id) => { location.hash = hrefAba(id).slice(1); };
const LINK_LOJA = DEMO ? 'href="#/"' : 'href="/" target="_blank" rel="noopener"';
let categorias = [];

const IC = {
  resumo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  pedidos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 8h14l-1 13H6L5 8z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg>',
  produtos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M3 7l9 4 9-4M12 11v10"/></svg>',
  categorias: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  conta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  loja: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>',
  sair: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 17l5-5-5-5M15 12H3"/></svg>',
  mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
};

/* Reais <-> centavos */
const paraCents = (txt) => {
  const s = String(txt ?? '').trim().replace(/[^\d,.-]/g, '');
  if (!s) return null;
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};
const paraReais = (c) => c == null ? '' : (c / 100).toFixed(2).replace('.', ',');
const dataBR = (iso) => new Date(iso.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

let tt;
function toast(txt) {
  const t = $('#toastAdmin'); t.textContent = txt; t.classList.add('on');
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2600);
}

/* =========================================================
   LOGIN
   ========================================================= */
function telaLogin() {
  raiz.innerHTML = `
  <div class="login"><form id="formLogin">
    <div class="marca">${ICONES.coroa}<h1>PANTOJA INTIMEÉ</h1><p>Painel da loja</p></div>
    ${DEMO ? '<p class="dica" style="text-align:center">Demonstração: os dados já estão preenchidos, é só clicar em Entrar.</p>' : ''}
    <div class="campo"><label for="email">E-mail</label><input id="email" name="email" type="email" autocomplete="username" required value="${DEMO ? 'admin@pantojaintimee.com.br' : ''}"></div>
    <div class="campo"><label for="senha">Senha</label><input id="senha" name="senha" type="password" autocomplete="current-password" required value="${DEMO ? 'pantoja123' : ''}"></div>
    <div class="erro" id="erroLogin" hidden></div>
    <button class="btn btn-vinho" style="padding:.9rem">Entrar</button>
    <a ${LINK_LOJA.replace(/ target.*/, '')} class="dica" style="text-align:center">← Voltar para a loja</a>
  </form></div>`;
  $('#email').focus();
  $('#formLogin').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true;
    try {
      await api('/api/admin/login', { metodo: 'POST', corpo: Object.fromEntries(new FormData(e.target)) });
      iniciar();
    } catch (err) {
      $('#erroLogin').textContent = err.message; $('#erroLogin').hidden = false; btn.disabled = false;
    }
  };
}

/* =========================================================
   ESTRUTURA
   ========================================================= */
const ABAS = [['resumo', 'Resumo'], ['pedidos', 'Pedidos'], ['produtos', 'Produtos'], ['categorias', 'Categorias'], ['conta', 'Conta']];
const TELAS = { resumo: telaResumo, pedidos: telaPedidos, produtos: telaProdutos, categorias: telaCategorias, conta: telaConta };

function montarLayout() {
  raiz.innerHTML = `
  <div class="layout">
    <nav class="lateral">
      <div class="marca">${ICONES.coroa}<span><b>PANTOJA<br>INTIMEÉ</b><small>PAINEL</small></span></div>
      ${ABAS.map(([id, nome]) => `<a class="aba" href="${hrefAba(id)}" data-aba="${id}">${IC[id]}<span>${nome}</span></a>`).join('')}
      <div class="rodape">
        <a class="aba" ${LINK_LOJA}>${IC.loja}<span>Ver loja</span></a>
        <button class="aba" id="sair">${IC.sair}<span>Sair</span></button>
      </div>
    </nav>
    <main class="conteudo" id="conteudo"></main>
  </div>
  <div class="veu" id="veuAdmin"></div>
  <aside class="editor" id="editor" aria-label="Editor"></aside>`;
  $('#sair').onclick = async () => { await api('/api/admin/logout', { metodo: 'POST' }).catch(() => {}); telaLogin(); };
  $('#veuAdmin').onclick = fecharEditor;
}

async function rotear() {
  const pedida = abaAtual();
  const aba = TELAS[pedida] ? pedida : 'resumo';
  document.querySelectorAll('[data-aba]').forEach(a => a.classList.toggle('on', a.dataset.aba === aba));
  const c = $('#conteudo');
  c.innerHTML = '<div class="carregando"></div>';
  try { await TELAS[aba](c); }
  catch (e) {
    if (e.status === 401) return telaLogin();
    c.innerHTML = `<div class="erro">${esc(e.message)}</div>`;
  }
}
window.addEventListener('hashchange', () => { if ($('#conteudo') && (!DEMO || location.hash.startsWith('#/admin'))) rotear(); });

/* =========================================================
   RESUMO
   ========================================================= */
async function telaResumo(c) {
  const r = await api('/api/admin/resumo');
  c.innerHTML = `
    <div class="topo"><h1>Olá! 👑</h1><div class="acoes"><button class="btn btn-vinho" id="novoProd">${IC.mais}Novo produto</button></div></div>
    <div class="kpis">
      <a class="cartao kpi" href="${hrefAba('pedidos')}" style="text-decoration:none"><span>Pedidos para tratar</span><b>${r.pedidosNovos}</b></a>
      <div class="cartao kpi"><span>Vendas confirmadas no mês</span><b>${brl(r.faturamentoMes)}</b></div>
      <a class="cartao kpi" href="${hrefAba('produtos')}" style="text-decoration:none"><span>Produtos ativos</span><b>${r.produtosAtivos}</b></a>
    </div>
    <div class="cartao">
      <h3 style="font-family:var(--serif);font-size:1.4rem;color:var(--vinho);margin-bottom:.6rem">Estoque baixo</h3>
      ${r.estoqueBaixo.length ? `<table class="tabela"><thead><tr><th>Produto</th><th>Variação</th><th>Estoque</th></tr></thead><tbody>
        ${r.estoqueBaixo.map(e => `<tr><td>${esc(e.nome)}</td><td>${esc(e.rotulo)}</td><td><span class="pill ${e.estoque <= 0 ? 'alerta' : ''}">${e.estoque}</span></td></tr>`).join('')}
      </tbody></table>` : '<p class="dica">Tudo certo: nenhum item com 2 unidades ou menos.</p>'}
    </div>`;
  $('#novoProd').onclick = () => abrirEditorProduto(null);
}

/* =========================================================
   PEDIDOS
   ========================================================= */
let filtroPedidos = '';
async function telaPedidos(c) {
  const pedidos = await api(`/api/admin/pedidos${filtroPedidos ? `?status=${filtroPedidos}` : ''}`);
  c.innerHTML = `
    <div class="topo"><h1>Pedidos</h1></div>
    <div class="filtros">
      <button class="chip ${!filtroPedidos ? 'on' : ''}" data-filtro="">Todos</button>
      ${Object.entries(STATUS).map(([k, v]) => `<button class="chip ${filtroPedidos === k ? 'on' : ''}" data-filtro="${k}">${v}</button>`).join('')}
    </div>
    <div id="listaPedidos">${pedidos.length ? pedidos.map(cardPedido).join('') : '<div class="cartao vazio">Nenhum pedido por aqui ainda.</div>'}</div>
    <p class="dica" style="margin-top:1rem">O estoque é baixado quando o pedido fica “Pago / confirmado” (automático no cartão) e devolvido se você cancelar depois.</p>`;
  c.querySelectorAll('[data-filtro]').forEach(b => b.onclick = () => { filtroPedidos = b.dataset.filtro; rotear(); });
  c.querySelectorAll('.pedido-cab').forEach(h => h.onclick = (e) => { if (!e.target.closest('select')) h.parentElement.classList.toggle('aberto'); });
  c.querySelectorAll('[data-status]').forEach(sel => sel.onchange = async () => {
    try {
      await api(`/api/admin/pedidos/${sel.dataset.status}/status`, { metodo: 'PUT', corpo: { status: sel.value } });
      toast('Status atualizado ✓');
      rotear();
    } catch (e) { toast(e.message); }
  });
}

function cardPedido(p) {
  const tel = p.cliente.telefone.replace(/\D/g, '');
  const telZap = tel.length >= 10 && !tel.startsWith('55') ? '55' + tel : tel;
  return `<div class="pedido">
    <div class="pedido-cab">
      <div><span class="cod">#${esc(p.codigo)}</span><br><small>${dataBR(p.criadoEm)}</small></div>
      <div><b>${esc(p.cliente.nome || '—')}</b><br><small>${p.canal === 'cartao' ? '💳 Cartão (Stripe)' : '💬 WhatsApp'} · ${p.itens.reduce((s, i) => s + i.qtd, 0)} item(ns)</small></div>
      <div class="valor">${brl(p.total)}</div>
      <select class="status-sel" data-status="${p.id}" aria-label="Status do pedido">
        ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === p.status ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
    </div>
    <div class="pedido-corpo">
      <div>
        <h4>Itens</h4>
        ${p.itens.map(i => `<div class="linha"><span>${i.qtd}x ${esc(i.nome)}${i.rotulo !== 'Único' ? ` <span class="pill">${esc(i.rotulo)}</span>` : ''}</span><span>${brl(i.preco * i.qtd)}</span></div>`).join('')}
        <div class="linha" style="border-top:1px solid var(--linha);margin-top:.4rem;padding-top:.5rem"><span>Frete</span><span>${p.frete ? brl(p.frete) : 'Grátis'}</span></div>
        <div class="linha"><b>Total</b><b>${brl(p.total)}</b></div>
      </div>
      <div>
        <h4>Cliente</h4>
        <div>${esc(p.cliente.nome || '—')}</div>
        ${p.cliente.telefone ? `<div>${esc(p.cliente.telefone)}</div>` : ''}
        ${p.cliente.cidade ? `<div>${esc(p.cliente.cidade)}</div>` : ''}
        ${p.cliente.endereco ? `<div>${esc(p.cliente.endereco)}</div>` : ''}
        ${p.cliente.observacao ? `<div style="margin-top:.5rem"><b>Obs.:</b> ${esc(p.cliente.observacao)}</div>` : ''}
        ${telZap ? `<a class="btn btn-borda btn-mini" style="margin-top:.7rem" target="_blank" rel="noopener" href="https://wa.me/${telZap}?text=${encodeURIComponent(`Olá, ${p.cliente.nome}! Aqui é da Pantoja Intimeé, sobre o seu pedido #${p.codigo} 💋`)}">Chamar no WhatsApp</a>` : ''}
        <p class="dica" style="margin-top:.6rem">Estoque ${p.estoqueBaixado ? 'já baixado' : 'ainda não baixado'}.</p>
      </div>
    </div>
  </div>`;
}

/* =========================================================
   PRODUTOS
   ========================================================= */
let buscaProdutos = '';
async function telaProdutos(c) {
  const produtos = await api(`/api/admin/produtos${buscaProdutos ? `?busca=${encodeURIComponent(buscaProdutos)}` : ''}`);
  c.innerHTML = `
    <div class="topo"><h1>Produtos</h1>
      <div class="acoes">
        <input class="entrada" id="buscaProd" placeholder="Buscar…" value="${esc(buscaProdutos)}" style="width:200px">
        <button class="btn btn-vinho" id="novoProd">${IC.mais}Novo produto</button>
      </div></div>
    <div class="cartao rolavel">
      ${produtos.length ? `<table class="tabela responsiva"><thead><tr><th>Produto</th><th>Preço</th><th>Estoque</th><th>Situação</th><th></th></tr></thead><tbody>
      ${produtos.map(p => `<tr>
        <td class="col-inteira"><div class="prod-cel"><div class="miniatura">${midia(p)}</div><div><b>${esc(p.nome)}</b><span class="dica">${esc(p.categoria?.nome ?? 'Sem categoria')}</span></div></div></td>
        <td>${brl(p.preco)}${p.precoDe ? `<br><s class="dica">${brl(p.precoDe)}</s>` : ''}</td>
        <td class="est">${p.variacoes.map(v => `${esc(v.rotulo)}: <b class="${v.estoque <= 0 ? 'zero' : ''}">${v.estoque}</b>`).join(' · ')}</td>
        <td>${p.ativo ? '<span class="pill ok">Ativo</span>' : '<span class="pill off">Oculto</span>'}${p.destaque ? ' <span class="pill">Destaque</span>' : ''}</td>
        <td style="text-align:right"><button class="btn btn-borda btn-mini" data-editar="${p.id}">Editar</button></td>
      </tr>`).join('')}</tbody></table>` : '<div class="vazio">Nenhum produto encontrado.</div>'}
    </div>`;
  $('#novoProd').onclick = () => abrirEditorProduto(null);
  c.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => abrirEditorProduto(Number(b.dataset.editar)));
  let t;
  $('#buscaProd').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { buscaProdutos = e.target.value.trim(); rotear(); }, 350); };
  if (buscaProdutos) { const i = $('#buscaProd'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}

const ATALHOS_TAMANHO = { 'P M G': ['P', 'M', 'G'], 'P ao GG': ['P', 'M', 'G', 'GG'], 'Sutiã 40–46': ['40', '42', '44', '46'], 'Único': ['Único'] };

async function abrirEditorProduto(id) {
  const p = id ? await api(`/api/admin/produtos/${id}`) : {
    nome: '', descricao: '', preco: null, precoDe: null, tag: '', destaque: false, ativo: true, imagens: [],
    cores: ['#a3122a', '#5b0a12'], categoria: categorias[0] ?? null, variacoes: [{ rotulo: 'P', estoque: 0 }, { rotulo: 'M', estoque: 0 }, { rotulo: 'G', estoque: 0 }],
  };
  const estado = { imagens: [...p.imagens], variacoes: p.variacoes.map(v => ({ ...v })) };
  const ed = $('#editor');
  ed.innerHTML = `
    <div class="editor-topo"><h2>${id ? 'Editar produto' : 'Novo produto'}</h2>
      <button class="btn" style="color:#fff;font-size:1.4rem" id="fecharEd" aria-label="Fechar">×</button></div>
    <form class="editor-corpo" id="formProd" novalidate>
      <div class="campo"><label for="p-nome">Nome *</label><input id="p-nome" name="nome" required value="${esc(p.nome)}"></div>
      <div class="grade3">
        <div class="campo"><label for="p-preco">Preço (R$) *</label><input id="p-preco" name="preco" inputmode="decimal" placeholder="59,90" value="${paraReais(p.preco)}"></div>
        <div class="campo"><label for="p-de">Preço “de” (R$)</label><input id="p-de" name="precoDe" inputmode="decimal" placeholder="opcional" value="${paraReais(p.precoDe)}"></div>
        <div class="campo"><label for="p-cat">Categoria</label><select id="p-cat" name="categoriaId">
          <option value="">Sem categoria</option>
          ${categorias.map(c => `<option value="${c.id}" ${p.categoria?.id === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
        </select></div>
      </div>
      <div class="campo"><label for="p-desc">Descrição</label><textarea id="p-desc" name="descricao">${esc(p.descricao)}</textarea></div>

      <div class="campo"><span class="rotulo">Fotos</span>
        <div class="fotos" id="fotos"></div>
        <span class="dica">A primeira foto (com selo “Capa”) aparece na vitrine. JPG, PNG ou WEBP de até 6 MB.</span>
      </div>

      <div class="campo"><span class="rotulo">Tamanhos / variações e estoque</span>
        <div class="atalhos">${Object.keys(ATALHOS_TAMANHO).map(k => `<button type="button" class="chip" data-atalho="${k}">${k}</button>`).join('')}</div>
        <div class="variacoes" id="variacoes"></div>
        <button type="button" class="btn btn-borda btn-mini" id="addVar" style="justify-self:start">${IC.mais}Adicionar variação</button>
      </div>

      <div class="grade2">
        <div class="campo"><label for="p-tag">Etiqueta</label><input id="p-tag" name="tag" list="tags" placeholder="Novo, Oferta, 18+…" value="${esc(p.tag)}">
          <datalist id="tags"><option>Novo</option><option>Oferta</option><option>Mais vendida</option><option>Hot</option><option>18+</option><option>Presente</option><option>Encomenda</option></datalist></div>
        <div class="campo"><span class="rotulo">Cores da ilustração (sem foto)</span>
          <div class="cores"><input type="color" name="cor1" value="${esc(p.cores[0])}" aria-label="Cor 1"><input type="color" name="cor2" value="${esc(p.cores[1])}" aria-label="Cor 2"><div class="previa" id="previa"></div></div></div>
      </div>
      <div style="display:flex;gap:1.5rem;flex-wrap:wrap">
        <label class="check"><input type="checkbox" name="ativo" ${p.ativo ? 'checked' : ''}> Visível na loja</label>
        <label class="check"><input type="checkbox" name="destaque" ${p.destaque ? 'checked' : ''}> Destaque na página inicial</label>
      </div>
      <div class="erro" id="erroProd" hidden></div>
    </form>
    <div class="editor-rodape">
      ${id ? '<button class="btn btn-perigo" id="excluir" style="margin-right:auto">Excluir</button>' : ''}
      <button class="btn btn-borda" id="cancelarEd">Cancelar</button>
      <button class="btn btn-vinho" id="salvarEd">Salvar produto</button>
    </div>`;

  const form = $('#formProd');
  const icone = () => categorias.find(c => c.id === Number(form.categoriaId.value))?.icone ?? 'coracao';
  const atualizarPrevia = () => { $('#previa').innerHTML = ilustracao(icone(), [form.cor1.value, form.cor2.value]); };

  function renderFotos() {
    $('#fotos').innerHTML = estado.imagens.map((src, i) => `
      <div class="foto ${i === 0 ? 'capa' : ''}"><img src="${esc(src)}" alt="">${i === 0 ? '<span class="selo-capa">Capa</span>' : ''}
        <div class="acoes-foto">${i ? `<button type="button" data-capa="${i}">Capa</button>` : '<span></span>'}<button type="button" data-tirar="${i}">Remover</button></div></div>`).join('') +
      `<label class="enviar-foto">${IC.mais.replace('<svg', '<svg width="24"')}<span>Enviar fotos</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple id="arquivos"></label>`;
    $('#fotos').querySelectorAll('[data-capa]').forEach(b => b.onclick = () => { const [f] = estado.imagens.splice(Number(b.dataset.capa), 1); estado.imagens.unshift(f); renderFotos(); });
    $('#fotos').querySelectorAll('[data-tirar]').forEach(b => b.onclick = () => { estado.imagens.splice(Number(b.dataset.tirar), 1); renderFotos(); });
    $('#arquivos').onchange = async (e) => {
      const arquivos = [...e.target.files];
      if (!arquivos.length) return;
      const fd = new FormData();
      arquivos.forEach(a => fd.append('fotos', a));
      toast('Enviando fotos…');
      try {
        const { urls } = await api('/api/admin/upload', { metodo: 'POST', form: fd });
        estado.imagens.push(...urls);
        renderFotos();
        toast(`${urls.length} foto(s) adicionada(s) ✓`);
      } catch (err) { toast(err.message); }
    };
  }

  function renderVariacoes() {
    $('#variacoes').innerHTML = estado.variacoes.map((v, i) => `
      <div class="var-linha">
        <input class="entrada" data-rot="${i}" value="${esc(v.rotulo)}" placeholder="Ex.: M, 42, Melancia" aria-label="Variação">
        <input class="entrada" data-est="${i}" type="number" min="0" value="${v.estoque}" aria-label="Estoque">
        <button type="button" data-delvar="${i}" aria-label="Remover variação">×</button>
      </div>`).join('') || '<p class="dica">Nenhuma variação. Use “Único” para produtos sem tamanho.</p>';
    $('#variacoes').querySelectorAll('[data-rot]').forEach(inp => inp.oninput = () => { estado.variacoes[inp.dataset.rot].rotulo = inp.value; });
    $('#variacoes').querySelectorAll('[data-est]').forEach(inp => inp.oninput = () => { estado.variacoes[inp.dataset.est].estoque = Number(inp.value); });
    $('#variacoes').querySelectorAll('[data-delvar]').forEach(b => b.onclick = () => { estado.variacoes.splice(Number(b.dataset.delvar), 1); renderVariacoes(); });
  }

  renderFotos(); renderVariacoes(); atualizarPrevia();
  form.cor1.oninput = form.cor2.oninput = form.categoriaId.onchange = atualizarPrevia;
  $('#addVar').onclick = () => { estado.variacoes.push({ rotulo: '', estoque: 0 }); renderVariacoes(); $('#variacoes').querySelector('.var-linha:last-child input').focus(); };
  ed.querySelectorAll('[data-atalho]').forEach(b => b.onclick = () => {
    // mantém o id/estoque das variações que continuam existindo
    estado.variacoes = ATALHOS_TAMANHO[b.dataset.atalho].map(r => estado.variacoes.find(v => v.rotulo === r) ?? { rotulo: r, estoque: 0 });
    renderVariacoes();
  });
  $('#fecharEd').onclick = $('#cancelarEd').onclick = fecharEditor;
  form.onsubmit = (e) => { e.preventDefault(); $('#salvarEd').click(); };

  $('#salvarEd').onclick = async () => {
    const erro = $('#erroProd'); erro.hidden = true;
    const preco = paraCents(form.preco.value), precoDe = paraCents(form.precoDe.value);
    const falha = (msg) => { erro.textContent = msg; erro.hidden = false; erro.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    if (preco == null || Number.isNaN(preco)) return falha('Informe um preço válido, ex.: 59,90');
    if (Number.isNaN(precoDe)) return falha('Preço “de” inválido.');
    const corpo = {
      nome: form.nome.value, descricao: form.descricao.value, preco, precoDe,
      categoriaId: form.categoriaId.value || null, tag: form.tag.value,
      ativo: form.ativo.checked, destaque: form.destaque.checked,
      imagens: estado.imagens, cores: [form.cor1.value, form.cor2.value], variacoes: estado.variacoes,
    };
    const btn = $('#salvarEd'); btn.disabled = true;
    try {
      await api(id ? `/api/admin/produtos/${id}` : '/api/admin/produtos', { metodo: id ? 'PUT' : 'POST', corpo });
      fecharEditor(); toast('Produto salvo ✓');
      abaAtual() === 'produtos' ? rotear() : irAba('produtos');
    } catch (err) { falha(err.message); btn.disabled = false; }
  };

  $('#excluir')?.addEventListener('click', async () => {
    if (!confirm(`Excluir “${p.nome}”? Isso não pode ser desfeito.\n\nDica: para só esconder da loja, desmarque “Visível na loja”.`)) return;
    try {
      await api(`/api/admin/produtos/${id}`, { metodo: 'DELETE' });
      fecharEditor(); toast('Produto excluído'); rotear();
    } catch (err) { toast(err.message); }
  });

  ed.classList.add('on'); $('#veuAdmin').classList.add('on');
  setTimeout(() => form.nome.focus(), 350);
}

function fecharEditor() { $('#editor')?.classList.remove('on'); $('#veuAdmin')?.classList.remove('on'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharEditor(); });

/* =========================================================
   CATEGORIAS
   ========================================================= */
async function telaCategorias(c) {
  categorias = await api('/api/admin/categorias');
  const opcoesIcone = (atual) => Object.entries(NOMES_ICONES).map(([k, v]) => `<option value="${k}" ${k === atual ? 'selected' : ''}>${v}</option>`).join('');
  c.innerHTML = `
    <div class="topo"><h1>Categorias</h1></div>
    <form class="cartao" id="novaCat" style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:end;margin-bottom:1rem">
      <div class="campo" style="flex:1;min-width:180px"><label for="nc-nome">Nova categoria</label><input id="nc-nome" name="nome" placeholder="Ex.: Plus size"></div>
      <div class="campo"><label for="nc-ic">Ícone</label><select id="nc-ic" name="icone">${opcoesIcone('coracao')}</select></div>
      <button class="btn btn-vinho">${IC.mais}Adicionar</button>
    </form>
    <div class="cartao rolavel"><table class="tabela"><thead><tr><th>Ordem</th><th>Nome</th><th>Ícone</th><th></th></tr></thead><tbody>
      ${categorias.map(cat => `<tr data-cat="${cat.id}">
        <td style="width:90px"><input class="entrada" type="number" name="ordem" value="${cat.ordem}" style="width:70px"></td>
        <td><input class="entrada" name="nome" value="${esc(cat.nome)}"></td>
        <td><select class="entrada" name="icone">${opcoesIcone(cat.icone)}</select></td>
        <td style="white-space:nowrap;text-align:right"><button class="btn btn-borda btn-mini" data-salvar>Salvar</button> <button class="btn btn-perigo btn-mini" data-excluir>Excluir</button></td>
      </tr>`).join('')}
    </tbody></table></div>
    <p class="dica" style="margin-top:.8rem">Ao excluir uma categoria, os produtos dela ficam “Sem categoria” (não são apagados).</p>`;
  $('#novaCat').onsubmit = async (e) => {
    e.preventDefault();
    try { await api('/api/admin/categorias', { metodo: 'POST', corpo: Object.fromEntries(new FormData(e.target)) }); toast('Categoria criada ✓'); rotear(); }
    catch (err) { toast(err.message); }
  };
  c.querySelectorAll('tr[data-cat]').forEach(tr => {
    const id = tr.dataset.cat;
    const val = (n) => tr.querySelector(`[name=${n}]`).value;
    tr.querySelector('[data-salvar]').onclick = async () => {
      try { await api(`/api/admin/categorias/${id}`, { metodo: 'PUT', corpo: { nome: val('nome'), icone: val('icone'), ordem: val('ordem') } }); toast('Categoria salva ✓'); rotear(); }
      catch (err) { toast(err.message); }
    };
    tr.querySelector('[data-excluir]').onclick = async () => {
      if (!confirm(`Excluir a categoria “${val('nome')}”?`)) return;
      await api(`/api/admin/categorias/${id}`, { metodo: 'DELETE' }); toast('Categoria excluída'); rotear();
    };
  });
}

/* =========================================================
   CONTA
   ========================================================= */
async function telaConta(c) {
  const eu = await api('/api/admin/eu');
  c.innerHTML = `
    <div class="topo"><h1>Conta</h1></div>
    <form class="cartao" id="formSenha" style="max-width:440px;display:grid;gap:1rem">
      <p>Conectada como <b>${esc(eu.email)}</b></p>
      <div class="campo"><label for="s-atual">Senha atual</label><input id="s-atual" name="atual" type="password" autocomplete="current-password" required></div>
      <div class="campo"><label for="s-nova">Nova senha (mín. 8 caracteres)</label><input id="s-nova" name="nova" type="password" autocomplete="new-password" minlength="8" required></div>
      <button class="btn btn-vinho">Trocar senha</button>
    </form>`;
  $('#formSenha').onsubmit = async (e) => {
    e.preventDefault();
    try { await api('/api/admin/senha', { metodo: 'PUT', corpo: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); toast('Senha alterada ✓'); }
    catch (err) { toast(err.message); }
  };
}

/* =========================================================
   INÍCIO
   ========================================================= */
async function iniciar() {
  try {
    const eu = await api('/api/admin/eu');
    STATUS = eu.status;
    categorias = await api('/api/admin/categorias');
  } catch (e) {
    if (e.status === 401) return telaLogin();
    raiz.innerHTML = `<div class="erro" style="margin:2rem">${esc(e.message)}</div>`;
    return;
  }
  montarLayout();
  rotear();
}
iniciar();
