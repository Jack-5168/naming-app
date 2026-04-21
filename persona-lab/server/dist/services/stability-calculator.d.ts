/**
 * Stability Calculator - 人格稳定性指数计算
 * 使用 Monte Carlo 模拟计算稳定性概率和置信区间
 */
import { TestResult, StabilityResult } from '../types';
/**
 * 计算稳定性指数
 * @param userId 用户 ID
 * @param testHistory 测试历史
 * @returns 稳定性结果
 */
export declare function calculateStability(userId: number, testHistory: TestResult[]): Promise<StabilityResult>;
/**
 * 计算重测信度
 * 使用组内相关系数 (ICC)
 */
export declare function calculateTestRetestReliability(testHistory: TestResult[]): number;
/**
 * 获取稳定性状态的颜色标识
 */
export declare function getStabilityStatusColor(status: StabilityResult['status']): string;
/**
 * 获取稳定性状态的中文描述
 */
export declare function getStabilityStatusText(status: StabilityResult['status']): string;
export default calculateStability;
//# sourceMappingURL=stability-calculator.d.ts.map