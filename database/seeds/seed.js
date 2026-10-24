import 'dotenv/config';
import { closeDb, initDb, transaction } from '../../src/config/database.js';
import env from '../../src/config/env.js';
import { hashPassword } from '../../src/services/userService.js';

/**
 * Seed bersifat idempoten: akun yang emailnya sudah ada tidak diubah, dan
 * laporan demo hanya dibuat jika tabel laporan masih kosong.
 */
export async function seed(db, { demo = false, admin } = {}) {
  const ensureUser = async (user) => {
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(user.email);
    if (existing) return { id: existing.id, created: false };
    const info = await db
      .prepare('INSERT INTO users (name, email, room, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(user.name, user.email, user.room ?? null, hashPassword(user.password), user.role);
    return { id: info.lastInsertRowid, created: true };
  };

  const summary = { admin: await ensureUser({ ...admin, role: 'admin' }), residents: 0, reports: 0 };
  if (!demo) return summary;

  // Kredensial akun demo (hanya dipakai saat SEED_DEMO=true); dapat diganti lewat SEED_DEMO_PASSWORD.
  const demoLogin = process.env.SEED_DEMO_PASSWORD || 'Penghuni123';
  const residents = [];
  for (const r of [
    { name: 'Budi Santoso', email: 'budi@asramacare.test', room: 'A-101', password: demoLogin },
    { name: 'Sari Lestari', email: 'sari@asramacare.test', room: 'B-204', password: demoLogin },
  ]) {
    const result = await ensureUser({ ...r, role: 'penghuni' });
    if (result.created) summary.residents += 1;
    residents.push(result.id);
  }

  const { count } = await db.prepare('SELECT COUNT(*) AS count FROM reports').get();
  if (count > 0) return summary;

  const adminId = summary.admin.id;
  const demoReports = [
    {
      title: 'Keran wastafel kamar mandi bocor',
      category: 'air_sanitasi', location: 'Gedung A Lantai 1, Kamar Mandi Timur',
      description: 'Keran wastafel terus meneteskan air walaupun sudah ditutup rapat.',
      priority: 'sedang', reporter: residents[0], flow: ['diproses'],
    },
    {
      title: 'Lampu koridor lantai 2 mati',
      category: 'listrik', location: 'Gedung B Lantai 2, Koridor',
      description: 'Tiga lampu koridor mati sejak dua hari lalu sehingga koridor gelap pada malam hari.',
      priority: 'tinggi', reporter: residents[1], flow: ['diproses', 'selesai'],
    },
    {
      title: 'Engsel lemari kamar patah',
      category: 'kamar_furnitur', location: 'Gedung A Kamar A-101',
      description: 'Engsel pintu lemari bagian kanan patah sehingga pintu tidak bisa ditutup.',
      priority: 'rendah', reporter: residents[0], flow: [],
    },
    {
      title: 'Wi-Fi ruang belajar tidak bisa terhubung',
      category: 'internet', location: 'Ruang Belajar Bersama Gedung B',
      description: 'Perangkat tidak mendapatkan alamat IP saat terhubung ke Wi-Fi ruang belajar.',
      priority: 'darurat', reporter: residents[1], flow: [],
    },
  ];

  await transaction(db, async (tx) => {
    const insertReport = tx.prepare(
      `INSERT INTO reports (title, category, location, description, priority, status, reporter_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertHistory = tx.prepare(
      `INSERT INTO report_history (report_id, changed_by, old_status, new_status, note)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const r of demoReports) {
      const finalStatus = r.flow.at(-1) || 'menunggu';
      const { lastInsertRowid: id } = await insertReport.run(
        r.title, r.category, r.location, r.description, r.priority, finalStatus, r.reporter,
      );
      await insertHistory.run(id, r.reporter, null, 'menunggu', 'Laporan dibuat');
      let previous = 'menunggu';
      for (const status of r.flow) {
        const note = status === 'diproses' ? 'Teknisi asrama dijadwalkan memeriksa.' : 'Perbaikan telah selesai.';
        await insertHistory.run(id, adminId, previous, status, note);
        previous = status;
      }
      summary.reports += 1;
    }
  });

  return summary;
}

/**
 * Seed berdasarkan environment (ADMIN_EMAIL, ADMIN_PASSWORD, SEED_DEMO).
 * Mengembalikan null bila akun admin belum dikonfigurasi.
 */
export async function seedFromEnv(db) {
  const admin = {
    name: process.env.ADMIN_NAME || 'Admin Asrama',
    email: (process.env.ADMIN_EMAIL || '').toLowerCase(),
    password: process.env.ADMIN_PASSWORD || '',
  };
  if (!admin.email || admin.password.length < 8) return null;
  return seed(db, { demo: process.env.SEED_DEMO === 'true', admin });
}

/* c8 ignore start */
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await seedFromEnv(await initDb());
  if (!result) {
    console.error('ADMIN_EMAIL dan ADMIN_PASSWORD (min. 8 karakter) wajib diisi di .env');
    process.exit(1);
  }
  console.log(`Seed selesai pada ${env.databaseUrl}:`, {
    admin: result.admin.created ? 'dibuat' : 'sudah ada',
    penghuniBaru: result.residents,
    laporanDemo: result.reports,
  });
  closeDb();
}
/* c8 ignore stop */
