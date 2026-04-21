"use strict";
/**
 * API Routes Index
 * Phase 1: MVP Implementation
 *
 * Central router that aggregates all module routes
 * with API versioning and global error handling
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("./auth"));
const tests_1 = __importDefault(require("./tests"));
const reports_1 = __importDefault(require("./reports"));
const payments_1 = __importDefault(require("./payments"));
const memberships_1 = __importDefault(require("./memberships"));
const growth_1 = __importDefault(require("./growth"));
const router = (0, express_1.Router)();
exports.apiRoutes = router;
// ==================== API Version Prefix ====================
// Auth module - Public & Private endpoints
router.use('/api/v1/auth', auth_1.default);
// Test module - Private endpoints (requires authentication)
router.use('/api/v1/tests', tests_1.default);
// Report module - Mixed (sample is public, others private)
router.use('/api/v1/reports', reports_1.default);
// Payment module - Mixed (webhook is public, others private)
router.use('/api/v1/payments', payments_1.default);
// Membership module - Mixed (products/benefits public, user data private)
router.use('/api/v1/memberships', memberships_1.default);
// Growth module - Private endpoints
router.use('/api/v1/growth', growth_1.default);
// ==================== Health Check ====================
/**
 * @route   GET /health
 * @desc    Health check endpoint for monitoring
 * @access  Public
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
// ==================== 404 Handler ====================
/**
 * Catch-all route for undefined API endpoints
 * Returns 404 with standardized error format
 */
router.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 40401,
            message: '接口不存在',
            path: req.path,
        },
    });
});
exports.default = router;
//# sourceMappingURL=index.js.map