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
export declare function initializeRedis(redisUrl: string): Promise<boolean>;
export declare function getRedisClient(): any;
/**
 * Get value from cache
 */
export declare function getCache<T>(key: string): Promise<T | null>;
/**
 * Set value in cache
 */
export declare function setCache<T>(key: string, value: T, ttl?: number): Promise<void>;
/**
 * Delete value from cache
 */
export declare function deleteCache(key: string): Promise<void>;
/**
 * Delete multiple cache keys by pattern
 */
export declare function deleteCacheByPattern(pattern: string): Promise<void>;
export declare function getCachedMembership(userId: number): Promise<unknown>;
export declare function setCachedMembership(userId: number, membership: any): Promise<void>;
export declare function invalidateMembershipCache(userId: number): Promise<void>;
export declare function getCachedProducts(): Promise<unknown>;
export declare function setCachedProducts(products: any): Promise<void>;
export declare function invalidateProductsCache(): Promise<void>;
export declare function getCachedStabilityScore(userId: number): Promise<unknown>;
export declare function setCachedStabilityScore(userId: number, score: any): Promise<void>;
export declare function invalidateStabilityCache(userId: number): Promise<void>;
/**
 * Get membership with cache-aside pattern
 */
export declare function getMembershipWithCache(userId: number): Promise<any>;
/**
 * Get products with cache-aside pattern
 */
export declare function getProductsWithCache(): Promise<any>;
/**
 * Get browser cache headers for static assets
 */
export declare function getStaticCacheHeaders(): {
    'Cache-Control': string;
    ETag: string;
};
/**
 * Get browser cache headers for report images
 */
export declare function getReportCacheHeaders(reportId: string): {
    'Cache-Control': string;
    ETag: string;
};
/**
 * Get no-cache headers for dynamic content
 */
export declare function getNoCacheHeaders(): {
    'Cache-Control': string;
    Pragma: string;
    Expires: string;
};
interface CDNConfig {
    baseUrl: string;
    apiKey: string;
}
export declare function configureCDN(config: CDNConfig): void;
/**
 * Upload asset to CDN
 */
export declare function uploadToCDN(filePath: string, contentType: string): Promise<string>;
/**
 * Purge CDN cache
 */
export declare function purgeCDNCache(urls: string[]): Promise<void>;
/**
 * Warm cache for frequently accessed data
 * Run this during deployment or low-traffic periods
 */
export declare function warmCache(): Promise<void>;
/**
 * Get cache statistics
 */
export declare function getCacheStats(): Promise<{
    connected: boolean;
    keys: number;
    info?: undefined;
    error?: undefined;
} | {
    connected: boolean;
    keys: any;
    info: any;
    error?: undefined;
} | {
    connected: boolean;
    error: string;
    keys?: undefined;
    info?: undefined;
}>;
declare const _default: {
    CACHE_CONFIG: {
        USER_MEMBERSHIP: number;
        PRODUCTS: number;
        STABILITY_SCORE: number;
        PERSONALITY_PROFILE: number;
        STATIC_ASSETS: number;
        REPORT_IMAGES: number;
        CDN_STATIC: number;
        CDN_REPORTS: number;
    };
    initializeRedis: typeof initializeRedis;
    getRedisClient: typeof getRedisClient;
    getCache: typeof getCache;
    setCache: typeof setCache;
    deleteCache: typeof deleteCache;
    deleteCacheByPattern: typeof deleteCacheByPattern;
    getCachedMembership: typeof getCachedMembership;
    setCachedMembership: typeof setCachedMembership;
    invalidateMembershipCache: typeof invalidateMembershipCache;
    getCachedProducts: typeof getCachedProducts;
    setCachedProducts: typeof setCachedProducts;
    invalidateProductsCache: typeof invalidateProductsCache;
    getCachedStabilityScore: typeof getCachedStabilityScore;
    setCachedStabilityScore: typeof setCachedStabilityScore;
    invalidateStabilityCache: typeof invalidateStabilityCache;
    getMembershipWithCache: typeof getMembershipWithCache;
    getProductsWithCache: typeof getProductsWithCache;
    getStaticCacheHeaders: typeof getStaticCacheHeaders;
    getReportCacheHeaders: typeof getReportCacheHeaders;
    getNoCacheHeaders: typeof getNoCacheHeaders;
    configureCDN: typeof configureCDN;
    uploadToCDN: typeof uploadToCDN;
    purgeCDNCache: typeof purgeCDNCache;
    warmCache: typeof warmCache;
    getCacheStats: typeof getCacheStats;
};
export default _default;
//# sourceMappingURL=cache.d.ts.map