/**
 * Membership Controller v2 (v4.5)
 * Phase 4: 会员权益管理系统
 * 
 * API Endpoints:
 * - GET /api/v1/memberships/tiers - Get all membership tiers
 * - GET /api/v1/memberships/me - Get current user's membership
 * - GET /api/v1/memberships/benefits - Get benefit usage details
 * - POST /api/v1/memberships/upgrade - Upgrade membership (mock payment)
 * - POST /api/v1/memberships/check/:benefit - Check benefit access
 * - GET /api/v1/memberships/expiring - Get expiring memberships (admin)
 */

import { Request, Response } from 'express';
import {
  MembershipTier,
  MEMBERSHIP_TIERS,
  getAllTiers,
  getTierConfig,
} from '../models/membership-tier';
import {
  getUserMembership,
  getEffectiveTier,
  checkBenefitAccess,
  recordBenefitUsage,
  getBenefitUsageDetails,
  upgradeMembership,
  processMockPayment,
  processExpiredMemberships,
  checkExpiringMemberships,
} from '../services/membership-benefits';
import { createPushNotification } from '../services/push-notification';

// ==================== API Controllers ====================

/**
 * GET /api/v1/memberships/tiers
 * Get all available membership tiers with pricing and benefits
 */
export async function getMembershipTiers(req: Request, res: Response) {
  try {
    const tiers = getAllTiers().map((tier) => ({
      tier: tier.tier,
      name: tier.name,
      nameEn: tier.nameEn,
      price: tier.price,
      priceDisplay: tier.priceDisplay,
      priceCents: tier.price,
      durationDays: tier.durationDays,
      billingCycle: tier.billingCycle,
      benefits: tier.benefits,
      features: tier.features,
      isPopular: tier.isPopular || false,
      sortOrder: tier.sortOrder,
    }));

    res.json({
      success: true,
      data: tiers,
    });
  } catch (error) {
    console.error('Error fetching membership tiers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch membership tiers',
    });
  }
}

/**
 * GET /api/v1/memberships/me
 * Get current user's membership status and benefits
 */
export async function getCurrentMembership(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const membership = await getUserMembership(userId);
    const tier = membership?.tier || MembershipTier.FREE;
    const tierConfig = getTierConfig(tier);

    // Get benefit usage details
    const benefitUsage = await getBenefitUsageDetails(userId);

    res.json({
      success: true,
      data: {
        tier: tier,
        tierName: tierConfig?.name || '免费版',
        status: membership?.status || 'none',
        startDate: membership?.startDate || null,
        endDate: membership?.endDate || null,
        autoRenew: membership?.autoRenew || false,
        benefits: tierConfig?.benefits || {},
        usage: benefitUsage.map((b) => ({
          benefit: b.benefit,
          used: b.used,
          limit: b.limit,
          remaining: b.remaining,
          resetDate: b.resetDate,
        })),
        features: tierConfig?.features || [],
      },
    });
  } catch (error) {
    console.error('Error fetching current membership:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch membership',
    });
  }
}

/**
 * GET /api/v1/memberships/benefits
 * Get detailed benefit usage for current user
 */
export async function getMembershipBenefits(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const usage = await getBenefitUsageDetails(userId);

    res.json({
      success: true,
      data: {
        benefits: usage.map((b) => ({
          benefit: b.benefit,
          used: b.used,
          limit: b.limit,
          remaining: b.remaining,
          resetDate: b.resetDate,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching benefits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch benefits',
    });
  }
}

/**
 * POST /api/v1/memberships/upgrade
 * Upgrade user's membership (with mock payment)
 */
export async function upgradeMembership(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { tier, productId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    if (!tier || !MEMBERSHIP_TIERS[tier as MembershipTier]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid membership tier',
      });
    }

    const selectedTier = tier as MembershipTier;
    const tierConfig = getTierConfig(selectedTier);

    if (!tierConfig) {
      return res.status(400).json({
        success: false,
        error: 'Invalid membership tier configuration',
      });
    }

    // Process mock payment
    const paymentResult = await processMockPayment(
      userId,
      productId || 1,
      selectedTier
    );

    if (!paymentResult.success || !paymentResult.orderId) {
      return res.status(400).json({
        success: false,
        error: 'Payment processing failed',
      });
    }

    // Upgrade membership
    const membership = await upgradeMembership(
      userId,
      selectedTier,
      productId || 1,
      paymentResult.orderId
    );

    // Send push notification
    try {
      await createPushNotification({
        userId,
        type: 'membership_upgraded',
        title: '会员升级成功',
        content: `您已成功升级为${tierConfig.name}，有效期至${membership.endDate.toLocaleDateString()}`,
        deepLink: '/membership',
      });
    } catch (notifError) {
      console.error('Failed to send notification:', notifError);
    }

    res.json({
      success: true,
      data: {
        membership: {
          tier: membership.tier,
          status: membership.status,
          startDate: membership.startDate,
          endDate: membership.endDate,
          autoRenew: membership.autoRenew,
        },
        order: {
          orderId: paymentResult.orderId,
          transactionId: paymentResult.transactionId,
        },
      },
      message: '会员升级成功',
    });
  } catch (error) {
    console.error('Error upgrading membership:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upgrade membership',
    });
  }
}

/**
 * POST /api/v1/memberships/check/:benefit
 * Check if user can access a specific benefit
 */
export async function checkBenefit(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { benefit } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const validBenefits = ['report_basic', 'report_pro', 'life_event', 'dual_test', 'priority_support'];
    if (!validBenefits.includes(benefit)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid benefit type',
      });
    }

    const result = await checkBenefitAccess(
      userId,
      benefit as keyof import('../models/membership-tier').BenefitLimits
    );

    res.json({
      success: true,
      data: {
        benefit,
        allowed: result.allowed,
        reason: result.reason,
        remaining: result.remaining,
        resetDate: result.resetDate,
      },
    });
  } catch (error) {
    console.error('Error checking benefit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check benefit access',
    });
  }
}

/**
 * POST /api/v1/memberships/consume/:benefit
 * Record benefit usage
 */
export async function consumeBenefit(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { benefit } = req.params;
    const { metadata } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const validBenefits = ['report_basic', 'report_pro', 'life_event', 'dual_test', 'priority_support'];
    if (!validBenefits.includes(benefit)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid benefit type',
      });
    }

    // Check access first
    const access = await checkBenefitAccess(
      userId,
      benefit as keyof import('../models/membership-tier').BenefitLimits
    );

    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        error: access.reason || 'Benefit not available',
        remaining: access.remaining,
      });
    }

    // Record usage
    await recordBenefitUsage(
      userId,
      benefit as keyof import('../models/membership-tier').BenefitLimits,
      metadata
    );

    // Get updated usage
    const updatedUsage = await checkBenefitAccess(
      userId,
      benefit as keyof import('../models/membership-tier').BenefitLimits
    );

    res.json({
      success: true,
      data: {
        benefit,
        consumed: true,
        remaining: updatedUsage.remaining,
        resetDate: updatedUsage.resetDate,
      },
    });
  } catch (error) {
    console.error('Error consuming benefit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to consume benefit',
    });
  }
}

/**
 * GET /api/v1/memberships/expiring
 * Get users with expiring memberships (admin only)
 */
export async function getExpiringMemberships(req: Request, res: Response) {
  try {
    const { days = 7 } = req.query;
    const daysThreshold = parseInt(days as string, 10) || 7;

    // TODO: Add admin authentication check
    // if (!req.user?.isAdmin) {
    //   return res.status(403).json({ success: false, error: 'Admin only' });
    // }

    const userIds = await checkExpiringMemberships(daysThreshold);

    res.json({
      success: true,
      data: {
        count: userIds.length,
        daysThreshold,
        userIds,
      },
    });
  } catch (error) {
    console.error('Error fetching expiring memberships:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch expiring memberships',
    });
  }
}

/**
 * POST /api/v1/memberships/process-expired
 * Process expired memberships (cron job)
 */
export async function processExpired(req: Request, res: Response) {
  try {
    // TODO: Add admin authentication check
    // if (!req.user?.isAdmin) {
    //   return res.status(403).json({ success: false, error: 'Admin only' });
    // }

    const count = await processExpiredMemberships();

    res.json({
      success: true,
      data: {
        processed: count,
      },
    });
  } catch (error) {
    console.error('Error processing expired memberships:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process expired memberships',
    });
  }
}

// ==================== Membership Upgrade/Downgrade Logic ====================

/**
 * POST /api/v1/memberships/downgrade
 * Downgrade user's membership (scheduled for end of period)
 */
export async function downgradeMembership(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { targetTier } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const membership = await getUserMembership(userId);
    if (!membership) {
      return res.status(400).json({
        success: false,
        error: 'No active membership to downgrade',
      });
    }

    const targetTierValid = targetTier && MEMBERSHIP_TIERS[targetTier as MembershipTier];
    if (!targetTierValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid target tier',
      });
    }

    // Disable auto-renew (downgrade at end of period)
    await import('../services/membership-benefits').then(
      (m) => m.downgradeMembership(userId, targetTier as MembershipTier)
    );

    res.json({
      success: true,
      data: {
        message: '会员将在当前周期结束后降级',
        endDate: membership.endDate,
        targetTier,
      },
    });
  } catch (error) {
    console.error('Error downgrading membership:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to downgrade membership',
    });
  }
}

// ==================== Export Default ====================

export default {
  getMembershipTiers,
  getCurrentMembership,
  getMembershipBenefits,
  upgradeMembership,
  checkBenefit,
  consumeBenefit,
  getExpiringMemberships,
  processExpired,
  downgradeMembership,
};
