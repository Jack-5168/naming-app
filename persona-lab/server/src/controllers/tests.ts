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
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as winston from 'winston';

const prisma = new PrismaClient();

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
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
 * Request/Response Type Definitions
 */

interface CreateSessionRequest {
  mode?: 'classic' | 'adaptive';
  device_type?: string;
  entry_source?: string;
}

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

interface SubmitAnswerRequest {
  question_id: number;
  option_id: number;
  response_time_ms: number;
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
export async function createTestSession(
  req: Request,
  res: Response<CreateSessionResponse>
): Promise<void> {
  try {
    const userId = (req as any).user?.id;

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

    const { mode = 'classic', device_type, entry_source } = req.body as CreateSessionRequest;

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
    const { checkFeatureAccess } = await import('./memberships');
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
    const sessionId = uuidv4();
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
  } catch (error) {
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
export async function getNextQuestion(
  req: Request,
  res: Response<NextQuestionResponse>
): Promise<void> {
  try {
    const { session_id } = req.params;
    const userId = (req as any).user?.id;

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
  } catch (error) {
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
export async function submitAnswer(
  req: Request,
  res: Response<SubmitAnswerResponse>
): Promise<void> {
  try {
    const { session_id } = req.params;
    const { question_id, option_id, response_time_ms } = req.body as SubmitAnswerRequest;
    const userId = (req as any).user?.id;

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
  } catch (error) {
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
export async function getTestResults(
  req: Request,
  res: Response<TestResultResponse>
): Promise<void> {
  try {
    const { result_id } = req.params;
    const userId = (req as any).user?.id;

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
    const responseCount = testResult.answers ? (testResult.answers as any[]).length : 0;
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
  } catch (error) {
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
export function calculateDimensionScores(responses: any[]): { E: number; N: number; T: number; J: number } {
  const scores = { E: 50, N: 50, T: 50, J: 50 };

  responses.forEach(response => {
    const dimension = response.question?.dimension;
    const optionScore = response.option?.score || 0;

    if (dimension && scores[dimension as keyof typeof scores] !== undefined) {
      // Adjust score based on option (positive for one pole, negative for the other)
      if (optionScore > 0) {
        scores[dimension as keyof typeof scores] += 5;
      } else if (optionScore < 0) {
        scores[dimension as keyof typeof scores] -= 5;
      }
    }
  });

  // Normalize scores to 0-100 range
  (Object.keys(scores) as Array<keyof typeof scores>).forEach(key => {
    scores[key] = Math.max(0, Math.min(100, scores[key]));
  });

  return scores;
}

/**
 * Helper function to calculate MBTI type from dimension scores
 */
export function calculateMBTIType(scores: { E: number; N: number; T: number; J: number }): string {
  return `${scores.E >= 50 ? 'E' : 'I'}${scores.N >= 50 ? 'N' : 'S'}${scores.T >= 50 ? 'T' : 'F'}${scores.J >= 50 ? 'J' : 'P'}`;
}

/**
 * POST /api/v1/tests/sessions/{session_id}/complete
 * Complete a test session and generate results
 * This is an internal endpoint called after all questions are answered
 */
export async function completeTest(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { session_id } = req.params;
    const userId = (req as any).user?.id;

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
    const { calculateStability } = await import('../services/stability-calculator');
    
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
      questionCount: t.answers ? (t.answers as any[]).length : 0,
      testMode: 'CAT' as const,
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
    const { recordFeatureUsage } = await import('./memberships');
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
  } catch (error) {
    logger.error('Error completing test', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to complete test',
    });
  }
}

export default {
  createTestSession,
  getNextQuestion,
  submitAnswer,
  getTestResults,
  completeTest,
  calculateDimensionScores,
  calculateMBTIType,
};
