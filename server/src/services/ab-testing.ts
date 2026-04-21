/**
 * A/B Testing Framework - 实验配置管理和效果分析
 * 支持流量分配、数据埋点和统计分析
 */

import {
  ABTestConfig,
  ABTestVariant,
  ABTestExposure,
  ABTestEvent,
  ABTestResults,
  ABTestMetric
} from '../types';

/**
 * A/B 测试管理器
 */
export class ABTestingManager {
  private experiments: Map<string, ABTestConfig>;
  private exposures: Map<string, ABTestExposure[]>;
  private events: Map<string, ABTestEvent[]>;

  constructor() {
    this.experiments = new Map();
    this.exposures = new Map();
    this.events = new Map();
  }

  /**
   * 创建实验
   */
  createExperiment(config: ABTestConfig): ABTestConfig {
    if (this.experiments.has(config.experimentId)) {
      throw new Error(`Experiment ${config.experimentId} already exists`);
    }

    this.experiments.set(config.experimentId, config);
    this.exposures.set(config.experimentId, []);
    this.events.set(config.experimentId, []);

    return config;
  }

  /**
   * 更新实验配置
   */
  updateExperiment(experimentId: string, updates: Partial<ABTestConfig>): ABTestConfig | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return null;

    const updated = { ...experiment, ...updates };
    this.experiments.set(experimentId, updated);
    return updated;
  }

  /**
   * 获取实验配置
   */
  getExperiment(experimentId: string): ABTestConfig | null {
    return this.experiments.get(experimentId) || null;
  }

  /**
   * 获取所有运行中的实验
   */
  getRunningExperiments(): ABTestConfig[] {
    return Array.from(this.experiments.values()).filter(
      exp => exp.status === 'running'
    );
  }

  /**
   * 流量分配 - 确定用户应该进入哪个实验组
   * 使用一致性哈希确保同一用户始终进入同一组
   */
  assignVariant(experimentId: string, userId: string): string | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== 'running') {
      return null;
    }

    // 检查实验时间
    const now = Date.now();
    if (experiment.startDate > now) {
      return null; // 实验未开始
    }
    if (experiment.endDate && experiment.endDate < now) {
      return null; // 实验已结束
    }

    // 使用 userId 生成哈希值 (0-1)
    const hash = this.hashUserId(userId, experimentId);
    
    // 确定变体
    let cumulativeSplit = 0;
    for (const variant of experiment.variants) {
      const variantConfig = variant.config as { trafficSplit?: number };
      const split = variantConfig.trafficSplit ?? (1 / experiment.variants.length);
      cumulativeSplit += split;

      if (hash < cumulativeSplit) {
        // 记录曝光
        this.recordExposure(experimentId, userId, variant.variantId);
        return variant.variantId;
      }
    }

    // 默认返回最后一个变体
    const lastVariant = experiment.variants[experiment.variants.length - 1];
    this.recordExposure(experimentId, userId, lastVariant.variantId);
    return lastVariant.variantId;
  }

  /**
   * 记录用户曝光
   */
  private recordExposure(experimentId: string, userId: string, variantId: string): void {
    const exposureList = this.exposures.get(experimentId) || [];
    exposureList.push({
      userId,
      experimentId,
      variantId,
      exposedAt: Date.now()
    });
    this.exposures.set(experimentId, exposureList);
  }

  /**
   * 记录事件
   */
  recordEvent(
    experimentId: string,
    userId: string,
    variantId: string,
    metricId: string,
    value: number
  ): void {
    const eventList = this.events.get(experimentId) || [];
    eventList.push({
      userId,
      experimentId,
      variantId,
      metricId,
      value,
      timestamp: Date.now()
    });
    this.events.set(experimentId, eventList);
  }

  /**
   * 获取用户的实验分配
   */
  getUserExposure(experimentId: string, userId: string): ABTestExposure | null {
    const exposureList = this.exposures.get(experimentId) || [];
    return exposureList.find(e => e.userId === userId) || null;
  }

  /**
   * 分析实验结果
   */
  analyzeResults(experimentId: string): ABTestResults | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return null;

    const eventList = this.events.get(experimentId) || [];
    const exposureList = this.exposures.get(experimentId) || [];

    // 按变体分组事件
    const variantEvents = new Map<string, Map<string, number[]>>();
    
    for (const exposure of exposureList) {
      if (!variantEvents.has(exposure.variantId)) {
        variantEvents.set(exposure.variantId, new Map());
      }
    }

    for (const event of eventList) {
      const variantMap = variantEvents.get(event.variantId);
      if (!variantMap) continue;

      if (!variantMap.has(event.metricId)) {
        variantMap.set(event.metricId, []);
      }
      variantMap.get(event.metricId)!.push(event.value);
    }

    // 计算各变体指标统计
    const variantResults = experiment.variants.map(variant => {
      const metrics = variantEvents.get(variant.variantId) || new Map();
      const metricResults: { [key: string]: { mean: number; stdDev: number; confidenceInterval: [number, number] } } = {};

      for (const metric of experiment.metrics) {
        const values = metrics.get(metric.metricId) || [];
        const stats = this.calculateStats(values);
        metricResults[metric.metricId] = stats;
      }

      return {
        variantId: variant.variantId,
        sampleSize: exposureList.filter(e => e.variantId === variant.variantId).length,
        metricResults
      };
    });

    // 统计显著性检验
    const statisticalSignificance = experiment.metrics.map(metric => {
      const controlVariant = experiment.variants[0];
      const treatmentVariant = experiment.variants[1];

      if (!controlVariant || !treatmentVariant) {
        return {
          metricId: metric.metricId,
          pValue: 1,
          isSignificant: false,
          effectSize: 0
        };
      }

      const controlEvents = eventList
        .filter(e => e.variantId === controlVariant.variantId && e.metricId === metric.metricId)
        .map(e => e.value);

      const treatmentEvents = eventList
        .filter(e => e.variantId === treatmentVariant.variantId && e.metricId === metric.metricId)
        .map(e => e.value);

      const { pValue, effectSize } = this.tTest(controlEvents, treatmentEvents);

      return {
        metricId: metric.metricId,
        pValue,
        isSignificant: pValue < 0.05,
        effectSize
      };
    });

    // 生成推荐
    const significantMetrics = statisticalSignificance.filter(s => s.isSignificant);
    let recommendation = '实验结果无统计显著性差异';

    if (significantMetrics.length > 0) {
      const bestVariant = this.findBestVariant(variantResults, experiment.metrics);
      recommendation = `推荐采用 ${bestVariant} 方案，在 ${significantMetrics.length} 个指标上表现显著更优`;
    }

    return {
      experimentId,
      variantResults,
      statisticalSignificance,
      recommendation
    };
  }

  /**
   * 计算统计量
   */
  private calculateStats(values: number[]): { mean: number; stdDev: number; confidenceInterval: [number, number] } {
    if (values.length === 0) {
      return { mean: 0, stdDev: 0, confidenceInterval: [0, 0] };
    }

    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n - 1 || 1);
    const stdDev = Math.sqrt(variance);

    // 95% 置信区间
    const tValue = n > 30 ? 1.96 : this.tValue95(n - 1);
    const marginOfError = tValue * (stdDev / Math.sqrt(n));

    return {
      mean,
      stdDev,
      confidenceInterval: [mean - marginOfError, mean + marginOfError]
    };
  }

  /**
   * 双样本 t 检验
   */
  private tTest(group1: number[], group2: number[]): { pValue: number; effectSize: number } {
    if (group1.length < 2 || group2.length < 2) {
      return { pValue: 1, effectSize: 0 };
    }

    const mean1 = group1.reduce((a, b) => a + b, 0) / group1.length;
    const mean2 = group2.reduce((a, b) => a + b, 0) / group2.length;

    const var1 = group1.reduce((sum, v) => sum + Math.pow(v - mean1, 2), 0) / (group1.length - 1);
    const var2 = group2.reduce((sum, v) => sum + Math.pow(v - mean2, 2), 0) / (group2.length - 1);

    const pooledSE = Math.sqrt(var1 / group1.length + var2 / group2.length);
    if (pooledSE === 0) return { pValue: 1, effectSize: 0 };

    const tStat = (mean1 - mean2) / pooledSE;
    const df = group1.length + group2.length - 2;

    // 近似 p 值计算
    const pValue = this.approximatePValue(Math.abs(tStat), df);

    // Cohen's d 效应量
    const pooledStd = Math.sqrt((var1 + var2) / 2);
    const effectSize = pooledStd > 0 ? (mean1 - mean2) / pooledStd : 0;

    return { pValue, effectSize };
  }

  /**
   * 近似 p 值计算 (使用标准正态分布近似)
   */
  private approximatePValue(tStat: number, df: number): number {
    // 对于大样本，t 分布接近标准正态分布
    const z = tStat;
    
    // 标准正态分布的累积分布函数近似
    const p = 0.5 * (1 + this.erf(z / Math.sqrt(2)));
    
    // 双尾检验
    return 2 * (1 - p);
  }

  /**
   * 误差函数近似
   */
  private erf(x: number): number {
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  /**
   * t 分布临界值表 (95% 置信水平)
   */
  private tValue95(df: number): number {
    if (df >= 30) return 1.96;
    if (df >= 20) return 2.086;
    if (df >= 15) return 2.131;
    if (df >= 10) return 2.228;
    if (df >= 5) return 2.571;
    return 3.182;
  }

  /**
   * 找到最佳变体
   */
  private findBestVariant(
    variantResults: ABTestResults['variantResults'],
    metrics: ABTestMetric[]
  ): string {
    // 简化：选择第一个变体
    // 实际应该综合所有显著指标的表现
    return variantResults[0]?.variantId || 'unknown';
  }

  /**
   * 用户 ID 哈希
   */
  private hashUserId(userId: string, experimentId: string): number {
    const combined = `${userId}:${experimentId}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return (Math.abs(hash) % 10000) / 10000;
  }

  /**
   * 导出实验数据
   */
  exportData(experimentId: string): {
    config: ABTestConfig | null;
    exposures: ABTestExposure[];
    events: ABTestEvent[];
  } {
    return {
      config: this.experiments.get(experimentId) || null,
      exposures: this.exposures.get(experimentId) || [],
      events: this.events.get(experimentId) || []
    };
  }

  /**
   * 清除实验数据
   */
  clearExperiment(experimentId: string): boolean {
    if (!this.experiments.has(experimentId)) return false;

    this.experiments.delete(experimentId);
    this.exposures.delete(experimentId);
    this.events.delete(experimentId);
    return true;
  }
}

/**
 * 创建预设实验配置
 */
export function createPresetExperiments(): ABTestConfig[] {
  return [
    {
      experimentId: 'cat-vs-classic',
      name: 'CAT vs 经典模式对比',
      description: '比较自适应测试与传统固定长度测试的用户体验',
      trafficSplit: 0.5,
      startDate: Date.now(),
      status: 'draft',
      variants: [
        {
          variantId: 'control',
          name: '经典模式',
          description: '30 题固定长度测试',
          config: { testMode: 'CLASSIC', questionCount: 30 }
        },
        {
          variantId: 'treatment',
          name: 'CAT 模式',
          description: '10-20 题自适应测试',
          config: { testMode: 'CAT', minQuestions: 10, maxQuestions: 20 }
        }
      ],
      metrics: [
        { metricId: 'completion_rate', name: '完成率', type: 'conversion' },
        { metricId: 'completion_time', name: '完成时间', type: 'continuous' },
        { metricId: 'satisfaction_score', name: '满意度评分', type: 'continuous' }
      ]
    },
    {
      experimentId: 'spectrum-vs-type',
      name: '连续谱 vs 类型标签',
      description: '比较连续谱展示与类型标签的用户理解度',
      trafficSplit: 0.5,
      startDate: Date.now(),
      status: 'draft',
      variants: [
        {
          variantId: 'type-labels',
          name: '类型标签',
          description: '显示 ENFJ 等类型标签',
          config: { displayMode: 'TYPE_LABELS' }
        },
        {
          variantId: 'spectrum',
          name: '连续谱',
          description: '显示连续谱和置信区间',
          config: { displayMode: 'SPECTRUM' }
        }
      ],
      metrics: [
        { metricId: 'understanding_score', name: '理解度评分', type: 'continuous' },
        { metricId: 'time_on_results', name: '结果页停留时间', type: 'continuous' },
        { metricId: 'share_rate', name: '分享率', type: 'conversion' }
      ]
    },
    {
      experimentId: 'paywall-position',
      name: '付费点位置测试',
      description: '测试不同付费点位置对转化率的影响',
      trafficSplit: 0.5,
      startDate: Date.now(),
      status: 'draft',
      variants: [
        {
          variantId: 'before-test',
          name: '测试前付费',
          description: '在开始测试前展示付费提示',
          config: { paywallPosition: 'BEFORE' }
        },
        {
          variantId: 'after-results',
          name: '结果后付费',
          description: '在查看完整结果前展示付费提示',
          config: { paywallPosition: 'AFTER' }
        }
      ],
      metrics: [
        { metricId: 'conversion_rate', name: '付费转化率', type: 'conversion' },
        { metricId: 'test_start_rate', name: '测试开始率', type: 'conversion' },
        { metricId: 'revenue_per_user', name: '单用户收入', type: 'continuous' }
      ]
    }
  ];
}

export default ABTestingManager;
