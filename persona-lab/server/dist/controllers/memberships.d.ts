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
/**
 * GET /api/v1/memberships/products
 * Get all available membership products
 */
export declare function getMembershipProducts(req: Request, res: Response): Promise<void>;
/**
 * GET /api/v1/memberships/me
 * Get current user's membership status and benefits
 */
export declare function getCurrentMembership(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /api/v1/memberships/upgrade
 * Upgrade user's membership
 */
export declare function upgradeMembership(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * GET /api/v1/memberships/benefits
 * Get detailed benefits for membership levels
 */
export declare function getMembershipBenefits(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Check if user has access to a specific feature
 */
export declare function checkFeatureAccess(userId: number, feature: string): Promise<{
    allowed: boolean;
    remaining?: number;
}>;
/**
 * Record feature usage
 */
export declare function recordFeatureUsage(userId: number, feature: string, metadata?: any): Promise<void>;
declare const _default: {
    getMembershipProducts: typeof getMembershipProducts;
    getCurrentMembership: typeof getCurrentMembership;
    upgradeMembership: typeof upgradeMembership;
    getMembershipBenefits: typeof getMembershipBenefits;
    checkFeatureAccess: typeof checkFeatureAccess;
    recordFeatureUsage: typeof recordFeatureUsage;
};
export default _default;
//# sourceMappingURL=memberships.d.ts.map