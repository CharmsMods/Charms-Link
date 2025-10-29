/**
 * ImageConverter Implementation
 * Converts between Base64 strings and PNG images using Canvas API
 */

// Import the base class if available, otherwise define a minimal interface
let ImageConverter;
if (typeof window !== 'undefined' && window.ImageConverter) {
    ImageConverter = window.ImageConverter;
} else {
    // Define minimal base class for testing
    ImageConverter = class {
        async encodeToImage(base64Data) { throw new Error('Not implemented'); }
        async decodeFromImage(imageFile) { throw new Error('Not implemented'); }
        calculateImageDimensions(dataLength) { throw new Error('Not implemented'); }
    };
}

class ImageConverterImpl extends ImageConverter {
    /**
     * Converts Base64 string to PNG image
     * @param {string} base64Data - Base64 encoded data
     * @returns {Promise<Blob>} PNG image blob
     */
    async encodeToImage(base64Data) {
        if (base64Data === null || base64Data === undefined || typeof base64Data !== 'string') {
            throw new Error('Invalid Base64 data provided');
        }

        // Calculate image dimensions with memory safety checks
        const dimensions = this.calculateImageDimensions(base64Data.length);
        
        // Create canvas element
        const canvas = document.createElement('canvas');
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
        const ctx = canvas.getContext('2d');
        
        // Create ImageData for pixel manipulation
        const imageData = ctx.createImageData(dimensions.width, dimensions.height);
        const pixels = imageData.data;
        
        // Convert Base64 to RGB pixels (3 chars = 1 pixel)
        let pixelIndex = 0;
        for (let i = 0; i < base64Data.length; i += CONSTANTS.BASE64_CHARS_PER_PIXEL) {
            const chunk = base64Data.slice(i, i + CONSTANTS.BASE64_CHARS_PER_PIXEL);
            
            // Get RGB values from Base64 characters (with padding for incomplete chunks)
            const r = chunk.length > 0 ? chunk.charCodeAt(0) : 0;
            const g = chunk.length > 1 ? chunk.charCodeAt(1) : 0;
            const b = chunk.length > 2 ? chunk.charCodeAt(2) : 0;
            
            // Set pixel data (RGBA format)
            const dataIndex = pixelIndex * 4;
            pixels[dataIndex] = r;     // Red
            pixels[dataIndex + 1] = g; // Green
            pixels[dataIndex + 2] = b; // Blue
            pixels[dataIndex + 3] = 255; // Alpha (fully opaque)
            
            pixelIndex++;
        }
        
        // Fill remaining pixels with black if needed
        while (pixelIndex < dimensions.width * dimensions.height) {
            const dataIndex = pixelIndex * 4;
            pixels[dataIndex] = 0;     // Red
            pixels[dataIndex + 1] = 0; // Green
            pixels[dataIndex + 2] = 0; // Blue
            pixels[dataIndex + 3] = 255; // Alpha
            pixelIndex++;
        }
        
        // Put image data on canvas
        ctx.putImageData(imageData, 0, 0);
        
        // Convert canvas to PNG blob
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to create PNG blob from canvas'));
                }
            }, 'image/png');
        });
    }

    /**
     * Extracts Base64 data from PNG image
     * @param {File} imageFile - PNG image file
     * @returns {Promise<string>} Extracted Base64 data
     */
    async decodeFromImage(imageFile) {
        if (!imageFile || !(imageFile instanceof File)) {
            throw new Error('Invalid image file provided');
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            img.onload = () => {
                try {
                    // Set canvas dimensions to match image
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    // Draw image on canvas
                    ctx.drawImage(img, 0, 0);
                    
                    // Get pixel data
                    const imageData = ctx.getImageData(0, 0, img.width, img.height);
                    const pixels = imageData.data;
                    
                    // Extract Base64 data from RGB pixels
                    let base64Data = '';
                    for (let i = 0; i < pixels.length; i += 4) {
                        const r = pixels[i];     // Red
                        const g = pixels[i + 1]; // Green
                        const b = pixels[i + 2]; // Blue
                        
                        // Convert RGB values back to characters
                        // Stop if we hit padding (null characters)
                        if (r === 0 && g === 0 && b === 0) {
                            break;
                        }
                        
                        base64Data += String.fromCharCode(r);
                        if (g !== 0) base64Data += String.fromCharCode(g);
                        if (b !== 0) base64Data += String.fromCharCode(b);
                    }
                    
                    resolve(base64Data);
                } catch (error) {
                    reject(new Error(`Failed to decode image: ${error.message}`));
                }
            };
            
            img.onerror = () => {
                reject(new Error('Failed to load image file'));
            };
            
            // Create object URL for the image file
            const objectUrl = URL.createObjectURL(imageFile);
            img.src = objectUrl;
            
            // Clean up object URL after image loads
            img.onload = (originalOnLoad => {
                return function() {
                    URL.revokeObjectURL(objectUrl);
                    originalOnLoad.call(this);
                };
            })(img.onload);
        });
    }

    /**
     * Calculates optimal image dimensions for data length with memory safety checks
     * @param {number} dataLength - Length of Base64 data
     * @returns {ImageDimensions} Calculated width and height
     */
    calculateImageDimensions(dataLength) {
        if (typeof dataLength !== 'number' || dataLength < 0) {
            throw new Error('Invalid data length provided');
        }

        if (dataLength === 0) {
            return { width: 1, height: 1 };
        }

        // Calculate number of pixels needed (3 Base64 chars = 1 pixel)
        const pixelCount = Math.ceil(dataLength / CONSTANTS.BASE64_CHARS_PER_PIXEL);
        
        // Try to create a square image first
        let width = Math.ceil(Math.sqrt(pixelCount));
        let height = Math.ceil(pixelCount / width);
        
        // If square dimensions are too large, use a more balanced approach
        if (width > CONSTANTS.FIXED_WIDTH || height > CONSTANTS.FIXED_WIDTH) {
            // Use a balanced approach: try to keep both dimensions reasonable
            const maxDimension = Math.min(CONSTANTS.FIXED_WIDTH * 2, CONSTANTS.MAX_SAFE_DIMENSION / 2);
            width = Math.min(maxDimension, Math.ceil(Math.sqrt(pixelCount * 1.5))); // Slightly wider than square
            height = Math.ceil(pixelCount / width);
            
            // If height is still too large, increase width further
            if (height > maxDimension) {
                width = Math.ceil(pixelCount / maxDimension);
                height = maxDimension;
            }
        }
        
        // Memory safety check: prevent images exceeding safe browser limits
        if (width > CONSTANTS.MAX_SAFE_DIMENSION || height > CONSTANTS.MAX_SAFE_DIMENSION) {
            throw new Error(`Image dimensions (${width}x${height}) exceed browser memory limits. File too large to process.`);
        }
        
        // Additional memory usage estimation
        const estimatedMemoryMB = (width * height * 4) / (1024 * 1024); // 4 bytes per pixel (RGBA)
        const MAX_SAFE_MEMORY_MB = 1536; // 1.5GB limit for image processing to handle 1GB files
        
        if (estimatedMemoryMB > MAX_SAFE_MEMORY_MB) {
            throw new Error(`Estimated memory usage (${Math.round(estimatedMemoryMB)}MB) exceeds safe limits. File too large to process.`);
        }
        
        return { width, height };
    }

    /**
     * Validates that the provided data can be safely converted to an image
     * @param {string} base64Data - Base64 data to validate
     * @returns {boolean} True if data can be safely processed
     */
    validateImageConversion(base64Data) {
        try {
            this.calculateImageDimensions(base64Data.length);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Gets estimated memory usage for image conversion
     * @param {number} dataLength - Length of Base64 data
     * @returns {number} Estimated memory usage in MB
     */
    getEstimatedMemoryUsage(dataLength) {
        try {
            const dimensions = this.calculateImageDimensions(dataLength);
            return (dimensions.width * dimensions.height * 4) / (1024 * 1024);
        } catch (error) {
            return Infinity;
        }
    }
}

// Export the implementation
if (typeof window !== 'undefined') {
    window.ImageConverterImpl = ImageConverterImpl;
}

export { ImageConverterImpl };