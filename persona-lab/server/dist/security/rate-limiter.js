"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeRedisStore = initializeRedisStore;
exports.checkUserTestLimit = checkUserTestLimit;
exports.userRateLimiter = userRateLimiter;
exports.ipRateLimiter = ipRateLimiter;
exports.globalRateLimiter = globalRateLimiter;
exports.strictRateLimiter = strictRateLimiter;
exports.lenientRateLimiter = lenientRateLimiter;
exports.checkRateLimit = checkRateLimit;
exports.securityLogMiddleware = securityLogMiddleware;
exports.rateLimitHeadersMiddleware = rateLimitHeadersMiddleware;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// ==================== Configuration ====================
const WINDOW_MS = 60 * 1000; // 1 minute
const DAY_MS = 24 * 60 * 60 * 1000; // 24 hours
// Rate limits
const USER_TEST_LIMIT = 3; // 3 times per day
const IP_LIMIT = 50; // 50 times per day
const GLOBAL_LIMIT = 1000; // 1000 times per minute
const userStore = new Map();
const ipStore = new Map();
const globalStore = {
    count: 0,
    resetAt: Date.now() + WINDOW_MS,
};
// ==================== Redis Store (for production) ====================
let redisClient = null;
async function initializeRedisStore(redisUrl) {
    try {
        const { createClient } = await Promise.resolve().then(() => __importStar(require('redis')));
        redisClient = createClient({ url: redisUrl });
        await redisClient.connect();
        console.log('Redis rate limiter store initialized');
    }
    catch (error) {
        console.error('Failed to initialize Redis store, using in-memory store:', error);
    }
}
// ==================== User Rate Limiter ====================
/**
 * Check if user has exceeded test generation limit
 */
async function checkUserTestLimit(userId) {
    const now = Date.now();
    const userKey = `user:${userId}:test`;
    if (redisClient) {
        // Redis implementation
        const record = await redisClient.get(userKey);
        if (!record) {
            await redisClient.setEx(userKey, DAY_MS / 1000, '1');
            return { allowed: true, remaining: USER_TEST_LIMIT - 1, resetAt: new Date(now + DAY_MS) };
        }
        const count = parseInt(record);
        if (count >= USER_TEST_LIMIT) {
            const ttl = await redisClient.ttl(userKey);
            return { allowed: false, remaining: 0, resetAt: new Date(now + ttl * 1000) };
        }
        await redisClient.incr(userKey);
        return { allowed: true, remaining: USER_TEST_LIMIT - count - 1, resetAt: new Date(now + DAY_MS) };
    }
    else {
        // In-memory implementation
        let record = userStore.get(userKey);
        if (!record || now > record.resetAt) {
            record = { count: 0, resetAt: now + DAY_MS };
        }
        if (record.count >= USER_TEST_LIMIT) {
            return { allowed: false, remaining: 0, resetAt: new Date(record.resetAt) };
        }
        record.count++;
        userStore.set(userKey, record);
        return { allowed: true, remaining: USER_TEST_LIMIT - record.count, resetAt: new Date(record.resetAt) };
    }
}
/**
 * User rate limiter middleware
 */
function userRateLimiter(limit = USER_TEST_LIMIT, windowMs = DAY_MS) {
    return (0, express_rate_limit_1.default)({
        windowMs,
        max: limit,
        message: {
            success: false,
            error: 'Rate limit exceeded. Please try again later.',
        },
        keyGenerator: (req) => {
            return `user:${req.user?.id || 'anonymous'}`;
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
}
// ==================== IP Rate Limiter ====================
/**
 * IP rate limiter middleware
 */
function ipRateLimiter(limit = IP_LIMIT, windowMs = DAY_MS) {
    return (0, express_rate_limit_1.default)({
        windowMs,
        max: limit,
        message: {
            success: false,
            error: 'Too many requests from this IP. Please try again later.',
        },
        keyGenerator: (req) => {
            return req.ip || req.socket.remoteAddress || 'unknown';
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: async (req, res) => {
            // Log potential abuse
            await prisma.securityLog.create({
                data: {
                    eventType: 'rate_limit_exceeded',
                    ipAddress: req.ip,
                    userId: req.user?.id,
                    details: JSON.stringify({
                        path: req.path,
                        method: req.method,
                        userAgent: req.headers['user-agent'],
                    }),
                },
            });
            res.status(429).json({
                success: false,
                error: 'Too many requests from this IP',
            });
        },
    });
}
// ==================== Global Rate Limiter ====================
/**
 * Global rate limiter middleware (DDoS protection)
 */
function globalRateLimiter(limit = GLOBAL_LIMIT, windowMs = WINDOW_MS) {
    return (0, express_rate_limit_1.default)({
        windowMs,
        max: limit,
        message: {
            success: false,
            error: 'Server is experiencing high traffic. Please try again later.',
        },
        keyGenerator: () => 'global',
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: false,
        handler: (req, res) => {
            console.warn('Global rate limit exceeded');
            res.status(429).json({
                success: false,
                error: 'Server is experiencing high traffic',
            });
        },
    });
}
// ==================== API-Specific Rate Limiters ====================
/**
 * Strict rate limiter for sensitive endpoints
 */
function strictRateLimiter(limit = 5, windowMs = 60 * 1000) {
    return (0, express_rate_limit_1.default)({
        windowMs,
        max: limit,
        message: {
            success: false,
            error: 'Too many attempts. Please try again later.',
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
}
/**
 * Lenient rate limiter for public endpoints
 */
function lenientRateLimiter(limit = 100, windowMs = 60 * 1000) {
    return (0, express_rate_limit_1.default)({
        windowMs,
        max: limit,
        message: {
            success: false,
            error: 'Rate limit exceeded',
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
}
// ==================== Custom Rate Limit Check ====================
/**
 * Check rate limit for custom actions
 */
async function checkRateLimit(key, limit, windowMs) {
    const now = Date.now();
    if (redisClient) {
        const record = await redisClient.get(`ratelimit:${key}`);
        if (!record) {
            await redisClient.setEx(`ratelimit:${key}`, windowMs / 1000, '1');
            return { allowed: true, remaining: limit - 1, resetAt: new Date(now + windowMs) };
        }
        const count = parseInt(record);
        if (count >= limit) {
            const ttl = await redisClient.ttl(`ratelimit:${key}`);
            return { allowed: false, remaining: 0, resetAt: new Date(now + ttl * 1000) };
        }
        await redisClient.incr(`ratelimit:${key}`);
        return { allowed: true, remaining: limit - count - 1, resetAt: new Date(now + windowMs) };
    }
    else {
        const storeKey = `ratelimit:${key}`;
        let record = userStore.get(storeKey);
        if (!record || now > record.resetAt) {
            record = { count: 0, resetAt: now + windowMs };
        }
        if (record.count >= limit) {
            return { allowed: false, remaining: 0, resetAt: new Date(record.resetAt) };
        }
        record.count++;
        userStore.set(storeKey, record);
        return { allowed: true, remaining: limit - record.count, resetAt: new Date(record.resetAt) };
    }
}
// ==================== Security Log Middleware ====================
/**
 * Log suspicious activity
 */
async function securityLogMiddleware(req, res, next) {
    const startTime = Date.now();
    res.on('finish', async () => {
        const duration = Date.now() - startTime;
        // Log slow requests
        if (duration > 5000) {
            await prisma.securityLog.create({
                data: {
                    eventType: 'slow_request',
                    ipAddress: req.ip,
                    userId: req.user?.id,
                    details: JSON.stringify({
                        path: req.path,
                        method: req.method,
                        duration,
                        statusCode: res.statusCode,
                    }),
                },
            });
        }
        // Log error responses
        if (res.statusCode >= 400) {
            await prisma.securityLog.create({
                data: {
                    eventType: 'error_response',
                    ipAddress: req.ip,
                    userId: req.user?.id,
                    details: JSON.stringify({
                        path: req.path,
                        method: req.method,
                        statusCode: res.statusCode,
                        duration,
                    }),
                },
            });
        }
    });
    next();
}
// ==================== Rate Limit Headers ====================
/**
 * Add rate limit headers to response
 */
function rateLimitHeadersMiddleware(req, res, next) {
    const limit = res.getHeader('RateLimit-Limit');
    const remaining = res.getHeader('RateLimit-Remaining');
    const reset = res.getHeader('RateLimit-Reset');
    if (limit) {
        res.setHeader('X-RateLimit-Limit', limit);
    }
    if (remaining) {
        res.setHeader('X-RateLimit-Remaining', remaining);
    }
    if (reset) {
        res.setHeader('X-RateLimit-Reset', reset);
    }
    next();
}
exports.default = {
    initializeRedisStore,
    checkUserTestLimit,
    userRateLimiter,
    ipRateLimiter,
    globalRateLimiter,
    strictRateLimiter,
    lenientRateLimiter,
    checkRateLimit,
    securityLogMiddleware,
    rateLimitHeadersMiddleware,
};
//# sourceMappingURL=rate-limiter.js.map