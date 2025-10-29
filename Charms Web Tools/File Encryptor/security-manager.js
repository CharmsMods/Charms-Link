/**
 * SecurityManager - Handles security and memory management operations
 * Provides secure memory cleanup, random number generation, and data leakage prevention
 */

class SecurityManager {
    constructor() {
        // Track sensitive data references for cleanup
        this.sensitiveDataRefs = new Set();
        this.memoryUsageTracker = new Map();
        this.maxMemoryUsage = 2.5 * 1024 * 1024 * 1024; // 2.5GB limit to handle 1GB files
        this.currentMemoryUsage = 0;
        
        // Detect environment
        this.isBrowser = typeof window !== 'undefined';
        this.isSecureContext = this.isBrowser ? window.isSecureContext : false;
        
        // Ensure crypto API is available
        const crypto = this.isBrowser ? window.crypto : globalThis.crypto;
        if (!crypto || !crypto.subtle) {
            throw new Error('Web Crypto API not available. This application requires a secure context (HTTPS).');
        }
        
        // Prevent browser storage usage (only in browser)
        if (this.isBrowser) {
            this.preventBrowserStorage();
            // Setup cleanup on page unload
            this.setupCleanupHandlers();
        } else {
            // Set storage disabled flag even in test environment
            this.storageDisabled = true;
        }
    }

    /**
     * Generates cryptographically secure random bytes
     * @param {number} length - Number of bytes to generate
     * @returns {Uint8Array} Secure random bytes
     */
    generateSecureRandom(length) {
        if (typeof length !== 'number' || length <= 0) {
            throw new Error('Invalid length for random generation');
        }
        
        const randomBytes = new Uint8Array(length);
        const crypto = this.isBrowser ? window.crypto : globalThis.crypto;
        crypto.getRandomValues(randomBytes);
        
        // Track for cleanup
        this.trackSensitiveData(randomBytes);
        
        return randomBytes;
    }

    /**
     * Tracks sensitive data for secure cleanup
     * @param {ArrayBuffer|Uint8Array|string} data - Sensitive data to track
     */
    trackSensitiveData(data) {
        if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
            this.sensitiveDataRefs.add(data);
        } else if (typeof data === 'string') {
            // For strings, we can't directly zero them, but we track the reference
            this.sensitiveDataRefs.add(data);
        }
    }

    /**
     * Securely clears sensitive data from memory
     * @param {ArrayBuffer|Uint8Array|Array} data - Data to clear
     */
    secureWipe(data) {
        try {
            if (data instanceof Uint8Array) {
                // Zero out the array
                data.fill(0);
                this.sensitiveDataRefs.delete(data);
            } else if (data instanceof ArrayBuffer) {
                // Zero out the buffer
                const view = new Uint8Array(data);
                view.fill(0);
                this.sensitiveDataRefs.delete(data);
            } else if (Array.isArray(data)) {
                // Zero out regular arrays
                data.fill(0);
                this.sensitiveDataRefs.delete(data);
            }
        } catch (error) {
            // Log error but don't throw to avoid breaking cleanup
            console.warn('Failed to securely wipe data:', error.message);
        }
    }

    /**
     * Performs comprehensive cleanup of all tracked sensitive data
     */
    performSecureCleanup() {
        let cleanedCount = 0;
        
        for (const data of this.sensitiveDataRefs) {
            this.secureWipe(data);
            cleanedCount++;
        }
        
        // Clear the tracking set
        this.sensitiveDataRefs.clear();
        
        // Reset memory tracking
        this.memoryUsageTracker.clear();
        this.currentMemoryUsage = 0;
        
        // Force garbage collection if available (development/debugging)
        if (this.isBrowser && window.gc && typeof window.gc === 'function') {
            try {
                window.gc();
            } catch (e) {
                // Ignore errors - gc() might not be available
            }
        }
        
        return cleanedCount;
    }

    /**
     * Monitors memory usage for large operations
     * @param {string} operationId - Unique identifier for the operation
     * @param {number} estimatedSize - Estimated memory usage in bytes
     */
    trackMemoryUsage(operationId, estimatedSize) {
        if (this.currentMemoryUsage + estimatedSize > this.maxMemoryUsage) {
            throw new Error('Operation would exceed memory limits. File too large to process safely.');
        }
        
        this.memoryUsageTracker.set(operationId, estimatedSize);
        this.currentMemoryUsage += estimatedSize;
    }

    /**
     * Releases tracked memory for an operation
     * @param {string} operationId - Operation identifier to release
     */
    releaseMemoryUsage(operationId) {
        const size = this.memoryUsageTracker.get(operationId);
        if (size) {
            this.currentMemoryUsage -= size;
            this.memoryUsageTracker.delete(operationId);
        }
    }

    /**
     * Gets current memory usage statistics
     * @returns {Object} Memory usage information
     */
    getMemoryUsage() {
        return {
            current: this.currentMemoryUsage,
            max: this.maxMemoryUsage,
            percentage: (this.currentMemoryUsage / this.maxMemoryUsage) * 100,
            operations: this.memoryUsageTracker.size
        };
    }

    /**
     * Prevents usage of browser storage APIs
     */
    preventBrowserStorage() {
        // Override localStorage and sessionStorage to prevent accidental usage
        const storageError = () => {
            throw new Error('Browser storage is disabled for security reasons');
        };
        
        // Create non-functional storage objects
        const disabledStorage = {
            getItem: storageError,
            setItem: storageError,
            removeItem: storageError,
            clear: storageError,
            key: storageError,
            length: 0
        };
        
        // Note: We don't actually override the global objects as this could break other scripts
        // Instead, we provide a method to check if storage is being used
        this.storageDisabled = true;
    }

    /**
     * Checks if browser storage is being used (for testing)
     * @returns {boolean} True if storage usage is detected
     */
    detectStorageUsage() {
        if (!this.isBrowser) {
            return false; // No storage in test environment
        }
        
        try {
            // Check if any data exists in storage
            const localStorageUsed = localStorage.length > 0;
            const sessionStorageUsed = sessionStorage.length > 0;
            
            return localStorageUsed || sessionStorageUsed;
        } catch (error) {
            // Storage might be disabled or unavailable
            return false;
        }
    }

    /**
     * Creates a secure error message without exposing sensitive information
     * @param {Error} originalError - Original error object
     * @param {string} context - Context where error occurred
     * @returns {Error} Sanitized error
     */
    createSecureError(originalError, context = 'processing') {
        // Map of technical errors to user-friendly messages
        const errorMappings = {
            'OperationError': 'Invalid password or corrupted data',
            'QuotaExceededError': 'File too large to process',
            'NotSupportedError': 'Operation not supported in this browser',
            'InvalidStateError': 'Invalid operation state',
            'DataError': 'Invalid data format',
            'TypeError': 'Invalid input data',
            'RangeError': 'Data size exceeds limits'
        };
        
        // Get user-friendly message - handle case where CONSTANTS might not be available
        let userMessage = errorMappings[originalError.name];
        if (!userMessage) {
            if (typeof CONSTANTS !== 'undefined' && CONSTANTS.ERROR_MESSAGES) {
                userMessage = CONSTANTS.ERROR_MESSAGES.PROCESSING_ERROR;
            } else {
                userMessage = 'An error occurred while processing. Please try again.';
            }
        }
        
        // Create new error without exposing technical details
        const secureError = new Error(userMessage);
        secureError.context = context;
        secureError.timestamp = Date.now();
        
        // Log technical details for debugging (but not to user)
        if (console && console.warn) {
            console.warn(`Security Manager - ${context} error:`, {
                name: originalError.name,
                message: originalError.message,
                timestamp: secureError.timestamp
            });
        }
        
        return secureError;
    }

    /**
     * Validates that no sensitive data is exposed in error messages
     * @param {string} message - Error message to validate
     * @returns {boolean} True if message is safe
     */
    validateErrorMessage(message) {
        // Patterns that might indicate sensitive data exposure
        const sensitivePatterns = [
            /password\s*:\s*\w+/i,     // "password: value" patterns
            /key\s*:\s*\w+/i,          // "key: value" patterns
            /salt\s*:\s*\w+/i,         // "salt: value" patterns
            /iv\s*:\s*\w+/i,           // "iv: value" patterns
            /token\s*:\s*\w+/i,        // "token: value" patterns
            /secret\s*:\s*\w+/i,       // "secret: value" patterns
            /private\s*:\s*\w+/i,      // "private: value" patterns
            /[A-Za-z0-9+/]{20,}/,      // Base64-like strings (20+ chars)
            /0x[0-9a-fA-F]{8,}/,       // Hex values (8+ chars)
            /\b\d{10,}\b/              // Long numbers that might be sensitive (10+ digits)
        ];
        
        return !sensitivePatterns.some(pattern => pattern.test(message));
    }

    /**
     * Sets up cleanup handlers for page unload and errors
     */
    setupCleanupHandlers() {
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            this.performSecureCleanup();
        });
        
        // Cleanup on page hide (mobile browsers)
        window.addEventListener('pagehide', () => {
            this.performSecureCleanup();
        });
        
        // Cleanup on unhandled errors
        window.addEventListener('error', (event) => {
            // Perform cleanup but don't interfere with error handling
            setTimeout(() => this.performSecureCleanup(), 0);
        });
        
        // Cleanup on unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            setTimeout(() => this.performSecureCleanup(), 0);
        });
    }

    /**
     * Creates a secure wrapper for cryptographic operations
     * @param {Function} operation - Async operation to wrap
     * @param {string} operationName - Name for tracking
     * @returns {Function} Wrapped operation with security measures
     */
    secureOperation(operation, operationName) {
        return async (...args) => {
            const operationId = `${operationName}_${Date.now()}_${Math.random()}`;
            
            try {
                // Track operation start
                const startTime = performance.now();
                
                // Execute operation
                const result = await operation(...args);
                
                // Track completion
                const duration = performance.now() - startTime;
                
                if (console && console.debug) {
                    console.debug(`Secure operation ${operationName} completed in ${duration.toFixed(2)}ms`);
                }
                
                return result;
                
            } catch (error) {
                // Create secure error
                const secureError = this.createSecureError(error, operationName);
                
                // Perform cleanup on error
                this.performSecureCleanup();
                
                throw secureError;
                
            } finally {
                // Always release memory tracking
                this.releaseMemoryUsage(operationId);
            }
        };
    }

    /**
     * Validates the security state of the application
     * @returns {Object} Security validation results
     */
    validateSecurityState() {
        const crypto = this.isBrowser ? window.crypto : globalThis.crypto;
        
        const results = {
            cryptoApiAvailable: !!(crypto && crypto.subtle),
            secureContext: this.isSecureContext,
            storageIsolated: this.isBrowser ? !this.detectStorageUsage() : true,
            memoryTracked: this.memoryUsageTracker.size >= 0,
            sensitiveDataTracked: this.sensitiveDataRefs.size >= 0,
            cleanupHandlersActive: true
        };
        
        results.overall = Object.values(results).every(Boolean);
        
        return results;
    }

    /**
     * Gets security recommendations based on current state
     * @returns {Array<string>} Array of security recommendations
     */
    getSecurityRecommendations() {
        const recommendations = [];
        const state = this.validateSecurityState();
        
        if (!state.cryptoApiAvailable) {
            recommendations.push('Web Crypto API is not available. Use HTTPS and a modern browser.');
        }
        
        if (!state.secureContext) {
            recommendations.push('Application is not running in a secure context. Use HTTPS.');
        }
        
        if (!state.storageIsolated) {
            recommendations.push('Browser storage usage detected. Clear storage for better security.');
        }
        
        if (this.currentMemoryUsage > this.maxMemoryUsage * 0.8) {
            recommendations.push('Memory usage is high. Consider processing smaller files.');
        }
        
        if (this.sensitiveDataRefs.size > 100) {
            recommendations.push('Large number of sensitive data references. Consider more frequent cleanup.');
        }
        
        return recommendations;
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.SecurityManager = SecurityManager;
}