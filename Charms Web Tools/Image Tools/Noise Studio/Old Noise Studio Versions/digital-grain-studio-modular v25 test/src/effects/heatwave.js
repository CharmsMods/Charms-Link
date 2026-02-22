import { state, UI } from '../state/store.js';
import { renderMaskForSection, requestRender } from '../webgl/pipeline.js';
import { hexToRgb } from '../webgl/core.js';

export const heatwaveEffect = {
    id: 'heatwave',
    render: (gl, inputTex, outputFbo, uniforms, force = false) => {
        const w = state.renderWidth;
        const h = state.renderHeight;
        
        if (!UI.heatwaveEnable?.checked && !force) {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                    gl.useProgram(state.programs.copy);
                    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                    gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                    return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
                }
                gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                gl.useProgram(state.programs.heatwave);
                gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                gl.uniform1i(gl.getUniformLocation(state.programs.heatwave, 'u_tex'), 0);
                gl.uniform1f(gl.getUniformLocation(state.programs.heatwave, 'u_time'), uniforms.u_time);
                gl.uniform1f(gl.getUniformLocation(state.programs.heatwave, 'u_intensity'), uniforms.u_heatwave_intensity);
                gl.uniform1f(gl.getUniformLocation(state.programs.heatwave, 'u_speed'), uniforms.u_heatwave_speed);
                gl.uniform1f(gl.getUniformLocation(state.programs.heatwave, 'u_scale'), uniforms.u_heatwave_scale);
                gl.uniform1i(gl.getUniformLocation(state.programs.heatwave, 'u_direction'), uniforms.u_heatwave_direction);
                gl.drawArrays(gl.TRIANGLES, 0, 6);

                // If intensity > 0, we need to keep rendering frames
                if (uniforms.u_heatwave_intensity > 0) {
                    requestRender(); // Force continuous rendering for animation
                }
    }
};
