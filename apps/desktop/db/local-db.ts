/**
 * local-db.ts
 * Opens (or creates) the SQLite database and runs migrations.
 * Called once from main.ts at app startup.
 *
 * Usage:
 *   import { getDb, closeDb } from '../db/local-db';
 *   const db = getDb();
 *   db.prepare('SELECT * FROM guests').all();
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

let _db: Database.Database | null = null;

/**
 * Returns the singleton DB instance.
 * Creates the database file and runs the schema on first call.
 */
export function getDb(): Database.Database {
  if (_db) return _db;

  // Store the DB in Electron's userData directory
  // macOS: ~/Library/Application Support/ResortPro/
  // Windows: %APPDATA%\ResortPro\
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'resortpro.db');

  // Ensure the directory exists
  fs.mkdirSync(userDataPath, { recursive: true });

  _db = new Database(dbPath, {
    // verbose: console.log, // uncomment for SQL logging
  });

  // Performance settings
  _db.pragma('journal_mode = WAL');
  _db.pragma('synchronous = NORMAL');
  _db.pragma('foreign_keys = OFF');

  // Run schema migrations
  runMigrations(_db);

  console.log('[local-db] Database opened at:', dbPath);
  return _db;
}

/**
 * Close the database cleanly (call on app quit).
 */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
    console.log('[local-db] Database closed');
  }
}

// ─── Migrations ───────────────────────────────────────────────────────────────

/**
 * Simple version-based migration runner.
 * Each migration runs exactly once, tracked in the `_migrations` table.
 */
function runMigrations(db: Database.Database): void {
  // Create migrations tracker table first
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version   INTEGER PRIMARY KEY,
      name      TEXT NOT NULL,
      ran_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const migrations: Array<{ version: number; name: string; sql: string }> = [
    {
      version: 1,
      name: 'initial_schema',
      sql: fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf-8'),
    },
  ];

  const getRan = db.prepare('SELECT version FROM _migrations WHERE version = ?');
  const markRan = db.prepare('INSERT INTO _migrations (version, name) VALUES (?, ?)');

  for (const migration of migrations) {
    const already = getRan.get(migration.version);
    if (!already) {
      console.log(`[local-db] Running migration ${migration.version}: ${migration.name}`);
      db.exec(migration.sql);
      markRan.run(migration.version, migration.name);
      console.log(`[local-db] Migration ${migration.version} done`);
    }
  }
}
