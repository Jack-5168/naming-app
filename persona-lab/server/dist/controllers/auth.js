"use strict";
/**
 * Authentication Controller
 * Phase 1: MVP Implementation
 *
 * API Endpoints:
 * - POST /api/v1/auth/wechat/login - WeChat login
 * - POST /api/v1/auth/refresh - Refresh access token
 * - GET /api/v1/users/me - Get current user info
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.wechatLogin = wechatLogin;
exports.refreshToken = refreshToken;
exports.getCurrentUser = getCurrentUser;
const client_1 = require("@prisma/client");
const winston = __importStar(require("winston"));
const auth_1 = require("../security/auth");
const prisma = new client_1.PrismaClient();
// Initialize logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
    ],
});
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}
// WeChat API configuration
const WECHAT_APP_ID = process.env.WECHAT_APP_ID || '';
const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET || '';
const WECHAT_LOGIN_URL = 'https://api.weixin.qq.com/sns/jscode2session';
// ==================== Controllers ====================
/**
 * POST /api/v1/auth/wechat/login
 *
 * WeChat mini-program login
 * Exchanges WeChat login code for user tokens
 *
 * @param code - WeChat login code from mini-program
 * @returns JWT tokens and user info
 */
async function wechatLogin(req, res) {
    try {
        const { code } = req.body;
        // Validate request
        if (!code) {
            logger.warn('WeChat login failed: missing code', { ip: req.ip });
            return res.status(400).json({
                code: 400,
                error: 'INVALID_CODE',
                message: '微信登录 code 不能为空',
            });
        }
        logger.info('Processing WeChat login', { code: code.substring(0, 8) + '...' });
        // Exchange code for openid and session_key
        const wechatUrl = `${WECHAT_LOGIN_URL}?appid=${WECHAT_APP_ID}&secret=${WECHAT_APP_SECRET}&js_code=${code}&grant_type=authorization_code`;
        const wechatResponse = await fetch(wechatUrl);
        const wechatData = await wechatResponse.json();
        // Handle WeChat API errors
        if (wechatData.errcode) {
            logger.error('WeChat API error', {
                errcode: wechatData.errcode,
                errmsg: wechatData.errmsg,
                code: code.substring(0, 8) + '...'
            });
            return res.status(400).json({
                code: 400,
                error: 'WECHAT_API_ERROR',
                message: `微信登录失败：${wechatData.errmsg || '未知错误'}`,
            });
        }
        const { openid, session_key, unionid } = wechatData;
        if (!openid) {
            logger.error('WeChat login failed: no openid in response', { wechatData });
            return res.status(500).json({
                code: 500,
                error: 'WECHAT_INVALID_RESPONSE',
                message: '微信服务器返回数据异常',
            });
        }
        // Find or create user
        let user = await prisma.user.findUnique({
            where: { wechatOpenid: openid },
        });
        const isNewUser = !user;
        if (isNewUser) {
            // Create new user
            user = await prisma.user.create({
                data: {
                    wechatOpenid: openid,
                    wechatUnionid: unionid,
                    nickname: `探索者${openid.substring(0, 6)}`,
                    avatar: '',
                    membershipLevel: 'free',
                },
            });
            logger.info('New user created', { userId: user.id, openid: openid.substring(0, 8) + '...' });
        }
        else {
            logger.info('Existing user login', { userId: user.id });
        }
        // Get device fingerprint
        const fingerprint = (0, auth_1.generateDeviceFingerprint)(req.headers['user-agent'] || '', req.ip || '', req.headers);
        // Check for anomalous login (security check)
        const anomalyCheck = await (0, auth_1.detectAnomalousLogin)(user.id, req.ip || '', req.headers['user-agent'] || '');
        if (anomalyCheck.anomalous) {
            logger.warn('Anomalous login detected', {
                userId: user.id,
                reasons: anomalyCheck.reasons,
                ip: req.ip
            });
        }
        // Record login and device
        await (0, auth_1.recordLogin)(user.id, req.ip || '', req.headers['user-agent'] || '', true);
        await (0, auth_1.recordDeviceFingerprint)(user.id, fingerprint, req.headers['user-agent'] || '', req.ip || '');
        // Generate tokens
        const accessToken = (0, auth_1.generateAccessToken)(user.id, user.email || `wechat_${openid}`, fingerprint);
        const { token: refreshToken } = await (0, auth_1.generateRefreshToken)(user.id, fingerprint);
        // Update user's last login
        await prisma.user.update({
            where: { id: user.id },
            data: {
                lastLoginAt: new Date(),
                lastLoginIp: req.ip || '',
            },
        });
        logger.info('WeChat login successful', {
            userId: user.id,
            isNewUser,
            anomalyDetected: anomalyCheck.anomalous
        });
        // Return response in required format
        res.json({
            code: 0,
            data: {
                token: accessToken,
                expires_in: 7200, // 2 hours
                refresh_token: refreshToken,
                refresh_expires_in: 2592000, // 30 days
                user: {
                    id: user.id,
                    openid: openid,
                    nickname: user.nickname || '',
                    avatar_url: user.avatar || '',
                    membership: {
                        level: user.membershipLevel || 'free',
                    },
                },
            },
        });
    }
    catch (error) {
        logger.error('Error in wechat login', { error });
        res.status(500).json({
            code: 500,
            error: 'INTERNAL_ERROR',
            message: '服务器内部错误',
        });
    }
}
/**
 * POST /api/v1/auth/refresh
 *
 * Refresh access token using refresh token
 *
 * @param refresh_token - JWT refresh token
 * @returns New access and refresh tokens
 */
async function refreshToken(req, res) {
    try {
        const { refresh_token } = req.body;
        // Validate request
        if (!refresh_token) {
            logger.warn('Token refresh failed: missing refresh_token', { ip: req.ip });
            return res.status(400).json({
                code: 400,
                error: 'INVALID_TOKEN',
                message: 'refresh_token 不能为空',
            });
        }
        logger.info('Processing token refresh', { ip: req.ip });
        // Verify refresh token
        let payload;
        try {
            payload = await (0, auth_1.verifyRefreshToken)(refresh_token);
        }
        catch (error) {
            logger.warn('Invalid refresh token', { error: error.message });
            return res.status(401).json({
                code: 401,
                error: 'TOKEN_EXPIRED',
                message: 'refresh_token 已过期或无效',
            });
        }
        // Get user
        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
        });
        if (!user) {
            logger.warn('User not found for token refresh', { userId: payload.userId });
            return res.status(404).json({
                code: 404,
                error: 'USER_NOT_FOUND',
                message: '用户不存在',
            });
        }
        // Revoke old refresh token
        await (0, auth_1.revokeRefreshToken)(payload.tokenId);
        // Generate new tokens
        const newAccessToken = (0, auth_1.generateAccessToken)(user.id, user.email || `wechat_${user.wechatOpenid}`, payload.deviceId);
        const { token: newRefreshToken } = await (0, auth_1.generateRefreshToken)(user.id, payload.deviceId);
        logger.info('Token refresh successful', { userId: user.id });
        // Return response in required format
        res.json({
            code: 0,
            data: {
                token: newAccessToken,
                expires_in: 7200, // 2 hours
                refresh_token: newRefreshToken,
                refresh_expires_in: 2592000, // 30 days
            },
        });
    }
    catch (error) {
        logger.error('Error in token refresh', { error });
        // Handle specific error types
        if (error.message === 'Refresh token is invalid or revoked') {
            return res.status(401).json({
                code: 401,
                error: 'TOKEN_REVOKED',
                message: 'refresh_token 已失效',
            });
        }
        res.status(500).json({
            code: 500,
            error: 'INTERNAL_ERROR',
            message: '服务器内部错误',
        });
    }
}
/**
 * GET /api/v1/users/me
 *
 * Get current authenticated user information
 * Requires Bearer token in Authorization header
 *
 * @returns User profile information
 */
async function getCurrentUser(req, res) {
    try {
        // Extract user ID from request (set by authMiddleware)
        const userId = req.user?.id;
        if (!userId) {
            logger.warn('Get user info failed: unauthorized', { ip: req.ip });
            return res.status(401).json({
                code: 401,
                error: 'UNAUTHORIZED',
                message: '未授权访问',
            });
        }
        logger.info('Getting user info', { userId });
        // Get user info
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            logger.warn('User not found', { userId });
            return res.status(404).json({
                code: 404,
                error: 'USER_NOT_FOUND',
                message: '用户不存在',
            });
        }
        // Get membership info from user
        const membershipLevel = user.membershipLevel || 'free';
        // Note: end_date is not directly available in User model, would need Membership relation
        const membershipEndDate = null;
        logger.info('User info retrieved', { userId, membershipLevel });
        // Return response in required format
        res.json({
            code: 0,
            data: {
                id: user.id,
                openid: user.wechatOpenid || '',
                nickname: user.nickname || '',
                avatar_url: user.avatar || '',
                test_count: user.testCount || 0,
                last_test_at: user.lastTestAt || user.lastLoginAt || null,
                membership: {
                    level: membershipLevel,
                    end_date: membershipEndDate,
                },
            },
        });
    }
    catch (error) {
        logger.error('Error getting user info', { error });
        res.status(500).json({
            code: 500,
            error: 'INTERNAL_ERROR',
            message: '服务器内部错误',
        });
    }
}
exports.default = {
    wechatLogin,
    refreshToken,
    getCurrentUser,
};
//# sourceMappingURL=auth.js.map