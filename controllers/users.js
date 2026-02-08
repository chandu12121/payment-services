const mongoose = require("mongoose");
const { User, USER_ROLES, USER_STATUS } = require("../models/users");
const ActivityLog = require("../models/ActivityLog");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const {
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendWelcomeEmail,
    sendAccountStatusChangeEmail
} = require("../services/emailNotification");
const { generateOTP, verifyOTP } = require("../services/otpService");
const {
    notifyAccountUpdate,
    notifyWelcome,
    notifyPasswordResetRequest,
    notifyPasswordResetSuccess,
    notifyEmailVerified
} = require("../utils/notificationHelper");
const logger = require("../utils/logger");

// ==================== HELPER FUNCTIONS ====================
const generateAuthResponse = (user, deviceInfo = {}) => {
    const token = user.generateAuthToken(deviceInfo);
    const refreshToken = jwt.sign(
        { userId: user._id, type: 'refresh' },
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );

    return {
        token,
        refreshToken,
        user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            emailVerified: user.emailVerified,
            phoneVerified: user.phoneVerified,
            profileImage: user.profileImage,
            preferences: user.preferences,
            businessDetails: user.businessDetails,
            addresses: user.addresses,
            kycStatus: user.kycStatus,
            walletBalance: user.walletBalance
        }
    };
};

// ==================== AUTHENTICATION CONTROLLERS ====================

/**
 * Register a new user
 */
const registerUser = async (req, res) => {
    try {
        const { name, email, phone, dateOfBirth, address, password, referralCode, businessDetails } = req.body;

        // Validate required fields
        if (!name || !email || !address || !password) {
            return res.status(400).json({
                success: false,
                error: "Name, email, address, and password are required"
            });
        }

        // Check if user already exists (including soft-deleted)
        const existingUser = await User.findOne({ email }).setOptions({ includeDeleted: true });
        if (existingUser) {
            if (existingUser.isDeleted) {
                return res.status(409).json({
                    success: false,
                    error: "An account with this email was previously deleted. Please contact support to reactivate your account."
                });
            }
            return res.status(409).json({
                success: false,
                error: "User already exists with this email"
            });
        }

        // Check if phone is already registered (if provided)
        if (phone) {
            const existingPhone = await User.findOne({ phone });
            if (existingPhone) {
                return res.status(409).json({
                    success: false,
                    error: "Phone number is already registered"
                });
            }
        }

        // Handle referral code
        let referredBy = null;
        if (referralCode) {
            const referrer = await User.findOne({ referralCode });
            if (referrer) {
                referredBy = referrer._id;
                // Update referral count asynchronously
                User.findByIdAndUpdate(referrer._id, {
                    $inc: { referralCount: 1 }
                }).catch(err => console.error('Referral count update error:', err));
            }
        }

        // Create new user
        const userData = {
            name,
            email,
            dateOfBirth,
            address,
            password,
            phone: phone || undefined,
            referredBy,
            businessDetails: businessDetails || undefined
        };

        // Handle structured addresses if provided
        if (req.body.addresses && Array.isArray(req.body.addresses)) {
            userData.addresses = req.body.addresses.map(addr => ({
                ...addr,
                isDefault: addr.isDefault || false
            }));
        }

        const user = new User(userData);
        const verificationToken = user.createEmailVerificationToken();
        await user.save();

        const clientUrl = process.env.CLIENT_URL;

        // Send verification email asynchronously (non-blocking)
        (async () => {
            try {
                await sendVerificationEmail({
                    email: user.email,
                    name: user.name,
                    verificationUrl: `${clientUrl}/verify-email/${verificationToken}`
                });
            } catch (error) {
                console.error('Verification email error:', error);
            }
        })();

        // Send welcome email asynchronously (non-blocking)
        (async () => {
            try {
                await sendWelcomeEmail({
                    email: user.email,
                    name: user.name
                });
            } catch (error) {
                console.error('Welcome email error:', error);
            }
        })();

        // Log registration activity asynchronously
        createActivityLog({
            userId: user._id,
            type: 'security',
            action: 'Account Created',
            description: 'New user registration via System',
            ip: req.ip,
            device: req.headers['user-agent'],
            status: 'success'
        }).catch(err => console.error('Registration log error:', err));

        // Trigger in-app welcome notification asynchronously (non-blocking)
        (async () => {
            try {
                await notifyWelcome(user._id, user.name);
            } catch (e) {
                console.error(`Welcome notification failed: ${e.message}`);
            }
        })();

        // Generate auth response
        const authResponse = generateAuthResponse(user, {
            deviceId: req.headers['device-id'],
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(201).json({
            success: true,
            message: "User registered successfully. Please verify your email.",
            data: authResponse,
            requiresVerification: true
        });

    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({
            success: false,
            error: process.env.NODE_ENV === 'production'
                ? "Registration failed. Please try again."
                : error.message
        });
    }
};

/**
 * Login user
 */
const loginUser = async (req, res) => {
    try {
        const { email, phone, password, deviceId } = req.body;

        if ((!email && !phone) || !password) {
            return res.status(400).json({
                success: false,
                error: "Identifier (email or phone) and password are required"
            });
        }

        // Find user with password
        const query = email ? { email } : { phone };
        const user = await User.findOne(query).setOptions({ includeDeleted: true }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                error: "Invalid credentials"
            });
        }

        // Check account status
        if (user.status !== USER_STATUS.ACTIVE) {
            const statusMessage = user.status === USER_STATUS.PENDING
                ? "Your account is pending verification. Please check your email to verify your account."
                : `Account is ${user.status}. Please contact support.`;

            return res.status(403).json({
                success: false,
                error: statusMessage
            });
        }

        // Check if account is deleted
        if (user.isDeleted) {
            return res.status(403).json({
                success: false,
                error: "Account has been deleted"
            });
        }

        // Verify password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: "Invalid credentials"
            });
        }

        // Update last login
        user.lastLoginAt = new Date();
        user.lastLoginIp = req.ip;
        user.loginCount += 1;
        await user.save();

        // Generate auth response
        const deviceInfoToken = {
            deviceId: deviceId || req.headers['device-id'] || `web-${Date.now()}`,
            deviceType: req.headers['device-type'] || 'web',
            os: req.headers['os'] || 'unknown',
            browser: req.headers['user-agent']?.split(' ')[0] || 'unknown',
            ipAddress: req.ip,
            location: req.headers['geo-location'] ? JSON.parse(req.headers['geo-location']) : undefined
        };

        const authResponse = generateAuthResponse(user, deviceInfoToken);

        // Log login activity
        await createActivityLog({
            userId: user._id,
            type: 'login',
            action: 'Account Login',
            description: 'Logged in via Web Application',
            ip: req.ip,
            device: req.headers['user-agent'],
            status: 'success'
        });

        res.status(200).json({
            success: true,
            message: "Login successful",
            data: authResponse
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            success: false,
            error: process.env.NODE_ENV === 'production'
                ? "Login failed. Please try again."
                : error.message
        });
    }
};

/**
 * Refresh access token
 */
const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: "Refresh token is required"
            });
        }

        // Verify refresh token
        const decoded = jwt.verify(
            refreshToken,
            process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
        );

        if (decoded.type !== 'refresh') {
            return res.status(401).json({
                success: false,
                error: "Invalid token type"
            });
        }

        // Find user
        const user = await User.findById(decoded.userId);
        if (!user || user.isDeleted) {
            return res.status(401).json({
                success: false,
                error: "User not found"
            });
        }

        // Check if password was changed after token was issued
        if (user.changedPasswordAfter(decoded.iat)) {
            return res.status(401).json({
                success: false,
                error: "Password was changed. Please login again."
            });
        }

        // Generate new tokens
        const authResponse = generateAuthResponse(user);

        res.status(200).json({
            success: true,
            message: "Token refreshed successfully",
            data: authResponse
        });

    } catch (error) {
        console.error("Refresh token error:", error);

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: "Invalid refresh token"
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: "Refresh token expired. Please login again."
            });
        }

        res.status(500).json({
            success: false,
            error: "Failed to refresh token"
        });
    }
};

// ==================== USER PROFILE CONTROLLERS ====================

/**
 * Get current user profile
 */
const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .select('-password -twoFactorSecret -twoFactorBackupCodes')
            .populate('referredBy', 'name email');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: "User not found"
            });
        }

        res.status(200).json({
            success: true,
            data: user
        });

        // Log profile access
        await createActivityLog({
            userId: req.user.userId,
            type: 'security',
            action: 'Profile Accessed',
            description: 'Viewed profile in User Settings',
            ip: req.ip,
            device: req.headers['user-agent'],
            status: 'success'
        });

    } catch (error) {
        console.error("Get user error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch user profile"
        });
    }
};

/**
 * Update user profile
 */
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const updateData = req.body;

        // Remove fields that cannot be updated directly
        delete updateData.email;
        delete updateData.password;
        delete updateData.role;
        delete updateData.status;
        delete updateData.walletBalance;
        delete updateData.kycStatus;
        delete updateData.createdAt;
        delete updateData.updatedAt;

        // Check if phone is already taken by another user
        if (updateData.phone) {
            const existingPhone = await User.findOne({
                phone: updateData.phone,
                _id: { $ne: userId }
            });
            if (existingPhone) {
                return res.status(409).json({
                    success: false,
                    error: "Phone number is already registered to another account"
                });
            }
            // Reset phone verification if phone is changed
            if (updateData.phone !== req.user.phone) {
                updateData.phoneVerified = false;
            }
        }

        // Handle address updates
        if (updateData.addresses && Array.isArray(updateData.addresses)) {
            // Ensure only one default address
            const defaultCount = updateData.addresses.filter(addr => addr.isDefault).length;
            if (defaultCount > 1) {
                return res.status(400).json({
                    success: false,
                    error: "Only one address can be set as default"
                });
            }
        }

        // Update user
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { ...updateData, updatedBy: userId },
            { new: true, runValidators: true }
        ).select('-password -twoFactorSecret -twoFactorBackupCodes');

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                error: "User not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: updatedUser
        });

        // Log profile update activity
        await createActivityLog({
            userId,
            type: 'update',
            action: 'Profile Updated',
            description: 'Modified personal information',
            ip: req.ip,
            device: req.headers['user-agent'],
            status: 'success'
        });

        // Trigger in-app notification
        try {
            await notifyAccountUpdate(userId, 'profile');
        } catch (e) {
            console.error(`Profile update notification failed: ${e.message}`);
        }

    } catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({
            success: false,
            error: process.env.NODE_ENV === 'production'
                ? "Failed to update profile"
                : error.message
        });
    }
};

/**
 * Upload profile image
 */
const uploadProfileImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: "Please upload an image"
            });
        }

        const userId = req.user.userId;

        // Get Cloudinary instance from config
        const { v2: cloudinary } = require('cloudinary');
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });

        // Upload to Cloudinary from buffer
        const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: 'payflow-pro/profile-images',
                    resource_type: 'auto',
                    public_id: `user-${userId}-${Date.now()}`
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            stream.end(req.file.buffer);
        });

        // Update user with Cloudinary image URL
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                profileImage: {
                    url: uploadResult.secure_url,
                    publicId: uploadResult.public_id,
                    uploadedAt: new Date()
                },
                updatedBy: userId
            },
            { new: true }
        ).select('profileImage name email');

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                error: "User not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Profile image uploaded successfully",
            data: {
                profileImage: updatedUser.profileImage
            }
        });

        // Log profile image upload
        await createActivityLog({
            userId,
            type: 'update',
            action: 'Profile Image Updated',
            description: 'Updated account profile picture',
            ip: req.ip,
            device: req.headers['user-agent'],
            status: 'success'
        });

    } catch (error) {
        console.error("Upload profile image error:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to update profile image"
        });
    }
};

/**
 * Delete profile image
 */
const deleteProfileImage = async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId);

        if (!user.profileImage?.publicId) {
            return res.status(400).json({
                success: false,
                error: "No profile image to delete"
            });
        }

        // Get Cloudinary instance from config
        const { v2: cloudinary } = require('cloudinary');
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });

        // Delete from Cloudinary
        await cloudinary.uploader.destroy(user.profileImage.publicId);

        // Update user
        user.profileImage = undefined;
        user.updatedBy = userId;
        await user.save();

        res.status(200).json({
            success: true,
            message: "Profile image deleted successfully"
        });

    } catch (error) {
        console.error("Delete profile image error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to delete profile image"
        });
    }
};

// ==================== PASSWORD MANAGEMENT ====================

/**
 * Change password
 */
const changePassword = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: "Current password and new password are required"
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                error: "New password must be at least 8 characters"
            });
        }

        // Get user with password
        const user = await User.findById(userId).select('+password');
        if (!user) {
            return res.status(404).json({
                success: false,
                error: "User not found"
            });
        }

        // Verify current password
        const isPasswordValid = await user.comparePassword(currentPassword);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: "Current password is incorrect"
            });
        }

        // Update password
        user.password = newPassword;
        user.passwordChangedAt = new Date();
        user.updatedBy = userId;
        await user.save();

        // Send notification email
        try {
            await sendPasswordResetEmail({
                email: user.email,
                name: user.name,
                type: 'password_changed'
            });
        } catch (error) {
            console.error('Password changed email error:', error);
        }

        res.status(200).json({
            success: true,
            message: "Password changed successfully"
        });

        // Log password change
        await createActivityLog({
            userId,
            type: 'security',
            action: 'Password Changed',
            description: 'Updated account security password',
            ip: req.ip,
            device: req.headers['user-agent'],
            status: 'success'
        });

        // Trigger in-app notification
        try {
            await notifyAccountUpdate(userId, 'password');
        } catch (e) {
            console.error(`Password change notification failed: ${e.message}`);
        }

    } catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to change password"
        });
    }
};

/**
 * Forgot password - Initiate password reset
 */
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: "Email is required"
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: "Please enter a valid email address"
            });
        }

        // Check for user (including soft-deleted)
        const user = await User.findOne({ email }).setOptions({ includeDeleted: true });
        if (!user) {
            // Consider returning a generic message for security
            return res.status(200).json({
                success: true,
                message: "If your email is registered, you'll receive a password reset link shortly."
            });
        }

        if (user.isDeleted) {
            return res.status(403).json({
                success: false,
                error: "This account has been deactivated or deleted. Please contact support for assistance."
            });
        }

        // Generate reset token
        const resetToken = user.createPasswordResetToken();
        await user.save();

        // Send reset email
        const clientUrl = process.env.CLIENT_URL;
        const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

        try {
            // Add timeout to email sending
            await Promise.race([
                sendPasswordResetEmail({
                    email: user.email,
                    name: user.name,
                    resetUrl,
                    type: 'reset_request'
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Email sending timeout')), 10000)
                )
            ]);

            console.log(`Password reset email sent to ${user.email}`);

            // Trigger in-app notification
            notifyPasswordResetRequest(user._id).catch(e => {
                console.error(`Reset notification failed: ${e.message}`);
            });

            return res.status(200).json({
                success: true,
                message: "Password reset link sent to your email",
                // Optionally include email for debugging (remove in production)
                debug: process.env.NODE_ENV === 'development' ? { email: user.email } : undefined
            });

        } catch (emailError) {
            console.error('Failed to send password reset email:', emailError);

            // Remove the reset token since email failed
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save();

            return res.status(500).json({
                success: false,
                error: "Failed to send reset email. Please try again later."
            });
        }

    } catch (error) {
        console.error("Forgot password error:", error);

        // More specific error messages
        let errorMessage = "Failed to process password reset request";
        if (error.name === 'MongoError' || error.name === 'MongoServerError') {
            errorMessage = "Database error. Please try again.";
        } else if (error.code === 'ETIMEDOUT') {
            errorMessage = "Request timeout. Please try again.";
        }

        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
};

/**
 * Reset password with token
 */
const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password || password.length < 8) {
            return res.status(400).json({
                success: false,
                error: "Password must be at least 8 characters"
            });
        }

        // Hash token for comparison
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        // Find user with valid reset token
        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() }
        }).select('+passwordResetToken +passwordResetExpires');

        if (!user) {
            return res.status(400).json({
                success: false,
                error: "Invalid or expired reset token"
            });
        }

        // Update password
        user.password = password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        user.passwordChangedAt = new Date();

        // If account was pending, activate it as password reset proves email ownership
        if (user.status === USER_STATUS.PENDING) {
            user.status = USER_STATUS.ACTIVE;
            user.emailVerified = true;
        }

        await user.save();

        // Send confirmation email
        try {
            await sendPasswordResetEmail({
                email: user.email,
                name: user.name,
                type: 'password_reset'
            });
        } catch (error) {
            console.error('Password reset success email error:', error);
        }

        // Trigger in-app notification
        try {
            await notifyPasswordResetSuccess(user._id);
        } catch (e) {
            console.error(`Reset success notification failed: ${e.message}`);
        }

        // Log password reset activity
        await createActivityLog({
            userId: user._id,
            type: 'security',
            action: 'Password Reset Successful',
            description: 'Reset password via account security',
            ip: req.ip,
            device: req.headers['user-agent'],
            status: 'success'
        });

        res.status(200).json({
            success: true,
            message: "Password reset successful. You can now login with your new password."
        });

    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to reset password"
        });
    }
};

// ==================== EMAIL & PHONE VERIFICATION ====================

/**
 * Verify email
 */
const verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;

        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        // Find user with valid verification token (including soft-deleted)
        const user = await User.findOne({
            emailVerificationToken: hashedToken
        }).setOptions({ includeDeleted: true });

        if (!user) {
            return res.status(400).json({
                success: false,
                error: "Invalid verification token"
            });
        }

        if (user.emailVerificationExpires < Date.now()) {
            return res.status(400).json({
                success: false,
                error: "Verification token has expired"
            });
        }

        // Update user
        user.emailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;

        // Activate account if this is the first verification
        if (user.status === USER_STATUS.PENDING) {
            user.status = USER_STATUS.ACTIVE;
        }

        // If user was deleted, reactivate them upon successful verification
        if (user.isDeleted) {
            user.isDeleted = false;
            user.deletedAt = undefined;
            user.deleteReason = undefined;
        }

        await user.save();

        // Trigger in-app notification
        try {
            await notifyEmailVerified(user._id);
        } catch (e) {
            console.error(`Email verification notification failed: ${e.message}`);
        }

        // Log email verification
        await createActivityLog({
            userId: user._id,
            type: 'security',
            action: 'Email Verified',
            description: 'Verified email address for account security',
            ip: req.ip,
            device: req.headers['user-agent'],
            status: 'success'
        });

        // Generate auth response for auto-login
        const authResponse = generateAuthResponse(user, {
            deviceId: req.headers['device-id'],
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(200).json({
            success: true,
            message: "Email verified successfully. You have been automatically logged in.",
            data: authResponse
        });

    } catch (error) {
        console.error("Verify email error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to verify email"
        });
    }
};

/**
 * Resend verification email
 */
const resendVerificationEmail = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: "Email is required"
            });
        }

        // Find user (including soft-deleted)
        const user = await User.findOne({ email }).setOptions({ includeDeleted: true });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: "User not found"
            });
        }

        if (user.emailVerified) {
            return res.status(400).json({
                success: false,
                error: "Email is already verified"
            });
        }

        // Generate new verification token
        const verificationToken = user.createEmailVerificationToken();
        await user.save();

        // Send verification email
        const clientUrl = process.env.CLIENT_URL;
        try {
            await sendVerificationEmail({
                email: user.email,
                name: user.name,
                verificationUrl: `${clientUrl}/verify-email/${verificationToken}`
            });
        } catch (error) {
            console.error('Resend verification email error:', error);
        }

        res.status(200).json({
            success: true,
            message: "Verification email sent successfully"
        });

    } catch (error) {
        console.error("Resend verification error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to resend verification email"
        });
    }
};

/**
 * Send phone verification OTP
 */
const sendPhoneVerificationOTP = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({
                success: false,
                error: "Phone number is required"
            });
        }

        // Validate phone
        if (!validator.isMobilePhone(phone, 'any', { strictMode: false })) {
            return res.status(400).json({
                success: false,
                error: "Please provide a valid phone number"
            });
        }

        // Check if phone is already used by another user
        const existingUser = await User.findOne({
            phone,
            _id: { $ne: userId }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: "Phone number is already registered to another account"
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: "User not found"
            });
        }

        // Generate and send OTP (implement OTP service)
        const otp = generateOTP();
        // await sendOTPviaSMS(phone, otp); // Implement SMS service

        // Store OTP in user session or separate collection
        // For now, we'll simulate
        user.phone = phone;
        user.phoneVerificationOTP = otp;
        user.phoneVerificationOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        res.status(200).json({
            success: true,
            message: "OTP sent to your phone number"
        });

    } catch (error) {
        console.error("Send phone OTP error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to send verification OTP"
        });
    }
};

/**
 * Verify phone with OTP
 */
const verifyPhoneOTP = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { otp } = req.body;

        if (!otp) {
            return res.status(400).json({
                success: false,
                error: "OTP is required"
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: "User not found"
            });
        }

        // Verify OTP (implement proper OTP verification)
        if (!user.phoneVerificationOTP || user.phoneVerificationOTP !== otp) {
            return res.status(400).json({
                success: false,
                error: "Invalid OTP"
            });
        }

        if (user.phoneVerificationOTPExpires < Date.now()) {
            return res.status(400).json({
                success: false,
                error: "OTP has expired"
            });
        }

        // Update user
        user.phoneVerified = true;
        user.phoneVerificationOTP = undefined;
        user.phoneVerificationOTPExpires = undefined;
        await user.save();

        res.status(200).json({
            success: true,
            message: "Phone number verified successfully"
        });

    } catch (error) {
        console.error("Verify phone OTP error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to verify phone number"
        });
    }
};

// ==================== ADMIN CONTROLLERS ====================

/**
 * Get all users (Admin only)
 */
const getAllUsers = async (req, res) => {
    try {
        // Check admin permission
        if (req.user.role !== USER_ROLES.ADMIN && req.user.role !== USER_ROLES.MANAGER) {
            return res.status(403).json({
                success: false,
                error: "Access denied. Admin privileges required."
            });
        }

        const {
            search,
            role,
            status,
            city,
            country,
            dateFrom,
            dateTo,
            kycStatus,
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const filters = {
            search,
            role,
            status,
            city,
            country,
            dateFrom,
            dateTo,
            kycStatus,
            page: parseInt(page),
            limit: parseInt(limit) > 50 ? 50 : parseInt(limit), // Max 50 per page
            sortBy,
            sortOrder
        };

        const users = await User.searchUsers(filters);

        // Get total count for pagination
        const total = await User.countDocuments({ isDeleted: false });

        res.status(200).json({
            success: true,
            data: users,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("Get all users error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch users"
        });
    }
};

/**
 * Get user by ID (Admin only)
 */
const getUserById = async (req, res) => {
    try {
        // Check admin permission
        if (req.user.role !== USER_ROLES.ADMIN && req.user.role !== USER_ROLES.MANAGER) {
            return res.status(403).json({
                success: false,
                error: "Access denied. Admin privileges required."
            });
        }

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: "Invalid user ID"
            });
        }

        const user = await User.findById(id)
            .select('-password -twoFactorSecret -twoFactorBackupCodes')
            .populate('referredBy', 'name email')
            .populate('createdBy', 'name email')
            .populate('updatedBy', 'name email');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: "User not found"
            });
        }

        res.status(200).json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error("Get user by ID error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch user"
        });
    }
};

/**
 * Update user (Admin only)
 */
const updateUserById = async (req, res) => {
    try {
        // Check admin permission
        if (req.user.role !== USER_ROLES.ADMIN && req.user.role !== USER_ROLES.MANAGER) {
            return res.status(403).json({
                success: false,
                error: "Access denied. Admin privileges required."
            });
        }

        const { id } = req.params;
        const updateData = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: "Invalid user ID"
            });
        }

        // Remove sensitive fields
        delete updateData.password;
        delete updateData.createdAt;
        delete updateData.updatedAt;
        delete updateData._id;

        // Validate update data
        if (updateData.email) {
            const existingUser = await User.findOne({
                email: updateData.email,
                _id: { $ne: id }
            });
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    error: "Email already exists"
                });
            }
        }

        // If status is being changed, send notification
        const userBeforeUpdate = await User.findById(id);
        const shouldSendStatusEmail = updateData.status &&
            updateData.status !== userBeforeUpdate?.status;

        // Update user
        const updatedUser = await User.findByIdAndUpdate(
            id,
            {
                ...updateData,
                updatedBy: req.user.userId
            },
            { new: true, runValidators: true }
        ).select('-password -twoFactorSecret -twoFactorBackupCodes');

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                error: "User not found"
            });
        }

        // Send status change email if needed
        if (shouldSendStatusEmail && userBeforeUpdate?.email) {
            try {
                await sendAccountStatusChangeEmail({
                    email: userBeforeUpdate.email,
                    name: userBeforeUpdate.name,
                    oldStatus: userBeforeUpdate.status,
                    newStatus: updateData.status,
                    reason: updateData.statusChangeReason
                });
            } catch (error) {
                console.error('Account status change email error:', error);
            }
        }

        res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: updatedUser
        });

    } catch (error) {
        console.error("Update user by ID error:", error);
        res.status(500).json({
            success: false,
            error: process.env.NODE_ENV === 'production'
                ? "Failed to update user"
                : error.message
        });
    }
};

/**
 * Delete user (Admin only - soft delete)
 */
const deleteUserById = async (req, res) => {
    try {
        // Check admin permission
        if (req.user.role !== USER_ROLES.ADMIN) {
            return res.status(403).json({
                success: false,
                error: "Access denied. Admin privileges required."
            });
        }

        const { id } = req.params;
        const { reason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: "Invalid user ID"
            });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: "User not found"
            });
        }

        // Soft delete
        user.isDeleted = true;
        user.deletedAt = new Date();
        user.deleteReason = reason || "Deleted by admin";
        user.status = USER_STATUS.BANNED;
        user.updatedBy = req.user.userId;
        await user.save();

        res.status(200).json({
            success: true,
            message: "User deleted successfully"
        });

    } catch (error) {
        console.error("Delete user error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to delete user"
        });
    }
};

/**
 * Restore deleted user (Admin only)
 */
const restoreUser = async (req, res) => {
    try {
        // Check admin permission
        if (req.user.role !== USER_ROLES.ADMIN) {
            return res.status(403).json({
                success: false,
                error: "Access denied. Admin privileges required."
            });
        }

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: "Invalid user ID"
            });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: "User not found"
            });
        }

        // Restore user
        user.isDeleted = false;
        user.deletedAt = undefined;
        user.deleteReason = undefined;
        user.status = USER_STATUS.ACTIVE;
        user.updatedBy = req.user.userId;
        await user.save();

        res.status(200).json({
            success: true,
            message: "User restored successfully",
            data: user
        });

    } catch (error) {
        console.error("Restore user error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to restore user"
        });
    }
};

/**
 * Get user statistics (Admin only)
 */
const getUserStatistics = async (req, res) => {
    try {
        // Check admin permission
        if (req.user.role !== USER_ROLES.ADMIN && req.user.role !== USER_ROLES.MANAGER) {
            return res.status(403).json({
                success: false,
                error: "Access denied. Admin privileges required."
            });
        }

        const stats = await User.getStatistics();

        // Additional statistics
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const newUsersToday = await User.countDocuments({
            createdAt: { $gte: today },
            isDeleted: false
        });

        const activeUsersToday = await User.countDocuments({
            lastLoginAt: { $gte: today },
            isDeleted: false,
            status: USER_STATUS.ACTIVE
        });

        const kycStats = await User.aggregate([
            {
                $match: { isDeleted: false }
            },
            {
                $group: {
                    _id: "$kycStatus",
                    count: { $sum: 1 }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                ...stats,
                newUsersToday,
                activeUsersToday,
                kycStats: kycStats.reduce((acc, curr) => {
                    acc[curr._id] = curr.count;
                    return acc;
                }, {})
            }
        });

    } catch (error) {
        console.error("Get user statistics error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch user statistics"
        });
    }
};

/**
 * Get activity logs for current user
 */
const getActivityLogs = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { limit = 10, page = 1 } = req.query;

        const logs = await ActivityLog.find({ userId })
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        res.status(200).json(logs);

    } catch (error) {
        console.error("Get activity logs error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch activity logs"
        });
    }
};

/**
 * Helper to create an activity log
 */
const createActivityLog = async (data) => {
    try {
        await ActivityLog.create({
            ...data,
            timestamp: new Date()
        });
    } catch (error) {
        logger.error("Error creating activity log:", error);
        // Don't throw, we don't want to break the main flow if logging fails
    }
};

// ==================== EXPORT ====================

module.exports = {
    // Authentication
    registerUser,
    loginUser,
    refreshToken,

    // Profile Management
    getCurrentUser,
    updateProfile,
    uploadProfileImage,
    deleteProfileImage,
    getActivityLogs,

    // Password Management
    changePassword,
    forgotPassword,
    resetPassword,

    // Verification
    verifyEmail,
    resendVerificationEmail,
    sendPhoneVerificationOTP,
    verifyPhoneOTP,

    // Admin Functions
    getAllUsers,
    getUserById,
    updateUserById,
    deleteUserById,
    restoreUser,
    getUserStatistics
};