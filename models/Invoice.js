const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false
    },
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Transactions",
        required: false
    },
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Bookings",
        required: false
    },
    invoiceNumber: {
        type: String,
        unique: false,
        required: false
    },
    id: {
        type: String,
        unique: false,
        required: false
    },
    amount: { type: Number, required: false },
    pdfUrl: { type: String }, // Optional for future implementation
}, { timestamps: true });

module.exports = mongoose.model("Invoice", invoiceSchema);
