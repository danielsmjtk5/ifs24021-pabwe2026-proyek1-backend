# AsramaCare — Back-end

REST API AsramaCare (Express.js + SQLite) untuk front-end AsramaCare yang berada di repository terpisah
(`ifs24021-pabwe2026-proyek1`). API memvalidasi data, memprosesnya, dan menyimpannya ke SQLite.

## Menjalankan di lokal

```bash
git clone <url-repo-back-end>
cd ifs24021-pabwe2026-proyek1-backend
bun install            # atau npm install
cp .env.example .env
bun run seed           # migrasi + akun admin + data demo (idempoten)
bun run dev            # http://localhost:3000/api
```

## Environment penting

| Variabel | Keterangan |
| --- | --- |
| `JWT_SECRET` | Wajib di produksi, minimal 32 karakter acak. |
| `FRONTEND_URL` | URL front-end yang di-deploy. Dipakai sebagai default `CORS_ORIGIN` dan cookie `Secure`. |
| `CORS_ORIGIN` | Origin front-end yang diizinkan (pisahkan dengan koma). |
| `COOKIE_SAMESITE` / `COOKIE_SECURE` | `lax` cukup bila front-end dan back-end satu domain induk (mis. `*.s1if.cloud`). Domain berbeda: `none` + `true`. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Akun admin awal yang dibuat seed. |
| `DB_PATH` | Lokasi file SQLite. |

Lihat `.env.example` untuk daftar lengkap.

## Script

| Script | Fungsi |
| --- | --- |
| `bun run start` | Produksi: migrasi + seed, lalu menjalankan server (`scripts/start.js`) |
| `bun run dev` | Server development dengan auto-restart |
| `bun run seed` / `bun run migrate` | Seed / migrasi database |
| `bun run test` / `bun run test:coverage` | Pengujian Vitest + Supertest (coverage di `coverage/lcov.info`) |
| `bun run check:integration` | Uji integrasi ke API yang sudah di-deploy: login → buat laporan → ambil kembali |

Contoh uji integrasi ke server deploy:

```bash
API_URL=https://ifs24021-pabwe2026-proyek1-backend.s1if.cloud/api \
FRONTEND_URL=https://ifs24021-pabwe2026-proyek1.s1if.cloud \
CHECK_EMAIL=budi@asramacare.test CHECK_PASSWORD=<password> bun run check:integration
```

## Arsitektur

`routes` → `middlewares` (authenticate/authorize) → `controllers` → `validators` → `services` → SQLite.

- `src/config/database.js` membuka koneksi SQLite lewat modul bawaan `node:sqlite` (`DatabaseSync`, tanpa kompilasi native), mengaktifkan `foreign_keys` dan WAL,
  lalu menjalankan migrasi yang belum tercatat di `schema_migrations`.
- Semua query memakai prepared statement dengan parameter (tidak ada penggabungan string input).
- `src/middlewares/errorHandler.js` mengubah `AppError` menjadi respons JSON, dan menyembunyikan
  detail kesalahan lain (termasuk error database) di balik pesan 500 yang umum.
- Field `status`, `reporter_id`, `id`, dan timestamp tidak pernah dibaca dari body request laporan.

## Pengujian

`tests/setup.js` membuat database SQLite in-memory baru sebelum setiap test, sehingga pengujian
tidak menyentuh `data/asramacare.db`. Cakupan: health, login/registrasi/sesi, validasi input,
CRUD laporan, transisi status, catatan, pembatasan role, akses laporan milik orang lain, privasi
kontak pelapor, 404, simulasi kegagalan database, migrasi/seed idempoten, konfigurasi environment,
dan penyajian build front-end.

## Database SQLite

- File database: `data/asramacare.db` (diatur lewat `DB_PATH`).
- Migrasi (`database/migrations/*.sql`) dijalankan otomatis saat server/seed membuka database dan
  dicatat di tabel `schema_migrations`, sehingga aman dijalankan berulang.
- `npm run migrate` hanya menjalankan migrasi; `npm run seed` menjalankan migrasi + seed (idempoten).
- Reset database lokal: hentikan server, hapus `data/asramacare.db*`, lalu `npm run seed`.

Skema: `users`, `reports`, `report_history` dengan foreign key (`ON DELETE CASCADE`),
constraint `CHECK` untuk role/kategori/prioritas/status, dan indeks pada `reporter_id`, `status`,
`created_at`, dan `report_history.report_id`.

## Strategi autentikasi

- Password di-hash dengan **bcrypt** (10 salt rounds); hash tidak pernah dikirim ke klien.
- Setelah login, server mengirim **JWT di cookie `httpOnly`** (`SameSite=Lax`, `Secure` di produksi).
  JavaScript di browser tidak dapat membaca token, sehingga token tidak tersimpan di `localStorage`
  dan lebih tahan terhadap pencurian lewat XSS.
- Front-end memanggil `GET /api/auth/me` saat aplikasi dibuka untuk memulihkan sesi.
- **Logout** menghapus cookie di server (`POST /api/auth/logout`). Token bersifat stateless dan
  kedaluwarsa otomatis sesuai `JWT_EXPIRES_IN`.
- Middleware `authenticate` mengambil ulang data pengguna dari database di setiap request, sehingga
  akun yang dihapus langsung kehilangan akses. Middleware `authorize('admin')` membatasi endpoint admin.
- Respons 401 dari endpoint terlindungi memicu status "sesi berakhir" di front-end dan mengarahkan ke
  halaman login dengan pesan.
- Login dibatasi 20 percobaan / 15 menit per IP (`express-rate-limit`). Pesan gagal login sama untuk
  email salah maupun password salah.

## REST API

Semua respons berbentuk `{ "success": boolean, "message": string, "data"?: object, "errors"?: object }`.

| Method | Endpoint | Akses | Keterangan |
| --- | --- | --- | --- |
| GET | `/api/health` | publik | Status API dan database |
| POST | `/api/auth/register` | publik | Registrasi penghuni |
| POST | `/api/auth/login` | publik | Login, memasang cookie sesi |
| POST | `/api/auth/logout` | publik | Menghapus cookie sesi |
| GET | `/api/auth/me` | login | Pengguna aktif |
| GET | `/api/users/me` | login | Profil |
| PUT | `/api/users/me` | login | Ubah nama/kamar |
| PUT | `/api/users/me/password` | login | Ganti password |
| GET | `/api/users` | admin | Daftar pengguna + jumlah laporan |
| GET | `/api/reports` | login | Daftar laporan. Query: `q`, `category`, `priority`, `status`, `dateFrom`, `dateTo` (YYYY-MM-DD), `sort` (`newest`/`oldest`/`priority`), `mine=true`, `page`, `limit` (≤50) |
| GET | `/api/reports/stats` | login | Statistik (admin: semua, penghuni: miliknya) |
| POST | `/api/reports` | login | Buat laporan (status selalu `menunggu`, pelapor = pengguna aktif) |
| GET | `/api/reports/:id` | login | Detail + riwayat |
| PUT | `/api/reports/:id` | pemilik | Ubah laporan selama `menunggu` |
| DELETE | `/api/reports/:id` | pemilik/admin | Pemilik hanya saat `menunggu`, admin kapan saja |
| PATCH | `/api/reports/:id/status` | admin | `{ status, note }` sesuai aturan transisi |
| POST | `/api/reports/:id/notes` | admin | `{ note }` catatan tindak lanjut |

Kode status: 200, 201, 400 (validasi), 401, 403, 404, 409 (konflik/transisi tidak sah), 413, 500.
Detail kesalahan internal hanya dicatat di log server, tidak dikirim ke klien.

Contoh:

```bash
curl -c cookie.txt -H "Content-Type: application/json" \
  -d '{"email":"budi@asramacare.test","password":"Penghuni123"}' \
  http://localhost:3000/api/auth/login
curl -b cookie.txt "http://localhost:3000/api/reports?status=menunggu&sort=priority"
```

