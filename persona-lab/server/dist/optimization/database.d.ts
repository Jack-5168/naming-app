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
/**
 * Optimize user query with membership (avoid N+1)
 * BAD: Loading users then memberships separately
 * GOOD: Single query with include
 */
export declare function getUsersWithMemberships(userIds: number[]): Promise<{
    id: number;
    email: string;
    name: string | null;
    createdAt: Date;
    updatedAt: Date;
}[]>;
/**
 * Optimize test records with stability calculation
 * Use raw query for complex aggregations
 */
export declare function getUserStabilityStats(userId: number): Promise<any>;
/**
 * Batch insert test answers (avoid multiple INSERTs)
 */
export declare function batchInsertAnswers(answers: Array<{
    testId: string;
    questionId: string;
    response: number;
    responseTime: number;
}>): Promise<any>;
/**
 * Optimized pagination with cursor-based pagination
 * Better than offset-based for large datasets
 */
export declare function getTestRecordsPaginated(userId: number, limit?: number, cursor?: string): Promise<any>;
/**
 * Create recommended indexes
 * Run this during migration
 */
export declare function createOptimizedIndexes(): Promise<void>;
interface SlowQuery {
    query: string;
    duration: number;
    timestamp: Date;
}
/**
 * Enable slow query logging
 * Add this to Prisma client setup
 */
export declare function enableSlowQueryLogging(): void;
/**
 * Get slow query report
 */
export declare function getSlowQueryReport(limit?: number): SlowQuery[];
/**
 * Clear slow query log
 */
export declare function clearSlowQueryLog(): void;
/**
 * Cache query result
 */
export declare function cachedQuery<T>(key: string, queryFn: () => Promise<T>, ttl?: number): Promise<T>;
/**
 * Invalidate cache
 */
export declare function invalidateCache(pattern: string): void;
/**
 * Clear all cache
 */
export declare function clearCache(): void;
/**
 * Check database connection health
 */
export declare function checkDatabaseHealth(): Promise<{
    healthy: boolean;
    responseTime: number;
    connections: {
        max: number;
        min: number;
    };
    error?: undefined;
} | {
    healthy: boolean;
    error: string;
    responseTime?: undefined;
    connections?: undefined;
}>;
/**
 * Bulk update with chunking
 * Prevents memory issues with large datasets
 */
export declare function bulkUpdate<T extends {
    id: string | number;
}>(model: any, items: T[], updateFn: (item: T) => Record<string, any>, chunkSize?: number): Promise<any[]>;
/**
 * Bulk delete with chunking
 */
export declare function bulkDelete(model: any, ids: (string | number)[], chunkSize?: number): Promise<void>;
declare const _default: {
    CONNECTION_POOL_CONFIG: {
        max: number;
        min: number;
        idleTimeoutMillis: number;
        connectionTimeoutMillis: number;
    };
    getUsersWithMemberships: typeof getUsersWithMemberships;
    getUserStabilityStats: typeof getUserStabilityStats;
    batchInsertAnswers: typeof batchInsertAnswers;
    getTestRecordsPaginated: typeof getTestRecordsPaginated;
    createOptimizedIndexes: typeof createOptimizedIndexes;
    enableSlowQueryLogging: typeof enableSlowQueryLogging;
    getSlowQueryReport: typeof getSlowQueryReport;
    clearSlowQueryLog: typeof clearSlowQueryLog;
    cachedQuery: typeof cachedQuery;
    invalidateCache: typeof invalidateCache;
    clearCache: typeof clearCache;
    checkDatabaseHealth: typeof checkDatabaseHealth;
    bulkUpdate: typeof bulkUpdate;
    bulkDelete: typeof bulkDelete;
};
export default _default;
//# sourceMappingURL=database.d.ts.map