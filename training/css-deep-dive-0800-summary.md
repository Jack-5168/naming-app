# CSS 深度专项训练 — 总结

**文件**: `training/css-deep-dive-0800-0428.html` (~73KB, 可直接浏览器打开)

## 覆盖四大主题

### 一、Flexbox (7 个示例)
1. **圣杯布局** — header/nav/main/aside/footer 经典三栏
2. **弹性卡片网格** — flex-wrap + flex:1 1 200px 自适应
3. **响应式导航栏** — justify-content:space-between 分隔
4. **媒体对象** — flex-shrink:0 + flex:1 经典组合模式
5. **等分布局** — flex:1 均分空间
6. **垂直居中** — justify-content + align-items 双管齐下
7. **表单行布局** — label 固定 + input 自适应 + button 固定

### 二、CSS Grid (7 个示例)
8. **Dashboard 布局** — grid-template-areas 声明式布局
9. **自动填充网格** — auto-fill + minmax 响应式卡片
10. **复杂网格** — span 跨行跨列
11. **子网格对齐** — grid-template-rows:auto 1fr auto 卡片对齐
12. **重叠网格** — 多元素放同一区域实现层叠
13. **瀑布流** — CSS columns 模拟 Masonry
14. **隐式网格** — auto-flow:dense 填充空隙

### 三、CSS 动画 (6 个示例)
15. **关键帧动画** — @keyframes spin/bounce/pulse/shake
16. **Transition 过渡** — hover scale/rotate/shape-shift/filter
17. **加载动画** — spinner/bouncing dots/pulse ring/progress bar
18. **文字动画** — 打字机/渐变文字/霓虹闪烁
19. **3D 变换** — 翻转卡片 + 3D 倾斜
20. **复杂动画组合** — 交错入场 animation-delay

### 四、响应式设计 (5 个示例)
21. **媒体查询断点系统** — mobile/tablet/desktop 三档
22. **响应式导航** — 汉堡菜单折叠
23. **响应式图片** — object-fit 控制图片适配
24. **响应式字体** — clamp(min, preferred, max)
25. **容器查询** — @container 组件级响应式

## 3 个复杂布局临摹

| # | 布局 | 技术要点 |
|---|------|---------|
| 1 | 🐙 GitHub 代码仓库页面 | grid-template-areas + 面包屑 + 文件列表 + 侧边栏 |
| 2 | 🛒 电商产品详情页 | 图片画廊 + 规格选择 + 评价区域 + 双栏 grid |
| 3 | 📱 社交媒体信息流 | 三栏布局 + 发帖框 + 动态卡片 + 趋势侧栏 |

## 核心知识点速查

| 主题 | 核心属性 | 最佳场景 |
|------|---------|---------|
| Flexbox | flex-wrap, justify-content, align-items, flex:1 | 一维布局 |
| Grid | grid-template-areas, auto-fill, minmax, span | 二维布局 |
| Transition | transition, ease, cubic-bezier, transform | hover 状态过渡 |
| Animation | @keyframes, animation-delay, steps() | 复杂多帧动画 |
| 响应式 | @media, clamp(), @container | 多设备适配 |

## 累计 CSS 训练
- 4/28 首次实现 (Flexbox/Grid/动画/响应式完整体系 + 3 复杂布局) = 基础体系 ✅
