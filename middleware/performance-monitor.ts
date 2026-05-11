/**
 * API 性能监控中间件
 * 
 * 监控指标：
 * - API 响应时间（P50/P90/P99）
 * - 错误率
 * - 并发请求数
 * - 缓存命中率
 */

import { Request, Response, NextFunction } from 'express';
import { promisify } from 'util';

// ==================== 类型定义 ====================

interface RequestMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  statusCode?: number;
  error?: Error;
  path: string;
  method: string;
  cacheHit?: boolean;
}

interface LatencyStats {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  avg: number;
  count: number;
}

interface EndpointMetrics {
  path: string;
  method: string;
  latency: LatencyStats;
  errorCount: number;
  requestCount: number;
  errorRate: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
}

interface AggregatedMetrics {
  totalRequests: number;
  totalErrors: number;
  overallErrorRate: number;
  overallLatency: LatencyStats;
  concurrentRequests: number;
  cacheHitRate: number;
  endpoints: Map<string, EndpointMetrics>;
  timestamp: number;
}

interface AlertThreshold {
  metric: 'latency_p99' | 'error_rate' | 'concurrent' | 'cache_hit_rate';
  operator: '>' | '<' | '>=' | '<=' | '==';
  value: number;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

// ==================== 指标收集器 ====================

class MetricsCollector {
  private latencies: number[] = [];
  private endpointMetrics: Map<string, EndpointMetrics> = new Map();
  private errorCount: number = 0;
  private requestCount: number = 0;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private concurrentRequests: number = 0;
  private alerts: AlertThreshold[] = [];
  private maxLatencies: number = 10000; // 保留最近 10000 个延迟数据

  constructor() {
    // 默认告警阈值
    this.alerts = [
      { metric: 'latency_p99', operator: '>', value: 300, message: 'P99 响应时间超过 300ms', severity: 'warning' },
      { metric: 'latency_p99', operator: '>', value: 500, message: 'P99 响应时间超过 500ms', severity: 'critical' },
      { metric: 'error_rate', operator: '>', value: 0.1, message: '错误率超过 0.1%', severity: 'warning' },
      { metric: 'error_rate', operator: '>', value: 1, message: '错误率超过 1%', severity: 'critical' },
      { metric: 'cache_hit_rate', operator: '<', value: 80, message: '缓存命中率低于 80%', severity: 'warning' },
      { metric: 'concurrent', operator: '>', value: 100, message: '并发请求超过 100', severity: 'warning' },
    ];
  }

  /**
   * 记录请求开始
   */
  startRequest(req: Request): RequestMetrics {
    this.concurrentRequests++;
    
    return {
      startTime: Date.now(),
      path: req.path,
      method: req.method,
    };
  }

  /**
   * 记录请求结束
   */
  endRequest(metrics: RequestMetrics, res: Response, error?: Error) {
    this.concurrentRequests--;
    this.requestCount++;

    const duration = Date.now() - metrics.startTime;
    metrics.endTime = Date.now();
    metrics.duration = duration;
    metrics.statusCode = res.statusCode;
    metrics.error = error;

    // 记录延迟
    this.latencies.push(duration);
    if (this.latencies.length > this.maxLatencies) {
      this.latencies.shift(); // 移除最旧的数据
    }

    // 记录错误
    if (error || res.statusCode >= 400) {
      this.errorCount++;
    }

    // 记录缓存命中
    if (metrics.cacheHit !== undefined) {
      if (metrics.cacheHit) {
        this.cacheHits++;
      } else {
        this.cacheMisses++;
      }
    }

    // 更新端点指标
    this.updateEndpointMetrics(metrics, duration, error);

    // 检查告警
    this.checkAlerts();
  }

  /**
   * 记录缓存命中
   */
  recordCacheHit(hit: boolean) {
    if (hit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }
  }

  /**
   * 计算百分位数
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * 计算延迟统计
   */
  getLatencyStats(latencies: number[] = this.latencies): LatencyStats {
    if (latencies.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0, count: 0 };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const sum = latencies.reduce((a, b) => a + b, 0);

    return {
      p50: this.percentile(sorted, 50),
      p90: this.percentile(sorted, 90),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / latencies.length,
      count: latencies.length,
    };
  }

  /**
   * 更新端点指标
   */
  private updateEndpointMetrics(
    metrics: RequestMetrics,
    duration: number,
    error?: Error
  ) {
    const key = `${metrics.method}:${metrics.path}`;
    
    let endpoint = this.endpointMetrics.get(key);
    
    if (!endpoint) {
      endpoint = {
        path: metrics.path,
        method: metrics.method,
        latency: { p50: 0, p90: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0, count: 0 },
        errorCount: 0,
        requestCount: 0,
        errorRate: 0,
        cacheHits: 0,
        cacheMisses: 0,
        cacheHitRate: 0,
      };
      this.endpointMetrics.set(key, endpoint);
    }

    endpoint.requestCount++;
    if (error || (metrics.statusCode && metrics.statusCode >= 400)) {
      endpoint.errorCount++;
    }
    endpoint.errorRate = (endpoint.errorCount / endpoint.requestCount) * 100;

    if (metrics.cacheHit !== undefined) {
      if (metrics.cacheHit) {
        endpoint.cacheHits++;
      } else {
        endpoint.cacheMisses++;
      }
      const total = endpoint.cacheHits + endpoint.cacheMisses;
      endpoint.cacheHitRate = total > 0 ? (endpoint.cacheHits / total) * 100 : 0;
    }

    // 更新延迟统计（简化版，实际应该维护端点级别的延迟数组）
    endpoint.latency.count++;
    endpoint.latency.avg = ((endpoint.latency.avg * (endpoint.latency.count - 1)) + duration) / endpoint.latency.count;
    endpoint.latency.min = endpoint.latency.count === 1 ? duration : Math.min(endpoint.latency.min, duration);
    endpoint.latency.max = Math.max(endpoint.latency.max, duration);
    // P50/P90/P99 需要维护数组，这里简化为使用全局统计
    endpoint.latency.p50 = this.getLatencyStats().p50;
    endpoint.latency.p90 = this.getLatencyStats().p90;
    endpoint.latency.p99 = this.getLatencyStats().p99;
  }

  /**
   * 检查告警
   */
  private checkAlerts() {
    const stats = this.getAggregatedMetrics();

    for (const alert of this.alerts) {
      let value: number;
      let triggered = false;

      switch (alert.metric) {
        case 'latency_p99':
          value = stats.overallLatency.p99;
          triggered = this.evaluate(alert.operator, value, alert.value);
          break;
        case 'error_rate':
          value = stats.overallErrorRate;
          triggered = this.evaluate(alert.operator, value, alert.value);
          break;
        case 'concurrent':
          value = stats.concurrentRequests;
          triggered = this.evaluate(alert.operator, value, alert.value);
          break;
        case 'cache_hit_rate':
          value = stats.cacheHitRate;
          triggered = this.evaluate(alert.operator, value, alert.value);
          break;
      }

      if (triggered) {
        this.emitAlert(alert);
      }
    }
  }

  private evaluate(operator: string, actual: number, threshold: number): boolean {
    switch (operator) {
      case '>': return actual > threshold;
      case '<': return actual < threshold;
      case '>=': return actual >= threshold;
      case '<=': return actual <= threshold;
      case '==': return actual === threshold;
      default: return false;
    }
  }

  private emitAlert(alert: AlertThreshold) {
    const timestamp = new Date().toISOString();
    console.log(`[ALERT] ${alert.severity.toUpperCase()} - ${alert.message} (${timestamp})`);
    
    // 可以集成到告警系统（如 Slack、钉钉等）
    // await sendAlert(alert);
  }

  /**
   * 获取聚合指标
   */
  getAggregatedMetrics(): AggregatedMetrics {
    return {
      totalRequests: this.requestCount,
      totalErrors: this.errorCount,
      overallErrorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0,
      overallLatency: this.getLatencyStats(),
      concurrentRequests: this.concurrentRequests,
      cacheHitRate: (this.cacheHits + this.cacheMisses) > 0 
        ? (this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100 
        : 0,
      endpoints: this.endpointMetrics,
      timestamp: Date.now(),
    };
  }

  /**
   * 重置指标
   */
  reset() {
    this.latencies = [];
    this.errorCount = 0;
    this.requestCount = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.endpointMetrics.clear();
  }

  /**
   * 导出 Prometheus 格式指标
   */
  toPrometheus(): string {
    const stats = this.getAggregatedMetrics();
    const timestamp = Date.now();

    return `
# HELP api_requests_total Total number of API requests
# TYPE api_requests_total counter
api_requests_total ${stats.totalRequests}

# HELP api_errors_total Total number of API errors
# TYPE api_errors_total counter
api_errors_total ${stats.totalErrors}

# HELP api_error_rate API error rate percentage
# TYPE api_error_rate gauge
api_error_rate ${stats.overallErrorRate}

# HELP api_latency_p50 API latency P50 in milliseconds
# TYPE api_latency_p50 gauge
api_latency_p50 ${stats.overallLatency.p50}

# HELP api_latency_p90 API latency P90 in milliseconds
# TYPE api_latency_p90 gauge
api_latency_p90 ${stats.overallLatency.p90}

# HELP api_latency_p99 API latency P99 in milliseconds
# TYPE api_latency_p99 gauge
api_latency_p99 ${stats.overallLatency.p99}

# HELP api_latency_avg API average latency in milliseconds
# TYPE api_latency_avg gauge
api_latency_avg ${stats.overallLatency.avg}

# HELP api_concurrent_requests Current number of concurrent requests
# TYPE api_concurrent_requests gauge
api_concurrent_requests ${stats.concurrentRequests}

# HELP api_cache_hit_rate Cache hit rate percentage
# TYPE api_cache_hit_rate gauge
api_cache_hit_rate ${stats.cacheHitRate}
`.trim();
  }
}

// ==================== 性能监控中间件 ====================

class PerformanceMonitor {
  private collector: MetricsCollector;
  private enabled: boolean = true;
  private slowThreshold: number = 100; // ms

  constructor() {
    this.collector = new MetricsCollector();
  }

  /**
   * Express 中间件
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.enabled) {
        return next();
      }

      const metrics = this.collector.startRequest(req);

      // 监听响应完成
      res.on('finish', () => {
        this.collector.endRequest(metrics, res);
        this.logSlowRequest(metrics);
      });

      // 监听错误
      res.on('error', (error) => {
        this.collector.endRequest(metrics, res, error);
      });

      next();
    };
  }

  /**
   * 记录慢请求
   */
  private logSlowRequest(metrics: RequestMetrics) {
    if (metrics.duration && metrics.duration > this.slowThreshold) {
      console.warn(
        `[SLOW REQUEST] ${metrics.method} ${metrics.path} - ${metrics.duration}ms - ${metrics.statusCode}`
      );
    }
  }

  /**
   * 获取指标
   */
  getMetrics() {
    return this.collector.getAggregatedMetrics();
  }

  /**
   * 获取 Prometheus 格式指标
   */
  getPrometheusMetrics() {
    return this.collector.toPrometheus();
  }

  /**
   * 记录缓存命中
   */
  recordCacheHit(hit: boolean) {
    this.collector.recordCacheHit(hit);
  }

  /**
   * 启用/禁用监控
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * 设置慢请求阈值
   */
  setSlowThreshold(ms: number) {
    this.slowThreshold = ms;
  }

  /**
   * 重置指标
   */
  reset() {
    this.collector.reset();
  }
}

// ==================== 性能报告生成器 ====================

class PerformanceReporter {
  private monitor: PerformanceMonitor;

  constructor(monitor: PerformanceMonitor) {
    this.monitor = monitor;
  }

  /**
   * 生成性能报告
   */
  generateReport(): string {
    const metrics = this.monitor.getMetrics();
    const now = new Date().toISOString();

    return `
╔══════════════════════════════════════════════════════════╗
║              性能监控报告 (Performance Report)            ║
╠══════════════════════════════════════════════════════════╣
║ 生成时间：${now}
╠══════════════════════════════════════════════════════════╣

📊 总体指标
────────────────────────────────────────────────────────────
  总请求数：    ${metrics.totalRequests.toLocaleString()}
  总错误数：    ${metrics.totalErrors.toLocaleString()}
  错误率：      ${metrics.overallErrorRate.toFixed(3)}%
  并发请求：    ${metrics.concurrentRequests}
  缓存命中率：  ${metrics.cacheHitRate.toFixed(2)}%

⏱️ 响应时间 (ms)
────────────────────────────────────────────────────────────
  P50:          ${metrics.overallLatency.p50.toFixed(2)}
  P90:          ${metrics.overallLatency.p90.toFixed(2)}
  P95:          ${metrics.overallLatency.p95.toFixed(2)}
  P99:          ${metrics.overallLatency.p99.toFixed(2)}
  平均：        ${metrics.overallLatency.avg.toFixed(2)}
  最小：        ${metrics.overallLatency.min.toFixed(2)}
  最大：        ${metrics.overallLatency.max.toFixed(2)}

🎯 性能目标状态
────────────────────────────────────────────────────────────
  API P99 <300ms:    ${metrics.overallLatency.p99 < 300 ? '✅ 达标' : '❌ 未达标'}
  缓存命中率 >80%:   ${metrics.cacheHitRate > 80 ? '✅ 达标' : '❌ 未达标'}
  错误率 <0.1%:      ${metrics.overallErrorRate < 0.1 ? '✅ 达标' : '❌ 未达标'}
  并发支持 >100:     ${metrics.concurrentRequests >= 100 ? '⚠️  接近上限' : '✅ 正常'}

╚══════════════════════════════════════════════════════════╝
`.trim();
  }

  /**
   * 生成 JSON 报告
   */
  toJSON() {
    return this.monitor.getMetrics();
  }
}

// ==================== 单例 ====================

let performanceMonitorInstance: PerformanceMonitor | null = null;

/**
 * 获取性能监控器单例
 */
export function getPerformanceMonitor(): PerformanceMonitor {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new PerformanceMonitor();
  }
  return performanceMonitorInstance;
}

/**
 * 获取性能报告器
 */
export function getPerformanceReporter(): PerformanceReporter {
  return new PerformanceReporter(getPerformanceMonitor());
}

// ==================== 导出 ====================

export {
  PerformanceMonitor,
  PerformanceReporter,
  MetricsCollector,
  RequestMetrics,
  LatencyStats,
  EndpointMetrics,
  AggregatedMetrics,
  AlertThreshold,
};

export default PerformanceMonitor;
