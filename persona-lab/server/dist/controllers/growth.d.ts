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
/**
 * POST /api/v1/growth/dual-test/create
 * Create a dual test invitation
 */
export declare function createDualTest(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /api/v1/growth/dual-test/accept
 * Accept a dual test invitation
 */
export declare function acceptDualTest(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /api/v1/growth/dual-test/complete
 * Complete dual test and generate compatibility report
 */
export declare function completeDualTest(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * GET /api/v1/growth/dual-test/:id
 * Get dual test details
 */
export declare function getDualTest(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * GET /api/v1/growth/share-card/personality
 * Generate personality type share card
 */
export declare function generatePersonalityCard(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * GET /api/v1/growth/share-card/stability
 * Generate stability report share card
 */
export declare function generateStabilityCard(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * GET /api/v1/growth/koc/referral-link
 * Get user's referral link
 */
export declare function getReferralLink(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * GET /api/v1/growth/koc/commissions
 * Get user's commission records
 */
export declare function getCommissions(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /api/v1/growth/koc/withdraw
 * Request commission withdrawal
 */
export declare function withdrawCommission(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * GET /api/v1/growth/koc/dashboard
 * Get KOC dashboard data
 */
export declare function getKOCDashboard(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
declare const _default: {
    createDualTest: typeof createDualTest;
    acceptDualTest: typeof acceptDualTest;
    completeDualTest: typeof completeDualTest;
    getDualTest: typeof getDualTest;
    generatePersonalityCard: typeof generatePersonalityCard;
    generateStabilityCard: typeof generateStabilityCard;
    getReferralLink: typeof getReferralLink;
    getCommissions: typeof getCommissions;
    withdrawCommission: typeof withdrawCommission;
    getKOCDashboard: typeof getKOCDashboard;
};
export default _default;
//# sourceMappingURL=growth.d.ts.map