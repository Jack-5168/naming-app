/**
 * 网络层实战示例
 * 
 * 展示各种常见场景的最佳实践
 */

import { NetworkClient, AxiosClient, batchRequest, SearchController } from './network-client';
import {
  createAxiosAuthInterceptor,
  createAxiosLoggerInterceptor,
  createAxiosErrorInterceptor,
  createAxiosLoadingInterceptor,
  TokenRefreshManager,
} from './axios-client';

// ==================== 示例 1: 基础 API 客户端配置 ====================

const api = new NetworkClient('https://api.example.com', {
  timeout: 15000,
  maxRetries: 2,
  retryStrategy: 'exponential',
  cacheStrategy: 'no-cache',
  cacheTTL: 5 * 60 * 1000,
});

// ==================== 示例 2: 认证拦截器 ====================

function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

function setAuthToken(token: string): void {
  localStorage.setItem('authToken', token);
}

api.addRequestInterceptor('auth', (config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
  }
  return config;
});

// ==================== 示例 3: 请求/响应日志 ====================

const requestTimes = new Map<string, number>();

api.addRequestInterceptor('logger-request', (config) => {
  const key = `${config.method}:${config.url}`;
  requestTimes.set(key, Date.now());
  console.groupCollapsed(`[HTTP] → ${config.method} ${config.url}`);
  if (config.params) console.log('Params:', config.params);
  if (config.body) console.log('Body:', config.body);
  return config;
});

api.addResponseInterceptor('logger-response', (response) => {
  const key = `${response.config.method}:${response.config.url}`;
  const startTime = requestTimes.get(key) || Date.now();
  const duration = Date.now() - startTime;
  console.log(
    `%c[HTTP] ← ${response.status} ${response.config.method} ${response.config.url} (${duration}ms)`,
    'color: #4CAF50'
  );
  console.groupEnd();
  requestTimes.delete(key);
  return response;
});

api.addErrorInterceptor('logger-error', (error) => {
  console.error(
    `%c[HTTP] ✗ ${error.message} ${error.config?.method} ${error.config?.url}`,
    'color: #F44336'
  );
  console.groupEnd();
  throw error;
});

// ==================== 示例 4: 全局错误处理 ====================

api.addErrorInterceptor('error-handler', (error) => {
  switch (error.status) {
    case 401:
      localStorage.removeItem('authToken');
      window.location.href = '/login';
      break;
    case 403:
      console.error('权限不足');
      break;
    case 404:
      console.error('资源不存在');
      break;
    case 500:
    case 502:
    case 503:
    case 504:
      console.error('服务器错误');
      break;
  }

  if (error.isTimeout) {
    console.error('请求超时');
  }

  if (error.isNetworkError) {
    console.error('网络错误');
  }

  throw error;
});

// ==================== 示例 5: Loading 状态 ====================

let loadingCount = 0;

api.addRequestInterceptor('loading-request', (config) => {
  loadingCount++;
  if (loadingCount === 1) {
    console.log('Loading started...');
    // showLoading();
  }
  return config;
});

api.addResponseInterceptor('loading-response', (response) => {
  loadingCount--;
  if (loadingCount <= 0) {
    loadingCount = 0;
    console.log('Loading finished.');
    // hideLoading();
  }
  return response;
});

api.addErrorInterceptor('loading-error', (error) => {
  loadingCount--;
  if (loadingCount <= 0) {
    loadingCount = 0;
    console.log('Loading finished (error).');
    // hideLoading();
  }
  throw error;
});

// ==================== 示例 6: API 模块定义 ====================

interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
}

interface Post {
  id: number;
  title: string;
  body: string;
  userId: number;
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
  create: (data: { name: string; email: string; password: string }) =>
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

const postApi = {
  // 获取文章列表
  list: (page = 1, pageSize = 10) =>
    api.get<PaginatedResponse<Post>>('/posts', {
      params: { page, pageSize },
      cacheStrategy: 'stale-while-revalidate',
      cacheTTL: 3 * 60 * 1000,
    }),

  // 获取单个文章
  get: (id: number) =>
    api.get<Post>(`/posts/${id}`, {
      cacheStrategy: 'cache-first',
      cacheTTL: 10 * 60 * 1000,
    }),

  // 创建文章
  create: (data: { title: string; body: string }) =>
    api.post<Post>('/posts', data, { maxRetries: 1 }),

  // 更新文章
  update: (id: number, data: Partial<Post>) =>
    api.put<Post>(`/posts/${id}`, data, { maxRetries: 1 }),

  // 删除文章
  delete: (id: number) => api.delete(`/posts/${id}`),
};

// ==================== 示例 7: 搜索框实现（防抖 + 取消 + 竞态处理） ====================

class SearchController {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentRequestId = 0;

  constructor(
    private searchFn: (query: string) => Promise<any>,
    private onResults: (results: any[], query: string) => void,
    private debounceMs = 300
  ) {}

  search(query: string): void {
    // 清除防抖定时器
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    // 递增请求 ID（解决竞态问题）
    this.currentRequestId++;
    const requestId = this.currentRequestId;

    // 空查询直接返回
    if (!query.trim()) {
      this.onResults([], query);
      return;
    }

    // 防抖
    this.debounceTimer = setTimeout(async () => {
      try {
        const { data } = await this.searchFn(query);

        // 竞态检查：只有最新的请求才更新 UI
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

// 使用搜索控制器
const userSearch = new SearchController(
  (q) => userApi.search(q),
  (results, query) => {
    console.log(`搜索 "${query}": ${results.length} 条结果`);
    // updateSearchResults(results);
  },
  300
);

// 绑定到输入框
// document.getElementById('search-input')?.addEventListener('input', (e) => {
//   userSearch.search((e.target as HTMLInputElement).value);
// });

// ==================== 示例 8: 并发控制（批量请求） ====================

async function loadUsersBatch(userIds: number[]): Promise<User[]> {
  const requests = userIds.map((id) => () => userApi.get(id).then((r) => r.data));
  return batchRequest(requests, 3); // 最多 3 个并发
}

// 使用
// const users = await loadUsersBatch([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

// ==================== 示例 9: Axios 客户端配置 ====================

const axiosApi = new AxiosClient('https://api.example.com', 15000, {
  'X-App-Version': '1.0.0',
  'X-Client-Type': 'web',
});

// 添加认证拦截器
axiosApi.addRequestInterceptor(
  createAxiosAuthInterceptor(() => localStorage.getItem('authToken'))
);

// 添加日志拦截器
const logger = createAxiosLoggerInterceptor();
axiosApi.addRequestInterceptor(logger.request);
axiosApi.addResponseInterceptor(logger.response, logger.error);

// 添加错误处理拦截器
axiosApi.addResponseInterceptor(
  null,
  createAxiosErrorInterceptor({
    on401: () => {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    },
    onNetworkError: () => {
      console.error('网络连接失败');
    },
    onTimeout: () => {
      console.error('请求超时');
    },
  })
);

// 添加 Loading 拦截器
const loading = createAxiosLoadingInterceptor(
  () => console.log('Loading started...'),
  () => console.log('Loading finished.')
);
axiosApi.addRequestInterceptor(loading.request);
axiosApi.addResponseInterceptor(loading.response, loading.error);

// ==================== 示例 10: Token 自动刷新 ====================

const tokenManager = new TokenRefreshManager(
  axiosApi,
  async () => {
    const response = await axiosApi.post<{ accessToken: string }>('/auth/refresh', {
      refreshToken: localStorage.getItem('refreshToken'),
    });
    return response.data.accessToken;
  },
  (token) => {
    localStorage.setItem('authToken', token);
  },
  () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  }
);

// 添加 Token 刷新拦截器
axiosApi.addResponseInterceptor(null, tokenManager.createInterceptor());

// ==================== 示例 11: 取消请求 ====================

// 搜索框取消
let searchCancelKey = 'user-search';

function searchWithCancel(query: string): void {
  // 取消上一个请求
  api.cancelRequest(searchCancelKey, 'New search started');

  // 发送新请求
  api.get<User[]>('/users/search', {
    params: { q: query },
    dedupeKey: searchCancelKey,
  }).then(({ data }) => {
    console.log('Search results:', data);
  }).catch((error) => {
    if (!error.isCancelled) {
      console.error('Search error:', error);
    }
  });
}

// 组件卸载时取消
function cleanup(): void {
  api.cancelAll('Component unmounted');
}

// ==================== 示例 12: 监控数据 ====================

function printMetrics(): void {
  const metrics = api.getMetrics();
  console.log('=== 网络请求监控 ===');
  console.log(`总请求数: ${metrics.totalRequests}`);
  console.log(`成功: ${metrics.successRequests}`);
  console.log(`失败: ${metrics.failedRequests}`);
  console.log(`错误率: ${metrics.errorRate.toFixed(1)}%`);
  console.log(`平均耗时: ${metrics.avgDuration.toFixed(0)}ms`);
  console.log(`慢请求: ${metrics.slowRequests}`);
  console.log(`超时: ${metrics.timeoutCount}`);
  console.log(`取消: ${metrics.cancelCount}`);
  console.log(`缓存命中: ${metrics.cacheHits}`);
  console.log(`活跃请求: ${metrics.activeRequests}`);

  if (metrics.slowestRequests.length > 0) {
    console.log('\n最慢请求:');
    metrics.slowestRequests.slice(0, 5).forEach((req) => {
      console.log(`  ${req.duration.toFixed(0)}ms - ${req.url} (${req.status})`);
    });
  }
}

// ==================== 示例 13: 自定义重试条件 ====================

api.addRequestInterceptor('custom-retry', (config) => {
  // 对特定 API 使用自定义重试条件
  if (config.url.includes('/flaky-api')) {
    config.maxRetries = 5;
    config.retryStrategy = 'adaptive';
    config.shouldRetry = (error, attempt) => {
      // 只对 429 和 5xx 重试
      return error.status === 429 || (error.status && error.status >= 500);
    };
  }
  return config;
});

// ==================== 示例 14: 请求转换器 ====================

// 请求转换：将对象转为 FormData
function toFormData(data: Record<string, any>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined) {
      formData.append(key, String(value));
    }
  }
  return formData;
}

// 响应转换：提取嵌套数据
function extractData(response: any): any {
  return response?.data?.results ?? response?.data ?? response;
}

// 使用转换器
async function uploadFile(file: File): Promise<void> {
  await api.post('/upload', toFormData({ file: file.name }), {
    transformRequest: toFormData,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

// ==================== 示例 15: 健康检查 ====================

async function healthCheck(): Promise<{ healthy: boolean; latency: number }> {
  const start = performance.now();
  try {
    await api.get('/health', { timeout: 5000, maxRetries: 0 });
    return { healthy: true, latency: performance.now() - start };
  } catch {
    return { healthy: false, latency: performance.now() - start };
  }
}

// ==================== 示例 16: 请求 ID 追踪 ====================

api.addRequestInterceptor('request-id', (config) => {
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  config.headers = {
    ...config.headers,
    'X-Request-ID': requestId,
  };
  (config as any).requestId = requestId;
  return config;
});

// ==================== 示例 17: 缓存策略对比 ====================

// cache-first: 先查缓存，命中则返回，未命中则请求网络并缓存
const cachedUser = await api.get<User>('/users/1', {
  cacheStrategy: 'cache-first',
  cacheTTL: 5 * 60 * 1000,
});

// network-first: 先请求网络，失败则返回缓存
const freshUser = await api.get<User>('/users/1', {
  cacheStrategy: 'network-first',
  cacheTTL: 5 * 60 * 1000,
});

// stale-while-revalidate: 返回缓存的同时后台更新
const staleUser = await api.get<User>('/users/1', {
  cacheStrategy: 'stale-while-revalidate',
  cacheTTL: 5 * 60 * 1000,
});

// ==================== 示例 18: 完整使用流程 ====================

async function main(): Promise<void> {
  console.log('=== 网络层实战示例 ===\n');

  // 1. 健康检查
  const health = await healthCheck();
  console.log(`健康检查: ${health.healthy ? '✅' : '❌'} (${health.latency.toFixed(0)}ms)\n`);

  // 2. 获取用户列表（带缓存）
  try {
    const users = await userApi.list(1, 10);
    console.log(`用户列表: ${users.data.length} 条\n`);
  } catch (error) {
    console.error('获取用户列表失败:', error);
  }

  // 3. 获取单个用户（缓存命中）
  try {
    const start = Date.now();
    const user = await userApi.get(1);
    console.log(`获取用户: ${user.data.name} (${Date.now() - start}ms)\n`);
  } catch (error) {
    console.error('获取用户失败:', error);
  }

  // 4. 创建用户
  try {
    const newUser = await userApi.create({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'secret123',
    });
    console.log(`创建用户: ${newUser.data.name}\n`);
  } catch (error) {
    console.error('创建用户失败:', error);
  }

  // 5. 批量请求（并发控制）
  try {
    const users = await loadUsersBatch([1, 2, 3, 4, 5]);
    console.log(`批量获取: ${users.length} 个用户\n`);
  } catch (error) {
    console.error('批量获取失败:', error);
  }

  // 6. 查看监控数据
  printMetrics();

  // 7. 清理
  api.destroy();
  userSearch.destroy();
}

// 导出所有示例
export {
  api,
  axiosApi,
  userApi,
  postApi,
  SearchController,
  batchRequest,
  healthCheck,
  printMetrics,
  main,
};
