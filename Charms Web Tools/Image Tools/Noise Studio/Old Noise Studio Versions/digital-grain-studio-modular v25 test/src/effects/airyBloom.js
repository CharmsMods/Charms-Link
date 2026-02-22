import { state, UI } from '../state/store.js';
import { renderMaskForSection, requestRender } from '../webgl/pipeline.js';
import { hexToRgb } from '../webgl/core.js';

export const airyBloomEffect = {
    id: 'airyBloom',
    render: (gl, inputTex, outputFbo, uniforms, force = false) => {
        const w = state.renderWidth;
        const h = state.renderHeight;
        
        if (!UI.airyBloomEnable?.checked && !force) {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                    gl.useProgram(state.programs.copy);
                    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                    gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                    return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
                }

                const maskTex = renderMaskForSection(gl, inputTex, 'airyBloom');

                gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                gl.useProgram(state.programs.airyBloom);
                gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                gl.uniform1i(gl.getUniformLocation(state.programs.airyBloom, 'u_tex'), 0);

                gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskTex);
                gl.uniform1i(gl.getUniformLocation(state.programs.airyBloom, 'u_mask'), 1);
                gl.uniform1i(gl.getUniformLocation(state.programs.airyBloom, 'u_useMask'), maskTex ? 1 : 0);

                gl.uniform2f(gl.getUniformLocation(state.programs.airyBloom, 'u_res'), w, h);
                gl.uniform1f(gl.getUniformLocation(state.programs.airyBloom, 'u_intensity'), parseFloat(UI.airyBloomIntensity?.value || 0.5));
                gl.uniform1f(gl.getUniformLocation(state.programs.airyBloom, 'u_aperture'), parseFloat(UI.airyBloomAperture?.value || 3.0));
                gl.uniform1f(gl.getUniformLocation(state.programs.airyBloom, 'u_threshold'), parseFloat(UI.airyBloomThreshold?.value || 0.7));
                gl.uniform1f(gl.getUniformLocation(state.programs.airyBloom, 'u_thresholdFade'), parseFloat(UI.airyBloomThresholdFade?.value || 0.1));
                gl.uniform1f(gl.getUniformLocation(state.programs.airyBloom, 'u_cutoff'), parseFloat(UI.airyBloomCutoff?.value || 1.0));

                gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
};
