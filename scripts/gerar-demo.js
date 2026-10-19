/* Gera dist/pantoja-intimee-demo.html: loja + painel num único arquivo, sem servidor.
   Os dados ficam no navegador de quem abre (para avaliar o visual e o funcionamento). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIAS_EXEMPLO, PRODUTOS_EXEMPLO } from '../src/seed.js';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');

// Módulos viram blocos de um único script: sem import/export, cada um no seu escopo
const comoBloco = (codigo) => codigo.replace(/^import .*;$/gm, '').replace(/^export /gm, '');
const semFimDeScript = (txt) => txt.replace(/<\/script/gi, '<\\/script');

const index = ler('public/index.html');
const corpoLoja = index
  .slice(index.indexOf('<body>') + '<body>'.length, index.indexOf('</body>'))
  .replace(/<script[^>]*><\/script>/g, '');
const fontes = index.match(/<link href="https:\/\/fonts\.googleapis\.com[^>]+>/)[0];
const favicon = index.match(/<link rel="icon"[^>]+>/)[0];

const script = [
  'globalThis.__DEMO__ = true;',
  `const SEMENTE_DEMO = ${JSON.stringify({ categorias: CATEGORIAS_EXEMPLO, produtos: PRODUTOS_EXEMPLO })};`,
  comoBloco(ler('public/js/comum.js')),
  ler('scripts/demo/api-navegador.js'),
  `{\n${comoBloco(ler('public/js/loja.js'))}\n}`,
  `{\n${comoBloco(ler('public/js/admin.js'))}\n}`,
].join('\n\n');

const estilos = `<style id="css-loja">${ler('public/css/loja.css')}</style>
<style id="css-admin">${ler('public/css/admin.css')}</style>
<style>
  .demo-faixa{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;font:600 11px/1 Montserrat,system-ui,sans-serif;letter-spacing:.06em;
    background:#f1dcb5;color:#22030a;padding:6px 12px;position:relative;z-index:60}
  .demo-faixa a,.demo-faixa button{font:inherit;color:#f1dcb5;background:#5b0a12;border:0;border-radius:999px;padding:5px 12px;cursor:pointer;text-decoration:none}
  .demo-faixa button{background:transparent;color:#5b0a12;border:1px solid rgba(91,10,18,.4)}
  /* conteúdo visível desde o primeiro quadro (miniaturas e links compartilhados) */
  .rev{opacity:1;transform:none}
  /* respeita as bordas do celular quando aberto dentro de apps */
  header{top:env(safe-area-inset-top,0px)}
  body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:70;background:#5b0a12}
  .zap{right:calc(20px + env(safe-area-inset-right,0px));bottom:calc(20px + env(safe-area-inset-bottom,0px))}
</style>`;

const corpo = `<div class="demo-faixa"><span>DEMONSTRAÇÃO · pedidos e alterações ficam só no seu navegador</span><a href="#/">Loja</a><a href="#/admin">Painel</a><button id="demo-reiniciar" type="button">Reiniciar</button></div>
<div id="demo-loja">
${corpoLoja}
</div>
<div id="demo-admin" hidden>
  <div id="raiz"></div>
  <div class="toast" id="toastAdmin" role="status"></div>
</div>
<script type="module">
${semFimDeScript(script)}
</script>`;

// Arquivo completo, para abrir direto no navegador
const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pantoja Intimeé · Moda Íntima Feminina (demonstração)</title>
<meta name="theme-color" content="#5b0a12">
${favicon}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fontes}
${estilos}
</head>
<body>
${corpo}
</body>
</html>
`;

// Versão para publicar como link (a página recebe o esqueleto html/head/body ao ser publicada)
const fragmento = `<title>Pantoja Intimeé</title>
${fontes}
${estilos}
${corpo}
`;
fs.mkdirSync(path.join(raiz, 'dist', 'link'), { recursive: true });
fs.writeFileSync(path.join(raiz, 'dist', 'link', 'pantoja-intimee.html'), fragmento);

const saida = path.join(raiz, 'dist', 'pantoja-intimee-demo.html');
fs.mkdirSync(path.dirname(saida), { recursive: true });
fs.writeFileSync(saida, html);
console.log(`Demonstração gerada: ${path.relative(process.cwd(), saida)} (${Math.round(html.length / 1024)} KB)`);
