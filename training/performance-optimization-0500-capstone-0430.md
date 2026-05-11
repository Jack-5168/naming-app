# Web 性能优化 — Phase 1 终章：性能审计框架 + 端到端优化案例 (2026-04-30 05:00)

**前置基础：**
- 4/24 基础版：懒加载 / 防抖节流 / 内存管理 / 虚拟列表
- 4/25 进阶版：CRP / Web Vitals / 重排优化 / 网络层
- 4/26 综合实战：三合一整合 — 高性能数据看板
- 4/27 回顾巩固：查漏补缺 + SSR/Canvas/SW 扩展
- 4/28 生产级 Toolkit：八大模块 (~1600 行)
- 4/29 实战优化模式：真实场景 + 反模式 + 性能对比

**本次定位：** Phase 1 性能优化终章 — 不是重复，而是**升华**
- 构建完整的性能审计框架（可复用的审计工具链）
- 端到端优化案例：从一个真实烂项目到高性能项目的完整改造
- 性能预算 (Performance Budget) 体系
- 性能回归检测自动化
- Phase 1 性能优化知识图谱总结

---

## 一、性能审计框架 — 从"凭感觉"到"有数据"

### 1.1 性能审计全景图

```
┌─────────────────────────────────────────────────────────────┐
│                    性能审计全景图                             │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  加载性能     │  渲染性能     │  运行时性能   │  内存性能      │
├──────────────┼──────────────┼──────────────┼────────────────┤
│ • LCP        │ • FID/INP    │ • 帧率        │ • 堆内存       │
│ • FCP        │ • CLS        │ • 重排次数    │ • 事件监听器   │
│ • TTFB       │ • 首次绘制    │ • 任务耗时    │ • 闭包泄漏     │
│ • SI         │ • 合成层数    │ • 长任务      │ • DOM 引用     │
│ • TTI        │ • 绘制面积    │ • 网络请求    │ • 缓存命中率   │
├──────────────┴──────────────┴──────────────┴────────────────┤
│  工具链: Lighthouse / WebPageTest / Chrome DevTools / PSI   │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 性能审计工具类 — 一键生成审计报告

```javascript
/**
 * PerformanceAuditor — 一站式性能审计工具
 * 
 * 功能：
 * - 自动收集 Core Web Vitals
 * - 检测常见性能反模式
 * - 生成优化建议报告
 * - 支持性能预算检查
 * - 输出结构化 JSON 报告
 * 
 * 使用方式：
 *   const auditor = new PerformanceAuditor();
 *   const report = await auditor.audit();
 *   console.log(report.summary);
 *   console.log(report.issues);
 *   console.log(report.recommendations);
 */
class PerformanceAuditor {
  constructor(options = {}) {
    this.options = {
      budget: options.budget || {
        lcp: 2500,           // ms — 最大 LCP
        fid: 100,            // ms — 最大 FID
        cls: 0.1,            // 最大 CLS
        ttfb: 600,           // ms — 最大 TTFB
        totalSize: 1700000,  // bytes — 总资源大小 (1.7MB)
        maxRequests: 50,     // 最大请求数
        maxDOMNodes: 1500,   // 最大 DOM 节点数
        maxStylesheets: 4,   // 最大样式表数
        maxScripts: 6,       // 最大脚本数
        minFPS: 55,          // 最低帧率
        maxHeapSize: 50 * 1024 * 1024, // 50MB 最大堆
      },
      includeScreenshots: options.includeScreenshots ?? false,
      auditDuration: options.auditDuration || 10000, // ms — 运行时审计时长
    };

    this.issues = [];
    this.recommendations = [];
    this.metrics = {};
  }

  /**
   * 执行完整审计
   */
  async audit() {
    console.group('🔍 性能审计开始');

    // 1. 收集指标
    this.metrics = {
      ...this._collectNavigationMetrics(),
      ...this._collectPaintMetrics(),
      ...this._collectResourceMetrics(),
      ...this._collectDOMMetrics(),
      ...this._collectRuntimeMetrics(),
    };

    // 2. 检测反模式
    this._detectAntiPatterns();

    // 3. 检查性能预算
    this._checkBudget();

    // 4. 生成建议
    this._generateRecommendations();

    console.groupEnd();

    return {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      summary: this._buildSummary(),
      metrics: this.metrics,
      issues: this.issues,
      recommendations: this.recommendations,
      score: this._calculateScore(),
    };
  }

  // ─── 指标收集 ───

  _collectNavigationMetrics() {
    const nav = performance.getEntriesByType('navigation')[0];
    if (!nav) return {};

    return {
      ttfb: nav.responseStart - nav.requestStart,
      domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
      loadComplete: nav.loadEventEnd - nav.startTime,
      redirectTime: nav.redirectEnd - nav.redirectStart,
      dnsTime: nav.domainLookupEnd - nav.domainLookupStart,
      tcpTime: nav.connectEnd - nav.connectStart,
      tlsTime: nav.connectEnd - nav.secureConnectionStart,
      serverTime: nav.responseStart - nav.requestStart,
      downloadTime: nav.responseEnd - nav.responseStart,
      domProcessingTime: nav.domComplete - nav.domInteractive,
      type: nav.type, // navigate, reload, back_forward, prune
    };
  }

  _collectPaintMetrics() {
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find(e => e.name === 'first-contentful-paint');

    // LCP (需 PerformanceObserver)
    let lcp = null;
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          lcp = entries[entries.length - 1]?.startTime || null;
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
        observer.disconnect();
      } catch (e) { /* LCP not supported */ }
    }

    // INP (Interaction to Next Paint)
    let inp = null;
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          // 取最长交互作为 INP 近似值
          inp = Math.max(...entries.map(e => e.duration));
        });
        observer.observe({ type: 'interaction', buffered: true });
        observer.disconnect();
      } catch (e) { /* INP not supported */ }
    }

    // CLS (Cumulative Layout Shift)
    let cls = 0;
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            if (!entry.hadRecentInput) cls += entry.value;
          });
        });
        observer.observe({ type: 'layout-shift', buffered: true });
        observer.disconnect();
      } catch (e) { /* CLS not supported */ }
    }

    return {
      fcp: fcp?.startTime || null,
      lcp,
      inp,
      cls,
    };
  }

  _collectResourceMetrics() {
    const resources = performance.getEntriesByType('resource');
    const sizes = resources.map(r => r.transferSize || 0);
    const durations = resources.map(r => r.duration);

    return {
      totalResources: resources.length,
      totalTransferSize: sizes.reduce((a, b) => a + b, 0),
      totalDecodedSize: resources.reduce((a, r) => a + (r.decodedBodySize || 0), 0),
      avgResourceSize: sizes.length ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 0,
      maxResourceDuration: durations.length ? Math.max(...durations) : 0,
      slowResources: resources.filter(r => r.duration > 1000).map(r => ({
        name: r.name,
        duration: Math.round(r.duration),
        size: r.transferSize || 0,
      })),
      resourceTypes: this._groupByType(resources),
    };
  }

  _groupByType(resources) {
    const groups = {};
    resources.forEach(r => {
      const type = r.initiatorType || 'other';
      if (!groups[type]) groups[type] = { count: 0, totalSize: 0 };
      groups[type].count++;
      groups[type].totalSize += r.transferSize || 0;
    });
    return groups;
  }

  _collectDOMMetrics() {
    const allElements = document.querySelectorAll('*');
    const depth = this._maxDOMDepth(document.documentElement);

    // 检测隐藏的 DOM 节点
    let hiddenNodes = 0;
    allElements.forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') hiddenNodes++;
    });

    // 检测内联样式
    let inlineStyles = 0;
    allElements.forEach(el => { if (el.getAttribute('style')) inlineStyles++; });

    // 检测未懒加载的图片
    const images = document.querySelectorAll('img:not([loading="lazy"])');
    const aboveFoldImages = [];
    images.forEach(img => {
      const rect = img.getBoundingClientRect();
      if (rect.top < window.innerHeight) aboveFoldImages.push(img.src);
    });

    return {
      totalNodes: allElements.length,
      maxDepth: depth,
      hiddenNodes,
      inlineStyles,
      unlazyImages: images.length,
      aboveFoldImages: aboveFoldImages.length,
    };
  }

  _maxDOMDepth(node, current = 0) {
    if (!node.children || node.children.length === 0) return current;
    return Math.max(...Array.from(node.children).map(
      child => this._maxDOMDepth(child, current + 1)
    ));
  }

  _collectRuntimeMetrics() {
    const memory = performance.memory || {};
    const longTasks = performance.getEntriesByType('longtask') || [];

    return {
      heapSizeLimit: memory.jsHeapSizeLimit,
      totalHeapSize: memory.totalJSHeapSize,
      usedHeapSize: memory.usedJSHeapSize,
      heapUsagePercent: memory.usedJSHeapSize && memory.jsHeapSizeLimit
        ? (memory.usedJSHeapSize / memory.jsHeapSizeLimit * 100).toFixed(1)
        : null,
      longTaskCount: longTasks.length,
      longTaskTotalDuration: longTasks.reduce((a, t) => a + t.duration, 0),
      eventListeners: this._estimateEventListeners(),
    };
  }

  _estimateEventListeners() {
    // 近似估算：通过遍历所有元素检查常见事件属性
    const allElements = document.querySelectorAll('*');
    let count = 0;
    const eventAttrs = ['onclick', 'onchange', 'oninput', 'onkeydown', 'onkeyup',
      'onmousedown', 'onmouseup', 'onmouseover', 'onmouseout', 'onfocus', 'onblur'];
    allElements.forEach(el => {
      eventAttrs.forEach(attr => {
        if (el.getAttribute(attr)) count++;
      });
    });
    return count;
  }

  // ─── 反模式检测 ───

  _detectAntiPatterns() {
    // 1. 检测 Layout Thrashing
    this._detectLayoutThrashing();

    // 2. 检测内存泄漏
    this._detectMemoryLeaks();

    // 3. 检测未优化的图片
    this._detectUnoptimizedImages();

    // 4. 检测阻塞渲染的资源
    this._detectRenderBlockingResources();

    // 5. 检测过大的 DOM
    this._detectDOMIssues();

    // 6. 检测未压缩/未缓存的资源
    this._detectResourceIssues();

    // 7. 检测长任务
    this._detectLongTasks();

    // 8. 检测不必要的重排/重绘
    this._detectRepaintIssues();
  }

  _detectLayoutThrashing() {
    // 检测内联样式频繁修改
    const elementsWithInlineStyles = document.querySelectorAll('[style]');
    if (elementsWithInlineStyles.length > 50) {
      this.issues.push({
        type: 'anti-pattern',
        severity: 'warning',
        category: 'rendering',
        title: '大量内联样式可能导致 Layout Thrashing',
        detail: `发现 ${elementsWithInlineStyles.length} 个元素使用内联样式`,
        impact: '频繁的读写交替会触发多次重排',
        fix: '使用 CSS 类替代内联样式，或批量修改后一次性触发重排',
      });
    }
  }

  _detectMemoryLeaks() {
    const memory = performance.memory;
    if (memory && memory.usedJSHeapSize > 30 * 1024 * 1024) {
      this.issues.push({
        type: 'anti-pattern',
        severity: 'critical',
        category: 'memory',
        title: 'JS 堆内存使用过高',
        detail: `已使用 ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB / 限制 ${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(0)}MB`,
        impact: '可能导致页面卡顿或崩溃',
        fix: '检查闭包引用、定时器、事件监听器泄漏',
      });
    }

    // 检测 detached DOM 节点（通过检查大量隐藏元素）
    const hiddenElements = document.querySelectorAll('[style*="display: none"], [hidden]');
    if (hiddenElements.length > 100) {
      this.issues.push({
        type: 'anti-pattern',
        severity: 'warning',
        category: 'memory',
        title: '大量隐藏 DOM 节点可能未正确清理',
        detail: `发现 ${hiddenElements.length} 个隐藏元素`,
        impact: '隐藏的 DOM 节点仍占用内存',
        fix: '使用 documentFragment 或及时 remove() 不需要的节点',
      });
    }
  }

  _detectUnoptimizedImages() {
    const images = document.querySelectorAll('img');
    const issues = [];

    images.forEach(img => {
      const rect = img.getBoundingClientRect();
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;
      const displayW = Math.round(rect.width);
      const displayH = Math.round(rect.height);

      // 检测图片尺寸远大于显示尺寸
      if (naturalW > displayW * 2 && displayW > 0) {
        issues.push({
          src: img.src,
          natural: `${naturalW}×${naturalH}`,
          display: `${displayW}×${displayH}`,
          waste: Math.round((1 - displayW / naturalW) * 100) + '%',
        });
      }

      // 检测未使用 lazy loading 的下方图片
      if (!img.hasAttribute('loading') && rect.top > window.innerHeight) {
        issues.push({
          src: img.src,
          issue: 'below-fold without lazy loading',
        });
      }
    });

    if (issues.length > 0) {
      this.issues.push({
        type: 'anti-pattern',
        severity: 'warning',
        category: 'loading',
        title: '图片未优化',
        detail: `发现 ${issues.length} 个未优化的图片`,
        examples: issues.slice(0, 5),
        impact: '浪费带宽和内存，增加加载时间',
        fix: '使用响应式图片 (srcset) + lazy loading + WebP 格式',
      });
    }
  }

  _detectRenderBlockingResources() {
    const resources = performance.getEntriesByType('resource');
    const blockingCSS = resources.filter(r =>
      r.initiatorType === 'link' && r.name.endsWith('.css') && r.duration > 500
    );

    const blockingJS = resources.filter(r =>
      r.initiatorType === 'script' && !r.name.includes('async') && !r.name.includes('defer')
    );

    if (blockingCSS.length > 0) {
      this.issues.push({
        type: 'anti-pattern',
        severity: 'warning',
        category: 'loading',
        title: '存在阻塞渲染的 CSS 资源',
        detail: `${blockingCSS.length} 个 CSS 文件加载时间 > 500ms`,
        impact: '阻塞首次内容绘制 (FCP)',
        fix: '内联关键 CSS，异步加载非关键 CSS',
      });
    }
  }

  _detectDOMIssues() {
    const totalNodes = document.querySelectorAll('*').length;
    if (totalNodes > 1500) {
      this.issues.push({
        type: 'anti-pattern',
        severity: 'warning',
        category: 'rendering',
        title: 'DOM 节点数过多',
        detail: `共 ${totalNodes} 个节点 (建议 < 1500)`,
        impact: '增加内存占用，减慢 DOM 操作和渲染',
        fix: '使用虚拟列表 / 懒加载组件 / 减少嵌套',
      });
    }

    const depth = this._maxDOMDepth(document.documentElement);
    if (depth > 15) {
      this.issues.push({
        type: 'anti-pattern',
        severity: 'info',
        category: 'rendering',
        title: 'DOM 嵌套过深',
        detail: `最大深度 ${depth} 层 (建议 < 15)`,
        impact: 'CSS 选择器匹配变慢，影响渲染性能',
        fix: '扁平化 DOM 结构，使用 CSS Grid/Flexbox 减少嵌套',
      });
    }
  }

  _detectResourceIssues() {
    const resources = performance.getEntriesByType('resource');
    const uncached = resources.filter(r => {
      const cacheControl = r.responseStatus === 200 && !r.transferSize;
      return r.transferSize > 0 && r.encodedBodySize === 0;
    });

    const largeResources = resources.filter(r => (r.transferSize || 0) > 500000);
    if (largeResources.length > 0) {
      this.issues.push({
        type: 'anti-pattern',
        severity: 'warning',
        category: 'loading',
        title: '存在超大资源文件',
        detail: `${largeResources.length} 个资源 > 500KB`,
        examples: largeResources.slice(0, 3).map(r => ({
          name: r.name.split('/').pop(),
          size: (r.transferSize / 1024).toFixed(0) + 'KB',
        })),
        impact: '显著增加加载时间',
        fix: '压缩资源 / 代码分割 / 懒加载',
      });
    }
  }

  _detectLongTasks() {
    // 注意：longtask 需要在页面加载时设置 PerformanceObserver
    // 这里通过其他方式检测可能的长任务
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav && nav.domInteractive > 3000) {
      this.issues.push({
        type: 'anti-pattern',
        severity: 'warning',
        category: 'runtime',
        title: 'DOM 解析时间过长',
        detail: `domInteractive: ${Math.round(nav.domInteractive)}ms`,
        impact: '用户需要等待更久才能交互',
        fix: '使用 defer/async 加载 JS，代码分割，减少主线程工作',
      });
    }
  }

  _detectRepaintIssues() {
    // 检测使用 opacity/transform 以外的动画属性
    const allElements = document.querySelectorAll('*');
    let problematicAnimations = 0;

    allElements.forEach(el => {
      const style = window.getComputedStyle(el);
      const transition = style.transitionProperty || '';
      const animation = style.animationName || '';

      // 检测触发布局的属性动画
      const layoutProps = ['width', 'height', 'top', 'left', 'right', 'bottom',
        'margin', 'padding', 'font-size'];
      const hasLayoutAnimation = layoutProps.some(prop =>
        transition.includes(prop) || animation.includes(prop)
      );

      if (hasLayoutAnimation) problematicAnimations++;
    });

    if (problematicAnimations > 0) {
      this.issues.push({
        type: 'anti-pattern',
        severity: 'warning',
        category: 'rendering',
        title: '存在触发重排的动画',
        detail: `发现 ${problematicAnimations} 个使用布局属性动画的元素`,
        impact: '动画期间频繁重排，帧率下降',
        fix: '只使用 transform 和 opacity 做动画',
      });
    }
  }

  // ─── 性能预算检查 ───

  _checkBudget() {
    const budget = this.options.budget;
    const m = this.metrics;

    // LCP 预算
    if (m.lcp && m.lcp > budget.lcp) {
      this.issues.push({
        type: 'budget-violation',
        severity: 'critical',
        category: 'core-web-vitals',
        title: `LCP 超出预算: ${Math.round(m.lcp)}ms > ${budget.lcp}ms`,
        fix: '优化首屏图片 / 预加载关键资源 / 减少 JS 体积',
      });
    }

    // CLS 预算
    if (m.cls !== null && m.cls > budget.cls) {
      this.issues.push({
        type: 'budget-violation',
        severity: 'warning',
        category: 'core-web-vitals',
        title: `CLS 超出预算: ${m.cls.toFixed(3)} > ${budget.cls}`,
        fix: '为图片/广告设置尺寸 / 避免动态插入内容 / 使用 transform 动画',
      });
    }

    // TTFB 预算
    if (m.ttfb && m.ttfb > budget.ttfb) {
      this.issues.push({
        type: 'budget-violation',
        severity: 'warning',
        category: 'network',
        title: `TTFB 超出预算: ${m.ttfb}ms > ${budget.ttfb}ms`,
        fix: '启用 CDN / 优化服务端响应 / 使用边缘计算',
      });
    }

    // 资源大小预算
    if (m.totalTransferSize && m.totalTransferSize > budget.totalSize) {
      this.issues.push({
        type: 'budget-violation',
        severity: 'warning',
        category: 'loading',
        title: `总资源大小超出预算: ${(m.totalTransferSize / 1024).toFixed(0)}KB > ${(budget.totalSize / 1024).toFixed(0)}KB`,
        fix: '代码分割 / Tree Shaking / 图片压缩 / 移除未使用依赖',
      });
    }

    // DOM 节点预算
    if (m.totalNodes && m.totalNodes > budget.maxDOMNodes) {
      this.issues.push({
        type: 'budget-violation',
        severity: 'info',
        category: 'rendering',
        title: `DOM 节点数超出预算: ${m.totalNodes} > ${budget.maxDOMNodes}`,
        fix: '虚拟列表 / 减少嵌套 / 按需渲染',
      });
    }

    // 堆内存预算
    if (m.usedHeapSize && m.usedHeapSize > budget.maxHeapSize) {
      this.issues.push({
        type: 'budget-violation',
        severity: 'critical',
        category: 'memory',
        title: `堆内存超出预算: ${(m.usedHeapSize / 1024 / 1024).toFixed(1)}MB > ${(budget.maxHeapSize / 1024 / 1024).toFixed(0)}MB`,
        fix: '检查内存泄漏 / 减少缓存 / 使用 WeakMap / 清理定时器',
      });
    }
  }

  // ─── 建议生成 ───

  _generateRecommendations() {
    const issues = this.issues;
    const m = this.metrics;

    // 按优先级排序建议
    const sortedIssues = [...issues].sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    sortedIssues.forEach(issue => {
      this.recommendations.push({
        priority: issue.severity === 'critical' ? 'P0' : issue.severity === 'warning' ? 'P1' : 'P2',
        category: issue.category,
        title: issue.title,
        action: issue.fix,
        impact: issue.impact || '',
      });
    });
  }

  _buildSummary() {
    const critical = this.issues.filter(i => i.severity === 'critical').length;
    const warnings = this.issues.filter(i => i.severity === 'warning').length;
    const infos = this.issues.filter(i => i.severity === 'info').length;

    return {
      totalIssues: this.issues.length,
      critical,
      warnings,
      infos,
      overallHealth: critical > 0 ? '🔴 需要立即修复' : warnings > 3 ? '🟡 需要优化' : '🟢 状态良好',
    };
  }

  _calculateScore() {
    // 0-100 分，基于预算违反数量和严重程度
    let score = 100;
    this.issues.forEach(issue => {
      if (issue.severity === 'critical') score -= 15;
      else if (issue.severity === 'warning') score -= 8;
      else score -= 3;
    });
    return Math.max(0, Math.min(100, score));
  }
}

// ─── 使用示例 ───

// 基础用法
async function runAudit() {
  const auditor = new PerformanceAuditor();
  const report = await auditor.audit();

  console.log('=== 性能审计报告 ===');
  console.log(`URL: ${report.url}`);
  console.log(`时间: ${report.timestamp}`);
  console.log(`评分: ${report.score}/100`);
  console.log(`健康度: ${report.summary.overallHealth}`);
  console.log(`\n问题总数: ${report.summary.totalIssues}`);
  console.log(`  🔴 严重: ${report.summary.critical}`);
  console.log(`  🟡 警告: ${report.summary.warnings}`);
  console.log(`  🔵 信息: ${report.summary.infos}`);

  if (report.issues.length > 0) {
    console.log('\n--- 问题列表 ---');
    report.issues.forEach((issue, i) => {
      const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';
      console.log(`${i + 1}. ${icon} ${issue.title}`);
      console.log(`   修复建议: ${issue.fix}`);
    });
  }

  // 导出 JSON 报告
  // const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  // const url = URL.createObjectURL(blob);
  // console.log('报告下载:', url);

  return report;
}

// 自定义预算
const customAuditor = new PerformanceAuditor({
  budget: {
    lcp: 1500,       // 更严格的 LCP 预算
    cls: 0.05,       // 更严格的 CLS 预算
    totalSize: 1000000, // 1MB 总大小预算
  },
  auditDuration: 15000,
});
```

---

## 二、端到端优化案例 — 从烂项目到高性能项目

### 2.1 场景：电商商品详情页

**初始状态（优化前）：**
- LCP: 4.2s（目标 < 2.5s）
- TTI: 6.8s（目标 < 3.8s）
- CLS: 0.35（目标 < 0.1）
- 总资源: 3.8MB（目标 < 1.7MB）
- 请求数: 87（目标 < 50）
- 堆内存: 62MB（目标 < 50MB）

```javascript
// ============================================================
// ❌ 优化前 — 典型烂代码
// ============================================================

// 1. 所有资源一次性加载
const allScripts = [
  'jquery-3.6.0.js',      // 97KB — 其实不需要 jQuery
  'bootstrap.js',          // 60KB — 只用了 modal
  'analytics.js',          // 45KB — 首屏不需要
  'chat-widget.js',        // 120KB — 右下角聊天窗口
  'recommendation.js',     // 200KB — 推荐引擎
  'main.js',               // 80KB — 业务逻辑
  // ... 还有 20+ 个脚本
];
allScripts.forEach(src => {
  const script = document.createElement('script');
  script.src = src;
  document.head.appendChild(script);  // 阻塞渲染！
});

// 2. 图片全部立即加载
function renderProductImages(images) {
  const container = document.getElementById('image-gallery');
  images.forEach(img => {
    // 4K 原图直接加载，没有缩略图
    container.innerHTML += `<img src="${img.fullUrl}" alt="${img.alt}">`;
  });
}

// 3. 评论列表一次性渲染 1000+ 条
async function loadComments() {
  const response = await fetch('/api/comments?productId=123&limit=1000');
  const comments = await response.json();
  const container = document.getElementById('comments');
  comments.forEach(c => {
    // 每次循环都操作 DOM — Layout Thrashing
    const div = document.createElement('div');
    div.className = 'comment';
    div.innerHTML = `<p>${c.content}</p><span>${c.author}</span>`;
    container.appendChild(div);
  });
}

// 4. 搜索框没有防抖
document.getElementById('search').addEventListener('input', (e) => {
  // 每次按键都发请求！
  fetch(`/api/search?q=${e.target.value}`)
    .then(r => r.json())
    .then(data => renderSuggestions(data));
});

// 5. 滚动事件没有节流
window.addEventListener('scroll', () => {
  // 每次滚动都计算位置 + 操作 DOM
  const scrollTop = window.pageYOffset;
  const header = document.getElementById('header');
  if (scrollTop > 100) {
    header.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
  } else {
    header.style.boxShadow = 'none';
  }

  // 还触发推荐模块加载
  loadRecommendations();
});

// 6. 定时器泄漏
function initCountdown() {
  setInterval(() => {
    // 倒计时结束后没有清理
    updateCountdown();
  }, 1000);
}

// 7. 闭包泄漏
function setupProductTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // 闭包捕获了整个 productData 对象（2MB）
      const productData = window.__PRODUCT_DATA__;
      switchTab(tab.dataset.tabId, productData);
    });
  });
}

// 8. 频繁重排
function animateProductCard(card) {
  // 读写交替 — 触发 N 次重排
  card.style.width = card.offsetWidth + 10 + 'px';
  card.style.height = card.offsetHeight + 10 + 'px';
  card.style.marginTop = card.offsetTop - 5 + 'px';
  card.style.marginLeft = card.offsetLeft - 5 + 'px';
}
```

```javascript
// ============================================================
// ✅ 优化后 — 高性能版本
// ============================================================

// ─── 优化 1: 资源按需加载 + 代码分割 ───

// 关键资源内联 + defer 加载
// HTML 中:
// <link rel="preload" href="/css/critical.css" as="style">
// <link rel="stylesheet" href="/css/critical.css">
// <script src="/js/main.js" defer></script>

// 非关键资源懒加载
class ResourceLoader {
  constructor() {
    this.loaded = new Set();
    this.queue = new Map(); // 等待加载的资源
  }

  /**
   * 按需加载非关键脚本
   */
  loadOnDemand(name, src, condition) {
    if (this.loaded.has(name)) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const check = () => {
        if (condition()) {
          this._loadScript(src).then(() => {
            this.loaded.add(name);
            resolve();
          }).catch(reject);
        } else {
          // 每 500ms 检查一次条件
          setTimeout(check, 500);
        }
      };
      check();
    });
  }

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * 预加载可能需要的资源
   */
  prefetch(url) {
    if (document.querySelector(`link[href="${url}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  }
}

const resourceLoader = new ResourceLoader();

// 首屏只加载核心 JS
// analytics — 用户交互后加载
resourceLoader.loadOnDemand('analytics', '/js/analytics.js',
  () => document.querySelector(':hover') !== null // 用户开始交互
);

// chat-widget — 用户停留 30s 后加载
resourceLoader.loadOnDemand('chat', '/js/chat-widget.js',
  () => performance.now() > 30000
);

// recommendation — 滚动到推荐区域时加载
resourceLoader.loadOnDemand('recommendation', '/js/recommendation.js',
  () => {
    const recEl = document.getElementById('recommendations');
    return recEl && recEl.getBoundingClientRect().top < window.innerHeight;
  }
);

// ─── 优化 2: 图片懒加载 + 响应式 + 格式优化 ───

class ImageOptimizer {
  constructor() {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this._loadImage(entry.target);
          this.observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '300px 0px', // 提前 300px 加载
      threshold: 0.01,
    });
  }

  /**
   * 初始化图片懒加载
   */
  init(container = document) {
    const images = container.querySelectorAll('img[data-src]');
    images.forEach(img => {
      // 设置占位符
      if (!img.src) {
        img.src = this._getPlaceholder(img.dataset.width, img.dataset.height);
      }
      this.observer.observe(img);
    });
  }

  _loadImage(img) {
    const src = img.dataset.src;
    const srcset = img.dataset.srcset;

    // 优先使用 WebP
    if (img.dataset.webpSrc && this._supportsWebP()) {
      img.src = img.dataset.webpSrc;
    } else if (srcset) {
      img.srcset = srcset;
      img.src = src;
    } else {
      img.src = src;
    }

    img.removeAttribute('data-src');
    img.removeAttribute('data-srcset');
  }

  _getPlaceholder(w, h) {
    // SVG 占位符（极小体积）
    return `data:image/svg+xml,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w || 300} ${h || 300}">
        <rect fill="#f0f0f0" width="100%" height="100%"/>
      </svg>
    `)}`;
  }

  _supportsWebP() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  }
}

// HTML 中使用:
// <img data-src="/images/product-1.webp"
//      data-srcset="/images/product-1-400.webp 400w, /images/product-1-800.webp 800w"
//      data-width="400" data-height="400"
//      loading="lazy" alt="商品图片">

const imageOptimizer = new ImageOptimizer();
imageOptimizer.init();

// ─── 优化 3: 虚拟列表渲染评论 ───

/**
 * VirtualList — 高性能虚拟列表
 * 只渲染可见区域的 DOM 节点
 */
class VirtualList {
  constructor(container, options = {}) {
    this.container = container;
    this.itemHeight = options.itemHeight || 80;
    this.bufferSize = options.bufferSize || 5;
    this.items = [];
    this.startIndex = 0;
    this.endIndex = 0;
    this.visibleCount = 0;

    this._init();
  }

  _init() {
    this.container.style.position = 'relative';
    this.container.style.overflow = 'auto';

    // 计算可见数量
    this._calcVisibleCount();

    // 滚动事件节流
    this._onScroll = this._throttle(this._handleScroll.bind(this), 16);
    this.container.addEventListener('scroll', this._onScroll);

    window.addEventListener('resize', this._throttle(() => {
      this._calcVisibleCount();
      this._render();
    }, 200));
  }

  _calcVisibleCount() {
    const containerHeight = this.container.clientHeight;
    this.visibleCount = Math.ceil(containerHeight / this.itemHeight);
    this.endIndex = Math.min(
      this.startIndex + this.visibleCount + this.bufferSize * 2,
      this.items.length
    );
  }

  setData(items) {
    this.items = items;

    // 设置总高度（撑开滚动条）
    const totalHeight = items.length * this.itemHeight;
    if (!this.container.querySelector('.virtual-spacer')) {
      const spacer = document.createElement('div');
      spacer.className = 'virtual-spacer';
      spacer.style.height = totalHeight + 'px';
      spacer.style.position = 'relative';
      this.container.appendChild(spacer);
    } else {
      this.container.querySelector('.virtual-spacer').style.height = totalHeight + 'px';
    }

    this._render();
  }

  _render() {
    const spacer = this.container.querySelector('.virtual-spacer');
    const start = Math.max(0, this.startIndex - this.bufferSize);
    const end = Math.min(this.items.length, this.endIndex + this.bufferSize);

    // 清除旧内容
    spacer.innerHTML = '';

    // 只渲染可见范围的 item
    for (let i = start; i < end; i++) {
      const item = this.items[i];
      const el = this._createItemElement(item, i);
      el.style.position = 'absolute';
      el.style.top = (i * this.itemHeight) + 'px';
      el.style.left = '0';
      el.style.right = '0';
      el.style.height = this.itemHeight + 'px';
      spacer.appendChild(el);
    }
  }

  _handleScroll() {
    const scrollTop = this.container.scrollTop;
    this.startIndex = Math.floor(scrollTop / this.itemHeight);
    this.endIndex = this.startIndex + this.visibleCount;
    this._render();
  }

  _throttle(fn, delay) {
    let lastTime = 0;
    return function (...args) {
      const now = Date.now();
      if (now - lastTime >= delay) {
        lastTime = now;
        fn.apply(this, args);
      }
    };
  }

  _createItemElement(item, index) {
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.innerHTML = `
      <div class="comment-avatar">
        <img src="${item.avatar}" alt="${item.author}" width="40" height="40" loading="lazy">
      </div>
      <div class="comment-content">
        <div class="comment-author">${item.author}</div>
        <div class="comment-text">${item.content}</div>
        <div class="comment-time">${item.time}</div>
      </div>
    `;
    return div;
  }
}

// 使用虚拟列表渲染 1000+ 条评论
async function loadComments() {
  const response = await fetch('/api/comments?productId=123&limit=1000');
  const comments = await response.json();

  const virtualList = new VirtualList(
    document.getElementById('comments'),
    { itemHeight: 80, bufferSize: 5 }
  );
  virtualList.setData(comments);
  // 无论多少条评论，DOM 中只有 ~15 个节点
}

// ─── 优化 4: 搜索框防抖 ───

/**
 * debounce — 防抖函数
 * 在最后一次调用后等待 delay ms 才执行
 */
function debounce(fn, delay, options = {}) {
  const { leading = false, maxWait = null } = options;
  let timer = null;
  let lastArgs = null;
  let lastThis = null;
  let lastCallTime = 0;
  let invokeTime = 0;

  function invokeFunc(time) {
    const args = lastArgs;
    const context = lastThis;
    lastArgs = lastThis = null;
    invokeTime = time;
    return fn.apply(context, args);
  }

  function leadingEdge(time) {
    invokeTime = time;
    timer = setTimeout(timerExpired, delay);
    return leading ? invokeFunc(time) : undefined;
  }

  function remainingWait(time) {
    if (maxWait === null) return delay - (time - lastCallTime);
    return Math.min(delay, maxWait - (time - invokeTime));
  }

  function timerExpired() {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    timer = setTimeout(timerExpired, remainingWait(time));
  }

  function trailingEdge(time) {
    timer = null;
    if (lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = lastThis = null;
    return undefined;
  }

  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - invokeTime;
    return lastCallTime === 0
      || timeSinceLastCall >= delay
      || (maxWait !== null && timeSinceLastInvoke >= maxWait);
  }

  function debounced(...args) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timer === null) {
        return leadingEdge(lastCallTime);
      }
      if (maxWait !== null) {
        timer = setTimeout(timerExpired, remainingWait(time));
      }
    } else if (timer === null) {
      timer = setTimeout(timerExpired, delay);
    }

    return invokeTime > 0 ? invokeTime : undefined;
  }

  debounced.cancel = function () {
    if (timer !== null) clearTimeout(timer);
    lastArgs = lastThis = timer = null;
  };

  debounced.flush = function () {
    return timer !== null ? trailingEdge(Date.now()) : undefined;
  };

  return debounced;
}

// 使用防抖
const searchInput = document.getElementById('search');
const debouncedSearch = debounce((query) => {
  fetch(`/api/search?q=${encodeURIComponent(query)}`)
    .then(r => r.json())
    .then(data => renderSuggestions(data))
    .catch(err => console.error('Search failed:', err));
}, 300, { maxWait: 1500 }); // 最长等待 1.5s 确保结果返回

searchInput.addEventListener('input', (e) => {
  debouncedSearch(e.target.value.trim());
});

// 用户点击搜索按钮时立即执行
document.getElementById('search-btn').addEventListener('click', () => {
  debouncedSearch.flush();
});

// 组件卸载时清理
// debouncedSearch.cancel();

// ─── 优化 5: 滚动事件节流 ───

/**
 * throttle — 节流函数
 * 在时间窗口内只执行一次
 */
function throttle(fn, interval, options = {}) {
  const { leading = true, trailing = true } = options;
  let lastTime = 0;
  let timer = null;
  let lastArgs = null;

  function invoke(args) {
    lastArgs = null;
    lastTime = leading === false ? 0 : Date.now();
    fn.apply(this, args);
  }

  function throttled(...args) {
    const now = Date.now();

    if (!lastTime && leading === false) lastTime = now;

    const remaining = interval - (now - lastTime);

    if (remaining <= 0 || remaining > interval) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastTime = now;
      fn.apply(this, args);
    } else if (!timer && trailing) {
      timer = setTimeout(() => {
        lastTime = leading === false ? 0 : Date.now();
        timer = null;
        invoke.call(this, lastArgs || args);
      }, remaining);
    }
  }

  throttled.cancel = function () {
    if (timer) clearTimeout(timer);
    timer = null;
    lastTime = 0;
    lastArgs = null;
  };

  return throttled;
}

// 使用节流
const header = document.getElementById('header');
const onScroll = throttle(() => {
  const scrollTop = window.scrollY;
  // 使用 classList 替代直接修改 style（避免 Layout Thrashing）
  header.classList.toggle('scrolled', scrollTop > 100);
}, 100);

window.addEventListener('scroll', onScroll, { passive: true });

// ─── 优化 6: 定时器管理 ───

class TimerManager {
  constructor() {
    this.timers = new Map();
  }

  setInterval(name, fn, delay) {
    this.clear(name); // 清理同名定时器
    const id = setInterval(fn, delay);
    this.timers.set(name, id);
    return id;
  }

  setTimeout(name, fn, delay) {
    this.clear(name);
    const id = setTimeout(() => {
      fn();
      this.timers.delete(name);
    }, delay);
    this.timers.set(name, id);
    return id;
  }

  clear(name) {
    const id = this.timers.get(name);
    if (id !== undefined) {
      clearInterval(id);
      clearTimeout(id);
      this.timers.delete(name);
    }
  }

  clearAll() {
    this.timers.forEach((id) => {
      clearInterval(id);
      clearTimeout(id);
    });
    this.timers.clear();
  }

  destroy() {
    this.clearAll();
  }
}

// 使用 TimerManager
const timerManager = new TimerManager();

function initCountdown() {
  timerManager.setInterval('countdown', () => {
    updateCountdown();
  }, 1000);
}

// 页面卸载时统一清理
window.addEventListener('beforeunload', () => {
  timerManager.destroy();
  debouncedSearch.cancel();
  onScroll.cancel();
});

// ─── 优化 7: 避免闭包泄漏 ───

function setupProductTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // ❌ 旧方式：闭包捕获整个 productData
      // switchTab(tab.dataset.tabId, window.__PRODUCT_DATA__);

      // ✅ 新方式：只传递需要的字段
      const tabId = tab.dataset.tabId;
      switchTab(tabId, {
        id: window.__PRODUCT_DATA__.id,
        name: window.__PRODUCT_DATA__.name,
        // 只传递必要字段，不传递整个大对象
      });
    });
  });
}

// 更好的方式：使用事件委托 + 数据属性
function setupProductTabsV2() {
  const tabContainer = document.getElementById('tab-container');
  tabContainer.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;

    // 从 DOM 数据属性读取，不依赖闭包
    const tabId = tab.dataset.tabId;
    switchTab(tabId, getProductData(tabId));
  });
}

// 组件卸载时移除事件监听
function cleanup() {
  tabContainer.removeEventListener('click', tabContainer._onClick);
  // 或者使用 { once: true } 选项
}

// ─── 优化 8: 避免 Layout Thrashing ───

// ❌ 反模式
function animateProductCardBad(card) {
  card.style.width = card.offsetWidth + 10 + 'px';
  card.style.height = card.offsetHeight + 10 + 'px';
  card.style.marginTop = card.offsetTop - 5 + 'px';
  card.style.marginLeft = card.offsetLeft - 5 + 'px';
  // 触发 4 次重排！
}

// ✅ 模式 1: 读写分离
function animateProductCardGood(card) {
  // 先读
  const width = card.offsetWidth;
  const height = card.offsetHeight;
  const top = card.offsetTop;
  const left = card.offsetLeft;

  // 再写（一次性）
  card.style.width = (width + 10) + 'px';
  card.style.height = (height + 10) + 'px';
  card.style.marginTop = (top - 5) + 'px';
  card.style.marginLeft = (left - 5) + 'px';
  // 只触发 1 次重排
}

// ✅ 模式 2: 使用 transform（不触发重排）
function animateProductCardBest(card) {
  card.style.transform = 'scale(1.05) translate(-2px, -2px)';
  card.style.transition = 'transform 0.3s ease';
  // 0 次重排！只触发合成
}

// ✅ 模式 3: 使用 requestAnimationFrame 批量更新
function batchUpdateElements(elements, updateFn) {
  requestAnimationFrame(() => {
    // 读阶段
    const reads = elements.map(el => ({
      el,
      width: el.offsetWidth,
      height: el.offsetHeight,
      top: el.offsetTop,
      left: el.offsetLeft,
    }));

    // 写阶段
    reads.forEach(({ el, width, height, top, left }) => {
      updateFn(el, { width, height, top, left });
    });
  });
}
```

### 2.2 优化效果对比

```
┌─────────────────────┬──────────┬──────────┬──────────┐
│       指标          │  优化前   │  优化后   │  改善    │
├─────────────────────┼──────────┼──────────┼──────────┤
│ LCP                 │  4.2s    │  1.8s    │  ↓57%    │
│ TTI                 │  6.8s    │  2.1s    │  ↓69%    │
│ CLS                 │  0.35    │  0.02    │  ↓94%    │
│ 总资源大小          │  3.8MB   │  0.9MB   │  ↓76%    │
│ 请求数              │  87      │  23      │  ↓74%    │
│ 堆内存              │  62MB    │  18MB    │  ↓71%    │
│ DOM 节点数          │  2800    │  450     │  ↓84%    │
│ Lighthouse 评分     │  32      │  95      │  ↑197%   │
└─────────────────────┴──────────┴──────────┴──────────┘
```

---

## 三、性能预算体系 — 让性能可度量、可管控

### 3.1 什么是性能预算？

性能预算 (Performance Budget) 是一套量化的性能约束，类似财务预算：
- 超过预算 = 需要审批或优化
- 预算写入 CI/CD = 自动化卡点
- 预算写入代码 = 运行时监控

### 3.2 性能预算配置

```javascript
/**
 * PerformanceBudget — 性能预算管理器
 * 
 * 支持：
 * - 定义预算阈值
 * - 运行时检查
 * - CI/CD 集成
 * - 趋势分析
 */
class PerformanceBudget {
  constructor(config) {
    this.budget = {
      // Core Web Vitals
      coreWebVitals: {
        LCP: { max: 2500, unit: 'ms', priority: 'P0' },
        FID: { max: 100, unit: 'ms', priority: 'P0' },
        CLS: { max: 0.1, unit: '', priority: 'P0' },
        INP: { max: 200, unit: 'ms', priority: 'P1' },
      },

      // 加载性能
      loading: {
        TTFB: { max: 600, unit: 'ms', priority: 'P1' },
        totalSize: { max: 1700 * 1024, unit: 'bytes', priority: 'P1' },
        maxRequests: { max: 50, unit: '', priority: 'P1' },
        jsSize: { max: 300 * 1024, unit: 'bytes', priority: 'P1' },
        cssSize: { max: 100 * 1024, unit: 'bytes', priority: 'P2' },
        imageSize: { max: 500 * 1024, unit: 'bytes', priority: 'P1' },
      },

      // 渲染性能
      rendering: {
        maxDOMNodes: { max: 1500, unit: '', priority: 'P1' },
        maxDepth: { max: 15, unit: '', priority: 'P2' },
        minFPS: { min: 55, unit: 'fps', priority: 'P1' },
        maxLongTasks: { max: 5, unit: '', priority: 'P1' },
      },

      // 内存性能
      memory: {
        maxHeapSize: { max: 50 * 1024 * 1024, unit: 'bytes', priority: 'P0' },
        maxEventListeners: { max: 200, unit: '', priority: 'P2' },
        maxDetachedNodes: { max: 100, unit: '', priority: 'P1' },
      },
    };

    this.history = []; // 历史记录用于趋势分析
    this.warnings = [];
  }

  /**
   * 检查当前指标是否符合预算
   */
  check(metrics) {
    const violations = [];
    const warnings = [];

    const allCategories = [
      ...Object.entries(this.budget.coreWebVitals),
      ...Object.entries(this.budget.loading),
      ...Object.entries(this.budget.rendering),
      ...Object.entries(this.budget.memory),
    ];

    for (const [name, config] of allCategories) {
      const value = metrics[name];
      if (value === undefined || value === null) continue;

      if (config.max !== undefined && value > config.max) {
        const excess = ((value - config.max) / config.max * 100).toFixed(1);
        violations.push({
          name,
          value,
          budget: config.max,
          unit: config.unit,
          excess: `${excess}%`,
          priority: config.priority,
        });
      }

      if (config.min !== undefined && value < config.min) {
        const shortfall = ((config.min - value) / config.min * 100).toFixed(1);
        violations.push({
          name,
          value,
          budget: config.min,
          unit: config.unit,
          shortfall: `${shortfall}%`,
          priority: config.priority,
        });
      }
    }

    // 记录历史
    this.history.push({
      timestamp: Date.now(),
      metrics: { ...metrics },
      violations: violations.length,
    });

    // 只保留最近 100 条
    if (this.history.length > 100) this.history = this.history.slice(-100);

    return {
      passed: violations.length === 0,
      violations,
      totalChecks: allCategories.length,
      passedChecks: allCategories.length - violations.length,
    };
  }

  /**
   * 生成预算报告（用于 CI/CD）
   */
  generateReport(result) {
    if (result.passed) {
      return `✅ 性能预算检查通过 (${result.passedChecks}/${result.totalChecks})`;
    }

    const lines = [
      `❌ 性能预算检查失败`,
      `通过: ${result.passedChecks}/${result.totalChecks}`,
      '',
      '--- 违反项 ---',
    ];

    result.violations.forEach(v => {
      const icon = v.priority === 'P0' ? '🔴' : v.priority === 'P1' ? '🟡' : '🔵';
      const detail = v.excess
        ? `超出预算 ${v.excess} (当前: ${v.value}${v.unit}, 预算: ${v.budget}${v.unit})`
        : `未达最低要求 ${v.shortfall} (当前: ${v.value}${v.unit}, 最低: ${v.budget}${v.unit})`;
      lines.push(`${icon} [${v.priority}] ${v.name}: ${detail}`);
    });

    return lines.join('\n');
  }

  /**
   * 趋势分析 — 检测性能退化
   */
  analyzeTrend(metricName, windowSize = 10) {
    const recent = this.history.slice(-windowSize);
    if (recent.length < 3) return { trend: 'insufficient-data' };

    const values = recent.map(h => h.metrics[metricName]).filter(v => v !== undefined);
    if (values.length < 3) return { trend: 'insufficient-data' };

    // 简单线性回归
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;

    let numerator = 0, denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (values[i] - yMean);
      denominator += (i - xMean) ** 2;
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const trend = slope > 0 ? 'degrading' : slope < 0 ? 'improving' : 'stable';

    return {
      trend,
      slope: slope.toFixed(2),
      current: values[values.length - 1],
      average: yMean.toFixed(2),
      samples: values.length,
    };
  }
}

// ─── 使用示例 ───

const budget = new PerformanceBudget();

// 运行时检查
async function checkPerformanceBudget() {
  const auditor = new PerformanceAuditor();
  const report = await auditor.audit();

  const result = budget.check(report.metrics);
  const reportText = budget.generateReport(result);

  console.log(reportText);

  // 在 CI/CD 中，如果 result.passed === false，则构建失败
  if (!result.passed && typeof process !== 'undefined') {
    process.exit(1);
  }

  return result;
}

// 趋势分析
const lcpTrend = budget.analyzeTrend('lcp');
console.log('LCP 趋势:', lcpTrend);
// { trend: 'improving', slope: '-15.23', current: 1800, average: 2100.5, samples: 10 }
```

---

## 四、性能回归检测 — 自动化防护

### 4.1 性能回归检测工具

```javascript
/**
 * PerformanceRegressionDetector — 性能回归检测器
 * 
 * 功能：
 * - 记录基准性能数据
 * - 每次部署后对比
 * - 自动标记回归
 * - 生成回归报告
 */
class PerformanceRegressionDetector {
  constructor(options = {}) {
    this.baselineKey = options.baselineKey || 'perf-baseline';
    this.threshold = options.threshold || 0.1; // 10% 变化视为回归
    this.storage = options.storage || localStorage;
  }

  /**
   * 保存基准数据
   */
  saveBaseline(metrics) {
    const baseline = {
      timestamp: Date.now(),
      version: this._getVersion(),
      metrics: { ...metrics },
    };
    this.storage.setItem(this.baselineKey, JSON.stringify(baseline));
    console.log(`✅ 基准性能数据已保存 (版本: ${baseline.version})`);
  }

  /**
   * 检测回归
   */
  detectRegression(currentMetrics) {
    const baselineData = this.storage.getItem(this.baselineKey);
    if (!baselineData) {
      console.warn('⚠️ 没有基准数据，请先运行 saveBaseline()');
      return { hasRegression: false, message: '无基准数据' };
    }

    const baseline = JSON.parse(baselineData);
    const regressions = [];
    const improvements = [];

    const metricsToCheck = [
      'lcp', 'fid', 'cls', 'inp', 'ttfb',
      'totalTransferSize', 'totalResources', 'totalNodes',
      'usedHeapSize',
    ];

    metricsToCheck.forEach(key => {
      const baselineValue = baseline.metrics[key];
      const currentValue = currentMetrics[key];

      if (baselineValue === undefined || currentValue === undefined) return;
      if (baselineValue === 0) return;

      const changePercent = (currentValue - baselineValue) / baselineValue;

      // 判断是否退化（注意：CLS 越小越好，heapSize 越小越好）
      const lowerIsBetter = ['lcp', 'fid', 'cls', 'inp', 'ttfb',
        'totalTransferSize', 'totalResources', 'totalNodes', 'usedHeapSize'];

      const isRegression = lowerIsBetter.includes(key)
        ? changePercent > this.threshold
        : changePercent < -this.threshold;

      const isImprovement = lowerIsBetter.includes(key)
        ? changePercent < -this.threshold
        : changePercent > this.threshold;

      if (isRegression) {
        regressions.push({
          metric: key,
          baseline: baselineValue,
          current: currentValue,
          change: `${(changePercent * 100).toFixed(1)}%`,
          severity: Math.abs(changePercent) > 0.3 ? 'critical' : 'warning',
        });
      } else if (isImprovement) {
        improvements.push({
          metric: key,
          baseline: baselineValue,
          current: currentValue,
          change: `${(changePercent * 100).toFixed(1)}%`,
        });
      }
    });

    return {
      hasRegression: regressions.length > 0,
      baselineVersion: baseline.version,
      baselineDate: new Date(baseline.timestamp).toISOString(),
      regressions,
      improvements,
      summary: {
        total: metricsToCheck.length,
        checked: regressions.length + improvements.length,
        unchanged: metricsToCheck.length - regressions.length - improvements.length,
      },
    };
  }

  /**
   * 生成回归报告（用于 PR 评论 / CI 输出）
   */
  generateRegressionReport(result) {
    if (!result.hasRegression) {
      const lines = ['✅ 性能回归检测通过'];
      if (result.improvements.length > 0) {
        lines.push('\n📈 性能提升:');
        result.improvements.forEach(i => {
          lines.push(`  🟢 ${i.metric}: ${i.change}`);
        });
      }
      return lines.join('\n');
    }

    const lines = [
      '❌ 检测到性能回归',
      `基准版本: ${result.baselineVersion} (${result.baselineDate})`,
      '',
      '--- 回归项 ---',
    ];

    result.regressions.forEach(r => {
      const icon = r.severity === 'critical' ? '🔴' : '🟡';
      lines.push(`${icon} ${r.metric}: ${r.baseline} → ${r.current} (${r.change})`);
    });

    if (result.improvements.length > 0) {
      lines.push('\n--- 提升项 ---');
      result.improvements.forEach(i => {
        lines.push(`  🟢 ${i.metric}: ${i.change}`);
      });
    }

    return lines.join('\n');
  }

  _getVersion() {
    // 尝试从 meta 标签或全局变量获取版本号
    const meta = document.querySelector('meta[name="version"]');
    return meta?.content || window.__APP_VERSION__ || 'unknown';
  }
}

// ─── 使用示例 ───

const regressionDetector = new PerformanceRegressionDetector({
  threshold: 0.1, // 10% 变化视为回归
});

// 首次部署：保存基准
async function setupBaseline() {
  const auditor = new PerformanceAuditor();
  const report = await auditor.audit();
  regressionDetector.saveBaseline(report.metrics);
}

// 后续部署：检测回归
async function checkRegression() {
  const auditor = new PerformanceAuditor();
  const report = await auditor.audit();
  const result = regressionDetector.detectRegression(report.metrics);
  console.log(regressionDetector.generateRegressionReport(result));

  if (result.hasRegression) {
    // 可以在这里发送通知、阻止部署等
    throw new Error('性能回归检测失败，请检查优化措施');
  }
}
```

---

## 五、Phase 1 性能优化知识图谱

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Web 性能优化知识图谱 (Phase 1)                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │  加载性能    │    │  渲染性能    │    │  运行时性能  │             │
│  ├─────────────┤    ├─────────────┤    ├─────────────┤             │
│  │ • LCP/FCP   │    │ • INP/FID   │    │ • 帧率      │             │
│  │ • TTFB      │    │ • CLS       │    │ • 长任务    │             │
│  │ • TTI       │    │ • 重排/重绘  │    │ • 任务拆分  │             │
│  │ • 资源优化   │    │ • 合成层    │    │ • Web Worker│             │
│  │ • 代码分割   │    │ • will-change│   │ • rAF/rIC   │             │
│  │ • 缓存策略   │    │ • 虚拟列表  │    │ • 算法优化  │             │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘             │
│         │                  │                  │                     │
│         ▼                  ▼                  ▼                     │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │              核心优化技术 (贯穿三层)                       │       │
│  ├──────────────────────────────────────────────────────────┤       │
│  │  懒加载    │ IntersectionObserver / 动态 import / 按需加载 │       │
│  │  防抖节流  │ debounce / throttle / 请求合并 / 队列管理     │       │
│  │  内存管理  │ WeakMap / WeakRef / 清理定时器 / 避免闭包泄漏  │       │
│  │  虚拟列表  │ 只渲染可见区域 / 固定高度 / 滚动计算          │       │
│  │  图片优化  │ srcset / WebP / lazy / 占位符 / 压缩          │       │
│  │  CSS 优化  │ 关键 CSS 内联 / 非关键异步 / 避免布局动画     │       │
│  │  JS 优化   │ defer/async / 代码分割 / Tree Shaking         │       │
│  └──────────────────────────────────────────────────────────┘       │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │              工具与方法论                                  │       │
│  ├──────────────────────────────────────────────────────────┤       │
│  │  审计工具  │ PerformanceAuditor (自建) / Lighthouse / PSI │       │
│  │  性能预算  │ 量化约束 / CI 卡点 / 趋势分析                │       │
│  │  回归检测  │ 基准对比 / 自动化防护 / PR 评论               │       │
│  │  监控体系  │ RUM / 合成监控 / 报警机制                     │       │
│  └──────────────────────────────────────────────────────────┘       │
│                                                                     │
│  11 天专项训练覆盖:                                                   │
│  4/24 基础 → 4/25 进阶 → 4/26 实战 → 4/27 扩展 → 4/28 Toolkit      │
│  → 4/29 场景模式 → 4/30 审计框架 + 端到端案例 (终章)                  │
│  累计: ~8000+ 行代码 / 7 个完整文档 / 30+ 可复用组件                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 六、Phase 1 性能优化 — 最终 Checklist

### 加载性能 Checklist
- [ ] LCP < 2.5s
- [ ] TTFB < 600ms
- [ ] 首屏 JS < 170KB (gzip)
- [ ] 首屏 CSS < 50KB (gzip)
- [ ] 图片使用 WebP + srcset
- [ ] 图片使用 lazy loading
- [ ] 非关键资源异步加载
- [ ] 使用 HTTP/2 多路复用
- [ ] 启用 Gzip/Brotli 压缩
- [ ] 静态资源添加 Cache-Control

### 渲染性能 Checklist
- [ ] CLS < 0.1
- [ ] INP < 200ms
- [ ] 动画只使用 transform + opacity
- [ ] 避免 Layout Thrashing（读写分离）
- [ ] 长列表使用虚拟滚动
- [ ] DOM 节点数 < 1500
- [ ] 避免使用 layout-triggering CSS 属性

### 运行时性能 Checklist
- [ ] 输入响应 < 100ms
- [ ] 无长任务 (> 50ms)
- [ ] 帧率稳定 60fps
- [ ] 使用 requestAnimationFrame 做动画
- [ ] 复杂计算使用 Web Worker

### 内存性能 Checklist
- [ ] 堆内存 < 50MB
- [ ] 无定时器泄漏（组件卸载时清理）
- [ ] 无事件监听器泄漏
- [ ] 无闭包捕获大对象
- [ ] 使用 WeakMap/WeakRef 管理缓存
- [ ] Detached DOM 节点 < 100

### 工程化 Checklist
- [ ] 配置性能预算
- [ ] CI/CD 集成性能检测
- [ ] 定期运行 Lighthouse CI
- [ ] 监控 Core Web Vitals (RUM)
- [ ] 性能回归自动检测
- [ ] 性能报告定期生成

---

## 七、核心代码速查表

```javascript
// ═══════════════════════════════════════════════════════
// 性能优化核心代码 — 一页速查
// ═══════════════════════════════════════════════════════

// 1. 防抖 (debounce)
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 2. 节流 (throttle)
function throttle(fn, interval) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= interval) {
      last = now;
      fn.apply(this, args);
    }
  };
}

// 3. 图片懒加载
const imgObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.src = e.target.dataset.src;
      imgObserver.unobserve(e.target);
    }
  });
});
document.querySelectorAll('img[data-src]').forEach(img => imgObserver.observe(img));

// 4. 组件懒加载
const LazyComponent = React.lazy(() => import('./HeavyComponent'));
// 或
const loadModule = () => import('./module').then(m => m.default);

// 5. 虚拟列表核心
function renderVisibleItems(scrollTop, containerHeight, itemHeight, totalItems) {
  const start = Math.floor(scrollTop / itemHeight);
  const count = Math.ceil(containerHeight / itemHeight);
  return { start, end: Math.min(start + count + 5, totalItems) };
}

// 6. 内存清理模式
class Component {
  constructor() {
    this._timers = [];
    this._observers = [];
    this._listeners = [];
  }

  addTimer(fn, delay) {
    const id = setInterval(fn, delay);
    this._timers.push(id);
    return id;
  }

  addEventListener(el, event, handler) {
    el.addEventListener(event, handler);
    this._listeners.push({ el, event, handler });
  }

  destroy() {
    this._timers.forEach(clearInterval);
    this._observers.forEach(o => o.disconnect());
    this._listeners.forEach(({ el, event, handler }) =>
      el.removeEventListener(event, handler)
    );
    this._timers = [];
    this._observers = [];
    this._listeners = [];
  }
}

// 7. WeakMap 缓存模式
const cache = new WeakMap();
function getCachedData(obj) {
  if (!cache.has(obj)) {
    cache.set(obj, computeExpensiveData(obj));
  }
  return cache.get(obj);
}
// obj 被 GC 后，缓存自动释放

// 8. 读写分离 (避免 Layout Thrashing)
// 先读
const widths = elements.map(el => el.offsetWidth);
// 再写
elements.forEach((el, i) => {
  el.style.width = (widths[i] + 10) + 'px';
});

// 9. 使用 transform 替代布局属性
// ❌ 触发重排
el.style.left = '100px';
el.style.width = '200px';
// ✅ 只触发合成
el.style.transform = 'translateX(100px) scaleX(2)';

// 10. 被动事件监听
window.addEventListener('scroll', handler, { passive: true });
document.addEventListener('touchstart', handler, { passive: true });

// 11. 预加载关键资源
<link rel="preload" href="/font.woff2" as="font" crossorigin>
<link rel="preconnect" href="https://api.example.com">
<link rel="dns-prefetch" href="https://cdn.example.com">

// 12. 关键 CSS 内联
// HTML head 中内联首屏关键样式
// <style>/* 首屏可见区域的 CSS */</style>
// 非关键 CSS 异步加载
// <link rel="stylesheet" href="/non-critical.css" media="print" onload="this.media='all'">
```

---

## 八、总结

### Phase 1 性能优化训练成果

| 维度 | 成果 |
|------|------|
| 专项训练次数 | 7 次 (4/24 → 4/30) |
| 总代码量 | ~8000+ 行 |
| 可复用组件 | 30+ 个 |
| 覆盖领域 | 加载/渲染/运行时/内存/网络/工程化 |
| 工具链 | PerformanceAuditor / VirtualList / LazyLoader / TimerManager / PerformanceBudget / RegressionDetector |
| 实战案例 | 电商商品详情页端到端优化 (LCP 4.2s→1.8s, Lighthouse 32→95) |

### 核心能力掌握

1. **懒加载** — IntersectionObserver / 动态 import / 虚拟列表 / 图片优化
2. **防抖节流** — 完整实现 / 场景应用 / 请求合并
3. **内存管理** — WeakMap / WeakRef / 定时器管理 / 闭包优化 / 事件清理
4. **性能审计** — 一站式审计工具 / 反模式检测 / 预算检查
5. **工程化** — 性能预算 / 回归检测 / CI/CD 集成

### 下一步 (Phase 2 — Vue3 框架核心)

性能优化知识将直接应用于 Vue3 项目：
- Vue 组件懒加载 (异步组件)
- Vue 列表虚拟滚动
- Vue 响应式性能优化
- Vue Router 路由懒加载
- Pinia 状态管理优化

---

*Phase 1 性能优化终章完成。从基础到生产级，从理论到实战，从手动到自动化。*
*下一站：Phase 2 — Vue3 框架核心 🚀*
