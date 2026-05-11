# 🏗️ 前端架构设计专项训练 v9 — 2026 现代架构模式 + 实时协作应用完整架构

**时间：** 2026-05-05 18:00  
**主题：** 后 MVVM 时代架构模式 / 实时协作架构 / Edge-first 架构 / 完整 "TeamSync" 应用从零设计  
**前置：** 4/22-5/2 共 8 轮架构训练（MVC/MVVM/微前端/Composition/企业级融合）  
**本次新增：** 2025-2026 新兴架构模式 / CRDT 实时协作 / Edge-first 渲染 / Server Actions / 完整 TeamSync 应用架构

---

## 一、2025-2026 前端架构新范式

### 1.1 架构模式演进时间线（2020-2026）

```
2020: React Hooks 革命 → 逻辑复用从 HOC/Render Props → Custom Hooks
2021: Vue 3 Composition API → 选项式 → 函数式架构
2022: Svelte 编译时 → 运行时框架 → 编译时框架
2023: React Server Components → 服务端/客户端边界重构
2024: Server Actions / Progressive Enhancement → SSR 2.0
2025: Edge-first Architecture → CDN 即服务器
2026: AI-Native Architecture → AI Agent 作为一等公民
```

### 1.2 六种 2025+ 新兴架构模式

#### 模式 1: Server Components Architecture (RSC)

```
传统 CSR 架构:
  浏览器 → 下载 JS Bundle → 执行 → 请求 API → 渲染
  问题: 首屏慢 / 水合开销大 / SEO 差

RSC 架构:
  浏览器 → 请求页面 → Server 渲染组件树 → 返回 RSC Payload → 水合交互部分
  优势: 零 JS 的静态组件 / 直接访问后端 / 渐进水合

┌─────────────────────────────────────────────────────────────┐
│                    浏览器 (Client)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Client Comp │  │ Client Comp │  │ Client Comp │         │
│  │ (交互部分)   │  │ (交互部分)   │  │ (交互部分)   │         │
│  │ hydration   │  │ hydration   │  │ hydration   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    RSC Payload (流式传输)                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ HTML fragments + Component tree + Props diff        │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                    Server (RSC)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Server Comp │  │ Server Comp │  │ Server Comp │         │
│  │ (零 JS)     │  │ (零 JS)     │  │ (零 JS)     │         │
│  │ 直接读 DB   │  │ 直接读 FS   │  │ 调用 API    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘

关键规则:
- Server Component 默认，Client Component 用 "use client" 标注
- Server → Client 只能传可序列化数据 (JSON)
- Client 不能 import Server Component（编译时检查）
```

#### 模式 2: Server Actions

```
传统表单提交流:
  表单 → 客户端拦截 → fetch API → 服务端处理 → 返回 JSON → 客户端更新 UI

Server Actions 流:
  表单 → 服务端函数执行 → 返回新状态 → 自动 revalidate

// app/actions.ts — 服务端函数，客户端可调用
"use server"

export async function createTask(formData: FormData) {
  const title = formData.get("title")
  const projectId = formData.get("projectId")

  // 直接访问数据库，无需 API 路由
  const task = await db.task.create({
    data: { title, projectId }
  })

  // 自动重新验证相关数据
  revalidateTag("tasks")

  return { success: true, task }
}

// app/page.tsx — 客户端使用
<form action={createTask}>
  <input name="title" />
  <button type="submit">创建</button>
</form>

// 或使用 useFormState 获取状态
const [state, formAction] = useFormState(createTask, { success: false })
```

#### 模式 3: Edge-first Architecture

```
传统架构:
  用户 → CDN → Origin Server (单区域) → Database
  问题: 跨洋延迟 100-300ms

Edge-first 架构:
  用户 → Edge Node (就近) → 本地 Cache / 本地计算
         ↓ (miss)
         Edge Node (就近) → Origin (仅数据同步)
         ↓
       Database (边缘同步)

┌─────────────────────────────────────────────────────────────┐
│                    Edge Network (全球 300+ 节点)              │
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ 北京节点 │ │ 上海节点 │ │ 东京节点 │ │ 新加坡  │          │
│  │         │ │         │ │         │ │ 节点    │          │
│  │ • 渲染  │ │ • 渲染  │ │ • 渲染  │ │ • 渲染  │          │
│  │ • 缓存  │ │ • 缓存  │ │ • 缓存  │ │ • 缓存  │          │
│  │ • 鉴权  │ │ • 鉴权  │ │ • 鉴权  │ │ • 鉴权  │          │
│  │ • A/B   │ │ • A/B   │ │ • A/B   │ │ • A/B   │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│                                                             │
│                    ↓ 边缘同步 ↓                               │
│                                                             │
│              ┌─────────────────────────┐                    │
│              │    Origin (主区域)       │                    │
│              │  • 写操作               │                    │
│              │  • 复杂计算             │                    │
│              │  • 数据库主节点          │                    │
│              └─────────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘

Edge-first 适用场景:
✅ 国际化应用 (全球用户)
✅ 个性化内容 (A/B 测试 / 地域化)
✅ 实时性要求高 (延迟 < 50ms)
✅ 静态/半静态内容 (SSG + ISR)

Edge-first 不适用:
❌ 强一致性写操作 (需要事务)
❌ 计算密集型 (Edge 资源有限)
❌ 需要本地 GPU/硬件加速
```

#### 模式 4: CRDT-based Real-time Architecture

```
传统实时协作 (Operational Transform):
  问题: 中心化协调 / 冲突解决复杂 / 离线支持差

CRDT (Conflict-free Replicated Data Type):
  核心: 数学保证最终一致性，无需中心化协调

┌─────────────────────────────────────────────────────────────┐
│                    CRDT 协作架构                              │
│                                                             │
│  ┌──────────┐    WebSocket     ┌──────────┐                 │
│  │ 用户 A    │ ◄──────────────► │ 用户 B    │                 │
│  │ (离线也可) │   P2P / Server  │ (离线也可) │                 │
│  └────┬─────┘                  └────┬─────┘                 │
│       │                             │                        │
│       ▼                             ▼                        │
│  ┌─────────────────────────────────────────┐                │
│  │         Local CRDT State (Yjs/Automerge) │                │
│  │  • Y.Array — 有序集合 (文档编辑)          │                │
│  │  • Y.Map — 键值对 (对象属性)              │                │
│  │  • Y.Text — 富文本 (协同编辑)             │                │
│  │  • Y.XmlFragment — XML/HTML 树           │                │
│  └─────────────────────────────────────────┘                │
│                                                             │
│  数学保证:                                                   │
│  • 交换律: merge(A, B) = merge(B, A)                        │
│  • 结合律: merge(merge(A,B), C) = merge(A, merge(B,C))      │
│  • 幂等性: merge(A, A) = A                                   │
│  → 任意顺序合并，结果一致                                     │
└─────────────────────────────────────────────────────────────┘

CRDT vs OT 对比:

┌──────────────┬──────────────────┬──────────────────┐
│   特性       │   CRDT           │   OT             │
├──────────────┼──────────────────┼──────────────────┤
│ 中心化协调    │ ❌ 不需要         │ ✅ 需要服务器     │
│ 离线编辑      │ ✅ 天然支持       │ ⚠️ 需要重放       │
│ 冲突解决      │ ✅ 数学保证       │ ⚠️ 算法复杂      │
│ 数据大小      │ ⚠️ 元数据较大     │ ✅ 操作小         │
│ 实现复杂度    │ ⚠️ 中等           │ ❌ 高            │
│ 代表项目      │ Yjs / Automerge  │ ShareJS / Etherpad│
└──────────────┴──────────────────┴──────────────────┘
```

#### 模式 5: Islands + Partial Hydration

```
传统 SPA:
  下载整个 JS Bundle → 水合整个页面 → 交互
  问题: 首屏慢 / 不必要的 JS 执行

Islands Architecture:
  服务器渲染 HTML → 仅水合交互组件 ("岛屿") → 其余保持静态
  优势: 极快首屏 / 按需 JS / SEO 友好

┌─────────────────────────────────────────────────────────────┐
│                    Islands 架构                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Header (静态 HTML — 零 JS)                          │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │  Hero Section (静态 HTML — 零 JS)                    │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │ 🏝️ Interactive Search (水合 — 仅 12KB)     │    │    │
│  │  │  autocomplete + filters + results           │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │  Blog Content (静态 HTML — 零 JS)                   │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │ 🏝️ Comment Section (水合 — 仅 8KB)         │    │    │
│  │  │  form + list + submit                       │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │  Footer (静态 HTML — 零 JS)                         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  总 JS: ~20KB (vs 传统 SPA 的 200KB+)                       │
│  首屏: < 1s (vs 传统 SPA 的 3-5s)                          │
└─────────────────────────────────────────────────────────────┘

Astro / Fresh / Marko 实现 Islands:
- 默认静态 HTML
- 客户端指令: client:load / client:visible / client:only
- 支持多框架混用 (React/Vue/Svelte 组件共存)
```

#### 模式 6: AI-Native Architecture

```
传统应用: 用户 → UI → API → 后端 → 数据库

AI-Native 应用: 用户 → UI → AI Agent → 工具调用 → 后端/数据库/外部服务

┌─────────────────────────────────────────────────────────────┐
│                    AI-Native 架构层                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  L1: AI Orchestration Layer (AI 编排层)              │    │
│  │  • Agent Router (选择最佳 Agent)                     │    │
│  │  • Tool Registry (工具注册与发现)                    │    │
│  │  • Context Manager (对话上下文管理)                   │    │
│  │  • Safety Guard (安全护栏)                           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  L2: Agent Layer (智能体层)                          │    │
│  │  • Task Agent (任务分解与规划)                       │    │
│  │  • Search Agent (信息检索)                           │    │
│  │  • Code Agent (代码生成与审查)                       │    │
│  │  • Data Agent (数据分析与可视化)                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  L3: Tool Layer (工具层)                             │    │
│  │  • MCP (Model Context Protocol) 工具                 │    │
│  │  • API 适配器                                        │    │
│  │  • 数据库查询器                                      │    │
│  │  • 文件操作器                                        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  L4: Infrastructure (基础设施层)                      │    │
│  │  • Vector DB (向量检索)                              │    │
│  │  • LLM Gateway (模型路由/降级/缓存)                   │    │
│  │  • Prompt Store (提示词管理)                         │    │
│  │  • Evaluation (输出评估)                             │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

关键设计原则:
1. AI 是一等公民，不是附加功能
2. 人类始终在环 (Human-in-the-loop) — AI 建议，人类决策
3. 可解释性 — 每个 AI 输出附带推理链
4. 降级策略 — AI 不可用时优雅降级到传统交互
```

---

## 二、架构模式选择决策框架 v2 (2026 版)

### 2.1 现代架构选型矩阵

```
┌─────────────────┬──────────┬──────────┬──────────┬──────────┐
│   场景          │  推荐    │  备选    │  复杂度  │  成熟度  │
├─────────────────┼──────────┼──────────┼──────────┼──────────┤
│ 内容站/博客     │ Islands  │ SSG      │ ★★☆     │ ★★★★★   │
│                 │ (Astro)  │ (Next.js)│         │          │
├─────────────────┼──────────┼──────────┼──────────┼──────────┤
│ 企业后台/SaaS   │ RSC +    │ MVVM +   │ ★★★★    │ ★★★★    │
│                 │ Server   │ Pinia    │         │          │
│                 │ Actions  │          │         │          │
├─────────────────┼──────────┼──────────┼──────────┼──────────┤
│ 实时协作工具    │ CRDT +   │ OT +     │ ★★★★★   │ ★★★     │
│                 │ MVVM     │ WebSocket│         │          │
├─────────────────┼──────────┼──────────┼──────────┼──────────┤
│ 国际化应用      │ Edge-    │ SSR +    │ ★★★★    │ ★★★★    │
│                 │ first    │ CDN      │         │          │
├─────────────────┼──────────┼──────────┼──────────┼──────────┤
│ AI 应用         │ AI-      │ 传统     │ ★★★★★   │ ★★★     │
│                 │ Native   │ + API    │         │          │
├─────────────────┼──────────┼──────────┼──────────┼──────────┤
│ 超大型平台      │ 微前端 + │ Monorepo │ ★★★★★   │ ★★★★    │
│ (多团队)        │ RSC      │ + MF     │         │          │
├─────────────────┼──────────┼──────────┼──────────┼──────────┤
│ 快速原型/MVP    │ MVVM     │ MVC      │ ★★☆     │ ★★★★★   │
│                 │ (Vue3)   │          │         │          │
└─────────────────┴──────────┴──────────┴──────────┴──────────┘
```

### 2.2 架构决策 checklist (2026)

```
□ 数据一致性要求？
  ├─ 强一致 → 中心化架构 (RSC / MVVM + Store)
  └─ 最终一致 → CRDT / Edge-first

□ 离线需求？
  ├─ 需要离线 → CRDT + Service Worker
  └─ 在线即可 → 传统架构

□ 全球用户？
  ├─ 是 → Edge-first + 边缘缓存
  └─ 否 → 单区域 SSR

□ AI 功能？
  ├─ 核心功能 → AI-Native 架构
  └─ 附加功能 → API 调用

□ 团队规模？
  ├─ 1-5 人 → 单体 (Vite + Vue3/Next.js)
  ├─ 5-20 人 → Monorepo + 清晰边界
  └─ 20+ 人 → 微前端

□ SEO 要求？
  ├─ 高 → Islands / RSC / SSG
  └─ 低 → CSR / MVVM

□ 实时协作？
  ├─ 需要 → CRDT (Yjs) + WebSocket
  └─ 不需要 → 传统数据流
```

---

## 三、完整应用架构设计 — TeamSync 实时协作平台

### 3.1 产品定义

```
TeamSync — 开发者实时协作平台

核心功能:
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  📝 实时文档    — Markdown 协同编辑 (CRDT)                │
│  💬 团队聊天    — 频道/私聊/文件分享                       │
│  📋 任务看板    — 拖拽看板/任务分配/状态跟踪               │
│  📊 数据面板    — 项目指标/燃尽图/质量报告                 │
│  🔔 通知中心    — @提及/任务变更/系统通知                  │
│  🤖 AI 助手     — 文档摘要/代码审查/任务建议              │
│                                                          │
│  目标用户: 10-200 人研发团队                               │
│  并发编辑: 支持 50+ 人同时编辑同一文档                     │
│  离线支持: 文档编辑支持离线，联网后自动同步                 │
│  全球部署: 亚太/欧洲/北美三区域                            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 3.2 架构决策记录 (ADR)

```
ADR-01: 前端框架 — Vue 3 + TypeScript
  理由: 团队 Vue 经验丰富 / Composition API 适合复杂状态
  备选: React (团队不熟悉) / Svelte (生态较小)

ADR-02: 渲染策略 — Islands + 渐进水合
  理由: 内容密集型 (文档/看板) + 交互岛屿 (编辑器/聊天)
  备选: 全 CSR (首屏慢) / 全 SSR (水合开销大)

ADR-03: 实时协作 — CRDT (Yjs) + WebSocket
  理由: 离线支持 / 数学保证一致性 / 50+ 并发
  备选: OT (ShareJS) — 离线支持差 / 中心化协调

ADR-04: 状态管理 — Pinia (全局) + Composable (局部)
  理由: 轻量 / TS 友好 / DevTools
  备选: Vuex (过重) / Zustand (Vue 生态弱)

ADR-05: AI 架构 — AI-Native (Agent 层)
  理由: AI 助手是核心功能，非附加
  备选: 简单 API 调用 — 不够灵活

ADR-06: 部署 — Edge-first (Cloudflare Workers) + Origin
  理由: 全球用户 / 低延迟 / 边缘计算
  备选: 单区域部署 — 跨洋延迟高

ADR-07: 微前端 — Monorepo (否)
  理由: 团队 < 20 人，单体足够
  备选: Module Federation — 过度工程
```

### 3.3 全景架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         用户层 (Browser / Mobile)                        │
│                                                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│  │ 🏝️ 文档编辑器│ │ 🏝️ 聊天面板 │ │ 🏝️ 任务看板 │ │ 🏝️ AI 助手  │      │
│  │ (水合 28KB) │ │ (水合 15KB) │ │ (水合 12KB) │ │ (水合 20KB) │      │
│  │ CRDT 本地   │ │ WebSocket   │ │ Pinia Store │ │ Agent 调用  │      │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘      │
│         │               │               │               │              │
│  ┌──────┴───────────────┴───────────────┴───────────────┴──────┐      │
│  │              Vue 3 App Shell (6KB, 仅路由 + 布局)            │      │
│  │  • Router (Vue Router 4)                                    │      │
│  │  • Layout (Sidebar + Header + Content)                      │      │
│  │  • Theme (CSS Variables + prefers-color-scheme)             │      │
│  └──────────────────────────────┬───────────────────────────────┘      │
├─────────────────────────────────┼──────────────────────────────────────┤
│                    Edge Network (Cloudflare Workers)                    │
│                                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                   │
│  │ 亚太节点      │ │ 欧洲节点      │ │ 北美节点      │                   │
│  │ (上海/东京)   │ │ (法兰克福)    │ │ (弗吉尼亚)   │                   │
│  │              │ │              │ │              │                   │
│  │ • SSR 渲染   │ │ • SSR 渲染   │ │ • SSR 渲染   │                   │
│  │ • 边缘缓存   │ │ • 边缘缓存   │ │ • 边缘缓存   │                   │
│  │ • 鉴权 JWT   │ │ • 鉴权 JWT   │ │ • 鉴权 JWT   │                   │
│  │ • A/B 测试   │ │ • A/B 测试   │ │ • A/B 测试   │                   │
│  │ • 速率限制   │ │ • 速率限制   │ │ • 速率限制   │                   │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘                   │
│         │                │                │                            │
│  ┌──────┴────────────────┴────────────────┴──────┐                    │
│  │          Edge Router (请求路由 + 负载均衡)       │                    │
│  └────────────────────────┬───────────────────────┘                    │
├───────────────────────────┼───────────────────────────────────────────┤
│                    Origin Layer (主区域)                                │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │              API Gateway (Kong / Cloudflare API)             │       │
│  │  • 认证 / 限流 / 日志 / 熔断                                │       │
│  └────────────────────────┬────────────────────────────────────┘       │
│                           │                                            │
│  ┌────────┐ ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │用户服务 │ │文档服务    │ │消息服务  │ │任务服务  │ │AI 服务   │    │
│  │(Node.js)│ │(Node.js)   │ │(Node.js) │ │(Node.js) │ │(Python)  │    │
│  │        │ │            │ │          │ │          │ │          │    │
│  │• 认证  │ │• CRUD     │ │• 频道    │ │• 看板    │ │• 摘要    │    │
│  │• 权限  │ │• 版本历史 │ │• 私聊    │ │• 分配    │ │• 建议    │    │
│  │• 组织  │ │• CRDT同步 │ │• 文件    │ │• 状态    │ │• 代码审查│    │
│  └───┬────┘ └─────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘    │
│      │            │            │            │            │           │
│  ┌───┴────────────┴────────────┴────────────┴────────────┴──────┐    │
│  │                    数据层                                     │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │    │
│  │  │ PostgreSQL│ │  Redis   │ │ MongoDB  │ │Vector DB │       │    │
│  │  │ (关系数据)│ │ (缓存/   │ │ (文档/   │ │ (AI 嵌入)│       │    │
│  │  │           │ │  会话)   │ │  消息)   │ │          │       │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │    │
│  │  ┌──────────┐ ┌──────────┐                                 │    │
│  │  │ S3/MinIO │ │ CRDT     │                                 │    │
│  │  │ (文件存储)│ │ 持久化   │                                 │    │
│  │  └──────────┘ └──────────┘                                 │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.4 前端目录结构

```
teamsync-frontend/
├── src/
│   ├── app/                          # 应用壳 (Vue Router)
│   │   ├── App.vue                   # 根组件 (Layout 组合)
│   │   ├── router.ts                 # 路由配置 + 导航守卫
│   │   └── providers.ts              # 全局 Provider (Theme/Auth)
│   │
│   ├── features/                     # 功能模块 (Islands)
│   │   ├── document-editor/          # 🏝️ 实时文档编辑器
│   │   │   ├── DocumentEditor.vue    # 主岛屿组件
│   │   │   ├── toolbar/              # 工具栏子组件
│   │   │   ├── outline/              # 大纲导航
│   │   │   ├── useCRDT.ts            # CRDT 同步 Composable
│   │   │   ├── useCollaboration.ts   # 协作状态 Composable
│   │   │   └── types.ts              # 编辑器类型定义
│   │   │
│   │   ├── chat/                     # 🏝️ 团队聊天
│   │   │   ├── ChatPanel.vue         # 主岛屿组件
│   │   │   ├── ChannelList.vue       # 频道列表
│   │   │   ├── MessageList.vue       # 消息列表
│   │   │   ├── MessageInput.vue      # 消息输入
│   │   │   ├── useWebSocket.ts       # WebSocket Composable
│   │   │   └── useChatStore.ts       # Pinia Store
│   │   │
│   │   ├── kanban/                   # 🏝️ 任务看板
│   │   │   ├── KanbanBoard.vue       # 主岛屿组件
│   │   │   ├── Column.vue            # 列组件
│   │   │   ├── TaskCard.vue          # 任务卡片
│   │   │   ├── useDragDrop.ts        # 拖拽 Composable
│   │   │   └── useKanbanStore.ts     # Pinia Store
│   │   │
│   │   └── ai-assistant/             # 🏝️ AI 助手
│   │       ├── AIAssistant.vue       # 主岛屿组件
│   │       ├── ChatBubble.vue        # 对话气泡
│   │       ├── useAIAgent.ts         # AI Agent Composable
│   │       └── tools/                # AI 工具定义
│   │           ├── searchTool.ts
│   │           ├── codeReviewTool.ts
│   │           └── summarizeTool.ts
│   │
│   ├── shared/                       # 共享层
│   │   ├── components/               # 通用 UI 组件
│   │   │   ├── Button.vue
│   │   │   ├── Modal.vue
│   │   │   ├── Toast.vue
│   │   │   └── Avatar.vue
│   │   │
│   │   ├── composables/              # 通用 Composables
│   │   │   ├── useAuth.ts            # 认证状态
│   │   │   ├── useTheme.ts           # 主题切换
│   │   │   ├── useDebounce.ts        # 防抖
│   │   │   ├── useOnline.ts          # 在线状态
│   │   │   └── usePermissions.ts     # 权限检查
│   │   │
│   │   ├── lib/                      # 工具库
│   │   │   ├── api.ts                # API 客户端 (Fetch wrapper)
│   │   │   ├── crdt.ts               # Yjs 配置
│   │   │   ├── websocket.ts          # WebSocket 管理器
│   │   │   └── storage.ts            # IndexedDB 离线存储
│   │   │
│   │   ├── types/                    # 全局类型定义
│   │   │   ├── user.ts
│   │   │   ├── document.ts
│   │   │   ├── message.ts
│   │   │   └── task.ts
│   │   │
│   │   └── utils/                    # 纯函数工具
│   │       ├── format.ts
│   │       ├── validate.ts
│   │       └── date.ts
│   │
│   ├── layouts/                      # 布局组件
│   │   ├── MainLayout.vue            # 主布局 (Sidebar + Content)
│   │   ├── AuthLayout.vue            # 认证布局
│   │   └── DashboardLayout.vue       # 面板布局
│   │
│   ├── pages/                        # 页面 (组合 Islands)
│   │   ├── home/
│   │   │   └── HomePage.vue
│   │   ├── documents/
│   │   │   ├── DocumentListPage.vue
│   │   │   └── DocumentEditPage.vue
│   │   ├── chat/
│   │   │   └── ChatPage.vue
│   │   └── projects/
│   │       └── KanbanPage.vue
│   │
│   └── stores/                       # 全局 Pinia Stores
│       ├── auth.store.ts             # 认证状态
│       ├── ui.store.ts               # UI 状态 (sidebar/theme)
│       └── notification.store.ts     # 通知中心
│
├── edge/                             # Edge Functions
│   ├── render.ts                     # 边缘 SSR
│   ├── auth.ts                       # 边缘鉴权
│   └── cache.ts                      # 边缘缓存策略
│
├── public/
│   └── sw.js                         # Service Worker (离线)
│
├── tests/
│   ├── unit/                         # Vitest 单元测试
│   ├── integration/                  # 组件集成测试
│   └── e2e/                          # Playwright E2E
│
├── package.json
├── vite.config.ts
├── tsconfig.json
└── astro.config.ts                   # Islands 配置
```

### 3.5 核心 Composable 实现

#### useCRDT — CRDT 文档同步

```typescript
// features/document-editor/useCRDT.ts

import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { indexeddbProvider } from 'y-indexeddb'
import { ref, computed, onUnmounted } from 'vue'

interface CRDTState {
  doc: Y.Doc
  text: Y.Text
  provider: WebsocketProvider
  isSynced: ReturnType<typeof ref<boolean>>
  awareness: any
  users: ReturnType<typeof ref<Array<{ id: string; name: string; color: string }>>>
}

export function useCRDT(documentId: string) {
  const doc = new Y.Doc()
  const text = doc.getText('content')

  // 状态
  const isSynced = ref(false)
  const users = ref<Array<{ id: string; name: string; color: string }>>([])
  const isOffline = ref(false)

  // IndexedDB 持久化 — 离线支持
  const indexeddb = indexeddbProvider(doc, `teamsync-doc-${documentId}`)
  indexeddb.whenSynced.then(() => {
    isSynced.value = true
  })

  // WebSocket 提供者 — 实时同步
  const provider = new WebsocketProvider(
    import.meta.env.VITE_WS_URL,
    `doc-${documentId}`,
    doc
  )

  // 连接状态
  provider.on('status', ({ status }: { status: string }) => {
    isOffline.value = status === 'disconnected'
  })

  // 协作者感知
  const awareness = provider.awareness
  awareness.on('change', () => {
    users.value = Array.from(awareness.getStates().values())
      .filter((state: any) => state.user)
      .map((state: any) => state.user)
  })

  // 内容监听
  const content = computed(() => text.toString())

  function updateContent(newContent: string) {
    doc.transact(() => {
      text.delete(0, text.length)
      text.insert(0, newContent)
    })
  }

  // 版本历史 — CRDT 快照
  function getSnapshot() {
    return Y.encodeStateAsUpdate(doc)
  }

  function restoreFromSnapshot(snapshot: Uint8Array) {
    Y.applyUpdate(doc, snapshot)
  }

  // 清理
  onUnmounted(() => {
    provider.destroy()
    indexeddb.destroy()
    doc.destroy()
  })

  return {
    doc,
    text,
    content,
    updateContent,
    isSynced,
    isOffline,
    users,
    getSnapshot,
    restoreFromSnapshot,
  }
}
```

#### useWebSocket — 实时消息

```typescript
// features/chat/useWebSocket.ts

import { ref, reactive, onUnmounted } from 'vue'
import { useAuth } from '@/shared/composables/useAuth'

interface Message {
  id: string
  channelId: string
  userId: string
  content: string
  timestamp: number
  type: 'text' | 'file' | 'system'
}

interface WebSocketState {
  connected: boolean
  connecting: boolean
  lastError: string | null
  messageQueue: Message[]
}

export function useWebSocket() {
  const { token } = useAuth()
  const state = reactive<WebSocketState>({
    connected: false,
    connecting: false,
    lastError: null,
    messageQueue: [],
  })

  let ws: WebSocket | null = null
  let reconnectTimer: number | null = null
  const messageHandlers = new Map<string, Set<(msg: Message) => void>>()

  const MAX_RECONNECT_DELAY = 30000
  const BASE_RECONNECT_DELAY = 1000
  let reconnectAttempts = 0

  function connect() {
    state.connecting = true
    const url = `${import.meta.env.VITE_WS_URL}?token=${token.value}`
    ws = new WebSocket(url)

    ws.onopen = () => {
      state.connected = true
      state.connecting = false
      reconnectAttempts = 0
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as Message
      state.messageQueue.push(msg)

      // 分发到对应频道
      const handlers = messageHandlers.get(msg.channelId)
      handlers?.forEach(h => h(msg))

      // 全局 handlers
      const globalHandlers = messageHandlers.get('*')
      globalHandlers?.forEach(h => h(msg))
    }

    ws.onclose = () => {
      state.connected = false
      scheduleReconnect()
    }

    ws.onerror = () => {
      state.lastError = 'WebSocket 连接错误'
    }
  }

  function scheduleReconnect() {
    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
      MAX_RECONNECT_DELAY
    )
    reconnectAttempts++
    reconnectTimer = window.setTimeout(connect, delay)
  }

  function sendMessage(channelId: string, content: string) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return

    const msg: Message = {
      id: crypto.randomUUID(),
      channelId,
      userId: '', // 服务端填充
      content,
      timestamp: Date.now(),
      type: 'text',
    }

    ws.send(JSON.stringify(msg))
  }

  function onMessage(channelId: string, handler: (msg: Message) => void) {
    if (!messageHandlers.has(channelId)) {
      messageHandlers.set(channelId, new Set())
    }
    messageHandlers.get(channelId)!.add(handler)

    // 返回取消订阅函数
    return () => {
      messageHandlers.get(channelId)?.delete(handler)
    }
  }

  function disconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    ws?.close()
    ws = null
  }

  onUnmounted(disconnect)

  return {
    state,
    connect,
    sendMessage,
    onMessage,
    disconnect,
  }
}
```

#### useAIAgent — AI 助手

```typescript
// features/ai-assistant/useAIAgent.ts

import { ref, reactive } from 'vue'
import { useAuth } from '@/shared/composables/useAuth'

interface AIMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  timestamp: number
  toolCalls?: Array<{ name: string; args: any; result: any }>
  thinking?: string  // 推理链 (可解释性)
}

interface Tool {
  name: string
  description: string
  parameters: Record<string, any>
  execute: (args: any) => Promise<any>
}

export function useAIAgent() {
  const { token } = useAuth()
  const messages = ref<AIMessage[]>([])
  const isThinking = ref(false)
  const currentTask = ref<string | null>(null)

  // 注册工具
  const tools: Tool[] = [
    {
      name: 'search_documents',
      description: '搜索文档内容',
      parameters: { query: 'string', limit: 'number' },
      execute: async ({ query, limit }) => {
        const res = await fetch('/api/documents/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, limit }),
        })
        return res.json()
      },
    },
    {
      name: 'summarize_document',
      description: '生成文档摘要',
      parameters: { documentId: 'string' },
      execute: async ({ documentId }) => {
        const res = await fetch(`/api/documents/${documentId}/summarize`)
        return res.json()
      },
    },
    {
      name: 'create_task',
      description: '创建任务',
      parameters: { title: 'string', projectId: 'string', assigneeId: 'string' },
      execute: async (args) => {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        })
        return res.json()
      },
    },
  ]

  async function sendMessage(content: string) {
    const userMsg: AIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
    }
    messages.value.push(userMsg)
    isThinking.value = true

    try {
      // 调用 AI 服务 (带工具定义)
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.value}`,
        },
        body: JSON.stringify({
          messages: messages.value.map(m => ({
            role: m.role,
            content: m.content,
          })),
          tools: tools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        }),
      })

      const data = await res.json()

      // 处理工具调用
      if (data.tool_calls?.length > 0) {
        const toolResults = []
        for (const toolCall of data.tool_calls) {
          const tool = tools.find(t => t.name === toolCall.name)
          if (tool) {
            const result = await tool.execute(toolCall.args)
            toolResults.push({ ...toolCall, result })
          }
        }

        // 工具结果消息
        messages.value.push({
          id: crypto.randomUUID(),
          role: 'tool',
          content: JSON.stringify(toolResults),
          timestamp: Date.now(),
          toolCalls: toolResults,
        })

        // 再次请求 AI 生成最终回复
        const finalRes = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: messages.value.map(m => ({
              role: m.role,
              content: m.content,
            })),
          }),
        })
        const finalData = await finalRes.json()

        messages.value.push({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: finalData.content,
          timestamp: Date.now(),
          thinking: data.reasoning, // 推理链
        })
      } else {
        messages.value.push({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.content,
          timestamp: Date.now(),
          thinking: data.reasoning,
        })
      }
    } catch (err) {
      // 降级: 显示错误，保持可用性
      messages.value.push({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'AI 服务暂时不可用，请稍后重试。',
        timestamp: Date.now(),
      })
    } finally {
      isThinking.value = false
    }
  }

  return {
    messages,
    isThinking,
    sendMessage,
    clearHistory: () => messages.value = [],
  }
}
```

### 3.6 边缘函数实现

```typescript
// edge/render.ts — Cloudflare Worker

interface Env {
  ASSETS: Fetcher
  ORIGIN: string
  KV: KVNamespace
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url)

    // 1. 静态资源直接从 Edge 返回
    if (url.pathname.match(/\.(js|css|png|jpg|svg|woff2)$/)) {
      const cache = caches.default
      let response = await cache.match(request)
      if (!response) {
        response = await fetch(request)
        if (response.ok) {
          ctx.waitUntil(cache.put(request, response.clone()))
        }
      }
      return response
    }

    // 2. 页面请求 — 边缘 SSR
    if (url.pathname.startsWith('/docs/') || url.pathname.startsWith('/projects/')) {
      // 检查边缘缓存
      const cacheKey = new Request(url.toString(), request)
      const cache = caches.default
      let response = await cache.match(cacheKey)

      if (!response) {
        // 从 Origin SSR
        response = await fetch(`${env.ORIGIN}${url.pathname}`, request)

        // 缓存 60 秒 (ISR 模式)
        if (response.ok) {
          const headers = new Headers(response.headers)
          headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
          const cached = new Response(response.body, { headers })
          ctx.waitUntil(cache.put(cacheKey, cached.clone()))
          return cached
        }
      }

      return response
    }

    // 3. API 请求 — 直接转发 (不缓存)
    if (url.pathname.startsWith('/api/')) {
      return fetch(`${env.ORIGIN}${url.pathname}`, request)
    }

    // 4. 默认 — Origin SSR
    return fetch(`${env.ORIGIN}${url.pathname}`, request)
  },
}
```

### 3.7 性能预算与优化策略

```
┌─────────────────────────────────────────────────────────────┐
│                    TeamSync 性能预算                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  首屏 JS:     ≤ 50KB (gzip)                                │
│  首屏 CSS:    ≤ 15KB (gzip)                                │
│  首屏加载:    ≤ 1.5s (3G, P75)                              │
│  交互时间:    ≤ 100ms (TTFB)                                │
│  水合时间:    ≤ 200ms (每个岛屿)                             │
│  LCP:         ≤ 2.5s                                       │
│  CLS:         ≤ 0.1                                        │
│  FID:         ≤ 100ms                                      │
│                                                             │
│  优化策略:                                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. Islands 架构 — 仅水合交互组件                       │  │
│  │ 2. 代码分割 — 每个 Island 独立 chunk                   │  │
│  │ 3. 边缘缓存 — 页面 60s ISR, 静态资源 1y               │  │
│  │ 4. 图片优化 — WebP/AVIF + lazy loading                │  │
│  │ 5. 字体优化 — font-display: swap + subset             │  │
│  │ 6. CRDT 增量同步 — 仅传输变更                         │  │
│  │ 7. WebSocket 复用 — 单连接多频道                       │  │
│  │ 8. 虚拟列表 — 消息/任务列表按需渲染                    │  │
│  │ 9. Service Worker — 离线缓存 + 后台同步                │  │
│  │ 10. Edge SSR — 就近渲染, 降低 TTFB                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.8 安全架构

```
┌─────────────────────────────────────────────────────────────┐
│                    TeamSync 安全层                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  L1: 边缘安全 (Cloudflare)                                  │
│  • DDoS 防护                                                │
│  • WAF (Web 应用防火墙)                                     │
│  • 速率限制 (按 IP + 按用户)                                │
│  • Bot 管理                                                 │
│                                                             │
│  L2: 应用安全                                               │
│  • CSP (Content Security Policy)                            │
│    default-src 'self'; script-src 'self' 'unsafe-inline'   │
│    connect-src 'self' wss://*.teamsync.io                   │
│                                                             │
│  • CORS — 严格白名单                                        │
│  • CSRF — SameSite Cookie + CSRF Token                      │
│  • XSS — 自动转义 (Vue 默认) + DOMPurify                    │
│  • SQL 注入 — 参数化查询 (ORM)                              │
│                                                             │
│  L3: 认证与授权                                             │
│  • JWT (短期 15min) + Refresh Token (7d)                    │
│  • RBAC (角色: Admin/Member/Viewer)                         │
│  • 文档级权限 (owner/editor/viewer)                         │
│  • API 签名 (服务端到服务端)                                │
│                                                             │
│  L4: 数据安全                                               │
│  • 传输加密 — TLS 1.3                                       │
│  • 存储加密 — AES-256 (数据库)                              │
│  • 端到端加密 — CRDT 文档可选 E2E                           │
│  • 审计日志 — 所有写操作记录                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 四、架构对比总结 — 八轮迭代回顾

```
┌────┬──────────────┬─────────────────────────────────────────┐
│ #  │ 日期         │ 主题                                    │
├────┼──────────────┼─────────────────────────────────────────┤
│ v1 │ 4/22         │ MVC/MVVM/微前端 基础概念                 │
│ v2 │ 4/26         │ 架构决策框架 + 反模式 + 跨专项贯通       │
│ v3 │ 4/27         │ BFF + 事件驱动 + 架构决策模拟器          │
│ v4 │ 4/28         │ 三大模式手写实现 (MVC/MVVM/Flux)         │
│ v5 │ 4/29         │ 架构决策 + 融合架构 + 迁移策略           │
│ v6 │ 4/30         │ 三大模式融合 + 混合架构 + 健康度监控     │
│ v7 │ 5/1          │ Vue 3 Composition 架构 + 服务端组件      │
│ v8 │ 5/2          │ 企业级全栈 DevFlow 八层融合架构           │
│ v9 │ 5/5          │ 2026 新范式 + CRDT + Edge-first + AI-Native│
│    │              │ 完整 TeamSync 实时协作应用架构             │
└────┴──────────────┴─────────────────────────────────────────┘

演进路线:
  理论认知 (v1-2) → 手写实践 (v3-4) → 融合决策 (v5-6)
  → Vue3 深度 (v7) → 企业级实战 (v8) → 2026 前沿 (v9)
```

---

## 五、关键收获

### 5.1 架构选型核心原则

1. **没有银弹** — 每个模式有适用场景，融合优于单一
2. **渐进式** — 从简单开始，按需演进，不预先过度设计
3. **边界清晰** — 模块间通过明确接口通信，不跨层依赖
4. **可测试性** — 架构的首要目标是可测试，其次才是性能
5. **团队优先** — 架构复杂度必须匹配团队能力

### 5.2 2026 架构趋势

- **RSC 成为主流** — 服务端组件从实验到生产
- **Edge-first 普及** — 全球应用标配
- **CRDT 替代 OT** — 实时协作新标准
- **AI-Native 架构** — AI 从附加到一等公民
- **Islands 架构成熟** — Astro/Fresh 验证可行

### 5.3 TeamSync 架构亮点

- Islands + 渐进水合 → 首屏 < 1.5s
- CRDT (Yjs) + IndexedDB → 离线编辑 + 数学一致性
- Edge-first (Cloudflare) → 全球 < 50ms 延迟
- AI-Native Agent 层 → AI 助手深度集成
- 八层安全 → 边缘 → 应用 → 认证 → 数据
