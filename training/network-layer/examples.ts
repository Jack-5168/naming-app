// ===================== 完整使用示例 =====================

import { FetchClient, AxiosClient, NetworkError } from './index';

// ============================================================
// 示例 1: FetchClient 基础用法
// ============================================================
async function example1_basic() {
  const client = new FetchClient();
  client.baseURL = 'https://jsonplaceholder.typicode.com';

  // GET 请求
  const res = await client.get('/posts/1').promise;
  console.log('GET /posts/1:', res.status, res.data);
}

// ============================================================
// 示例 2: 请求拦截器（自动注入 Token）
// ============================================================
async function example2_requestInterceptor() {
  const client = new FetchClient();
  client.baseURL = 'https://api.example.com';

  // 注册请求拦截器
  const removeInterceptor = client.useRequest((config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
        'X-Request-Id': crypto.randomUUID?.() || Math.random().toString(36),
      };
    }
    console.log(`[→] ${config.method} ${config.baseURL}${config.url}`);
    return config;
  });

  // 注册响应拦截器
  client.useResponse((response) => {
    console.log(`[←] ${response.status} ${response.duration}ms`);
    return response;
  });

  // 注册响应错误拦截器（401 自动跳转登录）
  client.useResponseError((error) => {
    if (error.status === 401) {
      localStorage.removeItem('auth_token');
      console.warn('Token 过期，跳转登录页');
      // window.location.href = '/login';
    }
    // 统一错误提示
    console.error(`[Error] ${error.message}`);
    throw error;
  });

  await client.get('/profile').promise;

  // 移除拦截器
  removeInterceptor();
}

// ============================================================
// 示例 3: 重试机制（指数退避）
// ============================================================
async function example3_retry() {
  const client = new FetchClient();
  client.baseURL = 'https://api.example.com';

  // 默认重试 3 次，间隔 1000ms，指数退避（1s → 2s → 4s）
  const res = await client
    .post('/orders', { item: 'laptop', qty: 1 }, {
      maxRetries: 3,
      retryDelay: 1000,
    })
    .promise;

  console.log('Order created:', res.data);

  // 也可以修改实例默认值
  client.maxRetries = 5;
  client.retryDelay = 500;
}

// ============================================================
// 示例 4: 取消请求
// ============================================================
async function example4_cancel() {
  const client = new FetchClient();
  client.baseURL = 'https://api.example.com';

  // 场景 1: 用户导航离开，取消进行中的请求
  const req = client.get('/large-report');
  setTimeout(() => {
    req.cancel('用户离开了页面');
  }, 3000);

  try {
    await req.promise;
  } catch (err) {
    if (err instanceof NetworkError && err.isCancelled) {
      console.log('请求已取消:', err.message);
    }
  }

  // 场景 2: 搜索输入防抖 + 取消旧请求
  let currentReq: ReturnType<typeof client.get> | null = null;

  function search(query: string) {
    // 取消上一次请求
    currentReq?.cancel('新的搜索请求已发出');

    currentReq = client.get('/search', {
      params: { q: query },
      timeout: 5000,
    });

    try {
      const res = await currentReq.promise;
      console.log('搜索结果:', res.data);
    } catch (err) {
      if (err instanceof NetworkError && err.isCancelled) {
        console.log('旧请求已取消');
      }
    }
  }

  // 模拟用户快速输入
  search('a');
  setTimeout(() => search('ab'), 100);
  setTimeout(() => search('abc'), 200);
  // 只有 'abc' 的请求会完成
}

// ============================================================
// 示例 5: 超时控制
// ============================================================
async function example5_timeout() {
  const client = new FetchClient();
  client.baseURL = 'https://api.example.com';

  try {
    const res = await client
      .get('/slow-endpoint', {
        timeout: 3000, // 3 秒超时
      })
      .promise;
    console.log('响应:', res.data);
  } catch (err) {
    if (err instanceof NetworkError && err.isTimeout) {
      console.error('请求超时，请稍后重试');
    }
  }
}

// ============================================================
// 示例 6: AxiosClient 用法（与 FetchClient API 一致）
// ============================================================
async function example6_axios() {
  const client = new AxiosClient({
    baseURL: 'https://jsonplaceholder.typicode.com',
  });

  // 请求拦截器
  client.useRequest((config) => {
    config.headers = config.headers || {};
    config.headers['X-Custom-Header'] = 'axios-demo';
    return config;
  });

  // 响应拦截器
  client.useResponse(
    (response) => {
      console.log(`Axios 响应: ${response.status}`);
      return response;
    },
    (error) => {
      console.error(`Axios 错误: ${error.message}`);
      return Promise.reject(error);
    }
  );

  // 直接操作 Axios 原生拦截器
  client.interceptors.request.use((config) => {
    console.log('Axios 原生拦截器:', config.url);
    return config;
  });

  const res = await client.get('/posts').promise;
  console.log('Axios GET 结果:', res.data.length, '条数据');
}

// ============================================================
// 示例 7: 并发请求 + 取消全部
// ============================================================
async function example7_concurrent() {
  const client = new FetchClient();
  client.baseURL = 'https://api.example.com';

  const requests = [
    client.get('/users'),
    client.get('/posts'),
    client.get('/comments'),
  ];

  // 3 秒后全部取消
  setTimeout(() => {
    requests.forEach((req) => req.cancel('全部取消'));
  }, 3000);

  try {
    const results = await Promise.all(requests.map((r) => r.promise));
    console.log('全部完成:', results.map((r) => r.status));
  } catch (err) {
    console.log('部分或全部被取消');
  }
}

// ============================================================
// 示例 8: 跳过拦截器（登录请求不需要 token）
// ============================================================
async function example8_skipInterceptors() {
  const client = new FetchClient();
  client.baseURL = 'https://api.example.com';

  // 这个请求会走拦截器（自动加 token）
  await client.get('/profile').promise;

  // 登录请求跳过拦截器（不需要 token，也不触发 401 跳转）
  await client
    .post('/auth/login', { username: 'admin', password: '123456' }, {
      skipInterceptors: true,
      timeout: 15000,
    })
    .promise;
}

// ============================================================
// 示例 9: 文件上传（FormData）
// ============================================================
async function example9_upload() {
  const client = new FetchClient();
  client.baseURL = 'https://api.example.com';

  const formData = new FormData();
  formData.append('file', new Blob(['hello']), 'test.txt');
  formData.append('description', '测试文件');

  const res = await client
    .post('/upload', formData, {
      headers: {
        // FormData 会自动设置 Content-Type: multipart/form-data + boundary
        // 这里不设置 'Content-Type': 'application/json'
      },
      maxRetries: 2,
    })
    .promise;

  console.log('上传成功:', res.data);
}

// ============================================================
// 示例 10: 请求元数据透传
// ============================================================
async function example10_meta() {
  const client = new FetchClient();
  client.baseURL = 'https://api.example.com';

  client.useRequest((config) => {
    // 通过 meta 传递业务上下文
    if (config.meta?.silent) {
      // 静默模式，不显示 loading
      console.log('静默请求:', config.url);
    }
    if (config.meta?.priority === 'high') {
      // 高优先级请求，重试间隔更短
      config.retryDelay = 200;
    }
    return config;
  });

  await client
    .get('/config', {
      meta: { silent: true, priority: 'high' },
    })
    .promise;
}

// ============================================================
// 运行所有示例（取消注释即可运行）
// ============================================================
// example1_basic();
// example2_requestInterceptor();
// example3_retry();
// example4_cancel();
// example5_timeout();
// example6_axios();
// example7_concurrent();
// example8_skipInterceptors();
// example9_upload();
// example10_meta();

export {
  example1_basic,
  example2_requestInterceptor,
  example3_retry,
  example4_cancel,
  example5_timeout,
  example6_axios,
  example7_concurrent,
  example8_skipInterceptors,
  example9_upload,
  example10_meta,
};
