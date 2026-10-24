import * as userService from '../services/userService.js';
import { success } from '../utils/response.js';
import { validatePasswordChange, validateProfile } from '../validators/userValidator.js';

export function getMe(req, res) {
  return success(res, 'Profil pengguna', { user: req.user });
}

export async function updateMe(req, res) {
  const user = await userService.updateProfile(req.user.id, validateProfile(req.body));
  return success(res, 'Profil berhasil diperbarui', { user });
}

export async function changePassword(req, res) {
  await userService.changePassword(req.user.id, validatePasswordChange(req.body));
  return success(res, 'Password berhasil diganti');
}

export async function listUsers(req, res) {
  return success(res, 'Daftar pengguna', { users: await userService.listUsers() });
}
