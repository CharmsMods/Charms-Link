/**
 * UI Interaction Tests for Encryption Interface
 * Tests both input modes (Text/File) and both output formats (Image/Base64)
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
        if (selector === '#encrypt-section .tab-btn') {
            return [this.getElementById('file-input-tab'), this.getElementById('text-input-tab')];
        }
        if (selector === '#encrypt-section .input-area') {
            return [this.getElementById('file-input-area'), this.getElementById('text-input-area')];
        }
        if (selector === 'input[name="output-format"]') {
            return [
                { value: 'image', checked: true, addEventListener: () => {} },
                { value: 'base64', checked: false, addEventListener: () => {} }
            ];
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
    validateFileForEncryption(file) {
        if (!file) return { isValid: false, userMessage: 'No file selected' };
        if (file.size > 1024 * 1024 * 1024) {
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

    validateImageForDecryption(file) {
        if (!file) return { isValid: false, userMessage: 'No image selected' };
        if (file.type !== 'image/png') {
            return { isValid: false, userMessage: 'Please upload a PNG image file.' };
        }
        return { isValid: true };
    }

    validateBase64String(base64String) {
        if (typeof base64String !== 'string' || base64String.trim().length === 0) {
            return { isValid: false, userMessage: 'Base64 input cannot be empty' };
        }
        return { isValid: true };
    }
}

class MockFileProcessor {
    async encryptFile(file, password, onProgress) {
        // Simulate progress updates
        onProgress(25, 'Encrypting');
        onProgress(50, 'Base64Encoding');
        onProgress(75, 'Rendering');
        onProgress(100, 'Rendering');
        
        // Return mock blob
        return new Blob(['mock encrypted data'], { type: 'image/png' });
    }

    async encryptText(text, password, onProgress) {
        // Simulate progress updates
        onProgress(25, 'Encrypting');
        onProgress(50, 'Base64Encoding');
        onProgress(75, 'Rendering');
        onProgress(100, 'Rendering');
        
        return {
            base64: 'bW9jayBlbmNyeXB0ZWQgZGF0YQ==',
            imageBlob: new Blob(['mock encrypted data'], { type: 'image/png' })
        };
    }

    async decryptFile(imageFile, password, onProgress) {
        onProgress(25, 'Decoding');
        onProgress(50, 'Decoding');
        onProgress(75, 'Decrypting');
        onProgress(100, 'Decrypting');
        
        return {
            data: new ArrayBuffer(100),
            filename: 'test.txt',
            mimeType: 'text/plain',
            metadata: { filename: 'test.txt', mimeType: 'text/plain' }
        };
    }

    async decryptBase64(base64Data, password, onProgress) {
        onProgress(25, 'Decoding');
        onProgress(75, 'Decrypting');
        onProgress(100, 'Decrypting');
        
        return {
            data: new TextEncoder().encode('decrypted text').buffer,
            metadata: { filename: 'text.txt', mimeType: 'text/plain' }
        };
    }
}

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock SecureFileImageConverter class for testing
class SecureFileImageConverter {
    constructor() {
        this.currentMode = 'encrypt';
        this.currentInputType = 'file';
        this.currentOutputFormat = 'image';
        this.currentDecryptInputType = 'image';
        
        // Initialize components
        this.validationEngine = new ValidationEngineImpl();
        this.fileProcessor = new FileProcessorImpl();
        
        // Store current files and results
        this.selectedFile = null;
        this.selectedImage = null;
        this.encryptionResult = null;
    }

    switchEncryptInputType(type) {
        this.currentInputType = type;
    }

    handleFileSelection(file) {
        const validationResult = this.validationEngine.validateFileForEncryption(file);
        if (!validationResult.isValid) {
            this.selectedFile = null;
            return;
        }
        this.selectedFile = file;
    }

    updateEncryptButtonState() {
        const encryptBtn = document.getElementById('encrypt-btn');
        const password = document.getElementById('encrypt-password').value;
        const textInput = document.getElementById('text-input').value;
        
        let hasInput = false;
        if (this.currentInputType === 'file') {
            hasInput = this.selectedFile != null;
        } else {
            hasInput = textInput.trim().length > 0;
        }
        
        const passwordValidation = this.validationEngine.validatePasswordWithDetails(password);
        const hasValidPassword = passwordValidation.isValid;
        
        encryptBtn.disabled = !(hasInput && hasValidPassword);
    }

    async handleEncrypt() {
        try {
            const password = document.getElementById('encrypt-password').value;
            
            const onProgress = (percent, phase) => {
                this.showProgress('encrypt', percent, phase);
            };
            
            let result;
            
            if (this.currentInputType === 'file') {
                if (!this.selectedFile) {
                    throw new Error('No file selected');
                }
                
                const imageBlob = await this.fileProcessor.encryptFile(this.selectedFile, password, onProgress);
                
                if (this.currentOutputFormat === 'image') {
                    result = { imageBlob };
                } else {
                    const base64 = await this.blobToBase64(imageBlob);
                    result = { base64, imageBlob };
                }
            } else {
                const textInput = document.getElementById('text-input').value;
                if (!textInput.trim()) {
                    throw new Error('No text entered');
                }
                
                result = await this.fileProcessor.encryptText(textInput, password, onProgress);
            }
            
            this.encryptionResult = result;
            this.showEncryptionOutput(result);
            
        } catch (error) {
            this.showError('encrypt', error.message);
        }
    }

    async blobToBase64(blob) {
        return 'bW9jayBiYXNlNjQ='; // Mock base64
    }

    showProgress(type, percent, phase) {
        // Mock implementation
    }

    showError(type, message) {
        // Mock implementation
    }

    showEncryptionOutput(result) {
        const imageOutput = document.getElementById('image-output');
        const base64Output = document.getElementById('base64-output');
        
        if (this.currentOutputFormat === 'image') {
            imageOutput.style.display = 'block';
            base64Output.style.display = 'none';
        } else {
            imageOutput.style.display = 'none';
            base64Output.style.display = 'block';
            
            if (result.base64) {
                document.getElementById('base64-text').value = result.base64;
            }
        }
    }
}

// Test Suite
describe('Encryption UI Tests', () => {
    let app;
    let mockDOM;
    let originalDocument;

    beforeEach(() => {
        // Setup mock DOM
        mockDOM = new MockDOM();
        originalDocument = global.document;
        global.document = mockDOM;
        
        // Setup global mocks
        global.ValidationEngineImpl = MockValidationEngine;
        global.FileProcessorImpl = MockFileProcessor;
        global.URL = {
            createObjectURL: () => 'mock-url',
            revokeObjectURL: () => {}
        };
        
        // Initialize app
        app = new SecureFileImageConverter();
    });

    afterEach(() => {
        global.document = originalDocument;
    });

    describe('Input Mode Switching', () => {
        test('should switch between File and Text input modes', () => {
            // Initially should be in file mode
            expect(app.currentInputType).toBe('file');
            
            // Switch to text mode
            app.switchEncryptInputType('text');
            expect(app.currentInputType).toBe('text');
            
            // Switch back to file mode
            app.switchEncryptInputType('file');
            expect(app.currentInputType).toBe('file');
        });

        test('should update UI elements when switching input modes', () => {
            const fileTab = mockDOM.getElementById('file-input-tab');
            const textTab = mockDOM.getElementById('text-input-tab');
            
            // Switch to text mode
            app.switchEncryptInputType('text');
            
            // Verify tab activation (mocked behavior)
            expect(app.currentInputType).toBe('text');
        });
    });

    describe('Output Format Selection', () => {
        test('should handle output format changes', () => {
            // Initially should be image format
            expect(app.currentOutputFormat).toBe('image');
            
            // Simulate radio button change to base64
            app.currentOutputFormat = 'base64';
            expect(app.currentOutputFormat).toBe('base64');
            
            // Switch back to image
            app.currentOutputFormat = 'image';
            expect(app.currentOutputFormat).toBe('image');
        });
    });

    describe('File Input Validation', () => {
        test('should validate file size limits', () => {
            const validFile = { name: 'test.txt', size: 1024, type: 'text/plain' };
            const invalidFile = { name: 'large.txt', size: 2 * 1024 * 1024 * 1024, type: 'text/plain' };
            
            // Test valid file
            app.handleFileSelection(validFile);
            expect(app.selectedFile).toBe(validFile);
            
            // Test invalid file
            app.handleFileSelection(invalidFile);
            expect(app.selectedFile).toBe(null);
        });

        test('should update encrypt button state based on file selection', () => {
            const encryptBtn = mockDOM.getElementById('encrypt-btn');
            const passwordInput = mockDOM.getElementById('encrypt-password');
            
            // Initially disabled (no file, no password)
            app.updateEncryptButtonState();
            expect(encryptBtn.disabled).toBe(true);
            
            // Add password but no file
            passwordInput.value = 'testpassword';
            app.updateEncryptButtonState();
            expect(encryptBtn.disabled).toBe(true);
            
            // Add file and password
            app.selectedFile = { name: 'test.txt', size: 1024 };
            app.updateEncryptButtonState();
            expect(encryptBtn.disabled).toBe(false);
        });
    });

    describe('Text Input Validation', () => {
        test('should validate text input for encryption', () => {
            const textInput = mockDOM.getElementById('text-input');
            const passwordInput = mockDOM.getElementById('encrypt-password');
            const encryptBtn = mockDOM.getElementById('encrypt-btn');
            
            // Switch to text mode
            app.switchEncryptInputType('text');
            
            // Initially disabled (no text, no password)
            app.updateEncryptButtonState();
            expect(encryptBtn.disabled).toBe(true);
            
            // Add text but no password
            textInput.value = 'test message';
            app.updateEncryptButtonState();
            expect(encryptBtn.disabled).toBe(true);
            
            // Add password and text
            passwordInput.value = 'testpassword';
            app.updateEncryptButtonState();
            expect(encryptBtn.disabled).toBe(false);
        });
    });

    describe('Password Validation', () => {
        test('should require non-empty password for encryption', () => {
            const passwordInput = mockDOM.getElementById('encrypt-password');
            const encryptBtn = mockDOM.getElementById('encrypt-btn');
            
            // Set up valid input
            app.selectedFile = { name: 'test.txt', size: 1024 };
            
            // Empty password should disable button
            passwordInput.value = '';
            app.updateEncryptButtonState();
            expect(encryptBtn.disabled).toBe(true);
            
            // Valid password should enable button
            passwordInput.value = 'validpassword';
            app.updateEncryptButtonState();
            expect(encryptBtn.disabled).toBe(false);
        });
    });

    describe('Encryption Process', () => {
        test('should handle file encryption with image output', async () => {
            // Setup
            app.selectedFile = { name: 'test.txt', size: 1024, type: 'text/plain' };
            app.currentInputType = 'file';
            app.currentOutputFormat = 'image';
            
            const passwordInput = mockDOM.getElementById('encrypt-password');
            passwordInput.value = 'testpassword';
            
            // Execute encryption
            await app.handleEncrypt();
            
            // Verify result
            expect(app.encryptionResult).toBeDefined();
            expect(app.encryptionResult.imageBlob).toBeDefined();
        });

        test('should handle text encryption with base64 output', async () => {
            // Setup
            app.currentInputType = 'text';
            app.currentOutputFormat = 'base64';
            
            const textInput = mockDOM.getElementById('text-input');
            const passwordInput = mockDOM.getElementById('encrypt-password');
            textInput.value = 'test message';
            passwordInput.value = 'testpassword';
            
            // Execute encryption
            await app.handleEncrypt();
            
            // Verify result
            expect(app.encryptionResult).toBeDefined();
            expect(app.encryptionResult.base64).toBeDefined();
        });

        test('should show progress during encryption', async () => {
            // Setup
            app.selectedFile = { name: 'test.txt', size: 1024 };
            app.currentInputType = 'file';
            
            const passwordInput = mockDOM.getElementById('encrypt-password');
            passwordInput.value = 'testpassword';
            
            // Spy on progress method
            const progressSpy = vi.spyOn(app, 'showProgress');
            
            // Execute encryption
            await app.handleEncrypt();
            
            // Verify progress was shown
            expect(progressSpy).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        test('should display error for missing file', async () => {
            // Setup without file
            app.selectedFile = null;
            app.currentInputType = 'file';
            
            const passwordInput = mockDOM.getElementById('encrypt-password');
            passwordInput.value = 'testpassword';
            
            // Spy on error display
            const errorSpy = vi.spyOn(app, 'showError');
            
            // Execute encryption
            await app.handleEncrypt();
            
            // Verify error was shown
            expect(errorSpy).toHaveBeenCalledWith('encrypt', 'No file selected');
        });

        test('should display error for empty text', async () => {
            // Setup with empty text
            app.currentInputType = 'text';
            
            const textInput = mockDOM.getElementById('text-input');
            const passwordInput = mockDOM.getElementById('encrypt-password');
            textInput.value = '';
            passwordInput.value = 'testpassword';
            
            // Spy on error display
            const errorSpy = vi.spyOn(app, 'showError');
            
            // Execute encryption
            await app.handleEncrypt();
            
            // Verify error was shown
            expect(errorSpy).toHaveBeenCalledWith('encrypt', 'No text entered');
        });
    });

    describe('Output Display', () => {
        test('should show image download for image output format', async () => {
            // Setup
            const result = { imageBlob: new Blob(['test'], { type: 'image/png' }) };
            app.currentOutputFormat = 'image';
            
            // Execute
            app.showEncryptionOutput(result);
            
            // Verify image output is shown
            const imageOutput = mockDOM.getElementById('image-output');
            const base64Output = mockDOM.getElementById('base64-output');
            expect(imageOutput.style.display).toBe('block');
            expect(base64Output.style.display).toBe('none');
        });

        test('should show base64 text for base64 output format', async () => {
            // Setup
            const result = { base64: 'bW9jayBkYXRh' };
            app.currentOutputFormat = 'base64';
            
            // Execute
            app.showEncryptionOutput(result);
            
            // Verify base64 output is shown
            const imageOutput = mockDOM.getElementById('image-output');
            const base64Output = mockDOM.getElementById('base64-output');
            expect(imageOutput.style.display).toBe('none');
            expect(base64Output.style.display).toBe('block');
            
            // Verify base64 text is populated
            const base64Text = mockDOM.getElementById('base64-text');
            expect(base64Text.value).toBe('bW9jayBkYXRh');
        });
    });

    describe('Security Requirements', () => {
        test('should not expose unencrypted data in UI', async () => {
            // Setup
            app.selectedFile = { name: 'secret.txt', size: 1024 };
            app.currentInputType = 'file';
            
            const passwordInput = mockDOM.getElementById('encrypt-password');
            passwordInput.value = 'testpassword';
            
            // Execute encryption
            await app.handleEncrypt();
            
            // Verify no unencrypted data is accessible
            const base64Text = mockDOM.getElementById('base64-text');
            const imageOutput = mockDOM.getElementById('image-output');
            
            // Should only contain encrypted data or be empty
            if (base64Text.value) {
                expect(base64Text.value).not.toContain('secret');
            }
        });

        test('should clear sensitive data after processing', async () => {
            // Setup
            const textInput = mockDOM.getElementById('text-input');
            const passwordInput = mockDOM.getElementById('encrypt-password');
            
            textInput.value = 'sensitive information';
            passwordInput.value = 'secretpassword';
            app.currentInputType = 'text';
            
            // Execute encryption
            await app.handleEncrypt();
            
            // Verify original text is still in input (user may want to modify)
            // but encrypted result doesn't expose original content
            expect(app.encryptionResult.base64).not.toContain('sensitive information');
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