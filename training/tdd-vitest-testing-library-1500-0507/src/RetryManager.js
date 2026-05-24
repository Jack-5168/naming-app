/**
 * RetryManager - 异步操作重试管理器
 * TDD 实战模块 1/3
 * 支持：指数退避、最大重试次数、自定义延迟、错误过滤、重试回调
 */

export class RetryManager {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.baseDelay = options.baseDelay ?? 1000;
    this.maxDelay = options.maxDelay ?? 30000;
    this.factor = options.factor ?? 2;
    this.shouldRetry = options.shouldRetry ?? (() => true);
    this.onRetry = options.onRetry ?? null;
    this.jitter = options.jitter ?? false;
  }

  /**
   * 计算延迟时间（指数退避 + 抖动）
   * @param {number} attempt - 当前重试次数（从 0 开始）
   * @returns {number} 延迟毫秒数
   */
  _calculateDelay(attempt) {
    let delay = this.baseDelay * this.factor ** attempt;
    delay = Math.min(delay, this.maxDelay);

    if (this.jitter) {
      delay = Math.floor(Math.random() * delay);
    }

    return delay;
  }

  /**
   * 等待指定时间
   * @param {number} ms
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 执行带重试的异步操作
   * @param {Function} fn - 异步操作函数
   * @returns {Promise<*>} 操作结果
   */
  async execute(fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('fn must be a function');
    }

    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await fn(attempt);
        return result;
      } catch (err) {
        lastError = err;

        // 最后一次尝试，直接抛出
        if (attempt >= this.maxRetries) {
          break;
        }

        // 检查是否应该重试
        if (!this.shouldRetry(err, attempt)) {
          break;
        }

        // 调用重试回调
        if (this.onRetry) {
          this.onRetry(err, attempt, this.maxRetries);
        }

        // 等待后重试
        const delay = this._calculateDelay(attempt);
        await this._sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * 获取配置信息
   * @returns {Object}
   */
  getConfig() {
    return {
      maxRetries: this.maxRetries,
      baseDelay: this.baseDelay,
      maxDelay: this.maxDelay,
      factor: this.factor,
      jitter: this.jitter,
    };
  }

  /**
   * 更新配置
   * @param {Object} options
   */
  configure(options = {}) {
    if (options.maxRetries !== undefined) this.maxRetries = options.maxRetries;
    if (options.baseDelay !== undefined) this.baseDelay = options.baseDelay;
    if (options.maxDelay !== undefined) this.maxDelay = options.maxDelay;
    if (options.factor !== undefined) this.factor = options.factor;
    if (options.jitter !== undefined) this.jitter = options.jitter;
    if (options.shouldRetry !== undefined) this.shouldRetry = options.shouldRetry;
    if (options.onRetry !== undefined) this.onRetry = options.onRetry;
  }
}

/**
 * 便捷函数：创建默认配置的 RetryManager
 * @param {Object} options
 * @returns {RetryManager}
 */
export function createRetryManager(options) {
  return new RetryManager(options);
}
