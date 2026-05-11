/**
 * EventEmitter - 发布订阅模式
 * TDD 实战模块 1/3
 * 支持：on/off/once/emit/offAll、中间件、错误处理、事件计数
 */

export class EventEmitter {
  constructor(options = {}) {
    this._listeners = new Map();
    this._onceListeners = new Map();
    this._middlewares = [];
    this._errorHandler = options.errorHandler || null;
    this._maxListeners = options.maxListeners || 10;
    this._eventCounts = new Map();
  }

  /**
   * 注册监听器
   * @param {string} event - 事件名
   * @param {Function} handler - 处理函数
   * @returns {Function} 取消订阅函数
   */
  on(event, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('Handler must be a function');
    }

    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }

    const listeners = this._listeners.get(event);
    if (listeners.length >= this._maxListeners) {
      console.warn(`Possible memory leak: ${this._maxListeners} listeners on "${event}"`);
    }

    listeners.push(handler);

    // 返回取消订阅函数
    return () => this.off(event, handler);
  }

  /**
   * 注册一次性监听器
   * @param {string} event - 事件名
   * @param {Function} handler - 处理函数
   * @returns {Function} 取消订阅函数
   */
  once(event, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('Handler must be a function');
    }

    if (!this._onceListeners.has(event)) {
      this._onceListeners.set(event, []);
    }

    this._onceListeners.get(event).push(handler);

    return () => this.off(event, handler);
  }

  /**
   * 取消监听
   * @param {string} event - 事件名
   * @param {Function} [handler] - 指定处理函数，不传则移除所有
   */
  off(event, handler) {
    if (handler) {
      const listeners = this._listeners.get(event);
      if (listeners) {
        const idx = listeners.indexOf(handler);
        if (idx !== -1) listeners.splice(idx, 1);
      }
      const onceListeners = this._onceListeners.get(event);
      if (onceListeners) {
        const idx = onceListeners.indexOf(handler);
        if (idx !== -1) onceListeners.splice(idx, 1);
      }
    } else {
      this._listeners.delete(event);
      this._onceListeners.delete(event);
    }
  }

  /**
   * 触发事件
   * @param {string} event - 事件名
   * @param {...*} args - 传递给处理函数的参数
   * @returns {Array} 所有处理函数的返回值
   */
  emit(event, ...args) {
    // 执行中间件
    const middlewareResult = this._runMiddlewares(event, args);
    if (middlewareResult === false) {
      return [];
    }

    const results = [];

    // 执行普通监听器
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const handler of [...listeners]) {
        try {
          results.push(handler(...args));
        } catch (err) {
          if (this._errorHandler) {
            this._errorHandler(err, event);
          } else {
            throw err;
          }
        }
      }
    }

    // 执行一次性监听器（执行后清除）
    const onceListeners = this._onceListeners.get(event);
    if (onceListeners) {
      for (const handler of [...onceListeners]) {
        try {
          results.push(handler(...args));
        } catch (err) {
          if (this._errorHandler) {
            this._errorHandler(err, event);
          } else {
            throw err;
          }
        }
      }
      this._onceListeners.delete(event);
    }

    // 记录事件计数
    this._eventCounts.set(event, (this._eventCounts.get(event) || 0) + 1);

    return results;
  }

  /**
   * 添加中间件
   * @param {Function} middleware - (event, args) => void | false
   */
  use(middleware) {
    if (typeof middleware !== 'function') {
      throw new TypeError('Middleware must be a function');
    }
    this._middlewares.push(middleware);
  }

  /**
   * 运行中间件
   * @private
   */
  _runMiddlewares(event, args) {
    for (const middleware of this._middlewares) {
      const result = middleware(event, args);
      if (result === false) return false;
    }
    return true;
  }

  /**
   * 获取某事件的监听器数量
   * @param {string} event
   * @returns {number}
   */
  listenerCount(event) {
    const normal = (this._listeners.get(event) || []).length;
    const once = (this._onceListeners.get(event) || []).length;
    return normal + once;
  }

  /**
   * 获取事件触发次数
   * @param {string} event
   * @returns {number}
   */
  getEventCount(event) {
    return this._eventCounts.get(event) || 0;
  }

  /**
   * 获取所有事件名
   * @returns {string[]}
   */
  eventNames() {
    const names = new Set([
      ...this._listeners.keys(),
      ...this._onceListeners.keys(),
      ...this._eventCounts.keys(),
    ]);
    return [...names];
  }

  /**
   * 移除所有监听器
   */
  removeAllListeners(event) {
    if (event) {
      this._listeners.delete(event);
      this._onceListeners.delete(event);
    } else {
      this._listeners.clear();
      this._onceListeners.clear();
    }
  }

  /**
   * 获取所有监听器
   * @param {string} event
   * @returns {Function[]}
   */
  listeners(event) {
    return [
      ...(this._listeners.get(event) || []),
      ...(this._onceListeners.get(event) || []),
    ];
  }
}
