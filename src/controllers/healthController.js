import { getDb } from '../config/database.js';
import { success } from '../utils/response.js';

export function health(req, res) {
  getDb().prepare('SELECT 1').get();
  return success(res, 'AsramaCare API berjalan', {
    status: 'ok',
    database: 'ok',
    time: new Date().toISOString(),
  });
}
