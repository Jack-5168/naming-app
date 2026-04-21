/**
 * Auth Routes
 * Phase 1: MVP Implementation
 * 
 * Handles user authentication and token management
 */

import { Router } from 'express';
import {
  login,
  refreshToken,
  getUserInfo,
} from '../controllers/auth';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * @route   POST /api/v1/auth/wechat/login
 * @desc    WeChat mini-program login with OAuth code
 * @access  Public
 * 
 * @body    { code: string } - WeChat login code
 * @returns { user, accessToken, refreshToken, expiresIn }
 */
router.post('/wechat/login', login);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 * 
 * @body    { refresh_token: string }
 * @returns { token, refresh_token, expires_in, refresh_expires_in }
 */
router.post('/refresh', refreshToken);

/**
 * @route   GET /api/v1/users/me
 * @desc    Get current authenticated user information
 * @access  Private
 * 
 * @headers { Authorization: Bearer <token> }
 * @returns { user: { id, openid, nickname, avatar_url, test_count, last_test_at } }
 */
router.get('/me', authMiddleware, getUserInfo);

export default router;
export { router as authRoutes };
