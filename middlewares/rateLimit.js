const rateLimit = require("express-rate-limit");
const RedisStore = require("rate-limit-redis");
const Redis = require("ioredis");

// Create Redis client if REDIS_URL is provided
let redisClient;
if (process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL);
    redisClient.on('error', (err) => {
      console.warn('Redis rate limit validation error:', err.message);
      // Fallback behavior handles undefined client
    });
  } catch (error) {
    console.warn('Failed to initialize Redis for rate limiting:', error.message);
  }
}

/**
 * Rate limiting middleware factory
 * @param {Object} options - Rate limit options
 */
const createRateLimiter = (options = {}) => {
const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 1000000, // limit each IP to 1000000 requests per windowMs
    message = "Too many requests from this IP, please try again later.",
    keyGenerator, // Allow overriding, but default to undefined (library default)
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    standardHeaders = true,
    legacyHeaders = false
  } = options;

  const store = redisClient
    ? new RedisStore({
      client: redisClient,
      prefix: "rate_limit:"
    })  
    : undefined; // Use in-memory store if Redis not available

  const limiterOptions = {
    windowMs,
    max,
    message: typeof message === 'string' ? { success: false, error: message } : message,
    store,
    skipSuccessfulRequests,
    skipFailedRequests,
    standardHeaders,
    legacyHeaders,
    validate: {
      xForwardedForHeader: false,
      keyGeneratorIpFallback: false // Disable the strict IPv6 check for custom keyGenerators
    }
  };

  // Only add keyGenerator if explicitly provided in options
  if (keyGenerator) {
    limiterOptions.keyGenerator = keyGenerator;
  }

  return rateLimit(limiterOptions);
};

// Create specific limiters
const createPaymentLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many payment attempts. Please try again later."
});

const verifyPaymentLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many verification requests. Please try again later."
});

// Pre-configured rate limiters
const rateLimiters = {
  // Global API rate limiter
  apiLimiter: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 1000
  }),

  // Strict rate limiter for sensitive operations
  strictLimiter: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: "Too many attempts. Please try again in an hour."
  }),

  // Authentication rate limiter
  authLimiter: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many authentication attempts. Please try again later."
  }),

  // Registration rate limiter
  registrationLimiter: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: "Too many registration attempts from this IP. Please try again later."
  })
};

// Middleware to apply rate limiting based on endpoint
const rateLimitByEndpoint = (req, res, next) => {
  const endpoint = req.path;

  if (endpoint.includes("/register")) {
    return rateLimiters.registrationLimiter(req, res, next);
  }

  if (endpoint.includes("/login") || endpoint.includes("/forgot-password")) {
    return rateLimiters.authLimiter(req, res, next);
  }

  if (endpoint.includes("/reset-password") || endpoint.includes("/verify")) {
    return rateLimiters.strictLimiter(req, res, next);
  }

  // Apply global rate limiter for other endpoints
  return rateLimiters.apiLimiter(req, res, next);
};

// Attach properties to main export for destructuring
createRateLimiter.createPaymentLimiter = createPaymentLimiter;
createRateLimiter.verifyPaymentLimiter = verifyPaymentLimiter;
createRateLimiter.rateLimiters = rateLimiters;
createRateLimiter.rateLimitByEndpoint = rateLimitByEndpoint;

module.exports = createRateLimiter;
