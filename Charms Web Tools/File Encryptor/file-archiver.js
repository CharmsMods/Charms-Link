/**
 * FileArchiver - Creates and extracts file archives for multi-file encryption
 * Implements a simple archive format with file metadata and content
 */

class FileArchiver {
    constructor() {
        this.ARCHIVE_MAGIC = new Uint8Array([0x46, 0x41, 0x52, 0x43]); // "FARC"
        this.VERSION = 1;
        this.SEPARATOR = '\n---FILE-SEPARATOR---\n';
    }

    /**
     * Creates an archive from multiple files
     * @param {File[]} files - Array of files to archive
     * @returns {Promise<{data: ArrayBuffer, metadata: Object}>} Archive data and metadata
     */
    async createArchive(files) {
        if (!files || files.length === 0) {
            throw new Error('No files provided for archiving');
        }

        const manifest = {
            version: this.VERSION,
            fileCount: files.length,
            files: [],
            createdAt: Date.now()
        };

        let archiveContent = '';
        let totalSize = 0;

        // Pre-calculate total size and validate
        for (const file of files) {
            totalSize += file.size;
        }
        
        // Estimate final archive size (Base64 expansion + metadata overhead)
        const estimatedArchiveSize = totalSize * 1.4; // 40% overhead for Base64 + metadata
        const maxSafeSize = 200 * 1024 * 1024; // 200MB limit for archives
        
        if (estimatedArchiveSize > maxSafeSize) {
            throw new Error(`Combined file size too large for multi-file encryption. Total size: ${Math.round(totalSize / (1024 * 1024))}MB. Please reduce the number of files or use smaller files.`);
        }

        // Reset totalSize for actual processing
        totalSize = 0;

        // Process each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileData = await this.readFileAsBase64(file);
            
            const fileInfo = {
                index: i,
                name: file.name,
                size: file.size,
                type: file.type || 'application/octet-stream',
                lastModified: file.lastModified || Date.now(),
                dataOffset: archiveContent.length
            };

            manifest.files.push(fileInfo);
            totalSize += file.size;

            // Add file header and data
            const fileHeader = JSON.stringify(fileInfo);
            archiveContent += `${fileHeader}\n${fileData}${this.SEPARATOR}`;
        }

        // Create final archive structure
        const manifestString = JSON.stringify(manifest);
        const archiveString = `${manifestString}\n${this.SEPARATOR}${archiveContent}`;
        
        // Convert to ArrayBuffer
        const archiveBuffer = new TextEncoder().encode(archiveString);

        return {
            data: archiveBuffer.buffer,
            metadata: {
                filename: `archive_${files.length}_files.farc`,
                mimeType: 'application/x-file-archive',
                timestamp: Date.now(),
                originalFileCount: files.length,
                totalSize: totalSize,
                fileNames: files.map(f => f.name)
            }
        };
    }

    /**
     * Extracts files from an archive
     * @param {ArrayBuffer} archiveData - Archive data to extract
     * @returns {Promise<Array>} Array of extracted file objects
     */
    async extractArchive(archiveData) {
        try {
            const archiveString = new TextDecoder().decode(archiveData);
            const parts = archiveString.split(this.SEPARATOR);
            
            if (parts.length < 2) {
                throw new Error('Invalid archive format');
            }

            // Parse manifest
            const manifest = JSON.parse(parts[0]);
            
            if (manifest.version !== this.VERSION) {
                throw new Error(`Unsupported archive version: ${manifest.version}`);
            }

            const extractedFiles = [];
            let currentPartIndex = 1;

            // Extract each file
            for (let i = 0; i < manifest.fileCount; i++) {
                if (currentPartIndex >= parts.length) {
                    throw new Error(`Missing file data for file ${i}`);
                }

                const fileHeaderAndData = parts[currentPartIndex];
                const lines = fileHeaderAndData.split('\n');
                
                if (lines.length < 2) {
                    throw new Error(`Invalid file format for file ${i}`);
                }

                const fileInfo = JSON.parse(lines[0]);
                const base64Data = lines.slice(1).join('\n');

                // Convert base64 back to binary
                const binaryData = this.base64ToArrayBuffer(base64Data);

                extractedFiles.push({
                    name: fileInfo.name,
                    size: fileInfo.size,
                    type: fileInfo.type,
                    lastModified: fileInfo.lastModified,
                    data: binaryData,
                    originalIndex: fileInfo.index
                });

                currentPartIndex++;
            }

            return extractedFiles;

        } catch (error) {
            throw new Error(`Failed to extract archive: ${error.message}`);
        }
    }

    /**
     * Reads a file as Base64 string
     * @param {File} file - File to read
     * @returns {Promise<string>} Base64 encoded file data
     */
    async readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Remove the data URL prefix (e.g., "data:image/png;base64,")
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Converts Base64 string to ArrayBuffer
     * @param {string} base64 - Base64 string to convert
     * @returns {ArrayBuffer} Converted binary data
     */
    base64ToArrayBuffer(base64) {
        try {
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return bytes.buffer;
        } catch (error) {
            throw new Error('Invalid Base64 format');
        }
    }

    /**
     * Validates if data is a valid archive
     * @param {ArrayBuffer} data - Data to validate
     * @returns {boolean} True if valid archive format
     */
    isValidArchive(data) {
        try {
            const archiveString = new TextDecoder().decode(data);
            const parts = archiveString.split(this.SEPARATOR);
            
            if (parts.length < 2) return false;
            
            const manifest = JSON.parse(parts[0]);
            return manifest.version === this.VERSION && 
                   typeof manifest.fileCount === 'number' && 
                   Array.isArray(manifest.files);
        } catch (error) {
            return false;
        }
    }

    /**
     * Gets archive information without extracting
     * @param {ArrayBuffer} archiveData - Archive data
     * @returns {Object} Archive information
     */
    getArchiveInfo(archiveData) {
        try {
            const archiveString = new TextDecoder().decode(archiveData);
            const parts = archiveString.split(this.SEPARATOR);
            
            if (parts.length < 2) {
                throw new Error('Invalid archive format');
            }

            const manifest = JSON.parse(parts[0]);
            
            return {
                version: manifest.version,
                fileCount: manifest.fileCount,
                createdAt: manifest.createdAt,
                files: manifest.files.map(f => ({
                    name: f.name,
                    size: f.size,
                    type: f.type,
                    lastModified: f.lastModified
                })),
                totalSize: manifest.files.reduce((sum, f) => sum + f.size, 0)
            };
        } catch (error) {
            throw new Error(`Failed to read archive info: ${error.message}`);
        }
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.FileArchiver = FileArchiver;
}