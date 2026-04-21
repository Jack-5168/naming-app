/**
 * LLM 报告生成服务
 * 负责调用 GPT-4o-mini 生成个性化人格报告
 */
import { EventEmitter } from 'events';
export interface ReportGenerationParams {
    userId: string;
    clientIp: string;
    resultId: number;
    reportType: 'basic' | 'pro' | 'master';
    includeSections: string[];
}
export interface ReportGenerationResult {
    content: string;
    tokens: number;
    generationTime: number;
    requestId: string;
    cost: number;
}
export interface RateLimitStatus {
    userRemaining: number;
    ipRemaining: number;
    userResetTime: number;
    ipResetTime: number;
}
export declare const reportEvents: EventEmitter<[never]>;
/**
 * 生成报告（主函数）
 */
export declare function generateReport(params: ReportGenerationParams): Promise<ReportGenerationResult>;
/**
 * 获取限流状态
 */
export declare function getRateLimitStatus(userId: string, clientIp: string): RateLimitStatus;
/**
 * 重置限流（管理员功能）
 */
export declare function resetRateLimit(userId?: string, clientIp?: string): void;
declare const _default: {
    generateReport: typeof generateReport;
    getRateLimitStatus: typeof getRateLimitStatus;
    resetRateLimit: typeof resetRateLimit;
    reportEvents: EventEmitter<[never]>;
    BASIC_REPORT_TEMPLATE: string;
    PRO_REPORT_TEMPLATE: string;
    MASTER_REPORT_TEMPLATE: string;
};
export default _default;
//# sourceMappingURL=llm-report.d.ts.map