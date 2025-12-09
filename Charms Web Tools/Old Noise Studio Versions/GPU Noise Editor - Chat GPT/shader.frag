// shader.frag
#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_image;
uniform float u_strength;
uniform float u_opacity;
uniform float u_blurriness;
uniform float u_noiseSize;
uniform bool u_colorNoise;
uniform int u_blendMode;
uniform vec2 u_resolution;

// ---- hash function for pseudo-random noise ----
float rand(vec2 co) {
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

// ---- 2D noise with adjustable scale ----
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = rand(i);
    float b = rand(i + vec2(1.0, 0.0));
    float c = rand(i + vec2(0.0, 1.0));
    float d = rand(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) +
           (c - a) * u.y * (1.0 - u.x) +
           (d - b) * u.x * u.y;
}

// ---- Gaussian blur kernel approximation ----
vec4 blur(sampler2D tex, vec2 uv, float radius) {
    if (radius <= 0.0) return texture(tex, uv);
    vec4 sum = vec4(0.0);
    float count = 0.0;
    int steps = int(radius);
    for (int x = -steps; x <= steps; x++) {
        for (int y = -steps; y <= steps; y++) {
            vec2 offs = vec2(float(x), float(y)) / u_resolution;
            sum += texture(tex, uv + offs);
            count += 1.0;
        }
    }
    return sum / count;
}

// ---- blend modes ----
vec3 blendNormal(vec3 base, vec3 blend) { return blend; }
vec3 blendOverlay(vec3 base, vec3 blend) {
    return mix(2.0 * base * blend, 1.0 - 2.0 * (1.0 - base) * (1.0 - blend), step(0.5, base));
}
vec3 blendScreen(vec3 base, vec3 blend) { return 1.0 - (1.0 - base)*(1.0 - blend); }
vec3 blendMultiply(vec3 base, vec3 blend) { return base * blend; }
vec3 blendAdd(vec3 base, vec3 blend) { return min(base + blend, 1.0); }
vec3 blendSubtract(vec3 base, vec3 blend) { return max(base - blend, 0.0); }

void main() {
    vec4 base = texture(u_image, v_texCoord);
    vec2 scaledCoord = v_texCoord * u_noiseSize * 0.1;

    // base noise
    float n = noise(scaledCoord);
    vec3 noiseColor;
    if (u_colorNoise) {
        float n2 = noise(scaledCoord + 13.37);
        float n3 = noise(scaledCoord + 42.42);
        noiseColor = vec3(n, n2, n3);
    } else {
        noiseColor = vec3(n);
    }

    noiseColor = (noiseColor - 0.5) * (u_strength / 100.0) + 0.5;

    // optional blur
    if (u_blurriness > 0.5) {
        noiseColor = blur(u_image, v_texCoord, u_blurriness * 0.1).rgb;
    }

    // apply blend mode
    vec3 blended;
    if      (u_blendMode == 0) blended = blendNormal(base.rgb, noiseColor);
    else if (u_blendMode == 1) blended = blendOverlay(base.rgb, noiseColor);
    else if (u_blendMode == 2) blended = blendScreen(base.rgb, noiseColor);
    else if (u_blendMode == 3) blended = blendMultiply(base.rgb, noiseColor);
    else if (u_blendMode == 4) blended = blendAdd(base.rgb, noiseColor);
    else if (u_blendMode == 5) blended = blendSubtract(base.rgb, noiseColor);
    else blended = noiseColor;

    fragColor = vec4(mix(base.rgb, blended, u_opacity), base.a);
}
