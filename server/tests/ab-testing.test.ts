/**
 * A/B Testing Framework Tests
 * Test coverage for traffic allocation, event tracking, and statistical analysis
 */

import { ABTestingManager, createPresetExperiments } from '../src/services/ab-testing';
import { ABTestConfig, ABTestMetric } from '../src/types';

describe('ABTestingManager', () => {
  let manager: ABTestingManager;

  beforeEach(() => {
    manager = new ABTestingManager();
  });

  describe('Experiment Management', () => {
    test('should create experiment', () => {
      const config: ABTestConfig = {
        experimentId: 'test-exp',
        name: 'Test Experiment',
        description: 'A test experiment',
        trafficSplit: 0.5,
        startDate: Date.now(),
        status: 'draft',
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            description: 'Control group',
            config: {}
          },
          {
            variantId: 'treatment',
            name: 'Treatment',
            description: 'Treatment group',
            config: {}
          }
        ],
        metrics: [
          { metricId: 'conversion', name: 'Conversion Rate', type: 'conversion' }
        ]
      };

      const created = manager.createExperiment(config);
      
      expect(created).toEqual(config);
      expect(manager.getExperiment('test-exp')).toEqual(config);
    });

    test('should throw error for duplicate experiment', () => {
      const config: ABTestConfig = {
        experimentId: 'test-exp',
        name: 'Test',
        description: 'Test',
        trafficSplit: 0.5,
        startDate: Date.now(),
        status: 'draft',
        variants: [{ variantId: 'v1', name: 'V1', description: 'V1', config: {} }],
        metrics: []
      };

      manager.createExperiment(config);
      
      expect(() => manager.createExperiment(config)).toThrow('already exists');
    });

    test('should update experiment', () => {
      const config: ABTestConfig = {
        experimentId: 'test-exp',
        name: 'Test',
        description: 'Test',
        trafficSplit: 0.5,
        startDate: Date.now(),
        status: 'draft',
        variants: [{ variantId: 'v1', name: 'V1', description: 'V1', config: {} }],
        metrics: []
      };

      manager.createExperiment(config);
      
      const updated = manager.updateExperiment('test-exp', {
        status: 'running',
        name: 'Updated Test'
      });

      expect(updated?.status).toBe('running');
      expect(updated?.name).toBe('Updated Test');
    });

    test('should return null for non-existent experiment', () => {
      const result = manager.getExperiment('non-existent');
      expect(result).toBeNull();
    });

    test('should get running experiments', () => {
      const exp1: ABTestConfig = {
        experimentId: 'exp1',
        name: 'Exp 1',
        description: 'Exp 1',
        trafficSplit: 0.5,
        startDate: Date.now(),
        status: 'running',
        variants: [{ variantId: 'v1', name: 'V1', description: 'V1', config: {} }],
        metrics: []
      };

      const exp2: ABTestConfig = {
        experimentId: 'exp2',
        name: 'Exp 2',
        description: 'Exp 2',
        trafficSplit: 0.5,
        startDate: Date.now(),
        status: 'draft',
        variants: [{ variantId: 'v1', name: 'V1', description: 'V1', config: {} }],
        metrics: []
      };

      manager.createExperiment(exp1);
      manager.createExperiment(exp2);

      const running = manager.getRunningExperiments();
      expect(running).toHaveLength(1);
      expect(running[0].experimentId).toBe('exp1');
    });
  });

  describe('Traffic Allocation', () => {
    test('should assign variant to user', () => {
      const config: ABTestConfig = {
        experimentId: 'test-exp',
        name: 'Test',
        description: 'Test',
        trafficSplit: 0.5,
        startDate: Date.now() - 1000, // 已开始
        status: 'running',
        variants: [
          { variantId: 'control', name: 'Control', description: 'Control', config: { trafficSplit: 0.5 } },
          { variantId: 'treatment', name: 'Treatment', description: 'Treatment', config: { trafficSplit: 0.5 } }
        ],
        metrics: []
      };

      manager.createExperiment(config);
      
      const variant = manager.assignVariant('test-exp', 'user-123');
      expect(['control', 'treatment']).toContain(variant);
    });

    test('should consistently assign same variant to same user', () => {
      const config: ABTestConfig = {
        experimentId: 'test-exp',
        name: 'Test',
        description: 'Test',
        trafficSplit: 0.5,
        startDate: Date.now() - 1000,
        status: 'running',
        variants: [
          { variantId: 'control', name: 'Control', description: 'Control', config: { trafficSplit: 0.5 } },
          { variantId: 'treatment', name: 'Treatment', description: 'Treatment', config: { trafficSplit: 0.5 } }
        ],
        metrics: []
      };

      manager.createExperiment(config);
      
      const variant1 = manager.assignVariant('test-exp', 'user-123');
      const variant2 = manager.assignVariant('test-exp', 'user-123');
      
      expect(variant1).toBe(variant2);
    });

    test('should assign different variants to different users', () => {
      const config: ABTestConfig = {
        experimentId: 'test-exp',
        name: 'Test',
        description: 'Test',
        trafficSplit: 0.5,
        startDate: Date.now() - 1000,
        status: 'running',
        variants: [
          { variantId: 'control', name: 'Control', description: 'Control', config: { trafficSplit: 0.5 } },
          { variantId: 'treatment', name: 'Treatment', description: 'Treatment', config: { trafficSplit: 0.5 } }
        ],
        metrics: []
      };

      manager.createExperiment(config);
      
      const assignments = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const variant = manager.assignVariant('test-exp', `user-${i}`);
        if (variant) assignments.add(variant);
      }

      // 应该分配到两个变体
      expect(assignments.size).toBeGreaterThan(1);
    });

    test('should return null for unstarted experiment', () => {
      const config: ABTestConfig = {
        experimentId: 'test-exp',
        name: 'Test',
        description: 'Test',
        trafficSplit: 0.5,
        startDate: Date.now() + 86400000, // 明天开始
        status: 'draft',
        variants: [{ variantId: 'v1', name: 'V1', description: 'V1', config: {} }],
        metrics: []
      };

      manager.createExperiment(config);
      
      const variant = manager.assignVariant('test-exp', 'user-123');
      expect(variant).toBeNull();
    });

    test('should return null for ended experiment', () => {
      const config: ABTestConfig = {
        experimentId: 'test-exp',
        name: 'Test',
        description: 'Test',
        trafficSplit: 0.5,
        startDate: Date.now() - 172800000,
        endDate: Date.now() - 86400000, // 昨天结束
        status: 'completed',
        variants: [{ variantId: 'v1', name: 'V1', description: 'V1', config: {} }],
        metrics: []
      };

      manager.createExperiment(config);
      
      const variant = manager.assignVariant('test-exp', 'user-123');
      expect(variant).toBeNull();
    });

    test('should return null for non-existent experiment', () => {
      const variant = manager.assignVariant('non-existent', 'user-123');
      expect(variant).toBeNull();
    });
  });

  describe('Event Tracking', () => {
    test('should record event', () => {
      const config: ABTestConfig = {
        experimentId: 'test-exp',
        name: 'Test',
        description: 'Test',
        trafficSplit: 0.5,
        startDate: Date.now() - 1000,
        status: 'running',
        variants: [
          { variantId: 'control', name: 'Control', description: 'Control', config: { trafficSplit: 0.5 } },
          { variantId: 'treatment', name: 'Treatment', description: 'Treatment', config: { trafficSplit: 0.5 } }
        ],
        metrics: [{ metricId: 'conversion', name: 'Conversion', type: 'conversion' }]
      };

      manager.createExperiment(config);
      manager.assignVariant('test-exp', 'user-123');
      
      manager.recordEvent('test-exp', 'user-123', 'control', 'conversion', 1);
      
      // 不应抛出错误
      expect(() => manager.recordEvent('test-exp', 'user-123', 'control', 'conversion', 1)).not.toThrow();
    });

    test('should get user exposure', () => {
      const config: ABTestConfig = {
        experimentId: 'test-exp',
        name: 'Test',
        description: 'Test',
        trafficSplit: 0.5,
        startDate: Date.now() - 1000,
        status: 'running',
        variants: [
          { variantId: 'control', name: 'Control', description: 'Control', config: { trafficSplit: 0.5 } }
        ],
        metrics: []
      };

      manager.createExperiment(config);
      manager.assignVariant('test-exp', 'user-123');
      
      const exposure = manager.getUserExposure('test-exp', 'user-123');
      
      expect(exposure).not.toBeNull();
      expect(exposure?.userId).toBe('user-123');
      expect(exposure?.experimentId).toBe('test-exp');
    });
  });

  describe('Statistical Analysis', () => {
    test('should analyze results', () => {
      const config: ABTestConfig = {
        experimentId: 'test-exp',
        name: 'Test',
        description: 'Test',
        trafficSplit: 0.5,
        startDate: Date.now() - 1000,
        status: 'running',
        variants: [
          { variantId: 'control', name: 'Control', description: 'Control', config: { trafficSplit: 0.5 } },
          { variantId: 'treatment', name: 'Treatment', description: 'Treatment', config: { trafficSplit: 0.5 } }
        ],
        metrics: [{ metricId: 'conversion', name: 'Conversion', type: 'conversion' }]
      };

      manager.createExperiment(config);

      // 模拟用户分配和事件
      for (let i = 0; i < 50; i++) {
        const variant = manager.assignVariant('test-exp', `user-${i}`);
        if (variant) {
          // 对照组转化率 30%，实验组 50%
          const conversionRate = variant === 'control' ? 0.3 : 0.5;
          const converted = Math.random() < conversionRate ? 1 : 0;
          manager.recordEvent('test-exp', `user-${i}`, variant, 'conversion', converted);
        }
      }

      const results = manager.analyzeResults('test-exp');
      
      expect(results).not.toBeNull();
      expect(results?.experimentId).toBe('test-exp');
      expect(results?.variantResults).toHaveLength(2);
    });

    test('should return null for non-existent experiment', () => {
      const results = manager.analyzeResults('non-existent');
      expect(results).toBeNull();
    });

    test('should calculate statistical significance', () => {
      const config: ABTestConfig = {
        experimentId: 'test-exp',
        name: 'Test',
        description: 'Test',
        trafficSplit: 0.5,
        startDate: Date.now() - 1000,
        status: 'running',
        variants: [
          { variantId: 'control', name: 'Control', description: 'Control', config: { trafficSplit: 0.5 } },
          { variantId: 'treatment', name: 'Treatment', description: 'Treatment', config: { trafficSplit: 0.5 } }
        ],
        metrics: [{ metricId: 'score', name: 'Score', type: 'continuous' }]
      };

      manager.createExperiment(config);

      // 模拟有明显差异的数据
      for (let i = 0; i < 100; i++) {
        const variant = manager.assignVariant('test-exp', `user-${i}`);
        if (variant) {
          // 对照组均值 50，实验组均值 70
          const mean = variant === 'control' ? 50 : 70;
          const score = mean + (Math.random() - 0.5) * 20;
          manager.recordEvent('test-exp', `user-${i}`, variant, 'score', score);
        }
      }

      const results = manager.analyzeResults('test-exp');
      
      expect(results).not.toBeNull();
      expect(results?.statisticalSignificance).toBeDefined();
    });
  });

  describe('Data Export', () => {
    test('should export experiment data', () => {
      const config: ABTestConfig = {
        experimentId: 'test-exp',
        name: 'Test',
        description: 'Test',
        trafficSplit: 0.5,
        startDate: Date.now() - 1000,
        status: 'running',
        variants: [{ variantId: 'v1', name: 'V1', description: 'V1', config: {} }],
        metrics: []
      };

      manager.createExperiment(config);
      manager.assignVariant('test-exp', 'user-123');
      
      const data = manager.exportData('test-exp');
      
      expect(data.config).toEqual(config);
      expect(data.exposures).toHaveLength(1);
      expect(data.events).toHaveLength(0);
    });

    test('should return null config for non-existent experiment', () => {
      const data = manager.exportData('non-existent');
      expect(data.config).toBeNull();
    });
  });

  describe('Experiment Cleanup', () => {
    test('should clear experiment', () => {
      const config: ABTestConfig = {
        experimentId: 'test-exp',
        name: 'Test',
        description: 'Test',
        trafficSplit: 0.5,
        startDate: Date.now() - 1000,
        status: 'running',
        variants: [{ variantId: 'v1', name: 'V1', description: 'V1', config: {} }],
        metrics: []
      };

      manager.createExperiment(config);
      
      const result = manager.clearExperiment('test-exp');
      expect(result).toBe(true);
      expect(manager.getExperiment('test-exp')).toBeNull();
    });

    test('should return false for non-existent experiment', () => {
      const result = manager.clearExperiment('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Preset Experiments', () => {
    test('should create preset experiments', () => {
      const presets = createPresetExperiments();
      
      expect(presets).toHaveLength(3);
      expect(presets.map(p => p.experimentId)).toEqual([
        'cat-vs-classic',
        'spectrum-vs-type',
        'paywall-position'
      ]);
    });

    test('presets should have correct metrics', () => {
      const presets = createPresetExperiments();
      
      const catExp = presets.find(p => p.experimentId === 'cat-vs-classic');
      expect(catExp?.metrics).toHaveLength(3);
      expect(catExp?.metrics.map(m => m.metricId)).toEqual([
        'completion_rate',
        'completion_time',
        'satisfaction_score'
      ]);
    });
  });

  describe('Performance', () => {
    test('should assign variant quickly', () => {
      const config: ABTestConfig = {
        experimentId: 'test-exp',
        name: 'Test',
        description: 'Test',
        trafficSplit: 0.5,
        startDate: Date.now() - 1000,
        status: 'running',
        variants: [
          { variantId: 'control', name: 'Control', description: 'Control', config: { trafficSplit: 0.5 } },
          { variantId: 'treatment', name: 'Treatment', description: 'Treatment', config: { trafficSplit: 0.5 } }
        ],
        metrics: []
      };

      manager.createExperiment(config);
      
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        manager.assignVariant('test-exp', `user-${i}`);
      }
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100); // 1000 次分配 <100ms
    });
  });
});
