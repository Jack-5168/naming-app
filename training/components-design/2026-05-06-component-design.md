# 专项训练 10：组件设计 — 5 个可复用组件

> 日期：2026-05-06 | 主题：表单/列表/模态框等可复用组件的 API 设计与可组合性

---

## 1. useForm — 表单管理 Hook

### 职责
管理表单状态、验证、提交生命周期，支持嵌套字段和动态字段。

### API 设计

```ts
interface UseFormOptions<T> {
  // 初始值
  defaultValues: T;
  // 验证器（支持同步/异步）
  validate?: (values: T) => Promise<ValidationResult> | ValidationResult;
  // 验证模式
  mode?: 'onSubmit' | 'onChange' | 'onBlur' | 'onTouched';
  // 字段级验证规则
  rules?: Partial<Record<keyof T, FieldRule>>;
}

interface UseFormReturn<T> {
  // 表单值
  values: T;
  // 错误映射
  errors: Partial<Record<keyof T, string>>;
  // 注册字段（返回 props 供 Input 使用）
  register: <K extends keyof T>(name: K) => FieldProps;
  // 提交处理
  handleSubmit: (onSubmit: (values: T) => void | Promise<void>) => () => Promise<void>;
  // 状态
  isSubmitting: boolean;
  isValidating: boolean;
  isDirty: boolean;
  // 操作
  reset: (values?: Partial<T>) => void;
  setValue: <K extends keyof T>(name: K, value: T[K]) => void;
  triggerValidate: (fields?: (keyof T)[]) => Promise<boolean>;
}
```

### 可组合性

```tsx
// 基础用法
const { register, handleSubmit, errors } = useForm({
  defaultValues: { name: '', email: '' },
  rules: {
    name: { required: '姓名不能为空', minLength: 2 },
    email: { required: true, pattern: EMAIL_REGEX }
  }
});

// 组合验证器
const { register } = useForm({
  defaultValues: { password: '', confirmPassword: '' },
  validate: async (values) => {
    const errors = {};
    if (values.password !== values.confirmPassword) {
      errors.confirmPassword = '两次密码不一致';
    }
    return errors;
  }
});

// 嵌套表单
const { register } = useForm({
  defaultValues: {
    user: { name: '', address: { city: '', street: '' } }
  }
});
// register('user.address.city') → 支持点号路径

// 动态字段
const { register, values } = useForm({ defaultValues: { tags: [] } });
// 配合 useFieldArray 使用
```

### 设计决策
- **register 模式**而非 value/onChange：减少重渲染，每个字段独立订阅自己的状态
- **异步验证优先**：统一用 Promise 接口，同步验证也用 Promise.resolve 包装
- **浅比较优化**：values 变更使用浅比较，避免不必要的重渲染
- **类型安全**：泛型 T 贯穿始终，register 返回值自动推断字段类型

---

## 2. useList — 列表数据管理 Hook

### 职责
管理列表的排序、筛选、分页、选择，支持服务端/客户端模式。

### API 设计

```ts
interface UseListOptions<T> {
  // 数据源
  dataSource?: T[];
  // 服务端获取
  fetcher?: (params: ListParams) => Promise<ListResult<T>>;
  // 唯一键
  rowKey: string | ((item: T) => string);
  // 默认配置
  pagination?: { pageSize: number; current?: number };
  sorter?: SortConfig;
  filters?: FilterConfig;
}

interface UseListReturn<T> {
  // 数据
  items: T[];
  total: number;
  loading: boolean;
  // 选择
  selected: Set<string>;
  select: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  // 分页
  pagination: { current: number; pageSize: number; total: number };
  setPage: (page: number) => void;
  // 排序
  sort: (field: string, direction: 'asc' | 'desc' | null) => void;
  currentSort: SortConfig | null;
  // 筛选
  filter: (field: string, value: any) => void;
  clearFilters: () => void;
  currentFilters: FilterConfig;
  // 刷新
  refresh: () => void;
}
```

### 可组合性

```tsx
// 客户端模式（本地数据）
const { items, selected, select, sort } = useList({
  dataSource: users,
  rowKey: 'id',
  pagination: { pageSize: 10 }
});

// 服务端模式
const { items, loading, pagination, sort } = useList({
  fetcher: async ({ page, pageSize, sort, filters }) => {
    const res = await api.getUsers({ page, pageSize, ...sort, ...filters });
    return { data: res.items, total: res.total };
  },
  rowKey: 'id'
});

// 组合选择 + 操作
const { items, selected, selectAll, clearSelection } = useList({ ... });
const selectedUsers = items.filter(u => selected.has(u.id));

// 自定义 rowKey
const { items, isSelected } = useList({
  dataSource: items,
  rowKey: (item) => `${item.tenantId}:${item.id}` // 复合键
});
```

### 设计决策
- **统一接口**：客户端/服务端共享同一套 API，通过 dataSource/fetcher 切换
- **Set 存储选择**：O(1) 查找，避免数组 indexOf
- **不可变排序**：sort 返回新引用，配合 React 的浅比较
- **防抖筛选**：输入类筛选自动防抖，精确类筛选立即触发

---

## 3. Modal — 模态框组件

### 职责
提供可组合的模态框，支持嵌套、动画、键盘交互、焦点管理。

### API 设计

```tsx
// 组合式 API
interface ModalProps {
  open: boolean;
  onClose: () => void;
  // 布局
  title?: ReactNode;
  footer?: ReactNode | false;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  // 行为
  closeOnOverlay?: boolean;
  closeOnEsc?: boolean;
  preserveFocus?: boolean;
  // 动画
  animation?: 'fade' | 'slide-up' | 'slide-right' | 'scale';
}

// 子组件
Modal.Header: React.FC<{ children: ReactNode }>;
Modal.Body: React.FC<{ children: ReactNode; scrollable?: boolean }>;
Modal.Footer: React.FC<{
  children?: ReactNode;
  actions?: ModalAction[];
  align?: 'start' | 'end' | 'center';
}>;

interface ModalAction {
  label: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
}

// 命令式 API（用于弹窗确认等场景）
Modal.confirm: (config: ConfirmConfig) => Promise<boolean>;
Modal.alert: (config: AlertConfig) => Promise<void>;
Modal.prompt: (config: PromptConfig) => Promise<string | null>;
```

### 可组合性

```tsx
// 基础用法
<Modal open={show} onClose={() => setShow(false)} title="编辑用户" size="lg">
  <Modal.Body scrollable>
    <UserForm userId={editingId} />
  </Modal.Body>
  <Modal.Footer
    actions={[
      { label: '取消', variant: 'secondary', onClick: () => setShow(false) },
      { label: '保存', variant: 'primary', onClick: handleSave }
    ]}
  />
</Modal>

// 嵌套模态
<Modal open={showParent} onClose={...}>
  <Modal.Body>
    <button onClick={() => setShowChild(true)}>删除</button>
    <Modal open={showChild} onClose={...} title="确认删除">
      <Modal.Body>此操作不可撤销，确定继续？</Modal.Body>
      <Modal.Footer actions={[...]} />
    </Modal>
  </Modal.Body>
</Modal>

// 命令式确认
const confirmed = await Modal.confirm({
  title: '删除用户',
  content: '此操作不可撤销',
  okText: '确认删除',
  cancelText: '取消',
  danger: true
});
if (confirmed) { await deleteUser(id); }

// 自定义内容
<Modal open={show} onClose={...} footer={false}>
  <Modal.Body>
    <Stepper steps={steps} />
  </Modal.Body>
</Modal>
```

### 设计决策
- **组合式 + 命令式双 API**：声明式用于复杂表单，命令式用于简单确认
- **焦点管理**：打开时聚焦第一个可聚焦元素，关闭时恢复焦点，Tab 键限制在模态框内
- **z-index 自动递增**：嵌套模态自动处理层级，无需手动管理
- **滚动锁定**：打开时锁定 body 滚动，关闭时恢复
- **footer={false}** 隐藏底部区域，给自定义内容留空间

---

## 4. usePagination + VirtualList — 虚拟滚动列表

### 职责
高性能渲染大量数据，只渲染可视区域内的 DOM 节点。

### API 设计

```ts
// 虚拟滚动 Hook
interface UseVirtualOptions {
  // 总项数或数据
  count: number;
  items?: any[];
  // 每项高度（固定或动态）
  itemHeight: number | ((index: number) => number);
  // 容器
  containerRef: RefObject<HTMLElement>;
  // 缓冲
  overscan?: number; // 默认 5
}

interface UseVirtualReturn {
  // 可视区域内的项
  visibleItems: VirtualItem[];
  // 总高度（用于撑开容器）
  totalHeight: number;
  // 滚动容器需要的样式
  containerStyle: React.CSSProperties;
  // 每项需要的样式和位置
  getItemStyle: (index: number) => React.CSSProperties;
  // 滚动到指定项
  scrollTo: (index: number, align?: 'start' | 'center' | 'end') => void;
  scrollToBottom: () => void;
  // 重置测量缓存（动态高度用）
  resetAfterIndex: (index: number) => void;
}

interface VirtualItem {
  index: number;
  key: string;
  style: React.CSSProperties;
  // 如果是 items 模式，直接带数据
  data?: any;
}
```

### 可组合性

```tsx
// 固定高度
const { visibleItems, containerStyle, getItemStyle, totalHeight } = useVirtual({
  count: 10000,
  itemHeight: 48,
  containerRef: containerRef,
  overscan: 10
});

<div ref={containerRef} style={{ height: 600, overflow: 'auto' }}>
  <div style={{ height: totalHeight, position: 'relative' }}>
    {visibleItems.map(item => (
      <div key={item.index} style={getItemStyle(item.index)}>
        <UserRow user={users[item.index]} />
      </div>
    ))}
  </div>
</div>

// 动态高度（可变行高）
const { visibleItems, containerStyle, getItemStyle, resetAfterIndex } = useVirtual({
  count: messages.length,
  itemHeight: (index) => {
    const msg = messages[index];
    return msg.image ? 200 : 48;
  },
  containerRef: containerRef
});

// 无限滚动组合
const { items, loading, hasMore } = useInfiniteList({ fetcher });
const { visibleItems, containerStyle } = useVirtual({
  count: items.length,
  itemHeight: 60,
  containerRef: containerRef
});
// 配合 IntersectionObserver 实现加载更多

// 可变尺寸缓存（避免重复测量）
const { getItemStyle, resetAfterIndex } = useVirtual({ ... });
// 当某项内容变化导致高度变化时
resetAfterIndex(changedIndex);
```

### 设计决策
- **Hook 而非组件**：保持灵活性，用户可自由控制渲染逻辑
- **固定/动态高度统一**：itemHeight 接受 number 或函数，API 不变
- **overscan 可配**：减少快速滚动时的白屏
- **测量缓存**：动态高度模式下缓存已测量的尺寸，避免重复计算
- **scrollTo 支持对齐**：start/center/end 三种对齐方式

---

## 5. useNotification — 通知系统

### 职责
全局通知管理，支持多种类型、自动消失、队列、操作按钮。

### API 设计

```ts
interface NotificationItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: ReactNode;
  duration?: number; // ms, 0 = 不自动关闭
  placement?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  // 操作
  actions?: NotificationAction[];
  // 关闭回调
  onClose?: () => void;
  // 是否显示关闭按钮
  closable?: boolean;
  // 进度条（倒计时）
  showProgress?: boolean;
}

interface NotificationAction {
  label: string;
  onClick: (id: string) => void;
  variant?: 'primary' | 'secondary';
}

interface UseNotificationReturn {
  // 快捷方法
  success: (message: ReactNode, options?: NotificationOptions) => string;
  error: (message: ReactNode, options?: NotificationOptions) => string;
  warning: (message: ReactNode, options?: NotificationOptions) => string;
  info: (message: ReactNode, options?: NotificationOptions) => string;
  // 通用方法
  notify: (options: NotificationItem) => string;
  // 更新
  update: (id: string, options: Partial<NotificationItem>) => void;
  // 关闭
  close: (id: string) => void;
  closeAll: () => void;
  // 获取当前通知列表（用于渲染）
  notifications: NotificationItem[];
}
```

### 可组合性

```tsx
// Provider 层（应用根节点）
<NotificationProvider maxVisible={5} gap={12}>
  <App />
</NotificationProvider>

// 组件内使用
const { success, error, notify } = useNotification();

// 快捷通知
success('用户创建成功');
error('网络请求失败，请重试');

// 带操作的通知
notify({
  type: 'info',
  title: '文件上传完成',
  message: 'report.pdf 已成功上传',
  actions: [
    { label: '查看', onClick: () => openFile('report.pdf') },
    { label: '分享', onClick: () => shareFile('report.pdf') }
  ],
  duration: 8000
});

// 异步操作通知（更新状态）
const id = notify({
  type: 'info',
  message: '正在导出数据...',
  duration: 0, // 不自动关闭
  closable: false
});

try {
  await exportData();
  update(id, {
    type: 'success',
    message: '导出完成，共 1234 条记录'
  });
} catch (e) {
  update(id, {
    type: 'error',
    message: `导出失败：${e.message}`
  });
}

// 批量操作进度
const id = notify({
  type: 'info',
  message: '正在处理 100 项...',
  showProgress: true,
  duration: 0
});

for (let i = 0; i < 100; i++) {
  await processItem(items[i]);
  update(id, {
    message: `正在处理 ${i + 1}/100...`
  });
}
```

### 设计决策
- **全局单例**：通过 Context 提供，任何组件都可访问
- **maxVisible 限制**：防止通知堆积，超出时排队
- **id 返回**：每个通知返回唯一 id，支持后续更新/关闭
- **ReactNode 消息**：message/title 支持 JSX，可嵌入链接、按钮等
- **进度条**：duration > 0 时显示倒计时进度条，用户知道还剩多久
- **位置分组**：不同 placement 独立队列，互不干扰

---

## 设计原则总结

| 原则 | 说明 | 应用示例 |
|------|------|----------|
| **组合优于继承** | 小颗粒度组合，不做大而全 | Modal.Header/Body/Footer 拆分 |
| **受控 + 非受控双模式** | 灵活适配不同场景 | useForm 的 mode 配置 |
| **Hook 优先** | 逻辑复用不绑定 UI | useList/useVirtual/useNotification |
| **类型安全** | 泛型贯穿，编译期检查 | useForm<T>/useList<T> |
| **渐进增强** | 基础用法简单，高级用法可扩展 | Modal 命令式 vs 组合式 |
| **不可变数据** | 避免副作用，便于调试 | useList 的排序/筛选返回新引用 |
| **关注点分离** | 数据逻辑与渲染解耦 | useVirtual 只算位置，渲染交给用户 |
