/**
 * Payment Routes
 * Phase 1: MVP Implementation
 * 
 * Handles payment order creation, webhooks, and refunds
 */

import { Router } from 'express';
import {
  getMembershipProducts,
  createOrder,
  wechatPaymentCallback,
  getOrder,
  getOrderHistory,
  processRefund,
} from '../controllers/payments';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/v1/memberships/products
 * @desc    Get all available membership products
 * @access  Public
 * 
 * @returns { products: [{ id, level, name, period, price, original_price, features }] }
 */
router.get('/memberships/products', getMembershipProducts);

/**
 * @route   POST /api/v1/payments/create-order
 * @desc    Create a payment order for membership or report unlock
 * @access  Private
 * 
 * @headers { Authorization: Bearer <token> }
 * @body    { productId: number, productType: 'membership' | 'report' }
 * @returns { orderId, orderNo, amount, currency, paymentData }
 */
router.post('/create-order', authMiddleware, createOrder);

/**
 * @route   POST /api/v1/payments/wechat/callback
 * @desc    WeChat payment webhook callback (public endpoint)
 * @access  Public
 * 
 * @body    { orderId, transactionId, status, timestamp, sign } - WeChat payment notification
 * @returns { success: true } - Must return success to acknowledge
 */
router.post('/wechat/callback', wechatPaymentCallback);

/**
 * @route   GET /api/v1/payments/orders
 * @desc    Get user's payment order history
 * @access  Private
 * 
 * @headers { Authorization: Bearer <token> }
 * @query   { page?: number, limit?: number, status?: string }
 * @returns { orders: [], total, page, limit }
 */
router.get('/orders', authMiddleware, getOrderHistory);

/**
 * @route   GET /api/v1/payments/orders/:id
 * @desc    Get detailed order information
 * @access  Private
 * 
 * @headers { Authorization: Bearer <token> }
 * @params  { id: string } - Order ID
 * @returns { orderId, orderNo, amount, status, paymentTime, productInfo }
 */
router.get('/orders/:id', authMiddleware, getOrder);

/**
 * @route   POST /api/v1/payments/refund
 * @desc    Process refund for an order
 * @access  Private
 * 
 * @headers { Authorization: Bearer <token> }
 * @body    { orderId: number, reason: string }
 * @returns { success, refundId, amount, status }
 */
router.post('/refund', authMiddleware, processRefund);

export default router;
export { router as paymentRoutes };
