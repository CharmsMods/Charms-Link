import { UI } from '../state/store.js';

export function initDOM() {
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
}
