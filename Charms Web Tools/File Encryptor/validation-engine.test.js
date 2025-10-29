// Unit tests for ValidationEngine
// Tests all validation scenarios including file size, password, image format, and encrypted payload validation

import { describe, test, expect, beforeEach } from 'vitest';

// Mock File constructor for testing
class MockFile {
    constructor(name, size, type) {
        this.name = name;
        this.size = size;
        this.type = type;
        this.lastModified = Date.now();
    }
}

// Set up constants for testing
const CONSTANTS = {
    MAX_FILE_SIZE: 1024 * 1024 * 1024, // 1GB
    MAGIC_HEADER: new Uint8Array([0x45, 0x4E, 0x43, 0x49, 0x4D, 0x47]), // "ENCIMG"
    VERSION_1: 1,
    SALT_LENGTH: 16,
    IV_LENGTH: 12,
    ERROR_CODES: {
        INVALID_PASSWORD: 'INVALID_PASSWORD',
        CORRUPTED_IMAGE: 'CORRUPTED_IMAGE',
        UNRECOGNIZED_FORMAT: 'UNRECOGNIZED_FORMAT',
        FILE_TOO_LARGE: 'FILE_TOO_LARGE',
        MEMORY_LIMIT: 'MEMORY_LIMIT',
        INVALID_IMAGE_FORMAT: 'INVALID_IMAGE_FORMAT',
        EMPTY_PASSWORD: 'EMPTY_PASSWORD',
        PROCESSING_ERROR: 'PROCESSING_ERROR'
    },
    ERROR_MESSAGES: {
        INVALID_PASSWORD: 'The password you entered is incorrect. Please try again.',
        CORRUPTED_IMAGE: 'This image does not contain a valid encrypted file.',
        UNRECOGNIZED_FORMAT: 'The uploaded file is not in a recognized encrypted format.',
        FILE_TOO_LARGE: 'File size exceeds the 1GB limit. Please choose a smaller file.',
        MEMORY_LIMIT: 'File is too large to process in your browser. Try a smaller file.',
        INVALID_IMAGE_FORMAT: 'Please upload a PNG image file.',
        EMPTY_PASSWORD: 'Password cannot be empty.',
        PROCESSING_ERROR: 'An error occurred while processing the file. Please try again.'
    }
};

// Base ValidationEngine class
class ValidationEngine {
    validateFileSize(file) { throw new Error('Not implemented'); }
    validatePassword(password) { throw new Error('Not implemented'); }
    validateImageFormat(file) { throw new Error('Not implemented'); }
    validateEncryptedPayload(payload) { throw new Error('Not implemented'); }
    getUserFriendlyError(errorCode) { throw new Error('Not implemented'); }
}

// ValidationEngine implementation
class ValidationEngineImpl extends ValidationEngine {
    constructor() {
        super();
        this.maxFileSize = CONSTANTS.MAX_FILE_SIZE; // 1GB
        this.magicHeader = CONSTANTS.MAGIC_HEADER; // "ENCIMG"
        this.supportedImageTypes = ['image/png'];
    }

    validateFileSize(file) {
        if (!file) return false;
        return file.size <= this.maxFileSize;
    }

    validatePassword(password) {
        if (typeof password !== 'string') return false;
        return password.trim().length > 0;
    }

    validateImageFormat(file) {
        if (!file) return false;
        if (!this.supportedImageTypes.includes(file.type)) return false;
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.png')) return false;
        return true;
    }

    validateEncryptedPayload(payload) {
        if (!payload || !(payload instanceof Uint8Array)) return false;
        
        const minPayloadSize = this.magicHeader.length + 1 + CONSTANTS.SALT_LENGTH + CONSTANTS.IV_LENGTH + 1;
        if (payload.length < minPayloadSize) return false;
        
        for (let i = 0; i < this.magicHeader.length; i++) {
            if (payload[i] !== this.magicHeader[i]) return false;
        }
        
        const version = payload[this.magicHeader.length];
        if (version !== CONSTANTS.VERSION_1) return false;
        
        return true;
    }

    getUserFriendlyError(errorCode) {
        return CONSTANTS.ERROR_MESSAGES[errorCode] || CONSTANTS.ERROR_MESSAGES.PROCESSING_ERROR;
    }

    validateFileForEncryption(file) {
        if (!file) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.PROCESSING_ERROR,
                userMessage: 'No file selected'
            };
        }

        if (!this.validateFileSize(file)) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.FILE_TOO_LARGE,
                userMessage: this.getUserFriendlyError(CONSTANTS.ERROR_CODES.FILE_TOO_LARGE)
            };
        }

        return { isValid: true };
    }

    validateImageForDecryption(file) {
        if (!file) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.PROCESSING_ERROR,
                userMessage: 'No image selected'
            };
        }

        if (!this.validateImageFormat(file)) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.INVALID_IMAGE_FORMAT,
                userMessage: this.getUserFriendlyError(CONSTANTS.ERROR_CODES.INVALID_IMAGE_FORMAT)
            };
        }

        if (!this.validateFileSize(file)) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.FILE_TOO_LARGE,
                userMessage: this.getUserFriendlyError(CONSTANTS.ERROR_CODES.FILE_TOO_LARGE)
            };
        }

        return { isValid: true };
    }

    validatePasswordWithDetails(password) {
        if (!this.validatePassword(password)) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.EMPTY_PASSWORD,
                userMessage: this.getUserFriendlyError(CONSTANTS.ERROR_CODES.EMPTY_PASSWORD)
            };
        }

        return { isValid: true };
    }

    validateBase64String(base64String) {
        if (typeof base64String !== 'string' || base64String.trim().length === 0) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.PROCESSING_ERROR,
                userMessage: 'Base64 input cannot be empty'
            };
        }

        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        const cleanBase64 = base64String.trim();
        
        if (!base64Regex.test(cleanBase64)) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.CORRUPTED_IMAGE,
                userMessage: 'Invalid Base64 format'
            };
        }

        if (cleanBase64.length % 4 !== 0) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.CORRUPTED_IMAGE,
                userMessage: 'Invalid Base64 format'
            };
        }

        return { isValid: true };
    }

    validateMemoryUsage(fileSize) {
        const estimatedMemoryUsage = fileSize * 2.5;
        const maxSafeMemoryUsage = 1024 * 1024 * 1024; // 1GB
        
        if (estimatedMemoryUsage > maxSafeMemoryUsage) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.MEMORY_LIMIT,
                userMessage: this.getUserFriendlyError(CONSTANTS.ERROR_CODES.MEMORY_LIMIT)
            };
        }

        return { isValid: true };
    }
}

// Test suite for ValidationEngine
describe('ValidationEngine', () => {
    let validationEngine;

    beforeEach(() => {
        validationEngine = new ValidationEngineImpl();
    });

    describe('validateFileSize', () => {
        test('should return true for files under 1GB', () => {
            const smallFile = new MockFile('test.txt', 1024 * 1024, 'text/plain'); // 1MB
            expect(validationEngine.validateFileSize(smallFile)).toBe(true);
        });

        test('should return true for files exactly at 1GB limit', () => {
            const maxFile = new MockFile('test.txt', 1024 * 1024 * 1024, 'text/plain'); // 1GB
            expect(validationEngine.validateFileSize(maxFile)).toBe(true);
        });

        test('should return false for files over 1GB', () => {
            const largeFile = new MockFile('test.txt', 1024 * 1024 * 1024 + 1, 'text/plain'); // 1GB + 1 byte
            expect(validationEngine.validateFileSize(largeFile)).toBe(false);
        });

        test('should return false for null file', () => {
            expect(validationEngine.validateFileSize(null)).toBe(false);
        });

        test('should return false for undefined file', () => {
            expect(validationEngine.validateFileSize(undefined)).toBe(false);
        });
    });

    describe('validatePassword', () => {
        test('should return true for non-empty password', () => {
            expect(validationEngine.validatePassword('password123')).toBe(true);
        });

        test('should return true for password with spaces', () => {
            expect(validationEngine.validatePassword('my secure password')).toBe(true);
        });

        test('should return false for empty string', () => {
            expect(validationEngine.validatePassword('')).toBe(false);
        });

        test('should return false for whitespace-only string', () => {
            expect(validationEngine.validatePassword('   ')).toBe(false);
        });

        test('should return false for null password', () => {
            expect(validationEngine.validatePassword(null)).toBe(false);
        });

        test('should return false for undefined password', () => {
            expect(validationEngine.validatePassword(undefined)).toBe(false);
        });

        test('should return false for non-string input', () => {
            expect(validationEngine.validatePassword(123)).toBe(false);
            expect(validationEngine.validatePassword({})).toBe(false);
            expect(validationEngine.validatePassword([])).toBe(false);
        });
    });

    describe('validateImageFormat', () => {
        test('should return true for PNG files', () => {
            const pngFile = new MockFile('image.png', 1024, 'image/png');
            expect(validationEngine.validateImageFormat(pngFile)).toBe(true);
        });

        test('should return false for JPEG files', () => {
            const jpegFile = new MockFile('image.jpg', 1024, 'image/jpeg');
            expect(validationEngine.validateImageFormat(jpegFile)).toBe(false);
        });

        test('should return false for GIF files', () => {
            const gifFile = new MockFile('image.gif', 1024, 'image/gif');
            expect(validationEngine.validateImageFormat(gifFile)).toBe(false);
        });

        test('should return false for non-image files', () => {
            const textFile = new MockFile('document.txt', 1024, 'text/plain');
            expect(validationEngine.validateImageFormat(textFile)).toBe(false);
        });

        test('should return false for PNG MIME type but wrong extension', () => {
            const wrongExtFile = new MockFile('image.jpg', 1024, 'image/png');
            expect(validationEngine.validateImageFormat(wrongExtFile)).toBe(false);
        });

        test('should return false for correct extension but wrong MIME type', () => {
            const wrongMimeFile = new MockFile('image.png', 1024, 'image/jpeg');
            expect(validationEngine.validateImageFormat(wrongMimeFile)).toBe(false);
        });

        test('should return false for null file', () => {
            expect(validationEngine.validateImageFormat(null)).toBe(false);
        });

        test('should return false for undefined file', () => {
            expect(validationEngine.validateImageFormat(undefined)).toBe(false);
        });
    });

    describe('validateEncryptedPayload', () => {
        test('should return true for valid encrypted payload', () => {
            // Create a valid payload: magic header + version + salt + IV + encrypted data
            const magicHeader = new Uint8Array([0x45, 0x4E, 0x43, 0x49, 0x4D, 0x47]); // "ENCIMG"
            const version = new Uint8Array([1]);
            const salt = new Uint8Array(16).fill(1); // 16 bytes of salt
            const iv = new Uint8Array(12).fill(2); // 12 bytes of IV
            const encryptedData = new Uint8Array(32).fill(3); // Some encrypted data
            
            const payload = new Uint8Array(magicHeader.length + version.length + salt.length + iv.length + encryptedData.length);
            let offset = 0;
            
            payload.set(magicHeader, offset);
            offset += magicHeader.length;
            payload.set(version, offset);
            offset += version.length;
            payload.set(salt, offset);
            offset += salt.length;
            payload.set(iv, offset);
            offset += iv.length;
            payload.set(encryptedData, offset);
            
            expect(validationEngine.validateEncryptedPayload(payload)).toBe(true);
        });

        test('should return false for payload with wrong magic header', () => {
            const wrongHeader = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00]); // Wrong magic header
            const version = new Uint8Array([1]);
            const salt = new Uint8Array(16).fill(1);
            const iv = new Uint8Array(12).fill(2);
            const encryptedData = new Uint8Array(32).fill(3);
            
            const payload = new Uint8Array(wrongHeader.length + version.length + salt.length + iv.length + encryptedData.length);
            let offset = 0;
            
            payload.set(wrongHeader, offset);
            offset += wrongHeader.length;
            payload.set(version, offset);
            offset += version.length;
            payload.set(salt, offset);
            offset += salt.length;
            payload.set(iv, offset);
            offset += iv.length;
            payload.set(encryptedData, offset);
            
            expect(validationEngine.validateEncryptedPayload(payload)).toBe(false);
        });

        test('should return false for payload with unsupported version', () => {
            const magicHeader = new Uint8Array([0x45, 0x4E, 0x43, 0x49, 0x4D, 0x47]);
            const version = new Uint8Array([2]); // Unsupported version
            const salt = new Uint8Array(16).fill(1);
            const iv = new Uint8Array(12).fill(2);
            const encryptedData = new Uint8Array(32).fill(3);
            
            const payload = new Uint8Array(magicHeader.length + version.length + salt.length + iv.length + encryptedData.length);
            let offset = 0;
            
            payload.set(magicHeader, offset);
            offset += magicHeader.length;
            payload.set(version, offset);
            offset += version.length;
            payload.set(salt, offset);
            offset += salt.length;
            payload.set(iv, offset);
            offset += iv.length;
            payload.set(encryptedData, offset);
            
            expect(validationEngine.validateEncryptedPayload(payload)).toBe(false);
        });

        test('should return false for payload too small', () => {
            const tooSmall = new Uint8Array(10); // Too small to contain all required fields
            expect(validationEngine.validateEncryptedPayload(tooSmall)).toBe(false);
        });

        test('should return false for null payload', () => {
            expect(validationEngine.validateEncryptedPayload(null)).toBe(false);
        });

        test('should return false for undefined payload', () => {
            expect(validationEngine.validateEncryptedPayload(undefined)).toBe(false);
        });

        test('should return false for non-Uint8Array payload', () => {
            expect(validationEngine.validateEncryptedPayload('not an array')).toBe(false);
            expect(validationEngine.validateEncryptedPayload([1, 2, 3])).toBe(false);
        });
    });

    describe('getUserFriendlyError', () => {
        test('should return correct message for known error codes', () => {
            expect(validationEngine.getUserFriendlyError('INVALID_PASSWORD'))
                .toBe('The password you entered is incorrect. Please try again.');
            
            expect(validationEngine.getUserFriendlyError('FILE_TOO_LARGE'))
                .toBe('File size exceeds the 1GB limit. Please choose a smaller file.');
            
            expect(validationEngine.getUserFriendlyError('CORRUPTED_IMAGE'))
                .toBe('This image does not contain a valid encrypted file.');
        });

        test('should return default message for unknown error codes', () => {
            expect(validationEngine.getUserFriendlyError('UNKNOWN_ERROR'))
                .toBe('An error occurred while processing the file. Please try again.');
        });
    });

    describe('validateFileForEncryption', () => {
        test('should return valid result for acceptable file', () => {
            const validFile = new MockFile('test.txt', 1024 * 1024, 'text/plain'); // 1MB
            const result = validationEngine.validateFileForEncryption(validFile);
            
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
            expect(result.userMessage).toBeUndefined();
        });

        test('should return invalid result for oversized file', () => {
            const largeFile = new MockFile('large.txt', 2 * 1024 * 1024 * 1024, 'text/plain'); // 2GB
            const result = validationEngine.validateFileForEncryption(largeFile);
            
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('FILE_TOO_LARGE');
            expect(result.userMessage).toBe('File size exceeds the 1GB limit. Please choose a smaller file.');
        });

        test('should return invalid result for null file', () => {
            const result = validationEngine.validateFileForEncryption(null);
            
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('PROCESSING_ERROR');
            expect(result.userMessage).toBe('No file selected');
        });
    });

    describe('validateImageForDecryption', () => {
        test('should return valid result for PNG image', () => {
            const pngFile = new MockFile('encrypted.png', 1024 * 1024, 'image/png');
            const result = validationEngine.validateImageForDecryption(pngFile);
            
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
            expect(result.userMessage).toBeUndefined();
        });

        test('should return invalid result for non-PNG image', () => {
            const jpegFile = new MockFile('image.jpg', 1024 * 1024, 'image/jpeg');
            const result = validationEngine.validateImageForDecryption(jpegFile);
            
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('INVALID_IMAGE_FORMAT');
            expect(result.userMessage).toBe('Please upload a PNG image file.');
        });

        test('should return invalid result for oversized image', () => {
            const largeImage = new MockFile('large.png', 2 * 1024 * 1024 * 1024, 'image/png'); // 2GB
            const result = validationEngine.validateImageForDecryption(largeImage);
            
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('FILE_TOO_LARGE');
            expect(result.userMessage).toBe('File size exceeds the 1GB limit. Please choose a smaller file.');
        });
    });

    describe('validatePasswordWithDetails', () => {
        test('should return valid result for non-empty password', () => {
            const result = validationEngine.validatePasswordWithDetails('mypassword');
            
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
            expect(result.userMessage).toBeUndefined();
        });

        test('should return invalid result for empty password', () => {
            const result = validationEngine.validatePasswordWithDetails('');
            
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('EMPTY_PASSWORD');
            expect(result.userMessage).toBe('Password cannot be empty.');
        });
    });

    describe('validateBase64String', () => {
        test('should return valid result for proper Base64 string', () => {
            const validBase64 = 'SGVsbG8gV29ybGQ='; // "Hello World" in Base64
            const result = validationEngine.validateBase64String(validBase64);
            
            expect(result.isValid).toBe(true);
        });

        test('should return invalid result for empty string', () => {
            const result = validationEngine.validateBase64String('');
            
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('PROCESSING_ERROR');
            expect(result.userMessage).toBe('Base64 input cannot be empty');
        });

        test('should return invalid result for invalid Base64 characters', () => {
            const invalidBase64 = 'Hello@World!'; // Contains invalid characters
            const result = validationEngine.validateBase64String(invalidBase64);
            
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('CORRUPTED_IMAGE');
            expect(result.userMessage).toBe('Invalid Base64 format');
        });

        test('should return invalid result for incorrect Base64 length', () => {
            const invalidLength = 'SGVsbG8'; // Length not multiple of 4
            const result = validationEngine.validateBase64String(invalidLength);
            
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('CORRUPTED_IMAGE');
            expect(result.userMessage).toBe('Invalid Base64 format');
        });
    });

    describe('validateMemoryUsage', () => {
        test('should return valid result for small files', () => {
            const smallFileSize = 10 * 1024 * 1024; // 10MB
            const result = validationEngine.validateMemoryUsage(smallFileSize);
            
            expect(result.isValid).toBe(true);
        });

        test('should return invalid result for files that would exceed memory limits', () => {
            const largeFileSize = 800 * 1024 * 1024; // 800MB (would exceed memory limit with overhead)
            const result = validationEngine.validateMemoryUsage(largeFileSize);
            
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('MEMORY_LIMIT');
            expect(result.userMessage).toBe('File is too large to process in your browser. Try a smaller file.');
        });
    });
});

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MockFile };
}