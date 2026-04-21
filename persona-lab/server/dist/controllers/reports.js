"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReportHandler = generateReportHandler;
exports.getReportHandler = getReportHandler;
exports.getReportHistoryHandler = getReportHistoryHandler;
const client_1 = require("@prisma/client");
const llm_report_1 = require("../services/llm-report");
const memberships_1 = require("./memberships");
const winston = __importStar(require("winston"));
const prisma = new client_1.PrismaClient();
// 配置日志记录器
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/reports.log' }),
    ],
});
// ==================== 常量配置 ====================
// 报告类型配置
const REPORT_CONFIG = {
    basic: {
        price: 0,
        pages: 3,
        estimatedTime: 10,
        features: ['personality_type', 'dimension_scores', 'basic_analysis']
    },
    pro: {
        price: 9.9,
        pages: 8,
        estimatedTime: 15,
        features: ['personality_type', 'dimension_scores', 'detailed_analysis', 'career_suggestions', 'relationship_compatibility']
    },
    master: {
        price: 29,
        pages: 15,
        estimatedTime: 25,
        features: ['personality_type', 'dimension_scores', 'detailed_analysis', 'career_suggestions', 'relationship_compatibility', 'growth_path', 'life_events_analysis']
    },
};
// 限流配置：用户每日 3 次
const RATE_LIMIT = {
    userDaily: 3,
};
// ==================== 辅助函数 ====================
/**
 * 检查用户限流状态
 * @param userId 用户 ID
 * @returns 是否允许生成
 */
async function checkUserRateLimit(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // 查询用户今日已使用次数
    const usage = await prisma.reportUsage.findFirst({
        where: {
            userId,
            date: today,
        },
    });
    const count = usage?.count || 0;
    const remaining = RATE_LIMIT.userDaily - count;
    // 计算重置时间（次日零点）
    const resetTime = new Date(today);
    resetTime.setDate(resetTime.getDate() + 1);
    return {
        allowed: remaining > 0,
        remaining,
        resetTime,
    };
}
/**
 * 记录用户使用次数
 * @param userId 用户 ID
 */
async function incrementUserUsage(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.reportUsage.upsert({
        where: {
            userId_date: {
                userId,
                date: today,
            },
        },
        update: {
            count: { increment: 1 },
        },
        create: {
            userId,
            date: today,
            count: 1,
        },
    });
}
/**
 * 解析报告内容
 * @param content 原始内容字符串
 * @returns 解析后的内容对象
 */
function parseReportContent(content) {
    try {
        return JSON.parse(content);
    }
    catch (error) {
        // 如果不是 JSON，尝试按 Markdown 解析
        return {
            dimensions: { title: '四维深度解析', sections: [] },
            career: { title: '职业发展指引', suggestions: [] },
            relationship: { title: '人际关系图谱', analysis: [] },
            growth: { title: '个人成长计划', plans: [] },
        };
    }
}
/**
 * 生成报告标题
 * @param mbtiType MBTI 类型
 * @param reportType 报告类型
 * @returns 报告标题
 */
function generateReportTitle(mbtiType, reportType) {
    const typeNames = {
        'INTJ': '建筑师',
        'INTP': '逻辑学家',
        'ENTJ': '指挥官',
        'ENTP': '辩论家',
        'INFJ': '调停者',
        'INFP': ' mediator',
        'ENFJ': '主人公',
        'ENFP': '竞选者',
        'ISTJ': '物流师',
        'ISFJ': '守卫者',
        'ESTJ': '总经理',
        'ESFJ': '执政官',
        'ISTP': '鉴赏家',
        'ISFP': '探险家',
        'ESTP': '企业家',
        'ESFP': '表演者',
    };
    const typeName = typeNames[mbtiType] || '探索者';
    const typeLabels = {
        basic: '基础人格报告',
        pro: '深度人格报告',
        master: '大师级人格报告',
    };
    return `${mbtiType} ${typeName} - ${typeLabels[reportType] || '人格报告'}`;
}
/**
 * 生成报告摘要
 * @param mbtiType MBTI 类型
 * @param reportType 报告类型
 * @returns 报告摘要
 */
function generateReportSummary(mbtiType, reportType) {
    const summaries = {
        'INFJ': '你是一个富有想象力和理想主义的人，善于洞察他人内心，追求深刻的人际关系和人生意义。',
        'ENFP': '你充满热情和创造力，善于激励他人，喜欢探索新的可能性和想法。',
        'INTJ': '你具有战略思维和独立精神，善于制定长远计划并高效执行。',
        // ... 其他类型的摘要
    };
    return summaries[mbtiType] || `基于您的 MBTI 测试结果生成的${reportType}级人格分析报告。`;
}
// ==================== 控制器函数 ====================
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
async function generateReportHandler(req, res) {
    const requestId = `rpt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const startTime = Date.now();
    try {
        const userId = req.user?.id;
        const { result_id, report_type = 'basic', include_sections } = req.body;
        // 1. 验证用户身份
        if (!userId) {
            logger.warn('Unauthorized report generation attempt', { requestId });
            res.status(401).json({
                code: 401,
                message: '未授权访问',
            });
            return;
        }
        // 2. 验证必填参数
        if (!result_id) {
            logger.warn('Missing result_id', { requestId, userId });
            res.status(400).json({
                code: 400,
                message: 'result_id 是必填参数',
            });
            return;
        }
        // 3. 验证报告类型
        if (!['basic', 'pro', 'master'].includes(report_type)) {
            logger.warn('Invalid report_type', { requestId, userId, report_type });
            res.status(400).json({
                code: 400,
                message: 'report_type 必须是 basic、pro 或 master',
            });
            return;
        }
        // 4. 检查限流（用户每日 3 次）
        const rateLimit = await checkUserRateLimit(userId);
        if (!rateLimit.allowed) {
            logger.warn('Rate limit exceeded', { requestId, userId, remaining: rateLimit.remaining });
            res.status(429).json({
                code: 429,
                message: `您今日的生成次数已达上限（${RATE_LIMIT.userDaily}次/日），请明日再试`,
            });
            return;
        }
        // 5. 获取测试结果
        const testResult = await prisma.testResult.findUnique({
            where: { id: result_id },
        });
        if (!testResult) {
            logger.warn('Test result not found', { requestId, userId, result_id });
            res.status(404).json({
                code: 404,
                message: '测试结果不存在',
            });
            return;
        }
        // 6. 验证所有权
        if (testResult.userId !== userId) {
            logger.warn('Access denied to test result', { requestId, userId, result_id });
            res.status(403).json({
                code: 403,
                message: '无权访问此测试结果',
            });
            return;
        }
        // 7. 检查是否已存在相同报告
        const existingReport = await prisma.report.findFirst({
            where: {
                resultId: result_id,
                reportType: report_type,
                status: 'completed',
            },
        });
        if (existingReport) {
            logger.info('Report already exists', { requestId, userId, report_id: existingReport.id });
            res.json({
                code: 0,
                data: {
                    report_id: existingReport.id,
                    status: 'completed',
                    estimated_time_seconds: 0,
                    progress_url: `/api/v1/reports/${existingReport.id}`,
                },
            });
            return;
        }
        // 8. 创建待处理的报告记录
        const report = await prisma.report.create({
            data: {
                resultId: result_id,
                reportType: report_type,
                content: '', // 初始为空
                tokens: 0,
                generationTime: 0,
                requestId,
                cost: 0,
                status: 'pending',
            },
        });
        logger.info('Report created', { requestId, userId, report_id: report.id, report_type });
        // 9. 异步生成报告内容
        // 注意：实际生产中应使用消息队列处理
        (0, llm_report_1.generateReport)({
            userId: String(userId),
            clientIp: req.ip || 'unknown',
            resultId: result_id,
            reportType: report_type,
            includeSections: include_sections || ['dimensions', 'career', 'relationship', 'growth'],
        })
            .then(async (result) => {
            // 更新报告记录
            await prisma.report.update({
                where: { id: report.id },
                data: {
                    content: result.content,
                    tokens: result.tokens,
                    generationTime: result.generationTime,
                    cost: result.cost,
                    status: 'completed',
                    qualityScore: 5, // 默认高质量
                },
            });
            // 记录使用次数
            await incrementUserUsage(userId);
            // 记录功能使用
            await (0, memberships_1.recordFeatureUsage)(userId, `report_${report_type}`, { reportId: report.id });
            logger.info('Report generation completed', {
                requestId,
                report_id: report.id,
                tokens: result.tokens,
                generationTime: result.generationTime,
            });
        })
            .catch(async (error) => {
            logger.error('Report generation failed', {
                requestId,
                report_id: report.id,
                error: error.message
            });
            // 更新状态为失败
            await prisma.report.update({
                where: { id: report.id },
                data: {
                    status: 'failed',
                },
            });
        });
        // 10. 返回响应
        const config = REPORT_CONFIG[report_type];
        res.status(202).json({
            code: 0,
            data: {
                report_id: report.id,
                status: 'generating',
                estimated_time_seconds: config.estimatedTime,
                progress_url: `/api/v1/reports/${report.id}`,
            },
        });
    }
    catch (error) {
        logger.error('Error generating report', {
            requestId,
            error: error.message,
            stack: error.stack,
        });
        res.status(500).json({
            code: 500,
            message: '生成报告失败，请稍后重试',
        });
    }
}
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
async function getReportHandler(req, res) {
    const requestId = `get_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        // 1. 验证用户身份
        if (!userId) {
            logger.warn('Unauthorized report access attempt', { requestId });
            res.status(401).json({
                code: 401,
                message: '未授权访问',
            });
            return;
        }
        // 2. 验证 ID 格式
        const reportId = parseInt(id);
        if (isNaN(reportId)) {
            logger.warn('Invalid report ID format', { requestId, id });
            res.status(400).json({
                code: 400,
                message: '无效的报告 ID',
            });
            return;
        }
        // 3. 获取报告
        const report = await prisma.report.findUnique({
            where: { id: reportId },
            include: {
                result: true,
            },
        });
        if (!report) {
            logger.warn('Report not found', { requestId, reportId });
            res.status(404).json({
                code: 404,
                message: '报告不存在',
            });
            return;
        }
        // 4. 验证所有权
        if (report.result.userId !== userId) {
            logger.warn('Access denied to report', { requestId, userId, reportId });
            res.status(403).json({
                code: 403,
                message: '无权访问此报告',
            });
            return;
        }
        // 5. 根据状态返回不同响应
        if (report.status === 'pending' || report.status === 'generating') {
            // 生成中：返回进度
            res.json({
                code: 0,
                data: {
                    report_id: report.id,
                    status: 'generating',
                    progress: 30, // 固定进度，实际可从 Redis 获取
                    current_section: 'dimensions',
                },
            });
            return;
        }
        if (report.status === 'failed') {
            logger.warn('Report generation failed', { requestId, reportId });
            res.status(500).json({
                code: 500,
                message: '报告生成失败，请稍后重试',
            });
            return;
        }
        // 6. 已完成：返回完整报告内容
        const content = parseReportContent(report.content);
        const title = generateReportTitle(report.result.mbtiType, report.reportType);
        const summary = generateReportSummary(report.result.mbtiType, report.reportType);
        // 更新已读时间
        await prisma.report.update({
            where: { id: reportId },
            data: {
                updatedAt: new Date(),
            },
        });
        logger.info('Report retrieved', { requestId, userId, reportId, reportType: report.reportType });
        res.json({
            code: 0,
            data: {
                report_id: report.id,
                status: 'completed',
                type: report.reportType,
                title,
                summary,
                content: {
                    dimensions: content.dimensions || { title: '四维深度解析', sections: [] },
                    career: content.career || { title: '职业发展指引', suggestions: [] },
                    relationship: content.relationship || { title: '人际关系图谱', analysis: [] },
                    growth: content.growth || { title: '个人成长计划', plans: [] },
                },
                meta: {
                    llm_model: 'gpt-4o-mini',
                    tokens_used: report.tokens,
                    generation_time_ms: report.generationTime,
                },
            },
        });
    }
    catch (error) {
        logger.error('Error getting report', {
            requestId,
            error: error.message,
            stack: error.stack,
        });
        res.status(500).json({
            code: 500,
            message: '获取报告失败，请稍后重试',
        });
    }
}
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
async function getReportHistoryHandler(req, res) {
    const requestId = `list_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    try {
        const userId = req.user?.id;
        const { page = '1', page_size = '20', type } = req.query;
        // 1. 验证用户身份
        if (!userId) {
            logger.warn('Unauthorized report history access attempt', { requestId });
            res.status(401).json({
                code: 401,
                message: '未授权访问',
            });
            return;
        }
        // 2. 解析分页参数
        const pageNum = Math.max(1, parseInt(page) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(page_size) || 20));
        const skip = (pageNum - 1) * pageSize;
        // 3. 构建查询条件
        const where = {
            result: {
                userId,
            },
            status: 'completed', // 只返回已完成的报告
        };
        if (type && ['basic', 'pro', 'master'].includes(type)) {
            where.reportType = type;
        }
        // 4. 查询总数
        const total = await prisma.report.count({ where });
        const totalPages = Math.ceil(total / pageSize);
        // 5. 查询报告列表
        const reports = await prisma.report.findMany({
            where,
            include: {
                result: {
                    select: {
                        mbtiType: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: pageSize,
        });
        // 6. 格式化响应
        const items = reports.map((report) => ({
            report_id: report.id,
            personality_type: report.result.mbtiType,
            type: report.reportType,
            title: generateReportTitle(report.result.mbtiType, report.reportType),
            summary: generateReportSummary(report.result.mbtiType, report.reportType),
            created_at: report.createdAt.toISOString(),
            read_at: report.updatedAt.toISOString(), // 使用 updatedAt 作为已读时间
        }));
        logger.info('Report history retrieved', {
            requestId,
            userId,
            page: pageNum,
            page_size: pageSize,
            total,
        });
        res.json({
            code: 0,
            data: {
                items,
                pagination: {
                    page: pageNum,
                    page_size: pageSize,
                    total,
                    total_pages: totalPages,
                },
            },
        });
    }
    catch (error) {
        logger.error('Error getting report history', {
            requestId,
            error: error.message,
            stack: error.stack,
        });
        res.status(500).json({
            code: 500,
            message: '获取报告列表失败，请稍后重试',
        });
    }
}
// ==================== 导出 ====================
exports.default = {
    generateReportHandler,
    getReportHandler,
    getReportHistoryHandler,
};
//# sourceMappingURL=reports.js.map