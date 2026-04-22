# Vercel 部署指南

## 🚀 快速部署（推荐 - 5 分钟完成）

### 方式一：Vercel Web 界面（最简单）

1. **访问** https://vercel.com/new

2. **使用 GitHub 账号登录**
   - 点击 "Continue with GitHub"
   - 授权 Vercel 访问你的 GitHub 仓库

3. **导入仓库**
   - 搜索并选择 `Jack-5168/naming-app`
   - 点击 "Import"

4. **配置项目**
   - **Framework Preset**: Other
   - **Build Command**: `cd server && npm install && npm run build && cd ../miniapp && npm install && npm run build:h5`
   - **Output Directory**: `miniapp/dist`
   - **Install Command**: `cd server && npm install && cd ../miniapp && npm install`

5. **点击 "Deploy"**
   - 等待 3-5 分钟构建完成
   - 获得部署 URL：`https://naming-app-xxx.vercel.app`

6. **配置环境变量**（在 Vercel Dashboard）
   - `DATABASE_URL` - PostgreSQL 连接字符串
   - `JWT_SECRET` - JWT 签名密钥
   - `OPENAI_API_KEY` - OpenAI API Key（用于 AI 报告生成）
   - `NODE_ENV=production`

---

### 方式二：使用 Vercel CLI（需要本地环境）

```bash
# 克隆仓库
git clone https://github.com/Jack-5168/naming-app.git
cd naming-app/persona-lab

# 安装 Vercel CLI
npm install -g vercel

# 登录 Vercel
vercel login

# 部署到生产环境
vercel --prod
```

---

## 📋 部署后配置

### 1. 环境变量配置

在 Vercel Dashboard → Project Settings → Environment Variables 添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | 数据库连接 |
| `JWT_SECRET` | `your-secret-key` | JWT 签名密钥 |
| `OPENAI_API_KEY` | `sk-xxx` | OpenAI API Key |
| `NODE_ENV` | `production` | 生产环境 |

### 2. 数据库迁移

在 Vercel Settings → Deployments 找到最新部署，点击 "View Deployment Details" → "Open in Terminal"，然后执行：

```bash
cd server
npx prisma migrate deploy
npx prisma generate
```

### 3. 自定义域名（可选）

在 Vercel Dashboard → Project Settings → Domains 添加自定义域名。

---

## 🔗 部署后的 URL

- **主页**: `https://naming-app-xxx.vercel.app`
- **答题页**: `https://naming-app-xxx.vercel.app/quiz/`
- **会员页**: `https://naming-app-xxx.vercel.app/membership/`
- **API**: `https://naming-app-xxx.vercel.app/api/`

---

## ⚠️ 常见问题

### Q: 部署失败怎么办？
A: 在 Vercel Dashboard 查看构建日志，常见错误：
- 依赖安装失败 → 检查 package.json
- 编译错误 → 检查 TypeScript 类型
- 环境变量缺失 → 添加必要的环境变量

### Q: API 无法访问？
A: 确保：
- 后端代码在 `server/src/index.ts`
- vercel.json 配置了正确的路由重写
- 环境变量已配置

### Q: 如何更新部署？
A: 每次 push 到 master 分支会自动触发部署（如果配置了 GitHub Actions），或者手动运行 `vercel --prod`

---

## 📞 需要帮助？

- Vercel 文档：https://vercel.com/docs
- 项目文档：`/docs/` 目录
- GitHub Issues: https://github.com/Jack-5168/naming-app/issues

---

**最后更新**: 2026-04-22  
**状态**: ✅ 已准备好部署
