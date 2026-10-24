import AppError from '../utils/AppError.js';

export function notFoundHandler(req, res, next) {
  next(AppError.notFound(`Endpoint ${req.method} ${req.originalUrl} tidak ditemukan`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    const body = { success: false, message: err.message };
    if (err.errors) body.errors = err.errors;
    return res.status(err.statusCode).json(body);
  }

  // Body JSON rusak dari express.json()
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Format JSON tidak valid' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Ukuran data terlalu besar' });
  }

  // Kesalahan lain (termasuk kesalahan database) dicatat di server saja.
  if (process.env.NODE_ENV !== 'test') console.error(err);
  return res
    .status(500)
    .json({ success: false, message: 'Terjadi kesalahan pada server, silakan coba lagi' });
}
