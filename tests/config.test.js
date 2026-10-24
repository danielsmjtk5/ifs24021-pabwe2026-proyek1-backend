import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadEnv(vars) {
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
  vi.resetModules();
  return (await import('../src/config/env.js')).default;
}

describe('konfigurasi environment', () => {
  it('production tanpa JWT_SECRET yang kuat gagal dijalankan', async () => {
    await expect(loadEnv({ NODE_ENV: 'production', JWT_SECRET: 'pendek' })).rejects.toThrow(/JWT_SECRET/);
  });

  it('membaca nilai dari environment', async () => {
    const env = await loadEnv({
      NODE_ENV: 'production',
      JWT_SECRET: 's'.repeat(40),
      PORT: '8080',
      CORS_ORIGIN: 'https://a.example, https://b.example,',
      COOKIE_SAMESITE: 'none',
      COOKIE_SECURE: 'true',
    });
    expect(env).toMatchObject({
      isProduction: true,
      port: 8080,
      jwtSecret: 's'.repeat(40),
      corsOrigins: ['https://a.example', 'https://b.example'],
      cookieSameSite: 'none',
      cookieSecure: true,
    });
  });

  it('konfigurasi Vercel: Turso, CORS dari FRONTEND_URL, dan cookie lintas situs', async () => {
    const env = await loadEnv({
      NODE_ENV: 'production',
      JWT_SECRET: 's'.repeat(40),
      DATABASE_URL: 'libsql://asramacare-albert.turso.io',
      DATABASE_AUTH_TOKEN: 'token-uji',
      FRONTEND_URL: 'https://ifs24021-pabwe2026-proyek1.s1if.cloud',
      CORS_ORIGIN: '',
      COOKIE_SAMESITE: 'none',
      COOKIE_SECURE: 'true',
      COOKIE_PARTITIONED: 'true',
    });
    expect(env).toMatchObject({
      databaseUrl: 'libsql://asramacare-albert.turso.io',
      databaseAuthToken: 'token-uji',
      corsOrigins: ['https://ifs24021-pabwe2026-proyek1.s1if.cloud'],
      cookieSameSite: 'none',
      cookieSecure: true,
      cookiePartitioned: true,
    });
  });

  it('memakai nilai default untuk development', async () => {
    const env = await loadEnv({
      NODE_ENV: '',
      JWT_SECRET: '',
      PORT: '',
      DB_PATH: '',
      DATABASE_URL: '',
      FRONTEND_URL: '',
      CORS_ORIGIN: '',
      COOKIE_SAMESITE: '',
      JWT_EXPIRES_IN: '',
      STATIC_DIR: '',
    });
    expect(env).toMatchObject({
      nodeEnv: 'development',
      port: 3000,
      databaseUrl: 'file:./data/asramacare.db',
      corsOrigins: ['http://localhost:5173'],
      cookieSameSite: 'lax',
      jwtExpiresIn: '1d',
    });
    expect(env.jwtSecret.length).toBeGreaterThanOrEqual(32);
  });
});

describe('penyajian build front-end', () => {
  it('menyajikan index.html untuk route SPA dan tetap 404 JSON untuk /api', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<div id="root"></div>');
    fs.writeFileSync(path.join(dir, 'robots.txt'), 'User-agent: *\nAllow: /\n');
    fs.mkdirSync(path.join(dir, 'assets'));
    fs.writeFileSync(path.join(dir, 'assets', 'app.js'), `console.log("${'x'.repeat(4000)}");`);
    const app = createApp({ staticDir: dir });

    const page = await request(app).get('/reports/12');
    expect(page.status).toBe(200);
    expect(page.text).toContain('id="root"');

    // Permintaan bersyarat (cache browser/auditor) tetap mendapat 200, bukan 304.
    for (const route of ['/', '/auth/login']) {
      const again = await request(app)
        .get(route)
        .set('If-None-Match', '*')
        .set('If-Modified-Since', new Date().toUTCString());
      expect(again.status).toBe(200);
      expect(again.headers['cache-control']).toBe('no-store');
      expect(again.headers.etag).toBeUndefined();
    }

    // robots.txt dari build dikirim apa adanya (bukan index.html), aset dikompresi dan di-cache lama.
    const robots = await request(app).get('/robots.txt');
    expect(robots.status).toBe(200);
    expect(robots.text).toContain('User-agent: *');
    const asset = await request(app).get('/assets/app.js').set('Accept-Encoding', 'gzip');
    expect(asset.status).toBe(200);
    expect(asset.headers['content-encoding']).toBe('gzip');
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');

    const api = await request(app).get('/api/tidak-ada');
    expect(api.status).toBe(404);
    expect(api.body.success).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('tanpa folder build, route non-API mengembalikan 404 JSON', async () => {
    const res = await request(createApp({ staticDir: '/folder/yang/tidak/ada' })).get('/');
    expect(res.status).toBe(404);
  });
});

describe('header keamanan iframe', () => {
  it('default hanya mengizinkan origin sendiri', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'self'");
  });

  it('FRAME_ANCESTORS mengizinkan iframe Hugging Face', async () => {
    vi.stubEnv('FRAME_ANCESTORS', 'https://huggingface.co');
    vi.resetModules();
    const { createApp: freshApp } = await import('../src/app.js');
    const res = await request(freshApp()).get('/api/health');
    expect(res.headers['x-frame-options']).toBeUndefined();
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'self' https://huggingface.co");
  });
});
