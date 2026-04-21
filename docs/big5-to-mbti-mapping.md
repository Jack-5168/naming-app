# 大五人格（OCEAN）→ MBTI 映射算法

## 理论基础

大五人格（Five Factor Model, FFM）与 MBTI 的对应关系基于以下学术共识：

| 大五维度 | MBTI 维度 | 映射逻辑 |
|----------|-----------|----------|
| O 开放性 | N/S 直觉/实感 | 高 O → N 型（抽象、概念导向）；低 O → S 型（具体、经验导向） |
| C 尽责性 | J/P 判断/知觉 | 高 C → J 型（计划、组织）；低 C → P 型（灵活、自发） |
| E 外向性 | E/I 外向/内向 | 高 E → E 型；低 E → I 型 |
| A 宜人性 | F/T 情感/思维 | 高 A → F 型（人际和谐）；低 A → T 型（逻辑客观） |
| N 神经质 | - | 不用于类型判定，作为情绪稳定性指标单独报告 |

## 计分标准化

原始分（12-60）需转换为标准分（0-100）后进行类型判定：

```typescript
/**
 * 将原始分转换为百分制标准分
 * @param rawScore 原始分（12-60）
 * @param min 理论最小值（12）
 * @param max 理论最大值（60）
 * @returns 标准分（0-100）
 */
function normalizeScore(rawScore: number, min: number = 12, max: number = 60): number {
  return ((rawScore - min) / (max - min)) * 100;
}
```

## 映射算法实现

```typescript
/**
 * 大五→MBTI 映射接口
 */
interface Big5ToMBTIMapping {
  /**
   * O(开放性) → N/S(直觉/实感)
   * 高 O → N 型，低 O → S 型
   * 临界点：55-60 分区间为灰色地带
   */
  opennessToNS: (score: number) => 'N' | 'S';
  
  /**
   * C(尽责性) → J/P(判断/知觉)
   * 高 C → J 型，低 C → P 型
   */
  conscientiousnessToJP: (score: number) => 'J' | 'P';
  
  /**
   * E(外向性) → E/I(外向/内向)
   * 高 E → E 型，低 E → I 型
   */
  extraversionToEI: (score: number) => 'E' | 'I';
  
  /**
   * A(宜人性) → F/T(情感/思维)
   * 高 A → F 型，低 A → T 型
   */
  agreeablenessToFT: (score: number) => 'F' | 'T';
  
  /**
   * N(神经质) → 情绪稳定性指标（不用于类型判定）
   * 返回 0-100 的情绪不稳定程度
   */
  neuroticismToStability: (score: number) => number;
}

/**
 * 大五人格分数接口
 */
interface Big5Scores {
  openness: number;       // O 开放性 (12-60)
  conscientiousness: number; // C 尽责性 (12-60)
  extraversion: number;   // E 外向性 (12-60)
  agreeableness: number;  // A 宜人性 (12-60)
  neuroticism: number;    // N 神经质 (12-60)
}

/**
 * MBTI 类型结果
 */
interface MBTIResult {
  type: string;           // 四字母类型，如 "INTJ"
  dimensions: {
    EI: 'E' | 'I';
    SN: 'S' | 'N';
    TF: 'T' | 'F';
    JP: 'J' | 'P';
  };
  confidence: {
    EI: number;           // 各维度确信度 0-1
    SN: number;
    TF: number;
    JP: number;
  };
  stability: number;      // 情绪稳定性 0-100（越高越稳定）
  description: string;
}

/**
 * 大五→MBTI 映射实现
 */
const big5ToMBTI: Big5ToMBTIMapping = {
  opennessToNS: (score: number): 'N' | 'S' => {
    const normalized = normalizeScore(score);
    // 临界点设为 50，但 45-55 为灰色地带
    if (normalized >= 55) return 'N';
    if (normalized <= 45) return 'S';
    // 灰色地带：根据分数倾向判定
    return normalized > 50 ? 'N' : 'S';
  },
  
  conscientiousnessToJP: (score: number): 'J' | 'P' => {
    const normalized = normalizeScore(score);
    if (normalized >= 55) return 'J';
    if (normalized <= 45) return 'P';
    return normalized > 50 ? 'J' : 'P';
  },
  
  extraversionToEI: (score: number): 'E' | 'I' => {
    const normalized = normalizeScore(score);
    if (normalized >= 55) return 'E';
    if (normalized <= 45) return 'I';
    return normalized > 50 ? 'E' : 'I';
  },
  
  agreeablenessToFT: (score: number): 'F' | 'T' => {
    const normalized = normalizeScore(score);
    if (normalized >= 55) return 'F';
    if (normalized <= 45) return 'T';
    return normalized > 50 ? 'F' : 'T';
  },
  
  neuroticismToStability: (score: number): number => {
    const normalized = normalizeScore(score);
    // 神经质越高，情绪稳定性越低
    return 100 - normalized;
  }
};

/**
 * 完整映射函数
 */
function mapBig5ToMBTI(scores: Big5Scores): MBTIResult {
  const EI = big5ToMBTI.extraversionToEI(scores.extraversion);
  const SN = big5ToMBTI.opennessToNS(scores.openness);
  const TF = big5ToMBTI.agreeablenessToFT(scores.agreeableness);
  const JP = big5ToMBTI.conscientiousnessToJP(scores.conscientiousness);
  
  // 计算各维度确信度（偏离 50 分的程度）
  const calcConfidence = (score: number): number => {
    const normalized = normalizeScore(score);
    return Math.abs(normalized - 50) / 50; // 0-1 范围
  };
  
  const type = `${EI}${SN}${TF}${JP}`;
  
  return {
    type,
    dimensions: { EI, SN: SN === 'N' ? 'N' : 'S', TF, JP },
    confidence: {
      EI: calcConfidence(scores.extraversion),
      SN: calcConfidence(scores.openness),
      TF: calcConfidence(scores.agreeableness),
      JP: calcConfidence(scores.conscientiousness)
    },
    stability: big5ToMBTI.neuroticismToStability(scores.neuroticism),
    description: getMBTIDescription(type)
  };
}

/**
 * MBTI 类型描述（简化版）
 */
function getMBTIDescription(type: string): string {
  const descriptions: Record<string, string> = {
    'INTJ': '建筑师 - 富有想象力和战略性的思想家',
    'INTP': '逻辑学家 - 创新的发明家，对知识有无尽渴望',
    'ENTJ': '指挥官 - 大胆、富有想象力的强大领导者',
    'ENTP': '辩论家 - 聪明好奇的思想者，无法抗拒智力挑战',
    'INFJ': '提倡者 - 安静而神秘，同时鼓舞人心',
    'INFP': '调停者 - 诗意、善良的利他主义者',
    'ENFJ': '主人公 - 富有魅力、鼓舞人心的领导者',
    'ENFP': '竞选者 - 热情、有创造力、爱社交的自由精神',
    'ISTJ': '物流师 - 实用、注重事实、可靠',
    'ISFJ': '守卫者 - 非常专注、温暖的守护者',
    'ESTJ': '总经理 - 出色的管理者，管理事务或人员',
    'ESFJ': '执政官 - 极有同情心、受欢迎、热心',
    'ISTP': '鉴赏家 - 大胆而实际的实验家',
    'ISFP': '探险家 - 有魅力、随时准备探索新鲜事物',
    'ESTP': '企业家 - 聪明、精力充沛、善于感知',
    'ESFP': '表演者 - 自发的、精力充沛的表演者'
  };
  return descriptions[type] || '未知类型';
}

// 导出
export { big5ToMBTI, mapBig5ToMBTI, normalizeScore };
export type { Big5Scores, MBTIResult, Big5ToMBTIMapping };
```

## 使用说明

### 1. 分数解释

| 标准分范围 | 解释 | 类型倾向 |
|------------|------|----------|
| 0-35 | 非常低 | 强烈倾向一端 |
| 36-45 | 低 | 倾向一端 |
| 46-54 | 中等 | 灰色地带，需结合其他信息 |
| 55-64 | 高 | 倾向另一端 |
| 65-100 | 非常高 | 强烈倾向另一端 |

### 2. 灰色地带处理

当分数在 45-55 区间时：
- 标记为"中间型"
- 建议结合具体情境判断
- 可在报告中显示双倾向

### 3. 情绪稳定性报告

神经质维度不用于类型判定，但作为重要参考：
- 稳定性 0-30：情绪波动较大，建议关注压力管理
- 稳定性 31-60：中等水平
- 稳定性 61-100：情绪稳定，抗压能力强

## 学术依据

1. **O-N/S 映射**: McCrae & Costa (1989) 发现开放性与直觉型高度相关 (r=0.57)
2. **C-J/P 映射**: 尽责性与判断型相关 (r=0.48)
3. **E-E/I 映射**: 外向性与外向型高度相关 (r=0.73)
4. **A-F/T 映射**: 宜人性与情感型相关 (r=0.42)

## 注意事项

⚠️ **重要提示**:
1. 此映射为近似转换，不能完全替代正式 MBTI 测试
2. 大五人格是连续谱，MBTI 是类型论，本质不同
3. 灰色地带（45-55 分）应谨慎解释
4. 建议同时报告大五原始分和 MBTI 类型

## 参考文献

- McCrae, R. R., & Costa, P. T. (1989). Reinterpreting the Myers-Briggs Type Indicator from the perspective of the five-factor model of personality. *Journal of Personality, 57*(1), 17-40.
- Maples-Keller, J. L., et al. (2019). Using item response theory to develop a 60-item representation of the NEO PI-R. *Journal of Personality Assessment, 101*(1), 4-15.
