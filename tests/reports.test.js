import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../src/config/database.js';
import { ADMIN, BUDI, SARI, loginAs, makeApp, seedDemo, validReport } from './helpers.js';

let app;
let budi;
let sari;
let admin;

// Data demo: #1 Budi diproses, #2 Sari selesai, #3 Budi menunggu, #4 Sari menunggu (darurat)
beforeEach(async () => {
  seedDemo();
  app = makeApp();
  [budi, sari, admin] = await Promise.all([loginAs(app, BUDI), loginAs(app, SARI), loginAs(app, ADMIN)]);
});

describe('autentikasi endpoint laporan', () => {
  it('semua endpoint laporan butuh login', async () => {
    const res = await request(app).get('/api/reports');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/reports', () => {
  it('membuat laporan dengan status menunggu dan riwayat awal', async () => {
    const res = await budi.post('/api/reports').send(validReport);
    expect(res.status).toBe(201);
    const { report } = res.body.data;
    expect(report).toMatchObject({ ...validReport, status: 'menunggu' });
    expect(report.reporter.name).toBe('Budi Santoso');
    expect(report.history).toHaveLength(1);
    expect(report.history[0]).toMatchObject({ old_status: null, new_status: 'menunggu' });
    expect(report.permissions).toMatchObject({ canEdit: true, canDelete: true, canChangeStatus: false });
  });

  it('mengabaikan status dan reporter_id yang dikirim pengguna', async () => {
    const res = await budi
      .post('/api/reports')
      .send({ ...validReport, status: 'selesai', reporter_id: 3, id: 99, created_at: '2000-01-01' });
    expect(res.status).toBe(201);
    const { report } = res.body.data;
    expect(report.status).toBe('menunggu');
    expect(report.reporter.name).toBe('Budi Santoso');
    expect(report.id).not.toBe(99);
    expect(report.created_at).not.toBe('2000-01-01');
  });

  it('memvalidasi seluruh field', async () => {
    const res = await budi.post('/api/reports').send({ title: 'abc', category: 'x', priority: 'kritis' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({
      title: 'Judul minimal 5 karakter',
      location: 'Lokasi wajib diisi',
      description: 'Deskripsi wajib diisi',
      category: 'Kategori tidak valid',
      priority: 'Prioritas tidak valid',
    });
    const long = await budi.post('/api/reports').send({ ...validReport, description: 'x'.repeat(1001) });
    expect(long.body.errors.description).toBe('Deskripsi maksimal 1000 karakter');
  });

  it('menolak input berbahaya sebagai data biasa (query terparameter)', async () => {
    const title = "Uji'); DROP TABLE reports;--";
    const res = await budi.post('/api/reports').send({ ...validReport, title });
    expect(res.status).toBe(201);
    expect(res.body.data.report.title).toBe(title);
    const count = getDb().prepare('SELECT COUNT(*) AS n FROM reports').get().n;
    expect(count).toBe(5);
  });
});

describe('GET /api/reports', () => {
  it('mengembalikan daftar dengan pagination', async () => {
    const res = await budi.get('/api/reports?limit=2&page=2');
    expect(res.status).toBe(200);
    expect(res.body.data.reports).toHaveLength(2);
    expect(res.body.data.pagination).toEqual({ page: 2, limit: 2, total: 4, totalPages: 2 });
  });

  it('penghuni tidak melihat email/kamar penghuni lain', async () => {
    const res = await budi.get('/api/reports');
    const others = res.body.data.reports.filter((r) => r.reporter.name === 'Sari Lestari');
    const own = res.body.data.reports.filter((r) => r.reporter.name === 'Budi Santoso');
    expect(others.length).toBeGreaterThan(0);
    for (const r of others) {
      expect(r.reporter.email).toBeUndefined();
      expect(r.reporter.room).toBeUndefined();
      expect(r.permissions.canEdit).toBe(false);
      expect(r.permissions.canDelete).toBe(false);
    }
    expect(own[0].reporter.email).toBe(BUDI.email);
  });

  it('admin melihat informasi kontak pelapor', async () => {
    const res = await admin.get('/api/reports');
    expect(res.body.data.reports.every((r) => r.reporter.email)).toBe(true);
    expect(res.body.data.reports[0].permissions.canDelete).toBe(true);
  });

  it('filter mine, status, kategori, prioritas, dan pencarian', async () => {
    const mine = await budi.get('/api/reports?mine=true');
    expect(mine.body.data.reports.map((r) => r.id).sort()).toEqual([1, 3]);

    const status = await admin.get('/api/reports?status=menunggu');
    expect(status.body.data.reports.map((r) => r.id).sort()).toEqual([3, 4]);

    const cat = await admin.get('/api/reports?category=listrik');
    expect(cat.body.data.reports.map((r) => r.id)).toEqual([2]);

    const prio = await admin.get('/api/reports?priority=darurat');
    expect(prio.body.data.reports.map((r) => r.id)).toEqual([4]);

    const byTitle = await admin.get('/api/reports?q=lampu');
    expect(byTitle.body.data.reports.map((r) => r.id)).toEqual([2]);

    const byLocation = await admin.get(`/api/reports?q=${encodeURIComponent('Kamar A-101')}`);
    expect(byLocation.body.data.reports.map((r) => r.id)).toEqual([3]);
  });

  it('filter tanggal', async () => {
    getDb().prepare("UPDATE reports SET created_at = '2026-01-15T08:00:00.000Z' WHERE id = 1").run();
    const res = await admin.get('/api/reports?dateFrom=2026-01-01&dateTo=2026-01-31');
    expect(res.body.data.reports.map((r) => r.id)).toEqual([1]);
    const none = await admin.get('/api/reports?dateFrom=2099-01-01');
    expect(none.body.data.reports).toEqual([]);
    expect(none.body.data.pagination.totalPages).toBe(1);
  });

  it('pengurutan prioritas, terbaru, dan terlama', async () => {
    getDb().prepare("UPDATE reports SET created_at = '2026-01-0' || id || 'T00:00:00.000Z'").run();
    const prio = await admin.get('/api/reports?sort=priority');
    expect(prio.body.data.reports.map((r) => r.priority)).toEqual(['darurat', 'tinggi', 'sedang', 'rendah']);
    const newest = await admin.get('/api/reports?sort=newest');
    expect(newest.body.data.reports.map((r) => r.id)).toEqual([4, 3, 2, 1]);
    const oldest = await admin.get('/api/reports?sort=oldest');
    expect(oldest.body.data.reports.map((r) => r.id)).toEqual([1, 2, 3, 4]);
  });

  it('query tidak valid mengembalikan 400', async () => {
    const res = await admin.get(
      '/api/reports?status=x&category=y&priority=z&dateFrom=kemarin&dateTo=1/1/2026&sort=acak&page=0&limit=100',
    );
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(
      ['category', 'dateFrom', 'dateTo', 'limit', 'page', 'priority', 'sort', 'status'].sort(),
    );
  });
});

describe('GET /api/reports/:id', () => {
  it('mengembalikan detail dan riwayat status', async () => {
    const res = await budi.get('/api/reports/2');
    expect(res.status).toBe(200);
    const { report } = res.body.data;
    expect(report.history.map((h) => h.new_status)).toEqual(['menunggu', 'diproses', 'selesai']);
    expect(report.history[1]).toMatchObject({ changed_by_name: 'Admin Uji', changed_by_role: 'admin' });
    expect(report.reporter.email).toBeUndefined();
  });

  it('404 untuk laporan yang tidak ada dan 400 untuk id tidak valid', async () => {
    expect((await budi.get('/api/reports/999')).status).toBe(404);
    const bad = await budi.get('/api/reports/abc');
    expect(bad.status).toBe(400);
    expect(bad.body.message).toBe('ID laporan tidak valid');
  });
});

describe('PUT /api/reports/:id', () => {
  const changes = { ...validReport, title: 'Engsel lemari kamar patah total' };

  it('pemilik dapat mengubah laporan yang masih menunggu', async () => {
    const res = await budi.put('/api/reports/3').send({ ...changes, status: 'selesai' });
    expect(res.status).toBe(200);
    expect(res.body.data.report.title).toBe(changes.title);
    expect(res.body.data.report.status).toBe('menunggu');
  });

  it('penghuni lain tidak dapat mengubah (403)', async () => {
    const res = await sari.put('/api/reports/3').send(changes);
    expect(res.status).toBe(403);
  });

  it('laporan yang sudah diproses tidak dapat diubah (409)', async () => {
    const res = await budi.put('/api/reports/1').send(changes);
    expect(res.status).toBe(409);
  });

  it('admin tidak dapat mengubah isi laporan penghuni', async () => {
    const res = await admin.put('/api/reports/3').send(changes);
    expect(res.status).toBe(403);
  });

  it('404 dan 400', async () => {
    expect((await budi.put('/api/reports/999').send(changes)).status).toBe(404);
    expect((await budi.put('/api/reports/3').send({})).status).toBe(400);
  });
});

describe('DELETE /api/reports/:id', () => {
  it('pemilik dapat menghapus laporan menunggu, riwayat ikut terhapus', async () => {
    const res = await budi.delete('/api/reports/3');
    expect(res.status).toBe(200);
    expect((await budi.get('/api/reports/3')).status).toBe(404);
    const history = getDb().prepare('SELECT COUNT(*) AS n FROM report_history WHERE report_id = 3').get();
    expect(history.n).toBe(0);
  });

  it('penghuni lain tidak dapat menghapus (403)', async () => {
    expect((await sari.delete('/api/reports/3')).status).toBe(403);
  });

  it('pemilik tidak dapat menghapus laporan yang sudah diproses (409)', async () => {
    expect((await budi.delete('/api/reports/1')).status).toBe(409);
  });

  it('admin dapat menghapus laporan apa pun', async () => {
    expect((await admin.delete('/api/reports/2')).status).toBe(200);
  });

  it('404 untuk laporan yang tidak ada', async () => {
    expect((await admin.delete('/api/reports/999')).status).toBe(404);
  });
});

describe('PATCH /api/reports/:id/status', () => {
  it('admin mengubah status dan riwayat tercatat', async () => {
    const res = await admin.patch('/api/reports/3/status').send({ status: 'diproses', note: 'Dicek besok' });
    expect(res.status).toBe(200);
    const { report } = res.body.data;
    expect(report.status).toBe('diproses');
    expect(report.history.at(-1)).toMatchObject({
      old_status: 'menunggu',
      new_status: 'diproses',
      note: 'Dicek besok',
    });
    expect(report.permissions.nextStatuses).toEqual(['selesai', 'ditolak']);
  });

  it('penghuni tidak dapat mengubah status (403)', async () => {
    const res = await budi.patch('/api/reports/3/status').send({ status: 'selesai' });
    expect(res.status).toBe(403);
  });

  it('transisi tidak sah ditolak (409)', async () => {
    const skip = await admin.patch('/api/reports/3/status').send({ status: 'selesai' });
    expect(skip.status).toBe(409);
    const final = await admin.patch('/api/reports/2/status').send({ status: 'diproses' });
    expect(final.status).toBe(409);
  });

  it('penolakan wajib menyertakan alasan', async () => {
    const res = await admin.patch('/api/reports/3/status').send({ status: 'ditolak' });
    expect(res.status).toBe(400);
    expect(res.body.errors.note).toBe('Alasan penolakan wajib diisi');
    const ok = await admin.patch('/api/reports/3/status').send({ status: 'ditolak', note: 'Duplikat' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.report.permissions.canChangeStatus).toBe(false);
  });

  it('validasi status dan panjang catatan', async () => {
    const res = await admin.patch('/api/reports/3/status').send({ status: 'beres', note: 'x'.repeat(501) });
    expect(res.body.errors).toEqual({ status: 'Status tidak valid', note: 'Catatan maksimal 500 karakter' });
  });

  it('404 untuk laporan yang tidak ada', async () => {
    expect((await admin.patch('/api/reports/999/status').send({ status: 'diproses' })).status).toBe(404);
  });
});

describe('POST /api/reports/:id/notes', () => {
  it('admin menambahkan catatan tanpa mengubah status', async () => {
    const res = await admin.post('/api/reports/1/notes').send({ note: 'Suku cadang sedang dipesan' });
    expect(res.status).toBe(200);
    const last = res.body.data.report.history.at(-1);
    expect(last).toMatchObject({ old_status: 'diproses', new_status: 'diproses', note: 'Suku cadang sedang dipesan' });
  });

  it('penghuni tidak dapat menambah catatan admin', async () => {
    expect((await budi.post('/api/reports/1/notes').send({ note: 'Tolong cepat' })).status).toBe(403);
  });

  it('catatan wajib diisi', async () => {
    const res = await admin.post('/api/reports/1/notes').send({ note: ' ' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/reports/stats', () => {
  it('admin melihat statistik seluruh laporan dari database', async () => {
    const res = await admin.get('/api/reports/stats');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      scope: 'all',
      total: 4,
      byStatus: { menunggu: 2, diproses: 1, selesai: 1, ditolak: 0 },
    });
    expect(res.body.data.recent).toHaveLength(4);
    expect(res.body.data.byCategory).toHaveLength(4);
  });

  it('penghuni melihat statistik laporannya sendiri', async () => {
    await budi.post('/api/reports').send(validReport);
    const res = await budi.get('/api/reports/stats');
    expect(res.body.data).toMatchObject({
      scope: 'mine',
      total: 3,
      byStatus: { menunggu: 2, diproses: 1, selesai: 0, ditolak: 0 },
    });
  });
});

describe('kesalahan database', () => {
  it('kegagalan query saat membuat laporan mengembalikan 500 yang aman', async () => {
    const db = getDb();
    const original = db.prepare.bind(db);
    const spy = vi.spyOn(db, 'prepare').mockImplementation((sql) => {
      if (sql.startsWith('INSERT INTO reports')) throw new Error('SQLITE_FULL: database or disk is full');
      return original(sql);
    });
    const res = await budi.post('/api/reports').send(validReport);
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Terjadi kesalahan pada server, silakan coba lagi');
    expect(res.body.stack).toBeUndefined();
  });

  it('constraint CHECK di database menolak nilai di luar daftar', () => {
    expect(() =>
      getDb()
        .prepare(
          "INSERT INTO reports (title, category, location, description, priority, status, reporter_id) VALUES ('a','x','b','c','rendah','menunggu',1)",
        )
        .run(),
    ).toThrow(/CHECK constraint failed/);
  });
});
