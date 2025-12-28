// gpu-worker.js
// Worker script: runs WebGL2 on an OffscreenCanvas.
// Save as gpu-worker.js and create via new Worker('gpu-worker.js') from main thread.
// Protocol described above in the comment.

self.addEventListener('error', (e) => {
  console.error('Worker error:', e);
  try { self.postMessage({ type: 'error', message: String(e.message || e) }); } catch {}
});

(() => {
  'use strict';

  // Utility: compile/link shaders
  function compileShader(gl, type, src) {
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
  function linkProgram(gl, vsSrc, fsSrc) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
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

  // Vertex shader (common)
  const VERT_SRC = `#version 300 es
  precision mediump float;
  in vec2 a_pos;
  out vec2 v_uv;
  void main(){
    v_uv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }`;

  // Base fragment: produce noise + composite (same logical operations as earlier)
  const FRAG_BASE = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;

  uniform sampler2D u_image;
  uniform sampler2D u_blueNoise;
  uniform vec2 u_texSize;
  uniform float u_noiseScale;
  uniform float u_sigma;
  uniform int u_useBlueNoise;
  uniform int u_colorNoise;
  uniform int u_blendMode;
  uniform float u_opacity;

  // iq hash
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(443.8975, 397.2973, 491.1871));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
  }

  vec3 proceduralNoise(vec2 uv) {
    float s = max(1.0, u_noiseScale);
    vec2 cell = floor(uv * s * u_texSize);
    if (u_colorNoise == 1) {
      float r = hash12(cell + 0.12);
      float g = hash12(cell + 37.2);
      float b = hash12(cell + 71.9);
      return vec3(r,g,b);
    } else {
      float v = hash12(cell + 0.12);
      return vec3(v);
    }
  }

  vec3 blueNoiseSample(vec2 uv) {
    vec2 p = fract(uv * u_noiseScale);
    vec3 n = texture(u_blueNoise, p).rgb;
    if (u_colorNoise == 1) return n;
    float m = (n.r + n.g + n.b) * 0.3333333;
    return vec3(m);
  }

  vec3 getNoise(vec2 uv) {
    if (u_useBlueNoise == 1) return blueNoiseSample(uv);
    return proceduralNoise(uv);
  }

  vec3 blend_overlay(vec3 a, vec3 b) {
    vec3 r;
    for(int i=0;i<3;i++){
      float A = a[i]; float B = b[i];
      r[i] = (A < 0.5) ? (2.0*A*B) : (1.0 - 2.0*(1.0-A)*(1.0-B));
    }
    return r;
  }
  vec3 blend_screen(vec3 a, vec3 b){ return 1.0 - (1.0-a)*(1.0-b); }
  vec3 blend_multiply(vec3 a, vec3 b){ return a*b; }

  vec3 applyBlend(int mode, vec3 base, vec3 noise) {
    if (mode == 0) return noise;
    if (mode == 1) return blend_overlay(base, noise);
    if (mode == 2) return blend_screen(base, noise);
    if (mode == 3) return blend_multiply(base, noise);
    if (mode == 4) return min(base + noise, vec3(1.0));
    if (mode == 5) return abs(base - noise);
    return noise;
  }

  void main(){
    vec3 base = texture(u_image, v_uv).rgb;
    vec3 n = getNoise(v_uv);
    float scale = max(0.0, u_sigma) / 128.0;
    n = (n - 0.5) * scale + 0.5;
    vec3 blended = applyBlend(u_blendMode, base, n);
    vec3 result = mix(base, blended, u_opacity);
    outColor = vec4(result, 1.0);
  }`;

  // Blur fragment (separable)
  const FRAG_BLUR = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;

  uniform sampler2D u_src;
  uniform vec2 u_texSize;
  uniform vec2 u_dir;
  uniform float u_radius;

  const float w0 = 0.4026;
  const float w1 = 0.2442;
  const float w2 = 0.06136;

  void main(){
    vec2 px = 1.0 / u_texSize;
    vec3 acc = texture(u_src, v_uv).rgb * w0;
    acc += texture(u_src, v_uv + u_dir * px * 1.0 * u_radius).rgb * w1;
    acc += texture(u_src, v_uv - u_dir * px * 1.0 * u_radius).rgb * w1;
    acc += texture(u_src, v_uv + u_dir * px * 2.0 * u_radius).rgb * w2;
    acc += texture(u_src, v_uv - u_dir * px * 2.0 * u_radius).rgb * w2;
    outColor = vec4(acc, 1.0);
  }`;

  // Simple copy fragment
  const FRAG_COPY = `#version 300 es
  precision mediump float;
  in vec2 v_uv;
  out vec4 outColor;
  uniform sampler2D u_src;
  void main(){ outColor = texture(u_src, v_uv); }`;

  // GL state within worker
  let gl = null;
  let offscreen = null;

  let progBase = null, progBlur = null, progCopy = null;
  let vbo = null;

  // Textures & FBOs
  let imgTex = null, blueNoiseTex = null;
  let targetA = null, targetB = null, fboA = null, fboB = null;
  let imgW = 1, imgH = 1;

  // precreate a blue-noise canvas and upload (placeholder generator)
  function createBlueNoiseCanvas(size = 128) {
    const c = new OffscreenCanvas(size, size);
    const ctx = c.getContext('2d');
    const id = ctx.createImageData(size, size);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.floor(Math.random() * 256);
      d[i] = d[i+1] = d[i+2] = v;
      d[i+3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    return c;
  }

  // Create GL resources after init
  function initGLResources() {
    // compile shaders
    progBase = linkProgram(gl, VERT_SRC, FRAG_BASE);
    progBlur = linkProgram(gl, VERT_SRC, FRAG_BLUR);
    progCopy = linkProgram(gl, VERT_SRC, FRAG_COPY);

    // VBO
    vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);

    // textures
    imgTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, imgTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    blueNoiseTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, blueNoiseTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    // upload blue-noise placeholder
    const bn = createBlueNoiseCanvas(128);
    gl.bindTexture(gl.TEXTURE_2D, blueNoiseTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bn);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  function createTex(w, h, linear=true) {
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
  function createFBO(tex) {
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.warn('FBO incomplete', status);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return f;
  }

  function ensureTargets(w, h) {
    if (targetA && w === imgW && h === imgH) return;
    imgW = w; imgH = h;
    if (targetA) { try { gl.deleteTexture(targetA); gl.deleteTexture(targetB); gl.deleteFramebuffer(fboA); gl.deleteFramebuffer(fboB); } catch(e){} }
    targetA = createTex(w, h, true);
    targetB = createTex(w, h, true);
    fboA = createFBO(targetA);
    fboB = createFBO(targetB);
  }

  // helper draws using specified program to framebuffer target
  function drawTo(fbo, program, uniformBinder) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, imgW, imgH);
    gl.useProgram(program);

    const aPos = gl.getAttribLocation(program, 'a_pos');
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    if (uniformBinder) uniformBinder();

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disableVertexAttribArray(aPos);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // Core render sequence: base -> optional separable blur -> blit to canvas (default framebuffer)
  function render(params = {}) {
    // params mapping (same mapping as main)
    const sigma = Number(params.sigma) || 0.0;
    const noiseSlider = Number(params.noiseSlider) || 1.0;
    const blurSlider = Number(params.blurSlider) || 0.0;
    const isColor = params.isColor ? 1 : 0;
    const opacity = Number(params.opacity) || 0.0;
    const blendMode = params.blendMode || 'overlay';

    // slider -> values
    const SLIDER_MAX = 1000.0, ZOOM_EXPONENT = 3.0, MAX_NOISE_SIZE = 200.0;
    const t = Math.pow(noiseSlider / SLIDER_MAX, ZOOM_EXPONENT);
    const noiseSize = 1.0 + (MAX_NOISE_SIZE - 1.0) * t;
    const noiseScale = noiseSize;
    const MAX_BLUR = 5.0;
    const bt = Math.pow(blurSlider / SLIDER_MAX, ZOOM_EXPONENT);
    const blurPx = MAX_BLUR * bt;

    ensureTargets(imgW, imgH);

    // base pass -> targetA
    drawTo(fboA, progBase, () => {
      // bind image as unit0
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.uniform1i(gl.getUniformLocation(progBase, 'u_image'), 0);

      // blue-noise unit1
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, blueNoiseTex);
      gl.uniform1i(gl.getUniformLocation(progBase, 'u_blueNoise'), 1);

      gl.uniform2f(gl.getUniformLocation(progBase, 'u_texSize'), imgW, imgH);
      gl.uniform1f(gl.getUniformLocation(progBase, 'u_noiseScale'), noiseScale);
      gl.uniform1f(gl.getUniformLocation(progBase, 'u_sigma'), sigma);
      gl.uniform1i(gl.getUniformLocation(progBase, 'u_useBlueNoise'), 1);
      gl.uniform1i(gl.getUniformLocation(progBase, 'u_colorNoise'), isColor);
      // map blend string to index
      const BLEND_MAP = { 'source-over':0, 'overlay':1, 'screen':2, 'multiply':3, 'lighter':4, 'difference':5 };
      gl.uniform1i(gl.getUniformLocation(progBase, 'u_blendMode'), BLEND_MAP[blendMode] !== undefined ? BLEND_MAP[blendMode] : 1);
      gl.uniform1f(gl.getUniformLocation(progBase, 'u_opacity'), opacity);
    });

    // separable blur if needed
    if (blurPx > 0.01) {
      // horizontal: read targetA -> write targetB
      drawTo(fboB, progBlur, () => {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, targetA);
        gl.uniform1i(gl.getUniformLocation(progBlur, 'u_src'), 0);
        gl.uniform2f(gl.getUniformLocation(progBlur, 'u_texSize'), imgW, imgH);
        gl.uniform2f(gl.getUniformLocation(progBlur, 'u_dir'), 1.0, 0.0);
        gl.uniform1f(gl.getUniformLocation(progBlur, 'u_radius'), blurPx);
      });
      // vertical: read targetB -> write targetA
      drawTo(fboA, progBlur, () => {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, targetB);
        gl.uniform1i(gl.getUniformLocation(progBlur, 'u_src'), 0);
        gl.uniform2f(gl.getUniformLocation(progBlur, 'u_texSize'), imgW, imgH);
        gl.uniform2f(gl.getUniformLocation(progBlur, 'u_dir'), 0.0, 1.0);
        gl.uniform1f(gl.getUniformLocation(progBlur, 'u_radius'), blurPx);
      });
    }

    // final blit targetA -> default framebuffer (OffscreenCanvas)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, offscreen.width, offscreen.height);
    gl.useProgram(progCopy);
    const aPos = gl.getAttribLocation(progCopy, 'a_pos');
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targetA);
    gl.uniform1i(gl.getUniformLocation(progCopy, 'u_src'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disableVertexAttribArray(aPos);
    // notify main thread
    self.postMessage({ type: 'rendered' });
  }

  // produce a preview as ImageBitmap and post back (for crossfade overlay)
  async function previewBlend(params) {
    // render with params
    render(params);
    // create ImageBitmap from offscreen for fast transfer
    try {
      const bmp = await createImageBitmap(offscreen);
      // transfer ImageBitmap back to main
      self.postMessage({ type: 'preview', imageBitmap: bmp }, [bmp]);
    } catch (e) {
      // fallback: use convertToBlob then post blob
      try {
        const blob = await offscreen.convertToBlob({ type: 'image/png' });
        self.postMessage({ type: 'previewBlob', blob });
      } catch (err) {
        self.postMessage({ type: 'error', message: 'preview failed: ' + String(err) });
      }
    }
  }

  // produce PNG blob and post back for download
  async function produceDownload() {
    try {
      // ensure last frame painted
      // convertToBlob supported on OffscreenCanvas in most modern browsers
      const blob = await offscreen.convertToBlob({ type: 'image/png' });
      self.postMessage({ type: 'download', blob });
    } catch (e) {
      // fallback via readPixels -> ImageData conversion (heavier)
      try {
        const w = offscreen.width, h = offscreen.height;
        const pixels = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        const flipped = new Uint8ClampedArray(w * h * 4);
        for (let y = 0; y < h; y++) {
          const srcRow = y, dstRow = h - 1 - y;
          flipped.set(pixels.subarray(srcRow * w * 4, srcRow * w * 4 + w * 4), dstRow * w * 4);
        }
        // create an ImageBitmap from the pixel data via an OffscreenCanvas
        const tmp = new OffscreenCanvas(w, h);
        const tctx = tmp.getContext('2d');
        const id = new ImageData(flipped, w, h);
        tctx.putImageData(id, 0, 0);
        const blob = await tmp.convertToBlob({ type: 'image/png' });
        self.postMessage({ type: 'download', blob });
      } catch (err) {
        self.postMessage({ type: 'error', message: 'download failed: ' + String(err) });
      }
    }
  }

  // handle incoming messages from main
  self.onmessage = async (e) => {
    const msg = e.data;
    if (!msg || !msg.type) return;
    try {
      switch (msg.type) {
        case 'init': {
          // msg.canvas must be an OffscreenCanvas (transferred)
          offscreen = msg.canvas;
          // create WebGL2 context on offscreen
          gl = offscreen.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false });
          if (!gl) {
            self.postMessage({ type: 'error', message: 'webgl2 not available in worker' });
            return;
          }
          initGLResources();
          self.postMessage({ type: 'ready' });
          break;
        }
        case 'uploadImage': {
          // expects ImageBitmap
          const bmp = msg.imageBitmap;
          if (!gl || !bmp) { self.postMessage({ type: 'error', message: 'uploadImage missing context or bitmap' }); break; }
          // update texture
          gl.bindTexture(gl.TEXTURE_2D, imgTex);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
          gl.bindTexture(gl.TEXTURE_2D, null);
          // ensure targets sized to image
          const w = bmp.width || 1, h = bmp.height || 1;
          ensureTargets(w, h);
          // set offscreen size to image so createImageBitmap yields expected dimensions
          try { offscreen.width = w; offscreen.height = h; } catch(e){}
          self.postMessage({ type: 'uploaded' });
          break;
        }
        case 'render': {
          render(msg.params || {});
          break;
        }
        case 'previewBlend': {
          // render and return ImageBitmap for overlay
          await previewBlend(msg.params || {});
          break;
        }
        case 'downloadPNG': {
          await produceDownload();
          break;
        }
        case 'dispose': {
          try {
            // cleanup
            if (gl) {
              try { gl.getExtension('WEBGL_lose_context').loseContext(); } catch (e) {}
            }
          } catch(e){}
          self.postMessage({ type: 'disposed' });
          // optionally close worker from inside (commented out):
          // self.close();
          break;
        }
        default:
          // ignore unknown commands (or post back)
          self.postMessage({ type: 'error', message: 'unknown message type: ' + msg.type });
      }
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err) });
    }
  };

})(); // end worker IIFE
