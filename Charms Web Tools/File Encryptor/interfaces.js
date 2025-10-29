// TypeScript-style interfaces defined as JSDoc comments for JavaScript
// This file contains all the core interfaces for the Secure File Image Converter

/**
 * @typedef {Object} FileMetadata
 * @property {string} originalFilename - Original name of the file
 * @property {string} mimeType - MIME type of the file
 * @property {number} timestamp - Timestamp when file was encrypted
 * @property {string} checksum - SHA-256 hash for integrity verification
 */

/**
 * @typedef {Object} EncryptedPayload
 * @property {Uint8Array} magicHeader - 6 bytes: "ENCIMG"
 * @property {number} version - 1 byte: format version
 * @property {Uint8Array} salt - 16 bytes for key derivation
 * @property {Uint8Array} iv - 12 bytes initialization vector
 * @property {Uint8Array} encryptedData - The encrypted file data with metadata
 */

/**
 * @typedef {Object} DecryptedResult
 * @property {ArrayBuffer} fileData - The decrypted file data
 * @property {FileMetadata} metadata - File metadata extracted from encrypted payload
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether the validation passed
 * @property {string} [error] - Error message if validation failed
 * @property {string} [userMessage] - User-friendly error message
 */

/**
 * @typedef {Object} ImageDimensions
 * @property {number} width - Image width in pixels
 * @property {number} height - Image height in pixels
 */

/**
 * @typedef {function} ProgressCallback
 * @param {number} percent - Progress percentage (0-100)
 * @param {string} phase - Current processing phase
 */

/**
 * CryptoEngine Interface
 * Handles all cryptographic operations using AES-GCM encryption
 */
class CryptoEngine {
    /**
     * Encrypts file data with password and metadata
     * @param {ArrayBuffer} fileData - Raw file data to encrypt
     * @param {string} password - Password for encryption
     * @param {FileMetadata} metadata - File metadata to embed
     * @returns {Promise<EncryptedPayload>} Encrypted payload with headers
     */
    async encrypt(fileData, password, metadata) {
        throw new Error('Not implemented');
    }

    /**
     * Decrypts encrypted payload with password
     * @param {EncryptedPayload} encryptedPayload - Encrypted data with headers
     * @param {string} password - Password for decryption
     * @returns {Promise<DecryptedResult>} Decrypted data and metadata
     */
    async decrypt(encryptedPayload, password) {
        throw new Error('Not implemented');
    }

    /**
     * Derives encryption key from password and salt
     * @param {string} password - User password
     * @param {Uint8Array} salt - Random salt for key derivation
     * @param {number} version - Version number for iteration count
     * @returns {Promise<CryptoKey>} Derived encryption key
     */
    async deriveKey(password, salt, version) {
        throw new Error('Not implemented');
    }
}

/**
 * ImageConverter Interface
 * Converts between Base64 strings and PNG images using Canvas API
 */
class ImageConverter {
    /**
     * Converts Base64 string to PNG image
     * @param {string} base64Data - Base64 encoded data
     * @returns {Promise<Blob>} PNG image blob
     */
    async encodeToImage(base64Data) {
        throw new Error('Not implemented');
    }

    /**
     * Extracts Base64 data from PNG image
     * @param {File} imageFile - PNG image file
     * @returns {Promise<string>} Extracted Base64 data
     */
    async decodeFromImage(imageFile) {
        throw new Error('Not implemented');
    }

    /**
     * Calculates optimal image dimensions for data length
     * @param {number} dataLength - Length of Base64 data
     * @returns {ImageDimensions} Calculated width and height
     */
    calculateImageDimensions(dataLength) {
        throw new Error('Not implemented');
    }
}

/**
 * FileProcessor Interface
 * Orchestrates the complete encryption and decryption workflows
 */
class FileProcessor {
    /**
     * Encrypts a file with password and returns image blob
     * @param {File} file - File to encrypt
     * @param {string} password - Encryption password
     * @param {ProgressCallback} onProgress - Progress callback function
     * @returns {Promise<Blob>} Encrypted PNG image blob
     */
    async encryptFile(file, password, onProgress) {
        throw new Error('Not implemented');
    }

    /**
     * Decrypts an image file and returns original file data
     * @param {File} imageFile - Encrypted PNG image file
     * @param {string} password - Decryption password
     * @param {ProgressCallback} onProgress - Progress callback function
     * @returns {Promise<{data: ArrayBuffer, filename: string}>} Decrypted file data and name
     */
    async decryptFile(imageFile, password, onProgress) {
        throw new Error('Not implemented');
    }

    /**
     * Encrypts text with password and returns Base64 or image
     * @param {string} text - Text to encrypt
     * @param {string} password - Encryption password
     * @param {ProgressCallback} onProgress - Progress callback function
     * @returns {Promise<{base64: string, imageBlob: Blob}>} Encrypted data in both formats
     */
    async encryptText(text, password, onProgress) {
        throw new Error('Not implemented');
    }

    /**
     * Decrypts Base64 string and returns original content
     * @param {string} base64Data - Encrypted Base64 string
     * @param {string} password - Decryption password
     * @param {ProgressCallback} onProgress - Progress callback function
     * @returns {Promise<{data: ArrayBuffer, metadata: FileMetadata}>} Decrypted content and metadata
     */
    async decryptBase64(base64Data, password, onProgress) {
        throw new Error('Not implemented');
    }

    /**
     * Validates file before processing
     * @param {File} file - File to validate
     * @returns {ValidationResult} Validation result
     */
    validateFile(file) {
        throw new Error('Not implemented');
    }
}

/**
 * ValidationEngine Interface
 * Validates inputs and provides user-friendly error messages
 */
class ValidationEngine {
    /**
     * Validates file size against limits
     * @param {File} file - File to validate
     * @returns {boolean} True if file size is valid
     */
    validateFileSize(file) {
        throw new Error('Not implemented');
    }

    /**
     * Validates password strength and requirements
     * @param {string} password - Password to validate
     * @returns {boolean} True if password is valid
     */
    validatePassword(password) {
        throw new Error('Not implemented');
    }

    /**
     * Validates image format for decryption
     * @param {File} file - Image file to validate
     * @returns {boolean} True if image format is valid
     */
    validateImageFormat(file) {
        throw new Error('Not implemented');
    }

    /**
     * Validates encrypted payload structure
     * @param {Uint8Array} payload - Encrypted payload to validate
     * @returns {boolean} True if payload structure is valid
     */
    validateEncryptedPayload(payload) {
        throw new Error('Not implemented');
    }

    /**
     * Gets user-friendly error message for error code
     * @param {string} errorCode - Error code
     * @returns {string} User-friendly error message
     */
    getUserFriendlyError(errorCode) {
        throw new Error('Not implemented');
    }
}

// Constants used throughout the application
const CONSTANTS = {
    // File size limits
    MAX_FILE_SIZE: 1024 * 1024 * 1024, // 1GB in bytes
    
    // Cryptographic constants
    MAGIC_HEADER: new Uint8Array([0x45, 0x4E, 0x43, 0x49, 0x4D, 0x47]), // "ENCIMG"
    VERSION_1: 1,
    SALT_LENGTH: 16,
    IV_LENGTH: 12,
    PBKDF2_ITERATIONS_V1: 100000,
    
    // Image processing constants
    MAX_SAFE_DIMENSION: 16384, // Maximum safe image dimension
    FIXED_WIDTH: 1024, // Fixed width for non-square images
    BASE64_CHARS_PER_PIXEL: 3, // 3 Base64 chars = 1 RGB pixel
    
    // Error codes
    ERROR_CODES: {
        INVALID_PASSWORD: 'INVALID_PASSWORD',
        CORRUPTED_IMAGE: 'CORRUPTED_IMAGE',
        UNRECOGNIZED_FORMAT: 'UNRECOGNIZED_FORMAT',
        FILE_TOO_LARGE: 'FILE_TOO_LARGE',
        MEMORY_LIMIT: 'MEMORY_LIMIT',
        INVALID_IMAGE_FORMAT: 'INVALID_IMAGE_FORMAT',
        EMPTY_PASSWORD: 'EMPTY_PASSWORD',
        DECRYPTION_FAILED: 'DECRYPTION_FAILED',
        PROCESSING_ERROR: 'PROCESSING_ERROR'
    },
    
    // User-friendly error messages
    ERROR_MESSAGES: {
        INVALID_PASSWORD: 'The password you entered is incorrect. Please try again.',
        CORRUPTED_IMAGE: 'This image does not contain a valid encrypted file.',
        UNRECOGNIZED_FORMAT: 'The uploaded file is not in a recognized encrypted format.',
        FILE_TOO_LARGE: 'File size exceeds the 1GB limit. Please choose a smaller file.',
        MEMORY_LIMIT: 'File is too large to process in your browser. Try a smaller file.',
        INVALID_IMAGE_FORMAT: 'Please upload a PNG image file.',
        EMPTY_PASSWORD: 'Password cannot be empty.',
        DECRYPTION_FAILED: 'Failed to decrypt the file. Please check your password.',
        PROCESSING_ERROR: 'An error occurred while processing the file. Please try again.'
    },
    
    // Progress phases
    PROGRESS_PHASES: {
        ENCRYPTING: 'Encrypting',
        BASE64_ENCODING: 'Base64Encoding',
        RENDERING: 'Rendering',
        DECODING: 'Decoding',
        DECRYPTING: 'Decrypting'
    }
};

// Export constants for use in other files
if (typeof window !== 'undefined') {
    window.CONSTANTS = CONSTANTS;
    window.CryptoEngine = CryptoEngine;
    window.ImageConverter = ImageConverter;
    window.FileProcessor = FileProcessor;
    window.ValidationEngine = ValidationEngine;
}