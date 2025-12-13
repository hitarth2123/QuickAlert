const rateLimit = require('express-rate-limit');

// General API rate limiter - 100 requests per minute per IP (as per spec)
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  },
});

// Strict rate limiter for authentication routes
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 login/register attempts per hour
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
  max: 20, // Limit each IP to 20 report creations per hour
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
  max: 50, // Limit each IP to 50 uploads per hour
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
  max: 30, // Limit each IP to 30 searches per minute
  message: {
    success: false,
    message: 'Too many search requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  },
});

// Rate limiter for alert broadcasts (admin only, but still limited)
const alertBroadcastLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 broadcast alerts per hour
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
    max: options.max || 100,
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
    max: options.max || 100,
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
