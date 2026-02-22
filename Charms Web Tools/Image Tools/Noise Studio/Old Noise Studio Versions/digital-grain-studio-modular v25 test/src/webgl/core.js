import { state, UI } from '../state/store.js';

const shaders = import.meta.glob('../shaders/*.{frag,vert}', { eager: true, import: 'default' });

export function createShader(gl, type, srcId) {
    const ext = type == 'vs-quad' ? '.vert' : '.frag';
    const filePath = `../shaders/${srcId}${ext}`;
    let src = shaders[filePath];
    if (!src) {
        console.error("Shader not found:", filePath);
        return null;
    }
    src = src.trim();
    const shader = gl.createShader(type == 'vs-quad' ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error in " + srcId + ":", gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

export function createProgram(gl, vsId, fsId) {
    const vs = createShader(gl, 'vs-quad', vsId);
    const fs = createShader(gl, 'fs-fragment', fsId);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    return p;
}

export function initWebGL() {
    state.canvas = UI.displayCanvas;
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
        initWebGL();
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

    // [SHADER COMPILATION] Link all fs- scripts to programs
    state.programs = {
        adjust: createProgram(gl, 'vs-quad', 'fs-adjust'),
        adjustMasked: createProgram(gl, 'vs-quad', 'fs-adjustMasked'),
        mask: createProgram(gl, 'vs-quad', 'fs-mask'),
        colorMask: createProgram(gl, 'vs-quad', 'fs-colorMask'),
        noise: createProgram(gl, 'vs-quad', 'fs-noise'),
        blur: createProgram(gl, 'vs-quad', 'fs-blur'),
        maskedBlur: createProgram(gl, 'vs-quad', 'fs-maskedBlur'),
        composite: createProgram(gl, 'vs-quad', 'fs-composite'),
        chroma: createProgram(gl, 'vs-quad', 'fs-chroma'),
        copy: createProgram(gl, 'vs-quad', 'fs-copy'),
        dither: createProgram(gl, 'vs-quad', 'fs-dither'),
        maskedDither: createProgram(gl, 'vs-quad', 'fs-maskedDither'),
        corruption: createProgram(gl, 'vs-quad', 'fs-corruption'),
        compression: createProgram(gl, 'vs-quad', 'fs-compression'),
        cell: createProgram(gl, 'vs-quad', 'fs-cell'),
        halftone: createProgram(gl, 'vs-quad', 'fs-halftone'),
        bilateral: createProgram(gl, 'vs-quad', 'fs-bilateral'),
        denoise: createProgram(gl, 'vs-quad', 'fs-denoise'),
        palette: createProgram(gl, 'vs-quad', 'fs-palette'),
        edge: createProgram(gl, 'vs-quad', 'fs-edge'),
        airyBloom: createProgram(gl, 'vs-quad', 'fs-airyBloom'),
        glareRays: createProgram(gl, 'vs-quad', 'fs-glareRays'),
        hankelBlur: createProgram(gl, 'vs-quad', 'fs-hankelBlur'),
        vignette: createProgram(gl, 'vs-quad', 'fs-vignette'),
        analogVideo: createProgram(gl, 'vs-quad', 'fs-analog'),
        lensDistort: createProgram(gl, 'vs-quad', 'fs-lens'),
        heatwave: createProgram(gl, 'vs-quad', 'fs-heatwave'),
        lightLeaks: createProgram(gl, 'vs-quad', 'fs-lightleaks'),
        invert: createProgram(gl, 'vs-quad', 'fs-invert'),
        radial: createProgram(gl, 'vs-quad', 'fs-radial'),
        final: createProgram(gl, 'vs-quad', 'fs-final')
    };

    // [GEOMETRY] Single full-screen quad (2 triangles)
    const quadVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, 0, 0,
        1, -1, 1, 0,
        -1, 1, 0, 1,
        -1, 1, 0, 1,
        1, -1, 1, 0,
        1, 1, 1, 1
    ]), gl.STATIC_DRAW);

    // Bind global attributes
    Object.values(state.programs).forEach(p => {
        gl.useProgram(p);
        const posLoc = gl.getAttribLocation(p, 'a_pos');
        const uvLoc = gl.getAttribLocation(p, 'a_uv');
        gl.enableVertexAttribArray(posLoc);
        gl.enableVertexAttribArray(uvLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
        gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);
    });

    // Create FBO for background thumbnail processing
    const tw = 320, th = 180;
    const tTex = createTexture(gl, null, tw, th);
    const tFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, tFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tTex, 0);
    state.thumbnailFBO = { fbo: tFbo, tex: tTex, w: tw, h: th };

    // Create FBO for analysis tools (Histogram/Vectorscope)
    const aw = 256, ah = 256;
    const aTex = createTexture(gl, null, aw, ah);
    const aFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, aFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, aTex, 0);
    state.analysisFBO = { fbo: aFbo, tex: aTex, w: aw, h: ah };

    // Optimization: Cached resources for thumbnail generation
    state.thumbTempCanvas = document.createElement('canvas');
    state.thumbTempCanvas.width = tw;
    state.thumbTempCanvas.height = th;
    state.thumbTempCtx = state.thumbTempCanvas.getContext('2d');
    state.thumbPixelBuffer = new Uint8Array(tw * th * 4);
    state.thumbClampedBuffer = new Uint8ClampedArray(tw * th * 4);

    // Display Hardware Limit
    if (UI.gpuMaxRes) {
        const max = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        UI.gpuMaxRes.textContent = `${max}px`;
    }
    // Fallback textures for masking
    state.textures.white = createTexture(gl, new Uint8Array([255, 255, 255, 255]), 1, 1);
    state.textures.black = createTexture(gl, new Uint8Array([0, 0, 0, 255]), 1, 1);
}

export function loadNewImage(img) {
    state.baseImage = img;
    state.width = img.width;
    state.height = img.height;

    const gl = state.gl;
    if (state.textures.base) {
        gl.deleteTexture(state.textures.base);
        state.textures.base = null;
    }
    state.textures.base = createTexture(gl, img);

    // Force FBOs to be reallocated for any size (preview or export) after image change
    state.fboWidth = 0;
    state.fboHeight = 0;

    reallocateBuffers(false);

    UI.downloadBtn.disabled = false;
    UI.downloadCurrentBtn.disabled = false;
    UI.compareBtn.disabled = false;

    UI.overlayCanvas.width = img.width;
    UI.overlayCanvas.height = img.height;
    UI.overlayCanvas.getContext('2d').drawImage(img, 0, 0);

    UI.caPin.classList.add('active');

    setupLayerGridDOM();
    requestRender();
    setTimeout(() => requestRender(), 50);
}

export function reallocateBuffers(fullRes = false) {
    const gl = state.gl;
    // Check browser limits
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

    // Reuse analysisFBO (256x256 is static, but let's ensure it's bound correctly if we ever change it)
    // Currently analysisFBO size is fixed in initWebGL.

    // [CHAIN PREVIEW FIX] Dedicated texture for capturing the active layer's output
    const cc = makeFBO();
    state.textures.chainCapture = cc.tex; state.fbos.chainCapture = cc.fbo;

    return { w: targetW, h: targetH };
}

export function createTexture(gl, img, w, h, highPrec = false) {
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

export function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { r, g, b };
}
