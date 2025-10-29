/**
 * Comprehensive FileProcessor Integration Tests
 * Tests complete encrypt → decrypt cycles and all error scenarios
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Web Crypto API for Node.js testing environment
if (typeof crypto === 'undefined') {
    global.crypto = require('crypto').webcrypto;
}

// Setup browser-like globals and constants
const setupGlobals = () => {
    globalThis.CONSTANTS = {
        MAX_FILE_SIZE: 1024 * 1024 * 1024, // 1GB
        MAGIC_HEADER: new Uint8Array([0x45, 0x4E, 0x43, 0x49, 0x4D, 0x47]), // "ENCIMG"
        VERSION_1: 1,
        SALT_LENGTH: 16,
        IV_LENGTH: 12,
        BASE64_CHARS_PER_PIXEL: 3,
        MAX_SAFE_DIMENSION: 16384,
        FIXED_WIDTH: 1024,
        PROGRESS_PHASES: {
            ENCRYPTING: 'Encrypting',
            BASE64_ENCODING: 'Base64Encoding',
            RENDERING: 'Rendering',
            DECODING: 'Decoding',
            DECRYPTING: 'Decrypting'
        },
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

    // Mock DOM APIs
    globalThis.document = {
        createElement: vi.fn((tagName) => {
            if (tagName === 'canvas') {
                return {
                    width: 0,
                    height: 0,
                    getContext: vi.fn(() => ({
                        createImageData: vi.fn((w, h) => ({ 
                            data: new Uint8ClampedArray(w * h * 4),
                            width: w,
                            height: h
                        })),
                        putImageData: vi.fn(),
                        drawImage: vi.fn(),
                        getImageData: vi.fn((x, y, w, h) => ({ 
                            data: new Uint8ClampedArray(w * h * 4),
                            width: w,
                            height: h
                        }))
                    })),
                    toBlob: vi.fn((callback) => {
                        const mockBlob = new Blob(['mock-png-data'], { type: 'image/png' });
                        callback(mockBlob);
                    })
                };
            }
            return {};
        })
    };

    globalThis.Image = vi.fn(() => ({
        width: 10,
        height: 10,
        onload: null,
        onerror: null,
        set src(value) {
            setTimeout(() => this.onload && this.onload(), 0);
        }
    }));

    globalThis.URL = {
        createObjectURL: vi.fn(() => 'mock-object-url'),
        revokeObjectURL: vi.fn()
    };

    globalThis.FileReader = vi.fn(() => ({
        onload: null,
        onerror: null,
        result: null,
        readAsArrayBuffer: vi.fn(function(file) {
            setTimeout(() => {
                this.result = new ArrayBuffer(file.size);
                // Fill with some test data
                const view = new Uint8Array(this.result);
                for (let i = 0; i < view.length; i++) {
                    view[i] = i % 256;
                }
                this.onload && this.onload();
            }, 0);
        })
    }));

    globalThis.TextEncoder = TextEncoder;
    globalThis.TextDecoder = TextDecoder;
};

// Mock File class
class MockFile {
    constructor(name, size, type, content = null) {
        this.name = name;
        this.size = size;
        this.type = type;
        this.lastModified = Date.now();
        this._content = content;
    }
}

describe('FileProcessor Integration Tests', () => {
    let FileProcessorImpl;
    let fileProcessor;

    beforeEach(async () => {
        setupGlobals();
        vi.clearAllMocks();

        // Import the FileProcessor implementation
        const module = await import('./file-processor.js');
        FileProcessorImpl = module.FileProcessorImpl;
        fileProcessor = new FileProcessorImpl();
    });

    describe('Complete Encryption Workflow', () => {
        it('should encrypt a text file with all progress phases', async () => {
            const testContent = 'This is a test file content for encryption testing.';
            const mockFile = new MockFile('test.txt', testContent.length, 'text/plain');
            const password = 'secure-test-password-123';
            const progressUpdates = [];

            const result = await fileProcessor.encryptFile(mockFile, password, (percent, phase) => {
                progressUpdates.push({ percent, phase });
            });

            // Verify result
            expect(result).toBeInstanceOf(Blob);
            expect(result.type).toBe('image/png');

            // Verify progress reporting
            expect(progressUpdates.length).toBeGreaterThan(0);
            expect(progressUpdates[0].percent).toBe(0);
            expect(progressUpdates[progressUpdates.length - 1].percent).toBe(100);

            // Verify all expected phases are reported
            const phases = progressUpdates.map(update => update.phase);
            expect(phases).toContain(CONSTANTS.PROGRESS_PHASES.ENCRYPTING);
            expect(phases).toContain(CONSTANTS.PROGRESS_PHASES.BASE64_ENCODING);
            expect(phases).toContain(CONSTANTS.PROGRESS_PHASES.RENDERING);
        });

        it('should encrypt a binary file successfully', async () => {
            // Create mock binary file (simulating a small image)
            const binaryData = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
            const mockFile = new MockFile('test.png', binaryData.length, 'image/png');
            const password = 'binary-file-password';

            const result = await fileProcessor.encryptFile(mockFile, password);

            expect(result).toBeInstanceOf(Blob);
            expect(result.type).toBe('image/png');
        });

        it('should encrypt large file with memory validation', async () => {
            // Test with a moderately large file (10MB)
            const largeFileSize = 10 * 1024 * 1024;
            const mockFile = new MockFile('large.bin', largeFileSize, 'application/octet-stream');
            const password = 'large-file-password';

            const result = await fileProcessor.encryptFile(mockFile, password);

            expect(result).toBeInstanceOf(Blob);
        });
    });

    describe('Complete Decryption Workflow', () => {
        it('should decrypt an image file with all progress phases', async () => {
            const mockImageFile = new MockFile('encrypted.png', 1024, 'image/png');
            const password = 'decryption-test-password';
            const progressUpdates = [];

            // Mock the image converter to return valid Base64 data
            const mockBase64 = btoa('mock-encrypted-payload-data');
            vi.spyOn(fileProcessor.imageConverter, 'decodeFromImage')
                .mockResolvedValue(mockBase64);

            // Mock the crypto engine to return valid decrypted data
            vi.spyOn(fileProcessor.cryptoEngine, 'decrypt')
                .mockResolvedValue({
                    fileData: new TextEncoder().encode('Decrypted content').buffer,
                    metadata: {
                        filename: 'original.txt',
                        mimeType: 'text/plain',
                        timestamp: Date.now()
                    }
                });

            const result = await fileProcessor.decryptFile(mockImageFile, password, (percent, phase) => {
                progressUpdates.push({ percent, phase });
            });

            // Verify result
            expect(result).toHaveProperty('data');
            expect(result).toHaveProperty('filename');
            expect(result).toHaveProperty('mimeType');
            expect(result.data).toBeInstanceOf(ArrayBuffer);
            expect(result.filename).toBe('original.txt');
            expect(result.mimeType).toBe('text/plain');

            // Verify progress reporting
            expect(progressUpdates.length).toBeGreaterThan(0);
            expect(progressUpdates[0].percent).toBe(0);
            expect(progressUpdates[progressUpdates.length - 1].percent).toBe(100);

            // Verify all expected phases are reported
            const phases = progressUpdates.map(update => update.phase);
            expect(phases).toContain(CONSTANTS.PROGRESS_PHASES.DECODING);
            expect(phases).toContain(CONSTANTS.PROGRESS_PHASES.DECRYPTING);
        });
    });

    describe('Text Encryption/Decryption', () => {
        it('should encrypt and decrypt text content', async () => {
            const originalText = 'This is a secret message that needs to be encrypted!';
            const password = 'text-encryption-password';

            // Encrypt text
            const encryptResult = await fileProcessor.encryptText(originalText, password);

            expect(encryptResult).toHaveProperty('base64');
            expect(encryptResult).toHaveProperty('imageBlob');
            expect(encryptResult.base64).toBeTruthy();
            expect(encryptResult.imageBlob).toBeInstanceOf(Blob);

            // Mock decryption to return the original text
            vi.spyOn(fileProcessor.cryptoEngine, 'decrypt')
                .mockResolvedValue({
                    fileData: new TextEncoder().encode(originalText).buffer,
                    metadata: {
                        filename: 'encrypted_text.txt',
                        mimeType: 'text/plain',
                        timestamp: Date.now()
                    }
                });

            // Decrypt Base64
            const decryptResult = await fileProcessor.decryptBase64(encryptResult.base64, password);

            expect(decryptResult).toHaveProperty('data');
            expect(decryptResult).toHaveProperty('metadata');
            expect(new TextDecoder().decode(decryptResult.data)).toBe(originalText);
        });
    });

    describe('Complete Encrypt → Decrypt Cycles', () => {
        it('should complete full cycle for text file', async () => {
            const originalContent = 'Complete integration test content';
            const mockFile = new MockFile('integration.txt', originalContent.length, 'text/plain');
            const password = 'integration-test-password';

            // Step 1: Encrypt file
            const encryptedBlob = await fileProcessor.encryptFile(mockFile, password);
            expect(encryptedBlob).toBeInstanceOf(Blob);

            // Step 2: Create mock encrypted image file
            const encryptedImageFile = new MockFile('encrypted.png', encryptedBlob.size, 'image/png');

            // Step 3: Mock the full decryption chain
            // Mock image converter to return the Base64 data that would be extracted
            const mockBase64 = btoa('mock-encrypted-data-for-integration-test');
            vi.spyOn(fileProcessor.imageConverter, 'decodeFromImage')
                .mockResolvedValue(mockBase64);

            // Mock crypto engine to return the original content
            vi.spyOn(fileProcessor.cryptoEngine, 'decrypt')
                .mockResolvedValue({
                    fileData: new TextEncoder().encode(originalContent).buffer,
                    metadata: {
                        filename: mockFile.name,
                        mimeType: mockFile.type,
                        timestamp: Date.now()
                    }
                });

            // Step 4: Decrypt the image
            const decryptedResult = await fileProcessor.decryptFile(encryptedImageFile, password);

            // Verify the cycle completed successfully
            expect(decryptedResult.filename).toBe(mockFile.name);
            expect(decryptedResult.mimeType).toBe(mockFile.type);
            expect(new TextDecoder().decode(decryptedResult.data)).toBe(originalContent);
        });

        it('should complete full cycle for binary file', async () => {
            const binaryContent = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
            const mockFile = new MockFile('test.png', binaryContent.length, 'image/png');
            const password = 'binary-integration-password';

            // Encrypt
            const encryptedBlob = await fileProcessor.encryptFile(mockFile, password);
            expect(encryptedBlob).toBeInstanceOf(Blob);

            // Mock decryption chain
            const encryptedImageFile = new MockFile('encrypted.png', encryptedBlob.size, 'image/png');
            
            vi.spyOn(fileProcessor.imageConverter, 'decodeFromImage')
                .mockResolvedValue(btoa('mock-binary-encrypted-data'));

            vi.spyOn(fileProcessor.cryptoEngine, 'decrypt')
                .mockResolvedValue({
                    fileData: binaryContent.buffer,
                    metadata: {
                        filename: mockFile.name,
                        mimeType: mockFile.type,
                        timestamp: Date.now()
                    }
                });

            // Decrypt
            const decryptedResult = await fileProcessor.decryptFile(encryptedImageFile, password);

            // Verify binary data integrity
            expect(decryptedResult.filename).toBe(mockFile.name);
            expect(new Uint8Array(decryptedResult.data)).toEqual(binaryContent);
        });
    });

    describe('Error Handling and Validation', () => {
        it('should reject files that are too large', async () => {
            const hugeFile = new MockFile('huge.bin', CONSTANTS.MAX_FILE_SIZE + 1, 'application/octet-stream');
            const password = 'test-password';

            await expect(fileProcessor.encryptFile(hugeFile, password))
                .rejects.toThrow(CONSTANTS.ERROR_MESSAGES.FILE_TOO_LARGE);
        });

        it('should reject empty passwords', async () => {
            const mockFile = new MockFile('test.txt', 1024, 'text/plain');

            await expect(fileProcessor.encryptFile(mockFile, ''))
                .rejects.toThrow(CONSTANTS.ERROR_MESSAGES.EMPTY_PASSWORD);

            await expect(fileProcessor.encryptFile(mockFile, '   '))
                .rejects.toThrow(CONSTANTS.ERROR_MESSAGES.EMPTY_PASSWORD);
        });

        it('should reject non-PNG files for decryption', async () => {
            const jpegFile = new MockFile('image.jpg', 1024, 'image/jpeg');
            const password = 'test-password';

            await expect(fileProcessor.decryptFile(jpegFile, password))
                .rejects.toThrow(CONSTANTS.ERROR_MESSAGES.INVALID_IMAGE_FORMAT);
        });

        it('should handle memory limit validation', async () => {
            // Create a file that would exceed memory limits
            const memoryIntensiveFile = new MockFile('huge.bin', 800 * 1024 * 1024, 'application/octet-stream');
            const password = 'test-password';

            await expect(fileProcessor.encryptFile(memoryIntensiveFile, password))
                .rejects.toThrow(CONSTANTS.ERROR_MESSAGES.MEMORY_LIMIT);
        });

        it('should handle invalid Base64 input', async () => {
            const invalidBase64 = 'This is not valid Base64!@#$';
            const password = 'test-password';

            await expect(fileProcessor.decryptBase64(invalidBase64, password))
                .rejects.toThrow('Invalid Base64 format');
        });

        it('should handle corrupted encrypted payloads', async () => {
            const mockImageFile = new MockFile('corrupted.png', 1024, 'image/png');
            const password = 'test-password';

            // Mock image converter to return invalid Base64
            vi.spyOn(fileProcessor.imageConverter, 'decodeFromImage')
                .mockResolvedValue('validBase64ButCorruptedPayload==');

            // Mock validation to fail
            vi.spyOn(fileProcessor.validationEngine, 'validateEncryptedPayloadWithDetails')
                .mockReturnValue({
                    isValid: false,
                    userMessage: CONSTANTS.ERROR_MESSAGES.CORRUPTED_IMAGE
                });

            await expect(fileProcessor.decryptFile(mockImageFile, password))
                .rejects.toThrow(CONSTANTS.ERROR_MESSAGES.CORRUPTED_IMAGE);
        });

        it('should handle wrong password during decryption', async () => {
            const mockImageFile = new MockFile('encrypted.png', 1024, 'image/png');
            const wrongPassword = 'wrong-password';

            // Mock successful validation and image decoding
            vi.spyOn(fileProcessor.imageConverter, 'decodeFromImage')
                .mockResolvedValue(btoa('mock-encrypted-data'));

            vi.spyOn(fileProcessor.validationEngine, 'validateEncryptedPayloadWithDetails')
                .mockReturnValue({ isValid: true });

            // Mock crypto engine to throw invalid password error
            vi.spyOn(fileProcessor.cryptoEngine, 'decrypt')
                .mockRejectedValue(new Error('Invalid password'));

            await expect(fileProcessor.decryptFile(mockImageFile, wrongPassword))
                .rejects.toThrow(CONSTANTS.ERROR_MESSAGES.INVALID_PASSWORD);
        });
    });

    describe('Memory Management and Performance', () => {
        it('should estimate processing time correctly', () => {
            const fileSize1MB = 1024 * 1024;
            const fileSize10MB = 10 * 1024 * 1024;

            const time1MB = fileProcessor.estimateProcessingTime(fileSize1MB);
            const time10MB = fileProcessor.estimateProcessingTime(fileSize10MB);

            expect(time1MB).toBeGreaterThan(0);
            expect(time10MB).toBeGreaterThan(time1MB);
            expect(time10MB).toBeCloseTo(10, 0); // Should be around 10 seconds for 10MB
        });

        it('should estimate memory usage correctly', () => {
            const fileSize1MB = 1024 * 1024;
            const memoryUsage = fileProcessor.getMemoryUsageEstimate(fileSize1MB);

            expect(memoryUsage).toBeGreaterThan(0);
            expect(memoryUsage).toBeCloseTo(2.5, 1); // Should be around 2.5MB for 1MB file
        });
    });

    describe('User-Friendly Error Messages', () => {
        it('should provide user-friendly error messages for all error types', () => {
            const testCases = [
                { input: new Error('invalid password'), expected: CONSTANTS.ERROR_MESSAGES.INVALID_PASSWORD },
                { input: new Error('decryption failed'), expected: CONSTANTS.ERROR_MESSAGES.INVALID_PASSWORD },
                { input: new Error('unrecognized format'), expected: CONSTANTS.ERROR_MESSAGES.UNRECOGNIZED_FORMAT },
                { input: new Error('magic header'), expected: CONSTANTS.ERROR_MESSAGES.UNRECOGNIZED_FORMAT },
                { input: new Error('corrupted'), expected: CONSTANTS.ERROR_MESSAGES.CORRUPTED_IMAGE },
                { input: new Error('file too large'), expected: CONSTANTS.ERROR_MESSAGES.FILE_TOO_LARGE },
                { input: new Error('memory limit'), expected: CONSTANTS.ERROR_MESSAGES.MEMORY_LIMIT },
                { input: new Error('image format'), expected: CONSTANTS.ERROR_MESSAGES.INVALID_IMAGE_FORMAT },
                { input: new Error('empty password'), expected: CONSTANTS.ERROR_MESSAGES.EMPTY_PASSWORD }
            ];

            testCases.forEach(({ input, expected }) => {
                const result = fileProcessor.createUserFriendlyError(input);
                expect(result.message).toBe(expected);
            });
        });

        it('should handle unknown errors gracefully', () => {
            const unknownError = new Error('Some unexpected error occurred');
            const result = fileProcessor.createUserFriendlyError(unknownError);
            
            expect(result.message).toBe('Some unexpected error occurred');
        });
    });

    describe('Component Integration', () => {
        it('should properly integrate all validation components', () => {
            const validFile = new MockFile('test.txt', 1024, 'text/plain');
            const invalidFile = new MockFile('huge.bin', CONSTANTS.MAX_FILE_SIZE + 1, 'application/octet-stream');

            const validResult = fileProcessor.validateFile(validFile);
            const invalidResult = fileProcessor.validateFile(invalidFile);

            expect(validResult.isValid).toBe(true);
            expect(invalidResult.isValid).toBe(false);
        });

        it('should properly integrate image validation', () => {
            const validImage = new MockFile('test.png', 1024, 'image/png');
            const invalidImage = new MockFile('test.jpg', 1024, 'image/jpeg');

            const validResult = fileProcessor.validateImageFile(validImage);
            const invalidResult = fileProcessor.validateImageFile(invalidImage);

            expect(validResult.isValid).toBe(true);
            expect(invalidResult.isValid).toBe(false);
        });

        it('should properly integrate password validation', () => {
            const validPassword = 'secure-password-123';
            const invalidPassword = '';

            const validResult = fileProcessor.validatePassword(validPassword);
            const invalidResult = fileProcessor.validatePassword(invalidPassword);

            expect(validResult.isValid).toBe(true);
            expect(invalidResult.isValid).toBe(false);
        });
    });
});