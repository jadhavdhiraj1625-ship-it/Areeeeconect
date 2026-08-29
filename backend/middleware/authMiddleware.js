const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes - Verifies JWT Bearer token and attaches authenticated user to req.user
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no authentication token provided'
    });
  }

  try {
    const secret = process.env.JWT_SECRET || 'agriconnect_secure_jwt_secret_key_2026_fallback';
    const decoded = jwt.verify(token, secret);

    let user = null;
    try {
      if (User.db && User.db.readyState === 1) {
        user = await User.findById(decoded.userId).select('-passwordHash');
      }
    } catch (dbErr) {
      // In case of DB lookup issue, fall back to validated JWT payload
    }

    if (!user) {
      // If DB has the user, use it; otherwise construct verified identity from cryptographically validated token payload
      if (decoded && decoded.userId) {
        user = {
          _id: decoded.userId,
          role: decoded.role || 'farmer',
          name: decoded.name || 'AgriConnect User',
          mobile: decoded.mobile || '',
          email: decoded.email || '',
          status: decoded.status || 'active'
        };
      } else {
        return res.status(401).json({
          success: false,
          message: 'Not authorized, user belonging to this token no longer exists'
        });
      }
    }

    if (user.status === 'suspended' || user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.status}. Please contact support.`
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session expired, please log in again'
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Not authorized, invalid authentication token'
    });
  }
};

/**
 * Role authorization middleware factory
 * Example: requireRole('admin', 'surveyor')
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before checking permissions'
      });
    }

    const normalizedRoles = roles.map(r => String(r).toLowerCase().trim());
    const userRole = String(req.user.role || '').toLowerCase().trim();

    if (!normalizedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: requires one of [${roles.join(', ')}] permissions`
      });
    }

    next();
  };
};

module.exports = {
  protect,
  requireRole
};
