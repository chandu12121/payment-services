const mongoose = require("mongoose");
const { razorpayClient, isPaymentEnabled, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = require("../config/razorpay");
const PDFDocument = require('pdfkit');
const { verifySignature } = require("../utils/signatureVerification");
const { generateCustomId } = require("../utils/idGenerator");
const Transactions = require("../models/Transactions");
const Booking = require("../models/Bookings");
const Invoice = require("../models/Invoice");
const { sendInvoice, sendRefundEmail } = require("../services/emailNotification");
const { notifyPaymentComplete, notifyRefundComplete } = require("../services/notificationService");
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

    // Check if this order has already been processed (Idempotency)
    const existingBooking = await Booking.findOne({ razorpayOrderId: razorpay_order_id }).populate('invoiceId');
    if (existingBooking) {
      logger.info(`Payment already processed for Order: ${razorpay_order_id}`);
      return res.status(200).json({
        success: true,
        message: "Payment already processed",
        bookingId: existingBooking.Id,
        invoiceNumber: existingBooking.invoiceId?.invoiceNumber
      });
    }

    // 2. Fetch detailed payment info from Razorpay
    let fullPaymentDetails = {};
    try {
      logger.info(`Fetching Razorpay details for payment: ${razorpay_payment_id}`);
      // Set a local timeout for the fetch to prevent hanging
      const fetchPromise = razorpayClient.payments.fetch(razorpay_payment_id);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Razorpay fetch timeout')), 5000)
      );
      fullPaymentDetails = await Promise.race([fetchPromise, timeoutPromise]);
      logger.debug(`Razorpay details fetched successfully`);
    } catch (err) {
      logger.warn(`Failed to fetch Razorpay details: ${err.message}. Proceeding with provided data.`);
    }

    // 3. Create Transaction Record
    const transactionId = generateCustomId("TR");
    let transaction;
    try {
      const derivedUserId = userId || req.user.userId;
      logger.info(`Creating transaction record for user: ${derivedUserId}`);

      transaction = await Transactions.create({
        userId: derivedUserId,
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
        fee: fullPaymentDetails.fee || 0,
        tax: fullPaymentDetails.tax || 0,
        errorDescription: fullPaymentDetails.error_description
      });
      logger.info(`Transaction Created Successfully: ${transaction.Id}`);
    } catch (txnError) {
      logger.error(`Transaction Creation Failed: ${txnError.message}`, { error: txnError });
      throw txnError;
    }

    // 4. Create Booking Record
    const customPaymentId = generateCustomId("PA");
    let booking;
    try {
      const derivedUserId = userId || req.user.userId;
      logger.info(`Creating booking record: ${customPaymentId}`);

      booking = await Booking.create({
        transactionId: transaction._id,
        userId: derivedUserId,
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
      logger.info(`Booking Created Successfully: ${booking.Id}`);
    } catch (bookingError) {
      logger.error(`Booking Creation Failed: ${bookingError.message}`, { error: bookingError });
      throw bookingError;
    }

    // 5. Generate Invoice
    const invoiceNumber = generateCustomId("IN");
    let invoice;
    try {
      const derivedUserId = userId || req.user.userId;
      const finalAmount = Number(paymentDetails?.amount);
      logger.info(`Generating invoice: ${invoiceNumber}`);

      const invoiceData = {
        userId: derivedUserId,
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
          description: (paymentDetails?.paymentType || "Service Payment").toUpperCase(),
          amount: finalAmount,
          quantity: 1,
          unitPrice: finalAmount,
          taxAmount: 0,
          totalAmount: finalAmount
        }]
      };

      invoice = await Invoice.create(invoiceData);

      // Link invoice to booking
      await Booking.findByIdAndUpdate(booking._id, { invoiceId: invoice._id });
      logger.info(`Invoice Generated and Linked: ${invoice.invoiceNumber}`);
    } catch (invError) {
      logger.error(`Invoice Generation Failed: ${invError.message}`, { error: invError });
    }

    // 6. Send Email with invoice PDF URL (non-blocking)
    if (personalDetails?.email && invoice) {
      logger.info(`Dispatching invoice email to: ${personalDetails.email}`);
      const invoicePdfUrl = `${process.env.API_URL || 'http://localhost:3000'}/api/invoices/${invoice._id}/download`;

      // Send Email asynchronously
      (async () => {
        try {
          await sendInvoice({
            to: personalDetails.email,
            name: personalDetails.name,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.amount,
            currency: booking.currency,
            items: invoice.items,
            pdfUrl: invoicePdfUrl,
            transactionDetails: {
              transactionId: transaction.transactionNumber,
              paymentDate: new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              }),
              paymentMethod: fullPaymentDetails.method || 'Card',
              status: 'SUCCESS'
            }
          });
        } catch (emailError) {
          logger.error(`Email sending background failure: ${emailError.message}`);
        }
      })();
    }

    // 7. Trigger Unified Multi-Channel Notifications (In-app + Email)
    if (invoice) {
      const derivedUserId = userId || req.user.userId;
      // Trigger notifications asynchronously
      (async () => {
        try {
          await notifyPaymentComplete(
            derivedUserId,
            {
              transactionId: transaction.transactionNumber,
              amount: invoice.totalAmount,
              currency: booking.currency,
              email: personalDetails.email,
              name: personalDetails.name,
              method: fullPaymentDetails.method || 'Card'
            },
            {
              invoiceNumber: invoice.invoiceNumber,
              invoiceId: invoice._id,
              items: invoice.items
            }
          );
        } catch (e) {
          logger.error(`Unified notification failed: ${e.message}`);
        }
      })();
    }

    logger.info(`VerifyPayment completed successfully for user: ${userId || req.user.userId}`);
    return res.json({
      success: true,
      message: "Payment processed successfully",
      invoiceNumber: invoiceNumber,
      transactionId: transaction._id,
      bookingId: booking._id
    });

  } catch (error) {
    logger.error(`Verify Payment CRITICAL ERROR: ${error.message}`, { stack: error.stack });

    // Trigger in-app notification for failure if user is available
    const derivedUserId = req.body.userId || req.user?.userId;
    if (derivedUserId && req.body.paymentDetails?.amount) {
      if (derivedUserId && req.body.paymentDetails?.amount) {
        try {
          await notifyPaymentFailed(derivedUserId, req.body.paymentDetails.amount, error.message);
        } catch (e) {
          logger.error(`Failure notification failed: ${e.message}`);
        }
      }
    }

    return res.status(500).json({
      success: false,
      error: "Payment processing failed. Details saved where possible.",
      details: error.message
    });
  }
};

const getUserTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, method, search, sortBy = 'newest' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { userId: req.user.userId };

    if (status && status !== 'all') query.status = status;
    if (method && method !== 'all') query.method = method;
    if (search) {
      query.$or = [
        { transactionNumber: { $regex: search, $options: 'i' } },
        { razorpayPaymentId: { $regex: search, $options: 'i' } },
        { 'customer.email': { $regex: search, $options: 'i' } },
        { 'customer.contact': { $regex: search, $options: 'i' } }
      ];
    }

    let sortOptions = { createdAt: -1 };
    if (sortBy === 'oldest') sortOptions = { createdAt: 1 };
    else if (sortBy === 'amount-high') sortOptions = { amount: -1 };
    else if (sortBy === 'amount-low') sortOptions = { amount: 1 };

    // Get paginated transactions and stats for ALL filtered data
    const [transactions, total, statsAgg] = await Promise.all([
      Transactions.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      Transactions.countDocuments(query),
      // Get stats for ALL filtered data (not just current page)
      Transactions.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            successCount: {
              $sum: { $cond: [{ $in: ['$status', ['success', 'captured']] }, 1, 0] }
            },
            failedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
            },
            refundedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, 1, 0] }
            }
          }
        },
        {
          $project: {
            totalAmount: { $divide: ['$totalAmount', 100] },
            successCount: 1,
            failedCount: 1,
            refundedCount: 1
          }
        }
      ])
    ]);

    // Extract stats from aggregation result
    const stats = statsAgg.length > 0 ? statsAgg[0] : {
      totalAmount: 0,
      successCount: 0,
      failedCount: 0,
      refundedCount: 0
    };

    return res.status(200).json({
      success: true,
      data: transactions,
      stats: {
        total,
        successful: stats.successCount,
        failed: stats.failedCount,
        refunded: stats.refundedCount,
        totalAmount: stats.totalAmount
      },
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
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

    // Trigger Unified Multi-Channel Notification for Refund
    try {
      await notifyRefundComplete(
        req.user.userId,
        {
          refundId: refund.id,
          amount: refundAmount,
          currency: booking.currency || "INR",
          transactionId: booking.razorpayPaymentId
        },
        booking.customerDetails?.email,
        booking.customerDetails?.name
      );
    } catch (e) {
      logger.error(`Unified refund notification failed: ${e.message}`);
    }

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

const getPaymentStats = async (req, res) => {
  try {
    const { timeRange = 'month' } = req.query;
    const userId = req.user.userId;

    // Set time boundary
    const now = new Date();
    let startDate = new Date();
    if (timeRange === 'week') startDate.setDate(now.getDate() - 7);
    else if (timeRange === 'month') startDate.setMonth(now.getMonth() - 1);
    else if (timeRange === 'year') startDate.setFullYear(now.getFullYear() - 1);
    else startDate.setMonth(now.getMonth() - 1); // Default to month

    const previousStartDate = new Date(startDate);
    if (timeRange === 'week') previousStartDate.setDate(startDate.getDate() - 7);
    else if (timeRange === 'month') previousStartDate.setMonth(startDate.getMonth() - 1);
    else if (timeRange === 'year') previousStartDate.setFullYear(startDate.getFullYear() - 1);

    // 1. Total Volume (Successful Transactions)
    const currentTransactions = await Transactions.find({
      userId,
      status: { $in: ['success', 'refunded'] },
      createdAt: { $gte: startDate }
    });

    const previousTransactions = await Transactions.find({
      userId,
      status: { $in: ['success', 'refunded'] },
      createdAt: { $gte: previousStartDate, $lt: startDate }
    });

    const totalVolume = currentTransactions.reduce((acc, t) => acc + Number(t.amount || 0), 0);
    const prevVolume = previousTransactions.reduce((acc, t) => acc + Number(t.amount || 0), 0);
    const volumeChange = prevVolume === 0 ? 100 : ((totalVolume - prevVolume) / prevVolume) * 100;

    // 2. Total Revenue (Paid Invoices)
    const currentInvoices = await Invoice.find({
      userId,
      status: 'paid',
      createdAt: { $gte: startDate }
    });

    const prevInvoices = await Invoice.find({
      userId,
      status: 'paid',
      createdAt: { $gte: previousStartDate, $lt: startDate }
    });

    const totalRevenue = currentInvoices.reduce((acc, i) => acc + Number(i.totalAmount || 0), 0);
    const prevRevenue = prevInvoices.reduce((acc, i) => acc + Number(i.totalAmount || 0), 0);
    const revenueChange = prevRevenue === 0 ? 100 : ((totalRevenue - prevRevenue) / prevRevenue) * 100;

    // 3. Pending Payments
    // 3. Pending Payments
    const totalPendingAmount = await Invoice.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'sent' } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);

    // Calculate Trend for Pending (New Pending vs Old Pending creation)
    const currentPending = await Invoice.find({
      userId,
      status: 'sent',
      createdAt: { $gte: startDate }
    });
    const prevPending = await Invoice.find({
      userId,
      status: 'sent',
      createdAt: { $gte: previousStartDate, $lt: startDate }
    });

    const currentPendingSum = currentPending.reduce((acc, i) => acc + Number(i.totalAmount || 0), 0);
    const prevPendingSum = prevPending.reduce((acc, i) => acc + Number(i.totalAmount || 0), 0);
    const pendingChange = prevPendingSum === 0 ? (currentPendingSum > 0 ? 100 : 0) : ((currentPendingSum - prevPendingSum) / prevPendingSum) * 100;

    // 4. Monthly Flow (Last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyDataRaw = await Transactions.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          status: { $in: ['success', 'refunded'] },
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          income: { $sum: "$amount" }
        }
      }
    ]);

    // Convert aggregation results (paise) to rupees
    const monthlyData = monthlyDataRaw.map(item => ({
      ...item,
      income: item.income / 100
    }));

    // 5. Category Breakdown
    const categoryDataRaw = await Transactions.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          status: { $in: ['success', 'refunded'] }
        }
      },
      {
        $group: {
          _id: "$paymentType",
          amount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      }
    ]);

    // Convert aggregation results (paise) to rupees
    const categoryData = categoryDataRaw.map(item => ({
      ...item,
      amount: item.amount / 100
    }));

    // 6. Total Refunded
    const refundedTransactions = await Transactions.find({
      userId,
      status: 'refunded',
      createdAt: { $gte: startDate }
    });

    const prevRefundedTransactions = await Transactions.find({
      userId,
      status: 'refunded',
      createdAt: { $gte: previousStartDate, $lt: startDate }
    });

    const totalRefunded = refundedTransactions.reduce((acc, t) => acc + Number(t.amount || 0), 0);
    const prevRefunded = prevRefundedTransactions.reduce((acc, t) => acc + Number(t.amount || 0), 0);
    const refundChange = prevRefunded === 0 ? (totalRefunded > 0 ? 100 : 0) : ((totalRefunded - prevRefunded) / prevRefunded) * 100;

    return res.status(200).json({
      success: true,
      data: {
        totalVolume,
        volumeChange: volumeChange.toFixed(1),
        totalRevenue,
        revenueChange: revenueChange.toFixed(1),
        pendingPayments: (totalPendingAmount[0]?.total || 0) / 100, // Convert aggregation results (paise) to rupees
        pendingChange: pendingChange.toFixed(1),
        totalRefunded, // New metric
        refundChange: refundChange.toFixed(1),
        totalTransactions: currentTransactions.length,
        transactionChange: currentTransactions.length - previousTransactions.length,
        monthlyFlow: monthlyData,
        categories: categoryData
      }
    });

  } catch (error) {
    logger.error(`Get Stats Error: ${error.stack}`);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch stats",
      details: error.message
    });
  }
};

module.exports = {
  createPayment,
  verifyPayment,
  getUserTransactions,
  refundPayment,
  getPaymentStats
};