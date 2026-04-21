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
import { PrismaClient } from '@prisma/client';
import { createPushNotification } from '../services/push-notification';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// ==================== Configuration ====================

// WeChat Pay configuration from environment variables
const WECHAT_PAY_MCHID = process.env.WECHAT_PAY_MCHID || '1234567890';
const WECHAT_PAY_KEY = process.env.WECHAT_PAY_KEY || 'your_wechat_pay_key';
const WECHAT_PAY_APPID = process.env.WECHAT_PAY_APPID || 'wx1234567890';

// ==================== Membership Products Configuration ====================

/**
 * Predefined membership products
 * These products are returned by GET /api/v1/memberships/products
 */
const MEMBERSHIP_PRODUCTS = [
  {
    id: 'single_unlock',
    level: 'free',
    name: '单次测试解锁',
    period: '永久',
    price: 29.00,
    original_price: 29.00,
    features: [
      { key: 'report_pro', name: '完整报告', unlimited: false, limit: 1 }
    ]
  },
  {
    id: 'basic_unlock',
    level: 'basic',
    name: '基础解锁',
    period: '永久',
    price: 9.90,
    original_price: 19.90,
    features: [
      { key: 'report_basic', name: '基础报告', unlimited: false, limit: 5 },
      { key: 'career', name: '职业建议', unlimited: false, limit: 1 }
    ]
  },
  {
    id: 'pro_monthly',
    level: 'pro',
    name: '专业会员',
    period: '月卡',
    price: 49.00,
    original_price: 59.00,
    features: [
      { key: 'report_basic', name: '基础报告', unlimited: true },
      { key: 'report_pro', name: '深度报告', unlimited: true },
      { key: 'life_event', name: '生活事件', unlimited: true }
    ]
  }
];

// ==================== Type Definitions ====================

interface MembershipProduct {
  id: string;
  level: string;
  name: string;
  period: string;
  price: number;
  original_price: number;
  features: Array<{
    key: string;
    name: string;
    unlimited: boolean;
    limit?: number;
  }>;
}

interface WechatPaymentParams {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: string;
  paySign: string;
}

// ==================== API Controllers ====================

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
export async function getMembershipProducts(req: Request, res: Response) {
  try {
    // Return predefined products as specified in the requirements
    // In production, these could be fetched from database
    res.json({
      code: 0,
      data: {
        products: MEMBERSHIP_PRODUCTS
      }
    });
  } catch (error) {
    console.error('Error fetching membership products:', error);
    res.status(500).json({
      code: 500,
      message: '获取会员产品失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

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
export async function createOrder(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const { product_id, payment_method } = req.body;

    // Validate authentication
    if (!userId) {
      return res.status(401).json({
        code: 401,
        message: '未授权访问',
      });
    }

    // Validate required fields
    if (!product_id) {
      return res.status(400).json({
        code: 400,
        message: '产品 ID 不能为空',
      });
    }

    if (!payment_method) {
      return res.status(400).json({
        code: 400,
        message: '支付方式不能为空',
      });
    }

    // Find product from predefined list
    const product = MEMBERSHIP_PRODUCTS.find(p => p.id === product_id);
    if (!product) {
      return res.status(404).json({
        code: 404,
        message: '产品不存在',
      });
    }

    // Generate unique order number
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const orderNo = `${payment_method}${new Date().toISOString().replace(/[-:TZ]/g, '').substring(0, 14)}${randomStr}`;
    const orderId = `ORD${new Date().toISOString().replace(/[-:TZ]/g, '').substring(0, 14)}${randomStr}`;

    // Create order in database
    const order = await prisma.order.create({
      data: {
        orderNo,
        userId,
        productId: product_id,
        productType: 'membership',
        amount: product.price,
        currency: 'CNY',
        status: 'pending',
        paymentMethod: payment_method,
      },
    });

    // Generate WeChat payment parameters
    const paymentParams = generateWechatPaymentParams({
      orderId: order.id.toString(),
      orderNo: order.orderNo,
      amount: product.price,
      appId: WECHAT_PAY_APPID,
      mchId: WECHAT_PAY_MCHID,
      key: WECHAT_PAY_KEY,
    });

    // Log order creation
    console.log(`Order created: ${order.orderNo} for user ${userId}, amount: ${product.price}`);

    res.json({
      code: 0,
      data: {
        order_id: order.id.toString(),
        order_no: order.orderNo,
        amount: Number(order.amount),
        payment_params: paymentParams,
      },
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      code: 500,
      message: '创建订单失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

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
export async function wechatPaymentCallback(req: Request, res: Response) {
  try {
    // Parse XML callback data
    const xmlData = req.body;
    const callbackData = parseWechatCallbackXml(xmlData);

    // Step 1: Verify WeChat signature
    const isValid = verifyWechatSignature(callbackData);
    if (!isValid) {
      console.error('Invalid WeChat signature');
      return res.status(400).send(`
        <xml>
          <return_code><![CDATA[FAIL]]></return_code>
          <return_msg><![CDATA[签名验证失败]]></return_msg>
        </xml>
      `);
    }

    // Extract callback data
    const { 
      out_trade_no,      // Our order number
      transaction_id,    // WeChat transaction ID
      trade_state,       // Payment status
      total_fee,         // Amount in cents
      openid             // User's WeChat openid
    } = callbackData;

    // Find order by order number
    const order: any = await prisma.order.findUnique({
      where: { orderNo: out_trade_no },
    });

    if (!order) {
      console.error(`Order not found: ${out_trade_no}`);
      return res.status(404).send(`
        <xml>
          <return_code><![CDATA[FAIL]]></return_code>
          <return_msg><![CDATA[订单不存在]]></return_msg>
        </xml>
      `);
    }

    // Check if already processed
    if (order.status === 'paid') {
      console.log(`Order already paid: ${out_trade_no}`);
      return res.send(`
        <xml>
          <return_code><![CDATA[SUCCESS]]></return_code>
          <return_msg><![CDATA[OK]]></return_msg>
        </xml>
      `);
    }

    // Step 2: Update order status if payment successful
    if (trade_state === 'SUCCESS') {
      // Verify amount matches
      const amountInCents = Math.round(Number(order.amount) * 100);
      if (amountInCents !== total_fee) {
        console.error(`Amount mismatch: expected ${amountInCents}, got ${total_fee}`);
        return res.status(400).send(`
          <xml>
            <return_code><![CDATA[FAIL]]></return_code>
            <return_msg><![CDATA[金额不匹配]]></return_msg>
          </xml>
        `);
      }

      // Update order status
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'paid',
          transactionId: transaction_id,
          paidAt: new Date(),
        },
      });

      console.log(`Order paid: ${out_trade_no}, transaction: ${transaction_id}`);

      // Step 3: Activate membership benefits
      await activateMembershipBenefits(order);

      // Step 4: Send push notification to user
      try {
        const userId = order.userId;
        await createPushNotification({
          userId,
          type: 'payment_success',
          title: '支付成功',
          content: `您已成功支付¥${Number(order.amount)}，会员权益已激活`,
          deepLink: '/user/membership',
        });
        console.log(`Push notification sent to user ${userId}`);
      } catch (notifError) {
        console.error('Failed to send push notification:', notifError);
        // Don't fail the callback if notification fails
      }
    }

    // Return success response to WeChat
    res.send(`
      <xml>
        <return_code><![CDATA[SUCCESS]]></return_code>
        <return_msg><![CDATA[OK]]></return_msg>
      </xml>
    `);
  } catch (error) {
    console.error('Error processing WeChat callback:', error);
    res.status(500).send(`
      <xml>
        <return_code><![CDATA[FAIL]]></return_code>
        <return_msg><![CDATA[系统错误]]></return_msg>
      </xml>
    `);
  }
}

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
export async function getOrder(req: Request, res: Response) {
  try {
    const { order_id } = req.params;
    const userId = (req as any).user?.id;

    // Validate authentication
    if (!userId) {
      return res.status(401).json({
        code: 401,
        message: '未授权访问',
      });
    }

    // Find order by ID
    const order: any = await prisma.order.findUnique({
      where: { id: parseInt(order_id) },
    });

    if (!order) {
      return res.status(404).json({
        code: 404,
        message: '订单不存在',
      });
    }

    // Check ownership (users can only view their own orders)
    if (order.userId !== userId) {
      return res.status(403).json({
        code: 403,
        message: '无权访问此订单',
      });
    }

    // Get product name from predefined list or use product ID
    const product = MEMBERSHIP_PRODUCTS.find(p => p.id === order.productId);
    const productName = product ? product.name : order.productId;

    res.json({
      code: 0,
      data: {
        order_id: order.id.toString(),
        order_no: order.orderNo,
        product_name: productName,
        product_id: order.productId,
        amount: Number(order.amount),
        currency: order.currency,
        status: order.status,
        payment_method: order.paymentMethod,
        transaction_id: order.transactionId,
        payment_time: order.paidAt ? order.paidAt.toISOString() : null,
        created_at: order.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error getting order:', error);
    res.status(500).json({
      code: 500,
      message: '获取订单失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// ==================== Helper Functions ====================

/**
 * Generate WeChat payment parameters
 * Creates the necessary parameters for WeChat Pay JS API
 */
function generateWechatPaymentParams(params: {
  orderId: string;
  orderNo: string;
  amount: number;
  appId: string;
  mchId: string;
  key: string;
}): WechatPaymentParams {
  const { orderId, orderNo, amount, appId, mchId, key } = params;
  
  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = Math.random().toString(36).substring(2, 16).toUpperCase();
  
  // Create prepay_id (in production, this comes from WeChat Pay API)
  const prepayId = `prepay_id=${orderId}_${timeStamp}`;
  
  // Generate signature for WeChat Pay
  // Signature string format: appId=&nonceStr=&package=&signType=&timeStamp=
  const signString = `appId=${appId}&nonceStr=${nonceStr}&package=prepay_id=${prepayId}&signType=MD5&timeStamp=${timeStamp}&key=${key}`;
  const paySign = crypto
    .createHash('md5')
    .update(signString)
    .digest('hex')
    .toUpperCase();

  return {
    appId,
    timeStamp,
    nonceStr,
    package: prepayId,
    signType: 'MD5',
    paySign,
  };
}

/**
 * Parse WeChat callback XML
 * Converts XML string to JavaScript object
 */
function parseWechatCallbackXml(xmlData: any): Record<string, any> {
  // In production, use a proper XML parser like 'xml2js'
  // For MVP, we'll handle both parsed JSON and raw XML
  
  if (typeof xmlData === 'object' && xmlData.xml) {
    // Already parsed by express-xml middleware
    const data = xmlData.xml;
    return {
      return_code: data.return_code?.[0] || '',
      return_msg: data.return_msg?.[0] || '',
      appid: data.appid?.[0] || '',
      mch_id: data.mch_id?.[0] || '',
      nonce_str: data.nonce_str?.[0] || '',
      sign: data.sign?.[0] || '',
      result_code: data.result_code?.[0] || '',
      openid: data.openid?.[0] || '',
      trade_type: data.trade_type?.[0] || '',
      bank_type: data.bank_type?.[0] || '',
      total_fee: parseInt(data.total_fee?.[0] || '0'),
      fee_type: data.fee_type?.[0] || 'CNY',
      transaction_id: data.transaction_id?.[0] || '',
      out_trade_no: data.out_trade_no?.[0] || '',
      attach: data.attach?.[0] || '',
      time_end: data.time_end?.[0] || '',
      trade_state: data.trade_state?.[0] || '',
      trade_state_desc: data.trade_state_desc?.[0] || '',
    };
  }
  
  // Fallback for testing
  return xmlData;
}

/**
 * Verify WeChat payment signature
 * Validates the signature sent by WeChat Pay
 */
function verifyWechatSignature(data: Record<string, any>): boolean {
  const { sign, ...params } = data;
  
  if (!sign) {
    console.error('No signature provided');
    return false;
  }

  // Sort parameters alphabetically
  const sortedKeys = Object.keys(params).sort();
  
  // Build signature string
  const signString = sortedKeys
    .filter(key => params[key] && params[key] !== '')
    .map(key => `${key}=${params[key]}`)
    .join('&') + `&key=${WECHAT_PAY_KEY}`;

  // Calculate MD5 signature
  const calculatedSign = crypto
    .createHash('md5')
    .update(signString)
    .digest('hex')
    .toUpperCase();

  // Compare signatures
  const isValid = calculatedSign === sign.toUpperCase();
  
  if (!isValid) {
    console.error('Signature mismatch');
    console.error('Expected:', sign);
    console.error('Calculated:', calculatedSign);
  }

  return isValid;
}

/**
 * Activate membership benefits after successful payment
 * Updates user's membership level and creates membership record
 */
async function activateMembershipBenefits(order: any) {
  const { userId, productId, id: orderId } = order;
  
  // Find product configuration
  const product = MEMBERSHIP_PRODUCTS.find(p => p.id === productId);
  if (!product) {
    console.error(`Product not found for order ${orderId}: ${productId}`);
    return;
  }

  const now = new Date();
  
  // Calculate membership end date based on product period
  let endDate: Date;
  switch (product.period) {
    case '月卡':
      endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      break;
    case '季卡':
      endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      break;
    case '年卡':
      endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      break;
    case '永久':
    default:
      // For permanent products, set far future date
      endDate = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);
      break;
  }

  try {
    // Check if user has existing membership
    const existingMembership: any = await prisma.membership.findUnique({
      where: { userId },
    });

    if (existingMembership && existingMembership.status === 'active') {
      // Extend existing membership
      const newEndDate = product.period === '永久'
        ? endDate
        : new Date(Math.max(existingMembership.endDate.getTime(), now.getTime()) + 
                   (endDate.getTime() - now.getTime()));

      await prisma.membership.update({
        where: { userId },
        data: {
          level: product.level,
          endDate: newEndDate,
          status: 'active',
          autoRenew: false,
        },
      });

      // Link order to membership
      await prisma.order.update({
        where: { id: orderId },
        data: { membershipId: existingMembership.id },
      });

      console.log(`Membership extended for user ${userId} until ${newEndDate}`);
    } else {
      // Create new membership
      const newMembership: any = await prisma.membership.create({
        data: {
          userId,
          level: product.level,
          status: 'active',
          startDate: now,
          endDate,
          autoRenew: false,
        },
      });

      // Link order to membership
      await prisma.order.update({
        where: { id: orderId },
        data: { membershipId: newMembership.id },
      });

      console.log(`New membership created for user ${userId} until ${endDate}`);
    }

    // Update user's membership level
    await prisma.user.update({
      where: { id: userId },
      data: {
        membershipLevel: product.level,
      },
    });

  } catch (error) {
    console.error('Error activating membership benefits:', error);
    throw error;
  }
}

export default {
  getMembershipProducts,
  createOrder,
  wechatPaymentCallback,
  getOrder,
};
