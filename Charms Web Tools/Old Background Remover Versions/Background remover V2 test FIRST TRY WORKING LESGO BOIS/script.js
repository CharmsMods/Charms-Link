// Image Color Fader - Main JavaScript File (with Invert Selection and Area Selection)

// Get DOM elements
const imageUpload = document.getElementById('imageUpload');
const imageCanvas = document.getElementById('imageCanvas');
const ctx = imageCanvas.getContext('2d', { willReadFrequently: true }); // Optimize for frequent reads
const opacitySlider = document.getElementById('opacitySlider');
const toleranceToggle = document.getElementById('toleranceToggle');
const toleranceSliderContainer = document.getElementById('toleranceSliderContainer');
const toleranceStrengthSlider = document.getElementById('toleranceStrengthSlider');
const invertSelectionToggle = document.getElementById('invertSelectionToggle');
const antiAliasingToggle = document.getElementById('antiAliasingToggle');
const smoothingSliderContainer = document.getElementById('smoothingSliderContainer');
const smoothingFactorSlider = document.getElementById('smoothingFactorSlider');
const hexDisplay = document.getElementById('hexDisplay');
const rgbDisplay = document.getElementById('rgbDisplay');
const resolutionDisplay = document.getElementById('resolutionDisplay');
const colorSwatch = document.getElementById('colorSwatch');
const resetButton = document.getElementById('resetButton');
const downloadButton = document.getElementById('downloadButton');
const applyButton = document.getElementById('applyButton');
const messageBox = document.getElementById('message-box');
const messageText = document.getElementById('message-text');
const copyHexButton = document.getElementById('copyHexButton');
const copyRgbButton = document.getElementById('copyRgbButton');
const colorReplacementToggle = document.getElementById('colorReplacementToggle');
const colorPickerContainer = document.getElementById('colorPickerContainer');
const replacementColorPicker = document.getElementById('replacementColorPicker');
const replacementColorDisplay = document.getElementById('replacementColorDisplay');
const realtimePreviewToggle = document.getElementById('realtimePreviewToggle');
const previewButton = document.getElementById('previewButton');
const performanceWarning = document.getElementById('performance-warning');
const dismissWarning = document.getElementById('dismiss-warning');
const areaSelectionToggle = document.getElementById('areaSelectionToggle'); // NEW: Area Selection Toggle

// Global variables to store image data and selected color
let originalImage = new Image();
let originalImageData = null;
let selectedColor = null; // {r, g, b}

// NEW: Area Selection Global Variables
let isAreaSelectionMode = false;
let selectedAreaPixels = new Set(); // Stores "x,y" strings for efficient lookup

// Performance tracking variables
let isRealtimePreviewEnabled = true;
let performanceCheckCount = 0;
let totalProcessingTime = 0;
let isPerformanceModeActive = false;

/**
 * Displays a message in the message box.
 * @param {string} message - The message to display.
 * @param {string} type - 'success', 'error', or 'info'.
 */
function showMessage(message, type) {
    messageBox.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800', 'bg-blue-100', 'text-blue-800');
    messageText.textContent = message;

    if (type === 'success') {
        messageBox.classList.add('bg-green-100', 'text-green-800');
    } else if (type === 'error') {
        messageBox.classList.add('bg-red-100', 'text-red-800');
    } else { // default to info
        messageBox.classList.add('bg-blue-100', 'text-blue-800');
    }

    // Hide message after 5 seconds
    setTimeout(() => {
        messageBox.classList.add('hidden');
    }, 5000);
}

/**
 * Converts RGB values to a Hexadecimal string. (No Change)
 * @param {number} r - Red component (0-255).
 * @param {number} g - Green component (0-255).
 * @param {number} b - Blue component (0-255).
 * @returns {string} - Hexadecimal color string (e.g., "#RRGGBB").
 */
function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

/**
 * Converts a hexadecimal color string to RGB values. (No Change)
 * @param {string} hex - Hexadecimal color string (e.g., "#RRGGBB").
 * @returns {object} - RGB color object {r, g, b}.
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Calculates perceptually uniform color distance between two RGB colors. (No Change)
 * Uses weighted Euclidean distance that better matches human vision.
 * @param {object} color1 - {r, g, b}
 * @param {object} color2 - {r, g, b}
 * @returns {number} - The perceptual distance between the two colors.
 */
function colorDistance(color1, color2) {
    const dr = color1.r - color2.r;
    const dg = color1.g - color2.g;
    const db = color1.b - color2.b;

    // Perceptual weights: human eyes are more sensitive to green, less to blue
    const rWeight = 0.3;
    const gWeight = 0.59;
    const bWeight = 0.11;

    return Math.sqrt(rWeight * dr * dr + gWeight * dg * dg + bWeight * db * db);
}

/**
 * Applies gamma correction to opacity for more natural-feeling transparency. (No Change)
 * @param {number} opacity - Linear opacity value (0-1)
 * @returns {number} - Gamma-corrected opacity value
 */
function applyOpacityGamma(opacity) {
    return Math.pow(opacity, 2.2);
}

/**
 * Advanced interpolation function with multiple curve types. (No Change)
 * @param {number} t - Progress value (0-1)
 * @param {number} smoothingFactor - Smoothing factor (0.1-1.0)
 * @returns {number} - Interpolated value with smooth falloff
 */
function smoothInterpolation(t, smoothingFactor) {
    t = Math.max(0, Math.min(1, t));

    if (smoothingFactor <= 0.3) {
        return (1 - Math.cos(t * Math.PI)) / 2;
    } else if (smoothingFactor <= 0.7) {
        return t * t * (3 - 2 * t);
    } else {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
}

/**
 * NEW: Executes a Flood Fill algorithm to find all connected pixels 
 * within the tolerance of the starting pixel's color.
 * @param {number} startX - The x coordinate of the starting pixel.
 * @param {number} startY - The y coordinate of the starting pixel.
 * @param {object} targetColor - {r, g, b} of the starting pixel.
 * @param {number} toleranceRadius - The max color distance allowed.
 */
function runFloodFill(startX, startY, targetColor, toleranceRadius) {
    if (!originalImageData) return;
    
    // Reset previous selection
    selectedAreaPixels.clear(); 

    const width = originalImageData.width;
    const height = originalImageData.height;
    // Map to track visited pixels (1D index)
    const visited = new Array(width * height).fill(false); 
    const queue = [{ x: startX, y: startY }];
    
    // Helper to get 1D index
    const getIndex = (x, y) => y * width + x;

    // Helper to get color at a 1D index
    const getColorAtIndex = (index) => {
        const data = originalImageData.data;
        return { r: data[index * 4], g: data[index * 4 + 1], b: data[index * 4 + 2] };
    };

    // The main loop
    while (queue.length > 0) {
        const { x, y } = queue.shift();
        const index = getIndex(x, y);

        // Check if we're out of bounds or already visited
        if (x < 0 || x >= width || y < 0 || y >= height || visited[index]) {
            continue;
        }

        const currentColor = getColorAtIndex(index);
        const distance = colorDistance(targetColor, currentColor);

        // If the color is within tolerance
        if (distance <= toleranceRadius) {
            visited[index] = true;
            selectedAreaPixels.add(`${x},${y}`); // Store coordinates as a string key

            // Add neighbors to the queue (4-connectivity for speed)
            queue.push({ x: x + 1, y: y });
            queue.push({ x: x - 1, y: y });
            queue.push({ x: x, y: y + 1 });
            queue.push({ x: x, y: y - 1 });
        }
    }
}


/**
 * Loads the selected image onto the canvas. (Updated with new reset logic)
 * @param {Event} event - The file input change event.
 */
function loadImage(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        originalImage = new Image();
        originalImage.onload = function () {
            imageCanvas.width = originalImage.width;
            imageCanvas.height = originalImage.height;
            resolutionDisplay.textContent = `${originalImage.width} × ${originalImage.height}`;
            ctx.drawImage(originalImage, 0, 0);
            originalImageData = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
            showMessage('Image loaded successfully! Click on the image to pick a color.', 'success');
            
            // Reset controls
            selectedColor = null;
            opacitySlider.value = 0;
            toleranceToggle.checked = true;
            toleranceSliderContainer.classList.remove('hidden');
            toleranceStrengthSlider.value = 20;
            invertSelectionToggle.checked = false; 
            antiAliasingToggle.checked = true;
            smoothingSliderContainer.classList.remove('hidden');
            smoothingFactorSlider.value = 1.0;
            colorReplacementToggle.checked = false;
            colorPickerContainer.classList.add('hidden');
            replacementColorPicker.value = '#ff0000';
            replacementColorDisplay.textContent = '#FF0000';
            isRealtimePreviewEnabled = true;
            realtimePreviewToggle.checked = true;
            realtimePreviewToggle.classList.remove('disabled');
            realtimePreviewToggle.parentElement.classList.remove('disabled');
            previewButton.classList.add('hidden');
            hidePerformanceWarning();
            performanceCheckCount = 0;
            totalProcessingTime = 0;
            isPerformanceModeActive = false;
            hexDisplay.textContent = '#FFFFFF';
            rgbDisplay.textContent = 'rgb(255, 255, 255)';
            colorSwatch.style.backgroundColor = '#FFFFFF';

            // NEW: Reset Area Selection
            areaSelectionToggle.checked = false;
            selectedAreaPixels.clear();
        };
        originalImage.onerror = function () {
            showMessage('Could not load image. Please try a different file.', 'error');
        };
        originalImage.src = e.target.result;
    };
    reader.onerror = function () {
        showMessage('Error reading file. Please try again.', 'error');
    };
    reader.readAsDataURL(file);
}

/**
 * Picks a color from the canvas at the clicked coordinates. (UPDATED for Area Selection Mode)
 * @param {Event} event - The mouse click event on the canvas.
 */
function pickColor(event) {
    if (!originalImageData) {
        showMessage('Please upload an image first.', 'info');
        return;
    }

    const rect = imageCanvas.getBoundingClientRect();
    const scaleX = imageCanvas.width / rect.width;
    const scaleY = imageCanvas.height / rect.height;
    const x = Math.floor((event.clientX - rect.left) * scaleX);
    const y = Math.floor((event.clientY - rect.top) * scaleY);

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    selectedColor = { r: pixel[0], g: pixel[1], b: pixel[2] };

    hexDisplay.textContent = rgbToHex(selectedColor.r, selectedColor.g, selectedColor.b);
    rgbDisplay.textContent = `rgb(${selectedColor.r}, ${selectedColor.g}, ${selectedColor.b})`;
    colorSwatch.style.backgroundColor = `rgb(${selectedColor.r}, ${selectedColor.g}, ${selectedColor.b})`;

    // NEW: Check Selection Mode
    isAreaSelectionMode = areaSelectionToggle.checked;

    if (isAreaSelectionMode) {
        // Area Mode: Run Flood Fill to define the selected pixels
        const currentToleranceRadius = parseFloat(toleranceStrengthSlider.value);
        runFloodFill(x, y, selectedColor, currentToleranceRadius);
        showMessage('Area picked! Adjust opacity/tolerance to see the effect.', 'info');
    } else {
        // Global Mode: Clear area selection
        selectedAreaPixels.clear(); 
        showMessage('Color picked! Adjust opacity or toggle tolerance.', 'info');
    }

    applyFilter(true);
}

function showPerformanceWarning() {
    if (!isPerformanceModeActive) {
        isPerformanceModeActive = true;
        performanceWarning.classList.remove('hidden');
        isRealtimePreviewEnabled = false;
        realtimePreviewToggle.checked = false;
        realtimePreviewToggle.classList.add('disabled');
        realtimePreviewToggle.parentElement.classList.add('disabled');
        previewButton.classList.remove('hidden');
        showMessage('Real-time preview disabled due to performance', 'info');
    }
}

function hidePerformanceWarning() {
    performanceWarning.classList.add('hidden');
}

function toggleRealtimePreview(enabled) {
    isRealtimePreviewEnabled = enabled;
    if (enabled) {
        previewButton.classList.add('hidden');
        realtimePreviewToggle.classList.remove('disabled');
        realtimePreviewToggle.parentElement.classList.remove('disabled');
        performanceCheckCount = 0;
        totalProcessingTime = 0;
        isPerformanceModeActive = false;
    } else {
        previewButton.classList.remove('hidden');
    }
}

/**
 * Applies the opacity filter to the image based on selected color, slider, and tolerance.
 * (CRITICAL UPDATE for Area Selection)
 * @param {boolean} forceUpdate - Force update even if real-time preview is disabled
 */
function applyFilter(forceUpdate = false) {
    if (!isRealtimePreviewEnabled && !forceUpdate) {
        return;
    }

    const startTime = performance.now();
    if (!originalImageData || !selectedColor) {
        if (originalImage.src) {
            ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
            ctx.drawImage(originalImage, 0, 0);
        }
        return;
    }

    const imageData = new ImageData(
        new Uint8ClampedArray(originalImageData.data),
        originalImageData.width,
        originalImageData.height
    );
    const data = imageData.data;
    const sliderVal = parseFloat(opacitySlider.value);
    const isToleranceMode = toleranceToggle.checked;
    const isInverted = invertSelectionToggle.checked;
    const currentToleranceRadius = parseFloat(toleranceStrengthSlider.value);
    const isColorReplacement = colorReplacementToggle.checked;
    const replacementColor = isColorReplacement ? hexToRgb(replacementColorPicker.value) : null;
    const isAntiAliasing = antiAliasingToggle.checked;
    
    // NEW: Check Selection Mode
    const isAreaSelectionMode = areaSelectionToggle.checked;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const originalAlpha = originalImageData.data[i + 3];

        let effectFactor = 0; // Represents how much of the effect (0 to 1) to apply.

        if (isAreaSelectionMode) {
            // *** AREA SELECTION MODE LOGIC ***
            const x = (i / 4) % imageData.width;
            const y = Math.floor((i / 4) / imageData.width);
            const pixelKey = `${x},${y}`;
            
            const isSelectedPixel = selectedAreaPixels.has(pixelKey);

            if (isSelectedPixel) {
                // If the pixel is part of the connected area, calculate the anti-aliased edge (if enabled)
                if (isAntiAliasing && isToleranceMode && currentToleranceRadius > 0) {
                    // Re-calculate distance here for the smooth fade effect at the edge
                    const currentPixelColor = { r, g, b };
                    const distance = colorDistance(selectedColor, currentPixelColor);
                    
                    if (distance <= currentToleranceRadius) {
                         const smoothingFactor = parseFloat(smoothingFactorSlider.value);
                         const fadeZone = currentToleranceRadius * smoothingFactor;
                         const coreZone = currentToleranceRadius - fadeZone;
                        
                         if (distance <= coreZone) {
                             effectFactor = isInverted ? 0 : 1;
                         } else {
                             const fadeProgress = (distance - coreZone) / fadeZone;
                             const smoothProgress = smoothInterpolation(fadeProgress, smoothingFactor);
                             effectFactor = isInverted ? smoothProgress : (1 - smoothProgress);
                         }
                    } else {
                        // Beyond tolerance radius, but still in the general selected area (fallback to full effect)
                        effectFactor = isInverted ? 0 : 1;
                    }
                } else {
                    // Full effect (No tolerance/No smoothing/No anti-aliasing)
                    effectFactor = isInverted ? 0 : 1;
                }
            } else {
                // Pixel is OUTSIDE the selected area
                effectFactor = isInverted ? 1 : 0; 
            }
        } else {
            // *** GLOBAL COLOR SELECTION MODE (Existing Logic) ***
            const currentPixelColor = { r, g, b };
            const distance = isToleranceMode 
                ? colorDistance(selectedColor, currentPixelColor) 
                : (r === selectedColor.r && g === selectedColor.g && b === selectedColor.b ? 0 : Infinity);
            
            if (isToleranceMode) {
                if (distance <= currentToleranceRadius) {
                    // Pixel is INSIDE the tolerance radius
                    if (isAntiAliasing && currentToleranceRadius > 0) {
                        const smoothingFactor = parseFloat(smoothingFactorSlider.value);
                        const fadeZone = currentToleranceRadius * smoothingFactor;
                        const coreZone = currentToleranceRadius - fadeZone;
                        
                        if (distance <= coreZone) {
                            effectFactor = isInverted ? 0 : 1;
                        } else {
                            const fadeProgress = (distance - coreZone) / fadeZone;
                            const smoothProgress = smoothInterpolation(fadeProgress, smoothingFactor);
                            effectFactor = isInverted ? smoothProgress : (1 - smoothProgress);
                        }
                    } else {
                        effectFactor = isInverted ? 0 : 1;
                    }
                } else {
                    // Pixel is OUTSIDE the tolerance radius
                    effectFactor = isInverted ? 1 : 0;
                }
            } else { // No tolerance mode, only exact match
                effectFactor = (distance === 0) ? (isInverted ? 0 : 1) : (isInverted ? 1 : 0);
            }
        }


        // Apply the effect based on the calculated effectFactor
        if (effectFactor > 0) {
            if (isColorReplacement) {
                data[i] = Math.round(r + (replacementColor.r - r) * effectFactor);
                data[i + 1] = Math.round(g + (replacementColor.g - g) * effectFactor);
                data[i + 2] = Math.round(b + (replacementColor.b - b) * effectFactor);
                data[i + 3] = originalAlpha;
            } else { // Transparency mode
                const correctedOpacity = applyOpacityGamma(sliderVal);
                data[i + 3] = originalAlpha * (1 - (correctedOpacity * effectFactor));
            }
        } else {
            // No effect, keep original pixel
            data[i + 3] = originalAlpha;
        }
    }

    ctx.putImageData(imageData, 0, 0);

    const endTime = performance.now();
    const processingTime = endTime - startTime;

    if (isRealtimePreviewEnabled && !forceUpdate) {
        performanceCheckCount++;
        totalProcessingTime += processingTime;

        if (processingTime > 750) {
            showPerformanceWarning();
        } else if (performanceCheckCount >= 2) {
            const averageTime = totalProcessingTime / performanceCheckCount;
            if (averageTime > 750) {
                showPerformanceWarning();
            }
            performanceCheckCount = 0;
            totalProcessingTime = 0;
        }
    }
}


/**
 * Resets the image to its original state. (Updated with new reset logic)
 */
function resetImage() {
    if (originalImage.src) {
        ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
        ctx.drawImage(originalImage, 0, 0);
        originalImageData = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
        
        // Reset controls
        selectedColor = null;
        opacitySlider.value = 0;
        toleranceToggle.checked = true;
        toleranceSliderContainer.classList.remove('hidden');
        toleranceStrengthSlider.value = 20;
        invertSelectionToggle.checked = false; 
        antiAliasingToggle.checked = true;
        smoothingSliderContainer.classList.remove('hidden');
        smoothingFactorSlider.value = 1.0;
        colorReplacementToggle.checked = false;
        colorPickerContainer.classList.add('hidden');
        replacementColorPicker.value = '#ff0000';
        replacementColorDisplay.textContent = '#FF0000';
        isRealtimePreviewEnabled = true;
        realtimePreviewToggle.checked = true;
        realtimePreviewToggle.classList.remove('disabled');
        realtimePreviewToggle.parentElement.classList.remove('disabled');
        previewButton.classList.add('hidden');
        hidePerformanceWarning();
        performanceCheckCount = 0;
        totalProcessingTime = 0;
        isPerformanceModeActive = false;
        hexDisplay.textContent = '#FFFFFF';
        rgbDisplay.textContent = 'rgb(255, 255, 255)';
        colorSwatch.style.backgroundColor = '#FFFFFF';

        // NEW: Reset Area Selection
        areaSelectionToggle.checked = false;
        selectedAreaPixels.clear();

        showMessage('Image reset to original state.', 'info');
    } else {
        showMessage('No image loaded to reset.', 'info');
    }
}

/**
 * Saves the current state of the canvas as the new original image data. (Updated with new reset logic)
 */
function applyChanges() {
    if (!originalImageData) {
        showMessage('Please upload an image first.', 'info');
        return;
    }

    originalImageData = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);

    // Reset controls
    selectedColor = null;
    opacitySlider.value = 0;
    toleranceToggle.checked = true;
    toleranceSliderContainer.classList.remove('hidden');
    toleranceStrengthSlider.value = 20;
    invertSelectionToggle.checked = false; 
    antiAliasingToggle.checked = true;
    smoothingSliderContainer.classList.remove('hidden');
    smoothingFactorSlider.value = 1.0;
    colorReplacementToggle.checked = false;
    colorPickerContainer.classList.add('hidden');
    replacementColorPicker.value = '#ff0000';
    replacementColorDisplay.textContent = '#FF0000';
    isRealtimePreviewEnabled = true;
    realtimePreviewToggle.checked = true;
    realtimePreviewToggle.classList.remove('disabled');
    realtimePreviewToggle.parentElement.classList.remove('disabled');
    previewButton.classList.add('hidden');
    hidePerformanceWarning();
    performanceCheckCount = 0;
    totalProcessingTime = 0;
    isPerformanceModeActive = false;
    hexDisplay.textContent = '#FFFFFF';
    rgbDisplay.textContent = 'rgb(255, 255, 255)';
    colorSwatch.style.backgroundColor = '#FFFFFF';

    // NEW: Reset Area Selection
    areaSelectionToggle.checked = false;
    selectedAreaPixels.clear();

    showMessage('Current edits applied! You can now pick a new color on the modified image.', 'success');
}

/**
 * Downloads the current state of the canvas as a PNG image. (No Change)
 */
function downloadImage() {
    if (!originalImageData) {
        showMessage('Please upload and edit an image first to download.', 'info');
        return;
    }

    const dataURL = imageCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = 'edited-image.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showMessage('Image downloaded successfully!', 'success');
}

/**
 * Copies text to clipboard and shows feedback. (No Change)
 * @param {string} text - The text to copy.
 * @param {string} type - The type of value being copied (for feedback message).
 */
async function copyToClipboard(text, type) {
    try {
        await navigator.clipboard.writeText(text);
        showMessage(`${type} value copied to clipboard!`, 'success');
    } catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showMessage(`${type} value copied to clipboard!`, 'success');
        } catch (fallbackErr) {
            showMessage('Failed to copy to clipboard.', 'error');
        }
        document.body.removeChild(textArea);
    }
}

// Event Listeners (UPDATED with new Area Selection Toggle listener)
imageUpload.addEventListener('change', loadImage);
imageCanvas.addEventListener('click', pickColor);
opacitySlider.addEventListener('input', () => { if (isRealtimePreviewEnabled) applyFilter(); });
toleranceToggle.addEventListener('change', () => {
    toleranceSliderContainer.classList.toggle('hidden', !toleranceToggle.checked);
    if (isAreaSelectionMode && selectedColor) {
        // Re-run Flood Fill when tolerance changes in Area Mode
        const currentToleranceRadius = parseFloat(toleranceStrengthSlider.value);
        // Note: x, y for runFloodFill are not stored, so we just prompt re-click for the area
        // However, we still need to applyFilter to update the effect factor if AA is on
        showMessage('Tolerance changed. Please click on the image again to redefine the Area Selection.', 'info');
        selectedAreaPixels.clear(); // Force re-selection
    }
    if (isRealtimePreviewEnabled) applyFilter();
});
toleranceStrengthSlider.addEventListener('input', () => { 
    if (isRealtimePreviewEnabled) {
        // In area mode, simply changing the strength doesn't re-run Flood Fill automatically (too slow), but updates AA/effect factor.
        if (isAreaSelectionMode && selectedColor) {
             showMessage('Tolerance Strength adjusted. Click on the image to redefine the Area Selection.', 'info');
        }
        applyFilter(); 
    } 
});
invertSelectionToggle.addEventListener('change', () => { if (isRealtimePreviewEnabled) applyFilter(); }); 
antiAliasingToggle.addEventListener('change', () => {
    smoothingSliderContainer.classList.toggle('hidden', !antiAliasingToggle.checked);
    if (isRealtimePreviewEnabled) applyFilter();
});
smoothingFactorSlider.addEventListener('input', () => { if (isRealtimePreviewEnabled) applyFilter(); });
resetButton.addEventListener('click', resetImage);
downloadButton.addEventListener('click', downloadImage);
applyButton.addEventListener('click', applyChanges);
copyHexButton.addEventListener('click', () => copyToClipboard(hexDisplay.textContent, 'Hex'));
copyRgbButton.addEventListener('click', () => copyToClipboard(rgbDisplay.textContent, 'RGB'));
colorReplacementToggle.addEventListener('change', () => {
    colorPickerContainer.classList.toggle('hidden', !colorReplacementToggle.checked);
    if (isRealtimePreviewEnabled) applyFilter();
});
replacementColorPicker.addEventListener('input', () => {
    replacementColorDisplay.textContent = replacementColorPicker.value.toUpperCase();
    if (isRealtimePreviewEnabled) applyFilter();
});
realtimePreviewToggle.addEventListener('change', () => toggleRealtimePreview(realtimePreviewToggle.checked));
previewButton.addEventListener('click', () => applyFilter(true));
dismissWarning.addEventListener('click', () => hidePerformanceWarning());

// NEW: Area Selection Mode Toggle Listener
areaSelectionToggle.addEventListener('change', () => {
    selectedAreaPixels.clear(); 
    isAreaSelectionMode = areaSelectionToggle.checked;
    
    if (selectedColor) {
        if (isAreaSelectionMode) {
            showMessage('Switched to Area Selection Mode. Click on the image to define a connected area.', 'info');
        } else {
            showMessage('Switched to Global Color Selection Mode.', 'info');
            applyFilter(true); // Re-run filter globally if a color was selected
        }
    }
});

// Initial state
window.onload = () => {
    if (!originalImage.src) {
        imageCanvas.width = 600;
        imageCanvas.height = 400;
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(0, 0, imageCanvas.width, imageCanvas.height);
        ctx.font = '24px Inter';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#64748b';
        ctx.fillText('Upload an image to get started', imageCanvas.width / 2, imageCanvas.height / 2);
    }
};