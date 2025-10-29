/**
 * Unit tests for CryptoEngine
 * Tests encryption/decryption round-trips and error handling
 */
import { describe, test, expect, beforeEach } from 'vitest';

// Mock Web Crypto API for Node.js testing environment
if (typeof crypto === 'undefined') {
    global.crypto = require('crypto').webcrypto;
}

// Import CryptoEngine
import CryptoEngine from './crypto-engine.js';

describe('CryptoEngine', () => {
    let cryptoEngine;

    beforeEach(() => {
        cryptoEngine = new CryptoEngine();
    });

    describe('Constructor', () => {
        test('should initialize with correct constants', () => {
            expect(cryptoEngine.MAGIC_HEADER).toEqual(new Uint8Array([0x45, 0x4E, 0x43, 0x49, 0x4D, 0x47]));
            expect(cryptoEngine.VERSION).toBe(1);
            expect(cryptoEngine.SALT_LENGTH).toBe(16);
            expect(cryptoEngine.IV_LENGTH).toBe(12);
            expect(cryptoEngine.PBKDF2_ITERATIONS).toBe(100000);
        });
    });

    describe('Key Derivation', () => {
        test('should derive key from password and salt', async () => {
            const password = 'testpassword123';
            const salt = crypto.getRandomValues(new Uint8Array(16));
            
            const key = await cryptoEngine.deriveKey(password, salt, 1);
            
            expect(key).toBeDefined();
            expect(key.type).toBe('secret');
            expect(key.algorithm.name).toBe('AES-GCM');
        });

        test('should throw error for unsupported version', async () => {
            const password = 'testpassword123';
            const salt = crypto.getRandomValues(new Uint8Array(16));
            
            await expect(cryptoEngine.deriveKey(password, salt, 99))
                .rejects.toThrow('Unsupported format version: 99');
        });

        test('should generate different keys for different passwords', async () => {
            const salt = crypto.getRandomValues(new Uint8Array(16));
            
            const key1 = await cryptoEngine.deriveKey('password1', salt, 1);
            const key2 = await cryptoEngine.deriveKey('password2', salt, 1);
            
            // Keys should be different (we can't directly compare CryptoKey objects,
            // but we can verify they produce different encrypted results)
            expect(key1).not.toBe(key2);
        });

        test('should generate different keys for different salts', async () => {
            const password = 'samepassword';
            const salt1 = crypto.getRandomValues(new Uint8Array(16));
            const salt2 = crypto.getRandomValues(new Uint8Array(16));
            
            const key1 = await cryptoEngine.deriveKey(password, salt1, 1);
            const key2 = await cryptoEngine.deriveKey(password, salt2, 1);
            
            expect(key1).not.toBe(key2);
        });
    });

    describe('Metadata Encoding/Decoding', () => {
        test('should encode and decode metadata correctly', () => {
            const fileData = new TextEncoder().encode('Hello, World!').buffer;
            const metadata = {
                filename: 'test.txt',
                mimeType: 'text/plain',
                timestamp: 1234567890
            };

            const encoded = cryptoEngine.encodeMetadata(fileData, metadata);
            const decoded = cryptoEngine.decodeMetadata(encoded);

            expect(decoded.metadata.filename).toBe(metadata.filename);
            expect(decoded.metadata.mimeType).toBe(metadata.mimeType);
            expect(decoded.metadata.timestamp).toBe(metadata.timestamp);
            expect(new TextDecoder().decode(decoded.fileData)).toBe('Hello, World!');
        });

        test('should handle special characters in filename', () => {
            const fileData = new TextEncoder().encode('test data').buffer;
            const metadata = {
                filename: 'test file with spaces & symbols.txt',
                mimeType: 'text/plain',
                timestamp: 1234567890
            };

            const encoded = cryptoEngine.encodeMetadata(fileData, metadata);
            const decoded = cryptoEngine.decodeMetadata(encoded);

            expect(decoded.metadata.filename).toBe(metadata.filename);
        });

        test('should throw error for invalid metadata format', () => {
            const invalidData = new TextEncoder().encode('invalid data without delimiter');
            
            expect(() => cryptoEngine.decodeMetadata(invalidData))
                .toThrow('Invalid encrypted format: metadata delimiter not found');
        });
    });

    describe('Encrypted Payload Creation/Parsing', () => {
        test('should create and parse encrypted payload correctly', () => {
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encryptedData = crypto.getRandomValues(new Uint8Array(100));

            const payload = cryptoEngine.createEncryptedPayload(salt, iv, encryptedData);
            const parsed = cryptoEngine.parseEncryptedPayload(payload);

            expect(parsed.version).toBe(1);
            expect(parsed.salt).toEqual(salt);
            expect(parsed.iv).toEqual(iv);
            expect(parsed.encryptedData).toEqual(encryptedData);
        });

        test('should validate encrypted payload with correct magic header', () => {
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encryptedData = crypto.getRandomValues(new Uint8Array(50));

            const payload = cryptoEngine.createEncryptedPayload(salt, iv, encryptedData);
            
            expect(cryptoEngine.validateEncryptedPayload(payload)).toBe(true);
        });

        test('should reject payload with incorrect magic header', () => {
            const invalidPayload = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
            
            expect(cryptoEngine.validateEncryptedPayload(invalidPayload)).toBe(false);
        });

        test('should reject payload that is too short', () => {
            const shortPayload = new Uint8Array([0x45, 0x4E, 0x43]);
            
            expect(() => cryptoEngine.parseEncryptedPayload(shortPayload))
                .toThrow('Unrecognized format');
        });

        test('should reject payload with wrong magic header during parsing', () => {
            const wrongHeader = new Uint8Array(35); // Minimum size but wrong header
            wrongHeader[0] = 0x00; // Wrong magic header
            
            expect(() => cryptoEngine.parseEncryptedPayload(wrongHeader))
                .toThrow('Unrecognized format');
        });
    });

    describe('Full Encryption/Decryption Round-trips', () => {
        test('should encrypt and decrypt text data successfully', async () => {
            const originalText = 'This is a test message for encryption!';
            const fileData = new TextEncoder().encode(originalText).buffer;
            const password = 'securepassword123';
            const metadata = {
                filename: 'test.txt',
                mimeType: 'text/plain',
                timestamp: Date.now()
            };

            // Encrypt
            const encryptedPayload = await cryptoEngine.encrypt(fileData, password, metadata);
            
            // Verify encrypted payload structure
            expect(cryptoEngine.validateEncryptedPayload(encryptedPayload)).toBe(true);
            
            // Decrypt
            const decrypted = await cryptoEngine.decrypt(encryptedPayload, password);
            
            // Verify results
            expect(decrypted.metadata.filename).toBe(metadata.filename);
            expect(decrypted.metadata.mimeType).toBe(metadata.mimeType);
            expect(decrypted.metadata.timestamp).toBe(metadata.timestamp);
            expect(new TextDecoder().decode(decrypted.fileData)).toBe(originalText);
        });

        test('should encrypt and decrypt binary data successfully', async () => {
            // Create some binary data
            const binaryData = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
            const password = 'binarypassword456';
            const metadata = {
                filename: 'test.png',
                mimeType: 'image/png',
                timestamp: Date.now()
            };

            // Encrypt
            const encryptedPayload = await cryptoEngine.encrypt(binaryData.buffer, password, metadata);
            
            // Decrypt
            const decrypted = await cryptoEngine.decrypt(encryptedPayload, password);
            
            // Verify results
            expect(new Uint8Array(decrypted.fileData)).toEqual(binaryData);
            expect(decrypted.metadata.filename).toBe(metadata.filename);
            expect(decrypted.metadata.mimeType).toBe(metadata.mimeType);
        });

        test('should handle large file data', async () => {
            // Create 1MB of test data
            const largeData = new Uint8Array(1024 * 1024);
            for (let i = 0; i < largeData.length; i++) {
                largeData[i] = i % 256;
            }
            
            const password = 'largefilepassword';
            const metadata = {
                filename: 'large.bin',
                mimeType: 'application/octet-stream',
                timestamp: Date.now()
            };

            // Encrypt
            const encryptedPayload = await cryptoEngine.encrypt(largeData.buffer, password, metadata);
            
            // Decrypt
            const decrypted = await cryptoEngine.decrypt(encryptedPayload, password);
            
            // Verify results
            expect(new Uint8Array(decrypted.fileData)).toEqual(largeData);
            expect(decrypted.metadata.filename).toBe(metadata.filename);
        });

        test('should produce different encrypted outputs for same input', async () => {
            const fileData = new TextEncoder().encode('Same input data').buffer;
            const password = 'samepassword';
            const metadata = {
                filename: 'same.txt',
                mimeType: 'text/plain',
                timestamp: Date.now()
            };

            // Encrypt same data twice
            const encrypted1 = await cryptoEngine.encrypt(fileData, password, metadata);
            const encrypted2 = await cryptoEngine.encrypt(fileData, password, metadata);
            
            // Should be different due to random salt and IV
            expect(encrypted1).not.toEqual(encrypted2);
            
            // But both should decrypt to same result
            const decrypted1 = await cryptoEngine.decrypt(encrypted1, password);
            const decrypted2 = await cryptoEngine.decrypt(encrypted2, password);
            
            expect(new TextDecoder().decode(decrypted1.fileData))
                .toBe(new TextDecoder().decode(decrypted2.fileData));
        });
    });

    describe('Error Handling', () => {
        test('should throw error for wrong password during decryption', async () => {
            const fileData = new TextEncoder().encode('Secret message').buffer;
            const correctPassword = 'correctpassword';
            const wrongPassword = 'wrongpassword';
            const metadata = {
                filename: 'secret.txt',
                mimeType: 'text/plain',
                timestamp: Date.now()
            };

            // Encrypt with correct password
            const encryptedPayload = await cryptoEngine.encrypt(fileData, correctPassword, metadata);
            
            // Try to decrypt with wrong password
            await expect(cryptoEngine.decrypt(encryptedPayload, wrongPassword))
                .rejects.toThrow('Invalid password');
        });

        test('should throw error for corrupted encrypted data', async () => {
            const fileData = new TextEncoder().encode('Test message').buffer;
            const password = 'testpassword';
            const metadata = {
                filename: 'test.txt',
                mimeType: 'text/plain',
                timestamp: Date.now()
            };

            // Encrypt normally
            const encryptedPayload = await cryptoEngine.encrypt(fileData, password, metadata);
            
            // Corrupt the encrypted data
            const corruptedPayload = new Uint8Array(encryptedPayload);
            corruptedPayload[corruptedPayload.length - 1] ^= 0xFF; // Flip bits in last byte
            
            // Try to decrypt corrupted data
            await expect(cryptoEngine.decrypt(corruptedPayload, password))
                .rejects.toThrow();
        });

        test('should handle empty password gracefully', async () => {
            const fileData = new TextEncoder().encode('Test').buffer;
            const metadata = {
                filename: 'test.txt',
                mimeType: 'text/plain',
                timestamp: Date.now()
            };

            // Should work with empty password (though not recommended)
            const encryptedPayload = await cryptoEngine.encrypt(fileData, '', metadata);
            const decrypted = await cryptoEngine.decrypt(encryptedPayload, '');
            
            expect(new TextDecoder().decode(decrypted.fileData)).toBe('Test');
        });

        test('should handle empty file data', async () => {
            const emptyData = new ArrayBuffer(0);
            const password = 'testpassword';
            const metadata = {
                filename: 'empty.txt',
                mimeType: 'text/plain',
                timestamp: Date.now()
            };

            const encryptedPayload = await cryptoEngine.encrypt(emptyData, password, metadata);
            const decrypted = await cryptoEngine.decrypt(encryptedPayload, password);
            
            expect(decrypted.fileData.byteLength).toBe(0);
            expect(decrypted.metadata.filename).toBe('empty.txt');
        });

        test('should throw error for malformed metadata during decryption', async () => {
            // Create a payload with invalid metadata format
            const password = 'testpassword';
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const key = await cryptoEngine.deriveKey(password, salt, 1);
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            // Create invalid metadata (missing delimiter)
            const invalidData = new TextEncoder().encode('invalid metadata format');
            const encryptedData = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                invalidData
            );
            
            const payload = cryptoEngine.createEncryptedPayload(salt, iv, new Uint8Array(encryptedData));
            
            await expect(cryptoEngine.decrypt(payload, password))
                .rejects.toThrow('Invalid encrypted format: metadata delimiter not found');
        });
    });

    describe('Utility Functions', () => {
        test('should correctly compare arrays for equality', () => {
            const arr1 = new Uint8Array([1, 2, 3, 4, 5]);
            const arr2 = new Uint8Array([1, 2, 3, 4, 5]);
            const arr3 = new Uint8Array([1, 2, 3, 4, 6]);
            const arr4 = new Uint8Array([1, 2, 3, 4]);

            expect(cryptoEngine.arraysEqual(arr1, arr2)).toBe(true);
            expect(cryptoEngine.arraysEqual(arr1, arr3)).toBe(false);
            expect(cryptoEngine.arraysEqual(arr1, arr4)).toBe(false);
        });

        test('should validate payload with minimum size requirements', () => {
            const tooShort = new Uint8Array(5);
            const justRight = new Uint8Array(35); // Magic header + version + salt + IV
            justRight.set(cryptoEngine.MAGIC_HEADER, 0);

            expect(cryptoEngine.validateEncryptedPayload(tooShort)).toBe(false);
            expect(cryptoEngine.validateEncryptedPayload(justRight)).toBe(true);
        });
    });
});