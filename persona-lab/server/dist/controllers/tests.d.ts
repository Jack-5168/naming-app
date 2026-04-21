/**
 * Tests Controller - Test Session Management
 * Phase 1: Complete Implementation
 *
 * API Endpoints:
 * - POST /api/v1/tests/sessions - Create test session
 * - GET /api/v1/tests/sessions/{session_id}/next - Get next question
 * - POST /api/v1/tests/sessions/{session_id}/answer - Submit answer
 * - GET /api/v1/tests/results/{result_id} - Get test results
 */
import { Request, Response } from 'express';
interface CreateSessionResponse {
    code: number;
    data: {
        session_id: string;
        question_count: number;
        estimated_duration: number;
        mode: string;
    };
}
interface NextQuestionResponse {
    code: number;
    data: {
        question_id: number;
        sequence: number;
        content: string;
        options: Array<{
            id: number;
            key: string;
            content: string;
        }>;
        progress: {
            current: number;
            total: number;
            percentage: number;
        };
    };
}
interface SubmitAnswerResponse {
    code: number;
    data: {
        accepted: boolean;
        progress: {
            current: number;
            total: number;
            percentage: number;
        };
    };
}
interface TestResultResponse {
    code: number;
    data: {
        result_id: number;
        personality_type: string;
        dimensions: {
            [key: string]: {
                score: number;
                label: string;
                percentage: number;
            };
        };
        measurement_reliability: number;
        stability_index: number | null;
        created_at: string;
    };
}
/**
 * POST /api/v1/tests/sessions
 * Create a new test session
 *
 * @param req - Express request with mode, device_type, entry_source
 * @param res - Express response with session details
 */
export declare function createTestSession(req: Request, res: Response<CreateSessionResponse>): Promise<void>;
/**
 * GET /api/v1/tests/sessions/{session_id}/next
 * Get the next question in the test session
 *
 * @param req - Express request with session_id parameter
 * @param res - Express response with question details
 */
export declare function getNextQuestion(req: Request, res: Response<NextQuestionResponse>): Promise<void>;
/**
 * POST /api/v1/tests/sessions/{session_id}/answer
 * Submit an answer for a question
 *
 * @param req - Express request with session_id and answer data
 * @param res - Express response with acceptance status and progress
 */
export declare function submitAnswer(req: Request, res: Response<SubmitAnswerResponse>): Promise<void>;
/**
 * GET /api/v1/tests/results/{result_id}
 * Get test results with personality type and dimensions
 *
 * @param req - Express request with result_id parameter
 * @param res - Express response with test results
 */
export declare function getTestResults(req: Request, res: Response<TestResultResponse>): Promise<void>;
/**
 * Helper function to calculate dimension scores from responses
 * Used when completing a test session
 */
export declare function calculateDimensionScores(responses: any[]): {
    E: number;
    N: number;
    T: number;
    J: number;
};
/**
 * Helper function to calculate MBTI type from dimension scores
 */
export declare function calculateMBTIType(scores: {
    E: number;
    N: number;
    T: number;
    J: number;
}): string;
/**
 * POST /api/v1/tests/sessions/{session_id}/complete
 * Complete a test session and generate results
 * This is an internal endpoint called after all questions are answered
 */
export declare function completeTest(req: Request, res: Response): Promise<void>;
declare const _default: {
    createTestSession: typeof createTestSession;
    getNextQuestion: typeof getNextQuestion;
    submitAnswer: typeof submitAnswer;
    getTestResults: typeof getTestResults;
    completeTest: typeof completeTest;
    calculateDimensionScores: typeof calculateDimensionScores;
    calculateMBTIType: typeof calculateMBTIType;
};
export default _default;
//# sourceMappingURL=tests.d.ts.map