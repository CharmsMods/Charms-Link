#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;

void main() {
    float mask = texture(u_tex, v_uv).r;
    float inv = 1.0 - mask;
    // We output inversed mask to R channel (and everything else for safety)
    outColor = vec4(inv, inv, inv, 1.0);
}
