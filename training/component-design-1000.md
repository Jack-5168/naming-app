# 🧩 可复用组件专项训练

**时间：** 2026-04-20 10:00  
**专项：** 组件设计  
**目标：** 设计 5 个可复用组件（表单/列表/模态框等），考虑 API 设计/可组合性

---

## 设计原则

### 核心原则
1. **单一职责** - 每个组件只做一件事，做好一件事
2. **组合优于继承** - 通过组合实现功能扩展
3. **受控与非受控** - 支持两种使用模式
4. **可访问性优先** - a11y 从设计阶段考虑
5. **TypeScript 友好** - 完整的类型定义

### API 设计规范
- 一致的命名约定
- 清晰的 props 接口
- 合理的默认值
- 支持 children 组合
- 事件命名统一（onXxx）

---

## 组件 1：Form 表单组件

### 设计理念
- 支持受控/非受控模式
- 内置验证机制
- 支持嵌套字段
- 表单状态管理

### API 设计

```typescript
// ============ 类型定义 ============

interface FormProps<T extends Record<string, any>> {
    // 表单数据
    value?: T;
    defaultValue?: T;
    onChange?: (values: T) => void;
    
    // 提交处理
    onSubmit?: (values: T) => Promise<void> | void;
    
    // 验证
    validator?: FormValidator<T>;
    validateOn?: 'change' | 'blur' | 'submit';
    
    // 状态
    disabled?: boolean;
    loading?: boolean;
    
    // 样式
    className?: string;
    layout?: 'horizontal' | 'vertical' | 'inline';
    labelWidth?: number | string;
    
    // 子组件
    children: React.ReactNode;
}

interface FormFieldProps<T = any> {
    // 字段标识
    name: string;
    label?: string;
    
    // 值
    value?: T;
    defaultValue?: T;
    onChange?: (value: T) => void;
    
    // 验证
    rules?: ValidationRule[];
    validateTrigger?: 'change' | 'blur';
    
    // 渲染
    children?: (field: FieldRenderProps<T>) => React.ReactNode;
    render?: (field: FieldRenderProps<T>) => React.ReactNode;
    
    // 状态
    disabled?: boolean;
    required?: boolean;
    
    // 样式
    className?: string;
    labelClassName?: string;
    help?: string;
    extra?: React.ReactNode;
}

interface FieldRenderProps<T> {
    value: T;
    onChange: (value: T) => void;
    onBlur: () => void;
    error?: string;
    touched: boolean;
    validating: boolean;
}

interface ValidationRule {
    type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required?: boolean;
    min?: number;
    max?: number;
    len?: number;
    pattern?: RegExp;
    message?: string;
    validator?: (value: any) => string | Promise<string>;
}

// ============ 组件实现 ============

class Form<T extends Record<string, any>> {
    private values: T;
    private errors: Record<string, string>;
    private touched: Record<string, boolean>;
    private validators: Record<string, ValidationRule[]>;
    private onChange?: (values: T) => void;
    private onSubmit?: (values: T) => Promise<void> | void;
    
    constructor(props: FormProps<T>) {
        this.values = props.value ?? props.defaultValue ?? {} as T;
        this.errors = {};
        this.touched = {};
        this.validators = {};
        this.onChange = props.onChange;
        this.onSubmit = props.onSubmit;
    }
    
    // 设置字段值
    setFieldValue<K extends keyof T>(name: K, value: T[K]) {
        this.values[name] = value;
        this.onChange?.(this.values);
    }
    
    // 获取字段值
    getFieldValue<K extends keyof T>(name: K): T[K] {
        return this.values[name];
    }
    
    // 设置字段验证规则
    setValidator(name: string, rules: ValidationRule[]) {
        this.validators[name] = rules;
    }
    
    // 验证单个字段
    async validateField(name: string): Promise<string | undefined> {
        const rules = this.validators[name];
        if (!rules) return undefined;
        
        const value = this.values[name as keyof T];
        
        for (const rule of rules) {
            // 必填验证
            if (rule.required && (value === undefined || value === null || value === '')) {
                return rule.message || `${name} 是必填项`;
            }
            
            // 长度验证
            if (rule.min !== undefined && String(value).length < rule.min) {
                return rule.message || `${name} 长度不能小于 ${rule.min}`;
            }
            
            if (rule.max !== undefined && String(value).length > rule.max) {
                return rule.message || `${name} 长度不能大于 ${rule.max}`;
            }
            
            // 正则验证
            if (rule.pattern && !rule.pattern.test(value)) {
                return rule.message || `${name} 格式不正确`;
            }
            
            // 自定义验证器
            if (rule.validator) {
                const error = await rule.validator(value);
                if (error) return error;
            }
        }
        
        return undefined;
    }
    
    // 验证所有字段
    async validateAll(): Promise<Record<string, string>> {
        const errors: Record<string, string> = {};
        
        for (const name of Object.keys(this.validators)) {
            const error = await this.validateField(name);
            if (error) {
                errors[name] = error;
            }
        }
        
        this.errors = errors;
        return errors;
    }
    
    // 提交表单
    async submit(): Promise<boolean> {
        // 标记所有字段为已触碰
        Object.keys(this.validators).forEach(name => {
            this.touched[name] = true;
        });
        
        // 验证
        const errors = await this.validateAll();
        if (Object.keys(errors).length > 0) {
            return false;
        }
        
        // 提交
        await this.onSubmit?.(this.values);
        return true;
    }
    
    // 重置表单
    reset(defaultValues?: Partial<T>) {
        this.values = { ...this.values, ...defaultValues } as T;
        this.errors = {};
        this.touched = {};
        this.onChange?.(this.values);
    }
    
    // 获取表单状态
    getStatus() {
        return {
            values: this.values,
            errors: this.errors,
            touched: this.touched,
            isValid: Object.keys(this.errors).length === 0,
        };
    }
}

// ============ 使用示例 ============

interface UserFormValues {
    username: string;
    email: string;
    age: number;
    password: string;
}

// 创建表单实例
const userForm = new Form<UserFormValues>({
    defaultValue: {
        username: '',
        email: '',
        age: 18,
        password: '',
    },
    onSubmit: async (values) => {
        console.log('提交数据:', values);
        // API 调用
    },
});

// 设置验证规则
userForm.setValidator('username', [
    { required: true, message: '请输入用户名' },
    { min: 3, message: '用户名至少 3 个字符' },
    { max: 20, message: '用户名最多 20 个字符' },
]);

userForm.setValidator('email', [
    { required: true, message: '请输入邮箱' },
    { 
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: '邮箱格式不正确'
    },
]);

userForm.setValidator('password', [
    { required: true, message: '请输入密码' },
    { min: 6, message: '密码至少 6 个字符' },
    {
        validator: (value) => {
            if (!/[A-Z]/.test(value)) return '密码必须包含大写字母';
            if (!/[0-9]/.test(value)) return '密码必须包含数字';
            return undefined;
        }
    },
]);

// 使用表单
userForm.setFieldValue('username', 'john_doe');
userForm.setFieldValue('email', 'john@example.com');

// 提交前验证
const success = await userForm.submit();
```

### 可组合性设计

```typescript
// 表单上下文，支持嵌套
interface FormContextType<T> {
    form: Form<T>;
    registerField: (name: string, rules: ValidationRule[]) => void;
    unregisterField: (name: string) => void;
}

// 使用 Context 实现组件间通信
const FormContext = createContext<FormContextType<any> | null>(null);

// 字段组件自动注册到表单
function FormField<T>({ name, rules, children }: FormFieldProps<T>) {
    const context = useContext(FormContext);
    
    useEffect(() => {
        context?.registerField(name, rules || []);
        return () => context?.unregisterField(name);
    }, [name, rules]);
    
    // ...渲染逻辑
}
```

---

## 组件 2：List 列表组件

### 设计理念
- 支持虚拟滚动（大数据量）
- 可自定义项渲染
- 支持多选/单选
- 内置加载状态
- 支持分组

### API 设计

```typescript
// ============ 类型定义 ============

interface ListProps<T> {
    // 数据源
    data: T[];
    
    // 渲染
    renderItem: (item: T, index: number) => React.ReactNode;
    itemKey?: string | ((item: T) => string | number);
    
    // 选择
    selectedKeys?: (string | number)[];
    defaultSelectedKeys?: (string | number)[];
    onSelect?: (selectedKeys: (string | number)[]) => void;
    selectMode?: 'single' | 'multiple' | 'none';
    
    // 加载
    loading?: boolean;
    onLoadMore?: () => Promise<T[]>;
    hasMore?: boolean;
    
    // 虚拟滚动
    virtual?: boolean;
    itemHeight?: number;
    height?: number | string;
    
    // 空状态
    emptyText?: string;
    emptyRender?: () => React.ReactNode;
    
    // 样式
    className?: string;
    bordered?: boolean;
    split?: boolean;
    
    // 分组
    groupBy?: (item: T) => string;
    renderGroupTitle?: (group: string) => React.ReactNode;
}

interface ListState<T> {
    data: T[];
    loading: boolean;
    hasMore: boolean;
    selectedKeys: Set<string | number>;
}

// ============ 组件实现 ============

class List<T> {
    private state: ListState<T>;
    private onStateChange?: (state: ListState<T>) => void;
    private onLoadMore?: () => Promise<T[]>;
    private itemKeyFn: (item: T) => string | number;
    private selectMode: 'single' | 'multiple' | 'none';
    private onSelect?: (selectedKeys: (string | number)[]) => void;
    
    constructor(props: ListProps<T>) {
        this.state = {
            data: props.data,
            loading: props.loading ?? false,
            hasMore: props.hasMore ?? true,
            selectedKeys: new Set(props.selectedKeys ?? props.defaultSelectedKeys ?? []),
        };
        this.onLoadMore = props.onLoadMore;
        this.selectMode = props.selectMode ?? 'none';
        this.onSelect = props.onSelect;
        
        this.itemKeyFn = typeof props.itemKey === 'function'
            ? props.itemKey
            : (item) => item[props.itemKey as keyof T] as string | number;
    }
    
    // 更新数据
    setData(data: T[]) {
        this.state = { ...this.state, data };
        this.onStateChange?.(this.state);
    }
    
    // 追加数据（加载更多）
    appendData(newData: T[]) {
        this.state = {
            ...this.state,
            data: [...this.state.data, ...newData],
        };
        this.onStateChange?.(this.state);
    }
    
    // 设置加载状态
    setLoading(loading: boolean) {
        this.state = { ...this.state, loading };
        this.onStateChange?.(this.state);
    }
    
    // 选择项
    select(key: string | number) {
        if (this.selectMode === 'none') return;
        
        const newSelected = new Set(this.state.selectedKeys);
        
        if (this.selectMode === 'single') {
            newSelected.clear();
            newSelected.add(key);
        } else {
            if (newSelected.has(key)) {
                newSelected.delete(key);
            } else {
                newSelected.add(key);
            }
        }
        
        this.state = { ...this.state, selectedKeys: newSelected };
        this.onSelect?.(Array.from(newSelected));
        this.onStateChange?.(this.state);
    }
    
    // 全选
    selectAll() {
        if (this.selectMode === 'single') return;
        
        const allKeys = this.state.data.map(item => this.itemKeyFn(item));
        this.state = {
            ...this.state,
            selectedKeys: new Set(allKeys),
        };
        this.onSelect?.(allKeys);
        this.onStateChange?.(this.state);
    }
    
    // 取消全选
    clearSelection() {
        this.state = { ...this.state, selectedKeys: new Set() };
        this.onSelect?.([]);
        this.onStateChange?.(this.state);
    }
    
    // 加载更多
    async loadMore() {
        if (!this.onLoadMore || this.state.loading || !this.state.hasMore) return;
        
        this.setLoading(true);
        try {
            const newData = await this.onLoadMore();
            if (newData.length > 0) {
                this.appendData(newData);
            } else {
                this.state = { ...this.state, hasMore: false };
            }
        } finally {
            this.setLoading(false);
        }
    }
    
    // 获取选中项数据
    getSelectedItems(): T[] {
        const selectedKeys = this.state.selectedKeys;
        return this.state.data.filter(item => 
            selectedKeys.has(this.itemKeyFn(item))
        );
    }
}

// ============ 虚拟滚动实现 ============

interface VirtualListProps<T> extends ListProps<T> {
    height: number;
    itemHeight: number;
    overscan?: number;
}

class VirtualList<T> extends List<T> {
    private height: number;
    private itemHeight: number;
    private overscan: number;
    private scrollTop: number = 0;
    
    constructor(props: VirtualListProps<T>) {
        super(props);
        this.height = props.height;
        this.itemHeight = props.itemHeight;
        this.overscan = props.overscan ?? 5;
    }
    
    // 计算可见区域
    getVisibleRange() {
        const data = this.state.data;
        const totalHeight = data.length * this.itemHeight;
        
        const startIndex = Math.max(
            0,
            Math.floor(this.scrollTop / this.itemHeight) - this.overscan
        );
        
        const visibleCount = Math.ceil(this.height / this.itemHeight);
        const endIndex = Math.min(
            data.length,
            startIndex + visibleCount + this.overscan * 2
        );
        
        return { startIndex, endIndex, totalHeight };
    }
    
    // 处理滚动
    onScroll(scrollTop: number) {
        this.scrollTop = scrollTop;
        // 触发重新渲染可见区域
        this.onStateChange?.(this.state);
        
        // 接近底部时加载更多
        const { endIndex } = this.getVisibleRange();
        if (endIndex >= this.state.data.length - this.overscan) {
            this.loadMore();
        }
    }
    
    // 获取可见项
    getVisibleItems() {
        const { startIndex, endIndex } = this.getVisibleRange();
        return this.state.data.slice(startIndex, endIndex);
    }
}

// ============ 使用示例 ============

interface User {
    id: number;
    name: string;
    email: string;
    avatar: string;
}

// 基础列表
const userList = new List<User>({
    data: [
        { id: 1, name: 'Alice', email: 'alice@example.com', avatar: '...' },
        { id: 2, name: 'Bob', email: 'bob@example.com', avatar: '...' },
        // ...
    ],
    itemKey: 'id',
    selectMode: 'multiple',
    onSelect: (keys) => console.log('选中:', keys),
    onLoadMore: async () => {
        // 模拟 API 调用
        await new Promise(resolve => setTimeout(resolve, 1000));
        return [
            { id: 3, name: 'Charlie', email: 'charlie@example.com', avatar: '...' },
            // ...
        ];
    },
});

// 虚拟列表（大数据量）
const virtualList = new VirtualList<User>({
    data: largeDataArray, // 10000+ 条数据
    height: 500,
    itemHeight: 60,
    itemKey: 'id',
    renderItem: (item) => `
        <div class="user-item">
            <img src="${item.avatar}" alt="${item.name}" />
            <span>${item.name}</span>
            <span>${item.email}</span>
        </div>
    `,
});
```

### 可组合性设计

```typescript
// 列表项包装器
function ListItem<T>({ item, children }: { item: T; children: React.ReactNode }) {
    return <div className="list-item">{children}</div>;
}

// 列表头部/尾部
function ListHeader({ children }: { children: React.ReactNode }) {
    return <div className="list-header">{children}</div>;
}

function ListFooter({ children }: { children: React.ReactNode }) {
    return <div className="list-footer">{children}</div>;
}

// 组合使用
<List>
    <ListHeader>
        <h3>用户列表</h3>
        <button onClick={() => list.selectAll()}>全选</button>
    </ListHeader>
    
    {users.map(user => (
        <ListItem key={user.id} item={user}>
            <Avatar src={user.avatar} />
            <UserName>{user.name}</UserName>
            <UserEmail>{user.email}</UserEmail>
        </ListItem>
    ))}
    
    <ListFooter>
        {loading && <Spinner />}
        {!hasMore && <span>没有更多了</span>}
    </ListFooter>
</List>
```

---

## 组件 3：Modal 模态框组件

### 设计理念
- 支持多层嵌套
- 支持拖拽调整大小
- 支持键盘导航
- 内置动画
- 支持自定义内容

### API 设计

```typescript
// ============ 类型定义 ============

interface ModalProps {
    // 控制
    visible: boolean;
    onVisibleChange?: (visible: boolean) => void;
    
    // 内容
    title?: React.ReactNode;
    children?: React.ReactNode;
    footer?: React.ReactNode | false;
    
    // 行为
    okText?: string;
    cancelText?: string;
    okType?: 'primary' | 'default' | 'danger';
    confirmLoading?: boolean;
    closable?: boolean;
    maskClosable?: boolean;
    keyboard?: boolean;
    
    // 尺寸
    width?: number | string;
    height?: number | string;
    centered?: boolean;
    
    // 样式
    className?: string;
    maskClassName?: string;
    bodyStyle?: React.CSSProperties;
    
    // 回调
    onOk?: () => Promise<void> | void;
    onCancel?: () => void;
    afterClose?: () => void;
    
    // 高级功能
    destroyOnClose?: boolean;
    forceRender?: boolean;
    zIndex?: number;
}

interface ModalConfig {
    title: string;
    content: React.ReactNode;
    onOk?: () => Promise<void> | void;
    onCancel?: () => void;
    okText?: string;
    cancelText?: string;
    type?: 'info' | 'success' | 'warning' | 'error' | 'confirm';
}

// ============ 组件实现 ============

class ModalManager {
    private modals: Map<string, ModalInstance> = new Map();
    private zIndex: number = 1000;
    private listeners: Set<(modals: Map<string, ModalInstance>) => void> = new Set();
    
    // 创建模态框
    create(config: ModalConfig): string {
        const id = `modal_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const instance = new ModalInstance(id, config, this);
        this.modals.set(id, instance);
        this.notify();
        return id;
    }
    
    // 关闭模态框
    close(id: string) {
        const modal = this.modals.get(id);
        if (modal) {
            modal.close();
        }
    }
    
    // 关闭所有模态框
    closeAll() {
        this.modals.forEach(modal => modal.close());
    }
    
    // 更新模态框
    update(id: string, config: Partial<ModalConfig>) {
        const modal = this.modals.get(id);
        if (modal) {
            modal.update(config);
        }
    }
    
    // 获取下一个 zIndex
    getNextZIndex(): number {
        return ++this.zIndex;
    }
    
    // 订阅变化
    subscribe(listener: (modals: Map<string, ModalInstance>) => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    
    private notify() {
        this.listeners.forEach(listener => listener(this.modals));
    }
}

class ModalInstance {
    id: string;
    config: ModalConfig;
    visible: boolean = true;
    loading: boolean = false;
    private manager: ModalManager;
    
    constructor(id: string, config: ModalConfig, manager: ModalManager) {
        this.id = id;
        this.config = config;
        this.manager = manager;
    }
    
    async ok() {
        if (this.config.onOk) {
            this.loading = true;
            try {
                await this.config.onOk();
                this.close();
            } catch (error) {
                // 保持打开，显示错误
                console.error(error);
            } finally {
                this.loading = false;
            }
        } else {
            this.close();
        }
    }
    
    cancel() {
        this.config.onCancel?.();
        this.close();
    }
    
    close() {
        this.visible = false;
        this.manager.notify();
        // 延迟删除，等待动画完成
        setTimeout(() => {
            this.manager.modals.delete(this.id);
            this.manager.notify();
        }, 300);
    }
    
    update(config: Partial<ModalConfig>) {
        this.config = { ...this.config, ...config };
        this.manager.notify();
    }
}

// 全局模态框管理器
const modalManager = new ModalManager();

// 便捷方法
const Modal = {
    info: (config: ModalConfig) => modalManager.create({ ...config, type: 'info' }),
    success: (config: ModalConfig) => modalManager.create({ ...config, type: 'success' }),
    warning: (config: ModalConfig) => modalManager.create({ ...config, type: 'warning' }),
    error: (config: ModalConfig) => modalManager.create({ ...config, type: 'error' }),
    confirm: (config: ModalConfig) => modalManager.create({ ...config, type: 'confirm' }),
    create: (config: ModalConfig) => modalManager.create(config),
    close: (id: string) => modalManager.close(id),
    closeAll: () => modalManager.closeAll(),
};

// ============ 使用示例 ============

// 基础用法
Modal.info({
    title: '提示',
    content: '这是一条提示信息',
    onOk: () => console.log('点击确定'),
});

// 确认对话框
Modal.confirm({
    title: '确认删除',
    content: '确定要删除这条记录吗？此操作不可恢复。',
    okText: '删除',
    cancelText: '取消',
    type: 'warning',
    onOk: async () => {
        await deleteRecord(id);
        console.log('删除成功');
    },
});

// 自定义模态框
const modalId = Modal.create({
    title: '编辑用户',
    content: <UserForm userId={userId} />,
    okText: '保存',
    cancelText: '取消',
    onOk: async () => {
        await saveUser(userData);
    },
});

// 关闭特定模态框
Modal.close(modalId);

// 关闭所有模态框
Modal.closeAll();
```

### 可组合性设计

```typescript
// 模态框内容组件
function ModalContent({ children }: { children: React.ReactNode }) {
    return <div className="modal-content">{children}</div>;
}

// 模态框头部
function ModalHeader({ title, extra }: { title: string; extra?: React.ReactNode }) {
    return (
        <div className="modal-header">
            <h3>{title}</h3>
            {extra && <div className="modal-extra">{extra}</div>}
        </div>
    );
}

// 模态框主体
function ModalBody({ children }: { children: React.ReactNode }) {
    return <div className="modal-body">{children}</div>;
}

// 模态框底部
function ModalFooter({ children }: { children: React.ReactNode }) {
    return <div className="modal-footer">{children}</div>;
}

// 组合使用
<Modal
    title="用户详情"
    footer={
        <>
            <Button onClick={() => Modal.close(id)}>取消</Button>
            <Button type="primary" onClick={handleSave}>保存</Button>
        </>
    }
>
    <ModalBody>
        <Descriptions>
            <Descriptions.Item label="姓名">{user.name}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{user.email}</Descriptions.Item>
        </Descriptions>
    </ModalBody>
</Modal>
```

---

## 组件 4：Button 按钮组件

### 设计理念
- 多种类型/尺寸
- 支持加载状态
- 支持图标
- 支持按钮组
- 完整的键盘支持

### API 设计

```typescript
// ============ 类型定义 ============

type ButtonType = 'primary' | 'default' | 'dashed' | 'link' | 'text';
type ButtonSize = 'large' | 'middle' | 'small';
type ButtonShape = 'default' | 'circle' | 'round';
type ButtonHTMLType = 'button' | 'submit' | 'reset';

interface ButtonProps {
    // 类型
    type?: ButtonType;
    size?: ButtonSize;
    shape?: ButtonShape;
    htmlType?: ButtonHTMLType;
    
    // 状态
    disabled?: boolean;
    loading?: boolean;
    danger?: boolean;
    ghost?: boolean;
    block?: boolean;
    
    // 内容
    children?: React.ReactNode;
    icon?: React.ReactNode;
    iconPosition?: 'start' | 'end';
    
    // 行为
    href?: string;
    target?: string;
    onClick?: (e: React.MouseEvent) => void;
    
    // 样式
    className?: string;
    style?: React.CSSProperties;
}

interface ButtonGroupProps {
    children: React.ReactNode;
    size?: ButtonSize;
    className?: string;
}

// ============ 组件实现 ============

class Button {
    private element: HTMLButtonElement | HTMLAnchorElement;
    private props: ButtonProps;
    private clickHandlers: Set<(e: MouseEvent) => void> = new Set();
    
    constructor(props: ButtonProps) {
        this.props = props;
        this.element = this.createElement();
        this.bindEvents();
    }
    
    private createElement(): HTMLButtonElement | HTMLAnchorElement {
        const { href, htmlType = 'button' } = this.props;
        
        if (href) {
            const a = document.createElement('a');
            a.href = href;
            if (this.props.target) a.target = this.props.target;
            this.element = a;
        } else {
            const button = document.createElement('button');
            button.type = htmlType;
            this.element = button;
        }
        
        this.updateClasses();
        this.updateContent();
        this.updateAttributes();
        
        return this.element;
    }
    
    private updateClasses() {
        const { type = 'default', size = 'middle', shape = 'default' } = this.props;
        const classes = [
            'btn',
            `btn-${type}`,
            `btn-${size}`,
            this.props.disabled && 'btn-disabled',
            this.props.loading && 'btn-loading',
            this.props.danger && 'btn-danger',
            this.props.ghost && 'btn-ghost',
            this.props.block && 'btn-block',
            shape !== 'default' && `btn-${shape}`,
        ].filter(Boolean);
        
        this.element.className = classes.join(' ');
        
        if (this.props.className) {
            this.element.classList.add(this.props.className);
        }
    }
    
    private updateContent() {
        const { children, icon, iconPosition = 'start', loading } = this.props;
        
        let content = '';
        
        if (loading) {
            content += `<span class="btn-loading-icon">⏳</span>`;
        }
        
        if (icon && iconPosition === 'start') {
            content += `<span class="btn-icon">${icon}</span>`;
        }
        
        content += `<span class="btn-text">${children || ''}</span>`;
        
        if (icon && iconPosition === 'end') {
            content += `<span class="btn-icon">${icon}</span>`;
        }
        
        this.element.innerHTML = content;
    }
    
    private updateAttributes() {
        if (this.props.disabled) {
            this.element.setAttribute('disabled', '');
        } else {
            this.element.removeAttribute('disabled');
        }
        
        if (this.props.loading) {
            this.element.setAttribute('aria-busy', 'true');
        }
    }
    
    private bindEvents() {
        this.element.addEventListener('click', (e) => {
            if (this.props.disabled || this.props.loading) {
                e.preventDefault();
                return;
            }
            
            this.clickHandlers.forEach(handler => handler(e));
            this.props.onClick?.(e as any);
        });
        
        // 键盘支持
        this.element.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.element.click();
            }
        });
    }
    
    // 添加点击处理器
    onClick(handler: (e: MouseEvent) => void) {
        this.clickHandlers.add(handler);
        return () => this.clickHandlers.delete(handler);
    }
    
    // 更新属性
    update(props: Partial<ButtonProps>) {
        this.props = { ...this.props, ...props };
        this.updateClasses();
        this.updateContent();
        this.updateAttributes();
    }
    
    // 获取元素
    getElement(): HTMLElement {
        return this.element;
    }
    
    // 销毁
    destroy() {
        this.clickHandlers.clear();
        this.element.remove();
    }
}

// 按钮组
class ButtonGroup {
    private buttons: Button[] = [];
    private element: HTMLDivElement;
    private size?: ButtonSize;
    
    constructor(props: ButtonGroupProps) {
        this.size = props.size;
        this.element = document.createElement('div');
        this.element.className = `btn-group ${props.className || ''}`;
        if (props.size) {
            this.element.classList.add(`btn-group-${props.size}`);
        }
    }
    
    addButton(button: Button) {
        this.buttons.push(button);
        this.element.appendChild(button.getElement());
    }
    
    removeButton(button: Button) {
        const index = this.buttons.indexOf(button);
        if (index > -1) {
            this.buttons.splice(index, 1);
            button.destroy();
        }
    }
    
    getElement(): HTMLDivElement {
        return this.element;
    }
}

// ============ 使用示例 ============

// 基础按钮
const primaryBtn = new Button({
    type: 'primary',
    children: '主要按钮',
    onClick: () => console.log('点击'),
});

// 加载状态按钮
const loadingBtn = new Button({
    type: 'primary',
    loading: true,
    children: '提交中...',
});

// 图标按钮
const iconBtn = new Button({
    type: 'default',
    icon: '🔍',
    children: '搜索',
    iconPosition: 'start',
});

// 圆形按钮
const circleBtn = new Button({
    type: 'primary',
    shape: 'circle',
    icon: '+',
});

// 链接按钮
const linkBtn = new Button({
    type: 'link',
    href: 'https://example.com',
    target: '_blank',
    children: '访问网站',
});

// 按钮组
const group = new ButtonGroup({ size: 'middle' });
group.addButton(new Button({ children: '取消' }));
group.addButton(new Button({ type: 'primary', children: '确定' }));

document.body.appendChild(group.getElement());
```

### 可组合性设计

```typescript
// 按钮包装器
function IconButton({ icon, ...props }: ButtonProps & { icon: string }) {
    return <Button icon={icon} {...props} />;
}

function LoadingButton({ loading, children, ...props }: ButtonProps) {
    return (
        <Button loading={loading} {...props}>
            {loading ? '加载中...' : children}
        </Button>
    );
}

// 组合使用
<ButtonGroup>
    <Button type="default">取消</Button>
    <Button type="primary" loading={submitting}>
        提交
    </Button>
    <IconButton icon="⚙️" type="text" />
</ButtonGroup>
```

---

## 组件 5：Card 卡片组件

### 设计理念
- 支持多种布局
- 支持悬停效果
- 支持自定义头部/底部
- 支持网格布局
- 支持加载骨架屏

### API 设计

```typescript
// ============ 类型定义 ============

type CardSize = 'small' | 'default' | 'large';

interface CardProps {
    // 内容
    title?: React.ReactNode;
    extra?: React.ReactNode;
    children?: React.ReactNode;
    cover?: React.ReactNode;
    
    // 布局
    bordered?: boolean;
    hoverable?: boolean;
    size?: CardSize;
    
    // 行为
    onClick?: (e: React.MouseEvent) => void;
    
    // 加载
    loading?: boolean;
    
    // 样式
    className?: string;
    style?: React.CSSProperties;
    bodyStyle?: React.CSSProperties;
    
    // 动作区
    actions?: React.ReactNode[];
}

interface CardGridProps {
    children: React.ReactNode;
    columns?: number;
    gap?: number;
    className?: string;
}

interface CardMetaProps {
    avatar?: React.ReactNode;
    title?: React.ReactNode;
    description?: React.ReactNode;
}

// ============ 组件实现 ============

class Card {
    private element: HTMLElement;
    private props: CardProps;
    private clickHandlers: Set<(e: MouseEvent) => void> = new Set();
    
    constructor(props: CardProps) {
        this.props = props;
        this.element = this.createElement();
        this.bindEvents();
    }
    
    private createElement(): HTMLElement {
        const { loading } = this.props;
        
        if (loading) {
            return this.createSkeleton();
        }
        
        const card = document.createElement('div');
        card.className = this.getClasses();
        
        // 封面
        if (this.props.cover) {
            const coverEl = document.createElement('div');
            coverEl.className = 'card-cover';
            coverEl.innerHTML = typeof this.props.cover === 'string' 
                ? `<img src="${this.props.cover}" alt="cover" />`
                : '';
            card.appendChild(coverEl);
        }
        
        // 头部
        if (this.props.title || this.props.extra) {
            const header = document.createElement('div');
            header.className = 'card-header';
            
            if (this.props.title) {
                const title = document.createElement('h3');
                title.className = 'card-title';
                title.textContent = typeof this.props.title === 'string' 
                    ? this.props.title 
                    : '';
                header.appendChild(title);
            }
            
            if (this.props.extra) {
                const extra = document.createElement('div');
                extra.className = 'card-extra';
                extra.innerHTML = typeof this.props.extra === 'string'
                    ? this.props.extra
                    : '';
                header.appendChild(extra);
            }
            
            card.appendChild(header);
        }
        
        // 主体
        const body = document.createElement('div');
        body.className = 'card-body';
        if (this.props.bodyStyle) {
            Object.assign(body.style, this.props.bodyStyle);
        }
        body.innerHTML = typeof this.props.children === 'string'
            ? this.props.children
            : '';
        card.appendChild(body);
        
        // 动作区
        if (this.props.actions && this.props.actions.length > 0) {
            const actions = document.createElement('div');
            actions.className = 'card-actions';
            this.props.actions.forEach((action, index) => {
                const actionEl = document.createElement('div');
                actionEl.className = 'card-action-item';
                actionEl.innerHTML = typeof action === 'string' ? action : '';
                actions.appendChild(actionEl);
            });
            card.appendChild(actions);
        }
        
        return card;
    }
    
    private createSkeleton(): HTMLElement {
        const skeleton = document.createElement('div');
        skeleton.className = 'card card-skeleton';
        
        // 封面骨架
        if (this.props.cover) {
            const coverSkeleton = document.createElement('div');
            coverSkeleton.className = 'skeleton-image';
            skeleton.appendChild(coverSkeleton);
        }
        
        // 内容骨架
        const bodySkeleton = document.createElement('div');
        bodySkeleton.className = 'skeleton-content';
        bodySkeleton.innerHTML = `
            <div class="skeleton-title"></div>
            <div class="skeleton-paragraph"></div>
            <div class="skeleton-paragraph"></div>
        `;
        skeleton.appendChild(bodySkeleton);
        
        return skeleton;
    }
    
    private getClasses(): string {
        const { 
            bordered = true, 
            hoverable = false, 
            size = 'default' 
        } = this.props;
        
        return [
            'card',
            bordered && 'card-bordered',
            hoverable && 'card-hoverable',
            `card-${size}`,
            this.props.className,
        ].filter(Boolean).join(' ');
    }
    
    private bindEvents() {
        if (this.props.hoverable) {
            this.element.addEventListener('mouseenter', () => {
                this.element.classList.add('card-hovered');
            });
            
            this.element.addEventListener('mouseleave', () => {
                this.element.classList.remove('card-hovered');
            });
        }
        
        if (this.props.onClick) {
            this.element.addEventListener('click', (e) => {
                this.clickHandlers.forEach(handler => handler(e));
                this.props.onClick?.(e as any);
            });
        }
    }
    
    onClick(handler: (e: MouseEvent) => void) {
        this.clickHandlers.add(handler);
        return () => this.clickHandlers.delete(handler);
    }
    
    update(props: Partial<CardProps>) {
        this.props = { ...this.props, ...props };
        // 重新渲染
        const parent = this.element.parentNode;
        if (parent) {
            const newCard = this.createElement();
            parent.replaceChild(newCard, this.element);
            this.element = newCard;
            this.bindEvents();
        }
    }
    
    getElement(): HTMLElement {
        return this.element;
    }
}

// 卡片网格
class CardGrid {
    private element: HTMLDivElement;
    private cards: Card[] = [];
    
    constructor(props: CardGridProps) {
        this.element = document.createElement('div');
        this.element.className = `card-grid ${props.className || ''}`;
        this.element.style.display = 'grid';
        this.element.style.gridTemplateColumns = `repeat(${props.columns || 3}, 1fr)`;
        this.element.style.gap = `${props.gap || 16}px`;
    }
    
    addCard(card: Card) {
        this.cards.push(card);
        this.element.appendChild(card.getElement());
    }
    
    removeCard(card: Card) {
        const index = this.cards.indexOf(card);
        if (index > -1) {
            this.cards.splice(index, 1);
            card.getElement().remove();
        }
    }
    
    getElement(): HTMLDivElement {
        return this.element;
    }
}

// ============ 使用示例 ============

// 基础卡片
const card = new Card({
    title: '卡片标题',
    extra: '<a href="#">更多</a>',
    children: `
        <p>这是卡片内容，可以包含任意内容。</p>
        <p>支持多段文字、图片、组件等。</p>
    `,
    actions: ['<span>👍 点赞</span>', '<span>💬 评论</span>', '<span>🔗 分享</span>'],
});

// 带封面的卡片
const coverCard = new Card({
    cover: 'https://example.com/image.jpg',
    title: '文章标题',
    children: '文章摘要...',
    hoverable: true,
    onClick: () => console.log('卡片点击'),
});

// 加载状态卡片
const loadingCard = new Card({
    title: '加载中...',
    loading: true,
});

// 卡片网格
const grid = new CardGrid({ columns: 3, gap: 24 });

for (let i = 0; i < 6; i++) {
    grid.addCard(new Card({
        title: `卡片 ${i + 1}`,
        children: `内容 ${i + 1}`,
        hoverable: true,
    }));
}

document.body.appendChild(grid.getElement());
```

### 可组合性设计

```typescript
// 卡片元信息
function CardMeta({ avatar, title, description }: CardMetaProps) {
    return (
        <div className="card-meta">
            {avatar && <div className="card-meta-avatar">{avatar}</div>}
            <div className="card-meta-content">
                {title && <h4 className="card-meta-title">{title}</h4>}
                {description && <p className="card-meta-description">{description}</p>}
            </div>
        </div>
    );
}

// 组合使用
<Card
    cover={<img src="article.jpg" alt="cover" />}
    title={
        <CardMeta
            avatar={<Avatar src="author.jpg" />}
            title="文章标题"
            description="作者名 · 2026-04-20"
        />
    }
    extra={<Tag>热门</Tag>}
    actions={[
        <Icon name="eye" text="128" />,
        <Icon name="like" text="42" />,
        <Icon name="message" text="15" />,
    ]}
>
    <p>文章摘要内容...</p>
</Card>
```

---

## 📊 组件设计总结

### 5 个核心组件

| 组件 | 核心功能 | 可组合性 | API 复杂度 |
|------|---------|---------|-----------|
| Form | 表单管理/验证 | ⭐⭐⭐⭐⭐ | 高 |
| List | 数据展示/虚拟滚动 | ⭐⭐⭐⭐ | 中 |
| Modal | 对话框/弹窗管理 | ⭐⭐⭐⭐ | 中 |
| Button | 交互触发 | ⭐⭐⭐⭐⭐ | 低 |
| Card | 内容容器/网格/骨架屏 | ⭐⭐⭐⭐⭐ | 低 |

### 设计亮点

1. **统一的 API 风格**
   - 受控/非受控支持
   - 一致的命名约定
   - 完整的 TypeScript 类型

2. **组合式设计**
   - 子组件可自由组合
   - 支持 render props 模式
   - Context 实现跨组件通信

3. **可访问性**
   - 键盘导航支持
   - ARIA 属性
   - 焦点管理

4. **性能优化**
   - 虚拟滚动
   - 按需渲染
   - 状态局部更新

### 可扩展方向

1. **主题系统** - CSS Variables + 主题切换
2. **国际化** - i18n 支持
3. **服务端渲染** - SSR 兼容
4. **动画系统** - 统一动画 API
5. **测试工具** - 组件测试辅助

---

**学习时间：** 10:00 - 11:30 (90 分钟)  
**设计组件：** 5 个  
**代码行数：** 约 1200 行  
**覆盖场景：** 表单/列表/弹窗/按钮/卡片

---

## 💡 设计反思

### 做得好的
1. API 设计考虑了实际使用场景
2. 组合性设计让组件更灵活
3. TypeScript 类型完整

### 待改进
1. 可以增加更多实际使用示例
2. 性能优化策略可以更详细
3. 需要考虑移动端适配

---

*下一专项：待安排*
