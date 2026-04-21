"use strict";
/**
 * Caching Module
 * Phase 4: Performance Optimization
 *
 * Features:
 * - Redis caching for hot data
 * - CDN caching for static assets
 * - Browser caching for report images
 * - Multi-level caching strategy
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
exports.initializeRedis = initializeRedis;
exports.getRedisClient = getRedisClient;
exports.getCache = getCache;
exports.setCache = setCache;
exports.deleteCache = deleteCache;
exports.deleteCacheByPattern = deleteCacheByPattern;
exports.getCachedMembership = getCachedMembership;
exports.setCachedMembership = setCachedMembership;
exports.invalidateMembershipCache = invalidateMembershipCache;
exports.getCachedProducts = getCachedProducts;
exports.setCachedProducts = setCachedProducts;
exports.invalidateProductsCache = invalidateProductsCache;
exports.getCachedStabilityScore = getCachedStabilityScore;
exports.setCachedStabilityScore = setCachedStabilityScore;
exports.invalidateStabilityCache = invalidateStabilityCache;
exports.getMembershipWithCache = getMembershipWithCache;
exports.getProductsWithCache = getProductsWithCache;
exports.getStaticCacheHeaders = getStaticCacheHeaders;
exports.getReportCacheHeaders = getReportCacheHeaders;
exports.getNoCacheHeaders = getNoCacheHeaders;
exports.configureCDN = configureCDN;
exports.uploadToCDN = uploadToCDN;
exports.purgeCDNCache = purgeCDNCache;
exports.warmCache = warmCache;
exports.getCacheStats = getCacheStats;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// ==================== Configuration ====================
const CACHE_CONFIG = {
    // Redis cache TTLs (in seconds)
    USER_MEMBERSHIP: 300, // 5 minutes
    PRODUCTS: 3600, // 1 hour
    STABILITY_SCORE: 600, // 10 minutes
    PERSONALITY_PROFILE: 900, // 15 minutes
    // Browser cache (in seconds)
    STATIC_ASSETS: 86400 * 30, // 30 days
    REPORT_IMAGES: 86400 * 7, // 7 days
    // CDN cache (in seconds)
    CDN_STATIC: 86400 * 365, // 1 year
    CDN_REPORTS: 86400, // 1 day
};
// ==================== Redis Client ====================
let redisClient = null;
async function initializeRedis(redisUrl) {
    try {
        const { createClient } = await Promise.resolve().then(() => __importStar(require('redis')));
        redisClient = createClient({ url: redisUrl });
        redisClient.on('error', (err) => console.error('Redis Client Error:', err));
        redisClient.on('connect', () => console.log('Redis connected'));
        await redisClient.connect();
        return true;
    }
    catch (error) {
        console.error('Failed to initialize Redis:', error);
        return false;
    }
}
function getRedisClient() {
    return redisClient;
}
// ==================== Cache Keys ====================
const CacheKeys = {
    userMembership: (userId) => `membership:${userId}`,
    products: () => 'products:all',
    stabilityScore: (userId) => `stability:${userId}`,
    personalityProfile: (userId) => `profile:${userId}`,
    testRecord: (testId) => `test:${testId}`,
    dualTest: (dualTestId) => `dual:${dualTestId}`,
    commission: (userId) => `commission:${userId}`,
};
// ==================== Generic Cache Functions ====================
/**
 * Get value from cache
 */
async function getCache(key) {
    if (!redisClient) {
        return null;
    }
    try {
        const value = await redisClient.get(key);
        if (!value) {
            return null;
        }
        return JSON.parse(value);
    }
    catch (error) {
        console.error('Cache get error:', error);
        return null;
    }
}
/**
 * Set value in cache
 */
async function setCache(key, value, ttl = CACHE_CONFIG.USER_MEMBERSHIP) {
    if (!redisClient) {
        return;
    }
    try {
        await redisClient.setEx(key, ttl, JSON.stringify(value));
    }
    catch (error) {
        console.error('Cache set error:', error);
    }
}
/**
 * Delete value from cache
 */
async function deleteCache(key) {
    if (!redisClient) {
        return;
    }
    try {
        await redisClient.del(key);
    }
    catch (error) {
        console.error('Cache delete error:', error);
    }
}
/**
 * Delete multiple cache keys by pattern
 */
async function deleteCacheByPattern(pattern) {
    if (!redisClient) {
        return;
    }
    try {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(keys);
        }
    }
    catch (error) {
        console.error('Cache delete pattern error:', error);
    }
}
// ==================== Membership Cache ====================
async function getCachedMembership(userId) {
    const key = CacheKeys.userMembership(userId);
    return getCache(key);
}
async function setCachedMembership(userId, membership) {
    const key = CacheKeys.userMembership(userId);
    await setCache(key, membership, CACHE_CONFIG.USER_MEMBERSHIP);
}
async function invalidateMembershipCache(userId) {
    await deleteCache(CacheKeys.userMembership(userId));
}
// ==================== Products Cache ====================
async function getCachedProducts() {
    const key = CacheKeys.products();
    return getCache(key);
}
async function setCachedProducts(products) {
    const key = CacheKeys.products();
    await setCache(key, products, CACHE_CONFIG.PRODUCTS);
}
async function invalidateProductsCache() {
    await deleteCache(CacheKeys.products());
}
// ==================== Stability Score Cache ====================
async function getCachedStabilityScore(userId) {
    const key = CacheKeys.stabilityScore(userId);
    return getCache(key);
}
async function setCachedStabilityScore(userId, score) {
    const key = CacheKeys.stabilityScore(userId);
    await setCache(key, score, CACHE_CONFIG.STABILITY_SCORE);
}
async function invalidateStabilityCache(userId) {
    await deleteCache(CacheKeys.stabilityScore(userId));
}
// ==================== Cache-Aside Pattern ====================
/**
 * Get membership with cache-aside pattern
 */
async function getMembershipWithCache(userId) {
    // Try cache first
    const cached = await getCachedMembership(userId);
    if (cached) {
        return cached;
    }
    // Cache miss - fetch from database
    const membership = await prisma.membership.findUnique({
        where: { userId },
    });
    // Update cache
    if (membership) {
        await setCachedMembership(userId, membership);
    }
    return membership;
}
/**
 * Get products with cache-aside pattern
 */
async function getProductsWithCache() {
    // Try cache first
    const cached = await getCachedProducts();
    if (cached) {
        return cached;
    }
    // Cache miss - fetch from database
    const products = await prisma.membershipProduct.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
    });
    // Update cache
    await setCachedProducts(products);
    return products;
}
// ==================== Browser Cache Headers ====================
/**
 * Get browser cache headers for static assets
 */
function getStaticCacheHeaders() {
    return {
        'Cache-Control': `public, max-age=${CACHE_CONFIG.STATIC_ASSETS}`,
        'ETag': `"static-${CACHE_CONFIG.STATIC_ASSETS}"`,
    };
}
/**
 * Get browser cache headers for report images
 */
function getReportCacheHeaders(reportId) {
    return {
        'Cache-Control': `public, max-age=${CACHE_CONFIG.REPORT_IMAGES}`,
        'ETag': `"report-${reportId}"`,
    };
}
/**
 * Get no-cache headers for dynamic content
 */
function getNoCacheHeaders() {
    return {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
    };
}
let cdnConfig = null;
function configureCDN(config) {
    cdnConfig = config;
}
/**
 * Upload asset to CDN
 */
async function uploadToCDN(filePath, contentType) {
    if (!cdnConfig) {
        return filePath; // Return local path if CDN not configured
    }
    try {
        const fs = await Promise.resolve().then(() => __importStar(require('fs')));
        const fileContent = fs.readFileSync(filePath);
        // In production, use actual CDN API (Cloudflare, AWS CloudFront, etc.)
        // This is a placeholder
        const cdnUrl = `${cdnConfig.baseUrl}/${Date.now()}-${filePath.split('/').pop()}`;
        // Set CDN cache headers
        await setCache(`cdn:${cdnUrl}`, {
            url: cdnUrl,
            contentType,
            cachedAt: Date.now(),
        }, CACHE_CONFIG.CDN_STATIC);
        return cdnUrl;
    }
    catch (error) {
        console.error('CDN upload error:', error);
        return filePath;
    }
}
/**
 * Purge CDN cache
 */
async function purgeCDNCache(urls) {
    if (!cdnConfig) {
        return;
    }
    try {
        // In production, call CDN purge API
        console.log('Purging CDN cache for:', urls);
    }
    catch (error) {
        console.error('CDN purge error:', error);
    }
}
// ==================== Cache Warming ====================
/**
 * Warm cache for frequently accessed data
 * Run this during deployment or low-traffic periods
 */
async function warmCache() {
    console.log('Warming cache...');
    try {
        // Warm products cache
        const products = await prisma.membershipProduct.findMany({
            where: { isActive: true },
        });
        await setCachedProducts(products);
        // Warm top users' membership cache
        const topUsers = await prisma.user.findMany({
            take: 100,
            include: { membership: true },
        });
        for (const user of topUsers) {
            if (user.membership) {
                await setCachedMembership(user.id, user.membership);
            }
        }
        console.log('Cache warming completed');
    }
    catch (error) {
        console.error('Cache warming error:', error);
    }
}
// ==================== Cache Statistics ====================
/**
 * Get cache statistics
 */
async function getCacheStats() {
    if (!redisClient) {
        return {
            connected: false,
            keys: 0,
        };
    }
    try {
        const info = await redisClient.info('stats');
        const keys = await redisClient.dbSize();
        return {
            connected: true,
            keys,
            info,
        };
    }
    catch (error) {
        return {
            connected: false,
            error: error.message,
        };
    }
}
exports.default = {
    CACHE_CONFIG,
    initializeRedis,
    getRedisClient,
    getCache,
    setCache,
    deleteCache,
    deleteCacheByPattern,
    getCachedMembership,
    setCachedMembership,
    invalidateMembershipCache,
    getCachedProducts,
    setCachedProducts,
    invalidateProductsCache,
    getCachedStabilityScore,
    setCachedStabilityScore,
    invalidateStabilityCache,
    getMembershipWithCache,
    getProductsWithCache,
    getStaticCacheHeaders,
    getReportCacheHeaders,
    getNoCacheHeaders,
    configureCDN,
    uploadToCDN,
    purgeCDNCache,
    warmCache,
    getCacheStats,
};
//# sourceMappingURL=cache.js.map