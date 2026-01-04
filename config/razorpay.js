require('dotenv').config();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Fail fast in production
if (NODE_ENV === 'production') {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required in production');
  }
}

// Initialize Razorpay client
const Razorpay = require("razorpay");
let razorpayClient = null;
let isPaymentEnabled = false;

if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
  razorpayClient = new Razorpay({
    key_id: RAZORPAY_KEY_ID.trim(),
    key_secret: RAZORPAY_KEY_SECRET.trim(),
  });
  isPaymentEnabled = true;
  console.log(`Payment system initialized in ${NODE_ENV} mode`);
} else {
  console.warn('Razorpay keys not found. Payment system will not work.');
}

module.exports = {
  razorpayClient,
  isPaymentEnabled,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  NODE_ENV
};