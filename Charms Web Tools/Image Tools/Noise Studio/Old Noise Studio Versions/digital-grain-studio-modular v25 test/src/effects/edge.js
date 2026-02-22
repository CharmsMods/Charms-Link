import { state, UI } from '../state/store.js';
import { renderMaskForSection, requestRender } from '../webgl/pipeline.js';
import { hexToRgb } from '../webgl/core.js';

export const edgeEffect = {
    id: 'edge',
    render: (gl, inputTex, outputFbo, uniforms, force = false) => {
        const w = state.renderWidth;
        const h = state.renderHeight;
        
        // [TOOL: EDGE EFFECTS] Advanced Outlines & Bloom
                if (!UI.edgeEnable?.checked && !force) {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                    gl.useProgram(state.programs.copy);
                    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                    gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                    return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
                }
                gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                gl.useProgram(state.programs.edge);
                gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                gl.uniform1i(gl.getUniformLocation(state.programs.edge, 'u_tex'), 0);
                gl.uniform2f(gl.getUniformLocation(state.programs.edge, 'u_res'), w, h);
                gl.uniform1i(gl.getUniformLocation(state.programs.edge, 'u_mode'), parseInt(UI.edgeMode?.value || 0));
                gl.uniform1f(gl.getUniformLocation(state.programs.edge, 'u_strength'), parseFloat(UI.edgeStrength?.value || 500));
                gl.uniform1f(gl.getUniformLocation(state.programs.edge, 'u_tolerance'), parseFloat(UI.edgeTolerance?.value || 10));
                gl.uniform1f(gl.getUniformLocation(state.programs.edge, 'u_bgSat'), parseFloat(UI.edgeBgSat?.value || 0));
                gl.uniform1f(gl.getUniformLocation(state.programs.edge, 'u_fgSat'), parseFloat(UI.edgeFgSat?.value || 150));
                gl.uniform1f(gl.getUniformLocation(state.programs.edge, 'u_bloom'), parseFloat(UI.edgeBloom?.value || 10));
                gl.uniform1f(gl.getUniformLocation(state.programs.edge, 'u_smooth'), parseFloat(UI.edgeSmooth?.value || 50));
                gl.uniform1f(gl.getUniformLocation(state.programs.edge, 'u_blend'), parseFloat(UI.edgeBlend?.value || 100));

                gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
};
