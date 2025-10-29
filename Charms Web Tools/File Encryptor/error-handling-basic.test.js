/**
 * Basic Error Handling Tests
 * Tests core error handling functionality without complex mocks
 */

import { test, expect, describe, beforeEach } from 'vitest';

// Simple test constants
const TEST_CONSTANTS = {
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

// Simple ErrorHandler implementation for testing
class TestErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogEntries = 100;
        this.debugMode = false;
        this.errorPatterns = new Map();
        this.recoveryStrategies = new Map();
        this.setupRecoveryStrategies();
    }

    setupRecoveryStrategies() {
        this.recoveryStrategies.set(TEST_CONSTANTS.ERROR_CODES.MEMORY_LIMIT, {
            canRecover: true,
            strategy: 'suggest_smaller_file',
            message: 'Try processing a smaller file or close other browser tabs to free up memory.'
        });
        
        this.recoveryStrategies.set(TEST_CONSTANTS.ERROR_CODES.INVALID_PASSWORD, {
            canRecover: true,
            strategy: 'retry_password',
            message: 'Double-check your password and try again. Passwords are case-sensitive.'
        });
    }

    handleError(error, context = 'unknown', metadata = {}) {
        const processedError = this.processError(error, context, metadata);
        this.logError(processedError);
        this.trackErrorPattern(processedError);
        const recovery = this.getRecoveryOptions(processedError);
        
        return {
            ...processedError,
            recovery
        };
    }

    processError(error, context, metadata) {
        const timestamp = new Date().toISOString();
        const errorId = this.generateErrorId();
        
        let errorCode, message, originalError;
        
        if (error instanceof Error) {
            originalError = error.message;
            message = error.message;
        } else if (typeof error === 'string') {
            originalError = error;
            message = error;
        } else {
            originalError = 'Unknown error';
            message = 'unknown error';
        }
        
        errorCode = this.categorizeError(message);
        const userMessage = this.getUserFriendlyMessage(errorCode, originalError);
        
        return {
            id: errorId,
            timestamp,
            context,
            errorCode,
            originalError,
            userMessage,
            metadata,
            severity: this.determineSeverity(errorCode)
        };
    }

    categorizeError(message) {
        // Convert to lowercase for case-insensitive matching
        const lowerMessage = message.toLowerCase();
        
        // Password-related errors (check for password + invalid/wrong/incorrect)
        if ((lowerMessage.includes('password') && (lowerMessage.includes('invalid') || lowerMessage.includes('wrong') || lowerMessage.includes('incorrect'))) ||
            lowerMessage.includes('invalid password') || lowerMessage.includes('wrong password')) {
            return TEST_CONSTANTS.ERROR_CODES.INVALID_PASSWORD;
        }
        if (lowerMessage.includes('file too large') || lowerMessage.includes('1gb limit') || lowerMessage.includes('file size')) {
            return TEST_CONSTANTS.ERROR_CODES.FILE_TOO_LARGE;
        }
        if (lowerMessage.includes('memory limit') || lowerMessage.includes('browser memory') || lowerMessage.includes('out of memory')) {
            return TEST_CONSTANTS.ERROR_CODES.MEMORY_LIMIT;
        }
        if (lowerMessage.includes('corrupted') || lowerMessage.includes('invalid encrypted') || lowerMessage.includes('corruption')) {
            return TEST_CONSTANTS.ERROR_CODES.CORRUPTED_IMAGE;
        }
        if (lowerMessage.includes('unrecognized format') || lowerMessage.includes('magic header')) {
            return TEST_CONSTANTS.ERROR_CODES.UNRECOGNIZED_FORMAT;
        }
        if (lowerMessage.includes('empty password') || lowerMessage.includes('password cannot be empty')) {
            return TEST_CONSTANTS.ERROR_CODES.EMPTY_PASSWORD;
        }
        return TEST_CONSTANTS.ERROR_CODES.PROCESSING_ERROR;
    }

    getUserFriendlyMessage(errorCode, originalError) {
        return TEST_CONSTANTS.ERROR_MESSAGES[errorCode] || TEST_CONSTANTS.ERROR_MESSAGES.PROCESSING_ERROR;
    }

    determineSeverity(errorCode) {
        const criticalErrors = [TEST_CONSTANTS.ERROR_CODES.MEMORY_LIMIT];
        const highErrors = [TEST_CONSTANTS.ERROR_CODES.FILE_TOO_LARGE, TEST_CONSTANTS.ERROR_CODES.CORRUPTED_IMAGE];
        const mediumErrors = [TEST_CONSTANTS.ERROR_CODES.INVALID_PASSWORD, TEST_CONSTANTS.ERROR_CODES.UNRECOGNIZED_FORMAT];
        
        if (criticalErrors.includes(errorCode)) return 'critical';
        if (highErrors.includes(errorCode)) return 'high';
        if (mediumErrors.includes(errorCode)) return 'medium';
        return 'low';
    }

    getRecoveryOptions(processedError) {
        const strategy = this.recoveryStrategies.get(processedError.errorCode);
        
        if (!strategy) {
            return {
                canRecover: false,
                suggestions: ['Please try again or contact support if the problem persists.']
            };
        }
        
        return {
            canRecover: strategy.canRecover,
            strategy: strategy.strategy,
            suggestions: [strategy.message]
        };
    }

    logError(processedError) {
        this.errorLog.push(processedError);
        if (this.errorLog.length > this.maxLogEntries) {
            this.errorLog.shift();
        }
    }

    trackErrorPattern(processedError) {
        const key = `${processedError.context}:${processedError.errorCode}`;
        const current = this.errorPatterns.get(key) || { count: 0, lastSeen: null };
        
        this.errorPatterns.set(key, {
            count: current.count + 1,
            lastSeen: processedError.timestamp,
            errorCode: processedError.errorCode,
            context: processedError.context
        });
    }

    generateErrorId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `ERR_${timestamp}_${random}`.toUpperCase();
    }

    getErrorStatistics() {
        const stats = {
            totalErrors: this.errorLog.length,
            errorsByCode: {},
            errorsByContext: {},
            errorsBySeverity: {},
            recentErrors: this.errorLog.slice(-10),
            patterns: Array.from(this.errorPatterns.entries()).map(([key, data]) => ({
                pattern: key,
                ...data
            }))
        };
        
        this.errorLog.forEach(error => {
            stats.errorsByCode[error.errorCode] = (stats.errorsByCode[error.errorCode] || 0) + 1;
            stats.errorsByContext[error.context] = (stats.errorsByContext[error.context] || 0) + 1;
            stats.errorsBySeverity[error.severity] = (stats.errorsBySeverity[error.severity] || 0) + 1;
        });
        
        return stats;
    }

    clearErrorLog() {
        this.errorLog = [];
        this.errorPatterns.clear();
    }
}

describe('Error Handling System - Basic Tests', () => {
    let errorHandler;

    beforeEach(() => {
        errorHandler = new TestErrorHandler();
        errorHandler.clearErrorLog();
    });

    describe('Error Categorization', () => {
        test('should categorize password errors correctly', () => {
            const testCases = [
                'Invalid password',
                'Wrong password entered',
                'Password is invalid'
            ];

            testCases.forEach(errorMessage => {
                const processedError = errorHandler.handleError(errorMessage, 'test');
                expect(processedError.errorCode).toBe(TEST_CONSTANTS.ERROR_CODES.INVALID_PASSWORD);
                expect(processedError.userMessage).toBe(TEST_CONSTANTS.ERROR_MESSAGES.INVALID_PASSWORD);
            });
        });

        test('should categorize file size errors correctly', () => {
            const testCases = [
                'File too large for processing',
                'File exceeds 1GB limit',
                'File size is too large'
            ];

            testCases.forEach(errorMessage => {
                const processedError = errorHandler.handleError(errorMessage, 'test');
                expect(processedError.errorCode).toBe(TEST_CONSTANTS.ERROR_CODES.FILE_TOO_LARGE);
                expect(processedError.userMessage).toBe(TEST_CONSTANTS.ERROR_MESSAGES.FILE_TOO_LARGE);
            });
        });

        test('should categorize memory errors correctly', () => {
            const testCases = [
                'Memory limit exceeded',
                'Browser memory insufficient',
                'Out of memory error'
            ];

            testCases.forEach(errorMessage => {
                const processedError = errorHandler.handleError(errorMessage, 'test');
                expect(processedError.errorCode).toBe(TEST_CONSTANTS.ERROR_CODES.MEMORY_LIMIT);
                expect(processedError.userMessage).toBe(TEST_CONSTANTS.ERROR_MESSAGES.MEMORY_LIMIT);
            });
        });

        test('should categorize corruption errors correctly', () => {
            const testCases = [
                'Corrupted image data',
                'Invalid encrypted payload',
                'Data corruption detected'
            ];

            testCases.forEach(errorMessage => {
                const processedError = errorHandler.handleError(errorMessage, 'test');
                expect(processedError.errorCode).toBe(TEST_CONSTANTS.ERROR_CODES.CORRUPTED_IMAGE);
                expect(processedError.userMessage).toBe(TEST_CONSTANTS.ERROR_MESSAGES.CORRUPTED_IMAGE);
            });
        });

        test('should handle unknown errors with default category', () => {
            const processedError = errorHandler.handleError('Some unknown error', 'test');
            expect(processedError.errorCode).toBe(TEST_CONSTANTS.ERROR_CODES.PROCESSING_ERROR);
            expect(processedError.userMessage).toBe(TEST_CONSTANTS.ERROR_MESSAGES.PROCESSING_ERROR);
        });
    });

    describe('Error ID Generation', () => {
        test('should generate unique error IDs', () => {
            const error1 = errorHandler.handleError('Test error 1', 'test');
            const error2 = errorHandler.handleError('Test error 2', 'test');
            
            expect(error1.id).toBeDefined();
            expect(error2.id).toBeDefined();
            expect(error1.id).not.toBe(error2.id);
            expect(error1.id).toMatch(/^ERR_[A-Z0-9_]+$/);
            expect(error2.id).toMatch(/^ERR_[A-Z0-9_]+$/);
        });

        test('should include timestamp in error ID', () => {
            const error = errorHandler.handleError('Test error', 'test');
            expect(error.id).toContain('ERR_');
            expect(error.id.length).toBeGreaterThan(10);
        });
    });

    describe('Error Severity Classification', () => {
        test('should classify memory errors as critical', () => {
            const processedError = errorHandler.handleError('Memory limit exceeded', 'test');
            expect(processedError.severity).toBe('critical');
        });

        test('should classify file size errors as high', () => {
            const processedError = errorHandler.handleError('File too large', 'test');
            expect(processedError.severity).toBe('high');
        });

        test('should classify password errors as medium', () => {
            const processedError = errorHandler.handleError('Invalid password', 'test');
            expect(processedError.severity).toBe('medium');
        });

        test('should classify unknown errors as low', () => {
            const processedError = errorHandler.handleError('Unknown error', 'test');
            expect(processedError.severity).toBe('low');
        });
    });

    describe('Recovery Options', () => {
        test('should provide recovery options for recoverable errors', () => {
            const recoverableErrors = [
                { error: 'Invalid password', expectedStrategy: 'retry_password' },
                { error: 'Memory limit exceeded', expectedStrategy: 'suggest_smaller_file' }
            ];

            recoverableErrors.forEach(({ error, expectedStrategy }) => {
                const processedError = errorHandler.handleError(error, 'test');
                expect(processedError.recovery.canRecover).toBe(true);
                expect(processedError.recovery.strategy).toBe(expectedStrategy);
                expect(processedError.recovery.suggestions).toBeInstanceOf(Array);
                expect(processedError.recovery.suggestions.length).toBeGreaterThan(0);
            });
        });

        test('should indicate non-recoverable errors', () => {
            const processedError = errorHandler.handleError('Unknown system error', 'test');
            expect(processedError.recovery.canRecover).toBe(false);
            expect(processedError.recovery.suggestions).toBeInstanceOf(Array);
        });
    });

    describe('Error Logging and Statistics', () => {
        test('should log errors correctly', () => {
            errorHandler.handleError('Test error 1', 'context1');
            errorHandler.handleError('Test error 2', 'context2');
            
            const stats = errorHandler.getErrorStatistics();
            expect(stats.totalErrors).toBe(2);
            expect(stats.errorsByContext['context1']).toBe(1);
            expect(stats.errorsByContext['context2']).toBe(1);
        });

        test('should track error patterns', () => {
            // Generate multiple errors of the same type
            for (let i = 0; i < 3; i++) {
                errorHandler.handleError('Invalid password', 'encryption');
            }

            const stats = errorHandler.getErrorStatistics();
            expect(stats.errorsByCode[TEST_CONSTANTS.ERROR_CODES.INVALID_PASSWORD]).toBe(3);
            expect(stats.errorsByContext['encryption']).toBe(3);
            
            const pattern = stats.patterns.find(
                p => p.pattern === `encryption:${TEST_CONSTANTS.ERROR_CODES.INVALID_PASSWORD}`
            );
            expect(pattern).toBeDefined();
            expect(pattern.count).toBe(3);
        });

        test('should maintain log size limit', () => {
            const maxEntries = errorHandler.maxLogEntries;
            
            // Generate more errors than the limit
            for (let i = 0; i < maxEntries + 5; i++) {
                errorHandler.handleError(`Test error ${i}`, 'test');
            }

            const stats = errorHandler.getErrorStatistics();
            expect(stats.totalErrors).toBe(maxEntries);
        });

        test('should clear error log when requested', () => {
            errorHandler.handleError('Test error', 'test');
            expect(errorHandler.getErrorStatistics().totalErrors).toBe(1);
            
            errorHandler.clearErrorLog();
            expect(errorHandler.getErrorStatistics().totalErrors).toBe(0);
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

        test('should handle Error objects correctly', () => {
            const originalError = new Error('Original error message');
            const processedError = errorHandler.handleError(originalError, 'test');
            
            expect(processedError.originalError).toBe('Original error message');
            expect(processedError.errorCode).toBe(TEST_CONSTANTS.ERROR_CODES.PROCESSING_ERROR);
        });
    });

    describe('User-Friendly Messages', () => {
        test('should provide user-friendly messages for all error types', () => {
            const errorTypes = Object.keys(TEST_CONSTANTS.ERROR_CODES);
            
            errorTypes.forEach(errorType => {
                const errorCode = TEST_CONSTANTS.ERROR_CODES[errorType];
                const userMessage = errorHandler.getUserFriendlyMessage(errorCode);
                
                expect(userMessage).toBeDefined();
                expect(userMessage.length).toBeGreaterThan(0);
                expect(userMessage).not.toContain('undefined');
                expect(userMessage).not.toContain('null');
            });
        });

        test('should provide fallback message for unknown error codes', () => {
            const userMessage = errorHandler.getUserFriendlyMessage('UNKNOWN_ERROR_CODE');
            expect(userMessage).toBe(TEST_CONSTANTS.ERROR_MESSAGES.PROCESSING_ERROR);
        });
    });
});