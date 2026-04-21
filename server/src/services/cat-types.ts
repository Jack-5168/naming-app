/**
 * CAT Engine - Type Definitions
 * Computerized Adaptive Testing types for 2PL MIRT model
 * 
 * This file contains all type definitions specific to the CAT engine.
 * For shared types, see ../types/index.ts
 */

// Define types inline since they're not exported from ../types
type Big5Dimension = 'O' | 'C' | 'E' | 'A' | 'N';

interface CATConfig {
  maxQuestions: number;
  stoppingRule: 'precision' | 'length';
  targetSEM: number;
  minQuestions: number;
}

interface Question {
  id: string;
  content: string;
  dimension: Big5Dimension;
  difficulty: number;
  discrimination: number;
  options: Array<{ id: string; text: string; score: number }>;
}

interface Answer {
  questionId: string;
  optionId: string;
  responseTime: number;
}

interface AbilityEstimate {
  O: number;
  C: number;
  E: number;
  A: number;
  N: number;
}

/**
 * CAT Engine 配置接口
 * 定义自适应测试的核心参数
 */
export interface CATEngineConfig {
  /** 维度列表 */
  dimensions: Big5Dimension[];
  /** 是否启用维度平衡 */
  enableDimensionBalance?: boolean;
  /** 是否启用难度匹配 */
  enableDifficultyMatching?: boolean;
  /** 题目曝光控制 - 最大曝光率 */
  maxExposureRate?: number;
  /** 最大题目数 */
  maxQuestions: number;
  /** 最小题目数 */
  minQuestions: number;
  /** 目标 SEM */
  targetSEM: number;
  /** 能力范围 */
  abilityRange: [number, number];
  /** 先验分布 */
  prior: 'normal' | 'uniform';
  /** 先验参数 */
  priorParams?: { mean: number; std: number };
}

/**
 * 题目信息量接口
 * 用于选题策略计算
 */
export interface ItemInformation {
  questionId: string;
  dimension: Big5Dimension;
  difficulty: number;
  discrimination: number;
  information: number;  // Fisher 信息量
}

/**
 * 能力估计结果（分维度）
 */
export interface DimensionAbilityEstimate {
  dimension: Big5Dimension;
  theta: number;           // 能力估计值 [-3, 3]
  sem: number;             // 标准误
  score: number;           // 量表分 [0, 100]
  confidenceInterval: [number, number];
  questionsAnswered: number;
}

/**
 * 完整测试会话状态
 */
export interface CATSessionState {
  sessionId: string;
  answers: Answer[];
  usedQuestionIds: Set<string>;
  currentTheta: number;
  currentSEM: number;
  dimensionEstimates: { [key in Big5Dimension]?: DimensionAbilityEstimate };
  isTerminated: boolean;
  terminationReason?: 'max_questions' | 'target_sem' | 'no_questions' | 'user_quit';
  startedAt: number;
  completedAt?: number;
}

/**
 * 选题策略配置
 */
export interface ItemSelectionStrategy {
  /** 策略类型 */
  type: 'max_information' | 'weighted_information' | 'bayesian';
  /** 维度权重 */
  dimensionWeights?: { [key in Big5Dimension]?: number };
  /** 难度匹配容差 */
  difficultyTolerance?: number;
}

/**
 * 终止条件配置
 */
export interface TerminationCriteria {
  /** 最大题目数 */
  maxQuestions: number;
  /** 最小题目数 */
  minQuestions: number;
  /** 目标标准误 */
  targetSEM: number;
  /** 最大测试时间（毫秒） */
  maxTimeMs?: number;
  /** 能力估计变化阈值 */
  thetaChangeThreshold?: number;
}

/**
 * IRT 模型参数接口
 */
export interface IRTParameters {
  /** 区分度参数 a (0.5-2.5) */
  discrimination: number;
  /** 难度参数 b (-2 到 +2) */
  difficulty: number;
  /** 猜测参数 c (2PL 中为 0) */
  guessing?: number;
  /** 上渐近线 d (2PL 中为 1) */
  upperAsymptote?: number;
}

/**
 * 后验分布计算结果
 */
export interface PosteriorDistribution {
  /** theta 值数组 */
  thetaGrid: number[];
  /** 对应的后验密度值 */
  densities: number[];
  /** 后验均值 (EAP 估计) */
  mean: number;
  /** 后验标准差 */
  stdDev: number;
  /** 归一化常数 */
  normalizingConstant: number;
}

/**
 * 高斯积分点配置
 */
export interface QuadratureConfig {
  /** 积分点数量 */
  nPoints: number;
  /** 积分范围下限 */
  thetaMin: number;
  /** 积分范围上限 */
  thetaMax: number;
  /** 是否使用自适应积分 */
  adaptive: boolean;
}

/**
 * 默认配置常量
 */
export const DEFAULT_QUADRATURE_CONFIG: QuadratureConfig = {
  nPoints: 100,
  thetaMin: -3,
  thetaMax: 3,
  adaptive: false
};

export const DEFAULT_CAT_CONFIG: CATEngineConfig = {
  maxQuestions: 20,
  minQuestions: 10,
  targetSEM: 0.3,
  abilityRange: [-3, 3],
  dimensions: ['O', 'C', 'E', 'A', 'N'],
  prior: 'normal',
  enableDimensionBalance: true,
  enableDifficultyMatching: true,
  maxExposureRate: 0.5
};

export const DEFAULT_TERMINATION: TerminationCriteria = {
  maxQuestions: 20,
  minQuestions: 10,
  targetSEM: 0.3,
  maxTimeMs: 600000,  // 10 分钟
  thetaChangeThreshold: 0.01
};

/**
 * 2PL 模型缩放常数
 * D = 1.702 使 logistic 函数接近正态肩形曲线
 */
export const IRT_SCALING_CONSTANT = 1.702;

/**
 * 能力值到量表分的映射配置
 * theta [-3, 3] → score [0, 100]
 */
export const SCORE_MAPPING = {
  thetaMin: -3,
  thetaMax: 3,
  scoreMin: 0,
  scoreMax: 100
};
