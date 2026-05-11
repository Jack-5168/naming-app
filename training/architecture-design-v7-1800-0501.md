# 🏗️ 前端架构设计专项训练 v7 — Vue 3 组合式架构 + 现代渲染模式 + 完整应用实战

**时间：** 2026-05-01 18:00  
**主题：** Vue 3 Composition 架构模式 / 服务端组件 / Edge 架构 / 完整应用从零设计  
**前置：** 4/22 MVC/MVVM 基础 → 4/26 终极整合 → 4/27 BFF/事件驱动 → 4/28 三大模式手写 → 4/29 架构决策 → 4/30 融合架构终极训练  
**本次新增：** Composition 架构模式 / 服务端组件架构 / Edge 渲染架构 / 组合式 Composables 架构 / 完整 CloudBoard 应用架构（Vue 3 原生）

---

## 一、Composition 架构模式 — Vue 3 时代的架构新范式

### 1.1 为什么 Composition API 改变了架构？

```
Options API 架构的局限：

┌─────────────────────────────────────────┐
│  export default {                       │
│    data() { ... },    ← 一个功能的逻辑  │
│    computed: { ... }, ← 被拆到 4 个地方 │
│    methods: { ... },  ← 阅读时来回跳转  │
│    watch: { ... },    ← 逻辑碎片化      │
│    mounted() { ... }  ← 难以复用        │
│  }                                      │
└─────────────────────────────────────────┘

Composition API 架构的优势：

┌─────────────────────────────────────────┐
│  function useFeature() {                │
│    const state = reactive(...)          │  ← 一个功能的所有逻辑
│    const computed = computed(...)       │  ← 自然聚集在一起
│    const action = () => {...}           │  ← 清晰的边界
│    watch(state, ...)                    │  ← 易于提取/复用
│    onMounted(...)                       │  ← 类型推导完美
│    return { state, computed, action }   │
│  }                                      │
└─────────────────────────────────────────┘

核心转变：从"按选项分组" → "按功能分组" → 架构单元从"组件"变为"Composable"
```

### 1.2 Composition 架构的五个层次

```
┌─────────────────────────────────────────────────────────────────┐
│                    第五层: 页面 (Pages)                          │
│  职责: 组合多个 Composables + 布局 + 路由参数处理                 │
│  示例: DashboardPage / UserProfilePage / SettingsPage            │
├─────────────────────────────────────────────────────────────────┤
│                    第四层: 布局 (Layouts)                        │
│  职责: 页面结构 (Sidebar/Header/Footer/Content)                  │
│  示例: MainLayout / AuthLayout / DashboardLayout                 │
├─────────────────────────────────────────────────────────────────┤
│                    第三层: Composables (组合式函数)                │
│  职责: 可复用的逻辑单元 (状态 + 行为 + 副作用)                     │
│  示例: useAuth / usePagination / useWebSocket / useForm          │
├─────────────────────────────────────────────────────────────────┤
│                    第二层: 组件 (Components)                      │
│  职责: UI 渲染 + 用户交互 + 组合 Composables                      │
│  示例: DataTable / Modal / SearchBar / NotificationBell          │
├─────────────────────────────────────────────────────────────────┤
│                    第一层: 原子 (Primitives)                      │
│  职责: 最基础的 Vue 响应式原语                                    │
│  示例: ref / reactive / computed / watch / provide/inject        │
└─────────────────────────────────────────────────────────────────┘

每一层只依赖下一层，不跨层、不反向依赖
```

### 1.3 Composable 架构设计模式

#### 模式 A: 状态型 Composable (State Composable)

```typescript
// 特征: 管理独立状态，返回响应式数据 + 操作方法
// 类比: 轻量级 Store，适合局部状态

function useLocalStorage<T>(key: string, initialValue: T) {
  // 状态
  const value = ref<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : initialValue
    } catch {
      return initialValue
    }
  })

  // 方法
  function set(newValue: T) {
    value.value = newValue
    localStorage.setItem(key, JSON.stringify(newValue))
  }

  function remove() {
    value.value = initialValue
    localStorage.removeItem(key)
  }

  // 副作用: 多标签页同步
  const handleStorage = (e: StorageEvent) => {
    if (e.key === key && e.newValue) {
      value.value = JSON.parse(e.newValue)
    }
  }

  onMounted(() => window.addEventListener('storage', handleStorage))
  onUnmounted(() => window.removeEventListener('storage', handleStorage))

  // 只暴露必要的 API
  return {
    value: readonly(value),  // 外部只能读
    set,
    remove
  }
}

// 使用
const { value: theme, set: setTheme } = useLocalStorage('theme', 'light')
```

#### 模式 B: 副作用型 Composable (Side Effect Composable)

```typescript
// 特征: 封装外部副作用，返回控制接口
// 类比: 资源管理器，关注生命周期

function useIntersectionObserver(
  target: Ref<HTMLElement | null>,
  options: IntersectionObserverInit = {}
) {
  const isVisible = ref(false)
  const ratio = ref(0)
  let observer: IntersectionObserver | null = null

  function start() {
    if (!target.value || observer) return
    observer = new IntersectionObserver(([entry]) => {
      isVisible.value = entry.isIntersecting
      ratio.value = entry.intersectionRatio
    }, { threshold: [0, 0.25, 0.5, 0.75, 1], ...options })
    observer.observe(target.value)
  }

  function stop() {
    observer?.disconnect()
    observer = null
  }

  // 自动管理生命周期
  watch(target, (el) => {
    stop()
    if (el) start()
  }, { immediate: true })

  onUnmounted(stop)

  return { isVisible, ratio, start, stop }
}

// 使用
const imgRef = ref<HTMLImageElement | null>(null)
const { isVisible } = useIntersectionObserver(imgRef)
```

#### 模式 C: 组合型 Composable (Composite Composable)

```typescript
// 特征: 组合多个 Composables，形成更高层的抽象
// 类比: 门面模式，简化复杂子系统

function useCrud<T extends { id: string }>(
  resource: string,
  api: ApiClient
) {
  // 组合状态管理
  const { data, loading, error, execute } = useAsyncState<T[]>([])

  // 组合选择状态
  const { selected, isSelected, toggleSelect, selectAll, clearSelection } =
    useSelection<string>()

  // 组合排序状态
  const { sortField, sortDirection, toggleSort } = useSort<T>()

  // 组合过滤状态
  const { filters, setFilter, clearFilters, filteredData } =
    useFilter<T>(data)

  // 组合分页状态
  const { page, pageSize, total, paginatedData, goToPage } =
    usePagination<T>(filteredData)

  // 业务操作
  async function fetch() {
    const result = await api.get<T[]>(`/${resource}`, {
      sort: sortField.value ? `${sortField.value}:${sortDirection.value}` : undefined,
      page: page.value,
      limit: pageSize.value,
      ...filters.value
    })
    data.value = result.items
    total.value = result.total
  }

  async function create(item: Omit<T, 'id'>) {
    const created = await api.post<T>(`/${resource}`, item)
    data.value = [...data.value, created]
    return created
  }

  async function update(id: string, item: Partial<T>) {
    const updated = await api.put<T>(`/${resource}/${id}`, item)
    data.value = data.value.map(d => d.id === id ? updated : d)
    return updated
  }

  async function remove(id: string) {
    await api.delete(`/${resource}/${id}`)
    data.value = data.value.filter(d => d.id !== id)
  }

  // 批量操作
  async function batchDelete() {
    await Promise.all(selected.value.map(id => remove(id)))
    clearSelection()
  }

  // 副作用: 参数变化时自动重新获取
  watch([sortField, sortDirection, filters, page, pageSize], fetch, { deep: true })
  onMounted(fetch)

  return {
    // 数据
    data: paginatedData,
    loading,
    error,
    total,
    // 选择
    selected, isSelected, toggleSelect, selectAll, clearSelection,
    // 排序
    sortField, sortDirection, toggleSort,
    // 过滤
    filters, setFilter, clearFilters,
    // 分页
    page, pageSize, goToPage,
    // 操作
    fetch, create, update, remove, batchDelete
  }
}

// 使用 — 一行搞定 CRUD 页面
const { data, loading, create, update, remove, selected, toggleSelect, sortField, toggleSort } =
  useCrud<User>('users', api)
```

#### 模式 D: 依赖注入型 Composable (DI Composable)

```typescript
// 特征: 通过 provide/inject 实现跨组件共享
// 类比: 上下文 (Context)，适合组件树级别的共享状态

// 定义 Token
const FormContextKey = Symbol() as InjectionKey<FormContext>

interface FormContext {
  registerField: (name: string, validator: Validator) => void
  unregisterField: (name: string) => void
  validate: () => Promise<boolean>
  reset: () => void
  isSubmitting: Ref<boolean>
  errors: Ref<Record<string, string[]>>
}

// Provider Composable
function provideForm(options: FormOptions = {}) {
  const fields = new Map<string, Validator>()
  const isSubmitting = ref(false)
  const errors = ref<Record<string, string[]>>({})

  const context: FormContext = {
    registerField(name, validator) {
      fields.set(name, validator)
    },
    unregisterField(name) {
      fields.delete(name)
    },
    async validate() {
      isSubmitting.value = true
      errors.value = {}
      let valid = true
      for (const [name, validator] of fields) {
        const fieldErrors = await validator()
        if (fieldErrors.length > 0) {
          errors.value[name] = fieldErrors
          valid = false
        }
      }
      isSubmitting.value = false
      return valid
    },
    reset() {
      errors.value = {}
      isSubmitting.value = false
    }
  }

  provide(FormContextKey, context)
  return context
}

// Consumer Composable
function injectForm(): FormContext {
  const context = inject(FormContextKey)
  if (!context) {
    throw new Error('useFormField must be used inside a FormProvider')
  }
  return context
}

// Field Composable
function useFormField(name: string, validator: Validator) {
  const form = injectForm()

  onMounted(() => form.registerField(name, validator))
  onUnmounted(() => form.unregisterField(name))

  const fieldErrors = computed(() => form.errors.value[name] || [])
  const hasError = computed(() => fieldErrors.value.length > 0)

  return { fieldErrors, hasError }
}

// 使用
// Form.vue
provideForm()

// FormInput.vue
const { fieldErrors, hasError } = useFormField('email', validateEmail)
```

### 1.4 Composables 架构最佳实践

```
Composable 设计原则:

1. 命名: useXxx 前缀，动词或名词均可
   ✅ useAuth / usePagination / useWebSocket
   ❌ auth / pagination / websocket

2. 单一职责: 一个 Composable 只做一件事
   ✅ useAuth (认证) + usePermission (权限) 分开
   ❌ useAuthAndPermission (职责混乱)

3. 返回只读状态: 内部 mutable，外部 readonly
   ✅ return { value: readonly(state), setValue }
   ❌ return { state } (外部可随意修改)

4. 自动清理: onUnmounted 中清理副作用
   ✅ 事件监听 / Timer / WebSocket / Observer
   ❌ 泄漏资源

5. 可组合: Composables 之间可以互相调用
   ✅ useCrud 组合 useAsyncState + useSelection + useSort
   ❌ 每个 Composable 都从零实现

6. SSR 安全: 检查 window/document 是否存在
   ✅ if (typeof window !== 'undefined')
   ❌ 直接使用 window (SSR 报错)

7. TypeScript: 完整的类型推导
   ✅ 泛型 + 约束 + 推断
   ❌ any 到处飞
```

---

## 二、服务端组件架构 — React Server Components & Vue 响应式服务端

### 2.1 服务端组件 (RSC) 架构全景

```
传统 CSR 架构:

  浏览器                    服务器
  ┌──────────┐             ┌──────────┐
  │  HTML    │────────────▶│  API     │
  │  JS Bundle│◀────────────│  数据    │
  │  (150KB) │             └──────────┘
  │   hydration│
  │  获取数据  │
  │  渲染页面  │
  └──────────┘

  问题:
  - 首屏白屏时间长 (下载 JS → 执行 → 请求数据 → 渲染)
  - 水合 (Hydration) 开销大
  - 服务端渲染了但浏览器还要重做一遍

RSC 架构:

  浏览器                    服务器
  ┌──────────┐             ┌──────────┐
  │  UI 层   │◀────────────│ RSC 层   │
  │ (Client) │   RSC Flight│ (Server) │
  │          │             │          │
  │          │             │ 数据库   │
  │          │             │ 文件系统 │
  │          │             │ 后端 API │
  └──────────┘             └──────────┘

  优势:
  - 服务端组件不打包到客户端 JS (0KB)
  - 直接访问数据库/文件系统 (不需要 API 层)
  - 自动代码分割 (只发送客户端组件)
  - 首屏即完整内容 (无白屏)
  - 流式传输 (Streaming) + Suspense
```

### 2.2 RSC 架构中的组件分类

```typescript
// ─── Server Component (默认) ───
// 只在服务端运行，不发送 JS 到客户端
// 可以: 直接访问数据库/文件系统/环境变量
// 不可以: useState/useEffect/事件处理/浏览器 API

// app/blog/[slug]/page.tsx (Server Component)
import { notFound } from 'next/navigation'
import { getBlogPost } from '@/lib/cms'
import { CommentSection } from './comment-section'  // Client Component
import { ShareButton } from './share-button'        // Client Component

export default async function BlogPost({ params }: { params: { slug: string } }) {
  // ✅ 直接访问数据库 — 不需要 API 调用
  const post = await getBlogPost(params.slug)
  if (!post) notFound()

  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
      <meta name="description" content={post.excerpt} />

      {/* 跨边界传递数据 — 自动序列化 */}
      <CommentSection postId={post.id} />
      <ShareButton title={post.title} url={post.url} />
    </article>
  )
}

// ─── Client Component (use client 指令) ───
// 在服务端和客户端都运行
// 可以: useState/useEffect/事件处理/浏览器 API
// 不可以: 直接访问数据库/文件系统

// app/blog/comment-section.tsx
'use client'

import { useState, useEffect } from 'react'

export function CommentSection({ postId }: { postId: string }) {
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')

  useEffect(() => {
    // ✅ 可以使用浏览器 API
    const ws = new WebSocket(`wss://api.example.com/comments/${postId}`)
    ws.onmessage = (e) => {
      setComments(prev => [...prev, JSON.parse(e.data)])
    }
    return () => ws.close()
  }, [postId])

  return (
    <section>
      {comments.map(c => <Comment key={c.id} {...c} />)}
      <input
        value={newComment}
        onChange={e => setNewComment(e.target.value)}
        placeholder="写评论..."
      />
    </section>
  )
}
```

### 2.3 Vue 的服务端组件方案 — Nuxt 3 `<script setup>` + Server Routes

```typescript
// Nuxt 3 的架构模式: 混合渲染

// ─── 服务端路由 (Server Routes) ───
// server/api/posts/[slug].get.ts — 只在服务端运行
export default defineEventHandler(async (event) => {
  const { slug } = getRouterParams(event)
  const post = await useSanity(event).fetch({
    query: `*[_type == "post" && slug.current == "${slug}"][0]`
  })
  return post
})

// ─── 服务端组件 (ServerComponent) ───
// 使用 <script setup> 默认在服务端 + 客户端运行
// 使用 <script> (非 setup) 可在服务端执行一次性逻辑

// pages/blog/[slug].vue
<script setup lang="ts">
// 服务端执行: 获取数据 (自动 SSR)
const route = useRoute()
const { data: post } = await useFetch(`/api/posts/${route.params.slug}`)

// 服务端执行: SEO meta
useHead({
  title: post.value?.title,
  meta: [
    { name: 'description', content: post.value?.excerpt },
    { property: 'og:title', content: post.value?.title },
  ]
})
</script>

<template>
  <article v-if="post">
    <h1>{{ post.title }}</h1>
    <div v-html="post.content" />
    <!-- 客户端交互组件 -->
    <ClientOnly>
      <CommentSection :post-id="post.id" />
    </ClientOnly>
  </article>
</template>

// ─── 纯客户端组件 ───
// components/ClientOnly/Map.vue
<script setup lang="ts">
// 只在客户端运行 (通过 <ClientOnly> 包裹)
const map = ref<L.Map | null>(null)

onMounted(() => {
  // ✅ 浏览器 API 安全
  map.value = L.map('map').setView([39.9, 116.4], 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
    .addTo(map.value!)
})
</script>
```

### 2.4 服务端组件架构决策矩阵

```
┌─────────────────────┬──────────────────┬──────────────────┐
│       维度          │   CSR (Vue SPA)  │   SSR (Nuxt)     │
├─────────────────────┼──────────────────┼──────────────────┤
│ 首屏速度            │ ★★☆ (需下载 JS)  │ ★★★★ (HTML 直出) │
│ SEO                 │ ★☆☆ (需额外配置) │ ★★★★★ (原生支持) │
│ 交互复杂度          │ ★★★★★           │ ★★★★             │
│ 服务器成本          │ ★☆☆ (仅静态)     │ ★★★ (需 Node)    │
│ 开发复杂度          │ ★★★             │ ★★★★             │
│ 数据实时性          │ ★★★★★ (API)     │ ★★★★ (SSR+API)   │
│ 缓存策略            │ 客户端缓存        │ 多层缓存 (CDN+   │
│                     │                  │ 服务端+客户端)    │
└─────────────────────┴──────────────────┴──────────────────┘

选型指南:
- 内容型网站 (博客/文档/营销页) → SSR (Nuxt/Next)
- 后台管理系统 (CRM/ERP/Dashboard) → CSR (Vue SPA)
- 电商/社交 (内容+交互混合) → SSR + CSR 混合
- 极致性能要求 → Edge Rendering / Island Architecture
```

---

## 三、Edge 渲染架构 — 在边缘节点渲染

### 3.1 Edge Computing 架构全景

```
传统 Cloud 架构:

  用户 (北京) ──100ms──▶ 阿里云 (上海) ──▶ 数据库
  用户 (广州) ──50ms───▶ 阿里云 (上海) ──▶ 数据库
  用户 (成都) ──30ms───▶ 阿里云 (上海) ──▶ 数据库

  问题: 物理距离导致延迟，最远用户 100ms+

Edge 架构:

  用户 (北京) ──5ms──▶ Edge 节点 (北京) ──▶ 源站 (同步缓存)
  用户 (广州) ──3ms──▶ Edge 节点 (广州) ──▶ 源站 (同步缓存)
  用户 (成都) ──2ms──▶ Edge 节点 (成都) ──▶ 源站 (同步缓存)

  优势: 用户就近访问 Edge 节点，延迟 < 10ms
```

### 3.2 Edge Rendering 三种模式

```
模式 1: ISR (Incremental Static Regeneration) — 增量静态再生

  首次访问:
  用户 → Edge → 缓存 MISS → 源站生成 HTML → 返回 + 缓存
  (首屏稍慢，但后续极快)

  后续访问:
  用户 → Edge → 缓存 HIT → 直接返回 HTML (5ms)

  重新验证:
  后台: 定时/触发 → 源站重新生成 → 更新 Edge 缓存
  (用户无感知，旧内容先返回，新内容后台更新)

模式 2: On-Demand ISR — 按需再生

  内容更新时:
  管理员发布 → Webhook → Edge PURGE → 下次访问重新生成

  优势: 精确控制缓存失效时机

模式 3: Edge SSR — 边缘服务端渲染

  用户 → Edge → Edge Function 渲染 HTML → 返回
  (无需回源，Edge 节点直接渲染)

  适用: 个性化内容 (登录状态/地区/语言)
```

### 3.3 Edge 架构实战 — Cloudflare Workers + Nuxt

```typescript
// ─── Edge Function (Cloudflare Workers) ───
// 在边缘节点运行，全球 300+ 节点

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url)

    // 1. 缓存策略
    const cacheKey = new Request(url.toString(), request)
    const cache = caches.default

    // 2. 尝试缓存
    let response = await cache.match(cacheKey)
    if (response) {
      // 后台重新验证 (Stale-While-Revalidate)
      ctx.waitUntil(revalidate(url, env))
      return response
    }

    // 3. 边缘渲染
    const html = await renderPage(url, env)

    // 4. 缓存响应 (TTL: 1 小时)
    response = new Response(html, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'CDN-Cache-Control': 'public, max-age=86400',
      }
    })

    ctx.waitUntil(cache.put(cacheKey, response.clone()))
    return response
  }
}

// ─── Nuxt Edge 部署 ───
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    preset: 'cloudflare-pages',  // 部署到 Cloudflare Edge
    externals: {
      inline: ['@vueuse/core']    // Edge 兼容处理
    }
  }
})

// ─── 边缘 API (server/api/) ───
// server/api/health.get.ts — 自动部署到 Edge
export default defineEventHandler(() => {
  return {
    status: 'ok',
    region: process.env.CF_REGION || 'unknown',
    timestamp: Date.now()
  }
})
```

---

## 四、完整应用架构设计 — CloudBoard 协作看板 (Vue 3 + Nuxt 3)

### 4.1 需求分析

```
CloudBoard — 团队协作看板应用

核心功能:
1. 看板管理: 创建/删除/归档看板，拖拽排序列表
2. 卡片管理: 创建/编辑/删除卡片，拖拽移动，标签/优先级/截止日期
3. 实时协作: 多人同时编辑，实时同步 (WebSocket)
4. 评论系统: 卡片评论，@提及，富文本
5. 通知中心: 站内通知，邮件通知，WebSocket 推送
6. 搜索过滤: 全局搜索，按标签/负责人/截止日期过滤
7. 权限管理: 角色 (Owner/Admin/Member/Viewer)，操作权限控制
8. 附件上传: 图片/文件拖拽上传，预览

技术约束:
- 团队: 3 人前端 + 2 人后端
- 目标: 首屏 < 2s，交互 < 100ms
- SEO: 公开看板需要 SEO
- 部署: 阿里云 + CDN
```

### 4.2 架构选型决策

```
┌─────────────────────────────────────────────────────────────────┐
│                    CloudBoard 架构选型                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  渲染策略: SSR + CSR 混合                                        │
│    - 公开看板页 → SSR (SEO)                                      │
│    - 工作台/编辑页 → CSR (交互密集)                               │
│    - 理由: 内容页需要 SEO，编辑页需要极致交互体验                   │
│                                                                 │
│  前端框架: Vue 3 + Nuxt 3                                        │
│    - 理由: 团队 Vue 熟练度高，Nuxt 3 提供 SSR/路由/API 一体化      │
│                                                                 │
│  状态管理: Pinia (多 Store 架构)                                  │
│    - 理由: Vue 3 官方推荐，类型安全，DevTools 支持                 │
│                                                                 │
│  通信: REST API + WebSocket (实时协作)                            │
│    - 理由: REST 处理 CRUD，WebSocket 处理实时同步                  │
│                                                                 │
│  组件架构: Composition API + Composables                         │
│    - 理由: 逻辑复用性好，类型推导完整，易于测试                     │
│                                                                 │
│  部署: Vercel/阿里云 (SSR) + CDN (静态资源)                       │
│    - 理由: SSR 需要 Node 运行时，静态资源走 CDN 加速               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 项目目录架构

```
cloudboard/
├── nuxt.config.ts                    # Nuxt 配置
├── app.vue                           # 根组件 (Layout 组合)
├── error.vue                         # 全局错误页面
│
├── assets/                           # 静态资源 (Vite 处理)
│   ├── css/
│   │   ├── tailwind.css              # Tailwind 入口
│   │   ├── variables.css             # CSS 变量/主题
│   │   └── transitions.css           # 过渡动画
│   └── images/
│
├── components/                       # 组件 (按功能组织)
│   ├── common/                       # 通用原子组件
│   │   ├── Button.vue                # 按钮 (variant/size/loading)
│   │   ├── Input.vue                 # 输入框 (验证/错误)
│   │   ├── Modal.vue                 # 模态框 (动画/焦点管理)
│   │   ├── Tooltip.vue               # 提示框
│   │   ├── Avatar.vue                # 头像 (fallback/颜色)
│   │   └── Badge.vue                 # 徽章 (优先级/状态)
│   │
│   ├── board/                        # 看板模块
│   │   ├── BoardCard.vue             # 卡片组件 (拖拽/编辑/菜单)
│   │   ├── BoardList.vue             # 列表组件 (拖拽排序)
│   │   ├── BoardView.vue             # 看板视图 (列布局)
│   │   ├── BoardHeader.vue           # 看板头部 (标题/操作)
│   │   └── BoardSidebar.vue          # 看板侧边栏 (过滤/搜索)
│   │
│   ├── comment/                      # 评论模块
│   │   ├── CommentItem.vue           # 评论项
│   │   ├── CommentForm.vue           # 评论表单 (富文本)
│   │   └── CommentList.vue           # 评论列表
│   │
│   ├── notification/                 # 通知模块
│   │   ├── NotificationCenter.vue    # 通知中心 (抽屉)
│   │   ├── NotificationItem.vue      # 通知项
│   │   └── NotificationToast.vue     # 弹出通知
│   │
│   └── layout/                       # 布局组件
│       ├── AppHeader.vue             # 顶部导航
│       ├── AppSidebar.vue            # 左侧导航
│       ├── DashboardLayout.vue       # 工作台布局
│       └── PublicLayout.vue          # 公开页布局
│
├── composables/                      # 组合式函数 (核心架构层)
│   ├── useAuth.ts                    # 认证 (登录/登出/Token/刷新)
│   ├── useBoard.ts                   # 看板操作 (CRUD/拖拽/排序)
│   ├── useCard.ts                    # 卡片操作 (CRUD/标签/优先级)
│   ├── useComment.ts                 # 评论操作 (CRUD/@提及)
│   ├── useNotification.ts            # 通知操作 (读取/标记/清除)
│   ├── useSearch.ts                  # 搜索 (防抖/高亮/历史)
│   ├── useWebSocket.ts               # WebSocket (连接/重连/心跳)
│   ├── useDragDrop.ts                # 拖拽 (HTML5 Drag API)
│   ├── useFileUpload.ts              # 文件上传 (拖拽/进度/预览)
│   ├── usePermission.ts              # 权限 (角色检查/操作权限)
│   ├── useViewport.ts                # 视口 (resize/scroll/dimension)
│   └── useLocalStorage.ts            # 本地存储 (序列化/多标签同步)
│
├── stores/                           # Pinia Stores
│   ├── auth.store.ts                 # 认证状态 (用户/Token/角色)
│   ├── board.store.ts                # 看板状态 (当前看板/列表/卡片)
│   ├── notification.store.ts         # 通知状态 (列表/未读计数)
│   ├── ui.store.ts                   # UI 状态 (主题/侧边栏/模态框)
│   └── realtime.store.ts             # 实时状态 (在线用户/冲突检测)
│
├── pages/                            # 路由页面
│   ├── index.vue                     # 首页 (登录/注册入口)
│   ├── login.vue                     # 登录页
│   ├── register.vue                  # 注册页
│   ├── dashboard.vue                 # 工作台 (我的看板列表)
│   ├── board/
│   │   ├── [id].vue                  # 看板详情页 (SSR: 公开看板)
│   │   └── [id]/
│   │       ├── card/
│   │       │   └── [cardId].vue      # 卡片详情抽屉
│   │       └── settings.vue          # 看板设置
│   ├── search.vue                    # 全局搜索
│   └── settings.vue                  # 个人设置
│
├── layouts/                          # 布局
│   ├── default.vue                   # 默认布局 (Header + Sidebar)
│   ├── auth.vue                      # 认证布局 (居中卡片)
│   └── public.vue                    # 公开布局 (无 Sidebar)
│
├── server/                           # 服务端 (Nuxt Server)
│   ├── api/                          # API 路由 (代理到后端)
│   │   ├── auth/
│   │   │   ├── login.post.ts         # 登录代理
│   │   │   ├── logout.post.ts
│   │   │   └── refresh.post.ts
│   │   ├── boards/
│   │   │   ├── index.get.ts          # 看板列表
│   │   │   ├── [id].get.ts           # 看板详情 (SSR 数据源)
│   │   │   ├── [id].put.ts
│   │   │   └── [id].delete.ts
│   │   └── search.get.ts             # 搜索代理
│   │
│   ├── ws/                           # WebSocket 路由
│   │   └── board/[id].ts             # 看板实时通道
│   │
│   └── middleware/                   # 服务端中间件
│       ├── auth.ts                   # Token 验证
│       └── cors.ts                   # CORS 配置
│
├── plugins/                          # Nuxt 插件
│   ├── pinia.ts                      # Pinia 初始化 + 持久化插件
│   ├── websocket.ts                  # WebSocket 全局连接
│   └── dragula.ts                    # 拖拽库 (客户端 only)
│
├── utils/                            # 纯工具函数 (无副作用)
│   ├── date.ts                       # 日期格式化
│   ├── validator.ts                  # 表单验证规则
│   ├── permission.ts                 # 权限检查逻辑
│   └── constants.ts                  # 常量定义
│
├── types/                            # TypeScript 类型
│   ├── board.ts                      # 看板类型
│   ├── card.ts                       # 卡片类型
│   ├── user.ts                       # 用户类型
│   ├── api.ts                        # API 响应类型
│   └── websocket.ts                  # WebSocket 消息类型
│
└── public/                           # 静态资源 (不经过 Vite)
    ├── favicon.ico
    └── robots.txt
```

### 4.4 核心 Composables 架构

#### useBoard — 看板操作 Composable

```typescript
// composables/useBoard.ts
import { defineStore } from 'pinia'
import { useBoardStore } from '@/stores/board.store'

export function useBoard(boardId?: string) {
  const store = useBoardStore()
  const api = useApiClient()

  // 当前看板数据 (响应式)
  const currentBoard = computed(() => {
    if (!boardId) return null
    return store.boards.get(boardId) || null
  })

  const lists = computed(() => currentBoard.value?.lists || [])
  const cards = computed(() => {
    if (!currentBoard.value) return []
    return currentBoard.value.lists.flatMap(l => l.cards)
  })

  // 加载看板
  async function loadBoard(id: string) {
    const board = await api.get<Board>(`/boards/${id}`)
    store.setBoard(board)
    return board
  }

  // 拖拽排序列表
  async function reorderLists(listIds: string[]) {
    const updates = listIds.map((id, index) => ({ id, position: index }))
    await api.patch(`/boards/${boardId}/lists/reorder`, { updates })
    store.reorderLists(boardId!, listIds)
  }

  // 拖拽移动卡片
  async function moveCard(
    cardId: string,
    fromListId: string,
    toListId: string,
    toIndex: number
  ) {
    await api.patch(`/cards/${cardId}/move`, {
      fromListId, toListId, toIndex
    })
    store.moveCard(cardId, toListId, toIndex)
  }

  // 创建卡片
  async function createCard(listId: string, data: CreateCardData) {
    const card = await api.post<Card>(`/lists/${listId}/cards`, data)
    store.addCard(listId, card)
    return card
  }

  // 更新卡片
  async function updateCard(cardId: string, data: UpdateCardData) {
    const card = await api.patch<Card>(`/cards/${cardId}`, data)
    store.updateCard(cardId, card)
    return card
  }

  // 删除卡片
  async function deleteCard(cardId: string) {
    await api.delete(`/cards/${cardId}`)
    store.removeCard(cardId)
  }

  // 搜索卡片
  const { results: searchResults, search, clear: clearSearch } =
    useSearch(cards, ['title', 'description', 'tags'])

  return {
    // 数据
    currentBoard, lists, cards, searchResults,
    // 操作
    loadBoard, reorderLists, moveCard,
    createCard, updateCard, deleteCard,
    // 搜索
    search, clearSearch,
  }
}
```

#### useWebSocket — 实时协作 Composable

```typescript
// composables/useWebSocket.ts
import { useRealtimeStore } from '@/stores/realtime.store'

interface WSMessage {
  type: 'card:update' | 'card:create' | 'card:delete'
    | 'list:reorder' | 'user:join' | 'user:leave'
    | 'comment:create' | 'notification'
  boardId: string
  userId: string
  userName: string
  payload: unknown
  timestamp: number
}

export function useWebSocket(boardId: string) {
  const realtime = useRealtimeStore()
  const { user } = useAuth()

  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  const reconnectAttempts = ref(0)
  const isConnected = ref(false)

  const MAX_RECONNECT = 10
  const RECONNECT_DELAY = 1000
  const HEARTBEAT_INTERVAL = 30000

  function connect() {
    const token = useCookie('token').value
    const wsUrl = `${import.meta.env.WSS_URL}/board/${boardId}?token=${token}`

    ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      isConnected.value = true
      reconnectAttempts.value = 0
      startHeartbeat()
      // 加入看板
      send({ type: 'user:join', boardId, userId: user.value!.id, userName: user.value!.name, payload: {}, timestamp: Date.now() })
    }

    ws.onmessage = (event) => {
      const message: WSMessage = JSON.parse(event.data)
      handleMessage(message)
    }

    ws.onclose = () => {
      isConnected.value = false
      stopHeartbeat()
      scheduleReconnect()
    }

    ws.onerror = () => {
      ws?.close()
    }
  }

  function send(message: Omit<WSMessage, 'timestamp'>) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ ...message, timestamp: Date.now() }))
    }
  }

  function handleMessage(message: WSMessage) {
    // 忽略自己的消息
    if (message.userId === user.value?.id) return

    switch (message.type) {
      case 'card:update':
      case 'card:create':
      case 'card:delete':
        // 更新 Store (乐观更新已处理)
        useBoardStore().applyRemoteChange(message)
        break
      case 'list:reorder':
        useBoardStore().applyRemoteReorder(message)
        break
      case 'user:join':
      case 'user:leave':
        realtime.updateOnlineUsers(message)
        break
      case 'comment:create':
        // 显示通知
        useNotification().show({
          type: 'comment',
          from: message.userName,
          boardId: message.boardId,
        })
        break
    }
  }

  function startHeartbeat() {
    heartbeatTimer = setInterval(() => {
      send({ type: 'notification', boardId, userId: user.value!.id, userName: '', payload: { event: 'ping' }, timestamp: Date.now() })
    }, HEARTBEAT_INTERVAL)
  }

  function stopHeartbeat() {
    clearInterval(heartbeatTimer!)
    heartbeatTimer = null
  }

  function scheduleReconnect() {
    if (reconnectAttempts.value >= MAX_RECONNECT) return
    reconnectAttempts.value++
    const delay = RECONNECT_DELAY * Math.min(2 ** reconnectAttempts.value, 30)
    reconnectTimer = setTimeout(connect, delay)
  }

  function disconnect() {
    ws?.close()
    clearTimeout(reconnectTimer!)
    clearInterval(heartbeatTimer!)
    ws = null
  }

  // 自动连接/断开
  watch(() => boardId, (id) => {
    disconnect()
    if (id) connect()
  }, { immediate: true })

  onUnmounted(disconnect)

  return {
    isConnected,
    reconnectAttempts,
    send,
    disconnect,
  }
}
```

#### useDragDrop — 拖拽排序 Composable

```typescript
// composables/useDragDrop.ts
export interface DragItem {
  id: string
  type: string
  index: number
}

export function useDragDrop<T extends { id: string }>(
  items: Ref<T[]>,
  onReorder: (items: T[], fromIndex: number, toIndex: number) => void
) {
  const dragItem = ref<DragItem | null>(null)
  const overItemId = ref<string | null>(null)
  const dragOverIndex = ref(-1)

  function onDragStart(item: T, index: number) {
    dragItem.value = { id: item.id, type: 'card', index }
  }

  function onDragOver(e: DragEvent, itemId: string, index: number) {
    e.preventDefault()
    overItemId.value = itemId
    dragOverIndex.value = index
  }

  function onDrop() {
    if (!dragItem.value || dragOverIndex.value === -1) return

    const fromIndex = dragItem.value.index
    const toIndex = dragOverIndex.value

    if (fromIndex !== toIndex) {
      // 乐观更新
      const newItems = [...items.value]
      const [removed] = newItems.splice(fromIndex, 1)
      newItems.splice(toIndex, 0, removed)
      items.value = newItems

      // 通知父级持久化
      onReorder(newItems, fromIndex, toIndex)
    }

    dragItem.value = null
    overItemId.value = null
    dragOverIndex.value = -1
  }

  function onDragEnd() {
    dragItem.value = null
    overItemId.value = null
    dragOverIndex.value = -1
  }

  return {
    dragItem,
    overItemId,
    dragOverIndex,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    // 拖拽样式
    getDragClass: (itemId: string) => ({
      'opacity-50': dragItem.value?.id === itemId,
      'border-t-2 border-blue-500': overItemId.value === itemId,
    }),
  }
}
```

### 4.5 Pinia Store 架构

```typescript
// stores/board.store.ts
import { defineStore } from 'pinia'

export const useBoardStore = defineStore('board', () => {
  // 状态
  const boards = ref(new Map<string, Board>())
  const currentBoardId = ref<string | null>(null)

  // Getters
  const currentBoard = computed(() =>
    currentBoardId.value ? boards.value.get(currentBoardId.value) : null
  )

  const allCards = computed(() =>
    Array.from(boards.value.values())
      .flatMap(b => b.lists.flatMap(l => l.cards))
  )

  // Actions
  function setBoard(board: Board) {
    boards.value.set(board.id, board)
    currentBoardId.value = board.id
  }

  function updateBoard(id: string, patch: Partial<Board>) {
    const board = boards.value.get(id)
    if (board) Object.assign(board, patch)
  }

  function removeBoard(id: string) {
    boards.value.delete(id)
    if (currentBoardId.value === id) {
      currentBoardId.value = null
    }
  }

  function reorderLists(boardId: string, listIds: string[]) {
    const board = boards.value.get(boardId)
    if (!board) return
    board.lists.sort((a, b) =>
      listIds.indexOf(a.id) - listIds.indexOf(b.id)
    )
  }

  function moveCard(cardId: string, toListId: string, toIndex: number) {
    // 从原列表移除
    for (const board of boards.value.values()) {
      for (const list of board.lists) {
        const idx = list.cards.findIndex(c => c.id === cardId)
        if (idx !== -1) {
          const [card] = list.cards.splice(idx, 1)
          // 找到目标列表
          const targetList = board.lists.find(l => l.id === toListId)
          if (targetList) {
            targetList.cards.splice(toIndex, 0, card)
          }
          return
        }
      }
    }
  }

  // 远程变更应用 (WebSocket 驱动)
  function applyRemoteChange(message: WSMessage) {
    const board = boards.value.get(message.boardId)
    if (!board) return

    switch (message.type) {
      case 'card:update':
        const updated = message.payload as Card
        for (const list of board.lists) {
          const idx = list.cards.findIndex(c => c.id === updated.id)
          if (idx !== -1) {
            list.cards[idx] = { ...list.cards[idx], ...updated }
            return
          }
        }
        break
      case 'card:create':
        const newCard = message.payload as Card
        const targetList = board.lists.find(l => l.id === newCard.listId)
        if (targetList) targetList.cards.push(newCard)
        break
      case 'card:delete':
        const deletedId = message.payload as string
        for (const list of board.lists) {
          const idx = list.cards.findIndex(c => c.id === deletedId)
          if (idx !== -1) { list.cards.splice(idx, 1); return }
        }
        break
    }
  }

  return {
    boards, currentBoardId, currentBoard, allCards,
    setBoard, updateBoard, removeBoard,
    reorderLists, moveCard, applyRemoteChange,
  }
}, {
  // 持久化插件
  persist: {
    key: 'cloudboard-board',
    pick: ['currentBoardId'],
  },
})
```

### 4.6 页面级架构 — 看板详情页

```vue
<!-- pages/board/[id].vue -->
<script setup lang="ts">
// ─── 服务端数据获取 (SSR for 公开看板) ───
const route = useRoute()
const boardId = route.params.id as string

// SSR 数据获取 (仅服务端执行)
const { data: board, pending: loading } = await useFetch(`/api/boards/${boardId}`, {
  // 缓存策略: 1 分钟
  getCachedData: key => useNuxtData(key).data.value,
})

// SEO
useSeoMeta({
  title: board.value?.title ? `${board.value.title} - CloudBoard` : 'CloudBoard',
  description: board.value?.description || '团队协作看板',
})

// ─── 客户端交互逻辑 ───
const { user, isAuthenticated } = useAuth()
const { hasPermission } = usePermission()

// 看板操作
const {
  currentBoard, lists, cards,
  loadBoard, reorderLists, moveCard,
  createCard, updateCard, deleteCard,
  search, searchResults,
} = useBoard(boardId)

// 实时协作
const { isConnected, send: wsSend } = useWebSocket(boardId)

// 拖拽
const {
  dragItem, overItemId, dragOverIndex,
  onDragStart, onDragOver, onDrop, onDragEnd,
  getDragClass,
} = useDragDrop(cards, async (newCards, fromIndex, toIndex) => {
  // 拖拽结束后持久化
  const card = newCards[toIndex]
  const fromList = lists.value.find(l => l.cards.includes(card))
  // 后端持久化由 useBoard 的 moveCard 处理
})

// 加载看板数据 (客户端)
if (!board.value && isAuthenticated.value) {
  await loadBoard(boardId)
}

// 实时协作: 卡片更新时广播
watch(cards, (newCards) => {
  wsSend({
    type: 'card:update',
    boardId,
    userId: user.value!.id,
    userName: user.value!.name,
    payload: newCards,
  })
}, { deep: true })

// 在线用户
const { onlineUsers } = storeToRefs(useRealtimeStore())
</script>

<template>
  <div class="board-page">
    <!-- 看板头部 -->
    <BoardHeader
      :board="currentBoard"
      :is-connected="isConnected"
      :online-users="onlineUsers"
    />

    <!-- 连接状态指示器 -->
    <div v-if="!isConnected" class="connection-warning">
      ⚠️ 实时协作已断开，正在重连...
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <Input
        placeholder="搜索卡片..."
        @input="search"
      />
    </div>

    <!-- 看板列表 -->
    <div class="board-lists" @drop="onDrop" @dragover="onDragOver">
      <BoardList
        v-for="list in lists"
        :key="list.id"
        :list="list"
        :cards="list.cards"
        :drag-class="getDragClass"
        @dragstart="onDragStart"
        @dragover="onDragOver"
        @dragend="onDragEnd"
        @create-card="createCard"
        @move-card="moveCard"
      />
    </div>
  </div>
</template>
```

### 4.7 架构分层与数据流

```
┌─────────────────────────────────────────────────────────────────┐
│                     CloudBoard 完整架构                          │
│                                                                 │
│  ┌───────────┐    ┌───────────┐    ┌───────────┐               │
│  │  Pages    │    │ Layouts   │    │ Components │               │
│  │ (路由层)   │    │ (布局层)   │    │ (UI 层)   │               │
│  └─────┬─────┘    └─────┬─────┘    └─────┬─────┘               │
│        │                │                │                      │
│        └────────────────┼────────────────┘                      │
│                         ▼                                       │
│              ┌─────────────────────┐                            │
│              │   Composables 层    │                            │
│              │ useBoard/useCard/   │                            │
│              │ useWebSocket/       │                            │
│              │ useDragDrop/        │                            │
│              │ useAuth/useSearch   │                            │
│              └─────────┬───────────┘                            │
│                        │                                        │
│              ┌─────────┴───────────┐                            │
│              │   Pinia Stores 层   │                            │
│              │ board/auth/         │                            │
│              │ notification/       │                            │
│              │ realtime/ui         │                            │
│              └─────────┬───────────┘                            │
│                        │                                        │
│        ┌───────────────┼───────────────┐                       │
│        ▼               ▼               ▼                       │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                   │
│  │ REST API │   │ WebSocket│   │ Local    │                   │
│  │ (CRUD)   │   │ (实时)   │   │ Storage  │                   │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘                   │
│       │              │              │                          │
│       ▼              ▼              ▼                          │
│  ┌─────────────────────────────────────┐                       │
│  │         Nuxt Server (SSR/API)       │                       │
│  └─────────────────────────────────────┘                       │
│                                                                 │
│  数据流:                                                        │
│  用户操作 → Composable Action → API/WS → Store 更新 → 组件重渲染 │
│  WebSocket 消息 → Composable Handler → Store 更新 → 组件重渲染   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.8 权限架构

```typescript
// utils/permission.ts — RBAC 权限模型

type Role = 'owner' | 'admin' | 'member' | 'viewer'

interface Permission {
  action: 'create' | 'read' | 'update' | 'delete'
  resource: 'board' | 'card' | 'comment' | 'member' | 'setting'
}

// 权限矩阵
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    { action: '*', resource: '*' },  // 所有权限
  ],
  admin: [
    { action: 'create', resource: '*' },
    { action: 'read', resource: '*' },
    { action: 'update', resource: '*' },
    { action: 'delete', resource: 'board' },
    { action: 'delete', resource: 'card' },
    { action: 'delete', resource: 'comment' },
  ],
  member: [
    { action: 'create', resource: 'card' },
    { action: 'create', resource: 'comment' },
    { action: 'read', resource: '*' },
    { action: 'update', resource: 'card' },    // 只能编辑自己的卡片
    { action: 'update', resource: 'comment' },  // 只能编辑自己的评论
    { action: 'delete', resource: 'comment' },  // 只能删除自己的评论
  ],
  viewer: [
    { action: 'read', resource: '*' },
  ],
}

// composables/usePermission.ts
export function usePermission() {
  const { user } = useAuth()

  function hasPermission(action: Permission['action'], resource: Permission['resource']): boolean {
    if (!user.value) return false
    const role = user.value.role
    const perms = ROLE_PERMISSIONS[role]

    return perms.some(p =>
      (p.action === '*' || p.action === action) &&
      (p.resource === '*' || p.resource === resource)
    )
  }

  function canEditCard(card: Card): boolean {
    if (!user.value) return false
    if (hasPermission('update', 'card')) {
      // member 只能编辑自己的卡片
      if (user.value.role === 'member') {
        return card.creatorId === user.value.id
      }
      return true
    }
    return false
  }

  return { hasPermission, canEditCard }
}
```

---

## 五、架构演进路线图

### 5.1 从 MVP 到生产

```
阶段 1: MVP (Week 1-2)
├── CSR Vue 3 SPA
├── Pinia 状态管理
├── REST API (Mock → 真实)
├── 基础 CRUD (看板/卡片)
└── 目标: 核心功能可用

阶段 2: 体验优化 (Week 3-4)
├── 迁移到 Nuxt 3 (SSR 公开看板)
├── WebSocket 实时协作
├── 拖拽排序 (useDragDrop)
├── 搜索过滤 (useSearch)
└── 目标: 流畅的协作体验

阶段 3: 规模化 (Week 5-6)
├── 权限系统 (RBAC)
├── 通知中心
├── 评论系统
├── 附件上传
└── 目标: 完整功能集

阶段 4: 性能优化 (Week 7-8)
├── CDN 静态资源
├── SSR 缓存策略
├── 代码分割优化
├── 虚拟滚动 (大看板)
└── 目标: 首屏 < 2s

阶段 5: 企业化 (Week 9-10)
├── 多租户支持
├── 审计日志
├── API 限流
├── 监控告警
└── 目标: 生产就绪
```

### 5.2 架构演进原则

```
1. 简单优先: 从 CSR SPA 开始，需要 SSR 再加
2. 渐进增强: 基础功能 → 实时协作 → 权限 → 通知
3. 延迟决策: 不提前引入微前端 (3 人团队不需要)
4. 可回滚: 每个阶段独立可部署
5. 度量驱动: 用数据 (Lighthouse/错误率) 驱动优化决策
```

---

## 六、架构评审 Checklist

```
✅ 架构评审清单:

[ ] 职责分离: 组件/Composable/Store 职责清晰？
[ ] 数据流: 数据流向可预测？无循环依赖？
[ ] 类型安全: 完整的 TS 类型推导？无 any？
[ ] 错误处理: API 错误/WS 断连/边界情况有处理？
[ ] 性能: 首屏 < 2s？交互 < 100ms？
[ ] 可测试: Composable 可独立测试？Store 可 Mock？
[ ] 可维护: 新成员 1 天理解架构？
[ ] 可扩展: 新增功能不需要重构架构？
[ ] 安全: XSS/CSRF/权限校验？
[ ] SSR: 公开页 SEO 友好？
[ ] 监控: 错误追踪/性能监控/用户行为？
```

---

## 七、与前六轮的区别

| 轮次 | 日期 | 核心内容 | 本次新增 |
|------|------|----------|----------|
| v1 | 4/22 | MVC/MVVM 基础概念 | — |
| v2 | 4/26 | 七种模式对比 + 选型决策树 | — |
| v3 | 4/27 | BFF/事件驱动 + 架构模拟器 | — |
| v4 | 4/28 | 三大模式手写实现 | — |
| v5 | 4/29 | 架构决策矩阵 + 从零设计 | — |
| v6 | 4/30 | 融合架构 + 渐进迁移 + CloudBoard | — |
| **v7** | **5/1** | **Composition 架构 / RSC / Edge 架构 / 完整 Vue 3 应用** | **Composable 架构模式 (4 种) / RSC 架构 / Edge 渲染 / 完整 CloudBoard 架构 (含 Composables/Stores/权限/WS)** |

**v7 独特价值:**
1. **Composable 架构**: 将 Vue 3 Composition API 提升为架构层面的设计模式（状态型/副作用型/组合型/DI 型）
2. **服务端组件**: RSC 架构全景 + Vue/Nuxt 方案对比
3. **Edge 渲染**: ISR/On-Demand/Edge SSR 三种模式
4. **完整应用**: CloudBoard 从需求分析到目录结构到核心代码的完整架构设计
5. **实战 Composables**: useBoard/useWebSocket/useDragDrop 完整实现

---

*产出: ~45KB 文档，含 20+ 代码示例 + 完整应用架构*
*累计总专项: 126 个*
