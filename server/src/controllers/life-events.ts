/**
 * 生活事件模块
 * 负责生活事件的录入、查询和关联分析
 */

import { EventEmitter } from 'events';

export interface LifeEvent {
  id: number;
  userId: number;
  resultId?: number;
  eventType: string;        // career/relationship/health/etc
  eventCategory?: string;
  title: string;
  description?: string;
  eventDate: Date;
  expectedImpact?: string;  // positive/negative/neutral
  actualImpactScore?: number;  // -100 to 100
  relatedDimension?: string;   // E/N/T/J
  correlationAnalyzed: boolean;
  correlationNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLifeEventParams {
  userId: number;
  resultId?: number;
  eventType: string;
  eventCategory?: string;
  title: string;
  description?: string;
  eventDate: string | Date;
  expectedImpact?: string;
  actualImpactScore?: number;
  relatedDimension?: string;
}

export interface UpdateLifeEventParams {
  title?: string;
  description?: string;
  expectedImpact?: string;
  actualImpactScore?: number;
  relatedDimension?: string;
}

export interface LifeEventAnalysis {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByImpact: {
    positive: number;
    negative: number;
    neutral: number;
  };
  impactTrend: Array<{
    period: string;
    averageScore: number;
    eventCount: number;
  }>;
  dimensionCorrelations: Array<{
    dimension: string;
    correlationScore: number;
    eventCount: number;
    note: string;
  }>;
  keyInsights: string[];
}

// 事件发射器
export const lifeEventEvents = new EventEmitter();

// 内存存储（生产环境应使用数据库）
const lifeEventsDB = new Map<number, LifeEvent>();
let autoIncrementId = 1;

// 事件类型定义
export const EVENT_TYPES = {
  CAREER: 'career',
  RELATIONSHIP: 'relationship',
  HEALTH: 'health',
  EDUCATION: 'education',
  FINANCIAL: 'financial',
  PERSONAL: 'personal',
  FAMILY: 'family',
  TRAVEL: 'travel',
  OTHER: 'other'
} as const;

// 影响类型定义
export const IMPACT_TYPES = {
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral'
} as const;

// 人格维度定义
export const DIMENSIONS = {
  E: 'Extraversion',      // 外向
  I: 'Introversion',      // 内向
  N: 'Intuition',         // 直觉
  S: 'Sensing',           // 感觉
  T: 'Thinking',          // 思考
  F: 'Feeling',           // 情感
  J: 'Judging',           // 判断
  P: 'Perceiving'         // 知觉
} as const;

/**
 * 创建生活事件
 */
export async function createLifeEvent(params: CreateLifeEventParams): Promise<LifeEvent> {
  const id = autoIncrementId++;
  
  const event: LifeEvent = {
    id,
    userId: params.userId,
    resultId: params.resultId,
    eventType: params.eventType,
    eventCategory: params.eventCategory,
    title: params.title,
    description: params.description,
    eventDate: new Date(params.eventDate),
    expectedImpact: params.expectedImpact,
    actualImpactScore: params.actualImpactScore,
    relatedDimension: params.relatedDimension,
    correlationAnalyzed: false,
    correlationNote: undefined,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  lifeEventsDB.set(id, event);
  
  lifeEventEvents.emit('eventCreated', { event });
  
  return event;
}

/**
 * 获取生活事件
 */
export async function getLifeEvent(id: number): Promise<LifeEvent | null> {
  return lifeEventsDB.get(id) || null;
}

/**
 * 获取用户的生活事件列表
 */
export async function getUserLifeEvents(
  userId: number, 
  options?: {
    startDate?: Date;
    endDate?: Date;
    eventType?: string;
    limit?: number;
    offset?: number;
  }
): Promise<LifeEvent[]> {
  let events = Array.from(lifeEventsDB.values()).filter(e => e.userId === userId);
  
  if (options?.startDate) {
    events = events.filter(e => e.eventDate >= options.startDate!);
  }
  
  if (options?.endDate) {
    events = events.filter(e => e.eventDate <= options.endDate!);
  }
  
  if (options?.eventType) {
    events = events.filter(e => e.eventType === options.eventType);
  }
  
  // 按事件日期排序
  events.sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());
  
  const offset = options?.offset || 0;
  const limit = options?.limit || 100;
  
  return events.slice(offset, offset + limit);
}

/**
 * 更新生活事件
 */
export async function updateLifeEvent(id: number, params: UpdateLifeEventParams): Promise<LifeEvent | null> {
  const event = lifeEventsDB.get(id);
  if (!event) {
    return null;
  }
  
  if (params.title !== undefined) event.title = params.title;
  if (params.description !== undefined) event.description = params.description;
  if (params.expectedImpact !== undefined) event.expectedImpact = params.expectedImpact;
  if (params.actualImpactScore !== undefined) event.actualImpactScore = params.actualImpactScore;
  if (params.relatedDimension !== undefined) event.relatedDimension = params.relatedDimension;
  
  event.updatedAt = new Date();
  
  lifeEventsDB.set(id, event);
  
  lifeEventEvents.emit('eventUpdated', { event });
  
  return event;
}

/**
 * 删除生活事件
 */
export async function deleteLifeEvent(id: number): Promise<boolean> {
  const event = lifeEventsDB.get(id);
  if (!event) {
    return false;
  }
  
  lifeEventsDB.delete(id);
  
  lifeEventEvents.emit('eventDeleted', { eventId: id });
  
  return true;
}

/**
 * 分析生活事件影响
 */
export async function analyzeLifeEvents(userId: number): Promise<LifeEventAnalysis> {
  const events = await getUserLifeEvents(userId);
  
  // 按类型统计
  const eventsByType: Record<string, number> = {};
  for (const event of events) {
    eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
  }
  
  // 按影响统计
  const eventsByImpact = {
    positive: events.filter(e => e.expectedImpact === 'positive').length,
    negative: events.filter(e => e.expectedImpact === 'negative').length,
    neutral: events.filter(e => e.expectedImpact === 'neutral' || !e.expectedImpact).length
  };
  
  // 影响趋势分析（按月）
  const impactTrend: Array<{
    period: string;
    averageScore: number;
    eventCount: number;
  }> = [];
  
  const eventsWithScore = events.filter(e => e.actualImpactScore !== undefined);
  if (eventsWithScore.length > 0) {
    const months = new Map<string, { total: number; count: number }>();
    
    for (const event of eventsWithScore) {
      const period = `${event.eventDate.getFullYear()}-${String(event.eventDate.getMonth() + 1).padStart(2, '0')}`;
      const existing = months.get(period) || { total: 0, count: 0 };
      existing.total += event.actualImpactScore!;
      existing.count++;
      months.set(period, existing);
    }
    
    for (const [period, data] of months.entries()) {
      impactTrend.push({
        period,
        averageScore: Math.round((data.total / data.count) * 10) / 10,
        eventCount: data.count
      });
    }
    
    impactTrend.sort((a, b) => a.period.localeCompare(b.period));
  }
  
  // 维度相关性分析（探索性）
  const dimensionCorrelations: Array<{
    dimension: string;
    correlationScore: number;
    eventCount: number;
    note: string;
  }> = [];
  
  const dimensionEvents = events.filter(e => e.relatedDimension);
  const dimensionCounts: Record<string, number> = {};
  
  for (const event of dimensionEvents) {
    const dim = event.relatedDimension!;
    dimensionCounts[dim] = (dimensionCounts[dim] || 0) + 1;
  }
  
  const totalWithDimension = dimensionEvents.length;
  for (const [dimension, count] of Object.entries(dimensionCounts)) {
    const correlationScore = Math.round((count / totalWithDimension) * 100);
    dimensionCorrelations.push({
      dimension,
      correlationScore,
      eventCount: count,
      note: generateCorrelationNote(dimension, count, events)
    });
  }
  
  dimensionCorrelations.sort((a, b) => b.correlationScore - a.correlationScore);
  
  // 生成关键洞察
  const keyInsights: string[] = [];
  
  if (events.length > 0) {
    const positiveRatio = eventsByImpact.positive / events.length;
    if (positiveRatio > 0.6) {
      keyInsights.push('您的生活中积极事件占主导，显示出良好的生活状态和发展趋势。');
    } else if (positiveRatio < 0.3) {
      keyInsights.push('近期挑战性事件较多，这可能是成长的契机，也需要注意心理调适。');
    }
    
    // 找出最主要的事件类型
    const topEventType = Object.entries(eventsByType).sort((a, b) => b[1] - a[1])[0];
    if (topEventType) {
      const typeNames: Record<string, string> = {
        career: '职业发展',
        relationship: '人际关系',
        health: '健康状况',
        education: '学习成长',
        financial: '财务状况',
        personal: '个人发展',
        family: '家庭生活',
        travel: '旅行经历'
      };
      keyInsights.push(`${typeNames[topEventType[0]] || topEventType[0]}是您生活中的主要主题，共 ${topEventType[1]} 个事件。`);
    }
    
    if (dimensionCorrelations.length > 0) {
      const topDimension = dimensionCorrelations[0];
      keyInsights.push(`探索性分析显示，您的生活事件与${topDimension.dimension}维度关联度最高（${topDimension.correlationScore}%）。*注意：这仅为统计关联，不代表因果关系。*`);
    }
  }
  
  return {
    totalEvents: events.length,
    eventsByType,
    eventsByImpact,
    impactTrend,
    dimensionCorrelations,
    keyInsights
  };
}

/**
 * 生成相关性说明（探索性）
 */
function generateCorrelationNote(dimension: string, count: number, allEvents: LifeEvent[]): string {
  const dimensionNames: Record<string, string> = {
    E: '外向',
    I: '内向',
    N: '直觉',
    S: '感觉',
    T: '思考',
    F: '情感',
    J: '判断',
    P: '知觉'
  };
  
  const dimName = dimensionNames[dimension] || dimension;
  
  // 基于事件类型生成说明
  const eventTypesInDimension = allEvents
    .filter(e => e.relatedDimension === dimension)
    .map(e => e.eventType);
  
  const typeCounts: Record<string, number> = {};
  for (const type of eventTypesInDimension) {
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  }
  
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
  
  if (topType) {
    return `在${count}个标记为${dimName}维度的事件中，${topType[0]}类事件占比最高。这种关联可能反映了该维度在您生活中的活跃领域。`;
  }
  
  return `在您的${allEvents.length}个生活事件中，有${count}个事件与${dimName}维度相关联。这种关联为探索性分析，仅供参考。`;
}

/**
 * 批量导入生活事件
 */
export async function bulkCreateLifeEvents(events: CreateLifeEventParams[]): Promise<LifeEvent[]> {
  const created: LifeEvent[] = [];
  
  for (const params of events) {
    try {
      const event = await createLifeEvent(params);
      created.push(event);
    } catch (error) {
      lifeEventEvents.emit('eventImportError', { params, error: (error as Error).message });
    }
  }
  
  return created;
}

/**
 * 导出用户的生活事件（用于备份或迁移）
 */
export async function exportLifeEvents(userId: number): Promise<LifeEvent[]> {
  return await getUserLifeEvents(userId, { limit: 10000 });
}

/**
 * 清空用户的生活事件（谨慎使用）
 */
export async function clearUserLifeEvents(userId: number): Promise<number> {
  const events = await getUserLifeEvents(userId, { limit: 10000 });
  let deleted = 0;
  
  for (const event of events) {
    if (await deleteLifeEvent(event.id)) {
      deleted++;
    }
  }
  
  lifeEventEvents.emit('eventsCleared', { userId, deleted });
  
  return deleted;
}

export default {
  createLifeEvent,
  getLifeEvent,
  getUserLifeEvents,
  updateLifeEvent,
  deleteLifeEvent,
  analyzeLifeEvents,
  bulkCreateLifeEvents,
  exportLifeEvents,
  clearUserLifeEvents,
  lifeEventEvents,
  EVENT_TYPES,
  IMPACT_TYPES,
  DIMENSIONS
};
