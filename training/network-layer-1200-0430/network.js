/**
 * 网络层 - 基于 Axios 的完整实现
 *
 * 功能：
 * - 请求/响应拦截器
 * - Token 自动注入与刷新
 * - 重复请求取消
 * - 统一错误处理
 * - 请求追踪
 */

import axios from 'axios';

// ============ 配置 ============
const config = {
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
};

// ============ 实例创建 ============
const http = axios.create(config);

// ============ Token 管理 ============
const tokenStorage = {
  get: () => localStorage.getItem('access_token'),
  set: (token) => localStorage.setItem('access_token', token),
  clear: () => localStorage.removeItem('access_token'),
};

// ============ 请求拦截器 ============
http.interceptors.request.use(
  (config) => {
    // 1. 附加 Token
    const token = tokenStorage.get();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 2. 附加请求 ID（用于追踪）
    config.headers['X-Request-ID'] = generateRequestId();

    // 3. 记录请求时间（用于计算耗时）
    config.startTime = Date.now();

    // 4. 取消重复请求
    cancelDuplicateRequest(config);

    return config;
  },
  (error) => {
    console.error('[Request Error]', error);
    return Promise.reject(error);
  },
);

// ============ 响应拦截器 ============
http.interceptors.response.use(
  (response) => {
    // 记录响应日志
    const duration = Date.now() - (response.config.startTime || Date.now());
    console.log(
      `[Response] ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`,
      { duration: `${duration}ms` },
    );

    // 清除重复请求记录
    const key = getRequestKey(response.config);
    pendingRequests.delete(key);

    // 统一解包（后端通常包一层 { code, data, message }）
    const { data } = response;
    if (data && typeof data.code === 'number') {
      if (data.code === 0) {
        return data.data;
      }
      // 业务错误
      const error = new Error(data.message || 'Business error');
      error.name = 'BusinessError';
      error.code = data.code;
      error.data = data;
      return Promise.reject(error);
    }
    return data;
  },
  async (error) => {
    const { config, response } = error;

    // 清除重复请求记录
    if (config) {
      const key = getRequestKey(config);
      pendingRequests.delete(key);
    }

    // 被取消的请求直接抛出
    if (axios.isCancel(error)) {
      console.log(`[Request Cancelled] ${config?.url}`);
      return Promise.reject(error);
    }

    // 网络错误
    if (!response) {
      handleNetworkError(error);
      return Promise.reject(error);
    }

    const { status } = response;

    switch (status) {
      case 401:
        return handleUnauthorized(config);
      case 403:
        showToast('没有权限访问该资源');
        break;
      case 404:
        console.error('[404] Not found:', response.config.url);
        break;
      case 429:
        const retryAfter = response.headers['retry-after'] || 60;
        showToast(`请求过于频繁，请 ${retryAfter} 秒后重试`);
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        showToast('服务器错误，请稍后重试');
        break;
      default:
        console.error(`[${status}] Error:`, response.data);
    }

    return Promise.reject(error);
  },
);

// ============ 401 无授权处理（Token 刷新） ============
let isRefreshing = false;
let refreshSubscribers = [];

function handleUnauthorized(config) {
  if (isRefreshing) {
    // 排队等待 token 刷新
    return new Promise((resolve) => {
      refreshSubscribers.push((token) => {
        config.headers.Authorization = `Bearer ${token}`;
        resolve(http(config));
      });
    });
  }

  isRefreshing = true;

  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    redirectToLogin();
    return Promise.reject(new Error('No refresh token'));
  }

  return axios
    .post('/auth/refresh', { refreshToken })
    .then((res) => {
      const { accessToken, refreshToken: newRefreshToken } = res.data.data;
      tokenStorage.set(accessToken);
      if (newRefreshToken) {
        localStorage.setItem('refresh_token', newRefreshToken);
      }

      // 通知所有排队的请求
      refreshSubscribers.forEach((cb) => cb(accessToken));
      refreshSubscribers = [];

      // 重试原请求
      config.headers.Authorization = `Bearer ${accessToken}`;
      return http(config);
    })
    .catch(() => {
      refreshSubscribers.forEach((cb) => cb(null));
      refreshSubscribers = [];
      redirectToLogin();
      return Promise.reject(new Error('Token refresh failed'));
    })
    .finally(() => {
      isRefreshing = false;
    });
}

function redirectToLogin() {
  tokenStorage.clear();
  localStorage.removeItem('refresh_token');
  window.location.href = `/login?redirect=${encodeURIComponent(window.location.href)}`;
}

// ============ 错误处理 ============
function handleNetworkError(error) {
  if (error.code === 'ECONNABORTED') {
    showToast('请求超时，请检查网络');
  } else {
    showToast('网络连接失败');
  }
}

// ============ 辅助函数 ============
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function showToast(message) {
  if (window.$message) {
    window.$message.error(message);
  } else {
    console.error(message);
  }
}

// ============ 重复请求取消 ============
const pendingRequests = new Map();

function getRequestKey(config) {
  return `${config.method}:${config.url}:${JSON.stringify(config.params || {})}:${JSON.stringify(config.data || {})}`;
}

function cancelDuplicateRequest(config) {
  const key = getRequestKey(config);

  if (pendingRequests.has(key)) {
    const cancelToken = pendingRequests.get(key);
    cancelToken.cancel(`Duplicate request cancelled: ${config.url}`);
    pendingRequests.delete(key);
  }

  const source = axios.CancelToken.source();
  config.cancelToken = source.token;
  pendingRequests.set(key, source);
}

// ============ 导出 ============
export default http;
export { tokenStorage, http };
