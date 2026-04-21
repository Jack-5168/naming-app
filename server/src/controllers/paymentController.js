const { prisma } = require('../index');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// WeChat Pay configuration
const WECHAT_MCH_ID = process.env.WECHAT_MCH_ID;
const WECHAT_API_KEY = process.env.WECHAT_API_KEY;
const WECHAT_NOTIFY_URL = process.env.WECHAT_NOTIFY_URL;

/**
 * POST /api/v1/payments/create-order
 * Create a payment order
 */
exports.createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, level } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'Product ID required' });
    }

    // Get product info
    const products = {
      basic: { name: '基础版', price: 990, level: 1, duration: 30 },
      standard: { name: '标准版', price: 2900, level: 2, duration: 90 },
      premium: { name: '尊享版', price: 4900, level: 3, duration: 365 },
    };

    const product = products[productId];
    if (!product) {
      return res.status(400).json({ error: 'Invalid product' });
    }

    // Generate order number
    const orderNo = `ORD${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Calculate expiry time (15 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // Create order
    const order = await prisma.order.create({
      data: {
        userId,
        orderNo,
        productId,
        productName: product.name,
        amount: product.price,
        status: 'pending',
        expiresAt,
        metadata: {
          level: product.level,
          duration: product.duration,
        },
      },
    });

    // Create WeChat Pay parameters
    const payParams = {
      appid: process.env.WECHAT_APP_ID,
      mchid: WECHAT_MCH_ID,
      nonce_str: uuidv4().replace(/-/g, ''),
      out_trade_no: orderNo,
      total_amount: product.price,
      notify_url: WECHAT_NOTIFY_URL,
      trade_type: 'JSAPI',
      openid: req.user.openid,
    };

    // Generate signature
    const sign = generateWeChatSign(payParams);
    payParams.sign = sign;

    // In production, call WeChat Pay API to get prepay_id
    // For MVP, return mock payment parameters
    const paymentParams = {
      appId: process.env.WECHAT_APP_ID,
      timeStamp: Math.floor(Date.now() / 1000).toString(),
      nonceStr: payParams.nonce_str,
      package: `prepay_id=mock_prepay_${orderNo}`,
      signType: 'RSA',
      paySign: 'mock_signature',
    };

    res.json({
      orderId: order.id,
      orderNo: order.orderNo,
      amount: order.amount,
      amountDisplay: `¥${(order.amount / 100).toFixed(2)}`,
      expiresAt: order.expiresAt,
      paymentParams,
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
};

/**
 * POST /api/v1/payments/wechat/callback
 * WeChat Pay callback handler
 */
exports.wechatCallback = async (req, res) => {
  try {
    const xmlData = req.body;
    
    // Parse XML (in production, use xml2js library)
    const result = parseXml(xmlData);

    // Verify signature
    if (!verifyWeChatSign(result)) {
      return res.status(400).send('<xml><return_code><![CDATA[FAIL]]></return_code></xml>');
    }

    if (result.return_code !== 'SUCCESS' || result.result_code !== 'SUCCESS') {
      return res.status(400).send('<xml><return_code><![CDATA[FAIL]]></return_code></xml>');
    }

    const { out_trade_no, transaction_id, total_fee } = result;

    // Find order
    const order = await prisma.order.findUnique({
      where: { orderNo: out_trade_no },
    });

    if (!order || order.status !== 'pending') {
      return res.status(400).send('<xml><return_code><![CDATA[FAIL]]></return_code></xml>');
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

    // Create membership
    const metadata = order.metadata || {};
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (metadata.duration || 30));

    await prisma.membership.create({
      data: {
        userId: order.userId,
        level: metadata.level || 1,
        status: 'active',
        startDate: new Date(),
        endDate,
        autoRenew: false,
        paymentMethod: 'wechat',
      },
    });

    // Update user membership status
    await prisma.user.update({
      where: { id: order.userId },
      data: {
        isMember: true,
        membershipLevel: metadata.level || 1,
        membershipExpiry: endDate,
      },
    });

    // Send success response to WeChat
    res.send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
  } catch (error) {
    console.error('WeChat callback error:', error);
    res.status(500).send('<xml><return_code><![CDATA[FAIL]]></return_code></xml>');
  }
};

// Helper function to generate WeChat signature
function generateWeChatSign(params) {
  const sortedKeys = Object.keys(params).sort();
  const stringA = sortedKeys
    .map(key => `${key}=${params[key]}`)
    .join('&');
  const stringSignTemp = `${stringA}&key=${WECHAT_API_KEY}`;
  
  return crypto
    .createHash('md5')
    .update(stringSignTemp)
    .digest('hex')
    .toUpperCase();
}

// Helper function to verify WeChat signature
function verifyWeChatSign(result) {
  const receivedSign = result.sign;
  const { sign, ...params } = result;
  const calculatedSign = generateWeChatSign(params);
  
  return receivedSign === calculatedSign;
}

// Simple XML parser (in production, use xml2js)
function parseXml(xml) {
  const result = {};
  const matches = xml.match(/<([^>]+)>([^<]*)<\/\1>/g);
  if (matches) {
    matches.forEach(match => {
      const [, key, value] = match.match(/<([^>]+)>([^<]*)<\/\1>/);
      result[key] = value;
    });
  }
  return result;
}
