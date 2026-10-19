import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transacao, slugify } from './db.js';
import { criarSessao, conferirSenha, hashSenha, limitadorLogin } from './auth.js';
import {
  ErroLoja, STATUS, listarCategorias, listarProdutos, buscarProduto, validarCarrinho, calcularFrete,
  criarPedido, buscarPedido, listarPedidos, mudarStatus, mensagemWhatsApp,
} from './loja.js';

const PUBLICO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const TIPOS_IMAGEM = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif' };

/**
 * cfg: { whatsapp, instagram, baseUrl, freteFixoCents, freteGratisCents, pastaUploads,
 *        sessaoSegredo, cookieSeguro, stripeWebhookSecret, trustProxy }
 * stripe: instância do SDK do Stripe ou null (pagamento com cartão desativado)
 */
export function criarApp({ db, cfg, stripe = null }) {
  const app = express();
  app.disable('x-powered-by');
  if (cfg.trustProxy) app.set('trust proxy', 1);
  const sessao = criarSessao({ segredo: cfg.sessaoSegredo, seguro: cfg.cookieSeguro });
  const limitador = limitadorLogin();
  fs.mkdirSync(cfg.pastaUploads, { recursive: true });

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
    });
    next();
  });

  /* ---------- Webhook do Stripe (precisa do corpo bruto, antes do express.json) ---------- */
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    if (!stripe || !cfg.stripeWebhookSecret) return res.status(404).end();
    let evento;
    try {
      evento = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], cfg.stripeWebhookSecret);
    } catch (e) {
      return res.status(400).send(`Assinatura inválida: ${e.message}`);
    }
    const s = evento.data.object;
    if (evento.type === 'checkout.session.completed' || evento.type === 'checkout.session.async_payment_succeeded') {
      confirmarSessao(s);
    } else if (evento.type === 'checkout.session.expired' || evento.type === 'checkout.session.async_payment_failed') {
      const p = buscarPedido(db, { codigo: s.metadata?.pedido ?? '' });
      if (p && p.status === 'aguardando_pagamento') mudarStatus(db, p.id, 'cancelado');
    }
    res.json({ recebido: true });
  });

  function confirmarSessao(s) {
    if (s.payment_status !== 'paid') return;
    const p = buscarPedido(db, { codigo: s.metadata?.pedido ?? '' });
    if (!p || p.status !== 'aguardando_pagamento' || p.stripeSessionId !== s.id) return;
    const end = s.shipping_details?.address ?? s.collected_information?.shipping_details?.address ?? s.customer_details?.address;
    const endereco = end ? [end.line1, end.line2, end.postal_code, end.city, end.state].filter(Boolean).join(', ') : null;
    mudarStatus(db, p.id, 'pago', {
      nome: s.customer_details?.name || null,
      telefone: s.customer_details?.phone || null,
      endereco,
    });
  }

  app.use(express.json({ limit: '200kb' }));

  /* ---------- API pública ---------- */
  app.get('/api/config', (req, res) => {
    res.json({
      whatsapp: cfg.whatsapp, instagram: cfg.instagram, cartaoAtivo: !!stripe,
      freteFixo: cfg.freteFixoCents, freteGratisAPartir: cfg.freteGratisCents,
    });
  });

  app.get('/api/categorias', (req, res) => res.json(listarCategorias(db)));

  app.get('/api/produtos', (req, res) => {
    res.json(listarProdutos(db, {
      categoria: req.query.categoria || undefined,
      busca: req.query.busca ? String(req.query.busca).slice(0, 80) : undefined,
      destaque: req.query.destaque === '1',
    }));
  });

  app.get('/api/produtos/:slug', (req, res) => {
    const p = buscarProduto(db, { slug: req.params.slug });
    if (!p) return res.status(404).json({ erro: 'Produto não encontrado.' });
    res.json(p);
  });

  app.post('/api/carrinho/validar', (req, res) => {
    const { linhas, subtotal } = validarCarrinho(db, req.body?.itens);
    const frete = calcularFrete(subtotal, cfg);
    res.json({ linhas, subtotal, frete, total: subtotal + frete });
  });

  const exigirCliente = (c) => {
    if (!c || String(c.nome ?? '').trim().length < 2) throw new ErroLoja('Informe seu nome.');
  };

  app.post('/api/pedidos/whatsapp', (req, res) => {
    exigirCliente(req.body?.cliente);
    const pedido = criarPedido(db, { canal: 'whatsapp', itens: req.body.itens, cliente: req.body.cliente }, cfg);
    const url = `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(mensagemWhatsApp(pedido))}`;
    res.status(201).json({ codigo: pedido.codigo, url });
  });

  app.post('/api/pedidos/cartao', async (req, res) => {
    if (!stripe) throw new ErroLoja('Pagamento com cartão indisponível no momento.', 503);
    exigirCliente(req.body?.cliente);
    const pedido = criarPedido(db, { canal: 'cartao', itens: req.body.itens, cliente: req.body.cliente }, cfg);
    const base = cfg.baseUrl || `${req.protocol}://${req.get('host')}`;
    try {
      const s = await stripe.checkout.sessions.create({
        mode: 'payment',
        locale: 'pt-BR',
        line_items: pedido.itens.map(i => ({
          quantity: i.qtd,
          price_data: {
            currency: 'brl',
            unit_amount: i.preco,
            product_data: { name: i.rotulo === 'Único' ? i.nome : `${i.nome} (${i.rotulo})` },
          },
        })),
        shipping_address_collection: { allowed_countries: ['BR'] },
        shipping_options: [{
          shipping_rate_data: {
            type: 'fixed_amount',
            display_name: pedido.frete ? 'Envio para todo o Brasil' : 'Frete grátis',
            fixed_amount: { amount: pedido.frete, currency: 'brl' },
          },
        }],
        phone_number_collection: { enabled: true },
        client_reference_id: pedido.codigo,
        metadata: { pedido: pedido.codigo },
        success_url: `${base}/pedido/${pedido.codigo}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/finalizar?cancelado=1`,
      });
      db.prepare('UPDATE pedidos SET stripe_session_id = ? WHERE id = ?').run(s.id, pedido.id);
      res.status(201).json({ codigo: pedido.codigo, url: s.url });
    } catch (e) {
      mudarStatus(db, pedido.id, 'cancelado');
      console.error('Stripe:', e.message);
      throw new ErroLoja('Não foi possível iniciar o pagamento. Tente novamente ou peça pelo WhatsApp.', 502);
    }
  });

  // Página de acompanhamento: o código é aleatório, então só quem fez o pedido o conhece
  app.get('/api/pedidos/:codigo', async (req, res) => {
    let p = buscarPedido(db, { codigo: String(req.params.codigo).toUpperCase() });
    if (!p) return res.status(404).json({ erro: 'Pedido não encontrado.' });
    // Se o webhook ainda não chegou, confere direto no Stripe ao voltar do pagamento
    if (stripe && p.status === 'aguardando_pagamento' && req.query.session_id && req.query.session_id === p.stripeSessionId) {
      try {
        confirmarSessao(await stripe.checkout.sessions.retrieve(p.stripeSessionId));
        p = buscarPedido(db, { id: p.id });
      } catch (e) { console.error('Stripe:', e.message); }
    }
    res.json({
      codigo: p.codigo, canal: p.canal, status: p.status, statusTexto: p.statusTexto,
      itens: p.itens.map(({ nome, rotulo, preco, qtd }) => ({ nome, rotulo, preco, qtd })),
      subtotal: p.subtotal, frete: p.frete, total: p.total, criadoEm: p.criadoEm,
    });
  });

  /* ---------- Painel administrativo ---------- */
  app.post('/api/admin/login', (req, res) => {
    const ip = req.ip;
    if (limitador.bloqueado(ip)) return res.status(429).json({ erro: 'Muitas tentativas. Aguarde alguns minutos.' });
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);
    if (!admin || !conferirSenha(req.body?.senha ?? '', admin.senha_hash)) {
      limitador.falhou(ip);
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }
    limitador.limpar(ip);
    sessao.emitir(res, admin.id);
    res.json({ email: admin.email });
  });

  app.post('/api/admin/logout', (req, res) => { sessao.encerrar(res); res.json({ ok: true }); });

  const admin = express.Router();
  admin.use(sessao.exigirAdmin);

  admin.get('/eu', (req, res) => {
    const a = db.prepare('SELECT email FROM admins WHERE id = ?').get(req.adminId);
    if (!a) return res.status(401).json({ erro: 'Sessão inválida.' });
    res.json({ ...a, status: STATUS });
  });

  admin.put('/senha', (req, res) => {
    const a = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.adminId);
    if (!conferirSenha(req.body?.atual ?? '', a.senha_hash)) throw new ErroLoja('Senha atual incorreta.');
    if (String(req.body?.nova ?? '').length < 8) throw new ErroLoja('A nova senha precisa ter ao menos 8 caracteres.');
    db.prepare('UPDATE admins SET senha_hash = ? WHERE id = ?').run(hashSenha(req.body.nova), a.id);
    res.json({ ok: true });
  });

  admin.get('/resumo', (req, res) => {
    const q = (sql) => db.prepare(sql).get();
    res.json({
      pedidosNovos: q("SELECT COUNT(*) n FROM pedidos WHERE status IN ('novo','pago')").n,
      faturamentoMes: q(`SELECT COALESCE(SUM(total_cents),0) n FROM pedidos WHERE status IN ('pago','enviado','entregue')
                         AND criado_em >= date('now','start of month')`).n,
      produtosAtivos: q('SELECT COUNT(*) n FROM produtos WHERE ativo = 1').n,
      estoqueBaixo: db.prepare(`SELECT p.nome, v.rotulo, v.estoque FROM variacoes v JOIN produtos p ON p.id = v.produto_id
                                WHERE v.estoque <= 2 AND p.ativo = 1 ORDER BY v.estoque, p.nome LIMIT 20`).all(),
    });
  });

  // Produtos
  admin.get('/produtos', (req, res) => res.json(listarProdutos(db, { incluirInativos: true, busca: req.query.busca || undefined })));
  admin.get('/produtos/:id', (req, res) => {
    const p = buscarProduto(db, { id: Number(req.params.id) }, { incluirInativos: true });
    if (!p) return res.status(404).json({ erro: 'Produto não encontrado.' });
    res.json(p);
  });
  admin.post('/produtos', (req, res) => res.status(201).json(salvarProduto(null, req.body)));
  admin.put('/produtos/:id', (req, res) => res.json(salvarProduto(Number(req.params.id), req.body)));
  admin.delete('/produtos/:id', (req, res) => {
    db.prepare('DELETE FROM produtos WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  function salvarProduto(id, b = {}) {
    const nome = String(b.nome ?? '').trim().slice(0, 120);
    if (nome.length < 2) throw new ErroLoja('Informe o nome do produto.');
    const preco = Number(b.preco);
    if (!Number.isInteger(preco) || preco < 0) throw new ErroLoja('Preço inválido.');
    const precoDe = b.precoDe == null || b.precoDe === '' ? null : Number(b.precoDe);
    if (precoDe != null && (!Number.isInteger(precoDe) || precoDe < 0)) throw new ErroLoja('Preço "de" inválido.');
    const variacoes = (Array.isArray(b.variacoes) ? b.variacoes : [])
      .map(v => ({ id: v.id ? Number(v.id) : null, rotulo: String(v.rotulo ?? '').trim().slice(0, 40), estoque: Math.trunc(Number(v.estoque) || 0) }))
      .filter(v => v.rotulo);
    if (!variacoes.length) throw new ErroLoja('Cadastre ao menos um tamanho/variação (use "Único" se não houver).');
    const imagens = (Array.isArray(b.imagens) ? b.imagens : []).map(String)
      .filter(u => u.startsWith('/uploads/') || /^https:\/\//.test(u)).slice(0, 12);
    const cor = (c, padrao) => /^#[0-9a-f]{6}$/i.test(c ?? '') ? c : padrao;
    const categoriaId = b.categoriaId ? Number(b.categoriaId) : null;

    return transacao(db, () => {
      const campos = [nome, String(b.descricao ?? '').slice(0, 3000), preco, precoDe, categoriaId,
        String(b.tag ?? '').trim().slice(0, 24), b.destaque ? 1 : 0, b.ativo === false ? 0 : 1,
        JSON.stringify(imagens), cor(b.cores?.[0], '#a3122a'), cor(b.cores?.[1], '#5b0a12')];
      if (id == null) {
        id = Number(db.prepare(`INSERT INTO produtos (nome, descricao, preco_cents, preco_de_cents, categoria_id, tag, destaque, ativo, imagens, cor1, cor2, slug)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...campos, slugUnico(nome)).lastInsertRowid);
      } else {
        const r = db.prepare(`UPDATE produtos SET nome=?, descricao=?, preco_cents=?, preco_de_cents=?, categoria_id=?, tag=?,
          destaque=?, ativo=?, imagens=?, cor1=?, cor2=? WHERE id = ?`).run(...campos, id);
        if (!r.changes) throw new ErroLoja('Produto não encontrado.', 404);
      }
      const atuais = new Set(db.prepare('SELECT id FROM variacoes WHERE produto_id = ?').all(id).map(v => v.id));
      const manter = new Set();
      variacoes.forEach((v, ordem) => {
        if (v.id && atuais.has(v.id)) {
          db.prepare('UPDATE variacoes SET rotulo=?, estoque=?, ordem=? WHERE id=?').run(v.rotulo, v.estoque, ordem, v.id);
          manter.add(v.id);
        } else {
          db.prepare('INSERT INTO variacoes (produto_id, rotulo, estoque, ordem) VALUES (?, ?, ?, ?)').run(id, v.rotulo, v.estoque, ordem);
        }
      });
      for (const vid of atuais) if (!manter.has(vid)) db.prepare('DELETE FROM variacoes WHERE id = ?').run(vid);
      return buscarProduto(db, { id }, { incluirInativos: true });
    });
  }

  function slugUnico(nome) {
    const base = slugify(nome);
    let slug = base, n = 2;
    while (db.prepare('SELECT 1 FROM produtos WHERE slug = ?').get(slug)) slug = `${base}-${n++}`;
    return slug;
  }

  // Upload de fotos
  const upload = multer({
    storage: multer.diskStorage({
      destination: cfg.pastaUploads,
      filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${TIPOS_IMAGEM[file.mimetype]}`),
    }),
    limits: { fileSize: 6 * 1024 * 1024, files: 10 },
    fileFilter: (req, file, cb) => cb(TIPOS_IMAGEM[file.mimetype] ? null : new ErroLoja('Envie fotos em JPG, PNG, WEBP ou AVIF.'), !!TIPOS_IMAGEM[file.mimetype]),
  });
  admin.post('/upload', upload.array('fotos', 10), (req, res) => {
    res.status(201).json({ urls: (req.files ?? []).map(f => `/uploads/${f.filename}`) });
  });

  // Categorias
  admin.get('/categorias', (req, res) => res.json(listarCategorias(db)));
  admin.post('/categorias', (req, res) => {
    const nome = String(req.body?.nome ?? '').trim().slice(0, 40);
    if (nome.length < 2) throw new ErroLoja('Informe o nome da categoria.');
    const slug = slugify(nome);
    if (db.prepare('SELECT 1 FROM categorias WHERE slug = ?').get(slug)) throw new ErroLoja('Já existe uma categoria com esse nome.');
    const { m } = db.prepare('SELECT COALESCE(MAX(ordem),0)+1 m FROM categorias').get();
    db.prepare('INSERT INTO categorias (slug, nome, icone, ordem) VALUES (?, ?, ?, ?)').run(slug, nome, String(req.body?.icone || 'coracao'), m);
    res.status(201).json(listarCategorias(db));
  });
  admin.put('/categorias/:id', (req, res) => {
    const nome = String(req.body?.nome ?? '').trim().slice(0, 40);
    if (nome.length < 2) throw new ErroLoja('Informe o nome da categoria.');
    db.prepare('UPDATE categorias SET nome = ?, icone = ?, ordem = ? WHERE id = ?')
      .run(nome, String(req.body?.icone || 'coracao'), Math.trunc(Number(req.body?.ordem) || 0), Number(req.params.id));
    res.json(listarCategorias(db));
  });
  admin.delete('/categorias/:id', (req, res) => {
    db.prepare('DELETE FROM categorias WHERE id = ?').run(Number(req.params.id));
    res.json(listarCategorias(db));
  });

  // Pedidos
  admin.get('/pedidos', (req, res) => res.json(listarPedidos(db, { status: req.query.status || undefined })));
  admin.put('/pedidos/:id/status', (req, res) => res.json(mudarStatus(db, Number(req.params.id), req.body?.status)));

  app.use('/api/admin', admin);
  app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

  /* ---------- Arquivos e páginas ---------- */
  app.use('/uploads', express.static(cfg.pastaUploads, { maxAge: '30d', immutable: true }));
  app.use(express.static(PUBLICO, { index: false, maxAge: '1h' }));
  app.get(['/admin', '/admin/'], (req, res) => res.sendFile(path.join(PUBLICO, 'admin.html')));
  // As demais rotas são da loja (navegação no navegador)
  app.get(/^\/(?!api|uploads).*/, (req, res) => res.sendFile(path.join(PUBLICO, 'index.html')));

  app.use((err, req, res, next) => {
    if (err instanceof ErroLoja) return res.status(err.status).json({ erro: err.message });
    if (err instanceof multer.MulterError) return res.status(400).json({ erro: err.code === 'LIMIT_FILE_SIZE' ? 'Foto acima de 6 MB.' : err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'Requisição inválida.' });
    console.error(err);
    res.status(500).json({ erro: 'Erro interno. Tente novamente.' });
  });

  return app;
}
