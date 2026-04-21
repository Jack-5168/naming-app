/**
 * Database Optimization Module
 * Phase 4: Performance Optimization
 * 
 * Features:
 * - Index optimization
 * - Query optimization (avoid N+1)
 * - Connection pool tuning
 * - Slow query monitoring
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ==================== Connection Pool Configuration ====================

const CONNECTION_POOL_CONFIG = {
  max: 20, // Maximum connections
  min: 5,  // Minimum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// ==================== Query Optimization ====================

/**
 * Optimize user query with membership (avoid N+1)
 * BAD: Loading users then memberships separately
 * GOOD: Single query with include
 */
export async function getUsersWithMemberships(userIds: number[]) {
  return prisma.user.findMany({
    where: { id: { in: userIds } },
    include: {
      membership: true,
    },
  });
}

/**
 * Optimize test records with stability calculation
 * Use raw query for complex aggregations
 */
export async function getUserStabilityStats(userId: number) {
  const result = await prisma.$queryRaw`
    SELECT 
      COUNT(*) as test_count,
      AVG(stability_index) as avg_stability,
      MAX(completed_at) as last_test,
      MIN(completed_at) as first_test
    FROM "TestRecord"
    WHERE "userId" = ${userId}
      AND stability_index IS NOT NULL
  `;
  
  return result[0];
}

/**
 * Batch insert test answers (avoid multiple INSERTs)
 */
export async function batchInsertAnswers(answers: Array<{
  testId: string;
  questionId: string;
  response: number;
  responseTime: number;
}>) {
  // Using Prisma's createMany for batch insert
  return prisma.answer.createMany({
    data: answers,
    skipDuplicates: true,
  });
}

/**
 * Optimized pagination with cursor-based pagination
 * Better than offset-based for large datasets
 */
export async function getTestRecordsPaginated(
  userId: number,
  limit: number = 20,
  cursor?: string
) {
  return prisma.testRecord.findMany({
    where: { userId },
    take: limit + 1, // Get one extra to check if there's more
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { completedAt: 'desc' },
  });
}

// ==================== Index Recommendations ====================

/**
 * Create recommended indexes
 * Run this during migration
 */
export async function createOptimizedIndexes() {
  const indexes = [
    // User indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_email ON "User"(email)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_phone ON "User"(phone)',
    
    // Membership indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_membership_user_id ON "Membership"("userId")',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_membership_level_status ON "Membership"(level, status)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_membership_end_date ON "Membership"("endDate")',
    
    // Test record indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_record_user_id ON "TestRecord"("userId")',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_record_completed_at ON "TestRecord"("completedAt")',
    
    // Order indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_user_id ON "Order"("userId")',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_status ON "Order"(status)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_created_at ON "Order"("createdAt")',
    
    // Notification indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_user_status ON "PushNotification"("userId", status)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_scheduled_at ON "PushNotification"("scheduledAt")',
  ];
  
  for (const query of indexes) {
    try {
      await prisma.$executeRawUnsafe(query);
      console.log(`Created index: ${query}`);
    } catch (error) {
      console.error(`Failed to create index: ${query}`, error);
    }
  }
}

// ==================== Slow Query Monitoring ====================

interface SlowQuery {
  query: string;
  duration: number;
  timestamp: Date;
}

const slowQueryThreshold = 1000; // 1 second
const slowQueries: SlowQuery[] = [];

/**
 * Enable slow query logging
 * Add this to Prisma client setup
 */
export function enableSlowQueryLogging() {
  prisma.$use(async (params, next) => {
    const before = Date.now();
    const result = await next(params);
    const after = Date.now();
    
    const duration = after - before;
    
    if (duration > slowQueryThreshold) {
      const slowQuery: SlowQuery = {
        query: `${params.model}.${params.action}`,
        duration,
        timestamp: new Date(),
      };
      
      slowQueries.push(slowQuery);
      
      console.warn(`Slow query detected: ${slowQuery.query} (${duration}ms)`);
      
      // Log to database
      prisma.queryLog.create({
        data: {
          query: slowQuery.query,
          duration: slowQuery.duration,
          timestamp: slowQuery.timestamp,
        },
      }).catch(() => {}); // Ignore errors
    }
    
    return result;
  });
}

/**
 * Get slow query report
 */
export function getSlowQueryReport(limit: number = 10) {
  return slowQueries
    .sort((a, b) => b.duration - a.duration)
    .slice(0, limit);
}

/**
 * Clear slow query log
 */
export function clearSlowQueryLog() {
  slowQueries.length = 0;
}

// ==================== Query Caching ====================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const queryCache = new Map<string, CacheEntry<any>>();

/**
 * Cache query result
 */
export async function cachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttl: number = 60000 // 1 minute default
): Promise<T> {
  const cached = queryCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data as T;
  }
  
  const data = await queryFn();
  
  queryCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
  
  return data;
}

/**
 * Invalidate cache
 */
export function invalidateCache(pattern: string) {
  for (const key of queryCache.keys()) {
    if (key.includes(pattern)) {
      queryCache.delete(key);
    }
  }
}

/**
 * Clear all cache
 */
export function clearCache() {
  queryCache.clear();
}

// ==================== Connection Health Check ====================

/**
 * Check database connection health
 */
export async function checkDatabaseHealth() {
  const startTime = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;
    
    return {
      healthy: true,
      responseTime,
      connections: {
        max: CONNECTION_POOL_CONFIG.max,
        min: CONNECTION_POOL_CONFIG.min,
      },
    };
  } catch (error) {
    return {
      healthy: false,
      error: (error as Error).message,
    };
  }
}

// ==================== Bulk Operations ====================

/**
 * Bulk update with chunking
 * Prevents memory issues with large datasets
 */
export async function bulkUpdate<T extends { id: string | number }>(
  model: any,
  items: T[],
  updateFn: (item: T) => Record<string, any>,
  chunkSize: number = 100
) {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  
  const results = [];
  for (const chunk of chunks) {
    const updates = chunk.map(item =>
      model.update({
        where: { id: item.id },
        data: updateFn(item),
      })
    );
    
    const chunkResults = await Promise.all(updates);
    results.push(...chunkResults);
  }
  
  return results;
}

/**
 * Bulk delete with chunking
 */
export async function bulkDelete(
  model: any,
  ids: (string | number)[],
  chunkSize: number = 100
) {
  const chunks = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize));
  }
  
  for (const chunk of chunks) {
    await model.deleteMany({
      where: { id: { in: chunk } },
    });
  }
}

export default {
  CONNECTION_POOL_CONFIG,
  getUsersWithMemberships,
  getUserStabilityStats,
  batchInsertAnswers,
  getTestRecordsPaginated,
  createOptimizedIndexes,
  enableSlowQueryLogging,
  getSlowQueryReport,
  clearSlowQueryLog,
  cachedQuery,
  invalidateCache,
  clearCache,
  checkDatabaseHealth,
  bulkUpdate,
  bulkDelete,
};
