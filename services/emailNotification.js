const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for port 465
    auth: {
        user: process.env.EMAIL_USER || "chandup12121@gmail.com",
        pass: process.env.EMAIL_PASS || "dnhg isec kwru bbqj"
    }
});

const sendInvoice = async ({ to, name, invoiceNumber, amount, currency, items = [], pdfUrl }) => {
    const mailOptions = {
        from: process.env.EMAIL_USER || "chandup12121@gmail.com",
        to: to,
        subject: `Invoice ${invoiceNumber} from Payment Service`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Payment Successful</h2>
                <p>Hello ${name},</p>
                <p>Thank you for your payment. Here are your invoice details:</p>
                
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
                    <p><strong>Amount:</strong> ${amount} ${currency}</p>
                    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                </div>

                <h3>Items</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #eee;">
                            <th style="padding: 10px; text-align: left;">Description</th>
                            <th style="padding: 10px; text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.description || 'Payment'}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.amount}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <p style="margin-top: 20px;">
                    ${pdfUrl ? `<a href="${pdfUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Download Invoice PDF</a>` : ''}
                </p>
            </div>
        `
    };

    return await transporter.sendMail(mailOptions);
};

const sendPasswordResetEmail = async ({ email, resetUrl, name }) => {
    const mailOptions = {
        from: process.env.EMAIL_USER || "chandup12121@gmail.com",
        to: email,
        subject: "Password Reset Request",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Password Reset Request</h2>
                <p>Hello ${name},</p>
                <p>You requested a password reset. Please click the link below to reset your password:</p>
                <p>
                    <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
                </p>
                <p>If you did not request this, please ignore this email.</p>
                <p>This link will expire in 10 minutes.</p>
            </div>
        `
    };

    return await transporter.sendMail(mailOptions);
};

const sendVerificationEmail = async ({ email, name, verificationUrl }) => {
    const mailOptions = {
        from: process.env.EMAIL_USER || "chandup12121@gmail.com",
        to: email,
        subject: "Email Verification",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Email Verification</h2>
                <p>Hello ${name},</p>
                <p>Thank you for registering. Please verify your email by clicking the link below:</p>
                <p>
                    <a href="${verificationUrl}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
                </p>
                <p>This link will expire in 24 hours.</p>
            </div>
        `
    };

    return await transporter.sendMail(mailOptions);
};

const sendWelcomeEmail = async ({ email, name }) => {
    const mailOptions = {
        from: process.env.EMAIL_USER || "chandup12121@gmail.com",
        to: email,
        subject: "Welcome to Payment Service",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Welcome aboard!</h2>
                <p>Hello ${name},</p>
                <p>Your account has been successfully created. We're glad to have you with us!</p>
                <p>You can now start using all our features.</p>
            </div>
        `
    };

    return await transporter.sendMail(mailOptions);
};

const sendAccountStatusChangeEmail = async ({ email, name, status, reason }) => {
    const mailOptions = {
        from: process.env.EMAIL_USER || "chandup12121@gmail.com",
        to: email,
        subject: "Account Status Update",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Account Status Update</h2>
                <p>Hello ${name},</p>
                <p>Your account status has been changed to: <strong>${status}</strong></p>
                ${reason ? `<p>Reason: ${reason}</p>` : ''}
                <p>If you have any questions, please contact our support team.</p>
            </div>
        `
    };

    return await transporter.sendMail(mailOptions);
};

module.exports = {
    sendInvoice,
    sendPasswordResetEmail,
    sendVerificationEmail,
    sendWelcomeEmail,
    sendAccountStatusChangeEmail
};