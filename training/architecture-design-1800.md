# 🏗️ 前端架构设计专项训练

**时间：** 2026-04-22 18:00-19:30  
**主题：** 前端架构模式 (MVC/MVVM/微前端)  
**目标：** 掌握主流架构模式，设计 1 个完整应用架构

---

## 📚 一、架构模式核心概念

### 1.1 MVC (Model-View-Controller)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Model    │────▶│   View      │◀────│ Controller  │
│  (数据层)    │     │  (视图层)    │     │  (控制层)    │
└─────────────┘     └─────────────┘     └─────────────┘
       ▲                                       │
       └───────────────────────────────────────┘
```

**核心职责：**
- **Model**: 数据和业务逻辑，独立于 UI
- **View**: 用户界面展示，被动接收数据
- **Controller**: 处理用户输入，协调 Model 和 View

**优点：**
- ✅ 职责清晰，分离关注点
- ✅ Model 可复用，支持多 View
- ✅ 易于单元测试

**缺点：**
- ❌ Controller 容易臃肿
- ❌ View 和 Model 耦合可能较深
- ❌ 不适合复杂交互场景

**适用场景：** 传统 Web 应用、服务端渲染应用

---

### 1.2 MVVM (Model-View-ViewModel)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Model    │◀───▶│  ViewModel  │◀───▶│    View     │
│  (数据层)    │     │  (视图模型)  │     │  (视图层)    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │  双向绑定    │
                    └─────────────┘
```

**核心职责：**
- **Model**: 原始数据
- **View**: UI 展示
- **ViewModel**: View 的抽象，包含状态和逻辑，通过双向绑定同步 View

**关键特性：**
- **双向数据绑定**: View 变化自动更新 ViewModel，反之亦然
- **命令模式**: 用户操作通过 Command 传递给 ViewModel
- **观察者模式**: ViewModel 变化通知 View 更新

**优点：**
- ✅ View 和 Model 完全解耦
- ✅ 减少样板代码 (无需手动 DOM 操作)
- ✅ 适合复杂交互的 SPA 应用

**缺点：**
- ❌ 调试困难 (数据流向不直观)
- ❌ 内存泄漏风险 (观察者未清理)
- ❌ 大型应用 ViewModel 可能臃肿

**代表框架：** Vue.js, Knockout, Angular (部分)

---

### 1.3 微前端 (Micro-Frontends)

```
┌─────────────────────────────────────────────────────────┐
│                    Shell / Container                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │  App A      │  │  App B      │  │  App C      │      │
│  │  (React)    │  │  (Vue)      │  │  (Angular)  │      │
│  │  /user      │  │  /order     │  │  /product   │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────────────────────┘
```

**核心思想：** 将前端应用拆分为多个可独立开发、部署的小型应用

**实现方案：**

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| **iframe** | 最隔离 | 完全隔离，技术栈无关 | 通信困难，性能差 |
| **Web Components** | 原生组件 | 标准化，浏览器支持 | 兼容性，生态不成熟 |
| **Module Federation** | Webpack 5 | 运行时共享，粒度细 | 配置复杂 |
| **single-spa** | 路由分发 | 成熟方案，生态好 | 需要适配层 |

**优点：**
- ✅ 技术栈无关，团队自治
- ✅ 独立部署，降低风险
- ✅ 增量升级，legacy 友好

**缺点：**
- ❌ 复杂度增加
- ❌ 样式/依赖隔离困难
- ❌ 性能开销 (多个 bundle)

**适用场景：** 大型应用、多团队协作、遗留系统改造

---

## 🎯 二、完整应用架构设计实战

### 2.1 项目背景

**应用名称：** 智能命名系统 (Naming App Pro)

**业务需求：**
- 用户管理 (登录/注册/权限)
- 命名方案 CRUD
- 批量生成与导出
- 数据分析看板
- 多租户支持

**技术约束：**
- 支持 10 万 + 日活
- 首屏加载 < 2s
- 支持 SSR/SEO
- 可横向扩展

---

### 2.2 架构选型决策

#### 整体架构：微前端 + MVVM 混合

```
┌────────────────────────────────────────────────────────────┐
│                        CDN / Edge                          │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│                      Nginx / Gateway                        │
│              (路由分发 / 负载均衡 / SSR)                     │
└────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   Shell App   │   │   SSR Service │   │   API Gateway │
│   (React)     │   │   (Next.js)   │   │   (Node.js)   │
└───────────────┘   └───────────────┘   └───────────────┘
        │
        ├───┬───────────┬───────────┬───────────┐
        ▼   ▼           ▼           ▼           ▼
   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │  User   │   │ Naming  │   │  Data   │   │  Admin  │
   │  Module │   │ Module  │   │ Module  │   │ Module  │
   │  (Vue3) │   │(React)  │   │ (Vue3)  │   │(React)  │
   └─────────┘   └─────────┘   └─────────┘   └─────────┘
```

#### 选型理由：

| 决策点 | 选择 | 理由 |
|--------|------|------|
| **整体架构** | 微前端 | 多团队并行开发，独立部署 |
| **Shell 框架** | React | 生态成熟，single-spa 支持好 |
| **子应用框架** | Vue3 + React 混合 | 团队技术栈现状，渐进迁移 |
| **SSR 方案** | Next.js | SEO 需求，首屏性能 |
| **状态管理** | Pinia + Zustand | 轻量，TypeScript 友好 |
| **构建工具** | Vite + Webpack5 | Vite 开发快，Webpack 生产稳 |

---

### 2.3 目录结构设计

```
naming-app-pro/
├── shell/                      # 主应用 (React)
│   ├── src/
│   │   ├── apps/               # 子应用注册配置
│   │   ├── components/         # 共享组件
│   │   ├── hooks/              # 共享 Hooks
│   │   ├── store/              # 全局状态
│   │   ├── styles/             # 全局样式
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── apps/
│   ├── user-module/            # 用户模块 (Vue3)
│   │   ├── src/
│   │   │   ├── api/            # API 层
│   │   │   ├── components/     # 模块组件
│   │   │   ├── composables/    # 组合式函数
│   │   │   ├── stores/         # Pinia Store
│   │   │   ├── views/          # 页面视图
│   │   │   └── main.ts
│   │   └── package.json
│   │
│   ├── naming-module/          # 命名模块 (React)
│   │   ├── src/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── stores/         # Zustand Store
│   │   │   ├── pages/
│   │   │   └── main.tsx
│   │   └── package.json
│   │
│   ├── data-module/            # 数据模块 (Vue3)
│   │   └── ...
│   │
│   └── admin-module/           # 管理模块 (React)
│       └── ...
│
├── packages/                   # 共享包
│   ├── ui-kit/                 # UI 组件库
│   ├── utils/                  # 工具函数
│   ├── types/                  # TypeScript 类型定义
│   └── api-client/             # API 客户端
│
├── ssr-service/                # SSR 服务 (Next.js)
│   └── ...
│
├── deployments/                # 部署配置
│   ├── docker/
│   ├── k8s/
│   └── nginx/
│
└── package.json                # Monorepo 根配置
```

---

### 2.4 核心模块设计

#### 2.4.1 状态管理架构

```typescript
// packages/types/src/store.ts

// 全局状态 (Shell 层)
interface GlobalState {
  user: UserInfo | null;
  theme: 'light' | 'dark';
  locale: string;
  permissions: string[];
}

// 模块状态 (各子应用独立)
interface NamingModuleState {
  schemes: NamingScheme[];
  currentScheme: string | null;
  generating: boolean;
  history: GenerateRecord[];
}

// Store 设计原则：
// 1. 全局状态仅存跨模块共享数据
// 2. 模块状态独立管理，避免耦合
// 3. 使用 Selector 派生状态，避免冗余
```

#### 2.4.2 API 层设计

```typescript
// packages/api-client/src/client.ts

class ApiClient {
  private baseURL: string;
  private token: string | null;

  // 请求拦截器
  private interceptors = {
    request: (config: RequestConfig) => {
      config.headers.Authorization = `Bearer ${this.token}`;
      return config;
    },
    response: (response: Response) => {
      // 统一错误处理
      if (response.status === 401) {
        this.handleUnauthorized();
      }
      return response;
    }
  };

  // 模块 API
  user = {
    login: (creds: Credentials) => this.post('/user/login', creds),
    profile: () => this.get('/user/profile'),
  };

  naming = {
    list: () => this.get('/naming/schemes'),
    generate: (params: GenerateParams) => this.post('/naming/generate', params),
    export: (ids: string[]) => this.post('/naming/export', { ids }),
  };
}

// 使用示例
const api = new ApiClient();
const schemes = await api.naming.list();
```

#### 2.4.3 组件分层设计

```
组件层级：
├── Atomic (原子组件)
│   ├── Button, Input, Select
│   └── 无业务逻辑，纯 UI
│
├── Molecular (分子组件)
│   ├── SearchBar (Input + Button)
│   ├── SchemeCard (Title + Stats + Actions)
│   └── 简单组合，无状态
│
├── Organism (生物组件)
│   ├── SchemeList (搜索 + 列表 + 分页)
│   ├── GenerateForm (表单 + 验证 + 提交)
│   └── 有状态，可独立测试
│
└── Template/Pages (模板/页面)
    ├── SchemeManagementPage
    ├── GeneratePage
    └── 组装 Organism，处理路由/数据
```

---

### 2.5 性能优化策略

#### 2.5.1 加载优化

```typescript
// 1. 子应用懒加载
const apps = {
  'user-module': () => import('user-module/main'),
  'naming-module': () => import('naming-module/main'),
  // 路由触发时加载
};

// 2. 组件级代码分割
const HeavyChart = lazy(() => import('./HeavyChart'));

// 3. 预加载策略
<link rel="prefetch" href="/apps/naming-module.js" />
```

#### 2.5.2 缓存策略

```typescript
// SWR / React Query 缓存配置
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5 分钟新鲜
      cacheTime: 30 * 60 * 1000, // 30 分钟缓存
      retry: 2,
    },
  },
});

// 本地存储缓存
const cache = new Map<string, { data: any; expiry: number }>();
```

#### 2.5.3 渲染优化

```vue
<!-- Vue3 虚拟列表 -->
<template>
  <RecycleScroller
    :items="schemes"
    :item-size="80"
    key-field="id"
  >
    <template #default="{ item }">
      <SchemeCard :scheme="item" />
    </template>
  </RecycleScroller>
</template>
```

---

### 2.6 安全设计

#### 2.6.1 认证授权

```typescript
// JWT + Refresh Token 双令牌
interface AuthTokens {
  accessToken: string;   // 15 分钟
  refreshToken: string;  // 7 天
}

// 权限控制
const permissions = {
  'naming:create': true,
  'naming:delete': false,
  'admin:access': false,
};

// 路由守卫
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    next('/login');
  } else if (to.meta.requiresPermission && !hasPermission(to.meta.permission)) {
    next('/403');
  } else {
    next();
  }
});
```

#### 2.6.2 XSS/CSRF 防护

```typescript
// 1. 输入 sanitization
import DOMPurify from 'dompurify';
const safeHTML = DOMPurify.sanitize(userInput);

// 2. CSRF Token
axios.defaults.headers.common['X-CSRF-Token'] = csrfToken;

// 3. CSP 头
// Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
```

---

### 2.7 监控与可观测性

```typescript
// 1. 错误监控
window.onerror = (msg, url, line, col, error) => {
  tracking.error({
    message: msg,
    source: url,
    lineno: line,
    colno: col,
    stack: error?.stack,
  });
};

// 2. 性能监控
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'navigation') {
      tracking.metric('FCP', entry.domContentLoadedEventEnd);
    }
  }
});
observer.observe({ entryTypes: ['navigation', 'paint'] });

// 3. 用户行为追踪
tracking.event('naming_generate', { schemeId, count });
```

---

## 📋 三、架构设计检查清单

### 3.1 功能性检查

- [ ] 核心业务流程覆盖完整
- [ ] 异常流程处理 (错误/空状态/加载)
- [ ] 权限控制粒度合理
- [ ] 数据一致性保证

### 3.2 非功能性检查

- [ ] 首屏加载 < 2s
- [ ] 支持 10 万 + DAU
- [ ] 可水平扩展
- [ ] 可灰度发布
- [ ] 可回滚

### 3.3 可维护性检查

- [ ] 代码复用率高 (共享包)
- [ ] 模块边界清晰
- [ ] 文档完善
- [ ] 测试覆盖率 > 80%

### 3.4 安全性检查

- [ ] 认证授权完整
- [ ] 输入验证
- [ ] XSS/CSRF 防护
- [ ] 敏感数据加密

---

## 🎯 四、实战练习

### 练习 1: 设计一个电商后台管理系统架构

**需求：**
- 商品管理、订单管理、用户管理、数据看板
- 多角色 (运营/客服/管理员)
- 日活 5 万 +

**输出要求：**
1. 架构图 (微前端划分)
2. 技术选型及理由
3. 目录结构
4. 核心模块设计 (状态/API/组件)

### 练习 2: 重构遗留单体应用

**现状：**
- jQuery + 后端模板渲染
- 代码 10 万 + 行
- 部署慢，测试难

**目标：**
- 渐进式迁移到 Vue3
- 保持业务连续
- 提升开发效率

**输出要求：**
1. 迁移策略 (Big Bang vs 渐进)
2. 微前端拆分方案
3. 风险及应对

---

## 📚 五、延伸阅读

- [Micro Frontends](https://micro-frontends.org/)
- [Single-SPA 文档](https://single-spa.js.org/)
- [Vue3 架构最佳实践](https://vuejs.org/guide/scaling-up/)
- [React 架构模式](https://react.dev/learn)
- [DDD 在前端的应用](https://github.com/SAP/chevrotain)

---

*训练材料版本：v1.0 | 最后更新：2026-04-22 18:00*
