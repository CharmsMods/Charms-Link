/* -------------------------
   Elements & state
   ------------------------- */
const fileInput = document.getElementById('imageUpload');
const displayCanvas = document.getElementById('displayCanvas');
const overlayCanvas = document.getElementById('overlayCanvas');
const overlayWrap = document.getElementById('overlayOriginal');

const strengthRange = document.getElementById('strength');
const noiseTypeSelect = document.getElementById('noiseType');
const satStrength = document.getElementById('satStrength');
const satPerNoise = document.getElementById('satPerNoise');

const noiseSizeRange = document.getElementById('noiseSize');
const blurrinessRange = document.getElementById('blurriness');

const enableShadows = document.getElementById('enableShadows');
const shadowThreshold = document.getElementById('shadowThreshold');
const shadowFade = document.getElementById('shadowFade');

const enableHighlights = document.getElementById('enableHighlights');
const highlightThreshold = document.getElementById('highlightThreshold');
const highlightFade = document.getElementById('highlightFade');

const blendModeSelect = document.getElementById('blendMode');
const opacityRange = document.getElementById('opacity');

const brightnessRange = document.getElementById('brightness');
const contrastRange = document.getElementById('contrast');
const saturationAdjRange = document.getElementById('saturationAdj');

const hdrTolerance = document.getElementById('hdrTolerance');
const hdrAmount = document.getElementById('hdrAmount');

const ignoreAlphaToggle = document.getElementById('ignoreAlphaToggle');
const ignoreAlphaStrength = document.getElementById('ignoreAlphaStrength');

const layerGrid = document.getElementById('layerGrid');
const layerPreviewWindow = document.getElementById('layerPreviewWindow');

const realtimeToggle = document.getElementById('realtimeToggle');
const applyBtn = document.getElementById('applyBtn'); // added in DOM
const helpBtn = document.getElementById('helpBtn');
const compareBtn = document.getElementById('compareBtn');
const downloadBtn = document.getElementById('downloadImage');
const exportLayersBtn = document.getElementById('exportLayersBtn');

const compareModal = document.getElementById('compareModal');
const compareOriginal = document.getElementById('compareOriginal');
const compareEdited = document.getElementById('compareEdited');
const exportSideBySideBtn = document.getElementById('exportSideBySide');
const exportStackedBtn = document.getElementById('exportStacked');
const closeCompareBtn = document.getElementById('closeCompare');

const layersModal = document.getElementById('layersModal');
const exportLayersSideBtn = document.getElementById('exportLayersSide');
const exportLayersGridBtn = document.getElementById('exportLayersGrid');
const closeLayersBtn = document.getElementById('closeLayers');

let baseImageCanvas = null;      // full-resolution original
let adjustedImageData = null;    // ImageData after adjustments (for full-res)
let lastNoiseCanvas = null;      // last noise canvas (may be preview or full-res)
let lastMasks = {};              // {combined, shadows, highlights}
let previews = [];               // {name, canvas, src} list for grid

let originalImageLoaded = false;
let realtime = true; // realtime preview on by default

// preview limits (fit into this box while preserving aspect)
const PREVIEW_MAX_W = 1920;
const PREVIEW_MAX_H = 1080;

let lastFullComposite = null; // will hold full-res composite canvas when generated

/* -------------------------
   Utilities
   ------------------------- */
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function gaussianRandom(mean=0,std=1){
  let u=0,v=0; while(u===0) u=Math.random(); while(v===0) v=Math.random();
  return Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v) * std + mean;
}
function rgbToHsl(r,g,b){
  const max=Math.max(r,g,b), min=Math.min(r,g,b); let h,s,l=(max+min)/2;
  if(max===min){h=s=0;}
  else {
    const d = max-min;
    s = l>0.5? d/(2-max-min) : d/(max+min);
    switch(max){case r: h=(g-b)/d + (g<b?6:0); break; case g: h=(b-r)/d + 2; break; default: h=(r-g)/d +4}
    h /= 6;
  }
  return {h,s,l};
}
function hslToRgb(h,s,l){
  let r,g,b;
  if(s===0) r=g=b=l;
  else {
    const hue2rgb=(p,q,t)=>{
      if(t<0) t+=1;
      if(t>1) t-=1;
      if(t<1/6) return p+(q-p)*6*t;
      if(t<1/2) return q;
      if(t<2/3) return p+(q-p)*(2/3-t)*6;
      return p;
    };
    const q = l<0.5? l*(1+s) : l + s - l*s;
    const p = 2*l - q;
    r=hue2rgb(p,q,h+1/3);
    g=hue2rgb(p,q,h);
    b=hue2rgb(p,q,h-1/3);
  }
  return {r,g,b};
}
function smoothstep(min,max,value){
  if(min>max) [min,max]=[max,min];
  const x = Math.max(0, Math.min(1, (value-min)/(max-min)));
  return x*x*(3-2*x);
}
/* slider mapping */
const MAX_NOISE_SIZE = 200.0;
const MAX_BLUR = 5.0;
const SLIDER_MAX = 1000.0;
const ZOOM_EXPONENT = 3.0;
function noiseSizeFromSlider(s){ const t = Math.pow(s/SLIDER_MAX, ZOOM_EXPONENT); return 1.0 + (MAX_NOISE_SIZE-1.0)*t; }
function blurFromSlider(s){ const t = Math.pow(s/SLIDER_MAX, ZOOM_EXPONENT); return MAX_BLUR * t; }
function maskSliderToValue(s){ const v = Math.max(0, Math.min(1, Number(s))); return v*v; }

/* -------------------------
   Main display fit logic
   Uses the current display canvas dimensions (so preview-mode changes immediately reflect)
   ------------------------- */
function fitMainPreview(){
  if (!originalImageLoaded) return;
  const w = displayCanvas.width || (baseImageCanvas ? baseImageCanvas.width : 1);
  const h = displayCanvas.height || (baseImageCanvas ? baseImageCanvas.height : 1);
  const previewArea = document.getElementById('previewArea');
  const areaRect = previewArea.getBoundingClientRect();
  const maxWidth = Math.max(100, areaRect.width - 24);
  const marginBottomIfNotScrolled = 24;
  let maxHeight;
  if (window.scrollY === 0) {
    const availableHeight = window.innerHeight - areaRect.top - marginBottomIfNotScrolled;
    maxHeight = Math.max(60, availableHeight - 16);
  } else {
    maxHeight = window.innerHeight * 0.9;
  }
  const scale = Math.min(maxWidth / w, maxHeight / h);
  const cssWidth = Math.round(w * scale);
  const cssHeight = Math.round(h * scale);
  displayCanvas.style.width = cssWidth + 'px';
  displayCanvas.style.height = cssHeight + 'px';
  overlayCanvas.style.width = cssWidth + 'px';
  overlayCanvas.style.height = cssHeight + 'px';
  previewArea.style.minHeight = (cssHeight + 24) + 'px';
}

/* -------------------------
   New: adjustable image-adj function that works on a provided ImageData and returns a new ImageData
   (this lets us operate on scaled preview copies or full-res copies)
   ------------------------- */
function adjustImageData(srcImageData){
  const w = srcImageData.width, h = srcImageData.height;
  // copy the buffer so we don't mutate the source
  const out = new ImageData(new Uint8ClampedArray(srcImageData.data), w, h);
  const d = out.data;
  const bright = parseFloat(brightnessRange.value) || 0;
  const cont = parseFloat(contrastRange.value) || 100;
  const sat = parseFloat(saturationAdjRange.value) || 0;
  const factor_cont = cont / 100;
  const factor_sat = 1 + sat / 100;
  const offset_bright = bright * 2.55;
  const tol = parseFloat(hdrTolerance.value) || 0.35;
  const amt = parseFloat(hdrAmount.value) || 0;
  for (let i=0;i<d.length;i+=4){
    let r = d[i], g = d[i+1], b = d[i+2];
    const lum = r*0.299 + g*0.587 + b*0.114;
    r = lum + (r - lum) * factor_sat;
    g = lum + (g - lum) * factor_sat;
    b = lum + (b - lum) * factor_sat;
    r = (r - 128) * factor_cont + 128;
    g = (g - 128) * factor_cont + 128;
    b = (b - 128) * factor_cont + 128;
    r += offset_bright; g += offset_bright; b += offset_bright;
    const nl = (0.299*r + 0.587*g + 0.114*b) / 255;
    if (nl < tol){
      const strength = (amt / 100) * (1 - nl / tol);
      r = r * (1 - strength); g = g * (1 - strength); b = b * (1 - strength);
    }
    d[i] = clamp(r,0,255); d[i+1] = clamp(g,0,255); d[i+2] = clamp(b,0,255); d[i+3]=255;
  }
  return out;
}

/* -------------------------
   Generate noise canvas (same as before) - kept name
   ------------------------- */
function generateNoiseFullCanvas(w,h,params){
  const { std, noiseType, blurSlider, noiseSlider, satStrengthVal, satPerNoiseVal, ignoreAlpha, ignoreAlphaStrength } = params;
  const blurPx = blurFromSlider(blurSlider);
  const noiseSize = noiseSizeFromSlider(noiseSlider);
  const smallW = Math.max(1, Math.round(w / noiseSize));
  const smallH = Math.max(1, Math.round(h / noiseSize));
  const smallCanvas = document.createElement('canvas'); smallCanvas.width = smallW; smallCanvas.height = smallH;
  const sCtx = smallCanvas.getContext('2d');
  const img = sCtx.createImageData(smallW, smallH);
  const sd = img.data;
  const isColor = noiseType === 'color';
  for (let y=0;y<smallH;y++){
    for (let x=0;x<smallW;x++){
      const i = (y*smallW + x)*4;
      let vr = 128 + gaussianRandom(0, std);
      let vg = 128 + gaussianRandom(0, std);
      let vb = 128 + gaussianRandom(0, std);
      if (!isColor) { vr = vg = vb; }
      sd[i]=clamp(vr,0,255); sd[i+1]=clamp(vg,0,255); sd[i+2]=clamp(vb,0,255); sd[i+3]=255;
    }
  }
  sCtx.putImageData(img,0,0);
  const nf = document.createElement('canvas'); nf.width = w; nf.height = h;
  const nfCtx = nf.getContext('2d'); nfCtx.imageSmoothingEnabled = true;
  if (blurPx>0){ nfCtx.filter = `blur(${blurPx}px)`; nfCtx.drawImage(smallCanvas,0,0,w,h); nfCtx.filter='none'; }
  else nfCtx.drawImage(smallCanvas,0,0,w,h);

  if (noiseType === 'blend'){
    const noiseMap = nfCtx.getImageData(0,0,w,h);
    const baseData = params.baseData; // optional baseData passed for blend (preview or full-res)
    const out = nfCtx.createImageData(w,h);
    for (let i=0;i<out.data.length;i+=4){
      const v = noiseMap.data[i]/255;
      const centered = (v - 0.5) * 2;
      const combined = (satStrengthVal || 1) * (1 + (satPerNoiseVal || 0)/100);
      const delta = centered * combined;
      const r = baseData[i], g = baseData[i+1], b = baseData[i+2];
      const hsl = rgbToHsl(r/255,g/255,b/255);
      hsl.s = clamp(hsl.s + delta, 0, 2);
      const rgb = hslToRgb(hsl.h,hsl.s,hsl.l);
      out.data[i]=Math.round(rgb.r*255); out.data[i+1]=Math.round(rgb.g*255); out.data[i+2]=Math.round(rgb.b*255); out.data[i+3]=255;
    }
    nfCtx.putImageData(out,0,0);
  }

  // apply mask alpha for shadows/highlights and ignore alpha (works when baseData provided)
  if (enableShadows && enableHighlights && (enableShadows.checked || enableHighlights.checked || ignoreAlpha)){
    const nd = nfCtx.getImageData(0,0,w,h);
    const ndData = nd.data;
    const baseData = params.baseData || (baseImageCanvas ? baseImageCanvas.getContext('2d').getImageData(0,0,w,h).data : null);
    const sh_th = maskSliderToValue(parseFloat(shadowThreshold.value||0.3));
    const sh_f = maskSliderToValue(parseFloat(shadowFade.value||0.2));
    const hi_th = maskSliderToValue(parseFloat(highlightThreshold.value||0.7));
    const hi_f = maskSliderToValue(parseFloat(highlightFade.value||0.2));
    for (let i=0;i<ndData.length;i+=4){
      const r = baseData[i]/255, g = baseData[i+1]/255, b = baseData[i+2]/255;
      const lum = r*0.299 + g*0.587 + b*0.114;
      let sMask = 0, hMask = 0;
      if (enableShadows.checked){ const low = sh_th - sh_f/2, high = sh_th + sh_f/2; sMask = 1 - smoothstep(low, high, lum); }
      if (enableHighlights.checked){ const low = hi_th - hi_f/2, high = hi_th + hi_f/2; hMask = smoothstep(low, high, lum); }
      let tot = Math.max(sMask, hMask);
      if (ignoreAlpha && baseImageCanvas){
        const alpha = 1; // for scaled previews we may not have alpha channel; assume opaque unless special handling needed
        tot *= (1 - ignoreAlphaStrength * (1 - alpha));
      }
      ndData[i+3] = Math.round(255 * tot);
    }
    nfCtx.putImageData(nd,0,0);
  }

  return nf;
}

/* -------------------------
   Compose final composite
   - behaves differently when lowResPreview is ON (creates and uses scaled preview canvases)
   - returns an object {compositeCanvas, usedBaseCanvas, usedAdjustedCanvas, usedNoiseCanvas, usedMasks}
   - also updates displayCanvas / overlayCanvas for UI view
   ------------------------- */
function composeAndRender(){
  if (!originalImageLoaded) return;

  const paramsCommon = {
    std: parseFloat(strengthRange.value)||0,
    noiseType: noiseTypeSelect.value,
    blurSlider: parseFloat(blurrinessRange.value)||0,
    noiseSlider: parseFloat(noiseSizeRange.value)||1,
    satStrengthVal: parseFloat(satStrength.value)||1,
    satPerNoiseVal: parseFloat(satPerNoise.value)||0,
    ignoreAlpha: ignoreAlphaToggle.checked,
    ignoreAlphaStrength: (parseFloat(ignoreAlphaStrength.value)||100)/100
  };

    // full-res path: compute adjustedImageData for full resolution and generate full-res noise/composite
    const fullW = baseImageCanvas.width, fullH = baseImageCanvas.height;
    // compute adjustedImageData for full-res and store globally (used elsewhere)
    const fullSrc = baseImageCanvas.getContext('2d').getImageData(0,0,fullW,fullH);
    adjustedImageData = adjustImageData(fullSrc);

    const params = Object.assign({}, paramsCommon, { baseData: adjustedImageData.data });
    const noiseFull = generateNoiseFullCanvas(fullW, fullH, params);
    lastNoiseCanvas = noiseFull;

    // composite final full-res
    const comp = document.createElement('canvas'); comp.width = fullW; comp.height = fullH;
    const cctx = comp.getContext('2d'); cctx.putImageData(adjustedImageData,0,0);
    cctx.globalAlpha = parseFloat(opacityRange.value) || 1;
    cctx.globalCompositeOperation = blendModeSelect.value || 'source-over';
    cctx.drawImage(noiseFull,0,0);
    cctx.globalAlpha = 1.0; cctx.globalCompositeOperation = 'source-over';

    // draw to display canvas too (full-res)
    displayCanvas.width = fullW; displayCanvas.height = fullH;
    const dctx = displayCanvas.getContext('2d'); dctx.clearRect(0,0,fullW,fullH); dctx.drawImage(comp,0,0);

    // overlay original
    overlayCanvas.width = fullW; overlayCanvas.height = fullH;
    const octx = overlayCanvas.getContext('2d'); octx.clearRect(0,0,fullW,fullH); octx.drawImage(baseImageCanvas,0,0);

    // build masks & layer grid
    buildMasks(fullW, fullH);
    buildLayerGrid(comp, noiseFull, { baseCanvas: baseImageCanvas, adjustedCanvas: (function(){ const c=document.createElement('canvas'); c.width=fullW; c.height=fullH; c.getContext('2d').putImageData(adjustedImageData,0,0); return c; })(), masks: lastMasks });

    // store full composite for download/compare
    lastFullComposite = comp;

    fitMainPreview();
    if (downloadBtn) downloadBtn.disabled = false;
    return { compositeCanvas: comp, baseCanvas: baseImageCanvas, adjustedCanvas: null, noiseCanvas: noiseFull, masks: lastMasks };
}

/* -------------------------
   Build masks from arbitrary ImageData (used for preview path)
   ------------------------- */
function buildMasksFromImageData(imgData, w, h){
  const shadows = document.createElement('canvas'); shadows.width=w; shadows.height=h;
  const highlights = document.createElement('canvas'); highlights.width=w; highlights.height=h;
  const combined = document.createElement('canvas'); combined.width=w; combined.height=h;
  const sctx=shadows.getContext('2d'), hctx=highlights.getContext('2d'), cctx=combined.getContext('2d');
  const sImg = sctx.createImageData(w,h), hImg = hctx.createImageData(w,h), cImg = cctx.createImageData(w,h);
  const sh_th = maskSliderToValue(parseFloat(shadowThreshold.value||0.3));
  const sh_f = maskSliderToValue(parseFloat(shadowFade.value||0.2));
  const hi_th = maskSliderToValue(parseFloat(highlightThreshold.value||0.7));
  const hi_f = maskSliderToValue(parseFloat(highlightFade.value||0.2));
  const src = imgData.data;
  for (let i=0;i<src.length;i+=4){
    const r = src[i]/255, g = src[i+1]/255, b = src[i+2]/255;
    const lum = r*0.299 + g*0.587 + b*0.114;
    let sMask=0, hMask=0;
    if (enableShadows && enableShadows.checked){ const low = sh_th - sh_f/2, high = sh_th + sh_f/2; sMask = 1 - smoothstep(low, high, lum); }
    if (enableHighlights && enableHighlights.checked){ const low = hi_th - hi_f/2, high = hi_th + hi_f/2; hMask = smoothstep(low, high, lum); }
    const tot = Math.max(sMask, hMask);
    const gs = Math.round(255*sMask), gh = Math.round(255*hMask), gc = Math.round(255*tot);
    sImg.data[i]=sImg.data[i+1]=sImg.data[i+2]=gs; sImg.data[i+3]=255;
    hImg.data[i]=hImg.data[i+1]=hImg.data[i+2]=gh; hImg.data[i+3]=255;
    cImg.data[i]=cImg.data[i+1]=cImg.data[i+2]=gc; cImg.data[i+3]=255;
  }
  sctx.putImageData(sImg,0,0); hctx.putImageData(hImg,0,0); cctx.putImageData(cImg,0,0);
  lastMasks = { shadows, highlights, combined };
}

/* -------------------------
   Build grid previews
   Accepts compositeCanvas + noiseCanvas and optional overrides: { baseCanvas, adjustedCanvas, masks }
   This way previews can use scaled canvases (fast) when preview mode is active.
   ------------------------- */
function buildLayerGrid(compositeCanvas, noiseCanvas, overrides){
  layerGrid.innerHTML = '';
  previews = [];
  const w = compositeCanvas.width, h = compositeCanvas.height;
  const baseCanvasUse = (overrides && overrides.baseCanvas) ? overrides.baseCanvas : baseImageCanvas;
  const adjustedCanvasUse = (overrides && overrides.adjustedCanvas) ? overrides.adjustedCanvas : (function(){ const c=document.createElement('canvas'); if (adjustedImageData){ c.width=adjustedImageData.width; c.height=adjustedImageData.height; c.getContext('2d').putImageData(adjustedImageData,0,0);} return c; })();
  const masksUse = (overrides && overrides.masks) ? overrides.masks : lastMasks;

  function appendItem(name, srcCanvas){
    const item = document.createElement('div'); item.className = 'layer-item';
    const titleRow = document.createElement('div'); titleRow.className='layer-title-row';
    const title = document.createElement('div'); title.className='layer-title'; title.textContent = name;
    const actions = document.createElement('div');
    const dlBtn = document.createElement('button'); dlBtn.textContent='Download';
    dlBtn.title = 'Download full-resolution PNG';
    actions.appendChild(dlBtn);
    titleRow.appendChild(title); titleRow.appendChild(actions);
    const canvas = document.createElement('canvas'); canvas.className='layer-canvas';
    canvas.style.width = '100%'; canvas.style.height = 'auto';
    dlBtn.addEventListener('click', ()=> {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = srcCanvas.width;
      tempCanvas.height = srcCanvas.height;
      tempCanvas.getContext('2d').drawImage(srcCanvas, 0, 0);
      const link = document.createElement('a'); link.href = tempCanvas.toDataURL('image/png');
      link.download = `${name.replace(/\s+/g,'_').toLowerCase()}.png`; link.click();
    });
    item.appendChild(titleRow); item.appendChild(canvas);
    layerGrid.appendChild(item);
    previews.push({name, canvas, src: srcCanvas, item});
  }

  if (baseCanvasUse) appendItem('Base Original', baseCanvasUse);
  if (adjustedCanvasUse && adjustedCanvasUse.width) appendItem('Adjusted (with HDR)', adjustedCanvasUse);
  // keep HDR Emulation Result entry (original intent) - may duplicate adjusted depending on context
  if (adjustedCanvasUse && adjustedCanvasUse.width) appendItem('HDR Emulation Result', adjustedCanvasUse);
  if (noiseCanvas) appendItem('Noise Layer', noiseCanvas);
  if (masksUse && masksUse.combined) appendItem('Mask (combined)', masksUse.combined);
  if (masksUse && masksUse.shadows) appendItem('Shadows Mask', masksUse.shadows);
  if (masksUse && masksUse.highlights) appendItem('Highlights Mask', masksUse.highlights);
  if (compositeCanvas) appendItem('Composite (Edited)', compositeCanvas);

  // Let CSS handle the grid columns for responsiveness
  layerPreviewWindow.style.maxHeight = Math.max(200, Math.min(window.innerHeight, Math.round(window.innerHeight * 0.9))) + 'px';
  layerPreviewWindow.style.overflow = 'auto';

  // Update layer previews after grid is built
  updateLayerPreviews();
}

/* -------------------------
   Update layer preview canvases to match display resolution and DPI
   ------------------------- */
function updateLayerPreviews() {
  if (previews.length === 0) return;
  const dpr = window.devicePixelRatio || 1;
  previews.forEach(p => {
    const rect = p.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const srcW = p.src.width;
    const srcH = p.src.height;
    const requiredW = rect.width * dpr;
    const requiredH = rect.height * dpr;
    const useW = Math.min(requiredW, srcW);
    const useH = Math.min(requiredH, srcH);
    p.canvas.width = useW;
    p.canvas.height = useH;
    const ctx = p.canvas.getContext('2d');
    ctx.clearRect(0, 0, useW, useH);
    const scaleX = useW / rect.width;
    const scaleY = useH / rect.height;
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(p.src, 0, 0, srcW, srcH, 0, 0, rect.width, rect.height);
  });
}

/* -------------------------
   Helper: build full-res masks (unchanged original behavior)
   ------------------------- */
function buildMasks(w,h){
  if (!adjustedImageData) return;
  const shadows = document.createElement('canvas'); shadows.width=w; shadows.height=h;
  const highlights = document.createElement('canvas'); highlights.width=w; highlights.height=h;
  const combined = document.createElement('canvas'); combined.width=w; combined.height=h;
  const sctx=shadows.getContext('2d'), hctx=highlights.getContext('2d'), cctx=combined.getContext('2d');
  const src = adjustedImageData.data;
  const sImg = sctx.createImageData(w,h), hImg = hctx.createImageData(w,h), cImg = cctx.createImageData(w,h);
  const sh_th = maskSliderToValue(parseFloat(shadowThreshold.value||0.3));
  const sh_f = maskSliderToValue(parseFloat(shadowFade.value||0.2));
  const hi_th = maskSliderToValue(parseFloat(highlightThreshold.value||0.7));
  const hi_f = maskSliderToValue(parseFloat(highlightFade.value||0.2));
  for (let i=0;i<src.length;i+=4){
    const r = src[i]/255, g = src[i+1]/255, b = src[i+2]/255;
    const lum = r*0.299 + g*0.587 + b*0.114;
    let sMask=0, hMask=0;
    if (enableShadows && enableShadows.checked){ const low = sh_th - sh_f/2, high = sh_th + sh_f/2; sMask = 1 - smoothstep(low, high, lum); }
    if (enableHighlights && enableHighlights.checked){ const low = hi_th - hi_f/2, high = hi_th + hi_f/2; hMask = smoothstep(low, high, lum); }
    const tot = Math.max(sMask, hMask);
    const gs = Math.round(255*sMask), gh = Math.round(255*hMask), gc = Math.round(255*tot);
    sImg.data[i]=sImg.data[i+1]=sImg.data[i+2]=gs; sImg.data[i+3]=255;
    hImg.data[i]=hImg.data[i+1]=hImg.data[i+2]=gh; hImg.data[i+3]=255;
    cImg.data[i]=cImg.data[i+1]=cImg.data[i+2]=gc; cImg.data[i+3]=255;
  }
  sctx.putImageData(sImg,0,0); hctx.putImageData(hImg,0,0); cctx.putImageData(cImg,0,0);
  lastMasks = { shadows, highlights, combined };
}

/* -------------------------
   UI wiring & event handling
   ------------------------- */
function setupUIListeners(){
  const inputElements = [
    strengthRange, noiseTypeSelect, satStrength, satPerNoise,
    noiseSizeRange, blurrinessRange,
    enableShadows, shadowThreshold, shadowFade,
    enableHighlights, highlightThreshold, highlightFade,
    blendModeSelect, opacityRange,
    brightnessRange, contrastRange, saturationAdjRange,
    hdrTolerance, hdrAmount,
    ignoreAlphaToggle, ignoreAlphaStrength
  ].filter(Boolean);

  inputElements.forEach(el => {
    el.addEventListener('input', (ev) => {
      if (realtime) { composeAndRender(); }
    });
    el.addEventListener('change', ()=> {
      composeAndRender();
    });
  });

  if (realtimeToggle) {
    realtimeToggle.addEventListener('click', ()=> {
      realtime = !realtime;
      realtimeToggle.textContent = 'Instant Update ' + (realtime ? 'ON' : 'OFF');
      if (applyBtn) applyBtn.disabled = realtime;
      if (realtime) composeAndRender();
    });
  }

  if (applyBtn) {
    applyBtn.addEventListener('click', ()=> { composeAndRender(); });
  }

  if (helpBtn) {
    helpBtn.addEventListener('click', ()=> {
      alert('Quick tips:\n- Hover the main preview to see the original.\n- Realtime applies live updates (ON by default). Turn off to batch changes and press Apply.\n- Click a layer Download to export it at original resolution.\n- Compare opens side-by-side export options.\n- Export Layers opens options to export all layers side-by-side or in a 2x4 grid at full resolution.\n- Layer previews are scaled to fit in at most 2 rows, with resolution matching screen DPI and zoom; on high-resolution displays or high zoom, they render at original image resolution where possible.');
    });
  }

  if (compareBtn) {
    compareBtn.addEventListener('click', async ()=> {
      if (!originalImageLoaded) return;
      // ensure full-quality composite is ready before opening compare
      await ensureFullQualityComposite();
      compareModal.classList.add('show'); compareModal.setAttribute('aria-hidden','false');
      drawCompareCanvases();
    });
  }
  if (closeCompareBtn) closeCompareBtn.addEventListener('click', ()=> { compareModal.classList.remove('show'); compareModal.setAttribute('aria-hidden','true'); });
  if (exportSideBySideBtn) exportSideBySideBtn.addEventListener('click', ()=> exportCompare('side'));
  if (exportStackedBtn) exportStackedBtn.addEventListener('click', ()=> exportCompare('stack'));

  if (exportLayersBtn) {
    exportLayersBtn.addEventListener('click', async () => {
      if (!originalImageLoaded) return;
      await ensureFullQualityComposite();
      layersModal.classList.add('show'); layersModal.setAttribute('aria-hidden','false');
    });
  }
  if (closeLayersBtn) closeLayersBtn.addEventListener('click', () => { layersModal.classList.remove('show'); layersModal.setAttribute('aria-hidden','true'); });
  if (exportLayersSideBtn) exportLayersSideBtn.addEventListener('click', () => exportLayers('side'));
  if (exportLayersGridBtn) exportLayersGridBtn.addEventListener('click', () => exportLayers('grid'));

  // main download — ensure full-resolution export
  if (downloadBtn) {
    downloadBtn.addEventListener('click', async ()=> {
      if (!originalImageLoaded) return;
      await ensureFullQualityComposite();
      // download lastFullComposite
      if (lastFullComposite) {
        const link = document.createElement('a'); link.href = lastFullComposite.toDataURL('image/png'); link.download = 'edited_image.png'; link.click();
      }
    });
  }

  const previewArea = document.getElementById('previewArea');
  if (previewArea && overlayWrap) {
    previewArea.addEventListener('mouseenter', ()=> overlayWrap.classList.add('show'));
    previewArea.addEventListener('mouseleave', ()=> overlayWrap.classList.remove('show'));
  }
}

/* -------------------------
   Ensure we have a full-resolution composite ready (generate if needed)
   Returns a Promise resolved after generation (so UI can await)
   ------------------------- */
function ensureFullQualityComposite(){
  return new Promise((resolve) => {
    if (!originalImageLoaded) { resolve(); return; }
    // if lastFullComposite exists and likely fresh, still regenerate — we keep it simple: always regenerate at request time
    // (makes sure all current settings are baked into final)
    // generate full-res composite synchronously and store in lastFullComposite
    const prevRealtime = realtime;
    // temporarily force full-res branch
    realtime = false;
    const res = composeAndRender(); // this will create and store lastFullComposite in the full-res branch
    // restore user state for preview (keep lowResPreview as user chose)
    realtime = prevRealtime;
    resolve();
  });
}

/* -------------------------
   compare helpers (use lastFullComposite for edited)
   ------------------------- */
function drawCompareCanvases(){
  if (!baseImageCanvas) return;
  const w = baseImageCanvas.width, h = baseImageCanvas.height;
  const modal = document.querySelector('.modal');
  const rect = modal.getBoundingClientRect();
  const areaW = Math.floor((rect.width - 40) / 2);
  const scale = Math.min(1, areaW / w);
  const cw = Math.round(w * scale), ch = Math.round(h * scale);
  compareOriginal.width = cw; compareOriginal.height = ch;
  compareEdited.width = cw; compareEdited.height = ch;
  compareOriginal.getContext('2d').drawImage(baseImageCanvas,0,0,w,h,0,0,cw,ch);
  // use lastFullComposite (if available) or fallback to current displayCanvas
  const editedSource = lastFullComposite || displayCanvas;
  compareEdited.getContext('2d').drawImage(editedSource,0,0,editedSource.width,editedSource.height,0,0,cw,ch);
}
function exportCompare(mode){
  if (!baseImageCanvas) return;
  const w = baseImageCanvas.width, h = baseImageCanvas.height;
  // ensure full composite available
  const editedSource = lastFullComposite || displayCanvas;
  let out;
  if (mode==='side'){ out = document.createElement('canvas'); out.width = w*2; out.height = h; const c = out.getContext('2d'); c.drawImage(baseImageCanvas,0,0); c.drawImage(editedSource,w,0); }
  else { out = document.createElement('canvas'); out.width = w; out.height = h*2; const c = out.getContext('2d'); c.drawImage(baseImageCanvas,0,0); c.drawImage(editedSource,0,h); }
  const link = document.createElement('a'); link.href = out.toDataURL('image/png'); link.download = (mode==='side' ? 'compare_side_by_side.png' : 'compare_stacked.png'); link.click();
  setTimeout(()=>{ compareModal.classList.remove('show'); compareModal.setAttribute('aria-hidden','true'); }, 300);
}

/* -------------------------
   Export layers helpers
   ------------------------- */
function exportLayers(mode) {
  if (previews.length === 0 || !baseImageCanvas) return;
  const w = baseImageCanvas.width, h = baseImageCanvas.height;
  const N = previews.length;
  let out;
  if (mode === 'side') {
    out = document.createElement('canvas');
    out.width = w * N;
    out.height = h;
    const ctx = out.getContext('2d');
    previews.forEach((p, i) => {
      ctx.drawImage(p.src, i * w, 0);
    });
  } else if (mode === 'grid') {
    out = document.createElement('canvas');
    out.width = w * 2;
    out.height = h * 4;
    const ctx = out.getContext('2d');
    previews.forEach((p, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      ctx.drawImage(p.src, col * w, row * h);
    });
  }
  const link = document.createElement('a');
  link.href = out.toDataURL('image/png');
  link.download = (mode === 'side' ? 'layers_side_by_side.png' : 'layers_grid.png');
  link.click();
  setTimeout(() => {
    layersModal.classList.remove('show');
    layersModal.setAttribute('aria-hidden', 'true');
  }, 300);
}

/* -------------------------
   File input handling
   ------------------------- */
fileInput.addEventListener('change', (ev)=> {
  const f = ev.target.files && ev.target.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => loadImage(img);
    img.src = e.target.result;
  };
  reader.readAsDataURL(f);
});

function loadImage(img){
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  baseImageCanvas = document.createElement('canvas'); baseImageCanvas.width = w; baseImageCanvas.height = h;
  baseImageCanvas.getContext('2d').drawImage(img,0,0,w,h);
  originalImageLoaded = true;
  // initialize overlay/display canvases pixel dims (will be adjusted by composeAndRender)
  displayCanvas.width = w; displayCanvas.height = h;
  overlayCanvas.width = w; overlayCanvas.height = h;
  // initial render (uses lowResPreview by default)
  composeAndRender();
}

/* -------------------------
   init
   ------------------------- */
(function init(){
  function updateSatVisibility(){
    const val = noiseTypeSelect.value;
    document.getElementById('satControls').style.display = (val === 'blend') ? 'flex' : 'none';
    document.getElementById('satPerNoiseRow').style.display = (val === 'blend') ? 'flex' : 'none';
  }
  noiseTypeSelect.addEventListener('change', ()=> { updateSatVisibility(); if (realtime) composeAndRender(); });
  updateSatVisibility();

  setupUIListeners();

  // realtime toggle initial state
  if (realtimeToggle) realtimeToggle.textContent = 'Instant Update: ON';
  if (applyBtn) applyBtn.disabled = true;

  // responsive behavior: recompute layout on resize and on scroll
  window.addEventListener('resize', ()=> {
    fitMainPreview();
    layerPreviewWindow.style.maxHeight = Math.max(200, Math.min(window.innerHeight, Math.round(window.innerHeight * 0.9))) + 'px';
    updateLayerPreviews();
  });
  window.addEventListener('scroll', ()=> {
    fitMainPreview();
  });
})();
