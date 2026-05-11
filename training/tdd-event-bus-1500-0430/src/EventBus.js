/**
 * EventBus — 事件总线 (TDD 驱动开发)
 *
 * TDD 红绿黄循环：
 *   🔴 Red   → 先写失败的测试
 *   🟢 Green → 写刚好通过测试的代码
 *   🔵 Refactor → 优化代码，保持测试通过
 *
 * 功能清单 (按测试顺序实现):
 *   1. 基础事件订阅与触发
 *   2. 一次订阅 (once)
 *   3. 取消订阅 (off)
 *   4. 多参数传递
 *   5. 返回值收集
 *   6. 错误隔离 (一个监听器报错不影响其他)
 *   7. 命名空间支持
 *   8. 通配符订阅
 *   9. 事件计数 (listenerCount)
 *   10. 移除所有监听器 (removeAllListeners)
 *   11. 事件是否存在 (hasListeners)
 *   12. 异步事件支持
 *   13. 优先级排序
 *   14. 链式调用
 *   15. 内存泄漏检测
 */

export class EventBus {
  constructor() {
    this._listeners = new Map();
    this._wildcardListeners = new Map();
    this._onceListeners = new Set();
    this._priorities = new Map();
    this._eventHistory = [];
    this._maxListeners = 10;
  }

  /**
   * 订阅事件
   * @param {string} event - 事件名，支持命名空间 "ns:event" 和通配符 "ns:*"
   * @param {Function} handler - 处理函数
   * @param {Object} options - 选项 { priority: number }
   * @returns {Function} 取消订阅函数
   */
  on(event, handler, options = {}) {
    if (typeof handler !== 'function') {
      throw new TypeError('Handler must be a function');
    }

    const priority = options.priority ?? 0;

    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }

    const listeners = this._listeners.get(event);

    // 检查是否超出最大监听器数量
    if (listeners.length >= this._maxListeners) {
      const warning = new Error(
        `Possible memory leak detected: ${listeners.length + 1} listeners added for "${event}". `
        + 'Use setMaxListeners() to increase limit.',
      );
      warning.name = 'MaxListenersExceededWarning';
      console.warn(warning.message);
    }

    // 按优先级插入 (优先级高的在前)
    let insertIndex = listeners.findIndex((l) => l.priority < priority);
    if (insertIndex === -1) insertIndex = listeners.length;

    const listener = { handler, priority, event };
    listeners.splice(insertIndex, 0, listener);

    // 返回取消订阅函数
    const off = () => this.off(event, handler);
    listener.off = off;

    return off;
  }

  /**
   * 一次性订阅
   */
  once(event, handler, options = {}) {
    if (typeof handler !== 'function') {
      throw new TypeError('Handler must be a function');
    }

    const priority = options.priority ?? 0;
    const onceHandler = (...args) => {
      this.off(event, onceHandler);
      this._onceListeners.delete(onceHandler);
      return handler(...args);
    };

    onceHandler._originalHandler = handler;
    this._onceListeners.add(onceHandler);

    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }

    const listeners = this._listeners.get(event);
    let insertIndex = listeners.findIndex((l) => l.priority < priority);
    if (insertIndex === -1) insertIndex = listeners.length;

    const listener = {
      handler: onceHandler, priority, event, isOnce: true,
    };
    listeners.splice(insertIndex, 0, listener);

    const off = () => {
      this.off(event, onceHandler);
      this._onceListeners.delete(onceHandler);
    };

    return off;
  }

  /**
   * 取消订阅
   */
  off(event, handler) {
    if (!this._listeners.has(event)) return;

    const listeners = this._listeners.get(event);
    const index = listeners.findIndex((l) => l.handler === handler || l.handler._originalHandler === handler);

    if (index !== -1) {
      const removed = listeners.splice(index, 1)[0];
      if (removed.isOnce) {
        this._onceListeners.delete(removed.handler);
      }
    }
  }

  /**
   * 触发事件 (同步)
   */
  emit(event, ...args) {
    const results = [];
    const listeners = this._listeners.get(event) || [];

    // 记录事件历史
    this._eventHistory.push({ event, args: [...args], timestamp: Date.now() });

    for (const listener of [...listeners]) {
      try {
        const result = listener.handler(...args);
        results.push(result);
      } catch (err) {
        results.push({ error: err });
        this.emit('error', err, event);
      }
    }

    // 处理通配符匹配
    this._emitWildcard(event, ...args, results);

    return results;
  }

  /**
   * 触发事件 (异步)
   */
  async emitAsync(event, ...args) {
    const listeners = this._listeners.get(event) || [];
    const promises = [];

    this._eventHistory.push({
      event, args: [...args], timestamp: Date.now(), async: true,
    });

    for (const listener of [...listeners]) {
      try {
        const result = listener.handler(...args);
        promises.push(Promise.resolve(result));
      } catch (err) {
        promises.push(Promise.reject(err));
      }
    }

    const results = await Promise.allSettled(promises);
    return results.map((r) => (r.status === 'fulfilled' ? r.value : { error: r.reason }));
  }

  /**
   * 获取监听器数量
   */
  listenerCount(event) {
    return this._listeners.get(event)?.length ?? 0;
  }

  /**
   * 检查是否有监听器
   */
  hasListeners(event) {
    return this.listenerCount(event) > 0;
  }

  /**
   * 移除所有监听器
   */
  removeAllListeners(event) {
    if (event) {
      const listeners = this._listeners.get(event) || [];
      for (const listener of listeners) {
        if (listener.isOnce) {
          this._onceListeners.delete(listener.handler);
        }
      }
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
      this._onceListeners.clear();
      this._wildcardListeners.clear();
    }
  }

  /**
   * 设置最大监听器数量
   */
  setMaxListeners(n) {
    if (typeof n !== 'number' || n < 0) {
      throw new TypeError('Max listeners must be a non-negative number');
    }
    this._maxListeners = n;
  }

  /**
   * 获取事件历史
   */
  getHistory(event) {
    if (event) {
      return this._eventHistory.filter((h) => h.event === event);
    }
    return [...this._eventHistory];
  }

  /**
   * 清除事件历史
   */
  clearHistory() {
    this._eventHistory = [];
  }

  /**
   * 通配符事件触发
   */
  _emitWildcard(event, ...args) {
    const parts = event.split(':');
    const wildcardKey = `${parts[0]}:*`;

    const wildcardListeners = this._listeners.get(wildcardKey) || [];
    for (const listener of [...wildcardListeners]) {
      try {
        listener.handler(event, ...args);
      } catch (err) {
        this.emit('error', err, event);
      }
    }
  }

  /**
   * 销毁事件总线
   */
  destroy() {
    this.removeAllListeners();
    this._eventHistory = [];
    this._priorities.clear();
  }
}

export default EventBus;
