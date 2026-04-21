/**
 * 成本控制模块
 * 负责监控 LLM 使用成本，提供预算控制和降级策略
 */
import { EventEmitter } from 'events';
export interface CostControlConfig {
    budget: {
        dailyLimit: number;
        monthlyLimit: number;
        alertThreshold: number;
    };
    modelStrategy: {
        basic_report: {
            model: string;
            maxTokens: number;
        };
        pro_report: {
            model: string;
            maxTokens: number;
        };
        master_report: {
            model: string;
            maxTokens: number;
        };
    };
    fallback: {
        enabled: boolean;
        maxRetries: number;
        fallbackModel: string;
    };
}
export interface UsageRecord {
    timestamp: number;
    cost: number;
    model: string;
    reportType: string;
    userId: string;
}
export interface BudgetStatus {
    dailyUsed: number;
    dailyRemaining: number;
    monthlyUsed: number;
    monthlyRemaining: number;
    dailyPercentage: number;
    monthlyPercentage: number;
    isAlertTriggered: boolean;
}
export declare const COST_CONTROL: CostControlConfig;
export declare const costEvents: EventEmitter<[never]>;
/**
 * 记录使用成本
 */
export declare function recordUsage(record: UsageRecord): void;
/**
 * 获取预算状态
 */
export declare function getBudgetStatus(): BudgetStatus;
/**
 * 检查是否超出预算
 */
export declare function isWithinBudget(estimatedCost: number): boolean;
/**
 * 获取报告类型的模型策略
 */
export declare function getModelStrategy(reportType: string): {
    model: string;
    maxTokens: number;
};
/**
 * 获取降级模型
 */
export declare function getFallbackModel(): string;
/**
 * 获取最大重试次数
 */
export declare function getMaxRetries(): number;
/**
 * 清理旧数据（保留最近 30 天）
 */
export declare function cleanupOldRecords(): void;
/**
 * 导出使用记录（用于分析）
 */
export declare function exportUsageRecords(startDate?: number, endDate?: number): UsageRecord[];
declare const _default: {
    COST_CONTROL: CostControlConfig;
    recordUsage: typeof recordUsage;
    getBudgetStatus: typeof getBudgetStatus;
    isWithinBudget: typeof isWithinBudget;
    getModelStrategy: typeof getModelStrategy;
    getFallbackModel: typeof getFallbackModel;
    getMaxRetries: typeof getMaxRetries;
    cleanupOldRecords: typeof cleanupOldRecords;
    exportUsageRecords: typeof exportUsageRecords;
    costEvents: EventEmitter<[never]>;
};
export default _default;
//# sourceMappingURL=cost-control.d.ts.map