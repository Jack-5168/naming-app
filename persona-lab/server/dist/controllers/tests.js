"use strict";
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
exports.createTestSession = createTestSession;
exports.getNextQuestion = getNextQuestion;
exports.submitAnswer = submitAnswer;
exports.getTestResults = getTestResults;
exports.calculateDimensionScores = calculateDimensionScores;
exports.calculateMBTIType = calculateMBTIType;
exports.completeTest = completeTest;
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
const winston = __importStar(require("winston"));
const prisma = new client_1.PrismaClient();
// Logger setup
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/tests-controller.log' }),
    ],
});
// Test configuration
const CLASSIC_QUESTION_COUNT = 15;
const ADAPTIVE_QUESTION_COUNT = 20;
const ESTIMATED_DURATION_CLASSIC = 180; // seconds
const ESTIMATED_DURATION_ADAPTIVE = 240; // seconds
/**
 * POST /api/v1/tests/sessions
 * Create a new test session
 *
 * @param req - Express request with mode, device_type, entry_source
 * @param res - Express response with session details
 */
async function createTestSession(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                code: 401,
                data: {
                    session_id: '',
                    question_count: 0,
                    estimated_duration: 0,
                    mode: '',
                },
            });
            return;
        }
        const { mode = 'classic', device_type, entry_source } = req.body;
        // Validate mode
        if (!['classic', 'adaptive'].includes(mode)) {
            res.status(400).json({
                code: 400,
                data: {
                    session_id: '',
                    question_count: 0,
                    estimated_duration: 0,
                    mode: '',
                },
            });
            return;
        }
        // Check if user has available test attempts
        const { checkFeatureAccess } = await Promise.resolve().then(() => __importStar(require('./memberships')));
        const access = await checkFeatureAccess(userId, 'report_basic');
        if (!access.allowed) {
            res.status(403).json({
                code: 403,
                data: {
                    session_id: '',
                    question_count: 0,
                    estimated_duration: 0,
                    mode: '',
                },
            });
            return;
        }
        // Determine question count and duration based on mode
        const questionCount = mode === 'classic' ? CLASSIC_QUESTION_COUNT : ADAPTIVE_QUESTION_COUNT;
        const estimatedDuration = mode === 'classic' ? ESTIMATED_DURATION_CLASSIC : ESTIMATED_DURATION_ADAPTIVE;
        // Create test session
        const sessionId = (0, uuid_1.v4)();
        const session = await prisma.testSession.create({
            data: {
                sessionId,
                userId,
                status: 'active',
                maxQuestions: questionCount,
            },
        });
        logger.info('Test session created', {
            sessionId: session.sessionId,
            userId,
            mode,
            device_type,
            entry_source,
        });
        res.json({
            code: 0,
            data: {
                session_id: session.sessionId,
                question_count: questionCount,
                estimated_duration: estimatedDuration,
                mode: mode,
            },
        });
    }
    catch (error) {
        logger.error('Error creating test session', { error });
        res.status(500).json({
            code: 500,
            data: {
                session_id: '',
                question_count: 0,
                estimated_duration: 0,
                mode: '',
            },
        });
    }
}
/**
 * GET /api/v1/tests/sessions/{session_id}/next
 * Get the next question in the test session
 *
 * @param req - Express request with session_id parameter
 * @param res - Express response with question details
 */
async function getNextQuestion(req, res) {
    try {
        const { session_id } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                code: 401,
                data: {
                    question_id: 0,
                    sequence: 0,
                    content: '',
                    options: [],
                    progress: { current: 0, total: 0, percentage: 0 },
                },
            });
            return;
        }
        const session = await prisma.testSession.findUnique({
            where: { sessionId: session_id },
            include: {
                responses: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        if (!session) {
            res.status(404).json({
                code: 404,
                data: {
                    question_id: 0,
                    sequence: 0,
                    content: '',
                    options: [],
                    progress: { current: 0, total: 0, percentage: 0 },
                },
            });
            return;
        }
        if (session.userId !== userId) {
            res.status(403).json({
                code: 403,
                data: {
                    question_id: 0,
                    sequence: 0,
                    content: '',
                    options: [],
                    progress: { current: 0, total: 0, percentage: 0 },
                },
            });
            return;
        }
        if (session.status !== 'active') {
            res.status(400).json({
                code: 400,
                data: {
                    question_id: 0,
                    sequence: 0,
                    content: '',
                    options: [],
                    progress: { current: 0, total: 0, percentage: 0 },
                },
            });
            return;
        }
        // Check if test is complete
        if (session.responses.length >= session.maxQuestions) {
            res.status(400).json({
                code: 400,
                data: {
                    question_id: 0,
                    sequence: 0,
                    content: '',
                    options: [],
                    progress: {
                        current: session.responses.length,
                        total: session.maxQuestions,
                        percentage: Math.round((session.responses.length / session.maxQuestions) * 100),
                    },
                },
            });
            return;
        }
        // Get next question using simple rotation (can be enhanced with CAT)
        const answeredQuestionIds = session.responses.map(r => r.questionId);
        // Get a question that hasn't been answered yet
        const question = await prisma.question.findFirst({
            where: {
                id: { notIn: answeredQuestionIds },
                isActive: true,
            },
            include: {
                options: {
                    orderBy: { id: 'asc' },
                },
            },
        });
        if (!question) {
            res.status(404).json({
                code: 404,
                data: {
                    question_id: 0,
                    sequence: 0,
                    content: '',
                    options: [],
                    progress: { current: 0, total: 0, percentage: 0 },
                },
            });
            return;
        }
        const currentSequence = session.responses.length + 1;
        const progress = {
            current: currentSequence,
            total: session.maxQuestions,
            percentage: Math.round((currentSequence / session.maxQuestions) * 100),
        };
        logger.info('Next question retrieved', {
            sessionId: session_id,
            questionId: question.id,
            sequence: currentSequence,
        });
        res.json({
            code: 0,
            data: {
                question_id: question.id,
                sequence: currentSequence,
                content: question.text,
                options: question.options.map(opt => ({
                    id: opt.id,
                    key: String.fromCharCode(65 + (opt.id % 4)), // A, B, C, D
                    content: opt.text,
                })),
                progress,
            },
        });
    }
    catch (error) {
        logger.error('Error getting next question', { error });
        res.status(500).json({
            code: 500,
            data: {
                question_id: 0,
                sequence: 0,
                content: '',
                options: [],
                progress: { current: 0, total: 0, percentage: 0 },
            },
        });
    }
}
/**
 * POST /api/v1/tests/sessions/{session_id}/answer
 * Submit an answer for a question
 *
 * @param req - Express request with session_id and answer data
 * @param res - Express response with acceptance status and progress
 */
async function submitAnswer(req, res) {
    try {
        const { session_id } = req.params;
        const { question_id, option_id, response_time_ms } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                code: 401,
                data: {
                    accepted: false,
                    progress: { current: 0, total: 0, percentage: 0 },
                },
            });
            return;
        }
        // Validate required fields
        if (!question_id || !option_id) {
            res.status(400).json({
                code: 400,
                data: {
                    accepted: false,
                    progress: { current: 0, total: 0, percentage: 0 },
                },
            });
            return;
        }
        const session = await prisma.testSession.findUnique({
            where: { sessionId: session_id },
        });
        if (!session) {
            res.status(404).json({
                code: 404,
                data: {
                    accepted: false,
                    progress: { current: 0, total: 0, percentage: 0 },
                },
            });
            return;
        }
        if (session.userId !== userId) {
            res.status(403).json({
                code: 403,
                data: {
                    accepted: false,
                    progress: { current: 0, total: 0, percentage: 0 },
                },
            });
            return;
        }
        if (session.status !== 'active') {
            res.status(400).json({
                code: 400,
                data: {
                    accepted: false,
                    progress: { current: 0, total: 0, percentage: 0 },
                },
            });
            return;
        }
        // Validate that the question belongs to the active question pool
        const question = await prisma.question.findUnique({
            where: { id: question_id },
        });
        if (!question || !question.isActive) {
            res.status(400).json({
                code: 400,
                data: {
                    accepted: false,
                    progress: { current: 0, total: 0, percentage: 0 },
                },
            });
            return;
        }
        // Validate option belongs to the question
        const option = await prisma.questionOption.findFirst({
            where: {
                id: option_id,
                questionId: question_id,
            },
        });
        if (!option) {
            res.status(400).json({
                code: 400,
                data: {
                    accepted: false,
                    progress: { current: 0, total: 0, percentage: 0 },
                },
            });
            return;
        }
        // Record the response
        await prisma.response.create({
            data: {
                sessionId: session.id,
                questionId: question_id,
                optionId: option_id,
                timeSpent: Math.floor((response_time_ms || 0) / 1000), // Convert ms to seconds
            },
        });
        // Update session last answered time
        await prisma.testSession.update({
            where: { id: session.id },
            data: {
                lastAnsweredAt: new Date(),
            },
        });
        // Get updated response count
        const responseCount = await prisma.response.count({
            where: { sessionId: session.id },
        });
        // Check if test should be completed
        if (responseCount >= session.maxQuestions) {
            await prisma.testSession.update({
                where: { id: session.id },
                data: {
                    status: 'completed',
                    completedAt: new Date(),
                },
            });
        }
        const progress = {
            current: responseCount,
            total: session.maxQuestions,
            percentage: Math.round((responseCount / session.maxQuestions) * 100),
        };
        logger.info('Answer submitted', {
            sessionId: session_id,
            questionId,
            optionId,
            responseTimeMs: response_time_ms,
            progress,
        });
        res.json({
            code: 0,
            data: {
                accepted: true,
                progress,
            },
        });
    }
    catch (error) {
        logger.error('Error submitting answer', { error });
        res.status(500).json({
            code: 500,
            data: {
                accepted: false,
                progress: { current: 0, total: 0, percentage: 0 },
            },
        });
    }
}
/**
 * GET /api/v1/tests/results/{result_id}
 * Get test results with personality type and dimensions
 *
 * @param req - Express request with result_id parameter
 * @param res - Express response with test results
 */
async function getTestResults(req, res) {
    try {
        const { result_id } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                code: 401,
                data: {
                    result_id: 0,
                    personality_type: '',
                    dimensions: {},
                    measurement_reliability: 0,
                    stability_index: null,
                    created_at: '',
                },
            });
            return;
        }
        const testResult = await prisma.testResult.findUnique({
            where: { id: parseInt(result_id) },
        });
        if (!testResult) {
            res.status(404).json({
                code: 404,
                data: {
                    result_id: 0,
                    personality_type: '',
                    dimensions: {},
                    measurement_reliability: 0,
                    stability_index: null,
                    created_at: '',
                },
            });
            return;
        }
        if (testResult.userId !== userId) {
            res.status(403).json({
                code: 403,
                data: {
                    result_id: 0,
                    personality_type: '',
                    dimensions: {},
                    measurement_reliability: 0,
                    stability_index: null,
                    created_at: '',
                },
            });
            return;
        }
        // Calculate measurement reliability based on response count
        const responseCount = testResult.answers ? testResult.answers.length : 0;
        const measurementReliability = Math.min(0.95, 0.5 + (responseCount * 0.03));
        // Format dimensions for MBTI (E/I, N/S, T/F, J/P)
        const dimensions = {
            E: {
                score: Math.round(testResult.eScore),
                label: testResult.eScore >= 50 ? '外向型' : '内向型',
                percentage: Math.round(testResult.eScore),
            },
            N: {
                score: Math.round(testResult.nScore),
                label: testResult.nScore >= 50 ? '直觉型' : '实感型',
                percentage: Math.round(testResult.nScore),
            },
            T: {
                score: Math.round(testResult.tScore),
                label: testResult.tScore >= 50 ? '思考型' : '情感型',
                percentage: Math.round(testResult.tScore),
            },
            J: {
                score: Math.round(testResult.jScore),
                label: testResult.jScore >= 50 ? '判断型' : '知觉型',
                percentage: Math.round(testResult.jScore),
            },
        };
        logger.info('Test results retrieved', {
            resultId,
            userId,
            personalityType: testResult.mbtiType,
        });
        res.json({
            code: 0,
            data: {
                result_id: testResult.id,
                personality_type: testResult.mbtiType,
                dimensions,
                measurement_reliability: Math.round(measurementReliability * 100) / 100,
                stability_index: testResult.stabilityIndex ?? null,
                created_at: testResult.createdAt.toISOString(),
            },
        });
    }
    catch (error) {
        logger.error('Error getting test results', { error });
        res.status(500).json({
            code: 500,
            data: {
                result_id: 0,
                personality_type: '',
                dimensions: {},
                measurement_reliability: 0,
                stability_index: null,
                created_at: '',
            },
        });
    }
}
/**
 * Helper function to calculate dimension scores from responses
 * Used when completing a test session
 */
function calculateDimensionScores(responses) {
    const scores = { E: 50, N: 50, T: 50, J: 50 };
    responses.forEach(response => {
        const dimension = response.question?.dimension;
        const optionScore = response.option?.score || 0;
        if (dimension && scores[dimension] !== undefined) {
            // Adjust score based on option (positive for one pole, negative for the other)
            if (optionScore > 0) {
                scores[dimension] += 5;
            }
            else if (optionScore < 0) {
                scores[dimension] -= 5;
            }
        }
    });
    // Normalize scores to 0-100 range
    Object.keys(scores).forEach(key => {
        scores[key] = Math.max(0, Math.min(100, scores[key]));
    });
    return scores;
}
/**
 * Helper function to calculate MBTI type from dimension scores
 */
function calculateMBTIType(scores) {
    return `${scores.E >= 50 ? 'E' : 'I'}${scores.N >= 50 ? 'N' : 'S'}${scores.T >= 50 ? 'T' : 'F'}${scores.J >= 50 ? 'J' : 'P'}`;
}
/**
 * POST /api/v1/tests/sessions/{session_id}/complete
 * Complete a test session and generate results
 * This is an internal endpoint called after all questions are answered
 */
async function completeTest(req, res) {
    try {
        const { session_id } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                error: 'Unauthorized',
            });
            return;
        }
        const session = await prisma.testSession.findUnique({
            where: { sessionId: session_id },
            include: {
                responses: {
                    include: {
                        question: true,
                        option: true,
                    },
                },
            },
        });
        if (!session) {
            res.status(404).json({
                success: false,
                error: 'Session not found',
            });
            return;
        }
        if (session.userId !== userId) {
            res.status(403).json({
                success: false,
                error: 'Access denied',
            });
            return;
        }
        // Calculate dimension scores
        const scores = calculateDimensionScores(session.responses);
        // Calculate MBTI type
        const mbtiType = calculateMBTIType(scores);
        // Calculate stability index (import from stability calculator)
        const { calculateStability } = await Promise.resolve().then(() => __importStar(require('../services/stability-calculator')));
        // Get user's test history for stability calculation
        const testHistory = await prisma.testResult.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
        });
        // Convert to format expected by stability calculator
        const formattedHistory = testHistory.map(t => ({
            testId: t.id.toString(),
            userId: t.userId,
            completedAt: t.createdAt.getTime(),
            scores: {
                O: 50, // Default values - would need Big Five scores in real implementation
                C: 50,
                E: t.eScore,
                A: 50,
                N: t.nScore,
            },
            questionCount: t.answers ? t.answers.length : 0,
            testMode: 'CAT',
        }));
        const stabilityResult = await calculateStability(userId, formattedHistory);
        // Create test result
        const testResult = await prisma.testResult.create({
            data: {
                userId,
                sessionId: session.id,
                eScore: scores.E,
                nScore: scores.N,
                tScore: scores.T,
                jScore: scores.J,
                mbtiType,
                stabilityIndex: stabilityResult.stabilityIndex,
                answers: session.responses.map(r => ({
                    questionId: r.questionId,
                    optionId: r.optionId,
                    timeSpent: r.timeSpent,
                })),
            },
        });
        // Update session status
        await prisma.testSession.update({
            where: { id: session.id },
            data: {
                status: 'completed',
                completedAt: new Date(),
                testResultId: testResult.id,
            },
        });
        // Update user's test count
        await prisma.user.update({
            where: { id: userId },
            data: {
                testCount: { increment: 1 },
            },
        });
        // Record feature usage
        const { recordFeatureUsage } = await Promise.resolve().then(() => __importStar(require('./memberships')));
        await recordFeatureUsage(userId, 'report_basic', { testResultId: testResult.id });
        logger.info('Test completed', {
            sessionId: session_id,
            resultId: testResult.id,
            mbtiType,
        });
        res.json({
            success: true,
            data: {
                testResultId: testResult.id,
                personalityType: mbtiType,
                dimensionScores: scores,
                stabilityIndex: stabilityResult.stabilityIndex,
                totalQuestions: session.responses.length,
            },
        });
    }
    catch (error) {
        logger.error('Error completing test', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to complete test',
        });
    }
}
exports.default = {
    createTestSession,
    getNextQuestion,
    submitAnswer,
    getTestResults,
    completeTest,
    calculateDimensionScores,
    calculateMBTIType,
};
//# sourceMappingURL=tests.js.map