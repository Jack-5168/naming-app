const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET /api/v1/users/me
router.get('/me', userController.getMe);

// PUT /api/v1/users/me
router.put('/me', userController.updateMe);

// GET /api/v1/users/me/stats
router.get('/me/stats', userController.getUserStats);

module.exports = router;
