const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    // Primary identifiers
    bookingNumber: {
        type: String,
        unique: true,
        required: true,
        index: true,
        default: function () {
            return `BK${Date.now()}${Math.floor(Math.random() * 1000)}`;
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
    // 🏢 Seller Reference
    hostId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true
    },
    // 📦 Ecommerce Bridge
    ecommerceOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order"
    },
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Transaction",
        required: true
    },
    invoiceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Invoice"
    },

    // Payment details
    razorpayOrderId: {
        type: String,
        required: false, // Optional for non-razorpay payments
        index: true
    },
    razorpayPaymentId: {
        type: String,
        required: false,
        index: true
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
        enum: ["INR", "USD", "EUR", "GBP"]
    },
    totalAmount: {
        type: Number,
        min: 0,
        get: v => (v / 100).toFixed(2),
        set: v => Math.round(v * 100)
    },
    taxAmount: {
        type: Number,
        default: 0,
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

    // Status tracking
    status: {
        type: String,
        enum: ["pending", "paid", "confirmed", "processing", "shipped", "out_for_delivery", "delivered", "completed", "cancelled", "refunded", "failed"],
        default: "pending"
    },
    paymentStatus: {
        type: String,
        enum: ["pending", "processing", "paid", "failed", "refunded", "partially_refunded"],
        default: "pending"
    },

    // Booking details
    bookingType: {
        type: String,
        required: true,
        default: "product"
    },

    // 🚚 Logistics (Physical Goods)
    shippingDetails: {
        method: String,
        trackingNumber: String,
        carrier: String,
        estimatedDeliveryDate: Date
    },

    // 🗓️ Services (Appointments/Rentals)
    appointmentDetails: {
        startTime: Date,
        endTime: Date,
        location: String,
        virtualLink: String
    },

    // Items/services booked
    items: [{
        itemId: {
            type: mongoose.Schema.Types.ObjectId
        },
        skuId: String, // SKU Reference
        itemType: {
            type: String,
            enum: ["room", "ticket", "service", "product", "membership", "digital", "other"],
            default: "product"
        },
        name: {
            type: String,
            required: true
        },
        variantInfo: String, // e.g. "Space Gray / 512GB"
        description: String,
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
        totalPrice: {
            type: Number,
            min: 0,
            get: v => (v / 100).toFixed(2),
            set: v => Math.round(v * 100)
        },
        sellerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    }],

    // Customer details (snapshot at time of booking)
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
        address: {
            street: String,
            city: String,
            state: String,
            country: String,
            zipCode: String
        }
    },

    // Additional metadata
    notes: String,
    cancellationReason: String,
    refundReason: String,

    // Timeline tracking
    timeline: [{
        status: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        note: String,
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    }],

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
bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ bookingNumber: 1, userId: 1 });
bookingSchema.index({ bookingType: 1, startDate: 1, endDate: 1 });

// Pre-save middleware
bookingSchema.pre('save', function (next) {
    if (this.isModified('amount') || this.isModified('taxAmount') || this.isModified('discountAmount')) {
        this.totalAmount = this.amount + this.taxAmount - this.discountAmount;
    }

    if (this.isModified('status')) {
        this.timeline.push({
            status: this.status,
            note: 'Status updated'
        });
    }
    next();
});

// Static methods
bookingSchema.statics.findActiveBookings = function (userId) {
    return this.find({
        userId,
        status: { $in: ["confirmed", "paid", "processing"] },
        isDeleted: false
    });
};

bookingSchema.statics.cancelBooking = async function (bookingId, reason, userId) {
    const booking = await this.findById(bookingId);
    if (!booking) throw new Error('Booking not found');

    booking.status = 'cancelled';
    booking.cancellationReason = reason;
    booking.updatedBy = userId;

    return booking.save();
};

module.exports = mongoose.model("Booking", bookingSchema);