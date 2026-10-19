import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Stripe from 'stripe';
import { abrirBanco, semear, garantirAdmin } from './src/db.js';
import { criarApp } from './src/app.js';

if (fs.existsSync('.env')) process.loadEnvFile('.env');
const env = process.env;

const pastaDados = path.resolve(env.DATA_DIR || 'data');
const producao = env.NODE_ENV === 'production';

const cfg = {
  whatsapp: (env.WHATSAPP || '5563992783793').replace(/\D/g, ''),
  instagram: env.INSTAGRAM || 'https://www.instagram.com/pantojaintimee01/',
  baseUrl: (env.BASE_URL || '').replace(/\/$/, ''),
  freteFixoCents: Number(env.FRETE_FIXO_CENTS ?? 2000),
  freteGratisCents: Number(env.FRETE_GRATIS_CENTS ?? 19900),
  pastaUploads: path.join(pastaDados, 'uploads'),
  sessaoSegredo: env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  cookieSeguro: producao,
  stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
  trustProxy: producao || env.TRUST_PROXY === '1',
};
if (!env.SESSION_SECRET) console.warn('⚠ SESSION_SECRET não definido: o login do painel cai a cada reinício.');

const db = abrirBanco(path.join(pastaDados, 'loja.db'));
if (semear(db)) console.log('Loja preenchida com produtos de exemplo.');

const senhaInicial = env.ADMIN_SENHA || crypto.randomBytes(9).toString('base64url');
if (garantirAdmin(db, env.ADMIN_EMAIL || 'admin@pantojaintimee.com.br', senhaInicial)) {
  console.log(`Administrador criado: ${env.ADMIN_EMAIL || 'admin@pantojaintimee.com.br'}`);
  if (!env.ADMIN_SENHA) console.log(`Senha gerada (troque no painel): ${senhaInicial}`);
}

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
if (!stripe) console.log('Stripe não configurado: só o pedido pelo WhatsApp fica disponível.');

const porta = Number(env.PORT || 3000);
criarApp({ db, cfg, stripe }).listen(porta, () => console.log(`Pantoja Intimeé rodando em http://localhost:${porta}`));
