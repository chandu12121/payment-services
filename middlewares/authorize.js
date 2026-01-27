/**
 * Role-based authorization middleware
 * @param {Array} allowedRoles - Array of allowed roles
 */
const authorize = (allowedRoles = []) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: "Authentication required."
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: "Access denied. Insufficient permissions."
            });
        }

        next();
    };
};

/**
 * Self or Admin authorization middleware
 * Allows users to access their own data or admins to access any data
 */
const authorizeSelfOrAdmin = (paramName = "id") => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: "Authentication required."
            });
        }

        const resourceId = req.params[paramName];
        const isAdmin = req.user.role === "admin";
        const isSelf = resourceId === req.user.userId.toString();

        if (!isSelf && !isAdmin) {
            return res.status(403).json({
                success: false,
                error: "Access denied. You can only access your own data."
            });
        }

        next();
    };
};

module.exports = {
    authorize,
    authorizeSelfOrAdmin
};