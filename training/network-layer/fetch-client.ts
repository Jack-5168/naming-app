// ===================== 基于 Fetch 的完整网络层 =====================

import {
  RequestConfig,
  ResponseData,
  Interceptor,
  NetworkError,
  CancellableRequest,
} from './types';

// ===================== 工具函数 =====================

/** 拼接 URL + query params */
function buildURL(base: string, path: string, params?: Record<string, unknown>): string {
  let url = base.endsWith('/') ? base.slice(0, -1) : base;
  url += path.startsWith('/') ? path : '/' + path;

  if (params && Object.keys(params).length > 0) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        search.append(key, String(value));
      }
    }
    const qs = search.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }

  return url;
}

/** 延迟 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 判断状态码是否可重试 */
function isRetryableStatus(status: number): boolean {
  return [408, 429, 500, 502, 503, 504].includes(status);
}

/** 判断错误是否可重试 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof NetworkError) return error.isRetryable !== false && !error.isCancelled;
  if (error instanceof TypeError) return true; // 网络断开时 fetch 抛 TypeError
  return false;
}

// ===================== FetchClient 类 =====================

class FetchClient {
  /** 基础 URL */
  public baseURL: string = '';
  /** 默认超时 */
  public timeout: number = 10000;
  /** 默认最大重试次数 */
  public maxRetries: number = 3;
  /** 默认重试间隔 */
  public retryDelay: number = 1000;

  /** 请求拦截器队列 */
  private requestInterceptors: Interceptor['request'][] = [];
  /** 请求错误拦截器队列 */
  private requestErrorInterceptors: Interceptor['requestError'][] = [];
  /** 响应拦截器队列 */
  private responseInterceptors: Interceptor['response'][] = [];
  /** 响应错误拦截器队列 */
  private responseErrorInterceptors: Interceptor['responseError'][] = [];

  // ===================== 拦截器注册 =====================

  /**
   * 注册请求拦截器
   * 示例: client.useRequest((cfg) => { cfg.headers['Authorization'] = `Bearer ${token}`; return cfg; })
   */
  useRequest(fn: Interceptor['request']): () => void {
    if (fn) this.requestInterceptors.push(fn);
    // 返回移除函数
    return () => {
      const idx = this.requestInterceptors.indexOf(fn);
      if (idx !== -1) this.requestInterceptors.splice(idx, 1);
    };
  }

  /**
   * 注册请求错误拦截器
   */
  useRequestError(fn: Interceptor['requestError']): () => void {
    if (fn) this.requestErrorInterceptors.push(fn);
    return () => {
      const idx = this.requestErrorInterceptors.indexOf(fn);
      if (idx !== -1) this.requestErrorInterceptors.splice(idx, 1);
    };
  }

  /**
   * 注册响应拦截器
   * 示例: client.useResponse((res) => { return res.data; })
   */
  useResponse(fn: Interceptor['response']): () => void {
    if (fn) this.responseInterceptors.push(fn);
    return () => {
      const idx = this.responseInterceptors.indexOf(fn);
      if (idx !== -1) this.responseInterceptors.splice(idx, 1);
    };
  }

  /**
   * 注册响应错误拦截器
   */
  useResponseError(fn: Interceptor['responseError']): () => void {
    if (fn) this.responseErrorInterceptors.push(fn);
    return () => {
      const idx = this.responseErrorInterceptors.indexOf(fn);
      if (idx !== -1) this.responseErrorInterceptors.splice(idx, 1);
    };
  }

  /** 清除所有拦截器 */
  clearInterceptors(): void {
    this.requestInterceptors = [];
    this.requestErrorInterceptors = [];
    this.responseInterceptors = [];
    this.responseErrorInterceptors = [];
  }

  // ===================== 核心请求方法 =====================

  /**
   * 发起请求（支持重试、取消、超时、拦截器）
   */
  request<T = unknown>(config: RequestConfig): CancellableRequest<T> {
    const controller = new AbortController();
    let cancelled = false;

    const promise = (async (): Promise<ResponseData<T>> => {
      let currentConfig: RequestConfig = { ...config };

      // 1. 合并默认配置
      currentConfig.baseURL = currentConfig.baseURL ?? this.baseURL;
      currentConfig.timeout = currentConfig.timeout ?? this.timeout;
      currentConfig.maxRetries = currentConfig.maxRetries ?? this.maxRetries;
      currentConfig.retryDelay = currentConfig.retryDelay ?? this.retryDelay;
      currentConfig.headers = { ...currentConfig.headers };

      // 2. 执行请求拦截器
      if (!currentConfig.skipInterceptors) {
        for (const interceptor of this.requestInterceptors) {
          try {
            currentConfig = (await interceptor!(currentConfig)) ?? currentConfig;
          } catch (err) {
            // 请求错误拦截器
            for (const errHandler of this.requestErrorInterceptors) {
              try {
                return await errHandler!(
                  new NetworkError(
                    err instanceof Error ? err.message : String(err),
                    undefined,
                    'EINTERCEPTOR',
                    currentConfig
                  )
                );
              } catch {}
            }
            throw err;
          }
        }
      }

      // 3. 构建最终 URL
      const url = buildURL(
        currentConfig.baseURL ?? '',
        currentConfig.url ?? '',
        currentConfig.params
      );

      // 4. 处理请求体
      const fetchInit: RequestInit = {
        method: currentConfig.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...currentConfig.headers,
        } as Record<string, string>,
        signal: controller.signal,
      };

      if (currentConfig.data && ['POST', 'PUT', 'PATCH'].includes(fetchInit.method as string)) {
        fetchInit.body =
          typeof currentConfig.data === 'string'
            ? currentConfig.data
            : JSON.stringify(currentConfig.data);
      }

      // 5. 超时控制
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          if (!cancelled) {
            controller.abort();
            reject(
              new NetworkError(
                `Request timeout after ${currentConfig.timeout}ms`,
                undefined,
                'ETIMEDOUT',
                currentConfig,
                undefined,
                true
              )
            );
          }
        }, currentConfig.timeout);
      });

      // 6. 带重试的发送逻辑
      const sendWithRetry = async (): Promise<ResponseData<T>> => {
        let lastError: NetworkError | null = null;
        const maxAttempts = (currentConfig.maxRetries ?? 3) + 1; // 原始请求 + 重试

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (cancelled) {
            throw new NetworkError('Request cancelled', undefined, 'ECANCELLED', currentConfig);
          }

          const startTime = Date.now();

          try {
            // 竞态：fetch vs timeout
            const response = await Promise.race([
              fetch(url, fetchInit),
              timeoutPromise,
            ]);

            const duration = Date.now() - startTime;

            // 解析响应头
            const headers: Record<string, string> = {};
            response.headers.forEach((value, key) => {
              headers[key] = value;
            });

            // 解析响应体
            const contentType = response.headers.get('content-type') || '';
            let data: T;
            if (contentType.includes('application/json')) {
              data = await response.json();
            } else if (contentType.includes('text/')) {
              data = (await response.text()) as unknown as T;
            } else {
              data = (await response.blob()) as unknown as T;
            }

            const responseData: ResponseData<T> = {
              raw: response,
              status: response.status,
              statusText: response.statusText,
              headers,
              data,
              duration,
            };

            // HTTP 错误（非 2xx）
            if (!response.ok) {
              const error = new NetworkError(
                `HTTP ${response.status}: ${response.statusText}`,
                response.status,
                `EHTTP_${response.status}`,
                currentConfig,
                responseData,
                isRetryableStatus(response.status)
              );

              // 可重试且还有重试次数
              if (error.isRetryable && attempt < maxAttempts - 1) {
                lastError = error;
                const waitMs = (currentConfig.retryDelay ?? 1000) * Math.pow(2, attempt); // 指数退避
                await delay(waitMs);
                continue;
              }

              // 执行响应错误拦截器
              if (!currentConfig.skipInterceptors) {
                for (const errHandler of this.responseErrorInterceptors) {
                  try {
                    return await errHandler!(error);
                  } catch (handled) {
                    // 拦截器返回了新结果
                    if (handled && typeof handled === 'object' && 'data' in handled) {
                      return handled as ResponseData<T>;
                    }
                  }
                }
              }

              throw error;
            }

            // 执行响应拦截器
            let finalResponse = responseData;
            if (!currentConfig.skipInterceptors) {
              for (const interceptor of this.responseInterceptors) {
                finalResponse = ((await interceptor!(finalResponse)) as ResponseData<T>) ?? finalResponse;
              }
            }

            return finalResponse;
          } catch (err) {
            const duration = Date.now() - startTime;

            // 取消请求
            if (err instanceof DOMException && err.name === 'AbortError') {
              if (cancelled) {
                throw new NetworkError('Request cancelled', undefined, 'ECANCELLED', currentConfig);
              }
              // 否则是超时触发的 abort
              throw err;
            }

            // 超时错误
            if (err instanceof NetworkError && err.isTimeout) {
              throw err;
            }

            // 网络错误（可重试）
            const networkError = new NetworkError(
              err instanceof Error ? err.message : String(err),
              undefined,
              'ENETWORK',
              currentConfig,
              undefined,
              true
            );

            if (attempt < maxAttempts - 1 && isRetryableError(err)) {
              lastError = networkError;
              const waitMs = (currentConfig.retryDelay ?? 1000) * Math.pow(2, attempt);
              await delay(waitMs);
              continue;
            }

            // 执行请求错误拦截器
            if (!currentConfig.skipInterceptors) {
              for (const errHandler of this.requestErrorInterceptors) {
                try {
                  return await errHandler!(networkError);
                } catch (handled) {
                  if (handled && typeof handled === 'object' && 'data' in handled) {
                    return handled as ResponseData<T>;
                  }
                }
              }
            }

            throw networkError;
          } finally {
            if (timeoutId) clearTimeout(timeoutId);
          }
        }

        // 所有重试都失败了
        throw lastError!;
      };

      return sendWithRetry();
    })();

    return {
      promise,
      cancel: (reason = 'Request cancelled by user') => {
        cancelled = true;
        controller.abort(reason);
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

// ===================== 导出 =====================

export { FetchClient };

// ===================== 使用示例 =====================

/**
 * // 创建实例
 * const client = new FetchClient();
 * client.baseURL = 'https://api.example.com';
 *
 * // 注册请求拦截器（自动加 token）
 * client.useRequest((config) => {
 *   const token = localStorage.getItem('token');
 *   if (token) {
 *     config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
 *   }
 *   console.log(`→ ${config.method} ${config.url}`);
 *   return config;
 * });
 *
 * // 注册响应拦截器（统一解包）
 * client.useResponse((response) => {
 *   console.log(`← ${response.status} ${response.duration}ms`);
 *   return response;
 * });
 *
 * // 注册响应错误拦截器（统一处理 401）
 * client.useResponseError((error) => {
 *   if (error.status === 401) {
 *     localStorage.removeItem('token');
 *     window.location.href = '/login';
 *   }
 *   throw error;
 * });
 *
 * // 普通请求
 * const res = await client.get('/users', { params: { page: 1 } });
 *
 * // 带重试的请求（最多重试 5 次，间隔 500ms）
 * const res = await client.post('/orders', { item: 'book' }, {
 *   maxRetries: 5,
 *   retryDelay: 500,
 * });
 *
 * // 取消请求
 * const req = client.get('/large-data');
 * setTimeout(() => req.cancel('User navigated away'), 3000);
 * try {
 *   await req.promise;
 * } catch (err) {
 *   if (err instanceof NetworkError && err.isCancelled) {
 *     console.log('请求已取消');
 *   }
 * }
 *
 * // 超时
 * const res = await client.get('/slow', { timeout: 5000 });
 */
