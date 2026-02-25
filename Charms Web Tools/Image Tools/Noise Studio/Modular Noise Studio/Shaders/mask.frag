#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform int u_useS; 
uniform int u_useH;
uniform float u_sth;
uniform float u_sfa;
uniform float u_hth;
uniform float u_hfa;

void main() {
    vec4 c = texture(u_tex, v_uv);
    float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
    
    float sMask = 0.0;
    if (u_useS == 1) {
        float low = u_sth - u_sfa * 0.5;
        float high = u_sth + u_sfa * 0.5;
        sMask = 1.0 - smoothstep(low, high, l);
    }

    float hMask = 0.0;
    if (u_useH == 1) {
        float low = u_hth - u_hfa * 0.5;
        float high = u_hth + u_hfa * 0.5;
        hMask = smoothstep(low, high, l);
    }

    float combined = max(sMask, hMask);
    float exclusion = 1.0 - combined;
    outColor = vec4(exclusion, exclusion, exclusion, 1.0);
}
