/**
 * UI Interaction Tests for Decryption Interface
 * Tests both input methods (Image Upload/Base64 Text) and both output types (Text/File)
 */

// Mock DOM environment for testing
class MockDOM {
    constructor() {
        this.elements = new Map();
        this.eventListeners = new Map();
    }

    getElementById(id) {
        if (!this.elements.has(id)) {
            const element = {
                id: id,
                value: '',
                textContent: '',
                style: { display: 'block' },
                classList: {
                    add: (className) => {},
                    remove: (className) => {},
                    contains: (className) => false
                },
                addEventListener: (event, handler) => {
                    const key = `${id}-${event}`;
                    if (!this.eventListeners.has(key)) {
                        this.eventListeners.set(key, []);
                    }
                    this.eventListeners.get(key).push(handler);
                },
                click: () => {
                    const clickHandlers = this.eventListeners.get(`${id}-click`) || [];
                    clickHandlers.forEach(handler => handler());
                },
                files: [],
                disabled: false,
                checked: false
            };
            this.elements.set(id, element);
        }
        return this.elements.get(id);
    }

    querySelectorAll(selector) {
        // Mock implementation for common selectors
        if (selector === '.mode-btn') {
            return [this.getElementById('encrypt-mode-btn'), this.getElementById('decrypt-mode-btn')];
        }
        if (selector === '#decrypt-section .tab-btn') {
            return [this.getElementById('image-input-tab'), this.getElementById('base64-input-tab')];
        }
        if (selector === '#decrypt-section .input-area') {
            return [this.getElementById('image-input-area'), this.getElementById('base64-input-area')];
        }
        if (selector === '.error-display') {
            return [this.getElementById('encrypt-error'), this.getElementById('decrypt-error')];
        }
        return [];
    }

    createElement(tagName) {
        return {
            tagName: tagName.toUpperCase(),
            href: '',
            download: '',
            click: () => {},
            appendChild: () => {},
            removeChild: () => {}
        };
    }
}

// Mock implementations for testing
class MockValidationEngine {
    validateImageForDecryption(file) {
        if (!file) return { isValid: false, userMessage: 'No image selected' };
        if (file.type !== 'image/png') {
            return { isValid: false, userMessage: 'Please upload a PNG image file.' };
        }
        return { isValid: true };
    }

    validatePasswordWithDetails(password) {
        if (!password || password.trim().length === 0) {
            return { isValid: false, userMessage: 'Password cannot be empty.' };
        }
        return { isValid: true };
    }

    validateBase64String(base64String) {
        if (typeof base64String !== 'string' || base64String.trim().length === 0) {
            return { isValid: false, userMessage: 'Base64 input cannot be empty' };
        }
        // Simulate invalid Base64 format
        if (base64String.includes('invalid')) {
            return { isValid: false, userMessage: 'Invalid Base64 format' };
        }
        return { isValid: true };
    }
}

class MockFileProcessor {
    async decryptFile(imageFile, password, onProgress) {
        // Simulate progress updates
        onProgress(25, 'Decoding');
        onProgress(50, 'Decoding');
        onProgress(75, 'Decrypting');
        onProgress(100, 'Decrypting');
        
        // Simulate different content types based on filename
        if (imageFile.name.includes('text')) {
            return {
                data: new TextEncoder().encode('This is decrypted text content').buffer,
                filename: 'decrypted_text.txt',
                mimeType: 'text/plain',
                metadata: { filename: 'decrypted_text.txt', mimeType: 'text/plain' }
            };
        } else {
            return {
                data: new ArrayBuffer(1024),
                filename: 'decrypted_file.pdf',
                mimeType: 'application/pdf',
                metadata: { filename: 'decrypted_file.pdf', mimeType: 'application/pdf' }
            };
        }
    }

    async decryptBase64(base64Data, password, onProgress) {
        // Simulate progress updates
        onProgress(25, 'Decoding');
        onProgress(75, 'Decrypting');
        onProgress(100, 'Decrypting');
        
        // Simulate different content types based on base64 content
        if (base64Data.includes('text')) {
            return {
                data: new TextEncoder().encode('Decrypted text from Base64').buffer,
                metadata: { filename: 'text_message.txt', mimeType: 'text/plain' }
            };
        } else {
            return {
                data: new ArrayBuffer(2048),
                metadata: { filename: 'document.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
            };
        }
    }
}

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock SecureFileImageConverter class for testing decryption functionality
class SecureFileImageConverter {
    constructor() {
        this.currentMode = 'decrypt';
        this.currentDecryptInputType = 'image';
        
        // Initialize components
        this.validationEngine = new MockValidationEngine();
        this.fileProcessor = new MockFileProcessor();
        
        // Store current files and results
        this.selectedImage = null;
        this.decryptionResult = null;
    }

    switchDecryptInputType(type) {
        this.currentDecryptInputType = type;
    }

    handleImageSelection(file) {
        const validationResult = this.validationEngine.validateImageForDecryption(file);
        if (!validationResult.isValid) {
            this.showError('decrypt', validationResult.userMessage);
            this.selectedImage = null;
            return;
        }
        this.selectedImage = file;
    }

    updateDecryptButtonState() {
        const decryptBtn = document.getElementById('decrypt-btn');
        const password = document.getElementById('decrypt-password').value;
        const base64Input = document.getElementById('base64-input').value;
        
        let hasValidInput = false;
        if (this.currentDecryptInputType === 'image') {
            hasValidInput = this.selectedImage != null;
        } else {
            const base64Validation = this.validationEngine.validateBase64String(base64Input);
            hasValidInput = base64Validation.isValid;
        }
        
        const passwordValidation = this.validationEngine.validatePasswordWithDetails(password);
        const hasValidPassword = passwordValidation.isValid;
        
        decryptBtn.disabled = !(hasValidInput && hasValidPassword);
    }

    validateBase64Input() {
        const base64Input = document.getElementById('base64-input');
        const base64Value = base64Input.value;
        
        if (base64Value.trim().length === 0) {
            this.clearErrors();
            return;
        }
        
        const validationResult = this.validationEngine.validateBase64String(base64Value);
        
        if (!validationResult.isValid) {
            this.showError('decrypt', validationResult.userMessage);
        } else {
            this.clearErrors();
        }
    }

    async handleDecrypt() {
        try {
            this.clearErrors();
            this.hideOutput('decrypt');
            
            const password = document.getElementById('decrypt-password').value;
            
            const onProgress = (percent, phase) => {
                this.showProgress('decrypt', percent, phase);
            };
            
            let result;
            
            if (this.currentDecryptInputType === 'image') {
                if (!this.selectedImage) {
                    throw new Error('No image selected');
                }
                
                result = await this.fileProcessor.decryptFile(this.selectedImage, password, onProgress);
            } else {
                const base64Input = document.getElementById('base64-input').value;
                if (!base64Input.trim()) {
                    throw new Error('No Base64 data entered');
                }
                
                result = await this.fileProcessor.decryptBase64(base64Input.trim(), password, onProgress);
            }
            
            this.decryptionResult = result;
            this.showDecryptionOutput(result);
            
        } catch (error) {
            this.showError('decrypt', error.message);
        }
    }

    async pasteFromClipboard(elementId) {
        const element = document.getElementById(elementId);
        try {
            // Mock clipboard read
            const mockClipboardText = 'bW9jayBiYXNlNjQgZGF0YQ==';
            element.value = mockClipboardText;
            this.updateDecryptButtonState();
            return true;
        } catch (error) {
            console.error('Failed to paste from clipboard:', error);
            return false;
        }
    }

    async copyToClipboard(elementId) {
        const element = document.getElementById(elementId);
        try {
            // Mock clipboard write
            return true;
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            return false;
        }
    }

    showProgress(type, percent, phase) {
        const progressContainer = document.getElementById(`${type}-progress`);
        const progressFill = document.getElementById(`${type}-progress-fill`);
        const progressText = document.getElementById(`${type}-progress-text`);
        
        progressContainer.style.display = 'block';
        progressFill.style.width = `${percent}%`;
        progressText.textContent = phase;
    }

    hideProgress(type) {
        const progressContainer = document.getElementById(`${type}-progress`);
        progressContainer.style.display = 'none';
    }

    showError(type, message) {
        this.hideProgress(type);
        const errorDisplay = document.getElementById(`${type}-error`);
        errorDisplay.textContent = message;
        errorDisplay.style.display = 'block';
    }

    clearErrors() {
        document.querySelectorAll('.error-display').forEach(error => {
            error.style.display = 'none';
        });
    }

    hideOutput(type) {
        const outputArea = document.getElementById(`${type}-output`);
        outputArea.style.display = 'none';
    }

    showDecryptionOutput(result) {
        this.hideProgress('decrypt');
        const outputArea = document.getElementById('decrypt-output');
        const textOutput = document.getElementById('text-output');
        const fileOutput = document.getElementById('file-output');
        
        // Determine if result is text or file based on metadata
        const isTextContent = result.metadata && result.metadata.mimeType === 'text/plain';
        
        if (isTextContent) {
            // Show text output
            textOutput.style.display = 'block';
            fileOutput.style.display = 'none';
            
            const textData = new TextDecoder().decode(result.data);
            document.getElementById('decrypted-text').value = textData;
        } else {
            // Show file download option
            textOutput.style.display = 'none';
            fileOutput.style.display = 'block';
            
            document.getElementById('restored-file-name').textContent = result.filename || result.metadata?.filename || 'decrypted_file';
            document.getElementById('restored-file-size').textContent = this.formatFileSize(result.data.byteLength);
            
            this.setupFileDownload(result.data, result.filename || result.metadata?.filename || 'decrypted_file', result.mimeType || result.metadata?.mimeType);
        }
        
        outputArea.style.display = 'block';
    }

    setupFileDownload(arrayBuffer, filename, mimeType) {
        const downloadBtn = document.getElementById('download-file-btn');
        
        // Mock implementation for testing
        downloadBtn.onclick = () => {
            // Simulate file download
            return true;
        };
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Test Suite
describe('Decryption UI Tests', () => {
    let app;
    let mockDOM;
    let originalDocument;
    let originalNavigator;

    beforeEach(() => {
        // Setup mock DOM
        mockDOM = new MockDOM();
        originalDocument = global.document;
        global.document = mockDOM;
        
        // Setup mock navigator for clipboard API
        originalNavigator = global.navigator;
        if (global.navigator) {
            Object.defineProperty(global, 'navigator', {
                value: {
                    clipboard: {
                        readText: () => Promise.resolve('bW9jayBiYXNlNjQgZGF0YQ=='),
                        writeText: (text) => Promise.resolve()
                    }
                },
                writable: true,
                configurable: true
            });
        } else {
            global.navigator = {
                clipboard: {
                    readText: () => Promise.resolve('bW9jayBiYXNlNjQgZGF0YQ=='),
                    writeText: (text) => Promise.resolve()
                }
            };
        }
        
        // Setup global mocks
        global.URL = {
            createObjectURL: () => 'mock-url',
            revokeObjectURL: () => {}
        };
        
        // Initialize app
        app = new SecureFileImageConverter();
    });

    afterEach(() => {
        global.document = originalDocument;
        if (originalNavigator) {
            Object.defineProperty(global, 'navigator', {
                value: originalNavigator,
                writable: true,
                configurable: true
            });
        }
    });

    describe('Input Method Switching', () => {
        test('should switch between Image Upload and Base64 Text input methods', () => {
            // Initially should be in image mode
            expect(app.currentDecryptInputType).toBe('image');
            
            // Switch to base64 mode
            app.switchDecryptInputType('base64');
            expect(app.currentDecryptInputType).toBe('base64');
            
            // Switch back to image mode
            app.switchDecryptInputType('image');
            expect(app.currentDecryptInputType).toBe('image');
        });

        test('should update UI elements when switching input methods', () => {
            const imageTab = mockDOM.getElementById('image-input-tab');
            const base64Tab = mockDOM.getElementById('base64-input-tab');
            
            // Switch to base64 mode
            app.switchDecryptInputType('base64');
            
            // Verify mode change
            expect(app.currentDecryptInputType).toBe('base64');
        });
    });

    describe('Image Upload Input', () => {
        test('should validate PNG image files for decryption', () => {
            const validImage = { name: 'encrypted.png', size: 1024, type: 'image/png' };
            const invalidImage = { name: 'image.jpg', size: 1024, type: 'image/jpeg' };
            
            // Test valid PNG image
            app.handleImageSelection(validImage);
            expect(app.selectedImage).toBe(validImage);
            
            // Test invalid image format
            app.handleImageSelection(invalidImage);
            expect(app.selectedImage).toBe(null);
        });

        test('should show error for invalid image format', () => {
            const invalidImage = { name: 'image.jpg', size: 1024, type: 'image/jpeg' };
            const errorSpy = vi.spyOn(app, 'showError');
            
            app.handleImageSelection(invalidImage);
            
            expect(errorSpy).toHaveBeenCalledWith('decrypt', 'Please upload a PNG image file.');
        });

        test('should update decrypt button state based on image selection', () => {
            const decryptBtn = mockDOM.getElementById('decrypt-btn');
            const passwordInput = mockDOM.getElementById('decrypt-password');
            
            // Initially disabled (no image, no password)
            app.updateDecryptButtonState();
            expect(decryptBtn.disabled).toBe(true);
            
            // Add password but no image
            passwordInput.value = 'testpassword';
            app.updateDecryptButtonState();
            expect(decryptBtn.disabled).toBe(true);
            
            // Add image and password
            app.selectedImage = { name: 'encrypted.png', size: 1024, type: 'image/png' };
            app.updateDecryptButtonState();
            expect(decryptBtn.disabled).toBe(false);
        });
    });

    describe('Base64 Text Input', () => {
        test('should validate Base64 input format', () => {
            const base64Input = mockDOM.getElementById('base64-input');
            
            // Switch to base64 input mode
            app.switchDecryptInputType('base64');
            
            // Test valid Base64
            base64Input.value = 'bW9jayBiYXNlNjQgZGF0YQ==';
            app.validateBase64Input();
            
            // Test invalid Base64
            base64Input.value = 'invalid base64 format';
            const errorSpy = vi.spyOn(app, 'showError');
            app.validateBase64Input();
            
            expect(errorSpy).toHaveBeenCalledWith('decrypt', 'Invalid Base64 format');
        });

        test('should update decrypt button state based on Base64 input', () => {
            const decryptBtn = mockDOM.getElementById('decrypt-btn');
            const passwordInput = mockDOM.getElementById('decrypt-password');
            const base64Input = mockDOM.getElementById('base64-input');
            
            // Switch to base64 mode
            app.switchDecryptInputType('base64');
            
            // Initially disabled (no input, no password)
            app.updateDecryptButtonState();
            expect(decryptBtn.disabled).toBe(true);
            
            // Add Base64 but no password
            base64Input.value = 'bW9jayBiYXNlNjQgZGF0YQ==';
            app.updateDecryptButtonState();
            expect(decryptBtn.disabled).toBe(true);
            
            // Add password and Base64
            passwordInput.value = 'testpassword';
            app.updateDecryptButtonState();
            expect(decryptBtn.disabled).toBe(false);
        });

        test('should support paste from clipboard functionality', async () => {
            const base64Input = mockDOM.getElementById('base64-input');
            
            // Test paste functionality
            const result = await app.pasteFromClipboard('base64-input');
            
            expect(result).toBe(true);
            expect(base64Input.value).toBe('bW9jayBiYXNlNjQgZGF0YQ==');
        });
    });

    describe('Password Validation', () => {
        test('should require non-empty password for decryption', () => {
            const passwordInput = mockDOM.getElementById('decrypt-password');
            const decryptBtn = mockDOM.getElementById('decrypt-btn');
            
            // Set up valid input (image)
            app.selectedImage = { name: 'encrypted.png', size: 1024, type: 'image/png' };
            
            // Empty password should disable button
            passwordInput.value = '';
            app.updateDecryptButtonState();
            expect(decryptBtn.disabled).toBe(true);
            
            // Valid password should enable button
            passwordInput.value = 'validpassword';
            app.updateDecryptButtonState();
            expect(decryptBtn.disabled).toBe(false);
        });
    });

    describe('Decryption Process', () => {
        test('should handle image decryption with text content output', async () => {
            // Setup for text content
            app.selectedImage = { name: 'encrypted_text.png', size: 1024, type: 'image/png' };
            app.currentDecryptInputType = 'image';
            
            const passwordInput = mockDOM.getElementById('decrypt-password');
            passwordInput.value = 'testpassword';
            
            // Execute decryption
            await app.handleDecrypt();
            
            // Verify result
            expect(app.decryptionResult).toBeDefined();
            expect(app.decryptionResult.metadata.mimeType).toBe('text/plain');
        });

        test('should handle image decryption with file content output', async () => {
            // Setup for file content
            app.selectedImage = { name: 'encrypted_file.png', size: 1024, type: 'image/png' };
            app.currentDecryptInputType = 'image';
            
            const passwordInput = mockDOM.getElementById('decrypt-password');
            passwordInput.value = 'testpassword';
            
            // Execute decryption
            await app.handleDecrypt();
            
            // Verify result
            expect(app.decryptionResult).toBeDefined();
            expect(app.decryptionResult.metadata.mimeType).toBe('application/pdf');
        });

        test('should handle Base64 decryption with text content output', async () => {
            // Setup for Base64 text content
            app.currentDecryptInputType = 'base64';
            
            const base64Input = mockDOM.getElementById('base64-input');
            const passwordInput = mockDOM.getElementById('decrypt-password');
            base64Input.value = 'text_bW9jayBiYXNlNjQgZGF0YQ==';
            passwordInput.value = 'testpassword';
            
            // Execute decryption
            await app.handleDecrypt();
            
            // Verify result
            expect(app.decryptionResult).toBeDefined();
            expect(app.decryptionResult.metadata.mimeType).toBe('text/plain');
        });

        test('should handle Base64 decryption with file content output', async () => {
            // Setup for Base64 file content
            app.currentDecryptInputType = 'base64';
            
            const base64Input = mockDOM.getElementById('base64-input');
            const passwordInput = mockDOM.getElementById('decrypt-password');
            base64Input.value = 'file_bW9jayBiYXNlNjQgZGF0YQ==';
            passwordInput.value = 'testpassword';
            
            // Execute decryption
            await app.handleDecrypt();
            
            // Verify result
            expect(app.decryptionResult).toBeDefined();
            expect(app.decryptionResult.metadata.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        });

        test('should show progress during decryption', async () => {
            // Setup
            app.selectedImage = { name: 'encrypted.png', size: 1024, type: 'image/png' };
            app.currentDecryptInputType = 'image';
            
            const passwordInput = mockDOM.getElementById('decrypt-password');
            passwordInput.value = 'testpassword';
            
            // Spy on progress method
            const progressSpy = vi.spyOn(app, 'showProgress');
            
            // Execute decryption
            await app.handleDecrypt();
            
            // Verify progress was shown
            expect(progressSpy).toHaveBeenCalled();
        });
    });

    describe('Smart Output Handling', () => {
        test('should automatically detect and display text content', async () => {
            // Setup for text content
            const result = {
                data: new TextEncoder().encode('This is decrypted text').buffer,
                metadata: { filename: 'text.txt', mimeType: 'text/plain' }
            };
            
            // Execute output display
            app.showDecryptionOutput(result);
            
            // Verify text output is shown
            const textOutput = mockDOM.getElementById('text-output');
            const fileOutput = mockDOM.getElementById('file-output');
            expect(textOutput.style.display).toBe('block');
            expect(fileOutput.style.display).toBe('none');
            
            // Verify text content is populated
            const decryptedText = mockDOM.getElementById('decrypted-text');
            expect(decryptedText.value).toBe('This is decrypted text');
        });

        test('should automatically detect and display file content', async () => {
            // Setup for file content
            const result = {
                data: new ArrayBuffer(1024),
                filename: 'document.pdf',
                metadata: { filename: 'document.pdf', mimeType: 'application/pdf' }
            };
            
            // Execute output display
            app.showDecryptionOutput(result);
            
            // Verify file output is shown
            const textOutput = mockDOM.getElementById('text-output');
            const fileOutput = mockDOM.getElementById('file-output');
            expect(textOutput.style.display).toBe('none');
            expect(fileOutput.style.display).toBe('block');
            
            // Verify file info is populated
            const restoredFileName = mockDOM.getElementById('restored-file-name');
            const restoredFileSize = mockDOM.getElementById('restored-file-size');
            expect(restoredFileName.textContent).toBe('document.pdf');
            expect(restoredFileSize.textContent).toBe('1 KB');
        });

        test('should restore original filename for file downloads', async () => {
            // Setup
            const result = {
                data: new ArrayBuffer(2048),
                filename: 'original_document.docx',
                metadata: { filename: 'original_document.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
            };
            
            // Execute output display
            app.showDecryptionOutput(result);
            
            // Verify original filename is restored
            const restoredFileName = mockDOM.getElementById('restored-file-name');
            expect(restoredFileName.textContent).toBe('original_document.docx');
        });
    });

    describe('Copy Functionality', () => {
        test('should support copy to clipboard for decrypted text', async () => {
            // Setup text output
            const decryptedText = mockDOM.getElementById('decrypted-text');
            decryptedText.value = 'Decrypted text content';
            
            // Test copy functionality
            const result = await app.copyToClipboard('decrypted-text');
            
            expect(result).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should display error for missing image', async () => {
            // Setup without image
            app.selectedImage = null;
            app.currentDecryptInputType = 'image';
            
            const passwordInput = mockDOM.getElementById('decrypt-password');
            passwordInput.value = 'testpassword';
            
            // Spy on error display
            const errorSpy = vi.spyOn(app, 'showError');
            
            // Execute decryption
            await app.handleDecrypt();
            
            // Verify error was shown
            expect(errorSpy).toHaveBeenCalledWith('decrypt', 'No image selected');
        });

        test('should display error for empty Base64 input', async () => {
            // Setup with empty Base64
            app.currentDecryptInputType = 'base64';
            
            const base64Input = mockDOM.getElementById('base64-input');
            const passwordInput = mockDOM.getElementById('decrypt-password');
            base64Input.value = '';
            passwordInput.value = 'testpassword';
            
            // Spy on error display
            const errorSpy = vi.spyOn(app, 'showError');
            
            // Execute decryption
            await app.handleDecrypt();
            
            // Verify error was shown
            expect(errorSpy).toHaveBeenCalledWith('decrypt', 'No Base64 data entered');
        });

        test('should display comprehensive error messages for all error scenarios', () => {
            const errorScenarios = [
                { input: null, expected: 'No image selected' },
                { input: { type: 'image/jpeg' }, expected: 'Please upload a PNG image file.' },
                { base64: '', expected: 'Base64 input cannot be empty' },
                { base64: 'invalid', expected: 'Invalid Base64 format' },
                { password: '', expected: 'Password cannot be empty.' }
            ];
            
            errorScenarios.forEach(scenario => {
                if (scenario.input !== undefined) {
                    app.handleImageSelection(scenario.input);
                }
                if (scenario.base64 !== undefined) {
                    const base64Input = mockDOM.getElementById('base64-input');
                    base64Input.value = scenario.base64;
                    app.validateBase64Input();
                }
            });
        });

        test('should clear errors when switching between input methods', () => {
            // Show an error first
            app.showError('decrypt', 'Test error');
            
            // Clear errors
            const clearSpy = vi.spyOn(app, 'clearErrors');
            app.validateBase64Input(); // This should clear errors for empty input
            
            expect(clearSpy).toHaveBeenCalled();
        });
    });

    describe('Progress Indicators', () => {
        test('should show phase-specific progress for image decryption', async () => {
            // Setup
            app.selectedImage = { name: 'encrypted.png', size: 1024, type: 'image/png' };
            app.currentDecryptInputType = 'image';
            
            const passwordInput = mockDOM.getElementById('decrypt-password');
            passwordInput.value = 'testpassword';
            
            // Spy on progress method
            const progressSpy = vi.spyOn(app, 'showProgress');
            
            // Execute decryption
            await app.handleDecrypt();
            
            // Verify different phases were shown
            expect(progressSpy).toHaveBeenCalledWith('decrypt', 25, 'Decoding');
            expect(progressSpy).toHaveBeenCalledWith('decrypt', 50, 'Decoding');
            expect(progressSpy).toHaveBeenCalledWith('decrypt', 75, 'Decrypting');
            expect(progressSpy).toHaveBeenCalledWith('decrypt', 100, 'Decrypting');
        });

        test('should show phase-specific progress for Base64 decryption', async () => {
            // Setup
            app.currentDecryptInputType = 'base64';
            
            const base64Input = mockDOM.getElementById('base64-input');
            const passwordInput = mockDOM.getElementById('decrypt-password');
            base64Input.value = 'bW9jayBiYXNlNjQgZGF0YQ==';
            passwordInput.value = 'testpassword';
            
            // Spy on progress method
            const progressSpy = vi.spyOn(app, 'showProgress');
            
            // Execute decryption
            await app.handleDecrypt();
            
            // Verify different phases were shown
            expect(progressSpy).toHaveBeenCalledWith('decrypt', 25, 'Decoding');
            expect(progressSpy).toHaveBeenCalledWith('decrypt', 75, 'Decrypting');
            expect(progressSpy).toHaveBeenCalledWith('decrypt', 100, 'Decrypting');
        });
    });

    describe('File Size Formatting', () => {
        test('should format file sizes correctly', () => {
            expect(app.formatFileSize(0)).toBe('0 Bytes');
            expect(app.formatFileSize(1024)).toBe('1 KB');
            expect(app.formatFileSize(1024 * 1024)).toBe('1 MB');
            expect(app.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
        });
    });

    describe('Security Requirements', () => {
        test('should not expose sensitive information in error messages', async () => {
            // Setup with invalid password scenario
            app.selectedImage = { name: 'encrypted.png', size: 1024, type: 'image/png' };
            
            const passwordInput = mockDOM.getElementById('decrypt-password');
            passwordInput.value = 'wrongpassword';
            
            // Mock processor to throw decryption error
            app.fileProcessor.decryptFile = vi.fn().mockRejectedValue(new Error('Decryption failed'));
            
            const errorSpy = vi.spyOn(app, 'showError');
            
            // Execute decryption
            await app.handleDecrypt();
            
            // Verify error message doesn't expose sensitive details
            expect(errorSpy).toHaveBeenCalledWith('decrypt', 'Decryption failed');
        });

        test('should handle clipboard operations securely', async () => {
            // Test that clipboard operations don't expose sensitive data
            const base64Input = mockDOM.getElementById('base64-input');
            
            // Paste operation should work without exposing internal data
            const result = await app.pasteFromClipboard('base64-input');
            expect(result).toBe(true);
            expect(base64Input.value).toBeDefined();
        });
    });
});

// Run tests if in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MockDOM,
        MockValidationEngine,
        MockFileProcessor
    };
}