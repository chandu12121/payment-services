const { razorpayClient, isPaymentEnabled, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = require("../config/razorpay");
const PDFDocument = require('pdfkit');
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
      // Additional details from frontend
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

    // Check availability
    const existingBooking = await Booking.findOne({ razorpayOrderId: razorpay_order_id });
    if (existingBooking) {
      return res.status(200).json({ success: true, message: "Payment already processed", bookingId: existingBooking.Id });
    }

    // 2. Fetch detailed payment info from Razorpay
    let fullPaymentDetails = {};
    try {
      fullPaymentDetails = await razorpayClient.payments.fetch(razorpay_payment_id);
    } catch (err) {
      logger.warn(`Failed to fetch Razorpay details: ${err.message}`);
    }

    // 3. Create Transaction Record with RICH details
    const transactionId = generateCustomId("TR");
    let transaction;
    try {
      transaction = await Transactions.create({
        userId: req.user.userId,
        amount: Number(paymentDetails?.amount),
        currency: paymentDetails?.currency || "INR",
        paymentType: (paymentDetails?.paymentType || "general").toLowerCase(),
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        razorpaySignature: razorpay_signature,
        status: "success",
        transactionNumber: transactionId,
        Id: transactionId,
        method: fullPaymentDetails.method || "card",
        customer: {
          email: fullPaymentDetails.email || personalDetails?.email,
          contact: fullPaymentDetails.contact || personalDetails?.phone,
          name: personalDetails?.name
        },
        businessDetails: {
          gstNumber: paymentDetails?.gstNumber,
        },
        fee: fullPaymentDetails.fee,
        tax: fullPaymentDetails.tax,
        errorDescription: fullPaymentDetails.error_description
      });
      logger.info(`Transaction Created: ${transaction.Id}`);
    } catch (txnError) {
      logger.error(`Transaction Creation Failed: ${txnError.message}`, { error: txnError });
      throw txnError;
    }

    // 4. Create Booking Record
    const customPaymentId = generateCustomId("PA");
    let booking;
    try {
      booking = await Booking.create({
        transactionId: transaction._id,
        userId: req.user.userId,
        amount: Number(paymentDetails?.amount),
        currency: paymentDetails?.currency || "INR",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        status: "paid",
        paymentStatus: "paid",
        bookingType: (paymentDetails?.paymentType || "general").toLowerCase(),
        bookingNumber: customPaymentId,
        Id: customPaymentId,
        customerDetails: {
          name: personalDetails?.name || "Guest",
          email: personalDetails?.email || "guest@example.com",
          phone: personalDetails?.phone || "0000000000",
          address: {
            street: personalDetails?.address || "N/A"
          }
        },
        items: [{
          name: paymentDetails?.paymentType || "Service Payment",
          description: "Payment for " + (paymentDetails?.paymentType || "general"),
          quantity: 1,
          unitPrice: Number(paymentDetails?.amount),
          totalPrice: Number(paymentDetails?.amount)
        }]
      });
      logger.info(`Booking Created: ${booking.Id}`);
    } catch (bookingError) {
      logger.error(`Booking Creation Failed: ${bookingError.message}`, { error: bookingError });
      throw bookingError;
    }

    // 5. Generate Invoice
    const invoiceNumber = generateCustomId("IN");
    let invoice;
    try {
      const finalAmount = Number(paymentDetails?.amount);
      const invoiceData = {
        userId: req.user.userId,
        transactionId: transaction._id,
        bookingId: booking._id,
        invoiceNumber,
        customerDetails: {
          name: personalDetails?.name || "Guest User",
          email: personalDetails?.email || "guest@example.com",
          phone: personalDetails?.phone || "0000000000",
          billingAddress: {
            street: personalDetails?.address || "N/A"
          },
          taxId: paymentDetails?.gstNumber
        },
        amount: finalAmount,
        subtotal: finalAmount,
        taxAmount: 0,
        totalAmount: finalAmount,
        status: "paid",
        paymentStatus: "paid",
        items: [{
          description: transaction.paymentType || "Service Payment",
          amount: finalAmount,
          quantity: 1,
          unitPrice: finalAmount,
          taxAmount: 0,
          totalAmount: finalAmount
        }]
      };

      invoice = await Invoice.create(invoiceData);

      // Link invoice to booking (optional reference update)
      booking.invoiceId = invoice._id;
      await booking.save();
      logger.info(`Invoice Generated: ${invoice.invoiceNumber}`);
    } catch (invError) {
      logger.error(`Invoice Generation Failed: ${invError.message}`, { error: invError });
    }

    // 6. Send Email
    try {
      if (personalDetails?.email && invoice) {
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
      invoiceNumber: invoiceNumber,
      transactionId: transaction._id,
      bookingId: booking._id
    });

  } catch (error) {
    logger.error(`Verify Payment/Save Error: ${error.message}`, { stack: error.stack });
    return res.status(500).json({ success: false, error: "Payment processing failed" });
  }
};

const getUserTransactions = async (req, res) => {
  try {
    const transactions = await Transactions.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const refundPayment = async (req, res) => {
  try {
    const { paymentId, amount } = req.body;

    // Find booking
    let booking = await Booking.findOne({
      $or: [
        { razorpayPaymentId: paymentId },
        { Id: paymentId },
        { bookingNumber: paymentId }
      ],
      userId: req.user.userId
    });

    if (!booking) {
      logger.info(`Booking not found for ID: ${paymentId}, checking Transactions...`);
      // Fallback: Check Transactions
      const transaction = await Transactions.findOne({
        $or: [
          { razorpayPaymentId: paymentId },
          { Id: paymentId },
          { transactionNumber: paymentId }
        ],
        userId: req.user.userId
      });

      if (!transaction) {
        logger.warn(`Refund attempt failed: No record found for ID: ${paymentId}`);
        return res.status(404).json({ success: false, error: "Payment record not found or unauthorized" });
      }

      // If transaction found, use its details for refund
      // We'll create a "mock" booking object so the rest of the refund logic works
      booking = {
        razorpayPaymentId: transaction.razorpayPaymentId,
        amount: transaction.amount,
        status: transaction.status,
        transactionId: transaction._id,
        save: async () => { } // No-op save since it's not a real booking doc
      };
    }

    // Check if already refunded
    if (booking.status === 'refunded') {
      return res.status(400).json({ success: false, error: "Payment already refunded" });
    }

    // Check if payment status allows refund
    if (booking.status !== 'success' && booking.status !== 'paid') {
      return res.status(400).json({
        success: false,
        error: `Payment cannot be refunded. Current status: ${booking.status}`
      });
    }

    // Validate refund amount
    const refundAmount = amount ? Number(amount) : booking.amount;
    const bookingAmount = Number(booking.amount);

    // Convert to paise for Razorpay (5000 rupees = 500000 paise)
    const refundAmountInPaise = Math.round(refundAmount * 100);
    const bookingAmountInPaise = Math.round(bookingAmount * 100);

    if (refundAmountInPaise > bookingAmountInPaise) {
      return res.status(400).json({
        success: false,
        error: `Refund amount (₹${refundAmount}) exceeds original transaction amount (₹${bookingAmount})`
      });
    }

    // Optional: Fetch payment details from Razorpay
    try {
      const payment = await razorpayClient.payments.fetch(booking.razorpayPaymentId);
      logger.info(`Payment details from Razorpay:`, {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        amount_refunded: payment.amount_refunded,
        refund_status: payment.refund_status
      });

      // Check if payment is already refunded in Razorpay
      if (payment.refund_status === 'full' || payment.amount_refunded === payment.amount) {
        return res.status(400).json({
          success: false,
          error: "Payment already fully refunded in Razorpay"
        });
      }
    } catch (fetchError) {
      logger.warn(`Could not fetch payment from Razorpay: ${fetchError.message}`);
    }

    // Prepare refund options
    const refundOptions = {
      speed: "normal"
    };

    // Only specify amount if it's a partial refund
    if (amount && refundAmountInPaise < bookingAmountInPaise) {
      refundOptions.amount = refundAmountInPaise;
    }

    logger.info(`Initiating refund:`, {
      razorpayPaymentId: booking.razorpayPaymentId,
      amountInPaise: refundOptions.amount || 'full',
      amountInRupees: refundAmount
    });

    // Call Razorpay refund API
    const refund = await razorpayClient.payments.refund(
      booking.razorpayPaymentId,
      refundOptions
    );

    // Update booking
    booking.status = 'refunded';
    booking.refundId = refund.id;
    booking.refundAmount = refundAmount;
    booking.refundDate = new Date();
    await booking.save();

    // Update transaction
    await Transactions.updateOne(
      { _id: booking.transactionId },
      {
        status: 'refunded',
        refundId: refund.id,
        refundAmount: refundAmount,
        refundDate: new Date()
      }
    );

    logger.info(`Refund successful:`, {
      refundId: refund.id,
      paymentId: booking.razorpayPaymentId,
      amount: refundAmount
    });

    return res.status(200).json({
      success: true,
      message: "Refund initiated successfully",
      data: refund
    });

  } catch (error) {
    logger.error("Refund Error:", {
      message: error.message,
      error: error.error,
      statusCode: error.statusCode,
      paymentId: req.body.paymentId
    });

    // More specific error handling
    if (error.statusCode === 400 && error.error?.description?.includes('already been refunded')) {
      return res.status(400).json({
        success: false,
        error: "Payment has already been refunded"
      });
    }

    if (error.error?.code === 'BAD_REQUEST_ERROR') {
      return res.status(400).json({
        success: false,
        error: error.error.description || "Invalid refund request"
      });
    }

    return res.status(500).json({
      success: false,
      error: "Internal server error while processing refund"
    });
  }
};

module.exports = {
  createPayment,
  verifyPayment,
  getUserTransactions,
  refundPayment
};