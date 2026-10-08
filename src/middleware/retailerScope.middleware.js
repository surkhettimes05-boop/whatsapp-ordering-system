module.exports = async function retailerScope(req, res, next) {
  if (req.user?.role === 'ADMIN') return next();
  // No password-only API account can claim ownership of a WhatsApp phone number.
  return res.status(403).json({ error: 'These operational endpoints require an administrator. Customers use WhatsApp.' });
};
