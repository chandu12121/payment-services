const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Transactions",
        required: false
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false
    },
    invoiceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Invoice",
        required: false
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    razorpayOrderId: { type: String, required: true },
    razorpayPaymentId: { type: String },
    status: {
        type: String,
        enum: ["created", "success", "failed"],
        default: "created"
    },
    Id: {
        type: String,
        unique: true,
        required: false
    }
}, { timestamps: true });

module.exports = mongoose.model("Bookings", bookingSchema);
