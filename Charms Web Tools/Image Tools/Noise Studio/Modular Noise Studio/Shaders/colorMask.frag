#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform vec3 u_targetColor;
uniform float u_tolerance;
uniform float u_fade;

void main() {
    vec4 c = texture(u_tex, v_uv);
    float d = distance(c.rgb, u_targetColor);
    float mask = 1.0 - smoothstep(u_tolerance, u_tolerance + u_fade + 0.001, d);
    outColor = vec4(mask, mask, mask, 1.0);
}
