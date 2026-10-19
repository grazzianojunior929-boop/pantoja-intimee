import crypto from 'node:crypto';

const COOKIE = 'pi_admin';
const DURACAO_MS = 1000 * 60 * 60 * 12; // 12 horas

export function hashSenha(senha) {
  const sal = crypto.randomBytes(16);
  const hash = crypto.scryptSync(senha, sal, 64);
  return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`;
}

export function conferirSenha(senha, guardado) {
  const [alg, salHex, hashHex] = String(guardado).split('$');
  if (alg !== 'scrypt' || !salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const calculado = crypto.scryptSync(String(senha), Buffer.from(salHex, 'hex'), esperado.length);
  return crypto.timingSafeEqual(esperado, calculado);
}

/* Sessão em cookie assinado (HMAC): "<base64 do payload>.<assinatura>" */
export function criarSessao({ segredo, seguro }) {
  const assinar = (dados) => crypto.createHmac('sha256', segredo).update(dados).digest('base64url');

  function emitir(res, adminId) {
    const dados = Buffer.from(JSON.stringify({ id: adminId, exp: Date.now() + DURACAO_MS })).toString('base64url');
    res.cookie(COOKIE, `${dados}.${assinar(dados)}`, {
      httpOnly: true, sameSite: 'strict', secure: seguro, maxAge: DURACAO_MS, path: '/',
    });
  }

  function ler(req) {
    const bruto = lerCookie(req.headers.cookie, COOKIE);
    if (!bruto) return null;
    const [dados, assinatura] = bruto.split('.');
    if (!dados || !assinatura) return null;
    const a = Buffer.from(assinatura), b = Buffer.from(assinar(dados));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
      const sessao = JSON.parse(Buffer.from(dados, 'base64url').toString());
      return sessao.exp > Date.now() ? sessao : null;
    } catch { return null; }
  }

  function encerrar(res) {
    res.clearCookie(COOKIE, { path: '/' });
  }

  function exigirAdmin(req, res, next) {
    const sessao = ler(req);
    if (!sessao) return res.status(401).json({ erro: 'Faça login para continuar.' });
    req.adminId = sessao.id;
    next();
  }

  return { emitir, ler, encerrar, exigirAdmin };
}

function lerCookie(cabecalho, nome) {
  for (const parte of String(cabecalho ?? '').split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) return decodeURIComponent(v.join('='));
  }
  return null;
}

/* Limite simples de tentativas de login por IP */
export function limitadorLogin({ max = 8, janelaMs = 15 * 60 * 1000 } = {}) {
  const tentativas = new Map();
  return {
    bloqueado(ip) {
      const t = tentativas.get(ip);
      if (!t || t.ate < Date.now()) return false;
      return t.n >= max;
    },
    falhou(ip) {
      const t = tentativas.get(ip);
      if (!t || t.ate < Date.now()) tentativas.set(ip, { n: 1, ate: Date.now() + janelaMs });
      else t.n++;
    },
    limpar(ip) { tentativas.delete(ip); },
  };
}
