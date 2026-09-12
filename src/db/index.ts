import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { config } from '../config';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = config.databaseUrl;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS guild_configs (
      guild_id TEXT PRIMARY KEY,
      tickets_enabled INTEGER NOT NULL DEFAULT 1,
      ticket_category_id TEXT,
      log_channel_id TEXT,
      staff_role_ids TEXT NOT NULL DEFAULT '[]',
      ticket_types TEXT NOT NULL DEFAULT '[]',
      welcome_message_id TEXT,
      rules_message_id TEXT,
      services_message_id TEXT,
      pricing_message_id TEXT,
      ticket_panel_message_id TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      action TEXT NOT NULL,
      user_id TEXT,
      user_tag TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_activity_guild_created
      ON activity_logs (guild_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expired INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions (expired);
  `);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
