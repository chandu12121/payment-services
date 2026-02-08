const Notification = require("../models/Notification");
const { sendInvoice, sendRefundEmail } = require("./emailNotification");
const { sendNotification } = require("../config/socket");
const logger = require("../utils/logger");

/**
 * Advanced Notification Service - Handles both in-app and email notifications
 * Coordinates multi-channel notification delivery
 */

/**
 * Send unified payment success notification with invoice
 * Sends: In-app notification + Email with downloadable invoice
 */
const notifyPaymentComplete = async (userId, paymentData, invoiceData) => {
  try {
    const { transactionId, amount, currency } = paymentData;
    const { invoiceNumber, invoiceId, items } = invoiceData;

    // Generate invoice download URL from environment
    const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 7000}`;
    const invoicePdfUrl = `${serverUrl}/api/invoices/${invoiceId}/download`;

    // 1. Create In-App Notification with rich formatting
    const inAppNotification = await Notification.create({
      user: userId,
      type: 'PAYMENT_SUCCESS',
      title: '✅ Payment Confirmed!',
      message: `Your payment of ${currency} ${amount.toLocaleString()} has been completed successfully. Invoice #${invoiceNumber} is ready to download.`,
      priority: 'HIGH',
      channels: ['IN_APP', 'EMAIL'],
      status: 'DELIVERED',
      sentAt: new Date(),
      metadata: {
        transactionId,
        amount,
        currency,
        invoiceNumber,
        invoiceId,
        downloadUrl: invoicePdfUrl
      },
      action: {
        type: 'ROUTE',
        target: '/invoices',
        label: 'View Invoice'
      }
    });

    // Emit real-time in-app notification
    await sendNotification(userId, inAppNotification);
    logger.info(`In-app notification sent for payment: ${transactionId}`);

    // 2. Send Email with downloadable invoice
    try {
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      await sendInvoice({
        to: paymentData.email,
        name: paymentData.name,
        invoiceNumber: invoiceNumber,
        amount: amount,
        currency: currency,
        items: items || [],
        pdfUrl: invoicePdfUrl,
        clientUrl: clientUrl,
        transactionDetails: {
          transactionId,
          paymentDate: new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          }),
          paymentMethod: paymentData.method || 'Card',
          status: 'SUCCESS'
        }
      });
      logger.info(`Invoice email sent to: ${paymentData.email}`);
    } catch (err) {
      logger.error(`Failed to send invoice email: ${err.message}`);
      // Update notification status (best effort)
      try {
        await Notification.updateOne(
          { _id: inAppNotification._id },
          { $set: { status: 'SENT' } }
        );
      } catch (e) {
        logger.error(`Failed to update notification: ${e.message}`);
      }
    }

    return inAppNotification;

  } catch (error) {
    logger.error(`Error in notifyPaymentComplete: ${error.message}`);
    throw error;
  }
};

/**
 * Send unified refund notification
 */
const notifyRefundComplete = async (userId, refundData, userEmail, userName) => {
  try {
    const { refundId, amount, currency, transactionId } = refundData;

    // 1. Create In-App Notification
    const inAppNotification = await Notification.create({
      user: userId,
      type: 'REFUND_SUCCESS',
      title: '💰 Refund Processed Successfully!',
      message: `Your refund of ${currency} ${amount.toLocaleString()} has been processed and will reflect in your account within 3-5 business days.`,
      priority: 'HIGH',
      channels: ['IN_APP', 'EMAIL'],
      status: 'DELIVERED',
      sentAt: new Date(),
      metadata: {
        refundId,
        amount,
        currency,
        transactionId,
        refundDate: new Date()
      },
      action: {
        type: 'ROUTE',
        target: '/transactions',
        label: 'View Details'
      }
    });

    // Emit in-app notification
    await sendNotification(userId, inAppNotification);
    logger.info(`In-app notification sent for refund: ${refundId}`);

    // 2. Send Email notification
    try {
      await sendRefundEmail({
        email: userEmail,
        name: userName,
        refundId,
        amount,
        currency
      });
      logger.info(`Refund email sent to: ${userEmail}`);
    } catch (err) {
      logger.error(`Failed to send refund email: ${err.message}`);
    }

    return inAppNotification;

  } catch (error) {
    logger.error(`Error in notifyRefundComplete: ${error.message}`);
    throw error;
  }
};

/**
 * Send multi-channel welcome notification
 */
const notifyWelcomeUser = async (userId, userData) => {
  try {
    const { name, email } = userData;

    // In-App notification
    const inAppNotification = await Notification.create({
      user: userId,
      type: 'WELCOME',
      title: '🎉 Welcome to PayFlow Pro!',
      message: `Hi ${name}, we're thrilled to have you on board! Your account is ready to use. Start exploring your dashboard to manage payments and invoices effortlessly.`,
      priority: 'HIGH',
      channels: ['IN_APP', 'EMAIL'],
      status: 'DELIVERED',
      sentAt: new Date(),
      metadata: {
        userName: name,
        userEmail: email
      },
      action: {
        type: 'ROUTE',
        target: '/',
        label: 'Go to Dashboard'
      }
    });

    await sendNotification(userId, inAppNotification);
    logger.info(`Welcome notification sent to: ${name}`);

    return inAppNotification;

  } catch (error) {
    logger.error(`Error in notifyWelcomeUser: ${error.message}`);
    throw error;
  }
};

/**
 * Send general multi-channel notification
 */
const sendMultiChannelNotification = async (userId, notificationData) => {
  try {
    const {
      title,
      message,
      type = 'INFO',
      priority = 'MEDIUM',
      channels = ['IN_APP'],
      metadata = {},
      action = { type: 'NONE' }
    } = notificationData;

    const notification = await Notification.create({
      user: userId,
      type: type.toUpperCase(),
      title,
      message,
      priority,
      channels,
      status: 'DELIVERED',
      sentAt: new Date(),
      metadata,
      action
    });

    // Emit in-app notification
    if (channels.includes('IN_APP')) {
      await sendNotification(userId, notification);
    }

    return notification;

  } catch (error) {
    logger.error(`Error in sendMultiChannelNotification: ${error.message}`);
    throw error;
  }
};

module.exports = {
  notifyPaymentComplete,
  notifyRefundComplete,
  notifyWelcomeUser,
  sendMultiChannelNotification
};
