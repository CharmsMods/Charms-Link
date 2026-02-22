import { state, UI, LAYERS } from '../state/store.js';
import { requestRender, renderFrame } from '../webgl/pipeline.js';
import { loadImageFromFile, downloadSingleImage } from '../state/io.js';

export function getSectionFromId(id) {
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

export function setupDragLayerList() {
    const list = document.getElementById('layer-drag-list');
    list.innerHTML = '';

    // [SYNC] Ensure all valid layers from LAYERS are in renderOrder
    // This fixes issues where new features (like Hankel/Glare) might be missing due to old presets or init order.
    const validLayers = Object.keys(LAYERS).filter(k => k !== 'shadows' && k !== 'highlights');
    validLayers.forEach(key => {
        if (!state.renderOrder.includes(key)) {
            state.renderOrder.push(key);
            // Default visibility to true for new layers
            if (state.layerVisibility[key] === undefined) state.layerVisibility[key] = true;
        }
    });

    // Remove any stale keys that no longer exist in LAYERS
    state.renderOrder = state.renderOrder.filter(key => validLayers.includes(key));

    state.renderOrder.forEach((key, index) => {
        const div = document.createElement('div');
        div.className = 'drag-layer';
        div.draggable = true;
        div.dataset.key = key;

        const isChecked = state.layerVisibility[key] ? 'checked' : '';

        div.innerHTML = `
            <div style="display:flex; align-items:center;">
                <span class="drag-handle">☰</span> 
                <input type="checkbox" class="drag-toggle" data-key="${key}" ${isChecked}>
            </div>
            <span>${LAYERS[key].name}</span>
        `;

        div.querySelector('input').addEventListener('change', (e) => {
            state.layerVisibility[key] = e.target.checked;
            requestRender();
        });

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
}

export function updateUIMode() {
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

export function openFullscreenPreview() {
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

export async function openCompare() {
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

export async function exportComparison(mode) {
    UI.loading.style.display = 'block';
    await new Promise(r => setTimeout(r, 50));

    renderFrame(true);
    const processedData = state.canvas.toDataURL();
    const processedImg = new Image();
    processedImg.src = processedData;
    await new Promise(r => processedImg.onload = r);

    const exp = document.createElement('canvas');
    const w = state.canvas.width;
    const h = state.canvas.height;

    if (mode === 'side') {
        exp.width = w * 2;
        exp.height = h;
        const ctx = exp.getContext('2d');
        ctx.drawImage(state.baseImage, 0, 0, w, h);
        ctx.drawImage(processedImg, w, 0);
    } else {
        exp.width = w;
        exp.height = h * 2;
        const ctx = exp.getContext('2d');
        ctx.drawImage(state.baseImage, 0, 0, w, h);
        ctx.drawImage(processedImg, 0, h);
    }

    const link = document.createElement('a');
    link.download = `grain-compare-${mode}.png`;
    link.href = exp.toDataURL('image/png', 0.9);
    link.click();

    reallocateBuffers(false);
    requestRender();
    UI.loading.style.display = 'none';
}

export function updatePaletteUI() {
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

export function syncNoiseUI() {
    const type = parseInt(UI.noiseType.value);
    const header = document.getElementById('noiseParamsHeader');
    const rowA = document.getElementById('noiseParamRowA');
    const rowB = document.getElementById('noiseParamRowB');
    const rowC = document.getElementById('noiseParamRowC');
    const labelA = document.getElementById('noiseLabelA');
    const labelB = document.getElementById('noiseLabelB');
    const labelC = document.getElementById('noiseLabelC');

    // Reset
    [header, rowA, rowB, rowC].forEach(el => el.style.display = 'none');

    const showSet = (a, b, c) => {
        header.style.display = 'block';
        if (a) { rowA.style.display = 'flex'; labelA.textContent = a; }
        if (b) { rowB.style.display = 'flex'; labelB.textContent = b; }
        if (c) { rowC.style.display = 'flex'; labelC.textContent = c; }
    };

    switch (type) {
        case 5: // Perlin
            showSet("Complexity", "Organic Flow", "Octave Mix");
            UI.noiseParamA.min = 1; UI.noiseParamA.max = 8; UI.noiseParamA.step = 1;
            if (UI.noiseParamA.value > 8) UI.noiseParamA.value = 4;
            break;
        case 6: // Worley
            showSet("Cell Jitter", "Density", "Sphericity");
            UI.noiseParamA.min = 0; UI.noiseParamA.max = 100; UI.noiseParamA.step = 1;
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

export function updatePinPosition() {
    const x = state.caCenter.x * 100;
    const y = (1.0 - state.caCenter.y) * 100;
    UI.caPin.style.left = x + '%';
    UI.caPin.style.top = y + '%';
}

export function setupLayerGridDOM(section) {
    if (!section) section = state.activeSection || 'adjust';
    const grid = UI.layerGrid;
    if (!grid) return;
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

    if (maskLayers[section]) {
        items.push({ id: 'mask_luma', label: 'Luma Mask' });
        items.push({ id: 'mask_color', label: 'Color Mask' });
        items.push({ id: 'mask_total', label: 'Total Mask' });
    } else if (section === 'ca') {
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

