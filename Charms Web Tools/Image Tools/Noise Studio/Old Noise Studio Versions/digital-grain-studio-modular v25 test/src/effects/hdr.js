import { state, UI } from '../state/store.js';
import { renderMaskForSection, requestRender } from '../webgl/pipeline.js';
import { hexToRgb } from '../webgl/core.js';

export const hdrEffect = {
    id: 'hdr',
    render: (gl, inputTex, outputFbo, uniforms, force = false) => {
        const w = state.renderWidth;
        const h = state.renderHeight;
        
        // [TOOL: HDR EMULATION] Luminance Compression
                if (!UI.hdrEnable?.checked && !force) {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                    gl.useProgram(state.programs.copy);
                    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                    gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                    return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
                }
                gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                gl.useProgram(state.programs.adjust);
                gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                gl.uniform1i(gl.getUniformLocation(state.programs.adjust, 'u_tex'), 0);
                gl.uniform1f(gl.getUniformLocation(state.programs.adjust, 'u_bright'), 0.0);
                gl.uniform1f(gl.getUniformLocation(state.programs.adjust, 'u_cont'), 0.0);
                gl.uniform1f(gl.getUniformLocation(state.programs.adjust, 'u_sat'), 0.0);
                gl.uniform1f(gl.getUniformLocation(state.programs.adjust, 'u_warmth'), 0.0);
                gl.uniform1f(gl.getUniformLocation(state.programs.adjust, 'u_sharp'), 0.0);
                gl.uniform1f(gl.getUniformLocation(state.programs.adjust, 'u_hdrTol'), uniforms.u_hdrTol);
                gl.uniform1f(gl.getUniformLocation(state.programs.adjust, 'u_hdrAmt'), uniforms.u_hdrAmt);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
                return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
    }
};
