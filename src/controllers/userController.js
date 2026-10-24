import * as userService from '../services/userService.js';
import { success } from '../utils/response.js';
import { validatePasswordChange, validateProfile } from '../validators/userValidator.js';

export function getMe(req, res) {
  return success(res, 'Profil pengguna', { user: req.user });
}

export function updateMe(req, res) {
  const user = userService.updateProfile(req.user.id, validateProfile(req.body));
  return success(res, 'Profil berhasil diperbarui', { user });
}

export function changePassword(req, res) {
  userService.changePassword(req.user.id, validatePasswordChange(req.body));
  return success(res, 'Password berhasil diganti');
}

export function listUsers(req, res) {
  return success(res, 'Daftar pengguna', { users: userService.listUsers() });
}
