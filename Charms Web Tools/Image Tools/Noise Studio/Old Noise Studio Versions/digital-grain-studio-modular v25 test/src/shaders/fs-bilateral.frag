#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform vec2 u_res;

// Controls
uniform int u_radius;        // 1-30
uniform float u_sigmaCol;    // 0.01 - 1.0
uniform float u_sigmaSpace;  // 0.5 - 15.0
uniform int u_kernel;        // 0=Gauss, 1=Box
uniform int u_edgeMode;      // 0=Luma, 1=RGB

float getDist(vec3 c1, vec3 c2) {
    if (u_edgeMode == 0) {
        float l1 = dot(c1, vec3(0.2126, 0.7152, 0.0722));
        float l2 = dot(c2, vec3(0.2126, 0.7152, 0.0722));
        return abs(l1 - l2);
    } else {
        return length(c1 - c2);
    }
}

void main() {
    vec4 centerCol = texture(u_tex, v_uv);
    vec3 sum = vec3(0.0);
    float weightSum = 0.0;
    
    // Separable optimization not easy for true bilateral without ping-pong
    // We will do a full kernel loop but skip somewhat to save perf if radius is high?
    // No, standard loop.
    
    int r = u_radius;
    float fs = u_sigmaSpace;
    float fc = u_sigmaCol;
    
    // Optimization: Stride sampling for large radii to maintain interactivity
    int step = (r > 15) ? 3 : ((r > 8) ? 2 : 1);
    
    for (int x = -r; x <= r; x += step) {
        for (int y = -r; y <= r; y += step) {
            vec2 offset = vec2(float(x), float(y));
            vec2 uv = v_uv + offset / u_res;
            
            vec3 samp = texture(u_tex, uv).rgb;
            
            float spaceDistSq = dot(offset, offset);
            float colorDist = getDist(centerCol.rgb, samp);
            
            float wSpace = 1.0;
            if (u_kernel == 0) wSpace = exp(-spaceDistSq / (2.0 * fs * fs));
            
            float wColor = exp(-(colorDist * colorDist) / (2.0 * fc * fc));
            
            float w = wSpace * wColor;
            
            sum += samp * w;
            weightSum += w;
        }
    }
    
    outColor = vec4(sum / weightSum, centerCol.a);
}
