const { razorpayClient, isPaymentEnabled, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = require("../config/razorpay");
const { verifySignature } = require("../utils/signatureVerification");
const { generateCustomId } = require("../utils/idGenerator");
const Transactions = require("../models/Transactions");
const Booking = require("../models/Bookings");
const Invoice = require("../models/Invoice");
const { sendInvoice } = require("../services/emailNotification");
const logger = require("../utils/logger");

/**
 * Create a Razorpay payment order
 * Does NOT save to DB, just returns order for frontend
 */
const createPayment = async (req, res) => {
  if (!isPaymentEnabled || !razorpayClient) {
    return res.status(503).json({ success: false, error: "Payment service unavailable" });
  }

  const { amount, currency } = req.sanitizedPaymentData;
  logger.info(`Creating Razorpay Order with amount: ${amount}, currency: ${currency}`);

  try {
    const options = {
      amount: Math.round(amount * 100),
      currency: currency,
      receipt: `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      payment_capture: 1,
    };

    logger.debug(`Razorpay Order Options: ${JSON.stringify(options)}`);

    const order = await razorpayClient.orders.create(options);
    logger.info(`Razorpay Order Created: ${order.id}`);

    return res.status(201).json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
        created_at: order.created_at
      },
      key_id: RAZORPAY_KEY_ID
    });

  } catch (error) {
    logger.error(`Create Order Error: ${error.message}`, { stack: error.stack });
    return res.status(500).json({ success: false, error: "Failed to create payment order" });
  }
};

/**
 * Verify payment signature AND Save Booking/Transaction details
 * Flow: Verify -> Save Transaction -> Save Booking -> Generate Invoice -> Should Send Email
 */
const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      // Additional details must be passed here since we didn't save them earlier
      personalDetails,
      paymentDetails, // { amount, currency, paymentType, gstNumber }
      userId
    } = req.body;

    // 1. Verify Signature
    const isValid = verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      RAZORPAY_KEY_SECRET
    );

    if (!isValid) {
      return res.status(400).json({ success: false, error: "Invalid signature" });
    }

    // Check if duplicate (optional but good practice)
    const existingBooking = await Booking.findOne({ razorpayOrderId: razorpay_order_id });
    if (existingBooking) {
      return res.status(200).json({ success: true, message: "Payment already processed", bookingId: existingBooking.customPaymentId });
    }
    // 2. Create Transaction Record
    const transaction = await Transactions.create({
      userId,
      personalDetails,
      amount: paymentDetails?.amount,
      currency: paymentDetails?.currency || "INR",
      paymentType: paymentDetails?.paymentType || "GENERAL",
      gstNumber: paymentDetails?.gstNumber,
      Id: generateCustomId("TR")
    });
    logger.info(`Transaction Created: ${transaction._id}`);

    // 3. Create Booking Record
    const customPaymentId = generateCustomId("PA");
    const booking = await Booking.create({
      transactionId: transaction._id,
      userId,
      amount: paymentDetails?.amount,
      currency: paymentDetails?.currency || "INR",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      status: "success",
      Id: customPaymentId
    });
    logger.info(`Booking Created: ${booking.Id}`);


    // 4. Generate Invoice
    const invoiceNumber = generateCustomId("IN");
    const invoice = await Invoice.create({
      userId,
      id: invoiceNumber,
      paymentId: booking._id,
      invoiceNumber,
      amount: booking.amount,
      items: [{
        description: transaction.paymentType,
        amount: booking.amount
      }]
    });
    logger.info(`Invoice Generated: ${invoice.invoiceNumber}`);

    // 5. Send Email
    try {
      if (personalDetails?.email) {
        await sendInvoice({
          to: personalDetails.email,
          name: personalDetails.name,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount,
          currency: booking.currency,
          items: invoice.items
        });
      }
    } catch (emailError) {
      logger.error(`Email sending failed: ${emailError.message}`);
    }

    return res.json({
      success: true,
      message: "Payment processed successfully",
      invoice_number: invoiceNumber,
      payment_id: customPaymentId,
      booking_id: booking._id
    });

  } catch (error) {
    logger.error(`Verify Payment/Save Error: ${error.message}`, { stack: error.stack });
    return res.status(500).json({ success: false, error: "Payment processing failed" });
  }
};

module.exports = { createPayment, verifyPayment };