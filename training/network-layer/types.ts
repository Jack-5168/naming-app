// ===================== 公共类型定义 =====================

/** 请求配置 */
export interface RequestConfig extends RequestInit {
  /** 基础 URL，会拼接到 url 前面 */
  baseURL?: string;
  /** 请求路径（会与 baseURL 拼接） */
  url?: string;
  /** 请求方法 */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  /** URL 查询参数 */
  params?: Record<string, string | number | boolean>;
  /** 请求体（JSON 会自动序列化） */
  data?: unknown;
  /** 自定义请求头 */
  headers?: Record<string, string>;
  /** 超时时间（ms），默认 10000 */
  timeout?: number;
  /** 最大重试次数，默认 3 */
  maxRetries?: number;
  /** 重试间隔（ms），默认 1000 */
  retryDelay?: number;
  /** 是否忽略拦截器（用于登录等不需要 token 的请求） */
  skipInterceptors?: boolean;
  /** 自定义元数据，透传给拦截器 */
  meta?: Record<string, unknown>;
}

/** 响应数据 */
export interface ResponseData<T = unknown> {
  /** 原始响应对象（Fetch: Response / Axios: AxiosResponse） */
  raw: unknown;
  /** 状态码 */
  status: number;
  /** 状态文本 */
  statusText: string;
  /** 响应头 */
  headers: Record<string, string>;
  /** 响应体（已解析） */
  data: T;
  /** 请求耗时（ms） */
  duration: number;
}

/** 拦截器 */
export interface Interceptor<TRequest = RequestConfig, TResponse = ResponseData> {
  /** 请求拦截：在发送前修改 config，或返回 Promise<RequestConfig> */
  request?: (config: TRequest) => TRequest | Promise<TRequest>;
  /** 请求错误拦截：请求发送失败时触发 */
  requestError?: (error: NetworkError) => never | Promise<never>;
  /** 响应拦截：在返回前修改 response，或返回 Promise<ResponseData> */
  response?: (response: TResponse) => TResponse | Promise<TResponse>;
  /** 响应错误拦截：HTTP 错误（非 2xx）时触发 */
  responseError?: (error: NetworkError) => never | Promise<never>;
}

/** 网络错误 */
export class NetworkError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public config?: RequestConfig,
    public response?: ResponseData,
    public isRetryable?: boolean
  ) {
    super(message);
    this.name = 'NetworkError';
  }

  /** 是否超时 */
  get isTimeout(): boolean {
    return this.code === 'ETIMEDOUT' || this.code === 'ETIME';
  }

  /** 是否被取消 */
  get isCancelled(): boolean {
    return this.code === 'ECANCELLED' || this.name === 'AbortError';
  }

  /** 是否网络错误（非 HTTP 错误） */
  get isNetworkError(): boolean {
    return this.status === undefined;
  }
}

/** 可取消的请求 */
export interface CancellableRequest<T = unknown> {
  /** Promise 结果 */
  promise: Promise<ResponseData<T>>;
  /** 取消请求 */
  cancel(reason?: string): void;
}
