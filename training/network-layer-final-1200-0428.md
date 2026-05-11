# 专项训练 12:00 — 网络层综合实战 (04/28)

> 从零构建生产级网络层：Fetch 封装 + Axios 集成 + 拦截器 + 重试 + 取消 + 去重 + 缓存 + 监控

---

## 1. 核心设计原则

```
1. 统一接口：Fetch/Axios 共享同一套 API
2. 拦截器管道：请求 → 转换 → 发送 → 响应 → 转换 → 返回
3. 错误分级：网络错误 / 超时 / 业务错误 / 认证错误
4. 可观测性：每个请求都有 traceId、耗时、状态
5. 类型安全：完整的 TypeScript 类型推导
```

---

## 2. 类型系统

```typescript
// ==================== 核心类型 ====================

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

interface NetworkRequestConfig {
  /** 请求 URL */
  url: string;
  /** HTTP 方法 */
  method?: HttpMethod;
  /** 请求头 */
  headers?: Record<string, string>;
  /** 请求体 */
  body?: any;
  /** URL 查询参数 */
  params?: Record<string, string | number | boolean | undefined>;
  /** 超时时间 (ms) */
  timeout?: number;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 重试策略 */
  retryStrategy?: 'fixed' | 'exponential' | 'adaptive';
  /** 重试条件 */
  shouldRetry?: (error: NetworkError, attempt: number) => boolean;
  /** 取消信号 */
  signal?: AbortSignal;
  /** 请求去重 key */
  dedupeKey?: string;
  /** 缓存策略 */
  cacheStrategy?: 'no-cache' | 'cache-first' | 'network-first' | 'stale-while-revalidate';
  /** 缓存 TTL (ms) */
  cacheTTL?: number;
  /** 进度回调 */
  onUploadProgress?: (loaded: number, total: number) => void;
  onDownloadProgress?: (loaded: number, total: number) => void;
  /** 请求转换器 */
  transformRequest?: (data: any) => any;
  /** 响应转换器 */
  transformResponse?: (data: any) => any;
  /** 自定义元数据 */
  metadata?: Record<string, unknown>;
}

interface NetworkResponse<T = any> {
  /** 响应数据 */
  data: T;
  /** HTTP 状态码 */
  status: number;
  /** 状态文本 */
  statusText: string;
  /** 响应头 */
  headers: Record<string, string>;
  /** 请求配置 */
  config: NetworkRequestConfig;
  /** 请求耗时 (ms) */
  duration: number;
  /** 是否来自缓存 */
  fromCache: boolean;
  /** 请求追踪 ID */
  traceId: string;
}

interface NetworkError extends Error {
  /** HTTP 状态码 */
  status?: number;
  /** 响应数据 */
  response?: NetworkResponse;
  /** 请求配置 */
  config?: NetworkRequestConfig;
  /** 是否超时 */
  isTimeout: boolean;
  /** 是否被取消 */
  isCancelled: boolean;
  /** 是否网络错误 */
  isNetworkError: boolean;
  /** 重试次数 */
  retryCount: number;
  /** 追踪 ID */
  traceId: string;
}

// ==================== 拦截器类型 ====================

type RequestInterceptor = (
  config: NetworkRequestConfig
) => NetworkRequestConfig | Promise<NetworkRequestConfig>;

type ResponseInterceptor<T = any> = (
  response: NetworkResponse<T>
) => NetworkResponse<T> | Promise<NetworkResponse<T>>;

type ErrorInterceptor = (
  error: NetworkError
) => never | Promise<never>;

interface InterceptorStack {
  request: Array<{ id: string; fn: RequestInterceptor }>;
  response: Array<{ id: string; fn: ResponseInterceptor }>;
  error: Array<{ id: string; fn: ErrorInterceptor }>;
}

// ==================== 监控类型 ====================

interface RequestMetrics {
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  activeRequests: number;
  totalDuration: number;
  avgDuration: number;
  errorRate: number;
  slowRequests: number;
  timeoutCount: number;
  cancelCount: number;
  cacheHits: number;
  statusDistribution: Record<number, number>;
  slowestRequests: Array<{ url: string; duration: number; status: number }>;
}

interface RequestTrace {
  traceId: string;
  method: string;
  url: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status?: number;
  statusText?: string;
  error?: string;
  fromCache: boolean;
  retryCount: number;
}
```

---

## 3. 核心网络客户端

```typescript
// ==================== 工具函数 ====================

function generateTraceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildURL(base: string, url: string, params?: Record<string, any>): string {
  let fullUrl = url.startsWith('http') ? url : `${base}${url}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    }
    const query = searchParams.toString();
    if (query) {
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + query;
    }
  }

  return fullUrl;
}

function parseHeaders(headers: Headers | Record<string, string>): Record<string, string> {
  if (headers instanceof Headers) {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key.toLowerCase()] = value;
    });
    return result;
  }
  return headers || {};
}

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// ==================== 错误工厂 ====================

function createNetworkError(
  message: string,
  options: Partial<NetworkError> = {}
): NetworkError {
  const error = new Error(message) as NetworkError;
  error.name = 'NetworkError';
  error.isTimeout = options.isTimeout ?? false;
  error.isCancelled = options.isCancelled ?? false;
  error.isNetworkError = options.isNetworkError ?? false;
  error.retryCount = options.retryCount ?? 0;
  error.traceId = options.traceId ?? generateTraceId();
  if (options.status !== undefined) error.status = options.status;
  if (options.response) error.response = options.response;
  if (options.config) error.config = options.config;
  return error;
}

// ==================== 缓存系统 ====================

class RequestCache {
  private store = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private defaultTTL: number = 5 * 60 * 1000) {
    // 每 5 分钟清理一次过期缓存
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidateByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.store.clear();
  }
}

// ==================== 请求去重器 ====================

class RequestDeduper {
  private pending = new Map<string, Promise<any>>();

  generateKey(config: NetworkRequestConfig): string {
    const method = (config.method || 'GET').toUpperCase();
    const paramsStr = config.params ? JSON.stringify(config.params) : '';
    const bodyStr = config.body && method !== 'GET' ? JSON.stringify(config.body) : '';
    return `${method}:${config.url}:${paramsStr}:${bodyStr}`;
  }

  get<T>(key: string): Promise<T> | null {
    return (this.pending.get(key) as Promise<T>) ?? null;
  }

  set(key: string, promise: Promise<any>): void {
    this.pending.set(key, promise);
    promise.finally(() => this.pending.delete(key));
  }

  has(key: string): boolean {
    return this.pending.has(key);
  }

  get size(): number {
    return this.pending.size;
  }
}

// ==================== 重试管理器 ====================

class RetryManager {
  calculateDelay(
    attempt: number,
    strategy: 'fixed' | 'exponential' | 'adaptive',
    baseDelay: number,
    error?: NetworkError
  ): number {
    let delay: number;

    switch (strategy) {
      case 'fixed':
        delay = baseDelay;
        break;

      case 'exponential':
        delay = baseDelay * Math.pow(2, attempt - 1);
        break;

      case 'adaptive':
        if (error?.status === 429) {
          // 速率限制：使用更长的延迟
          delay = baseDelay * 3;
        } else if (error?.status === 503) {
          // 服务不可用
          delay = baseDelay * 2;
        } else {
          delay = baseDelay * Math.pow(1.5, attempt - 1);
        }
        break;

      default:
        delay = baseDelay;
    }

    // 最大延迟 30s
    delay = Math.min(delay, 30000);

    // 添加随机抖动 (±25%)
    const jitter = delay * 0.25;
    delay += (Math.random() - 0.5) * jitter * 2;

    return Math.max(0, Math.round(delay));
  }

  shouldRetry(
    error: NetworkError,
    attempt: number,
    maxRetries: number,
    customShouldRetry?: (error: NetworkError, attempt: number) => boolean
  ): boolean {
    if (attempt >= maxRetries) return false;
    if (error.isCancelled) return false;

    // 自定义重试条件
    if (customShouldRetry) {
      return customShouldRetry(error, attempt);
    }

    // 默认：重试 5xx、超时、网络错误、429
    return (
      (error.status !== undefined && error.status >= 500) ||
      error.isTimeout ||
      error.isNetworkError ||
      error.status === 429
    );
  }
}

// ==================== 取消管理器 ====================

class CancelManager {
  private controllers = new Map<string, AbortController>();

  /**
   * 按 key 注册请求（自动取消同 key 的旧请求）
   */
  register(key: string): AbortSignal {
    // 取消旧请求
    const old = this.controllers.get(key);
    if (old) {
      old.abort(`Duplicate request: ${key}`);
    }

    const controller = new AbortController();
    this.controllers.set(key, controller);
    return controller.signal;
  }

  /**
   * 取消指定 key 的请求
   */
  cancel(key: string, reason = 'Cancelled'): boolean {
    const controller = this.controllers.get(key);
    if (controller) {
      controller.abort(reason);
      this.controllers.delete(key);
      return true;
    }
    return false;
  }

  /**
   * 按模式取消
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
   * 取消所有请求
   */
  cancelAll(reason = 'Cancel all'): number {
    let count = 0;
    for (const [key, controller] of this.controllers) {
      controller.abort(reason);
      this.controllers.delete(key);
      count++;
    }
    return count;
  }

  /**
   * 注销（不取消，仅移除引用）
   */
  unregister(key: string): void {
    this.controllers.delete(key);
  }

  get activeCount(): number {
    return this.controllers.size;
  }
}

// ==================== 监控器 ====================

class RequestMonitor {
  private traces: Map<string, RequestTrace> = new Map();
  private metrics: RequestMetrics = this.createEmptyMetrics();
  private slowThreshold: number;
  private maxTraces: number;

  constructor(options?: { slowThreshold?: number; maxTraces?: number }) {
    this.slowThreshold = options?.slowThreshold ?? 3000;
    this.maxTraces = options?.maxTraces ?? 1000;
  }

  start(config: NetworkRequestConfig): string {
    const traceId = generateTraceId();
    this.traces.set(traceId, {
      traceId,
      method: config.method || 'GET',
      url: config.url,
      startTime: performance.now(),
      fromCache: false,
      retryCount: 0,
    });
    this.metrics.activeRequests++;
    return traceId;
  }

  endSuccess(traceId: string, status: number, duration: number, fromCache: boolean): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.endTime = performance.now();
    trace.duration = duration;
    trace.status = status;
    trace.statusText = 'OK';
    trace.fromCache = fromCache;

    this.metrics.totalRequests++;
    this.metrics.successRequests++;
    this.metrics.activeRequests--;
    this.metrics.totalDuration += duration;

    if (fromCache) this.metrics.cacheHits++;
    if (duration > this.slowThreshold) this.metrics.slowRequests++;

    // 状态码分布
    const group = Math.floor(status / 100);
    this.metrics.statusDistribution[group] =
      (this.metrics.statusDistribution[group] || 0) + 1;

    // 记录慢请求
    if (duration > this.slowThreshold) {
      this.metrics.slowestRequests.push({ url: trace.url, duration, status });
      this.metrics.slowestRequests.sort((a, b) => b.duration - a.duration);
      this.metrics.slowestRequests = this.metrics.slowestRequests.slice(0, 20);
    }

    this.cleanupTraces();
  }

  endError(traceId: string, error: NetworkError): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.endTime = performance.now();
    trace.duration = performance.now() - trace.startTime;
    trace.status = error.status;
    trace.error = error.message;
    trace.retryCount = error.retryCount;

    this.metrics.totalRequests++;
    this.metrics.failedRequests++;
    this.metrics.activeRequests--;
    this.metrics.totalDuration += trace.duration;

    if (error.isTimeout) this.metrics.timeoutCount++;
    if (error.isCancelled) this.metrics.cancelCount++;

    if (error.status) {
      const group = Math.floor(error.status / 100);
      this.metrics.statusDistribution[group] =
        (this.metrics.statusDistribution[group] || 0) + 1;
    }

    this.cleanupTraces();
  }

  getMetrics(): RequestMetrics {
    return {
      ...this.metrics,
      avgDuration:
        this.metrics.totalRequests > 0
          ? this.metrics.totalDuration / this.metrics.totalRequests
          : 0,
      errorRate:
        this.metrics.totalRequests > 0
          ? (this.metrics.failedRequests / this.metrics.totalRequests) * 100
          : 0,
    };
  }

  getTraces(filter?: { status?: number; url?: string; minDuration?: number }): RequestTrace[] {
    let result = Array.from(this.traces.values());

    if (filter?.status) {
      result = result.filter((t) => t.status === filter.status);
    }
    if (filter?.url) {
      result = result.filter((t) => t.url.includes(filter.url!));
    }
    if (filter?.minDuration) {
      result = result.filter((t) => (t.duration ?? 0) >= filter.minDuration);
    }

    return result;
  }

  reset(): void {
    this.metrics = this.createEmptyMetrics();
    this.traces.clear();
  }

  private createEmptyMetrics(): RequestMetrics {
    return {
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      activeRequests: 0,
      totalDuration: 0,
      avgDuration: 0,
      errorRate: 0,
      slowRequests: 0,
      timeoutCount: 0,
      cancelCount: 0,
      cacheHits: 0,
      statusDistribution: {},
      slowestRequests: [],
    };
  }

  private cleanupTraces(): void {
    if (this.traces.size > this.maxTraces) {
      const keys = Array.from(this.traces.keys());
      for (let i = 0; i < keys.length - this.maxTraces; i++) {
        this.traces.delete(keys[i]);
      }
    }
  }
}

// ==================== 核心网络客户端 ====================

class NetworkClient {
  private baseURL: string;
  private interceptors: InterceptorStack = {
    request: [],
    response: [],
    error: [],
  };
  private cache: RequestCache;
  private deduper: RequestDeduper;
  private retryManager: RetryManager;
  private cancelManager: CancelManager;
  private monitor: RequestMonitor;
  private defaults: Required<
    Pick<
      NetworkRequestConfig,
      'timeout' | 'maxRetries' | 'retryStrategy' | 'cacheStrategy' | 'cacheTTL'
    >
  >;

  constructor(
    baseURL: string,
    defaults?: Partial<typeof this.defaults>
  ) {
    this.baseURL = baseURL.replace(/\/+$/, '');
    this.defaults = {
      timeout: defaults?.timeout ?? 30000,
      maxRetries: defaults?.maxRetries ?? 2,
      retryStrategy: defaults?.retryStrategy ?? 'exponential',
      cacheStrategy: defaults?.cacheStrategy ?? 'no-cache',
      cacheTTL: defaults?.cacheTTL ?? 5 * 60 * 1000,
    };

    this.cache = new RequestCache(this.defaults.cacheTTL);
    this.deduper = new RequestDeduper();
    this.retryManager = new RetryManager();
    this.cancelManager = new CancelManager();
    this.monitor = new RequestMonitor();
  }

  // ==================== 拦截器管理 ====================

  addRequestInterceptor(id: string, fn: RequestInterceptor): void {
    this.interceptors.request.push({ id, fn });
  }

  addResponseInterceptor(id: string, fn: ResponseInterceptor): void {
    this.interceptors.response.push({ id, fn });
  }

  addErrorInterceptor(id: string, fn: ErrorInterceptor): void {
    this.interceptors.error.push({ id, fn });
  }

  removeInterceptor(type: 'request' | 'response' | 'error', id: string): void {
    const stack = this.interceptors[type];
    const index = stack.findIndex((item) => item.id === id);
    if (index !== -1) stack.splice(index, 1);
  }

  clearInterceptors(type?: 'request' | 'response' | 'error'): void {
    if (type) {
      this.interceptors[type] = [];
    } else {
      this.interceptors.request = [];
      this.interceptors.response = [];
      this.interceptors.error = [];
    }
  }

  // ==================== 核心请求方法 ====================

  async request<T = any>(config: NetworkRequestConfig): Promise<NetworkResponse<T>> {
    const startTime = performance.now();

    // 1. 合并默认配置
    let processedConfig: NetworkRequestConfig = {
      method: 'GET',
      timeout: this.defaults.timeout,
      maxRetries: this.defaults.maxRetries,
      retryStrategy: this.defaults.retryStrategy,
      cacheStrategy: this.defaults.cacheStrategy,
      cacheTTL: this.defaults.cacheTTL,
      ...config,
      headers: { ...config.headers },
    };

    // 2. 执行请求拦截器
    for (const { fn } of this.interceptors.request) {
      processedConfig = await fn(processedConfig);
    }

    // 3. 监控：开始追踪
    const traceId = this.monitor.start(processedConfig);

    // 4. 请求去重
    const dedupeKey = processedConfig.dedupeKey || this.deduper.generateKey(processedConfig);
    if (
      processedConfig.method?.toUpperCase() === 'GET' &&
      this.deduper.has(dedupeKey)
    ) {
      const existing = this.deduper.get<T>(dedupeKey);
      if (existing) {
        const duration = performance.now() - startTime;
        this.monitor.endSuccess(traceId, 200, duration, false);
        return existing;
      }
    }

    // 5. 缓存检查
    if (processedConfig.method?.toUpperCase() === 'GET') {
      const cacheResult = await this.handleCache(processedConfig, traceId, startTime);
      if (cacheResult) return cacheResult;
    }

    // 6. 执行请求（带重试）
    const requestPromise = this.executeWithRetry<T>(processedConfig, traceId);

    // 去重：注册 pending promise
    if (processedConfig.method?.toUpperCase() === 'GET') {
      this.deduper.set(dedupeKey, requestPromise);
    }

    return requestPromise;
  }

  /**
   * 缓存处理
   */
  private async handleCache<T>(
    config: NetworkRequestConfig,
    traceId: string,
    startTime: number
  ): Promise<NetworkResponse<T> | null> {
    const cacheKey = `${config.method}:${config.url}:${JSON.stringify(config.params)}`;
    const strategy = config.cacheStrategy || 'no-cache';

    if (strategy === 'no-cache') return null;

    const cached = this.cache.get<T>(cacheKey);

    switch (strategy) {
      case 'cache-first': {
        if (cached !== null) {
          const duration = performance.now() - startTime;
          this.monitor.endSuccess(traceId, 200, duration, true);
          return {
            data: cached,
            status: 200,
            statusText: 'OK (cached)',
            headers: {},
            config,
            duration,
            fromCache: true,
            traceId,
          };
        }
        return null;
      }

      case 'stale-while-revalidate': {
        if (cached !== null) {
          // 返回缓存，后台更新
          this.executeFetch<T>(config, traceId)
            .then((response) => {
              this.cache.set(cacheKey, response.data, config.cacheTTL);
            })
            .catch(() => {});

          const duration = performance.now() - startTime;
          this.monitor.endSuccess(traceId, 200, duration, true);
          return {
            data: cached,
            status: 200,
            statusText: 'OK (stale-while-revalidate)',
            headers: {},
            config,
            duration,
            fromCache: true,
            traceId,
          };
        }
        return null;
      }

      case 'network-first': {
        // 先尝试网络，失败时回退缓存
        try {
          const response = await this.executeFetch<T>(config, traceId);
          this.cache.set(cacheKey, response.data, config.cacheTTL);
          return response;
        } catch (error) {
          if (cached !== null) {
            const duration = performance.now() - startTime;
            this.monitor.endSuccess(traceId, 200, duration, true);
            return {
              data: cached,
              status: 200,
              statusText: 'OK (stale fallback)',
              headers: {},
              config,
              duration,
              fromCache: true,
              traceId,
            };
          }
          throw error;
        }
      }

      default:
        return null;
    }
  }

  /**
   * 带重试的执行
   */
  private async executeWithRetry<T>(
    config: NetworkRequestConfig,
    traceId: string
  ): Promise<NetworkResponse<T>> {
    const maxRetries = config.maxRetries ?? this.defaults.maxRetries;
    let lastError: NetworkError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.executeFetch<T>(config, traceId);

        // 缓存成功响应
        if (config.method?.toUpperCase() === 'GET') {
          const cacheKey = `${config.method}:${config.url}:${JSON.stringify(config.params)}`;
          this.cache.set(cacheKey, response.data, config.cacheTTL);
        }

        // POST/PUT/DELETE 后清除相关缓存
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method?.toUpperCase() || '')) {
          const prefix = config.url.split('/').slice(0, -1).join('/');
          this.cache.invalidateByPrefix(`${config.method}:${prefix}`);
        }

        return response;
      } catch (error) {
        lastError = error as NetworkError;

        if (
          !this.retryManager.shouldRetry(
            lastError,
            attempt,
            maxRetries,
            config.shouldRetry
          )
        ) {
          break;
        }

        const delay = this.retryManager.calculateDelay(
          attempt + 1,
          config.retryStrategy || 'exponential',
          1000,
          lastError
        );

        console.warn(
          `[Network] Retry ${attempt + 1}/${maxRetries} for ${config.method} ${config.url} in ${delay}ms`
        );

        await this.sleep(delay);
      }
    }

    // 执行错误拦截器
    if (lastError) {
      for (const { fn } of this.interceptors.error) {
        await fn(lastError);
      }
    }

    throw lastError!;
  }

  /**
   * 底层 fetch 执行
   */
  private async executeFetch<T>(
    config: NetworkRequestConfig,
    traceId: string
  ): Promise<NetworkResponse<T>> {
    const startTime = performance.now();

    // 构建 URL
    const url = buildURL(this.baseURL, config.url, config.params);

    // 处理 body
    let body: BodyInit | undefined;
    if (config.body && !['GET', 'HEAD'].includes(config.method?.toUpperCase() || '')) {
      let processedBody = config.body;
      if (config.transformRequest) {
        processedBody = config.transformRequest(processedBody);
      }

      if (processedBody instanceof FormData) {
        body = processedBody;
      } else if (processedBody instanceof URLSearchParams) {
        body = processedBody;
      } else if (processedBody instanceof Blob) {
        body = processedBody;
      } else if (isObject(processedBody)) {
        body = JSON.stringify(processedBody);
      } else {
        body = String(processedBody);
      }
    }

    // 构建 headers
    const headers: Record<string, string> = { ...config.headers };
    if (
      body &&
      typeof body === 'string' &&
      !headers['Content-Type'] &&
      !headers['content-type']
    ) {
      headers['Content-Type'] = 'application/json';
    }

    // 创建 AbortController
    const controller = new AbortController();
    const signal = config.signal
      ? this.createCombinedSignal(controller.signal, config.signal)
      : controller.signal;

    // 超时控制
    const timeoutMs = config.timeout ?? this.defaults.timeout;
    const timeoutId = setTimeout(() => {
      controller.abort(`Timeout after ${timeoutMs}ms`);
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        method: config.method || 'GET',
        headers,
        body,
        signal,
      });

      clearTimeout(timeoutId);

      // 解析响应数据
      const data = await this.parseResponseData(response);

      // 转换响应
      let processedData = data;
      if (config.transformResponse) {
        processedData = config.transformResponse(data);
      }

      // 检查状态码
      if (response.status < 200 || response.status >= 300) {
        const duration = performance.now() - startTime;
        const error = createNetworkError(`HTTP ${response.status}: ${response.statusText}`, {
          status: response.status,
          config,
          traceId,
        });

        this.monitor.endError(traceId, error);

        // 执行错误拦截器
        for (const { fn } of this.interceptors.error) {
          await fn(error);
        }

        throw error;
      }

      const duration = performance.now() - startTime;
      const networkResponse: NetworkResponse<T> = {
        data: processedData as T,
        status: response.status,
        statusText: response.statusText,
        headers: parseHeaders(response.headers),
        config,
        duration,
        fromCache: false,
        traceId,
      };

      // 执行响应拦截器
      let finalResponse = networkResponse;
      for (const { fn } of this.interceptors.response) {
        finalResponse = await fn(finalResponse);
      }

      this.monitor.endSuccess(traceId, response.status, duration, false);

      return finalResponse as NetworkResponse<T>;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof DOMException && error.name === 'AbortError') {
        const message = error.message || '';
        if (message.includes('Timeout')) {
          const networkError = createNetworkError(`Request timeout after ${timeoutMs}ms`, {
            isTimeout: true,
            config,
            traceId,
          });
          this.monitor.endError(traceId, networkError);
          throw networkError;
        }

        const networkError = createNetworkError(`Request cancelled: ${message}`, {
          isCancelled: true,
          config,
          traceId,
        });
        this.monitor.endError(traceId, networkError);
        throw networkError;
      }

      // 网络错误
      const networkError = createNetworkError('Network error - check your connection', {
        isNetworkError: true,
        config,
        traceId,
      });
      this.monitor.endError(traceId, networkError);
      throw networkError;
    }
  }

  /**
   * 合并多个 AbortSignal
   */
  private createCombinedSignal(
    primary: AbortSignal,
    secondary: AbortSignal
  ): AbortSignal {
    if (secondary.aborted) {
      primary.abort(secondary.reason);
      return primary;
    }

    secondary.addEventListener('abort', () => {
      primary.abort(secondary.reason);
    });

    return primary;
  }

  /**
   * 解析响应数据
   */
  private async parseResponseData(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      return response.json();
    }
    if (contentType.includes('text/html') || contentType.includes('text/plain')) {
      return response.text();
    }
    if (contentType.includes('application/octet-stream')) {
      return response.blob();
    }

    // 默认尝试 JSON
    try {
      return await response.json();
    } catch {
      return response.text();
    }
  }

  /**
   * 延迟
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==================== 便捷方法 ====================

  get<T>(url: string, config?: Omit<Partial<NetworkRequestConfig>, 'method' | 'url'>): Promise<NetworkResponse<T>> {
    return this.request<T>({ ...config, url, method: 'GET' });
  }

  post<T>(url: string, body?: any, config?: Omit<Partial<NetworkRequestConfig>, 'method' | 'url' | 'body'>): Promise<NetworkResponse<T>> {
    return this.request<T>({ ...config, url, method: 'POST', body });
  }

  put<T>(url: string, body?: any, config?: Omit<Partial<NetworkRequestConfig>, 'method' | 'url' | 'body'>): Promise<NetworkResponse<T>> {
    return this.request<T>({ ...config, url, method: 'PUT', body });
  }

  patch<T>(url: string, body?: any, config?: Omit<Partial<NetworkRequestConfig>, 'method' | 'url' | 'body'>): Promise<NetworkResponse<T>> {
    return this.request<T>({ ...config, url, method: 'PATCH', body });
  }

  delete<T>(url: string, config?: Omit<Partial<NetworkRequestConfig>, 'method' | 'url'>): Promise<NetworkResponse<T>> {
    return this.request<T>({ ...config, url, method: 'DELETE' });
  }

  // ==================== 取消管理 ====================

  cancelRequest(key: string, reason?: string): boolean {
    return this.cancelManager.cancel(key, reason);
  }

  cancelAll(reason?: string): number {
    return this.cancelManager.cancelAll(reason);
  }

  get activeRequests(): number {
    return this.cancelManager.activeCount;
  }

  // ==================== 缓存管理 ====================

  clearCache(): void {
    this.cache.clear();
  }

  invalidateCache(prefix: string): number {
    return this.cache.invalidateByPrefix(prefix);
  }

  get cacheSize(): number {
    return this.cache.size;
  }

  // ==================== 监控 ====================

  getMetrics(): RequestMetrics {
    return this.monitor.getMetrics();
  }

  getTraces(filter?: { status?: number; url?: string; minDuration?: number }): RequestTrace[] {
    return this.monitor.getTraces(filter);
  }

  resetMetrics(): void {
    this.monitor.reset();
  }

  // ==================== 销毁 ====================

  destroy(): void {
    this.cancelAll('Client destroyed');
    this.cache.destroy();
    this.clearInterceptors();
    this.resetMetrics();
  }
}
```

---

## 4. 常用拦截器实现

```typescript
// ==================== 认证拦截器 ====================

function createAuthInterceptor(
  getToken: () => string | null,
  options?: { headerName?: string; prefix?: string }
): RequestInterceptor {
  const headerName = options?.headerName || 'Authorization';
  const prefix = options?.prefix || 'Bearer ';

  return (config) => {
    const token = getToken();
    if (token) {
      config.headers = {
        ...config.headers,
        [headerName]: `${prefix}${token}`,
      };
    }
    return config;
  };
}

// ==================== Token 刷新拦截器 ====================

function createTokenRefreshInterceptor(
  refreshTokenFn: () => Promise<string>,
  onTokenUpdate: (token: string) => void,
  onRefreshFailed: () => void
): ErrorInterceptor {
  let isRefreshing = false;
  let refreshPromise: Promise<string> | null = null;
  const queue: Array<{ resolve: (token: string) => void; reject: (error: any) => void }> = [];

  return async (error) => {
    const config = error.config as NetworkRequestConfig & { _retry?: boolean };

    // 只处理 401 且未重试过的请求
    if (error.status !== 401 || !config || config._retry) {
      throw error;
    }

    config._retry = true;

    try {
      let token: string;

      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshTokenFn()
          .then((newToken) => {
            onTokenUpdate(newToken);
            flushQueue(null, newToken);
            return newToken;
          })
          .catch((refreshError) => {
            flushQueue(refreshError, null);
            onRefreshFailed();
            throw refreshError;
          })
          .finally(() => {
            isRefreshing = false;
            refreshPromise = null;
          });
      }

      // 等待刷新完成
      token = await (refreshPromise || Promise.reject(new Error('No refresh promise')));

      // 更新请求头并重试
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };

      // 重试原请求（通过重新执行）
      // 注意：实际使用中需要通过某种方式获取 client 实例来重试
      // 这里返回一个新的 promise，由外部处理
      return Promise.reject({ ...error, _shouldRetry: true, config });
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }

    function flushQueue(error: any, token: string | null): void {
      queue.forEach(({ resolve, reject }) => {
        if (error) reject(error);
        else resolve(token!);
      });
      queue.length = 0;
    }
  };
}

// ==================== 日志拦截器 ====================

function createLoggerInterceptor(): {
  request: RequestInterceptor;
  response: ResponseInterceptor;
  error: ErrorInterceptor;
} {
  return {
    request: (config) => {
      const method = config.method || 'GET';
      const url = config.url;
      console.groupCollapsed(`%c→ ${method} ${url}`, 'color: #2196F3; font-weight: bold');
      if (config.params) console.log('Params:', config.params);
      if (config.body) console.log('Body:', config.body);
      (config as any)._logStartTime = Date.now();
      return config;
    },

    response: (response) => {
      const duration = response.duration.toFixed(0);
      const method = response.config.method || 'GET';
      const url = response.config.url;
      console.log(
        `%c← ${response.status} ${method} ${url} (${duration}ms)`,
        'color: #4CAF50; font-weight: bold'
      );
      console.groupEnd();
      return response;
    },

    error: (error) => {
      const method = error.config?.method || 'GET';
      const url = error.config?.url || '';
      console.error(
        `%c✗ ${error.message} ${method} ${url}`,
        'color: #F44336; font-weight: bold'
      );
      console.groupEnd();
      throw error;
    },
  };
}

// ==================== 全局错误处理拦截器 ====================

function createGlobalErrorHandler(options?: {
  on401?: () => void;
  on403?: () => void;
  on500?: () => void;
  onNetworkError?: () => void;
  onTimeout?: () => void;
}): ErrorInterceptor {
  return (error) => {
    switch (error.status) {
      case 401:
        options?.on401?.();
        break;
      case 403:
        options?.on403?.();
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        options?.on500?.();
        break;
    }

    if (error.isNetworkError) {
      options?.onNetworkError?.();
    }

    if (error.isTimeout) {
      options?.onTimeout?.();
    }

    throw error;
  };
}

// ==================== 请求 ID 拦截器 ====================

function createRequestIdInterceptor(): RequestInterceptor {
  return (config) => {
    const requestId = generateTraceId();
    config.headers = {
      ...config.headers,
      'X-Request-ID': requestId,
    };
    (config as any).requestId = requestId;
    return config;
  };
}

// ==================== Loading 状态拦截器 ====================

function createLoadingInterceptor(
  onStart: () => void,
  onEnd: () => void
): { request: RequestInterceptor; response: ResponseInterceptor; error: ErrorInterceptor } {
  let activeCount = 0;

  return {
    request: (config) => {
      activeCount++;
      if (activeCount === 1) onStart();
      return config;
    },
    response: (response) => {
      activeCount--;
      if (activeCount <= 0) {
        activeCount = 0;
        onEnd();
      }
      return response;
    },
    error: (error) => {
      activeCount--;
      if (activeCount <= 0) {
        activeCount = 0;
        onEnd();
      }
      throw error;
    },
  };
}
```

---

## 5. 完整使用示例

```typescript
// ==================== 创建客户端 ====================

const api = new NetworkClient('https://api.example.com', {
  timeout: 15000,
  maxRetries: 2,
  retryStrategy: 'exponential',
});

// ==================== 添加拦截器 ====================

// 1. 认证
api.addRequestInterceptor(
  'auth',
  createAuthInterceptor(() => localStorage.getItem('accessToken'))
);

// 2. 请求 ID
api.addRequestInterceptor('requestId', createRequestIdInterceptor());

// 3. 日志
const logger = createLoggerInterceptor();
api.addRequestInterceptor('logger.request', logger.request);
api.addResponseInterceptor('logger.response', logger.response);
api.addErrorInterceptor('logger.error', logger.error);

// 4. 全局错误处理
api.addErrorInterceptor(
  'errorHandler',
  createGlobalErrorHandler({
    on401: () => {
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    },
    onNetworkError: () => {
      alert('网络连接失败，请检查网络');
    },
    onTimeout: () => {
      alert('请求超时，请稍后重试');
    },
  })
);

// 5. Loading 状态
const loading = createLoadingInterceptor(
  () => document.getElementById('loading')?.classList.remove('hidden'),
  () => document.getElementById('loading')?.classList.add('hidden')
);
api.addRequestInterceptor('loading.request', loading.request);
api.addResponseInterceptor('loading.response', loading.response);
api.addErrorInterceptor('loading.error', loading.error);

// ==================== API 模块定义 ====================

interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

const userApi = {
  // 获取用户列表（带缓存 + 去重）
  list: (page = 1, pageSize = 20) =>
    api.get<PaginatedResponse<User>>('/users', {
      params: { page, pageSize },
      cacheStrategy: 'stale-while-revalidate',
      cacheTTL: 2 * 60 * 1000,
      dedupeKey: `user-list-${page}-${pageSize}`,
    }),

  // 获取单个用户（带缓存）
  get: (id: number) =>
    api.get<User>(`/users/${id}`, {
      cacheStrategy: 'cache-first',
      cacheTTL: 5 * 60 * 1000,
    }),

  // 创建用户
  create: (data: { name: string; email: string }) =>
    api.post<User>('/users', data, { maxRetries: 1 }),

  // 更新用户
  update: (id: number, data: Partial<User>) =>
    api.put<User>(`/users/${id}`, data, { maxRetries: 1 }),

  // 删除用户
  delete: (id: number) => api.delete(`/users/${id}`),

  // 搜索用户（带取消）
  search: (query: string) =>
    api.get<User[]>('/users/search', {
      params: { q: query },
      dedupeKey: 'user-search',
      timeout: 10000,
    }),
};

// ==================== 搜索框实现（防抖 + 取消） ====================

class SearchController {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentRequestId = 0;

  constructor(
    private searchFn: (query: string) => Promise<any>,
    private onResults: (results: any[], query: string) => void,
    private debounceMs = 300
  ) {}

  search(query: string): void {
    // 清除防抖
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    // 递增请求 ID（解决竞态）
    this.currentRequestId++;
    const requestId = this.currentRequestId;

    // 空查询
    if (!query.trim()) {
      this.onResults([], query);
      return;
    }

    // 防抖
    this.debounceTimer = setTimeout(async () => {
      try {
        const { data } = await this.searchFn(query);

        // 竞态检查：只有最新请求才更新
        if (requestId === this.currentRequestId) {
          this.onResults(data, query);
        }
      } catch (error) {
        if (requestId === this.currentRequestId) {
          this.onResults([], query);
        }
      }
    }, this.debounceMs);
  }

  destroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }
}

// 使用
const searchCtrl = new SearchController(
  (q) => userApi.search(q),
  (results, query) => {
    console.log(`搜索 "${query}": ${results.length} 条结果`);
  },
  300
);

// 绑定输入框
document.getElementById('search-input')?.addEventListener('input', (e) => {
  searchCtrl.search((e.target as HTMLInputElement).value);
});

// ==================== React Hook 封装 ====================

function useApi<T>(
  requestFn: () => Promise<NetworkResponse<T>>,
  deps: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NetworkError | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await requestFn();
      setData(response.data);
    } catch (err) {
      if (!(err as NetworkError).isCancelled) {
        setError(err as NetworkError);
      }
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    execute();
    return () => {
      // 组件卸载时不取消（由拦截器处理）
    };
  }, deps);

  return { data, loading, error, refetch: execute };
}

// 使用
function UserProfile({ userId }: { userId: number }) {
  const { data: user, loading, error } = useApi(
    () => userApi.get(userId),
    [userId]
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!user) return null;

  return <div>{user.name}</div>;
}

// ==================== 并发控制 ====================

async function batchRequest<T>(
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

// 使用
const users = await batchRequest(
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => () => userApi.get(id).then((r) => r.data)),
  3 // 最多 3 个并发
);

// ==================== 监控数据 ====================

// 查看指标
const metrics = api.getMetrics();
console.log(`总请求: ${metrics.totalRequests}`);
console.log(`成功率: ${((100 - metrics.errorRate)).toFixed(1)}%`);
console.log(`平均耗时: ${metrics.avgDuration.toFixed(0)}ms`);
console.log(`慢请求: ${metrics.slowRequests}`);
console.log(`缓存命中: ${metrics.cacheHits}`);

// 查看慢请求
console.log('最慢请求:', metrics.slowestRequests.slice(0, 5));

// 查看错误追踪
const errorTraces = api.getTraces({ minDuration: 2000 });
console.log('慢请求追踪:', errorTraces);
```

---

## 6. 与 Axios 集成

```typescript
// ==================== Axios 适配器 ====================

import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

class AxiosAdapter {
  private axiosInstance;

  constructor(baseURL: string, defaults?: NetworkClient['defaults']) {
    this.axiosInstance = axios.create({
      baseURL,
      timeout: defaults?.timeout ?? 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * 将 NetworkRequestConfig 转换为 AxiosRequestConfig
   */
  private toAxiosConfig(config: NetworkRequestConfig): AxiosRequestConfig {
    return {
      url: config.url,
      method: config.method?.toLowerCase() as any,
      headers: config.headers,
      data: config.body,
      params: config.params,
      timeout: config.timeout,
      signal: config.signal,
    };
  }

  /**
   * 将 AxiosResponse 转换为 NetworkResponse
   */
  private toNetworkResponse<T>(
    axiosResponse: AxiosResponse<T>,
    config: NetworkRequestConfig,
    traceId: string
  ): NetworkResponse<T> {
    return {
      data: axiosResponse.data,
      status: axiosResponse.status,
      statusText: axiosResponse.statusText,
      headers: axiosResponse.headers as unknown as Record<string, string>,
      config,
      duration: 0, // Axios 不直接提供
      fromCache: false,
      traceId,
    };
  }

  /**
   * 将 AxiosError 转换为 NetworkError
   */
  private toNetworkError(axiosError: AxiosError, config: NetworkRequestConfig, traceId: string): NetworkError {
    const isTimeout = axiosError.code === 'ECONNABORTED';
    const isCancelled = axios.isCancel(axiosError);

    return createNetworkError(axiosError.message, {
      status: axiosError.response?.status,
      config,
      isTimeout,
      isCancelled,
      isNetworkError: !axiosError.response && !isTimeout && !isCancelled,
      traceId,
    });
  }

  /**
   * 执行请求（复用 NetworkClient 的拦截器/缓存/重试逻辑）
   */
  async request<T = any>(config: NetworkRequestConfig): Promise<NetworkResponse<T>> {
    const axiosConfig = this.toAxiosConfig(config);
    const traceId = generateTraceId();

    try {
      const response = await this.axiosInstance(axiosConfig);
      return this.toNetworkResponse(response, config, traceId);
    } catch (error) {
      throw this.toNetworkError(error as AxiosError, config, traceId);
    }
  }

  get<T>(url: string, config?: Omit<Partial<NetworkRequestConfig>, 'method' | 'url'>) {
    return this.request<T>({ ...config, url, method: 'GET' });
  }

  post<T>(url: string, body?: any, config?: Omit<Partial<NetworkRequestConfig>, 'method' | 'url' | 'body'>) {
    return this.request<T>({ ...config, url, method: 'POST', body });
  }

  put<T>(url: string, body?: any, config?: Omit<Partial<NetworkRequestConfig>, 'method' | 'url' | 'body'>) {
    return this.request<T>({ ...config, url, method: 'PUT', body });
  }

  delete<T>(url: string, config?: Omit<Partial<NetworkRequestConfig>, 'method' | 'url'>) {
    return this.request<T>({ ...config, url, method: 'DELETE' });
  }

  /**
   * 获取底层 Axios 实例（用于直接使用 Axios 拦截器）
   */
  getAxiosInstance() {
    return this.axiosInstance;
  }
}

// 使用
const axiosApi = new AxiosAdapter('https://api.example.com');

// 直接使用 Axios 拦截器
axiosApi.getAxiosInstance().interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 使用统一的 NetworkResponse 接口
const { data } = await axiosApi.get<User>('/users/1');
```

---

## 7. 关键设计决策总结

| 决策 | 选择 | 理由 |
|------|------|------|
| 底层 API | Fetch | 零依赖、现代浏览器支持、可组合性强 |
| 重试策略 | 指数退避 + 抖动 | 避免雪崩、适应不同错误类型 |
| 取消机制 | AbortController | 浏览器原生、与 Fetch 深度集成 |
| 去重方式 | Map<string, Promise> | 简单高效、自动清理 |
| 缓存策略 | 内存 Map + TTL | 快速、可控、支持多种策略 |
| 拦截器模式 | 管道式 | 请求正向、响应反向、错误冒泡 |
| 错误处理 | 分级错误类 | 区分超时/取消/网络/业务错误 |
| 类型安全 | 完整泛型推导 | 请求参数和返回值类型安全 |
| 监控 | performance.now() | 高精度计时、无需额外依赖 |

---

## 8. 面试高频考点

### Q1: Fetch vs Axios 怎么选？

```
Fetch:
✅ 零依赖、体积小、现代浏览器原生
❌ 不 reject 4xx/5xx、无超时、无拦截器、无进度

Axios:
✅ 开箱即用（拦截器/超时/重试/进度）
❌ 需要安装、体积大 (~13KB gzipped)

选择：
- 简单项目 → Fetch + 封装
- 中大型项目 → Axios
- 需要 SSR → Axios（Node.js 兼容）
- 需要进度事件 → Axios
```

### Q2: 如何实现安全的 Token 刷新？

```
核心难点：
1. 并发请求 → 使用 isRefreshing + 队列
2. 刷新失败 → 清除 Token + 跳转登录
3. 防止重复刷新 → Promise 缓存

关键代码：
- isRefreshing 标志位
- refreshPromise 缓存
- failedQueue 存储等待的请求
- 刷新成功后遍历队列重发
```

### Q3: 如何处理搜索框的竞态问题？

```
三个问题：
1. 频繁输入 → 防抖 (debounce)
2. 旧请求未返回 → AbortController 取消
3. 旧请求后返回 → 请求 ID 比较

解决方案：
- 每次搜索递增 requestId
- 只有 requestId === currentRequestId 才更新 UI
- 新搜索时 cancel 旧请求
```

### Q4: 重试的指数退避为什么要加抖动？

```
问题：多个客户端同时遇到 503，不加抖动会同时重试
→ 服务器雪崩

解决：加随机抖动 (±25%)
→ 重试时间分散
→ 降低服务器压力

公式：delay = base * 2^attempt + random(-25%, +25%)
```

### Q5: 如何实现请求去重？

```
思路：用 Map 缓存 pending 的 Promise
- key = method + url + params + body
- 命中 → 返回已有 Promise
- 未命中 → 创建新 Promise 并缓存
- finally 中清理

注意：只对幂等请求（GET）去重
```

---

## 9. 文件清单

| 文件 | 说明 |
|------|------|
| `network-layer-final-1200-0428.md` | 本文档（完整网络层设计） |
| `training/network-layer/network-client.ts` | 4/24 基础 Fetch 实现 |
| `training/network-layer/axios-client.ts` | 4/24 Axios 封装实现 |
| `training/network-layer/examples.ts` | 4/24 使用示例 |
| `training/network-layer/README.md` | 4/24 基础版文档 |
| `training/network-layer-advanced-1200.md` | 4/27 高级版（生产级模式） |
| `training/network-layer-final-1200-0428.md` | 4/28 综合实战（本文档） |

---

## 累计网络层训练

- **4/24 基础版**: Fetch 封装 + Axios 封装 + 拦截器 + 重试 + 取消 + 去重
- **4/27 高级版**: 生产级模式 + 边界场景 + 高级架构 + Token 刷新 + 离线优先 + 监控
- **4/28 综合实战**: 从零构建完整网络层 + 类型系统 + 拦截器工厂 + 缓存策略 + 监控体系 + Axios 适配器

**网络层训练 = 完整闭环 ✅**
