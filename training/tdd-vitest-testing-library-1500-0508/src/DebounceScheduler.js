/**
 * DebounceScheduler — 多任务防抖调度器
 * TDD 实战模块 1/3
 *
 * 特性：
 * - 多任务独立防抖（每个 key 独立计时）
 * - 优先级调度（高优先级任务可打断低优先级）
 * - 立即执行模式（leading）
 * - 批量执行（flush）
 * - 任务取消（cancel）
 * - 状态查询（pending/count）
 */

export class DebounceScheduler {
  constructor(defaultDelay = 100, options = {}) {
    this.defaultDelay = defaultDelay;
    this.maxConcurrent = options.maxConcurrent ?? Infinity;
    this.onError = options.onError ?? null;
    this.timers = new Map();
    this.tasks = new Map();
    this.running = new Set();
  }

  /**
   * 调度一个防抖任务
   * @param {string} key - 任务标识
   * @param {Function} fn - 要执行的函数
   * @param {Object} options - 调度选项
   * @param {number} options.delay - 延迟时间（默认使用构造函数的 defaultDelay）
   * @param {number} options.priority - 优先级（数值越小越优先，默认 0）
   * @param {boolean} options.leading - 是否立即执行第一次
   * @param {boolean} options.trailing - 是否在延迟后执行（默认 true）
   * @returns {Function} 取消函数
   */
  schedule(key, fn, options = {}) {
    if (typeof fn !== 'function') {
      throw new TypeError('fn must be a function');
    }

    const {
      delay = this.defaultDelay,
      priority = 0,
      leading = false,
      trailing = true,
    } = options;

    // 如果已有相同 key 的任务，先取消
    this.cancel(key);

    const task = { fn, priority, delay, leading, trailing, key };

    // leading 模式：立即执行
    if (leading) {
      this._execute(task);
    }

    // trailing 模式：设置定时器
    if (trailing) {
      const timer = setTimeout(() => {
        this.timers.delete(key);
        this.tasks.delete(key);
        try {
          fn();
        } catch (err) {
          if (this.onError) this.onError(err, { key });
        }
      }, delay);
      this.timers.set(key, timer);
      this.tasks.set(key, task);
    }

    // 返回取消函数
    return () => this.cancel(key);
  }

  /**
   * 执行任务（leading 模式）
   */
  _execute(task) {
    try {
      task.fn();
    } catch (err) {
      if (this.onError) this.onError(err, { key: task.key });
    }
  }

  /**
   * 取消指定任务
   */
  cancel(key) {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
    this.tasks.delete(key);
  }

  /**
   * 立即执行所有 pending 任务
   */
  flush() {
    const pending = [...this.tasks.values()];
    // 按优先级排序
    pending.sort((a, b) => a.priority - b.priority);

    for (const task of pending) {
      this.cancel(task.key);
      try {
        task.fn();
      } catch (err) {
        if (this.onError) this.onError(err, { key: task.key });
      }
    }
  }

  /**
   * 取消所有任务
   */
  cancelAll() {
    for (const key of this.timers.keys()) {
      this.cancel(key);
    }
  }

  /**
   * 检查是否有 pending 任务
   */
  isPending(key) {
    return this.timers.has(key);
  }

  /**
   * 获取 pending 任务数量
   */
  get pendingCount() {
    return this.timers.size;
  }

  /**
   * 获取所有任务 keys
   */
  get keys() {
    return [...this.tasks.keys()];
  }
}

/**
 * 便捷工厂函数
 */
export function createScheduler(defaultDelay, options) {
  return new DebounceScheduler(defaultDelay, options);
}
