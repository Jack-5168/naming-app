/**
 * Membership Benefits Service
 * Phase 4: 会员权益管理系统
 * 
 * Handles benefit validation, usage tracking, and expiration logic
 */

import { PrismaClient, MembershipLevel, MembershipStatus } from '@prisma/client';
import {
  MembershipTier,
  MEMBERSHIP_TIERS,
  BenefitLimits,
  getTierConfig,
  isUnlimited,
  getBenefitLimit,
} from '../models/membership-tier';

const prisma = new PrismaClient();

// ==================== Types ====================

export interface UserMembership {
  userId: number;
  tier: MembershipTier;
  status: MembershipStatus;
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
}

export interface BenefitUsage {
  benefit: keyof BenefitLimits;
  used: number;
  limit: number | 'unlimited';
  remaining: number | 'unlimited';
  resetDate?: Date;
}

export interface CheckBenefitResult {
  allowed: boolean;
  reason?: string;
  remaining?: number | 'unlimited';
  resetDate?: Date;
}

// ==================== Membership Status Management ====================

/**
 * Get current user's membership status
 */
export async function getUserMembership(userId: number): Promise<UserMembership | null> {
  const membership = await prisma.membership.findUnique({
    where: { userId },
  });

  if (!membership) {
    return null;
  }

  // Check if expired
  const now = new Date();
  if (membership.endDate < now && membership.status === 'active') {
    // Auto-downgrade expired membership
    await prisma.membership.update({
      where: { id: membership.id },
      data: { status: 'expired' },
    });
    return null;
  }

  if (membership.status !== 'active') {
    return null;
  }

  // Map Prisma MembershipLevel to our MembershipTier
  const tierMap: Record<MembershipLevel, MembershipTier> = {
    free: MembershipTier.FREE,
    basic: MembershipTier.BASIC,
    pro: MembershipTier.PRO_MONTHLY,
    premium: MembershipTier.PRO_YEARLY,
  };

  return {
    userId,
    tier: tierMap[membership.level as MembershipLevel] || MembershipTier.FREE,
    status: membership.status,
    startDate: membership.startDate,
    endDate: membership.endDate,
    autoRenew: membership.autoRenew,
  };
}

/**
 * Get effective membership tier (handles expired memberships)
 */
export async function getEffectiveTier(userId: number): Promise<MembershipTier> {
  const membership = await getUserMembership(userId);
  
  if (!membership) {
    return MembershipTier.FREE;
  }
  
  return membership.tier;
}

// ==================== Benefit Validation ====================

/**
 * Check if user can use a specific benefit
 */
export async function checkBenefitAccess(
  userId: number,
  benefit: keyof BenefitLimits
): Promise<CheckBenefitResult> {
  const membership = await getUserMembership(userId);
  const tier = membership?.tier || MembershipTier.FREE;
  
  const tierConfig = getTierConfig(tier);
  if (!tierConfig) {
    return {
      allowed: false,
      reason: 'Invalid membership tier',
    };
  }

  const limit = tierConfig.benefits[benefit];
  
  // Check if unlimited
  if (limit === 'unlimited') {
    return {
      allowed: true,
      remaining: 'unlimited',
    };
  }

  // Check if benefit is not included (limit = 0)
  if (limit === 0) {
    return {
      allowed: false,
      reason: 'Benefit not included in current tier',
      remaining: 0,
    };
  }

  // Check usage count
  const usage = await getBenefitUsage(userId, benefit, membership);
  const remaining = limit - usage;

  if (usage >= limit) {
    return {
      allowed: false,
      reason: 'Benefit limit reached',
      remaining: 0,
      resetDate: getResetDate(tier, benefit, membership),
    };
  }

  return {
    allowed: true,
    remaining,
    resetDate: getResetDate(tier, benefit, membership),
  };
}

/**
 * Get current usage count for a benefit
 */
async function getBenefitUsage(
  userId: number,
  benefit: keyof BenefitLimits,
  membership: UserMembership | null
): Promise<number> {
  const now = new Date();
  
  // Determine the period start date based on membership type
  let periodStart: Date;
  
  if (!membership) {
    // Free tier - count from beginning
    periodStart = new Date(0);
  } else if (membership.tier === MembershipTier.PRO_MONTHLY) {
    // Monthly - reset every 30 days from start date
    const daysSinceStart = Math.floor(
      (now.getTime() - membership.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const cyclesCompleted = Math.floor(daysSinceStart / 30);
    periodStart = new Date(membership.startDate);
    periodStart.setDate(periodStart.getDate() + cyclesCompleted * 30);
  } else if (membership.tier === MembershipTier.PRO_YEARLY) {
    // Yearly - reset every 365 days from start date
    const daysSinceStart = Math.floor(
      (now.getTime() - membership.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const cyclesCompleted = Math.floor(daysSinceStart / 365);
    periodStart = new Date(membership.startDate);
    periodStart.setDate(periodStart.getDate() + cyclesCompleted * 365);
  } else {
    // One-time purchases - count from membership start
    periodStart = membership.startDate;
  }

  // Map benefit to database field name
  const benefitFieldMap: Record<keyof BenefitLimits, string> = {
    report_basic: 'report_basic',
    report_pro: 'report_pro',
    life_event: 'life_event',
    dual_test: 'dual_test',
    priority_support: 'priority_support',
  };

  const count = await prisma.usageRecord.count({
    where: {
      userId,
      feature: benefitFieldMap[benefit],
      consumedAt: {
        gte: periodStart,
      },
    },
  });

  return count;
}

/**
 * Get the reset date for a benefit
 */
function getResetDate(
  tier: MembershipTier,
  benefit: keyof BenefitLimits,
  membership: UserMembership | null
): Date | undefined {
  if (!membership) return undefined;

  const config = getTierConfig(tier);
  if (!config || config.durationDays === 0) {
    // One-time purchase - no reset
    return undefined;
  }

  if (tier === MembershipTier.PRO_MONTHLY) {
    // Monthly - reset every 30 days
    const nextReset = new Date(membership.startDate);
    const daysSinceStart = Math.floor(
      (new Date().getTime() - membership.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const cyclesCompleted = Math.floor(daysSinceStart / 30);
    nextReset.setDate(nextReset.getDate() + (cyclesCompleted + 1) * 30);
    return nextReset;
  }

  if (tier === MembershipTier.PRO_YEARLY) {
    // Yearly - reset every 365 days
    const nextReset = new Date(membership.startDate);
    const daysSinceStart = Math.floor(
      (new Date().getTime() - membership.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const cyclesCompleted = Math.floor(daysSinceStart / 365);
    nextReset.setDate(nextReset.getDate() + (cyclesCompleted + 1) * 365);
    return nextReset;
  }

  return membership.endDate;
}

// ==================== Usage Recording ====================

/**
 * Record benefit usage
 */
export async function recordBenefitUsage(
  userId: number,
  benefit: keyof BenefitLimits,
  metadata?: any
): Promise<void> {
  const benefitFieldMap: Record<keyof BenefitLimits, string> = {
    report_basic: 'report_basic',
    report_pro: 'report_pro',
    life_event: 'life_event',
    dual_test: 'dual_test',
    priority_support: 'priority_support',
  };

  await prisma.usageRecord.create({
    data: {
      userId,
      feature: benefitFieldMap[benefit],
      metadata: metadata || {},
    },
  });
}

/**
 * Get detailed benefit usage for user
 */
export async function getBenefitUsageDetails(
  userId: number
): Promise<BenefitUsage[]> {
  const membership = await getUserMembership(userId);
  const tier = membership?.tier || MembershipTier.FREE;
  const tierConfig = getTierConfig(tier);

  if (!tierConfig) {
    return [];
  }

  const benefits: BenefitUsage[] = [];
  const benefitKeys = Object.keys(tierConfig.benefits) as Array<keyof BenefitLimits>;

  for (const benefit of benefitKeys) {
    const limit = tierConfig.benefits[benefit];
    const used = await getBenefitUsage(userId, benefit, membership);
    const remaining =
      limit === 'unlimited' ? 'unlimited' : Math.max(0, limit - used);

    benefits.push({
      benefit,
      used,
      limit,
      remaining,
      resetDate: getResetDate(tier, benefit, membership),
    });
  }

  return benefits;
}

// ==================== Membership Lifecycle ====================

/**
 * Upgrade user's membership
 */
export async function upgradeMembership(
  userId: number,
  newTier: MembershipTier,
  productId: number,
  orderId: number
): Promise<UserMembership> {
  const tierConfig = getTierConfig(newTier);
  if (!tierConfig) {
    throw new Error('Invalid membership tier');
  }

  const now = new Date();
  const endDate =
    tierConfig.durationDays > 0
      ? new Date(now.getTime() + tierConfig.durationDays * 24 * 60 * 60 * 1000)
      : now;

  // Map our tier to Prisma level
  const levelMap: Record<MembershipTier, MembershipLevel> = {
    [MembershipTier.FREE]: 'free',
    [MembershipTier.BASIC]: 'basic',
    [MembershipTier.PRO_REPORT]: 'pro',
    [MembershipTier.PRO_MONTHLY]: 'pro',
    [MembershipTier.PRO_YEARLY]: 'premium',
    [MembershipTier.DUAL_TEST]: 'basic',
  };

  // Check if user has existing membership
  const existingMembership = await prisma.membership.findUnique({
    where: { userId },
  });

  let membership: UserMembership;

  if (existingMembership && existingMembership.status === 'active') {
    // Extend existing membership
    const newEndDate =
      tierConfig.durationDays > 0
        ? new Date(existingMembership.endDate.getTime() + tierConfig.durationDays * 24 * 60 * 60 * 1000)
        : existingMembership.endDate;

    const updated = await prisma.membership.update({
      where: { userId },
      data: {
        level: levelMap[newTier],
        endDate: newEndDate,
        status: 'active',
      },
    });

    membership = {
      userId,
      tier: newTier,
      status: updated.status,
      startDate: updated.startDate,
      endDate: updated.endDate,
      autoRenew: updated.autoRenew,
    };
  } else {
    // Create new membership
    const created = await prisma.membership.create({
      data: {
        userId,
        level: levelMap[newTier],
        status: 'active',
        startDate: now,
        endDate,
        autoRenew: false,
      },
    });

    membership = {
      userId,
      tier: newTier,
      status: created.status,
      startDate: created.startDate,
      endDate: created.endDate,
      autoRenew: created.autoRenew,
    };
  }

  // Link order to membership
  await prisma.order.update({
    where: { id: orderId },
    data: { membershipId: membership.userId }, // Note: adjust based on actual schema
  });

  return membership;
}

/**
 * Downgrade user's membership (at end of billing period)
 */
export async function downgradeMembership(
  userId: number,
  newTier: MembershipTier = MembershipTier.FREE
): Promise<void> {
  const tierConfig = getTierConfig(newTier);
  if (!tierConfig) {
    throw new Error('Invalid membership tier');
  }

  const levelMap: Record<MembershipTier, MembershipLevel> = {
    [MembershipTier.FREE]: 'free',
    [MembershipTier.BASIC]: 'basic',
    [MembershipTier.PRO_REPORT]: 'pro',
    [MembershipTier.PRO_MONTHLY]: 'pro',
    [MembershipTier.PRO_YEARLY]: 'premium',
    [MembershipTier.DUAL_TEST]: 'basic',
  };

  await prisma.membership.update({
    where: { userId },
    data: {
      level: levelMap[newTier],
      autoRenew: false,
    },
  });
}

/**
 * Process membership expiration
 */
export async function processExpiredMemberships(): Promise<number> {
  const now = new Date();

  // Find all expired active memberships
  const expiredMemberships = await prisma.membership.findMany({
    where: {
      status: 'active',
      endDate: {
        lt: now,
      },
    },
  });

  let count = 0;

  for (const membership of expiredMemberships) {
    // Downgrade to free tier
    await prisma.membership.update({
      where: { id: membership.id },
      data: {
        status: 'expired',
        level: 'free',
      },
    });

    // TODO: Send expiration notification
    count++;
  }

  return count;
}

/**
 * Check if membership is expiring soon
 */
export async function checkExpiringMemberships(daysThreshold: number = 7): Promise<number[]> {
  const now = new Date();
  const thresholdDate = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);

  const expiringMemberships = await prisma.membership.findMany({
    where: {
      status: 'active',
      endDate: {
        gte: now,
        lte: thresholdDate,
      },
    },
    select: {
      userId: true,
    },
  });

  return expiringMemberships.map(m => m.userId);
}

// ==================== Mock Payment Integration ====================

/**
 * Mock payment processing (for development)
 * In production, replace with actual payment gateway integration
 */
export async function processMockPayment(
  userId: number,
  productId: number,
  tier: MembershipTier
): Promise<{ success: boolean; orderId?: number; transactionId?: string }> {
  // Generate mock order
  const orderNo = `ORD${Date.now()}${Math.random().toString(36).substr(2, 6)}`;
  const tierConfig = getTierConfig(tier);

  if (!tierConfig) {
    return { success: false };
  }

  // Create order in database
  const order = await prisma.order.create({
    data: {
      orderNo,
      userId,
      productId,
      productType: 'membership',
      amount: tierConfig.price,
      currency: 'CNY',
      status: 'paid', // Mock: auto-success
      paymentMethod: 'mock',
      paidAt: new Date(),
    },
  });

  return {
    success: true,
    orderId: order.id,
    transactionId: order.transactionId || `TXN${Date.now()}`,
  };
}

// Export for use in controllers
export default {
  getUserMembership,
  getEffectiveTier,
  checkBenefitAccess,
  recordBenefitUsage,
  getBenefitUsageDetails,
  upgradeMembership,
  downgradeMembership,
  processExpiredMemberships,
  checkExpiringMemberships,
  processMockPayment,
};
