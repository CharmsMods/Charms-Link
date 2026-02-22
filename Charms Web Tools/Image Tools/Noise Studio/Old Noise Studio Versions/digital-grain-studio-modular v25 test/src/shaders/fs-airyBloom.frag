#version 300 es
    precision highp float;
    uniform sampler2D u_tex;
    uniform vec2 u_res;
    uniform float u_time;
    uniform float u_intensity;
    uniform float u_aperture;
    uniform float u_threshold;
    uniform float u_thresholdFade;
    uniform float u_cutoff;
    uniform sampler2D u_mask;
    uniform int u_useMask;
    in vec2 v_uv;
    out vec4 outColor;
    
    // J0 Bessel function approximation is handled in hankelBlur, 
    // but here we need J1 for Airy Disk.
    float besselJ1(float x) {
        float ax = abs(x);
        if (ax < 8.0) {
            float y = x * x;
            float ans1 = x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1
                + y * (-2972611.439 + y * (15704.48260 + y * (-30.16036606))))));
            float ans2 = 144725228442.0 + y * (2300535178.0 + y * (18583304.74
                + y * (99447.43394 + y * (376.9991397 + y * 1.0))));
            return ans1 / ans2;
        } else {
            float z = 8.0 / ax;
            float y = z * z;
            float xx = ax - 2.356194491;
            float ans1 = 1.0 + y * (0.183105e-2 + y * (-0.3516396496e-4
                + y * (0.2457520174e-5 + y * (-0.240337019e-6))));
            float ans2 = 0.04687499995 + y * (-0.2002690873e-3
                + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
            float ans = sqrt(0.636619772 / ax) * (cos(xx) * ans1 - z * sin(xx) * ans2);
            return (x > 0.0 ? ans : -ans);
        }
    }

    float airyPSF(float r, float aperture) {
        if (r < 0.001) return 1.0;
        float x = r * aperture * 3.14159265;
        float res = 2.0 * besselJ1(x) / x;
        return res * res;
    }
    
    void main() {
        vec2 texelSize = 1.0 / u_res;
        vec4 color = vec4(0.0);
        float totalWeight = 0.0;
        
        const float renderRadius = 15.0; // Fixed sampling radius for performance
        
        for (float x = -renderRadius; x <= renderRadius; x += 1.0) {
            for (float y = -renderRadius; y <= renderRadius; y += 1.0) {
                vec2 offset = vec2(x, y) * texelSize;
                float dist = length(vec2(x, y));
                if (dist > renderRadius) continue;
                
                float weight = airyPSF(dist / renderRadius, u_aperture);
                color += texture(u_tex, v_uv + offset) * weight;
                totalWeight += weight;
            }
        }
        
        color /= max(0.001, totalWeight);
        
        vec4 original = texture(u_tex, v_uv);
        float luminance = dot(original.rgb, vec3(0.2126, 0.7152, 0.0722));
        
        // Bandpass Filter based on brightness range
        float low = smoothstep(u_threshold, u_threshold + u_thresholdFade + 0.001, luminance);
        float high = 1.0 - smoothstep(u_cutoff - 0.1, u_cutoff, luminance);
        float contribution = low * high;

        // Apply masking
        if (u_useMask == 1) {
            float maskVal = texture(u_mask, v_uv).r;
            contribution *= maskVal;
        }

        outColor = mix(original, original + color * u_intensity, contribution);
    }
