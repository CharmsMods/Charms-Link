# Walkthrough: Integrating Radial Hankel Blur, Glare Rays, and Airy Disk Bloom Effects

This walkthrough details the changes made to `v23.html` to fully integrate the new Radial Hankel Blur, Glare Rays, and Airy Disk Bloom effects into the Noise Studio application.

## 1. Radial Hankel Blur Masking Fixes

The Radial Hankel Blur effect's Luma Mask and Color Exclusion controls were unresponsive due to a prefix mismatch and potential initialization timing issues.

### Changes:
- **Corrected Prefix usage in `renderSingleLayer`:** 
  In the `hankelBlur` rendering block (lines ~5871), the call to `renderMaskForLayer` was updated to use the prefix `'hankel'` instead of `'hankelBlur'`. This matches the IDs defined in the HTML (e.g., `hankelLumaMask`).
  
  ```javascript
  const maskTex = renderMaskForLayer(gl, inputTex, 'hankel'); // Was 'hankelBlur'
  ```

- **Added Controls to `manualIds`:**
  To prevent initialization race conditions where mask controls might not be available when accessed via `UI[...]`, the following IDs were explicitly added to the `manualIds` array (lines ~3829+):
  - `hankelBlurEnable`, `hankelBlurIntensity`, `hankelBlurRadius`, `hankelBlurQuality`
  - `hankelColorExclude`, `hankelExcludeColor`, `hankelColorTolerance`, `hankelColorFade`
  - `hankelLumaMask`, `hankelShadowThreshold`, `hankelShadowFade`, `hankelHighlightThreshold`, `hankelHighlightFade`, `hankelInvertMask`

## 2. Render Layer Order Integration

The new layers (`hankelBlur`, `airyBloom`, `glareRays`) were missing from the "Render Layer Order" drag-and-drop list because `setupDragLayerList` did not account for layers potentially missing from the initialized `state.renderOrder` (e.g., due to loading legacy presets or default state quirks).

### Changes:
- **Dynamic Layer Synchronization in `setupDragLayerList`:**
  Added logic to `setupDragLayerList` (lines ~4870) to automatically verify and synchronize `state.renderOrder` with the `LAYERS` configuration.
  
  This ensures:
  1.  **Missing Layers are Added:** Any valid effect defined in `LAYERS` (excluding internal masks like `shadows`/`highlights`) that is missing from `state.renderOrder` is appended.
  2.  **Obsolete Layers are Removed:** Any keys in `state.renderOrder` that no longer exist in `LAYERS` are filtered out.
  3.  **Visibility Defaults:** New layers default to `visible` if not previously tracked.

  ```javascript
  // [SYNC] Ensure all valid layers from LAYERS are in renderOrder
  const validLayers = Object.keys(LAYERS).filter(k => k !== 'shadows' && k !== 'highlights');
  validLayers.forEach(key => {
      if (!state.renderOrder.includes(key)) {
          state.renderOrder.push(key);
          if (state.layerVisibility[key] === undefined) state.layerVisibility[key] = true;
      }
  });
  // Remove stale keys
  state.renderOrder = state.renderOrder.filter(key => validLayers.includes(key));
  ```

## 3. Shader Pipeline Verification

- Confirmed that `renderSingleLayer` correctly handles `hankelBlur`, `airyBloom`, and `glareRays` cases.
- Verified that `renderFrame` passes the correct uniform values (e.g., `u_airy_intensity`, `u_glare_intensity`) derived from the corresponding UI elements.

## Result

The Radial Hankel Blur, Glare Rays, and Airy Disk Bloom effects are now:
1.  **Visible in the UI:** They appear in the "Render Layer Order" list and can be reordered/toggled.
2.  **Fully Functional:** Their controls (including complex masking for Hankel Blur) work as expected.
3.  **Integrated into the Pipeline:** They render correctly in the image processing chain.
