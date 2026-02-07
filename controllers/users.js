const mongoose = require("mongoose");
const { User, USER_ROLES, USER_STATUS } = require("../models/users");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const validator = require("validator");
const {
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendWelcomeEmail,
    sendAccountStatusChangeEmail
} = require("../services/emailNotification");
const { uploadFile, deleteFile } = require("../services/fileUpload");
const { generateOTP, verifyOTP } = require("../services/otpService");
const {
    notifyAccountUpdate,
    notifyWelcome,
    notifyPasswordResetRequest,
    notifyPasswordResetSuccess,
    notifyEmailVerified
} = require("../utils/notificationHelper");

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
            kycStatus: user.kycStatus,
            walletBalance: user.walletBalance
        }
    };
};

const validateUserData = (data, isUpdate = false) => {
    const errors = {};

    // Validate email
    if (data.email && !validator.isEmail(data.email)) {
        errors.email = "Please provide a valid email address";
    }

    // Validate phone
    if (data.phone && !validator.isMobilePhone(data.phone, 'any', { strictMode: false })) {
        errors.phone = "Please provide a valid phone number";
    }

    // Validate date of birth (minimum age 13)
    if (data.dateOfBirth) {
        const dob = new Date(data.dateOfBirth);
        const age = new Date().getFullYear() - dob.getFullYear();
        if (age < 13) {
            errors.dateOfBirth = "User must be at least 13 years old";
        }
    }

    // Validate password strength (for registration)
    if (!isUpdate && data.password && data.password.length < 8) {
        errors.password = "Password must be at least 8 characters";
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
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

        // Validate user data
        const validation = validateUserData({ email, phone, dateOfBirth, password });
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                errors: validation.errors
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
                // You might want to add referral bonus here
                await User.findByIdAndUpdate(referrer._id, {
                    $inc: { referralCount: 1 }
                });
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

        const newUser = new User(userData);
        const user = await newUser.save();

        // Send verification email
        const verificationToken = user.createEmailVerificationToken();
        await user.save();

        const clientUrl = process.env.CLIENT_URL;
        await sendVerificationEmail({
            email: user.email,
            name: user.name,
            verificationUrl: `${clientUrl}/verify-email/${verificationToken}`
        });

        // Send welcome email
        await sendWelcomeEmail({
            email: user.email,
            name: user.name
        });

        // Trigger in-app welcome notification
        notifyWelcome(user._id, user.name).catch(e => console.error(`Welcome notification failed: ${e.message}`));

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

        // Find user with password (bypass soft-delete filter initially to check status)
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
            // Increment failed login attempts if you track them
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
        const deviceInfo = {
            deviceId: deviceId || req.headers['device-id'] || `web-${Date.now()}`,
            deviceType: req.headers['device-type'] || 'web',
            os: req.headers['os'] || 'unknown',
            browser: req.headers['user-agent']?.split(' ')[0] || 'unknown',
            ipAddress: req.ip,
            location: req.headers['geo-location'] ? JSON.parse(req.headers['geo-location']) : undefined
        };

        const authResponse = generateAuthResponse(user, deviceInfo);

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

        // Validate update data
        const validation = validateUserData(updateData, true);
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                errors: validation.errors
            });
        }

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

        // Trigger in-app notification
        notifyAccountUpdate(userId, 'profile').catch(e => console.error(`Profile update notification failed: ${e.message}`));

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

        // Upload file (processes local file info)
        const uploadResult = await uploadFile(req.file);

        // Update user profile image
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

        res.status(200).json({
            success: true,
            message: "Profile image uploaded successfully",
            data: {
                profileImage: updatedUser.profileImage
            }
        });

    } catch (error) {
        console.error("Upload profile image error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to upload profile image"
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

        // Delete from local storage using service
        await deleteFile(user.profileImage.publicId);

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
        await sendPasswordResetEmail({
            email: user.email,
            name: user.name,
            type: 'password_changed'
        });

        res.status(200).json({
            success: true,
            message: "Password changed successfully"
        });

        // Trigger in-app notification
        notifyAccountUpdate(userId, 'password').catch(e => console.error(`Password change notification failed: ${e.message}`));

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

        // Check for user (including soft-deleted)
        const user = await User.findOne({ email }).setOptions({ includeDeleted: true });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: "This email is not registered. Please create an account or use a different email."
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

        await sendPasswordResetEmail({
            email: user.email,
            name: user.name,
            resetUrl,
            type: 'reset_request'
        });

        // Trigger in-app notification
        notifyPasswordResetRequest(user._id).catch(e => console.error(`Reset request notification failed: ${e.message}`));

        res.status(200).json({
            success: true,
            message: "Password reset link sent to your email"
        });

    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to process password reset request"
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
        await sendPasswordResetEmail({
            email: user.email,
            name: user.name,
            type: 'password_reset'
        });

        // Trigger in-app notification
        notifyPasswordResetSuccess(user._id).catch(e => console.error(`Reset success notification failed: ${e.message}`));

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
        notifyEmailVerified(user._id).catch(e => console.error(`Email verification notification failed: ${e.message}`));

        res.status(200).json({
            success: true,
            message: "Email verified successfully"
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
        await sendVerificationEmail({
            email: user.email,
            name: user.name,
            verificationUrl: `${clientUrl}/verify-email/${verificationToken}`
        });

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
            await sendAccountStatusChangeEmail({
                email: userBeforeUpdate.email,
                name: userBeforeUpdate.name,
                oldStatus: userBeforeUpdate.status,
                newStatus: updateData.status,
                reason: updateData.statusChangeReason
            });
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