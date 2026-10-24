import AppError from '../utils/AppError.js';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Lempar 400 jika ada error validasi. */
export function assertValid(errors) {
  if (Object.keys(errors).length > 0) {
    throw AppError.badRequest('Data yang dikirim tidak valid', errors);
  }
}

export function checkLength(errors, field, value, label, min, max) {
  if (!value) {
    errors[field] = `${label} wajib diisi`;
  } else if (value.length < min) {
    errors[field] = `${label} minimal ${min} karakter`;
  } else if (value.length > max) {
    errors[field] = `${label} maksimal ${max} karakter`;
  }
}
