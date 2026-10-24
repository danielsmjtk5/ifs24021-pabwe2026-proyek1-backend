import env from '../config/env.js';
import { COOKIE_NAME } from '../middlewares/auth.js';
import * as authService from '../services/authService.js';
import { success } from '../utils/response.js';
import { validateLogin, validateRegister } from '../validators/authValidator.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: '/',
  };
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: ONE_DAY_MS });
}

export function login(req, res) {
  const { user, token } = authService.login(validateLogin(req.body));
  setSessionCookie(res, token);
  return success(res, 'Login berhasil', { user });
}

export function register(req, res) {
  const { user, token } = authService.register(validateRegister(req.body));
  setSessionCookie(res, token);
  return success(res, 'Registrasi berhasil', { user }, 201);
}

export function logout(req, res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  return success(res, 'Logout berhasil');
}

export function me(req, res) {
  return success(res, 'Data pengguna aktif', { user: req.user });
}

/**
 * Status sesi untuk front-end saat aplikasi dibuka: selalu 200 (user bernilai null bila belum login),
 * sehingga browser tidak mencatat error 401 di console untuk pengunjung yang belum login.
 */
export function session(req, res) {
  return success(res, req.user ? 'Sesi aktif' : 'Belum login', { user: req.user });
}
