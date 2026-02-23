#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform int u_mode; // 0=Overlay, 1=Saturation
uniform float u_strength;
uniform float u_tolerance;
uniform float u_bgSat;
uniform float u_fgSat;
uniform float u_bloom;
uniform float u_smooth;
uniform float u_blend;

float getLuma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
    vec2 texel = 1.0 / u_res;
    
    // Sobel Kernels
    float x = texel.x;
    float y = texel.y;
    
    float m00 = getLuma(texture(u_tex, v_uv + vec2(-x, -y)).rgb);
    float m01 = getLuma(texture(u_tex, v_uv + vec2( 0, -y)).rgb);
    float m02 = getLuma(texture(u_tex, v_uv + vec2( x, -y)).rgb);
    float m10 = getLuma(texture(u_tex, v_uv + vec2(-x,  0)).rgb);
    float m12 = getLuma(texture(u_tex, v_uv + vec2( x,  0)).rgb);
    float m20 = getLuma(texture(u_tex, v_uv + vec2(-x,  y)).rgb);
    float m21 = getLuma(texture(u_tex, v_uv + vec2( 0,  y)).rgb);
    float m22 = getLuma(texture(u_tex, v_uv + vec2( x,  y)).rgb);
    
    float gx = (m02 + 2.0*m12 + m22) - (m00 + 2.0*m10 + m20);
    float gy = (m00 + 2.0*m01 + m02) - (m20 + 2.0*m21 + m22);
    
    float edge = sqrt(gx*gx + gy*gy);
    
    // Threshold & Strength
    edge = smoothstep(u_tolerance / 100.0, (u_tolerance + 10.0) / 100.0, edge) * (u_strength / 100.0);
    edge = clamp(edge, 0.0, 1.0);
    
    float spreadMask = edge;
    
    if (u_bloom > 0.0) {
        float accumE = 0.0;
        float radius = u_bloom;
        int taps = clamp(int(radius * 1.5), 16, 48);
        float tapLimit = float(taps);
        
        for(int i = 1; i <= 48; i++) {
            if (i > taps) break;
            float f = float(i);
            float r = sqrt(f / tapLimit) * radius;
            float theta = f * 2.39996323; // Golden angle
            vec2 off = vec2(cos(theta), sin(theta)) * r * texel;
            
            // Approximate gradient at neighbor to see if it's an edge
            float nL = getLuma(texture(u_tex, v_uv + off).rgb);
            float nLx = getLuma(texture(u_tex, v_uv + off + vec2(x, 0.0)).rgb);
            float nLy = getLuma(texture(u_tex, v_uv + off + vec2(0.0, y)).rgb);
            
            float ne = abs(nLx - nL) + abs(nLy - nL);
            ne = smoothstep(u_tolerance / 100.0, (u_tolerance + 10.0) / 100.0, ne * 4.0) * (u_strength / 100.0);
            
            // Fade based on u_smooth slider
            float falloff = mix(1.0, 1.0 - (r / radius), clamp(u_smooth / 100.0, 0.0, 1.0));
            
            accumE += ne * max(falloff, 0.0);
        }
        
        float bloomE = clamp((accumE / sqrt(tapLimit)) * 1.6, 0.0, 1.0);
        spreadMask = max(edge, bloomE);
    }
    
    vec4 c = texture(u_tex, v_uv);
    vec3 res = c.rgb;
    
    if (u_mode == 0) {
        // Overlay Mode
        res = mix(c.rgb, vec3(1.0), spreadMask);
    } else {
        // Saturation Mask Mode
        float lum = getLuma(c.rgb);
        vec3 bw = vec3(lum);
        
        // Background: Desaturated or partially saturated
        vec3 bg = mix(bw, c.rgb, u_bgSat / 100.0);
        // Foreground: Saturated
        vec3 fg = mix(bw, c.rgb, u_fgSat / 100.0);
        
        res = mix(bg, fg, spreadMask);
    }
    
    outColor = vec4(mix(c.rgb, res, u_blend / 100.0), c.a);
}
