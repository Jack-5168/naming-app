# 专项训练：组件设计

> 设计 5 个可复用组件：表单/列表/模态框等
> 日期：2026-05-09
> 核心考量：API 设计、可组合性、类型安全

---

## 1. useForm — 表单状态管理 Hook

### 设计目标

统一管理表单字段的值、校验、错误状态，支持嵌套字段、异步校验、提交生命周期。

### API 设计

```ts
interface UseFormOptions<T extends Record<string, any>> {
  /** 初始值 */
  defaultValues: T;
  /** 校验规则，支持同步和异步 */
  validate?: (values: T) => Promise<Partial<Record<keyof T, string>>>;
  /** 字段级校验，key 为字段路径 */
  fieldValidators?: Partial<Record<keyof T, (value: any) => string | null>>;
  /** 提交回调 */
  onSubmit?: (values: T) => Promise<void> | void;
  /** 校验触发模式 */
  mode?: "onSubmit" | "onChange" | "onBlur" | "all";
}

interface FieldState {
  value: any;
  error: string | null;
  isDirty: boolean;
  isTouched: boolean;
}

interface UseFormReturn<T> {
  /** 表单值 */
  values: T;
  /** 字段状态 map，支持嵌套路径如 'user.name' */
  fields: Record<string, FieldState>;
  /** 整体错误 */
  formError: string | null;
  /** 是否正在提交 */
  isSubmitting: boolean;
  /** 是否已修改 */
  isDirty: boolean;
  /** 是否全部校验通过 */
  isValid: boolean;

  /** 注册字段 */
  register: (
    name: string,
    options?: { validate?: FieldValidator },
  ) => {
    value: any;
    onChange: (value: any) => void;
    onBlur: () => void;
    error: string | null;
  };
  /** 设置值 */
  setValue: (
    name: string,
    value: any,
    options?: { shouldValidate?: boolean },
  ) => void;
  /** 获取值 */
  getValue: (name: string) => any;
  /** 触发校验 */
  triggerValidate: (names?: string[]) => Promise<boolean>;
  /** 重置表单 */
  reset: (values?: Partial<T>) => void;
  /** 提交处理 */
  handleSubmit: (
    onValid: SubmitHandler<T>,
    onInvalid?: ErrorHandler,
  ) => (e?: any) => void;
  /** 手动设置错误 */
  setError: (name: string, error: string) => void;
  /** 清除错误 */
  clearError: (name: string) => void;
}
```

### 可组合性设计

```tsx
// 组合示例 1：嵌套表单
const UserForm = () => {
  const { register, handleSubmit } = useForm<UserFormValues>({
    defaultValues: { profile: { name: "", email: "" }, role: "user" },
    mode: "onBlur",
    validate: async (values) => {
      /* 整体校验 */
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input {...register("profile.name")} label="姓名" />
      <Input {...register("profile.email")} label="邮箱" />
      <Select {...register("role")} options={roles} label="角色" />
      <SubmitButton />
    </form>
  );
};

// 组合示例 2：动态字段数组
const TeamForm = () => {
  const { register, handleSubmit } = useForm<TeamFormValues>({
    defaultValues: { members: [{ name: "", role: "" }] },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FieldArray
        name="members"
        render={(field, index) => (
          <div key={index}>
            <Input {...register(`members.${index}.name`)} />
            <Input {...register(`members.${index}.role`)} />
          </div>
        )}
      />
    </form>
  );
};

// 组合示例 3：与 UI 组件解耦
// useForm 不依赖任何 UI 库，可与任意 Input/Select 组件配合
const CustomForm = () => {
  const { register } = useForm({ defaultValues: { search: "" } });
  const field = register("search");

  // 可搭配任意 UI 组件
  return <AntdInput value={field.value} onChange={field.onChange} />;
};
```

### 关键设计决策

- **路径式字段访问**：用 `'user.profile.name'` 字符串路径而非嵌套对象，降低复杂度
- **校验分层**：字段级校验（即时反馈）+ 表单级校验（跨字段依赖）
- **mode 控制**：默认 `onSubmit` 性能最优，`onBlur` 体验最佳，按需选择
- **受控但不强制**：`register` 返回标准 props 对象，也可用 `setValue/getValue` 手动控制

---

## 2. VirtualList — 虚拟列表组件

### 设计目标

高效渲染大量列表数据，仅渲染可视区域 DOM，支持动态高度、固定/可变高度、滚动定位。

### API 设计

```ts
interface VirtualListProps<T> {
  /** 数据源 */
  items: T[];
  /** 渲染函数 */
  renderItem: (item: T, index: number) => ReactNode;
  /** 唯一 key 提取 */
  keyExtractor: (item: T, index: number) => string | number;

  /** 容器高度 */
  height: number;
  /** 行高：固定值 或 动态函数 */
  itemHeight: number | ((item: T, index: number) => number);
  /** 额外渲染缓冲区行数（默认 5） */
  overscanCount?: number;

  /** 滚动容器引用（默认 window） */
  scrollContainer?: HTMLElement | null;
  /** 滚动回调 */
  onScroll?: (offset: number) => void;
  /** 滚动到底部回调 */
  onReachEnd?: () => void;
  /** 距离底部多少像素触发 onReachEnd */
  onReachEndThreshold?: number;

  /** 空状态 */
  empty?: ReactNode;
  /** 加载状态 */
  loading?: boolean;
  loader?: ReactNode;

  /** 方向 */
  direction?: "vertical" | "horizontal";
  /** className */
  className?: string;
  /** 容器样式 */
  style?: CSSProperties;
}
```

### 可组合性设计

```tsx
// 组合示例 1：固定高度 + 无限滚动
const MessageList = ({ messages }: { messages: Message[] }) => (
  <VirtualList
    items={messages}
    height={600}
    itemHeight={48}
    keyExtractor={(m) => m.id}
    renderItem={(msg) => <MessageBubble {...msg} />}
    onReachEnd={loadMore}
    onReachEndThreshold={100}
    empty={<EmptyState text="暂无消息" />}
    loading={isLoading}
  />
);

// 组合示例 2：动态高度（如聊天气泡高度不一）
const ChatList = ({ messages }: { messages: ChatMessage[] }) => (
  <VirtualList
    items={messages}
    height="100%"
    itemHeight={(msg) => (msg.type === "image" ? 200 : 48)}
    keyExtractor={(m) => m.id}
    renderItem={(msg) => <ChatItem {...msg} />}
    overscanCount={8}
    onScroll={(offset) => trackScrollPosition(offset)}
  />
);

// 组合示例 3：与排序/过滤组合
const FilterableList = ({ items }: { items: User[] }) => {
  const [filter, setFilter] = useState("");
  const filtered = items.filter((u) => u.name.includes(filter));
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => a.name.localeCompare(b.name)),
    [filtered],
  );

  return (
    <>
      <SearchInput value={filter} onChange={setFilter} />
      <VirtualList
        items={sorted}
        height={400}
        itemHeight={56}
        keyExtractor={(u) => u.id}
        renderItem={(user) => <UserCard {...user} />}
      />
    </>
  );
};

// 组合示例 4：水平虚拟列表（图片画廊）
const ImageGallery = ({ images }: { images: Image[] }) => (
  <VirtualList
    items={images}
    height={300}
    itemHeight={200}
    direction="horizontal"
    keyExtractor={(img) => img.id}
    renderItem={(img) => <Thumbnail src={img.url} alt={img.title} />}
  />
);
```

### 关键设计决策

- **itemHeight 双模式**：固定高度用数学计算 O(1)，动态高度用测量缓存，兼顾性能和灵活性
- **overscanCount**：预渲染缓冲区，避免快速滚动时出现白屏，默认 5 行平衡性能与内存
- **onReachEnd**：内置无限滚动支持，无需额外包装组件
- **方向抽象**：vertical/horizontal 共享核心逻辑，仅滚动轴不同

---

## 3. Modal — 模态框组件

### 设计目标

支持声明式和命令式两种调用方式，支持嵌套、拖拽、全屏、键盘导航、焦点管理。

### API 设计

```ts
// 声明式 API
interface ModalProps {
  /** 是否可见 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 标题 */
  title?: ReactNode;
  /** 页脚 */
  footer?: ReactNode | false;
  /** 宽度 */
  width?: number | string;
  /** 是否可拖拽 */
  draggable?: boolean;
  /** 是否可拖拽调整大小 */
  resizable?: boolean;
  /** 是否全屏 */
  fullscreen?: boolean;
  /** 点击遮罩关闭 */
  maskClosable?: boolean;
  /** 键盘 ESC 关闭 */
  keyboard?: boolean;
  /** 自定义遮罩样式 */
  maskStyle?: CSSProperties;
  /** 自定义内容样式 */
  bodyStyle?: CSSProperties;
  /** 动画 */
  animation?: "fade" | "slide-up" | "scale" | "none";
  /** 层级 */
  zIndex?: number;
  /** 挂载节点 */
  getContainer?: () => HTMLElement;
  /** 关闭后不销毁子元素 */
  destroyOnClose?: boolean;
  /** 子元素 */
  children: ReactNode;
}

// 命令式 API
interface ModalStaticMethods {
  /** 确认对话框 */
  confirm: (options: ConfirmOptions) => ModalInstance;
  /** 成功提示 */
  success: (options: MessageOptions) => ModalInstance;
  /** 错误提示 */
  error: (options: MessageOptions) => ModalInstance;
  /** 警告提示 */
  warning: (options: MessageOptions) => ModalInstance;
  /** 信息提示 */
  info: (options: MessageOptions) => ModalInstance;
  /** 自定义对话框 */
  open: (options: OpenOptions) => ModalInstance;
}

interface ConfirmOptions {
  title?: ReactNode;
  content: ReactNode;
  okText?: string;
  cancelText?: string;
  okButtonProps?: ButtonProps;
  onOk?: () => Promise<void> | void;
  onCancel?: () => void;
  icon?: ReactNode;
  centered?: boolean;
  width?: number;
}

interface OpenOptions {
  title?: ReactNode;
  content: ReactNode | (() => ReactNode);
  width?: number;
  footer?: ReactNode;
  onOpen?: () => void;
  onClose?: () => void;
  // ... 同 ModalProps
}

interface ModalInstance {
  /** 关闭此弹窗 */
  close: () => void;
  /** 更新内容 */
  update: (options: Partial<OpenOptions>) => void;
}
```

### 可组合性设计

```tsx
// 组合示例 1：声明式 — 表单弹窗
const CreateUserModal = ({ open, onClose, onCreate }) => {
  const { register, handleSubmit, reset } = useForm({
    defaultValues: { name: "", email: "", role: "user" },
  });

  const onSubmit = async (values) => {
    await onCreate(values);
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="创建用户"
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSubmit(onSubmit)}>
            确定
          </Button>
        </>
      }
      animation="scale"
    >
      <form>
        <Input {...register("name")} label="姓名" required />
        <Input {...register("email")} label="邮箱" type="email" required />
        <Select {...register("role")} options={roles} label="角色" />
      </form>
    </Modal>
  );
};

// 组合示例 2：命令式 — 确认删除
const handleDelete = async (id: string) => {
  const modal = Modal.confirm({
    title: "确认删除",
    content: "此操作不可撤销，确定继续？",
    okText: "删除",
    cancelText: "取消",
    okButtonProps: { danger: true },
    onOk: async () => {
      await api.deleteUser(id);
      Modal.success({ content: "删除成功" });
    },
  });
  // onOk 返回 Promise 时，按钮自动显示 loading
};

// 组合示例 3：嵌套弹窗（在弹窗内打开新弹窗）
const DetailModal = ({ open, onClose, user }) => (
  <Modal open={open} onClose={onClose} title="用户详情" width={600}>
    <Descriptions data={user} />
    <Button
      onClick={() =>
        Modal.open({
          title: "编辑用户",
          content: () => <EditForm user={user} />,
          width: 500,
        })
      }
    >
      编辑
    </Button>
  </Modal>
);

// 组合示例 4：可拖拽 + 可调整大小
const DraggableModal = ({ open, onClose }) => (
  <Modal
    open={open}
    onClose={onClose}
    title="数据分析"
    draggable
    resizable
    width={800}
    animation="fade"
  >
    <ChartPanel />
  </Modal>
);

// 组合示例 5：全屏模态框
const FullscreenPreview = ({ open, onClose, image }) => (
  <Modal
    open={open}
    onClose={onClose}
    fullscreen
    maskClosable
    animation="none"
    footer={false}
  >
    <ImagePreview src={image.url} zoomable />
  </Modal>
);
```

### 关键设计决策

- **双 API 模式**：声明式适合复杂交互（表单），命令式适合简单确认/提示
- **焦点管理**：打开时聚焦第一个可聚焦元素，关闭时恢复之前焦点，Trap focus 在弹窗内
- **嵌套支持**：每个弹窗独立管理 z-index 和焦点栈
- **onOk 返回 Promise**：自动处理 loading 状态，减少样板代码
- **destroyOnClose**：默认销毁，避免表单状态残留；设为 false 可保留状态

---

## 4. DataTable — 数据表格组件

### 设计目标

支持排序、筛选、分页、行选择、展开行、固定列、虚拟滚动，通过列配置驱动，高度可定制。

### API 设计

```ts
interface Column<T> {
  /** 列唯一 key */
  key: string;
  /** 表头标题 */
  title?: ReactNode;
  /** 数据字段路径（支持嵌套 'user.name'） */
  dataIndex?: string;
  /** 单元格渲染 */
  render?: (value: any, record: T, index: number) => ReactNode;
  /** 列宽 */
  width?: number | string;
  /** 最小宽度 */
  minWidth?: number;
  /** 对齐方式 */
  align?: "left" | "center" | "right";
  /** 固定列 */
  fixed?: "left" | "right";
  /** 是否可排序 */
  sortable?: boolean;
  /** 排序函数（自定义比较） */
  sortCompare?: (a: T, b: T) => number;
  /** 是否可筛选 */
  filterable?: boolean;
  /** 筛选选项 */
  filterOptions?: Array<{ label: string; value: any }>;
  /** 筛选函数 */
  filterFn?: (value: any, filterValues: any[]) => boolean;
  /** 列 className */
  className?: string;
}

interface DataTableProps<T> {
  /** 数据源 */
  data: T[];
  /** 列配置 */
  columns: Column<T>[];
  /** 行唯一 key */
  rowKey: string | ((record: T) => string);

  /** 分页配置 */
  pagination?:
    | false
    | {
        current?: number;
        pageSize?: number;
        total?: number;
        pageSizeOptions?: number[];
        showSizeChanger?: boolean;
        showQuickJumper?: boolean;
        showTotal?: (total: number, range: [number, number]) => ReactNode;
        onChange?: (page: number, pageSize: number) => void;
      };

  /** 排序状态 */
  sort?: { key: string; direction: "asc" | "desc" | null };
  onSort?: (sort: { key: string; direction: "asc" | "desc" | null }) => void;

  /** 筛选状态 */
  filters?: Record<string, any[]>;
  onFilter?: (filters: Record<string, any[]>) => void;

  /** 行选择 */
  selection?: {
    type?: "checkbox" | "radio";
    selectedKeys?: string[];
    onChange?: (selectedKeys: string[], selectedRows: T[]) => void;
    getProps?: (record: T) => { disabled?: boolean; tooltip?: string };
  };

  /** 展开行 */
  expandable?: {
    expandedKeys?: string[];
    onExpand?: (expanded: boolean, record: T) => void;
    renderExpanded: (record: T) => ReactNode;
    defaultExpanded?: boolean;
  };

  /** 空状态 */
  empty?: ReactNode;
  /** 加载状态 */
  loading?: boolean;
  /** 行点击 */
  onRowClick?: (record: T, index: number) => void;
  /** 行 className */
  rowClassName?: (record: T, index: number) => string;
  /** 表格 className */
  className?: string;
  /** 表格样式 */
  style?: CSSProperties;
  /** 是否带边框 */
  bordered?: boolean;
  /** 是否紧凑 */
  compact?: boolean;
  /** 是否斑马纹 */
  striped?: boolean;
  /** 虚拟滚动（大数据量） */
  virtual?: boolean;
  /** 行高 */
  rowHeight?: number;
}
```

### 可组合性设计

```tsx
// 组合示例 1：基础表格 + 服务端排序/筛选/分页
const UserTable = () => {
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<SortState | null>(null);
  const [filters, setFilters] = useState<FilterState>({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

  const fetchData = async () => {
    setLoading(true);
    const res = await api.getUsers({
      page: pagination.current,
      pageSize: pagination.pageSize,
      sort: sort ? `${sort.key}:${sort.direction}` : undefined,
      filters,
    });
    setData(res.data);
    setPagination((prev) => ({ ...prev, total: res.total }));
    setLoading(false);
  };

  useEffect(fetchData, [pagination, sort, filters]);

  return (
    <DataTable
      data={data}
      loading={loading}
      rowKey="id"
      columns={[
        {
          key: "name",
          title: "姓名",
          dataIndex: "name",
          sortable: true,
          width: 120,
        },
        {
          key: "email",
          title: "邮箱",
          dataIndex: "email",
          sortable: true,
          width: 200,
        },
        {
          key: "role",
          title: "角色",
          dataIndex: "role",
          filterable: true,
          filterOptions: [
            { label: "管理员", value: "admin" },
            { label: "用户", value: "user" },
          ],
        },
        {
          key: "actions",
          title: "操作",
          render: (_, record) => (
            <>
              <Button size="small" onClick={() => editUser(record)}>
                编辑
              </Button>
              <Button size="small" danger onClick={() => deleteUser(record.id)}>
                删除
              </Button>
            </>
          ),
        },
      ]}
      sort={sort}
      onSort={setSort}
      filters={filters}
      onFilter={setFilters}
      pagination={{
        ...pagination,
        showSizeChanger: true,
        showTotal: (total) => `共 ${total} 条`,
        onChange: (page, pageSize) =>
          setPagination({ current: page, pageSize }),
      }}
      striped
    />
  );
};

// 组合示例 2：行选择 + 批量操作
const BatchOperationTable = () => {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  return (
    <>
      {selectedKeys.length > 0 && (
        <div className="batch-bar">
          已选 {selectedKeys.length} 项
          <Button onClick={() => batchDelete(selectedKeys)}>批量删除</Button>
          <Button onClick={() => setSelectedKeys([])}>取消选择</Button>
        </div>
      )}
      <DataTable
        data={items}
        columns={columns}
        rowKey="id"
        selection={{
          selectedKeys,
          onChange: setSelectedKeys,
          getProps: (record) => ({
            disabled: record.status === "locked",
            tooltip:
              record.status === "locked" ? "已锁定，不可选择" : undefined,
          }),
        }}
      />
    </>
  );
};

// 组合示例 3：展开行 — 主从表
const OrderTable = () => (
  <DataTable
    data={orders}
    columns={[
      { key: "orderNo", title: "订单号", dataIndex: "orderNo", fixed: "left" },
      { key: "amount", title: "金额", dataIndex: "amount", align: "right" },
      { key: "status", title: "状态", dataIndex: "status" },
    ]}
    rowKey="id"
    expandable={{
      renderExpanded: (order) => <OrderDetails orderId={order.id} />,
    }}
    bordered
  />
);

// 组合示例 4：固定列 + 虚拟滚动（万行级数据）
const BigDataTable = () => (
  <DataTable
    data={hugeDataset}
    columns={manyColumns}
    rowKey="id"
    virtual
    rowHeight={40}
    columns={[
      { key: "id", title: "ID", dataIndex: "id", fixed: "left", width: 80 },
      {
        key: "name",
        title: "名称",
        dataIndex: "name",
        fixed: "left",
        width: 150,
      },
      // ... 大量列
      {
        key: "lastCol",
        title: "操作",
        fixed: "right",
        render: () => <ActionMenu />,
      },
    ]}
    pagination={false}
  />
);
```

### 关键设计决策

- **列配置驱动**：所有行为（排序/筛选/渲染）通过 columns 数组声明，避免 JSX 嵌套地狱
- **dataIndex 支持嵌套路径**：`'user.profile.name'` 自动解析，无需手动展开
- **服务端 vs 客户端**：不内置数据过滤逻辑，由调用方决定在哪端处理，保持灵活性
- **selection 独立配置**：行选择与数据/列解耦，按需开启
- **virtual 开关**：默认关闭（小数据量不需要），大数据量时一键开启

---

## 5. usePagination — 分页 Hook

### 设计目标

管理分页状态，支持服务端/客户端分页，提供页码计算、跳转、尺寸切换等完整能力。

### API 设计

```ts
interface UsePaginationOptions<T> {
  /** 数据源（客户端分页）或请求函数（服务端分页） */
  dataSource?: T[];
  request?: (params: {
    page: number;
    pageSize: number;
    sort?: Sort;
    filter?: Filter;
  }) => Promise<{
    data: T[];
    total: number;
  }>;

  /** 初始页码 */
  defaultCurrent?: number;
  /** 初始每页条数 */
  defaultPageSize?: number;
  /** 每页条数选项 */
  pageSizeOptions?: number[];
  /** 是否服务端分页（默认 true） */
  serverSide?: boolean;
}

interface UsePaginationReturn<T> {
  /** 当前数据 */
  data: T[];
  /** 总条数 */
  total: number;
  /** 当前页码 */
  current: number;
  /** 每页条数 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 是否加载中 */
  loading: boolean;
  /** 是否第一页 */
  isFirstPage: boolean;
  /** 是否最后一页 */
  isLastPage: boolean;
  /** 错误 */
  error: Error | null;

  /** 页码列表（含省略号），如 [1, 2, '...', 10, 11, 12, '...', 50] */
  pageList: (number | "...")[];
  /** 每页条数选项 */
  pageSizeOptions: number[];

  /** 跳转页码 */
  goTo: (page: number) => void;
  /** 上一页 */
  prev: () => void;
  /** 下一页 */
  next: () => void;
  /** 第一页 */
  first: () => void;
  /** 最后一页 */
  last: () => void;
  /** 切换每页条数 */
  changePageSize: (pageSize: number) => void;
  /** 刷新（重新请求当前页） */
  refresh: () => Promise<void>;
  /** 重置到初始状态 */
  reset: () => void;
}
```

### 可组合性设计

```tsx
// 组合示例 1：服务端分页（最常见场景）
const PaginatedUserList = () => {
  const {
    data,
    total,
    current,
    pageSize,
    loading,
    pageList,
    goTo,
    changePageSize,
    refresh,
  } = usePagination({
    request: async ({ page, pageSize }) => {
      const res = await api.getUsers({ page, pageSize });
      return { data: res.data, total: res.total };
    },
    defaultCurrent: 1,
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
  });

  return (
    <div>
      <UserList users={data} loading={loading} />
      <Pagination
        current={current}
        pageSize={pageSize}
        total={total}
        pageList={pageList}
        onChange={goTo}
        onPageSizeChange={changePageSize}
        onRefresh={refresh}
      />
    </div>
  );
};

// 组合示例 2：客户端分页（本地数据）
const ClientSideTable = ({ allItems }: { allItems: Item[] }) => {
  const { data, current, total, goTo, pageSize, changePageSize } =
    usePagination({
      dataSource: allItems,
      defaultPageSize: 15,
      serverSide: false,
    });

  return (
    <>
      <Table data={data} columns={columns} />
      <div className="pagination-footer">
        <span>共 {total} 条</span>
        <select
          value={pageSize}
          onChange={(e) => changePageSize(Number(e.target.value))}
        >
          {[10, 15, 20, 50].map((size) => (
            <option key={size} value={size}>
              {size} 条/页
            </option>
          ))}
        </select>
        <button disabled={current === 1} onClick={() => goTo(current - 1)}>
          上一页
        </button>
        <span>
          {current} / {Math.ceil(total / pageSize)}
        </span>
        <button
          disabled={current >= Math.ceil(total / pageSize)}
          onClick={() => goTo(current + 1)}
        >
          下一页
        </button>
      </div>
    </>
  );
};

// 组合示例 3：与 DataTable 组合
const DataTableWithPagination = () => {
  const {
    data,
    loading,
    total,
    current,
    pageSize,
    goTo,
    changePageSize,
    refresh,
  } = usePagination({
    request: fetchArticles,
    defaultPageSize: 20,
  });

  return (
    <DataTable
      data={data}
      columns={articleColumns}
      rowKey="id"
      loading={loading}
      pagination={{
        current,
        pageSize,
        total,
        showSizeChanger: true,
        showTotal: (total) => `共 ${total} 篇文章`,
        onChange: goTo,
      }}
    />
  );
};

// 组合示例 4：带排序和筛选的分页
const AdvancedPaginatedList = () => {
  const [sort, setSort] = useState<Sort | null>(null);
  const [filter, setFilter] = useState<Filter>({});

  const { data, loading, current, goTo, refresh } = usePagination({
    request: async ({ page, pageSize }) =>
      api.getProducts({ page, pageSize, sort, filter }),
  });

  // 排序/筛选变化时刷新
  useEffect(() => {
    refresh();
  }, [sort, filter]);

  return (
    <div>
      <FilterBar onSort={setSort} onFilter={setFilter} />
      <ProductList items={data} loading={loading} />
      <Pagination current={current} onChange={goTo} />
    </div>
  );
};
```

### 关键设计决策

- **request vs dataSource**：一个 hook 覆盖服务端和客户端两种模式，通过 `serverSide` 切换
- **pageList 智能计算**：自动处理页码省略（`1 ... 5 6 7 ... 50`），无需 UI 层计算
- **refresh 独立于 goTo**：刷新不改变页码，适用于数据更新后保持当前位置
- **loading 状态内置**：请求期间自动设置 loading，减少调用方状态管理
- **错误处理**：内置 error 状态，调用方可根据 error 显示错误提示

---

## 设计原则总结

### 1. API 设计原则

- **约定优于配置**：合理的默认值，覆盖 80% 场景无需额外配置
- **显式优于隐式**：关键行为（如排序/筛选）通过 props 显式声明
- **渐进增强**：基础用法简单，高级功能按需开启（如 `virtual`、`draggable`）
- **TypeScript First**：完整的泛型支持，IDE 智能提示覆盖所有 API

### 2. 可组合性原则

- **关注点分离**：每个组件只做一件事，通过组合解决复杂场景
- **无隐式依赖**：组件间不共享内部状态，通过 props/callback 通信
- **渲染函数模式**：`renderItem`、`render` 等让调用方完全控制渲染
- **Hook + Component 双模式**：状态逻辑用 Hook 暴露，UI 用 Component 封装

### 3. 性能原则

- **按需渲染**：虚拟列表/表格只渲染可视区域
- **缓存策略**：行高测量缓存、页码列表缓存
- **请求防抖**：搜索/筛选时自动防抖
- **memo 优化**：纯渲染组件默认 memo

### 4. 无障碍原则

- **焦点管理**：模态框自动 trap focus，关闭时恢复
- **键盘导航**：表格行选择、分页跳转支持键盘操作
- **ARIA 属性**：所有交互元素有合适的 role 和 aria-\* 属性
- **屏幕阅读器**：分页信息、加载状态有语音提示
