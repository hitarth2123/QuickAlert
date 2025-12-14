const rateLimit = require('express-rate-limit');

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

// General API rate limiter - 500 requests per minute per IP (increased for development)
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDevelopment ? 1000000 : 500, // Higher limit in development
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: () => isDevelopment, // Skip rate limiting in development
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  },
});

// Strict rate limiter for authentication routes
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // Limit each IP to 10 login/register attempts per hour
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after an hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  },
});

// Rate limiter for password reset
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again after an hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  },
});

// Rate limiter for report creation
const reportCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 2000, // Limit each IP to 20 report creations per hour
  message: {
    success: false,
    message: 'Too many reports submitted, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  },
});

// Rate limiter for file uploads
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10150, // Limit each IP to 50 uploads per hour
  message: {
    success: false,
    message: 'Too many file uploads, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  },
});

// Rate limiter for search/query routes
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDevelopment ? 50000 : 60, // Much higher limit in development, 60/min in production
  message: {
    success: false,
    message: 'Too many search requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevelopment, // Skip rate limiting in development
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  },
});

// Rate limiter for alert broadcasts (admin only, but still limited)
const alertBroadcastLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // Limit each IP to 10 broadcast alerts per hour
  message: {
    success: false,
    message: 'Too many alert broadcasts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  },
});

// Custom rate limiter factory for specific routes
const createCustomLimiter = (options) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 100000,
    message: {
      success: false,
      message: options.message || 'Too many requests, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator || ((req) => req.ip),
    skip: options.skip || (() => false),
    handler: (req, res, next, opts) => {
      res.status(429).json(opts.message);
    },
  });
};

// User-based rate limiter (uses user ID instead of IP)
const userBasedLimiter = (options) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 10000,
    message: {
      success: false,
      message: options.message || 'Too many requests, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.user ? req.user._id.toString() : req.ip;
    },
    handler: (req, res, next, opts) => {
      res.status(429).json(opts.message);
    },
  });
};

module.exports = {
  generalLimiter,
  authLimiter,
  passwordResetLimiter,
  reportCreationLimiter,
  uploadLimiter,
  searchLimiter,
  alertBroadcastLimiter,
  createCustomLimiter,
  userBasedLimiter,
};
