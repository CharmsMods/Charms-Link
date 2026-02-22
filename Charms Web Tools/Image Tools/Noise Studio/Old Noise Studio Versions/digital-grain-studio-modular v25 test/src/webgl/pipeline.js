import { effectsRegistry } from '../effects/index.js';
import { setupLayerGridDOM } from '../ui/dom_helpers.js';
import { state, UI, LAYERS } from '../state/store.js';
import { reallocateBuffers, createTexture, hexToRgb } from './core.js';

export function updateHistogram() {
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

export function updateVectorscope() {
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





export function renderFrame(isExport = false) {
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

    const uniforms = {
        u_bright: parseFloat(UI.brightness.value),
        u_cont: parseFloat(UI.contrast.value),
        u_sat: parseFloat(UI.saturationAdj.value) / 100.0,
        u_warmth: parseFloat(UI.warmth.value),
        u_sharp: parseFloat(UI.sharpen.value),
        u_sharpThresh: parseFloat(UI.sharpenThreshold.value),
        u_step: [1.0 / w, 1.0 / h],
        u_hdrTol: parseFloat(UI.hdrTolerance.value),
        u_hdrAmt: parseFloat(UI.hdrAmount.value),
        u_ca_amt: calcCurve(parseFloat(UI.aberrationAmount.value), 300, 300),
        u_ca_blur: calcCurve(parseFloat(UI.aberrationBlur.value), 100, 100.0),
        u_ca_center: [state.caCenter.x, state.caCenter.y],
        u_ca_rad: parseFloat(UI.caRadius.value) / 1000.0,
        u_ca_fall: parseFloat(UI.caFalloff.value) / 1000.0,
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
        u_lens_amount: parseFloat(UI.lensAmount?.value ?? 0) / 100.0, // Scale to -1.0 to 1.0
        u_lens_scale: parseFloat(UI.lensScale?.value ?? 100) / 100.0, // Scale to 0.5 to 1.5
        u_heatwave_intensity: parseFloat(UI.heatwaveIntensity?.value ?? 30) / 100.0,
        u_heatwave_speed: parseFloat(UI.heatwaveSpeed?.value ?? 50) / 100.0,
        u_heatwave_scale: parseFloat(UI.heatwaveScale?.value ?? 20),
        u_heatwave_direction: parseInt(UI.heatwaveDirection?.value ?? 0),
        u_lightleaks_intensity: parseFloat(UI.lightLeaksIntensity?.value ?? 50) / 100.0,
        u_lightleaks_color1: hexToRgb(UI.lightLeaksColor1?.value ?? '#ff5500'),
        u_lightleaks_color2: hexToRgb(UI.lightLeaksColor2?.value ?? '#0055ff'),
        u_time: (performance.now() % 100000) / 1000.0
    };

    state.renderOrder.forEach(layerKey => {
        const prefix = layerKey === 'adjust' ? 'adj' : layerKey;
        const toggleId = prefix + 'Enable';

        // Optimized: Skip disabled layers entirely. No ping-pong swap needed.
        if (!state.layerVisibility[layerKey] || (UI[toggleId] && !UI[toggleId].checked)) {
            return;
        }

        try {
            // Execute layer
            if (effectsRegistry[layerKey]) effectsRegistry[layerKey].render(gl, state.pingPong[inputIdx].tex, state.pingPong[outputIdx].fbo, uniforms);

            // Save output for chain preview (and old grid logic)
            state.layerTextures[layerKey] = state.pingPong[outputIdx].tex;

            // [CHAIN PREVIEW FIX] Snapshot the active layer's output to a dedicated texture
            // This prevents the visualization from showing overwrite/stale data due to ping-pong reuse.
            if (state.activeSection && layerKey === state.activeSection && state.fbos.chainCapture) {
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
        } catch (e) {
            console.error(`Error rendering layer ${layerKey}:`, e);
        }
    });

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
            try {
                updateLayerPreviews();
            } catch (e) {
                console.error("Error in updateLayerPreviews:", e);
            }
        }

        // Only update graphs if the section is open (performance optimization)
        const infoDetails = document.querySelector('.info-details');
        if (infoDetails && infoDetails.open) {
            updateHistogram();
            updateVectorscope();
        }

        // CRITICAL FIX: Restore the default framebuffer so the browser properly composites the canvas to the screen!
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

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

export function calcCurve(val, max, scale = 1.0) {
    const norm = val / max;
    return (norm * norm) * scale;
}

export function updateLayerPreviews() {
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

    const uniforms = {
        u_bright: parseFloat(UI.brightness.value),
        u_cont: parseFloat(UI.contrast.value),
        u_sat: parseFloat(UI.saturationAdj.value) / 100.0,
        u_warmth: parseFloat(UI.warmth.value),
        u_sharp: parseFloat(UI.sharpen.value),
        u_sharpThresh: parseFloat(UI.sharpenThreshold.value),
        u_step: [1.0 / state.renderWidth, 1.0 / state.renderHeight],
        u_hdrTol: parseFloat(UI.hdrTolerance.value),
        u_hdrAmt: parseFloat(UI.hdrAmount.value),
        u_ca_amt: calcCurve(parseFloat(UI.aberrationAmount.value), 300, 300),
        u_ca_blur: calcCurve(parseFloat(UI.aberrationBlur.value), 100, 100.0),
        u_ca_center: [state.caCenter.x, state.caCenter.y],
        u_ca_rad: parseFloat(UI.caRadius.value) / 1000.0,
        u_ca_fall: parseFloat(UI.caFalloff.value) / 1000.0,
        u_airy_intensity: parseFloat(UI.airyBloomIntensity?.value ?? 0.5),
        u_airy_aperture: parseFloat(UI.airyBloomAperture?.value ?? 3.0),
        u_airy_threshold: parseFloat(UI.airyBloomThreshold?.value ?? 0.7),
        u_glare_intensity: parseFloat(UI.glareRaysIntensity?.value ?? 0.4),
        u_glare_rays: parseFloat(UI.glareRaysRays?.value ?? 6),
        u_glare_length: parseFloat(UI.glareRaysLength?.value ?? 0.3),
        u_glare_blur: parseFloat(UI.glareRaysBlur?.value ?? 0.2),
    };

    if (effectsRegistry[section]) effectsRegistry[section].render(gl, inputTex, state.fbos.preview, uniforms, true);
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



export function requestRender() {
    if (!state._renderRequested && state.baseImage) {
        state._renderRequested = true;
        requestAnimationFrame(() => {
            renderFrame();
            state._renderRequested = false;
        });
    }
}

export function drawToThumbnail(tex, canvasId, channel = 0) {
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

export function renderMaskForSection(section, inputTex) {
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

export function renderCAFalloff() {
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



