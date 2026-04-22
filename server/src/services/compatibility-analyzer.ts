/**
 * Compatibility Analyzer Service - 兼容性分析服务
 * Phase 4: Growth Features
 * 
 * Features:
 * - MBTI 类型兼容性计算
 * - 冲突预警
 * - 关系建议
 * 
 * Based on psychological research on personality type interactions
 */

export interface CompatibilityResult {
  overallScore: number; // 0-1
  compatibilityLevel: 'excellent' | 'good' | 'moderate' | 'challenging';
  conflictWarnings: ConflictWarning[];
  relationshipAdvice: RelationshipAdvice[];
  dimensionAnalysis: DimensionCompatibility[];
}

export interface ConflictWarning {
  dimension: string;
  level: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
}

export interface RelationshipAdvice {
  category: string;
  advice: string;
  example: string;
}

export interface DimensionCompatibility {
  dimension: string;
  initiatorScore: number;
  participantScore: number;
  difference: number;
  compatibility: string;
  description: string;
}

/**
 * Analyze compatibility between two MBTI test results
 * @param initiatorAnswers - Initiator's test answers/scores
 * @param participantAnswers - Participant's test answers/scores
 * @param initiatorType - Initiator's MBTI type (e.g., 'INFJ')
 * @param participantType - Participant's MBTI type (e.g., 'ENFP')
 */
export async function analyzeCompatibility(
  initiatorAnswers: any,
  participantAnswers: any,
  initiatorType: string,
  participantType: string
): Promise<CompatibilityResult> {
  // Extract dimension scores (E, N, T, J)
  const initiatorScores = extractDimensionScores(initiatorAnswers);
  const participantScores = extractDimensionScores(participantAnswers);

  // Calculate dimension-level compatibility
  const dimensionAnalysis = calculateDimensionCompatibility(
    initiatorScores,
    participantScores
  );

  // Calculate overall compatibility score
  const overallScore = calculateOverallScore(dimensionAnalysis, initiatorType, participantType);

  // Determine compatibility level
  const compatibilityLevel = getCompatibilityLevel(overallScore);

  // Generate conflict warnings
  const conflictWarnings = generateConflictWarnings(dimensionAnalysis);

  // Generate relationship advice
  const relationshipAdvice = generateRelationshipAdvice(
    initiatorType,
    participantType,
    dimensionAnalysis
  );

  return {
    overallScore,
    compatibilityLevel,
    conflictWarnings,
    relationshipAdvice,
    dimensionAnalysis,
  };
}

/**
 * Extract dimension scores from test answers
 */
function extractDimensionScores(answers: any): { E: number; N: number; T: number; J: number } {
  // Handle different answer formats
  if (answers.dimensionScores) {
    return answers.dimensionScores;
  }

  // If answers are raw scores (0-100 for each dimension)
  return {
    E: answers.E || 50,
    N: answers.N || 50,
    T: answers.T || 50,
    J: answers.J || 50,
  };
}

/**
 * Calculate compatibility for each dimension
 */
function calculateDimensionCompatibility(
  initiator: { E: number; N: number; T: number; J: number },
  participant: { E: number; N: number; T: number; J: number }
): DimensionCompatibility[] {
  const dimensions = [
    { key: 'E', name: '外向 - 内向', description: '能量来源与社交方式' },
    { key: 'N', name: '直觉 - 感觉', description: '信息获取方式' },
    { key: 'T', name: '思考 - 情感', description: '决策方式' },
    { key: 'J', name: '判断 - 感知', description: '生活方式' },
  ];

  return dimensions.map(dim => {
    const initiatorScore = initiator[dim.key as keyof typeof initiator];
    const participantScore = participant[dim.key as keyof typeof participant];
    const difference = Math.abs(initiatorScore - participantScore);

    // Calculate compatibility for this dimension
    let compatibility: string;
    if (difference <= 15) {
      compatibility = 'highly_compatible';
    } else if (difference <= 30) {
      compatibility = 'compatible';
    } else if (difference <= 50) {
      compatibility = 'moderate';
    } else {
      compatibility = 'challenging';
    }

    return {
      dimension: dim.key,
      dimensionName: dim.name,
      initiatorScore,
      participantScore,
      difference,
      compatibility,
      description: getDimensionDescription(dim.key, initiatorScore, participantScore, dim.description),
    };
  });
}

/**
 * Calculate overall compatibility score
 */
function calculateOverallScore(
  dimensionAnalysis: DimensionCompatibility[],
  initiatorType: string,
  participantType: string
): number {
  // Base score from dimension compatibility
  const dimensionScores = dimensionAnalysis.map(d => {
    switch (d.compatibility) {
      case 'highly_compatible': return 1.0;
      case 'compatible': return 0.8;
      case 'moderate': return 0.6;
      case 'challenging': return 0.4;
      default: return 0.5;
    }
  });

  const avgDimensionScore = dimensionScores.reduce((a, b) => a + b, 0) / dimensionScores.length;

  // Type interaction bonus/penalty
  const typeInteractionBonus = getTypeInteractionBonus(initiatorType, participantType);

  // Calculate final score (weighted average)
  const overallScore = avgDimensionScore * 0.7 + typeInteractionBonus * 0.3;

  // Clamp to 0-1 range
  return Math.max(0, Math.min(1, overallScore));
}

/**
 * Get compatibility bonus based on MBTI type interactions
 * Based on psychological research on type dynamics
 */
function getTypeInteractionBonus(type1: string, type2: string): number {
  // Complementary types (share some preferences, differ on others)
  const complementaryPairs = [
    ['INFJ', 'ENFP'], ['INTJ', 'ENTP'], ['INFP', 'ENFJ'], ['INTP', 'ENTJ'],
    ['ISFJ', 'ESFP'], ['ISTJ', 'ESTP'], ['ISFP', 'ESFJ'], ['ISTP', 'ESTJ'],
  ];

  // Similar types (strong understanding, potential echo chamber)
  const similarTypes = type1 === type2;

  // Check for complementary pairing
  for (const [t1, t2] of complementaryPairs) {
    if ((type1 === t1 && type2 === t2) || (type1 === t2 && type2 === t1)) {
      return 0.95; // Excellent match
    }
  }

  // Same type
  if (similarTypes) {
    return 0.85; // Very good, but may lack growth opportunities
  }

  // Check for opposite types (all dimensions different)
  const oppositeMap: { [key: string]: string } = {
    'INFJ': 'ESTP', 'ENFP': 'ISTJ', 'INTJ': 'ESFP', 'ENTP': 'ISFJ',
    'INFP': 'ESTJ', 'ENFJ': 'ISTP', 'INTP': 'ESFJ', 'ENTJ': 'ISFP',
  };

  if (oppositeMap[type1] === type2 || oppositeMap[type2] === type1) {
    return 0.65; // Challenging but growth-oriented
  }

  // Default moderate compatibility
  return 0.75;
}

/**
 * Get compatibility level from score
 */
function getCompatibilityLevel(score: number): 'excellent' | 'good' | 'moderate' | 'challenging' {
  if (score >= 0.85) return 'excellent';
  if (score >= 0.70) return 'good';
  if (score >= 0.55) return 'moderate';
  return 'challenging';
}

/**
 * Generate conflict warnings based on dimension differences
 */
function generateConflictWarnings(dimensionAnalysis: DimensionCompatibility[]): ConflictWarning[] {
  const warnings: ConflictWarning[] = [];

  dimensionAnalysis.forEach(dim => {
    if (dim.difference > 40) {
      warnings.push(createConflictWarning(dim));
    }
  });

  return warnings;
}

/**
 * Create a conflict warning for a dimension
 */
function createConflictWarning(dim: DimensionCompatibility): ConflictWarning {
  const level = dim.difference > 60 ? 'high' : dim.difference > 40 ? 'medium' : 'low';

  const warningMap: { [key: string]: { description: string; suggestion: string } } = {
    E: {
      description: '外向性差异较大，一方需要社交充电，另一方需要独处恢复',
      suggestion: '尊重彼此的能量来源，找到社交与独处的平衡点',
    },
    N: {
      description: '信息获取方式不同，一方关注可能性，一方关注现实细节',
      suggestion: '沟通时兼顾宏观愿景与具体实施，互相学习对方的视角',
    },
    T: {
      description: '决策方式差异，一方注重逻辑分析，一方注重情感价值',
      suggestion: '做决定时既考虑逻辑也考虑人情，欣赏不同的决策风格',
    },
    J: {
      description: '生活方式不同，一方喜欢计划有序，一方喜欢灵活随性',
      suggestion: '在重要事项上制定计划，同时保留一定的灵活性',
    },
  };

  const warning = warningMap[dim.dimension] || {
    description: '该维度存在较大差异',
    suggestion: '理解并尊重彼此的差异',
  };

  return {
    dimension: getDimensionName(dim.dimension),
    level,
    description: warning.description,
    suggestion: warning.suggestion,
  };
}

/**
 * Generate relationship advice based on types and compatibility
 */
function generateRelationshipAdvice(
  initiatorType: string,
  participantType: string,
  dimensionAnalysis: DimensionCompatibility[]
): RelationshipAdvice[] {
  const advice: RelationshipAdvice[] = [];

  // General communication advice
  advice.push({
    category: '沟通方式',
    advice: getCommunicationAdvice(initiatorType, participantType),
    example: '当出现分歧时，先倾听对方的观点，再表达自己的想法',
  });

  // Conflict resolution advice
  advice.push({
    category: '冲突处理',
    advice: getConflictResolutionAdvice(dimensionAnalysis),
    example: '冷静后再讨论，避免在情绪激动时做决定',
  });

  // Growth opportunities
  advice.push({
    category: '成长机会',
    advice: getGrowthAdvice(initiatorType, participantType),
    example: '学习对方的优势，拓展自己的能力边界',
  });

  // Shared activities
  advice.push({
    category: '共同活动',
    advice: getActivityAdvice(initiatorType, participantType),
    example: '一起尝试新事物，创造共同回忆',
  });

  return advice;
}

/**
 * Get communication advice based on types
 */
function getCommunicationAdvice(type1: string, type2: string): string {
  // Check if one is introvert and one is extravert
  const e1 = ['E', 'N', 'T', 'J'].some(d => type1.includes(d));
  
  const adviceMap: { [key: string]: string } = {
    'I-E': '内向者需要时间思考，外向者喜欢即时交流。给彼此适应的空间',
    'N-S': '直觉型关注可能性，感觉型关注现实。沟通时兼顾愿景与细节',
    'T-F': '思考型注重逻辑，情感型注重价值。表达时既讲道理也讲感受',
    'J-P': '判断型喜欢计划，感知型喜欢灵活。重要事项提前沟通',
  };

  // Simplified logic - in production, use more sophisticated type analysis
  return '理解并尊重彼此的沟通风格，找到双方都舒适的交流方式';
}

/**
 * Get conflict resolution advice
 */
function getConflictResolutionAdvice(dimensionAnalysis: DimensionCompatibility[]): string {
  const challengingDimensions = dimensionAnalysis.filter(d => d.compatibility === 'challenging');

  if (challengingDimensions.length > 2) {
    return '你们在多个维度存在差异，冲突时更容易误解对方。建议建立"暂停机制"，情绪激动时先冷静';
  }

  if (challengingDimensions.length > 0) {
    return `你们在${challengingDimensions.map(d => getDimensionName(d.dimension)).join('、')}方面存在差异，这些可能是冲突的来源。提前讨论这些话题的处理方式`;
  }

  return '你们的兼容性较好，但仍需记住：差异不是对错，而是互补的机会';
}

/**
 * Get growth advice
 */
function getGrowthAdvice(type1: string, type2: string): string {
  return '每个人都有独特的优势和挑战。通过对方，你可以看到世界的另一面，拓展自己的认知边界';
}

/**
 * Get activity advice
 */
function getActivityAdvice(type1: string, type2: string): string {
  // Check if both are introverts or extraverts
  const isIntrovert = (type: string) => type[0] === 'I';
  
  if (isIntrovert(type1) && isIntrovert(type2)) {
    return '你们都偏好安静的活动，可以一起读书、看电影、深度交流';
  }

  if (!isIntrovert(type1) && !isIntrovert(type2)) {
    return '你们都精力充沛，可以一起参加社交活动、运动、探索新地方';
  }

  return '一个喜欢安静，一个喜欢热闹。可以轮流选择活动，或找到平衡点（如小聚）';
}

/**
 * Get dimension name
 */
function getDimensionName(key: string): string {
  const names: { [key: string]: string } = {
    E: '外向 - 内向',
    N: '直觉 - 感觉',
    T: '思考 - 情感',
    J: '判断 - 感知',
  };
  return names[key] || key;
}

/**
 * Get dimension description based on scores
 */
function getDimensionDescription(
  dimension: string,
  score1: number,
  score2: number,
  baseDescription: string
): string {
  const getPreference = (score: number): string => {
    if (score >= 60) return '明显偏好正向';
    if (score >= 50) return '轻微偏好正向';
    if (score >= 40) return '轻微偏好反向';
    return '明显偏好反向';
  };

  return `${baseDescription}。一方${getPreference(score1)}，另一方${getPreference(score2)}`;
}

export default {
  analyzeCompatibility,
};
