/**
 * 离线请求队列
 *
 * 功能:
 * 1. 网络断开时自动将请求入队
 * 2. 网络恢复后自动同步
 * 3. 重试机制 (指数退避)
 * 4. 冲突检测与解决
 * 5. 队列持久化 (IndexedDB)
 * 6. 队列状态监控
 */

const { NotesDatabase } = require('./04-indexeddb');

// ==================== 离线队列 ====================

/**
 * 离线请求队列
 * 在网络断开时缓存请求，恢复后自动发送
 */
class OfflineQueue {
  constructor(options = {}) {
    this.db = options.db || new NotesDatabase('offline-queue');
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.maxQueueSize = options.maxQueueSize || 100;
    this.isProcessing = false;
    this.listeners = new Set();
  }

  /**
   * 初始化
   */
  async init() {
    await this.db.open();
    console.log('[OfflineQueue] 队列已初始化');

    // 监听网络状态
    window.addEventListener('online', () => this.processQueue());

    return this;
  }

  // ==================== 队列操作 ====================

  /**
   * 添加请求到队列
   */
  async enqueue(request) {
    // 检查队列大小
    const count = await this.db.count('requests');
    if (count >= this.maxQueueSize) {
      console.warn('[OfflineQueue] 队列已满，丢弃最旧的请求');
      await this.trimQueue();
    }

    const entry = {
      id: this.generateId(),
      url: request.url,
      method: request.method || 'GET',
      headers: request.headers || {},
      body: request.body,
      timestamp: Date.now(),
      retryCount: 0,
      nextRetryAt: Date.now(),
      status: 'pending', // pending | retrying | failed | synced
      priority: request.priority || 0, // 数字越小优先级越高
    };

    await this.db.add('requests', entry);
    console.log(`[OfflineQueue] 请求已入队: ${request.method} ${request.url}`);

    this.notifyListeners();

    // 如果在线，立即尝试处理
    if (navigator.onLine) {
      this.processQueue();
    }

    return entry.id;
  }

  /**
   * 获取队列中的所有请求
   */
  async getPendingRequests() {
    return this.db.getAll('requests');
  }

  /**
   * 获取队列状态
   */
  async getQueueStatus() {
    const all = await this.db.getAll('requests');
    return {
      total: all.length,
      pending: all.filter((r) => r.status === 'pending').length,
      retrying: all.filter((r) => r.status === 'retrying').length,
      failed: all.filter((r) => r.status === 'failed').length,
    };
  }

  // ==================== 队列处理 ====================

  /**
   * 处理队列中的请求
   */
  async processQueue() {
    if (this.isProcessing) {
      console.log('[OfflineQueue] 队列正在处理中，跳过');
      return;
    }

    if (!navigator.onLine) {
      console.log('[OfflineQueue] 离线状态，跳过处理');
      return;
    }

    this.isProcessing = true;
    console.log('[OfflineQueue] 开始处理队列...');

    try {
      const requests = await this.db.getAll('requests');
      // 按优先级和时间排序
      const pending = requests
        .filter((r) => r.status === 'pending' || r.status === 'retrying')
        .filter((r) => !r.nextRetryAt || Date.now() >= r.nextRetryAt)
        .sort((a, b) => a.priority - b.priority || a.timestamp - b.timestamp);

      for (const entry of pending) {
        await this.processEntry(entry);
      }

      // 清理已同步的请求
      await this.cleanSynced();

      console.log('[OfflineQueue] 队列处理完成');
    } catch (error) {
      console.error('[OfflineQueue] 队列处理出错:', error);
    } finally {
      this.isProcessing = false;
      this.notifyListeners();
    }
  }

  /**
   * 处理单个队列条目
   */
  async processEntry(entry) {
    try {
      console.log(`[OfflineQueue] 处理: ${entry.method} ${entry.url}`);

      // 更新状态为重试中
      await this.db.put('requests', {
        ...entry,
        status: 'retrying',
      });

      // 发送请求
      const response = await fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body,
      });

      if (response.ok) {
        // 标记为已同步
        await this.db.put('requests', {
          ...entry,
          status: 'synced',
          syncedAt: Date.now(),
          response: await response.json().catch(() => null),
        });
        console.log(`[OfflineQueue] 同步成功: ${entry.url}`);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.warn(`[OfflineQueue] 请求失败: ${entry.url}`, error.message);

      entry.retryCount++;

      if (entry.retryCount >= this.maxRetries) {
        // 超过最大重试次数，标记为失败
        await this.db.put('requests', {
          ...entry,
          status: 'failed',
          error: error.message,
          lastErrorAt: Date.now(),
        });
        console.error(`[OfflineQueue] 请求最终失败: ${entry.url}`);
      } else {
        // 指数退避重试
        const delay = this.retryDelay * 2 ** entry.retryCount;
        await this.db.put('requests', {
          ...entry,
          status: 'retrying',
          retryCount: entry.retryCount,
          nextRetryAt: Date.now() + delay,
          lastError: error.message,
        });
        console.log(`[OfflineQueue] 将在 ${delay}ms 后重试: ${entry.url}`);
      }
    }
  }

  /**
   * 清理已同步的请求
   */
  async cleanSynced() {
    await this.db.cursorReadWrite('requests', (item, cursor) => {
      if (item.status === 'synced') {
        return 'delete';
      }
    });
  }

  /**
   * 裁剪队列 (删除最旧的条目)
   */
  async trimQueue() {
    const requests = await this.db.getAll('requests');
    if (requests.length <= this.maxQueueSize) return;

    const toDelete = requests
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, requests.length - this.maxQueueSize);

    for (const item of toDelete) {
      await this.db.delete('requests', item.id);
    }
  }

  // ==================== 监听器 ====================

  /**
   * 监听队列变化
   */
  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners() {
    this.getQueueStatus().then((status) => {
      this.listeners.forEach((cb) => {
        try {
          cb(status);
        } catch (e) {
          console.error(e);
        }
      });
    });
  }

  // ==================== 工具方法 ====================

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 清空队列
   */
  async clear() {
    await this.db.clear('requests');
    this.notifyListeners();
  }
}

// ==================== 自动拦截器 ====================

/**
 * 自动拦截 fetch 请求
 * 离线时自动入队，在线时正常发送
 */
function setupFetchInterceptor(queue) {
  const originalFetch = window.fetch;

  window.fetch = async function (input, init) {
    // 只拦截 API 请求
    const url = typeof input === 'string' ? input : input.url;
    if (!url.startsWith('/api/') && !url.startsWith('http')) {
      return originalFetch.apply(this, arguments);
    }

    // 只拦截写操作 (POST/PUT/DELETE/PATCH)
    const method = (init && init.method) || 'GET';
    const isWrite = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(
      method.toUpperCase(),
    );

    if (!navigator.onLine && isWrite) {
      console.log(`[FetchInterceptor] 离线，请求入队: ${method} ${url}`);
      const entryId = await queue.enqueue({
        url,
        method: method.toUpperCase(),
        headers: init?.headers || {},
        body: init?.body,
      });
      return new Response(
        JSON.stringify({
          queued: true,
          entryId,
          message: '请求已入队，将在网络恢复后发送',
        }),
        {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    return originalFetch.apply(this, arguments);
  };
}

// ==================== 冲突解决策略 ====================

/**
 * 冲突解决器
 * 处理离线修改与服务端数据的冲突
 */
class ConflictResolver {
  /**
   * 策略: 最后写入获胜 (Last Write Wins)
   * 以时间戳最新的版本为准
   */
  static lastWriteWins(local, remote) {
    return local.updatedAt > remote.updatedAt ? local : remote;
  }

  /**
   * 策略: 本地优先
   * 离线修改始终保留
   */
  static localWins(local, remote) {
    return local;
  }

  /**
   * 策略: 远程优先
   * 服务端数据始终覆盖本地
   */
  static remoteWins(local, remote) {
    return remote;
  }

  /**
   * 策略: 合并字段
   * 只合并未被修改的字段
   */
  static fieldMerge(local, remote, mergeFields) {
    const merged = { ...remote };

    for (const field of mergeFields) {
      // 如果本地修改过，使用本地值
      if (local[field] !== undefined && local.updatedAt > remote.updatedAt) {
        merged[field] = local[field];
      }
    }

    merged.updatedAt = Math.max(local.updatedAt, remote.updatedAt);
    return merged;
  }
}

// ==================== 导出 ====================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    OfflineQueue,
    setupFetchInterceptor,
    ConflictResolver,
  };
}
