import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { hashSenha } from './auth.js';
import { PRODUTOS_EXEMPLO, CATEGORIAS_EXEMPLO } from './seed.js';

export function abrirBanco(arquivo) {
  if (arquivo !== ':memory:') fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const db = new DatabaseSync(arquivo);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS categorias (
      id     INTEGER PRIMARY KEY,
      slug   TEXT NOT NULL UNIQUE,
      nome   TEXT NOT NULL,
      icone  TEXT NOT NULL DEFAULT 'coracao',
      ordem  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS produtos (
      id             INTEGER PRIMARY KEY,
      slug           TEXT NOT NULL UNIQUE,
      nome           TEXT NOT NULL,
      descricao      TEXT NOT NULL DEFAULT '',
      preco_cents    INTEGER NOT NULL CHECK (preco_cents >= 0),
      preco_de_cents INTEGER,
      categoria_id   INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
      tag            TEXT NOT NULL DEFAULT '',
      destaque       INTEGER NOT NULL DEFAULT 0,
      ativo          INTEGER NOT NULL DEFAULT 1,
      imagens        TEXT NOT NULL DEFAULT '[]',
      cor1           TEXT NOT NULL DEFAULT '#a3122a',
      cor2           TEXT NOT NULL DEFAULT '#5b0a12',
      criado_em      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Cada produto tem ao menos uma variação (tamanho, sabor ou "Único"), com estoque próprio
    CREATE TABLE IF NOT EXISTS variacoes (
      id         INTEGER PRIMARY KEY,
      produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
      rotulo     TEXT NOT NULL,
      estoque    INTEGER NOT NULL DEFAULT 0,
      ordem      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS pedidos (
      id                INTEGER PRIMARY KEY,
      codigo            TEXT NOT NULL UNIQUE,
      canal             TEXT NOT NULL CHECK (canal IN ('whatsapp','cartao')),
      status            TEXT NOT NULL,
      cliente_nome      TEXT NOT NULL DEFAULT '',
      cliente_telefone  TEXT NOT NULL DEFAULT '',
      cliente_cidade    TEXT NOT NULL DEFAULT '',
      endereco          TEXT NOT NULL DEFAULT '',
      observacao        TEXT NOT NULL DEFAULT '',
      subtotal_cents    INTEGER NOT NULL,
      frete_cents       INTEGER NOT NULL DEFAULT 0,
      total_cents       INTEGER NOT NULL,
      stripe_session_id TEXT,
      estoque_baixado   INTEGER NOT NULL DEFAULT 0,
      criado_em         TEXT NOT NULL DEFAULT (datetime('now')),
      atualizado_em     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS itens_pedido (
      id          INTEGER PRIMARY KEY,
      pedido_id   INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
      produto_id  INTEGER,
      variacao_id INTEGER,
      nome        TEXT NOT NULL,
      rotulo      TEXT NOT NULL,
      preco_cents INTEGER NOT NULL,
      qtd         INTEGER NOT NULL CHECK (qtd > 0)
    );

    CREATE TABLE IF NOT EXISTS admins (
      id         INTEGER PRIMARY KEY,
      email      TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL
    );
  `);
  return db;
}

/* Preenche a loja com categorias e produtos de exemplo na primeira execução */
export function semear(db) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM categorias').get();
  if (n > 0) return false;
  transacao(db, () => {
    const insCat = db.prepare('INSERT INTO categorias (slug, nome, icone, ordem) VALUES (?, ?, ?, ?)');
    const ids = {};
    CATEGORIAS_EXEMPLO.forEach((c, i) => { ids[c.slug] = insCat.run(c.slug, c.nome, c.icone, i).lastInsertRowid; });
    const insProd = db.prepare(`INSERT INTO produtos
      (slug, nome, descricao, preco_cents, preco_de_cents, categoria_id, tag, destaque, cor1, cor2)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insVar = db.prepare('INSERT INTO variacoes (produto_id, rotulo, estoque, ordem) VALUES (?, ?, ?, ?)');
    for (const p of PRODUTOS_EXEMPLO) {
      const id = insProd.run(slugify(p.nome), p.nome, p.descricao, p.preco, p.de ?? null, ids[p.cat],
        p.tag ?? '', p.destaque ? 1 : 0, p.cor[0], p.cor[1]).lastInsertRowid;
      (p.variacoes ?? ['Único']).forEach((v, i) => insVar.run(id, v, p.estoque ?? 10, i));
    }
  });
  return true;
}

export function garantirAdmin(db, email, senha) {
  const existe = db.prepare('SELECT id FROM admins LIMIT 1').get();
  if (existe) return false;
  db.prepare('INSERT INTO admins (email, senha_hash) VALUES (?, ?)').run(email.toLowerCase(), hashSenha(senha));
  return true;
}

export function transacao(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function slugify(txt) {
  return String(txt).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'produto';
}
