import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import env from './env.js';

// Driver utama: node:sqlite bawaan Node.js >= 22.13 (tanpa kompilasi native). Pada server dengan
// Node.js lebih lama, scripts/build.mjs memasang better-sqlite3 yang API-nya sama untuk dipakai di sini.
let DatabaseSync;
try {
  ({ DatabaseSync } = await import('node:sqlite'));
} catch /* c8 ignore start */ {
  DatabaseSync = (await import('better-sqlite3')).default;
} /* c8 ignore stop */

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '../../database/migrations');

let db = null;

/**
 * Menjalankan fn di dalam transaksi: COMMIT jika berhasil, ROLLBACK jika error.
 * (Modul bawaan node:sqlite tidak memiliki helper transaksi.)
 */
export function transaction(database, fn) {
  database.exec('BEGIN');
  try {
    const result = fn();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

/**
 * Menjalankan file migrasi .sql secara berurutan. Setiap migrasi yang sudah
 * dijalankan dicatat di tabel schema_migrations sehingga aman dijalankan ulang.
 */
export function runMigrations(database) {
  database.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const applied = new Set(
    database.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name),
  );
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const insert = database.prepare('INSERT INTO schema_migrations (name) VALUES (?)');
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    transaction(database, () => {
      database.exec(sql);
      insert.run(file);
    });
  }
}

export function openDatabase(dbPath = env.dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }
  const database = new DatabaseSync(dbPath);
  if (dbPath !== ':memory:') database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA foreign_keys = ON');
  runMigrations(database);
  return database;
}

export function getDb() {
  if (!db) db = openDatabase();
  return db;
}

/** Dipakai oleh pengujian untuk mengganti koneksi dengan database terpisah. */
export function setDb(database) {
  db = database;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
