#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform sampler2D u_mask;
uniform vec2 u_dir; 
uniform float u_rad;
uniform int u_blurType; // 0=Gaussian, 1=Box, 2=Motion

void main() {
    float maskVal = texture(u_mask, v_uv).r;
    vec4 original = texture(u_tex, v_uv);
    
    if (maskVal < 0.01) {
        outColor = original;
        return;
    }
    
    vec4 color = vec4(0.0);
    float total = 0.0;
    
    if (u_blurType == 1) {
        // Box blur (32 taps)
        for(float i = -15.0; i <= 16.0; i++) {
            vec4 s = texture(u_tex, v_uv + u_dir * i * u_rad * 0.5);
            color += s;
            total += 1.0;
        }
    } else if (u_blurType == 2) {
        // Motion blur (32 taps, directional)
        for(float i = -15.0; i <= 16.0; i++) {
            float weight = 1.0 - abs(i) / 16.0;
            vec4 s = texture(u_tex, v_uv + u_dir * i * u_rad * 1.0);
            color += s * weight;
            total += weight;
        }
    } else {
        // Gaussian blur (32 taps)
        for(float i = -15.0; i <= 16.0; i++) {
            float weight = exp(-(i*i) / (2.0 * 5.0 * 5.0)); 
            vec4 s = texture(u_tex, v_uv + u_dir * i * u_rad * 0.5);
            color += s * weight;
            total += weight;
        }
    }
    
    vec4 blurred = color / total;
    outColor = mix(original, blurred, maskVal);
}
