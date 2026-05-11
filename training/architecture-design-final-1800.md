# 🏗️ 前端架构设计 — 终极整合版

**时间：** 2026-04-26 18:00  
**主题：** 架构模式全栈整合 (MVC/MVVM/微前端 + 7天训练成果贯通)  
**前置：** 4/22 基础版 + 4/25 企业微前端版  
**本次：** 架构决策框架 + 架构反模式 + 跨专项知识贯通 + 真实架构评审

---

## 一、架构模式全景图 — 从理论到选型

### 1.1 七种前端架构模式对比

```
┌─────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│   模式      │   数据流向    │   复杂度     │   适用规模   │   代表框架   │
├─────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ MVC         │ 单向 (C→V)   │ ★★☆         │ 中小型       │ jQuery/Backbone│
│ MVVM        │ 双向绑定      │ ★★☆         │ 中大型       │ Vue/Knockout │
│ Flux/Redux  │ 单向数据流    │ ★★★         │ 大型         │ React+Redux  │
│ Clean Arch  │ 依赖倒置      │ ★★★★        │ 企业级       │ 自研         │
│ Event Sourcing│ 事件溯源     │ ★★★★        │ 特殊场景     │ 自研         │
│ Micro-FE    │ 多应用路由    │ ★★★★★       │ 超大型       │ qiankun/MF   │
│ Island/     │ 组件级隔离    │ ★★★         │ 内容站       │ Astro        │
│ Islands     │              │              │              │              │
└─────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

### 1.2 架构选型决策树

```
开始
 │
 ├─ 团队规模？
 │   ├─ 1-3 人 → 单体应用 (Vite + Vue3/React)
 │   ├─ 4-10 人 → 模块化单体 (Monorepo + 清晰边界)
 │   └─ 10+ 人/多团队 → 微前端
 │
 ├─ 需要 SEO？
 │   ├─ 是 → SSR/SSG (Next.js/Nuxt)
 │   └─ 否 → CSR (Vite SPA)
 │
 ├─ 性能要求？
 │   ├─ 极致首屏 → Island Architecture (Astro) + 部分 hydration
 │   ├─ 标准首屏 → SSR + 代码分割
 │   └─ 普通 → CSR + 懒加载
 │
 ├─ 遗留系统？
 │   ├─ 有 jQuery/老框架 → 渐进迁移 (微前端包裹)
 │   └─ 全新项目 → 直接选最佳方案
 │
 └─ 技术栈统一？
     ├─ 统一 (全 Vue 或全 React) → Module Federation
     └─ 混合 (Vue + React + Angular) → qiankun/single-spa
```

### 1.3 架构决策记录 (ADR) 模板

```markdown
## ADR-XXX: [标题]

**状态：** 提议 / 已接受 / 已废弃 / 已替换  
**上下文：** 为什么需要这个决策？业务/技术背景是什么？  
**决策：** 我们选择了什么？  
**理由：** 为什么选这个而不是其他选项？  
**权衡：** 接受的不利因素是什么？如何缓解？  
**影响：** 对其他模块/团队/流程的影响？
```

---

## 二、架构反模式 — 踩坑指南

### 2.1 十大前端架构反模式

#### AP-1: 上帝组件 (God Component)

```vue
<!-- ❌ 反模式：一个组件 800 行，管一切 -->
<script setup>
// 800 行逻辑：表单验证 + 数据请求 + 图表渲染 + 权限判断 + 导出 + 打印
// 30 个 ref + 15 个 computed + 20 个 watch
// 嵌套 5 层 if-else
</script>
```

**解决：** 组合式函数 (Composables) 拆分 + 自定义 Hook + 职责单一原则

```vue
<!-- ✅ 正模式：每个 composables 管一件事 -->
<script setup>
import { useFormValidation } from './composables/useFormValidation'
import { useChartData } from './composables/useChartData'
import { useExport } from './composables/useExport'
import { usePermissions } from './composables/usePermissions'

const { formData, errors, validate } = useFormValidation()
const { chartData, loading } = useChartData()
const { exportPDF, exportCSV } = useExport()
const { canEdit, canDelete } = usePermissions()
</script>
```

#### AP-2: Prop Drilling 地狱

```vue
<!-- ❌ 反模式：A → B → C → D → E 逐层传递 -->
<Parent :user="user">
  <Child :user="user">
    <GrandChild :user="user">
      <GreatGrandChild :user="user">
        <UserProfile :user="user" />
      </GreatGrandChild>
    </GrandChild>
  </Child>
</Parent>
```

**解决：** Provide/Inject / Context API / 状态管理

```vue
<!-- ✅ 正模式：Provide/Inject 跨层传递 -->
<!-- 顶层 -->
<script setup>
import { provide } from 'vue'
provide('currentUser', ref(user))
</script>

<!-- 任意深层 -->
<script setup>
import { inject } from 'vue'
const currentUser = inject('currentUser')
</script>
```

#### AP-3: 微前端滥用

```
❌ 反模式：3 人团队做微前端
- 5 个子应用，每个 200 行代码
- qiankun 配置复杂度 > 业务代码
- 部署 5 个服务，CI/CD 配置是业务 3 倍
- 跨应用通信比业务逻辑还复杂
```

**解决：** 团队 < 5 人 → 模块化单体。微前端是组织问题，不是技术问题。

#### AP-4: 状态管理过度设计

```typescript
// ❌ 反模式：简单表单用 Redux + Saga + 5 个 action types
const SET_NAME = 'SET_NAME'
const SET_EMAIL = 'SET_EMAIL'
const SET_PHONE = 'SET_PHONE'
// ... 20 个 action types 只为一个表单

// ✅ 正模式：简单场景用 ref/reactive
const form = reactive({ name: '', email: '', phone: '' })
```

**原则：** 状态复杂度决定方案。简单状态 → ref/reactive；跨组件共享 → Pinia/Zustand；复杂异步 → Redux-Saga。

#### AP-5: 循环依赖

```
A → B → C → A  (循环依赖)
```

**解决：** 提取共享层 + 依赖倒置 + 事件总线解耦

#### AP-6: 样式全局污染

```css
/* ❌ 反模式：全局 CSS 互相覆盖 */
/* app.css */
.container { padding: 20px; }
/* user-module.css */
.container { padding: 0; } /* 覆盖了！ */
```

**解决：** CSS Modules / Scoped CSS / CSS-in-JS / Shadow DOM

#### AP-7: 过度抽象

```typescript
// ❌ 反模式：为 1 次调用创建 4 层抽象
class BaseService { /* 抽象基类 */ }
class UserService extends BaseService { /* 继承 */ }
class UserServiceFactory { /* 工厂 */ }
class UserServiceProxy { /* 代理 */ }
const service = UserServiceFactory.create().proxy() // 只为调用 1 个 API
```

**原则：** YAGNI (You Ain't Gonna Need It)。抽象到第二次复用为止。

#### AP-8: 忽略错误边界

```tsx
// ❌ 反模式：一个组件崩溃，整个应用白屏
function App() {
  return (
    <Header />
    <Sidebar />
    <MainContent /> {/* 这里报错 → 整个页面白屏 */}
    <Footer />
  )
}

// ✅ 正模式：错误边界隔离
function App() {
  return (
    <ErrorBoundary fallback={<HeaderFallback />}>
      <Header />
    </ErrorBoundary>
    <ErrorBoundary fallback={<SidebarFallback />}>
      <Sidebar />
    </ErrorBoundary>
    <ErrorBoundary fallback={<MainFallback />}>
      <MainContent />
    </ErrorBoundary>
  )
}
```

#### AP-9: 构建产物不分析

```
❌ 反模式：bundle 10MB 没人管
- moment.js 全量引入 (300KB → 10KB 用 dayjs)
- lodash 全量引入 (70KB → 按需 5KB)
- 未压缩的 SVG 图标 (50 个 SVG = 2MB)
- 未 code-split 的路由
```

**解决：** 定期 bundle analysis + 依赖审查 + Tree Shaking 验证

#### AP-10: 架构与技术栈绑定

```
❌ 反模式："我们用 Vue 所以所有东西都 Vue"
- 图表库硬绑定 Vue 组件
- 第三方 SDK 直接耦合到 Vue 实例
- 无法迁移到 React
```

**解决：** 基础设施层框架无关。业务逻辑抽离为纯函数/类，UI 层只做渲染。

---

## 三、跨专项知识贯通 — 7 天训练成果整合

### 3.1 架构视角下的知识地图

```
                    ┌─────────────────────┐
                    │   前端架构设计       │
                    │   (本次专项)         │
                    └──────────┬──────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
    ┌───────▼───────┐  ┌──────▼───────┐  ┌───────▼───────┐
    │   代码层       │  │   工程层      │  │   部署层      │
    │  (怎么写)      │  │  (怎么管)     │  │  (怎么发)     │
    └───────┬───────┘  └──────┬───────┘  └───────┬───────┘
            │                  │                  │
   ┌────────┼────────┐  ┌─────┼─────┐    ┌──────┼──────┐
   │        │        │  │     │     │    │      │      │
   ▼        ▼        ▼  ▼     ▼     ▼    ▼      ▼      ▼
设计    函数    组件  构建   网络   安全  CI/CD  监控   性能
模式    式编程  设计  工具   请求   攻防  流水线  可观测  优化
```

### 3.2 每个专项在架构中的位置

| 专项 | 架构层级 | 贡献 | 在 CloudBoard 中的体现 |
|------|----------|------|------------------------|
| **设计模式** | 代码层 | 观察者(EventBus)、策略(验证器)、单例(AuthManager) | 跨应用事件总线、权限检查策略 |
| **函数式编程** | 代码层 | 纯函数(数据转换)、组合(中间件链)、不可变性(状态) | 请求拦截器链、数据管道 |
| **组件设计** | 代码层 | Compound Components、类型安全、无障碍 | 共享 UI 组件库 (Button/Table/Modal) |
| **状态管理** | 代码层 | Pinia/Zustand、全局状态 vs 模块状态 | qiankun globalState + Pinia |
| **网络请求** | 代码层 | 拦截器、重试、取消、缓存 | shared/request 请求库 |
| **Web 安全** | 工程层 | XSS/CSRF 防护、RBAC、CSP | 安全头、权限指令、CSP 配置 |
| **构建工具** | 工程层 | Vite 配置、Tree Shaking、Bundle 分析 | 子应用 Vite 配置、externals |
| **性能优化** | 工程层 | 懒加载、代码分割、Web Vitals | 子应用预加载、性能预算 |
| **Chrome DevTools** | 工程层 | 性能分析、内存泄漏检测 | 微前端内存监控、子应用性能 profiling |
| **Git 进阶** | 工程层 | 分支策略、Hook、Cherry-pick | monorepo 路径感知 CI |
| **TDD** | 工程层 | 测试金字塔、Mock 策略 | 组件测试、API Mock |
| **API 设计** | 部署层 | RESTful、版本控制、分页 | API Gateway 设计 |

### 3.3 贯通示例：一个请求的完整架构旅程

```
用户点击 "导出报表" 按钮
 │
 ├─ 1. 组件层 (组件设计专项)
 │   └─ Button 组件 → 触发 @click="handleExport"
 │   └─ v-permission="'charts:export'" 权限指令拦截
 │
 ├─ 2. 状态层 (状态管理专项)
 │   └─ Pinia store.exporting = true (loading 状态)
 │   └─ emitEvent('data:refresh', { source: 'charts' })
 │
 ├─ 3. 请求层 (网络请求专项)
 │   └─ 请求拦截器：注入 JWT Token
 │   └─ 重试机制：500 时指数退避重试
 │   └─ 取消机制：用户取消操作 → AbortController
 │
 ├─ 4. 安全层 (Web 安全专项)
 │   └─ CSRF Token 自动注入
 │   └─ 401 → 自动刷新 Token + 排队重发
 │   └─ 响应数据 sanitization
 │
 ├─ 5. 函数式层 (函数式编程专项)
 │   └─ 数据转换管道：pipe(parseResponse, filterData, formatExport)
 │   └─ 纯函数保证可测试性
 │
 ├─ 6. 设计模式层 (设计模式专项)
 │   └─ 策略模式：导出格式选择 (PDF/CSV/Excel)
 │   └─ 观察者模式：导出完成通知其他模块
 │
 ├─ 7. 性能层 (性能优化专项)
 │   └─ 导出按钮防抖 (防重复点击)
 │   └─ 大文件分块下载
 │
 ├─ 8. 监控层 (Chrome DevTools 专项)
 │   └─ Sentry 错误上报
 │   └─ Performance API 记录耗时
 │
 └─ 9. 微前端层 (架构设计专项)
     └─ charts 子应用 → 主应用通知 → dashboard 子应用更新
     └─ qiankun globalState 同步导出状态
```

**一个按钮点击，串联了 9 个专项的知识。** 这就是架构的意义：不是孤立地学每个技术，而是理解它们如何协作。

---

## 四、真实架构评审 — CloudBoard 架构复盘

### 4.1 CloudBoard 架构评分卡

| 维度 | 评分 | 说明 |
|------|------|------|
| **架构清晰度** | ⭐⭐⭐⭐⭐ | 主应用 + 4 子应用，职责清晰 |
| **技术选型合理性** | ⭐⭐⭐⭐ | qiankun 适合多框架，但共享依赖有限 |
| **代码组织** | ⭐⭐⭐⭐⭐ | monorepo + shared 包，复用率高 |
| **状态管理** | ⭐⭐⭐⭐ | globalState + Pinia/Zustand 混合，跨框架通信需优化 |
| **安全性** | ⭐⭐⭐⭐⭐ | 四层安全模型完整 (网络/应用/微前端/数据) |
| **性能** | ⭐⭐⭐⭐ | 预加载策略好，但子应用资源重复加载需关注 |
| **可测试性** | ⭐⭐⭐ | 缺少测试策略文档 |
| **可观测性** | ⭐⭐⭐⭐ | Sentry + Web Vitals + 自定义指标 |
| **CI/CD** | ⭐⭐⭐⭐ | 路径感知构建，但缺少回滚策略 |
| **文档** | ⭐⭐⭐⭐⭐ | ADR + 架构文档 + 代码注释完整 |

**综合评分: 4.3/5.0** — 生产就绪，小改进空间

### 4.2 改进建议

#### 改进 1: 添加测试策略

```typescript
// 测试金字塔 (TDD 专项)
//
//        / E2E 测试 \        ← 10% (Cypress, 关键用户流程)
//       / 集成测试   \       ← 20% (子应用通信、跨应用状态)
//      / 单元测试     \      ← 50% (composables、utils、stores)
//     / 快照测试       \     ← 20% (UI 组件)
//
// 每个子应用独立测试 + 主应用集成测试
```

#### 改进 2: 子应用共享依赖优化

```typescript
// 当前问题：Vue 在 5 个子应用中各打包一次 = 5 × 60KB = 300KB
// 解决方案：Module Federation 渐进替换

// main-app/vite.config.ts (或 webpack)
new ModuleFederationPlugin({
  name: 'mainApp',
  shared: {
    vue: { singleton: true, requiredVersion: '^3.4.0' },
    'vue-router': { singleton: true },
    pinia: { singleton: true },
  },
})

// 渐进策略：先用 qiankun 跑通，再用 MF 优化共享依赖
```

#### 改进 3: 添加回滚策略

```yaml
# .github/workflows/rollback.yml
name: Rollback
on:
  workflow_dispatch:
    inputs:
      app:
        description: '要回滚的应用'
        required: true
        type: choice
        options: [main-app, dashboard, charts, users, ops]
      version:
        description: '回滚到的版本 tag'
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy previous version
        uses: jakejarvis/s3-sync-action@master
        with:
          args: --delete
          env:
            SOURCE_DIR: releases/${{ github.event.inputs.app }}/${{ github.event.inputs.version }}
            AWS_S3_BUCKET: ${{ secrets.CDN_BUCKET }}
```

#### 改进 4: 添加架构健康检查

```typescript
// scripts/architecture-health-check.ts
// 定期检查架构违规

import { execSync } from 'child_process'

const checks = [
  // 1. 循环依赖检测
  {
    name: '循环依赖',
    run: () => execSync('npx madge --circular src/').toString(),
    severity: 'error',
  },
  // 2. 子应用间直接导入检测 (应通过 globalState 通信)
  {
    name: '子应用耦合',
    run: () => {
      const result = execSync(
        'grep -r "from.*sub-apps" sub-apps/ --include="*.ts" --include="*.vue"'
      ).toString()
      return result || ''
    },
    severity: 'warning',
  },
  // 3. Bundle 大小检查
  {
    name: 'Bundle 大小',
    run: () => {
      const size = execSync('du -sb dist/').toString().split('\t')[0]
      const sizeMB = parseInt(size) / (1024 * 1024)
      if (sizeMB > 500) throw new Error(`Bundle ${sizeMB}MB > 500MB 预算`)
      return `Bundle: ${sizeMB.toFixed(1)}MB`
    },
    severity: 'error',
  },
  // 4. 死代码检测
  {
    name: '未使用导出',
    run: () => execSync('npx knip').toString(),
    severity: 'warning',
  },
]

console.log('🔍 架构健康检查...\n')
for (const check of checks) {
  try {
    const result = check.run()
    console.log(`✅ ${check.name}: ${result || '通过'}`)
  } catch (e: any) {
    const icon = check.severity === 'error' ? '❌' : '⚠️'
    console.log(`${icon} ${check.name} [${check.severity}]: ${e.message}`)
  }
}
```

---

## 五、架构设计实战 — 新场景：实时协作编辑器

### 5.1 需求分析

**产品名称：** CollabEdit — 实时协作文档编辑器

**核心需求：**
- 多人同时编辑同一文档 (类似 Google Docs)
- 实时光标同步、冲突解决
- 文档版本历史、回滚
- 评论/批注系统
- 导出 (PDF/DOCX/Markdown)
- 离线编辑 + 自动同步

**技术挑战：**
- 实时同步 (WebSocket/CRDT)
- 冲突解决 (OT/CRDT)
- 大文档性能 (虚拟渲染)
- 离线优先 (IndexedDB)

### 5.2 架构设计

```
┌──────────────────────────────────────────────────────────┐
│                    CollabEdit 架构                        │
├──────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │  Editor     │  │  Cursor     │  │  Comment    │      │
│  │  (核心编辑器)│  │  (光标同步)  │  │  (评论系统)  │      │
│  │  ProseMirror│  │  WebSocket  │  │  REST API   │      │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘      │
│         │                │                │              │
│  ┌──────▼────────────────▼────────────────▼──────┐      │
│  │           Sync Engine (同步引擎)               │      │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │      │
│  │  │ CRDT     │ │ OT       │ │ Conflict     │  │      │
│  │  │ (Y.js)   │ │ (操作转换)│ │ Resolution   │  │      │
│  │  └──────────┘ └──────────┘ └──────────────┘  │      │
│  └──────────────────────┬───────────────────────┘      │
│         │                │                │              │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐      │
│  │  Offline    │  │  History    │  │  Export     │      │
│  │  Layer      │  │  Engine     │  │  Engine     │      │
│  │  (IndexedDB │  │  (快照 +    │  │  (PDF/DOCX  │      │
│  │   + 同步)   │  │   diff)     │  │   /MD)      │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
├──────────────────────────────────────────────────────────┤
│              共享基础设施层                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ Auth     │ │ State    │ │ Request  │ │ i18n       │  │
│  │ (JWT+    │ │ (Zustand │ │ (Axios   │ │ (Vue I18n  │  │
│  │  WebSocket│ │  全局)   │ │  + WS)   │ │   + i18next)│ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
├──────────────────────────────────────────────────────────┤
│              后端服务层                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ WebSocket│ │ REST API │ │ Document │ │ Storage    │  │
│  │ Server   │ │ (Node.js)│ │ Store    │ │ (S3 + CDN) │  │
│  │ (Y.js)   │ │          │ │ (MongoDB)│ │            │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 5.3 技术选型

| 决策点 | 选择 | 理由 |
|--------|------|------|
| **编辑器核心** | ProseMirror | 结构化文档、协作友好、插件生态好 |
| **实时同步** | Y.js (CRDT) | 无服务器冲突解决、离线优先、支持多种 Storage |
| **状态管理** | Zustand | 轻量、React 友好、支持中间件 |
| **前端框架** | React | ProseMirror-React 生态成熟 |
| **通信** | WebSocket + REST | 实时数据走 WS，CRUD 走 REST |
| **离线存储** | IndexedDB (y-indexeddb) | 离线编辑 + 自动同步 |
| **版本历史** | Y.js Doc snapshots | 内置版本管理，无需额外实现 |
| **部署** | Docker + K8s | WebSocket 需要 sticky session |

### 5.4 核心代码 — CRDT 同步引擎

```typescript
// sync-engine/src/collaboration.ts
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'

interface CollaborationConfig {
  documentId: string
  wsUrl: string
  userId: string
  userName: string
  userColor: string
}

class CollaborationEngine {
  private ydoc: Y.Doc
  private provider: WebsocketProvider
  private indexeddbProvider: IndexeddbPersistence
  private awareness: Y.Awareness

  constructor(config: CollaborationConfig) {
    // 1. 创建 Y.Doc (CRDT 文档)
    this.ydoc = new Y.Doc()

    // 2. WebSocket 连接 (实时同步)
    this.provider = new WebsocketProvider(
      config.wsUrl,
      config.documentId,
      this.ydoc
    )

    // 3. IndexedDB 持久化 (离线支持)
    this.indexeddbProvider = new IndexeddbPersistence(
      config.documentId,
      this.ydoc
    )

    // 4. Awareness (光标/选区/在线状态)
    this.awareness = this.provider.awareness
    this.awareness.setLocalStateField('user', {
      id: config.userId,
      name: config.userName,
      color: config.userColor,
    })

    // 5. 同步状态监听
    this.provider.on('status', (event: { status: string }) => {
      console.log(`[Sync] 连接状态: ${event.status}`)
      // connected / disconnected / connecting
    })

    // 6. 离线同步
    this.indexeddbProvider.on('synced', () => {
      console.log('[Sync] IndexedDB 同步完成')
      // 合并本地变更到远程
      const localUpdates = this.indexeddbProvider.getUpdates()
      this.provider.sendAllUpdates(localUpdates)
    })
  }

  // 获取文档内容 (ProseMirror 格式)
  getDocumentContent(): any {
    const content = this.ydoc.getText('content')
    return content.toJSON()
  }

  // 设置文档内容
  setDocumentContent(content: string): void {
    this.ydoc.transact(() => {
      const text = this.ydoc.getText('content')
      text.delete(0, text.length)
      text.insert(0, content)
    })
  }

  // 获取协作者列表
  getCollaborators(): Array<{ id: string; name: string; color: string }> {
    return Array.from(this.awareness.getStates().values()).map(
      (state: any) => state.user
    )
  }

  // 监听文档变化
  onChange(callback: (update: Uint8Array) => void): () => void {
    const handler = (update: Uint8Array) => callback(update)
    this.ydoc.on('update', handler)
    return () => this.ydoc.off('update', handler)
  }

  // 销毁
  destroy(): void {
    this.provider.destroy()
    this.indexeddbProvider.destroy()
    this.ydoc.destroy()
  }
}

export { CollaborationEngine }
```

### 5.5 核心代码 — 冲突解决策略

```typescript
// sync-engine/src/conflict-resolution.ts

/**
 * 冲突解决策略
 *
 * CRDT (Conflict-free Replicated Data Type) 保证：
 * - 最终一致性 (Eventually Consistent)
 * - 无需中心化协调
 * - 离线可编辑
 *
 * Y.js 使用 Y.Array / Y.Text / Y.Map 实现 CRDT
 * 所有操作都是可交换的 (Commutative)
 */

// 示例：两个用户同时修改同一文档
//
// 用户 A (离线编辑): "Hello World" → "Hello Beautiful World"
// 用户 B (在线编辑): "Hello World" → "Hello Everyone"
//
// CRDT 合并结果: "Hello Beautiful Everyone"
// (不是覆盖，而是智能合并)

class ConflictResolver {
  /**
   * 自定义冲突处理 (当 CRDT 不够用时)
   * 例如：两个用户同时修改同一单元格的值
   */
  static resolveCellConflict(
    localValue: any,
    remoteValue: any,
    localTimestamp: number,
    remoteTimestamp: number
  ): any {
    // 策略 1: Last-Write-Wins (最后写入获胜)
    if (localTimestamp > remoteTimestamp) return localValue
    if (remoteTimestamp > localTimestamp) return remoteValue

    // 策略 2: 用户 ID 字典序 (确定性回退)
    return localValue // 或 remoteValue，只要双方一致即可
  }

  /**
   * 操作转换 (OT) 回退方案
   * 当 CRDT 无法处理时的降级策略
   */
  static transformOperation(
    localOp: any,
    remoteOp: any
  ): { localOp: any; remoteOp: any } {
    // 简化的 OT 转换
    if (localOp.position === remoteOp.position) {
      // 同一位置冲突 → 偏移
      return {
        localOp: { ...localOp, position: localOp.position + 1 },
        remoteOp,
      }
    }
    return { localOp, remoteOp }
  }
}

export { ConflictResolver }
```

### 5.6 性能优化 — 大文档虚拟渲染

```typescript
// editor/src/virtual-renderer.ts

/**
 * 大文档虚拟渲染
 *
 * 问题：10 万行文档 → DOM 节点过多 → 卡顿
 * 解决：只渲染可视区域内的行
 *
 * 原理：
 * 1. 计算可视区域 (scrollTop / lineHeight)
 * 2. 只渲染可视行 + 缓冲区 (上下各 10 行)
 * 3. 使用 padding 模拟总高度
 * 4. 滚动时动态更新渲染范围
 */

interface VirtualRendererConfig {
  totalRows: number
  rowHeight: number
  containerHeight: number
  bufferSize?: number
}

class VirtualRenderer {
  private config: VirtualRendererConfig
  private scrollTop: number = 0
  private renderRange: { start: number; end: number } = { start: 0, end: 0 }

  constructor(config: VirtualRendererConfig) {
    this.config = {
      bufferSize: 10,
      ...config,
    }
  }

  updateScrollTop(scrollTop: number): void {
    this.scrollTop = scrollTop
    this.computeRenderRange()
  }

  private computeRenderRange(): void {
    const { rowHeight, containerHeight, totalRows, bufferSize = 10 } = this.config

    const visibleStart = Math.floor(this.scrollTop / rowHeight)
    const visibleCount = Math.ceil(containerHeight / rowHeight)

    this.renderRange = {
      start: Math.max(0, visibleStart - bufferSize),
      end: Math.min(totalRows, visibleStart + visibleCount + bufferSize),
    }
  }

  getRenderRange(): { start: number; end: number } {
    return { ...this.renderRange }
  }

  // 容器总高度 (用于滚动条)
  getTotalHeight(): number {
    return this.config.totalRows * this.config.rowHeight
  }

  // 偏移量 (用于定位渲染区域)
  getOffset(): number {
    return this.renderRange.start * this.config.rowHeight
  }
}

// 使用示例
const renderer = new VirtualRenderer({
  totalRows: 100000,
  rowHeight: 24,
  containerHeight: 600,
})

// 滚动时更新
window.addEventListener('scroll', () => {
  renderer.updateScrollTop(window.scrollY)
  const { start, end } = renderer.getRenderRange()
  console.log(`渲染行 ${start} - ${end} (共 ${100000} 行)`)
  // 只渲染 20-40 行，而不是 100000 行
})
```

### 5.7 离线优先架构

```typescript
// editor/src/offline-layer.ts

/**
 * 离线优先 (Offline-First) 架构
 *
 * 核心原则：
 * 1. 所有数据优先从本地读取 (IndexedDB)
 * 2. 写操作先写入本地，再同步到服务器
 * 3. 网络恢复后自动同步
 * 4. 冲突由 CRDT 自动解决
 *
 * 状态机：
 * online → 正常读写
 * offline → 本地读写 + 操作队列
 * reconnecting → 同步队列 + 冲突解决
 * synced → 恢复正常
 */

interface SyncQueueItem {
  id: string
  operation: string
  data: any
  timestamp: number
  retries: number
}

class OfflineLayer {
  private db: IDBDatabase | null = null
  private syncQueue: SyncQueueItem[] = []
  private isOnline: boolean = navigator.onLine
  private syncInterval: number | null = null

  async init(): Promise<void> {
    // 1. 打开 IndexedDB
    this.db = await this.openDB('collabedit-offline', 1)

    // 2. 加载同步队列
    this.syncQueue = await this.loadSyncQueue()

    // 3. 监听网络状态
    window.addEventListener('online', () => this.onReconnect())
    window.addEventListener('offline', () => this.onDisconnect())

    // 4. 定时同步 (在线时)
    this.startSyncTimer()
  }

  // 读取 (优先本地)
  async get(key: string): Promise<any> {
    if (!this.db) throw new Error('DB not initialized')

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('documents', 'readonly')
      const store = tx.objectStore('documents')
      const request = store.get(key)

      request.onsuccess = () => resolve(request.result?.data)
      request.onerror = () => reject(request.error)
    })
  }

  // 写入 (本地 + 队列)
  async set(key: string, value: any): Promise<void> {
    if (!this.db) throw new Error('DB not initialized')

    // 1. 写入 IndexedDB
    await this.writeToDB('documents', { key, data: value, updatedAt: Date.now() })

    // 2. 加入同步队列
    if (!this.isOnline) {
      this.syncQueue.push({
        id: crypto.randomUUID(),
        operation: 'set',
        data: { key, value },
        timestamp: Date.now(),
        retries: 0,
      })
      await this.saveSyncQueue()
    }
  }

  // 在线恢复
  private async onReconnect(): Promise<void> {
    this.isOnline = true
    console.log('[Offline] 网络恢复，开始同步...')

    // 同步队列中的操作
    for (const item of this.syncQueue) {
      try {
        await this.syncOperation(item)
      } catch (e) {
        item.retries++
        if (item.retries > 5) {
          console.error(`[Offline] 同步失败 (已重试 ${item.retries} 次):`, item)
        }
      }
    }

    // 清空成功同步的项
    this.syncQueue = this.syncQueue.filter(item => item.retries >= 5)
    await this.saveSyncQueue()
  }

  // 离线
  private onDisconnect(): void {
    this.isOnline = false
    console.log('[Offline] 网络断开，切换到离线模式')
  }

  private startSyncTimer(): void {
    this.syncInterval = window.setInterval(() => {
      if (this.isOnline && this.syncQueue.length > 0) {
        this.onReconnect()
      }
    }, 30000) // 每 30 秒检查
  }

  private openDB(name: string, version: number): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('documents')) {
          db.createObjectStore('documents', { keyPath: 'key' })
        }
        if (!db.objectStoreNames.contains('sync-queue')) {
          db.createObjectStore('sync-queue', { keyPath: 'id' })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  private async writeToDB(storeName: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const request = store.put(data)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  private async loadSyncQueue(): Promise<SyncQueueItem[]> {
    // 从 IndexedDB 加载
    return []
  }

  private async saveSyncQueue(): Promise<void> {
    // 保存到 IndexedDB
  }

  private async syncOperation(item: SyncQueueItem): Promise<void> {
    // 发送到服务器
    await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    })
  }
}

export { OfflineLayer }
```

---

## 六、架构设计方法论 — 从需求到落地

### 6.1 架构设计五步法

```
Step 1: 需求分析
  ├─ 功能性需求 (做什么)
  ├─ 非功能性需求 (性能/安全/可用性)
  ├─ 约束条件 (时间/团队/技术栈)
  └─ 成功指标 (量化目标)

Step 2: 架构探索
  ├─ 识别核心领域 (DDD 限界上下文)
  ├─ 确定架构风格 (单体/微前端/Island)
  ├─ 技术选型 (框架/状态/通信/构建)
  └─ 风险评估 (技术风险/迁移风险)

Step 3: 详细设计
  ├─ 目录结构
  ├─ 模块边界
  ├─ 数据流
  ├─ 接口定义
  └─ 状态管理策略

Step 4: 原型验证
  ├─ 关键技术点 PoC
  ├─ 性能基准测试
  ├─ 安全测试
  └─ 团队评审

Step 5: 迭代演进
  ├─ 监控指标
  ├─ 定期架构审查
  ├─ 技术债务管理
  └─ 渐进式重构
```

### 6.2 架构评审 Checklist

```markdown
## 架构评审 Checklist

### 功能性
- [ ] 所有业务需求都有对应的架构支撑
- [ ] 异常场景有处理方案
- [ ] 权限模型覆盖所有角色

### 性能
- [ ] 首屏加载时间有明确目标
- [ ] 大数据量场景有优化方案
- [ ] 内存使用有监控

### 安全
- [ ] 认证授权方案完整
- [ ] 输入输出有安全处理
- [ ] 敏感数据有保护措施

### 可维护性
- [ ] 模块边界清晰
- [ ] 代码复用策略明确
- [ ] 文档齐全

### 可扩展性
- [ ] 新增功能不需要大改架构
- [ ] 团队增长不影响开发效率
- [ ] 技术栈升级路径清晰

### 可测试性
- [ ] 核心逻辑可单元测试
- [ ] 组件可独立测试
- [ ] E2E 测试覆盖关键流程

### 可观测性
- [ ] 错误监控方案
- [ ] 性能监控方案
- [ ] 业务指标追踪
```

---

## 七、7 天训练终极总结

### 7.1 知识体系全景

```
前端工程师知识体系 (阶段一)
│
├── JavaScript 核心
│   ├── TypeScript (类型系统/泛型/条件类型)
│   ├── 设计模式 (23 种 × JavaScript 实现)
│   └── 函数式编程 (纯函数/组合/Monad/不可变性)
│
├── 工程能力
│   ├── 构建工具 (Vite/Webpack/esbuild)
│   ├── 网络请求 (Fetch/Axios/拦截器/重试/取消)
│   ├── Web 安全 (XSS/CSRF/SQL注入/SSRF/CSP)
│   ├── 性能优化 (懒加载/防抖/内存/Web Vitals)
│   ├── Chrome DevTools (性能/内存/断点)
│   ├── Git 进阶 (分支/Rebase/Hook/Bisect)
│   └── TDD (测试金字塔/Mock/断言)
│
├── 前端架构
│   ├── 架构模式 (MVC/MVVM/Flux/微前端/Island)
│   ├── 组件设计 (Atomic Design/Compound/类型安全)
│   ├── 状态管理 (Pinia/Zustand/Redux/全局 vs 模块)
│   ├── API 设计 (RESTful/版本控制/分页/过滤)
│   └── 架构决策 (ADR/反模式/评审 Checklist)
│
└── 实战项目
    ├── CloudBoard (企业微前端平台)
    ├── CollabEdit (实时协作编辑器) ← 本次新增
    └── 组件库 (6 个生产级组件)
```

### 7.2 训练成果统计

| 指标 | 数量 |
|------|------|
| 专项训练数 | 43+ |
| 文档总产出 | ~2MB+ |
| 代码示例 | 200+ |
| 代码行数 | 15,000+ |
| 文件数 | 70+ |
| 训练天数 | 7 天 |
| 日均专项 | 6+ |

### 7.3 核心能力提升

| 能力维度 | 训练前 | 训练后 |
|----------|--------|--------|
| JavaScript/TypeScript | 中级 | 高级 |
| 架构设计 | 了解概念 | 能独立设计企业级架构 |
| 工程化 | 会用工具 | 理解原理 + 能手写核心 |
| 性能优化 | 知道概念 | 能诊断 + 能优化 + 能监控 |
| 安全 | 知道 XSS | 能攻防 + 能设计安全架构 |
| 测试 | 写简单用例 | 测试金字塔 + TDD + E2E |
| 代码质量 | 能写 | 能设计 + 能评审 + 能重构 |

---

## 八、阶段二规划 — Vue3 框架核心

### 8.1 学习路径

```
阶段二：Vue3 框架核心 (预计 7-10 天)

Day 1-2: Vue3 核心概念
  ├── Composition API (ref/reactive/computed/watch)
  ├── 响应式原理 (Proxy/依赖收集/触发更新)
  └── 生命周期

Day 3-4: 组件进阶
  ├── 组件通信 (props/emits/provide/inject/attrs)
  ├── 插槽 (默认/具名/作用域)
  ├── 动态组件 & 异步组件
  └── Teleport & Suspense

Day 5-6: Vue Router + Pinia
  ├── Vue Router (导航守卫/动态路由/滚动行为)
  ├── Pinia (Store/Getter/Action/插件)
  └── SSR (Nuxt 基础)

Day 7-8: Vue3 源码阅读
  ├── 响应式系统 (reactivity/)
  ├── 渲染器 (renderer/)
  ├── 虚拟 DOM (vnode/)
  └── 编译器 (compiler/)

Day 9-10: Vue3 实战项目
  └── 用 Vue3 重构 CloudBoard 主应用
```

### 8.2 与阶段一的衔接

| 阶段一知识 | 阶段二应用 |
|------------|------------|
| TypeScript | Vue3 组件类型定义、Store 类型安全 |
| 设计模式 | Vue3 内部大量使用观察者/工厂/策略模式 |
| 函数式编程 | Composition API 天然函数式风格 |
| 状态管理 | Pinia 是阶段一状态管理专项的直接应用 |
| 组件设计 | 阶段二的组件设计有理论指导 |
| 性能优化 | Vue3 的响应式优化、异步组件、keep-alive |
| 构建工具 | Vite + Vue3 是黄金组合 |

---

*文档生成时间: 2026-04-26 18:00 (Asia/Shanghai)*  
*专项训练 18:00 - 架构设计终极整合版*  
*前置: 4/22 基础版 + 4/25 企业微前端版*  
*本次: 架构决策框架 + 反模式 + 跨专项贯通 + 真实架构评审 + CollabEdit 实战*
