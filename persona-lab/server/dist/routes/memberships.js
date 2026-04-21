"use strict";
/**
 * Membership Routes
 * Phase 4: Membership System
 *
 * Handles membership products, user status, and upgrades
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.membershipRoutes = void 0;
const express_1 = require("express");
const memberships_1 = require("../controllers/memberships");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
exports.membershipRoutes = router;
/**
 * @route   GET /api/v1/memberships/products
 * @desc    Get all available membership products (6 tiers)
 * @access  Public
 *
 * @returns { products: [{ id, name, description, price, durationDays, level, pricePerUse }] }
 */
router.get('/products', memberships_1.getMembershipProducts);
/**
 * @route   GET /api/v1/memberships/me
 * @desc    Get current user's membership status and benefits
 * @access  Private
 *
 * @headers { Authorization: Bearer <token> }
 * @returns { membership: { level, expiresAt, benefits }, isActive }
 */
router.get('/me', auth_1.authMiddleware, memberships_1.getCurrentMembership);
/**
 * @route   POST /api/v1/memberships/upgrade
 * @desc    Upgrade user's membership level
 * @access  Private
 *
 * @headers { Authorization: Bearer <token> }
 * @body    { productId: number }
 * @returns { success, newLevel, expiresAt }
 */
router.post('/upgrade', auth_1.authMiddleware, memberships_1.upgradeMembership);
/**
 * @route   GET /api/v1/memberships/benefits
 * @desc    Get detailed benefits for all membership levels
 * @access  Public
 *
 * @returns { benefits: { basic: [], standard: [], premium: [], ... } }
 */
router.get('/benefits', memberships_1.getMembershipBenefits);
exports.default = router;
//# sourceMappingURL=memberships.js.map