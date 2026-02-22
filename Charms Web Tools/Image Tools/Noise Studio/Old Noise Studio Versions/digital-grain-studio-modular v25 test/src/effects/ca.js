import { state, UI } from '../state/store.js';
import { renderMaskForSection, requestRender } from '../webgl/pipeline.js';
import { hexToRgb } from '../webgl/core.js';

export const caEffect = {
    id: 'ca',
    render: (gl, inputTex, outputFbo, uniforms, force = false) => {
        const w = state.renderWidth;
        const h = state.renderHeight;
        
        // [TOOL: CHROMATIC ABERRATION] Lens Fringing
                if (!UI.caEnable?.checked && !force) {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                    gl.useProgram(state.programs.copy);
                    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                    gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                    return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
                }
                gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                gl.useProgram(state.programs.chroma);
                gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                gl.uniform1i(gl.getUniformLocation(state.programs.chroma, 'u_tex'), 0);
                gl.uniform1f(gl.getUniformLocation(state.programs.chroma, 'u_amt'), uniforms.u_ca_amt);
                gl.uniform1f(gl.getUniformLocation(state.programs.chroma, 'u_blur'), uniforms.u_ca_blur);
                gl.uniform1f(gl.getUniformLocation(state.programs.chroma, 'u_zoomBlur'), parseFloat(UI.aberrationZoomBlur.value) / 50.0);
                gl.uniform2f(gl.getUniformLocation(state.programs.chroma, 'u_center'), uniforms.u_ca_center[0], uniforms.u_ca_center[1]);
                gl.uniform1f(gl.getUniformLocation(state.programs.chroma, 'u_radius'), uniforms.u_ca_rad);
                gl.uniform1f(gl.getUniformLocation(state.programs.chroma, 'u_falloff'), uniforms.u_ca_fall);
                gl.uniform1i(gl.getUniformLocation(state.programs.chroma, 'u_falloffToBlur'), UI.caFalloffToBlur.checked ? 1 : 0);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
};
