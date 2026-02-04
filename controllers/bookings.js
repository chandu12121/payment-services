const Booking = require("../models/Bookings");
const Transaction = require("../models/Transactions"); // Required for population
const Invoice = require("../models/Invoice"); // Required for population
const logger = require("../utils/logger");

// Get all bookings for the current user
const getUserBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({ userId: req.user.userId })
            .sort({ createdAt: -1 })
            .populate('transactionId', 'transactionNumber status method')
            .populate('invoiceId', 'invoiceNumber totalAmount status');

        return res.status(200).json({ success: true, data: bookings });
    } catch (error) {
        logger.error(`Get Bookings Error: ${error.stack}`);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch bookings",
            details: error.message
        });
    }
};

// Create a booking (Manual/Offline) - Optional, mainly for specific flows
const createBooking = async (req, res) => {
    try {
        // Implementation for manual booking creation if needed
        // For now, bookings are primarily created via payment webhook/verification
        return res.status(501).json({ success: false, message: "Manual booking creation not yet implemented" });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

// Get single booking details
const getBookingById = async (req, res) => {
    try {
        const booking = await Booking.findOne({
            _id: req.params.id,
            userId: req.user.userId
        })
            .populate('transactionId')
            .populate('invoiceId');

        if (!booking) {
            return res.status(404).json({ success: false, error: "Booking not found" });
        }

        return res.status(200).json({ success: true, data: booking });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getUserBookings,
    createBooking,
    getBookingById
};
