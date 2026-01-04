const logger = require("../utils/logger");

const validatePaymentRequest = (req, res, next) => {
  const { amount, currency = 'INR', personalDetails } = req.body;

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

  // Validate personal details
  if (!personalDetails || !personalDetails.name || !personalDetails.email || !personalDetails.mobileNumber) {
    const errorMsg = "Personal details (name, email, mobileNumber) are required";
    logger.warn(`Validation Failed: ${errorMsg}`, { body: req.body });
    return res.status(400).json({
      success: false,
      error: errorMsg
    });
  }

  // Validate currency
  const sanitizedCurrency = typeof currency === 'string' ? currency.trim().toUpperCase() : 'INR';
  const finalCurrency = ['INR', 'USD', 'EUR'].includes(sanitizedCurrency) ? sanitizedCurrency : 'INR';

  req.sanitizedPaymentData = {
    amount: numericAmount,
    currency: finalCurrency,
    ...req.body // Pass through other fields like GST, paymentType
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

  // Validate personal details
  if (!req.body.personalDetails || !req.body.personalDetails.name || !req.body.personalDetails.email) {
    errors.push("personalDetails with name and email are required");
  }

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

module.exports = {
  validatePaymentRequest,
  validateVerificationRequest
};