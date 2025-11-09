const rateLimit = require('express-rate-limit');

const isDevelopment = process.env.NODE_ENV !== 'production';
const noopMiddleware = (_req, _res, next) => next();
const createLimiter = (options) =>
  isDevelopment ? noopMiddleware : rateLimit(options);

/**
 * General API Rate Limiter
 * Limits requests per IP to prevent abuse
 */
const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Strict Rate Limiter for Authentication endpoints
 */
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: {
    success: false,
    message: 'Too many login attempts, please try again after 15 minutes.'
  },
  skipSuccessfulRequests: true, // Don't count successful requests
});

/**
 * Strict Rate Limiter for Write Operations
 */
const writeLimiter = createLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 write requests per minute
  message: {
    success: false,
    message: 'Too many write requests, please slow down.'
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  writeLimiter
};

