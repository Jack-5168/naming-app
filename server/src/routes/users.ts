/**
 * User Routes
 * Phase 1: MVP Implementation
 */

import { Router } from 'express';
import { getCurrentUser } from '../controllers/auth';
import { authMiddleware } from '../security/auth';

const router = Router();

/**
 * @route   GET /api/v1/users/me
 * @desc    Get current user info
 * @access  Private
 */
router.get('/me', authMiddleware, getCurrentUser);

export default router;
