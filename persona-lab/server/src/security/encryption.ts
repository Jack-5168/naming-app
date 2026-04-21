/**
 * Data Encryption Module
 * Phase 4: Security Hardening
 * 
 * Features:
 * - AES-256 encryption for sensitive fields
 * - Field-level encryption
 * - Key management
 */

import crypto from 'crypto';

// ==================== Configuration ====================

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// ==================== Types ====================

export interface EncryptedData {
  encryptedData: string;
  iv: string;
  authTag: string;
}

// ==================== Core Encryption Functions ====================

/**
 * Encrypt sensitive data using AES-256-GCM
 */
export function encrypt(data: string): EncryptedData {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    ENCRYPTION_ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );
  
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
export function decrypt(encryptedData: EncryptedData): string {
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(encryptedData.iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Encrypt object fields
 */
export function encryptFields<T extends Record<string, any>>(
  obj: T,
  fieldsToEncrypt: (keyof T)[]
): T {
  const encrypted = { ...obj };
  
  for (const field of fieldsToEncrypt) {
    const value = obj[field];
    if (value !== undefined && value !== null) {
      const encryptedData = encrypt(String(value));
      (encrypted as any)[field] = JSON.stringify(encryptedData);
    }
  }
  
  return encrypted;
}

/**
 * Decrypt object fields
 */
export function decryptFields<T extends Record<string, any>>(
  obj: T,
  fieldsToDecrypt: (keyof T)[]
): T {
  const decrypted = { ...obj };
  
  for (const field of fieldsToDecrypt) {
    const value = obj[field];
    if (value !== undefined && value !== null) {
      try {
        const encryptedData = JSON.parse(value as string) as EncryptedData;
        (decrypted as any)[field] = decrypt(encryptedData);
      } catch (error) {
        console.error(`Failed to decrypt field ${String(field)}:`, error);
        (decrypted as any)[field] = value;
      }
    }
  }
  
  return decrypted;
}

// ==================== Hash Functions ====================

/**
 * Hash data using SHA-256
 */
export function hash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Hash with salt
 */
export function hashWithSalt(data: string, salt: string): string {
  return crypto
    .createHmac('sha256', salt)
    .update(data)
    .digest('hex');
}

/**
 * Generate secure random salt
 */
export function generateSalt(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

// ==================== Sensitive Field Encryption ====================

/**
 * Encrypt PII (Personally Identifiable Information)
 */
export function encryptPII(data: {
  phone?: string;
  email?: string;
  idNumber?: string;
}): Record<string, string> {
  const encrypted: Record<string, string> = {};
  
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
export function decryptPII(encrypted: {
  phone?: string;
  email?: string;
  idNumber?: string;
}): Record<string, string> {
  const decrypted: Record<string, string> = {};
  
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
export function encryptToken(token: string): string {
  const encrypted = encrypt(token);
  return `${encrypted.iv}:${encrypted.authTag}:${encrypted.encryptedData}`;
}

/**
 * Decrypt API tokens
 */
export function decryptToken(encryptedToken: string): string {
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
export function createEncryptionMiddleware() {
  return {
    async query(params: any, query: any) {
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
            return result.map((item: any) => {
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
export async function rotateEncryptionKey(
  oldKey: string,
  newKey: string,
  reencryptFunction: (data: string, oldKey: string, newKey: string) => Promise<void>
): Promise<void> {
  console.log('Starting encryption key rotation...');
  
  // In production, this would:
  // 1. Fetch all encrypted records
  // 2. Decrypt with old key
  // 3. Re-encrypt with new key
  // 4. Update database
  
  await reencryptFunction(oldKey, newKey);
  
  console.log('Encryption key rotation completed');
}

export default {
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
