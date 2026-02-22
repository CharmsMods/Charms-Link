import os
import re

os.makedirs('src/effects', exist_ok=True)

with open('src/webgl/pipeline.js', 'r', encoding='utf-8') as f:
    pipeline_code = f.read()

start_idx = pipeline_code.find("export function renderSingleLayer")
if start_idx == -1: 
    print("renderSingleLayer not found")
    exit(1)

brace_count = 0
in_block = False
end_idx = -1
for i in range(start_idx, len(pipeline_code)):
    if pipeline_code[i] == '{':
        brace_count += 1
        in_block = True
    elif pipeline_code[i] == '}':
        brace_count -= 1
    
    if in_block and brace_count == 0:
        end_idx = i
        break

func_body = pipeline_code[start_idx:end_idx+1]

matches = list(re.finditer(r"(?:else )?if\s*\(\s*key\s*===\s*'([^']+)'\s*\)\s*\{", func_body))

registry_imports = []
registry_exports = []

for idx, match in enumerate(matches):
    layer_name = match.group(1)
    block_start = match.end() - 1 
    b_count = 0
    b_in_block = False
    block_end = -1
    for i in range(block_start, len(func_body)):
        if func_body[i] == '{':
            b_count += 1
            b_in_block = True
        elif func_body[i] == '}':
            b_count -= 1
        if b_in_block and b_count == 0:
            block_end = i
            break
            
    inner_logic = func_body[block_start+1:block_end].strip()
    
    # We must replace hexToRgb inner references with imports from core.js
    module_code = f"""import {{ state, UI }} from '../state/store.js';
import {{ renderMaskForLayer, requestRender }} from '../webgl/pipeline.js';
import {{ hexToRgb }} from '../webgl/core.js';

export const {layer_name}Effect = {{
    id: '{layer_name}',
    render: (gl, inputTex, outputFbo, uniforms, force = false) => {{
        const w = state.renderWidth;
        const h = state.renderHeight;
        
        {inner_logic}
    }}
}};
"""
    with open(os.path.join('src/effects', f'{layer_name}.js'), 'w', encoding='utf-8') as f:
        f.write(module_code)
        
    registry_imports.append(f"import {{ {layer_name}Effect }} from './{layer_name}.js';")
    registry_exports.append(layer_name + "Effect")

index_code = "\n".join(registry_imports) + "\n\nexport const effectsRegistry = {\n"
for e in registry_exports:
    index_code += f"    '{e[:-6]}': {e},\n"
index_code += "};\n"

with open('src/effects/index.js', 'w', encoding='utf-8') as f:
    f.write(index_code)

new_pipeline_code = pipeline_code[:start_idx] + pipeline_code[end_idx+1:]
new_pipeline_code = "import { effectsRegistry } from '../effects/index.js';\n" + new_pipeline_code

new_pipeline_code = new_pipeline_code.replace(
    "renderSingleLayer(gl, layerKey, state.pingPong[inputIdx].tex, state.pingPong[outputIdx].fbo, uniforms);",
    "if (effectsRegistry[layerKey]) effectsRegistry[layerKey].render(gl, state.pingPong[inputIdx].tex, state.pingPong[outputIdx].fbo, uniforms);"
)

with open('src/webgl/pipeline.js', 'w', encoding='utf-8') as f:
    f.write(new_pipeline_code)

print("Extracted 22 effects and modified pipeline.js")
