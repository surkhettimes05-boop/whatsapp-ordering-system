const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('🔐 authenticate called - authHeader present:', !!authHeader);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔐 token decoded:', decoded && decoded.userId ? decoded.userId : 'no-id');

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, phoneNumber: true, name: true, role: true }
    });

    if (!user) return res.status(401).json({ success: false, error: 'User invalid' });

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Auth failed' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(403).json({ success: false, error: 'Admin access required' });
  }
};

const authorize = (requiredRole) => {
  return (req, res, next) => {
    if (req.user && req.user.role === requiredRole) {
      next();
    } else {
      res.status(403).json({ success: false, error: `${requiredRole} access required` });
    }
  };
};

module.exports = { authenticate, isAdmin, authorize };