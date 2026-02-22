import fs from 'fs';
import path from 'path';

const srcDir = './src';
const dirs = ['state', 'ui', 'webgl', 'shaders', 'effects', 'workers'];

// Create directories
fs.mkdirSync(srcDir, { recursive: true });
for (const d of dirs) {
    fs.mkdirSync(path.join(srcDir, d), { recursive: true });
}

const inputPath = '../v25 unbundled.html';
const source = fs.readFileSync(inputPath, 'utf8');

// 1. Extract CSS
const styleStart = source.indexOf('<style>');
const styleEnd = source.indexOf('</style>');
let css = source.substring(styleStart + 7, styleEnd);
fs.writeFileSync(path.join(srcDir, 'style.css'), css.trim() + '\n');

// 2. Extract HTML UI
const firstScript = source.indexOf('<script'); // Line 2412
let htmlHeader = source.substring(0, styleStart); // up to <style>
let htmlBody = source.substring(styleEnd + 8, firstScript); // after </style> up to <script

let finalHtml = htmlHeader + '    <link rel="stylesheet" href="/src/style.css">\n' + htmlBody;
finalHtml += '    <script type="module" src="/src/main.js"></script>\n</body>\n</html>\n';
fs.writeFileSync('index.html', finalHtml);

// 3. Extract Shaders
const shaderRegex = /<script\s+id="([^"]+)"\s+type="x-shader\/x-(fragment|vertex)">([\s\S]*?)<\/script>/g;
let match;
let count = 0;
while ((match = shaderRegex.exec(source)) !== null) {
    const id = match[1];
    const type = match[2];
    const code = match[3];
    const ext = type === 'fragment' ? '.frag' : '.vert';
    fs.writeFileSync(path.join(srcDir, 'shaders', id + ext), code.trim() + '\n');
    count++;
}

// 4. Extract Main Logic (Everything not a shader)
const jsRegex = /<script(?:[^>]*?)>([\s\S]*?)<\/script>/g;
let jsContent = '';
let jsMatch;
while ((jsMatch = jsRegex.exec(source)) !== null) {
    if (jsMatch[0].includes('x-shader')) continue;
    jsContent += jsMatch[1] + '\n';
}
fs.writeFileSync(path.join(srcDir, 'legacy_main.js'), jsContent);

console.log(`Extracted style.css, index.html, legacy_main.js, and ${count} shaders.`);
