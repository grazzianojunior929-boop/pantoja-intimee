/* Utilitários compartilhados entre a loja e o painel */

export const ICONES = {
  coroa: '<svg viewBox="0 0 64 40" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 34 L10 10 L22 24 L32 4 L42 24 L54 10 L58 34 Z"/><circle cx="10" cy="10" r="2.4" fill="currentColor"/><circle cx="32" cy="4" r="2.4" fill="currentColor"/><circle cx="54" cy="10" r="2.4" fill="currentColor"/></svg>',
  sutia: '<svg viewBox="0 0 64 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M14 4v14M50 4v14"/><path d="M4 20c4-4 10-4 14 0 4 6 4 14 14 14s10-8 14-14c4-4 10-4 14 0v10c-6 10-16 14-28 14S10 40 4 30z"/><path d="M32 34v-6"/><circle cx="32" cy="27" r="2" fill="currentColor"/></svg>',
  calcinha: '<svg viewBox="0 0 64 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M4 8h56l-4 8c-10 4-16 12-20 28h-8C24 28 18 20 8 16z"/><path d="M4 8c10 6 46 6 56 0"/><path d="M28 18c2-3 6-3 8 0-2 3-6 3-8 0z" fill="currentColor"/></svg>',
  presente: '<svg viewBox="0 0 64 56" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="6" y="20" width="52" height="12"/><rect x="10" y="32" width="44" height="22"/><path d="M32 20v34"/><path d="M32 20c-4-10-18-14-18-6s14 6 18 6zM32 20c4-10 18-14 18-6s-14 6-18 6z"/></svg>',
  frasco: '<svg viewBox="0 0 48 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="18" y="4" width="12" height="8" rx="1"/><path d="M20 12v6h8v-6"/><rect x="8" y="18" width="32" height="42" rx="8"/><path d="M24 34c-3-5-10-3-10 2 0 5 10 10 10 10s10-5 10-10c0-5-7-7-10-2z" fill="currentColor"/></svg>',
  coracao: '<svg viewBox="0 0 64 56" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M32 52S4 36 4 18A13 13 0 0132 10a13 13 0 0128 8c0 18-28 34-28 34z"/><path d="M20 22a6 6 0 016-6" stroke-linecap="round"/></svg>',
  lua: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M44 46A22 22 0 0122 10a24 24 0 1032 32 22 22 0 01-10 4z"/><path d="M46 14l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="currentColor"/></svg>',
};
export const NOMES_ICONES = { coroa: 'Coroa', sutia: 'Sutiã', calcinha: 'Calcinha', presente: 'Presente', frasco: 'Frasco', coracao: 'Coração', lua: 'Lua' };

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const brl = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/* Ilustração usada enquanto o produto não tem foto */
export function ilustracao(icone, cores = ['#a3122a', '#5b0a12']) {
  return `<div class="ilustra" style="background:radial-gradient(circle at 30% 25%, ${esc(cores[0])}, ${esc(cores[1])});color:rgba(255,255,255,.92)">${ICONES[icone] ?? ICONES.coracao}</div>`;
}

export function midia(p, indice = 0) {
  const img = p.imagens?.[indice];
  return img
    ? `<img src="${esc(img)}" alt="${esc(p.nome)}" loading="lazy">`
    : ilustracao(p.categoria?.icone ?? p.icone, p.cores);
}

export async function api(caminho, { metodo = 'GET', corpo, form } = {}) {
  const opts = { method: metodo, headers: {}, credentials: 'same-origin' };
  if (form) opts.body = form;
  else if (corpo !== undefined) { opts.body = JSON.stringify(corpo); opts.headers['Content-Type'] = 'application/json'; }
  const r = await fetch(caminho, opts);
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(dados.erro || 'Algo deu errado. Tente novamente.');
    e.status = r.status;
    throw e;
  }
  return dados;
}

export function guardar(chave, valor) { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch {} }
export function ler(chave, padrao) { try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; } catch { return padrao; } }
