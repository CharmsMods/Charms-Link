import { state, UI, APP_VERSION } from './store.js';
import { loadNewImage } from '../webgl/core.js';
import { setupDragLayerList, updatePinPosition, updatePaletteUI } from '../ui/dom_helpers.js';
import { requestRender } from '../webgl/pipeline.js';

export function downloadPreset() {
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

export function uploadPreset(e) {
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

export function restoreSettings(preset) {
    if (preset.metadata && preset.metadata.version !== APP_VERSION) {
        console.warn(`Version mismatch: Preset is ${preset.metadata.version}, App is ${APP_VERSION}. Attempting to restore anyway.`);
    }

    // Apply values (sliders)
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

