import { verifyToken } from '../services/authService.js';
import * as userService from '../services/userService.js';
import AppError from '../utils/AppError.js';

export const COOKIE_NAME = 'asramacare_token';

/**
 * Membaca JWT dari cookie httpOnly. Header Authorization: Bearer tetap
 * didukung agar API mudah diuji dengan Postman/curl.
 */
function readToken(req) {
  if (req.cookies?.[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/** Mengembalikan { user } bila token sah, atau { error } bila tidak ada/kedaluwarsa. */
function resolveUser(req) {
  const token = readToken(req);
  if (!token) return { error: AppError.unauthorized() };

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return { error: AppError.unauthorized('Sesi Anda telah berakhir, silakan login kembali') };
  }

  // Data pengguna selalu diambil ulang dari database, sehingga perubahan role
  // atau akun yang dihapus langsung berlaku.
  const user = userService.findById(Number(payload.sub));
  if (!user) return { error: AppError.unauthorized('Sesi Anda telah berakhir, silakan login kembali') };
  return { user };
}

export function authenticate(req, res, next) {
  const { user, error } = resolveUser(req);
  if (error) return next(error);
  req.user = user;
  return next();
}

/** Seperti authenticate, tetapi pengunjung tanpa sesi tetap diteruskan dengan req.user = null. */
export function optionalAuthenticate(req, res, next) {
  req.user = resolveUser(req).user ?? null;
  return next();
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    return next();
  };
}
