/**
 * 人格稳定性指数计算 - 类型定义
 * 
 * 定义稳定性计算相关的接口和类型
 */

/**
 * MBTI 维度枚举
 */
export type MBTIDimension = 'O' | 'C' | 'E' | 'A' | 'N';

/**
 * 单次测试结果
 */
export interface TestResult {
  id: number;
  userId: number;
  testDate: number; // timestamp in ms
  scores: {
    O: number; // Openness 开放性
    C: number; // Conscientiousness 尽责性
    E: number; // Extraversion 外向性
    A: number; // Agreeableness 宜人性
    N: number; // Neuroticism 神经质
  };
  mbtiType?: string; // 可选的 MBTI 类型结果
}

/**
 * 单维度统计信息
 */
export interface DimensionStats {
  mean: number;
  std: number;
  cv: number; // 变异系数 = std / mean
}

/**
 * 稳定性计算结果
 */
export interface StabilityResult {
  /** 稳定性指数 (0-1，越接近 1 越稳定) */
  stabilityIndex: number;
  
  /** 稳定性概率 (0-100%，重采样 CV ≤ 0.15 的概率) */
  stabilityProbability: number;
  
  /** 显示用的稳定性概率 (可能是范围值) */
  stabilityProbabilityDisplay: string;
  
  /** 是否为范围值显示 */
  isRange: boolean;
  
  /** 警告信息 */
  stabilityWarning: string | null;
  
  /** 95% 置信区间 [下限，上限] */
  confidenceBand: [number, number];
  
  /** 状态标识 */
  status: 'stable' | 'evolving' | 'unstable' | 'insufficient_data';
  
  /** 各维度统计信息 */
  perDimension: {
    O: DimensionStats;
    C: DimensionStats;
    E: DimensionStats;
    A: DimensionStats;
    N: DimensionStats;
  };
  
  /** 元数据 */
  metadata: {
    testCount: number;
    calculationTime: number; // ms
    bootstrapIterations: number;
  };
}

/**
 * Monte Carlo 模拟配置
 */
export interface MonteCarloConfig {
  /** Bootstrap 重采样次数 */
  bootstrapIterations: number;
  
  /** 稳定性阈值 (CV ≤ threshold 视为稳定) */
  stabilityThreshold: number;
  
  /** 置信水平 (默认 0.95) */
  confidenceLevel: number;
}

/**
 * 默认配置
 * 生产环境推荐：10000 次迭代 (高精度)
 * 高并发场景：2000-5000 次迭代 (平衡性能和精度)
 * 实时计算：1000 次迭代 (最快)
 */
export const DEFAULT_CONFIG: MonteCarloConfig = {
  bootstrapIterations: 5000, // 默认平衡配置
  stabilityThreshold: 0.15,
  confidenceLevel: 0.95,
};

/**
 * 预设配置模板
 */
export const PRESET_CONFIGS = {
  /** 高精度模式 (离线分析) */
  HIGH_PRECISION: {
    bootstrapIterations: 10000,
    stabilityThreshold: 0.15,
    confidenceLevel: 0.95,
  },
  /** 平衡模式 (生产环境默认) */
  BALANCED: {
    bootstrapIterations: 5000,
    stabilityThreshold: 0.15,
    confidenceLevel: 0.95,
  },
  /** 高性能模式 (实时计算) */
  HIGH_PERFORMANCE: {
    bootstrapIterations: 2000,
    stabilityThreshold: 0.15,
    confidenceLevel: 0.95,
  },
  /** 极速模式 (高并发场景) */
  TURBO: {
    bootstrapIterations: 1000,
    stabilityThreshold: 0.15,
    confidenceLevel: 0.95,
  },
};
