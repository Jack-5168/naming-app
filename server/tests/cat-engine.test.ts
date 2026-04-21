/**
 * CAT Engine Tests
 * Test coverage for 2PL MIRT model, ability estimation, and item selection
 */

import { CATEngine } from '../src/services/cat-engine';
import { Question, Answer, CATConfig, Big5Dimension } from '../src/types';

// 测试题目池 (Big Five)
const mockQuestions: Question[] = [
  // O - 开放性
  {
    id: 'q1',
    dimension: 'O',
    difficulty: 0,
    discrimination: 1.0,
    content: '你喜欢尝试新事物',
    options: [
      { value: 1, text: '非常不同意' },
      { value: 2, text: '不同意' },
      { value: 3, text: '中立' },
      { value: 4, text: '同意' },
      { value: 5, text: '非常同意' }
    ]
  },
  {
    id: 'q2',
    dimension: 'O',
    difficulty: 0.5,
    discrimination: 1.2,
    content: '你对抽象概念感兴趣',
    options: [
      { value: 1, text: '非常不同意' },
      { value: 2, text: '不同意' },
      { value: 3, text: '中立' },
      { value: 4, text: '同意' },
      { value: 5, text: '非常同意' }
    ]
  },
  // C - 尽责性
  {
    id: 'q3',
    dimension: 'C',
    difficulty: 0,
    discrimination: 1.0,
    content: '你做事有条理',
    options: [
      { value: 1, text: '非常不同意' },
      { value: 2, text: '不同意' },
      { value: 3, text: '中立' },
      { value: 4, text: '同意' },
      { value: 5, text: '非常同意' }
    ]
  },
  {
    id: 'q4',
    dimension: 'C',
    difficulty: -0.5,
    discrimination: 0.9,
    content: '你总是按时完成任务',
    options: [
      { value: 1, text: '非常不同意' },
      { value: 2, text: '不同意' },
      { value: 3, text: '中立' },
      { value: 4, text: '同意' },
      { value: 5, text: '非常同意' }
    ]
  },
  // E - 外向性
  {
    id: 'q5',
    dimension: 'E',
    difficulty: 0,
    discrimination: 1.0,
    content: '你在社交场合中感到自在',
    options: [
      { value: 1, text: '非常不同意' },
      { value: 2, text: '不同意' },
      { value: 3, text: '中立' },
      { value: 4, text: '同意' },
      { value: 5, text: '非常同意' }
    ]
  },
  {
    id: 'q6',
    dimension: 'E',
    difficulty: 0.5,
    discrimination: 1.1,
    content: '你喜欢成为关注的焦点',
    options: [
      { value: 1, text: '非常不同意' },
      { value: 2, text: '不同意' },
      { value: 3, text: '中立' },
      { value: 4, text: '同意' },
      { value: 5, text: '非常同意' }
    ]
  },
  // A - 宜人性
  {
    id: 'q7',
    dimension: 'A',
    difficulty: 0,
    discrimination: 1.0,
    content: '你关心他人的感受',
    options: [
      { value: 1, text: '非常不同意' },
      { value: 2, text: '不同意' },
      { value: 3, text: '中立' },
      { value: 4, text: '同意' },
      { value: 5, text: '非常同意' }
    ]
  },
  // N - 神经质
  {
    id: 'q8',
    dimension: 'N',
    difficulty: 0,
    discrimination: 1.0,
    content: '你容易感到焦虑',
    options: [
      { value: 1, text: '非常不同意' },
      { value: 2, text: '不同意' },
      { value: 3, text: '中立' },
      { value: 4, text: '同意' },
      { value: 5, text: '非常同意' }
    ]
  },
  {
    id: 'q9',
    dimension: 'N',
    difficulty: 0.5,
    discrimination: 1.2,
    content: '你经常担心事情',
    options: [
      { value: 1, text: '非常不同意' },
      { value: 2, text: '不同意' },
      { value: 3, text: '中立' },
      { value: 4, text: '同意' },
      { value: 5, text: '非常同意' }
    ]
  }
];

describe('CATEngine', () => {
  let engine: CATEngine;

  beforeEach(() => {
    engine = new CATEngine({}, mockQuestions);
  });

  describe('2PL MIRT Model', () => {
    test('should calculate probability correctly', () => {
      engine.reset();
      
      const mockAnswer: Answer = {
        questionId: 'q1',
        dimension: 'O',
        response: 4,
        timestamp: Date.now()
      };

      const estimate = engine.getAbilityEstimate([mockAnswer]);
      expect(estimate.theta).toBeDefined();
    });

    test('should handle extreme theta values', () => {
      engine.reset();
      
      const extremeAnswers: Answer[] = mockQuestions.slice(0, 5).map(q => ({
        questionId: q.id,
        dimension: q.dimension,
        response: 5,
        timestamp: Date.now()
      }));

      const estimate = engine.getAbilityEstimate(extremeAnswers);
      expect(estimate.theta).toBeGreaterThanOrEqual(-3);
      expect(estimate.theta).toBeLessThanOrEqual(3);
    });
  });

  describe('EAP Ability Estimation', () => {
    test('should return prior mean (0) when no answers', () => {
      engine.reset();
      const theta = engine.estimateAbility([]);
      expect(theta).toBe(0);
    });

    test('should estimate ability based on answers', () => {
      engine.reset();
      
      const answers: Answer[] = [
        { questionId: 'q1', dimension: 'O', response: 5, timestamp: Date.now() },
        { questionId: 'q2', dimension: 'O', response: 5, timestamp: Date.now() }
      ];

      const theta = engine.estimateAbility(answers);
      expect(theta).toBeDefined();
      expect(typeof theta).toBe('number');
    });

    test('should converge with more answers', () => {
      engine.reset();
      
      const answers: Answer[] = [];
      const sems: number[] = [];

      for (let i = 0; i < 6; i++) {
        const q = mockQuestions[i % mockQuestions.length];
        answers.push({
          questionId: q.id,
          dimension: q.dimension,
          response: 3 + (i % 3),
          timestamp: Date.now()
        });
        sems.push(engine.calculateSEM(answers));
      }

      for (let i = 1; i < sems.length; i++) {
        expect(sems[i]).toBeLessThanOrEqual(sems[i - 1] * 1.5);
      }
    });
  });

  describe('Standard Error of Measurement', () => {
    test('should calculate SEM correctly', () => {
      engine.reset();
      
      const answers: Answer[] = [
        { questionId: 'q1', dimension: 'O', response: 4, timestamp: Date.now() }
      ];

      const sem = engine.calculateSEM(answers);
      expect(sem).toBeGreaterThan(0);
      expect(sem).toBeLessThan(2);
    });

    test('SEM should decrease with more answers', () => {
      engine.reset();
      
      const sem1 = engine.calculateSEM([]);
      
      const answers: Answer[] = mockQuestions.slice(0, 5).map(q => ({
        questionId: q.id,
        dimension: q.dimension,
        response: 4,
        timestamp: Date.now()
      }));
      
      const sem2 = engine.calculateSEM(answers);
      
      expect(sem2).toBeLessThan(sem1);
    });
  });

  describe('Item Selection', () => {
    test('should select next question based on maximum information', () => {
      engine.reset();
      
      const nextQuestion = engine.selectNextQuestion([]);
      expect(nextQuestion).not.toBeNull();
      expect(nextQuestion).toHaveProperty('id');
      expect(nextQuestion).toHaveProperty('dimension');
    });

    test('should not reuse questions', () => {
      engine.reset();
      
      const selectedIds = new Set<string>();
      
      for (let i = 0; i < 5; i++) {
        const answers: Answer[] = Array.from(selectedIds).map(id => ({
          questionId: id,
          dimension: 'O' as Big5Dimension,
          response: 4,
          timestamp: Date.now()
        }));
        
        const nextQuestion = engine.selectNextQuestion(answers);
        if (nextQuestion) {
          expect(selectedIds.has(nextQuestion.id)).toBe(false);
          selectedIds.add(nextQuestion.id);
        }
      }
    });

    test('should balance dimensions', () => {
      engine.reset();
      
      const answers: Answer[] = [
        { questionId: 'q1', dimension: 'O', response: 4, timestamp: Date.now() },
        { questionId: 'q2', dimension: 'O', response: 4, timestamp: Date.now() }
      ];

      const nextQuestion = engine.selectNextQuestion(answers);
      
      expect(nextQuestion).not.toBeNull();
      expect(nextQuestion?.dimension).not.toBe('O');
    });

    test('should return null when no questions available', () => {
      engine.reset();
      
      const allAnswers: Answer[] = mockQuestions.map(q => ({
        questionId: q.id,
        dimension: q.dimension,
        response: 4,
        timestamp: Date.now()
      }));

      allAnswers.forEach(() => {
        engine.selectNextQuestion([]);
      });

      const nextQuestion = engine.selectNextQuestion(allAnswers);
      expect(nextQuestion).toBeNull();
    });
  });

  describe('Termination Conditions', () => {
    test('should terminate when max questions reached', () => {
      const config: CATConfig = {
        maxQuestions: 5,
        minQuestions: 3,
        targetSEM: 0.3,
        abilityRange: [-3, 3],
        dimensions: ['O', 'C', 'E', 'A', 'N']
      };
      
      engine = new CATEngine(config, mockQuestions);
      
      const answers: Answer[] = Array(5).fill(null).map((_, i) => ({
        questionId: mockQuestions[i].id,
        dimension: mockQuestions[i].dimension,
        response: 4,
        timestamp: Date.now()
      }));

      expect(engine.shouldTerminate(answers)).toBe(true);
    });

    test('should not terminate before min questions', () => {
      const config: CATConfig = {
        maxQuestions: 20,
        minQuestions: 5,
        targetSEM: 0.3,
        abilityRange: [-3, 3],
        dimensions: ['O', 'C', 'E', 'A', 'N']
      };
      
      engine = new CATEngine(config, mockQuestions);
      
      const answers: Answer[] = Array(3).fill(null).map((_, i) => ({
        questionId: mockQuestions[i].id,
        dimension: mockQuestions[i].dimension,
        response: 4,
        timestamp: Date.now()
      }));

      expect(engine.shouldTerminate(answers)).toBe(false);
    });

    test('should terminate when SEM <= target', () => {
      const config: CATConfig = {
        maxQuestions: 20,
        minQuestions: 3,
        targetSEM: 0.5,
        abilityRange: [-3, 3],
        dimensions: ['O', 'C', 'E', 'A', 'N']
      };
      
      engine = new CATEngine(config, mockQuestions);
      
      const answers: Answer[] = [
        { questionId: 'q1', dimension: 'O', response: 4, timestamp: Date.now() },
        { questionId: 'q3', dimension: 'C', response: 4, timestamp: Date.now() },
        { questionId: 'q5', dimension: 'E', response: 4, timestamp: Date.now() }
      ];

      const sem = engine.calculateSEM(answers);
      expect(engine.shouldTerminate(answers)).toBe(sem <= 0.5);
    });
  });

  describe('Score Conversion', () => {
    test('should convert theta to score correctly', () => {
      expect(engine.thetaToScore(-3)).toBe(0);
      expect(engine.thetaToScore(0)).toBe(50);
      expect(engine.thetaToScore(3)).toBe(100);
    });

    test('should convert score to theta correctly', () => {
      expect(engine.scoreToTheta(0)).toBe(-3);
      expect(engine.scoreToTheta(50)).toBe(0);
      expect(engine.scoreToTheta(100)).toBe(3);
    });

    test('conversions should be inverse operations', () => {
      const thetas = [-2, -1, 0, 1, 2];
      
      for (const theta of thetas) {
        const score = engine.thetaToScore(theta);
        const backToTheta = engine.scoreToTheta(score);
        expect(Math.abs(backToTheta - theta)).toBeLessThan(0.5);
      }
    });
  });

  describe('Confidence Interval', () => {
    test('should calculate confidence interval', () => {
      engine.reset();
      
      const answers: Answer[] = mockQuestions.slice(0, 5).map(q => ({
        questionId: q.id,
        dimension: q.dimension,
        response: 4,
        timestamp: Date.now()
      }));

      const ci = engine.calculateConfidenceInterval(answers);
      expect(ci).toHaveLength(2);
      expect(ci[0]).toBeLessThan(ci[1]);
    });

    test('CI should narrow with more answers', () => {
      engine.reset();
      
      const answers3 = mockQuestions.slice(0, 3).map(q => ({
        questionId: q.id,
        dimension: q.dimension,
        response: 4,
        timestamp: Date.now()
      }));
      
      const answers6 = mockQuestions.slice(0, 6).map(q => ({
        questionId: q.id,
        dimension: q.dimension,
        response: 4,
        timestamp: Date.now()
      }));

      const ci3 = engine.calculateConfidenceInterval(answers3);
      const ci6 = engine.calculateConfidenceInterval(answers6);

      const width3 = ci3[1] - ci3[0];
      const width6 = ci6[1] - ci6[0];

      expect(width6).toBeLessThan(width3);
    });
  });

  describe('Performance', () => {
    test('should select question in <50ms', () => {
      engine.reset();
      
      const answers: Answer[] = mockQuestions.slice(0, 10).map(q => ({
        questionId: q.id,
        dimension: q.dimension,
        response: 4,
        timestamp: Date.now()
      }));

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        engine.selectNextQuestion(answers);
      }
      const elapsed = Date.now() - start;

      expect(elapsed / 100).toBeLessThan(50);
    });

    test('should estimate ability in <10ms', () => {
      engine.reset();
      
      const answers: Answer[] = mockQuestions.slice(0, 10).map(q => ({
        questionId: q.id,
        dimension: q.dimension,
        response: 4,
        timestamp: Date.now()
      }));

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        engine.estimateAbility(answers);
      }
      const elapsed = Date.now() - start;

      expect(elapsed / 100).toBeLessThan(10);
    });
  });

  describe('Ability by Dimension', () => {
    test('should estimate ability per dimension', () => {
      engine.reset();
      
      const answers: Answer[] = [
        { questionId: 'q1', dimension: 'O', response: 5, timestamp: Date.now() },
        { questionId: 'q2', dimension: 'O', response: 5, timestamp: Date.now() },
        { questionId: 'q3', dimension: 'C', response: 2, timestamp: Date.now() },
        { questionId: 'q5', dimension: 'E', response: 4, timestamp: Date.now() }
      ];

      const estimates = engine.estimateAbilityByDimension(answers);
      
      expect(estimates.O).toBeDefined();
      expect(estimates.C).toBeDefined();
      expect(estimates.E).toBeDefined();
      expect(estimates.A).toBeUndefined();
      expect(estimates.N).toBeUndefined();
    });
  });
});
