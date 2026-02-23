#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform vec2 u_res;

// Controls
uniform float u_size;           // 1-12
uniform float u_intensity;      // 0-1
uniform float u_sharpness;      // 0-1
uniform int u_pattern;          // 0=Circ, 1=Line, 2=Cross, 3=Diamond
uniform int u_colorMode;        // 0=Luma, 1=RGB, 2=CMY, 3=CMYK
uniform int u_sample;           // 0=Center, 1=Avg
uniform int u_gray;             // Bool
uniform int u_lock;             // Bool
uniform int u_invert;           // Bool

float getPattern(vec2 uv, float angle) {
    float s = sin(angle), c = cos(angle);
    vec2 p = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y) * u_res / u_size;
    vec2 grid = fract(p) - 0.5;
    
    float d = 0.0;
    if (u_pattern == 0) { // Circle
        d = length(grid) * 2.0;
    } else if (u_pattern == 1) { // Line
        d = abs(grid.y) * 2.0;
    } else if (u_pattern == 2) { // Cross
        d = min(abs(grid.x), abs(grid.y)) * 2.0;
    } else { // Diamond
        d = (abs(grid.x) + abs(grid.y));
    }
    
    return d;
}

void main() {
    float angle = 0.0;
    if (u_sample == 2) angle = 0.785;
    
    vec4 col = texture(u_tex, v_uv);
    
    vec3 outRGB = vec3(0.0);
    
    if (u_colorMode == 0) { // Luminance
        float l = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
        float pat = getPattern(v_uv, 0.785);
        
        float thresh = 1.0 - l * u_intensity;
        float softness = 1.0 - u_sharpness;
        float val = smoothstep(thresh - softness, thresh + softness, pat);
        
        if (u_invert == 1) val = 1.0 - val;
        outRGB = vec3(val);
        
    } else if (u_colorMode == 1) { // RGB
        float pR = getPattern(v_uv, 0.26);
        float pG = getPattern(v_uv, 1.30);
        float pB = getPattern(v_uv, 0.0);
        
        float soft = 1.0 - u_sharpness;
        
        float r = smoothstep((1.0 - col.r) - soft, (1.0 - col.r) + soft, pR);
        float g = smoothstep((1.0 - col.g) - soft, (1.0 - col.g) + soft, pG);
        float b = smoothstep((1.0 - col.b) - soft, (1.0 - col.b) + soft, pB);
        
        outRGB = vec3(r, g, b);
        if (u_invert == 1) outRGB = 1.0 - outRGB;
        
    } else { // CMY / CMYK
        vec3 cmy = 1.0 - col.rgb;
        float k = 0.0;
        if (u_colorMode == 3) { // CMYK
            k = min(min(cmy.x, cmy.y), cmy.z);
            cmy = (cmy - k) / (1.0 - k);
        }
        
        float pC = getPattern(v_uv, 0.26);
        float pM = getPattern(v_uv, 1.30);
        float pY = getPattern(v_uv, 0.0);
        float pK = getPattern(v_uv, 0.785);
        
        float soft = 1.0 - u_sharpness;
        
        float hC = 1.0 - smoothstep(cmy.x - soft, cmy.x + soft, pC);
        float hM = 1.0 - smoothstep(cmy.y - soft, cmy.y + soft, pM);
        float hY = 1.0 - smoothstep(cmy.z - soft, cmy.z + soft, pY);
        float hK = 1.0 - smoothstep(k - soft, k + soft, pK);
        
        vec3 resCMY = vec3(hC, hM, hY);
        if (u_colorMode == 3) resCMY += vec3(hK);
        
        outRGB = 1.0 - clamp(resCMY, 0.0, 1.0);
        if (u_invert == 1) outRGB = 1.0 - outRGB;
    }
    
    if (u_gray == 1) {
        float l = dot(outRGB, vec3(0.2126, 0.7152, 0.0722));
        outRGB = vec3(l);
    }
    
    outColor = vec4(outRGB, col.a);
}
