const rateLimit = require('express-rate-limit');

/**
 * General API Rate Limiter
 * Allows up to 1,500 requests per 15-minute window per IP (~100 req/min).
 * Generous enough for dynamic app browsing (feed scrolling, shorts, comments)
 * while mitigating automated DDoS, scraper bots, and resource exhaustion.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please slow down and try again shortly.',
  },
});

/**
 * Strict Rate Limiter for Authentication and Sensitive Endpoints
 * Limits login, registration, and credential attempts to 25 per 15 minutes per IP.
 * Defends against credential stuffing, password brute-forcing, and account enumeration.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});

/**
 * Sanitize an object recursively against NoSQL Injection.
 * Strips keys starting with '$' (Mongo query operators) or containing '.' (field traversal).
 * Express 5 compatible.
 */
function sanitizeInput(target) {
  if (!target || typeof target !== 'object') return target;
  if (Array.isArray(target)) {
    return target.map(sanitizeInput);
  }
  const clean = {};
  for (const [key, value] of Object.entries(target)) {
    if (!key.startsWith('$') && !key.includes('.')) {
      clean[key] = typeof value === 'object' ? sanitizeInput(value) : value;
    }
  }
  return clean;
}

/**
 * Express 5 compatible NoSQL Injection sanitization middleware.
 * Cleans req.body, req.params, and overrides req.query getter safely.
 */
const noSqlSanitizer = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeInput(req.body);
  }

  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeInput(req.params);
  }

  if (req.query && typeof req.query === 'object') {
    const cleanedQuery = sanitizeInput(req.query);
    try {
      Object.defineProperty(req, 'query', {
        value: cleanedQuery,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch (_) {
      // Fallback if property is non-configurable
    }
  }

  next();
};

module.exports = {
  apiLimiter,
  authLimiter,
  noSqlSanitizer,
};
