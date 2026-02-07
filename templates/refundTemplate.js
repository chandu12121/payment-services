const { baseStyles, getTemplate } = require('./emailStyles');

const refundTemplate = ({ name, refundId, amount, currency }) => {
    const content = `
        <!-- Header Banner -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px 20px; text-align: center; margin-bottom: 30px;">
            <h2 style="color: white; margin: 0; font-size: 26px;">💰 Refund Processed Successfully!</h2>
            <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Your money is on the way back</p>
        </div>

        <p>Hello ${name},</p>
        <p style="color: #666; line-height: 1.6;">Great news! Your refund has been successfully processed. The amount will be credited back to your original payment method within 3-5 business days.</p>

        <!-- Refund Details Card -->
        <div style="${baseStyles.card}; background: #f0fdf4; border-left: 4px solid #28a745;">
            <h3 style="color: #2d3748; margin-top: 0; display: flex; align-items: center; gap: 10px;">
                <span style="background: #28a745; color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 16px;">✓</span>
                Refund Details
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 10px 0; color: #718096; width: 50%;">Refund ID:</td>
                    <td style="padding: 10px 0; color: #2d3748; font-weight: 600; text-align: right;">${refundId}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #718096;">Refund Amount:</td>
                    <td style="padding: 10px 0; color: #2d3748; font-weight: 600; text-align: right; font-size: 18px;">₹${amount.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #718096;">Processing Date:</td>
                    <td style="padding: 10px 0; color: #2d3748; font-weight: 600; text-align: right;">${new Date().toLocaleDateString('en-IN')}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #718096;">Expected Timeline:</td>
                    <td style="padding: 10px 0; color: #2d3748; font-weight: 600; text-align: right;">3-5 Business Days</td>
                </tr>
            </table>
        </div>

        <!-- Timeline Info -->
        <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196F3;">
            <p style="margin: 0 0 10px 0; color: #2d3748; font-size: 14px; font-weight: 600;">⏱️ Refund Timeline</p>
            <p style="margin: 0; color: #718096; font-size: 13px; line-height: 1.8;">
                <strong>Day 1:</strong> Refund processed in our system<br/>
                <strong>Day 2-3:</strong> Bank receives refund request<br/>
                <strong>Day 3-5:</strong> Amount credited to your account<br/><br/>
                ℹ️ International transfers may take longer (5-7 days)
            </p>
        </div>

        <!-- Important Note -->
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404; font-size: 13px; line-height: 1.6;">
                <strong>💡 Important:</strong> The refund will be credited to the same payment method you used originally. If you used a credit card, the refund may appear as a credit on your next statement.
            </p>
        </div>

        <!-- Support Card -->
        <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <p style="margin: 0; color: #0c5a7a; font-size: 13px; line-height: 1.6;">
                <strong>❓ Questions About Your Refund?</strong><br/>
                Refund not received? <a href="{{support_url}}" style="color: #4299e1; text-decoration: none;">Contact our support team</a> with your Refund ID: <strong>${refundId}</strong>
            </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; color: #718096; font-size: 12px;">
                Thank you for using PayFlow Pro!<br/>
                © PayFlow Pro. All rights reserved.
            </p>
        </div>
    `;

    return getTemplate(content);
};

module.exports = refundTemplate;
