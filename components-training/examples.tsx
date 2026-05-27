import React, { useState } from "react";
import { Button, Input, Form, List, Modal, Card } from "./components";

// ============ 示例 1: 基础按钮 ============

function ButtonExamples() {
  return (
    <div className="examples">
      <h3>按钮示例</h3>

      {/* 不同变体 */}
      <div className="example-row">
        <Button variant="primary">主要按钮</Button>
        <Button variant="secondary">次要按钮</Button>
        <Button variant="danger">危险按钮</Button>
        <Button variant="ghost">幽灵按钮</Button>
        <Button variant="link">链接按钮</Button>
      </div>

      {/* 不同尺寸 */}
      <div className="example-row">
        <Button size="sm">小按钮</Button>
        <Button size="md">中按钮</Button>
        <Button size="lg">大按钮</Button>
      </div>

      {/* 加载状态 */}
      <div className="example-row">
        <Button loading>加载中</Button>
        <Button loading variant="secondary">
          加载中
        </Button>
      </div>

      {/* 带图标 */}
      <div className="example-row">
        <Button leftIcon={<span>🔍</span>}>搜索</Button>
        <Button rightIcon={<span>→</span>}>下一步</Button>
        <Button iconOnly>🔔</Button>
      </div>

      {/* 按钮组 */}
      <Button.Group>
        <Button variant="secondary">左</Button>
        <Button variant="secondary">中</Button>
        <Button variant="secondary">右</Button>
      </Button.Group>
    </div>
  );
}

// ============ 示例 2: 输入框 ============

function InputExamples() {
  const [value, setValue] = useState("");

  return (
    <div className="examples">
      <h3>输入框示例</h3>

      {/* 不同尺寸 */}
      <div className="example-row">
        <Input size="sm" placeholder="小输入框" />
        <Input size="md" placeholder="中输入框" />
        <Input size="lg" placeholder="大输入框" />
      </div>

      {/* 不同状态 */}
      <div className="example-row">
        <Input placeholder="默认状态" />
        <Input
          status="error"
          placeholder="错误状态"
          errorMessage="请输入有效内容"
        />
        <Input status="success" placeholder="成功状态" />
      </div>

      {/* 带前后缀 */}
      <div className="example-row">
        <Input prefix="¥" placeholder="金额" />
        <Input suffix=".com" placeholder="域名" />
        <Input prefix="🔍" suffix="🎤" placeholder="搜索" />
      </div>

      {/* 可清除 */}
      <div className="example-row">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          allowClear
          placeholder="可清除"
        />
      </div>

      {/* 输入框组 */}
      <Input.Group>
        <Input placeholder="用户名" />
        <Button variant="primary">登录</Button>
      </Input.Group>
    </div>
  );
}

// ============ 示例 3: 表单 ============

function FormExamples() {
  const form = useForm({
    initialValues: {
      username: "",
      email: "",
      password: "",
    },
    validate: (values) => {
      const errors: Record<string, string> = {};
      if (!values.username) errors.username = "请输入用户名";
      if (!values.email) errors.email = "请输入邮箱";
      if (!values.password) errors.password = "请输入密码";
      return errors;
    },
    onSubmit: async (values) => {
      console.log("提交数据:", values);
      alert("提交成功!");
    },
  });

  return (
    <div className="examples">
      <h3>表单示例</h3>

      <Form layout="vertical" onSubmit={form.handleSubmit}>
        <Form.Field
          name="username"
          label="用户名"
          required
          errorMessage={form.errors.username}
        >
          <Input
            value={form.values.username}
            onChange={(e) => form.handleChange("username", e.target.value)}
            placeholder="请输入用户名"
          />
        </Form.Field>

        <Form.Field
          name="email"
          label="邮箱"
          required
          errorMessage={form.errors.email}
        >
          <Input
            type="email"
            value={form.values.email}
            onChange={(e) => form.handleChange("email", e.target.value)}
            placeholder="请输入邮箱"
          />
        </Form.Field>

        <Form.Field
          name="password"
          label="密码"
          required
          errorMessage={form.errors.password}
        >
          <Input
            type="password"
            value={form.values.password}
            onChange={(e) => form.handleChange("password", e.target.value)}
            placeholder="请输入密码"
          />
        </Form.Field>

        <Form.Actions>
          <Button type="submit" variant="primary" loading={form.isSubmitting}>
            提交
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              form.setValues({ username: "", email: "", password: "" })
            }
          >
            重置
          </Button>
        </Form.Actions>
      </Form>
    </div>
  );
}

// ============ 示例 4: 列表 ============

interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
}

function ListExamples() {
  const [selectedKeys, setSelectedKeys] = useState<(string | number)[]>([]);

  const users: User[] = [
    { id: 1, name: "张三", email: "zhangsan@example.com" },
    { id: 2, name: "李四", email: "lisi@example.com" },
    { id: 3, name: "王五", email: "wangwu@example.com" },
    { id: 4, name: "赵六", email: "zhaoliu@example.com" },
  ];

  return (
    <div className="examples">
      <h3>列表示例</h3>

      {/* 基础列表 */}
      <List
        data={["苹果", "香蕉", "橙子", "葡萄"]}
        size="md"
        bordered
        header="水果列表"
        footer="共 4 项"
      />

      {/* 带数据的列表 */}
      <List<User>
        data={users}
        itemKey="id"
        renderItem={(user) => (
          <div>
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
        )}
        header="用户列表"
      />

      {/* 可选择列表 */}
      <List<User>
        data={users}
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        renderItem={(user) => (
          <div>
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
        )}
        header="可选择列表 (已选：{selectedKeys.length})"
      />

      {/* 空状态 */}
      <List data={[]} emptyText="暂无数据，去添加吧~" header="空列表示例" />
    </div>
  );
}

// ============ 示例 5: 模态框 ============

function ModalExamples() {
  const [modal1Open, setModal1Open] = useState(false);
  const [modal2Open, setModal2Open] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  return (
    <div className="examples">
      <h3>模态框示例</h3>

      <div className="example-row">
        <Button onClick={() => setModal1Open(true)}>打开基础模态框</Button>
        <Button variant="secondary" onClick={() => setModal2Open(true)}>
          打开表单模态框
        </Button>
      </div>

      {/* 基础模态框 */}
      <Modal
        open={modal1Open}
        onClose={() => setModal1Open(false)}
        title="基础模态框"
        size="md"
      >
        <p>这是一个基础的模态框示例。</p>
        <p>支持点击遮罩关闭、按 ESC 关闭。</p>
      </Modal>

      {/* 表单模态框 */}
      <Modal
        open={modal2Open}
        onClose={() => setModal2Open(false)}
        title="编辑信息"
        size="lg"
        okText="保存"
        okLoading={confirmLoading}
        onOk={async () => {
          setConfirmLoading(true);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          setConfirmLoading(false);
          setModal2Open(false);
        }}
      >
        <Form layout="vertical">
          <Form.Field label="姓名">
            <Input placeholder="请输入姓名" />
          </Form.Field>
          <Form.Field label="邮箱">
            <Input type="email" placeholder="请输入邮箱" />
          </Form.Field>
        </Form>
      </Modal>
    </div>
  );
}

// ============ 示例 6: 组合使用 ============

function CombinedExample() {
  const [modalOpen, setModalOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([
    { id: 1, name: "张三", email: "zhangsan@example.com" },
    { id: 2, name: "李四", email: "lisi@example.com" },
  ]);

  const handleAddUser = async (data: Record<string, any>) => {
    const newUser: User = {
      id: users.length + 1,
      name: data.username,
      email: data.email,
    };
    setUsers([...users, newUser]);
    setModalOpen(false);
  };

  return (
    <div className="examples">
      <h3>组合使用示例 - 用户管理</h3>

      <div className="toolbar">
        <Button
          variant="primary"
          leftIcon={<span>+</span>}
          onClick={() => setModalOpen(true)}
        >
          添加用户
        </Button>
      </div>

      <List<User>
        data={users}
        itemKey="id"
        bordered
        header="用户列表"
        renderItem={(user) => (
          <div className="user-item">
            <span className="user-name">{user.name}</span>
            <span className="user-email">{user.email}</span>
            <Button size="sm" variant="ghost">
              编辑
            </Button>
          </div>
        )}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="添加用户"
        onOk={() => {}}
      >
        <Form onSubmit={handleAddUser}>
          <Form.Field label="用户名" required>
            <Input name="username" placeholder="请输入用户名" />
          </Form.Field>
          <Form.Field label="邮箱" required>
            <Input name="email" type="email" placeholder="请输入邮箱" />
          </Form.Field>
        </Form>
      </Modal>
    </div>
  );
}

// ============ 示例 7: 卡片 ============

function CardExamples() {
  return (
    <div className="examples">
      <h3>卡片示例</h3>

      {/* 基础卡片 */}
      <Card
        title="基础卡片"
        extra={
          <Button size="sm" variant="link">
            更多
          </Button>
        }
      >
        <p>这是一张基础卡片，可以包含任意内容。</p>
        <p>支持标题、内容、操作区等。</p>
      </Card>

      {/* 带封面的卡片 */}
      <Card
        cover={<img src="https://picsum.photos/400/200" alt="cover" />}
        title="文章标题"
        hoverable
      >
        <Card.Meta
          avatar={<span style={{ fontSize: "2rem" }}>👤</span>}
          title="作者名"
          description="2026-04-26 · 阅读 5 分钟"
        />
      </Card>

      {/* 带操作区的卡片 */}
      <Card
        title="互动卡片"
        actions={[
          <span>👍 128</span>,
          <span>💬 42</span>,
          <span>🔗 分享</span>,
        ]}
      >
        <p>这是一张可以互动的卡片。</p>
      </Card>

      {/* 加载状态 */}
      <Card title="加载中..." loading />

      {/* 卡片网格 */}
      <h4>卡片网格</h4>
      <Card.Grid columns={3} gap={16}>
        {["卡片 1", "卡片 2", "卡片 3", "卡片 4", "卡片 5", "卡片 6"].map(
          (title) => (
            <Card key={title} title={title} hoverable>
              <p>这是 {title} 的内容。</p>
            </Card>
          ),
        )}
      </Card.Grid>
    </div>
  );
}

// ============ 主示例应用 ============

export function ComponentExamples() {
  return (
    <div className="component-examples">
      <h1>可复用组件示例</h1>

      <ButtonExamples />
      <InputExamples />
      <FormExamples />
      <ListExamples />
      <ModalExamples />
      <CardExamples />
      <CombinedExample />
    </div>
  );
}

export default ComponentExamples;
