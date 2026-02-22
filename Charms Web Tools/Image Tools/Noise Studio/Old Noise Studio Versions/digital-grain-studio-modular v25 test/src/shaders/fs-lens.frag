#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform float u_amount; // -1.0 to 1.0 (negative = barrel, positive = pincushion)
uniform float u_scale;  // Scaling factor to counteract zooming

void main() {
    // Convert UV to center-relative coordinates (-1.0 to 1.0)
    vec2 p = v_uv * 2.0 - 1.0;
    
    // Calculate distance from center (radius squared)
    float r2 = p.x * p.x + p.y * p.y;
    
    // Apply distortion algorithm
    // newRadius = radius * (1 + amount * radius^2)
    float f = 1.0 + r2 * u_amount;
    
    // Calculate new position and apply scaling
    vec2 distorted = p * f * u_scale;
    
    // Convert back from center-relative to standard 0.0-1.0 UV space
    vec2 uv = (distorted + 1.0) / 2.0;
    
    // Mask out areas that fall outside the image borders
    if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        // Transparent black for out-of-bounds
        outColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
        outColor = texture(u_tex, uv);
    }
}
