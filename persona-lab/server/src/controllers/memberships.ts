/**
 * Membership Controller
 * Phase 4: Membership System Implementation
 * 
 * API Endpoints:
 * - GET /api/v1/memberships/products - Get membership products (6 tiers)
 * - GET /api/v1/memberships/me - Get current user's membership benefits
 * - POST /api/v1/memberships/upgrade - Upgrade membership
 * - GET /api/v1/memberships/benefits - Get benefit details
 */

import { Request, Response } from 'express';
import { PrismaClient, MembershipLevel, MembershipStatus, OrderStatus } from '@prisma/client';
import { createPushNotification } from '../services/push-notification';

const prisma = new PrismaClient();

// ==================== Membership Products Configuration ====================

const MEMBERSHIP_PRODUCTS = [
  {
    id: 1,
    name: '单次测试解锁',
    description: '解锁单次完整测试报告',
    price: 29.00,
    durationDays: 0, // one-time
    level: 'basic' as MembershipLevel,
    features: {
      report_basic: { unlimited: false, limit: 1 },
      report_pro: { unlimited: false, limit: 0 },
      life_event: { unlimited: false },
      timeline: { unlimited: false },
      dual_test: { unlimited: false, limit: 0 },
      growth_task: { unlimited: false },
    },
    sortOrder: 1,
  },
  {
    id: 2,
    name: '基础解锁',
    description: '8 条特征 + 职业分析',
    price: 9.90,
    durationDays: 30,
    level: 'basic' as MembershipLevel,
    features: {
      report_basic: { unlimited: true },
      report_pro: { unlimited: false, limit: 0 },
      life_event: { unlimited: false },
      timeline: { unlimited: false },
      dual_test: { unlimited: false, limit: 0 },
      growth_task: { unlimited: false },
    },
    sortOrder: 2,
  },
  {
    id: 3,
    name: '3 次卡（3 个月）',
    description: '3 次测试机会，有效期 3 个月',
    price: 59.00,
    durationDays: 90,
    level: 'basic' as MembershipLevel,
    features: {
      report_basic: { unlimited: false, limit: 3 },
      report_pro: { unlimited: false, limit: 0 },
      life_event: { unlimited: false },
      timeline: { unlimited: false },
      dual_test: { unlimited: false, limit: 0 },
      growth_task: { unlimited: false },
    },
    sortOrder: 3,
  },
  {
    id: 4,
    name: '月卡会员',
    description: '月度会员，含成长任务',
    price: 49.00,
    durationDays: 30,
    level: 'pro' as MembershipLevel,
    features: {
      report_basic: { unlimited: true },
      report_pro: { unlimited: true },
      life_event: { unlimited: true },
      timeline: { unlimited: true },
      dual_test: { unlimited: false, limit: 2 },
      growth_task: { unlimited: true },
    },
    sortOrder: 4,
  },
  {
    id: 5,
    name: '季卡会员',
    description: '季度会员，性价比之选',
    price: 129.00,
    durationDays: 90,
    level: 'pro' as MembershipLevel,
    features: {
      report_basic: { unlimited: true },
      report_pro: { unlimited: true },
      life_event: { unlimited: true },
      timeline: { unlimited: true },
      dual_test: { unlimited: false, limit: 5 },
      growth_task: { unlimited: true },
    },
    sortOrder: 5,
  },
  {
    id: 6,
    name: '年卡会员',
    description: '年度会员，最优性价比',
    price: 299.00,
    durationDays: 365,
    level: 'premium' as MembershipLevel,
    features: {
      report_basic: { unlimited: true },
      report_pro: { unlimited: true },
      life_event: { unlimited: true },
      timeline: { unlimited: true },
      dual_test: { unlimited: true },
      growth_task: { unlimited: true },
    },
    sortOrder: 6,
  },
  {
    id: 7,
    name: '双人合测',
    description: '邀请好友进行双人合测',
    price: 29.00,
    durationDays: 0, // one-time
    level: 'basic' as MembershipLevel,
    features: {
      report_basic: { unlimited: false, limit: 0 },
      report_pro: { unlimited: false, limit: 0 },
      life_event: { unlimited: false },
      timeline: { unlimited: false },
      dual_test: { unlimited: false, limit: 1 },
      growth_task: { unlimited: false },
    },
    sortOrder: 7,
  },
];

// ==================== API Controllers ====================

/**
 * GET /api/v1/memberships/products
 * Get all available membership products
 */
export async function getMembershipProducts(req: Request, res: Response) {
  try {
    // Check if products exist in database, if not, initialize them
    const existingProducts = await prisma.membershipProduct.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    let products = existingProducts;

    // If no products exist, seed the database
    if (products.length === 0) {
      await prisma.membershipProduct.createMany({
        data: MEMBERSHIP_PRODUCTS,
      });
      products = await prisma.membershipProduct.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
    }

    res.json({
      success: true,
      data: products.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: Number(p.price),
        currency: p.currency,
        durationDays: p.durationDays,
        level: p.level,
        features: p.features,
        pricePerUse: p.durationDays === 0 
          ? Number(p.price) 
          : p.durationDays === 30 
            ? Number(p.price)
            : p.durationDays === 90
              ? Number(p.price) / 3
              : Number(p.price) / 12,
      })),
    });
  } catch (error) {
    console.error('Error fetching membership products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch membership products',
    });
  }
}

/**
 * GET /api/v1/memberships/me
 * Get current user's membership status and benefits
 */
export async function getCurrentMembership(req: Request, res: Response) {
  try {
    const userId = req.user?.id; // Assuming auth middleware sets req.user
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const membership = await prisma.membership.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nickname: true,
          },
        },
      },
    });

    if (!membership) {
      // Return free tier benefits
      const freeBenefits = await getBenefitsForLevel('free');
      return res.json({
        success: true,
        data: {
          level: 'free',
          status: 'none',
          endDate: null,
          benefits: freeBenefits,
        },
      });
    }

    // Check if membership is expired
    const now = new Date();
    const isExpired = membership.endDate < now;
    
    if (isExpired && membership.status === 'active') {
      // Auto-downgrade expired membership
      await prisma.membership.update({
        where: { id: membership.id },
        data: { status: 'expired' },
      });
      
      const freeBenefits = await getBenefitsForLevel('free');
      return res.json({
        success: true,
        data: {
          level: 'free',
          status: 'expired',
          endDate: membership.endDate,
          benefits: freeBenefits,
        },
      });
    }

    const benefits = await getBenefitsForLevel(membership.level);

    res.json({
      success: true,
      data: {
        level: membership.level,
        status: membership.status,
        startDate: membership.startDate,
        endDate: membership.endDate,
        autoRenew: membership.autoRenew,
        benefits,
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
 * POST /api/v1/memberships/upgrade
 * Upgrade user's membership
 */
export async function upgradeMembership(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { productId, paymentMethod, transactionId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'Product ID is required',
      });
    }

    // Get product details
    const product = await prisma.membershipProduct.findUnique({
      where: { id: productId },
    });

    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    // Create order
    const order = await prisma.order.create({
      data: {
        userId,
        productId,
        amount: product.price,
        currency: product.currency,
        status: 'pending',
        paymentMethod,
        transactionId,
      },
    });

    // In production, this would integrate with payment gateway
    // For now, we'll simulate successful payment
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
      },
    });

    // Create or update membership
    const now = new Date();
    const endDate = product.durationDays > 0
      ? new Date(now.getTime() + product.durationDays * 24 * 60 * 60 * 1000)
      : now; // one-time products don't extend membership

    let membership = await prisma.membership.findUnique({
      where: { userId },
    });

    if (membership && membership.status === 'active' && membership.endDate > now) {
      // Extend existing membership
      const newEndDate = product.durationDays > 0
        ? new Date(membership.endDate.getTime() + product.durationDays * 24 * 60 * 60 * 1000)
        : membership.endDate;

      membership = await prisma.membership.update({
        where: { userId },
        data: {
          level: product.level,
          endDate: newEndDate,
          status: 'active',
        },
      });
    } else {
      // Create new membership
      membership = await prisma.membership.create({
        data: {
          userId,
          level: product.level,
          status: 'active',
          startDate: now,
          endDate,
          autoRenew: false,
        },
      });
    }

    // Link order to membership
    await prisma.order.update({
      where: { id: order.id },
      data: { membershipId: membership.id },
    });

    // Send push notification
    await createPushNotification({
      userId,
      type: 'membership_expiring', // Using existing type, could add 'membership_upgraded'
      title: '会员升级成功',
      content: `您已成功升级为${product.name}，有效期至${endDate.toLocaleDateString()}`,
      deepLink: '/membership/benefits',
    });

    res.json({
      success: true,
      data: {
        order: updatedOrder,
        membership: {
          level: membership.level,
          status: membership.status,
          endDate: membership.endDate,
        },
      },
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
 * GET /api/v1/memberships/benefits
 * Get detailed benefits for membership levels
 */
export async function getMembershipBenefits(req: Request, res: Response) {
  try {
    const { level } = req.query;

    if (level) {
      const benefits = await getBenefitsForLevel(level as MembershipLevel);
      return res.json({
        success: true,
        data: {
          level,
          benefits,
        },
      });
    }

    // Return benefits for all levels
    const levels: MembershipLevel[] = ['free', 'basic', 'pro', 'premium'];
    const allBenefits = await Promise.all(
      levels.map(l => getBenefitsForLevel(l))
    );

    res.json({
      success: true,
      data: levels.map((level, index) => ({
        level,
        benefits: allBenefits[index],
      })),
    });
  } catch (error) {
    console.error('Error fetching membership benefits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch benefits',
    });
  }
}

// ==================== Helper Functions ====================

/**
 * Get benefits for a specific membership level
 */
async function getBenefitsForLevel(level: MembershipLevel) {
  const benefitConfig: Record<MembershipLevel, any> = {
    free: {
      report_basic: { unlimited: false, limit: 1 },
      report_pro: { unlimited: false, limit: 0 },
      life_event: { unlimited: false },
      timeline: { unlimited: false },
      dual_test: { unlimited: false, limit: 0 },
      growth_task: { unlimited: false },
    },
    basic: {
      report_basic: { unlimited: true },
      report_pro: { unlimited: false, limit: 0 },
      life_event: { unlimited: false },
      timeline: { unlimited: false },
      dual_test: { unlimited: false, limit: 0 },
      growth_task: { unlimited: false },
    },
    pro: {
      report_basic: { unlimited: true },
      report_pro: { unlimited: true },
      life_event: { unlimited: true },
      timeline: { unlimited: true },
      dual_test: { unlimited: false, limit: 2 },
      growth_task: { unlimited: true },
    },
    premium: {
      report_basic: { unlimited: true },
      report_pro: { unlimited: true },
      life_event: { unlimited: true },
      timeline: { unlimited: true },
      dual_test: { unlimited: true },
      growth_task: { unlimited: true },
    },
  };

  return {
    level,
    features: benefitConfig[level],
  };
}

/**
 * Check if user has access to a specific feature
 */
export async function checkFeatureAccess(userId: number, feature: string): Promise<{ allowed: boolean; remaining?: number }> {
  const membership = await prisma.membership.findUnique({
    where: { userId },
  });

  if (!membership || membership.status !== 'active' || membership.endDate < new Date()) {
    // Free tier
    const freeBenefits = await getBenefitsForLevel('free');
    const featureConfig = freeBenefits.features[feature];
    
    if (!featureConfig) {
      return { allowed: false };
    }

    if (featureConfig.unlimited) {
      return { allowed: true };
    }

    // Check usage
    const usageCount = await prisma.usageRecord.count({
      where: {
        userId,
        feature,
        consumedAt: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) }, // Last 30 days
      },
    });

    const limit = featureConfig.limit || 0;
    return {
      allowed: usageCount < limit,
      remaining: limit - usageCount,
    };
  }

  const benefits = await getBenefitsForLevel(membership.level);
  const featureConfig = benefits.features[feature];

  if (!featureConfig) {
    return { allowed: false };
  }

  if (featureConfig.unlimited) {
    return { allowed: true };
  }

  // Check usage
  const usageCount = await prisma.usageRecord.count({
    where: {
      userId,
      feature,
      consumedAt: {
        gte: membership.startDate,
      },
    },
  });

  const limit = featureConfig.limit || 0;
  return {
    allowed: usageCount < limit,
    remaining: limit - usageCount,
  };
}

/**
 * Record feature usage
 */
export async function recordFeatureUsage(userId: number, feature: string, metadata?: any) {
  await prisma.usageRecord.create({
    data: {
      userId,
      feature,
      metadata,
    },
  });
}

export default {
  getMembershipProducts,
  getCurrentMembership,
  upgradeMembership,
  getMembershipBenefits,
  checkFeatureAccess,
  recordFeatureUsage,
};
