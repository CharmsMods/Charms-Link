// gpu-core.js (UPDATED)
// WebGL2 GPU core for Digital Grain Studio — upgraded with separable Gaussian blur, blue-noise support,
// and readPixels-based download (no preserveDrawingBuffer).
//
// API (as required by main.js):
//   const api = GPUCore.init(noiseCanvas, originalCanvas);
//   api.uploadImage(imageBitmapOrElem);
//   api.render(params); // { sigma, blurSlider, noiseSlider, isColor, blendMode, opacity }
//   await api.downloadPNG(); // returns dataURL (Promise<string>)
//   api.previewBlend(modeName);
//   api.isReady();
//
// Dispatches global event: 'GPU_CORE_READY'
//
// Notes:
// - For highest quality blue-noise replace generateBlueNoiseTexture() with a loaded PNG texture.
// - This file aims for clarity and maintainability: you can split shader strings into separate files later.

(function () {
  'use strict';
  const _log = (...args) => console.log('[GPUCore]', ...args);

  // Safe stub if WebGL2 not available
  function failStub(reason) {
    _log('failStub:', reason);
    window.GPUCore = window.GPUCore || {};
    window.GPUCore.isReady = () => false;
    window.GPUCore.init = function () {
      const stubAPI = {
        uploadImage: () => {},
        render: () => {},
        downloadPNG: () => Promise.reject(new Error('GPU not available')),
        previewBlend: () => {},
        isReady: () => false
      };
      setTimeout(() => window.dispatchEvent(new Event('GPU_CORE_READY')), 0);
      return stubAPI;
    };
    return;
  }

  // Try get WebGL2
  function tryCreateGL(canvas) {
    try {
      return canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false });
    } catch (e) { return null; }
  }

  // Shader helpers
  function createShader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('Shader compile error: ' + log);
    }
    return s;
  }
  function createProgram(gl, vsSrc, fsSrc) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error('Program link error: ' + log);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return p;
  }

  // Fullscreen quad
  const QUAD = new Float32Array([
    -1, -1,  1, -1,  -1, 1,
    -1,  1,  1, -1,   1, 1
  ]);

  // Vertex shader (shared)
  const VERT = `#version 300 es
  precision highp float;
  in vec2 a_pos;
  out vec2 v_uv;
  void main(){
    v_uv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }`;

  // Fragment: base composition shader (noise generation + composite; no blur)
  const FRAG_BASE = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;

  uniform sampler2D u_image;
  uniform sampler2D u_blueNoise; // optional blue-noise (tile)
  uniform vec2 u_texSize;
  uniform float u_noiseScale;
  uniform float u_sigma;
  uniform int u_useBlueNoise;
  uniform int u_colorNoise;
  uniform int u_blendMode;
  uniform float u_opacity;

  // simple hash (iq)
  float hash12(vec2 p){
    vec3 p3 = fract(vec3(p.xyx) * vec3(443.8975, 397.2973, 491.1871));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
  }

  vec3 proceduralNoise(vec2 uv){
    float s = max(1.0, u_noiseScale);
    vec2 cell = floor(uv * s * u_texSize);
    if(u_colorNoise == 1){
      float r = hash12(cell + 0.12);
      float g = hash12(cell + 37.2);
      float b = hash12(cell + 71.9);
      return vec3(r,g,b);
    } else {
      float v = hash12(cell + 0.12);
      return vec3(v);
    }
  }

  vec3 blueNoiseSample(vec2 uv){
    // uv * noise scale maps to blue-noise texture UVs (tiling)
    vec2 p = fract(uv * u_noiseScale);
    vec3 n = texture(u_blueNoise, p).rgb;
    if(u_colorNoise == 1) return n;
    float m = (n.r + n.g + n.b) / 3.0;
    return vec3(m);
  }

  vec3 getNoise(vec2 uv){
    if(u_useBlueNoise == 1) {
      return blueNoiseSample(uv);
    } else {
      return proceduralNoise(uv);
    }
  }

  // Small set of blend helpers (overlay/screen/multiply/add/difference)
  vec3 blend_overlay(vec3 a, vec3 b){
    vec3 r;
    for(int i=0;i<3;i++){
      float A = a[i]; float B = b[i];
      r[i] = (A < 0.5) ? (2.0*A*B) : (1.0 - 2.0*(1.0-A)*(1.0-B));
    }
    return r;
  }
  vec3 blend_screen(vec3 a, vec3 b){ return 1.0 - (1.0-a)*(1.0-b); }
  vec3 blend_multiply(vec3 a, vec3 b){ return a*b; }

  vec3 applyBlend(int mode, vec3 base, vec3 noise){
    if(mode == 0) return noise;
    if(mode == 1) return blend_overlay(base, noise);
    if(mode == 2) return blend_screen(base, noise);
    if(mode == 3) return blend_multiply(base, noise);
    if(mode == 4) return min(base + noise, vec3(1.0));
    if(mode == 5) return abs(base - noise);
    return noise;
  }

  void main(){
    vec3 base = texture(u_image, v_uv).rgb;

    vec3 n = getNoise(v_uv);

    // center & scale similar to CPU: sigma / 128
    float scale = max(0.0, u_sigma) / 128.0;
    n = (n - 0.5) * scale + 0.5;

    vec3 blended = applyBlend(u_blendMode, base, n);
    vec3 result = mix(base, blended, u_opacity);

    outColor = vec4(result, 1.0);
  }`;

  // Fragment for separable blur pass (horizontal or vertical)
  const FRAG_BLUR = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;

  uniform sampler2D u_src;
  uniform vec2 u_texSize;
  uniform vec2 u_direction; // (1,0) horizontal or (0,1) vertical
  uniform float u_radius; // blur radius in pixels

  // precomputed Gaussian weights for taps (5-tap symmetric)
  const float w0 = 0.4026;
  const float w1 = 0.2442;
  const float w2 = 0.06136;

  void main(){
    vec2 px = 1.0 / u_texSize;
    vec3 acc = texture(u_src, v_uv).rgb * w0;
    acc += texture(u_src, v_uv + u_direction * px * 1.0 * u_radius).rgb * w1;
    acc += texture(u_src, v_uv - u_direction * px * 1.0 * u_radius).rgb * w1;
    acc += texture(u_src, v_uv + u_direction * px * 2.0 * u_radius).rgb * w2;
    acc += texture(u_src, v_uv - u_direction * px * 2.0 * u_radius).rgb * w2;
    outColor = vec4(acc, 1.0);
  }`;

  // Fragment to blit texture (simple copy) - used for intermediate copies if needed
  const FRAG_COPY = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;
  uniform sampler2D u_src;
  void main(){
    outColor = texture(u_src, v_uv);
  }`;

  // Blend mapping (string -> int)
  const BLEND_MAP = {
    'source-over': 0,
    'overlay': 1,
    'screen': 2,
    'multiply': 3,
    'lighter': 4,
    'difference': 5
  };

  // Expose init
  window.GPUCore = window.GPUCore || {};
  window.GPUCore.init = function (glCanvas, originalCanvas) {
    const gl = tryCreateGL(glCanvas);
    if (!gl) {
      failStub('WebGL2 not supported');
      return window.GPUCore.init(glCanvas, originalCanvas);
    }
    _log('WebGL2 context obtained (preserveDrawingBuffer=false)');

    // compile programs
    let progBase, progBlur, progCopy;
    try {
      progBase = createProgram(gl, VERT, FRAG_BASE);
      progBlur = createProgram(gl, VERT, FRAG_BLUR);
      progCopy = createProgram(gl, VERT, FRAG_COPY);
    } catch (e) {
      console.error('Shader compile/link error:', e);
      failStub('shader error: ' + e.message);
      return window.GPUCore.init(glCanvas, originalCanvas);
    }

    // GL setup
    const quadVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);

    // create textures and FBOs for ping-pong
    function createTexture(w, h, linear=true) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      return t;
    }
    function createFBOForTexture(tex) {
      const f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        console.warn('Incomplete framebuffer status:', status);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return f;
    }

    // image texture (source)
    const imgTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, imgTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // blue-noise texture (initialized below)
    const blueNoiseTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, blueNoiseTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // ping-pong targets (create lazily when image size known)
    let targetA = null, targetB = null, fboA = null, fboB = null;
    let currentWidth = 1, currentHeight = 1;

    function ensureTargets(w, h) {
      if (w === currentWidth && h === currentHeight && targetA) return;
      currentWidth = w; currentHeight = h;
      // delete old if exist
      if (targetA) { gl.deleteTexture(targetA); gl.deleteTexture(targetB); gl.deleteFramebuffer(fboA); gl.deleteFramebuffer(fboB); }
      targetA = createTexture(w, h, true);
      targetB = createTexture(w, h, true);
      fboA = createFBOForTexture(targetA);
      fboB = createFBOForTexture(targetB);
      _log('Created ping-pong targets', w, h);
    }

    // helper: draw fullquad into a target using program & uniforms binder
    function drawTo(targetFBO, program, bindUniforms) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
      gl.viewport(0, 0, currentWidth, currentHeight);
      gl.useProgram(program);
      // setup quad attrib
      const aPos = gl.getAttribLocation(program, 'a_pos');
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      // custom uniform bindings
      if (bindUniforms) bindUniforms();

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.disableVertexAttribArray(aPos);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    // utility: render program reading from a texture (unit 0) into FBO target
    function renderCopy(srcTex, destFBO) {
      drawTo(destFBO, progCopy, () => {
        const loc = gl.getUniformLocation(progCopy, 'u_src');
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, srcTex);
        gl.uniform1i(loc, 0);
      });
    }

    // Generate a small procedural blue-noise-like texture (placeholder)
    // For production swap with a real blue-noise PNG loaded via image or fetch and texImage2D it.
    function generateBlueNoiseSplat(size = 128) {
      // Create an offscreen canvas to paint a "blue-noise-like" texture using random + low-pass
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      const id = ctx.createImageData(size, size);
      const d = id.data;
      // fill with random and apply a simple blur kernel locally (very cheap)
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 4;
          const v = Math.floor(Math.random() * 256);
          d[i] = d[i+1] = d[i+2] = v;
          d[i+3] = 255;
        }
      }
      // naive blur pass (small box blur) to reduce extreme high-frequency
      // one pass of box blur
      const tmp = new Uint8ClampedArray(d.length);
      const w = size, h = size;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let r = 0, g = 0, b = 0, cnt = 0;
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              const nx = x + ox, ny = y + oy;
              if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                const ii = (ny * w + nx) * 4;
                r += d[ii]; g += d[ii+1]; b += d[ii+2]; cnt++;
              }
            }
          }
          const ii = (y * w + x) * 4;
          tmp[ii] = Math.round(r / cnt);
          tmp[ii+1] = Math.round(g / cnt);
          tmp[ii+2] = Math.round(b / cnt);
          tmp[ii+3] = 255;
        }
      }
      // copy back
      for (let i = 0; i < d.length; i++) d[i] = tmp[i];
      ctx.putImageData(id, 0, 0);
      return c;
    }

    // upload blue-noise texture
    (function initBlueNoise() {
      const size = 128; // can swap to 64,256 etc
      const c = generateBlueNoiseSplat(size);
      gl.bindTexture(gl.TEXTURE_2D, blueNoiseTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.bindTexture(gl.TEXTURE_2D, null);
      _log('Blue-noise placeholder uploaded (replace with higher-quality PNG for best results)');
    })();

    // state: image dimensions
    let imgW = 1, imgH = 1;

    // upload original image into imgTex using ImageBitmap or HTMLImageElement
    function uploadImage(img) {
      if (!img) return;
      // get natural sizes
      const w = img.width || img.naturalWidth || img.videoWidth || 1;
      const h = img.height || img.naturalHeight || img.videoHeight || 1;
      imgW = w; imgH = h;
      // ensure render targets allocated
      ensureTargets(imgW, imgH);

      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      } catch (e) {
        // fallback draw to temporary canvas (rare)
        const tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        const tctx = tmp.getContext('2d');
        tctx.drawImage(img, 0, 0, w, h);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tmp);
      }
      gl.bindTexture(gl.TEXTURE_2D, null);

      // size the visible canvas drawing buffer to match image (1:1)
      if (glCanvas.width !== imgW || glCanvas.height !== imgH) {
        glCanvas.width = imgW; glCanvas.height = imgH;
      }
    }

    // core render sequence:
    // 1) Render base composite (noise + blend) into ping target A using progBase (reads imgTex & blueNoiseTex)
    // 2) If blurPx > smallThreshold => run separable blur:
    //      pass horiz: read targetA -> write targetB (progBlur with direction = (1,0))
    //      pass vert : read targetB -> write targetA (progBlur with direction = (0,1))
    //    Optionally repeat iterations for stronger blur.
    // 3) Finally blit targetA to the default canvas framebuffer (screen)
    // Note: we render to offscreen FBOs then to canvas for clean readPixels behavior.

    function render(params = {}) {
      params = params || {};
      const sigma = Number(params.sigma) || 0.0;
      const blurSlider = Number(params.blurSlider) || 0.0;
      const noiseSlider = Number(params.noiseSlider) || 1.0;
      const isColor = params.isColor ? 1 : 0;
      const opacity = Number(params.opacity) || 0.0;
      const blendMode = params.blendMode || 'overlay';

      // mapping slider space to noiseScale and blurPx (consistent with main.js)
      const SLIDER_MAX = 1000.0, ZOOM_EXPONENT = 3.0, MAX_NOISE_SIZE = 200.0;
      const t = Math.pow(noiseSlider / SLIDER_MAX, ZOOM_EXPONENT);
      const noiseSize = 1.0 + (MAX_NOISE_SIZE - 1.0) * t;
      const noiseScale = noiseSize;

      const MAX_BLUR = 5.0;
      const bt = Math.pow(blurSlider / SLIDER_MAX, ZOOM_EXPONENT);
      const blurPx = MAX_BLUR * bt;

      // ensure targets are ready
      ensureTargets(imgW, imgH);

      // 1) base pass -> targetA
      drawTo(fboA, progBase, () => {
        // bind image
        const loc_img = gl.getUniformLocation(progBase, 'u_image');
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, imgTex);
        gl.uniform1i(loc_img, 0);

        // blue noise on unit1
        const loc_b = gl.getUniformLocation(progBase, 'u_blueNoise');
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, blueNoiseTex);
        gl.uniform1i(loc_b, 1);

        gl.uniform2f(gl.getUniformLocation(progBase, 'u_texSize'), imgW, imgH);
        gl.uniform1f(gl.getUniformLocation(progBase, 'u_noiseScale'), noiseScale);
        gl.uniform1f(gl.getUniformLocation(progBase, 'u_sigma'), sigma);
        gl.uniform1i(gl.getUniformLocation(progBase, 'u_useBlueNoise'), 1); // enable blue-noise by default
        gl.uniform1i(gl.getUniformLocation(progBase, 'u_colorNoise'), isColor);
        gl.uniform1i(gl.getUniformLocation(progBase, 'u_blendMode'), (BLEND_MAP[blendMode] !== undefined) ? BLEND_MAP[blendMode] : 1);
        gl.uniform1f(gl.getUniformLocation(progBase, 'u_opacity'), opacity);
      });

      // 2) blur if required. We'll do two-pass separable blur if blurPx > 0.01
      const blurThreshold = 0.01;
      if (blurPx > blurThreshold) {
        // horizontal pass: read fboA (texture targetA) -> write fboB
        drawTo(fboB, progBlur, () => {
          const loc = gl.getUniformLocation(progBlur, 'u_src');
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, targetA);
          gl.uniform1i(loc, 0);
          gl.uniform2f(gl.getUniformLocation(progBlur, 'u_texSize'), imgW, imgH);
          gl.uniform2f(gl.getUniformLocation(progBlur, 'u_direction'), 1.0, 0.0);
          gl.uniform1f(gl.getUniformLocation(progBlur, 'u_radius'), blurPx);
        });

        // vertical pass: read fboB (targetB) -> write fboA
        drawTo(fboA, progBlur, () => {
          const loc = gl.getUniformLocation(progBlur, 'u_src');
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, targetB);
          gl.uniform1i(loc, 0);
          gl.uniform2f(gl.getUniformLocation(progBlur, 'u_texSize'), imgW, imgH);
          gl.uniform2f(gl.getUniformLocation(progBlur, 'u_direction'), 0.0, 1.0);
          gl.uniform1f(gl.getUniformLocation(progBlur, 'u_radius'), blurPx);
        });
      }

      // 3) final blit to default framebuffer (canvas)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      // draw a simple textured quad sampling final targetA
      gl.useProgram(progCopy);
      const aPos = gl.getAttribLocation(progCopy, 'a_pos');
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, targetA);
      gl.uniform1i(gl.getUniformLocation(progCopy, 'u_src'), 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disableVertexAttribArray(aPos);

      // unbind textures to keep state clean
      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    // previewBlend: render a quick preview for a specific blend mode
    function previewBlend(modeName) {
      // We assume main.js has already updated the UI state — for quick preview call render with reasonable defaults:
      render({ sigma: 50, blurSlider: 160, noiseSlider: 4, isColor: 0, blendMode: modeName, opacity: 0.25 });
    }

    // downloadPNG: read pixels from canvas via readPixels into an offscreen 2D canvas -> toDataURL
    async function downloadPNG() {
      // Ensure final image is drawn to canvas (render should have been called)
      // read pixels
      const w = glCanvas.width, h = glCanvas.height;
      const pixels = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      // flip vertically while copying into ImageData because WebGL origin is bottom-left
      const flipped = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) {
        const srcRow = y;
        const dstRow = h - 1 - y;
        const srcOff = srcRow * w * 4;
        const dstOff = dstRow * w * 4;
        flipped.set(pixels.subarray(srcOff, srcOff + w * 4), dstOff);
      }
      // create ImageData and draw onto an offscreen canvas to use toDataURL
      const off = document.createElement('canvas');
      off.width = w; off.height = h;
      const ctx = off.getContext('2d');
      const imageData = new ImageData(flipped, w, h);
      ctx.putImageData(imageData, 0, 0);
      // return data URL
      return off.toDataURL('image/png');
    }

    function isReady() { return true; }

    // API to return
    const api = {
      uploadImage,
      render,
      downloadPNG,
      previewBlend,
      isReady
    };

    // Expose on window.GPUCore for backwards compatibility
    window.GPUCore = window.GPUCore || {};
    Object.assign(window.GPUCore, { init: window.GPUCore.init, uploadImage, render, downloadPNG, previewBlend, isReady });

    // announce readiness
    setTimeout(() => {
      _log('GPU core ready (separable blur, blue-noise placeholder).');
      window.dispatchEvent(new Event('GPU_CORE_READY'));
    }, 0);

    return api;
  };

  // END OF gpu-core.js
})();
