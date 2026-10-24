// Uji integrasi terhadap back-end yang sudah di-deploy:
// login -> buat laporan -> ambil kembali laporan yang sama lewat API.
// Pemakaian:
//   API_URL=https://api-anda.s1if.cloud/api FRONTEND_URL=https://web-anda.s1if.cloud \
//   CHECK_EMAIL=budi@asramacare.test CHECK_PASSWORD=... node scripts/integration-check.js
const apiUrl = (process.env.API_URL || 'http://localhost:3000/api').replace(/\/$/, '');
const origin = process.env.FRONTEND_URL || 'http://localhost:5173';
const email = process.env.CHECK_EMAIL || 'budi@asramacare.test';
const password = process.env.CHECK_PASSWORD;

if (!password) {
  console.error('Isi CHECK_PASSWORD (password akun yang dipakai untuk uji).');
  process.exit(1);
}

async function call(method, path, { body, cookie } = {}) {
  const headers = { Accept: 'application/json', Origin: origin };
  if (body) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${apiUrl}${path}`, { method, headers, body: body && JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  return { res, json };
}

function check(condition, message) {
  if (!condition) {
    console.error(`GAGAL: ${message}`);
    process.exit(1);
  }
  console.log(`OK   : ${message}`);
}

const health = await call('GET', '/health');
check(health.res.ok, `GET /health -> ${health.res.status}`);

const login = await call('POST', '/auth/login', { body: { email, password } });
check(login.res.ok, `POST /auth/login -> ${login.res.status} ${login.json?.message ?? ''}`);
check(
  login.res.headers.get('access-control-allow-origin') === origin,
  `CORS mengizinkan origin front-end (${origin})`,
);
const cookie = (login.res.headers.get('set-cookie') || '').split(';')[0];
check(cookie.startsWith('asramacare_token='), 'cookie sesi diterima');

const title = `Uji integrasi ${new Date().toISOString()}`;
const created = await call('POST', '/reports', {
  cookie,
  body: {
    title,
    category: 'lainnya',
    location: 'Uji otomatis',
    description: 'Laporan dibuat oleh skrip uji integrasi.',
    priority: 'rendah',
  },
});
check(created.res.status === 201, `POST /reports -> ${created.res.status} ${created.json?.message ?? ''}`);
const id = created.json.data.report.id;

const fetched = await call('GET', `/reports/${id}`, { cookie });
check(fetched.res.ok && fetched.json.data.report.title === title, `GET /reports/${id} mengembalikan data yang sama`);
console.log('\nIntegrasi API berhasil: data tersimpan di database dan dapat diambil kembali.');
