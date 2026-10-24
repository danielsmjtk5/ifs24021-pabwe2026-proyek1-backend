import bcrypt from 'bcryptjs';
import { getDb } from '../config/database.js';
import AppError from '../utils/AppError.js';

const SALT_ROUNDS = 10;
const PUBLIC_COLUMNS = 'id, name, email, room, role, created_at, updated_at';

export function hashPassword(password) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

export function findById(id) {
  return getDb().prepare(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`).get(id) || null;
}

export function findByEmailWithHash(email) {
  return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) || null;
}

export function createUser({ name, email, room = null, password, role = 'penghuni' }) {
  const db = getDb();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    throw AppError.conflict('Email sudah terdaftar');
  }
  const info = db
    .prepare('INSERT INTO users (name, email, room, password_hash, role) VALUES (?, ?, ?, ?, ?)')
    .run(name, email, room, hashPassword(password), role);
  return findById(info.lastInsertRowid);
}

export function updateProfile(id, { name, room }) {
  getDb()
    .prepare(
      "UPDATE users SET name = ?, room = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    )
    .run(name, room, id);
  return findById(id);
}

export function changePassword(id, { currentPassword, newPassword }) {
  const db = getDb();
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(id);
  if (!row) throw AppError.notFound('Pengguna tidak ditemukan');
  if (!bcrypt.compareSync(currentPassword, row.password_hash)) {
    throw AppError.badRequest('Password lama tidak sesuai', {
      currentPassword: 'Password lama tidak sesuai',
    });
  }
  db.prepare(
    "UPDATE users SET password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
  ).run(hashPassword(newPassword), id);
}

export function listUsers() {
  return getDb()
    .prepare(
      `SELECT u.id, u.name, u.email, u.room, u.role, u.created_at, u.updated_at,
        (SELECT COUNT(*) FROM reports r WHERE r.reporter_id = u.id) AS report_count
       FROM users u ORDER BY u.role, u.name`,
    )
    .all();
}
