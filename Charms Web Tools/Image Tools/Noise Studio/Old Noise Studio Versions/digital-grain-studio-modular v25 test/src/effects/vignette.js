import { state, UI } from '../state/store.js';
import { renderMaskForSection, requestRender } from '../webgl/pipeline.js';
import { hexToRgb } from '../webgl/core.js';

export const vignetteEffect = {
    id: 'vignette',
    render: (gl, inputTex, outputFbo, uniforms, force = false) => {
        const w = state.renderWidth;
        const h = state.renderHeight;
        
        if (!UI.vignetteEnable?.checked && !force) {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                    gl.useProgram(state.programs.copy);
                    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                    gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                    return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
                }
                gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                gl.useProgram(state.programs.vignette);
                gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                gl.uniform1i(gl.getUniformLocation(state.programs.vignette, 'u_tex'), 0);
                gl.uniform2f(gl.getUniformLocation(state.programs.vignette, 'u_res'), w, h);
                gl.uniform1f(gl.getUniformLocation(state.programs.vignette, 'u_intensity'), uniforms.u_vignette_intensity);
                gl.uniform1f(gl.getUniformLocation(state.programs.vignette, 'u_radius'), uniforms.u_vignette_radius);
                gl.uniform1f(gl.getUniformLocation(state.programs.vignette, 'u_softness'), uniforms.u_vignette_softness);
                gl.uniform3f(gl.getUniformLocation(state.programs.vignette, 'u_color'), uniforms.u_vignette_color.r, uniforms.u_vignette_color.g, uniforms.u_vignette_color.b);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
};
