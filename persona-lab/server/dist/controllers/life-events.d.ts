/**
 * 生活事件模块
 * 负责生活事件的录入、查询和关联分析
 */
import { EventEmitter } from 'events';
export interface LifeEvent {
    id: number;
    userId: number;
    resultId?: number;
    eventType: string;
    eventCategory?: string;
    title: string;
    description?: string;
    eventDate: Date;
    expectedImpact?: string;
    actualImpactScore?: number;
    relatedDimension?: string;
    correlationAnalyzed: boolean;
    correlationNote?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateLifeEventParams {
    userId: number;
    resultId?: number;
    eventType: string;
    eventCategory?: string;
    title: string;
    description?: string;
    eventDate: string | Date;
    expectedImpact?: string;
    actualImpactScore?: number;
    relatedDimension?: string;
}
export interface UpdateLifeEventParams {
    title?: string;
    description?: string;
    expectedImpact?: string;
    actualImpactScore?: number;
    relatedDimension?: string;
}
export interface LifeEventAnalysis {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByImpact: {
        positive: number;
        negative: number;
        neutral: number;
    };
    impactTrend: Array<{
        period: string;
        averageScore: number;
        eventCount: number;
    }>;
    dimensionCorrelations: Array<{
        dimension: string;
        correlationScore: number;
        eventCount: number;
        note: string;
    }>;
    keyInsights: string[];
}
export declare const lifeEventEvents: EventEmitter<[never]>;
export declare const EVENT_TYPES: {
    readonly CAREER: "career";
    readonly RELATIONSHIP: "relationship";
    readonly HEALTH: "health";
    readonly EDUCATION: "education";
    readonly FINANCIAL: "financial";
    readonly PERSONAL: "personal";
    readonly FAMILY: "family";
    readonly TRAVEL: "travel";
    readonly OTHER: "other";
};
export declare const IMPACT_TYPES: {
    readonly POSITIVE: "positive";
    readonly NEGATIVE: "negative";
    readonly NEUTRAL: "neutral";
};
export declare const DIMENSIONS: {
    readonly E: "Extraversion";
    readonly I: "Introversion";
    readonly N: "Intuition";
    readonly S: "Sensing";
    readonly T: "Thinking";
    readonly F: "Feeling";
    readonly J: "Judging";
    readonly P: "Perceiving";
};
/**
 * 创建生活事件
 */
export declare function createLifeEvent(params: CreateLifeEventParams): Promise<LifeEvent>;
/**
 * 获取生活事件
 */
export declare function getLifeEvent(id: number): Promise<LifeEvent | null>;
/**
 * 获取用户的生活事件列表
 */
export declare function getUserLifeEvents(userId: number, options?: {
    startDate?: Date;
    endDate?: Date;
    eventType?: string;
    limit?: number;
    offset?: number;
}): Promise<LifeEvent[]>;
/**
 * 更新生活事件
 */
export declare function updateLifeEvent(id: number, params: UpdateLifeEventParams): Promise<LifeEvent | null>;
/**
 * 删除生活事件
 */
export declare function deleteLifeEvent(id: number): Promise<boolean>;
/**
 * 分析生活事件影响
 */
export declare function analyzeLifeEvents(userId: number): Promise<LifeEventAnalysis>;
/**
 * 批量导入生活事件
 */
export declare function bulkCreateLifeEvents(events: CreateLifeEventParams[]): Promise<LifeEvent[]>;
/**
 * 导出用户的生活事件（用于备份或迁移）
 */
export declare function exportLifeEvents(userId: number): Promise<LifeEvent[]>;
/**
 * 清空用户的生活事件（谨慎使用）
 */
export declare function clearUserLifeEvents(userId: number): Promise<number>;
declare const _default: {
    createLifeEvent: typeof createLifeEvent;
    getLifeEvent: typeof getLifeEvent;
    getUserLifeEvents: typeof getUserLifeEvents;
    updateLifeEvent: typeof updateLifeEvent;
    deleteLifeEvent: typeof deleteLifeEvent;
    analyzeLifeEvents: typeof analyzeLifeEvents;
    bulkCreateLifeEvents: typeof bulkCreateLifeEvents;
    exportLifeEvents: typeof exportLifeEvents;
    clearUserLifeEvents: typeof clearUserLifeEvents;
    lifeEventEvents: EventEmitter<[never]>;
    EVENT_TYPES: {
        readonly CAREER: "career";
        readonly RELATIONSHIP: "relationship";
        readonly HEALTH: "health";
        readonly EDUCATION: "education";
        readonly FINANCIAL: "financial";
        readonly PERSONAL: "personal";
        readonly FAMILY: "family";
        readonly TRAVEL: "travel";
        readonly OTHER: "other";
    };
    IMPACT_TYPES: {
        readonly POSITIVE: "positive";
        readonly NEGATIVE: "negative";
        readonly NEUTRAL: "neutral";
    };
    DIMENSIONS: {
        readonly E: "Extraversion";
        readonly I: "Introversion";
        readonly N: "Intuition";
        readonly S: "Sensing";
        readonly T: "Thinking";
        readonly F: "Feeling";
        readonly J: "Judging";
        readonly P: "Perceiving";
    };
};
export default _default;
//# sourceMappingURL=life-events.d.ts.map