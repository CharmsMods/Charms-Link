export const APP_VERSION = '22.1'; // [QUALITY UPDATE] Rec.709, Linear sRGB, True Median
// --- GLOBAL STATE ---
/** 
 * The 'state' object holds the single source of truth for the application.
 * It manages WebGL resources (gl, programs, textures, fbos), 
 * render stack configuration (renderOrder), and persistent user settings.
 */
export const state = {
    gl: null,             // The WebGL2RenderingContext instance
    canvas: null,         // The main #displayCanvas DOM element
    programs: {},         // Map of compiled Shader Programs (id -> WebGLProgram)
    textures: {},         // Map of reusable WebGL textures (e.g. 'base', 'noise')
    fbos: {},             // Map of Framebuffer Objects for intermediate render steps
    pingPong: [null, null], // Double-buffer for iterative effects like Bilateral Filter
    thumbnailFBO: null,
    baseImage: null,      // The original HTMLImageElement uploaded by the user
    imageFiles: [],       // Array of image file handles for multi-image mode
    currentImageIndex: 0, // Index for the imageFiles array
    isMultiImageMode: false, // Are we editing a single image or a folder?
    isExporting: false,   // Is a batch export in progress?
    playInterval: null,   // Interval ID for the play feature
    isPlaying: false,     // Is the animation playing?
    lastFrameTime: 0,     // Timestamp of the last rendered frame
    realtimeFps: 0,       // Calculated real-time FPS
    frameRenderCount: 0,  // Counter to periodically update FPS display
    width: 1,             // Original image width
    height: 1,            // Original image height
    renderWidth: 1,       // Scaled viewport width
    renderHeight: 1,      // Scaled viewport height
    fboWidth: 0,          // Actual pixel width of offscreen buffers
    fboHeight: 0,         // Actual pixel height of offscreen buffers
    busy: false,          // Mutex to prevent overlapping render calls
    upscaleFactor: 1,     // Multiplier for export-quality rendering (1x-10x)
    // The pipeline order: processed from first to last
    renderOrder: ['noise', 'adjust', 'hdr', 'ca', 'blur', 'airyBloom', 'glareRays', 'hankelBlur', 'vignette', 'cell', 'halftone', 'bilateral', 'denoise', 'dither', 'palette', 'edge', 'corruption', 'analogVideo', 'lensDistort', 'heatwave', 'lightLeaks', 'compression'],
    activeLayerPreview: null,
    activeSection: 'adjust', // Currently open UI section (used for 'Isolated' previews)
    caCenter: { x: 0.5, y: 0.5 }, // UV coordinates for Chromatic Aberration center
    isDraggingPin: false,
    layerTextures: {},    // Stores the results of each layer for the 'Breakdown' view
    layerVisibility: { noise: true, adjust: true, hdr: true, ca: true, blur: true, airyBloom: true, glareRays: true, hankelBlur: true, vignette: true, cell: true, halftone: true, bilateral: true, denoise: true, dither: true, palette: true, edge: true, corruption: true, analogVideo: true, lensDistort: true, heatwave: true, lightLeaks: true, compression: true },
    palette: [],          // Current list of Hex colors for Palette Reconstructor
    lastExtractionImage: null,
    pinIdleTimer: null,
    isPreviewLocked: false, // Prevents the original-hover-compare overlay
    clampPreview: true,     // Default safety: limit preview to 2048px
    isZoomLocked: false,    // Tab key toggle to stay at a specific spot
    lastMousePos: { x: 0, y: 0 },
    isZooming: false,       // Current active zoom operation
    isLensMode: false,      // Toggle between FULL and LENS zoom
    keepFolderStructure: false, // Toggle to preserve folder structure on export
    allFiles: []            // Array of all files (including non-images) for full replica export
};


/** 'LAYERS' provides user-facing metadata for each pipeline step. */
export const LAYERS = {
    'noise': { name: 'Noise Group', color: '#fff' },
    'adjust': { name: 'Adjustments', color: '#fff' },
    'hdr': { name: 'HDR Emulation', color: '#fff' },
    'ca': { name: 'Chromatic Aberration', color: '#fff' },
    'blur': { name: 'Blur', color: '#fff' },
    'cell': { name: 'Cell Shading', color: '#fff' },
    'halftone': { name: 'Halftoning', color: '#fff' },
    'bilateral': { name: 'Bilateral Filter', color: '#fff' },
    'denoise': { name: 'Denoising', color: '#fff' },
    'dither': { name: 'Dithering', color: '#fff' },
    'palette': { name: 'Palette Reconstructor', color: '#fff' },
    'edge': { name: 'Edge Effects', color: '#fff' },
    'corruption': { name: 'Corruption', color: '#fff' },
    'compression': { name: 'Compression', color: '#fff' },
    'airyBloom': { name: 'Airy Disk Bloom', color: '#fff' },
    'glareRays': { name: 'Glare Rays', color: '#fff' },
    'hankelBlur': { name: 'Radial Hankel Blur', color: '#fff' },
    'vignette': { name: 'Vignette & Focus', color: '#fff' },
    'analogVideo': { name: 'Analog Video (VHS/CRT)', color: '#fff' },
    'lensDistort': { name: 'Lens Distortion (Optics)', color: '#fff' },
    'heatwave': { name: 'Heatwave & Ripples', color: '#fff' },
    'lightLeaks': { name: 'Light Leaks', color: '#fff' },
    'shadows': { name: 'Shadows Mask', color: '#fff' },
    'highlights': { name: 'Highlights Mask', color: '#fff' }
};

export const UI = {};

