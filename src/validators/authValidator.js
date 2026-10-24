import { EMAIL_PATTERN, asTrimmedString, assertValid, checkLength } from './helpers.js';

export function validateLogin(body = {}) {
  const email = asTrimmedString(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const errors = {};
  if (!email) errors.email = 'Email wajib diisi';
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'Format email tidak valid';
  if (!password) errors.password = 'Password wajib diisi';
  assertValid(errors);
  return { email, password };
}

export function validatePassword(errors, field, password) {
  if (!password) {
    errors[field] = 'Password wajib diisi';
  } else if (password.length < 8) {
    errors[field] = 'Password minimal 8 karakter';
  } else if (password.length > 72) {
    errors[field] = 'Password maksimal 72 karakter';
  } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors[field] = 'Password harus mengandung huruf dan angka';
  }
}

export function validateRegister(body = {}) {
  const name = asTrimmedString(body.name);
  const email = asTrimmedString(body.email).toLowerCase();
  const room = asTrimmedString(body.room);
  const password = typeof body.password === 'string' ? body.password : '';
  const errors = {};

  checkLength(errors, 'name', name, 'Nama', 3, 100);
  if (!email) errors.email = 'Email wajib diisi';
  else if (!EMAIL_PATTERN.test(email) || email.length > 120) errors.email = 'Format email tidak valid';
  if (room.length > 50) errors.room = 'Kamar maksimal 50 karakter';
  validatePassword(errors, 'password', password);

  assertValid(errors);
  // Role sengaja tidak dibaca dari request: registrasi publik selalu "penghuni".
  return { name, email, room: room || null, password };
}
