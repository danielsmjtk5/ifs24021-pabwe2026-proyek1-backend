import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { getDb } from '../src/config/database.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';
import { makeApp } from './helpers.js';

describe('GET /api/health', () => {
  it('mengembalikan status ok', async () => {
    const res = await request(makeApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.database).toBe('ok');
  });

  it('mengembalikan 500 tanpa stack trace saat database gagal', async () => {
    const db = getDb();
    const spy = vi.spyOn(db, 'prepare').mockImplementation(() => {
      throw new Error('SQLITE_IOERR: disk I/O error');
    });
    const res = await request(makeApp()).get('/api/health');
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      message: 'Terjadi kesalahan pada server, silakan coba lagi',
    });
    expect(JSON.stringify(res.body)).not.toContain('SQLITE');
  });
});

describe('penanganan umum', () => {
  it('endpoint tidak dikenal mengembalikan 404', async () => {
    const res = await request(makeApp()).get('/api/tidak-ada');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('JSON rusak mengembalikan 400', async () => {
    const res = await request(makeApp())
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Format JSON tidak valid');
  });

  it('body terlalu besar mengembalikan 413', async () => {
    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ email: 'a@b.c', password: 'x'.repeat(200 * 1024) });
    expect(res.status).toBe(413);
  });

  it('CORS hanya mengizinkan origin yang dikonfigurasi', async () => {
    const res = await request(makeApp()).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    const evil = await request(makeApp()).get('/api/health').set('Origin', 'http://jahat.example');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('errorHandler di luar mode test', () => {
  it('mencatat error tak terduga ke console dan tetap mengirim pesan umum', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const error = new Error('detail internal');

    errorHandler(error, {}, res, () => {});

    expect(log).toHaveBeenCalledWith(error);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Terjadi kesalahan pada server, silakan coba lagi',
    });
    log.mockRestore();
    vi.unstubAllEnvs();
  });
});
