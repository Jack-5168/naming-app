# PWA/离线优先 专项训练 (19:00)

## 项目：OfflineNotes — 离线可用的笔记 PWA

一个完整的离线优先 PWA 应用，涵盖 Service Worker、Cache API、IndexedDB 三大核心技术。

### 核心特性
- ✅ 完全离线可用（无网络时完整功能）
- ✅ Service Worker 缓存策略（Cache-First / Network-First / Stale-While-Revalidate）
- ✅ IndexedDB 本地数据持久化
- ✅ Background Sync 离线操作队列
- ✅ Web App Manifest（可安装）
- ✅ 在线/离线状态检测与 UI 反馈

### 文件结构
```
pwa-offline-1900/
├── index.html          # 主页面
├── manifest.json       # Web App Manifest
├── sw.js               # Service Worker
├── db.js               # IndexedDB 封装
├── app.js              # 应用逻辑
├── styles.css          # 样式
├── icons/              # PWA 图标
│   ├── icon-192.png
│   └── icon-512.png
└── README.md           # 本文件
```

### 技术栈
- **Service Worker**: 资源缓存、离线回退、后台同步
- **Cache API**: 静态资源缓存、API 响应缓存
- **IndexedDB**: 笔记数据本地存储、离线操作队列
- **Web App Manifest**: 可安装性配置

### 运行方式
```bash
cd training/pwa-offline-1900
npx serve . -p 3000
# 访问 http://localhost:3000
```

> ⚠️ Service Worker 需要 HTTPS 或 localhost 环境
