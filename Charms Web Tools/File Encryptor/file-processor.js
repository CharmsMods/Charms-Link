/**
 * FileProcessor Implementation
 * Orchestrates the complete encryption and decryption workflows
 * Integrates ValidationEngine, CryptoEngine, and ImageConverter components
 */

// Import dependencies
import CryptoEngine from './crypto-engine.js';
import { ImageConverterImpl } from './image-converter.js';

// Define base classes
class FileProcessor {}

// Define ValidationEngineImpl if not available
let ValidationEngineImpl;
if (typeof window !== 'undefined' && window.ValidationEngineImpl) {
    ValidationEngineImpl = window.ValidationEngineImpl;
} else {
    // Minimal implementation for testing
    ValidationEngineImpl = class {
        validateFileForEncryption(file) {
            if (!file) return { isValid: false, userMessage: 'No file selected' };
            if (file.size > (typeof CONSTANTS !== 'undefined' ? CONSTANTS.MAX_FILE_SIZE : 1024 * 1024 * 1024)) {
                return { isValid: false, userMessage: 'File size exceeds the 1GB limit. Please choose a smaller file.' };
            }
            return { isValid: true };
        }
        
        validatePasswordWithDetails(password) {
            if (!password || password.trim().length === 0) {
                return { isValid: false, userMessage: 'Password cannot be empty.' };
            }
            return { isValid: true };
        }
        
        validateMemoryUsage(fileSize) {
            const estimatedMemoryUsage = fileSize * 2.5;
            const maxSafeMemoryUsage = 1024 * 1024 * 1024; // 1GB
            if (estimatedMemoryUsage > maxSafeMemoryUsage) {
                return { isValid: false, userMessage: 'File is too large to process in your browser. Try a smaller file.' };
            }
            return { isValid: true };
        }
        
        validateImageForDecryption(file) {
            if (!file) return { isValid: false, userMessage: 'No image selected' };
            if (file.type !== 'image/png') {
                return { isValid: false, userMessage: 'Please upload a PNG image file.' };
            }
            return { isValid: true };
        }
        
        validateEncryptedPayloadWithDetails(payload) {
            if (!payload || !(payload instanceof Uint8Array)) {
                return { isValid: false, userMessage: 'This image does not contain a valid encrypted file.' };
            }
            return { isValid: true };
        }
        
        validateBase64String(base64String) {
            if (typeof base64String !== 'string' || base64String.trim().length === 0) {
                return { isValid: false, userMessage: 'Base64 input cannot be empty' };
            }
            return { isValid: true };
        }
    };
}

class FileProcessorImpl extends FileProcessor {
    constructor() {
        super();
        this.validationEngine = new ValidationEngineImpl();
        this.cryptoEngine = new CryptoEngine();
        this.imageConverter = new ImageConverterImpl();
        this.securityManager = this.initializeSecurityManager();
    }

    /**
     * Initialize SecurityManager if available
     * @returns {SecurityManager|Object} SecurityManager instance or minimal implementation
     */
    initializeSecurityManager() {
        try {
            // Try to get SecurityManager from global scope first
            if (typeof window !== 'undefined' && window.SecurityManager) {
                return new window.SecurityManager();
            }
            
            // Try to get SecurityManager from import
            if (typeof SecurityManager !== 'undefined') {
                return new SecurityManager();
            }
            
            // Return a minimal security manager for testing
            return this.createMinimalSecurityManager();
        } catch (error) {
            console.warn('SecurityManager not available, using minimal implementation');
            return this.createMinimalSecurityManager();
        }
    }

    /**
     * Creates a minimal security manager for testing/fallback
     * @returns {Object} Minimal security manager
     */
    createMinimalSecurityManager() {
        return {
            trackMemoryUsage: () => {},
            releaseMemoryUsage: () => {},
            trackSensitiveData: () => {},
            secureWipe: (data) => {
                if (data instanceof Uint8Array) data.fill(0);
                else if (data instanceof ArrayBuffer) new Uint8Array(data).fill(0);
            },
            createSecureError: (error, context) => error,
            performSecureCleanup: () => 0
        };
    }

    /**
     * Encrypts a file with password and returns image blob
     * @param {File} file - File to encrypt
     * @param {string} password - Encryption password
     * @param {ProgressCallback} onProgress - Progress callback function
     * @returns {Promise<Blob>} Encrypted PNG image blob
     */
    async encryptFile(file, password, onProgress = () => {}) {
        const operationId = `encryptFile_${Date.now()}`;
        let fileData, base64Data;
        
        try {
            // Phase 1: Validation (0-10%)
            onProgress(0, CONSTANTS.PROGRESS_PHASES.ENCRYPTING);
            
            // Validate file
            const fileValidation = this.validationEngine.validateFileForEncryption(file);
            if (!fileValidation.isValid) {
                throw new Error(fileValidation.userMessage);
            }

            // Validate password
            const passwordValidation = this.validationEngine.validatePasswordWithDetails(password);
            if (!passwordValidation.isValid) {
                throw new Error(passwordValidation.userMessage);
            }

            // Validate memory usage with SecurityManager
            const estimatedMemory = file.size * 3; // File + Base64 + Image processing
            this.securityManager.trackMemoryUsage(operationId, estimatedMemory);

            onProgress(10, CONSTANTS.PROGRESS_PHASES.ENCRYPTING);

            // Phase 2: Read file data (10-20%)
            fileData = await this.readFileAsArrayBuffer(file);
            this.securityManager.trackSensitiveData(new Uint8Array(fileData));
            onProgress(20, CONSTANTS.PROGRESS_PHASES.ENCRYPTING);

            // Phase 3: Encrypt file (20-60%)
            const metadata = {
                filename: file.name,
                mimeType: file.type || 'application/octet-stream',
                timestamp: Date.now()
            };

            const encryptedPayload = await this.cryptoEngine.encrypt(fileData, password, metadata);
            onProgress(60, CONSTANTS.PROGRESS_PHASES.BASE64_ENCODING);

            // Phase 4: Convert to Base64 (60-70%)
            base64Data = this.arrayBufferToBase64(encryptedPayload);
            this.securityManager.trackSensitiveData(base64Data);
            onProgress(70, CONSTANTS.PROGRESS_PHASES.RENDERING);

            // Phase 5: Convert to image (70-100%)
            const imageBlob = await this.imageConverter.encodeToImage(base64Data);
            onProgress(100, CONSTANTS.PROGRESS_PHASES.RENDERING);

            // Secure cleanup of intermediate data
            this.securityManager.secureWipe(new Uint8Array(fileData));
            this.securityManager.secureWipe(base64Data);

            return imageBlob;

        } catch (error) {
            // Secure cleanup on error
            if (fileData) this.securityManager.secureWipe(new Uint8Array(fileData));
            if (base64Data) this.securityManager.secureWipe(base64Data);
            
            throw this.securityManager.createSecureError(error, 'file encryption');
        } finally {
            // Always release memory tracking
            this.securityManager.releaseMemoryUsage(operationId);
        }
    }

    /**
     * Decrypts an image file and returns original file data
     * @param {File} imageFile - Encrypted PNG image file
     * @param {string} password - Decryption password
     * @param {ProgressCallback} onProgress - Progress callback function
     * @returns {Promise<{data: ArrayBuffer, filename: string}>} Decrypted file data and name
     */
    async decryptFile(imageFile, password, onProgress = () => {}) {
        const operationId = `decryptFile_${Date.now()}`;
        let base64Data, encryptedPayload;
        
        try {
            // Phase 1: Validation (0-10%)
            onProgress(0, CONSTANTS.PROGRESS_PHASES.DECODING);

            // Validate image file
            const imageValidation = this.validationEngine.validateImageForDecryption(imageFile);
            if (!imageValidation.isValid) {
                throw new Error(imageValidation.userMessage);
            }

            // Validate password
            const passwordValidation = this.validationEngine.validatePasswordWithDetails(password);
            if (!passwordValidation.isValid) {
                throw new Error(passwordValidation.userMessage);
            }

            // Track memory usage for this operation
            const estimatedMemory = imageFile.size * 2.5; // Conservative estimate
            this.securityManager.trackMemoryUsage(operationId, estimatedMemory);

            onProgress(10, CONSTANTS.PROGRESS_PHASES.DECODING);

            // Phase 2: Extract Base64 from image (10-40%)
            base64Data = await this.imageConverter.decodeFromImage(imageFile);
            this.securityManager.trackSensitiveData(base64Data);
            onProgress(40, CONSTANTS.PROGRESS_PHASES.DECODING);

            // Phase 3: Convert Base64 to binary (40-50%)
            encryptedPayload = this.base64ToArrayBuffer(base64Data);
            this.securityManager.trackSensitiveData(encryptedPayload);
            onProgress(50, CONSTANTS.PROGRESS_PHASES.DECRYPTING);

            // Phase 4: Validate encrypted payload (50-60%)
            const payloadValidation = this.validationEngine.validateEncryptedPayloadWithDetails(encryptedPayload);
            if (!payloadValidation.isValid) {
                throw new Error(payloadValidation.userMessage);
            }

            onProgress(60, CONSTANTS.PROGRESS_PHASES.DECRYPTING);

            // Phase 5: Decrypt file (60-100%)
            const decryptedResult = await this.cryptoEngine.decrypt(encryptedPayload, password);
            onProgress(100, CONSTANTS.PROGRESS_PHASES.DECRYPTING);

            // Check if this is a multi-file archive
            const isArchive = this.isMultiFileArchive(decryptedResult.fileData, decryptedResult.metadata);
            
            // Secure cleanup of intermediate data
            this.securityManager.secureWipe(base64Data);
            this.securityManager.secureWipe(encryptedPayload);

            return {
                data: decryptedResult.fileData,
                filename: decryptedResult.metadata.filename,
                mimeType: isArchive ? 'application/x-file-archive' : decryptedResult.metadata.mimeType,
                isArchive: isArchive,
                metadata: decryptedResult.metadata
            };

        } catch (error) {
            // Secure cleanup on error
            if (base64Data) this.securityManager.secureWipe(base64Data);
            if (encryptedPayload) this.securityManager.secureWipe(encryptedPayload);
            
            throw this.securityManager.createSecureError(error, 'file decryption');
        } finally {
            // Always release memory tracking
            this.securityManager.releaseMemoryUsage(operationId);
        }
    }

    /**
     * Encrypts text with password and returns Base64 or image
     * @param {string} text - Text to encrypt
     * @param {string} password - Encryption password
     * @param {ProgressCallback} onProgress - Progress callback function
     * @returns {Promise<{base64: string, imageBlob: Blob}>} Encrypted data in both formats
     */
    async encryptText(text, password, onProgress = () => {}) {
        const operationId = `encryptText_${Date.now()}`;
        let textData, base64Data;
        
        try {
            // Phase 1: Validation (0-10%)
            onProgress(0, CONSTANTS.PROGRESS_PHASES.ENCRYPTING);

            if (typeof text !== 'string' || text.trim().length === 0) {
                throw new Error('Text input cannot be empty');
            }

            // Validate password
            const passwordValidation = this.validationEngine.validatePasswordWithDetails(password);
            if (!passwordValidation.isValid) {
                throw new Error(passwordValidation.userMessage);
            }

            // Convert text to ArrayBuffer and track it
            textData = new TextEncoder().encode(text);
            this.securityManager.trackSensitiveData(textData);
            
            // Track memory usage for this operation
            const estimatedMemory = textData.length * 3; // Text + Base64 + Image processing
            this.securityManager.trackMemoryUsage(operationId, estimatedMemory);

            onProgress(10, CONSTANTS.PROGRESS_PHASES.ENCRYPTING);

            // Phase 2: Encrypt text (10-50%)
            const metadata = {
                filename: 'encrypted_text.txt',
                mimeType: 'text/plain',
                timestamp: Date.now()
            };

            const encryptedPayload = await this.cryptoEngine.encrypt(textData.buffer, password, metadata);
            onProgress(50, CONSTANTS.PROGRESS_PHASES.BASE64_ENCODING);

            // Phase 3: Convert to Base64 (50-70%)
            base64Data = this.arrayBufferToBase64(encryptedPayload);
            this.securityManager.trackSensitiveData(base64Data);
            onProgress(70, CONSTANTS.PROGRESS_PHASES.RENDERING);

            // Phase 4: Convert to image (70-100%)
            const imageBlob = await this.imageConverter.encodeToImage(base64Data);
            onProgress(100, CONSTANTS.PROGRESS_PHASES.RENDERING);

            // Secure cleanup of intermediate data
            this.securityManager.secureWipe(textData);
            this.securityManager.secureWipe(base64Data);

            return {
                base64: base64Data,
                imageBlob: imageBlob
            };

        } catch (error) {
            // Secure cleanup on error
            if (textData) this.securityManager.secureWipe(textData);
            if (base64Data) this.securityManager.secureWipe(base64Data);
            
            throw this.securityManager.createSecureError(error, 'text encryption');
        } finally {
            // Always release memory tracking
            this.securityManager.releaseMemoryUsage(operationId);
        }
    }

    /**
     * Decrypts Base64 string and returns original content
     * @param {string} base64Data - Encrypted Base64 string
     * @param {string} password - Decryption password
     * @param {ProgressCallback} onProgress - Progress callback function
     * @returns {Promise<{data: ArrayBuffer, metadata: FileMetadata}>} Decrypted content and metadata
     */
    async decryptBase64(base64Data, password, onProgress = () => {}) {
        const operationId = `decryptBase64_${Date.now()}`;
        let encryptedPayload;
        
        try {
            // Phase 1: Validation (0-20%)
            onProgress(0, CONSTANTS.PROGRESS_PHASES.DECODING);

            // Validate Base64 input
            const base64Validation = this.validationEngine.validateBase64String(base64Data);
            if (!base64Validation.isValid) {
                throw new Error(base64Validation.userMessage);
            }

            // Validate password
            const passwordValidation = this.validationEngine.validatePasswordWithDetails(password);
            if (!passwordValidation.isValid) {
                throw new Error(passwordValidation.userMessage);
            }

            // Track memory usage for this operation
            const estimatedMemory = base64Data.length * 1.5; // Conservative estimate
            this.securityManager.trackMemoryUsage(operationId, estimatedMemory);

            onProgress(20, CONSTANTS.PROGRESS_PHASES.DECODING);

            // Phase 2: Convert Base64 to binary (20-40%)
            encryptedPayload = this.base64ToArrayBuffer(base64Data.trim());
            this.securityManager.trackSensitiveData(encryptedPayload);
            onProgress(40, CONSTANTS.PROGRESS_PHASES.DECRYPTING);

            // Phase 3: Validate encrypted payload (40-50%)
            const payloadValidation = this.validationEngine.validateEncryptedPayloadWithDetails(encryptedPayload);
            if (!payloadValidation.isValid) {
                throw new Error(payloadValidation.userMessage);
            }

            onProgress(50, CONSTANTS.PROGRESS_PHASES.DECRYPTING);

            // Phase 4: Decrypt content (50-100%)
            const decryptedResult = await this.cryptoEngine.decrypt(encryptedPayload, password);
            onProgress(100, CONSTANTS.PROGRESS_PHASES.DECRYPTING);

            // Secure cleanup of intermediate data
            this.securityManager.secureWipe(encryptedPayload);

            return {
                data: decryptedResult.fileData,
                metadata: decryptedResult.metadata
            };

        } catch (error) {
            // Secure cleanup on error
            if (encryptedPayload) this.securityManager.secureWipe(encryptedPayload);
            
            throw this.securityManager.createSecureError(error, 'base64 decryption');
        } finally {
            // Always release memory tracking
            this.securityManager.releaseMemoryUsage(operationId);
        }
    }

    /**
     * Validates file before processing
     * @param {File} file - File to validate
     * @returns {ValidationResult} Validation result
     */
    validateFile(file) {
        return this.validationEngine.validateFileForEncryption(file);
    }

    /**
     * Validates image file for decryption
     * @param {File} imageFile - Image file to validate
     * @returns {ValidationResult} Validation result
     */
    validateImageFile(imageFile) {
        return this.validationEngine.validateImageForDecryption(imageFile);
    }

    /**
     * Validates password
     * @param {string} password - Password to validate
     * @returns {ValidationResult} Validation result
     */
    validatePassword(password) {
        return this.validationEngine.validatePasswordWithDetails(password);
    }

    // Helper methods

    /**
     * Reads file as ArrayBuffer
     * @param {File} file - File to read
     * @returns {Promise<ArrayBuffer>} File data as ArrayBuffer
     */
    async readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Converts ArrayBuffer to Base64 string
     * @param {ArrayBuffer|Uint8Array} buffer - Buffer to convert
     * @returns {string} Base64 string
     */
    arrayBufferToBase64(buffer) {
        const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Converts Base64 string to Uint8Array
     * @param {string} base64 - Base64 string to convert
     * @returns {Uint8Array} Converted binary data
     */
    base64ToArrayBuffer(base64) {
        try {
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return bytes;
        } catch (error) {
            throw new Error('Invalid Base64 format');
        }
    }

    /**
     * Creates user-friendly error from technical error
     * @param {Error} error - Original error
     * @returns {Error} User-friendly error
     */
    createUserFriendlyError(error) {
        // Map common technical errors to user-friendly messages
        const message = error.message.toLowerCase();
        
        if (message.includes('invalid password') || message.includes('decryption failed')) {
            return new Error(CONSTANTS.ERROR_MESSAGES.INVALID_PASSWORD);
        }
        
        if (message.includes('unrecognized format') || message.includes('magic header')) {
            return new Error(CONSTANTS.ERROR_MESSAGES.UNRECOGNIZED_FORMAT);
        }
        
        if (message.includes('corrupted') || message.includes('invalid encrypted')) {
            return new Error(CONSTANTS.ERROR_MESSAGES.CORRUPTED_IMAGE);
        }
        
        if (message.includes('file too large') || message.includes('1gb limit')) {
            return new Error(CONSTANTS.ERROR_MESSAGES.FILE_TOO_LARGE);
        }
        
        if (message.includes('memory limit') || message.includes('browser memory')) {
            return new Error(CONSTANTS.ERROR_MESSAGES.MEMORY_LIMIT);
        }
        
        if (message.includes('image format') || message.includes('png')) {
            return new Error(CONSTANTS.ERROR_MESSAGES.INVALID_IMAGE_FORMAT);
        }
        
        if (message.includes('empty password') || message.includes('password cannot be empty')) {
            return new Error(CONSTANTS.ERROR_MESSAGES.EMPTY_PASSWORD);
        }
        
        // Return original error message if no mapping found, but ensure it's user-friendly
        return new Error(error.message || CONSTANTS.ERROR_MESSAGES.PROCESSING_ERROR);
    }

    /**
     * Estimates processing time for large files
     * @param {number} fileSize - File size in bytes
     * @returns {number} Estimated processing time in seconds
     */
    estimateProcessingTime(fileSize) {
        // Rough estimate: 1MB per second for encryption/decryption
        const baseMBPerSecond = 1;
        const fileSizeMB = fileSize / (1024 * 1024);
        return Math.max(1, Math.ceil(fileSizeMB / baseMBPerSecond));
    }

    /**
     * Gets memory usage estimate for file processing
     * @param {number} fileSize - File size in bytes
     * @returns {number} Estimated memory usage in MB
     */
    getMemoryUsageEstimate(fileSize) {
        // Conservative estimate: file size * 2.5 for all processing overhead
        return (fileSize * 2.5) / (1024 * 1024);
    }

    /**
     * Checks if the decrypted data is a multi-file archive
     * @param {ArrayBuffer} fileData - Decrypted file data
     * @param {Object} metadata - File metadata
     * @returns {boolean} True if this is a multi-file archive
     */
    isMultiFileArchive(fileData, metadata) {
        try {
            // Check if filename suggests it's an archive
            if (metadata.filename && metadata.filename.endsWith('.farc')) {
                return true;
            }
            
            // Check if mime type indicates archive
            if (metadata.mimeType === 'application/x-file-archive') {
                return true;
            }
            
            // Try to validate the archive format by checking the content
            if (typeof window !== 'undefined' && window.FileArchiver) {
                const fileArchiver = new window.FileArchiver();
                return fileArchiver.isValidArchive(fileData);
            }
            
            // Fallback: check if the data looks like an archive by examining the content
            const dataString = new TextDecoder().decode(fileData.slice(0, 1000)); // Check first 1KB
            return dataString.includes('---FILE-SEPARATOR---') && dataString.includes('"fileCount"');
            
        } catch (error) {
            // If any error occurs during detection, assume it's not an archive
            return false;
        }
    }
}

// Export the implementation
if (typeof window !== 'undefined') {
    window.FileProcessorImpl = FileProcessorImpl;
}

export { FileProcessorImpl };