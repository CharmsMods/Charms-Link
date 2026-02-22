#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform vec3 u_palette[256];
uniform int u_paletteSize;
uniform float u_blend;
uniform float u_smoothing;
uniform int u_smoothingType;
uniform vec2 u_res;

void main() {
    vec4 c = texture(u_tex, v_uv);
    vec3 original = c.rgb;
    vec2 texel = 1.0 / u_res;
    
    if (u_smoothing > 0.0) {
        float sumW = 0.0;
        vec3 sumC = vec3(0.0);
        float r = u_smoothing / 10.0; // Effective radius
        
        for(float i = -1.0; i <= 1.0; i++) {
            for(float j = -1.0; j <= 1.0; j++) {
                vec2 off = vec2(i, j) * texel * r;
                float weight = 1.0;
                
                if (u_smoothingType == 1) {
                    // 3x3 Gaussian Weights
                    float distSq = i*i + j*j;
                    weight = exp(-distSq / 1.0); // Simple Gaussian
                }
                
                sumC += texture(u_tex, v_uv + off).rgb * weight;
                sumW += weight;
            }
        }
        original = sumC / sumW;
    }
    
    if (u_paletteSize == 0) {
        outColor = c;
        return;
    }
    
    float minDist = 1e10;
    vec3 bestColor = u_palette[0];
    
    for (int i = 0; i < u_paletteSize; i++) {
        float d = distance(original, u_palette[i]);
        if (d < minDist) {
            minDist = d;
            bestColor = u_palette[i];
        }
    }
    
    vec3 res = mix(original, bestColor, u_blend);
    outColor = vec4(clamp(res, 0.0, 1.0), c.a);
}
