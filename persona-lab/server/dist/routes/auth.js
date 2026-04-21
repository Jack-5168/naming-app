"use strict";
/**
 * Auth Routes
 * Phase 1: MVP Implementation
 *
 * Handles user authentication and token management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../controllers/auth");
const auth_2 = require("../middleware/auth");
const router = (0, express_1.Router)();
exports.authRoutes = router;
/**
 * @route   POST /api/v1/auth/wechat/login
 * @desc    WeChat mini-program login with OAuth code
 * @access  Public
 *
 * @body    { code: string } - WeChat login code
 * @returns { user, accessToken, refreshToken, expiresIn }
 */
router.post('/wechat/login', auth_1.wechatLogin);
/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 *
 * @body    { refreshToken: string }
 * @returns { accessToken, refreshToken, expiresIn }
 */
router.post('/refresh', auth_1.refreshToken);
/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user and revoke all tokens
 * @access  Private
 *
 * @headers { Authorization: Bearer <token> }
 * @returns { success: true }
 */
router.post('/logout', auth_2.authMiddleware, auth_1.logout);
/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current authenticated user information
 * @access  Private
 *
 * @headers { Authorization: Bearer <token> }
 * @returns { user: { id, nickname, avatar, isMember, testCount } }
 */
router.get('/me', auth_2.authMiddleware, auth_1.getCurrentUser);
exports.default = router;
//# sourceMappingURL=auth.js.map