import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class RendererEngine {
    constructor(containerId) {
        this.container = document.getElementById(containerId);

        // Create Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);

        // Create Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // Set up Cameras
        const aspect = window.innerWidth / window.innerHeight;
        this.perspectiveCamera = new THREE.PerspectiveCamera(45, aspect, 1, 10000);
        this.perspectiveCamera.position.set(0, 0, 800);

        const frustumSize = 1000;
        this.orthographicCamera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            frustumSize / -2,
            1,
            10000
        );
        this.orthographicCamera.position.set(0, 0, 800);

        this.activeCamera = this.perspectiveCamera;

        // Controls
        this.controls = new OrbitControls(this.activeCamera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(100, 200, 100);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        // Event listeners
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
    }

    setCameraMode(mode) {
        const isPerspective = mode === 'perspective';

        // Save target
        const target = this.controls.target.clone();

        // Sync positions
        if (isPerspective) {
            this.perspectiveCamera.position.copy(this.orthographicCamera.position);
            this.perspectiveCamera.quaternion.copy(this.orthographicCamera.quaternion);
            this.activeCamera = this.perspectiveCamera;
        } else {
            this.orthographicCamera.position.copy(this.perspectiveCamera.position);
            this.orthographicCamera.quaternion.copy(this.perspectiveCamera.quaternion);
            this.activeCamera = this.orthographicCamera;

            // Update orthographic zoom based on distance
            const dist = this.perspectiveCamera.position.distanceTo(target) || 800;
            const aspect = window.innerWidth / window.innerHeight;
            const fovY = (this.perspectiveCamera.fov * Math.PI) / 180;
            const frustumHeight = 2.0 * dist * Math.tan(fovY * 0.5);

            this.orthographicCamera.left = -frustumHeight * aspect / 2;
            this.orthographicCamera.right = frustumHeight * aspect / 2;
            this.orthographicCamera.top = frustumHeight / 2;
            this.orthographicCamera.bottom = -frustumHeight / 2;
            this.orthographicCamera.zoom = 1;
            this.orthographicCamera.updateProjectionMatrix();
        }

        // Attach controls
        this.controls.object = this.activeCamera;
        this.controls.target.copy(target);
        this.controls.update();

        this.onWindowResize();
    }

    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const aspect = width / height;

        this.renderer.setSize(width, height);

        if (this.activeCamera.isPerspectiveCamera) {
            this.activeCamera.aspect = aspect;
            this.activeCamera.updateProjectionMatrix();
        } else {
            const dist = this.activeCamera.position.distanceTo(this.controls.target) || 800;
            const fovY = (this.perspectiveCamera.fov * Math.PI) / 180;
            const frustumHeight = 2.0 * dist * Math.tan(fovY * 0.5);

            this.activeCamera.left = -frustumHeight * aspect / 2;
            this.activeCamera.right = frustumHeight * aspect / 2;
            this.activeCamera.top = frustumHeight / 2;
            this.activeCamera.bottom = -frustumHeight / 2;
            this.activeCamera.updateProjectionMatrix();
        }
    }

    render() {
        this.controls.update();
        this.renderer.render(this.scene, this.activeCamera);
    }
}
