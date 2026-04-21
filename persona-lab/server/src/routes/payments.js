const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');

// POST /api/v1/payments/create-order
router.post('/create-order', authenticate, paymentController.createOrder);

// POST /api/v1/payments/wechat/callback (public, no auth)
router.post('/wechat/callback', paymentController.wechatCallback);

module.exports = router;
