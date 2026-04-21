# Persona Lab

人格实验室 - 基于大五人格模型的心理测评系统

## 快速开始

### 前置要求

- Node.js >= 18
- Docker & Docker Compose (可选，用于容器化部署)
- MySQL 8.0+
- Redis 7+

### 本地开发

```bash
# 1. 克隆仓库
cd /workspace/persona-lab

# 2. 安装服务端依赖
cd server
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入实际配置

# 4. 启动数据库和 Redis (使用 Docker)
docker-compose up -d mysql redis

# 5. 运行数据库迁移
npx prisma migrate dev

# 6. 启动开发服务器
npm run dev
```

服务将在 http://localhost:3000 启动

## 环境配置

### 必需的环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `NODE_ENV` | 运行环境 | `development` / `production` |
| `PORT` | 服务端口 | `3000` |
| `DATABASE_URL` | MySQL 连接字符串 | `mysql://root:password@localhost:3306/persona_lab` |
| `REDIS_URL` | Redis 连接字符串 | `redis://localhost:6379` |
| `JWT_SECRET` | JWT 访问令牌密钥 | 至少 32 字符 |
| `JWT_REFRESH_SECRET` | JWT 刷新令牌密钥 | 至少 32 字符 |
| `WECHAT_APP_ID` | 微信小程序 AppID | `wx_xxx` |
| `WECHAT_APP_SECRET` | 微信小程序密钥 | `xxx` |
| `WECHAT_MCH_ID` | 微信支付商户号 | `xxx` |
| `WECHAT_API_KEY` | 微信支付 API 密钥 | `xxx` |
| `OPENAI_API_KEY` | LLM API 密钥 (用于报告生成) | `sk-xxx` |

### 配置文件位置

- 开发环境：`server/.env`
- 生产环境：通过 Docker 环境变量或部署平台配置
- 示例配置：`server/.env.example`

## Docker 部署

### 一键部署

```bash
# 1. 设置 MySQL 密码
export MYSQL_PASSWORD=your_secure_password_here

# 2. 启动所有服务
docker-compose up -d

# 3. 查看日志
docker-compose logs -f api

# 4. 停止服务
docker-compose down
```

### 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| `api` | 3000 | Node.js 后端 API |
| `mysql` | 3306 | MySQL 数据库 |
| `redis` | 6379 | Redis 缓存 |

### 生产环境部署

```bash
# 1. 创建 .env 文件
cat > .env << EOF
MYSQL_PASSWORD=your_secure_password_here
EOF

# 2. 构建并启动
docker-compose -f docker-compose.yml up -d --build

# 3. 运行数据库迁移
docker-compose exec api npx prisma migrate deploy
```

## API 接口

### 认证模块 `/api/v1/auth`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/wechat/login` | 微信小程序登录 |
| POST | `/refresh` | 刷新访问令牌 |
| POST | `/logout` | 登出 |
| GET | `/me` | 获取当前用户信息 |

### 测试模块 `/api/v1/tests`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/sessions` | 创建测试会话 |
| GET | `/sessions/:id/next` | 获取下一题 |
| POST | `/sessions/:id/answer` | 提交答案 |
| GET | `/results/:id` | 获取测试结果 |

### 报告模块 `/api/v1/reports`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/` | 生成报告 |
| GET | `/:id` | 获取报告 |
| GET | `/` | 获取报告列表 |

### 支付模块 `/api/v1/payments`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/memberships/products` | 获取会员产品 |
| POST | `/create-order` | 创建订单 |
| POST | `/wechat/callback` | 微信支付回调 |
| GET | `/orders/:id` | 获取订单详情 |

### 会员模块 `/api/v1/memberships`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/products` | 获取会员产品 |
| GET | `/me` | 获取会员状态 |
| POST | `/upgrade` | 升级会员 |
| GET | `/benefits` | 获取会员权益 |

### 健康检查

```bash
curl http://localhost:3000/health
# 响应：{"status":"ok","timestamp":"2026-04-21T15:00:00.000Z"}
```

## 测试账号

### 开发环境测试

```bash
# 使用微信小程序测试账号登录
# 在微信开发者工具中配置测试 AppID

# 测试用户 (需要在数据库中预先创建)
{
  "openid": "test_openid_123456",
  "nickname": "测试用户",
  "avatar_url": null
}
```

### Postman/Insomnia 测试

1. 导入 Postman 集合 (见 `docs/api-collection.json`)
2. 配置环境变量 `base_url` 为 `http://localhost:3000`
3. 先调用登录接口获取 token
4. 后续请求自动携带 Authorization header

### cURL 示例

```bash
# 健康检查
curl http://localhost:3000/health

# 获取会员产品 (公开接口)
curl http://localhost:3000/api/v1/memberships/products

# 登录 (需要微信小程序 code)
curl -X POST http://localhost:3000/api/v1/auth/wechat/login \
  -H "Content-Type: application/json" \
  -d '{"code": "test_code"}'
```

## 项目结构

```
persona-lab/
├── server/
│   ├── src/
│   │   ├── controllers/     # 控制器
│   │   │   ├── auth.ts
│   │   │   ├── tests.ts
│   │   │   ├── reports.ts
│   │   │   ├── payments.ts
│   │   │   └── memberships.ts
│   │   ├── routes/          # 路由
│   │   │   ├── index.ts
│   │   │   ├── auth.ts
│   │   │   ├── tests.ts
│   │   │   ├── reports.ts
│   │   │   ├── payments.ts
│   │   │   └── memberships.ts
│   │   ├── middleware/      # 中间件
│   │   ├── services/        # 业务服务
│   │   ├── security/        # 安全相关
│   │   └── types/           # 类型定义
│   ├── .env.example
│   └── package.json
├── miniapp/                 # 微信小程序
├── docker-compose.yml
└── README.md
```

## 开发指南

### 运行测试

```bash
cd server
npm test
```

### 代码规范

```bash
# 格式化代码
npm run lint:fix

# 类型检查
npm run type-check
```

### 数据库操作

```bash
# 生成 Prisma 客户端
npx prisma generate

# 创建迁移
npx prisma migrate dev --name init

# 查看数据库
npx prisma studio
```

## 常见问题

### Q: 无法连接数据库？
A: 确保 MySQL 和 Redis 容器已启动：`docker-compose ps`

### Q: 登录失败？
A: 检查微信小程序 AppID 和 Secret 配置是否正确

### Q: 支付回调不生效？
A: 确保回调 URL 可公网访问，开发环境可使用 ngrok 内网穿透

## License

MIT © Persona Lab
