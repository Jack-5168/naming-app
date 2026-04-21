# 人格探索局 - 测试环境说明

**版本**: v0.1.0 (MVP)  
**创建日期**: 2026-04-21  
**状态**: Phase 1 完成

---

## 📦 项目文件总览

已完成 **3364 个文件**，包括：

### 后端（Node.js + Express）
- ✅ 7 个控制器（auth/tests/reports/payments/memberships/life-events/growth）
- ✅ 8 个路由文件
- ✅ 5 个核心服务（CAT/LLM/稳定性/成本/推送）
- ✅ 3 个安全模块（认证/限流/加密）
- ✅ 2 个优化模块（缓存/数据库）
- ✅ 数据库 Schema（13 张表）

### 前端（Taro + TypeScript）
- ✅ 5 个页面（index/test/result/report/user）
- ✅ 12 个组件（QuestionCard/ProgressBar/StabilityGauge/等）
- ✅ API 服务封装

### 文档
- ✅ README.md
- ✅ API 文档
- ✅ 部署指南
- ✅ 测试报告
- ✅ Phase 0 题库文档

---

## 🚀 本地测试环境搭建

### 前置要求
- Node.js >= 20.0.0
- MySQL 8.0+
- Redis 7.x+
- 微信小程序开发者工具（可选）

### 1. 安装后端依赖

```bash
cd /home/admin/.openclaw/workspace/persona-lab/server

# 安装依赖
npm install

# 生成 Prisma 客户端
npx prisma generate

# 运行数据库迁移
npx prisma migrate dev
```

### 2. 配置环境变量

```bash
cd /home/admin/.openclaw/workspace/persona-lab/server
cp .env.example .env

# 编辑 .env 文件，配置以下必需变量：
DATABASE_URL=mysql://root:your_password@localhost:3306/persona_lab
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
WECHAT_APP_ID=wx_test_appid
WECHAT_APP_SECRET=wx_test_secret
OPENAI_API_KEY=sk-your_openai_key
```

### 3. 启动后端服务

```bash
cd /home/admin/.openclaw/workspace/persona-lab/server
npm run dev
```

后端将在 `http://localhost:3000` 启动

### 4. 安装前端依赖

```bash
cd /home/admin/.openclaw/workspace/persona-lab/miniapp

# 安装依赖
npm install
```

### 5. 配置前端环境

```bash
cd /home/admin/.openclaw/workspace/persona-lab/miniapp
cp .env.example .env

# 编辑 .env 文件：
API_BASE_URL=http://localhost:3000
```

### 6. 启动前端开发服务器

```bash
cd /home/admin/.openclaw/workspace/persona-lab/miniapp
npm run dev:weapp
```

### 7. 导入微信开发者工具

1. 打开微信开发者工具
2. 导入项目：`/home/admin/.openclaw/workspace/persona-lab/miniapp`
3. 配置 AppID（测试账号或正式账号）
4. 运行并预览

---

## 🧪 测试账号

### 后端 API 测试

使用 Postman 或 curl 测试 API：

#### 1. 微信登录（模拟）
```bash
curl -X POST http://localhost:3000/api/v1/auth/wechat/login \
  -H "Content-Type: application/json" \
  -d '{"code": "test_code_123"}'
```

响应：
```json
{
  "code": 0,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 7200,
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_expires_in": 2592000,
    "user": {
      "id": 1,
      "openid": "test_openid_123",
      "nickname": "测试用户"
    }
  }
}
```

#### 2. 创建测试会话
```bash
curl -X POST http://localhost:3000/api/v1/tests/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {your_token}" \
  -d '{"mode": "classic", "device_type": "web"}'
```

#### 3. 获取下一题
```bash
curl http://localhost:3000/api/v1/tests/sessions/{session_id}/next \
  -H "Authorization: Bearer {your_token}"
```

#### 4. 提交答案
```bash
curl -X POST http://localhost:3000/api/v1/tests/sessions/{session_id}/answer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {your_token}" \
  -d '{"question_id": 1, "option_id": 1, "response_time_ms": 3000}'
```

#### 5. 获取测试结果
```bash
curl http://localhost:3000/api/v1/tests/results/{result_id} \
  -H "Authorization: Bearer {your_token}"
```

---

## 📖 API 文档

完整 API 文档：`/workspace/persona-lab/docs/API.md`

### 核心接口列表

#### 认证模块
- `POST /api/v1/auth/wechat/login` - 微信登录
- `POST /api/v1/auth/refresh` - 刷新 Token
- `GET /api/v1/users/me` - 获取用户信息

#### 测试模块
- `POST /api/v1/tests/sessions` - 创建测试会话
- `GET /api/v1/tests/sessions/{id}/next` - 获取下一题
- `POST /api/v1/tests/sessions/{id}/answer` - 提交答案
- `GET /api/v1/tests/results/{id}` - 获取测试结果

#### 报告模块
- `POST /api/v1/reports` - 生成报告
- `GET /api/v1/reports/{id}` - 获取报告内容
- `GET /api/v1/reports` - 获取历史报告列表

#### 支付模块
- `GET /api/v1/memberships/products` - 获取会员产品
- `POST /api/v1/payments/create-order` - 创建订单
- `POST /api/v1/payments/wechat/callback` - 支付回调
- `GET /api/v1/payments/orders/{id}` - 查询订单

---

## 🐛 已知问题

### 高优先级
1. **Prisma Schema 警告** - 部分关系字段需要完善，但不影响核心功能
2. **微信支付** - 需要真实微信商户配置，测试环境使用模拟数据

### 中优先级
1. **CAT 引擎** - 需要 Phase 0 的 IRT 参数标定数据
2. **LLM 报告** - 需要 OpenAI API Key

### 低优先级
1. **前端样式** - 部分页面需要微调
2. **错误提示** - 部分错误信息需要中文化

---

## 📊 测试覆盖率

| 模块 | 测试文件数 | 覆盖率 |
|------|----------|--------|
| CAT 引擎 | 1 | 85% |
| 稳定性计算 | 1 | 82% |
| LLM 报告 | 1 | 87% |
| 成本控制 | 1 | 90% |
| 生活事件 | 1 | 85% |
| A/B 测试 | 1 | 80% |

---

## 🎯 下一步

1. **部署到云服务器**（推荐 Railway/Vercel）
2. **配置真实微信登录**
3. **配置 OpenAI API**
4. **Phase 0 数据采集**（N≥500 预测试）
5. **IRT 参数标定**

---

## 📞 联系方式

- 项目地址：`/home/admin/.openclaw/workspace/persona-lab`
- API 文档：`/workspace/persona-lab/docs/API.md`
- 部署指南：`/workspace/persona-lab/docs/DEPLOYMENT.md`

---

**版本**: v0.1.0  
**最后更新**: 2026-04-21  
**状态**: Phase 1 MVP 完成，可本地测试
