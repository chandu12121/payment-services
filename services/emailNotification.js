const nodemailer = require("nodemailer");
const invoiceTemplate = require("../templates/invoiceTemplate");
const passwordResetTemplate = require("../templates/passwordResetTemplate");
const verificationTemplate = require("../templates/verificationTemplate");
const welcomeTemplate = require("../templates/welcomeTemplate");
const accountStatusTemplate = require("../templates/accountStatusTemplate");
const refundTemplate = require("../templates/refundTemplate");

// const transporter = nodemailer.createTransport({
//     host: "smtp.gmail.com",
//     port: 587,
//     secure: false, // true for port 465
//     auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS
//     }
// });

const transporter = nodemailer.createTransport({
    host: "smtp.sendgrid.net",
    port: 587,
    secure: false,
    auth: {
        user: "apikey",
        pass: process.env.SENDER_API_KEY
    }
});

console.log(process.env.SENDER_API_KEY, transporter);

const sendInvoice = async ({ to, name, invoiceNumber, amount, currency, items = [], pdfUrl, transactionDetails = {}, clientUrl }) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: to,
        subject: `✅ Payment Received - Invoice ${invoiceNumber}`,
        html: invoiceTemplate({ name, invoiceNumber, amount, currency, items, pdfUrl, transactionDetails, clientUrl })
    };

    return await transporter.sendMail(mailOptions);
};

const sendPasswordResetEmail = async ({ email, resetUrl, name }) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Password Reset Request",
        html: passwordResetTemplate({ name, resetUrl })
    };

    return await transporter.sendMail(mailOptions);
};

const sendVerificationEmail = async ({ email, name, verificationUrl }) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Email Verification",
        html: verificationTemplate({ name, verificationUrl })
    };

    return await transporter.sendMail(mailOptions);
};

const sendWelcomeEmail = async ({ email, name }) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Welcome to Payment Service",
        html: welcomeTemplate({ name })
    };

    return await transporter.sendMail(mailOptions);
};

const sendAccountStatusChangeEmail = async ({ email, name, status, reason }) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Account Status Update",
        html: accountStatusTemplate({ name, status, reason })
    };

    return await transporter.sendMail(mailOptions);
};

const sendRefundEmail = async ({ email, name, refundId, amount, currency }) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Refund Processed Successful",
        html: refundTemplate({ name, refundId, amount, currency })
    };

    return await transporter.sendMail(mailOptions);
};

module.exports = {
    sendInvoice,
    sendPasswordResetEmail,
    sendVerificationEmail,
    sendWelcomeEmail,
    sendAccountStatusChangeEmail,
    sendRefundEmail
};
