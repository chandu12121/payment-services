const { baseStyles, getTemplate } = require('./emailStyles');

const invoiceTemplate = ({ 
  name, 
  invoiceNumber, 
  amount, 
  currency, 
  items = [], 
  pdfUrl,
  transactionDetails = {},
  clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
}) => {
    const itemsHtml = items.map(item => `
        <tr>
            <td style="${baseStyles.tableCell}">${item.description || 'Payment'}</td>
            <td style="${baseStyles.tableCell}; text-align: center;">${item.quantity || 1}</td>
            <td style="${baseStyles.tableCell}; text-align: right;">₹${(item.unitPrice || item.amount || 0).toLocaleString('en-IN')}</td>
            <td style="${baseStyles.tableCell}; text-align: right;">₹${(item.totalAmount || item.amount || 0).toLocaleString('en-IN')}</td>
        </tr>
    `).join('');

    const paymentDate = transactionDetails.paymentDate || new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const content = `
        <!-- Header Banner -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px 20px; text-align: center; margin-bottom: 30px;">
            <h2 style="color: white; margin: 0; font-size: 28px;">✅ Payment Successful!</h2>
            <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Your invoice is ready below</p>
        </div>

        <p>Hello ${name},</p>
        <p style="color: #666; line-height: 1.6;">Thank you for your payment! We've successfully received your payment and processed it. Below you'll find your complete invoice and payment details.</p>

        <!-- Payment Status Card -->
        <div style="${baseStyles.card}; background: #f0f9ff; border-left: 4px solid #4CAF50;">
            <h3 style="margin-top: 0; color: #2d3748;">✓ Payment Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; color: #718096; width: 50%;">Transaction ID:</td>
                    <td style="padding: 8px 0; color: #2d3748; font-weight: 600;">${transactionDetails.transactionId || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #718096;">Payment Date:</td>
                    <td style="padding: 8px 0; color: #2d3748; font-weight: 600;">${paymentDate}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #718096;">Payment Method:</td>
                    <td style="padding: 8px 0; color: #2d3748; font-weight: 600;">${transactionDetails.paymentMethod || 'Card'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #718096;">Status:</td>
                    <td style="padding: 8px 0;">
                        <span style="background: #c6f6d5; color: #22543d; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">✓ SUCCESSFUL</span>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Invoice Details -->
        <h3 style="color: #2d3748; margin-top: 30px; margin-bottom: 15px;">📄 Invoice Details</h3>
        <div style="${baseStyles.card}">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 10px 0; color: #718096;">Invoice Number:</td>
                    <td style="padding: 10px 0; color: #2d3748; font-weight: 600; text-align: right;">${invoiceNumber}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #718096;">Amount:</td>
                    <td style="padding: 10px 0; color: #2d3748; font-weight: 600; text-align: right; font-size: 18px;">₹${amount.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #718096;">Date:</td>
                    <td style="padding: 10px 0; color: #2d3748; font-weight: 600; text-align: right;">${new Date().toLocaleDateString('en-IN')}</td>
                </tr>
            </table>
        </div>

        <!-- Items/Services Table -->
        <h3 style="color: #2d3748; margin-top: 30px; margin-bottom: 15px;">🛍️ Items</h3>
        <table style="${baseStyles.table}; margin-bottom: 20px;">
            <thead>
                <tr style="${baseStyles.tableHeader}">
                    <th style="${baseStyles.tableCell}; text-align: left;">Description</th>
                    <th style="${baseStyles.tableCell}; text-align: center;">Quantity</th>
                    <th style="${baseStyles.tableCell}; text-align: right;">Unit Price</th>
                    <th style="${baseStyles.tableCell}; text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>

        <!-- Total Amount -->
        <div style="text-align: right; margin: 20px 0;">
            <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; width: fit-content; margin-left: auto;">
                <p style="margin: 0; color: #718096; font-size: 14px;">Total Amount:</p>
                <p style="margin: 5px 0 0 0; color: #2d3748; font-size: 24px; font-weight: 700;">₹${amount.toLocaleString('en-IN')}</p>
            </div>
        </div>

        <!-- Download Button -->
        <div style="text-align: center; margin-top: 30px; margin-bottom: 20px;">
            ${pdfUrl ? `
            <a href="${pdfUrl}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 12px 28px; 
                      text-decoration: none; 
                      border-radius: 8px; 
                      font-weight: 600; 
                      display: inline-block;
                      box-shadow: 0 4px 6px rgba(102, 126, 234, 0.2);">
                📥 Download Invoice PDF
            </a>
            ` : ''}
        </div>

        <!-- Additional Information -->
        <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #e2e8f0;">
            <p style="margin: 0; color: #718096; font-size: 13px; line-height: 1.6;">
                <strong>📌 What's Next?</strong><br/>
                • Your invoice has been saved to your account<br/>
                • Check your invoices section anytime for past transactions<br/>
                • Use the invoice number for your records and accounting<br/>
                • <a href="${clientUrl}/support" style="color: #4299e1; text-decoration: none;">Contact support</a> if you have any questions
            </p>
        </div>

        <!-- Footer Note -->
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; color: #718096; font-size: 12px;">
                Thank you for your business! We appreciate your trust in PayFlow Pro.<br/>
                <a href="${clientUrl}" style="color: #4299e1; text-decoration: none;">Visit your dashboard</a> to manage more invoices and payments.
            </p>
        </div>
    `;

    return getTemplate(content);
};

module.exports = invoiceTemplate;
