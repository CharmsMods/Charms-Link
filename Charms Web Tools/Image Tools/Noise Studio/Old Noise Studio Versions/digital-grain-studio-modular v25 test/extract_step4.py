import os

with open('src/legacy_main.js', 'r', encoding='utf-8') as f:
    code = f.read()

def extract_func(name):
    start_str = f"function {name}("
    start_idx = code.find(start_str)
    if start_idx == -1: return ""
    brace_count = 0
    in_block = False
    for i in range(start_idx, len(code)):
        if code[i] == '{':
            brace_count += 1
            in_block = True
        elif code[i] == '}':
            brace_count -= 1
        
        if in_block and brace_count == 0:
            return code[start_idx:i+1]
    return ""

init_webgl = extract_func("initWebGL")
load_new_img = extract_func("loadNewImage")
reallocate = extract_func("reallocateBuffers")
create_tex = extract_func("createTexture")
hex2rgb = extract_func("hexToRgb")

render_mask = extract_func("renderMaskForLayer")
render_single = extract_func("renderSingleLayer")
render_frame = extract_func("renderFrame")
update_hist = extract_func("updateHistogram")
update_vector = extract_func("updateVectorscope")
calc_curve = extract_func("calcCurve")
update_previews = extract_func("updateLayerPreviews")
setup_layer_grid = extract_func("setupLayerGridDOM")

core_js = """import { state, UI } from '../state/store.js';

const shaders = import.meta.glob('../shaders/*.{frag,vert}', { eager: true, import: 'default' });

export function createShader(gl, type, srcId) {
    const ext = type == 'vs-quad' ? '.vert' : '.frag';
    const filePath = `../shaders/${srcId}${ext}`;
    let src = shaders[filePath];
    if (!src) {
        console.error("Shader not found:", filePath);
        return null;
    }
    src = src.trim();
    const shader = gl.createShader(type == 'vs-quad' ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error in " + srcId + ":", gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

export function createProgram(gl, vsId, fsId) {
    const vs = createShader(gl, 'vs-quad', vsId);
    const fs = createShader(gl, 'fs-fragment', fsId);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    return p;
}

"""
core_js += f"export {init_webgl}\n\nexport {load_new_img}\n\nexport {reallocate}\n\nexport {create_tex}\n\nexport {hex2rgb}\n"

with open('src/webgl/core.js', 'w', encoding='utf-8') as f:
    f.write(core_js)

pipeline_js = """import { state, UI, LAYERS } from '../state/store.js';
import { reallocateBuffers, createTexture, hexToRgb } from './core.js';

export """ + update_hist + """

export """ + update_vector + """

export """ + render_mask + """

export """ + render_single + """

export """ + render_frame + """

export """ + calc_curve + """

export """ + update_previews + """

export """ + setup_layer_grid + """

export function requestRender() {
    if (!state._renderRequested && state.baseImage) {
        state._renderRequested = true;
        requestAnimationFrame(() => {
            renderFrame();
            state._renderRequested = false;
        });
    }
}
"""
with open('src/webgl/pipeline.js', 'w', encoding='utf-8') as f:
    f.write(pipeline_js)

print("Extracted core.js and pipeline.js")
