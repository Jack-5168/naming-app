import { Router } from 'express';
import { authRoutes } from './auth';
import { testRoutes } from './tests';
import { reportRoutes } from './reports';
import { paymentRoutes } from './payments';
import { membershipRoutes } from './memberships';

const router = Router();

router.use('/api/v1/auth', authRoutes);
router.use('/api/v1/tests', testRoutes);
router.use('/api/v1/reports', reportRoutes);
router.use('/api/v1/payments', paymentRoutes);
router.use('/api/v1/memberships', membershipRoutes);

// 健康检查
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 处理
router.use('*', (req, res) => {
  res.status(404).json({ code: 40401, message: '接口不存在' });
});

export { router as apiRoutes };
