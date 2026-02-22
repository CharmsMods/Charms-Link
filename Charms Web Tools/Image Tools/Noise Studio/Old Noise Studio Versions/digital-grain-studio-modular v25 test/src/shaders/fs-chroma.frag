#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform float u_amt;
uniform float u_blur;
uniform vec2 u_center;
uniform float u_radius;
uniform float u_falloff;

uniform float u_zoomBlur;
uniform int u_falloffToBlur;

void main() {
    if (u_amt <= 0.0 && u_blur <= 0.0 && u_zoomBlur <= 0.0) {
        outColor = texture(u_tex, v_uv);
        return;
    }
    
    vec2 dir = v_uv - u_center;
    float dist = length(dir);
    
    // Calculate clear zone mask
    float clearMask = 0.0;
    if (u_radius > 0.0 || u_falloff > 0.0) {
        clearMask = 1.0 - smoothstep(u_radius, u_radius + u_falloff, dist);
    }
    
    float blurStr = u_blur;
    float zoomStr = u_zoomBlur;
    if (u_falloffToBlur == 1) {
        blurStr *= (1.0 - clearMask);
        zoomStr *= (1.0 - clearMask);
    }

    // Calculate aberration strength based on distance from center
    float str = dist * dist * (u_amt / 1000.0); 
    str *= (1.0 - clearMask); 
    
    vec4 result = vec4(0.0);
    
    // We combine edge blur (directional jitter) and zoom blur (radial jitter)
    if (blurStr > 0.0 || zoomStr > 0.0) {
        float totalWeight = 0.0;
        for(float i = -2.0; i <= 2.0; i++) {
            float t = i * blurStr * 0.002; 
            // Zoom blur: samples along the 'dir' vector
            vec2 zoomOff = dir * (i * zoomStr * 0.02);
            float w = exp(-(i*i)/2.0); 
            
            float r = texture(u_tex, v_uv - dir * str + vec2(t, -t) + zoomOff).r;
            float g = texture(u_tex, v_uv + vec2(t*0.5, t*0.5) + zoomOff * 0.5).g; 
            float b = texture(u_tex, v_uv + dir * str + vec2(-t, t) + zoomOff * 1.5).b;
            
            result += vec4(r, g, b, 1.0) * w;
            totalWeight += w;
        }
        result /= totalWeight;
        result.a = texture(u_tex, v_uv).a;
    } else {
        float r = texture(u_tex, v_uv - dir * str).r;
        float g = texture(u_tex, v_uv).g;
        float b = texture(u_tex, v_uv + dir * str).b;
        float a = texture(u_tex, v_uv).a;
        result = vec4(r, g, b, a);
    }
    
    outColor = result;
}
