const Notification = require("../models/Notification");
const { sendNotification } = require("../config/socket");

// Emoji mapping for notification types
const EMOJI_MAP = {
  payment: "💰",
  invoice: "🧾",
  success: "✅",
  warning: "⚠️",
  alert: "🚨",
  info: "ℹ️",
  refund: "🔄",
  welcome: "🎉",
  security: "🔒",
  reminder: "⏰",
  default: "📢",
};

// Color mapping for notification types
const COLOR_MAP = {
  payment: "#4CAF50", // Green
  invoice: "#2196F3", // Blue
  success: "#4CAF50", // Green
  warning: "#FF9800", // Orange
  alert: "#F44336", // Red
  info: "#2196F3", // Blue
  refund: "#9C27B0", // Purple
  welcome: "#FF4081", // Pink
  security: "#607D8B", // Blue Grey
  reminder: "#FFC107", // Amber
  default: "#757575", // Grey
};

/**
 * Format amount with proper Indian currency formatting
 */
const formatAmount = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format date in a readable format
 */
const formatDate = (date) => {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
};

/**
 * Create an attractive notification title with emoji
 */
const createAttractiveTitle = (type, baseTitle) => {
  const emoji = EMOJI_MAP[type.toLowerCase()] || EMOJI_MAP.default;
  return `${emoji} ${baseTitle}`;
};

/**
 * Create rich message with formatting
 */
const createRichMessage = (type, baseMessage, metadata = {}) => {
  const color = COLOR_MAP[type.toLowerCase()] || COLOR_MAP.default;

  switch (type.toLowerCase()) {
    case "payment":
      return `🎉 **Payment Successful!**\n\n💰 **Amount:** ${formatAmount(metadata.amount)}\n📅 **Date:** ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}\n📋 **Transaction ID:** ${metadata.transactionId || "N/A"}\n\n✅ Your payment has been processed successfully.`;

    case "invoice":
      return `📄 **New Invoice Generated**\n\n🧾 **Invoice #:** ${metadata.invoiceId || "N/A"}\n💰 **Amount:** ${formatAmount(metadata.amount)}\n📅 **Generated on:** ${new Date().toLocaleDateString("en-IN")}\n\n👉 Invoice is ready for download and payment.`;

    case "refund":
      return `🔄 **Refund Processed**\n\n💰 **Refund Amount:** ${formatAmount(metadata.amount)}\n📅 **Processed on:** ${new Date().toLocaleDateString("en-IN")}\n📋 **Reference ID:** ${metadata.transactionId || "N/A"}\n\n✅ The amount has been credited to your source account.`;

    case "reminder":
      return `⏰ **Payment Reminder**\n\n💰 **Due Amount:** ${formatAmount(metadata.amount)}\n📅 **Due Date:** ${formatDate(metadata.dueDate)}\n⚠️ **Status:** Pending\n\n💡 Please complete the payment to avoid any late fees.`;

    case "welcome":
      return `🎉 **Welcome ${metadata.name || "there"}!**\n\n🚀 Welcome to PayFlow Pro - Your Smart Payment Companion!\n\n✨ **Get Started:**\n• Complete your profile\n• Set up payment methods\n• Explore dashboard features\n• Check out our tutorials\n\n💬 Need help? We're here for you!`;

    case "security":
      return `🔒 **Security Alert**\n\n⚠️ **Action:** ${baseMessage}\n📅 **Time:** ${new Date().toLocaleTimeString("en-IN")}\n📍 **Device:** ${metadata.device || "Unknown device"}\n\n🚨 If this wasn't you, secure your account immediately.`;

    default:
      // Add some formatting to regular messages
      if (metadata.amount) {
        return `💰 **${baseMessage}**\n\nAmount: ${formatAmount(metadata.amount)}`;
      }
      return baseMessage;
  }
};

/**
 * Create a notification for a user with attractive formatting
 */
const createNotification = async (
  userId,
  type,
  title,
  message,
  metadata = {},
) => {
  try {
    const notificationType = type.toLowerCase();
    const attractiveTitle = createAttractiveTitle(notificationType, title);
    const richMessage = createRichMessage(notificationType, message, metadata);

    const notification = await Notification.create({
      user: userId,
      type: type.toUpperCase(),
      title: attractiveTitle,
      message: richMessage,
      metadata: {
        ...metadata,
        color:
          metadata.color || COLOR_MAP[notificationType] || COLOR_MAP.default,
        icon: metadata.icon || EMOJI_MAP[notificationType] || EMOJI_MAP.default,
        formattedAmount: metadata.amount ? formatAmount(metadata.amount) : null,
        formattedDate: metadata.date ? formatDate(metadata.date) : null,
      },
      priority:
        metadata.priority ||
        (notificationType === "alert" || notificationType === "warning"
          ? "HIGH"
          : "MEDIUM"),
      channels: metadata.channels || ["IN_APP"],
      status: "DELIVERED",
      sentAt: new Date(),
      action: metadata.action || {
        type: metadata.link ? "ROUTE" : "NONE",
        target: metadata.link || "",
        label:
          metadata.linkLabel ||
          (metadata.amount ? "View Details" : "Learn More"),
        icon: metadata.actionIcon || "🔍",
      },
    });

    // Emit real-time notification with enhanced data
    sendNotification(userId, {
      ...notification.toObject(),
      displayColor: COLOR_MAP[notificationType] || COLOR_MAP.default,
      displayIcon: EMOJI_MAP[notificationType] || EMOJI_MAP.default,
      isUrgent: ["alert", "warning"].includes(notificationType),
    });

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

/**
 * Create payment success notification with enhanced formatting
 */
const notifyPaymentSuccess = async (
  userId,
  transactionId,
  amount,
  paymentMethod = "",
) => {
  return await createNotification(
    userId,
    "payment",
    "Payment Successful",
    `Your payment has been processed successfully`,
    {
      transactionId,
      amount,
      paymentMethod,
      link: "/transactions",
      linkLabel: "View Transaction",
      actionIcon: "📊",
      priority: "HIGH",
    },
  );
};

/**
 * Create payment failed notification
 */
const notifyPaymentFailed = async (
  userId,
  amount,
  reason = "",
  paymentMethod = "",
) => {
  return await createNotification(
    userId,
    "alert",
    "Payment Failed",
    `We couldn't process your payment`,
    {
      amount,
      reason,
      paymentMethod,
      link: "/pay",
      linkLabel: "Try Again",
      actionIcon: "🔄",
      priority: "URGENT",
    },
  );
};

/**
 * Create invoice generated notification
 */
const notifyInvoiceGenerated = async (
  userId,
  invoiceId,
  amount,
  dueDate = null,
) => {
  return await createNotification(
    userId,
    "invoice",
    "New Invoice Generated",
    `Invoice has been generated`,
    {
      invoiceId,
      amount,
      dueDate,
      link: `/invoices/${invoiceId}`,
      linkLabel: "View Invoice",
      actionIcon: "📄",
      priority: "HIGH",
    },
  );
};

/**
 * Create refund processed notification
 */
const notifyRefundProcessed = async (
  userId,
  transactionId,
  amount,
  refundMethod = "",
) => {
  return await createNotification(
    userId,
    "refund",
    "Refund Processed",
    `Your refund has been initiated`,
    {
      transactionId,
      amount,
      refundMethod,
      link: "/transactions",
      linkLabel: "Track Refund",
      actionIcon: "💰",
      priority: "HIGH",
    },
  );
};

/**
 * Create payment reminder notification
 */
const notifyPaymentReminder = async (
  userId,
  amount,
  dueDate,
  invoiceId = null,
) => {
  const daysLeft = Math.ceil(
    (new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24),
  );
  const urgency = daysLeft <= 1 ? "URGENT" : daysLeft <= 3 ? "HIGH" : "MEDIUM";

  return await createNotification(
    userId,
    "reminder",
    daysLeft <= 1 ? "Payment Due Today!" : "Payment Reminder",
    `Payment is due soon`,
    {
      amount,
      dueDate,
      invoiceId,
      daysLeft,
      link: invoiceId ? `/invoices/${invoiceId}` : "/payments",
      linkLabel: "Pay Now",
      actionIcon: "💳",
      priority: urgency,
    },
  );
};

/**
 * Create welcome notification with personalized touch
 */
const notifyWelcome = async (userId, name, hasCompletedProfile = false) => {
  return await createNotification(
    userId,
    "welcome",
    `Welcome ${name}!`,
    `Let's get you started with PayFlow Pro`,
    {
      name,
      hasCompletedProfile,
      link: hasCompletedProfile ? "/dashboard" : "/profile/setup",
      linkLabel: hasCompletedProfile ? "Go to Dashboard" : "Complete Profile",
      actionIcon: "🚀",
      priority: "HIGH",
    },
  );
};

/**
 * Create account update notification
 */
const notifyAccountUpdate = async (userId, updateType, device = "") => {
  const updateMessages = {
    profile: {
      title: "Profile Updated",
      message: "Your profile information has been updated successfully",
      icon: "👤",
    },
    password: {
      title: "Password Changed",
      message: "Your password has been changed successfully",
      icon: "🔑",
    },
    email: {
      title: "Email Updated",
      message: "Your email address has been updated",
      icon: "📧",
    },
    security: {
      title: "Security Settings Updated",
      message: "Your security preferences have been updated",
      icon: "🛡️",
    },
    "2fa_enabled": {
      title: "2FA Enabled",
      message: "Two-factor authentication has been enabled for your account",
      icon: "🔐",
    },
    "2fa_disabled": {
      title: "2FA Disabled",
      message: "Two-factor authentication has been disabled for your account",
      icon: "🔓",
    },
  };

  const config = updateMessages[updateType] || {
    title: "Account Updated",
    message: "Your account settings have been updated",
    icon: "⚙️",
  };

  return await createNotification(
    userId,
    "security",
    config.title,
    config.message,
    {
      updateType,
      device,
      link: "/profile/security",
      linkLabel: "Review Settings",
      actionIcon: config.icon,
    },
  );
};

/**
 * Create system announcement
 */
const notifySystemAnnouncement = async (
  userId,
  title,
  message,
  link = "",
  priority = "MEDIUM",
) => {
  return await createNotification(userId, "info", title, message, {
    isSystemAnnouncement: true,
    link,
    linkLabel: "Read More",
    actionIcon: "📢",
    priority,
  });
};

/**
 * Create milestone notification (e.g., 100th payment)
 */
const notifyMilestone = async (userId, milestone, value) => {
  const milestones = {
    first_payment: {
      title: "First Payment! 🎯",
      message: `Congratulations on completing your first payment of ${formatAmount(value)}!`,
      icon: "🥇",
    },
    payment_count: {
      title: "Payment Milestone! 🏆",
      message: `You've successfully completed ${value} payments!`,
      icon: "📈",
    },
    total_spent: {
      title: "Spending Milestone! 💰",
      message: `You've processed over ${formatAmount(value)} through PayFlow Pro!`,
      icon: "💎",
    },
  };

  const config = milestones[milestone] || {
    title: "Achievement Unlocked! 🏅",
    message: `You've reached a milestone!`,
    icon: "🎖️",
  };

  return await createNotification(
    userId,
    "success",
    config.title,
    config.message,
    {
      milestone,
      value,
      link: "/achievements",
      linkLabel: "View Achievements",
      actionIcon: config.icon,
      priority: "HIGH",
    },
  );
};

module.exports = {
  createNotification,
  notifyPaymentSuccess,
  notifyPaymentFailed,
  notifyInvoiceGenerated,
  notifyRefundProcessed,
  notifyPaymentReminder,
  notifyAccountUpdate,
  notifyWelcome,
  notifyPasswordResetRequest: (userId, device = "") =>
    createNotification(
      userId,
      "security",
      "Password Reset Requested",
      "A password reset was requested for your account",
      {
        device,
        link: "/profile/security",
        linkLabel: "Secure Account",
        priority: "HIGH",
      },
    ),
  notifyPasswordResetSuccess: (userId) =>
    createNotification(
      userId,
      "success",
      "Password Reset Successful",
      "Your password has been changed successfully",
      { link: "/profile", linkLabel: "Go to Profile", priority: "MEDIUM" },
    ),
  notifyEmailVerified: (userId) =>
    createNotification(
      userId,
      "success",
      "Email Verified",
      "Your email address has been successfully verified",
      { link: "/profile", linkLabel: "Complete Profile", priority: "MEDIUM" },
    ),
  notifySystemAnnouncement,
  notifyMilestone,
  formatAmount,
  formatDate,
};
