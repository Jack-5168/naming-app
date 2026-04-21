/**
 * LLM 报告生成服务测试
 */

import {
  generateReport,
  getRateLimitStatus,
  resetRateLimit,
  reportEvents,
  BASIC_REPORT_TEMPLATE,
  PRO_REPORT_TEMPLATE,
  MASTER_REPORT_TEMPLATE
} from '../src/services/llm-report';

describe('LLM Report Service', () => {
  beforeEach(() => {
    resetRateLimit();
    jest.clearAllMocks();
  });

  describe('模板常量', () => {
    it('基础报告模板应该包含必要章节', () => {
      expect(BASIC_REPORT_TEMPLATE).toContain('核心特质解读');
      expect(BASIC_REPORT_TEMPLATE).toContain('优势与潜力');
      expect(BASIC_REPORT_TEMPLATE).toContain('成长建议');
      expect(BASIC_REPORT_TEMPLATE).toContain('免责声明');
    });

    it('专业报告模板应该包含生活事件部分', () => {
      expect(PRO_REPORT_TEMPLATE).toContain('生活事件');
      expect(PRO_REPORT_TEMPLATE).toContain('生活事件影响分析');
    });

    it('大师报告模板应该更详细', () => {
      expect(MASTER_REPORT_TEMPLATE.length).toBeGreaterThan(PRO_REPORT_TEMPLATE.length);
      expect(MASTER_REPORT_TEMPLATE).toContain('人格本质洞察');
      expect(MASTER_REPORT_TEMPLATE).toContain('生命历程解读');
    });
  });

  describe('限流控制', () => {
    it('应该允许首次请求', () => {
      const status = getRateLimitStatus('user-1', '192.168.1.1');
      expect(status.userRemaining).toBe(3);
      expect(status.ipRemaining).toBe(50);
    });

    it('用户达到限流后应该阻止', async () => {
      const userId = 'user-limit-test';
      const clientIp = '192.168.1.100';

      // 模拟 3 次请求
      for (let i = 0; i < 3; i++) {
        try {
          await generateReport({
            userId,
            clientIp,
            resultId: 1,
            reportType: 'basic',
            includeSections: []
          });
        } catch (error) {
          // 忽略错误
        }
      }

      const status = getRateLimitStatus(userId, clientIp);
      expect(status.userRemaining).toBe(0);
    });

    it('IP 达到限流后应该阻止', async () => {
      const clientIp = '192.168.1.200';

      // 模拟多个用户从同一 IP 请求
      for (let i = 0; i < 50; i++) {
        try {
          await generateReport({
            userId: `user-${i}`,
            clientIp,
            resultId: i,
            reportType: 'basic',
            includeSections: []
          });
        } catch (error) {
          // 忽略错误
        }
      }

      const status = getRateLimitStatus('new-user', clientIp);
      expect(status.ipRemaining).toBe(0);
    });

    it('重置限流后应该恢复额度', () => {
      const userId = 'user-reset-test';
      
      // 先消耗一些额度
      getRateLimitStatus(userId, '192.168.1.1');
      
      // 重置
      resetRateLimit(userId);
      
      const status = getRateLimitStatus(userId, '192.168.1.1');
      expect(status.userRemaining).toBe(3);
    });
  });

  describe('报告生成', () => {
    it('应该生成基础报告', async () => {
      const result = await generateReport({
        userId: 'test-user-1',
        clientIp: '192.168.1.1',
        resultId: 1,
        reportType: 'basic',
        includeSections: []
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.tokens).toBeGreaterThan(0);
      expect(result.generationTime).toBeGreaterThan(0);
      expect(result.requestId).toBeDefined();
      expect(result.cost).toBeGreaterThanOrEqual(0);
    });

    it('应该生成专业报告', async () => {
      const result = await generateReport({
        userId: 'test-user-2',
        clientIp: '192.168.1.2',
        resultId: 2,
        reportType: 'pro',
        includeSections: []
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('应该生成大师报告', async () => {
      const result = await generateReport({
        userId: 'test-user-3',
        clientIp: '192.168.1.3',
        resultId: 3,
        reportType: 'master',
        includeSections: []
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('应该包含免责声明', async () => {
      const result = await generateReport({
        userId: 'test-user-4',
        clientIp: '192.168.1.4',
        resultId: 4,
        reportType: 'basic',
        includeSections: []
      });

      expect(result.content).toContain('免责声明');
    });
  });

  describe('事件发射', () => {
    it('应该在报告开始时触发事件', (done) => {
      reportEvents.once('reportStarted', (data) => {
        expect(data.requestId).toBeDefined();
        expect(data.params).toBeDefined();
        done();
      });

      generateReport({
        userId: 'test-user-5',
        clientIp: '192.168.1.5',
        resultId: 5,
        reportType: 'basic',
        includeSections: []
      });
    });

    it('应该在报告完成时触发事件', (done) => {
      reportEvents.once('reportCompleted', (data) => {
        expect(data.requestId).toBeDefined();
        expect(data.result).toBeDefined();
        expect(data.result.content).toBeDefined();
        done();
      });

      generateReport({
        userId: 'test-user-6',
        clientIp: '192.168.1.6',
        resultId: 6,
        reportType: 'basic',
        includeSections: []
      });
    });
  });

  describe('质量验证', () => {
    it('报告应该有合理的内容长度', async () => {
      const result = await generateReport({
        userId: 'test-user-7',
        clientIp: '192.168.1.7',
        resultId: 7,
        reportType: 'basic',
        includeSections: []
      });

      // 基础报告应该至少有内容
      expect(result.content.length).toBeGreaterThan(100);
    });
  });

  describe('成本计算', () => {
    it('报告成本应该小于 0.5 元人民币', async () => {
      const result = await generateReport({
        userId: 'test-user-8',
        clientIp: '192.168.1.8',
        resultId: 8,
        reportType: 'basic',
        includeSections: []
      });

      expect(result.cost).toBeLessThan(0.5);
    });
  });

  describe('性能要求', () => {
    it('报告生成时间应该小于 15 秒', async () => {
      const result = await generateReport({
        userId: 'test-user-9',
        clientIp: '192.168.1.9',
        resultId: 9,
        reportType: 'basic',
        includeSections: []
      });

      expect(result.generationTime).toBeLessThan(15000);
    });
  });
});
