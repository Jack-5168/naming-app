# 专项训练：网络请求层完整实现

> 日期：2026-04-30 12:00 | 主题：Fetch/Axios/拦截器/重试机制/取消请求

---

## 一、基于 Axios 的完整网络层

### 1.1 核心网络层 (network.js)

```javascript
import axios from 'axios';

// ============ 配置 ============
const config = {
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
};

// ============ 实例创建 ============
const http = axios.create(config);

// ============ Token 管理 ============
let tokenStorage = {
  get: () => localStorage.getItem('access_token'),
  set: (token) => localStorage.setItem('access_token', token),
  clear: () => localStorage.removeItem('access_token'),
};

// ============ 请求拦截器 ============
http.interceptors.request.use(
  (config) => {
    // 1. 附加 Token
    const token = tokenStorage.get();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 2. 附加请求 ID（用于追踪）
    config.headers['X-Request-ID'] = generateRequestId();

    // 3. 记录请求日志
    console.log(`[Request] ${config.method?.toUpperCase()} ${config.url}`, {
      requestId: config.headers['X-Request-ID'],
      timestamp: new Date().toISOString(),
    });

    // 4. 取消重复请求
    cancelDuplicateRequest(config);

    return config;
  },
  (error) => {
    console.error('[Request Error]', error);
    return Promise.reject(error);
  }
);

// ============ 响应拦截器 ============
http.interceptors.response.use(
  (response) => {
    // 1. 记录响应日志
    console.log(`[Response] ${response.status} ${response.config.url}`, {
      requestId: response.config.headers['X-Request-ID'],
      duration: Date.now() - (response.config.startTime || Date.now()),
    });

    // 2. 统一解包（后端通常包一层 { code, data, message }）
    const { data } = response;
    if (data && typeof data.code === 'number') {
      if (data.code === 0) {
        return data.data;
      }
      // 业务错误
      return Promise.reject(new BusinessError(data.code, data.message, data));
    }
    return data;
  },
  async (error) => {
    const { config, response } = error;

    // 被取消的请求直接抛出
    if (axios.isCancel(error)) {
      console.log(`[Request Cancelled] ${config?.url}`);
      return Promise.reject(error);
    }

    // 网络错误
    if (!response) {
      handleNetworkError(error);
      return Promise.reject(error);
    }

    const status = response.status;

    switch (status) {
      case 401:
        return handleUnauthorized(config);
      case 403:
        handleForbidden(response);
        break;
      case 404:
        handleNotFound(response);
        break;
      case 429:
        return handleRateLimit(config, error);
      case 500:
      case 502:
      case 503:
      case 504:
        return handleServerError(config, error);
      default:
        handleDefaultError(response);
    }

    return Promise.reject(error);
  }
);

// ============ 401 无授权处理 ============
let isRefreshing = false;
let refreshSubscribers = [];

function handleUnauthorized(config) {
  if (isRefreshing) {
    // 排队等待 token 刷新
    return new Promise((resolve) => {
      refreshSubscribers.push((token) => {
        config.headers.Authorization = `Bearer ${token}`;
        resolve(http(config));
      });
    });
  }

  isRefreshing = true;

  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    // 没有 refresh token，直接跳转登录
    redirectToLogin();
    return Promise.reject(new Error('No refresh token'));
  }

  // 尝试刷新 token
  return axios
    .post('/auth/refresh', { refreshToken })
    .then((res) => {
      const { accessToken, refreshToken: newRefreshToken } = res.data.data;
      tokenStorage.set(accessToken);
      if (newRefreshToken) {
        localStorage.setItem('refresh_token', newRefreshToken);
      }

      // 通知所有排队的请求
      refreshSubscribers.forEach((cb) => cb(accessToken));
      refreshSubscribers = [];

      // 重试原请求
      config.headers.Authorization = `Bearer ${accessToken}`;
      return http(config);
    })
    .catch(() => {
      // 刷新失败，跳转登录
      refreshSubscribers.forEach((cb) => cb(null));
      refreshSubscribers = [];
      redirectToLogin();
      return Promise.reject(new Error('Token refresh failed'));
    })
    .finally(() => {
      isRefreshing = false;
    });
}

function redirectToLogin() {
  tokenStorage.clear();
  localStorage.removeItem('refresh_token');
  window.location.href = '/login?redirect=' + encodeURIComponent(window.location.href);
}

// ============ 错误处理函数 ============
function handleNetworkError(error) {
  if (error.code === 'ECONNABORTED') {
    console.error('[Network Error] Request timeout');
    // 可触发全局 Toast
    showToast('请求超时，请检查网络');
  } else {
    console.error('[Network Error] No response received');
    showToast('网络连接失败');
  }
}

function handleForbidden(response) {
  console.error('[403] Permission denied:', response.config.url);
  showToast('没有权限访问该资源');
}

function handleNotFound(response) {
  console.error('[404] Resource not found:', response.config.url);
}

function handleRateLimit(config, error) {
  const retryAfter = error.response.headers['retry-after'] || 60;
  console.warn(`[429] Rate limited. Retry after ${retryAfter}s`);
  showToast(`请求过于频繁，请 ${retryAfter} 秒后重试`);
  return Promise.reject(error);
}

function handleServerError(config, error) {
  console.error(`[${error.response.status}] Server error:`, error.response.data);
  showToast('服务器错误，请稍后重试');
  return Promise.reject(error);
}

function handleDefaultError(response) {
  console.error(`[${response.status}] Error:`, response.data);
}

// ============ 辅助函数 ============
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function showToast(message) {
  // 可对接 Element Plus / Ant Design 的 message 组件
  if (window.$message) {
    window.$message.error(message);
  }
}

// ============ 重复请求取消 ============
const pendingRequests = new Map();

function getRequestKey(config) {
  return `${config.method}:${config.url}:${JSON.stringify(config.params || {})}:${JSON.stringify(config.data || {})}`;
}

function cancelDuplicateRequest(config) {
  const key = getRequestKey(config);

  if (pendingRequests.has(key)) {
    const cancelToken = pendingRequests.get(key);
    cancelToken.cancel(`Duplicate request cancelled: ${config.url}`);
    pendingRequests.delete(key);
  }

  const source = axios.CancelToken.source();
  config.cancelToken = source.token;
  pendingRequests.set(key, source);
}

http.interceptors.response.use(
  (response) => {
    const key = getRequestKey(response.config);
    if (pendingRequests.has(key)) {
      pendingRequests.delete(key);
    }
    return response;
  },
  (error) => {
    if (error.config && !axios.isCancel(error)) {
      const key = getRequestKey(error.config);
      if (pendingRequests.has(key)) {
        pendingRequests.delete(key);
      }
    }
    return Promise.reject(error);
  }
);

// ============ 导出 ============
export default http;
export { BusinessError, tokenStorage };
```

### 1.2 自定义错误类 (errors.js)

```javascript
// 业务错误
class BusinessError extends Error {
  constructor(code, message, data) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.data = data;
  }
}

// 网络错误
class NetworkError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'NetworkError';
    this.originalError = originalError;
  }
}

// 超时错误
class TimeoutError extends Error {
  constructor(url) {
    super(`Request timeout: ${url}`);
    this.name = 'TimeoutError';
  }
}

// 取消错误
class CancelledError extends Error {
  constructor(message) {
    super(message || 'Request cancelled');
    this.name = 'CancelledError';
  }
}

export { BusinessError, NetworkError, TimeoutError, CancelledError };
```

### 1.3 重试机制 (retry.js)

```javascript
import http from './network';

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
 * @param {Function} options.onRetry - 重试回调 (retryCount, error)
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

      if (attempt > maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // 计算延迟
      let waitTime = exponentialBackoff
        ? Math.min(delay * Math.pow(2, attempt - 1), maxDelay)
        : delay;

      // 添加 jitter 防止雪崩
      waitTime = waitTime + Math.random() * 1000;

      console.warn(
        `[Retry] Attempt ${attempt}/${maxRetries} failed. ` +
        `Retrying in ${Math.round(waitTime)}ms. Error: ${error.message}`
      );

      if (onRetry) {
        onRetry(attempt, error);
      }

      await sleep(waitTime);
      return execute();
    }
  }

  return execute();
}

/**
 * 默认重试判断：仅对特定错误重试
 */
function defaultShouldRetry(error) {
  // 取消请求不重试
  if (axios.isCancel(error)) return false;

  // 4xx 客户端错误不重试（429 除外）
  if (error.response && error.response.status >= 400 && error.response.status < 500) {
    return error.response.status === 429; // 限流可以重试
  }

  // 5xx 服务器错误重试
  if (error.response && error.response.status >= 500) return true;

  // 网络错误重试
  if (!error.response) return true;

  // 超时重试
  if (error.code === 'ECONNABORTED') return true;

  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function del(url, config, retryOptions) {
  return withRetry(() => http.delete(url, config), retryOptions);
}

export { withRetry, get, post, put, del };
```

### 1.4 取消请求 (cancellation.js)

```javascript
import axios from 'axios';

/**
 * 请求取消管理器
 * 支持按组件/页面粒度管理取消
 */
class RequestManager {
  constructor() {
    // Map<groupId, Map<requestKey, CancelTokenSource>>
    this.groups = new Map();
  }

  /**
   * 获取或创建请求组
   */
  getGroup(groupId) {
    if (!this.groups.has(groupId)) {
      this.groups.set(groupId, new Map());
    }
    return this.groups.get(groupId);
  }

  /**
   * 注册请求（在发送前调用）
   */
  register(groupId, requestKey, source) {
    const group = this.getGroup(groupId);
    group.set(requestKey, source);
  }

  /**
   * 移除已完成的请求
   */
  remove(groupId, requestKey) {
    const group = this.groups.get(groupId);
    if (group) {
      group.delete(requestKey);
      if (group.size === 0) {
        this.groups.delete(groupId);
      }
    }
  }

  /**
   * 取消指定组的所有请求
   */
  cancelGroup(groupId) {
    const group = this.groups.get(groupId);
    if (group) {
      group.forEach((source, key) => {
        source.cancel(`Group "${groupId}" cancelled: ${key}`);
      });
      this.groups.delete(groupId);
    }
  }

  /**
   * 取消所有请求
   */
  cancelAll() {
    this.groups.forEach((group, groupId) => {
      this.cancelGroup(groupId);
    });
  }

  /**
   * 创建带组管理的 CancelToken
   */
  createToken(groupId, requestKey) {
    const source = axios.CancelToken.source();
    this.register(groupId, requestKey, source);
    return source.token;
  }
}

// 全局单例
const requestManager = new RequestManager();

// ============ 在 Vue/React 中使用 ============

// --- Vue 3 组合式函数 ---
/*
import { onUnmounted } from 'vue';
import { requestManager } from './cancellation';

export function useRequest(groupId) {
  const id = groupId || `component_${Date.now()}`;

  onUnmounted(() => {
    // 组件卸载时自动取消该组所有请求
    requestManager.cancelGroup(id);
  });

  function request(config) {
    const requestKey = `${config.method}:${config.url}`;
    return http({
      ...config,
      cancelToken: requestManager.createToken(id, requestKey),
    }).finally(() => {
      requestManager.remove(id, requestKey);
    });
  }

  return { request, cancelAll: () => requestManager.cancelGroup(id) };
}
*/

// --- React Hook ---
/*
import { useEffect, useRef, useCallback } from 'react';
import { requestManager } from './cancellation';

export function useRequest(groupId) {
  const idRef = useRef(groupId || `component_${Date.now()}_${Math.random()}`);
  const id = idRef.current;

  useEffect(() => {
    // 清理：组件卸载时取消所有请求
    return () => {
      requestManager.cancelGroup(id);
    };
  }, [id]);

  const request = useCallback(
    (config) => {
      const requestKey = `${config.method}:${config.url}`;
      return http({
        ...config,
        cancelToken: requestManager.createToken(id, requestKey),
      }).finally(() => {
        requestManager.remove(id, requestKey);
      });
    },
    [id]
  );

  const cancelAll = useCallback(() => {
    requestManager.cancelGroup(id);
  }, [id]);

  return { request, cancelAll };
}
*/

export { RequestManager, requestManager };
```

---

## 二、基于原生 Fetch 的网络层

### 2.1 Fetch 封装 (fetch-layer.js)

```javascript
import { BusinessError, NetworkError, TimeoutError } from './errors';

/**
 * 原生 Fetch 完整封装
 * 支持：超时、重试、拦截器、取消、类型安全
 */

// ============ 拦截器系统 ============
class InterceptorManager {
  constructor() {
    this.handlers = [];
  }

  use(onFulfilled, onRejected) {
    this.handlers.push({ onFulfilled, onRejected });
    return () => this.eject(this.handlers.length - 1);
  }

  eject(index) {
    if (this.handlers[index]) {
      this.handlers[index] = null;
    }
  }

  async execute(promise) {
    let chain = [
      { onFulfilled: (res) => res, onRejected: (err) => Promise.reject(err) },
    ];

    // 请求拦截器（正序）
    this.handlers.forEach((h) => {
      if (h) chain.push(h);
    });

    // 执行链
    chain.push({
      onFulfilled: (config) => fetchWithConfig(config),
      onRejected: null,
    });

    // 响应拦截器（倒序插入到 chain 尾部）
    // 已在上面统一处理

    let result = promise;
    while (chain.length) {
      const { onFulfilled, onRejected } = chain.shift();
      result = result.then(onFulfilled, onRejected);
    }
    return result;
  }
}

async function fetchWithConfig(config) {
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
    ? combineSignals(signal, controller.signal)
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

function combineSignals(...signals) {
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

// ============ Fetch 网络层 ============
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

  // 请求方法
  async request(config) {
    const mergedConfig = { ...this.defaults, ...config };
    const url = this.resolveURL(mergedConfig.url);

    // 请求拦截器
    let requestPromise = Promise.resolve({ ...mergedConfig, url });
    for (const handler of this.interceptors.request.handlers) {
      if (handler?.onFulfilled) {
        requestPromise = requestPromise.then(handler.onFulfilled);
      }
    }

    // 重试逻辑
    let lastError;
    const maxRetries = mergedConfig.maxRetries ?? this.defaults.maxRetries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const finalConfig = await requestPromise;

        // Fetch 请求
        const response = await fetchWithConfig(finalConfig);

        // 响应拦截器
        let responsePromise = Promise.resolve(response);
        for (const handler of this.interceptors.response.handlers) {
          if (handler?.onFulfilled) {
            responsePromise = responsePromise.then(handler.onFulfilled);
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

        // 4xx 不重试
        if (error instanceof BusinessError) throw error;

        if (attempt < maxRetries) {
          const delay = mergedConfig.retryDelay * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw lastError;
  }

  get(url, config) { return this.request({ ...config, url, method: 'GET' }); }
  post(url, data, config) { return this.request({ ...config, url, method: 'POST', body: data }); }
  put(url, data, config) { return this.request({ ...config, url, method: 'PUT', body: data }); }
  delete(url, config) { return this.request({ ...config, url, method: 'DELETE' }); }
  patch(url, data, config) { return this.request({ ...config, url, method: 'PATCH', body: data }); }

  resolveURL(url) {
    if (url.startsWith('http')) return url;
    return this.baseURL + (this.baseURL.endsWith('/') ? '' : '/') + url;
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
  config.headers['X-Request-ID'] = generateId();
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

export { FetchClient, InterceptorManager };
```

---

## 三、API 层封装示例 (api/user.js)

```javascript
import http from '../utils/network';
import { withRetry } from '../utils/retry';

// ============ 用户相关 API ============

/**
 * 获取用户列表
 * @param {Object} params - 查询参数
 * @param {number} params.page - 页码
 * @param {number} params.pageSize - 每页数量
 * @param {string} params.keyword - 搜索关键词
 */
export function getUserList(params) {
  return http.get('/users', { params });
}

/**
 * 获取用户详情（带重试）
 */
export function getUserDetail(id) {
  return withRetry(
    () => http.get(`/users/${id}`),
    { maxRetries: 2, delay: 500 }
  );
}

/**
 * 创建用户
 */
export function createUser(data) {
  return http.post('/users', data);
}

/**
 * 更新用户
 */
export function updateUser(id, data) {
  return http.put(`/users/${id}`, data);
}

/**
 * 删除用户
 */
export function deleteUser(id) {
  return http.delete(`/users/${id}`);
}

/**
 * 上传头像（FormData，不重试）
 */
export function uploadAvatar(file) {
  const formData = new FormData();
  formData.append('avatar', file);
  return http.post('/users/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000, // 上传超时更长
  });
}

/**
 * 批量操作
 */
export function batchDeleteUsers(ids) {
  return http.post('/users/batch-delete', { ids });
}
```

---

## 四、Vue 3 组合式使用示例

```vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { getUserList, getUserDetail } from '@/api/user';
import { requestManager } from '@/utils/cancellation';

const users = ref([]);
const loading = ref(false);
const error = ref(null);

const groupId = 'user-list-page';

async function fetchUsers(page = 1) {
  loading.value = true;
  error.value = null;

  try {
    const requestKey = `GET:/users:${page}`;
    const data = await http({
      method: 'get',
      url: '/users',
      params: { page },
      cancelToken: requestManager.createToken(groupId, requestKey),
    }).finally(() => {
      requestManager.remove(groupId, requestKey);
    });
    users.value = data;
  } catch (err) {
    if (err.name !== 'CancelledError') {
      error.value = err.message;
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => fetchUsers());

// 组件卸载时自动取消所有未完成的请求
onUnmounted(() => {
  requestManager.cancelGroup(groupId);
});
</script>

<template>
  <div>
    <button @click="fetchUsers(1)">刷新</button>
    <div v-if="loading">加载中...</div>
    <div v-if="error" class="error">{{ error }}</div>
    <ul v-else>
      <li v-for="user in users" :key="user.id">{{ user.name }}</li>
    </ul>
  </div>
</template>
```

---

## 五、关键设计要点总结

| 特性 | 实现方式 | 关键点 |
|------|----------|--------|
| **请求拦截器** | Axios interceptors.request | Token 注入、请求 ID、重复请求取消 |
| **响应拦截器** | Axios interceptors.response | 统一解包、错误分类处理 |
| **401 自动刷新** | 队列 + 单例刷新 | 防止并发刷新、排队重试 |
| **重试机制** | 指数退避 + Jitter | 仅对可重试错误重试、避免雪崩 |
| **取消请求** | CancelToken / AbortController | 组件卸载自动取消、按组管理 |
| **超时控制** | timeout 配置 / setTimeout | 区分超时和其他网络错误 |
| **错误分类** | 自定义 Error 类 | BusinessError / NetworkError / TimeoutError |
| **请求追踪** | X-Request-ID | 全链路日志、方便排查 |

---

## 六、Fetch vs Axios 对比

| 维度 | Axios | Fetch |
|------|-------|-------|
| API 友好度 | 高（自动 JSON 转换） | 中（需手动处理） |
| 拦截器 | 内置 | 需自行封装 |
| 取消请求 | CancelToken | AbortController（原生） |
| 进度监听 | 支持 | 需 ReadableStream |
| 浏览器兼容 | 好 | IE 不支持 |
| 体积 | ~13KB | 0（原生） |
| SSR 支持 | 好（Node adapter） | Node 18+ 原生支持 |
| 重试 | 需自行实现 | 需自行实现 |

**建议**：中大型项目推荐 Axios（生态成熟）；轻量项目或现代环境可用 Fetch + 封装层。
