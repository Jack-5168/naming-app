"use strict";
/**
 * Authentication Middleware
 * Phase 1: MVP Implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const auth_1 = require("../security/auth");
/**
 * Authentication middleware
 * Verifies JWT access token and attaches user to request
 */
function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'No token provided',
            });
        }
        const token = authHeader.substring(7);
        const payload = (0, auth_1.verifyAccessToken)(token);
        req.user = {
            id: payload.userId,
            email: payload.email,
            deviceId: payload.deviceId,
        };
        next();
    }
    catch (error) {
        return res.status(401).json({
            success: false,
            error: 'Invalid token',
        });
    }
}
exports.default = authMiddleware;
//# sourceMappingURL=auth.js.map