/**
 * Web 性能监控工具
 *
 * 监控页面加载、运行时性能指标
 * 支持 Core Web Vitals 指标采集
 */

// ============================================
// 1. Core Web Vitals 监控
// ============================================

/**
 * Core Web Vitals 指标
 * - LCP (Largest Contentful Paint): 最大内容绘制 < 2.5s
 * - FID (First Input Delay): 首次输入延迟 < 100ms
 * - CLS (Cumulative Layout Shift): 累积布局偏移 < 0.1
 * - INP (Interaction to Next Paint): 交互到下次绘制 < 200ms (2024 新指标)
 */

class CoreWebVitals {
  constructor(options = {}) {
    this.onReport = options.onReport || this.defaultReport.bind(this);
    this.metrics = {};
  }

  /**
   * 开始监控所有指标
   */
  observe() {
    this.observeLCP();
    this.observeFID();
    this.observeCLS();
    this.observeINP();
  }

  /**
   * LCP - 最大内容绘制
   */
  observeLCP() {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((entries) => {
      const lastEntry = entries.entries.slice(-1)[0];
      const lcp = lastEntry.startTime;

      this.metrics.lcp = {
        value: lcp,
        rating: this.getRating(lcp, [2500, 4000]),
        timestamp: Date.now(),
      };

      this.onReport('LCP', this.metrics.lcp);
    });

    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  }

  /**
   * FID - 首次输入延迟
   */
  observeFID() {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((entries) => {
      entries.entries.forEach((entry) => {
        const fid = entry.processingStart - entry.startTime;

        this.metrics.fid = {
          value: fid,
          rating: this.getRating(fid, [100, 300]),
          timestamp: Date.now(),
        };

        this.onReport('FID', this.metrics.fid);
      });
    });

    observer.observe({ type: 'first-input', buffered: true });
  }

  /**
   * CLS - 累积布局偏移
   */
  observeCLS() {
    if (!('PerformanceObserver' in window)) return;

    let clsValue = 0;

    const observer = new PerformanceObserver((entries) => {
      entries.entries.forEach((entry) => {
        // 只计算非用户输入的布局偏移
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });

      this.metrics.cls = {
        value: clsValue,
        rating: this.getRating(clsValue, [0.1, 0.25]),
        timestamp: Date.now(),
      };

      this.onReport('CLS', this.metrics.cls);
    });

    observer.observe({ type: 'layout-shift', buffered: true });
  }

  /**
   * INP - 交互到下次绘制
   */
  observeINP() {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((entries) => {
      entries.entries.forEach((entry) => {
        const inp = entry.duration;

        this.metrics.inp = {
          value: inp,
          rating: this.getRating(inp, [200, 500]),
          timestamp: Date.now(),
        };

        this.onReport('INP', this.metrics.inp);
      });
    });

    observer.observe({ type: 'interaction', buffered: true });
  }

  /**
   * 获取评级 (好/需要改进/差)
   */
  getRating(value, thresholds) {
    if (value <= thresholds[0]) return 'good';
    if (value <= thresholds[1]) return 'needs-improvement';
    return 'poor';
  }

  /**
   * 默认报告函数
   */
  defaultReport(name, metric) {
    console.log(`[${name}]`, {
      value: `${metric.value.toFixed(2)}${name === 'CLS' ? '' : 'ms'}`,
      rating: metric.rating,
    });
  }

  /**
   * 获取所有指标
   */
  getMetrics() {
    return this.metrics;
  }

  /**
   * 获取综合评分
   */
  getScore() {
    const ratings = Object.values(this.metrics).map((m) => m.rating);
    const goodCount = ratings.filter((r) => r === 'good').length;
    return Math.round((goodCount / ratings.length) * 100);
  }
}

// ============================================
// 2. 页面加载性能监控
// ============================================

class PageLoadMonitor {
  constructor() {
    this.timing = {};
    this.resources = [];
  }

  /**
   * 获取导航时序
   */
  getNavigationTiming() {
    const timing = performance.getEntriesByType('navigation')[0];
    if (!timing) return null;

    return {
      // DNS 解析
      dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,

      // TCP 连接
      tcpConnect: timing.connectEnd - timing.connectStart,

      // SSL 握手
      sslHandshake: timing.secureConnectionStart
        ? timing.connectEnd - timing.secureConnectionStart : 0,

      // TTFB (首字节时间)
      ttfb: timing.responseStart - timing.requestStart,

      // 内容传输
      contentTransfer: timing.responseEnd - timing.responseStart,

      // DOM 解析
      domParsing: timing.domInteractive - timing.domLoading,

      // DOM 就绪
      domReady: timing.domContentLoadedEventEnd - timing.navigationStart,

      // 页面完全加载
      pageLoad: timing.loadEventEnd - timing.navigationStart,

      // 重定向
      redirect: timing.redirectEnd - timing.redirectStart,
    };
  }

  /**
   * 获取资源加载详情
   */
  getResources() {
    const resources = performance.getEntriesByType('resource');

    return resources.map((r) => ({
      name: r.name,
      type: r.initiatorType,
      size: r.transferSize || 0,
      duration: r.duration,
      startTime: r.startTime,
      responseEnd: r.responseEnd,
    }));
  }

  /**
   * 分析资源加载瓶颈
   */
  analyzeBottlenecks() {
    const resources = this.getResources();

    // 按大小排序
    const bySize = [...resources].sort((a, b) => b.size - a.size);

    // 按耗时排序
    const byDuration = [...resources].sort((a, b) => b.duration - a.duration);

    // 慢资源 (> 1s)
    const slowResources = resources.filter((r) => r.duration > 1000);

    // 大资源 (> 1MB)
    const largeResources = resources.filter((r) => r.size > 1024 * 1024);

    return {
      topBySize: bySize.slice(0, 5),
      topByDuration: byDuration.slice(0, 5),
      slowResources,
      largeResources,
      totalSize: resources.reduce((sum, r) => sum + r.size, 0),
      totalCount: resources.length,
    };
  }

  /**
   * 生成性能报告
   */
  generateReport() {
    const timing = this.getNavigationTiming();
    const analysis = this.analyzeBottlenecks();

    return {
      timing,
      resources: analysis,
      recommendations: this.getRecommendations(timing, analysis),
    };
  }

  /**
   * 获取优化建议
   */
  getRecommendations(timing, analysis) {
    const recommendations = [];

    if (timing.dnsLookup > 100) {
      recommendations.push('考虑使用 DNS 预解析 (dns-prefetch)');
    }

    if (timing.tcpConnect > 300) {
      recommendations.push('考虑使用连接复用或 CDN');
    }

    if (timing.ttfb > 600) {
      recommendations.push('优化服务器响应时间，考虑缓存或边缘计算');
    }

    if (analysis.largeResources.length > 0) {
      recommendations.push(`发现 ${analysis.largeResources.length} 个大资源，考虑压缩或拆分`);
    }

    if (analysis.slowResources.length > 0) {
      recommendations.push(`发现 ${analysis.slowResources.length} 个慢资源，考虑懒加载或预加载`);
    }

    return recommendations;
  }
}

// ============================================
// 3. 运行时性能监控
// ============================================

class RuntimeMonitor {
  constructor() {
    this.longTasks = [];
    this.frameDrops = 0;
    this.lastFrameTime = 0;
  }

  /**
   * 监控长任务 (> 50ms)
   */
  observeLongTasks() {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((entries) => {
      entries.entries.forEach((entry) => {
        this.longTasks.push({
          startTime: entry.startTime,
          duration: entry.duration,
          name: entry.name,
        });

        console.warn('⚠️ Long Task detected:', {
          duration: `${entry.duration.toFixed(0)}ms`,
          name: entry.name,
        });
      });
    });

    observer.observe({ type: 'longtask', buffered: true });
  }

  /**
   * 监控帧率
   */
  observeFrameRate() {
    let frameCount = 0;
    let lastTime = performance.now();

    const measureFrame = () => {
      frameCount++;
      const now = performance.now();

      if (now - lastTime >= 1000) {
        const fps = frameCount;
        frameCount = 0;
        lastTime = now;

        if (fps < 30) {
          this.frameDrops++;
          console.warn('⚠️ Low FPS:', fps);
        }
      }

      requestAnimationFrame(measureFrame);
    };

    requestAnimationFrame(measureFrame);
  }

  /**
   * 监控内存使用
   */
  getMemoryUsage() {
    if (performance.memory) {
      return {
        used: performance.memory.usedJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
        total: performance.memory.totalJSHeapSize,
        percent: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100,
      };
    }
    return null;
  }

  /**
   * 获取长任务统计
   */
  getLongTaskStats() {
    if (this.longTasks.length === 0) return null;

    const durations = this.longTasks.map((t) => t.duration);
    return {
      count: this.longTasks.length,
      total: durations.reduce((a, b) => a + b, 0),
      average: durations.reduce((a, b) => a + b, 0) / durations.length,
      max: Math.max(...durations),
      frameDrops: this.frameDrops,
    };
  }
}

// ============================================
// 4. 性能预算监控
// ============================================

class PerformanceBudget {
  constructor(budgets) {
    this.budgets = budgets || {
      maxScriptSize: 300 * 1024, // 300KB
      maxStylesheetSize: 100 * 1024, // 100KB
      maxImageSize: 500 * 1024, // 500KB
      maxTotalSize: 2 * 1024 * 1024, // 2MB
      maxRequests: 50,
      maxLoadTime: 3000, // 3s
      maxLCP: 2500,
      maxCLS: 0.1,
    };
    this.violations = [];
  }

  /**
   * 检查预算
   */
  check() {
    const resources = performance.getEntriesByType('resource');
    const navigation = performance.getEntriesByType('navigation')[0];

    let scriptSize = 0;
    let stylesheetSize = 0;
    let imageSize = 0;
    let totalSize = 0;

    resources.forEach((r) => {
      const size = r.transferSize || 0;
      totalSize += size;

      if (r.initiatorType === 'script') {
        scriptSize += size;
      } else if (r.initiatorType === 'link' && r.name.endsWith('.css')) {
        stylesheetSize += size;
      } else if (r.initiatorType === 'img') {
        imageSize += size;
      }
    });

    // 检查各项预算
    this.checkBudget('scriptSize', scriptSize, this.budgets.maxScriptSize);
    this.checkBudget('stylesheetSize', stylesheetSize, this.budgets.maxStylesheetSize);
    this.checkBudget('imageSize', imageSize, this.budgets.maxImageSize);
    this.checkBudget('totalSize', totalSize, this.budgets.maxTotalSize);
    this.checkBudget('requests', resources.length, this.budgets.maxRequests);

    if (navigation) {
      this.checkBudget('loadTime', navigation.loadEventEnd, this.budgets.maxLoadTime);
    }

    return {
      passed: this.violations.length === 0,
      violations: this.violations,
      metrics: {
        scriptSize,
        stylesheetSize,
        imageSize,
        totalSize,
        requests: resources.length,
      },
    };
  }

  /**
   * 检查单项预算
   */
  checkBudget(name, actual, budget) {
    if (actual > budget) {
      this.violations.push({
        name,
        actual,
        budget,
        exceeded: actual - budget,
        percent: ((actual - budget) / budget * 100).toFixed(1),
      });
    }
  }

  /**
   * 重置违规记录
   */
  reset() {
    this.violations = [];
  }
}

// ============================================
// 5. 性能数据上报
// ============================================

class PerformanceReporter {
  constructor(options = {}) {
    this.endpoint = options.endpoint;
    this.batchSize = options.batchSize || 10;
    this.flushInterval = options.flushInterval || 30000; // 30s
    this.queue = [];
    this.timer = null;
  }

  /**
   * 添加数据到队列
   */
  record(type, data) {
    this.queue.push({
      type,
      data,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    });

    // 达到批次大小则上报
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * 批量上报
   */
  flush() {
    if (this.queue.length === 0 || !this.endpoint) return;

    const payload = this.queue.splice(0, this.batchSize);

    // 使用 sendBeacon 确保数据发送（即使页面关闭）
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    navigator.sendBeacon(this.endpoint, blob);

    console.log(`📊 Reported ${payload.length} performance records`);
  }

  /**
   * 启动定时上报
   */
  start() {
    if (this.timer) return;

    this.timer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * 停止上报
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // 上报剩余数据
    this.flush();
  }
}

// ============================================
// 6. 综合性能监控器
// ============================================

class PerformanceMonitor {
  constructor(options = {}) {
    this.cwv = new CoreWebVitals({
      onReport: (name, metric) => {
        this.reporter?.record('cwv', { name, metric });
      },
    });

    this.pageLoad = new PageLoadMonitor();
    this.runtime = new RuntimeMonitor();
    this.budget = new PerformanceBudget(options.budgets);
    this.reporter = options.endpoint
      ? new PerformanceReporter({ endpoint: options.endpoint }) : null;

    this.initialized = false;
  }

  /**
   * 初始化监控
   */
  init() {
    if (this.initialized) return;

    // Core Web Vitals
    this.cwv.observe();

    // 长任务和帧率
    this.runtime.observeLongTasks();
    this.runtime.observeFrameRate();

    // 上报器
    if (this.reporter) {
      this.reporter.start();
    }

    // 页面卸载时上报最终数据
    window.addEventListener('beforeunload', () => {
      this.reportFinalMetrics();
    });

    this.initialized = true;
    console.log('📊 Performance Monitor initialized');
  }

  /**
   * 上报最终指标
   */
  reportFinalMetrics() {
    const report = this.pageLoad.generateReport();
    const runtime = this.runtime.getLongTaskStats();
    const budget = this.budget.check();

    if (this.reporter) {
      this.reporter.record('pageLoad', report.timing);
      this.reporter.record('resources', report.resources);
      this.reporter.record('runtime', runtime);
      this.reporter.record('budget', budget);
      this.reporter.flush();
    }

    return {
      cwv: this.cwv.getMetrics(),
      pageLoad: report,
      runtime,
      budget,
    };
  }

  /**
   * 获取完整性能报告
   */
  getReport() {
    return this.reportFinalMetrics();
  }
}

// ============================================
// 使用示例
// ============================================

/*
// 基础使用
const monitor = new PerformanceMonitor({
  endpoint: '/api/performance',
  budgets: {
    maxTotalSize: 1.5 * 1024 * 1024, // 1.5MB
    maxLoadTime: 2000 // 2s
  }
});

monitor.init();

// 获取报告
const report = monitor.getReport();
console.log('Performance Report:', report);

// 单独使用 Core Web Vitals
const cwv = new CoreWebVitals({
  onReport: (name, metric) => {
    // 发送到分析服务
    analytics.track(`cwv_${name.toLowerCase()}`, metric);
  }
});
cwv.observe();

// 单独使用页面加载监控
const pageMonitor = new PageLoadMonitor();
const report = pageMonitor.generateReport();
console.log('Recommendations:', report.recommendations);
*/

// ============================================
// 导出
// ============================================

export {
  CoreWebVitals,
  PageLoadMonitor,
  RuntimeMonitor,
  PerformanceBudget,
  PerformanceReporter,
  PerformanceMonitor,
};
