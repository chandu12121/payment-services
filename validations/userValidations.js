const Joi = require("joi");
const { USER_ROLES, USER_STATUS } = require("../models/users");

// Common validation patterns
const email = Joi.string().email().lowercase().trim().required();
const password = Joi.string().min(8).max(128).required();
const phone = Joi.string().pattern(/^\+?[1-9]\d{1,14}$/); // E.164 format
const name = Joi.string().min(2).max(100).trim().required();
// const dateOfBirth = Joi.date().max('now').required();

// Address validation
const addressSchema = Joi.object({
    type: Joi.string().valid("home", "work", "billing", "shipping", "other"),
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    country: Joi.string().default("India"),
    postalCode: Joi.string().required(),
    isDefault: Joi.boolean().default(false),
    landmark: Joi.string().allow('')
});

// Validation schemas
const registerSchema = Joi.object({
    name,
    email,
    phone: phone.optional(),
    dateOfBirth: Joi.date().max('now').optional(),
    address: Joi.string().required(),
    addresses: Joi.array().items(addressSchema),
    password,
    confirmPassword: Joi.string().valid(Joi.ref('password')).required()
        .messages({ 'any.only': 'Passwords do not match' }),
    referralCode: Joi.string().optional(),
    businessDetails: Joi.object({
        businessName: Joi.string(),
        gstNumber: Joi.string().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/),
        panNumber: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/),
        businessType: Joi.string(),
        registrationNumber: Joi.string(),
        taxId: Joi.string()
    }).optional()
});

const loginSchema = Joi.object({
    email: Joi.string().email().lowercase().trim(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
    password,
    deviceId: Joi.string().optional()
}).xor('email', 'phone');

const updateProfileSchema = Joi.object({
    name: Joi.string().min(2).max(100).trim(),
    phone,
    dateOfBirth: Joi.date().max('now'),
    address: Joi.string(),
    addresses: Joi.array().items(addressSchema),
    gender: Joi.string().valid("male", "female", "other", "prefer_not_to_say"),
    preferences: Joi.object({
        language: Joi.string().valid("en", "hi", "es", "fr", "de"),
        currency: Joi.string().valid("INR", "USD", "EUR", "GBP"),
        timezone: Joi.string().allow('', null),
        notifications: Joi.object({
            email: Joi.boolean(),
            sms: Joi.boolean(),
            push: Joi.boolean(),
            marketing: Joi.boolean()
        }),
        theme: Joi.string().valid("light", "dark", "auto")
    }).optional(),
    businessDetails: Joi.object({
        businessName: Joi.string().allow('', null),
        gstNumber: Joi.string().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).allow('', null),
        panNumber: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).allow('', null),
        businessType: Joi.string().allow('', null),
        registrationNumber: Joi.string().allow('', null),
        taxId: Joi.string().allow('', null)
    }).optional()
}).min(1); // At least one field required

const changePasswordSchema = Joi.object({
    currentPassword: password,
    newPassword: password.not(Joi.ref('currentPassword'))
        .messages({ 'any.invalid': 'New password must be different from current password' }),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
        .messages({ 'any.only': 'Passwords do not match' })
});

const forgotPasswordSchema = Joi.object({
    email
});

const resetPasswordSchema = Joi.object({
    password,
    confirmPassword: Joi.string().valid(Joi.ref('password')).required()
        .messages({ 'any.only': 'Passwords do not match' })
});

const verifyEmailSchema = Joi.object({
    email
});

const verifyPhoneSchema = Joi.object({
    otp: Joi.string().pattern(/^[0-9]{6}$/).required()
        .messages({ 'string.pattern.base': 'OTP must be 6 digits' })
});

const adminUpdateSchema = Joi.object({
    name: Joi.string().min(2).max(100).trim(),
    email: Joi.string().email().lowercase().trim(),
    phone,
    role: Joi.string().valid(...Object.values(USER_ROLES)),
    status: Joi.string().valid(...Object.values(USER_STATUS)),
    kycStatus: Joi.string().valid("not_started", "pending", "verified", "rejected", "under_review"),
    walletBalance: Joi.number().min(0),
    statusChangeReason: Joi.string().when('status', {
        is: Joi.exist(),
        then: Joi.string().required(),
        otherwise: Joi.string().optional()
    })
});

const adminSearchSchema = Joi.object({
    search: Joi.string().optional(),
    role: Joi.string().valid(...Object.values(USER_ROLES)).optional(),
    status: Joi.string().valid(...Object.values(USER_STATUS)).optional(),
    city: Joi.string().optional(),
    country: Joi.string().optional(),
    dateFrom: Joi.date().optional(),
    dateTo: Joi.date().optional(),
    kycStatus: Joi.string().valid("not_started", "pending", "verified", "rejected", "under_review").optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('createdAt', 'updatedAt', 'name', 'email', 'lastLoginAt').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

module.exports = {
    registerSchema,
    loginSchema,
    updateProfileSchema,
    changePasswordSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    verifyEmailSchema,
    verifyPhoneSchema,
    adminUpdateSchema,
    adminSearchSchema,
    addressSchema
};