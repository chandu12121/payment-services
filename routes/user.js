const express = require("express");
const router = express.Router();
const {
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
} = require("../controllers/users");

// Middleware imports
const { authenticate } = require("../middlewares/auth");
const { authorize } = require("../middlewares/authorize");
const { validate } = require("../middlewares/validation");
const upload = require("../middlewares/upload");
const rateLimit = require("../middlewares/rateLimit");

// Import validation schemas
const {
    registerSchema,
    loginSchema,
    updateProfileSchema,
    changePasswordSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    verifyEmailSchema,
    verifyPhoneSchema,
    adminUpdateSchema,
    adminSearchSchema
} = require("../validations/userValidations");

// Import user roles
const { USER_ROLES } = require("../models/users");

// ==================== PUBLIC ROUTES ====================

/**
 * @route   POST /api/users/register
 * @desc    Register a new user
 * @access  Public
 * @rate    5 per 15 minutes per IP
 */
router.post(
    "/register",
    rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5,
        message: "Too many registration attempts. Please try again later."
    }),
    validate(registerSchema),
    registerUser
);

/**
 * @route   POST /api/users/login
 * @desc    Login user
 * @access  Public
 * @rate    10 per 15 minutes per IP
 */
router.post(
    "/login",
    rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 10,
        message: "Too many login attempts. Please try again later."
    }),
    validate(loginSchema),
    loginUser
);

/**
 * @route   POST /api/users/refresh-token
 * @desc    Refresh access token
 * @access  Public (with valid refresh token)
 */
router.post(
    "/refresh-token",
    refreshToken
);

/**
 * @route   POST /api/users/forgot-password
 * @desc    Send password reset email
 * @access  Public
 * @rate    3 per hour per email
 */
router.post(
    "/forgot-password",
    rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 3,
        keyGenerator: (req) => {
            return req.body.email || req['ip'];
        }
    }),
    validate(forgotPasswordSchema),
    forgotPassword
);

/**
 * @route   PUT /api/users/reset-password/:token
 * @desc    Reset password with token
 * @access  Public
 * @rate    5 per 15 minutes per IP
 */
router.put(
    "/reset-password/:token",
    rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5,
        message: "Too many password reset attempts. Please try again later."
    }),
    validate(resetPasswordSchema),
    resetPassword
);

/**
 * @route   GET /api/users/verify-email/:token
 * @desc    Verify email address
 * @access  Public
 */
router.get(
    "/verify-email/:token",
    verifyEmail
);

/**
 * @route   POST /api/users/resend-verification
 * @desc    Resend verification email
 * @access  Public
 * @rate    3 per hour per email
 */
router.post(
    "/resend-verification",
    rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 3,
        keyGenerator: (req) => {
            return req.body.email || req['ip'];
        }
    }),
    validate(verifyEmailSchema),
    resendVerificationEmail
);

// ==================== PROTECTED ROUTES (Requires Authentication) ====================

/**
 * @route   GET /api/users/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
    "/me",
    authenticate,
    getCurrentUser
);

/**
 * @route   PUT /api/users/me
 * @desc    Update current user profile
 * @access  Private
 * @rate    10 per minute per user
 */
router.put(
    "/me",
    authenticate,
    rateLimit({
        windowMs: 60 * 1000,
        max: 10,
        keyGenerator: (req) => req.user.userId
    }),
    validate(updateProfileSchema),
    updateProfile
);

/**
 * @route   PUT /api/users/me/password
 * @desc    Change password
 * @access  Private
 * @rate    5 per 15 minutes per user
 */
router.put(
    "/me/password",
    authenticate,
    rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5,
        keyGenerator: (req) => req.user.userId,
        message: "Too many password change attempts. Please try again later."
    }),
    validate(changePasswordSchema),
    changePassword
);

/**
 * @route   POST /api/users/me/profile-image
 * @desc    Upload profile image
 * @access  Private
 * @rate    5 per hour per user
 */
router.post(
    "/me/profile-image",
    authenticate,
    rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 5,
        keyGenerator: (req) => req.user.userId
    }),
    upload.single("profileImage"),
    uploadProfileImage
);

/**
 * @route   DELETE /api/users/me/profile-image
 * @desc    Delete profile image
 * @access  Private
 * @rate    3 per hour per user
 */
router.delete(
    "/me/profile-image",
    authenticate,
    rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 3,
        keyGenerator: (req) => req.user.userId
    }),
    deleteProfileImage
);

/**
 * @route   POST /api/users/me/verify-phone/send
 * @desc    Send phone verification OTP
 * @access  Private
 * @rate    3 per hour per user
 */
router.post(
    "/me/verify-phone/send",
    authenticate,
    rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 3,
        keyGenerator: (req) => req.user.userId
    }),
    sendPhoneVerificationOTP
);

/**
 * @route   POST /api/users/me/verify-phone/confirm
 * @desc    Verify phone with OTP
 * @access  Private
 * @rate    5 per 15 minutes per user
 */
router.post(
    "/me/verify-phone/confirm",
    authenticate,
    rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5,
        keyGenerator: (req) => req.user.userId
    }),
    validate(verifyPhoneSchema),
    verifyPhoneOTP
);

// ==================== ADMIN ROUTES (Requires Admin/MANAGER Role) ====================

/**
 * @route   GET /api/users/admin
 * @desc    Get all users (with pagination and filters)
 * @access  Private (Admin/Manager only)
 */
router.get(
    "/admin",
    authenticate,
    authorize([USER_ROLES.ADMIN, USER_ROLES.MANAGER]),
    validate(adminSearchSchema, "query"),
    getAllUsers
);

/**
 * @route   GET /api/users/admin/statistics
 * @desc    Get user statistics
 * @access  Private (Admin/Manager only)
 */
router.get(
    "/admin/statistics",
    authenticate,
    authorize([USER_ROLES.ADMIN, USER_ROLES.MANAGER]),
    getUserStatistics
);

/**
 * @route   GET /api/users/admin/:id
 * @desc    Get user by ID
 * @access  Private (Admin/Manager only)
 */
router.get(
    "/admin/:id",
    authenticate,
    authorize([USER_ROLES.ADMIN, USER_ROLES.MANAGER]),
    getUserById
);

/**
 * @route   PUT /api/users/admin/:id
 * @desc    Update user by ID
 * @access  Private (Admin/Manager only)
 */
router.put(
    "/admin/:id",
    authenticate,
    authorize([USER_ROLES.ADMIN, USER_ROLES.MANAGER]),
    validate(adminUpdateSchema),
    updateUserById
);

/**
 * @route   DELETE /api/users/admin/:id
 * @desc    Delete user (soft delete)
 * @access  Private (Admin only)
 */
router.delete(
    "/admin/:id",
    authenticate,
    authorize([USER_ROLES.ADMIN]),
    deleteUserById
);

/**
 * @route   PUT /api/users/admin/:id/restore
 * @desc    Restore deleted user
 * @access  Private (Admin only)
 */
router.put(
    "/admin/:id/restore",
    authenticate,
    authorize([USER_ROLES.ADMIN]),
    restoreUser
);

// ==================== HEALTH CHECK ROUTE ====================

/**
 * @route   GET /api/users/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "User service is healthy",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "1.0.0"
    });
});

module.exports = router;