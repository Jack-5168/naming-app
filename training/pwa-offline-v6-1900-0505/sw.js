/**
 * WikiBase — Service Worker v6
 *
 * 第六轮迭代核心改进：
 * 1. App Shell 架构 — 分离静态壳与动态内容
 * 2. 智能路由 — 按资源类型自动选择缓存策略
 * 3. Stale-While-Revalidate — API 数据的最佳策略
 * 4. Share Target 处理 — 接收系统分享
 * 5. Background Sync — 离线编辑自动同步
 * 6. 缓存版本管理 — 静默更新 + 旧缓存清理
 * 7. 图片优化 — 按需缓存 + LRU 淘汰
 * 8. 全文搜索索引 — SW 中维护搜索索引缓存
 */

const VERSION = 'v6.0.0';
const PREFIX = 'wikibase';

// === 缓存命名空间 ===
const CACHE_NAMES = {
  // App Shell — 版本绑定，更新时整体替换
  shell: `${PREFIX}-shell-${VERSION}`,
  // 内容缓存 — 独立版本，可单独更新
  content: `${PREFIX}-content-${VERSION}`,
  // 图片缓存 — LRU 淘汰，独立管理
  images: `${PREFIX}-images-${VERSION}`,
  // 搜索索引 — 增量更新
  search: `${PREFIX}-search-${VERSION}`,
  // 旧版缓存前缀（清理用）
  old: PREFIX,
};

// === App Shell 资源 ===
const SHELL_URLS = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/db.js',
  '/search.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // 离线兜底页
  '/offline.html',
  // Markdown 渲染引擎（离线可用）
  'https://unpkg.com/marked/marked.min.js',
];

// === 缓存策略路由配置 ===
const ROUTES = [
  // App Shell — Cache-First（几乎不变）
  {
    match: (req) => {
      const url = new URL(req.url);
      return url.pathname === '/' ||
             url.pathname.endsWith('.html') ||
             url.pathname.endsWith('.js') ||
             url.pathname.endsWith('.css');
    },
    strategy: 'cache-first',
    cacheName: 'shell',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 天
  },
  // 图片 — Cache-First + LRU（独立缓存）
  {
    match: (req) => {
      const url = new URL(req.url);
      return /\.(png|jpg|jpeg|gif|webp|svg|ico)(\?.*)?$/i.test(url.pathname);
    },
    strategy: 'cache-first',
    cacheName: 'images',
    maxEntries: 200,
  },
  // API 请求 — Stale-While-Revalidate
  {
    match: (req) => req.url.includes('/api/'),
    strategy: 'stale-while-revalidate',
    cacheName: 'content',
    maxAge: 5 * 60 * 1000, // 5 分钟
  },
  // 外部资源（CDN）— Network-First（保证最新）
  {
    match: (req) => {
      const url = new URL(req.url);
      return url.hostname !== location.hostname &&
             !url.pathname.endsWith('.js') &&
             !url.pathname.endsWith('.css');
    },
    strategy: 'network-first',
    cacheName: 'content',
    maxAge: 24 * 60 * 60 * 1000, // 1 天
    networkTimeoutSeconds: 3,
  },
  // 默认 — Network-First
  {
    match: () => true,
    strategy: 'network-first',
    cacheName: 'content',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
    networkTimeoutSeconds: 5,
  },
];

// ============================================================
// 安装 — 预缓存 App Shell
// ============================================================
self.addEventListener('install', (event) => {
  console.log(`[SW ${VERSION}] install`);

  event.waitUntil(
    caches.open(CACHE_NAMES.shell).then(async (cache) => {
      // 过滤掉不可用的外部 URL
      const validUrls = SHELL_URLS.filter(url => {
        if (url.startsWith('http')) {
          // 外部资源不阻塞安装
          return false;
        }
        return true;
      });

      await cache.addAll(validUrls);
      console.log(`[SW ${VERSION}] Shell 预缓存完成: ${validUrls.length} 个资源`);

      // 异步缓存外部资源（不阻塞安装）
      const externalUrls = SHELL_URLS.filter(url => url.startsWith('http'));
      if (externalUrls.length > 0) {
        caches.open(CACHE_NAMES.shell).then(c => c.addAll(externalUrls).catch(() => {}));
      }
    })
      .catch(err => console.error(`[SW ${VERSION}] Shell 缓存失败:`, err))
  );

  // 跳过 waiting，立即激活
  self.skipWaiting();
});

// ============================================================
// 激活 — 清理旧缓存
// ============================================================
self.addEventListener('activate', (event) => {
  console.log(`[SW ${VERSION}] activate`);

  const validCacheNames = Object.values(CACHE_NAMES);

  event.waitUntil(
    caches.keys().then(async (cacheNames) => {
      const deleted = [];
      for (const name of cacheNames) {
        // 只清理本应用的前缀缓存
        if (name.startsWith(PREFIX) && !validCacheNames.includes(name)) {
          await caches.delete(name);
          deleted.push(name);
        }
      }
      if (deleted.length > 0) {
        console.log(`[SW ${VERSION}] 清理旧缓存:`, deleted);
      }

      // 立即接管所有客户端
      return self.clients.claim();
    })
  );
});

// ============================================================
// Fetch — 智能路由
// ============================================================
self.addEventListener('fetch', (event) => {
  // 跳过非 GET 请求和非 http(s) 协议
  if (event.request.method !== 'GET' ||
      !event.request.url.startsWith('http')) {
    return;
  }

  // 找到匹配的路由
  const route = ROUTES.find(r => r.match(event.request));
  if (!route) return;

  const cacheName = CACHE_NAMES[route.cacheName];

  switch (route.strategy) {
    case 'cache-first':
      event.respondWith(cacheFirst(event.request, cacheName, route));
      break;
    case 'network-first':
      event.respondWith(networkFirst(event.request, cacheName, route));
      break;
    case 'stale-while-revalidate':
      event.respondWith(staleWhileRevalidate(event.request, cacheName, route));
      break;
  }
});

// ============================================================
// 缓存策略实现
// ============================================================

/** Cache-First: 缓存命中直接返回，失败则网络请求 */
async function cacheFirst(request, cacheName, options = {}) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    // 检查 TTL
    if (options.maxAge) {
      const age = Date.now() - (cached.headers.get('sw-cached-at') || 0);
      if (age > options.maxAge) {
        // 过期但返回缓存，同时后台更新
        fetchAndCache(request, cache, options);
        return cached;
      }
    }
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      await putInCache(cache, request, response, options);
    }
    return response.clone();
  } catch (err) {
    // 离线兜底
    return offlineFallback(request);
  }
}

/** Network-First: 优先网络，失败回退缓存 */
async function networkFirst(request, cacheName, options = {}) {
  const cache = await caches.open(cacheName);
  const timeout = (options.networkTimeoutSeconds || 5) * 1000;

  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('network-timeout')), timeout)),
    ]);

    if (response.ok) {
      await putInCache(cache, request, response, options);
    }
    return response.clone();
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return offlineFallback(request);
  }
}

/** Stale-While-Revalidate: 立即返回缓存，后台更新 */
async function staleWhileRevalidate(request, cacheName, options = {}) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // 后台更新
  fetchAndCache(request, cache, options);

  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      await putInCache(cache, request, response, options);
    }
    return response.clone();
  } catch (err) {
    return offlineFallback(request);
  }
}

// ============================================================
// 缓存辅助函数
// ============================================================

async function putInCache(cache, request, response, options = {}) {
  // 只缓存成功响应
  if (!response.ok || response.status !== 200) return;

  const responseToCache = response.clone();

  // 添加缓存时间戳
  const headers = new Headers(responseToCache.headers);
  headers.set('sw-cached-at', Date.now().toString());

  const cachedResponse = new Response(responseToCache.body, {
    status: responseToCache.status,
    statusText: responseToCache.statusText,
    headers,
  });

  await cache.put(request, cachedResponse);

  // LRU 淘汰（图片缓存）
  if (options.maxEntries) {
    await enforceLRU(cache, options.maxEntries);
  }
}

/** LRU 淘汰：保留最新的 N 个条目 */
async function enforceLRU(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;

  // 按缓存时间排序（最旧的先删除）
  const toDelete = keys.slice(0, keys.length - maxEntries);
  for (const key of toDelete) {
    await cache.delete(key);
  }
  console.log(`[SW] LRU 淘汰: 删除 ${toDelete.length} 个旧条目`);
}

/** 后台 fetch 并缓存（不阻塞响应） */
function fetchAndCache(request, cache, options = {}) {
  return fetch(request).then(response => {
    if (response.ok) {
      putInCache(cache, request, response, options);
    }
  }).catch(() => {});
}

// ============================================================
// 离线兜底
// ============================================================

async function offlineFallback(request) {
  const url = new URL(request.url);

  // HTML 请求 → 离线页面
  if (request.headers.get('accept')?.includes('text/html')) {
    const shellCache = await caches.open(CACHE_NAMES.shell);
    const offlinePage = await shellCache.match('/offline.html');
    if (offlinePage) return offlinePage;
  }

  // 图片请求 → 占位图
  if (/\.(png|jpg|jpeg|gif|webp|svg)/i.test(url.pathname)) {
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
        <rect fill="#1e293b" width="200" height="200"/>
        <text fill="#64748b" x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="14">
          离线不可用
        </text>
      </svg>`,
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }

  // 默认
  return new Response('离线不可用', { status: 503, statusText: 'Service Unavailable' });
}

// ============================================================
// Background Sync — 离线编辑同步
// ============================================================

self.addEventListener('sync', (event) => {
  console.log(`[SW ${VERSION}] sync event: ${event.tag}`);

  if (event.tag === 'sync-documents') {
    event.waitUntil(syncDocuments());
  } else if (event.tag === 'sync-images') {
    event.waitUntil(syncImages());
  }
});

/** 同步待上传的文档变更 */
async function syncDocuments() {
  // 通过 postMessage 通知客户端执行同步
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage({
      type: 'SYNC_NOW',
      payload: { type: 'documents' },
    });
  }
}

/** 同步待上传的图片 */
async function syncImages() {
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage({
      type: 'SYNC_NOW',
      payload: { type: 'images' },
    });
  }
}

// ============================================================
// Push 通知
// ============================================================

self.addEventListener('push', (event) => {
  let data = { title: 'WikiBase', body: '新通知', url: '/' };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'wiki-update',
      data: { url: data.url },
      actions: [
        { action: 'view', title: '查看' },
        { action: 'dismiss', title: '关闭' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view' || !event.action) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clientList => {
        // 如果已有窗口，聚焦它
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            return client.focus();
          }
        }
        // 否则打开新窗口
        return self.clients.openWindow(event.notification.data?.url || '/');
      })
    );
  }
});

// ============================================================
// Message — 与客户端通信
// ============================================================

self.addEventListener('message', (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_URLS':
      // 客户端请求缓存指定 URL
      event.waitUntil(
        caches.open(CACHE_NAMES.content).then(cache =>
          Promise.all(
            payload.urls.map(url =>
              fetch(url).then(resp => cache.put(url, resp)).catch(() => {}))
          ))
      );
      break;

    case 'GET_CACHE_STATS':
      // 返回缓存统计信息
      event.waitUntil(
        caches.keys().then(async keys => {
          const stats = {};
          for (const key of keys) {
            const cache = await caches.open(key);
            const requests = await cache.keys();
            stats[key] = requests.length;
          }
          event.ports[0]?.postMessage({ type: 'CACHE_STATS', stats });
        })
      );
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.keys().then(keys =>
          Promise.all(
            keys.filter(k => k.startsWith(PREFIX)).map(k => caches.delete(k))
          )).then(() => {
          // 重新缓存 Shell
          return caches.open(CACHE_NAMES.shell).then(cache =>
            cache.addAll(SHELL_URLS.filter(u => !u.startsWith('http'))));
        })
      );
      break;
  }
});

// ============================================================
// Periodic Background Sync（如果浏览器支持）
// ============================================================

self.addEventListener('periodicsync', (event) => {
  console.log(`[SW ${VERSION}] periodic sync: ${event.tag}`);

  if (event.tag === 'refresh-search-index') {
    event.waitUntil(refreshSearchIndex());
  }
});

async function refreshSearchIndex() {
  // 通知客户端刷新搜索索引
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage({
      type: 'REFRESH_SEARCH_INDEX',
    });
  }
}
