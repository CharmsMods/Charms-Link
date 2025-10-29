// Raster to SVG Converter - Vanilla JS Implementation
// Key Algorithms:
// - Grayscale Conversion: Weighted average (0.299R + 0.587G + 0.114B)
// - Binarization: Threshold on grayscale, optional invert
// - Edge Detection (for outline mode): Sobel operator for gradients, threshold on magnitude
// - Contour Tracing: Suzuki-Abe algorithm (equivalent to OpenCV findContours), follows borders using neighborhood checks
//   - Scans raster, identifies outer/hole borders, traces using clockwise/counter-clockwise neighbor searches
//   - Modifies binary map to mark visited borders with sequence numbers
// - Path Simplification: Ramer-Douglas-Peucker (RDP) algorithm
//   - Recursive: Finds farthest point from line segment, splits if exceeds epsilon, else keeps endpoints
//   - Caps vertex count indirectly via epsilon; warn if paths too complex
// - SVG Generation: Builds <path> elements with M/L/Z commands for polylines/polygons
// - Performance: Auto-downscale large images, setTimeout for non-blocking process, but may still lag on huge inputs
// - Limitations: No color posterization; simple single-step undo; no advanced smoothing (straight lines only)

// FindContours module (based on OpenCV-like implementation)
const FindContours = (function() {
    let that = {};
    const N_PIXEL_NEIGHBOR = 8;

    // Neighbor ID to index (counter-clockwise)
    function neighborIDToIndex(i, j, id) {
        if (id == 0) return [i, j + 1];
        if (id == 1) return [i - 1, j + 1];
        if (id == 2) return [i - 1, j];
        if (id == 3) return [i - 1, j - 1];
        if (id == 4) return [i, j - 1];
        if (id == 5) return [i + 1, j - 1];
        if (id == 6) return [i + 1, j];
        if (id == 7) return [i + 1, j + 1];
        return null;
    }

    // Neighbor index to ID
    function neighborIndexToID(i0, j0, i, j) {
        let di = i - i0;
        let dj = j - j0;
        if (di == 0 && dj == 1) return 0;
        if (di == -1 && dj == 1) return 1;
        if (di == -1 && dj == 0) return 2;
        if (di == -1 && dj == -1) return 3;
        if (di == 0 && dj == -1) return 4;
        if (di == 1 && dj == -1) return 5;
        if (di == 1 && dj == 0) return 6;
        if (di == 1 && dj == 1) return 7;
        return -1;
    }

    // First counter-clockwise non-zero neighbor
    function ccwNon0(F, w, h, i0, j0, i, j, offset) {
        let id = neighborIndexToID(i0, j0, i, j);
        for (let k = 0; k < N_PIXEL_NEIGHBOR; k++) {
            let kk = (k + id + offset + N_PIXEL_NEIGHBOR * 2) % N_PIXEL_NEIGHBOR;
            let ij = neighborIDToIndex(i0, j0, kk);
            if (ij[0] >= 0 && ij[0] < h && ij[1] >= 0 && ij[1] < w && F[ij[0] * w + ij[1]] != 0) {
                return ij;
            }
        }
        return null;
    }

    // First clockwise non-zero neighbor
    function cwNon0(F, w, h, i0, j0, i, j, offset) {
        let id = neighborIndexToID(i0, j0, i, j);
        for (let k = 0; k < N_PIXEL_NEIGHBOR; k++) {
            let kk = (-k + id - offset + N_PIXEL_NEIGHBOR * 2) % N_PIXEL_NEIGHBOR;
            let ij = neighborIDToIndex(i0, j0, kk);
            if (ij[0] >= 0 && ij[0] < h && ij[1] >= 0 && ij[1] < w && F[ij[0] * w + ij[1]] != 0) {
                return ij;
            }
        }
        return null;
    }

    // Point distance to line segment
    that.pointDistanceToSegment = function(p, p0, p1) {
        let x = p[0], y = p[1];
        let x1 = p0[0], y1 = p0[1];
        let x2 = p1[0], y2 = p1[1];
        let A = x - x1, B = y - y1;
        let C = x2 - x1, D = y2 - y1;
        let dot = A * C + B * D;
        let len_sq = C * C + D * D;
        let param = -1;
        if (len_sq != 0) param = dot / len_sq;
        let xx, yy;
        if (param < 0) {
            xx = x1; yy = y1;
        } else if (param > 1) {
            xx = x2; yy = y2;
        } else {
            xx = x1 + param * C; yy = y1 + param * D;
        }
        let dx = x - xx, dy = y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    };

    // Ramer-Douglas-Peucker simplification
    that.approxPolyDP = function(polyline, epsilon) {
        if (polyline.length < 3) return polyline.slice();
        let firstPoint = polyline[0];
        let lastPoint = polyline[polyline.length - 1];
        let index = -1;
        let dist = 0;
        for (let i = 1; i < polyline.length - 1; i++) {
            let cDist = that.pointDistanceToSegment(polyline[i], firstPoint, lastPoint);
            if (cDist > dist) {
                dist = cDist;
                index = i;
            }
        }
        if (dist > epsilon) {
            let left = that.approxPolyDP(polyline.slice(0, index + 1), epsilon);
            let right = that.approxPolyDP(polyline.slice(index), epsilon);
            return left.slice(0, left.length - 1).concat(right);
        } else {
            return [firstPoint, lastPoint];
        }
    };

    // Find contours using Suzuki-Abe
    that.findContours = function(F, w, h) {
        let nbd = 1;
        let lnbd = 1;
        let contours = [];
        // Frame borders to 0
        for (let i = 1; i < h - 1; i++) {
            F[i * w] = 0;
            F[i * w + w - 1] = 0;
        }
        for (let i = 0; i < w; i++) {
            F[i] = 0;
            F[w * h - 1 - i] = 0;
        }
        for (let i = 1; i < h - 1; i++) {
            lnbd = 1;
            for (let j = 1; j < w - 1; j++) {
                if (F[i * w + j] == 0) continue;
                let i2 = 0, j2 = 0;
                if (F[i * w + j] == 1 && F[i * w + (j - 1)] == 0) {
                    nbd++;
                    i2 = i; j2 = j - 1;
                } else if (F[i * w + j] >= 1 && F[i * w + j + 1] == 0) {
                    nbd++;
                    i2 = i; j2 = j + 1;
                    if (F[i * w + j] > 1) lnbd = F[i * w + j];
                } else {
                    if (F[i * w + j] != 1) lnbd = Math.abs(F[i * w + j]);
                    continue;
                }
                let contour = { points: [[j, i]], isHole: (j2 == j + 1), id: nbd };
                contours.push(contour);
                let parentContour = contours.find(c => c.id == lnbd);
                if (parentContour) {
                    if (parentContour.isHole) {
                        contour.parent = contour.isHole ? parentContour.parent : lnbd;
                    } else {
                        contour.parent = contour.isHole ? lnbd : parentContour.parent;
                    }
                }
                let i1j1 = cwNon0(F, w, h, i, j, i2, j2, 0);
                if (i1j1 == null) {
                    F[i * w + j] = -nbd;
                    if (F[i * w + j] != 1) lnbd = Math.abs(F[i * w + j]);
                    continue;
                }
                let i1 = i1j1[0], j1 = i1j1[1];
                i2 = i1; j2 = j1;
                let i3 = i, j3 = j;
                while (true) {
                    let i4j4 = ccwNon0(F, w, h, i3, j3, i2, j2, 1);
                    let i4 = i4j4[0], j4 = i4j4[1];
                    contour.points.push([j4, i4]);
                    if (F[i3 * w + j3 + 1] == 0) {
                        F[i3 * w + j3] = -nbd;
                    } else if (F[i3 * w + j3] == 1) {
                        F[i3 * w + j3] = nbd;
                    }
                    if (i4 == i && j4 == j && i3 == i1 && j3 == j1) {
                        if (F[i * w + j] != 1) lnbd = Math.abs(F[i * w + j]);
                        break;
                    }
                    i2 = i3; j2 = j3;
                    i3 = i4; j3 = j4;
                }
            }
        }
        return contours;
    };

    return that;
})();

// Main app logic
let image, canvas, ctx, imageData;
let svgString = '';
let previousSvg = null;
const maxPixels = 1000000; // Cap for performance
const maxVertices = 10000; // Warn if total vertices exceed

// Load and downsample image
function loadImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        image = new Image();
        image.onload = () => {
            let scale = 1;
            if (image.width * image.height > maxPixels) {
                scale = Math.sqrt(maxPixels / (image.width * image.height));
                document.getElementById('status').textContent = 'Image downscaled for performance.';
            }
            canvas = document.createElement('canvas');
            canvas.width = Math.floor(image.width * scale);
            canvas.height = Math.floor(image.height * scale);
            ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            document.getElementById('original').src = canvas.toDataURL();
            document.getElementById('original').style.width = `${canvas.width}px`;
            document.getElementById('original').style.height = `${canvas.height}px`;
            document.getElementById('svg-preview').setAttribute('width', canvas.width);
            document.getElementById('svg-preview').setAttribute('height', canvas.height);
            document.getElementById('status').textContent += ` Working resolution: ${canvas.width}x${canvas.height}.`;
            processImage();
        };
        image.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Event listeners
document.getElementById('file-input').addEventListener('change', (e) => loadImage(e.target.files[0]));
const dragArea = document.getElementById('drag-area');
dragArea.addEventListener('dragover', (e) => e.preventDefault());
dragArea.addEventListener('drop', (e) => {
    e.preventDefault();
    loadImage(e.dataTransfer.files[0]);
});

const thresholdSlider = document.getElementById('threshold');
const thresholdValue = document.getElementById('threshold-value');
thresholdSlider.addEventListener('input', () => {
    thresholdValue.textContent = thresholdSlider.value;
    thresholdSlider.setAttribute('aria-valuenow', thresholdSlider.value);
    processImage();
});

const toleranceSlider = document.getElementById('tolerance');
const toleranceValue = document.getElementById('tolerance-value');
toleranceSlider.addEventListener('input', () => {
    toleranceValue.textContent = toleranceSlider.value;
    toleranceSlider.setAttribute('aria-valuenow', toleranceSlider.value);
    processImage();
});

document.getElementById('invert').addEventListener('change', processImage);
document.getElementById('mode').addEventListener('change', processImage);
document.getElementById('process').addEventListener('click', processImage);

// Process image to SVG
function processImage() {
    if (!imageData) {
        document.getElementById('status').textContent = 'No image loaded.';
        return;
    }
    document.getElementById('status').textContent = 'Processing...';
    setTimeout(() => {
        previousSvg = svgString;
        const threshold = parseInt(thresholdSlider.value);
        const tolerance = parseFloat(toleranceSlider.value);
        const invert = document.getElementById('invert').checked;
        const mode = document.getElementById('mode').value;
        const w = canvas.width;
        const h = canvas.height;
        const data = imageData.data;
        let F = new Uint8Array(w * h); // Binary map
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = (y * w + x) * 4;
                const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                let val = gray < threshold ? 1 : 0; // Foreground = 1 (dark areas)
                if (invert) val = 1 - val;
                F[y * w + x] = val;
            }
        }
        // Edge detection for outline mode (Sobel)
        if (mode === 'outline') {
            let gx = new Float32Array(w * h);
            let gy = new Float32Array(w * h);
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const idx = y * w + x;
                    gx[idx] = F[(y - 1) * w + (x + 1)] + 2 * F[y * w + (x + 1)] + F[(y + 1) * w + (x + 1)] -
                              F[(y - 1) * w + (x - 1)] - 2 * F[y * w + (x - 1)] - F[(y + 1) * w + (x - 1)];
                    gy[idx] = F[(y + 1) * w + (x - 1)] + 2 * F[(y + 1) * w + x] + F[(y + 1) * w + (x + 1)] -
                              F[(y - 1) * w + (x - 1)] - 2 * F[(y - 1) * w + x] - F[(y - 1) * w + (x + 1)];
                }
            }
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const idx = y * w + x;
                    const mag = Math.sqrt((gx[idx] || 0) ** 2 + (gy[idx] || 0) ** 2);
                    F[idx] = mag > 0.1 ? 1 : 0; // Low threshold for edges
                }
            }
        }
        // Trace contours
        const contours = FindContours.findContours(F, w, h);
        let paths = '';
        let totalVertices = 0;
        for (let c of contours) {
            let points = FindContours.approxPolyDP(c.points, tolerance);
            totalVertices += points.length;
            if (points.length < 3) continue;
            let d = `M${points[0][0]} ${points[0][1]}`;
            for (let p = 1; p < points.length; p++) {
                d += ` L${points[p][0]} ${points[p][1]}`;
            }
            d += ' Z';
            const style = mode === 'filled' ? 'fill="black" stroke="none"' : 'stroke="black" fill="none"';
            paths += `<path d="${d}" ${style} />`;
        }
        if (totalVertices > maxVertices) {
            document.getElementById('status').textContent = 'Warning: High vertex count - increase tolerance for simplification.';
        }
        svgString = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
        document.getElementById('svg-preview').innerHTML = paths;
        document.getElementById('status').textContent = 'Done.';
    }, 0); // Non-blocking
}

// Download SVG
document.getElementById('download').addEventListener('click', () => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output.svg';
    a.click();
    URL.revokeObjectURL(url);
});

// Copy SVG code
document.getElementById('copy').addEventListener('click', () => {
    if (!svgString) return;
    navigator.clipboard.writeText(svgString).then(() => {
        document.getElementById('status').textContent = 'SVG code copied to clipboard.';
    }).catch(() => {
        document.getElementById('status').textContent = 'Failed to copy SVG code.';
    });
});

// Reset
document.getElementById('reset').addEventListener('click', () => {
    image = null;
    canvas = null;
    imageData = null;
    svgString = '';
    previousSvg = null;
    document.getElementById('original').src = '';
    document.getElementById('svg-preview').innerHTML = '';
    document.getElementById('status').textContent = 'Ready';
});

// Undo (single-step)
document.getElementById('undo').addEventListener('click', () => {
    if (previousSvg) {
        svgString = previousSvg;
        document.getElementById('svg-preview').innerHTML = previousSvg.replace(/<svg.*?>|<\/svg>/g, '');
        previousSvg = null;
        document.getElementById('status').textContent = 'Undo applied.';
    }
});

// Error handling
window.addEventListener('error', () => {
    document.getElementById('status').textContent = 'Error occurred. Try lower resolution or adjust settings.';
});