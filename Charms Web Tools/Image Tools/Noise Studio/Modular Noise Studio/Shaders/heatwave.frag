#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform float u_time;     // For animation
uniform float u_intensity;// Overall strength
uniform float u_speed;    // Animation speed
uniform float u_scale;    // Size of the waves/ripples
uniform int u_direction;  // 0 = Vertical (Heat), 1 = Horizontal, 2 = Radial (Ripple)

void main() {
    vec2 uv = v_uv;
    vec2 offset = vec2(0.0);
    
    float t = u_time * u_speed;
    
    if (u_direction == 0) {
        // Vertical Distortion (Heat rising)
        offset.x = sin(uv.y * u_scale + t) * u_intensity;
        offset.x += cos(uv.y * u_scale * 2.5 - t * 1.5) * (u_intensity * 0.3);
    } 
    else if (u_direction == 1) {
        // Horizontal Distortion (Flag waving)
        offset.y = sin(uv.x * u_scale + t) * u_intensity;
        offset.y += cos(uv.x * u_scale * 2.5 - t * 1.5) * (u_intensity * 0.3);
    }
    else if (u_direction == 2) {
        // Radial Distortions (Ripples originating from center)
        vec2 center = vec2(0.5, 0.5);
        vec2 d = uv - center;
        float dist = length(d);
        
        float wave = sin(dist * u_scale - t) * u_intensity;
        
        vec2 dir = normalize(d);
        if (dist > 0.0001) {
            offset = dir * wave;
        }
    }
    
    // Apply displacement
    vec2 final_uv = uv + offset;
    
    // Clamp to edges
    final_uv = clamp(final_uv, 0.0, 1.0);

    outColor = texture(u_tex, final_uv);
}
