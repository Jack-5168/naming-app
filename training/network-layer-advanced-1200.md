# 网络层高级专项训练 (12:00)

> 基于 4/24 基础网络层，本次聚焦生产级模式、边界场景、高级架构

---

## 目录

1. [生产级 Fetch 封装（零依赖）](#1-生产级-fetch-封装零依赖)
2. [Axios 高级拦截器模式](#2-axios-高级拦截器模式)
3. [重试机制进阶（多策略）](#3-重试机制进阶多策略)
4. [取消请求模式大全](#4-取消请求模式大全)
5. [请求去重与合并](#5-请求去重与合并)
6. [离线优先架构](#6-离线优先架构)
7. [请求监控与可观测性](#7-请求监控与可观测性)
8. [TypeScript 类型体操](#8-typescript-类型体操)
9. [综合实战：完整 API SDK](#9-综合实战完整-api-sdk)
10. [面试高频题](#10-面试高频题)

---

## 1. 生产级 Fetch 封装（零依赖）

### 1.1 为什么需要封装 Fetch？

原生 Fetch 的 8 大缺陷：

```typescript
// ❌ 缺陷 1: 4xx/5xx 不会 reject
fetch('/api/404').then(res => {
  // 不会进入 catch，即使返回 404
  console.log(res.ok); // false，但 promise 已经 resolved
});

// ❌ 缺陷 2: 不支持超时
fetch('/api/slow'); // 可能永远挂起

// ❌ 缺陷 3: 不支持重试
// 需要手动写循环

// ❌ 缺陷 4: 不支持拦截器
// 每个请求都要手动加 token

// ❌ 缺陷 5: 不支持请求/响应转换
// 需要手动 JSON.stringify / response.json()

// ❌ 缺陷 6: 取消请求需要 AbortController
// 每个请求都要创建 controller

// ❌ 缺陷 7: 不支持进度事件
// 上传/下载大文件无法显示进度

// ❌ 缺陷 8: 错误信息不够丰富
// 网络错误只给 TypeError，没有状态码
```

### 1.2 完整实现

```typescript
// ==================== 类型定义 ====================

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

interface FetchRequestConfig {
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string | number | boolean>;
  timeout?: number;
  retries?: number;
  retryDelay?: number | 'exponential';
  retryOn?: number[] | ((error: HttpError) => boolean);
  signal?: AbortSignal;
  onDownloadProgress?: (progress: ProgressEvent) => void;
  onUploadProgress?: (progress: ProgressEvent) => void;
  transformRequest?: (data: any) => any;
  transformResponse?: (data: any) => any;
  validateStatus?: (status: number) => boolean;
  metadata?: Record<string, any>;
}

interface FetchResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  config: FetchRequestConfig;
  duration: number;
}

class HttpError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: any,
    public config?: FetchRequestConfig,
    public isTimeout = false,
    public isAbort = false,
    public isNetworkError = false
  ) {
    const message = isTimeout
      ? `Request timeout after ${config?.timeout}ms`
      : isAbort
        ? `Request cancelled: ${data}`
        : isNetworkError
          ? 'Network error - check your connection'
          : `HTTP ${status}: ${statusText}`;
    super(message);
    this.name = 'HttpError';
  }
}

// ==================== 核心类 ====================

class FetchClient {
  private baseURL: string;
  private defaults: Required<Pick<FetchRequestConfig, 'timeout' | 'retries' | 'retryDelay' | 'validateStatus'>>;
  private requestInterceptors: Array<(config: FetchRequestConfig) => FetchRequestConfig | Promise<FetchRequestConfig>> = [];
  private responseInterceptors: Array<(response: FetchResponse) => FetchResponse | Promise<FetchResponse>> = [];
  private errorInterceptors: Array<(error: HttpError) => never | Promise<never>> = [];
  private pendingRequests: Map<string, Promise<any>> = new Map();

  constructor(baseURL: string, defaults?: Partial<typeof this.defaults>) {
    this.baseURL = baseURL.replace(/\/+$/, '');
    this.defaults = {
      timeout: defaults?.timeout ?? 30000,
      retries: defaults?.retries ?? 0,
      retryDelay: defaults?.retryDelay ?? 'exponential',
      validateStatus: defaults?.validateStatus ?? ((status: number) => status >= 200 && status < 300),
    };
  }

  // ==================== 拦截器 ====================

  useRequest(fn: (config: FetchRequestConfig) => FetchRequestConfig | Promise<FetchRequestConfig>): void {
    this.requestInterceptors.push(fn);
  }

  useResponse(fn: (response: FetchResponse) => FetchResponse | Promise<FetchResponse>): void {
    this.responseInterceptors.push(fn);
  }

  useError(fn: (error: HttpError) => never | Promise<never>): void {
    this.errorInterceptors.push(fn);
  }

  // ==================== 核心请求 ====================

  async request<T = any>(config: FetchRequestConfig): Promise<FetchResponse<T>> {
    const startTime = performance.now();

    // 1. 合并默认配置
    let processedConfig: FetchRequestConfig = {
      method: 'GET',
      timeout: this.defaults.timeout,
      retries: this.defaults.retries,
      retryDelay: this.defaults.retryDelay,
      validateStatus: this.defaults.validateStatus,
      ...config,
      headers: { ...config.headers },
    };

    // 2. 执行请求拦截器
    for (const interceptor of this.requestInterceptors) {
      processedConfig = await interceptor(processedConfig);
    }

    // 3. 构建完整 URL
    const fullUrl = this.buildURL(processedConfig);

    // 4. 构建 fetch options
    const fetchOptions = this.buildFetchOptions(processedConfig);

    // 5. 执行请求（带重试）
    let lastError: HttpError | null = null;
    const maxAttempts = (processedConfig.retries ?? 0) + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.executeFetch(fullUrl, fetchOptions, processedConfig);
        const duration = performance.now() - startTime;
        response.duration = duration;

        // 6. 执行响应拦截器
        let finalResponse = response;
        for (const interceptor of this.responseInterceptors) {
          finalResponse = await interceptor(finalResponse) as FetchResponse<T>;
        }

        return finalResponse;
      } catch (error) {
        lastError = error as HttpError;

        // 判断是否应该重试
        if (attempt < maxAttempts && this.shouldRetry(lastError, processedConfig)) {
          const delay = this.calculateRetryDelay(attempt, processedConfig.retryDelay!);
          await this.sleep(delay);
          continue;
        }

        break;
      }
    }

    // 7. 执行错误拦截器
    for (const interceptor of this.errorInterceptors) {
      await interceptor(lastError!);
    }

    throw lastError!;
  }

  // ==================== 底层 fetch 执行 ====================

  private async executeFetch(
    url: string,
    options: RequestInit,
    config: FetchRequestConfig
  ): Promise<FetchResponse> {
    // 创建 AbortController（如果未提供 signal）
    const controller = options.signal ? null : new AbortController();
    const signal = options.signal || controller?.signal;

    // 超时控制
    const timeoutId = setTimeout(() => {
      controller?.abort(`Timeout after ${config.timeout}ms`);
    }, config.timeout!);

    try {
      const response = await fetch(url, { ...options, signal });
      clearTimeout(timeoutId);

      // 检查状态码
      if (!config.validateStatus!(response.status)) {
        const data = await this.parseResponseData(response);
        throw new HttpError(
          response.status,
          response.statusText,
          data,
          config,
          false,
          false,
          false
        );
      }

      const data = await this.parseResponseData(response);

      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        config,
        duration: 0, // 会在外层设置
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof HttpError) throw error;

      // 区分超时和取消
      if (error instanceof DOMException && error.name === 'AbortError') {
        const message = error.message || '';
        if (message.includes('Timeout')) {
          throw new HttpError(0, 'Timeout', config.body, config, true, false, false);
        }
        throw new HttpError(0, 'Cancelled', message, config, false, true, false);
      }

      // 网络错误
      throw new HttpError(0, 'Network Error', undefined, config, false, false, true);
    }
  }

  // ==================== 辅助方法 ====================

  private buildURL(config: FetchRequestConfig): string {
    let url = config.url.startsWith('http') ? config.url : `${this.baseURL}${config.url}`;

    if (config.params) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(config.params)) {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      }
      const queryString = params.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }

    return url;
  }

  private buildFetchOptions(config: FetchRequestConfig): RequestInit {
    const options: RequestInit = {
      method: config.method,
      headers: { ...config.headers },
      signal: config.signal,
    };

    // 处理 body
    if (config.body && !['GET', 'HEAD'].includes(config.method!)) {
      let body = config.body;

      // 请求转换
      if (config.transformRequest) {
        body = config.transformRequest(body);
      }

      if (body instanceof FormData || body instanceof URLSearchParams || body instanceof Blob) {
        options.body = body;
        // 删除 Content-Type，让浏览器自动设置（包含 boundary）
        delete (options.headers as Record<string, string>)['Content-Type'];
      } else if (typeof body === 'object') {
        options.body = JSON.stringify(body);
        (options.headers as Record<string, string>)['Content-Type'] = 'application/json';
      } else {
        options.body = body;
      }
    }

    return options;
  }

  private async parseResponseData(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      return response.json();
    }
    if (contentType.includes('text/') || contentType.includes('application/xml')) {
      return response.text();
    }
    if (contentType.includes('application/octet-stream')) {
      return response.blob();
    }
    // 默认尝试 JSON，失败则返回 text
    try {
      return await response.json();
    } catch {
      return response.text();
    }
  }

  private shouldRetry(error: HttpError, config: FetchRequestConfig): boolean {
    // 取消和超时不重试
    if (error.isAbort) return false;

    // 自定义重试条件
    if (typeof config.retryOn === 'function') {
      return config.retryOn(error);
    }

    // 指定状态码重试
    if (Array.isArray(config.retryOn)) {
      return config.retryOn.includes(error.status);
    }

    // 默认：重试 5xx 和超时
    return error.status >= 500 || error.isTimeout || error.isNetworkError;
  }

  private calculateRetryDelay(attempt: number, strategy: number | 'exponential'): number {
    if (typeof strategy === 'number') {
      return strategy;
    }
    // 指数退避 + 随机抖动
    const base = 1000;
    const exponential = base * Math.pow(2, attempt - 1);
    const jitter = Math.random() * base * 0.5;
    return exponential + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== 便捷方法 ====================

  get<T>(url: string, config?: Omit<Partial<FetchRequestConfig>, 'method' | 'url'>): Promise<FetchResponse<T>> {
    return this.request<T>({ ...config, url, method: 'GET' });
  }

  post<T>(url: string, body?: any, config?: Omit<Partial<FetchRequestConfig>, 'method' | 'url' | 'body'>): Promise<FetchResponse<T>> {
    return this.request<T>({ ...config, url, method: 'POST', body });
  }

  put<T>(url: string, body?: any, config?: Omit<Partial<FetchRequestConfig>, 'method' | 'url' | 'body'>): Promise<FetchResponse<T>> {
    return this.request<T>({ ...config, url, method: 'PUT', body });
  }

  patch<T>(url: string, body?: any, config?: Omit<Partial<FetchRequestConfig>, 'method' | 'url' | 'body'>): Promise<FetchResponse<T>> {
    return this.request<T>({ ...config, url, method: 'PATCH', body });
  }

  delete<T>(url: string, config?: Omit<Partial<FetchRequestConfig>, 'method' | 'url'>): Promise<FetchResponse<T>> {
    return this.request<T>({ ...config, url, method: 'DELETE' });
  }
}
```

### 1.3 使用示例

```typescript
// 创建客户端
const http = new FetchClient('https://api.example.com', {
  timeout: 15000,
  retries: 2,
  retryDelay: 'exponential',
});

// 认证拦截器
http.useRequest((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
  }
  return config;
});

// 日志拦截器
http.useRequest((config) => {
  config.metadata = { startTime: Date.now() };
  console.log(`→ ${config.method} ${config.url}`);
  return config;
});

http.useResponse((response) => {
  console.log(`← ${response.status} ${response.config.url} (${response.duration.toFixed(0)}ms)`);
  return response;
});

// 错误处理拦截器
http.useError((error) => {
  if (error.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
  } else if (error.isTimeout) {
    console.error('请求超时，请检查网络');
  } else if (error.isNetworkError) {
    console.error('网络错误，请检查连接');
  }
  throw error;
});

// 发送请求
const { data } = await http.get<User[]>('/users', {
  params: { page: '1', limit: '10' },
  retries: 3,
});

// 自定义重试条件
const { data: unstable } = await http.get('/flaky-api', {
  retries: 5,
  retryOn: (error) => error.status === 429 || error.status >= 500,
});

// 取消请求
const controller = new AbortController();
http.get('/data', { signal: controller.signal });
controller.abort('User cancelled');
```

---

## 2. Axios 高级拦截器模式

### 2.1 Token 自动刷新（生产级实现）

```typescript
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';

/**
 * 生产级 Token 刷新拦截器
 * 核心难点：
 * 1. 并发请求的排队处理
 * 2. 刷新失败后的级联处理
 * 3. 防止重复刷新
 * 4. 刷新期间的请求队列管理
 */
class TokenRefreshManager {
  private isRefreshing = false;
  private refreshPromise: Promise<string> | null = null;
  private queue: Array<{
    resolve: (token: string) => void;
    reject: (error: any) => void;
  }> = [];

  constructor(
    private axiosInstance: AxiosInstance,
    private refreshFn: () => Promise<string>,
    private onTokenReceived: (token: string) => void,
    private onRefreshFailed: () => void
  ) {}

  /**
   * 获取新的 Token（带并发控制）
   */
  async getNewToken(): Promise<string> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshPromise = this.refreshFn()
        .then((token) => {
          this.onTokenReceived(token);
          this.flushQueue(null, token);
          return token;
        })
        .catch((error) => {
          this.flushQueue(error, null);
          this.onRefreshFailed();
          throw error;
        })
        .finally(() => {
          this.isRefreshing = false;
          this.refreshPromise = null;
        });
    }

    return this.refreshPromise;
  }

  /**
   * 将请求加入队列
   */
  enqueue(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });
    });
  }

  /**
   * 刷新队列
   */
  private flushQueue(error: any, token: string | null): void {
    this.queue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error);
      } else {
        resolve(token!);
      }
    });
    this.queue = [];
  }

  /**
   * 创建 Axios 响应拦截器
   */
  createInterceptor() {
    return async (error: AxiosError): Promise<any> => {
      const config = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      // 只处理 401 且未重试过的请求
      if (error.response?.status !== 401 || !config || config._retry) {
        return Promise.reject(error);
      }

      config._retry = true;

      try {
        let token: string;

        if (this.isRefreshing) {
          // 正在刷新，等待
          token = await this.enqueue();
        } else {
          // 触发刷新
          token = await this.getNewToken();
        }

        // 更新请求的 Token
        config.headers.Authorization = `Bearer ${token}`;

        // 重试原请求
        return this.axiosInstance(config);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    };
  }
}

// 使用示例
const api = axios.create({ baseURL: 'https://api.example.com' });

const tokenManager = new TokenRefreshManager(
  api,
  async () => {
    const res = await axios.post('/auth/refresh', {
      refreshToken: localStorage.getItem('refreshToken'),
    });
    return res.data.accessToken;
  },
  (token) => {
    localStorage.setItem('accessToken', token);
  },
  () => {
    localStorage.clear();
    window.location.href = '/login';
  }
);

api.interceptors.response.use(
  (response) => response,
  tokenManager.createInterceptor()
);
```

### 2.2 请求级联拦截器（Pipeline 模式）

```typescript
/**
 * 拦截器管道模式
 * 将多个拦截器组合成一个处理管道
 * 支持同步/异步混合、错误冒泡、短路退出
 */
class InterceptorPipeline {
  private stages: Array<{
    name: string;
    request?: (config: any) => any | Promise<any>;
    response?: (response: any) => any | Promise<any>;
    error?: (error: any) => any | Promise<any>;
    priority: number;
  }> = [];

  addStage(options: {
    name: string;
    request?: (config: any) => any | Promise<any>;
    response?: (response: any) => any | Promise<any>;
    error?: (error: any) => any | Promise<any>;
    priority?: number;
  }): void {
    this.stages.push({ priority: options.priority ?? 100, ...options });
    // 按优先级排序
    this.stages.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 执行请求管道
   */
  async executeRequest(config: any): Promise<any> {
    let current = { ...config };

    for (const stage of this.stages) {
      if (stage.request) {
        try {
          current = await stage.request(current);
          if (current === null || current === undefined) {
            // 短路：拦截器返回 null 表示取消请求
            throw new Error(`Request cancelled by interceptor: ${stage.name}`);
          }
        } catch (error) {
          throw error;
        }
      }
    }

    return current;
  }

  /**
   * 执行响应管道
   */
  async executeResponse(response: any): Promise<any> {
    let current = response;

    for (let i = this.stages.length - 1; i >= 0; i--) {
      const stage = this.stages[i];
      if (stage.response) {
        current = await stage.response(current);
      }
    }

    return current;
  }

  /**
   * 执行错误管道
   */
  async executeError(error: any): Promise<never> {
    let current = error;

    for (let i = this.stages.length - 1; i >= 0; i--) {
      const stage = this.stages[i];
      if (stage.error) {
        current = await stage.error(current);
      }
    }

    throw current;
  }
}

// 使用示例
const pipeline = new InterceptorPipeline();

// 添加认证阶段（优先级最高）
pipeline.addStage({
  name: 'auth',
  priority: 10,
  request: (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
});

// 添加日志阶段
pipeline.addStage({
  name: 'logger',
  priority: 50,
  request: (config) => {
    config._startTime = Date.now();
    console.log(`[Pipeline] → ${config.method} ${config.url}`);
    return config;
  },
  response: (response) => {
    const duration = Date.now() - (response.config._startTime || 0);
    console.log(`[Pipeline] ← ${response.status} (${duration}ms)`);
    return response;
  },
});

// 添加错误处理阶段
pipeline.addStage({
  name: 'errorHandler',
  priority: 90,
  error: async (error) => {
    if (error.response?.status === 401) {
      // 跳转登录
      window.location.href = '/login';
    }
    throw error;
  },
});

// 挂载到 Axios
api.interceptors.request.use(
  (config) => pipeline.executeRequest(config),
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => pipeline.executeResponse(response),
  (error) => pipeline.executeError(error)
);
```

### 2.3 条件拦截器

```typescript
/**
 * 条件拦截器工厂
 * 根据请求特征动态决定是否执行拦截逻辑
 */
function when(predicate: (config: any) => boolean, interceptor: (config: any) => any) {
  return (config: any) => {
    if (predicate(config)) {
      return interceptor(config);
    }
    return config;
  };
}

// 使用示例
api.interceptors.request.use(
  when(
    // 只对 /api/admin 开头的请求添加管理员工具
    (config) => config.url?.startsWith('/api/admin'),
    (config) => {
      config.headers['X-Admin-Token'] = localStorage.getItem('adminToken');
      return config;
    }
  )
);

api.interceptors.request.use(
  when(
    // 只对 POST/PUT/DELETE 请求添加防 CSRF token
    (config) => ['POST', 'PUT', 'DELETE'].includes(config.method?.toUpperCase()),
    (config) => {
      config.headers['X-CSRF-Token'] = getCSRFToken();
      return config;
    }
  )
);

api.interceptors.response.use(
  null,
  when(
    // 只对 4xx 错误显示 toast，5xx 显示全局错误页
    (error) => error.response?.status >= 400 && error.response?.status < 500,
    (error) => {
      showToast(`请求失败: ${error.response?.status}`);
      throw error;
    }
  )
);
```

---

## 3. 重试机制进阶（多策略）

### 3.1 四种重试策略

```typescript
type RetryStrategy = 'none' | 'fixed' | 'exponential' | 'adaptive';

interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试策略 */
  strategy: RetryStrategy;
  /** 基础延迟（ms） */
  baseDelay: number;
  /** 最大延迟（ms，防止指数退避无限增长） */
  maxDelay: number;
  /** 是否添加随机抖动 */
  jitter: boolean;
  /** 重试条件函数 */
  shouldRetry: (error: HttpError, attempt: number) => boolean;
  /** 重试前的回调 */
  onRetry?: (error: HttpError, attempt: number, delay: number) => void;
}

/**
 * 高级重试管理器
 * 支持 4 种策略 + 自适应退避
 */
class AdvancedRetryManager {
  private retryHistory: Map<string, number[]> = new Map();

  /**
   * 计算重试延迟
   */
  calculateDelay(attempt: number, config: RetryConfig, error?: HttpError): number {
    let delay: number;

    switch (config.strategy) {
      case 'fixed':
        delay = config.baseDelay;
        break;

      case 'exponential':
        delay = config.baseDelay * Math.pow(2, attempt - 1);
        break;

      case 'adaptive':
        // 根据错误类型动态调整
        if (error?.status === 429) {
          // 速率限制：使用 Retry-After 或更长延迟
          delay = config.baseDelay * 3;
        } else if (error?.status === 503) {
          // 服务不可用：更长延迟
          delay = config.baseDelay * 2;
        } else {
          // 其他错误：指数退避
          delay = config.baseDelay * Math.pow(1.5, attempt - 1);
        }
        break;

      case 'none':
      default:
        delay = 0;
        break;
    }

    // 限制最大延迟
    delay = Math.min(delay, config.maxDelay);

    // 添加随机抖动
    if (config.jitter) {
      const jitterRange = delay * 0.3;
      delay += (Math.random() - 0.5) * jitterRange;
    }

    return Math.max(0, Math.round(delay));
  }

  /**
   * 执行带重试的请求
   */
  async execute<T>(
    requestFn: () => Promise<T>,
    config: RetryConfig,
    requestKey?: string
  ): Promise<T> {
    let lastError: HttpError | null = null;

    for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
      try {
        const result = await requestFn();

        // 记录成功
        if (requestKey) {
          this.retryHistory.delete(requestKey);
        }

        return result;
      } catch (error) {
        lastError = error as HttpError;

        // 检查是否应该重试
        if (attempt > config.maxRetries || !config.shouldRetry(lastError, attempt)) {
          break;
        }

        // 计算延迟
        const delay = this.calculateDelay(attempt, config, lastError);

        // 回调
        config.onRetry?.(lastError, attempt, delay);

        // 记录重试
        if (requestKey) {
          const history = this.retryHistory.get(requestKey) || [];
          history.push(attempt);
          this.retryHistory.set(requestKey, history);
        }

        // 等待
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * 获取请求的重试历史
   */
  getRetryHistory(key: string): number[] {
    return this.retryHistory.get(key) || [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ==================== 预配置策略 ====================

const RetryPresets = {
  /** 不重试 */
  none: { maxRetries: 0, strategy: 'none' as const, baseDelay: 0, maxDelay: 0, jitter: false },

  /** 快速重试（适合临时网络波动） */
  quick: {
    maxRetries: 2,
    strategy: 'fixed' as const,
    baseDelay: 500,
    maxDelay: 2000,
    jitter: true,
    shouldRetry: (error: HttpError) => error.status === 429 || error.status >= 500,
  },

  /** 标准重试（适合大多数场景） */
  standard: {
    maxRetries: 3,
    strategy: 'exponential' as const,
    baseDelay: 1000,
    maxDelay: 10000,
    jitter: true,
    shouldRetry: (error: HttpError) => error.status >= 500 || error.isTimeout,
  },

  /** 激进重试（适合关键请求） */
  aggressive: {
    maxRetries: 5,
    strategy: 'adaptive' as const,
    baseDelay: 1000,
    maxDelay: 30000,
    jitter: true,
    shouldRetry: (error: HttpError) =>
      error.status >= 500 || error.isTimeout || error.isNetworkError,
  },
};
```

### 3.2 带重试的 Fetch 客户端

```typescript
class RetryFetchClient extends FetchClient {
  private retryManager = new AdvancedRetryManager();

  async request<T = any>(config: FetchRequestConfig): Promise<FetchResponse<T>> {
    const retryConfig: RetryConfig = {
      maxRetries: config.retries ?? 0,
      strategy: 'exponential',
      baseDelay: typeof config.retryDelay === 'number' ? config.retryDelay : 1000,
      maxDelay: 30000,
      jitter: true,
      shouldRetry: (error, attempt) => {
        if (typeof config.retryOn === 'function') return config.retryOn(error);
        if (Array.isArray(config.retryOn)) return config.retryOn.includes(error.status);
        return error.status >= 500 || error.isTimeout;
      },
      onRetry: (error, attempt, delay) => {
        console.warn(`[Retry] Attempt ${attempt}/${config.retries} failed, retrying in ${delay}ms`, error.message);
      },
    };

    return this.retryManager.execute(
      () => super.request<T>(config),
      retryConfig,
      `${config.method}:${config.url}`
    );
  }
}
```

---

## 4. 取消请求模式大全

### 4.1 五种取消场景

```typescript
/**
 * 请求取消管理器
 * 统一管理所有取消场景
 */
class CancelManager {
  private controllers: Map<string, AbortController> = new Map();
  private globalController: AbortController | null = null;

  /**
   * 场景 1: 按 Key 取消
   * 适用于：相同 URL 的请求互斥
   */
  cancelByKey(key: string, reason = 'Cancelled by key'): boolean {
    const controller = this.controllers.get(key);
    if (controller) {
      controller.abort(reason);
      this.controllers.delete(key);
      return true;
    }
    return false;
  }

  /**
   * 场景 2: 按 URL 模式取消
   * 适用于：取消某个模块的所有请求
   */
  cancelByPattern(pattern: RegExp, reason = 'Cancelled by pattern'): number {
    let count = 0;
    for (const [key, controller] of this.controllers) {
      if (pattern.test(key)) {
        controller.abort(reason);
        this.controllers.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * 场景 3: 组件卸载时取消
   * 适用于：React/Vue 组件 unmount
   */
  createComponentScope(): {
    signal: AbortSignal;
    cancel: (reason?: string) => void;
    register: (key: string) => AbortSignal;
  } {
    const controller = new AbortController();
    const childControllers: AbortController[] = [];

    return {
      signal: controller.signal,
      cancel: (reason?: string) => {
        controller.abort(reason || 'Component unmounted');
        childControllers.forEach(c => c.abort(reason || 'Component unmounted'));
      },
      register: (key: string) => {
        const child = new AbortController();
        childControllers.push(child);
        this.controllers.set(key, child);

        // 父级取消时，子级也取消
        controller.signal.addEventListener('abort', () => {
          child.abort(controller.signal.reason);
        });

        return child.signal;
      },
    };
  }

  /**
   * 场景 4: 全局取消（页面跳转/退出）
   * 适用于：SPA 路由切换
   */
  cancelAll(reason = 'All requests cancelled'): number {
    let count = 0;
    for (const [key, controller] of this.controllers) {
      controller.abort(reason);
      this.controllers.delete(key);
      count++;
    }
    return count;
  }

  /**
   * 场景 5: 超时自动取消
   * 适用于：长时间无响应的请求
   */
  withAutoTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(`Auto-timeout after ${timeout}ms`), timeout);

    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new Error(controller.signal.reason as string));
        });
      }),
    ]).finally(() => clearTimeout(timer));
  }

  /**
   * 注册请求（返回 signal）
   */
  register(key: string): AbortSignal {
    // 取消同 key 的旧请求
    this.cancelByKey(key, 'Duplicate request cancelled');

    const controller = new AbortController();
    this.controllers.set(key, controller);
    return controller.signal;
  }

  /**
   * 注销请求
   */
  unregister(key: string): void {
    this.controllers.delete(key);
  }

  /**
   * 获取当前活跃请求数
   */
  get activeCount(): number {
    return this.controllers.size;
  }
}

// ==================== 使用示例 ====================

const cancelManager = new CancelManager();

// 场景 1: 搜索框（新输入取消旧请求）
function search(query: string) {
  const signal = cancelManager.register('search');
  return fetch(`/api/search?q=${query}`, { signal });
}

// 场景 2: 路由切换时取消所有 API 请求
router.beforeEach(() => {
  cancelManager.cancelByPattern(/^\/api\//, 'Route changed');
});

// 场景 3: React 组件
function UserList() {
  const scopeRef = useRef<ReturnType<typeof cancelManager.createComponentScope>>();

  useEffect(() => {
    scopeRef.current = cancelManager.createComponentScope();

    fetch('/api/users', { signal: scopeRef.current.signal })
      .then(res => res.json())
      .then(setUsers);

    return () => {
      scopeRef.current?.cancel('Component unmounted');
    };
  }, []);
}

// 场景 4: 页面离开
window.addEventListener('beforeunload', () => {
  cancelManager.cancelAll('Page leaving');
});
```

### 4.2 搜索框完整实现（防抖 + 取消 + 竞态处理）

```typescript
/**
 * 生产级搜索实现
 * 解决三个核心问题：
 * 1. 防抖：减少请求频率
 * 2. 取消：新搜索取消旧搜索
 * 3. 竞态：旧请求可能后返回，导致显示错误结果
 */
class SearchManager<T> {
  private debounceTimer: number | null = null;
  private currentRequestId = 0;
  private cancelController: AbortController | null = null;
  private onResults: (results: T[], query: string) => void;
  private searchFn: (query: string, signal?: AbortSignal) => Promise<T[]>;
  private debounceMs: number;

  constructor(options: {
    searchFn: (query: string, signal?: AbortSignal) => Promise<T[]>;
    onResults: (results: T[], query: string) => void;
    debounceMs?: number;
  }) {
    this.searchFn = options.searchFn;
    this.onResults = options.onResults;
    this.debounceMs = options.debounceMs ?? 300;
  }

  /**
   * 执行搜索
   */
  search(query: string): void {
    // 清空防抖定时器
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    // 取消上一个请求
    this.cancelController?.abort('New search started');

    // 递增请求 ID（解决竞态问题）
    this.currentRequestId++;
    const requestId = this.currentRequestId;

    // 空查询直接返回
    if (!query.trim()) {
      this.onResults([], query);
      return;
    }

    // 防抖
    this.debounceTimer = window.setTimeout(async () => {
      // 创建新的 AbortController
      this.cancelController = new AbortController();

      try {
        const results = await this.searchFn(query, this.cancelController.signal);

        // 竞态检查：只有最新的请求才更新 UI
        if (requestId === this.currentRequestId) {
          this.onResults(results, query);
        }
      } catch (error) {
        // 忽略取消错误
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        // 竞态检查
        if (requestId === this.currentRequestId) {
          this.onResults([], query);
        }
      }
    }, this.debounceMs);
  }

  /**
   * 销毁
   */
  destroy(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
    this.cancelController?.abort('Destroyed');
  }
}

// 使用示例
const searchManager = new SearchManager({
  searchFn: async (query: string, signal?: AbortSignal) => {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
    return res.json();
  },
  onResults: (results, query) => {
    console.log(`Results for "${query}":`, results);
    // 更新 UI
  },
  debounceMs: 300,
});

// 绑定到输入框
document.getElementById('search-input')?.addEventListener('input', (e) => {
  searchManager.search((e.target as HTMLInputElement).value);
});
```

---

## 5. 请求去重与合并

### 5.1 请求去重（Deduplication）

```typescript
/**
 * 请求去重器
 * 相同参数的 GET 请求只发一次，其他等待同一个结果
 */
class RequestDeduper {
  private pending: Map<string, Promise<any>> = new Map();
  private config: {
    /** 是否对 GET 请求自动去重 */
    autoDedupeGet: boolean;
    /** 自定义 key 生成函数 */
    keyGenerator?: (config: any) => string;
  };

  constructor(config?: Partial<RequestDeduper['config']>) {
    this.config = {
      autoDedupeGet: config?.autoDedupeGet ?? true,
      keyGenerator: config?.keyGenerator,
    };
  }

  /**
   * 生成请求 key
   */
  generateKey(config: any): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(config);
    }
    const { method = 'GET', url, params, data } = config;
    return `${method.toUpperCase()}:${url}:${JSON.stringify(params || {})}:${JSON.stringify(data || {})}`;
  }

  /**
   * 获取或创建请求
   */
  async execute<T>(config: any, requestFn: () => Promise<T>): Promise<T> {
    const key = this.generateKey(config);

    // 检查是否有相同请求正在进行
    const existing = this.pending.get(key);
    if (existing) {
      console.log(`[Dedupe] Reusing pending request: ${key}`);
      return existing as Promise<T>;
    }

    // 创建新请求
    const promise = requestFn()
      .then((result) => {
        this.pending.delete(key);
        return result;
      })
      .catch((error) => {
        this.pending.delete(key);
        throw error;
      });

    this.pending.set(key, promise);
    return promise;
  }

  /**
   * 清除缓存
   */
  clear(key?: string): void {
    if (key) {
      this.pending.delete(key);
    } else {
      this.pending.clear();
    }
  }

  get size(): number {
    return this.pending.size;
  }
}
```

### 5.2 请求合并（Batching）

```typescript
/**
 * 请求合并器
 * 在短时间内收集多个相同类型的请求，合并为一个批量请求
 *
 * 典型场景：
 * - 列表页中每个卡片需要加载用户信息
 * - 合并为: GET /api/users?ids=1,2,3,4,5
 * - 然后分发结果到各个调用方
 */
class RequestBatcher<T, R> {
  private batch: Array<{
    id: T;
    resolve: (value: R) => void;
    reject: (error: Error) => void;
  }> = [];
  private timer: number | null = null;
  private batchDelay: number;
  private batchFn: (ids: T[]) => Promise<Map<T, R>>;

  constructor(options: {
    batchFn: (ids: T[]) => Promise<Map<T, R>>;
    batchDelay?: number;
  }) {
    this.batchFn = options.batchFn;
    this.batchDelay = options.batchDelay ?? 10; // 默认 10ms 窗口
  }

  /**
   * 请求单个资源（自动合并）
   */
  request(id: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.batch.push({ id, resolve, reject });

      // 启动定时器
      if (this.timer === null) {
        this.timer = window.setTimeout(() => this.flush(), this.batchDelay);
      }
    });
  }

  /**
   * 执行批量请求
   */
  private async flush(): Promise<void> {
    if (this.batch.length === 0) return;

    const batch = this.batch;
    this.batch = [];
    this.timer = null;

    const ids = batch.map((item) => item.id);

    try {
      const results = await this.batchFn(ids);

      // 分发结果
      for (const item of batch) {
        const result = results.get(item.id);
        if (result !== undefined) {
          item.resolve(result);
        } else {
          item.reject(new Error(`No result for id: ${item.id}`));
        }
      }
    } catch (error) {
      // 全部拒绝
      for (const item of batch) {
        item.reject(error as Error);
      }
    }
  }

  /**
   * 立即执行（不等窗口）
   */
  flushNow(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.flush();
  }
}

// 使用示例
const userBatcher = new RequestBatcher<number, User>({
  batchFn: async (ids: number[]) => {
    const res = await fetch(`/api/users?ids=${ids.join(',')}`);
    const users: User[] = await res.json();
    const map = new Map<number, User>();
    users.forEach((user) => map.set(user.id, user));
    return map;
  },
  batchDelay: 10,
});

// 同时请求多个用户（会在 10ms 内合并为一个请求）
const [user1, user2, user3] = await Promise.all([
  userBatcher.request(1),
  userBatcher.request(2),
  userBatcher.request(3),
]);
```

### 5.3 请求缓存（带 TTL 和策略）

```typescript
type CacheStrategy = 'cache-first' | 'network-first' | 'stale-while-revalidate';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  etag?: string;
}

/**
 * 高级请求缓存
 * 支持多种策略 + ETag + 手动失效
 */
class RequestCache {
  private store: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number;

  constructor(defaultTTL = 5 * 60 * 1000) { // 默认 5 分钟
    this.defaultTTL = defaultTTL;
  }

  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    // 检查过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, ttl?: number, etag?: string): void {
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
      etag,
    });
  }

  /**
   * 删除缓存
   */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /**
   * 按模式删除
   */
  invalidateByPattern(pattern: RegExp): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (pattern.test(key)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * 清理过期缓存
   */
  cleanup(): number {
    let count = 0;
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now - entry.timestamp > entry.ttl) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * 清空
   */
  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

/**
 * 带缓存的请求包装器
 */
class CachedRequestClient {
  private cache: RequestCache;
  private client: FetchClient;

  constructor(client: FetchClient, cache?: RequestCache) {
    this.client = client;
    this.cache = cache || new RequestCache();
  }

  /**
   * 带缓存的请求
   */
  async requestWithCache<T>(
    config: FetchRequestConfig,
    strategy: CacheStrategy = 'cache-first',
    ttl?: number
  ): Promise<FetchResponse<T>> {
    const cacheKey = `${config.method}:${config.url}`;

    // 非 GET 请求直接请求
    if (config.method !== 'GET') {
      const response = await this.client.request<T>(config);
      // POST/PUT/DELETE 后清除相关缓存
      this.cache.invalidateByPattern(new RegExp(config.url.split('/').slice(0, -1).join('/')));
      return response;
    }

    switch (strategy) {
      case 'cache-first': {
        // 先查缓存
        const cached = this.cache.get<T>(cacheKey);
        if (cached !== null) {
          return {
            data: cached,
            status: 200,
            statusText: 'OK (cached)',
            headers: new Headers(),
            config,
            duration: 0,
          };
        }
        // 缓存未命中，请求网络
        const response = await this.client.request<T>(config);
        this.cache.set(cacheKey, response.data, ttl);
        return response;
      }

      case 'network-first': {
        try {
          const response = await this.client.request<T>(config);
          this.cache.set(cacheKey, response.data, ttl);
          return response;
        } catch (error) {
          // 网络失败，尝试返回缓存
          const cached = this.cache.get<T>(cacheKey);
          if (cached !== null) {
            return {
              data: cached,
              status: 200,
              statusText: 'OK (stale)',
              headers: new Headers(),
              config,
              duration: 0,
            };
          }
          throw error;
        }
      }

      case 'stale-while-revalidate': {
        const cached = this.cache.get<T>(cacheKey);
        if (cached !== null) {
          // 返回缓存的同时后台更新
          this.client.request<T>(config).then((response) => {
            this.cache.set(cacheKey, response.data, ttl);
          }).catch(() => {});
          return {
            data: cached,
            status: 200,
            statusText: 'OK (stale-while-revalidate)',
            headers: new Headers(),
            config,
            duration: 0,
          };
        }
        // 无缓存，正常请求
        const response = await this.client.request<T>(config);
        this.cache.set(cacheKey, response.data, ttl);
        return response;
      }
    }
  }
}
```

---

## 6. 离线优先架构

### 6.1 离线请求队列

```typescript
/**
 * 离线请求队列
 * 网络断开时缓存请求，恢复后自动重放
 */
class OfflineQueue {
  private queue: Array<{
    id: string;
    config: FetchRequestConfig;
    timestamp: number;
    retryCount: number;
    maxRetries: number;
  }> = [];
  private isOnline = navigator.onLine;
  private client: FetchClient;
  private storageKey: string;

  constructor(client: FetchClient, storageKey = 'offline-queue') {
    this.client = client;
    this.storageKey = storageKey;

    // 监听网络状态
    window.addEventListener('online', () => this.goOnline());
    window.addEventListener('offline', () => this.goOffline());

    // 恢复队列
    this.loadQueue();
  }

  /**
   * 添加离线请求
   */
  async enqueue(config: FetchRequestConfig, maxRetries = 3): Promise<string> {
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;

    const entry = {
      id,
      config,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries,
    };

    this.queue.push(entry);
    this.saveQueue();

    // 如果在线，立即执行
    if (this.isOnline) {
      this.processQueue();
    }

    return id;
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    if (!this.isOnline || this.queue.length === 0) return;

    const entry = this.queue[0];

    try {
      await this.client.request(entry.config);
      this.queue.shift();
      this.saveQueue();

      // 处理下一个
      this.processQueue();
    } catch (error) {
      entry.retryCount++;
      if (entry.retryCount >= entry.maxRetries) {
        // 超过最大重试，移除
        this.queue.shift();
        console.error(`Offline request ${entry.id} failed after ${entry.maxRetries} retries`);
      }
      this.saveQueue();
    }
  }

  private goOnline(): void {
    this.isOnline = true;
    console.log('[OfflineQueue] Back online, processing queue...');
    this.processQueue();
  }

  private goOffline(): void {
    this.isOnline = false;
    console.log('[OfflineQueue] Went offline, queueing requests...');
  }

  private saveQueue(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch {
      // Storage full, clear old entries
      this.queue = this.queue.slice(-10);
    }
  }

  private loadQueue(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.queue = JSON.parse(data);
        // 清理超过 24 小时的请求
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        this.queue = this.queue.filter((entry) => entry.timestamp > cutoff);
        this.saveQueue();
      }
    } catch {
      this.queue = [];
    }
  }

  get length(): number {
    return this.queue.length;
  }

  get isWorking(): boolean {
    return this.isOnline && this.queue.length > 0;
  }
}
```

### 6.2 Service Worker 拦截

```typescript
// sw.js - Service Worker 网络拦截
const CACHE_NAME = 'api-cache-v1';
const EXCLUDED_PATHS = ['/auth/logout', '/upload'];

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 只拦截 API 请求
  if (!request.url.includes('/api/')) return;

  // 排除特定路径
  if (EXCLUDED_PATHS.some((path) => request.url.includes(path))) return;

  // GET 请求：stale-while-revalidate
  if (request.method === 'GET') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request).then(async (response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
  }

  // 非 GET 请求：network-only（离线时由 OfflineQueue 处理）
});
```

---

## 7. 请求监控与可观测性

### 7.1 完整监控体系

```typescript
/**
 * 请求监控器
 * 提供完整的可观测性：指标 + 追踪 + 告警
 */
class RequestMonitor {
  private metrics: RequestMetrics;
  private traces: RequestTrace[] = [];
  private maxTraces = 1000;
  private alerts: Array<(alert: Alert) => void> = [];
  private thresholds: MonitorThresholds;

  constructor(thresholds?: Partial<MonitorThresholds>) {
    this.metrics = this.createEmptyMetrics();
    this.thresholds = {
      slowRequestMs: thresholds?.slowRequestMs ?? 3000,
      errorRatePercent: thresholds?.errorRatePercent ?? 10,
      maxConcurrent: thresholds?.maxConcurrent ?? 50,
      ...thresholds,
    };
  }

  /**
   * 记录请求开始
   */
  startRequest(config: FetchRequestConfig): RequestTrace {
    const trace: RequestTrace = {
      id: crypto.randomUUID?.() || `${Date.now()}`,
      method: config.method || 'GET',
      url: config.url,
      startTime: performance.now(),
      status: 'pending',
      metadata: config.metadata || {},
    };

    this.traces.push(trace);
    if (this.traces.length > this.maxTraces) {
      this.traces = this.traces.slice(-this.maxTraces);
    }

    this.metrics.activeRequests++;
    this.checkConcurrentThreshold();

    return trace;
  }

  /**
   * 记录请求成功
   */
  endSuccess(trace: RequestTrace, response: FetchResponse): void {
    const duration = performance.now() - trace.startTime;
    trace.endTime = performance.now();
    trace.duration = duration;
    trace.status = 'success';
    trace.statusCode = response.status;

    this.metrics.totalRequests++;
    this.metrics.successRequests++;
    this.metrics.activeRequests--;
    this.metrics.totalDuration += duration;

    // 记录状态码分布
    const statusGroup = Math.floor(response.status / 100);
    this.metrics.statusDistribution[statusGroup] =
      (this.metrics.statusDistribution[statusGroup] || 0) + 1;

    // 慢请求检测
    if (duration > this.thresholds.slowRequestMs) {
      this.metrics.slowRequests++;
      this.emitAlert({
        type: 'slow_request',
        message: `Slow request: ${trace.method} ${trace.url} took ${duration.toFixed(0)}ms`,
        severity: 'warning',
        trace,
      });
    }

    // 采样保存 trace
    if (Math.random() < 0.1) { // 10% 采样
      this.metrics.recentTraces.push(trace);
      if (this.metrics.recentTraces.length > 100) {
        this.metrics.recentTraces.shift();
      }
    }
  }

  /**
   * 记录请求失败
   */
  endError(trace: RequestTrace, error: HttpError): void {
    const duration = performance.now() - trace.startTime;
    trace.endTime = performance.now();
    trace.duration = duration;
    trace.status = 'error';
    trace.error = error.message;

    this.metrics.totalRequests++;
    this.metrics.failedRequests++;
    this.metrics.activeRequests--;
    this.metrics.totalDuration += duration;

    // 错误类型统计
    if (error.isTimeout) this.metrics.timeoutCount++;
    if (error.isNetworkError) this.metrics.networkErrorCount++;
    if (error.isAbort) this.metrics.abortCount++;
    if (error.status) {
      this.metrics.errorStatusDistribution[error.status] =
        (this.metrics.errorStatusDistribution[error.status] || 0) + 1;
    }

    // 错误率告警
    this.checkErrorRate();
  }

  /**
   * 获取指标
   */
  getMetrics(): RequestMetrics {
    return {
      ...this.metrics,
      avgResponseTime:
        this.metrics.totalRequests > 0
          ? this.metrics.totalDuration / this.metrics.totalRequests
          : 0,
      errorRate:
        this.metrics.totalRequests > 0
          ? (this.metrics.failedRequests / this.metrics.totalRequests) * 100
          : 0,
    };
  }

  /**
   * 获取追踪列表
   */
  getTraces(filter?: { status?: string; url?: string; minDuration?: number }): RequestTrace[] {
    let result = this.traces;

    if (filter?.status) {
      result = result.filter((t) => t.status === filter.status);
    }
    if (filter?.url) {
      result = result.filter((t) => t.url.includes(filter.url!));
    }
    if (filter?.minDuration) {
      result = result.filter((t) => (t.duration || 0) >= filter.minDuration!);
    }

    return result;
  }

  /**
   * 添加告警回调
   */
  onAlert(callback: (alert: Alert) => void): void {
    this.alerts.push(callback);
  }

  /**
   * 重置指标
   */
  reset(): void {
    this.metrics = this.createEmptyMetrics();
    this.traces = [];
  }

  // ==================== 私有方法 ====================

  private createEmptyMetrics(): RequestMetrics {
    return {
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      activeRequests: 0,
      totalDuration: 0,
      avgResponseTime: 0,
      errorRate: 0,
      slowRequests: 0,
      timeoutCount: 0,
      networkErrorCount: 0,
      abortCount: 0,
      statusDistribution: {},
      errorStatusDistribution: {},
      recentTraces: [],
    };
  }

  private checkConcurrentThreshold(): void {
    if (this.metrics.activeRequests > this.thresholds.maxConcurrent) {
      this.emitAlert({
        type: 'high_concurrency',
        message: `High concurrent requests: ${this.metrics.activeRequests}`,
        severity: 'warning',
      });
    }
  }

  private checkErrorRate(): void {
    if (this.metrics.totalRequests < 10) return; // 样本太少不告警

    const errorRate = (this.metrics.failedRequests / this.metrics.totalRequests) * 100;
    if (errorRate > this.thresholds.errorRatePercent) {
      this.emitAlert({
        type: 'high_error_rate',
        message: `High error rate: ${errorRate.toFixed(1)}%`,
        severity: 'critical',
      });
    }
  }

  private emitAlert(alert: Alert): void {
    this.alerts.forEach((cb) => cb(alert));
  }
}

// ==================== 类型定义 ====================

interface RequestMetrics {
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  activeRequests: number;
  totalDuration: number;
  avgResponseTime: number;
  errorRate: number;
  slowRequests: number;
  timeoutCount: number;
  networkErrorCount: number;
  abortCount: number;
  statusDistribution: Record<number, number>;
  errorStatusDistribution: Record<number, number>;
  recentTraces: RequestTrace[];
}

interface RequestTrace {
  id: string;
  method: string;
  url: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'success' | 'error';
  statusCode?: number;
  error?: string;
  metadata?: Record<string, any>;
}

interface Alert {
  type: 'slow_request' | 'high_error_rate' | 'high_concurrency';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  trace?: RequestTrace;
}

interface MonitorThresholds {
  slowRequestMs: number;
  errorRatePercent: number;
  maxConcurrent: number;
}

// ==================== 集成到客户端 ====================

const monitor = new RequestMonitor({
  slowRequestMs: 2000,
  errorRatePercent: 5,
});

// 告警回调
monitor.onAlert((alert) => {
  if (alert.severity === 'critical') {
    // 发送到监控系统
    console.error('[Monitor Alert]', alert.message);
  }
});

// 在客户端中使用
const http = new FetchClient('https://api.example.com');

http.useRequest((config) => {
  (config as any)._monitorTrace = monitor.startRequest(config);
  return config;
});

http.useResponse((response) => {
  const trace = (response.config as any)._monitorTrace;
  if (trace) monitor.endSuccess(trace, response);
  return response;
});

http.useError((error) => {
  const trace = (error.config as any)?._monitorTrace;
  if (trace) monitor.endError(trace, error);
  throw error;
});

// 查看监控数据
console.log(monitor.getMetrics());
console.log(monitor.getTraces({ status: 'error', minDuration: 1000 }));
```

---

## 8. TypeScript 类型体操

### 8.1 类型安全的 API 定义

```typescript
// ==================== 类型系统 ====================

/**
 * API 端点定义
 * 通过泛型约束确保类型安全
 */
interface ApiEndpoint<Params = void, Body = void, Response = any> {
  path: string;
  method: HttpMethod;
  params?: Params;
  body?: Body;
  response: Response;
}

/**
 * 从端点定义推断请求参数类型
 */
type EndpointParams<E extends ApiEndpoint> = E['params'] extends void
  ? Record<string, never>
  : E['params'];

/**
 * 从端点定义推断请求体类型
 */
type EndpointBody<E extends ApiEndpoint> = E['body'] extends void
  ? never
  : E['body'];

/**
 * 从端点定义推断响应类型
 */
type EndpointResponse<E extends ApiEndpoint> = E['response'];

// ==================== 实际端点定义 ====================

interface Endpoints {
  getUser: ApiEndpoint<
    { id: number },
    void,
    { id: number; name: string; email: string }
  >;
  listUsers: ApiEndpoint<
    { page?: number; limit?: number; sort?: 'asc' | 'desc' },
    void,
    { data: Array<{ id: number; name: string }>; total: number }
  >;
  createUser: ApiEndpoint<
    void,
    { name: string; email: string; password: string },
    { id: number; name: string }
  >;
  updateUser: ApiEndpoint<
    { id: number },
    { name?: string; email?: string },
    { id: number; name: string; email: string }
  >;
  deleteUser: ApiEndpoint<{ id: number }, void, void>;
  searchUsers: ApiEndpoint<
    { q: string; page?: number },
    void,
    { results: Array<{ id: number; name: string; match: string }>; total: number }
  >;
}

// ==================== 类型安全的客户端 ====================

class TypedApiClient {
  private client: FetchClient;

  constructor(baseURL: string) {
    this.client = new FetchClient(baseURL);
  }

  /**
   * 类型安全的请求方法
   * 通过端点名称推断所有类型
   */
  async request<K extends keyof Endpoints>(
    endpoint: K,
    ...args: Endpoints[K]['params'] extends void
      ? Endpoints[K]['body'] extends void
        ? [] // 无 params 无 body
        : [body: Endpoints[K]['body']] // 只有 body
      : Endpoints[K]['body'] extends void
        ? [params: Endpoints[K]['params']] // 只有 params
        : [params: Endpoints[K]['params'], body: Endpoints[K]['body']] // params + body
  ): Promise<EndpointResponse<Endpoints[K]>> {
    const def = this.getEndpointDef(endpoint);

    // 解析参数
    let params: any = undefined;
    let body: any = undefined;

    if (args.length === 1) {
      if (def.params !== undefined) {
        params = args[0];
      } else {
        body = args[0];
      }
    } else if (args.length === 2) {
      params = args[0];
      body = args[1];
    }

    const response = await this.client.request<EndpointResponse<Endpoints[K]>>({
      url: def.path,
      method: def.method,
      params,
      body,
    });

    return response.data;
  }

  private getEndpointDef<K extends keyof Endpoints>(key: K): ApiEndpoint {
    const definitions: Record<keyof Endpoints, ApiEndpoint> = {
      getUser: { path: '/users/:id', method: 'GET' },
      listUsers: { path: '/users', method: 'GET' },
      createUser: { path: '/users', method: 'POST' },
      updateUser: { path: '/users/:id', method: 'PUT' },
      deleteUser: { path: '/users/:id', method: 'DELETE' },
      searchUsers: { path: '/users/search', method: 'GET' },
    };
    return definitions[key];
  }
}

// ==================== 使用示例 ====================

const api = new TypedApiClient('https://api.example.com');

// ✅ 类型安全：自动推断参数和返回值
const user = await api.request('getUser', { id: 1 });
//    ^? { id: number; name: string; email: string }

const users = await api.request('listUsers', { page: 1, limit: 10, sort: 'asc' });
//    ^? { data: Array<{ id: number; name: string }>; total: number }

// ✅ 创建用户（有 body 无 params）
const created = await api.request('createUser', {
  name: 'John',
  email: 'john@example.com',
  password: 'secret',
});

// ✅ 更新用户（params + body）
const updated = await api.request('updateUser', { id: 1 }, { name: 'Jane' });

// ✅ 删除用户
await api.request('deleteUser', { id: 1 });

// ✅ 搜索
const searchResult = await api.request('searchUsers', { q: 'john', page: 1 });
```

### 8.2 泛型响应包装

```typescript
/**
 * 统一响应包装
 * 处理成功/失败/加载状态
 */
type Result<T, E = Error> =
  | { ok: true; data: T; error?: never }
  | { ok: false; data?: never; error: E };

async function safeRequest<T>(requestFn: () => Promise<T>): Promise<Result<T>> {
  try {
    const data = await requestFn();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error as E };
  }
}

// 使用
const result = await safeRequest(() => http.get<User>('/users/1'));

if (result.ok) {
  console.log(result.data.name); // 类型安全
} else {
  console.error(result.error.message);
}
```

---

## 9. 综合实战：完整 API SDK

### 9.1 生产级 SDK 架构

```typescript
/**
 * 完整 API SDK
 * 集成所有模式：拦截器 + 重试 + 取消 + 缓存 + 监控 + 离线
 */

// ==================== 配置 ====================

interface SDKConfig {
  baseURL: string;
  timeout?: number;
  retries?: number;
  enableCache?: boolean;
  cacheTTL?: number;
  enableMonitor?: boolean;
  enableOffline?: boolean;
  headers?: Record<string, string>;
}

// ==================== SDK 主类 ====================

class APISDK {
  public http: FetchClient;
  public cache?: RequestCache;
  public monitor?: RequestMonitor;
  public offline?: OfflineQueue;
  public cancelManager = new CancelManager();

  constructor(config: SDKConfig) {
    // 创建 HTTP 客户端
    this.http = new FetchClient(config.baseURL, {
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 2,
    });

    // 默认 Headers
    if (config.headers) {
      this.http.useRequest((req) => {
        req.headers = { ...config.headers, ...req.headers };
        return req;
      });
    }

    // 缓存
    if (config.enableCache !== false) {
      this.cache = new RequestCache(config.cacheTTL ?? 5 * 60 * 1000);
    }

    // 监控
    if (config.enableMonitor !== false) {
      this.monitor = new RequestMonitor();
      this.setupMonitor();
    }

    // 离线队列
    if (config.enableOffline !== false) {
      this.offline = new OfflineQueue(this.http);
    }

    // 通用拦截器
    this.setupCommonInterceptors();
  }

  // ==================== 拦截器设置 ====================

  private setupCommonInterceptors(): void {
    // 认证
    this.http.useRequest((config) => {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        };
      }
      return config;
    });

    // 请求 ID（用于追踪）
    this.http.useRequest((config) => {
      const requestId = crypto.randomUUID?.() || `${Date.now()}`;
      config.headers = {
        ...config.headers,
        'X-Request-ID': requestId,
      };
      (config as any).requestId = requestId;
      return config;
    });

    // 日志
    this.http.useRequest((config) => {
      (config as any)._startTime = performance.now();
      return config;
    });

    this.http.useResponse((response) => {
      const duration = performance.now() - ((response.config as any)._startTime || 0);
      const requestId = (response.config as any).requestId;
      console.log(
        `%c[${response.status}] %c${response.config.method} ${response.config.url} %c${duration.toFixed(0)}ms`,
        'color: green',
        'color: inherit',
        'color: #888'
      );
      return response;
    });

    // 错误处理
    this.http.useError((error) => {
      const requestId = (error.config as any)?.requestId;
      console.error(
        `%c[ERROR] %c${error.message} %c(req: ${requestId})`,
        'color: red',
        'color: inherit',
        'color: #888'
      );

      if (error.status === 401) {
        this.handleUnauthorized();
      }

      throw error;
    });
  }

  // ==================== Token 刷新 ====================

  private isRefreshing = false;

  private async handleUnauthorized(): Promise<void> {
    if (this.isRefreshing) return;
    this.isRefreshing = true;

    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) throw new Error('No refresh token');

      const response = await fetch(`${this.http['baseURL']}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) throw new Error('Refresh failed');

      const { accessToken, refreshToken: newRefreshToken } = await response.json();
      localStorage.setItem('access_token', accessToken);
      if (newRefreshToken) localStorage.setItem('refresh_token', newRefreshToken);
    } catch {
      // 刷新失败，跳转登录
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    } finally {
      this.isRefreshing = false;
    }
  }

  // ==================== 便捷方法 ====================

  /**
   * 带缓存的 GET
   */
  async getCached<T>(url: string, config?: Partial<FetchRequestConfig>, ttl?: number): Promise<T> {
    if (!this.cache) {
      const response = await this.http.get<T>(url, config);
      return response.data;
    }

    const cacheKey = `GET:${url}`;
    const cached = this.cache.get<T>(cacheKey);
    if (cached) return cached;

    const response = await this.http.get<T>(url, config);
    this.cache.set(cacheKey, response.data, ttl);
    return response.data;
  }

  /**
   * 带重试的请求
   */
  async withRetry<T>(
    requestFn: () => Promise<T>,
    options?: { maxRetries?: number; baseDelay?: number }
  ): Promise<T> {
    const maxRetries = options?.maxRetries ?? 3;
    const baseDelay = options?.baseDelay ?? 1000;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        if (attempt > maxRetries) throw error;
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500;
        console.warn(`Retry ${attempt}/${maxRetries} in ${delay.toFixed(0)}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new Error('Unreachable');
  }

  /**
   * 批量请求（并发控制）
   */
  async batch<T>(
    requests: Array<() => Promise<T>>,
    concurrency = 5
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Set<Promise<void>> = new Set();

    for (const requestFn of requests) {
      const p = requestFn().then((result) => {
        results.push(result);
        executing.delete(p);
      });
      executing.add(p);

      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const start = performance.now();
    try {
      await this.http.get('/health', { timeout: 5000, retries: 0 });
      return { healthy: true, latency: performance.now() - start };
    } catch {
      return { healthy: false, latency: performance.now() - start };
    }
  }

  /**
   * 获取 SDK 状态
   */
  getStatus(): {
    online: boolean;
    activeRequests: number;
    cacheSize: number;
    offlineQueue: number;
    metrics?: any;
  } {
    return {
      online: navigator.onLine,
      activeRequests: this.cancelManager.activeCount,
      cacheSize: this.cache?.size ?? 0,
      offlineQueue: this.offline?.length ?? 0,
      metrics: this.monitor?.getMetrics(),
    };
  }
}

// ==================== 使用示例 ====================

// 创建 SDK 实例
const api = new APISDK({
  baseURL: 'https://api.example.com',
  timeout: 15000,
  retries: 2,
  enableCache: true,
  cacheTTL: 5 * 60 * 1000,
  enableMonitor: true,
  enableOffline: true,
  headers: {
    'X-App-Version': '2.0.0',
    'X-Client-Type': 'web',
  },
});

// 定义 API 模块
const userApi = {
  list: (params: { page?: number; limit?: number }) =>
    api.getCached<{ data: any[]; total: number }>(`/users`, { params }),

  get: (id: number) =>
    api.getCached<any>(`/users/${id}`),

  create: (data: any) =>
    api.http.post('/users', data, { retries: 1 }),

  update: (id: number, data: any) =>
    api.http.put(`/users/${id}`, data, { retries: 1 }),

  delete: (id: number) =>
    api.http.delete(`/users/${id}`),

  search: (query: string) => {
    const signal = api.cancelManager.register('user-search');
    return api.http.get('/users/search', {
      params: { q: query },
      signal,
      retries: 1,
    });
  },
};

// 组件中使用
async function loadUsers() {
  try {
    const users = await userApi.list({ page: 1, limit: 20 });
    console.log('Loaded', users.total, 'users');
  } catch (error) {
    console.error('Failed to load users:', error);
  }
}

// 查看 SDK 状态
console.log(api.getStatus());
```

---

## 10. 面试高频题

### Q1: Fetch 和 Axios 的区别？

```
Fetch:
- 浏览器原生 API，零依赖
- 不 reject HTTP 错误状态（4xx/5xx）
- 不支持超时（需 AbortController）
- 不支持拦截器
- 不支持进度事件
- 不支持自动 JSON 转换

Axios:
- 第三方库，需要安装
- 自动 reject HTTP 错误状态
- 内置超时支持
- 内置拦截器
- 支持请求/响应转换
- 支持取消请求（CancelToken）
- 支持进度事件
- 浏览器和 Node.js 通用
- 自动 JSON 转换

选择建议：
- 简单项目 → Fetch + 封装
- 中大型项目 → Axios（拦截器、重试等开箱即用）
- 需要 SSR → Axios（Node.js 兼容）
```

### Q2: 如何实现请求重试？

```typescript
// 核心思路：循环 + 延迟 + 条件判断
async function retry<T>(fn: () => Promise<T>, max: number, delay: number): Promise<T> {
  for (let i = 0; i <= max; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === max) throw error;
      if (!shouldRetry(error)) throw error;
      await sleep(delay * Math.pow(2, i) + Math.random() * 500); // 指数退避 + 抖动
    }
  }
}
```

### Q3: 如何取消请求？

```
Fetch: AbortController
const controller = new AbortController();
fetch(url, { signal: controller.signal });
controller.abort('reason');

Axios: CancelToken (v0.x) / AbortController (v1.x)
const source = axios.CancelToken.source();
axios.get(url, { cancelToken: source.token });
source.cancel('reason');

应用场景：
1. 搜索框：新输入取消旧请求
2. 组件卸载：React useEffect cleanup
3. 路由切换：取消所有 API 请求
4. 超时：自动取消长时间无响应的请求
```

### Q4: 如何实现 Token 自动刷新？

```
核心难点：
1. 并发请求的排队（不能重复刷新）
2. 刷新期间的请求等待
3. 刷新失败后的级联处理

实现要点：
1. isRefreshing 标志防止重复刷新
2. failedQueue 数组存储等待的请求
3. 刷新成功后遍历队列重发请求
4. 刷新失败清除 Token 并跳转登录
```

### Q5: 如何处理请求竞态问题？

```
问题：两个并发请求，后发的先返回，导致 UI 显示旧数据

解决方案：
1. 请求 ID：每次请求递增 ID，只有最新 ID 的响应才更新 UI
2. AbortController：新请求取消旧请求
3. React Query / SWR：内置竞态处理

示例：
let requestId = 0;
async function search(query) {
  requestId++;
  const currentId = requestId;
  const result = await fetch(`/search?q=${query}`);
  if (requestId === currentId) {
    setResult(result); // 只有最新的请求才更新
  }
}
```

### Q6: 如何实现请求去重？

```
思路：用 Map 缓存 pending 的 Promise

class Deduper {
  private pending = new Map<string, Promise<any>>();

  async request(key, fn) {
    if (this.pending.has(key)) return this.pending.get(key);
    const promise = fn().finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }
}

适用场景：
- 多个组件同时请求相同数据
- 快速点击导致的重复提交
- 注意：只对 GET/幂等请求去重
```

### Q7: 如何实现请求超时？

```typescript
// Fetch 超时
function fetchWithTimeout(url, options, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

// Axios 超时
axios.create({ timeout: 10000 });

// 区分超时和取消
try {
  await fetch(url);
} catch (error) {
  if (error.name === 'AbortError') {
    // 可能是超时或手动取消
  }
}
```

### Q8: 如何实现离线请求？

```
方案 1: Service Worker 拦截
- 拦截 fetch 请求
- GET 请求走 cache-first 策略
- 非 GET 请求网络失败时缓存

方案 2: 离线队列
- 监听 online/offline 事件
- 离线时将请求存入队列（localStorage）
- 恢复在线后自动重放

方案 3: IndexedDB 持久化
- 大文件/大量数据用 IndexedDB
- 比 localStorage 容量更大
```

---

## 速查表

### 核心概念

| 概念 | 说明 | 实现方式 |
|------|------|----------|
| 拦截器 | 请求/响应前后执行逻辑 | Axios interceptors / 自定义 Pipeline |
| 重试 | 失败后自动重新请求 | 循环 + 指数退避 + 抖动 |
| 取消 | 中止进行中的请求 | AbortController / CancelToken |
| 去重 | 相同请求只发一次 | Map 缓存 Promise |
| 超时 | 超过时间自动取消 | setTimeout + AbortController |
| 缓存 | 减少重复请求 | Memory / localStorage / Service Worker |
| 离线 | 断网时缓存请求 | OfflineQueue + Service Worker |
| 监控 | 追踪请求性能 | performance.now() + 指标收集 |

### 最佳实践 Checklist

- [ ] 统一错误处理（拦截器）
- [ ] 添加请求日志
- [ ] 实现重试机制（指数退避 + 抖动）
- [ ] 支持请求取消（AbortController）
- [ ] 设置合理超时
- [ ] 使用 TypeScript 类型安全
- [ ] 封装 API 模块（按功能组织）
- [ ] Token 自动刷新（并发安全）
- [ ] 请求去重（GET 幂等请求）
- [ ] 竞态处理（请求 ID）
- [ ] 离线支持（队列 + Service Worker）
- [ ] 监控可观测性（指标 + 告警）

---

## 累计网络层训练

- 4/24 基础版 (Fetch/Axios/拦截器/重试/取消/去重)
- 4/27 高级版 (生产级模式/边界场景/高级架构) = 完整体系 ✅
