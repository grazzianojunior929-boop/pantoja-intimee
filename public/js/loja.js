import { ICONES, esc, brl, ilustracao, midia, api, guardar, ler } from './comum.js';

const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');

let config = { whatsapp: '', cartaoAtivo: false, freteFixo: 0, freteGratisAPartir: 0 };
let categorias = [];
/* Sacola: [{variacaoId, qtd, slug, nome, rotulo, preco, imagem, icone, cores}] */
let sacola = ler('pi_sacola_v2', []);

const linkZap = (texto) => `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(texto)}`;
const rotuloVar = (r) => (r === 'Único' ? '' : r);

/* =========================================================
   NAVEGAÇÃO (rotas no navegador, sem recarregar a página)
   ========================================================= */
const ROTAS = [
  [/^\/$/, telaInicio],
  [/^\/loja\/?$/, telaLoja],
  [/^\/produto\/([\w-]+)\/?$/, telaProduto],
  [/^\/finalizar\/?$/, telaFinalizar],
  [/^\/pedido\/([A-Za-z0-9]+)\/?$/, telaPedido],
];

async function rotear() {
  fecharTudo();
  const caminho = location.pathname;
  const rota = ROTAS.find(([re]) => re.test(caminho));
  app.innerHTML = '<div class="carregando"></div>';
  try {
    if (rota) await rota[1](...caminho.match(rota[0]).slice(1));
    else telaNaoEncontrada();
  } catch (e) {
    app.innerHTML = `<div class="container pagina"><div class="status-card"><h1>Ops!</h1><p style="margin:1rem 0">${esc(e.message)}</p><a class="btn btn-vinho" href="/loja">Voltar à loja</a></div></div>`;
  }
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  else window.scrollTo({ top: 0, behavior: 'instant' });
  revelar();
}

export function ir(url) {
  history.pushState(null, '', url);
  rotear();
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || a.target === '_blank' || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.pathname.startsWith('/admin') || url.pathname.startsWith('/uploads')) return;
  e.preventDefault();
  if (url.pathname === location.pathname && url.search === location.search && url.hash) {
    history.pushState(null, '', url);
    document.getElementById(url.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    fecharTudo();
    return;
  }
  ir(url.pathname + url.search + url.hash);
});
window.addEventListener('popstate', rotear);

/* =========================================================
   COMPONENTES
   ========================================================= */
function card(p, i = 0) {
  const disponivel = p.variacoes.some(v => v.estoque > 0);
  const escolher = p.variacoes.length > 1;
  const classeTag = p.tag === '18+' ? 'mais18' : p.tag === 'Oferta' ? 'ouro' : '';
  return `<article class="card ${disponivel ? '' : 'esgotado'}" style="animation-delay:${i * 40}ms">
    ${p.tag ? `<span class="etiqueta ${classeTag}">${esc(p.tag)}</span>` : ''}
    <a class="card-img" href="/produto/${esc(p.slug)}" aria-label="${esc(p.nome)}">${midia(p)}</a>
    <div class="card-corpo">
      <span class="card-cat">${esc(p.categoria?.nome ?? '')}</span>
      <h3><a href="/produto/${esc(p.slug)}">${esc(p.nome)}</a></h3>
      <div class="preco"><b>${brl(p.preco)}</b>${p.precoDe ? `<s>${brl(p.precoDe)}</s>` : ''}</div>
      <span class="parcela">ou 3x de ${brl(Math.ceil(p.preco / 3))}</span>
      ${!disponivel ? '<button class="add" disabled>Esgotado</button>'
        : escolher ? `<a class="add" href="/produto/${esc(p.slug)}">Escolher ${p.variacoes.every(v => /^(PP|P|M|G|GG|XG|\d+)$/.test(v.rotulo)) ? 'tamanho' : 'opção'}</a>`
        : `<button class="add" data-add-rapido="${p.variacoes[0].id}" data-slug="${esc(p.slug)}">${ICONE_SACOLA}Adicionar</button>`}
    </div>
  </article>`;
}
const ICONE_SACOLA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8h14l-1 13H6L5 8z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg>';

/* Cache leve dos produtos já carregados, para o "adicionar rápido" dos cards */
const cacheProdutos = new Map();
const lembrar = (lista) => { lista.forEach(p => cacheProdutos.set(p.slug, p)); return lista; };

/* =========================================================
   TELAS
   ========================================================= */
async function telaInicio() {
  const destaques = lembrar(await api('/api/produtos?destaque=1'));
  const comFoto = destaques.find(p => p.imagens.length);
  app.innerHTML = `
  <section class="hero" style="padding:0">
    <div class="container hero-grid">
      <div class="rev">
        <span class="sobretitulo">Moda íntima feminina</span>
        <h1>O íntimo que <em>valoriza você</em></h1>
        <p>Lingeries, calcinhas exclusivas e produtos sensuais escolhidos a dedo para você se sentir poderosa, desejada e incrível. Embalagem discreta e envio para todo o Brasil.</p>
        <div class="cta-row">
          <a href="/loja" class="btn btn-ouro">Ver coleção <svg width="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
          <a href="/loja?categoria=kits" class="btn btn-linha">Kits presente</a>
        </div>
        <div class="hero-stats">
          <div><b>+600</b><span>clientes</span></div>
          <div><b>100%</b><span>discreto</span></div>
          <div><b>BR</b><span>envio nacional</span></div>
        </div>
      </div>
      <div class="hero-visual rev">
        <div class="hero-moldura"></div>
        <div class="hero-arco">${comFoto ? `<img src="${esc(comFoto.imagens[0])}" alt="${esc(comFoto.nome)}">` : ilustracao('sutia', ['#e01f3d', '#5b0a12'])}</div>
        <div class="selo"><div><b>Nova</b><span>coleção<br>rubi</span></div></div>
        <div class="tag-flut">✨ Embalagem de presente</div>
      </div>
    </div>
  </section>

  <section style="padding-bottom:2rem">
    <div class="container">
      <div class="titulo-sec rev"><span class="script">Explore</span><h2>Nossas categorias</h2></div>
      <div class="cats rev">${categorias.map(c => `
        <a href="/loja?categoria=${esc(c.slug)}" class="cat"><span class="cat-anel"><div>${ICONES[c.icone] ?? ICONES.coracao}</div></span>${esc(c.nome)}</a>`).join('')}
      </div>
    </div>
  </section>

  <section class="loja">
    <div class="container">
      <div class="titulo-sec rev"><span class="script">Destaques</span><h2>Os queridinhos da loja</h2>
        <p>Peças escolhidas a dedo pelas nossas clientes.</p></div>
      <div class="grade">${destaques.slice(0, 8).map(card).join('') || '<p class="vazio">Em breve, novidades por aqui 💋</p>'}</div>
      <div style="text-align:center;margin-top:2.5rem"><a href="/loja" class="btn btn-vinho">Ver todos os produtos</a></div>
    </div>
  </section>

  <section class="destaque">
    <div class="container destaque-grid">
      <div class="rev">
        <span class="sobretitulo">Kits presente</span>
        <h2 style="margin-top:1rem">Surpreenda com um <em>kit inesquecível</em></h2>
        <p>Kits exclusivos com lingerie, cosméticos sensuais e mimos especiais, em embalagem luxuosa com rosa e cartão personalizado.</p>
        <ul class="lista-ok">
          <li>Caixa presente com rosa encantada</li>
          <li>Cartão com mensagem personalizada</li>
          <li>Combinação de peças à sua escolha</li>
          <li>Envio discreto para todo o Brasil</li>
        </ul>
        <a class="btn btn-ouro" href="/loja?categoria=kits">Ver kits disponíveis</a>
      </div>
      <div class="mosaico rev">${destaques.slice(0, 3).map(p => `<div>${midia(p)}</div>`).join('')}</div>
    </div>
  </section>

  <section>
    <div class="container vantagens">
      <div class="vant rev"><div class="vant-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M3 7l9 4 9-4M12 11v10"/></svg></div><h4>Envio p/ todo BR</h4><p>Saindo de Aliança - TO com rastreio.</p></div>
      <div class="vant rev"><div class="vant-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg></div><h4>Embalagem discreta</h4><p>Ninguém sabe o que tem dentro.</p></div>
      <div class="vant rev"><div class="vant-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s-8-5.5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.5-8 11-8 11z"/></svg></div><h4>Feito com amor</h4><p>Cada pedido embalado à mão.</p></div>
      <div class="vant rev"><div class="vant-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20M6 15h4"/></svg></div><h4>${config.cartaoAtivo ? 'Cartão ou WhatsApp' : 'Pedido no WhatsApp'}</h4><p>${config.cartaoAtivo ? 'Pague online com cartão ou combine pelo WhatsApp.' : 'Finalize rapidinho com a gente.'}</p></div>
    </div>
  </section>

  <section id="feedbacks" style="background:var(--rosa-claro)">
    <div class="container">
      <div class="titulo-sec rev"><span class="script">Feedbacks</span><h2>Quem compra, ama</h2><div class="ornamento">♥</div></div>
      <!-- Exemplos: substitua por depoimentos reais das clientes -->
      <div class="depo-wrap">
        <div class="depo rev"><div class="estrelas">★★★★★</div><p>A calcinha de borboleta é ainda mais linda pessoalmente! Chegou super rápido e a embalagem é um luxo.</p><div class="depo-autor"><div class="avatar">J</div><div><b>Juliana M.</b><br><small>Palmas - TO</small></div></div></div>
        <div class="depo rev"><div class="estrelas">★★★★★</div><p>Comprei o kit para presentear e foi um sucesso. Atendimento carinhoso do começo ao fim.</p><div class="depo-autor"><div class="avatar">R</div><div><b>Rafaela S.</b><br><small>Gurupi - TO</small></div></div></div>
        <div class="depo rev"><div class="estrelas">★★★★★</div><p>Qualidade incrível, a renda é macia e o caimento perfeito. Já virei cliente fiel!</p><div class="depo-autor"><div class="avatar">C</div><div><b>Camila A.</b><br><small>Goiânia - GO</small></div></div></div>
      </div>
    </div>
  </section>

  <section id="duvidas">
    <div class="container">
      <div class="titulo-sec rev"><span class="script">Dúvidas</span><h2>Perguntas frequentes</h2></div>
      <div class="faq rev">
        <details><summary>Como faço meu pedido?</summary><p>Escolha os produtos, coloque na sacola e clique em “Finalizar compra”. Você pode ${config.cartaoAtivo ? 'pagar com cartão direto no site ou ' : ''}enviar o pedido pronto para o nosso WhatsApp.</p></details>
        <details><summary>Vocês enviam para todo o Brasil?</summary><p>Sim! Enviamos de Aliança - TO para todo o país, com código de rastreio. ${config.freteGratisAPartir ? `Frete grátis em compras acima de ${brl(config.freteGratisAPartir)}.` : ''}</p></details>
        <details><summary>A embalagem é discreta?</summary><p>Totalmente. A caixa externa não identifica o conteúdo, e por dentro tudo vem embalado com muito carinho.</p></details>
        <details><summary>Fazem peças por encomenda?</summary><p>Sim! Calcinhas personalizadas com nome e outras encomendas: escreva o pedido na observação ou fale com a gente no WhatsApp.</p></details>
        <details><summary>Posso trocar uma peça?</summary><p>Por questões de higiene, peças íntimas e cosméticos não têm troca após abertos. Em caso de defeito, entre em contato em até 7 dias.</p></details>
      </div>
    </div>
  </section>`;
}

async function telaLoja() {
  const qs = new URLSearchParams(location.search);
  const categoria = qs.get('categoria') ?? '';
  const busca = qs.get('busca') ?? '';
  const cat = categorias.find(c => c.slug === categoria);
  const params = new URLSearchParams();
  if (categoria) params.set('categoria', categoria);
  if (busca) params.set('busca', busca);
  const produtos = lembrar(await api(`/api/produtos?${params}`));
  document.title = `${cat ? cat.nome : 'Loja'} · Pantoja Intimeé`;
  app.innerHTML = `
  <div class="container pagina">
    <nav class="trilha"><a href="/">Início</a><span>${cat ? `<a href="/loja">Loja</a>` : 'Loja'}</span>${cat ? `<span>${esc(cat.nome)}</span>` : ''}</nav>
    <div class="cab-loja">
      <div><h1>${cat ? esc(cat.nome) : busca ? 'Resultados' : 'Todos os produtos'}</h1>
        <span class="contagem">${produtos.length} produto${produtos.length === 1 ? '' : 's'}${busca ? ` para “${esc(busca)}”` : ''}</span></div>
      <form class="busca" id="formBusca" role="search">
        <input type="search" name="busca" value="${esc(busca)}" placeholder="Buscar produto..." aria-label="Buscar produto">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      </form>
    </div>
    <div class="filtros">
      <a class="chip ${!categoria ? 'on' : ''}" href="/loja">Todos</a>
      ${categorias.map(c => `<a class="chip ${c.slug === categoria ? 'on' : ''}" href="/loja?categoria=${esc(c.slug)}">${esc(c.nome)}</a>`).join('')}
    </div>
    <div class="grade">${produtos.map(card).join('') || '<p class="vazio">Nenhum produto encontrado 💔</p>'}</div>
  </div>`;
  $('#formBusca').onsubmit = (e) => {
    e.preventDefault();
    const termo = new FormData(e.target).get('busca').trim();
    const p = new URLSearchParams();
    if (categoria) p.set('categoria', categoria);
    if (termo) p.set('busca', termo);
    ir(`/loja${p.size ? '?' + p : ''}`);
  };
}

async function telaProduto(slug) {
  const p = await api(`/api/produtos/${encodeURIComponent(slug)}`);
  cacheProdutos.set(p.slug, p);
  document.title = `${p.nome} · Pantoja Intimeé`;
  let escolhida = p.variacoes.find(v => v.estoque > 0) ?? null;
  let qtd = 1;
  const unica = p.variacoes.length === 1 && p.variacoes[0].rotulo === 'Único';
  const ehSabor = p.categoria?.slug === 'sexshop' || p.categoria?.slug === 'cosmeticos';

  app.innerHTML = `
  <div class="container pagina">
    <nav class="trilha"><a href="/">Início</a><span><a href="/loja">Loja</a></span>
      ${p.categoria ? `<span><a href="/loja?categoria=${esc(p.categoria.slug)}">${esc(p.categoria.nome)}</a></span>` : ''}<span>${esc(p.nome)}</span></nav>
    <div class="prod-grid">
      <div class="galeria">
        <div class="galeria-principal" id="fotoPrincipal">${p.tag ? `<span class="etiqueta ${p.tag === '18+' ? 'mais18' : ''}">${esc(p.tag)}</span>` : ''}${midia(p)}</div>
        ${p.imagens.length > 1 ? `<div class="miniaturas">${p.imagens.map((src, i) => `<button class="${i ? '' : 'on'}" data-foto="${i}" aria-label="Foto ${i + 1}"><img src="${esc(src)}" alt=""></button>`).join('')}</div>` : ''}
      </div>
      <div class="prod-info">
        <span class="card-cat">${esc(p.categoria?.nome ?? '')}</span>
        <h1>${esc(p.nome)}</h1>
        <div>
          <div class="preco"><b>${brl(p.preco)}</b>${p.precoDe ? `<s>${brl(p.precoDe)}</s>` : ''}</div>
          <span class="parcela">ou 3x de ${brl(Math.ceil(p.preco / 3))} no cartão</span>
        </div>
        <p class="prod-desc">${esc(p.descricao)}</p>
        ${unica ? '' : `<div><span class="rotulo-campo">${ehSabor ? 'Sabor / opção' : 'Tamanho'}</span>
          <div class="tamanhos">${p.variacoes.map(v => `<button class="tam ${v.rotulo.length > 3 ? 'largo' : ''} ${v === escolhida ? 'on' : ''}" data-var="${v.id}" ${v.estoque > 0 ? '' : 'disabled title="Esgotado"'}>${esc(v.rotulo)}</button>`).join('')}</div></div>`}
        <div class="estoque-aviso" id="avisoEstoque"></div>
        <div class="compra-linha">
          <div class="qtd-grande"><button id="menos" aria-label="Diminuir">−</button><span id="qtd">1</span><button id="mais" aria-label="Aumentar">+</button></div>
          <button class="btn btn-vinho" id="comprar">${ICONE_SACOLA.replace('<svg', '<svg width="18"')}Adicionar à sacola</button>
        </div>
        <a class="btn btn-borda" target="_blank" rel="noopener" href="${linkZap(`Olá! Tenho interesse no produto: ${p.nome}`)}">Tirar dúvida no WhatsApp</a>
        <div class="selos-prod"><div>📦 Envio para todo o Brasil</div><div>🔒 Embalagem discreta</div><div>💝 Feito com amor</div></div>
      </div>
    </div>
    <div id="relacionados"></div>
  </div>`;

  const atualizar = () => {
    $('#qtd').textContent = qtd;
    const aviso = $('#avisoEstoque');
    const botao = $('#comprar');
    if (!escolhida) { aviso.textContent = 'Produto esgotado no momento.'; botao.disabled = true; return; }
    botao.disabled = false;
    aviso.textContent = escolhida.estoque <= 3 ? `Últimas ${escolhida.estoque} unidade(s)!` : '';
  };
  atualizar();

  app.querySelectorAll('[data-var]').forEach(b => b.onclick = () => {
    app.querySelectorAll('[data-var]').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    escolhida = p.variacoes.find(v => v.id === Number(b.dataset.var));
    qtd = Math.min(qtd, escolhida.estoque);
    atualizar();
  });
  app.querySelectorAll('[data-foto]').forEach(b => b.onclick = () => {
    app.querySelectorAll('[data-foto]').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    $('#fotoPrincipal img').src = p.imagens[Number(b.dataset.foto)];
  });
  $('#menos').onclick = () => { qtd = Math.max(1, qtd - 1); atualizar(); };
  $('#mais').onclick = () => { qtd = Math.min(escolhida?.estoque ?? 1, qtd + 1, 20); atualizar(); };
  $('#comprar').onclick = () => { if (escolhida) adicionar(p, escolhida, qtd); };

  // Produtos relacionados (mesma categoria)
  if (p.categoria) {
    api(`/api/produtos?categoria=${encodeURIComponent(p.categoria.slug)}`).then(lista => {
      const outros = lembrar(lista).filter(x => x.id !== p.id).slice(0, 4);
      if (!outros.length || !$('#relacionados')) return;
      $('#relacionados').innerHTML = `<div class="titulo-sec" style="margin:5rem 0 2.5rem"><span class="script">Combina com você</span><h2>Você também vai amar</h2></div>
        <div class="grade">${outros.map(card).join('')}</div>`;
    }).catch(() => {});
  }
}

async function telaFinalizar() {
  document.title = 'Finalizar compra · Pantoja Intimeé';
  if (!sacola.length) {
    app.innerHTML = `<div class="container pagina"><div class="status-card"><div class="status-ic">${ICONES.coracao}</div><h1>Sua sacola está vazia</h1><p style="margin:1rem 0 2rem;color:var(--texto-suave)">Que tal escolher algo especial?</p><a class="btn btn-vinho" href="/loja">Ver produtos</a></div></div>`;
    return;
  }
  let resumo, erroResumo = '';
  try {
    resumo = await api('/api/carrinho/validar', { metodo: 'POST', corpo: { itens: itensParaApi() } });
    sincronizarPrecos(resumo.linhas);
  } catch (e) { erroResumo = e.message; }
  const cliente = ler('pi_cliente', {});
  const cancelado = new URLSearchParams(location.search).has('cancelado');

  app.innerHTML = `
  <div class="container pagina">
    <nav class="trilha"><a href="/">Início</a><span><a href="/loja">Loja</a></span><span>Finalizar compra</span></nav>
    <div class="fin-grid">
      <form class="caixa" id="formPedido" novalidate>
        <h2>Seus dados</h2>
        <div class="campos">
          <div class="campo inteiro"><label for="c-nome">Nome completo *</label><input id="c-nome" name="nome" autocomplete="name" required value="${esc(cliente.nome)}"></div>
          <div class="campo"><label for="c-tel">WhatsApp</label><input id="c-tel" name="telefone" type="tel" autocomplete="tel" placeholder="(63) 9 9999-9999" value="${esc(cliente.telefone)}"></div>
          <div class="campo"><label for="c-cid">Cidade / UF</label><input id="c-cid" name="cidade" autocomplete="address-level2" placeholder="Aliança - TO" value="${esc(cliente.cidade)}"></div>
          <div class="campo inteiro"><label for="c-end">Endereço de entrega</label><input id="c-end" name="endereco" autocomplete="street-address" placeholder="Rua, número, bairro, CEP" value="${esc(cliente.endereco)}"></div>
          <div class="campo inteiro"><label for="c-obs">Observação</label><textarea id="c-obs" name="observacao" placeholder="Ex.: nome para a calcinha personalizada, mensagem do cartão…"></textarea></div>
        </div>
        ${cancelado ? '<div class="erro-msg">O pagamento foi cancelado. Você pode tentar de novo ou pedir pelo WhatsApp.</div>' : ''}
        <div class="erro-msg" id="erroPedido" ${erroResumo ? '' : 'hidden'}>${esc(erroResumo)}</div>
        <div class="pagamentos">
          ${config.cartaoAtivo ? `<button class="btn btn-vinho" data-canal="cartao" type="submit">
            <svg width="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>Pagar com cartão</button>` : ''}
          <button class="btn btn-zap" data-canal="whatsapp" type="submit">
            <svg width="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2z"/></svg>Enviar pedido pelo WhatsApp</button>
          <p class="nota">${config.cartaoAtivo ? 'Cartão: pagamento seguro processado pelo Stripe. ' : ''}WhatsApp: combinamos o pagamento (Pix ou cartão) direto com você, sem taxas.</p>
        </div>
      </form>
      <aside class="caixa resumo">
        <h2>Resumo</h2>
        ${sacola.map(i => `<div class="item"><div class="item-img">${miniatura(i)}</div>
          <div><h4>${esc(i.nome)}</h4><small>${esc(rotuloVar(i.rotulo))}${rotuloVar(i.rotulo) ? ' · ' : ''}${i.qtd} un.</small></div>
          <div class="item-preco">${brl(i.preco * i.qtd)}</div></div>`).join('')}
        <div style="margin-top:1rem">
          ${resumo ? `<div class="linha-total"><span>Subtotal</span><span>${brl(resumo.subtotal)}</span></div>
          <div class="linha-total"><span>Frete</span><span>${resumo.frete ? brl(resumo.frete) : 'Grátis 🎉'}</span></div>
          <div class="linha-total grande"><span>Total</span><b>${brl(resumo.total)}</b></div>` : ''}
        </div>
        <a href="/loja" class="nota" style="display:block;margin-top:1rem;text-decoration:underline">Continuar comprando</a>
      </aside>
    </div>
  </div>`;

  let canal = 'whatsapp';
  app.querySelectorAll('[data-canal]').forEach(b => b.onclick = () => { canal = b.dataset.canal; });
  $('#formPedido').onsubmit = async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(e.target));
    const erro = $('#erroPedido');
    erro.hidden = true;
    if (dados.nome.trim().length < 2) { erro.textContent = 'Informe seu nome.'; erro.hidden = false; $('#c-nome').focus(); return; }
    guardar('pi_cliente', { nome: dados.nome, telefone: dados.telefone, cidade: dados.cidade, endereco: dados.endereco });
    const botoes = app.querySelectorAll('[data-canal]');
    botoes.forEach(b => b.disabled = true);
    // abre a aba já no clique (evita bloqueio de pop-up) e depois aponta para o WhatsApp
    const aba = canal === 'whatsapp' ? window.open('', '_blank') : null;
    try {
      const r = await api(`/api/pedidos/${canal}`, { metodo: 'POST', corpo: { itens: itensParaApi(), cliente: dados } });
      sacola = []; salvarSacola();
      if (canal === 'whatsapp') {
        if (aba) aba.location = r.url; else location.href = r.url;
        ir(`/pedido/${r.codigo}`);
      } else {
        location.href = r.url;
      }
    } catch (err) {
      aba?.close();
      erro.textContent = err.message; erro.hidden = false;
      botoes.forEach(b => b.disabled = false);
    }
  };
}

async function telaPedido(codigo) {
  const sessionId = new URLSearchParams(location.search).get('session_id');
  const p = await api(`/api/pedidos/${encodeURIComponent(codigo)}${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ''}`);
  if (sessionId && p.status === 'pago') { sacola = []; salvarSacola(); }
  document.title = `Pedido #${p.codigo} · Pantoja Intimeé`;
  const pago = ['pago', 'enviado', 'entregue'].includes(p.status);
  const titulo = p.status === 'cancelado' ? 'Pedido cancelado'
    : pago ? 'Pedido confirmado!'
    : p.canal === 'whatsapp' ? 'Pedido enviado!' : 'Aguardando pagamento';
  const texto = p.status === 'cancelado' ? 'Este pedido foi cancelado. Se precisar, fale com a gente no WhatsApp.'
    : pago ? 'Obrigada pela compra! Já estamos preparando tudo com muito carinho. 💝'
    : p.canal === 'whatsapp' ? 'Finalize a conversa no WhatsApp para combinarmos pagamento e entrega. Se a janela não abriu, use o botão abaixo.'
    : 'Assim que o pagamento for confirmado, esta página é atualizada.';
  app.innerHTML = `
  <div class="container pagina"><div class="status-card">
    <div class="status-ic">${pago ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5L20 7"/></svg>' : ICONES.coracao}</div>
    <h1>${titulo}</h1>
    <span class="status-pill">Pedido #${esc(p.codigo)} · ${esc(p.statusTexto)}</span>
    <p style="color:var(--texto-suave)">${texto}</p>
    <div class="caixa">
      ${p.itens.map(i => `<div class="linha-total"><span>${i.qtd}x ${esc(i.nome)}${rotuloVar(i.rotulo) ? ` (${esc(i.rotulo)})` : ''}</span><span>${brl(i.preco * i.qtd)}</span></div>`).join('')}
      <div class="linha-total" style="margin-top:.5rem"><span>Frete</span><span>${p.frete ? brl(p.frete) : 'Grátis'}</span></div>
      <div class="linha-total grande"><span>Total</span><b>${brl(p.total)}</b></div>
    </div>
    <div class="cta-row" style="justify-content:center">
      <a class="btn btn-zap" target="_blank" rel="noopener" href="${linkZap(`Olá! Sobre o meu pedido #${p.codigo} 💋`)}">Falar no WhatsApp</a>
      <a class="btn btn-borda" href="/loja">Continuar comprando</a>
    </div>
  </div></div>`;
  if (p.status === 'aguardando_pagamento') setTimeout(() => { if (location.pathname.endsWith(p.codigo)) rotear(); }, 5000);
}

function telaNaoEncontrada() {
  app.innerHTML = `<div class="container pagina"><div class="status-card"><div class="status-ic">${ICONES.coracao}</div><h1>Página não encontrada</h1><p style="margin:1rem 0 2rem;color:var(--texto-suave)">O link pode ter mudado.</p><a class="btn btn-vinho" href="/loja">Ir para a loja</a></div></div>`;
}

/* =========================================================
   SACOLA
   ========================================================= */
function miniatura(i) {
  return i.imagem ? `<img src="${esc(i.imagem)}" alt="">` : ilustracao(i.icone, i.cores);
}
function salvarSacola() { guardar('pi_sacola_v2', sacola); renderSacola(); }
const itensParaApi = () => sacola.map(i => ({ variacaoId: i.variacaoId, qtd: i.qtd }));

function sincronizarPrecos(linhas) {
  for (const l of linhas) {
    const i = sacola.find(x => x.variacaoId === l.variacaoId);
    if (i) { i.preco = l.preco; i.nome = l.nome; i.rotulo = l.rotulo; }
  }
  salvarSacola();
}

function adicionar(p, v, qtd = 1) {
  const ex = sacola.find(i => i.variacaoId === v.id);
  const total = (ex?.qtd ?? 0) + qtd;
  if (total > v.estoque) { toast(`Só temos ${v.estoque} unidade(s) disponível(is).`); return; }
  if (ex) ex.qtd = total;
  else sacola.push({ variacaoId: v.id, qtd, slug: p.slug, nome: p.nome, rotulo: v.rotulo, preco: p.preco, estoque: v.estoque, imagem: p.imagens[0] ?? '', icone: p.categoria?.icone, cores: p.cores });
  salvarSacola();
  toast(`♥ ${p.nome} na sacola`);
  abrirSacola();
}

function renderSacola() {
  const qtd = sacola.reduce((s, i) => s + i.qtd, 0);
  const badge = $('#badge');
  badge.textContent = qtd;
  badge.classList.toggle('on', qtd > 0);
  if (!sacola.length) {
    $('#itens').innerHTML = `<div class="gav-vazia">${ICONES.coracao}<p>Sua sacola está vazia.<br>Que tal escolher algo especial?</p></div>`;
    $('#rodapeSacola').innerHTML = '<a href="/loja" class="btn btn-vinho" style="width:100%">Ver produtos</a>';
    return;
  }
  $('#itens').innerHTML = sacola.map((i, idx) => `<div class="item">
    <a class="item-img" href="/produto/${esc(i.slug)}">${miniatura(i)}</a>
    <div><h4>${esc(i.nome)}</h4>${rotuloVar(i.rotulo) ? `<small>${esc(i.rotulo)}</small><br>` : ''}
      <div class="qtd"><button data-menos="${idx}" aria-label="Diminuir">−</button><span>${i.qtd}</span><button data-mais="${idx}" aria-label="Aumentar">+</button></div></div>
    <div class="item-preco">${brl(i.preco * i.qtd)}<button class="remover" data-rem="${idx}">remover</button></div>
  </div>`).join('');
  const subtotal = sacola.reduce((s, i) => s + i.preco * i.qtd, 0);
  const falta = config.freteGratisAPartir - subtotal;
  $('#rodapeSacola').innerHTML = `
    ${config.freteGratisAPartir ? `<div class="frete-barra">${falta > 0 ? `Faltam <b>${brl(falta)}</b> para ganhar <b>frete grátis</b> 💝` : 'Parabéns! Você ganhou <b>frete grátis</b> 🎉'}
      <div class="barra"><i style="width:${Math.min(100, subtotal / config.freteGratisAPartir * 100)}%"></i></div></div>` : ''}
    <div class="total"><span>Subtotal</span><b>${brl(subtotal)}</b></div>
    <a class="btn btn-vinho" style="width:100%" href="/finalizar">Finalizar compra</a>`;
}

function abrirSacola() { $('#gaveta').classList.add('on'); $('#veu').classList.add('on'); }
function fecharTudo() { ['#gaveta', '#veu', '#menu'].forEach(s => $(s).classList.remove('on')); }

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-mais],[data-menos],[data-rem],[data-add-rapido]');
  if (!el) return;
  const d = el.dataset;
  if (d.addRapido) {
    const p = cacheProdutos.get(d.slug);
    const v = p?.variacoes.find(x => x.id === Number(d.addRapido));
    if (p && v) adicionar(p, v);
    return;
  }
  if (d.mais) {
    const i = sacola[Number(d.mais)];
    if (i.estoque && i.qtd >= i.estoque) { toast('Quantidade máxima em estoque.'); return; }
    i.qtd = Math.min(20, i.qtd + 1);
  } else if (d.menos) {
    const i = Number(d.menos);
    if (--sacola[i].qtd < 1) sacola.splice(i, 1);
  } else if (d.rem) {
    sacola.splice(Number(d.rem), 1);
  }
  salvarSacola();
});

$('#abrirSacola').onclick = abrirSacola;
$('#fecharSacola').onclick = fecharTudo;
$('#veu').onclick = fecharTudo;
$('#abrirMenu').onclick = () => { $('#menu').classList.add('on'); $('#veu').classList.add('on'); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharTudo(); });

let tt;
function toast(txt) {
  const t = $('#toast');
  t.textContent = txt; t.classList.add('on');
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2200);
}

const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('vis'); io.unobserve(en.target); } }), { threshold: 0.12 });
function revelar() { document.querySelectorAll('.rev:not(.vis)').forEach(el => io.observe(el)); }

/* =========================================================
   INÍCIO
   ========================================================= */
(async function iniciar() {
  let maior = false;
  try { maior = localStorage.getItem('pi_18') === '1'; } catch {}
  if (!maior) $('#idade').classList.remove('oculto');
  $('#idade-sim').onclick = () => { try { localStorage.setItem('pi_18', '1'); } catch {} $('#idade').classList.add('oculto'); };

  [config, categorias] = await Promise.all([api('/api/config'), api('/api/categorias')]).catch(() => [config, []]);
  document.querySelectorAll('.link-zap').forEach(a => a.href = linkZap('Olá, Pantoja Intimeé! Vim pelo site 💋'));
  document.querySelectorAll('.link-insta').forEach(a => a.href = config.instagram || a.href);
  const frases = ['♥ Envios para todo o Brasil', '👑 O íntimo que valoriza você', '✨ Embalagem 100% discreta',
    config.freteGratisAPartir ? `💝 Frete grátis acima de ${brl(config.freteGratisAPartir)}` : '💝 Feito com amor', '🔥 Lingeries & Sex Shop'];
  $('#faixa').innerHTML = [...frases, ...frases, ...frases, ...frases].map(f => `<span>${f}</span>`).join('');
  $('#rodCats').innerHTML = categorias.map(c => `<li><a href="/loja?categoria=${esc(c.slug)}">${esc(c.nome)}</a></li>`).join('');
  $('#ano').textContent = new Date().getFullYear();
  renderSacola();
  rotear();
})();
