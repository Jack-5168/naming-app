/**
 * Authentication Security Module
 * Phase 1: MVP Implementation
 * 
 * Features:
 * - JWT token generation and verification
 * - Refresh token management (in-memory for MVP)
 * - Device fingerprinting
 */

import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ==================== Configuration ====================

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRATION = '2h'; // 2 hours
const JWT_REFRESH_EXPIRATION = '30d'; // 30 days

// In-memory refresh token store for MVP
// Format: tokenId -> { userId, deviceId, expiresAt, revoked }
const refreshTokensStore = new Map<string, {
  userId: number;
  tokenId: string;
  deviceId?: string;
  expiresAt: Date;
  revoked: boolean;
}>();

// ==================== Types ====================

export interface JWTPayload {
  userId: number;
  email: string;
  deviceId?: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  userId: number;
  tokenId: string;
  deviceId?: string;
  iat: number;
  exp: number;
}

// ==================== Token Generation ====================

/**
 * Generate access token
 */
export function generateAccessToken(userId: number, email: string, deviceId?: string): string {
  const payload: JWTPayload = {
    userId,
    email,
    deviceId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7200, // 2 hours
  };
  
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRATION,
  });
}

/**
 * Generate refresh token
 */
export async function generateRefreshToken(userId: number, deviceId?: string): Promise<{ token: string; tokenId: string }> {
  const tokenId = crypto.randomBytes(32).toString('hex');
  
  const payload: RefreshTokenPayload = {
    userId,
    tokenId,
    deviceId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 2592000, // 30 days
  };
  
  const token = jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRATION,
  });
  
  // Store refresh token in memory for MVP
  refreshTokensStore.set(tokenId, {
    userId,
    tokenId,
    deviceId,
    expiresAt: new Date(payload.exp * 1000),
    revoked: false,
  });
  
  return { token, tokenId };
}

// ==================== Token Verification ====================

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): JWTPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
  return decoded;
}

/**
 * Verify refresh token
 */
export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as RefreshTokenPayload;
  
  // Check if token is revoked or expired
  const storedToken = refreshTokensStore.get(decoded.tokenId);
  
  if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
    throw new Error('Refresh token is invalid or revoked');
  }
  
  return decoded;
}

// ==================== Token Revocation ====================

/**
 * Revoke refresh token
 */
export async function revokeRefreshToken(tokenId: string): Promise<void> {
  const storedToken = refreshTokensStore.get(tokenId);
  if (storedToken) {
    storedToken.revoked = true;
    refreshTokensStore.set(tokenId, storedToken);
  }
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllUserTokens(userId: number): Promise<void> {
  refreshTokensStore.forEach((tokenData, tokenId) => {
    if (tokenData.userId === userId) {
      tokenData.revoked = true;
      refreshTokensStore.set(tokenId, tokenData);
    }
  });
}

// ==================== Device Fingerprinting ====================

/**
 * Generate device fingerprint
 */
export function generateDeviceFingerprint(userAgent: string, ip: string, headers: any): string {
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${userAgent}|${ip}|${headers['accept-language'] || ''}`)
    .digest('hex');
  
  return fingerprint;
}

/**
 * Validate device fingerprint
 * For MVP, always returns valid
 */
export async function validateDeviceFingerprint(
  userId: number,
  fingerprint: string,
  userAgent: string
): Promise<{ valid: boolean; isNew: boolean }> {
  // For MVP, accept all fingerprints
  return { valid: true, isNew: false };
}

/**
 * Record device fingerprint
 * For MVP, no-op
 */
export async function recordDeviceFingerprint(
  userId: number,
  fingerprint: string,
  userAgent: string,
  ip: string
): Promise<void> {
  // No-op for MVP
}

// ==================== Anomaly Detection ====================

/**
 * Detect anomalous login
 * For MVP, basic implementation
 */
export async function detectAnomalousLogin(
  userId: number,
  ip: string,
  userAgent: string,
  location?: string
): Promise<{ anomalous: boolean; reasons: string[] }> {
  // For MVP, no anomaly detection
  return { anomalous: false, reasons: [] };
}

/**
 * Record login history
 * For MVP, update user's lastLoginAt
 */
export async function recordLogin(
  userId: number,
  ip: string,
  userAgent: string,
  success: boolean
): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      } as any,
    });
  } catch (error) {
    console.error('Failed to record login:', error);
  }
}

// ==================== Auth Middleware ====================

/**
 * Authentication middleware
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
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
    
    (req as any).user = {
      id: payload.userId,
      email: payload.email,
      deviceId: payload.deviceId,
    };
    
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
    });
  }
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        deviceId?: string;
      };
    }
  }
}

export default {
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
