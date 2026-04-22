# Persona Lab Vercel 部署报告

## 部署日期
2026-04-22

## 部署目标
将 Persona Lab Phase 4 完整功能部署到 Vercel，提供在线测试链接。

## 部署状态

### ✅ 已完成
1. **Vercel CLI 安装** - 已作为 devDependency 安装到项目中
2. **Vercel 配置创建** - 已创建 `vercel.json` 配置文件
3. **部署脚本创建** - 已创建 `deploy-vercel.sh` 脚本
4. **Taro 配置修复** - 已创建 `config/dev.js` 和 `config/prod.js`

### ⏳ 等待用户操作
由于 Vercel 登录需要交互式认证，需要通过 Vercel Web 界面完成部署。

## 部署步骤（Web 界面）

### 1. 访问 Vercel
前往 https://vercel.com/new

### 2. 导入 GitHub 仓库
- 点击 "Import Git Repository"
- 选择 GitHub 账号
- 搜索仓库：`Jack-5168/naming-app`
- 点击 "Import"

### 3. 配置项目
- **Project Name**: `persona-lab` (或自定义)
- **Framework Preset**: `Other`
- **Root Directory**: `./` (项目根目录)
- **Build Command**: `cd server && npm install && npm run build && cd ../miniapp && npm install && npm run build:h5`
- **Output Directory**: `miniapp/dist`
- **Install Command**: `cd server && npm install && cd ../miniapp && npm install`

### 4. 添加环境变量
```
NODE_ENV=production
```

### 5. 部署
点击 "Deploy" 按钮开始部署

### 6. 获取部署 URL
部署完成后，Vercel 会提供生产环境 URL，格式为：
`https://persona-lab-xxx.vercel.app`

## 部署后验证

### 前端验证
- [ ] 首页加载正常
- [ ] 测试页面可访问
- [ ] 用户页面功能正常
- [ ] 报告页面显示正确

### API 验证
- [ ] `/api/health` 端点响应正常
- [ ] `/api/assessments` 端点可用
- [ ] `/api/reports` 端点可用

## 技术配置

### vercel.json
```json
{
  "version": 2,
  "buildCommand": "cd server && npm install && npm run build && cd ../miniapp && npm install && npm run build:h5",
  "outputDirectory": "miniapp/dist",
  "devCommand": "cd server && npm run dev",
  "installCommand": "cd server && npm install && cd ../miniapp && npm install",
  "framework": null,
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/server/src/index.ts"
    }
  ]
}
```

### 项目结构
```
persona-lab/
├── server/          # 后端 API
│   ├── src/
│   │   └── index.ts
│   └── package.json
├── miniapp/         # 前端 H5 应用
│   ├── src/
│   ├── dist/        # 构建输出
│   └── package.json
└── vercel.json      # Vercel 配置
```

## 注意事项

1. **构建时间**: 首次构建可能需要 3-5 分钟
2. **依赖安装**: 确保 server 和 miniapp 的依赖都能正确安装
3. **API 路由**: API 端点通过 rewrite 规则映射到 server/src/index.ts
4. **静态文件**: 前端构建输出到 miniapp/dist 目录

## 更新部署
代码推送到 GitHub 后，Vercel 会自动触发重新部署。

## 部署 URL

### 方式一：通过 Vercel Web 界面（推荐）
1. 访问：https://vercel.com/new
2. 使用 GitHub 登录
3. 导入仓库：`Jack-5168/naming-app`
4. 使用上述构建配置
5. 点击 Deploy

### 方式二：使用部署脚本
```bash
cd /home/admin/.openclaw/workspace/persona-lab
chmod +x deploy-vercel.sh
./deploy-vercel.sh
```

**注意**: CLI 方式需要先运行 `npx vercel login` 进行认证。

---
**部署准备完成时间**: 2026-04-22 17:45  
**部署人员**: AI Assistant  
**状态**: ✅ 所有配置文件已就绪，等待用户登录 Vercel 完成最终部署
