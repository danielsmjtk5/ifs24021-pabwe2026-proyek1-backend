import { CATEGORIES, PRIORITIES, STATUSES } from '../utils/constants.js';
import AppError from '../utils/AppError.js';
import { asTrimmedString, assertValid, checkLength } from './helpers.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SORTS = new Set(['newest', 'oldest', 'priority']);

export function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw AppError.badRequest('ID laporan tidak valid');
  }
  return id;
}

/**
 * Hanya field konten yang diambil. Field seperti status, reporter_id, dan
 * created_at diabaikan agar tidak bisa dimanipulasi melalui request.
 */
export function validateReportInput(body = {}) {
  const data = {
    title: asTrimmedString(body.title),
    category: asTrimmedString(body.category),
    location: asTrimmedString(body.location),
    description: asTrimmedString(body.description),
    priority: asTrimmedString(body.priority),
  };
  const errors = {};
  checkLength(errors, 'title', data.title, 'Judul', 5, 100);
  checkLength(errors, 'location', data.location, 'Lokasi', 3, 100);
  checkLength(errors, 'description', data.description, 'Deskripsi', 10, 1000);
  if (!CATEGORIES.includes(data.category)) errors.category = 'Kategori tidak valid';
  if (!PRIORITIES.includes(data.priority)) errors.priority = 'Prioritas tidak valid';
  assertValid(errors);
  return data;
}

export function validateStatusChange(body = {}) {
  const status = asTrimmedString(body.status);
  const note = asTrimmedString(body.note);
  const errors = {};
  if (!STATUSES.includes(status)) errors.status = 'Status tidak valid';
  if (note.length > 500) errors.note = 'Catatan maksimal 500 karakter';
  if (status === 'ditolak' && !note) errors.note = 'Alasan penolakan wajib diisi';
  assertValid(errors);
  return { status, note: note || null };
}

export function validateNote(body = {}) {
  const note = asTrimmedString(body.note);
  const errors = {};
  checkLength(errors, 'note', note, 'Catatan', 3, 500);
  assertValid(errors);
  return { note };
}

export function validateReportQuery(query = {}) {
  const errors = {};
  const filters = {
    q: asTrimmedString(query.q).slice(0, 100),
    category: asTrimmedString(query.category),
    priority: asTrimmedString(query.priority),
    status: asTrimmedString(query.status),
    dateFrom: asTrimmedString(query.dateFrom),
    dateTo: asTrimmedString(query.dateTo),
    sort: asTrimmedString(query.sort) || 'newest',
    mine: query.mine === 'true',
    page: query.page === undefined ? 1 : Number(query.page),
    limit: query.limit === undefined ? 10 : Number(query.limit),
  };

  if (filters.category && !CATEGORIES.includes(filters.category)) errors.category = 'Kategori tidak valid';
  if (filters.priority && !PRIORITIES.includes(filters.priority)) errors.priority = 'Prioritas tidak valid';
  if (filters.status && !STATUSES.includes(filters.status)) errors.status = 'Status tidak valid';
  if (filters.dateFrom && !DATE_PATTERN.test(filters.dateFrom)) errors.dateFrom = 'Format tanggal harus YYYY-MM-DD';
  if (filters.dateTo && !DATE_PATTERN.test(filters.dateTo)) errors.dateTo = 'Format tanggal harus YYYY-MM-DD';
  if (!SORTS.has(filters.sort)) errors.sort = 'Urutan tidak valid';
  if (!Number.isInteger(filters.page) || filters.page < 1) errors.page = 'Halaman tidak valid';
  if (!Number.isInteger(filters.limit) || filters.limit < 1 || filters.limit > 50) {
    errors.limit = 'Limit harus antara 1 dan 50';
  }
  assertValid(errors);
  return filters;
}
