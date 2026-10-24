import { asTrimmedString, assertValid, checkLength } from './helpers.js';
import { validatePassword } from './authValidator.js';

export function validateProfile(body = {}) {
  const name = asTrimmedString(body.name);
  const room = asTrimmedString(body.room);
  const errors = {};
  checkLength(errors, 'name', name, 'Nama', 3, 100);
  if (room.length > 50) errors.room = 'Kamar maksimal 50 karakter';
  assertValid(errors);
  return { name, room: room || null };
}

export function validatePasswordChange(body = {}) {
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  const errors = {};
  if (!currentPassword) errors.currentPassword = 'Password lama wajib diisi';
  validatePassword(errors, 'newPassword', newPassword);
  if (!errors.newPassword && currentPassword && currentPassword === newPassword) {
    errors.newPassword = 'Password baru harus berbeda dari password lama';
  }
  assertValid(errors);
  return { currentPassword, newPassword };
}
