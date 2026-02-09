const sgMail = require('@sendgrid/mail');
const invoiceTemplate = require("../templates/invoiceTemplate");
const passwordResetTemplate = require("../templates/passwordResetTemplate");
const verificationTemplate = require("../templates/verificationTemplate");
const welcomeTemplate = require("../templates/welcomeTemplate");
const accountStatusTemplate = require("../templates/accountStatusTemplate");
const refundTemplate = require("../templates/refundTemplate");

// Set the API Key
if (process.env.SENDER_API_KEY) {
    sgMail.setApiKey(process.env.SENDER_API_KEY);
} else {
    console.error("SENDER_API_KEY is missing in environment variables.");
}

// Sender Identity Helper
const getSenderIdentity = () => ({
    email: process.env.EMAIL_USER,
    name: process.env.COMPANY_NAME || 'PayFlow Pro'
});

const sendEmail = async (msg) => {
    try {
        await sgMail.send(msg);
        console.log(`Email sent to ${msg.to}`);
        return { success: true };
    } catch (error) {
        console.error('Error sending email:', error);
        if (error.response) {
            console.error(error.response.body);
        }
        throw error;
    }
};

const sendInvoice = async ({ to, name, invoiceNumber, amount, currency, items = [], pdfUrl, transactionDetails = {}, clientUrl }) => {
    const msg = {
        to,
        from: getSenderIdentity(),
        replyTo: process.env.EMAIL_USER,
        subject: `✅ Payment Received - Invoice ${invoiceNumber}`,
        text: `Hello ${name},\n\nPayment received for invoice ${invoiceNumber} amount ${currency} ${amount}.\n\nView details: ${clientUrl}/invoices\n\nThank you for your business.`,
        html: invoiceTemplate({ name, invoiceNumber, amount, currency, items, pdfUrl, transactionDetails, clientUrl })
    };

    return await sendEmail(msg);
};

const sendPasswordResetEmail = async ({ email, resetUrl, name }) => {
    const msg = {
        to: email,
        from: getSenderIdentity(),
        replyTo: process.env.EMAIL_USER,
        subject: "Password Reset Request",
        text: `Hello ${name},\n\nYou requested a password reset. Please click the link below to reset your password:\n${resetUrl}\n\nIf you did not request this, please ignore this email.`,
        html: passwordResetTemplate({ name, resetUrl })
    };

    return await sendEmail(msg);
};

const sendVerificationEmail = async ({ email, name, verificationUrl }) => {
    const msg = {
        to: email,
        from: getSenderIdentity(),
        replyTo: process.env.EMAIL_USER,
        subject: "Email Verification",
        text: `Hello ${name},\n\nPlease verify your email address by clicking the link below:\n${verificationUrl}\n\nThank you!`,
        html: verificationTemplate({ name, verificationUrl })
    };

    return await sendEmail(msg);
};

const sendWelcomeEmail = async ({ email, name }) => {
    const msg = {
        to: email,
        from: getSenderIdentity(),
        replyTo: process.env.EMAIL_USER,
        subject: "Welcome to Payment Service",
        text: `Hello ${name},\n\nWelcome to our Payment Service! We are excited to have you on board.\n\nBest regards,\nThe Team`,
        html: welcomeTemplate({ name })
    };

    return await sendEmail(msg);
};

const sendAccountStatusChangeEmail = async ({ email, name, status, reason }) => {
    const msg = {
        to: email,
        from: getSenderIdentity(),
        replyTo: process.env.EMAIL_USER,
        subject: "Account Status Update",
        text: `Hello ${name},\n\nYour account status has been updated to: ${status}.\n\nReason: ${reason || 'N/A'}\n\nPlease contact support if you have any questions.`,
        html: accountStatusTemplate({ name, status, reason })
    };

    return await sendEmail(msg);
};

const sendRefundEmail = async ({ email, name, refundId, amount, currency }) => {
    const msg = {
        to: email,
        from: getSenderIdentity(),
        replyTo: process.env.EMAIL_USER,
        subject: "Refund Processed Successful",
        text: `Hello ${name},\n\nYour refund of ${currency} ${amount} has been processed successfully.\nRefund ID: ${refundId}\n\nIt may take a few days to appear on your statement.`,
        html: refundTemplate({ name, refundId, amount, currency })
    };

    return await sendEmail(msg);
};

module.exports = {
    sendInvoice,
    sendPasswordResetEmail,
    sendVerificationEmail,
    sendWelcomeEmail,
    sendAccountStatusChangeEmail,
    sendRefundEmail
};
