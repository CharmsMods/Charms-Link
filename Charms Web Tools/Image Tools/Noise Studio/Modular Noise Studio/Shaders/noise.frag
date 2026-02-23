#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform int u_type; 
uniform float u_seed;
uniform vec2 u_res;
uniform float u_scale;
uniform vec2 u_origRes; 
uniform float u_paramA;
uniform float u_paramB;
uniform float u_paramC;

float hash12(vec2 p) {
    vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

// Interleaved Gradient Noise
float IGN(vec2 p) {
    vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
    return fract(magic.z * fract(dot(p, magic.xy)));
}

float getBlue(vec2 p) {
    float white = IGN(p);
    float low = (IGN(p + vec2(1.0, 0.0)) + IGN(p - vec2(1.0, 0.0)) + IGN(p + vec2(0.0, 1.0)) + IGN(p - vec2(0.0, 1.0))) * 0.25;
    return clamp(white - low + 0.5, 0.0, 1.0); 
}

// Perlin Noise (Simple Value Noise variant for better GPU stability)
float perlin(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Worley Noise
float worley(vec2 p) {
    vec2 n = floor(p);
    vec2 f = fract(p);
    float d = 1.0;
    for(int y = -1; y <= 1; y++) {
        for(int x = -1; x <= 1; x++) {
            vec2 g = vec2(float(x), float(y));
            vec2 o = hash22(n + g);
            vec2 r = g + o - f;
            d = min(d, dot(r, r));
        }
    }
    return sqrt(d);
}

void main() {
    vec2 pos = v_uv * u_origRes; 
    float s = max(1.0, u_scale);
    vec2 cell = floor(pos / s);
    
    vec3 n;
    if (u_type == 1) { // Grayscale White
        n = vec3(hash12(cell + u_seed));
    } else if (u_type == 0) { // Color White
        n = vec3(hash12(cell + u_seed), hash12(cell + u_seed + 1.23), hash12(cell + u_seed + 2.45));
    } else if (u_type == 3) { // Blue Noise (Gray)
        n = vec3(getBlue(cell + u_seed * 11.0));
    } else if (u_type == 4) { // Blue Noise (Color)
        n = vec3(getBlue(cell + u_seed * 11.0), getBlue(cell + u_seed * 17.0 + 1.23), getBlue(cell + u_seed * 23.0 + 2.45));
    } else if (u_type == 5) { // Perlin (Cloudy)
        float octs = floor(u_paramA * 7.0) + 1.0; // 1-8 octaves
        float persistence = 0.5 + (u_paramC - 0.5) * 0.5;
        float noiseSum = 0.0;
        float amp = 1.0;
        float freq = 1.0 / (s * 10.0 + (u_paramB * 50.0));
        for(int i = 0; i < 8; i++) {
            if(float(i) >= octs) break;
            noiseSum += perlin(pos * freq + u_seed * 1.5) * amp;
            amp *= persistence;
            freq *= 2.0;
        }
        n = vec3(noiseSum);
    } else if (u_type == 6) { // Worley (Cellular)
        float jitter = u_paramA;
        float density = 1.0 / (s * 5.0 + (u_paramB * 20.0));
        vec2 p = pos * density;
        vec2 n_cell = floor(p);
        vec2 f = fract(p);
        float d = 1.0;
        for(int y = -1; y <= 1; y++) {
            for(int x = -1; x <= 1; x++) {
                vec2 g = vec2(float(x), float(y));
                vec2 o = hash22(n_cell + g) * jitter;
                vec2 r = g + o - f;
                float dist = mix(abs(r.x) + abs(r.y), length(r), u_paramC); // Morph between Manhattan and Euclidean
                d = min(d, dist);
            }
        }
        n = vec3(d);
    } else if (u_type == 7) { // Scanlines
        float thick = mix(0.1, 0.9, u_paramA);
        float jitter = (hash12(vec2(u_seed)) - 0.5) * u_paramB * 5.0;
        float line = sin((pos.y + jitter) / s * 3.14159) * 0.5 + 0.5;
        float val = step(thick, line);
        n = vec3(mix(val, val * hash12(cell + u_seed), u_paramC));
    } else if (u_type == 8) { // Speckle (Dust)
        float density = mix(0.8, 0.999, u_paramA);
        float h = hash12(cell + u_seed);
        float speck = smoothstep(density, density + mix(0.01, 0.1, u_paramB), h);
        float sizeVar = hash12(cell * 0.5 + u_seed);
        n = vec3(speck * mix(1.0, sizeVar, u_paramC));
    } else if (u_type == 9) { // Glitch
        float blockSize = s * (5.0 + u_paramA * 50.0);
        float block = floor(pos.y / blockSize);
        float shift = (hash12(vec2(block, u_seed)) - 0.5) * u_paramB * 100.0;
        float split = u_paramC * 10.0;
        n = vec3(
            hash12(floor((pos + vec2(shift - split, 0.0)) / s) + u_seed),
            hash12(floor((pos + vec2(shift, 0.0)) / s) + u_seed),
            hash12(floor((pos + vec2(shift + split, 0.0)) / s) + u_seed)
        );
    } else if (u_type == 10) { // Anisotropic (Fiber)
        float stretch = 0.01 + u_paramA * 0.5;
        float rot = u_paramB * 6.28;
        mat2 m = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
        vec2 p = (m * pos) * vec2(stretch, 1.0) / s;
        float h = hash12(floor(p) + u_seed);
        n = vec3(mix(h, h * hash12(cell + u_seed), u_paramC));
    } else if (u_type == 11) { // Voronoi Mosaic
        float scale = 1.0 / (s * 10.0 + u_paramA * 40.0);
        vec2 p = pos * scale;
        vec2 n_cell = floor(p);
        vec2 f = fract(p);
        float d = 1.0;
        vec2 m_cell;
        for(int y = -1; y <= 1; y++) {
            for(int x = -1; x <= 1; x++) {
                vec2 g = vec2(float(x), float(y));
                vec2 o = hash22(n_cell + g) * u_paramB;
                vec2 r = g + o - f;
                float dist = dot(r, r);
                if (dist < d) { d = dist; m_cell = n_cell + g; }
            }
        }
        vec3 col = vec3(hash12(m_cell + u_seed), hash12(m_cell + u_seed + 1.1), hash12(m_cell + u_seed + 2.2));
        n = mix(col, vec3(sqrt(d)), u_paramC);
    } else if (u_type == 12) { // Crosshatch
        float dens = 1.0 / (s * (1.0 + u_paramA * 5.0));
        float angle = u_paramB * 1.57;
        mat2 m1 = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        mat2 m2 = mat2(cos(-angle), -sin(-angle), sin(-angle), cos(-angle));
        float l1 = step(0.8, sin((m1 * pos).x * dens) * 0.5 + 0.5);
        float l2 = step(0.8, sin((m2 * pos).x * dens) * 0.5 + 0.5);
        float hatch = max(l1, l2);
        n = vec3(mix(hatch, hatch * hash12(cell + u_seed), u_paramC));
    } else {
        n = vec3(hash12(cell + u_seed));
    }
    
    outColor = vec4(n, 1.0);
}
