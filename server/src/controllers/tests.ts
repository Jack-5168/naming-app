/**
 * Tests Controller - Manages test sessions and answer submission
 * Phase 2 Integration: CAT Engine + Stability Index
 */

import { Request, Response } from 'express';
import { CATEngine } from '../services/cat-engine';
import { calculateStability } from '../services/stability-calculator';
import { calculateResult } from '../services/result-calculator';
import { Answer, TestSession, AnswerResponse, TestHistory } from '../types';

// In-memory session store (replace with database in production)
const sessionStore: Map<string, TestSession> = new Map();
const testHistoryStore: Map<string, TestHistory[]> = new Map();

/**
 * Create a new test session
 * POST /api/v1/tests/sessions
 */
export async function createSession(req: Request, res: Response): Promise<void> {
  const { userId } = req.body;
  
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }
  
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const session: TestSession = {
    id: sessionId,
    userId,
    answers: [],
    startTime: Date.now(),
    completed: false
  };
  
  sessionStore.set(sessionId, session);
  
  res.status(201).json({
    sessionId,
    message: 'Test session created'
  });
}

/**
 * Submit an answer and get next question (CAT-enabled)
 * POST /api/v1/tests/sessions/:id/answer
 * 
 * Phase 2 Integration: Returns real-time ability estimates and CAT-selected questions
 */
export async function submitAnswer(req: Request, res: Response): Promise<void> {
  const { id: sessionId } = req.params;
  const { questionId, dimension, selectedOption }: Answer = req.body;
  
  const session = sessionStore.get(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  
  // Record the answer
  const answer: Answer = {
    questionId,
    dimension,
    selectedOption,
    timestamp: Date.now()
  };
  
  session.answers.push(answer);
  
  // Initialize CAT engine
  const catEngine = new CATEngine();
  
  // Use CAT engine to select next question
  const nextQuestion = catEngine.selectNextQuestion(session.answers);
  
  // Calculate current ability estimate
  const ability = catEngine.estimateAbility(session.answers);
  const sem = catEngine.calculateSEM(session.answers);
  
  // Check if test should terminate
  if (catEngine.shouldTerminate(session.answers)) {
    // Complete the test
    session.completed = true;
    session.endTime = Date.now();
    sessionStore.set(sessionId, session);
    
    // Calculate final result using CAT ability estimates
    const result = calculateResult(ability);
    
    // Get test history for stability calculation
    const testHistory = testHistoryStore.get(session.userId) || [];
    
    // Calculate stability index
    const stability = await calculateStability(session.userId, testHistory);
    
    // Save to history
    testHistory.push({
      testId: sessionId,
      mbtiType: result.mbtiType,
      dimensionScores: result.dimensionScores,
      completedAt: Date.now()
    });
    testHistoryStore.set(session.userId, testHistory);
    
    // Return completed response
    const response: AnswerResponse = {
      accepted: true,
      progress: {
        current: session.answers.length,
        total: session.answers.length,
        percentage: 100
      },
      completed: true,
      result,
      stability
    };
    
    res.json(response);
    return;
  }
  
  // Test continues - return next question and real-time estimates
  sessionStore.set(sessionId, session);
  
  const response: AnswerResponse = {
    accepted: true,
    nextQuestion,
    progress: {
      current: session.answers.length,
      total: 20, // Max questions
      percentage: Math.round((session.answers.length / 20) * 100)
    },
    ability: {
      E: Math.round(ability[0]),
      N: Math.round(ability[1]),
      T: Math.round(ability[2]),
      J: Math.round(ability[3])
    },
    sem: Math.round(sem * 100) / 100,
    completed: false
  };
  
  res.json(response);
}

/**
 * Get current session status
 * GET /api/v1/tests/sessions/:id
 */
export async function getSession(req: Request, res: Response): Promise<void> {
  const { id: sessionId } = req.params;
  
  const session = sessionStore.get(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  
  res.json({
    sessionId: session.id,
    answersCount: session.answers.length,
    completed: session.completed,
    startTime: session.startTime,
    endTime: session.endTime
  });
}

/**
 * Get user's test history
 * GET /api/v1/tests/history/:userId
 */
export async function getHistory(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  
  const history = testHistoryStore.get(userId) || [];
  
  res.json({
    userId,
    testCount: history.length,
    tests: history
  });
}
