const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require('dotenv').config();

const paymentRoutes = require("./routes/payment");
const userRoutes = require("./routes/user"); // Import user routes
const connectDB = require("./config/db");

// Connect to Database
// Database connection handled before server startup

// Start Cron Jobs
const startPaymentCleanupJob = require("./cron/paymentCleanup");
startPaymentCleanupJob();

const app = express();

// Enforce strict env usage for PORT
if (!process.env.PORT) {
  console.error('FATAL ERROR: PORT is not defined in .env');
  process.exit(1);
}
const PORT = process.env.PORT;

// Security middleware
app.use(helmet());

// CORS configuration
if (!process.env.ALLOWED_ORIGINS) {
  console.error('FATAL ERROR: ALLOWED_ORIGINS is not defined in .env');
  process.exit(1);
}

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if origin is allowed or if it's a Vercel preview URL
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with'],
  credentials: true
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

// Mount routes
// Health check endpoint (should be first for monitoring)
app.use("/api/health", require("./routes/health"));
app.use("/api/payments", paymentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/invoices", require("./routes/invoices"));

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Payment API Service",
    version: "1.0.0",
    status: "operational",
    endpoints: {
      health: "GET /api/health - Comprehensive health check",
      ping: "GET /api/health/ping - Quick ping check",
      createOrder: "POST /api/payments/create-order",
      verifyPayment: "POST /api/payments/verify-payment",
      paymentHealth: "GET /api/payments/health"
    }
  });
});

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

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
// Connect to Database and start server
// Start server
const startServer = async () => {
  try {
    // Attempt to connect to database (non-blocking for server start in this context, 
    // but we want to log the status)
    connectDB().catch(err => {
      console.error('Database connection failed during startup:', err.message);
      // We do NOT exit here, so the health endpoint remains accessible
    });

    app.listen(PORT, () => {
      console.log(`Payment API server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health check available at: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app; // Export for testing if needed