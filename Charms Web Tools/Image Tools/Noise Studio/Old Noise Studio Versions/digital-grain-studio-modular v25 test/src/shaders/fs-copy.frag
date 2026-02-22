#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform int u_channel; 

void main() {
    vec4 c = texture(u_tex, v_uv);
    if (u_channel == 1) outColor = vec4(c.rrr, 1.0);
    else if (u_channel == 2) outColor = vec4(c.ggg, 1.0);
    else if (u_channel == 3) outColor = vec4(c.bbb, 1.0);
    else outColor = c;
}
