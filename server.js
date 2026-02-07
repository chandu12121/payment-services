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

// Get CLIENT_URL from environment with fallback
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;

// Build allowed origins from environment and defaults
const allowedOriginsList = [
  CLIENT_URL,
  SERVER_URL,
  'https://paymentflowapp.vercel.app',
  'https://payment-app-rho-murex.vercel.app',
  'https://payment-services-z80b.onrender.com'
];

// Add additional origins from ALLOWED_ORIGINS env if provided
if (process.env.ALLOWED_ORIGINS) {
  const envOrigins = process.env.ALLOWED_ORIGINS
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin);
  allowedOriginsList.push(...envOrigins);
}

const allowedOrigins = [...new Set(allowedOriginsList)]; // Remove duplicates

console.log('Allowed CORS Origins:', allowedOrigins);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.replace(/\/$/, '');

    // Check against allowed list OR allow any localhost/vercel app for flexibility during dev
    if (allowedOrigins.indexOf(normalizedOrigin) !== -1 ||
      normalizedOrigin.endsWith('.vercel.app') ||
      normalizedOrigin.includes('localhost') ||
      normalizedOrigin.endsWith('.onrender.com')) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS. Origin:', origin, 'Normalized:', normalizedOrigin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options(/(.*)/, cors(corsOptions));

// Security middleware - Configure for Cross-Origin
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
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
app.use("/api/notifications", require("./routes/notifications"));


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

// Global 404 handler - placed after all specific routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.originalUrl
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

const http = require("http");
const { init: initSocket } = require("./config/socket");

const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Start server
const startServer = async () => {
  try {
    // Attempt to connect to database
    connectDB().catch(err => {
      console.error('Database connection failed during startup:', err.message);
    });

    server.listen(PORT, () => {
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