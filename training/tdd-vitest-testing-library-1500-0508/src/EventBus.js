/**
 * EventBus — 事件总线（支持通配符订阅、优先级、一次性订阅、中间件）
 * TDD 实战模块 1/3
 *
 * 特性：
 * - 通配符订阅（"user.*" 匹配 "user.created"）
 * - 事件优先级（高优先级监听器先执行）
 * - 一次性订阅（once）
 * - 中间件链（before/after）
 * - 事件取消（stopPropagation）
 * - 错误隔离（单个监听器错误不影响其他）
 */

export class EventBus {
  constructor(options = {}) {
    this.listeners = new Map();
    this.beforeMiddlewares = [];
    this.afterMiddlewares = [];
    this.errorHandler = options.errorHandler || null;
    this._eventHistory = []; // 事件历史（用于调试）
  }

  /**
   * 订阅事件
   * @param {string} event - 事件名（支持通配符 *）
   * @param {Function} handler - 处理函数
   * @param {Object} options - 订阅选项
   * @param {number} options.priority - 优先级（数值越小越先执行，默认 0）
   * @param {boolean} options.once - 是否只执行一次
   * @returns {Function} 取消订阅函数
   */
  on(event, handler, options = {}) {
    if (typeof handler !== 'function') {
      throw new TypeError('handler must be a function');
    }

    const { priority = 0, once = false } = options;

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const subscription = { handler, priority, once, active: true };
    const handlers = this.listeners.get(event);
    handlers.push(subscription);
    // 按优先级排序（越小越先）
    handlers.sort((a, b) => a.priority - b.priority);

    // 返回取消订阅函数
    return () => {
      subscription.active = false;
      const idx = handlers.indexOf(subscription);
      if (idx > -1) handlers.splice(idx, 1);
    };
  }

  /**
   * 一次性订阅
   */
  once(event, handler, options = {}) {
    return this.on(event, handler, { ...options, once: true });
  }

  /**
   * 取消订阅
   */
  off(event, handler) {
    if (!handler) {
      this.listeners.delete(event);
      return;
    }
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (let i = handlers.length - 1; i >= 0; i--) {
      if (handlers[i].handler === handler) {
        handlers.splice(i, 1);
      }
    }
  }

  /**
   * 注册前置中间件
   */
  before(middleware) {
    if (typeof middleware !== 'function') {
      throw new TypeError('middleware must be a function');
    }
    this.beforeMiddlewares.push(middleware);
  }

  /**
   * 注册后置中间件
   */
  after(middleware) {
    if (typeof middleware !== 'function') {
      throw new TypeError('middleware must be a function');
    }
    this.afterMiddlewares.push(middleware);
  }

  /**
   * 匹配通配符
   */
  _matchListeners(event) {
    const matched = [];
    for (const [pattern, handlers] of this.listeners) {
      if (pattern === event) {
        matched.push(...handlers.filter((h) => h.active));
      } else if (pattern.includes('*')) {
        // 通配符匹配：user.* 匹配 user.created
        const regex = new RegExp('^' + pattern.replace(/\*/g, '[^.]+') + '$');
        if (regex.test(event)) {
          matched.push(...handlers.filter((h) => h.active));
        }
      }
    }
    // 去重（同一 handler 可能被多个模式匹配）
    const seen = new Set();
    return matched.filter((h) => {
      if (seen.has(h)) return false;
      seen.add(h);
      return true;
    }).sort((a, b) => a.priority - b.priority);
  }

  /**
   * 触发事件
   */
  emit(event, data) {
    // 记录历史
    this._eventHistory.push({ event, data, timestamp: Date.now() });

    // 前置中间件
    let context = { event, data, cancelled: false };
    for (const mw of this.beforeMiddlewares) {
      try {
        const result = mw(context);
        if (result === false) {
          context.cancelled = true;
          break;
        }
        if (result && typeof result === 'object') {
          context = { ...context, ...result };
        }
      } catch (err) {
        if (this.errorHandler) this.errorHandler(err, { event, phase: 'before' });
      }
    }

    if (context.cancelled) return false;

    // 获取匹配的监听器
    const handlers = this._matchListeners(event);

    // 执行监听器
    for (const sub of handlers) {
      try {
        const result = sub.handler(context.data, { event, cancel: () => { context.cancelled = true; } });
        if (result === false) {
          context.cancelled = true;
        }
      } catch (err) {
        if (this.errorHandler) this.errorHandler(err, { event, handler: sub.handler });
      }

      if (context.cancelled) break;
    }

    // 清理 once 订阅
    for (const [pattern, subs] of this.listeners) {
      for (let i = subs.length - 1; i >= 0; i--) {
        if (subs[i].once && subs[i].active) {
          const regex = pattern.includes('*')
            ? new RegExp('^' + pattern.replace(/\*/g, '[^.]+') + '$')
            : null;
          if (pattern === event || (regex && regex.test(event))) {
            subs.splice(i, 1);
          }
        }
      }
    }

    // 后置中间件
    for (const mw of this.afterMiddlewares) {
      try {
        mw(context);
      } catch (err) {
        if (this.errorHandler) this.errorHandler(err, { event, phase: 'after' });
      }
    }

    return !context.cancelled;
  }

  /**
   * 获取事件历史
   */
  getHistory(event) {
    if (event) return this._eventHistory.filter((e) => e.event === event);
    return [...this._eventHistory];
  }

  /**
   * 清除所有监听器和历史
   */
  clear() {
    this.listeners.clear();
    this.beforeMiddlewares = [];
    this.afterMiddlewares = [];
    this._eventHistory = [];
  }

  /**
   * 获取监听器数量
   */
  listenerCount(event) {
    if (event) {
      const handlers = this.listeners.get(event);
      return handlers ? handlers.filter((h) => h.active).length : 0;
    }
    let count = 0;
    for (const handlers of this.listeners.values()) {
      count += handlers.filter((h) => h.active).length;
    }
    return count;
  }
}

/**
 * 便捷工厂函数
 */
export function createEventBus(options) {
  return new EventBus(options);
}
