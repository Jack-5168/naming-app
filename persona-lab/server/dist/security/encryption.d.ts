/**
 * Data Encryption Module
 * Phase 4: Security Hardening
 *
 * Features:
 * - AES-256 encryption for sensitive fields
 * - Field-level encryption
 * - Key management
 */
export interface EncryptedData {
    encryptedData: string;
    iv: string;
    authTag: string;
}
/**
 * Encrypt sensitive data using AES-256-GCM
 */
export declare function encrypt(data: string): EncryptedData;
/**
 * Decrypt data using AES-256-GCM
 */
export declare function decrypt(encryptedData: EncryptedData): string;
/**
 * Encrypt object fields
 */
export declare function encryptFields<T extends Record<string, any>>(obj: T, fieldsToEncrypt: (keyof T)[]): T;
/**
 * Decrypt object fields
 */
export declare function decryptFields<T extends Record<string, any>>(obj: T, fieldsToDecrypt: (keyof T)[]): T;
/**
 * Hash data using SHA-256
 */
export declare function hash(data: string): string;
/**
 * Hash with salt
 */
export declare function hashWithSalt(data: string, salt: string): string;
/**
 * Generate secure random salt
 */
export declare function generateSalt(length?: number): string;
/**
 * Encrypt PII (Personally Identifiable Information)
 */
export declare function encryptPII(data: {
    phone?: string;
    email?: string;
    idNumber?: string;
}): Record<string, string>;
/**
 * Decrypt PII
 */
export declare function decryptPII(encrypted: {
    phone?: string;
    email?: string;
    idNumber?: string;
}): Record<string, string>;
/**
 * Encrypt API tokens for storage
 */
export declare function encryptToken(token: string): string;
/**
 * Decrypt API tokens
 */
export declare function decryptToken(encryptedToken: string): string;
/**
 * Prisma middleware for automatic field encryption
 * Add this to your Prisma client setup
 */
export declare function createEncryptionMiddleware(): {
    query(params: any, query: any): Promise<any>;
};
/**
 * Rotate encryption key
 * WARNING: This requires re-encrypting all existing data
 */
export declare function rotateEncryptionKey(oldKey: string, newKey: string, reencryptFunction: (data: string, oldKey: string, newKey: string) => Promise<void>): Promise<void>;
declare const _default: {
    encrypt: typeof encrypt;
    decrypt: typeof decrypt;
    encryptFields: typeof encryptFields;
    decryptFields: typeof decryptFields;
    hash: typeof hash;
    hashWithSalt: typeof hashWithSalt;
    generateSalt: typeof generateSalt;
    encryptPII: typeof encryptPII;
    decryptPII: typeof decryptPII;
    encryptToken: typeof encryptToken;
    decryptToken: typeof decryptToken;
    createEncryptionMiddleware: typeof createEncryptionMiddleware;
    rotateEncryptionKey: typeof rotateEncryptionKey;
};
export default _default;
//# sourceMappingURL=encryption.d.ts.map