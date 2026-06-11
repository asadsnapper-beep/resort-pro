"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.closeDb = closeDb;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const electron_1 = require("electron");
let _db = null;
/**
 * Returns the singleton DB instance.
 * Creates the database file and runs the schema on first call.
 */
function getDb() {
    if (_db)
        return _db;
    // Store the DB in Electron's userData directory
    // macOS: ~/Library/Application Support/ResortPro/
    // Windows: %APPDATA%\ResortPro\
    const userDataPath = electron_1.app.getPath('userData');
    const dbPath = path.join(userDataPath, 'resortpro.db');
    // Ensure the directory exists
    fs.mkdirSync(userDataPath, { recursive: true });
    _db = new better_sqlite3_1.default(dbPath, {
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
function closeDb() {
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
function runMigrations(db) {
    // Create migrations tracker table first
    db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version   INTEGER PRIMARY KEY,
      name      TEXT NOT NULL,
      ran_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
    const migrations = [
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
