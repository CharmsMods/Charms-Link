#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform sampler2D u_mask;
uniform int u_useMask;
uniform float u_bright;
uniform float u_cont;
uniform float u_sat;
uniform float u_hdrTol;
uniform float u_hdrAmt;
uniform float u_warmth;
uniform float u_sharp;
uniform float u_sharpThresh;
uniform vec2 u_step;

void main() {
    vec4 c = texture(u_tex, v_uv);
    vec3 original = c.rgb;
    vec3 rgb = c.rgb;

    // Saturation
    float lum = dot(rgb, vec3(0.299,0.587,0.114));
    rgb = mix(vec3(lum), rgb, 1.0 + u_sat);

    // Contrast
    rgb = (rgb - 0.5) * (1.0 + u_cont/100.0) + 0.5;

    // Brightness
    rgb += u_bright/100.0;

    // Warmth
    if (u_warmth != 0.0) {
        vec3 warmColor = vec3(1.0, 0.9, 0.8); 
        vec3 coolColor = vec3(0.8, 0.9, 1.1); 
        float t = clamp(u_warmth / 100.0, -1.0, 1.0);
        vec3 tint = mix(coolColor, warmColor, t * 0.5 + 0.5);
        float mask = smoothstep(0.0, 1.0, lum);
        rgb = mix(rgb, rgb * tint, abs(t) * mask);
    }

    // Sharpening
    if (u_sharp > 0.0) {
        vec4 sum = vec4(0.0);
        sum += texture(u_tex, v_uv + vec2(-u_step.x, -u_step.y));
        sum += texture(u_tex, v_uv + vec2( u_step.x, -u_step.y));
        sum += texture(u_tex, v_uv + vec2(-u_step.x,  u_step.y));
        sum += texture(u_tex, v_uv + vec2( u_step.x,  u_step.y));
        vec4 edge = c - (sum * 0.25);
        rgb += edge.rgb * (u_sharp / 10.0); 
    }

    // HDR Emulation
    float l = dot(rgb, vec3(0.299,0.587,0.114));
    if (l < u_hdrTol && u_hdrTol > 0.0) {
        float f = (u_hdrAmt/100.0) * (1.0 - l/u_hdrTol);
        rgb *= (1.0 - f);
    }

    // Apply mask if enabled
    if (u_useMask == 1) {
        float maskVal = texture(u_mask, v_uv).r;
        rgb = mix(original, rgb, maskVal);
    }

    outColor = vec4(clamp(rgb, 0.0, 1.0), c.a);
}
