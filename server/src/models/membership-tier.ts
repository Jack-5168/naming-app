/**
 * Membership Tier Model
 * Phase 4: 会员权益管理系统
 * 
 * Defines 6 membership tiers with their benefits and pricing
 */

// ==================== Membership Tier Enum ====================

export enum MembershipTier {
  FREE = 'FREE',              // 免费版
  BASIC = 'BASIC',            // 基础报告
  PRO_REPORT = 'PRO_REPORT',  // 专业报告
  PRO_MONTHLY = 'PRO_MONTHLY', // 月会员
  PRO_YEARLY = 'PRO_YEARLY',   // 年会员
  DUAL_TEST = 'DUAL_TEST',    // 双人合测
}

// ==================== Benefits Configuration ====================

export interface BenefitLimits {
  report_basic: number | 'unlimited';    // 基础报告次数
  report_pro: number | 'unlimited';      // 专业报告次数
  life_event: number | 'unlimited';      // 生活事件次数
  dual_test: number | 'unlimited';       // 双人合测次数
  priority_support: boolean;             // 优先支持
}

export interface MembershipTierConfig {
  tier: MembershipTier;
  name: string;
  nameEn: string;
  price: number;              // 价格（分）
  priceDisplay: string;       // 价格显示
  durationDays: number;       // 有效期（0 为永久）
  billingCycle?: 'once' | 'monthly' | 'yearly'; // 计费周期
  benefits: BenefitLimits;
  features: string[];         // 特性列表
  sortOrder: number;          // 排序顺序
  isPopular?: boolean;        // 是否热门推荐
}

// ==================== 6 档会员权益配置 ====================

export const MEMBERSHIP_TIERS: Record<MembershipTier, MembershipTierConfig> = {
  [MembershipTier.FREE]: {
    tier: MembershipTier.FREE,
    name: '免费版',
    nameEn: 'Free',
    price: 0,
    priceDisplay: '¥0',
    durationDays: 0,
    billingCycle: 'once',
    benefits: {
      report_basic: 1,
      report_pro: 0,
      life_event: 5,
      dual_test: 0,
      priority_support: false,
    },
    features: [
      '1 次基础报告',
      '5 次生活事件',
      '基础人格分析',
      '四维得分详情',
    ],
    sortOrder: 0,
  },
  [MembershipTier.BASIC]: {
    tier: MembershipTier.BASIC,
    name: '基础报告',
    nameEn: 'Basic Report',
    price: 990, // ¥9.9
    priceDisplay: '¥9.9',
    durationDays: 0,
    billingCycle: 'once',
    benefits: {
      report_basic: 1,
      report_pro: 0,
      life_event: 5,
      dual_test: 0,
      priority_support: false,
    },
    features: [
      '解锁完整人格报告',
      '查看四维得分详情',
      '基础发展建议',
      '5 次生活事件',
    ],
    sortOrder: 1,
  },
  [MembershipTier.PRO_REPORT]: {
    tier: MembershipTier.PRO_REPORT,
    name: '专业报告',
    nameEn: 'Pro Report',
    price: 2900, // ¥29
    priceDisplay: '¥29',
    durationDays: 0,
    billingCycle: 'once',
    benefits: {
      report_basic: 'unlimited',
      report_pro: 1,
      life_event: 10,
      dual_test: 0,
      priority_support: false,
    },
    features: [
      '无限次基础报告',
      '1 次专业报告',
      '10 次生活事件',
      '职业匹配分析',
      '人际关系指南',
      '压力管理建议',
    ],
    sortOrder: 2,
    isPopular: true,
  },
  [MembershipTier.PRO_MONTHLY]: {
    tier: MembershipTier.PRO_MONTHLY,
    name: '月会员',
    nameEn: 'Pro Monthly',
    price: 4900, // ¥49/月
    priceDisplay: '¥49/月',
    durationDays: 30,
    billingCycle: 'monthly',
    benefits: {
      report_basic: 'unlimited',
      report_pro: 3,
      life_event: 'unlimited',
      dual_test: 1,
      priority_support: false,
    },
    features: [
      '无限次基础报告',
      '3 次专业报告/月',
      '无限次生活事件',
      '1 次双人合测/月',
      '成长任务系统',
      '月度专属报告',
    ],
    sortOrder: 3,
  },
  [MembershipTier.PRO_YEARLY]: {
    tier: MembershipTier.PRO_YEARLY,
    name: '年会员',
    nameEn: 'Pro Yearly',
    price: 19900, // ¥199/年
    priceDisplay: '¥199/年',
    durationDays: 365,
    billingCycle: 'yearly',
    benefits: {
      report_basic: 'unlimited',
      report_pro: 'unlimited',
      life_event: 'unlimited',
      dual_test: 3,
      priority_support: true,
    },
    features: [
      '无限次基础报告',
      '无限次专业报告',
      '无限次生活事件',
      '3 次双人合测/年',
      '优先客户支持',
      '专属成长顾问',
      '年度深度报告',
      '最早体验新功能',
    ],
    sortOrder: 4,
    isPopular: true,
  },
  [MembershipTier.DUAL_TEST]: {
    tier: MembershipTier.DUAL_TEST,
    name: '双人合测',
    nameEn: 'Dual Test',
    price: 9900, // ¥99
    priceDisplay: '¥99',
    durationDays: 0,
    billingCycle: 'once',
    benefits: {
      report_basic: 'unlimited',
      report_pro: 2,
      life_event: 'unlimited',
      dual_test: 1,
      priority_support: false,
    },
    features: [
      '无限次基础报告',
      '2 次专业报告',
      '无限次生活事件',
      '1 次双人合测',
      '关系匹配分析',
      '相处建议报告',
    ],
    sortOrder: 5,
  },
};

// ==================== Helper Functions ====================

/**
 * Get all membership tiers as array (sorted)
 */
export function getAllTiers(): MembershipTierConfig[] {
  return Object.values(MEMBERSHIP_TIERS).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
}

/**
 * Get tier config by tier enum
 */
export function getTierConfig(tier: MembershipTier): MembershipTierConfig {
  return MEMBERSHIP_TIERS[tier];
}

/**
 * Check if a benefit is unlimited
 */
export function isUnlimited(
  tier: MembershipTier,
  benefit: keyof BenefitLimits
): boolean {
  const config = MEMBERSHIP_TIERS[tier];
  if (!config) return false;
  
  const limit = config.benefits[benefit];
  return limit === 'unlimited';
}

/**
 * Get benefit limit for a tier
 */
export function getBenefitLimit(
  tier: MembershipTier,
  benefit: keyof BenefitLimits
): number {
  const config = MEMBERSHIP_TIERS[tier];
  if (!config) return 0;
  
  const limit = config.benefits[benefit];
  return limit === 'unlimited' ? Number.MAX_SAFE_INTEGER : limit;
}

/**
 * Check if tier has priority support
 */
export function hasPrioritySupport(tier: MembershipTier): boolean {
  const config = MEMBERSHIP_TIERS[tier];
  return config?.benefits.priority_support ?? false;
}

/**
 * Calculate price per use (approximate)
 */
export function getPricePerUse(tier: MembershipTier): number {
  const config = MEMBERSHIP_TIERS[tier];
  if (!config || config.price === 0) return 0;
  
  // Simplified calculation - assumes average usage
  const estimatedUses = 10; // Assume 10 uses on average
  return config.price / estimatedUses;
}

/**
 * Get upgrade path (which tiers can upgrade to which)
 */
export function getUpgradePath(fromTier: MembershipTier): MembershipTier[] {
  const tierOrder = [
    MembershipTier.FREE,
    MembershipTier.BASIC,
    MembershipTier.PRO_REPORT,
    MembershipTier.PRO_MONTHLY,
    MembershipTier.PRO_YEARLY,
  ];
  
  const fromIndex = tierOrder.indexOf(fromTier);
  if (fromIndex === -1) return [];
  
  return tierOrder.slice(fromIndex + 1);
}

/**
 * Check if one tier is higher than another
 */
export function isHigherTier(
  higher: MembershipTier,
  lower: MembershipTier
): boolean {
  const tierOrder = [
    MembershipTier.FREE,
    MembershipTier.BASIC,
    MembershipTier.PRO_REPORT,
    MembershipTier.PRO_MONTHLY,
    MembershipTier.PRO_YEARLY,
  ];
  
  const higherIndex = tierOrder.indexOf(higher);
  const lowerIndex = tierOrder.indexOf(lower);
  
  if (higherIndex === -1 || lowerIndex === -1) return false;
  
  return higherIndex > lowerIndex;
}

// Export for use in other modules
export default {
  MembershipTier,
  MEMBERSHIP_TIERS,
  getAllTiers,
  getTierConfig,
  isUnlimited,
  getBenefitLimit,
  hasPrioritySupport,
  getPricePerUse,
  getUpgradePath,
  isHigherTier,
};
