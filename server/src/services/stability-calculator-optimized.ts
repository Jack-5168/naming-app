/**
 * 人格稳定性计算器 - 性能优化版
 * 
 * 针对高并发场景优化，支持 >50 QPS
 */

import {
  TestResult,
  StabilityResult,
  DimensionStats,
  MonteCarloConfig,
  DEFAULT_CONFIG,
  MBTIDimension,
} from './stability-types';

/**
 * 优化的稳定性计算器 (高性能版)
 */
export class StabilityCalculatorOptimized {
  private config: MonteCarloConfig;
  private preAllocatedArrays: Map<number, number[]> = new Map();

  constructor(config?: Partial<MonteCarloConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 计算用户人格稳定性 (优化版)
   */
  async calculateStability(
    userId: number,
    testHistory: TestResult[]
  ): Promise<StabilityResult> {
    const startTime = Date.now();
    const testCount = testHistory.length;

    if (testCount < 3) {
      return this.createInsufficientDataResult(userId, testCount, startTime);
    }

    const perDimension = this.calculateDimensionStatsOptimized(testHistory);
    const stabilityIndex = this.calculateStabilityIndex(perDimension);
    const bootstrapCVs = this.runMonteCarloSimulationOptimized(testHistory);
    const { stabilityProbability, isRange, stabilityProbabilityDisplay } =
      this.calculateStabilityProbability(bootstrapCVs, testCount);
    const confidenceBand = this.calculateConfidenceInterval(bootstrapCVs);
    const status = this.determineStatus(stabilityIndex, testCount);
    const stabilityWarning = this.generateWarning(stabilityIndex, testCount);

    const calculationTime = Date.now() - startTime;

    return {
      stabilityIndex,
      stabilityProbability,
      stabilityProbabilityDisplay,
      isRange,
      stabilityWarning,
      confidenceBand,
      status,
      perDimension,
      metadata: {
        testCount,
        calculationTime,
        bootstrapIterations: this.config.bootstrapIterations,
      },
    };
  }

  /**
   * 优化的维度统计计算 (避免重复遍历)
   */
  private calculateDimensionStatsOptimized(testHistory: TestResult[]): {
    O: DimensionStats;
    C: DimensionStats;
    E: DimensionStats;
    A: DimensionStats;
    N: DimensionStats;
  } {
    const n = testHistory.length;
    const dims: MBTIDimension[] = ['O', 'C', 'E', 'A', 'N'];
    
    // 一次性收集所有分数
    const scoresByDim: Record<MBTIDimension, number[]> = {
      O: new Array(n),
      C: new Array(n),
      E: new Array(n),
      A: new Array(n),
      N: new Array(n),
    };

    for (let i = 0; i < n; i++) {
      const test = testHistory[i];
      scoresByDim.O[i] = test.scores.O;
      scoresByDim.C[i] = test.scores.C;
      scoresByDim.E[i] = test.scores.E;
      scoresByDim.A[i] = test.scores.A;
      scoresByDim.N[i] = test.scores.N;
    }

    const result: any = {};
    for (const dim of dims) {
      const scores = scoresByDim[dim];
      const mean = this.meanOptimized(scores);
      const std = this.stdOptimized(scores, mean);
      const cv = mean !== 0 ? Math.abs(std / mean) : 0;
      result[dim] = { mean, std, cv };
    }

    return result as {
      O: DimensionStats;
      C: DimensionStats;
      E: DimensionStats;
      A: DimensionStats;
      N: DimensionStats;
    };
  }

  /**
   * 优化的 Monte Carlo 模拟 (使用 TypedArray)
   */
  private runMonteCarloSimulationOptimized(testHistory: TestResult[]): number[] {
    const iterations = this.config.bootstrapIterations;
    const cvs = new Float64Array(iterations);
    const n = testHistory.length;
    const dims: MBTIDimension[] = ['O', 'C', 'E', 'A', 'N'];

    // 预分配重采样数组
    const resampledIndices = new Int32Array(n);

    for (let i = 0; i < iterations; i++) {
      // 生成随机索引
      for (let j = 0; j < n; j++) {
        resampledIndices[j] = Math.floor(Math.random() * n);
      }

      // 直接计算重采样的统计，避免创建新数组
      let totalCV = 0;

      for (const dim of dims) {
        // 计算重采样后的均值
        let sum = 0;
        for (let j = 0; j < n; j++) {
          sum += testHistory[resampledIndices[j]].scores[dim];
        }
        const mean = sum / n;

        // 计算重采样后的标准差
        let sumSq = 0;
        for (let j = 0; j < n; j++) {
          const val = testHistory[resampledIndices[j]].scores[dim];
          sumSq += (val - mean) * (val - mean);
        }
        const std = Math.sqrt(sumSq / (n - 1));

        // 计算 CV
        const cv = mean !== 0 ? Math.abs(std / mean) : 0;
        totalCV += cv;
      }

      cvs[i] = totalCV / dims.length;
    }

    return Array.from(cvs);
  }

  /**
   * 优化的均值计算
   */
  private meanOptimized(values: number[]): number {
    const n = values.length;
    if (n === 0) return 0;
    
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += values[i];
    }
    return sum / n;
  }

  /**
   * 优化的标准差计算
   */
  private stdOptimized(values: number[], mean: number): number {
    const n = values.length;
    if (n < 2) return 0;

    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const diff = values[i] - mean;
      sumSq += diff * diff;
    }
    return Math.sqrt(sumSq / (n - 1));
  }

  private calculateStabilityIndex(perDimension: {
    O: DimensionStats;
    C: DimensionStats;
    E: DimensionStats;
    A: DimensionStats;
    N: DimensionStats;
  }): number {
    const dims: MBTIDimension[] = ['O', 'C', 'E', 'A', 'N'];
    let totalCV = 0;
    for (const dim of dims) {
      totalCV += perDimension[dim].cv;
    }
    const meanCV = totalCV / dims.length;
    return Math.max(0, Math.min(1, 1 - meanCV));
  }

  private calculateStabilityProbability(
    bootstrapCVs: number[],
    testCount: number
  ): {
    stabilityProbability: number;
    isRange: boolean;
    stabilityProbabilityDisplay: string;
  } {
    const threshold = this.config.stabilityThreshold;
    let stableCount = 0;
    for (const cv of bootstrapCVs) {
      if (cv <= threshold) stableCount++;
    }
    const probability = (stableCount / bootstrapCVs.length) * 100;

    if (testCount < 3) {
      return {
        stabilityProbability: probability,
        isRange: false,
        stabilityProbabilityDisplay: '数据不足',
      };
    } else if (testCount <= 5) {
      const margin = 5 + (5 - testCount) * 2;
      const lower = Math.max(0, Math.round(probability - margin));
      const upper = Math.min(100, Math.round(probability + margin));
      return {
        stabilityProbability: probability,
        isRange: true,
        stabilityProbabilityDisplay: `${lower}%~${upper}%`,
      };
    } else {
      return {
        stabilityProbability: probability,
        isRange: false,
        stabilityProbabilityDisplay: `${Math.round(probability)}%`,
      };
    }
  }

  private calculateConfidenceInterval(bootstrapCVs: number[]): [number, number] {
    const sorted = [...bootstrapCVs].sort((a, b) => a - b);
    const n = sorted.length;
    const lowerIndex = Math.floor(n * 0.025);
    const upperIndex = Math.floor(n * 0.975);
    const lowerCV = sorted[lowerIndex];
    const upperCV = sorted[upperIndex];
    const lowerStability = Math.max(0, Math.min(1, 1 - upperCV));
    const upperStability = Math.max(0, Math.min(1, 1 - lowerCV));
    return [lowerStability, upperStability];
  }

  private determineStatus(
    stabilityIndex: number,
    testCount: number
  ): 'stable' | 'evolving' | 'unstable' | 'insufficient_data' {
    if (testCount < 3) return 'insufficient_data';
    if (testCount <= 5) return 'evolving';
    if (stabilityIndex >= 0.8) return 'stable';
    if (stabilityIndex >= 0.6) return 'evolving';
    return 'unstable';
  }

  private generateWarning(
    stabilityIndex: number,
    testCount: number
  ): string | null {
    if (testCount < 3) {
      return '测试次数不足，建议完成至少 3 次测试以获得有效评估';
    } else if (testCount <= 5) {
      return '测试次数较少，结果可能存在波动，建议继续测试以提高准确性';
    } else if (stabilityIndex < 0.6) {
      return '人格稳定性较低，建议关注情绪和行为的一致性';
    }
    return null;
  }

  private createInsufficientDataResult(
    userId: number,
    testCount: number,
    startTime: number
  ): StabilityResult {
    const calculationTime = Date.now() - startTime;
    return {
      stabilityIndex: 0,
      stabilityProbability: 0,
      stabilityProbabilityDisplay: '数据不足',
      isRange: false,
      stabilityWarning: '测试次数不足，建议完成至少 3 次测试以获得有效评估',
      confidenceBand: [0, 0],
      status: 'insufficient_data',
      perDimension: {
        O: { mean: 0, std: 0, cv: 0 },
        C: { mean: 0, std: 0, cv: 0 },
        E: { mean: 0, std: 0, cv: 0 },
        A: { mean: 0, std: 0, cv: 0 },
        N: { mean: 0, std: 0, cv: 0 },
      },
      metadata: { testCount, calculationTime, bootstrapIterations: 0 },
    };
  }
}

export default StabilityCalculatorOptimized;
