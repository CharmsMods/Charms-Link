import { state, UI } from '../state/store.js';
import { renderMaskForSection, requestRender } from '../webgl/pipeline.js';
import { hexToRgb } from '../webgl/core.js';

export const cellEffect = {
    id: 'cell',
    render: (gl, inputTex, outputFbo, uniforms, force = false) => {
        const w = state.renderWidth;
        const h = state.renderHeight;
        
        // [TOOL: CELL SHADING] Posterization & Outlines
                if (!UI.cellEnable?.checked && !force) {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                    gl.useProgram(state.programs.copy);
                    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                    gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                    return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
                }
                gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                gl.useProgram(state.programs.cell);
                gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                gl.uniform1i(gl.getUniformLocation(state.programs.cell, 'u_tex'), 0);
                gl.uniform2f(gl.getUniformLocation(state.programs.cell, 'u_res'), w, h);
                gl.uniform1i(gl.getUniformLocation(state.programs.cell, 'u_levels'), parseInt(UI.cellLevels?.value || 4));
                gl.uniform1f(gl.getUniformLocation(state.programs.cell, 'u_bias'), parseFloat(UI.cellBias?.value || 0));
                gl.uniform1f(gl.getUniformLocation(state.programs.cell, 'u_gamma'), parseFloat(UI.cellGamma?.value || 1));
                gl.uniform1i(gl.getUniformLocation(state.programs.cell, 'u_quantMode'), parseInt(UI.cellQuantMode?.value || 0));
                gl.uniform1i(gl.getUniformLocation(state.programs.cell, 'u_bandMap'), parseInt(UI.cellBandMap?.value || 0));
                gl.uniform1i(gl.getUniformLocation(state.programs.cell, 'u_edgeMethod'), parseInt(UI.cellEdgeMethod?.value || 0));
                gl.uniform1f(gl.getUniformLocation(state.programs.cell, 'u_edgeStr'), parseFloat(UI.cellEdgeStr?.value || 1));
                gl.uniform1f(gl.getUniformLocation(state.programs.cell, 'u_edgeThick'), parseFloat(UI.cellEdgeThick?.value || 1));
                gl.uniform1i(gl.getUniformLocation(state.programs.cell, 'u_colorPreserve'), UI.cellColorPreserve?.checked ? 1 : 0);
                gl.uniform1i(gl.getUniformLocation(state.programs.cell, 'u_edgeEnable'), UI.cellEdgeEnable?.checked ? 1 : 0);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
};
