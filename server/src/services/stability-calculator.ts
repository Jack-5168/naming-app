/**
 * Stability Calculator - 人格稳定性指数计算
 * 使用 Monte Carlo 模拟计算稳定性概率和置信区间
 */

import {
  TestResult,
  StabilityResult,
  StabilityConfig,
  DimensionStability
} from '../types';

const DEFAULT_CONFIG: StabilityConfig = {
  monteCarloIterations: 10000,
  confidenceLevel: 0.95,
  minTestsForStable: 6,
  minTestsForEvolving: 3
};

/**
 * Box-Muller 变换生成标准正态分布随机数
 */
function boxMullerRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * 计算单个维度的稳定性
 */
function calculateDimensionStability(scores: number[]): DimensionStability {
  if (scores.length === 0) {
    return {
      mean: 50,
      stdDev: 0,
      range: 0,
      stabilityIndex: 0
    };
  }

  const n = scores.length;
  const mean = scores.reduce((a, b) => a + b, 0) / n;
  
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / (n - 1 || 1);
  const stdDev = Math.sqrt(variance);
  
  const range = Math.max(...scores) - Math.min(...scores);
  
  // 稳定性指数：基于变异系数 (CV)
  // CV = stdDev / mean, 越小越稳定
  const cv = mean > 0 ? stdDev / mean : stdDev / 50;
  const stabilityIndex = Math.max(0, 1 - cv);

  return {
    mean,
    stdDev,
    range,
    stabilityIndex
  };
}

/**
 * 计算稳定性指数
 * @param userId 用户 ID
 * @param testHistory 测试历史
 * @returns 稳定性结果
 */
export async function calculateStability(
  userId: number,
  testHistory: TestResult[]
): Promise<StabilityResult> {
  const config = DEFAULT_CONFIG;

  // 边界条件处理
  if (testHistory.length < config.minTestsForEvolving) {
    // 测试次数 < 3
    return {
      stabilityIndex: 0,
      stabilityProbability: 0,
      stabilityProbabilityDisplay: '数据不足',
      isRange: false,
      stabilityWarning: `需要至少${config.minTestsForEvolving}次测试才能计算稳定性，当前仅有${testHistory.length}次`,
      confidenceBand: [0, 0],
      status: 'insufficient_data'
    };
  }

  // 按时间排序
  const sortedTests = [...testHistory].sort((a, b) => a.completedAt - b.completedAt);

  // 提取各维度得分序列
  const dimensionScores = {
    E: sortedTests.map(t => t.scores.E),
    N: sortedTests.map(t => t.scores.N),
    T: sortedTests.map(t => t.scores.T),
    J: sortedTests.map(t => t.scores.J)
  };

  // 计算各维度的基础稳定性
  const dimensionStability = {
    E: calculateDimensionStability(dimensionScores.E),
    N: calculateDimensionStability(dimensionScores.N),
    T: calculateDimensionStability(dimensionScores.T),
    J: calculateDimensionStability(dimensionScores.J)
  };

  // 计算总体稳定性指数 (四个维度的平均)
  const overallStabilityIndex = (
    dimensionStability.E.stabilityIndex +
    dimensionStability.N.stabilityIndex +
    dimensionStability.T.stabilityIndex +
    dimensionStability.J.stabilityIndex
  ) / 4;

  // Monte Carlo 模拟计算稳定性概率
  const simulationResult = await runMonteCarloSimulation(
    dimensionScores,
    config.monteCarloIterations,
    config.confidenceLevel
  );

  // 确定状态
  let status: StabilityResult['status'];
  let stabilityWarning: string | null = null;

  if (testHistory.length >= config.minTestsForStable) {
    // 6+ 次测试
    if (simulationResult.stabilityProbability >= 80) {
      status = 'stable';
    } else if (simulationResult.stabilityProbability >= 50) {
      status = 'evolving';
    } else {
      status = 'unstable';
      stabilityWarning = '人格特质表现出较大波动，建议定期重测';
    }
  } else {
    // 3-5 次测试
    status = 'evolving';
    stabilityWarning = `已完成${testHistory.length}次测试，再进行${config.minTestsForStable - testHistory.length}次可获得更准确的稳定性评估`;
  }

  // 生成显示文本
  let stabilityProbabilityDisplay: string;
  if (testHistory.length < config.minTestsForStable) {
    // 范围显示
    const lowerBound = Math.max(0, simulationResult.stabilityProbability - 15);
    const upperBound = Math.min(100, simulationResult.stabilityProbability + 15);
    stabilityProbabilityDisplay = `${Math.round(lowerBound)}% - ${Math.round(upperBound)}%`;
  } else {
    // 精确值
    stabilityProbabilityDisplay = `${Math.round(simulationResult.stabilityProbability)}%`;
  }

  return {
    stabilityIndex: overallStabilityIndex,
    stabilityProbability: simulationResult.stabilityProbability,
    stabilityProbabilityDisplay,
    isRange: testHistory.length < config.minTestsForStable,
    stabilityWarning,
    confidenceBand: simulationResult.confidenceBand,
    status,
    dimensionBreakdown: dimensionStability
  };
}

/**
 * Monte Carlo 模拟结果
 */
interface MonteCarloResult {
  stabilityProbability: number;
  confidenceBand: [number, number];
}

/**
 * 运行 Monte Carlo 模拟
 * 通过重采样估计稳定性概率的分布
 */
async function runMonteCarloSimulation(
  dimensionScores: {
    E: number[];
    N: number[];
    T: number[];
    J: number[];
  },
  iterations: number,
  confidenceLevel: number
): Promise<MonteCarloResult> {
  const allScores = [
    ...dimensionScores.E,
    ...dimensionScores.N,
    ...dimensionScores.T,
    ...dimensionScores.J
  ];

  const n = allScores.length;
  if (n === 0) {
    return {
      stabilityProbability: 0,
      confidenceBand: [0, 0]
    };
  }

  // 计算观测到的稳定性指数
  const observedStability = calculateDimensionStability(allScores).stabilityIndex;

  // Monte Carlo 模拟：bootstrap 重采样
  const simulatedStabilities: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // 有放回抽样
    const resampledScores: number[] = [];
    for (let j = 0; j < n; j++) {
      const randomIndex = Math.floor(Math.random() * n);
      resampledScores.push(allScores[randomIndex]);
    }

    const resampledStability = calculateDimensionStability(resampledScores).stabilityIndex;
    simulatedStabilities.push(resampledStability);
  }

  // 计算稳定性概率
  // 定义为：重采样稳定性指数 ≥ 0.7 的概率
  const threshold = 0.7;
  const stableCount = simulatedStabilities.filter(s => s >= threshold).length;
  const stabilityProbability = (stableCount / iterations) * 100;

  // 计算置信区间
  simulatedStabilities.sort((a, b) => a - b);
  const alpha = 1 - confidenceLevel;
  const lowerIndex = Math.floor((alpha / 2) * iterations);
  const upperIndex = Math.floor((1 - alpha / 2) * iterations);

  const confidenceBand: [number, number] = [
    simulatedStabilities[lowerIndex],
    simulatedStabilities[upperIndex]
  ];

  return {
    stabilityProbability,
    confidenceBand
  };
}

/**
 * 计算重测信度
 * 使用组内相关系数 (ICC)
 */
export function calculateTestRetestReliability(testHistory: TestResult[]): number {
  if (testHistory.length < 2) {
    return 0;
  }

  // 计算相邻测试间的相关性
  const correlations: number[] = [];

  for (let i = 0; i < testHistory.length - 1; i++) {
    const test1 = testHistory[i];
    const test2 = testHistory[i + 1];

    const scores1 = [test1.scores.E, test1.scores.N, test1.scores.T, test1.scores.J];
    const scores2 = [test2.scores.E, test2.scores.N, test2.scores.T, test2.scores.J];

    const correlation = pearsonCorrelation(scores1, scores2);
    correlations.push(correlation);
  }

  // 平均相关性
  const avgCorrelation = correlations.reduce((a, b) => a + b, 0) / correlations.length;
  return avgCorrelation;
}

/**
 * Pearson 相关系数计算
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n === 0) return 0;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denominator = Math.sqrt(sumX2 * sumY2);
  if (denominator === 0) return 0;

  return numerator / denominator;
}

/**
 * 获取稳定性状态的颜色标识
 */
export function getStabilityStatusColor(status: StabilityResult['status']): string {
  switch (status) {
    case 'stable':
      return '#22c55e';  // green
    case 'evolving':
      return '#f59e0b';  // amber
    case 'unstable':
      return '#ef4444';  // red
    case 'insufficient_data':
      return '#6b7280';  // gray
    default:
      return '#6b7280';
  }
}

/**
 * 获取稳定性状态的中文描述
 */
export function getStabilityStatusText(status: StabilityResult['status']): string {
  switch (status) {
    case 'stable':
      return '稳定';
    case 'evolving':
      return '发展中';
    case 'unstable':
      return '不稳定';
    case 'insufficient_data':
      return '数据不足';
    default:
      return '未知';
  }
}

export default calculateStability;
