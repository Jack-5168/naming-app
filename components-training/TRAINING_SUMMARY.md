# 专项训练 10: 组件设计 - 完成总结

**训练时间:** 2026-04-22 10:00  
**训练内容:** 设计 5 个可复用组件（表单/列表/模态框等），考虑 API 设计/可组合性

---

## 一、组件概览

已完成 5 个核心 UI 组件的设计与实现：

| 组件   | 文件       | 核心功能                           | 代码行数 |
| ------ | ---------- | ---------------------------------- | -------- |
| Button | Button.tsx | 基础按钮，支持多种变体/尺寸/状态   | ~80 行   |
| Input  | Input.tsx  | 输入框，支持多种类型/状态/前后缀   | ~90 行   |
| Form   | Form.tsx   | 表单容器，支持验证/布局/复合组件   | ~180 行  |
| List   | List.tsx   | 列表组件，支持泛型/虚拟化/选择     | ~150 行  |
| Modal  | Modal.tsx  | 模态框，支持动画/Portal/命令式 API | ~200 行  |
| Card   | Card.tsx   | 内容卡片，支持网格/骨架屏/Meta     | ~100 行  |

---

## 二、API 设计原则

### 1. Props 接口清晰

每个组件都有完整的 TypeScript 类型定义，继承原生 HTML 属性并扩展：

```tsx
// Button 继承 ButtonHTMLAttributes
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  // ...
}

// Input 继承 InputHTMLAttributes (排除 size)
export interface InputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size"
> {
  type?: InputType;
  status?: InputStatus;
  prefix?: React.ReactNode;
  // ...
}
```

### 2. 默认行为合理

提供 sensible defaults，减少必要 props：

```tsx
// Button 默认值
variant = "primary";
size = "md";
loading = false;
fullWidth = false;

// Modal 默认值
closable = true;
maskClosable = true;
keyboard = true;
size = "md";
```

### 3. 扩展性强

支持 className、style 等通用属性透传：

```tsx
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className = "", ...props }, ref) {
    return <button ref={ref} className={classes} {...props} />;
  },
);
```

### 4. 事件标准化

统一事件命名 (onChange, onClick, onSubmit)，符合 React 惯例。

---

## 三、可组合性设计

### 1. Compound Components 模式

组件支持子组件挂载，形成 API 一致性：

```tsx
// Button.Group
Button.Group = ButtonGroup;

// Form.Field, Form.Actions
Form.Field = Field;
Form.Actions = Actions;

// List.Item
List.Item = ListItem;

// Input.Group
Input.Group = InputGroup;

// Card.Meta, Card.Grid
Card.Meta = CardMeta;
Card.Grid = CardGrid;
```

**使用示例:**

```tsx
<Form layout="vertical" onSubmit={handleSubmit}>
  <Form.Field label="用户名" required>
    <Input name="username" />
  </Form.Field>
  <Form.Actions>
    <Button type="submit" variant="primary">
      提交
    </Button>
  </Form.Actions>
</Form>
```

### 2. Children 支持

所有组件都支持 `children` prop，允许灵活嵌套：

```tsx
<Modal title="标题" open={isOpen} onClose={handleClose}>
  <Form>...</Form> {/* 任意内容 */}
</Modal>
```

### 3. 样式覆盖

支持 className/style 覆盖，支持 CSS 变量：

```tsx
<Form
  layout="horizontal"
  labelWidth={120} // 通过 CSS 变量传递
  className="custom-form"
/>
```

### 4. 组件组合使用

5 个组件可以无缝组合：

```tsx
function CreateUserFlow() {
  const [modalOpen, setModalOpen] = useState(false);
  const [users, setUsers] = useState([]);

  return (
    <>
      <Button onClick={() => setModalOpen(true)}>添加用户</Button>

      <List data={users} renderItem={(user) => <span>{user.name}</span>} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <Form onSubmit={handleAdd}>
          <Form.Field label="姓名">
            <Input name="name" />
          </Form.Field>
          <Form.Actions>
            <Button type="submit">保存</Button>
          </Form.Actions>
        </Form>
      </Modal>
    </>
  );
}
```

---

## 四、类型安全设计

### 1. 泛型支持

List 组件支持泛型，保持类型安全：

```tsx
interface User {
  id: number;
  name: string;
}

<List<User>
  data={users}
  itemKey="id"
  renderItem={(user) => <div>{user.name}</div>} // user 类型为 User
/>;
```

### 2. 联合类型处理状态

使用联合类型明确状态选项：

```tsx
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost"
  | "link";
export type InputStatus = "default" | "error" | "success" | "warning";
export type ModalSize = "sm" | "md" | "lg" | "xl" | "fullscreen";
```

### 3. 统一导出类型

components.ts 统一导出组件和类型：

```tsx
export { Button } from "./Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./Button";
```

---

## 五、无障碍性 (A11y)

### 1. ARIA 属性

```tsx
// Button loading 状态
<span className="btn-spinner" aria-hidden="true">...</span>

// Input 错误状态
<input
  aria-invalid={status === 'error'}
  aria-describedby={status === 'error' && errorMessage ? 'input-error' : undefined}
/>

// Modal 对话框
<div role="dialog" aria-modal="true" aria-labelledby={title ? 'modal-title' : undefined}>
  <h2 id="modal-title">{title}</h2>
</div>
```

### 2. 键盘导航

```tsx
// List.Item 支持键盘
<div
  tabIndex={disabled ? undefined : 0}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      handleClick();
    }
  }}
/>;

// Modal 支持 ESC 关闭
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };
  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, [onClose]);
```

### 3. 焦点管理

```tsx
// Modal 打开时自动聚焦
useEffect(() => {
  if (open && modalRef.current) {
    const focusable = modalRef.current.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
  }
}, [open]);
```

### 4. 屏幕阅读器友好

```tsx
// 错误信息使用 role="alert"
<span className="form-error-message" role="alert">{error}</span>

// 必填标记对屏幕阅读器隐藏
<span className="form-required-mark" aria-hidden="true">*</span>
```

---

## 六、高级特性

### 1. Form - useForm Hook

提供受控表单的 Hook 抽象：

```tsx
const form = useForm({
  initialValues: { username: "", email: "" },
  validate: (values) => {
    const errors: Record<string, string> = {};
    if (!values.username) errors.username = "必填";
    return errors;
  },
  onSubmit: async (values) => {
    /* 提交逻辑 */
  },
});

// 使用
<Input
  value={form.values.username}
  onChange={(e) => form.handleChange("username", e.target.value)}
/>;
```

### 2. Modal - Portal + 动画

使用 React Portal 渲染到 body，支持进出动画：

```tsx
// Portal 渲染
return createPortal(modalElement, document.body);

// 动画状态管理
const [visible, setVisible] = useState(open);
const [animate, setAnimate] = useState(open);

useEffect(() => {
  if (open) {
    setVisible(true);
    requestAnimationFrame(() => setAnimate(true));
  } else {
    setAnimate(false);
    const timer = setTimeout(() => setVisible(false), animationDuration);
    return () => clearTimeout(timer);
  }
}, [open]);
```

### 3. Modal - 命令式 API

提供类似 Ant Design 的命令式调用：

```tsx
Modal.info({ title: "提示", content: "这是一条提示" });
Modal.success({ title: "成功", content: "操作成功" });
Modal.error({ title: "错误", content: "操作失败" });
Modal.confirm({
  title: "确认",
  content: "确定要删除吗？",
  onOk: () => {
    /* 确认逻辑 */
  },
});
```

### 4. List - 虚拟列表

提供 VirtualList 子组件处理大数据：

```tsx
<List.Virtual
  data={largeData}
  itemHeight={50}
  height={400}
  overscan={5}
  renderItem={(item) => <div>{item.name}</div>}
/>
```

### 5. 阻止背景滚动

```tsx
// Modal 打开时阻止背景滚动
useEffect(() => {
  if (open) {
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = "";
  }
  return () => {
    document.body.style.overflow = "";
  };
}, [open]);
```

---

## 七、CSS 设计要点

### 1. CSS 变量支持

```tsx
// Form 组件传递 CSS 变量
const style = labelWidth
  ? ({ "--form-label-width": labelWidth } as React.CSSProperties)
  : undefined;

<form style={style}>...</form>;
```

### 2. BEM 命名规范

```css
.btn                    /* Block */
.btn-primary            /* Block--modifier */
.btn-icon-left          /* Block__element */
.btn-group .btn:first-child  /* Contextual styling */
```

### 3. 过渡动画

```css
.btn {
  transition: all 0.2s ease;
}

.modal-content {
  transform: scale(0.95) translateY(-20px);
  opacity: 0;
  transition: all 0.3s ease;
}

.modal-content-visible {
  transform: scale(1) translateY(0);
  opacity: 1;
}
```

### 4. 焦点样式

```css
.btn:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
}
```

---

## 八、文件结构

```
components-training/
├── DESIGN.md              # 设计原则文档
├── TRAINING_SUMMARY.md    # 本总结文档
├── Button.tsx             # 按钮组件
├── Button.css
├── Input.tsx              # 输入框组件
├── Input.css
├── Form.tsx               # 表单组件
├── Form.css
├── List.tsx               # 列表组件
├── List.css
├── Modal.tsx              # 模态框组件
├── Modal.css
├── Card.tsx               # 卡片组件
├── Card.css
├── components.ts          # 统一导出
└── examples.tsx           # 使用示例
```

---

## 九、设计亮点总结

| 设计维度       | 实现方式                                            |
| -------------- | --------------------------------------------------- |
| **API 一致性** | 所有组件支持 className, style, children 透传        |
| **类型安全**   | 完整 TypeScript 类型，泛型支持 (List<T>)            |
| **可组合性**   | Compound Components 模式 (Form.Field, List.Item 等) |
| **无障碍性**   | ARIA 属性，键盘导航，焦点管理，屏幕阅读器支持       |
| **状态管理**   | Form 内置验证，Modal 动画状态，List 选择状态        |
| **扩展能力**   | CSS 变量，className 覆盖，命令式 API (Modal)        |
| **性能优化**   | List 虚拟滚动支持，Portal 渲染隔离                  |
| **开发体验**   | 合理默认值，清晰类型提示，统一导出                  |

---

## 十、后续优化方向

1. **主题系统** - 支持 CSS 变量主题切换
2. **国际化** - 内置文本 (取消/确定等) 支持 i18n
3. **测试覆盖** - 添加单元测试和 E2E 测试
4. **Tree Shaking** - 优化导出支持按需引入
5. **更多组件** - Table, Select, DatePicker, Tree 等
6. **动效系统** - 统一的动画配置和预设

---

**训练完成 ✅**

5 个组件均已完成设计，具备良好的 API 设计、可组合性、类型安全和无障碍支持。
