/**
 * Dual Test Controller - 双人合测功能
 * Phase 4: Growth Features
 * 
 * Features:
 * - 创建合测邀请
 * - 发送邀请（微信模板消息/邮件）
 * - 兼容性分析算法
 * - 合测结果生成
 * 
 * Pricing: ¥99
 */

import { Request, Response } from 'express';
import { PrismaClient, DualTestStatus, InvitationMethod } from '@prisma/client';
import { createPushNotification } from '../services/push-notification';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { analyzeCompatibility, CompatibilityResult } from '../services/compatibility-analyzer';

const prisma = new PrismaClient();

// ==================== Dual Test Invitation Management ====================

/**
 * POST /api/v1/dual-test/create
 * 创建双人合测邀请
 * 
 * Request Body:
 * - testId: 发起人的测试 ID
 * - invitationMethod: 邀请方式 (wechat/link/qrcode)
 * - inviteeEmail: 可选，被邀请人邮箱
 * - inviteeWechat: 可选，被邀请人微信
 */
export async function createDualTestInvitation(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { testId, invitationMethod, inviteeEmail, inviteeWechat } = req.body;

    if (!userId || !testId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: userId and testId',
      });
    }

    // Check if user has dual test access (¥99 feature)
    const { checkFeatureAccess } = await import('./memberships');
    const access = await checkFeatureAccess(userId, 'dual_test');

    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        error: 'No dual test access. Please upgrade membership or purchase separately (¥99).',
        remaining: access.remaining,
        upgradeUrl: '/membership/upgrade',
      });
    }

    // Verify test belongs to user
    const testResult = await prisma.testResult.findFirst({
      where: {
        id: Number(testId),
        userId,
      },
    });

    if (!testResult) {
      return res.status(404).json({
        success: false,
        error: 'Test record not found',
      });
    }

    // Generate unique invite code
    const inviteCode = uuidv4().substring(0, 8).toUpperCase();
    const shareUrl = `https://personaalab.com/miniapp/dual-test/invite/${inviteCode}`;

    // Generate QR code
    const qrCodeDataUrl = await generateQRCode(shareUrl, 300);

    // Create dual test record
    const dualTest = await prisma.dualTest.create({
      data: {
        initiatorId: userId,
        initiatorTestId: Number(testId),
        inviteCode,
        invitationMethod: invitationMethod || 'link',
        inviteeEmail: inviteeEmail || '',
        inviteeWechat: inviteeWechat || '',
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Send invitation based on method
    if (invitationMethod === 'wechat' && inviteeWechat) {
      await sendWechatInvitation(inviteeWechat, inviteCode, userId);
    } else if (invitationMethod === 'email' && inviteeEmail) {
      await sendEmailInvitation(inviteeEmail, inviteCode, userId);
    }

    // Record feature usage
    const { recordFeatureUsage } = await import('./memberships');
    await recordFeatureUsage(userId, 'dual_test', { dualTestId: dualTest.id, testId });

    res.json({
      success: true,
      data: {
        dualTestId: dualTest.id,
        inviteCode: dualTest.inviteCode,
        qrCode: qrCodeDataUrl,
        shareUrl,
        invitationMethod: dualTest.invitationMethod,
        expiresAt: dualTest.expiresAt,
        price: 99,
        currency: 'CNY',
      },
    });
  } catch (error) {
    console.error('Error creating dual test invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create dual test invitation',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/v1/dual-test/accept
 * 接受双人合测邀请
 * 
 * Request Body:
 * - inviteCode: 邀请码
 */
export async function acceptDualTestInvitation(req: Request, res: Response) {
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
      include: {
        initiator: {
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
        error: 'Invitation not found',
      });
    }

    if (dualTest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'This invitation has already been used or expired',
        currentStatus: dualTest.status,
      });
    }

    if (dualTest.initiatorId === userId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot accept your own invitation',
      });
    }

    // Update dual test with participant
    await prisma.dualTest.update({
      where: { id: dualTest.id },
      data: {
        participantId: userId,
        status: 'accepted',
        acceptedAt: new Date(),
      },
    });

    // Notify initiator
    await createPushNotification({
      userId: dualTest.initiatorId,
      type: 'dual_test_invite',
      title: '好友已接受合测邀请',
      content: '你们可以开始进行双人合测了',
      deepLink: `/dual-test/${dualTest.id}/result`,
    });

    res.json({
      success: true,
      data: {
        dualTestId: dualTest.id,
        status: 'accepted',
        initiator: dualTest.initiator,
        message: 'Invitation accepted successfully',
      },
    });
  } catch (error) {
    console.error('Error accepting dual test invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to accept dual test invitation',
    });
  }
}

/**
 * POST /api/v1/dual-test/complete
 * 完成双人合测并生成兼容性报告
 * 
 * Request Body:
 * - dualTestId: 合测 ID
 * - participantTestId: 参与者的测试 ID
 */
export async function completeDualTest(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { dualTestId, participantTestId } = req.body;

    if (!userId || !dualTestId || !participantTestId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
      });
    }

    const dualTest = await prisma.dualTest.findUnique({
      where: { id: Number(dualTestId) },
      include: {
        initiator: true,
        participant: true,
        initiatorTestResult: true,
      },
    });

    if (!dualTest) {
      return res.status(404).json({
        success: false,
        error: 'Dual test not found',
      });
    }

    if (dualTest.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        error: 'Dual test not ready for completion',
        currentStatus: dualTest.status,
      });
    }

    // Verify participant
    if (dualTest.participantId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get participant test result
    const participantTestResult = await prisma.testResult.findFirst({
      where: {
        id: Number(participantTestId),
        userId,
      },
    });

    if (!participantTestResult) {
      return res.status(404).json({
        success: false,
        error: 'Participant test result not found',
      });
    }

    // Analyze compatibility
    const compatibilityResult: CompatibilityResult = await analyzeCompatibility(
      dualTest.initiatorTestResult.answers as any,
      participantTestResult.answers as any,
      dualTest.initiator.mbtiType || '',
      participantTestResult.mbtiType || ''
    );

    // Update dual test with results
    await prisma.dualTest.update({
      where: { id: dualTest.id },
      data: {
        status: 'completed',
        participantTestId: Number(participantTestId),
        compatibilityScore: compatibilityResult.overallScore,
        conflictWarnings: JSON.stringify(compatibilityResult.conflictWarnings),
        relationshipAdvice: JSON.stringify(compatibilityResult.relationshipAdvice),
        dimensionAnalysis: JSON.stringify(compatibilityResult.dimensionAnalysis),
        completedAt: new Date(),
      },
    });

    // Record feature usage for both users
    const { recordFeatureUsage } = await import('./memberships');
    await recordFeatureUsage(dualTest.initiatorId, 'dual_test', { 
      dualTestId: dualTest.id, 
      completed: true 
    });
    await recordFeatureUsage(dualTest.participantId!, 'dual_test', { 
      dualTestId: dualTest.id, 
      completed: true 
    });

    // Notify both users
    await createPushNotification({
      userId: dualTest.initiatorId,
      type: 'report_ready',
      title: '双人合测报告已生成',
      content: `你们的契合度为${Math.round(compatibilityResult.overallScore * 100)}%，点击查看完整分析`,
      deepLink: `/dual-test/${dualTest.id}/report`,
    });

    await createPushNotification({
      userId: dualTest.participantId!,
      type: 'report_ready',
      title: '双人合测报告已生成',
      content: `你们的契合度为${Math.round(compatibilityResult.overallScore * 100)}%，点击查看完整分析`,
      deepLink: `/dual-test/${dualTest.id}/report`,
    });

    res.json({
      success: true,
      data: {
        dualTestId: dualTest.id,
        compatibilityScore: Number(compatibilityResult.overallScore),
        compatibilityLevel: compatibilityResult.compatibilityLevel,
        conflictWarnings: compatibilityResult.conflictWarnings,
        relationshipAdvice: compatibilityResult.relationshipAdvice,
        reportUrl: `/dual-test/${dualTest.id}/report`,
        message: 'Dual test completed successfully',
      },
    });
  } catch (error) {
    console.error('Error completing dual test:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete dual test',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/v1/dual-test/:id
 * 获取双人合测详情
 */
export async function getDualTestDetails(req: Request, res: Response) {
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
      where: { id: Number(id) },
      include: {
        initiator: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            mbtiType: true,
          },
        },
        participant: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            mbtiType: true,
          },
        },
        initiatorTestResult: {
          select: {
            mbtiType: true,
            dimensionScores: true,
          },
        },
        participantTestResult: {
          select: {
            mbtiType: true,
            dimensionScores: true,
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

    // Parse JSON fields
    const conflictWarnings = dualTest.conflictWarnings 
      ? JSON.parse(dualTest.conflictWarnings) 
      : [];
    const relationshipAdvice = dualTest.relationshipAdvice
      ? JSON.parse(dualTest.relationshipAdvice)
      : [];
    const dimensionAnalysis = dualTest.dimensionAnalysis
      ? JSON.parse(dualTest.dimensionAnalysis)
      : {};

    res.json({
      success: true,
      data: {
        ...dualTest,
        conflictWarnings,
        relationshipAdvice,
        dimensionAnalysis,
        // Remove sensitive data
        initiator: {
          ...dualTest.initiator,
          testResult: dualTest.initiatorTestResult,
        },
        participant: dualTest.participant ? {
          ...dualTest.participant,
          testResult: dualTest.participantTestResult,
        } : null,
      },
    });
  } catch (error) {
    console.error('Error getting dual test details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dual test details',
    });
  }
}

/**
 * GET /api/v1/dual-test/:id/report
 * 获取双人合测完整报告（付费内容）
 */
export async function getDualTestReport(req: Request, res: Response) {
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
      where: { id: Number(id) },
      include: {
        initiator: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            mbtiType: true,
          },
        },
        participant: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            mbtiType: true,
          },
        },
        initiatorTestResult: true,
        participantTestResult: true,
      },
    });

    if (!dualTest) {
      return res.status(404).json({
        success: false,
        error: 'Dual test not found',
      });
    }

    // Check access
    if (dualTest.initiatorId !== userId && dualTest.participantId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    if (dualTest.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Report not ready yet',
        currentStatus: dualTest.status,
      });
    }

    // Parse all JSON fields
    const conflictWarnings = dualTest.conflictWarnings 
      ? JSON.parse(dualTest.conflictWarnings) 
      : [];
    const relationshipAdvice = dualTest.relationshipAdvice
      ? JSON.parse(dualTest.relationshipAdvice)
      : [];
    const dimensionAnalysis = dualTest.dimensionAnalysis
      ? JSON.parse(dualTest.dimensionAnalysis)
      : {};

    res.json({
      success: true,
      data: {
        dualTestId: dualTest.id,
        compatibilityScore: Number(dualTest.compatibilityScore),
        compatibilityLevel: getCompatibilityLevel(Number(dualTest.compatibilityScore)),
        initiator: {
          ...dualTest.initiator,
          testResult: {
            mbtiType: dualTest.initiatorTestResult.mbtiType,
            dimensionScores: dualTest.initiatorTestResult.dimensionScores,
          },
        },
        participant: dualTest.participant ? {
          ...dualTest.participant,
          testResult: {
            mbtiType: dualTest.participantTestResult.mbtiType,
            dimensionScores: dualTest.participantTestResult.dimensionScores,
          },
        } : null,
        conflictWarnings,
        relationshipAdvice,
        dimensionAnalysis,
        completedAt: dualTest.completedAt,
      },
    });
  } catch (error) {
    console.error('Error getting dual test report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dual test report',
    });
  }
}

/**
 * GET /api/v1/dual-test/invite/:code
 * 通过邀请码获取合测信息（未登录用户也可访问）
 */
export async function getDualTestByInviteCode(req: Request, res: Response) {
  try {
    const { code } = req.params;

    const dualTest = await prisma.dualTest.findUnique({
      where: { inviteCode: code },
      include: {
        initiator: {
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
        error: 'Invitation not found',
      });
    }

    if (dualTest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'This invitation is no longer valid',
        currentStatus: dualTest.status,
      });
    }

    // Check if expired
    if (new Date() > dualTest.expiresAt!) {
      return res.status(400).json({
        success: false,
        error: 'Invitation has expired',
      });
    }

    res.json({
      success: true,
      data: {
        inviteCode: dualTest.inviteCode,
        initiator: dualTest.initiator,
        expiresAt: dualTest.expiresAt,
        invitationMethod: dualTest.invitationMethod,
      },
    });
  } catch (error) {
    console.error('Error getting dual test by invite code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get invitation details',
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
 * Send WeChat invitation
 */
async function sendWechatInvitation(
  wechatId: string,
  inviteCode: string,
  initiatorId: number
): Promise<void> {
  try {
    // In production, integrate with WeChat template message API
    console.log(`Sending WeChat invitation to ${wechatId}, code: ${inviteCode}`);
    
    // Placeholder for WeChat integration
    // await wechatService.sendTemplateMessage({
    //   touser: wechatId,
    //   template_id: 'dual_test_invitation',
    //   data: {
    //     inviteCode,
    //     initiatorName: '好友',
    //     url: `https://personaalab.com/dual-test/${inviteCode}`,
    //   },
    // });
  } catch (error) {
    console.error('Error sending WeChat invitation:', error);
  }
}

/**
 * Send email invitation
 */
async function sendEmailInvitation(
  email: string,
  inviteCode: string,
  initiatorId: number
): Promise<void> {
  try {
    // In production, integrate with email service (SendGrid, SES, etc.)
    console.log(`Sending email invitation to ${email}, code: ${inviteCode}`);
    
    // Placeholder for email integration
    // await emailService.send({
    //   to: email,
    //   subject: '好友邀请你进行双人合测',
    //   html: `
    //     <h1>双人合测邀请</h1>
    //     <p>你的好友邀请你一起进行 MBTI 双人合测</p>
    //     <p>邀请码：<strong>${inviteCode}</strong></p>
    //     <a href="https://personaalab.com/dual-test/${inviteCode}">点击接受邀请</a>
    //   `,
    // });
  } catch (error) {
    console.error('Error sending email invitation:', error);
  }
}

/**
 * Get compatibility level from score
 */
function getCompatibilityLevel(score: number): string {
  if (score >= 0.85) return 'excellent';
  if (score >= 0.70) return 'good';
  if (score >= 0.55) return 'moderate';
  return 'challenging';
}

export default {
  createDualTestInvitation,
  acceptDualTestInvitation,
  completeDualTest,
  getDualTestDetails,
  getDualTestReport,
  getDualTestByInviteCode,
};
