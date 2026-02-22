import { state, UI } from '../state/store.js';
import { renderMaskForSection, requestRender } from '../webgl/pipeline.js';
import { hexToRgb } from '../webgl/core.js';

export function calcScale(val, mod = 1.0) {
    if (val === 0) return 0;
    return val * val * 0.1 * mod;
}

export const noiseEffect = {
    id: 'noise',
    render: (gl, inputTex, outputFbo, uniforms, force = false) => {
        const w = state.renderWidth;
        const h = state.renderHeight;

        // [TOOL: NOISE GROUP] Procedural Grain & Compositing
        if (!UI.noiseEnable?.checked && !force) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
            gl.useProgram(state.programs.copy);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
            gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
        }
        gl.useProgram(state.programs.noise);
        gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.tempNoise);
        gl.uniform1i(gl.getUniformLocation(state.programs.noise, 'u_type'), parseInt(UI.noiseType.value));
        gl.uniform1f(gl.getUniformLocation(state.programs.noise, 'u_seed'), Math.random() * 100.0);
        gl.uniform2f(gl.getUniformLocation(state.programs.noise, 'u_res'), w, h);
        gl.uniform2f(gl.getUniformLocation(state.programs.noise, 'u_origRes'), state.width * state.upscaleFactor, state.height * state.upscaleFactor);
        gl.uniform1f(gl.getUniformLocation(state.programs.noise, 'u_scale'), parseFloat(UI.noiseSize.value));
        gl.uniform1f(gl.getUniformLocation(state.programs.noise, 'u_paramA'), parseFloat(document.getElementById('noiseParamA').value) / 100.0);
        gl.uniform1f(gl.getUniformLocation(state.programs.noise, 'u_paramB'), parseFloat(document.getElementById('noiseParamB').value) / 100.0);
        gl.uniform1f(gl.getUniformLocation(state.programs.noise, 'u_paramC'), parseFloat(document.getElementById('noiseParamC').value) / 100.0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        const blurAmt = parseFloat(UI.blurriness.value) / 100.0;
        let noiseTex = state.textures.tempNoise;
        if (blurAmt > 0) {
            gl.useProgram(state.programs.blur);
            gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.blur1);
            gl.bindTexture(gl.TEXTURE_2D, state.textures.tempNoise);
            gl.uniform1i(gl.getUniformLocation(state.programs.blur, 'u_tex'), 0);
            gl.uniform2f(gl.getUniformLocation(state.programs.blur, 'u_dir'), 1.0 / w, 0.0);
            gl.uniform1f(gl.getUniformLocation(state.programs.blur, 'u_rad'), blurAmt * 2.0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbos.blur2);
            gl.bindTexture(gl.TEXTURE_2D, state.textures.blur1);
            gl.uniform2f(gl.getUniformLocation(state.programs.blur, 'u_dir'), 0.0, 1.0 / h);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            noiseTex = state.textures.blur2;
        }
        const maskTex = renderMaskForSection('noise', inputTex);

        // Composite
        gl.useProgram(state.programs.composite);
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, noiseTex);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, maskTex || state.textures.white); // Fallback to white if no mask

        gl.uniform1i(gl.getUniformLocation(state.programs.composite, 'u_base'), 0);
        gl.uniform1i(gl.getUniformLocation(state.programs.composite, 'u_noise'), 1);
        gl.uniform1i(gl.getUniformLocation(state.programs.composite, 'u_mask'), 2);
        gl.uniform1i(gl.getUniformLocation(state.programs.composite, 'u_mode'), parseInt(UI.blendMode.value));
        gl.uniform1f(gl.getUniformLocation(state.programs.composite, 'u_opacity'), parseFloat(UI.opacity.value));
        gl.uniform1f(gl.getUniformLocation(state.programs.composite, 'u_str'), parseFloat(UI.strength.value));
        gl.uniform1i(gl.getUniformLocation(state.programs.composite, 'u_nType'), parseInt(UI.noiseType.value));
        gl.uniform1f(gl.getUniformLocation(state.programs.composite, 'u_satStr'), parseFloat(UI.satStrength.value));
        gl.uniform1f(gl.getUniformLocation(state.programs.composite, 'u_satImp'), parseFloat(UI.satPerNoise.value));
        gl.uniform1f(gl.getUniformLocation(state.programs.composite, 'u_skinProt'), parseFloat(UI.skinProtection.value));
        gl.uniform1i(gl.getUniformLocation(state.programs.composite, 'u_ignA'), UI.ignoreAlphaToggle.checked ? 1 : 0);
        gl.uniform1f(gl.getUniformLocation(state.programs.composite, 'u_ignAstr'), parseFloat(UI.ignoreAlphaStrength.value));

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
};
