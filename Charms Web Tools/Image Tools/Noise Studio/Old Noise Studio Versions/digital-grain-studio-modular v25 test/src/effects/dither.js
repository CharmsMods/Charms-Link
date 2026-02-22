import { state, UI } from '../state/store.js';
import { renderMaskForSection, requestRender } from '../webgl/pipeline.js';
import { hexToRgb } from '../webgl/core.js';

export const ditherEffect = {
    id: 'dither',
    render: (gl, inputTex, outputFbo, uniforms, force = false) => {
        const w = state.renderWidth;
        const h = state.renderHeight;

        // [TOOL: DITHERING] Bit-depth Reduction
        if (!UI.ditherEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }

        const maskTex = renderMaskForSection('dither', inputTex);
        const prog = maskTex ? state.programs.maskedDither : state.programs.dither;
        gl.useProgram(prog);

        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
        gl.uniform1i(gl.getUniformLocation(prog, 'u_type'), parseInt(UI.ditherType?.value || 0));
        gl.uniform1f(gl.getUniformLocation(prog, 'u_bitDepth'), parseFloat(UI.ditherBitDepth.value));
        gl.uniform1f(gl.getUniformLocation(prog, 'u_strength'), parseFloat(UI.ditherStrength.value) / 100.0);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_scale'), parseFloat(UI.ditherScale.value));
        gl.uniform2f(gl.getUniformLocation(prog, 'u_res'), w, h);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_seed'), Math.random() * 100.0);
        gl.uniform1i(gl.getUniformLocation(prog, 'u_gamma'), UI.ditherGamma?.checked ? 1 : 0);

        const usePalette = UI.ditherUsePalette?.checked ? 1 : 0;
        gl.uniform1i(gl.getUniformLocation(prog, 'u_usePalette'), usePalette);

        if (usePalette) {
            const paletteRgb = state.palette.map(hexToRgb);
            const flatPalette = new Float32Array(256 * 3);
            paletteRgb.forEach((rgb, i) => {
                flatPalette[i * 3] = rgb[0] / 255;
                flatPalette[i * 3 + 1] = rgb[1] / 255;
                flatPalette[i * 3 + 2] = rgb[2] / 255;
            });
            gl.uniform3fv(gl.getUniformLocation(prog, 'u_customPalette'), flatPalette);
            gl.uniform1f(gl.getUniformLocation(prog, 'u_paletteSize'), paletteRgb.length);
        } else {
            gl.uniform1f(gl.getUniformLocation(prog, 'u_paletteSize'), parseFloat(UI.ditherPaletteSize.value));
        }

        if (maskTex) {
            gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskTex);
            gl.uniform1i(gl.getUniformLocation(prog, 'u_mask'), 1);
        }

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
};
