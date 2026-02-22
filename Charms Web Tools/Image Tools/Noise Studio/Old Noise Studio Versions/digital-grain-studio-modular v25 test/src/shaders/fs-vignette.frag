#version 300 es
    precision highp float;
    out vec4 outColor;
    in vec2 v_uv;
    uniform sampler2D u_tex;
    uniform vec2 u_res;
    uniform float u_intensity;
    uniform float u_radius;
    uniform float u_softness;
    uniform vec3 u_color;

    void main() {
        vec4 col = texture(u_tex, v_uv);

        // Calculate distance from center (0.5, 0.5)
        // Adjust for aspect ratio so the vignette is circular
        vec2 center = vec2(0.5, 0.5);
        vec2 aspect = vec2(1.0, u_res.y / u_res.x);
        float dist = distance((v_uv - center) / aspect, vec2(0.0));

        // Smoothstep for gradual transition
        // u_radius is the inner bounds. outer bounds is u_radius + u_softness
        float v = smoothstep(u_radius, u_radius + u_softness, dist);

        // Blend the vignette color with the original pixel
        // v = 0 at center (keep original), v = 1 at edge (blend vignette color)
        vec3 finalColor = mix(col.rgb, u_color, v * u_intensity);

        outColor = vec4(finalColor, col.a);
    }
