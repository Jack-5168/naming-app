/**
 * Big Five to MBTI Mapping Service
 * 基于 IPIP-NEO 五维度得分映射到 MBTI 类型
 * 使用统计学方法计算各维度倾向和置信度
 */

import { MBTIResult } from '../types';

/**
 * MBTI 类型描述数据库
 */
const MBTI_DESCRIPTIONS: Record<string, string> = {
  // 分析家 (Analysts)
  INTJ: '建筑师 - 富有想象力和战略性的思想家，一切皆在计划之中',
  INTP: '逻辑学家 - 具有创造力的发明家，对知识有着止不住的渴望',
  ENTJ: '指挥官 - 大胆，富有想象力且意志强大的领导者',
  ENTP: '辩论家 - 聪明好奇的思想者，无法抵抗智力上的挑战',
  
  // 外交家 (Diplomats)
  INFJ: '提倡者 - 安静而神秘，同时鼓舞人心且不知疲倦的理想主义者',
  INFP: '调停者 - 诗意，善良的利他主义者，总是热情地为正当理由提供帮助',
  ENFJ: '主人公 - 富有魅力鼓舞人心的领导者，有能力让听众为之着迷',
  ENFP: '竞选者 - 热情，有创造力爱社交的自由人，总能找到理由微笑',
  
  // 守护者 (Sentinels)
  ISTJ: '物流师 - 实用，注重事实的可靠人士',
  ISFJ: '守卫者 - 非常专注而温暖的守护者，时刻准备着保护爱着的人们',
  ESTJ: '总经理 - 出色的管理者，在管理事情或人的方面无与伦比',
  ESFJ: '执政官 - 极有同情心，爱社交受欢迎的人，总是热心提供帮助',
  
  // 探险家 (Explorers)
  ISTP: '鉴赏家 - 大胆而实际的实验家，擅长使用各种形式的工具',
  ISFP: '探险家 - 有魅力的艺术家，总是愿意探索新鲜事物',
  ESTP: '企业家 - 聪明，精力充沛善于感知的人，真心享受冒险',
  ESFP: '表演者 - 自发的，精力充沛而热情的表演者，生活在他们周围永远不会无聊'
};

/**
 * 阈值配置
 */
interface ThresholdConfig {
  balanced: number;    // 平衡阈值 (±以内视为平衡)
  moderate: number;    // 中等倾向阈值
  strong: number;      // 强烈倾向阈值
}

const DEFAULT_THRESHOLD: ThresholdConfig = {
  balanced: 10,     // 45-55 视为平衡
  moderate: 20,     // 35-45 或 55-65 为中等
  strong: 30        // <35 或 >65 为强烈
};

/**
 * 将大五维度得分映射到 MBTI 维度
 * 
 * 映射规则基于心理学研究:
 * - E (Extraversion) → E-I: 外向性直接对应
 * - O (Openness) → N-S: 高开放性对应直觉 N，低开放性对应实感 S
 * - A (Agreeableness) → T-F: 低宜人性对应思考 T，高宜人性对应情感 F
 * - C (Conscientiousness) → J-P: 高尽责性对应判断 J，低尽责性对应知觉 P
 * - N (Neuroticism) → 不直接映射，影响置信度
 */
export function mapBig5ToMBTI(
  O: number,  // 开放性 0-100
  C: number,  // 尽责性 0-100
  E: number,  // 外向性 0-100
  A: number,  // 宜人性 0-100
  N: number   // 神经质 0-100
): MBTIResult {
  const threshold = DEFAULT_THRESHOLD;

  // E-I 维度：外向性直接映射
  const E_I = mapDimension(E, threshold);
  const E_I_confidence = calculateConfidence(E, threshold);

  // N-S 维度：开放性映射 (高 O = N, 低 O = S)
  const N_S = mapDimension(O, threshold);
  const N_S_confidence = calculateConfidence(O, threshold);

  // T-F 维度：宜人性反向映射 (低 A = T, 高 A = F)
  const A_reversed = 100 - A;  // 反转
  const T_F = mapDimension(A_reversed, threshold);
  const T_F_confidence = calculateConfidence(A_reversed, threshold);

  // J-P 维度：尽责性映射 (高 C = J, 低 C = P)
  const J_P = mapDimension(C, threshold);
  const J_P_confidence = calculateConfidence(C, threshold);

  // 构建 MBTI 类型
  const type = `${getLetter(E_I)}${getLetter(N_S)}${getLetter(T_F)}${getLetter(J_P)}`;

  // 计算总体置信度
  const overallConfidence = (E_I_confidence + N_S_confidence + T_F_confidence + J_P_confidence) / 4;

  // 神经质影响置信度 (高神经质降低置信度)
  const neuroticismFactor = N > 60 ? 0.9 : (N < 40 ? 1.0 : 0.95);
  const adjustedOverallConfidence = overallConfidence * neuroticismFactor;

  return {
    type,
    dimensions: {
      E: { score: E, label: getLetter(E_I) as string },
      N: { score: O, label: getLetter(N_S) as string },
      T: { score: A_reversed, label: getLetter(T_F) as string },
      J: { score: C, label: getLetter(J_P) as string }
    },
    confidence: adjustedOverallConfidence
  };
}

/**
 * 映射单个维度
 */
function mapDimension(score: number, threshold: ThresholdConfig): 'E' | 'I' | 'balanced' | 'N' | 'S' | 'T' | 'F' | 'J' | 'P' {
  const distanceFrom50 = score - 50;

  if (Math.abs(distanceFrom50) <= threshold.balanced) {
    return 'balanced';
  } else if (distanceFrom50 > 0) {
    // 高分端
    return getHighPolarity(score);
  } else {
    // 低分端
    return getLowPolarity(score);
  }
}

/**
 * 获取高分端极性标签
 */
function getHighPolarity(score: number): 'E' | 'N' | 'T' | 'J' {
  // 这个函数返回的标签取决于具体维度，由调用者解释
  // 这里返回通用的"高特质"标签
  return 'E'; // 占位符，实际由上下文决定
}

/**
 * 获取低分端极性标签
 */
function getLowPolarity(score: number): 'I' | 'S' | 'F' | 'P' {
  // 这个函数返回的标签取决于具体维度，由调用者解释
  return 'I'; // 占位符，实际由上下文决定
}

/**
 * 获取字母表示
 */
function getLetter(dimension: string): string {
  if (dimension === 'balanced') {
    return '?'; // 平衡时用问号表示
  }
  return dimension[0];
}

/**
 * 计算置信度
 * 基于得分偏离 50 的程度
 */
function calculateConfidence(score: number, threshold: ThresholdConfig): number {
  const distanceFrom50 = Math.abs(score - 50);
  
  if (distanceFrom50 <= threshold.balanced) {
    // 平衡区域：置信度 0.3-0.5
    return 0.3 + (distanceFrom50 / threshold.balanced) * 0.2;
  } else if (distanceFrom50 <= threshold.moderate) {
    // 中等倾向：置信度 0.5-0.7
    return 0.5 + ((distanceFrom50 - threshold.balanced) / (threshold.moderate - threshold.balanced)) * 0.2;
  } else if (distanceFrom50 <= threshold.strong) {
    // 明显倾向：置信度 0.7-0.9
    return 0.7 + ((distanceFrom50 - threshold.moderate) / (threshold.strong - threshold.moderate)) * 0.2;
  } else {
    // 强烈倾向：置信度 0.9-1.0
    return 0.9 + ((distanceFrom50 - threshold.strong) / (50 - threshold.strong)) * 0.1;
  }
}

/**
 * 获取维度倾向描述
 */
export function getDimensionDescription(
  dimension: keyof MBTIResult['dimensions'],
  value: string
): string {
  const descriptions: Record<string, Record<string, string>> = {
    E_I: {
      E: '外向型 - 从外部世界和人际互动中获得能量',
      I: '内向型 - 从内心思想和独处中获得能量',
      balanced: '中间型 - 在内外向之间灵活切换'
    },
    N_S: {
      N: '直觉型 - 关注模式、可能性和未来',
      S: '实感型 - 关注事实、细节和当下',
      balanced: '中间型 - 平衡使用直觉和实感'
    },
    T_F: {
      T: '思考型 - 基于逻辑和客观分析做决策',
      F: '情感型 - 基于价值观和人际关系做决策',
      balanced: '中间型 - 平衡使用思考和情感'
    },
    J_P: {
      J: '判断型 - 喜欢结构化、计划和确定性',
      P: '知觉型 - 喜欢灵活性、开放和自发性',
      balanced: '中间型 - 平衡使用判断和知觉'
    }
  };

  return descriptions[dimension][value] || '未知';
}

/**
 * 获取类型详细解释
 */
export function getTypeExplanation(type: string): string {
  const explanations: Record<string, string> = {
    INTJ: '作为建筑师，你具有战略思维和独立精神。你善于看到全局，制定长期计划，并坚持执行。',
    INTP: '作为逻辑学家，你追求知识和理解。你善于分析复杂问题，寻找逻辑一致性，喜欢理论思考。',
    ENTJ: '作为指挥官，你是天生的领导者。你善于组织资源，制定战略，并激励他人实现目标。',
    ENTP: '作为辩论家，你充满好奇和创造力。你善于发现可能性，挑战传统，享受智力辩论。',
    INFJ: '作为提倡者，你理想主义且富有洞察力。你善于理解他人，追求意义，致力于帮助他人成长。',
    INFP: '作为调停者，你理想主义且富有同情心。你重视真实性，追求个人价值，善于理解他人情感。',
    ENFJ: '作为主人公，你富有魅力且关心他人。你善于激励和引导他人，营造和谐氛围。',
    ENFP: '作为竞选者，你热情且富有创造力。你善于发现可能性，激励他人，享受新体验。',
    ISTJ: '作为物流师，你务实且可靠。你重视传统和责任，善于组织和管理细节。',
    ISFJ: '作为守卫者，你忠诚且关心他人。你重视和谐，善于照顾他人需求，默默奉献。',
    ESTJ: '作为总经理，你高效且务实。你善于组织和管理，重视秩序和效率。',
    ESFJ: '作为执政官，你热心且负责。你重视和谐，善于照顾他人，营造温暖氛围。',
    ISTP: '作为鉴赏家，你实际且灵活。你善于解决问题，喜欢动手操作，适应性强。',
    ISFP: '作为探险家，你艺术且敏感。你重视个人价值，善于表达美，享受当下。',
    ESTP: '作为企业家，你精力充沛且实际。你善于应对挑战，喜欢冒险，行动力强。',
    ESFP: '作为表演者，你热情且活泼。你善于娱乐他人，享受社交，带来欢乐。'
  };

  return explanations[type] || '暂无详细描述';
}

/**
 * 计算类型匹配度
 * 用于比较两个 MBTI 类型的相似程度
 */
export function calculateTypeSimilarity(type1: string, type2: string): number {
  if (type1.length !== 4 || type2.length !== 4) return 0;
  if (type1 === type2) return 1.0;

  let matches = 0;
  for (let i = 0; i < 4; i++) {
    if (type1[i] === type2[i]) matches++;
  }

  return matches / 4;
}

export default mapBig5ToMBTI;
