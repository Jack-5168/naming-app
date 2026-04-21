/**
 * Growth Routes
 * Phase 4: Growth Features
 * 
 * Handles dual test invitations, share cards, and KOC referral system
 */

import { Router } from 'express';
import {
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
} from '../controllers/growth';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// ==================== Dual Test Routes ====================

/**
 * @route   POST /api/v1/growth/dual-test/create
 * @desc    Create a dual test invitation for friend comparison
 * @access  Private
 */
router.post('/dual-test/create', authMiddleware, createDualTest);

/**
 * @route   POST /api/v1/growth/dual-test/accept
 * @desc    Accept a dual test invitation
 * @access  Private
 */
router.post('/dual-test/accept', authMiddleware, acceptDualTest);

/**
 * @route   POST /api/v1/growth/dual-test/complete
 * @desc    Complete dual test and generate comparison report
 * @access  Private
 */
router.post('/dual-test/complete', authMiddleware, completeDualTest);

/**
 * @route   GET /api/v1/growth/dual-test/:id
 * @desc    Get dual test session details
 * @access  Private
 */
router.get('/dual-test/:id', authMiddleware, getDualTest);

// ==================== Share Card Routes ====================

/**
 * @route   GET /api/v1/growth/share-card/personality
 * @desc    Generate personality share card for social media
 * @access  Private
 */
router.get('/share-card/personality', authMiddleware, generatePersonalityCard);

/**
 * @route   GET /api/v1/growth/share-card/stability
 * @desc    Generate stability index share card
 * @access  Private
 */
router.get('/share-card/stability', authMiddleware, generateStabilityCard);

// ==================== KOC Referral Routes ====================

/**
 * @route   GET /api/v1/growth/koc/referral-link
 * @desc    Get user's unique referral link
 * @access  Private
 */
router.get('/koc/referral-link', authMiddleware, getReferralLink);

/**
 * @route   GET /api/v1/growth/koc/commissions
 * @desc    Get commission history and balance
 * @access  Private
 */
router.get('/koc/commissions', authMiddleware, getCommissions);

/**
 * @route   POST /api/v1/growth/koc/withdraw
 * @desc    Request commission withdrawal
 * @access  Private
 */
router.post('/koc/withdraw', authMiddleware, withdrawCommission);

/**
 * @route   GET /api/v1/growth/koc/dashboard
 * @desc    Get KOC dashboard with stats and analytics
 * @access  Private
 */
router.get('/koc/dashboard', authMiddleware, getKOCDashboard);

export default router;
export { router as growthRoutes };
