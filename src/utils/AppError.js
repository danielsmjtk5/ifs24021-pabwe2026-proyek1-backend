export default class AppError extends Error {
  constructor(statusCode, message, errors) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
  }

  static badRequest(message, errors) {
    return new AppError(400, message, errors);
  }

  static unauthorized(message = 'Silakan login terlebih dahulu') {
    return new AppError(401, message);
  }

  static forbidden(message = 'Anda tidak memiliki akses untuk tindakan ini') {
    return new AppError(403, message);
  }

  static notFound(message = 'Data tidak ditemukan') {
    return new AppError(404, message);
  }

  static conflict(message) {
    return new AppError(409, message);
  }
}
