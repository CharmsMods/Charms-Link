#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform sampler2D u_mask;
uniform int u_useMask;
uniform vec2 u_res;

// Controls
uniform int u_mode;          // 0=NLM, 1=Median, 2=Mean
uniform int u_searchRadius;  // 1-15
uniform int u_patchRadius;   // 1-5 (NLM only)
uniform float u_h;           // filter strength 0.01-2.0
uniform float u_strength;    // blend with original 0-1

// NLM: Compare patches to compute similarity weights
float patchDistance(vec2 p1, vec2 p2, int pRad) {
    float dist = 0.0;
    float count = 0.0;
    vec2 px = 1.0 / u_res;
    int step = (pRad >= 3) ? 2 : 1;
    for (int dx = -pRad; dx <= pRad; dx += step) {
        for (int dy = -pRad; dy <= pRad; dy += step) {
            vec2 off = vec2(float(dx), float(dy));
            vec3 c1 = texture(u_tex, p1 + off * px).rgb;
            vec3 c2 = texture(u_tex, p2 + off * px).rgb;
            vec3 d = c1 - c2;
            dist += dot(d, d);
            count += 1.0;
        }
    }
    return dist / count;
}

void main() {
    vec4 original = texture(u_tex, v_uv);
    vec2 px = 1.0 / u_res;
    vec3 result = vec3(0.0);

    if (u_mode == 0) {
        // --- Non-Local Means ---
        float totalWeight = 0.0;
        float h2 = u_h * u_h;
        
        int step = (u_searchRadius >= 10) ? 3 : ((u_searchRadius >= 5) ? 2 : 1);

        for (int sx = -u_searchRadius; sx <= u_searchRadius; sx += step) {
            for (int sy = -u_searchRadius; sy <= u_searchRadius; sy += step) {
                vec2 offset = vec2(float(sx), float(sy));
                vec2 neighborUV = v_uv + offset * px;

                float d = patchDistance(v_uv, neighborUV, u_patchRadius);
                float w = exp(-d / h2);

                result += texture(u_tex, neighborUV).rgb * w;
                totalWeight += w;
            }
        }
        result /= totalWeight;
    }
    else if (u_mode == 1) {
        // --- High-Quality 3x3 Median Filter ---
        vec3 v[9];
        v[0] = texture(u_tex, v_uv + vec2(-px.x, -px.y)).rgb;
        v[1] = texture(u_tex, v_uv + vec2( 0.0,  -px.y)).rgb;
        v[2] = texture(u_tex, v_uv + vec2( px.x, -px.y)).rgb;
        v[3] = texture(u_tex, v_uv + vec2(-px.x,  0.0)).rgb;
        v[4] = texture(u_tex, v_uv + vec2( 0.0,   0.0)).rgb;
        v[5] = texture(u_tex, v_uv + vec2( px.x,  0.0)).rgb;
        v[6] = texture(u_tex, v_uv + vec2(-px.x,  px.y)).rgb;
        v[7] = texture(u_tex, v_uv + vec2( 0.0,   px.y)).rgb;
        v[8] = texture(u_tex, v_uv + vec2( px.x,  px.y)).rgb;

        float l[9];
        for(int i=0; i<9; i++) l[i] = dot(v[i], vec3(0.2126, 0.7152, 0.0722));
        
        // Partial sort
        for(int i=0; i<5; i++) {
            for(int j=i+1; j<9; j++) {
                if(l[i] > l[j]) {
                    float tempL = l[i]; l[i] = l[j]; l[j] = tempL;
                    vec3 tempV = v[i]; v[i] = v[j]; v[j] = tempV;
                }
            }
        }
        result = v[4];
    }
    else {
        // --- Mean (Box) Filter ---
        float count = 0.0;
        for (int dx = -u_searchRadius; dx <= u_searchRadius; dx++) {
            for (int dy = -u_searchRadius; dy <= u_searchRadius; dy++) {
                vec2 uv = v_uv + vec2(float(dx), float(dy)) * px;
                result += texture(u_tex, uv).rgb;
                count += 1.0;
            }
        }
        result /= count;
    }

    // Blend with original based on strength
    result = mix(original.rgb, result, u_strength);

    // Apply mask if present
    if (u_useMask == 1) {
        float m = texture(u_mask, v_uv).r;
        result = mix(original.rgb, result, m);
    }

    outColor = vec4(result, original.a);
}
