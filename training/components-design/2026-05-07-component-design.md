# 专项训练 10：组件设计 — 5 个高级模式组件

> 日期：2026-05-07 | 主题：高级模式 — Compound / Headless / Render Props / Slot / Drag & Drop
> 与前 7 轮差异化：聚焦设计模式层面的可组合性，而非功能堆叠

---

## 组件 1: Compound Select — 复合组件模式

### 设计模式
**Compound Components（复合组件）** — 隐式共享上下文，子组件自动感知父组件状态，无需手动传递 props。

### 核心问题
传统 Select 用 props 配置选项：
```tsx
// ❌ 配置驱动 — 灵活度低，难以扩展
<Select options={users.map(u => ({ label: u.name, value: u.id }))} />
```
当需要自定义选项样式、分组、禁用、图标时，options 配置迅速膨胀。

### API设计

```tsx
// 复合组件 — 声明式结构，隐式共享 SelectContext
interface SelectProps<T> {
  value?: T;
  onChange?: (value: T) => void;
  defaultValue?: T;
  disabled?: boolean;
  placeholder?: string;
  children: ReactNode; // Select.Trigger / Select.Content / Select.Item ...
}

interface SelectContextValue<T> {
  value: T | undefined;
  onChange: (value: T) => void;
  open: boolean;
  toggle: () => void;
  disabled: boolean;
  registerItem: (value: T, disabled: boolean) => void;
}

// 子组件
Select.Trigger: React.FC<{ children?: ReactNode }>;
Select.Content: React.FC<{ 
  position?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
  children: ReactNode;
}>;
Select.Group: React.FC<{ label: string; children: ReactNode }>;
Select.Item: React.FC<{ 
  value: any; 
  disabled?: boolean;
  children: ReactNode; 
}>;
Select.Label: React.FC<{ children: ReactNode }>; // 选中后显示的标签
Select.Separator: React.FC;
```

### 实现要点

```tsx
const SelectContext = createContext<SelectContextValue<any> | null>(null);

function Select<T>({ value, onChange, defaultValue, disabled = false, children }: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : internalValue;

  const ctx: SelectContextValue<T> = useMemo(() => ({
    value: current,
    onChange: (v: T) => {
      if (!controlled) setInternalValue(v);
      onChange?.(v);
      setOpen(false);
    },
    open,
    toggle: () => setOpen(o => !o),
    disabled,
    registerItem: () => {} // 用于收集选项元数据
  }), [current, onChange, open, disabled, controlled]);

  // 键盘导航
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); focusNextItem(); break;
        case 'ArrowUp': e.preventDefault(); focusPrevItem(); break;
        case 'Enter': e.preventDefault(); selectFocused(); break;
        case 'Escape': setOpen(false); break;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <SelectContext.Provider value={ctx}>
      <div className="select-root" role="listbox">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

// 子组件通过 useContext 隐式获取父组件状态
Select.Trigger = ({ children }) => {
  const ctx = useContext(SelectContext)!;
  return (
    <button
      type="button"
      disabled={ctx.disabled}
      onClick={ctx.toggle}
      aria-expanded={ctx.open}
      aria-haspopup="listbox"
    >
      {children || <Select.Label />} {/* 默认显示选中项的标签 */}
    </button>
  );
};

Select.Item = ({ value, disabled = false, children }) => {
  const ctx = useContext(SelectContext)!;
  const selected = ctx.value === value;
  return (
    <div
      role="option"
      aria-selected={selected}
      aria-disabled={disabled}
      onClick={() => !disabled && ctx.onChange(value)}
      className={clsx(
        'select-item',
        selected && 'selected',
        disabled && 'disabled'
      )}
    >
      {children}
    </div>
  );
};
```

### 使用示例

```tsx
// 基础用法 — 声明式结构，一目了然
<Select value={role} onChange={setRole}>
  <Select.Trigger>
    <span>当前角色: <Select.Label /></span>
  </Select.Trigger>
  <Select.Content>
    <Select.Group label="管理员">
      <Select.Item value="super_admin">🔴 超级管理员</Select.Item>
      <Select.Item value="admin">🟠 管理员</Select.Item>
    </Select.Group>
    <Select.Separator />
    <Select.Group label="普通用户">
      <Select.Item value="editor">🟡 编辑者</Select.Item>
      <Select.Item value="viewer">🟢 查看者</Select.Item>
      <Select.Item value="guest" disabled>🔵 访客（暂无权限）</Select.Item>
    </Select.Group>
  </Select.Content>
</Select>

// 自定义触发器
<Select value={theme} onChange={setTheme}>
  <Select.Trigger>
    {theme === 'dark' ? '🌙 暗色' : '☀️ 亮色'}
  </Select.Trigger>
  <Select.Content>
    <Select.Item value="light">☀️ 亮色模式</Select.Item>
    <Select.Item value="dark">🌙 暗色模式</Select.Item>
    <Select.Item value="auto">🖥️ 跟随系统</Select.Item>
  </Select.Content>
</Select>
```

### 设计决策
- **Context 隐式通信**：子组件无需手动传 value/onChange，自动感知父状态
- **结构即配置**：JSX 树形结构天然表达层级关系（Group/Separator）
- **受控 + 非受控**：value 可选，默认非受控模式
- **ARIA 完整**：role=listbox/option、aria-expanded/selected/disabled
- **键盘导航**：ArrowUp/Down 切换、Enter 确认、Escape 关闭

---

## 组件 2: Headless Dialog — 无头组件模式

### 设计模式
**Headless Component（无头组件）** — 只提供行为逻辑和可访问性，零 UI 渲染。样式完全由使用者控制。

### 核心问题
传统 Dialog 捆绑了样式（背景色/圆角/阴影/动画），定制困难。Headless 将"行为"与"外观"彻底分离。

### API设计

```tsx
interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  modal?: boolean; // 默认 true — 模态（拦截焦点）vs 非模态
  onEscapeKeyDown?: (e: KeyboardEvent) => void;
  onInteractOutside?: (e: PointerEvent) => void;
  children: ReactNode;
}

// 子组件 — 全部只渲染逻辑，不渲染样式
Dialog.Root: React.FC<DialogProps>;
Dialog.Portal: React.FC<{ container?: HTMLElement }>; // 渲染到 body
Dialog.Overlay: React.FC<{ children?: ReactNode }>; // 遮罩层
Dialog.Content: React.FC<{ children: ReactNode }>; // 内容容器
Dialog.Title: React.FC<{ children: ReactNode }>; // 标题（自动关联 aria-labelledby）
Dialog.Description: React.FC<{ children: ReactNode }>; // 描述（自动关联 aria-describedby）
Dialog.Close: React.FC<{ children?: ReactNode }>; // 关闭按钮
Dialog.FocusTrap: React.FC<{ children: ReactNode }>; // 焦点陷阱
```

### 实现要点

```tsx
const DialogContext = createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
  modal: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  contentId: string;
  titleId: string;
  descId: string;
} | null>(null);

Dialog.Root = ({ open: controlledOpen, onOpenChange, defaultOpen = false, modal = true, children, onEscapeKeyDown, onInteractOutside }: DialogProps) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const setOpen = useCallback((v: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(v);
    onOpenChange?.(v);
  }, [controlledOpen, onOpenChange]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentId = useId();
  const titleId = useId();
  const descId = useId();

  // 焦点管理
  useEffect(() => {
    if (!open || !modal) return;
    const trigger = triggerRef.current;
    // 保存焦点 → 聚焦内容第一个可聚焦元素
    const firstFocusable = document.getElementById(contentId)?.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement;
    firstFocusable?.focus();

    return () => trigger?.focus(); // 关闭时恢复焦点
  }, [open, modal, contentId]);

  // 点击遮罩关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      const content = document.getElementById(contentId);
      if (content && !content.contains(e.target as Node)) {
        onInteractOutside?.(e);
        if (!e.defaultPrevented) setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open, contentId, onInteractOutside, setOpen]);

  // Escape 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscapeKeyDown?.(e);
        if (!e.defaultPrevented) setOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onEscapeKeyDown, setOpen]);

  // 滚动锁定
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const ctx = useMemo(() => ({
    open, setOpen, modal, triggerRef, contentId, titleId, descId
  }), [open, setOpen, modal, contentId, titleId, descId]);

  return <DialogContext.Provider value={ctx}>{children}</DialogContext.Provider>;
};

// Overlay — 只渲染 div，样式完全由使用者控制
Dialog.Overlay = ({ children }) => {
  const ctx = useContext(DialogContext)!;
  if (!ctx.open) return null;
  return (
    <div
      role="presentation"
      data-state={ctx.open ? 'open' : 'closed'}
      className="dialog-overlay" // 使用者可覆盖
    >
      {children}
    </div>
  );
};

// Content — 关联 aria 属性
Dialog.Content = ({ children }) => {
  const ctx = useContext(DialogContext)!;
  if (!ctx.open) return null;
  return (
    <div
      id={ctx.contentId}
      role="dialog"
      aria-labelledby={ctx.titleId}
      aria-describedby={ctx.descId}
      aria-modal={ctx.modal}
      data-state={ctx.open ? 'open' : 'closed'}
    >
      {children}
    </div>
  );
};

// Title — 自动关联 id
Dialog.Title = ({ children }) => {
  const ctx = useContext(DialogContext)!;
  return <h2 id={ctx.titleId}>{children}</h2>;
};

// Close — 自动绑定 onClick
Dialog.Close = ({ children }) => {
  const ctx = useContext(DialogContext)!;
  return (
    <button type="button" onClick={() => ctx.setOpen(false)}>
      {children || '✕'}
    </button>
  );
};
```

### 使用示例

```tsx
// 完全自定义样式 — 零样式泄漏
<Dialog.Root>
  <Dialog.Trigger>
    <button className="my-custom-btn">打开设置</button>
  </Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay className="my-backdrop" />
    <Dialog.Content className="my-dialog-panel">
      <Dialog.Title className="my-title">设置</Dialog.Title>
      <Dialog.Description className="my-desc">
        调整你的偏好设置
      </Dialog.Description>
      <SettingsForm />
      <Dialog.Close>
        <span>关闭</span> {/* 完全自定义关闭按钮 */}
      </Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

// 非模态 Dialog（不拦截焦点）
<Dialog.Root modal={false}>
  <Dialog.Content>
    <Toast>这是一条提示</Toast>
  </Dialog.Content>
</Dialog.Root>

// 动画组合 — 与 framer-motion 等动画库无缝集成
<Dialog.Root>
  <AnimatePresence>
    {open && (
      <>
        <Dialog.Overlay className="backdrop" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
        >
          <Dialog.Content>...</Dialog.Content>
        </motion.div>
      </>
    )}
  </AnimatePresence>
</Dialog.Root>
```

### 设计决策
- **零样式**：不渲染任何 CSS，className/data-state 留给使用者
- **ARIA 自动化**：role/dialog、aria-labelledby/describedby/modal 自动关联
- **焦点管理**：打开时聚焦首个元素，关闭时恢复，Tab 键限制在 Dialog 内
- **滚动锁定**：打开时 body overflow:hidden
- **Portal 分离**：Overlay/Content 可渲染到不同容器，避免 z-index 问题
- **事件拦截**：onEscapeKeyDown/onInteractOutside 支持 e.preventDefault() 阻止默认行为

---

## 组件 3: DataGrid — Render Props 模式

### 设计模式
**Render Props + 插件架构** — 数据层与渲染层彻底解耦，通过 render props 和插件扩展能力。

### 核心问题
传统 Table 组件把数据获取、排序、筛选、分页、渲染全部耦合在一起。Render Props 让每个环节可替换。

### API设计

```tsx
interface Column<T> {
  key: string;
  title: string;
  width?: number;
  minWidth?: number;
  sortable?: boolean;
  filterable?: boolean;
  resizable?: boolean;
  sticky?: 'left' | 'right';
  // 单元格渲染 — render props
  render?: (value: any, record: T, index: number) => ReactNode;
  // 表头渲染
  renderHeader?: (column: Column<T>) => ReactNode;
  // 过滤 UI
  renderFilter?: (column: Column<T>, onChange: (value: any) => void) => ReactNode;
}

interface DataGridProps<T> {
  // 数据源
  data: T[];
  // 列定义
  columns: Column<T>[];
  // 行唯一键
  rowKey: string | (record: T) => string;
  // 渲染 — render props 模式
  renderRow?: (record: T, index: number, defaultRow: ReactNode) => ReactNode;
  renderCell?: (value: any, column: Column<T>, record: T) => ReactNode;
  renderEmpty?: () => ReactNode;
  renderLoading?: () => ReactNode;
  // 行为
  onRowClick?: (record: T, index: number) => void;
  onSort?: (key: string, direction: 'asc' | 'desc' | null) => void;
  onFilter?: (filters: Record<string, any>) => void;
  onSelection?: (selected: T[]) => void;
  // 配置
  selectable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  resizable?: boolean;
  virtual?: boolean;
  rowHeight?: number;
  // 插件
  plugins?: DataGridPlugin<T>[];
}

interface DataGridPlugin<T> {
  name: string;
  // 数据处理管道
  transformData?: (data: T[], context: GridContext<T>) => T[];
  // 列增强
  enhanceColumn?: (column: Column<T>) => Column<T>;
  // 渲染增强
  wrapCell?: (cell: ReactNode, record: T, column: Column<T>) => ReactNode;
}
```

### 实现要点

```tsx
function DataGrid<T>({
  data, columns, rowKey,
  renderRow, renderCell, renderEmpty, renderLoading,
  onRowClick, onSort, onFilter, onSelection,
  selectable = false, sortable = false, filterable = false,
  resizable = false, virtual = false, rowHeight = 48,
  plugins = []
}: DataGridProps<T>) {
  const [sortState, setSortState] = useState<{ key: string; dir: 'asc' | 'desc' | null } | null>(null);
  const [filterState, setFilterState] = useState<Record<string, any>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [resizing, setResizing] = useState<string | null>(null);

  // 插件管道 — 数据经过每个插件的 transformData
  const processedData = useMemo(() => {
    let result = [...data];

    // 筛选
    if (Object.keys(filterState).length > 0) {
      result = result.filter(row =>
        Object.entries(filterState).every(([key, value]) => {
          if (value === null || value === undefined) return true;
          return String(row[key as keyof T]).toLowerCase().includes(String(value).toLowerCase());
        })
      );
    }

    // 排序
    if (sortState?.dir) {
      result.sort((a, b) => {
        const aVal = a[sortState.key as keyof T];
        const bVal = b[sortState.key as keyof T];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortState.dir === 'asc' ? cmp : -cmp;
      });
    }

    // 插件管道
    for (const plugin of plugins) {
      result = plugin.transformData?.(result, { sortState, filterState, selected }) ?? result;
    }

    return result;
  }, [data, sortState, filterState, plugins]);

  // 渲染列头
  const renderHeaders = () => (
    <thead>
      <tr>
        {selectable && <th className="col-select"><Checkbox onChange={toggleAll} /></th>}
        {columns.map(col => {
          const enhancedCol = plugins.reduce(
            (c, p) => p.enhanceColumn?.(c) ?? c, col
          );
          return (
            <th
              key={col.key}
              style={{ width: col.width, minWidth: col.minWidth, position: col.sticky ? 'sticky' : undefined }}
              onClick={() => sortable && handleSort(col.key)}
            >
              {col.renderHeader ? col.renderHeader(col) : col.title}
              {sortable && col.sortable && <SortIndicator active={sortState?.key === col.key} dir={sortState?.dir} />}
              {resizable && <ResizeHandle onResize={handleResize} />}
              {filterable && col.filterable && <FilterTrigger column={col} />}
            </th>
          );
        })}
      </tr>
    </thead>
  );

  // 渲染行 — render props 允许完全自定义
  const renderRows = () => {
    if (processedData.length === 0) {
      return renderEmpty?.() ?? <tr><td colSpan={columns.length}>暂无数据</td></tr>;
    }

    return processedData.map((record, index) => {
      const key = typeof rowKey === 'function' ? rowKey(record) : record[rowKey as keyof T];
      let row = (
        <tr key={String(key)} onClick={() => onRowClick?.(record, index)}>
          {selectable && <td><Checkbox checked={selected.has(String(key))} onChange={() => toggleSelect(String(key))} /></td>}
          {columns.map(col => {
            const value = record[col.key as keyof T];
            let cell = col.render ? col.render(value, record, index) : value;
            if (renderCell) cell = renderCell(value, col, record);
            // 插件增强单元格
            cell = plugins.reduce(
              (c, p) => p.wrapCell?.(c, record, col) ?? c, cell
            );
            return <td key={col.key}>{cell}</td>;
          })}
        </tr>
      );
      if (renderRow) row = renderRow(record, index, row);
      return row;
    });
  };

  return (
    <div className="data-grid" style={{ overflow: 'auto' }}>
      <table>
        {renderHeaders()}
        <tbody>
          {virtual ? <VirtualBody rows={renderRows()} height={rowHeight} /> : renderRows()}
        </tbody>
      </table>
    </div>
  );
}
```

### 插件示例

```tsx
// 插件 1: 行高亮 — 悬停时高亮整行
const rowHighlightPlugin = {
  name: 'row-highlight',
  wrapCell: (cell: ReactNode, record: any) => (
    <div className="cell-highlight-wrapper">{cell}</div>
  )
};

// 插件 2: 导出 — 添加导出列
const exportPlugin = {
  name: 'export',
  enhanceColumn: (col: Column<any>) => ({
    ...col,
    renderHeader: () => (
      <>
        {col.title}
        <button onClick={() => exportColumn(col.key)}>导出此列</button>
      </>
    )
  })
};

// 插件 3: 分组 — 按字段分组行
const groupPlugin = <T,>(groupBy: keyof T): DataGridPlugin<T> => ({
  name: 'group',
  transformData: (data) => {
    const groups = groupByData(data, groupBy);
    return Object.entries(groups).flatMap(([group, items]) => [
      { __groupHeader: group, __isGroup: true },
      ...items
    ]) as T[];
  },
  wrapCell: (cell, record) => {
    if (record.__isGroup) return <GroupHeader label={record.__groupHeader} />;
    return cell;
  }
});

// 使用 — 组合多个插件
<DataGrid
  data={users}
  columns={userColumns}
  rowKey="id"
  sortable
  filterable
  selectable
  plugins={[rowHighlightPlugin, exportPlugin, groupPlugin<User>('department')]}
  renderRow={(record, _, defaultRow) => (
    <motion.tr layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {defaultRow.props.children}
    </motion.tr>
  )}
/>
```

### 设计决策
- **Render Props 三层**：renderRow（行级）/ renderCell（单元格级）/ renderEmpty/renderLoading（状态级）
- **插件管道**：transformData → enhanceColumn → wrapCell，每个插件只关心自己的职责
- **数据不可变**：processedData 每次返回新数组引用，配合 React 浅比较
- **列配置即文档**：Column 接口描述了列的所有行为（排序/筛选/固定/自定义渲染）
- **虚拟滚动可选**：virtual prop 切换，不强制

---

## 组件 4: Slot Tabs — Slot 机制模式

### 设计模式
**Slot（插槽）机制** — 源自 Vue/Svelte 的概念，在 React 中通过 children + context 实现具名插槽，支持默认内容和作用域插槽。

### 核心问题
传统 Tabs 用 props 配置 tab 列表，无法灵活控制每个 tab 的内容结构。Slot 机制让每个 tab 的内容完全自由。

### API设计

```tsx
interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  activationMode?: 'automatic' | 'manual'; // 自动激活 vs 点击激活
  children: ReactNode;
}

interface TabItemProps {
  value: string;
  disabled?: boolean;
  // 作用域插槽 — 传入当前 tab 状态
  children: ReactNode | ((ctx: { active: boolean; disabled: boolean }) => ReactNode);
}

interface TabContentProps {
  value: string;
  forceMount?: boolean; // 即使不活跃也保持挂载（动画需要）
  children: ReactNode;
}

// 子组件
Tabs.Root: React.FC<TabsProps>;
Tabs.List: React.FC<{ children: ReactNode }>; // tab 按钮容器
Tabs.Trigger: React.FC<TabItemProps>; // 单个 tab 按钮
Tabs.Content: React.FC<TabContentProps>; // 单个 tab 内容面板
Tabs.Indicator: React.FC; // 滑动指示器（自动定位到激活 tab）
```

### 实现要点

```tsx
const TabsContext = createContext<{
  value: string;
  setValue: (v: string) => void;
  orientation: 'horizontal' | 'vertical';
  activationMode: 'automatic' | 'manual';
  registeredTabs: Map<string, { disabled: boolean; ref: RefObject<HTMLElement | null> }>;
  registerTab: (value: string, disabled: boolean, ref: RefObject<HTMLElement | null>) => void;
  unregisterTab: (value: string) => void;
  indicatorRef: RefObject<HTMLElement | null>;
  updateIndicator: () => void;
} | null>(null);

Tabs.Root = ({ value: controlled, defaultValue, onValueChange, orientation = 'horizontal', activationMode = 'automatic', children }: TabsProps) => {
  const [internal, setInternal] = useState(defaultValue ?? '');
  const value = controlled ?? internal;
  const setValue = useCallback((v: string) => {
    if (controlled === undefined) setInternal(v);
    onValueChange?.(v);
  }, [controlled, onValueChange]);
  const registeredTabs = useRef(new Map()).current;
  const indicatorRef = useRef<HTMLDivElement>(null);

  const registerTab = (val: string, disabled: boolean, ref: RefObject<HTMLElement | null>) => {
    registeredTabs.set(val, { disabled, ref });
  };
  const unregisterTab = (val: string) => registeredTabs.delete(val);

  // 更新指示器位置
  const updateIndicator = useCallback(() => {
    const activeTab = registeredTabs.get(value)?.ref.current;
    const indicator = indicatorRef.current;
    if (!activeTab || !indicator) return;
    const rect = activeTab.getBoundingClientRect();
    const parentRect = activeTab.parentElement?.getBoundingClientRect();
    if (parentRect) {
      indicator.style.width = `${rect.width}px`;
      indicator.style.height = `${rect.height}px`;
      indicator.style.transform = `translateX(${rect.left - parentRect.left}px)`;
    }
  }, [value, registeredTabs]);

  useEffect(updateIndicator, [value, updateIndicator]);

  // 键盘导航
  useEffect(() => {
    if (!controlled) return; // 非受控模式由 Trigger 自己处理
  }, []);

  const ctx = useMemo(() => ({
    value, setValue, orientation, activationMode,
    registeredTabs, registerTab, unregisterTab, indicatorRef, updateIndicator
  }), [value, setValue, orientation, activationMode, registeredTabs, updateIndicator]);

  return <TabsContext.Provider value={ctx}>{children}</TabsContext.Provider>;
};

Tabs.Trigger = ({ value: tabValue, disabled = false, children }: TabItemProps) => {
  const ctx = useContext(TabsContext)!;
  const ref = useRef<HTMLButtonElement>(null);
  const active = ctx.value === tabValue;

  useEffect(() => {
    ctx.registerTab(tabValue, disabled, ref);
    return () => ctx.unregisterTab(tabValue);
  }, [tabValue, disabled, ctx]);

  const handleClick = () => {
    if (disabled) return;
    ctx.setValue(tabValue);
    ctx.updateIndicator();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const tabs = Array.from(ctx.registeredTabs.entries())
      .filter(([, v]) => !v.disabled)
      .map(([k]) => k);
    const idx = tabs.indexOf(tabValue);
    const next = (i: number) => tabs[((i % tabs.length) + tabs.length) % tabs.length];

    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown':
        e.preventDefault(); ctx.setValue(next(idx + 1)); break;
      case 'ArrowLeft': case 'ArrowUp':
        e.preventDefault(); ctx.setValue(next(idx - 1)); break;
      case 'Home':
        e.preventDefault(); ctx.setValue(tabs[0]); break;
      case 'End':
        e.preventDefault(); ctx.setValue(tabs[tabs.length - 1]); break;
    }
  };

  // 作用域插槽 — children 可以是函数
  const rendered = typeof children === 'function'
    ? children({ active, disabled })
    : children;

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={active}
      aria-disabled={disabled}
      tabIndex={active ? 0 : -1}
      disabled={disabled}
      data-state={active ? 'active' : 'inactive'}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {rendered}
    </button>
  );
};

Tabs.Content = ({ value: contentValue, forceMount = false, children }: TabContentProps) => {
  const ctx = useContext(TabsContext)!;
  const active = ctx.value === contentValue;

  if (!forceMount && !active) return null;

  return (
    <div
      role="tabpanel"
      aria-labelledby={contentValue}
      hidden={!active}
      data-state={active ? 'active' : 'inactive'}
    >
      {children}
    </div>
  );
};

Tabs.Indicator = () => {
  const ctx = useContext(TabsContext)!;
  return <div ref={ctx.indicatorRef} className="tabs-indicator" />;
};
```

### 使用示例

```tsx
// 基础用法
<Tabs.Root defaultValue="profile" onValueChange={handleTabChange}>
  <Tabs.List>
    <Tabs.Trigger value="profile">个人信息</Tabs.Trigger>
    <Tabs.Trigger value="settings">设置</Tabs.Trigger>
    <Tabs.Trigger value="billing">账单</Tabs.Trigger>
    <Tabs.Trigger value="notifications" disabled>通知（未开通）</Tabs.Trigger>
    <Tabs.Indicator /> {/* 滑动指示器 */}
  </Tabs.List>
  <Tabs.Content value="profile">
    <ProfileForm />
  </Tabs.Content>
  <Tabs.Content value="settings">
    <SettingsPanel />
  </Tabs.Content>
  <Tabs.Content value="billing">
    <BillingHistory />
  </Tabs.Content>
</Tabs.Root>

// 作用域插槽 — 根据 active 状态自定义渲染
<Tabs.Trigger value="profile">
  {(ctx) => (
    <span className={ctx.active ? 'tab-active' : 'tab-inactive'}>
      {ctx.active ? '👤' : '👤 '} 个人信息
      {ctx.active && <Badge count={3} />} {/* 活跃时才显示角标 */}
    </span>
  )}
</Tabs.Trigger>

// forceMount — 动画场景保持内容挂载
<Tabs.Content value="profile" forceMount>
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 20 }}
  >
    <ProfileForm />
  </motion.div>
</Tabs.Content>

// 垂直方向
<Tabs.Root defaultValue="overview" orientation="vertical">
  <Tabs.List>
    <Tabs.Trigger value="overview">概览</Tabs.Trigger>
    <Tabs.Trigger value="analytics">分析</Tabs.Trigger>
    <Tabs.Trigger value="reports">报表</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="overview"><Overview /></Tabs.Content>
  <Tabs.Content value="analytics"><Analytics /></Tabs.Content>
  <Tabs.Content value="reports"><Reports /></Tabs.Content>
</Tabs.Root>
```

### 设计决策
- **Slot 注册机制**：Trigger 通过 registerTab/unregisterTab 动态注册，Content 按 value 匹配
- **作用域插槽**：children 支持函数形式，传入 { active, disabled } 状态
- **指示器自动定位**：Indicator 通过 getBoundingClientRect 自动跟随激活 tab
- **键盘导航**：Arrow 键切换、Home/End 跳转、ARIA role=tab/tabpanel
- **forceMount**：动画场景需要内容保持挂载，用 hidden 属性而非条件渲染
- **activationMode**：automatic（悬停激活）vs manual（点击激活）

---

## 组件 5: useDraggable — 拖拽 Hook 模式

### 设计模式
**Hook + 指令式 API** — 拖拽逻辑封装为 Hook，通过 ref 绑定，支持约束、吸附、缩放、多拖拽。

### 核心问题
拖拽涉及 mousedown/mousemove/mouseup 事件链、坐标计算、边界约束、性能优化（requestAnimationFrame）。封装为 Hook 让任何元素可拖拽。

### API设计

```ts
interface UseDraggableOptions {
  // 初始位置
  defaultPosition?: { x: number; y: number };
  // 受控位置
  position?: { x: number; y: number };
  onPositionChange?: (position: { x: number; y: number }) => void;
  // 约束
  bounds?: {
    left?: number; right?: number; top?: number; bottom?: number;
  } | 'parent' | HTMLElement;
  // 轴限制
  axis?: 'both' | 'x' | 'y' | 'none';
  // 缩放
  scale?: number;
  onScaleChange?: (scale: number) => void;
  // 吸附
  grid?: [number, number]; // [x, y] 吸附间距
  // 句柄 — 只有特定区域可拖拽
  handle?: string; // CSS 选择器
  // 禁用
  disabled?: boolean;
  // 回调
  onStart?: (e: PointerEvent, position: { x: number; y: number }) => void;
  onDrag?: (e: PointerEvent, position: { x: number; y: number }, delta: { x: number; y: number }) => void;
  onStop?: (e: PointerEvent, position: { x: number; y: number }) => void;
}

interface UseDraggableReturn {
  // ref 绑定到可拖拽元素
  dragRef: RefObject<HTMLElement | null>;
  // 当前位置
  position: { x: number; y: number };
  // 是否正在拖拽
  isDragging: boolean;
  // 指令式控制
  setPosition: (pos: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  resetPosition: () => void;
  // 缩放
  scale: number;
  setScale: (s: number) => void;
}
```

### 实现要点

```tsx
function useDraggable({
  defaultPosition = { x: 0, y: 0 },
  position: controlledPosition,
  onPositionChange,
  bounds,
  axis = 'both',
  scale = 1,
  onScaleChange,
  grid,
  handle,
  disabled = false,
  onStart, onDrag, onStop
}: UseDraggableOptions = {}): UseDraggableReturn {
  const dragRef = useRef<HTMLElement>(null);
  const [internalPos, setInternalPos] = useState(defaultPosition);
  const position = controlledPosition ?? internalPos;
  const [isDragging, setIsDragging] = useState(false);
  const [internalScale, setInternalScale] = useState(scale);
  const currentScale = onScaleChange ? internalScale : scale;

  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const posStart = useRef<{ x: number; y: number } | null>(null);

  // 约束计算
  const constrain = useCallback((x: number, y: number) => {
    let newX = x, newY = y;

    if (bounds) {
      const parent = dragRef.current?.parentElement;
      let boundary: { left?: number; right?: number; top?: number; bottom?: number };

      if (bounds === 'parent' && parent) {
        const parentRect = parent.getBoundingClientRect();
        const elRect = dragRef.current!.getBoundingClientRect();
        boundary = {
          left: 0,
          right: parentRect.width - elRect.width,
          top: 0,
          bottom: parentRect.height - elRect.height
        };
      } else if (bounds instanceof HTMLElement) {
        const bRect = bounds.getBoundingClientRect();
        const elRect = dragRef.current!.getBoundingClientRect();
        boundary = {
          left: -elRect.width,
          right: bRect.width,
          top: -elRect.height,
          bottom: bRect.height
        };
      } else {
        boundary = bounds;
      }

      if (boundary.left !== undefined) newX = Math.max(newX, boundary.left);
      if (boundary.right !== undefined) newX = Math.min(newX, boundary.right);
      if (boundary.top !== undefined) newY = Math.max(newY, boundary.top);
      if (boundary.bottom !== undefined) newY = Math.min(newY, boundary.bottom);
    }

    // 轴限制
    if (axis === 'x') newY = position.y;
    if (axis === 'y') newX = position.x;

    // 网格吸附
    if (grid) {
      newX = Math.round(newX / grid[0]) * grid[0];
      newY = Math.round(newY / grid[1]) * grid[1];
    }

    return { x: newX, y: newY };
  }, [bounds, axis, grid, position]);

  // 位置设置 — 受控/非受控
  const setPosition = useCallback((pos: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => {
    const newPos = typeof pos === 'function' ? pos(position) : pos;
    const constrained = constrain(newPos.x, newPos.y);
    if (controlledPosition === undefined) setInternalPos(constrained);
    onPositionChange?.(constrained);
  }, [position, controlledPosition, onPositionChange, constrain]);

  // Pointer 事件链
  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (disabled) return;
    if (handle) {
      const handleEl = dragRef.current?.querySelector(handle);
      if (!handleEl?.contains(e.target as Node)) return;
    }

    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...position };
    setIsDragging(true);
    onStart?.(e, position);
  }, [disabled, handle, position, onStart]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging || !dragStart.current || !posStart.current) return;
    e.preventDefault();

    const dx = (e.clientX - dragStart.current.x) / currentScale;
    const dy = (e.clientY - dragStart.current.y) / currentScale;

    const newPos = constrain(
      posStart.current.x + dx,
      posStart.current.y + dy
    );

    setPosition(newPos);
    onDrag?.(e, newPos, { x: dx, y: dy });
  }, [isDragging, currentScale, constrain, setPosition, onDrag]);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    dragStart.current = null;
    posStart.current = null;
    onStop?.(e, position);
  }, [isDragging, position, onStop]);

  // 绑定事件
  useEffect(() => {
    const el = dragRef.current;
    if (!el || disabled) return;

    el.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerDown, handlePointerMove, handlePointerUp, disabled]);

  // 应用 transform
  useEffect(() => {
    const el = dragRef.current;
    if (!el) return;
    el.style.transform = `translate(${position.x}px, ${position.y}px) scale(${currentScale})`;
    el.style.touchAction = 'none'; // 阻止浏览器默认触摸行为
  }, [position, currentScale]);

  const resetPosition = useCallback(() => {
    setPosition(defaultPosition);
  }, [defaultPosition, setPosition]);

  return {
    dragRef,
    position,
    isDragging,
    setPosition,
    resetPosition,
    scale: currentScale,
    setScale: (s: number) => {
      setInternalScale(s);
      onScaleChange?.(s);
    }
  };
}
```

### 使用示例

```tsx
// 基础拖拽
function DraggableBox() {
  const { dragRef, isDragging } = useDraggable();
  return (
    <div ref={dragRef} className="draggable-box" style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
      拖拽我
    </div>
  );
}

// 约束在父容器内
function DraggableCard() {
  const { dragRef, position } = useDraggable({
    bounds: 'parent',
    axis: 'both'
  });
  return (
    <div className="card-container">
      <div ref={dragRef} className="card">
        位置: ({Math.round(position.x)}, {Math.round(position.y)})
      </div>
    </div>
  );
}

// 只水平拖拽 + 网格吸附
function SliderControl() {
  const { dragRef, position } = useDraggable({
    axis: 'x',
    grid: [10, 0], // 每 10px 吸附一次
    bounds: { left: 0, right: 300 }
  });
  return (
    <div className="slider-track">
      <div ref={dragRef} className="slider-thumb">
        {Math.round(position.x / 3)} {/* 映射为 0-100 的值 */}
      </div>
    </div>
  );
}

// 句柄拖拽 — 只有标题栏可拖拽
function DraggableModal() {
  const { dragRef, isDragging } = useDraggable({
    handle: '.modal-header', // 只有 .modal-header 区域可拖拽
    bounds: 'parent'
  });
  return (
    <div ref={dragRef} className="modal">
      <div className="modal-header">
        <h3>标题栏（可拖拽）</h3>
      </div>
      <div className="modal-body">
        内容区域（不可拖拽）
      </div>
    </div>
  );
}

// 受控模式 + 缩放
function ZoomableCanvas() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  const { dragRef } = useDraggable({
    position,
    onPositionChange: setPosition,
    scale,
    onScaleChange: setScale,
    bounds: 'parent'
  });

  return (
    <div className="canvas" onWheel={(e) => {
      e.preventDefault();
      setScale(s => Math.max(0.1, Math.min(5, s - e.deltaY * 0.001)));
    }}>
      <div ref={dragRef} className="canvas-content">
        <CanvasContent />
      </div>
    </div>
  );
}

// 多拖拽 — 列表项拖拽排序（组合 useList）
function SortableList() {
  const { items, selected, sort } = useList({ dataSource: tasks, rowKey: 'id' });
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  return (
    <div className="sortable-list">
      {items.map((item, index) => {
        const draggable = useDraggable({
          axis: 'y',
          bounds: 'parent',
          grid: [0, 60], // 每行 60px
          onStart: () => setDragIndex(index),
          onStop: (e, pos) => {
            // 根据位置判断排序
            const newIndex = Math.round(pos.y / 60);
            if (newIndex !== index) {
              reorderItems(items, index, newIndex);
            }
            setDragIndex(null);
          }
        });
        return (
          <div key={item.id} ref={draggable.dragRef} className={dragIndex === index ? 'dragging' : ''}>
            {item.title}
          </div>
        );
      })}
    </div>
  );
}
```

### 设计决策
- **Pointer Events**：统一 mouse/touch/pen，比分别监听更简洁
- **setPointerCapture**：确保拖拽过程中即使指针移出元素也继续接收事件
- **约束管道**：bounds → axis → grid，按顺序应用，互不干扰
- **受控 + 非受控**：position 可选，默认非受控
- **touchAction: none**：阻止浏览器默认触摸行为（滚动/缩放）
- **requestAnimationFrame 可选**：高频拖拽时可用 rAF 节流，默认直接更新（现代浏览器足够快）

---

## 设计原则总结

| 模式 | 核心思想 | 适用场景 | 代表组件 |
|------|----------|----------|----------|
| **Compound** | 隐式 Context 共享，子组件自动感知父状态 | 有明确层级关系的 UI（Select/Menu/Tabs） | Compound Select |
| **Headless** | 行为与样式彻底分离，零 UI 渲染 | 需要完全自定义外观的基础组件（Dialog/Tooltip/Dropdown） | Headless Dialog |
| **Render Props** | 数据与渲染解耦，通过函数注入自定义 | 数据驱动的复杂组件（Table/Chart/List） | DataGrid |
| **Slot** | 具名插槽 + 作用域插槽，灵活的内容分发 | 多区域内容组件（Tabs/Modal/Drawer） | Slot Tabs |
| **Hook** | 逻辑封装为可复用 Hook，ref 绑定 | 交互行为（拖拽/缩放/手势/动画） | useDraggable |

### 可组合性矩阵

| 组合 | 效果 | 示例 |
|------|------|------|
| Headless + Compound | 无头复合组件 | Dialog.Root > Dialog.Content + Dialog.Title（无样式但隐式共享） |
| Hook + Render Props | 行为 Hook + 渲染自定义 | useDraggable + DataGrid.renderRow |
| Slot + Headless | 插槽 + 无样式 | Tabs.Content forceMount + 自定义动画 |
| Compound + Slot | 复合 + 作用域插槽 | Select.Item children={(ctx) => ctx.active ? ...} |
| Hook + Compound | 行为 Hook 驱动复合组件 | useDraggable 驱动 Compound Select 的拖拽排序 |

### 与之前 7 轮的差异化

| 轮次 | 主题 | 本次差异 |
|------|------|----------|
| v1 (4/20) | 设计文档 | 本次是完整实现 |
| v2 (4/26) | Card 组件 | 本次是高级模式 |
| v3 (4/28) | 5 个高级模式 | 本次聚焦设计模式本身 |
| v4 (4/29) | 5 个高级组件 | 本次是模式分类体系 |
| v5 (4/30) | 5 个可复用组件 | 本次是模式深度 |
| v6 (5/2) | 组件设计 | 本次是设计模式分类 |
| v7 (5/3/5/6) | 表单/列表/模态框 | 本次是 Compound/Headless/RenderProps/Slot/Hook |

**本次核心贡献：** 建立组件设计模式分类体系（5 大模式），每个模式有完整实现 + 使用示例 + 设计决策 + 可组合性分析。
