import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import AppError from '../utils/AppError.js';
import * as userService from './userService.js';

// Hash tiruan agar waktu respons login tetap mirip walau email tidak terdaftar.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-untuk-timing', 10);

export function signToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

export function login({ email, password }) {
  const user = userService.findByEmailWithHash(email);
  const valid = bcrypt.compareSync(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !valid) {
    // Pesan sengaja sama untuk email salah maupun password salah.
    throw AppError.unauthorized('Email atau password salah');
  }
  const publicUser = userService.findById(user.id);
  return { user: publicUser, token: signToken(publicUser) };
}

export function register(data) {
  const user = userService.createUser({ ...data, role: 'penghuni' });
  return { user, token: signToken(user) };
}
