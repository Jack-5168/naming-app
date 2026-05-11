// ===================== 基于 Axios 的完整网络层 =====================

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  CancelTokenSource,
  isCancel,
  Cancel,
} from 'axios';

import {
  RequestConfig,
  ResponseData,
  Interceptor,
  NetworkError,
  CancellableRequest,
} from './types';

// ===================== 工具函数 =====================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return [408, 429, 500, 502, 503, 504].includes(status);
}

// ===================== AxiosClient 类 =====================

class AxiosClient {
  /** 底层 Axios 实例 */
  public instance: AxiosInstance;
  /** 默认超时 */
  public timeout: number = 10000;
  /** 默认最大重试次数 */
  public maxRetries: number = 3;
  /** 默认重试间隔 */
  public retryDelay: number = 1000;

  /** 自定义拦截器（在 Axios 原生拦截器之上） */
  private customRequestInterceptors: ((config: AxiosRequestConfig) => AxiosRequestConfig | Promise<AxiosRequestConfig>)[] = [];
  private customResponseInterceptors: ((response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>)[] = [];

  constructor(config?: AxiosRequestConfig) {
    this.instance = axios.create({
      timeout: config?.timeout ?? 10000,
      baseURL: config?.baseURL ?? '',
      headers: config?.headers ?? {},
      ...config,
    });

    // Axios 原生拦截器：将自定义拦截器链插入
    this.instance.interceptors.request.use(
      async (config) => {
        let current = config;
        for (const interceptor of this.customRequestInterceptors) {
          current = (await interceptor(current)) ?? current;
        }
        return current;
      },
      async (error: AxiosError) => {
        // 自定义请求错误拦截器
        for (const handler of (this as any)._customRequestErrorInterceptors || []) {
          try {
            return await handler(error);
          } catch {}
        }
        return Promise.reject(error);
      }
    );

    this.instance.interceptors.response.use(
      async (response) => {
        let current = response;
        for (const interceptor of this.customResponseInterceptors) {
          current = (await interceptor(current)) ?? current;
        }
        return current;
      },
      async (error: AxiosError) => {
        // 自定义响应错误拦截器
        for (const handler of (this as any)._customResponseErrorInterceptors || []) {
          try {
            return await handler(error);
          } catch {}
        }
        return Promise.reject(error);
      }
    );
  }

  // ===================== 自定义拦截器 =====================

  /**
   * 注册请求拦截器（Axios 原生风格）
   */
  useRequest(
    fn: (config: AxiosRequestConfig) => AxiosRequestConfig | Promise<AxiosRequestConfig>,
    onError?: (error: AxiosError) => never | Promise<never>
  ): () => void {
    this.customRequestInterceptors.push(fn);
    if (onError) {
      (this as any)._customRequestErrorInterceptors = (this as any)._customRequestErrorInterceptors || [];
      (this as any)._customRequestErrorInterceptors.push(onError);
    }
    return () => {
      const idx = this.customRequestInterceptors.indexOf(fn);
      if (idx !== -1) this.customRequestInterceptors.splice(idx, 1);
    };
  }

  /**
   * 注册响应拦截器（Axios 原生风格）
   */
  useResponse(
    fn: (response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>,
    onError?: (error: AxiosError) => never | Promise<never>
  ): () => void {
    this.customResponseInterceptors.push(fn);
    if (onError) {
      (this as any)._customResponseErrorInterceptors = (this as any)._customResponseErrorInterceptors || [];
      (this as any)._customResponseErrorInterceptors.push(onError);
    }
    return () => {
      const idx = this.customResponseInterceptors.indexOf(fn);
      if (idx !== -1) this.customResponseInterceptors.splice(idx, 1);
    };
  }

  /**
   * 注册 Axios 原生拦截器（直接操作 instance.interceptors）
   */
  get interceptors() {
    return this.instance.interceptors;
  }

  // ===================== 带重试的请求 =====================

  /**
   * 带重试的 Axios 请求
   */
  async requestWithRetry<T = unknown>(
    config: AxiosRequestConfig & { maxRetries?: number; retryDelay?: number }
  ): Promise<AxiosResponse<T>> {
    const maxRetries = config.maxRetries ?? this.maxRetries;
    const retryDelay = config.retryDelay ?? this.retryDelay;
    let lastError: AxiosError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.instance.request<T>(config);
        return response;
      } catch (err) {
        const error = err as AxiosError;

        // 取消请求不重试
        if (isCancel(error)) {
          throw error;
        }

        lastError = error;

        // 判断是否可重试
        const shouldRetry =
          attempt < maxRetries &&
          (error.code === 'ECONNABORTED' || // 超时
            error.code === 'ERR_NETWORK' || // 网络错误
            (error.response && isRetryableStatus(error.response.status))); // 可重试状态码

        if (!shouldRetry) break;

        // 指数退避
        const waitMs = retryDelay * Math.pow(2, attempt);
        await delay(waitMs);
      }
    }

    throw lastError!;
  }

  // ===================== 统一封装接口（与 FetchClient 一致） =====================

  /**
   * 发起请求（统一接口，内部使用 Axios）
   */
  request<T = unknown>(config: RequestConfig): CancellableRequest<T> {
    const cancelToken = axios.CancelToken.source();
    let cancelled = false;

    const promise = (async (): Promise<ResponseData<T>> => {
      const startTime = Date.now();

      // 转换为 Axios 配置
      const axiosConfig: AxiosRequestConfig = {
        url: config.url,
        method: config.method as AxiosRequestConfig['method'],
        baseURL: config.baseURL ?? this.instance.defaults.baseURL,
        params: config.params,
        data: config.data,
        headers: config.headers,
        timeout: config.timeout ?? this.timeout,
        cancelToken: cancelToken.token,
      };

      try {
        const response = await this.requestWithRetry<T>(axiosConfig);
        const duration = Date.now() - startTime;

        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(response.headers)) {
          if (typeof value === 'string') headers[key] = value;
        }

        return {
          raw: response,
          status: response.status,
          statusText: response.statusText,
          headers,
          data: response.data,
          duration,
        };
      } catch (err) {
        const duration = Date.now() - startTime;
        const axiosError = err as AxiosError;

        // 取消
        if (isCancel(axiosError) || cancelled) {
          throw new NetworkError(
            axiosError.message || 'Request cancelled',
            undefined,
            'ECANCELLED',
            config,
            undefined,
            false
          );
        }

        // 构建 NetworkError
        return Promise.reject(
          new NetworkError(
            axiosError.message,
            axiosError.response?.status,
            axiosError.code || 'EUNKNOWN',
            config,
            axiosError.response
              ? {
                  raw: axiosError.response,
                  status: axiosError.response.status,
                  statusText: axiosError.response.statusText,
                  data: axiosError.response.data,
                  headers: {},
                  duration,
                }
              : undefined,
            axiosError.code === 'ECONNABORTED' ||
              axiosError.code === 'ERR_NETWORK' ||
              (axiosError.response && isRetryableStatus(axiosError.response?.status ?? 0))
          )
        );
      }
    })();

    return {
      promise,
      cancel: (reason?: string) => {
        cancelled = true;
        cancelToken.cancel(reason || 'Request cancelled');
      },
    };
  }

  // ===================== 便捷方法 =====================

  get<T = unknown>(url: string, config?: Omit<RequestConfig, 'url' | 'method'>): CancellableRequest<T> {
    return this.request<T>({ ...config, url, method: 'GET' });
  }

  post<T = unknown>(url: string, data?: unknown, config?: Omit<RequestConfig, 'url' | 'method'>): CancellableRequest<T> {
    return this.request<T>({ ...config, url, method: 'POST', data });
  }

  put<T = unknown>(url: string, data?: unknown, config?: Omit<RequestConfig, 'url' | 'method'>): CancellableRequest<T> {
    return this.request<T>({ ...config, url, method: 'PUT', data });
  }

  patch<T = unknown>(url: string, data?: unknown, config?: Omit<RequestConfig, 'url' | 'method'>): CancellableRequest<T> {
    return this.request<T>({ ...config, url, method: 'PATCH', data });
  }

  delete<T = unknown>(url: string, config?: Omit<RequestConfig, 'url' | 'method'>): CancellableRequest<T> {
    return this.request<T>({ ...config, url, method: 'DELETE' });
  }
}

export { AxiosClient };

// ===================== 使用示例 =====================

/**
 * // 创建实例
 * const client = new AxiosClient({ baseURL: 'https://api.example.com' });
 *
 * // 请求拦截器
 * client.useRequest((config) => {
 *   const token = localStorage.getItem('token');
 *   if (token) config.headers.Authorization = `Bearer ${token}`;
 *   return config;
 * });
 *
 * // 响应拦截器
 * client.useResponse(
 *   (response) => response,
 *   (error) => {
 *     if (error.response?.status === 401) {
 *       localStorage.removeItem('token');
 *       window.location.href = '/login';
 *     }
 *     return Promise.reject(error);
 *   }
 * );
 *
 * // 直接操作 Axios 原生拦截器
 * client.interceptors.request.use((config) => {
 *   config.metadata = { startTime: Date.now() };
 *   return config;
 * });
 *
 * client.interceptors.response.use((response) => {
 *   const duration = Date.now() - (response.config.metadata as any)?.startTime;
 *   console.log(`${response.config.url} took ${duration}ms`);
 *   return response;
 * });
 *
 * // 请求
 * const res = await client.get('/users').promise;
 *
 * // 取消
 * const req = client.get('/users');
 * req.cancel('User navigated away');
 */
