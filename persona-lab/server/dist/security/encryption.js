"use strict";
/**
 * Data Encryption Module
 * Phase 4: Security Hardening
 *
 * Features:
 * - AES-256 encryption for sensitive fields
 * - Field-level encryption
 * - Key management
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.encryptFields = encryptFields;
exports.decryptFields = decryptFields;
exports.hash = hash;
exports.hashWithSalt = hashWithSalt;
exports.generateSalt = generateSalt;
exports.encryptPII = encryptPII;
exports.decryptPII = decryptPII;
exports.encryptToken = encryptToken;
exports.decryptToken = decryptToken;
exports.createEncryptionMiddleware = createEncryptionMiddleware;
exports.rotateEncryptionKey = rotateEncryptionKey;
const crypto_1 = __importDefault(require("crypto"));
// ==================== Configuration ====================
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto_1.default.randomBytes(32).toString('hex');
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
// ==================== Core Encryption Functions ====================
/**
 * Encrypt sensitive data using AES-256-GCM
 */
function encrypt(data) {
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        authTag,
    };
}
/**
 * Decrypt data using AES-256-GCM
 */
function decrypt(encryptedData) {
    const decipher = crypto_1.default.createDecipheriv(ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(encryptedData.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
/**
 * Encrypt object fields
 */
function encryptFields(obj, fieldsToEncrypt) {
    const encrypted = { ...obj };
    for (const field of fieldsToEncrypt) {
        const value = obj[field];
        if (value !== undefined && value !== null) {
            const encryptedData = encrypt(String(value));
            encrypted[field] = JSON.stringify(encryptedData);
        }
    }
    return encrypted;
}
/**
 * Decrypt object fields
 */
function decryptFields(obj, fieldsToDecrypt) {
    const decrypted = { ...obj };
    for (const field of fieldsToDecrypt) {
        const value = obj[field];
        if (value !== undefined && value !== null) {
            try {
                const encryptedData = JSON.parse(value);
                decrypted[field] = decrypt(encryptedData);
            }
            catch (error) {
                console.error(`Failed to decrypt field ${String(field)}:`, error);
                decrypted[field] = value;
            }
        }
    }
    return decrypted;
}
// ==================== Hash Functions ====================
/**
 * Hash data using SHA-256
 */
function hash(data) {
    return crypto_1.default.createHash('sha256').update(data).digest('hex');
}
/**
 * Hash with salt
 */
function hashWithSalt(data, salt) {
    return crypto_1.default
        .createHmac('sha256', salt)
        .update(data)
        .digest('hex');
}
/**
 * Generate secure random salt
 */
function generateSalt(length = 32) {
    return crypto_1.default.randomBytes(length).toString('hex');
}
// ==================== Sensitive Field Encryption ====================
/**
 * Encrypt PII (Personally Identifiable Information)
 */
function encryptPII(data) {
    const encrypted = {};
    if (data.phone) {
        encrypted.phone = JSON.stringify(encrypt(data.phone));
    }
    if (data.email) {
        encrypted.email = JSON.stringify(encrypt(data.email));
    }
    if (data.idNumber) {
        encrypted.idNumber = JSON.stringify(encrypt(data.idNumber));
    }
    return encrypted;
}
/**
 * Decrypt PII
 */
function decryptPII(encrypted) {
    const decrypted = {};
    if (encrypted.phone) {
        decrypted.phone = decrypt(JSON.parse(encrypted.phone));
    }
    if (encrypted.email) {
        decrypted.email = decrypt(JSON.parse(encrypted.email));
    }
    if (encrypted.idNumber) {
        decrypted.idNumber = decrypt(JSON.parse(encrypted.idNumber));
    }
    return decrypted;
}
// ==================== Token Encryption ====================
/**
 * Encrypt API tokens for storage
 */
function encryptToken(token) {
    const encrypted = encrypt(token);
    return `${encrypted.iv}:${encrypted.authTag}:${encrypted.encryptedData}`;
}
/**
 * Decrypt API tokens
 */
function decryptToken(encryptedToken) {
    const [iv, authTag, encryptedData] = encryptedToken.split(':');
    return decrypt({
        iv,
        authTag,
        encryptedData,
    });
}
// ==================== Database Field Encryption ====================
/**
 * Prisma middleware for automatic field encryption
 * Add this to your Prisma client setup
 */
function createEncryptionMiddleware() {
    return {
        async query(params, query) {
            // Encrypt sensitive fields before write
            if (params.action === 'create' || params.action === 'update') {
                if (params.model === 'User') {
                    if (params.args.data?.phone) {
                        params.args.data.phone = encrypt(params.args.data.phone).encryptedData;
                    }
                    if (params.args.data?.email) {
                        // Email is typically not encrypted as it's used for lookup
                        // Consider using hash for lookup instead
                    }
                }
            }
            const result = await query(params);
            // Decrypt sensitive fields after read
            if (params.action === 'findUnique' || params.action === 'findFirst' || params.action === 'findMany') {
                if (params.model === 'User' && result) {
                    if (Array.isArray(result)) {
                        return result.map((item) => {
                            if (item.phone) {
                                item.phone = decrypt({
                                    encryptedData: item.phone,
                                    iv: '',
                                    authTag: '',
                                });
                            }
                            return item;
                        });
                    }
                }
            }
            return result;
        },
    };
}
// ==================== Key Rotation ====================
/**
 * Rotate encryption key
 * WARNING: This requires re-encrypting all existing data
 */
async function rotateEncryptionKey(oldKey, newKey, reencryptFunction) {
    console.log('Starting encryption key rotation...');
    // In production, this would:
    // 1. Fetch all encrypted records
    // 2. Decrypt with old key
    // 3. Re-encrypt with new key
    // 4. Update database
    await reencryptFunction(oldKey, newKey);
    console.log('Encryption key rotation completed');
}
exports.default = {
    encrypt,
    decrypt,
    encryptFields,
    decryptFields,
    hash,
    hashWithSalt,
    generateSalt,
    encryptPII,
    decryptPII,
    encryptToken,
    decryptToken,
    createEncryptionMiddleware,
    rotateEncryptionKey,
};
//# sourceMappingURL=encryption.js.map