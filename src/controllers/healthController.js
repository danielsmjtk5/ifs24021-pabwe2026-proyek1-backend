import { getDb } from '../config/database.js';
import { success } from '../utils/response.js';

export async function health(req, res) {
  await getDb().prepare('SELECT 1').get();
  return success(res, 'AsramaCare API berjalan', {
    status: 'ok',
    database: 'ok',
    time: new Date().toISOString(),
  });
}
