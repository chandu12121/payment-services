const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { isPaymentEnabled, NODE_ENV } = require("../config/razorpay");

/**
 * Comprehensive Health Check Endpoint
 * GET /api/health
 * 
 * Returns detailed health status of the backend service including:
 * - API status
 * - Database connection
 * - Environment configuration
 * - Service dependencies
 */
router.get("/", async (req, res) => {
    try {
        const healthStatus = {
            success: true,
            timestamp: new Date().toISOString(),
            service: "Payment API Service",
            version: "1.0.0",
            environment: NODE_ENV || "development",
            uptime: process.uptime(),
            checks: {}
        };

        // 1. Database Health Check
        const dbState = mongoose.connection.readyState;
        const dbStatus = {
            0: "disconnected",
            1: "connected",
            2: "connecting",
            3: "disconnecting"
        };

        healthStatus.checks.database = {
            status: dbState === 1 ? "healthy" : "unhealthy",
            state: dbStatus[dbState] || "unknown",
            connected: dbState === 1
        };

        // 2. Environment Variables Check
        const requiredEnvVars = [
            "MONGO_URI",
            "JWT_SECRET",
            "RAZORPAY_KEY_ID",
            "RAZORPAY_KEY_SECRET",
            "EMAIL_USER",
            "EMAIL_PASS",
            "PORT",
            "ALLOWED_ORIGINS",
            "CLIENT_URL"
        ];

        const missingEnvVars = requiredEnvVars.filter(
            (varName) => !process.env[varName]
        );

        healthStatus.checks.environment = {
            status: missingEnvVars.length === 0 ? "healthy" : "unhealthy",
            configured: requiredEnvVars.length - missingEnvVars.length,
            total: requiredEnvVars.length,
            missing: missingEnvVars
        };

        // 3. Razorpay Service Check
        healthStatus.checks.razorpay = {
            status: isPaymentEnabled ? "healthy" : "unhealthy",
            enabled: isPaymentEnabled,
            configured: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
        };

        // 4. Memory Usage
        const memoryUsage = process.memoryUsage();
        healthStatus.checks.memory = {
            status: "healthy",
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`
        };

        // Overall health status
        const allHealthy = Object.values(healthStatus.checks).every(
            (check) => check.status === "healthy"
        );

        healthStatus.overall = allHealthy ? "healthy" : "degraded";

        // Return appropriate status code
        const statusCode = allHealthy ? 200 : 503;

        return res.status(statusCode).json(healthStatus);
    } catch (error) {
        console.error("Health check error:", error);
        return res.status(503).json({
            success: false,
            overall: "unhealthy",
            timestamp: new Date().toISOString(),
            error: error.message,
            checks: {
                api: {
                    status: "unhealthy",
                    error: error.message
                }
            }
        });
    }
});

/**
 * Simple Ping Endpoint
 * GET /api/health/ping
 * 
 * Quick check to verify the API is responding
 */
router.get("/ping", (req, res) => {
    res.status(200).json({
        success: true,
        message: "pong",
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
