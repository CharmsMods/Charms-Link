import * as THREE from 'three';
import { RendererEngine } from './renderer.js';
import { UI } from './ui.js';
import { TextEngine } from './textEngine.js';
import { exportPNG } from './exporter.js';
import { PathTracerEngine } from './pathTracerEngine.js';

window.addEventListener('DOMContentLoaded', () => {
    const renderer = new RendererEngine('canvas-container');
    const textEngine = new TextEngine(renderer.scene, renderer.controls);
    const pathTracer = new PathTracerEngine(renderer.renderer, renderer.scene, renderer.activeCamera);

    const ui = new UI({
        onTextChange: (text) => {
            textEngine.updateText(text);
        },
        onDepthChange: (depth) => {
            textEngine.updateText(undefined, depth, undefined);
        },
        onBevelChange: (bevel) => {
            textEngine.updateText(undefined, undefined, bevel);
        },
        onCameraModeChange: (mode) => {
            renderer.setCameraMode(mode);
            pathTracer.camera = renderer.activeCamera;
            pathTracer.updateGeometry();
        },
        onMaterialModeChange: (mode) => {
            textEngine.setMaterialMode(mode);

            // Toggle path tracer rendering
            if (mode === 'raytraced') {
                pathTracer.isActive = true;
                pathTracer.updateGeometry();
            } else {
                pathTracer.isActive = false;
            }
        },
        onExport: (settings) => {
            exportPNG(renderer, settings, pathTracer);
        }
    });

    // Listen for control changes to reset path tracing accumulation
    renderer.controls.addEventListener('change', () => {
        if (pathTracer.isActive) {
            pathTracer.reset();
        }
    });

    // Load the font
    textEngine.loadFont('./assets/fonts/helvetiker_regular.typeface.json')
        .then(() => {
            // Trigger initial render
            const text = document.getElementById('text-input').value || 'STUDIO';
            const depth = parseFloat(document.getElementById('extrude-slider').value) || 10;
            const bevel = parseFloat(document.getElementById('bevel-slider').value) || 0.5;
            textEngine.updateText(text, depth, bevel);
            if (pathTracer.isActive) pathTracer.updateGeometry();
        })
        .catch((err) => {
            console.error('Failed to load font', err);
        });

    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        textEngine.updateTime(clock.getElapsedTime());

        if (pathTracer.isActive) {
            pathTracer.render();
        } else {
            renderer.render();
        }
    }

    animate();
});
