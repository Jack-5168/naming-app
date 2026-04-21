/**
 * LLM 报告生成服务
 * 负责调用 GPT-4o-mini 生成个性化人格报告
 */

import { EventEmitter } from 'events';
import { 
  COST_CONTROL, 
  recordUsage, 
  getBudgetStatus, 
  isWithinBudget,
  getModelStrategy,
  getFallbackModel,
  getMaxRetries,
  costEvents 
} from './cost-control';

export interface ReportGenerationParams {
  userId: string;
  clientIp: string;
  resultId: number;
  reportType: 'basic' | 'pro' | 'master';
  includeSections: string[];
}

export interface ReportGenerationResult {
  content: string;
  tokens: number;
  generationTime: number;
  requestId: string;
  cost: number;  // 成本（人民币）
}

export interface RateLimitStatus {
  userRemaining: number;
  ipRemaining: number;
  userResetTime: number;
  ipResetTime: number;
}

// 事件发射器
export const reportEvents = new EventEmitter();

// 限流存储（生产环境应使用 Redis）
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const userRateLimits = new Map<string, RateLimitRecord>();
const ipRateLimits = new Map<string, RateLimitRecord>();

// 成本计算（GPT-4o-mini 定价：$0.15/1M input tokens, $0.60/1M output tokens）
const PRICING = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },  // 美元 per 1M tokens
  'claude-haiku': { input: 0.25, output: 1.25 }   // 美元 per 1M tokens
};

const USD_TO_CNY = 7.2;  // 美元转人民币汇率

// 基础报告模板
const BASIC_REPORT_TEMPLATE = `你是一位专业的人格心理学分析师。请根据以下 MBTI 测试结果，生成一份简洁易懂的人格分析报告。

## 用户信息
- 人格类型：{{mbtiType}}
- 各维度得分：E={{eScore}}%, N={{nScore}}%, T={{tScore}}%, J={{jScore}}%
- 测试时间：{{testDate}}

## 报告要求
1. 用温暖、专业的语气撰写
2. 避免绝对化表述（不使用"保证"、"一定"、"绝对"等词）
3. 包含以下章节：
   - 核心特质解读（约 200 字）
   - 优势与潜力（约 200 字）
   - 成长建议（约 200 字）
   - 适合的职业方向（约 150 字）
   - 人际关系特点（约 150 字）
4. 在报告末尾添加免责声明："本报告基于心理学理论生成，仅供参考，不构成专业心理评估。"
5. 总字数控制在 800-1200 字之间

请开始生成报告：`;

// 专业报告模板（含生活事件）
const PRO_REPORT_TEMPLATE = `你是一位资深的人格心理学专家和人生发展顾问。请根据以下 MBTI 测试结果和生活事件，生成一份深度个性化的人格发展报告。

## 用户信息
- 人格类型：{{mbtiType}}
- 各维度得分：E={{eScore}}%, N={{nScore}}%, T={{tScore}}%, J={{jScore}}%
- 测试时间：{{testDate}}

## 生活事件（按时间顺序）
{{#lifeEvents}}
- {{date}}: {{title}} ({{type}}) - {{description}}
{{/lifeEvents}}

## 报告要求
1. 用深度、洞察性的语气撰写，展现专业性
2. 避免绝对化表述（不使用"保证"、"一定"、"绝对"等词）
3. 包含以下章节：
   - 人格核心画像（约 400 字）
     * 主导功能分析
     * 认知模式解读
     * 决策风格特点
   
   - 生活事件影响分析（约 500 字）
     * 关键转折点识别
     * 事件与人格发展的关联
     * 成长轨迹可视化描述
   
   - 优势深度挖掘（约 400 字）
     * 核心天赋识别
     * 已展现的优势
     * 待开发的潜力
   
   - 挑战与成长方向（约 400 字）
     * 潜在盲点分析
     * 压力状态下的表现
     * 具体成长策略
   
   - 职业发展路径（约 400 字）
     * 适合的职业领域
     * 理想工作环境
     * 发展阶段建议
   
   - 人际关系指南（约 400 字）
     * 沟通风格特点
     * 亲密关系模式
     * 社交能量管理
   
   - 个性化行动建议（约 500 字）
     * 30 天行动计划
     * 90 天发展目标
     * 长期成长愿景
   
4. 在报告末尾添加免责声明："本报告基于心理学理论和用户提供信息生成，仅供参考，不构成专业心理评估或职业咨询。"
5. 总字数控制在 2000-3000 字之间
6. 注意：生活事件与人格维度的关联仅为探索性分析，不代表因果关系

请开始生成深度报告：`;

// 大师级报告模板
const MASTER_REPORT_TEMPLATE = `你是一位世界级的人格心理学大师和人生导师，拥有 30 年咨询经验。请根据以下 MBTI 测试结果和完整生活史，生成一份大师级的人格发展报告。

## 用户信息
- 人格类型：{{mbtiType}}
- 各维度得分：E={{eScore}}%, N={{nScore}}%, T={{tScore}}%, J={{jScore}}%
- 测试时间：{{testDate}}

## 完整生活事件时间线
{{#lifeEvents}}
- {{date}}: {{title}} ({{type}})
  描述：{{description}}
  预期影响：{{expectedImpact}}
  实际影响评分：{{actualImpactScore}}
  相关维度：{{relatedDimension}}
{{/lifeEvents}}

## 报告要求
1. 用大师级、富有智慧的语气撰写，展现深厚专业功底
2. 避免绝对化表述，保持科学严谨性
3. 包含以下章节（每章约 600-800 字）：
   - 人格本质洞察
   - 生命历程解读
   - 认知功能深度分析
   - 优势与天赋全景图
   - 阴影与盲点探索
   - 关系模式解码
   - 职业使命指引
   - 整合与发展路径
   - 个性化成长方案
   - 终极潜能展望
4. 融入荣格心理学、积极心理学、发展心理学等多维度视角
5. 在报告末尾添加免责声明
6. 总字数控制在 4000-5000 字之间

请开始生成大师级报告：`;

/**
 * 生成唯一请求 ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 检查限流
 */
function checkRateLimit(userId: string, clientIp: string): RateLimitStatus {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  
  // 用户限流（3 次/日）
  let userRecord = userRateLimits.get(userId);
  if (!userRecord || now > userRecord.resetTime) {
    userRecord = { count: 0, resetTime: now + dayMs };
    userRateLimits.set(userId, userRecord);
  }
  
  // IP 限流（50 次/日）
  let ipRecord = ipRateLimits.get(clientIp);
  if (!ipRecord || now > ipRecord.resetTime) {
    ipRecord = { count: 0, resetTime: now + dayMs };
    ipRateLimits.set(clientIp, ipRecord);
  }
  
  return {
    userRemaining: Math.max(0, 3 - userRecord.count),
    ipRemaining: Math.max(0, 50 - ipRecord.count),
    userResetTime: userRecord.resetTime,
    ipResetTime: ipRecord.resetTime
  };
}

/**
 * 增加限流计数
 */
function incrementRateLimit(userId: string, clientIp: string): void {
  const userRecord = userRateLimits.get(userId);
  if (userRecord) {
    userRecord.count++;
  }
  
  const ipRecord = ipRateLimits.get(clientIp);
  if (ipRecord) {
    ipRecord.count++;
  }
}

/**
 * 渲染模板
 */
function renderTemplate(template: string, data: any): string {
  let rendered = template;
  
  // 简单变量替换
  rendered = rendered.replace(/{{(\w+)}}/g, (_, key) => {
    return data[key] !== undefined ? String(data[key]) : '';
  });
  
  // 数组处理（生活事件）
  if (data.lifeEvents && Array.isArray(data.lifeEvents)) {
    const sectionMatch = rendered.match(/{{#lifeEvents}}([\s\S]*?){{\/lifeEvents}}/);
    if (sectionMatch) {
      const itemTemplate = sectionMatch[1];
      const items = data.lifeEvents.map((event: any) => {
        return itemTemplate.replace(/{{(\w+)}}/g, (_, key) => {
          return event[key] !== undefined ? String(event[key]) : '';
        });
      }).join('');
      rendered = rendered.replace(sectionMatch[0], items);
    }
  } else {
    // 移除未使用的 lifeEvents 块
    rendered = rendered.replace(/{{#lifeEvents}}[\s\S]*?{{\/lifeEvents}}/g, '');
  }
  
  return rendered;
}

/**
 * 质量验证
 */
function validateQuality(content: string, reportType: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // 字数检查
  const charCount = content.length;
  const wordCount = Math.floor(charCount / 2);  // 中文字数估算
  
  const wordLimits = {
    basic: { min: 800, max: 1200 },
    pro: { min: 2000, max: 3000 },
    master: { min: 4000, max: 5000 }
  };
  
  const limit = wordLimits[reportType as 'basic' | 'pro' | 'master'];
  if (wordCount < limit.min) {
    issues.push(`字数不足：${wordCount}/${limit.min}`);
  } else if (wordCount > limit.max) {
    issues.push(`字数超限：${wordCount}/${limit.max}`);
  }
  
  // 禁止词检测
  const forbiddenWords = ['保证', '一定', '绝对', '肯定', '必然', '无疑'];
  for (const word of forbiddenWords) {
    if (content.includes(word)) {
      issues.push(`包含禁止词："${word}"`);
    }
  }
  
  // 免责声明检查
  if (!content.includes('免责声明') && !content.includes('仅供参考')) {
    issues.push('缺少免责声明');
  }
  
  // 结构完整性检查（检查关键章节标题）
  const requiredSections = {
    basic: ['核心特质', '优势', '成长建议'],
    pro: ['人格核心', '生活事件', '优势', '挑战', '职业', '人际', '行动建议'],
    master: ['人格本质', '生命历程', '认知功能', '优势', '阴影', '关系', '职业', '成长']
  };
  
  const sections = requiredSections[reportType as 'basic' | 'pro' | 'master'];
  for (const section of sections) {
    if (!content.includes(section)) {
      issues.push(`缺少章节：${section}`);
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * 模拟 LLM 调用（实际应调用 OpenAI API）
 */
async function callLLM(prompt: string, model: string, maxTokens: number): Promise<{ content: string; tokens: number }> {
  // 这里应该调用实际的 OpenAI API
  // 为了演示，我们模拟一个响应
  
  // 实际实现示例：
  /*
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.7
    })
  });
  
  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    tokens: data.usage.total_tokens
  };
  */
  
  // 模拟响应（实际使用时删除）
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
  
  const mockContent = `## 人格分析报告

### 核心特质解读
根据您的 MBTI 测试结果，您展现出独特的人格特质组合。这种特质使您在面对挑战时能够保持冷静分析，同时也不失对他人感受的敏感度。

### 优势与潜力
您的核心优势在于逻辑思维和直觉洞察的平衡发展。这使您既能看到事物的本质，又能理解复杂的人际动态。

### 成长建议
建议您继续发挥分析能力强的优势，同时有意识地培养情感表达和社交互动技能。

### 适合的职业方向
适合需要分析能力和创新思维的职业，如咨询、研究、战略规划等领域。

### 人际关系特点
在人际关系中，您倾向于深度而非广度的连接。重视真诚和有意义的交流。

---
*免责声明：本报告基于心理学理论生成，仅供参考，不构成专业心理评估。*`;

  return {
    content: mockContent,
    tokens: Math.floor(Math.random() * 500) + 1000
  };
}

/**
 * 计算成本（人民币）
 */
function calculateCost(tokens: number, model: string, inputRatio: number = 0.3): number {
  const pricing = PRICING[model as keyof typeof PRICING] || PRICING['gpt-4o-mini'];
  const inputTokens = tokens * inputRatio;
  const outputTokens = tokens * (1 - inputRatio);
  
  const costUSD = (inputTokens / 1000000) * pricing.input + (outputTokens / 1000000) * pricing.output;
  return costUSD * USD_TO_CNY;  // 转换为人民币
}

/**
 * 生成报告（主函数）
 */
export async function generateReport(params: ReportGenerationParams): Promise<ReportGenerationResult> {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  reportEvents.emit('reportStarted', { requestId, params });
  
  try {
    // 1. 检查限流
    const rateLimit = checkRateLimit(params.userId, params.clientIp);
    if (rateLimit.userRemaining <= 0) {
      throw new Error('用户每日生成次数已达上限（3 次/日）');
    }
    if (rateLimit.ipRemaining <= 0) {
      throw new Error('IP 每日请求次数已达上限（50 次/日）');
    }
    
    // 2. 获取模型策略
    const strategy = getModelStrategy(params.reportType);
    
    // 3. 检查预算
    const estimatedCost = calculateCost(strategy.maxTokens, strategy.model);
    if (!isWithinBudget(estimatedCost)) {
      const status = getBudgetStatus();
      throw new Error(`预算不足。今日剩余：$${status.dailyRemaining.toFixed(2)}`);
    }
    
    // 4. 准备数据
    const template = params.reportType === 'basic' 
      ? BASIC_REPORT_TEMPLATE 
      : params.reportType === 'pro'
        ? PRO_REPORT_TEMPLATE
        : MASTER_REPORT_TEMPLATE;
    
    const data = {
      mbtiType: 'INTJ',  // 实际应从数据库获取
      eScore: 45,
      nScore: 72,
      tScore: 68,
      jScore: 81,
      testDate: new Date().toISOString(),
      lifeEvents: []  // 实际应从数据库获取
    };
    
    // 5. 渲染模板
    const prompt = renderTemplate(template, data);
    
    // 6. 调用 LLM（带重试）
    let lastError: Error | null = null;
    let result: { content: string; tokens: number } | null = null;
    const maxRetries = getMaxRetries();
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const timeoutPromise = new Promise<{ content: string; tokens: number }>((_, reject) => {
          setTimeout(() => reject(new Error('LLM 调用超时（30 秒）')), 30000);
        });
        
        result = await Promise.race([
          callLLM(prompt, strategy.model, strategy.maxTokens),
          timeoutPromise
        ]);
        break;
      } catch (error) {
        lastError = error as Error;
        reportEvents.emit('reportRetry', { requestId, attempt, error: (error as Error).message });
        
        if (attempt === maxRetries) {
          // 尝试降级
          const fallbackModel = getFallbackModel();
          if (fallbackModel) {
            reportEvents.emit('reportFallback', { requestId, from: strategy.model, to: fallbackModel });
            try {
              result = await callLLM(prompt, fallbackModel, strategy.maxTokens);
            } catch (fallbackError) {
              // 降级也失败
            }
          }
        }
      }
    }
    
    if (!result) {
      throw lastError || new Error('LLM 调用失败');
    }
    
    // 7. 质量验证
    const validation = validateQuality(result.content, params.reportType);
    if (!validation.valid) {
      reportEvents.emit('reportQualityWarning', { requestId, issues: validation.issues });
      // 不抛出错误，仅记录警告
    }
    
    // 8. 计算实际成本
    const cost = calculateCost(result.tokens, strategy.model);
    
    // 9. 记录使用
    incrementRateLimit(params.userId, params.clientIp);
    recordUsage({
      timestamp: Date.now(),
      cost: cost / USD_TO_CNY,  // 记录美元成本
      model: strategy.model,
      reportType: params.reportType,
      userId: params.userId
    });
    
    // 10. 返回结果
    const generationTime = Date.now() - startTime;
    
    const reportResult: ReportGenerationResult = {
      content: result.content,
      tokens: result.tokens,
      generationTime,
      requestId,
      cost
    };
    
    reportEvents.emit('reportCompleted', { requestId, result: reportResult });
    
    return reportResult;
    
  } catch (error) {
    reportEvents.emit('reportFailed', { requestId, error: (error as Error).message });
    throw error;
  }
}

/**
 * 获取限流状态
 */
export function getRateLimitStatus(userId: string, clientIp: string): RateLimitStatus {
  return checkRateLimit(userId, clientIp);
}

/**
 * 重置限流（管理员功能）
 */
export function resetRateLimit(userId?: string, clientIp?: string): void {
  if (userId) {
    userRateLimits.delete(userId);
  }
  if (clientIp) {
    ipRateLimits.delete(clientIp);
  }
  if (!userId && !clientIp) {
    userRateLimits.clear();
    ipRateLimits.clear();
  }
}

export default {
  generateReport,
  getRateLimitStatus,
  resetRateLimit,
  reportEvents,
  BASIC_REPORT_TEMPLATE,
  PRO_REPORT_TEMPLATE,
  MASTER_REPORT_TEMPLATE
};
