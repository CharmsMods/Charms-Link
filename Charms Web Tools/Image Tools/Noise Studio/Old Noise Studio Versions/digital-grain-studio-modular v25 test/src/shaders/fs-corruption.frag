#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform int u_algorithm; // 0=jpeg blocks, 1=pixelation, 2=color bleed
uniform float u_resScale; // 1-100 (lower = more corruption)
uniform vec2 u_res;
uniform float u_iteration; // current iteration for variation

void main() {
    // Calculate block size based on resolution scale (inverted: lower scale = bigger blocks)
    float blockSize = max(2.0, (100.0 - u_resScale) / 5.0 + 1.0);
    
    vec4 col;
    
    if (u_algorithm == 0) {
        // JPEG-like block artifacts
        vec2 blockPos = floor(v_uv * u_res / blockSize) * blockSize / u_res;
        vec2 blockCenter = blockPos + (blockSize * 0.5) / u_res;
        
        // Sample from block center with some offset for artifact feel
        vec2 offset = (v_uv - blockPos) * u_res / blockSize;
        offset = floor(offset * 2.0) / 2.0 * blockSize / u_res;
        
        col = texture(u_tex, blockPos + offset);
        
        // Add slight color shifting at block edges
        vec2 edgeDist = abs(fract(v_uv * u_res / blockSize) - 0.5);
        float edge = smoothstep(0.3, 0.5, max(edgeDist.x, edgeDist.y));
        col.rgb = mix(col.rgb, col.rgb * 0.95, edge * 0.3);
        
    } else if (u_algorithm == 1) {
        // Pixelation - simple downscale/upscale
        vec2 pixelPos = floor(v_uv * u_res / blockSize) * blockSize / u_res;
        col = texture(u_tex, pixelPos + (blockSize * 0.5) / u_res);
        
    } else {
        // Color bleed - horizontal color smearing
        float bleedAmount = blockSize / u_res.x;
        vec4 left = texture(u_tex, v_uv - vec2(bleedAmount, 0.0));
        vec4 center = texture(u_tex, v_uv);
        vec4 right = texture(u_tex, v_uv + vec2(bleedAmount, 0.0));
        
        // Shift color channels
        col.r = mix(center.r, right.r, 0.3);
        col.g = center.g;
        col.b = mix(center.b, left.b, 0.3);
        col.a = center.a;
    }
    
    outColor = col;
}
