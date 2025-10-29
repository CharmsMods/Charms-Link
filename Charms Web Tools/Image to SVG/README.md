README.md
Raster to SVG Converter
A single-page static website for converting raster images (PNG/JPG/WebP) to SVG outlines, implemented with vanilla HTML, CSS, and JavaScript. Runs entirely in the browser with no dependencies.
Usage Notes

Open index.html in a modern browser (Chrome, Firefox, etc.). Works via file:// protocol.
Upload an image via the file input or drag-and-drop.
Adjust controls: mode (outline or filled), threshold, smoothing tolerance, invert.
Click "Process" or change controls for live update (may lag on large images).
Preview shows original with SVG overlay.
Download as .svg file or copy code to clipboard.
Reset clears everything; Undo reverts to previous processing result (single-step).

Known Limitations

Color posterization not implemented (monochrome only).
May freeze UI on very large images despite downscaling; use smaller images or increase tolerance.
No curve smoothing (straight lines only); high vertex counts trigger warning—adjust tolerance.
Simple edge detection (Sobel); may not handle complex images perfectly.
No multi-level undo or advanced precision controls.
Fallback: If processing fails (e.g., too many contours), shows error—try adjusting threshold or reducing image size.

Testing Steps

Open index.html in browser.
Upload a small test image (e.g., simple logo PNG).
Adjust sliders and toggle; verify preview updates.
Download/copy SVG; open in editor to check validity.
Test drag-drop, mobile view (resize window), accessibility (tab navigation, screen reader).
Try large image: confirm downscale and warning if needed.