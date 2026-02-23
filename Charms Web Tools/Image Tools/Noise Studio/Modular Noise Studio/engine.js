const APP_VERSION = '22.1';

// --- STATE MANAGEMENT ---
/** 
 * 'state' holds all dynamic data for the application.
 * Purpose: Centralized truth for WebGL context, textures, FBOs (Frame Buffer Objects),
 * image dimensions, and render queue.
 */
const state = {
    gl: null,
    canvas: null,
    programs: {},
    textures: {},
    fbos: {},
    pingPong: [{ tex: null, fbo: null }, { tex: null, fbo: null }],
    baseImage: null,
    imageFiles: [],          // Array of File objects for multi-image mode
    allFiles: [],            // Array of all File objects (including non-images) for replica export
    isMultiImageMode: false,
    currentImageIndex: 0,
    keepFolderStructure: false, // User preference for export
    width: 0,
    height: 0,
    renderWidth: 0,
    renderHeight: 0,
    upscaleFactor: 1.0,
    fboWidth: 0,
    fboHeight: 0,
    // [MODULAR] renderOrder will be dynamic, but starts with defaults for safety
    renderOrder: [
        'noise', 'adjust', 'hdr', 'blur', 'dither', 'corruption',
        'analogVideo', 'palette', 'cell', 'edge', 'halftone',
        'bilateral', 'denoise', 'ca', 'airyBloom', 'glareRays',
        'hankelBlur', 'vignette', 'lensDistort', 'heatwave', 'lightLeaks', 'compression'
    ],
    layerVisibility: {},     // { 'noise': true, 'blur': false }
    layerTextures: {},       // Cache for Layer Breakdown thumbnails
    activeLayerPreview: null, // ID of isolated preview ('noise_isolated', etc.)
    lastActiveSectionDOM: null, // Tracks when UI needs rebuilding
    activeSection: 'adjust',  // Currently selected tool tab
    palette: [
        '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
        '#FFFF00', '#00FFFF', '#FF00FF', '#808080', '#C0C0C0',
        '#800000', '#808000', '#008000', '#800080', '#008080', '#000080'
    ],
    caCenter: { x: 0.5, y: 0.5 },
    realtimeFps: 0,
    lastFrameTime: 0,
    frameRenderCount: 0,   // Used to throttle UI updates for performance
    isPlaying: false,
    playInterval: null,
    clampPreview: true,       // Limits preview texture size to 2048px for stability
    thumbnailFBO: null,       // FBO for small preview rendering
    previewWindow: null       // Reference to popout window
};

// Map of available shaders (will eventually be populated dynamically)
// For now, these are the core IDs needed.
const SHADERS = {
    'adjust': 'Shaders/adjust.frag',
    'adjustMasked': 'Shaders/adjustMasked.frag',
    'mask': 'Shaders/mask.frag',
    'colorMask': 'Shaders/colorMask.frag',
    'noise': 'Shaders/noise.frag',
    'blur': 'Shaders/blur.frag',
    'maskedBlur': 'Shaders/maskedBlur.frag',
    'composite': 'Shaders/composite.frag',
    'chroma': 'Shaders/chroma.frag',
    // ... we will add the rest of the file paths as we create them ...
    'copy': 'Shaders/copy.frag',
    'invert': 'Shaders/invert.frag',
    'radial': 'Shaders/radial.frag',
    'final': 'Shaders/final.frag'
};

/** 
 * Modular Shaders loader.
 * Loads vertex and fragment shaders dynamically.
 */
async function loadShaderSource(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
    } catch (e) {
        console.error(`Failed to load shader from ${url}:`, e);
        return null;
    }
}

// [SHADER HELPERS] Direct WebGL wrapper functions
function compileShaderCode(gl, type, src) {
    if (!src) return null;
    const shader = gl.createShader(type == 'vs-quad' ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader Compile Error:", gl.getShaderInfoLog(shader));
        console.log("Failed Source:", src);
        return null;
    }
    return shader;
}

function createProgramFromSrc(gl, vsSrc, fsSrc) {
    const vs = compileShaderCode(gl, 'vs-quad', vsSrc);
    const fs = compileShaderCode(gl, 'fs-fragment', fsSrc);
    if (!vs || !fs) return null;

    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);

    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.error("Program Link Error:", gl.getProgramInfoLog(p));
        return null;
    }
    return p;
}

// Basic VS-Quad Source
const VS_QUAD_SRC = `#version 300 es
layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec2 a_uv;
out vec2 v_uv;
void main() {
    v_uv = a_uv;
    gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

function createTexture(gl, img, w, h, highPrec = false) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const internalFormat = highPrec ? gl.RGBA16F : gl.SRGB8_ALPHA8;
    const format = gl.RGBA;
    const type = highPrec ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;

    if (img && (img instanceof HTMLImageElement || img instanceof HTMLCanvasElement || img instanceof ImageBitmap)) {
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, format, type, img);
    } else {
        // TypedArray or Null
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, img || null);
    }
    return tex;
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { r, g, b };
}

// Ensure initWebGL is called from ui.js when ready
async function initWebGL(canvasElement) {
    state.canvas = canvasElement;
    const gl = state.canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) { alert('WebGL2 not supported.'); return; }

    // [STABILITY] Handle WebGL Context Loss gracefully
    state.canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        console.error("WebGL Context Lost! The GPU crashed or was reset.");
        document.getElementById('loading').textContent = "ERROR: GPU CRASHED. Reload page.";
        document.getElementById('loading').style.display = "block";
        document.getElementById('loading').style.backgroundColor = "red";
        state.isPlaying = false;
        if (state.playInterval) clearInterval(state.playInterval);
    }, false);

    state.canvas.addEventListener('webglcontextrestored', () => {
        console.log("WebGL Context Restored. Re-initializing...");
        initWebGL(state.canvas);
        if (state.baseImage) {
            reallocateBuffers(false); // Resets textures
            requestRender();
        }
        document.getElementById('loading').style.display = "none";
        document.getElementById('loading').style.backgroundColor = "var(--accent)";
        document.getElementById('loading').textContent = "PROCESSING GPU...";
    }, false);

    // Enable specialized texture formats
    gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');

    state.gl = gl;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    // [MODULAR SHADER LOADING] Load essential core shaders first.
    // For now, to keep the refactor moving, we will extract shaders into the Shaders folder
    // and fetch them here.

    // We will build a system to load these later. 
    // For now, the core engine structure is set up. Next steps are converting HTML forms
    // to JSON and shaders to .frag.

    // Fallback textures for masking
    state.textures.white = createTexture(gl, new Uint8Array([255, 255, 255, 255]), 1, 1);
    state.textures.black = createTexture(gl, new Uint8Array([0, 0, 0, 255]), 1, 1);

    console.log("WebGL Engine Initialized. Ready for shaders.");
}

/** 
 * Resizes all internal offscreen textures to match current viewport or upscale factor.
 */
function reallocateBuffers(fullRes = false) {
    const gl = state.gl;
    if (!gl) return;
    const maxTexSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    let targetW, targetH;

    if (fullRes) {
        let requestW = state.width * state.upscaleFactor;
        let requestH = state.height * state.upscaleFactor;
        let scale = 1.0;
        if (requestW > maxTexSize || requestH > maxTexSize) {
            scale = Math.min(maxTexSize / requestW, maxTexSize / requestH);
        }
        targetW = Math.round(state.width * state.upscaleFactor * scale);
        targetH = Math.round(state.height * state.upscaleFactor * scale);
        state._exportScale = scale; // Store for use in export
    } else {
        // [CLAMPER] Toggleable resolution cap (Default: 2048px)
        const maxDim = state.clampPreview ? 2048 : maxTexSize;
        let tempW = state.width * state.upscaleFactor;
        let tempH = state.height * state.upscaleFactor;
        let scale = 1.0;
        if (tempW > maxDim || tempH > maxDim) {
            scale = Math.min(maxDim / tempW, maxDim / tempH);
        }
        targetW = Math.round(tempW * scale);
        targetH = Math.round(tempH * scale);
        // Clamp to max texture size for preview as well
        if (targetW > maxTexSize || targetH > maxTexSize) {
            const s = Math.min(maxTexSize / targetW, maxTexSize / targetH);
            targetW = Math.floor(targetW * s);
            targetH = Math.floor(targetH * s);
        }
        state._exportScale = scale;
    }

    state.renderWidth = targetW;
    state.renderHeight = targetH;

    if (state.fboWidth === targetW && state.fboHeight === targetH) {
        return { w: targetW, h: targetH };
    }

    state.fboWidth = targetW;
    state.fboHeight = targetH;

    const makeFBO = (highPrec = true) => {
        const tex = createTexture(gl, null, targetW, targetH, highPrec);
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        return { tex, fbo };
    };

    if (state.pingPong[0]?.tex) { gl.deleteTexture(state.pingPong[0].tex); gl.deleteFramebuffer(state.pingPong[0].fbo); }
    if (state.pingPong[1]?.tex) { gl.deleteTexture(state.pingPong[1].tex); gl.deleteFramebuffer(state.pingPong[1].fbo); }

    state.pingPong[0] = makeFBO();
    state.pingPong[1] = makeFBO();

    ['tempNoise', 'blur1', 'blur2', 'preview'].forEach(k => {
        if (state.textures[k]) gl.deleteTexture(state.textures[k]);
        if (state.fbos[k]) gl.deleteFramebuffer(state.fbos[k]);
    });

    const nse = makeFBO();
    state.textures.tempNoise = nse.tex; state.fbos.tempNoise = nse.fbo;
    const b1 = makeFBO();
    state.textures.blur1 = b1.tex; state.fbos.blur1 = b1.fbo;
    const b2 = makeFBO();
    state.textures.blur2 = b2.tex; state.fbos.blur2 = b2.fbo;

    const prev = makeFBO();
    state.textures.preview = prev.tex; state.fbos.preview = prev.fbo;

    // [CHAIN PREVIEW FIX] Dedicated texture for capturing the active layer's output
    const cc = makeFBO();
    state.textures.chainCapture = cc.tex; state.fbos.chainCapture = cc.fbo;

    return { w: targetW, h: targetH };
}

// A global render request function
let renderRequested = false;
function requestRender() {
    if (!renderRequested && state.baseImage) {
        renderRequested = true;
        requestAnimationFrame(() => {
            // renderFrame();  // uncomment when ready
            renderRequested = false;
        });
    }
}

// Temporary placeholder for renderFrame to prevent errors during UI setup
function renderFrame() {
    console.log("renderFrame called");
}
