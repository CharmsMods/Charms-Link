(function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))o(i);new MutationObserver(i=>{for(const u of i)if(u.type==="childList")for(const l of u.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&o(l)}).observe(document,{childList:!0,subtree:!0});function n(i){const u={};return i.integrity&&(u.integrity=i.integrity),i.referrerPolicy&&(u.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?u.credentials="include":i.crossOrigin==="anonymous"?u.credentials="omit":u.credentials="same-origin",u}function o(i){if(i.ep)return;i.ep=!0;const u=n(i);fetch(i.href,u)}})();const oe="22.1",r={gl:null,canvas:null,programs:{},textures:{},fbos:{},pingPong:[null,null],thumbnailFBO:null,baseImage:null,imageFiles:[],currentImageIndex:0,isMultiImageMode:!1,isExporting:!1,playInterval:null,isPlaying:!1,lastFrameTime:0,realtimeFps:0,frameRenderCount:0,width:1,height:1,renderWidth:1,renderHeight:1,fboWidth:0,fboHeight:0,busy:!1,upscaleFactor:1,renderOrder:["noise","adjust","hdr","ca","blur","airyBloom","glareRays","hankelBlur","vignette","cell","halftone","bilateral","denoise","dither","palette","edge","corruption","analogVideo","lensDistort","heatwave","lightLeaks","compression"],activeLayerPreview:null,activeSection:"adjust",caCenter:{x:.5,y:.5},isDraggingPin:!1,layerTextures:{},layerVisibility:{noise:!0,adjust:!0,hdr:!0,ca:!0,blur:!0,airyBloom:!0,glareRays:!0,hankelBlur:!0,vignette:!0,cell:!0,halftone:!0,bilateral:!0,denoise:!0,dither:!0,palette:!0,edge:!0,corruption:!0,analogVideo:!0,lensDistort:!0,heatwave:!0,lightLeaks:!0,compression:!0},palette:[],lastExtractionImage:null,pinIdleTimer:null,isPreviewLocked:!1,clampPreview:!0,isZoomLocked:!1,lastMousePos:{x:0,y:0},isZooming:!1,isLensMode:!1,keepFolderStructure:!1,allFiles:[]},se={noise:{name:"Noise Group",color:"#fff"},adjust:{name:"Adjustments",color:"#fff"},hdr:{name:"HDR Emulation",color:"#fff"},ca:{name:"Chromatic Aberration",color:"#fff"},blur:{name:"Blur",color:"#fff"},cell:{name:"Cell Shading",color:"#fff"},halftone:{name:"Halftoning",color:"#fff"},bilateral:{name:"Bilateral Filter",color:"#fff"},denoise:{name:"Denoising",color:"#fff"},dither:{name:"Dithering",color:"#fff"},palette:{name:"Palette Reconstructor",color:"#fff"},edge:{name:"Edge Effects",color:"#fff"},corruption:{name:"Corruption",color:"#fff"},compression:{name:"Compression",color:"#fff"},airyBloom:{name:"Airy Disk Bloom",color:"#fff"},glareRays:{name:"Glare Rays",color:"#fff"},hankelBlur:{name:"Radial Hankel Blur",color:"#fff"},vignette:{name:"Vignette & Focus",color:"#fff"},analogVideo:{name:"Analog Video (VHS/CRT)",color:"#fff"},lensDistort:{name:"Lens Distortion (Optics)",color:"#fff"},heatwave:{name:"Heatwave & Ripples",color:"#fff"},lightLeaks:{name:"Light Leaks",color:"#fff"},shadows:{name:"Shadows Mask",color:"#fff"},highlights:{name:"Highlights Mask",color:"#fff"}},t={};function he(){document.querySelectorAll("input, select, button, canvas").forEach(a=>{a.id&&(t[a.id]=a)}),t.layerGrid=document.getElementById("layerGrid"),t.previewContainer=document.getElementById("previewContainer"),t.overlayOriginal=document.getElementById("overlayOriginal"),t.loading=document.getElementById("loading"),t.hoverZoomValue=document.getElementById("hoverZoomValue"),t.hoverZoomSlider=document.getElementById("hoverZoomSlider"),t.zoomResIndicator=document.getElementById("zoomResIndicator"),t.loadFolderBtn=document.getElementById("loadFolderBtn"),t.prevImageBtn=document.getElementById("prevImageBtn"),t.nextImageBtn=document.getElementById("nextImageBtn"),t.imageCounter=document.getElementById("imageCounter"),t.imageScrubber=document.getElementById("imageScrubber"),t.playBtn=document.getElementById("playBtn"),t.playFps=document.getElementById("playFps"),t.actualFps=document.getElementById("actualFps"),t["export-overlay"]=document.getElementById("export-overlay"),t["export-status"]=document.getElementById("export-status"),t.stopExportBtn=document.getElementById("stopExportBtn"),t.caPin=document.getElementById("caPin"),t.previewLock=document.getElementById("previewLock"),t.resetCenterBtn=document.getElementById("resetCenterBtn"),t.upscaleInput=document.getElementById("upscaleInput"),t.clampPreviewToggle=document.getElementById("clampPreviewToggle"),t.gpuMaxRes=document.getElementById("gpuMaxRes"),t.exportInfo=document.getElementById("exportInfo"),t.zoomLens=document.getElementById("zoomLens"),t.lensToggleBtn=document.getElementById("lensToggleBtn"),t.lensCanvas=document.getElementById("lensCanvas"),t.histogramCanvas=document.getElementById("histogramCanvas"),t.avgBrightnessVal=document.getElementById("avgBrightnessVal"),t.renderResVal=document.getElementById("renderResVal"),t.vectorscopeCanvas=document.getElementById("vectorscopeCanvas"),t.avgSaturationVal=document.getElementById("avgSaturationVal"),["blurEnable","blurAmount","blurType","blurColorExclude","blurTargetColor","blurColorTolerance","blurColorFade","blurLumaMask","blurShadowThreshold","blurShadowFade","blurHighlightThreshold","blurHighlightFade","ditherEnable","ditherBitDepth","ditherPaletteSize","ditherStrength","ditherScale","ditherType","ditherUsePalette","ditherGamma","ditherColorExclude","ditherExcludeColor","ditherColorTolerance","ditherColorFade","ditherLumaMask","ditherShadowThreshold","ditherShadowFade","ditherHighlightThreshold","ditherHighlightFade","paletteEnable","paletteBlend","paletteSmoothing","paletteSmoothingType","paletteList","extractCount","edgeEnable","edgeBlend","edgeMode","edgeStrength","edgeTolerance","edgeFgSat","edgeBgSat","edgeBloom","edgeSmooth","edgeSatControls","denoiseEnable","denoiseMode","denoiseSearchRadius","denoisePatchRadius","denoiseH","denoiseBlend","denoiseColorExclude","denoiseExcludeColor","denoiseColorTolerance","denoiseColorFade","denoiseLumaMask","denoiseShadowThreshold","denoiseShadowFade","denoiseHighlightThreshold","denoiseHighlightFade","denoiseInvertMask","airyBloomEnable","airyBloomIntensity","airyBloomAperture","airyBloomThreshold","airyBloomThresholdFade","airyBloomCutoff","airyBloomColorExclude","airyBloomExcludeColor","airyBloomColorTolerance","airyBloomColorFade","airyBloomLumaMask","airyBloomShadowThreshold","airyBloomShadowFade","airyBloomHighlightThreshold","airyBloomHighlightFade","airyBloomInvertMask","hankelBlurEnable","hankelBlurIntensity","hankelBlurRadius","hankelBlurQuality","hankelColorExclude","hankelExcludeColor","hankelColorTolerance","hankelColorFade","hankelLumaMask","hankelShadowThreshold","hankelShadowFade","hankelHighlightThreshold","hankelHighlightFade","hankelInvertMask","compressionEnable","compressionMethod","compressionQuality","compressionBlockSize","compressionBlend","compressionIterations"].forEach(a=>{const n=document.getElementById(a);n&&(t[a]=n)})}var xe=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform float u_bright;\r
uniform float u_cont;\r
uniform float u_sat;\r
uniform float u_hdrTol;\r
uniform float u_hdrAmt;\r
uniform float u_warmth;\r
uniform float u_sharp;\r
uniform float u_sharpThresh;\r
uniform vec2 u_step;

void main() {\r
    vec4 c = texture(u_tex, v_uv);\r
    vec3 rgb = c.rgb;

    
    float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));\r
    rgb = mix(vec3(lum), rgb, 1.0 + u_sat);

    
    rgb = (rgb - 0.5) * (1.0 + u_cont/100.0) + 0.5;

    
    rgb += u_bright/100.0;

    
    if (u_warmth != 0.0) {\r
        vec3 warmColor = vec3(1.0, 0.9, 0.8); \r
        vec3 coolColor = vec3(0.8, 0.9, 1.1); \r
        float t = clamp(u_warmth / 100.0, -1.0, 1.0);\r
        vec3 tint = mix(coolColor, warmColor, t * 0.5 + 0.5);\r
        float mask = smoothstep(0.0, 1.0, lum);\r
        rgb = mix(rgb, rgb * tint, abs(t) * mask);\r
    }

    
    if (u_sharp > 0.0) {\r
        vec3 blurred = (\r
            texture(u_tex, v_uv + vec2(-u_step.x, -u_step.y)).rgb * 0.0625 +\r
            texture(u_tex, v_uv + vec2( 0.0,      -u_step.y)).rgb * 0.125 +\r
            texture(u_tex, v_uv + vec2( u_step.x, -u_step.y)).rgb * 0.0625 +\r
            texture(u_tex, v_uv + vec2(-u_step.x,  0.0)).rgb * 0.125 +\r
            texture(u_tex, v_uv).rgb * 0.25 +\r
            texture(u_tex, v_uv + vec2( u_step.x,  0.0)).rgb * 0.125 +\r
            texture(u_tex, v_uv + vec2(-u_step.x,  u_step.y)).rgb * 0.0625 +\r
            texture(u_tex, v_uv + vec2( 0.0,       u_step.y)).rgb * 0.125 +\r
            texture(u_tex, v_uv + vec2( u_step.x,  u_step.y)).rgb * 0.0625\r
        );\r
        vec3 diff = rgb - blurred;\r
        
        
        
        float th = (u_sharpThresh / 100.0) * 0.1; \r
        float factor = smoothstep(th, th * 1.5 + 0.001, length(diff));\r
        rgb += diff * (u_sharp / 15.0) * factor;\r
    }

    
    float l = dot(rgb, vec3(0.2126, 0.7152, 0.0722));\r
    if (l < u_hdrTol && u_hdrTol > 0.0) {\r
        float f = (u_hdrAmt/100.0) * (1.0 - l/u_hdrTol);\r
        rgb *= (1.0 - f);\r
    }

    outColor = vec4(clamp(rgb, 0.0, 1.0), c.a);\r
}`,ge=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform sampler2D u_mask;\r
uniform int u_useMask;\r
uniform float u_bright;\r
uniform float u_cont;\r
uniform float u_sat;\r
uniform float u_hdrTol;\r
uniform float u_hdrAmt;\r
uniform float u_warmth;\r
uniform float u_sharp;\r
uniform float u_sharpThresh;\r
uniform vec2 u_step;

void main() {\r
    vec4 c = texture(u_tex, v_uv);\r
    vec3 original = c.rgb;\r
    vec3 rgb = c.rgb;

    
    float lum = dot(rgb, vec3(0.299,0.587,0.114));\r
    rgb = mix(vec3(lum), rgb, 1.0 + u_sat);

    
    rgb = (rgb - 0.5) * (1.0 + u_cont/100.0) + 0.5;

    
    rgb += u_bright/100.0;

    
    if (u_warmth != 0.0) {\r
        vec3 warmColor = vec3(1.0, 0.9, 0.8); \r
        vec3 coolColor = vec3(0.8, 0.9, 1.1); \r
        float t = clamp(u_warmth / 100.0, -1.0, 1.0);\r
        vec3 tint = mix(coolColor, warmColor, t * 0.5 + 0.5);\r
        float mask = smoothstep(0.0, 1.0, lum);\r
        rgb = mix(rgb, rgb * tint, abs(t) * mask);\r
    }

    
    if (u_sharp > 0.0) {\r
        vec4 sum = vec4(0.0);\r
        sum += texture(u_tex, v_uv + vec2(-u_step.x, -u_step.y));\r
        sum += texture(u_tex, v_uv + vec2( u_step.x, -u_step.y));\r
        sum += texture(u_tex, v_uv + vec2(-u_step.x,  u_step.y));\r
        sum += texture(u_tex, v_uv + vec2( u_step.x,  u_step.y));\r
        vec4 edge = c - (sum * 0.25);\r
        rgb += edge.rgb * (u_sharp / 10.0); \r
    }

    
    float l = dot(rgb, vec3(0.299,0.587,0.114));\r
    if (l < u_hdrTol && u_hdrTol > 0.0) {\r
        float f = (u_hdrAmt/100.0) * (1.0 - l/u_hdrTol);\r
        rgb *= (1.0 - f);\r
    }

    
    if (u_useMask == 1) {\r
        float maskVal = texture(u_mask, v_uv).r;\r
        rgb = mix(original, rgb, maskVal);\r
    }

    outColor = vec4(clamp(rgb, 0.0, 1.0), c.a);\r
}`,be=`#version 300 es\r
    precision highp float;\r
    uniform sampler2D u_tex;\r
    uniform vec2 u_res;\r
    uniform float u_time;\r
    uniform float u_intensity;\r
    uniform float u_aperture;\r
    uniform float u_threshold;\r
    uniform float u_thresholdFade;\r
    uniform float u_cutoff;\r
    uniform sampler2D u_mask;\r
    uniform int u_useMask;\r
    in vec2 v_uv;\r
    out vec4 outColor;\r
    \r
    
    
    float besselJ1(float x) {\r
        float ax = abs(x);\r
        if (ax < 8.0) {\r
            float y = x * x;\r
            float ans1 = x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1\r
                + y * (-2972611.439 + y * (15704.48260 + y * (-30.16036606))))));\r
            float ans2 = 144725228442.0 + y * (2300535178.0 + y * (18583304.74\r
                + y * (99447.43394 + y * (376.9991397 + y * 1.0))));\r
            return ans1 / ans2;\r
        } else {\r
            float z = 8.0 / ax;\r
            float y = z * z;\r
            float xx = ax - 2.356194491;\r
            float ans1 = 1.0 + y * (0.183105e-2 + y * (-0.3516396496e-4\r
                + y * (0.2457520174e-5 + y * (-0.240337019e-6))));\r
            float ans2 = 0.04687499995 + y * (-0.2002690873e-3\r
                + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));\r
            float ans = sqrt(0.636619772 / ax) * (cos(xx) * ans1 - z * sin(xx) * ans2);\r
            return (x > 0.0 ? ans : -ans);\r
        }\r
    }

    float airyPSF(float r, float aperture) {\r
        if (r < 0.001) return 1.0;\r
        float x = r * aperture * 3.14159265;\r
        float res = 2.0 * besselJ1(x) / x;\r
        return res * res;\r
    }\r
    \r
    void main() {\r
        vec2 texelSize = 1.0 / u_res;\r
        vec4 color = vec4(0.0);\r
        float totalWeight = 0.0;\r
        \r
        const float renderRadius = 15.0; 
        \r
        for (float x = -renderRadius; x <= renderRadius; x += 1.0) {\r
            for (float y = -renderRadius; y <= renderRadius; y += 1.0) {\r
                vec2 offset = vec2(x, y) * texelSize;\r
                float dist = length(vec2(x, y));\r
                if (dist > renderRadius) continue;\r
                \r
                float weight = airyPSF(dist / renderRadius, u_aperture);\r
                color += texture(u_tex, v_uv + offset) * weight;\r
                totalWeight += weight;\r
            }\r
        }\r
        \r
        color /= max(0.001, totalWeight);\r
        \r
        vec4 original = texture(u_tex, v_uv);\r
        float luminance = dot(original.rgb, vec3(0.2126, 0.7152, 0.0722));\r
        \r
        
        float low = smoothstep(u_threshold, u_threshold + u_thresholdFade + 0.001, luminance);\r
        float high = 1.0 - smoothstep(u_cutoff - 0.1, u_cutoff, luminance);\r
        float contribution = low * high;

        
        if (u_useMask == 1) {\r
            float maskVal = texture(u_mask, v_uv).r;\r
            contribution *= maskVal;\r
        }

        outColor = mix(original, original + color * u_intensity, contribution);\r
    }`,ye=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform float u_time;     
uniform float u_wobble;   
uniform float u_bleed;    
uniform float u_curve;    
uniform float u_noise;    

float rand(vec2 co){\r
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);\r
}

void main() {\r
    vec2 uv = v_uv;

    
    
    vec2 cc = uv - 0.5;\r
    
    float r2 = cc.x*cc.x + cc.y*cc.y;\r
    
    uv = cc * (1.0 + u_curve * r2 * 2.0) + 0.5;

    
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {\r
        outColor = vec4(0.0, 0.0, 0.0, 1.0);\r
        return;\r
    }

    
    
    float wobbleOffset = sin(uv.y * 20.0 + u_time * 5.0) * 0.005 + \r
                         sin(uv.y * 50.0 - u_time * 15.0) * 0.002;\r
    uv.x += wobbleOffset * u_wobble;

    
    
    float bleedOffset = 0.005 * u_bleed;\r
    float r = texture(u_tex, vec2(uv.x + bleedOffset, uv.y)).r;\r
    float g = texture(u_tex, uv).g;\r
    float b = texture(u_tex, vec2(uv.x - bleedOffset, uv.y)).b;\r
    vec3 col = vec3(r, g, b);

    
    
    float scanline = sin(uv.y * 800.0) * 0.04 * u_noise;\r
    float staticNoise = (rand(uv + mod(u_time, 10.0)) - 0.5) * 0.1 * u_noise;\r
    col += scanline + staticNoise;

    outColor = vec4(clamp(col, 0.0, 1.0), 1.0);\r
}`,Ee=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform vec2 u_res;

uniform int u_radius;        
uniform float u_sigmaCol;    
uniform float u_sigmaSpace;  
uniform int u_kernel;        
uniform int u_edgeMode;      

float getDist(vec3 c1, vec3 c2) {\r
    if (u_edgeMode == 0) {\r
        float l1 = dot(c1, vec3(0.2126, 0.7152, 0.0722));\r
        float l2 = dot(c2, vec3(0.2126, 0.7152, 0.0722));\r
        return abs(l1 - l2);\r
    } else {\r
        return length(c1 - c2);\r
    }\r
}

void main() {\r
    vec4 centerCol = texture(u_tex, v_uv);\r
    vec3 sum = vec3(0.0);\r
    float weightSum = 0.0;\r
    \r
    
    
    
    \r
    int r = u_radius;\r
    float fs = u_sigmaSpace;\r
    float fc = u_sigmaCol;\r
    \r
    
    int step = (r > 15) ? 3 : ((r > 8) ? 2 : 1);\r
    \r
    for (int x = -r; x <= r; x += step) {\r
        for (int y = -r; y <= r; y += step) {\r
            vec2 offset = vec2(float(x), float(y));\r
            vec2 uv = v_uv + offset / u_res;\r
            \r
            vec3 samp = texture(u_tex, uv).rgb;\r
            \r
            float spaceDistSq = dot(offset, offset);\r
            float colorDist = getDist(centerCol.rgb, samp);\r
            \r
            float wSpace = 1.0;\r
            if (u_kernel == 0) wSpace = exp(-spaceDistSq / (2.0 * fs * fs));\r
            \r
            float wColor = exp(-(colorDist * colorDist) / (2.0 * fc * fc));\r
            \r
            float w = wSpace * wColor;\r
            \r
            sum += samp * w;\r
            weightSum += w;\r
        }\r
    }\r
    \r
    outColor = vec4(sum / weightSum, centerCol.a);\r
}`,Te=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform vec2 u_dir; \r
uniform float u_rad;\r
uniform int u_blurType; 

void main() {\r
    vec4 color = vec4(0.0);\r
    float total = 0.0;\r
    \r
    if (u_blurType == 1) {\r
        
        for(float i = -15.0; i <= 16.0; i++) {\r
            vec4 s = texture(u_tex, v_uv + u_dir * i * u_rad * 0.5);\r
            color += s;\r
            total += 1.0;\r
        }\r
    } else if (u_blurType == 2) {\r
        
        for(float i = -15.0; i <= 16.0; i++) {\r
            float weight = 1.0 - abs(i) / 16.0;\r
            vec4 s = texture(u_tex, v_uv + u_dir * i * u_rad * 1.0);\r
            color += s * weight;\r
            total += weight;\r
        }\r
    } else {\r
        
        for(float i = -15.0; i <= 16.0; i++) {\r
            float weight = exp(-(i*i) / (2.0 * 5.0 * 5.0)); 
            vec4 s = texture(u_tex, v_uv + u_dir * i * u_rad * 0.5);\r
            color += s * weight;\r
            total += weight;\r
        }\r
    }\r
    outColor = color / total;\r
}`,Le=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform vec2 u_res;

uniform int u_levels;         
uniform float u_bias;         
uniform float u_gamma;        
uniform int u_quantMode;      
uniform int u_bandMap;        
uniform int u_edgeMethod;     
uniform float u_edgeStr;      
uniform float u_edgeThick;    
uniform int u_colorPreserve;  
uniform int u_edgeEnable;     

vec3 rgb2hsv(vec3 c) {\r
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);\r
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));\r
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));\r
    float d = q.x - min(q.w, q.y);\r
    float e = 1.0e-10;\r
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);\r
}

vec3 hsv2rgb(vec3 c) {\r
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);\r
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);\r
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);\r
}

float getLuma(vec3 c) {\r
    return dot(c, vec3(0.2126, 0.7152, 0.0722));\r
}

float quantize(float val, int levels, float bias, float gamma) {\r
    
    val = clamp(val + bias, 0.0, 1.0);\r
    \r
    
    val = pow(val, gamma);\r
    \r
    
    float fLevels = float(levels);\r
    float q = floor(val * fLevels) / (fLevels - 1.0);\r
    \r
    
    if (u_bandMap == 1) { 
        q = smoothstep(0.0, 1.0, q);\r
    } else if (u_bandMap == 2) { 
        q = floor(val * fLevels) / fLevels; \r
    }\r
    \r
    return q;\r
}

float sobel(vec2 uv) {\r
    vec2 px = vec2(u_edgeThick, u_edgeThick) / u_res;\r
    float l00 = getLuma(texture(u_tex, uv + vec2(-px.x, -px.y)).rgb);\r
    float l10 = getLuma(texture(u_tex, uv + vec2(0.0, -px.y)).rgb);\r
    float l20 = getLuma(texture(u_tex, uv + vec2(px.x, -px.y)).rgb);\r
    float l01 = getLuma(texture(u_tex, uv + vec2(-px.x, 0.0)).rgb);\r
    float l21 = getLuma(texture(u_tex, uv + vec2(px.x, 0.0)).rgb);\r
    float l02 = getLuma(texture(u_tex, uv + vec2(-px.x, px.y)).rgb);\r
    float l12 = getLuma(texture(u_tex, uv + vec2(0.0, px.y)).rgb);\r
    float l22 = getLuma(texture(u_tex, uv + vec2(px.x, px.y)).rgb);\r
    \r
    float gx = l00 + 2.0*l01 + l02 - (l20 + 2.0*l21 + l22);\r
    float gy = l00 + 2.0*l10 + l20 - (l02 + 2.0*l12 + l22);\r
    \r
    return sqrt(gx*gx + gy*gy);\r
}

float laplacian(vec2 uv) {\r
    vec2 px = vec2(u_edgeThick, u_edgeThick) / u_res;\r
    float l01 = getLuma(texture(u_tex, uv + vec2(-px.x, 0.0)).rgb);\r
    float l21 = getLuma(texture(u_tex, uv + vec2(px.x, 0.0)).rgb);\r
    float l10 = getLuma(texture(u_tex, uv + vec2(0.0, -px.y)).rgb);\r
    float l12 = getLuma(texture(u_tex, uv + vec2(0.0, px.y)).rgb);\r
    float l11 = getLuma(texture(u_tex, uv).rgb); 
    \r
    return abs(l01 + l21 + l10 + l12 - 4.0 * l11) * 2.0;\r
}

void main() {\r
    vec4 base = texture(u_tex, v_uv);\r
    vec3 col = base.rgb;\r
    \r
    
    vec3 res = col;\r
    if (u_quantMode == 0) { 
        float l = getLuma(col);\r
        float q = quantize(l, u_levels, u_bias, u_gamma);\r
        if (u_colorPreserve == 1) {\r
            
            vec3 hsv = rgb2hsv(col);\r
            hsv.z = q;\r
            res = hsv2rgb(hsv);\r
        } else {\r
            res = vec3(q);\r
        }\r
    } else if (u_quantMode == 1) { 
        res.r = quantize(col.r, u_levels, u_bias, u_gamma);\r
        res.g = quantize(col.g, u_levels, u_bias, u_gamma);\r
        res.b = quantize(col.b, u_levels, u_bias, u_gamma);\r
    } else { 
        vec3 hsv = rgb2hsv(col);\r
        hsv.z = quantize(hsv.z, u_levels, u_bias, u_gamma);\r
        res = hsv2rgb(hsv);\r
    }\r
    \r
    
    if (u_edgeEnable == 1 && u_edgeMethod > 0) {\r
        float edge = 0.0;\r
        if (u_edgeMethod == 1) edge = sobel(v_uv);\r
        else if (u_edgeMethod == 2) edge = laplacian(v_uv);\r
        \r
        edge = smoothstep(0.1, 1.0, edge * 2.0); 
        res = mix(res, vec3(0.0), edge * u_edgeStr);\r
    }\r
    \r
    outColor = vec4(res, base.a);\r
}`,Re=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform float u_amt;\r
uniform float u_blur;\r
uniform vec2 u_center;\r
uniform float u_radius;\r
uniform float u_falloff;

uniform float u_zoomBlur;\r
uniform int u_falloffToBlur;

void main() {\r
    if (u_amt <= 0.0 && u_blur <= 0.0 && u_zoomBlur <= 0.0) {\r
        outColor = texture(u_tex, v_uv);\r
        return;\r
    }\r
    \r
    vec2 dir = v_uv - u_center;\r
    float dist = length(dir);\r
    \r
    
    float clearMask = 0.0;\r
    if (u_radius > 0.0 || u_falloff > 0.0) {\r
        clearMask = 1.0 - smoothstep(u_radius, u_radius + u_falloff, dist);\r
    }\r
    \r
    float blurStr = u_blur;\r
    float zoomStr = u_zoomBlur;\r
    if (u_falloffToBlur == 1) {\r
        blurStr *= (1.0 - clearMask);\r
        zoomStr *= (1.0 - clearMask);\r
    }

    
    float str = dist * dist * (u_amt / 1000.0); \r
    str *= (1.0 - clearMask); \r
    \r
    vec4 result = vec4(0.0);\r
    \r
    
    if (blurStr > 0.0 || zoomStr > 0.0) {\r
        float totalWeight = 0.0;\r
        for(float i = -2.0; i <= 2.0; i++) {\r
            float t = i * blurStr * 0.002; \r
            
            vec2 zoomOff = dir * (i * zoomStr * 0.02);\r
            float w = exp(-(i*i)/2.0); \r
            \r
            float r = texture(u_tex, v_uv - dir * str + vec2(t, -t) + zoomOff).r;\r
            float g = texture(u_tex, v_uv + vec2(t*0.5, t*0.5) + zoomOff * 0.5).g; \r
            float b = texture(u_tex, v_uv + dir * str + vec2(-t, t) + zoomOff * 1.5).b;\r
            \r
            result += vec4(r, g, b, 1.0) * w;\r
            totalWeight += w;\r
        }\r
        result /= totalWeight;\r
        result.a = texture(u_tex, v_uv).a;\r
    } else {\r
        float r = texture(u_tex, v_uv - dir * str).r;\r
        float g = texture(u_tex, v_uv).g;\r
        float b = texture(u_tex, v_uv + dir * str).b;\r
        float a = texture(u_tex, v_uv).a;\r
        result = vec4(r, g, b, a);\r
    }\r
    \r
    outColor = result;\r
}`,Fe=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform vec3 u_targetColor;  
uniform float u_tolerance;   
uniform float u_fade;        

void main() {\r
    vec4 c = texture(u_tex, v_uv);\r
    float dist = length(c.rgb - u_targetColor);\r
    float low = u_tolerance - u_fade * 0.5;\r
    float high = u_tolerance + u_fade * 0.5;\r
    float mask = smoothstep(low, high, dist);\r
    
    outColor = vec4(mask, mask, mask, 1.0);\r
}`,Ue=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_base;\r
uniform sampler2D u_noise;\r
uniform sampler2D u_mask;\r
uniform int u_mode;\r
uniform float u_opacity;\r
uniform float u_str; \r
uniform int u_nType; \r
uniform float u_satStr;\r
uniform float u_satImp;\r
uniform int u_ignA; \r
uniform float u_ignAstr;\r
uniform float u_skinProt;

float overlay(float b, float n) {\r
    return b < 0.5 ? (2.0 * b * n) : (1.0 - 2.0 * (1.0 - b) * (1.0 - n));\r
}

float getSkinMask(vec3 rgb) {\r
    float r = rgb.r * 255.0;\r
    float g = rgb.g * 255.0;\r
    float b = rgb.b * 255.0;\r
    float cb = 128.0 + ( -0.168736 * r - 0.331264 * g + 0.5 * b );\r
    float cr = 128.0 + ( 0.5 * r - 0.418688 * g - 0.081312 * b );\r
    float dist = length(vec2(cr - 153.0, cb - 102.0)) / 30.0;\r
    return 1.0 - smoothstep(0.8, 1.2, dist);\r
}

void main() {\r
    vec4 bc = texture(u_base, v_uv);\r
    vec4 nc = texture(u_noise, v_uv);\r
    vec4 mc = texture(u_mask, v_uv); \r
    vec3 n = nc.rgb;\r
    vec3 res;\r
    vec3 base = bc.rgb;\r
    \r
    if (u_nType == 2) {\r
        float noiseVal = nc.r; \r
        float centered = (noiseVal - 0.5) * 2.0;\r
        float delta = centered * (u_satStr * (1.0 + u_satImp/100.0));\r
        float lum = dot(base, vec3(0.2126, 0.7152, 0.0722));\r
        float effectStr = u_str/50.0;\r
        if (u_skinProt > 0.0) {\r
            float skin = getSkinMask(base);\r
            effectStr *= (1.0 - skin * (u_skinProt / 100.0));\r
        }\r
        vec3 satColor = mix(vec3(lum), base, 1.0 + delta * effectStr); \r
        res = satColor;\r
    } else {\r
        vec3 noiseLayer = nc.rgb;\r
        if (u_mode == 0) { \r
            res = mix(base, noiseLayer, u_opacity); \r
        } else if (u_mode == 1) { \r
            res.r = overlay(base.r, noiseLayer.r);\r
            res.g = overlay(base.g, noiseLayer.g);\r
            res.b = overlay(base.b, noiseLayer.b);\r
        } else if (u_mode == 2) { \r
            res = 1.0 - (1.0 - base) * (1.0 - noiseLayer);\r
        } else if (u_mode == 3) { \r
            res = base * noiseLayer;\r
        } else if (u_mode == 4) { \r
            res = base + noiseLayer;\r
        } else if (u_mode == 5) { \r
            res = abs(base - noiseLayer);\r
        }\r
        \r
        float maskVal = mc.r; \r
        float alphaFactor = 1.0;\r
        if (u_ignA == 1) {\r
            alphaFactor = 1.0 - (u_ignAstr/100.0) * (1.0 - bc.a);\r
        }\r
        \r
        float finalOp = u_opacity * maskVal * alphaFactor * (u_str / 50.0); \r
        \r
        if (u_skinProt > 0.0) {\r
            float skin = getSkinMask(base);\r
            finalOp *= (1.0 - skin * (u_skinProt / 100.0));\r
        }

        res = mix(base, res, clamp(finalOp, 0.0, 1.0));\r
    }

    outColor = vec4(clamp(res, 0.0, 1.0), bc.a);\r
}`,we=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform vec2 u_res;

uniform int u_method;       
uniform float u_quality;    
uniform float u_blockSize;  
uniform float u_blend;      

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }\r
vec3 toSRGB(vec3 c) { return pow(max(c, vec3(0.0)), vec3(1.0/2.2)); }

void main() {\r
    vec4 original = texture(u_tex, v_uv);\r
    vec3 result = original.rgb;\r
    vec2 px = 1.0 / u_res;

    
    float qNorm = u_quality / 100.0;     
    float qInv  = 1.0 - qNorm;           

    if (u_method == 0) {\r
        
        
        float bs = max(2.0, u_blockSize);

        
        vec2 blockCoord = floor(v_uv * u_res / bs);\r
        vec2 blockUV    = blockCoord * bs / u_res;\r
        vec2 blockCenter = blockUV + (bs * 0.5) * px;

        
        vec3 dcColor = texture(u_tex, blockCenter).rgb;

        
        vec3 acColor = original.rgb;

        
        float quantStrength = qInv * qInv;  

        
        float levels = mix(256.0, max(4.0, 8.0 * qNorm), quantStrength);\r
        vec3 quantized = floor(acColor * levels + 0.5) / levels;

        
        result = mix(quantized, dcColor, quantStrength * 0.6);

        
        vec2 blockFract = fract(v_uv * u_res / bs);\r
        vec2 edgeDist = abs(blockFract - 0.5);\r
        float edgeFactor = smoothstep(0.35, 0.5, max(edgeDist.x, edgeDist.y));\r
        
        vec3 ringing = result + (result - dcColor) * 0.15;\r
        result = mix(result, ringing, edgeFactor * quantStrength);

    } else if (u_method == 1) {\r
        
        
        float chromaBlock = max(2.0, u_blockSize);

        
        float luma = dot(original.rgb, vec3(0.2126, 0.7152, 0.0722));

        
        vec2 chromaCoord = floor(v_uv * u_res / chromaBlock);\r
        vec2 chromaUV    = (chromaCoord + 0.5) * chromaBlock * px;\r
        vec3 chromaSample = texture(u_tex, chromaUV).rgb;\r
        float chromaLuma = dot(chromaSample, vec3(0.2126, 0.7152, 0.0722));

        
        vec3 chromaDiff = chromaSample - vec3(chromaLuma);\r
        vec3 reconstructed = vec3(luma) + chromaDiff;

        
        result = mix(original.rgb, reconstructed, qInv);

    } else {\r
        
        
        

        
        float blurRadius = qInv * u_blockSize * 0.5;

        
        vec3 blurred = vec3(0.0);\r
        float totalW = 0.0;\r
        for (float dx = -2.0; dx <= 2.0; dx += 1.0) {\r
            for (float dy = -2.0; dy <= 2.0; dy += 1.0) {\r
                vec2 offset = vec2(dx, dy) * px * blurRadius;\r
                float w = exp(-(dx*dx + dy*dy) / 8.0);\r
                blurred += texture(u_tex, v_uv + offset).rgb * w;\r
                totalW += w;\r
            }\r
        }\r
        blurred /= totalW;

        
        float bandLevels = mix(256.0, max(8.0, 32.0 * qNorm), qInv);\r
        vec3 banded = floor(blurred * bandLevels + 0.5) / bandLevels;

        
        result = mix(original.rgb, banded, qInv * 0.8);\r
    }

    
    result = mix(original.rgb, result, u_blend);\r
    outColor = vec4(clamp(result, 0.0, 1.0), original.a);\r
}`,ke=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform int u_channel; 

void main() {\r
    vec4 c = texture(u_tex, v_uv);\r
    if (u_channel == 1) outColor = vec4(c.rrr, 1.0);\r
    else if (u_channel == 2) outColor = vec4(c.ggg, 1.0);\r
    else if (u_channel == 3) outColor = vec4(c.bbb, 1.0);\r
    else outColor = c;\r
}`,Ie=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform int u_algorithm; 
uniform float u_resScale; 
uniform vec2 u_res;\r
uniform float u_iteration; 

void main() {\r
    
    float blockSize = max(2.0, (100.0 - u_resScale) / 5.0 + 1.0);\r
    \r
    vec4 col;\r
    \r
    if (u_algorithm == 0) {\r
        
        vec2 blockPos = floor(v_uv * u_res / blockSize) * blockSize / u_res;\r
        vec2 blockCenter = blockPos + (blockSize * 0.5) / u_res;\r
        \r
        
        vec2 offset = (v_uv - blockPos) * u_res / blockSize;\r
        offset = floor(offset * 2.0) / 2.0 * blockSize / u_res;\r
        \r
        col = texture(u_tex, blockPos + offset);\r
        \r
        
        vec2 edgeDist = abs(fract(v_uv * u_res / blockSize) - 0.5);\r
        float edge = smoothstep(0.3, 0.5, max(edgeDist.x, edgeDist.y));\r
        col.rgb = mix(col.rgb, col.rgb * 0.95, edge * 0.3);\r
        \r
    } else if (u_algorithm == 1) {\r
        
        vec2 pixelPos = floor(v_uv * u_res / blockSize) * blockSize / u_res;\r
        col = texture(u_tex, pixelPos + (blockSize * 0.5) / u_res);\r
        \r
    } else {\r
        
        float bleedAmount = blockSize / u_res.x;\r
        vec4 left = texture(u_tex, v_uv - vec2(bleedAmount, 0.0));\r
        vec4 center = texture(u_tex, v_uv);\r
        vec4 right = texture(u_tex, v_uv + vec2(bleedAmount, 0.0));\r
        \r
        
        col.r = mix(center.r, right.r, 0.3);\r
        col.g = center.g;\r
        col.b = mix(center.b, left.b, 0.3);\r
        col.a = center.a;\r
    }\r
    \r
    outColor = col;\r
}`,Be=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform sampler2D u_mask;\r
uniform int u_useMask;\r
uniform vec2 u_res;

uniform int u_mode;          
uniform int u_searchRadius;  
uniform int u_patchRadius;   
uniform float u_h;           
uniform float u_strength;    

float patchDistance(vec2 p1, vec2 p2, int pRad) {\r
    float dist = 0.0;\r
    float count = 0.0;\r
    vec2 px = 1.0 / u_res;\r
    
    int step = (pRad >= 3) ? 2 : 1;\r
    for (int dx = -pRad; dx <= pRad; dx += step) {\r
        for (int dy = -pRad; dy <= pRad; dy += step) {\r
            vec2 off = vec2(float(dx), float(dy));\r
            vec3 c1 = texture(u_tex, p1 + off * px).rgb;\r
            vec3 c2 = texture(u_tex, p2 + off * px).rgb;\r
            vec3 d = c1 - c2;\r
            dist += dot(d, d);\r
            count += 1.0;\r
        }\r
    }\r
    return dist / count;\r
}

void main() {\r
    vec4 original = texture(u_tex, v_uv);\r
    vec2 px = 1.0 / u_res;\r
    vec3 result = vec3(0.0);

    if (u_mode == 0) {\r
        
        float totalWeight = 0.0;\r
        float h2 = u_h * u_h;\r
        \r
        
        int step = (u_searchRadius >= 10) ? 3 : ((u_searchRadius >= 5) ? 2 : 1);

        for (int sx = -u_searchRadius; sx <= u_searchRadius; sx += step) {\r
            for (int sy = -u_searchRadius; sy <= u_searchRadius; sy += step) {\r
                vec2 offset = vec2(float(sx), float(sy));\r
                vec2 neighborUV = v_uv + offset * px;

                float d = patchDistance(v_uv, neighborUV, u_patchRadius);\r
                float w = exp(-d / h2);

                result += texture(u_tex, neighborUV).rgb * w;\r
                totalWeight += w;\r
            }\r
        }\r
        result /= totalWeight;\r
    }\r
    else if (u_mode == 1) {\r
        
        
        vec3 v[9];\r
        v[0] = texture(u_tex, v_uv + vec2(-px.x, -px.y)).rgb;\r
        v[1] = texture(u_tex, v_uv + vec2( 0.0,  -px.y)).rgb;\r
        v[2] = texture(u_tex, v_uv + vec2( px.x, -px.y)).rgb;\r
        v[3] = texture(u_tex, v_uv + vec2(-px.x,  0.0)).rgb;\r
        v[4] = texture(u_tex, v_uv + vec2( 0.0,   0.0)).rgb;\r
        v[5] = texture(u_tex, v_uv + vec2( px.x,  0.0)).rgb;\r
        v[6] = texture(u_tex, v_uv + vec2(-px.x,  px.y)).rgb;\r
        v[7] = texture(u_tex, v_uv + vec2( 0.0,   px.y)).rgb;\r
        v[8] = texture(u_tex, v_uv + vec2( px.x,  px.y)).rgb;

        float l[9];\r
        for(int i=0; i<9; i++) l[i] = dot(v[i], vec3(0.2126, 0.7152, 0.0722));\r
        \r
        
        for(int i=0; i<5; i++) {\r
            for(int j=i+1; j<9; j++) {\r
                if(l[i] > l[j]) {\r
                    float tempL = l[i]; l[i] = l[j]; l[j] = tempL;\r
                    vec3 tempV = v[i]; v[i] = v[j]; v[j] = tempV;\r
                }\r
            }\r
        }\r
        result = v[4];\r
    }\r
    else {\r
        
        float count = 0.0;\r
        for (int dx = -u_searchRadius; dx <= u_searchRadius; dx++) {\r
            for (int dy = -u_searchRadius; dy <= u_searchRadius; dy++) {\r
                vec2 uv = v_uv + vec2(float(dx), float(dy)) * px;\r
                result += texture(u_tex, uv).rgb;\r
                count += 1.0;\r
            }\r
        }\r
        result /= count;\r
    }

    
    result = mix(original.rgb, result, u_strength);

    
    if (u_useMask == 1) {\r
        float m = texture(u_mask, v_uv).r;\r
        result = mix(original.rgb, result, m);\r
    }

    outColor = vec4(result, original.a);\r
}`,Ce=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform int u_type; 
uniform float u_bitDepth;\r
uniform float u_paletteSize;\r
uniform float u_strength;\r
uniform float u_scale;\r
uniform vec2 u_res;\r
uniform float u_seed;\r
uniform int u_usePalette;\r
uniform int u_gamma;\r
uniform vec3 u_customPalette[256];

float bayer8x8(vec2 pos) {\r
    int x = int(mod(pos.x, 8.0));\r
    int y = int(mod(pos.y, 8.0));\r
    int index = x + y * 8;\r
    int pattern[64] = int[64](\r
         0, 32,  8, 40,  2, 34, 10, 42,\r
        48, 16, 56, 24, 50, 18, 58, 26,\r
        12, 44,  4, 36, 14, 46,  6, 38,\r
        60, 28, 52, 20, 62, 30, 54, 22,\r
         3, 35, 11, 43,  1, 33,  9, 41,\r
        51, 19, 59, 27, 49, 17, 57, 25,\r
        15, 47,  7, 39, 13, 45,  5, 37,\r
        63, 31, 55, 23, 61, 29, 53, 21\r
    );\r
    return float(pattern[index]) / 64.0;\r
}

float bayer4x4(vec2 pos) {\r
    int x = int(mod(pos.x, 4.0));\r
    int y = int(mod(pos.y, 4.0));\r
    int index = x + y * 4;\r
    int pattern[16] = int[16](\r
        0, 8, 2, 10,\r
        12, 4, 14, 6,\r
        3, 11, 1, 9,\r
        15, 7, 13, 5\r
    );\r
    return float(pattern[index]) / 16.0;\r
}

float bayer2x2(vec2 pos) {\r
    int x = int(mod(pos.x, 2.0));\r
    int y = int(mod(pos.y, 2.0));\r
    int index = x + y * 2;\r
    int pattern[4] = int[4](0, 2, 3, 1);\r
    return float(pattern[index]) / 4.0;\r
}

float hash12(vec2 p) {\r
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);\r
    p3 += dot(p3, p3.yzx + 33.33);\r
    return fract((p3.x + p3.y) * p3.z);\r
}

float ign(vec2 p) {\r
    vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);\r
    return fract(magic.z * fract(dot(p, magic.xy)));\r
}

void main() {\r
    vec4 col = texture(u_tex, v_uv);\r
    vec3 color = col.rgb;\r
    \r
    if (u_gamma == 1) {\r
        color = pow(color, vec3(2.2));\r
    }\r
    \r
    vec2 scaledPos = floor(v_uv * u_res / max(1.0, u_scale));\r
    \r
    float threshold;\r
    if (u_type == 0) threshold = bayer8x8(scaledPos) - 0.5;\r
    else if (u_type == 1) threshold = bayer4x4(scaledPos) - 0.5;\r
    else if (u_type == 2) threshold = bayer2x2(scaledPos) - 0.5;\r
    else if (u_type == 3) threshold = hash12(scaledPos + u_seed) - 0.5;\r
    else threshold = ign(scaledPos) - 0.5;\r
    \r
    float levels = pow(2.0, u_bitDepth);\r
    vec3 dithered = color + threshold * (u_strength) * (1.0 / levels);\r
    \r
    vec3 result;\r
    if (u_usePalette == 1 && u_paletteSize > 0.5) {\r
        float minDist = 1e10;\r
        result = u_customPalette[0];\r
        int size = int(u_paletteSize);\r
        for (int i = 0; i < 256; i++) {\r
            if (i >= size) break;\r
            float d = distance(dithered, u_customPalette[i]);\r
            if (d < minDist) {\r
                minDist = d;\r
                result = u_customPalette[i];\r
            }\r
        }\r
    } else {\r
        result = floor(dithered * levels + 0.5) / levels;\r
        result = floor(result * u_paletteSize + 0.5) / u_paletteSize;\r
    }\r
    \r
    if (u_gamma == 1) {\r
        result = pow(result, vec3(1.0/2.2));\r
    }\r
    \r
    outColor = vec4(clamp(result, 0.0, 1.0), col.a);\r
}`,Ae=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform vec2 u_res;\r
uniform int u_mode; 
uniform float u_strength;\r
uniform float u_tolerance;\r
uniform float u_bgSat;\r
uniform float u_fgSat;\r
uniform float u_bloom;\r
uniform float u_smooth;\r
uniform float u_blend;

float getLuma(vec3 c) {\r
    return dot(c, vec3(0.2126, 0.7152, 0.0722));\r
}

void main() {\r
    vec2 texel = 1.0 / u_res;\r
    \r
    
    float x = texel.x;\r
    float y = texel.y;\r
    \r
    float m00 = getLuma(texture(u_tex, v_uv + vec2(-x, -y)).rgb);\r
    float m01 = getLuma(texture(u_tex, v_uv + vec2( 0, -y)).rgb);\r
    float m02 = getLuma(texture(u_tex, v_uv + vec2( x, -y)).rgb);\r
    float m10 = getLuma(texture(u_tex, v_uv + vec2(-x,  0)).rgb);\r
    float m12 = getLuma(texture(u_tex, v_uv + vec2( x,  0)).rgb);\r
    float m20 = getLuma(texture(u_tex, v_uv + vec2(-x,  y)).rgb);\r
    float m21 = getLuma(texture(u_tex, v_uv + vec2( 0,  y)).rgb);\r
    float m22 = getLuma(texture(u_tex, v_uv + vec2( x,  y)).rgb);\r
    \r
    float gx = (m02 + 2.0*m12 + m22) - (m00 + 2.0*m10 + m20);\r
    float gy = (m00 + 2.0*m01 + m02) - (m20 + 2.0*m21 + m22);\r
    \r
    float edge = sqrt(gx*gx + gy*gy);\r
    \r
    
    edge = smoothstep(u_tolerance / 100.0, (u_tolerance + 10.0) / 100.0, edge) * (u_strength / 100.0);\r
    edge = clamp(edge, 0.0, 1.0);\r
    \r
    float spreadMask = edge;\r
    \r
    if (u_bloom > 0.0) {\r
        float accumE = 0.0;\r
        float radius = u_bloom;\r
        int taps = clamp(int(radius * 1.5), 16, 48);\r
        float tapLimit = float(taps);\r
        \r
        for(int i = 1; i <= 48; i++) {\r
            if (i > taps) break;\r
            float f = float(i);\r
            float r = sqrt(f / tapLimit) * radius;\r
            float theta = f * 2.39996323; 
            vec2 off = vec2(cos(theta), sin(theta)) * r * texel;\r
            \r
            
            float nL = getLuma(texture(u_tex, v_uv + off).rgb);\r
            float nLx = getLuma(texture(u_tex, v_uv + off + vec2(x, 0.0)).rgb);\r
            float nLy = getLuma(texture(u_tex, v_uv + off + vec2(0.0, y)).rgb);\r
            \r
            float ne = abs(nLx - nL) + abs(nLy - nL);\r
            
            ne = smoothstep(u_tolerance / 100.0, (u_tolerance + 10.0) / 100.0, ne * 4.0) * (u_strength / 100.0);\r
            \r
            
            float falloff = mix(1.0, 1.0 - (r / radius), clamp(u_smooth / 100.0, 0.0, 1.0));\r
            \r
            accumE += ne * max(falloff, 0.0);\r
        }\r
        \r
        
        float bloomE = clamp((accumE / sqrt(tapLimit)) * 1.6, 0.0, 1.0);\r
        \r
        spreadMask = max(edge, bloomE);\r
    }\r
    \r
    vec4 c = texture(u_tex, v_uv);\r
    vec3 res = c.rgb;\r
    \r
    if (u_mode == 0) {\r
        
        res = mix(c.rgb, vec3(1.0), spreadMask);\r
    } else {\r
        
        float lum = getLuma(c.rgb);\r
        vec3 bw = vec3(lum);\r
        \r
        
        vec3 bg = mix(bw, c.rgb, u_bgSat / 100.0);\r
        
        vec3 fg = mix(bw, c.rgb, u_fgSat / 100.0);\r
        \r
        res = mix(bg, fg, spreadMask);\r
    }\r
    \r
    outColor = vec4(mix(c.rgb, res, u_blend / 100.0), c.a);\r
}`,Se=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform vec2 u_res;

float hash(vec2 p) {\r
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);\r
}

void main() {\r
    vec4 c = texture(u_tex, v_uv);\r
    
    
    float r1 = hash(v_uv * u_res);\r
    float r2 = hash(v_uv * u_res + 1.234);\r
    float dither = (r1 + r2 - 1.0) / 255.0;\r
    \r
    
    vec3 linear = c.rgb + dither;\r
    vec3 srgb = pow(clamp(linear, 0.0, 1.0), vec3(1.0/2.2));\r
    \r
    outColor = vec4(srgb, c.a);\r
}`,Me=`#version 300 es\r
    precision highp float;\r
    uniform sampler2D u_tex;\r
    uniform vec2 u_res;\r
    uniform float u_intensity;\r
    uniform float u_rays;\r
    uniform float u_length;\r
    uniform float u_blur;\r
    in vec2 v_uv;\r
    out vec4 outColor;\r
    \r
    void main() {\r
        vec2 center = vec2(0.5);\r
        vec2 dir = v_uv - center;\r
        float r = length(dir);\r
        float theta = atan(dir.y, dir.x);\r
        \r
        
        float angularPattern = 0.0;\r
        
        
        float sharpness = mix(40.0, 0.5, pow(clamp(u_blur, 0.0, 1.0), 0.7));\r
        \r
        for (float i = 0.0; i < 16.0; i++) {\r
            if (i >= u_rays) break;\r
            float angle = i * 3.14159265 * 2.0 / u_rays;\r
            float diff = abs(mod(theta - angle + 3.14159265, 3.14159265 * 2.0) - 3.14159265);\r
            
            angularPattern += exp(-diff * sharpness);\r
        }\r
        \r
        
        
        angularPattern *= (2.0 / max(1.0, u_rays * 0.5));\r
        \r
        
        float radialFalloff = exp(-r * 4.0 / max(0.01, u_length));\r
        \r
        
        vec4 color = vec4(0.0);\r
        float totalWeight = 0.0;\r
        int samples = 24;\r
        \r
        for (int i = -samples; i <= samples; i++) {\r
            float t = float(i) / float(samples);\r
            vec2 sampleCoord = v_uv + dir * t * u_length;\r
            float weight = (1.0 - abs(t)) * angularPattern * radialFalloff;\r
            color += texture(u_tex, sampleCoord) * weight;\r
            totalWeight += weight;\r
        }\r
        \r
        if (totalWeight > 0.0) color /= totalWeight;\r
        \r
        vec4 original = texture(u_tex, v_uv);\r
        outColor = original + color * u_intensity * 0.5;\r
    }`,Pe=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform vec2 u_res;

uniform float u_size;           
uniform float u_intensity;      
uniform float u_sharpness;      
uniform int u_pattern;          
uniform int u_colorMode;        
uniform int u_sample;           
uniform int u_gray;             
uniform int u_lock;             
uniform int u_invert;           

float getPattern(vec2 uv, float angle) {\r
    float s = sin(angle), c = cos(angle);\r
    vec2 p = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y) * u_res / u_size; 
    vec2 grid = fract(p) - 0.5;\r
    \r
    float d = 0.0;\r
    if (u_pattern == 0) { 
        d = length(grid) * 2.0; 
    } else if (u_pattern == 1) { 
        d = abs(grid.y) * 2.0;\r
    } else if (u_pattern == 2) { 
        d = min(abs(grid.x), abs(grid.y)) * 2.0;\r
    } else { 
        d = (abs(grid.x) + abs(grid.y));\r
    }\r
    \r
    return d; 
}

void main() {\r
    float angle = 0.0; 
    if (u_sample == 2) angle = 0.785; 
    \r
    vec2 sampleUV = v_uv;\r
    if (u_lock == 0) {\r
        
        
    }\r
    \r
    vec4 col = texture(u_tex, v_uv);\r
    \r
    
    vec3 outRGB = vec3(0.0);\r
    \r
    if (u_colorMode == 0) { 
        float l = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));\r
        float pat = getPattern(v_uv, 0.785); 
        \r
        
        
        
        
        \r
        
        float thresh = 1.0 - l * u_intensity; 
        float softness = 1.0 - u_sharpness;\r
        float val = smoothstep(thresh - softness, thresh + softness, pat);\r
        \r
        if (u_invert == 1) val = 1.0 - val;\r
        outRGB = vec3(val);\r
        \r
    } else if (u_colorMode == 1) { 
        
        float pR = getPattern(v_uv, 0.26); 
        float pG = getPattern(v_uv, 1.30); 
        float pB = getPattern(v_uv, 0.0);  
        \r
        float soft = 1.0 - u_sharpness;\r
        \r
        float r = smoothstep((1.0 - col.r) - soft, (1.0 - col.r) + soft, pR);\r
        float g = smoothstep((1.0 - col.g) - soft, (1.0 - col.g) + soft, pG);\r
        float b = smoothstep((1.0 - col.b) - soft, (1.0 - col.b) + soft, pB);\r
        \r
        outRGB = vec3(r, g, b);\r
        if (u_invert == 1) outRGB = 1.0 - outRGB;\r
        \r
    } else { 
        
        vec3 cmy = 1.0 - col.rgb;\r
        float k = 0.0;\r
        if (u_colorMode == 3) { 
            k = min(min(cmy.x, cmy.y), cmy.z);\r
            cmy = (cmy - k) / (1.0 - k);\r
        }\r
        \r
        
        float pC = getPattern(v_uv, 0.26);\r
        float pM = getPattern(v_uv, 1.30);\r
        float pY = getPattern(v_uv, 0.0);\r
        float pK = getPattern(v_uv, 0.785);\r
        \r
        float soft = 1.0 - u_sharpness;\r
        \r
        
        
        
        
        
        
        \r
        
        float hC = 1.0 - smoothstep(cmy.x - soft, cmy.x + soft, pC);\r
        float hM = 1.0 - smoothstep(cmy.y - soft, cmy.y + soft, pM);\r
        float hY = 1.0 - smoothstep(cmy.z - soft, cmy.z + soft, pY);\r
        float hK = 1.0 - smoothstep(k - soft, k + soft, pK);\r
        \r
        
        
        vec3 resCMY = vec3(hC, hM, hY);\r
        if (u_colorMode == 3) resCMY += vec3(hK);\r
        \r
        outRGB = 1.0 - clamp(resCMY, 0.0, 1.0);\r
        if (u_invert == 1) outRGB = 1.0 - outRGB;\r
    }\r
    \r
    if (u_gray == 1) {\r
        float l = dot(outRGB, vec3(0.2126, 0.7152, 0.0722));\r
        outRGB = vec3(l);\r
    }\r
    \r
    outColor = vec4(outRGB, col.a);\r
}`,De=`#version 300 es\r
    precision highp float;\r
    uniform sampler2D u_tex;\r
    uniform sampler2D u_mask;\r
    uniform vec2 u_res;\r
    uniform float u_radius;\r
    uniform float u_quality;\r
    uniform float u_intensity;\r
    uniform int u_useMask;\r
    in vec2 v_uv;\r
    out vec4 outColor;\r
    \r
    
    float besselJ0(float x) {\r
        float ax = abs(x);\r
        if (ax < 8.0) {\r
            float y = x * x;\r
            float ans1 = 57568490574.0 + y * (-13362590354.0 + y * (651619640.7\r
                + y * (-11214424.18 + y * (77392.33017 + y * (-184.9052456)))));\r
            float ans2 = 57568490411.0 + y * (1029532985.0 + y * (9494680.718\r
                + y * (59272.64853 + y * (267.8532712 + y * 1.0))));\r
            return ans1 / ans2;\r
        } else {\r
            float z = 8.0 / ax;\r
            float y = z * z;\r
            float xx = ax - 0.785398164;\r
            float ans1 = 1.0 + y * (-0.1098628627e-2 + y * (0.2734510407e-4\r
                + y * (-0.2073370639e-5 + y * 0.2093887211e-6)));\r
            float ans2 = -0.1562499995e-1 + y * (0.1430488765e-3\r
                + y * (-0.6911147651e-5 + y * (0.7621095161e-6 - y * 0.934935152e-7)));\r
            return sqrt(0.636619772 / ax) * (cos(xx) * ans1 - z * sin(xx) * ans2);\r
        }\r
    }\r
    \r
    void main() {\r
        vec2 texelSize = 1.0 / u_res;\r
        vec4 color = vec4(0.0);\r
        float totalWeight = 0.0;\r
        int samples = int(u_quality);\r
        \r
        
        
        for (int i = 0; i < 32; i++) {\r
            if (i >= samples) break;\r
            for (int j = 0; j < 32; j++) {\r
                if (j >= samples) break;\r
                \r
                float r = (float(i) / float(samples)) * u_radius;\r
                float theta = (float(j) / float(samples)) * 6.283185307;\r
                \r
                vec2 offset = vec2(cos(theta), sin(theta)) * r * texelSize;\r
                float weight = besselJ0(r * 2.0); 
                weight = abs(weight) + 0.01;      
                \r
                color += texture(u_tex, v_uv + offset) * weight;\r
                totalWeight += weight;\r
            }\r
        }\r
        \r
        vec4 blurred = color / max(0.001, totalWeight);\r
        vec4 original = texture(u_tex, v_uv);\r
        \r
        
        float mask = 1.0;\r
        if (u_useMask == 1) {\r
            mask = texture(u_mask, v_uv).r;\r
        }\r
        outColor = mix(original, blurred, mask * u_intensity);\r
    }`,Xe=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform float u_time;     
uniform float u_intensity;
uniform float u_speed;    
uniform float u_scale;    
uniform int u_direction;  

void main() {\r
    vec2 uv = v_uv;\r
    vec2 offset = vec2(0.0);\r
    \r
    float t = u_time * u_speed;\r
    \r
    if (u_direction == 0) {\r
        
        
        offset.x = sin(uv.y * u_scale + t) * u_intensity;\r
        
        offset.x += cos(uv.y * u_scale * 2.5 - t * 1.5) * (u_intensity * 0.3);\r
    } \r
    else if (u_direction == 1) {\r
        
        
        offset.y = sin(uv.x * u_scale + t) * u_intensity;\r
        offset.y += cos(uv.x * u_scale * 2.5 - t * 1.5) * (u_intensity * 0.3);\r
    }\r
    else if (u_direction == 2) {\r
        
        vec2 center = vec2(0.5, 0.5);\r
        vec2 d = uv - center;\r
        float dist = length(d);\r
        \r
        
        float wave = sin(dist * u_scale - t) * u_intensity;\r
        
        
        
        \r
        
        vec2 dir = normalize(d);\r
        
        if (dist > 0.0001) {\r
            offset = dir * wave;\r
        }\r
    }\r
    \r
    
    vec2 final_uv = uv + offset;\r
    \r
    
    
    final_uv = clamp(final_uv, 0.0, 1.0);

    outColor = texture(u_tex, final_uv);\r
}`,Ne=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;

void main() {\r
    float mask = texture(u_tex, v_uv).r;\r
    float inv = 1.0 - mask;\r
    
    outColor = vec4(inv, inv, inv, 1.0);\r
}`,ze=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform float u_amount; 
uniform float u_scale;  

void main() {\r
    
    vec2 p = v_uv * 2.0 - 1.0;\r
    \r
    
    float r2 = p.x * p.x + p.y * p.y;\r
    \r
    
    
    float f = 1.0 + r2 * u_amount;\r
    \r
    
    vec2 distorted = p * f * u_scale;\r
    \r
    
    vec2 uv = (distorted + 1.0) / 2.0;\r
    \r
    
    if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {\r
        
        outColor = vec4(0.0, 0.0, 0.0, 1.0);\r
    } else {\r
        outColor = texture(u_tex, uv);\r
    }\r
}`,qe=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform float u_intensity;\r
uniform vec3 u_color1;\r
uniform vec3 u_color2;\r
uniform float u_time;

void main() {\r
    vec4 col = texture(u_tex, v_uv);\r
    \r
    
    
    float leak1 = smoothstep(0.4, 0.0, v_uv.x + sin(v_uv.y * 5.0 + u_time) * 0.1);\r
    \r
    
    float distSq = dot(v_uv - vec2(1.0, 1.0), v_uv - vec2(1.0, 1.0));\r
    float leak2 = smoothstep(0.8, 0.0, distSq + cos(v_uv.x * 3.0 - u_time * 0.5) * 0.2);\r
    \r
    
    vec3 resultLeak = (u_color1 * leak1) + (u_color2 * leak2);\r
    \r
    
    vec3 finalColor = col.rgb + (resultLeak * u_intensity);\r
    \r
    outColor = vec4(finalColor, col.a);\r
}`,Oe=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform int u_useS; \r
uniform int u_useH;\r
uniform float u_sth;\r
uniform float u_sfa;\r
uniform float u_hth;\r
uniform float u_hfa;

void main() {\r
    vec4 c = texture(u_tex, v_uv);\r
    float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));\r
    \r
    float sMask = 0.0;\r
    if (u_useS == 1) {\r
        float low = u_sth - u_sfa * 0.5;\r
        float high = u_sth + u_sfa * 0.5;\r
        sMask = 1.0 - smoothstep(low, high, l);\r
    }

    float hMask = 0.0;\r
    if (u_useH == 1) {\r
        float low = u_hth - u_hfa * 0.5;\r
        float high = u_hth + u_hfa * 0.5;\r
        hMask = smoothstep(low, high, l);\r
    }

    float combined = max(sMask, hMask);\r
    
    outColor = vec4(combined, sMask, hMask, 1.0);\r
}`,Ge=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform sampler2D u_mask;\r
uniform vec2 u_dir; \r
uniform float u_rad;\r
uniform int u_blurType; 

void main() {\r
    float maskVal = texture(u_mask, v_uv).r;\r
    vec4 original = texture(u_tex, v_uv);\r
    \r
    if (maskVal < 0.01) {\r
        outColor = original;\r
        return;\r
    }\r
    \r
    vec4 color = vec4(0.0);\r
    float total = 0.0;\r
    \r
    if (u_blurType == 1) {\r
        
        for(float i = -15.0; i <= 16.0; i++) {\r
            vec4 s = texture(u_tex, v_uv + u_dir * i * u_rad * 0.5);\r
            color += s;\r
            total += 1.0;\r
        }\r
    } else if (u_blurType == 2) {\r
        
        for(float i = -15.0; i <= 16.0; i++) {\r
            float weight = 1.0 - abs(i) / 16.0;\r
            vec4 s = texture(u_tex, v_uv + u_dir * i * u_rad * 1.0);\r
            color += s * weight;\r
            total += weight;\r
        }\r
    } else {\r
        
        for(float i = -15.0; i <= 16.0; i++) {\r
            float weight = exp(-(i*i) / (2.0 * 5.0 * 5.0)); \r
            vec4 s = texture(u_tex, v_uv + u_dir * i * u_rad * 0.5);\r
            color += s * weight;\r
            total += weight;\r
        }\r
    }\r
    \r
    vec4 blurred = color / total;\r
    outColor = mix(original, blurred, maskVal);\r
}`,We=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform sampler2D u_mask;\r
uniform int u_type; 
uniform float u_bitDepth;\r
uniform float u_paletteSize;\r
uniform float u_strength;\r
uniform float u_scale;\r
uniform vec2 u_res;\r
uniform float u_seed;\r
uniform int u_usePalette;\r
uniform int u_gamma;\r
uniform vec3 u_customPalette[256];

float bayer8x8(vec2 pos) {\r
    int x = int(mod(pos.x, 8.0));\r
    int y = int(mod(pos.y, 8.0));\r
    int index = x + y * 8;\r
    int pattern[64] = int[64](\r
         0, 32,  8, 40,  2, 34, 10, 42,\r
        48, 16, 56, 24, 50, 18, 58, 26,\r
        12, 44,  4, 36, 14, 46,  6, 38,\r
        60, 28, 52, 20, 62, 30, 54, 22,\r
         3, 35, 11, 43,  1, 33,  9, 41,\r
        51, 19, 59, 27, 49, 17, 57, 25,\r
        15, 47,  7, 39, 13, 45,  5, 37,\r
        63, 31, 55, 23, 61, 29, 53, 21\r
    );\r
    return float(pattern[index]) / 64.0;\r
}

float bayer4x4(vec2 pos) {\r
    int x = int(mod(pos.x, 4.0));\r
    int y = int(mod(pos.y, 4.0));\r
    int index = x + y * 4;\r
    int pattern[16] = int[16](\r
        0, 8, 2, 10,\r
        12, 4, 14, 6,\r
        3, 11, 1, 9,\r
        15, 7, 13, 5\r
    );\r
    return float(pattern[index]) / 16.0;\r
}

float bayer2x2(vec2 pos) {\r
    int x = int(mod(pos.x, 2.0));\r
    int y = int(mod(pos.y, 2.0));\r
    int index = x + y * 2;\r
    int pattern[4] = int[4](0, 2, 3, 1);\r
    return float(pattern[index]) / 4.0;\r
}

float hash12(vec2 p) {\r
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);\r
    p3 += dot(p3, p3.yzx + 33.33);\r
    return fract((p3.x + p3.y) * p3.z);\r
}

float ign(vec2 p) {\r
    vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);\r
    return fract(magic.z * fract(dot(p, magic.xy)));\r
}

void main() {\r
    vec4 col = texture(u_tex, v_uv);\r
    float maskVal = texture(u_mask, v_uv).r;\r
    \r
    if (maskVal < 0.001) {\r
        outColor = col;\r
        return;\r
    }\r
    \r
    vec3 color = col.rgb;\r
    if (u_gamma == 1) {\r
        color = pow(color, vec3(2.2));\r
    }\r
    \r
    vec2 scaledPos = floor(v_uv * u_res / max(1.0, u_scale));\r
    \r
    float threshold;\r
    if (u_type == 0) threshold = bayer8x8(scaledPos) - 0.5;\r
    else if (u_type == 1) threshold = bayer4x4(scaledPos) - 0.5;\r
    else if (u_type == 2) threshold = bayer2x2(scaledPos) - 0.5;\r
    else if (u_type == 3) threshold = hash12(scaledPos + u_seed) - 0.5;\r
    else threshold = ign(scaledPos) - 0.5;\r
    \r
    float levels = pow(2.0, u_bitDepth);\r
    vec3 dithered = color + threshold * (u_strength) * (1.0 / levels);\r
    \r
    vec3 quantized;\r
    if (u_usePalette == 1 && u_paletteSize > 0.5) {\r
        float minDist = 1e10;\r
        quantized = u_customPalette[0];\r
        int size = int(u_paletteSize);\r
        for (int i = 0; i < 256; i++) {\r
            if (i >= size) break;\r
            float d = distance(dithered, u_customPalette[i]);\r
            if (d < minDist) {\r
                minDist = d;\r
                quantized = u_customPalette[i];\r
            }\r
        }\r
    } else {\r
        quantized = floor(dithered * levels + 0.5) / levels;\r
        quantized = floor(quantized * u_paletteSize + 0.5) / u_paletteSize;\r
    }\r
    \r
    if (u_gamma == 1) {\r
        quantized = pow(quantized, vec3(1.0/2.2));\r
    }\r
    \r
    vec3 result = mix(col.rgb, quantized, maskVal);\r
    outColor = vec4(clamp(result, 0.0, 1.0), col.a);\r
}`,He=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform int u_type; \r
uniform float u_seed;\r
uniform vec2 u_res;\r
uniform float u_scale;\r
uniform vec2 u_origRes; \r
uniform float u_paramA;\r
uniform float u_paramB;\r
uniform float u_paramC;

float hash12(vec2 p) {\r
    vec3 p3  = fract(vec3(p.xyx) * .1031);\r
    p3 += dot(p3, p3.yzx + 33.33);\r
    return fract((p3.x + p3.y) * p3.z);\r
}

vec2 hash22(vec2 p) {\r
    vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));\r
    p3 += dot(p3, p3.yzx + 33.33);\r
    return fract((p3.xx + p3.yz) * p3.zy);\r
}

float IGN(vec2 p) {\r
    vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);\r
    return fract(magic.z * fract(dot(p, magic.xy)));\r
}

float getBlue(vec2 p) {\r
    float white = IGN(p);\r
    float low = (IGN(p + vec2(1.0, 0.0)) + IGN(p - vec2(1.0, 0.0)) + IGN(p + vec2(0.0, 1.0)) + IGN(p - vec2(0.0, 1.0))) * 0.25;\r
    return clamp(white - low + 0.5, 0.0, 1.0); \r
}

float perlin(vec2 p) {\r
    vec2 i = floor(p);\r
    vec2 f = fract(p);\r
    f = f * f * (3.0 - 2.0 * f);\r
    float a = hash12(i);\r
    float b = hash12(i + vec2(1.0, 0.0));\r
    float c = hash12(i + vec2(0.0, 1.0));\r
    float d = hash12(i + vec2(1.0, 1.0));\r
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);\r
}

float worley(vec2 p) {\r
    vec2 n = floor(p);\r
    vec2 f = fract(p);\r
    float d = 1.0;\r
    for(int y = -1; y <= 1; y++) {\r
        for(int x = -1; x <= 1; x++) {\r
            vec2 g = vec2(float(x), float(y));\r
            vec2 o = hash22(n + g);\r
            vec2 r = g + o - f;\r
            d = min(d, dot(r, r));\r
        }\r
    }\r
    return sqrt(d);\r
}

void main() {\r
    vec2 pos = v_uv * u_origRes; \r
    float s = max(1.0, u_scale);\r
    vec2 cell = floor(pos / s);\r
    \r
    vec3 n;\r
    if (u_type == 1) { 
        n = vec3(hash12(cell + u_seed));\r
    } else if (u_type == 0) { 
        n = vec3(hash12(cell + u_seed), hash12(cell + u_seed + 1.23), hash12(cell + u_seed + 2.45));\r
    } else if (u_type == 3) { 
        n = vec3(getBlue(cell + u_seed * 11.0));\r
    } else if (u_type == 4) { 
        n = vec3(getBlue(cell + u_seed * 11.0), getBlue(cell + u_seed * 17.0 + 1.23), getBlue(cell + u_seed * 23.0 + 2.45));\r
    } else if (u_type == 5) { 
        float octs = floor(u_paramA * 7.0) + 1.0; 
        float persistence = 0.5 + (u_paramC - 0.5) * 0.5;\r
        float noiseSum = 0.0;\r
        float amp = 1.0;\r
        float freq = 1.0 / (s * 10.0 + (u_paramB * 50.0));\r
        for(int i = 0; i < 8; i++) {\r
            if(float(i) >= octs) break;\r
            noiseSum += perlin(pos * freq + u_seed * 1.5) * amp;\r
            amp *= persistence;\r
            freq *= 2.0;\r
        }\r
        n = vec3(noiseSum);\r
    } else if (u_type == 6) { 
        float jitter = u_paramA;\r
        float density = 1.0 / (s * 5.0 + (u_paramB * 20.0));\r
        vec2 p = pos * density;\r
        vec2 n_cell = floor(p);\r
        vec2 f = fract(p);\r
        float d = 1.0;\r
        for(int y = -1; y <= 1; y++) {\r
            for(int x = -1; x <= 1; x++) {\r
                vec2 g = vec2(float(x), float(y));\r
                vec2 o = hash22(n_cell + g) * jitter;\r
                vec2 r = g + o - f;\r
                float dist = mix(abs(r.x) + abs(r.y), length(r), u_paramC); 
                d = min(d, dist);\r
            }\r
        }\r
        n = vec3(d);\r
    } else if (u_type == 7) { 
        float thick = mix(0.1, 0.9, u_paramA);\r
        float jitter = (hash12(vec2(u_seed)) - 0.5) * u_paramB * 5.0;\r
        float line = sin((pos.y + jitter) / s * 3.14159) * 0.5 + 0.5;\r
        float val = step(thick, line);\r
        n = vec3(mix(val, val * hash12(cell + u_seed), u_paramC));\r
    } else if (u_type == 8) { 
        float density = mix(0.8, 0.999, u_paramA);\r
        float h = hash12(cell + u_seed);\r
        float speck = smoothstep(density, density + mix(0.01, 0.1, u_paramB), h);\r
        float sizeVar = hash12(cell * 0.5 + u_seed);\r
        n = vec3(speck * mix(1.0, sizeVar, u_paramC));\r
    } else if (u_type == 9) { 
        float blockSize = s * (5.0 + u_paramA * 50.0);\r
        float block = floor(pos.y / blockSize);\r
        float shift = (hash12(vec2(block, u_seed)) - 0.5) * u_paramB * 100.0;\r
        float split = u_paramC * 10.0;\r
        n = vec3(\r
            hash12(floor((pos + vec2(shift - split, 0.0)) / s) + u_seed),\r
            hash12(floor((pos + vec2(shift, 0.0)) / s) + u_seed),\r
            hash12(floor((pos + vec2(shift + split, 0.0)) / s) + u_seed)\r
        );\r
    } else if (u_type == 10) { 
        float stretch = 0.01 + u_paramA * 0.5;\r
        float rot = u_paramB * 6.28;\r
        mat2 m = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));\r
        vec2 p = (m * pos) * vec2(stretch, 1.0) / s;\r
        float h = hash12(floor(p) + u_seed);\r
        n = vec3(mix(h, h * hash12(cell + u_seed), u_paramC));\r
    } else if (u_type == 11) { 
        float scale = 1.0 / (s * 10.0 + u_paramA * 40.0);\r
        vec2 p = pos * scale;\r
        vec2 n_cell = floor(p);\r
        vec2 f = fract(p);\r
        float d = 1.0;\r
        vec2 m_cell;\r
        for(int y = -1; y <= 1; y++) {\r
            for(int x = -1; x <= 1; x++) {\r
                vec2 g = vec2(float(x), float(y));\r
                vec2 o = hash22(n_cell + g) * u_paramB;\r
                vec2 r = g + o - f;\r
                float dist = dot(r, r);\r
                if (dist < d) { d = dist; m_cell = n_cell + g; }\r
            }\r
        }\r
        vec3 col = vec3(hash12(m_cell + u_seed), hash12(m_cell + u_seed + 1.1), hash12(m_cell + u_seed + 2.2));\r
        n = mix(col, vec3(sqrt(d)), u_paramC);\r
    } else if (u_type == 12) { 
        float dens = 1.0 / (s * (1.0 + u_paramA * 5.0));\r
        float angle = u_paramB * 1.57;\r
        mat2 m1 = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));\r
        mat2 m2 = mat2(cos(-angle), -sin(-angle), sin(-angle), cos(-angle));\r
        float l1 = step(0.8, sin((m1 * pos).x * dens) * 0.5 + 0.5);\r
        float l2 = step(0.8, sin((m2 * pos).x * dens) * 0.5 + 0.5);\r
        float hatch = max(l1, l2);\r
        n = vec3(mix(hatch, hatch * hash12(cell + u_seed), u_paramC));\r
    } else {\r
        n = vec3(hash12(cell + u_seed));\r
    }\r
    \r
    outColor = vec4(n, 1.0);\r
}`,je=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform sampler2D u_tex;\r
uniform vec3 u_palette[256];\r
uniform int u_paletteSize;\r
uniform float u_blend;\r
uniform float u_smoothing;\r
uniform int u_smoothingType;\r
uniform vec2 u_res;

void main() {\r
    vec4 c = texture(u_tex, v_uv);\r
    vec3 original = c.rgb;\r
    vec2 texel = 1.0 / u_res;\r
    \r
    if (u_smoothing > 0.0) {\r
        float sumW = 0.0;\r
        vec3 sumC = vec3(0.0);\r
        float r = u_smoothing / 10.0; 
        \r
        for(float i = -1.0; i <= 1.0; i++) {\r
            for(float j = -1.0; j <= 1.0; j++) {\r
                vec2 off = vec2(i, j) * texel * r;\r
                float weight = 1.0;\r
                \r
                if (u_smoothingType == 1) {\r
                    
                    float distSq = i*i + j*j;\r
                    weight = exp(-distSq / 1.0); 
                }\r
                \r
                sumC += texture(u_tex, v_uv + off).rgb * weight;\r
                sumW += weight;\r
            }\r
        }\r
        original = sumC / sumW;\r
    }\r
    \r
    if (u_paletteSize == 0) {\r
        outColor = c;\r
        return;\r
    }\r
    \r
    float minDist = 1e10;\r
    vec3 bestColor = u_palette[0];\r
    \r
    for (int i = 0; i < u_paletteSize; i++) {\r
        float d = distance(original, u_palette[i]);\r
        if (d < minDist) {\r
            minDist = d;\r
            bestColor = u_palette[i];\r
        }\r
    }\r
    \r
    vec3 res = mix(original, bestColor, u_blend);\r
    outColor = vec4(clamp(res, 0.0, 1.0), c.a);\r
}`,Ve=`#version 300 es\r
precision highp float;\r
in vec2 v_uv;\r
out vec4 outColor;\r
uniform vec2 u_res;\r
uniform vec2 u_center;\r
uniform float u_radius;\r
uniform float u_falloff;

void main() {\r
    float dist = length(v_uv - u_center);\r
    float mask = 1.0 - smoothstep(u_radius, u_radius + u_falloff, dist);\r
    outColor = vec4(vec3(mask), 1.0);\r
}`,$e=`#version 300 es\r
    precision highp float;\r
    out vec4 outColor;\r
    in vec2 v_uv;\r
    uniform sampler2D u_tex;\r
    uniform vec2 u_res;\r
    uniform float u_intensity;\r
    uniform float u_radius;\r
    uniform float u_softness;\r
    uniform vec3 u_color;

    void main() {\r
        vec4 col = texture(u_tex, v_uv);

        
        
        vec2 center = vec2(0.5, 0.5);\r
        vec2 aspect = vec2(1.0, u_res.y / u_res.x);\r
        float dist = distance((v_uv - center) / aspect, vec2(0.0));

        
        
        float v = smoothstep(u_radius, u_radius + u_softness, dist);

        
        
        vec3 finalColor = mix(col.rgb, u_color, v * u_intensity);

        outColor = vec4(finalColor, col.a);\r
    }`,Ze=`#version 300 es\r
in vec2 a_pos;\r
in vec2 a_uv;\r
out vec2 v_uv;\r
void main() {\r
    v_uv = a_uv;\r
    gl_Position = vec4(a_pos, 0.0, 1.0);\r
}`;const Ye=Object.assign({"../shaders/fs-adjust.frag":xe,"../shaders/fs-adjustMasked.frag":ge,"../shaders/fs-airyBloom.frag":be,"../shaders/fs-analog.frag":ye,"../shaders/fs-bilateral.frag":Ee,"../shaders/fs-blur.frag":Te,"../shaders/fs-cell.frag":Le,"../shaders/fs-chroma.frag":Re,"../shaders/fs-colorMask.frag":Fe,"../shaders/fs-composite.frag":Ue,"../shaders/fs-compression.frag":we,"../shaders/fs-copy.frag":ke,"../shaders/fs-corruption.frag":Ie,"../shaders/fs-denoise.frag":Be,"../shaders/fs-dither.frag":Ce,"../shaders/fs-edge.frag":Ae,"../shaders/fs-final.frag":Se,"../shaders/fs-glareRays.frag":Me,"../shaders/fs-halftone.frag":Pe,"../shaders/fs-hankelBlur.frag":De,"../shaders/fs-heatwave.frag":Xe,"../shaders/fs-invert.frag":Ne,"../shaders/fs-lens.frag":ze,"../shaders/fs-lightleaks.frag":qe,"../shaders/fs-mask.frag":Oe,"../shaders/fs-maskedBlur.frag":Ge,"../shaders/fs-maskedDither.frag":We,"../shaders/fs-noise.frag":He,"../shaders/fs-palette.frag":je,"../shaders/fs-radial.frag":Ve,"../shaders/fs-vignette.frag":$e,"../shaders/vs-quad.vert":Ze});function ue(e,a,n){const o=a=="vs-quad"?".vert":".frag",i=`../shaders/${n}${o}`;let u=Ye[i];if(!u)return console.error("Shader not found:",i),null;u=u.trim();const l=e.createShader(a=="vs-quad"?e.VERTEX_SHADER:e.FRAGMENT_SHADER);return e.shaderSource(l,u),e.compileShader(l),e.getShaderParameter(l,e.COMPILE_STATUS)?l:(console.error("Shader compile error in "+n+":",e.getShaderInfoLog(l)),null)}function T(e,a,n){const o=ue(e,"vs-quad",a),i=ue(e,"fs-fragment",n);if(!o||!i)return null;const u=e.createProgram();return e.attachShader(u,o),e.attachShader(u,i),e.linkProgram(u),u}function ve(){r.canvas=t.displayCanvas;const e=r.canvas.getContext("webgl2",{antialias:!1,premultipliedAlpha:!1,preserveDrawingBuffer:!0});if(!e){alert("WebGL2 not supported.");return}r.canvas.addEventListener("webglcontextlost",v=>{v.preventDefault(),console.error("WebGL Context Lost! The GPU crashed or was reset."),document.getElementById("loading").textContent="ERROR: GPU CRASHED. Reload page.",document.getElementById("loading").style.display="block",document.getElementById("loading").style.backgroundColor="red",r.isPlaying=!1,r.playInterval&&clearInterval(r.playInterval)},!1),r.canvas.addEventListener("webglcontextrestored",()=>{console.log("WebGL Context Restored. Re-initializing..."),ve(),r.baseImage&&(z(!1),requestRender()),document.getElementById("loading").style.display="none",document.getElementById("loading").style.backgroundColor="var(--accent)",document.getElementById("loading").textContent="PROCESSING GPU..."},!1),e.getExtension("EXT_color_buffer_float"),e.getExtension("OES_texture_float_linear"),r.gl=e,e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!0),r.programs={adjust:T(e,"vs-quad","fs-adjust"),adjustMasked:T(e,"vs-quad","fs-adjustMasked"),mask:T(e,"vs-quad","fs-mask"),colorMask:T(e,"vs-quad","fs-colorMask"),noise:T(e,"vs-quad","fs-noise"),blur:T(e,"vs-quad","fs-blur"),maskedBlur:T(e,"vs-quad","fs-maskedBlur"),composite:T(e,"vs-quad","fs-composite"),chroma:T(e,"vs-quad","fs-chroma"),copy:T(e,"vs-quad","fs-copy"),dither:T(e,"vs-quad","fs-dither"),maskedDither:T(e,"vs-quad","fs-maskedDither"),corruption:T(e,"vs-quad","fs-corruption"),compression:T(e,"vs-quad","fs-compression"),cell:T(e,"vs-quad","fs-cell"),halftone:T(e,"vs-quad","fs-halftone"),bilateral:T(e,"vs-quad","fs-bilateral"),denoise:T(e,"vs-quad","fs-denoise"),palette:T(e,"vs-quad","fs-palette"),edge:T(e,"vs-quad","fs-edge"),airyBloom:T(e,"vs-quad","fs-airyBloom"),glareRays:T(e,"vs-quad","fs-glareRays"),hankelBlur:T(e,"vs-quad","fs-hankelBlur"),vignette:T(e,"vs-quad","fs-vignette"),analogVideo:T(e,"vs-quad","fs-analog"),lensDistort:T(e,"vs-quad","fs-lens"),heatwave:T(e,"vs-quad","fs-heatwave"),lightLeaks:T(e,"vs-quad","fs-lightleaks"),invert:T(e,"vs-quad","fs-invert"),radial:T(e,"vs-quad","fs-radial"),final:T(e,"vs-quad","fs-final")};const a=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,a),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,0,0,1,-1,1,0,-1,1,0,1,-1,1,0,1,1,-1,1,0,1,1,1,1]),e.STATIC_DRAW),Object.values(r.programs).forEach(v=>{e.useProgram(v);const h=e.getAttribLocation(v,"a_pos"),_=e.getAttribLocation(v,"a_uv");e.enableVertexAttribArray(h),e.enableVertexAttribArray(_),e.vertexAttribPointer(h,2,e.FLOAT,!1,16,0),e.vertexAttribPointer(_,2,e.FLOAT,!1,16,8)});const n=320,o=180,i=O(e,null,n,o),u=e.createFramebuffer();e.bindFramebuffer(e.FRAMEBUFFER,u),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,i,0),r.thumbnailFBO={fbo:u,tex:i,w:n,h:o};const l=256,c=256,s=O(e,null,l,c),d=e.createFramebuffer();if(e.bindFramebuffer(e.FRAMEBUFFER,d),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,s,0),r.analysisFBO={fbo:d,tex:s,w:l,h:c},r.thumbTempCanvas=document.createElement("canvas"),r.thumbTempCanvas.width=n,r.thumbTempCanvas.height=o,r.thumbTempCtx=r.thumbTempCanvas.getContext("2d"),r.thumbPixelBuffer=new Uint8Array(n*o*4),r.thumbClampedBuffer=new Uint8ClampedArray(n*o*4),t.gpuMaxRes){const v=e.getParameter(e.MAX_TEXTURE_SIZE);t.gpuMaxRes.textContent=`${v}px`}r.textures.white=O(e,new Uint8Array([255,255,255,255]),1,1),r.textures.black=O(e,new Uint8Array([0,0,0,255]),1,1)}function pe(e){r.baseImage=e,r.width=e.width,r.height=e.height;const a=r.gl;r.textures.base&&(a.deleteTexture(r.textures.base),r.textures.base=null),r.textures.base=O(a,e),r.fboWidth=0,r.fboHeight=0,z(!1),t.downloadBtn.disabled=!1,t.downloadCurrentBtn.disabled=!1,t.compareBtn.disabled=!1,t.overlayCanvas.width=e.width,t.overlayCanvas.height=e.height,t.overlayCanvas.getContext("2d").drawImage(e,0,0),t.caPin.classList.add("active"),setupLayerGridDOM(),requestRender(),setTimeout(()=>requestRender(),50)}function z(e=!1){var h,_;const a=r.gl,n=a.getParameter(a.MAX_TEXTURE_SIZE);let o,i;if(e){let p=r.width*r.upscaleFactor,g=r.height*r.upscaleFactor,b=1;(p>n||g>n)&&(b=Math.min(n/p,n/g)),o=Math.round(r.width*r.upscaleFactor*b),i=Math.round(r.height*r.upscaleFactor*b),r._exportScale=b}else{const p=r.clampPreview?2048:n;let g=r.width*r.upscaleFactor,b=r.height*r.upscaleFactor,f=1;if((g>p||b>p)&&(f=Math.min(p/g,p/b)),o=Math.round(g*f),i=Math.round(b*f),o>n||i>n){const m=Math.min(n/o,n/i);o=Math.floor(o*m),i=Math.floor(i*m)}r._exportScale=f}if(r.renderWidth=o,r.renderHeight=i,r.fboWidth===o&&r.fboHeight===i)return{w:o,h:i};r.fboWidth=o,r.fboHeight=i;const u=(p=!0)=>{const g=O(a,null,o,i,p),b=a.createFramebuffer();return a.bindFramebuffer(a.FRAMEBUFFER,b),a.framebufferTexture2D(a.FRAMEBUFFER,a.COLOR_ATTACHMENT0,a.TEXTURE_2D,g,0),{tex:g,fbo:b}};(h=r.pingPong[0])!=null&&h.tex&&(a.deleteTexture(r.pingPong[0].tex),a.deleteFramebuffer(r.pingPong[0].fbo)),(_=r.pingPong[1])!=null&&_.tex&&(a.deleteTexture(r.pingPong[1].tex),a.deleteFramebuffer(r.pingPong[1].fbo)),r.pingPong[0]=u(),r.pingPong[1]=u(),["tempNoise","blur1","blur2","preview"].forEach(p=>{r.textures[p]&&a.deleteTexture(r.textures[p]),r.fbos[p]&&a.deleteFramebuffer(r.fbos[p])});const l=u();r.textures.tempNoise=l.tex,r.fbos.tempNoise=l.fbo;const c=u();r.textures.blur1=c.tex,r.fbos.blur1=c.fbo;const s=u();r.textures.blur2=s.tex,r.fbos.blur2=s.fbo;const d=u();r.textures.preview=d.tex,r.fbos.preview=d.fbo;const v=u();return r.textures.chainCapture=v.tex,r.fbos.chainCapture=v.fbo,{w:o,h:i}}function O(e,a,n,o,i=!1){const u=e.createTexture();e.bindTexture(e.TEXTURE_2D,u),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR);const l=i?e.RGBA16F:e.SRGB8_ALPHA8,c=e.RGBA,s=i?e.HALF_FLOAT:e.UNSIGNED_BYTE;return a&&(a instanceof HTMLImageElement||a instanceof HTMLCanvasElement||a instanceof ImageBitmap)?e.texImage2D(e.TEXTURE_2D,0,l,c,s,a):e.texImage2D(e.TEXTURE_2D,0,l,n,o,0,c,s,a||null),u}function Y(e){const a=parseInt(e.slice(1,3),16)/255,n=parseInt(e.slice(3,5),16)/255,o=parseInt(e.slice(5,7),16)/255;return{r:a,g:n,b:o}}const Je={id:"adjust",render:(e,a,n,o,i=!1)=>{var d,v,h,_,p,g,b,f,m,x,y;if(!((d=t.adjustEnable)!=null&&d.checked)&&!i)return e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1;let u=null;const l=(v=t.adjLumaMask)==null?void 0:v.checked,c=(h=t.adjColorExclude)==null?void 0:h.checked;if(l||c){if(e.bindFramebuffer(e.FRAMEBUFFER,r.fbos.blur1),e.clearColor(1,1,1,1),e.clear(e.COLOR_BUFFER_BIT),e.enable(e.BLEND),e.blendFunc(e.DST_COLOR,e.ZERO),l&&(e.useProgram(r.programs.mask),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.mask,"u_tex"),0),e.uniform1i(e.getUniformLocation(r.programs.mask,"u_useS"),1),e.uniform1f(e.getUniformLocation(r.programs.mask,"u_sth"),parseFloat(((_=t.adjShadowThreshold)==null?void 0:_.value)||0)),e.uniform1f(e.getUniformLocation(r.programs.mask,"u_sfa"),parseFloat(((p=t.adjShadowFade)==null?void 0:p.value)||0)),e.uniform1i(e.getUniformLocation(r.programs.mask,"u_useH"),1),e.uniform1f(e.getUniformLocation(r.programs.mask,"u_hth"),parseFloat(((g=t.adjHighlightThreshold)==null?void 0:g.value)||1)),e.uniform1f(e.getUniformLocation(r.programs.mask,"u_hfa"),parseFloat(((b=t.adjHighlightFade)==null?void 0:b.value)||0)),e.drawArrays(e.TRIANGLES,0,6)),c){const E=((f=t.adjExcludeColor)==null?void 0:f.value)||"#000000",F=parseInt(E.slice(1,3),16)/255,R=parseInt(E.slice(3,5),16)/255,w=parseInt(E.slice(5,7),16)/255;e.useProgram(r.programs.colorMask),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.colorMask,"u_tex"),0),e.uniform3f(e.getUniformLocation(r.programs.colorMask,"u_targetColor"),F,R,w),e.uniform1f(e.getUniformLocation(r.programs.colorMask,"u_tolerance"),parseFloat(((m=t.adjColorTolerance)==null?void 0:m.value)||10)/100),e.uniform1f(e.getUniformLocation(r.programs.colorMask,"u_fade"),parseFloat(((x=t.adjColorFade)==null?void 0:x.value)||0)/100),e.drawArrays(e.TRIANGLES,0,6)}e.disable(e.BLEND),u=r.textures.blur1,u&&((y=t.adjInvertMask)!=null&&y.checked)&&(e.useProgram(r.programs.invert),e.bindFramebuffer(e.FRAMEBUFFER,r.fbos.blur2),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,u),e.uniform1i(e.getUniformLocation(r.programs.invert,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),u=r.textures.blur2)}e.bindFramebuffer(e.FRAMEBUFFER,n);const s=r.programs.adjustMasked||r.programs.adjust;return e.useProgram(s),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(s,"u_tex"),0),e.uniform1f(e.getUniformLocation(s,"u_bright"),o.u_bright),e.uniform1f(e.getUniformLocation(s,"u_cont"),o.u_cont),e.uniform1f(e.getUniformLocation(s,"u_sat"),o.u_sat),e.uniform1f(e.getUniformLocation(s,"u_hdrTol"),0),e.uniform1f(e.getUniformLocation(s,"u_hdrAmt"),0),e.uniform1f(e.getUniformLocation(s,"u_warmth"),o.u_warmth),e.uniform1f(e.getUniformLocation(s,"u_sharp"),o.u_sharp),e.uniform1f(e.getUniformLocation(s,"u_sharpThresh"),o.u_sharpThresh),e.uniform2f(e.getUniformLocation(s,"u_step"),o.u_step[0],o.u_step[1]),u&&s?(e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,u),e.uniform1i(e.getUniformLocation(s,"u_mask"),1),e.uniform1i(e.getUniformLocation(s,"u_useMask"),1)):s&&e.uniform1i(e.getUniformLocation(s,"u_useMask"),0),e.drawArrays(e.TRIANGLES,0,6),n}},Ke={id:"hdr",render:(e,a,n,o,i=!1)=>{var u;return!((u=t.hdrEnable)!=null&&u.checked)&&!i?(e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1):(e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.adjust),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.adjust,"u_tex"),0),e.uniform1f(e.getUniformLocation(r.programs.adjust,"u_bright"),0),e.uniform1f(e.getUniformLocation(r.programs.adjust,"u_cont"),0),e.uniform1f(e.getUniformLocation(r.programs.adjust,"u_sat"),0),e.uniform1f(e.getUniformLocation(r.programs.adjust,"u_warmth"),0),e.uniform1f(e.getUniformLocation(r.programs.adjust,"u_sharp"),0),e.uniform1f(e.getUniformLocation(r.programs.adjust,"u_hdrTol"),o.u_hdrTol),e.uniform1f(e.getUniformLocation(r.programs.adjust,"u_hdrAmt"),o.u_hdrAmt),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1)}},Qe={id:"noise",render:(e,a,n,o,i=!1)=>{var v;const u=r.renderWidth,l=r.renderHeight;if(!((v=t.noiseEnable)!=null&&v.checked)&&!i)return e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1;e.useProgram(r.programs.noise),e.bindFramebuffer(e.FRAMEBUFFER,r.fbos.tempNoise),e.uniform1i(e.getUniformLocation(r.programs.noise,"u_type"),parseInt(t.noiseType.value)),e.uniform1f(e.getUniformLocation(r.programs.noise,"u_seed"),Math.random()*100),e.uniform2f(e.getUniformLocation(r.programs.noise,"u_res"),u,l),e.uniform2f(e.getUniformLocation(r.programs.noise,"u_origRes"),r.width*r.upscaleFactor,r.height*r.upscaleFactor),e.uniform1f(e.getUniformLocation(r.programs.noise,"u_scale"),parseFloat(t.noiseSize.value)),e.uniform1f(e.getUniformLocation(r.programs.noise,"u_paramA"),parseFloat(document.getElementById("noiseParamA").value)/100),e.uniform1f(e.getUniformLocation(r.programs.noise,"u_paramB"),parseFloat(document.getElementById("noiseParamB").value)/100),e.uniform1f(e.getUniformLocation(r.programs.noise,"u_paramC"),parseFloat(document.getElementById("noiseParamC").value)/100),e.drawArrays(e.TRIANGLES,0,6);const c=parseFloat(t.blurriness.value)/100;let s=r.textures.tempNoise;c>0&&(e.useProgram(r.programs.blur),e.bindFramebuffer(e.FRAMEBUFFER,r.fbos.blur1),e.bindTexture(e.TEXTURE_2D,r.textures.tempNoise),e.uniform1i(e.getUniformLocation(r.programs.blur,"u_tex"),0),e.uniform2f(e.getUniformLocation(r.programs.blur,"u_dir"),1/u,0),e.uniform1f(e.getUniformLocation(r.programs.blur,"u_rad"),c*2),e.drawArrays(e.TRIANGLES,0,6),e.bindFramebuffer(e.FRAMEBUFFER,r.fbos.blur2),e.bindTexture(e.TEXTURE_2D,r.textures.blur1),e.uniform2f(e.getUniformLocation(r.programs.blur,"u_dir"),0,1/l),e.drawArrays(e.TRIANGLES,0,6),s=r.textures.blur2);const d=V("noise",a);e.useProgram(r.programs.composite),e.bindFramebuffer(e.FRAMEBUFFER,n),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,s),e.activeTexture(e.TEXTURE2),e.bindTexture(e.TEXTURE_2D,d||r.textures.white),e.uniform1i(e.getUniformLocation(r.programs.composite,"u_base"),0),e.uniform1i(e.getUniformLocation(r.programs.composite,"u_noise"),1),e.uniform1i(e.getUniformLocation(r.programs.composite,"u_mask"),2),e.uniform1i(e.getUniformLocation(r.programs.composite,"u_mode"),parseInt(t.blendMode.value)),e.uniform1f(e.getUniformLocation(r.programs.composite,"u_opacity"),parseFloat(t.opacity.value)),e.uniform1f(e.getUniformLocation(r.programs.composite,"u_str"),parseFloat(t.strength.value)),e.uniform1i(e.getUniformLocation(r.programs.composite,"u_nType"),parseInt(t.noiseType.value)),e.uniform1f(e.getUniformLocation(r.programs.composite,"u_satStr"),parseFloat(t.satStrength.value)),e.uniform1f(e.getUniformLocation(r.programs.composite,"u_satImp"),parseFloat(t.satPerNoise.value)),e.uniform1f(e.getUniformLocation(r.programs.composite,"u_skinProt"),parseFloat(t.skinProtection.value)),e.uniform1i(e.getUniformLocation(r.programs.composite,"u_ignA"),t.ignoreAlphaToggle.checked?1:0),e.uniform1f(e.getUniformLocation(r.programs.composite,"u_ignAstr"),parseFloat(t.ignoreAlphaStrength.value)),e.drawArrays(e.TRIANGLES,0,6)}},er={id:"ca",render:(e,a,n,o,i=!1)=>{var u;if(!((u=t.caEnable)!=null&&u.checked)&&!i)return e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1;e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.chroma),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.chroma,"u_tex"),0),e.uniform1f(e.getUniformLocation(r.programs.chroma,"u_amt"),o.u_ca_amt),e.uniform1f(e.getUniformLocation(r.programs.chroma,"u_blur"),o.u_ca_blur),e.uniform1f(e.getUniformLocation(r.programs.chroma,"u_zoomBlur"),parseFloat(t.aberrationZoomBlur.value)/50),e.uniform2f(e.getUniformLocation(r.programs.chroma,"u_center"),o.u_ca_center[0],o.u_ca_center[1]),e.uniform1f(e.getUniformLocation(r.programs.chroma,"u_radius"),o.u_ca_rad),e.uniform1f(e.getUniformLocation(r.programs.chroma,"u_falloff"),o.u_ca_fall),e.uniform1i(e.getUniformLocation(r.programs.chroma,"u_falloffToBlur"),t.caFalloffToBlur.checked?1:0),e.drawArrays(e.TRIANGLES,0,6)}},rr={id:"blur",render:(e,a,n,o,i=!1)=>{var d,v,h,_;const u=r.renderWidth,l=r.renderHeight;if(!((d=t.blurEnable)!=null&&d.checked))return e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1;const c=V("blur",a),s=parseFloat(((v=t.blurAmount)==null?void 0:v.value)||0)/100;if(s>0){const p=c?r.programs.maskedBlur:r.programs.blur;e.useProgram(p),e.bindFramebuffer(e.FRAMEBUFFER,r.fbos.blur2),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(p,"u_tex"),0),e.uniform2f(e.getUniformLocation(p,"u_dir"),1/u,0),e.uniform1f(e.getUniformLocation(p,"u_rad"),s*2),e.uniform1i(e.getUniformLocation(p,"u_blurType"),parseInt(((h=t.blurType)==null?void 0:h.value)||0)),c&&(e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,c),e.uniform1i(e.getUniformLocation(p,"u_mask"),1)),e.drawArrays(e.TRIANGLES,0,6),e.bindFramebuffer(e.FRAMEBUFFER,n),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,r.textures.blur2),e.uniform1i(e.getUniformLocation(p,"u_tex"),0),e.uniform2f(e.getUniformLocation(p,"u_dir"),0,1/l),e.uniform1f(e.getUniformLocation(p,"u_rad"),s*2),e.uniform1i(e.getUniformLocation(p,"u_blurType"),parseInt(((_=t.blurType)==null?void 0:_.value)||0)),c&&(e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,c),e.uniform1i(e.getUniformLocation(p,"u_mask"),1)),e.drawArrays(e.TRIANGLES,0,6)}else e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6)}},tr={id:"cell",render:(e,a,n,o,i=!1)=>{var c,s,d,v,h,_,p,g,b,f,m;const u=r.renderWidth,l=r.renderHeight;if(!((c=t.cellEnable)!=null&&c.checked)&&!i)return e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1;e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.cell),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.cell,"u_tex"),0),e.uniform2f(e.getUniformLocation(r.programs.cell,"u_res"),u,l),e.uniform1i(e.getUniformLocation(r.programs.cell,"u_levels"),parseInt(((s=t.cellLevels)==null?void 0:s.value)||4)),e.uniform1f(e.getUniformLocation(r.programs.cell,"u_bias"),parseFloat(((d=t.cellBias)==null?void 0:d.value)||0)),e.uniform1f(e.getUniformLocation(r.programs.cell,"u_gamma"),parseFloat(((v=t.cellGamma)==null?void 0:v.value)||1)),e.uniform1i(e.getUniformLocation(r.programs.cell,"u_quantMode"),parseInt(((h=t.cellQuantMode)==null?void 0:h.value)||0)),e.uniform1i(e.getUniformLocation(r.programs.cell,"u_bandMap"),parseInt(((_=t.cellBandMap)==null?void 0:_.value)||0)),e.uniform1i(e.getUniformLocation(r.programs.cell,"u_edgeMethod"),parseInt(((p=t.cellEdgeMethod)==null?void 0:p.value)||0)),e.uniform1f(e.getUniformLocation(r.programs.cell,"u_edgeStr"),parseFloat(((g=t.cellEdgeStr)==null?void 0:g.value)||1)),e.uniform1f(e.getUniformLocation(r.programs.cell,"u_edgeThick"),parseFloat(((b=t.cellEdgeThick)==null?void 0:b.value)||1)),e.uniform1i(e.getUniformLocation(r.programs.cell,"u_colorPreserve"),(f=t.cellColorPreserve)!=null&&f.checked?1:0),e.uniform1i(e.getUniformLocation(r.programs.cell,"u_edgeEnable"),(m=t.cellEdgeEnable)!=null&&m.checked?1:0),e.drawArrays(e.TRIANGLES,0,6)}},nr={id:"halftone",render:(e,a,n,o,i=!1)=>{var c,s,d,v,h,_,p,g,b,f;const u=r.renderWidth,l=r.renderHeight;if(!((c=t.halftoneEnable)!=null&&c.checked)&&!i)return e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1;e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.halftone),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.halftone,"u_tex"),0),e.uniform2f(e.getUniformLocation(r.programs.halftone,"u_res"),u,l),e.uniform1f(e.getUniformLocation(r.programs.halftone,"u_size"),parseFloat(((s=t.halftoneSize)==null?void 0:s.value)||4)),e.uniform1f(e.getUniformLocation(r.programs.halftone,"u_intensity"),parseFloat(((d=t.halftoneIntensity)==null?void 0:d.value)||1)),e.uniform1f(e.getUniformLocation(r.programs.halftone,"u_sharpness"),parseFloat(((v=t.halftoneSharpness)==null?void 0:v.value)||1)),e.uniform1i(e.getUniformLocation(r.programs.halftone,"u_pattern"),parseInt(((h=t.halftonePattern)==null?void 0:h.value)||0)),e.uniform1i(e.getUniformLocation(r.programs.halftone,"u_colorMode"),parseInt(((_=t.halftoneColorMode)==null?void 0:_.value)||0)),e.uniform1i(e.getUniformLocation(r.programs.halftone,"u_sample"),parseInt(((p=t.halftoneSample)==null?void 0:p.value)||1)),e.uniform1i(e.getUniformLocation(r.programs.halftone,"u_gray"),(g=t.halftoneGray)!=null&&g.checked?1:0),e.uniform1i(e.getUniformLocation(r.programs.halftone,"u_lock"),(b=t.halftoneScreenLock)!=null&&b.checked?1:0),e.uniform1i(e.getUniformLocation(r.programs.halftone,"u_invert"),(f=t.halftoneInvert)!=null&&f.checked?1:0),e.drawArrays(e.TRIANGLES,0,6)}},ar={id:"bilateral",render:(e,a,n,o,i=!1)=>{var c,s,d,v,h,_,p;const u=r.renderWidth,l=r.renderHeight;if(!((c=t.bilateralEnable)!=null&&c.checked)&&!i)return e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1;Math.max(1,parseInt(((s=t.bilateralIter)==null?void 0:s.value)||1)),e.useProgram(r.programs.bilateral),e.uniform2f(e.getUniformLocation(r.programs.bilateral,"u_res"),u,l),e.uniform1i(e.getUniformLocation(r.programs.bilateral,"u_radius"),parseInt(((d=t.bilateralRadius)==null?void 0:d.value)||2)),e.uniform1f(e.getUniformLocation(r.programs.bilateral,"u_sigmaCol"),parseFloat(((v=t.bilateralColorSig)==null?void 0:v.value)||.1)),e.uniform1f(e.getUniformLocation(r.programs.bilateral,"u_sigmaSpace"),parseFloat(((h=t.bilateralSpatialSig)==null?void 0:h.value)||2)),e.uniform1i(e.getUniformLocation(r.programs.bilateral,"u_kernel"),parseInt(((_=t.bilateralKernel)==null?void 0:_.value)||0)),e.uniform1i(e.getUniformLocation(r.programs.bilateral,"u_edgeMode"),parseInt(((p=t.bilateralEdgeMode)==null?void 0:p.value)||0)),e.bindFramebuffer(e.FRAMEBUFFER,n),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.bilateral,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6)}},or={id:"denoise",render:(e,a,n,o,i=!1)=>{var d,v,h,_,p,g;const u=r.renderWidth,l=r.renderHeight;if(!((d=t.denoiseEnable)!=null&&d.checked)&&!i)return e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1;const c=V("denoise",a),s=r.programs.denoise;e.useProgram(s),e.bindFramebuffer(e.FRAMEBUFFER,n),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(s,"u_tex"),0),e.uniform2f(e.getUniformLocation(s,"u_res"),u,l),e.uniform1i(e.getUniformLocation(s,"u_mode"),parseInt(((v=t.denoiseMode)==null?void 0:v.value)||0)),e.uniform1i(e.getUniformLocation(s,"u_searchRadius"),parseInt(((h=t.denoiseSearchRadius)==null?void 0:h.value)||5)),e.uniform1i(e.getUniformLocation(s,"u_patchRadius"),parseInt(((_=t.denoisePatchRadius)==null?void 0:_.value)||2)),e.uniform1f(e.getUniformLocation(s,"u_h"),parseFloat(((p=t.denoiseH)==null?void 0:p.value)||.5)),e.uniform1f(e.getUniformLocation(s,"u_strength"),parseFloat(((g=t.denoiseBlend)==null?void 0:g.value)||100)/100),c?(e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,c),e.uniform1i(e.getUniformLocation(s,"u_mask"),1),e.uniform1i(e.getUniformLocation(s,"u_useMask"),1)):e.uniform1i(e.getUniformLocation(s,"u_useMask"),0),e.drawArrays(e.TRIANGLES,0,6)}},ir={id:"dither",render:(e,a,n,o,i=!1)=>{var v,h,_,p;const u=r.renderWidth,l=r.renderHeight;if(!((v=t.ditherEnable)!=null&&v.checked)&&!i)return e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1;const c=V("dither",a),s=c?r.programs.maskedDither:r.programs.dither;e.useProgram(s),e.bindFramebuffer(e.FRAMEBUFFER,n),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(s,"u_tex"),0),e.uniform1i(e.getUniformLocation(s,"u_type"),parseInt(((h=t.ditherType)==null?void 0:h.value)||0)),e.uniform1f(e.getUniformLocation(s,"u_bitDepth"),parseFloat(t.ditherBitDepth.value)),e.uniform1f(e.getUniformLocation(s,"u_strength"),parseFloat(t.ditherStrength.value)/100),e.uniform1f(e.getUniformLocation(s,"u_scale"),parseFloat(t.ditherScale.value)),e.uniform2f(e.getUniformLocation(s,"u_res"),u,l),e.uniform1f(e.getUniformLocation(s,"u_seed"),Math.random()*100),e.uniform1i(e.getUniformLocation(s,"u_gamma"),(_=t.ditherGamma)!=null&&_.checked?1:0);const d=(p=t.ditherUsePalette)!=null&&p.checked?1:0;if(e.uniform1i(e.getUniformLocation(s,"u_usePalette"),d),d){const g=r.palette.map(Y),b=new Float32Array(256*3);g.forEach((f,m)=>{b[m*3]=f[0]/255,b[m*3+1]=f[1]/255,b[m*3+2]=f[2]/255}),e.uniform3fv(e.getUniformLocation(s,"u_customPalette"),b),e.uniform1f(e.getUniformLocation(s,"u_paletteSize"),g.length)}else e.uniform1f(e.getUniformLocation(s,"u_paletteSize"),parseFloat(t.ditherPaletteSize.value));c&&(e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,c),e.uniform1i(e.getUniformLocation(s,"u_mask"),1)),e.drawArrays(e.TRIANGLES,0,6)}},sr={id:"corruption",render:(e,a,n,o,i=!1)=>{var c,s,d;const u=r.renderWidth,l=r.renderHeight;if(!((c=t.corruptionEnable)!=null&&c.checked)&&!i)return e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1;e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.corruption),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.corruption,"u_tex"),0),e.uniform1i(e.getUniformLocation(r.programs.corruption,"u_algorithm"),parseInt(((s=t.corruptionAlgorithm)==null?void 0:s.value)||0)),e.uniform1f(e.getUniformLocation(r.programs.corruption,"u_resScale"),parseFloat(((d=t.corruptionResScale)==null?void 0:d.value)||1)),e.uniform2f(e.getUniformLocation(r.programs.corruption,"u_res"),u,l),e.drawArrays(e.TRIANGLES,0,6)}},ur={id:"analogVideo",render:(e,a,n,o,i=!1)=>{var u;if(!((u=t.analogVideoEnable)!=null&&u.checked)&&!i)return e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1;e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.analogVideo),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.analogVideo,"u_tex"),0),e.uniform1f(e.getUniformLocation(r.programs.analogVideo,"u_time"),o.u_time),e.uniform1f(e.getUniformLocation(r.programs.analogVideo,"u_wobble"),o.u_analog_wobble),e.uniform1f(e.getUniformLocation(r.programs.analogVideo,"u_bleed"),o.u_analog_bleed),e.uniform1f(e.getUniformLocation(r.programs.analogVideo,"u_curve"),o.u_analog_curve),e.uniform1f(e.getUniformLocation(r.programs.analogVideo,"u_noise"),o.u_analog_noise),e.drawArrays(e.TRIANGLES,0,6),(o.u_analog_wobble>0||o.u_analog_noise>0)&&L()}},cr={id:"lensDistort",render:(e,a,n,o,i=!1)=>{var u;if(!((u=t.lensDistortEnable)!=null&&u.checked)&&!i)return e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1;e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.lensDistort),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.lensDistort,"u_tex"),0),e.uniform1f(e.getUniformLocation(r.programs.lensDistort,"u_amount"),o.u_lens_amount),e.uniform1f(e.getUniformLocation(r.programs.lensDistort,"u_scale"),o.u_lens_scale),e.drawArrays(e.TRIANGLES,0,6)}},lr={id:"lightLeaks",render:(e,a,n,o,i=!1)=>{var u;if(!((u=t.lightLeaksEnable)!=null&&u.checked)&&!i)return e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1;e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.lightLeaks),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.lightLeaks,"u_tex"),0),e.uniform1f(e.getUniformLocation(r.programs.lightLeaks,"u_intensity"),o.u_lightleaks_intensity),e.uniform3f(e.getUniformLocation(r.programs.lightLeaks,"u_color1"),o.u_lightleaks_color1.r,o.u_lightleaks_color1.g,o.u_lightleaks_color1.b),e.uniform3f(e.getUniformLocation(r.programs.lightLeaks,"u_color2"),o.u_lightleaks_color2.r,o.u_lightleaks_color2.g,o.u_lightleaks_color2.b),e.uniform1f(e.getUniformLocation(r.programs.lightLeaks,"u_time"),o.u_time),e.drawArrays(e.TRIANGLES,0,6),o.u_lightleaks_intensity>0&&L()}},fr={id:"heatwave",render:(e,a,n,o,i=!1)=>{var u;if(!((u=t.heatwaveEnable)!=null&&u.checked)&&!i)return e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1;e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.heatwave),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.heatwave,"u_tex"),0),e.uniform1f(e.getUniformLocation(r.programs.heatwave,"u_time"),o.u_time),e.uniform1f(e.getUniformLocation(r.programs.heatwave,"u_intensity"),o.u_heatwave_intensity),e.uniform1f(e.getUniformLocation(r.programs.heatwave,"u_speed"),o.u_heatwave_speed),e.uniform1f(e.getUniformLocation(r.programs.heatwave,"u_scale"),o.u_heatwave_scale),e.uniform1i(e.getUniformLocation(r.programs.heatwave,"u_direction"),o.u_heatwave_direction),e.drawArrays(e.TRIANGLES,0,6),o.u_heatwave_intensity>0&&L()}},mr={id:"compression",render:(e,a,n,o,i=!1)=>{var d,v,h,_,p,g;const u=r.renderWidth,l=r.renderHeight;if(!((d=t.compressionEnable)!=null&&d.checked)&&!i)return e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1;const c=Math.max(1,parseInt(((v=t.compressionIterations)==null?void 0:v.value)||1)),s=r.programs.compression;if(e.useProgram(s),e.uniform1i(e.getUniformLocation(s,"u_method"),parseInt(((h=t.compressionMethod)==null?void 0:h.value)||0)),e.uniform1f(e.getUniformLocation(s,"u_quality"),parseFloat(((_=t.compressionQuality)==null?void 0:_.value)||50)),e.uniform1f(e.getUniformLocation(s,"u_blockSize"),parseFloat(((p=t.compressionBlockSize)==null?void 0:p.value)||8)),e.uniform1f(e.getUniformLocation(s,"u_blend"),parseFloat(((g=t.compressionBlend)==null?void 0:g.value)||100)/100),e.uniform2f(e.getUniformLocation(s,"u_res"),u,l),c<=1)e.bindFramebuffer(e.FRAMEBUFFER,n),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(s,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6);else{let b=a;for(let f=0;f<c;f++){const m=f===c-1,x=m?n:f%2===0?r.fbos.blur1:r.fbos.blur2;e.bindFramebuffer(e.FRAMEBUFFER,x),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,b),e.uniform1i(e.getUniformLocation(s,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),m||(b=f%2===0?r.textures.blur1:r.textures.blur2)}}}},dr={id:"palette",render:(e,a,n,o,i=!1)=>{var d,v,h,_;const u=r.renderWidth,l=r.renderHeight;if(!((d=t.paletteEnable)!=null&&d.checked)&&!i)return e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1;e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.palette),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.palette,"u_tex"),0),e.uniform1f(e.getUniformLocation(r.programs.palette,"u_blend"),parseFloat(((v=t.paletteBlend)==null?void 0:v.value)||100)/100),e.uniform1f(e.getUniformLocation(r.programs.palette,"u_smoothing"),parseFloat(((h=t.paletteSmoothing)==null?void 0:h.value)||0)),e.uniform1i(e.getUniformLocation(r.programs.palette,"u_smoothingType"),parseInt(((_=t.paletteSmoothingType)==null?void 0:_.value)||0)),e.uniform2f(e.getUniformLocation(r.programs.palette,"u_res"),u,l);const c=Math.min(r.palette.length,256);e.uniform1i(e.getUniformLocation(r.programs.palette,"u_paletteSize"),c);const s=new Float32Array(256*3);for(let p=0;p<c;p++){const g=r.palette[p];s[p*3+0]=parseInt(g.slice(1,3),16)/255,s[p*3+1]=parseInt(g.slice(3,5),16)/255,s[p*3+2]=parseInt(g.slice(5,7),16)/255}e.uniform3fv(e.getUniformLocation(r.programs.palette,"u_palette"),s),e.drawArrays(e.TRIANGLES,0,6)}},vr={id:"edge",render:(e,a,n,o,i=!1)=>{var c,s,d,v,h,_,p,g,b;const u=r.renderWidth,l=r.renderHeight;if(!((c=t.edgeEnable)!=null&&c.checked)&&!i)return e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1;e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.edge),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.edge,"u_tex"),0),e.uniform2f(e.getUniformLocation(r.programs.edge,"u_res"),u,l),e.uniform1i(e.getUniformLocation(r.programs.edge,"u_mode"),parseInt(((s=t.edgeMode)==null?void 0:s.value)||0)),e.uniform1f(e.getUniformLocation(r.programs.edge,"u_strength"),parseFloat(((d=t.edgeStrength)==null?void 0:d.value)||500)),e.uniform1f(e.getUniformLocation(r.programs.edge,"u_tolerance"),parseFloat(((v=t.edgeTolerance)==null?void 0:v.value)||10)),e.uniform1f(e.getUniformLocation(r.programs.edge,"u_bgSat"),parseFloat(((h=t.edgeBgSat)==null?void 0:h.value)||0)),e.uniform1f(e.getUniformLocation(r.programs.edge,"u_fgSat"),parseFloat(((_=t.edgeFgSat)==null?void 0:_.value)||150)),e.uniform1f(e.getUniformLocation(r.programs.edge,"u_bloom"),parseFloat(((p=t.edgeBloom)==null?void 0:p.value)||10)),e.uniform1f(e.getUniformLocation(r.programs.edge,"u_smooth"),parseFloat(((g=t.edgeSmooth)==null?void 0:g.value)||50)),e.uniform1f(e.getUniformLocation(r.programs.edge,"u_blend"),parseFloat(((b=t.edgeBlend)==null?void 0:b.value)||100)),e.drawArrays(e.TRIANGLES,0,6)}},pr={id:"airyBloom",render:(e,a,n,o,i=!1)=>{var s,d,v,h,_,p;const u=r.renderWidth,l=r.renderHeight;if(!((s=t.airyBloomEnable)!=null&&s.checked)&&!i)return e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1;const c=V(e,a);e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.airyBloom),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.airyBloom,"u_tex"),0),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,c),e.uniform1i(e.getUniformLocation(r.programs.airyBloom,"u_mask"),1),e.uniform1i(e.getUniformLocation(r.programs.airyBloom,"u_useMask"),c?1:0),e.uniform2f(e.getUniformLocation(r.programs.airyBloom,"u_res"),u,l),e.uniform1f(e.getUniformLocation(r.programs.airyBloom,"u_intensity"),parseFloat(((d=t.airyBloomIntensity)==null?void 0:d.value)||.5)),e.uniform1f(e.getUniformLocation(r.programs.airyBloom,"u_aperture"),parseFloat(((v=t.airyBloomAperture)==null?void 0:v.value)||3)),e.uniform1f(e.getUniformLocation(r.programs.airyBloom,"u_threshold"),parseFloat(((h=t.airyBloomThreshold)==null?void 0:h.value)||.7)),e.uniform1f(e.getUniformLocation(r.programs.airyBloom,"u_thresholdFade"),parseFloat(((_=t.airyBloomThresholdFade)==null?void 0:_.value)||.1)),e.uniform1f(e.getUniformLocation(r.programs.airyBloom,"u_cutoff"),parseFloat(((p=t.airyBloomCutoff)==null?void 0:p.value)||1)),e.drawArrays(e.TRIANGLES,0,6)}},_r={id:"vignette",render:(e,a,n,o,i=!1)=>{var c;const u=r.renderWidth,l=r.renderHeight;if(!((c=t.vignetteEnable)!=null&&c.checked)&&!i)return e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1;e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.vignette),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.vignette,"u_tex"),0),e.uniform2f(e.getUniformLocation(r.programs.vignette,"u_res"),u,l),e.uniform1f(e.getUniformLocation(r.programs.vignette,"u_intensity"),o.u_vignette_intensity),e.uniform1f(e.getUniformLocation(r.programs.vignette,"u_radius"),o.u_vignette_radius),e.uniform1f(e.getUniformLocation(r.programs.vignette,"u_softness"),o.u_vignette_softness),e.uniform3f(e.getUniformLocation(r.programs.vignette,"u_color"),o.u_vignette_color.r,o.u_vignette_color.g,o.u_vignette_color.b),e.drawArrays(e.TRIANGLES,0,6)}},hr={id:"glareRays",render:(e,a,n,o,i=!1)=>{var c;const u=r.renderWidth,l=r.renderHeight;if(!((c=t.glareRaysEnable)!=null&&c.checked)&&!i)return e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1;e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.glareRays),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.glareRays,"u_tex"),0),e.uniform2f(e.getUniformLocation(r.programs.glareRays,"u_res"),u,l),e.uniform1f(e.getUniformLocation(r.programs.glareRays,"u_intensity"),o.u_glare_intensity),e.uniform1f(e.getUniformLocation(r.programs.glareRays,"u_rays"),o.u_glare_rays),e.uniform1f(e.getUniformLocation(r.programs.glareRays,"u_length"),o.u_glare_length),e.uniform1f(e.getUniformLocation(r.programs.glareRays,"u_blur"),o.u_glare_blur),e.drawArrays(e.TRIANGLES,0,6)}},xr={id:"hankelBlur",render:(e,a,n,o,i=!1)=>{var s;const u=r.renderWidth,l=r.renderHeight;if(!((s=t.hankelBlurEnable)!=null&&s.checked)&&!i)return e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.copy),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.copy,"u_tex"),0),e.drawArrays(e.TRIANGLES,0,6),n===r.fbos.temp2?r.textures.temp2:r.textures.temp1;const c=V(e,a);e.bindFramebuffer(e.FRAMEBUFFER,n),e.useProgram(r.programs.hankelBlur),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,a),e.uniform1i(e.getUniformLocation(r.programs.hankelBlur,"u_tex"),0),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,c),e.uniform1i(e.getUniformLocation(r.programs.hankelBlur,"u_mask"),1),e.uniform1i(e.getUniformLocation(r.programs.hankelBlur,"u_useMask"),c?1:0),e.uniform2f(e.getUniformLocation(r.programs.hankelBlur,"u_res"),u,l),e.uniform1f(e.getUniformLocation(r.programs.hankelBlur,"u_intensity"),o.u_hankel_intensity),e.uniform1f(e.getUniformLocation(r.programs.hankelBlur,"u_radius"),o.u_hankel_radius),e.uniform1f(e.getUniformLocation(r.programs.hankelBlur,"u_quality"),o.u_hankel_quality),e.drawArrays(e.TRIANGLES,0,6)}},ee={adjust:Je,hdr:Ke,noise:Qe,ca:er,blur:rr,cell:tr,halftone:nr,bilateral:ar,denoise:or,dither:ir,corruption:sr,analogVideo:ur,lensDistort:cr,lightLeaks:lr,heatwave:fr,compression:mr,palette:dr,edge:vr,airyBloom:pr,vignette:_r,glareRays:hr,hankelBlur:xr};async function j(e){return new Promise((a,n)=>{const o=new Image,i=URL.createObjectURL(e);o.src=i,o.onload=()=>{pe(o),URL.revokeObjectURL(i),a()},o.onerror=u=>{URL.revokeObjectURL(i),n(u)}})}async function gr(){try{const e=await window.showDirectoryPicker(),a=[],n=[];async function o(i,u=""){for await(const l of i.values())if(l.kind==="file"){const c=await l.getFile();c.relativePath=u,n.push(c),c.type.startsWith("image/")&&a.push(c)}else l.kind==="directory"&&await o(l,u+l.name+"/")}t.loading.textContent="SCANNING FOLDER...",t.loading.style.display="block",await o(e),t.loading.style.display="none",a.length>0?(r.imageFiles=a.sort((i,u)=>i.name.localeCompare(u.name,void 0,{numeric:!0})),r.allFiles=n,r.isMultiImageMode=!0,r.currentImageIndex=0,await j(r.imageFiles[0]),Z()):alert("No images found in the selected folder.")}catch(e){console.error("Error loading folder:",e),t.loading.style.display="none",e.name!=="AbortError"&&alert("Could not load folder. Please ensure your browser supports the File System Access API and you have granted permission.")}}async function ce(e){if(!r.isMultiImageMode||r.imageFiles.length===0)return;let a=r.currentImageIndex+e;a<0||a>=r.imageFiles.length||(r.currentImageIndex=a,await j(r.imageFiles[r.currentImageIndex]),Z())}async function le(){t.loading.textContent="PROCESSING GPU...",t.loading.style.display="block",await new Promise(n=>setTimeout(n,50)),z(!0),J(!0);const e=document.createElement("a"),a=r.isMultiImageMode?r.imageFiles[r.currentImageIndex].name.split(".")[0]:"grain-export";e.download=`${a}-processed.png`,e.href=r.canvas.toDataURL("image/png",1),e.click(),z(!1),L(),t.loading.style.display="none"}async function br(){let e;try{e=await window.showDirectoryPicker()}catch(u){if(u.name==="AbortError")return;alert("Could not open directory. Permission denied.");return}r.isExporting=!0;const a=t["export-overlay"];a.style.display="flex";const n=()=>{r.isExporting=!1};t.stopExportBtn.addEventListener("click",n);const o=r.currentImageIndex,i=r.keepFolderStructure?r.allFiles:r.imageFiles;try{for(let u=0;u<i.length;u++){if(!r.isExporting){alert("Export cancelled.");break}const l=i[u];t["export-status"].textContent=`EXPORTING ${u+1}/${i.length}...`;try{let c=e;if(r.keepFolderStructure&&l.relativePath){const d=l.relativePath.split("/").filter(v=>v!=="");for(const v of d)c=await c.getDirectoryHandle(v,{create:!0})}if(r.imageFiles.includes(l)){await j(l),z(!0),J(!0);const d=await new Promise(p=>r.canvas.toBlob(p,"image/png")),v=r.keepFolderStructure?l.name:`${u+1}.png`,_=await(await c.getFileHandle(v,{create:!0})).createWritable();await _.write(d),await _.close()}else if(r.keepFolderStructure){const v=await(await c.getFileHandle(l.name,{create:!0})).createWritable();await v.write(l),await v.close()}}catch(c){console.error(`Error exporting ${l.name}:`,c)}await new Promise(c=>setTimeout(c,10))}r.isExporting&&alert(`Export Complete. Processed ${r.imageFiles.length} images and copied ${r.allFiles.length-r.imageFiles.length} other files.`)}finally{r.isExporting=!1,a.style.display="none",t.stopExportBtn.removeEventListener("click",n),await j(r.imageFiles[o]),r.currentImageIndex=o,Z(),z(!1),L()}}function yr(e){return e?e.startsWith("adj")||e==="brightness"||e==="contrast"||e==="saturationAdj"||e==="warmth"||e==="sharpen"?"adjust":e.startsWith("hdr")?"hdr":e.startsWith("noise")||e==="opacity"||e==="strength"||e==="blendMode"||e.startsWith("sat")||e.startsWith("ignore")?"noise":e.startsWith("blur")?"blur":e.startsWith("dither")?"dither":e.startsWith("cell")?"cell":e.startsWith("halftone")?"halftone":e.startsWith("bilateral")?"bilateral":e.startsWith("aberration")||e.startsWith("ca")?"ca":e.startsWith("corruption")?"corruption":e.startsWith("palette")?"palette":e.startsWith("edge")?"edge":e.startsWith("airyBloom")?"airyBloom":e.startsWith("glareRays")?"glareRays":"adjust":null}function re(){const e=document.getElementById("layer-drag-list");e.innerHTML="";const a=Object.keys(se).filter(n=>n!=="shadows"&&n!=="highlights");a.forEach(n=>{r.renderOrder.includes(n)||(r.renderOrder.push(n),r.layerVisibility[n]===void 0&&(r.layerVisibility[n]=!0))}),r.renderOrder=r.renderOrder.filter(n=>a.includes(n)),r.renderOrder.forEach((n,o)=>{const i=document.createElement("div");i.className="drag-layer",i.draggable=!0,i.dataset.key=n;const u=r.layerVisibility[n]?"checked":"";i.innerHTML=`
            <div style="display:flex; align-items:center;">
                <span class="drag-handle">☰</span> 
                <input type="checkbox" class="drag-toggle" data-key="${n}" ${u}>
            </div>
            <span>${se[n].name}</span>
        `,i.querySelector("input").addEventListener("change",l=>{r.layerVisibility[n]=l.target.checked,L()}),i.addEventListener("dragstart",l=>{l.dataTransfer.setData("text/plain",o),i.classList.add("dragging")}),i.addEventListener("dragend",()=>i.classList.remove("dragging")),i.addEventListener("dragover",l=>l.preventDefault()),i.addEventListener("drop",l=>{l.preventDefault();const c=parseInt(l.dataTransfer.getData("text/plain")),s=o;if(c===s)return;const d=r.renderOrder.splice(c,1)[0];r.renderOrder.splice(s,0,d),re(),_e(),L()}),e.appendChild(i)})}function Z(){const e=document.getElementById("image-navigation"),a=t.imageScrubber;r.isMultiImageMode&&r.imageFiles.length>1?(e.style.display="flex",t.imageCounter.textContent=`Image ${r.currentImageIndex+1} of ${r.imageFiles.length}`,t.downloadBtn.textContent=`DOWNLOAD ALL (${r.imageFiles.length})`,a.max=r.imageFiles.length-1,a.value=r.currentImageIndex,t.downloadCurrentBtn&&(t.downloadCurrentBtn.style.display="block")):(e.style.display="none",t.downloadBtn.textContent="DOWNLOAD FULL RES",t.downloadCurrentBtn&&(t.downloadCurrentBtn.style.display="none")),r.imageFiles.length>1&&(t.prevImageBtn.disabled=r.currentImageIndex===0,t.nextImageBtn.disabled=r.currentImageIndex===r.imageFiles.length-1)}async function Er(){t.loading.style.display="block",await new Promise(u=>setTimeout(u,50)),J(!0);const e=document.getElementById("compareOriginal"),a=document.getElementById("compareProcessed"),n=r.width/r.height;e.width=600,e.height=600/n,a.width=600,a.height=600/n;const o=e.getContext("2d"),i=a.getContext("2d");if(o.drawImage(r.baseImage,0,0,e.width,e.height),i.drawImage(r.canvas,0,0,a.width,a.height),t.exportInfo){const u=Math.round(r.width*r.upscaleFactor),l=Math.round(r.height*r.upscaleFactor),c=r.renderWidth,s=r.renderHeight,d=r._exportScale||1;t.exportInfo.innerHTML=`Requested: ${u}x${l} | Actual: ${c}x${s} (Safe Scale: ${d.toFixed(2)})`,d<1?t.exportInfo.style.color="#ffaa00":t.exportInfo.style.color="#0f0"}document.getElementById("compareModal").classList.add("show"),reallocateBuffers(!1),L(),t.loading.style.display="none"}async function fe(e){t.loading.style.display="block",await new Promise(c=>setTimeout(c,50)),J(!0);const a=r.canvas.toDataURL(),n=new Image;n.src=a,await new Promise(c=>n.onload=c);const o=document.createElement("canvas"),i=r.canvas.width,u=r.canvas.height;if(e==="side"){o.width=i*2,o.height=u;const c=o.getContext("2d");c.drawImage(r.baseImage,0,0,i,u),c.drawImage(n,i,0)}else{o.width=i,o.height=u*2;const c=o.getContext("2d");c.drawImage(r.baseImage,0,0,i,u),c.drawImage(n,0,u)}const l=document.createElement("a");l.download=`grain-compare-${e}.png`,l.href=o.toDataURL("image/png",.9),l.click(),reallocateBuffers(!1),L(),t.loading.style.display="none"}function H(){t.paletteList.innerHTML="",r.palette.forEach((e,a)=>{const n=document.createElement("div");n.className="palette-color-item",n.innerHTML=`
                    <input type="color" value="${e}">
                    <button class="remove-color-btn" title="Remove">&times;</button>
                `,n.querySelector("input").addEventListener("input",o=>{r.palette[a]=o.target.value,L()}),n.querySelector(".remove-color-btn").addEventListener("click",()=>{r.palette.splice(a,1),H(),L()}),t.paletteList.appendChild(n)})}function me(){const e=parseInt(t.noiseType.value),a=document.getElementById("noiseParamsHeader"),n=document.getElementById("noiseParamRowA"),o=document.getElementById("noiseParamRowB"),i=document.getElementById("noiseParamRowC"),u=document.getElementById("noiseLabelA"),l=document.getElementById("noiseLabelB"),c=document.getElementById("noiseLabelC");[a,n,o,i].forEach(d=>d.style.display="none");const s=(d,v,h)=>{a.style.display="block",d&&(n.style.display="flex",u.textContent=d),v&&(o.style.display="flex",l.textContent=v),h&&(i.style.display="flex",c.textContent=h)};switch(e){case 5:s("Complexity","Organic Flow","Octave Mix"),t.noiseParamA.min=1,t.noiseParamA.max=8,t.noiseParamA.step=1,t.noiseParamA.value>8&&(t.noiseParamA.value=4);break;case 6:s("Cell Jitter","Density","Sphericity"),t.noiseParamA.min=0,t.noiseParamA.max=100,t.noiseParamA.step=1;break;case 7:s("Line Thickness","Vertical Jitter","Sync Grain");break;case 8:s("Density","Sharpness","Variable Size");break;case 9:s("Block Size","Horiz Shift","RGB Split");break;case 10:s("Stretch","Rotation","Fiber Link");break;case 11:s("Cell Detail","Randomness","Smoothness");break;case 12:s("Line Density","Diagonal Angle","Pressure");break}}function ie(){const e=r.caCenter.x*100,a=(1-r.caCenter.y)*100;t.caPin.style.left=e+"%",t.caPin.style.top=a+"%"}function _e(e){e||(e=r.activeSection||"adjust");const a=t.layerGrid;if(!a)return;a.innerHTML="";const n=[{id:"chain",label:"Chain"},{id:"isolated",label:"Isolated"}];({blur:!0,dither:!0,halftone:!0,bilateral:!0,adjust:!0,noise:!0})[e]?(n.push({id:"mask_luma",label:"Luma Mask"}),n.push({id:"mask_color",label:"Color Mask"}),n.push({id:"mask_total",label:"Total Mask"})):e==="ca"&&n.push({id:"falloff",label:"Falloff Map"});const i=r.width/r.height,u=110,l=u*i;n.forEach(c=>{const s=document.createElement("div");s.className="layer-item",s.style.minWidth=`${Math.max(80,l)}px`,s.style.flex="0 0 auto";const d=e+"_"+c.id;r.activeLayerPreview===d&&s.classList.add("active"),s.onclick=()=>{const v=e+"_"+c.id;r.activeLayerPreview===v?(r.activeLayerPreview=null,s.classList.remove("active")):(r.activeLayerPreview=v,document.querySelectorAll(".layer-item").forEach(h=>h.classList.remove("active")),s.classList.add("active"),t.overlayOriginal.classList.remove("show")),L()},s.innerHTML=`
            <div class="layer-title">${c.label}</div>
            <canvas class="layer-canvas" id="thumb-${c.id}" width="${Math.round(l)}" height="${u}"></canvas>
        `,a.appendChild(s)})}function Tr(){if(!r.gl||!r.baseImage||!t.histogramCanvas)return;const e=r.gl,a=r.analysisFBO.w,n=r.analysisFBO.h,o=a*n,u=Math.max(1,Math.floor(o/1e4));e.bindFramebuffer(e.FRAMEBUFFER,r.analysisFBO.fbo);const l=new Uint8Array(a*n*4);e.readPixels(0,0,a,n,e.RGBA,e.UNSIGNED_BYTE,l);const c=new Uint32Array(256);let s=0,d=0;const v=u*4;for(let f=0;f<l.length;f+=v){const m=Math.round(l[f]*.2126+l[f+1]*.7152+l[f+2]*.0722);c[m]++,s+=m,d++}const h=d>0?s/d:0;t.avgBrightnessVal&&(t.avgBrightnessVal.textContent=(h/2.55).toFixed(1)+"%"),t.renderResVal&&(t.renderResVal.textContent=`${r.renderWidth}x${r.renderHeight}`);const _=t.histogramCanvas.getContext("2d"),p=t.histogramCanvas.width,g=t.histogramCanvas.height;_.clearRect(0,0,p,g);let b=0;for(let f=0;f<256;f++)c[f]>b&&(b=c[f]);_.fillStyle="#2a9df4",_.beginPath(),_.moveTo(0,g);for(let f=0;f<256;f++){const m=f/255*p,x=c[f]/b*g;_.lineTo(m,g-x)}_.lineTo(p,g),_.fill(),_.strokeStyle="rgba(255,255,255,0.1)",_.beginPath(),_.moveTo(p/2,0),_.lineTo(p/2,g),_.stroke()}function Lr(){if(!r.gl||!r.baseImage||!t.vectorscopeCanvas)return;const e=r.gl,a=r.analysisFBO.w,n=r.analysisFBO.h,o=1e4,i=a*n,l=Math.max(1,Math.floor(i/o))*4;e.bindFramebuffer(e.FRAMEBUFFER,r.analysisFBO.fbo);const c=new Uint8Array(a*n*4);e.readPixels(0,0,a,n,e.RGBA,e.UNSIGNED_BYTE,c);const s=t.vectorscopeCanvas.getContext("2d"),d=t.vectorscopeCanvas.width,v=d/2,h=d/2,_=d/2-5;s.clearRect(0,0,d,d);let p=0,g=0;for(let f=0;f<c.length;f+=l){const m=c[f]/255,x=c[f+1]/255,y=c[f+2]/255,E=Math.max(m,x,y),F=Math.min(m,x,y),R=E-F;let w=0,U=0;if(E>0&&(U=R/E),R>0)switch(E){case m:w=((x-y)/R+(x<y?6:0))/6;break;case x:w=((y-m)/R+2)/6;break;case y:w=((m-x)/R+4)/6;break}if(p+=U,g++,U<.02)continue;const k=w*Math.PI*2-Math.PI/2,B=U*_,C=v+Math.cos(k)*B,S=h+Math.sin(k)*B;s.fillStyle=`rgba(${Math.round(m*255)}, ${Math.round(x*255)}, ${Math.round(y*255)}, 0.4)`,s.fillRect(C-1,S-1,2,2)}s.strokeStyle="rgba(255,255,255,0.2)",s.lineWidth=1,s.beginPath(),s.arc(v,h,_,0,Math.PI*2),s.stroke(),s.beginPath(),s.arc(v,h,_*.5,0,Math.PI*2),s.stroke(),s.beginPath(),s.arc(v,h,_*.25,0,Math.PI*2),s.stroke(),s.beginPath(),s.moveTo(v,0),s.lineTo(v,d),s.moveTo(0,h),s.lineTo(d,h),s.stroke();const b=g>0?p/g*100:0;t.avgSaturationVal&&(t.avgSaturationVal.textContent=b.toFixed(1)+"%")}function J(e=!1){var _,p,g,b,f,m,x,y,E,F,R,w,U,k,B,C,S,G,P,D,X,A,W,N,q,K,Q;if(!r.baseImage)return;if(!e){const I=performance.now();if(r.lastFrameTime>0){const M=I-r.lastFrameTime;r.realtimeFps=1e3/M}r.lastFrameTime=I,r.frameRenderCount++,r.frameRenderCount%15===0&&(t.actualFps.textContent=`(Actual: ${Math.round(r.realtimeFps)} FPS)`)}const a=r.gl,n=z(e),o=n.w,i=n.h;a.viewport(0,0,o,i);let u=0,l=1,c=r.textures.base;if(e&&(o!==r.width||i!==r.height)){const I=document.createElement("canvas");I.width=o,I.height=i,I.getContext("2d").drawImage(r.baseImage,0,0,r.width,r.height,0,0,o,i),c=a.createTexture(),a.bindTexture(a.TEXTURE_2D,c),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_S,a.CLAMP_TO_EDGE),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_T,a.CLAMP_TO_EDGE),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MIN_FILTER,a.LINEAR),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MAG_FILTER,a.LINEAR),a.pixelStorei(a.UNPACK_FLIP_Y_WEBGL,!0),a.texImage2D(a.TEXTURE_2D,0,a.SRGB8_ALPHA8,a.RGBA,a.UNSIGNED_BYTE,I)}a.bindFramebuffer(a.FRAMEBUFFER,r.pingPong[0].fbo),a.useProgram(r.programs.copy),a.uniform1i(a.getUniformLocation(r.programs.copy,"u_channel"),0),a.activeTexture(a.TEXTURE0),a.bindTexture(a.TEXTURE_2D,c),a.uniform1i(a.getUniformLocation(r.programs.copy,"u_tex"),0),a.drawArrays(a.TRIANGLES,0,6),e&&c!==r.textures.base&&a.deleteTexture(c);const s={u_bright:parseFloat(t.brightness.value),u_cont:parseFloat(t.contrast.value),u_sat:parseFloat(t.saturationAdj.value)/100,u_warmth:parseFloat(t.warmth.value),u_sharp:parseFloat(t.sharpen.value),u_sharpThresh:parseFloat(t.sharpenThreshold.value),u_step:[1/o,1/i],u_hdrTol:parseFloat(t.hdrTolerance.value),u_hdrAmt:parseFloat(t.hdrAmount.value),u_ca_amt:te(parseFloat(t.aberrationAmount.value),300,300),u_ca_blur:te(parseFloat(t.aberrationBlur.value),100,100),u_ca_center:[r.caCenter.x,r.caCenter.y],u_ca_rad:parseFloat(t.caRadius.value)/1e3,u_ca_fall:parseFloat(t.caFalloff.value)/1e3,u_airy_intensity:parseFloat(((_=t.airyBloomIntensity)==null?void 0:_.value)??.5),u_airy_aperture:parseFloat(((p=t.airyBloomAperture)==null?void 0:p.value)??3),u_airy_threshold:parseFloat(((g=t.airyBloomThreshold)==null?void 0:g.value)??.7),u_glare_intensity:parseFloat(((b=t.glareRaysIntensity)==null?void 0:b.value)??.4),u_glare_rays:parseFloat(((f=t.glareRaysRays)==null?void 0:f.value)??6),u_glare_length:parseFloat(((m=t.glareRaysLength)==null?void 0:m.value)??.3),u_glare_blur:parseFloat(((x=t.glareRaysBlur)==null?void 0:x.value)??.2),u_hankel_intensity:parseFloat(((y=t.hankelBlurIntensity)==null?void 0:y.value)??.5),u_hankel_radius:parseFloat(((E=t.hankelBlurRadius)==null?void 0:E.value)??5),u_hankel_quality:parseFloat(((F=t.hankelBlurQuality)==null?void 0:F.value)??16),u_vignette_intensity:parseFloat(((R=t.vignetteIntensity)==null?void 0:R.value)??50)/100,u_vignette_radius:parseFloat(((w=t.vignetteRadius)==null?void 0:w.value)??75)/100,u_vignette_softness:parseFloat(((U=t.vignetteSoftness)==null?void 0:U.value)??50)/100,u_vignette_color:Y(((k=t.vignetteColor)==null?void 0:k.value)??"#000000"),u_analog_wobble:parseFloat(((B=t.analogWobble)==null?void 0:B.value)??30)/100,u_analog_bleed:parseFloat(((C=t.analogBleed)==null?void 0:C.value)??50)/100,u_analog_curve:parseFloat(((S=t.analogCurve)==null?void 0:S.value)??20)/100,u_analog_noise:parseFloat(((G=t.analogNoise)==null?void 0:G.value)??40)/100,u_lens_amount:parseFloat(((P=t.lensAmount)==null?void 0:P.value)??0)/100,u_lens_scale:parseFloat(((D=t.lensScale)==null?void 0:D.value)??100)/100,u_heatwave_intensity:parseFloat(((X=t.heatwaveIntensity)==null?void 0:X.value)??30)/100,u_heatwave_speed:parseFloat(((A=t.heatwaveSpeed)==null?void 0:A.value)??50)/100,u_heatwave_scale:parseFloat(((W=t.heatwaveScale)==null?void 0:W.value)??20),u_heatwave_direction:parseInt(((N=t.heatwaveDirection)==null?void 0:N.value)??0),u_lightleaks_intensity:parseFloat(((q=t.lightLeaksIntensity)==null?void 0:q.value)??50)/100,u_lightleaks_color1:Y(((K=t.lightLeaksColor1)==null?void 0:K.value)??"#ff5500"),u_lightleaks_color2:Y(((Q=t.lightLeaksColor2)==null?void 0:Q.value)??"#0055ff"),u_time:performance.now()%1e5/1e3};r.renderOrder.forEach(I=>{const ne=(I==="adjust"?"adj":I)+"Enable";if(!(!r.layerVisibility[I]||t[ne]&&!t[ne].checked))try{ee[I]&&ee[I].render(a,r.pingPong[u].tex,r.pingPong[l].fbo,s),r.layerTextures[I]=r.pingPong[l].tex,r.activeSection&&I===r.activeSection&&r.fbos.chainCapture&&(a.bindFramebuffer(a.FRAMEBUFFER,r.fbos.chainCapture),a.useProgram(r.programs.copy),a.activeTexture(a.TEXTURE0),a.bindTexture(a.TEXTURE_2D,r.pingPong[l].tex),a.uniform1i(a.getUniformLocation(r.programs.copy,"u_tex"),0),a.uniform1i(a.getUniformLocation(r.programs.copy,"u_channel"),0),a.drawArrays(a.TRIANGLES,0,6));let ae=u;u=l,l=ae}catch(ae){console.error(`Error rendering layer ${I}:`,ae)}}),a.bindFramebuffer(a.FRAMEBUFFER,null),(a.canvas.width!==o||a.canvas.height!==i)&&(a.canvas.width=o,a.canvas.height=i),a.viewport(0,0,o,i);const d=r.activeLayerPreview&&r.layerTextures[r.activeLayerPreview]?r.layerTextures[r.activeLayerPreview]:r.pingPong[u].tex;let v=0;r.activeLayerPreview==="shadows"&&(v=2),r.activeLayerPreview==="highlights"&&(v=3),v===0?(a.useProgram(r.programs.final),a.activeTexture(a.TEXTURE0),a.bindTexture(a.TEXTURE_2D,d),a.uniform1i(a.getUniformLocation(r.programs.final,"u_tex"),0),a.uniform2f(a.getUniformLocation(r.programs.final,"u_res"),o,i)):(a.useProgram(r.programs.copy),a.activeTexture(a.TEXTURE0),a.bindTexture(a.TEXTURE_2D,d),a.uniform1i(a.getUniformLocation(r.programs.copy,"u_tex"),0),a.uniform1i(a.getUniformLocation(r.programs.copy,"u_channel"),v)),a.drawArrays(a.TRIANGLES,0,6);const h=document.querySelector(".info-details");if(h&&h.open&&(a.bindFramebuffer(a.FRAMEBUFFER,r.analysisFBO.fbo),a.viewport(0,0,r.analysisFBO.w,r.analysisFBO.h),a.useProgram(r.programs.copy),a.activeTexture(a.TEXTURE0),a.bindTexture(a.TEXTURE_2D,d),a.uniform1i(a.getUniformLocation(r.programs.copy,"u_tex"),0),a.uniform1i(a.getUniformLocation(r.programs.copy,"u_channel"),0),a.drawArrays(a.TRIANGLES,0,6)),e)a.finish();else{if(t.layerGrid&&t.layerGrid.offsetHeight>0)try{Rr()}catch(M){console.error("Error in updateLayerPreviews:",M)}const I=document.querySelector(".info-details");if(I&&I.open&&(Tr(),Lr()),a.bindFramebuffer(a.FRAMEBUFFER,null),r.previewWindow&&!r.previewWindow.closed)try{const M=r.previewWindow.document.getElementById("fs-canvas");M?((M.width!==o||M.height!==i)&&(M.width=o,M.height=i),M.getContext("2d").drawImage(a.canvas,0,0)):r.previewWindow=null}catch(M){r.previewWindow=null,console.warn("Preview sync error:",M)}}}function te(e,a,n=1){const o=e/a;return o*o*n}function Rr(){var v,h,_,p,g,b,f;const e=r.gl;if(!r.baseImage)return;const a=r.activeSection||"adjust";if(r.lastActiveSectionDOM!==a&&(_e(a),r.lastActiveSectionDOM=a),!r.thumbnailFBO)return;const n=r.textures.chainCapture?r.textures.chainCapture:r.layerTextures[a];$(n,"thumb-chain");const o=r.renderOrder.indexOf(a),i=o>0?r.layerTextures[r.renderOrder[o-1]]:r.textures.base,u={u_bright:parseFloat(t.brightness.value),u_cont:parseFloat(t.contrast.value),u_sat:parseFloat(t.saturationAdj.value)/100,u_warmth:parseFloat(t.warmth.value),u_sharp:parseFloat(t.sharpen.value),u_sharpThresh:parseFloat(t.sharpenThreshold.value),u_step:[1/r.renderWidth,1/r.renderHeight],u_hdrTol:parseFloat(t.hdrTolerance.value),u_hdrAmt:parseFloat(t.hdrAmount.value),u_ca_amt:te(parseFloat(t.aberrationAmount.value),300,300),u_ca_blur:te(parseFloat(t.aberrationBlur.value),100,100),u_ca_center:[r.caCenter.x,r.caCenter.y],u_ca_rad:parseFloat(t.caRadius.value)/1e3,u_ca_fall:parseFloat(t.caFalloff.value)/1e3,u_airy_intensity:parseFloat(((v=t.airyBloomIntensity)==null?void 0:v.value)??.5),u_airy_aperture:parseFloat(((h=t.airyBloomAperture)==null?void 0:h.value)??3),u_airy_threshold:parseFloat(((_=t.airyBloomThreshold)==null?void 0:_.value)??.7),u_glare_intensity:parseFloat(((p=t.glareRaysIntensity)==null?void 0:p.value)??.4),u_glare_rays:parseFloat(((g=t.glareRaysRays)==null?void 0:g.value)??6),u_glare_length:parseFloat(((b=t.glareRaysLength)==null?void 0:b.value)??.3),u_glare_blur:parseFloat(((f=t.glareRaysBlur)==null?void 0:f.value)??.2)};ee[a]&&ee[a].render(e,i,r.fbos.preview,u,!0),$(r.textures.preview,"thumb-isolated"),r.activeLayerPreview===a+"_isolated"&&(r.layerTextures[r.activeLayerPreview]=r.textures.preview);const l=document.getElementById("thumb-mask_luma"),c=document.getElementById("thumb-mask_color"),s=document.getElementById("thumb-mask_total");(l||c||s)&&(V(a,i),l&&($(r.textures.maskLuma,"thumb-mask_luma",1),r.activeLayerPreview===a+"_mask_luma"&&(r.layerTextures[r.activeLayerPreview]=r.textures.maskLuma)),c&&($(r.textures.maskColor,"thumb-mask_color",0),r.activeLayerPreview===a+"_mask_color"&&(r.layerTextures[r.activeLayerPreview]=r.textures.maskColor)),s&&($(r.textures.maskTotal,"thumb-mask_total",0),r.activeLayerPreview===a+"_mask_total"&&(r.layerTextures[r.activeLayerPreview]=r.textures.maskTotal))),document.getElementById("thumb-falloff")&&(Fr(),$(r.textures.preview,"thumb-falloff"),r.activeLayerPreview===a+"_falloff"&&(r.layerTextures[r.activeLayerPreview]=r.textures.preview))}function L(){!r._renderRequested&&r.baseImage&&(r._renderRequested=!0,requestAnimationFrame(()=>{J(),r._renderRequested=!1}))}function $(e,a,n=0){const o=document.getElementById(a);if(!o||!e)return;const i=r.gl,u=o.width,l=o.height,c=r.thumbnailFBO.w,s=r.thumbnailFBO.h;i.bindFramebuffer(i.FRAMEBUFFER,r.thumbnailFBO.fbo),i.viewport(0,0,c,s),i.useProgram(r.programs.copy),i.activeTexture(i.TEXTURE0),i.bindTexture(i.TEXTURE_2D,e),i.uniform1i(i.getUniformLocation(r.programs.copy,"u_tex"),0),i.uniform1i(i.getUniformLocation(r.programs.copy,"u_channel"),n),i.drawArrays(i.TRIANGLES,0,6);const d=r.thumbPixelBuffer;i.readPixels(0,0,c,s,i.RGBA,i.UNSIGNED_BYTE,d);const v=r.thumbClampedBuffer;for(let p=0;p<s;p++){const g=(s-1-p)*c*4,b=p*c*4;v.set(d.subarray(g,g+c*4),b)}const h=new ImageData(v,c,s);r.thumbTempCtx.putImageData(h,0,0),o.getContext("2d",{alpha:!1}).drawImage(r.thumbTempCanvas,0,0,c,s,0,0,u,l)}function V(e,a){var s,d,v,h,_,p,g,b,f,m,x,y,E,F,R,w,U,k,B,C;const n=r.gl,o=r.renderWidth,i=r.renderHeight;n.viewport(0,0,o,i),r.textures.maskLuma||(r.textures.maskLuma=O(n,null,o,i),r.fbos.maskLuma=n.createFramebuffer(),n.bindFramebuffer(n.FRAMEBUFFER,r.fbos.maskLuma),n.framebufferTexture2D(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,r.textures.maskLuma,0),r.textures.maskColor=O(n,null,o,i),r.fbos.maskColor=n.createFramebuffer(),n.bindFramebuffer(n.FRAMEBUFFER,r.fbos.maskColor),n.framebufferTexture2D(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,r.textures.maskColor,0),r.textures.maskTotal=O(n,null,o,i),r.fbos.maskTotal=n.createFramebuffer(),n.bindFramebuffer(n.FRAMEBUFFER,r.fbos.maskTotal),n.framebufferTexture2D(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,r.textures.maskTotal,0));let u=e==="adjust"?"adj":e;n.bindFramebuffer(n.FRAMEBUFFER,r.fbos.maskLuma),n.useProgram(r.programs.mask),n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,a),n.uniform1i(n.getUniformLocation(r.programs.mask,"u_tex"),0),n.uniform1i(n.getUniformLocation(r.programs.mask,"u_useS"),1),n.uniform1f(n.getUniformLocation(r.programs.mask,"u_sth"),parseFloat(((s=t[u+"ShadowThreshold"])==null?void 0:s.value)||((d=t.shadowThreshold)==null?void 0:d.value)||0)),n.uniform1f(n.getUniformLocation(r.programs.mask,"u_sfa"),parseFloat(((v=t[u+"ShadowFade"])==null?void 0:v.value)||((h=t.shadowFade)==null?void 0:h.value)||0)),n.uniform1i(n.getUniformLocation(r.programs.mask,"u_useH"),1),n.uniform1f(n.getUniformLocation(r.programs.mask,"u_hth"),parseFloat(((_=t[u+"HighlightThreshold"])==null?void 0:_.value)||((p=t.highlightThreshold)==null?void 0:p.value)||1)),n.uniform1f(n.getUniformLocation(r.programs.mask,"u_hfa"),parseFloat(((g=t[u+"HighlightFade"])==null?void 0:g.value)||((b=t.highlightFade)==null?void 0:b.value)||0)),n.drawArrays(n.TRIANGLES,0,6),n.bindFramebuffer(n.FRAMEBUFFER,r.fbos.maskColor);const l=((f=t[u+"ExcludeColor"])==null?void 0:f.value)||((m=t.noiseExcludeColor)==null?void 0:m.value)||"#000000",c=Y(l);n.useProgram(r.programs.colorMask),n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,a),n.uniform1i(n.getUniformLocation(r.programs.colorMask,"u_tex"),0),n.uniform3f(n.getUniformLocation(r.programs.colorMask,"u_targetColor"),c.r,c.g,c.b),n.uniform1f(n.getUniformLocation(r.programs.colorMask,"u_tolerance"),parseFloat(((x=t[u+"ColorTolerance"])==null?void 0:x.value)||((y=t.noiseColorTolerance)==null?void 0:y.value)||.1)/100),n.uniform1f(n.getUniformLocation(r.programs.colorMask,"u_fade"),parseFloat(((E=t[u+"ColorFade"])==null?void 0:E.value)||((F=t.noiseColorFade)==null?void 0:F.value)||0)/100),n.drawArrays(n.TRIANGLES,0,6),n.bindFramebuffer(n.FRAMEBUFFER,r.fbos.maskTotal),n.clearColor(1,1,1,1),n.clear(n.COLOR_BUFFER_BIT),n.enable(n.BLEND),n.blendFunc(n.DST_COLOR,n.ZERO),((R=t[u+"LumaMask"])!=null&&R.checked||(w=t.noiseLumaMask)!=null&&w.checked)&&(n.useProgram(r.programs.copy),n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,r.textures.maskLuma),n.uniform1i(n.getUniformLocation(r.programs.copy,"u_tex"),0),n.uniform1i(n.getUniformLocation(r.programs.copy,"u_channel"),1),n.drawArrays(n.TRIANGLES,0,6)),((U=t[u+"ColorExclude"])!=null&&U.checked||(k=t.noiseColorExclude)!=null&&k.checked)&&(n.useProgram(r.programs.copy),n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,r.textures.maskColor),n.uniform1i(n.getUniformLocation(r.programs.copy,"u_tex"),0),n.uniform1i(n.getUniformLocation(r.programs.copy,"u_channel"),0),n.drawArrays(n.TRIANGLES,0,6)),n.disable(n.BLEND),((B=t[u+"InvertMask"])!=null&&B.checked||(C=t.noiseInvertMask)!=null&&C.checked)&&(n.useProgram(r.programs.invert),n.bindFramebuffer(n.FRAMEBUFFER,r.fbos.preview),n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,r.textures.maskTotal),n.uniform1i(n.getUniformLocation(r.programs.invert,"u_tex"),0),n.drawArrays(n.TRIANGLES,0,6),n.bindFramebuffer(n.FRAMEBUFFER,r.fbos.maskTotal),n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,r.textures.preview),n.useProgram(r.programs.copy),n.uniform1i(n.getUniformLocation(r.programs.copy,"u_tex"),0),n.drawArrays(n.TRIANGLES,0,6))}function Fr(){const e=r.gl,a=r.renderWidth,n=r.renderHeight;e.viewport(0,0,a,n),e.bindFramebuffer(e.FRAMEBUFFER,r.fbos.preview),e.useProgram(r.programs.radial),e.uniform2f(e.getUniformLocation(r.programs.radial,"u_res"),a,n),e.uniform2f(e.getUniformLocation(r.programs.radial,"u_center"),r.caCenter.x,r.caCenter.y),e.uniform1f(e.getUniformLocation(r.programs.radial,"u_radius"),parseFloat(t.caRadius.value)/1e3),e.uniform1f(e.getUniformLocation(r.programs.radial,"u_falloff"),parseFloat(t.caFalloff.value)/1e3),e.drawArrays(e.TRIANGLES,0,6)}function Ur(){var l;const e={metadata:{version:oe,timestamp:new Date().toISOString(),source:"Noise Studio"},values:{},checks:{},selects:{},renderOrder:r.renderOrder,layerVisibility:r.layerVisibility,upscaleFactor:r.upscaleFactor,caCenter:r.caCenter,palette:r.palette,imageData:null};document.querySelectorAll("input[type=range]").forEach(c=>e.values[c.id]=c.value),document.querySelectorAll("input[type=checkbox]").forEach(c=>{!c.id.startsWith("drag-")&&c.id!=="jsonIncludeImage"&&c.id!=="previewLock"&&(e.checks[c.id]=c.checked)}),document.querySelectorAll("select").forEach(c=>{c.id!=="jsonImportMode"&&(e.selects[c.id]=c.value)});const a=(l=t.jsonIncludeImage)==null?void 0:l.checked;if(r.baseImage&&a)try{const c=document.createElement("canvas");c.width=r.baseImage.width,c.height=r.baseImage.height,c.getContext("2d").drawImage(r.baseImage,0,0),e.imageData=c.toDataURL("image/png")}catch(c){console.warn("Could not save image data (likely tainted canvas or too large):",c)}let n="grain-settings.json";r.isMultiImageMode&&r.imageFiles[r.currentImageIndex]?n=`${r.imageFiles[r.currentImageIndex].name.replace(/\.[^/.]+$/,"")}-preset.json`:r.baseImage&&r.imageFiles[0]&&(n=`${r.imageFiles[0].name.replace(/\.[^/.]+$/,"")}-preset.json`);const o=new Blob([JSON.stringify(e,null,2)],{type:"application/json"}),i=URL.createObjectURL(o),u=document.createElement("a");u.href=i,u.download=n,u.click(),URL.revokeObjectURL(i)}function wr(e){const a=e.target.files[0];if(!a)return;const n=new FileReader;n.onload=o=>{var i;try{const u=JSON.parse(o.target.result);if(!u||typeof u!="object")throw new Error("Invalid JSON format.");const l=document.getElementById("jsonImportMode").value,c=(l==="both"||l==="image")&&u.imageData,s=l==="both"||l==="settings";if(c){const d=new Image;d.onload=()=>{var v;pe(d),s&&(de(u),console.log(`Preset loaded successfully (Version: ${((v=u.metadata)==null?void 0:v.version)||"Unknown"})`))},d.onerror=()=>alert("Error loading image data from JSON."),d.src=u.imageData}else s&&(de(u),console.log(`Settings loaded successfully (Version: ${((i=u.metadata)==null?void 0:i.version)||"Unknown"})`))}catch(u){console.error("Preset upload failed:",u),alert("Error loading JSON: "+u.message)}e.target.value=""},n.readAsText(a)}function de(e){e.metadata&&e.metadata.version!==oe&&console.warn(`Version mismatch: Preset is ${e.metadata.version}, App is ${oe}. Attempting to restore anyway.`),e.values&&Object.keys(e.values).forEach(a=>{const n=document.getElementById(a);n&&(n.value=e.values[a],n.nextElementSibling&&n.nextElementSibling.classList.contains("control-value")&&(n.nextElementSibling.value=e.values[a]),n.dispatchEvent(new Event("input")),n.dispatchEvent(new Event("change")))}),e.checks&&Object.keys(e.checks).forEach(a=>{const n=document.getElementById(a);n&&(n.checked=e.checks[a],n.dispatchEvent(new Event("change")))}),e.selects&&Object.keys(e.selects).forEach(a=>{const n=document.getElementById(a);n&&(n.value=e.selects[a],n.dispatchEvent(new Event("change")))}),e.renderOrder&&(r.renderOrder=e.renderOrder,re()),e.layerVisibility&&(r.layerVisibility=e.layerVisibility,re()),e.upscaleFactor&&(r.upscaleFactor=e.upscaleFactor,t.upscaleInput&&(t.upscaleInput.value=e.upscaleFactor)),e.caCenter&&(r.caCenter=e.caCenter,ie()),e.palette&&(r.palette=e.palette,H()),L()}function kr(){const e=new Worker(new URL("/assets/paletteWorker-B5fc2YC1.js",import.meta.url),{type:"module"});e.onmessage=f=>{f.data.palette&&(r.palette=f.data.palette,H(),L())};const a=(f,m)=>{const x=document.createElement("canvas"),y=x.getContext("2d"),E=128;x.width=E,x.height=E,y.drawImage(f,0,0,E,E);const F=y.getImageData(0,0,E,E).data;e.postMessage({data:F,count:m})};document.querySelectorAll(".tab-btn").forEach(f=>{f.addEventListener("click",m=>{document.querySelectorAll(".tab-btn").forEach(x=>x.classList.remove("active")),document.querySelectorAll(".tab-content").forEach(x=>x.classList.remove("active")),m.target.classList.add("active"),document.getElementById(m.target.dataset.tab).classList.add("active")})}),document.querySelectorAll("#tab-controls details").forEach(f=>{f.addEventListener("toggle",m=>{if(f.open){const x=f.querySelector("input, select");if(x){const y=yr(x.id);y&&(r.activeSection=y,L())}}})}),re(),document.querySelectorAll("input[type=range]").forEach(f=>{const m=f.nextElementSibling;if(m&&m.classList.contains("control-value")){const x=()=>m.value=f.value;f.addEventListener("input",()=>{x(),L()}),x()}}),t.hoverZoomValue&&t.hoverZoomValue.addEventListener("input",f=>{const m=parseFloat(f.target.value);isNaN(m)||(r.zoomLevel=m),L()}),document.querySelectorAll("select, input[type=checkbox], input[type=color]").forEach(f=>{f.addEventListener("change",()=>{f.id==="clampPreviewToggle"&&(r.clampPreview=!f.checked,z(r.isZooming)),L()}),f.addEventListener("input",L)}),t.edgeMode.addEventListener("change",()=>{t.edgeSatControls.style.display=t.edgeMode.value==="1"?"block":"none"}),t.edgeMode.dispatchEvent(new Event("change"));const n=()=>"#"+Math.floor(Math.random()*16777215).toString(16).padStart(6,"0");t.addPaletteColor.addEventListener("click",()=>{r.palette.push(n()),H(),L()});const o=document.createElement("input");o.id="pickPaletteColor",o.type="color",o.style.display="none",document.body.appendChild(o),t.pickPaletteColorInput=o,o.addEventListener("change",f=>{r.palette.push(f.target.value),H(),L()}),t.clearPalette.addEventListener("click",()=>{r.palette=[],H(),L()}),t.randomPalette.addEventListener("click",()=>{const f=r.palette.length;if(f===0){const m=Math.floor(Math.random()*5)+3,x=new Set;for(;x.size<m;)x.add(n());r.palette=Array.from(x)}else for(let m=0;m<f;m++)r.palette[m]=n();H(),L()}),t.extractPalette.addEventListener("click",()=>t.paletteImageUpload.click()),t.paletteImageUpload.addEventListener("change",f=>{const m=f.target.files[0];if(!m)return;const x=new FileReader;x.onload=y=>{const E=new Image;E.onload=()=>{var R;r.lastExtractionImage=E;const F=parseInt(((R=t.extractCount)==null?void 0:R.value)||8);a(E,F)},E.src=y.target.result},x.readAsDataURL(m)}),t.extractCount.addEventListener("input",()=>{if(r.lastExtractionImage){const f=parseInt(t.extractCount.value);a(r.lastExtractionImage,f)}}),t.previewLock.addEventListener("change",f=>{r.isPreviewLocked=f.target.checked,r.isPreviewLocked&&t.overlayOriginal.classList.remove("show")}),t.upscaleInput.addEventListener("change",f=>{let m=parseInt(f.target.value);(isNaN(m)||m<1)&&(m=1),m>10&&(m=10),f.target.value=m,r.upscaleFactor=m,r.baseImage&&(z(!1),L())}),t.resetCenterBtn.addEventListener("click",()=>{r.caCenter={x:.5,y:.5},ie(),L()}),t.caPin.addEventListener("mousedown",f=>{r.isDraggingPin=!0,r.isPreviewLocked||t.overlayOriginal.classList.remove("show"),clearTimeout(r.pinIdleTimer),f.preventDefault()}),window.addEventListener("mouseup",()=>{r.isDraggingPin&&(r.isDraggingPin=!1,r.isPreviewLocked||(r.pinIdleTimer=setTimeout(()=>{t.overlayOriginal.classList.add("show")},4e3)))}),window.addEventListener("mousemove",f=>{if(!r.isDraggingPin)return;const m=t.previewContainer.getBoundingClientRect();let x=(f.clientX-m.left)/m.width,y=1-(f.clientY-m.top)/m.height;x=Math.max(0,Math.min(1,x)),y=Math.max(0,Math.min(1,y)),r.caCenter={x,y},ie(),L()});let i;const u=t.previewContainer,l=t.displayCanvas,c=f=>{let m=parseFloat(f);return isNaN(m)?1:m};t.lensToggleBtn.addEventListener("click",()=>{r.isLensMode=!r.isLensMode,t.lensToggleBtn.textContent=r.isLensMode?"LENS":"FULL",t.lensToggleBtn.style.background=r.isLensMode?"var(--accent)":"",t.lensToggleBtn.style.color=r.isLensMode?"#000":"",v()});const s=180;t.lensCanvas.width=s,t.lensCanvas.height=s;const d=t.lensCanvas.getContext("2d"),v=(f=!1)=>{r.isZoomLocked&&!f||(l.style.transform="",l.style.transformOrigin="",l.style.zIndex="",t.zoomResIndicator.style.display="none",t.zoomLens&&(t.zoomLens.style.display="none"),r.isZooming&&(r.isZooming=!1,r.clampPreview&&(z(!1),L())))},h=f=>{const m=t.hoverZoomSlider,x=c(m.value);if(x<=1){v();return}t.overlayOriginal.classList.remove("show"),r.isZooming||(r.isZooming=!0,z(!0),L());const y=u.getBoundingClientRect();!r.isZoomLocked&&f&&(r.lastMousePos={x:f.clientX,y:f.clientY});const E=r.lastMousePos.x-y.left,F=r.lastMousePos.y-y.top;if(E/y.width,F/y.height,r.isLensMode){l.style.transform="",l.style.transformOrigin="",l.style.zIndex="",t.zoomLens&&(t.zoomLens.style.display="block",t.zoomLens.style.left=E-s/2+"px",t.zoomLens.style.top=F-s/2+"px");const S=l.width/l.height,G=y.width/y.height;let P,D,X,A;S>G?(P=y.width,D=y.width/S,X=0,A=(y.height-D)/2):(D=y.height,P=y.height*S,X=(y.width-P)/2,A=0);const W=(E-X)/P*l.width,N=(F-A)/D*l.height,q=s/x,K=W-q/2,Q=N-q/2;d&&(d.clearRect(0,0,s,s),d.drawImage(l,Math.max(0,Math.min(K,l.width-q)),Math.max(0,Math.min(Q,l.height-q)),q,q,0,0,s,s))}else{t.zoomLens&&(t.zoomLens.style.display="none"),l.style.zIndex="15";const S=l.width/l.height,G=y.width/y.height;let P=0,D=0,X=y.width,A=y.height;S>G?(A=y.width/S,D=(y.height-A)/2):(X=y.height*S,P=(y.width-X)/2);const W=(E-P)/X,N=(F-D)/A;l.style.transformOrigin=`${W*100}% ${N*100}%`,l.style.transform=`scale(${x})`}const R=r.width*r.upscaleFactor,w=r.height*r.upscaleFactor,U=l.width,k=l.height,B=U>=R&&k>=w?"✓ FULL RES":"⚠ SCALED",C=r.isLensMode?"LENS":"FULL";t.zoomResIndicator.innerHTML=`Mode: ${C}<br>Source: ${R}×${w}<br>Canvas: ${U}×${k}<br>${B}`,t.zoomResIndicator.style.display="block",t.zoomResIndicator.style.color=U>=R&&k>=w?"#0f0":"#f80",t.zoomResIndicator.style.borderColor=U>=R&&k>=w?"#0f0":"#f80"};u.addEventListener("mouseenter",f=>{parseFloat(t.hoverZoomSlider.value)<=1&&!r.isPreviewLocked&&!r.activeLayerPreview&&t.overlayOriginal.classList.add("show"),clearTimeout(i),h(f)}),u.addEventListener("mouseleave",f=>{t.overlayOriginal.classList.remove("show"),clearTimeout(i),r.isZoomLocked||v()}),u.addEventListener("wheel",f=>{if(f.ctrlKey||f.metaKey){f.preventDefault();const m=t.blendMode,x=m.options.length;let y=m.selectedIndex;const E=Math.sign(f.deltaY);y=(y+E+x)%x,m.selectedIndex=y,L()}else{f.preventDefault();let m=parseFloat(t.hoverZoomSlider.value);const x=-Math.sign(f.deltaY);m+=x*.5,m=Math.max(1,Math.min(8,m)),t.hoverZoomSlider.value=m,t.hoverZoomSlider.dispatchEvent(new Event("input")),h(f)}},{passive:!1}),u.addEventListener("mousemove",f=>{clearTimeout(i);const m=parseFloat(t.hoverZoomSlider.value);!r.isPreviewLocked&&!r.activeLayerPreview&&m<=1&&t.overlayOriginal.classList.add("show"),h(f)}),window.addEventListener("keydown",f=>{if(f.key==="Tab"){const m=t.previewContainer.matches(":hover");(m||r.isZoomLocked)&&(f.preventDefault(),r.isZoomLocked=!r.isZoomLocked,!r.isZoomLocked&&!m?v(!0):r.isZoomLocked&&h())}}),t.downloadJsonBtn.addEventListener("click",Ur),t.uploadJsonTrigger.addEventListener("click",()=>t.jsonUpload.click()),t.jsonUpload.addEventListener("change",wr),ve(),t.imageUpload.addEventListener("change",f=>{const m=f.target.files[0];m&&(r.isMultiImageMode=!1,r.imageFiles=[m],r.currentImageIndex=0,j(m).then(Z))}),t.loadFolderBtn.addEventListener("click",gr),t.prevImageBtn.addEventListener("click",()=>ce(-1)),t.nextImageBtn.addEventListener("click",()=>ce(1)),t.imageScrubber.addEventListener("input",f=>{const m=parseInt(f.target.value,10);m!==r.currentImageIndex&&(r.currentImageIndex=m,requestAnimationFrame(()=>{j(r.imageFiles[r.currentImageIndex]).then(Z)}))});const _=()=>{r.playInterval&&clearInterval(r.playInterval),r.isPlaying=!0,t.playBtn.textContent="STOP ■";const f=parseInt(t.playFps.value,10)||10;r.playInterval=setInterval(()=>{let m=(r.currentImageIndex+1)%r.imageFiles.length;r.currentImageIndex=m,j(r.imageFiles[r.currentImageIndex]),Z()},1e3/f)},p=()=>{r.playInterval&&(clearInterval(r.playInterval),r.playInterval=null),r.isPlaying=!1,t.playBtn.textContent="PLAY ►"};t.playBtn.addEventListener("click",()=>{r.isPlaying?p():_()}),t.keepFolderStructureToggle.addEventListener("change",f=>{r.keepFolderStructure=f.target.checked}),t.downloadBtn.addEventListener("click",()=>{r.isMultiImageMode&&r.imageFiles.length>1?br():le()}),t.downloadCurrentBtn=document.getElementById("downloadCurrentBtn"),t.compareBtn.addEventListener("click",Er),t.downloadCurrentBtn.addEventListener("click",le),t.closeCompare.addEventListener("click",()=>document.getElementById("compareModal").classList.remove("show")),t.exportSideBySide.addEventListener("click",()=>fe("side")),t.exportStacked.addEventListener("click",()=>fe("stack")),t.noiseType.addEventListener("change",me),me();const g=document.createElement("style");g.textContent=`
                    .eyedropper-btn { background: none; border: none; cursor: pointer; font-size: 1.2em; padding: 0 5px; opacity: 0.7; transition: opacity 0.2s; }
                    .eyedropper-btn:hover { opacity: 1; }
                    .eyedropper-active { cursor: crosshair !important; }
                `,document.head.appendChild(g);let b=null;document.querySelectorAll(".eyedropper-btn").forEach(f=>{f.addEventListener("click",m=>{const x=m.target.dataset.target;b===x?(b=null,t.displayCanvas.classList.remove("eyedropper-active")):(b=x,t.displayCanvas.classList.add("eyedropper-active")),m.stopPropagation()})}),t.displayCanvas.addEventListener("click",f=>{if(!b)return;const m=t.displayCanvas.getBoundingClientRect(),x=f.clientX-m.left,y=f.clientY-m.top,E=r.gl,F=t.displayCanvas;F.width,F.height;const R=r.width/r.height,w=m.width/m.height;let U,k,B,C;if(R>w?(U=m.width,k=m.width/R,B=0,C=(m.height-k)/2):(k=m.height,U=m.height*R,B=(m.width-U)/2,C=0),x<B||x>B+U||y<C||y>C+k)return;const S=(x-B)/U,G=(y-C)/k,P=E.createFramebuffer();E.bindFramebuffer(E.FRAMEBUFFER,P),E.framebufferTexture2D(E.FRAMEBUFFER,E.COLOR_ATTACHMENT0,E.TEXTURE_2D,r.textures.base,0);const D=Math.floor(S*r.width),X=Math.floor((1-G)*r.height),A=new Uint8Array(4);E.readPixels(D,X,1,1,E.RGBA,E.UNSIGNED_BYTE,A),E.bindFramebuffer(E.FRAMEBUFFER,null),E.deleteFramebuffer(P);const W="#"+((1<<24)+(A[0]<<16)+(A[1]<<8)+A[2]).toString(16).slice(1),N=document.getElementById(b);N&&(N.value=W,N.dispatchEvent(new Event("input")),N.dispatchEvent(new Event("change"))),b=null,t.displayCanvas.classList.remove("eyedropper-active")}),window.addEventListener("keydown",f=>{f.key==="Escape"&&b&&(b=null,t.displayCanvas.classList.remove("eyedropper-active"))})}document.addEventListener("DOMContentLoaded",()=>{he(),kr()});
