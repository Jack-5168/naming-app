/**
 * Service Worker — OfflineTasks PWA 离线缓存核心
 *
 * 覆盖三大缓存策略：
 * 1. Cache-First（缓存优先）：静态资源，先查缓存再请求网络
 * 2. Network-First（网络优先）：API 数据，优先网络，失败回退缓存
 * 3. Stale-While-Revalidate（缓存+后台更新）：快速响应+后台刷新
 *
 * 高级特性：
 * - Background Sync 离线操作队列
 * - Push 通知支持
 * - 消息通信（客户端 ↔ SW）
 * - 版本化缓存管理
 *
 * 生命周期：install → activate → fetch → sync → push → message
 */

const APP_VERSION = 'v2';
const STATIC_CACHE = `offlinetasks-static-${APP_VERSION}`;
const DYNAMIC_CACHE = `offlinetasks-dynamic-${APP_VERSION}`;
const IMAGE_CACHE = `offlinetasks-image-${APP_VERSION}`;
const CACHE_LIMITS = { dynamic: 50, image: 30 };

// 预缓存的静态资源（install 阶段）
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './manifest.json',
  './offline-fallback.html',
];

// ============================================
// 1. INSTALL 阶段 — 预缓存核心资源
// ============================================
self.addEventListener('install', (event) => {
  console.log('[SW] Install — 预缓存静态资源...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).then(() => {
        console.log('[SW] Install — 预缓存完成，', STATIC_ASSETS.length, '个资源');
        return self.skipWaiting();
      });
    }).catch((err) => {
      console.error('[SW] Install — 预缓存失败:', err);
    })
  );
});

// ============================================
// 2. ACTIVATE 阶段 — 清理旧缓存
// ============================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate — 清理旧缓存...');
  const validCaches = [STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !validCaches.includes(name))
          .map((name) => {
            console.log('[SW] Activate — 删除旧缓存:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activate — 旧缓存清理完成');
      return self.clients.claim();
    })
  );
});

// ============================================
// 3. FETCH 拦截 — 缓存策略路由
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非 GET 请求和非 http(s) 请求
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // 根据请求类型选择缓存策略
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
  } else if (isImageRequest(url.pathname)) {
    event.respondWith(cacheFirstWithNetworkFallback(request));
  } else if (isAPIRequest(url.pathname)) {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

// --- 缓存策略实现 ---

/**
 * Cache-First: 先查缓存，未命中再请求网络并缓存
 * 适用：静态资源（JS/CSS/HTML）
 */
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    console.log('[SW] Cache-First 命中:', request.url);
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] Cache-First 网络失败:', request.url);
    return caches.match('./offline-fallback.html');
  }
}

/**
 * Cache-First with Network Fallback: 缓存优先，但后台更新
 * 适用：图片资源
 */
async function cacheFirstWithNetworkFallback(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    // 后台更新
    fetch(request).then((response) => {
      if (response.ok) cache.put(request, response.clone());
    }).catch(() => {});
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      trimCache(IMAGE_CACHE, CACHE_LIMITS.image);
    }
    return response;
  } catch {
    return new Response('图片不可用（离线状态）', {
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

/**
 * Network-First: 优先网络，失败回退缓存
 * 适用：API 数据
 */
async function networkFirst(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      trimCache(DYNAMIC_CACHE, CACHE_LIMITS.dynamic);
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      console.log('[SW] Network-First 回退缓存:', request.url);
      return cached;
    }
    return new Response(JSON.stringify({ error: '离线，数据不可用' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Stale-While-Revalidate: 返回缓存同时后台更新
 * 适用：通用资源
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
        trimCache(DYNAMIC_CACHE, CACHE_LIMITS.dynamic);
      }
      return response.clone();
    })
    .catch(() => null);

  if (cached) {
    fetchPromise.then((fresh) => {
      if (fresh) {
        // 通知客户端有新数据
        broadcastMessage({ type: 'DATA_UPDATED', url: request.url });
      }
    });
    return cached;
  }

  const fresh = await fetchPromise;
  if (fresh) return fresh;

  return caches.match('./offline-fallback.html');
}

// --- 工具函数 ---

function isStaticAsset(pathname) {
  return /\.(js|css|html|json|woff2?|ttf|eot)$/.test(pathname);
}

function isImageRequest(pathname) {
  return /\.(png|jpg|jpeg|gif|svg|webp|ico)$/.test(pathname);
}

function isAPIRequest(pathname) {
  return pathname.startsWith('/api/');
}

/**
 * 限制缓存大小，删除最旧的条目
 */
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    const toDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(toDelete.map((key) => cache.delete(key)));
    console.log(`[SW] TrimCache — ${cacheName}: 删除 ${toDelete.length} 个旧条目`);
  }
}

/**
 * 广播消息给所有客户端
 */
function broadcastMessage(data) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage(data);
    });
  });
}

// ============================================
// 4. BACKGROUND SYNC — 离线操作队列
// ============================================
self.addEventListener('sync', (event) => {
  console.log('[SW] Background Sync 触发:', event.tag);

  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncTasks());
  }
});

async function syncTasks() {
  console.log('[SW] Background Sync — 开始同步离线任务...');
  // 通知客户端执行同步
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'PERFORM_SYNC' });
  });
}

// ============================================
// 5. PUSH 通知 — 推送消息处理
// ============================================
self.addEventListener('push', (event) => {
  console.log('[SW] Push 通知收到');
  const data = event.data ? event.data.json() : { title: 'OfflineTasks', body: '有新任务提醒！' };

  event.waitUntil(
    self.registration.showNotification(data.title || 'OfflineTasks', {
      body: data.body || '你有待完成的任务',
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%233b82f6" width="100" height="100" rx="16"/><path d="M30 50l15 15 25-30" stroke="white" stroke-width="8" fill="none" stroke-linecap="round"/></svg>',
      badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%233b82f6" width="100" height="100" rx="16"/><path d="M30 50l15 15 25-30" stroke="white" stroke-width="8" fill="none" stroke-linecap="round"/></svg>',
      tag: 'offlinetasks-notification',
      requireInteraction: true,
      actions: [
        { action: 'view', title: '查看任务' },
        { action: 'dismiss', title: '忽略' },
      ],
      data: { url: './index.html' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] 通知点击:', event.action);
  event.notification.close();

  if (event.action === 'view' || !event.action) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        if (clients.length > 0) {
          clients[0].focus();
        } else {
          self.clients.openWindow('./index.html');
        }
      })
    );
  }
});

// ============================================
// 6. MESSAGE 通信 — 客户端 ↔ SW
// ============================================
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_URLS':
      // 动态缓存指定 URL
      event.waitUntil(
        caches.open(DYNAMIC_CACHE).then((cache) => {
          return cache.addAll(payload || []);
        })
      );
      break;

    case 'GET_CACHE_STATUS':
      // 返回缓存状态
      event.waitUntil(
        caches.keys().then((names) => {
          event.source.postMessage({ type: 'CACHE_STATUS', payload: names });
        })
      );
      break;

    case 'CLEAR_DYNAMIC_CACHE':
      event.waitUntil(caches.delete(DYNAMIC_CACHE));
      break;

    default:
      console.log('[SW] 未知消息类型:', type);
  }
});

console.log('[SW] Service Worker 脚本已加载');
