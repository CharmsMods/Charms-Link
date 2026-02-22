import { state, UI } from '../state/store.js';
import { renderMaskForSection, requestRender } from '../webgl/pipeline.js';
import { hexToRgb } from '../webgl/core.js';

export const corruptionEffect = {
    id: 'corruption',
    render: (gl, inputTex, outputFbo, uniforms, force = false) => {
        const w = state.renderWidth;
        const h = state.renderHeight;
        
        // [TOOL: CORRUPTION] Glitch & Block Artifacts
                if (!UI.corruptionEnable?.checked && !force) {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                    gl.useProgram(state.programs.copy);
                    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                    gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                    return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
                }
                gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                gl.useProgram(state.programs.corruption);
                gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                gl.uniform1i(gl.getUniformLocation(state.programs.corruption, 'u_tex'), 0);
                gl.uniform1i(gl.getUniformLocation(state.programs.corruption, 'u_algorithm'), parseInt(UI.corruptionAlgorithm?.value || 0));
                gl.uniform1f(gl.getUniformLocation(state.programs.corruption, 'u_resScale'), parseFloat(UI.corruptionResScale?.value || 1));
                gl.uniform2f(gl.getUniformLocation(state.programs.corruption, 'u_res'), w, h);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
};
