#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform vec3 u_targetColor;  // RGB 0-1
uniform float u_tolerance;   // 0-1
uniform float u_fade;        // 0-1

void main() {
    vec4 c = texture(u_tex, v_uv);
    float dist = length(c.rgb - u_targetColor);
    float low = u_tolerance - u_fade * 0.5;
    float high = u_tolerance + u_fade * 0.5;
    float mask = smoothstep(low, high, dist);
    // mask = 0 when color matches (to exclude), 1 elsewhere
    outColor = vec4(mask, mask, mask, 1.0);
}
