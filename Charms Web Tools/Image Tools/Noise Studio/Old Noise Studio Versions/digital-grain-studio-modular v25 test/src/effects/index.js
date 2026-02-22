import { adjustEffect } from './adjust.js';
import { hdrEffect } from './hdr.js';
import { noiseEffect } from './noise.js';
import { caEffect } from './ca.js';
import { blurEffect } from './blur.js';
import { cellEffect } from './cell.js';
import { halftoneEffect } from './halftone.js';
import { bilateralEffect } from './bilateral.js';
import { denoiseEffect } from './denoise.js';
import { ditherEffect } from './dither.js';
import { corruptionEffect } from './corruption.js';
import { analogVideoEffect } from './analogVideo.js';
import { lensDistortEffect } from './lensDistort.js';
import { lightLeaksEffect } from './lightLeaks.js';
import { heatwaveEffect } from './heatwave.js';
import { compressionEffect } from './compression.js';
import { paletteEffect } from './palette.js';
import { edgeEffect } from './edge.js';
import { airyBloomEffect } from './airyBloom.js';
import { vignetteEffect } from './vignette.js';
import { glareRaysEffect } from './glareRays.js';
import { hankelBlurEffect } from './hankelBlur.js';

export const effectsRegistry = {
    'adjust': adjustEffect,
    'hdr': hdrEffect,
    'noise': noiseEffect,
    'ca': caEffect,
    'blur': blurEffect,
    'cell': cellEffect,
    'halftone': halftoneEffect,
    'bilateral': bilateralEffect,
    'denoise': denoiseEffect,
    'dither': ditherEffect,
    'corruption': corruptionEffect,
    'analogVideo': analogVideoEffect,
    'lensDistort': lensDistortEffect,
    'lightLeaks': lightLeaksEffect,
    'heatwave': heatwaveEffect,
    'compression': compressionEffect,
    'palette': paletteEffect,
    'edge': edgeEffect,
    'airyBloom': airyBloomEffect,
    'vignette': vignetteEffect,
    'glareRays': glareRaysEffect,
    'hankelBlur': hankelBlurEffect,
};
