#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_tex;
uniform float u_strength;

// The color wheels output RGB. White (1,1,1) means no tint.
uniform vec3 u_shadows;
uniform vec3 u_midtones;
uniform vec3 u_highlights;

// Rec.709 Luma
float getLuma(vec3 rgb) {
    return dot(rgb, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
    vec4 c = texture(u_tex, v_uv);
    vec3 rgb = c.rgb;

    float luma = getLuma(rgb);

    // Calculate influence zones (overlap to create smooth transitions)
    // Note: smoothstep requires edge0 < edge1 in GLSL ES, or behavior is undefined and breaks mathematically on some GPU drivers
    float shadowMask = 1.0 - smoothstep(0.0, 0.4, luma);
    float highlightMask = smoothstep(0.6, 1.0, luma);
    float midtoneMask = 1.0 - max(shadowMask, highlightMask);

    // Convert picker colors from [0, 1] range to [-1, 1] offsets. 
    // If picker is at perfectly white (1.0), it will be mapped to a 0.0 offset.
    // If perfectly black (0.0), mapped to -1.0 offset
    vec3 shadowOffset = (u_shadows - 1.0);
    vec3 midtoneOffset = (u_midtones - 1.0);
    vec3 highlightOffset = (u_highlights - 1.0);

    // Apply multiplicative / additive coloring based on standard Lift/Gamma/Gain math principles
    vec3 graded = rgb;
    graded += shadowOffset * shadowMask * 0.5;       // Lift
    graded += midtoneOffset * midtoneMask * 0.5;     // Gamma shift
    graded += highlightOffset * highlightMask * 0.5; // Gain

    // Mix back based on global strength
    rgb = mix(rgb, graded, u_strength);

    outColor = vec4(clamp(rgb, 0.0, 1.0), c.a);
}
