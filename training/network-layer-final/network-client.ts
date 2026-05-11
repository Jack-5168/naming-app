/**
 * 生产级网络层实现
 * 
 * 特性：
 * - Fetch 封装（零依赖）
 * - 拦截器管道（请求/响应/错误）
 * - 重试机制（固定/指数退避/自适应 + 抖动）
 * - 请求取消（AbortController）
 * - 请求去重（Map 缓存 Promise）
 * - 多级缓存（cache-first/network-first/stale-while-revalidate）
 * - 监控体系（traceId/耗时/慢请求/错误率）
 * - 完整 TypeScript 类型
 * - Axios 适配器
 */

// ==================== 类型定义 ====================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface NetworkRequestConfig {
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string | number | boolean | undefined>;
  timeout?: number;
  maxRetries?: number;
  retryStrategy?: 'fixed' | 'exponential' | 'adaptive';
  shouldRetry?: (error: NetworkError, attempt: number) => boolean;
  signal?: AbortSignal;
  dedupeKey?: string;
  cacheStrategy?: 'no-cache' | 'cache-first' | 'network-first' | 'stale-while-revalidate';
  cacheTTL?: number;
  onUploadProgress?: (loaded: number, total: number) => void;
  onDownloadProgress?: (loaded: number, total: number) => void;
  transformRequest?: (data: any) => any;
  transformResponse?: (data: any) => any;
  metadata?: Record<string, unknown>;
}

export interface NetworkResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: NetworkRequestConfig;
  duration: number;
  fromCache: boolean;
  traceId: string;
}

export interface NetworkError extends Error {
  status?: number;
  response?: NetworkResponse;
  config?: NetworkRequestConfig;
  isTimeout: boolean;
  isCancelled: boolean;
  isNetworkError: boolean;
  retryCount: number;
  traceId: string;
}

export type RequestInterceptor = (
  config: NetworkRequestConfig
) => NetworkRequestConfig | Promise<NetworkRequestConfig>;

export type ResponseInterceptor<T = any> = (
  response: NetworkResponse<T>
) => NetworkResponse<T> | Promise<NetworkResponse<T>>;

export type ErrorInterceptor = (error: NetworkError) => never | Promise<never>;

interface InterceptorEntry<T> {
  id: string;
  fn: T;
}

interface InterceptorStack {
  request: InterceptorEntry<RequestInterceptor>[];
  response: InterceptorEntry<ResponseInterceptor>[];
  error: InterceptorEntry<ErrorInterceptor>[];
}

export interface RequestMetrics {
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

export interface RequestTrace {
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
    headers.forEach((value, key) => { result[key.toLowerCase()] = value; });
    return result;
  }
  return headers || {};
}

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// ==================== 错误工厂 ====================

export function createNetworkError(message: string, options: Partial<NetworkError> = {}): NetworkError {
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
    this.store.set(key, { data, timestamp: Date.now(), ttl: ttl ?? this.defaultTTL });
  }

  invalidate(key: string): void { this.store.delete(key); }

  invalidateByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) { this.store.delete(key); count++; }
    }
    return count;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.timestamp > entry.ttl) this.store.delete(key);
    }
  }

  clear(): void { this.store.clear(); }
  get size(): number { return this.store.size; }

  destroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.store.clear();
  }
}

// ==================== 请求去重器 ====================

class RequestDeduper {
  private pending = new Map<string, Promise<any>>();

  generateKey(config: NetworkRequestConfig): string {
    const method = (config.method || 'GET').toUpperCase();
    return `${method}:${config.url}:${JSON.stringify(config.params || {})}:${config.body && method !== 'GET' ? JSON.stringify(config.body) : ''}`;
  }

  get<T>(key: string): Promise<T> | null {
    return (this.pending.get(key) as Promise<T>) ?? null;
  }

  set(key: string, promise: Promise<any>): void {
    this.pending.set(key, promise);
    promise.finally(() => this.pending.delete(key));
  }

  has(key: string): boolean { return this.pending.has(key); }
  get size(): number { return this.pending.size; }
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
      case 'fixed': delay = baseDelay; break;
      case 'exponential': delay = baseDelay * Math.pow(2, attempt - 1); break;
      case 'adaptive':
        if (error?.status === 429) delay = baseDelay * 3;
        else if (error?.status === 503) delay = baseDelay * 2;
        else delay = baseDelay * Math.pow(1.5, attempt - 1);
        break;
      default: delay = baseDelay;
    }
    delay = Math.min(delay, 30000);
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
    if (customShouldRetry) return customShouldRetry(error, attempt);
    return (error.status !== undefined && error.status >= 500) || error.isTimeout || error.isNetworkError || error.status === 429;
  }
}

// ==================== 取消管理器 ====================

class CancelManager {
  private controllers = new Map<string, AbortController>();

  register(key: string): AbortSignal {
    const old = this.controllers.get(key);
    if (old) old.abort(`Duplicate request: ${key}`);
    const controller = new AbortController();
    this.controllers.set(key, controller);
    return controller.signal;
  }

  cancel(key: string, reason = 'Cancelled'): boolean {
    const controller = this.controllers.get(key);
    if (controller) { controller.abort(reason); this.controllers.delete(key); return true; }
    return false;
  }

  cancelByPattern(pattern: RegExp, reason = 'Cancelled by pattern'): number {
    let count = 0;
    for (const [key, controller] of this.controllers) {
      if (pattern.test(key)) { controller.abort(reason); this.controllers.delete(key); count++; }
    }
    return count;
  }

  cancelAll(reason = 'Cancel all'): number {
    let count = 0;
    for (const [key, controller] of this.controllers) {
      controller.abort(reason); this.controllers.delete(key); count++;
    }
    return count;
  }

  unregister(key: string): void { this.controllers.delete(key); }
  get activeCount(): number { return this.controllers.size; }
}

// ==================== 监控器 ====================

class RequestMonitor {
  private traces = new Map<string, RequestTrace>();
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
      traceId, method: config.method || 'GET', url: config.url,
      startTime: performance.now(), fromCache: false, retryCount: 0,
    });
    this.metrics.activeRequests++;
    return traceId;
  }

  endSuccess(traceId: string, status: number, duration: number, fromCache: boolean): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;
    trace.endTime = performance.now(); trace.duration = duration;
    trace.status = status; trace.statusText = 'OK'; trace.fromCache = fromCache;
    this.metrics.totalRequests++; this.metrics.successRequests++;
    this.metrics.activeRequests--; this.metrics.totalDuration += duration;
    if (fromCache) this.metrics.cacheHits++;
    if (duration > this.slowThreshold) this.metrics.slowRequests++;
    const group = Math.floor(status / 100);
    this.metrics.statusDistribution[group] = (this.metrics.statusDistribution[group] || 0) + 1;
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
    trace.endTime = performance.now(); trace.duration = performance.now() - trace.startTime;
    trace.status = error.status; trace.error = error.message; trace.retryCount = error.retryCount;
    this.metrics.totalRequests++; this.metrics.failedRequests++;
    this.metrics.activeRequests--; this.metrics.totalDuration += trace.duration;
    if (error.isTimeout) this.metrics.timeoutCount++;
    if (error.isCancelled) this.metrics.cancelCount++;
    if (error.status) {
      const group = Math.floor(error.status / 100);
      this.metrics.statusDistribution[group] = (this.metrics.statusDistribution[group] || 0) + 1;
    }
    this.cleanupTraces();
  }

  getMetrics(): RequestMetrics {
    return {
      ...this.metrics,
      avgDuration: this.metrics.totalRequests > 0 ? this.metrics.totalDuration / this.metrics.totalRequests : 0,
      errorRate: this.metrics.totalRequests > 0 ? (this.metrics.failedRequests / this.metrics.totalRequests) * 100 : 0,
    };
  }

  getTraces(filter?: { status?: number; url?: string; minDuration?: number }): RequestTrace[] {
    let result = Array.from(this.traces.values());
    if (filter?.status) result = result.filter(t => t.status === filter.status);
    if (filter?.url) result = result.filter(t => t.url.includes(filter.url!));
    if (filter?.minDuration) result = result.filter(t => (t.duration ?? 0) >= filter.minDuration);
    return result;
  }

  reset(): void { this.metrics = this.createEmptyMetrics(); this.traces.clear(); }

  private createEmptyMetrics(): RequestMetrics {
    return {
      totalRequests: 0, successRequests: 0, failedRequests: 0, activeRequests: 0,
      totalDuration: 0, avgDuration: 0, errorRate: 0, slowRequests: 0,
      timeoutCount: 0, cancelCount: 0, cacheHits: 0,
      statusDistribution: {}, slowestRequests: [],
    };
  }

  private cleanupTraces(): void {
    if (this.traces.size > this.maxTraces) {
      const keys = Array.from(this.traces.keys());
      for (let i = 0; i < keys.length - this.maxTraces; i++) this.traces.delete(keys[i]);
    }
  }
}

// ==================== 核心网络客户端 ====================

export interface NetworkClientDefaults {
  timeout?: number;
  maxRetries?: number;
  retryStrategy?: 'fixed' | 'exponential' | 'adaptive';
  cacheStrategy?: 'no-cache' | 'cache-first' | 'network-first' | 'stale-while-revalidate';
  cacheTTL?: number;
}

export class NetworkClient {
  private baseURL: string;
  private interceptors: InterceptorStack = { request: [], response: [], error: [] };
  private cache: RequestCache;
  private deduper: RequestDeduper;
  private retryManager: RetryManager;
  private cancelManager: CancelManager;
  private monitor: RequestMonitor;
  private defaults: Required<NetworkClientDefaults>;

  constructor(baseURL: string, defaults?: NetworkClientDefaults) {
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
    const idx = this.interceptors[type].findIndex(item => item.id === id);
    if (idx !== -1) this.interceptors[type].splice(idx, 1);
  }

  clearInterceptors(type?: 'request' | 'response' | 'error'): void {
    if (type) this.interceptors[type] = [];
    else { this.interceptors.request = []; this.interceptors.response = []; this.interceptors.error = []; }
  }

  // ==================== 核心请求 ====================

  async request<T = any>(config: NetworkRequestConfig): Promise<NetworkResponse<T>> {
    const startTime = performance.now();

    let processedConfig: NetworkRequestConfig = {
      method: 'GET', timeout: this.defaults.timeout, maxRetries: this.defaults.maxRetries,
      retryStrategy: this.defaults.retryStrategy, cacheStrategy: this.defaults.cacheStrategy,
      cacheTTL: this.defaults.cacheTTL, ...config, headers: { ...config.headers },
    };

    // 请求拦截器
    for (const { fn } of this.interceptors.request) {
      processedConfig = await fn(processedConfig);
    }

    const traceId = this.monitor.start(processedConfig);

    // 去重
    const dedupeKey = processedConfig.dedupeKey || this.deduper.generateKey(processedConfig);
    if (processedConfig.method?.toUpperCase() === 'GET' && this.deduper.has(dedupeKey)) {
      const existing = this.deduper.get<T>(dedupeKey);
      if (existing) {
        const duration = performance.now() - startTime;
        this.monitor.endSuccess(traceId, 200, duration, false);
        return existing;
      }
    }

    // 缓存
    if (processedConfig.method?.toUpperCase() === 'GET') {
      const cacheResult = await this.handleCache<T>(processedConfig, traceId, startTime);
      if (cacheResult) return cacheResult;
    }

    const requestPromise = this.executeWithRetry<T>(processedConfig, traceId);
    if (processedConfig.method?.toUpperCase() === 'GET') {
      this.deduper.set(dedupeKey, requestPromise);
    }
    return requestPromise;
  }

  private async handleCache<T>(
    config: NetworkRequestConfig, traceId: string, startTime: number
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
          return { data: cached, status: 200, statusText: 'OK (cached)', headers: {}, config, duration, fromCache: true, traceId };
        }
        return null;
      }
      case 'stale-while-revalidate': {
        if (cached !== null) {
          this.executeFetch<T>(config, traceId).then(r => this.cache.set(cacheKey, r.data, config.cacheTTL)).catch(() => {});
          const duration = performance.now() - startTime;
          this.monitor.endSuccess(traceId, 200, duration, true);
          return { data: cached, status: 200, statusText: 'OK (stale-while-revalidate)', headers: {}, config, duration, fromCache: true, traceId };
        }
        return null;
      }
      case 'network-first': {
        try {
          const response = await this.executeFetch<T>(config, traceId);
          this.cache.set(cacheKey, response.data, config.cacheTTL);
          return response;
        } catch (error) {
          if (cached !== null) {
            const duration = performance.now() - startTime;
            this.monitor.endSuccess(traceId, 200, duration, true);
            return { data: cached, status: 200, statusText: 'OK (stale fallback)', headers: {}, config, duration, fromCache: true, traceId };
          }
          throw error;
        }
      }
      default: return null;
    }
  }

  private async executeWithRetry<T>(config: NetworkRequestConfig, traceId: string): Promise<NetworkResponse<T>> {
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
        // 修改操作清除相关缓存
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method?.toUpperCase() || '')) {
          const prefix = config.url.split('/').slice(0, -1).join('/');
          this.cache.invalidateByPrefix(`${config.method}:${prefix}`);
        }
        return response;
      } catch (error) {
        lastError = error as NetworkError;
        if (!this.retryManager.shouldRetry(lastError, attempt, maxRetries, config.shouldRetry)) break;
        const delay = this.retryManager.calculateDelay(attempt + 1, config.retryStrategy || 'exponential', 1000, lastError);
        console.warn(`[Network] Retry ${attempt + 1}/${maxRetries} for ${config.method} ${config.url} in ${delay}ms`);
        await this.sleep(delay);
      }
    }

    if (lastError) {
      for (const { fn } of this.interceptors.error) { await fn(lastError); }
    }
    throw lastError!;
  }

  private async executeFetch<T>(config: NetworkRequestConfig, traceId: string): Promise<NetworkResponse<T>> {
    const startTime = performance.now();
    const url = buildURL(this.baseURL, config.url, config.params);

    let body: BodyInit | undefined;
    if (config.body && !['GET', 'HEAD'].includes(config.method?.toUpperCase() || '')) {
      let processedBody = config.body;
      if (config.transformRequest) processedBody = config.transformRequest(processedBody);
      if (processedBody instanceof FormData || processedBody instanceof URLSearchParams || processedBody instanceof Blob) {
        body = processedBody;
      } else if (isObject(processedBody)) {
        body = JSON.stringify(processedBody);
      } else {
        body = String(processedBody);
      }
    }

    const headers: Record<string, string> = { ...config.headers };
    if (body && typeof body === 'string' && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const signal = config.signal ? this.createCombinedSignal(controller.signal, config.signal) : controller.signal;
    const timeoutMs = config.timeout ?? this.defaults.timeout;
    const timeoutId = setTimeout(() => controller.abort(`Timeout after ${timeoutMs}ms`), timeoutMs);

    try {
      const response = await fetch(url, { method: config.method || 'GET', headers, body, signal });
      clearTimeout(timeoutId);

      const data = await this.parseResponseData(response);
      let processedData = data;
      if (config.transformResponse) processedData = config.transformResponse(data);

      if (response.status < 200 || response.status >= 300) {
        const duration = performance.now() - startTime;
        const error = createNetworkError(`HTTP ${response.status}: ${response.statusText}`, {
          status: response.status, config, traceId,
        });
        this.monitor.endError(traceId, error);
        for (const { fn } of this.interceptors.error) { await fn(error); }
        throw error;
      }

      const duration = performance.now() - startTime;
      const networkResponse: NetworkResponse<T> = {
        data: processedData as T, status: response.status, statusText: response.statusText,
        headers: parseHeaders(response.headers), config, duration, fromCache: false, traceId,
      };

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
          const networkError = createNetworkError(`Request timeout after ${timeoutMs}ms`, { isTimeout: true, config, traceId });
          this.monitor.endError(traceId, networkError);
          throw networkError;
        }
        const networkError = createNetworkError(`Request cancelled: ${message}`, { isCancelled: true, config, traceId });
        this.monitor.endError(traceId, networkError);
        throw networkError;
      }
      const networkError = createNetworkError('Network error - check your connection', { isNetworkError: true, config, traceId });
      this.monitor.endError(traceId, networkError);
      throw networkError;
    }
  }

  private createCombinedSignal(primary: AbortSignal, secondary: AbortSignal): AbortSignal {
    if (secondary.aborted) { primary.abort(secondary.reason); return primary; }
    secondary.addEventListener('abort', () => { primary.abort(secondary.reason); });
    return primary;
  }

  private async parseResponseData(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) return response.json();
    if (contentType.includes('text/html') || contentType.includes('text/plain')) return response.text();
    if (contentType.includes('application/octet-stream')) return response.blob();
    try { return await response.json(); } catch { return response.text(); }
  }

  private sleep(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)); }

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

  cancelRequest(key: string, reason?: string): boolean { return this.cancelManager.cancel(key, reason); }
  cancelAll(reason?: string): number { return this.cancelManager.cancelAll(reason); }
  get activeRequests(): number { return this.cancelManager.activeCount; }

  // ==================== 缓存管理 ====================

  clearCache(): void { this.cache.clear(); }
  invalidateCache(prefix: string): number { return this.cache.invalidateByPrefix(prefix); }
  get cacheSize(): number { return this.cache.size; }

  // ==================== 监控 ====================

  getMetrics(): RequestMetrics { return this.monitor.getMetrics(); }
  getTraces(filter?: { status?: number; url?: string; minDuration?: number }): RequestTrace[] { return this.monitor.getTraces(filter); }
  resetMetrics(): void { this.monitor.reset(); }

  // ==================== 销毁 ====================

  destroy(): void {
    this.cancelAll('Client destroyed');
    this.cache.destroy();
    this.clearInterceptors();
    this.resetMetrics();
  }
}

// ==================== 拦截器工厂 ====================

export function createAuthInterceptor(
  getToken: () => string | null,
  options?: { headerName?: string; prefix?: string }
): RequestInterceptor {
  const headerName = options?.headerName || 'Authorization';
  const prefix = options?.prefix || 'Bearer ';
  return (config) => {
    const token = getToken();
    if (token) config.headers = { ...config.headers, [headerName]: `${prefix}${token}` };
    return config;
  };
}

export function createLoggerInterceptor(): { request: RequestInterceptor; response: ResponseInterceptor; error: ErrorInterceptor } {
  return {
    request: (config) => {
      const method = config.method || 'GET';
      const url = config.url;
      console.groupCollapsed(`%c→ ${method} ${url}`, 'color: #2196F3; font-weight: bold');
      if (config.params) console.log('Params:', config.params);
      if (config.body) console.log('Body:', config.body);
      return config;
    },
    response: (response) => {
      const duration = response.duration.toFixed(0);
      const method = response.config.method || 'GET';
      const url = response.config.url;
      console.log(`%c← ${response.status} ${method} ${url} (${duration}ms)`, 'color: #4CAF50; font-weight: bold');
      console.groupEnd();
      return response;
    },
    error: (error) => {
      const method = error.config?.method || 'GET';
      const url = error.config?.url || '';
      console.error(`%c✗ ${error.message} ${method} ${url}`, 'color: #F44336; font-weight: bold');
      console.groupEnd();
      throw error;
    },
  };
}

export function createGlobalErrorHandler(options?: {
  on401?: () => void; on403?: () => void; on500?: () => void;
  onNetworkError?: () => void; onTimeout?: () => void;
}): ErrorInterceptor {
  return (error) => {
    if (error.status === 401) options?.on401?.();
    else if (error.status === 403) options?.on403?.();
    else if (error.status && error.status >= 500) options?.on500?.();
    if (error.isNetworkError) options?.onNetworkError?.();
    if (error.isTimeout) options?.onTimeout?.();
    throw error;
  };
}

export function createRequestIdInterceptor(): RequestInterceptor {
  return (config) => {
    const requestId = generateTraceId();
    config.headers = { ...config.headers, 'X-Request-ID': requestId };
    (config as any).requestId = requestId;
    return config;
  };
}

export function createLoadingInterceptor(
  onStart: () => void, onEnd: () => void
): { request: RequestInterceptor; response: ResponseInterceptor; error: ErrorInterceptor } {
  let activeCount = 0;
  return {
    request: (config) => { if (++activeCount === 1) onStart(); return config; },
    response: (response) => { if (--activeCount <= 0) { activeCount = 0; onEnd(); } return response; },
    error: (error) => { if (--activeCount <= 0) { activeCount = 0; onEnd(); } throw error; },
  };
}

// ==================== Axios 适配器 ====================

export class AxiosAdapter {
  private axiosInstance: any;

  constructor(baseURL: string, defaults?: NetworkClientDefaults) {
    // 动态导入 axios（如果可用）
    try {
      const axios = require('axios');
      this.axiosInstance = axios.create({
        baseURL,
        timeout: defaults?.timeout ?? 30000,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      throw new Error('axios is not installed. Install it with: npm install axios');
    }
  }

  private toAxiosConfig(config: NetworkRequestConfig): any {
    return {
      url: config.url, method: config.method?.toLowerCase(),
      headers: config.headers, data: config.body,
      params: config.params, timeout: config.timeout, signal: config.signal,
    };
  }

  private toNetworkResponse<T>(axiosResponse: any, config: NetworkRequestConfig, traceId: string): NetworkResponse<T> {
    return {
      data: axiosResponse.data, status: axiosResponse.status,
      statusText: axiosResponse.statusText,
      headers: axiosResponse.headers as Record<string, string>,
      config, duration: 0, fromCache: false, traceId,
    };
  }

  private toNetworkError(axiosError: any, config: NetworkRequestConfig, traceId: string): NetworkError {
    const isTimeout = axiosError.code === 'ECONNABORTED';
    const isCancelled = this.axiosInstance.isCancel?.(axiosError) || axiosError.__CANCEL__;
    return createNetworkError(axiosError.message, {
      status: axiosError.response?.status, config, isTimeout, isCancelled,
      isNetworkError: !axiosError.response && !isTimeout && !isCancelled, traceId,
    });
  }

  async request<T = any>(config: NetworkRequestConfig): Promise<NetworkResponse<T>> {
    const traceId = generateTraceId();
    try {
      const response = await this.axiosInstance(this.toAxiosConfig(config));
      return this.toNetworkResponse(response, config, traceId);
    } catch (error) {
      throw this.toNetworkError(error, config, traceId);
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

  getAxiosInstance(): any { return this.axiosInstance; }
}

// ==================== 并发控制工具 ====================

export async function batchRequest<T>(
  requests: Array<() => Promise<T>>,
  concurrency = 5
): Promise<T[]> {
  const results: T[] = [];
  const executing: Set<Promise<void>> = new Set();

  for (const requestFn of requests) {
    const p = requestFn().then(result => { results.push(result); executing.delete(p); });
    executing.add(p);
    if (executing.size >= concurrency) await Promise.race(executing);
  }
  await Promise.all(executing);
  return results;
}

// ==================== 搜索控制器 ====================

export class SearchController {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentRequestId = 0;

  constructor(
    private searchFn: (query: string) => Promise<any>,
    private onResults: (results: any[], query: string) => void,
    private debounceMs = 300
  ) {}

  search(query: string): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.currentRequestId++;
    const requestId = this.currentRequestId;

    if (!query.trim()) { this.onResults([], query); return; }

    this.debounceTimer = setTimeout(async () => {
      try {
        const { data } = await this.searchFn(query);
        if (requestId === this.currentRequestId) this.onResults(data, query);
      } catch {
        if (requestId === this.currentRequestId) this.onResults([], query);
      }
    }, this.debounceMs);
  }

  destroy(): void { if (this.debounceTimer) clearTimeout(this.debounceTimer); }
}
