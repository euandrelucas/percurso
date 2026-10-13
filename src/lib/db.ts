import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { hashPassword } from "./password";

// node:sqlite é carregado via require para não passar pelo bundler.
const nodeRequire = createRequire(import.meta.url);
type Db = import("node:sqlite").DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'patient',
  status TEXT NOT NULL DEFAULT 'active',
  invite_id INTEGER,
  onboarded INTEGER NOT NULL DEFAULT 0,
  consent_at TEXT,
  calls_per_day INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label TEXT,
  used_by INTEGER,
  used_at TEXT,
  revoked INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS agent_settings (
  user_id INTEGER PRIMARY KEY,
  preferred_name TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  voice TEXT NOT NULL DEFAULT 'marin',
  tone TEXT NOT NULL DEFAULT 'acolhedor',
  style TEXT NOT NULL DEFAULT 'equilibrado',
  formality TEXT NOT NULL DEFAULT 'informal',
  humor TEXT NOT NULL DEFAULT 'leve',
  pace TEXT NOT NULL DEFAULT 'normal',
  avatar TEXT NOT NULL DEFAULT '{}',
  about_me TEXT NOT NULL DEFAULT '',
  topics TEXT NOT NULL DEFAULT '',
  boundaries TEXT NOT NULL DEFAULT '',
  goal_hint TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS screenings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  answers TEXT NOT NULL,
  score INTEGER NOT NULL,
  flagged INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  number INTEGER NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  duration_sec INTEGER,
  end_reason TEXT,
  max_minutes INTEGER NOT NULL,
  prompt_version TEXT,
  mood_start INTEGER,
  mood_end INTEGER,
  analysis TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, started_at);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_id INTEGER,
  channel TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id, id);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, id);
CREATE TABLE IF NOT EXISTS case_memory (
  user_id INTEGER PRIMARY KEY,
  data TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS case_memory_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  data TEXT NOT NULL,
  session_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativa',
  session_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  feedback TEXT,
  session_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE TABLE IF NOT EXISTS moods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  score INTEGER NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  level INTEGER NOT NULL,
  source TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  handled_at TEXT
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  data TEXT NOT NULL,
  model TEXT,
  prompt_version TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

function open(): Db {
  const { DatabaseSync } = nodeRequire("node:sqlite") as typeof import("node:sqlite");
  const file = path.resolve(config.dbPath());
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  seedAdmin(db);
  return db;
}

function seedAdmin(db: Db) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const pass = process.env.ADMIN_PASSWORD;
  if (!email || !pass) return;
  const existing = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (existing) return;
  db.prepare("INSERT INTO users (email, name, password_hash, role, onboarded) VALUES (?, 'Administrador', ?, 'admin', 1)").run(
    email,
    hashPassword(pass),
  );
}

const g = globalThis as unknown as { __percursoDb?: Db };
export function db(): Db {
  if (!g.__percursoDb) g.__percursoDb = open();
  return g.__percursoDb;
}

// Helpers tipados ---------------------------------------------------------
type Row = Record<string, unknown>;
// node:sqlite devolve objetos com protótipo nulo; convertemos para objetos simples (necessário para Server → Client Components).
export function all<T = Row>(sql: string, ...args: unknown[]): T[] {
  return db().prepare(sql).all(...(args as never[])).map((r) => ({ ...r })) as T[];
}
export function get<T = Row>(sql: string, ...args: unknown[]): T | undefined {
  const r = db().prepare(sql).get(...(args as never[]));
  return r ? ({ ...r } as T) : undefined;
}
export function run(sql: string, ...args: unknown[]): { id: number; changes: number } {
  const r = db().prepare(sql).run(...(args as never[]));
  return { id: Number(r.lastInsertRowid), changes: Number(r.changes) };
}

export function audit(actor: string, action: string, userId?: number | null, detail?: unknown) {
  run(
    "INSERT INTO audit_log (user_id, actor, action, detail) VALUES (?, ?, ?, ?)",
    userId ?? null,
    actor,
    action,
    detail === undefined ? null : JSON.stringify(detail),
  );
}
