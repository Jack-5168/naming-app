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
interface JWTKeyVersion {
    version: number;
    secret: string;
    createdAt: Date;
    expiresAt: Date;
}
/**
 * Rotate JWT keys
 * Should be called every 90 days
 */
export declare function rotateJWTKeys(): JWTKeyVersion;
/**
 * Generate access token
 */
export declare function generateAccessToken(userId: number, email: string, deviceId?: string): string;
/**
 * Generate refresh token
 */
export declare function generateRefreshToken(userId: number, deviceId?: string): Promise<{
    token: string;
    tokenId: string;
}>;
/**
 * Verify access token
 */
export declare function verifyAccessToken(token: string): JWTPayload;
/**
 * Verify refresh token
 */
export declare function verifyRefreshToken(token: string): Promise<RefreshTokenPayload>;
/**
 * Revoke refresh token
 */
export declare function revokeRefreshToken(tokenId: string): Promise<void>;
/**
 * Revoke all refresh tokens for a user
 */
export declare function revokeAllUserTokens(userId: number): Promise<void>;
/**
 * Generate device fingerprint
 */
export declare function generateDeviceFingerprint(userAgent: string, ip: string, headers: any): string;
/**
 * Validate device fingerprint
 */
export declare function validateDeviceFingerprint(userId: number, fingerprint: string, userAgent: string): Promise<{
    valid: boolean;
    isNew: boolean;
}>;
/**
 * Record device fingerprint
 */
export declare function recordDeviceFingerprint(userId: number, fingerprint: string, userAgent: string, ip: string): Promise<void>;
/**
 * Detect anomalous login
 */
export declare function detectAnomalousLogin(userId: number, ip: string, userAgent: string, location?: string): Promise<{
    anomalous: boolean;
    reasons: string[];
}>;
/**
 * Record login history
 */
export declare function recordLogin(userId: number, ip: string, userAgent: string, success: boolean): Promise<void>;
/**
 * Authentication middleware
 */
export declare function authMiddleware(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
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
declare const _default: {
    rotateJWTKeys: typeof rotateJWTKeys;
    generateAccessToken: typeof generateAccessToken;
    generateRefreshToken: typeof generateRefreshToken;
    verifyAccessToken: typeof verifyAccessToken;
    verifyRefreshToken: typeof verifyRefreshToken;
    revokeRefreshToken: typeof revokeRefreshToken;
    revokeAllUserTokens: typeof revokeAllUserTokens;
    generateDeviceFingerprint: typeof generateDeviceFingerprint;
    validateDeviceFingerprint: typeof validateDeviceFingerprint;
    recordDeviceFingerprint: typeof recordDeviceFingerprint;
    detectAnomalousLogin: typeof detectAnomalousLogin;
    recordLogin: typeof recordLogin;
    authMiddleware: typeof authMiddleware;
};
export default _default;
//# sourceMappingURL=auth.d.ts.map