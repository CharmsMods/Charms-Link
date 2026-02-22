import os
import re

src_dir = './src'
dirs = ['state', 'ui', 'webgl', 'shaders', 'effects', 'workers']

for d in dirs:
    os.makedirs(os.path.join(src_dir, d), exist_ok=True)

input_path = '../v25 unbundled.html'
with open(input_path, 'r', encoding='utf-8') as f:
    source = f.read()

# 1. Extract CSS
style_start = source.find('<style>')
style_end = source.find('</style>')
css = source[style_start + 7:style_end].strip()
with open(os.path.join(src_dir, 'style.css'), 'w', encoding='utf-8') as f:
    f.write(css + '\n')

# 2. Extract HTML UI
first_script = source.find('<script')
html_header = source[:style_start]
html_body = source[style_end + 8:first_script]

final_html = html_header + '    <link rel="stylesheet" href="/src/style.css">\n' + html_body
final_html += '    <script type="module" src="/src/main.js"></script>\n</body>\n</html>\n'
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(final_html)

# 3 & 4. Parse all script tags manually
js_content = ''
shader_count = 0

script_starts = [m.start() for m in re.finditer(r'<script', source)]

for start in script_starts:
    tag_end = source.find('>', start)
    content_end = source.find('</script>', tag_end)
    
    if tag_end == -1 or content_end == -1:
        continue
        
    tag = source[start:tag_end+1]
    content = source[tag_end+1:content_end]
    
    if 'x-shader' in tag:
        # Extract ID
        id_match = re.search(r'id=["\']([^"\']+)["\']', tag)
        type_match = re.search(r'type=["\']([^"\']+)["\']', tag)
        
        script_id = id_match.group(1) if id_match else f"shader_{shader_count}"
        script_type = type_match.group(1) if type_match else ""
        
        ext = '.vert' if 'vertex' in script_type else '.frag'
        
        with open(os.path.join(src_dir, 'shaders', script_id + ext), 'w', encoding='utf-8') as f:
            f.write(content.strip() + '\n')
        shader_count += 1
    else:
        js_content += content + '\n'

with open(os.path.join(src_dir, 'legacy_main.js'), 'w', encoding='utf-8') as f:
    f.write(js_content)

print(f"Extracted style.css, index.html, legacy_main.js, and {shader_count} shaders.")
