/**
 * Rate Limiting Module
 * Phase 4: Security Hardening
 *
 * Features:
 * - User rate limiting (3 times/day for test generation)
 * - IP rate limiting (50 times/day)
 * - Global rate limiting (1000 times/minute)
 * - DDoS protection
 */
import { Request, Response, NextFunction } from 'express';
export declare function initializeRedisStore(redisUrl: string): Promise<void>;
/**
 * Check if user has exceeded test generation limit
 */
export declare function checkUserTestLimit(userId: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
}>;
/**
 * User rate limiter middleware
 */
export declare function userRateLimiter(limit?: number, windowMs?: number): import("express-rate-limit").RateLimitRequestHandler;
/**
 * IP rate limiter middleware
 */
export declare function ipRateLimiter(limit?: number, windowMs?: number): import("express-rate-limit").RateLimitRequestHandler;
/**
 * Global rate limiter middleware (DDoS protection)
 */
export declare function globalRateLimiter(limit?: number, windowMs?: number): import("express-rate-limit").RateLimitRequestHandler;
/**
 * Strict rate limiter for sensitive endpoints
 */
export declare function strictRateLimiter(limit?: number, windowMs?: number): import("express-rate-limit").RateLimitRequestHandler;
/**
 * Lenient rate limiter for public endpoints
 */
export declare function lenientRateLimiter(limit?: number, windowMs?: number): import("express-rate-limit").RateLimitRequestHandler;
/**
 * Check rate limit for custom actions
 */
export declare function checkRateLimit(key: string, limit: number, windowMs: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
}>;
/**
 * Log suspicious activity
 */
export declare function securityLogMiddleware(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Add rate limit headers to response
 */
export declare function rateLimitHeadersMiddleware(req: Request, res: Response, next: NextFunction): void;
declare const _default: {
    initializeRedisStore: typeof initializeRedisStore;
    checkUserTestLimit: typeof checkUserTestLimit;
    userRateLimiter: typeof userRateLimiter;
    ipRateLimiter: typeof ipRateLimiter;
    globalRateLimiter: typeof globalRateLimiter;
    strictRateLimiter: typeof strictRateLimiter;
    lenientRateLimiter: typeof lenientRateLimiter;
    checkRateLimit: typeof checkRateLimit;
    securityLogMiddleware: typeof securityLogMiddleware;
    rateLimitHeadersMiddleware: typeof rateLimitHeadersMiddleware;
};
export default _default;
//# sourceMappingURL=rate-limiter.d.ts.map