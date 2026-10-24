import { getDb, transaction } from '../config/database.js';
import AppError from '../utils/AppError.js';
import { EDITABLE_STATUS, STATUS_TRANSITIONS } from '../utils/constants.js';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const PRIORITY_ORDER = `CASE r.priority
  WHEN 'darurat' THEN 4 WHEN 'tinggi' THEN 3 WHEN 'sedang' THEN 2 ELSE 1 END`;

const SORT_SQL = {
  newest: 'r.created_at DESC, r.id DESC',
  oldest: 'r.created_at ASC, r.id ASC',
  priority: `${PRIORITY_ORDER} DESC, r.created_at DESC`,
};

const SELECT_REPORT = `SELECT r.*, u.name AS reporter_name, u.email AS reporter_email, u.room AS reporter_room
  FROM reports r JOIN users u ON u.id = r.reporter_id`;

/**
 * Data pribadi pelapor (email, kamar) hanya diberikan kepada admin atau
 * kepada pemilik laporan itu sendiri.
 */
function present(row, viewer) {
  const canSeePrivate = viewer.role === 'admin' || row.reporter_id === viewer.id;
  const report = {
    id: row.id,
    title: row.title,
    category: row.category,
    location: row.location,
    description: row.description,
    priority: row.priority,
    status: row.status,
    reporter: { id: row.reporter_id, name: row.reporter_name },
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  if (canSeePrivate) {
    report.reporter.email = row.reporter_email;
    report.reporter.room = row.reporter_room;
  }
  report.permissions = permissionsFor(row, viewer);
  return report;
}

export function permissionsFor(report, viewer) {
  const isOwner = report.reporter_id === viewer.id;
  const isAdmin = viewer.role === 'admin';
  const editable = isOwner && report.status === EDITABLE_STATUS;
  return {
    canEdit: editable,
    canDelete: isAdmin || editable,
    canChangeStatus: isAdmin && STATUS_TRANSITIONS[report.status].length > 0,
    canAddNote: isAdmin,
    nextStatuses: isAdmin ? STATUS_TRANSITIONS[report.status] : [],
  };
}

function findRow(id) {
  const row = getDb().prepare(`${SELECT_REPORT} WHERE r.id = ?`).get(id);
  if (!row) throw AppError.notFound('Laporan tidak ditemukan');
  return row;
}

function buildWhere(filters, viewer) {
  const clauses = [];
  const params = {};
  if (filters.mine) {
    clauses.push('r.reporter_id = @viewerId');
    params.viewerId = viewer.id;
  }
  if (filters.q) {
    clauses.push('(r.title LIKE @q OR r.location LIKE @q)');
    params.q = `%${filters.q}%`;
  }
  for (const key of ['category', 'priority', 'status']) {
    if (filters[key]) {
      clauses.push(`r.${key} = @${key}`);
      params[key] = filters[key];
    }
  }
  if (filters.dateFrom) {
    clauses.push('date(r.created_at) >= date(@dateFrom)');
    params.dateFrom = filters.dateFrom;
  }
  if (filters.dateTo) {
    clauses.push('date(r.created_at) <= date(@dateTo)');
    params.dateTo = filters.dateTo;
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

export function listReports(filters, viewer) {
  const db = getDb();
  const { where, params } = buildWhere(filters, viewer);
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM reports r ${where}`).get(params);
  const offset = (filters.page - 1) * filters.limit;
  const rows = db
    .prepare(`${SELECT_REPORT} ${where} ORDER BY ${SORT_SQL[filters.sort]} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: filters.limit, offset });

  return {
    reports: rows.map((row) => present(row, viewer)),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.limit)),
    },
  };
}

export function getHistory(reportId) {
  return getDb()
    .prepare(
      `SELECT h.id, h.old_status, h.new_status, h.note, h.created_at,
        h.changed_by, u.name AS changed_by_name, u.role AS changed_by_role
       FROM report_history h LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.report_id = ? ORDER BY h.created_at ASC, h.id ASC`,
    )
    .all(reportId);
}

export function getReport(id, viewer) {
  const report = present(findRow(id), viewer);
  report.history = getHistory(id);
  return report;
}

export function createReport(data, viewer) {
  const db = getDb();
  const id = transaction(db, () => {
    const info = db
      .prepare(
        `INSERT INTO reports (title, category, location, description, priority, status, reporter_id)
         VALUES (@title, @category, @location, @description, @priority, 'menunggu', @reporterId)`,
      )
      .run({ ...data, reporterId: viewer.id });
    db.prepare(
      `INSERT INTO report_history (report_id, changed_by, old_status, new_status, note)
       VALUES (?, ?, NULL, 'menunggu', 'Laporan dibuat')`,
    ).run(info.lastInsertRowid, viewer.id);
    return info.lastInsertRowid;
  });
  return getReport(id, viewer);
}

export function updateReport(id, data, viewer) {
  const row = findRow(id);
  if (row.reporter_id !== viewer.id) {
    throw AppError.forbidden('Anda hanya dapat mengubah laporan milik sendiri');
  }
  if (row.status !== EDITABLE_STATUS) {
    throw AppError.conflict('Laporan yang sudah diproses tidak dapat diubah');
  }
  getDb()
    .prepare(
      `UPDATE reports SET title = @title, category = @category, location = @location,
        description = @description, priority = @priority, updated_at = ${NOW} WHERE id = @id`,
    )
    .run({ ...data, id });
  return getReport(id, viewer);
}

export function deleteReport(id, viewer) {
  const row = findRow(id);
  if (viewer.role !== 'admin') {
    if (row.reporter_id !== viewer.id) {
      throw AppError.forbidden('Anda hanya dapat menghapus laporan milik sendiri');
    }
    if (row.status !== EDITABLE_STATUS) {
      throw AppError.conflict('Laporan yang sudah diproses tidak dapat dihapus');
    }
  }
  getDb().prepare('DELETE FROM reports WHERE id = ?').run(id);
}

export function changeStatus(id, { status, note }, viewer) {
  const row = findRow(id);
  if (!STATUS_TRANSITIONS[row.status].includes(status)) {
    throw AppError.conflict(`Status tidak dapat diubah dari "${row.status}" menjadi "${status}"`);
  }
  const db = getDb();
  transaction(db, () => {
    db.prepare(`UPDATE reports SET status = ?, updated_at = ${NOW} WHERE id = ?`).run(status, id);
    db.prepare(
      `INSERT INTO report_history (report_id, changed_by, old_status, new_status, note)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(id, viewer.id, row.status, status, note);
  });
  return getReport(id, viewer);
}

/** Catatan tindak lanjut tanpa mengubah status (old_status = new_status). */
export function addNote(id, { note }, viewer) {
  const row = findRow(id);
  const db = getDb();
  transaction(db, () => {
    db.prepare(
      `INSERT INTO report_history (report_id, changed_by, old_status, new_status, note)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(id, viewer.id, row.status, row.status, note);
    db.prepare(`UPDATE reports SET updated_at = ${NOW} WHERE id = ?`).run(id);
  });
  return getReport(id, viewer);
}

/** Admin melihat statistik seluruh laporan, penghuni melihat laporannya sendiri. */
export function getStats(viewer) {
  const db = getDb();
  const scoped = viewer.role !== 'admin';
  const where = scoped ? 'WHERE r.reporter_id = @viewerId' : '';
  const params = scoped ? { viewerId: viewer.id } : {};

  const byStatus = { menunggu: 0, diproses: 0, selesai: 0, ditolak: 0 };
  for (const row of db
    .prepare(`SELECT r.status, COUNT(*) AS count FROM reports r ${where} GROUP BY r.status`)
    .all(params)) {
    byStatus[row.status] = row.count;
  }

  const byCategory = db
    .prepare(
      `SELECT r.category, COUNT(*) AS count FROM reports r ${where} GROUP BY r.category ORDER BY count DESC`,
    )
    .all(params);

  const recent = db
    .prepare(`${SELECT_REPORT} ${where} ORDER BY r.created_at DESC, r.id DESC LIMIT 5`)
    .all(params)
    .map((row) => present(row, viewer));

  const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
  return { scope: scoped ? 'mine' : 'all', total, byStatus, byCategory, recent };
}
