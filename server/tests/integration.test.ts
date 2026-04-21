/**
 * Integration Tests - Phase 2 CAT Engine + Stability Index
 * Tests the complete adaptive testing flow
 */

import { CATEngine } from '../src/services/cat-engine';
import { calculateStability } from '../src/services/stability-calculator';
import { calculateMBTIType, calculateResult } from '../src/services/result-calculator';
import { Answer, TestHistory } from '../src/types';

describe('Phase 2 Integration Tests', () => {
  describe('CAT Engine', () => {
    let catEngine: CATEngine;

    beforeEach(() => {
      catEngine = new CATEngine();
    });

    test('should select next question based on ability estimate', () => {
      const answers: Answer[] = [];
      const question = catEngine.selectNextQuestion(answers);
      
      expect(question).toBeDefined();
      expect(question.id).toMatch(/^q_\d+/);
      expect(['E', 'N', 'T', 'J']).toContain(question.dimension);
      expect(question.options).toHaveLength(5);
    });

    test('should estimate ability from answers', () => {
      const answers: Answer[] = [
        { questionId: 'q1', dimension: 'E', selectedOption: 'e', timestamp: Date.now() },
        { questionId: 'q2', dimension: 'E', selectedOption: 'd', timestamp: Date.now() },
        { questionId: 'q3', dimension: 'N', selectedOption: 'a', timestamp: Date.now() },
      ];

      const ability = catEngine.estimateAbility(answers);
      
      expect(ability).toHaveLength(4);
      expect(ability[0]).toBeGreaterThan(0); // E dimension should be positive
      expect(ability[1]).toBeLessThan(0); // N dimension should be negative
    });

    test('should return initial ability when no answers', () => {
      const ability = catEngine.estimateAbility([]);
      expect(ability).toEqual([0, 0, 0, 0]);
    });

    test('should calculate SEM correctly', () => {
      expect(catEngine.calculateSEM([])).toBe(1.0);
      expect(catEngine.calculateSEM([{ questionId: 'q1', dimension: 'E', selectedOption: 'c', timestamp: Date.now() }])).toBeCloseTo(1.0, 1);
      expect(catEngine.calculateSEM(Array(10).fill({ questionId: 'q', dimension: 'E', selectedOption: 'c', timestamp: Date.now() }))).toBeLessThan(0.5);
    });

    test('should not terminate before minimum questions', () => {
      const answers = Array(5).fill({ questionId: 'q', dimension: 'E', selectedOption: 'c', timestamp: Date.now() });
      expect(catEngine.shouldTerminate(answers)).toBe(false);
    });

    test('should terminate when SEM threshold reached', () => {
      // Create enough answers to reduce SEM below threshold
      const answers = Array(15).fill({ questionId: 'q', dimension: 'E', selectedOption: 'c', timestamp: Date.now() });
      expect(catEngine.shouldTerminate(answers)).toBe(true);
    });

    test('should terminate at maximum questions', () => {
      const answers = Array(20).fill({ questionId: 'q', dimension: 'E', selectedOption: 'c', timestamp: Date.now() });
      expect(catEngine.shouldTerminate(answers)).toBe(true);
    });
  });

  describe('Stability Calculator', () => {
    test('should return new status for first test', async () => {
      const history: TestHistory[] = [];
      const result = await calculateStability('user1', history);
      
      expect(result.stabilityIndex).toBe(0);
      expect(result.status).toBe('new');
      expect(result.stabilityProbability).toBe(0.5);
    });

    test('should calculate high stability for consistent results', async () => {
      const history: TestHistory[] = [
        { testId: 't1', mbtiType: 'INTJ', dimensionScores: { E: 20, N: 70, T: 75, J: 80 }, completedAt: Date.now() - 86400000 },
        { testId: 't2', mbtiType: 'INTJ', dimensionScores: { E: 25, N: 72, T: 73, J: 78 }, completedAt: Date.now() - 43200000 },
        { testId: 't3', mbtiType: 'INTJ', dimensionScores: { E: 22, N: 68, T: 76, J: 82 }, completedAt: Date.now() },
      ];

      const result = await calculateStability('user1', history);
      
      expect(result.stabilityIndex).toBeGreaterThan(70);
      expect(result.status).toBe('stable');
      expect(result.stabilityProbability).toBeGreaterThan(0.9);
    });

    test('should calculate low stability for inconsistent results', async () => {
      const history: TestHistory[] = [
        { testId: 't1', mbtiType: 'INTJ', completedAt: Date.now() - 86400000 },
        { testId: 't2', mbtiType: 'ESFP', completedAt: Date.now() - 43200000 },
        { testId: 't3', mbtiType: 'ISTJ', completedAt: Date.now() },
      ];

      const result = await calculateStability('user1', history);
      
      expect(result.stabilityIndex).toBeLessThan(60);
      expect(['moderate', 'unstable']).toContain(result.status);
    });

    test('should calculate confidence band correctly', async () => {
      const history: TestHistory[] = [
        { testId: 't1', mbtiType: 'INTJ', completedAt: Date.now() - 86400000 },
        { testId: 't2', mbtiType: 'INTJ', completedAt: Date.now() },
      ];

      const result = await calculateStability('user1', history);
      
      expect(result.confidenceBand.lower).toBeLessThanOrEqual(result.stabilityIndex);
      expect(result.confidenceBand.upper).toBeGreaterThanOrEqual(result.stabilityIndex);
      expect(result.confidenceBand.upper - result.confidenceBand.lower).toBeLessThanOrEqual(20);
    });
  });

  describe('Result Calculator', () => {
    test('should calculate MBTI type from ability estimates', () => {
      const ability = [3, 2, -2, 3]; // High E, N, J; Low T
      const result = calculateMBTIType(ability);
      
      expect(result.type).toBe('ENTJ');
      expect(result.dimensions.E.score).toBeGreaterThan(50);
      expect(result.dimensions.N.score).toBeGreaterThan(50);
      expect(result.dimensions.T.score).toBeLessThan(50);
      expect(result.dimensions.J.score).toBeGreaterThan(50);
    });

    test('should handle neutral ability estimates', () => {
      const ability = [0, 0, 0, 0];
      const result = calculateMBTIType(ability);
      
      expect(result.type).toBe('ISFP'); // All scores at 50, defaults to negative pole
      expect(result.dimensions.E.score).toBe(50);
    });

    test('should calculate complete test result', () => {
      const ability = [2, -2, 2, -2];
      const result = calculateResult(ability);
      
      expect(result.mbtiType).toBe('ETFP');
      expect(result.dimensionScores).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.completedAt).toBeGreaterThan(Date.now() - 1000);
    });

    test('should calculate confidence based on score extremity', () => {
      const extremeAbility = [3, 3, 3, 3];
      const neutralAbility = [0, 0, 0, 0];
      
      const extremeResult = calculateMBTIType(extremeAbility);
      const neutralResult = calculateMBTIType(neutralAbility);
      
      expect(extremeResult.confidence).toBeGreaterThan(neutralResult.confidence);
    });
  });

  describe('End-to-End Test Flow', () => {
    test('should complete full adaptive test flow', () => {
      const catEngine = new CATEngine();
      const answers: Answer[] = [];

      // Simulate test session
      for (let i = 0; i < 15; i++) {
        const question = catEngine.selectNextQuestion(answers);
        
        // Simulate answer
        const answer: Answer = {
          questionId: question.id,
          dimension: question.dimension,
          selectedOption: ['a', 'b', 'c', 'd', 'e'][Math.floor(Math.random() * 5)],
          timestamp: Date.now()
        };
        
        answers.push(answer);

        // Check if should terminate
        if (catEngine.shouldTerminate(answers)) {
          break;
        }
      }

      // Calculate final results
      const ability = catEngine.estimateAbility(answers);
      const sem = catEngine.calculateSEM(answers);
      const result = calculateResult(ability);

      // Verify results
      expect(answers.length).toBeGreaterThanOrEqual(10);
      expect(answers.length).toBeLessThanOrEqual(20);
      expect(sem).toBeLessThan(0.5);
      expect(result.mbtiType).toHaveLength(4);
      expect(['E', 'I']).toContain(result.mbtiType[0]);
      expect(['N', 'S']).toContain(result.mbtiType[1]);
      expect(['T', 'F']).toContain(result.mbtiType[2]);
      expect(['J', 'P']).toContain(result.mbtiType[3]);
    });

    test('should integrate stability calculation with test results', async () => {
      const catEngine = new CATEngine();
      const userId = 'test-user';
      
      // Simulate multiple test sessions
      const testHistory: TestHistory[] = [];
      
      for (let session = 0; session < 3; session++) {
        const answers: Answer[] = [];
        
        // Complete a test session
        for (let i = 0; i < 12; i++) {
          const question = catEngine.selectNextQuestion(answers);
          const answer: Answer = {
            questionId: question.id,
            dimension: question.dimension,
            selectedOption: 'c',
            timestamp: Date.now()
          };
          answers.push(answer);
        }
        
        const ability = catEngine.estimateAbility(answers);
        const result = calculateResult(ability);
        
        testHistory.push({
          testId: `test-${session}`,
          mbtiType: result.mbtiType,
          dimensionScores: result.dimensionScores,
          completedAt: Date.now() - (2 - session) * 86400000
        });
      }

      // Calculate stability
      const stability = await calculateStability(userId, testHistory);

      // Verify integration
      expect(testHistory).toHaveLength(3);
      expect(stability.stabilityIndex).toBeGreaterThanOrEqual(0);
      expect(stability.stabilityIndex).toBeLessThanOrEqual(100);
      expect(['stable', 'moderate', 'unstable', 'new']).toContain(stability.status);
    });
  });

  describe('Performance Tests', () => {
    test('CAT question selection should be under 50ms', () => {
      const catEngine = new CATEngine();
      const answers: Answer[] = Array(10).fill({
        questionId: 'q',
        dimension: 'E',
        selectedOption: 'c',
        timestamp: Date.now()
      });

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        catEngine.selectNextQuestion(answers);
      }
      const duration = Date.now() - start;

      expect(duration / 100).toBeLessThan(50);
    });

    test('stability calculation should be under 500ms', async () => {
      const history: TestHistory[] = Array(10).fill({
        testId: 't',
        mbtiType: 'INTJ',
        dimensionScores: { E: 30, N: 70, T: 70, J: 70 },
        completedAt: Date.now()
      });

      const start = Date.now();
      await calculateStability('user1', history);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });
  });
});
