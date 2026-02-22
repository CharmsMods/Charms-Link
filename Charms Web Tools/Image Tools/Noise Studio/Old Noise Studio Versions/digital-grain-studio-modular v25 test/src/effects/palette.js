import { state, UI } from '../state/store.js';
import { renderMaskForSection, requestRender } from '../webgl/pipeline.js';
import { hexToRgb } from '../webgl/core.js';

export const paletteEffect = {
    id: 'palette',
    render: (gl, inputTex, outputFbo, uniforms, force = false) => {
        const w = state.renderWidth;
        const h = state.renderHeight;
        
        // [TOOL: PALETTE RECONSTRUCTOR] Indexed Color Mapping
                if (!UI.paletteEnable?.checked && !force) {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                    gl.useProgram(state.programs.copy);
                    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                    gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                    return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
                }
                gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                gl.useProgram(state.programs.palette);
                gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                gl.uniform1i(gl.getUniformLocation(state.programs.palette, 'u_tex'), 0);
                gl.uniform1f(gl.getUniformLocation(state.programs.palette, 'u_blend'), parseFloat(UI.paletteBlend?.value || 100) / 100.0);
                gl.uniform1f(gl.getUniformLocation(state.programs.palette, 'u_smoothing'), parseFloat(UI.paletteSmoothing?.value || 0));
                gl.uniform1i(gl.getUniformLocation(state.programs.palette, 'u_smoothingType'), parseInt(UI.paletteSmoothingType?.value || 0));
                gl.uniform2f(gl.getUniformLocation(state.programs.palette, 'u_res'), w, h);

                const pSize = Math.min(state.palette.length, 256);
                gl.uniform1i(gl.getUniformLocation(state.programs.palette, 'u_paletteSize'), pSize);

                const flatPalette = new Float32Array(256 * 3);
                for (let i = 0; i < pSize; i++) {
                    const hex = state.palette[i];
                    flatPalette[i * 3 + 0] = parseInt(hex.slice(1, 3), 16) / 255;
                    flatPalette[i * 3 + 1] = parseInt(hex.slice(3, 5), 16) / 255;
                    flatPalette[i * 3 + 2] = parseInt(hex.slice(5, 7), 16) / 255;
                }
                gl.uniform3fv(gl.getUniformLocation(state.programs.palette, 'u_palette'), flatPalette);

                gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
};
