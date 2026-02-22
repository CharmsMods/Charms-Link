import { state, UI } from '../state/store.js';
import { renderMaskForSection, requestRender } from '../webgl/pipeline.js';
import { hexToRgb } from '../webgl/core.js';

export const hankelBlurEffect = {
    id: 'hankelBlur',
    render: (gl, inputTex, outputFbo, uniforms, force = false) => {
        const w = state.renderWidth;
        const h = state.renderHeight;
        
        if (!UI.hankelBlurEnable?.checked && !force) {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                    gl.useProgram(state.programs.copy);
                    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                    gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                    return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
                }

                const maskTex = renderMaskForSection(gl, inputTex, 'hankel');

                gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                gl.useProgram(state.programs.hankelBlur);
                gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                gl.uniform1i(gl.getUniformLocation(state.programs.hankelBlur, 'u_tex'), 0);
                gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskTex);
                gl.uniform1i(gl.getUniformLocation(state.programs.hankelBlur, 'u_mask'), 1);
                gl.uniform1i(gl.getUniformLocation(state.programs.hankelBlur, 'u_useMask'), maskTex ? 1 : 0);

                gl.uniform2f(gl.getUniformLocation(state.programs.hankelBlur, 'u_res'), w, h);
                gl.uniform1f(gl.getUniformLocation(state.programs.hankelBlur, 'u_intensity'), uniforms.u_hankel_intensity);
                gl.uniform1f(gl.getUniformLocation(state.programs.hankelBlur, 'u_radius'), uniforms.u_hankel_radius);
                gl.uniform1f(gl.getUniformLocation(state.programs.hankelBlur, 'u_quality'), uniforms.u_hankel_quality);

                gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
};
