import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function makeLimitedApp() {
  vi.resetModules();
  const { authLimiter } = await import('../src/middlewares/rateLimiter.js');
  const app = express();
  app.use(express.json());
  app.post('/login', authLimiter, (req, res) => res.json({ success: true }));
  return app;
}

describe('pembatas percobaan login', () => {
  it('membatasi per kombinasi IP dan email, bukan hanya per IP', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const app = await makeLimitedApp();
    for (let i = 0; i < 20; i += 1) {
      await request(app).post('/login').send({ email: 'Budi@asramacare.test' });
    }
    const blocked = await request(app).post('/login').send({ email: 'budi@asramacare.test' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);

    const other = await request(app).post('/login').send({ email: 'siti@asramacare.test' });
    expect(other.status).toBe(200);
    const noBody = await request(app).post('/login');
    expect(noBody.status).toBe(200);
  });
});
