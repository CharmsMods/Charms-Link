const APP_VERSION = '22.1'; // [QUALITY UPDATE] Rec.709, Linear sRGB, True Median
// --- GLOBAL STATE ---
/** 
 * The 'state' object holds the single source of truth for the application.
 * It manages WebGL resources (gl, programs, textures, fbos), 
 * render stack configuration (renderOrder), and persistent user settings.
 */
const state = {
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

/** 'UI' is a cache of DOM element references. 
 *  Populated automatically during init to avoid redundant document.getElementById calls.
 *  [MULTI-INSTANCE] Declared as 'let' to allow Proxy swapping for duplicate layer instances. */
let UI = {};
const _UI_BASE = UI; // Keep reference to the real UI object
let eyedropperTarget = null;

/** 'LAYERS' provides user-facing metadata for each pipeline step. */
const LAYERS = {
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

// --- MULTI-INSTANCE SUPPORT ---
/**
 * Parses an instance ID like 'noise__1' into { baseType: 'noise', index: 1 }.
 * Default instances (no suffix) return index 0.
 */
function parseInstanceId(instanceId) {
    const splitIdx = instanceId.lastIndexOf('__');
    if (splitIdx === -1) return { baseType: instanceId, index: 0 };
    return { baseType: instanceId.substring(0, splitIdx), index: parseInt(instanceId.substring(splitIdx + 2)) };
}

/**
 * Creates a Proxy that redirects UI property reads to instance-suffixed elements.
 * For instance index 2, reading proxy.brightness returns _UI_BASE['brightness__2'] if it exists.
 */
function createInstanceUIProxy(instanceIndex) {
    return new Proxy(_UI_BASE, {
        get(target, prop) {
            if (typeof prop === 'symbol') return target[prop];
            const suffixed = prop + '__' + instanceIndex;
            return (suffixed in target) ? target[suffixed] : target[prop];
        }
    });
}

/**
 * Computes the uniforms object for the current render pass.
 * Uses whatever 'UI' is currently pointing at (may be a Proxy for instances).
 */
function computeUniforms(w, h) {
    try {
        return {
            u_bright: parseFloat(UI.brightness?.value || 0),
            u_cont: parseFloat(UI.contrast?.value || 0),
            u_sat: parseFloat(UI.saturationAdj?.value || 0) / 100.0,
            u_warmth: parseFloat(UI.warmth?.value || 0),
            u_sharp: parseFloat(UI.sharpen?.value || 0),
            u_sharpThresh: parseFloat(UI.sharpenThreshold?.value || 5),
            u_step: [1.0 / w, 1.0 / h],
            u_hdrTol: parseFloat(UI.hdrTolerance?.value || 0),
            u_hdrAmt: parseFloat(UI.hdrAmount?.value || 0),
            u_ca_amt: calcCurve(parseFloat(UI.aberrationAmount?.value || 0), 300, 300),
            u_ca_blur: calcCurve(parseFloat(UI.aberrationBlur?.value || 0), 100, 100.0),
            u_ca_center: [state.caCenter.x, state.caCenter.y],
            u_ca_rad: parseFloat(UI.caRadius?.value || 0) / 1000.0,
            u_ca_fall: parseFloat(UI.caFalloff?.value || 0) / 1000.0,
            u_airy_intensity: parseFloat(UI.airyBloomIntensity?.value ?? 0.5),
            u_airy_aperture: parseFloat(UI.airyBloomAperture?.value ?? 3.0),
            u_airy_threshold: parseFloat(UI.airyBloomThreshold?.value ?? 0.7),
            u_glare_intensity: parseFloat(UI.glareRaysIntensity?.value ?? 0.4),
            u_glare_rays: parseFloat(UI.glareRaysRays?.value ?? 6),
            u_glare_length: parseFloat(UI.glareRaysLength?.value ?? 0.3),
            u_glare_blur: parseFloat(UI.glareRaysBlur?.value ?? 0.2),
            u_hankel_intensity: parseFloat(UI.hankelBlurIntensity?.value ?? 0.5),
            u_hankel_radius: parseFloat(UI.hankelBlurRadius?.value ?? 5.0),
            u_hankel_quality: parseFloat(UI.hankelBlurQuality?.value ?? 16),
            u_vignette_intensity: parseFloat(UI.vignetteIntensity?.value ?? 50) / 100.0,
            u_vignette_radius: parseFloat(UI.vignetteRadius?.value ?? 75) / 100.0,
            u_vignette_softness: parseFloat(UI.vignetteSoftness?.value ?? 50) / 100.0,
            u_vignette_color: hexToRgb(UI.vignetteColor?.value ?? '#000000'),
            u_analog_wobble: parseFloat(UI.analogWobble?.value ?? 30) / 100.0,
            u_analog_bleed: parseFloat(UI.analogBleed?.value ?? 50) / 100.0,
            u_analog_curve: parseFloat(UI.analogCurve?.value ?? 20) / 100.0,
            u_analog_noise: parseFloat(UI.analogNoise?.value ?? 40) / 100.0,
            u_lens_amount: parseFloat(UI.lensAmount?.value ?? 0) / 100.0,
            u_lens_scale: parseFloat(UI.lensScale?.value ?? 100) / 100.0,
            u_heatwave_intensity: parseFloat(UI.heatwaveIntensity?.value ?? 30) / 100.0,
            u_heatwave_speed: parseFloat(UI.heatwaveSpeed?.value ?? 50) / 100.0,
            u_heatwave_scale: parseFloat(UI.heatwaveScale?.value ?? 20),
            u_heatwave_direction: parseInt(UI.heatwaveDirection?.value ?? 0),
            u_lightleaks_intensity: parseFloat(UI.lightLeaksIntensity?.value ?? 50) / 100.0,
            u_lightleaks_color1: hexToRgb(UI.lightLeaksColor1?.value ?? '#ff5500'),
            u_lightleaks_color2: hexToRgb(UI.lightLeaksColor2?.value ?? '#0055ff'),
            u_time: (performance.now() % 100000) / 1000.0
        };
    } catch (e) {
        console.warn('[Engine] Error computing uniforms:', e.message);
        return { u_step: [1 / w, 1 / h], u_time: 0 };
    }
}

// --- INIT ---
/** Entry point: Initializes WebGL, UI bindings, and default state. */
window.addEventListener('DOMContentLoaded', async () => {
    // [MODULAR] Generate all layer UI panels from JSON definitions
    await generateLayerUI();

    // [DOM COLLECTION] Auto-populate UI object for fast reference
    document.querySelectorAll('input, select, button, canvas').forEach(el => {
        if (el.id) UI[el.id] = el;
    });
    // Additional containers
    UI.layerGrid = document.getElementById('layerGrid');
    UI.previewContainer = document.getElementById('previewContainer');
    UI.overlayOriginal = document.getElementById('overlayOriginal');
    UI.loading = document.getElementById('loading');
    UI.hoverZoomValue = document.getElementById('hoverZoomValue');
    UI.hoverZoomSlider = document.getElementById('hoverZoomSlider'); // Fix: Targeted input directly
    UI.zoomResIndicator = document.getElementById('zoomResIndicator');
    UI.loadFolderBtn = document.getElementById('loadFolderBtn');
    UI.prevImageBtn = document.getElementById('prevImageBtn');
    UI.nextImageBtn = document.getElementById('nextImageBtn');
    UI.imageCounter = document.getElementById('imageCounter');
    UI.imageScrubber = document.getElementById('imageScrubber');
    UI.playBtn = document.getElementById('playBtn');
    UI.playFps = document.getElementById('playFps');
    UI.actualFps = document.getElementById('actualFps');
    UI['export-overlay'] = document.getElementById('export-overlay');
    UI['export-status'] = document.getElementById('export-status');
    UI.stopExportBtn = document.getElementById('stopExportBtn');

    // Critical interactive elements (might not be input/button tags)
    UI.caPin = document.getElementById('caPin');
    UI.previewLock = document.getElementById('previewLock');
    UI.resetCenterBtn = document.getElementById('resetCenterBtn');
    UI.upscaleInput = document.getElementById('upscaleInput');
    UI.clampPreviewToggle = document.getElementById('clampPreviewToggle');
    UI.gpuMaxRes = document.getElementById('gpuMaxRes');
    UI.exportInfo = document.getElementById('exportInfo');
    UI.zoomLens = document.getElementById('zoomLens');
    UI.lensToggleBtn = document.getElementById('lensToggleBtn');
    UI.lensCanvas = document.getElementById('lensCanvas');

    // Histogram elements
    UI.histogramCanvas = document.getElementById('histogramCanvas');
    UI.avgBrightnessVal = document.getElementById('avgBrightnessVal');
    UI.renderResVal = document.getElementById('renderResVal');

    // Vectorscope elements
    UI.vectorscopeCanvas = document.getElementById('vectorscopeCanvas');
    UI.avgSaturationVal = document.getElementById('avgSaturationVal');

    // Explicitly collect Blur/Dither controls to ensure no initialization race conditions
    const manualIds = [
        'blurEnable', 'blurAmount', 'blurType',
        'blurColorExclude', 'blurTargetColor', 'blurColorTolerance', 'blurColorFade',
        'blurLumaMask', 'blurShadowThreshold', 'blurShadowFade', 'blurHighlightThreshold', 'blurHighlightFade',
        'ditherEnable', 'ditherBitDepth', 'ditherPaletteSize', 'ditherStrength', 'ditherScale', 'ditherType', 'ditherUsePalette', 'ditherGamma',
        'ditherColorExclude', 'ditherExcludeColor', 'ditherColorTolerance', 'ditherColorFade',
        'ditherLumaMask', 'ditherShadowThreshold', 'ditherShadowFade', 'ditherHighlightThreshold', 'ditherHighlightFade',
        'paletteEnable', 'paletteBlend', 'paletteSmoothing', 'paletteSmoothingType', 'paletteList', 'extractCount',
        'edgeEnable', 'edgeBlend', 'edgeMode', 'edgeStrength', 'edgeTolerance', 'edgeFgSat', 'edgeBgSat', 'edgeBloom', 'edgeSmooth', 'edgeSatControls',
        'denoiseEnable', 'denoiseMode', 'denoiseSearchRadius', 'denoisePatchRadius', 'denoiseH', 'denoiseBlend',
        'denoiseColorExclude', 'denoiseExcludeColor', 'denoiseColorTolerance', 'denoiseColorFade',
        'denoiseLumaMask', 'denoiseShadowThreshold', 'denoiseShadowFade', 'denoiseHighlightThreshold', 'denoiseHighlightFade', 'denoiseInvertMask',
        'airyBloomEnable', 'airyBloomIntensity', 'airyBloomAperture', 'airyBloomThreshold', 'airyBloomThresholdFade', 'airyBloomCutoff',
        'airyBloomColorExclude', 'airyBloomExcludeColor', 'airyBloomColorTolerance', 'airyBloomColorFade',
        'airyBloomLumaMask', 'airyBloomShadowThreshold', 'airyBloomShadowFade', 'airyBloomHighlightThreshold', 'airyBloomHighlightFade', 'airyBloomInvertMask',
        'hankelBlurEnable', 'hankelBlurIntensity', 'hankelBlurRadius', 'hankelBlurQuality',
        'hankelColorExclude', 'hankelExcludeColor', 'hankelColorTolerance', 'hankelColorFade',
        'hankelLumaMask', 'hankelShadowThreshold', 'hankelShadowFade', 'hankelHighlightThreshold', 'hankelHighlightFade', 'hankelInvertMask',
        'compressionEnable', 'compressionMethod', 'compressionQuality', 'compressionBlockSize', 'compressionBlend', 'compressionIterations'
    ];
    manualIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) UI[id] = el;
    });

    // [TABS] Handle navigation between 'Controls' and 'Render Layer Order'
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(e.target.dataset.tab).classList.add('active');
        });
    });

    // [SIDEBAR] Only one section open at a time logic
    // Now handled by bindDynamicControls
    setupDragLayerList();

    // [VALUE BINDING] Sync range sliders with their adjacent text indicators
    // Now handled by bindDynamicControls

    // Specific Listener for Zoom to update State
    if (UI.hoverZoomValue) {
        UI.hoverZoomValue.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) state.zoomLevel = val;
            // requestRender handled by generic listener above? 
            // No, generic listener only attaches if next element is control-value.
            // Checking HTML: does hoverZoomValue have sibling? 
            // Safer to call requestRender here too.
            requestRender();
        });
    }
    // Generic input triggers
    // Now handled by bindDynamicControls
    bindDynamicControls(document);


    UI.edgeMode.addEventListener('change', () => {
        UI.edgeSatControls.style.display = UI.edgeMode.value === '1' ? 'block' : 'none';
    });
    // Initial trigger
    UI.edgeMode.dispatchEvent(new Event('change'));

    // Palette buttons
    const getRandomHex = () => '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');

    UI.addPaletteColor.addEventListener('click', () => {
        state.palette.push(getRandomHex());
        updatePaletteUI();
        requestRender();
    });

    // Palette Canvas Picker Logic
    // Create a hidden input for the canvas picker to target
    const palettePickerInput = document.createElement('input');
    palettePickerInput.id = 'pickPaletteColor';
    palettePickerInput.type = 'color';
    palettePickerInput.style.display = 'none';
    document.body.appendChild(palettePickerInput);
    UI.pickPaletteColorInput = palettePickerInput;

    palettePickerInput.addEventListener('change', (e) => {
        state.palette.push(e.target.value);
        updatePaletteUI();
        requestRender();
    });

    UI.clearPalette.addEventListener('click', () => {
        state.palette = [];
        updatePaletteUI();
        requestRender();
    });
    UI.randomPalette.addEventListener('click', () => {
        const len = state.palette.length;
        if (len === 0) {
            const count = Math.floor(Math.random() * 5) + 3;
            const newPalette = new Set();
            while (newPalette.size < count) newPalette.add(getRandomHex());
            state.palette = Array.from(newPalette);
        } else {
            for (let i = 0; i < len; i++) {
                state.palette[i] = getRandomHex();
            }
        }
        updatePaletteUI();
        requestRender();
    });

    UI.extractPalette.addEventListener('click', () => UI.paletteImageUpload.click());
    UI.paletteImageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const img = new Image();
            img.onload = () => {
                state.lastExtractionImage = img;
                const count = parseInt(UI.extractCount?.value || 8);
                extractPaletteFromImage(img, count);
            };
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
    });

    UI.extractCount.addEventListener('input', () => {
        if (state.lastExtractionImage) {
            const count = parseInt(UI.extractCount.value);
            extractPaletteFromImage(state.lastExtractionImage, count);
        }
    });

    // Lock Toggle Logic
    UI.previewLock.addEventListener('change', (e) => {
        state.isPreviewLocked = e.target.checked;
        if (state.isPreviewLocked) {
            UI.overlayOriginal.classList.remove('show');
        }
    });

    // [UPSCALE] Handles the multiplier for the rendering buffers.
    UI.upscaleInput.addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 1) val = 1;
        if (val > 10) val = 10;
        e.target.value = val;
        state.upscaleFactor = val;
        if (state.baseImage) {
            reallocateBuffers(false); // Rebuild WebGL textures at new size
            requestRender();
        }
    });

    // [PIN INTERACTIONS] Chromatic Aberration Center Control
    // Purpose: Allows users to drag the center of the CA effect on the preview.
    // Logic: Maps DOM mouse coordinates to normalized 0.0-1.0 UV space for the shader.
    UI.resetCenterBtn.addEventListener('click', () => {
        state.caCenter = { x: 0.5, y: 0.5 };
        updatePinPosition();
        requestRender();
    });

    UI.caPin.addEventListener('mousedown', (e) => {
        state.isDraggingPin = true;
        // Lock logic: If globally locked, just keep preview. If not, hide overlay.
        if (!state.isPreviewLocked) UI.overlayOriginal.classList.remove('show');
        clearTimeout(state.pinIdleTimer);
        e.preventDefault();
    });

    window.addEventListener('mouseup', () => {
        if (state.isDraggingPin) {
            state.isDraggingPin = false;
            // Idle timer only matters if not locked
            if (!state.isPreviewLocked) {
                state.pinIdleTimer = setTimeout(() => {
                    UI.overlayOriginal.classList.add('show');
                }, 4000);
            }
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!state.isDraggingPin) return;
        const rect = UI.previewContainer.getBoundingClientRect();
        let x = (e.clientX - rect.left) / rect.width;
        let y = 1.0 - (e.clientY - rect.top) / rect.height;
        x = Math.max(0, Math.min(1, x));
        y = Math.max(0, Math.min(1, y));
        state.caCenter = { x, y };
        updatePinPosition();
        requestRender();
    });

    // [HOVER ZOOM & LENS] High-Resolution Detail Viewer
    // Purpose: Full-screen scaling OR circular lens magnification on hover.
    // Logic: 
    // 1. Temporarily upsizes rendering buffers to 'Full Res' on hover (to avoid blurriness).
    // 2. Maps mouse coordinates to CSS transform-origin (FULL) or 2D context sample area (LENS).
    let hoverTimeout;
    const pContainer = UI.previewContainer;
    const displayCanvas = UI.displayCanvas;

    // Hover Zoom Slider Logic
    const parseZoom = (val) => {
        let v = parseFloat(val);
        if (isNaN(v)) return 1.0;
        return v;
    };

    // Lens toggle button
    UI.lensToggleBtn.addEventListener('click', () => {
        state.isLensMode = !state.isLensMode;
        UI.lensToggleBtn.textContent = state.isLensMode ? 'LENS' : 'FULL';
        UI.lensToggleBtn.style.background = state.isLensMode ? 'var(--accent)' : '';
        UI.lensToggleBtn.style.color = state.isLensMode ? '#000' : '';
        resetZoom();
    });

    // Setup lens canvas
    const lensSize = 180;
    UI.lensCanvas.width = lensSize;
    UI.lensCanvas.height = lensSize;
    const lensCtx = UI.lensCanvas.getContext('2d');

    // Reset zoom transform when mouse leaves
    const resetZoom = (force = false) => {
        if (state.isZoomLocked && !force) return;

        displayCanvas.style.transform = '';
        displayCanvas.style.transformOrigin = '';
        displayCanvas.style.zIndex = '';
        UI.zoomResIndicator.style.display = 'none';
        if (UI.zoomLens) UI.zoomLens.style.display = 'none';
        if (state.isZooming) {
            state.isZooming = false;
            // Return to preview resolution (only if clamping is active)
            if (state.clampPreview) {
                reallocateBuffers(false);
                requestRender();
            }
        }
    };

    // Apply zoom transform based on cursor position
    const applyZoom = (e) => {
        const zoomInput = UI.hoverZoomSlider;
        const zoomLevel = parseZoom(zoomInput.value);

        if (zoomLevel <= 1.0) {
            resetZoom();
            return;
        }


        // Hide the overlay when zooming
        UI.overlayOriginal.classList.remove('show');

        // Render at full resolution for zoom if not already
        if (!state.isZooming) {
            state.isZooming = true;
            reallocateBuffers(true);
            requestRender();
        }

        const rect = pContainer.getBoundingClientRect();

        // Use cached mouse position if locked
        if (!state.isZoomLocked && e) {
            state.lastMousePos = { x: e.clientX, y: e.clientY };
        }

        const mouseX = state.lastMousePos.x - rect.left;
        const mouseY = state.lastMousePos.y - rect.top;
        const xPct = mouseX / rect.width;
        const yPct = mouseY / rect.height;

        if (state.isLensMode) {
            // LENS MODE: Show circular magnifier following cursor
            displayCanvas.style.transform = '';
            displayCanvas.style.transformOrigin = '';
            displayCanvas.style.zIndex = '';

            // Position lens centered on cursor
            if (UI.zoomLens) {
                UI.zoomLens.style.display = 'block';
                UI.zoomLens.style.left = (mouseX - lensSize / 2) + 'px';
                UI.zoomLens.style.top = (mouseY - lensSize / 2) + 'px';
            }

            // Calculate the actual displayed canvas size (object-fit: contain)
            const canvasAspect = displayCanvas.width / displayCanvas.height;
            const containerAspect = rect.width / rect.height;
            let displayedW, displayedH, offsetX, offsetY;

            if (canvasAspect > containerAspect) {
                displayedW = rect.width;
                displayedH = rect.width / canvasAspect;
                offsetX = 0;
                offsetY = (rect.height - displayedH) / 2;
            } else {
                displayedH = rect.height;
                displayedW = rect.height * canvasAspect;
                offsetX = (rect.width - displayedW) / 2;
                offsetY = 0;
            }

            // Map mouse position to canvas pixel coordinates
            const canvasX = ((mouseX - offsetX) / displayedW) * displayCanvas.width;
            const canvasY = ((mouseY - offsetY) / displayedH) * displayCanvas.height;

            // Calculate source region size based on zoom
            const srcSize = lensSize / zoomLevel;
            const srcX = canvasX - srcSize / 2;
            const srcY = canvasY - srcSize / 2;

            // Draw zoomed portion to lens canvas
            if (lensCtx) {
                lensCtx.clearRect(0, 0, lensSize, lensSize);
                lensCtx.drawImage(
                    displayCanvas,
                    Math.max(0, Math.min(srcX, displayCanvas.width - srcSize)),
                    Math.max(0, Math.min(srcY, displayCanvas.height - srcSize)),
                    srcSize, srcSize,
                    0, 0, lensSize, lensSize
                );
            }
        } else {
            // FULL MODE: Scale entire canvas from cursor point
            if (UI.zoomLens) UI.zoomLens.style.display = 'none';
            displayCanvas.style.zIndex = '15';

            // Correct mapping for object-fit: contain (centered canvas)
            const canvasAspect = displayCanvas.width / displayCanvas.height;
            const containerAspect = rect.width / rect.height;
            let offsetX = 0, offsetY = 0, displayedW = rect.width, displayedH = rect.height;

            if (canvasAspect > containerAspect) {
                displayedH = rect.width / canvasAspect;
                offsetY = (rect.height - displayedH) / 2;
            } else {
                displayedW = rect.height * canvasAspect;
                offsetX = (rect.width - displayedW) / 2;
            }

            const localX = (mouseX - offsetX) / displayedW;
            const localY = (mouseY - offsetY) / displayedH;

            displayCanvas.style.transformOrigin = `${localX * 100}% ${localY * 100}%`;
            displayCanvas.style.transform = `scale(${zoomLevel})`;
        }

        // Show resolution indicator
        const srcW = state.width * state.upscaleFactor;
        const srcH = state.height * state.upscaleFactor;
        const bufW = displayCanvas.width;
        const bufH = displayCanvas.height;
        const match = (bufW >= srcW && bufH >= srcH) ? '✓ FULL RES' : '⚠ SCALED';
        const modeLabel = state.isLensMode ? 'LENS' : 'FULL';
        UI.zoomResIndicator.innerHTML = `Mode: ${modeLabel}<br>Source: ${srcW}×${srcH}<br>Canvas: ${bufW}×${bufH}<br>${match}`;
        UI.zoomResIndicator.style.display = 'block';
        UI.zoomResIndicator.style.color = (bufW >= srcW && bufH >= srcH) ? '#0f0' : '#f80';
        UI.zoomResIndicator.style.borderColor = (bufW >= srcW && bufH >= srcH) ? '#0f0' : '#f80';
    };

    pContainer.addEventListener('mouseenter', (e) => {
        const zoomLevel = parseFloat(UI.hoverZoomSlider.value);
        if (zoomLevel <= 1 && !state.isPreviewLocked && !state.activeLayerPreview) {
            UI.overlayOriginal.classList.add('show');
        }
        clearTimeout(hoverTimeout);
        applyZoom(e);
    });

    pContainer.addEventListener('mouseleave', (e) => {
        UI.overlayOriginal.classList.remove('show');
        clearTimeout(hoverTimeout);

        // If the mouse leaves but it's locked, we don't reset
        if (!state.isZoomLocked) {
            resetZoom();
        }
    });

    pContainer.addEventListener('wheel', (e) => {
        // If Ctrl/Meta is held, we cycle blend modes (legacy behavior)
        // Otherwise, wheel controls zoom level
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const sel = UI.blendMode;
            const len = sel.options.length;
            let idx = sel.selectedIndex;
            const dir = Math.sign(e.deltaY);
            idx = (idx + dir + len) % len;
            sel.selectedIndex = idx;
            requestRender();
        } else {
            // Standard Wheel to Zoom
            e.preventDefault();
            let val = parseFloat(UI.hoverZoomSlider.value);
            const dir = -Math.sign(e.deltaY);
            val += dir * 0.5;
            val = Math.max(1, Math.min(8, val));
            UI.hoverZoomSlider.value = val;
            // Trigger input event manually to update text and state
            UI.hoverZoomSlider.dispatchEvent(new Event('input'));
            applyZoom(e);
        }
    }, { passive: false });

    pContainer.addEventListener('mousemove', (e) => {
        clearTimeout(hoverTimeout);
        const zVal = parseFloat(UI.hoverZoomSlider.value);
        if (!state.isPreviewLocked && !state.activeLayerPreview && zVal <= 1) {
            UI.overlayOriginal.classList.add('show');
        }
        applyZoom(e);
    });

    // [ZOOM LOCK] Tab keybind
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            // Only toggle if we are currently hovering or already locked
            const isHovering = UI.previewContainer.matches(':hover');
            if (isHovering || state.isZoomLocked) {
                e.preventDefault();
                state.isZoomLocked = !state.isZoomLocked;

                // If we just unlocked and aren't hovering, snap back
                if (!state.isZoomLocked && !isHovering) {
                    resetZoom(true);
                } else if (state.isZoomLocked) {
                    // Ensure zoom stays high-res
                    applyZoom();
                }
            }
        }
    });

    // JSON Handlers
    UI.downloadJsonBtn.addEventListener('click', downloadPreset);
    UI.uploadJsonTrigger.addEventListener('click', () => UI.jsonUpload.click());
    UI.jsonUpload.addEventListener('change', uploadPreset);

    await initWebGL();

    // Single image load
    UI.imageUpload.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        state.isMultiImageMode = false;
        state.imageFiles = [file];
        state.currentImageIndex = 0;
        loadImageFromFile(file).then(updateUIMode);
    });

    // Folder load
    UI.loadFolderBtn.addEventListener('click', loadFolder);

    // Navigation
    UI.prevImageBtn.addEventListener('click', () => changeImage(-1));
    UI.nextImageBtn.addEventListener('click', () => changeImage(1));

    // Scrubber
    UI.imageScrubber.addEventListener('input', (e) => {
        const newIndex = parseInt(e.target.value, 10);
        if (newIndex !== state.currentImageIndex) {
            state.currentImageIndex = newIndex;
            // Don't wait for image to load, makes scrubber feel laggy
            requestAnimationFrame(() => {
                loadImageFromFile(state.imageFiles[state.currentImageIndex]).then(updateUIMode);
            });
        }
    });

    // --- Playback Logic ---
    const startPlay = () => {
        if (state.playInterval) clearInterval(state.playInterval);
        state.isPlaying = true;
        UI.playBtn.textContent = 'STOP ■';
        const fps = parseInt(UI.playFps.value, 10) || 10;

        state.playInterval = setInterval(() => {
            let newIndex = (state.currentImageIndex + 1) % state.imageFiles.length;
            state.currentImageIndex = newIndex;
            // Don't await, just fire and forget to keep timing consistent
            loadImageFromFile(state.imageFiles[state.currentImageIndex]);
            updateUIMode(); // Update scrubber and counter
        }, 1000 / fps);
    };

    const stopPlay = () => {
        if (state.playInterval) {
            clearInterval(state.playInterval);
            state.playInterval = null;
        }
        state.isPlaying = false;
        UI.playBtn.textContent = 'PLAY ►';
    };

    UI.playBtn.addEventListener('click', () => {
        if (state.isPlaying) {
            stopPlay();
        } else {
            startPlay();
        }
    });

    UI.keepFolderStructureToggle.addEventListener('change', (e) => {
        state.keepFolderStructure = e.target.checked;
    });

    // Download button now handles both modes
    UI.downloadBtn.addEventListener('click', () => {
        if (state.isMultiImageMode && state.imageFiles.length > 1) {
            downloadAllImages();
        } else {
            downloadSingleImage();
        }
    });

    UI.downloadCurrentBtn = document.getElementById('downloadCurrentBtn');
    UI.compareBtn.addEventListener('click', openCompare);
    UI.downloadCurrentBtn.addEventListener('click', downloadSingleImage);
    UI.closeCompare.addEventListener('click', () => document.getElementById('compareModal').classList.remove('show'));
    UI.exportSideBySide.addEventListener('click', () => exportComparison('side'));
    UI.exportStacked.addEventListener('click', () => exportComparison('stack'));

    // [NOISE PARAM DYNAMICS]
    // Purpose: Dynamically renames and toggles noise parameters based on algorithm.
    UI.noiseType.addEventListener('change', () => syncNoiseUI(''));
    syncNoiseUI(''); // Initial call

    // [EYEDROPPER TOOL] Localized Color Selection
    // Purpose: Picks colors directly from the WebGL canvas for palette or exclusion masks.
    // Logic: Reads pixel data from the 'null' framebuffer (screen) at the mapped click coordinate.
    // Note: Uses WebGL's inverted Y-axis relative to DOM coordinates.
    const style = document.createElement('style');
    style.textContent = `
                .eyedropper-btn { background: none; border: none; cursor: pointer; font-size: 1.2em; padding: 0 5px; opacity: 0.7; transition: opacity 0.2s; }
                .eyedropper-btn:hover { opacity: 1; }
                .eyedropper-active { cursor: crosshair !important; }
            `;
    document.head.appendChild(style);

    // Eyedropper buttons handled by bindDynamicControls

    UI.displayCanvas.addEventListener('click', (e) => {
        if (!eyedropperTarget) return;

        const rect = UI.displayCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const gl = state.gl;
        const canvas = UI.displayCanvas;
        const cw = canvas.width;
        const ch = canvas.height;

        // 1. Map DOM click to Relative UV (0-1) across the "Contain" rect
        const imgAspect = state.width / state.height;
        const rectAspect = rect.width / rect.height;

        let drawW, drawH, ox, oy;
        if (imgAspect > rectAspect) {
            drawW = rect.width;
            drawH = rect.width / imgAspect;
            ox = 0;
            oy = (rect.height - drawH) / 2;
        } else {
            drawH = rect.height;
            drawW = rect.height * imgAspect;
            ox = (rect.width - drawW) / 2;
            oy = 0;
        }

        if (x < ox || x > ox + drawW || y < oy || y > oy + drawH) return;

        const relX = (x - ox) / drawW;
        const relY = (y - oy) / drawH;

        // 2. Pick from Original Texture (state.textures.base)
        // We use a temporary FBO to read from the base texture directly
        const tempFbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, tempFbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, state.textures.base, 0);

        // Map UV to base image dimensions
        const pickX = Math.floor(relX * state.width);
        const pickY = Math.floor((1.0 - relY) * state.height);

        const pixel = new Uint8Array(4);
        gl.readPixels(pickX, pickY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

        // Clean up
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(tempFbo);

        const hex = "#" + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);

        const input = document.getElementById(eyedropperTarget);
        if (input) {
            input.value = hex;
            input.dispatchEvent(new Event('input'));
            input.dispatchEvent(new Event('change'));
        }

        eyedropperTarget = null;
        UI.displayCanvas.classList.remove('eyedropper-active');
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && eyedropperTarget) {
            eyedropperTarget = null;
            UI.displayCanvas.classList.remove('eyedropper-active');
        }
    });
});

// --- JSON PRESETS ---
/** 
 * Serializes the current 'state' and all UI input values into a JSON file.
 * Purpose: Allows users to save and share their custom noise profiles.
 */
function downloadPreset() {
    const preset = {
        metadata: {
            version: APP_VERSION,
            timestamp: new Date().toISOString(),
            source: 'Noise Studio'
        },
        values: {},
        checks: {},
        selects: {},
        renderOrder: state.renderOrder,
        layerVisibility: state.layerVisibility,
        upscaleFactor: state.upscaleFactor,
        caCenter: state.caCenter,
        palette: state.palette,
        imageData: null
    };

    // Collect inputs
    document.querySelectorAll('input[type=range]').forEach(el => preset.values[el.id] = el.value);
    document.querySelectorAll('input[type=checkbox]').forEach(el => {
        if (!el.id.startsWith('drag-') && el.id !== 'jsonIncludeImage' && el.id !== 'previewLock') { // Skip non-setting toggles
            preset.checks[el.id] = el.checked;
        }
    });
    document.querySelectorAll('select').forEach(el => {
        if (el.id !== 'jsonImportMode') {
            preset.selects[el.id] = el.value;
        }
    });

    // Save Image Data if checked
    const includeImage = UI.jsonIncludeImage?.checked;
    if (state.baseImage && includeImage) {
        try {
            const c = document.createElement('canvas');
            c.width = state.baseImage.width;
            c.height = state.baseImage.height;
            const ctx = c.getContext('2d');
            ctx.drawImage(state.baseImage, 0, 0);
            preset.imageData = c.toDataURL('image/png');
        } catch (e) {
            console.warn("Could not save image data (likely tainted canvas or too large):", e);
        }
    }

    // Filename generation
    let filename = 'grain-settings.json';
    if (state.isMultiImageMode && state.imageFiles[state.currentImageIndex]) {
        const baseName = state.imageFiles[state.currentImageIndex].name.replace(/\.[^/.]+$/, "");
        filename = `${baseName}-preset.json`;
    } else if (state.baseImage && state.imageFiles[0]) {
        const baseName = state.imageFiles[0].name.replace(/\.[^/.]+$/, "");
        filename = `${baseName}-preset.json`;
    }

    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

/** 
 * Parses a JSON file to restore app state.
 * logic: Checks 'jsonImportMode' to decide what to load.
 */
function uploadPreset(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
        try {
            const preset = JSON.parse(evt.target.result);
            if (!preset || (typeof preset !== 'object')) throw new Error("Invalid JSON format.");

            const mode = document.getElementById('jsonImportMode').value; // 'both', 'settings', 'image'

            const shouldLoadImage = (mode === 'both' || mode === 'image') && preset.imageData;
            const shouldLoadSettings = (mode === 'both' || mode === 'settings');

            if (shouldLoadImage) {
                const img = new Image();
                img.onload = () => {
                    loadNewImage(img);
                    if (shouldLoadSettings) {
                        restoreSettings(preset);
                        console.log(`Preset loaded successfully (Version: ${preset.metadata?.version || 'Unknown'})`);
                    }
                };
                img.onerror = () => alert("Error loading image data from JSON.");
                img.src = preset.imageData;
            } else if (shouldLoadSettings) {
                restoreSettings(preset);
                console.log(`Settings loaded successfully (Version: ${preset.metadata?.version || 'Unknown'})`);
            }
        } catch (err) {
            console.error("Preset upload failed:", err);
            alert("Error loading JSON: " + err.message);
        }
        // Reset input so the same file can be uploaded again if needed
        e.target.value = '';
    };
    reader.readAsText(file);
}

function restoreSettings(preset) {
    if (preset.metadata && preset.metadata.version !== APP_VERSION) {
        console.warn(`Version mismatch: Preset is ${preset.metadata.version}, App is ${APP_VERSION}. Attempting to restore anyway.`);
    }

    // [MULTI-INSTANCE JSON FIX] 1. Rebuild Layer Structure First
    // Clean up any currently existing duplicate layers
    state.renderOrder.slice().forEach(id => {
        const { index } = parseInstanceId(id);
        if (index > 0) removeLayerInstance(id);
    });

    // Generate any required duplicate layers from the preset
    if (preset.renderOrder) {
        preset.renderOrder.forEach(id => {
            const { baseType, index } = parseInstanceId(id);
            if (index > 0) {
                // Ensure UI elements are created before setting values
                if (typeof createLayerInstance === 'function') {
                    const newPanel = createLayerInstance(baseType, index);
                    if (newPanel) bindDynamicControls(newPanel);
                }
            }
        });

        // Re-collect UI elements after generation
        document.querySelectorAll('input, select, button, canvas').forEach(el => {
            if (el.id) _UI_BASE[el.id] = el;
        });
    }

    // [MULTI-INSTANCE JSON FIX] 2. Apply values (sliders) after UI is guaranteed to exist
    if (preset.values) {
        Object.keys(preset.values).forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.value = preset.values[id];
                // Sync adjacent text indicator
                if (el.nextElementSibling && el.nextElementSibling.classList.contains('control-value')) {
                    el.nextElementSibling.value = preset.values[id];
                }
                el.dispatchEvent(new Event('input'));
                el.dispatchEvent(new Event('change'));
            }
        });
    }
    // Apply checkboxes
    if (preset.checks) {
        Object.keys(preset.checks).forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.checked = preset.checks[id];
                el.dispatchEvent(new Event('change'));
            }
        });
    }
    // Apply selects
    if (preset.selects) {
        Object.keys(preset.selects).forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.value = preset.selects[id];
                el.dispatchEvent(new Event('change'));
            }
        });
    }

    // Apply Core State
    if (preset.renderOrder) {
        // Now safely inject the entire order back
        state.renderOrder = preset.renderOrder;
        setupDragLayerList();
    }
    if (preset.layerVisibility) {
        state.layerVisibility = preset.layerVisibility;
        setupDragLayerList();
    }
    if (preset.upscaleFactor) {
        state.upscaleFactor = preset.upscaleFactor;
        if (UI.upscaleInput) UI.upscaleInput.value = preset.upscaleFactor;
    }
    if (preset.caCenter) {
        state.caCenter = preset.caCenter;
        updatePinPosition();
    }
    if (preset.palette) {
        state.palette = preset.palette;
        updatePaletteUI();
    }

    requestRender();
}

// --- MULTI-IMAGE FUNCTIONS ---

async function loadFolder() {
    try {
        const dirHandle = await window.showDirectoryPicker();
        const imageFiles = [];
        const allFiles = [];

        async function scan(handle, path = "") {
            for await (const entry of handle.values()) {
                if (entry.kind === 'file') {
                    const file = await entry.getFile();
                    file.relativePath = path; // Store for export
                    allFiles.push(file);
                    if (file.type.startsWith('image/')) {
                        imageFiles.push(file);
                    }
                } else if (entry.kind === 'directory') {
                    await scan(entry, path + entry.name + "/");
                }
            }
        }

        UI.loading.textContent = 'SCANNING FOLDER...';
        UI.loading.style.display = 'block';
        await scan(dirHandle);
        UI.loading.style.display = 'none';

        if (imageFiles.length > 0) {
            state.imageFiles = imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
            state.allFiles = allFiles; // Store all files for replica export
            state.isMultiImageMode = true;
            state.currentImageIndex = 0;
            await loadImageFromFile(state.imageFiles[0]);
            updateUIMode();
        } else {
            alert('No images found in the selected folder.');
        }
    } catch (err) {
        console.error('Error loading folder:', err);
        UI.loading.style.display = 'none';
        if (err.name !== 'AbortError') {
            alert('Could not load folder. Please ensure your browser supports the File System Access API and you have granted permission.');
        }
    }
}

async function changeImage(direction) {
    if (!state.isMultiImageMode || state.imageFiles.length === 0) return;

    let newIndex = state.currentImageIndex + direction;

    if (newIndex < 0) return;
    if (newIndex >= state.imageFiles.length) return;

    state.currentImageIndex = newIndex;
    await loadImageFromFile(state.imageFiles[state.currentImageIndex]);
    updateUIMode();
}

async function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.src = url;
        img.onload = () => {
            loadNewImage(img);
            URL.revokeObjectURL(url);
            resolve();
        };
        img.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(err);
        };
    });
}

function updateUIMode() {
    const nav = document.getElementById('image-navigation');
    const scrubber = UI.imageScrubber;
    if (state.isMultiImageMode && state.imageFiles.length > 1) {
        nav.style.display = 'flex';
        UI.imageCounter.textContent = `Image ${state.currentImageIndex + 1} of ${state.imageFiles.length}`;
        UI.downloadBtn.textContent = `DOWNLOAD ALL (${state.imageFiles.length})`;
        scrubber.max = state.imageFiles.length - 1;
        scrubber.value = state.currentImageIndex;
        if (UI.downloadCurrentBtn) UI.downloadCurrentBtn.style.display = 'block';
    } else {
        nav.style.display = 'none';
        UI.downloadBtn.textContent = 'DOWNLOAD FULL RES';
        if (UI.downloadCurrentBtn) UI.downloadCurrentBtn.style.display = 'none';
    }

    if (state.imageFiles.length > 1) {
        UI.prevImageBtn.disabled = state.currentImageIndex === 0;
        UI.nextImageBtn.disabled = state.currentImageIndex === state.imageFiles.length - 1;
    }
}

async function downloadSingleImage() {
    UI.loading.textContent = 'PROCESSING GPU...';
    UI.loading.style.display = 'block';
    await new Promise(r => setTimeout(r, 50));

    reallocateBuffers(true);
    renderFrame(true);

    const link = document.createElement('a');
    const originalName = state.isMultiImageMode ? state.imageFiles[state.currentImageIndex].name.split('.')[0] : 'grain-export';
    link.download = `${originalName}-processed.png`;
    link.href = state.canvas.toDataURL('image/png', 1.0);
    link.click();

    reallocateBuffers(false);
    requestRender();
    UI.loading.style.display = 'none';
}

async function downloadAllImages() {
    let dirHandle;
    try {
        dirHandle = await window.showDirectoryPicker();
    } catch (err) {
        if (err.name === 'AbortError') return;
        alert('Could not open directory. Permission denied.');
        return;
    }

    state.isExporting = true;
    const overlay = UI['export-overlay'];
    overlay.style.display = 'flex';

    const stopExportHandler = () => {
        state.isExporting = false;
    };
    UI.stopExportBtn.addEventListener('click', stopExportHandler);

    const originalIndex = state.currentImageIndex;
    const filesToExport = state.keepFolderStructure ? state.allFiles : state.imageFiles;

    try {
        for (let i = 0; i < filesToExport.length; i++) {
            if (!state.isExporting) {
                alert('Export cancelled.');
                break;
            }

            const file = filesToExport[i];
            UI['export-status'].textContent = `EXPORTING ${i + 1}/${filesToExport.length}...`;

            try {
                let targetDir = dirHandle;
                if (state.keepFolderStructure && file.relativePath) {
                    const parts = file.relativePath.split("/").filter(p => p !== "");
                    for (const part of parts) {
                        targetDir = await targetDir.getDirectoryHandle(part, { create: true });
                    }
                }

                // Check if this file is one of the images we should process
                const isProcessableImage = state.imageFiles.includes(file);

                if (isProcessableImage) {
                    await loadImageFromFile(file);
                    reallocateBuffers(true);
                    renderFrame(true);

                    const blob = await new Promise(resolve => state.canvas.toBlob(resolve, 'image/png'));
                    const exportName = state.keepFolderStructure ? file.name : `${i + 1}.png`;
                    const fileHandle = await targetDir.getFileHandle(exportName, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                } else if (state.keepFolderStructure) {
                    // Non-image file or non-processable: Copy directly
                    const fileHandle = await targetDir.getFileHandle(file.name, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(file);
                    await writable.close();
                }
            } catch (err) {
                console.error(`Error exporting ${file.name}:`, err);
            }
            await new Promise(r => setTimeout(r, 10)); // Yield to main thread
        }
        if (state.isExporting) {
            alert(`Export Complete. Processed ${state.imageFiles.length} images and copied ${state.allFiles.length - state.imageFiles.length} other files.`);
        }
    } finally {
        state.isExporting = false;
        overlay.style.display = 'none';
        UI.stopExportBtn.removeEventListener('click', stopExportHandler);

        // Restore to the image that was active before downloading
        await loadImageFromFile(state.imageFiles[originalIndex]);
        state.currentImageIndex = originalIndex;
        updateUIMode();
        reallocateBuffers(false);
        requestRender();
    }
}


// --- DRAG LAYER LIST ---
/** 
 * Manages the 'Render Layer Order' tab.
 * logic: Uses native HTML5 Drag and Drop to reorder the 'state.renderOrder' array.
 * UI Pointer: Referenced as 'tab-layers' in the HTML.
 */
function setupDragLayerList() {
    const list = document.getElementById('layer-drag-list');
    list.innerHTML = '';

    // [SYNC] Ensure all valid base layers from LAYERS are in renderOrder
    const validBaseTypes = Object.keys(LAYERS).filter(k => k !== 'shadows' && k !== 'highlights');
    validBaseTypes.forEach(key => {
        // Only add if no instance of this base type exists yet
        const hasInstance = state.renderOrder.some(id => parseInstanceId(id).baseType === key);
        if (!hasInstance) {
            state.renderOrder.push(key);
            if (state.layerVisibility[key] === undefined) state.layerVisibility[key] = true;
        }
    });

    // Remove stale keys (base type must exist in LAYERS)
    state.renderOrder = state.renderOrder.filter(id => {
        const { baseType } = parseInstanceId(id);
        return validBaseTypes.includes(baseType);
    });

    state.renderOrder.forEach((instanceId, index) => {
        const { baseType, index: instIdx } = parseInstanceId(instanceId);
        const div = document.createElement('div');
        div.className = 'drag-layer';
        div.draggable = true;
        div.dataset.key = instanceId;

        const isChecked = (state.layerVisibility[instanceId] ?? state.layerVisibility[baseType] ?? true) ? 'checked' : '';
        const displayName = LAYERS[baseType]?.name || baseType;
        const instanceLabel = instIdx > 0 ? ` (${instIdx + 1})` : '';

        div.innerHTML = `
            <div style="display:flex; align-items:center;">
                <span class="drag-handle">☰</span> 
                <input type="checkbox" class="drag-toggle" data-key="${instanceId}" ${isChecked}>
            </div>
            <span>${displayName}${instanceLabel}</span>
            ${instIdx > 0 ? `<button class="remove-instance-btn" data-instance="${instanceId}" title="Remove this duplicate" style="margin-left:auto; background:none; border:none; color:#ff5555; cursor:pointer; font-size:14px; padding:2px 6px;">✕</button>` : ''}
        `;

        div.querySelector('input').addEventListener('change', (e) => {
            state.layerVisibility[instanceId] = e.target.checked;
            requestRender();
        });

        // Remove button for duplicates
        const removeBtn = div.querySelector('.remove-instance-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeLayerInstance(instanceId);
            });
        }

        div.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', index);
            div.classList.add('dragging');
        });

        div.addEventListener('dragend', () => div.classList.remove('dragging'));

        div.addEventListener('dragover', (e) => e.preventDefault());

        div.addEventListener('drop', (e) => {
            e.preventDefault();
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const toIndex = index;
            if (fromIndex === toIndex) return;

            const item = state.renderOrder.splice(fromIndex, 1)[0];
            state.renderOrder.splice(toIndex, 0, item);

            setupDragLayerList();
            setupLayerGridDOM();
            requestRender();
        });

        list.appendChild(div);
    });

    // [MULTI-INSTANCE] "Add Layer" dropdown at bottom
    const addRow = document.createElement('div');
    addRow.style.cssText = 'display:flex; gap:5px; margin-top:10px; align-items:center;';

    const select = document.createElement('select');
    select.style.cssText = 'flex:1; background:var(--bg-secondary); color:var(--text); border:1px solid var(--border); padding:4px; font-size:11px;';
    select.innerHTML = '<option value="">— Select Layer to Add —</option>';
    validBaseTypes.forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = LAYERS[key]?.name || key;
        select.appendChild(opt);
    });

    const addBtn = document.createElement('button');
    addBtn.textContent = '+ ADD';
    addBtn.style.cssText = 'padding:4px 10px; font-size:11px; background:var(--accent); color:#000; border:none; cursor:pointer;';
    addBtn.addEventListener('click', () => {
        if (select.value) {
            addLayerInstance(select.value);
            select.value = '';
        }
    });

    addRow.appendChild(select);
    addRow.appendChild(addBtn);
    list.appendChild(addRow);
}

/**
 * [MULTI-INSTANCE] Adds a new instance of the specified layer type.
 * Creates suffixed UI controls and inserts into render order.
 */
function addLayerInstance(baseType) {
    // Find next available index
    const existingIndices = state.renderOrder
        .filter(id => parseInstanceId(id).baseType === baseType)
        .map(id => parseInstanceId(id).index);
    const nextIndex = Math.max(...existingIndices, 0) + 1;
    const instanceId = baseType + '__' + nextIndex;

    // Generate UI panel with suffixed IDs
    if (typeof createLayerInstance === 'function') {
        const newPanel = createLayerInstance(baseType, nextIndex);
        if (newPanel) {
            bindDynamicControls(newPanel);
        }
    }

    // Re-collect UI elements (new suffixed elements now in DOM)
    document.querySelectorAll('input, select, button, canvas').forEach(el => {
        if (el.id) _UI_BASE[el.id] = el;
    });

    // Add to render order (after the last instance of this type)
    const lastIdx = state.renderOrder.reduce((acc, id, i) =>
        parseInstanceId(id).baseType === baseType ? i : acc, -1);
    state.renderOrder.splice(lastIdx + 1, 0, instanceId);
    state.layerVisibility[instanceId] = true;

    // Refresh UI
    setupDragLayerList();
    setupLayerGridDOM();
    requestRender();
    console.log(`[Multi-Instance] Added ${instanceId}`);
}

/**
 * [MULTI-INSTANCE] Removes a layer instance and its UI controls.
 */
function removeLayerInstance(instanceId) {
    const { baseType, index } = parseInstanceId(instanceId);
    if (index === 0) return; // Cannot remove default instance

    // Remove UI panel
    if (typeof destroyLayerInstance === 'function') {
        destroyLayerInstance(baseType, index);
    }

    // Clean up suffixed UI entries
    const suffix = '__' + index;
    Object.keys(_UI_BASE).forEach(key => {
        if (key.endsWith(suffix)) delete _UI_BASE[key];
    });

    // Remove from render order
    state.renderOrder = state.renderOrder.filter(id => id !== instanceId);
    delete state.layerVisibility[instanceId];
    delete state.layerTextures[instanceId];

    // Refresh UI
    setupDragLayerList();
    setupLayerGridDOM();
    requestRender();
    console.log(`[Multi-Instance] Removed ${instanceId}`);
}

// --- RENDER LOOP MANAGER ---
/** 
 * Debounced rendering function.
 */
let renderRequested = false;
function requestRender() {
    if (!renderRequested && state.baseImage) {
        renderRequested = true;
        requestAnimationFrame(() => {
            renderFrame();
            renderRequested = false;
        });
    }
}

/**
 * Real-time Histogram Calculation
 * logic: Uses the current render output to calculate luminance distribution.
 */
function updateHistogram() {
    if (!state.gl || !state.baseImage || !UI.histogramCanvas) return;
    const gl = state.gl;

    // Read from analysis FBO (optimized small buffer)
    const w = state.analysisFBO.w;
    const h = state.analysisFBO.h;
    const totalPixels = w * h;

    // Since it's already downsampled to 256x256, we can sample most/all pixels efficiently
    const maxSamples = 10000;
    const sampleRate = Math.max(1, Math.floor(totalPixels / maxSamples));

    gl.bindFramebuffer(gl.FRAMEBUFFER, state.analysisFBO.fbo);
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    const hist = new Uint32Array(256);
    let totalLum = 0;
    let sampleCount = 0;

    // Sample pixels with dynamic rate based on image size
    const stride = sampleRate * 4;
    for (let i = 0; i < pixels.length; i += stride) {
        // Luminance (Rec. 709)
        const lum = Math.round(pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722);
        hist[lum]++;
        totalLum += lum;
        sampleCount++;
    }

    const avgLum = sampleCount > 0 ? totalLum / sampleCount : 0;
    if (UI.avgBrightnessVal) UI.avgBrightnessVal.textContent = (avgLum / 2.55).toFixed(1) + '%';
    if (UI.renderResVal) UI.renderResVal.textContent = `${state.renderWidth}x${state.renderHeight}`;

    // Draw to canvas
    const ctx = UI.histogramCanvas.getContext('2d');
    const cw = UI.histogramCanvas.width;
    const ch = UI.histogramCanvas.height;

    ctx.clearRect(0, 0, cw, ch);

    // Find max for scaling
    let max = 0;
    for (let i = 0; i < 256; i++) if (hist[i] > max) max = hist[i];

    ctx.fillStyle = '#2a9df4';
    ctx.beginPath();
    ctx.moveTo(0, ch);
    for (let i = 0; i < 256; i++) {
        const x = (i / 255) * cw;
        const h = (hist[i] / max) * ch;
        ctx.lineTo(x, ch - h);
    }
    ctx.lineTo(cw, ch);
    ctx.fill();

    // Add grid line for 50%
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(cw / 2, 0); ctx.lineTo(cw / 2, ch);
    ctx.stroke();
}

/**
 * Real-time Vectorscope Calculation
 * logic: Plots pixel colors in a circular hue/saturation space.
 */
function updateVectorscope() {
    if (!state.gl || !state.baseImage || !UI.vectorscopeCanvas) return;
    const gl = state.gl;

    // Read from analysis FBO (optimized small buffer)
    const w = state.analysisFBO.w;
    const h = state.analysisFBO.h;

    // Calculate dynamic sample rate for performance (max ~10k samples from 256x256)
    const maxSamples = 10000;
    const totalPixels = w * h;
    const sampleRate = Math.max(1, Math.floor(totalPixels / maxSamples));
    const stride = sampleRate * 4;

    gl.bindFramebuffer(gl.FRAMEBUFFER, state.analysisFBO.fbo);
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    const ctx = UI.vectorscopeCanvas.getContext('2d');
    const size = UI.vectorscopeCanvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 5;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Draw pixel data first
    let totalSat = 0;
    let sampleCount = 0;

    // Sample with dynamic stride for performance
    for (let i = 0; i < pixels.length; i += stride) {
        const r = pixels[i] / 255;
        const g = pixels[i + 1] / 255;
        const b = pixels[i + 2] / 255;

        // RGB to HSV conversion (better for vectorscope)
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;

        let h = 0, s = 0;
        if (max > 0) s = d / max; // Saturation based on max (HSV style)

        if (d > 0) {
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        totalSat += s;
        sampleCount++;

        // Skip very low saturation pixels (they clutter the center)
        if (s < 0.02) continue;

        // Convert hue/saturation to x/y coordinates
        const angle = h * Math.PI * 2 - Math.PI / 2; // Start at top (red at top)
        const dist = s * radius;
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;

        // Draw a small colored dot
        ctx.fillStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, 0.4)`;
        ctx.fillRect(x - 1, y - 1, 2, 2);
    }

    // Draw reference circles AFTER pixels (so they're visible on top)
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.25, 0, Math.PI * 2);
    ctx.stroke();

    // Draw crosshairs
    ctx.beginPath();
    ctx.moveTo(cx, 0); ctx.lineTo(cx, size);
    ctx.moveTo(0, cy); ctx.lineTo(size, cy);
    ctx.stroke();

    // Update saturation stat
    const avgSat = sampleCount > 0 ? (totalSat / sampleCount) * 100 : 0;
    if (UI.avgSaturationVal) UI.avgSaturationVal.textContent = avgSat.toFixed(1) + '%';
}

// --- WEBGL CORE ---
/** 
 * Initializes the WebGL2 context, compiles all shaders, and sets up 
 * the static full-screen quad geometry (VBO).
 */
async function initWebGL() {
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

    state.canvas.addEventListener('webglcontextrestored', async () => {
        console.log("WebGL Context Restored. Re-initializing...");
        await initWebGL();
        if (state.baseImage) {
            reallocateBuffers(false);
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

    // [SHADER COMPILATION] Load manifest and compile all shaders from .frag files
    console.log('[Engine] Loading shader manifest...');
    const manifest = await fetch('Shaders/manifest.json').then(r => r.json());

    // Fetch vertex shader (shared by all programs)
    const vsSrc = await fetchShaderSource(manifest.vertex);
    console.log(`[Engine] Vertex shader loaded from ${manifest.vertex}`);

    // Fetch ALL fragment shaders in parallel for speed
    const programNames = Object.keys(manifest.programs);
    const fragSources = await Promise.all(
        programNames.map(name => fetchShaderSource(manifest.programs[name].frag))
    );
    console.log(`[Engine] ${programNames.length} fragment shaders loaded`);

    // Compile all programs
    state.programs = {};
    programNames.forEach((name, i) => {
        state.programs[name] = createProgramFromSources(gl, vsSrc, fragSources[i], 'vs-quad', name);
        if (!state.programs[name]) {
            console.error(`[Engine] FAILED to compile program: ${name}`);
        }
    });

    // Map manifest program names to the keys the render pipeline expects
    if (state.programs.lightleaks && !state.programs.lightLeaks) {
        state.programs.lightLeaks = state.programs.lightleaks;
    }
    if (state.programs.lens && !state.programs.lensDistort) {
        state.programs.lensDistort = state.programs.lens;
    }
    if (state.programs.analog && !state.programs.analogVideo) {
        state.programs.analogVideo = state.programs.analog;
    }

    console.log(`[Engine] ${Object.keys(state.programs).length} shader programs compiled`);

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

function loadNewImage(img) {
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
}

/** 
 * Resizes all internal offscreen textures to match current viewport or upscale factor.
 * Logic: Deletes old FBOs and re-initializes them at the new 'targetW/H'.
 * Reference: Uses 'state.upscaleFactor' to determine final buffer dimensions.
 */
function reallocateBuffers(fullRes = false) {
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

// --- LAYER LOGIC EXTRACTOR ---
/** 
 * The core of the render pipeline.
 * logic: Dynamically selects the appropriate shader and uniform set for a given layer.
 * Pass-through: Takes 'inputTex' and writes result to 'outputFbo'.
 * @param {string} key - The ID of the layer (e.g. 'noise', 'blur').
 */
function renderSingleLayer(gl, key, inputTex, outputFbo, uniforms, force = false) {
    const w = state.renderWidth;
    const h = state.renderHeight;
    gl.viewport(0, 0, w, h);

    if (key === 'adjust') {
        // [TOOL: ADJUSTMENTS] Color, Sharpening, Brightness
        if (!UI.adjustEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }
        let maskTex = null;
        const hasSH = UI.adjLumaMask?.checked;
        const hasCol = UI.adjColorExclude?.checked;

        if (hasSH || hasCol) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.blur1);
            gl.clearColor(1, 1, 1, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.DST_COLOR, gl.ZERO);

            if (hasSH) {
                gl.useProgram(state.programs.mask);
                gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                gl.uniform1i(gl.getUniformLocation(state.programs.mask, 'u_tex'), 0);
                gl.uniform1i(gl.getUniformLocation(state.programs.mask, 'u_useS'), 1);
                gl.uniform1f(gl.getUniformLocation(state.programs.mask, 'u_sth'), parseFloat(UI.adjShadowThreshold?.value || 0));
                gl.uniform1f(gl.getUniformLocation(state.programs.mask, 'u_sfa'), parseFloat(UI.adjShadowFade?.value || 0));
                gl.uniform1i(gl.getUniformLocation(state.programs.mask, 'u_useH'), 1);
                gl.uniform1f(gl.getUniformLocation(state.programs.mask, 'u_hth'), parseFloat(UI.adjHighlightThreshold?.value || 1));
                gl.uniform1f(gl.getUniformLocation(state.programs.mask, 'u_hfa'), parseFloat(UI.adjHighlightFade?.value || 0));
                gl.drawArrays(gl.TRIANGLES, 0, 6);
            }
            if (hasCol) {
                const targetColor = UI.adjExcludeColor?.value || '#000000';
                const r = parseInt(targetColor.slice(1, 3), 16) / 255;
                const g = parseInt(targetColor.slice(3, 5), 16) / 255;
                const b = parseInt(targetColor.slice(5, 7), 16) / 255;
                gl.useProgram(state.programs.colorMask);
                gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                gl.uniform1i(gl.getUniformLocation(state.programs.colorMask, 'u_tex'), 0);
                gl.uniform3f(gl.getUniformLocation(state.programs.colorMask, 'u_targetColor'), r, g, b);
                gl.uniform1f(gl.getUniformLocation(state.programs.colorMask, 'u_tolerance'), parseFloat(UI.adjColorTolerance?.value || 10) / 100.0);
                gl.uniform1f(gl.getUniformLocation(state.programs.colorMask, 'u_fade'), parseFloat(UI.adjColorFade?.value || 0) / 100.0);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
            }
            gl.disable(gl.BLEND);
            maskTex = state.textures.blur1;

            if (maskTex && UI.adjInvertMask?.checked) {
                gl.useProgram(state.programs.invert);
                gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.blur2);
                gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, maskTex);
                gl.uniform1i(gl.getUniformLocation(state.programs.invert, 'u_tex'), 0);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
                maskTex = state.textures.blur2;
            }
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        const prog = state.programs.adjustMasked || state.programs.adjust;
        gl.useProgram(prog);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTex);

        gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_bright'), uniforms.u_bright);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_cont'), uniforms.u_cont);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_sat'), uniforms.u_sat);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_hdrTol'), 0.0);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_hdrAmt'), 0.0);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_warmth'), uniforms.u_warmth);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_sharp'), uniforms.u_sharp);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_sharpThresh'), uniforms.u_sharpThresh);
        gl.uniform2f(gl.getUniformLocation(prog, 'u_step'), uniforms.u_step[0], uniforms.u_step[1]);

        if (maskTex && prog) {
            gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskTex);
            gl.uniform1i(gl.getUniformLocation(prog, 'u_mask'), 1);
            gl.uniform1i(gl.getUniformLocation(prog, 'u_useMask'), 1);
        } else if (prog) {
            gl.uniform1i(gl.getUniformLocation(prog, 'u_useMask'), 0);
        }

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        return outputFbo; // Effectively specific texture attached to this FBO
    }
    else if (key === 'hdr') {
        // [TOOL: HDR EMULATION] Luminance Compression
        if (!UI.hdrEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.useProgram(state.programs.adjust);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.adjust, 'u_tex'), 0);
        gl.uniform1f(gl.getUniformLocation(state.programs.adjust, 'u_bright'), 0.0);
        gl.uniform1f(gl.getUniformLocation(state.programs.adjust, 'u_cont'), 0.0);
        gl.uniform1f(gl.getUniformLocation(state.programs.adjust, 'u_sat'), 0.0);
        gl.uniform1f(gl.getUniformLocation(state.programs.adjust, 'u_warmth'), 0.0);
        gl.uniform1f(gl.getUniformLocation(state.programs.adjust, 'u_sharp'), 0.0);
        gl.uniform1f(gl.getUniformLocation(state.programs.adjust, 'u_hdrTol'), uniforms.u_hdrTol);
        gl.uniform1f(gl.getUniformLocation(state.programs.adjust, 'u_hdrAmt'), uniforms.u_hdrAmt);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
    }
    else if (key === 'noise') {
        // [TOOL: NOISE GROUP] Procedural Grain & Compositing
        if (!UI.noiseEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }
        gl.useProgram(state.programs.noise);
        gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.tempNoise);
        gl.uniform1i(gl.getUniformLocation(state.programs.noise, 'u_type'), parseInt(UI.noiseType.value));
        gl.uniform1f(gl.getUniformLocation(state.programs.noise, 'u_seed'), Math.random() * 100.0);
        gl.uniform2f(gl.getUniformLocation(state.programs.noise, 'u_res'), w, h);
        gl.uniform2f(gl.getUniformLocation(state.programs.noise, 'u_origRes'), state.width * state.upscaleFactor, state.height * state.upscaleFactor);
        gl.uniform1f(gl.getUniformLocation(state.programs.noise, 'u_scale'), parseFloat(UI.noiseSize.value));
        gl.uniform1f(gl.getUniformLocation(state.programs.noise, 'u_paramA'), parseFloat(UI.noiseParamA?.value || 0) / 100.0);
        gl.uniform1f(gl.getUniformLocation(state.programs.noise, 'u_paramB'), parseFloat(UI.noiseParamB?.value || 0) / 100.0);
        gl.uniform1f(gl.getUniformLocation(state.programs.noise, 'u_paramC'), parseFloat(UI.noiseParamC?.value || 0) / 100.0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        const blurAmt = parseFloat(UI.blurriness.value) / 100.0;
        let noiseTex = state.textures.tempNoise;
        if (blurAmt > 0) {
            gl.useProgram(state.programs.blur);
            gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.blur1);
            gl.bindTexture(gl.TEXTURE_2D, state.textures.tempNoise);
            gl.uniform1i(gl.getUniformLocation(state.programs.blur, 'u_tex'), 0);
            gl.uniform2f(gl.getUniformLocation(state.programs.blur, 'u_dir'), 1.0 / w, 0.0);
            gl.uniform1f(gl.getUniformLocation(state.programs.blur, 'u_rad'), blurAmt * 2.0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.blur2);
            gl.bindTexture(gl.TEXTURE_2D, state.textures.blur1);
            gl.uniform2f(gl.getUniformLocation(state.programs.blur, 'u_dir'), 0.0, 1.0 / h);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            noiseTex = state.textures.blur2;
        }
        const maskTex = renderMaskForLayer(gl, inputTex, 'noise');

        // Composite
        gl.useProgram(state.programs.composite);
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, noiseTex);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, maskTex || state.textures.white); // Fallback to white if no mask

        gl.uniform1i(gl.getUniformLocation(state.programs.composite, 'u_base'), 0);
        gl.uniform1i(gl.getUniformLocation(state.programs.composite, 'u_noise'), 1);
        gl.uniform1i(gl.getUniformLocation(state.programs.composite, 'u_mask'), 2);
        gl.uniform1i(gl.getUniformLocation(state.programs.composite, 'u_mode'), parseInt(UI.blendMode.value));
        gl.uniform1f(gl.getUniformLocation(state.programs.composite, 'u_opacity'), parseFloat(UI.opacity.value));
        gl.uniform1f(gl.getUniformLocation(state.programs.composite, 'u_str'), parseFloat(UI.strength.value));
        gl.uniform1i(gl.getUniformLocation(state.programs.composite, 'u_nType'), parseInt(UI.noiseType.value));
        gl.uniform1f(gl.getUniformLocation(state.programs.composite, 'u_satStr'), parseFloat(UI.satStrength.value));
        gl.uniform1f(gl.getUniformLocation(state.programs.composite, 'u_satImp'), parseFloat(UI.satPerNoise.value));
        gl.uniform1f(gl.getUniformLocation(state.programs.composite, 'u_skinProt'), parseFloat(UI.skinProtection.value));
        gl.uniform1i(gl.getUniformLocation(state.programs.composite, 'u_ignA'), UI.ignoreAlphaToggle.checked ? 1 : 0);
        gl.uniform1f(gl.getUniformLocation(state.programs.composite, 'u_ignAstr'), parseFloat(UI.ignoreAlphaStrength.value));

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    else if (key === 'ca') {
        // [TOOL: CHROMATIC ABERRATION] Lens Fringing
        if (!UI.caEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.useProgram(state.programs.chroma);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.chroma, 'u_tex'), 0);
        gl.uniform1f(gl.getUniformLocation(state.programs.chroma, 'u_amt'), uniforms.u_ca_amt);
        gl.uniform1f(gl.getUniformLocation(state.programs.chroma, 'u_blur'), uniforms.u_ca_blur);
        gl.uniform1f(gl.getUniformLocation(state.programs.chroma, 'u_zoomBlur'), parseFloat(UI.aberrationZoomBlur.value) / 50.0);
        gl.uniform2f(gl.getUniformLocation(state.programs.chroma, 'u_center'), uniforms.u_ca_center[0], uniforms.u_ca_center[1]);
        gl.uniform1f(gl.getUniformLocation(state.programs.chroma, 'u_radius'), uniforms.u_ca_rad);
        gl.uniform1f(gl.getUniformLocation(state.programs.chroma, 'u_falloff'), uniforms.u_ca_fall);
        gl.uniform1i(gl.getUniformLocation(state.programs.chroma, 'u_falloffToBlur'), UI.caFalloffToBlur.checked ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    else if (key === 'blur') {
        // [TOOL: BLUR] Masked Gaussian/Box/Motion Blur
        if (!UI.blurEnable?.checked) {
            // Pass-through copy if needed, but often we just skip.
            // If we need to write to outputFbo to maintain chain:
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }

        const maskTex = renderMaskForLayer(gl, inputTex, 'blur');
        const blurAmt = parseFloat(UI.blurAmount?.value || 0) / 100.0;
        if (blurAmt > 0) {
            const prog = maskTex ? state.programs.maskedBlur : state.programs.blur;
            gl.useProgram(prog);
            // H Pass
            gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.blur2);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
            gl.uniform2f(gl.getUniformLocation(prog, 'u_dir'), 1.0 / w, 0.0);
            gl.uniform1f(gl.getUniformLocation(prog, 'u_rad'), blurAmt * 2.0);
            gl.uniform1i(gl.getUniformLocation(prog, 'u_blurType'), parseInt(UI.blurType?.value || 0));

            if (maskTex) {
                gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskTex);
                gl.uniform1i(gl.getUniformLocation(prog, 'u_mask'), 1);
            }
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            // V Pass
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, state.textures.blur2);
            gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
            gl.uniform2f(gl.getUniformLocation(prog, 'u_dir'), 0.0, 1.0 / h);
            gl.uniform1f(gl.getUniformLocation(prog, 'u_rad'), blurAmt * 2.0);
            gl.uniform1i(gl.getUniformLocation(prog, 'u_blurType'), parseInt(UI.blurType?.value || 0));

            if (maskTex) {
                gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskTex);
                gl.uniform1i(gl.getUniformLocation(prog, 'u_mask'), 1);
            }
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        } else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
    }
    else if (key === 'cell') {
        // [TOOL: CELL SHADING] Posterization & Outlines
        if (!UI.cellEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.useProgram(state.programs.cell);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.cell, 'u_tex'), 0);
        gl.uniform2f(gl.getUniformLocation(state.programs.cell, 'u_res'), w, h);
        gl.uniform1i(gl.getUniformLocation(state.programs.cell, 'u_levels'), parseInt(UI.cellLevels?.value || 4));
        gl.uniform1f(gl.getUniformLocation(state.programs.cell, 'u_bias'), parseFloat(UI.cellBias?.value || 0));
        gl.uniform1f(gl.getUniformLocation(state.programs.cell, 'u_gamma'), parseFloat(UI.cellGamma?.value || 1));
        gl.uniform1i(gl.getUniformLocation(state.programs.cell, 'u_quantMode'), parseInt(UI.cellQuantMode?.value || 0));
        gl.uniform1i(gl.getUniformLocation(state.programs.cell, 'u_bandMap'), parseInt(UI.cellBandMap?.value || 0));
        gl.uniform1i(gl.getUniformLocation(state.programs.cell, 'u_edgeMethod'), parseInt(UI.cellEdgeMethod?.value || 0));
        gl.uniform1f(gl.getUniformLocation(state.programs.cell, 'u_edgeStr'), parseFloat(UI.cellEdgeStr?.value || 1));
        gl.uniform1f(gl.getUniformLocation(state.programs.cell, 'u_edgeThick'), parseFloat(UI.cellEdgeThick?.value || 1));
        gl.uniform1i(gl.getUniformLocation(state.programs.cell, 'u_colorPreserve'), UI.cellColorPreserve?.checked ? 1 : 0);
        gl.uniform1i(gl.getUniformLocation(state.programs.cell, 'u_edgeEnable'), UI.cellEdgeEnable?.checked ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    else if (key === 'halftone') {
        // [TOOL: HALFTONING] Simulated Print Screen
        if (!UI.halftoneEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.useProgram(state.programs.halftone);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.halftone, 'u_tex'), 0);
        gl.uniform2f(gl.getUniformLocation(state.programs.halftone, 'u_res'), w, h);
        gl.uniform1f(gl.getUniformLocation(state.programs.halftone, 'u_size'), parseFloat(UI.halftoneSize?.value || 4));
        gl.uniform1f(gl.getUniformLocation(state.programs.halftone, 'u_intensity'), parseFloat(UI.halftoneIntensity?.value || 1));
        gl.uniform1f(gl.getUniformLocation(state.programs.halftone, 'u_sharpness'), parseFloat(UI.halftoneSharpness?.value || 1));
        gl.uniform1i(gl.getUniformLocation(state.programs.halftone, 'u_pattern'), parseInt(UI.halftonePattern?.value || 0));
        gl.uniform1i(gl.getUniformLocation(state.programs.halftone, 'u_colorMode'), parseInt(UI.halftoneColorMode?.value || 0));
        gl.uniform1i(gl.getUniformLocation(state.programs.halftone, 'u_sample'), parseInt(UI.halftoneSample?.value || 1));
        gl.uniform1i(gl.getUniformLocation(state.programs.halftone, 'u_gray'), UI.halftoneGray?.checked ? 1 : 0);
        gl.uniform1i(gl.getUniformLocation(state.programs.halftone, 'u_lock'), UI.halftoneScreenLock?.checked ? 1 : 0);
        gl.uniform1i(gl.getUniformLocation(state.programs.halftone, 'u_invert'), UI.halftoneInvert?.checked ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    else if (key === 'bilateral') {
        // [TOOL: BILATERAL FILTER] Skin Smoothing
        if (!UI.bilateralEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }
        const iters = Math.max(1, parseInt(UI.bilateralIter?.value || 1));
        gl.useProgram(state.programs.bilateral);
        gl.uniform2f(gl.getUniformLocation(state.programs.bilateral, 'u_res'), w, h);
        gl.uniform1i(gl.getUniformLocation(state.programs.bilateral, 'u_radius'), parseInt(UI.bilateralRadius?.value || 2));
        gl.uniform1f(gl.getUniformLocation(state.programs.bilateral, 'u_sigmaCol'), parseFloat(UI.bilateralColorSig?.value || 0.1));
        gl.uniform1f(gl.getUniformLocation(state.programs.bilateral, 'u_sigmaSpace'), parseFloat(UI.bilateralSpatialSig?.value || 2));
        gl.uniform1i(gl.getUniformLocation(state.programs.bilateral, 'u_kernel'), parseInt(UI.bilateralKernel?.value || 0));
        gl.uniform1i(gl.getUniformLocation(state.programs.bilateral, 'u_edgeMode'), parseInt(UI.bilateralEdgeMode?.value || 0));

        // Single pass for now as logic for pingpong inside here is complex without new FBOs
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.bilateral, 'u_tex'), 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    else if (key === 'denoise') {
        // [TOOL: DENOISING] NLM / Median / Mean
        if (!UI.denoiseEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }

        const maskTex = renderMaskForLayer(gl, inputTex, 'denoise');
        const prog = state.programs.denoise;
        gl.useProgram(prog);
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
        gl.uniform2f(gl.getUniformLocation(prog, 'u_res'), w, h);
        gl.uniform1i(gl.getUniformLocation(prog, 'u_mode'), parseInt(UI.denoiseMode?.value || 0));
        gl.uniform1i(gl.getUniformLocation(prog, 'u_searchRadius'), parseInt(UI.denoiseSearchRadius?.value || 5));
        gl.uniform1i(gl.getUniformLocation(prog, 'u_patchRadius'), parseInt(UI.denoisePatchRadius?.value || 2));
        gl.uniform1f(gl.getUniformLocation(prog, 'u_h'), parseFloat(UI.denoiseH?.value || 0.5));
        gl.uniform1f(gl.getUniformLocation(prog, 'u_strength'), parseFloat(UI.denoiseBlend?.value || 100) / 100.0);

        if (maskTex) {
            gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskTex);
            gl.uniform1i(gl.getUniformLocation(prog, 'u_mask'), 1);
            gl.uniform1i(gl.getUniformLocation(prog, 'u_useMask'), 1);
        } else {
            gl.uniform1i(gl.getUniformLocation(prog, 'u_useMask'), 0);
        }

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    else if (key === 'dither') {
        // [TOOL: DITHERING] Bit-depth Reduction
        if (!UI.ditherEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }

        const maskTex = renderMaskForLayer(gl, inputTex, 'dither');
        const prog = maskTex ? state.programs.maskedDither : state.programs.dither;
        gl.useProgram(prog);

        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
        gl.uniform1i(gl.getUniformLocation(prog, 'u_type'), parseInt(UI.ditherType?.value || 0));
        gl.uniform1f(gl.getUniformLocation(prog, 'u_bitDepth'), parseFloat(UI.ditherBitDepth.value));
        gl.uniform1f(gl.getUniformLocation(prog, 'u_strength'), parseFloat(UI.ditherStrength.value) / 100.0);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_scale'), parseFloat(UI.ditherScale.value));
        gl.uniform2f(gl.getUniformLocation(prog, 'u_res'), w, h);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_seed'), Math.random() * 100.0);
        gl.uniform1i(gl.getUniformLocation(prog, 'u_gamma'), UI.ditherGamma?.checked ? 1 : 0);

        const usePalette = UI.ditherUsePalette?.checked ? 1 : 0;
        gl.uniform1i(gl.getUniformLocation(prog, 'u_usePalette'), usePalette);

        if (usePalette) {
            const paletteRgb = state.palette.map(hexToRgb);
            const flatPalette = new Float32Array(256 * 3);
            paletteRgb.forEach((rgb, i) => {
                flatPalette[i * 3] = rgb[0] / 255;
                flatPalette[i * 3 + 1] = rgb[1] / 255;
                flatPalette[i * 3 + 2] = rgb[2] / 255;
            });
            gl.uniform3fv(gl.getUniformLocation(prog, 'u_customPalette'), flatPalette);
            gl.uniform1f(gl.getUniformLocation(prog, 'u_paletteSize'), paletteRgb.length);
        } else {
            gl.uniform1f(gl.getUniformLocation(prog, 'u_paletteSize'), parseFloat(UI.ditherPaletteSize.value));
        }

        if (maskTex) {
            gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskTex);
            gl.uniform1i(gl.getUniformLocation(prog, 'u_mask'), 1);
        }

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    else if (key === 'corruption') {
        // [TOOL: CORRUPTION] Glitch & Block Artifacts
        if (!UI.corruptionEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.useProgram(state.programs.corruption);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.corruption, 'u_tex'), 0);
        gl.uniform1i(gl.getUniformLocation(state.programs.corruption, 'u_algorithm'), parseInt(UI.corruptionAlgorithm?.value || 0));
        gl.uniform1f(gl.getUniformLocation(state.programs.corruption, 'u_resScale'), parseFloat(UI.corruptionResScale?.value || 1));
        gl.uniform2f(gl.getUniformLocation(state.programs.corruption, 'u_res'), w, h);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    else if (key === 'analogVideo') {
        if (!UI.analogVideoEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.useProgram(state.programs.analogVideo);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.analogVideo, 'u_tex'), 0);
        gl.uniform1f(gl.getUniformLocation(state.programs.analogVideo, 'u_time'), uniforms.u_time);
        gl.uniform1f(gl.getUniformLocation(state.programs.analogVideo, 'u_wobble'), uniforms.u_analog_wobble);
        gl.uniform1f(gl.getUniformLocation(state.programs.analogVideo, 'u_bleed'), uniforms.u_analog_bleed);
        gl.uniform1f(gl.getUniformLocation(state.programs.analogVideo, 'u_curve'), uniforms.u_analog_curve);
        gl.uniform1f(gl.getUniformLocation(state.programs.analogVideo, 'u_noise'), uniforms.u_analog_noise);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // If animated params > 0, we need to keep rendering frames
        if (uniforms.u_analog_wobble > 0 || uniforms.u_analog_noise > 0) {
            requestRender(); // Force continuous rendering for animation
        }
    }
    else if (key === 'lensDistort') {
        if (!UI.lensDistortEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.useProgram(state.programs.lensDistort);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.lensDistort, 'u_tex'), 0);
        gl.uniform1f(gl.getUniformLocation(state.programs.lensDistort, 'u_amount'), uniforms.u_lens_amount);
        gl.uniform1f(gl.getUniformLocation(state.programs.lensDistort, 'u_scale'), uniforms.u_lens_scale);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    else if (key === 'lightLeaks') {
        if (!UI.lightLeaksEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.useProgram(state.programs.lightLeaks);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.lightLeaks, 'u_tex'), 0);
        gl.uniform1f(gl.getUniformLocation(state.programs.lightLeaks, 'u_intensity'), uniforms.u_lightleaks_intensity);
        gl.uniform3f(gl.getUniformLocation(state.programs.lightLeaks, 'u_color1'), uniforms.u_lightleaks_color1.r, uniforms.u_lightleaks_color1.g, uniforms.u_lightleaks_color1.b);
        gl.uniform3f(gl.getUniformLocation(state.programs.lightLeaks, 'u_color2'), uniforms.u_lightleaks_color2.r, uniforms.u_lightleaks_color2.g, uniforms.u_lightleaks_color2.b);
        gl.uniform1f(gl.getUniformLocation(state.programs.lightLeaks, 'u_time'), uniforms.u_time);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        if (uniforms.u_lightleaks_intensity > 0) {
            requestRender(); // Force continuous rendering for animation
        }
    }
    else if (key === 'heatwave') {
        if (!UI.heatwaveEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.useProgram(state.programs.heatwave);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.heatwave, 'u_tex'), 0);
        gl.uniform1f(gl.getUniformLocation(state.programs.heatwave, 'u_time'), uniforms.u_time);
        gl.uniform1f(gl.getUniformLocation(state.programs.heatwave, 'u_intensity'), uniforms.u_heatwave_intensity);
        gl.uniform1f(gl.getUniformLocation(state.programs.heatwave, 'u_speed'), uniforms.u_heatwave_speed);
        gl.uniform1f(gl.getUniformLocation(state.programs.heatwave, 'u_scale'), uniforms.u_heatwave_scale);
        gl.uniform1i(gl.getUniformLocation(state.programs.heatwave, 'u_direction'), uniforms.u_heatwave_direction);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // If intensity > 0, we need to keep rendering frames
        if (uniforms.u_heatwave_intensity > 0) {
            requestRender(); // Force continuous rendering for animation
        }
    }
    else if (key === 'compression') {
        // [TOOL: COMPRESSION] Lossy Compression Simulation
        if (!UI.compressionEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }

        const iters = Math.max(1, parseInt(UI.compressionIterations?.value || 1));
        const prog = state.programs.compression;
        gl.useProgram(prog);
        gl.uniform1i(gl.getUniformLocation(prog, 'u_method'), parseInt(UI.compressionMethod?.value || 0));
        gl.uniform1f(gl.getUniformLocation(prog, 'u_quality'), parseFloat(UI.compressionQuality?.value || 50));
        gl.uniform1f(gl.getUniformLocation(prog, 'u_blockSize'), parseFloat(UI.compressionBlockSize?.value || 8));
        gl.uniform1f(gl.getUniformLocation(prog, 'u_blend'), parseFloat(UI.compressionBlend?.value || 100) / 100.0);
        gl.uniform2f(gl.getUniformLocation(prog, 'u_res'), w, h);

        if (iters <= 1) {
            // Single pass: direct to output
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        } else {
            // Iterative: ping-pong using blur1/blur2 as scratch FBOs
            let readTex = inputTex;
            for (let i = 0; i < iters; i++) {
                const isLast = (i === iters - 1);
                const writeFbo = isLast ? outputFbo : (i % 2 === 0 ? state.fbos.blur1 : state.fbos.blur2);
                gl.bindFramebuffer(gl.FRAMEBUFFER, writeFbo);
                gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, readTex);
                gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
                if (!isLast) {
                    readTex = (i % 2 === 0) ? state.textures.blur1 : state.textures.blur2;
                }
            }
        }
    }
    else if (key === 'palette') {
        // [TOOL: PALETTE RECONSTRUCTOR] Indexed Color Mapping
        if (!UI.paletteEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.useProgram(state.programs.palette);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.palette, 'u_tex'), 0);
        gl.uniform1f(gl.getUniformLocation(state.programs.palette, 'u_blend'), parseFloat(UI.paletteBlend?.value || 100) / 100.0);
        gl.uniform1f(gl.getUniformLocation(state.programs.palette, 'u_smoothing'), parseFloat(UI.paletteSmoothing?.value || 0));
        gl.uniform1i(gl.getUniformLocation(state.programs.palette, 'u_smoothingType'), parseInt(UI.paletteSmoothingType?.value || 0));
        gl.uniform2f(gl.getUniformLocation(state.programs.palette, 'u_res'), w, h);

        const pSize = Math.min(state.palette.length, 256);
        gl.uniform1i(gl.getUniformLocation(state.programs.palette, 'u_paletteSize'), pSize);

        const flatPalette = new Float32Array(256 * 3);
        for (let i = 0; i < pSize; i++) {
            const hex = state.palette[i];
            flatPalette[i * 3 + 0] = parseInt(hex.slice(1, 3), 16) / 255;
            flatPalette[i * 3 + 1] = parseInt(hex.slice(3, 5), 16) / 255;
            flatPalette[i * 3 + 2] = parseInt(hex.slice(5, 7), 16) / 255;
        }
        gl.uniform3fv(gl.getUniformLocation(state.programs.palette, 'u_palette'), flatPalette);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    else if (key === 'edge') {
        // [TOOL: EDGE EFFECTS] Advanced Outlines & Bloom
        if (!UI.edgeEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.useProgram(state.programs.edge);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.edge, 'u_tex'), 0);
        gl.uniform2f(gl.getUniformLocation(state.programs.edge, 'u_res'), w, h);
        gl.uniform1i(gl.getUniformLocation(state.programs.edge, 'u_mode'), parseInt(UI.edgeMode?.value || 0));
        gl.uniform1f(gl.getUniformLocation(state.programs.edge, 'u_strength'), parseFloat(UI.edgeStrength?.value || 500));
        gl.uniform1f(gl.getUniformLocation(state.programs.edge, 'u_tolerance'), parseFloat(UI.edgeTolerance?.value || 10));
        gl.uniform1f(gl.getUniformLocation(state.programs.edge, 'u_bgSat'), parseFloat(UI.edgeBgSat?.value || 0));
        gl.uniform1f(gl.getUniformLocation(state.programs.edge, 'u_fgSat'), parseFloat(UI.edgeFgSat?.value || 150));
        gl.uniform1f(gl.getUniformLocation(state.programs.edge, 'u_bloom'), parseFloat(UI.edgeBloom?.value || 10));
        gl.uniform1f(gl.getUniformLocation(state.programs.edge, 'u_smooth'), parseFloat(UI.edgeSmooth?.value || 50));
        gl.uniform1f(gl.getUniformLocation(state.programs.edge, 'u_blend'), parseFloat(UI.edgeBlend?.value || 100));

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    else if (key === 'airyBloom') {
        if (!UI.airyBloomEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }

        const maskTex = renderMaskForLayer(gl, inputTex, 'airyBloom');

        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.useProgram(state.programs.airyBloom);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.airyBloom, 'u_tex'), 0);

        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.airyBloom, 'u_mask'), 1);
        gl.uniform1i(gl.getUniformLocation(state.programs.airyBloom, 'u_useMask'), maskTex ? 1 : 0);

        gl.uniform2f(gl.getUniformLocation(state.programs.airyBloom, 'u_res'), w, h);
        gl.uniform1f(gl.getUniformLocation(state.programs.airyBloom, 'u_intensity'), parseFloat(UI.airyBloomIntensity?.value || 0.5));
        gl.uniform1f(gl.getUniformLocation(state.programs.airyBloom, 'u_aperture'), parseFloat(UI.airyBloomAperture?.value || 3.0));
        gl.uniform1f(gl.getUniformLocation(state.programs.airyBloom, 'u_threshold'), parseFloat(UI.airyBloomThreshold?.value || 0.7));
        gl.uniform1f(gl.getUniformLocation(state.programs.airyBloom, 'u_thresholdFade'), parseFloat(UI.airyBloomThresholdFade?.value || 0.1));
        gl.uniform1f(gl.getUniformLocation(state.programs.airyBloom, 'u_cutoff'), parseFloat(UI.airyBloomCutoff?.value || 1.0));

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    else if (key === 'vignette') {
        if (!UI.vignetteEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.useProgram(state.programs.vignette);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.vignette, 'u_tex'), 0);
        gl.uniform2f(gl.getUniformLocation(state.programs.vignette, 'u_res'), w, h);
        gl.uniform1f(gl.getUniformLocation(state.programs.vignette, 'u_intensity'), uniforms.u_vignette_intensity);
        gl.uniform1f(gl.getUniformLocation(state.programs.vignette, 'u_radius'), uniforms.u_vignette_radius);
        gl.uniform1f(gl.getUniformLocation(state.programs.vignette, 'u_softness'), uniforms.u_vignette_softness);
        gl.uniform3f(gl.getUniformLocation(state.programs.vignette, 'u_color'), uniforms.u_vignette_color.r, uniforms.u_vignette_color.g, uniforms.u_vignette_color.b);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    else if (key === 'glareRays') {
        if (!UI.glareRaysEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.useProgram(state.programs.glareRays);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.glareRays, 'u_tex'), 0);
        gl.uniform2f(gl.getUniformLocation(state.programs.glareRays, 'u_res'), w, h);
        gl.uniform1f(gl.getUniformLocation(state.programs.glareRays, 'u_intensity'), uniforms.u_glare_intensity);
        gl.uniform1f(gl.getUniformLocation(state.programs.glareRays, 'u_rays'), uniforms.u_glare_rays);
        gl.uniform1f(gl.getUniformLocation(state.programs.glareRays, 'u_length'), uniforms.u_glare_length);
        gl.uniform1f(gl.getUniformLocation(state.programs.glareRays, 'u_blur'), uniforms.u_glare_blur);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    else if (key === 'hankelBlur') {
        if (!UI.hankelBlurEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }

        const maskTex = renderMaskForLayer(gl, inputTex, 'hankel');

        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.useProgram(state.programs.hankelBlur);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.hankelBlur, 'u_tex'), 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.hankelBlur, 'u_mask'), 1);
        gl.uniform1i(gl.getUniformLocation(state.programs.hankelBlur, 'u_useMask'), maskTex ? 1 : 0);

        gl.uniform2f(gl.getUniformLocation(state.programs.hankelBlur, 'u_res'), w, h);
        gl.uniform1f(gl.getUniformLocation(state.programs.hankelBlur, 'u_intensity'), uniforms.u_hankel_intensity);
        gl.uniform1f(gl.getUniformLocation(state.programs.hankelBlur, 'u_radius'), uniforms.u_hankel_radius);
        gl.uniform1f(gl.getUniformLocation(state.programs.hankelBlur, 'u_quality'), uniforms.u_hankel_quality);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
}

/**
 * [PIPELINE OPTIMIZATION] Unified Mask Rendering
 * logic: Generates a combined Luma + Color mask for a given tool prefix.
 * returns: The texture containing the final mask.
 */
function renderMaskForLayer(gl, inputTex, prefix) {
    const hasSH = UI[prefix + 'LumaMask']?.checked || UI['noiseLumaMask']?.checked;
    const hasCol = UI[prefix + 'ColorExclude']?.checked || UI['noiseColorExclude']?.checked;

    if (!hasSH && !hasCol) return null;

    // Ensure maskTotal buffers exist
    if (!state.fbos.maskTotal) {
        state.textures.maskTotal = createTexture(gl, null, state.renderWidth, state.renderHeight);
        state.fbos.maskTotal = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.maskTotal);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, state.textures.maskTotal, 0);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.maskTotal);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.DST_COLOR, gl.ZERO);

    if (hasSH) {
        gl.useProgram(state.programs.mask);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.mask, 'u_tex'), 0);
        gl.uniform1i(gl.getUniformLocation(state.programs.mask, 'u_useS'), 1);
        gl.uniform1f(gl.getUniformLocation(state.programs.mask, 'u_sth'), parseFloat(UI[prefix + 'ShadowThreshold']?.value || UI['shadowThreshold']?.value || 0));
        gl.uniform1f(gl.getUniformLocation(state.programs.mask, 'u_sfa'), parseFloat(UI[prefix + 'ShadowFade']?.value || UI['shadowFade']?.value || 0.1));
        gl.uniform1i(gl.getUniformLocation(state.programs.mask, 'u_useH'), 1);
        gl.uniform1f(gl.getUniformLocation(state.programs.mask, 'u_hth'), parseFloat(UI[prefix + 'HighlightThreshold']?.value || UI['highlightThreshold']?.value || 1));
        gl.uniform1f(gl.getUniformLocation(state.programs.mask, 'u_hfa'), parseFloat(UI[prefix + 'HighlightFade']?.value || UI['highlightFade']?.value || 0.1));
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    if (hasCol) {
        const targetColor = UI[prefix + 'ExcludeColor']?.value || UI[prefix + 'TargetColor']?.value || UI['noiseExcludeColor']?.value || '#000000';
        const rgb = hexToRgb(targetColor);
        gl.useProgram(state.programs.colorMask);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.colorMask, 'u_tex'), 0);
        gl.uniform3f(gl.getUniformLocation(state.programs.colorMask, 'u_targetColor'), rgb.r, rgb.g, rgb.b);
        gl.uniform1f(gl.getUniformLocation(state.programs.colorMask, 'u_tolerance'), parseFloat(UI[prefix + 'ColorTolerance']?.value || UI['noiseColorTolerance']?.value || 10) / 100.0);
        gl.uniform1f(gl.getUniformLocation(state.programs.colorMask, 'u_fade'), parseFloat(UI[prefix + 'ColorFade']?.value || UI['noiseColorFade']?.value || 20) / 100.0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.disable(gl.BLEND);

    if (UI[prefix + 'InvertMask']?.checked || UI['noiseInvertMask']?.checked) {
        gl.useProgram(state.programs.invert);
        gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.blur1); // Use blur1 as temp for inversion
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, state.textures.maskTotal);
        gl.uniform1i(gl.getUniformLocation(state.programs.invert, 'u_tex'), 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // Copy back to maskTotal
        gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.maskTotal);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, state.textures.blur1);
        gl.useProgram(state.programs.copy);
        gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
        gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_channel'), 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    return state.textures.maskTotal;
}

// --- PIPELINE EXECUTION ---

// --- PIPELINE EXECUTION ---
/** 
 * The orchestrator for the entire render process.
 * logic: 
 * 1. Reallocates FBOs if resolution changed.
 * 2. Uploads the base image to the first ping-pong buffer.
 * 3. Iterates through 'state.renderOrder' and calls 'renderSingleLayer' for each.
 * 4. Copies the final result to the screen/display canvas.
 */
function renderFrame(isExport = false) {
    if (!state.baseImage) return;

    // --- FPS Counter ---
    if (!isExport) {
        const now = performance.now();
        if (state.lastFrameTime > 0) {
            const deltaTime = now - state.lastFrameTime;
            state.realtimeFps = 1000 / deltaTime;
        }
        state.lastFrameTime = now;
        state.frameRenderCount++;
        if (state.frameRenderCount % 15 === 0) { // Update UI every 15 frames
            UI.actualFps.textContent = `(Actual: ${Math.round(state.realtimeFps)} FPS)`;
        }
    }
    // --------------------

    const gl = state.gl;
    const size = reallocateBuffers(isExport);
    const w = size.w;
    const h = size.h;
    gl.viewport(0, 0, w, h);

    let inputIdx = 0;
    let outputIdx = 1;

    // [EXPORT LOGIC] Draw upscaled base image to a temp canvas and upload as high-res texture
    let baseTex = state.textures.base;
    if (isExport && (w !== state.width || h !== state.height)) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(state.baseImage, 0, 0, state.width, state.height, 0, 0, w, h);
        // Create a new texture from the upscaled image
        baseTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, baseTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, tempCanvas);
    }

    // Start with Base
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.pingPong[0].fbo);
    gl.useProgram(state.programs.copy);
    gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_channel'), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, baseTex);
    gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Clean up temp texture if created
    if (isExport && baseTex !== state.textures.base) {
        gl.deleteTexture(baseTex);
    }

    // [MULTI-INSTANCE] Render loop with per-instance UI Proxy support
    const debugRender = !isExport && state.frameRenderCount % 60 === 0;
    if (debugRender) console.groupCollapsed(`[Pipeline] Rendering Frame ${state.frameRenderCount} (${state.renderOrder.length} layers)`);

    state.renderOrder.forEach((instanceId, i) => {
        const { baseType, index } = parseInstanceId(instanceId);
        // Correctly handle 'adjust' -> 'adjustEnable' mismatch
        const toggleId = (baseType === 'adjust' ? 'adjust' : baseType) + 'Enable';

        // [MULTI-INSTANCE] Swap UI to Proxy for non-default instances
        const savedUI = UI;
        if (index > 0) UI = createInstanceUIProxy(index);

        try {
            // Optimized: Skip disabled layers entirely. No ping-pong swap needed.
            const vis = state.layerVisibility[instanceId] ?? state.layerVisibility[baseType] ?? true;
            const isEnabled = UI[toggleId] ? UI[toggleId].checked : true;

            if (debugRender) console.log(`  [${i}] ${instanceId}: visible=${vis}, enabled=${isEnabled}`);

            if (vis && isEnabled) {
                // Compute uniforms per-instance (uses current UI, which may be proxied)
                const uniforms = computeUniforms(w, h);

                // Execute layer using baseType for dispatch
                renderSingleLayer(gl, baseType, state.pingPong[inputIdx].tex, state.pingPong[outputIdx].fbo, uniforms);

                // Save output for chain preview
                state.layerTextures[instanceId] = state.pingPong[outputIdx].tex;

                // [CHAIN PREVIEW FIX] Snapshot the active layer's output
                if (state.activeSection && instanceId === state.activeSection && state.fbos.chainCapture) {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.chainCapture);
                    gl.useProgram(state.programs.copy);
                    gl.activeTexture(gl.TEXTURE0);
                    gl.bindTexture(gl.TEXTURE_2D, state.pingPong[outputIdx].tex);
                    gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
                    gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_channel'), 0);
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                }

                // Swap buffers
                let temp = inputIdx; inputIdx = outputIdx; outputIdx = temp;
            }
        } catch (e) {
            console.error(`[Pipeline] ERROR in layer ${instanceId}:`, e.message);
        } finally {
            // [MULTI-INSTANCE] Always restore original UI
            UI = savedUI;
        }
    });
    if (debugRender) console.groupEnd();

    // FINAL OUTPUT
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Resize canvas DOM element to match render size
    if (gl.canvas.width !== w || gl.canvas.height !== h) {
        gl.canvas.width = w;
        gl.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);

    const sourceTex = state.activeLayerPreview && state.layerTextures[state.activeLayerPreview]
        ? state.layerTextures[state.activeLayerPreview]
        : state.pingPong[inputIdx].tex;

    let chan = 0;
    if (state.activeLayerPreview === 'shadows') chan = 2;
    if (state.activeLayerPreview === 'highlights') chan = 3;

    if (chan === 0) {
        gl.useProgram(state.programs.final);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sourceTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.final, 'u_tex'), 0);
        gl.uniform2f(gl.getUniformLocation(state.programs.final, 'u_res'), w, h);
    } else {
        gl.useProgram(state.programs.copy);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sourceTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
        gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_channel'), chan);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.flush();

    // Analysis Pass (Downsample final result for Histogram/Vectorscope)
    const infoDetails = document.querySelector('.info-details');
    if (infoDetails && infoDetails.open) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, state.analysisFBO.fbo);
        gl.viewport(0, 0, state.analysisFBO.w, state.analysisFBO.h);
        gl.useProgram(state.programs.copy);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sourceTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
        gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_channel'), 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // Ensure rendering is complete before export (toDataURL relies on buffer)
    if (isExport) {
        gl.finish();
    } else {
        // Only update previews if the breakdown grid is visible (performance optimization)
        if (UI.layerGrid && UI.layerGrid.offsetHeight > 0) {
            updateLayerPreviews();
        }

        // Only update graphs if the section is open (performance optimization)
        const infoDetails = document.querySelector('.info-details');
        if (infoDetails && infoDetails.open) {
            updateHistogram();
            updateVectorscope();
        }

        // [NEW] Sync to external preview
        if (state.previewWindow && !state.previewWindow.closed) {
            try {
                const destCanvas = state.previewWindow.document.getElementById('fs-canvas');
                if (destCanvas) {
                    // Only update dimensions if changed (avoids flickering/resetting)
                    if (destCanvas.width !== w || destCanvas.height !== h) {
                        destCanvas.width = w;
                        destCanvas.height = h;
                    }
                    const ctx = destCanvas.getContext('2d');
                    ctx.drawImage(gl.canvas, 0, 0);
                } else {
                    state.previewWindow = null;
                }
            } catch (err) {
                // Window might be navigating away or closed
                state.previewWindow = null;
                console.warn("Preview sync error:", err);
            }
        }
    }
}

function calcCurve(val, max, scale = 1.0) {
    const norm = val / max;
    return (norm * norm) * scale;
}

function updatePinPosition() {
    const x = state.caCenter.x * 100;
    const y = (1.0 - state.caCenter.y) * 100;
    UI.caPin.style.left = x + '%';
    UI.caPin.style.top = y + '%';
}

function updatePaletteUI() {
    UI.paletteList.innerHTML = '';
    state.palette.forEach((color, index) => {
        const item = document.createElement('div');
        item.className = 'palette-color-item';
        item.innerHTML = `
                    <input type="color" value="${color}">
                    <button class="remove-color-btn" title="Remove">&times;</button>
                `;
        item.querySelector('input').addEventListener('input', (e) => {
            state.palette[index] = e.target.value;
            requestRender();
        });
        item.querySelector('.remove-color-btn').addEventListener('click', () => {
            state.palette.splice(index, 1);
            updatePaletteUI();
            requestRender();
        });
        UI.paletteList.appendChild(item);
    });
}

function syncNoiseUI(suffix = '') {
    const typeInput = _UI_BASE['noiseType' + suffix] || document.getElementById('noiseType' + suffix);
    if (!typeInput) return;
    const type = parseInt(typeInput.value);

    const getEl = (id) => _UI_BASE[id + suffix] || document.getElementById(id + suffix);

    const header = getEl('noiseParamsHeader');
    const rowA = getEl('noiseParamRowA');
    const rowB = getEl('noiseParamRowB');
    const rowC = getEl('noiseParamRowC');
    const labelA = getEl('noiseLabelA');
    const labelB = getEl('noiseLabelB');
    const labelC = getEl('noiseLabelC');
    const paramA = getEl('noiseParamA');

    // Reset
    [header, rowA, rowB, rowC].forEach(el => { if (el) el.style.display = 'none'; });

    const showSet = (a, b, c) => {
        if (header) header.style.display = 'block';
        if (a && rowA && labelA) { rowA.style.display = 'flex'; labelA.textContent = a; }
        if (b && rowB && labelB) { rowB.style.display = 'flex'; labelB.textContent = b; }
        if (c && rowC && labelC) { rowC.style.display = 'flex'; labelC.textContent = c; }
    };

    switch (type) {
        case 5: // Perlin
            showSet("Complexity", "Organic Flow", "Octave Mix");
            if (paramA) {
                paramA.min = 1; paramA.max = 8; paramA.step = 1;
                if (paramA.value > 8) { paramA.value = 4; paramA.dispatchEvent(new Event('input')); }
            }
            break;
        case 6: // Worley
            showSet("Cell Jitter", "Density", "Sphericity");
            if (paramA) {
                paramA.min = 0; paramA.max = 100; paramA.step = 1;
            }
            break;
        case 7: // Scanlines
            showSet("Line Thickness", "Vertical Jitter", "Sync Grain");
            break;
        case 8: // Speckle
            showSet("Density", "Sharpness", "Variable Size");
            break;
        case 9: // Glitch
            showSet("Block Size", "Horiz Shift", "RGB Split");
            break;
        case 10: // Anisotropic
            showSet("Stretch", "Rotation", "Fiber Link");
            break;
        case 11: // Voronoi Mosaic
            showSet("Cell Detail", "Randomness", "Smoothness");
            break;
        case 12: // Crosshatch
            showSet("Line Density", "Diagonal Angle", "Pressure");
            break;
    }
}

/** 
 * Procedural Color Palette Extraction.
 * logic: Uses 'Farthest First Traversal' to ensure the extracted palette 
 * is diverse and representative, not just the most common colors.
 * Reference: Controlled by 'Palette Reconstructor' UI.
 */
async function extractPaletteFromImage(img, count) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const size = 128; // Small size for faster analysis
    canvas.width = size;
    canvas.height = size;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    const counts = {};
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue; // Skip transparency
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
        counts[hex] = (counts[hex] || 0) + 1;
    }

    const uniqueColors = Object.entries(counts).map(([hex, freq]) => {
        return {
            hex,
            freq,
            r: parseInt(hex.slice(1, 3), 16),
            g: parseInt(hex.slice(3, 5), 16),
            b: parseInt(hex.slice(5, 7), 16)
        };
    });

    if (uniqueColors.length === 0) return;

    // Farthest First Traversal (Diversity Logic)
    const resultPalette = [];
    // 1. Pick the most frequent as the anchor
    uniqueColors.sort((a, b) => b.freq - a.freq);
    resultPalette.push(uniqueColors[0]);

    // 2. Iteratively pick colors that are farthest from the current palette
    const dists = new Float32Array(uniqueColors.length).fill(1e10);

    const updateDists = (lastPicked) => {
        for (let i = 0; i < uniqueColors.length; i++) {
            const c = uniqueColors[i];
            const d = Math.sqrt(
                Math.pow(c.r - lastPicked.r, 2) +
                Math.pow(c.g - lastPicked.g, 2) +
                Math.pow(c.b - lastPicked.b, 2)
            );
            if (d < dists[i]) dists[i] = d;
        }
    };

    updateDists(resultPalette[0]);

    const targetCount = Math.min(count, uniqueColors.length);
    while (resultPalette.length < targetCount) {
        let bestIdx = -1;
        let maxMinDist = -1;

        for (let i = 0; i < uniqueColors.length; i++) {
            if (dists[i] > maxMinDist) {
                maxMinDist = dists[i];
                bestIdx = i;
            }
        }

        if (bestIdx === -1) break;
        const picked = uniqueColors[bestIdx];
        resultPalette.push(picked);
        updateDists(picked);
    }

    state.palette = resultPalette.map(c => c.hex);
    updatePaletteUI();
    requestRender();
}

// [SHADER HELPERS] Modular fetch-based shader loading
// Loads shader source from external .frag/.vert files
async function fetchShaderSource(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load shader: ${url} (${response.status})`);
    return (await response.text()).trim();
}

function compileShaderSource(gl, type, src, label) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(`Shader compile error [${label}]:`, gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

function createProgramFromSources(gl, vsSrc, fsSrc, vsLabel, fsLabel) {
    const vs = compileShaderSource(gl, gl.VERTEX_SHADER, vsSrc, vsLabel);
    const fs = compileShaderSource(gl, gl.FRAGMENT_SHADER, fsSrc, fsLabel);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.error(`Program link error [${vsLabel} + ${fsLabel}]:`, gl.getProgramInfoLog(p));
        return null;
    }
    return p;
}

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

// --- UTILS: EXPORT & UI ---

/** 
 * [EXPORT] Renders and saves the final image at the highest quality.
 * logic: Temporarily sets 'upscaleFactor' to target resolution, processes 
 * the full stack, and extracts the buffer via 'toDataURL'.
 */
async function downloadFullRes() {
    UI.loading.style.display = 'block';
    await new Promise(r => setTimeout(r, 50));

    // Ensure buffers are allocated for full resolution export
    reallocateBuffers(true);
    renderFrame(true);

    const link = document.createElement('a');
    link.download = 'grain-export.png';
    link.href = state.canvas.toDataURL('image/png', 1.0);
    link.click();

    // Restore buffers to preview size after export
    reallocateBuffers(false);
    requestRender();
    UI.loading.style.display = 'none';
}

/** 
 * [COMPARISON MODAL] Visual A/B Testing.
 * logic: Renders full image at 1:1, copies to a side-by-side modal for detail inspection.
 * Note: Temporarily forces full-res buffers to ensure accuracy.
 */
async function openCompare() {
    UI.loading.style.display = 'block';
    await new Promise(r => setTimeout(r, 50));

    renderFrame(true);

    const original = document.getElementById('compareOriginal');
    const processed = document.getElementById('compareProcessed');

    const aspect = state.width / state.height;
    original.width = 600; original.height = 600 / aspect;
    processed.width = 600; processed.height = 600 / aspect;

    const ctxO = original.getContext('2d');
    const ctxP = processed.getContext('2d');

    ctxO.drawImage(state.baseImage, 0, 0, original.width, original.height);
    ctxP.drawImage(state.canvas, 0, 0, processed.width, processed.height);

    // Update Export Info
    if (UI.exportInfo) {
        const reqW = Math.round(state.width * state.upscaleFactor);
        const reqH = Math.round(state.height * state.upscaleFactor);
        const actW = state.renderWidth;
        const actH = state.renderHeight;
        const scale = state._exportScale || 1.0;

        UI.exportInfo.innerHTML = `Requested: ${reqW}x${reqH} | Actual: ${actW}x${actH} (Safe Scale: ${scale.toFixed(2)})`;

        if (scale < 1.0) {
            UI.exportInfo.style.color = '#ffaa00'; // Warning color if downscaled
        } else {
            UI.exportInfo.style.color = '#0f0';
        }
    }

    document.getElementById('compareModal').classList.add('show');

    reallocateBuffers(false);
    requestRender();
    UI.loading.style.display = 'none';
}

/** 
 * [EXPORT] Multi-panel Comparison Image.
 * logic: Combines original and processed images into a single vertical or horizontal layout.
 */
async function exportComparison(mode) {
    const o = document.getElementById('compareOriginal');
    const p = document.getElementById('compareProcessed');
    const c = document.createElement('canvas');
    if (mode === 'side') {
        c.width = o.width * 2;
        c.height = o.height;
        c.getContext('2d').drawImage(o, 0, 0);
        c.getContext('2d').drawImage(p, o.width, 0);
    } else {
        c.width = o.width;
        c.height = o.height * 2;
        c.getContext('2d').drawImage(o, 0, 0);
        c.getContext('2d').drawImage(p, 0, o.height);
    }
    const link = document.createElement('a');
    link.download = `grain-compare-${mode}.png`;
    link.href = c.toDataURL('image/png', 1.0);
    link.click();
}

// --- PREVIEW POPOUT ---
function openFullscreenPreview() {
    if (state.previewWindow && !state.previewWindow.closed) {
        state.previewWindow.focus();
        return;
    }
    const win = window.open('', 'NoiseStudioPreview', 'width=800,height=600');
    if (!win) {
        alert('Pop-up blocked. Please allow pop-ups for this site.');
        return;
    }
    // DOM construction to avoid script tag issues
    const d = win.document;
    d.open();
    d.write('');
    d.close();

    d.title = "Noise Studio Preview";
    d.body.style.margin = '0';
    d.body.style.background = '#111';
    d.body.style.height = '100vh';
    d.body.style.display = 'flex';
    d.body.style.alignItems = 'center';
    d.body.style.justifyContent = 'center';
    d.body.style.overflow = 'hidden';

    const cvs = d.createElement('canvas');
    cvs.id = 'fs-canvas';
    cvs.style.maxWidth = '100%';
    cvs.style.maxHeight = '100%';
    cvs.style.objectFit = 'contain';
    cvs.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
    d.body.appendChild(cvs);

    state.previewWindow = win;

    // Initial sync
    setTimeout(() => requestRender(), 100);
}

// Ensure event listener is added in init
document.getElementById('fullscreenPreviewBtn').addEventListener('click', openFullscreenPreview);

// --- PREVIEW SYSTEM REFACTOR ---

/** 
 * Maps an input element index to its parent tool category.
 * logic: Used to auto-update the Section Breakdown grid when a slider is moved.
 */
function getSectionFromId(id) {
    if (!id) return null;
    if (id.startsWith('adj') || id === 'brightness' || id === 'contrast' || id === 'saturationAdj' || id === 'warmth' || id === 'sharpen') return 'adjust';
    if (id.startsWith('hdr')) return 'hdr';
    if (id.startsWith('noise') || id === 'opacity' || id === 'strength' || id === 'blendMode' || id.startsWith('sat') || id.startsWith('ignore')) return 'noise';
    if (id.startsWith('blur')) return 'blur';
    if (id.startsWith('dither')) return 'dither';
    if (id.startsWith('cell')) return 'cell';
    if (id.startsWith('halftone')) return 'halftone';
    if (id.startsWith('bilateral')) return 'bilateral';
    if (id.startsWith('aberration') || id.startsWith('ca')) return 'ca';
    if (id.startsWith('corruption')) return 'corruption';
    if (id.startsWith('palette')) return 'palette';
    if (id.startsWith('edge')) return 'edge';
    if (id.startsWith('airyBloom')) return 'airyBloom';
    if (id.startsWith('glareRays')) return 'glareRays';
    return 'adjust'; // Default fallthrough to adjust if unknown (or null)
}

/** 
 * Dynamically builds the 'Layer Breakdown' UI based on the current active tool.
 * logic: Injects 'Chain Result', 'Isolated', and 'Mask' preview tiles.
 */
function setupLayerGridDOM(section) {
    const { baseType } = section ? parseInstanceId(section) : { baseType: 'adjust' };
    const grid = UI.layerGrid;
    grid.innerHTML = '';

    const items = [
        { id: 'chain', label: 'Chain' },
        { id: 'isolated', label: 'Isolated' }
    ];

    const maskLayers = {
        'blur': true,
        'dither': true,
        'halftone': true,
        'bilateral': true,
        'adjust': true,
        'noise': true
    };

    if (maskLayers[baseType]) {
        items.push({ id: 'mask_luma', label: 'Luma Mask' });
        items.push({ id: 'mask_color', label: 'Color Mask' });
        items.push({ id: 'mask_total', label: 'Total Mask' });
    } else if (baseType === 'ca') {
        items.push({ id: 'falloff', label: 'Falloff Map' });
    }

    // Calculate dimensions based on aspect ratio
    const aspect = state.width / state.height;
    const thumbHeight = 110; // Fixed vertical space for canvas roughly
    const thumbWidth = thumbHeight * aspect;

    items.forEach(item => {
        const d = document.createElement('div');
        d.className = 'layer-item';
        d.style.minWidth = `${Math.max(80, thumbWidth)}px`;
        d.style.flex = '0 0 auto';

        const key = section + '_' + item.id;
        if (state.activeLayerPreview === key) d.classList.add('active');

        d.onclick = () => {
            const targetKey = section + '_' + item.id;
            if (state.activeLayerPreview === targetKey) {
                state.activeLayerPreview = null;
                d.classList.remove('active');
            } else {
                state.activeLayerPreview = targetKey;
                document.querySelectorAll('.layer-item').forEach(el => el.classList.remove('active'));
                d.classList.add('active');
                UI.overlayOriginal.classList.remove('show');
            }
            requestRender();
        };

        d.innerHTML = `
                    <div class="layer-title">${item.label}</div>
                    <canvas class="layer-canvas" id="thumb-${item.id}" width="${Math.round(thumbWidth)}" height="${thumbHeight}"></canvas>
                `;
        grid.appendChild(d);
    });
}

/** 
 * Logic for the 'Breakdown' strip.
 * logic: 
 * 1. Renders the currently selected section in 'Isolated' mode (only that effect on base image).
 * 2. Extracts the 'Mask' texture if masking is active.
 * 3. Draws all results to the small preview canvases using 'drawToThumbnail'.
 */
function updateLayerPreviews() {
    const gl = state.gl;
    if (!state.baseImage) return;

    const section = state.activeSection || 'adjust';

    if (state.lastActiveSectionDOM !== section) {
        setupLayerGridDOM(section);
        state.lastActiveSectionDOM = section;
    }

    if (!state.thumbnailFBO) return;

    // 1. Chain Result
    // [CHAIN PREVIEW FIX] Use the captured texture if available, otherwise fall back to layerTextures (which might be stale)
    const chainTex = (state.textures.chainCapture) ? state.textures.chainCapture : state.layerTextures[section];
    drawToThumbnail(chainTex, 'thumb-chain');

    const orderIdx = state.renderOrder.indexOf(section);
    const inputTex = (orderIdx > 0) ? state.layerTextures[state.renderOrder[orderIdx - 1]] : state.textures.base;

    const { baseType, index: instIdx } = parseInstanceId(section);

    // [MULTI-INSTANCE] Swap UI for non-default instances during preview render
    const savedUI = UI;
    if (instIdx > 0) UI = createInstanceUIProxy(instIdx);

    try {
        const uniforms = computeUniforms(state.renderWidth, state.renderHeight);
        renderSingleLayer(gl, baseType, inputTex, state.fbos.preview, uniforms, true);
    } finally {
        UI = savedUI;
    }
    drawToThumbnail(state.textures.preview, 'thumb-isolated');

    // Special case for active preview overrides
    if (state.activeLayerPreview === section + '_isolated') {
        state.layerTextures[state.activeLayerPreview] = state.textures.preview;
    }

    // 3. Mask Previews (Dedicated path)
    const lumaCanvas = document.getElementById('thumb-mask_luma');
    const colorCanvas = document.getElementById('thumb-mask_color');
    const totalCanvas = document.getElementById('thumb-mask_total');

    if (lumaCanvas || colorCanvas || totalCanvas) {
        renderMaskForSection(section, inputTex);

        if (lumaCanvas) {
            drawToThumbnail(state.textures.maskLuma, 'thumb-mask_luma', 1); // R channel
            if (state.activeLayerPreview === section + '_mask_luma') state.layerTextures[state.activeLayerPreview] = state.textures.maskLuma;
        }
        if (colorCanvas) {
            drawToThumbnail(state.textures.maskColor, 'thumb-mask_color', 0); // Composite is enough if colorMask is simple
            if (state.activeLayerPreview === section + '_mask_color') state.layerTextures[state.activeLayerPreview] = state.textures.maskColor;
        }
        if (totalCanvas) {
            drawToThumbnail(state.textures.maskTotal, 'thumb-mask_total', 0);
            if (state.activeLayerPreview === section + '_mask_total') state.layerTextures[state.activeLayerPreview] = state.textures.maskTotal;
        }
    }

    // Falloff for CA
    const falloffCanvas = document.getElementById('thumb-falloff');
    if (falloffCanvas) {
        renderCAFalloff();
        drawToThumbnail(state.textures.preview, 'thumb-falloff');
        if (state.activeLayerPreview === section + '_falloff') state.layerTextures[state.activeLayerPreview] = state.textures.preview;
    }
}

function renderMaskForSection(section, inputTex) {
    const gl = state.gl;
    const w = state.renderWidth;
    const h = state.renderHeight;
    gl.viewport(0, 0, w, h);

    // Ensure we have mask textures if not exists
    if (!state.textures.maskLuma) {
        state.textures.maskLuma = createTexture(gl, null, w, h);
        state.fbos.maskLuma = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.maskLuma);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, state.textures.maskLuma, 0);

        state.textures.maskColor = createTexture(gl, null, w, h);
        state.fbos.maskColor = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.maskColor);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, state.textures.maskColor, 0);

        state.textures.maskTotal = createTexture(gl, null, w, h);
        state.fbos.maskTotal = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.maskTotal);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, state.textures.maskTotal, 0);
    }

    // Get prefix (e.g. 'adj', 'noise', 'blur')
    let pref = section === 'adjust' ? 'adj' : section;

    // Luma Mask
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.maskLuma);
    gl.useProgram(state.programs.mask);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
    gl.uniform1i(gl.getUniformLocation(state.programs.mask, 'u_tex'), 0);
    gl.uniform1i(gl.getUniformLocation(state.programs.mask, 'u_useS'), 1);
    gl.uniform1f(gl.getUniformLocation(state.programs.mask, 'u_sth'), parseFloat(UI[pref + 'ShadowThreshold']?.value || UI['shadowThreshold']?.value || 0));
    gl.uniform1f(gl.getUniformLocation(state.programs.mask, 'u_sfa'), parseFloat(UI[pref + 'ShadowFade']?.value || UI['shadowFade']?.value || 0));
    gl.uniform1i(gl.getUniformLocation(state.programs.mask, 'u_useH'), 1);
    gl.uniform1f(gl.getUniformLocation(state.programs.mask, 'u_hth'), parseFloat(UI[pref + 'HighlightThreshold']?.value || UI['highlightThreshold']?.value || 1));
    gl.uniform1f(gl.getUniformLocation(state.programs.mask, 'u_hfa'), parseFloat(UI[pref + 'HighlightFade']?.value || UI['highlightFade']?.value || 0));
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Color Mask
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.maskColor);
    const targetColor = UI[pref + 'ExcludeColor']?.value || UI['noiseExcludeColor']?.value || '#000000';
    const rgb = hexToRgb(targetColor);
    gl.useProgram(state.programs.colorMask);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
    gl.uniform1i(gl.getUniformLocation(state.programs.colorMask, 'u_tex'), 0);
    gl.uniform3f(gl.getUniformLocation(state.programs.colorMask, 'u_targetColor'), rgb.r, rgb.g, rgb.b);
    gl.uniform1f(gl.getUniformLocation(state.programs.colorMask, 'u_tolerance'), parseFloat(UI[pref + 'ColorTolerance']?.value || UI['noiseColorTolerance']?.value || 0.1) / 100.0);
    gl.uniform1f(gl.getUniformLocation(state.programs.colorMask, 'u_fade'), parseFloat(UI[pref + 'ColorFade']?.value || UI['noiseColorFade']?.value || 0) / 100.0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Total Mask
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.maskTotal);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.DST_COLOR, gl.ZERO);

    if (UI[pref + 'LumaMask']?.checked || UI['noiseLumaMask']?.checked) {
        gl.useProgram(state.programs.copy);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, state.textures.maskLuma);
        gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
        gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_channel'), 1); // R is combined mask in fs-mask
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    if (UI[pref + 'ColorExclude']?.checked || UI['noiseColorExclude']?.checked) {
        gl.useProgram(state.programs.copy);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, state.textures.maskColor);
        gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
        gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_channel'), 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.disable(gl.BLEND);

    if (UI[pref + 'InvertMask']?.checked || UI['noiseInvertMask']?.checked) {
        gl.useProgram(state.programs.invert);
        gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.preview); // Temporarily use preview FBO for inversion
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, state.textures.maskTotal);
        gl.uniform1i(gl.getUniformLocation(state.programs.invert, 'u_tex'), 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // Copy back
        gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.maskTotal);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, state.textures.preview);
        gl.useProgram(state.programs.copy);
        gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}

function renderCAFalloff() {
    const gl = state.gl;
    const w = state.renderWidth;
    const h = state.renderHeight;
    gl.viewport(0, 0, w, h);

    gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.preview);
    gl.useProgram(state.programs.radial);
    gl.uniform2f(gl.getUniformLocation(state.programs.radial, 'u_res'), w, h);
    gl.uniform2f(gl.getUniformLocation(state.programs.radial, 'u_center'), state.caCenter.x, state.caCenter.y);
    gl.uniform1f(gl.getUniformLocation(state.programs.radial, 'u_radius'), parseFloat(UI.caRadius.value) / 1000.0);
    gl.uniform1f(gl.getUniformLocation(state.programs.radial, 'u_falloff'), parseFloat(UI.caFalloff.value) / 1000.0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

/** 
 * Low-level helper to copy a WebGL texture onto a 2D canvas.
 * logic: Uses an intermediate offscreen FBO to read pixels from the GPU into the CPU-bound canvas.
 */
function drawToThumbnail(tex, canvasId, channel = 0) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !tex) return;
    const gl = state.gl;

    const dw = canvas.width;
    const dh = canvas.height;
    const tw = state.thumbnailFBO.w;
    const th = state.thumbnailFBO.h;

    gl.bindFramebuffer(gl.FRAMEBUFFER, state.thumbnailFBO.fbo);
    gl.viewport(0, 0, tw, th);
    gl.useProgram(state.programs.copy);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
    gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_channel'), channel);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Use cached buffer
    const pixels = state.thumbPixelBuffer;
    gl.readPixels(0, 0, tw, th, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Fast vertical flip and transfer to clamped array for ImageData
    const clamped = state.thumbClampedBuffer;
    for (let y = 0; y < th; y++) {
        const srcOff = (th - 1 - y) * tw * 4;
        const dstOff = y * tw * 4;
        clamped.set(pixels.subarray(srcOff, srcOff + tw * 4), dstOff);
    }

    const imgData = new ImageData(clamped, tw, th);
    state.thumbTempCtx.putImageData(imgData, 0, 0);

    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.drawImage(state.thumbTempCanvas, 0, 0, tw, th, 0, 0, dw, dh);
}

function bindDynamicControls(container) {
    container.querySelectorAll('details').forEach(details => {
        if (details.dataset.bound) return;
        details.addEventListener('toggle', (e) => {
            if (details.open) {
                const input = details.querySelector('input, select');
                if (input) {
                    const section = typeof getSectionFromId === 'function' ? getSectionFromId(input.id) : null;
                    if (section) {
                        state.activeSection = section;
                        requestRender();
                    }
                }
            }
        });
        details.dataset.bound = 'true';
    });

    container.querySelectorAll('input[type=range]').forEach(range => {
        if (range.dataset.bound) return;
        const text = range.nextElementSibling;
        if (text && text.classList.contains('control-value')) {
            const update = () => text.value = range.value;
            range.addEventListener('input', () => { update(); requestRender(); });
            // Sync initial value but don't overwrite if not needed
            update();
        } else {
            range.addEventListener('input', requestRender);
        }
        range.dataset.bound = 'true';
    });

    container.querySelectorAll('select, input[type=checkbox], input[type=color]').forEach(el => {
        if (el.dataset.bound) return;
        el.addEventListener('change', () => {
            if (el.id === 'clampPreviewToggle') {
                state.clampPreview = !el.checked;
                reallocateBuffers(state.isZooming);
            }
            if (el.id && el.id.startsWith('edgeMode')) {
                const suffix = el.id.substring(8);
                const targetId = 'edgeSatControls' + suffix;
                const target = document.getElementById(targetId) || _UI_BASE[targetId];
                if (target) target.style.display = el.value === '1' ? 'block' : 'none';
            }
            if (el.id && el.id.startsWith('noiseType')) {
                const suffix = el.id.substring(9);
                syncNoiseUI(suffix);
            }
            requestRender();
        });
        el.addEventListener('input', requestRender);
        el.dataset.bound = 'true';
    });

    container.querySelectorAll('.eyedropper-btn').forEach(btn => {
        if (btn.dataset.bound) return;
        btn.addEventListener('click', (e) => {
            const targetId = e.target.dataset.target;
            if (eyedropperTarget === targetId) {
                eyedropperTarget = null;
                UI.displayCanvas.classList.remove('eyedropper-active');
            } else {
                eyedropperTarget = targetId;
                UI.displayCanvas.classList.add('eyedropper-active');
            }
            e.stopPropagation();
        });
        btn.dataset.bound = 'true';
    });
}
