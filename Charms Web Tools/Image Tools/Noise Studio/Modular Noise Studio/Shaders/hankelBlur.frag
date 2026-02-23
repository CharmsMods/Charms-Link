#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform sampler2D u_mask;
uniform vec2 u_res;
uniform float u_radius;
uniform float u_quality;
uniform float u_intensity;
uniform int u_useMask;
in vec2 v_uv;
out vec4 outColor;

// J0 Bessel function approximation
float besselJ0(float x) {
    float ax = abs(x);
    if (ax < 8.0) {
        float y = x * x;
        float ans1 = 57568490574.0 + y * (-13362590354.0 + y * (651619640.7
            + y * (-11214424.18 + y * (77392.33017 + y * (-184.9052456)))));
        float ans2 = 57568490411.0 + y * (1029532985.0 + y * (9494680.718
            + y * (59272.64853 + y * (267.8532712 + y * 1.0))));
        return ans1 / ans2;
    } else {
        float z = 8.0 / ax;
        float y = z * z;
        float xx = ax - 0.785398164;
        float ans1 = 1.0 + y * (-0.1098628627e-2 + y * (0.2734510407e-4
            + y * (-0.2073370639e-5 + y * 0.2093887211e-6)));
        float ans2 = -0.1562499995e-1 + y * (0.1430488765e-3
            + y * (-0.6911147651e-5 + y * (0.7621095161e-6 - y * 0.934935152e-7)));
        return sqrt(0.636619772 / ax) * (cos(xx) * ans1 - z * sin(xx) * ans2);
    }
}

void main() {
    vec2 texelSize = 1.0 / u_res;
    vec4 color = vec4(0.0);
    float totalWeight = 0.0;
    int samples = int(u_quality);
    
    // Circular convolution using quality for step counts
    // Nested loop: Radial distance then Angular orientation
    for (int i = 0; i < 32; i++) {
        if (i >= samples) break;
        for (int j = 0; j < 32; j++) {
            if (j >= samples) break;
            
            float r = (float(i) / float(samples)) * u_radius;
            float theta = (float(j) / float(samples)) * 6.283185307;
            
            vec2 offset = vec2(cos(theta), sin(theta)) * r * texelSize;
            float weight = besselJ0(r * 2.0); // Adjust frequency for desired look
            weight = abs(weight) + 0.01;      // Ensure non-zero weight for stability
            
            color += texture(u_tex, v_uv + offset) * weight;
            totalWeight += weight;
        }
    }
    
    vec4 blurred = color / max(0.001, totalWeight);
    vec4 original = texture(u_tex, v_uv);
    
    // Apply unified mask and global intensity
    float mask = 1.0;
    if (u_useMask == 1) {
        mask = texture(u_mask, v_uv).r;
    }
    outColor = mix(original, blurred, mask * u_intensity);
}
