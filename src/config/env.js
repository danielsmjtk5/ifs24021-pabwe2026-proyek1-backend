import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV || 'development';

function readSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (nodeEnv === 'production') {
    throw new Error('JWT_SECRET wajib diisi (minimal 32 karakter) pada mode production');
  }
  // Hanya untuk development/test agar proyek bisa langsung dijalankan.
  return 'dev-only-secret-jangan-dipakai-di-produksi-0123456789';
}

const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT) || 3000,
  dbPath: process.env.DB_PATH || './data/asramacare.db',
  jwtSecret: readSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  staticDir: process.env.STATIC_DIR || '',
  frameAncestors: (process.env.FRAME_ANCESTORS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};

export default env;
