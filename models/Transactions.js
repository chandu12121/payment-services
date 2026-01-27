const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
    // Primary identifiers
    transactionNumber: {
        type: String,
        unique: true,
        required: true,
        index: true,
        default: function () {
            return `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
        }
    },
    Id: {
        type: String,
        unique: true,
        sparse: true,
        index: true
    },

    // Reference relationships
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking"
    },
    invoiceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Invoice"
    },
    parentTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Transaction"
    },

    // Payment gateway identifiers
    razorpayPaymentId: {
        type: String,
        required: true,
        index: true
    },
    razorpayOrderId: {
        type: String,
        required: true,
        index: true
    },
    razorpaySignature: String,

    // Transaction details
    type: {
        type: String,
        enum: ["payment", "refund", "chargeback", "adjustment", "transfer"],
        required: true,
        default: "payment"
    },
    paymentType: {
        type: String,
        enum: ["card", "netbanking", "wallet", "upi", "cash", "bank_transfer", "emi", "prepaid_card", "general", "service", "product", "subscription", "booking", "donation"],
        required: true
    },

    // Amount details
    amount: {
        type: Number,
        required: true,
        min: 0,
        get: v => (v / 100).toFixed(2),
        set: v => Math.round(v * 100)
    },
    currency: {
        type: String,
        default: "INR",
        enum: ["INR", "USD", "EUR", "GBP"],
        required: true
    },
    fee: {
        type: Number,
        default: 0,
        min: 0,
        get: v => (v / 100).toFixed(2),
        set: v => Math.round(v * 100)
    },
    tax: {
        type: Number,
        default: 0,
        min: 0,
        get: v => (v / 100).toFixed(2),
        set: v => Math.round(v * 100)
    },
    netAmount: {
        type: Number,
        min: 0,
        get: v => (v / 100).toFixed(2),
        set: v => Math.round(v * 100)
    },

    // Status tracking
    status: {
        type: String,
        enum: ["initiated", "pending", "processing", "success", "failed", "cancelled", "refunded", "partially_refunded", "chargeback", "disputed"],
        default: "initiated",
        required: true
    },

    // Payment method details
    method: {
        type: String,
        required: true
    },
    methodDetails: {
        // Card payments
        card: {
            last4: String,
            network: String,
            type: String,
            issuer: String,
            issuerCountry: String
        },
        // UPI payments
        upi: {
            vpa: String,
            payerVpa: String
        },
        // Net Banking
        netbanking: {
            bank: String,
            bankCode: String
        },
        // Wallet
        wallet: {
            walletName: String,
            walletId: String
        },
        // Bank Transfer
        bankTransfer: {
            bankName: String,
            accountNumber: String,
            ifscCode: String
        }
    },

    // Customer details
    customer: {
        email: {
            type: String,
            lowercase: true
        },
        contact: String,
        name: String,
        ipAddress: String,
        userAgent: String
    },

    // Business details
    businessDetails: {
        gstNumber: String,
        taxId: String,
        businessName: String
    },

    // Error handling
    error: {
        code: String,
        description: String,
        source: String,
        step: String,
        gatewayResponse: mongoose.Schema.Types.Mixed
    },

    // Risk and fraud detection
    riskScore: {
        type: Number,
        min: 0,
        max: 100
    },
    riskFlags: [String],
    isFlagged: {
        type: Boolean,
        default: false
    },

    // Refund details
    refundDetails: {
        reason: String,
        initiatedBy: {
            type: String,
            enum: ["customer", "merchant", "system"]
        },
        initiatedAt: Date,
        processedAt: Date,
        refundId: String,
        notes: String
    },

    // Settlement details
    settlement: {
        settled: {
            type: Boolean,
            default: false
        },
        settlementId: String,
        settlementDate: Date,
        settlementAmount: {
            type: Number,
            min: 0,
            get: v => (v / 100).toFixed(2),
            set: v => Math.round(v * 100)
        }
    },

    // Metadata
    description: String,
    notes: String,
    metadata: mongoose.Schema.Types.Mixed,

    // Timeline
    timeline: [{
        status: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        note: String,
        performedBy: mongoose.Schema.Types.ObjectId
    }],

    // Webhook and callback data
    webhookReceived: {
        type: Boolean,
        default: false
    },
    webhookPayload: mongoose.Schema.Types.Mixed,
    callbackUrl: String,

    // Audit fields
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    // Soft delete
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: Date
}, {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
});

// Compound indexes
transactionSchema.index({ userId: 1, status: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ razorpayPaymentId: 1, razorpayOrderId: 1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ 'customer.email': 1 });
transactionSchema.index({ amount: 1, status: 1 });

// Pre-save middleware
transactionSchema.pre('save', function (next) {
    if (this.isModified('amount') || this.isModified('fee') || this.isModified('tax')) {
        this.netAmount = this.amount - this.fee - this.tax;
    }

    if (this.isModified('status')) {
        this.timeline.push({
            status: this.status,
            note: 'Status updated',
            timestamp: new Date()
        });
    }
    next();
});

// Static methods
transactionSchema.statics.getTotalRevenue = async function (startDate, endDate) {
    const match = {
        status: 'success',
        type: 'payment',
        isDeleted: false
    };

    if (startDate) match.createdAt = { $gte: startDate };
    if (endDate) match.createdAt = { ...match.createdAt, $lte: endDate };

    const result = await this.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                totalAmount: { $sum: "$amount" },
                totalTransactions: { $sum: 1 },
                averageAmount: { $avg: "$amount" }
            }
        }
    ]);

    return result[0] || { totalAmount: 0, totalTransactions: 0, averageAmount: 0 };
};

transactionSchema.statics.findFailedTransactions = function (days = 7) {
    const date = new Date();
    date.setDate(date.getDate() - days);

    return this.find({
        status: 'failed',
        createdAt: { $gte: date },
        isDeleted: false
    }).sort({ createdAt: -1 });
};

// Virtual for formatted amount
transactionSchema.virtual('formattedAmount').get(function () {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: this.currency
    }).format(this.amount / 100);
});

module.exports = mongoose.model("Transaction", transactionSchema);