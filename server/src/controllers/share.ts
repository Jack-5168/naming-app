/**
 * Share Controller - 分享功能
 * Phase 4: Growth Features
 * 
 * Features:
 * - 分享卡片生成
 * - 邀请码管理
 * - 分享统计
 * 
 * Supports:
 * - Personality type cards
 * - Stability report cards
 * - Dual test invitation cards
 * - KOC distribution tracking
 */

import { Request, Response } from 'express';
import { PrismaClient, ShareChannel, ShareType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';

const prisma = new PrismaClient();

// ==================== Share Card Generation ====================

/**
 * GET /api/v1/share/card/personality
 * 生成 MBTI 类型分享卡片
 * 
 * Query Parameters:
 * - testId: 测试 ID
 * - template: 卡片模板 (default/minimal/detailed)
 */
export async function generatePersonalityShareCard(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { testId, template = 'default' } = req.query;

    if (!userId || !testId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: testId',
      });
    }

    // Get test result
    const testResult = await prisma.testResult.findFirst({
      where: {
        id: Number(testId),
        userId,
      },
      include: {
        user: {
          select: {
            nickname: true,
            avatar: true,
          },
        },
      },
    });

    if (!testResult) {
      return res.status(404).json({
        success: false,
        error: 'Test record not found',
      });
    }

    // Get personality type info
    const personalityType = testResult.mbtiType || 'Unknown';
    const typeInfo = getPersonalityTypeInfo(personalityType);
    
    // Calculate stability if user has multiple tests
    const testCount = await prisma.testResult.count({
      where: { userId },
    });

    let stabilityIndex = 0;
    if (testCount > 1) {
      const { calculateStability } = await import('../services/stability-calculator');
      const testHistory = await prisma.testResult.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      
      const stabilityResult = await calculateStability(userId.toString(), testHistory as any);
      stabilityIndex = stabilityResult.stabilityIndex;
    }

    // Generate card data
    const cardData = {
      personalityType,
      typeName: typeInfo.name,
      typeDescription: typeInfo.description,
      dimensionScores: testResult.dimensionScores,
      stabilityIndex,
      testCount,
      goldenQuote: getGoldenQuote(personalityType),
      rarity: getPersonalityRarity(personalityType),
      createdAt: testResult.createdAt,
    };

    // Generate card image URL (in production, use rendering service)
    const cardImageUrl = `/api/v1/share/cards/render/personality?testId=${testId}&template=${template}`;

    // Record share event
    await recordShareEvent(userId, 'personality_card', 'generated');

    res.json({
      success: true,
      data: {
        cardData,
        cardImageUrl,
        shareUrl: `https://personaalab.com/share/personality/${testId}`,
        shareText: `我是${personalityType}型人格（${typeInfo.name}）- 只有${getPersonalityRarity(personalityType)}的人是这个类型`,
      },
    });
  } catch (error) {
    console.error('Error generating personality share card:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate share card',
    });
  }
}

/**
 * GET /api/v1/share/card/stability
 * 生成稳定性报告分享卡片
 */
export async function generateStabilityShareCard(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Get user's test history
    const testResults = await prisma.testResult.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (testResults.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No test records found',
      });
    }

    // Calculate stability
    const { calculateStability } = await import('../services/stability-calculator');
    const stabilityResult = await calculateStability(userId.toString(), testResults as any);

    const cardData = {
      stabilityIndex: stabilityResult.stabilityIndex,
      stabilityStatus: stabilityResult.status,
      stabilityProbability: stabilityResult.stabilityProbability,
      testCount: testResults.length,
      mbtiType: testResults[0].mbtiType,
      trend: calculateStabilityTrend(testResults),
    };

    const cardImageUrl = `/api/v1/share/cards/render/stability?userId=${userId}`;

    // Record share event
    await recordShareEvent(userId, 'stability_card', 'generated');

    res.json({
      success: true,
      data: {
        cardData,
        cardImageUrl,
        shareUrl: `https://personaalab.com/share/stability/${userId}`,
        shareText: `我的性格稳定性指数：${stabilityResult.stabilityIndex}% - 人格探索局`,
      },
    });
  } catch (error) {
    console.error('Error generating stability share card:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate share card',
    });
  }
}

/**
 * GET /api/v1/share/card/dual-test
 * 生成双人合测邀请卡片
 */
export async function generateDualTestShareCard(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { dualTestId } = req.query;

    if (!userId || !dualTestId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
      });
    }

    const dualTest = await prisma.dualTest.findUnique({
      where: { id: Number(dualTestId) },
      include: {
        initiator: {
          select: {
            nickname: true,
            avatar: true,
            mbtiType: true,
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

    if (dualTest.initiatorId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const cardData = {
      inviteCode: dualTest.inviteCode,
      initiatorName: dualTest.initiator.nickname,
      initiatorType: dualTest.initiator.mbtiType,
      expiresAt: dualTest.expiresAt,
      shareUrl: `https://personaalab.com/dual-test/invite/${dualTest.inviteCode}`,
    };

    const qrCode = await generateQRCode(cardData.shareUrl, 300);

    // Record share event
    await recordShareEvent(userId, 'dual_test_invite', 'generated');

    res.json({
      success: true,
      data: {
        cardData,
        qrCode,
        shareText: `${dualTest.initiator.nickname}邀请你进行 MBTI 双人合测，看看你们的契合度如何！`,
      },
    });
  } catch (error) {
    console.error('Error generating dual test share card:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate share card',
    });
  }
}

// ==================== Share Tracking & Statistics ====================

/**
 * POST /api/v1/share/track
 * 记录分享行为
 * 
 * Request Body:
 * - type: 分享类型
 * - channel: 分享渠道
 * - targetId: 目标 ID（测试 ID、合测 ID 等）
 */
export async function trackShare(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { type, channel, targetId } = req.body;

    if (!userId || !type || !channel) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
      });
    }

    const share = await prisma.share.create({
      data: {
        userId,
        type: type as ShareType,
        channel: channel as ShareChannel,
        targetId: targetId || null,
        sharedAt: new Date(),
      },
    });

    // Update user's share count
    await prisma.user.update({
      where: { id: userId },
      data: {
        shareCount: { increment: 1 },
      },
    });

    res.json({
      success: true,
      data: {
        shareId: share.id,
        message: 'Share tracked successfully',
      },
    });
  } catch (error) {
    console.error('Error tracking share:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track share',
    });
  }
}

/**
 * GET /api/v1/share/stats
 * 获取用户分享统计
 */
export async function getShareStats(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Get total shares
    const totalShares = await prisma.share.count({
      where: { userId },
    });

    // Get shares by type
    const sharesByType = await prisma.share.groupBy({
      by: ['type'],
      where: { userId },
      _count: true,
    });

    // Get shares by channel
    const sharesByChannel = await prisma.share.groupBy({
      by: ['channel'],
      where: { userId },
      _count: true,
    });

    // Get recent shares
    const recentShares = await prisma.share.findMany({
      where: { userId },
      orderBy: { sharedAt: 'desc' },
      take: 10,
    });

    // Get referral stats (if applicable)
    const referral = await prisma.referral.findFirst({
      where: { referrerId: userId },
    });

    const referralStats = referral ? {
      code: referral.code,
      totalReferrals: await prisma.referral.count({
        where: { referrerId: userId },
      }),
      convertedReferrals: await prisma.referral.count({
        where: { referrerId: userId, status: 'converted' },
      }),
    } : null;

    res.json({
      success: true,
      data: {
        totalShares,
        sharesByType: sharesByType.reduce((acc, item) => {
          acc[item.type] = item._count;
          return acc;
        }, {} as { [key: string]: number }),
        sharesByChannel: sharesByChannel.reduce((acc, item) => {
          acc[item.channel] = item._count;
          return acc;
        }, {} as { [key: string]: number }),
        recentShares,
        referralStats,
      },
    });
  } catch (error) {
    console.error('Error getting share stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get share statistics',
    });
  }
}

// ==================== Invitation Code Management ====================

/**
 * POST /api/v1/share/invite-code
 * 创建邀请码
 */
export async function createInviteCode(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { type, metadata } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const code = uuidv4().substring(0, 8).toUpperCase();
    const shareUrl = `https://personaalab.com/invite/${code}`;
    const qrCode = await generateQRCode(shareUrl, 300);

    const inviteCode = await prisma.inviteCode.create({
      data: {
        userId,
        code,
        type: type || 'general',
        metadata: metadata ? JSON.stringify(metadata) : null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        status: 'active',
      },
    });

    res.json({
      success: true,
      data: {
        code: inviteCode.code,
        shareUrl,
        qrCode,
        expiresAt: inviteCode.expiresAt,
      },
    });
  } catch (error) {
    console.error('Error creating invite code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create invite code',
    });
  }
}

/**
 * GET /api/v1/share/invite-code/:code
 * 验证并使用邀请码
 */
export async function validateInviteCode(req: Request, res: Response) {
  try {
    const { code } = req.params;
    const userId = req.user?.id;

    const inviteCode = await prisma.inviteCode.findUnique({
      where: { code },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
      },
    });

    if (!inviteCode) {
      return res.status(404).json({
        success: false,
        error: 'Invite code not found',
      });
    }

    if (inviteCode.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Invite code is no longer valid',
        currentStatus: inviteCode.status,
      });
    }

    if (new Date() > inviteCode.expiresAt!) {
      return res.status(400).json({
        success: false,
        error: 'Invite code has expired',
      });
    }

    // Check if user already used this code
    if (userId && userId === inviteCode.userId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot use your own invite code',
      });
    }

    res.json({
      success: true,
      data: {
        code: inviteCode.code,
        type: inviteCode.type,
        creator: inviteCode.user,
        metadata: inviteCode.metadata ? JSON.parse(inviteCode.metadata) : null,
        expiresAt: inviteCode.expiresAt,
      },
    });
  } catch (error) {
    console.error('Error validating invite code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate invite code',
    });
  }
}

/**
 * POST /api/v1/share/invite-code/:code/use
 * 使用邀请码
 */
export async function useInviteCode(req: Request, res: Response) {
  try {
    const { code } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const inviteCode = await prisma.inviteCode.findUnique({
      where: { code },
    });

    if (!inviteCode || inviteCode.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Invalid invite code',
      });
    }

    // Mark as used
    await prisma.inviteCode.update({
      where: { id: inviteCode.id },
      data: {
        status: 'used',
        usedBy: userId,
        usedAt: new Date(),
      },
    });

    // Create referral record if applicable
    if (inviteCode.type === 'referral') {
      await prisma.referral.create({
        data: {
          referrerId: inviteCode.userId,
          refereeId: userId,
          code: inviteCode.code,
          status: 'pending',
          commissionRate: 0.15,
        },
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Invite code used successfully',
        reward: inviteCode.type === 'referral' ? 'Both you and the inviter will receive rewards' : null,
      },
    });
  } catch (error) {
    console.error('Error using invite code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to use invite code',
    });
  }
}

// ==================== Helper Functions ====================

/**
 * Generate QR code
 */
async function generateQRCode(url: string, size: number = 300): Promise<string> {
  try {
    const qrCode = await QRCode.toDataURL(url, {
      width: size,
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
 * Record share event
 */
async function recordShareEvent(
  userId: number,
  type: string,
  action: string
): Promise<void> {
  try {
    await prisma.shareEvent.create({
      data: {
        userId,
        type,
        action,
        occurredAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error recording share event:', error);
  }
}

/**
 * Get personality type info
 */
function getPersonalityTypeInfo(type: string): { name: string; description: string } {
  const typeInfo: { [key: string]: { name: string; description: string } } = {
    INTJ: { name: '建筑师', description: '富有想象力和战略性的思想家' },
    INTP: { name: '逻辑学家', description: '具有创造力的发明家' },
    ENTJ: { name: '指挥官', description: '大胆、富有想象力的强大领导者' },
    ENTP: { name: '辩论家', description: '聪明好奇的思想者' },
    INFJ: { name: '提倡者', description: '安静而神秘，同时鼓舞人心' },
    INFP: { name: '调停者', description: '诗意、善良的利他主义者' },
    ENFJ: { name: '主人公', description: '富有魅力、鼓舞人心的领导者' },
    ENFP: { name: '竞选者', description: '热情、有创造力的社交者' },
    ISTJ: { name: '物流师', description: '实用、注重事实的可靠者' },
    ISFJ: { name: '守卫者', description: '非常专注、温暖的守护者' },
    ESTJ: { name: '总经理', description: '出色的管理者' },
    ESFJ: { name: '执政官', description: '极有同情心、受欢迎的人' },
    ISTP: { name: '鉴赏家', description: '大胆而实际的实验家' },
    ISFP: { name: '探险家', description: '灵活、有魅力的艺术家' },
    ESTP: { name: '企业家', description: '聪明、精力充沛的人' },
    ESFP: { name: '表演者', description: '自发的、充满活力的表演者' },
  };

  return typeInfo[type] || { name: '未知类型', description: '独特的人格类型' };
}

/**
 * Get golden quote for personality type
 */
function getGoldenQuote(type: string): string {
  const quotes: { [key: string]: string } = {
    INTJ: '用战略眼光改变世界',
    INTP: '在可能性中寻找真理',
    ENTJ: '天生领导者，改变世界',
    ENTP: '创新思考，挑战传统',
    INFJ: '用洞察力照亮他人',
    INFP: '理想主义，温暖世界',
    ENFJ: '激励他人，成就伟大',
    ENFP: '热情洋溢，创造可能',
    ISTJ: '脚踏实地，值得信赖',
    ISFJ: '默默守护，温暖人心',
    ESTJ: '高效执行，成就卓越',
    ESFJ: '关爱他人，凝聚力量',
    ISTP: '实践出真知',
    ISFP: '用艺术表达自我',
    ESTP: '行动派，把握当下',
    ESFP: '享受生命，点亮生活',
  };

  return quotes[type] || '探索自我，发现无限可能';
}

/**
 * Get personality rarity (approximate population percentages)
 */
function getPersonalityRarity(type: string): string {
  const rarity: { [key: string]: string } = {
    INFJ: '1%',
    ENFJ: '2%',
    INTJ: '2%',
    ENTP: '3%',
    INFP: '4%',
    ENTJ: '2%',
    INTP: '3%',
    ENFP: '8%',
    ISTJ: '12%',
    ISFJ: '14%',
    ESTJ: '9%',
    ESFJ: '12%',
    ISTP: '5%',
    ISFP: '9%',
    ESTP: '4%',
    ESFP: '9%',
  };

  return rarity[type] || '稀有';
}

/**
 * Calculate stability trend from test history
 */
function calculateStabilityTrend(testResults: any[]): 'increasing' | 'decreasing' | 'stable' {
  if (testResults.length < 3) {
    return 'stable';
  }

  // Simplified trend calculation
  const recentTypes = testResults.slice(0, 3).map(t => t.mbtiType);
  const uniqueTypes = new Set(recentTypes).size;

  if (uniqueTypes === 1) return 'stable';
  if (uniqueTypes === 2) return 'increasing';
  return 'decreasing';
}

export default {
  generatePersonalityShareCard,
  generateStabilityShareCard,
  generateDualTestShareCard,
  trackShare,
  getShareStats,
  createInviteCode,
  validateInviteCode,
  useInviteCode,
};
