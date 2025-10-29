/**
 * Test Setup for Error Handling Tests
 * Initializes the test environment with necessary globals and mocks
 */

// Mock Web Crypto API for testing
const mockCrypto = {
    getRandomValues: (array) => {
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
        return array;
    },
    subtle: {
        encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
        decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(50)),
        importKey: vi.fn().mockResolvedValue({}),
        deriveKey: vi.fn().mockResolvedValue({})
    }
};

// Mock File API
global.File = class MockFile {
    constructor(chunks, filename, options = {}) {
        this.name = filename;
        this.size = chunks.reduce((size, chunk) => size + chunk.length, 0);
        this.type = options.type || '';
        this.lastModified = Date.now();
        this._chunks = chunks;
    }
};

// Mock FileReader
global.FileReader = class MockFileReader {
    constructor() {
        this.result = null;
        this.error = null;
        this.readyState = 0;
        this.onload = null;
        this.onerror = null;
    }

    readAsArrayBuffer(file) {
        setTimeout(() => {
            this.result = new ArrayBuffer(file.size);
            this.readyState = 2;
            if (this.onload) this.onload();
        }, 0);
    }

    readAsText(file) {
        setTimeout(() => {
            this.result = file._chunks.join('');
            this.readyState = 2;
            if (this.onload) this.onload();
        }, 0);
    }

    readAsDataURL(file) {
        setTimeout(() => {
            this.result = `data:${file.type};base64,${btoa(file._chunks.join(''))}`;
            this.readyState = 2;
            if (this.onload) this.onload();
        }, 0);
    }
};

// Mock Canvas API
global.HTMLCanvasElement = class MockCanvas {
    constructor() {
        this.width = 0;
        this.height = 0;
    }

    getContext(type) {
        return {
            createImageData: (width, height) => ({
                width,
                height,
                data: new Uint8ClampedArray(width * height * 4)
            }),
            putImageData: vi.fn(),
            getImageData: vi.fn().mockReturnValue({
                width: this.width,
                height: this.height,
                data: new Uint8ClampedArray(this.width * this.height * 4)
            }),
            drawImage: vi.fn()
        };
    }

    toBlob(callback, type) {
        setTimeout(() => {
            const blob = new Blob(['fake image data'], { type: type || 'image/png' });
            callback(blob);
        }, 0);
    }
};

// Mock Image
global.Image = class MockImage {
    constructor() {
        this.onload = null;
        this.onerror = null;
        this.src = '';
        this.width = 100;
        this.height = 100;
    }

    set src(value) {
        this._src = value;
        setTimeout(() => {
            if (this.onload) this.onload();
        }, 0);
    }

    get src() {
        return this._src;
    }
};

// Mock URL API
global.URL = {
    createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
    revokeObjectURL: vi.fn()
};

// Mock Blob
global.Blob = class MockBlob {
    constructor(chunks, options = {}) {
        this.size = chunks.reduce((size, chunk) => size + chunk.length, 0);
        this.type = options.type || '';
        this._chunks = chunks;
    }
};

// Mock TextEncoder/TextDecoder
global.TextEncoder = class MockTextEncoder {
    encode(text) {
        const bytes = new Uint8Array(text.length);
        for (let i = 0; i < text.length; i++) {
            bytes[i] = text.charCodeAt(i);
        }
        return bytes;
    }
};

global.TextDecoder = class MockTextDecoder {
    decode(bytes) {
        return String.fromCharCode(...bytes);
    }
};

// Mock btoa/atob
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');

// Mock crypto for Node.js environment - use defineProperty to override
try {
    Object.defineProperty(global, 'crypto', {
        value: mockCrypto,
        writable: true,
        configurable: true
    });
} catch (e) {
    // If that fails, just set it on window
    global.window.crypto = mockCrypto;
}

// Mock document methods
global.document = {
    createElement: vi.fn().mockImplementation((tagName) => {
        if (tagName === 'canvas') {
            return new global.HTMLCanvasElement();
        }
        return {
            style: {},
            classList: {
                add: vi.fn(),
                remove: vi.fn()
            },
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            appendChild: vi.fn(),
            removeChild: vi.fn(),
            parentNode: null,
            innerHTML: '',
            textContent: ''
        };
    }),
    body: {
        appendChild: vi.fn(),
        removeChild: vi.fn()
    }
};

// Mock window object
global.window = {
    crypto: mockCrypto,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    URL: global.URL,
    onunhandledrejection: null,
    onerror: null
};

// Mock navigator
global.navigator = {
    clipboard: {
        writeText: vi.fn().mockResolvedValue(),
        readText: vi.fn().mockResolvedValue('mocked clipboard text')
    }
};

// Import and setup constants
const CONSTANTS = {
    MAX_FILE_SIZE: 1024 * 1024 * 1024, // 1GB
    MAGIC_HEADER: new Uint8Array([0x45, 0x4E, 0x43, 0x49, 0x4D, 0x47]), // "ENCIMG"
    VERSION_1: 1,
    SALT_LENGTH: 16,
    IV_LENGTH: 12,
    PBKDF2_ITERATIONS_V1: 100000,
    MAX_SAFE_DIMENSION: 16384,
    FIXED_WIDTH: 1024,
    BASE64_CHARS_PER_PIXEL: 3,
    
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
    
    PROGRESS_PHASES: {
        ENCRYPTING: 'Encrypting',
        BASE64_ENCODING: 'Base64Encoding',
        RENDERING: 'Rendering',
        DECODING: 'Decoding',
        DECRYPTING: 'Decrypting'
    }
};

global.CONSTANTS = CONSTANTS;