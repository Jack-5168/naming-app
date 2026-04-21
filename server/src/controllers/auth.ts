/**
 * Authentication Controller (Simplified Version)
 * Phase 1: MVP Implementation
 * 
 * API Endpoints:
 * - POST /api/v1/auth/wechat/login - WeChat login
 * - POST /api/v1/auth/refresh - Refresh access token
 * - GET /api/v1/users/me - Get current user info
 * 
 * Note: This is a simplified implementation without membership queries
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as winston from 'winston';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

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

// JWT Configuration (simplified - no key rotation for MVP)
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex');

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
      nickname: string | null;
      avatar_url: string | null;
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
    openid: string | null;
    nickname: string | null;
    avatar_url: string | null;
    test_count: number;
    last_test_at: Date | null;
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

// JWT Payload types
interface JWTPayload {
  userId: number;
  iat: number;
  exp: number;
}

interface RefreshTokenPayload {
  userId: number;
  iat: number;
  exp: number;
}

// ==================== Helper Functions ====================

/**
 * Call WeChat API to get openid from login code
 */
async function wechatAuth(code: string): Promise<string> {
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
    throw new Error(`微信登录失败：${wechatData.errmsg || '未知错误'}`);
  }

  const { openid } = wechatData;

  if (!openid) {
    logger.error('WeChat login failed: no openid in response', { wechatData });
    throw new Error('微信服务器返回数据异常');
  }

  return openid;
}

/**
 * Generate JWT access token (simplified - 2 hours expiry)
 */
export function generateJWT(userId: number): string {
  const payload: JWTPayload = {
    userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7200, // 2 hours
  };
  
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '2h',
  });
}

/**
 * Generate JWT refresh token (simplified - 30 days expiry)
 */
export function generateRefreshJWT(userId: number): string {
  const payload: RefreshTokenPayload = {
    userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 2592000, // 30 days
  };
  
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: '30d',
  });
}

/**
 * Verify JWT refresh token (simplified - no DB lookup)
 */
export function verifyRefreshJWT(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as RefreshTokenPayload;
  return decoded;
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

    // Call WeChat API to get openid
    const openid = await wechatAuth(code);

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
          nickname: '用户',
          avatar: '',
          membershipLevel: 'free',
        } as any,
      }) as any;
      logger.info('New user created', { userId: user.id, openid: openid.substring(0, 8) + '...' });
    } else {
      logger.info('Existing user login', { userId: user.id });
    }

    // Generate JWT tokens
    const token = generateJWT(user.id);
    const refreshToken = generateRefreshJWT(user.id);

    logger.info('WeChat login successful', { 
      userId: user.id, 
      isNewUser
    });

    // Return response in required format
    res.json({
      code: 0,
      data: {
        token,
        expires_in: 7200, // 2 hours
        refresh_token: refreshToken,
        refresh_expires_in: 2592000, // 30 days
        user: {
          id: user.id,
          openid: user.wechatOpenid || openid,
          nickname: user.nickname || '',
          avatar_url: user.avatar || '',
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
    let payload: RefreshTokenPayload;
    try {
      payload = verifyRefreshJWT(refresh_token);
    } catch (error: any) {
      logger.warn('Invalid refresh token', { error: error.message });
      return res.status(401).json({
        code: 401,
        error: 'TOKEN_EXPIRED',
        message: 'refresh_token 已过期或无效',
      });
    }

    // Get user to verify existence
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

    // Generate new tokens
    const newToken = generateJWT(payload.userId);
    const newRefreshToken = generateRefreshJWT(payload.userId);

    logger.info('Token refresh successful', { userId: user.id });

    // Return response in required format
    res.json({
      code: 0,
      data: {
        token: newToken,
        expires_in: 7200, // 2 hours
        refresh_token: newRefreshToken,
        refresh_expires_in: 2592000, // 30 days
      },
    });
  } catch (error: any) {
    logger.error('Error in token refresh', { error });
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
    // Extract user ID from request context (set by auth middleware)
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
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        wechatOpenid: true,
        nickname: true,
        avatar: true,
        testCount: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      logger.warn('User not found', { userId });
      return res.status(404).json({
        code: 404,
        error: 'USER_NOT_FOUND',
        message: '用户不存在',
      });
    }

    logger.info('User info retrieved', { userId });

    // Return response in required format
    res.json({
      code: 0,
      data: {
        id: user.id,
        openid: user.wechatOpenid || '',
        nickname: user.nickname || '',
        avatar_url: user.avatar || '',
        test_count: user.testCount || 0,
        last_test_at: user.lastLoginAt || null,
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
