// Menjalankan API AsramaCare mode produksi: migrasi + seed (idempoten), lalu server.
// Nilai default di bawah hanya dipakai jika hosting tidak menyediakan variabel tersebut.
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import 'dotenv/config';

const root = path.resolve(import.meta.dirname, '..');
const env = process.env;
const frontendUrl = (env.FRONTEND_URL || '').replace(/\/$/, '');

const defaults = {
  NODE_ENV: 'production',
  DB_PATH: path.join(root, 'data', 'asramacare.db'),
  SEED_DEMO: 'true',
  CORS_ORIGIN: frontendUrl || 'http://localhost:5173',
  COOKIE_SAMESITE: 'lax',
  COOKIE_SECURE: frontendUrl.startsWith('https://') ? 'true' : 'false',
};
for (const [key, value] of Object.entries(defaults)) {
  if (!env[key]) env[key] = value;
}

// Bun tidak mengenal flag Node; Node >= 20.11 dapat menyembunyikan peringatan node:sqlite.
const nodeFlags = process.versions.bun ? [] : ['--disable-warning=ExperimentalWarning'];
const runtime = process.versions.bun ? `Bun ${process.versions.bun}` : `Node.js ${process.versions.node}`;
console.log(`AsramaCare API: ${runtime}, port ${env.PORT || 3000}, CORS ${env.CORS_ORIGIN}, DB ${env.DB_PATH}`);

execFileSync(process.execPath, [...nodeFlags, 'database/seeds/seed.js'], { cwd: root, stdio: 'inherit' });

const server = spawn(process.execPath, [...nodeFlags, 'src/server.js'], { cwd: root, stdio: 'inherit' });
server.on('exit', (code) => process.exit(code ?? 1));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}
