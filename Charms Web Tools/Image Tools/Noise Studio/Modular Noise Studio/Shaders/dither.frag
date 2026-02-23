#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform int u_type; // 0=B8, 1=B4, 2=B2, 3=Noise, 4=IGN
uniform float u_bitDepth;
uniform float u_paletteSize;
uniform float u_strength;
uniform float u_scale;
uniform vec2 u_res;
uniform float u_seed;
uniform int u_usePalette;
uniform int u_gamma;
uniform vec3 u_customPalette[256];

float bayer8x8(vec2 pos) {
    int x = int(mod(pos.x, 8.0));
    int y = int(mod(pos.y, 8.0));
    int index = x + y * 8;
    int pattern[64] = int[64](
         0, 32,  8, 40,  2, 34, 10, 42,
        48, 16, 56, 24, 50, 18, 58, 26,
        12, 44,  4, 36, 14, 46,  6, 38,
        60, 28, 52, 20, 62, 30, 54, 22,
         3, 35, 11, 43,  1, 33,  9, 41,
        51, 19, 59, 27, 49, 17, 57, 25,
        15, 47,  7, 39, 13, 45,  5, 37,
        63, 31, 55, 23, 61, 29, 53, 21
    );
    return float(pattern[index]) / 64.0;
}

float bayer4x4(vec2 pos) {
    int x = int(mod(pos.x, 4.0));
    int y = int(mod(pos.y, 4.0));
    int index = x + y * 4;
    int pattern[16] = int[16](
        0, 8, 2, 10,
        12, 4, 14, 6,
        3, 11, 1, 9,
        15, 7, 13, 5
    );
    return float(pattern[index]) / 16.0;
}

float bayer2x2(vec2 pos) {
    int x = int(mod(pos.x, 2.0));
    int y = int(mod(pos.y, 2.0));
    int index = x + y * 2;
    int pattern[4] = int[4](0, 2, 3, 1);
    return float(pattern[index]) / 4.0;
}

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float ign(vec2 p) {
    vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
    return fract(magic.z * fract(dot(p, magic.xy)));
}

void main() {
    vec4 col = texture(u_tex, v_uv);
    vec3 color = col.rgb;
    
    if (u_gamma == 1) {
        color = pow(color, vec3(2.2));
    }
    
    vec2 scaledPos = floor(v_uv * u_res / max(1.0, u_scale));
    
    float threshold;
    if (u_type == 0) threshold = bayer8x8(scaledPos) - 0.5;
    else if (u_type == 1) threshold = bayer4x4(scaledPos) - 0.5;
    else if (u_type == 2) threshold = bayer2x2(scaledPos) - 0.5;
    else if (u_type == 3) threshold = hash12(scaledPos + u_seed) - 0.5;
    else threshold = ign(scaledPos) - 0.5;
    
    float levels = pow(2.0, u_bitDepth);
    vec3 dithered = color + threshold * (u_strength) * (1.0 / levels);
    
    vec3 result;
    if (u_usePalette == 1 && u_paletteSize > 0.5) {
        float minDist = 1e10;
        result = u_customPalette[0];
        int size = int(u_paletteSize);
        for (int i = 0; i < 256; i++) {
            if (i >= size) break;
            float d = distance(dithered, u_customPalette[i]);
            if (d < minDist) {
                minDist = d;
                result = u_customPalette[i];
            }
        }
    } else {
        result = floor(dithered * levels + 0.5) / levels;
        result = floor(result * u_paletteSize + 0.5) / u_paletteSize;
    }
    
    if (u_gamma == 1) {
        result = pow(result, vec3(1.0/2.2));
    }
    
    outColor = vec4(clamp(result, 0.0, 1.0), col.a);
}
