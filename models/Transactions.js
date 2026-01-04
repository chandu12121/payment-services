const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false
    },
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Bookings",
        required: false
    },
    amount: { type: Number },
    currency: { type: String, default: "INR" },
    paymentType: { type: String },
    gstNumber: { type: String },
    Id: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("Transactions", transactionSchema);
