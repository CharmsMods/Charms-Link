import { state, UI } from '../state/store.js';
import { renderMaskForSection, requestRender } from '../webgl/pipeline.js';
import { hexToRgb } from '../webgl/core.js';

export const analogVideoEffect = {
    id: 'analogVideo',
    render: (gl, inputTex, outputFbo, uniforms, force = false) => {
        const w = state.renderWidth;
        const h = state.renderHeight;
        
        if (!UI.analogVideoEnable?.checked && !force) {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                    gl.useProgram(state.programs.copy);
                    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                    gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                    return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
                }
                gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                gl.useProgram(state.programs.analogVideo);
                gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                gl.uniform1i(gl.getUniformLocation(state.programs.analogVideo, 'u_tex'), 0);
                gl.uniform1f(gl.getUniformLocation(state.programs.analogVideo, 'u_time'), uniforms.u_time);
                gl.uniform1f(gl.getUniformLocation(state.programs.analogVideo, 'u_wobble'), uniforms.u_analog_wobble);
                gl.uniform1f(gl.getUniformLocation(state.programs.analogVideo, 'u_bleed'), uniforms.u_analog_bleed);
                gl.uniform1f(gl.getUniformLocation(state.programs.analogVideo, 'u_curve'), uniforms.u_analog_curve);
                gl.uniform1f(gl.getUniformLocation(state.programs.analogVideo, 'u_noise'), uniforms.u_analog_noise);
                gl.drawArrays(gl.TRIANGLES, 0, 6);

                // If animated params > 0, we need to keep rendering frames
                if (uniforms.u_analog_wobble > 0 || uniforms.u_analog_noise > 0) {
                    requestRender(); // Force continuous rendering for animation
                }
    }
};
