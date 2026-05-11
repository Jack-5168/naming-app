/**
 * 网络层完整实现
 * 涵盖：Fetch/Axios/拦截器/重试机制/取消请求/请求去重/超时处理
 */

// ==================== 类型定义 ====================

interface RequestConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  data?: any;
  params?: Record<string, string>;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  shouldRetry?: (error: any) => boolean;
  signal?: AbortSignal;
  cache?: boolean;
  dedupe?: boolean;
}

interface Response<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: RequestConfig;
}

interface ApiError extends Error {
  status?: number;
  response?: Response;
  config?: RequestConfig;
  isTimeout?: boolean;
  isCancelled?: boolean;
}

// ==================== 错误类 ====================

class NetworkError extends Error implements ApiError {
  status?: number;
  response?: Response;
  config?: RequestConfig;
  isTimeout?: boolean;
  isCancelled?: boolean;

  constructor(message: string, options?: Partial<ApiError>) {
    super(message);
    this.name = 'NetworkError';
    Object.assign(this, options);
  }
}

// ==================== 请求去重管理 ====================

class RequestDeduper {
  private pendingRequests: Map<string, Promise<any>> = new Map();

  generateKey(config: RequestConfig): string {
    const { url, method = 'GET', params, data } = config;
    return `${method}:${url}:${JSON.stringify(params || {})}:${JSON.stringify(data || {})}`;
  }

  has(key: string): boolean {
    return this.pendingRequests.has(key);
  }

  add(key: string, promise: Promise<any>): void {
    this.pendingRequests.set(key, promise);
    promise.finally(() => this.pendingRequests.delete(key));
  }

  get(key: string): Promise<any> | undefined {
    return this.pendingRequests.get(key);
  }
}

// ==================== 重试机制 ====================

class RetryManager {
  private calculateDelay(attempt: number, baseDelay: number): number {
    // 指数退避：baseDelay * 2^(attempt-1) + 随机抖动
    const exponential = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // 0-1000ms 随机抖动
    return exponential + jitter;
  }

  async execute<T>(
    fn: () => Promise<T>,
    config: RequestConfig
  ): Promise<T> {
    const maxRetries = config.retryCount ?? 3;
    const baseDelay = config.retryDelay ?? 1000;
    const shouldRetry = config.shouldRetry ?? this.defaultShouldRetry;

    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // 如果是最后一次尝试，直接抛出
        if (attempt > maxRetries) {
          throw error;
        }

        // 检查是否应该重试
        if (!shouldRetry(error)) {
          throw error;
        }

        // 等待后重试
        const delay = this.calculateDelay(attempt, baseDelay);
        console.log(`[Retry] Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms...`);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private defaultShouldRetry(error: any): boolean {
    // 不重试取消的请求
    if (error.isCancelled) return false;

    // 不重试客户端错误（4xx）
    if (error.status && error.status >= 400 && error.status < 500) {
      return false;
    }

    // 重试网络错误、超时、服务端错误（5xx）
    return true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ==================== 拦截器管理 ====================

type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
type ResponseInterceptor = <T>(response: Response<T>) => Response<T> | Promise<Response<T>>;
type ErrorInterceptor = (error: any) => any | Promise<any>;

class InterceptorManager {
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];

  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  addErrorInterceptor(interceptor: ErrorInterceptor): void {
    this.errorInterceptors.push(interceptor);
  }

  async processRequest(config: RequestConfig): Promise<RequestConfig> {
    let processedConfig = { ...config };
    for (const interceptor of this.requestInterceptors) {
      processedConfig = await interceptor(processedConfig);
    }
    return processedConfig;
  }

  async processResponse<T>(response: Response<T>): Promise<Response<T>> {
    let processedResponse = { ...response };
    for (const interceptor of this.responseInterceptors) {
      processedResponse = await interceptor(processedResponse);
    }
    return processedResponse;
  }

  async processError(error: any): Promise<any> {
    let processedError = error;
    for (const interceptor of this.errorInterceptors) {
      processedError = await interceptor(processedError);
    }
    return processedError;
  }
}

// ==================== 超时控制 ====================

function withTimeout<T>(promise: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const error = new NetworkError('Request timeout', { isTimeout: true });
      reject(error);
    }, ms);

    // 如果提供了 AbortSignal，监听取消
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        const error = new NetworkError('Request cancelled', { isCancelled: true });
        reject(error);
      });
    }

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeoutId));
  });
}

// ==================== 主网络客户端 ====================

class NetworkClient {
  private baseURL: string;
  private defaultTimeout: number;
  private interceptors: InterceptorManager;
  private retryManager: RetryManager;
  private deduper: RequestDeduper;
  private defaultHeaders: Record<string, string>;

  constructor(options: {
    baseURL: string;
    timeout?: number;
    headers?: Record<string, string>;
  }) {
    this.baseURL = options.baseURL;
    this.defaultTimeout = options.timeout ?? 30000;
    this.defaultHeaders = options.headers ?? {};
    this.interceptors = new InterceptorManager();
    this.retryManager = new RetryManager();
    this.deduper = new RequestDeduper();
  }

  // ==================== 拦截器接口 ====================

  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.interceptors.addRequestInterceptor(interceptor);
  }

  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.interceptors.addResponseInterceptor(interceptor);
  }

  addErrorInterceptor(interceptor: ErrorInterceptor): void {
    this.interceptors.addErrorInterceptor(interceptor);
  }

  // ==================== 核心请求方法 ====================

  async request<T>(config: RequestConfig): Promise<Response<T>> {
    // 1. 合并配置
    const mergedConfig = this.mergeConfig(config);

    // 2. 处理请求拦截器
    const processedConfig = await this.interceptors.processRequest(mergedConfig);

    // 3. 请求去重
    if (processedConfig.dedupe) {
      const key = this.deduper.generateKey(processedConfig);
      const existing = this.deduper.get(key);
      if (existing) {
        console.log(`[Dedupe] Returning existing request for ${key}`);
        return existing as Promise<Response<T>>;
      }
    }

    // 4. 创建 AbortController（如果未提供 signal）
    const controller = processedConfig.signal ? null : new AbortController();
    const signal = processedConfig.signal || controller?.signal;

    // 5. 执行请求（带重试）
    const executeRequest = async (): Promise<Response<T>> => {
      // 创建带超时的 Promise
      const fetchPromise = this.executeFetch(processedConfig, signal);

      // 添加超时处理
      const timeout = processedConfig.timeout ?? this.defaultTimeout;
      const response = await withTimeout(fetchPromise, timeout, signal);

      // 处理响应拦截器
      return this.interceptors.processResponse(response);
    };

    // 6. 应用重试逻辑
    const requestWithRetry = async () => {
      try {
        const result = await this.retryManager.execute(executeRequest, processedConfig);

        // 如果是去重请求，从 pending 中移除
        if (processedConfig.dedupe) {
          const key = this.deduper.generateKey(processedConfig);
          this.deduper.get(key)?.finally(() => {
            // Promise 已完成，deduper 会自动清理
          });
        }

        return result;
      } catch (error) {
        // 处理错误拦截器
        return this.interceptors.processError(error);
      }
    };

    const promise = requestWithRetry();

    // 7. 注册到去重管理器
    if (processedConfig.dedupe) {
      const key = this.deduper.generateKey(processedConfig);
      this.deduper.add(key, promise);
    }

    return promise;
  }

  private mergeConfig(config: RequestConfig): RequestConfig {
    return {
      ...config,
      url: this.buildURL(config.url, config.params),
      headers: {
        ...this.defaultHeaders,
        ...config.headers,
      },
    };
  }

  private buildURL(url: string, params?: Record<string, string>): string {
    const fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`;

    if (!params || Object.keys(params).length === 0) {
      return fullURL;
    }

    const queryString = new URLSearchParams(params).toString();
    const separator = fullURL.includes('?') ? '&' : '?';
    return `${fullURL}${separator}${queryString}`;
  }

  private async executeFetch<T>(config: RequestConfig, signal?: AbortSignal): Promise<Response<T>> {
    const { url, method = 'GET', headers, data } = config;

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal,
    };

    // 处理请求体（GET/HEAD 不需要 body）
    if (data && method !== 'GET' && method !== 'HEAD') {
      if (typeof data === 'string') {
        fetchOptions.body = data;
      } else if (data instanceof FormData) {
        fetchOptions.body = data;
        // FormData 会自动设置 Content-Type
        delete (fetchOptions.headers as Record<string, string>)['Content-Type'];
      } else {
        fetchOptions.body = JSON.stringify(data);
        (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
      }
    }

    const response = await fetch(url, fetchOptions);

    // 解析响应
    const contentType = response.headers.get('content-type') || '';
    let responseData: any;

    if (contentType.includes('application/json')) {
      responseData = await response.json();
    } else if (contentType.includes('text/')) {
      responseData = await response.text();
    } else {
      responseData = await response.blob();
    }

    // 检查 HTTP 状态码
    if (!response.ok) {
      const error = new NetworkError(`HTTP ${response.status}: ${response.statusText}`, {
        status: response.status,
        response: {
          data: responseData,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          config,
        },
        config,
      });
      throw error;
    }

    return {
      data: responseData as T,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      config,
    };
  }

  // ==================== 便捷方法 ====================

  async get<T>(url: string, config?: Partial<RequestConfig>): Promise<Response<T>> {
    return this.request<T>({ ...config, url, method: 'GET' });
  }

  async post<T>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<Response<T>> {
    return this.request<T>({ ...config, url, method: 'POST', data });
  }

  async put<T>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<Response<T>> {
    return this.request<T>({ ...config, url, method: 'PUT', data });
  }

  async delete<T>(url: string, config?: Partial<RequestConfig>): Promise<Response<T>> {
    return this.request<T>({ ...config, url, method: 'DELETE' });
  }

  async patch<T>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<Response<T>> {
    return this.request<T>({ ...config, url, method: 'PATCH', data });
  }

  // ==================== 取消请求 ====================

  createCancelToken(): { token: AbortSignal; cancel: (reason?: string) => void } {
    const controller = new AbortController();
    return {
      token: controller.signal,
      cancel: (reason?: string) => controller.abort(reason),
    };
  }
}

// ==================== 常用拦截器示例 ====================

// 认证拦截器
function createAuthInterceptor(tokenGetter: () => string | null): RequestInterceptor {
  return (config) => {
    const token = tokenGetter();
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    return config;
  };
}

// 日志拦截器
function createLoggerInterceptor(): {
  request: RequestInterceptor;
  response: ResponseInterceptor;
  error: ErrorInterceptor;
} {
  const startTime = new Map<string, number>();

  return {
    request: (config) => {
      const key = `${config.method}:${config.url}`;
      startTime.set(key, Date.now());
      console.log(`[HTTP] → ${config.method} ${config.url}`);
      return config;
    },
    response: (response) => {
      const key = `${response.config.method}:${response.config.url}`;
      const duration = Date.now() - (startTime.get(key) || 0);
      console.log(`[HTTP] ← ${response.status} ${response.config.url} (${duration}ms)`);
      return response;
    },
    error: (error) => {
      const key = error.config ? `${error.config.method}:${error.config.url}` : 'unknown';
      const duration = startTime.get(key) ? Date.now() - startTime.get(key)! : 0;
      console.error(`[HTTP] ✗ ${error.message} (${duration}ms)`);
      throw error;
    },
  };
}

// 错误处理拦截器
function createErrorInterceptor(options?: {
  on401?: () => void;
  on403?: () => void;
  on500?: () => void;
}): ErrorInterceptor {
  return async (error) => {
    if (error.status === 401) {
      console.error('[HTTP] 401 Unauthorized - Token expired');
      options?.on401?.();
    } else if (error.status === 403) {
      console.error('[HTTP] 403 Forbidden - Access denied');
      options?.on403?.();
    } else if (error.status === 500) {
      console.error('[HTTP] 500 Internal Server Error');
      options?.on500?.();
    }

    if (error.isTimeout) {
      console.error('[HTTP] Request timeout');
    }

    if (error.isCancelled) {
      console.log('[HTTP] Request cancelled');
    }

    throw error;
  };
}

// ==================== 导出 ====================

export {
  NetworkClient,
  NetworkError,
  RequestConfig,
  Response,
  ApiError,
  RequestDeduper,
  RetryManager,
  InterceptorManager,
  withTimeout,
  createAuthInterceptor,
  createLoggerInterceptor,
  createErrorInterceptor,
};

// ==================== 使用示例 ====================

/*
// 1. 基础使用
const client = new NetworkClient({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 2. 添加拦截器
const logger = createLoggerInterceptor();
client.addRequestInterceptor(logger.request);
client.addResponseInterceptor(logger.response);
client.addErrorInterceptor(logger.error);

client.addRequestInterceptor(createAuthInterceptor(() => localStorage.getItem('token')));

client.addErrorInterceptor(createErrorInterceptor({
  on401: () => {
    // 跳转到登录页
    window.location.href = '/login';
  },
}));

// 3. 发送请求
try {
  const response = await client.get<User[]>('/users', {
    params: { page: '1', limit: '10' },
    retryCount: 3,
    retryDelay: 1000,
  });
  console.log(response.data);
} catch (error) {
  console.error(error);
}

// 4. 取消请求
const { token, cancel } = client.createCancelToken();

// 发送带取消功能的请求
const promise = client.get('/data', { signal: token });

// 需要时取消
cancel('User navigated away');

// 5. 请求去重（防止重复提交）
await client.post('/submit', { data }, { dedupe: true });

// 6. 自定义重试条件
const response = await client.get('/flaky-endpoint', {
  retryCount: 5,
  shouldRetry: (error) => {
    // 只在特定错误码时重试
    return error.status === 429 || error.status >= 500;
  },
});
*/
