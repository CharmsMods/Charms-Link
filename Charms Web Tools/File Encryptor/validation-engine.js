// ValidationEngine implementation for comprehensive input validation
// Handles file size, password, image format, and encrypted payload validation

class ValidationEngineImpl extends ValidationEngine {
    constructor() {
        super();
        this.maxFileSize = CONSTANTS.MAX_FILE_SIZE; // 1GB
        this.magicHeader = CONSTANTS.MAGIC_HEADER; // "ENCIMG"
        this.supportedImageTypes = ['image/png'];
    }

    /**
     * Validates file size against 1GB limit
     * @param {File} file - File to validate
     * @returns {boolean} True if file size is valid
     */
    validateFileSize(file) {
        if (!file) {
            return false;
        }
        
        return file.size <= this.maxFileSize;
    }

    /**
     * Validates password requirements (non-empty)
     * @param {string} password - Password to validate
     * @returns {boolean} True if password is valid
     */
    validatePassword(password) {
        if (typeof password !== 'string') {
            return false;
        }
        
        return password.trim().length > 0;
    }

    /**
     * Validates image format (PNG only) for decryption uploads
     * @param {File} file - Image file to validate
     * @returns {boolean} True if image format is valid
     */
    validateImageFormat(file) {
        if (!file) {
            return false;
        }
        
        // Check MIME type
        if (!this.supportedImageTypes.includes(file.type)) {
            return false;
        }
        
        // Check file extension as additional validation
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.png')) {
            return false;
        }
        
        return true;
    }

    /**
     * Validates encrypted payload structure with magic header verification
     * @param {Uint8Array} payload - Encrypted payload to validate
     * @returns {boolean} True if payload structure is valid
     */
    validateEncryptedPayload(payload) {
        if (!payload || !(payload instanceof Uint8Array)) {
            return false;
        }
        
        // Check minimum payload size
        // Magic header (6) + version (1) + salt (16) + IV (12) + at least 1 byte of data = 36 bytes minimum
        const minPayloadSize = this.magicHeader.length + 1 + CONSTANTS.SALT_LENGTH + CONSTANTS.IV_LENGTH + 1;
        if (payload.length < minPayloadSize) {
            return false;
        }
        
        // Verify magic header
        for (let i = 0; i < this.magicHeader.length; i++) {
            if (payload[i] !== this.magicHeader[i]) {
                return false;
            }
        }
        
        // Verify version byte (currently only version 1 is supported)
        const version = payload[this.magicHeader.length];
        if (version !== CONSTANTS.VERSION_1) {
            return false;
        }
        
        return true;
    }

    /**
     * Gets user-friendly error message for error code
     * @param {string} errorCode - Error code from CONSTANTS.ERROR_CODES
     * @returns {string} User-friendly error message
     */
    getUserFriendlyError(errorCode) {
        return CONSTANTS.ERROR_MESSAGES[errorCode] || CONSTANTS.ERROR_MESSAGES.PROCESSING_ERROR;
    }

    /**
     * Comprehensive file validation with detailed error reporting
     * @param {File} file - File to validate
     * @returns {ValidationResult} Detailed validation result
     */
    validateFileForEncryption(file) {
        if (!file) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.PROCESSING_ERROR,
                userMessage: 'No file selected'
            };
        }

        // Check file size
        if (!this.validateFileSize(file)) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.FILE_TOO_LARGE,
                userMessage: this.getUserFriendlyError(CONSTANTS.ERROR_CODES.FILE_TOO_LARGE)
            };
        }

        return {
            isValid: true
        };
    }

    /**
     * Comprehensive image validation for decryption
     * @param {File} file - Image file to validate
     * @returns {ValidationResult} Detailed validation result
     */
    validateImageForDecryption(file) {
        if (!file) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.PROCESSING_ERROR,
                userMessage: 'No image selected'
            };
        }

        // Check image format
        if (!this.validateImageFormat(file)) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.INVALID_IMAGE_FORMAT,
                userMessage: this.getUserFriendlyError(CONSTANTS.ERROR_CODES.INVALID_IMAGE_FORMAT)
            };
        }

        // Check file size (images shouldn't be too large either)
        if (!this.validateFileSize(file)) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.FILE_TOO_LARGE,
                userMessage: this.getUserFriendlyError(CONSTANTS.ERROR_CODES.FILE_TOO_LARGE)
            };
        }

        return {
            isValid: true
        };
    }

    /**
     * Validates password with detailed error reporting
     * @param {string} password - Password to validate
     * @returns {ValidationResult} Detailed validation result
     */
    validatePasswordWithDetails(password) {
        if (!this.validatePassword(password)) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.EMPTY_PASSWORD,
                userMessage: this.getUserFriendlyError(CONSTANTS.ERROR_CODES.EMPTY_PASSWORD)
            };
        }

        return {
            isValid: true
        };
    }

    /**
     * Validates encrypted payload with detailed error reporting
     * @param {Uint8Array} payload - Encrypted payload to validate
     * @returns {ValidationResult} Detailed validation result
     */
    validateEncryptedPayloadWithDetails(payload) {
        if (!payload || !(payload instanceof Uint8Array)) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.CORRUPTED_IMAGE,
                userMessage: this.getUserFriendlyError(CONSTANTS.ERROR_CODES.CORRUPTED_IMAGE)
            };
        }

        // Check minimum payload size
        const minPayloadSize = this.magicHeader.length + 1 + CONSTANTS.SALT_LENGTH + CONSTANTS.IV_LENGTH + 1;
        if (payload.length < minPayloadSize) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.CORRUPTED_IMAGE,
                userMessage: this.getUserFriendlyError(CONSTANTS.ERROR_CODES.CORRUPTED_IMAGE)
            };
        }

        // Verify magic header
        for (let i = 0; i < this.magicHeader.length; i++) {
            if (payload[i] !== this.magicHeader[i]) {
                return {
                    isValid: false,
                    error: CONSTANTS.ERROR_CODES.UNRECOGNIZED_FORMAT,
                    userMessage: this.getUserFriendlyError(CONSTANTS.ERROR_CODES.UNRECOGNIZED_FORMAT)
                };
            }
        }

        // Verify version byte
        const version = payload[this.magicHeader.length];
        if (version !== CONSTANTS.VERSION_1) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.UNRECOGNIZED_FORMAT,
                userMessage: this.getUserFriendlyError(CONSTANTS.ERROR_CODES.UNRECOGNIZED_FORMAT)
            };
        }

        return {
            isValid: true
        };
    }

    /**
     * Validates Base64 string format
     * @param {string} base64String - Base64 string to validate
     * @returns {ValidationResult} Detailed validation result
     */
    validateBase64String(base64String) {
        if (typeof base64String !== 'string' || base64String.trim().length === 0) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.PROCESSING_ERROR,
                userMessage: 'Base64 input cannot be empty'
            };
        }

        // Basic Base64 format validation
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        const cleanBase64 = base64String.trim();
        
        if (!base64Regex.test(cleanBase64)) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.CORRUPTED_IMAGE,
                userMessage: 'Invalid Base64 format'
            };
        }

        // Check if Base64 string length is valid (must be multiple of 4)
        if (cleanBase64.length % 4 !== 0) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.CORRUPTED_IMAGE,
                userMessage: 'Invalid Base64 format'
            };
        }

        return {
            isValid: true
        };
    }

    /**
     * Validates memory usage for large file processing
     * @param {number} fileSize - Size of file in bytes
     * @returns {ValidationResult} Detailed validation result
     */
    validateMemoryUsage(fileSize) {
        // Estimate memory usage: file size + Base64 encoding overhead + image processing overhead
        // Base64 encoding increases size by ~33%, plus additional overhead for processing
        const estimatedMemoryUsage = fileSize * 2.5; // Conservative estimate
        
        // Check against browser memory limits - allow up to 2.5GB for processing 1GB files
        // This ensures files up to 1GB can be processed safely
        const maxSafeMemoryUsage = 2.5 * 1024 * 1024 * 1024; // 2.5GB to handle 1GB files
        
        if (estimatedMemoryUsage > maxSafeMemoryUsage) {
            return {
                isValid: false,
                error: CONSTANTS.ERROR_CODES.MEMORY_LIMIT,
                userMessage: this.getUserFriendlyError(CONSTANTS.ERROR_CODES.MEMORY_LIMIT)
            };
        }

        return {
            isValid: true
        };
    }
}

// Export the implementation
if (typeof window !== 'undefined') {
    window.ValidationEngineImpl = ValidationEngineImpl;
}