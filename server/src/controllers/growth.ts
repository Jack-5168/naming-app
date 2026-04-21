/**
 * Growth Controller
 * Phase 4: Growth Features
 * 
 * Features:
 * - Dual Test (双人合测)
 * - Share Cards (分享卡片)
 * - KOC Distribution (KOC 分销系统)
 */

import { Request, Response } from 'express';
import { PrismaClient, DualTestStatus, ReferralStatus, CommissionStatus } from '@prisma/client';
import { createPushNotification } from '../services/push-notification';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';

const prisma = new PrismaClient();

// ==================== Dual Test (双人合测) ====================

/**
 * POST /api/v1/growth/dual-test/create
 * Create a dual test invitation
 */
export async function createDualTest(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Check if user has dual test access
    const { checkFeatureAccess } = await import('../controllers/memberships');
    const access = await checkFeatureAccess(userId, 'dual_test');
    
    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        error: 'No dual test access. Please upgrade membership.',
        remaining: access.remaining,
      });
    }

    const inviteCode = uuidv4().substring(0, 8).toUpperCase();

    const dualTest = await prisma.dualTest.create({
      data: {
        initiatorId: userId,
        inviteCode,
        status: 'pending',
      },
    });

    // Generate QR code for mini-program
    const qrCodeDataUrl = await generateQRCode(
      `https://personaalab.com/miniapp/dual-test/${inviteCode}`
    );

    res.json({
      success: true,
      data: {
        dualTestId: dualTest.id,
        inviteCode: dualTest.inviteCode,
        qrCode: qrCodeDataUrl,
        shareUrl: `https://personaalab.com/dual-test/${inviteCode}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
  } catch (error) {
    console.error('Error creating dual test:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create dual test',
    });
  }
}

/**
 * POST /api/v1/growth/dual-test/accept
 * Accept a dual test invitation
 */
export async function acceptDualTest(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { inviteCode } = req.body;

    if (!userId || !inviteCode) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
      });
    }

    const dualTest = await prisma.dualTest.findUnique({
      where: { inviteCode },
    });

    if (!dualTest) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found',
      });
    }

    if (dualTest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'This invitation has already been used',
      });
    }

    // Update dual test with participant
    await prisma.dualTest.update({
      where: { id: dualTest.id },
      data: {
        participantId: userId,
        status: 'accepted',
      },
    });

    // Notify initiator
    await createPushNotification({
      userId: dualTest.initiatorId,
      type: 'dual_test_invite',
      title: '好友已接受合测邀请',
      content: '你们可以开始进行双人合测了',
      deepLink: `/dual-test/${inviteCode}`,
    });

    res.json({
      success: true,
      data: {
        dualTestId: dualTest.id,
        status: 'accepted',
      },
    });
  } catch (error) {
    console.error('Error accepting dual test:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to accept dual test',
    });
  }
}

/**
 * POST /api/v1/growth/dual-test/complete
 * Complete dual test and generate compatibility report
 */
export async function completeDualTest(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { dualTestId, scores } = req.body;

    if (!userId || !dualTestId || !scores) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
      });
    }

    const dualTest = await prisma.dualTest.findUnique({
      where: { id: dualTestId },
      include: {
        initiator: true,
        participant: true,
      },
    });

    if (!dualTest) {
      return res.status(404).json({
        success: false,
        error: 'Dual test not found',
      });
    }

    // Calculate compatibility score
    const compatibilityScore = calculateCompatibility(
      scores,
      dualTest.initiator.id === userId ? 'initiator' : 'participant'
    );

    // Generate conflict warnings
    const conflictWarnings = generateConflictWarnings(scores);

    await prisma.dualTest.update({
      where: { id: dualTestId },
      data: {
        status: 'completed',
        compatibilityScore,
        conflictWarnings,
        completedAt: new Date(),
      },
    });

    // Record feature usage
    const { recordFeatureUsage } = await import('../controllers/memberships');
    await recordFeatureUsage(dualTest.initiatorId, 'dual_test', { dualTestId });
    if (dualTest.participantId) {
      await recordFeatureUsage(dualTest.participantId, 'dual_test', { dualTestId });
    }

    // Notify both users
    await createPushNotification({
      userId: dualTest.initiatorId,
      type: 'report_ready',
      title: '双人合测报告已生成',
      content: '点击查看你们的契合度分析和关系建议',
      deepLink: `/dual-test/${dualTestId}/report`,
    });

    if (dualTest.participantId) {
      await createPushNotification({
        userId: dualTest.participantId,
        type: 'report_ready',
        title: '双人合测报告已生成',
        content: '点击查看你们的契合度分析和关系建议',
        deepLink: `/dual-test/${dualTestId}/report`,
      });
    }

    res.json({
      success: true,
      data: {
        dualTestId,
        compatibilityScore: Number(compatibilityScore),
        conflictWarnings,
        reportUrl: `/dual-test/${dualTestId}/report`,
      },
    });
  } catch (error) {
    console.error('Error completing dual test:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete dual test',
    });
  }
}

/**
 * GET /api/v1/growth/dual-test/:id
 * Get dual test details
 */
export async function getDualTest(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const dualTest = await prisma.dualTest.findUnique({
      where: { id },
      include: {
        initiator: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
        participant: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
      },
    });

    if (!dualTest) {
      return res.status(404).json({
        success: false,
        error: 'Dual test not found',
      });
    }

    // Check if user is part of this dual test
    if (dualTest.initiatorId !== userId && dualTest.participantId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: dualTest,
    });
  } catch (error) {
    console.error('Error getting dual test:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dual test',
    });
  }
}

// ==================== Share Cards (分享卡片) ====================

/**
 * GET /api/v1/growth/share-card/personality
 * Generate personality type share card
 */
export async function generatePersonalityCard(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { testId } = req.query;

    if (!userId || !testId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
      });
    }

    // Get test result
    const testRecord = await prisma.testRecord.findFirst({
      where: {
        id: testId as string,
        userId,
      },
    });

    if (!testRecord) {
      return res.status(404).json({
        success: false,
        error: 'Test record not found',
      });
    }

    const scores = testRecord.scores as any;
    const personalityType = calculatePersonalityType(scores);
    const goldenQuote = getGoldenQuote(personalityType);

    // Generate card image URL (in production, this would use a rendering service)
    const cardUrl = `/api/v1/growth/share-cards/render/personality?testId=${testId}`;

    res.json({
      success: true,
      data: {
        personalityType,
        goldenQuote,
        cardUrl,
        shareText: `我是${personalityType}型人格 - 人格探索局`,
      },
    });
  } catch (error) {
    console.error('Error generating personality card:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate card',
    });
  }
}

/**
 * GET /api/v1/growth/share-card/stability
 * Generate stability report share card
 */
export async function generateStabilityCard(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Get user's stability data
    const testRecords = await prisma.testRecord.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: 10,
    });

    const stabilityIndex = calculateStabilityIndex(testRecords);

    const cardUrl = `/api/v1/growth/share-cards/render/stability?userId=${userId}`;

    res.json({
      success: true,
      data: {
        stabilityIndex: Number(stabilityIndex),
        cardUrl,
        shareText: `我的性格稳定性指数：${(Number(stabilityIndex) * 100).toFixed(0)}% - 人格探索局`,
      },
    });
  } catch (error) {
    console.error('Error generating stability card:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate card',
    });
  }
}

// ==================== KOC Distribution System ====================

/**
 * GET /api/v1/growth/koc/referral-link
 * Get user's referral link
 */
export async function getReferralLink(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Get or create referral code
    let referral = await prisma.referral.findFirst({
      where: { referrerId: userId },
    });

    if (!referral) {
      const code = uuidv4().substring(0, 8).toLowerCase();
      referral = await prisma.referral.create({
        data: {
          referrerId: userId,
          refereeEmail: '',
          code,
          status: 'pending',
          commissionRate: 0.15, // 15% commission
        },
      });
    }

    const referralLink = `https://personaalab.com/?ref=${referral.code}`;
    const qrCode = await generateQRCode(referralLink);

    res.json({
      success: true,
      data: {
        code: referral.code,
        referralLink,
        qrCode,
        commissionRate: Number(referral.commissionRate),
      },
    });
  } catch (error) {
    console.error('Error getting referral link:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get referral link',
    });
  }
}

/**
 * GET /api/v1/growth/koc/commissions
 * Get user's commission records
 */
export async function getCommissions(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const commissions = await prisma.commission.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const totalPending = commissions
      .filter(c => c.status === 'pending' || c.status === 'approved')
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const totalPaid = commissions
      .filter(c => c.status === 'paid')
      .reduce((sum, c) => sum + Number(c.amount), 0);

    res.json({
      success: true,
      data: {
        commissions,
        totalPending,
        totalPaid,
        withdrawableAmount: totalPending,
      },
    });
  } catch (error) {
    console.error('Error getting commissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get commissions',
    });
  }
}

/**
 * POST /api/v1/growth/koc/withdraw
 * Request commission withdrawal
 */
export async function withdrawCommission(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { amount, alipayAccount } = req.body;

    if (!userId || !amount || !alipayAccount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
      });
    }

    // Get pending commissions
    const pendingCommissions = await prisma.commission.findMany({
      where: {
        userId,
        status: { in: ['pending', 'approved'] },
      },
    });

    const totalPending = pendingCommissions.reduce(
      (sum, c) => sum + Number(c.amount),
      0
    );

    if (totalPending < amount) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient balance',
      });
    }

    if (amount < 50) {
      return res.status(400).json({
        success: false,
        error: 'Minimum withdrawal amount is ¥50',
      });
    }

    // Create withdrawal record (in production, integrate with payment system)
    const withdrawal = await prisma.commission.create({
      data: {
        userId,
        amount: -amount,
        status: 'pending',
      },
    });

    // Notify user
    await createPushNotification({
      userId,
      type: 'commission_paid',
      title: '提现申请已提交',
      content: `提现¥${amount}至支付宝${alipayAccount}，将在 3 个工作日内到账`,
      deepLink: '/koc/commissions',
    });

    res.json({
      success: true,
      data: {
        withdrawalId: withdrawal.id,
        amount,
        status: 'pending',
        estimatedArrival: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });
  } catch (error) {
    console.error('Error withdrawing commission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process withdrawal',
    });
  }
}

/**
 * GET /api/v1/growth/koc/dashboard
 * Get KOC dashboard data
 */
export async function getKOCDashboard(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Get referral stats
    const referrals = await prisma.referral.findMany({
      where: { referrerId: userId },
    });

    const totalReferrals = referrals.length;
    const convertedReferrals = referrals.filter(r => r.status === 'converted').length;
    const conversionRate = totalReferrals > 0 ? convertedReferrals / totalReferrals : 0;

    // Get commission stats
    const commissions = await prisma.commission.findMany({
      where: { userId },
    });

    const totalEarned = commissions
      .filter(c => c.amount > 0)
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const totalWithdrawn = commissions
      .filter(c => c.amount < 0)
      .reduce((sum, c) => sum + Math.abs(Number(c.amount)), 0);

    res.json({
      success: true,
      data: {
        totalReferrals,
        convertedReferrals,
        conversionRate,
        totalEarned,
        totalWithdrawn,
        balance: totalEarned - totalWithdrawn,
      },
    });
  } catch (error) {
    console.error('Error getting KOC dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard',
    });
  }
}

// ==================== Helper Functions ====================

/**
 * Generate QR code
 */
async function generateQRCode(url: string): Promise<string> {
  try {
    const qrCode = await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
    return qrCode;
  } catch (error) {
    console.error('Error generating QR code:', error);
    return '';
  }
}

/**
 * Calculate personality type from scores
 */
function calculatePersonalityType(scores: any): string {
  const E = scores.E || 50;
  const N = scores.N || 50;
  const T = scores.T || 50;
  const J = scores.J || 50;

  return `${E >= 50 ? 'E' : 'I'}${N >= 50 ? 'N' : 'S'}${T >= 50 ? 'T' : 'F'}${J >= 50 ? 'J' : 'P'}`;
}

/**
 * Get golden quote for personality type
 */
function getGoldenQuote(type: string): string {
  const quotes: Record<string, string> = {
    ENTJ: '天生领导者，用战略眼光改变世界',
    ENTP: '创新思考者，在可能性中寻找真理',
    INFJ: '理想主义者，用洞察力照亮他人',
    // ... add more quotes
  };
  return quotes[type] || '探索自我，发现无限可能';
}

/**
 * Calculate compatibility score
 */
function calculateCompatibility(scores: any, userType: string): number {
  // Simplified compatibility calculation
  // In production, use sophisticated algorithm
  return 0.75 + Math.random() * 0.2; // 0.75-0.95
}

/**
 * Generate conflict warnings
 */
function generateConflictWarnings(scores: any): any[] {
  // Analyze potential conflicts based on dimension differences
  const warnings = [];
  
  if (Math.abs(scores.E - 50) > 30) {
    warnings.push({
      dimension: 'E-I',
      level: 'medium',
      suggestion: '外向性差异较大，注意沟通方式',
    });
  }
  
  return warnings;
}

/**
 * Calculate stability index
 */
function calculateStabilityIndex(testRecords: any[]): number {
  if (testRecords.length < 2) {
    return 0;
  }
  
  // Simplified stability calculation
  return 0.8 + Math.random() * 0.15;
}

export default {
  createDualTest,
  acceptDualTest,
  completeDualTest,
  getDualTest,
  generatePersonalityCard,
  generateStabilityCard,
  getReferralLink,
  getCommissions,
  withdrawCommission,
  getKOCDashboard,
};
