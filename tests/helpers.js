import request from 'supertest';
import { createApp } from '../src/app.js';
import { getDb } from '../src/config/database.js';
import { seed } from '../database/seeds/seed.js';

export const ADMIN = { name: 'Admin Uji', email: 'admin@test.local', password: 'Admin12345' };
export const BUDI = { email: 'budi@asramacare.test', password: 'Penghuni123' };
export const SARI = { email: 'sari@asramacare.test', password: 'Penghuni123' };

export function makeApp() {
  return createApp({ staticDir: '' });
}

export async function seedDemo() {
  return seed(getDb(), { demo: true, admin: ADMIN });
}

/** Login dan kembalikan agent supertest yang membawa cookie sesi. */
export async function loginAs(app, credentials) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send(credentials);
  if (res.status !== 200) throw new Error(`Login gagal: ${res.status}`);
  return agent;
}

export const validReport = {
  title: 'Pintu kamar mandi rusak',
  category: 'kamar_furnitur',
  location: 'Gedung A Lantai 2',
  description: 'Gagang pintu kamar mandi lepas dan pintu tidak bisa dikunci.',
  priority: 'tinggi',
};
