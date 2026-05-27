# CSS 深度专项训练 v4 — 高级布局与现代 CSS

**日期:** 2026-05-06 08:00  
**专项:** CSS 深度 v4 (Flexbox/Grid/动画/响应式 高级进阶)  
**目标:** 临摹 3 个复杂布局，写 20+ CSS 示例  
**前置:** v1(4/25) ~65KB / v2(4/28) ~73KB / v3(5/5 跳过)

---

## 布局临摹一：现代 Dashboard（Grid 复杂嵌套 + 响应式）

临摹目标：一个包含侧边栏、顶部导航、数据卡片网格、图表区域的完整 Dashboard 布局。

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dashboard v4</title>
    <style>
      /* ========== CSS Reset & Variables ========== */
      *,
      *::before,
      *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      :root {
        --sidebar-width: 260px;
        --sidebar-collapsed: 72px;
        --header-height: 64px;
        --color-bg: #f0f2f5;
        --color-surface: #ffffff;
        --color-primary: #4f46e5;
        --color-primary-light: #e0e7ff;
        --color-text: #1e293b;
        --color-text-secondary: #64748b;
        --color-border: #e2e8f0;
        --color-success: #10b981;
        --color-warning: #f59e0b;
        --color-danger: #ef4444;
        --radius: 12px;
        --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06);
        --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
        --transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      }

      body {
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: var(--color-bg);
        color: var(--color-text);
        line-height: 1.6;
      }

      /* ========== 示例 1: Dashboard 整体 Grid 布局 ========== */
      .dashboard {
        display: grid;
        grid-template-columns: var(--sidebar-width) 1fr;
        grid-template-rows: var(--header-height) 1fr;
        grid-template-areas:
          "sidebar header"
          "sidebar main";
        min-height: 100vh;
        transition: grid-template-columns var(--transition);
      }

      .dashboard.collapsed {
        grid-template-columns: var(--sidebar-collapsed) 1fr;
      }

      /* ========== 示例 2: 侧边栏 — Flexbox 纵向导航 ========== */
      .sidebar {
        grid-area: sidebar;
        background: linear-gradient(180deg, #1e1b4b 0%, #312e81 100%);
        color: #c7d2fe;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: sticky;
        top: 0;
        height: 100vh;
      }

      .sidebar__logo {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 20px;
        height: var(--header-height);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .sidebar__logo-icon {
        width: 32px;
        height: 32px;
        background: var(--color-primary);
        border-radius: 8px;
        flex-shrink: 0;
        display: grid;
        place-items: center;
        color: white;
        font-weight: 700;
        font-size: 14px;
      }

      .sidebar__logo-text {
        font-size: 18px;
        font-weight: 700;
        color: white;
        white-space: nowrap;
        opacity: 1;
        transition: opacity var(--transition);
      }

      .dashboard.collapsed .sidebar__logo-text {
        opacity: 0;
        pointer-events: none;
      }

      .sidebar__nav {
        flex: 1;
        display: flex;
        flex-direction: column;
        padding: 12px 8px;
        gap: 4px;
        overflow-y: auto;
      }

      .sidebar__nav-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 8px;
        cursor: pointer;
        transition: all var(--transition);
        text-decoration: none;
        color: inherit;
        white-space: nowrap;
        position: relative;
      }

      .sidebar__nav-item:hover {
        background: rgba(255, 255, 255, 0.08);
        color: white;
      }

      .sidebar__nav-item.active {
        background: rgba(79, 70, 229, 0.4);
        color: white;
      }

      /* 活跃指示器 */
      .sidebar__nav-item.active::before {
        content: "";
        position: absolute;
        left: -8px;
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 20px;
        background: var(--color-primary);
        border-radius: 0 3px 3px 0;
      }

      .sidebar__nav-icon {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        display: grid;
        place-items: center;
        font-size: 16px;
      }

      .sidebar__nav-label {
        font-size: 14px;
        transition: opacity var(--transition);
      }

      .dashboard.collapsed .sidebar__nav-label {
        opacity: 0;
        pointer-events: none;
      }

      .sidebar__nav-badge {
        margin-left: auto;
        background: var(--color-danger);
        color: white;
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 10px;
        transition: opacity var(--transition);
      }

      .dashboard.collapsed .sidebar__nav-badge {
        opacity: 0;
      }

      .sidebar__footer {
        padding: 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }

      .sidebar__user {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px;
        border-radius: 8px;
      }

      .sidebar__avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        flex-shrink: 0;
        display: grid;
        place-items: center;
        color: white;
        font-weight: 600;
        font-size: 13px;
      }

      /* ========== 示例 3: 顶部 Header — Flexbox 水平布局 ========== */
      .header {
        grid-area: header;
        background: var(--color-surface);
        border-bottom: 1px solid var(--color-border);
        display: flex;
        align-items: center;
        padding: 0 24px;
        gap: 16px;
        position: sticky;
        top: 0;
        z-index: 10;
      }

      .header__toggle {
        width: 36px;
        height: 36px;
        border: none;
        background: transparent;
        border-radius: 8px;
        cursor: pointer;
        display: grid;
        place-items: center;
        font-size: 18px;
        transition: background var(--transition);
      }

      .header__toggle:hover {
        background: var(--color-bg);
      }

      .header__search {
        flex: 1;
        max-width: 400px;
        position: relative;
      }

      .header__search-input {
        width: 100%;
        padding: 8px 16px 8px 36px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        font-size: 14px;
        outline: none;
        transition:
          border-color var(--transition),
          box-shadow var(--transition);
        background: var(--color-bg);
      }

      .header__search-input:focus {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px var(--color-primary-light);
      }

      .header__search-icon {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--color-text-secondary);
        font-size: 14px;
      }

      .header__actions {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-left: auto;
      }

      .header__action-btn {
        width: 36px;
        height: 36px;
        border: none;
        background: transparent;
        border-radius: 8px;
        cursor: pointer;
        display: grid;
        place-items: center;
        font-size: 16px;
        position: relative;
        transition: background var(--transition);
      }

      .header__action-btn:hover {
        background: var(--color-bg);
      }

      .header__notification-dot {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 8px;
        height: 8px;
        background: var(--color-danger);
        border-radius: 50%;
        border: 2px solid var(--color-surface);
      }

      /* ========== 示例 4: 主内容区 — Grid 子布局 ========== */
      .main {
        grid-area: main;
        padding: 24px;
        overflow-y: auto;
      }

      .main__title {
        font-size: 24px;
        font-weight: 700;
        margin-bottom: 4px;
      }

      .main__subtitle {
        color: var(--color-text-secondary);
        font-size: 14px;
        margin-bottom: 24px;
      }

      /* ========== 示例 5: 统计卡片网格 — Auto-fit Grid ========== */
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }

      .stat-card {
        background: var(--color-surface);
        border-radius: var(--radius);
        padding: 20px;
        box-shadow: var(--shadow-sm);
        display: flex;
        align-items: flex-start;
        gap: 16px;
        transition:
          transform var(--transition),
          box-shadow var(--transition);
      }

      .stat-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
      }

      .stat-card__icon {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        font-size: 22px;
        flex-shrink: 0;
      }

      .stat-card__icon--revenue {
        background: #ede9fe;
        color: #7c3aed;
      }

      .stat-card__icon--users {
        background: #dbeafe;
        color: #2563eb;
      }

      .stat-card__icon--orders {
        background: #d1fae5;
        color: #059669;
      }

      .stat-card__icon--conversion {
        background: #fef3c7;
        color: #d97706;
      }

      .stat-card__info {
        flex: 1;
        min-width: 0;
      }

      .stat-card__label {
        font-size: 13px;
        color: var(--color-text-secondary);
        margin-bottom: 4px;
      }

      .stat-card__value {
        font-size: 28px;
        font-weight: 700;
        line-height: 1.2;
      }

      .stat-card__change {
        font-size: 12px;
        font-weight: 600;
        margin-top: 4px;
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 2px 8px;
        border-radius: 6px;
      }

      .stat-card__change--up {
        color: #059669;
        background: #d1fae5;
      }

      .stat-card__change--down {
        color: #dc2626;
        background: #fee2e2;
      }

      /* ========== 示例 6: 内容区域 Grid — 不对称双栏 ========== */
      .content-grid {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 16px;
        margin-bottom: 24px;
      }

      .content-card {
        background: var(--color-surface);
        border-radius: var(--radius);
        padding: 20px;
        box-shadow: var(--shadow-sm);
      }

      .content-card__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
      }

      .content-card__title {
        font-size: 16px;
        font-weight: 600;
      }

      .content-card__action {
        font-size: 13px;
        color: var(--color-primary);
        cursor: pointer;
        text-decoration: none;
      }

      /* ========== 示例 7: 表格容器 — 响应式表格 ========== */
      .table-container {
        overflow-x: auto;
        border-radius: 8px;
        border: 1px solid var(--color-border);
      }

      .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }

      .data-table th {
        background: var(--color-bg);
        padding: 12px 16px;
        text-align: left;
        font-weight: 600;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-secondary);
        border-bottom: 1px solid var(--color-border);
        white-space: nowrap;
      }

      .data-table td {
        padding: 12px 16px;
        border-bottom: 1px solid var(--color-border);
      }

      .data-table tr:last-child td {
        border-bottom: none;
      }

      .data-table tr:hover td {
        background: #f8fafc;
      }

      /* ========== 示例 8: 状态标签 — 小组件 ========== */
      .badge {
        display: inline-flex;
        align-items: center;
        padding: 3px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        gap: 4px;
      }

      .badge--success {
        background: #d1fae5;
        color: #065f46;
      }
      .badge--warning {
        background: #fef3c7;
        color: #92400e;
      }
      .badge--danger {
        background: #fee2e2;
        color: #991b1b;
      }
      .badge--info {
        background: #dbeafe;
        color: #1e40af;
      }

      .badge__dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      }

      /* ========== 示例 9: 活动列表 — Flexbox 纵向列表 ========== */
      .activity-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .activity-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        position: relative;
      }

      .activity-item:not(:last-child)::after {
        content: "";
        position: absolute;
        left: 17px;
        top: 36px;
        bottom: -12px;
        width: 2px;
        background: var(--color-border);
      }

      .activity-item__dot {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-size: 14px;
        flex-shrink: 0;
        position: relative;
        z-index: 1;
      }

      .activity-item__content {
        flex: 1;
        min-width: 0;
      }

      .activity-item__text {
        font-size: 14px;
        line-height: 1.5;
      }

      .activity-item__text strong {
        font-weight: 600;
      }

      .activity-item__time {
        font-size: 12px;
        color: var(--color-text-secondary);
        margin-top: 2px;
      }

      /* ========== 示例 10: 图表占位 — CSS 柱状图 ========== */
      .chart-placeholder {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        height: 200px;
        padding: 16px 0;
      }

      .chart-bar {
        flex: 1;
        border-radius: 6px 6px 0 0;
        transition: height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        position: relative;
        cursor: pointer;
        min-width: 0;
      }

      .chart-bar:hover {
        opacity: 0.85;
        filter: brightness(1.1);
      }

      .chart-bar::after {
        content: attr(data-value);
        position: absolute;
        top: -22px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 11px;
        font-weight: 600;
        color: var(--color-text-secondary);
        opacity: 0;
        transition: opacity var(--transition);
      }

      .chart-bar:hover::after {
        opacity: 1;
      }

      .chart-labels {
        display: flex;
        gap: 8px;
        margin-top: 8px;
      }

      .chart-labels span {
        flex: 1;
        text-align: center;
        font-size: 11px;
        color: var(--color-text-secondary);
      }

      /* ========== 示例 11: 进度条组件 ========== */
      .progress-bar {
        width: 100%;
        height: 8px;
        background: var(--color-bg);
        border-radius: 4px;
        overflow: hidden;
      }

      .progress-bar__fill {
        height: 100%;
        border-radius: 4px;
        transition: width 1s ease;
      }

      .progress-bar__fill--purple {
        background: linear-gradient(90deg, #7c3aed, #a78bfa);
      }
      .progress-bar__fill--blue {
        background: linear-gradient(90deg, #2563eb, #60a5fa);
      }
      .progress-bar__fill--green {
        background: linear-gradient(90deg, #059669, #34d399);
      }

      /* ========== 示例 12: 响应式断点 ========== */
      @media (max-width: 1024px) {
        .content-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 768px) {
        :root {
          --sidebar-width: 0px;
        }

        .dashboard {
          grid-template-columns: 1fr;
          grid-template-areas:
            "header"
            "main";
        }

        .sidebar {
          position: fixed;
          left: 0;
          top: 0;
          width: 260px;
          transform: translateX(-100%);
          z-index: 100;
          transition: transform var(--transition);
        }

        .sidebar.open {
          transform: translateX(0);
        }

        .stats-grid {
          grid-template-columns: 1fr 1fr;
        }

        .main {
          padding: 16px;
        }
      }

      @media (max-width: 480px) {
        .stats-grid {
          grid-template-columns: 1fr;
        }

        .header__search {
          display: none;
        }
      }

      /* ========== 示例 13: 动画 — 卡片入场 ========== */
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .stat-card {
        animation: slideUp 0.5s ease both;
      }

      .stat-card:nth-child(1) {
        animation-delay: 0.05s;
      }
      .stat-card:nth-child(2) {
        animation-delay: 0.1s;
      }
      .stat-card:nth-child(3) {
        animation-delay: 0.15s;
      }
      .stat-card:nth-child(4) {
        animation-delay: 0.2s;
      }

      /* ========== 示例 14: 骨架屏动画 ========== */
      @keyframes shimmer {
        0% {
          background-position: -200% 0;
        }
        100% {
          background-position: 200% 0;
        }
      }

      .skeleton {
        background: linear-gradient(
          90deg,
          #f1f5f9 25%,
          #e2e8f0 50%,
          #f1f5f9 75%
        );
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        border-radius: 6px;
      }

      /* ========== 示例 15: 脉冲通知点 ========== */
      @keyframes pulse {
        0%,
        100% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(1.5);
          opacity: 0.5;
        }
      }

      .header__notification-dot {
        animation: pulse 2s infinite;
      }

      /* ========== 示例 16: 滚动条美化 ========== */
      .main::-webkit-scrollbar {
        width: 6px;
      }

      .main::-webkit-scrollbar-track {
        background: transparent;
      }

      .main::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
      }

      .main::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
    </style>
  </head>
  <body>
    <div class="dashboard" id="dashboard">
      <!-- Sidebar -->
      <aside class="sidebar" id="sidebar">
        <div class="sidebar__logo">
          <div class="sidebar__logo-icon">D</div>
          <span class="sidebar__logo-text">DataBoard</span>
        </div>
        <nav class="sidebar__nav">
          <a class="sidebar__nav-item active" href="#">
            <span class="sidebar__nav-icon">📊</span>
            <span class="sidebar__nav-label">仪表盘</span>
          </a>
          <a class="sidebar__nav-item" href="#">
            <span class="sidebar__nav-icon">📈</span>
            <span class="sidebar__nav-label">分析</span>
          </a>
          <a class="sidebar__nav-item" href="#">
            <span class="sidebar__nav-icon">👥</span>
            <span class="sidebar__nav-label">用户</span>
            <span class="sidebar__nav-badge">12</span>
          </a>
          <a class="sidebar__nav-item" href="#">
            <span class="sidebar__nav-icon">📦</span>
            <span class="sidebar__nav-label">订单</span>
          </a>
          <a class="sidebar__nav-item" href="#">
            <span class="sidebar__nav-icon">💰</span>
            <span class="sidebar__nav-label">财务</span>
          </a>
          <a class="sidebar__nav-item" href="#">
            <span class="sidebar__nav-icon">⚙️</span>
            <span class="sidebar__nav-label">设置</span>
          </a>
        </nav>
        <div class="sidebar__footer">
          <div class="sidebar__user">
            <div class="sidebar__avatar">L</div>
            <div>
              <div style="font-size:13px;font-weight:600;color:white;">
                娄总
              </div>
              <div style="font-size:11px;opacity:0.6;">Admin</div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Header -->
      <header class="header">
        <button
          class="header__toggle"
          onclick="document.getElementById('dashboard').classList.toggle('collapsed')"
        >
          ☰
        </button>
        <div class="header__search">
          <span class="header__search-icon">🔍</span>
          <input
            class="header__search-input"
            type="text"
            placeholder="搜索..."
          />
        </div>
        <div class="header__actions">
          <button class="header__action-btn">
            🔔<span class="header__notification-dot"></span>
          </button>
          <button class="header__action-btn">💬</button>
        </div>
      </header>

      <!-- Main Content -->
      <main class="main">
        <h1 class="main__title">仪表盘</h1>
        <p class="main__subtitle">欢迎回来，娄总。以下是今日数据概览。</p>

        <!-- Stats Grid -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-card__icon stat-card__icon--revenue">💰</div>
            <div class="stat-card__info">
              <div class="stat-card__label">总收入</div>
              <div class="stat-card__value">¥128,430</div>
              <span class="stat-card__change stat-card__change--up"
                >↑ 12.5%</span
              >
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card__icon stat-card__icon--users">👥</div>
            <div class="stat-card__info">
              <div class="stat-card__label">活跃用户</div>
              <div class="stat-card__value">8,249</div>
              <span class="stat-card__change stat-card__change--up"
                >↑ 8.2%</span
              >
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card__icon stat-card__icon--orders">📦</div>
            <div class="stat-card__info">
              <div class="stat-card__label">新订单</div>
              <div class="stat-card__value">1,423</div>
              <span class="stat-card__change stat-card__change--down"
                >↓ 3.1%</span
              >
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card__icon stat-card__icon--conversion">🎯</div>
            <div class="stat-card__info">
              <div class="stat-card__label">转化率</div>
              <div class="stat-card__value">3.24%</div>
              <span class="stat-card__change stat-card__change--up"
                >↑ 0.8%</span
              >
            </div>
          </div>
        </div>

        <!-- Content Grid: Chart + Activity -->
        <div class="content-grid">
          <div class="content-card">
            <div class="content-card__header">
              <h3 class="content-card__title">月度收入趋势</h3>
              <a class="content-card__action">查看详情 →</a>
            </div>
            <div class="chart-placeholder">
              <div
                class="chart-bar"
                style="height:45%;background:linear-gradient(180deg,#818cf8,#4f46e5);"
                data-value="45K"
              ></div>
              <div
                class="chart-bar"
                style="height:62%;background:linear-gradient(180deg,#818cf8,#4f46e5);"
                data-value="62K"
              ></div>
              <div
                class="chart-bar"
                style="height:38%;background:linear-gradient(180deg,#818cf8,#4f46e5);"
                data-value="38K"
              ></div>
              <div
                class="chart-bar"
                style="height:75%;background:linear-gradient(180deg,#818cf8,#4f46e5);"
                data-value="75K"
              ></div>
              <div
                class="chart-bar"
                style="height:55%;background:linear-gradient(180deg,#818cf8,#4f46e5);"
                data-value="55K"
              ></div>
              <div
                class="chart-bar"
                style="height:88%;background:linear-gradient(180deg,#818cf8,#4f46e5);"
                data-value="88K"
              ></div>
              <div
                class="chart-bar"
                style="height:70%;background:linear-gradient(180deg,#818cf8,#4f46e5);"
                data-value="70K"
              ></div>
              <div
                class="chart-bar"
                style="height:92%;background:linear-gradient(180deg,#818cf8,#4f46e5);"
                data-value="92K"
              ></div>
              <div
                class="chart-bar"
                style="height:65%;background:linear-gradient(180deg,#818cf8,#4f46e5);"
                data-value="65K"
              ></div>
              <div
                class="chart-bar"
                style="height:80%;background:linear-gradient(180deg,#818cf8,#4f46e5);"
                data-value="80K"
              ></div>
              <div
                class="chart-bar"
                style="height:72%;background:linear-gradient(180deg,#818cf8,#4f46e5);"
                data-value="72K"
              ></div>
              <div
                class="chart-bar"
                style="height:95%;background:linear-gradient(180deg,#818cf8,#4f46e5);"
                data-value="128K"
              ></div>
            </div>
            <div class="chart-labels">
              <span>1月</span><span>2月</span><span>3月</span><span>4月</span>
              <span>5月</span><span>6月</span><span>7月</span><span>8月</span>
              <span>9月</span><span>10月</span><span>11月</span
              ><span>12月</span>
            </div>
          </div>

          <div class="content-card">
            <div class="content-card__header">
              <h3 class="content-card__title">最近活动</h3>
              <a class="content-card__action">全部 →</a>
            </div>
            <div class="activity-list">
              <div class="activity-item">
                <div
                  class="activity-item__dot"
                  style="background:#dbeafe;color:#2563eb;"
                >
                  👤
                </div>
                <div class="activity-item__content">
                  <div class="activity-item__text">
                    <strong>张三</strong> 注册了新账号
                  </div>
                  <div class="activity-item__time">2 分钟前</div>
                </div>
              </div>
              <div class="activity-item">
                <div
                  class="activity-item__dot"
                  style="background:#d1fae5;color:#059669;"
                >
                  💰
                </div>
                <div class="activity-item__content">
                  <div class="activity-item__text">
                    <strong>¥2,340</strong> 订单已支付
                  </div>
                  <div class="activity-item__time">15 分钟前</div>
                </div>
              </div>
              <div class="activity-item">
                <div
                  class="activity-item__dot"
                  style="background:#fef3c7;color:#d97706;"
                >
                  ⚠️
                </div>
                <div class="activity-item__content">
                  <div class="activity-item__text">
                    服务器 CPU 使用率超过 <strong>85%</strong>
                  </div>
                  <div class="activity-item__time">1 小时前</div>
                </div>
              </div>
              <div class="activity-item">
                <div
                  class="activity-item__dot"
                  style="background:#ede9fe;color:#7c3aed;"
                >
                  📦
                </div>
                <div class="activity-item__content">
                  <div class="activity-item__text">
                    <strong>12</strong> 个新订单待发货
                  </div>
                  <div class="activity-item__time">3 小时前</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Data Table -->
        <div class="content-card">
          <div class="content-card__header">
            <h3 class="content-card__title">最近订单</h3>
            <a class="content-card__action">查看全部 →</a>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>订单号</th>
                  <th>客户</th>
                  <th>金额</th>
                  <th>状态</th>
                  <th>日期</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>#ORD-2841</td>
                  <td>李明</td>
                  <td>¥1,299</td>
                  <td>
                    <span class="badge badge--success"
                      ><span class="badge__dot"></span>已完成</span
                    >
                  </td>
                  <td>2026-05-06</td>
                </tr>
                <tr>
                  <td>#ORD-2840</td>
                  <td>王芳</td>
                  <td>¥856</td>
                  <td>
                    <span class="badge badge--warning"
                      ><span class="badge__dot"></span>处理中</span
                    >
                  </td>
                  <td>2026-05-05</td>
                </tr>
                <tr>
                  <td>#ORD-2839</td>
                  <td>赵强</td>
                  <td>¥3,420</td>
                  <td>
                    <span class="badge badge--info"
                      ><span class="badge__dot"></span>已发货</span
                    >
                  </td>
                  <td>2026-05-05</td>
                </tr>
                <tr>
                  <td>#ORD-2838</td>
                  <td>孙丽</td>
                  <td>¥567</td>
                  <td>
                    <span class="badge badge--danger"
                      ><span class="badge__dot"></span>已取消</span
                    >
                  </td>
                  <td>2026-05-04</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  </body>
</html>
```

**布局临摹一要点总结:**

- **Grid 整体架构**: `grid-template-areas` 定义 sidebar/header/main 三区域
- **Flexbox 导航**: sidebar 纵向 flex + 折叠动画 (opacity transition)
- **Auto-fit Grid**: `repeat(auto-fit, minmax(240px, 1fr))` 响应式卡片
- **CSS 变量**: 16 个 design token，一键换主题
- **3 个动画**: slideUp 入场 / shimmer 骨架屏 / pulse 通知点
- **3 个断点**: 1024px / 768px / 480px 渐进响应式

---

## 布局临摹二：电商产品详情页（Flexbox 复杂嵌套 + CSS 动画）

临摹目标：一个完整的电商产品详情页，包含图片画廊、规格选择、加入购物车、评价列表。

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>产品详情页 v4</title>
    <style>
      *,
      *::before,
      *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      :root {
        --max-width: 1200px;
        --color-primary: #e11d48;
        --color-primary-dark: #be123c;
        --color-accent: #f97316;
        --color-bg: #fafafa;
        --color-surface: #ffffff;
        --color-text: #18181b;
        --color-text-secondary: #71717a;
        --color-border: #e4e4e7;
        --color-star: #facc15;
        --radius: 8px;
        --shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }

      body {
        font-family:
          -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
        background: var(--color-bg);
        color: var(--color-text);
        line-height: 1.6;
      }

      /* ========== 示例 17: 面包屑导航 — Flexbox ========== */
      .breadcrumb {
        max-width: var(--max-width);
        margin: 0 auto;
        padding: 16px 24px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--color-text-secondary);
        flex-wrap: wrap;
      }

      .breadcrumb a {
        color: var(--color-text-secondary);
        text-decoration: none;
        transition: color 0.2s;
      }

      .breadcrumb a:hover {
        color: var(--color-text);
      }
      .breadcrumb__sep {
        opacity: 0.4;
      }
      .breadcrumb__current {
        color: var(--color-text);
        font-weight: 500;
      }

      /* ========== 示例 18: 产品主区域 — Grid 双栏 ========== */
      .product-page {
        max-width: var(--max-width);
        margin: 0 auto;
        padding: 0 24px 48px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 48px;
      }

      /* ========== 示例 19: 图片画廊 — Grid + 缩略图 Flexbox ========== */
      .gallery {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .gallery__main {
        aspect-ratio: 1 / 1;
        background: linear-gradient(135deg, #f8fafc, #e2e8f0);
        border-radius: 12px;
        display: grid;
        place-items: center;
        font-size: 120px;
        position: relative;
        overflow: hidden;
        cursor: zoom-in;
      }

      .gallery__badge {
        position: absolute;
        top: 16px;
        left: 16px;
        background: var(--color-primary);
        color: white;
        padding: 4px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 700;
      }

      .gallery__thumbs {
        display: flex;
        gap: 8px;
      }

      .gallery__thumb {
        width: 72px;
        height: 72px;
        border-radius: 8px;
        background: var(--color-surface);
        border: 2px solid transparent;
        display: grid;
        place-items: center;
        font-size: 28px;
        cursor: pointer;
        transition:
          border-color 0.2s,
          transform 0.2s;
      }

      .gallery__thumb:hover {
        transform: translateY(-2px);
      }

      .gallery__thumb.active {
        border-color: var(--color-primary);
      }

      /* ========== 示例 20: 产品信息区 — Flexbox 纵向 ========== */
      .product-info {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .product-info__brand {
        font-size: 13px;
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        font-weight: 600;
      }

      .product-info__title {
        font-size: 28px;
        font-weight: 700;
        line-height: 1.3;
      }

      .product-info__rating {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .product-info__stars {
        display: flex;
        gap: 2px;
        color: var(--color-star);
        font-size: 16px;
      }

      .product-info__rating-text {
        font-size: 14px;
        color: var(--color-text-secondary);
      }

      .product-info__price-block {
        display: flex;
        align-items: baseline;
        gap: 12px;
        flex-wrap: wrap;
      }

      .product-info__price {
        font-size: 36px;
        font-weight: 800;
        color: var(--color-primary);
      }

      .product-info__price-original {
        font-size: 18px;
        color: var(--color-text-secondary);
        text-decoration: line-through;
      }

      .product-info__discount {
        background: #fef2f2;
        color: var(--color-primary);
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 700;
      }

      .product-info__desc {
        font-size: 14px;
        color: var(--color-text-secondary);
        line-height: 1.7;
      }

      /* ========== 示例 21: 规格选择 — Grid + Flexbox ========== */
      .spec-section {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .spec-section__label {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 4px;
      }

      .spec-options {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .spec-option {
        padding: 8px 16px;
        border: 1.5px solid var(--color-border);
        border-radius: 8px;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
        background: var(--color-surface);
        user-select: none;
      }

      .spec-option:hover {
        border-color: #a1a1aa;
      }

      .spec-option.selected {
        border-color: var(--color-primary);
        background: #fff1f2;
        color: var(--color-primary);
        font-weight: 600;
      }

      /* 颜色选择 */
      .spec-option--color {
        width: 36px;
        height: 36px;
        padding: 0;
        border-radius: 50%;
        border: 2px solid var(--color-border);
        position: relative;
      }

      .spec-option--color.selected {
        border-color: var(--color-primary);
        border-width: 3px;
      }

      .spec-option--color.selected::after {
        content: "✓";
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        color: white;
        font-size: 14px;
        font-weight: 700;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
      }

      /* ========== 示例 22: 数量选择器 — Flexbox ========== */
      .quantity-selector {
        display: inline-flex;
        align-items: center;
        border: 1.5px solid var(--color-border);
        border-radius: 8px;
        overflow: hidden;
      }

      .quantity-selector__btn {
        width: 40px;
        height: 40px;
        border: none;
        background: transparent;
        font-size: 18px;
        cursor: pointer;
        display: grid;
        place-items: center;
        transition: background 0.2s;
      }

      .quantity-selector__btn:hover {
        background: var(--color-bg);
      }

      .quantity-selector__value {
        width: 48px;
        text-align: center;
        font-size: 15px;
        font-weight: 600;
        border-left: 1px solid var(--color-border);
        border-right: 1px solid var(--color-border);
        height: 40px;
        line-height: 40px;
      }

      /* ========== 示例 23: 操作按钮组 — Flexbox ========== */
      .product-actions {
        display: flex;
        gap: 12px;
      }

      .btn {
        flex: 1;
        padding: 14px 24px;
        border: none;
        border-radius: 10px;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .btn--primary {
        background: linear-gradient(
          135deg,
          var(--color-primary),
          var(--color-primary-dark)
        );
        color: white;
        box-shadow: 0 4px 14px rgba(225, 29, 72, 0.3);
      }

      .btn--primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(225, 29, 72, 0.4);
      }

      .btn--primary:active {
        transform: translateY(0);
      }

      .btn--secondary {
        background: var(--color-surface);
        color: var(--color-text);
        border: 1.5px solid var(--color-border);
        flex: 0 0 52px;
      }

      .btn--secondary:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }

      /* ========== 示例 24: 评价列表 — 嵌套 Grid ========== */
      .reviews-section {
        max-width: var(--max-width);
        margin: 0 auto;
        padding: 0 24px 48px;
      }

      .reviews-section__title {
        font-size: 22px;
        font-weight: 700;
        margin-bottom: 24px;
      }

      .reviews-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
        gap: 16px;
      }

      .review-card {
        background: var(--color-surface);
        border-radius: 12px;
        padding: 20px;
        box-shadow: var(--shadow);
        transition:
          transform 0.2s,
          box-shadow 0.2s;
      }

      .review-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      .review-card__header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }

      .review-card__avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-weight: 700;
        font-size: 15px;
        color: white;
        flex-shrink: 0;
      }

      .review-card__user-info {
        flex: 1;
        min-width: 0;
      }

      .review-card__name {
        font-size: 14px;
        font-weight: 600;
      }

      .review-card__date {
        font-size: 12px;
        color: var(--color-text-secondary);
      }

      .review-card__stars {
        color: var(--color-star);
        font-size: 14px;
        display: flex;
        gap: 1px;
      }

      .review-card__text {
        font-size: 14px;
        line-height: 1.6;
        color: var(--color-text-secondary);
      }

      .review-card__images {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }

      .review-card__img {
        width: 64px;
        height: 64px;
        border-radius: 6px;
        background: var(--color-bg);
        display: grid;
        place-items: center;
        font-size: 24px;
      }

      /* ========== 示例 25: 动画 — 加入购物车弹跳 ========== */
      @keyframes bounce {
        0%,
        100% {
          transform: scale(1);
        }
        25% {
          transform: scale(0.9);
        }
        50% {
          transform: scale(1.05);
        }
        75% {
          transform: scale(0.97);
        }
      }

      .btn--primary:active {
        animation: bounce 0.4s ease;
      }

      /* ========== 示例 26: 动画 — 价格闪烁 ========== */
      @keyframes priceFlash {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.6;
        }
      }

      .product-info__price {
        animation: priceFlash 2s ease-in-out infinite;
      }

      /* ========== 示例 27: 动画 — 图片画廊淡入 ========== */
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      .gallery__main {
        animation: fadeIn 0.5s ease both;
      }

      /* ========== 示例 28: 响应式 ========== */
      @media (max-width: 768px) {
        .product-page {
          grid-template-columns: 1fr;
          gap: 24px;
        }

        .product-info__title {
          font-size: 22px;
        }

        .product-info__price {
          font-size: 28px;
        }

        .reviews-grid {
          grid-template-columns: 1fr;
        }

        .product-actions {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 12px 16px;
          background: var(--color-surface);
          border-top: 1px solid var(--color-border);
          z-index: 10;
          box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05);
        }
      }

      @media (max-width: 480px) {
        .gallery__thumb {
          width: 56px;
          height: 56px;
        }

        .spec-option {
          padding: 6px 12px;
          font-size: 12px;
        }
      }
    </style>
  </head>
  <body>
    <!-- Breadcrumb -->
    <nav class="breadcrumb">
      <a href="#">首页</a>
      <span class="breadcrumb__sep">›</span>
      <a href="#">电子产品</a>
      <span class="breadcrumb__sep">›</span>
      <a href="#">耳机</a>
      <span class="breadcrumb__sep">›</span>
      <span class="breadcrumb__current">ProSound X1 无线降噪耳机</span>
    </nav>

    <!-- Product Page -->
    <div class="product-page">
      <!-- Gallery -->
      <div class="gallery">
        <div class="gallery__main">
          🎧
          <span class="gallery__badge">-30%</span>
        </div>
        <div class="gallery__thumbs">
          <div class="gallery__thumb active">🎧</div>
          <div class="gallery__thumb">📦</div>
          <div class="gallery__thumb">🔌</div>
          <div class="gallery__thumb">👂</div>
        </div>
      </div>

      <!-- Product Info -->
      <div class="product-info">
        <div class="product-info__brand">ProSound</div>
        <h1 class="product-info__title">
          ProSound X1 无线降噪耳机 — 旗舰级主动降噪
        </h1>

        <div class="product-info__rating">
          <div class="product-info__stars">★★★★★</div>
          <span class="product-info__rating-text">4.8 (2,847 评价)</span>
        </div>

        <div class="product-info__price-block">
          <span class="product-info__price">¥1,399</span>
          <span class="product-info__price-original">¥1,999</span>
          <span class="product-info__discount">省 ¥600</span>
        </div>

        <p class="product-info__desc">
          40dB 深度主动降噪，40 小时超长续航，Hi-Res 高解析音频认证。 搭载自研
          A1 降噪芯片，智能感知环境噪音，自适应调节降噪强度。
        </p>

        <!-- Color Selection -->
        <div class="spec-section">
          <div class="spec-section__label">颜色</div>
          <div class="spec-options">
            <div
              class="spec-option spec-option--color selected"
              style="background:#18181b;"
            ></div>
            <div
              class="spec-option spec-option--color"
              style="background:#f5f5f4;"
            ></div>
            <div
              class="spec-option spec-option--color"
              style="background:#1e3a5f;"
            ></div>
            <div
              class="spec-option spec-option--color"
              style="background:#7c2d12;"
            ></div>
          </div>
        </div>

        <!-- Size Selection -->
        <div class="spec-section">
          <div class="spec-section__label">版本</div>
          <div class="spec-options">
            <div class="spec-option">标准版</div>
            <div class="spec-option selected">旗舰版 (+¥200)</div>
            <div class="spec-option">限量联名版 (+¥500)</div>
          </div>
        </div>

        <!-- Quantity -->
        <div class="spec-section">
          <div class="spec-section__label">数量</div>
          <div class="quantity-selector">
            <button class="quantity-selector__btn">−</button>
            <div class="quantity-selector__value">1</div>
            <button class="quantity-selector__btn">+</button>
          </div>
        </div>

        <!-- Actions -->
        <div class="product-actions">
          <button class="btn btn--primary">🛒 加入购物车</button>
          <button class="btn btn--secondary">♡</button>
        </div>
      </div>
    </div>

    <!-- Reviews -->
    <section class="reviews-section">
      <h2 class="reviews-section__title">用户评价 (2,847)</h2>
      <div class="reviews-grid">
        <div class="review-card">
          <div class="review-card__header">
            <div
              class="review-card__avatar"
              style="background:linear-gradient(135deg,#6366f1,#8b5cf6);"
            >
              张
            </div>
            <div class="review-card__user-info">
              <div class="review-card__name">张明远</div>
              <div class="review-card__date">2026-05-03</div>
            </div>
            <div class="review-card__stars">★★★★★</div>
          </div>
          <p class="review-card__text">
            降噪效果非常棒！在地铁上几乎听不到任何噪音。音质也很清晰，低音浑厚，高音通透。续航实测
            38 小时，非常满意。
          </p>
          <div class="review-card__images">
            <div class="review-card__img">📷</div>
            <div class="review-card__img">📷</div>
          </div>
        </div>
        <div class="review-card">
          <div class="review-card__header">
            <div
              class="review-card__avatar"
              style="background:linear-gradient(135deg,#ec4899,#f43f5e);"
            >
              李
            </div>
            <div class="review-card__user-info">
              <div class="review-card__name">李思琪</div>
              <div class="review-card__date">2026-05-01</div>
            </div>
            <div class="review-card__stars">★★★★☆</div>
          </div>
          <p class="review-card__text">
            佩戴舒适度不错，戴了 3 个小时耳朵也不疼。ANC
            模式切换很智能，但通透模式还有提升空间。
          </p>
        </div>
        <div class="review-card">
          <div class="review-card__header">
            <div
              class="review-card__avatar"
              style="background:linear-gradient(135deg,#14b8a6,#06b6d4);"
            >
              王
            </div>
            <div class="review-card__user-info">
              <div class="review-card__name">王浩然</div>
              <div class="review-card__date">2026-04-28</div>
            </div>
            <div class="review-card__stars">★★★★★</div>
          </div>
          <p class="review-card__text">
            作为音乐制作人，对音质要求很高。这款耳机的 Hi-Res
            认证不是噱头，细节还原度很高。联名版包装也很精美。
          </p>
          <div class="review-card__images">
            <div class="review-card__img">📷</div>
          </div>
        </div>
      </div>
    </section>
  </body>
</html>
```

**布局临摹二要点总结:**

- **Grid 双栏**: 产品图 + 信息区并排，移动端堆叠
- **Flexbox 纵向**: 产品信息区 8 个区块垂直排列
- **规格选择器**: 颜色圆点 (radio 行为) + 文字选项 (toggle 行为)
- **数量选择器**: inline-flex 三栏等宽
- **固定底部 CTA**: 移动端 `position: fixed` 吸底
- **3 个动画**: bounce 按钮 / priceFlash 价格 / fadeIn 画廊

---

## 布局临摹三：社交媒体信息流（Grid Masonry + 动画）

临摹目标：一个类似 Pinterest/Instagram 的社交媒体信息流，包含瀑布流布局、故事栏、发帖框、互动组件。

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>社交媒体信息流 v4</title>
    <style>
      *,
      *::before,
      *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      :root {
        --max-width: 680px;
        --color-primary: #6366f1;
        --color-bg: #f8fafc;
        --color-surface: #ffffff;
        --color-text: #0f172a;
        --color-text-secondary: #64748b;
        --color-border: #e2e8f0;
        --color-like: #ef4444;
        --color-comment: #3b82f6;
        --color-share: #10b981;
        --radius: 16px;
        --shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      }

      body {
        font-family:
          -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
        background: var(--color-bg);
        color: var(--color-text);
        line-height: 1.6;
      }

      /* ========== 示例 29: 顶部导航 — Flexbox ========== */
      .top-nav {
        position: sticky;
        top: 0;
        z-index: 50;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-bottom: 1px solid var(--color-border);
        padding: 0 16px;
      }

      .top-nav__inner {
        max-width: var(--max-width);
        margin: 0 auto;
        display: flex;
        align-items: center;
        height: 56px;
        gap: 12px;
      }

      .top-nav__logo {
        font-size: 22px;
        font-weight: 800;
        background: linear-gradient(135deg, #6366f1, #ec4899);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .top-nav__search {
        flex: 1;
        max-width: 280px;
        padding: 8px 16px;
        border: 1px solid var(--color-border);
        border-radius: 20px;
        font-size: 14px;
        outline: none;
        background: var(--color-bg);
        transition:
          border-color 0.2s,
          box-shadow 0.2s;
      }

      .top-nav__search:focus {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
      }

      .top-nav__actions {
        display: flex;
        gap: 4px;
        margin-left: auto;
      }

      .top-nav__action {
        width: 36px;
        height: 36px;
        border: none;
        background: transparent;
        border-radius: 50%;
        cursor: pointer;
        font-size: 18px;
        display: grid;
        place-items: center;
        transition: background 0.2s;
      }

      .top-nav__action:hover {
        background: var(--color-bg);
      }

      /* ========== 示例 30: 故事栏 — Flexbox 横向滚动 ========== */
      .stories {
        max-width: var(--max-width);
        margin: 16px auto;
        padding: 0 16px;
      }

      .stories__list {
        display: flex;
        gap: 16px;
        overflow-x: auto;
        padding: 8px 0;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      .stories__list::-webkit-scrollbar {
        display: none;
      }

      .story-item {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        cursor: pointer;
      }

      .story-item__ring {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        padding: 3px;
        background: linear-gradient(135deg, #f97316, #ec4899, #6366f1);
        transition: transform 0.2s;
      }

      .story-item:hover .story-item__ring {
        transform: scale(1.08);
      }

      .story-item__avatar {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        border: 3px solid white;
        display: grid;
        place-items: center;
        font-size: 24px;
        background: var(--color-bg);
      }

      .story-item__name {
        font-size: 11px;
        color: var(--color-text-secondary);
        max-width: 64px;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* ========== 示例 31: 发帖框 — Flexbox ========== */
      .compose {
        max-width: var(--max-width);
        margin: 0 auto 16px;
        padding: 0 16px;
      }

      .compose__card {
        background: var(--color-surface);
        border-radius: var(--radius);
        padding: 16px;
        box-shadow: var(--shadow);
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }

      .compose__avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        display: grid;
        place-items: center;
        color: white;
        font-weight: 700;
        font-size: 15px;
        flex-shrink: 0;
      }

      .compose__input-area {
        flex: 1;
        min-width: 0;
      }

      .compose__input {
        width: 100%;
        border: none;
        outline: none;
        font-size: 15px;
        resize: none;
        line-height: 1.5;
        min-height: 48px;
        font-family: inherit;
      }

      .compose__input::placeholder {
        color: var(--color-text-secondary);
      }

      .compose__actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--color-border);
      }

      .compose__media-btns {
        display: flex;
        gap: 4px;
      }

      .compose__media-btn {
        padding: 6px 10px;
        border: none;
        background: transparent;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
        transition: background 0.2s;
      }

      .compose__media-btn:hover {
        background: var(--color-bg);
      }

      .compose__submit {
        padding: 8px 20px;
        background: var(--color-primary);
        color: white;
        border: none;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .compose__submit:hover {
        background: #4f46e5;
        transform: translateY(-1px);
      }

      /* ========== 示例 32: 信息流 — CSS Grid Masonry 模拟 ========== */
      .feed {
        max-width: var(--max-width);
        margin: 0 auto;
        padding: 0 16px 80px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      /* ========== 示例 33: 帖子卡片 — 嵌套 Flexbox/Grid ========== */
      .post-card {
        background: var(--color-surface);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        overflow: hidden;
        transition: transform 0.2s;
      }

      .post-card:hover {
        transform: translateY(-1px);
      }

      .post-card__header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 16px;
      }

      .post-card__avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-size: 14px;
        font-weight: 700;
        color: white;
        flex-shrink: 0;
      }

      .post-card__user-info {
        flex: 1;
        min-width: 0;
      }

      .post-card__name {
        font-size: 14px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .post-card__verified {
        color: var(--color-primary);
        font-size: 14px;
      }

      .post-card__meta {
        font-size: 12px;
        color: var(--color-text-secondary);
      }

      .post-card__more {
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
        display: grid;
        place-items: center;
        transition: background 0.2s;
      }

      .post-card__more:hover {
        background: var(--color-bg);
      }

      .post-card__content {
        padding: 0 16px 12px;
        font-size: 15px;
        line-height: 1.6;
      }

      .post-card__content .hashtag {
        color: var(--color-primary);
        font-weight: 500;
        cursor: pointer;
      }

      .post-card__image {
        width: 100%;
        aspect-ratio: 4/3;
        display: grid;
        place-items: center;
        font-size: 64px;
        position: relative;
      }

      .post-card__image--tall {
        aspect-ratio: 3/4;
      }

      .post-card__image--wide {
        aspect-ratio: 16/9;
      }

      .post-card__image-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 16px;
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.5));
        color: white;
        font-size: 14px;
      }

      /* 多图布局 */
      .post-card__images {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2px;
      }

      .post-card__images--3 {
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
      }

      .post-card__images--3 .post-card__img:first-child {
        grid-row: 1 / 3;
      }

      .post-card__img {
        aspect-ratio: 1;
        display: grid;
        place-items: center;
        font-size: 40px;
        background: var(--color-bg);
        cursor: pointer;
        transition: opacity 0.2s;
      }

      .post-card__img:hover {
        opacity: 0.9;
      }

      /* ========== 示例 34: 互动栏 — Flexbox ========== */
      .post-card__actions {
        display: flex;
        align-items: center;
        padding: 8px 16px;
        gap: 4px;
      }

      .post-action {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        border: none;
        background: transparent;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        color: var(--color-text-secondary);
        transition: all 0.2s;
      }

      .post-action:hover {
        background: var(--color-bg);
      }

      .post-action--like:hover,
      .post-action--like.liked {
        color: var(--color-like);
      }

      .post-action--like.liked {
        animation: likePop 0.3s ease;
      }

      .post-action--comment:hover {
        color: var(--color-comment);
      }
      .post-action--share:hover {
        color: var(--color-share);
      }

      .post-action__icon {
        font-size: 18px;
      }

      /* ========== 示例 35: 动画 — 点赞弹跳 ========== */
      @keyframes likePop {
        0% {
          transform: scale(1);
        }
        25% {
          transform: scale(1.3);
        }
        50% {
          transform: scale(0.95);
        }
        100% {
          transform: scale(1);
        }
      }

      /* ========== 示例 36: 动画 — 新帖子滑入 ========== */
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(16px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .post-card {
        animation: slideIn 0.4s ease both;
      }

      .post-card:nth-child(1) {
        animation-delay: 0s;
      }
      .post-card:nth-child(2) {
        animation-delay: 0.05s;
      }
      .post-card:nth-child(3) {
        animation-delay: 0.1s;
      }
      .post-card:nth-child(4) {
        animation-delay: 0.15s;
      }
      .post-card:nth-child(5) {
        animation-delay: 0.2s;
      }

      /* ========== 示例 37: 动画 — 故事环旋转 ========== */
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .story-item__ring {
        animation: spin 8s linear infinite;
        animation-play-state: paused;
      }

      .story-item:hover .story-item__ring {
        animation-play-state: running;
      }

      /* ========== 示例 38: 动画 — 浮动按钮弹跳 ========== */
      @keyframes float {
        0%,
        100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-6px);
        }
      }

      .fab {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
        border: none;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
        display: grid;
        place-items: center;
        animation: float 3s ease-in-out infinite;
        transition: transform 0.2s;
        z-index: 40;
      }

      .fab:hover {
        animation-play-state: paused;
        transform: scale(1.1);
      }

      /* ========== 示例 39: 标签云 — Flexbox 自动换行 ========== */
      .tag-cloud {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 16px;
      }

      .tag {
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 13px;
        background: var(--color-bg);
        color: var(--color-text-secondary);
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid transparent;
      }

      .tag:hover {
        background: var(--color-primary-light);
        color: var(--color-primary);
        border-color: var(--color-primary);
      }

      /* ========== 示例 40: 响应式 ========== */
      @media (max-width: 480px) {
        .top-nav__search {
          display: none;
        }

        .stories__list {
          gap: 12px;
        }

        .story-item__ring {
          width: 56px;
          height: 56px;
        }

        .post-card__content {
          font-size: 14px;
        }
      }
    </style>
  </head>
  <body>
    <!-- Top Navigation -->
    <nav class="top-nav">
      <div class="top-nav__inner">
        <div class="top-nav__logo">SocialFlow</div>
        <input class="top-nav__search" type="text" placeholder="搜索..." />
        <div class="top-nav__actions">
          <button class="top-nav__action">🔔</button>
          <button class="top-nav__action">💬</button>
        </div>
      </div>
    </nav>

    <!-- Stories -->
    <div class="stories">
      <div class="stories__list">
        <div class="story-item">
          <div class="story-item__ring">
            <div class="story-item__avatar">🌟</div>
          </div>
          <span class="story-item__name">你的故事</span>
        </div>
        <div class="story-item">
          <div class="story-item__ring">
            <div class="story-item__avatar">🎨</div>
          </div>
          <span class="story-item__name">设计灵感</span>
        </div>
        <div class="story-item">
          <div class="story-item__ring">
            <div class="story-item__avatar">📸</div>
          </div>
          <span class="story-item__name">摄影集</span>
        </div>
        <div class="story-item">
          <div class="story-item__ring">
            <div class="story-item__avatar">🍜</div>
          </div>
          <span class="story-item__name">美食日记</span>
        </div>
        <div class="story-item">
          <div class="story-item__ring">
            <div class="story-item__avatar">✈️</div>
          </div>
          <span class="story-item__name">旅行记</span>
        </div>
        <div class="story-item">
          <div class="story-item__ring">
            <div class="story-item__avatar">💻</div>
          </div>
          <span class="story-item__name">技术圈</span>
        </div>
        <div class="story-item">
          <div class="story-item__ring">
            <div class="story-item__avatar">🎵</div>
          </div>
          <span class="story-item__name">音乐人</span>
        </div>
      </div>
    </div>

    <!-- Compose -->
    <div class="compose">
      <div class="compose__card">
        <div class="compose__avatar">L</div>
        <div class="compose__input-area">
          <textarea
            class="compose__input"
            placeholder="分享你的想法..."
          ></textarea>
          <div class="compose__actions">
            <div class="compose__media-btns">
              <button class="compose__media-btn">📷</button>
              <button class="compose__media-btn">🎥</button>
              <button class="compose__media-btn">😊</button>
              <button class="compose__media-btn">📍</button>
            </div>
            <button class="compose__submit">发布</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Feed -->
    <div class="feed">
      <!-- Post 1: Text + Image -->
      <article class="post-card">
        <div class="post-card__header">
          <div
            class="post-card__avatar"
            style="background:linear-gradient(135deg,#6366f1,#8b5cf6);"
          >
            陈
          </div>
          <div class="post-card__user-info">
            <div class="post-card__name">
              陈思远 <span class="post-card__verified">✓</span>
            </div>
            <div class="post-card__meta">UI 设计师 · 2 小时前</div>
          </div>
          <button class="post-card__more">⋯</button>
        </div>
        <div class="post-card__content">
          今天分享一组新的设计系统配色方案 🎨<br />
          使用了 CSS 变量 + HSL 色彩空间，实现一键切换暗色模式。<span
            class="hashtag"
            >#设计系统</span
          >
          <span class="hashtag">#CSS</span>
        </div>
        <div
          class="post-card__image"
          style="background:linear-gradient(135deg,#667eea,#764ba2);"
        >
          🎨
          <div class="post-card__image-overlay">
            Design System v3.0 — 24 色板
          </div>
        </div>
        <div class="post-card__actions">
          <button class="post-action post-action--like">
            <span class="post-action__icon">♡</span> 248
          </button>
          <button class="post-action post-action--comment">
            <span class="post-action__icon">💬</span> 32
          </button>
          <button class="post-action post-action--share">
            <span class="post-action__icon">↗</span> 15
          </button>
        </div>
      </article>

      <!-- Post 2: Multi-image -->
      <article class="post-card">
        <div class="post-card__header">
          <div
            class="post-card__avatar"
            style="background:linear-gradient(135deg,#ec4899,#f43f5e);"
          >
            林
          </div>
          <div class="post-card__user-info">
            <div class="post-card__name">林小雨</div>
            <div class="post-card__meta">摄影师 · 5 小时前</div>
          </div>
          <button class="post-card__more">⋯</button>
        </div>
        <div class="post-card__content">
          周末去了一趟莫干山，拍了一组秋天 ☀️🍂
        </div>
        <div class="post-card__images post-card__images--3">
          <div
            class="post-card__img"
            style="background:linear-gradient(135deg,#f97316,#ef4444);"
          >
            🏔️
          </div>
          <div
            class="post-card__img"
            style="background:linear-gradient(135deg,#84cc16,#22c55e);"
          >
            🌿
          </div>
          <div
            class="post-card__img"
            style="background:linear-gradient(135deg,#facc15,#f97316);"
          >
            🍂
          </div>
        </div>
        <div class="post-card__actions">
          <button class="post-action post-action--like liked">
            <span class="post-action__icon">❤️</span> 567
          </button>
          <button class="post-action post-action--comment">
            <span class="post-action__icon">💬</span> 89
          </button>
          <button class="post-action post-action--share">
            <span class="post-action__icon">↗</span> 42
          </button>
        </div>
      </article>

      <!-- Post 3: Text only -->
      <article class="post-card">
        <div class="post-card__header">
          <div
            class="post-card__avatar"
            style="background:linear-gradient(135deg,#14b8a6,#06b6d4);"
          >
            周
          </div>
          <div class="post-card__user-info">
            <div class="post-card__name">
              周明哲 <span class="post-card__verified">✓</span>
            </div>
            <div class="post-card__meta">前端工程师 · 8 小时前</div>
          </div>
          <button class="post-card__more">⋯</button>
        </div>
        <div class="post-card__content">
          CSS Grid 的
          <code
            style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:13px;"
            >subgrid</code
          >
          终于被所有主流浏览器支持了！<br /><br />
          这意味着嵌套 Grid
          可以继承父级的轨道定义，再也不用手动对齐了。布局系统的终极形态 🚀<br /><br />
          <span class="hashtag">#CSS</span> <span class="hashtag">#前端</span>
          <span class="hashtag">#WebDev</span>
        </div>
        <div class="post-card__actions">
          <button class="post-action post-action--like">
            <span class="post-action__icon">♡</span> 1.2K
          </button>
          <button class="post-action post-action--comment">
            <span class="post-action__icon">💬</span> 156
          </button>
          <button class="post-action post-action--share">
            <span class="post-action__icon">↗</span> 89
          </button>
        </div>
      </article>

      <!-- Post 4: Tall image -->
      <article class="post-card">
        <div class="post-card__header">
          <div
            class="post-card__avatar"
            style="background:linear-gradient(135deg,#f59e0b,#d97706);"
          >
            吴
          </div>
          <div class="post-card__user-info">
            <div class="post-card__name">吴晓燕</div>
            <div class="post-card__meta">美食博主 · 昨天</div>
          </div>
          <button class="post-card__more">⋯</button>
        </div>
        <div class="post-card__content">
          新学的法式甜点 🥐 酥皮层次分明，内馅丝滑～
        </div>
        <div
          class="post-card__image post-card__image--tall"
          style="background:linear-gradient(135deg,#fef3c7,#fde68a);"
        >
          🥐
        </div>
        <div class="post-card__actions">
          <button class="post-action post-action--like">
            <span class="post-action__icon">♡</span> 834
          </button>
          <button class="post-action post-action--comment">
            <span class="post-action__icon">💬</span> 67
          </button>
          <button class="post-action post-action--share">
            <span class="post-action__icon">↗</span> 28
          </button>
        </div>
      </article>

      <!-- Post 5: With tag cloud -->
      <article class="post-card">
        <div class="post-card__header">
          <div
            class="post-card__avatar"
            style="background:linear-gradient(135deg,#8b5cf6,#6d28d9);"
          >
            社
          </div>
          <div class="post-card__user-info">
            <div class="post-card__name">热门话题</div>
            <div class="post-card__meta">系统推荐 · 置顶</div>
          </div>
        </div>
        <div class="post-card__content">本周热门标签 🔥</div>
        <div class="tag-cloud">
          <span class="tag">#CSS技巧</span>
          <span class="tag">#设计灵感</span>
          <span class="tag">#前端框架</span>
          <span class="tag">#AI绘画</span>
          <span class="tag">#摄影</span>
          <span class="tag">#美食</span>
          <span class="tag">#旅行</span>
          <span class="tag">#音乐</span>
          <span class="tag">#读书</span>
          <span class="tag">#健身</span>
          <span class="tag">#游戏</span>
          <span class="tag">#科技</span>
        </div>
        <div class="post-card__actions">
          <button class="post-action post-action--like">
            <span class="post-action__icon">♡</span> 3.5K
          </button>
          <button class="post-action post-action--comment">
            <span class="post-action__icon">💬</span> 234
          </button>
          <button class="post-action post-action--share">
            <span class="post-action__icon">↗</span> 156
          </button>
        </div>
      </article>
    </div>

    <!-- FAB -->
    <button class="fab">✏️</button>
  </body>
</html>
```

**布局临摹三要点总结:**

- **Flexbox 纵向信息流**: 帖子卡片垂直排列，`gap: 16px`
- **故事栏**: Flexbox 横向滚动 + 渐变边框环 (旋转动画)
- **发帖框**: Flexbox 水平 + textarea 自动高度
- **多图 Grid**: `grid-template-columns: 1fr 1fr` + 3 图特殊布局 (第一个跨两行)
- **标签云**: Flexbox `flex-wrap: wrap` 自动换行
- **FAB 浮动按钮**: `position: fixed` + float 动画
- **毛玻璃导航**: `backdrop-filter: blur(12px)`

---

## 核心知识点速查 (v4 新增)

### CSS Grid 高级技巧

| 技巧            | 代码                                   | 说明         |
| --------------- | -------------------------------------- | ------------ |
| Auto-fit 响应式 | `repeat(auto-fit, minmax(240px, 1fr))` | 自动填充列数 |
| 子网格          | `grid-template-columns: subgrid`       | 继承父级轨道 |
| 区域命名        | `grid-template-areas`                  | 语义化布局   |
| 不对称双栏      | `2fr 1fr`                              | 2:1 比例分栏 |
| 跨行跨列        | `grid-row: 1 / 3`                      | 跨越多个轨道 |

### Flexbox 高级技巧

| 技巧         | 代码                                | 说明         |
| ------------ | ----------------------------------- | ------------ |
| 垂直居中     | `display:grid; place-items:center`  | 最简方案     |
| 横向滚动     | `overflow-x:auto` + `flex-shrink:0` | 故事栏       |
| 吸底 CTA     | `position:fixed; bottom:0`          | 移动端操作栏 |
| 自动换行标签 | `flex-wrap:wrap` + `gap`            | 标签云       |
| 折叠侧边栏   | `opacity` + `pointer-events:none`   | 平滑过渡     |

### CSS 动画速查

| 动画    | 用途     | 关键帧                      |
| ------- | -------- | --------------------------- |
| slideUp | 卡片入场 | `translateY(20px) → 0`      |
| shimmer | 骨架屏   | `background-position` 移动  |
| pulse   | 通知点   | `scale(1) → 1.5` + opacity  |
| bounce  | 按钮反馈 | `scale` 弹跳序列            |
| float   | FAB      | `translateY` 上下浮动       |
| spin    | 故事环   | `rotate(0 → 360deg)`        |
| fadeIn  | 图片淡入 | `opacity:0 + scale`         |
| likePop | 点赞     | `scale(1 → 1.3 → 0.95 → 1)` |

### 响应式断点策略

| 断点   | 场景     | 布局变化        |
| ------ | -------- | --------------- |
| 1024px | 平板横屏 | 双栏 → 单栏     |
| 768px  | 平板竖屏 | 侧边栏变抽屉    |
| 480px  | 手机     | 搜索隐藏 / 单列 |

---

## v4 产出统计

| 指标       | 数值                                       |
| ---------- | ------------------------------------------ |
| 布局临摹   | 3 个 (Dashboard / 电商详情页 / 社交信息流) |
| CSS 示例   | 24 个 (示例 1-40，部分合并)                |
| 代码行数   | ~1,200 行                                  |
| 动画数量   | 8 个                                       |
| 响应式断点 | 6 组                                       |
| CSS 变量   | 30+                                        |
| 文档大小   | ~95KB                                      |

---

_CSS 深度 v4 完成 — 从基础布局到复杂交互，覆盖现代 CSS 核心能力_
