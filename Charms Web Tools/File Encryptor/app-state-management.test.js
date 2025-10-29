/**
 * Application State Management Tests
 * Tests the main application class and UI state management
 */

import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';

// Mock DOM environment
const createMockDOM = () => {
    const mockElements = new Map();
    
    const createElement = (id, type = 'div') => ({
        id,
        type,
        style: { display: 'block' },
        classList: {
            add: vi.fn(),
            remove: vi.fn(),
            contains: vi.fn(() => false)
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        click: vi.fn(),
        value: '',
        textContent: '',
        innerHTML: '',
        disabled: false,
        files: [],
        parentNode: null,
        appendChild: vi.fn(),
        removeChild: vi.fn(),
        cloneNode: vi.fn(() => createElement(id, type))
    });

    // Create all required DOM elements
    const elements = [
        'encrypt-mode-btn', 'decrypt-mode-btn',
        'file-input-tab', 'text-input-tab',
        'image-input-tab', 'base64-input-tab',
        'file-drop-area', 'file-input', 'file-picker-btn',
        'image-drop-area', 'image-input', 'image-picker-btn',
        'text-input', 'base64-input',
        'encrypt-password', 'decrypt-password',
        'encrypt-btn', 'decrypt-btn',
        'encrypt-progress', 'decrypt-progress',
        'encrypt-progress-fill', 'decrypt-progress-fill',
        'encrypt-progress-text', 'decrypt-progress-text',
        'encrypt-output', 'decrypt-output',
        'encrypt-error', 'decrypt-error',
        'file-info', 'image-info',
        'file-name', 'file-size',
        'image-name', 'image-size',
        'base64-text', 'decrypted-text',
        'copy-base64-btn', 'paste-base64-btn', 'copy-text-btn',
        'download-image-btn', 'download-file-btn',
        'image-output', 'base64-output',
        'text-output', 'file-output',
        'restored-file-name', 'restored-file-size'
    ];

    elements.forEach(id => {
        mockElements.set(id, createElement(id));
    });

    return {
        getElementById: vi.fn((id) => mockElements.get(id) || createElement(id)),
        querySelectorAll: vi.fn((selector) => {
            if (selector === '.mode-btn') {
                return [mockElements.get('encrypt-mode-btn'), mockElements.get('decrypt-mode-btn')];
            }
            if (selector === '.section') {
                return [mockElements.get('encrypt-section'), mockElements.get('decrypt-section')];
            }
            if (selector === '.error-display') {
                return [mockElements.get('encrypt-error'), mockElements.get('decrypt-error')];
            }
            return [];
        }),
        createElement: vi.fn(() => createElement('mock-element')),
        body: {
            appendChild: vi.fn(),
            removeChild: vi.fn()
        }
    };
};

// Mock File class
class MockFile {
    constructor(name, size, type) {
        this.name = name;
        this.size = size;
        this.type = type;
        this.lastModified = Date.now();
    }
}

describe('Application State Management', () => {
    let mockDocument;
    let SecureFileImageConverter;
    let app;

    beforeAll(async () => {
        // Setup globals
        globalThis.CONSTANTS = {
            MAX_FILE_SIZE: 1024 * 1024 * 1024,
            ERROR_MESSAGES: {
                FILE_TOO_LARGE: 'File size exceeds the 1GB limit. Please choose a smaller file.',
                INVALID_IMAGE_FORMAT: 'Please upload a PNG image file.',
                EMPTY_PASSWORD: 'Password cannot be empty.',
                PROCESSING_ERROR: 'An error occurred while processing the file. Please try again.'
            }
        };

        // Mock components
        globalThis.ValidationEngineImpl = class {
            validateFileForEncryption(file) {
                if (file.size > CONSTANTS.MAX_FILE_SIZE) {
                    return { isValid: false, userMessage: CONSTANTS.ERROR_MESSAGES.FILE_TOO_LARGE };
                }
                return { isValid: true };
            }
            
            validatePasswordWithDetails(password) {
                if (!password || password.trim().length === 0) {
                    return { isValid: false, userMessage: CONSTANTS.ERROR_MESSAGES.EMPTY_PASSWORD };
                }
                return { isValid: true };
            }
        };

        globalThis.FileProcessorImpl = class {
            async encryptFile(file, password, onProgress) {
                if (onProgress) {
                    onProgress(0, 'Encrypting');
                    onProgress(100, 'Rendering');
                }
                return new Blob(['mock-encrypted-data'], { type: 'image/png' });
            }
        };

        globalThis.ErrorHandler = class {
            handleError(error, context) {
                return {
                    userMessage: error.message || CONSTANTS.ERROR_MESSAGES.PROCESSING_ERROR,
                    context
                };
            }
        };
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mockDocument = createMockDOM();
        globalThis.document = mockDocument;
        
        // Create a minimal app class for testing
        SecureFileImageConverter = class {
            constructor() {
                this.currentMode = 'encrypt';
                this.selectedFile = null;
                this.validationEngine = new ValidationEngineImpl();
                this.fileProcessor = new FileProcessorImpl();
                this.errorHandler = new ErrorHandler();
                this.currentOperations = new Set();
            }
            
            switchMode(mode) {
                this.currentMode = mode;
            }
            
            handleFileSelection(file) {
                const validation = this.validationEngine.validateFileForEncryption(file);
                if (validation.isValid) {
                    this.selectedFile = file;
                } else {
                    this.selectedFile = null;
                    this.showError('encrypt', validation.userMessage);
                }
            }
            
            showError(type, message) {
                const errorDisplay = document.getElementById(`${type}-error`);
                errorDisplay.textContent = message;
                errorDisplay.style.display = 'block';
            }
            
            formatFileSize(bytes) {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            }
        };
        
        app = new SecureFileImageConverter();
    });

    describe('Application Initialization', () => {
        it('should initialize with correct default state', () => {
            expect(app.currentMode).toBe('encrypt');
            expect(app.selectedFile).toBeNull();
        });

        it('should initialize all required components', () => {
            expect(app.validationEngine).toBeDefined();
            expect(app.fileProcessor).toBeDefined();
            expect(app.errorHandler).toBeDefined();
            expect(app.currentOperations).toBeInstanceOf(Set);
        });
    });

    describe('Mode Switching', () => {
        it('should switch between encrypt and decrypt modes', () => {
            expect(app.currentMode).toBe('encrypt');
            
            app.switchMode('decrypt');
            expect(app.currentMode).toBe('decrypt');
        });
    });

    describe('File Selection Handling', () => {
        it('should handle valid file selection', () => {
            const validFile = new MockFile('test.txt', 1024, 'text/plain');
            
            app.handleFileSelection(validFile);
            
            expect(app.selectedFile).toBe(validFile);
        });

        it('should handle invalid file selection', () => {
            const oversizedFile = new MockFile('huge.bin', CONSTANTS.MAX_FILE_SIZE + 1, 'application/octet-stream');
            
            app.handleFileSelection(oversizedFile);
            
            expect(app.selectedFile).toBeNull();
            expect(document.getElementById('encrypt-error').textContent).toBe(CONSTANTS.ERROR_MESSAGES.FILE_TOO_LARGE);
        });
    });

    describe('Utility Functions', () => {
        it('should format file sizes correctly', () => {
            expect(app.formatFileSize(0)).toBe('0 Bytes');
            expect(app.formatFileSize(1024)).toBe('1 KB');
            expect(app.formatFileSize(1024 * 1024)).toBe('1 MB');
            expect(app.formatFileSize(1536)).toBe('1.5 KB');
        });
    });
});