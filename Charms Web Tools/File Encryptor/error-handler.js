/**
 * Comprehensive Error Handling System
 * Provides centralized error handling, user-friendly messages, and error recovery
 */

class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogEntries = 100;
        this.debugMode = false;

        // Initialize error recovery strategies
        this.recoveryStrategies = new Map();
        this.setupRecoveryStrategies();

        // Track error patterns for debugging
        this.errorPatterns = new Map();

        // Setup global error handlers
        this.setupGlobalErrorHandlers();
    }

    /**
     * Setup recovery strategies for different error types
     */
    setupRecoveryStrategies() {
        this.recoveryStrategies.set(CONSTANTS.ERROR_CODES.MEMORY_LIMIT, {
            canRecover: true,
            strategy: 'suggest_smaller_file',
            message: 'Try processing a smaller file or close other browser tabs to free up memory.'
        });

        this.recoveryStrategies.set(CONSTANTS.ERROR_CODES.FILE_TOO_LARGE, {
            canRecover: true,
            strategy: 'suggest_compression',
            message: 'Consider compressing your file or splitting it into smaller parts.'
        });

        this.recoveryStrategies.set(CONSTANTS.ERROR_CODES.INVALID_PASSWORD, {
            canRecover: true,
            strategy: 'retry_password',
            message: 'Double-check your password and try again. Passwords are case-sensitive.'
        });

        this.recoveryStrategies.set(CONSTANTS.ERROR_CODES.CORRUPTED_IMAGE, {
            canRecover: true,
            strategy: 'reupload_file',
            message: 'Try re-uploading the image file. The file may have been corrupted during transfer.'
        });

        this.recoveryStrategies.set(CONSTANTS.ERROR_CODES.INVALID_IMAGE_FORMAT, {
            canRecover: true,
            strategy: 'convert_format',
            message: 'Please ensure the file is a PNG image. Other formats are not supported.'
        });
    }

    /**
     * Setup global error handlers for unhandled errors
     */
    setupGlobalErrorHandlers() {
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleUnhandledError(event.reason, 'unhandled_promise_rejection');
            event.preventDefault();
        });

        // Handle general JavaScript errors
        window.addEventListener('error', (event) => {
            this.handleUnhandledError(event.error, 'javascript_error');
        });
    }

    /**
     * Main error handling method
     * @param {Error|string} error - The error to handle
     * @param {string} context - Context where error occurred
     * @param {Object} metadata - Additional error metadata
     * @returns {ProcessedError} Processed error with user-friendly message and recovery options
     */
    handleError(error, context = 'unknown', metadata = {}) {
        const processedError = this.processError(error, context, metadata);

        // Log the error
        this.logError(processedError);

        // Track error patterns
        this.trackErrorPattern(processedError);

        // Determine recovery options
        const recovery = this.getRecoveryOptions(processedError);

        return {
            ...processedError,
            recovery
        };
    }

    /**
     * Process raw error into structured format
     * @param {Error|string} error - Raw error
     * @param {string} context - Error context
     * @param {Object} metadata - Additional metadata
     * @returns {ProcessedError} Structured error object
     */
    processError(error, context, metadata) {
        const timestamp = new Date().toISOString();
        const errorId = this.generateErrorId();

        let errorCode, message, originalError, stack;

        if (error instanceof Error) {
            originalError = error.message;
            stack = error.stack;
            message = error.message.toLowerCase();
        } else if (typeof error === 'string') {
            originalError = error;
            message = error.toLowerCase();
        } else {
            originalError = 'Unknown error';
            message = 'unknown error';
        }

        // Determine error code based on message content
        errorCode = this.categorizeError(message);

        // Get user-friendly message
        const userMessage = this.getUserFriendlyMessage(errorCode, originalError);

        return {
            id: errorId,
            timestamp,
            context,
            errorCode,
            originalError,
            userMessage,
            stack,
            metadata,
            severity: this.determineSeverity(errorCode)
        };
    }

    /**
     * Categorize error based on message content
     * @param {string} message - Error message (lowercase)
     * @returns {string} Error code from CONSTANTS.ERROR_CODES
     */
    categorizeError(message) {
        // Cryptographic errors
        if (message.includes('invalid password') ||
            message.includes('decryption failed') ||
            message.includes('wrong password')) {
            return CONSTANTS.ERROR_CODES.INVALID_PASSWORD;
        }

        if (message.includes('unrecognized format') ||
            message.includes('magic header') ||
            message.includes('invalid format version')) {
            return CONSTANTS.ERROR_CODES.UNRECOGNIZED_FORMAT;
        }

        // File and memory errors
        if (message.includes('file too large') ||
            message.includes('1gb limit') ||
            message.includes('exceeds.*limit')) {
            return CONSTANTS.ERROR_CODES.FILE_TOO_LARGE;
        }

        if (message.includes('memory limit') ||
            message.includes('browser memory') ||
            message.includes('out of memory') ||
            message.includes('memory usage')) {
            return CONSTANTS.ERROR_CODES.MEMORY_LIMIT;
        }

        // Image processing errors
        if (message.includes('corrupted') ||
            message.includes('invalid encrypted') ||
            message.includes('does not contain') ||
            message.includes('failed to decode')) {
            return CONSTANTS.ERROR_CODES.CORRUPTED_IMAGE;
        }

        if (message.includes('image format') ||
            message.includes('png') ||
            message.includes('unsupported format')) {
            return CONSTANTS.ERROR_CODES.INVALID_IMAGE_FORMAT;
        }

        // Input validation errors
        if (message.includes('empty password') ||
            message.includes('password cannot be empty') ||
            message.includes('password required')) {
            return CONSTANTS.ERROR_CODES.EMPTY_PASSWORD;
        }

        if (message.includes('base64') &&
            (message.includes('invalid') || message.includes('format'))) {
            return CONSTANTS.ERROR_CODES.CORRUPTED_IMAGE;
        }

        // Network and browser errors
        if (message.includes('network') ||
            message.includes('fetch') ||
            message.includes('connection')) {
            return 'NETWORK_ERROR';
        }

        if (message.includes('quota') ||
            message.includes('storage') ||
            message.includes('disk space')) {
            return 'STORAGE_ERROR';
        }

        // Default to processing error
        return CONSTANTS.ERROR_CODES.PROCESSING_ERROR;
    }

    /**
     * Get user-friendly error message
     * @param {string} errorCode - Error code
     * @param {string} originalError - Original error message
     * @returns {string} User-friendly error message
     */
    getUserFriendlyMessage(errorCode, originalError) {
        const baseMessage = CONSTANTS.ERROR_MESSAGES[errorCode] || CONSTANTS.ERROR_MESSAGES.PROCESSING_ERROR;

        // Add context-specific details for certain errors
        switch (errorCode) {
            case CONSTANTS.ERROR_CODES.MEMORY_LIMIT:
                return `${baseMessage} The file you're trying to process requires more memory than your browser can safely allocate.`;

            case CONSTANTS.ERROR_CODES.FILE_TOO_LARGE:
                return `${baseMessage} Maximum supported file size is 1GB.`;

            case CONSTANTS.ERROR_CODES.CORRUPTED_IMAGE:
                return `${baseMessage} Please ensure you're uploading the correct encrypted image file.`;

            case CONSTANTS.ERROR_CODES.INVALID_PASSWORD:
                return `${baseMessage} Remember that passwords are case-sensitive.`;

            case 'NETWORK_ERROR':
                return 'Network connection issue detected. Please check your internet connection and try again.';

            case 'STORAGE_ERROR':
                return 'Browser storage limit reached. Please clear some browser data and try again.';

            default:
                return baseMessage;
        }
    }

    /**
     * Determine error severity level
     * @param {string} errorCode - Error code
     * @returns {string} Severity level (low, medium, high, critical)
     */
    determineSeverity(errorCode) {
        const criticalErrors = [CONSTANTS.ERROR_CODES.MEMORY_LIMIT, 'STORAGE_ERROR'];
        const highErrors = [CONSTANTS.ERROR_CODES.FILE_TOO_LARGE, CONSTANTS.ERROR_CODES.CORRUPTED_IMAGE];
        const mediumErrors = [CONSTANTS.ERROR_CODES.INVALID_PASSWORD, CONSTANTS.ERROR_CODES.UNRECOGNIZED_FORMAT];

        if (criticalErrors.includes(errorCode)) return 'critical';
        if (highErrors.includes(errorCode)) return 'high';
        if (mediumErrors.includes(errorCode)) return 'medium';
        return 'low';
    }

    /**
     * Get recovery options for error
     * @param {ProcessedError} processedError - Processed error object
     * @returns {RecoveryOptions} Recovery options
     */
    getRecoveryOptions(processedError) {
        const strategy = this.recoveryStrategies.get(processedError.errorCode);

        if (!strategy) {
            return {
                canRecover: false,
                suggestions: ['Please try again or contact support if the problem persists.']
            };
        }

        const suggestions = [strategy.message];

        // Add additional context-specific suggestions
        switch (processedError.errorCode) {
            case CONSTANTS.ERROR_CODES.MEMORY_LIMIT:
                suggestions.push('Close other browser tabs and applications to free up memory.');
                suggestions.push('Try using a desktop browser instead of mobile for better performance.');
                break;

            case CONSTANTS.ERROR_CODES.INVALID_PASSWORD:
                suggestions.push('Check if Caps Lock is enabled.');
                suggestions.push('Try copying and pasting the password to avoid typing errors.');
                break;

            case CONSTANTS.ERROR_CODES.CORRUPTED_IMAGE:
                suggestions.push('Verify the image was downloaded completely.');
                suggestions.push('Try saving the image again from the original source.');
                break;
        }

        return {
            canRecover: strategy.canRecover,
            strategy: strategy.strategy,
            suggestions
        };
    }

    /**
     * Log error for debugging and analysis
     * @param {ProcessedError} processedError - Processed error to log
     */
    logError(processedError) {
        // Add to error log
        this.errorLog.push(processedError);

        // Maintain log size limit
        if (this.errorLog.length > this.maxLogEntries) {
            this.errorLog.shift();
        }

        // Console logging based on severity
        const logMethod = this.getLogMethod(processedError.severity);

        if (this.debugMode) {
            logMethod(`[${processedError.id}] ${processedError.context}: ${processedError.originalError}`, {
                errorCode: processedError.errorCode,
                userMessage: processedError.userMessage,
                metadata: processedError.metadata,
                stack: processedError.stack
            });
        } else {
            // Production logging (less verbose)
            logMethod(`Error ${processedError.id}: ${processedError.userMessage}`);
        }
    }

    /**
     * Get appropriate console log method based on severity
     * @param {string} severity - Error severity
     * @returns {Function} Console log method
     */
    getLogMethod(severity) {
        switch (severity) {
            case 'critical': return console.error;
            case 'high': return console.error;
            case 'medium': return console.warn;
            case 'low': return console.info;
            default: return console.log;
        }
    }

    /**
     * Track error patterns for analysis
     * @param {ProcessedError} processedError - Processed error
     */
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

    /**
     * Handle unhandled errors
     * @param {Error} error - Unhandled error
     * @param {string} type - Type of unhandled error
     */
    handleUnhandledError(error, type) {
        const processedError = this.handleError(error, `unhandled_${type}`, {
            unhandled: true,
            type
        });

        // Show user notification for critical unhandled errors
        if (processedError.severity === 'critical') {
            this.showCriticalErrorNotification(processedError);
        }
    }

    /**
     * Show critical error notification to user
     * @param {ProcessedError} processedError - Critical error
     */
    showCriticalErrorNotification(processedError) {
        // Create a modal or notification for critical errors
        const notification = document.createElement('div');
        notification.className = 'critical-error-notification';
        notification.innerHTML = `
            <div class="error-content">
                <h3>Critical Error Detected</h3>
                <p>${processedError.userMessage}</p>
                <p>Error ID: ${processedError.id}</p>
                <button onclick="this.parentElement.parentElement.remove()">Close</button>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 10000);
    }

    /**
     * Generate unique error ID
     * @returns {string} Unique error ID
     */
    generateErrorId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `ERR_${timestamp}_${random}`.toUpperCase();
    }

    /**
     * Get error statistics for debugging
     * @returns {Object} Error statistics
     */
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

        // Aggregate statistics
        this.errorLog.forEach(error => {
            stats.errorsByCode[error.errorCode] = (stats.errorsByCode[error.errorCode] || 0) + 1;
            stats.errorsByContext[error.context] = (stats.errorsByContext[error.context] || 0) + 1;
            stats.errorsBySeverity[error.severity] = (stats.errorsBySeverity[error.severity] || 0) + 1;
        });

        return stats;
    }

    /**
     * Clear error log (for testing or maintenance)
     */
    clearErrorLog() {
        this.errorLog = [];
        this.errorPatterns.clear();
    }

    /**
     * Enable or disable debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`Error handler debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Export error log for analysis
     * @returns {string} JSON string of error log
     */
    exportErrorLog() {
        return JSON.stringify({
            timestamp: new Date().toISOString(),
            errors: this.errorLog,
            patterns: Array.from(this.errorPatterns.entries()),
            statistics: this.getErrorStatistics()
        }, null, 2);
    }
}

/**
 * @typedef {Object} ProcessedError
 * @property {string} id - Unique error identifier
 * @property {string} timestamp - ISO timestamp
 * @property {string} context - Context where error occurred
 * @property {string} errorCode - Categorized error code
 * @property {string} originalError - Original error message
 * @property {string} userMessage - User-friendly error message
 * @property {string} stack - Error stack trace
 * @property {Object} metadata - Additional error metadata
 * @property {string} severity - Error severity level
 * @property {RecoveryOptions} recovery - Recovery options
 */

/**
 * @typedef {Object} RecoveryOptions
 * @property {boolean} canRecover - Whether error is recoverable
 * @property {string} strategy - Recovery strategy identifier
 * @property {string[]} suggestions - List of recovery suggestions
 */

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.ErrorHandler = ErrorHandler;
}