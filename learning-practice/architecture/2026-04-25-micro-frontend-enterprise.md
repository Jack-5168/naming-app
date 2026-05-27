# 架构设计进阶：企业级微前端应用实战

> 专项训练 18:00 | 2026-04-25
> 前置：4/22 基础版（MVC/MVVM/微前端理论）+ 4/24 复习版
> 本次：从零设计一个真实企业应用架构，整合所有前端知识

---

## 一、项目背景

### 1.1 场景设定

**产品名称：** CloudBoard — 企业级数据分析平台

**业务需求：**

- 多团队并行开发（数据团队、图表团队、用户团队、运维团队）
- 独立部署、独立版本控制
- 主应用 + 4 个子应用
- 需要跨应用通信、共享状态、统一认证
- 支持动态加载、按需加载
- 性能要求：首屏 < 2s，LCP < 2.5s

### 1.2 架构选型决策

| 方案                  | 优势                               | 劣势                             | 适用场景     | 选型        |
| --------------------- | ---------------------------------- | -------------------------------- | ------------ | ----------- |
| **iFrame**            | 完全隔离、简单                     | 通信困难、性能差、URL 状态不同步 | 老旧系统嵌入 | ❌          |
| **Web Components**    | 原生、无框架依赖                   | 样式隔离有限、生态不成熟         | 组件库       | ⚠️ 辅助     |
| **Single-SPA**        | 成熟、生态好、路由驱动             | 配置复杂、需约定生命周期         | 多框架混合   | ✅ 主选     |
| **qiankun**           | 基于 Single-SPA、JS 沙箱、样式隔离 | 仅支持 JS 沙箱（proxy）          | 国内团队首选 | ✅ 最终选择 |
| **Module Federation** | Webpack 5 原生、真正共享依赖       | 仅 Webpack、版本绑定             | 同技术栈团队 | ⚠️ 备选     |

**最终架构：qiankun（主应用 Vue 3 + 子应用 Vue 3/React 混合）**

---

## 二、整体架构设计

### 2.1 架构分层

```
┌─────────────────────────────────────────────────────────────┐
│                     CloudBoard Platform                      │
├──────────────┬──────────┬──────────┬──────────┬─────────────┤
│  Main App    │ Dashboard│  Charts  │  Users   │   Ops       │
│  (Vue 3)     │ (Vue 3)  │ (React)  │ (Vue 3)  │  (Vue 3)    │
│              │          │          │          │             │
│  Layout      │ 数据概览  │ 图表库   │ 用户管理  │ 运维监控    │
│  导航        │ 实时数据  │ ECharts  │ 权限管理  │ 日志查询    │
│  认证        │ 预警     │ 自定义   │ 角色管理  │ 告警配置    │
│  路由        │          │ 图表     │ 审计日志  │ 系统配置    │
├──────────────┴──────────┴──────────┴──────────┴─────────────┤
│                    qiankun Micro-Frontend                    │
├─────────────────────────────────────────────────────────────┤
│              Shared Layer (共享基础设施层)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ State Mgmt│ │ Request  │ │ Auth     │ │ UI Component  │  │
│  │ (Pinia)  │ │ (Axios)  │ │ (JWT)    │ │ Library       │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
├─────────────────────────────────────────────────────────────┤
│              Infrastructure Layer (基础设施层)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ Nginx    │ │ CI/CD    │ │ Monitor  │ │ CDN           │  │
│  │ Gateway  │ │ Pipeline │ │ (Sentry) │ │ (Static)      │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 目录结构

```
cloudboard/
├── main-app/                    # 主应用 (Vue 3 + TypeScript)
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── main.ts              # 入口：注册子应用
│   │   ├── App.vue              # 根组件：布局容器
│   │   ├── router/
│   │   │   └── index.ts         # 主路由（仅负责导航）
│   │   ├── store/
│   │   │   └── index.ts         # Pinia 全局状态
│   │   ├── components/
│   │   │   ├── AppLayout.vue    # 整体布局（侧边栏+顶栏）
│   │   │   ├── AppHeader.vue    # 顶栏（用户信息、通知）
│   │   │   ├── AppSidebar.vue   # 侧边栏（导航菜单）
│   │   │   └── AppBreadcrumb.vue
│   │   ├── services/
│   │   │   ├── request.ts       # Axios 封装（拦截器/重试）
│   │   │   ├── auth.ts          # 认证服务
│   │   │   └── api.ts           # API 定义
│   │   ├── utils/
│   │   │   ├── micro-app.ts     # qiankun 工具函数
│   │   │   └── permissions.ts   # 权限工具
│   │   └── styles/
│   │       └── index.scss       # 全局样式
│   ├── vite.config.ts
│   └── package.json
│
├── sub-apps/
│   ├── dashboard/               # 子应用1：数据概览 (Vue 3)
│   │   ├── src/
│   │   │   ├── main.ts          # 入口：生命周期钩子
│   │   │   ├── App.vue
│   │   │   ├── router/
│   │   │   ├── store/
│   │   │   ├── views/
│   │   │   │   ├── Overview.vue     # 数据总览
│   │   │   │   ├── Realtime.vue     # 实时数据
│   │   │   │   └── Alerts.vue       # 预警中心
│   │   │   ├── components/
│   │   │   │   ├── DataCard.vue
│   │   │   │   ├── MetricChart.vue
│   │   │   │   └── AlertList.vue
│   │   │   └── services/
│   │   └── vite.config.ts
│   │
│   ├── charts/                  # 子应用2：图表中心 (React 18)
│   │   ├── src/
│   │   │   ├── main.tsx         # 入口：React 生命周期
│   │   │   ├── App.tsx
│   │   │   ├── router/
│   │   │   ├── store/           # Zustand
│   │   │   ├── views/
│   │   │   │   ├── ChartBuilder.vue
│   │   │   │   ├── ChartLibrary.tsx
│   │   │   │   └── Dashboard.tsx
│   │   │   ├── components/
│   │   │   │   ├── EChartsWrapper.tsx
│   │   │   │   ├── ChartConfig.tsx
│   │   │   │   └── ChartExport.tsx
│   │   │   └── services/
│   │   └── vite.config.ts
│   │
│   ├── users/                   # 子应用3：用户管理 (Vue 3)
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── views/
│   │   │   │   ├── UserList.vue
│   │   │   │   ├── UserDetail.vue
│   │   │   │   ├── RoleManage.vue
│   │   │   │   └── AuditLog.vue
│   │   │   ├── components/
│   │   │   │   ├── UserTable.vue
│   │   │   │   ├── RoleTree.vue
│   │   │   │   └── PermissionSelector.vue
│   │   │   └── services/
│   │   └── vite.config.ts
│   │
│   └── ops/                     # 子应用4：运维监控 (Vue 3)
│       ├── src/
│       │   ├── main.ts
│       │   ├── views/
│       │   │   ├── SystemHealth.vue
│       │   │   ├── LogQuery.vue
│       │   │   ├── AlertConfig.vue
│       │   │   └── SystemConfig.vue
│       │   ├── components/
│       │   │   ├── HealthPanel.vue
│       │   │   ├── LogViewer.vue
│       │   │   └── ConfigForm.vue
│       │   └── services/
│       └── vite.config.ts
│
├── shared/                      # 共享包 (npm workspace)
│   ├── ui-components/           # 共享 UI 组件库
│   │   ├── src/
│   │   │   ├── Button.vue
│   │   │   ├── Table.vue
│   │   │   ├── Modal.vue
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── request/                 # 共享请求库
│   │   ├── src/
│   │   │   ├── axios.ts
│   │   │   ├── interceptors.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── auth/                    # 共享认证模块
│   │   ├── src/
│   │   │   ├── token.ts
│   │   │   ├── permissions.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── types/                   # 共享类型定义
│       ├── src/
│       │   ├── user.ts
│       │   ├── chart.ts
│       │   └── index.ts
│       └── package.json
│
├── deploy/
│   ├── nginx.conf               # Nginx 配置
│   └── docker-compose.yml
│
└── package.json                 # Workspace root
```

---

## 三、核心代码实现

### 3.1 主应用入口 — 注册子应用

```typescript
// main-app/src/main.ts
import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import { registerMicroApps, start, initGlobalState } from "qiankun";
import App from "./App.vue";
import routes from "./router";

const app = createApp(App);
app.use(createPinia());

const router = createRouter({
  history: createWebHistory(),
  routes,
});
app.use(router);

// ─── 全局状态通信 ───
const globalState = initGlobalState({
  user: null,
  token: "",
  theme: "light",
  locale: "zh-CN",
});

// 监听来自子应用的状态变化
globalState.onGlobalStateChange((state, prev) => {
  console.log("[Main] 全局状态变化:", state, "←", prev);
});

// ─── 子应用注册 ───
const apps = [
  {
    name: "dashboard",
    entry: process.env.VITE_DASHBOARD_ENTRY || "//localhost:3001",
    container: "#subapp-viewport",
    activeRule: "/dashboard",
  },
  {
    name: "charts",
    entry: process.env.VITE_CHARTS_ENTRY || "//localhost:3002",
    container: "#subapp-viewport",
    activeRule: "/charts",
  },
  {
    name: "users",
    entry: process.env.VITE_USERS_ENTRY || "//localhost:3003",
    container: "#subapp-viewport",
    activeRule: "/users",
  },
  {
    name: "ops",
    entry: process.env.VITE_OPS_ENTRY || "//localhost:3004",
    container: "#subapp-viewport",
    activeRule: "/ops",
  },
];

// 注册子应用
registerMicroApps(apps, {
  beforeLoad: [
    (app) => {
      console.log("[Main] beforeLoad:", app.name);
      return Promise.resolve();
    },
  ],
  beforeMount: [
    (app) => {
      console.log("[Main] beforeMount:", app.name);
      return Promise.resolve();
    },
  ],
  afterMount: [
    (app) => {
      console.log("[Main] afterMount:", app.name);
      return Promise.resolve();
    },
  ],
});

// 启动 qiankun
start({
  sandbox: {
    // 严格模式：样式隔离 + JS 沙箱
    strictStyleIsolation: true,
    experimentalStyleIsolation: true,
  },
  singular: false, // 允许多个子应用同时激活
});

// 向子应用传递全局状态和通信方法
globalState.setActions({
  onGlobalStateChange: globalState.onGlobalStateChange,
  setGlobalState: globalState.setGlobalState,
});

app.mount("#app");
```

### 3.2 子应用入口 — Vue 3 版本

```typescript
// sub-apps/dashboard/src/main.ts
import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import routes from "./router";

let router: ReturnType<typeof createRouter> | null = null;
let app: ReturnType<typeof createApp> | null = null;

// ─── 独立运行模式 ───
function render(props = {}) {
  const { container } = props as { container?: string };
  app = createApp(App);
  app.use(createPinia());

  router = createRouter({
    history: createWebHistory(
      window.__POWERED_BY_QIANKUN__ ? "/dashboard" : "/",
    ),
    routes,
  });
  app.use(router);

  const mountNode = container
    ? (container.querySelector("#subapp-viewport") as HTMLElement)
    : document.getElementById("subapp-viewport")!;

  app.mount(mountNode);
}

// ─── qiankun 生命周期 ───
if (!(window as any).__POWERED_BY_QIANKUN__) {
  // 独立运行
  render();
}

export async function bootstrap(props: any) {
  console.log("[Dashboard] bootstrap", props);
}

export async function mount(props: any) {
  console.log("[Dashboard] mount", props);

  // 从主应用接收全局状态
  const { onGlobalStateChange, setGlobalState } = props;
  if (onGlobalStateChange) {
    onGlobalStateChange((state: any) => {
      console.log("[Dashboard] 收到主应用状态:", state);
    }, true);
  }

  // 向主应用发送数据
  if (setGlobalState) {
    setGlobalState({
      currentSubApp: "dashboard",
      dashboardReady: true,
    });
  }

  render(props);
}

export async function unmount(props: any) {
  console.log("[Dashboard] unmount", props);
  app?.unmount();
  app = null;
  router = null;
}
```

### 3.3 子应用入口 — React 版本

```typescript
// sub-apps/charts/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

let container: HTMLElement | null = null

function render(props: any = {}) {
  const { container: propContainer } = props
  const rootElement = propContainer
    ? propContainer.querySelector('#subapp-viewport')
    : document.getElementById('subapp-viewport')

  container = rootElement as HTMLElement

  const basename = window.__POWERED_BY_QIANKUN__
    ? '/charts'
    : '/'

  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <BrowserRouter basename={basename}>
        <App {...props} />
      </BrowserRouter>
    </React.StrictMode>
  )
}

if (!window.__POWERED_BY_QIANKUN__) {
  render()
}

export async function bootstrap(props: any) {
  console.log('[Charts] bootstrap')
}

export async function mount(props: any) {
  console.log('[Charts] mount')
  render(props)
}

export async function unmount(props: any) {
  console.log('[Charts] unmount')
  ReactDOM.createRoot(container!).unmount()
}
```

### 3.4 主应用布局组件

```vue
<!-- main-app/src/App.vue -->
<template>
  <div class="app-layout">
    <AppHeader
      :user="userInfo"
      :notifications="notifications"
      @logout="handleLogout"
    />
    <div class="app-body">
      <AppSidebar
        :menus="menus"
        :collapsed="sidebarCollapsed"
        @toggle="sidebarCollapsed = !sidebarCollapsed"
        @select="handleMenuSelect"
      />
      <main class="app-main">
        <AppBreadcrumb :routes="breadcrumbRoutes" />
        <div id="subapp-viewport" class="subapp-container">
          <!-- 子应用渲染区域 -->
          <div v-if="!currentSubApp" class="subapp-placeholder">
            <p>请选择左侧菜单</p>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { getGlobalState } from "qiankun";
import AppHeader from "./components/AppHeader.vue";
import AppSidebar from "./components/AppSidebar.vue";
import AppBreadcrumb from "./components/AppBreadcrumb.vue";

const route = useRoute();
const sidebarCollapsed = ref(false);

// 从全局状态获取用户信息
const userInfo = computed(() => {
  const state = getGlobalState();
  return state.user;
});

const notifications = ref([]);

const menus = [
  {
    key: "dashboard",
    label: "数据概览",
    icon: "📊",
    path: "/dashboard",
    children: [
      { key: "overview", label: "总览", path: "/dashboard/overview" },
      { key: "realtime", label: "实时数据", path: "/dashboard/realtime" },
      { key: "alerts", label: "预警中心", path: "/dashboard/alerts" },
    ],
  },
  {
    key: "charts",
    label: "图表中心",
    icon: "📈",
    path: "/charts",
    children: [
      { key: "builder", label: "图表构建器", path: "/charts/builder" },
      { key: "library", label: "图表库", path: "/charts/library" },
    ],
  },
  {
    key: "users",
    label: "用户管理",
    icon: "👥",
    path: "/users",
    children: [
      { key: "list", label: "用户列表", path: "/users/list" },
      { key: "roles", label: "角色管理", path: "/users/roles" },
      { key: "audit", label: "审计日志", path: "/users/audit" },
    ],
  },
  {
    key: "ops",
    label: "运维监控",
    icon: "🔧",
    path: "/ops",
    children: [
      { key: "health", label: "系统健康", path: "/ops/health" },
      { key: "logs", label: "日志查询", path: "/ops/logs" },
      { key: "config", label: "系统配置", path: "/ops/config" },
    ],
  },
];

const currentSubApp = computed(() => {
  const path = route.path;
  if (path.startsWith("/dashboard")) return "dashboard";
  if (path.startsWith("/charts")) return "charts";
  if (path.startsWith("/users")) return "users";
  if (path.startsWith("/ops")) return "ops";
  return null;
});

const breadcrumbRoutes = computed(() => {
  return route.matched
    .filter((r) => r.meta?.title)
    .map((r) => ({
      path: r.path,
      title: r.meta.title as string,
    }));
});

function handleMenuSelect(key: string, path: string) {
  // qiankun 通过路由变化自动切换子应用
  // 主应用路由只负责导航，不渲染内容
}

function handleLogout() {
  // 清除 token，跳转登录页
}
</script>

<style scoped>
.app-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: auto;
  padding: 16px;
}

.subapp-container {
  flex: 1;
  min-height: 0;
}

.subapp-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  font-size: 16px;
}
</style>
```

### 3.5 共享请求库

```typescript
// shared/request/src/axios.ts
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

interface CloudBoardRequestConfig extends AxiosRequestConfig {
  retry?: number;
  retryDelay?: number;
  cache?: boolean;
  cacheTTL?: number;
}

interface CloudBoardResponse<T = any> {
  code: number;
  data: T;
  message: string;
  timestamp: number;
}

// ─── 请求缓存 ───
const cache = new Map<string, { data: any; expires: number }>();

function getCacheKey(config: AxiosRequestConfig): string {
  return `${config.method}:${config.url}:${JSON.stringify(config.params)}`;
}

// ─── 创建实例 ───
function createRequest(baseURL: string): AxiosInstance {
  const instance = axios.create({
    baseURL,
    timeout: 15000,
    headers: { "Content-Type": "application/json" },
  });

  // ─── 请求拦截器 ───
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig & CloudBoardRequestConfig) => {
      // 1. 缓存检查
      if (config.cache && config.method === "get") {
        const key = getCacheKey(config);
        const cached = cache.get(key);
        if (cached && cached.expires > Date.now()) {
          // 返回缓存数据（通过自定义适配器）
          config.adapter = () =>
            Promise.resolve({
              data: cached.data,
              status: 200,
              statusText: "OK",
              headers: {},
              config,
            } as AxiosResponse);
          return config;
        }
      }

      // 2. 注入 Token
      const token = localStorage.getItem("cb_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // 3. 请求日志
      console.log(
        `[Request] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
        config.params || config.data,
      );

      return config;
    },
    (error) => Promise.reject(error),
  );

  // ─── 响应拦截器 ───
  instance.interceptors.response.use(
    (response: AxiosResponse<CloudBoardResponse>) => {
      const { config } = response;

      // 1. 写入缓存
      if (
        (config as CloudBoardRequestConfig).cache &&
        config.method === "get"
      ) {
        const key = getCacheKey(config);
        const ttl = (config as CloudBoardRequestConfig).cacheTTL ?? 60000;
        cache.set(key, {
          data: response.data,
          expires: Date.now() + ttl,
        });
      }

      // 2. 统一响应处理
      const res = response.data;
      if (res.code !== 0) {
        // 业务错误
        console.error(`[API Error] ${res.message}`);
        return Promise.reject(new Error(res.message));
      }

      console.log(
        `[Response] ${config.method?.toUpperCase()} ${config.url} ✅ ${response.status}`,
      );
      return res;
    },
    async (error) => {
      const config = error.config as CloudBoardRequestConfig &
        InternalAxiosRequestConfig;

      // 3. 重试机制
      const retryCount = config.retry ?? 0;
      if (retryCount > 0 && error.response?.status >= 500) {
        config.retry = retryCount - 1;
        const delay = config.retryDelay ?? 1000;
        console.log(
          `[Retry] 重试 ${config.url} (${retryCount}→${retryCount - 1})`,
        );
        await new Promise((r) => setTimeout(r, delay));
        return instance(config);
      }

      // 4. 401 处理
      if (error.response?.status === 401) {
        localStorage.removeItem("cb_token");
        // 通知主应用跳转登录
        if ((window as any).__POWERED_BY_QIANKUN__) {
          const { setGlobalState } = (window as any).__qiankunGlobalState__;
          setGlobalState?.({ user: null, token: "" });
        }
        window.location.href = "/login";
      }

      // 5. 错误日志
      console.error(
        `[Error] ${config?.method?.toUpperCase()} ${config?.url} ❌`,
        error.message,
      );
      return Promise.reject(error);
    },
  );

  return instance;
}

export { createRequest, createAxiosInstance as createRequest };
export type { CloudBoardRequestConfig, CloudBoardResponse };
```

### 3.6 共享认证模块

```typescript
// shared/auth/src/index.ts
interface UserInfo {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  roles: string[];
  permissions: string[];
  department: string;
  lastLoginAt: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

class AuthManager {
  private tokenKey = "cb_token_pair";
  private userKey = "cb_user_info";

  // ─── Token 管理 ───
  getToken(): TokenPair | null {
    const raw = localStorage.getItem(this.tokenKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  setToken(pair: TokenPair): void {
    localStorage.setItem(this.tokenKey, JSON.stringify(pair));
  }

  clearToken(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  isTokenExpired(): boolean {
    const pair = this.getToken();
    if (!pair) return true;
    return Date.now() >= pair.expiresIn * 1000;
  }

  // ─── 自动刷新 ───
  async refreshToken(): Promise<boolean> {
    const pair = this.getToken();
    if (!pair) return false;

    try {
      const resp = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: pair.refreshToken }),
      });

      if (!resp.ok) {
        this.clearToken();
        return false;
      }

      const newPair: TokenPair = await resp.json();
      this.setToken(newPair);
      console.log("[Auth] Token refreshed");
      return true;
    } catch {
      this.clearToken();
      return false;
    }
  }

  // ─── 用户信息 ───
  getUser(): UserInfo | null {
    const raw = localStorage.getItem(this.userKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  setUser(user: UserInfo): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  // ─── 权限检查 ───
  hasPermission(permission: string): boolean {
    const user = this.getUser();
    if (!user) return false;
    // 超级管理员拥有所有权限
    if (user.roles.includes("admin")) return true;
    return user.permissions.includes(permission);
  }

  hasRole(role: string): boolean {
    const user = this.getUser();
    if (!user) return false;
    return user.roles.includes(role);
  }

  // ─── 登录/登出 ───
  async login(username: string, password: string): Promise<UserInfo> {
    const resp = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!resp.ok) {
      throw new Error("登录失败");
    }

    const { token, user } = await resp.json();
    this.setToken(token);
    this.setUser(user);
    return user;
  }

  async logout(): Promise<void> {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      this.clearToken();
    }
  }
}

// 单例
export const authManager = new AuthManager();
export type { UserInfo, TokenPair };
```

### 3.7 Vite 微前端配置

```typescript
// sub-apps/dashboard/vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],

  define: {
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
  },

  server: {
    port: 3001,
    // 允许跨域（qiankun 需要）
    cors: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },

  build: {
    outDir: "dist",
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      name: "DashboardApp",
      formats: ["umd"],
    },
    rollupOptions: {
      output: {
        // 确保 entry 文件名固定
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
        // UMD 格式导出
        globals: {
          vue: "Vue",
        },
      },
    },
  },

  // 外部化 Vue（由主应用提供）
  // 注意：qiankun 的 Vue 子应用不需要 externalize
  // 这里保留配置供 Module Federation 方案参考
});
```

### 3.8 Nginx 部署配置

```nginx
# deploy/nginx.conf
upstream main_app {
  server main-app:8080;
}

upstream dashboard {
  server sub-dashboard:3001;
}

upstream charts {
  server sub-charts:3002;
}

upstream users {
  server sub-users:3003;
}

upstream ops {
  server sub-ops:3004;
}

server {
  listen 80;
  server_name cloudboard.example.com;

  # Gzip 压缩
  gzip on;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
  gzip_min_length 1024;
  gzip_comp_level 6;

  # 主应用
  location / {
    proxy_pass http://main_app;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  # 子应用：数据概览
  location /dashboard/ {
    proxy_pass http://dashboard/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;

    # WebSocket 支持（实时数据）
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }

  # 子应用：图表中心
  location /charts/ {
    proxy_pass http://charts/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  # 子应用：用户管理
  location /users/ {
    proxy_pass http://users/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  # 子应用：运维监控
  location /ops/ {
    proxy_pass http://ops/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  # API 代理
  location /api/ {
    proxy_pass http://backend-api:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    # 超时设置
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
  }

  # 静态资源缓存
  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
  }

  # 安全头
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

---

## 四、跨应用通信方案

### 4.1 方案对比

| 方案                    | 实现方式             | 适用场景       | 优缺点                         |
| ----------------------- | -------------------- | -------------- | ------------------------------ |
| **qiankun globalState** | initGlobalState      | 简单状态共享   | ✅ 简单、内置；❌ 仅 key-value |
| **CustomEvent**         | window.dispatchEvent | 跨应用事件通信 | ✅ 灵活、原生；❌ 无类型安全   |
| **MessageChannel**      | postMessage          | 跨 iframe 通信 | ✅ 安全；❌ 仅 iframe 方案     |
| **共享 EventBus**       | mitt/tiny-emitter    | 应用内事件     | ✅ 轻量；❌ 需手动管理         |
| **URL 参数**            | router query         | 页面间传参     | ✅ 可分享；❌ 仅字符串         |

### 4.2 实现：globalState + CustomEvent 混合方案

```typescript
// main-app/src/utils/micro-app.ts
import mitt from "mitt";

// ─── 类型定义 ───
interface MicroAppEvents {
  "user:login": { userId: string; username: string };
  "user:logout": {};
  "theme:change": { theme: "light" | "dark" };
  "data:refresh": { source: string };
  "chart:export": { chartId: string; format: "png" | "svg" | "pdf" };
  "alert:trigger": { level: "info" | "warn" | "error"; message: string };
}

// ─── EventBus（类型安全） ───
export const eventBus = mitt<MicroAppEvents>();

// ─── globalState 封装 ───
export class MicroAppState {
  private setGlobalState: any;
  private onGlobalStateChange: any;

  constructor(setGlobalState: any, onGlobalStateChange: any) {
    this.setGlobalState = setGlobalState;
    this.onGlobalStateChange = onGlobalStateChange;
  }

  // 设置状态
  set<K extends keyof MicroAppStateData>(key: K, value: MicroAppStateData[K]) {
    this.setGlobalState({ [key]: value });
  }

  // 获取状态
  get<K extends keyof MicroAppStateData>(key: K): MicroAppStateData[K] {
    // qiankun 的 getGlobalState 方法
    return (window as any).__qiankunGlobalState__?.[key];
  }

  // 监听变化
  onChange(
    callback: (state: MicroAppStateData, prev: MicroAppStateData) => void,
  ) {
    this.onGlobalStateChange(callback);
  }
}

interface MicroAppStateData {
  user: any;
  token: string;
  theme: string;
  locale: string;
  currentSubApp: string;
}

// ─── CustomEvent 封装 ───
export function emitEvent<T extends keyof MicroAppEvents>(
  event: T,
  detail: MicroAppEvents[T],
) {
  window.dispatchEvent(new CustomEvent(`micro-app:${event}`, { detail }));
}

export function onEvent<T extends keyof MicroAppEvents>(
  event: T,
  handler: (detail: MicroAppEvents[T]) => void,
) {
  window.addEventListener(`micro-app:${event}`, ((e: Event) => {
    handler((e as CustomEvent).detail);
  }) as EventListener);
}

export function offEvent<T extends keyof MicroAppEvents>(
  event: T,
  handler: (detail: MicroAppEvents[T]) => void,
) {
  window.removeEventListener(`micro-app:${event}`, handler as EventListener);
}
```

### 4.3 使用示例

```typescript
// dashboard 子应用：发送数据刷新事件
import { emitEvent } from "../utils/micro-app";

// 当仪表盘数据更新时，通知其他子应用
function onDataUpdate() {
  emitEvent("data:refresh", { source: "dashboard" });
}

// charts 子应用：监听数据刷新
import { onEvent } from "../utils/micro-app";

onEvent("data:refresh", ({ source }) => {
  console.log(`图表子应用收到来自 ${source} 的刷新通知`);
  refreshCharts();
});

// 主应用：监听子应用事件
onEvent("alert:trigger", ({ level, message }) => {
  showNotification({ level, message });
});
```

---

## 五、权限系统设计

### 5.1 RBAC 模型

```
用户 (User)
  ├── 角色 (Role) — 多对多
  │     ├── admin（超级管理员）
  │     ├── analyst（数据分析师）
  │     ├── operator（运维工程师）
  │     └── viewer（只读用户）
  │
  └── 权限 (Permission) — 通过角色间接关联
        ├── dashboard:read
        ├── dashboard:write
        ├── charts:read
        ├── charts:write
        ├── charts:export
        ├── users:read
        ├── users:write
        ├── users:delete
        ├── ops:read
        ├── ops:write
        └── ops:config
```

### 5.2 权限指令（Vue）

```typescript
// main-app/src/directives/permission.ts
import type { Directive, DirectiveBinding } from "vue";
import { authManager } from "@cloudboard/auth";

export const vPermission: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding<string | string[]>) {
    const permissions = Array.isArray(binding.value)
      ? binding.value
      : [binding.value];

    const hasPermission = permissions.some((p) => authManager.hasPermission(p));

    if (!hasPermission) {
      el.parentNode?.removeChild(el);
    }
  },
};

// 使用方式：
// <button v-permission="'users:write'">编辑用户</button>
// <button v-permission="['users:write', 'users:delete']">管理用户</button>
```

### 5.3 路由守卫

```typescript
// main-app/src/router/guards.ts
import { NavigationGuardNext, RouteLocationNormalized } from "vue-router";
import { authManager } from "@cloudboard/auth";

export function authGuard(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext,
) {
  const token = authManager.getToken();

  if (!token || authManager.isTokenExpired()) {
    // 未登录 → 跳转登录页
    return next("/login");
  }

  // 检查页面权限
  const requiredPermission = to.meta.permission as string | undefined;
  if (requiredPermission && !authManager.hasPermission(requiredPermission)) {
    // 无权限 → 403
    return next("/403");
  }

  return next();
}
```

---

## 六、性能优化策略

### 6.1 加载优化

```typescript
// 预加载策略
const preloadStrategy = {
  // 1. 关键子应用预加载
  prefetch: ["dashboard"], // 首屏可见的子应用

  // 2. 懒加载
  lazy: ["ops"], // 运维监控不常用，按需加载

  // 3. 预取（空闲时加载）
  preFetched: ["charts", "users"],

  // 4. 子应用内部路由懒加载
  subAppRoutes: {
    dashboard: [
      {
        path: "/dashboard/overview",
        component: () => import("./views/Overview.vue"),
      },
      {
        path: "/dashboard/realtime",
        component: () => import("./views/Realtime.vue"),
      },
    ],
  },
};
```

### 6.2 共享依赖（减少重复打包）

```typescript
// 主应用 webpack externals（如果使用 webpack）
// 将 Vue、Pinia、Vue Router 等共享依赖从子应用中排除
externals: {
  vue: 'Vue',
  pinia: 'Pinia',
  'vue-router': 'VueRouter',
  axios: 'axios',
}

// 或者使用 Module Federation（Webpack 5）
// 主应用暴露共享模块
new ModuleFederationPlugin({
  name: 'mainApp',
  shared: {
    vue: { singleton: true, requiredVersion: '^3.3.0' },
    pinia: { singleton: true, requiredVersion: '^2.1.0' },
    'vue-router': { singleton: true, requiredVersion: '^4.2.0' },
    axios: { singleton: true, requiredVersion: '^1.6.0' },
  },
})
```

### 6.3 性能预算

| 指标       | 目标值  | 测量方式        | 优化手段                    |
| ---------- | ------- | --------------- | --------------------------- |
| 首屏加载   | < 2s    | Lighthouse      | 预加载 dashboard、Gzip、CDN |
| LCP        | < 2.5s  | Web Vitals      | 关键资源优先、图片优化      |
| FID        | < 100ms | Web Vitals      | 代码分割、Web Worker        |
| CLS        | < 0.1   | Web Vitals      | 固定尺寸、骨架屏            |
| 子应用加载 | < 500ms | qiankun timing  | 缓存、预取                  |
| 内存占用   | < 150MB | Performance API | 及时卸载、内存泄漏检测      |

---

## 七、CI/CD 流水线

### 7.1 独立部署架构

```
┌──────────────────────────────────────────────────────┐
│                    Git Repository                     │
│  cloudboard/                                         │
│  ├── main-app/    ──┐                                │
│  ├── sub-apps/      │  monorepo (pnpm workspace)     │
│  │  ├── dashboard/  │                                │
│  │  ├── charts/     │                                │
│  │  ├── users/      │                                │
│  │  └── ops/       ─┘                                │
│  └── shared/       ──┘                                │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│              GitHub Actions Pipeline                  │
│                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  Lint & Test│→│    Build    │→│    Deploy   │  │
│  │             │  │             │  │             │  │
│  │ • ESLint    │  │ • Vite Build│  │ • Docker    │  │
│  │ • Vitest    │  │ • Type Check│  │ • Nginx     │  │
│  │ • Coverage  │  │ • Assets    │  │ • CDN Push  │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
│                                                      │
│  触发条件:                                           │
│  • main-app/** → 部署主应用                          │
│  • sub-apps/dashboard/** → 仅部署 dashboard         │
│  • sub-apps/charts/** → 仅部署 charts               │
│  • shared/** → 重建所有依赖子应用                     │
│  • main branch push → 部署全部                       │
└──────────────────────────────────────────────────────┘
```

### 7.2 GitHub Actions 配置

```yaml
# .github/workflows/deploy.yml
name: CloudBoard CI/CD

on:
  push:
    branches: [main]
    paths:
      - "main-app/**"
      - "sub-apps/**"
      - "shared/**"

jobs:
  lint-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install
      - run: pnpm lint
      - run: pnpm test -- --coverage

  build-and-deploy:
    needs: lint-test
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app:
          - name: main-app
            path: main-app
            port: 8080
          - name: dashboard
            path: sub-apps/dashboard
            port: 3001
          - name: charts
            path: sub-apps/charts
            port: 3002
          - name: users
            path: sub-apps/users
            port: 3003
          - name: ops
            path: sub-apps/ops
            port: 3004

    # 仅当该应用有变更时才构建
    if: contains(github.event.head_commit.modified, matrix.app.path)
      || contains(github.event.head_commit.modified, 'shared/')

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install
      - run: pnpm --filter ${{ matrix.app.name }} build

      - name: Deploy to CDN
        uses: jakejarvis/s3-sync-action@master
        with:
          args: --delete
        env:
          SOURCE_DIR: ${{ matrix.app.path }}/dist
          AWS_S3_BUCKET: ${{ secrets.CDN_BUCKET }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_KEY }}
          AWS_REGION: ap-east-1
```

---

## 八、监控与可观测性

### 8.1 错误监控

```typescript
// main-app/src/utils/monitor.ts
import * as Sentry from "@sentry/vue";

export function initSentry(app: any) {
  Sentry.init({
    app,
    dsn: "https://xxx@sentry.io/xxx",
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION,

    // 性能监控
    tracesSampleRate: 1.0,

    // 错误捕获
    beforeSend(event) {
      // 过滤敏感信息
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.Authorization;
        }
      }
      return event;
    },

    // 自定义标签
    initialScope: {
      tags: {
        platform: "cloudboard",
      },
    },
  });
}

// 子应用错误上报
export function initSubAppMonitor(appName: string) {
  window.addEventListener("error", (event) => {
    Sentry.captureException(event.error, {
      tags: { subApp: appName, source: "window-error" },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    Sentry.captureException(event.reason, {
      tags: { subApp: appName, source: "unhandled-rejection" },
    });
  });
}
```

### 8.2 性能监控

```typescript
// main-app/src/utils/performance.ts
export function initPerformanceMonitor() {
  // Web Vitals
  if ("PerformanceObserver" in window) {
    // LCP
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      console.log("[Perf] LCP:", lastEntry.startTime);
      // 上报到监控系统
      reportMetric("LCP", lastEntry.startTime);
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });

    // FID
    const fidObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        console.log("[Perf] FID:", entry.startTime);
        reportMetric("FID", entry.startTime);
      });
    });
    fidObserver.observe({ type: "first-input", buffered: true });

    // CLS
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
          console.log("[Perf] CLS:", clsValue);
          reportMetric("CLS", clsValue);
        }
      });
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });
  }

  // 子应用加载时间
  if ((window as any).__POWERED_BY_QIANKUN__) {
    const startTime = performance.now();
    window.addEventListener("qiankun-after-mount", () => {
      const loadTime = performance.now() - startTime;
      console.log(`[Perf] 子应用加载时间: ${loadTime.toFixed(0)}ms`);
      reportMetric("subapp-load", loadTime);
    });
  }
}

function reportMetric(name: string, value: number) {
  // 上报到监控系统（Sentry / 自研平台）
  navigator.sendBeacon(
    "/api/metrics",
    JSON.stringify({ name, value, timestamp: Date.now() }),
  );
}
```

---

## 九、安全架构

### 9.1 安全分层

```
┌─────────────────────────────────────────────────────┐
│                   安全架构                            │
├─────────────────────────────────────────────────────┤
│  Layer 1: 网络层                                     │
│  • HTTPS / TLS 1.3                                  │
│  • CSP (Content Security Policy)                    │
│  • CORS 白名单                                       │
│  • Rate Limiting                                    │
├─────────────────────────────────────────────────────┤
│  Layer 2: 应用层                                     │
│  • JWT Token + Refresh Token                        │
│  • RBAC 权限控制                                     │
│  • 输入净化 (XSS 防护)                               │
│  • CSRF Token                                       │
├─────────────────────────────────────────────────────┤
│  Layer 3: 微前端层                                   │
│  • JS 沙箱 (qiankun proxy)                          │
│  • 样式隔离 (Shadow DOM)                            │
│  • 子应用完整性校验 (SRI)                            │
│  • 子应用来源白名单                                   │
├─────────────────────────────────────────────────────┤
│  Layer 4: 数据层                                     │
│  • 敏感数据加密存储                                  │
│  • 审计日志                                          │
│  • 数据脱敏                                          │
│  • 操作留痕                                          │
└─────────────────────────────────────────────────────┘
```

### 9.2 CSP 配置

```html
<!-- main-app/public/index.html -->
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self';
           script-src 'self' 'unsafe-eval' https://cdn.example.com;
           style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
           img-src 'self' data: https:;
           font-src 'self' https://fonts.gstatic.com;
           connect-src 'self' https://api.cloudboard.com https://sentry.io;
           frame-src 'self';
           object-src 'none';
           base-uri 'self';
           form-action 'self';"
/>
```

---

## 十、架构决策记录 (ADR)

### ADR-001: 为什么选择 qiankun 而非 Module Federation？

**背景：** 需要支持多团队、多框架（Vue 3 + React）并行开发

**决策：** 选择 qiankun

**原因：**

1. 子应用技术栈不同（Vue 3 + React），MF 要求同构
2. qiankun 生态成熟，国内文档和社区完善
3. JS 沙箱 + 样式隔离开箱即用
4. 子应用无需改造构建配置（Vite 兼容性好）

**权衡：**

- ❌ 子应用资源无法真正共享（CSS/JS 重复加载）
- ✅ 可通过 CDN 缓存缓解
- ❌ 路由耦合（主应用控制路由）
- ✅ 符合"主应用管导航、子应用管内容"的架构理念

### ADR-002: 为什么选择 monorepo 而非多仓库？

**背景：** 5 个应用 + 4 个共享包

**决策：** 选择 monorepo (pnpm workspace)

**原因：**

1. 共享包（UI 组件、请求库、认证模块）需要频繁迭代
2. 跨应用重构时原子提交
3. CI 可以精确检测变更范围，仅构建受影响的应用
4. 统一依赖版本管理

**权衡：**

- ❌ 仓库体积随时间增长
- ✅ 当前规模（5 应用 + 4 共享包）完全可控
- ❌ 需要配置 workspace
- ✅ pnpm workspace 配置简单

### ADR-003: 为什么选择 Pinia + Zustand 混合状态管理？

**背景：** Vue 子应用和 React 子应用需要共享全局状态

**决策：** 各应用内部使用各自生态的状态管理，跨应用通过 qiankun globalState + CustomEvent

**原因：**

1. 应用内部状态不需要跨框架共享
2. Pinia 是 Vue 3 官方推荐，Zustand 是 React 轻量首选
3. 跨应用通信频率低（用户信息、主题、通知），globalState 足够
4. 避免引入额外的跨框架状态库

---

## 十一、关键指标总结

| 维度         | 指标       | 目标                     |
| ------------ | ---------- | ------------------------ |
| **开发效率** | 团队并行度 | 4 团队独立开发、独立部署 |
| **加载性能** | 首屏时间   | < 2s                     |
| **加载性能** | 子应用切换 | < 500ms                  |
| **加载性能** | LCP        | < 2.5s                   |
| **稳定性**   | 错误率     | < 0.1%                   |
| **稳定性**   | 可用性     | 99.9%                    |
| **可维护性** | 代码重复率 | < 5%（通过共享包）       |
| **安全性**   | 漏洞扫描   | 0 高危                   |
| **安全性**   | 权限覆盖率 | 100% 路由/按钮级         |

---

## 十二、学习收获

### 本次专项的核心收获：

1. **架构选型方法论：** 不是选"最好的"，而是选"最适合的"。qiankun vs MF 的对比让我理解了技术选型的权衡思维。

2. **微前端不是银弹：** 只有在多团队、多框架、独立部署场景下才有价值。小团队单体应用更简单高效。

3. **通信是微前端最大挑战：** globalState 适合简单场景，复杂场景需要 EventBus + CustomEvent 混合方案。

4. **安全要分层设计：** 从网络层到数据层，每层都有对应的安全策略，不能只靠一层防护。

5. **CI/CD 要配合架构：** monorepo + 路径感知构建，才能真正实现"独立部署"的承诺。

6. **性能要量化：** Web Vitals 是标准，但微前端场景还需要监控子应用加载时间、内存占用等定制指标。

### 与之前专项的关联：

- **状态管理** → Pinia/Zustand 在微前端中的应用
- **网络请求** → 共享请求库的拦截器/重试/缓存
- **性能优化** → 微前端场景下的加载优化策略
- **Web 安全** → CSP、RBAC、沙箱在微前端中的落地
- **设计模式** → 单例（AuthManager）、观察者（EventBus）
- **TypeScript** → 类型安全的事件总线、泛型请求封装
- **函数式编程** → 中间件模式（请求拦截器链）

---

_文档生成时间: 2026-04-25 18:00 (Asia/Shanghai)_
_专项训练 18:00 - 架构设计进阶_
