export const ROLES = ['penghuni', 'admin'];

export const CATEGORIES = [
  'air_sanitasi',
  'listrik',
  'kamar_furnitur',
  'fasilitas_umum',
  'internet',
  'lainnya',
];

export const PRIORITIES = ['rendah', 'sedang', 'tinggi', 'darurat'];

export const STATUSES = ['menunggu', 'diproses', 'selesai', 'ditolak'];

/** Status berikutnya yang boleh dipilih admin dari status saat ini. */
export const STATUS_TRANSITIONS = {
  menunggu: ['diproses', 'ditolak'],
  diproses: ['selesai', 'ditolak'],
  selesai: [],
  ditolak: [],
};

/** Penghuni hanya boleh mengubah/menghapus laporan selama masih menunggu. */
export const EDITABLE_STATUS = 'menunggu';
