import { state, UI } from '../state/store.js';
import { renderMaskForSection, requestRender } from '../webgl/pipeline.js';
import { hexToRgb } from '../webgl/core.js';

export const lightLeaksEffect = {
    id: 'lightLeaks',
    render: (gl, inputTex, outputFbo, uniforms, force = false) => {
        const w = state.renderWidth;
        const h = state.renderHeight;
        
        if (!UI.lightLeaksEnable?.checked && !force) {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                    gl.useProgram(state.programs.copy);
                    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                    gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                    return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
                }
                gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                gl.useProgram(state.programs.lightLeaks);
                gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                gl.uniform1i(gl.getUniformLocation(state.programs.lightLeaks, 'u_tex'), 0);
                gl.uniform1f(gl.getUniformLocation(state.programs.lightLeaks, 'u_intensity'), uniforms.u_lightleaks_intensity);
                gl.uniform3f(gl.getUniformLocation(state.programs.lightLeaks, 'u_color1'), uniforms.u_lightleaks_color1.r, uniforms.u_lightleaks_color1.g, uniforms.u_lightleaks_color1.b);
                gl.uniform3f(gl.getUniformLocation(state.programs.lightLeaks, 'u_color2'), uniforms.u_lightleaks_color2.r, uniforms.u_lightleaks_color2.g, uniforms.u_lightleaks_color2.b);
                gl.uniform1f(gl.getUniformLocation(state.programs.lightLeaks, 'u_time'), uniforms.u_time);
                gl.drawArrays(gl.TRIANGLES, 0, 6);

                if (uniforms.u_lightleaks_intensity > 0) {
                    requestRender(); // Force continuous rendering for animation
                }
    }
};
