# 🏗️ 前端架构设计专项训练 v10 — 架构决策与迁移实战 + 全模式电商应用完整架构

**时间：** 2026-05-07 18:00  
**主题：** 架构决策框架 / 迁移策略 / 反模式 / 全模式融合电商应用 "ShopVerse" 从零设计  
**前置：** 4/22-5/5 共 9 轮架构训练（MVC/MVVM/微前端/RSC/CRDT/Islands/AI-Native/TeamSync）  
**本次新增：** 架构决策科学方法 / 迁移路线图 / 反模式库 / 全模式融合电商应用架构

---

## 一、架构决策的科学方法

### 1.1 为什么大多数架构决策是错的

```
常见错误决策路径:
  1. "我们一直用 React" → 技术惯性，不考虑业务需求
  2. "Twitter 在用微前端" → 幸存者偏差，忽略团队规模差异
  3. "老板说要用最新技术" → 管理层驱动，非技术驱动
  4. "这个框架 star 最多" → 流行度 ≠ 适合度

科学决策路径:
  业务需求 → 约束条件 → 候选方案 → 量化评估 → ADR 记录 → 迭代验证
```

### 1.2 架构决策四维评估模型

```
每个架构决策必须从四个维度评估:

                    ┌─────────────────────────────┐
                    │       架构决策评估            │
                    ├──────────┬──────────────────┤
                    │ 维度     │ 评估指标          │
                    ├──────────┼──────────────────┤
                    │ 业务价值 │ • 需求匹配度      │
                    │ (30%)    │ • 交付速度        │
                    │          │ • 可维护性        │
                    ├──────────┼──────────────────┤
                    │ 技术风险 │ • 成熟度          │
                    │ (25%)    │ • 团队能力匹配    │
                    │          │ • 生态健康度      │
                    ├──────────┼──────────────────┤
                    │ 成本     │ • 学习成本        │
                    │ (25%)    │ • 基础设施成本    │
                    │          │ • 运维成本        │
                    ├──────────┼──────────────────┤
                    │ 演进能力 │ • 可扩展性        │
                    │ (20%)    │ • 技术债可控性    │
                    │          │ • 迁移成本        │
                    └──────────┴──────────────────┘

评分公式: Score = 业务价值×0.3 + 技术风险×0.25 + 成本×0.25 + 演进×0.2
每项 1-10 分，Score ≥ 7 方可通过
```

### 1.3 架构决策记录 (ADR) 模板

```markdown
# ADR-XXX: [决策标题]

## 状态
 Proposed | Accepted | Deprecated | Superseded

## 上下文
- 业务背景: [什么业务需求驱动此决策]
- 约束条件: [时间/预算/团队/技术限制]
- 候选方案: [列出所有考虑过的方案]

## 决策
选择 [方案X]，理由:
1. [理由1 — 量化数据支撑]
2. [理由2 — 量化数据支撑]
3. [理由3 — 量化数据支撑]

拒绝 [方案Y]，理由:
1. [拒绝理由 — 量化数据支撑]

## 后果
- 正面: [采用后的好处]
- 负面: [采用后的代价/限制]
- 风险: [需要关注的风险点]
- 缓解: [风险缓解措施]

## 复审计划
- 首次复审: [日期]
- 触发条件: [什么情况下需要重新评估此决策]
```

### 1.4 量化评估实例 — 电商项目框架选型

```
项目: ShopVerse 电商平台
团队: 8 人前端 (5 Vue, 2 React, 1 新手)
需求: 商品展示 + 购物车 + 订单 + 后台管理
约束: 3 个月上线, SEO 要求高, 首屏 < 2s

┌──────────────┬─────────┬─────────┬─────────┬─────────┬────────┐
│ 方案         │ 业务    │ 技术    │ 成本    │ 演进    │ 加权分 │
│              │ (30%)   │ (25%)   │ (25%)   │ (20%)   │        │
├──────────────┼─────────┼─────────┼─────────┼─────────┼────────┤
│ Next.js 15   │   8     │   7     │   6     │   8     │  7.3   │
│ (React RSC)  │ SEO好   │ React   │ 学习    │ RSC生态 │        │
│              │ RSC首屏 │ 生态好  │ 成本高  │ 好      │        │
│              │ 快      │         │ (5人Vue)│         │        │
├──────────────┼─────────┼─────────┼─────────┼─────────┼────────┤
│ Nuxt 3       │   9     │   9     │   9     │   8     │  8.8   │
│ (Vue 3 SSR)  │ SEO好   │ 5人Vue  │ 学习    │ Composition│
│              │ SSR成熟 │ 经验足  │ 成本低  │ 生态好  │        │
│              │ Pinia   │         │         │         │        │
├──────────────┼─────────┼─────────┼─────────┼─────────┼────────┤
│ Astro +      │   7     │   6     │   5     │   7     │  6.3   │
│ Vue Islands  │ 内容SEO │ Islands │ 复杂    │ 内容站  │        │
│              │ 极好    │ 生态新  │ 交互    │ 适合    │        │
│              │ 但交互  │         │ 场景多  │         │        │
│              │ 弱      │         │         │         │        │
├──────────────┼─────────┼─────────┼─────────┼─────────┼────────┤
│ 纯 Vue 3 SPA │   5     │   8     │   9     │   6     │  6.7   │
│ (CSR)        │ SEO差   │ 团队熟  │ 成本最低│ 扩展性  │        │
│              │ 首屏慢  │ 练      │         │ 有限    │        │
└──────────────┴─────────┴─────────┴─────────┴─────────┴────────┘

决策: Nuxt 3 ✅ (8.8 分)
- 业务价值最高: SEO + SSR 满足电商核心需求
- 技术风险最低: 5/8 人有 Vue 经验
- 成本最低: 学习曲线平缓
- 演进良好: Composition API + Nuxt 生态成熟
```

---

## 二、架构迁移策略

### 2.1 迁移的六种策略（Strangler Fig 模式）

```
场景: 将遗留单体应用逐步迁移到现代架构

策略 1: 并行运行 (Parallel Run)
  ┌──────────────┐    ┌──────────────┐
  │ 遗留系统      │    │ 新系统        │
  │ (旧架构)      │◄──►│ (新架构)      │
  │              │    │              │
  │  数据双向同步  │    │  新数据也写旧  │
  └──────────────┘    └──────────────┘
  适用: 数据一致性要求高 / 不能停机
  风险: 数据同步复杂 / 双写一致性
  案例: Instagram 从 Django 迁移到 Go

策略 2: 功能开关 (Feature Toggle)
  ┌──────────────────────────────────┐
  │           统一代码库              │
  │  ┌────────────┐ ┌────────────┐  │
  │  │ 旧功能路径  │ │ 新功能路径  │  │
  │  │ (旧架构)   │ │ (新架构)   │  │
  │  └────────────┘ └────────────┘  │
  └──────────────────────────────────┘
        ↕ Feature Flag 控制
  适用: 同一团队维护 / 渐进式替换
  风险: 代码复杂度增加 / 技术债累积
  案例: Facebook 从 Backbone 迁移到 React

策略 3: 路由拆分 (Route Splitting)
  用户请求
    │
    ├─ /legacy/*  → 遗留系统
    ├─ /app/*     → 新系统 (Vue 3)
    └─ /admin/*   → 新系统 (React)
  适用: 微前端 / 按路由边界拆分
  风险: 路由边界模糊 / 跨路由状态共享
  案例: Netflix 按页面拆分微前端

策略 4: 壳升级 (Shell Upgrade)
  ┌──────────────────────────────────┐
  │         新壳 (新框架)             │
  │  ┌────────────────────────────┐  │
  │  │    旧应用 (iFrame / 嵌入)  │  │
  │  │    逐步替换为子应用          │  │
  │  └────────────────────────────┘  │
  └──────────────────────────────────┘
  适用: UI 层迁移 / 后端不动
  风险: 壳与内容通信复杂
  案例: 政府系统 UI 现代化

策略 5: 数据先行 (Data First)
  1. 新系统读旧数据库 (只读)
  2. 新系统写新数据库 (双写)
  3. 数据迁移完成
  4. 切换写操作到新库
  5. 下线旧库
  适用: 数据库迁移 / ORM 变更
  风险: 数据一致性 / 回滚困难
  案例: Shopify 数据库分库

策略 6: 绞杀者植物 (Strangler Fig) — 最推荐
  ┌──────────────────────────────────────────────┐
  │              反向代理层 (Proxy)               │
  │                                              │
  │  /api/users    → 新服务 (微服务)              │
  │  /api/orders   → 新服务 (微服务)              │
  │  /api/*        → 遗留系统 (单体)              │
  │                                              │
  │  逐步将路由从遗留系统迁移到新服务               │
  │  最终遗留系统流量归零，安全下线                 │
  └──────────────────────────────────────────────┘
  适用: 几乎所有迁移场景
  风险: 需要代理层 / 路由管理
  案例: Wikipedia 单体→微服务 (10年迁移)
```

### 2.2 迁移风险矩阵

```
┌──────────────────┬─────────────┬─────────────┬─────────────┐
│ 风险类型         │ 概率        │ 影响        │ 缓解措施     │
├──────────────────┼─────────────┼─────────────┼─────────────┤
│ 数据丢失         │ 低          │ 灾难性       │ 双写+校验    │
│ 服务中断         │ 中          │ 高           │ 灰度发布     │
│ 性能下降         │ 中          │ 中           │ 性能基准对比 │
│ 团队抵触         │ 高          │ 中           │ 培训+渐进    │
│ 进度延期         │ 高          │ 中           │ 里程碑拆分   │
│ 回滚困难         │ 低          │ 高           │ 可回滚设计   │
└──────────────────┴─────────────┴─────────────┴─────────────┘
```

### 2.3 迁移 Checklist

```
□ 业务层面
  □ 迁移目标是否明确？(性能/可维护性/扩展性)
  □ 是否有明确的 ROI 预期？
  □ 业务方是否知情并同意？
  □ 停机窗口是否确认？

□ 技术层面
  □ 新旧系统接口是否兼容？
  □ 数据迁移方案是否验证？
  □ 回滚方案是否就绪？
  □ 性能基准是否建立？

□ 团队层面
  □ 团队成员是否具备新技能？
  □ 培训计划是否安排？
  □ 是否有技术带头人？
  □ 外部支持是否到位？

□ 执行层面
  □ 里程碑是否清晰可衡量？
  □ 每个里程碑是否有验收标准？
  □ 监控告警是否配置？
  □ 沟通计划是否制定？
```

---

## 三、架构反模式库

### 3.1 前端架构十大反模式

#### 反模式 1: 上帝组件 (God Component)

```
症状: 一个组件 > 500 行，处理所有逻辑
原因: 缺乏组件拆分意识 / 赶进度
后果: 不可维护 / 不可测试 / 不可复用

❌ 反模式:
<template>
  <div>
    <header>...</header>
    <sidebar>...</sidebar>
    <main>
      <table v-if="view === 'table'">...</table>
      <grid v-if="view === 'grid'">...</grid>
      <list v-if="view === 'list'">...</list>
    </main>
    <footer>...</footer>
  </div>
</template>
<script>
// 2000+ 行: 所有 API 调用 + 所有状态 + 所有事件处理
</script>

✅ 正确: 按职责拆分
<AppLayout>
  <AppHeader />
  <AppSidebar />
  <AppContent>
    <TableView v-if="view === 'table'" :data="tableData" />
    <GridView v-if="view === 'grid'" :data="gridData" />
  </AppContent>
  <AppFooter />
</AppLayout>
// 每个子组件 < 200 行，单一职责
```

#### 反模式 2: 状态大爆炸 (State Explosion)

```
症状: Pinia/Vuex 中有 50+ 个 store，互相引用
原因: 缺乏状态分层设计 / 什么状态都往 store 塞
后果: 状态图复杂如蜘蛛网 / 调试困难

❌ 反模式:
// 50+ 个 store，互相 import
import { useUserStore } from './user'
import { useCartStore } from './cart'
import { useOrderStore } from './order'
import { useProductStore } from './product'
import { useReviewStore } from './review'
// ... 45 more
const user = useUserStore()
const cart = useCartStore()
const order = useOrderStore()
// 在组件中直接操作所有 store

✅ 正确: 分层状态管理
// L1: 全局共享状态 (Pinia) — 3-5 个
useAppStore()    // 主题/语言/导航
useAuthStore()   // 用户认证
useNotificationStore() // 全局通知

// L2: 模块级状态 (Pinia) — 每个业务模块 1 个
useShopStore()   // 商品+购物车+订单 (电商模块)
useAdminStore()  // 后台管理相关

// L3: 组件级状态 (ref/reactive) — 不提升到 store
// 组件内部状态用 ref/reactive，不进入全局 store
```

#### 反模式 3: 过度抽象 (Over-Abstraction)

```
症状: 每个简单操作都要经过 5 层抽象
原因: "为未来设计" / 过度工程
后果: 代码难以追踪 / 调试噩梦

❌ 反模式:
// 获取用户信息需要穿越 5 层:
// Component → Service → Repository → Adapter → API → Server
// 每个层只做了一件事: 转发调用

class UserService {
  getUser(id) { return this.repository.findById(id) }
}
class UserRepository {
  findById(id) { return this.adapter.fetch(`/users/${id}`) }
}
class ApiAdapter {
  fetch(url) { return this.client.get(url) }
}
// 最终只是 fetch('/users/123')，但需要理解 5 个文件

✅ 正确: YAGNI 原则 (You Aren't Gonna Need It)
// 直接调用，需要抽象时再加
const { data: user } = await useFetch(`/api/users/${id}`)
// 当发现需要缓存/重试/日志时，再封装 composable
```

#### 反模式 4: 框架崇拜 (Framework Cult)

```
症状: "我们必须用 XXX 框架，因为它是最棒的"
原因: 技术偏见 / 社区压力
后果: 选型不考虑业务需求 / 团队技能不匹配

❌ 反模式:
"React 是最好的框架，所有项目都用 React"
→ 但团队 8 个人只有 1 人会 React
→ 但项目是后台管理系统，Vue 的生态更适合
→ 但截止日期是 2 个月后

✅ 正确: 工具服务于目标
"我们的目标是在 2 个月内交付后台系统"
→ 团队 7/8 人熟悉 Vue → 选 Nuxt 3
→ 后台管理需要快速开发 → Vue 生态有现成 UI 库
→ 风险最低，交付最快
```

#### 反模式 5: 微前端滥用 (Micro-Frontend Abuse)

```
症状: 3 人团队，5 个子应用，每个子应用独立部署
原因: "大厂都在用" / "看起来很酷"
后果: 部署复杂 10 倍 / 调试困难 / 性能下降

❌ 反模式:
3 人团队 → 5 个微前端子应用
├─ app-shell (独立部署)
├─ dashboard (独立部署)
├─ settings (独立部署)
├─ profile (独立部署)
└─ reports (独立部署)
每个子应用:
  - 独立 CI/CD 流水线
  - 独立版本管理
  - 独立依赖打包
  - 跨应用通信需要消息总线
  - 共享组件需要发布到 npm

✅ 正确: 团队规模决定架构
3 人团队 → 单体应用 (Vite + Vue 3)
- 一个仓库，一个构建
- 清晰的模块边界 (目录结构)
- 按需加载 (动态 import)
- 当团队增长到 15+ 人时再考虑拆分
```

#### 反模式 6: 样式全局污染 (Style Pollution)

```
症状: 全局 CSS 文件 5000+ 行，选择器互相覆盖
原因: 没有样式隔离策略
后果: 改一个样式，坏十个页面

❌ 反模式:
/* global.css — 5000 行 */
.button { padding: 10px; }
.button.primary { background: blue; }
.modal .button { padding: 5px; }
.sidebar .button { padding: 8px; }
/* 选择器特异性战争，!important 满天飞 */

✅ 正确: 样式隔离策略
// 方案 A: CSS Modules (Vue SFC 默认 scoped)
<style scoped>
.button { padding: 10px; }
/* 编译后: .button[data-v-abc123] */
</style>

// 方案 B: CSS-in-JS (styled-components / vanilla-extract)
const Button = styled.button`
  padding: 10px;
  /* 自动生成唯一类名 */
`

// 方案 C: BEM + 命名空间
.b-shop-button { padding: 10px; }
.b-shop-button--primary { background: blue; }
```

#### 反模式 7: 异步地狱 (Async Hell)

```
症状: 组件中有 20+ 个 async 函数，没有统一错误处理
原因: 缺乏网络层抽象
后果: 错误处理不一致 / loading 状态混乱 / 竞态条件

❌ 反模式:
async loadUsers() {
  this.loading = true
  try {
    this.users = await fetch('/api/users').then(r => r.json())
  } catch (e) {
    console.error(e) // 错误被吞掉
  } finally {
    this.loading = false
  }
}
async loadProducts() {
  // 复制粘贴上面的代码...
}
async loadOrders() {
  // 再复制粘贴...
}

✅ 正确: 统一网络层
// composables/useApi.ts
export function useApi<T>(url: string) {
  const data = ref<T | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  async function execute() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status}`)
      data.value = await res.json()
    } catch (e) {
      error.value = e as Error
      // 统一错误上报
      reportError(e)
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, execute }
}

// 使用
const { data: users, loading, execute: loadUsers } = useApi<User[]>('/api/users')
```

#### 反模式 8: 构建产物膨胀 (Bundle Bloat)

```
症状: vendor.js 2MB+，首屏加载 8s+
原因: 全量导入 / 未做代码分割 / 未压缩图片
后果: 用户体验差 / SEO 排名低 / 转化率下降

❌ 反模式:
import * as lodash from 'lodash'        // 72KB (gzip 24KB)
import moment from 'moment'              // 331KB (gzip 68KB)
import echarts from 'echarts'            // 1.2MB (gzip 400KB)
import 'element-plus/dist/index.css'     // 300KB

✅ 正确: 构建优化策略
// 1. 按需导入
import { debounce, throttle } from 'lodash-es'  // Tree-shakeable
import dayjs from 'dayjs'                       // 2KB vs 331KB

// 2. 动态导入 (路由级代码分割)
const Dashboard = () => import('./views/Dashboard.vue')
const Settings = () => import('./views/Settings.vue')

// 3. 组件级懒加载
const HeavyChart = defineAsyncComponent(
  () => import('./components/HeavyChart.vue')
)

// 4. 第三方库按需加载
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
echarts.use([BarChart, LineChart])

// 5. 图片优化
// <img src="/images/hero.webp" loading="lazy" />
// 或使用 Vite 插件自动压缩
```

#### 反模式 9: 测试缺失 (Test Vacuum)

```
症状: 0% 测试覆盖率，每次发布靠手动测试
原因: "没时间写测试" / "测试没用"
后果: 回归 bug 频繁 / 重构恐惧 / 发布焦虑

❌ 反模式:
// 没有测试文件
// 每次发布: "我手动测了一下，应该没问题"
// 上线后: "这个 bug 上次更新时没有啊..."

✅ 正确: 测试金字塔
//        /\
//       /  \  E2E (10%) — Cypress / Playwright
//      /────\
//     /      \  集成 (20%) — Vitest + Testing Library
//    /────────\
//   /          \  单元 (70%) — Vitest
//  /____________\

// 优先测试: 核心业务逻辑 > UI 交互 > 基础设施
// 核心逻辑测试示例:
describe('cart calculations', () => {
  it('calculates total with discount', () => {
    const cart = new Cart([
      { price: 100, qty: 2 },
      { price: 50, qty: 1 }
    ])
    cart.applyDiscount(0.1) // 10% off
    expect(cart.total).toBe(225) // (200+50) * 0.9
  })
})
```

#### 反模式 10: 安全后知后觉 (Security Afterthought)

```
症状: 产品上线后才发现 XSS/CSRF 漏洞
原因: "安全是运维的事" / "先上线再说"
后果: 数据泄露 / 用户信任丧失 / 法律风险

❌ 反模式:
// 直接渲染用户输入
<div v-html="userComment"></div>

// API 密钥硬编码在代码中
const API_KEY = 'sk-1234567890abcdef'

// 没有 CSP 头
// 没有 HTTPS 强制
// 没有输入验证

✅ 正确: 安全左移 (Shift Left)
// 1. 输入验证 (前端 + 后端双重验证)
function validateInput(input: string): boolean {
  return /^[\w\s\-.,!?]+$/.test(input) && input.length <= 500
}

// 2. 输出编码 (自动转义)
// Vue 默认 v-text 自动转义，避免 v-html
// 必须用 v-html 时，先净化
import DOMPurify from 'dompurify'
<div v-html="DOMPurify.sanitize(userComment)"></div>

// 3. CSP 头
// Content-Security-Policy: default-src 'self'; script-src 'self'

// 4. 密钥管理
// 环境变量: import.meta.env.VITE_API_KEY
// 绝不提交到代码仓库

// 5. 依赖审计
// npm audit (CI 中自动执行)
// 定期更新依赖
```

### 3.2 反模式检测 Checklist

```
代码审查时检查:
□ 单个文件 > 500 行？ → 上帝组件
□ Store > 10 个且互相引用？ → 状态大爆炸
□ 抽象层 > 3 层只做转发？ → 过度抽象
□ 选型理由是"流行"而非"适合"？ → 框架崇拜
□ 3 人以下团队用微前端？ → 微前端滥用
□ 全局 CSS > 1000 行？ → 样式污染
□ 每个 API 调用重复 try/catch？ → 异步地狱
□ vendor.js > 500KB？ → 构建膨胀
□ 测试覆盖率 < 30%？ → 测试缺失
□ 上线前没有安全审查？ → 安全后知后觉
```

---

## 四、完整应用架构设计 — ShopVerse 电商平台

### 4.1 产品定义

```
ShopVerse — 全渠道电商平台

核心功能模块:
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  🛍️ 商品浏览    — 分类/搜索/筛选/推荐/对比               │
│  🛒 购物车      — 添加/修改/优惠券/库存检查               │
│  💳 订单支付    — 下单/支付/退款/发票                     │
│  👤 用户中心    — 注册/登录/地址/订单历史/评价            │
│  📦 物流跟踪    — 发货/运输/签收/退换货                   │
│  📊 商家后台    — 商品管理/订单管理/数据分析              │
│  🎯 营销工具    — 优惠券/秒杀/拼团/会员                   │
│  🤖 AI 推荐     — 个性化推荐/智能搜索/客服                │
│                                                          │
│  技术约束:                                                │
│  • 团队: 12 人前端 (8 Vue, 3 React, 1 新手)              │
│  • 上线: 4 个月                                            │
│  • 并发: 支持 10000+ 同时在线                              │
│  • SEO: 商品页必须 SEO 友好                                │
│  • 性能: 首屏 < 2s, LCP < 2.5s                           │
│  • 国际化: 中/英/日三语                                    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 4.2 架构决策记录 (ADR)

```
ADR-01: 前端框架 — Nuxt 3 (Vue 3 + SSR)
  理由: 
  1. 团队 8/12 人熟悉 Vue，学习成本最低
  2. Nuxt 3 原生 SSR 满足 SEO 需求
  3. Composition API 适合复杂电商逻辑
  4. Nuxt 生态有现成 UI 库 (Nuxt UI / Vuetify)
  评分: 业务 9 + 技术 9 + 成本 9 + 演进 8 = 8.8 ✅
  备选: Next.js (评分 7.3，React 学习成本高)

ADR-02: 渲染策略 — SSR + 客户端水合 (渐进式)
  理由:
  1. 商品列表/详情页: SSR (SEO + 首屏快)
  2. 购物车/订单页: CSR (交互密集，SSR 价值低)
  3. 商家后台: CSR (无需 SEO，交互复杂)
  评分: 业务 8 + 技术 8 + 成本 8 + 演进 8 = 8.0 ✅

ADR-03: 状态管理 — Pinia (全局) + Composable (局部)
  理由:
  1. Pinia 是 Vue 3 官方推荐，TS 友好
  2. 全局状态仅 4 个: auth/cart/product/notification
  3. 模块状态用 composable 封装，不污染全局
  评分: 业务 8 + 技术 9 + 成本 9 + 演进 8 = 8.5 ✅

ADR-04: 微前端 — 否 (单体应用 + 模块边界)
  理由:
  1. 团队 12 人，单体足够 (微前端适合 20+ 人)
  2. 单体部署简单，CI/CD 一条流水线
  3. 通过动态 import 实现代码分割
  4. 预留微前端拆分接口，团队增长后可平滑迁移
  评分: 业务 8 + 技术 9 + 成本 9 + 演进 7 = 8.3 ✅
  备选: qiankun (评分 6.5，过度工程)

ADR-05: 组件库 — 自研 + Nuxt UI 基础组件
  理由:
  1. 电商组件高度定制 (商品卡片/购物车/价格展示)
  2. 基于 Nuxt UI 基础组件 (按钮/表单/弹窗) 自研业务组件
  3. 统一设计系统 (Figma → Code)
  评分: 业务 8 + 技术 7 + 成本 7 + 演进 8 = 7.5 ✅

ADR-06: 部署 — Vercel (前端) + 阿里云 (后端 API)
  理由:
  1. Vercel Edge Network 满足全球访问
  2. SSR 函数自动部署，无需配置
  3. 阿里云 ECS 运行后端 API + 数据库
  4. CDN 加速静态资源 (图片/CSS/JS)
  评分: 业务 8 + 技术 8 + 成本 7 + 演进 8 = 7.8 ✅

ADR-07: 测试策略 — 测试金字塔 (70% 单元 / 20% 集成 / 10% E2E)
  理由:
  1. 核心业务逻辑 (价格计算/库存/优惠券) 必须有单元测试
  2. 关键用户流程 (下单/支付) 必须有 E2E 测试
  3. 组件测试覆盖主要交互
  评分: 业务 8 + 技术 8 + 成本 7 + 演进 8 = 7.8 ✅
```

### 4.3 全景架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         用户层 (Browser / Mobile)                        │
│                                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │  🛍️ 商品浏览  │ │  🛒 购物车   │ │  💳 订单支付  │ │  👤 用户中心  │  │
│  │  (SSR 渲染)  │ │  (CSR 交互)  │ │  (CSR 交互)  │ │  (SSR+CSR)   │  │
│  │  Nuxt SSR    │ │  Pinia Cart  │ │  支付 SDK    │ │  Auth Store  │  │
│  │  SEO 优化    │ │  本地缓存    │ │  安全校验    │ │  地址管理    │  │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘  │
│         │                │                │                │           │
│  ┌──────┴────────────────┴────────────────┴────────────────┴──────┐    │
│  │              Nuxt 3 App (SSR + 渐进水合)                       │    │
│  │  • Router (Nuxt Route Rules: SSR/CSR 按需)                     │    │
│  │  • Layout (Header + Footer + 多语言)                           │    │
│  │  • Theme (CSS Variables + Dark Mode)                           │    │
│  │  • i18n (中/英/日，URL 前缀路由)                                │    │
│  └──────────────────────────────┬────────────────────────────────┘    │
├─────────────────────────────────┼─────────────────────────────────────┤
│                    Vercel Edge Network (CDN + SSR Functions)           │
│                                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                   │
│  │ 亚太节点      │ │ 北美节点      │ │ 欧洲节点      │                   │
│  │ (Tokyo/Sing) │ │ (Virginia)   │ │ (Frankfurt)  │                   │
│  │ • SSR 渲染   │ │ • SSR 渲染   │ │ • SSR 渲染   │                   │
│  │ • 静态缓存   │ │ • 静态缓存   │ │ • 静态缓存   │                   │
│  │ • 边缘计算   │ │ • 边缘计算   │ │ • 边缘计算   │                   │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘                   │
│         └────────────────┴────────────────┘                            │
│                              ↓                                         │
│                    API Gateway (阿里云 API 网关)                        │
│              • 限流/熔断/鉴权/日志/监控                                 │
├─────────────────────────────────┼─────────────────────────────────────┤
│                    后端服务层 (阿里云 ECS + K8s)                        │
│                                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ 用户服务  │ │ 商品服务  │ │ 订单服务  │ │ 支付服务  │ │ 推荐服务  │    │
│  │ (Go)     │ │ (Java)   │ │ (Go)     │ │ (Java)   │ │ (Python) │    │
│  │          │ │          │ │          │ │          │ │          │    │
│  │ 注册登录  │ │ 商品CRUD │ │ 订单生命周期│ │ 支付网关  │ │ AI 推荐   │    │
│  │ 地址管理  │ │ 库存管理  │ │ 状态机    │ │ 退款处理  │ │ 智能搜索  │    │
│  │ 权限控制  │ │ 分类标签  │ │ 超时取消  │ │ 对账清算  │ │ 用户画像  │    │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘    │
│       │            │            │            │            │           │
│  ┌────┴────────────┴────────────┴────────────┴────────────┴──────┐    │
│  │              消息队列 (RabbitMQ / Kafka)                        │    │
│  │  • 订单创建 → 库存扣减 → 支付 → 物流                            │    │
│  │  • 事件驱动，异步解耦                                            │    │
│  └───────────────────────────────────────────────────────────────┘    │
├───────────────────────────────────────────────────────────────────────┤
│                    数据层                                                                              │
│                                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ MySQL    │ │ Redis    │ │ ES       │ │ MinIO    │ │ Vector DB│    │
│  │ (主数据)  │ │ (缓存)   │ │ (搜索)   │ │ (文件)   │ │ (推荐)   │    │
│  │          │ │          │ │          │ │          │ │          │    │
│  │ 用户/订单 │ │ Session  │ │ 商品搜索  │ │ 商品图片  │ │ 用户向量  │    │
│  │ 商品元数据│ │ 购物车   │ │ 全文检索  │ │ 头像     │ │ 推荐向量  │    │
│  │ 主从复制  │ │ 热点缓存  │ │ 分词索引  │ │ CDN 分发  │ │ 相似度匹配│    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.4 前端项目结构

```
shopverse-frontend/
├── nuxt.config.ts              # Nuxt 配置 (SSR/路由/模块)
├── tailwind.config.js          # Tailwind CSS 配置
├── vitest.config.ts            # 测试配置
│
├── app/
│   ├── app.vue                 # 根组件 (Layout + RouterView)
│   ├── error.vue               # 全局错误页面
│   └── router.options.ts       # 路由配置 (滚动行为/导航守卫)
│
├── assets/
│   ├── css/
│   │   ├── main.css            # 全局样式入口
│   │   ├── variables.css       # CSS Variables (主题/颜色/间距)
│   │   └── utilities.css       # 工具类 (扩展 Tailwind)
│   └── images/                 # 静态图片 (SVGO 压缩)
│
├── components/
│   ├── ui/                     # 基础 UI 组件 (自研 + Nuxt UI)
│   │   ├── Button.vue          # 按钮 (variant/size/state)
│   │   ├── Input.vue           # 输入框 (验证/状态/图标)
│   │   ├── Modal.vue           # 弹窗 (焦点管理/滚动锁定)
│   │   ├── Toast.vue           # 通知 (队列/自动关闭)
│   │   └── Skeleton.vue        # 骨架屏 (加载占位)
│   │
│   ├── product/                # 商品模块组件
│   │   ├── ProductCard.vue     # 商品卡片 (图片/价格/标签/操作)
│   │   ├── ProductGrid.vue     # 商品网格 (响应式列数)
│   │   ├── ProductFilter.vue   # 筛选面板 (分类/价格/品牌/评分)
│   │   ├── ProductSearch.vue   # 搜索框 (自动补全/历史记录)
│   │   └── ProductGallery.vue  # 图片画廊 (缩略图/缩放/全屏)
│   │
│   ├── cart/                   # 购物车模块组件
│   │   ├── CartItem.vue        # 购物车条目 (数量/库存/操作)
│   │   ├── CartSummary.vue     # 购物车摘要 (小计/优惠/运费)
│   │   └── CartDrawer.vue      # 购物车侧栏 (滑出面板)
│   │
│   ├── order/                  # 订单模块组件
│   │   ├── OrderForm.vue       # 订单表单 (地址/配送/发票)
│   │   ├── OrderTimeline.vue   # 订单时间线 (状态追踪)
│   │   └── OrderCard.vue       # 订单卡片 (列表项)
│   │
│   ├── layout/                 # 布局组件
│   │   ├── AppHeader.vue       # 顶部导航 (搜索/购物车/用户)
│   │   ├── AppFooter.vue       # 底部信息 (链接/社交/版权)
│   │   ├── AppSidebar.vue      # 侧边栏 (分类导航)
│   │   └── Breadcrumb.vue      # 面包屑 (导航路径)
│   │
│   └── marketing/              # 营销组件
│       ├── CouponBanner.vue    # 优惠券横幅
│       ├── FlashSale.vue       # 秒杀倒计时
│       └── GroupBuy.vue        # 拼团卡片
│
├── composables/                # 可复用逻辑 (替代 mixins)
│   ├── useAuth.ts              # 认证 (登录/注册/Token 刷新)
│   ├── useCart.ts              # 购物车 (添加/修改/计算/持久化)
│   ├── useProduct.ts           # 商品 (详情/列表/搜索/筛选)
│   ├── useOrder.ts             # 订单 (创建/查询/取消/退款)
│   ├── usePrice.ts             # 价格计算 (优惠/运费/税费)
│   ├── useApi.ts               # 统一网络层 (请求/响应/错误)
│   ├── usePagination.ts        # 分页 (无限滚动/页码)
│   ├── useDebounce.ts          # 防抖 (搜索/筛选)
│   ├── useLocalStorage.ts      # 本地存储 (购物车持久化)
│   └── useI18n.ts              # 国际化 (语言切换/格式化)
│
├── stores/                     # Pinia 全局状态 (仅 4 个)
│   ├── auth.store.ts           # 用户认证状态
│   ├── cart.store.ts           # 购物车全局状态
│   ├── product.store.ts        # 商品缓存/筛选状态
│   └── notification.store.ts   # 全局通知队列
│
├── pages/                      # 路由页面 (Nuxt 文件路由)
│   ├── index.vue               # 首页 (推荐/分类/活动)
│   ├── products/
│   │   ├── index.vue           # 商品列表 (筛选/排序/分页)
│   │   └── [slug].vue          # 商品详情 (SSR, SEO 关键页)
│   ├── cart/
│   │   └── index.vue           # 购物车 (CSR, 交互密集)
│   ├── checkout/
│   │   ├── index.vue           # 结算页 (地址/配送/支付)
│   │   └── success.vue         # 支付成功
│   ├── orders/
│   │   ├── index.vue           # 订单列表
│   │   └── [id].vue            # 订单详情
│   ├── account/
│   │   ├── profile.vue         # 个人信息
│   │   ├── addresses.vue       # 地址管理
│   │   └── settings.vue        # 账号设置
│   ├── admin/                  # 商家后台 (CSR, 无需 SEO)
│   │   ├── index.vue           # 后台首页 (数据概览)
│   │   ├── products.vue        # 商品管理
│   │   ├── orders.vue          # 订单管理
│   │   └── analytics.vue       # 数据分析
│   └── [...slug].vue           # 动态路由 (CMS 页面)
│
├── server/                     # 服务端代码 (Nitro)
│   ├── api/                    # API 路由 (代理/中间件)
│   │   ├── auth/
│   │   │   ├── login.post.ts   # 登录代理
│   │   │   └── refresh.post.ts # Token 刷新
│   │   └── search.get.ts       # 搜索代理 (ES 查询)
│   │
│   ├── middleware/             # 服务端中间件
│   │   ├── auth.ts             # Token 验证
│   │   ├── i18n.ts             # 语言检测
│   │   └── rate-limit.ts       # 限流
│   │
│   └── utils/                  # 服务端工具
│       ├── db.ts               # 数据库连接
│       └── cache.ts            # Redis 缓存
│
├── public/                     # 静态资源 (直接复制到 dist)
│   ├── favicon.ico
│   ├── robots.txt              # SEO
│   ├── sitemap.xml             # SEO
│   └── manifest.json           # PWA
│
├── tests/                      # 测试文件
│   ├── unit/                   # 单元测试 (70%)
│   │   ├── usePrice.test.ts    # 价格计算逻辑
│   │   ├── useCart.test.ts     # 购物车逻辑
│   │   └── product-filter.test.ts # 筛选逻辑
│   ├── component/              # 组件测试 (20%)
│   │   ├── ProductCard.test.ts
│   │   ├── CartItem.test.ts
│   │   └── OrderForm.test.ts
│   └── e2e/                    # E2E 测试 (10%)
│       ├── checkout.spec.ts    # 完整下单流程
│       ├── search.spec.ts      # 搜索流程
│       └── auth.spec.ts        # 登录注册流程
│
└── types/                      # TypeScript类型定义
    ├── product.ts              # 商品类型
    ├── cart.ts                 # 购物车类型
    ├── order.ts                # 订单类型
    └── api.ts                  # API 响应类型
```

### 4.5 核心模块详细设计

#### 4.5.1 商品浏览模块 — SSR + SEO 优化

```
设计目标: 商品列表/详情页 SSR 渲染，SEO 友好，首屏 < 1.5s

路由规则 (nuxt.config.ts):
export default defineNuxtConfig({
  routeRules: {
    // 商品列表: 增量静态再生 (ISR)，每 5 分钟更新
    '/products/**': { swr: 300 },
    // 商品详情: ISR，每 10 分钟更新
    '/products/**/*': { swr: 600 },
    // 首页: ISR，每 2 分钟更新
    '/': { swr: 120 },
    // 购物车/订单: 纯 CSR
    '/cart/**': { ssr: false },
    '/checkout/**': { ssr: false },
    '/admin/**': { ssr: false },
  }
})

商品详情页 (SSR 关键路径):
┌─────────────────────────────────────────────────┐
│ 1. Nuxt Server 接收请求                          │
│    ↓                                             │
│ 2. 检查 Redis 缓存 (key: product:{slug})         │
│    ├─ HIT → 直接返回 HTML (TTFB < 50ms)         │
│    └─ MISS → 查询后端 API                        │
│         ↓                                        │
│ 3. 后端 API 返回商品数据 (JSON)                   │
│    ↓                                             │
│ 4. Nuxt 渲染组件树 → HTML                        │
│    ├─ <Head>: meta title/description/OG 标签     │
│    ├─ <Script>: JSON-LD 结构化数据               │
│    ├─ ProductGallery: 首张图片立即加载             │
│    └─ ProductInfo: 价格/库存/操作按钮             │
│         ↓                                        │
│ 5. 返回完整 HTML (含首屏数据)                      │
│    ↓                                             │
│ 6. 浏览器接收 HTML → 立即渲染 (首屏可见)           │
│    ↓                                             │
│ 7. 渐进水合: 仅水合交互组件 (按钮/数量选择器)       │
│    └─ 非交互部分保持静态 HTML (零 JS)              │
└─────────────────────────────────────────────────┘

SEO 关键实现:
// products/[slug].vue
definePageMeta({ ssr: true })

// 动态 SEO 元数据
useSeoMeta({
  title: product.value.name,
  description: product.value.description,
  ogTitle: product.value.name,
  ogImage: product.value.images[0],
  ogType: 'product',
  // 结构化数据 (JSON-LD)
})

useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.value.name,
      image: product.value.images,
      description: product.value.description,
      brand: { '@type': 'Brand', name: product.value.brand },
      offers: {
        '@type': 'Offer',
        price: product.value.price,
        priceCurrency: 'CNY',
        availability: product.value.stock > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock'
      }
    })
  }]
})
```

#### 4.5.2 购物车模块 — 本地持久化 + 服务端同步

```
设计目标: 离线可用，登录/未登录无缝切换，数据不丢失

购物车数据流:
┌─────────────────────────────────────────────────┐
│                                                 │
│  未登录用户:                                     │
│  添加商品 → LocalStorage (即时)                  │
│            → 登录时合并到服务端                   │
│                                                 │
│  已登录用户:                                     │
│  添加商品 → LocalStorage (乐观更新)              │
│            → 后端 API (异步同步)                 │
│            → 失败时回滚 LocalStorage              │
│                                                 │
│  跨设备同步:                                     │
│  登录 → 拉取服务端购物车 → 合并本地              │
│  冲突策略: 服务端优先 (数量取最大)                │
│                                                 │
└─────────────────────────────────────────────────┘

composables/useCart.ts 核心实现:
interface CartItem {
  productId: string
  skuId: string
  name: string
  price: number
  quantity: number
  image: string
  stock: number
}

export function useCart() {
  const auth = useAuth()
  const items = ref<CartItem[]>([])
  const loading = ref(false)

  // 从 LocalStorage 加载
  function loadFromStorage() {
    const saved = localStorage.getItem('cart')
    if (saved) {
      items.value = JSON.parse(saved)
    }
  }

  // 保存到 LocalStorage
  function saveToStorage() {
    localStorage.setItem('cart', JSON.stringify(items.value))
  }

  // 从服务端加载 (登录后)
  async function loadFromServer() {
    if (!auth.isLoggedIn) return
    loading.value = true
    try {
      const serverCart = await useApi<CartItem[]>('/api/cart').execute()
      // 合并策略: 服务端优先，本地多出的商品保留
      const serverIds = new Set(serverCart.value!.map(i => i.skuId))
      const localOnly = items.value.filter(i => !serverIds.has(i.skuId))
      items.value = [...serverCart.value!, ...localOnly]
      saveToStorage()
    } finally {
      loading.value = false
    }
  }

  // 添加商品 (乐观更新)
  function addItem(item: Omit<CartItem, 'quantity'>, qty = 1) {
    const existing = items.value.find(i => i.skuId === item.skuId)
    if (existing) {
      existing.quantity += qty
    } else {
      items.value.push({ ...item, quantity: qty })
    }
    saveToStorage()
    // 异步同步到服务端
    if (auth.isLoggedIn) {
      syncToServer()
    }
  }

  // 计算属性
  const totalItems = computed(() =>
    items.value.reduce((sum, i) => sum + i.quantity, 0)
  )
  const subtotal = computed(() =>
    items.value.reduce((sum, i) => sum + i.price * i.quantity, 0)
  )

  return { items, totalItems, subtotal, addItem, loadFromServer }
}
```

#### 4.5.3 价格计算模块 — 纯函数 + 可测试

```
设计目标: 价格计算逻辑纯函数化，100% 单元测试覆盖

composables/usePrice.ts:
interface PriceRule {
  type: 'discount' | 'coupon' | 'shipping' | 'tax'
  value: number
  condition?: (cart: CartItem[]) => boolean
}

// 纯函数: 输入确定 → 输出确定，无副作用
function calculateDiscount(items: CartItem[], rules: PriceRule[]): number {
  let total = items.reduce((s, i) => s + i.price * i.quantity, 0)

  for (const rule of rules) {
    if (rule.condition && !rule.condition(items)) continue

    switch (rule.type) {
      case 'discount':
        total *= (1 - rule.value / 100)
        break
      case 'coupon':
        total = Math.max(0, total - rule.value)
        break
      case 'shipping':
        total += rule.value
        break
      case 'tax':
        total *= (1 + rule.value / 100)
        break
    }
  }

  return Math.round(total * 100) / 100
}

// 价格展示 (本地化)
function formatPrice(amount: number, locale = 'zh-CN'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2
  }).format(amount)
}

// 单元测试覆盖:
describe('calculateDiscount', () => {
  const cart: CartItem[] = [
    { price: 100, quantity: 2 },
    { price: 50, quantity: 1 }
  ]

  it('无优惠时返回原价', () => {
    expect(calculateDiscount(cart, [])).toBe(250)
  })

  it('8 折优惠', () => {
    const rules: PriceRule[] = [{ type: 'discount', value: 20 }]
    expect(calculateDiscount(cart, rules)).toBe(200)
  })

  it('满减券 (满 200 减 30)', () => {
    const rules: PriceRule[] = [
      { type: 'coupon', value: 30, condition: c => c.reduce((s, i) => s + i.price * i.quantity, 0) >= 200 }
    ]
    expect(calculateDiscount(cart, rules)).toBe(220)
  })

  it('运费 + 税费组合', () => {
    const rules: PriceRule[] = [
      { type: 'shipping', value: 10 },
      { type: 'tax', value: 6 }
    ]
    expect(calculateDiscount(cart, rules)).toBe(286.80)
  })
})
```

#### 4.5.4 统一网络层 — useApi Composable

```
composables/useApi.ts:
interface ApiState<T> {
  data: Ref<T | null>
  loading: Ref<boolean>
  error: Ref<Error | null>
  execute: (options?: RequestInit) => Promise<T | null>
  abort: () => void
}

export function useApi<T>(
  url: string | (() => string),
  options?: {
    method?: string
    headers?: Record<string, string>
    retry?: number
    timeout?: number
    cache?: boolean
    errorHandler?: (error: Error) => void
  }
): ApiState<T> {
  const data = ref<T | null>(null) as Ref<T | null>
  const loading = ref(false)
  const error = ref<Error | null>(null)
  let controller: AbortController | null = null

  async function execute(execOptions?: RequestInit): Promise<T | null> {
    const resolvedUrl = typeof url === 'function' ? url() : url
    controller = new AbortController()
    loading.value = true
    error.value = null

    const retries = options?.retry ?? 0
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const timeout = options?.timeout ?? 10000
        const timeoutController = new AbortController()
        setTimeout(() => timeoutController.abort(), timeout)

        const response = await $fetch(resolvedUrl, {
          method: options?.method ?? 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
            ...(useAuth().token ? { Authorization: `Bearer ${useAuth().token}` } : {})
          },
          signal: AbortSignal.any([controller.signal, timeoutController.signal]),
          ...execOptions
        })

        data.value = response as T
        return data.value
      } catch (e) {
        if (attempt === retries) {
          const apiError = e instanceof Error ? e : new Error(String(e))
          error.value = apiError
          options?.errorHandler?.(apiError)
          // 统一错误上报
          if (apiError.message.includes('401')) {
            useAuth().redirectLogin()
          }
          return null
        }
        // 指数退避重试
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
      }
    }
    return null
  }

  function abort() {
    controller?.abort()
  }

  return { data, loading, error, execute, abort }
}
```

### 4.6 性能优化策略

```
性能目标:
┌─────────────────────────────────────────────────┐
│  LCP (Largest Contentful Paint)  < 2.5s         │
│  FID (First Input Delay)       < 100ms          │
│  CLS (Cumulative Layout Shift)  < 0.1           │
│  TTI (Time to Interactive)     < 3.5s           │
│  首屏 JS 总量                   < 150KB (gzip)   │
└─────────────────────────────────────────────────┘

优化策略:

1. 渲染策略分层
   • 商品列表/详情: SSR + ISR (首屏 HTML 直出)
   • 购物车/订单: CSR (交互密集，SSR 价值低)
   • 商家后台: CSR (无需 SEO，内部使用)

2. 代码分割
   • 路由级: 每个页面独立 chunk (Vite 自动)
   • 组件级: 重型组件动态 import (图表/编辑器)
   • 第三方库: 按需导入 (echarts 按需加载)

3. 图片优化
   • WebP/AVIF 格式 (自动转换)
   • 响应式图片 (srcset + sizes)
   • 懒加载 (loading="lazy")
   • 首屏图片预加载 (priority)

4. 缓存策略
   • 静态资源: 强缓存 (ContentHash 文件名)
   • API 数据: SWR (Stale-While-Revalidate)
   • 商品详情: Redis 缓存 (TTL 10min)
   • 搜索结果: Redis 缓存 (TTL 5min)

5. 字体优化
   • 仅加载需要的字重 (400/500/700)
   • font-display: swap (避免 FOIT)
   • 子集化 (仅中文字符集)

6. 关键 CSS 内联
   • 首屏关键样式内联到 HTML
   • 非关键样式异步加载
   • 消除渲染阻塞 CSS
```

### 4.7 安全策略

```
┌─────────────────────────────────────────────────┐
│ 安全层级                                         │
├─────────────────────────────────────────────────┤
│ L1: 输入验证 (前端 + 后端双重)                    │
│   • 表单验证 (类型/长度/格式)                     │
│   • XSS 防护 (Vue 自动转义 + DOMPurify)          │
│   • SQL 注入防护 (参数化查询)                     │
├─────────────────────────────────────────────────┤
│ L2: 认证授权                                     │
│   • JWT Access Token (15min 过期)                │
│   • Refresh Token (7天，HttpOnly Cookie)         │
│   • RBAC 权限控制 (用户/商家/管理员)              │
│   • 敏感操作二次验证 (支付/修改密码)               │
├─────────────────────────────────────────────────┤
│ L3: 传输安全                                     │
│   • HTTPS 强制 (HSTS)                            │
│   • TLS 1.3                                      │
│   • CSP 头 (阻止内联脚本)                         │
│   • CORS 白名单                                  │
├─────────────────────────────────────────────────┤
│ L4: 数据安全                                     │
│   • 密码 bcrypt 哈希                             │
│   • 支付信息 PCI DSS 合规                        │
│   • 敏感数据加密存储                              │
│   • 审计日志 (操作追踪)                           │
├─────────────────────────────────────────────────┤
│ L5: 运行时安全                                   │
│   • 依赖漏洞扫描 (npm audit in CI)               │
│   • 速率限制 (API Gateway)                       │
│   • 异常监控 (Sentry)                            │
│   • DDoS 防护 (Cloudflare)                       │
└─────────────────────────────────────────────────┘
```

### 4.8 部署与 CI/CD

```
CI/CD 流水线:

┌─────────────────────────────────────────────────────────────┐
│                    Git Push (main 分支)                      │
│                            ↓                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Stage 1: 质量检查                                    │    │
│  │ • ESLint + Prettier (代码规范)                       │    │
│  │ • TypeScript类型检查                                │    │
│  │• npm audit (安全扫描)                                │    │
│  │ • 单元测试 (覆盖率 ≥ 70%)                            │    │
│  └─────────────────────────────────────────────────────┘    │
│                            ↓                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Stage 2: 构建                                        │    │
│  │ • Vite 构建 (生产优化)                               │    │
│  │ • 构建产物分析 (bundle-phobia)                       │    │
│  │ • vendor.js < 300KB (gzip) 检查                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                            ↓                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Stage 3: 集成测试                                    │    │
│  │ • 组件测试 (Testing Library)                         │    │
│  │ • E2E 测试 (Playwright — 关键流程)                   │    │
│  │ • Lighthouse CI (性能 ≥ 90)                          │    │
│  └─────────────────────────────────────────────────────┘    │
│                            ↓                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Stage 4: 部署                                        │    │
│  │ • Staging 环境 (自动)                                │    │
│  │ • 人工审批 → Production                              │    │
│  │ • Vercel 自动部署 (前端)                             │    │
│  │ • 灰度发布 (10% → 50% → 100%)                        │    │
│  └─────────────────────────────────────────────────────┘    │
│                            ↓                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Stage 5: 监控                                        │    │
│  │ • Sentry 错误监控                                    │    │
│  │ • Web Vitals 实时监控                                │    │
│  │ • 业务指标 (转化率/订单量)                            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 4.9 团队分工与里程碑

```
团队分工 (12 人前端):
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  商品组 (3 人): 商品列表/详情/搜索/筛选/推荐                  │
│  交易组 (3 人): 购物车/订单/支付/物流                         │
│  用户组 (2 人): 注册/登录/个人中心/地址                       │
│  后台组 (2 人): 商家后台/数据分析/商品管理                    │
│  基础组 (2 人): 组件库/网络层/构建优化/测试基础设施             │
│                                                             │
└─────────────────────────────────────────────────────────────┘

里程碑 (4 个月):
┌──────┬─────────────────────────────────────────────────────┐
│ 周次  │ 交付内容                                           │
├──────┼─────────────────────────────────────────────────────┤
│ W1-2 │ 项目脚手架 + 设计系统 + 基础组件库                   │
│ W3-4 │ 用户模块 (注册/登录/个人中心)                        │
│ W5-7 │ 商品模块 (列表/详情/搜索/筛选)                       │
│ W8-9 │ 购物车模块 (本地持久化 + 服务端同步)                  │
│ W10-11│ 订单/支付模块 (下单/支付/退款)                       │
│ W12  │ 商家后台 (商品管理/订单管理)                         │
│ W13  │ 性能优化 + SEO + 国际化                             │
│ W14  │ E2E 测试 + 安全审计 + 上线                          │
│ W15-16│ 缓冲 + 监控 + 迭代优化                              │
└──────┴─────────────────────────────────────────────────────┘
```

---

## 五、架构模式全景对比

### 5.1 十轮训练总结 — 架构模式演进

```
┌──────┬─────────────────────────────────────────────────────────────┐
│ 轮次  │ 核心内容                                                   │
├──────┼─────────────────────────────────────────────────────────────┤
│ v1   │ MVC/MVVM 基础 — 数据流/双向绑定/组件化                      │
│ v2   │ 微前端 — qiankun/Single-SPA/Module Federation               │
│ v3   │ 企业级融合 — 微前端 + MVVM + 状态管理                       │
│ v4   │ 最终章 — 综合架构设计                                        │
│ v5   │ Composition 模式 — 逻辑复用/Composable/组合式架构            │
│ v6   │ 数据流架构 — Redux/Pinia/事件驱动/CQRS                       │
│ v7   │ 架构决策 — 选型框架/ADR/权衡分析                              │
│ v8   │ 企业级融合 — 微前端 + SSR + 性能优化                         │
│ v9   │ 2026 新范式 — RSC/Server Actions/Edge/CRDT/Islands/AI-Native│
│ v10  │ 架构决策与迁移 — 决策模型/迁移策略/反模式/电商完整架构         │
└──────┴─────────────────────────────────────────────────────────────┘

累计产出: ~1.2MB+ 架构文档 / 10 轮迭代 / 完整应用架构 × 3 (CloudBoard/TeamSync/ShopVerse)
```

### 5.2 架构模式选择速查表

```
┌──────────────────┬──────────────┬──────────────┬─────────────┐
│ 项目特征          │ 推荐架构      │ 技术栈        │ 适用轮次    │
├──────────────────┼──────────────┼──────────────┼─────────────┤
│ 简单 CRUD 应用    │ MVC          │ Vue 3 + Router│ v1         │
│ 中等复杂度 SaaS   │ MVVM + Pinia │ Vue 3 + Pinia │ v1/v5      │
│ 多团队 (>20 人)   │ 微前端       │ qiankun + MF │ v2/v3      │
│ SEO 敏感内容站    │ Islands      │ Astro        │ v9         │
│ 企业后台 + 前端   │ SSR + CSR    │ Nuxt 3       │ v10        │
│ 实时协作          │ CRDT + MVVM  │ Yjs + Vue 3  │ v9         │
│ 全球用户          │ Edge-first   │ Cloudflare   │ v9         │
│ AI 核心功能       │ AI-Native    │ Agent Layer  │ v9         │
│ 电商/交易平台     │ SSR + Pinia  │ Nuxt 3       │ v10        │
│ 遗留系统迁移      │ Strangler Fig│ Proxy Layer  │ v10        │
└──────────────────┴──────────────┴──────────────┴─────────────┘
```

---

## 六、关键收获

### 6.1 架构决策的核心原则

1. **业务驱动，非技术驱动** — 架构服务于业务目标，不是技术秀
2. **团队能力 > 技术流行度** — 再好的架构，团队用不起来也是零
3. **渐进式演进** — 没有完美的初始架构，只有持续演进的架构
4. **记录决策理由** — ADR 是团队知识传承的关键
5. **反模式意识** — 知道什么不该做，比知道什么该做更重要

### 6.2 迁移的核心原则

1. **绞杀者植物模式** — 最安全的迁移策略，逐步替换
2. **可回滚设计** — 每次迁移必须可回滚
3. **监控先行** — 迁移前建立性能基准和监控
4. **灰度发布** — 10% → 50% → 100%，每步验证
5. **沟通透明** — 业务方/团队/用户同步信息

### 6.3 ShopVerse 架构亮点

1. **混合渲染策略** — SSR (SEO 页) + CSR (交互页)，各取所长
2. **购物车双写** — LocalStorage 即时响应 + 服务端持久化
3. **纯函数价格计算** — 100% 可测试，零副作用
4. **统一网络层** — 一次封装，全局复用，错误统一处理
5. **预留微前端接口** — 当前单体，团队增长后可平滑拆分
6. **测试金字塔** — 70% 单元 / 20% 集成 / 10% E2E，投入产出比最优

---

*专项训练 v10 完成。累计 10 轮迭代，~1.2MB+ 架构文档，3 个完整应用架构设计。*
