import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Kunci gabungan IP + email: di belakang reverse proxy yang tidak mengirim X-Forwarded-For,
  // semua pengguna terlihat dari IP yang sama sehingga batas per IP saja akan saling mengunci.
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.email ?? '').toLowerCase()}`,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    message: 'Terlalu banyak percobaan login, coba lagi dalam 15 menit',
  },
});
