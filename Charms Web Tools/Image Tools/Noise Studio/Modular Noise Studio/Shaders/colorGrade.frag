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

    // Convert picker colors to chromatic offsets. 
    // If picker is at perfectly white (1.0), it evaluates to 0.0.
    // Subtracting the luma creates a balanced vector that ADDS the hue and subtracts complements.
    vec3 shadowOffset = (u_shadows - getLuma(u_shadows)) * 1.5;
    vec3 midtoneOffset = (u_midtones - getLuma(u_midtones)) * 1.5;
    vec3 highlightOffset = (u_highlights - getLuma(u_highlights)) * 1.5;

    // Apply multiplicative / additive coloring based on standard Lift/Gamma/Gain math principles
    vec3 graded = rgb;
    
    // Lift (Shadows): Additive offset that fades out in brighter areas
    graded += shadowOffset * shadowMask;
    
    // Gamma (Midtones): Power/Gamma adjustment approximated using an additive shift proportional to midtones
    graded += midtoneOffset * midtoneMask;
    
    // Gain (Highlights): Multiplicative gain to tint bright areas without washing out blacks
    graded += (graded * highlightOffset * 1.0) * highlightMask;

    // Mix back based on global strength
    rgb = mix(rgb, graded, u_strength);

    outColor = vec4(clamp(rgb, 0.0, 1.0), c.a);
}
