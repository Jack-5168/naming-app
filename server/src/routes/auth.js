const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// POST /api/v1/auth/wechat/login
router.post('/wechat/login', authController.wechatLogin);

// POST /api/v1/auth/refresh
router.post('/refresh', authController.refreshToken);

// POST /api/v1/auth/wechat/userinfo
router.post('/wechat/userinfo', authenticate, authController.updateUserInfo);

module.exports = router;
