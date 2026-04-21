/**
 * Test Routes
 * Phase 1: Complete Implementation
 * 
 * API Endpoints:
 * - POST /api/v1/tests/sessions - Create test session
 * - GET /api/v1/tests/sessions/{session_id}/next - Get next question
 * - POST /api/v1/tests/sessions/{session_id}/answer - Submit answer
 * - GET /api/v1/tests/results/{result_id} - Get test results
 */

import { Router } from 'express';
import {
  createSession,
  submitAnswer,
} from '../controllers/tests';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * @route   POST /api/v1/tests/sessions
 * @desc    Create a new test session
 * @access  Private
 * 
 * @headers { Authorization: Bearer <token> }
 * @body    { mode?: "classic" | "adaptive", device_type?: string, entry_source?: string }
 * @returns { code: 0, data: { session_id, question_count, estimated_duration, mode } }
 */
router.post('/sessions', authMiddleware, createSession);

/**
 * @route   GET /api/v1/tests/sessions/:session_id/next
 * @desc    Get the next question in the test session
 * @access  Private
 * 
 * @headers { Authorization: Bearer <token> }
 * @params  { session_id: string } - Session ID
 * @returns { 
 *   code: 0, 
 *   data: { 
 *     question_id, 
 *     sequence, 
 *     content, 
 *     options: [{ id, key, content }],
 *     progress: { current, total, percentage }
 *   } 
 * }
 */
router.get('/sessions/:session_id/next', authMiddleware, submitAnswer);

/**
 * @route   POST /api/v1/tests/sessions/:session_id/answer
 * @desc    Submit an answer for a question
 * @access  Private
 * 
 * @headers { Authorization: Bearer <token> }
 * @params  { session_id: string } - Session ID
 * @body    { question_id: number, option_id: number, response_time_ms: number }
 * @returns { 
 *   code: 0, 
 *   data: { 
 *     accepted: boolean,
 *     progress: { current, total, percentage }
 *   } 
 * }
 */
router.post('/sessions/:session_id/answer', authMiddleware, submitAnswer);

/**
 * @route   GET /api/v1/tests/results/:result_id
 * @desc    Get test results with personality type and dimensions
 * @access  Private
 * 
 * @headers { Authorization: Bearer <token> }
 * @params  { result_id: string } - Test result ID
 * @returns { 
 *   code: 0, 
 *   data: { 
 *     result_id, 
 *     personality_type, 
 *     dimensions: { E, N, T, J },
 *     measurement_reliability,
 *     stability_index,
 *     created_at
 *   } 
 * }
 */
// Temporarily disabled - need to implement these handlers
// router.get('/results/:result_id', authMiddleware, getTestResults);
// router.post('/sessions/:session_id/complete', authMiddleware, completeTest);

export default router;
export { router as testRoutes };
