#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform vec2 u_res;

// Controls
uniform int u_levels;         // 2-12
uniform float u_bias;         // -1.0 to 1.0 (contrast bias)
uniform float u_gamma;        // 0.5 to 2.2
uniform int u_quantMode;      // 0=Luma, 1=RGB, 2=HSV
uniform int u_bandMap;        // 0=Linear, 1=Smooth, 2=Poster
uniform int u_edgeMethod;     // 0=None, 1=Sobel, 2=Laplc
uniform float u_edgeStr;      // 0-1
uniform float u_edgeThick;    // 0.5-3.0
uniform int u_colorPreserve;  // 0/1 bool
uniform int u_edgeEnable;     // 0/1 bool

vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float getLuma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

float quantize(float val, int levels, float bias, float gamma) {
    // Apply bias
    val = clamp(val + bias, 0.0, 1.0);
    
    // Apply gamma
    val = pow(val, gamma);
    
    // Quantize
    float fLevels = float(levels);
    float q = floor(val * fLevels) / (fLevels - 1.0);
    
    // Map output based on band mode
    if (u_bandMap == 1) { // Smooth
        q = smoothstep(0.0, 1.0, q);
    } else if (u_bandMap == 2) { // Posterize hard
        q = floor(val * fLevels) / fLevels; 
    }
    
    return q;
}

float sobel(vec2 uv) {
    vec2 px = vec2(u_edgeThick, u_edgeThick) / u_res;
    float l00 = getLuma(texture(u_tex, uv + vec2(-px.x, -px.y)).rgb);
    float l10 = getLuma(texture(u_tex, uv + vec2(0.0, -px.y)).rgb);
    float l20 = getLuma(texture(u_tex, uv + vec2(px.x, -px.y)).rgb);
    float l01 = getLuma(texture(u_tex, uv + vec2(-px.x, 0.0)).rgb);
    float l21 = getLuma(texture(u_tex, uv + vec2(px.x, 0.0)).rgb);
    float l02 = getLuma(texture(u_tex, uv + vec2(-px.x, px.y)).rgb);
    float l12 = getLuma(texture(u_tex, uv + vec2(0.0, px.y)).rgb);
    float l22 = getLuma(texture(u_tex, uv + vec2(px.x, px.y)).rgb);
    
    float gx = l00 + 2.0*l01 + l02 - (l20 + 2.0*l21 + l22);
    float gy = l00 + 2.0*l10 + l20 - (l02 + 2.0*l12 + l22);
    
    return sqrt(gx*gx + gy*gy);
}

float laplacian(vec2 uv) {
    vec2 px = vec2(u_edgeThick, u_edgeThick) / u_res;
    float l01 = getLuma(texture(u_tex, uv + vec2(-px.x, 0.0)).rgb);
    float l21 = getLuma(texture(u_tex, uv + vec2(px.x, 0.0)).rgb);
    float l10 = getLuma(texture(u_tex, uv + vec2(0.0, -px.y)).rgb);
    float l12 = getLuma(texture(u_tex, uv + vec2(0.0, px.y)).rgb);
    float l11 = getLuma(texture(u_tex, uv).rgb); // Center
    
    return abs(l01 + l21 + l10 + l12 - 4.0 * l11) * 2.0;
}

void main() {
    vec4 base = texture(u_tex, v_uv);
    vec3 col = base.rgb;
    
    // Apply Quantization
    vec3 res = col;
    if (u_quantMode == 0) { // Luma
        float l = getLuma(col);
        float q = quantize(l, u_levels, u_bias, u_gamma);
        if (u_colorPreserve == 1) {
            // Preserve color, only quantize lightness
            vec3 hsv = rgb2hsv(col);
            hsv.z = q;
            res = hsv2rgb(hsv);
        } else {
            res = vec3(q);
        }
    } else if (u_quantMode == 1) { // RGB
        res.r = quantize(col.r, u_levels, u_bias, u_gamma);
        res.g = quantize(col.g, u_levels, u_bias, u_gamma);
        res.b = quantize(col.b, u_levels, u_bias, u_gamma);
    } else { // HSV Value
        vec3 hsv = rgb2hsv(col);
        hsv.z = quantize(hsv.z, u_levels, u_bias, u_gamma);
        res = hsv2rgb(hsv);
    }
    
    // Apply Edges
    if (u_edgeEnable == 1 && u_edgeMethod > 0) {
        float edge = 0.0;
        if (u_edgeMethod == 1) edge = sobel(v_uv);
        else if (u_edgeMethod == 2) edge = laplacian(v_uv);
        
        edge = smoothstep(0.1, 1.0, edge * 2.0); // Boost edge visibility
        res = mix(res, vec3(0.0), edge * u_edgeStr);
    }
    
    outColor = vec4(res, base.a);
}
