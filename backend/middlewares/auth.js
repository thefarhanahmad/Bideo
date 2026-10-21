const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Admin accounts sign in only through /api/admin/login, which issues a token
// signed with ADMIN_JWT_SECRET. App tokens never grant access to an admin account.
const decodeToken = (token) => {
  try {
    return { decoded: jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey'), isAdminToken: false };
  } catch (appErr) {
    if (!process.env.ADMIN_JWT_SECRET) throw appErr;
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    if (decoded.scope !== 'admin') throw appErr;
    return { decoded, isAdminToken: true };
  }
};
exports.decodeToken = decodeToken;

// True when the token type matches the account: admin accounts need an admin
// token, and admin tokens are only valid for admin accounts.
const tokenFitsUser = (user, isAdminToken) => (user.role === 'admin') === isAdminToken;
exports.tokenFitsUser = tokenFitsUser;

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
    const { decoded, isAdminToken } = decodeToken(token);
    req.user = await User.findById(decoded.id);
    req.isAdminToken = isAdminToken;

    if (!req.user || !tokenFitsUser(req.user, isAdminToken)) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }

    if (req.user.isBlocked) {
      const allowedPaths = ['/me'];
      const isAllowed = allowedPaths.some((p) => req.originalUrl && req.originalUrl.includes(p));
      if (!isAllowed) {
        return res.status(403).json({
          success: false,
          message: req.user.blockReason || 'Your account has been suspended by an administrator.',
          isBlocked: true,
        });
      }
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
    const { decoded, isAdminToken } = decodeToken(token);
    const user = await User.findById(decoded.id);
    if (user && tokenFitsUser(user, isAdminToken)) {
      req.user = user;
      req.isAdminToken = isAdminToken;
    }
    next();
  } catch (err) {
    next();
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role) || (req.user.role === 'admin' && !req.isAdminToken)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }
    next();
  };
};
