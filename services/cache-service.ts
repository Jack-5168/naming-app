/**
 * Redis 缓存服务层
 *
 * 缓存策略：
 * - 测试结果缓存：1 小时
 * - 会员权益缓存：30 分钟
 * - 热门分享卡片缓存：24 小时
 * - 题库缓存：7 天
 *
 * 预期效果：
 * - API 响应时间降低 60%
 * - 数据库查询减少 80%
 */

import Redis from "ioredis";
import { promisify } from "util";

// Redis 连接配置
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || "0"),
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    if (times > 3) return null; // 放弃重连
    return Math.min(times * 200, 2000); // 指数退避
  },
};

// 缓存过期时间配置（秒）
const CACHE_TTL = {
  TEST_RESULT: 3600, // 1 小时
  MEMBER_BENEFIT: 1800, // 30 分钟
  SHARE_CARD: 86400, // 24 小时
  QUESTION_BANK: 604800, // 7 天
  DEFAULT: 300, // 5 分钟默认
};

// 缓存键前缀
const CACHE_PREFIX = {
  TEST_RESULT: "cache:test:",
  MEMBER_BENEFIT: "cache:member:",
  SHARE_CARD: "cache:share:",
  QUESTION_BANK: "cache:question:",
  USER_SESSION: "cache:session:",
};

interface CacheOptions {
  ttl?: number;
  prefix?: string;
  serialize?: boolean;
}

interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  hitRate: number;
}

class CacheService {
  private redis: Redis;
  private stats: CacheStats;
  private isConnected: boolean;

  constructor() {
    this.redis = new Redis(REDIS_CONFIG);
    this.isConnected = false;
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
      hitRate: 0,
    };

    this.setupConnectionHandlers();
  }

  private setupConnectionHandlers() {
    this.redis.on("connect", () => {
      this.isConnected = true;
      console.log("[CacheService] Redis connected");
    });

    this.redis.on("error", (err) => {
      this.isConnected = false;
      this.stats.errors++;
      console.error("[CacheService] Redis error:", err.message);
    });

    this.redis.on("close", () => {
      this.isConnected = false;
      console.warn("[CacheService] Redis connection closed");
    });
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const fullKey = this.buildKey(key, options.prefix);

    try {
      const value = await this.redis.get(fullKey);

      if (value === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      this.updateHitRate();

      return options.serialize !== false ? JSON.parse(value) : (value as T);
    } catch (error) {
      this.stats.errors++;
      console.error(`[CacheService] Get error for key ${fullKey}:`, error);
      return null;
    }
  }

  /**
   * 设置缓存
   */
  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {},
  ): Promise<boolean> {
    const fullKey = this.buildKey(key, options.prefix);
    const ttl = options.ttl || CACHE_TTL.DEFAULT;

    try {
      const serialized =
        options.serialize !== false ? JSON.stringify(value) : (value as string);

      if (ttl > 0) {
        await this.redis.setex(fullKey, ttl, serialized as string);
      } else {
        await this.redis.set(fullKey, serialized as string);
      }

      return true;
    } catch (error) {
      this.stats.errors++;
      console.error(`[CacheService] Set error for key ${fullKey}:`, error);
      return false;
    }
  }

  /**
   * 删除缓存
   */
  async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    const fullKey = this.buildKey(key, options.prefix);

    try {
      await this.redis.del(fullKey);
      return true;
    } catch (error) {
      this.stats.errors++;
      console.error(`[CacheService] Delete error for key ${fullKey}:`, error);
      return false;
    }
  }

  /**
   * 批量删除（支持通配符）
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;

      const deleted = await this.redis.del(...keys);
      return deleted;
    } catch (error) {
      this.stats.errors++;
      console.error(
        `[CacheService] Delete pattern error for ${pattern}:`,
        error,
      );
      return 0;
    }
  }

  /**
   * 缓存或获取（Cache-Aside 模式）
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {},
  ): Promise<T> {
    // 尝试从缓存获取
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // 缓存未命中，执行获取函数
    const value = await fetchFn();

    // 写入缓存
    await this.set(key, value, options);

    return value;
  }

  // ==================== 业务缓存方法 ====================

  /**
   * 缓存测试结果
   */
  async cacheTestResult(
    userId: string,
    testId: string,
    result: any,
  ): Promise<boolean> {
    const key = `${userId}:${testId}`;
    return this.set(key, result, {
      ttl: CACHE_TTL.TEST_RESULT,
      prefix: CACHE_PREFIX.TEST_RESULT,
    });
  }

  /**
   * 获取测试结果缓存
   */
  async getTestResult(userId: string, testId: string): Promise<any | null> {
    const key = `${userId}:${testId}`;
    return this.get(key, { prefix: CACHE_PREFIX.TEST_RESULT });
  }

  /**
   * 缓存会员权益
   */
  async cacheMemberBenefits(userId: string, benefits: any): Promise<boolean> {
    return this.set(userId, benefits, {
      ttl: CACHE_TTL.MEMBER_BENEFIT,
      prefix: CACHE_PREFIX.MEMBER_BENEFIT,
    });
  }

  /**
   * 获取会员权益缓存
   */
  async getMemberBenefits(userId: string): Promise<any | null> {
    return this.get(userId, { prefix: CACHE_PREFIX.MEMBER_BENEFIT });
  }

  /**
   * 缓存热门分享卡片
   */
  async cacheShareCard(cardId: string, cardData: any): Promise<boolean> {
    return this.set(cardId, cardData, {
      ttl: CACHE_TTL.SHARE_CARD,
      prefix: CACHE_PREFIX.SHARE_CARD,
    });
  }

  /**
   * 获取分享卡片缓存
   */
  async getShareCard(cardId: string): Promise<any | null> {
    return this.get(cardId, { prefix: CACHE_PREFIX.SHARE_CARD });
  }

  /**
   * 缓存题库
   */
  async cacheQuestionBank(
    category: string,
    questions: any[],
  ): Promise<boolean> {
    return this.set(category, questions, {
      ttl: CACHE_TTL.QUESTION_BANK,
      prefix: CACHE_PREFIX.QUESTION_BANK,
    });
  }

  /**
   * 获取题库缓存
   */
  async getQuestionBank(category: string): Promise<any[] | null> {
    return this.get(category, { prefix: CACHE_PREFIX.QUESTION_BANK });
  }

  // ==================== 统计与监控 ====================

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
      hitRate: 0,
    };
  }

  /**
   * 获取 Redis 原生统计
   */
  async getRedisInfo(): Promise<any> {
    try {
      const info = await this.redis.info();
      return info;
    } catch (error) {
      console.error("[CacheService] Get Redis info error:", error);
      return null;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return this.isConnected;
    } catch {
      return false;
    }
  }

  /**
   * 关闭连接
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
    this.isConnected = false;
  }

  // ==================== 私有方法 ====================

  private buildKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}${key}` : key;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }
}

// 单例实例
let cacheServiceInstance: CacheService | null = null;

/**
 * 获取缓存服务单例
 */
export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService();
  }
  return cacheServiceInstance;
}

/**
 * 缓存装饰器工厂
 */
export function Cacheable(options: CacheOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheService = getCacheService();
      const key = `${propertyKey}:${JSON.stringify(args)}`;

      // 尝试从缓存获取
      const cached = await cacheService.get(key, options);
      if (cached !== null) {
        return cached;
      }

      // 执行原方法
      const result = await originalMethod.apply(this, args);

      // 写入缓存
      await cacheService.set(key, result, options);

      return result;
    };

    return descriptor;
  };
}

export { CACHE_TTL, CACHE_PREFIX, CacheService };
export default CacheService;
