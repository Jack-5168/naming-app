"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsersWithMemberships = getUsersWithMemberships;
exports.getUserStabilityStats = getUserStabilityStats;
exports.batchInsertAnswers = batchInsertAnswers;
exports.getTestRecordsPaginated = getTestRecordsPaginated;
exports.createOptimizedIndexes = createOptimizedIndexes;
exports.enableSlowQueryLogging = enableSlowQueryLogging;
exports.getSlowQueryReport = getSlowQueryReport;
exports.clearSlowQueryLog = clearSlowQueryLog;
exports.cachedQuery = cachedQuery;
exports.invalidateCache = invalidateCache;
exports.clearCache = clearCache;
exports.checkDatabaseHealth = checkDatabaseHealth;
exports.bulkUpdate = bulkUpdate;
exports.bulkDelete = bulkDelete;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// ==================== Connection Pool Configuration ====================
const CONNECTION_POOL_CONFIG = {
    max: 20, // Maximum connections
    min: 5, // Minimum connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};
// ==================== Query Optimization ====================
/**
 * Optimize user query with membership (avoid N+1)
 * BAD: Loading users then memberships separately
 * GOOD: Single query with include
 */
async function getUsersWithMemberships(userIds) {
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
async function getUserStabilityStats(userId) {
    const result = await prisma.$queryRaw `
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
async function batchInsertAnswers(answers) {
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
async function getTestRecordsPaginated(userId, limit = 20, cursor) {
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
async function createOptimizedIndexes() {
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
        }
        catch (error) {
            console.error(`Failed to create index: ${query}`, error);
        }
    }
}
const slowQueryThreshold = 1000; // 1 second
const slowQueries = [];
/**
 * Enable slow query logging
 * Add this to Prisma client setup
 */
function enableSlowQueryLogging() {
    prisma.$use(async (params, next) => {
        const before = Date.now();
        const result = await next(params);
        const after = Date.now();
        const duration = after - before;
        if (duration > slowQueryThreshold) {
            const slowQuery = {
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
            }).catch(() => { }); // Ignore errors
        }
        return result;
    });
}
/**
 * Get slow query report
 */
function getSlowQueryReport(limit = 10) {
    return slowQueries
        .sort((a, b) => b.duration - a.duration)
        .slice(0, limit);
}
/**
 * Clear slow query log
 */
function clearSlowQueryLog() {
    slowQueries.length = 0;
}
const queryCache = new Map();
/**
 * Cache query result
 */
async function cachedQuery(key, queryFn, ttl = 60000 // 1 minute default
) {
    const cached = queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
        return cached.data;
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
function invalidateCache(pattern) {
    for (const key of queryCache.keys()) {
        if (key.includes(pattern)) {
            queryCache.delete(key);
        }
    }
}
/**
 * Clear all cache
 */
function clearCache() {
    queryCache.clear();
}
// ==================== Connection Health Check ====================
/**
 * Check database connection health
 */
async function checkDatabaseHealth() {
    const startTime = Date.now();
    try {
        await prisma.$queryRaw `SELECT 1`;
        const responseTime = Date.now() - startTime;
        return {
            healthy: true,
            responseTime,
            connections: {
                max: CONNECTION_POOL_CONFIG.max,
                min: CONNECTION_POOL_CONFIG.min,
            },
        };
    }
    catch (error) {
        return {
            healthy: false,
            error: error.message,
        };
    }
}
// ==================== Bulk Operations ====================
/**
 * Bulk update with chunking
 * Prevents memory issues with large datasets
 */
async function bulkUpdate(model, items, updateFn, chunkSize = 100) {
    const chunks = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }
    const results = [];
    for (const chunk of chunks) {
        const updates = chunk.map(item => model.update({
            where: { id: item.id },
            data: updateFn(item),
        }));
        const chunkResults = await Promise.all(updates);
        results.push(...chunkResults);
    }
    return results;
}
/**
 * Bulk delete with chunking
 */
async function bulkDelete(model, ids, chunkSize = 100) {
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
exports.default = {
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
//# sourceMappingURL=database.js.map