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

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

let redisClient: any = null;

export async function initializeRedis(redisUrl: string) {
  try {
    const { createClient } = await import('redis');
    redisClient = createClient({ url: redisUrl });
    
    redisClient.on('error', (err: any) => console.error('Redis Client Error:', err));
    redisClient.on('connect', () => console.log('Redis connected'));
    
    await redisClient.connect();
    return true;
  } catch (error) {
    console.error('Failed to initialize Redis:', error);
    return false;
  }
}

export function getRedisClient() {
  return redisClient;
}

// ==================== Cache Keys ====================

const CacheKeys = {
  userMembership: (userId: number) => `membership:${userId}`,
  products: () => 'products:all',
  stabilityScore: (userId: number) => `stability:${userId}`,
  personalityProfile: (userId: number) => `profile:${userId}`,
  testRecord: (testId: string) => `test:${testId}`,
  dualTest: (dualTestId: string) => `dual:${dualTestId}`,
  commission: (userId: number) => `commission:${userId}`,
};

// ==================== Generic Cache Functions ====================

/**
 * Get value from cache
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!redisClient) {
    return null;
  }
  
  try {
    const value = await redisClient.get(key);
    if (!value) {
      return null;
    }
    return JSON.parse(value) as T;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

/**
 * Set value in cache
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttl: number = CACHE_CONFIG.USER_MEMBERSHIP
): Promise<void> {
  if (!redisClient) {
    return;
  }
  
  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.error('Cache set error:', error);
  }
}

/**
 * Delete value from cache
 */
export async function deleteCache(key: string): Promise<void> {
  if (!redisClient) {
    return;
  }
  
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error('Cache delete error:', error);
  }
}

/**
 * Delete multiple cache keys by pattern
 */
export async function deleteCacheByPattern(pattern: string): Promise<void> {
  if (!redisClient) {
    return;
  }
  
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.error('Cache delete pattern error:', error);
  }
}

// ==================== Membership Cache ====================

export async function getCachedMembership(userId: number) {
  const key = CacheKeys.userMembership(userId);
  return getCache(key);
}

export async function setCachedMembership(userId: number, membership: any) {
  const key = CacheKeys.userMembership(userId);
  await setCache(key, membership, CACHE_CONFIG.USER_MEMBERSHIP);
}

export async function invalidateMembershipCache(userId: number) {
  await deleteCache(CacheKeys.userMembership(userId));
}

// ==================== Products Cache ====================

export async function getCachedProducts() {
  const key = CacheKeys.products();
  return getCache(key);
}

export async function setCachedProducts(products: any) {
  const key = CacheKeys.products();
  await setCache(key, products, CACHE_CONFIG.PRODUCTS);
}

export async function invalidateProductsCache() {
  await deleteCache(CacheKeys.products());
}

// ==================== Stability Score Cache ====================

export async function getCachedStabilityScore(userId: number) {
  const key = CacheKeys.stabilityScore(userId);
  return getCache(key);
}

export async function setCachedStabilityScore(userId: number, score: any) {
  const key = CacheKeys.stabilityScore(userId);
  await setCache(key, score, CACHE_CONFIG.STABILITY_SCORE);
}

export async function invalidateStabilityCache(userId: number) {
  await deleteCache(CacheKeys.stabilityScore(userId));
}

// ==================== Cache-Aside Pattern ====================

/**
 * Get membership with cache-aside pattern
 */
export async function getMembershipWithCache(userId: number) {
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
export async function getProductsWithCache() {
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
export function getStaticCacheHeaders() {
  return {
    'Cache-Control': `public, max-age=${CACHE_CONFIG.STATIC_ASSETS}`,
    'ETag': `"static-${CACHE_CONFIG.STATIC_ASSETS}"`,
  };
}

/**
 * Get browser cache headers for report images
 */
export function getReportCacheHeaders(reportId: string) {
  return {
    'Cache-Control': `public, max-age=${CACHE_CONFIG.REPORT_IMAGES}`,
    'ETag": `"report-${reportId}"`,
  };
}

/**
 * Get no-cache headers for dynamic content
 */
export function getNoCacheHeaders() {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };
}

// ==================== CDN Integration ====================

interface CDNConfig {
  baseUrl: string;
  apiKey: string;
}

let cdnConfig: CDNConfig | null = null;

export function configureCDN(config: CDNConfig) {
  cdnConfig = config;
}

/**
 * Upload asset to CDN
 */
export async function uploadToCDN(filePath: string, contentType: string): Promise<string> {
  if (!cdnConfig) {
    return filePath; // Return local path if CDN not configured
  }
  
  try {
    const fs = await import('fs');
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
  } catch (error) {
    console.error('CDN upload error:', error);
    return filePath;
  }
}

/**
 * Purge CDN cache
 */
export async function purgeCDNCache(urls: string[]): Promise<void> {
  if (!cdnConfig) {
    return;
  }
  
  try {
    // In production, call CDN purge API
    console.log('Purging CDN cache for:', urls);
  } catch (error) {
    console.error('CDN purge error:', error);
  }
}

// ==================== Cache Warming ====================

/**
 * Warm cache for frequently accessed data
 * Run this during deployment or low-traffic periods
 */
export async function warmCache() {
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
  } catch (error) {
    console.error('Cache warming error:', error);
  }
}

// ==================== Cache Statistics ====================

/**
 * Get cache statistics
 */
export async function getCacheStats() {
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
  } catch (error) {
    return {
      connected: false,
      error: (error as Error).message,
    };
  }
}

export default {
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
