const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
    const { method, originalUrl, ip, body, query, params, user } = req;

    const logData = {
        timestamp: new Date().toISOString(),
        method,
        url: originalUrl,
        ip,
        userId: user ? user._id : 'anonymous',
        body: { ...body }, // Clone to avoid mutation if sanitized later
        query,
        params,
    };

    // Mask sensitive fields if present
    if (logData.body.personalDetails && logData.body.personalDetails.mobileNumber) {
        // example masking, can be expanded
    }
    if (logData.body.razorpay_signature) {
        logData.body.razorpay_signature = '***MASKED***';
    }

    logger.info(`Incoming Request: ${method} ${originalUrl}`, logData);
    next();
};

const errorLogger = (err, req, res, next) => {
    const { method, originalUrl, ip, user } = req;

    const logData = {
        timestamp: new Date().toISOString(),
        method,
        url: originalUrl,
        ip,
        userId: user ? user._id : 'anonymous',
        error: err.message,
        stack: err.stack,
        body: req.body
    };

    logger.error(`Request Error: ${err.message}`, logData);
    next(err);
};

module.exports = { requestLogger, errorLogger };
