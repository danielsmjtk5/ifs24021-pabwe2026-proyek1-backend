import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { ADMIN, BUDI, loginAs, makeApp, seedDemo } from './helpers.js';

let app;
beforeEach(() => {
  seedDemo();
  app = makeApp();
});

describe('/api/users/me', () => {
  it('butuh login', async () => {
    expect((await request(app).get('/api/users/me')).status).toBe(401);
  });

  it('menampilkan dan memperbarui profil', async () => {
    const agent = await loginAs(app, BUDI);
    const me = await agent.get('/api/users/me');
    expect(me.body.data.user).toMatchObject({ name: 'Budi Santoso', room: 'A-101' });

    const res = await agent.put('/api/users/me').send({ name: 'Budi S.', room: '', role: 'admin', email: 'x@y.z' });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ name: 'Budi S.', room: null, role: 'penghuni', email: BUDI.email });
  });

  it('validasi profil', async () => {
    const agent = await loginAs(app, BUDI);
    const res = await agent.put('/api/users/me').send({ name: '', room: 'x'.repeat(51) });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ name: 'Nama wajib diisi', room: 'Kamar maksimal 50 karakter' });
  });
});

describe('PUT /api/users/me/password', () => {
  it('mengganti password lalu login dengan password baru', async () => {
    const agent = await loginAs(app, BUDI);
    const res = await agent
      .put('/api/users/me/password')
      .send({ currentPassword: BUDI.password, newPassword: 'Baru12345' });
    expect(res.status).toBe(200);
    expect((await request(app).post('/api/auth/login').send(BUDI)).status).toBe(401);
    expect(
      (await request(app).post('/api/auth/login').send({ email: BUDI.email, password: 'Baru12345' })).status,
    ).toBe(200);
  });

  it('password lama salah ditolak', async () => {
    const agent = await loginAs(app, BUDI);
    const res = await agent
      .put('/api/users/me/password')
      .send({ currentPassword: 'Salah1234', newPassword: 'Baru12345' });
    expect(res.status).toBe(400);
    expect(res.body.errors.currentPassword).toBe('Password lama tidak sesuai');
  });

  it('validasi input password', async () => {
    const agent = await loginAs(app, BUDI);
    const empty = await agent.put('/api/users/me/password').send({});
    expect(empty.body.errors).toEqual({
      currentPassword: 'Password lama wajib diisi',
      newPassword: 'Password wajib diisi',
    });
    const same = await agent
      .put('/api/users/me/password')
      .send({ currentPassword: BUDI.password, newPassword: BUDI.password });
    expect(same.body.errors.newPassword).toBe('Password baru harus berbeda dari password lama');
  });
});

describe('GET /api/users', () => {
  it('khusus admin', async () => {
    const penghuni = await loginAs(app, BUDI);
    expect((await penghuni.get('/api/users')).status).toBe(403);

    const admin = await loginAs(app, ADMIN);
    const res = await admin.get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(3);
    expect(res.body.data.users[0]).not.toHaveProperty('password_hash');
    expect(res.body.data.users.find((u) => u.email === BUDI.email).report_count).toBe(2);
  });
});
