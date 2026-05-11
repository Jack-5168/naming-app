/**
 * Axios 网络层实现
 * 
 * 基于 axios 库的完整网络层封装
 * 特性：重试、去重、拦截器、Token 刷新、取消请求
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  CancelTokenSource,
  InternalAxiosRequestConfig,
} from 'axios';

// ==================== 类型定义 ====================

export interface ExtendedAxiosConfig extends AxiosRequestConfig {
  retryCount?: number;
  retryDelay?: number;
  shouldRetry?: (error: AxiosError) => boolean;
  dedupe?: boolean;
  _retry?: boolean;
  _cancelSource?: CancelTokenSource;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: ExtendedAxiosConfig;
  duration: number;
  traceId: string;
}

export interface AxiosNetworkError extends Error {
  status?: number;
  response?: AxiosResponse;
  config?: ExtendedAxiosConfig;
  isTimeout?: boolean;
  isCancelled?: boolean;
  isNetworkError?: boolean;
  retryCount?: number;
  traceId?: string;
}

// ==================== 请求去重管理 ====================

class AxiosRequestDeduper {
  private pendingRequests = new Map<string, Promise<any>>();

  generateKey(config: AxiosRequestConfig): string {
    const { url, method = 'get', params, data } = config;
    return `${method.toUpperCase()}:${url}:${JSON.stringify(params || {})}:${JSON.stringify(data || {})}`;
  }

  has(key: string): boolean {
    return this.pendingRequests.has(key);
  }

  add(key: string, promise: Promise<any>): void {
    this.pendingRequests.set(key, promise);
    promise.finally(() => this.pendingRequests.delete(key));
  }

  get<T>(key: string): Promise<T> | null {
    return (this.pendingRequests.get(key) as Promise<T>) ?? null;
  }

  get size(): number {
    return this.pendingRequests.size;
  }

  clear(): void {
    this.pendingRequests.clear();
  }
}

// ==================== 取消请求管理 ====================

class CancelRequestManager {
  private sources = new Map<string, CancelTokenSource>();

  /**
   * 注册请求（自动取消同 key 的旧请求）
   */
  register(key: string): CancelTokenSource {
    const existing = this.sources.get(key);
    if (existing) {
      existing.cancel(`Duplicate request: ${key}`);
    }
    const source = axios.CancelToken.source();
    this.sources.set(key, source);
    return source;
  }

  /**
   * 取消指定 key 的请求
   */
  cancel(key: string, reason = 'Cancelled'): boolean {
    const source = this.sources.get(key);
    if (source) {
      source.cancel(reason);
      this.sources.delete(key);
      return true;
    }
    return false;
  }

  /**
   * 按模式取消
   */
  cancelByPattern(pattern: RegExp, reason = 'Cancelled by pattern'): number {
    let count = 0;
    for (const [key, source] of this.sources) {
      if (pattern.test(key)) {
        source.cancel(reason);
        this.sources.delete(key);
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
    for (const [key, source] of this.sources) {
      source.cancel(reason);
      this.sources.delete(key);
      count++;
    }
    return count;
  }

  /**
   * 注销（不取消）
   */
  unregister(key: string): void {
    this.sources.delete(key);
  }

  get activeCount(): number {
    return this.sources.size;
  }
}

// ==================== 重试管理器 ====================

class RetryManager {
  /**
   * 计算重试延迟（指数退避 + 抖动）
   */
  calculateDelay(attempt: number, baseDelay: number): number {
    const exponential = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * baseDelay * 0.5;
    return Math.min(exponential + jitter, 30000);
  }

  /**
   * 判断是否应该重试
   */
  shouldRetry(
    error: AxiosError,
    attempt: number,
    maxRetries: number,
    customShouldRetry?: (error: AxiosError) => boolean
  ): boolean {
    if (attempt >= maxRetries) return false;
    if (axios.isCancel(error)) return false;

    if (customShouldRetry) return customShouldRetry(error);

    // 默认：重试 5xx、超时、网络错误、429
    const status = error.response?.status;
    const isTimeout = error.code === 'ECONNABORTED';
    const isNetworkError = !error.response && !isTimeout;

    return (
      (status !== undefined && status >= 500) ||
      isTimeout ||
      isNetworkError ||
      status === 429
    );
  }
}

// ==================== Axios 客户端 ====================

export class AxiosClient {
  private instance: AxiosInstance;
  private deduper: AxiosRequestDeduper;
  private cancelManager: CancelRequestManager;
  private retryManager: RetryManager;
  private baseURL: string;
  private defaultTimeout: number;
  private defaultHeaders: Record<string, string>;

  /**
   * 创建 Axios 客户端
   */
  constructor(
    baseURL: string,
    timeout: number = 10000,
    headers: Record<string, string> = {}
  ) {
    this.baseURL = baseURL;
    this.defaultTimeout = timeout;
    this.defaultHeaders = headers;

    this.instance = axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });

    this.deduper = new AxiosRequestDeduper();
    this.cancelManager = new CancelRequestManager();
    this.retryManager = new RetryManager();
  }

  // ==================== 拦截器管理 ====================

  /**
   * 添加请求拦截器
   */
  addRequestInterceptor(
    fn: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>,
    errorFn?: (error: any) => any
  ): void {
    this.instance.interceptors.request.use(fn, errorFn);
  }

  /**
   * 添加响应拦截器
   */
  addResponseInterceptor(
    fn: (response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>,
    errorFn?: (error: AxiosError) => any
  ): void {
    this.instance.interceptors.response.use(fn, errorFn);
  }

  /**
   * 移除拦截器
   */
  removeInterceptor(type: 'request' | 'response', index: number): void {
    if (type === 'request') {
      this.instance.interceptors.request.eject(index);
    } else {
      this.instance.interceptors.response.eject(index);
    }
  }

  /**
   * 清除所有拦截器
   */
  clearInterceptors(): void {
    this.instance.interceptors.request.clear();
    this.instance.interceptors.response.clear();
  }

  // ==================== 核心请求方法 ====================

  /**
   * 通用请求方法
   */
  async request<T = any>(config: ExtendedAxiosConfig): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    const traceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    // 合并默认配置
    const mergedConfig: ExtendedAxiosConfig = {
      timeout: this.defaultTimeout,
      headers: { ...this.defaultHeaders },
      ...config,
    };

    // 请求去重（仅 GET）
    if (mergedConfig.method?.toUpperCase() === 'GET' && mergedConfig.dedupe) {
      const dedupeKey = this.deduper.generateKey(mergedConfig);
      const existing = this.deduper.get<T>(dedupeKey);
      if (existing) {
        return existing.then((response) => ({
          data: response.data,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers as Record<string, string>,
          config: mergedConfig,
          duration: Date.now() - startTime,
          traceId,
        }));
      }
    }

    // 执行请求（带重试）
    const requestPromise = this.executeWithRetry<T>(mergedConfig, traceId);

    // 去重注册
    if (mergedConfig.method?.toUpperCase() === 'GET' && mergedConfig.dedupe) {
      const dedupeKey = this.deduper.generateKey(mergedConfig);
      this.deduper.add(dedupeKey, requestPromise);
    }

    return requestPromise;
  }

  /**
   * 带重试的执行
   */
  private async executeWithRetry<T>(
    config: ExtendedAxiosConfig,
    traceId: string
  ): Promise<ApiResponse<T>> {
    const maxRetries = config.retryCount ?? 0;
    const baseDelay = config.retryDelay ?? 1000;
    let lastError: AxiosError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.instance.request<T>(config);
        return {
          data: response.data,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers as Record<string, string>,
          config,
          duration: Date.now() - (config._startTime || Date.now()),
          traceId,
        };
      } catch (error) {
        lastError = error as AxiosError;

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

        const delay = this.retryManager.calculateDelay(attempt + 1, baseDelay);
        console.warn(
          `[Axios] Retry ${attempt + 1}/${maxRetries} for ${config.method} ${config.url} in ${delay}ms`
        );
        await this.sleep(delay);
      }
    }

    throw this.toNetworkError(lastError!, config, traceId);
  }

  /**
   * 转换为网络错误
   */
  private toNetworkError(
    error: AxiosError,
    config: ExtendedAxiosConfig,
    traceId: string
  ): AxiosNetworkError {
    const isTimeout = error.code === 'ECONNABORTED';
    const isCancelled = axios.isCancel(error);

    const networkError = new Error(error.message) as AxiosNetworkError;
    networkError.name = 'AxiosNetworkError';
    networkError.status = error.response?.status;
    networkError.response = error.response;
    networkError.config = config;
    networkError.isTimeout = isTimeout;
    networkError.isCancelled = isCancelled;
    networkError.isNetworkError = !error.response && !isTimeout && !isCancelled;
    networkError.traceId = traceId;

    return networkError;
  }

  /**
   * 延迟
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==================== HTTP 方法 ====================

  get<T>(url: string, config?: Omit<ExtendedAxiosConfig, 'url' | 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: 'GET' });
  }

  post<T>(url: string, data?: any, config?: Omit<ExtendedAxiosConfig, 'url' | 'method' | 'data'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: 'POST', data });
  }

  put<T>(url: string, data?: any, config?: Omit<ExtendedAxiosConfig, 'url' | 'method' | 'data'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: 'PUT', data });
  }

  patch<T>(url: string, data?: any, config?: Omit<ExtendedAxiosConfig, 'url' | 'method' | 'data'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: 'PATCH', data });
  }

  delete<T>(url: string, config?: Omit<ExtendedAxiosConfig, 'url' | 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: 'DELETE' });
  }

  // ==================== 取消请求 ====================

  cancelRequest(key: string, reason?: string): boolean {
    return this.cancelManager.cancel(key, reason);
  }

  cancelAll(reason?: string): number {
    return this.cancelManager.cancelAll(reason);
  }

  get activeRequests(): number {
    return this.cancelManager.activeCount;
  }

  // ==================== 获取底层实例 ====================

  getInstance(): AxiosInstance {
    return this.instance;
  }

  getBaseURL(): string {
    return this.baseURL;
  }
}

// ==================== Token 刷新管理器 ====================

export class TokenRefreshManager {
  private isRefreshing = false;
  private refreshPromise: Promise<string> | null = null;
  private queue: Array<{
    resolve: (token: string) => void;
    reject: (error: any) => void;
  }> = [];

  constructor(
    private client: AxiosClient,
    private refreshFn: () => Promise<string>,
    private onTokenUpdate: (token: string) => void,
    private onRefreshFailed: () => void
  ) {}

  /**
   * 获取新 Token（并发安全）
   */
  async getNewToken(): Promise<string> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshPromise = this.refreshFn()
        .then((token) => {
          this.onTokenUpdate(token);
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
   * 加入等待队列
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
      if (error) reject(error);
      else resolve(token!);
    });
    this.queue = [];
  }

  /**
   * 创建响应拦截器
   */
  createInterceptor() {
    return async (error: AxiosError): Promise<any> => {
      const config = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      if (error.response?.status !== 401 || !config || config._retry) {
        return Promise.reject(error);
      }

      config._retry = true;

      try {
        let token: string;

        if (this.isRefreshing) {
          token = await this.enqueue();
        } else {
          token = await this.getNewToken();
        }

        config.headers.Authorization = `Bearer ${token}`;
        return this.client.getInstance()(config);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    };
  }
}

// ==================== 拦截器工厂 ====================

/**
 * 认证拦截器
 */
export function createAxiosAuthInterceptor(
  getToken: () => string | null,
  headerName = 'Authorization',
  prefix = 'Bearer '
): (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig {
  return (config) => {
    const token = getToken();
    if (token) {
      config.headers = config.headers || {};
      (config.headers as any)[headerName] = `${prefix}${token}`;
    }
    return config;
  };
}

/**
 * 日志拦截器
 */
export function createAxiosLoggerInterceptor() {
  const requestTimes = new Map<string, number>();

  return {
    request: (config: InternalAxiosRequestConfig) => {
      const key = `${config.method}:${config.url}`;
      requestTimes.set(key, Date.now());
      console.groupCollapsed(`[Axios] → ${config.method?.toUpperCase()} ${config.url}`);
      if (config.params) console.log('Params:', config.params);
      if (config.data) console.log('Data:', config.data);
      return config;
    },
    response: (response: AxiosResponse) => {
      const key = `${response.config.method}:${response.config.url}`;
      const startTime = requestTimes.get(key) || Date.now();
      const duration = Date.now() - startTime;
      console.log(
        `%c[Axios] ← ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url} (${duration}ms)`,
        'color: #4CAF50'
      );
      console.groupEnd();
      requestTimes.delete(key);
      return response;
    },
    error: (error: AxiosError) => {
      console.error(
        `%c[Axios] ✗ ${error.message} ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
        'color: #F44336'
      );
      console.groupEnd();
      return Promise.reject(error);
    },
  };
}

/**
 * 全局错误处理拦截器
 */
export function createAxiosErrorInterceptor(options?: {
  on401?: () => void;
  on403?: () => void;
  on500?: () => void;
  onNetworkError?: () => void;
  onTimeout?: () => void;
}): (error: AxiosError) => Promise<any> {
  return (error) => {
    const status = error.response?.status;
    const isTimeout = error.code === 'ECONNABORTED';
    const isNetworkError = !error.response && !isTimeout;

    if (status === 401) options?.on401?.();
    else if (status === 403) options?.on403?.();
    else if (status && status >= 500) options?.on500?.();

    if (isNetworkError) options?.onNetworkError?.();
    if (isTimeout) options?.onTimeout?.();

    return Promise.reject(error);
  };
}

/**
 * Loading 状态拦截器
 */
export function createAxiosLoadingInterceptor(
  onStart: () => void,
  onEnd: () => void
): {
  request: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig;
  response: (response: AxiosResponse) => AxiosResponse;
  error: (error: AxiosError) => Promise<any>;
} {
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
      return Promise.reject(error);
    },
  };
}
