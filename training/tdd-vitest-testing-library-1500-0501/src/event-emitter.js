// src/event-emitter.js
/**
 * EventEmitter - 发布订阅模式实现
 * 支持 on/off/once/emit/offAll 等方法
 */
export class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  /**
   * 监听事件
   * @param {string} event - 事件名
   * @param {Function} listener - 回调函数
   * @param {object} [options] - 配置项
   * @param {object} [options.context] - 回调执行上下文
   * @returns {Function} 取消监听函数
   */
  on(event, listener, options = {}) {
    if (typeof listener !== 'function') {
      throw new TypeError('Listener must be a function');
    }

    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }

    const entry = {
      listener, context: options.context || null, once: false,
    };
    this._listeners.get(event).push(entry);

    // 返回取消监听函数
    return () => this.off(event, listener);
  }

  /**
   * 监听事件（只触发一次）
   */
  once(event, listener, options = {}) {
    if (typeof listener !== 'function') {
      throw new TypeError('Listener must be a function');
    }

    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }

    const entry = {
      listener, context: options.context || null, once: true,
    };
    this._listeners.get(event).push(entry);

    return () => this.off(event, listener);
  }

  /**
   * 取消监听
   */
  off(event, listener) {
    if (!this._listeners.has(event)) return;

    const listeners = this._listeners.get(event);
    const index = listeners.findIndex((entry) => entry.listener === listener);

    if (index !== -1) {
      listeners.splice(index, 1);
    }

    // 清理空数组
    if (listeners.length === 0) {
      this._listeners.delete(event);
    }
  }

  /**
   * 触发事件
   */
  emit(event, ...args) {
    if (!this._listeners.has(event)) return false;

    const listeners = this._listeners.get(event);
    const toRemove = [];

    listeners.forEach((entry, index) => {
      entry.listener.apply(entry.context, args);
      if (entry.once) {
        toRemove.push(index);
      }
    });

    // 移除 once 监听器（从后往前删避免索引变化）
    toRemove.reverse().forEach((idx) => {
      listeners.splice(idx, 1);
    });

    if (listeners.length === 0) {
      this._listeners.delete(event);
    }

    return true;
  }

  /**
   * 取消指定事件的所有监听
   */
  offAll(event) {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
  }

  /**
   * 获取指定事件的监听器数量
   */
  listenerCount(event) {
    if (!this._listeners.has(event)) return 0;
    return this._listeners.get(event).length;
  }

  /**
   * 获取所有事件名
   */
  eventNames() {
    return Array.from(this._listeners.keys());
  }

  /**
   * 获取所有监听器
   */
  listeners(event) {
    if (!this._listeners.has(event)) return [];
    return this._listeners.get(event).map((entry) => entry.listener);
  }
}
