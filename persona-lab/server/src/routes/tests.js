const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');
const { authenticate, testRateLimit } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// POST /api/v1/tests/sessions
router.post('/sessions', testRateLimit, testController.createSession);

// GET /api/v1/tests/sessions/:id/next
router.get('/sessions/:id/next', testController.getNextQuestion);

// POST /api/v1/tests/sessions/:id/answer
router.post('/sessions/:id/answer', testController.submitAnswer);

// GET /api/v1/tests/results/:id
router.get('/results/:id', testController.getTestResults);

module.exports = router;
