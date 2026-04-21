/**
 * Membership Routes
 * Phase 4: Membership System
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
 */
router.get('/products', getMembershipProducts);

/**
 * @route   GET /api/v1/memberships/me
 * @desc    Get current user's membership status and benefits
 * @access  Private
 */
router.get('/me', authMiddleware, getCurrentMembership);

/**
 * @route   POST /api/v1/memberships/upgrade
 * @desc    Upgrade user's membership
 * @access  Private
 */
router.post('/upgrade', authMiddleware, upgradeMembership);

/**
 * @route   GET /api/v1/memberships/benefits
 * @desc    Get detailed benefits for membership levels
 * @access  Public
 */
router.get('/benefits', getMembershipBenefits);

export default router;
