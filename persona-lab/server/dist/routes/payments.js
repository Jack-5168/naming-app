"use strict";
/**
 * Payment Routes
 * Phase 1: MVP Implementation
 *
 * Handles payment order creation, webhooks, and refunds
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRoutes = void 0;
const express_1 = require("express");
const payments_1 = require("../controllers/payments");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
exports.paymentRoutes = router;
/**
 * @route   GET /api/v1/memberships/products
 * @desc    Get all available membership products
 * @access  Public
 *
 * @returns { products: [{ id, level, name, period, price, original_price, features }] }
 */
router.get('/memberships/products', payments_1.getMembershipProducts);
/**
 * @route   POST /api/v1/payments/create-order
 * @desc    Create a payment order for membership or report unlock
 * @access  Private
 *
 * @headers { Authorization: Bearer <token> }
 * @body    { productId: number, productType: 'membership' | 'report' }
 * @returns { orderId, orderNo, amount, currency, paymentData }
 */
router.post('/create-order', auth_1.authMiddleware, payments_1.createOrder);
/**
 * @route   POST /api/v1/payments/wechat/callback
 * @desc    WeChat payment webhook callback (public endpoint)
 * @access  Public
 *
 * @body    { orderId, transactionId, status, timestamp, sign } - WeChat payment notification
 * @returns { success: true } - Must return success to acknowledge
 */
router.post('/wechat/callback', payments_1.wechatPaymentCallback);
/**
 * @route   GET /api/v1/payments/orders
 * @desc    Get user's payment order history
 * @access  Private
 *
 * @headers { Authorization: Bearer <token> }
 * @query   { page?: number, limit?: number, status?: string }
 * @returns { orders: [], total, page, limit }
 */
router.get('/orders', auth_1.authMiddleware, payments_1.getOrderHistory);
/**
 * @route   GET /api/v1/payments/orders/:id
 * @desc    Get detailed order information
 * @access  Private
 *
 * @headers { Authorization: Bearer <token> }
 * @params  { id: string } - Order ID
 * @returns { orderId, orderNo, amount, status, paymentTime, productInfo }
 */
router.get('/orders/:id', auth_1.authMiddleware, payments_1.getOrder);
/**
 * @route   POST /api/v1/payments/refund
 * @desc    Process refund for an order
 * @access  Private
 *
 * @headers { Authorization: Bearer <token> }
 * @body    { orderId: number, reason: string }
 * @returns { success, refundId, amount, status }
 */
router.post('/refund', auth_1.authMiddleware, payments_1.processRefund);
exports.default = router;
//# sourceMappingURL=payments.js.map