/**
 * 基于原生 Fetch 的网络层
 *
 * 特性：
 * - 拦截器系统
 * - 超时控制
 * - 重试机制
 * - 取消请求（AbortController）
 * - 统一错误处理
 */

// ============ 错误类 ============

class NetworkError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'NetworkError';
    this.originalError = originalError;
  }
}

class TimeoutError extends Error {
  constructor(url) {
    super(`Request timeout: ${url}`);
    this.name = 'TimeoutError';
  }
}

class BusinessError extends Error {
  constructor(code, message, data) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.data = data;
  }
}

// ============ 拦截器管理器 ============

class InterceptorManager {
  constructor() {
    this.handlers = [];
  }

  use(onFulfilled, onRejected) {
    this.handlers.push({ onFulfilled, onRejected });
    // 返回移除函数
    return () => {
      const index = this.handlers.length - 1;
      this.handlers[index] = null;
    };
  }

  eject(index) {
    if (this.handlers[index]) {
      this.handlers[index] = null;
    }
  }

  clear() {
    this.handlers = [];
  }
}

// ============ Fetch 客户端 ============

class FetchClient {
  constructor(baseURL = '') {
    this.baseURL = baseURL;
    this.interceptors = {
      request: new InterceptorManager(),
      response: new InterceptorManager(),
    };
    this.defaults = {
      timeout: 15000,
      headers: {},
      maxRetries: 0,
      retryDelay: 1000,
    };
  }

  /**
   * 核心请求方法
   */
  async request(config) {
    const mergedConfig = { ...this.defaults, ...config };
    const url = this.resolveURL(mergedConfig.url);

    // 请求拦截器
    let requestConfig = { ...mergedConfig, url };
    for (const handler of this.interceptors.request.handlers) {
      if (handler?.onFulfilled) {
        requestConfig = await handler.onFulfilled(requestConfig);
      }
    }

    // 重试逻辑
    let lastError;
    const maxRetries = mergedConfig.maxRetries ?? this.defaults.maxRetries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Fetch 请求
        const response = await this.fetch(requestConfig);

        // 响应拦截器
        let responsePromise = Promise.resolve(response);
        for (const handler of this.interceptors.response.handlers) {
          if (handler?.onFulfilled) {
            responsePromise = responsePromise.then(handler.onFulfilled);
          }
        }
        for (const handler of this.interceptors.response.handlers) {
          if (handler?.onRejected) {
            responsePromise = responsePromise.catch(handler.onRejected);
          }
        }

        const result = await responsePromise;

        // 解包业务数据
        if (mergedConfig.unwrap !== false) {
          const data = await result.json();
          if (data && typeof data.code === 'number') {
            if (data.code === 0) return data.data;
            throw new BusinessError(data.code, data.message, data);
          }
          return data;
        }
        return result;
      } catch (error) {
        lastError = error;

        // 取消请求不重试
        if (error.name === 'CancelledError') throw error;

        // 业务错误不重试
        if (error instanceof BusinessError) throw error;

        if (attempt < maxRetries) {
          const delay = mergedConfig.retryDelay * 2 ** attempt;
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * 实际 Fetch 请求
   */
  async fetch(config) {
    const {
      url,
      method = 'GET',
      headers = {},
      body,
      timeout = 15000,
      signal,
      ...rest
    } = config;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    // 合并 signal
    const combinedSignal = signal
      ? this.combineSignals(signal, controller.signal)
      : controller.signal;

    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      signal: combinedSignal,
      ...rest,
    };

    if (body && method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD') {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    try {
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new TimeoutError(url);
      }
      throw new NetworkError(error.message, error);
    }
  }

  /**
   * 合并多个 AbortSignal
   */
  combineSignals(...signals) {
    const controller = new AbortController();
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        return controller.signal;
      }
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    return controller.signal;
  }

  /**
   * HTTP 方法
   */
  get(url, config) {
    return this.request({ ...config, url, method: 'GET' });
  }

  post(url, data, config) {
    return this.request({
      ...config, url, method: 'POST', body: data,
    });
  }

  put(url, data, config) {
    return this.request({
      ...config, url, method: 'PUT', body: data,
    });
  }

  patch(url, data, config) {
    return this.request({
      ...config, url, method: 'PATCH', body: data,
    });
  }

  delete(url, config) {
    return this.request({ ...config, url, method: 'DELETE' });
  }

  /**
   * 解析 URL
   */
  resolveURL(url) {
    if (url.startsWith('http')) return url;
    return this.baseURL + (this.baseURL.endsWith('/') ? '' : '/') + url;
  }

  /**
   * 工具方法
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============ 使用示例 ============

/*
const client = new FetchClient('/api');

// 请求拦截器
client.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-Request-ID'] = `req_${Date.now()}`;
  console.log(`[Fetch] ${config.method} ${config.url}`);
  return config;
});

// 响应拦截器
client.interceptors.response.use(
  async (response) => {
    console.log(`[Fetch Response] ${response.status}`);
    return response;
  },
  (error) => {
    console.error('[Fetch Error]', error);
    return Promise.reject(error);
  }
);

// 取消请求
const controller = new AbortController();
client.get('/users', { signal: controller.signal });
// 取消：controller.abort();

// 重试
client.get('/users', { maxRetries: 3, retryDelay: 1000 });
*/

// ============ 导出 ============

export {
  FetchClient, InterceptorManager, BusinessError, NetworkError, TimeoutError,
};
export default FetchClient;
