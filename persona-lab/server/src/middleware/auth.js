const jwt = require('jsonwebtoken');
const { prisma } = require('../index');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';

// Verify access token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        openid: true,
        unionid: true,
        nickname: true,
        avatarUrl: true,
        isMember: true,
        membershipLevel: true,
        testCount: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Verify refresh token
const verifyRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    req.user = storedToken.user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
};

// Generate tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  const refreshToken = jwt.sign(
    { userId },
    JWT_REFRESH_SECRET,
    { expiresIn: '30d' }
  );

  return { accessToken, refreshToken };
};

// Store refresh token
const storeRefreshToken = async (userId, token, expiresAt) => {
  await prisma.refreshToken.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });
};

// Revoke refresh token
const revokeRefreshToken = async (token) => {
  await prisma.refreshToken.updateMany({
    where: { token },
    data: { revoked: true, revokedAt: new Date() },
  });
};

// Rate limit middleware for test submissions
const testRateLimit = async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const testCount = await prisma.testResult.count({
    where: {
      userId,
      createdAt: { gte: today },
    },
  });

  if (testCount >= 3) {
    return res.status(429).json({ error: 'Daily test limit reached (3 tests/day)' });
  }

  next();
};

module.exports = {
  authenticate,
  verifyRefreshToken,
  generateTokens,
  storeRefreshToken,
  revokeRefreshToken,
  testRateLimit,
  JWT_SECRET,
  JWT_REFRESH_SECRET,
};
