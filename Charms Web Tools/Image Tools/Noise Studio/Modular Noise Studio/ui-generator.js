/**
 * ui-generator.js — Dynamic UI Generation from JSON Layer Definitions
 * 
 * Reads Shaders/layers.json, fetches each layer's .json control definition,
 * and builds the <details> sections dynamically into #dynamic-controls.
 * 
 * Called BEFORE the main app.js DOMContentLoaded handler finishes,
 * so all generated elements are available for UI population.
 */

"use strict";

// [MULTI-INSTANCE] Cache of layer definitions for cloning
window._layerDefCache = {};

async function generateLayerUI() {
    const container = document.getElementById('dynamic-controls');
    if (!container) {
        console.error('[UI-Gen] #dynamic-controls container not found');
        return;
    }

    // Load the layer manifest
    const layers = await fetch('Shaders/layers.json').then(r => r.json());
    console.log(`[UI-Gen] Loading ${layers.length} layer definitions...`);

    // Fetch all layer JSONs in parallel
    const layerDefs = await Promise.all(
        layers.map(async (layer) => {
            try {
                const def = await fetch(layer.json).then(r => r.json());
                return { ...layer, def };
            } catch (e) {
                console.warn(`[UI-Gen] Failed to load ${layer.json}: ${e.message}`);
                return { ...layer, def: null };
            }
        })
    );

    const selectDropdown = document.getElementById('addLayerSelect');
    const addLayerBtn = document.getElementById('addLayerBtn');

    // Build UI for each layer and cache definitions
    for (const layer of layerDefs) {
        if (!layer.def) continue;
        window._layerDefCache[layer.key] = { layer, def: layer.def };

        // Populate the Add Layer dropdown instead of rendering directly to DOM
        if (selectDropdown) {
            const opt = document.createElement('option');
            opt.value = layer.key;
            opt.textContent = layer.name || layer.key;
            selectDropdown.appendChild(opt);
        }
    }

    if (selectDropdown && addLayerBtn) {
        selectDropdown.addEventListener('change', (e) => {
            addLayerBtn.disabled = !e.target.value;
        });
        addLayerBtn.addEventListener('click', () => {
            if (selectDropdown.value && typeof window.addLayerInstance === 'function') {
                window.addLayerInstance(selectDropdown.value);
                selectDropdown.value = '';
                addLayerBtn.disabled = true;
            }
        });
    }

    console.log(`[UI-Gen] ${layerDefs.filter(l => l.def).length} layer definitions cached`);
}

/**
 * [MULTI-INSTANCE] Creates a new instance panel for the given layer type.
 * Clones the layer definition and suffixes all IDs with __instanceIndex.
 */
function createLayerInstance(baseType, instanceIndex) {
    const cached = window._layerDefCache[baseType];
    if (!cached) {
        console.warn(`[UI-Gen] No cached definition for layer type: ${baseType}`);
        return null;
    }

    const suffix = '__' + instanceIndex;

    // Deep clone the definition and suffix all IDs
    const clonedDef = JSON.parse(JSON.stringify(cached.def));
    suffixAllIds(clonedDef, suffix);

    // Build the panel
    const clonedLayer = { ...cached.layer };
    if (clonedLayer.detailsId) clonedLayer.detailsId = clonedLayer.detailsId + suffix;

    // Override the name to show instance number only for duplicates
    clonedDef.name = (clonedDef.name || cached.layer.name) + (instanceIndex > 1 ? ` (${instanceIndex})` : '');

    const details = buildLayerDetails(clonedLayer, clonedDef);
    details.dataset.layerKey = baseType;
    details.dataset.instanceIndex = String(instanceIndex);

    // Insert after the last panel of this layer type
    const container = document.getElementById('dynamic-controls');
    const allPanels = container.querySelectorAll(`[data-layer-key="${baseType}"]`);
    const lastPanel = allPanels[allPanels.length - 1];
    if (lastPanel && lastPanel.nextSibling) {
        container.insertBefore(details, lastPanel.nextSibling);
    } else {
        container.appendChild(details);
    }

    console.log(`[UI-Gen] Created instance panel: ${baseType}${suffix}`);
    return details;
}

/**
 * [MULTI-INSTANCE] Removes an instance panel from the DOM.
 */
function destroyLayerInstance(baseType, instanceIndex) {
    const container = document.getElementById('dynamic-controls');
    const panel = container.querySelector(
        `[data-layer-key="${baseType}"][data-instance-index="${instanceIndex}"]`
    );
    if (panel) {
        panel.parentElement.removeChild(panel);
        console.log(`[UI-Gen] Removed instance panel: ${baseType}__${instanceIndex}`);
    }
}

/**
 * Recursively suffix all "id"-like fields in a JSON definition.
 */
function suffixAllIds(obj, suffix) {
    if (Array.isArray(obj)) {
        obj.forEach(item => suffixAllIds(item, suffix));
        return;
    }
    if (typeof obj !== 'object' || obj === null) return;

    // Suffix known ID fields
    const idFields = ['id', 'enableId', 'rowId', 'labelId',
        'enableId', 'colorId', 'toleranceId', 'fadeId',
        'shadowThresholdId', 'shadowFadeId', 'highlightThresholdId', 'highlightFadeId',
        'invertId', 'shadowsId', 'midtonesId', 'highlightsId'];

    for (const field of idFields) {
        if (obj[field] && typeof obj[field] === 'string') {
            obj[field] = obj[field] + suffix;
        }
    }

    // Suffix IDs inside customHTML
    if (obj.customHTML && typeof obj.customHTML === 'string') {
        obj.customHTML = obj.customHTML.replace(/id="([^"]+)"/g, (match, id) => `id="${id}${suffix}"`);
        obj.customHTML = obj.customHTML.replace(/data-target="([^"]+)"/g, (match, t) => `data-target="${t}${suffix}"`);
    }

    // Recurse into nested objects and arrays
    for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object') {
            suffixAllIds(obj[key], suffix);
        }
    }
}

/**
 * Builds a <details> element for a single layer from its JSON definition.
 */
function buildLayerDetails(layer, def) {
    const details = document.createElement('details');
    if (layer.detailsId) details.id = layer.detailsId;
    if (layer.open) details.open = true;

    // Build summary with optional enable checkbox
    const summary = document.createElement('summary');

    // Create a flex container for the summary contents to hold title + delete button
    const summaryFlex = document.createElement('div');
    summaryFlex.style.cssText = 'display:flex; justify-content:space-between; align-items:center; width:100%;';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = def.name || layer.name;
    summaryFlex.appendChild(titleSpan);

    // Add a delete button to the summary header
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'Remove Layer';
    deleteBtn.style.cssText = 'background:none; border:none; cursor:pointer; font-size:12px; opacity:0.6; padding:0 4px;';
    deleteBtn.addEventListener('click', (e) => {
        e.preventDefault(); // Prevent details from toggling
        const instanceId = layer.key + '__' + (details.dataset.instanceIndex || '0');
        if (typeof window.removeLayerInstance === 'function') {
            window.removeLayerInstance(instanceId);
        }
    });

    // Hover effect for delete button
    deleteBtn.addEventListener('mouseenter', () => deleteBtn.style.opacity = '1');
    deleteBtn.addEventListener('mouseleave', () => deleteBtn.style.opacity = '0.6');

    summaryFlex.appendChild(deleteBtn);

    // If there's an enable control in the summary
    if (def.enableId) {
        let isDefaultChecked = true;

        if (def.enableDefault !== undefined) {
            isDefaultChecked = (def.enableDefault !== false);
        } else if (def.controls) {
            const innerControl = def.controls.find(c => c.id === def.enableId);
            if (innerControl && innerControl.default === false) {
                isDefaultChecked = false;
            }
        }

        const cb = document.createElement('input');
        cb.id = def.enableId;
        cb.type = 'checkbox';
        cb.checked = isDefaultChecked;
        cb.style.marginLeft = '10px';
        summaryFlex.insertBefore(cb, deleteBtn);
    }

    summary.appendChild(summaryFlex);
    details.appendChild(summary);

    // Build controls
    if (def.controls) {
        for (const ctrl of def.controls) {
            // [BUGFIX] Prevent generating a duplicate checkbox in the body if it's already in the summary
            if (def.enableId && ctrl.id === def.enableId) continue;

            const el = buildControl(ctrl);
            if (el) details.appendChild(el);
        }
    }

    // Build mask group if defined
    if (def.mask) {
        buildMaskGroup(details, def.mask);
    }

    // Inject custom HTML if provided (for complex layers)
    if (def.customHTML) {
        const div = document.createElement('div');
        div.innerHTML = def.customHTML;
        while (div.firstChild) {
            details.appendChild(div.firstChild);
        }
    }

    return details;
}

/**
 * Builds a single control row from a control definition object.
 */
function buildControl(ctrl) {
    switch (ctrl.type) {
        case 'range':
            return buildRangeControl(ctrl);
        case 'select':
            return buildSelectControl(ctrl);
        case 'checkbox':
            return buildCheckboxControl(ctrl);
        case 'color':
            return buildColorControl(ctrl);
        case 'separator':
            return buildSeparator(ctrl);
        case 'hint':
            return buildHint(ctrl);
        case 'hidden-row':
            return buildHiddenRow(ctrl);
        case 'header':
            return buildHeader(ctrl);
        case 'button-row':
            return buildButtonRow(ctrl);
        case 'container':
            return buildContainer(ctrl);
        case 'color-wheel-3way':
            return buildColorWheel3Way(ctrl);
        default:
            console.warn(`[UI-Gen] Unknown control type: ${ctrl.type}`);
            return null;
    }
}

function buildRangeControl(ctrl) {
    const row = document.createElement('div');
    row.className = 'control-row';
    if (ctrl.style) row.setAttribute('style', ctrl.style);
    if (ctrl.rowId) row.id = ctrl.rowId;
    if (ctrl.hidden) row.style.display = 'none';

    const label = document.createElement('label');
    label.textContent = ctrl.label;
    if (ctrl.labelId) label.id = ctrl.labelId;
    row.appendChild(label);

    const input = document.createElement('input');
    input.id = ctrl.id;
    input.type = 'range';
    input.min = ctrl.min ?? 0;
    input.max = ctrl.max ?? 100;
    input.step = ctrl.step ?? 1;
    input.value = ctrl.default ?? ctrl.min ?? 0;
    row.appendChild(input);

    const valueDisplay = document.createElement('input');
    valueDisplay.type = 'text';
    valueDisplay.className = 'control-value';
    valueDisplay.readOnly = true;
    row.appendChild(valueDisplay);

    return row;
}

function buildSelectControl(ctrl) {
    const row = document.createElement('div');
    row.className = 'control-row';

    const label = document.createElement('label');
    label.textContent = ctrl.label;
    row.appendChild(label);

    const select = document.createElement('select');
    select.id = ctrl.id;
    select.className = 'control-value';

    for (const opt of ctrl.options) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.selected) option.selected = true;
        select.appendChild(option);
    }

    row.appendChild(select);
    return row;
}

function buildCheckboxControl(ctrl) {
    const row = document.createElement('div');
    row.className = 'control-row';
    if (ctrl.style) row.setAttribute('style', ctrl.style);

    const label = document.createElement('label');
    label.textContent = ctrl.label;
    row.appendChild(label);

    const input = document.createElement('input');
    input.id = ctrl.id;
    input.type = 'checkbox';
    if (ctrl.default) input.checked = true;
    row.appendChild(input);

    if (ctrl.rightLabel) {
        const rl = document.createElement('label');
        rl.style.cssText = 'color: var(--muted); margin-left: auto;';
        rl.textContent = ctrl.rightLabel;
        row.appendChild(rl);
    }

    return row;
}

function buildColorControl(ctrl) {
    const row = document.createElement('div');
    row.className = 'control-row';

    const label = document.createElement('label');
    label.textContent = ctrl.label;
    row.appendChild(label);

    if (ctrl.eyedropper) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display: flex; align-items: center; gap: 5px;';

        const input = document.createElement('input');
        input.id = ctrl.id;
        input.type = 'color';
        input.value = ctrl.default || '#000000';
        input.style.cssText = 'width: 40px; height: 24px;';
        wrapper.appendChild(input);

        const btnPick = document.createElement('button');
        btnPick.className = 'eyedropper-btn';
        btnPick.dataset.target = ctrl.id;
        btnPick.title = 'Pick from canvas';
        btnPick.textContent = '🖌️';
        wrapper.appendChild(btnPick);

        row.appendChild(wrapper);
    } else {
        const input = document.createElement('input');
        input.id = ctrl.id;
        input.type = 'color';
        input.value = ctrl.default || '#000000';
        input.className = 'control-value';
        if (ctrl.width) input.style.cssText = `width: ${ctrl.width}; height: 24px;`;
        row.appendChild(input);
    }

    return row;
}

function buildSeparator(ctrl) {
    const div = document.createElement('div');
    if (ctrl.dashed) {
        div.style.cssText = 'border-top: 1px dashed var(--border); margin: 8px 0; padding-top: 8px;';
    } else {
        div.style.cssText = `height: ${ctrl.height || 10}px;`;
    }
    return div;
}

function buildHint(ctrl) {
    const row = document.createElement('div');
    row.className = 'control-row';
    row.style.cssText = ctrl.style || 'font-size: 0.8em; color: var(--muted); text-align: center; margin-top: -5px;';
    row.innerHTML = ctrl.text;
    return row;
}

function buildHiddenRow(ctrl) {
    const row = buildRangeControl(ctrl);
    if (row) {
        row.id = ctrl.rowId || '';
        row.style.display = 'none';
    }
    return row;
}

function buildHeader(ctrl) {
    const div = document.createElement('div');
    div.id = ctrl.id || '';
    div.style.cssText = ctrl.style || 'display:none; border-top: 1px dashed var(--border); margin: 8px 0; padding-top: 8px; font-size: 10px; color: var(--accent); opacity: 0.8; text-transform: uppercase; letter-spacing: 1px;';
    div.textContent = ctrl.text || '';
    return div;
}

function buildButtonRow(ctrl) {
    const row = document.createElement('div');
    row.className = ctrl.className || 'row-buttons';
    if (ctrl.style) row.style.cssText = ctrl.style;

    for (const btn of ctrl.buttons) {
        if (btn.type === 'file') {
            const input = document.createElement('input');
            input.type = 'file';
            input.id = btn.id;
            input.style.display = 'none';
            if (btn.accept) input.accept = btn.accept;
            row.appendChild(input);
        } else {
            const button = document.createElement('button');
            button.id = btn.id;
            button.className = btn.className || 'small-btn';
            if (btn.dataTarget) {
                button.classList.add('eyedropper-btn');
                button.dataset.target = btn.dataTarget;
                button.title = btn.title || 'Pick from canvas';
            }
            button.textContent = btn.label;
            row.appendChild(button);
        }
    }

    return row;
}

function buildContainer(ctrl) {
    const div = document.createElement('div');
    div.id = ctrl.id || '';
    div.className = ctrl.className || '';
    return div;
}

function buildColorWheel3Way(ctrl) {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; flex-direction: column; gap: 10px; align-items: center; margin-top: 10px; width: 100%;';

    const wheels = [
        { id: ctrl.shadowsId, label: 'Shadows' },
        { id: ctrl.midtonesId, label: 'Midtones' },
        { id: ctrl.highlightsId, label: 'Highlights' }
    ];

    const wheelContainer = document.createElement('div');
    wheelContainer.style.cssText = 'display: flex; gap: 10px; justify-content: center; width: 100%;';

    wheels.forEach(w => {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 5px; position: relative; width: 30%;';

        const label = document.createElement('div');
        label.textContent = w.label;
        label.style.cssText = 'font-size: 10px; color: var(--muted); text-transform: uppercase;';
        wrap.appendChild(label);

        // Circular background (Hue/Sat map approximation)
        const wheel = document.createElement('div');
        wheel.className = 'color-wheel-interactive';
        wheel.dataset.target = w.id;
        wheel.style.cssText = `
            width: 100%; 
            aspect-ratio: 1/1; 
            border-radius: 50%; 
            background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red);
            border: 2px solid var(--border);
            position: relative;
            cursor: crosshair;
            box-sizing: border-box;
            box-shadow: inset 0 0 10px rgba(0,0,0,0.8);
        `;

        // The inner white gradient to desaturate the center
        const innerGlow = document.createElement('div');
        innerGlow.style.cssText = `
            position: absolute; inset: 0; border-radius: 50%;
            background: radial-gradient(circle at center, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 70%);
            pointer-events: none;
        `;
        wheel.appendChild(innerGlow);

        // Draggable handle
        const handle = document.createElement('div');
        handle.className = 'color-wheel-handle';
        handle.style.cssText = `
            width: 10px; height: 10px; 
            background: transparent; 
            border: 2px solid #fff; 
            border-radius: 50%; 
            position: absolute; 
            top: 50%; left: 50%; 
            transform: translate(-50%, -50%);
            pointer-events: none;
            box-shadow: 0 0 4px rgba(0,0,0,0.8);
        `;
        wheel.appendChild(handle);
        wrap.appendChild(wheel);

        // Hidden input to store the resulting RGB Color
        const input = document.createElement('input');
        input.type = 'color';
        input.id = w.id;
        input.value = '#ffffff'; // Default to white (no tint for gain)
        input.style.display = 'none';
        wrap.appendChild(input);

        wheelContainer.appendChild(wrap);
    });

    container.appendChild(wheelContainer);

    // Reset button
    const btn = document.createElement('button');
    btn.className = 'small-btn btn-reset-wheels';
    btn.textContent = 'RESET WHEELS';
    btn.style.marginTop = '5px';
    container.appendChild(btn);

    return container;
}

/**
 * Builds the standardized mask group (Color Exclusion + Luma Mask + Invert)
 */
function buildMaskGroup(parent, mask) {
    // Separator
    parent.appendChild(buildSeparator({ height: 10 }));

    // Color Exclusion
    if (mask.colorExclude) {
        const ce = mask.colorExclude;
        parent.appendChild(buildCheckboxControl({
            id: ce.enableId, label: 'Color Exclusion', rightLabel: 'Enable'
        }));
        parent.appendChild(buildColorControl({
            id: ce.colorId, label: 'Exclude Color', default: '#000000',
            eyedropper: ce.eyedropper !== false
        }));
        parent.appendChild(buildRangeControl({
            id: ce.toleranceId, label: 'Color Tolerance', min: 0, max: 100, step: 1, default: 10
        }));
        parent.appendChild(buildRangeControl({
            id: ce.fadeId, label: 'Color Fade', min: 0, max: 100, step: 1, default: 20
        }));
    }

    // Separator
    parent.appendChild(buildSeparator({ height: 10 }));

    // Luma Mask
    if (mask.lumaMask) {
        const lm = mask.lumaMask;
        parent.appendChild(buildCheckboxControl({
            id: lm.enableId, label: 'Luma Mask', rightLabel: 'Enable'
        }));
        parent.appendChild(buildRangeControl({
            id: lm.shadowThresholdId, label: 'S. Threshold', min: 0, max: 1, step: 0.01, default: lm.shadowThresholdDefault || 0
        }));
        parent.appendChild(buildRangeControl({
            id: lm.shadowFadeId, label: 'S. Fade', min: 0, max: 1, step: 0.01, default: lm.shadowFadeDefault || 0
        }));
        parent.appendChild(buildRangeControl({
            id: lm.highlightThresholdId, label: 'H. Threshold', min: 0, max: 1, step: 0.01, default: lm.highlightThresholdDefault || 0
        }));
        parent.appendChild(buildRangeControl({
            id: lm.highlightFadeId, label: 'H. Fade', min: 0, max: 1, step: 0.01, default: lm.highlightFadeDefault || 0
        }));
    }

    // Separator + Invert Mask
    parent.appendChild(buildSeparator({ height: 5 }));
    if (mask.invertId) {
        parent.appendChild(buildCheckboxControl({
            id: mask.invertId, label: 'Invert Mask', rightLabel: 'Invert'
        }));
    }
}
