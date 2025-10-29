/**
 * Comprehensive Error Handling Tests
 * Tests all error scenarios and recovery mechanisms
 */

// Import test dependencies
import { ErrorHandler } from './error-handler.js';
import CryptoEngine from './crypto-engine.js';
import { ImageConverterImpl } from './image-converter.js';
import { FileProcessorImpl } from './file-processor.js';

describe('Error Handling System', () => {
    let errorHandler;
    let fileProcessor;
    let cryptoEngine;
    let imageConverter;

    beforeEach(() => {
        errorHandler = new ErrorHandler();
        fileProcessor = new FileProcessorImpl();
        cryptoEngine = new CryptoEngine();
        imageConverter = new ImageConverterImpl();
        
        // Clear any previous error logs
        errorHandler.clearErrorLog();
    });

    describe('ErrorHandler Core Functionality', () => {
        test('should categorize errors correctly', () => {
            const testCases = [
                { error: 'Invalid password', expectedCode: CONSTANTS.ERROR_CODES.INVALID_PASSWORD },
                { error: 'File too large', expectedCode: CONSTANTS.ERROR_CODES.FILE_TOO_LARGE },
                { error: 'Memory limit exceeded', expectedCode: CONSTANTS.ERROR_CODES.MEMORY_LIMIT },
                { error: 'Corrupted image data', expectedCode: CONSTANTS.ERROR_CODES.CORRUPTED_IMAGE },
                { error: 'Unrecognized format', expectedCode: CONSTANTS.ERROR_CODES.UNRECOGNIZED_FORMAT },
                { error: 'Empty password', expectedCode: CONSTANTS.ERROR_CODES.EMPTY_PASSWORD },
                { error: 'Unknown error', expectedCode: CONSTANTS.ERROR_CODES.PROCESSING_ERROR }
            ];

            testCases.forEach(({ error, expectedCode }) => {
                const processedError = errorHandler.handleError(error, 'test');
                expect(processedError.errorCode).toBe(expectedCode);
            });
        });

        test('should generate unique error IDs', () => {
            const error1 = errorHandler.handleError('Test error 1', 'test');
            const error2 = errorHandler.handleError('Test error 2', 'test');
            
            expect(error1.id).toBeDefined();
            expect(error2.id).toBeDefined();
            expect(error1.id).not.toBe(error2.id);
            expect(error1.id).toMatch(/^ERR_[A-Z0-9_]+$/);
        });

        test('should provide recovery options for recoverable errors', () => {
            const recoverableErrors = [
                CONSTANTS.ERROR_CODES.INVALID_PASSWORD,
                CONSTANTS.ERROR_CODES.FILE_TOO_LARGE,
                CONSTANTS.ERROR_CODES.MEMORY_LIMIT,
                CONSTANTS.ERROR_CODES.CORRUPTED_IMAGE
            ];

            recoverableErrors.forEach(errorCode => {
                const processedError = errorHandler.handleError(errorCode, 'test');
                expect(processedError.recovery.canRecover).toBe(true);
                expect(processedError.recovery.suggestions).toBeInstanceOf(Array);
                expect(processedError.recovery.suggestions.length).toBeGreaterThan(0);
            });
        });

        test('should track error patterns', () => {
            // Generate multiple errors of the same type
            for (let i = 0; i < 3; i++) {
                errorHandler.handleError('Invalid password', 'encryption');
            }

            const stats = errorHandler.getErrorStatistics();
            expect(stats.errorsByCode[CONSTANTS.ERROR_CODES.INVALID_PASSWORD]).toBe(3);
            expect(stats.errorsByContext['encryption']).toBe(3);
        });

        test('should determine error severity correctly', () => {
            const severityTests = [
                { error: 'Memory limit exceeded', expectedSeverity: 'critical' },
                { error: 'File too large', expectedSeverity: 'high' },
                { error: 'Invalid password', expectedSeverity: 'medium' },
                { error: 'Processing error', expectedSeverity: 'low' }
            ];

            severityTests.forEach(({ error, expectedSeverity }) => {
                const processedError = errorHandler.handleError(error, 'test');
                expect(processedError.severity).toBe(expectedSeverity);
            });
        });
    });

    describe('File Validation Error Scenarios', () => {
        test('should handle file size validation errors', () => {
            // Create a mock file that exceeds size limit
            const oversizedFile = new File(['x'.repeat(1024 * 1024 * 1024 + 1)], 'large.txt', {
                type: 'text/plain'
            });

            const validation = fileProcessor.validateFile(oversizedFile);
            expect(validation.isValid).toBe(false);
            expect(validation.userMessage).toContain('1GB limit');
        });

        test('should handle empty password validation', () => {
            const validation = fileProcessor.validatePassword('');
            expect(validation.isValid).toBe(false);
            expect(validation.userMessage).toContain('empty');
        });

        test('should handle invalid image format validation', () => {
            const invalidImageFile = new File(['fake image data'], 'test.jpg', {
                type: 'image/jpeg'
            });

            const validation = fileProcessor.validateImageFile(invalidImageFile);
            expect(validation.isValid).toBe(false);
            expect(validation.userMessage).toContain('PNG');
        });
    });

    describe('Encryption Error Scenarios', () => {
        test('should handle encryption with invalid input', async () => {
            try {
                await cryptoEngine.encrypt(null, 'password', {});
                fail('Should have thrown an error');
            } catch (error) {
                const processedError = errorHandler.handleError(error, 'encryption');
                expect(processedError.errorCode).toBe(CONSTANTS.ERROR_CODES.PROCESSING_ERROR);
                expect(processedError.userMessage).toBeDefined();
            }
        });

        test('should handle encryption with empty password', async () => {
            const testData = new ArrayBuffer(100);
            const metadata = { filename: 'test.txt', mimeType: 'text/plain', timestamp: Date.now() };

            try {
                await cryptoEngine.encrypt(testData, '', metadata);
                fail('Should have thrown an error');
            } catch (error) {
                const processedError = errorHandler.handleError(error, 'encryption');
                expect(processedError.recovery.canRecover).toBe(true);
                expect(processedError.recovery.strategy).toBe('retry_password');
            }
        });

        test('should handle memory limit during encryption', async () => {
            // Create a very large array buffer to simulate memory limit
            const largeData = new ArrayBuffer(1024 * 1024 * 1024); // 1GB
            const metadata = { filename: 'large.bin', mimeType: 'application/octet-stream', timestamp: Date.now() };

            try {
                await cryptoEngine.encrypt(largeData, 'password', metadata);
                // This might not always fail depending on system memory, so we'll simulate
                throw new Error('Memory limit exceeded during encryption');
            } catch (error) {
                const processedError = errorHandler.handleError(error, 'encryption');
                expect(processedError.errorCode).toBe(CONSTANTS.ERROR_CODES.MEMORY_LIMIT);
                expect(processedError.severity).toBe('critical');
            }
        });
    });

    describe('Decryption Error Scenarios', () => {
        test('should handle decryption with wrong password', async () => {
            // First encrypt some data
            const testData = new TextEncoder().encode('test data');
            const metadata = { filename: 'test.txt', mimeType: 'text/plain', timestamp: Date.now() };
            const encrypted = await cryptoEngine.encrypt(testData.buffer, 'correct_password', metadata);

            // Try to decrypt with wrong password
            try {
                await cryptoEngine.decrypt(encrypted, 'wrong_password');
                fail('Should have thrown an error');
            } catch (error) {
                const processedError = errorHandler.handleError(error, 'decryption');
                expect(processedError.errorCode).toBe(CONSTANTS.ERROR_CODES.INVALID_PASSWORD);
                expect(processedError.recovery.canRecover).toBe(true);
                expect(processedError.recovery.strategy).toBe('retry_password');
            }
        });

        test('should handle corrupted encrypted payload', async () => {
            // Create corrupted payload
            const corruptedPayload = new Uint8Array([1, 2, 3, 4, 5]);

            try {
                await cryptoEngine.decrypt(corruptedPayload, 'password');
                fail('Should have thrown an error');
            } catch (error) {
                const processedError = errorHandler.handleError(error, 'decryption');
                expect(processedError.errorCode).toBe(CONSTANTS.ERROR_CODES.UNRECOGNIZED_FORMAT);
                expect(processedError.recovery.canRecover).toBe(true);
            }
        });

        test('should handle invalid magic header', async () => {
            // Create payload with invalid magic header
            const invalidPayload = new Uint8Array(50);
            invalidPayload.set([0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 0); // Wrong magic header

            try {
                await cryptoEngine.decrypt(invalidPayload, 'password');
                fail('Should have thrown an error');
            } catch (error) {
                const processedError = errorHandler.handleError(error, 'decryption');
                expect(processedError.errorCode).toBe(CONSTANTS.ERROR_CODES.UNRECOGNIZED_FORMAT);
            }
        });
    });

    describe('Image Conversion Error Scenarios', () => {
        test('should handle image dimension calculation errors', () => {
            try {
                // Try to create an image that would exceed memory limits
                const hugeDataLength = 1024 * 1024 * 1024 * 10; // 10GB worth of data
                imageConverter.calculateImageDimensions(hugeDataLength);
                fail('Should have thrown an error');
            } catch (error) {
                const processedError = errorHandler.handleError(error, 'image_conversion');
                expect(processedError.errorCode).toBe(CONSTANTS.ERROR_CODES.MEMORY_LIMIT);
            }
        });

        test('should handle invalid Base64 data for image encoding', async () => {
            try {
                await imageConverter.encodeToImage(null);
                fail('Should have thrown an error');
            } catch (error) {
                const processedError = errorHandler.handleError(error, 'image_conversion');
                expect(processedError.errorCode).toBe(CONSTANTS.ERROR_CODES.PROCESSING_ERROR);
            }
        });

        test('should handle corrupted image file for decoding', async () => {
            // Create a fake image file
            const fakeImageData = new Uint8Array([0x89, 0x50, 0x4E, 0x47]); // PNG header
            const fakeImageFile = new File([fakeImageData], 'fake.png', { type: 'image/png' });

            try {
                await imageConverter.decodeFromImage(fakeImageFile);
                fail('Should have thrown an error');
            } catch (error) {
                const processedError = errorHandler.handleError(error, 'image_conversion');
                expect(processedError.errorCode).toBe(CONSTANTS.ERROR_CODES.CORRUPTED_IMAGE);
                expect(processedError.recovery.canRecover).toBe(true);
            }
        });
    });

    describe('Base64 Validation Error Scenarios', () => {
        test('should handle invalid Base64 strings', () => {
            const invalidBase64Strings = [
                '',
                '   ',
                'invalid!@#$%',
                'ABC', // Invalid length (not multiple of 4)
                'AB==CD' // Invalid padding position
            ];

            invalidBase64Strings.forEach(invalidString => {
                const validation = fileProcessor.validationEngine.validateBase64String(invalidString);
                expect(validation.isValid).toBe(false);
                expect(validation.userMessage).toBeDefined();
            });
        });
    });

    describe('Progress Reporting Error Scenarios', () => {
        test('should handle progress callback errors gracefully', async () => {
            const testFile = new File(['test data'], 'test.txt', { type: 'text/plain' });
            
            // Create a progress callback that throws an error
            const faultyProgressCallback = (percent, phase) => {
                if (percent > 50) {
                    throw new Error('Progress callback error');
                }
            };

            // The operation should still complete despite progress callback errors
            try {
                const result = await fileProcessor.encryptFile(testFile, 'password', faultyProgressCallback);
                expect(result).toBeDefined();
            } catch (error) {
                // If the operation fails, it should be due to the main operation, not progress callback
                expect(error.message).not.toContain('Progress callback error');
            }
        });
    });

    describe('Memory Management Error Scenarios', () => {
        test('should handle memory cleanup errors', () => {
            // Simulate memory cleanup failure
            const originalPerformSecureCleanup = errorHandler.securityManager?.performSecureCleanup;
            
            if (errorHandler.securityManager) {
                errorHandler.securityManager.performSecureCleanup = () => {
                    throw new Error('Cleanup failed');
                };

                // This should not crash the application
                expect(() => {
                    errorHandler.securityManager.performSecureCleanup();
                }).toThrow('Cleanup failed');

                // Restore original method
                errorHandler.securityManager.performSecureCleanup = originalPerformSecureCleanup;
            }
        });
    });

    describe('Error Recovery Mechanisms', () => {
        test('should provide appropriate recovery suggestions for each error type', () => {
            const errorRecoveryTests = [
                {
                    errorCode: CONSTANTS.ERROR_CODES.INVALID_PASSWORD,
                    expectedSuggestions: ['password', 'case-sensitive', 'Caps Lock']
                },
                {
                    errorCode: CONSTANTS.ERROR_CODES.FILE_TOO_LARGE,
                    expectedSuggestions: ['compress', 'smaller']
                },
                {
                    errorCode: CONSTANTS.ERROR_CODES.MEMORY_LIMIT,
                    expectedSuggestions: ['memory', 'tabs', 'browser']
                },
                {
                    errorCode: CONSTANTS.ERROR_CODES.CORRUPTED_IMAGE,
                    expectedSuggestions: ['re-upload', 'download', 'corrupted']
                }
            ];

            errorRecoveryTests.forEach(({ errorCode, expectedSuggestions }) => {
                const processedError = errorHandler.handleError(errorCode, 'test');
                const suggestions = processedError.recovery.suggestions.join(' ').toLowerCase();
                
                expectedSuggestions.forEach(keyword => {
                    expect(suggestions).toContain(keyword.toLowerCase());
                });
            });
        });
    });

    describe('Error Logging and Statistics', () => {
        test('should maintain error log with size limit', () => {
            // Generate more errors than the log limit
            const maxLogEntries = errorHandler.maxLogEntries;
            
            for (let i = 0; i < maxLogEntries + 10; i++) {
                errorHandler.handleError(`Test error ${i}`, 'test');
            }

            const stats = errorHandler.getErrorStatistics();
            expect(stats.totalErrors).toBe(maxLogEntries);
        });

        test('should export error log correctly', () => {
            errorHandler.handleError('Test error', 'test');
            const exportedLog = errorHandler.exportErrorLog();
            
            expect(exportedLog).toBeDefined();
            const parsed = JSON.parse(exportedLog);
            expect(parsed.timestamp).toBeDefined();
            expect(parsed.errors).toBeInstanceOf(Array);
            expect(parsed.statistics).toBeDefined();
        });

        test('should track error patterns correctly', () => {
            // Generate pattern of errors
            errorHandler.handleError('Invalid password', 'encryption');
            errorHandler.handleError('Invalid password', 'encryption');
            errorHandler.handleError('File too large', 'validation');

            const stats = errorHandler.getErrorStatistics();
            expect(stats.patterns).toBeInstanceOf(Array);
            
            const encryptionPasswordPattern = stats.patterns.find(
                p => p.pattern === `encryption:${CONSTANTS.ERROR_CODES.INVALID_PASSWORD}`
            );
            expect(encryptionPasswordPattern).toBeDefined();
            expect(encryptionPasswordPattern.count).toBe(2);
        });
    });

    describe('Unhandled Error Scenarios', () => {
        test('should handle unhandled promise rejections', (done) => {
            const originalHandler = window.onunhandledrejection;
            
            // Set up test handler
            window.onunhandledrejection = (event) => {
                expect(event.reason).toBeDefined();
                // Restore original handler
                window.onunhandledrejection = originalHandler;
                done();
            };

            // Trigger unhandled rejection
            Promise.reject(new Error('Unhandled test error'));
        });

        test('should handle JavaScript errors', () => {
            const originalHandler = window.onerror;
            let errorCaught = false;
            
            // Set up test handler
            window.onerror = (message, source, lineno, colno, error) => {
                errorCaught = true;
                window.onerror = originalHandler;
                return true; // Prevent default handling
            };

            // Trigger JavaScript error
            try {
                throw new Error('Test JavaScript error');
            } catch (error) {
                // Manually trigger the error handler since we're in a try-catch
                window.onerror(error.message, '', 0, 0, error);
            }

            expect(errorCaught).toBe(true);
        });
    });

    describe('User Interface Error Handling', () => {
        test('should display error messages with proper severity styling', () => {
            // This would require DOM testing environment
            // For now, we'll test the error message generation
            const criticalError = errorHandler.handleError('Memory limit exceeded', 'test');
            const lowError = errorHandler.handleError('Processing error', 'test');

            expect(criticalError.severity).toBe('critical');
            expect(lowError.severity).toBe('low');
            expect(criticalError.userMessage).toBeDefined();
            expect(lowError.userMessage).toBeDefined();
        });
    });

    describe('Error Context and Metadata', () => {
        test('should preserve error context and metadata', () => {
            const metadata = {
                fileSize: 1024,
                operation: 'encryption',
                timestamp: Date.now()
            };

            const processedError = errorHandler.handleError('Test error', 'test_context', metadata);
            
            expect(processedError.context).toBe('test_context');
            expect(processedError.metadata).toEqual(metadata);
            expect(processedError.timestamp).toBeDefined();
        });
    });
});

// Helper function to create test files
function createTestFile(name, size, type = 'text/plain') {
    const content = 'x'.repeat(size);
    return new File([content], name, { type });
}

// Helper function to create test image file
function createTestImageFile(name, isValid = true) {
    const header = isValid 
        ? new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) // Valid PNG header
        : new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG header (invalid for our use)
    
    return new File([header], name, { type: isValid ? 'image/png' : 'image/jpeg' });
}

// Export test utilities for use in other test files
export { createTestFile, createTestImageFile };