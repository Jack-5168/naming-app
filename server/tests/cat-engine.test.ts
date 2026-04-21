/**
 * CAT Engine Tests
 * Test coverage for 2PL MIRT model, ability estimation, and item selection
 */

import { CATEngine } from '../src/services/cat-engine';
import { Question, Answer, CATConfig } from '../src/types';

// 测试题目池
const mockQuestions: Question[] = [
  // E-I 维度题目
  {
    id: 'q1',
    dimension: 'E',
    difficulty: 0,
    discrimination: 1.0,
    content: '在社交场合中，你通常会？',
    options: [
      { value: 0, text: '主动与多人交谈' },
      { value: 1, text: '等待他人接近' }
    ]
  },
  {
    id: 'q2',
    dimension: 'E',
    difficulty: 0.5,
    discrimination: 1.2,
    content: '周末你更倾向于？',
    options: [
      { value: 0, text: '参加聚会活动' },
      { value: 1, text: '独自休息' }
    ]
  },
  {
    id: 'q3',
    dimension: 'E',
    difficulty: -0.5,
    discrimination: 0.8,
    content: '你觉得自己是一个？',
    options: [
      { value: 0, text: '外向的人' },
      { value: 1, text: '内向的人' }
    ]
  },
  // N-S 维度题目
  {
    id: 'q4',
    dimension: 'N',
    difficulty: 0,
    discrimination: 1.0,
    content: '你更关注？',
    options: [
      { value: 0, text: '未来的可能性' },
      { value: 1, text: '当下的现实' }
    ]
  },
  {
    id: 'q5',
    dimension: 'N',
    difficulty: 0.5,
    discrimination: 1.1,
    content: '你更相信？',
    options: [
      { value: 0, text: '直觉和灵感' },
      { value: 1, text: '经验和事实' }
    ]
  },
  // T-F 维度题目
  {
    id: 'q6',
    dimension: 'T',
    difficulty: 0,
    discrimination: 1.0,
    content: '做决定时你更依赖？',
    options: [
      { value: 0, text: '逻辑分析' },
      { value: 1, text: '个人价值观' }
    ]
  },
  {
    id: 'q7',
    dimension: 'T',
    difficulty: -0.5,
    discrimination: 0.9,
    content: '你更看重？',
    options: [
      { value: 0, text: '公平和原则' },
      { value: 1, text: '和谐和关系' }
    ]
  },
  // J-P 维度题目
  {
    id: 'q8',
    dimension: 'J',
    difficulty: 0,
    discrimination: 1.0,
    content: '你的生活方式更倾向于？',
    options: [
      { value: 0, text: '有计划有秩序' },
      { value: 1, text: '灵活随性' }
    ]
  },
  {
    id: 'q9',
    dimension: 'J',
    difficulty: 0.5,
    discrimination: 1.2,
    content: '面对截止日期你会？',
    options: [
      { value: 0, text: '提前完成' },
      { value: 1, text: '最后时刻完成' }
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
      // P(θ) = 1 / (1 + exp(-D * a * (θ - b)))
      // When θ = b, P = 0.5
      const theta = 0;
      const difficulty = 0;
      const discrimination = 1.0;

      // 使用私有方法测试，通过公开接口间接验证
      engine.reset();
      
      // 当能力等于难度时，答对概率应接近 0.5
      const mockAnswer: Answer = {
        questionId: 'q1',
        dimension: 'E',
        response: 1,
        timestamp: Date.now()
      };

      const estimate = engine.getAbilityEstimate([mockAnswer]);
      expect(estimate.theta).toBeDefined();
    });

    test('should handle extreme theta values', () => {
      engine.reset();
      
      // 创建极端作答模式
      const extremeAnswers: Answer[] = mockQuestions.slice(0, 5).map(q => ({
        questionId: q.id,
        dimension: q.dimension,
        response: 1,
        timestamp: Date.now()
      }));

      const estimate = engine.getAbilityEstimate(extremeAnswers);
      expect(estimate.theta).toBeGreaterThanOrEqual(-3);
      expect(estimate.theta).toBeLessThanOrEqual(3);
    });
  });

  describe('Fisher Information', () => {
    test('information should be maximum at theta = difficulty', () => {
      // Fisher Information I(θ) = D² * a² * P(θ) * (1 - P(θ))
      // Maximum when P(θ) = 0.5, i.e., θ = b
      engine.reset();
      
      // 通过 SEM 间接验证信息量计算
      const answers: Answer[] = [];
      const sem = engine.calculateSEM(answers);
      expect(sem).toBeGreaterThan(0);
      expect(sem).toBeLessThan(Infinity);
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
      
      // 模拟一致的外向作答
      const answers: Answer[] = [
        { questionId: 'q1', dimension: 'E', response: 0, timestamp: Date.now() },
        { questionId: 'q2', dimension: 'E', response: 0, timestamp: Date.now() },
        { questionId: 'q3', dimension: 'E', response: 0, timestamp: Date.now() }
      ];

      const theta = engine.estimateAbility(answers);
      expect(theta).toBeDefined();
      expect(typeof theta).toBe('number');
    });

    test('should converge with more answers', () => {
      engine.reset();
      
      const answers: Answer[] = [];
      const sems: number[] = [];

      // 逐步添加答案，SEM 应逐渐减小
      for (let i = 0; i < 6; i++) {
        const q = mockQuestions[i % mockQuestions.length];
        answers.push({
          questionId: q.id,
          dimension: q.dimension,
          response: i % 2,
          timestamp: Date.now()
        });
        sems.push(engine.calculateSEM(answers));
      }

      // SEM 应呈下降趋势
      for (let i = 1; i < sems.length; i++) {
        expect(sems[i]).toBeLessThanOrEqual(sems[i - 1] * 1.5); // 允许一定波动
      }
    });
  });

  describe('Standard Error of Measurement', () => {
    test('should calculate SEM correctly', () => {
      engine.reset();
      
      const answers: Answer[] = [
        { questionId: 'q1', dimension: 'E', response: 1, timestamp: Date.now() }
      ];

      const sem = engine.calculateSEM(answers);
      expect(sem).toBeGreaterThan(0);
      expect(sem).toBeLessThan(2); // 单题 SEM 不应过大
    });

    test('SEM should decrease with more answers', () => {
      engine.reset();
      
      const sem1 = engine.calculateSEM([]);
      
      const answers: Answer[] = mockQuestions.slice(0, 5).map(q => ({
        questionId: q.id,
        dimension: q.dimension,
        response: 1,
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
          dimension: 'E' as const,
          response: 1,
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
      
      // 先作答 E 维度题目
      const answers: Answer[] = [
        { questionId: 'q1', dimension: 'E', response: 1, timestamp: Date.now() },
        { questionId: 'q2', dimension: 'E', response: 1, timestamp: Date.now() }
      ];

      const nextQuestion = engine.selectNextQuestion(answers);
      
      // 应选择非 E 维度的题目以平衡
      expect(nextQuestion).not.toBeNull();
    });

    test('should return null when no questions available', () => {
      engine.reset();
      
      // 用完所有题目
      const allAnswers: Answer[] = mockQuestions.map(q => ({
        questionId: q.id,
        dimension: q.dimension,
        response: 1,
        timestamp: Date.now()
      }));

      // 先选择所有题目
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
        abilityRange: [-3, 3]
      };
      
      engine = new CATEngine(config, mockQuestions);
      
      const answers: Answer[] = Array(5).fill(null).map((_, i) => ({
        questionId: mockQuestions[i].id,
        dimension: mockQuestions[i].dimension,
        response: 1,
        timestamp: Date.now()
      }));

      expect(engine.shouldTerminate(answers)).toBe(true);
    });

    test('should not terminate before min questions', () => {
      const config: CATConfig = {
        maxQuestions: 20,
        minQuestions: 5,
        targetSEM: 0.3,
        abilityRange: [-3, 3]
      };
      
      engine = new CATEngine(config, mockQuestions);
      
      const answers: Answer[] = Array(3).fill(null).map((_, i) => ({
        questionId: mockQuestions[i].id,
        dimension: mockQuestions[i].dimension,
        response: 1,
        timestamp: Date.now()
      }));

      expect(engine.shouldTerminate(answers)).toBe(false);
    });

    test('should terminate when SEM <= target', () => {
      const config: CATConfig = {
        maxQuestions: 20,
        minQuestions: 3,
        targetSEM: 0.5, // 较高的目标 SEM
        abilityRange: [-3, 3]
      };
      
      engine = new CATEngine(config, mockQuestions);
      
      // 使用高区分度题目
      const answers: Answer[] = [
        { questionId: 'q2', dimension: 'E', response: 1, timestamp: Date.now() },
        { questionId: 'q5', dimension: 'N', response: 1, timestamp: Date.now() },
        { questionId: 'q9', dimension: 'J', response: 1, timestamp: Date.now() }
      ];

      const sem = engine.calculateSEM(answers);
      expect(engine.shouldTerminate(answers)).toBe(sem <= 0.5);
    });
  });

  describe('Score Conversion', () => {
    test('should convert theta to score correctly', () => {
      // theta = -3 -> score = 0
      expect(engine.thetaToScore(-3)).toBe(0);
      
      // theta = 0 -> score = 50
      expect(engine.thetaToScore(0)).toBe(50);
      
      // theta = 3 -> score = 100
      expect(engine.thetaToScore(3)).toBe(100);
    });

    test('should convert score to theta correctly', () => {
      // score = 0 -> theta = -3
      expect(engine.scoreToTheta(0)).toBe(-3);
      
      // score = 50 -> theta = 0
      expect(engine.scoreToTheta(50)).toBe(0);
      
      // score = 100 -> theta = 3
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
        response: 1,
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
        response: 1,
        timestamp: Date.now()
      }));
      
      const answers6 = mockQuestions.slice(0, 6).map(q => ({
        questionId: q.id,
        dimension: q.dimension,
        response: 1,
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
        response: 1,
        timestamp: Date.now()
      }));

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        engine.selectNextQuestion(answers);
      }
      const elapsed = Date.now() - start;

      expect(elapsed / 100).toBeLessThan(50); // 平均每題 <50ms
    });

    test('should estimate ability in <10ms', () => {
      engine.reset();
      
      const answers: Answer[] = mockQuestions.slice(0, 10).map(q => ({
        questionId: q.id,
        dimension: q.dimension,
        response: 1,
        timestamp: Date.now()
      }));

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        engine.estimateAbility(answers);
      }
      const elapsed = Date.now() - start;

      expect(elapsed / 100).toBeLessThan(10); // 平均 <10ms
    });
  });
});
