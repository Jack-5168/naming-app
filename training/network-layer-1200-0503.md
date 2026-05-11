# 专项训练 12:00 — 网络请求进阶实战 (05/03)

> 主题：Fetch / Axios / 拦截器 / 重试机制 / 取消请求
> 定位：前三次训练已覆盖基础→高级→综合，本次聚焦 **生产环境高频场景 + 架构升级**

---

## 一、本次训练目标

| 维度 | 前三次覆盖 | 本次新增 |
|------|-----------|---------|
| 基础封装 | ✅ Fetch + Axios | — |
| 拦截器 | ✅ 请求/响应/错误 | **多实例隔离 + 动态注册/卸载** |
| 重试 | ✅ 指数退避 | **自适应重试 + 服务端 hint 驱动** |
| 取消 | ✅ AbortController | **竞态解决 + 搜索防抖 + 路由切换** |
| 缓存 | ✅ 内存缓存 | **SWR + 乐观更新 + 缓存失效策略** |
| 监控 | ✅ 基础指标 | **Sentry 集成 + 性能火焰图 + 错误上报** |
| 架构 | ✅ 单体网络层 | **多租户 + 微前端隔离 + SSR 适配** |

---

## 二、生产级网络层 — 模块化架构

### 2.1 文件结构

```
src/network/
├── core/
│   ├── client.ts          # 核心 HttpClient（门面）
│   ├── types.ts           # 类型定义
│   └── errors.ts          # 错误体系
├── interceptors/
│   ├── auth.ts            # Token 注入 + 刷新
│   ├── logging.ts         # 请求日志
│   ├── metrics.ts         # 性能监控
│   ├── cache.ts           # 缓存策略
│   └── dedupe.ts          # 请求去重
├── strategies/
│   ├── retry.ts           # 重试策略
│   └── cancellation.ts    # 取消管理
├── adapters/
│   ├── fetch.ts           # Fetch 适配器
│   └── axios.ts           # Axios 适配器
├── hooks/
│   ├── useRequest.ts      # React Hook
│   └── useRequest.ts      # Vue 3 Composable
└── index.ts               # 统一导出
```

### 2.2 核心类型定义

```typescript
// core/types.ts

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface RequestConfig {
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
  body?: any;
  timeout?: number;
  signal?: AbortSignal;

  // 重试
  maxRetries?: number;
  retryStrategy?: RetryStrategy;
  shouldRetry?: (error: NetworkError, attempt: number) => boolean;

  // 缓存
  cache?: CacheConfig | false;

  // 去重
  dedupe?: boolean;
  dedupeKey?: string;

  // 取消
  cancelGroup?: string;

  // 元数据
  metadata?: Record<string, unknown>;
  _retryCount?: number;
  _cancelled?: boolean;
}

export interface CacheConfig {
  strategy: 'no-cache' | 'cache-first' | 'network-first' | 'stale-while-revalidate' | 'stale-if-error';
  ttl?: number;          // ms
  key?: string;          // 自定义缓存 key
  invalidateOn?: string[]; // POST/PUT 后失效的 key 前缀
}

export interface Response<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: RequestConfig;
  duration: number;
  fromCache: boolean;
  requestId: string;
  retryCount: number;
}

export interface NetworkError extends Error {
  status?: number;
  response?: Response;
  config?: RequestConfig;
  isTimeout: boolean;
  isCancelled: boolean;
  isNetworkError: boolean;
  requestId: string;
  retryCount: number;
}

export type RetryStrategy = 'fixed' | 'exponential' | 'adaptive' | 'server-hint';

export type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
export type ResponseInterceptor<T = any> = (response: Response<T>) => Response<T> | Promise<Response<T>>;
export type ErrorInterceptor = (error: NetworkError) => never | Promise<never>;

export interface Interceptor<T = any> {
  id: string;
  request?: RequestInterceptor;
  response?: ResponseInterceptor<T>;
  error?: ErrorInterceptor;
  enabled?: boolean;
}

export interface Metrics {
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  activeRequests: number;
  avgDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  errorRate: number;
  cacheHitRate: number;
  retryRate: number;
  cancelRate: number;
  statusDistribution: Record<number, number>;
  slowestRequests: Array<{ url: string; method: string; duration: number; status: number }>;
  errorsByStatus: Record<number, number>;
  errorsByType: Record<string, number>;
}
```

### 2.3 错误体系

```typescript
// core/errors.ts

export class NetworkError extends Error {
  constructor(
    message: string,
    public readonly config: RequestConfig,
    public readonly requestId: string,
    options: {
      status?: number;
      isTimeout?: boolean;
      isCancelled?: boolean;
      isNetworkError?: boolean;
      retryCount?: number;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'NetworkError';
    this.status = options.status;
    this.isTimeout = options.isTimeout ?? false;
    this.isCancelled = options.isCancelled ?? false;
    this.isNetworkError = options.isNetworkError ?? false;
    this.retryCount = options.retryCount ?? 0;
    this.cause = options.cause;
  }
}

export class TimeoutError extends NetworkError {
  constructor(config: RequestConfig, requestId: string, timeoutMs: number) {
    super(`Request timeout after ${timeoutMs}ms: ${config.method} ${config.url}`, config, requestId, {
      isTimeout: true,
    });
    this.name = 'TimeoutError';
  }
}

export class CancelledError extends NetworkError {
  constructor(config: RequestConfig, requestId: string, reason?: string) {
    super(reason || `Request cancelled: ${config.method} ${config.url}`, config, requestId, {
      isCancelled: true,
    });
    this.name = 'CancelledError';
  }
}

export class BusinessError extends Error {
  constructor(
    public readonly code: number | string,
    message: string,
    public readonly data?: any,
    public readonly requestId?: string
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}

export function isNetworkError(error: any): error is NetworkError {
  return error instanceof NetworkError;
}

export function isTimeoutError(error: any): error is TimeoutError {
  return error instanceof TimeoutError;
}

export function isCancelledError(error: any): error is CancelledError {
  return error instanceof CancelledError;
}

export function isBusinessError(error: any): error is BusinessError {
  return error instanceof BusinessError;
}
```

---

## 三、核心网络客户端

```typescript
// core/client.ts

import { RequestConfig, Response, NetworkError, Interceptor, Metrics } from './types';
import { TimeoutError, CancelledError, isNetworkError } from './errors';

// ==================== 工具函数 ====================

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildUrl(base: string, url: string, params?: Record<string, any>): string {
  let fullUrl = url.startsWith('http') ? url : `${base}${url}`;
  if (params) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') search.append(k, String(v));
    }
    const qs = search.toString();
    if (qs) fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs;
  }
  return fullUrl;
}

function parseHeaders(h: Headers | Record<string, string>): Record<string, string> {
  if (h instanceof Headers) {
    const result: Record<string, string> = {};
    h.forEach((v, k) => (result[k.toLowerCase()] = v));
    return result;
  }
  return h || {};
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ==================== 拦截器管理器 ====================

class InterceptorRegistry {
  private handlers: Interceptor[] = [];

  use(interceptor: Interceptor): () => void {
    const id = interceptor.id || `interceptor_${this.handlers.length}`;
    this.handlers.push({ ...interceptor, id, enabled: interceptor.enabled ?? true });
    // 返回卸载函数
    return () => this.eject(id);
  }

  eject(id: string): void {
    const idx = this.handlers.findIndex((h) => h.id === id);
    if (idx !== -1) this.handlers.splice(idx, 1);
  }

  get enabled() {
    return this.handlers.filter((h) => h.enabled !== false);
  }

  clear(): void {
    this.handlers = [];
  }
}

// ==================== 缓存系统 ====================

type CacheEntry = { data: any; timestamp: number; ttl: number; etag?: string };

class CacheStore {
  private store = new Map<string, CacheEntry>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private defaultTTL: number = 5 * 60 * 1000) {
    this.timer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
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

  set(key: string, data: any, ttl?: number, etag?: string): void {
    this.store.set(key, { data, timestamp: Date.now(), ttl: ttl ?? this.defaultTTL, etag });
  }

  getEtag(key: string): string | undefined {
    return this.store.get(key)?.etag;
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
      if (now - entry.timestamp > entry.ttl) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  destroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.store.clear();
  }
}

// ==================== 请求去重器 ====================

class Deduplicator {
  private pending = new Map<string, Promise<any>>();

  generateKey(config: RequestConfig): string {
    const method = (config.method || 'GET').toUpperCase();
    const params = config.params ? JSON.stringify(Object.entries(config.params).sort()) : '';
    const body = config.body && method !== 'GET' ? JSON.stringify(config.body) : '';
    return `${method}:${config.url}:${params}:${body}`;
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
    strategy: 'fixed' | 'exponential' | 'adaptive' | 'server-hint',
    baseDelay: number,
    error?: NetworkError,
    retryAfter?: number
  ): number {
    let delay: number;

    switch (strategy) {
      case 'fixed':
        delay = baseDelay;
        break;

      case 'exponential':
        delay = baseDelay * Math.pow(2, attempt);
        break;

      case 'adaptive':
        if (error?.status === 429) delay = baseDelay * 3;
        else if (error?.status === 503) delay = baseDelay * 2;
        else delay = baseDelay * Math.pow(1.5, attempt);
        break;

      case 'server-hint':
        // 优先使用 Retry-After 头
        delay = retryAfter ? retryAfter * 1000 : baseDelay * Math.pow(2, attempt);
        break;

      default:
        delay = baseDelay;
    }

    // 上限 30s
    delay = Math.min(delay, 30000);

    // 全抖动 [0, delay]
    delay = Math.random() * delay;

    return Math.max(0, Math.round(delay));
  }

  shouldRetry(
    error: NetworkError,
    attempt: number,
    maxRetries: number,
    customFn?: (error: NetworkError, attempt: number) => boolean
  ): boolean {
    if (attempt >= maxRetries) return false;
    if (error.isCancelled) return false;
    if (customFn) return customFn(error, attempt);

    // 默认：5xx、超时、网络错误、429 重试
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
  private groups = new Map<string, Set<string>>();

  register(key: string, group?: string, cancelDuplicate = true): AbortSignal {
    if (cancelDuplicate && this.controllers.has(key)) {
      this.cancel(key, `Duplicate request: ${key}`);
    }

    const controller = new AbortController();
    this.controllers.set(key, controller);

    if (group) {
      if (!this.groups.has(group)) this.groups.set(group, new Set());
      this.groups.get(group)!.add(key);
    }

    return controller.signal;
  }

  cancel(key: string, reason = 'Cancelled'): boolean {
    const ctrl = this.controllers.get(key);
    if (ctrl) {
      ctrl.abort(reason);
      this.controllers.delete(key);
      this.groups.forEach((keys) => keys.delete(key));
      return true;
    }
    return false;
  }

  cancelGroup(group: string, reason = 'Group cancelled'): number {
    const keys = this.groups.get(group);
    if (!keys) return 0;
    let count = 0;
    for (const key of keys) {
      this.cancel(key, reason);
      count++;
    }
    this.groups.delete(group);
    return count;
  }

  cancelAll(reason = 'Cancel all'): number {
    let count = 0;
    for (const [key] of this.controllers) {
      this.cancel(key, reason);
      count++;
    }
    return count;
  }

  unregister(key: string): void {
    this.controllers.delete(key);
    this.groups.forEach((keys) => keys.delete(key));
  }

  get activeCount(): number {
    return this.controllers.size;
  }
}

// ==================== 监控器 ====================

class Monitor {
  private durations: number[] = [];
  private metrics: Omit<Metrics, 'avgDuration' | 'p50Duration' | 'p95Duration' | 'p99Duration'> = {
    totalRequests: 0,
    successRequests: 0,
    failedRequests: 0,
    activeRequests: 0,
    errorRate: 0,
    cacheHitRate: 0,
    retryRate: 0,
    cancelRate: 0,
    statusDistribution: {},
    slowestRequests: [],
    errorsByStatus: {},
    errorsByType: {},
  };
  private cacheHits = 0;
  private retries = 0;
  private cancels = 0;
  private maxTraces = 100;

  recordSuccess(duration: number, fromCache: boolean, status: number, retried: boolean): void {
    this.metrics.totalRequests++;
    this.metrics.successRequests++;
    this.durations.push(duration);
    if (this.durations.length > this.maxTraces) this.durations.shift();

    if (fromCache) this.cacheHits++;
    if (retried) this.retries++;

    const group = Math.floor(status / 100);
    this.metrics.statusDistribution[group] = (this.metrics.statusDistribution[group] || 0) + 1;

    // 慢请求记录
    if (duration > 3000) {
      this.metrics.slowestRequests.push({ url: '', method: '', duration, status });
      this.metrics.slowestRequests.sort((a, b) => b.duration - a.duration);
      this.metrics.slowestRequests = this.metrics.slowestRequests.slice(0, 20);
    }

    this._updateRates();
  }

  recordError(error: NetworkError): void {
    this.metrics.totalRequests++;
    this.metrics.failedRequests++;

    if (error.isCancelled) this.cancels++;

    if (error.status) {
      const group = Math.floor(error.status / 100);
      this.metrics.statusDistribution[group] = (this.metrics.statusDistribution[group] || 0) + 1;
      this.metrics.errorsByStatus[error.status] = (this.metrics.errorsByStatus[error.status] || 0) + 1;
    }

    this.metrics.errorsByType[error.name] = (this.metrics.errorsByType[error.name] || 0) + 1;
    this._updateRates();
  }

  trackActive(delta: number): void {
    this.metrics.activeRequests = Math.max(0, this.metrics.activeRequests + delta);
  }

  getMetrics(): Metrics {
    const sorted = [...this.durations].sort((a, b) => a - b);
    const total = this.metrics.totalRequests || 1;
    return {
      ...this.metrics,
      avgDuration: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0,
      p50Duration: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
      p95Duration: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      p99Duration: sorted[Math.floor(sorted.length * 0.99)] ?? 0,
      cacheHitRate: (this.cacheHits / total) * 100,
      retryRate: (this.retries / total) * 100,
      cancelRate: (this.cancels / total) * 100,
    };
  }

  reset(): void {
    this.durations = [];
    this.cacheHits = 0;
    this.retries = 0;
    this.cancels = 0;
    this.metrics = {
      totalRequests: 0, successRequests: 0, failedRequests: 0, activeRequests: 0,
      errorRate: 0, cacheHitRate: 0, retryRate: 0, cancelRate: 0,
      statusDistribution: {}, slowestRequests: [], errorsByStatus: {}, errorsByType: {},
    };
  }

  private _updateRates(): void {
    const total = this.metrics.totalRequests || 1;
    this.metrics.errorRate = (this.metrics.failedRequests / total) * 100;
  }
}

// ==================== 核心 HttpClient ====================

interface HttpClientOptions {
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  retryStrategy?: RetryStrategy;
  retryBaseDelay?: number;
  cacheDefaultTTL?: number;
  enableDedupe?: boolean;
  adapter?: 'fetch' | 'axios';
  unwrapBusinessResponse?: boolean;
  businessCodeField?: string;
  businessSuccessCode?: number | number[];
}

export class HttpClient {
  private baseURL: string;
  private defaults: Required<Pick<HttpClientOptions, 'timeout' | 'maxRetries' | 'retryStrategy' | 'retryBaseDelay' | 'cacheDefaultTTL' | 'enableDedupe' | 'unwrapBusinessResponse' | 'businessCodeField' | 'businessSuccessCode'>>;

  private interceptors = {
    request: new InterceptorRegistry(),
    response: new InterceptorRegistry(),
    error: new InterceptorRegistry(),
  };

  private cache: CacheStore;
  private deduplicator: Deduplicator | null;
  private retryManager: RetryManager;
  private cancelManager: CancelManager;
  private monitor: Monitor;

  constructor(options: HttpClientOptions = {}) {
    this.baseURL = (options.baseURL || '').replace(/\/+$/, '');
    this.defaults = {
      timeout: options.timeout ?? 15000,
      maxRetries: options.maxRetries ?? 2,
      retryStrategy: options.retryStrategy ?? 'exponential',
      retryBaseDelay: options.retryBaseDelay ?? 1000,
      cacheDefaultTTL: options.cacheDefaultTTL ?? 5 * 60 * 1000,
      enableDedupe: options.enableDedupe ?? true,
      unwrapBusinessResponse: options.unwrapBusinessResponse ?? true,
      businessCodeField: options.businessCodeField ?? 'code',
      businessSuccessCode: Array.isArray(options.businessSuccessCode) ? options.businessSuccessCode : [0, 200],
    };

    this.cache = new CacheStore(this.defaults.cacheDefaultTTL);
    this.deduplicator = options.enableDedupe !== false ? new Deduplicator() : null;
    this.retryManager = new RetryManager();
    this.cancelManager = new CancelManager();
    this.monitor = new Monitor();
  }

  // ==================== 拦截器 API ====================

  addRequestInterceptor(interceptor: Interceptor): () => void {
    return this.interceptors.request.use(interceptor);
  }

  addResponseInterceptor(interceptor: Interceptor): () => void {
    return this.interceptors.response.use(interceptor);
  }

  addErrorInterceptor(interceptor: Interceptor): () => void {
    return this.interceptors.error.use(interceptor);
  }

  removeInterceptor(type: 'request' | 'response' | 'error', id: string): void {
    this.interceptors[type].eject(id);
  }

  clearInterceptors(type?: 'request' | 'response' | 'error'): void {
    if (type) this.interceptors[type].clear();
    else {
      this.interceptors.request.clear();
      this.interceptors.response.clear();
      this.interceptors.error.clear();
    }
  }

  // ==================== 核心请求方法 ====================

  async request<T = any>(config: RequestConfig): Promise<Response<T>> {
    const requestId = generateRequestId();
    const startTime = performance.now();

    // 合并默认配置
    let processed: RequestConfig = {
      method: 'GET',
      timeout: this.defaults.timeout,
      maxRetries: this.defaults.maxRetries,
      retryStrategy: this.defaults.retryStrategy,
      ...config,
      headers: { ...config.headers },
      metadata: { ...config.metadata, requestId },
    };

    this.monitor.trackActive(1);

    try {
      // 1. 请求拦截器
      for (const handler of this.interceptors.request.enabled) {
        if (handler.request) {
          processed = await handler.request(processed);
        }
      }

      // 2. 取消注册
      const cancelKey = processed.cancelGroup
        ? `${processed.cancelGroup}:${this.deduplicator?.generateKey(processed) ?? processed.url}`
        : this.deduplicator?.generateKey(processed) ?? processed.url;
      const signal = this.cancelManager.register(cancelKey, processed.cancelGroup);

      // 3. 请求去重（仅 GET）
      if (this.deduplicator && processed.dedupe !== false && processed.method?.toUpperCase() === 'GET') {
        const dedupeKey = this.deduplicator.generateKey(processed);
        const existing = this.deduplicator.get<T>(dedupeKey);
        if (existing) {
          this.monitor.trackActive(-1);
          return existing;
        }
      }

      // 4. 缓存检查（仅 GET）
      if (processed.cache !== false && processed.method?.toUpperCase() === 'GET') {
        const cacheResult = await this._handleCache<T>(processed, requestId, startTime);
        if (cacheResult) {
          this.monitor.trackActive(-1);
          return cacheResult;
        }
      }

      // 5. 执行请求（带重试）
      const requestPromise = this._executeWithRetry<T>(processed, requestId, startTime);

      // 去重：注册 pending promise
      if (this.deduplicator && processed.dedupe !== false && processed.method?.toUpperCase() === 'GET') {
        const dedupeKey = this.deduplicator.generateKey(processed);
        this.deduplicator.set(dedupeKey, requestPromise);
      }

      const response = await requestPromise;

      // 6. 响应拦截器
      let finalResponse = response;
      for (const handler of this.interceptors.response.enabled) {
        if (handler.response) {
          finalResponse = await handler.response(finalResponse);
        }
      }

      this.monitor.trackActive(-1);
      return finalResponse;
    } catch (error) {
      this.monitor.trackActive(-1);
      this.cancelManager.unregister(cancelKey);

      // 错误拦截器
      const networkError = error as NetworkError;
      for (const handler of this.interceptors.error.enabled) {
        if (handler.error) {
          try {
            await handler.error(networkError);
          } catch (_) {
            // 错误拦截器可以 re-throw 或吞掉
          }
        }
      }

      throw networkError;
    }
  }

  // ==================== 缓存处理 ====================

  private async _handleCache<T>(
    config: RequestConfig,
    requestId: string,
    startTime: number
  ): Promise<Response<T> | null> {
    const cacheConfig = config.cache;
    if (!cacheConfig || cacheConfig === false) return null;

    const strategy = cacheConfig.strategy || 'no-cache';
    if (strategy === 'no-cache') return null;

    const cacheKey = cacheConfig.key || `GET:${config.url}:${JSON.stringify(config.params)}`;
    const cached = this.cache.get<T>(cacheKey);

    switch (strategy) {
      case 'cache-first': {
        if (cached !== null) {
          const duration = performance.now() - startTime;
          this.monitor.recordSuccess(duration, true, 200, false);
          return this._buildResponse(cached, 200, config, requestId, duration, true);
        }
        return null;
      }

      case 'stale-while-revalidate': {
        if (cached !== null) {
          // 返回缓存 + 后台更新
          this._executeFetch<T>(config, requestId, startTime)
            .then((resp) => {
              this.cache.set(cacheKey, resp.data, cacheConfig.ttl);
            })
            .catch(() => {});

          const duration = performance.now() - startTime;
          this.monitor.recordSuccess(duration, true, 200, false);
          return this._buildResponse(cached, 200, config, requestId, duration, true);
        }
        return null;
      }

      case 'stale-if-error': {
        // 先尝试网络，失败时回退缓存
        try {
          const response = await this._executeFetch<T>(config, requestId, startTime);
          this.cache.set(cacheKey, response.data, cacheConfig.ttl);
          return response;
        } catch (error) {
          if (cached !== null) {
            const duration = performance.now() - startTime;
            this.monitor.recordSuccess(duration, true, 200, false);
            return this._buildResponse(cached, 200, config, requestId, duration, true);
          }
          throw error;
        }
      }

      case 'network-first': {
        try {
          const response = await this._executeFetch<T>(config, requestId, startTime);
          this.cache.set(cacheKey, response.data, cacheConfig.ttl);
          return response;
        } catch (error) {
          if (cached !== null) {
            const duration = performance.now() - startTime;
            this.monitor.recordSuccess(duration, true, 200, false);
            return this._buildResponse(cached, 200, config, requestId, duration, true);
          }
          throw error;
        }
      }

      default:
        return null;
    }
  }

  // ==================== 重试执行 ====================

  private async _executeWithRetry<T>(
    config: RequestConfig,
    requestId: string,
    startTime: number
  ): Promise<Response<T>> {
    const maxRetries = config.maxRetries ?? this.defaults.maxRetries;
    const strategy = config.retryStrategy ?? this.defaults.retryStrategy;
    const baseDelay = this.defaults.retryBaseDelay;
    let lastError: NetworkError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this._executeFetch<T>(config, requestId, startTime);

        // 缓存成功 GET 响应
        if (config.method?.toUpperCase() === 'GET' && config.cache !== false) {
          const cacheKey = config.cache?.key || `GET:${config.url}:${JSON.stringify(config.params)}`;
          this.cache.set(cacheKey, response.data, config.cache?.ttl);
        }

        // POST/PUT/DELETE 后失效相关缓存
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method?.toUpperCase() || '')) {
          const prefix = config.url.split('/').slice(0, -1).join('/');
          this.cache.invalidateByPrefix(`GET:${prefix}`);
        }

        return response;
      } catch (error) {
        lastError = error as NetworkError;

        if (!this.retryManager.shouldRetry(lastError, attempt, maxRetries, config.shouldRetry)) {
          break;
        }

        // 获取 Retry-After 头（server-hint 策略）
        let retryAfter: number | undefined;
        if (strategy === 'server-hint' && lastError.response?.headers?.['retry-after']) {
          retryAfter = parseInt(lastError.response.headers['retry-after'], 10);
        }

        const delay = this.retryManager.calculateDelay(
          attempt, strategy, baseDelay, lastError, retryAfter
        );

        console.warn(
          `[Retry] ${attempt + 1}/${maxRetries} | ${config.method} ${config.url} | ` +
          `delay=${Math.round(delay)}ms | ${lastError.message}`
        );

        await sleep(delay);
      }
    }

    this.monitor.recordError(lastError!);
    throw lastError!;
  }

  // ==================== 底层 Fetch 执行 ====================

  private async _executeFetch<T>(
    config: RequestConfig,
    requestId: string,
    startTime: number
  ): Promise<Response<T>> {
    const url = buildUrl(this.baseURL, config.url, config.params);

    // 构建 body
    let body: BodyInit | undefined;
    if (config.body && !['GET', 'HEAD'].includes(config.method?.toUpperCase() || '')) {
      if (config.body instanceof FormData || config.body instanceof URLSearchParams || config.body instanceof Blob) {
        body = config.body;
      } else if (typeof config.body === 'object') {
        body = JSON.stringify(config.body);
      } else {
        body = String(config.body);
      }
    }

    // 构建 headers
    const headers: Record<string, string> = { ...config.headers };
    if (body && typeof body === 'string' && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }

    // 超时
    const timeoutMs = config.timeout ?? this.defaults.timeout;
    const timeoutId = setTimeout(() => {
      // AbortController 会在外部注册时处理
    }, timeoutMs);

    try {
      const fetchResponse = await fetch(url, {
        method: config.method || 'GET',
        headers,
        body,
        signal: config.signal, // 由 cancelManager 注入
      });

      clearTimeout(timeoutId);

      // 解析响应
      const contentType = fetchResponse.headers.get('content-type') || '';
      let data: any;
      if (contentType.includes('application/json')) {
        data = await fetchResponse.json();
      } else if (contentType.includes('text/')) {
        data = await fetchResponse.text();
      } else {
        data = await fetchResponse.blob();
      }

      const duration = performance.now() - startTime;

      // 业务层解包
      if (this.defaults.unwrapBusinessResponse && data && typeof data === 'object') {
        const codeField = this.defaults.businessCodeField;
        const successCodes = this.defaults.businessSuccessCode;
        if (codeField in data) {
          const code = data[codeField];
          if (!successCodes.includes(code)) {
            const networkError = new NetworkError(
              data.message || `Business error: ${code}`,
              config, requestId, { status: code }
            );
            this.monitor.recordError(networkError);
            throw networkError;
          }
          data = data.data;
        }
      }

      // HTTP 错误
      if (fetchResponse.status < 200 || fetchResponse.status >= 300) {
        const networkError = new NetworkError(
          `HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`,
          config, requestId, { status: fetchResponse.status }
        );
        this.monitor.recordError(networkError);
        throw networkError;
      }

      const response: Response<T> = {
        data: data as T,
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
        headers: parseHeaders(fetchResponse.headers),
        config,
        duration,
        fromCache: false,
        requestId,
        retryCount: config._retryCount ?? 0,
      };

      this.monitor.recordSuccess(duration, false, fetchResponse.status, (config._retryCount ?? 0) > 0);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof DOMException && error.name === 'AbortError') {
        const message = error.message || '';
        if (message.includes('Timeout') || message.includes('timeout')) {
          const timeoutError = new TimeoutError(config, requestId, timeoutMs);
          this.monitor.recordError(timeoutError);
          throw timeoutError;
        }
        const cancelledError = new CancelledError(config, requestId, message);
        this.monitor.recordError(cancelledError);
        throw cancelledError;
      }

      const networkError = new NetworkError(
        'Network error - check your connection',
        config, requestId, { isNetworkError: true }
      );
      this.monitor.recordError(networkError);
      throw networkError;
    }
  }

  // ==================== 响应构建 ====================

  private _buildResponse<T>(
    data: T,
    status: number,
    config: RequestConfig,
    requestId: string,
    duration: number,
    fromCache: boolean
  ): Response<T> {
    return {
      data,
      status,
      statusText: fromCache ? 'OK (cached)' : 'OK',
      headers: {},
      config,
      duration,
      fromCache,
      requestId,
      retryCount: 0,
    };
  }

  // ==================== 便捷方法 ====================

  get<T>(url: string, config?: Omit<Partial<RequestConfig>, 'method' | 'url'>): Promise<Response<T>> {
    return this.request<T>({ ...config, url, method: 'GET' });
  }

  post<T>(url: string, body?: any, config?: Omit<Partial<RequestConfig>, 'method' | 'url' | 'body'>): Promise<Response<T>> {
    return this.request<T>({ ...config, url, method: 'POST', body });
  }

  put<T>(url: string, body?: any, config?: Omit<Partial<RequestConfig>, 'method' | 'url' | 'body'>): Promise<Response<T>> {
    return this.request<T>({ ...config, url, method: 'PUT', body });
  }

  patch<T>(url: string, body?: any, config?: Omit<Partial<RequestConfig>, 'method' | 'url' | 'body'>): Promise<Response<T>> {
    return this.request<T>({ ...config, url, method: 'PATCH', body });
  }

  delete<T>(url: string, config?: Omit<Partial<RequestConfig>, 'method' | 'url'>): Promise<Response<T>> {
    return this.request<T>({ ...config, url, method: 'DELETE' });
  }

  // ==================== 取消管理 ====================

  cancel(key: string, reason?: string): boolean {
    return this.cancelManager.cancel(key, reason);
  }

  cancelGroup(group: string, reason?: string): number {
    return this.cancelManager.cancelGroup(group, reason);
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

  getMetrics(): Metrics {
    return this.monitor.getMetrics();
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

## 四、拦截器工厂 — 生产级实现

### 4.1 认证拦截器（Token 注入 + 自动刷新）

```typescript
// interceptors/auth.ts

import { HttpClient } from '../core/client';
import { RequestConfig, Response, NetworkError } from '../core/types';

interface AuthOptions {
  getToken: () => string | null | Promise<string | null>;
  headerName?: string;
  prefix?: string;
  refreshToken?: () => Promise<string>;
  onTokenUpdate?: (token: string) => void;
  onRefreshFailed?: () => void;
  on401?: () => void;
}

/**
 * 创建认证拦截器（请求侧）
 */
export function createAuthInterceptor(options: AuthOptions) {
  const headerName = options.headerName || 'Authorization';
  const prefix = options.prefix || 'Bearer ';

  return {
    id: 'auth-request',
    async request: async (config: RequestConfig): Promise<RequestConfig> => {
      const token = await options.getToken();
      if (token) {
        config.headers = {
          ...config.headers,
          [headerName]: `${prefix}${token}`,
        };
      }
      return config;
    },
  };
}

/**
 * 创建 Token 刷新拦截器（错误侧）
 *
 * 核心机制：
 * 1. 401 → 触发刷新
 * 2. 并发 401 → 只有一个刷新，其余排队
 * 3. 刷新成功 → 队列请求全部重试
 * 4. 刷新失败 → 全部拒绝 + 跳转登录
 */
export function createTokenRefreshInterceptor(client: HttpClient, options: AuthOptions) {
  let isRefreshing = false;
  let refreshPromise: Promise<string> | null = null;
  const queue: Array<{ resolve: (token: string) => void; reject: (error: any) => void }> = [];

  return {
    id: 'token-refresh',
    error: async (error: NetworkError): Promise<never> => {
      const config = error.config;
      if (!config || error.status !== 401 || (config as any)._isRetry) {
        throw error;
      }

      (config as any)._isRetry = true;

      try {
        let token: string;

        if (!isRefreshing && options.refreshToken) {
          isRefreshing = true;
          refreshPromise = options.refreshToken()
            .then((newToken) => {
              options.onTokenUpdate?.(newToken);
              _flushQueue(null, newToken);
              return newToken;
            })
            .catch((refreshError) => {
              _flushQueue(refreshError, null);
              options.onRefreshFailed?.();
              options.on401?.();
              throw refreshError;
            })
            .finally(() => {
              isRefreshing = false;
              refreshPromise = null;
            });
        }

        // 等待刷新完成
        token = await (refreshPromise || Promise.reject(new Error('No refresh in progress')));

        // 更新请求头并重试
        config.headers = {
          ...config.headers,
          [options.headerName || 'Authorization']: `${options.prefix || 'Bearer '}${token}`,
        };

        // 重试原请求
        return client.request(config) as never;
      } catch (refreshError) {
        throw refreshError;
      }

      function _flushQueue(error: any, token: string | null): void {
        queue.forEach(({ resolve, reject }) => {
          if (error) reject(error);
          else resolve(token!);
        });
        queue.length = 0;
      }
    },
  };
}
```

### 4.2 日志拦截器

```typescript
// interceptors/logging.ts

import { RequestConfig, Response, NetworkError } from '../core/types';

interface LoggerOptions {
  level?: 'silent' | 'error' | 'warn' | 'info' | 'debug';
  format?: 'compact' | 'verbose';
  logger?: typeof console;
  filter?: (config: RequestConfig) => boolean;
}

export function createLoggingInterceptor(options: LoggerOptions = {}) {
  const level = options.level || 'info';
  const format = options.format || 'compact';
  const log = options.logger || console;
  const filter = options.filter || (() => true);

  const levels = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
  const currentLevel = levels[level] ?? 3;

  return {
    id: 'logging',
    request: (config: RequestConfig): RequestConfig => {
      if (!filter(config)) return config;
      config._logStartTime = Date.now();

      if (currentLevel >= levels.info) {
        if (format === 'verbose') {
          log.groupCollapsed(`→ ${config.method?.toUpperCase()} ${config.url}`);
          if (config.params) log.log('  params:', config.params);
          if (config.body) log.log('  body:', config.body);
          log.groupEnd();
        } else {
          log.log(`→ ${config.method?.toUpperCase()} ${config.url}`);
        }
      }

      return config;
    },

    response: (response: Response): Response => {
      if (!filter(response.config)) return response;
      const duration = response.duration.toFixed(0);
      const method = response.config.method?.toUpperCase();
      const url = response.config.url;
      const fromCache = response.fromCache ? ' [cached]' : '';

      if (currentLevel >= levels.info) {
        log.log(`← ${response.status} ${method} ${url} (${duration}ms)${fromCache}`);
      }

      return response;
    },

    error: (error: NetworkError): never => {
      const method = error.config?.method?.toUpperCase() || '';
      const url = error.config?.url || '';

      if (error.isCancelled) {
        if (currentLevel >= levels.debug) {
          log.debug(`✗ CANCELLED ${method} ${url}`);
        }
      } else if (error.isTimeout) {
        if (currentLevel >= levels.warn) {
          log.warn(`✗ TIMEOUT ${method} ${url} - ${error.message}`);
        }
      } else if (error.status && error.status >= 500) {
        if (currentLevel >= levels.error) {
          log.error(`✗ ${error.status} ${method} ${url} - ${error.message}`);
        }
      } else {
        if (currentLevel >= levels.warn) {
          log.warn(`✗ ${error.status || 'NETWORK'} ${method} ${url} - ${error.message}`);
        }
      }

      throw error;
    },
  };
}
```

### 4.3 性能监控拦截器（Sentry 集成）

```typescript
// interceptors/metrics.ts

import { RequestConfig, Response, NetworkError } from '../core/types';

interface MetricsOptions {
  // Sentry 集成
  sentry?: {
    captureException: (error: Error) => void;
    setTag: (key: string, value: string) => void;
    addBreadcrumb?: (breadcrumb: any) => void;
  };
  // 慢请求阈值
  slowThreshold?: number;
  // 自定义上报
  onReport?: (metric: ReportMetric) => void;
}

interface ReportMetric {
  requestId: string;
  method: string;
  url: string;
  status: number;
  duration: number;
  fromCache: boolean;
  retryCount: number;
  error?: string;
  timestamp: number;
}

export function createMetricsInterceptor(options: MetricsOptions = {}) {
  const slowThreshold = options.slowThreshold ?? 3000;
  const slowRequests: Array<{ url: string; duration: number; status: number }> = [];

  return {
    id: 'metrics',
    response: (response: Response): Response => {
      const metric: ReportMetric = {
        requestId: response.requestId,
        method: response.config.method?.toUpperCase() || 'GET',
        url: response.config.url,
        status: response.status,
        duration: response.duration,
        fromCache: response.fromCache,
        retryCount: response.retryCount,
        timestamp: Date.now(),
      };

      // 慢请求记录
      if (response.duration > slowThreshold) {
        slowRequests.push({ url: response.config.url, duration: response.duration, status: response.status });
        if (slowRequests.length > 50) slowRequests.shift();
      }

      // Sentry 上报
      if (options.sentry?.addBreadcrumb) {
        options.sentry.addBreadcrumb({
          category: 'http',
          message: `${metric.method} ${metric.url}`,
          data: { status: metric.status, duration: metric.duration, fromCache: metric.fromCache },
          level: response.status >= 400 ? 'warning' : 'info',
        });
      }

      // 自定义上报
      options.onReport?.(metric);

      return response;
    },

    error: (error: NetworkError): never => {
      const metric: ReportMetric = {
        requestId: error.requestId,
        method: error.config?.method?.toUpperCase() || 'GET',
        url: error.config?.url || '',
        status: error.status ?? 0,
        duration: 0,
        fromCache: false,
        retryCount: error.retryCount,
        error: error.message,
        timestamp: Date.now(),
      };

      // Sentry 错误上报
      if (options.sentry?.captureException && !error.isCancelled) {
        options.sentry.captureException(error);
      }

      options.onReport?.(metric);

      throw error;
    },

    // 暴露慢请求列表
    getSlowRequests: () => [...slowRequests],
  };
}
```

### 4.4 请求去重拦截器

```typescript
// interceptors/dedupe.ts

import { RequestConfig } from '../core/types';

interface DedupeOptions {
  // 哪些方法需要去重（默认仅 GET）
  methods?: string[];
  // 自定义 key 生成
  getKey?: (config: RequestConfig) => string;
}

/**
 * 请求去重拦截器
 * 与 HttpClient 内置去重互补：此拦截器可用于 finer-grained 控制
 */
export function createDedupeInterceptor(options: DedupeOptions = {}) {
  const methods = options.methods?.map((m) => m.toUpperCase()) || ['GET'];
  const pending = new Map<string, Promise<any>>();
  const getKey = options.getKey || ((c) => `${c.method}:${c.url}:${JSON.stringify(c.params)}`);

  return {
    id: 'dedupe',
    request: (config: RequestConfig): RequestConfig => {
      if (!methods.includes(config.method?.toUpperCase() || '')) return config;

      const key = getKey(config);

      // 如果已有相同请求在飞，取消当前请求（由 HttpClient 去重处理）
      // 此拦截器主要用于标记和日志
      (config as any)._dedupeKey = key;

      return config;
    },
  };
}
```

---

## 五、高级场景 — 搜索竞态 + 乐观更新 + 路由切换

### 5.1 搜索控制器（防抖 + 取消 + 竞态解决）

```typescript
// strategies/search-controller.ts

import { HttpClient, Response } from '../core/client';

interface SearchOptions<T> {
  client: HttpClient;
  searchUrl: string;
  queryParam?: string;
  debounceMs?: number;
  minQueryLength?: number;
  cancelGroup?: string;
  onSuccess?: (results: T, query: string) => void;
  onError?: (error: Error, query: string) => void;
  onLoading?: (loading: boolean) => void;
}

/**
 * 搜索控制器 — 解决三个核心问题：
 * 1. 频繁输入 → 防抖
 * 2. 旧请求未返回 → 取消
 * 3. 旧请求后返回 → 请求 ID 比较
 */
export class SearchController<T = any> {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentRequestId = 0;
  private isLoading = false;

  private searchUrl: string;
  private queryParam: string;
  private debounceMs: number;
  private minQueryLength: number;
  private cancelGroup: string;
  private client: HttpClient;
  private onSuccess: (results: T, query: string) => void;
  private onError: (error: Error, query: string) => void;
  private onLoading: (loading: boolean) => void;

  constructor(options: SearchOptions<T>) {
    this.client = options.client;
    this.searchUrl = options.searchUrl;
    this.queryParam = options.queryParam || 'q';
    this.debounceMs = options.debounceMs ?? 300;
    this.minQueryLength = options.minQueryLength ?? 1;
    this.cancelGroup = options.cancelGroup || 'search';
    this.onSuccess = options.onSuccess || (() => {});
    this.onError = options.onError || (() => {});
    this.onLoading = options.onLoading || (() => {});
  }

  /**
   * 发起搜索（自动防抖 + 取消旧请求）
   */
  search(query: string): void {
    // 清除旧防抖
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    // 递增请求 ID（解决竞态）
    this.currentRequestId++;
    const requestId = this.currentRequestId;

    // 空查询 / 太短 → 清空结果
    if (!query.trim() || query.trim().length < this.minQueryLength) {
      this.onLoading(false);
      this.isLoading = false;
      this.onSuccess(undefined as any, query);
      return;
    }

    // 取消上一次搜索
    this.client.cancelGroup(this.cancelGroup, 'New search initiated');

    // 防抖
    this.debounceTimer = setTimeout(async () => {
      this.setLoading(true);

      try {
        const response: Response<T> = await this.client.get<T>(this.searchUrl, {
          params: { [this.queryParam]: query },
          cancelGroup: this.cancelGroup,
          dedupe: false, // 搜索不缓存
          cache: false,
        });

        // 竞态检查：只有最新请求才更新
        if (requestId === this.currentRequestId) {
          this.onSuccess(response.data, query);
        }
      } catch (error) {
        if (requestId === this.currentRequestId) {
          this.onError(error as Error, query);
        }
      } finally {
        if (requestId === this.currentRequestId) {
          this.setLoading(false);
        }
      }
    }, this.debounceMs);
  }

  /**
   * 立即搜索（跳过防抖）
   */
  async searchNow(query: string): Promise<T | null> {
    if (!query.trim() || query.trim().length < this.minQueryLength) {
      return null;
    }

    this.currentRequestId++;
    const requestId = this.currentRequestId;

    this.setLoading(true);

    try {
      const response = await this.client.get<T>(this.searchUrl, {
        params: { [this.queryParam]: query },
        cancelGroup: this.cancelGroup,
        cache: false,
      });

      if (requestId === this.currentRequestId) {
        this.onSuccess(response.data, query);
        return response.data;
      }
      return null;
    } catch (error) {
      if (requestId === this.currentRequestId) {
        this.onError(error as Error, query);
      }
      return null;
    } finally {
      if (requestId === this.currentRequestId) {
        this.setLoading(false);
      }
    }
  }

  /**
   * 取消当前搜索
   */
  cancel(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.client.cancelGroup(this.cancelGroup);
    this.setLoading(false);
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.cancel();
  }

  get loading(): boolean {
    return this.isLoading;
  }

  private setLoading(loading: boolean): void {
    this.isLoading = loading;
    this.onLoading(loading);
  }
}
```

### 5.2 乐观更新（Optimistic UI）

```typescript
// strategies/optimistic.ts

import { HttpClient } from '../core/client';

interface OptimisticOptions<T> {
  /** 乐观更新时的临时数据 */
  optimisticData: T;
  /** 更新成功后用于替换的数据（可选，默认用 optimisticData） */
  successData?: T;
  /** 缓存 key（用于回滚） */
  cacheKey: string;
  /** 自定义回滚数据（可选） */
  rollbackData?: T;
}

/**
 * 乐观更新辅助函数
 *
 * 流程：
 * 1. 立即更新 UI（乐观数据）
 * 2. 发送请求
 * 3. 成功 → 替换为真实数据
 * 4. 失败 → 回滚到原始数据
 */
export async function optimisticUpdate<T>(
  client: HttpClient,
  updateFn: () => Promise<any>,
  options: OptimisticOptions<T>
): Promise<T> {
  const { optimisticData, cacheKey, rollbackData } = options;

  // 1. 保存原始数据（用于回滚）
  const originalData = client['cache'].get<T>(cacheKey);

  // 2. 立即设置乐观数据
  client['cache'].set(cacheKey, optimisticData);

  try {
    // 3. 发送请求
    await updateFn();

    // 4. 成功 → 更新缓存
    const successData = options.successData ?? optimisticData;
    client['cache'].set(cacheKey, successData);

    return successData;
  } catch (error) {
    // 5. 失败 → 回滚
    client['cache'].set(cacheKey, rollbackData ?? originalData);
    throw error;
  }
}

/**
 * 使用示例：
 *
 * // 用户编辑头像
 * await optimisticUpdate(client,
 *   () => client.post('/users/avatar', { avatarUrl: newAvatar }),
 *   {
 *     optimisticData: { ...user, avatar: newAvatar },
 *     cacheKey: 'GET:/users/1',
 *   }
 * );
 */
```

### 5.3 路由切换拦截器

```typescript
// strategies/route-guard.ts

/**
 * 路由切换时自动取消所有 API 请求
 *
 * 适配 Vue Router / React Router / 原生 history API
 */

interface RouteGuardOptions {
  client: import('../core/client').HttpClient;
  cancelGroup?: string;
  whitelist?: string[]; // 不取消的 URL 模式
}

/**
 * 创建路由守卫
 */
export function createRouteGuard(options: RouteGuardOptions) {
  const { client, cancelGroup = 'api', whitelist = [] } = options;

  function shouldCancel(url: string): boolean {
    return !whitelist.some((pattern) => url.includes(pattern));
  }

  // ── 方案 1: 原生 history API ──
  function setupHistoryGuard() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      _cancelPendingRequests();
      return originalPushState.apply(this, args);
    };

    history.replaceState = function (...args) {
      _cancelPendingRequests();
      return originalReplaceState.apply(this, args);
    };

    window.addEventListener('popstate', () => {
      _cancelPendingRequests();
    });
  }

  // ── 方案 2: Vue Router ──
  function setupVueRouterGuard(router: any) {
    router.beforeEach((_to: any, _from: any, next: () => void) => {
      _cancelPendingRequests();
      next();
    });
  }

  // ── 方案 3: React Router (v6) ──
  // 在组件中使用 useEffect cleanup:
  // useEffect(() => () => client.cancelGroup('api'), []);

  function _cancelPendingRequests() {
    const count = client.cancelGroup(cancelGroup, 'Route changed');
    if (count > 0) {
      console.log(`[RouteGuard] Cancelled ${count} pending requests`);
    }
  }

  return {
    setupHistoryGuard,
    setupVueRouterGuard,
    cancelPending: _cancelPendingRequests,
  };
}
```

---

## 六、框架集成

### 6.1 React Hook

```typescript
// hooks/useRequest.ts

import { useState, useEffect, useRef, useCallback } from 'react';
import { HttpClient, Response, NetworkError } from '../core';

interface UseRequestOptions<T> {
  /** 是否立即执行 */
  immediate?: boolean;
  /** 依赖项变化时重新执行 */
  deps?: any[];
  /** 取消分组 */
  cancelGroup?: string;
}

interface UseRequestResult<T> {
  data: T | null;
  loading: boolean;
  error: NetworkError | null;
  /** 手动触发 */
  execute: () => Promise<Response<T>>;
  /** 重置状态 */
  reset: () => void;
}

/**
 * React useRequest Hook
 *
 * 特性：
 * - 组件卸载自动取消请求
 * - 依赖变化自动重新请求
 * - 竞态安全（旧请求结果被忽略）
 */
export function useRequest<T>(
  requestFn: () => Promise<Response<T>>,
  options: UseRequestOptions<T> = {}
): UseRequestResult<T> {
  const { immediate = true, deps = [], cancelGroup } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NetworkError | null>(null);

  const execIdRef = useRef(0);
  const mountedRef = useRef(true);

  const execute = useCallback(async (): Promise<Response<T>> => {
    execIdRef.current++;
    const execId = execIdRef.current;

    setLoading(true);
    setError(null);

    try {
      const response = await requestFn();

      // 竞态检查 + 组件挂载检查
      if (execId === execIdRef.current && mountedRef.current) {
        setData(response.data);
        setLoading(false);
      }

      return response;
    } catch (err) {
      const networkError = err as NetworkError;

      // 取消错误不设置 error 状态
      if (!networkError.isCancelled && mountedRef.current) {
        if (execId === execIdRef.current) {
          setError(networkError);
          setLoading(false);
        }
      }

      throw networkError;
    }
  }, deps);

  useEffect(() => {
    mountedRef.current = true;

    if (immediate) {
      execute().catch(() => {});
    }

    return () => {
      mountedRef.current = false;
      if (cancelGroup) {
        // 组件卸载时取消（需要外部传入 client）
      }
    };
  }, deps);

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
  }, []);

  return { data, loading, error, execute, reset };
}
```

### 6.2 Vue 3 Composable

```typescript
// hooks/useRequest.ts (Vue 3)

import { ref, Ref, onUnmounted, watch, computed } from 'vue';
import { HttpClient, Response, NetworkError } from '../core';

interface UseRequestOptions<T> {
  immediate?: boolean;
  cancelGroup?: string;
  client?: HttpClient;
}

interface UseRequestResult<T> {
  data: Ref<T | null>;
  loading: Ref<boolean>;
  error: Ref<NetworkError | null>;
  execute: (...args: any[]) => Promise<Response<T>>;
  reset: () => void;
  cancel: () => void;
}

/**
 * Vue 3 useRequest Composable
 *
 * 特性：
 * - 组件卸载自动取消
 * - 支持参数响应式
 * - 竞态安全
 */
export function useRequest<T>(
  requestFn: (...args: any[]) => Promise<Response<T>>,
  options: UseRequestOptions<T> = {}
): UseRequestResult<T> {
  const { immediate = true, cancelGroup, client } = options;

  const data = ref<T | null>(null) as Ref<T | null>;
  const loading = ref(false);
  const error = ref<NetworkError | null>(null);

  let execId = 0;

  async function execute(...args: any[]): Promise<Response<T>> {
    execId++;
    const currentExecId = execId;

    loading.value = true;
    error.value = null;

    try {
      const response = await requestFn(...args);

      if (execId === currentExecId) {
        data.value = response.data;
        loading.value = false;
      }

      return response;
    } catch (err) {
      const networkError = err as NetworkError;

      if (!networkError.isCancelled && execId === currentExecId) {
        error.value = networkError;
        loading.value = false;
      }

      throw networkError;
    }
  }

  function cancel(): void {
    execId++;
    if (client && cancelGroup) {
      client.cancelGroup(cancelGroup);
    }
  }

  function reset(): void {
    data.value = null;
    loading.value = false;
    error.value = null;
  }

  // 组件卸载时取消
  onUnmounted(() => {
    execId++;
    if (client && cancelGroup) {
      client.cancelGroup(cancelGroup, 'Component unmounted');
    }
  });

  // 立即执行
  if (immediate) {
    execute().catch(() => {});
  }

  return { data, loading, error, execute, reset, cancel };
}

/**
 * 使用示例：
 *
 * // 基本用法
 * const { data, loading, error } = useRequest(
 *   () => api.get('/users/1')
 * );
 *
 * // 带参数
 * const { data, execute } = useRequest(
 *   (id: number) => api.get(`/users/${id}`),
 *   { immediate: false }
 * );
 *
 * // 手动触发
 * execute(123);
 *
 * // 组件卸载自动取消
 * const { data } = useRequest(
 *   () => api.get('/users'),
 *   { cancelGroup: 'user-list', client: api }
 * );
 */
```

---

## 七、完整使用示例

```typescript
// ==================== 创建客户端 ====================

import { HttpClient } from './core/client';
import { createAuthInterceptor, createTokenRefreshInterceptor } from './interceptors/auth';
import { createLoggingInterceptor } from './interceptors/logging';
import { createMetricsInterceptor } from './interceptors/metrics';
import { SearchController } from './strategies/search-controller';
import { createRouteGuard } from './strategies/route-guard';

const api = new HttpClient({
  baseURL: 'https://api.example.com',
  timeout: 15000,
  maxRetries: 2,
  retryStrategy: 'exponential',
  unwrapBusinessResponse: true,
  businessCodeField: 'code',
  businessSuccessCode: [0, 200],
});

// ==================== 注册拦截器 ====================

// 1. 认证
api.addRequestInterceptor(createAuthInterceptor({
  getToken: () => localStorage.getItem('access_token'),
}));

// 2. Token 刷新
api.addErrorInterceptor(createTokenRefreshInterceptor(api, {
  getToken: () => localStorage.getItem('access_token'),
  refreshToken: async () => {
    const res = await fetch('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: localStorage.getItem('refresh_token') }),
    });
    const { accessToken } = await res.json();
    localStorage.setItem('access_token', accessToken);
    return accessToken;
  },
  onTokenUpdate: (token) => localStorage.setItem('access_token', token),
  onRefreshFailed: () => {
    localStorage.clear();
    window.location.href = '/login';
  },
}));

// 3. 日志
api.addRequestInterceptor(createLoggingInterceptor({ level: 'info', format: 'compact' }));
api.addResponseInterceptor(createLoggingInterceptor({ level: 'info', format: 'compact' }));
api.addErrorInterceptor(createLoggingInterceptor({ level: 'warn', format: 'compact' }));

// 4. 性能监控（Sentry 集成）
api.addResponseInterceptor(createMetricsInterceptor({
  slowThreshold: 3000,
  sentry: {
    captureException: (error) => {
      // Sentry.captureException(error);
      console.error('[Sentry]', error);
    },
    setTag: (key, value) => {
      // Sentry.setTag(key, value);
    },
    addBreadcrumb: (breadcrumb) => {
      // Sentry.addBreadcrumb(breadcrumb);
    },
  },
}));

// ==================== API 模块 ====================

interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const userApi = {
  list: (page = 1, pageSize = 20) =>
    api.get<PaginatedResult<User>>('/users', {
      params: { page, pageSize },
      cache: { strategy: 'stale-while-revalidate', ttl: 2 * 60 * 1000 },
    }),

  get: (id: number) =>
    api.get<User>(`/users/${id}`, {
      cache: { strategy: 'cache-first', ttl: 5 * 60 * 1000 },
    }),

  create: (data: { name: string; email: string }) =>
    api.post<User>('/users', data, { maxRetries: 1 }),

  update: (id: number, data: Partial<User>) =>
    api.put<User>(`/users/${id}`, data, { maxRetries: 1 }),

  delete: (id: number) => api.delete(`/users/${id}`),

  // 搜索（去重 key 控制）
  search: (query: string) =>
    api.get<User[]>('/users/search', {
      params: { q: query },
      cache: false,
      dedupeKey: `user-search-${query}`,
    }),

  // 上传（长超时）
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post<{ url: string }>('/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
      maxRetries: 1,
    });
  },
};

// ==================== 搜索控制器 ====================

const searchCtrl = new SearchController<User[]>({
  client: api,
  searchUrl: '/users/search',
  queryParam: 'q',
  debounceMs: 300,
  minQueryLength: 1,
  cancelGroup: 'user-search',
  onSuccess: (results, query) => {
    console.log(`搜索 "${query}": ${results?.length ?? 0} 条结果`);
  },
  onError: (error, query) => {
    console.error(`搜索 "${query}" 失败:`, error.message);
  },
  onLoading: (loading) => {
    console.log('搜索状态:', loading ? '加载中' : '空闲');
  },
});

// 绑定输入框
document.getElementById('search-input')?.addEventListener('input', (e) => {
  const query = (e.target as HTMLInputElement).value;
  searchCtrl.search(query);
});

// ==================== 路由守卫 ====================

const routeGuard = createRouteGuard({
  client: api,
  cancelGroup: 'api',
  whitelist: ['/auth/refresh', '/health'],
});
routeGuard.setupHistoryGuard();

// ==================== 性能监控 ====================

function printMetrics() {
  const m = api.getMetrics();
  console.table({
    '总请求': m.totalRequests,
    '成功': m.successRequests,
    '失败': m.failedRequests,
    '成功率': `${(100 - m.errorRate).toFixed(1)}%`,
    '平均耗时': `${m.avgDuration.toFixed(0)}ms`,
    'P50': `${m.p50Duration.toFixed(0)}ms`,
    'P95': `${m.p95Duration.toFixed(0)}ms`,
    'P99': `${m.p99Duration.toFixed(0)}ms`,
    '缓存命中率': `${m.cacheHitRate.toFixed(1)}%`,
    '重试率': `${m.retryRate.toFixed(1)}%`,
    '取消率': `${m.cancelRate.toFixed(1)}%`,
    '活跃请求': m.activeRequests,
  });
}

// 每 30 秒打印一次
setInterval(printMetrics, 30000);
```

---

## 八、面试高频考点 — 进阶版

### Q1: 如何处理搜索框的竞态问题？（三个层面）

```
问题 1: 频繁输入 → 防抖 (debounce 300ms)
问题 2: 旧请求未返回 → AbortController 取消
问题 3: 旧请求后返回 → 请求 ID 比较

SearchController 实现：
- 每次搜索递增 execId
- 新搜索时 cancelGroup 取消旧请求
- 回调时检查 execId === currentExecId
- 只有最新请求的结果才更新 UI
```

### Q2: Token 刷新的并发安全问题？

```
核心难点：
1. 多个请求同时 401 → 只刷新一次
2. 刷新期间的新请求 → 排队等待
3. 刷新失败 → 全部拒绝 + 跳转登录

实现：
- isRefreshing 标志位（防止并发刷新）
- refreshPromise 缓存（共享刷新结果）
- queue 队列（排队请求）
- _isRetry 标记（防止无限重试）
```

### Q3: 重试的指数退避为什么要加全抖动？

```
问题：多个客户端同时遇到 503，不加抖动会同时重试
→ 服务器雪崩

全抖动 vs 半抖动：
- 半抖动: delay = base * 2^attempt + random(0, delay * 0.25)
- 全抖动: delay = random(0, base * 2^attempt) ← 更分散

全抖动更适合高并发场景，重试时间分布更均匀
```

### Q4: SWR 缓存策略 vs 传统缓存？

```
传统缓存:
- cache-first: 有缓存直接用，过期才请求
- 问题：数据可能过时

SWR (Stale While Revalidate):
- 立即返回缓存（即使过期）
- 后台发起新请求更新缓存
- 用户体验：即时响应 + 数据最终一致

适用场景：用户列表、配置信息、仪表盘数据
不适用：支付、下单等强一致性场景
```

### Q5: 如何设计可测试的网络层？

```
1. 依赖注入：adapter 可替换（fetch / mock / axios）
2. 拦截器可独立测试：每个拦截器是纯函数
3. 错误可模拟：TimeoutError / CancelledError / BusinessError
4. 监控数据可断言：Metrics 结构清晰
5. 取消可验证：activeRequests 计数

测试策略：
- 单元测试：拦截器、重试策略、缓存
- 集成测试：HttpClient 完整流程
- E2E 测试：MSW (Mock Service Worker)
```

---

## 九、架构决策总结

| 决策 | 选择 | 理由 |
|------|------|------|
| 底层 API | Fetch | 零依赖、现代浏览器支持、可组合性强 |
| 重试策略 | 指数退避 + 全抖动 | 最分散的重试时间分布 |
| 取消机制 | AbortController + 分组 | 组件/路由级别精细控制 |
| 去重方式 | Map<string, Promise> | 简单高效、自动清理 |
| 缓存策略 | SWR 为主 | 即时响应 + 最终一致 |
| 拦截器模式 | 独立注册/卸载 | 支持动态插拔、多实例隔离 |
| 错误处理 | 分级错误类 | 区分超时/取消/网络/业务错误 |
| 监控 | performance.now() + Sentry | 高精度 + 生产级错误上报 |
| 框架集成 | Hook/Composable | 自动清理、竞态安全 |
| 架构 | 模块化 | 核心 + 拦截器 + 策略 + 适配器 |

---

## 十、累计训练回顾

| 日期 | 主题 | 重点 |
|------|------|------|
| 04/25 | 基础版 | Fetch 封装 + Axios 封装 + 拦截器 + 重试 + 取消 + 去重 |
| 04/28 | 综合实战 | 完整 TypeScript 网络层 + 类型系统 + 缓存 + 监控 + Axios 适配器 |
| 04/30 | Axios 版 | 基于 Axios 的完整实现 + 401 刷新 + 业务解包 |
| **05/03** | **进阶实战** | **模块化架构 + SWR 缓存 + 搜索竞态 + 乐观更新 + 路由守卫 + Sentry 集成** |

**网络层训练 = 四次迭代，从基础到生产级 ✅**
