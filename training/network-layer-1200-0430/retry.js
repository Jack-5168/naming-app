/**
 * 重试机制
 *
 * 特性：
 * - 指数退避
 * - 随机抖动（防止雪崩）
 * - 智能重试判断（仅对可重试错误重试）
 * - 自定义重试条件
 */

import http from './network';

// ============ 重试判断 ============

/**
 * 默认重试判断：仅对特定错误重试
 */
function defaultShouldRetry(error) {
  // 取消请求不重试
  if (error.name === 'Cancel' || error.message?.includes('cancelled')) {
    return false;
  }

  // 业务错误不重试
  if (error.name === 'BusinessError') {
    return false;
  }

  // 4xx 客户端错误不重试（429 限流除外）
  if (error.response && error.response.status >= 400 && error.response.status < 500) {
    return error.response.status === 429;
  }

  // 5xx 服务器错误重试
  if (error.response && error.response.status >= 500) {
    return true;
  }

  // 网络错误重试
  if (!error.response) {
    return true;
  }

  // 超时重试
  if (error.code === 'ECONNABORTED') {
    return true;
  }

  return false;
}

// ============ 核心重试函数 ============

/**
 * 带重试的请求封装
 *
 * @param {Function} requestFn - 返回 Promise 的请求函数
 * @param {Object} options
 * @param {number} options.maxRetries - 最大重试次数（默认 3）
 * @param {number} options.delay - 基础延迟 ms（默认 1000）
 * @param {boolean} options.exponentialBackoff - 是否指数退避（默认 true）
 * @param {number} options.maxDelay - 最大延迟 ms（默认 30000）
 * @param {Function} options.shouldRetry - 自定义重试判断函数
 * @param {Function} options.onRetry - 重试回调 (retryCount, error, delay)
 * @returns {Promise}
 */
function withRetry(requestFn, options = {}) {
  const {
    maxRetries = 3,
    delay = 1000,
    exponentialBackoff = true,
    maxDelay = 30000,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;

  let attempt = 0;

  async function execute() {
    try {
      return await requestFn();
    } catch (error) {
      attempt++;

      // 判断是否应该重试
      const shouldRetryResult = shouldRetry(error);

      if (attempt > maxRetries || !shouldRetryResult) {
        if (!shouldRetryResult) {
          console.log(
            `[Retry] Attempt ${attempt} failed, but error is not retryable. Giving up.`,
          );
        } else {
          console.log(
            `[Retry] Attempt ${attempt}/${maxRetries} failed. Max retries reached.`,
          );
        }
        throw error;
      }

      // 计算延迟（指数退避 + 随机抖动）
      let waitTime = exponentialBackoff
        ? Math.min(delay * 2 ** (attempt - 1), maxDelay)
        : delay;

      // 添加 jitter 防止雪崩
      waitTime += Math.random() * 1000;

      console.warn(
        `[Retry] Attempt ${attempt}/${maxRetries} failed. `
        + `Retrying in ${Math.round(waitTime)}ms. Error: ${error.message}`,
      );

      if (onRetry) {
        onRetry(attempt, error, waitTime);
      }

      await sleep(waitTime);
      return execute();
    }
  }

  return execute();
}

// ============ 便捷方法 ============

function get(url, config, retryOptions) {
  return withRetry(() => http.get(url, config), retryOptions);
}

function post(url, data, config, retryOptions) {
  return withRetry(() => http.post(url, data, config), retryOptions);
}

function put(url, data, config, retryOptions) {
  return withRetry(() => http.put(url, data, config), retryOptions);
}

function patch(url, data, config, retryOptions) {
  return withRetry(() => http.patch(url, data, config), retryOptions);
}

function del(url, config, retryOptions) {
  return withRetry(() => http.delete(url, config), retryOptions);
}

// ============ 工具函数 ============

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============ 导出 ============

export {
  withRetry, get, post, put, patch, del, defaultShouldRetry,
};
export default withRetry;
