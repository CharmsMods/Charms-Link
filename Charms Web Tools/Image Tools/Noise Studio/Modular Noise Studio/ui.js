/**
 * UI Handling and Event listeners for Noise Studio
 */

const UI = {};

window.addEventListener('DOMContentLoaded', async () => {
    // 1. Cache DOM Elements
    // Basic Layout & Display
    UI.displayCanvas = document.getElementById('mainCanvas');
    UI.overlayCanvas = document.getElementById('overlayCanvas');
    UI.loading = document.getElementById('loading');
    UI['export-overlay'] = document.getElementById('export-overlay');
    UI['export-status'] = document.getElementById('export-status');
    UI.stopExportBtn = document.getElementById('stopExportBtn');

    // Tools / Adjustments
    UI.brightness = document.getElementById('brightness');
    UI.contrast = document.getElementById('contrast');
    UI.saturationAdj = document.getElementById('saturationAdj');
    UI.warmth = document.getElementById('warmth');
    UI.sharpen = document.getElementById('sharpen');
    UI.sharpenThreshold = document.getElementById('sharpenThreshold');
    UI.adjustEnable = document.getElementById('adjEnable');
    UI.adjLumaMask = document.getElementById('adjLumaMask');
    UI.adjColorExclude = document.getElementById('adjColorExclude');
    UI.adjShadowThreshold = document.getElementById('adjShadowThreshold');
    UI.adjShadowFade = document.getElementById('adjShadowFade');
    UI.adjHighlightThreshold = document.getElementById('adjHighlightThreshold');
    UI.adjHighlightFade = document.getElementById('adjHighlightFade');
    UI.adjExcludeColor = document.getElementById('adjExcludeColor');
    UI.adjColorTolerance = document.getElementById('adjColorTolerance');
    UI.adjColorFade = document.getElementById('adjColorFade');
    UI.adjInvertMask = document.getElementById('adjInvertMask');

    // ... we will extract all the UI references to a mapping logic based on ID later ...

    // Buttons
    UI.downloadBtn = document.getElementById('downloadBtn');
    UI.downloadCurrentBtn = document.getElementById('downloadCurrentBtn');
    UI.compareBtn = document.getElementById('compareBtn');
    UI.prevImageBtn = document.getElementById('prevImageBtn');
    UI.nextImageBtn = document.getElementById('nextImageBtn');
    UI.imageCounter = document.getElementById('imageCounter');
    UI.imageScrubber = document.getElementById('imageScrubber');

    // Modals
    UI.compareModal = document.getElementById('compareModal');
    UI.closeCompareBtn = document.getElementById('closeCompareBtn');
    UI.exportLayoutBtn = document.getElementById('exportLayoutBtn');
    UI.exportLayoutMode = document.getElementById('exportLayoutMode');

    // Initialize WebGL in engine.js
    if (typeof initWebGL === 'function') {
        await initWebGL(UI.displayCanvas);
    } else {
        console.error("engine.js not loaded before ui.js");
    }

    // Set up basic event listeners 
    setupEventListeners();
});

function setupEventListeners() {
    // Basic interaction for dragging images
    const container = document.querySelector('.preview-container');
    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        container.classList.add('dragover');
    });

    container.addEventListener('dragleave', () => container.classList.remove('dragover'));

    container.addEventListener('drop', (e) => {
        e.preventDefault();
        container.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            loadImageFromFile(file); // Needs implementation in engine/ui
        }
    });

    // We will expand on this heavily as we refactor the modular components
}
