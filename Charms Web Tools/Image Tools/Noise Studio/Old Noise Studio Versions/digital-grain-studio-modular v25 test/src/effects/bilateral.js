import { state, UI } from '../state/store.js';
import { requestRender } from '../webgl/pipeline.js';
import { hexToRgb } from '../webgl/core.js';

export const bilateralEffect = {
    id: 'bilateral',
    render: (gl, inputTex, outputFbo, uniforms, force = false) => {
        const w = state.renderWidth;
        const h = state.renderHeight;

        // [TOOL: BILATERAL FILTER] Skin Smoothing
        if (!UI.bilateralEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }
        const iters = Math.max(1, parseInt(UI.bilateralIter?.value || 1));
        gl.useProgram(state.programs.bilateral);
        gl.uniform2f(gl.getUniformLocation(state.programs.bilateral, 'u_res'), w, h);
        gl.uniform1i(gl.getUniformLocation(state.programs.bilateral, 'u_radius'), parseInt(UI.bilateralRadius?.value || 2));
        gl.uniform1f(gl.getUniformLocation(state.programs.bilateral, 'u_sigmaCol'), parseFloat(UI.bilateralColorSig?.value || 0.1));
        gl.uniform1f(gl.getUniformLocation(state.programs.bilateral, 'u_sigmaSpace'), parseFloat(UI.bilateralSpatialSig?.value || 2));
        gl.uniform1i(gl.getUniformLocation(state.programs.bilateral, 'u_kernel'), parseInt(UI.bilateralKernel?.value || 0));
        gl.uniform1i(gl.getUniformLocation(state.programs.bilateral, 'u_edgeMode'), parseInt(UI.bilateralEdgeMode?.value || 0));

        // Single pass for now as logic for pingpong inside here is complex without new FBOs
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.bilateral, 'u_tex'), 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
};
