const rateLimit = require("express-rate-limit");

const createPaymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 payment attempts per IP
  message: {
    success: false,
    error: "Too many payment attempts. Please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyPaymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 verification attempts per IP
  message: {
    success: false,
    error: "Too many verification requests. Please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  createPaymentLimiter,
  verifyPaymentLimiter
};