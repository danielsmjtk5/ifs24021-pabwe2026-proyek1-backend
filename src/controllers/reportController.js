import * as reportService from '../services/reportService.js';
import { success } from '../utils/response.js';
import {
  parseId,
  validateNote,
  validateReportInput,
  validateReportQuery,
  validateStatusChange,
} from '../validators/reportValidator.js';

export async function list(req, res) {
  const result = await reportService.listReports(validateReportQuery(req.query), req.user);
  return success(res, 'Daftar laporan', result);
}

export async function stats(req, res) {
  return success(res, 'Statistik laporan', await reportService.getStats(req.user));
}

export async function detail(req, res) {
  const report = await reportService.getReport(parseId(req.params.id), req.user);
  return success(res, 'Detail laporan', { report });
}

export async function create(req, res) {
  const report = await reportService.createReport(validateReportInput(req.body), req.user);
  return success(res, 'Laporan berhasil dibuat', { report }, 201);
}

export async function update(req, res) {
  const id = parseId(req.params.id);
  const report = await reportService.updateReport(id, validateReportInput(req.body), req.user);
  return success(res, 'Laporan berhasil diperbarui', { report });
}

export async function remove(req, res) {
  await reportService.deleteReport(parseId(req.params.id), req.user);
  return success(res, 'Laporan berhasil dihapus');
}

export async function changeStatus(req, res) {
  const id = parseId(req.params.id);
  const report = await reportService.changeStatus(id, validateStatusChange(req.body), req.user);
  return success(res, 'Status laporan berhasil diperbarui', { report });
}

export async function addNote(req, res) {
  const id = parseId(req.params.id);
  const report = await reportService.addNote(id, validateNote(req.body), req.user);
  return success(res, 'Catatan tindak lanjut ditambahkan', { report });
}
