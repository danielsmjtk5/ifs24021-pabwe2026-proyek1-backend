import * as reportService from '../services/reportService.js';
import { success } from '../utils/response.js';
import {
  parseId,
  validateNote,
  validateReportInput,
  validateReportQuery,
  validateStatusChange,
} from '../validators/reportValidator.js';

export function list(req, res) {
  const result = reportService.listReports(validateReportQuery(req.query), req.user);
  return success(res, 'Daftar laporan', result);
}

export function stats(req, res) {
  return success(res, 'Statistik laporan', reportService.getStats(req.user));
}

export function detail(req, res) {
  const report = reportService.getReport(parseId(req.params.id), req.user);
  return success(res, 'Detail laporan', { report });
}

export function create(req, res) {
  const report = reportService.createReport(validateReportInput(req.body), req.user);
  return success(res, 'Laporan berhasil dibuat', { report }, 201);
}

export function update(req, res) {
  const id = parseId(req.params.id);
  const report = reportService.updateReport(id, validateReportInput(req.body), req.user);
  return success(res, 'Laporan berhasil diperbarui', { report });
}

export function remove(req, res) {
  reportService.deleteReport(parseId(req.params.id), req.user);
  return success(res, 'Laporan berhasil dihapus');
}

export function changeStatus(req, res) {
  const id = parseId(req.params.id);
  const report = reportService.changeStatus(id, validateStatusChange(req.body), req.user);
  return success(res, 'Status laporan berhasil diperbarui', { report });
}

export function addNote(req, res) {
  const id = parseId(req.params.id);
  const report = reportService.addNote(id, validateNote(req.body), req.user);
  return success(res, 'Catatan tindak lanjut ditambahkan', { report });
}
