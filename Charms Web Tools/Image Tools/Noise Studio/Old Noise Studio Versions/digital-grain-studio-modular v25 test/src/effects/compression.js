import { state, UI } from '../state/store.js';
import { renderMaskForSection, requestRender } from '../webgl/pipeline.js';
import { hexToRgb } from '../webgl/core.js';

export const compressionEffect = {
    id: 'compression',
    render: (gl, inputTex, outputFbo, uniforms, force = false) => {
        const w = state.renderWidth;
        const h = state.renderHeight;
        
        // [TOOL: COMPRESSION] Lossy Compression Simulation
                if (!UI.compressionEnable?.checked && !force) {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                    gl.useProgram(state.programs.copy);
                    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                    gl.uniform1i(gl.getUniformLocation(state.programs.copy, 'u_tex'), 0);
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                    return (outputFbo === state.fbos.temp2) ? state.textures.temp2 : state.textures.temp1;
                }

                const iters = Math.max(1, parseInt(UI.compressionIterations?.value || 1));
                const prog = state.programs.compression;
                gl.useProgram(prog);
                gl.uniform1i(gl.getUniformLocation(prog, 'u_method'), parseInt(UI.compressionMethod?.value || 0));
                gl.uniform1f(gl.getUniformLocation(prog, 'u_quality'), parseFloat(UI.compressionQuality?.value || 50));
                gl.uniform1f(gl.getUniformLocation(prog, 'u_blockSize'), parseFloat(UI.compressionBlockSize?.value || 8));
                gl.uniform1f(gl.getUniformLocation(prog, 'u_blend'), parseFloat(UI.compressionBlend?.value || 100) / 100.0);
                gl.uniform2f(gl.getUniformLocation(prog, 'u_res'), w, h);

                if (iters <= 1) {
                    // Single pass: direct to output
                    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
                    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTex);
                    gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                } else {
                    // Iterative: ping-pong using blur1/blur2 as scratch FBOs
                    let readTex = inputTex;
                    for (let i = 0; i < iters; i++) {
                        const isLast = (i === iters - 1);
                        const writeFbo = isLast ? outputFbo : (i % 2 === 0 ? state.fbos.blur1 : state.fbos.blur2);
                        gl.bindFramebuffer(gl.FRAMEBUFFER, writeFbo);
                        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, readTex);
                        gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
                        gl.drawArrays(gl.TRIANGLES, 0, 6);
                        if (!isLast) {
                            readTex = (i % 2 === 0) ? state.textures.blur1 : state.textures.blur2;
                        }
                    }
                }
    }
};
