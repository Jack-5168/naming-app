const express = require('express');
const router = express.Router();
const membershipController = require('../controllers/membershipController');
const { authenticate } = require('../middleware/auth');

// GET /api/v1/memberships/products (public)
router.get('/products', membershipController.getProducts);

// All other routes require authentication
router.use(authenticate);

// GET /api/v1/memberships/me
router.get('/me', membershipController.getMyMembership);

module.exports = router;
