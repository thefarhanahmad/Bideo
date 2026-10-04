const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

/**
 * Accurately extracts the real client IP address regardless of reverse proxy or CDN layer:
 * 1. Cloudflare header: 'cf-connecting-ip'
 * 2. Nginx real IP header: 'x-real-ip'
 * 3. Standard proxy header: 'x-forwarded-for' (client is the leftmost IP)
 * 4. Express req.ip / socket remote address fallback
 */
function getClientIp(req) {
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp && typeof cfIp === 'string') return cfIp.trim();

  const xRealIp = req.headers['x-real-ip'];
  if (xRealIp && typeof xRealIp === 'string') return xRealIp.trim();

  const xForwarded = req.headers['x-forwarded-for'];
  if (xForwarded && typeof xForwarded === 'string') {
    return xForwarded.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Generates an isolated rate-limiting key:
 * - For authenticated requests (Bearer token), isolates the quota to the individual user session.
 *   This ensures users on shared Wi-Fi, mobile carrier CGNAT (Jio/Airtel), or Cloudflare edge proxies
 *   never exhaust each other's quota or get blocked while chatting or browsing!
 * - For unauthenticated requests, standardizes and keys on the normalized client IP.
 */
function getClientIdentifier(req) {
  const clientIp = getClientIp(req);
  const normalizedIp = ipKeyGenerator ? ipKeyGenerator(clientIp) : clientIp;

  const authHeader = req.headers.authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token.length > 10) {
      return `auth_${token.slice(-16)}_${normalizedIp}`;
    }
  }

  return normalizedIp;
}

/**
 * General API Rate Limiter
 * Allows up to 10,000 requests per 15-minute window per client session (~667 req/min).
 * Generous enough for real-time chat, story trays, notifications, and fast short video scrolling
 * while still firmly mitigating automated DDoS, scraper bots, and server resource exhaustion.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIdentifier,
  validate: false,
  skip: (req) => req.method === 'OPTIONS',
  message: {
    success: false,
    message: 'Too many requests from this IP. Please slow down and try again shortly.',
  },
});

/**
 * Strict Rate Limiter for Authentication and Sensitive Endpoints
 * Limits login, registration, and credential attempts to 50 per 15 minutes per IP.
 * Defends against credential stuffing, password brute-forcing, and account enumeration.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    return ipKeyGenerator ? ipKeyGenerator(ip) : ip;
  },
  validate: false,
  skip: (req) => req.method === 'OPTIONS',
  message: {
    success: false,
    message: 'Too many failed authentication attempts. Please try again after 15 minutes.',
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
