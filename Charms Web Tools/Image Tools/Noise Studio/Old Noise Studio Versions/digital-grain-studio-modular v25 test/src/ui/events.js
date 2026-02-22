import { state, LAYERS, APP_VERSION, UI } from '../state/store.js';
import { requestRender, renderFrame } from '../webgl/pipeline.js';
import { reallocateBuffers, initWebGL, loadNewImage } from '../webgl/core.js';
import { setupLayerGridDOM, updatePaletteUI, syncNoiseUI, updatePinPosition, getSectionFromId, setupDragLayerList, updateUIMode, openFullscreenPreview, openCompare, exportComparison } from './dom_helpers.js';
import { downloadPreset, uploadPreset } from '../state/presets.js';
import { loadImageFromFile, loadFolder, changeImage, downloadSingleImage, downloadAllImages } from '../state/io.js';

export function initEvents() {
    const paletteWorker = new Worker(new URL('../workers/paletteWorker.js', import.meta.url), { type: 'module' });
    paletteWorker.onmessage = (e) => {
        if (e.data.palette) {
            state.palette = e.data.palette;
            updatePaletteUI();
            requestRender();
        }
    };

    const extractPaletteAsync = (img, count) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        paletteWorker.postMessage({ data, count });
    };

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
    document.querySelectorAll('#tab-controls details').forEach(details => {
        details.addEventListener('toggle', (e) => {
            if (details.open) {
                // [MODIFIED] Removed "close others" logic to allow multiple sections and prevent scroll jumps

                // Update active section logic
                const input = details.querySelector('input, select');
                if (input) {
                    const section = getSectionFromId(input.id);
                    if (section) {
                        state.activeSection = section;
                        requestRender();
                    }
                }
            }
        });
    });

    setupDragLayerList();

    // [VALUE BINDING] Sync range sliders with their adjacent text indicators
    document.querySelectorAll('input[type=range]').forEach(range => {
        const text = range.nextElementSibling;
        if (text && text.classList.contains('control-value')) {
            const update = () => text.value = range.value;
            range.addEventListener('input', () => { update(); requestRender(); });
            update();
        }
    });

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
    document.querySelectorAll('select, input[type=checkbox], input[type=color]').forEach(el => {
        el.addEventListener('change', () => {
            if (el.id === 'clampPreviewToggle') {
                // "High Quality Preview" checked = No Clamping
                state.clampPreview = !el.checked;
                // Always respect the current zoom state when flipping resolution limits
                reallocateBuffers(state.isZooming);
            }
            requestRender();
        });
        el.addEventListener('input', requestRender);
    });

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
                extractPaletteAsync(img, count);
            };
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
    });

    UI.extractCount.addEventListener('input', () => {
        if (state.lastExtractionImage) {
            const count = parseInt(UI.extractCount.value);
            extractPaletteAsync(state.lastExtractionImage, count);
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

    initWebGL();

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
    UI.noiseType.addEventListener('change', syncNoiseUI);
    syncNoiseUI(); // Initial call

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

    let eyedropperTarget = null;
    document.querySelectorAll('.eyedropper-btn').forEach(btn => {
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
    });

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
}