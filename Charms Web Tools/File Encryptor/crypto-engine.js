/**
 * CryptoEngine - Handles AES-GCM encryption and decryption operations
 * Uses Web Crypto API for secure cryptographic operations
 */
class CryptoEngine {
    constructor() {
        // Magic header for encrypted payloads: "ENCIMG"
        this.MAGIC_HEADER = new Uint8Array([0x45, 0x4E, 0x43, 0x49, 0x4D, 0x47]);
        this.VERSION = 1; // Current format version
        this.SALT_LENGTH = 16; // 16 bytes for PBKDF2 salt
        this.IV_LENGTH = 12; // 12 bytes for AES-GCM IV
        this.PBKDF2_ITERATIONS = 100000; // 100,000 iterations for key derivation
        this.METADATA_DELIMITER = '\n\n'; // Delimiter between metadata and file data
        
        // Initialize security manager (conditionally available)
        this.securityManager = this.initializeSecurityManager();
    }

    /**
     * Initialize SecurityManager if available
     * @returns {SecurityManager|null} SecurityManager instance or null
     */
    initializeSecurityManager() {
        try {
            // Try to get SecurityManager from global scope first
            if (typeof window !== 'undefined' && window.SecurityManager) {
                return new window.SecurityManager();
            }
            
            // Try to import SecurityManager dynamically
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
            generateSecureRandom: (length) => crypto.getRandomValues(new Uint8Array(length)),
            trackSensitiveData: () => {},
            secureWipe: (data) => {
                if (data instanceof Uint8Array) data.fill(0);
                else if (data instanceof ArrayBuffer) new Uint8Array(data).fill(0);
            },
            trackMemoryUsage: () => {},
            releaseMemoryUsage: () => {},
            createSecureError: (error, context) => error,
            performSecureCleanup: () => 0
        };
    }

    /**
     * Encrypts file data with password using AES-GCM
     * @param {ArrayBuffer} fileData - The file data to encrypt
     * @param {string} password - Password for encryption
     * @param {Object} metadata - File metadata (filename, mimeType, timestamp)
     * @returns {Promise<Uint8Array>} Encrypted payload with header, salt, IV, and encrypted data
     */
    async encrypt(fileData, password, metadata) {
        const operationId = `encrypt_${Date.now()}`;
        let salt, iv, key, dataWithMetadata, passwordBuffer;
        
        try {
            // Track memory usage for this operation
            const estimatedMemory = fileData.byteLength * 2.5; // Conservative estimate
            this.securityManager.trackMemoryUsage(operationId, estimatedMemory);

            // Generate cryptographically secure random salt and IV
            salt = this.securityManager.generateSecureRandom(this.SALT_LENGTH);
            iv = this.securityManager.generateSecureRandom(this.IV_LENGTH);

            // Convert password to buffer and track it
            passwordBuffer = new TextEncoder().encode(password);
            this.securityManager.trackSensitiveData(passwordBuffer);

            // Derive encryption key from password
            key = await this.deriveKey(password, salt, this.VERSION);

            // Encode metadata and prepend to file data
            dataWithMetadata = this.encodeMetadata(fileData, metadata);
            this.securityManager.trackSensitiveData(dataWithMetadata);

            // Encrypt the data with metadata
            const encryptedData = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                key,
                dataWithMetadata
            );

            // Create the complete encrypted payload
            const payload = this.createEncryptedPayload(salt, iv, new Uint8Array(encryptedData));

            // Secure cleanup of intermediate data
            this.securityManager.secureWipe(passwordBuffer);
            this.securityManager.secureWipe(dataWithMetadata);

            return payload;

        } catch (error) {
            // Secure cleanup on error
            if (passwordBuffer) this.securityManager.secureWipe(passwordBuffer);
            if (dataWithMetadata) this.securityManager.secureWipe(dataWithMetadata);
            
            // Create secure error without exposing sensitive information
            throw this.securityManager.createSecureError(error, 'encryption');
        } finally {
            // Always release memory tracking
            this.securityManager.releaseMemoryUsage(operationId);
        }
    }

    /**
     * Decrypts encrypted payload with password
     * @param {Uint8Array} encryptedPayload - The encrypted payload to decrypt
     * @param {string} password - Password for decryption
     * @returns {Promise<Object>} Object containing decrypted file data and metadata
     */
    async decrypt(encryptedPayload, password) {
        const operationId = `decrypt_${Date.now()}`;
        let passwordBuffer, decryptedData, key;
        
        try {
            // Track memory usage for this operation
            const estimatedMemory = encryptedPayload.length * 2; // Conservative estimate
            this.securityManager.trackMemoryUsage(operationId, estimatedMemory);

            // Parse the encrypted payload
            const parsed = this.parseEncryptedPayload(encryptedPayload);
            
            // Convert password to buffer and track it
            passwordBuffer = new TextEncoder().encode(password);
            this.securityManager.trackSensitiveData(passwordBuffer);
            
            // Derive decryption key
            key = await this.deriveKey(password, parsed.salt, parsed.version);

            // Decrypt the data
            decryptedData = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: parsed.iv
                },
                key,
                parsed.encryptedData
            );

            // Track decrypted data for cleanup
            const decryptedArray = new Uint8Array(decryptedData);
            this.securityManager.trackSensitiveData(decryptedArray);

            // Extract metadata and file data
            const result = this.decodeMetadata(decryptedArray);

            // Secure cleanup of intermediate data
            this.securityManager.secureWipe(passwordBuffer);
            this.securityManager.secureWipe(decryptedArray);

            return {
                fileData: result.fileData,
                metadata: result.metadata
            };

        } catch (error) {
            // Secure cleanup on error
            if (passwordBuffer) this.securityManager.secureWipe(passwordBuffer);
            if (decryptedData) {
                const decryptedArray = new Uint8Array(decryptedData);
                this.securityManager.secureWipe(decryptedArray);
            }
            
            // Create secure error without exposing sensitive information
            throw this.securityManager.createSecureError(error, 'decryption');
        } finally {
            // Always release memory tracking
            this.securityManager.releaseMemoryUsage(operationId);
        }
    }

    /**
     * Derives encryption key from password using PBKDF2
     * @param {string} password - Password to derive key from
     * @param {Uint8Array} salt - Random salt for key derivation
     * @param {number} version - Format version (affects iteration count)
     * @returns {Promise<CryptoKey>} Derived encryption key
     */
    async deriveKey(password, salt, version) {
        let passwordBuffer, keyMaterial;
        
        try {
            // Convert password to ArrayBuffer and track it
            passwordBuffer = new TextEncoder().encode(password);
            this.securityManager.trackSensitiveData(passwordBuffer);

            // Import password as key material
            keyMaterial = await crypto.subtle.importKey(
                'raw',
                passwordBuffer,
                'PBKDF2',
                false,
                ['deriveKey']
            );

            // Determine iteration count based on version
            let iterations = this.PBKDF2_ITERATIONS;
            if (version !== 1) {
                throw new Error(`Unsupported format version: ${version}`);
            }

            // Derive the actual encryption key
            const derivedKey = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: iterations,
                    hash: 'SHA-256'
                },
                keyMaterial,
                {
                    name: 'AES-GCM',
                    length: 256
                },
                false,
                ['encrypt', 'decrypt']
            );

            // Secure cleanup of password buffer
            this.securityManager.secureWipe(passwordBuffer);

            return derivedKey;

        } catch (error) {
            // Secure cleanup on error
            if (passwordBuffer) this.securityManager.secureWipe(passwordBuffer);
            
            throw this.securityManager.createSecureError(error, 'key derivation');
        }
    }

    /**
     * Encodes metadata and prepends it to file data
     * @param {ArrayBuffer} fileData - Original file data
     * @param {Object} metadata - File metadata
     * @returns {Uint8Array} Combined metadata and file data
     */
    encodeMetadata(fileData, metadata) {
        // Create metadata string: "filename|mimetype|timestamp"
        const metadataString = `${metadata.filename}|${metadata.mimeType}|${metadata.timestamp}`;
        
        // Convert to bytes
        const metadataBytes = new TextEncoder().encode(metadataString + this.METADATA_DELIMITER);
        const fileBytes = new Uint8Array(fileData);

        // Combine metadata and file data
        const combined = new Uint8Array(metadataBytes.length + fileBytes.length);
        combined.set(metadataBytes, 0);
        combined.set(fileBytes, metadataBytes.length);

        return combined;
    }

    /**
     * Decodes metadata from decrypted data
     * @param {Uint8Array} decryptedData - Decrypted data with metadata
     * @returns {Object} Object containing separated metadata and file data
     */
    decodeMetadata(decryptedData) {
        // Convert to string to find delimiter
        const dataString = new TextDecoder().decode(decryptedData);
        const delimiterIndex = dataString.indexOf(this.METADATA_DELIMITER);

        if (delimiterIndex === -1) {
            throw new Error('Invalid encrypted format: metadata delimiter not found');
        }

        // Extract metadata string
        const metadataString = dataString.substring(0, delimiterIndex);
        const metadataParts = metadataString.split('|');

        if (metadataParts.length !== 3) {
            throw new Error('Invalid metadata format');
        }

        // Parse metadata
        const metadata = {
            filename: metadataParts[0],
            mimeType: metadataParts[1],
            timestamp: parseInt(metadataParts[2], 10)
        };

        // Extract file data (skip metadata and delimiter)
        const metadataByteLength = new TextEncoder().encode(metadataString + this.METADATA_DELIMITER).length;
        const fileData = decryptedData.slice(metadataByteLength);

        return {
            metadata: metadata,
            fileData: fileData.buffer
        };
    }

    /**
     * Creates the complete encrypted payload with header, version, salt, IV, and encrypted data
     * @param {Uint8Array} salt - Random salt used for key derivation
     * @param {Uint8Array} iv - Random IV used for encryption
     * @param {Uint8Array} encryptedData - The encrypted data
     * @returns {Uint8Array} Complete encrypted payload
     */
    createEncryptedPayload(salt, iv, encryptedData) {
        // Calculate total payload size
        const totalSize = this.MAGIC_HEADER.length + 1 + salt.length + iv.length + encryptedData.length;
        const payload = new Uint8Array(totalSize);

        let offset = 0;

        // Add magic header
        payload.set(this.MAGIC_HEADER, offset);
        offset += this.MAGIC_HEADER.length;

        // Add version byte
        payload[offset] = this.VERSION;
        offset += 1;

        // Add salt
        payload.set(salt, offset);
        offset += salt.length;

        // Add IV
        payload.set(iv, offset);
        offset += iv.length;

        // Add encrypted data
        payload.set(encryptedData, offset);

        return payload;
    }

    /**
     * Parses encrypted payload and extracts components
     * @param {Uint8Array} encryptedPayload - The complete encrypted payload
     * @returns {Object} Object containing parsed components
     */
    parseEncryptedPayload(encryptedPayload) {
        // Verify minimum payload size
        const minSize = this.MAGIC_HEADER.length + 1 + this.SALT_LENGTH + this.IV_LENGTH;
        if (encryptedPayload.length < minSize) {
            throw new Error('Unrecognized format');
        }

        let offset = 0;

        // Verify magic header
        const header = encryptedPayload.slice(offset, offset + this.MAGIC_HEADER.length);
        if (!this.arraysEqual(header, this.MAGIC_HEADER)) {
            throw new Error('Unrecognized format');
        }
        offset += this.MAGIC_HEADER.length;

        // Extract version
        const version = encryptedPayload[offset];
        offset += 1;

        // Extract salt
        const salt = encryptedPayload.slice(offset, offset + this.SALT_LENGTH);
        offset += this.SALT_LENGTH;

        // Extract IV
        const iv = encryptedPayload.slice(offset, offset + this.IV_LENGTH);
        offset += this.IV_LENGTH;

        // Extract encrypted data
        const encryptedData = encryptedPayload.slice(offset);

        return {
            version: version,
            salt: salt,
            iv: iv,
            encryptedData: encryptedData
        };
    }

    /**
     * Compares two Uint8Arrays for equality
     * @param {Uint8Array} a - First array
     * @param {Uint8Array} b - Second array
     * @returns {boolean} True if arrays are equal
     */
    arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    /**
     * Validates if the payload has the correct magic header
     * @param {Uint8Array} payload - Payload to validate
     * @returns {boolean} True if payload has valid magic header
     */
    validateEncryptedPayload(payload) {
        if (payload.length < this.MAGIC_HEADER.length) {
            return false;
        }

        const header = payload.slice(0, this.MAGIC_HEADER.length);
        return this.arraysEqual(header, this.MAGIC_HEADER);
    }
}

// Export for use in other modules
export default CryptoEngine;