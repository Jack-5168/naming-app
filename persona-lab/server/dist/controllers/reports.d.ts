/**
 * Report Controller - 报告管理控制器
 * Phase 1: MVP Implementation
 *
 * API Endpoints:
 * - POST /api/v1/reports - 生成报告
 * - GET /api/v1/reports/:id - 获取报告状态/内容
 * - GET /api/v1/reports - 获取历史报告列表
 *
 * @module controllers/reports
 */
import { Request, Response } from 'express';
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: number;
                email?: string;
                deviceId?: string;
            };
        }
    }
}
/**
 * 报告生成响应
 */
interface GenerateReportResponse {
    code: number;
    data: {
        report_id: number;
        status: string;
        estimated_time_seconds: number;
        progress_url: string;
    };
}
/**
 * 报告状态响应（生成中）
 */
interface ReportStatusGeneratingResponse {
    code: number;
    data: {
        report_id: number;
        status: 'generating';
        progress: number;
        current_section?: string;
    };
}
/**
 * 报告内容响应（已完成）
 */
interface ReportContentResponse {
    code: number;
    data: {
        report_id: number;
        status: 'completed';
        type: string;
        title: string;
        summary: string;
        content: {
            dimensions?: {
                title: string;
                sections: any[];
            };
            career?: {
                title: string;
                suggestions: any[];
            };
            relationship?: {
                title: string;
                analysis: any[];
            };
            growth?: {
                title: string;
                plans: any[];
            };
        };
        meta: {
            llm_model: string;
            tokens_used: number;
            generation_time_ms: number;
        };
    };
}
/**
 * 历史报告列表响应
 */
interface ReportHistoryResponse {
    code: number;
    data: {
        items: Array<{
            report_id: number;
            personality_type: string;
            type: string;
            title: string;
            summary: string;
            created_at: string;
            read_at: string | null;
        }>;
        pagination: {
            page: number;
            page_size: number;
            total: number;
            total_pages: number;
        };
    };
}
/**
 * 错误响应
 */
interface ErrorResponse {
    code: number;
    message: string;
}
/**
 * POST /api/v1/reports
 * 生成新的报告
 *
 * 请求体:
 * - result_id: 测试结果 ID
 * - report_type: 报告类型 (basic/pro/master)
 * - include_sections: 可选，包含的章节
 *
 * 响应:
 * - report_id: 报告 ID
 * - status: 生成状态
 * - estimated_time_seconds: 预计生成时间
 * - progress_url: 进度查询 URL
 */
export declare function generateReportHandler(req: Request, res: Response<GenerateReportResponse | ErrorResponse>): Promise<void>;
/**
 * GET /api/v1/reports/:id
 * 获取报告状态或内容
 *
 * 响应（生成中）:
 * - report_id: 报告 ID
 * - status: generating
 * - progress: 进度百分比
 * - current_section: 当前生成章节
 *
 * 响应（已完成）:
 * - report_id: 报告 ID
 * - status: completed
 * - type: 报告类型
 * - title: 报告标题
 * - summary: 报告摘要
 * - content: 报告内容
 * - meta: 元数据
 */
export declare function getReportHandler(req: Request, res: Response<ReportStatusGeneratingResponse | ReportContentResponse | ErrorResponse>): Promise<void>;
/**
 * GET /api/v1/reports
 * 获取用户历史报告列表
 *
 * Query 参数:
 * - page: 页码（默认 1）
 * - page_size: 每页数量（默认 20）
 * - type: 报告类型过滤（可选）
 *
 * 响应:
 * - items: 报告列表
 * - pagination: 分页信息
 */
export declare function getReportHistoryHandler(req: Request, res: Response<ReportHistoryResponse | ErrorResponse>): Promise<void>;
declare const _default: {
    generateReportHandler: typeof generateReportHandler;
    getReportHandler: typeof getReportHandler;
    getReportHistoryHandler: typeof getReportHistoryHandler;
};
export default _default;
//# sourceMappingURL=reports.d.ts.map