/**
 * Service Worker — PWA 离线缓存核心
 *
 * 覆盖三大缓存策略：
 * 1. Cache-First（缓存优先）：静态资源，先查缓存再请求网络
 * 2. Network-First（网络优先）：API 数据，优先网络，失败回退缓存
 * 3. Stale-While-Revalidate（缓存+后台更新）：快速响应+后台刷新
 *
 * 生命周期：
 * install → activate → idle → fetch → ...
 */

const CACHE_NAME = 'offlinenotes-v1';
const STATIC_CACHE = 'offlinenotes-static-v1';
const DYNAMIC_CACHE = 'offlinenotes-dynamic-v1';

// 预缓存的静态资源（install 阶段）
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './manifest.json',
];

// ============================================
// 1. INSTALL 阶段 — 预缓存核心资源
// ============================================
self.addEventListener('install', (event) => {
  console.log('[SW] Install event — 开始预缓存静态资源');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] 正在缓存', STATIC_ASSETS.length, '个静态资源');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] 预缓存完成，跳过等待立即激活');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] 预缓存失败:', err);
        // 即使部分失败也继续安装
      }),
  );
});

// ============================================
// 2. ACTIVATE 阶段 — 清理旧缓存
// ============================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event — 清理旧缓存');

  const expectedCaches = new Set([STATIC_CACHE, DYNAMIC_CACHE]);

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => !expectedCaches.has(name))
          .map((name) => {
            console.log('[SW] 删除旧缓存:', name);
            return caches.delete(name);
          }),
      ))
      .then(() => {
        console.log('[SW] 激活完成，接管所有客户端');
        return self.clients.claim();
      }),
  );
});

// ============================================
// 3. FETCH 拦截 — 根据请求类型选择缓存策略
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理 GET 请求
  if (request.method !== 'GET') return;

  // API 请求 → Network-First（网络优先）
  if (url.pathname.includes('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 图片请求 → Cache-First（缓存优先）
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML 导航请求 → Network-First（确保页面最新）
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // 其他静态资源 → Cache-First
  event.respondWith(cacheFirst(request));
});

// ============================================
// 缓存策略实现
// ============================================

/**
 * Cache-First（缓存优先）
 * 适用：静态资源（CSS、JS、图片）
 * 策略：先查缓存 → 命中则返回 → 未命中则请求网络并缓存
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    console.log('[SW] Cache-First 命中:', request.url);
    return cached;
  }

  console.log('[SW] Cache-First 未命中，请求网络:', request.url);
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.error('[SW] Cache-First 请求失败:', err);
    // 对于导航请求，返回离线页面
    if (request.mode === 'navigate') {
      return caches.match('./index.html');
    }
    throw err;
  }
}

/**
 * Network-First（网络优先）
 * 适用：API 数据、HTML 页面
 * 策略：先请求网络 → 成功则缓存 → 失败则回退缓存
 */
async function networkFirst(request) {
  try {
    console.log('[SW] Network-First 请求网络:', request.url);
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.log('[SW] Network-First 网络失败，回退缓存:', request.url);
    const cached = await caches.match(request);
    if (cached) return cached;

    // 导航请求返回离线页面
    if (request.mode === 'navigate') {
      return caches.match('./index.html');
    }
    return new Response('离线，且无缓存数据', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

/**
 * Stale-While-Revalidate（缓存+后台更新）
 * 适用：不要求实时性的数据
 * 策略：立即返回缓存 → 后台请求网络更新缓存
 */
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, response.clone()));
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

// ============================================
// 4. BACKGROUND SYNC — 离线操作队列
// ============================================
self.addEventListener('sync', (event) => {
  console.log('[SW] Background Sync 触发:', event.tag);

  if (event.tag === 'sync-notes') {
    event.waitUntil(syncNotes());
  }
});

/**
 * 同步待提交的笔记操作
 * 从 IndexedDB 读取待同步队列，逐个发送到服务器
 */
async function syncNotes() {
  console.log('[SW] 开始同步离线笔记操作');

  // 通过 message 通知主线程处理同步
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_REQUEST',
      payload: { timestamp: Date.now() },
    });
  });
}

// ============================================
// 5. PUSH 通知（可选）
// ============================================
self.addEventListener('push', (event) => {
  console.log('[SW] Push 通知收到');

  const data = event.data ? event.data.json() : { title: '通知', body: '新消息' };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📝</text></svg>',
      badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📝</text></svg>',
      tag: 'offlinenotes',
      requireInteraction: true,
    }),
  );
});

// ============================================
// 6. MESSAGE 通信 — 主线程 ↔ Service Worker
// ============================================
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_SW_STATUS':
      event.ports[0].postMessage({
        type: 'SW_STATUS',
        payload: {
          state: self.registration?.active?.state || 'unknown',
          scope: self.registration?.scope || 'unknown',
        },
      });
      break;

    case 'CLEAR_CACHE':
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
      break;

    default:
      console.log('[SW] 未知消息类型:', type);
  }
});

console.log('[SW] Service Worker 脚本加载完成');
