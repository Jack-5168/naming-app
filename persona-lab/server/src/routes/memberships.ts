/**
 * Membership Routes
 * Phase 4: Membership System
 * 
 * Handles membership products, user status, and upgrades
 */

import { Router } from 'express';
import {
  getMembershipProducts,
  getCurrentMembership,
  upgradeMembership,
  getMembershipBenefits,
} from '../controllers/memberships';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/v1/memberships/products
 * @desc    Get all available membership products (6 tiers)
 * @access  Public
 * 
 * @returns { products: [{ id, name, description, price, durationDays, level, pricePerUse }] }
 */
router.get('/products', getMembershipProducts);

/**
 * @route   GET /api/v1/memberships/me
 * @desc    Get current user's membership status and benefits
 * @access  Private
 * 
 * @headers { Authorization: Bearer <token> }
 * @returns { membership: { level, expiresAt, benefits }, isActive }
 */
router.get('/me', authMiddleware, getCurrentMembership);

/**
 * @route   POST /api/v1/memberships/upgrade
 * @desc    Upgrade user's membership level
 * @access  Private
 * 
 * @headers { Authorization: Bearer <token> }
 * @body    { productId: number }
 * @returns { success, newLevel, expiresAt }
 */
router.post('/upgrade', authMiddleware, upgradeMembership);

/**
 * @route   GET /api/v1/memberships/benefits
 * @desc    Get detailed benefits for all membership levels
 * @access  Public
 * 
 * @returns { benefits: { basic: [], standard: [], premium: [], ... } }
 */
router.get('/benefits', getMembershipBenefits);

export default router;
export { router as membershipRoutes };
