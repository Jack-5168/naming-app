# 组件设计专项训练 — 5 个可复用组件

**时间:** 2026-05-03 10:00  
**主题:** 可复用组件设计 — API 设计 / 可组合性 / 类型安全  
**框架:** 框架无关 (React/Vue 通用模式)

---

## 组件 1: 通用表单 (Form)

### 设计目标
- 声明式表单定义，自动校验、提交、状态管理
- 支持嵌套字段、动态字段、条件渲染

### API 设计

```typescript
// 核心类型
interface FieldConfig<T = any> {
  name: string;
  type: 'text' | 'number' | 'email' | 'select' | 'checkbox' | 'date';
  label?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: T;
  validate?: (value: T) => string | null;
  dependencies?: string[]; // 依赖字段，变化时重新校验
  hidden?: (values: Record<string, any>) => boolean; // 条件隐藏
  disabled?: (values: Record<string, any>) => boolean;
}

interface FormProps<T> {
  fields: FieldConfig<T>[];
  onSubmit: (values: T) => void | Promise<void>;
  transform?: (values: T) => T; // 提交前转换
  validateAll?: (values: T) => Record<string, string | null>;
  children?: (formApi: FormApi<T>) => ReactNode; // 渲染函数模式
}

interface FormApi<T> {
  values: T;
  errors: Record<string, string | null>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
  setField: (name: string, value: any) => void;
  reset: () => void;
  submit: () => void;
}
```

### 使用示例

```tsx
// 声明式用法
<Form<User>
  fields={[
    { name: 'name', type: 'text', required: true, label: '姓名' },
    { name: 'email', type: 'email', required: true, label: '邮箱' },
    {
      name: 'role',
      type: 'select',
      label: '角色',
      dependencies: ['email'],
      hidden: (v) => !v.email.includes('@admin.com'),
    },
    { name: 'agree', type: 'checkbox', label: '同意条款' },
  ]}
  onSubmit={async (values) => {
    await api.createUser(values);
  }}
  validateAll={(values) => ({
    name: values.name.length < 2 ? '至少2个字符' : null,
    email: !/^\S+@\S+$/.test(values.email) ? '邮箱格式错误' : null,
  })}
>
  {(form) => (
    <form onSubmit={form.submit}>
      <Field field="name" />
      <Field field="email" />
      <Field field="role" />
      <Field field="agree" />
      <button disabled={!form.isValid || form.isSubmitting}>
        {form.isSubmitting ? '提交中...' : '提交'}
      </button>
    </form>
  )}
</Form>
```

### 可组合性设计
- **Field 组件**独立可复用，支持 `form` context 注入
- **children render function** 模式 → 完全控制渲染
- **validateAll** 可选 → 单字段校验 + 全局校验可叠加
- **dependencies** 支持字段联动
- **hidden/disabled** 函数式 → 动态表单

### 关键实现要点
```typescript
function useForm<T>(fields: FieldConfig<T>[]) {
  // 1. 初始化 values/errors/touched
  // 2. 监听字段变化，触发依赖字段重新校验
  // 3. 异步提交锁 (isSubmitting)
  // 4. 脏检测 (isDirty)
}
```

---

## 组件 2: 数据表格 (DataTable)

### 设计目标
- 声明式列定义，支持排序/筛选/分页/选择/自定义渲染
- 大数据量虚拟滚动

### API 设计

```typescript
interface Column<T> {
  key: string;
  title?: string;
  render?: (value: any, record: T, index: number) => ReactNode;
  sorter?: 'asc' | 'desc' | ((a: T, b: T) => number);
  filterable?: boolean;
  filterOptions?: Array<{ label: string; value: any }>;
  width?: number | string;
  fixed?: 'left' | 'right';
  align?: 'left' | 'center' | 'right';
  ellipsis?: boolean; // 超长省略
  colSpan?: (record: T) => number; // 合并列
  rowSpan?: (record: T) => number; // 合并行
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowKey: string | ((record: T) => string);
  pagination?: false | {
    pageSize: number;
    total?: number; // 服务端分页时必填
    onChange?: (page: number, pageSize: number) => void;
  };
  sortable?: boolean;
  selectable?: boolean;
  onSelectionChange?: (selected: T[]) => void;
  onRowClick?: (record: T, index: number) => void;
  loading?: boolean;
  emptyText?: string;
  virtual?: boolean; // 虚拟滚动
  rowHeight?: number; // 虚拟滚动行高
  expandable?: {
    expandedRowRender: (record: T) => ReactNode;
    rowExpandable?: (record: T) => boolean;
  };
  footer?: ReactNode | ((data: T[]) => ReactNode);
}
```

### 使用示例

```tsx
<DataTable<User>
  data={users}
  columns={[
    { key: 'name', title: '姓名', width: 120, ellipsis: true },
    { key: 'email', title: '邮箱', width: 200 },
    {
      key: 'status',
      title: '状态',
      render: (v) => <Badge color={v === 'active' ? 'green' : 'red'}>{v}</Badge>,
      filterable: true,
      filterOptions: [
        { label: '活跃', value: 'active' },
        { label: '禁用', value: 'disabled' },
      ],
    },
    {
      key: 'actions',
      title: '操作',
      render: (_, record) => (
        <>
          <button onClick={() => edit(record)}>编辑</button>
          <button onClick={() => remove(record)}>删除</button>
        </>
      ),
      width: 150,
      fixed: 'right',
    },
  ]}
  rowKey="id"
  pagination={{ pageSize: 20, total: 1000 }}
  sortable
  selectable
  virtual
  expandable={{
    expandedRowRender: (record) => <UserDetail user={record} />,
  }}
  loading={loading}
/>
```

### 可组合性设计
- **columns 数组** → 动态列配置 (从 API 获取列定义)
- **render 函数** → 每列完全自定义
- **pagination=false** → 禁用分页
- **virtual** → 可选虚拟滚动
- **expandable** → 可选展开行
- **fixed** → 固定列 (左/右)

### 关键实现要点
```typescript
// 排序 + 筛选 + 分页 pipeline
const pipeline = (data, columns, filters, sort, pagination) =>
  pipe(
    filterByConditions(data, filters),
    sortByColumn(data, sort),
    paginate(data, pagination)
  );

// 虚拟滚动: 只渲染可视区域行 + buffer
// visibleStart = Math.floor(scrollTop / rowHeight)
// visibleEnd = visibleStart + viewportHeight / rowHeight + buffer
```

---

## 组件 3: 模态框 (Modal/Dialog)

### 设计目标
- 命令式 + 声明式双 API
- 支持嵌套、拖拽、全屏、确认对话框

### API 设计

```typescript
// === 声明式 ===
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  footer?: ReactNode | false;
  width?: number | string;
  maskClosable?: boolean;
  destroyOnClose?: boolean;
  draggable?: boolean;
  fullscreen?: boolean;
  placement?: 'center' | 'top' | 'bottom';
  children?: ReactNode;
}

// === 命令式 ===
interface ModalStatic {
  confirm: (config: ConfirmConfig) => Promise<boolean>;
  alert: (config: AlertConfig) => Promise<void>;
  prompt: (config: PromptConfig) => Promise<string | null>;
  destroy: () => void;
}

interface ConfirmConfig {
  title: ReactNode;
  content: ReactNode;
  okText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'danger';
}

interface PromptConfig extends ConfirmConfig {
  defaultValue?: string;
  inputType?: 'text' | 'textarea' | 'password';
}
```

### 使用示例

```tsx
// 声明式
const [open, setOpen] = useState(false);
<Modal open={open} onClose={() => setOpen(false)} title="编辑用户" draggable>
  <UserForm user={currentUser} onSave={() => setOpen(false)} />
</Modal>

// 命令式 — 确认对话框
const confirmed = await Modal.confirm({
  title: '删除确认',
  content: '此操作不可撤销，确定继续？',
  type: 'warning',
  okText: '确定删除',
  cancelText: '取消',
});
if (confirmed) {
  await api.deleteUser(id);
}

// 命令式 — 输入框
const name = await Modal.prompt({
  title: '新建项目',
  content: '请输入项目名称',
  inputType: 'text',
  defaultValue: '新项目',
});

// 命令式 — 手动销毁
const modal = Modal.confirm({ ... });
// ... 稍后
modal.destroy();
```

### 可组合性设计
- **声明式** → 受控组件，适合表单内嵌
- **命令式** → Promise API，适合操作确认
- **Modal.Body / Modal.Header / Modal.Footer** → 子组件拆分
- **destroyOnClose** → 关闭时卸载 DOM
- **draggable** → 可拖拽
- **placement** → 位置控制

### 关键实现要点
```typescript
// 命令式实现: 通过 createPortal + 动态挂载组件
function createModal(config: ConfirmConfig): Promise<boolean> {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const handleClose = (result: boolean) => {
      resolve(result);
      ReactDOM.unmountComponentAtNode(container);
      container.remove();
    };

    ReactDOM.render(
      <ConfirmModal {...config} onConfirm={() => handleClose(true)} onCancel={() => handleClose(false)} />,
      container
    );
  });
}

// 嵌套支持: z-index 层级管理
// 每个新 modal z-index = max(existing z-index) + 1
// 关闭时恢复前一个 modal 的 pointer-events
```

---

## 组件 4: 通知/Toast (Notification)

### 设计目标
- 队列管理，自动销毁，支持多种类型
- 命令式 API，全局单例

### API 设计

```typescript
interface ToastConfig {
  message: ReactNode;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number; // ms, 0 = 不自动关闭
  placement?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  closable?: boolean;
  onClose?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  id?: string; // 去重 key
  renderIcon?: () => ReactNode;
}

interface ToastAPI {
  success: (message: ReactNode, config?: Omit<ToastConfig, 'message' | 'type'>) => string;
  error: (message: ReactNode, config?: Omit<ToastConfig, 'message' | 'type'>) => string;
  warning: (message: ReactNode, config?: Omit<ToastConfig, 'message' | 'type'>) => string;
  info: (message: ReactNode, config?: Omit<ToastConfig, 'message' | 'type'>) => string;
  remove: (id: string) => void;
  clear: (placement?: string) => void;
  config: (globalConfig: Partial<ToastConfig>) => void;
}
```

### 使用示例

```tsx
// 快捷用法
Toast.success('保存成功');
Toast.error('网络错误，请重试');
Toast.warning('存储空间不足');

// 完整配置
Toast.info('文件上传中...', {
  duration: 0, // 不自动关闭
  action: {
    label: '取消',
    onClick: () => abortUpload(),
  },
  onClose: () => console.log('toast 关闭'),
});

// 去重: 相同 id 的 toast 不会重复显示
Toast.info('加载中', { id: 'loading', duration: 0 });
// ... 稍后
Toast.remove('loading');
Toast.success('加载完成');

// 全局配置
Toast.config({ duration: 3000, placement: 'top-center' });
```

### 可组合性设计
- **快捷方法** → `success/error/warning/info` 简化调用
- **id 去重** → 防止重复通知
- **action** → 可选操作按钮 (撤销/重试)
- **clear** → 批量清除
- **全局 config** → 统一默认行为
- **placement** → 多位置支持

### 关键实现要点
```typescript
// 队列管理 + 动画
class ToastManager {
  private queues: Map<string, ToastItem[]> = new Map(); // by placement
  private globalConfig: Partial<ToastConfig> = {};

  add(config: ToastConfig): string {
    const id = config.id || generateId();
    // 去重: 同 placement 下同 id 已存在则跳过
    const queue = this.getQueue(config.placement);
    if (config.id && queue.find(t => t.id === config.id)) return id;

    const item = { ...config, id, timestamp: Date.now() };
    queue.push(item);
    this.scheduleRemoval(item);
    this.notify();
    return id;
  }

  private scheduleRemoval(item: ToastItem) {
    if (item.duration > 0) {
      setTimeout(() => this.remove(item.id), item.duration);
    }
  }
}

// 动画: CSS transform + opacity (GPU 加速)
// enter: translateY(-20px) + opacity 0 → translateY(0) + opacity 1
// exit: translateY(0) + opacity 1 → translateY(-20px) + opacity 0
```

---

## 组件 5: 无限加载列表 (VirtualList / InfiniteScroll)

### 设计目标
- 支持两种模式: 虚拟滚动 (大数据) + 无限加载 (分页)
- 统一 API，按需切换

### API 设计

```typescript
// === 虚拟滚动模式 ===
interface VirtualListProps<T> {
  data: T[];
  itemHeight: number | ((item: T, index: number) => number);
  overscan?: number; // 预渲染行数
  renderItem: (item: T, index: number, style: CSSProperties) => ReactNode;
  keyExtractor: (item: T, index: number) => string;
  onScroll?: (scrollTop: number) => void;
  onVisibleRangeChange?: (start: number, end: number) => void;
  height: number; // 容器高度
  width?: number | string;
  placeholder?: ReactNode;
  empty?: ReactNode;
}

// === 无限加载模式 ===
interface InfiniteListProps<T> {
  loader: (page: number, pageSize: number) => Promise<{
    data: T[];
    hasMore: boolean;
    total?: number;
  }>;
  pageSize?: number;
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T, index: number) => string;
  threshold?: number; // 距底部多少 px 触发加载
  loaderComponent?: ReactNode; // 加载中组件
  noMoreComponent?: ReactNode; // 无更多数据组件
  errorComponent?: (retry: () => void) => ReactNode; // 错误组件
  emptyComponent?: ReactNode;
  onLoaded?: (data: T[], page: number) => void;
}
```

### 使用示例

```tsx
// 虚拟滚动 — 10 万条数据
<VirtualList<User>
  data={allUsers}
  itemHeight={48}
  height={600}
  overscan={5}
  keyExtractor={(u) => u.id}
  renderItem={(user, index, style) => (
    <div style={style}>
      <UserRow user={user} />
    </div>
  )}
  onVisibleRangeChange={(start, end) => {
    // 预加载可见区域附近的图片
    prefetchImages(allUsers.slice(start, end));
  }}
/>

// 无限加载 — 分页 API
<InfiniteList<User>
  loader={async (page, pageSize) => {
    const res = await api.getUsers({ page, pageSize });
    return {
      data: res.items,
      hasMore: page * pageSize < res.total,
      total: res.total,
    };
  }}
  pageSize={20}
  threshold={200}
  keyExtractor={(u) => u.id}
  renderItem={(user) => <UserRow user={user} />}
  loaderComponent={<Spinner />}
  noMoreComponent={<p>没有更多数据了</p>}
  errorComponent={(retry) => (
    <div>
      <p>加载失败</p>
      <button onClick={retry}>重试</button>
    </div>
  )}
/>
```

### 可组合性设计
- **两种模式** → 数据量小用 InfiniteList，大数据用 VirtualList
- **itemHeight 函数** → 支持动态行高
- **overscan** → 滚动时预渲染，减少闪烁
- **onVisibleRangeChange** → 配合图片懒加载
- **loader** → 与任何 API 层对接
- **errorComponent(retry)** → 错误可重试

### 关键实现要点
```typescript
// 虚拟滚动核心算法
function useVirtualScroll(data, itemHeight, containerHeight, overscan = 5) {
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = data.length * itemHeight;
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIdx = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIdx = Math.min(data.length, startIdx + visibleCount + overscan * 2);

  const offsetY = startIdx * itemHeight;

  return {
    visibleData: data.slice(startIdx, endIdx),
    totalHeight,
    offsetY,
    startIndex: startIdx,
  };
}

// 无限加载: IntersectionObserver 检测底部
// 使用 resize observer 检测容器高度变化
// 防抖加载: 快速滚动时不重复触发
```

---

## 组件设计模式总结

### 1. API 设计原则
| 原则 | 说明 | 示例 |
|------|------|------|
| **约定优于配置** | 合理的默认值，减少必填 prop | DataTable 默认分页 20 条 |
| **受控 + 非受控双模式** | 简单场景用非受控，复杂场景用受控 | Modal open/draggable |
| **Render Props / Children as Function** | 暴露内部状态，让使用者控制渲染 | Form children={form => ...} |
| **命令式 API** | 操作确认/通知等场景，Promise 更自然 | Modal.confirm / Toast.success |
| **组合 > 继承** | 小颗粒组件组合，而非大组件继承 | Modal.Header/Body/Footer |

### 2. 可组合性检查清单
- [ ] 每个 prop 是否有合理的默认值？
- [ ] 是否支持 `false` / `null` 禁用某个功能？
- [ ] 是否暴露了内部状态 (通过 render props 或 ref)？
- [ ] 是否支持自定义渲染 (render / children)？
- [ ] 是否支持动态配置 (从 API 获取列定义/字段定义)？
- [ ] 是否与框架解耦 (纯逻辑可抽离为 hook/composable)？

### 3. 类型安全要点
```typescript
// 泛型贯穿: 数据模型类型安全
interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[]; // Column 可以引用 T
  // ...
}

// 条件类型: 根据 prop 推断返回值
type ModalResult<T extends ModalType> =
  T extends 'confirm' ? Promise<boolean> :
  T extends 'prompt' ? Promise<string | null> :
  Promise<void>;

// 泛型约束: 确保 key 存在于数据模型中
interface DataTableProps<T> {
  rowKey: keyof T | ((record: T) => string);
}
```

### 4. 性能优化模式
| 组件 | 优化策略 |
|------|----------|
| Form | 字段级 re-render (每个 Field 独立 state) |
| DataTable | 虚拟滚动 + 列 memo + 排序/筛选防抖 |
| Modal | destroyOnClose + 动态挂载/卸载 |
| Toast | 队列管理 + CSS 动画 (GPU) + 去重 |
| VirtualList | 只渲染可视区域 + overscan + 动态行高 |

---

## 面试自测题

1. **Form 组件如何实现字段联动校验？** (dependencies + 触发重新校验)
2. **DataTable 排序 + 筛选 + 分页的 pipeline 如何设计？** (函数组合，纯函数)
3. **Modal 命令式 API 如何实现 Promise？** (动态挂载组件 + resolve/reject)
4. **Toast 如何防止重复通知？** (id 去重 + 队列管理)
5. **VirtualList 如何支持动态行高？** (itemHeight 函数 + 缓存已计算高度)
6. **组件库如何做 tree-shaking？** (ESM 导出 + barrel file 优化)
7. **如何设计一个支持 SSR 的组件？** (避免 window/document 直接访问)

---

**文档生成时间:** 2026-05-03 10:00  
**下次训练建议:** 组件测试策略 (单元测试/E2E/视觉回归)
