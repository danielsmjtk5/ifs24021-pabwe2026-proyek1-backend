export function success(res, message, data = null, statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}
