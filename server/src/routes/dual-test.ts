/**
 * Dual Test Routes - 双人合测路由
 * Phase 4: Growth Features
 */

import { Router } from 'express';
import {
  createDualTestInvitation,
  acceptDualTestInvitation,
  completeDualTest,
  getDualTestDetails,
  getDualTestReport,
  getDualTestByInviteCode,
} from '../controllers/dual-test';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Public routes (no auth required)
router.get('/invite/:code', getDualTestByInviteCode);

// Protected routes (auth required)
router.use(authMiddleware);

router.post('/create', createDualTestInvitation);
router.post('/accept', acceptDualTestInvitation);
router.post('/complete', completeDualTest);
router.get('/:id', getDualTestDetails);
router.get('/:id/report', getDualTestReport);

export { router as dualTestRoutes };
