const { baseStyles, getTemplate } = require('./emailStyles');

const verificationTemplate = ({ name, verificationUrl }) => {
    const content = `
        <!-- Header Banner -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px 20px; text-align: center; margin-bottom: 30px;">
            <h2 style="color: white; margin: 0; font-size: 26px;">✉️ Verify Your Email</h2>
            <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Complete your account setup</p>
        </div>

        <p>Hello ${name},</p>
        <p style="color: #666; line-height: 1.6;">Thank you for joining PayFlow Pro! To activate your account and start using all features, please verify your email address. This link is valid for 24 hours.</p>

        <!-- Verification Card -->
        <div style="${baseStyles.card}; background: #f0fdf4; border-left: 4px solid #28a745; margin: 30px 0;">
            <p style="margin: 0 0 15px 0; color: #2d3748; font-size: 14px;"><strong>✓ Verify Email Address</strong></p>
            <p style="text-align: center; margin: 0;">
                <a href="${verificationUrl}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 14px 35px; 
                          text-decoration: none; 
                          border-radius: 8px; 
                          font-weight: 600; 
                          display: inline-block;
                          box-shadow: 0 4px 6px rgba(102, 126, 234, 0.2);">
                    Verify Email
                </a>
            </p>
        </div>

        <!-- Benefits Card -->
        <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0; color: #2d3748; font-size: 14px; font-weight: 600;">🎉 What You Get After Verification:</p>
            <p style="margin: 0; color: #718096; font-size: 13px; line-height: 1.8;">
                • Full access to your payment dashboard<br/>
                • Ability to send and receive payments<br/>
                • Invoice generation and tracking<br/>
                • Real-time payment notifications<br/>
                • Account security and protection
            </p>
        </div>

        <!-- Security Note -->
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404; font-size: 13px; line-height: 1.6;">
                <strong>⏰ Link Expires in 24 Hours</strong><br/>
                Click the verification button above to complete your setup. If you didn't create this account, please ignore this email.
            </p>
        </div>

        <!-- Support Card -->
        <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <p style="margin: 0; color: #0c5a7a; font-size: 13px; line-height: 1.6;">
                <strong>❓ Need Help?</strong><br/>
                If you have any questions or the button above doesn't work, <a href="{{support_url}}" style="color: #4299e1; text-decoration: none;">contact our support team</a>
            </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; color: #718096; font-size: 12px;">
                © PayFlow Pro. Secure Payment Management<br/>
                <a href="{{privacy_url}}" style="color: #4299e1; text-decoration: none;">Privacy Policy</a> | 
                <a href="{{terms_url}}" style="color: #4299e1; text-decoration: none;">Terms of Service</a>
            </p>
        </div>
    `;

    return getTemplate(content);
};

module.exports = verificationTemplate;
