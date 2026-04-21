/**
 * Persona Lab - Type Definitions
 * Core types for CAT engine, stability calculation, and A/B testing
 */

// ==================== CAT Engine Types ====================

export interface CATConfig {
  maxQuestions: number;      // 最大题目数：20
  minQuestions: number;      // 最小题目数：10
  targetSEM: number;         // 目标标准误：0.3
  abilityRange: [number, number];  // 能力范围：[-3, 3]
}

export interface Question {
  id: string;
  dimension: 'E' | 'N' | 'T' | 'J';  // E-I, N-S, T-F, J-P
  difficulty: number;        // b parameter in 2PL
  discrimination: number;    // a parameter in 2PL
  content: string;
  options: QuestionOption[];
}

export interface QuestionOption {
  value: number;             // 选项对应的特质方向 (0 或 1)
  text: string;
}

export interface Answer {
  questionId: string;
  dimension: 'E' | 'N' | 'T' | 'J';
  response: number;          // 0 或 1
  timestamp: number;
}

export interface AbilityEstimate {
  theta: number;             // 能力估计值
  sem: number;               // 标准误
  confidenceInterval: [number, number];
}

// ==================== Stability Calculator Types ====================

export interface TestResult {
  testId: string;
  userId: number;
  completedAt: number;
  scores: {
    E: number;               // 外向性得分 0-100
    N: number;               // 直觉性得分 0-100
    T: number;               // 思考性得分 0-100
    J: number;               // 判断性得分 0-100
  };
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
  dimensionBreakdown?: {
    E: DimensionStability;
    N: DimensionStability;
    T: DimensionStability;
    J: DimensionStability;
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

// ==================== Dimension Spectrum Types ====================

export interface DimensionSpectrumData {
  dimension: 'E-I' | 'N-S' | 'T-F' | 'J-P';
  score: number;                 // 0-100
  label: string;
  confidenceInterval: [number, number];
  stabilityIndex: number;
  stabilityStatus: 'stable' | 'evolving' | 'unstable' | 'insufficient_data';
}

export interface PersonalityProfile {
  userId: number;
  dimensions: DimensionSpectrumData[];
  overallStability: StabilityResult;
  lastUpdatedAt: number;
}
