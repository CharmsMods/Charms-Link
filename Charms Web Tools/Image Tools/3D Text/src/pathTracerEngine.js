import * as THREE from 'three';
import { PathTracingRenderer, PathTracingSceneGenerator } from 'three-gpu-pathtracer';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export class PathTracerEngine {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;

        // Initialize the path tracer
        this.pathTracer = new PathTracingRenderer(renderer);
        this.pathTracer.camera = camera;
        this.pathTracer.alpha = true;
        this.pathTracer.material = new THREE.MeshBasicMaterial(); // Temporary until BVH builds

        this.generator = new PathTracingSceneGenerator();

        // Setup a quad to copy the accumulated render to the canvas
        this.fsQuad = new FullScreenQuad(new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                varying vec2 vUv;
                void main() {
                    gl_FragColor = texture2D(tDiffuse, vUv);
                }
            `,
            blending: THREE.NoBlending,
            depthWrite: false,
            depthTest: false
        }));

        // We will use a soft studio gradient by default
        this.initializeEnvironment();

        // We will use this flag to know when to render with PT vs standard
        this.isActive = false;
    }

    initializeEnvironment() {
        // Flat background supported directly by Three.js
        this.scene.background = new THREE.Color(0x121212);
        this.scene.environment = null; // No HDR yet, rely on lights
    }

    updateGeometry() {
        // Find text meshes to trace
        const targetMeshes = [];
        this.scene.traverse(c => {
            if (c.isMesh && c.geometry.type === 'ExtrudeGeometry' && c.material.type === 'MeshPhysicalMaterial') {
                targetMeshes.push(c);
            }
        });

        if (targetMeshes.length > 0) {
            import('three-gpu-pathtracer').then(({ PhysicalPathTracingMaterial }) => {
                console.log('PathTracer: Generating BVH...');
                const { bvh, textures, materials } = this.generator.generate(targetMeshes);
                const ptGeometry = bvh.geometry;

                const mat = new PhysicalPathTracingMaterial();
                mat.bvh.updateFrom(bvh);
                mat.attributesArray.updateFrom(
                    ptGeometry.attributes.normal,
                    ptGeometry.attributes.tangent,
                    ptGeometry.attributes.uv,
                    ptGeometry.attributes.color
                );
                mat.materialIndexAttribute.updateFrom(ptGeometry.attributes.materialIndex);
                mat.textures.setTextures(this.renderer, 2048, 2048, textures);
                mat.materials.updateFrom(materials, textures);

                this.pathTracer.material = mat;
                console.log('PathTracer: Material updated with BVH!');
                this.reset();
            }).catch(err => console.error('PathTracer Import Error:', err));
        }
    }

    reset() {
        // Reset accumulation when camera moves or geometry changes
        this.pathTracer.camera = this.camera;
        this.pathTracer.reset();
    }

    render() {
        if (!this.isActive) return;
        if (!this.pathTracer.material.bvh) {
            console.warn('PathTracer: Active but waiting for BVH build...');
            return;
        }
        this.pathTracer.update();

        // Render the traced image to the screen
        this.renderer.autoClear = false;

        // Render target to the canvas via a quad pass
        if (this.pathTracer.samples > 0 && this.pathTracer.target) {
            this.renderer.setRenderTarget(null);
            this.fsQuad.material.uniforms.tDiffuse.value = this.pathTracer.target.texture;
            this.fsQuad.render(this.renderer);
        }
        this.renderer.autoClear = true;
    }
}
