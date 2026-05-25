/**
 * Membership Utilities
 * Phase 5: Code Quality Refactoring
 *
 * Shared membership tier utilities
 */

import { MembershipLevel, MembershipStatus } from '@prisma/client';
import { MembershipTier } from '../models/membership-tier';

/**
 * Map Prisma MembershipLevel to our MembershipTier enum
 */
export const tierLevelMap: Record<MembershipLevel, MembershipTier> = {
  free: MembershipTier.FREE,
  basic: MembershipTier.BASIC,
  pro: MembershipTier.PRO_MONTHLY,
  premium: MembershipTier.PRO_YEARLY,
};

/**
 * Reverse map: MembershipTier to MembershipLevel
 */
export const levelTierMap: Record<MembershipTier, MembershipLevel> = {
  [MembershipTier.FREE]: 'free',
  [MembershipTier.BASIC]: 'basic',
  [MembershipTier.PRO_REPORT]: 'pro',
  [MembershipTier.PRO_MONTHLY]: 'pro',
  [MembershipTier.PRO_YEARLY]: 'premium',
  [MembershipTier.DUAL_TEST]: 'basic',
};

/**
 * Check if tier is paid
 */
export function isPaidTier(tier: MembershipTier): boolean {
  return tier === MembershipTier.PRO_MONTHLY || tier === MembershipTier.PRO_YEARLY;
}
