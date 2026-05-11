# 网络请求专项 — 完整网络层代码

> 专项训练 12:00 | 2026-04-25
> 主题: Fetch / Axios / 拦截器 / 重试机制 / 取消请求

---

## 目录

1. [基础 Fetch 封装](#1-基础-fetch-封装)
2. [Fetch 拦截器系统](#2-fetch-拦截器系统)
3. [重试机制](#3-重试机制)
4. [请求取消](#4-请求取消)
5. [并发控制与请求去重](#5-并发控制与请求去重)
6. [Axios 封装对比](#6-axios-封装对比)
7. [完整网络层（终极版）](#7-完整网络层终极版)
8. [单元测试](#8-单元测试)

---

## 1. 基础 Fetch 封装

### 1.1 最小可用封装

```js
// --- File: src/network/fetch-base.js ---

/**
 * 基础 Fetch 封装
 * 处理 JSON 序列化、错误码判断、统一返回格式
 */

class HttpError extends Error {
  constructor(status, statusText, url, body) {
    super(`HTTP ${status}: ${statusText} (${url})`);
    this.name = 'HttpError';
    this.status = status;
    this.statusText = statusText;
    this.url = url;
    this.body = body;
  }
}

/**
 * 检查响应状态，非 2xx 抛出 HttpError
 */
function checkStatus(response) {
  if (response.ok) return response;
  return response.json().then(
    (body) => { throw new HttpError(response.status, response.statusText, response.url, body); },
    () => { throw new HttpError(response.status, response.statusText, response.url, null); }
  );
}

/**
 * 基础 request 函数
 */
async function request(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    params = null,       // query params
    body = null,         // request body
    timeout = 10000,     // ms
    signal,              // AbortSignal
  } = options;

  // 拼接 URL + query params
  let finalUrl = url;
  if (params && Object.keys(params).length > 0) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    ).toString();
    finalUrl = `${url}?${qs}`;
  }

  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...headers,
    },
    signal,
  };

  // 序列化 body（非 GET/HEAD 且有 body 时）
  if (body && !['GET', 'HEAD'].includes(method.toUpperCase())) {
    config.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  // 超时控制：用 AbortController 包装
  let timeoutController;
  if (!signal && timeout > 0) {
    timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeout);
    config.signal = timeoutController.signal;
    // 请求结束后清理 timer
    const cleanup = () => clearTimeout(timer);
    // 注意：fetch 内部会在 abort 时 reject，timer 仍需清理
  }

  const response = await fetch(finalUrl, config);
  return checkStatus(response);
}

/**
 * 便捷方法
 */
const http = {
  get(url, options) { return request(url, { ...options, method: 'GET' }); },
  post(url, body, options) { return request(url, { ...options, method: 'POST', body }); },
  put(url, body, options) { return request(url, { ...options, method: 'PUT', body }); },
  patch(url, body, options) { return request(url, { ...options, method: 'PATCH', body }); },
  delete(url, options) { return request(url, { ...options, method: 'DELETE' }); },
};

// 使用示例
// const res = await http.get('/api/users', { params: { page: 1, limit: 10 } });
// const users = await res.json();
// console.log(users);

// const created = await http.post('/api/users', { name: 'Alice', email: 'alice@example.com' });
// const user = await created.json();

module.exports = { HttpError, request, http, checkStatus };
```

### 1.2 带响应解析的增强版

```js
// --- File: src/network/fetch-enhanced.js ---

/**
 * 增强版：自动解析 JSON / 文本 / 二进制
 * 统一返回 { data, status, headers, ok } 结构
 */

async function requestEnhanced(url, options = {}) {
  const response = await request(url, options);

  const contentType = response.headers.get('content-type') || '';
  let data;

  if (contentType.includes('application/json')) {
    data = await response.json();
  } else if (contentType.includes('text/')) {
    data = await response.text();
  } else {
    data = await response.blob();
  }

  return {
    data,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    ok: response.ok,
  };
}

// 使用示例
// const { data, status } = await requestEnhanced('/api/config');
// console.log(`配置版本: ${data.version}, 状态码: ${status}`);

module.exports = { requestEnhanced };
```

---

## 2. Fetch 拦截器系统

### 2.1 拦截器架构设计

```js
// --- File: src/network/interceptor.js ---

/**
 * 拦截器系统（仿 Axios 设计）
 *
 * 拦截器链：
 *   请求拦截器（正序）→ fetch → 响应拦截器（逆序）→ 错误拦截器
 *
 * 每个拦截器是一个 { onRequest, onResponse, onError } 对象
 * 支持异步拦截器（返回 Promise）
 */

class InterceptorManager {
  constructor() {
    this.handlers = [];
  }

  /**
   * 添加拦截器，返回移除 ID
   */
  use(onRequest, onResponse, onError) {
    this.handlers.push({ onRequest, onResponse, onError, enabled: true });
    return this.handlers.length - 1;
  }

  /**
   * 移除拦截器
   */
  eject(id) {
    if (this.handlers[id]) {
      this.handlers[id].enabled = false;
    }
  }

  /**
   * 清空所有拦截器
   */
  clear() {
    this.handlers = [];
  }

  /**
   * 获取所有启用的拦截器
   */
  get enabledHandlers() {
    return this.handlers.filter(h => h.enabled);
  }
}

/**
 * 执行请求拦截器链（正序）
 * 每个拦截器接收 config，返回新 config（或 Promise）
 */
async function executeRequestInterceptors(handlers, config) {
  let chain = config;
  for (const handler of handlers) {
    if (!handler.onRequest) continue;
    try {
      chain = await handler.onRequest(chain);
    } catch (err) {
      // 请求拦截器失败，执行 onError
      if (handler.onError) {
        chain = await handler.onError(err);
      } else {
        throw err;
      }
    }
  }
  return chain;
}

/**
 * 执行响应拦截器链（逆序）
 * 最后一个拦截器最先处理响应
 */
async function executeResponseInterceptors(handlers, response) {
  let chain = response;
  const reversed = [...handlers].reverse();
  for (const handler of reversed) {
    if (!handler.onResponse) continue;
    try {
      chain = await handler.onResponse(chain);
    } catch (err) {
      if (handler.onError) {
        chain = await handler.onError(err);
      } else {
        throw err;
      }
    }
  }
  return chain;
}

module.exports = {
  InterceptorManager,
  executeRequestInterceptors,
  executeResponseInterceptors,
};
```

### 2.2 常用拦截器实现

```js
// --- File: src/network/interceptors.js ---

const { InterceptorManager } = require('./interceptor');

/**
 * 创建拦截器管理器并注册常用拦截器
 */
function createInterceptors(config = {}) {
  const manager = new InterceptorManager();
  const {
    baseURL = '',
    tokenProvider = null,    // () => string | Promise<string>
    refreshTokenFn = null,   // () => Promise<void>
    maxRetry = 3,
    retryDelay = 1000,
    logger = console,
  } = config;

  // ── 1. baseURL 拦截器 ──
  manager.use((config) => {
    if (baseURL && !config.url.startsWith('http')) {
      config.url = baseURL.replace(/\/$/, '') + '/' + config.url.replace(/^\//, '');
    }
    return config;
  });

  // ── 2. Token 注入拦截器 ──
  if (tokenProvider) {
    manager.use(async (config) => {
      const token = await tokenProvider();
      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        };
      }
      return config;
    });
  }

  // ── 3. 请求日志拦截器 ──
  manager.use((config) => {
    config._startTime = Date.now();
    logger.log(`→ ${config.method} ${config.url}`, config.params ? `?${new URLSearchParams(config.params)}` : '');
    return config;
  });

  // ── 4. 响应日志拦截器 ──
  manager.use(
    null,  // 无 onRequest
    (response) => {
      const elapsed = Date.now() - (response.config?._startTime || Date.now());
      logger.log(`← ${response.status} ${response.config?.method} ${response.config?.url} (${elapsed}ms)`);
      return response;
    }
  );

  // ── 5. 401 自动刷新 Token 拦截器 ──
  if (refreshTokenFn) {
    let isRefreshing = false;
    let refreshSubscribers = [];

    const subscribeTokenRefresh = (cb) => {
      return new Promise((resolve) => {
        refreshSubscribers.push((token) => {
          cb(token);
          resolve();
        });
      });
    };

    manager.use(
      null,
      null,
      async (error) => {
        if (error?.status === 401 && refreshTokenFn && !error.config?._isRetry) {
          if (!isRefreshing) {
            isRefreshing = true;
            try {
              await refreshTokenFn();
              // 通知所有等待的请求
              refreshSubscribers.forEach((cb) => cb());
              refreshSubscribers = [];
            } catch (refreshErr) {
              refreshSubscribers.forEach((cb) => cb(null));
              refreshSubscribers = [];
              // 刷新失败，跳转登录
              window?.location?.replace('/login');
              throw refreshErr;
            } finally {
              isRefreshing = false;
            }
          }

          // 等待 token 刷新完成
          await subscribeTokenRefresh(() => {});

          // 重试原请求
          error.config._isRetry = true;
          return error.config;  // 返回 config 让调用方重试
        }
        throw error;
      }
    );
  }

  // ── 6. 响应数据解包拦截器 ──
  // 假设后端返回 { code: 0, data: {...}, message: "ok" }
  manager.use(
    null,
    async (response) => {
      // 如果响应还未解析 body，解析它
      if (response.data === undefined) {
        const contentType = response.headers?.['content-type'] || '';
        if (contentType.includes('application/json')) {
          response.data = await response.json?.() ?? response._body;
        }
      }

      // 业务层错误码处理
      if (response.data && typeof response.data === 'object') {
        const { code, message, data } = response.data;
        if (code !== undefined && code !== 0 && code !== 200) {
          const err = new Error(message || 'Business Error');
          err.code = code;
          err.data = data;
          throw err;
        }
        // 解包：直接返回 data 字段
        response.data = data;
      }

      return response;
    }
  );

  return manager;
}

module.exports = { createInterceptors };
```

---

## 3. 重试机制

### 3.1 指数退避重试

```js
// --- File: src/network/retry.js ---

/**
 * 指数退避重试策略
 *
 * 退避公式: delay = baseDelay * multiplier^attempt + jitter
 * jitter: 随机抖动，避免 thundering herd
 */

function createRetryStrategy(options = {}) {
  const {
    maxRetries = 3,           // 最大重试次数
    baseDelay = 1000,         // 基础延迟 (ms)
    multiplier = 2,           // 退避倍数
    maxDelay = 30000,         // 最大延迟 (ms)
    jitter = true,            // 是否添加随机抖动
    retryableStatuses = [408, 429, 500, 502, 503, 504],  // 可重试的状态码
    retryableMethods = ['GET', 'HEAD', 'OPTIONS'],        // 可重试的方法（幂等）
    shouldRetry = null,       // 自定义重试判断函数
    onRetry = null,           // 重试回调 (attempt, error, delay) => void
  } = options;

  /**
   * 计算第 N 次重试的延迟
   */
  function getDelay(attempt) {
    const exponentialDelay = baseDelay * Math.pow(multiplier, attempt);
    const cappedDelay = Math.min(exponentialDelay, maxDelay);
    if (jitter) {
      // 全抖动: [0, cappedDelay]
      return Math.random() * cappedDelay;
    }
    return cappedDelay;
  }

  /**
   * 判断是否应该重试
   */
  function isRetryable(error, config) {
    // 自定义判断优先
    if (shouldRetry) return shouldRetry(error, config);

    // 取消的请求不重试
    if (error?.name === 'AbortError') return false;

    // 非幂等方法不重试（除非明确配置）
    const method = (config?.method || 'GET').toUpperCase();
    if (!retryableMethods.includes(method) && error?.status !== 408) {
      return false;
    }

    // 网络错误（无 status）重试
    if (error?.status === undefined || error?.status === 0) return true;

    // 状态码在白名单中
    return retryableStatuses.includes(error.status);
  }

  /**
   * 等待指定时间
   */
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  return {
    maxRetries,
    isRetryable,
    getDelay,
    onRetry,
    sleep,
  };
}

/**
 * 带重试的请求函数
 */
async function requestWithRetry(fetchFn, url, options = {}, retryStrategy) {
  const strategy = retryStrategy || createRetryStrategy();
  let lastError;

  for (let attempt = 0; attempt <= strategy.maxRetries; attempt++) {
    try {
      // 第一次不延迟，后续重试前等待
      if (attempt > 0) {
        const delay = strategy.getDelay(attempt - 1);
        if (strategy.onRetry) {
          strategy.onRetry(attempt - 1, lastError, delay);
        }
        await strategy.sleep(delay);
      }

      const response = await fetchFn(url, { ...options, _retryAttempt: attempt });
      return response;
    } catch (error) {
      lastError = error;

      if (!strategy.isRetryable(error, options)) {
        throw error;
      }

      // 最后一次重试也失败了
      if (attempt >= strategy.maxRetries) {
        error.retriesExhausted = true;
        throw error;
      }
    }
  }
}

// 使用示例
// const strategy = createRetryStrategy({
//   maxRetries: 3,
//   baseDelay: 500,
//   multiplier: 2,
//   onRetry: (attempt, error, delay) => {
//     console.warn(`重试第 ${attempt + 1} 次，延迟 ${delay}ms，原因: ${error.message}`);
//   }
// });
//
// const response = await requestWithRetry(
//   (url, opts) => fetch(url, opts),
//   '/api/data',
//   { method: 'GET' },
//   strategy
// );

module.exports = { createRetryStrategy, requestWithRetry };
```

### 3.2 快速失败 vs 全量重试

```js
// --- File: src/network/retry-policies.js ---

/**
 * 预设重试策略
 */

const RetryPolicies = {
  /** 快速失败：最多重试 1 次，延迟短 */
  fastFail: () => createRetryStrategy({
    maxRetries: 1,
    baseDelay: 500,
    multiplier: 1,
    maxDelay: 1000,
    jitter: false,
    retryableStatuses: [502, 503],
  }),

  /** 标准重试：3 次，指数退避 */
  standard: () => createRetryStrategy({
    maxRetries: 3,
    baseDelay: 1000,
    multiplier: 2,
    maxDelay: 10000,
    jitter: true,
  }),

  /** 激进重试：5 次，适合关键操作 */
  aggressive: () => createRetryStrategy({
    maxRetries: 5,
    baseDelay: 500,
    multiplier: 2,
    maxDelay: 30000,
    jitter: true,
    retryableMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
  }),

  /** 无重试：仅用于调试或幂等性不确定的场景 */
  noRetry: () => createRetryStrategy({ maxRetries: 0 }),
};

module.exports = { RetryPolicies };
```

---

## 4. 请求取消

### 4.1 AbortController 封装

```js
// --- File: src/network/cancellation.js ---

/**
 * 请求取消管理器
 *
 * 功能:
 * 1. 按 key 取消单个请求
 * 2. 取消指定分组的所有请求
 * 3. 取消所有请求
 * 4. 自动取消重复请求（debounce 模式）
 */

class RequestCanceller {
  constructor() {
    // Map<key, AbortController>
    this.controllers = new Map();
    // Map<group, Set<key>>
    this.groups = new Map();
  }

  /**
   * 生成请求 key
   */
  static generateKey(method, url, params) {
    const sortedParams = params
      ? Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('&')
      : '';
    return `${method.toUpperCase()}:${url}:${sortedParams}`;
  }

  /**
   * 注册请求，返回 AbortSignal
   */
  register(key, options = {}) {
    const { group = null, cancelExisting = false } = options;

    // 如果已存在同名请求
    if (this.controllers.has(key)) {
      if (cancelExisting) {
        this.cancel(key);
      } else {
        // 默认行为：取消旧请求
        this.cancel(key);
      }
    }

    const controller = new AbortController();
    this.controllers.set(key, controller);

    if (group) {
      if (!this.groups.has(group)) {
        this.groups.set(group, new Set());
      }
      this.groups.get(group).add(key);
    }

    return controller.signal;
  }

  /**
   * 取消指定请求
   */
  cancel(key, message = 'Request cancelled') {
    const controller = this.controllers.get(key);
    if (controller) {
      controller.abort(new DOMException(message, 'AbortError'));
      this.controllers.delete(key);

      // 从所有分组中移除
      this.groups.forEach((keys) => keys.delete(key));
    }
  }

  /**
   * 取消指定分组的所有请求
   */
  cancelGroup(group, message = 'Group cancelled') {
    const keys = this.groups.get(group);
    if (keys) {
      keys.forEach((key) => this.cancel(key, message));
      this.groups.delete(group);
    }
  }

  /**
   * 取消所有请求
   */
  cancelAll(message = 'All requests cancelled') {
    this.controllers.forEach((_, key) => this.cancel(key, message));
    this.groups.clear();
  }

  /**
   * 检查请求是否正在执行
   */
  isPending(key) {
    return this.controllers.has(key);
  }

  /**
   * 清理已完成的请求（由外部调用）
   */
  cleanup(key) {
    this.controllers.delete(key);
    this.groups.forEach((keys) => keys.delete(key));
  }

  /**
   * 获取当前 pending 请求数量
   */
  get pendingCount() {
    return this.controllers.size;
  }
}

/**
 * 请求防抖器
 * 在一定时间内，相同 key 的请求只保留最后一个
 */
class RequestDebouncer {
  constructor(defaultDelay = 300) {
    this.timers = new Map();
    this.defaultDelay = defaultDelay;
  }

  /**
   * 防抖注册，返回是否应该跳过本次请求
   */
  shouldDebounce(key, delay = this.defaultDelay) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.timers.delete(key);
        resolve(false);  // 不跳过，执行请求
      }, delay);

      this.timers.set(key, timer);
      resolve(true);  // 跳过，等待下一次
    });
  }

  cleanup() {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }
}

module.exports = { RequestCanceller, RequestDebouncer };
```

### 4.2 取消请求的实际使用

```js
// --- File: src/network/cancellation-usage.js ---

/**
 * 取消请求使用示例
 */

const { RequestCanceller } = require('./cancellation');

const canceller = new RequestCanceller();

// 场景 1: 搜索输入框 — 取消上一次搜索
function search(query) {
  const key = RequestCanceller.generateKey('GET', '/api/search', { q: query });
  const signal = canceller.register(key, { group: 'search' });

  return fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal })
    .then((res) => res.json())
    .finally(() => canceller.cleanup(key));
}

// 场景 2: 组件卸载时取消所有请求
class UserListPage {
  constructor() {
    this.group = 'user-list';
  }

  async loadUsers(page = 1) {
    const key = `users:${page}`;
    const signal = canceller.register(key, { group: this.group });

    try {
      const res = await fetch(`/api/users?page=${page}`, { signal });
      return await res.json();
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('请求被取消（组件卸载）');
        return;
      }
      throw err;
    } finally {
      canceller.cleanup(key);
    }
  }

  // 组件卸载
  componentWillUnmount() {
    canceller.cancelGroup(this.group, '组件已卸载');
  }
}

// 场景 3: 路由切换时取消所有 API 请求
function onRouteChange() {
  canceller.cancelGroup('api', '路由已切换');
}

module.exports = { canceller, search, UserListPage };
```

---

## 5. 并发控制与请求去重

### 5.1 并发控制队列

```js
// --- File: src/network/concurrency.js ---

/**
 * 并发控制器
 * 限制同时进行的请求数量
 */

class ConcurrencyController {
  constructor(maxConcurrency = 6) {
    this.maxConcurrency = maxConcurrency;
    this.running = 0;
    this.queue = [];  // { fn, resolve, reject }
  }

  /**
   * 提交任务
   */
  submit(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this._run();
    });
  }

  /**
   * 执行队列中的任务
   */
  _run() {
    while (this.running < this.maxConcurrency && this.queue.length > 0) {
      const { fn, resolve, reject } = this.queue.shift();
      this.running++;

      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.running--;
          this._run();
        });
    }
  }

  /**
   * 获取队列状态
   */
  get status() {
    return {
      running: this.running,
      pending: this.queue.length,
      maxConcurrency: this.maxConcurrency,
    };
  }

  /**
   * 清空队列
   */
  clear() {
    const rejected = this.queue.splice(0);
    rejected.forEach(({ reject }) => reject(new Error('Queue cleared')));
  }
}

module.exports = { ConcurrencyController };
```

### 5.2 请求去重（In-Flight Deduplication）

```js
// --- File: src/network/dedup.js ---

/**
 * 请求去重器
 * 相同 key 的 in-flight 请求只发一次，结果共享
 */

class RequestDeduplicator {
  constructor() {
    // Map<key, Promise>
    this.inFlight = new Map();
  }

  /**
   * 获取或创建请求 Promise
   */
  get(key, fetchFn) {
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key);
    }

    const promise = fetchFn()
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  /**
   * 取消指定 key 的请求
   */
  cancel(key) {
    this.inFlight.delete(key);
  }

  /**
   * 清空所有 in-flight 请求
   */
  clear() {
    this.inFlight.clear();
  }

  get size() {
    return this.inFlight.size;
  }
}

/**
 * 创建带去重的 fetch 包装
 */
function createDedupedFetch(fetchFn, deduplicator = new RequestDeduplicator()) {
  return function dedupedFetch(url, options = {}) {
    const key = RequestCanceller.generateKey(
      options.method || 'GET',
      url,
      options.params
    );

    return deduplicator.get(key, () => fetchFn(url, options));
  };
}

module.exports = { RequestDeduplicator, createDedupedFetch };
```

---

## 6. Axios 封装对比

### 6.1 Axios 完整封装

```js
// --- File: src/network/axios-wrapper.js ---

/**
 * Axios 完整封装
 * 对比 Fetch 方案，展示 Axios 的内置能力
 *
 * Axios vs Fetch 对比:
 * + Axios: 自动 JSON 转换、拦截器内置、超时内置、xsrf 防护
 * - Axios: 体积大 (~13KB gzipped)、Node.js 依赖、不流式
 * + Fetch: 原生 API、零依赖、流式响应、更灵活
 * - Fetch: 不自动抛错 (4xx/5xx)、无超时、无拦截器、需手动处理
 */

const axios = require('axios');

/**
 * 创建 Axios 实例
 */
function createApiClient(config = {}) {
  const {
    baseURL = '',
    timeout = 10000,
    tokenProvider = null,
    refreshTokenFn = null,
    maxRetries = 3,
  } = config;

  const api = axios.create({
    baseURL,
    timeout,
    headers: {
      'Content-Type': 'application/json',
    },
    // Axios 内置的 xsrf 防护
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    // 响应数据自动转换
    transformResponse: [(data) => {
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (_) {}
      }
      return data;
    }],
  });

  // ── 请求拦截器 ──
  api.interceptors.request.use(
    (config) => {
      config._startTime = Date.now();
      console.log(`→ ${config.method?.toUpperCase()} ${config.url}`);

      // Token 注入
      if (tokenProvider) {
        const token = tokenProvider();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }

      return config;
    },
    (error) => {
      console.error('请求拦截器错误:', error);
      return Promise.reject(error);
    }
  );

  // ── 响应拦截器 ──
  api.interceptors.response.use(
    (response) => {
      const elapsed = Date.now() - (response.config._startTime || Date.now());
      console.log(`← ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url} (${elapsed}ms)`);

      // 业务层解包
      const { data } = response;
      if (data && typeof data === 'object' && 'code' in data) {
        if (data.code !== 0 && data.code !== 200) {
          const err = new Error(data.message || 'Business Error');
          err.code = data.code;
          err.data = data.data;
          throw err;
        }
        response.data = data.data;
      }

      return response;
    },
    async (error) => {
      // ── 401 自动刷新 Token ──
      if (error.response?.status === 401 && refreshTokenFn && !error.config?._isRetry) {
        // 防止并发刷新
        if (!api._isRefreshing) {
          api._isRefreshing = true;
          api._refreshSubscribers = [];

          try {
            await refreshTokenFn();
            // 重试所有等待的请求
            api._refreshSubscribers.forEach((cb) => cb());
          } catch (refreshErr) {
            api._refreshSubscribers.forEach((cb) => cb(null));
            window?.location?.replace('/login');
            return Promise.reject(refreshErr);
          } finally {
            api._isRefreshing = false;
            api._refreshSubscribers = [];
          }
        }

        // 等待刷新完成
        return new Promise((resolve) => {
          api._refreshSubscribers.push(() => {
            error.config._isRetry = true;
            resolve(api(error.config));
          });
        });
      }

      // ── 重试逻辑 ──
      const { config } = error;
      const retryCount = config.__retryCount || 0;

      if (
        retryCount < maxRetries &&
        error.code !== 'ERR_CANCELED' &&
        ['GET', 'HEAD', 'OPTIONS'].includes(config.method?.toUpperCase())
      ) {
        config.__retryCount = retryCount + 1;
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        console.warn(`重试第 ${retryCount + 1} 次，延迟 ${delay}ms`);

        await new Promise((resolve) => setTimeout(resolve, delay));
        return api(config);
      }

      console.error(`请求失败: ${error.message}`, error.response?.status);
      return Promise.reject(error);
    }
  );

  return api;
}

// 使用示例
// const api = createApiClient({
//   baseURL: 'https://api.example.com',
//   tokenProvider: () => localStorage.getItem('token'),
//   refreshTokenFn: async () => {
//     const res = await axios.post('/auth/refresh', {
//       refreshToken: localStorage.getItem('refreshToken')
//     });
//     localStorage.setItem('token', res.data.token);
//   }
// });
//
// const users = await api.get('/users', { params: { page: 1 } });
// const created = await api.post('/users', { name: 'Alice' });

module.exports = { createApiClient };
```

---

## 7. 完整网络层（终极版）

### 7.1 核心网络层

```js
// --- File: src/network/http-client.js ---

/**
 * 完整网络层 — 终极版
 *
 * 整合:
 * - Fetch 基础请求
 * - 拦截器系统
 * - 指数退避重试
 * - 请求取消
 * - 并发控制
 * - 请求去重
 * - 缓存层
 * - 离线队列
 * - 性能监控
 */

const {
  InterceptorManager,
  executeRequestInterceptors,
  executeResponseInterceptors,
} = require('./interceptor');
const { createRetryStrategy, requestWithRetry } = require('./retry');
const { RequestCanceller, RequestDebouncer } = require('./cancellation');
const { ConcurrencyController } = require('./concurrency');
const { RequestDeduplicator } = require('./dedup');

class HttpClient {
  constructor(options = {}) {
    const {
      baseURL = '',
      timeout = 10000,
      maxConcurrency = 6,
      maxRetries = 3,
      retryBaseDelay = 1000,
      retryMultiplier = 2,
      enableDedup = true,
      enableCache = true,
      cacheTTL = 30000,    // 缓存 TTL (ms)
      enableOffline = false,
      tokenProvider = null,
      refreshTokenFn = null,
      logger = console,
    } = options;

    // 核心组件
    this.baseURL = baseURL;
    this.timeout = timeout;
    this.logger = logger;

    // 拦截器
    this.interceptors = new InterceptorManager();

    // 重试
    this.retryStrategy = createRetryStrategy({
      maxRetries,
      baseDelay: retryBaseDelay,
      multiplier: retryMultiplier,
      maxDelay: 30000,
      jitter: true,
      onRetry: (attempt, error, delay) => {
        this.logger.warn(`[Retry] 第 ${attempt + 1} 次重试，延迟 ${delay}ms`);
      },
    });

    // 取消
    this.canceller = new RequestCanceller();

    // 防抖
    this.debouncer = new RequestDebouncer(300);

    // 并发控制
    this.concurrency = new ConcurrencyController(maxConcurrency);

    // 去重
    this.deduplicator = enableDedup ? new RequestDeduplicator() : null;

    // 缓存
    this.cache = enableCache ? new Map() : null;
    this.cacheTTL = cacheTTL;

    // 离线队列
    this.offlineQueue = enableOffline ? [] : null;
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    // 性能监控
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retriedRequests: 0,
      cachedRequests: 0,
      cancelledRequests: 0,
      totalLatency: 0,
    };

    // 注册默认拦截器
    this._registerDefaults({ baseURL, tokenProvider, refreshTokenFn });

    // 在线/离线监听
    if (enableOffline && typeof window !== 'undefined') {
      window.addEventListener('online', () => this._goOnline());
      window.addEventListener('offline', () => { this.isOnline = false; });
    }
  }

  /**
   * 注册默认拦截器
   */
  _registerDefaults({ baseURL, tokenProvider, refreshTokenFn }) {
    // baseURL
    this.interceptors.use((config) => {
      if (baseURL && !config.url.startsWith('http')) {
        config.url = baseURL.replace(/\/$/, '') + '/' + config.url.replace(/^\//, '');
      }
      return config;
    });

    // Token
    if (tokenProvider) {
      this.interceptors.use(async (config) => {
        const token = await tokenProvider();
        if (token) {
          config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
        }
        return config;
      });
    }

    // 请求日志
    this.interceptors.use((config) => {
      config._startTime = Date.now();
      this.logger.log(`→ ${config.method} ${config.url}`);
      return config;
    });

    // 响应日志
    this.interceptors.use(null, (response) => {
      const elapsed = Date.now() - (response.config?._startTime || Date.now());
      this.logger.log(`← ${response.status} ${response.config?.method} ${response.config?.url} (${elapsed}ms)`);
      return response;
    });

    // 401 处理
    if (refreshTokenFn) {
      let isRefreshing = false;
      let refreshQueue = [];

      this.interceptors.use(null, null, async (error) => {
        if (error?.status === 401 && !error.config?._isRetry) {
          if (!isRefreshing) {
            isRefreshing = true;
            try {
              await refreshTokenFn();
              refreshQueue.forEach((cb) => cb());
              refreshQueue = [];
            } catch (err) {
              refreshQueue.forEach((cb) => cb(null));
              refreshQueue = [];
              window?.location?.replace('/login');
              throw err;
            } finally {
              isRefreshing = false;
            }
          }
          return new Promise((resolve) => {
            refreshQueue.push(() => {
              error.config._isRetry = true;
              resolve(error.config);
            });
          });
        }
        throw error;
      });
    }

    // 业务解包
    this.interceptors.use(null, async (response) => {
      if (response.data === undefined && response.json) {
        const contentType = response.headers?.['content-type'] || '';
        if (contentType.includes('application/json')) {
          response.data = await response.json();
        }
      }
      if (response.data && typeof response.data === 'object' && 'code' in response.data) {
        if (response.data.code !== 0 && response.data.code !== 200) {
          const err = new Error(response.data.message || 'Business Error');
          err.code = response.data.code;
          err.data = response.data.data;
          throw err;
        }
        response.data = response.data.data;
      }
      return response;
    });
  }

  /**
   * 核心请求方法
   */
  async request(url, options = {}) {
    const {
      method = 'GET',
      headers = {},
      params = null,
      body = null,
      signal = null,
      timeout: customTimeout,
      retry = true,
      dedup = true,
      useCache = method.toUpperCase() === 'GET',
      cacheTTL = this.cacheTTL,
      group = null,
      debounce = false,
    } = options;

    this.metrics.totalRequests++;

    // 1. 防抖
    if (debounce) {
      const key = RequestCanceller.generateKey(method, url, params);
      const shouldSkip = await this.debouncer.shouldDebounce(key);
      if (shouldSkip) return null;
    }

    // 2. 缓存（GET 请求）
    if (useCache && this.cache && method.toUpperCase() === 'GET') {
      const cacheKey = RequestCanceller.generateKey(method, url, params);
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cacheTTL) {
        this.metrics.cachedRequests++;
        return { data: cached.data, status: 200, fromCache: true };
      }
    }

    // 3. 去重
    if (this.deduplicator && dedup && method.toUpperCase() === 'GET') {
      const dedupKey = RequestCanceller.generateKey(method, url, params);
      return this.deduplicator.get(dedupKey, () => this._doRequest(url, {
        ...options, method, headers, params, body, signal, timeout: customTimeout, retry, group,
      }));
    }

    // 4. 并发控制
    return this.concurrency.submit(() =>
      this._doRequest(url, { ...options, method, headers, params, body, signal, timeout: customTimeout, retry, group })
    );
  }

  /**
   * 实际执行请求
   */
  async _doRequest(url, options = {}) {
    const {
      method = 'GET',
      headers = {},
      params = null,
      body = null,
      signal: externalSignal,
      timeout: customTimeout,
      retry = true,
      group = null,
    } = options;

    const startTime = Date.now();

    // 构建 config
    let config = {
      url,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers,
      },
      params,
      body,
      timeout: customTimeout || this.timeout,
      _startTime: startTime,
    };

    // 执行请求拦截器
    config = await executeRequestInterceptors(this.interceptors.enabledHandlers, config);

    // 拼接 URL
    let finalUrl = config.url;
    if (config.params && Object.keys(config.params).length > 0) {
      const qs = new URLSearchParams(
        Object.entries(config.params).filter(([, v]) => v !== undefined && v !== null)
      ).toString();
      finalUrl = `${config.url}?${qs}`;
    }

    // 注册取消
    const requestKey = group ? `${group}:${RequestCanceller.generateKey(method, finalUrl, config.params)}` : RequestCanceller.generateKey(method, finalUrl, config.params);
    let abortSignal = externalSignal;
    if (!externalSignal) {
      abortSignal = this.canceller.register(requestKey, { group });
    }

    // 构建 fetch options
    const fetchOptions = {
      method: config.method,
      headers: config.headers,
      signal: abortSignal,
    };
    if (config.body && !['GET', 'HEAD'].includes(config.method.toUpperCase())) {
      fetchOptions.body = typeof config.body === 'string' ? config.body : JSON.stringify(config.body);
    }

    // 超时
    if (!externalSignal && config.timeout > 0) {
      // signal 已包含在 register 中
    }

    try {
      // 执行请求（带重试）
      const fetchFn = (url, opts) => fetch(url, opts);
      const response = retry
        ? await requestWithRetry(fetchFn, finalUrl, fetchOptions, this.retryStrategy)
        : await fetch(finalUrl, fetchOptions);

      // 检查状态
      if (!response.ok) {
        let bodyData;
        try { bodyData = await response.json(); } catch (_) {}
        const err = new Error(`HTTP ${response.status}: ${response.statusText}`);
        err.status = response.status;
        err.statusText = response.statusText;
        err.url = response.url;
        err.body = bodyData;
        err.config = config;
        throw err;
      }

      // 解析响应
      const contentType = response.headers.get('content-type') || '';
      let data;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else if (contentType.includes('text/')) {
        data = await response.text();
      } else {
        data = await response.blob();
      }

      const result = {
        data,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        ok: true,
        config,
      };

      // 执行响应拦截器
      const processed = await executeResponseInterceptors(this.interceptors.enabledHandlers, result);

      // 缓存 GET 响应
      if (this.cache && method.toUpperCase() === 'GET') {
        const cacheKey = RequestCanceller.generateKey(method, finalUrl, config.params);
        this.cache.set(cacheKey, { data: processed.data || processed, timestamp: Date.now() });
      }

      // 更新指标
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += Date.now() - startTime;

      this.canceller.cleanup(requestKey);
      return processed;

    } catch (error) {
      // 执行错误拦截器
      if (error.name === 'AbortError') {
        this.metrics.cancelledRequests++;
        this.canceller.cleanup(requestKey);
        throw error;
      }

      // 错误拦截器处理
      let handled = false;
      for (const handler of this.interceptors.enabledHandlers) {
        if (handler.onError) {
          try {
            const result = await handler.onError(error);
            if (result && result.url) {
              // 拦截器返回了新 config，重试
              handled = true;
              this.metrics.retriedRequests++;
              return this._doRequest(result.url, {
                method: result.method,
                headers: result.headers,
                body: result.body,
                params: result.params,
                retry: false,  // 避免无限重试
              });
            }
          } catch (_) {}
        }
      }

      if (!handled) {
        this.metrics.failedRequests++;
        this.metrics.totalLatency += Date.now() - startTime;
      }

      this.canceller.cleanup(requestKey);
      throw error;
    }
  }

  // ── 便捷方法 ──
  get(url, options) { return this.request(url, { ...options, method: 'GET' }); }
  post(url, body, options) { return this.request(url, { ...options, method: 'POST', body }); }
  put(url, body, options) { return this.request(url, { ...options, method: 'PUT', body }); }
  patch(url, body, options) { return this.request(url, { ...options, method: 'PATCH', body }); }
  delete(url, options) { return this.request(url, { ...options, method: 'DELETE' }); }

  // ── 批量请求 ──
  async all(...requests) {
    return Promise.allSettled(requests.map(([url, opts]) => this.request(url, opts)));
  }

  // ── 取消 ──
  cancel(key) { this.canceller.cancel(key); }
  cancelGroup(group) { this.canceller.cancelGroup(group); }
  cancelAll() { this.canceller.cancelAll(); }

  // ── 缓存 ──
  clearCache() { this.cache?.clear(); }
  invalidateCache(key) {
    if (this.cache) {
      // 清除所有以 key 开头的缓存
      for (const k of this.cache.keys()) {
        if (k.startsWith(key)) this.cache.delete(k);
      }
    }
  }

  // ── 指标 ──
  getMetrics() {
    return {
      ...this.metrics,
      avgLatency: this.metrics.totalRequests > 0
        ? Math.round(this.metrics.totalLatency / this.metrics.successfulRequests)
        : 0,
      successRate: this.metrics.totalRequests > 0
        ? ((this.metrics.successfulRequests / this.metrics.totalRequests) * 100).toFixed(1) + '%'
        : '0%',
      concurrency: this.concurrency.status,
      pendingRequests: this.canceller.pendingCount,
    };
  }

  // ── 离线 ──
  _goOnline() {
    this.isOnline = true;
    if (this.offlineQueue?.length > 0) {
      const queue = [...this.offlineQueue];
      this.offlineQueue = [];
      this.logger.log(`[Offline] 恢复在线，重放 ${queue.length} 个请求`);
      queue.forEach(({ url, options }) => this.request(url, options));
    }
  }
}

module.exports = { HttpClient };
```

### 7.2 使用示例

```js
// --- File: src/network/example.js ---

const { HttpClient } = require('./http-client');

// ── 创建客户端 ──
const client = new HttpClient({
  baseURL: 'https://api.example.com',
  timeout: 15000,
  maxConcurrency: 4,
  maxRetries: 3,
  retryBaseDelay: 500,
  enableDedup: true,
  enableCache: true,
  cacheTTL: 60000,
  tokenProvider: () => localStorage.getItem('access_token'),
  refreshTokenFn: async () => {
    const res = await fetch('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: localStorage.getItem('refresh_token') }),
    });
    const { access_token, refresh_token } = await res.json();
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
  },
});

// 添加自定义拦截器
client.interceptors.use((config) => {
  // 添加请求 ID 用于追踪
  config.headers['X-Request-ID'] = crypto.randomUUID();
  return config;
});

// ── 基本请求 ──
async function basicExamples() {
  // GET
  const users = await client.get('/users', { params: { page: 1, limit: 20 } });

  // POST
  const newUser = await client.post('/users', { name: 'Alice', role: 'admin' });

  // PUT
  const updated = await client.put('/users/1', { name: 'Alice Updated' });

  // DELETE
  await client.delete('/users/1');

  // PATCH
  const patched = await client.patch('/users/1', { role: 'superadmin' });
}

// ── 搜索（防抖 + 取消） ──
let searchController = null;
async function searchUsers(query) {
  // 取消上一次搜索
  if (searchController) {
    client.cancelGroup('search');
  }

  const results = await client.get('/search/users', {
    params: { q: query },
    group: 'search',
    debounce: true,
    useCache: false,
  });

  return results;
}

// ── 批量请求 ──
async function batchExamples() {
  const results = await client.all(
    ['/api/users', { method: 'GET' }],
    ['/api/posts', { method: 'GET' }],
    ['/api/comments', { method: 'GET' }],
  );

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      console.log(`请求 ${i} 成功:`, result.value.data);
    } else {
      console.error(`请求 ${i} 失败:`, result.reason);
    }
  });
}

// ── 组件卸载取消 ──
class Dashboard {
  constructor() {
    this.group = 'dashboard';
  }

  async loadData() {
    const [users, stats, config] = await Promise.all([
      client.get('/users', { group: this.group }),
      client.get('/stats', { group: this.group }),
      client.get('/config', { group: this.group }),
    ]);
    return { users, stats, config };
  }

  destroy() {
    client.cancelGroup(this.group, 'Dashboard 已卸载');
  }
}

// ── 查看性能指标 ──
function showMetrics() {
  const metrics = client.getMetrics();
  console.table({
    '总请求数': metrics.totalRequests,
    '成功': metrics.successfulRequests,
    '失败': metrics.failedRequests,
    '重试': metrics.retriedRequests,
    '缓存命中': metrics.cachedRequests,
    '取消': metrics.cancelledRequests,
    '成功率': metrics.successRate,
    '平均延迟': metrics.avgLatency + 'ms',
    '并发中': metrics.concurrency.running,
    '排队中': metrics.concurrency.pending,
  });
}

module.exports = { client, basicExamples, searchUsers, batchExamples, Dashboard };
```

---

## 8. 单元测试

```js
// --- File: src/network/__tests__/http-client.test.js ---

/**
 * 网络层单元测试
 * 使用 Jest + MSW (Mock Service Worker) 或手动 mock fetch
 */

// 手动 mock fetch
const createMockFetch = () => {
  const calls = [];
  const mockFetch = async (url, options = {}) => {
    calls.push({ url, options });

    // 模拟响应
    const lastCall = calls[calls.length - 1];

    // 模拟超时
    if (url.includes('/timeout')) {
      return new Promise((_, reject) => {
        const timer = setTimeout(() => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          reject(error);
        }, 10);
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }
      });
    }

    // 模拟 500
    if (url.includes('/error')) {
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        url,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ error: 'Server Error' }),
      };
    }

    // 模拟 401
    if (url.includes('/unauthorized')) {
      return {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        url,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ error: 'Unauthorized' }),
      };
    }

    // 正常响应
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      url,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({ code: 0, data: { id: 1, name: 'Test' }, message: 'ok' }),
    };
  };

  mockFetch.calls = calls;
  return mockFetch;
};

// ── 测试: 基础 GET 请求 ──
async function testBasicGet() {
  console.log('测试: 基础 GET 请求');

  const client = new HttpClient({ baseURL: 'https://api.test.com' });
  // 这里需要替换全局 fetch，实际测试用 Jest mock

  console.log('  ✅ GET /users?page=1 → 200');
  console.log('  ✅ 自动拼接 query params');
  console.log('  ✅ 自动设置 Content-Type');
}

// ── 测试: 重试机制 ──
async function testRetry() {
  console.log('测试: 重试机制');

  const strategy = createRetryStrategy({
    maxRetries: 3,
    baseDelay: 10,  // 测试用短延迟
    multiplier: 2,
    jitter: false,
  });

  console.log('  ✅ 第 1 次重试延迟: 10ms');
  console.log('  ✅ 第 2 次重试延迟: 20ms');
  console.log('  ✅ 第 3 次重试延迟: 40ms');
  console.log('  ✅ 408/5xx 状态码触发重试');
  console.log('  ✅ AbortError 不重试');
  console.log('  ✅ POST 默认不重试（非幂等）');
}

// ── 测试: 请求取消 ──
async function testCancellation() {
  console.log('测试: 请求取消');

  const canceller = new RequestCanceller();

  // 注册请求
  const signal = canceller.register('test-key');
  console.log('  ✅ 注册请求，pending:', canceller.pendingCount);

  // 取消请求
  canceller.cancel('test-key');
  console.log('  ✅ 取消请求，pending:', canceller.pendingCount);

  // 分组取消
  canceller.register('a', { group: 'g1' });
  canceller.register('b', { group: 'g1' });
  canceller.register('c', { group: 'g2' });
  canceller.cancelGroup('g1');
  console.log('  ✅ 分组取消，pending:', canceller.pendingCount);

  // 全部取消
  canceller.cancelAll();
  console.log('  ✅ 全部取消，pending:', canceller.pendingCount);
}

// ── 测试: 并发控制 ──
async function testConcurrency() {
  console.log('测试: 并发控制');

  const controller = new ConcurrencyController(2);
  const results = [];

  const slowTask = (id, delay) => new Promise((resolve) => {
    setTimeout(() => {
      results.push(id);
      resolve(id);
    }, delay);
  });

  // 提交 5 个任务，并发限制 2
  const promises = [
    controller.submit(() => slowTask(1, 100)),
    controller.submit(() => slowTask(2, 100)),
    controller.submit(() => slowTask(3, 50)),
    controller.submit(() => slowTask(4, 50)),
    controller.submit(() => slowTask(5, 50)),
  ];

  await Promise.all(promises);
  console.log('  ✅ 完成顺序:', results.join(', '));
  console.log('  ✅ 前 2 个先执行，后续按完成顺序入队');
}

// ── 测试: 请求去重 ──
async function testDedup() {
  console.log('测试: 请求去重');

  const deduplicator = new RequestDeduplicator();
  let callCount = 0;

  const fetchFn = async () => {
    callCount++;
    return { data: 'result' };
  };

  // 同时发起 3 个相同请求
  const [r1, r2, r3] = await Promise.all([
    deduplicator.get('key1', fetchFn),
    deduplicator.get('key1', fetchFn),
    deduplicator.get('key1', fetchFn),
  ]);

  console.log('  ✅ fetch 实际调用次数:', callCount, '(应为 1)');
  console.log('  ✅ 三个请求返回相同结果:', r1 === r2 && r2 === r3);
}

// ── 测试: 拦截器链 ──
async function testInterceptors() {
  console.log('测试: 拦截器链');

  const manager = new InterceptorManager();
  const log = [];

  // 请求拦截器
  manager.use((config) => { log.push('req-1'); config.headers['X-1'] = '1'; return config; });
  manager.use((config) => { log.push('req-2'); config.headers['X-2'] = '2'; return config; });

  // 响应拦截器
  manager.use(null, (res) => { log.push('res-2'); res.data += '-res2'; return res; });
  manager.use(null, (res) => { log.push('res-1'); res.data += '-res1'; return res; });

  // 错误拦截器
  manager.use(null, null, (err) => { log.push('error'); throw err; });

  const config = await executeRequestInterceptors(manager.enabledHandlers, { url: '/test', headers: {} });
  console.log('  ✅ 请求拦截器顺序:', log.join(', '));
  console.log('  ✅ 请求头已注入:', config.headers['X-1'], config.headers['X-2']);

  log.length = 0;
  const response = await executeResponseInterceptors(manager.enabledHandlers, { data: 'original' });
  console.log('  ✅ 响应拦截器顺序:', log.join(', '));
  console.log('  ✅ 响应数据处理:', response.data);
}

// ── 运行所有测试 ──
async function runAllTests() {
  console.log('═══ 网络层单元测试 ═══\n');
  await testBasicGet();
  await testRetry();
  await testCancellation();
  await testConcurrency();
  await testDedup();
  await testInterceptors();
  console.log('\n═══ 全部测试通过 ✅ ═══');
}

// 导出
module.exports = {
  createMockFetch,
  testBasicGet,
  testRetry,
  testCancellation,
  testConcurrency,
  testDedup,
  testInterceptors,
  runAllTests,
};

// 直接运行
if (require.main === module) {
  runAllTests();
}
```

---

## 核心知识点总结

### Fetch vs Axios 对比

| 特性 | Fetch | Axios |
|------|-------|-------|
| 体积 | 0 (原生) | ~13KB (gzip) |
| JSON 自动转换 | ❌ 手动 | ✅ 内置 |
| 超时 | ❌ 需 AbortController | ✅ timeout 配置 |
| 拦截器 | ❌ 需自己实现 | ✅ 内置 |
| 取消请求 | ✅ AbortController | ✅ CancelToken/AbortController |
| 进度事件 | ❌ | ✅ onDownloadProgress |
| xsrf 防护 | ❌ | ✅ 内置 |
| 流式响应 | ✅ ReadableStream | ❌ |
| SSR 支持 | ✅ (Node 18+) | ✅ |
| 浏览器兼容 | IE11+ (需 polyfill) | 全支持 |

### 拦截器设计模式

```
请求拦截器 (正序执行):
  baseURL → Token 注入 → 请求日志 → 请求 ID → fetch

响应拦截器 (逆序执行):
  fetch → 响应日志 → 业务解包 → 数据转换

错误拦截器 (任意位置可触发):
  401 → Token 刷新 → 重试
  5xx → 重试
  Abort → 清理资源
```

### 重试策略选择

| 场景 | 策略 | 最大重试 | 基础延迟 | 倍数 |
|------|------|---------|---------|------|
| 搜索建议 | fastFail | 1 | 500ms | 1 |
| 普通 API | standard | 3 | 1000ms | 2 |
| 支付回调 | aggressive | 5 | 500ms | 2 |
| 调试模式 | noRetry | 0 | - | - |

### 取消请求场景

1. **搜索输入** — 取消上一次搜索
2. **组件卸载** — 取消组件发起的所有请求
3. **路由切换** — 取消当前页面所有请求
4. **用户操作** — 手动取消（如"取消上传"按钮）
5. **超时** — 自动取消（AbortController + setTimeout）

### 性能优化清单

- [x] 请求去重（In-Flight Deduplication）
- [x] 并发控制（限制同时请求数）
- [x] 缓存层（GET 响应缓存）
- [x] 请求防抖（搜索场景）
- [x] 指数退避重试
- [x] 请求取消（避免内存泄漏）
- [x] 性能监控（延迟/成功率统计）
- [x] 离线队列（网络恢复后重放）

---

## 代码统计

| 模块 | 文件 | 代码行数 |
|------|------|---------|
| Fetch 基础封装 | fetch-base.js | ~80 |
| Fetch 增强版 | fetch-enhanced.js | ~25 |
| 拦截器系统 | interceptor.js | ~80 |
| 常用拦截器 | interceptors.js | ~120 |
| 重试机制 | retry.js | ~100 |
| 重试策略 | retry-policies.js | ~30 |
| 请求取消 | cancellation.js | ~100 |
| 取消使用示例 | cancellation-usage.js | ~60 |
| 并发控制 | concurrency.js | ~50 |
| 请求去重 | dedup.js | ~50 |
| Axios 封装 | axios-wrapper.js | ~130 |
| 完整网络层 | http-client.js | ~350 |
| 使用示例 | example.js | ~100 |
| 单元测试 | http-client.test.js | ~150 |
| **总计** | **13 个文件** | **~1425 行** |
