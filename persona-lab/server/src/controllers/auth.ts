/**
 * Authentication Controller
 * Phase 1: MVP Implementation
 * 
 * API Endpoints:
 * - POST /api/v1/auth/wechat/login - WeChat login
 * - POST /api/v1/auth/refresh - Refresh access token
 * - GET /api/v1/users/me - Get current user info
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as winston from 'winston';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  generateDeviceFingerprint,
  recordDeviceFingerprint,
  detectAnomalousLogin,
  recordLogin,
} from '../security/auth';

const prisma = new PrismaClient();

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
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

// ==================== Types ====================

interface WechatLoginResponse {
  code: number;
  data: {
    token: string;
    expires_in: number;
    refresh_token: string;
    refresh_expires_in: number;
    user: {
      id: number;
      openid: string;
      nickname: string;
      avatar_url: string | null;
      membership: {
        level: string;
      };
    };
  };
}

interface RefreshTokenResponse {
  code: number;
  data: {
    token: string;
    expires_in: number;
    refresh_token: string;
    refresh_expires_in: number;
  };
}

interface UserInfoResponse {
  code: number;
  data: {
    id: number;
    openid: string;
    nickname: string | null;
    avatar_url: string | null;
    test_count: number;
    last_test_at: Date | null;
    membership: {
      level: string;
      end_date: Date | null;
    };
  };
}

interface ErrorResponse {
  code: number;
  error: string;
  message?: string;
}

// User type for internal use
interface User {
  id: number;
  email: string | null;
  nickname: string | null;
  avatar: string | null;
  wechatOpenid: string | null;
  wechatUnionid: string | null;
  membershipLevel: string;
  testCount: number;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  createdAt: Date;
  updatedAt: Date;
}

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
export async function login(req: Request, res: Response<WechatLoginResponse | ErrorResponse>) {
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
    const wechatData: any = await wechatResponse.json();

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
    let user: User | null = await prisma.user.findUnique({
      where: { wechatOpenid: openid } as any,
    }) as any;

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
        } as any,
      }) as any;
      logger.info('New user created', { userId: (user as User).id, openid: openid.substring(0, 8) + '...' });
    } else {
      logger.info('Existing user login', { userId: (user as User).id });
    }

    // user is guaranteed to exist here (after create or find)
    const u = user as User;

    // Get device fingerprint
    const fingerprint = generateDeviceFingerprint(
      req.headers['user-agent'] || '',
      req.ip || '',
      req.headers
    );

    // Check for anomalous login (security check)
    const anomalyCheck = await detectAnomalousLogin(
      u.id,
      req.ip || '',
      req.headers['user-agent'] || ''
    );

    if (anomalyCheck.anomalous) {
      logger.warn('Anomalous login detected', { 
        userId: u.id, 
        reasons: anomalyCheck.reasons,
        ip: req.ip 
      });
    }

    // Record login and device
    await recordLogin(u.id, req.ip || '', req.headers['user-agent'] || '', true);
    await recordDeviceFingerprint(u.id, fingerprint, req.headers['user-agent'] || '', req.ip || '');

    // Generate tokens
    const accessToken = generateAccessToken(u.id, u.email || `wechat_${openid}`, fingerprint);
    const { token: refreshToken } = await generateRefreshToken(u.id, fingerprint);

    // Update user's last login
    await prisma.user.update({
      where: { id: u.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: req.ip || '',
      } as any,
    });

    logger.info('WeChat login successful', { 
      userId: u.id, 
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
          id: u.id,
          openid: openid,
          nickname: u.nickname || '',
          avatar_url: u.avatar || '',
          membership: {
            level: u.membershipLevel || 'free',
          },
        },
      },
    });
  } catch (error: any) {
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
export async function refreshToken(req: Request, res: Response<RefreshTokenResponse | ErrorResponse>) {
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
    let payload: any;
    try {
      payload = await verifyRefreshToken(refresh_token);
    } catch (error: any) {
      logger.warn('Invalid refresh token', { error: error.message });
      return res.status(401).json({
        code: 401,
        error: 'TOKEN_EXPIRED',
        message: 'refresh_token 已过期或无效',
      });
    }

    // Get user
    const user: User | null = await prisma.user.findUnique({
      where: { id: payload.userId },
    }) as any;

    if (!user) {
      logger.warn('User not found for token refresh', { userId: payload.userId });
      return res.status(404).json({
        code: 404,
        error: 'USER_NOT_FOUND',
        message: '用户不存在',
      });
    }

    // Revoke old refresh token
    await revokeRefreshToken(payload.tokenId);

    // Generate new tokens
    const newAccessToken = generateAccessToken(
      user.id,
      user.email || `wechat_${user.wechatOpenid}`,
      payload.deviceId
    );
    const { token: newRefreshToken } = await generateRefreshToken(user.id, payload.deviceId);

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
  } catch (error: any) {
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
export async function getUserInfo(req: Request, res: Response<UserInfoResponse | ErrorResponse>) {
  try {
    // Extract user ID from request (set by authMiddleware)
    const userId = (req as any).user?.id;

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
    const user: User | null = await prisma.user.findUnique({
      where: { id: userId },
    }) as any;

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
    const membershipEndDate: Date | null = null;

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
        last_test_at: (user as any).lastTestAt || user.lastLoginAt || null,
        membership: {
          level: membershipLevel,
          end_date: membershipEndDate,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error getting user info', { error });
    res.status(500).json({
      code: 500,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    });
  }
}

export default {
  login,
  refreshToken,
  getUserInfo,
};
