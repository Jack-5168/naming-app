# 🏗️ 前端架构设计专项 — 架构决策实战 + 完整应用从零设计

**时间：** 2026-04-29 18:00  
**主题：** 架构决策框架 + 完整应用从零设计 + 架构演进路径  
**前置：** 4/22 MVC/MVVM 基础 → 4/26 终极整合 → 4/27 BFF/事件驱动 → 4/28 三大模式手写  
**本次新增：** 架构决策决策矩阵 / 真实项目架构设计全流程 / 架构演进路线图 / 架构评审 Checklist / 反模式识别

---

## 一、架构决策框架 — 不只是选框架，是选未来

### 1.1 架构决策的六个维度

```
选架构 ≠ 选框架
选架构 = 选团队的开发方式 × 选系统的演进方向 × 选维护成本

┌─────────────────────────────────────────────────────────┐
│              架构决策六维模型                              │
│                                                         │
│    团队规模 ───── 技术栈成熟度                            │
│       │                    │                            │
│       ▼                    ▼                            │
│  开发效率 ◄──────►  运行性能                              │
│       │                    │                            │
│       ▼                    ▼                            │
│    可维护性 ◄──────►  可扩展性                            │
│                                                         │
│    核心：在六个维度间找到平衡点，而非追求单一维度最优        │
└─────────────────────────────────────────────────────────┘
```

### 1.2 架构决策矩阵 — 项目类型 → 架构模式

```typescript
interface ArchitectureDecision {
  projectType: string;
  teamSize: number;
  complexity: 'low' | 'medium' | 'high' | 'very-high';
  timeline: 'short' | 'medium' | 'long';
  recommended: string[];
  avoid: string[];
  reasoning: string;
}

const decisionMatrix: ArchitectureDecision[] = [
  {
    projectType: '营销落地页 / 活动页',
    teamSize: 1-2,
    complexity: 'low',
    timeline: 'short',
    recommended: ['纯 HTML/CSS/JS', 'Vite + 轻量框架'],
    avoid: ['微前端', '状态管理库', '复杂分层'],
    reasoning: '简单项目用简单架构，过度设计 = 技术债'
  },
  {
    projectType: '中小型 CRUD 后台',
    teamSize: 2-5,
    complexity: 'medium',
    timeline: 'medium',
    recommended: ['Vue3 + Pinia + Vite', 'React + Zustand + Vite'],
    avoid: ['微前端', 'Redux Toolkit (过重)', '自研状态管理'],
    reasoning: '中等规模用成熟方案，团队效率 > 架构优雅'
  },
  {
    projectType: '大型 SaaS 平台',
    teamSize: 5-20,
    complexity: 'high',
    timeline: 'long',
    recommended: ['微前端 (qiankun/Module Federation)', 'Monorepo', '设计模式体系'],
    avoid: ['单文件组件堆砌', '全局状态一把梭', '无架构分层'],
    reasoning: '大团队需要隔离，微前端解决协作问题'
  },
  {
    projectType: '数据密集型仪表盘',
    teamSize: 3-8,
    complexity: 'high',
    timeline: 'medium',
    recommended: ['Signals 响应式', '虚拟列表', 'Web Worker', '增量渲染'],
    avoid: ['全量 DOM 更新', '同步大数据渲染', '无虚拟化的长列表'],
    reasoning: '性能优先，架构服务于渲染效率'
  },
  {
    projectType: '实时协作工具',
    teamSize: 5-15,
    complexity: 'very-high',
    timeline: 'long',
    recommended: ['CRDT/OT 算法', 'WebSocket 架构', '事件溯源', '乐观更新'],
    avoid: ['轮询', '中心化状态', '无冲突解决'],
    reasoning: '协作场景需要分布式思维'
  }
];
```

### 1.3 架构决策流程图 — 从零开始选架构

```
开始
 │
 ├─ 项目规模？
 │  ├─ < 5 页面 → 轻量方案 (Vite + 单框架)
 │  ├─ 5-50 页面 → 中等方案 (框架 + 状态管理 + 路由)
 │  └─ > 50 页面 → 重量方案 (微前端 + Monorepo + 架构分层)
 │
 ├─ 团队规模？
 │  ├─ 1-3 人 → 简单架构，减少沟通成本
 │  ├─ 3-10 人 → 中等架构，适度分层
 │  └─ > 10 人 → 隔离架构，微前端/子应用
 │
 ├─ 更新频率？
 │  ├─ 低频 (月级) → 传统部署
 │  ├─ 中频 (周级) → CI/CD + 自动化测试
 │  └─ 高频 (日级) → 微前端独立部署 + 特性开关
 │
 ├─ 性能要求？
 │  ├─ 普通 → 标准 SSR/CSR
 │  ├─ 高性能 → SSR + 流式渲染 + 边缘计算
 │  └─ 极致性能 → WASM + Web Worker + 增量渲染
 │
 └─ 输出架构方案 ✓
```

---

## 二、架构反模式识别 — 知道什么不该做

### 2.1 十大架构反模式

```typescript
// 反模式 1: God Component (上帝组件)
// 症状：一个组件 2000+ 行，包含业务逻辑、UI、状态管理、API 调用
// 解决：按职责拆分，单一组件不超过 300 行

// 反模式 2: Prop Drilling (属性钻取)
// 症状：数据从 App → A → B → C → D → E，每层都透传
// 解决：Context / Store / 组件组合

// 反模式 3: Callback Hell (回调地狱)
// 症状：嵌套 5+ 层回调，无法追踪数据流
// 解决：async/await + 错误边界

// 反模式 4: State Sprawl (状态扩散)
// 症状：状态散落在组件、URL、localStorage、全局变量
// 解决：单一数据源 (SSOT) 原则

// 反模式 5: Framework Lock-in (框架锁定)
// 症状：业务逻辑与框架 API 深度耦合，无法迁移
// 解决：依赖倒置，业务逻辑独立于框架

// 反模式 6: Over-Engineering (过度工程)
// 症状：3 人团队用了微前端 + 事件溯源 + CQRS
// 解决：YAGNI 原则 (You Aren't Gonna Need It)

// 反模式 7: Big Ball of Mud (泥球架构)
// 症状：无分层、无边界、无约定，所有人改所有文件
// 解决：引入基础分层 + 模块边界

// 反模式 8: Premature Optimization (过早优化)
// 症状：项目刚开始就上了虚拟列表 + Web Worker + WASM
// 解决：先跑通，再测量，最后优化

// 反模式 9: Silent Failure (静默失败)
// 症状：错误被 catch 后吞掉，用户看到空白页面
// 解决：错误边界 + 错误上报 + 降级 UI

// 反模式 10: Architecture by Trend (跟风架构)
// 症状：因为流行选架构，不考虑实际需求
// 解决：基于需求选架构，而非基于热度
```

### 2.2 反模式检测工具 — 架构健康度扫描

```typescript
/**
 * 架构健康度扫描器
 * 自动检测项目中的架构反模式
 */
class ArchitectureHealthChecker {
  /**
   * 检测 God Component
   * 标准：单文件 > 500 行 或 函数 > 50 行
   */
  detectGodComponent(files: FileInfo[]): GodComponentReport[] {
    return files
      .filter(f => f.lineCount > 500 || f.maxFunctionLines > 50)
      .map(f => ({
        file: f.path,
        lineCount: f.lineCount,
        maxFunctionLines: f.maxFunctionLines,
        severity: f.lineCount > 1000 ? 'critical' : 'warning',
        suggestion: this.splitStrategy(f)
      }));
  }

  /**
   * 检测 Prop Drilling
   * 标准：组件嵌套 > 4 层且存在相同 prop 透传
   */
  detectPropDrilling(componentTree: ComponentNode[]): PropDrillReport[] {
    const reports: PropDrillReport[] = [];
    
    const traverse = (node: ComponentNode, depth: number, props: Set<string>) => {
      const ownProps = new Set(node.props);
      const drilled = [...props].filter(p => ownProps.has(p));
      
      if (drilled.length > 0 && depth > 4) {
        reports.push({
          component: node.name,
          depth,
          drilledProps: drilled,
          suggestion: drilled.length > 3 ? '使用 Context/Store' : '使用组件组合'
        });
      }
      
      node.children?.forEach(c => traverse(c, depth + 1, new Set([...props, ...ownProps])));
    };
    
    componentTree.forEach(root => traverse(root, 0, new Set()));
    return reports;
  }

  /**
   * 检测 State Sprawl
   * 标准：状态来源 > 3 种 (组件 state + context + localStorage + URL + 全局变量)
   */
  detectStateSprawl(sourceFiles: string[]): StateSprawlReport {
    const sources = new Set<string>();
    
    sourceFiles.forEach(content => {
      if (/localStorage|sessionStorage/.test(content)) sources.add('Storage');
      if (/useState|useReducer|ref\(/.test(content)) sources.add('Component State');
      if (/useContext|createContext/.test(content)) sources.add('Context');
      if (/window\.\w+|global\.\w+/.test(content)) sources.add('Global Variable');
      if (/URLSearchParams|history\.push/.test(content)) sources.add('URL State');
      if (/import.*from.*store/.test(content)) sources.add('External Store');
    });
    
    return {
      sources: [...sources],
      count: sources.size,
      severity: sources.size > 4 ? 'critical' : sources.size > 3 ? 'warning' : 'ok',
      suggestion: sources.size > 3 
        ? '收敛到单一状态管理方案 (Pinia/Zustand/Redux)' 
        : '当前状态管理可接受'
    };
  }

  private splitStrategy(file: FileInfo): string {
    if (file.lineCount > 1000) return '拆分为多个子组件 + 自定义 Hook';
    if (file.maxFunctionLines > 80) return '提取业务逻辑到独立模块';
    return '按职责拆分：UI 组件 / 业务逻辑 / 数据获取';
  }
}

interface FileInfo {
  path: string;
  lineCount: number;
  maxFunctionLines: number;
}

interface GodComponentReport {
  file: string;
  lineCount: number;
  maxFunctionLines: number;
  severity: 'critical' | 'warning';
  suggestion: string;
}

interface PropDrillReport {
  component: string;
  depth: number;
  drilledProps: string[];
  suggestion: string;
}

interface StateSprawlReport {
  sources: string[];
  count: number;
  severity: 'critical' | 'warning' | 'ok';
  suggestion: string;
}
```

---

## 三、完整应用架构设计 — 从零到一全流程

### 3.1 设计场景：企业级项目管理平台 "CloudBoard"

```
需求概述：
- 多项目看板 (Kanban)
- 实时协作 (多人同时编辑)
- 任务分配与跟踪
- 文件附件管理
- 团队权限管理
- 数据报表与分析
- 移动端适配

约束条件：
- 团队 8 人 (3 前端 + 3 后端 + 2 设计)
- 6 个月上线
- 需要支持 1000+ 并发用户
- 需要国际化 (中/英)
```

### 3.2 架构决策过程

```
步骤 1: 确定架构风格
├─ 项目规模：中大型 (10+ 页面模块)
├─ 团队规模：3 前端
├─ 协作需求：实时协作
└─ 决策：Monorepo + 模块化单体 (非微前端)
    理由：3 人团队不需要微前端的复杂度，
         Monorepo 足以管理模块边界

步骤 2: 确定技术栈
├─ 框架：Vue 3 (团队熟悉度 + Composition API 适合复杂逻辑)
├─ 状态：Pinia (轻量 + TS 友好 + DevTools)
├─ 构建：Vite (快速 HMR + 原生 ESM)
├─ 路由：Vue Router (嵌套路由 + 懒加载)
├─ HTTP：Axios + 拦截器 + 重试机制
├─ 实时：WebSocket + 乐观更新 + 冲突解决
├─ UI：自研组件库 + TailwindCSS 原子化
└─ 测试：Vitest + Testing Library + Playwright

步骤 3: 确定分层架构
└─ 五层架构 (见 3.3)

步骤 4: 确定模块划分
└─ 六大模块 (见 3.4)
```

### 3.3 五层架构设计

```
┌─────────────────────────────────────────────────────┐
│                   Presentation Layer                 │
│  (展示层：组件 / 页面 / 路由 / 样式)                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐              │
│  │ 看板页面  │  │ 任务详情 │  │ 报表页面 │  ...         │
│  └─────────┘  └─────────┘  └─────────┘              │
├─────────────────────────────────────────────────────┤
│                   Application Layer                  │
│  (应用层：用例 / 流程编排 / 应用状态)                    │
│  ┌──────────────┐  ┌──────────────┐                  │
│  │ BoardUseCase  │  │ TaskUseCase   │  ...            │
│  │ (创建看板)    │  │ (分配任务)    │                  │
│  │ (移动卡片)    │  │ (更新状态)    │                  │
│  └──────────────┘  └──────────────┘                  │
├─────────────────────────────────────────────────────┤
│                    Domain Layer                      │
│  (领域层：实体 / 值对象 / 领域服务 / 领域事件)           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  Board   │  │  Task    │  │  Member  │  ...       │
│  │ (看板实体) │  │ (任务实体) │  │ (成员实体) │           │
│  └──────────┘  └──────────┘  └──────────┘           │
├─────────────────────────────────────────────────────┤
│                 Infrastructure Layer                 │
│  (基础设施层：API / 存储 / 实时通信 / 工具)              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ HttpClient│  │ WebSocket│  │ Storage  │  ...       │
│  │ (REST)   │  │ (实时)   │  │ (缓存)   │           │
│  └──────────┘  └──────────┘  └──────────┘           │
├─────────────────────────────────────────────────────┤
│                   Cross-Cutting                      │
│  (横切关注点：日志 / 错误处理 / 国际化 / 权限)            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Logger   │  │ ErrorHandler│ │ I18n   │  ...       │
│  └──────────┘  └──────────┘  └──────────┘           │
└─────────────────────────────────────────────────────┘

依赖方向：Presentation → Application → Domain ← Infrastructure
         (Domain 不依赖任何层，基础设施层实现 Domain 定义的接口)
```

### 3.4 完整项目结构

```
cloudboard/
├── packages/                          # Monorepo 包管理
│   ├── core/                          # 核心包 (领域层 + 基础设施)
│   │   ├── src/
│   │   │   ├── domain/                # 领域模型
│   │   │   │   ├── entities/
│   │   │   │   │   ├── Board.ts       # 看板实体
│   │   │   │   │   ├── Task.ts        # 任务实体
│   │   │   │   │   ├── Member.ts      # 成员实体
│   │   │   │   │   └── Comment.ts     # 评论实体
│   │   │   │   ├── value-objects/
│   │   │   │   │   ├── TaskId.ts      # 任务 ID 值对象
│   │   │   │   │   ├── TaskTitle.ts   # 任务标题值对象
│   │   │   │   │   └── Priority.ts    # 优先级值对象
│   │   │   │   ├── services/
│   │   │   │   │   ├── BoardService.ts    # 看板领域服务
│   │   │   │   │   ├── TaskService.ts     # 任务领域服务
│   │   │   │   │   └── ConflictResolver.ts # 冲突解决服务
│   │   │   │   └── events/
│   │   │   │       ├── TaskMoved.ts     # 任务移动事件
│   │   │   │       └── BoardCreated.ts  # 看板创建事件
│   │   │   ├── infrastructure/
│   │   │   │   ├── api/
│   │   │   │   │   ├── HttpClient.ts    # HTTP 客户端
│   │   │   │   │   ├── BoardApi.ts      # 看板 API
│   │   │   │   │   └── TaskApi.ts       # 任务 API
│   │   │   │   ├── realtime/
│   │   │   │   │   ├── WebSocketManager.ts  # WebSocket 管理
│   │   │   │   │   ├── SyncEngine.ts        # 同步引擎
│   │   │   │   │   └── ConflictDetector.ts  # 冲突检测
│   │   │   │   ├── storage/
│   │   │   │   │   ├── CacheManager.ts  # 缓存管理
│   │   │   │   │   └── OfflineQueue.ts  # 离线队列
│   │   │   │   └── i18n/
│   │   │   │       └── I18nManager.ts   # 国际化
│   │   │   └── shared/
│   │   │       ├── types/             # 共享类型
│   │   │       ├── utils/             # 工具函数
│   │   │       └── errors/            # 错误定义
│   │   └── package.json
│   │
│   ├── app/                           # 应用包 (应用层 + 展示层)
│   │   ├── src/
│   │   │   ├── application/
│   │   │   │   ├── use-cases/
│   │   │   │   │   ├── CreateBoard.ts
│   │   │   │   │   ├── MoveTask.ts
│   │   │   │   │   ├── AssignTask.ts
│   │   │   │   │   └── AddComment.ts
│   │   │   │   └── stores/
│   │   │   │       ├── boardStore.ts
│   │   │   │       ├── taskStore.ts
│   │   │   │       └── syncStore.ts
│   │   │   ├── presentation/
│   │   │   │   ├── pages/
│   │   │   │   │   ├── BoardPage.vue
│   │   │   │   │   ├── TaskDetailPage.vue
│   │   │   │   │   └── ReportPage.vue
│   │   │   │   ├── components/
│   │   │   │   │   ├── Board/
│   │   │   │   │   │   ├── BoardHeader.vue
│   │   │   │   │   │   ├── Column.vue
│   │   │   │   │   │   ├── TaskCard.vue
│   │   │   │   │   │   └── DragDropZone.vue
│   │   │   │   │   ├── Task/
│   │   │   │   │   │   ├── TaskForm.vue
│   │   │   │   │   │   ├── TaskTimeline.vue
│   │   │   │   │   │   └── CommentList.vue
│   │   │   │   │   └── shared/
│   │   │   │   │       ├── Modal.vue
│   │   │   │   │       ├── ConfirmDialog.vue
│   │   │   │   │       └── LoadingSpinner.vue
│   │   │   │   ├── composables/
│   │   │   │   │   ├── useBoard.ts
│   │   │   │   │   ├── useTask.ts
│   │   │   │   │   ├── useDragDrop.ts
│   │   │   │   │   └── useSyncStatus.ts
│   │   │   │   └── router/
│   │   │   │       └── index.ts
│   │   │   └── main.ts
│   │   └── package.json
│   │
│   └── ui/                            # UI 组件库
│       ├── src/
│       │   ├── Button/
│       │   ├── Input/
│       │   ├── Modal/
│       │   ├── Table/
│       │   └── index.ts
│       └── package.json
│
├── scripts/                           # 构建脚本
├── tests/                             # 集成测试
├── docs/                              # 架构文档
├── package.json                       # 根 package.json
├── turbo.json                         # Turborepo 配置
└── tsconfig.json
```

### 3.5 核心领域模型实现

```typescript
// ====== 值对象 (Value Objects) ======

/**
 * 任务 ID — 不可变、自验证
 */
class TaskId {
  private constructor(public readonly value: string) {}
  
  static create(id?: string): TaskId {
    const value = id || crypto.randomUUID();
    if (!/^[a-f0-9-]{36}$/.test(value)) {
      throw new Error(`Invalid task ID: ${value}`);
    }
    return new TaskId(value);
  }
  
  equals(other: TaskId): boolean {
    return this.value === other.value;
  }
}

/**
 * 任务标题 — 带验证规则
 */
class TaskTitle {
  private constructor(public readonly value: string) {}
  
  static create(title: string): TaskTitle {
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      throw new Error('Task title cannot be empty');
    }
    if (trimmed.length > 200) {
      throw new Error('Task title cannot exceed 200 characters');
    }
    return new TaskTitle(trimmed);
  }
}

/**
 * 优先级 — 类型安全的枚举
 */
enum Priority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CRITICAL = 3
}

const PriorityLabel: Record<Priority, string> = {
  [Priority.LOW]: '低',
  [Priority.MEDIUM]: '中',
  [Priority.HIGH]: '高',
  [Priority.CRITICAL]: '紧急'
};

// ====== 实体 (Entities) ======

/**
 * 任务实体 — 包含业务规则
 */
class Task {
  constructor(
    public readonly id: TaskId,
    private _title: TaskTitle,
    private _description: string,
    private _priority: Priority,
    private _status: 'todo' | 'in-progress' | 'review' | 'done',
    private _assigneeId: string | null,
    private _columnId: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly version: number  // 乐观锁版本号
  ) {}

  // 业务方法 (不是 getter/setter)
  assignTo(memberId: string): Task {
    return new Task(
      this.id, this._title, this._description, this._priority,
      this._status, memberId, this._columnId,
      this.createdAt, new Date(), this.version + 1
    );
  }

  moveTo(columnId: string): Task {
    const newStatus = columnId === 'done' ? 'done' : 
                       columnId === 'review' ? 'review' : 'in-progress';
    return new Task(
      this.id, this._title, this._description, this._priority,
      newStatus, this._assigneeId, columnId,
      this.createdAt, new Date(), this.version + 1
    );
  }

  updateTitle(newTitle: string): Task {
    const title = TaskTitle.create(newTitle);
    return new Task(
      this.id, title, this._description, this._priority,
      this._status, this._assigneeId, this._columnId,
      this.createdAt, new Date(), this.version + 1
    );
  }

  // 只读访问器
  get title(): string { return this._title.value; }
  get description(): string { return this._description; }
  get priority(): Priority { return this._priority; }
  get status(): string { return this._status; }
  get assigneeId(): string | null { return this._assigneeId; }
  get columnId(): string { return this._columnId; }
}

/**
 * 看板实体 — 管理列和任务
 */
class Board {
  constructor(
    public readonly id: string,
    public readonly name: string,
    private _columns: Column[],
    public readonly memberIds: string[],
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  addTask(task: Task): Board {
    const column = this._columns.find(c => c.id === task.columnId);
    if (!column) throw new Error(`Column ${task.columnId} not found`);
    
    const newColumns = this._columns.map(c =>
      c.id === task.columnId ? c.addTask(task) : c
    );
    
    return new Board(
      this.id, this.name, newColumns, this.memberIds,
      this.createdAt, new Date()
    );
  }

  moveTask(taskId: string, fromColumnId: string, toColumnId: string): Board {
    const fromColumn = this._columns.find(c => c.id === fromColumnId);
    const toColumn = this._columns.find(c => c.id === toColumnId);
    if (!fromColumn || !toColumn) {
      throw new Error('Column not found');
    }
    
    const task = fromColumn.tasks.find(t => t.id.value === taskId);
    if (!task) throw new Error('Task not found');
    
    const movedTask = task.moveTo(toColumnId);
    
    const newColumns = this._columns.map(c => {
      if (c.id === fromColumnId) return c.removeTask(taskId);
      if (c.id === toColumnId) return c.addTask(movedTask);
      return c;
    });
    
    return new Board(
      this.id, this.name, newColumns, this.memberIds,
      this.createdAt, new Date()
    );
  }

  get columns(): ReadonlyArray<Column> { return [...this._columns]; }
}

class Column {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly tasks: ReadonlyArray<Task>,
    public readonly position: number
  ) {}

  addTask(task: Task): Column {
    return new Column(this.id, this.name, [...this.tasks, task], this.position);
  }

  removeTask(taskId: string): Column {
    return new Column(
      this.id, this.name,
      this.tasks.filter(t => t.id.value !== taskId),
      this.position
    );
  }
}
```

### 3.6 应用层 — 用例实现

```typescript
/**
 * 移动任务用例 — 处理业务逻辑和协同冲突
 */
class MoveTaskUseCase {
  constructor(
    private boardRepository: BoardRepository,
    private syncEngine: SyncEngine,
    private eventBus: EventBus
  ) {}

  async execute(command: MoveTaskCommand): Promise<Result> {
    // 1. 获取当前看板
    const board = await this.boardRepository.findById(command.boardId);
    if (!board) {
      return { success: false, error: 'Board not found' };
    }

    // 2. 乐观更新 (立即更新 UI)
    const optimisticBoard = board.moveTask(
      command.taskId, command.fromColumnId, command.toColumnId
    );
    this.syncEngine.applyOptimisticUpdate(board, optimisticBoard);

    try {
      // 3. 发送到服务器
      const result = await this.boardRepository.moveTask(command);
      
      // 4. 广播事件给其他协作者
      this.eventBus.publish(new TaskMovedEvent({
        taskId: command.taskId,
        fromColumnId: command.fromColumnId,
        toColumnId: command.toColumnId,
        userId: command.userId,
        timestamp: new Date()
      }));

      return { success: true };
    } catch (error) {
      // 5. 冲突处理 — 回滚乐观更新
      if (error instanceof ConflictError) {
        const resolved = this.resolveConflict(board, error, command);
        this.syncEngine.applyResolvedUpdate(resolved);
        return { success: true, resolved: true };
      }
      
      // 6. 其他错误 — 回滚
      this.syncEngine.rollback(board);
      return { success: false, error: error.message };
    }
  }

  private resolveConflict(
    localBoard: Board,
    conflict: ConflictError,
    command: MoveTaskCommand
  ): Board {
    // 策略：最后写入获胜 (Last Write Wins) + 人工标记
    // 更复杂场景可用 CRDT
    const remoteBoard = conflict.remoteVersion;
    
    // 合并：保留远程的非冲突更改 + 应用本地操作
    const merged = this.mergeBoards(remoteBoard, localBoard, command);
    return merged;
  }
}

interface MoveTaskCommand {
  boardId: string;
  taskId: string;
  fromColumnId: string;
  toColumnId: string;
  userId: string;
}

interface Result {
  success: boolean;
  error?: string;
  resolved?: boolean;
}
```

### 3.7 实时同步架构

```typescript
/**
 * 同步引擎 — 处理多人实时协作
 */
class SyncEngine {
  private optimisticQueue: OptimisticUpdate[] = [];
  private pendingAcks: Map<string, () => void> = new Map();

  constructor(
    private ws: WebSocketManager,
    private store: BoardStore,
    private conflictResolver: ConflictResolver
  ) {}

  /**
   * 发送操作 + 乐观更新
   */
  async sendOperation(operation: Operation): Promise<void> {
    const operationId = crypto.randomUUID();
    
    // 1. 立即应用乐观更新
    this.applyOptimistic(operation);
    
    // 2. 记录待确认
    this.optimisticQueue.push({
      id: operationId,
      operation,
      timestamp: Date.now(),
      status: 'pending'
    });

    // 3. 发送到服务器
    this.ws.send({
      type: 'operation',
      id: operationId,
      payload: operation
    });

    // 4. 设置超时回滚 (5 秒)
    setTimeout(() => {
      const pending = this.optimisticQueue.find(u => u.id === operationId);
      if (pending?.status === 'pending') {
        this.rollback(operationId);
      }
    }, 5000);
  }

  /**
   * 接收远程操作
   */
  async receiveRemoteOperation(remoteOp: RemoteOperation): Promise<void> {
    // 1. 检查是否与本地待确认操作冲突
    const localPending = this.optimisticQueue.find(
      u => u.operation.type === remoteOp.operation.type &&
           u.operation.targetId === remoteOp.operation.targetId
    );

    if (localPending) {
      // 有冲突，需要解决
      const resolved = await this.conflictResolver.resolve(
        localPending.operation,
        remoteOp.operation
      );
      
      if (resolved.winner === 'remote') {
        // 远程优先，回滚本地
        this.rollback(localPending.id);
      }
      // 如果本地优先，忽略远程操作
    } else {
      // 无冲突，直接应用
      this.applyRemote(remoteOp);
    }

    // 2. 确认收到
    this.ws.send({
      type: 'ack',
      operationId: remoteOp.id
    });
  }

  /**
   * 收到服务器确认
   */
  onAck(operationId: string): void {
    const index = this.optimisticQueue.findIndex(u => u.id === operationId);
    if (index >= 0) {
      this.optimisticQueue[index].status = 'confirmed';
      this.optimisticQueue.splice(index, 1);
    }
  }

  private applyOptimal(operation: Operation): void {
    // 根据操作类型更新 store
    switch (operation.type) {
      case 'move-task':
        this.store.moveTask(operation.payload);
        break;
      case 'update-task':
        this.store.updateTask(operation.payload);
        break;
      case 'create-task':
        this.store.createTask(operation.payload);
        break;
    }
  }

  private rollback(operationId: string): void {
    const pending = this.optimisticQueue.find(u => u.id === operationId);
    if (pending) {
      // 反向操作
      this.store.reverse(pending.operation);
      pending.status = 'rolled-back';
    }
  }
}

interface Operation {
  type: 'move-task' | 'update-task' | 'create-task' | 'delete-task';
  targetId: string;
  payload: any;
  userId: string;
  timestamp: number;
}

interface RemoteOperation {
  id: string;
  operation: Operation;
  source: 'remote';
}

interface OptimisticUpdate {
  id: string;
  operation: Operation;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'rolled-back';
}
```

### 3.8 展示层 — Vue 3 组件架构

```vue
<!-- BoardPage.vue — 页面级组件 (只负责协调) -->
<script setup lang="ts">
import { useBoard } from '@/presentation/composables/useBoard'
import { useSyncStatus } from '@/presentation/composables/useSyncStatus'
import BoardHeader from '@/presentation/components/Board/BoardHeader.vue'
import Column from '@/presentation/components/Board/Column.vue'
import ConflictBanner from '@/presentation/components/shared/ConflictBanner.vue'

const props = defineProps<{ boardId: string }>()

const { board, loading, error, moveTask } = useBoard(props.boardId)
const { status: syncStatus, lastSynced } = useSyncStatus()
</script>

<template>
  <div class="board-page">
    <ConflictBanner v-if="syncStatus === 'conflict'" />
    <SyncIndicator :status="syncStatus" :last-synced="lastSynced" />
    
    <BoardHeader 
      :board="board" 
      @rename="board?.name"
    />
    
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else class="board-columns">
      <Column
        v-for="column in board?.columns"
        :key="column.id"
        :column="column"
        @drop="moveTask($event)"
      />
    </div>
  </div>
</template>
```

```typescript
// useBoard.ts — 组合式函数 (业务逻辑与 UI 解耦)
import { ref, computed } from 'vue'
import { MoveTaskUseCase } from '@/application/use-cases/MoveTask'
import { BoardRepository } from '@/infrastructure/api/BoardApi'
import { SyncEngine } from '@/infrastructure/realtime/SyncEngine'
import { EventBus } from '@/shared/events/EventBus'

export function useBoard(boardId: string) {
  const board = ref<Board | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  // 依赖注入
  const boardRepo = new BoardRepository()
  const syncEngine = new SyncEngine(wsManager, boardStore, conflictResolver)
  const eventBus = new EventBus()
  const moveTaskUseCase = new MoveTaskUseCase(boardRepo, syncEngine, eventBus)

  // 加载看板
  async function loadBoard() {
    try {
      loading.value = true
      const data = await boardRepo.findById(boardId)
      board.value = data
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  // 移动任务
  async function moveTask(payload: MoveTaskPayload) {
    const result = await moveTaskUseCase.execute({
      boardId,
      taskId: payload.taskId,
      fromColumnId: payload.fromColumnId,
      toColumnId: payload.toColumnId,
      userId: currentUser.id
    })
    
    if (!result.success) {
      error.value = result.error || '移动失败'
    }
    if (result.resolved) {
      // 冲突已解决，刷新数据
      await loadBoard()
    }
  }

  // 监听远程事件
  eventBus.subscribe('TaskMoved', (event) => {
    if (event.boardId === boardId) {
      board.value = board.value?.moveTask(
        event.taskId, event.fromColumnId, event.toColumnId
      ) ?? null
    }
  })

  loadBoard()

  return {
    board: computed(() => board.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    moveTask
  }
}
```

### 3.9 冲突解决策略

```typescript
/**
 * 冲突解决器 — 处理多人同时操作同一任务
 */
class ConflictResolver {
  /**
   * 解决冲突
   * 策略选择：
   * - 移动操作：最后写入获胜 (LWW)
   * - 内容编辑：OT (Operational Transformation)
   * - 删除操作：删除优先
   */
  async resolve(
    localOp: Operation,
    remoteOp: Operation
  ): Promise<Resolution> {
    // 同类型操作在不同目标上 → 无冲突
    if (localOp.targetId !== remoteOp.targetId) {
      return { winner: 'both', actions: ['apply-both'] };
    }

    // 不同类型操作 → 按优先级
    if (localOp.type !== remoteOp.type) {
      return this.resolveDifferentTypes(localOp, remoteOp);
    }

    // 同类型同目标 → 按策略
    switch (localOp.type) {
      case 'move-task':
        // 移动操作：时间戳晚的获胜
        return localOp.timestamp > remoteOp.timestamp
          ? { winner: 'local', actions: ['apply-local'] }
          : { winner: 'remote', actions: ['apply-remote'] };

      case 'update-task':
        // 内容编辑：字段级合并
        return this.mergeFieldUpdates(localOp, remoteOp);

      case 'delete-task':
        // 删除优先
        return { winner: 'remote', actions: ['delete'] };

      default:
        return { winner: 'remote', actions: ['apply-remote'] };
    }
  }

  private mergeFieldUpdates(
    localOp: Operation,
    remoteOp: Operation
  ): Resolution {
    const localFields = Object.keys(localOp.payload);
    const remoteFields = Object.keys(remoteOp.payload);
    const commonFields = localFields.filter(f => remoteFields.includes(f));

    if (commonFields.length === 0) {
      // 不同字段，合并
      return {
        winner: 'both',
        actions: ['merge-fields'],
        mergedPayload: { ...localOp.payload, ...remoteOp.payload }
      };
    }

    // 有冲突字段：时间戳晚的获胜
    const winner = localOp.timestamp > remoteOp.timestamp ? 'local' : 'remote';
    const mergedPayload = { ...remoteOp.payload };
    
    for (const field of commonFields) {
      mergedPayload[field] = winner === 'local' 
        ? localOp.payload[field] 
        : remoteOp.payload[field];
    }

    return {
      winner: 'merged',
      actions: ['merge-with-conflict-mark'],
      mergedPayload,
      conflictedFields: commonFields
    };
  }

  private resolveDifferentTypes(
    localOp: Operation,
    remoteOp: Operation
  ): Resolution {
    const priority: Record<string, number> = {
      'delete-task': 3,
      'move-task': 2,
      'update-task': 1,
      'create-task': 0
    };

    const localPriority = priority[localOp.type] ?? 0;
    const remotePriority = priority[remoteOp.type] ?? 0;

    if (remotePriority >= localPriority) {
      return { winner: 'remote', actions: ['apply-remote'] };
    }
    return { winner: 'local', actions: ['apply-local'] };
  }
}

interface Resolution {
  winner: 'local' | 'remote' | 'both' | 'merged';
  actions: string[];
  mergedPayload?: Record<string, any>;
  conflictedFields?: string[];
}
```

---

## 四、架构演进路线图

### 4.1 从简单到复杂的演进路径

```
阶段 1: MVP (Month 1-2)
├─ 单页面应用 (SPA)
├─ Vue 3 + Pinia + Vite
├─ REST API
├─ 无实时协作
└─ 目标：验证核心功能

阶段 2: 增强 (Month 3-4)
├─ 添加实时协作 (WebSocket)
├─ 乐观更新 + 冲突解决
├─ 离线支持 (Service Worker)
├─ 国际化 (i18n)
└─ 目标：提升用户体验

阶段 3: 规模化 (Month 5-6)
├─ Monorepo 拆分
├─ UI 组件库独立
├─ 性能优化 (虚拟列表 / 懒加载)
├─ 监控与错误追踪
└─ 目标：支撑 1000+ 并发

阶段 4: 扩展 (Month 7+)
├─ 微前端拆分 (如团队 > 10 人)
├─ 移动端 PWA
├─ 插件系统
└─ 目标：平台化
```

### 4.2 何时引入微前端

```
引入微前端的信号：
✅ 团队 > 10 人前端
✅ 子应用需要独立部署
✅ 不同子应用技术栈不同
✅ 部署频率差异大 (有的日更，有的月更)
✅ 业务线独立演进

不要引入微前端的信号：
❌ 团队 < 5 人
❌ 所有模块一起部署
❌ 技术栈统一
❌ 部署频率一致
❌ 只是为了"跟上潮流"

Monorepo vs 微前端 决策：
┌─────────────────────────────────────────────┐
│  Monorepo 适合：                              │
│  - 代码共享 (组件库、工具函数、类型定义)         │
│  - 统一构建和测试                              │
│  - 原子级重构 (改一个接口，所有包自动更新)       │
│  - 团队规模 3-10 人                            │
├─────────────────────────────────────────────┤
│  微前端适合：                                  │
│  - 独立部署 (子应用可单独发布)                   │
│  - 技术栈异构 (React + Vue 混用)               │
│  - 团队隔离 (不同团队负责不同子应用)             │
│  - 团队规模 > 10 人                            │
└─────────────────────────────────────────────┘
```

---

## 五、架构评审 Checklist

### 5.1 新架构方案评审

```markdown
## 架构评审 Checklist

### 需求覆盖
- [ ] 架构是否满足所有功能需求？
- [ ] 是否满足非功能需求 (性能/安全/可扩展)？
- [ ] 是否有未覆盖的边缘场景？

### 团队适配
- [ ] 团队是否有足够的技术能力？
- [ ] 学习成本是否可接受？
- [ ] 新人上手时间 < 3 天？

### 复杂度评估
- [ ] 是否过度设计？(YAGNI)
- [ ] 每个抽象层是否有明确的职责？
- [ ] 是否可以简化而不损失功能？

### 可维护性
- [ ] 模块边界是否清晰？
- [ ] 依赖方向是否单向？
- [ ] 是否有循环依赖？
- [ ] 代码搜索是否容易找到相关代码？

### 可测试性
- [ ] 业务逻辑是否可独立测试？
- [ ] 是否有清晰的测试分层？
- [ ] Mock 是否容易？

### 性能
- [ ] 首屏加载时间 < 3s？
- [ ] 交互响应 < 100ms？
- [ ] 是否有性能监控？

### 安全
- [ ] 是否有 XSS/CSRF 防护？
- [ ] 敏感数据是否加密？
- [ ] 权限控制是否到位？

### 演进能力
- [ ] 新增功能是否需要修改架构？
- [ ] 技术栈升级是否平滑？
- [ ] 是否有技术债追踪？
```

### 5.2 架构健康度指标

```typescript
interface ArchitectureMetrics {
  // 代码度量
  avgComponentSize: number;        // 平均组件行数 (目标: < 200)
  maxComponentSize: number;        // 最大组件行数 (目标: < 500)
  circularDependencies: number;    // 循环依赖数 (目标: 0)
  avgModuleCoupling: number;       // 平均模块耦合度 (目标: < 5)
  
  // 测试度量
  testCoverage: number;            // 测试覆盖率 (目标: > 80%)
  unitTestRatio: number;           // 单元测试占比 (目标: > 60%)
  
  // 性能度量
  bundleSize: number;              // 打包大小 (目标: < 500KB gzip)
  firstContentfulPaint: number;    // FCP (目标: < 1.5s)
  timeToInteractive: number;       // TTI (目标: < 3.5s)
  
  // 架构度量
  layerViolationCount: number;     // 分层违规数 (目标: 0)
  domainLeakageCount: number;      // 领域层泄漏数 (目标: 0)
  crossCuttingConcerns: string[];  // 横切关注点列表
}

function evaluateArchitecture(metrics: ArchitectureMetrics): ArchitectureScore {
  const scores = {
    codeQuality: Math.max(0, 100 - metrics.maxComponentSize / 10),
    maintainability: Math.max(0, 100 - metrics.circularDependencies * 20),
    testability: metrics.testCoverage * 100,
    performance: Math.max(0, 100 - (metrics.bundleSize / 5000) * 10),
    architecture: Math.max(0, 100 - metrics.layerViolationCount * 25)
  };

  const overall = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;

  return {
    scores,
    overall,
    grade: overall >= 90 ? 'A' : overall >= 80 ? 'B' : overall >= 70 ? 'C' : 'D',
    recommendations: generateRecommendations(metrics)
  };
}

function generateRecommendations(metrics: ArchitectureMetrics): string[] {
  const recs: string[] = [];
  
  if (metrics.maxComponentSize > 500) {
    recs.push('⚠️ 存在超大组件，建议拆分');
  }
  if (metrics.circularDependencies > 0) {
    recs.push('🔴 存在循环依赖，需要重构');
  }
  if (metrics.testCoverage < 80) {
    recs.push('📊 测试覆盖率不足，建议补充');
  }
  if (metrics.bundleSize > 500000) {
    recs.push('📦 打包体积过大，建议代码分割');
  }
  if (metrics.layerViolationCount > 0) {
    recs.push('🏗️ 存在分层违规，需要修复');
  }
  
  return recs;
}

interface ArchitectureScore {
  scores: Record<string, number>;
  overall: number;
  grade: 'A' | 'B' | 'C' | 'D';
  recommendations: string[];
}
```

---

## 六、面试高频考点

### 6.1 架构设计面试题

```
Q1: 如何为一个 50 人的前端团队选择架构？
A1: 
  1. 评估维度：团队规模、项目复杂度、部署频率、技术栈统一度
  2. 50 人团队 → 微前端 (qiankun/Module Federation)
  3. 子应用按业务线拆分，独立开发、独立部署
  4. 共享：UI 组件库、工具函数、类型定义、构建配置
  5. 治理：架构委员会、代码规范、CI/CD 流水线

Q2: MVC 和 MVVM 的本质区别是什么？
A2:
  MVC: Controller 主动协调 Model 和 View，数据流单向
  MVVM: ViewModel 通过数据绑定自动同步 Model 和 View，数据流双向
  本质：MVC 是命令式 (手动更新 View)，MVVM 是声明式 (绑定自动同步)

Q3: 微前端的隔离方案有哪些？
A3:
  1. JS 隔离：Snapshot (快照) / Proxy (代理) / Sandbox
  2. CSS 隔离：Shadow DOM / CSS Modules / Scoped CSS
  3. DOM 隔离：容器隔离 / 路由隔离
  4. 通信方案：CustomEvent / Props / Shared Store / URL 参数

Q4: 如何设计一个支持离线的项目管理工具？
A4:
  1. Service Worker 缓存静态资源
  2. IndexedDB 存储业务数据
  3. 操作队列 (离线时入队，上线时同步)
  4. 冲突检测 (版本号 / 时间戳)
  5. 离线 UI 提示 (连接状态指示器)

Q5: 什么是依赖倒置原则？在前端中如何应用？
A5:
  原则：高层模块不应依赖低层模块，都应依赖抽象
  前端应用：
  - 业务逻辑不依赖具体 API 实现 (依赖 Repository 接口)
  - 组件不依赖具体 Store (依赖抽象的 State 接口)
  - 好处：可替换实现、可独立测试、降低耦合

Q6: 如何评估一个架构方案的好坏？
A6:
  1. 需求覆盖度 (是否满足功能 + 非功能需求)
  2. 团队适配度 (团队能否驾驭)
  3. 复杂度 (是否过度设计)
  4. 可维护性 (新人上手时间、代码搜索效率)
  5. 可演进性 (新增需求是否需要重构架构)
  6. 成本 (开发成本 + 维护成本 + 运维成本)
```

---

## 七、自测题

### 7.1 选择题

```
1. 以下哪种场景最适合使用微前端？
   A. 3 人团队开发营销落地页
   B. 15 人团队开发企业级 SaaS 平台，10+ 子模块
   C. 个人开发者开发 Todo 应用
   D. 2 人团队开发内部工具
   答案: B

2. 以下哪个不是 MVC 模式的优势？
   A. 职责分离
   B. 可测试性好
   C. 自动数据绑定
   D. 代码组织清晰
   答案: C (自动数据绑定是 MVVM 的特性)

3. 依赖倒置原则的核心是：
   A. 低层模块依赖高层模块
   B. 高层模块依赖低层模块
   C. 都依赖抽象，抽象不依赖细节
   D. 不需要依赖
   答案: C
```

### 7.2 设计题

```
题目：设计一个在线文档编辑器 (类似 Google Docs)
要求：
- 多人实时协作编辑
- 支持富文本
- 离线可用
- 版本历史

请描述你的架构设计方案：
(参考答案见下方)

参考答案要点：
1. 架构风格：事件驱动 + CQRS
2. 冲突解决：OT (Operational Transformation) 或 CRDT
3. 实时通信：WebSocket + 操作转换
4. 离线支持：Service Worker + IndexedDB + 操作队列
5. 版本历史：事件溯源 (Event Sourcing)
6. 富文本：ProseMirror / Slate.js (结构化文档模型)
7. 分层：
   - 展示层：编辑器 UI + 光标显示 + 协作指示器
   - 应用层：编辑用例 + 协作同步 + 版本管理
   - 领域层：文档模型 + 操作模型 + 用户模型
   - 基础设施层：WebSocket + 存储 + 转换引擎
8. 性能：增量渲染 + 虚拟文档 + Web Worker 处理转换
```

---

## 八、总结 — 架构设计的核心原则

```
1. 简单优先 (KISS)
   最简单的能工作的方案就是最好的方案

2. 职责单一 (SRP)
   每个模块只做一件事，并做好

3. 依赖倒置 (DIP)
   依赖抽象而非具体实现

4. 渐进演进
   不要一开始就设计完美架构，从简单开始，按需演进

5. 架构服务于业务
   架构是手段，不是目的。好的架构让业务开发更顺畅

6. 可测试性
   无法测试的架构是失败的架构

7. 文档即架构
   架构决策需要记录 (ADR)，让后来者理解为什么这样设计

8. 度量驱动
   用数据说话，而不是凭感觉。架构健康度需要定期评估
```

---

**今日产出：** `architecture-design-1800-0429.md`  
**内容覆盖：** 架构决策矩阵 / 反模式识别 / 五层架构设计 / 领域模型 / 实时同步 / 冲突解决 / 演进路线 / 评审 Checklist / 面试考点  
**与前序关系：** 在 4/28 三大模式手写实现基础上，聚焦架构决策方法论和完整应用设计实战
