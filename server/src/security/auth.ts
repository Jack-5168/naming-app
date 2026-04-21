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

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ==================== Configuration ====================

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRATION = '15m';
const JWT_REFRESH_EXPIRATION = '7d';
const JWT_KEY_ROTATION_DAYS = 90;

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

// ==================== JWT Key Management ====================

interface JWTKeyVersion {
  version: number;
  secret: string;
  createdAt: Date;
  expiresAt: Date;
}

let currentKeyVersion = 1;
const keyHistory: JWTKeyVersion[] = [
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
export function rotateJWTKeys() {
  const newVersion = currentKeyVersion + 1;
  const newSecret = crypto.randomBytes(64).toString('hex');
  
  const newKey: JWTKeyVersion = {
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
function getCurrentSecret(): string {
  const currentKey = keyHistory.find(k => k.version === currentKeyVersion);
  return currentKey?.secret || JWT_SECRET;
}

/**
 * Get secret by version for token verification
 */
function getSecretByVersion(version: number): string {
  const key = keyHistory.find(k => k.version === version);
  return key?.secret || JWT_SECRET;
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
    exp: Math.floor(Date.now() / 1000) + parseInt(JWT_EXPIRATION) * 60,
  };
  
  return jwt.sign(payload, getCurrentSecret(), {
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
    exp: Math.floor(Date.now() / 1000) + parseInt(JWT_REFRESH_EXPIRATION) * 24 * 60 * 60,
  };
  
  const token = jwt.sign(payload, JWT_REFRESH_SECRET, {
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
export function verifyAccessToken(token: string): JWTPayload {
  try {
    // Try with current key first
    const decoded = jwt.verify(token, getCurrentSecret()) as JWTPayload;
    return decoded;
  } catch (error) {
    // Try with previous key versions
    for (const key of keyHistory) {
      if (key.version !== currentKeyVersion) {
        try {
          const decoded = jwt.verify(token, key.secret) as JWTPayload;
          return decoded;
        } catch {
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
export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as RefreshTokenPayload;
  
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
export async function revokeRefreshToken(tokenId: string): Promise<void> {
  await prisma.refreshToken.update({
    where: { tokenId },
    data: { revoked: true },
  });
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllUserTokens(userId: number): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { revoked: true },
  });
}

// ==================== Device Fingerprinting ====================

/**
 * Generate device fingerprint
 */
export function generateDeviceFingerprint(userAgent: string, ip: string, headers: any): string {
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${userAgent}|${ip}|${headers['accept-language'] || ''}|${headers['screen-resolution'] || ''}`)
    .digest('hex');
  
  return fingerprint;
}

/**
 * Validate device fingerprint
 */
export async function validateDeviceFingerprint(
  userId: number,
  fingerprint: string,
  userAgent: string
): Promise<{ valid: boolean; isNew: boolean }> {
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
export async function recordDeviceFingerprint(
  userId: number,
  fingerprint: string,
  userAgent: string,
  ip: string
): Promise<void> {
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
export async function detectAnomalousLogin(
  userId: number,
  ip: string,
  userAgent: string,
  location?: string
): Promise<{ anomalous: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  
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
export async function recordLogin(
  userId: number,
  ip: string,
  userAgent: string,
  success: boolean
): Promise<void> {
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
    
    req.user = {
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
