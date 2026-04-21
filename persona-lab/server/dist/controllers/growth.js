"use strict";
/**
 * Growth Controller
 * Phase 4: Growth Features
 *
 * Features:
 * - Dual Test (双人合测)
 * - Share Cards (分享卡片)
 * - KOC Distribution (KOC 分销系统)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDualTest = createDualTest;
exports.acceptDualTest = acceptDualTest;
exports.completeDualTest = completeDualTest;
exports.getDualTest = getDualTest;
exports.generatePersonalityCard = generatePersonalityCard;
exports.generateStabilityCard = generateStabilityCard;
exports.getReferralLink = getReferralLink;
exports.getCommissions = getCommissions;
exports.withdrawCommission = withdrawCommission;
exports.getKOCDashboard = getKOCDashboard;
const client_1 = require("@prisma/client");
const push_notification_1 = require("../services/push-notification");
const uuid_1 = require("uuid");
const qrcode_1 = __importDefault(require("qrcode"));
const prisma = new client_1.PrismaClient();
// ==================== Dual Test (双人合测) ====================
/**
 * POST /api/v1/growth/dual-test/create
 * Create a dual test invitation
 */
async function createDualTest(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
            });
        }
        // Check if user has dual test access
        const { checkFeatureAccess } = await Promise.resolve().then(() => __importStar(require('../controllers/memberships')));
        const access = await checkFeatureAccess(userId, 'dual_test');
        if (!access.allowed) {
            return res.status(403).json({
                success: false,
                error: 'No dual test access. Please upgrade membership.',
                remaining: access.remaining,
            });
        }
        const inviteCode = (0, uuid_1.v4)().substring(0, 8).toUpperCase();
        const dualTest = await prisma.dualTest.create({
            data: {
                initiatorId: userId,
                inviteCode,
                status: 'pending',
            },
        });
        // Generate QR code for mini-program
        const qrCodeDataUrl = await generateQRCode(`https://personaalab.com/miniapp/dual-test/${inviteCode}`);
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
    }
    catch (error) {
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
async function acceptDualTest(req, res) {
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
        await (0, push_notification_1.createPushNotification)({
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
    }
    catch (error) {
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
async function completeDualTest(req, res) {
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
        const compatibilityScore = calculateCompatibility(scores, dualTest.initiator.id === userId ? 'initiator' : 'participant');
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
        const { recordFeatureUsage } = await Promise.resolve().then(() => __importStar(require('../controllers/memberships')));
        await recordFeatureUsage(dualTest.initiatorId, 'dual_test', { dualTestId });
        if (dualTest.participantId) {
            await recordFeatureUsage(dualTest.participantId, 'dual_test', { dualTestId });
        }
        // Notify both users
        await (0, push_notification_1.createPushNotification)({
            userId: dualTest.initiatorId,
            type: 'report_ready',
            title: '双人合测报告已生成',
            content: '点击查看你们的契合度分析和关系建议',
            deepLink: `/dual-test/${dualTestId}/report`,
        });
        if (dualTest.participantId) {
            await (0, push_notification_1.createPushNotification)({
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
    }
    catch (error) {
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
async function getDualTest(req, res) {
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
    }
    catch (error) {
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
async function generatePersonalityCard(req, res) {
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
                id: testId,
                userId,
            },
        });
        if (!testRecord) {
            return res.status(404).json({
                success: false,
                error: 'Test record not found',
            });
        }
        const scores = testRecord.scores;
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
    }
    catch (error) {
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
async function generateStabilityCard(req, res) {
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
    }
    catch (error) {
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
async function getReferralLink(req, res) {
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
            const code = (0, uuid_1.v4)().substring(0, 8).toLowerCase();
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
    }
    catch (error) {
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
async function getCommissions(req, res) {
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
    }
    catch (error) {
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
async function withdrawCommission(req, res) {
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
        const totalPending = pendingCommissions.reduce((sum, c) => sum + Number(c.amount), 0);
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
        await (0, push_notification_1.createPushNotification)({
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
    }
    catch (error) {
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
async function getKOCDashboard(req, res) {
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
    }
    catch (error) {
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
async function generateQRCode(url) {
    try {
        const qrCode = await qrcode_1.default.toDataURL(url, {
            width: 300,
            margin: 2,
            errorCorrectionLevel: 'M',
        });
        return qrCode;
    }
    catch (error) {
        console.error('Error generating QR code:', error);
        return '';
    }
}
/**
 * Calculate personality type from scores
 */
function calculatePersonalityType(scores) {
    const E = scores.E || 50;
    const N = scores.N || 50;
    const T = scores.T || 50;
    const J = scores.J || 50;
    return `${E >= 50 ? 'E' : 'I'}${N >= 50 ? 'N' : 'S'}${T >= 50 ? 'T' : 'F'}${J >= 50 ? 'J' : 'P'}`;
}
/**
 * Get golden quote for personality type
 */
function getGoldenQuote(type) {
    const quotes = {
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
function calculateCompatibility(scores, userType) {
    // Simplified compatibility calculation
    // In production, use sophisticated algorithm
    return 0.75 + Math.random() * 0.2; // 0.75-0.95
}
/**
 * Generate conflict warnings
 */
function generateConflictWarnings(scores) {
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
function calculateStabilityIndex(testRecords) {
    if (testRecords.length < 2) {
        return 0;
    }
    // Simplified stability calculation
    return 0.8 + Math.random() * 0.15;
}
exports.default = {
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
//# sourceMappingURL=growth.js.map