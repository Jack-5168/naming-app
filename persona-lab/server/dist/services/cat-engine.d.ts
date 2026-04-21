/**
 * CAT Engine - Computerized Adaptive Testing
 * Implements 2PL MIRT model with maximum information item selection
 * and Bayesian EAP ability estimation for Big Five personality traits
 */
import { CATConfig, Question, Answer, AbilityEstimate, Big5Dimension } from '../types';
export declare class CATEngine {
    private config;
    private questionPool;
    private usedQuestionIds;
    constructor(config?: Partial<CATConfig>, questionPool?: Question[]);
    /**
     * 2PL MIRT 模型 - 计算答对概率
     * P(θ) = 1 / (1 + exp(-D * a * (θ - b)))
     * D = 1.702 (scaling constant)
     */
    private calculateProbability;
    /**
     * Fisher 信息量计算
     * I(θ) = D² * a² * P(θ) * (1 - P(θ))
     */
    private calculateFisherInformation;
    /**
     * 先验分布 - 标准正态分布
     */
    private priorDensity;
    /**
     * 似然函数 - 基于所有作答
     */
    private likelihood;
    /**
     * 后验分布 = 似然 × 先验
     */
    private posteriorDensity;
    /**
     * EAP (Expected A Posteriori) 能力估计
     * 使用数值积分计算后验期望
     */
    estimateAbility(answers: Answer[]): number;
    /**
     * 计算标准误 (Standard Error of Measurement)
     * SEM = 1 / sqrt(Σ I(θ))
     */
    calculateSEM(answers: Answer[]): number;
    /**
     * 计算总信息量
     */
    private calculateTotalInformation;
    /**
     * 计算置信区间
     */
    calculateConfidenceInterval(answers: Answer[], confidenceLevel?: number): [number, number];
    /**
     * 最大信息量选题策略
     * 选择在当前能力估计值处提供最大信息量的题目
     */
    selectNextQuestion(answers: Answer[]): Question | null;
    /**
     * 判断是否应该终止测试
     * 条件：
     * 1. 达到最大题目数
     * 2. 达到最小题目数且 SEM ≤ targetSEM
     * 3. 没有可用题目
     */
    shouldTerminate(answers: Answer[]): boolean;
    /**
     * 重置引擎状态
     */
    reset(): void;
    /**
     * 设置题目池
     */
    setQuestionPool(questions: Question[]): void;
    /**
     * 获取完整能力估计结果
     */
    getAbilityEstimate(answers: Answer[]): AbilityEstimate;
    /**
     * 将 theta 转换为 0-100 量表分
     * theta 范围 [-3, 3] 映射到 [0, 100]
     */
    thetaToScore(theta: number): number;
    /**
     * 将量表分转换为 theta
     */
    scoreToTheta(score: number): number;
    /**
     * 按维度估计能力
     */
    estimateAbilityByDimension(answers: Answer[]): {
        [key in Big5Dimension]?: AbilityEstimate;
    };
}
export default CATEngine;
//# sourceMappingURL=cat-engine.d.ts.map