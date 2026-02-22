import { state, UI } from '../state/store.js';
import { requestRender } from '../webgl/pipeline.js';
import { hexToRgb } from '../webgl/core.js';

export const halftoneEffect = {
    id: 'halftone',
    render: (gl, inputTex, outputFbo, uniforms, force = false) => {
        const w = state.renderWidth;
        const h = state.renderHeight;

        // [TOOL: HALFTONING] Simulated Print Screen
        if (!UI.halftoneEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.useProgram(state.programs.halftone);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.uniform1i(gl.getUniformLocation(state.programs.halftone, 'u_tex'), 0);
        gl.uniform2f(gl.getUniformLocation(state.programs.halftone, 'u_res'), w, h);
        gl.uniform1f(gl.getUniformLocation(state.programs.halftone, 'u_size'), parseFloat(UI.halftoneSize?.value || 4));
        gl.uniform1f(gl.getUniformLocation(state.programs.halftone, 'u_intensity'), parseFloat(UI.halftoneIntensity?.value || 1));
        gl.uniform1f(gl.getUniformLocation(state.programs.halftone, 'u_sharpness'), parseFloat(UI.halftoneSharpness?.value || 1));
        gl.uniform1i(gl.getUniformLocation(state.programs.halftone, 'u_pattern'), parseInt(UI.halftonePattern?.value || 0));
        gl.uniform1i(gl.getUniformLocation(state.programs.halftone, 'u_colorMode'), parseInt(UI.halftoneColorMode?.value || 0));
        gl.uniform1i(gl.getUniformLocation(state.programs.halftone, 'u_sample'), parseInt(UI.halftoneSample?.value || 1));
        gl.uniform1i(gl.getUniformLocation(state.programs.halftone, 'u_gray'), UI.halftoneGray?.checked ? 1 : 0);
        gl.uniform1i(gl.getUniformLocation(state.programs.halftone, 'u_lock'), UI.halftoneScreenLock?.checked ? 1 : 0);
        gl.uniform1i(gl.getUniformLocation(state.programs.halftone, 'u_invert'), UI.halftoneInvert?.checked ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
};
