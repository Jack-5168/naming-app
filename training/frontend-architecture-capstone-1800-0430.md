# 🏗️ 前端架构模式终极训练 — MVC / MVVM / 微前端 融合实战

**时间：** 2026-04-30 18:00  
**主题：** 三大架构模式融合实战 + 完整应用架构设计 + 架构演进路径  
**前置：** 4/22 MVC/MVVM 基础 → 4/26 终极整合 → 4/27 BFF/事件驱动 → 4/28 三大模式手写 → 4/29 架构决策  
**本次新增：** 模式融合架构 / 渐进式迁移策略 / 混合架构实战 / 架构健康度监控 / 完整 CloudBoard 架构设计

---

## 一、架构模式融合 — 没有银弹，只有组合

### 1.1 为什么需要融合？

```
单一架构模式的局限：

MVC  alone → 视图与模型耦合度高，大型应用 Controller 膨胀
MVVM alone → 复杂状态管理困难，数据流不够清晰
Flux alone → 模板代码多，简单场景过度工程
微前端 alone → 通信复杂，性能开销大

融合架构 = 取各模式之长，避各模式之短

┌─────────────────────────────────────────────────────┐
│              融合架构设计理念                          │
│                                                     │
│   展示层: MVVM (双向绑定, 快速开发)                    │
│      ↓                                              │
│   应用层: Flux (单向数据流, 可预测)                    │
│      ↓                                              │
│   领域层: MVC (清晰分层, 业务隔离)                     │
│      ↓                                              │
│   基础设施: 微前端 (应用级拆分, 独立部署)               │
│                                                     │
│   核心：每一层选择最适合的模式，层间通过明确接口通信      │
└─────────────────────────────────────────────────────┘
```

### 1.2 融合架构全景

```
┌──────────────────────────────────────────────────────────────┐
│                    用户界面层 (MVVM)                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Vue 组件 │  │ React   │  │ Svelte  │  │ 原生    │        │
│  │ (子应用A) │  │ 组件    │  │ 组件    │  │ WebComp │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘        │
│       │              │              │              │           │
├───────┼──────────────┼──────────────┼──────────────┼───────────┤
│       │    应用层 (Flux/事件总线)                     │           │
│  ┌────┴──────────────┴──────────────┴──────────────┴────┐     │
│  │              EventBus / Store 桥梁                     │     │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐        │     │
│  │  │ Action    │  │ Reducer   │  │ Middleware │        │     │
│  │  │ Dispatcher│  │ (纯函数)  │  │ (日志/缓存)│        │     │
│  │  └───────────┘  └───────────┘  └───────────┘        │     │
│  └───────────────────────────┬──────────────────────────┘     │
│                              │                                │
├──────────────────────────────┼────────────────────────────────┤
│       领域层 (MVC 分层)        │                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                    │
│  │ Service  │  │ Repository│  │ Entity   │                    │
│  │ (业务逻辑) │  │ (数据访问) │  │ (领域模型) │                    │
│  └──────────┘  └──────────┘  └──────────┘                    │
│                              │                                │
├──────────────────────────────┼────────────────────────────────┤
│       基础设施层               │                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ HTTP Client│ │ Cache    │ │ Security │ │ Monitor  │     │
│  │ (Fetch/Axios)│ │ (Redis) │ │ (CSP/XSS)│ │ (SDK)    │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、渐进式迁移策略 — 从 MVC 到微前端

### 2.1 迁移路线图

```
Phase 1: 单体 MVC (1-2 人, MVP)
  │
  ├─ 特征: 单一代码库, MVC 分层, 共享状态
  ├─ 技术栈: Vite + Vue3/React + 简单状态管理
  └─ 目标: 快速验证产品, 积累业务认知
  │
  ▼
Phase 2: 模块化 Flux (3-5 人, 增长期)
  │
  ├─ 特征: 单向数据流, 模块化拆分, 独立测试
  ├─ 技术栈: + Zustand/Redux, 组件库, 设计模式
  └─ 目标: 提升代码质量, 支撑功能扩展
  │
  ▼
Phase 3: 微前端拆分 (5-15 人, 规模化)
  │
  ├─ 特征: 应用级拆分, 独立部署, 多技术栈
  ├─ 技术栈: qiankun/Module Federation, Monorepo
  └─ 目标: 多团队协作, 独立迭代, 技术异构
  │
  ▼
Phase 4: 平台化 (15+ 人, 生态化)
  │
  ├─ 特征: 插件化, 低代码, 开放平台
  ├─ 技术栈: 微前端 + 插件系统 + 开放 API
  └─ 目标: 生态扩展, 第三方集成
```

### 2.2 迁移触发条件

```typescript
interface MigrationTrigger {
  phase: number;
  conditions: {
    teamSize: number;           // 团队规模
    codebaseSize: number;       // 代码量 (KB)
    deployFrequency: string;    // 部署频率
    buildTime: number;          // 构建时间 (秒)
    featureModules: number;     // 功能模块数
    techStackDiversity: boolean;// 多技术栈需求
  };
  action: string;
}

const triggers: MigrationTrigger[] = [
  {
    phase: 1,
    conditions: {
      teamSize: 1,
      codebaseSize: 500,
      deployFrequency: '每周',
      buildTime: 30,
      featureModules: 3,
      techStackDiversity: false
    },
    action: '启动 MVC 单体应用'
  },
  {
    phase: 2,
    conditions: {
      teamSize: 3,
      codebaseSize: 2000,
      deployFrequency: '每天',
      buildTime: 60,
      featureModules: 8,
      techStackDiversity: false
    },
    action: '引入 Flux 状态管理, 模块化拆分'
  },
  {
    phase: 3,
    conditions: {
      teamSize: 8,
      codebaseSize: 5000,
      deployFrequency: '按需',
      buildTime: 180,
      featureModules: 15,
      techStackDiversity: true
    },
    action: '微前端拆分, Monorepo 管理'
  },
  {
    phase: 4,
    conditions: {
      teamSize: 15,
      codebaseSize: 10000,
      deployFrequency: '持续',
      buildTime: 300,
      featureModules: 30,
      techStackDiversity: true
    },
    action: '平台化, 插件系统, 开放 API'
  }
];
```

### 2.3 迁移风险矩阵

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 数据迁移丢失 | 中 | 高 | 增量迁移 + 双写验证 |
| 路由冲突 | 高 | 中 | 统一路由表 + 命名空间 |
| 样式污染 | 高 | 中 | CSS Modules / Shadow DOM |
| 通信性能下降 | 中 | 中 | 事件批处理 + 本地缓存 |
| 构建时间增加 | 高 | 低 | 增量构建 + 缓存 |
| 团队学习成本 | 中 | 高 | 培训 + 文档 + 结对编程 |

---

## 三、混合架构实战 — CloudBoard 完整设计

### 3.1 项目背景

```
CloudBoard — 企业级项目协作平台

核心功能:
├── 项目管理 (Project/Task/Sprint)
├── 看板视图 (Board/Column/Card)
├── 实时协作 (WebSocket 同步)
├── 文件管理 (上传/预览/分享)
├── 团队管理 (成员/角色/权限)
├── 数据分析 (统计/报表/趋势)
└── 通知中心 (消息/提醒/订阅)

团队规模: 12 人 (3 个小组)
技术栈: Vue3 + React 混用
部署: 独立部署 + 统一入口
```

### 3.2 混合架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                  CloudBoard 微前端入口 (主应用)                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  qiankun 注册中心 + 路由分发 + 全局状态 + 通信桥梁     │    │
│  └─────────────────────────────────────────────────────┘    │
└────────────┬──────────────────────┬────────────────────────┘
             │                      │
    ┌────────┴────────┐   ┌────────┴────────┐
    │  子应用 A (Vue3) │   │  子应用 B (React)│
    │  项目管理 + 看板  │   │  文件 + 数据分析  │
    └────────┬────────┘   └────────┬────────┘
             │                      │
    ┌────────┴──────────────────────┴────────┐
    │        共享基础设施层                     │
    │  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
    │  │ HTTP SDK│ │Auth SDK │ │UI 组件库 │  │
    │  └─────────┘ └─────────┘ └─────────┘  │
    └─────────────────────────────────────────┘
```

### 3.3 子应用 A — 项目管理 (Vue3 + MVVM)

```typescript
// ===== 子应用 A 架构: MVVM + Flux 混合 =====

// --- Model 层 (领域模型) ---
interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'archived' | 'draft';
  owner: Member;
  members: Member[];
  boards: Board[];
  sprints: Sprint[];
  createdAt: Date;
  updatedAt: Date;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assignee?: Member;
  reporter: Member;
  boardId: string;
  columnId: string;
  subTasks: SubTask[];
  attachments: Attachment[];
  comments: Comment[];
  tags: string[];
  estimatedHours?: number;
  actualHours?: number;
  createdAt: Date;
  updatedAt: Date;
}

type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';
type Priority = 'low' | 'medium' | 'high' | 'urgent';

// --- ViewModel 层 (响应式状态) ---
import { reactive, computed, watch } from 'vue';
import { useGlobalStore } from '../shared/store';

class ProjectViewModel {
  // 响应式状态
  state = reactive({
    projects: [] as Project[],
    currentProject: null as Project | null,
    loading: false,
    error: null as string | null,
    searchQuery: '',
    filterStatus: 'all' as string,
  });

  // 计算属性
  filteredProjects = computed(() => {
    let list = this.state.projects;
    if (this.state.filterStatus !== 'all') {
      list = list.filter(p => p.status === this.state.filterStatus);
    }
    if (this.state.searchQuery) {
      const q = this.state.searchQuery.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }
    return list;
  });

  projectStats = computed(() => {
    const projects = this.state.projects;
    return {
      total: projects.length,
      active: projects.filter(p => p.status === 'active').length,
      totalMembers: new Set(projects.flatMap(p => p.members.map(m => m.id))).size,
      totalTasks: projects.reduce((sum, p) =>
        sum + p.boards.reduce((s, b) =>
          s + b.columns.reduce((cs, c) => cs + c.tasks.length, 0), 0), 0),
    };
  });

  // Actions (Flux 风格)
  private globalStore = useGlobalStore();

  async loadProjects() {
    this.state.loading = true;
    this.state.error = null;
    try {
      const projects = await this.globalStore.api.getProjects();
      this.state.projects = projects;
    } catch (err) {
      this.state.error = err instanceof Error ? err.message : '加载失败';
    } finally {
      this.state.loading = false;
    }
  }

  async createProject(data: Partial<Project>) {
    const project = await this.globalStore.api.createProject(data);
    this.state.projects.push(project);
    this.globalStore.events.emit('project:created', project);
    return project;
  }

  async switchProject(projectId: string) {
    this.state.currentProject = this.state.projects.find(p => p.id === projectId) || null;
    this.globalStore.events.emit('project:switched', this.state.currentProject);
  }
}

// --- View 层 (Vue 组件) ---
/*
<template>
  <div class="project-list">
    <div class="toolbar">
      <input v-model="vm.state.searchQuery" placeholder="搜索项目..." />
      <select v-model="vm.state.filterStatus">
        <option value="all">全部</option>
        <option value="active">进行中</option>
        <option value="archived">已归档</option>
      </select>
      <button @click="showCreateDialog = true">新建项目</button>
    </div>

    <div class="stats" v-if="vm.projectStats.total > 0">
      <span>项目: {{ vm.projectStats.total }}</span>
      <span>成员: {{ vm.projectStats.totalMembers }}</span>
      <span>任务: {{ vm.projectStats.totalTasks }}</span>
    </div>

    <div v-if="vm.state.loading" class="loading">加载中...</div>
    <div v-else-if="vm.state.error" class="error">{{ vm.state.error }}</div>
    <div v-else class="project-grid">
      <div
        v-for="project in vm.filteredProjects"
        :key="project.id"
        class="project-card"
        @click="vm.switchProject(project.id)"
        :class="{ active: project.id === vm.state.currentProject?.id }"
      >
        <h3>{{ project.name }}</h3>
        <p>{{ project.description }}</p>
        <div class="members">
          <img v-for="m in project.members.slice(0, 5)" :key="m.id" :src="m.avatar" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { ProjectViewModel } from './project.viewmodel';

const vm = new ProjectViewModel();
onMounted(() => vm.loadProjects());
</script>
*/
```

### 3.4 子应用 B — 文件管理 (React + Flux)

```typescript
// ===== 子应用 B 架构: Flux + MVC =====

// --- Store (单一数据源) ---
import { createStore, applyMiddleware } from 'redux';

interface FileState {
  files: FileInfo[];
  currentFolder: string;
  selectedFiles: string[];
  uploadQueue: UploadTask[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  viewMode: 'grid' | 'list';
  sortBy: 'name' | 'size' | 'date' | 'type';
  sortOrder: 'asc' | 'desc';
}

interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  mimeType: string;
  folderId: string;
  uploader: Member;
  previewUrl?: string;
  downloadUrl: string;
  sharedWith: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface UploadTask {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

// Actions
const ActionTypes = {
  SET_FILES: 'file/SET_FILES',
  SET_CURRENT_FOLDER: 'file/SET_CURRENT_FOLDER',
  TOGGLE_SELECT: 'file/TOGGLE_SELECT',
  SELECT_ALL: 'file/SELECT_ALL',
  CLEAR_SELECTION: 'file/CLEAR_SELECTION',
  ADD_UPLOAD: 'file/ADD_UPLOAD',
  UPDATE_UPLOAD: 'file/UPDATE_UPLOAD',
  REMOVE_UPLOAD: 'file/REMOVE_UPLOAD',
  SET_LOADING: 'file/SET_LOADING',
  SET_ERROR: 'file/SET_ERROR',
  SET_SEARCH: 'file/SET_SEARCH',
  SET_VIEW_MODE: 'file/SET_VIEW_MODE',
  SET_SORT: 'file/SET_SORT',
  DELETE_FILES: 'file/DELETE_FILES',
  MOVE_FILES: 'file/MOVE_FILES',
  SHARE_FILES: 'file/SHARE_FILES',
} as const;

// Reducer (纯函数)
const initialState: FileState = {
  files: [],
  currentFolder: 'root',
  selectedFiles: [],
  uploadQueue: [],
  loading: false,
  error: null,
  searchQuery: '',
  viewMode: 'grid',
  sortBy: 'name',
  sortOrder: 'asc',
};

function fileReducer(state: FileState = initialState, action: any): FileState {
  switch (action.type) {
    case ActionTypes.SET_FILES:
      return { ...state, files: action.payload, loading: false };
    case ActionTypes.SET_CURRENT_FOLDER:
      return { ...state, currentFolder: action.payload, selectedFiles: [] };
    case ActionTypes.TOGGLE_SELECT:
      return {
        ...state,
        selectedFiles: state.selectedFiles.includes(action.payload)
          ? state.selectedFiles.filter(id => id !== action.payload)
          : [...state.selectedFiles, action.payload],
      };
    case ActionTypes.SELECT_ALL:
      return { ...state, selectedFiles: state.files.map(f => f.id) };
    case ActionTypes.CLEAR_SELECTION:
      return { ...state, selectedFiles: [] };
    case ActionTypes.ADD_UPLOAD:
      return { ...state, uploadQueue: [...state.uploadQueue, action.payload] };
    case ActionTypes.UPDATE_UPLOAD:
      return {
        ...state,
        uploadQueue: state.uploadQueue.map(t =>
          t.id === action.payload.id ? { ...t, ...action.payload } : t
        ),
      };
    case ActionTypes.REMOVE_UPLOAD:
      return {
        ...state,
        uploadQueue: state.uploadQueue.filter(t => t.id !== action.payload),
      };
    case ActionTypes.SET_SEARCH:
      return { ...state, searchQuery: action.payload };
    case ActionTypes.SET_VIEW_MODE:
      return { ...state, viewMode: action.payload };
    case ActionTypes.SET_SORT:
      return { ...state, sortBy: action.payload.sortBy, sortOrder: action.payload.sortOrder };
    case ActionTypes.DELETE_FILES:
      return {
        ...state,
        files: state.files.filter(f => !action.payload.includes(f.id)),
        selectedFiles: state.selectedFiles.filter(id => !action.payload.includes(id)),
      };
    case ActionTypes.SET_ERROR:
      return { ...state, error: action.payload, loading: false };
    default:
      return state;
  }
}

// Middleware (日志 + 错误追踪)
const loggerMiddleware = (store: any) => (next: any) => (action: any) => {
  console.log('[FileStore]', action.type, action.payload);
  return next(action);
};

const errorMiddleware = (store: any) => (next: any) => (action: any) => {
  try {
    return next(action);
  } catch (err) {
    store.dispatch({
      type: ActionTypes.SET_ERROR,
      payload: err instanceof Error ? err.message : '未知错误',
    });
    throw err;
  }
};

const store = createStore(fileReducer, applyMiddleware(loggerMiddleware, errorMiddleware));

// --- Action Creators (异步) ---
const FileActions = {
  loadFiles: (folderId: string) => async (dispatch: any, getState: any) => {
    dispatch({ type: ActionTypes.SET_LOADING, payload: true });
    try {
      const api = getState().shared.api;
      const files = await api.getFiles(folderId);
      dispatch({ type: ActionTypes.SET_FILES, payload: files });
      dispatch({ type: ActionTypes.SET_CURRENT_FOLDER, payload: folderId });
    } catch (err) {
      dispatch({
        type: ActionTypes.SET_ERROR,
        payload: err instanceof Error ? err.message : '加载失败',
      });
    }
  },

  uploadFiles: (files: File[], folderId: string) => async (dispatch: any, getState: any) => {
    const api = getState().shared.api;
    for (const file of files) {
      const taskId = `upload_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      dispatch({
        type: ActionTypes.ADD_UPLOAD,
        payload: { id: taskId, file, progress: 0, status: 'pending' },
      });

      try {
        dispatch({
          type: ActionTypes.UPDATE_UPLOAD,
          payload: { id: taskId, status: 'uploading' },
        });

        const result = await api.uploadFile(file, folderId, (progress: number) => {
          dispatch({
            type: ActionTypes.UPDATE_UPLOAD,
            payload: { id: taskId, progress },
          });
        });

        dispatch({
          type: ActionTypes.UPDATE_UPLOAD,
          payload: { id: taskId, progress: 100, status: 'done' },
        });

        // 刷新文件列表
        setTimeout(() => {
          dispatch(FileActions.loadFiles(folderId));
        }, 500);
      } catch (err) {
        dispatch({
          type: ActionTypes.UPDATE_UPLOAD,
          payload: {
            id: taskId,
            status: 'error',
            error: err instanceof Error ? err.message : '上传失败',
          },
        });
      }

      // 3秒后移除上传任务
      setTimeout(() => {
        dispatch({ type: ActionTypes.REMOVE_UPLOAD, payload: taskId });
      }, 3000);
    }
  },

  deleteSelected: () => async (dispatch: any, getState: any) => {
    const state = getState();
    const { selectedFiles } = state.file;
    if (selectedFiles.length === 0) return;

    try {
      const api = getState().shared.api;
      await api.deleteFiles(selectedFiles);
      dispatch({ type: ActionTypes.DELETE_FILES, payload: selectedFiles });
    } catch (err) {
      dispatch({
        type: ActionTypes.SET_ERROR,
        payload: err instanceof Error ? err.message : '删除失败',
      });
    }
  },

  shareSelected: (memberIds: string[]) => async (dispatch: any, getState: any) => {
    const state = getState();
    const { selectedFiles } = state.file;
    try {
      const api = getState().shared.api;
      await api.shareFiles(selectedFiles, memberIds);
      dispatch(FileActions.loadFiles(state.file.currentFolder));
    } catch (err) {
      dispatch({
        type: ActionTypes.SET_ERROR,
        payload: err instanceof Error ? err.message : '分享失败',
      });
    }
  },
};

// --- Selectors (派生数据) ---
const FileSelectors = {
  filteredFiles: (state: any) => {
    let files = [...state.file.files];
    const { searchQuery, sortBy, sortOrder } = state.file;

    // 搜索过滤
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      files = files.filter(f => f.name.toLowerCase().includes(q));
    }

    // 排序
    files.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'size': cmp = a.size - b.size; break;
        case 'date': cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
        case 'type': cmp = a.type.localeCompare(b.type); break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return files;
  },

  selectedFileDetails: (state: any) => {
    return state.file.files.filter((f: FileInfo) =>
      state.file.selectedFiles.includes(f.id)
    );
  },

  totalSelectedSize: (state: any) => {
    return FileSelectors.selectedFileDetails(state)
      .reduce((sum: number, f: FileInfo) => sum + f.size, 0);
  },

  uploadProgress: (state: any) => {
    const queue = state.file.uploadQueue;
    if (queue.length === 0) return null;
    const total = queue.length;
    const done = queue.filter((t: UploadTask) => t.status === 'done').length;
    const error = queue.filter((t: UploadTask) => t.status === 'error').length;
    const avgProgress = queue.reduce((sum: number, t: UploadTask) => sum + t.progress, 0) / total;
    return { total, done, error, avgProgress };
  },
};

// --- React 组件 (View 层) ---
/*
import React, { useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { FileActions, FileSelectors } from './file.store';

function FileExplorer() {
  const dispatch = useDispatch();
  const files = useSelector(FileSelectors.filteredFiles);
  const selectedFiles = useSelector(FileSelectors.selectedFileDetails);
  const totalSelectedSize = useSelector(FileSelectors.totalSelectedSize);
  const uploadProgress = useSelector(FileSelectors.uploadProgress);
  const { loading, error, viewMode, searchQuery } = useSelector(state => state.file);

  useEffect(() => {
    dispatch(FileActions.loadFiles('root'));
  }, [dispatch]);

  const handleFileSelect = useCallback((fileId: string) => {
    dispatch({ type: 'file/TOGGLE_SELECT', payload: fileId });
  }, [dispatch]);

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList) {
      dispatch(FileActions.uploadFiles(Array.from(fileList), 'root'));
    }
  }, [dispatch]);

  const handleDelete = useCallback(() => {
    if (selectedFiles.length > 0 && confirm(`确定删除 ${selectedFiles.length} 个文件?`)) {
      dispatch(FileActions.deleteSelected());
    }
  }, [dispatch, selectedFiles]);

  const handleShare = useCallback(() => {
    // 打开分享对话框
  }, []);

  return (
    <div className="file-explorer">
      <div className="toolbar">
        <input
          value={searchQuery}
          onChange={e => dispatch({ type: 'file/SET_SEARCH', payload: e.target.value })}
          placeholder="搜索文件..."
        />
        <label className="upload-btn">
          上传文件
          <input type="file" multiple onChange={handleUpload} style={{ display: 'none' }} />
        </label>
        <button onClick={handleDelete} disabled={selectedFiles.length === 0}>
          删除 ({selectedFiles.length})
        </button>
        <button onClick={handleShare} disabled={selectedFiles.length === 0}>
          分享
        </button>
        <button onClick={() => dispatch({ type: 'file/SET_VIEW_MODE', payload: viewMode === 'grid' ? 'list' : 'grid' })}>
          {viewMode === 'grid' ? '列表' : '网格'}
        </button>
      </div>

      {uploadProgress && (
        <div className="upload-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${uploadProgress.avgProgress}%` }} />
          </div>
          <span>{uploadProgress.done}/{uploadProgress.total} 完成</span>
          {uploadProgress.error > 0 && <span className="error">{uploadProgress.error} 失败</span>}
        </div>
      )}

      {loading && <div className="loading">加载中...</div>}
      {error && <div className="error">{error}</div>}

      <div className={`file-grid ${viewMode}`}>
        {files.map(file => (
          <div
            key={file.id}
            className={`file-item ${selectedFiles.some(f => f.id === file.id) ? 'selected' : ''}`}
            onClick={() => handleFileSelect(file.id)}
          >
            <div className="file-icon">{getFileIcon(file.type)}</div>
            <div className="file-name">{file.name}</div>
            <div className="file-size">{formatSize(file.size)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
*/
```

### 3.5 微前端通信桥梁

```typescript
// ===== 微前端通信层 (跨应用通信) =====

// --- 全局事件总线 (跨应用) ---
class GlobalEventBus {
  private listeners: Map<string, Array<(data: any) => void>> = new Map();
  private history: Array<{ event: string; data: any; timestamp: number }> = [];
  private maxHistory: number = 100;

  on(event: string, handler: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);

    // 返回取消订阅函数
    return () => {
      const handlers = this.listeners.get(event);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx >= 0) handlers.splice(idx, 1);
      }
    };
  }

  once(event: string, handler: (data: any) => void): () => void {
    const wrapper = (data: any) => {
      handler(data);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  off(event: string, handler: (data: any) => void): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    }
  }

  emit(event: string, data: any): void {
    this.history.push({ event, data, timestamp: Date.now() });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (err) {
          console.error(`[EventBus] Error in handler for "${event}":`, err);
        }
      });
    }

    // 通配符匹配
    const wildcardHandlers = this.listeners.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        try {
          handler({ event, data });
        } catch (err) {
          console.error(`[EventBus] Error in wildcard handler:`, err);
        }
      });
    }
  }

  // 批量事件 (防抖)
  private batchQueue: Array<{ event: string; data: any }> = [];
  private batchTimer: any = null;
  private batchDelay: number = 16; // ~1 frame

  emitBatch(event: string, data: any): void {
    this.batchQueue.push({ event, data });
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        const batch = [...this.batchQueue];
        this.batchQueue = [];
        this.batchTimer = null;
        this.emit(`${event}:batch`, batch);
      }, this.batchDelay);
    }
  }

  // 事件回放
  replay(event: string, handler: (data: any) => void): void {
    this.history
      .filter(h => h.event === event)
      .forEach(h => handler(h.data));
  }

  // 清理
  destroy(): void {
    this.listeners.clear();
    this.history = [];
    if (this.batchTimer) clearTimeout(this.batchTimer);
  }
}

// --- 全局共享状态 (跨应用) ---
interface GlobalSharedState {
  // 用户信息
  user: {
    id: string;
    name: string;
    avatar: string;
    role: string;
    permissions: string[];
  } | null;
  // 当前项目
  currentProject: {
    id: string;
    name: string;
  } | null;
  // 通知
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    content: string;
    read: boolean;
    createdAt: Date;
  }>;
  // 主题
  theme: 'light' | 'dark' | 'auto';
  // 语言
  locale: 'zh-CN' | 'en-US' | 'ja-JP';
}

class GlobalStore {
  private state: GlobalSharedState;
  private listeners: Array<(state: GlobalSharedState) => void> = [];
  private eventBus: GlobalEventBus;

  constructor(eventBus: GlobalEventBus) {
    this.eventBus = eventBus;
    this.state = {
      user: null,
      currentProject: null,
      notifications: [],
      theme: 'light',
      locale: 'zh-CN',
    };

    // 监听跨应用事件
    this.eventBus.on('user:login', (user) => this.setState({ user }));
    this.eventBus.on('user:logout', () => this.setState({ user: null }));
    this.eventBus.on('project:switched', (project) => this.setState({ currentProject: project }));
    this.eventBus.on('notification:new', (notification) => {
      this.setState({
        notifications: [notification, ...this.state.notifications].slice(0, 50),
      });
    });
    this.eventBus.on('theme:changed', (theme) => this.setState({ theme }));
    this.eventBus.on('locale:changed', (locale) => this.setState({ locale }));
  }

  getState(): Readonly<GlobalSharedState> {
    return this.state;
  }

  private setState(partial: Partial<GlobalSharedState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach(listener => listener(this.state));
  }

  subscribe(listener: (state: GlobalSharedState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  // 选择器
  select<K extends keyof GlobalSharedState>(key: K): GlobalSharedState[K] {
    return this.state[key];
  }
}

// --- 微前端注册中心 ---
interface SubApp {
  name: string;
  entry: string;              // 入口 URL
  container: string;          // 容器选择器
  activeRule: string | ((location: Location) => boolean);
  props?: Record<string, any>; // 传递给子应用的 props
  lifecycle: {
    bootstrap: () => Promise<void>;
    mount: (props: any) => Promise<void>;
    unmount: (props: any) => Promise<void>;
  };
}

class MicroAppRegistry {
  private apps: Map<string, SubApp> = new Map();
  private activeApps: Set<string> = new Set();
  private eventBus: GlobalEventBus;
  private globalStore: GlobalStore;

  constructor(eventBus: GlobalEventBus, globalStore: GlobalStore) {
    this.eventBus = eventBus;
    this.globalStore = globalStore;
  }

  register(app: SubApp): void {
    this.apps.set(app.name, app);
    console.log(`[MicroApp] Registered: ${app.name}`);
  }

  async start(): Promise<void> {
    // 监听路由变化
    window.addEventListener('popstate', () => this.checkRoutes());
    // 初始检查
    await this.checkRoutes();
  }

  private async checkRoutes(): Promise<void> {
    const location = window.location;

    for (const [name, app] of this.apps) {
      const shouldActive = typeof app.activeRule === 'function'
        ? app.activeRule(location)
        : location.pathname.startsWith(app.activeRule);

      if (shouldActive && !this.activeApps.has(name)) {
        await this.mountApp(name, app);
      } else if (!shouldActive && this.activeApps.has(name)) {
        await this.unmountApp(name, app);
      }
    }
  }

  private async mountApp(name: string, app: SubApp): Promise<void> {
    try {
      // 加载应用
      const module = await this.loadAppModule(app.entry);

      // 生命周期: bootstrap
      await app.lifecycle.bootstrap();

      // 创建容器
      let container = document.querySelector(app.container);
      if (!container) {
        container = document.createElement('div');
        container.id = app.container.replace('#', '');
        document.body.appendChild(container);
      }

      // 传递 props
      const props = {
        ...app.props,
        globalState: this.globalStore.getState(),
        eventBus: this.eventBus,
        container,
      };

      // 生命周期: mount
      await app.lifecycle.mount(props);
      this.activeApps.add(name);

      this.eventBus.emit('app:mounted', { name, props });
      console.log(`[MicroApp] Mounted: ${name}`);
    } catch (err) {
      console.error(`[MicroApp] Failed to mount ${name}:`, err);
      this.eventBus.emit('app:error', { name, error: err });
    }
  }

  private async unmountApp(name: string, app: SubApp): Promise<void> {
    try {
      await app.lifecycle.unmount({});
      this.activeApps.delete(name);

      // 清理容器
      const container = document.querySelector(app.container);
      if (container) {
        container.innerHTML = '';
      }

      this.eventBus.emit('app:unmounted', { name });
      console.log(`[MicroApp] Unmounted: ${name}`);
    } catch (err) {
      console.error(`[MicroApp] Failed to unmount ${name}:`, err);
    }
  }

  private async loadAppModule(entry: string): Promise<any> {
    // 动态加载子应用 (简化版)
    const script = document.createElement('script');
    script.src = entry;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);

    return new Promise((resolve, reject) => {
      script.onload = () => resolve((window as any).__MICRO_APPS__);
      script.onerror = () => reject(new Error(`Failed to load ${entry}`));
    });
  }

  getActiveApps(): string[] {
    return Array.from(this.activeApps);
  }
}

// --- 主应用初始化 ---
/*
// main.ts — 微前端入口
import { GlobalEventBus, GlobalStore, MicroAppRegistry } from './shared';

// 1. 初始化基础设施
const eventBus = new GlobalEventBus();
const globalStore = new GlobalStore(eventBus);

// 2. 注册子应用
const registry = new MicroAppRegistry(eventBus, globalStore);

registry.register({
  name: 'project-management',
  entry: '//projects.cloudboard.local:3001/index.js',
  container: '#sub-app-container',
  activeRule: '/projects',
  lifecycle: {
    bootstrap: async () => { console.log('Project Management bootstrapped'); },
    mount: async (props) => {
      // Vue3 子应用挂载
      const { createApp } = await import('//projects.cloudboard.local:3001/vue.js');
      const App = await import('//projects.cloudboard.local:3001/App.js');
      const app = createApp(App.default, { globalState: props.globalState, eventBus: props.eventBus });
      app.mount(props.container);
    },
    unmount: async (props) => {
      // 清理
      props.container.innerHTML = '';
    },
  },
});

registry.register({
  name: 'file-management',
  entry: '//files.cloudboard.local:3002/index.js',
  container: '#sub-app-container',
  activeRule: '/files',
  lifecycle: {
    bootstrap: async () => { console.log('File Management bootstrapped'); },
    mount: async (props) => {
      // React 子应用挂载
      const { createElement: h, render } = await import('//files.cloudboard.local:3002/react.js');
      const { Provider } = await import('//files.cloudboard.local:3002/react-redux.js');
      const FileExplorer = await import('//files.cloudboard.local:3002/FileExplorer.js');
      const store = await import('//files.cloudboard.local:3002/store.js');
      render(
        h(Provider, { store: store.default }, h(FileExplorer.default)),
        props.container
      );
    },
    unmount: async (props) => {
      props.container.innerHTML = '';
    },
  },
});

// 3. 启动微前端
registry.start();

// 4. 全局错误处理
window.addEventListener('error', (e) => {
  eventBus.emit('global:error', { message: e.message, stack: e.error?.stack });
});

window.addEventListener('unhandledrejection', (e) => {
  eventBus.emit('global:error', { message: e.reason });
});
*/
```

---

## 四、架构健康度监控

### 4.1 健康度指标体系

```typescript
interface ArchitectureHealthMetrics {
  // 代码质量
  codeQuality: {
    cyclomaticComplexity: number;    // 圈复杂度 (目标: < 10)
    coupling: number;                // 耦合度 (目标: < 5)
    cohesion: number;                // 内聚度 (目标: > 0.7)
    testCoverage: number;            // 测试覆盖率 (目标: > 80%)
    duplicateRate: number;           // 重复率 (目标: < 3%)
  };

  // 架构质量
  architectureQuality: {
    layerViolationCount: number;     // 分层违规次数 (目标: 0)
    circularDependencyCount: number; // 循环依赖数 (目标: 0)
    moduleCount: number;             // 模块数量
    avgModuleSize: number;           // 平均模块大小 (KB)
    maxModuleSize: number;           // 最大模块大小 (KB)
  };

  // 性能指标
  performance: {
    bundleSize: number;              // 打包体积 (KB)
    loadTime: number;                // 加载时间 (ms)
    fcp: number;                     // 首次内容绘制 (ms)
    lcp: number;                     // 最大内容绘制 (ms)
    cls: number;                     // 累积布局偏移
    ttfb: number;                    // 首字节时间 (ms)
  };

  // 可维护性
  maintainability: {
    techDebtRatio: number;           // 技术债比率 (目标: < 5%)
    avgFixTime: number;              // 平均修复时间 (小时)
    avgPRSize: number;               // 平均 PR 大小 (行)
    deployFrequency: number;         // 部署频率 (次/天)
    changeFailureRate: number;       // 变更失败率 (目标: < 15%)
  };

  // 团队效率
  teamEfficiency: {
    onboardingTime: number;          // 新人上手时间 (天)
    featureDeliveryTime: number;     // 功能交付周期 (天)
    codeReviewTime: number;          // 代码审查时间 (小时)
    meetingTime: number;             // 会议时间占比 (%)
  };
}
```

### 4.2 健康度评分算法

```typescript
function calculateHealthScore(metrics: ArchitectureHealthMetrics): {
  overall: number;
  categories: Record<string, number>;
  recommendations: string[];
} {
  const recommendations: string[] = [];

  // 代码质量评分 (0-100)
  const codeQualityScore = Math.min(100,
    Math.max(0, 100 - metrics.codeQuality.cyclomaticComplexity * 2) * 0.3 +
    Math.max(0, 100 - metrics.codeQuality.coupling * 10) * 0.2 +
    metrics.codeQuality.cohesion * 100 * 0.2 +
    metrics.codeQuality.testCoverage * 0.2 +
    Math.max(0, 100 - metrics.codeQuality.duplicateRate * 10) * 0.1
  );

  if (codeQualityScore < 60) {
    recommendations.push('⚠️ 代码质量偏低，建议增加单元测试，降低圈复杂度');
  }

  // 架构质量评分
  const archScore = Math.min(100,
    (metrics.architectureQuality.layerViolationCount === 0 ? 30 : 0) +
    (metrics.architectureQuality.circularDependencyCount === 0 ? 30 : 0) +
    Math.max(0, 100 - metrics.architectureQuality.avgModuleSize / 10) * 0.2 +
    Math.max(0, 100 - metrics.architectureQuality.maxModuleSize / 20) * 0.2
  );

  if (metrics.architectureQuality.layerViolationCount > 0) {
    recommendations.push('🔴 存在分层违规，检查跨层调用');
  }
  if (metrics.architectureQuality.circularDependencyCount > 0) {
    recommendations.push('🔴 存在循环依赖，需要重构模块边界');
  }

  // 性能评分
  const perfScore = Math.min(100,
    Math.max(0, 100 - (metrics.performance.lcp - 2500) / 50) * 0.3 +
    Math.max(0, 100 - metrics.performance.cls * 500) * 0.2 +
    Math.max(0, 100 - metrics.performance.ttfb / 10) * 0.2 +
    Math.max(0, 100 - metrics.performance.bundleSize / 50) * 0.3
  );

  if (metrics.performance.lcp > 4000) {
    recommendations.push('⚠️ LCP > 4s，建议优化首屏加载 (懒加载/预加载/SSR)');
  }
  if (metrics.performance.bundleSize > 500) {
    recommendations.push('⚠️ 打包体积 > 500KB，建议代码分割 + Tree Shaking');
  }

  // 可维护性评分
  const maintainScore = Math.min(100,
    Math.max(0, 100 - metrics.maintainability.techDebtRatio * 5) * 0.3 +
    Math.max(0, 100 - metrics.maintainability.avgFixTime * 2) * 0.2 +
    Math.max(0, 100 - metrics.maintainability.avgPRSize / 5) * 0.2 +
    Math.max(0, 100 - metrics.maintainability.changeFailureRate * 3) * 0.3
  );

  // 团队效率评分
  const teamScore = Math.min(100,
    Math.max(0, 100 - metrics.teamEfficiency.onboardingTime * 5) * 0.3 +
    Math.max(0, 100 - metrics.teamEfficiency.featureDeliveryTime * 2) * 0.3 +
    Math.max(0, 100 - metrics.teamEfficiency.codeReviewTime * 3) * 0.2 +
    Math.max(0, 100 - metrics.teamEfficiency.meetingTime * 2) * 0.2
  );

  // 综合评分
  const overall = codeQualityScore * 0.25 + archScore * 0.25 +
    perfScore * 0.2 + maintainScore * 0.15 + teamScore * 0.15;

  if (overall >= 90) {
    recommendations.push('✅ 架构健康度优秀，保持当前状态');
  } else if (overall >= 70) {
    recommendations.push('🟡 架构健康度良好，关注上述改进建议');
  } else {
    recommendations.push('🔴 架构健康度偏低，建议优先处理高风险项');
  }

  return {
    overall: Math.round(overall),
    categories: {
      codeQuality: Math.round(codeQualityScore),
      architecture: Math.round(archScore),
      performance: Math.round(perfScore),
      maintainability: Math.round(maintainScore),
      teamEfficiency: Math.round(teamScore),
    },
    recommendations,
  };
}
```

### 4.3 架构评审 Checklist

```markdown
## 架构评审 Checklist

### 分层架构
- [ ] 展示层不直接访问数据库
- [ ] 应用层不依赖具体 UI 框架
- [ ] 领域层不依赖基础设施实现
- [ ] 基础设施层实现依赖倒置
- [ ] 无跨层调用 (A→C 绕过 B)

### 状态管理
- [ ] 全局状态有明确边界
- [ ] 状态变更可追踪 (DevTools)
- [ ] 无循环依赖的状态更新
- [ ] 异步操作有错误处理
- [ ] 状态序列化支持 (SSR/持久化)

### 组件设计
- [ ] 组件职责单一
- [ ] Props 有 TypeScript 类型
- [ ] 事件命名规范 (onXxx)
- [ ] 支持组合而非继承
- [ ] 可独立测试

### 性能
- [ ] 首屏加载 < 3s (LCP)
- [ ] 交互响应 < 100ms (INP)
- [ ] 布局稳定 (CLS < 0.1)
- [ ] 路由级代码分割
- [ ] 图片/组件懒加载

### 安全
- [ ] CSP 头配置
- [ ] XSS 防护 (转义/净化)
- [ ] CSRF 防护 (Token/Double Submit)
- [ ] 敏感数据加密传输
- [ ] 权限校验 (RBAC/ABAC)

### 可维护性
- [ ] 代码覆盖率 > 80%
- [ ] 无循环依赖
- [ ] 模块大小合理 (< 300 行)
- [ ] 文档完整 (README + API)
- [ ] 变更日志 (CHANGELOG)
```

---

## 五、面试高频考点 + 自测题

### 5.1 MVC vs MVVM vs Flux 对比

| 维度 | MVC | MVVM | Flux/Redux |
|------|-----|------|------------|
| **数据流向** | Controller→Model→View | 双向绑定 (M↔VM↔V) | 单向 (Action→Store→View) |
| **状态管理** | 分散在 Model | ViewModel 管理 | 单一 Store |
| **测试性** | Model 可独立测试 | ViewModel 可测试 | Reducer 纯函数，最易测试 |
| **复杂度** | 低 | 中 | 高 (模板代码多) |
| **适用场景** | 中小应用 | 表单密集型 | 大型复杂状态 |
| **代表框架** | Backbone | Vue, Knockout | React+Redux |
| **核心优势** | 简单直观 | 开发效率高 | 状态可预测 |
| **核心劣势** | Controller 膨胀 | 数据流不清晰 | 学习曲线陡 |

### 5.2 微前端核心问题

```
Q1: 微前端 vs 单体应用，什么场景选微前端？
A: 团队规模 > 5 人 + 功能模块 > 10 个 + 独立部署需求 + 技术栈异构需求

Q2: qiankun vs Module Federation 怎么选？
A: qiankun: 简单快速，适合 Vue/React 混用
   Module Federation: Webpack 5 原生，适合同构项目

Q3: 微前端通信方案？
A: 全局事件总线 (推荐) / CustomEvent / BroadcastChannel / props 传递 / 全局 Store

Q4: 微前端样式隔离？
A: CSS Modules / Shadow DOM / CSS-in-JS / 命名空间 / Scoped CSS

Q5: 微前端性能优化？
A: 预加载 / 缓存子应用 / 按需加载 / 共享依赖 (React/Vue 单例)
```

### 5.3 自测题

**基础题 (5 题):**
1. MVC 模式中，View 可以直接修改 Model 吗？为什么？
2. MVVM 的双向绑定是如何实现的？(Vue 2 vs Vue 3)
3. Flux 的单向数据流有什么好处？
4. 微前端的三个核心挑战是什么？
5. 什么情况下不应该使用微前端？

**进阶题 (5 题):**
1. 设计一个 MVC + Flux 混合架构，说明各层职责和通信方式
2. 如何实现微前端的全局状态共享？对比三种方案
3. 从 MVC 迁移到微前端，分几步？每步的风险是什么？
4. 如何检测架构中的"分层违规"？
5. 设计一个架构健康度监控系统

**实战题 (5 题):**
1. 为一个 10 人团队的电商后台设计架构方案，说明选型理由
2. 手写一个支持 MVC/MVVM/Flux 三种模式的轻量级框架
3. 实现一个微前端通信层，支持事件总线 + 全局状态 + 路由分发
4. 对一个现有单体应用进行架构评审，输出健康度报告
5. 设计一个渐进式迁移方案：从 jQuery 到 Vue3 + 微前端

---

## 六、阶段一架构训练总结

### 6.1 五轮迭代脉络

```
4/22 基础版: MVC/MVVM 概念 + 简单 Todo 示例
  │
  ▼
4/26 终极整合: BFF + 事件驱动 + SmartCS 完整设计
  │
  ▼
4/27 v3: BFF 模式 + 事件驱动架构 + SmartCS v2
  │
  ▼
4/28 三大模式手写: MVC/MVVM/Flux 手写实现 + 微前端 + CloudBoard 架构
  │
  ▼
4/29 架构决策: 决策矩阵 + 完整应用设计 + 演进路线图
  │
  ▼
4/30 融合实战: 混合架构 + 渐进式迁移 + CloudBoard 完整设计 + 健康度监控
  │
  └─→ 完整闭环 ✅
```

### 6.2 核心能力矩阵

| 能力 | 掌握度 | 证明 |
|------|--------|------|
| MVC 模式 | ⭐⭐⭐⭐⭐ | 手写实现 + 完整 Todo |
| MVVM 模式 | ⭐⭐⭐⭐⭐ | 手写响应式引擎 + 模板编译 |
| Flux/Redux | ⭐⭐⭐⭐⭐ | 手写 Store + 中间件 + 异步 Action |
| 微前端 | ⭐⭐⭐⭐⭐ | 路由分发 + 应用生命周期 + 通信桥梁 |
| 架构决策 | ⭐⭐⭐⭐⭐ | 六维模型 + 决策矩阵 + 流程图 |
| 混合架构 | ⭐⭐⭐⭐⭐ | 四层融合 + 渐进式迁移 |
| 健康度监控 | ⭐⭐⭐⭐ | 指标体系 + 评分算法 + Checklist |

### 6.3 阶段一架构训练产出

- **手写实现:** MVC (~200 行) + MVVM (~250 行) + Flux (~150 行) + 微前端 (~200 行) + 事件总线 (~150 行) + 全局 Store (~100 行) + 微前端注册中心 (~200 行)
- **完整应用:** CloudBoard 项目管理 (Vue3 MVVM) + CloudBoard 文件管理 (React Flux) + 微前端通信层
- **决策工具:** 六维决策模型 + 决策矩阵 + 迁移路线图 + 健康度评分算法
- **Checklist:** 架构评审 Checklist (30+ 项) + 面试高频考点 + 15 道自测题

---

*训练完成时间: 2026-04-30 18:00*  
*架构训练迭代次数: 5 轮 (4/22→4/26→4/27→4/28→4/29→4/30)*  
*阶段一架构领域完成度: 100% ✅*
