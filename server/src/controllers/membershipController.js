const { prisma } = require('../index');

/**
 * GET /api/v1/memberships/products
 * Get available membership products
 */
exports.getProducts = async (req, res) => {
  try {
    // Define membership tiers
    const products = [
      {
        id: 'basic',
        name: '基础版',
        description: '解锁基础报告内容',
        price: 990, // ¥9.9 in cents
        priceDisplay: '¥9.9',
        duration: 30, // days
        features: [
          '解锁完整人格报告',
          '查看四维得分详情',
          '基础发展建议',
          '30 天有效期',
        ],
        level: 1,
      },
      {
        id: 'standard',
        name: '标准版',
        description: '深度解析 + 职业匹配',
        price: 2900, // ¥29 in cents
        priceDisplay: '¥29',
        duration: 90, // days
        features: [
          '包含基础版所有功能',
          '职业匹配分析',
          '人际关系指南',
          '压力管理建议',
          '90 天有效期',
        ],
        level: 2,
        popular: true,
      },
      {
        id: 'premium',
        name: '尊享版',
        description: '全方位人格发展方案',
        price: 4900, // ¥49 in cents
        priceDisplay: '¥49',
        duration: 365, // days
        features: [
          '包含标准版所有功能',
          '学习风格分析',
          '16 页深度报告',
          '个性化发展计划',
          '全年无限次测试',
          '365 天有效期',
        ],
        level: 3,
      },
    ];

    res.json({ products });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to get products' });
  }
};

/**
 * GET /api/v1/memberships/me
 * Get current user's membership status
 */
exports.getMyMembership = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { status: 'active' },
          orderBy: { endDate: 'desc' },
          take: 1,
        },
      },
    });

    const activeMembership = user.memberships[0];

    if (!activeMembership || activeMembership.endDate < new Date()) {
      return res.json({
        isMember: false,
        level: null,
        expiryDate: null,
      });
    }

    res.json({
      isMember: true,
      level: activeMembership.level,
      startDate: activeMembership.startDate,
      endDate: activeMembership.endDate,
      autoRenew: activeMembership.autoRenew,
    });
  } catch (error) {
    console.error('Get membership error:', error);
    res.status(500).json({ error: 'Failed to get membership status' });
  }
};
