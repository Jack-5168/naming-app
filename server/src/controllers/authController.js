const { prisma } = require('../index');
const { generateTokens, storeRefreshToken } = require('../middleware/auth');
const axios = require('axios');
const crypto = require('crypto');

// WeChat OAuth2 credentials
const WECHAT_APP_ID = process.env.WECHAT_APP_ID;
const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET;

/**
 * POST /api/v1/auth/wechat/login
 * WeChat login - exchange code for openid, then create/find user
 */
exports.wechatLogin = async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Login code required' });
    }

    // Exchange code for openid (WeChat Mini Program)
    const wechatResponse = await axios.get(
      'https://api.weixin.qq.com/sns/jscode2session',
      {
        params: {
          appid: WECHAT_APP_ID,
          secret: WECHAT_APP_SECRET,
          js_code: code,
          grant_type: 'authorization_code',
        },
      }
    );

    const { openid, unionid, errcode, errmsg } = wechatResponse.data;

    if (errcode) {
      return res.status(400).json({ error: `WeChat API error: ${errmsg}` });
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { openid } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          openid,
          unionid: unionid || null,
          lastLoginAt: new Date(),
        },
      });
    } else {
      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    // Store refresh token
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 30);
    await storeRefreshToken(user.id, refreshToken, refreshExpiresAt);

    res.json({
      accessToken,
      refreshToken,
      expiresIn: 7200, // 2 hours
      user: {
        id: user.id,
        openid: user.openid,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        isMember: user.isMember,
        membershipLevel: user.membershipLevel,
        testCount: user.testCount,
      },
    });
  } catch (error) {
    console.error('WeChat login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const jwt = require('jsonwebtoken');
    const { JWT_REFRESH_SECRET } = require('../middleware/auth');
    
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    
    // Check if token exists and is not revoked
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(storedToken.user.id);

    // Revoke old refresh token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true, revokedAt: new Date() },
    });

    // Store new refresh token
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 30);
    await storeRefreshToken(storedToken.user.id, newRefreshToken, refreshExpiresAt);

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 7200,
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    res.status(500).json({ error: 'Token refresh failed' });
  }
};

/**
 * POST /api/v1/auth/wechat/userinfo
 * Update user info from WeChat
 */
exports.updateUserInfo = async (req, res) => {
  try {
    const { nickname, avatarUrl, gender, city, province, country, language } = req.body;
    const userId = req.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: {
        nickname,
        avatarUrl,
        gender,
        city,
        province,
        country,
        language,
      },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user info' });
  }
};
