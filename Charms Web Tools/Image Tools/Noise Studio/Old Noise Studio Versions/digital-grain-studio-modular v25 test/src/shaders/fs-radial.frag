#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform vec2 u_res;
uniform vec2 u_center;
uniform float u_radius;
uniform float u_falloff;

void main() {
    float dist = length(v_uv - u_center);
    float mask = 1.0 - smoothstep(u_radius, u_radius + u_falloff, dist);
    outColor = vec4(vec3(mask), 1.0);
}
