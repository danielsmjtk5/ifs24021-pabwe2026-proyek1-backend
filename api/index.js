// Entry point Vercel (serverless function). Semua request diarahkan ke sini oleh vercel.json.
import { createApp } from '../src/app.js';
import { initDb } from '../src/config/database.js';
import { seedFromEnv } from '../database/seeds/seed.js';

// Dijalankan sekali per cold start: migrasi (idempoten) lalu memastikan akun admin/demo ada.
const db = await initDb();
await seedFromEnv(db);

export default createApp({ staticDir: '' });
