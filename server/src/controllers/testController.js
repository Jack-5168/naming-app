const { prisma } = require('../index');
const { v4: uuidv4 } = require('uuid');

/**
 * POST /api/v1/tests/sessions
 * Create a new test session
 */
exports.createSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = uuidv4();

    // Get active questions (sample 15 questions for the test)
    const questions = await prisma.question.findMany({
      where: { isActive: true },
      include: {
        options: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
      take: 15,
    });

    if (questions.length === 0) {
      return res.status(400).json({ error: 'No questions available' });
    }

    // Create test result record
    const testResult = await prisma.testResult.create({
      data: {
        userId,
        sessionId,
        dimensionScores: {
          openness: 0,
          conscientiousness: 0,
          extraversion: 0,
          neuroticism: 0,
        },
        stabilityIndex: 0,
        totalQuestions: questions.length,
        answeredQuestions: 0,
        timeSpent: 0,
      },
    });

    res.json({
      sessionId: testResult.sessionId,
      testResultId: testResult.id,
      totalQuestions: questions.length,
      startTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create test session' });
  }
};

/**
 * GET /api/v1/tests/sessions/:id/next
 * Get next question in the session
 */
exports.getNextQuestion = async (req, res) => {
  try {
    const { id: sessionId } = req.params;

    // Find test result
    const testResult = await prisma.testResult.findUnique({
      where: { sessionId },
      include: {
        responses: {
          select: { questionId: true },
        },
      },
    });

    if (!testResult) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get answered question IDs
    const answeredIds = testResult.responses.map(r => r.questionId);

    // Get next unanswered question
    const nextQuestion = await prisma.question.findFirst({
      where: {
        isActive: true,
        id: { notIn: answeredIds },
      },
      include: {
        options: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    if (!nextQuestion) {
      // All questions answered, return completion status
      return res.json({
        completed: true,
        sessionId,
        testResultId: testResult.id,
        message: 'All questions answered',
      });
    }

    // Return question without sensitive IRT parameters
    res.json({
      completed: false,
      questionNumber: answeredIds.length + 1,
      totalQuestions: testResult.totalQuestions,
      question: {
        id: nextQuestion.id,
        code: nextQuestion.code,
        dimension: nextQuestion.dimension,
        text: nextQuestion.text,
        options: nextQuestion.options.map(opt => ({
          id: opt.id,
          code: opt.code,
          text: opt.text,
        })),
      },
    });
  } catch (error) {
    console.error('Get next question error:', error);
    res.status(500).json({ error: 'Failed to get next question' });
  }
};

/**
 * POST /api/v1/tests/sessions/:id/answer
 * Submit answer for a question
 */
exports.submitAnswer = async (req, res) => {
  try {
    const { id: sessionId } = req.params;
    const { questionId, optionId, timeSpent } = req.body;

    if (!questionId || !optionId) {
      return res.status(400).json({ error: 'Question ID and option ID required' });
    }

    // Find test result
    const testResult = await prisma.testResult.findUnique({
      where: { sessionId },
    });

    if (!testResult) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get question and option details
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { options: true },
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const option = question.options.find(o => o.id === optionId);
    if (!option) {
      return res.status(400).json({ error: 'Invalid option' });
    }

    // Create response record
    await prisma.response.create({
      data: {
        sessionId,
        testResultId: testResult.id,
        questionId,
        optionId,
        selectedOption: option.code,
        timeSpent: timeSpent || 0,
      },
    });

    // Update test result
    const answeredCount = await prisma.response.count({
      where: { testResultId: testResult.id },
    });

    await prisma.testResult.update({
      where: { id: testResult.id },
      data: {
        answeredQuestions: answeredCount,
      },
    });

    res.json({
      success: true,
      answeredQuestions: answeredCount,
      totalQuestions: testResult.totalQuestions,
    });
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({ error: 'Failed to submit answer' });
  }
};

/**
 * GET /api/v1/tests/results/:id
 * Get test results
 */
exports.getTestResults = async (req, res) => {
  try {
    const { id } = req.params;

    const testResult = await prisma.testResult.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            testCount: true,
          },
        },
        responses: {
          include: {
            question: {
              select: {
                dimension: true,
                code: true,
              },
            },
            option: {
              select: {
                score: true,
                code: true,
              },
            },
          },
        },
      },
    });

    if (!testResult) {
      return res.status(404).json({ error: 'Test result not found' });
    }

    // Check if user has access (owner or has permission)
    if (testResult.userId !== req.user.id && !req.user.isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Calculate dimension scores
    const dimensionScores = {
      openness: 0,
      conscientiousness: 0,
      extraversion: 0,
      neuroticism: 0,
    };

    const dimensionCounts = {
      openness: 0,
      conscientiousness: 0,
      extraversion: 0,
      neuroticism: 0,
    };

    testResult.responses.forEach(response => {
      const dimension = response.question.dimension;
      if (dimensionScores[dimension] !== undefined) {
        dimensionScores[dimension] += response.option.score;
        dimensionCounts[dimension] += 1;
      }
    });

    // Normalize scores to 0-100
    const normalizedScores = {};
    Object.keys(dimensionScores).forEach(dim => {
      const maxScore = dimensionCounts[dim] * 4; // max 4 points per question
      normalizedScores[dim] = maxScore > 0 
        ? Math.round((dimensionScores[dim] / maxScore) * 100)
        : 50;
    });

    // Determine personality type (simplified MBTI-like)
    const personalityType = determinePersonalityType(normalizedScores);

    // Calculate stability index
    const stabilityIndex = calculateStabilityIndex(testResult.user.testCount);

    res.json({
      id: testResult.id,
      sessionId: testResult.sessionId,
      dimensionScores: normalizedScores,
      personalityType,
      stabilityIndex,
      totalQuestions: testResult.totalQuestions,
      answeredQuestions: testResult.answeredQuestions,
      timeSpent: testResult.timeSpent,
      completedAt: testResult.completedAt,
      createdAt: testResult.createdAt,
    });
  } catch (error) {
    console.error('Get test results error:', error);
    res.status(500).json({ error: 'Failed to get test results' });
  }
};

// Helper function to determine personality type
function determinePersonalityType(scores) {
  // Simplified 4-dimension to 16-type mapping
  const type1 = scores.extraversion >= 50 ? 'E' : 'I';
  const type2 = scores.openness >= 50 ? 'N' : 'S';
  const type3 = scores.conscientiousness >= 50 ? 'J' : 'P';
  const type4 = scores.neuroticism < 50 ? 'F' : 'T'; // Lower neuroticism = more feeling-oriented
  
  return type1 + type2 + type3 + type4;
}

// Helper function to calculate stability index
function calculateStabilityIndex(testCount) {
  // Stability increases with more tests, caps at 100
  if (testCount <= 1) return 30;
  if (testCount <= 3) return 50;
  if (testCount <= 5) return 70;
  if (testCount <= 10) return 85;
  return 95;
}
