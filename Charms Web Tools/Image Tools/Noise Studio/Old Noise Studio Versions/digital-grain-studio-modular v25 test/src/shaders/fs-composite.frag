#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_base;
uniform sampler2D u_noise;
uniform sampler2D u_mask;
uniform int u_mode;
uniform float u_opacity;
uniform float u_str; 
uniform int u_nType; 
uniform float u_satStr;
uniform float u_satImp;
uniform int u_ignA; 
uniform float u_ignAstr;
uniform float u_skinProt;

float overlay(float b, float n) {
    return b < 0.5 ? (2.0 * b * n) : (1.0 - 2.0 * (1.0 - b) * (1.0 - n));
}

float getSkinMask(vec3 rgb) {
    float r = rgb.r * 255.0;
    float g = rgb.g * 255.0;
    float b = rgb.b * 255.0;
    float cb = 128.0 + ( -0.168736 * r - 0.331264 * g + 0.5 * b );
    float cr = 128.0 + ( 0.5 * r - 0.418688 * g - 0.081312 * b );
    float dist = length(vec2(cr - 153.0, cb - 102.0)) / 30.0;
    return 1.0 - smoothstep(0.8, 1.2, dist);
}

void main() {
    vec4 bc = texture(u_base, v_uv);
    vec4 nc = texture(u_noise, v_uv);
    vec4 mc = texture(u_mask, v_uv); 
    vec3 n = nc.rgb;
    vec3 res;
    vec3 base = bc.rgb;
    
    if (u_nType == 2) {
        float noiseVal = nc.r; 
        float centered = (noiseVal - 0.5) * 2.0;
        float delta = centered * (u_satStr * (1.0 + u_satImp/100.0));
        float lum = dot(base, vec3(0.2126, 0.7152, 0.0722));
        float effectStr = u_str/50.0;
        if (u_skinProt > 0.0) {
            float skin = getSkinMask(base);
            effectStr *= (1.0 - skin * (u_skinProt / 100.0));
        }
        vec3 satColor = mix(vec3(lum), base, 1.0 + delta * effectStr); 
        res = satColor;
    } else {
        vec3 noiseLayer = nc.rgb;
        if (u_mode == 0) { 
            res = mix(base, noiseLayer, u_opacity); 
        } else if (u_mode == 1) { 
            res.r = overlay(base.r, noiseLayer.r);
            res.g = overlay(base.g, noiseLayer.g);
            res.b = overlay(base.b, noiseLayer.b);
        } else if (u_mode == 2) { 
            res = 1.0 - (1.0 - base) * (1.0 - noiseLayer);
        } else if (u_mode == 3) { 
            res = base * noiseLayer;
        } else if (u_mode == 4) { 
            res = base + noiseLayer;
        } else if (u_mode == 5) { 
            res = abs(base - noiseLayer);
        }
        
        float maskVal = mc.r; 
        float alphaFactor = 1.0;
        if (u_ignA == 1) {
            alphaFactor = 1.0 - (u_ignAstr/100.0) * (1.0 - bc.a);
        }
        
        float finalOp = u_opacity * maskVal * alphaFactor * (u_str / 50.0); 
        
        if (u_skinProt > 0.0) {
            float skin = getSkinMask(base);
            finalOp *= (1.0 - skin * (u_skinProt / 100.0));
        }

        res = mix(base, res, clamp(finalOp, 0.0, 1.0));
    }

    outColor = vec4(clamp(res, 0.0, 1.0), bc.a);
}
