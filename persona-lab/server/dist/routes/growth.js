"use strict";
/**
 * Growth Routes
 * Phase 4: Growth Features
 *
 * Handles dual test invitations, share cards, and KOC referral system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.growthRoutes = void 0;
const express_1 = require("express");
const growth_1 = require("../controllers/growth");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
exports.growthRoutes = router;
// ==================== Dual Test Routes ====================
/**
 * @route   POST /api/v1/growth/dual-test/create
 * @desc    Create a dual test invitation for friend comparison
 * @access  Private
 */
router.post('/dual-test/create', auth_1.authMiddleware, growth_1.createDualTest);
/**
 * @route   POST /api/v1/growth/dual-test/accept
 * @desc    Accept a dual test invitation
 * @access  Private
 */
router.post('/dual-test/accept', auth_1.authMiddleware, growth_1.acceptDualTest);
/**
 * @route   POST /api/v1/growth/dual-test/complete
 * @desc    Complete dual test and generate comparison report
 * @access  Private
 */
router.post('/dual-test/complete', auth_1.authMiddleware, growth_1.completeDualTest);
/**
 * @route   GET /api/v1/growth/dual-test/:id
 * @desc    Get dual test session details
 * @access  Private
 */
router.get('/dual-test/:id', auth_1.authMiddleware, growth_1.getDualTest);
// ==================== Share Card Routes ====================
/**
 * @route   GET /api/v1/growth/share-card/personality
 * @desc    Generate personality share card for social media
 * @access  Private
 */
router.get('/share-card/personality', auth_1.authMiddleware, growth_1.generatePersonalityCard);
/**
 * @route   GET /api/v1/growth/share-card/stability
 * @desc    Generate stability index share card
 * @access  Private
 */
router.get('/share-card/stability', auth_1.authMiddleware, growth_1.generateStabilityCard);
// ==================== KOC Referral Routes ====================
/**
 * @route   GET /api/v1/growth/koc/referral-link
 * @desc    Get user's unique referral link
 * @access  Private
 */
router.get('/koc/referral-link', auth_1.authMiddleware, growth_1.getReferralLink);
/**
 * @route   GET /api/v1/growth/koc/commissions
 * @desc    Get commission history and balance
 * @access  Private
 */
router.get('/koc/commissions', auth_1.authMiddleware, growth_1.getCommissions);
/**
 * @route   POST /api/v1/growth/koc/withdraw
 * @desc    Request commission withdrawal
 * @access  Private
 */
router.post('/koc/withdraw', auth_1.authMiddleware, growth_1.withdrawCommission);
/**
 * @route   GET /api/v1/growth/koc/dashboard
 * @desc    Get KOC dashboard with stats and analytics
 * @access  Private
 */
router.get('/koc/dashboard', auth_1.authMiddleware, growth_1.getKOCDashboard);
exports.default = router;
//# sourceMappingURL=growth.js.map