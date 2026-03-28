const jwt = require("jsonwebtoken");
const { User } = require("../models/users");

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
const authenticate = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                error: "Access denied. No token provided."
            });
        }

        const token = authHeader.split(" ")[1];

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if user still exists (Compatible with multiple user schemas across services)
        const user = await User.findById(decoded.userId || decoded.id)
            .select("-password -twoFactorSecret -twoFactorBackupCodes");

        if (!user) {
            return res.status(401).json({
                success: false,
                error: "User no longer exists."
            });
        }

        // Attach user to request
        req.user = {
            userId: user._id,
            email: user.email,
            role: user.role,
            status: user.status || 'active'
        };

        next();
    } catch (error) {
        console.error("Authentication error:", error);

        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                success: false,
                error: "Invalid token."
            });
        }

        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                error: "Token expired. Please login again."
            });
        }

        res.status(500).json({
            success: false,
            error: "Authentication failed."
        });
    }
};

/**
 * Optional authentication middleware
 * Attaches user if token exists, but doesn't require it
 */
const optionalAuthenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            const user = await User.findOne({
                _id: decoded.userId,
                isDeleted: false,
                status: "active"
            }).select("-password -twoFactorSecret -twoFactorBackupCodes");

            if (user && !user.changedPasswordAfter(decoded.iat)) {
                req.user = {
                    userId: user._id,
                    email: user.email,
                    role: user.role,
                    status: user.status
                };
            }
        }

        next();
    } catch (error) {
        // Ignore token errors for optional auth
        next();
    }
};

module.exports = {
    authenticate,
    optionalAuthenticate
};