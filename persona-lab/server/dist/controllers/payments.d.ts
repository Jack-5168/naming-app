/**
 * Payment Controller
 * Phase 1: MVP Implementation
 *
 * API Endpoints:
 * - GET /api/v1/memberships/products - Get membership products
 * - POST /api/v1/payments/create-order - Create payment order
 * - POST /api/v1/payments/wechat/callback - WeChat payment callback
 * - GET /api/v1/payments/orders/:order_id - Get order details
 */
import { Request, Response } from 'express';
/**
 * GET /api/v1/memberships/products
 * Get all available membership products
 *
 * Response format:
 * {
 *   "code": 0,
 *   "data": {
 *     "products": [...]
 *   }
 * }
 */
export declare function getMembershipProducts(req: Request, res: Response): Promise<void>;
/**
 * POST /api/v1/payments/create-order
 * Create a payment order
 *
 * Request:
 * - product_id: Product identifier (e.g., "pro_monthly")
 * - payment_method: Payment method (e.g., "wechat")
 *
 * Response:
 * {
 *   "code": 0,
 *   "data": {
 *     "order_id": "ORD202401150001",
 *     "order_no": "wx20240115xxxx",
 *     "amount": 49.00,
 *     "payment_params": { ... }
 *   }
 * }
 */
export declare function createOrder(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /api/v1/payments/wechat/callback
 * WeChat payment callback webhook
 *
 * Content-Type: application/xml
 *
 * Processing logic:
 * 1. Verify signature
 * 2. Update order status
 * 3. Activate membership benefits
 * 4. Send push notification
 */
export declare function wechatPaymentCallback(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * GET /api/v1/payments/orders/:order_id
 * Get order details by order ID
 *
 * Response:
 * {
 *   "code": 0,
 *   "data": {
 *     "order_id": "ORD202401150001",
 *     "order_no": "wx20240115xxxx",
 *     "product_name": "专业会员",
 *     "amount": 49.00,
 *     "status": "paid",
 *     "payment_time": "2024-01-15T10:35:00Z"
 *   }
 * }
 */
export declare function getOrder(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
declare const _default: {
    getMembershipProducts: typeof getMembershipProducts;
    createOrder: typeof createOrder;
    wechatPaymentCallback: typeof wechatPaymentCallback;
    getOrder: typeof getOrder;
};
export default _default;
//# sourceMappingURL=payments.d.ts.map