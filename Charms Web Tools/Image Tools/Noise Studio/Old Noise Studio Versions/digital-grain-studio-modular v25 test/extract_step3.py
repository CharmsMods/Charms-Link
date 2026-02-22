import os

with open('src/legacy_main.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. store.js
state_start = code.find("const APP_VERSION =")
state_end = code.find("// --- INIT ---")
if state_start == -1 or state_end == -1:
    print("Error finding state boundaries")

store_code = code[state_start:state_end].strip()
store_code = store_code.replace('const state =', 'export const state =')
store_code = store_code.replace('const LAYERS =', 'export const LAYERS =')
store_code = store_code.replace('const APP_VERSION =', 'export const APP_VERSION =')
store_code += "\n\nexport const UI = {};\n"

with open('src/state/store.js', 'w', encoding='utf-8') as f:
    f.write(store_code + '\n')

# 2. dom.js
dom_code = "import { UI } from '../state/store.js';\n\nexport function initDOM() {\n"
dom_start = code.find("// [DOM COLLECTION]")
dom_end = code.find("// [TABS]")
dom_inner = code[dom_start:dom_end].strip()
dom_code += "    " + dom_inner.replace('\n', '\n    ') + "\n}\n"

with open('src/ui/dom.js', 'w', encoding='utf-8') as f:
    f.write(dom_code)

# 3. events.js
events_start = code.find("// [TABS]")
events_end = code.find("});\n\n        // --- JSON PRESETS ---")
events_inner = code[events_start:events_end].strip()

funcs_start = code.find("// --- JSON PRESETS ---")
funcs_end = code.find("// --- WEBGL CORE ---") # Everything up to WebGL Core
funcs_inner = code[funcs_start:funcs_end].strip()

# Extract render loop manager out of funcs_inner if needed, but it's fine in events for now
# We will just write the events file out
events_code = """import { state, LAYERS, APP_VERSION, UI } from '../state/store.js';
import { requestRender, reallocateBuffers, renderFrame, initWebGL } from '../webgl/core.js';
// Add any other missing imports dynamically later

export function initEvents() {
"""
events_code += "    " + events_inner.replace('\n', '\n    ') + "\n}\n\n"
events_code += funcs_inner + "\n"

with open('src/ui/events.js', 'w', encoding='utf-8') as f:
    f.write(events_code)

print("Extracted store.js, dom.js, and events.js")
