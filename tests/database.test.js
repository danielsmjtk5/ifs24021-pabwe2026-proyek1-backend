import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { closeDb, getDb, openDatabase, runMigrations } from '../src/config/database.js';
import { seed } from '../database/seeds/seed.js';
import { ADMIN } from './helpers.js';
import AppError from '../src/utils/AppError.js';
import { changePassword } from '../src/services/userService.js';

describe('migrasi dan seed', () => {
  it('migrasi aman dijalankan berulang kali', () => {
    const db = getDb();
    runMigrations(db);
    runMigrations(db);
    const applied = db.prepare('SELECT name FROM schema_migrations').all();
    expect(applied).toEqual([{ name: '001_init.sql' }]);
  });

  it('seed idempoten dan tidak menggandakan data', () => {
    const db = getDb();
    const first = seed(db, { demo: true, admin: ADMIN });
    const second = seed(db, { demo: true, admin: ADMIN });
    expect(first).toMatchObject({ admin: { created: true }, residents: 2, reports: 4 });
    expect(second).toMatchObject({ admin: { created: false }, residents: 0, reports: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get().n).toBe(3);
  });

  it('seed tanpa demo hanya membuat admin', () => {
    const db = getDb();
    seed(db, { admin: ADMIN });
    expect(db.prepare("SELECT role FROM users").all()).toEqual([{ role: 'admin' }]);
  });

  it('membuat file database dan folder induknya', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asramacare-'));
    const file = path.join(dir, 'nested', 'test.db');
    const db = openDatabase(file);
    expect(fs.existsSync(file)).toBe(true);
    expect(db.prepare('PRAGMA foreign_keys').get().foreign_keys).toBe(1);
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('changePassword untuk pengguna yang tidak ada melempar 404', () => {
    expect(() => changePassword(999, { currentPassword: 'a', newPassword: 'b' })).toThrow(AppError);
  });
});

describe('koneksi database', () => {
  it('closeDb aman dipanggil saat koneksi sudah tertutup', () => {
    closeDb();
    expect(() => closeDb()).not.toThrow();
  });
});
