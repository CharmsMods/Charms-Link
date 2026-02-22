import { state, UI } from '../state/store.js';
import { renderMaskForSection, requestRender } from '../webgl/pipeline.js';
import { hexToRgb } from '../webgl/core.js';

export const blurEffect = {
    id: 'blur',
    render: (gl, inputTex, outputFbo, uniforms, force = false) => {
        const w = state.renderWidth;
        const h = state.renderHeight;

        // [TOOL: BLUR] Masked Gaussian/Box/Motion Blur
        if (!UI.blurEnable?.checked) {
            // Pass-through copy if needed, but often we just skip.
            // If we need to write to outputFbo to maintain chain:
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }

        const maskTex = renderMaskForSection('blur', inputTex);
        const blurAmt = parseFloat(UI.blurAmount?.value || 0) / 100.0;
        if (blurAmt > 0) {
            const prog = maskTex ? state.programs.maskedBlur : state.programs.blur;
            gl.useProgram(prog);
            // H Pass
            gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.blur2);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
            gl.uniform2f(gl.getUniformLocation(prog, 'u_dir'), 1.0 / w, 0.0);
            gl.uniform1f(gl.getUniformLocation(prog, 'u_rad'), blurAmt * 2.0);
            gl.uniform1i(gl.getUniformLocation(prog, 'u_blurType'), parseInt(UI.blurType?.value || 0));

            if (maskTex) {
                gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskTex);
                gl.uniform1i(gl.getUniformLocation(prog, 'u_mask'), 1);
            }
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            // V Pass
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, state.textures.blur2);
            gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
            gl.uniform2f(gl.getUniformLocation(prog, 'u_dir'), 0.0, 1.0 / h);
            gl.uniform1f(gl.getUniformLocation(prog, 'u_rad'), blurAmt * 2.0);
            gl.uniform1i(gl.getUniformLocation(prog, 'u_blurType'), parseInt(UI.blurType?.value || 0));

            if (maskTex) {
                gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskTex);
                gl.uniform1i(gl.getUniformLocation(prog, 'u_mask'), 1);
            }
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        } else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
    }
};
