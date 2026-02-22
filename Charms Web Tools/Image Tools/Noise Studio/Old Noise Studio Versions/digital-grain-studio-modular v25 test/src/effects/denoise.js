import { state, UI } from '../state/store.js';
import { renderMaskForSection, requestRender } from '../webgl/pipeline.js';
import { hexToRgb } from '../webgl/core.js';

export const denoiseEffect = {
    id: 'denoise',
    render: (gl, inputTex, outputFbo, uniforms, force = false) => {
        const w = state.renderWidth;
        const h = state.renderHeight;

        // [TOOL: DENOISING] NLM / Median / Mean
        if (!UI.denoiseEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }

        const maskTex = renderMaskForSection('denoise', inputTex);
        const prog = state.programs.denoise;
        gl.useProgram(prog);
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
        gl.uniform2f(gl.getUniformLocation(prog, 'u_res'), w, h);
        gl.uniform1i(gl.getUniformLocation(prog, 'u_mode'), parseInt(UI.denoiseMode?.value || 0));
        gl.uniform1i(gl.getUniformLocation(prog, 'u_searchRadius'), parseInt(UI.denoiseSearchRadius?.value || 5));
        gl.uniform1i(gl.getUniformLocation(prog, 'u_patchRadius'), parseInt(UI.denoisePatchRadius?.value || 2));
        gl.uniform1f(gl.getUniformLocation(prog, 'u_h'), parseFloat(UI.denoiseH?.value || 0.5));
        gl.uniform1f(gl.getUniformLocation(prog, 'u_strength'), parseFloat(UI.denoiseBlend?.value || 100) / 100.0);

        if (maskTex) {
            gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskTex);
            gl.uniform1i(gl.getUniformLocation(prog, 'u_mask'), 1);
            gl.uniform1i(gl.getUniformLocation(prog, 'u_useMask'), 1);
        } else {
            gl.uniform1i(gl.getUniformLocation(prog, 'u_useMask'), 0);
        }

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
};
