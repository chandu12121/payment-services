const { baseStyles, getTemplate } = require('./emailStyles');

const accountStatusTemplate = ({ name, status, reason }) => {
    // Determine banner color based on status
    const statusColors = {
        'active': { bg: '#28a745', icon: '✓' },
        'suspended': { bg: '#FFC107', icon: '⚠️' },
        'banned': { bg: '#dc3545', icon: '🚫' },
        'verified': { bg: '#28a745', icon: '✓' },
        'pending': { bg: '#17a2b8', icon: '⏳' }
    };

    const statusConfig = statusColors[status.toLowerCase()] || { bg: '#6c757d', icon: 'ℹ️' };

    const content = `
        <!-- Header Banner -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px 20px; text-align: center; margin-bottom: 30px;">
            <h2 style="color: white; margin: 0; font-size: 26px;">⚙️ Account Status Update</h2>
            <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Your account settings have changed</p>
        </div>

        <p>Hello ${name},</p>
        <p style="color: #666; line-height: 1.6;">Your account status has been updated. Please review the details below.</p>

        <!-- Status Card -->
        <div style="${baseStyles.card}; background: #f7fafc; border-left: 4px solid ${statusConfig.bg};">
            <h3 style="color: #2d3748; margin-top: 0; display: flex; align-items: center; gap: 10px;">
                <span style="background: ${statusConfig.bg}; color: white; width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 16px;">${statusConfig.icon}</span>
                Account Status
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 12px 0; color: #718096; width: 40%;">Current Status:</td>
                    <td style="padding: 12px 0;">
                        <span style="background: ${statusConfig.bg}; color: white; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; text-transform: uppercase;">
                            ${status}
                        </span>
                    </td>
                </tr>
                ${reason ? `
                <tr>
                    <td style="padding: 12px 0; color: #718096; vertical-align: top;">Reason:</td>
                    <td style="padding: 12px 0; color: #2d3748;">${reason}</td>
                </tr>
                ` : ''}
                <tr>
                    <td style="padding: 12px 0; color: #718096;">Update Date:</td>
                    <td style="padding: 12px 0; color: #2d3748; font-weight: 600;">${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</td>
                </tr>
            </table>
        </div>

        <!-- Actions Based on Status -->
        ${status.toLowerCase() === 'suspended' ? `
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404; font-size: 13px; line-height: 1.6;">
                <strong>⏸️ Account Temporarily Suspended</strong><br/>
                Your account is temporarily suspended. You won't be able to create new payments or transactions. Please contact our support team to resolve this issue.
            </p>
        </div>
        ` : status.toLowerCase() === 'banned' ? `
        <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <p style="margin: 0; color: #721c24; font-size: 13px; line-height: 1.6;">
                <strong>🚫 Account Deactivated</strong><br/>
                Your account has been deactivated. If you believe this is a mistake, please contact our support team immediately.
            </p>
        </div>
        ` : status.toLowerCase() === 'active' || status.toLowerCase() === 'verified' ? `
        <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
            <p style="margin: 0; color: #155724; font-size: 13px; line-height: 1.6;">
                <strong>✓ Account Active</strong><br/>
                Your account is fully active and ready to use. You have access to all features and services.
            </p>
        </div>
        ` : ''}

        <!-- What You Can Do -->
        <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <p style="margin: 0 0 10px 0; color: #2d3748; font-size: 14px; font-weight: 600;">📋 Your Account Options:</p>
            <p style="margin: 0; color: #718096; font-size: 13px; line-height: 1.8;">
                • View your account settings<br/>
                • Review your transaction history<br/>
                • Update your profile information<br/>
                • Manage security preferences<br/>
                • Contact support if you have questions
            </p>
        </div>

        <!-- Support -->
        <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <p style="margin: 0; color: #0c5a7a; font-size: 13px; line-height: 1.6;">
                <strong>❓ Need Assistance?</strong><br/>
                If you have questions about this status change, please <a href="{{support_url}}" style="color: #4299e1; text-decoration: none;">contact our support team</a> or visit your account settings.
            </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; color: #718096; font-size: 12px;">
                © PayFlow Pro. Secure Payment Management<br/>
                <a href="{{privacy_url}}" style="color: #4299e1; text-decoration: none;">Privacy Policy</a> | 
                <a href="{{dashboard_url}}" style="color: #4299e1; text-decoration: none;">Visit Dashboard</a>
            </p>
        </div>
    `;

    return getTemplate(content);
};

module.exports = accountStatusTemplate;
