"use strict";
/**
 * Authentication Security Module
 * Phase 4: Security Hardening
 *
 * Features:
 * - JWT key rotation (90 days)
 * - Refresh token revocation
 * - Device fingerprinting
 * - Anomaly detection
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rotateJWTKeys = rotateJWTKeys;
exports.generateAccessToken = generateAccessToken;
exports.generateRefreshToken = generateRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.revokeRefreshToken = revokeRefreshToken;
exports.revokeAllUserTokens = revokeAllUserTokens;
exports.generateDeviceFingerprint = generateDeviceFingerprint;
exports.validateDeviceFingerprint = validateDeviceFingerprint;
exports.recordDeviceFingerprint = recordDeviceFingerprint;
exports.detectAnomalousLogin = detectAnomalousLogin;
exports.recordLogin = recordLogin;
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// ==================== Configuration ====================
const JWT_SECRET = process.env.JWT_SECRET || crypto_1.default.randomBytes(64).toString('hex');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || crypto_1.default.randomBytes(64).toString('hex');
const JWT_EXPIRATION = '15m';
const JWT_REFRESH_EXPIRATION = '7d';
const JWT_KEY_ROTATION_DAYS = 90;
let currentKeyVersion = 1;
const keyHistory = [
    {
        version: 1,
        secret: JWT_SECRET,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + JWT_KEY_ROTATION_DAYS * 24 * 60 * 60 * 1000),
    },
];
/**
 * Rotate JWT keys
 * Should be called every 90 days
 */
function rotateJWTKeys() {
    const newVersion = currentKeyVersion + 1;
    const newSecret = crypto_1.default.randomBytes(64).toString('hex');
    const newKey = {
        version: newVersion,
        secret: newSecret,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + JWT_KEY_ROTATION_DAYS * 24 * 60 * 60 * 1000),
    };
    keyHistory.push(newKey);
    currentKeyVersion = newVersion;
    // Keep only last 2 versions for verification
    if (keyHistory.length > 2) {
        keyHistory.shift();
    }
    console.log(`JWT keys rotated to version ${newVersion}`);
    return newKey;
}
/**
 * Get current JWT secret
 */
function getCurrentSecret() {
    const currentKey = keyHistory.find(k => k.version === currentKeyVersion);
    return currentKey?.secret || JWT_SECRET;
}
/**
 * Get secret by version for token verification
 */
function getSecretByVersion(version) {
    const key = keyHistory.find(k => k.version === version);
    return key?.secret || JWT_SECRET;
}
// ==================== Token Generation ====================
/**
 * Generate access token
 */
function generateAccessToken(userId, email, deviceId) {
    const payload = {
        userId,
        email,
        deviceId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + parseInt(JWT_EXPIRATION) * 60,
    };
    return jsonwebtoken_1.default.sign(payload, getCurrentSecret(), {
        expiresIn: JWT_EXPIRATION,
    });
}
/**
 * Generate refresh token
 */
async function generateRefreshToken(userId, deviceId) {
    const tokenId = crypto_1.default.randomBytes(32).toString('hex');
    const payload = {
        userId,
        tokenId,
        deviceId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + parseInt(JWT_REFRESH_EXPIRATION) * 24 * 60 * 60,
    };
    const token = jsonwebtoken_1.default.sign(payload, JWT_REFRESH_SECRET, {
        expiresIn: JWT_REFRESH_EXPIRATION,
    });
    // Store refresh token in database for revocation capability
    await prisma.refreshToken.create({
        data: {
            userId,
            tokenId,
            deviceId,
            expiresAt: new Date(payload.exp * 1000),
            revoked: false,
        },
    });
    return { token, tokenId };
}
// ==================== Token Verification ====================
/**
 * Verify access token
 */
function verifyAccessToken(token) {
    try {
        // Try with current key first
        const decoded = jsonwebtoken_1.default.verify(token, getCurrentSecret());
        return decoded;
    }
    catch (error) {
        // Try with previous key versions
        for (const key of keyHistory) {
            if (key.version !== currentKeyVersion) {
                try {
                    const decoded = jsonwebtoken_1.default.verify(token, key.secret);
                    return decoded;
                }
                catch {
                    continue;
                }
            }
        }
        throw error;
    }
}
/**
 * Verify refresh token
 */
async function verifyRefreshToken(token) {
    const decoded = jsonwebtoken_1.default.verify(token, JWT_REFRESH_SECRET);
    // Check if token is revoked
    const refreshToken = await prisma.refreshToken.findUnique({
        where: { tokenId: decoded.tokenId },
    });
    if (!refreshToken || refreshToken.revoked || refreshToken.expiresAt < new Date()) {
        throw new Error('Refresh token is invalid or revoked');
    }
    return decoded;
}
// ==================== Token Revocation ====================
/**
 * Revoke refresh token
 */
async function revokeRefreshToken(tokenId) {
    await prisma.refreshToken.update({
        where: { tokenId },
        data: { revoked: true },
    });
}
/**
 * Revoke all refresh tokens for a user
 */
async function revokeAllUserTokens(userId) {
    await prisma.refreshToken.updateMany({
        where: { userId },
        data: { revoked: true },
    });
}
// ==================== Device Fingerprinting ====================
/**
 * Generate device fingerprint
 */
function generateDeviceFingerprint(userAgent, ip, headers) {
    const fingerprint = crypto_1.default
        .createHash('sha256')
        .update(`${userAgent}|${ip}|${headers['accept-language'] || ''}|${headers['screen-resolution'] || ''}`)
        .digest('hex');
    return fingerprint;
}
/**
 * Validate device fingerprint
 */
async function validateDeviceFingerprint(userId, fingerprint, userAgent) {
    const knownDevice = await prisma.deviceFingerprint.findFirst({
        where: {
            userId,
            fingerprint,
        },
    });
    if (knownDevice) {
        // Update last seen
        await prisma.deviceFingerprint.update({
            where: { id: knownDevice.id },
            data: { lastSeenAt: new Date() },
        });
        return { valid: true, isNew: false };
    }
    // New device
    return { valid: true, isNew: true };
}
/**
 * Record device fingerprint
 */
async function recordDeviceFingerprint(userId, fingerprint, userAgent, ip) {
    await prisma.deviceFingerprint.upsert({
        where: {
            userId_fingerprint: {
                userId,
                fingerprint,
            },
        },
        create: {
            userId,
            fingerprint,
            userAgent,
            ipAddress: ip,
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
        },
        update: {
            lastSeenAt: new Date(),
            userAgent,
            ipAddress: ip,
        },
    });
}
// ==================== Anomaly Detection ====================
/**
 * Detect anomalous login
 */
async function detectAnomalousLogin(userId, ip, userAgent, location) {
    const reasons = [];
    // Get recent logins
    const recentLogins = await prisma.loginHistory.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: 5,
    });
    if (recentLogins.length === 0) {
        return { anomalous: false, reasons: [] };
    }
    // Check for unusual IP location
    const lastLogin = recentLogins[0];
    if (lastLogin.ipAddress && lastLogin.ipAddress !== ip) {
        // Different IP - could be normal or suspicious
        const timeDiff = Date.now() - lastLogin.timestamp.getTime();
        // Impossible travel (e.g., login from different countries within short time)
        if (timeDiff < 3600000) { // Less than 1 hour
            reasons.push('Rapid location change detected');
        }
    }
    // Check for unusual time
    const hour = new Date().getHours();
    if (hour < 5 || hour > 23) {
        // Late night/early morning login
        reasons.push('Unusual login time');
    }
    // Check for new device
    const fingerprint = generateDeviceFingerprint(userAgent, ip, {});
    const knownDevice = await prisma.deviceFingerprint.findFirst({
        where: { userId, fingerprint },
    });
    if (!knownDevice) {
        reasons.push('New device');
    }
    return {
        anomalous: reasons.length > 0,
        reasons,
    };
}
/**
 * Record login history
 */
async function recordLogin(userId, ip, userAgent, success) {
    await prisma.loginHistory.create({
        data: {
            userId,
            ipAddress: ip,
            userAgent,
            success,
            timestamp: new Date(),
        },
    });
}
// ==================== Auth Middleware ====================
/**
 * Authentication middleware
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
        const payload = verifyAccessToken(token);
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
exports.default = {
    rotateJWTKeys,
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    revokeRefreshToken,
    revokeAllUserTokens,
    generateDeviceFingerprint,
    validateDeviceFingerprint,
    recordDeviceFingerprint,
    detectAnomalousLogin,
    recordLogin,
    authMiddleware,
};
//# sourceMappingURL=auth.js.map