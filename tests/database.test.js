import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { closeDb, getDb, initDb, openDatabase, runMigrations, setDb, transaction } from '../src/config/database.js';
import { seed, seedFromEnv } from '../database/seeds/seed.js';
import { ADMIN } from './helpers.js';
import env from '../src/config/env.js';
import AppError from '../src/utils/AppError.js';
import { changePassword } from '../src/services/userService.js';

describe('migrasi dan seed', () => {
  it('migrasi aman dijalankan berulang kali', async () => {
    const db = getDb();
    await runMigrations(db);
    await runMigrations(db);
    const applied = await db.prepare('SELECT name FROM schema_migrations').all();
    expect(applied).toEqual([{ name: '001_init.sql' }]);
  });

  it('seed idempoten dan tidak menggandakan data', async () => {
    const db = getDb();
    const first = await seed(db, { demo: true, admin: ADMIN });
    const second = await seed(db, { demo: true, admin: ADMIN });
    expect(first).toMatchObject({ admin: { created: true }, residents: 2, reports: 4 });
    expect(second).toMatchObject({ admin: { created: false }, residents: 0, reports: 0 });
    expect((await db.prepare('SELECT COUNT(*) AS n FROM users').get()).n).toBe(3);
  });

  it('seed tanpa demo hanya membuat admin', async () => {
    const db = getDb();
    await seed(db, { admin: ADMIN });
    expect(await db.prepare('SELECT role FROM users').all()).toEqual([{ role: 'admin' }]);
  });

  it('seedFromEnv memakai ADMIN_EMAIL/ADMIN_PASSWORD dan melewati seed bila belum diisi', async () => {
    const saved = { ...process.env };
    try {
      delete process.env.ADMIN_EMAIL;
      expect(await seedFromEnv(getDb())).toBeNull();
      Object.assign(process.env, { ADMIN_EMAIL: 'Admin@Env.Test', ADMIN_PASSWORD: 'Rahasia123', SEED_DEMO: 'false' });
      delete process.env.ADMIN_NAME;
      const result = await seedFromEnv(getDb());
      expect(result).toMatchObject({ admin: { created: true }, residents: 0 });
      const admin = await getDb().prepare('SELECT name, email, role FROM users').get();
      expect(admin).toEqual({ name: 'Admin Asrama', email: 'admin@env.test', role: 'admin' });
    } finally {
      process.env = saved;
    }
  });

  it('membuat file database dan folder induknya', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asramacare-'));
    const file = path.join(dir, 'nested', 'test.db');
    const db = await openDatabase(`file:${file}`);
    expect(fs.existsSync(file)).toBe(true);
    expect((await db.prepare('PRAGMA foreign_keys').get()).foreign_keys).toBe(1);
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('URL database online (libsql://) memakai klien HTTP tanpa modul native', async () => {
    const db = await openDatabase('libsql://contoh.invalid', 'token').catch((error) => error);
    // Tidak ada server sungguhan; yang diuji adalah pemilihan klien dan penerusan error koneksi.
    expect(db).toBeInstanceOf(Error);
  });

  it('transaksi di-rollback bila terjadi error', async () => {
    const db = getDb();
    await expect(
      transaction(db, async (tx) => {
        await tx.prepare("INSERT INTO users (name, email, password_hash) VALUES ('X', 'x@test', 'h')").run();
        throw new Error('batal');
      }),
    ).rejects.toThrow('batal');
    expect((await db.prepare('SELECT COUNT(*) AS n FROM users').get()).n).toBe(0);
  });

  it('changePassword untuk pengguna yang tidak ada melempar 404', async () => {
    await expect(changePassword(999, { currentPassword: 'a', newPassword: 'b' })).rejects.toThrow(AppError);
  });
});

describe('koneksi database', () => {
  it('closeDb aman dipanggil saat koneksi sudah tertutup', () => {
    closeDb();
    expect(() => closeDb()).not.toThrow();
  });

  it('getDb sebelum inisialisasi melempar error yang jelas', () => {
    closeDb();
    expect(() => getDb()).toThrow(/initDb/);
  });

  it('initDb membuka koneksi dari DATABASE_URL bila belum ada', async () => {
    closeDb();
    const saved = env.databaseUrl;
    env.databaseUrl = ':memory:';
    try {
      const db = await initDb();
      expect(getDb()).toBe(db);
    } finally {
      env.databaseUrl = saved;
    }
  });

  it('parameter bernama yang kosong dikirim sebagai NULL', async () => {
    const row = await getDb().prepare('SELECT @a AS a, @b AS b').get({ a: 1, b: undefined });
    expect(row).toEqual({ a: 1, b: null });
  });

  it('initDb hanya membuka satu koneksi', async () => {
    const existing = await openDatabase(':memory:');
    setDb(existing);
    expect(await initDb()).toBe(existing);
  });
});
