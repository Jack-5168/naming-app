/**
 * Report Routes - 报告管理路由
 * Phase 1: MVP Implementation
 * 
 * API Endpoints:
 * - POST /api/v1/reports - 生成报告
 * - GET /api/v1/reports/:id - 获取报告状态/内容
 * - GET /api/v1/reports - 获取历史报告列表
 */

import { Router } from 'express';
import {
  generateReportHandler,
  getReportHandler,
  getReportHistoryHandler,
} from '../controllers/reports';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * @route   POST /api/v1/reports
 * @desc    生成新的报告
 * @access  Private
 * 
 * @headers { Authorization: Bearer <token> }
 * @body    { result_id: number, report_type: 'basic' | 'pro' | 'master', include_sections?: string[] }
 * @returns { code: 0, data: { report_id, status, estimated_time_seconds, progress_url } }
 */
router.post('/', authMiddleware, generateReportHandler);

/**
 * @route   GET /api/v1/reports/:id
 * @desc    获取报告状态或内容
 * @access  Private
 * 
 * @headers { Authorization: Bearer <token> }
 * @params  { id: string } - 报告 ID
 * @returns 生成中：{ code: 0, data: { report_id, status: 'generating', progress, current_section } }
 *          已完成：{ code: 0, data: { report_id, status: 'completed', type, title, summary, content, meta } }
 */
router.get('/:id', authMiddleware, getReportHandler);

/**
 * @route   GET /api/v1/reports
 * @desc    获取用户历史报告列表
 * @access  Private
 * 
 * @headers { Authorization: Bearer <token> }
 * @query   { page?: number, page_size?: number, type?: 'basic' | 'pro' | 'master' }
 * @returns { code: 0, data: { items: [], pagination: { page, page_size, total, total_pages } } }
 */
router.get('/', authMiddleware, getReportHistoryHandler);

export default router;
export { router as reportRoutes };
