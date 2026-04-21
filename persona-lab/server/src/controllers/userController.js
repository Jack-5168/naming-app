const { prisma } = require('../index');

/**
 * GET /api/v1/users/me
 * Get current user information
 */
exports.getMe = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        openid: true,
        unionid: true,
        nickname: true,
        avatarUrl: true,
        gender: true,
        city: true,
        province: true,
        country: true,
        language: true,
        phone: true,
        isMember: true,
        membershipLevel: true,
        membershipExpiry: true,
        testCount: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
};

/**
 * PUT /api/v1/users/me
 * Update current user information
 */
exports.updateMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const { nickname, phone, city, province, country } = req.body;

    const updateData = {};
    if (nickname) updateData.nickname = nickname;
    if (phone) updateData.phone = phone;
    if (city) updateData.city = city;
    if (province) updateData.province = province;
    if (country) updateData.country = country;

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    res.json({
      user: {
        id: user.id,
        nickname: user.nickname,
        phone: user.phone,
        city: user.city,
        province: user.province,
        country: user.country,
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user info' });
  }
};

/**
 * GET /api/v1/users/me/stats
 * Get user statistics
 */
exports.getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const testCount = await prisma.testResult.count({
      where: { userId },
    });

    const reportCount = await prisma.report.count({
      where: { userId },
    });

    const avgStabilityIndex = await prisma.testResult.aggregate({
      where: { userId },
      _avg: { stabilityIndex: true },
    });

    const recentTests = await prisma.testResult.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        personalityType: true,
        stabilityIndex: true,
        createdAt: true,
      },
    });

    res.json({
      stats: {
        testCount,
        reportCount,
        avgStabilityIndex: avgStabilityIndex._avg.stabilityIndex || 0,
      },
      recentTests,
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to get user stats' });
  }
};
