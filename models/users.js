const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const validator = require("validator");

// Define user roles and permissions
const USER_ROLES = {
    CUSTOMER: "customer",
    ADMIN: "admin",
    MANAGER: "manager",
    AGENT: "agent",
    SUPPORT: "support"
};

const USER_STATUS = {
    ACTIVE: "active",
    INACTIVE: "inactive",
    SUSPENDED: "suspended",
    PENDING: "pending",
    BANNED: "banned"
};

const userSchema = new mongoose.Schema({
    // Basic Information
    name: {
        type: String,
        required: [true, "Name is required"],
        trim: true,
        minlength: [2, "Name must be at least 2 characters"],
        maxlength: [100, "Name cannot exceed 100 characters"]
    },

    // Authentication Information
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: validator.isEmail,
            message: "Please provide a valid email address"
        }
    },

    // Optional alternative email
    alternateEmail: {
        type: String,
        lowercase: true,
        trim: true,
        validate: {
            validator: function (v) {
                return v === '' || validator.isEmail(v);
            },
            message: "Please provide a valid alternate email address"
        }
    },

    phone: {
        type: String,
        trim: true,
        validate: {
            validator: function (v) {
                return v === '' || validator.isMobilePhone(v, 'any', { strictMode: false });
            },
            message: "Please provide a valid phone number"
        }
    },

    phoneVerified: {
        type: Boolean,
        default: false
    },

    // Personal Information
    dateOfBirth: {
        type: Date,
        validate: {
            validator: function (v) {
                if (!v) return true; // Skip validation if not provided
                const age = new Date().getFullYear() - new Date(v).getFullYear();
                return age >= 13; // Minimum age requirement
            },
            message: "User must be at least 13 years old"
        }
    },

    gender: {
        type: String,
        enum: ["male", "female", "other", "prefer_not_to_say"],
        default: "prefer_not_to_say"
    },

    // Address Information (structured)
    address: {
        type: String,
        required: [true, "Address is required"],
        trim: true
    },

    addresses: [{
        type: {
            type: String,
            enum: ["home", "work", "billing", "shipping", "other"],
            default: "home"
        },
        street: {
            type: String,
            required: true,
            trim: true
        },
        city: {
            type: String,
            required: true,
            trim: true
        },
        state: {
            type: String,
            required: true,
            trim: true
        },
        country: {
            type: String,
            required: true,
            trim: true,
            default: "India"
        },
        postalCode: {
            type: String,
            required: true,
            trim: true
        },
        isDefault: {
            type: Boolean,
            default: false
        },
        landmark: String
    }],

    // Authentication Security
    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: [8, "Password must be at least 8 characters"],
        select: false // Never return password in queries
    },

    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    passwordResetAttempts: {
        type: Number,
        default: 0
    },

    // Account Security
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    twoFactorSecret: {
        type: String,
        select: false
    },
    twoFactorBackupCodes: [{
        type: String,
        select: false
    }],

    // Email Verification
    emailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,

    // Account Status & Roles
    role: {
        type: String,
        enum: Object.values(USER_ROLES),
        default: USER_ROLES.CUSTOMER
    },

    status: {
        type: String,
        enum: Object.values(USER_STATUS),
        default: USER_STATUS.PENDING
    },

    // Profile & Preferences
    profileImage: {
        url: String,
        publicId: String, // For cloud storage
        uploadedAt: Date
    },

    preferences: {
        language: {
            type: String,
            default: "en",
            enum: ["en", "hi", "es", "fr", "de"]
        },
        currency: {
            type: String,
            default: "INR",
            enum: ["INR", "USD", "EUR", "GBP"]
        },
        timezone: {
            type: String,
            default: "Asia/Kolkata"
        },
        notifications: {
            email: {
                type: Boolean,
                default: true
            },
            sms: {
                type: Boolean,
                default: false
            },
            push: {
                type: Boolean,
                default: true
            },
            marketing: {
                type: Boolean,
                default: false
            }
        },
        theme: {
            type: String,
            enum: ["light", "dark", "auto"],
            default: "light"
        }
    },

    // Social & OAuth Connections
    socialAccounts: [{
        provider: {
            type: String,
            enum: ["google", "facebook", "twitter", "github", "linkedin"]
        },
        providerId: String,
        accessToken: String,
        refreshToken: String,
        connectedAt: Date
    }],

    // Business Information (for B2B)
    businessDetails: {
        businessName: String,
        gstNumber: String,
        panNumber: String,
        businessType: String,
        registrationNumber: String,
        taxId: String
    },

    // Activity Tracking
    lastLoginAt: Date,
    lastLoginIp: String,
    loginCount: {
        type: Number,
        default: 0
    },

    devices: [{
        deviceId: String,
        deviceType: String,
        os: String,
        browser: String,
        lastActive: Date,
        ipAddress: String,
        location: {
            city: String,
            country: String,
            latitude: Number,
            longitude: Number
        },
        isTrusted: {
            type: Boolean,
            default: false
        }
    }],

    // Referral System
    referralCode: {
        type: String
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    referralCount: {
        type: Number,
        default: 0
    },

    // Financial Information
    walletBalance: {
        type: Number,
        default: 0,
        min: 0,
        get: v => (v / 100).toFixed(2),
        set: v => Math.round(v * 100)
    },

    // KYC/AML Compliance
    kycStatus: {
        type: String,
        enum: ["not_started", "pending", "verified", "rejected", "under_review"],
        default: "not_started"
    },
    kycDocuments: [{
        documentType: {
            type: String,
            enum: ["aadhaar", "pan", "passport", "driving_license", "voter_id"]
        },
        frontUrl: String,
        backUrl: String,
        verifiedAt: Date,
        verifiedBy: mongoose.Schema.Types.ObjectId,
        rejectionReason: String
    }],
    kycVerifiedAt: Date,

    // Audit Fields
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    // Metadata
    metadata: mongoose.Schema.Types.Mixed,

    // Soft Delete
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: Date,
    deleteReason: String

}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        getters: true,
        transform: function (doc, ret) {
            // Remove sensitive fields
            delete ret.password;
            delete ret.twoFactorSecret;
            delete ret.twoFactorBackupCodes;
            delete ret.passwordResetToken;
            delete ret.passwordResetExpires;
            delete ret.emailVerificationToken;
            delete ret.emailVerificationExpires;
            delete ret.socialAccounts;
            return ret;
        }
    },
    toObject: {
        virtuals: true,
        getters: true
    }
});

// ==================== INDEXES ====================
// userSchema.index({ email: 1 }, { unique: true }); // Removed duplicate index
userSchema.index({ role: 1, status: 1 });
userSchema.index({ "addresses.city": 1 });
userSchema.index({ "addresses.country": 1 });
userSchema.index({ referralCode: 1 }, { sparse: true });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLoginAt: -1 });
userSchema.index({ phone: 1 }, { sparse: true });
userSchema.index({ "businessDetails.gstNumber": 1 }, { sparse: true });

// ==================== VIRTUALS ====================
userSchema.virtual("fullName").get(function () {
    return this.name;
});

userSchema.virtual("age").get(function () {
    if (!this.dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
});

userSchema.virtual("isActive").get(function () {
    return this.status === USER_STATUS.ACTIVE;
});

userSchema.virtual("isAdmin").get(function () {
    return this.role === USER_ROLES.ADMIN;
});

userSchema.virtual("isCustomer").get(function () {
    return this.role === USER_ROLES.CUSTOMER;
});

// ==================== PRE-SAVE MIDDLEWARE ====================
userSchema.pre("save", async function (next) {
    // Only hash password if it's modified
    if (!this.isModified("password")) return next();

    try {
        // Hash password
        this.password = await bcrypt.hash(this.password, 12);

        // Set password changed timestamp
        if (!this.isNew) {
            this.passwordChangedAt = Date.now() - 1000;
        }
        next();
    } catch (error) {
        next(error);
    }
});

// Generate referral code before save if not exists
userSchema.pre("save", function (next) {
    if (!this.referralCode) {
        this.referralCode = this.generateReferralCode();
    }
    next();
});

// Update timestamps for certain operations
userSchema.pre("save", function (next) {
    if (this.isModified("status") && this.status === USER_STATUS.ACTIVE && !this.emailVerified) {
        this.emailVerified = true;
    }
    next();
});

// ==================== INSTANCE METHODS ====================
// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Check if password was changed after token was issued
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

// Generate password reset token
userSchema.methods.createPasswordResetToken = function () {
    const resetToken = crypto.randomBytes(32).toString("hex");

    this.passwordResetToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

    this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    return resetToken;
};

// Generate email verification token
userSchema.methods.createEmailVerificationToken = function () {
    const verificationToken = crypto.randomBytes(32).toString("hex");

    this.emailVerificationToken = crypto
        .createHash("sha256")
        .update(verificationToken)
        .digest("hex");

    this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    return verificationToken;
};

// Generate JWT token
userSchema.methods.generateAuthToken = function (deviceInfo = {}) {
    const payload = {
        userId: this._id,
        email: this.email,
        role: this.role,
        status: this.status
    };

    const token = jwt.sign(
        payload,
        process.env.JWT_SECRET || "your-secret-key",
        {
            expiresIn: process.env.JWT_EXPIRES_IN || "7d",
            issuer: process.env.JWT_ISSUER || "your-app",
            audience: process.env.JWT_AUDIENCE || "your-app-users"
        }
    );

    // Track device if provided
    if (deviceInfo.deviceId) {
        const existingDeviceIndex = this.devices.findIndex(
            device => device.deviceId === deviceInfo.deviceId
        );

        const deviceData = {
            deviceId: deviceInfo.deviceId,
            deviceType: deviceInfo.deviceType,
            os: deviceInfo.os,
            browser: deviceInfo.browser,
            lastActive: new Date(),
            ipAddress: deviceInfo.ipAddress,
            location: deviceInfo.location
        };

        if (existingDeviceIndex > -1) {
            this.devices[existingDeviceIndex] = deviceData;
        } else {
            this.devices.push(deviceData);
        }
    }

    return token;
};

// Generate referral code
userSchema.methods.generateReferralCode = function () {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${code}${this._id.toString().slice(-4)}`;
};

// Add address
userSchema.methods.addAddress = function (addressData) {
    if (addressData.isDefault) {
        // Remove default from other addresses
        this.addresses.forEach(addr => {
            addr.isDefault = false;
        });
    }

    this.addresses.push(addressData);
    return this.save();
};

// Get default address
userSchema.methods.getDefaultAddress = function () {
    return this.addresses.find(addr => addr.isDefault) || this.addresses[0];
};

// ==================== STATIC METHODS ====================
// Find active users
userSchema.statics.findActiveUsers = function () {
    return this.find({
        status: USER_STATUS.ACTIVE,
        isDeleted: false
    });
};

// Find by email (with password for auth)
userSchema.statics.findByEmail = function (email, includePassword = false) {
    const query = this.findOne({ email, isDeleted: false });
    if (includePassword) {
        return query.select("+password");
    }
    return query;
};

// Get user statistics
userSchema.statics.getStatistics = async function () {
    const stats = await this.aggregate([
        {
            $match: { isDeleted: false }
        },
        {
            $group: {
                _id: "$status",
                count: { $sum: 1 },
                totalBalance: { $sum: "$walletBalance" }
            }
        },
        {
            $group: {
                _id: null,
                totalUsers: { $sum: "$count" },
                statusCounts: { $push: { status: "$_id", count: "$count" } },
                totalWalletBalance: { $sum: "$totalBalance" }
            }
        },
        {
            $project: {
                _id: 0,
                totalUsers: 1,
                statusCounts: 1,
                totalWalletBalance: 1,
                averageBalance: { $divide: ["$totalWalletBalance", "$totalUsers"] }
            }
        }
    ]);

    return stats[0] || { totalUsers: 0, statusCounts: [], totalWalletBalance: 0, averageBalance: 0 };
};

// Search users with filters
userSchema.statics.searchUsers = function (filters = {}) {
    const {
        search,
        role,
        status,
        city,
        country,
        dateFrom,
        dateTo,
        minAge,
        maxAge,
        kycStatus,
        hasOrders,
        page = 1,
        limit = 20,
        sortBy = "createdAt",
        sortOrder = "desc"
    } = filters;

    const query = { isDeleted: false };

    // Text search
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } }
        ];
    }

    // Filter by role
    if (role) query.role = role;

    // Filter by status
    if (status) query.status = status;

    // Filter by address
    if (city) query["addresses.city"] = city;
    if (country) query["addresses.country"] = country;

    // Filter by date range
    if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    // Filter by age range
    if (minAge || maxAge) {
        const now = new Date();
        const maxDate = minAge ? new Date(now.getFullYear() - minAge, now.getMonth(), now.getDate()) : null;
        const minDate = maxAge ? new Date(now.getFullYear() - maxAge - 1, now.getMonth(), now.getDate()) : null;

        if (maxDate) query.dateOfBirth = { ...query.dateOfBirth, $lte: maxDate };
        if (minDate) query.dateOfBirth = { ...query.dateOfBirth, $gte: minDate };
    }

    // Filter by KYC status
    if (kycStatus) query.kycStatus = kycStatus;

    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    return this.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .select("-__v -updatedAt");
};

// ==================== QUERY MIDDLEWARE ====================
// Automatically filter out deleted users
userSchema.pre(/^find/, function (next) {
    const options = this.options || {};
    const queryOptions = typeof this.getOptions === 'function' ? this.getOptions() : {};

    if (options.includeDeleted || queryOptions.includeDeleted) {
        return next();
    }

    if (this.getQuery().isDeleted === undefined) {
        this.where({ isDeleted: { $ne: true } });
    }
    next();
});

// Populate referral data when needed
userSchema.pre(/^find/, function (next) {
    if (this.options.populateReferrals) {
        this.populate({
            path: "referredBy",
            select: "name email"
        });
    }
    next();
});

const User = mongoose.model("User", userSchema);

// Export constants
module.exports = {
    User,
    USER_ROLES,
    USER_STATUS
};