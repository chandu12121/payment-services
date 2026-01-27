const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const { getUserBookings, getBookingById, createBooking } = require("../controllers/bookings");

// All routes are protected
router.use(authenticate);

router.get("/", getUserBookings);
router.post("/", createBooking);
router.get("/:id", getBookingById);

module.exports = router;
