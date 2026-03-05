import * as THREE from 'three';

export function exportPNG(rendererEngine, settings, pathTracer = null) {
    const { width, height, dpi } = settings;
    const renderer = rendererEngine.renderer;
    const scene = rendererEngine.scene;
    const camera = rendererEngine.activeCamera;

    // Save original settings
    const originalSize = new THREE.Vector2();
    renderer.getSize(originalSize);
    const originalPixelRatio = renderer.getPixelRatio();

    // Apply export settings
    const targetWidth = width * dpi;
    const targetHeight = height * dpi;

    renderer.setPixelRatio(1);
    renderer.setSize(targetWidth, targetHeight, false); // false = don't update CSS style

    // Temporarily update camera aspect
    const originalAspect = camera.aspect;
    if (camera.isPerspectiveCamera) {
        camera.aspect = targetWidth / targetHeight;
        camera.updateProjectionMatrix();
    } else if (camera.isOrthographicCamera) {
        const newAspect = targetWidth / targetHeight;
        const frustumHeight = camera.top - camera.bottom;

        camera.userData.oldLeft = camera.left;
        camera.userData.oldRight = camera.right;

        camera.left = -frustumHeight * newAspect / 2;
        camera.right = frustumHeight * newAspect / 2;
        camera.updateProjectionMatrix();
    }

    // Force render one frame to the back buffer
    if (pathTracer && pathTracer.isActive) {
        pathTracer.render();
    } else {
        renderer.render(scene, camera);
    }

    // Read from canvas
    const dataURL = renderer.domElement.toDataURL('image/png', 1.0);

    // Restore previous state
    renderer.setPixelRatio(originalPixelRatio);
    renderer.setSize(originalSize.x, originalSize.y);

    if (camera.isPerspectiveCamera) {
        camera.aspect = originalAspect;
        camera.updateProjectionMatrix();
    } else if (camera.isOrthographicCamera) {
        camera.left = camera.userData.oldLeft;
        camera.right = camera.userData.oldRight;
        camera.updateProjectionMatrix();
    }

    // Trigger download
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `3d-text-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
