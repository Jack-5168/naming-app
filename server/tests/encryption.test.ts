/**
 * Encryption Security Tests
 * Test coverage for AES encryption/decryption
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import * as encryption from '../src/security/encryption';

describe('Encryption Module', () => {
  let testData: string;

  beforeEach(() => {
    testData = 'Hello, World! 你好世界！';
  });

  describe('AES-256-GCM Encryption', () => {
    it('should encrypt string data', () => {
      const encrypted = encryption.encrypt(testData);
      
      expect(encrypted).toBeDefined();
      expect(encrypted.encryptedData).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
    });

    it('should decrypt encrypted data correctly', () => {
      const encrypted = encryption.encrypt(testData);
      const decrypted = encryption.decrypt(encrypted);
      
      expect(decrypted).toBe(testData);
    });

    it('should produce different ciphertext each time (random IV)', () => {
      const encrypted1 = encryption.encrypt(testData);
      const encrypted2 = encryption.encrypt(testData);
      
      // IV should be different each time
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      // But both should decrypt to original
      expect(encryption.decrypt(encrypted2)).toBe(testData);
    });

    it('should detect tampering via auth tag', () => {
      const encrypted = encryption.encrypt(testData);
      
      // Tamper with the encrypted data
      const tampered = {
        ...encrypted,
        encryptedData: encrypted.encryptedData.slice(0, -2) + 'XX',
      };
      
      expect(() => encryption.decrypt(tampered)).toThrow();
    });
  });

  describe('Field-Level Encryption', () => {
    it('should encrypt specified object fields', () => {
      const obj = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      };

      const encrypted = encryption.encryptFields(obj, ['name', 'email']);
      
      // Fields are encrypted to JSON strings
      expect(typeof encrypted.name).toBe('string');
      expect(typeof encrypted.email).toBe('string');
      expect(encrypted.age).toBe(30); // Non-encrypted field unchanged
    });

    it('should decrypt object fields correctly', () => {
      const obj = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const encrypted = encryption.encryptFields(obj, ['name', 'email']);
      const decrypted = encryption.decryptFields(encrypted, ['name', 'email']);
      
      expect(decrypted.name).toBe('John Doe');
      expect(decrypted.email).toBe('john@example.com');
    });

    it('should handle missing fields gracefully', () => {
      const obj = {
        name: 'John Doe',
        email: undefined,
      };

      const encrypted = encryption.encryptFields(obj, ['name', 'email']);
      const decrypted = encryption.decryptFields(encrypted, ['name', 'email']);
      
      expect(decrypted.name).toBe('John Doe');
    });
  });

  describe('Hash Operations', () => {
    it('should generate consistent hash', () => {
      const hash1 = encryption.hash(testData);
      const hash2 = encryption.hash(testData);
      
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different data', () => {
      const hash1 = encryption.hash('data1');
      const hash2 = encryption.hash('data2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should generate hash with salt', () => {
      const salt = encryption.generateSalt();
      const hash1 = encryption.hashWithSalt('test', salt);
      const hash2 = encryption.hashWithSalt('test', salt);
      
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash with different salt', () => {
      const hash1 = encryption.hashWithSalt('test', 'salt1');
      const hash2 = encryption.hashWithSalt('test', 'salt2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Token Encryption', () => {
    it('should encrypt and decrypt token', () => {
      const token = 'jwt.token.signature';
      
      const encrypted = encryption.encryptToken(token);
      const decrypted = encryption.decryptToken(encrypted);
      
      expect(decrypted).toBe(token);
    });
  });

  describe('PII Encryption', () => {
    it('should encrypt PII with key', () => {
      const pii = {
        name: 'John Doe',
        idNumber: '1234567890',
      };

      const key = 'test-key';
      const encrypted = encryption.encryptPII(pii, key);
      
      expect(encrypted).toBeDefined();
    });

    it('should decrypt PII with key', () => {
      const pii = {
        name: 'Jane Doe',
        idNumber: '0987654321',
      };

      const key = 'test-key';
      const encrypted = encryption.encryptPII(pii, key);
      const decrypted = encryption.decryptPII(encrypted, key);
      
      expect(decrypted).toEqual(pii);
    });
  });
});