#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform float u_time;     // For animation
uniform float u_wobble;   // 0-1
uniform float u_bleed;    // 0-1
uniform float u_curve;    // 0-1
uniform float u_noise;    // 0-1

// Simple PRNG
float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main() {
    vec2 uv = v_uv;

    // 1. CRT Curvature
    vec2 cc = uv - 0.5;
    float r2 = cc.x*cc.x + cc.y*cc.y;
    uv = cc * (1.0 + u_curve * r2 * 2.0) + 0.5;

    // Border masking for curvature
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        outColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    // 2. Tape Tracking Wobble
    float wobbleOffset = sin(uv.y * 20.0 + u_time * 5.0) * 0.005 + 
                         sin(uv.y * 50.0 - u_time * 15.0) * 0.002;
    uv.x += wobbleOffset * u_wobble;

    // 3. Chromatic Bleed
    float bleedOffset = 0.005 * u_bleed;
    float r = texture(u_tex, vec2(uv.x + bleedOffset, uv.y)).r;
    float g = texture(u_tex, uv).g;
    float b = texture(u_tex, vec2(uv.x - bleedOffset, uv.y)).b;
    vec3 col = vec3(r, g, b);

    // 4. Scanline Noise
    float scanline = sin(uv.y * 800.0) * 0.04 * u_noise;
    float staticNoise = (rand(uv + mod(u_time, 10.0)) - 0.5) * 0.1 * u_noise;
    col += scanline + staticNoise;

    outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
