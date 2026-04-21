"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.testRoutes = void 0;
const express_1 = require("express");
const tests_1 = require("../controllers/tests");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
exports.testRoutes = router;
/**
 * @route   POST /api/v1/tests/sessions
 * @desc    Create a new test session
 * @access  Private
 *
 * @headers { Authorization: Bearer <token> }
 * @body    { mode?: "classic" | "adaptive", device_type?: string, entry_source?: string }
 * @returns { code: 0, data: { session_id, question_count, estimated_duration, mode } }
 */
router.post('/sessions', auth_1.authMiddleware, tests_1.createTestSession);
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
router.get('/sessions/:session_id/next', auth_1.authMiddleware, tests_1.getNextQuestion);
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
router.post('/sessions/:session_id/answer', auth_1.authMiddleware, tests_1.submitAnswer);
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
router.get('/results/:result_id', auth_1.authMiddleware, tests_1.getTestResults);
/**
 * @route   POST /api/v1/tests/sessions/:session_id/complete
 * @desc    Complete test session and generate results (internal endpoint)
 * @access  Private
 *
 * @headers { Authorization: Bearer <token> }
 * @params  { session_id: string } - Session ID
 * @returns { success: boolean, data: { testResultId, personalityType, ... } }
 */
router.post('/sessions/:session_id/complete', auth_1.authMiddleware, tests_1.completeTest);
exports.default = router;
//# sourceMappingURL=tests.js.map