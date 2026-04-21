/**
 * CAT Engine - Computerized Adaptive Testing
 * Implements 2PL MIRT model with maximum information item selection
 * and Bayesian EAP ability estimation for Big Five personality traits
 */

import {
  CATConfig,
  Question,
  Answer,
  AbilityEstimate,
  Big5Dimension
} from '../types';

const DEFAULT_CONFIG: CATConfig = {
  maxQuestions: 20,
  minQuestions: 10,
  targetSEM: 0.3,
  abilityRange: [-3, 3],
  dimensions: ['O', 'C', 'E', 'A', 'N']
};

export class CATEngine {
  private config: CATConfig;
  private questionPool: Question[];
  private usedQuestionIds: Set<string>;

  constructor(config: Partial<CATConfig> = {}, questionPool: Question[] = []) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.questionPool = questionPool;
    this.usedQuestionIds = new Set();
  }

  /**
   * 2PL MIRT 模型 - 计算答对概率
   * P(θ) = 1 / (1 + exp(-D * a * (θ - b)))
   * D = 1.702 (scaling constant)
   */
  private calculateProbability(theta: number, difficulty: number, discrimination: number): number {
    const D = 1.702;
    const exponent = -D * discrimination * (theta - difficulty);
    return 1 / (1 + Math.exp(exponent));
  }

  /**
   * Fisher 信息量计算
   * I(θ) = D² * a² * P(θ) * (1 - P(θ))
   */
  private calculateFisherInformation(
    theta: number,
    difficulty: number,
    discrimination: number
  ): number {
    const D = 1.702;
    const p = this.calculateProbability(theta, difficulty, discrimination);
    return D * D * discrimination * discrimination * p * (1 - p);
  }

  /**
   * 先验分布 - 标准正态分布
   */
  private priorDensity(theta: number): number {
    return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * theta * theta);
  }

  /**
   * 似然函数 - 基于所有作答
   */
  private likelihood(theta: number, answers: Answer[]): number {
    if (answers.length === 0) return 1;

    let logLikelihood = 0;
    for (const answer of answers) {
      const question = this.questionPool.find(q => q.id === answer.questionId);
      if (!question) continue;

      const p = this.calculateProbability(theta, question.difficulty, question.discrimination);
      
      // For Likert scale, treat higher responses as endorsing the trait
      const endorsed = answer.response >= 3;
      
      if (endorsed) {
        logLikelihood += Math.log(Math.max(p, 1e-10));
      } else {
        logLikelihood += Math.log(Math.max(1 - p, 1e-10));
      }
    }

    return Math.exp(logLikelihood);
  }

  /**
   * 后验分布 = 似然 × 先验
   */
  private posteriorDensity(theta: number, answers: Answer[]): number {
    return this.likelihood(theta, answers) * this.priorDensity(theta);
  }

  /**
   * EAP (Expected A Posteriori) 能力估计
   * 使用数值积分计算后验期望
   */
  estimateAbility(answers: Answer[]): number {
    if (answers.length === 0) {
      return 0; // 先验均值
    }

    const [thetaMin, thetaMax] = this.config.abilityRange;
    const nPoints = 100;
    const step = (thetaMax - thetaMin) / nPoints;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i <= nPoints; i++) {
      const theta = thetaMin + i * step;
      const posterior = this.posteriorDensity(theta, answers);
      
      numerator += theta * posterior * step;
      denominator += posterior * step;
    }

    if (denominator === 0) return 0;
    return numerator / denominator;
  }

  /**
   * 计算标准误 (Standard Error of Measurement)
   * SEM = 1 / sqrt(Σ I(θ))
   */
  calculateSEM(answers: Answer[]): number {
    if (answers.length === 0) {
      return Math.sqrt(1 / this.calculateTotalInformation(0, []));
    }

    const theta = this.estimateAbility(answers);
    const totalInfo = this.calculateTotalInformation(theta, answers);

    if (totalInfo === 0) return Infinity;
    return 1 / Math.sqrt(totalInfo);
  }

  /**
   * 计算总信息量
   */
  private calculateTotalInformation(theta: number, answers: Answer[]): number {
    let totalInfo = 0;

    for (const answer of answers) {
      const question = this.questionPool.find(q => q.id === answer.questionId);
      if (!question) continue;

      totalInfo += this.calculateFisherInformation(
        theta,
        question.difficulty,
        question.discrimination
      );
    }

    // 加上先验信息量 (标准正态分布的信息量为 1)
    return totalInfo + 1;
  }

  /**
   * 计算置信区间
   */
  calculateConfidenceInterval(answers: Answer[], confidenceLevel: number = 0.95): [number, number] {
    const theta = this.estimateAbility(answers);
    const sem = this.calculateSEM(answers);

    // Z 值：95% 置信水平对应 1.96
    const zScores: { [key: number]: number } = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576
    };

    const z = zScores[confidenceLevel] || 1.96;
    return [theta - z * sem, theta + z * sem];
  }

  /**
   * 最大信息量选题策略
   * 选择在当前能力估计值处提供最大信息量的题目
   */
  selectNextQuestion(answers: Answer[]): Question | null {
    const availableQuestions = this.questionPool.filter(
      q => !this.usedQuestionIds.has(q.id)
    );

    if (availableQuestions.length === 0) {
      return null;
    }

    // 估计当前能力
    const theta = this.estimateAbility(answers);

    // 按维度分组，确保各维度题目平衡
    const dimensionCounts: { [key in Big5Dimension]: number } = { O: 0, C: 0, E: 0, A: 0, N: 0 };
    answers.forEach(a => {
      dimensionCounts[a.dimension] = (dimensionCounts[a.dimension] || 0) + 1;
    });

    // 找出作答次数最少的维度
    const minCount = Math.min(...Object.values(dimensionCounts));
    const targetDimensions = (Object.keys(dimensionCounts) as Big5Dimension[]).filter(
      dim => dimensionCounts[dim] === minCount
    );

    // 在目标维度中选择信息量最大的题目
    let bestQuestion: Question | null = null;
    let maxInfo = -Infinity;

    for (const question of availableQuestions) {
      // 优先选择目标维度的题目
      if (!targetDimensions.includes(question.dimension)) {
        continue;
      }

      const info = this.calculateFisherInformation(
        theta,
        question.difficulty,
        question.discrimination
      );

      if (info > maxInfo) {
        maxInfo = info;
        bestQuestion = question;
      }
    }

    // 如果目标维度没有题目，选择所有维度中信息量最大的
    if (!bestQuestion) {
      for (const question of availableQuestions) {
        const info = this.calculateFisherInformation(
          theta,
          question.difficulty,
          question.discrimination
        );

        if (info > maxInfo) {
          maxInfo = info;
          bestQuestion = question;
        }
      }
    }

    if (bestQuestion) {
      this.usedQuestionIds.add(bestQuestion.id);
    }

    return bestQuestion;
  }

  /**
   * 判断是否应该终止测试
   * 条件：
   * 1. 达到最大题目数
   * 2. 达到最小题目数且 SEM ≤ targetSEM
   * 3. 没有可用题目
   */
  shouldTerminate(answers: Answer[]): boolean {
    // 达到最大题目数
    if (answers.length >= this.config.maxQuestions) {
      return true;
    }

    // 未达到最小题目数
    if (answers.length < this.config.minQuestions) {
      return false;
    }

    // 检查 SEM
    const sem = this.calculateSEM(answers);
    if (sem <= this.config.targetSEM) {
      return true;
    }

    // 没有可用题目
    const availableQuestions = this.questionPool.filter(
      q => !this.usedQuestionIds.has(q.id)
    );
    if (availableQuestions.length === 0) {
      return true;
    }

    return false;
  }

  /**
   * 重置引擎状态
   */
  reset(): void {
    this.usedQuestionIds.clear();
  }

  /**
   * 设置题目池
   */
  setQuestionPool(questions: Question[]): void {
    this.questionPool = questions;
    this.reset();
  }

  /**
   * 获取完整能力估计结果
   */
  getAbilityEstimate(answers: Answer[]): AbilityEstimate {
    const theta = this.estimateAbility(answers);
    const sem = this.calculateSEM(answers);
    const confidenceInterval = this.calculateConfidenceInterval(answers);

    return {
      theta,
      sem,
      confidenceInterval
    };
  }

  /**
   * 将 theta 转换为 0-100 量表分
   * theta 范围 [-3, 3] 映射到 [0, 100]
   */
  thetaToScore(theta: number): number {
    return Math.round(((theta + 3) / 6) * 100);
  }

  /**
   * 将量表分转换为 theta
   */
  scoreToTheta(score: number): number {
    return (score / 100) * 6 - 3;
  }

  /**
   * 按维度估计能力
   */
  estimateAbilityByDimension(answers: Answer[]): { [key in Big5Dimension]?: AbilityEstimate } {
    const result: { [key in Big5Dimension]?: AbilityEstimate } = {};
    const dimensions = new Set<Big5Dimension>();
    
    answers.forEach(a => dimensions.add(a.dimension));

    for (const dim of dimensions) {
      const dimAnswers = answers.filter(a => a.dimension === dim);
      if (dimAnswers.length > 0) {
        result[dim] = this.getAbilityEstimate(dimAnswers);
      }
    }

    return result;
  }
}

export default CATEngine;
