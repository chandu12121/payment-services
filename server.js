const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require('dotenv').config();

const paymentRoutes = require("./routes/payment");
const connectDB = require("./config/db");

// Connect to Database
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logging middleware
app.use(morgan('combined'));

// Body parser
const { requestLogger, errorLogger } = require("./middlewares/requestLogger");

// Body parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Request Logging
app.use(requestLogger);

// Payment routes
app.use("/api/payments", paymentRoutes);

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Payment API Service",
    version: "1.0.0",
    endpoints: {
      createOrder: "POST /api/payments/create-order",
      verifyPayment: "POST /api/payments/verify-payment",
      health: "GET /api/payments/health"
    }
  });
});

// FIXED: Global 404 handler - using regex instead of "*"
app.use(/.*/, (req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found"
  });
});

// Global error handler
app.use(errorLogger);
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);

  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Payment API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app; // Export for testing if needed