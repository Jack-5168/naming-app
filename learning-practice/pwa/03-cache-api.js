/**
 * Cache API 高级用法
 *
 * 功能:
 * 1. 缓存的增删改查
 * 2. 批量缓存操作
 * 3. 缓存统计与监控
 * 4. 缓存版本管理
 * 5. 缓存预热 (Warm-up)
 * 6. 缓存失效策略
 */

// ==================== Cache API 基础操作 ====================

/**
 * 缓存管理器 (基于 Cache API)
 */
class CacheAPI {
  /**
   * 打开/创建缓存
   */
  static async open(cacheName) {
    return caches.open(cacheName);
  }

  /**
   * 添加资源到缓存
   * 支持单个 URL、URL 数组、Request 对象
   */
  static async add(cacheName, request) {
    const cache = await caches.open(cacheName);
    if (Array.isArray(request)) {
      return cache.addAll(request);
    }
    const response = await fetch(request);
    await cache.put(request, response);
  }

  /**
   * 从缓存获取
   */
  static async get(cacheName, request, options) {
    const cache = await caches.open(cacheName);
    return cache.match(request, options);
  }

  /**
   * 从缓存删除
   */
  static async delete(cacheName, request, options) {
    const cache = await caches.open(cacheName);
    return cache.delete(request, options);
  }

  /**
   * 获取缓存中所有请求
   */
  static async keys(cacheName) {
    const cache = await caches.open(cacheName);
    return cache.keys();
  }

  /**
   * 获取所有缓存名称
   */
  static async getCacheNames() {
    return caches.keys();
  }

  /**
   * 删除整个缓存
   */
  static async deleteCache(cacheName) {
    return caches.delete(cacheName);
  }
}

// ==================== 批量缓存操作 ====================

/**
 * 批量缓存 URL (带并发控制)
 */
async function batchCache(cacheName, urls, concurrency = 3) {
  const cache = await caches.open(cacheName);
  const results = { success: [], failed: [], skipped: [] };

  // 分批处理
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const promises = batch.map(async (url) => {
      try {
        // 检查是否已缓存
        const existing = await cache.match(url);
        if (existing) {
          results.skipped.push(url);
          return;
        }

        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
          results.success.push(url);
        } else {
          results.failed.push(url);
        }
      } catch (err) {
        results.failed.push(url);
      }
    });

    await Promise.allSettled(promises);
  }

  return results;
}

/**
 * 批量删除缓存
 */
async function batchDelete(cacheName, urls) {
  const cache = await caches.open(cacheName);
  const results = { deleted: [], notFound: [] };

  for (const url of urls) {
    const deleted = await cache.delete(url);
    if (deleted) {
      results.deleted.push(url);
    } else {
      results.notFound.push(url);
    }
  }

  return results;
}

// ==================== 缓存统计与监控 ====================

/**
 * 缓存统计信息
 */
async function getCacheStats() {
  const cacheNames = await caches.keys();
  const stats = {};

  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const requests = await cache.keys();

    let totalSize = 0;
    const entries = [];

    for (const request of requests) {
      const response = await cache.match(request);
      const size = response.headers.get('content-length') || 0;
      totalSize += parseInt(size) || 0;
      entries.push({
        url: request.url,
        size: parseInt(size) || 0,
        method: request.method,
      });
    }

    stats[name] = {
      entryCount: requests.length,
      totalSize,
      totalSizeHuman: formatBytes(totalSize),
      entries,
    };
  }

  return stats;
}

/**
 * 格式化字节数
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / k ** i).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 缓存监控器
 */
class CacheMonitor {
  constructor() {
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      totalRequests: 0,
    };
  }

  recordHit() { this.metrics.hits++; }

  recordMiss() { this.metrics.misses++; }

  recordError() { this.metrics.errors++; }

  recordRequest() { this.metrics.totalRequests++; }

  getHitRate() {
    const total = this.metrics.hits + this.metrics.misses;
    return total > 0 ? (this.metrics.hits / total * 100).toFixed(1) : 0;
  }

  getStats() {
    return {
      ...this.metrics,
      hitRate: this.getHitRate() + '%',
    };
  }

  reset() {
    this.metrics = {
      hits: 0, misses: 0, errors: 0, totalRequests: 0,
    };
  }
}

// ==================== 缓存预热 (Warm-up) ====================

/**
 * 缓存预热 — 预加载关键资源
 * 在用户需要之前就缓存好，提升首次加载速度
 */
async function warmupCache(cacheName, resources) {
  console.log(`[Warmup] 开始预热缓存: ${cacheName}`);
  const startTime = performance.now();

  const results = await batchCache(cacheName, resources, 5);

  const duration = performance.now() - startTime;
  console.log(`[Warmup] 预热完成 (${duration.toFixed(0)}ms)`, results);

  return {
    duration,
    ...results,
  };
}

/**
 * 智能预热 — 基于用户行为预测
 */
class SmartWarmup {
  constructor() {
    this.predictedUrls = new Set();
    this.warmedUp = new Set();
  }

  /**
   * 记录用户行为，预测下一步可能访问的资源
   */
  trackUserAction(action, context) {
    switch (action) {
      case 'view_article':
        // 用户看文章 → 预加载相关文章
        this.predictedUrls.add(`/api/related/${context.articleId}`);
        this.predictedUrls.add(`/api/comments/${context.articleId}`);
        break;

      case 'scroll_to_bottom':
        // 滚动到底部 → 预加载下一页
        this.predictedUrls.add(`/api/articles?page=${context.page + 1}`);
        break;

      case 'hover_link':
        // 鼠标悬停链接 → 预加载目标页面
        this.predictedUrls.add(context.url);
        break;
    }
  }

  /**
   * 在空闲时执行预加载
   */
  async warmupWhenIdle() {
    if (typeof requestIdleCallback === 'undefined') return;

    const urls = [...this.predictedUrls].filter(
      (url) => !this.warmedUp.has(url),
    );

    if (urls.length === 0) return;

    requestIdleCallback(async () => {
      await warmupCache('dynamic-v1', urls);
      urls.forEach((url) => this.warmedUp.add(url));
    }, { timeout: 2000 });
  }
}

// ==================== 缓存失效策略 ====================

/**
 * 缓存失效管理器
 * 支持多种失效策略
 */
class CacheInvalidator {
  constructor() {
    this.strategies = new Map();
  }

  /**
   * 基于时间的失效
   * 缓存 N 秒后自动失效
   */
  setTimeBasedExpiry(cacheName, maxAge) {
    this.strategies.set(cacheName, {
      type: 'time',
      maxAge,
    });
  }

  /**
   * 基于版本的失效
   * 版本号变化时清除所有缓存
   */
  setVersionBasedExpiry(cacheName, version) {
    this.strategies.set(cacheName, {
      type: 'version',
      version,
    });
  }

  /**
   * 基于事件的失效
   * 特定事件触发时清除缓存
   */
  setEventBasedExpiry(cacheName, events) {
    this.strategies.set(cacheName, {
      type: 'event',
      events,
    });
  }

  /**
   * 检查缓存是否需要失效
   */
  async checkExpiry(cacheName) {
    const strategy = this.strategies.get(cacheName);
    if (!strategy) return false;

    switch (strategy.type) {
      case 'time': {
        const timestamp = await this.getCacheTimestamp(cacheName);
        return timestamp && (Date.now() - timestamp) > strategy.maxAge;
      }

      case 'version': {
        const cachedVersion = await this.getCacheVersion(cacheName);
        return cachedVersion !== strategy.version;
      }

      case 'event':
        // 事件驱动失效由外部触发
        return false;
    }

    return false;
  }

  /**
   * 手动触发失效
   */
  async invalidate(cacheName) {
    const deleted = await caches.delete(cacheName);
    console.log(`[Invalidator] 缓存已失效: ${cacheName}`);
    return deleted;
  }

  /**
   * 按模式失效缓存
   */
  async invalidateByPattern(cacheName, pattern) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    const regex = new RegExp(pattern);
    const deleted = [];

    for (const request of keys) {
      if (regex.test(request.url)) {
        await cache.delete(request);
        deleted.push(request.url);
      }
    }

    console.log(`[Invalidator] 按模式失效: ${pattern}, 删除 ${deleted.length} 条`);
    return deleted;
  }

  async getCacheTimestamp(cacheName) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length === 0) return null;
    const response = await cache.match(keys[0]);
    return response?.headers.get('x-cache-timestamp');
  }

  async getCacheVersion(cacheName) {
    const cache = await caches.open(cacheName);
    const response = await cache.match('/__version__');
    if (!response) return null;
    const data = await response.json();
    return data.version;
  }
}

// ==================== 缓存调试工具 ====================

/**
 * 缓存调试面板
 */
class CacheDebugger {
  /**
   * 导出所有缓存为 JSON
   */
  static async exportAllCaches() {
    const cacheNames = await caches.keys();
    const exportData = {};

    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      exportData[name] = [];

      for (const request of keys) {
        const response = await cache.match(request);
        const body = await response.text();
        exportData[name].push({
          url: request.url,
          method: request.method,
          headers: Object.fromEntries(response.headers),
          status: response.status,
          body: body.substring(0, 1000), // 限制长度
        });
      }
    }

    return exportData;
  }

  /**
   * 导入缓存数据
   */
  static async importCaches(data) {
    for (const [cacheName, entries] of Object.entries(data)) {
      const cache = await caches.open(cacheName);
      for (const entry of entries) {
        const response = new Response(entry.body, {
          status: entry.status,
          headers: entry.headers,
        });
        await cache.put(entry.url, response);
      }
    }
    console.log('[CacheDebugger] 缓存导入完成');
  }

  /**
   * 清空所有缓存
   */
  static async clearAll() {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    console.log(`[CacheDebugger] 已清空 ${cacheNames.length} 个缓存`);
  }

  /**
   * 生成缓存报告
   */
  static async generateReport() {
    const stats = await getCacheStats();
    const monitor = new CacheMonitor();

    return {
      timestamp: new Date().toISOString(),
      cacheCount: Object.keys(stats).length,
      totalEntries: Object.values(stats).reduce((sum, s) => sum + s.entryCount, 0),
      totalSize: Object.values(stats).reduce((sum, s) => sum + s.totalSize, 0),
      totalSizeHuman: formatBytes(
        Object.values(stats).reduce((sum, s) => sum + s.totalSize, 0),
      ),
      caches: stats,
      hitRate: monitor.getHitRate() + '%',
    };
  }
}

// ==================== 导出 ====================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CacheAPI,
    batchCache,
    batchDelete,
    getCacheStats,
    formatBytes,
    CacheMonitor,
    warmupCache,
    SmartWarmup,
    CacheInvalidator,
    CacheDebugger,
  };
}
