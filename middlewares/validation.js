const logger = require("../utils/logger");

const validatePaymentRequest = (req, res, next) => {
  const { amount, currency = 'INR' } = req.body;

  // Validate amount
  let numericAmount = 1;
  if (amount !== undefined && amount !== null) {
    numericAmount = Number(amount);
    if (isNaN(numericAmount) || !isFinite(numericAmount) || numericAmount <= 0) {
      const errorMsg = "Amount must be a valid number greater than 0";
      logger.warn(`Validation Failed: ${errorMsg}`, { body: req.body });
      return res.status(400).json({
        success: false,
        error: errorMsg
      });
    }
  } else {
    return res.status(400).json({ success: false, error: "Amount is required" });
  }

  // Validate currency
  const sanitizedCurrency = typeof currency === 'string' ? currency.trim().toUpperCase() : 'INR';
  const finalCurrency = ['INR', 'USD', 'EUR'].includes(sanitizedCurrency) ? sanitizedCurrency : 'INR';

  req.sanitizedPaymentData = {
    amount: numericAmount,
    currency: finalCurrency,
  };

  next();
};

const validateVerificationRequest = (req, res, next) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  } = req.body;

  const errors = [];

  if (!razorpay_order_id) errors.push("razorpay_order_id is required");
  if (!razorpay_payment_id) errors.push("razorpay_payment_id is required");
  if (!razorpay_signature) errors.push("razorpay_signature is required");

  // Validate payment details
  if (!req.body.paymentDetails || !req.body.paymentDetails.amount) {
    errors.push("paymentDetails with amount is required");
  }

  if (errors.length > 0) {
    logger.warn(`Validation Failed: ${errors.join(", ")}`, { body: req.body });
    return res.status(400).json({
      success: false,
      errors: errors
    });
  }

  next();
};

const Joi = require("joi");

/**
 * Request validation middleware
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} property - Request property to validate (body, query, params)
 */
const validate = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: property === "query" || property === "params"
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message.replace(/['"]/g, "")
      }));

      return res.status(400).json({
        success: false,
        error: "Validation failed",
        errors
      });
    }

    // Replace request data with validated and sanitized data
    req[property] = value;
    next();
  };
};

/**
 * File validation middleware
 */
const validateFile = (options = {}) => {
  const {
    allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/gif"],
    maxSize = 5 * 1024 * 1024, // 5MB
    required = false
  } = options;

  return (req, res, next) => {
    if (required && !req.file) {
      return res.status(400).json({
        success: false,
        error: "File is required"
      });
    }

    if (req.file) {
      // Check file type
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          error: `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`
        });
      }

      // Check file size
      if (req.file.size > maxSize) {
        return res.status(400).json({
          success: false,
          error: `File size exceeds ${maxSize / (1024 * 1024)}MB limit`
        });
      }
    }

    next();
  };
};


module.exports = {
  validatePaymentRequest,
  validateVerificationRequest,
  validate,
  validateFile
};