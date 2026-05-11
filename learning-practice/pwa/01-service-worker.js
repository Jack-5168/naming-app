/**
 * Service Worker 注册与生命周期管理
 *
 * 核心功能:
 * 1. 注册 Service Worker
 * 2. 版本管理 (缓存版本 + SW 版本)
 * 3. 更新检测与提示
 * 4. 通信机制 (页面 ↔ SW)
 * 5. 离线状态检测
 */

// ==================== 配置 ====================

const PWA_CONFIG = {
  // 缓存版本 (每次更新缓存内容时递增)
  cacheVersion: 'v1',
  // 静态资源缓存名
  staticCacheName: `static-${PWA_CONFIG?.cacheVersion || 'v1'}`,
  // API 缓存名
  apiCacheName: `api-${PWA_CONFIG?.cacheVersion || 'v1'}`,
  // 动态内容缓存名
  dynamicCacheName: `dynamic-${PWA_CONFIG?.cacheVersion || 'v1'}`,
  // 预缓存资源列表
  precacheUrls: [
    '/',
    '/index.html',
    '/offline.html',
    '/styles/app.css',
    '/scripts/app.js',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
  ],
  // 最大缓存条目数
  maxCacheEntries: 50,
  // API 缓存过期时间 (5分钟)
  apiCacheExpiry: 5 * 60 * 1000,
};

// ==================== 注册 Service Worker ====================

/**
 * 注册 Service Worker
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service Worker 不支持');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('[PWA] Service Worker 注册成功:', registration.scope);

    // 监听更新
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        console.log(`[PWA] SW 状态: ${newWorker.state}`);

        switch (newWorker.state) {
          case 'installed':
            if (navigator.serviceWorker.controller) {
              // 已有控制的 SW，新 SW 已安装但等待激活
              handleUpdateAvailable(registration);
            } else {
              // 首次安装
              console.log('[PWA] 首次安装完成，应用可离线使用');
            }
            break;
          case 'activated':
            console.log('[PWA] Service Worker 已激活');
            // 激活后检查是否有待同步的离线操作
            checkOfflineQueue();
            break;
        }
      });
    });

    // 监听控制器变化 (SW 更新后)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[PWA] Service Worker 控制器已切换');
      // 可以选择刷新页面以使用新 SW
      // window.location.reload();
    });

    return registration;
  } catch (error) {
    console.error('[PWA] Service Worker 注册失败:', error);
    return null;
  }
}

/**
 * 处理可用更新
 */
function handleUpdateAvailable(registration) {
  console.log('[PWA] 发现新版本');

  // 显示更新提示
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.style.cssText = `
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    background: #1976d2; color: white; padding: 12px 24px; border-radius: 8px;
    display: flex; align-items: center; gap: 12px; z-index: 9999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  banner.innerHTML = `
    <span>🔄 新版本可用</span>
    <button id="update-now" style="
      background: white; color: #1976d2; border: none; padding: 6px 16px;
      border-radius: 4px; cursor: pointer; font-weight: bold;
    ">更新</button>
    <button id="update-later" style="
      background: transparent; color: white; border: 1px solid white;
      padding: 6px 16px; border-radius: 4px; cursor: pointer;
    ">稍后</button>
  `;

  document.body.appendChild(banner);

  // 点击"更新"按钮
  document.getElementById('update-now').addEventListener('click', () => {
    // 告诉 SW 跳过等待
    if (registration.waiting) {
      registration.waiting.postMessage({ action: 'skipWaiting' });
    }
    // 刷新页面以使用新 SW
    window.location.reload();
  });

  // 点击"稍后"按钮
  document.getElementById('update-later').addEventListener('click', () => {
    banner.remove();
  });
}

// ==================== 通信机制 ====================

/**
 * 向 Service Worker 发送消息
 * @param {Object} message
 * @returns {Promise<any>} 响应数据
 */
function sendMessageToSW(message) {
  return new Promise((resolve, reject) => {
    if (!navigator.serviceWorker.controller) {
      reject(new Error('Service Worker 未控制当前页面'));
      return;
    }

    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        resolve(event.data);
      }
      messageChannel.port1.close();
      messageChannel.port2.close();
    };

    navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2]);
  });
}

/**
 * 监听来自 SW 的消息
 */
function setupSWMessageListener() {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const { type, data } = event.data;

    switch (type) {
      case 'SYNC_COMPLETE':
        console.log('[PWA] 后台同步完成');
        showNotification('同步完成', '离线数据已同步到服务器');
        break;

      case 'CACHE_UPDATED':
        console.log('[PWA] 缓存已更新:', data);
        break;

      case 'OFFLINE_QUEUE_SYNC':
        console.log('[PWA] 离线队列同步中...', data);
        break;
    }
  });
}

// ==================== 离线状态检测 ====================

/**
 * 离线状态管理器
 */
class OfflineManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.listeners = new Set();
    this.setupListeners();
  }

  setupListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('[PWA] 🟢 网络已恢复');
      this.notifyListeners(true);
      this.handleOnline();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('[PWA] 🔴 网络已断开');
      this.notifyListeners(false);
      this.handleOffline();
    });
  }

  /**
   * 监听在线状态变化
   */
  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * 通知所有监听器
   */
  notifyListeners(isOnline) {
    this.listeners.forEach((cb) => {
      try {
        cb(isOnline);
      } catch (err) {
        console.error('[PWA] 离线状态监听器错误:', err);
      }
    });
  }

  /**
   * 网络恢复时的处理
   */
  async handleOnline() {
    // 同步离线队列
    await checkOfflineQueue();
    // 通知 SW 同步
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        action: 'syncNow',
      });
    }
    this.notifyListeners(true);
  }

  /**
   * 网络断开时的处理
   */
  handleOffline() {
    // 显示离线提示
    showNotification('网络断开', '应用将在离线模式下运行');
    this.notifyListeners(false);
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return this.isOnline ? 'online' : 'offline';
  }
}

// ==================== 离线队列检查 ====================

/**
 * 检查并同步离线队列
 */
async function checkOfflineQueue() {
  if (!navigator.onLine) {
    console.log('[PWA] 离线状态，跳过队列检查');
    return;
  }

  try {
    // 请求 Background Sync
    if ('sync' in window.registration || navigator.serviceWorker) {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register('sync-offline-queue');
      console.log('[PWA] 后台同步已注册');
    }
  } catch (err) {
    console.warn('[PWA] 后台同步注册失败，使用轮询:', err);
  }
}

// ==================== 通知 ====================

/**
 * 显示通知
 */
function showNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification(title, { body, icon: '/icons/icon-192.png' });
    return notification;
  }
  return null;
}

// ==================== 初始化 ====================

/**
 * 初始化 PWA 功能
 */
async function initPWA() {
  console.log('[PWA] 初始化...');

  // 注册 Service Worker
  const registration = await registerServiceWorker();
  if (!registration) {
    console.warn('[PWA] Service Worker 不可用，降级为普通 Web 应用');
    return;
  }

  // 设置消息监听
  setupSWMessageListener();

  // 初始化离线管理器
  const offlineManager = new OfflineManager();

  // 监听在线状态变化，更新 UI
  offlineManager.onChange((isOnline) => {
    const indicator = document.getElementById('online-indicator');
    if (indicator) {
      indicator.textContent = isOnline ? '🟢 在线' : '🔴 离线';
      indicator.className = isOnline ? 'status-online' : 'status-offline';
    }
  });

  // 请求通知权限
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  console.log('[PWA] 初始化完成');
  return { registration, offlineManager };
}

// ==================== 导出 ====================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PWA_CONFIG,
    registerServiceWorker,
    sendMessageToSW,
    setupSWMessageListener,
    OfflineManager,
    checkOfflineQueue,
    initPWA,
  };
}
