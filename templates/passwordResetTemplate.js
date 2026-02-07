const { baseStyles, getTemplate } = require('./emailStyles');

const passwordResetTemplate = ({ name, resetUrl }) => {
    const content = `
        <!-- Header Banner -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px 20px; text-align: center; margin-bottom: 30px;">
            <h2 style="color: white; margin: 0; font-size: 26px;">🔑 Password Reset</h2>
            <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Secure your account with a new password</p>
        </div>

        <p>Hello ${name},</p>
        <p style="color: #666; line-height: 1.6;">We received a request to reset your password. If this was you, click the button below to set a new password. This link is valid for 10 minutes.</p>

        <!-- Reset Link Card -->
        <div style="${baseStyles.card}; background: #f0f9ff; border-left: 4px solid #007bff; margin: 30px 0;">
            <p style="margin: 0 0 15px 0; color: #2d3748; font-size: 14px;"><strong>🔐 Reset Your Password</strong></p>
            <p style="text-align: center; margin: 0;">
                <a href="${resetUrl}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 14px 35px; 
                          text-decoration: none; 
                          border-radius: 8px; 
                          font-weight: 600; 
                          display: inline-block;
                          box-shadow: 0 4px 6px rgba(102, 126, 234, 0.2);">
                    Reset Password
                </a>
            </p>
        </div>

        <!-- Warning Card -->
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404; font-size: 13px; line-height: 1.6;">
                <strong>⏰ Link Expires Soon</strong><br/>
                This password reset link will expire in 10 minutes. If you didn't request this, you can safely ignore this email and your password will remain unchanged.
            </p>
        </div>

        <!-- Security Tips -->
        <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <p style="margin: 0; color: #718096; font-size: 13px; line-height: 1.6;">
                <strong>🛡️ Password Tips</strong><br/>
                • Use a strong, unique password<br/>
                • Mix uppercase, lowercase, numbers, and symbols<br/>
                • Never share your password with anyone<br/>
                • Make sure your browser shows a secure (https) connection
            </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; color: #718096; font-size: 12px;">
                If you need help, <a href="{{support_url}}" style="color: #4299e1; text-decoration: none;">contact our support team</a><br/>
                © PayFlow Pro. All rights reserved.
            </p>
        </div>
    `;

    return getTemplate(content);
};

module.exports = passwordResetTemplate;
