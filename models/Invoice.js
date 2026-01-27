const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema({
    // Primary identifiers
    invoiceNumber: {
        type: String,
        unique: true,
        required: true,
        index: true,
        default: function () {
            return `INV${Date.now()}${Math.floor(Math.random() * 1000)}`;
        }
    },

    // Reference relationships
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Transaction",
        required: true
    },
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        required: true
    },

    // Invoice details
    invoiceDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    dueDate: {
        type: Date,
        required: true,
        default: function () {
            const date = new Date();
            date.setDate(date.getDate() + 30); // 30 days due
            return date;
        }
    },
    issueDate: {
        type: Date,
        default: Date.now
    },

    // Amount details
    subtotal: {
        type: Number,
        required: true,
        min: 0,
        get: v => (v / 100).toFixed(2),
        set: v => Math.round(v * 100)
    },
    taxAmount: {
        type: Number,
        required: true,
        min: 0,
        get: v => (v / 100).toFixed(2),
        set: v => Math.round(v * 100)
    },
    discountAmount: {
        type: Number,
        default: 0,
        min: 0,
        get: v => (v / 100).toFixed(2),
        set: v => Math.round(v * 100)
    },
    shippingAmount: {
        type: Number,
        default: 0,
        min: 0,
        get: v => (v / 100).toFixed(2),
        set: v => Math.round(v * 100)
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0,
        get: v => (v / 100).toFixed(2),
        set: v => Math.round(v * 100)
    },
    amountPaid: {
        type: Number,
        default: 0,
        min: 0,
        get: v => (v / 100).toFixed(2),
        set: v => Math.round(v * 100)
    },
    balanceDue: {
        type: Number,
        min: 0,
        get: v => (v / 100).toFixed(2),
        set: v => Math.round(v * 100)
    },
    currency: {
        type: String,
        default: "INR",
        enum: ["INR", "USD", "EUR", "GBP"]
    },

    // Customer details (snapshot at time of invoice)
    customerDetails: {
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true,
            lowercase: true
        },
        phone: {
            type: String,
            required: true
        },
        billingAddress: {
            street: String,
            city: String,
            state: String,
            country: String,
            zipCode: String
        },
        shippingAddress: {
            street: String,
            city: String,
            state: String,
            country: String,
            zipCode: String
        },
        taxId: String,        // GSTIN, VAT, etc.
        businessName: String,
        customerId: String    // Your internal customer ID
    },

    // Invoice items
    items: [{
        itemId: mongoose.Schema.Types.ObjectId,
        itemType: String,
        description: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            default: 1
        },
        unitPrice: {
            type: Number,
            required: true,
            min: 0,
            get: v => (v / 100).toFixed(2),
            set: v => Math.round(v * 100)
        },
        unit: {
            type: String,
            default: "pc"
        },
        taxRate: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        taxAmount: {
            type: Number,
            min: 0,
            get: v => (v / 100).toFixed(2),
            set: v => Math.round(v * 100)
        },
        discountRate: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        discountAmount: {
            type: Number,
            default: 0,
            min: 0,
            get: v => (v / 100).toFixed(2),
            set: v => Math.round(v * 100)
        },
        totalAmount: {
            type: Number,
            min: 0,
            get: v => (v / 100).toFixed(2),
            set: v => Math.round(v * 100)
        }
    }],

    // Tax breakdown
    taxes: [{
        name: String,           // GST, VAT, Service Tax, etc.
        rate: Number,
        amount: {
            type: Number,
            min: 0,
            get: v => (v / 100).toFixed(2),
            set: v => Math.round(v * 100)
        }
    }],

    // Status
    status: {
        type: String,
        enum: ["draft", "sent", "paid", "overdue", "partially_paid", "void", "refunded", "disputed"],
        default: "draft"
    },
    paymentStatus: {
        type: String,
        enum: ["pending", "paid", "partial", "overdue", "refunded"],
        default: "pending"
    },

    // Payment details
    paymentTerms: {
        type: String,
        default: "Net 30"
    },
    paymentMethod: String,
    paymentReference: String,

    // Document management
    pdfUrl: String,
    pdfPath: String,
    sentAt: Date,
    viewedAt: Date,
    paidAt: Date,

    // Notes and terms
    notes: String,
    termsAndConditions: String,
    footerNote: String,

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
invoiceSchema.index({ userId: 1, status: 1 });
invoiceSchema.index({ invoiceNumber: 1, userId: 1 });
invoiceSchema.index({ 'customerDetails.email': 1 });
invoiceSchema.index({ dueDate: 1, status: 1 });

// Pre-save middleware
invoiceSchema.pre('save', function (next) {
    if (this.isModified('subtotal') || this.isModified('taxAmount') ||
        this.isModified('discountAmount') || this.isModified('shippingAmount')) {
        this.totalAmount = this.subtotal + this.taxAmount + this.shippingAmount - this.discountAmount;
        this.balanceDue = this.totalAmount - this.amountPaid;
    }

    // Check if overdue
    if (this.dueDate && new Date() > this.dueDate && this.status === 'sent') {
        this.status = 'overdue';
    }
    next();
});

// Static methods
invoiceSchema.statics.generateInvoiceNumber = async function () {
    const year = new Date().getFullYear();
    const count = await this.countDocuments({
        invoiceDate: { $gte: new Date(`${year}-01-01`), $lt: new Date(`${year + 1}-01-01`) }
    });
    return `INV${year}${(count + 1).toString().padStart(5, '0')}`;
};

invoiceSchema.statics.findOverdueInvoices = function () {
    return this.find({
        status: 'sent',
        dueDate: { $lt: new Date() },
        isDeleted: false
    });
};

// Virtual for days overdue
invoiceSchema.virtual('daysOverdue').get(function () {
    if (this.dueDate && this.status === 'overdue') {
        const today = new Date();
        const dueDate = new Date(this.dueDate);
        const diffTime = Math.abs(today - dueDate);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    return 0;
});

module.exports = mongoose.model("Invoice", invoiceSchema);