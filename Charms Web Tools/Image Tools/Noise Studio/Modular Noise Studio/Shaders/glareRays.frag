#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform sampler2D u_mask;
uniform vec2 u_res;
uniform float u_time;
uniform float u_intensity;
uniform float u_rays;
uniform float u_length;
uniform float u_blur;
in vec2 v_uv;
out vec4 outColor;

void main() {
    vec2 center = vec2(0.5);
    vec2 dir = v_uv - center;
    float r = length(dir);
    float theta = atan(dir.y, dir.x);
    
    // Angular streak pattern
    float angularPattern = 0.0;
    // Refined sharpness range: 40.0 (sharp) to 0.5 (very soft)
    // Using a more linear-ish feel for the slider
    float sharpness = mix(40.0, 0.5, pow(clamp(u_blur, 0.0, 1.0), 0.7));
    
    for (float i = 0.0; i < 16.0; i++) {
        if (i >= u_rays) break;
        float angle = i * 3.14159265 * 2.0 / u_rays;
        float diff = abs(mod(theta - angle + 3.14159265, 3.14159265 * 2.0) - 3.14159265);
        // Using a softer falloff profile for better blurring
        angularPattern += exp(-diff * sharpness);
    }
    
    // Proper normalization based on ray count to prevent saturation
    // But keep it bright enough to be visible
    angularPattern *= (2.0 / max(1.0, u_rays * 0.5));
    
    // Radial falloff: using a slightly softer falloff for long rays
    float radialFalloff = exp(-r * 4.0 / max(0.01, u_length));
    
    // Sample along streaks
    vec4 color = vec4(0.0);
    float totalWeight = 0.0;
    int samples = 24;
    
    for (int i = -samples; i <= samples; i++) {
        float t = float(i) / float(samples);
        vec2 sampleCoord = v_uv + dir * t * u_length;
        float weight = (1.0 - abs(t)) * angularPattern * radialFalloff;
        color += texture(u_tex, sampleCoord) * weight;
        totalWeight += weight;
    }
    
    if (totalWeight > 0.0) color /= totalWeight;
    
    vec4 original = texture(u_tex, v_uv);
    outColor = original + color * u_intensity * 0.5;
}
