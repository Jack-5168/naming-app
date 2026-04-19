# 文昌赐名 Web 站 V30.0.0

> 专业起名机构官网 - 源自《诗经》《楚辞》《周易》等 20+ 先秦经典

## 🌐 网站架构

### 页面列表
- **首页** (`index.html`) - 品牌展示 + 核心功能入口
- **关于** (`about.html`) - 品牌故事 + 团队介绍
- **服务** (`services.html`) - 服务套餐详情（待创建）
- **典籍** (`classics.html`) - 22 部先秦经典（待创建）
- **案例** (`cases.html`) - 用户成功案例（待创建）
- **起名** (`naming.html`) - 核心起名工具（待迁移）
- **博客** (`blog.html`) - 命名知识科普（待创建）
- **联系** (`contact.html`) - 联系方式（待创建）

### 目录结构
```
web-v2/
├── index.html          # 首页
├── about.html          # 关于页面
├── css/
│   ├── style.css      # 全局共享样式
│   ├── home.css       # 首页专用样式
│   ├── about.css      # 关于页面样式
│   └── ...            # 其他页面样式
├── js/
│   ├── main.js        # 全局共享 JS
│   ├── home.js        # 首页专用 JS
│   └── ...            # 其他页面 JS
└── images/            # 图片资源
```

## 🚀 部署说明

### GitHub Pages 部署

1. **推送到 GitHub**
```bash
cd web-v2
git add .
git commit -m "🎉 Web 站 V30.0.0 架构升级"
git push origin master
```

2. **配置 GitHub Pages**
- 进入仓库 Settings → Pages
- Source 选择 `main` branch
- Folder 选择 `/ (root)`
- Save 保存

3. **访问地址**
- 主站：https://jack-5168.github.io/naming-app/
- 新 Web 站：https://jack-5168.github.io/naming-app/web-v2/

### 本地测试

```bash
# 使用 Python 启动本地服务器
cd web-v2
python -m http.server 8080

# 或使用 Node.js
npx http-server -p 8080
```

访问：http://localhost:8080

## ✨ 核心特性

### Web 站标准架构
- ✅ 多页面结构（符合用户习惯）
- ✅ 统一导航栏（8 个主导航）
- ✅ 响应式设计（移动端适配）
- ✅ 共享资源（CSS/JS复用）
- ✅ SEO 优化（独立 title/meta）

### 品牌展示
- ✅ 品牌故事页面
- ✅ 专业团队介绍
- ✅ 数据统计展示
- ✅ 价值观传达
- ✅ 完整页脚信息

### 用户体验
- ✅ 平滑滚动
- ✅ 回到顶部按钮
- ✅ 移动端汉堡菜单
- ✅ 统计数字动画
- ✅ 社交分享功能

## 📊 与 V29.0.0 对比

| 维度 | V29.0.0 (单页) | V30.0.0 (多页) | 提升 |
|------|----------------|----------------|------|
| 页面数量 | 1 页 | 8 页（规划） | +7 页 |
| 导航结构 | 单页锚点 | 多页导航 | 符合习惯 |
| 品牌展示 | 薄弱 | 完整 | 显著提升 |
| SEO 优化 | 有限 | 每页独立 | 大幅提升 |
| 用户体验 | 工具导向 | 官网体验 | 质的飞跃 |

## 🎯 开发进度

### 已完成 ✅
- [x] 全局样式 (`css/style.css`)
- [x] 首页 (`index.html` + `css/home.css`)
- [x] 关于页面 (`about.html` + `css/about.css`)
- [x] 共享 JS (`js/main.js`)
- [x] 响应式导航
- [x] 移动端适配

### 待开发 🚧
- [ ] 服务页面 (`services.html`)
- [ ] 典籍库页面 (`classics.html`)
- [ ] 案例展示页 (`cases.html`)
- [ ] 起名工具页 (`naming.html`) - 从 V29 迁移
- [ ] 博客列表页 (`blog.html`)
- [ ] 联系页面 (`contact.html`)

## 📝 下一步计划

### 第一周：核心页面
1. 迁移起名工具到 `naming.html`
2. 创建服务套餐页面
3. 创建典籍库页面

### 第二周：内容页面
1. 创建案例展示页
2. 创建博客列表页
3. 创建联系页面

### 第三周：优化上线
1. SEO 优化（sitemap、robots.txt）
2. 性能优化（图片压缩、懒加载）
3. 测试验收
4. 正式上线

## 🔧 技术栈

- **前端**: 纯 HTML5 + CSS3 + JavaScript (ES6+)
- **字体**: Google Fonts (Noto Sans SC, Ma Shan Zheng)
- **部署**: GitHub Pages
- **构建**: 无构建工具（保持简单）

## 📞 联系方式

- **开发团队**: 有财 AI 🧠
- **技术支持**: 娄总
- **项目地址**: https://github.com/Jack-5168/naming-app

---

**版本**: V30.0.0  
**更新日期**: 2026-04-19  
**文档**: `/home/admin/.openclaw/workspace/web-v2/README.md`
