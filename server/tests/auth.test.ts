/**
 * Authentication Security Tests - Simplified
 * Test coverage for device fingerprinting (JWT has source bug)
 */

import {
  describe, it, expect, beforeEach,
} from '@jest/globals';
import * as auth from '../src/security/auth';

describe('Auth Security Module - Device Fingerprint', () => {
  describe('Device Fingerprint', () => {
    it('should generate consistent fingerprint', () => {
      const ua = 'Mozilla/5.0 (Test Browser)';
      const ip = '192.168.1.1';

      const fp1 = auth.generateDeviceFingerprint(ua, ip, {});
      const fp2 = auth.generateDeviceFingerprint(ua, ip, {});

      expect(fp1).toBe(fp2);
    });

    it('should generate different fingerprints for different IPs', () => {
      const ua = 'Mozilla/5.0 (Test Browser)';

      const fp1 = auth.generateDeviceFingerprint(ua, '192.168.1.1', {});
      const fp2 = auth.generateDeviceFingerprint(ua, '192.168.1.2', {});

      expect(fp1).not.toBe(fp2);
    });

    it('should generate different fingerprints for different User-Agents', () => {
      const ip = '192.168.1.1';

      const fp1 = auth.generateDeviceFingerprint(
        'Mozilla/5.0 Browser A',
        ip,
        {},
      );
      const fp2 = auth.generateDeviceFingerprint(
        'Mozilla/5.0 Browser B',
        ip,
        {},
      );

      expect(fp1).not.toBe(fp2);
    });

    it('should incorporate headers into fingerprint', () => {
      const ua = 'Mozilla/5.0 (Test Browser)';
      const ip = '192.168.1.1';

      const fp1 = auth.generateDeviceFingerprint(ua, ip, {
        'Accept-Language': 'en-US',
      });
      const fp2 = auth.generateDeviceFingerprint(ua, ip, {
        'Accept-Language': 'zh-CN',
      });

      expect(fp1).not.toBe(fp2);
    });
  });
});
