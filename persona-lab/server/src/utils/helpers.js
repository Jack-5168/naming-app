const crypto = require('crypto');

/**
 * Encrypt sensitive data
 */
exports.encrypt = (text, key) => {
  const algorithm = 'aes-256-cbc';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(key, 'hex'), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted,
  };
};

/**
 * Decrypt sensitive data
 */
exports.decrypt = (encryptedData, iv, key) => {
  const algorithm = 'aes-256-cbc';
  const decipher = crypto.createDecipheriv(
    algorithm,
    Buffer.from(key, 'hex'),
    Buffer.from(iv, 'hex')
  );
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

/**
 * Calculate personality type from dimension scores
 */
exports.calculatePersonalityType = (scores) => {
  const { openness, conscientiousness, extraversion, neuroticism } = scores;
  
  const E_I = extraversion >= 50 ? 'E' : 'I';
  const S_N = openness >= 50 ? 'N' : 'S';
  const T_F = neuroticism < 50 ? 'F' : 'T';
  const J_P = conscientiousness >= 50 ? 'J' : 'P';
  
  return E_I + S_N + T_F + J_P;
};

/**
 * Calculate stability index based on test count
 */
exports.calculateStabilityIndex = (testCount) => {
  if (testCount <= 1) return 30;
  if (testCount <= 3) return 50;
  if (testCount <= 5) return 70;
  if (testCount <= 10) return 85;
  return 95;
};

/**
 * Format currency (in cents to yuan)
 */
exports.formatCurrency = (cents) => {
  return `¥${(cents / 100).toFixed(2)}`;
};

/**
 * Generate random string
 */
exports.generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Sleep helper
 */
exports.sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};
