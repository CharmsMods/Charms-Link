#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform float u_intensity;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform float u_time;

void main() {
    vec4 col = texture(u_tex, v_uv);
    
    // Create animated gradients using UVs and time
    // Leak 1: from left side
    float leak1 = smoothstep(0.4, 0.0, v_uv.x + sin(v_uv.y * 5.0 + u_time) * 0.1);
    
    // Leak 2: from top right
    float distSq = dot(v_uv - vec2(1.0, 1.0), v_uv - vec2(1.0, 1.0));
    float leak2 = smoothstep(0.8, 0.0, distSq + cos(v_uv.x * 3.0 - u_time * 0.5) * 0.2);
    
    // Accumulate the light leaks
    vec3 resultLeak = (u_color1 * leak1) + (u_color2 * leak2);
    
    // Additive blending based on intensity
    vec3 finalColor = col.rgb + (resultLeak * u_intensity);
    
    outColor = vec4(finalColor, col.a);
}
