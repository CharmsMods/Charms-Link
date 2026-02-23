#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform vec2 u_res;

// Controls
uniform int u_method;       // 0=DCT Block, 1=Chroma Subsampling, 2=Wavelet
uniform float u_quality;    // 1-100 (lower = more compression)
uniform float u_blockSize;  // 2-32
uniform float u_blend;      // 0-1

// sRGB <-> Linear helpers
vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
vec3 toSRGB(vec3 c) { return pow(max(c, vec3(0.0)), vec3(1.0/2.2)); }

void main() {
    vec4 original = texture(u_tex, v_uv);
    vec3 result = original.rgb;
    vec2 px = 1.0 / u_res;

    // Quality maps: low quality = heavy artifacts
    float qNorm = u_quality / 100.0;     // 0.01 - 1.0
    float qInv  = 1.0 - qNorm;           // inverse: high = more degradation

    if (u_method == 0) {
        // --- DCT Block Quantization ---
        float bs = max(2.0, u_blockSize);

        vec2 blockCoord = floor(v_uv * u_res / bs);
        vec2 blockUV    = blockCoord * bs / u_res;
        vec2 blockCenter = blockUV + (bs * 0.5) * px;

        vec3 dcColor = texture(u_tex, blockCenter).rgb;
        vec3 acColor = original.rgb;

        float quantStrength = qInv * qInv;

        float levels = mix(256.0, max(4.0, 8.0 * qNorm), quantStrength);
        vec3 quantized = floor(acColor * levels + 0.5) / levels;

        result = mix(quantized, dcColor, quantStrength * 0.6);

        vec2 blockFract = fract(v_uv * u_res / bs);
        vec2 edgeDist = abs(blockFract - 0.5);
        float edgeFactor = smoothstep(0.35, 0.5, max(edgeDist.x, edgeDist.y));
        vec3 ringing = result + (result - dcColor) * 0.15;
        result = mix(result, ringing, edgeFactor * quantStrength);

    } else if (u_method == 1) {
        // --- Chroma Subsampling (4:2:0) ---
        float chromaBlock = max(2.0, u_blockSize);

        float luma = dot(original.rgb, vec3(0.2126, 0.7152, 0.0722));

        vec2 chromaCoord = floor(v_uv * u_res / chromaBlock);
        vec2 chromaUV    = (chromaCoord + 0.5) * chromaBlock * px;
        vec3 chromaSample = texture(u_tex, chromaUV).rgb;
        float chromaLuma = dot(chromaSample, vec3(0.2126, 0.7152, 0.0722));

        vec3 chromaDiff = chromaSample - vec3(chromaLuma);
        vec3 reconstructed = vec3(luma) + chromaDiff;

        result = mix(original.rgb, reconstructed, qInv);

    } else {
        // --- Wavelet-Style Compression ---
        float blurRadius = qInv * u_blockSize * 0.5;

        vec3 blurred = vec3(0.0);
        float totalW = 0.0;
        for (float dx = -2.0; dx <= 2.0; dx += 1.0) {
            for (float dy = -2.0; dy <= 2.0; dy += 1.0) {
                vec2 offset = vec2(dx, dy) * px * blurRadius;
                float w = exp(-(dx*dx + dy*dy) / 8.0);
                blurred += texture(u_tex, v_uv + offset).rgb * w;
                totalW += w;
            }
        }
        blurred /= totalW;

        float bandLevels = mix(256.0, max(8.0, 32.0 * qNorm), qInv);
        vec3 banded = floor(blurred * bandLevels + 0.5) / bandLevels;

        result = mix(original.rgb, banded, qInv * 0.8);
    }

    // Final blend with original
    result = mix(original.rgb, result, u_blend);
    outColor = vec4(clamp(result, 0.0, 1.0), original.a);
}
