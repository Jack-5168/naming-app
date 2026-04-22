/**
 * Share Routes - 分享功能路由
 * Phase 4: Growth Features
 */

import { Router } from 'express';
import {
  generatePersonalityShareCard,
  generateStabilityShareCard,
  generateDualTestShareCard,
  trackShare,
  getShareStats,
  createInviteCode,
  validateInviteCode,
  useInviteCode,
} from '../controllers/share';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Public routes (no auth required)
router.get('/invite-code/:code', validateInviteCode);
router.post('/invite-code/:code/use', useInviteCode);

// Protected routes (auth required)
router.use(authMiddleware);

router.get('/card/personality', generatePersonalityShareCard);
router.get('/card/stability', generateStabilityShareCard);
router.get('/card/dual-test', generateDualTestShareCard);
router.post('/track', trackShare);
router.get('/stats', getShareStats);
router.post('/invite-code', createInviteCode);

export { router as shareRoutes };
