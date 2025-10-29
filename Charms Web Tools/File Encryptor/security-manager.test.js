/**
 * Security Manager Tests
 * Tests for security and memory management functionality
 * Validates data leakage prevention and secure operations
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import SecurityManager from './security-manager.js';

describe('SecurityManager', () => {
    let securityManager;

    beforeEach(() => {
        securityManager = new SecurityManager();
    });

    afterEach(() => {
        // Ensure cleanup after each test
        securityManager.performSecureCleanup();
    });

    describe('Secure Random Generation', () => {
        test('should generate cryptographically secure random bytes', () => {
            const randomBytes1 = securityManager.generateSecureRandom(16);
            const randomBytes2 = securityManager.generateSecureRandom(16);

            expect(randomBytes1).toBeInstanceOf(Uint8Array);
            expect(randomBytes1.length).toBe(16);
            expect(randomBytes2).toBeInstanceOf(Uint8Array);
            expect(randomBytes2.length).toBe(16);

            // Random bytes should be different
            expect(randomBytes1).not.toEqual(randomBytes2);
        });

        test('should track generated random data for cleanup', () => {
            const randomBytes = securityManager.generateSecureRandom(32);
            
            expect(securityManager.sensitiveDataRefs.has(randomBytes)).toBe(true);
        });

        test('should throw error for invalid length', () => {
            expect(() => securityManager.generateSecureRandom(0)).toThrow('Invalid length for random generation');
            expect(() => securityManager.generateSecureRandom(-1)).toThrow('Invalid length for random generation');
            expect(() => securityManager.generateSecureRandom('invalid')).toThrow('Invalid length for random generation');
        });
    });

    describe('Memory Management', () => {
        test('should track memory usage for operations', () => {
            const operationId = 'test_operation';
            const memorySize = 1024 * 1024; // 1MB

            securityManager.trackMemoryUsage(operationId, memorySize);

            expect(securityManager.currentMemoryUsage).toBe(memorySize);
            expect(securityManager.memoryUsageTracker.has(operationId)).toBe(true);
        });

        test('should release memory usage when operation completes', () => {
            const operationId = 'test_operation';
            const memorySize = 1024 * 1024; // 1MB

            securityManager.trackMemoryUsage(operationId, memorySize);
            securityManager.releaseMemoryUsage(operationId);

            expect(securityManager.currentMemoryUsage).toBe(0);
            expect(securityManager.memoryUsageTracker.has(operationId)).toBe(false);
        });

        test('should throw error when memory limit exceeded', () => {
            const operationId = 'large_operation';
            const largeMemorySize = securityManager.maxMemoryUsage + 1;

            expect(() => {
                securityManager.trackMemoryUsage(operationId, largeMemorySize);
            }).toThrow('Operation would exceed memory limits');
        });

        test('should provide accurate memory usage statistics', () => {
            const operationId1 = 'op1';
            const operationId2 = 'op2';
            const memorySize1 = 512 * 1024 * 1024; // 512MB
            const memorySize2 = 256 * 1024 * 1024; // 256MB

            securityManager.trackMemoryUsage(operationId1, memorySize1);
            securityManager.trackMemoryUsage(operationId2, memorySize2);

            const stats = securityManager.getMemoryUsage();
            expect(stats.current).toBe(memorySize1 + memorySize2);
            expect(stats.operations).toBe(2);
            expect(stats.percentage).toBeCloseTo(75, 1); // ~75% of 1GB
        });
    });

    describe('Secure Data Cleanup', () => {
        test('should securely wipe Uint8Array data', () => {
            const sensitiveData = new Uint8Array([1, 2, 3, 4, 5]);
            securityManager.trackSensitiveData(sensitiveData);

            securityManager.secureWipe(sensitiveData);

            // Data should be zeroed out
            expect(Array.from(sensitiveData)).toEqual([0, 0, 0, 0, 0]);
            expect(securityManager.sensitiveDataRefs.has(sensitiveData)).toBe(false);
        });

        test('should securely wipe ArrayBuffer data', () => {
            const buffer = new ArrayBuffer(8);
            const view = new Uint8Array(buffer);
            view.set([1, 2, 3, 4, 5, 6, 7, 8]);

            securityManager.trackSensitiveData(buffer);
            securityManager.secureWipe(buffer);

            // Buffer should be zeroed out
            expect(Array.from(new Uint8Array(buffer))).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
        });

        test('should perform comprehensive cleanup of all tracked data', () => {
            const data1 = new Uint8Array([1, 2, 3]);
            const data2 = new Uint8Array([4, 5, 6]);
            const buffer = new ArrayBuffer(4);

            securityManager.trackSensitiveData(data1);
            securityManager.trackSensitiveData(data2);
            securityManager.trackSensitiveData(buffer);

            const cleanedCount = securityManager.performSecureCleanup();

            expect(cleanedCount).toBe(3);
            expect(securityManager.sensitiveDataRefs.size).toBe(0);
            expect(securityManager.currentMemoryUsage).toBe(0);
            expect(Array.from(data1)).toEqual([0, 0, 0]);
            expect(Array.from(data2)).toEqual([0, 0, 0]);
        });
    });

    describe('Error Handling Security', () => {
        test('should create secure errors without exposing sensitive information', () => {
            const technicalError = new Error('PBKDF2 key derivation failed with salt: 0x1234567890abcdef');
            technicalError.name = 'OperationError';

            const secureError = securityManager.createSecureError(technicalError, 'encryption');

            expect(secureError.message).toBe('Invalid password or corrupted data');
            expect(secureError.context).toBe('encryption');
            expect(secureError.timestamp).toBeDefined();
            expect(secureError.message).not.toContain('PBKDF2');
            expect(secureError.message).not.toContain('0x1234567890abcdef');
        });

        test('should validate error messages for sensitive data exposure', () => {
            const safeMessage = 'Invalid password';
            const unsafeMessage = 'Key derivation failed with password: mySecretPassword123';

            expect(securityManager.validateErrorMessage(safeMessage)).toBe(true);
            expect(securityManager.validateErrorMessage(unsafeMessage)).toBe(false);
        });

        test('should detect Base64-like strings in error messages', () => {
            const messageWithBase64 = 'Decryption failed: SGVsbG8gV29ybGQ=';
            const safeMessage = 'Decryption failed';

            expect(securityManager.validateErrorMessage(messageWithBase64)).toBe(false);
            expect(securityManager.validateErrorMessage(safeMessage)).toBe(true);
        });
    });

    describe('Browser Storage Isolation', () => {
        test('should detect browser storage usage', () => {
            // This test checks if the detection mechanism works
            // In a real scenario, we'd mock localStorage/sessionStorage
            const storageUsed = securityManager.detectStorageUsage();
            expect(typeof storageUsed).toBe('boolean');
        });

        test('should have storage disabled flag set', () => {
            expect(securityManager.storageDisabled).toBe(true);
        });
    });

    describe('Security State Validation', () => {
        test('should validate overall security state', () => {
            const securityState = securityManager.validateSecurityState();

            expect(securityState).toHaveProperty('cryptoApiAvailable');
            expect(securityState).toHaveProperty('secureContext');
            expect(securityState).toHaveProperty('storageIsolated');
            expect(securityState).toHaveProperty('memoryTracked');
            expect(securityState).toHaveProperty('sensitiveDataTracked');
            expect(securityState).toHaveProperty('cleanupHandlersActive');
            expect(securityState).toHaveProperty('overall');

            expect(typeof securityState.overall).toBe('boolean');
        });

        test('should provide security recommendations', () => {
            const recommendations = securityManager.getSecurityRecommendations();
            expect(Array.isArray(recommendations)).toBe(true);
        });
    });

    describe('Secure Operation Wrapper', () => {
        test('should wrap operations with security measures', async () => {
            const mockOperation = vi.fn().mockResolvedValue('success');
            const secureOp = securityManager.secureOperation(mockOperation, 'test');

            const result = await secureOp('arg1', 'arg2');

            expect(result).toBe('success');
            expect(mockOperation).toHaveBeenCalledWith('arg1', 'arg2');
        });

        test('should handle errors securely in wrapped operations', async () => {
            const mockOperation = vi.fn().mockRejectedValue(new Error('Technical error'));
            const secureOp = securityManager.secureOperation(mockOperation, 'test');

            await expect(secureOp()).rejects.toThrow();
            // Should have performed cleanup
            expect(securityManager.currentMemoryUsage).toBe(0);
        });
    });

    describe('Data Leakage Prevention', () => {
        test('should not expose sensitive data in console logs', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            
            const sensitiveError = new Error('Password: secret123');
            securityManager.createSecureError(sensitiveError, 'test');

            // Console should log technical details but not expose them to user
            expect(consoleSpy).toHaveBeenCalled();
            const loggedArgs = consoleSpy.mock.calls[0];
            expect(loggedArgs[1].message).toContain('Password: secret123'); // Technical log
            
            consoleSpy.mockRestore();
        });

        test('should track and cleanup all sensitive data types', () => {
            const uint8Array = new Uint8Array([1, 2, 3]);
            const arrayBuffer = new ArrayBuffer(4);
            const regularArray = [1, 2, 3, 4];
            const sensitiveString = 'sensitive data';

            securityManager.trackSensitiveData(uint8Array);
            securityManager.trackSensitiveData(arrayBuffer);
            securityManager.trackSensitiveData(regularArray);
            securityManager.trackSensitiveData(sensitiveString);

            expect(securityManager.sensitiveDataRefs.size).toBe(4);

            securityManager.performSecureCleanup();

            expect(securityManager.sensitiveDataRefs.size).toBe(0);
            expect(Array.from(uint8Array)).toEqual([0, 0, 0]);
        });
    });

    describe('Memory Safety', () => {
        test('should prevent memory exhaustion attacks', () => {
            const maxMemory = securityManager.maxMemoryUsage;
            
            // Try to allocate more than maximum allowed
            expect(() => {
                securityManager.trackMemoryUsage('attack', maxMemory + 1);
            }).toThrow('Operation would exceed memory limits');
        });

        test('should handle multiple concurrent operations within limits', () => {
            const operationSize = securityManager.maxMemoryUsage / 4; // 25% each
            
            securityManager.trackMemoryUsage('op1', operationSize);
            securityManager.trackMemoryUsage('op2', operationSize);
            securityManager.trackMemoryUsage('op3', operationSize);
            
            // Fourth operation should still fit
            expect(() => {
                securityManager.trackMemoryUsage('op4', operationSize);
            }).not.toThrow();
            
            // Fifth operation should exceed limits
            expect(() => {
                securityManager.trackMemoryUsage('op5', operationSize);
            }).toThrow('Operation would exceed memory limits');
        });
    });

    describe('Cleanup Handlers', () => {
        test('should setup cleanup handlers for page events', () => {
            // Test that handlers are properly registered
            // This is more of an integration test
            expect(securityManager.validateSecurityState().cleanupHandlersActive).toBe(true);
        });
    });
});

// Integration tests with other components
describe('SecurityManager Integration', () => {
    let securityManager;

    beforeEach(() => {
        securityManager = new SecurityManager();
    });

    afterEach(() => {
        securityManager.performSecureCleanup();
    });

    test('should integrate with CryptoEngine for secure operations', async () => {
        // Mock crypto operations
        const mockEncrypt = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
        const secureEncrypt = securityManager.secureOperation(mockEncrypt, 'encrypt');

        const result = await secureEncrypt('data', 'password');
        expect(result).toEqual(new Uint8Array([1, 2, 3]));
    });

    test('should handle real-world memory usage patterns', () => {
        // Simulate file processing workflow
        const fileSize = 10 * 1024 * 1024; // 10MB file
        const operationId = 'file_processing';

        // Track memory for file processing
        securityManager.trackMemoryUsage(operationId, fileSize * 2.5);

        // Generate secure random data
        const salt = securityManager.generateSecureRandom(16);
        const iv = securityManager.generateSecureRandom(12);

        expect(salt.length).toBe(16);
        expect(iv.length).toBe(12);
        expect(securityManager.sensitiveDataRefs.size).toBe(2);

        // Cleanup
        securityManager.releaseMemoryUsage(operationId);
        securityManager.performSecureCleanup();

        expect(securityManager.currentMemoryUsage).toBe(0);
        expect(securityManager.sensitiveDataRefs.size).toBe(0);
    });
});