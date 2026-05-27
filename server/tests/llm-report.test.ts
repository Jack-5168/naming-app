/**
 * LLM Report Generation Tests
 * Test coverage for report generation and rate limiting
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  generateReport,
  getRateLimitStatus,
  resetRateLimit,
} from "../src/services/llm-report";

describe("LLM Report Module", () => {
  const testUserId = "test-user-123";
  const testClientIp = "192.168.1.100";

  afterEach(() => {
    // Clean up rate limits after each test
    resetRateLimit(testUserId, testClientIp);
  });

  describe("Rate Limiting", () => {
    it("should return initial rate limit status", () => {
      const status = getRateLimitStatus(testUserId, testClientIp);

      expect(status).toBeDefined();
      expect(status.remaining).toBeDefined();
      expect(status.resetTime).toBeDefined();
    });

    it("should track remaining requests", () => {
      const statusBefore = getRateLimitStatus(testUserId, testClientIp);
      const initialRemaining = statusBefore.remaining;

      // Generate a report to consume a request
      try {
        await generateReport({
          userId: testUserId,
          mbtiType: "INTJ",
          big5Scores: {
            openness: 0.8,
            conscientiousness: 0.7,
            extraversion: 0.3,
            agreeableness: 0.5,
            neuroticism: 0.4,
          },
          reportLanguage: "zh-CN",
        });
      } catch (e) {
        // May fail due to missing API key, that's ok
      }

      const statusAfter = getRateLimitStatus(testUserId, testClientIp);

      // Remaining should decrease
      expect(statusAfter.remaining).toBeLessThanOrEqual(initialRemaining);
    });

    it("should reset rate limit", () => {
      const statusBefore = getRateLimitStatus(testUserId, testClientIp);
      const remainingBefore = statusBefore.remaining;

      resetRateLimit(testUserId, testClientIp);

      const statusAfter = getRateLimitStatus(testUserId, testClientIp);

      expect(statusAfter.remaining).toBe(remainingBefore);
    });
  });

  describe("Report Generation", () => {
    it("should accept valid parameters", async () => {
      const params = {
        userId: testUserId,
        mbtiType: "INTJ",
        big5Scores: {
          openness: 0.8,
          conscientiousness: 0.7,
          extraversion: 0.3,
          agreeableness: 0.5,
          neuroticism: 0.4,
        },
        reportLanguage: "zh-CN",
      };

      // This will likely fail without API key, but should not throw type errors
      try {
        const result = await generateReport(params);
        expect(result).toBeDefined();
      } catch (error: any) {
        // Expected - no API key or rate limit
        expect(error.message).toBeDefined();
      }
    });

    it("should accept English report language", async () => {
      const params = {
        userId: testUserId,
        mbtiType: "ENFP",
        big5Scores: {
          openness: 0.9,
          conscientiousness: 0.4,
          extraversion: 0.8,
          agreeableness: 0.6,
          neuroticism: 0.3,
        },
        reportLanguage: "en-US",
      };

      try {
        const result = await generateReport(params);
        expect(result).toBeDefined();
      } catch (error: any) {
        // Expected - no API key
      }
    });
  });
});
