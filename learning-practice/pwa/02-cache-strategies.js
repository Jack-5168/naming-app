/**
 * 五种缓存策略完整实现
 *
 * 策略列表:
 * 1. Cache First (缓存优先) — 静态资源
 * 2. Network First (网络优先) — API 数据
 * 3. Stale While Revalidate (缓存同时更新) — 不关键资源
 * 4. Cache Only (仅缓存) — 永不变更资源
 * 5. Network Only (仅网络) — 实时数据
 *
 * 每个策略都包含:
 * - 核心逻辑
 * - 缓存版本管理
 * - 缓存清理 (LRU)
 * - 离线降级
 */

// ==================== 工具函数 ====================

/**
 * 缓存管理器
 */
class CacheManager {
  constructor() {
    this.cacheNames = {
      static: 'static-v1',
      api: 'api-v1',
      dynamic: 'dynamic-v1',
    };
  }

  /**
   * 打开指定缓存
   */
  async openCache(cacheName) {
    return caches.open(cacheName);
  }

  /**
   * LRU 缓存清理
   * 当缓存条目超过 maxEntries 时，删除最旧的条目
   */
  async trimCache(cacheName, maxEntries) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();

    if (keys.length <= maxEntries) return;

    // 删除最旧的条目 (keys 按添加顺序排列)
    const keysToDelete = keys.slice(0, keys.length - maxEntries);
    await Promise.all(keysToDelete.map((key) => cache.delete(key)));

    console.log(
      `[Cache] 清理 ${cacheName}: 删除 ${keysToDelete.length} 个旧条目`,
    );
  }

  /**
   * 清理过期缓存
   * 为每个缓存条目添加时间戳元数据
   */
  async cleanExpiredCache(cacheName, maxAge) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    const now = Date.now();

    for (const request of keys) {
      const response = await cache.match(request);
      const timestamp = response?.headers.get('x-cache-timestamp');

      if (timestamp && now - parseInt(timestamp) > maxAge) {
        await cache.delete(request);
        console.log(`[Cache] 删除过期缓存: ${request.url}`);
      }
    }
  }

  /**
   * 带时间戳的缓存响应
   */
  async cachePut(cacheName, request, response) {
    const cache = await caches.open(cacheName);
    // 添加时间戳头
    const clonedResponse = response.clone();
    const headers = new Headers(clonedResponse.headers);
    headers.append('x-cache-timestamp', Date.now().toString());

    const responseToCache = new Response(clonedResponse.body, {
      status: clonedResponse.status,
      statusText: clonedResponse.statusText,
      headers,
    });

    await cache.put(request, responseToCache);
  }

  /**
   * 获取缓存时间戳
   */
  async getCacheTimestamp(cacheName, request) {
    const cache = await caches.open(cacheName);
    const response = await cache.match(request);
    if (!response) return null;
    return response.headers.get('x-cache-timestamp');
  }

  /**
   * 删除所有旧版本缓存
   */
  async deleteOldCaches(currentCacheNames) {
    const cacheNames = await caches.keys();
    const currentValues = Object.values(currentCacheNames);

    await Promise.all(
      cacheNames
        .filter((name) => !currentValues.includes(name))
        .map((name) => caches.delete(name)),
    );
  }
}

const cacheManager = new CacheManager();

// ==================== 策略 1: Cache First (缓存优先) ====================

/**
 * 缓存优先策略
 *
 * 流程:
 * 1. 尝试从缓存获取
 * 2. 缓存命中 → 返回缓存
 * 3. 缓存未命中 → 从网络获取 → 存入缓存 → 返回
 * 4. 网络失败 → 返回离线降级页面
 *
 * 适用: 静态资源 (JS/CSS/图片/字体)
 */
async function cacheFirst(request, options = {}) {
  const {
    cacheName = 'static-v1',
    maxEntries = 50,
    offlineFallback = '/offline.html',
  } = options;

  const cache = await caches.open(cacheName);

  // 1. 尝试缓存
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    console.log(`[CacheFirst] 缓存命中: ${request.url}`);
    return cachedResponse;
  }

  // 2. 从网络获取
  try {
    const response = await fetch(request);

    // 只缓存成功的响应
    if (response.ok && request.url.startsWith('http')) {
      await cacheManager.cachePut(cacheName, request, response);
      // LRU 清理
      await cacheManager.trimCache(cacheName, maxEntries);
      console.log(`[CacheFirst] 已缓存: ${request.url}`);
    }

    return response;
  } catch (error) {
    console.warn(`[CacheFirst] 网络请求失败: ${request.url}`);
    // 3. 返回离线降级
    const offlineResponse = await cache.match(offlineFallback);
    return (
      offlineResponse
      || new Response('离线', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/html' },
      })
    );
  }
}

// ==================== 策略 2: Network First (网络优先) ====================

/**
 * 网络优先策略
 *
 * 流程:
 * 1. 尝试从网络获取
 * 2. 网络成功 → 更新缓存 → 返回
 * 3. 网络失败 → 从缓存获取
 * 4. 缓存也未命中 → 返回离线数据/错误
 *
 * 适用: API 数据 (用户信息/文章内容)
 */
async function networkFirst(request, options = {}) {
  const {
    cacheName = 'api-v1',
    maxEntries = 100,
    maxAge = 5 * 60 * 1000, // 5 分钟过期
    offlineFallback = null,
  } = options;

  const cache = await caches.open(cacheName);

  // 1. 尝试网络
  try {
    const response = await fetch(request);

    if (response.ok) {
      await cacheManager.cachePut(cacheName, request, response);
      await cacheManager.trimCache(cacheName, maxEntries);
      console.log(`[NetworkFirst] 网络获取并缓存: ${request.url}`);
    }

    return response;
  } catch (error) {
    console.warn(`[NetworkFirst] 网络请求失败: ${request.url}`);

    // 2. 尝试缓存
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      // 检查是否过期
      const timestamp = await cacheManager.getCacheTimestamp(
        cacheName,
        request,
      );
      if (timestamp && Date.now() - parseInt(timestamp) < maxAge) {
        console.log(`[NetworkFirst] 使用缓存 (未过期): ${request.url}`);
        return cachedResponse;
      }
      console.log(`[NetworkFirst] 缓存已过期: ${request.url}`);
    }

    // 3. 返回离线降级
    if (offlineFallback) {
      return new Response(JSON.stringify(offlineFallback), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        error: 'offline',
        message: '网络不可用，请检查网络连接',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

// ==================== 策略 3: Stale While Revalidate (缓存同时更新) ====================

/**
 * 缓存同时更新策略
 *
 * 流程:
 * 1. 从缓存获取 → 立即返回 (如果有)
 * 2. 同时从网络获取 → 更新缓存
 * 3. 下次请求将使用新缓存
 *
 * 适用: 不关键资源 (头像/非首屏图片/不重要的 API)
 */
async function staleWhileRevalidate(request, options = {}) {
  const { cacheName = 'dynamic-v1', maxEntries = 100 } = options;

  const cache = await caches.open(cacheName);

  // 1. 立即返回缓存 (如果有)
  const cachedResponse = await cache.match(request);
  const fetchPromise = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cacheManager.cachePut(cacheName, request, response);
        await cacheManager.trimCache(cacheName, maxEntries);
        console.log(`[StaleWhileRevalidate] 后台更新缓存: ${request.url}`);
      }
      return response;
    })
    .catch((error) => {
      console.warn(`[StaleWhileRevalidate] 后台更新失败: ${request.url}`);
      return null;
    });

  // 2. 有缓存就返回缓存，否则等待网络
  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetchPromise;
  if (networkResponse) {
    return networkResponse;
  }

  // 3. 都没有 → 离线降级
  return new Response(JSON.stringify({ error: 'offline' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ==================== 策略 4: Cache Only (仅缓存) ====================

/**
 * 仅缓存策略
 *
 * 流程:
 * 1. 只从缓存获取
 * 2. 缓存命中 → 返回
 * 3. 缓存未命中 → 404
 *
 * 适用: 永不变更的资源 (favicon/版本号文件)
 */
async function cacheOnly(request, options = {}) {
  const { cacheName = 'static-v1' } = options;

  const cache = await caches.open(cacheName);
  const response = await cache.match(request);

  if (response) {
    console.log(`[CacheOnly] 缓存命中: ${request.url}`);
    return response;
  }

  console.warn(`[CacheOnly] 缓存未命中: ${request.url}`);
  return new Response('Not Found', {
    status: 404,
    statusText: 'Not Found',
  });
}

// ==================== 策略 5: Network Only (仅网络) ====================

/**
 * 仅网络策略
 *
 * 流程:
 * 1. 只从网络获取
 * 2. 网络成功 → 返回
 * 3. 网络失败 → 错误
 *
 * 适用: 实时数据 (股票/聊天消息/支付)
 */
async function networkOnly(request) {
  try {
    const response = await fetch(request);
    console.log(`[NetworkOnly] 网络请求成功: ${request.url}`);
    return response;
  } catch (error) {
    console.warn(`[NetworkOnly] 网络请求失败: ${request.url}`);
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ==================== 策略路由器 ====================

/**
 * 根据 URL 模式自动选择缓存策略
 */
class CacheRouter {
  constructor() {
    this.routes = [];
  }

  /**
   * 添加路由规则
   * @param {RegExp} pattern - URL 匹配模式
   * @param {Function} strategy - 缓存策略函数
   * @param {Object} options - 策略选项
   */
  addRoute(pattern, strategy, options = {}) {
    this.routes.push({ pattern, strategy, options });
  }

  /**
   * 匹配请求并执行对应策略
   */
  async handle(request) {
    for (const route of this.routes) {
      if (route.pattern.test(request.url)) {
        console.log(
          `[CacheRouter] 匹配路由: ${request.url} → ${route.strategy.name}`,
        );
        return route.strategy(request, route.options);
      }
    }

    // 默认策略: Network First
    console.log(`[CacheRouter] 使用默认策略 (NetworkFirst): ${request.url}`);
    return networkFirst(request);
  }

  /**
   * 预设路由配置
   */
  setupDefaultRoutes() {
    // 静态资源 → Cache First
    this.addRoute(
      /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/,
      cacheFirst,
      { cacheName: 'static-v1', maxEntries: 50 },
    );

    // Google Fonts → Stale While Revalidate
    this.addRoute(
      /fonts\.googleapis\.com|fonts\.gstatic\.com/,
      staleWhileRevalidate,
      { cacheName: 'fonts-v1', maxEntries: 20 },
    );

    // API 请求 → Network First
    this.addRoute(/\/api\//, networkFirst, {
      cacheName: 'api-v1',
      maxEntries: 100,
      maxAge: 5 * 60 * 1000,
    });

    // 图片 CDN → Stale While Revalidate
    this.addRoute(/\/images\/|cdn\./, staleWhileRevalidate, {
      cacheName: 'images-v1',
      maxEntries: 100,
    });

    // HTML 页面 → Network First
    this.addRoute(/text\/html/, networkFirst, {
      cacheName: 'pages-v1',
      maxEntries: 20,
    });
  }
}

// ==================== 预缓存 (Precaching) ====================

/**
 * 预缓存资源 (在 SW install 阶段执行)
 */
async function precacheUrls(urls) {
  const cache = await caches.open('static-v1');
  const failed = [];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
        console.log(`[Precache] 已预缓存: ${url}`);
      } else {
        failed.push(url);
        console.warn(`[Precache] 预缓存失败 (${response.status}): ${url}`);
      }
    } catch (error) {
      failed.push(url);
      console.warn(`[Precache] 预缓存异常: ${url}`, error);
    }
  }

  if (failed.length > 0) {
    console.warn(`[Precache] ${failed.length} 个资源预缓存失败:`, failed);
  }

  return { total: urls.length, success: urls.length - failed.length, failed };
}

// ==================== 缓存版本管理 ====================

/**
 * 清理旧版本缓存
 */
async function cleanupOldCaches(currentVersions) {
  const cacheNames = await caches.keys();
  const currentValues = new Set(Object.values(currentVersions));

  const deleted = [];
  for (const name of cacheNames) {
    if (!currentValues.has(name)) {
      await caches.delete(name);
      deleted.push(name);
      console.log(`[CacheCleanup] 删除旧缓存: ${name}`);
    }
  }

  return deleted;
}

// ==================== 导出 ====================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CacheManager,
    cacheManager,
    cacheFirst,
    networkFirst,
    staleWhileRevalidate,
    cacheOnly,
    networkOnly,
    CacheRouter,
    precacheUrls,
    cleanupOldCaches,
  };
}
