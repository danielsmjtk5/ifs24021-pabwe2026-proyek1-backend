import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';
import env from '../src/config/env.js';
import { getDb } from '../src/config/database.js';
import { ADMIN, BUDI, loginAs, makeApp, seedDemo } from './helpers.js';

let app;
beforeEach(() => {
  seedDemo();
  app = makeApp();
});

describe('POST /api/auth/login', () => {
  it('berhasil dan memasang cookie httpOnly', async () => {
    const res = await request(app).post('/api/auth/login').send(BUDI);
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email: BUDI.email, role: 'penghuni' });
    expect(res.body.data.user.password_hash).toBeUndefined();
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/^asramacare_token=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it('email tidak peka huruf besar', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '  BUDI@AsramaCare.test ', password: BUDI.password });
    expect(res.status).toBe(200);
  });

  it('password salah dan email tidak terdaftar memberi pesan yang sama', async () => {
    const wrongPass = await request(app).post('/api/auth/login').send({ ...BUDI, password: 'Salah1234' });
    const noUser = await request(app)
      .post('/api/auth/login')
      .send({ email: 'tidakada@test.local', password: 'Salah1234' });
    expect(wrongPass.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPass.body.message).toBe('Email atau password salah');
    expect(noUser.body.message).toBe(wrongPass.body.message);
  });

  it('input tidak valid mengembalikan 400 beserta detail field', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'bukan-email' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({
      email: 'Format email tidak valid',
      password: 'Password wajib diisi',
    });
    const empty = await request(app).post('/api/auth/login').send({});
    expect(empty.body.errors.email).toBe('Email wajib diisi');
  });

  it('password disimpan sebagai hash bcrypt', () => {
    const row = getDb().prepare('SELECT password_hash FROM users WHERE email = ?').get(BUDI.email);
    expect(row.password_hash).not.toBe(BUDI.password);
    expect(row.password_hash).toMatch(/^\$2[aby]\$10\$/);
  });
});

describe('POST /api/auth/register', () => {
  const newUser = { name: 'Rina Wati', email: 'rina@test.local', room: 'C-3', password: 'Rahasia123' };

  it('membuat akun penghuni walau role admin dikirim', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...newUser, role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ email: 'rina@test.local', role: 'penghuni', room: 'C-3' });
    expect(res.headers['set-cookie'][0]).toMatch(/asramacare_token=/);
  });

  it('email dengan format salah ditolak', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...newUser, email: 'rina@test' });
    expect(res.status).toBe(400);
    expect(res.body.errors.email).toBe('Format email tidak valid');
  });

  it('email berformat benar tetapi lebih dari 120 karakter ditolak', async () => {
    const email = `${'a'.repeat(115)}@test.local`;
    const res = await request(app).post('/api/auth/register').send({ ...newUser, email });
    expect(res.status).toBe(400);
    expect(res.body.errors.email).toBe('Format email tidak valid');
  });

  it('email yang sudah ada mengembalikan 409', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...newUser, email: BUDI.email });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Email sudah terdaftar');
  });

  it('memvalidasi nama, email, kamar, dan kekuatan password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'A', email: 'x', room: 'k'.repeat(51), password: 'pendek' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({
      name: 'Nama minimal 3 karakter',
      email: 'Format email tidak valid',
      room: 'Kamar maksimal 50 karakter',
      password: 'Password minimal 8 karakter',
    });

    const cases = [
      [{ password: 'hurufsaja' }, 'Password harus mengandung huruf dan angka'],
      [{ password: `a1${'x'.repeat(80)}` }, 'Password maksimal 72 karakter'],
      [{ password: '' }, 'Password wajib diisi'],
      [{ password: 12345678 }, 'Password wajib diisi'],
    ];
    for (const [patch, message] of cases) {
      const r = await request(app).post('/api/auth/register').send({ ...newUser, ...patch });
      expect(r.body.errors.password).toBe(message);
    }
    const noEmail = await request(app).post('/api/auth/register').send({ ...newUser, email: '' });
    expect(noEmail.body.errors.email).toBe('Email wajib diisi');
    const longName = await request(app).post('/api/auth/register').send({ ...newUser, name: 'n'.repeat(101) });
    expect(longName.body.errors.name).toBe('Nama maksimal 100 karakter');
    const noName = await request(app).post('/api/auth/register').send({ ...newUser, name: '   ' });
    expect(noName.body.errors.name).toBe('Nama wajib diisi');
  });

  it('kamar boleh kosong', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...newUser, room: undefined });
    expect(res.status).toBe(201);
    expect(res.body.data.user.room).toBeNull();
  });
});

describe('sesi', () => {
  it('GET /api/auth/session selalu 200: user null bila belum login atau token tidak sah', async () => {
    const guest = await request(app).get('/api/auth/session');
    expect(guest.status).toBe(200);
    expect(guest.body.data.user).toBeNull();
    expect(guest.body.message).toBe('Belum login');

    const invalid = await request(app).get('/api/auth/session').set('Cookie', 'asramacare_token=rusak');
    expect(invalid.status).toBe(200);
    expect(invalid.body.data.user).toBeNull();

    const agent = await loginAs(app, BUDI);
    const active = await agent.get('/api/auth/session');
    expect(active.status).toBe(200);
    expect(active.body.message).toBe('Sesi aktif');
    expect(active.body.data.user).toMatchObject({ email: BUDI.email, role: 'penghuni' });
    expect(active.body.data.user.password_hash).toBeUndefined();
  });

  it('GET /api/auth/me tanpa login mengembalikan 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Silakan login terlebih dahulu');
  });

  it('GET /api/auth/me dengan cookie mengembalikan pengguna', async () => {
    const agent = await loginAs(app, ADMIN);
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('admin');
  });

  it('mendukung header Authorization Bearer', async () => {
    const user = getDb().prepare('SELECT id, role FROM users WHERE email = ?').get(BUDI.email);
    const token = jwt.sign({ sub: String(user.id), role: user.role }, env.jwtSecret);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('token kedaluwarsa atau palsu ditolak', async () => {
    const expired = jwt.sign({ sub: '1', role: 'admin', exp: Math.floor(Date.now() / 1000) - 10 }, env.jwtSecret);
    const forged = jwt.sign({ sub: '1', role: 'admin' }, 'secret-lain-yang-tidak-sah-0123456789abcdef');
    for (const token of [expired, forged]) {
      const res = await request(app).get('/api/auth/me').set('Cookie', `asramacare_token=${token}`);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Sesi Anda telah berakhir, silakan login kembali');
    }
  });

  it('token milik akun yang sudah dihapus ditolak', async () => {
    const token = jwt.sign({ sub: '999', role: 'admin' }, env.jwtSecret);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('logout menghapus cookie', async () => {
    const agent = await loginAs(app, BUDI);
    const res = await agent.post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/asramacare_token=;/);
    const after = await agent.get('/api/auth/me');
    expect(after.status).toBe(401);
  });
});
