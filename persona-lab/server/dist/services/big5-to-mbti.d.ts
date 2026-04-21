/**
 * Big Five to MBTI Mapping Service
 * 基于 IPIP-NEO 五维度得分映射到 MBTI 类型
 * 使用统计学方法计算各维度倾向和置信度
 */
import { MBTIResult } from '../types';
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
export declare function mapBig5ToMBTI(O: number, // 开放性 0-100
C: number, // 尽责性 0-100
E: number, // 外向性 0-100
A: number, // 宜人性 0-100
N: number): MBTIResult;
/**
 * 获取维度倾向描述
 */
export declare function getDimensionDescription(dimension: keyof MBTIResult['dimensions'], value: string): string;
/**
 * 获取类型详细解释
 */
export declare function getTypeExplanation(type: string): string;
/**
 * 计算类型匹配度
 * 用于比较两个 MBTI 类型的相似程度
 */
export declare function calculateTypeSimilarity(type1: string, type2: string): number;
export default mapBig5ToMBTI;
//# sourceMappingURL=big5-to-mbti.d.ts.map