const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }

  try {
    const secret = process.env.JWT_SECRET || 'supersecretkey';
    const decoded = jwt.verify(token, secret);
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }

    if (req.user.deletionScheduled && req.user.scheduledDeletionDate && new Date(req.user.scheduledDeletionDate) > new Date()) {
      const allowedPaths = ['/recover-account', '/deletion-status', '/me'];
      const isAllowed = allowedPaths.some((p) => req.originalUrl && req.originalUrl.includes(p));
      if (!isAllowed) {
        return res.status(403).json({
          success: false,
          message: 'Account is scheduled for deletion. Please recover your account to regain access.',
          deletionScheduled: true,
          scheduledDeletionDate: req.user.scheduledDeletionDate,
          deletionReason: req.user.deletionReason,
        });
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }
};

// Soft Protect - load user if token exists, but don't block
exports.softProtect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next();
  }

  try {
    const secret = process.env.JWT_SECRET || 'supersecretkey';
    const decoded = jwt.verify(token, secret);
    req.user = await User.findById(decoded.id);
    next();
  } catch (err) {
    next();
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }
    next();
  };
};
