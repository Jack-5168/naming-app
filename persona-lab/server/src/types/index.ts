/**
 * Persona Lab - Type Definitions
 * Core types for CAT engine (IPIP-NEO 5 dimensions), stability calculation, and A/B testing
 */

// ==================== CAT Engine Types (IPIP-NEO 5 Dimensions) ====================

export type Big5Dimension = 'O' | 'C' | 'E' | 'A' | 'N';

export interface CATConfig {
  maxQuestions: number;      // 最大题目数：20
  minQuestions: number;      // 最小题目数：10
  targetSEM: number;         // 目标标准误：0.3
  abilityRange: [number, number];  // 能力范围：[-3, 3]
  dimensions: Big5Dimension[]; // ['O', 'C', 'E', 'A', 'N']
}

export interface Question {
  id: string;
  dimension: Big5Dimension;  // O/C/E/A/N
  difficulty: number;        // b parameter in 2PL
  discrimination: number;    // a parameter in 2PL
  content: string;
  options: QuestionOption[];
  reverseScored?: boolean;   // 是否反向计分
}

export interface QuestionOption {
  value: number;             // Likert scale: 1-5
  text: string;
}

export interface Answer {
  questionId: string;
  dimension: Big5Dimension;
  response: number;          // 1-5 (Likert scale)
  timestamp: number;
}

export interface AbilityEstimate {
  theta: number;             // 能力估计值 [-3, 3]
  sem: number;               // 标准误
  confidenceInterval: [number, number];
}

// ==================== Big Five Scores ====================

export interface Big5Scores {
  O: number;  // 开放性 0-100
  C: number;  // 尽责性 0-100
  E: number;  // 外向性 0-100
  A: number;  // 宜人性 0-100
  N: number;  // 神经质 0-100
}

// ==================== MBTI Mapping Types ====================

export interface MBTIResult {
  type: string;  // 'INFJ', 'ENFP', etc.
  dimensions: {
    E_I: 'E' | 'I' | 'balanced';
    N_S: 'N' | 'S' | 'balanced';
    T_F: 'T' | 'F' | 'balanced';
    J_P: 'J' | 'P' | 'balanced';
  };
  confidence: {
    overall: number;  // 0-1
    perDimension: {
      E_I: number;
      N_S: number;
      T_F: number;
      J_P: number;
    };
  };
  description: string;  // 类型描述
}

// ==================== Stability Calculator Types ====================

export interface TestResult {
  testId: string;
  userId: number;
  completedAt: number;
  scores: Big5Scores;  // 大五维度得分
  questionCount: number;
  testMode: 'CAT' | 'CLASSIC';
}

export interface StabilityResult {
  stabilityIndex: number;           // 稳定性指数 0-1
  stabilityProbability: number;     // 稳定性概率 0-100%
  stabilityProbabilityDisplay: string;  // 显示用（范围或精确值）
  isRange: boolean;                 // 是否为范围值
  stabilityWarning: string | null;  // 警告信息
  confidenceBand: [number, number]; // 置信区间
  status: 'stable' | 'evolving' | 'unstable' | 'insufficient_data';
  perDimension: {
    O: { mean: number; std: number; cv: number; };
    C: { mean: number; std: number; cv: number; };
    E: { mean: number; std: number; cv: number; };
    A: { mean: number; std: number; cv: number; };
    N: { mean: number; std: number; cv: number; };
  };
}

export interface DimensionStability {
  mean: number;
  stdDev: number;
  range: number;
  stabilityIndex: number;
}

export interface StabilityConfig {
  monteCarloIterations: number;    // Monte Carlo 模拟次数：10000
  confidenceLevel: number;         // 置信水平：0.95
  minTestsForStable: number;       // 稳定所需最小测试次数：6
  minTestsForEvolving: number;     // 发展中所需最小测试次数：3
}

// ==================== A/B Testing Types ====================

export interface ABTestConfig {
  experimentId: string;
  name: string;
  description: string;
  trafficSplit: number;          // 实验组流量比例 (0-1)
  startDate: number;
  endDate?: number;
  status: 'draft' | 'running' | 'paused' | 'completed';
  variants: ABTestVariant[];
  metrics: ABTestMetric[];
}

export interface ABTestVariant {
  variantId: string;
  name: string;
  description: string;
  config: Record<string, any>;
}

export interface ABTestMetric {
  metricId: string;
  name: string;
  type: 'conversion' | 'continuous' | 'count';
  targetValue?: number;
}

export interface ABTestExposure {
  userId: string;
  experimentId: string;
  variantId: string;
  exposedAt: number;
}

export interface ABTestEvent {
  userId: string;
  experimentId: string;
  variantId: string;
  metricId: string;
  value: number;
  timestamp: number;
}

export interface ABTestResults {
  experimentId: string;
  variantResults: {
    variantId: string;
    sampleSize: number;
    metricResults: {
      [metricId: string]: {
        mean: number;
        stdDev: number;
        confidenceInterval: [number, number];
      };
    };
  }[];
  statisticalSignificance: {
    metricId: string;
    pValue: number;
    isSignificant: boolean;
    effectSize: number;
  }[];
  recommendation: string;
}

// ==================== Dimension Spectrum Types (Big Five) ====================

export interface DimensionSpectrumData {
  dimension: Big5Dimension;
  dimensionName: string;  // 开放性，尽责性等
  score: number;          // 0-100
  percentile?: number;    // 百分位数
  label: string;          // 描述性标签
  confidenceInterval: [number, number];
  stabilityIndex: number;
  stabilityStatus: 'stable' | 'evolving' | 'unstable' | 'insufficient_data';
}

export interface PersonalityProfile {
  userId: number;
  dimensions: DimensionSpectrumData[];
  mbtiReference?: MBTIResult;  // MBTI 参考类型
  overallStability: StabilityResult;
  lastUpdatedAt: number;
}
