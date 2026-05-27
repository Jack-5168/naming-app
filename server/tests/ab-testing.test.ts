/**
 * A/B Testing Tests
 * Test coverage for traffic allocation and variant assignment
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  getABTestResults,
  initializeABTest,
  assignUserToVariant,
} from '../src/services/ab-testing';

describe('A/B Testing Module', () => {
  describe('Experiment Initialization', () => {
    it('should initialize experiment without error', () => {
      expect(() => initializeABTest('test-exp')).not.toThrow();
    });
  });

  describe('Variant Assignment', () => {
    it('should assign user to a variant', () => {
      const variants = [
        { variantId: 'control', name: 'Control', description: '', allocation: 50, config: {} },
        { variantId: 'treatment', name: 'Treatment', description: '', allocation: 50, config: {} },
      ];

      const assigned = assignUserToVariant('user-123', variants);
      expect(assigned).toBeDefined();
      expect(variants.map(v => v.variantId)).toContain(assigned);
    });

    it('should assign same user to same variant consistently', () => {
      const variants = [
        { variantId: 'control', name: 'Control', description: '', allocation: 50, config: {} },
        { variantId: 'treatment', name: 'Treatment', description: '', allocation: 50, config: {} },
      ];

      const assigned1 = assignUserToVariant('user-consistent', variants);
      const assigned2 = assignUserToVariant('user-consistent', variants);

      expect(assigned1).toBe(assigned2);
    });

    it('should distribute users approximately evenly', () => {
      const variants = [
        { variantId: 'control', name: 'Control', description: '', allocation: 50, config: {} },
        { variantId: 'treatment', name: 'Treatment', description: '', allocation: 50, config: {} },
      ];

      const results = { control: 0, treatment: 0 };
      const totalUsers = 1000;

      for (let i = 0; i < totalUsers; i++) {
        const assigned = assignUserToVariant(`user-${i}`, variants);
        results[assigned as keyof typeof results]++;
      }

      // Allow 40% deviation
      const ratio = results.control / results.treatment;
      expect(ratio).toBeGreaterThan(0.6);
      expect(ratio).toBeLessThan(1.67);
    });
  });

  describe('Results Retrieval', () => {
    it('should return results structure', async () => {
      const results = await getABTestResults('test-exp');

      expect(results).toBeDefined();
      expect(results.success).toBeDefined();
      expect(results.metrics).toBeDefined();
    });
  });
});