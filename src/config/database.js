import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import env from './env.js';

/*
 * Akses database lewat klien libSQL (turunan SQLite):
 * - lokal/pengujian: file SQLite biasa (`file:./data/asramacare.db`) atau `:memory:`
 * - Vercel: database SQLite online di Turso (`libsql://...`), karena filesystem serverless tidak permanen.
 * API-nya dibuat mirip prepared statement SQLite (`prepare().get/all/run`), tetapi asinkron.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '../../database/migrations');

let db = null;

function isRemote(url) {
  return /^(libsql|https?|wss?):\/\//.test(url);
}

/** Mengubah argumen gaya better-sqlite3 (posisi atau objek bernama) menjadi args libSQL. */
function toArgs(params) {
  if (params.length === 1 && params[0] !== null && typeof params[0] === 'object' && !Array.isArray(params[0])) {
    return Object.fromEntries(Object.entries(params[0]).map(([k, v]) => [k, v ?? null]));
  }
  return params.map((v) => v ?? null);
}

function toObjects(result) {
  return result.rows.map((row) => Object.fromEntries(result.columns.map((col, i) => [col, row[i]])));
}

class Statement {
  constructor(executor, sql) {
    this.executor = executor;
    this.sql = sql;
  }

  async all(...params) {
    return toObjects(await this.executor.execute({ sql: this.sql, args: toArgs(params) }));
  }

  async get(...params) {
    return (await this.all(...params))[0];
  }

  async run(...params) {
    const result = await this.executor.execute({ sql: this.sql, args: toArgs(params) });
    return { changes: result.rowsAffected, lastInsertRowid: Number(result.lastInsertRowid) };
  }
}

export class Database {
  constructor(executor) {
    this.executor = executor;
  }

  prepare(sql) {
    return new Statement(this.executor, sql);
  }

  exec(sql) {
    return this.executor.executeMultiple(sql);
  }

  close() {
    this.executor.close();
  }
}

/**
 * Menjalankan fn(tx) di dalam transaksi: COMMIT jika berhasil, ROLLBACK jika error.
 * Semua query di dalam fn harus memakai `tx`, bukan koneksi utama.
 */
export async function transaction(database, fn) {
  const tx = await database.executor.transaction('write');
  try {
    const result = await fn(new Database(tx));
    await tx.commit();
    return result;
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}

/**
 * Menjalankan file migrasi .sql secara berurutan. Setiap migrasi yang sudah
 * dijalankan dicatat di tabel schema_migrations sehingga aman dijalankan ulang.
 */
export async function runMigrations(database) {
  await database.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const applied = new Set(
    (await database.prepare('SELECT name FROM schema_migrations').all()).map((r) => r.name),
  );
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await transaction(database, async (tx) => {
      await tx.exec(sql);
      await tx.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
    });
  }
}

/** Membuka koneksi, mengaktifkan foreign key, lalu menjalankan migrasi. */
export async function openDatabase(url = env.databaseUrl, authToken = env.databaseAuthToken) {
  let client;
  if (isRemote(url)) {
    const { createClient } = await import('@libsql/client/web');
    client = createClient({ url, authToken });
  } else {
    const { createClient } = await import('@libsql/client');
    if (url !== ':memory:') {
      const file = url.replace(/^file:/, '');
      fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
      url = `file:${file}`;
    }
    client = createClient({ url });
  }
  const database = new Database(client);
  await database.exec('PRAGMA foreign_keys = ON');
  await runMigrations(database);
  return database;
}

/** Membuka koneksi utama sekali saja (dipakai server, Vercel, seed, dan migrasi). */
export async function initDb() {
  if (!db) db = await openDatabase();
  return db;
}

export function getDb() {
  if (!db) throw new Error('Database belum diinisialisasi; panggil initDb() terlebih dahulu');
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
