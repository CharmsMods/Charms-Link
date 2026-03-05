import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { SketchShader } from './shaders/sketch.js';

export class TextEngine {
    constructor(scene, controls) {
        this.scene = scene;
        this.controls = controls;
        this.font = null;
        this.textGroup = new THREE.Group();
        this.scene.add(this.textGroup);

        // We will apply the sketch shader later. For now, a standard material.
        const shaderMat = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(SketchShader.uniforms),
            vertexShader: SketchShader.vertexShader,
            fragmentShader: SketchShader.fragmentShader
        });
        shaderMat.uniforms.color.value.setHex(0xeaeaea);
        shaderMat.uniforms.lineColor.value.setHex(0x1a1a1a);
        shaderMat.uniforms.ambientLightColor.value.setHex(0x888888);
        shaderMat.uniforms.thickness.value = 1.5;
        shaderMat.uniforms.spacing.value = 6.0;

        this.materials = {
            sketch: shaderMat,
            standard: new THREE.MeshStandardMaterial({
                color: 0xcccccc,
                roughness: 0.1,
                metalness: 0.8
            }),
            raytraced: new THREE.MeshPhysicalMaterial({
                color: 0xffffff,
                metalness: 0.2,
                roughness: 0.05,
                transmission: 0.9,     // Use glass-like properties
                ior: 1.5,
                thickness: 2.0,
                clearcoat: 1.0,
                clearcoatRoughness: 0.1
            })
        };

        this.currentMaterialMode = 'sketch';
        this.material = this.materials[this.currentMaterialMode];

        this.currentText = '';
        this.currentDepth = 10;
        this.currentBevel = 0.5;
        this.charSize = 60;
    }

    async loadFont(url) {
        const loader = new FontLoader();
        return new Promise((resolve, reject) => {
            loader.load(url, (font) => {
                this.font = font;
                resolve();
            }, undefined, reject);
        });
    }

    updateText(text, depth, bevel) {
        if (!this.font) return;

        this.currentText = text !== undefined ? text : this.currentText;
        this.currentDepth = depth !== undefined ? depth : this.currentDepth;
        this.currentBevel = bevel !== undefined ? bevel : this.currentBevel;

        // Remove old characters
        while (this.textGroup.children.length > 0) {
            const child = this.textGroup.children[0];
            this.textGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
        }

        if (this.currentText.length === 0) return;

        let currentXOffset = 0;

        // Split text into characters and generate geometry for each
        for (let i = 0; i < this.currentText.length; i++) {
            const char = this.currentText[i];

            // Handle spaces
            if (char === ' ') {
                currentXOffset += this.charSize * 0.4; // arbitrary space width
                continue;
            }

            const charGeo = new TextGeometry(char, {
                font: this.font,
                size: this.charSize,
                depth: this.currentDepth,
                curveSegments: 6,
                bevelEnabled: this.currentBevel > 0,
                bevelThickness: this.currentBevel,
                bevelSize: this.currentBevel,
                bevelOffset: 0,
                bevelSegments: 2
            });

            charGeo.computeBoundingBox();
            const charWidth = charGeo.boundingBox.max.x - charGeo.boundingBox.min.x;

            // We align the geometry so that its min X is 0 if it's not already
            charGeo.translate(-charGeo.boundingBox.min.x, 0, 0);

            const mesh = new THREE.Mesh(charGeo, this.material);
            mesh.position.x = currentXOffset;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            this.textGroup.add(mesh);

            // Advance offset by character width plus a small gap
            currentXOffset += charWidth + 2;
        }

        this.recenterGroup();
    }

    recenterGroup() {
        if (this.textGroup.children.length === 0) return;

        // Compute overall bounding box of all characters
        const box = new THREE.Box3().setFromObject(this.textGroup);

        const center = new THREE.Vector3();
        box.getCenter(center);

        // Reposition all children so the group's geometric center is at the origin
        this.textGroup.children.forEach(child => {
            child.position.sub(center);
        });

        // We want the orbit controls to rotate around this new center (0,0,0)
        // Actually our world space center is the origin, which handles the rotation implicitly.
        this.controls.target.set(0, 0, 0);
    }

    setMaterialMode(mode) {
        if (!this.materials[mode]) return;
        this.currentMaterialMode = mode;
        this.material = this.materials[mode];

        // Update all existing characters
        this.textGroup.children.forEach(child => {
            child.material = this.material;
        });
    }

    updateTime(time) {
        if (this.material && this.material.uniforms && this.material.uniforms.time) {
            this.material.uniforms.time.value = time;
        }
    }
}
