import { state, UI } from '../state/store.js';
import { requestRender } from '../webgl/pipeline.js';
import { hexToRgb } from '../webgl/core.js';

export const adjustEffect = {
    id: 'adjust',
    render: (gl, inputTex, outputFbo, uniforms, force = false) => {
        const w = state.renderWidth;
        const h = state.renderHeight;

        // [TOOL: ADJUSTMENTS] Color, Sharpening, Brightness
        if (!UI.adjustEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }
        let maskTex = null;
        const hasSH = UI.adjLumaMask?.checked;
        const hasCol = UI.adjColorExclude?.checked;

        if (hasSH || hasCol) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.blur1);
            gl.clearColor(1, 1, 1, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.DST_COLOR, gl.ZERO);

            if (hasSH) {
                gl.useProgram(state.programs.mask);
                gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                gl.uniform1i(gl.getUniformLocation(state.programs.mask, 'u_tex'), 0);
                gl.uniform1i(gl.getUniformLocation(state.programs.mask, 'u_useS'), 1);
                gl.uniform1f(gl.getUniformLocation(state.programs.mask, 'u_sth'), parseFloat(UI.adjShadowThreshold?.value || 0));
                gl.uniform1f(gl.getUniformLocation(state.programs.mask, 'u_sfa'), parseFloat(UI.adjShadowFade?.value || 0));
                gl.uniform1i(gl.getUniformLocation(state.programs.mask, 'u_useH'), 1);
                gl.uniform1f(gl.getUniformLocation(state.programs.mask, 'u_hth'), parseFloat(UI.adjHighlightThreshold?.value || 1));
                gl.uniform1f(gl.getUniformLocation(state.programs.mask, 'u_hfa'), parseFloat(UI.adjHighlightFade?.value || 0));
                gl.drawArrays(gl.TRIANGLES, 0, 6);
            }
            if (hasCol) {
                const targetColor = UI.adjExcludeColor?.value || '#000000';
                const r = parseInt(targetColor.slice(1, 3), 16) / 255;
                const g = parseInt(targetColor.slice(3, 5), 16) / 255;
                const b = parseInt(targetColor.slice(5, 7), 16) / 255;
                gl.useProgram(state.programs.colorMask);
                gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                gl.uniform1i(gl.getUniformLocation(state.programs.colorMask, 'u_tex'), 0);
                gl.uniform3f(gl.getUniformLocation(state.programs.colorMask, 'u_targetColor'), r, g, b);
                gl.uniform1f(gl.getUniformLocation(state.programs.colorMask, 'u_tolerance'), parseFloat(UI.adjColorTolerance?.value || 10) / 100.0);
                gl.uniform1f(gl.getUniformLocation(state.programs.colorMask, 'u_fade'), parseFloat(UI.adjColorFade?.value || 0) / 100.0);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
            }
            gl.disable(gl.BLEND);
            maskTex = state.textures.blur1;

            if (maskTex && UI.adjInvertMask?.checked) {
                gl.useProgram(state.programs.invert);
                gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.blur2);
                gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, maskTex);
                gl.uniform1i(gl.getUniformLocation(state.programs.invert, 'u_tex'), 0);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
                maskTex = state.textures.blur2;
            }
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        const prog = state.programs.adjustMasked || state.programs.adjust;
        gl.useProgram(prog);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTex);

        gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_bright'), uniforms.u_bright);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_cont'), uniforms.u_cont);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_sat'), uniforms.u_sat);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_hdrTol'), 0.0);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_hdrAmt'), 0.0);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_warmth'), uniforms.u_warmth);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_sharp'), uniforms.u_sharp);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_sharpThresh'), uniforms.u_sharpThresh);
        gl.uniform2f(gl.getUniformLocation(prog, 'u_step'), uniforms.u_step[0], uniforms.u_step[1]);

        if (maskTex && prog) {
            gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskTex);
            gl.uniform1i(gl.getUniformLocation(prog, 'u_mask'), 1);
            gl.uniform1i(gl.getUniformLocation(prog, 'u_useMask'), 1);
        } else if (prog) {
            gl.uniform1i(gl.getUniformLocation(prog, 'u_useMask'), 0);
        }

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        return outputFbo; // Effectively specific texture attached to this FBO
    }
};
