const express = require("express");
const router = express.Router();

// Import middlewares
const { createPaymentLimiter, verifyPaymentLimiter } = require("../middlewares/rateLimit");
const { validatePaymentRequest, validateVerificationRequest } = require("../middlewares/validation");

// Import controllers
const { createPayment, verifyPayment } = require("../controllers/payments");

// Import config for health check
const { isPaymentEnabled, NODE_ENV } = require("../config/razorpay");

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Payment service is operational",
    mode: NODE_ENV,
    payment_enabled: isPaymentEnabled,
    timestamp: new Date().toISOString()
  });
});

// Payment routes
router.post(
  "/create-order",
  createPaymentLimiter,
  validatePaymentRequest,
  createPayment
);

router.post(
  "/verify-payment",
  verifyPaymentLimiter,
  validateVerificationRequest,
  verifyPayment
);

module.exports = router;