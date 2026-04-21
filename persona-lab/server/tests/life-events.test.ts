/**
 * 生活事件模块测试
 */

import {
  createLifeEvent,
  getLifeEvent,
  getUserLifeEvents,
  updateLifeEvent,
  deleteLifeEvent,
  analyzeLifeEvents,
  bulkCreateLifeEvents,
  exportLifeEvents,
  lifeEventEvents,
  EVENT_TYPES,
  IMPACT_TYPES,
  DIMENSIONS
} from '../src/controllers/life-events';

describe('Life Events Controller', () => {
  const testUserId = 1001;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('常量定义', () => {
    it('应该定义所有事件类型', () => {
      expect(EVENT_TYPES.CAREER).toBe('career');
      expect(EVENT_TYPES.RELATIONSHIP).toBe('relationship');
      expect(EVENT_TYPES.HEALTH).toBe('health');
      expect(EVENT_TYPES.EDUCATION).toBe('education');
      expect(EVENT_TYPES.FINANCIAL).toBe('financial');
      expect(EVENT_TYPES.PERSONAL).toBe('personal');
      expect(EVENT_TYPES.FAMILY).toBe('family');
      expect(EVENT_TYPES.TRAVEL).toBe('travel');
      expect(EVENT_TYPES.OTHER).toBe('other');
    });

    it('应该定义所有影响类型', () => {
      expect(IMPACT_TYPES.POSITIVE).toBe('positive');
      expect(IMPACT_TYPES.NEGATIVE).toBe('negative');
      expect(IMPACT_TYPES.NEUTRAL).toBe('neutral');
    });

    it('应该定义所有人格维度', () => {
      expect(DIMENSIONS.E).toBe('Extraversion');
      expect(DIMENSIONS.I).toBe('Introversion');
      expect(DIMENSIONS.N).toBe('Intuition');
      expect(DIMENSIONS.S).toBe('Sensing');
      expect(DIMENSIONS.T).toBe('Thinking');
      expect(DIMENSIONS.F).toBe('Feeling');
      expect(DIMENSIONS.J).toBe('Judging');
      expect(DIMENSIONS.P).toBe('Perceiving');
    });
  });

  describe('创建生活事件', () => {
    it('应该成功创建事件', async () => {
      const event = await createLifeEvent({
        userId: testUserId,
        eventType: 'career',
        title: '升职加薪',
        description: '从初级工程师晋升为高级工程师',
        eventDate: new Date().toISOString(),
        expectedImpact: 'positive',
        actualImpactScore: 80
      });

      expect(event.id).toBeDefined();
      expect(event.userId).toBe(testUserId);
      expect(event.eventType).toBe('career');
      expect(event.title).toBe('升职加薪');
      expect(event.expectedImpact).toBe('positive');
      expect(event.actualImpactScore).toBe(80);
      expect(event.correlationAnalyzed).toBe(false);
    });

    it('创建事件应该触发事件', (done) => {
      lifeEventEvents.once('eventCreated', (data) => {
        expect(data.event).toBeDefined();
        expect(data.event.title).toBe('测试事件');
        done();
      });

      createLifeEvent({
        userId: testUserId,
        eventType: 'personal',
        title: '测试事件',
        eventDate: new Date()
      });
    });

    it('应该支持可选字段', async () => {
      const event = await createLifeEvent({
        userId: testUserId,
        eventType: 'education',
        title: '完成学位',
        eventDate: new Date(),
        eventCategory: 'academic',
        relatedDimension: 'N'
      });

      expect(event.eventCategory).toBe('academic');
      expect(event.relatedDimension).toBe('N');
    });
  });

  describe('获取生活事件', () => {
    it('应该获取单个事件', async () => {
      const created = await createLifeEvent({
        userId: testUserId,
        eventType: 'health',
        title: '开始健身',
        eventDate: new Date()
      });

      const event = await getLifeEvent(created.id);
      
      expect(event).toBeDefined();
      expect(event?.id).toBe(created.id);
      expect(event?.title).toBe('开始健身');
    });

    it('不存在的事件应该返回 null', async () => {
      const event = await getLifeEvent(99999);
      expect(event).toBeNull();
    });

    it('应该获取用户的事件列表', async () => {
      // 创建多个事件
      await createLifeEvent({
        userId: testUserId,
        eventType: 'career',
        title: '事件 1',
        eventDate: new Date()
      });

      await createLifeEvent({
        userId: testUserId,
        eventType: 'relationship',
        title: '事件 2',
        eventDate: new Date()
      });

      const events = await getUserLifeEvents(testUserId);
      
      expect(events.length).toBeGreaterThanOrEqual(2);
    });

    it('应该支持日期范围过滤', async () => {
      const pastDate = new Date('2020-01-01');
      
      await createLifeEvent({
        userId: testUserId,
        eventType: 'travel',
        title: '过去的事件',
        eventDate: pastDate
      });

      const events = await getUserLifeEvents(testUserId, {
        startDate: new Date('2023-01-01')
      });

      const pastEvents = events.filter(e => e.title === '过去的事件');
      expect(pastEvents.length).toBe(0);
    });

    it('应该支持事件类型过滤', async () => {
      await createLifeEvent({
        userId: testUserId,
        eventType: 'financial',
        title: '财务事件',
        eventDate: new Date()
      });

      const events = await getUserLifeEvents(testUserId, {
        eventType: 'financial'
      });

      expect(events.every(e => e.eventType === 'financial')).toBe(true);
    });

    it('应该支持分页', async () => {
      const events = await getUserLifeEvents(testUserId, {
        limit: 5,
        offset: 0
      });

      expect(events.length).toBeLessThanOrEqual(5);
    });
  });

  describe('更新生活事件', () => {
    it('应该更新事件', async () => {
      const created = await createLifeEvent({
        userId: testUserId,
        eventType: 'personal',
        title: '原始标题',
        eventDate: new Date()
      });

      const updated = await updateLifeEvent(created.id, {
        title: '更新后的标题',
        actualImpactScore: 75
      });

      expect(updated?.title).toBe('更新后的标题');
      expect(updated?.actualImpactScore).toBe(75);
    });

    it('更新不存在的事件应该返回 null', async () => {
      const updated = await updateLifeEvent(99999, {
        title: '新标题'
      });

      expect(updated).toBeNull();
    });

    it('更新事件应该触发事件', (done) => {
      createLifeEvent({
        userId: testUserId,
        eventType: 'personal',
        title: '待更新',
        eventDate: new Date()
      }).then(async (created) => {
        lifeEventEvents.once('eventUpdated', (data) => {
          expect(data.event).toBeDefined();
          done();
        });

        await updateLifeEvent(created.id, {
          title: '已更新'
        });
      });
    });
  });

  describe('删除生活事件', () => {
    it('应该删除事件', async () => {
      const created = await createLifeEvent({
        userId: testUserId,
        eventType: 'other',
        title: '待删除',
        eventDate: new Date()
      });

      const deleted = await deleteLifeEvent(created.id);
      expect(deleted).toBe(true);

      const event = await getLifeEvent(created.id);
      expect(event).toBeNull();
    });

    it('删除不存在的事件应该返回 false', async () => {
      const deleted = await deleteLifeEvent(99999);
      expect(deleted).toBe(false);
    });
  });

  describe('分析生活事件', () => {
    it('应该生成分析报告', async () => {
      // 创建一些测试事件
      await createLifeEvent({
        userId: testUserId,
        eventType: 'career',
        title: '职业发展',
        eventDate: new Date(),
        expectedImpact: 'positive',
        actualImpactScore: 80
      });

      await createLifeEvent({
        userId: testUserId,
        eventType: 'relationship',
        title: '人际关系',
        eventDate: new Date(),
        expectedImpact: 'positive',
        actualImpactScore: 70,
        relatedDimension: 'E'
      });

      const analysis = await analyzeLifeEvents(testUserId);

      expect(analysis.totalEvents).toBeGreaterThanOrEqual(2);
      expect(analysis.eventsByType).toBeDefined();
      expect(analysis.eventsByImpact).toBeDefined();
      expect(analysis.keyInsights).toBeDefined();
      expect(Array.isArray(analysis.keyInsights)).toBe(true);
    });

    it('分析应该包含维度相关性', async () => {
      await createLifeEvent({
        userId: testUserId,
        eventType: 'personal',
        title: '维度相关事件',
        eventDate: new Date(),
        relatedDimension: 'T'
      });

      const analysis = await analyzeLifeEvents(testUserId);

      expect(analysis.dimensionCorrelations).toBeDefined();
      expect(Array.isArray(analysis.dimensionCorrelations)).toBe(true);
    });

    it('空用户应该返回空分析', async () => {
      const analysis = await analyzeLifeEvents(99999);

      expect(analysis.totalEvents).toBe(0);
      expect(analysis.eventsByType).toEqual({});
      expect(analysis.keyInsights).toEqual([]);
    });
  });

  describe('批量操作', () => {
    it('应该批量创建事件', async () => {
      const events = await bulkCreateLifeEvents([
        {
          userId: testUserId,
          eventType: 'career',
          title: '批量事件 1',
          eventDate: new Date()
        },
        {
          userId: testUserId,
          eventType: 'education',
          title: '批量事件 2',
          eventDate: new Date()
        }
      ]);

      expect(events.length).toBe(2);
      expect(events[0].title).toBe('批量事件 1');
      expect(events[1].title).toBe('批量事件 2');
    });

    it('应该导出用户事件', async () => {
      const events = await exportLifeEvents(testUserId);
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('非因果声明', () => {
    it('分析应该包含非因果声明', async () => {
      await createLifeEvent({
        userId: testUserId,
        eventType: 'personal',
        title: '测试',
        eventDate: new Date(),
        relatedDimension: 'J'
      });

      const analysis = await analyzeLifeEvents(testUserId);
      
      // 检查洞察中是否包含非因果声明
      const hasDisclaimer = analysis.keyInsights.some(insight => 
        insight.includes('非因果') || insight.includes('探索性') || insight.includes('仅供参考')
      );
      
      // 至少应该有相关说明
      expect(analysis.dimensionCorrelations.some(c => 
        c.note.includes('探索性') || c.note.includes('仅供参考')
      )).toBe(true);
    });
  });
});
