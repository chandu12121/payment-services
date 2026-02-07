const { baseStyles, getTemplate } = require('./emailStyles');

const welcomeTemplate = ({ name, userName = '', plan = 'Free' }) => {
    const content = `
        <!-- Hero Banner -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 40px 20px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; font-size: 36px; margin: 0; font-weight: 700;">Welcome to PayFlow Pro!</h1>
            <p style="color: rgba(255,255,255,0.9); font-size: 18px; margin: 10px 0 0 0;">Your Smart Payment Dashboard</p>
        </div>

        <!-- Welcome Message -->
        <div style="text-align: center; margin-bottom: 40px;">
            <div style="background: #f8f9fa; border-radius: 50%; width: 120px; height: 120px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; border: 4px solid #e9ecef;">
                <span style="font-size: 48px;">🎉</span>
            </div>
            <h2 style="color: #2d3748; margin: 0 0 15px 0; font-size: 28px;">Hello, ${name}!</h2>
            <p style="color: #718096; font-size: 16px; line-height: 1.6; max-width: 500px; margin: 0 auto;">
                We're thrilled to welcome you to PayFlow Pro. Your account has been successfully created and is ready to use.
            </p>
        </div>

        <!-- Account Details -->
        <div style="background: #f7fafc; border-radius: 12px; padding: 25px; margin-bottom: 30px; border-left: 4px solid #4299e1;">
            <h3 style="color: #2d3748; margin-top: 0; display: flex; align-items: center; gap: 10px;">
                <span style="background: #4299e1; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 14px;">✓</span>
                Account Details
            </h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div>
                    <p style="color: #718096; margin: 0 0 5px 0; font-size: 14px;">Account Status</p>
                    <p style="color: #2d3748; margin: 0; font-weight: 600; font-size: 16px;">
                        <span style="background: #c6f6d5; color: #22543d; padding: 4px 12px; border-radius: 20px; font-size: 14px;">Active</span>
                    </p>
                </div>
                ${userName ? `
                <div>
                    <p style="color: #718096; margin: 0 0 5px 0; font-size: 14px;">Username</p>
                    <p style="color: #2d3748; margin: 0; font-weight: 600; font-size: 16px;">@${userName}</p>
                </div>
                ` : ''}
                <div>
                    <p style="color: #718096; margin: 0 0 5px 0; font-size: 14px;">Current Plan</p>
                    <p style="color: #2d3748; margin: 0; font-weight: 600; font-size: 16px;">${plan}</p>
                </div>
            </div>
        </div>

        <!-- Quick Start Guide -->
        <div style="margin-bottom: 40px;">
            <h3 style="color: #2d3748; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                <span style="background: #ed8936; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 14px;">⚡</span>
                Get Started in Minutes
            </h3>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; transition: transform 0.2s;">
                    <div style="background: #ebf8ff; width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                        <span style="font-size: 24px;">👤</span>
                    </div>
                    <h4 style="color: #2d3748; margin: 0 0 10px 0;">Complete Profile</h4>
                    <p style="color: #718096; margin: 0; font-size: 14px; line-height: 1.5;">Add your details and verify your account for full access.</p>
                </div>
                
                <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; transition: transform 0.2s;">
                    <div style="background: #fefcbf; width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                        <span style="font-size: 24px;">💳</span>
                    </div>
                    <h4 style="color: #2d3748; margin: 0 0 10px 0;">Add Payment Method</h4>
                    <p style="color: #718096; margin: 0; font-size: 14px; line-height: 1.5;">Link your card or bank account to start processing payments.</p>
                </div>
                
                <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; transition: transform 0.2s;">
                    <div style="background: #c6f6d5; width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                        <span style="font-size: 24px;">📊</span>
                    </div>
                    <h4 style="color: #2d3748; margin: 0 0 10px 0;">Explore Dashboard</h4>
                    <p style="color: #718096; margin: 0; font-size: 14px; line-height: 1.5;">Track payments, generate invoices, and view analytics.</p>
                </div>
            </div>
        </div>

        <!-- Call to Action -->
        <div style="text-align: center; margin-bottom: 40px;">
            <a href="{{dashboard_url}}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 16px 32px; 
                      text-decoration: none; 
                      border-radius: 8px; 
                      font-weight: 600; 
                      font-size: 16px; 
                      display: inline-block; 
                      transition: transform 0.2s, box-shadow 0.2s;
                      box-shadow: 0 4px 6px rgba(102, 126, 234, 0.2);">
                Launch Your Dashboard
            </a>
            <p style="color: #718096; font-size: 14px; margin-top: 15px;">
                Your dashboard is ready and waiting for you!
            </p>
        </div>

        <!-- Additional Resources -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 30px;">
            <h4 style="color: #2d3748; margin-bottom: 15px; font-size: 18px;">Helpful Resources</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 15px;">
                <a href="{{docs_url}}" style="color: #4299e1; text-decoration: none; font-size: 14px; display: flex; align-items: center; gap: 5px;">
                    <span style="font-size: 16px;">📚</span> Documentation
                </a>
                <a href="{{support_url}}" style="color: #4299e1; text-decoration: none; font-size: 14px; display: flex; align-items: center; gap: 5px;">
                    <span style="font-size: 16px;">💬</span> Support Center
                </a>
                <a href="{{video_url}}" style="color: #4299e1; text-decoration: none; font-size: 14px; display: flex; align-items: center; gap: 5px;">
                    <span style="font-size: 16px;">🎬</span> Video Tutorials
                </a>
                <a href="{{community_url}}" style="color: #4299e1; text-decoration: none; font-size: 14px; display: flex; align-items: center; gap: 5px;">
                    <span style="font-size: 16px;">👥</span> Community Forum
                </a>
            </div>
        </div>

        <!-- Welcome Gift -->
        <div style="background: linear-gradient(135deg, #f6e05e 0%, #d69e2e 100%); border-radius: 12px; padding: 20px; margin: 30px 0; text-align: center;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 10px;">
                <span style="font-size: 32px;">🎁</span>
                <h4 style="color: #744210; margin: 0; font-size: 18px;">Welcome Gift Inside!</h4>
            </div>
            <p style="color: #975a16; margin: 0; font-size: 14px;">
                Check your account for a special welcome bonus!
            </p>
        </div>

        <!-- Social Proof -->
        <div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 30px;">
            <p style="color: #718096; font-size: 14px; margin-bottom: 15px;">
                <span style="font-size: 20px;">⭐</span> Trusted by 10,000+ businesses worldwide
            </p>
            <div style="display: flex; justify-content: center; gap: 20px; opacity: 0.7;">
                <span style="font-size: 12px; color: #718096;">• Secure Payments • 24/7 Support • GDPR Compliant •</span>
            </div>
        </div>
    `;

    return getTemplate(content, {
        subject: `Welcome to PayFlow Pro, ${name}! 🎉`,
        preview: `Your account is ready. Start managing payments smarter with PayFlow Pro.`
    });
};

module.exports = welcomeTemplate;

