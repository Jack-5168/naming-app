# Vercel 部署指南

## 快速部署（推荐）

### 方法一：Vercel Web 界面（最简单）

1. **访问 Vercel**
   - 打开 https://vercel.com/new
   - 使用 GitHub 账号登录

2. **导入仓库**
   - 点击 "Import Git Repository"
   - 选择 GitHub 仓库：`Jack-5168/naming-app`
   - 点击 "Import"

3. **配置构建设置**
   - **Framework Preset**: `Other`
   - **Build Command**: 
     ```bash
     cd server && npm install && npm run build && cd ../miniapp && npm install && npm run build:h5
     ```
   - **Output Directory**: `miniapp/dist`
   - **Install Command**: 
     ```bash
     cd server && npm install && cd ../miniapp && npm install
     ```

4. **添加环境变量**（可选）
   ```
   NODE_ENV=production
   ```

5. **点击 "Deploy"**
   - 等待 3-5 分钟完成构建
   - 部署成功后会显示 URL

6. **获取部署链接**
   - 格式：`https://persona-lab-xxx.vercel.app`
   - 在 Vercel Dashboard 中可以查看

### 方法二：Vercel CLI（适合本地调试）

```bash
# 1. 登录 Vercel
cd /home/admin/.openclaw/workspace/persona-lab
npx vercel login

# 2. 链接项目（首次部署）
npx vercel link --create persona-lab

# 3. 部署到生产环境
npx vercel --prod
```

## 项目配置

### vercel.json
已配置在项目根目录，包含：
- 构建命令
- 输出目录
- API 路由重写规则

### 目录结构
```
persona-lab/
├── server/          # 后端服务
│   ├── src/index.ts
│   └── package.json
├── miniapp/         # 前端应用
│   ├── src/
│   ├── dist/        # 构建输出
│   └── package.json
├── vercel.json      # Vercel 配置
└── docs/
    └── DEPLOYMENT-REPORT.md
```

## 验证部署

### 前端检查
- [ ] 首页正常加载
- [ ] 导航栏可用
- [ ] 测试页面可访问

### API 检查
- [ ] `/api/health` 返回正常
- [ ] API 端点响应正确

## 自动部署
代码推送到 GitHub 的 `main` 分支后，Vercel 会自动重新部署。

## 故障排查

### 构建失败
1. 检查 `server/package.json` 和 `miniapp/package.json` 依赖
2. 查看 Vercel 部署日志
3. 确保构建命令正确

### API 不可用
1. 检查 `vercel.json` 中的 rewrite 规则
2. 确保 `server/src/index.ts` 存在
3. 查看函数日志

## 联系支持
如有问题，请查看 Vercel 文档：https://vercel.com/docs
