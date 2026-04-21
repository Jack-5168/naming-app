"use strict";
/**
 * User Routes
 * Phase 1: MVP Implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../controllers/auth");
const auth_2 = require("../security/auth");
const router = (0, express_1.Router)();
/**
 * @route   GET /api/v1/users/me
 * @desc    Get current user info
 * @access  Private
 */
router.get('/me', auth_2.authMiddleware, auth_1.getCurrentUser);
exports.default = router;
//# sourceMappingURL=users.js.map