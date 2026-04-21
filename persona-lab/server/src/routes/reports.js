const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// POST /api/v1/reports
router.post('/', reportController.generateReport);

// GET /api/v1/reports/:id
router.get('/:id', reportController.getReport);

// GET /api/v1/reports
router.get('/', reportController.getReportHistory);

module.exports = router;
