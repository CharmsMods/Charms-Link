// main.js
// Updated to prefer OffscreenCanvas + Worker (gpu-worker.js) and fall back to synchronous gpu-core.js
// Exposes the same window.GPUCore.init API shape expected by the rest of the app.

// Immediately create a worker-backed GPU shim if available.
// This is placed before the main app logic so the rest of the file can call attachGPUCore() as before.
(function createWorkerShimIfPossible() {
  'use strict';

  // feature-detect: must support Worker and canvas.transferControlToOffscreen
  const canUseWorker = typeof Worker !== 'undefined' && HTMLCanvasElement.prototype.transferControlToOffscreen;

  if (!canUseWorker) {
    // do nothing; the synchronous gpu-core.js will set window.GPUCore when loaded (or main will fall back)
    return;
  }

  // create the worker (path must match where you saved the worker file)
  let worker;
  try {
    worker = new Worker('gpu-worker.js');
  } catch (e) {
    console.warn('Failed to create GPU worker:', e);
    return;
  }

  let workerReady = false;
  let pendingPreviewResolve = null;
  let pendingPreviewReject = null;
  let pendingDownloadResolve = null;
  let pendingDownloadReject = null;
  let lastWorkerError = null;

  // message handler from worker
  worker.onmessage = async (ev) => {
    const msg = ev.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'ready':
        workerReady = true;
        // let the rest of the app know a GPU core is now available
        try {
          window.dispatchEvent(new Event('GPU_CORE_READY'));
        } catch (e) {}
        break;

      case 'uploaded':
        // no-op or could surface status
        break;

      case 'rendered':
        // render finished
        break;

      case 'preview':
        // worker sent an ImageBitmap for the preview (fast)
        if (pendingPreviewResolve) {
          try {
            const bmp = msg.imageBitmap;
            // resolve with the ImageBitmap (ownership transferred by worker)
            pendingPreviewResolve(bmp);
          } catch (e) {
            pendingPreviewReject && pendingPreviewReject(e);
          } finally {
            pendingPreviewResolve = pendingPreviewReject = null;
          }
        }
        break;

      case 'previewBlob':
        // fallback preview as blob (if worker couldn't transfer ImageBitmap)
        if (pendingPreviewResolve) {
          try {
            const blob = msg.blob;
            // Create ImageBitmap from blob
            const bmp = await createImageBitmap(blob);
            pendingPreviewResolve(bmp);
          } catch (e) {
            pendingPreviewReject && pendingPreviewReject(e);
          } finally {
            pendingPreviewResolve = pendingPreviewReject = null;
          }
        }
        break;

      case 'download':
        // worker returned a Blob for the PNG
        if (pendingDownloadResolve) {
          try {
            const blob = msg.blob;
            // convert blob -> dataURL string
            const reader = new FileReader();
            reader.onload = () => {
              pendingDownloadResolve(reader.result);
              pendingDownloadResolve = pendingDownloadReject = null;
            };
            reader.onerror = (err) => {
              pendingDownloadReject && pendingDownloadReject(err);
              pendingDownloadResolve = pendingDownloadReject = null;
            };
            reader.readAsDataURL(blob);
          } catch (e) {
            pendingDownloadReject && pendingDownloadReject(e);
            pendingDownloadResolve = pendingDownloadReject = null;
          }
        }
        break;

      case 'error':
        lastWorkerError = msg.message || 'unknown worker error';
        console.error('GPU worker error:', lastWorkerError);
        // reject any pending promises
        if (pendingPreviewReject) pendingPreviewReject(new Error(lastWorkerError));
        if (pendingDownloadReject) pendingDownloadReject(new Error(lastWorkerError));
        pendingPreviewResolve = pendingPreviewReject = pendingDownloadResolve = pendingDownloadReject = null;
        break;

      default:
        console.warn('Unknown message from GPU worker:', msg);
    }
  };

  worker.onerror = (e) => {
    console.error('GPU worker error event', e);
    lastWorkerError = e.message || String(e);
    workerReady = false;
    try { window.dispatchEvent(new Event('GPU_CORE_READY')); } catch (e) {}
  };

  // Install the shim on window.GPUCore so the rest of your app can call window.GPUCore.init(...)
  window.GPUCore = window.GPUCore || {};
  window.GPUCore.init = function(noiseCanvasElement, originalCanvasElement) {
    if (!worker) throw new Error('GPU worker unavailable');

    // transfer the noiseCanvas to the worker as an OffscreenCanvas
    let offscreen;
    try {
      offscreen = noiseCanvasElement.transferControlToOffscreen();
    } catch (e) {
      console.warn('transferControlToOffscreen failed:', e);
      throw e;
    }

    // send init with transferred canvas
    worker.postMessage({ type: 'init', canvas: offscreen }, [offscreen]);

    // return an API that mirrors the synchronous core
    return {
      uploadImage: (imageBitmapOrElem) => {
        // prefer ImageBitmap transfer if available
        if (imageBitmapOrElem instanceof ImageBitmap) {
          try {
            worker.postMessage({ type: 'uploadImage', imageBitmap: imageBitmapOrElem }, [imageBitmapOrElem]);
          } catch (e) {
            // Some browsers may not allow reusing the ImageBitmap; fallback to transferring via a temporary canvas
            try {
              const tmp = document.createElement('canvas');
              tmp.width = imageBitmapOrElem.width || imageBitmapOrElem.naturalWidth || 1;
              tmp.height = imageBitmapOrElem.height || imageBitmapOrElem.naturalHeight || 1;
              const ctx = tmp.getContext('2d');
              ctx.drawImage(imageBitmapOrElem, 0, 0);
              tmp.toBlob((blob) => {
                createImageBitmap(blob).then((bmp) => {
                  worker.postMessage({ type: 'uploadImage', imageBitmap: bmp }, [bmp]);
                });
              });
            } catch (ex) {
              console.error('uploadImage fallback failed', ex);
            }
          }
        } else {
          // try to create an ImageBitmap from an HTMLImageElement or other
          try {
            createImageBitmap(imageBitmapOrElem).then((bmp) => {
              worker.postMessage({ type: 'uploadImage', imageBitmap: bmp }, [bmp]);
            }).catch((err) => {
              console.warn('createImageBitmap failed for uploadImage, trying canvas fallback', err);
              const tmp = document.createElement('canvas');
              tmp.width = imageBitmapOrElem.width || imageBitmapOrElem.naturalWidth || 1;
              tmp.height = imageBitmapOrElem.height || imageBitmapOrElem.naturalHeight || 1;
              const ctx = tmp.getContext('2d');
              ctx.drawImage(imageBitmapOrElem, 0, 0);
              tmp.convertToBlob().then((blob) => createImageBitmap(blob)).then((bmp) => {
                worker.postMessage({ type: 'uploadImage', imageBitmap: bmp }, [bmp]);
              });
            });
          } catch (e) {
            console.error('uploadImage error', e);
          }
        }
      },

      render: (params) => {
        // best-effort: send params to worker
        try {
          worker.postMessage({ type: 'render', params });
        } catch (e) {
          console.error('worker.render failed, falling back (error):', e);
        }
      },

      previewBlend: (params) => {
        // return a Promise resolving to an ImageBitmap (worker posts back {type: 'preview', imageBitmap})
        if (!worker) return Promise.reject(new Error('GPU worker not available'));
        if (!workerReady) {
          // still attempt: queue after ready — simple approach: wait until workerReady true (with timeout)
          return new Promise((resolve, reject) => {
            let waited = 0;
            const tick = setInterval(() => {
              if (workerReady) {
                clearInterval(tick);
                // now issue preview request
                pendingPreviewResolve = resolve;
                pendingPreviewReject = reject;
                try {
                  worker.postMessage({ type: 'previewBlend', params });
                } catch (err) {
                  pendingPreviewResolve = pendingPreviewReject = null;
                  reject(err);
                }
              } else {
                waited += 50;
                if (waited > 5000) {
                  clearInterval(tick);
                  reject(new Error('GPU worker not ready (preview timed out)'));
                }
              }
            }, 50);
          });
        }

        return new Promise((resolve, reject) => {
          pendingPreviewResolve = resolve;
          pendingPreviewReject = reject;
          try {
            worker.postMessage({ type: 'previewBlend', params });
          } catch (e) {
            pendingPreviewResolve = pendingPreviewReject = null;
            reject(e);
          }
        });
      },

      downloadPNG: () => {
        // returns Promise<string> (dataURL)
        if (!worker) return Promise.reject(new Error('GPU worker not available'));
        return new Promise((resolve, reject) => {
          pendingDownloadResolve = resolve;
          pendingDownloadReject = reject;
          try {
            worker.postMessage({ type: 'downloadPNG' });
          } catch (e) {
            pendingDownloadResolve = pendingDownloadReject = null;
            reject(e);
          }
        });
      },

      isReady: () => !!workerReady
    };
  };

  // if someone else queries window.GPUCore before we set init (unlikely), we preserve existing object
})();

// ---------- main application logic (UI wiring, CPU fallback, etc.) ----------
// The rest of this file is the full app logic (unchanged behavior) but updated to prefer the worker-backed GPUCore.
// This mirrors the previously provided full main.js implementation.

(() => {
  'use strict';

  /* ======= DOM references ======= */
  const fileInput = document.getElementById('imageUpload');
  const originalCanvas = document.getElementById('originalCanvas'); // 2D canvas with original image
  const noiseCanvas = document.getElementById('noiseCanvas');       // visible canvas (GPU or CPU path)
  const ctxOriginal = originalCanvas.getContext('2d');
  const ctxNoise2D = noiseCanvas.getContext('2d'); // used only for CPU fallback

  const strengthRange = document.getElementById('strength');
  const strengthNumber = document.getElementById('strengthValue');

  const noiseSizeRange = document.getElementById('noiseSize');
  const noiseSizeNumber = document.getElementById('noiseSizeValue');

  const blurrinessRange = document.getElementById('blurriness');
  const blurrinessNumber = document.getElementById('blurrinessValue');

  const colorNoiseToggle = document.getElementById('colorNoiseToggle');
  const blendModeSelect = document.getElementById('blendMode');
  const opacityRange = document.getElementById('opacity');
  const opacityNumber = document.getElementById('opacityValue');

  const downloadBtn = document.getElementById('downloadImage');
  const previewArea = document.getElementById('previewArea');
  const statusEl = document.getElementById('status') || (() => { const s=document.createElement('div'); s.id='status'; document.querySelector('.controls-panel').appendChild(s); return s; })();

  const helpBtn = document.getElementById('helpBtn');
  const manualModal = document.getElementById('manualModal');
  const closeManual = document.getElementById('closeManual');

  /* ======= Internal state ======= */
  let originalImageBitmap = null; // ImageBitmap or Image element
  let originalWidth = 0, originalHeight = 0;

  let gpu = null;            // will hold GPUCore instance if available
  let usingGPU = false;      // true if rendering with GPUCore
  let lastRenderParams = {}; // cache last used params to allow previewBlend to work with consistent values

  let overlayCanvas = null;  // used during blend preview crossfades
  let activeTransition = null;
  let scrollInactivityTimer = null;
  let scrollModeActive = false;
  let isPointerOverPreview = false;

  /* ======= Small helpers ======= */
  function setStatus(msg, important = false) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.style.fontWeight = important ? '700' : '400';
    statusEl.style.opacity = msg ? '1' : '0.9';
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ======= Slider mapping helpers (kept consistent with site mapping) ======= */
  const MAX_NOISE_SIZE = 200.0;
  const MAX_BLUR = 5.0;
  const SLIDER_MAX = 1000.0;
  const ZOOM_EXPONENT = 3.0;

  function noiseSizeFromSlider(s){
    const t = Math.pow(s / SLIDER_MAX, ZOOM_EXPONENT);
    return 1.0 + (MAX_NOISE_SIZE - 1.0) * t;
  }
  function sliderFromNoiseSize(size){
    const t = (Math.max(1.0, Math.min(MAX_NOISE_SIZE, size)) - 1.0) / (MAX_NOISE_SIZE - 1.0);
    return SLIDER_MAX * Math.pow(t, 1.0 / ZOOM_EXPONENT);
  }
  function blurFromSlider(s){
    const t = Math.pow(s / SLIDER_MAX, ZOOM_EXPONENT);
    return MAX_BLUR * t;
  }
  function sliderFromBlur(blur){
    const t = Math.max(0.0, Math.min(MAX_BLUR, blur)) / MAX_BLUR;
    return SLIDER_MAX * Math.pow(t, 1.0 / ZOOM_EXPONENT);
  }

  /* ======= UI sync for controls ======= */
  // Strength
  strengthRange.addEventListener('input', ()=> {
    strengthNumber.value = parseFloat(strengthRange.value).toFixed(2);
    scheduleRender();
  });
  strengthNumber.addEventListener('change', ()=> {
    let v = parseFloat(strengthNumber.value); if(isNaN(v)) v=0;
    v = clamp(v, 0, 150);
    strengthNumber.value = v.toFixed(2);
    strengthRange.value = v;
    scheduleRender();
  });

  // Noise size
  function syncNoiseSizeFromSlider(){
    const slider = parseFloat(noiseSizeRange.value);
    const size = noiseSizeFromSlider(slider);
    noiseSizeNumber.value = size.toFixed(2);
  }
  noiseSizeRange.addEventListener('input', ()=> { syncNoiseSizeFromSlider(); scheduleRender(); });
  noiseSizeNumber.addEventListener('change', ()=> {
    let v = parseFloat(noiseSizeNumber.value); if(isNaN(v)) v = 1.0;
    v = clamp(v, 1.0, MAX_NOISE_SIZE);
    noiseSizeNumber.value = v.toFixed(2);
    noiseSizeRange.value = sliderFromNoiseSize(v).toFixed(2);
    scheduleRender();
  });

  // Blur
  function syncBlurFromSlider(){
    const slider = parseFloat(blurrinessRange.value);
    const blur = blurFromSlider(slider);
    blurrinessNumber.value = blur.toFixed(2);
  }
  blurrinessRange.addEventListener('input', ()=> { syncBlurFromSlider(); scheduleRender(); });
  blurrinessNumber.addEventListener('change', ()=> {
    let v = parseFloat(blurrinessNumber.value); if(isNaN(v)) v = 0;
    v = clamp(v, 0.0, MAX_BLUR);
    blurrinessNumber.value = v.toFixed(2);
    blurrinessRange.value = sliderFromBlur(v).toFixed(2);
    scheduleRender();
  });

  // Opacity
  opacityRange.addEventListener('input', ()=> {
    opacityNumber.value = parseFloat(opacityRange.value).toFixed(2);
    scheduleRender();
  });
  opacityNumber.addEventListener('change', ()=> {
    let v = parseFloat(opacityNumber.value); if(isNaN(v)) v = 0;
    v = clamp(v, 0, 1);
    opacityNumber.value = v.toFixed(2);
    opacityRange.value = v;
    scheduleRender();
  });

  colorNoiseToggle.addEventListener('change', scheduleRender);
  blendModeSelect.addEventListener('change', scheduleRender);

  /* ======= Modal manual ======= */
  helpBtn.addEventListener('click', ()=> {
    manualModal.classList.add('show');
    manualModal.setAttribute('aria-hidden','false');
  });
  closeManual.addEventListener('click', ()=> {
    manualModal.classList.remove('show');
    manualModal.setAttribute('aria-hidden','true');
  });
  manualModal.addEventListener('click', (e)=> { if(e.target === manualModal) { manualModal.classList.remove('show'); manualModal.setAttribute('aria-hidden','true'); }});

  /* ======= Debounced render scheduling ======= */
  let renderTimer = null;
  function scheduleRender(delay = 16) {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      renderTimer = null;
      renderCurrent();
    }, delay);
  }

  /* ======= File input handling (ImageBitmap preferred) ======= */
  fileInput.addEventListener('change', async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    setStatus('Loading image...');
    try {
      if ('createImageBitmap' in window) {
        // createImageBitmap accepts File/Blob
        const bitmap = await createImageBitmap(file);
        handleLoadedImage(bitmap);
      } else {
        const url = URL.createObjectURL(file);
        const img = await new Promise((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = rej;
          i.src = url;
        });
        handleLoadedImage(img);
        URL.revokeObjectURL(url);
      }
      setStatus('');
    } catch (err) {
      console.error('Load failed', err);
      setStatus('Failed to load image (see console)', true);
    }
  });

  function handleLoadedImage(imgBitmapOrElem) {
    // set canvas sizes and draw original
    const w = imgBitmapOrElem.width || imgBitmapOrElem.naturalWidth || 1;
    const h = imgBitmapOrElem.height || imgBitmapOrElem.naturalHeight || 1;
    originalWidth = w; originalHeight = h;
    originalCanvas.width = noiseCanvas.width = w;
    originalCanvas.height = noiseCanvas.height = h;

    // draw original into originalCanvas (2D) for hover reveal and CPU fallback
    ctxOriginal.clearRect(0,0,w,h);
    ctxOriginal.drawImage(imgBitmapOrElem, 0, 0, w, h);

    // store the ImageBitmap or HTMLImageElement for GPU upload (if available)
    originalImageBitmap = imgBitmapOrElem;

    fitCanvasesToPreview();

    // If GPUCore is available and ready, upload image there
    if (window.GPUCore && typeof window.GPUCore.init === 'function') {
      // attach GPUCore if not attached yet (this will happen via GPU_CORE_READY event normally)
      try {
        // window.GPUCore.init may return an API object or the module may be global; main.attachGPUCore handles it.
        // We'll attempt to call init now (some implementations expect noiseCanvas and originalCanvas here)
        // But to avoid double-init we will only call it when gpu is null (not attached yet)
        if (!gpu) {
          try {
            const maybeApi = window.GPUCore.init ? window.GPUCore.init(noiseCanvas, originalCanvas) : window.GPUCore;
            gpu = maybeApi || window.GPUCore;
          } catch (e) {
            // ignore; attachGPUCore will run when GPU_CORE_READY event fires
            console.warn('GPUCore.init call in handleLoadedImage failed (ignored)', e);
          }
        }
      } catch (e) {}
    }

    // If we now have a gpu API with uploadImage, use it
    if (gpu && typeof gpu.uploadImage === 'function') {
      try {
        // uploadImage may accept ImageBitmap (fast) or HTMLImageElement
        gpu.uploadImage(originalImageBitmap);
        usingGPU = !!(gpu.isReady && gpu.isReady());
        setStatus(usingGPU ? 'GPU rendering active' : 'GPU available but not ready', false);
      } catch (e) {
        console.warn('GPU upload failed, will use CPU fallback', e);
        usingGPU = false;
        setStatus('Using CPU fallback (GPU upload failed)', true);
      }
    } else {
      usingGPU = false;
      setStatus('Using CPU fallback (GPU not ready)');
    }

    // initial render
    scheduleRender(0);
  }

  /* ======= Canvas sizing helper (mirrors original) ======= */
  function fitCanvasesToPreview(){
    if(!originalWidth || !originalHeight) return;
    const w = originalWidth, h = originalHeight;
    const areaRect = previewArea.getBoundingClientRect();
    const padding = 8;
    const maxW = Math.max(32, areaRect.width - padding);
    const maxH = Math.max(32, areaRect.height - padding);

    const scale = Math.min(maxW / w, maxH / h, 1);
    const cssW = Math.round(w * scale);
    const cssH = Math.round(h * scale);

    [originalCanvas, noiseCanvas].forEach(c => {
      c.style.width = cssW + 'px';
      c.style.height = cssH + 'px';
      c.style.left = '50%';
      c.style.top = '50%';
      c.style.transform = 'translate(-50%,-50%)';
    });

    previewArea.style.minHeight = Math.min(maxH, cssH) + 'px';
  }

  window.addEventListener('resize', ()=> {
    if(window._fitTimeout) clearTimeout(window._fitTimeout);
    window._fitTimeout = setTimeout(()=> {
      fitCanvasesToPreview();
    }, 80);
  });

  /* ======= Render switching (GPU or CPU) ======= */
  function gatherParams() {
    return {
      sigma: parseFloat(strengthNumber.value) || 0.0,
      blurSlider: parseFloat(blurrinessRange.value) || 0.0,
      noiseSlider: parseFloat(noiseSizeRange.value) || 1.0,
      isColor: !!colorNoiseToggle.checked,
      blendMode: blendModeSelect.value || 'overlay',
      opacity: parseFloat(opacityNumber.value) || 0.0
    };
  }

  function renderCurrent(){
    if (!originalImageBitmap) return;
    const params = gatherParams();
    lastRenderParams = params;

    // ensure we have GPU API attached if available
    if (!gpu && window.GPUCore && typeof window.GPUCore.init === 'function') {
      try {
        const maybeApi = window.GPUCore.init ? window.GPUCore.init(noiseCanvas, originalCanvas) : window.GPUCore;
        gpu = maybeApi || window.GPUCore;
      } catch (e) {
        // ignore
      }
    }

    if (gpu && typeof gpu.render === 'function' && gpu.isReady && gpu.isReady()) {
      try {
        gpu.render(params);
        usingGPU = true;
        downloadBtn.disabled = false;
        setStatus('Rendered on GPU');
        return;
      } catch (e) {
        console.warn('GPU render threw, falling back to CPU', e);
        usingGPU = false;
      }
    }

    // CPU fallback
    applyGaussianNoiseCPU(params);
  }

  /* ======= CPU fallback implementation (close to original) ======= */
  function gaussianRandom(mean=0,std=1){
    let u=0,v=0; while(u===0) u=Math.random(); while(v===0) v=Math.random();
    return Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v) * std + mean;
  }

  function generateNoiseFullCanvasCPU(w, h, params){
    const { sigma: std, isColor, blurSlider, noiseSlider } = params;
    const blurPx = blurFromSlider(blurSlider);
    const noiseSize = noiseSizeFromSlider(noiseSlider);

    const smallW = Math.max(1, Math.round(w / noiseSize));
    const smallH = Math.max(1, Math.round(h / noiseSize));

    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = smallW; smallCanvas.height = smallH;
    const sCtx = smallCanvas.getContext('2d');
    const smallImg = sCtx.createImageData(smallW, smallH);
    const sd = smallImg.data;

    for(let y=0;y<smallH;y++){
      for(let x=0;x<smallW;x++){
        const i = (y*smallW + x)*4;
        if(isColor){
          sd[i]   = clamp(Math.round(128 + gaussianRandom(0, std)), 0, 255);
          sd[i+1] = clamp(Math.round(128 + gaussianRandom(0, std)), 0, 255);
          sd[i+2] = clamp(Math.round(128 + gaussianRandom(0, std)), 0, 255);
        } else {
          const v = clamp(Math.round(128 + gaussianRandom(0, std)), 0, 255);
          sd[i] = sd[i+1] = sd[i+2] = v;
        }
        sd[i+3] = 255;
      }
    }
    sCtx.putImageData(smallImg, 0, 0);

    const noiseFull = document.createElement('canvas');
    noiseFull.width = w; noiseFull.height = h;
    const nfCtx = noiseFull.getContext('2d');
    nfCtx.imageSmoothingEnabled = true;

    if(blurPx > 0){
      nfCtx.filter = `blur(${blurPx}px)`;
      nfCtx.drawImage(smallCanvas, 0, 0, w, h);
      nfCtx.filter = 'none';
    } else {
      nfCtx.drawImage(smallCanvas, 0, 0, w, h);
    }

    return noiseFull;
  }

  function applyGaussianNoiseCPU(params){
    if(!originalImageBitmap) return;
    const w = originalWidth, h = originalHeight;

    const noiseFull = generateNoiseFullCanvasCPU(w, h, params);

    // composite using canvas 2D as in original
    ctxNoise2D.clearRect(0,0,w,h);
    ctxNoise2D.globalCompositeOperation = 'source-over';
    ctxNoise2D.drawImage(originalCanvas, 0, 0, w, h);

    const blend = params.blendMode || 'source-over';
    const opacity = params.opacity || 0.0;

    // use native composite where available
    const nativelySupported = ['source-over', 'screen', 'multiply', 'lighter', 'difference', 'overlay'];
    if (nativelySupported.includes(blend)) {
      ctxNoise2D.globalAlpha = opacity;
      ctxNoise2D.globalCompositeOperation = blend;
      ctxNoise2D.drawImage(noiseFull, 0, 0, w, h);
      ctxNoise2D.globalAlpha = 1.0;
      ctxNoise2D.globalCompositeOperation = 'source-over';
    } else {
      // fallback per-pixel (slow)
      try {
        const base = ctxOriginal.getImageData(0,0,w,h);
        const noiseCtx = noiseFull.getContext('2d');
        const noiseData = noiseCtx.getImageData(0,0,w,h);
        const out = ctxNoise2D.createImageData(w,h);
        const bd = base.data, nd = noiseData.data, od = out.data;
        for(let i=0;i<bd.length;i+=4){
          const br = bd[i]/255, bg = bd[i+1]/255, bb = bd[i+2]/255;
          const nr = nd[i]/255, ng = nd[i+1]/255, nb = nd[i+2]/255;
          // overlay fallback
          const blendChannel = (b, n) => ((b < 0.5) ? (2.0*b*n) : (1.0 - 2.0*(1.0-b)*(1.0-n)));
          const brd = blendChannel(br, nr), bgd = blendChannel(bg, ng), bbd = blendChannel(bb, nb);
          const rr = br*(1-opacity) + brd*opacity;
          const rg = bg*(1-opacity) + bgd*opacity;
          const rb = bb*(1-opacity) + bbd*opacity;
          od[i] = Math.round(rr * 255);
          od[i+1] = Math.round(rg * 255);
          od[i+2] = Math.round(rb * 255);
          od[i+3] = 255;
        }
        ctxNoise2D.putImageData(out, 0, 0);
      } catch (e) {
        console.warn('Manual per-pixel composite failed, fallback to simple composite', e);
        ctxNoise2D.globalAlpha = opacity;
        ctxNoise2D.globalCompositeOperation = blend;
        ctxNoise2D.drawImage(noiseFull, 0, 0, w, h);
        ctxNoise2D.globalAlpha = 1.0;
        ctxNoise2D.globalCompositeOperation = 'source-over';
      }
    }

    downloadBtn.disabled = false;
    fitCanvasesToPreview();
    setStatus('Rendered on CPU fallback');
  }

  /* ======= Download handling ======= */
  downloadBtn.addEventListener('click', async ()=> {
    downloadBtn.disabled = true;
    setStatus('Preparing image for download...');
    try {
      // Attempt to use worker-backed GPU if available and provides download
      if (window.GPUCore && typeof window.GPUCore.downloadPNG === 'function' && window.GPUCore.isReady && window.GPUCore.isReady()) {
        // window.GPUCore.downloadPNG returns a Promise<string> (dataURL) in shim and gpu-core versions
        const dataURL = await Promise.resolve(window.GPUCore.downloadPNG());
        triggerDownload(dataURL, 'noisy_image.png');
      } else if (gpu && typeof gpu.downloadPNG === 'function') {
        const dataURL = await Promise.resolve(gpu.downloadPNG());
        triggerDownload(dataURL, 'noisy_image.png');
      } else {
        // CPU fallback
        const dataURL = noiseCanvas.toDataURL('image/png');
        triggerDownload(dataURL, 'noisy_image.png');
      }
      setStatus('Download ready');
    } catch (e) {
      console.error('Download failed', e);
      setStatus('Failed to prepare download', true);
    } finally {
      downloadBtn.disabled = false;
    }
  });

  function triggerDownload(dataURL, filename) {
    const a = document.createElement('a');
    a.download = filename;
    a.href = dataURL;
    a.click();
  }

  /* ======= Hover & scroll blend preview (mirrors earlier behaviour) ======= */
  const blendModes = Array.from(blendModeSelect.options).map(o => o.value);
  let currentBlendIndex = blendModes.indexOf(blendModeSelect.value || 'overlay');
  if (currentBlendIndex === -1) currentBlendIndex = 0;

  function clearScrollInactivity(){ if(scrollInactivityTimer){ clearTimeout(scrollInactivityTimer); scrollInactivityTimer = null; } }
  function scheduleRevertToOriginal(){
    clearScrollInactivity();
    scrollInactivityTimer = setTimeout(()=> {
      if(isPointerOverPreview){
        scrollModeActive = false;
        originalCanvas.style.opacity = '1';
        removeOverlayImmediate();
      }
      scrollInactivityTimer = null;
    }, 2000);
  }

  function removeOverlayImmediate(){
    if(overlayCanvas && overlayCanvas.parentElement){
      overlayCanvas.parentElement.removeChild(overlayCanvas);
    }
    overlayCanvas = null;
    activeTransition = null;
  }

  // Crossfade to a composite produced locally (GPU or CPU)
  function crossfadeToBlend(mode){
    return new Promise((resolve)=> {
      if(!originalImageBitmap) { resolve(); return; }
      const w = originalWidth, h = originalHeight;

      // For preview we want a one-off composite using current param values but override blend
      const params = gatherParams();
      params.blendMode = mode;

      // Render the composite into an offscreen canvas. Prefer worker/ GPU's preview path if available.
      (async function renderOverlay(){
        let overlay;
        try {
          // Prefer worker-backed preview (fast ImageBitmap returned)
          if (window.GPUCore && window.GPUCore.isReady && window.GPUCore.isReady() && typeof window.GPUCore.previewBlend === 'function') {
            try {
              const bmp = await window.GPUCore.previewBlend(params);
              // bmp is ImageBitmap; draw it to a canvas we can overlay
              overlay = document.createElement('canvas');
              overlay.width = w; overlay.height = h;
              overlay.className = 'overlay-canvas';
              overlay.style.width = noiseCanvas.style.width;
              overlay.style.height = noiseCanvas.style.height;
              overlay.style.left = noiseCanvas.style.left;
              overlay.style.top = noiseCanvas.style.top;
              overlay.style.transform = noiseCanvas.style.transform;
              const ctx = overlay.getContext('2d');
              ctx.drawImage(bmp, 0,0);
              // release bmp if possible
              try { bmp.close && bmp.close(); } catch (e) {}
            } catch (e) {
              // fall through to other methods
              console.warn('window.GPUCore.previewBlend failed, trying gpu.preview or cpu overlay', e);
            }
          }
        } catch (e) {
          console.warn('preview via window.GPUCore failed', e);
        }

        // If not created overlay yet, try the local gpu object (returned by window.GPUCore.init earlier)
        if(!overlay && gpu && typeof gpu.previewBlend === 'function' && gpu.isReady && gpu.isReady()) {
          try {
            const bmp = await gpu.previewBlend(params);
            overlay = document.createElement('canvas');
            overlay.width = w; overlay.height = h;
            overlay.className = 'overlay-canvas';
            overlay.style.width = noiseCanvas.style.width;
            overlay.style.height = noiseCanvas.style.height;
            overlay.style.left = noiseCanvas.style.left;
            overlay.style.top = noiseCanvas.style.top;
            overlay.style.transform = noiseCanvas.style.transform;
            overlay.getContext('2d').drawImage(bmp, 0,0);
            try { bmp.close && bmp.close(); } catch (e) {}
          } catch (e) {
            console.warn('gpu.previewBlend failed', e);
          }
        }

        if(!overlay) {
          // fallback to CPU-rendered overlay canvas
          overlay = await cpuOverlayRender(params);
        }

        if(!overlay) { resolve(); return; }

        overlay.style.opacity = '0';
        overlay.classList.add('overlay-canvas');
        previewArea.appendChild(overlay);
        // ensure original hidden during preview
        originalCanvas.style.opacity = '0';

        // cancel previous transition if running
        if(activeTransition && activeTransition.cancel) activeTransition.cancel();

        let cancelled = false;
        activeTransition = { cancel: ()=> { cancelled = true; } };
        overlayCanvas = overlay;

        // trigger reflow, then fade in
        void overlay.offsetWidth;
        overlay.style.opacity = '1';

        // after fade (100ms) copy overlay into noiseCanvas and remove overlay
        const t = setTimeout(()=> {
          if(cancelled){
            if(overlay && overlay.parentElement) overlay.parentElement.removeChild(overlay);
            overlayCanvas = null; activeTransition = null; resolve(); return;
          }
          try {
            ctxNoise2D.clearRect(0,0,w,h);
            ctxNoise2D.drawImage(overlay, 0,0, w, h);
          } catch (e) {
            // ignore errors
          }
          if(overlay && overlay.parentElement) overlay.parentElement.removeChild(overlay);
          overlayCanvas = null; activeTransition = null;
          resolve();
        }, 120);
      })();
    });
  }

  // CPU overlay renderer used when GPU can't produce quick overlay
  async function cpuOverlayRender(params){
    if(!originalImageBitmap) return null;
    const w = originalWidth, h = originalHeight;
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const octx = off.getContext('2d');
    // produce CPU composite using existing function generateNoiseFullCanvasCPU and composite
    const noiseFull = generateNoiseFullCanvasCPU(w, h, params);
    octx.clearRect(0,0,w,h);
    octx.drawImage(originalCanvas, 0, 0, w, h);
    octx.globalAlpha = params.opacity || 0.0;
    octx.globalCompositeOperation = params.blendMode || 'source-over';
    octx.drawImage(noiseFull, 0,0,w,h);
    octx.globalAlpha = 1.0;
    octx.globalCompositeOperation = 'source-over';
    // copy to overlay and style
    const overlay = document.createElement('canvas');
    overlay.width = w; overlay.height = h;
    overlay.getContext('2d').drawImage(off, 0,0);
    overlay.style.width = noiseCanvas.style.width;
    overlay.style.height = noiseCanvas.style.height;
    overlay.style.left = noiseCanvas.style.left;
    overlay.style.top = noiseCanvas.style.top;
    overlay.style.transform = noiseCanvas.style.transform;
    return overlay;
  }

  // wheel handler to cycle blend modes
  function wheelCycleBlendMode(ev){
    if(!originalImageBitmap) return;
    ev.preventDefault();
    const delta = ev.deltaY || ev.wheelDelta || 0;
    if(delta === 0) return;
    const dir = delta > 0 ? 1 : -1;
    currentBlendIndex = (currentBlendIndex + dir + blendModes.length) % blendModes.length;
    const mode = blendModes[currentBlendIndex];
    blendModeSelect.value = mode;

    scrollModeActive = true;
    originalCanvas.style.opacity = '0';

    // crossfade to new blend mode preview
    crossfadeToBlend(mode);

    scheduleRevertToOriginal();
  }

  // pointer tracking
  previewArea.addEventListener('mouseenter', ()=> {
    isPointerOverPreview = true;
    if(!scrollModeActive) {
      originalCanvas.style.opacity = '1';
    } else {
      originalCanvas.style.opacity = '0';
    }
  });
  previewArea.addEventListener('mouseleave', ()=> {
    isPointerOverPreview = false;
    clearScrollInactivity();
    scrollModeActive = false;
    originalCanvas.style.opacity = '0';
    removeOverlayImmediate();
  });
  previewArea.addEventListener('wheel', wheelCycleBlendMode, { passive: false });

  /* ======= GPUCore integration and readiness ======= */
  // Listen for the GPU core ready event (worker or synchronous core will dispatch this)
  window.addEventListener('GPU_CORE_READY', () => {
    // try to attach GPUCore API now
    try {
      if (window.GPUCore && typeof window.GPUCore.init === 'function') {
        const maybeApi = window.GPUCore.init ? window.GPUCore.init(noiseCanvas, originalCanvas) : window.GPUCore;
        gpu = maybeApi || window.GPUCore;
        if (gpu && gpu.uploadImage && originalImageBitmap) {
          try { gpu.uploadImage(originalImageBitmap); usingGPU = !!(gpu.isReady && gpu.isReady()); setStatus(usingGPU ? 'GPU initialized' : 'GPU ready'); }
          catch (e) { console.warn('GPU uploadImage failed in GPU_CORE_READY handler', e); }
        }
      }
    } catch (e) {
      console.warn('attach during GPU_CORE_READY failed', e);
    }
    // attempt an initial render
    scheduleRender(0);
  });

  /* ======= Initialization defaults (sync UI with internal state) ======= */
  (function init(){
    strengthNumber.value = parseFloat(strengthRange.value).toFixed(2);
    noiseSizeRange.value = sliderFromNoiseSize(parseFloat(noiseSizeNumber.value || 4)).toFixed(2);
    syncNoiseSizeFromSlider();
    blurrinessRange.value = sliderFromBlur(parseFloat(blurrinessNumber.value || 2)).toFixed(2);
    syncBlurFromSlider();
    opacityNumber.value = parseFloat(opacityRange.value).toFixed(2);

    // quick WebGL2 detection message (informative)
    let gl2 = null;
    try {
      const testCanvas = document.createElement('canvas');
      gl2 = testCanvas.getContext('webgl2');
    } catch (e) { gl2 = null; }
    if (!gl2) setStatus('WebGL2 not detected — using CPU fallback by default.', true);
    else setStatus('WebGL2 detected — waiting for GPU core...', false);
  })();

  /* ======= Small console helpers for debugging ======= */
  window.DGS = window.DGS || {};
  window.DGS.renderNow = renderCurrent;
  window.DGS.forceCPU = () => { gpu = null; usingGPU = false; setStatus('Forced CPU fallback'); renderCurrent(); };
  window.DGS.getLastParams = () => lastRenderParams;

})(); // end main IIFE
