import { state, UI } from '../state/store.js';
import { renderMaskForSection, requestRender } from '../webgl/pipeline.js';
import { hexToRgb } from '../webgl/core.js';

export const glareRaysEffect = {
    id: 'glareRays',
    render: (gl, inputTex, outputFbo, uniforms, force = false) => {
        const w = state.renderWidth;
        const h = state.renderHeight;
        
        if (!UI.glareRaysEnable?.checked && !force) {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                    gl.useProgram(state.programs.copy);
                    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                    gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                    return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
                }
                gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                gl.useProgram(state.programs.glareRays);
                gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                gl.uniform1i(gl.getUniformLocation(state.programs.glareRays, 'u_tex'), 0);
                gl.uniform2f(gl.getUniformLocation(state.programs.glareRays, 'u_res'), w, h);
                gl.uniform1f(gl.getUniformLocation(state.programs.glareRays, 'u_intensity'), uniforms.u_glare_intensity);
                gl.uniform1f(gl.getUniformLocation(state.programs.glareRays, 'u_rays'), uniforms.u_glare_rays);
                gl.uniform1f(gl.getUniformLocation(state.programs.glareRays, 'u_length'), uniforms.u_glare_length);
                gl.uniform1f(gl.getUniformLocation(state.programs.glareRays, 'u_blur'), uniforms.u_glare_blur);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
};
