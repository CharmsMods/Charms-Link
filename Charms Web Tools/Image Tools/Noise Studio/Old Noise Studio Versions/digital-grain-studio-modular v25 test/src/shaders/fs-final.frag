#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform vec2 u_res;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec4 c = texture(u_tex, v_uv);
    // Perceptually-weighted triangular dither to prevent banding on 8-bit output
    // Triangular distribution is better than uniform for minimizing visible noise
    float r1 = hash(v_uv * u_res);
    float r2 = hash(v_uv * u_res + 1.234);
    float dither = (r1 + r2 - 1.0) / 255.0;
    
    // Manual sRGB Gamma Correction (2.2)
    vec3 linear = c.rgb + dither;
    vec3 srgb = pow(clamp(linear, 0.0, 1.0), vec3(1.0/2.2));
    
    outColor = vec4(srgb, c.a);
}
