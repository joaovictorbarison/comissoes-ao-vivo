const { DatabaseSync } = require('node:sqlite')
let _db = null
function initDb(path) {
  const db = new DatabaseSync(path || process.env.DB_PATH || './comissoes.db')
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id_reuniao TEXT PRIMARY KEY,
      titulo TEXT,
      tipo TEXT,
      dt TEXT,
      local TEXT,
      assunto TEXT,
      status TEXT,
      active_item_id TEXT,
      encerrada_em TEXT,
      raw TEXT
    );
    CREATE TABLE IF NOT EXISTS agenda_items (
      id TEXT PRIMARY KEY,
      id_reuniao TEXT NOT NULL,
      nu_ordem INTEGER,
      raw TEXT
    );
    CREATE TABLE IF NOT EXISTS official_status (
      id_reuniao TEXT NOT NULL,
      item_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendente',
      PRIMARY KEY (id_reuniao, item_id)
    );
    CREATE TABLE IF NOT EXISTS presencas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_reuniao TEXT NOT NULL,
      name TEXT NOT NULL,
      profile TEXT,
      cabinet_key TEXT,
      confirmed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS anotacoes_privadas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_reuniao TEXT NOT NULL,
      item_id TEXT NOT NULL,
      text TEXT NOT NULL,
      author_name TEXT,
      cabinet_key TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS relatorio_final (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_reuniao TEXT NOT NULL,
      snapshot TEXT,
      pdf_path TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS vistas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_reuniao TEXT NOT NULL,
      item_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS processo_links (
      id_processo TEXT PRIMARY KEY,
      url_sem_papel TEXT,
      first_link TEXT,
      raw TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS vinculos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_reuniao TEXT NOT NULL,
      assessor_name TEXT NOT NULL,
      deputado_name TEXT NOT NULL,
      assessor_key TEXT NOT NULL,
      deputado_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendente',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_items_reuniao ON agenda_items(id_reuniao);
    CREATE INDEX IF NOT EXISTS idx_pres_reuniao ON presencas(id_reuniao);
    CREATE INDEX IF NOT EXISTS idx_notes_reuniao ON anotacoes_privadas(id_reuniao);
    CREATE INDEX IF NOT EXISTS idx_vistas_reuniao ON vistas(id_reuniao);
    CREATE INDEX IF NOT EXISTS idx_vinculos_reuniao ON vinculos(id_reuniao);
  `)
  return db
}
function getDb() {
  if (!_db) _db = initDb()
  return _db
}
module.exports = { initDb, getDb }
