# 可复用 UI 组件设计文档

## 设计原则

### 1. API 设计

- **Props 接口清晰**：每个组件都有明确的 TypeScript 类型定义
- **默认行为合理**：提供 sensible defaults，减少必要 props
- **扩展性强**：支持 className、style 等通用属性透传
- **事件标准化**：统一事件命名 (onChange, onClick, onSubmit 等)

### 2. 可组合性

- **Children 支持**：组件支持嵌套内容
- **Slot 模式**：通过 props 或 children 提供自定义渲染点
- **样式覆盖**：支持 className/style 覆盖，支持 CSS 变量
- **复合组件**：支持组件组合使用 (如 Form + Input + Button)

### 3. 类型安全

- 完整的 TypeScript 类型定义
- 泛型支持 (如 List<T>)
- 联合类型处理不同状态

### 4. 无障碍性 (A11y)

- 适当的 ARIA 属性
- 键盘导航支持
- 屏幕阅读器友好

---

## 组件列表

| 组件   | 文件       | 说明                      |
| ------ | ---------- | ------------------------- |
| Button | Button.tsx | 基础按钮，支持多种变体    |
| Input  | Input.tsx  | 输入框，支持多种类型      |
| Form   | Form.tsx   | 表单容器，支持验证        |
| List   | List.tsx   | 列表组件，支持泛型        |
| Modal  | Modal.tsx  | 模态框，支持动画          |
| Card   | Card.tsx   | 内容卡片，支持网格/骨架屏 |
| Card   | Card.tsx   | 内容卡片，支持网格/骨架屏 |

---

## 使用示例

```tsx
import { Button, Input, Form, List, Modal } from "./components";

// 组合使用示例
function CreateUserForm() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setModalOpen(true)}>创建用户</Button>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="创建用户"
      >
        <Form onSubmit={handleSubmit}>
          <Form.Field label="用户名">
            <Input name="username" required />
          </Form.Field>
          <Form.Field label="邮箱">
            <Input name="email" type="email" required />
          </Form.Field>
          <Form.Actions>
            <Button type="submit" variant="primary">
              提交
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              取消
            </Button>
          </Form.Actions>
        </Form>
      </Modal>
    </>
  );
}
```

---

## 目录结构

```
components-training/
├── DESIGN.md          # 设计文档 (本文件)
├── Button.tsx         # 按钮组件
├── Input.tsx          # 输入框组件
├── Form.tsx           # 表单组件
├── List.tsx           # 列表组件
├── Modal.tsx          # 模态框组件
├── components.ts      # 统一导出
└── examples.tsx       # 使用示例
```
