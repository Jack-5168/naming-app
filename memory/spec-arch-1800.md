# 专项训练 18:00 — 前端架构模式

> 主题：MVC / MVVM / 微前端 | 设计 1 个完整应用架构
> 2026-05-08

---

## Part 1：三大架构模式对比

### 1. MVC（Model-View-Controller）

**核心思想：** 将应用分为三层，Controller 作为用户输入的中转站。

```
用户 → Controller → Model（数据变更）→ View（重新渲染）
```

**经典实现：** Ruby on Rails、早期 Backbone.js、AngularJS（伪 MVC）

**代码示例：**

```js
// Model
class UserModel {
  constructor() { this.data = { name: '', email: '' }; this.listeners = []; }
  get(key) { return this.data[key]; }
  set(key, value) { this.data[key] = value; this.notify(); }
  subscribe(fn) { this.listeners.push(fn); }
  notify() { this.listeners.forEach(fn => fn(this.data)); }
}

// View
class UserView {
  constructor(container, model) {
    this.container = container;
    this.model = model;
    this.render();
    this.model.subscribe(() => this.render());
  }
  render() {
    const d = this.model.data;
    this.container.innerHTML = `
      <h1>${d.name || '未命名'}</h1>
      <p>${d.email || '未设置邮箱'}</p>
    `;
  }
}

// Controller
class UserController {
  constructor(model, view) {
    this.model = model;
    this.view = view;
  }
  setName(name) { this.model.set('name', name); }
  setEmail(email) { this.model.set('email', email); }
}

// 使用
const model = new UserModel();
const view = new UserView(document.getElementById('app'), model);
const controller = new UserController(model, view);
controller.setName('张三');
```

**优点：** 关注点分离、Model 可复用、易于单元测试
**缺点：** Controller 容易膨胀为"上帝对象"、View 和 Model 耦合（View 需要知道 Model 的结构）
**适用场景：** 传统服务端渲染应用、中小型项目

---

### 2. MVVM（Model-View-ViewModel）

**核心思想：** ViewModel 作为 View 的"数据模型"，通过双向绑定自动同步。

```
View ↔ ViewModel（双向绑定）↔ Model（业务数据）
```

**经典实现：** Vue.js、React（单向数据流变体）、Angular、WPF

**代码示例（Vue 风格）：**

```vue
<!-- View -->
<template>
  <div class="user-profile">
    <h1>{{ displayName }}</h1>
    <p>{{ user.email }}</p>
    <button @click="save">保存</button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useUserService } from '@/services/user'

// Model 层：业务服务
const userService = useUserService()

// ViewModel 层：响应式状态 + 计算属性
const user = ref({ name: '', email: '' })
const isLoading = ref(false)

const displayName = computed(() => {
  return user.value.name || '未命名用户'
})

// View 方法
async function save() {
  isLoading.value = true
  try {
    await userService.update(user.value)
  } finally {
    isLoading.value = false
  }
}
</script>
```

**关键点：**
- ViewModel 不包含 DOM 操作，只暴露数据和命令
- View 通过声明式绑定（`{{ }}`、`v-model`、`@click`）与 ViewModel 连接
- 计算属性（computed）是 MVVM 的精髓：从原始数据派生展示数据

**优点：** 双向绑定减少样板代码、ViewModel 可独立测试、模板与逻辑分离
**缺点：** 过度绑定导致数据流不透明、大型项目调试困难
**适用场景：** 现代 SPA、中大型前端应用

---

### 3. 微前端（Micro-Frontends）

**核心思想：** 将前端应用拆分为多个独立开发、独立部署的子应用。

```
┌─────────────────────────────────┐
│         主应用 (Shell)           │
│  ┌─────────┐ ┌─────────┐       │
│  │ 子应用 A │ │ 子应用 B │ ...   │
│  │(独立仓库)│ │(独立仓库)│       │
│  └─────────┘ └─────────┘       │
└─────────────────────────────────┘
```

**主流方案对比：**

| 方案 | 原理 | 隔离性 | 性能 | 复杂度 |
|------|------|--------|------|--------|
| **qiankun** | JS 沙箱 + CSS 隔离 | 高 | 中 | 中 |
| **Module Federation** | Webpack 5 远程模块 | 中 | 高 | 低 |
| **iframe** | 原生隔离 | 最高 | 低 | 最低 |
| **Web Components** | 自定义元素 | 高 | 高 | 中 |

**qiankun 示例：**

```js
// 主应用 main.ts
import { registerMicroApps, start } from 'qiankun'

registerMicroApps([
  {
    name: 'app-user',
    entry: '//localhost:8081',
    container: '#subapp-container',
    activeRule: '/user',
  },
  {
    name: 'app-order',
    entry: '//localhost:8082',
    container: '#subapp-container',
    activeRule: '/order',
  },
])

start({ sandbox: { strictStyleIsolation: true } })
```

```js
// 子应用 main.ts（app-user）
export async function bootstrap() { console.log('User App bootstrapped') }
export async function mount(props) {
  // props 可接收主应用传递的数据
  renderApp(props.container)
}
export async function unmount() { cleanup() }
```

**Module Federation 示例：**

```js
// 远程应用 webpack.config.js
new ModuleFederationPlugin({
  name: 'remoteApp',
  filename: 'remoteEntry.js',
  exposes: {
    './Button': './src/Button.vue',
    './Cart': './src/Cart.vue',
  },
  shared: ['vue', 'vue-router', 'pinia']
})

// 宿主应用
new ModuleFederationPlugin({
  remotes: {
    remoteApp: 'remoteApp@//localhost:3001/remoteEntry.js'
  }
})

// 使用远程组件
import Button from 'remoteApp/Button'
```

**架构决策树：**
- 需要完全独立部署 → qiankun
- 同构技术栈、追求性能 → Module Federation
- 遗留系统集成 → iframe
- 跨框架复用组件 → Web Components

---

## Part 2：完整应用架构设计

### 项目：企业级项目管理平台「TaskFlow」

**需求：** 支持多租户、多项目、看板/甘特图视图、实时协作、权限管理。

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    微前端 Shell (主应用)                      │
│  职责：路由分发、布局、全局状态、用户认证、主题切换              │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│  工作台   │  项目管理 │  团队协作 │  数据分析 │  系统设置       │
│  (子应用) │  (子应用) │  (子应用) │  (子应用) │  (子应用)       │
└──────────┴──────────┴──────────┴──────────┴─────────────────┘
```

### 每个子应用内部架构（MVVM + 分层）

```
子应用/
├── api/              # API 层（请求封装、拦截器）
│   ├── http.ts       #   axios 实例
│   └── modules/      #   按模块组织
├── store/            # 状态层（Pinia）
│   ├── index.ts
│   └── modules/
├── views/            # View 层（页面组件）
│   ├── Dashboard.vue
│   └── ProjectDetail.vue
├── components/       # 视图组件
│   ├── common/       #   子应用内通用
│   └── business/     #   业务组件
├── composables/      # ViewModel 逻辑（组合式函数）
│   ├── useProject.ts
│   └── useRealtime.ts
├── router/           # 路由
├── types/            # TypeScript 类型
└── utils/            # 工具函数
```

### 核心代码设计

#### 1. 主应用 Shell

```vue
<!-- ShellApp.vue -->
<template>
  <div class="shell">
    <AppHeader :user="currentUser" @toggle-sidebar="sidebarOpen = !sidebarOpen" />
    <aside v-show="sidebarOpen" class="sidebar">
      <AppMenu :routes="registeredRoutes" />
    </aside>
    <main class="content">
      <div id="subapp-container"></div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/store/auth'
import { registerMicroApps } from 'qiankun'

const authStore = useAuthStore()
const currentUser = computed(() => authStore.user)
const sidebarOpen = ref(true)

// 动态注册子应用（根据权限）
const registeredRoutes = computed(() => {
  return authStore.hasPermission('project') ? [
    { name: '工作台', path: '/dashboard' },
    { name: '项目管理', path: '/projects' },
    { name: '团队协作', path: '/team' },
    { name: '数据分析', path: '/analytics' },
  ] : []
})

// 主应用与子应用通信
const globalState = {
  user: currentUser,
  theme: computed(() => authStore.theme),
  actions: {
    updateTheme: (t: string) => authStore.setTheme(t),
    notify: (msg: string) => authStore.addNotification(msg),
  }
}

registerMicroApps(subApps, {
  beforeLoad: app => console.log('Loading:', app.name),
  afterMount: app => console.log('Mounted:', app.name),
})
</script>
```

#### 2. 子应用：项目管理（MVVM 分层）

```ts
// api/modules/project.ts
import http from '../http'

export interface Project {
  id: string
  name: string
  status: 'active' | 'archived'
  progress: number
  members: User[]
  createdAt: string
}

export const projectApi = {
  list: (params: { page: number; status?: string }) =>
    http.get<Project[]>('/projects', { params }),
  get: (id: string) => http.get<Project>(`/projects/${id}`),
  create: (data: Omit<Project, 'id' | 'createdAt'>) =>
    http.post<Project>('/projects', data),
  update: (id: string, data: Partial<Project>) =>
    http.patch<Project>(`/projects/${id}`, data),
}
```

```ts
// store/modules/project.ts
import { defineStore } from 'pinia'
import { projectApi, type Project } from '@/api/modules/project'

export const useProjectStore = defineStore('project', () => {
  // 状态
  const projects = ref<Project[]>([])
  const currentProject = ref<Project | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性（ViewModel 核心）
  const activeProjects = computed(() =>
    projects.value.filter(p => p.status === 'active')
  )
  const totalProgress = computed(() => {
    if (activeProjects.value.length === 0) return 0
    return activeProjects.value.reduce((sum, p) => sum + p.progress, 0)
      / activeProjects.value.length
  })

  // 动作
  async function fetchProjects(status?: string) {
    loading.value = true
    error.value = null
    try {
      projects.value = await projectApi.list({ page: 1, status })
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载失败'
    } finally {
      loading.value = false
    }
  }

  async function selectProject(id: string) {
    currentProject.value = await projectApi.get(id)
  }

  return {
    projects, currentProject, loading, error,
    activeProjects, totalProgress,
    fetchProjects, selectProject,
  }
})
```

```ts
// composables/useProject.ts
import { useProjectStore } from '@/store/modules/project'
import { useTaskStore } from '@/store/modules/task'

/**
 * ViewModel 组合式函数
 * 封装页面级业务逻辑，View 只负责展示
 */
export function useProjectDetail(projectId: string) {
  const projectStore = useProjectStore()
  const taskStore = useTaskStore()

  const tasks = computed(() => taskStore.tasksByProject(projectId))
  const completedCount = computed(() => tasks.value.filter(t => t.done).length)
  const progress = computed(() =>
    tasks.value.length > 0
      ? Math.round((completedCount.value / tasks.value.length) * 100)
      : 0
  )

  async function load() {
    await Promise.all([
      projectStore.selectProject(projectId),
      taskStore.fetchByProject(projectId),
    ])
  }

  return {
    project: computed(() => projectStore.currentProject),
    tasks, completedCount, progress,
    load,
  }
}
```

```vue
<!-- views/ProjectDetail.vue -->
<template>
  <!-- View 层：纯展示，无业务逻辑 -->
  <div class="project-detail">
    <div v-if="loading" class="loading">加载中...</div>
    <template v-else>
      <h1>{{ project?.name }}</h1>
      <div class="progress-bar">
        <div class="fill" :style="{ width: progress + '%' }"></div>
      </div>
      <span>{{ completedCount }}/{{ tasks.length }} 任务完成</span>

      <TaskList :tasks="tasks" @toggle="toggleTask" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { useProjectDetail } from '@/composables/useProject'
import TaskList from '@/components/business/TaskList.vue'

const props = defineProps<{ projectId: string }>()

const { project, tasks, completedCount, progress, loading, load } =
  useProjectDetail(props.projectId)

async function toggleTask(taskId: string) {
  // 这里调用 store 的 action
  // View 不直接操作 Model
}

onMounted(load)
</script>
```

#### 3. 跨子应用通信

```ts
// shared/message-bus.ts
import { EventEmitter } from 'events'

class EventBus {
  private emitter = new EventEmitter()

  emit(event: string, data?: any) {
    window.dispatchEvent(new CustomEvent(event, { detail: data }))
  }

  on(event: string, handler: (data: any) => void) {
    window.addEventListener(event, (e: any) => handler(e.detail))
  }

  off(event: string, handler: (data: any) => void) {
    window.removeEventListener(event, handler)
  }
}

export const bus = new EventBus()

// 使用示例：项目管理子应用通知团队协作子应用
// 发送方
bus.emit('project:created', { id: 'p-123', name: '新项目' })

// 接收方
bus.on('project:created', (data) => {
  console.log('新项目已创建:', data.name)
})
```

### 架构决策记录（ADR）

| 决策 | 选择 | 理由 |
|------|------|------|
| 微前端方案 | qiankun | 子应用独立部署、技术栈可异构、团队自治 |
| 子应用框架 | Vue 3 | 团队熟悉、组合式 API 天然适配 MVVM、生态成熟 |
| 状态管理 | Pinia | Vue 3 官方推荐、TypeScript 友好、轻量 |
| 通信机制 | CustomEvent + 主应用 globalState | 简单场景用事件，全局状态走主应用下发 |
| 样式隔离 | strictStyleIsolation | qiankun 内置 Shadow DOM 隔离，避免样式冲突 |
| 构建工具 | Vite（子应用）+ Webpack 5（主应用） | 子应用追求开发体验，主应用需要 MF 兼容 |

---

## Part 3：实战练习

### 练习 1：MVC → MVVM 重构

将以下 MVC 代码重构为 MVVM 风格：

```js
// MVC 版本（待重构）
class TodoApp {
  constructor() {
    this.todos = []
    this.input = document.getElementById('input')
    this.list = document.getElementById('list')
    this.count = document.getElementById('count')
    document.getElementById('add').onclick = () => this.add()
  }
  add() {
    const text = this.input.value.trim()
    if (!text) return
    this.todos.push({ text, done: false })
    this.render()
    this.input.value = ''
  }
  render() {
    this.list.innerHTML = this.todos.map((t, i) =>
      `<li><input type="checkbox" ${t.done ? 'checked' : ''}
        onchange="app.todos[${i}].done=!app.todos[${i}].done;app.render()">
        ${t.text}</li>`
    ).join('')
    this.count.textContent = `${this.todos.filter(t => t.done).length}/${this.todos.length}`
  }
}
```

**MVVM 重构：**

```vue
<template>
  <div class="todo-app">
    <input v-model="newTodo" @keyup.enter="add" placeholder="添加任务..." />
    <button @click="add">添加</button>
    <ul>
      <li v-for="(todo, i) in todos" :key="i">
        <input type="checkbox" v-model="todo.done" />
        <span :class="{ done: todo.done }">{{ todo.text }}</span>
      </li>
    </ul>
    <p>{{ doneCount }}/{{ todos.length }} 已完成</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

// Model
const todos = ref<{ text: string; done: boolean }[]>([])
const newTodo = ref('')

// ViewModel
const doneCount = computed(() => todos.value.filter(t => t.done).length)

// 动作
function add() {
  const text = newTodo.value.trim()
  if (!text) return
  todos.value.push({ text, done: false })
  newTodo.value = ''
}
</script>
```

**对比：**
- MVC 版本：手动 DOM 操作、手动绑定事件、手动更新计数
- MVVM 版本：声明式绑定、自动响应、逻辑与视图完全分离

### 练习 2：微前端拆分策略

假设你有一个 50 万行的单体前端应用，如何拆分？

**拆分步骤：**

1. **识别边界**（Domain-Driven Design）
   - 用户域：注册、登录、个人中心
   - 商品域：商品列表、详情、搜索
   - 订单域：下单、支付、售后
   - 管理域：后台管理、数据分析

2. **确定拆分顺序**（从边缘到核心）
   - 第一批：管理域（独立后台，无用户态依赖）
   - 第二批：用户域（认证可独立部署）
   - 第三批：商品域（只读为主，耦合低）
   - 第四批：订单域（核心链路，最后迁移）

3. **共享依赖提取**
   ```
   shared/
   ├── ui/          # 公共组件库（Button、Table、Form）
   ├── utils/       # 工具函数
   ├── types/       # 公共类型定义
   └── config/      # 环境配置
   ```

4. **渐进式迁移**
   - 先用 iframe 包裹子应用验证可行性
   - 再切换到 qiankun 实现无缝集成
   - 最后优化：共享依赖、预加载、按需加载

---

## 总结

| 模式 | 核心 | 关键词 | 最佳实践 |
|------|------|--------|----------|
| MVC | Controller 中转 | 关注点分离 | Controller 瘦身、Model 可复用 |
| MVVM | 双向绑定 | 声明式、计算属性 | ViewModel 不含 DOM、View 纯展示 |
| 微前端 | 独立部署 | 子应用自治、隔离 | 按业务域拆分、渐进迁移 |

**架构选择原则：**
1. 小项目 → MVVM（Vue/React 内置）
2. 中大型项目 → MVVM + 分层架构
3. 多团队/多业务线 → 微前端 + 子应用 MVVM
