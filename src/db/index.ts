import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import type { AppConfig } from '../types';

let db: DatabaseSync | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS rota_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  added_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rota_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  rotation_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_date TEXT NOT NULL,
  task_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Assigned',
  message_id TEXT,
  channel_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_week_date ON assignments(week_date);
CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_active ON tasks(active);
`;

export function initDatabase(config: AppConfig): DatabaseSync {
  if (db) {
    return db;
  }

  const dir = path.dirname(config.databasePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new DatabaseSync(config.databasePath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);

  const state = db.prepare('SELECT rotation_index FROM rota_state WHERE id = 1').get();
  if (!state) {
    db.prepare('INSERT INTO rota_state (id, rotation_index) VALUES (1, 0)').run();
  }

  return db;
}

export function getDatabase(): DatabaseSync {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
