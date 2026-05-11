# 组件设计专项训练 — 5 个可复用组件

> 日期: 2026-04-30 10:00
> 目标: 设计 5 个可复用组件，重点考察 API 设计、可组合性、类型安全

---

## 组件 1: Form — 声明式表单系统

### 设计目标

- 声明式字段定义，内置验证
- 字段间联动（一个字段值影响另一个字段的状态）
- 可组合：Form → Field → Input/Select/Checkbox
- 支持异步验证、自定义验证器

### API 设计

```typescript
// 核心类型
interface FormConfig<T extends Record<string, any>> {
  fields: FieldConfig<T>;
  onSubmit: (values: T) => void | Promise<void>;
  validateOn?: 'blur' | 'change' | 'submit';
}

interface FieldConfig<T> {
  [K in keyof T]: {
    type: 'text' | 'number' | 'email' | 'select' | 'checkbox' | 'date' | 'textarea';
    label: string;
    placeholder?: string;
    required?: boolean;
    validators?: Validator<T>[];
    dependsOn?: (keyof T)[];           // 联动：依赖其他字段
    when?: (values: T) => boolean;     // 条件渲染
    defaultValue?: T[K];
    transform?: (value: any) => T[K];  // 输入转换
  };
}

type Validator<T> = (value: any, allValues: T) => string | null;
type AsyncValidator<T> = (value: any, allValues: T) => Promise<string | null>;
```

### 实现

```typescript
class Form<T extends Record<string, any>> {
  private values: T;
  private errors: Partial<Record<keyof T, string | null>> = {};
  private touched: Partial<Record<keyof T, boolean>> = {};
  private config: FormConfig<T>;

  constructor(config: FormConfig<T>) {
    this.config = config;
    this.values = this.initValues();
  }

  private initValues(): T {
    const init = {} as T;
    for (const [key, field] of Object.entries(this.config.fields)) {
      init[key as keyof T] = field.defaultValue ?? this.getDefaultForType(field.type);
    }
    return init;
  }

  // 设置字段值，触发依赖字段重新验证
  setValue<K extends keyof T>(key: K, value: T[K]): void {
    this.values[key] = value;
    this.touched[key] = true;
    this.validateField(key);
    // 触发依赖于此字段的字段重新验证
    this.invalidateDependents(key);
  }

  // 验证单个字段
  async validateField<K extends keyof T>(key: K): Promise<boolean> {
    const field = this.config.fields[key];
    if (!field) return false;

    let error: string | null = null;

    // required 检查
    if (field.required && !this.values[key]) {
      error = `${field.label} 是必填项`;
    }

    // 内置类型验证
    if (!error && field.type === 'email' && this.values[key]) {
      error = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(this.values[key]))
        ? null : '邮箱格式不正确';
    }

    // 自定义验证器
    if (!error && field.validators) {
      for (const validator of field.validators) {
        error = validator(this.values[key], this.values);
        if (error) break;
      }
    }

    // 异步验证
    if (!error && field.asyncValidator) {
      error = await field.asyncValidator(this.values[key], this.values);
    }

    this.errors[key] = error;
    return !error;
  }

  // 验证所有字段
  async validate(): Promise<boolean> {
    const results = await Promise.all(
      Object.keys(this.config.fields).map(k => this.validateField(k as keyof T))
    );
    return results.every(Boolean);
  }

  // 提交
  async submit(): Promise<void> {
    if (!await this.validate()) return;
    await this.config.onSubmit(this.values);
  }

  // 获取状态（供 UI 消费）
  getState(): FormState<T> {
    return {
      values: { ...this.values },
      errors: { ...this.errors },
      touched: { ...this.touched },
      isValid: Object.values(this.errors).every(e => e === null),
      isDirty: Object.values(this.touched).some(Boolean),
    };
  }

  // 重置
  reset(): void {
    this.values = this.initValues();
    this.errors = {};
    this.touched = {};
  }

  // 联动：使依赖字段失效
  private invalidateDependents(changedKey: keyof T): void {
    for (const [key, field] of Object.entries(this.config.fields)) {
      if (field.dependsOn?.includes(changedKey)) {
        this.validateField(key as keyof T);
      }
    }
  }
}

interface FormState<T> {
  values: T;
  errors: Partial<Record<keyof T, string | null>>;
  touched: Partial<Record<keyof T, boolean>>;
  isValid: boolean;
  isDirty: boolean;
}
```

### 使用示例

```typescript
// 注册表单 — 展示联动 + 异步验证
const registerForm = new Form({
  fields: {
    username: {
      type: 'text',
      label: '用户名',
      required: true,
      validators: [
        (v) => v.length >= 3 ? null : '用户名至少 3 个字符',
      ],
      asyncValidator: async (v) => {
        const taken = await checkUsernameAvailable(v);
        return taken ? '用户名已被占用' : null;
      },
    },
    email: {
      type: 'email',
      label: '邮箱',
      required: true,
    },
    password: {
      type: 'text',
      label: '密码',
      required: true,
      validators: [(v) => v.length >= 8 ? null : '密码至少 8 个字符'],
    },
    confirmPassword: {
      type: 'text',
      label: '确认密码',
      required: true,
      dependsOn: ['password'],  // 联动：密码变化时重新验证
      validators: [
        (v, all) => v === all.password ? null : '两次密码不一致',
      ],
    },
    role: {
      type: 'select',
      label: '角色',
      required: true,
      options: ['developer', 'designer', 'manager'],
      when: (values) => values.email.endsWith('@company.com'), // 条件渲染
    },
  },
  onSubmit: async (values) => {
    await api.register(values);
  },
});
```

### 设计要点

| 考量 | 方案 |
|------|------|
| 类型安全 | 泛型 T 贯穿始终，字段名和值类型强绑定 |
| 可组合性 | Form 不渲染，只管理状态；UI 层通过 getState() 消费 |
| 联动 | dependsOn 声明依赖关系，自动级联验证 |
| 条件渲染 | when 函数根据当前值决定是否显示字段 |
| 异步验证 | 支持 Promise 返回的验证器 |
| 验证时机 | validateOn 配置 blur/change/submit |

---

## 组件 2: DataTable — 可组合数据表格

### 设计目标

- 列定义声明式配置
- 排序、过滤、分页、行选择
- 可组合：DataTable → Column → Cell → Row
- 支持虚拟滚动（大数据量）
- 支持自定义渲染插槽

### API 设计

```typescript
interface DataTableConfig<T> {
  data: T[];
  columns: Column<T>[];
  rowKey: keyof T | ((row: T) => string);
  pagination?: PaginationConfig;
  selection?: SelectionConfig;
  onRowClick?: (row: T) => void;
  virtualScroll?: VirtualScrollConfig;
}

interface Column<T> {
  key: string;
  title: string;
  width?: number;
  sortable?: boolean;
  filterable?: boolean;
  fixed?: 'left' | 'right';
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T, index: number) => any;  // 自定义渲染
  sorter?: (a: T, b: T) => number;                      // 自定义排序
  filter?: (value: any, row: T) => boolean;             // 自定义过滤
}

interface PaginationConfig {
  pageSize: number;
  total?: number;  // 服务端分页时传入
  showSizeChanger?: boolean;
  pageSizes?: number[];
}

interface SelectionConfig {
  type: 'single' | 'multiple';
  selected?: string[];
  onChange?: (selected: string[], rows: any[]) => void;
  getCheckboxProps?: (row: any) => { disabled?: boolean };
}
```

### 实现

```typescript
class DataTable<T extends Record<string, any>> {
  private rawData: T[];
  private config: DataTableConfig<T>;

  // 状态
  private sortState: { key: string; direction: 'asc' | 'desc' | null } = {
    key: '', direction: null,
  };
  private filters: Record<string, any> = {};
  private currentPage = 1;
  private selectedRows: Set<string> = new Set();

  constructor(config: DataTableConfig<T>) {
    this.config = config;
    this.rawData = [...config.data];
  }

  // 数据管线：过滤 → 排序 → 分页
  getData(): DataTableResult<T> {
    let data = [...this.rawData];

    // 1. 过滤
    data = this.applyFilters(data);

    // 2. 排序
    data = this.applySort(data);

    // 3. 分页
    const total = data.length;
    const { pageSize } = this.config.pagination ?? { pageSize: 20 };
    const start = (this.currentPage - 1) * pageSize;
    const pageData = data.slice(start, start + pageSize);

    return {
      data: pageData,
      total,
      currentPage: this.currentPage,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      selectedRows: this.getSelectedRows(),
    };
  }

  // 过滤
  setFilter(key: string, value: any): void {
    if (value === null || value === undefined || value === '') {
      delete this.filters[key];
    } else {
      this.filters[key] = value;
    }
    this.currentPage = 1;
  }

  // 排序
  setSort(key: string, direction: 'asc' | 'desc' | null): void {
    this.sortState = { key, direction };
  }

  // 分页
  setPage(page: number): void {
    this.currentPage = Math.max(1, Math.min(page, this.getTotalPages()));
  }

  // 选择
  toggleRow(key: string): void {
    if (this.selectedRows.has(key)) {
      this.selectedRows.delete(key);
    } else {
      if (this.config.selection?.type === 'single') {
        this.selectedRows.clear();
      }
      this.selectedRows.add(key);
    }
    this.config.selection?.onChange?.(
      [...this.selectedRows],
      this.getSelectedRows()
    );
  }

  toggleAll(select: boolean): void {
    const pageData = this.getData();
    if (select) {
      pageData.data.forEach(row => {
        const key = this.getRowKey(row);
        const props = this.config.selection?.getCheckboxProps?.(row);
        if (!props?.disabled) this.selectedRows.add(key);
      });
    } else {
      pageData.data.forEach(row => this.selectedRows.delete(this.getRowKey(row)));
    }
  }

  // 内部：应用过滤
  private applyFilters(data: T[]): T[] {
    const filterableColumns = this.config.columns.filter(c => c.filterable || c.filter);
    if (Object.keys(this.filters).length === 0) return data;

    return data.filter(row => {
      return filterableColumns.every(col => {
        const filterValue = this.filters[col.key];
        if (filterValue === undefined) return true;
        if (col.filter) return col.filter(filterValue, row);
        const cellValue = String(row[col.key] ?? '').toLowerCase();
        return cellValue.includes(String(filterValue).toLowerCase());
      });
    });
  }

  // 内部：应用排序
  private applySort(data: T[]): T[] {
    const { key, direction } = this.sortState;
    if (!direction || !key) return data;

    const column = this.config.columns.find(c => c.key === key);
    const multiplier = direction === 'asc' ? 1 : -1;

    return data.sort((a, b) => {
      if (column?.sorter) return column.sorter(a, b) * multiplier;
      const aVal = a[key];
      const bVal = b[key];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * multiplier;
      }
      return String(aVal).localeCompare(String(bVal)) * multiplier;
    });
  }

  private getRowKey(row: T): string {
    const { rowKey } = this.config;
    return typeof rowKey === 'function' ? rowKey(row) : String(row[rowKey]);
  }

  private getSelectedRows(): T[] {
    return this.rawData.filter(row => this.selectedRows.has(this.getRowKey(row)));
  }

  private getTotalPages(): number {
    const filtered = this.applyFilters(this.applySort([...this.rawData]));
    const pageSize = this.config.pagination?.pageSize ?? 20;
    return Math.max(1, Math.ceil(filtered.length / pageSize));
  }

  // 更新数据源
  setData(data: T[]): void {
    this.rawData = [...data];
  }
}

interface DataTableResult<T> {
  data: T[];
  total: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  selectedRows: T[];
}
```

### 使用示例

```typescript
// 用户管理表格
const userTable = new DataTable({
  data: users,
  rowKey: 'id',
  columns: [
    { key: 'name', title: '姓名', width: 120, sortable: true, filterable: true },
    { key: 'email', title: '邮箱', width: 200, sortable: true },
    {
      key: 'role', title: '角色', width: 100, filterable: true,
      render: (role: string) => ({
        admin: '👑 管理员',
        user: '👤 普通用户',
        guest: '👻 访客',
      }[role] ?? role),
    },
    {
      key: 'status', title: '状态', width: 80,
      render: (status: string) => status === 'active' ? '✅ 活跃' : '⏸ 停用',
    },
    {
      key: 'actions', title: '操作', width: 150, fixed: 'right',
      render: (_: any, row: User) => `编辑 | 删除`,  // 实际渲染由 UI 层处理
    },
  ],
  pagination: { pageSize: 20, showSizeChanger: true, pageSizes: [10, 20, 50, 100] },
  selection: {
    type: 'multiple',
    onChange: (keys, rows) => console.log(`选中 ${keys.length} 行`),
  },
});

// 消费数据
const result = userTable.getData();
// result.data → 当前页数据
// result.total → 总数
// result.selectedRows → 选中行
```

### 设计要点

| 考量 | 方案 |
|------|------|
| 数据管线 | 过滤 → 排序 → 分页 三段式，顺序固定 |
| 类型安全 | 泛型 T 贯穿，列 key 与 T 的 key 关联 |
| 可组合性 | DataTable 只管逻辑，渲染由 render 函数 + UI 层完成 |
| 大数据量 | virtualScroll 配置预留，rowKey 保证唯一性 |
| 扩展性 | 自定义 sorter/filter/render 覆盖默认行为 |
| 选择 | Set 存储，支持单选/多选/禁用 |

---

## 组件 3: Modal — 可组合模态框系统

### 设计目标

- 声明式 API：`Modal.open()` 返回句柄
- 支持嵌套模态框（z-index 自动管理）
- 可组合：Modal → Header → Body → Footer
- 支持动画、ESC 关闭、点击遮罩关闭
- 支持 Promise 风格的确认对话框

### API 设计

```typescript
interface ModalConfig {
  title?: string;
  content: string | (() => any);    // 字符串或渲染函数
  width?: number | string;
  maskClosable?: boolean;
  escClosable?: boolean;
  closable?: boolean;
  footer?: ModalFooterConfig;
  animation?: 'fade' | 'slide' | 'scale';
  destroyOnClose?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  onOk?: () => void | Promise<void>;
  onCancel?: () => void;
}

interface ModalFooterConfig {
  okText?: string;
  cancelText?: string;
  showOk?: boolean;
  showCancel?: boolean;
  okDisabled?: boolean;
  loading?: boolean;
}

interface ModalHandle {
  close: () => void;
  update: (config: Partial<ModalConfig>) => void;
  isOpen: () => boolean;
  promise: Promise<any>;  // 等待关闭结果
}
```

### 实现

```typescript
class ModalManager {
  private static instance: ModalManager;
  private modals: Map<string, ModalInstance> = new Map();
  private zIndex = 1000;

  static getInstance(): ModalManager {
    if (!ModalManager.instance) {
      ModalManager.instance = new ModalManager();
    }
    return ModalManager.instance;
  }

  // 打开模态框
  open(config: ModalConfig): ModalHandle {
    const id = `modal_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const zIndex = this.zIndex++;

    const instance = new ModalInstance(id, { ...config, zIndex });
    this.modals.set(id, instance);

    let resolvePromise: (value: any) => void;
    const promise = new Promise<any>(resolve => {
      resolvePromise = resolve;
    });

    const handle: ModalHandle = {
      close: (result?: any) => {
        this.close(id, result);
        resolvePromise(result);
      },
      update: (updates) => instance.update(updates),
      isOpen: () => instance.isOpen,
      promise,
    };

    instance.onClose = () => {
      this.modals.delete(id);
      resolvePromise(null);
    };

    config.onOpen?.();
    return handle;
  }

  // 确认对话框（Promise 风格）
  confirm(config: Omit<ModalConfig, 'footer'>): Promise<boolean> {
    return new Promise((resolve) => {
      const handle = this.open({
        ...config,
        footer: { okText: '确认', cancelText: '取消', showOk: true, showCancel: true },
        onOk: async () => {
          handle.close(true);
        },
        onCancel: () => {
          handle.close(false);
        },
      });

      handle.promise.then((result) => resolve(!!result));
    });
  }

  // 警告对话框
  alert(message: string, title = '提示'): Promise<void> {
    return new Promise((resolve) => {
      const handle = this.open({
        title,
        content: message,
        footer: { okText: '确定', showCancel: false },
        onOk: () => handle.close(),
        maskClosable: false,
        escClosable: true,
      });
      handle.promise.then(() => resolve());
    });
  }

  private close(id: string, result?: any): void {
    const instance = this.modals.get(id);
    if (instance) {
      instance.isOpen = false;
      instance.onClose?.();
    }
  }

  // 获取最顶层模态框
  getTopModal(): ModalInstance | undefined {
    let top: ModalInstance | undefined;
    for (const modal of this.modals.values()) {
      if (modal.isOpen && (!top || modal.zIndex > top.zIndex)) {
        top = modal;
      }
    }
    return top;
  }

  // 关闭所有
  closeAll(): void {
    for (const [id] of this.modals) {
      this.close(id);
    }
  }
}

class ModalInstance {
  id: string;
  config: ModalConfig & { zIndex: number };
  isOpen = true;
  onClose?: () => void;

  constructor(id: string, config: ModalConfig & { zIndex: number }) {
    this.id = id;
    this.config = config;
  }

  update(updates: Partial<ModalConfig>): void {
    Object.assign(this.config, updates);
  }
}
```

### 使用示例

```typescript
const modal = ModalManager.getInstance();

// 1. 基础用法
const handle = modal.open({
  title: '编辑用户',
  content: () => renderEditForm(),  // 渲染函数
  width: 600,
  footer: { okText: '保存', cancelText: '取消' },
  onOk: async () => {
    await saveUser(formValues);
    handle.close();
  },
  onCancel: () => handle.close(),
  destroyOnClose: true,
});

// 2. 等待关闭结果
const result = await handle.promise;

// 3. 确认对话框
const confirmed = await modal.confirm({
  title: '删除确认',
  content: '确定要删除这条记录吗？此操作不可撤销。',
});
if (confirmed) {
  await deleteUser(id);
}

// 4. 嵌套模态框（自动 z-index 管理）
modal.open({
  title: '父模态框',
  content: '点击打开子模态框',
  onOk: () => {
    modal.open({
      title: '子模态框',
      content: '我是嵌套的',
      maskClosable: false,
    });
  },
});

// 5. ESC 关闭最顶层
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const top = modal.getTopModal();
    if (top?.config.escClosable !== false) {
      top?.onClose?.();
    }
  }
});
```

### 设计要点

| 考量 | 方案 |
|------|------|
| 单例管理 | ModalManager 单例，全局控制 z-index |
| 嵌套支持 | zIndex 自增，getTopModal 获取顶层 |
| Promise 风格 | confirm/alert 返回 Promise，await 等待结果 |
| 句柄模式 | open() 返回 handle，支持 close/update/isOpen |
| 内容灵活 | content 支持字符串或渲染函数 |
| 生命周期 | onOpen/onClose 回调 + destroyOnClose |

---

## 组件 4: Toast — 通知消息系统

### 设计目标

- 自动管理消息队列和生命周期
- 支持类型：success/error/warning/info
- 可配置位置、持续时间、最大并发数
- 支持操作按钮（如"撤销"）
- 可组合：Toast → ToastItem

### API 设计

```typescript
interface ToastConfig {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;       // ms, 0 = 不自动关闭
  position?: 'top' | 'top-right' | 'top-left' | 'bottom' | 'bottom-right' | 'bottom-left';
  action?: {               // 操作按钮
    label: string;
    onClick: (toastId: string) => void;
  };
  onClose?: () => void;
  closable?: boolean;
  key?: string;           // 去重 key，相同 key 的消息不会重复显示
}

interface ToastManagerConfig {
  maxToasts?: number;      // 最大并发数
  defaultDuration?: number;
  defaultPosition?: ToastConfig['position'];
}
```

### 实现

```typescript
class ToastManager {
  private static instance: ToastManager;
  private toasts: Map<string, ToastEntry> = new Map();
  private config: Required<ToastManagerConfig>;
  private listeners: Set<(toasts: ToastEntry[]) => void> = new Set();

  static getInstance(config?: ToastManagerConfig): ToastManager {
    if (!ToastManager.instance) {
      ToastManager.instance = new ToastManager(config);
    }
    return ToastManager.instance;
  }

  private constructor(userConfig?: ToastManagerConfig) {
    this.config = {
      maxToasts: userConfig?.maxToasts ?? 5,
      defaultDuration: userConfig?.defaultDuration ?? 3000,
      defaultPosition: userConfig?.defaultPosition ?? 'top-right',
    };
  }

  // 核心：显示消息
  show(config: ToastConfig): string {
    const id = config.key ?? `toast_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // 去重：相同 key 已存在则更新
    if (this.toasts.has(id)) {
      this.update(id, config);
      return id;
    }

    // 超出最大数，移除最旧的
    if (this.toasts.size >= this.config.maxToasts) {
      const oldest = this.toasts.keys().next().value;
      this.dismiss(oldest);
    }

    const entry: ToastEntry = {
      id,
      message: config.message,
      type: config.type ?? 'info',
      duration: config.duration ?? this.config.defaultDuration,
      position: config.position ?? this.config.defaultPosition,
      action: config.action,
      onClose: config.onClose,
      closable: config.closable ?? true,
      createdAt: Date.now(),
      visible: true,
    };

    this.toasts.set(id, entry);
    this.notifyListeners();

    // 自动关闭
    if (entry.duration > 0) {
      entry.timer = setTimeout(() => this.dismiss(id), entry.duration);
    }

    return id;
  }

  // 便捷方法
  success(message: string, config?: Omit<ToastConfig, 'message' | 'type'>): string {
    return this.show({ message, type: 'success', ...config });
  }

  error(message: string, config?: Omit<ToastConfig, 'message' | 'type'>): string {
    return this.show({ message, type: 'error', ...config });
  }

  warning(message: string, config?: Omit<ToastConfig, 'message' | 'type'>): string {
    return this.show({ message, type: 'warning', ...config });
  }

  info(message: string, config?: Omit<ToastConfig, 'message' | 'type'>): string {
    return this.show({ message, type: 'info', ...config });
  }

  // 关闭指定消息
  dismiss(id: string): void {
    const entry = this.toasts.get(id);
    if (entry) {
      entry.visible = false;
      clearTimeout(entry.timer);
      entry.onClose?.();
      this.toasts.delete(id);
      this.notifyListeners();
    }
  }

  // 关闭所有
  dismissAll(): void {
    for (const [id] of this.toasts) {
      this.dismiss(id);
    }
  }

  // 更新消息
  update(id: string, updates: Partial<ToastConfig>): void {
    const entry = this.toasts.get(id);
    if (entry) {
      Object.assign(entry, updates);
      // 重置定时器
      if (updates.duration !== undefined) {
        clearTimeout(entry.timer);
        if (updates.duration > 0) {
          entry.timer = setTimeout(() => this.dismiss(id), updates.duration);
        }
      }
      this.notifyListeners();
    }
  }

  // 订阅变化
  subscribe(listener: (toasts: ToastEntry[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const toasts = [...this.toasts.values()];
    this.listeners.forEach(l => l(toasts));
  }

  // 获取指定位置的消息
  getByPosition(position: string): ToastEntry[] {
    return [...this.toasts.values()].filter(t => t.position === position);
  }
}

interface ToastEntry extends Required<Omit<ToastConfig, 'action' | 'onClose' | 'key'>> {
  id: string;
  action?: ToastConfig['action'];
  onClose?: () => void;
  createdAt: number;
  visible: boolean;
  timer?: ReturnType<typeof setTimeout>;
}
```

### 使用示例

```typescript
const toast = ToastManager.getInstance({ maxToasts: 4, defaultDuration: 4000 });

// 1. 基本用法
toast.success('保存成功');
toast.error('网络错误，请重试');
toast.warning('存储空间不足');
toast.info('新版本可用');

// 2. 带操作按钮（撤销删除）
toast.warning('邮件已删除', {
  duration: 5000,
  action: {
    label: '撤销',
    onClick: (id) => {
      restoreEmail();
      toast.dismiss(id);
    },
  },
});

// 3. 持久消息（手动关闭）
toast.error('服务器连接断开', {
  duration: 0,
  closable: true,
});

// 4. 去重（相同 key 只保留一条）
toast.show({ message: '加载中...', key: 'loading' });
// 稍后更新
toast.update('loading', { message: '加载完成 ✅' });
setTimeout(() => toast.dismiss('loading'), 2000);

// 5. 订阅变化（用于 UI 渲染）
toast.subscribe((toasts) => {
  renderToastContainer(toasts);
});
```

### 设计要点

| 考量 | 方案 |
|------|------|
| 队列管理 | Map 存储，超出 maxToasts 移除最旧 |
| 去重 | key 字段，相同 key 更新而非新增 |
| 生命周期 | duration 控制自动关闭，0 = 持久 |
| 操作按钮 | action 回调 + toastId，支持撤销等操作 |
| 订阅模式 | subscribe 通知 UI 层更新，解耦逻辑与渲染 |
| 便捷 API | success/error/warning/info 快捷方法 |

---

## 组件 5: Tabs — 标签页系统

### 设计目标

- 声明式标签定义
- 支持懒加载（切换到 tab 时才渲染内容）
- 支持可编辑标签（添加/删除/拖拽排序）
- 可组合：Tabs → Tab → TabPanel
- 支持受控/非受控模式

### API 设计

```typescript
interface TabItem {
  key: string;
  label: string | (() => any);
  disabled?: boolean;
  closable?: boolean;
  icon?: string;
  badge?: number | string;
  lazy?: boolean;          // 懒加载：首次激活时才渲染
  render: () => any;       // 内容渲染函数
  onBeforeClose?: () => boolean | Promise<boolean>;  // 关闭前确认
}

interface TabsConfig {
  tabs: TabItem[];
  activeKey?: string;       // 受控模式
  defaultActiveKey?: string; // 非受控模式默认值
  position?: 'top' | 'bottom' | 'left' | 'right';
  type?: 'line' | 'card' | 'editable-card';
  size?: 'small' | 'medium' | 'large';
  onChange?: (key: string) => void;
  onEdit?: (action: 'add' | 'remove', targetKey?: string) => void;
  hideAdd?: boolean;
  draggable?: boolean;
}
```

### 实现

```typescript
class Tabs {
  private config: TabsConfig;
  private activeKey: string;
  private controlled: boolean;
  private renderedKeys: Set<string> = new Set();  // 已渲染的 key（懒加载用）
  private tabOrder: string[];

  constructor(config: TabsConfig) {
    this.config = config;
    this.controlled = config.activeKey !== undefined;
    this.activeKey = this.controlled
      ? config.activeKey!
      : config.defaultActiveKey ?? config.tabs[0]?.key ?? '';
    this.tabOrder = config.tabs.map(t => t.key);
    // 非懒加载的 tab 预渲染
    config.tabs.forEach(t => {
      if (!t.lazy) this.renderedKeys.add(t.key);
    });
  }

  // 切换标签
  setActiveKey(key: string): void {
    const tab = this.config.tabs.find(t => t.key === key);
    if (!tab || tab.disabled) return;

    this.activeKey = key;
    this.renderedKeys.add(key);  // 标记为已渲染

    if (!this.controlled) {
      // 非受控模式，内部更新
    }

    this.config.onChange?.(key);
  }

  // 添加标签
  addTab(tab: Omit<TabItem, 'key'> & { key?: string }): string {
    const key = tab.key ?? `tab_${Date.now()}`;
    this.config.tabs.push({ ...tab, key } as TabItem);
    this.tabOrder.push(key);
    this.setActiveKey(key);
    this.config.onEdit?.('add', key);
    return key;
  }

  // 删除标签
  async removeTab(key: string): Promise<boolean> {
    const tab = this.config.tabs.find(t => t.key === key);
    if (!tab || tab.disabled || !tab.closable) return false;

    // 关闭前确认
    if (tab.onBeforeClose) {
      const allow = await Promise.resolve(tab.onBeforeClose());
      if (!allow) return false;
    }

    const index = this.config.tabs.findIndex(t => t.key === key);
    this.config.tabs.splice(index, 1);
    this.tabOrder = this.tabOrder.filter(k => k !== key);
    this.renderedKeys.delete(key);

    // 如果删除的是当前激活的，切换到相邻的
    if (this.activeKey === key) {
      const newIndex = Math.min(index, this.config.tabs.length - 1);
      if (newIndex >= 0) {
        this.setActiveKey(this.config.tabs[newIndex].key);
      }
    }

    this.config.onEdit?.('remove', key);
    return true;
  }

  // 获取状态
  getState(): TabsState {
    return {
      activeKey: this.activeKey,
      tabs: this.tabOrder.map(key => ({
        ...this.config.tabs.find(t => t.key === key)!,
        isActive: key === this.activeKey,
        isRendered: this.renderedKeys.has(key),  // 是否应该渲染（懒加载控制）
      })),
    };
  }

  // 更新配置
  updateConfig(updates: Partial<TabsConfig>): void {
    Object.assign(this.config, updates);
    if (updates.activeKey !== undefined && this.controlled) {
      this.activeKey = updates.activeKey!;
      this.renderedKeys.add(this.activeKey);
    }
  }

  // 拖拽排序
  reorderTab(fromKey: string, toKey: string): void {
    const fromIndex = this.tabOrder.indexOf(fromKey);
    const toIndex = this.tabOrder.indexOf(toKey);
    if (fromIndex === -1 || toIndex === -1) return;

    this.tabOrder.splice(fromIndex, 1);
    this.tabOrder.splice(toIndex, 0, fromKey);
  }
}

interface TabsState {
  activeKey: string;
  tabs: Array<TabItem & {
    isActive: boolean;
    isRendered: boolean;
  }>;
}
```

### 使用示例

```typescript
// 编辑器场景：多标签编辑器
const editorTabs = new Tabs({
  tabs: [
    {
      key: 'home',
      label: '🏠 首页',
      lazy: false,
      render: () => renderHomePage(),
    },
    {
      key: 'users',
      label: '👥 用户管理',
      closable: true,
      lazy: true,  // 懒加载：切换到时才渲染
      onBeforeClose: async () => {
        if (hasUnsavedChanges) {
          return await modal.confirm('有未保存的更改，确定关闭？');
        }
        return true;
      },
      render: () => renderUserManagement(),
    },
    {
      key: 'settings',
      label: '⚙️ 设置',
      badge: 3,  // 未读提示数
      lazy: true,
      render: () => renderSettings(),
    },
  ],
  defaultActiveKey: 'home',
  type: 'editable-card',
  draggable: true,
  onChange: (key) => console.log(`切换到: ${key}`),
  onEdit: (action, key) => {
    if (action === 'add') {
      editorTabs.addTab({
        label: '新标签页',
        closable: true,
        lazy: true,
        render: () => renderNewTab(),
      });
    }
  },
});

// 消费状态
const state = editorTabs.getState();
// state.tabs → 所有标签（含 isActive/isRendered）
// 只渲染 isRendered=true 的 tab 内容（懒加载）
```

### 设计要点

| 考量 | 方案 |
|------|------|
| 懒加载 | lazy + renderedKeys，首次激活才渲染内容 |
| 受控/非受控 | activeKey 存在=受控，defaultActiveKey=非受控 |
| 关闭前确认 | onBeforeClose 支持异步，返回 boolean |
| 拖拽排序 | tabOrder 独立数组，reorderTab 更新顺序 |
| 可编辑 | onEdit 回调处理 add/remove，hideAdd 控制新增按钮 |
| 状态暴露 | getState() 返回完整状态，UI 层自由消费 |

---

## 五个组件的共性设计模式总结

### 1. 逻辑与渲染分离

所有组件遵循同一模式：**核心类只管状态和逻辑，不直接操作 DOM**。

```
┌─────────────────────────────────┐
│  UI 层 (React/Vue/原生 DOM)      │
│  调用 getState() 获取状态         │
│  调用方法触发操作                 │
├─────────────────────────────────┤
│  组件核心类 (Form/DataTable/...)  │
│  管理状态、处理逻辑、触发回调      │
└─────────────────────────────────┘
```

### 2. 泛型贯穿

```typescript
class Form<T extends Record<string, any>>      // T = 表单值类型
class DataTable<T extends Record<string, any>> // T = 行数据类型
```

好处：完整的类型推断，IDE 自动补全字段名。

### 3. 配置对象模式

```typescript
new Form({ fields: {...}, onSubmit: ... })
new DataTable({ data: [...], columns: [...] })
new ModalManager().open({ title: ..., content: ... })
```

所有配置集中到一个对象，可选字段用 `?` 标注，默认值在构造函数中填充。

### 4. 句柄模式

```typescript
const handle = modal.open(config);
handle.close();
handle.update({ title: '新标题' });
await handle.promise;
```

open/create 返回句柄，通过句柄操作实例，而非暴露实例本身。

### 5. 订阅模式

```typescript
toast.subscribe(toasts => render(toasts));
form.onChange(values => syncWithBackend(values));
```

需要响应式更新的组件提供 subscribe 方法，UI 层订阅变化。

### 6. 管线模式

```
DataTable: rawData → filter → sort → paginate → result
Form: input → transform → validate → submit
```

数据处理遵循固定管线，每步可自定义覆盖。

### 7. 对比表

| 组件 | 核心职责 | 关键模式 | 扩展点 |
|------|---------|---------|--------|
| Form | 状态管理 + 验证 | 配置对象 + 管线 | 自定义验证器/转换器 |
| DataTable | 数据管线 + 选择 | 泛型 + 管线 | 自定义渲染/排序/过滤 |
| Modal | 层级管理 + 生命周期 | 单例 + 句柄 | 渲染函数 + 回调 |
| Toast | 队列 + 生命周期 | 单例 + 订阅 | 操作按钮 + 去重 |
| Tabs | 激活状态 + 懒加载 | 受控/非受控 | 关闭前确认 + 拖拽 |

---

## 训练总结

### 设计原则回顾

1. **单一职责**：每个组件只做一件事，状态管理 ≠ 渲染
2. **开闭原则**：对扩展开放（render/validator/sorter），对修改封闭
3. **依赖倒置**：UI 层依赖 getState() 接口，不依赖内部实现
4. **组合优于继承**：通过 render 函数组合内容，而非继承组件类
5. **类型安全**：泛型贯穿，配置对象强类型

### 可组合性 checklist

- [x] 组件是否暴露 getState() / 状态接口？
- [x] 内容渲染是否通过函数/插槽注入？
- [x] 是否支持自定义行为（验证器/排序器/渲染器）？
- [x] 是否提供回调钩子（onChange/onClose/onEdit）？
- [x] 是否支持受控和非受控两种模式？
- [x] 是否类型安全（泛型 + 类型推断）？

### 下一步可探索

- 组件间的通信机制（EventBus / Context）
- 服务端数据获取的集成（React Query / SWR 模式）
- 无障碍访问（ARIA 属性管理）
- 主题/样式系统（CSS-in-JS / Design Token）
- 测试策略（单元测试核心类 + 快照测试 UI 层）
