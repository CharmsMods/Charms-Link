(function() {
    const intensity = 6; // Lower number = more movement
    const smoothness = 0.15; // Lower number = smoother movement

    function isMobileDevice() {
        return window.innerWidth <= 1024;
    }

    // Core parallax creator that can be reused for any background element
    function createParallaxBackground(targetElement, options) {
        if (!targetElement) return;

        const mobileOnly = options && options.mobileOnly;

        let targetX = 0;
        let targetY = 0;
        let currentX = 0;
        let currentY = 0;

        // Make the background larger to allow for more movement
        targetElement.style.backgroundSize = '150%';
        targetElement.style.backgroundPosition = 'center';

        function updateBackground() {
            currentX += (targetX - currentX) * smoothness;
            currentY += (targetY - currentY) * smoothness;

            const centerX = 50;
            const centerY = 50;
            const newX = centerX + currentX;
            const newY = centerY + currentY;

            targetElement.style.backgroundPosition = `${newX}% ${newY}%`;

            requestAnimationFrame(updateBackground);
        }

        updateBackground();

        function handleMouseMove(e) {
            if (mobileOnly && !isMobileDevice()) return;

            const mouseX = (e.clientX / window.innerWidth) * 2 - 1;
            const mouseY = (e.clientY / window.innerHeight) * 2 - 1;

            targetX = mouseX * intensity;
            targetY = mouseY * intensity;
        }

        function handleTouchMove(e) {
            if (e.touches.length === 0) return;
            if (mobileOnly && !isMobileDevice()) return;

            const touch = e.touches[0];
            const touchX = (touch.clientX / window.innerWidth) * 2 - 1;
            const touchY = (touch.clientY / window.innerHeight) * 2 - 1;

            targetX = touchX * intensity * 0.8;
            targetY = touchY * intensity * 0.8;
        }

        function resetPosition() {
            targetX = 0;
            targetY = 0;
        }

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('touchmove', handleTouchMove, { passive: true });
        document.addEventListener('mouseleave', resetPosition);
        document.addEventListener('touchend', resetPosition);
    }

    // Keep existing behavior for mobile background on load
    document.addEventListener('DOMContentLoaded', function() {
        const mobileBg = document.getElementById('mobile-bg');
        if (isMobileDevice() && mobileBg) {
            createParallaxBackground(mobileBg, { mobileOnly: true });
        }
    });

    // Expose a function so desktop fallback can opt-in to parallax when Vanta is disabled
    window.startDesktopParallaxFallback = function() {
        const desktopBg = document.getElementById('desktop-fallback-bg');
        if (desktopBg) {
            createParallaxBackground(desktopBg, { mobileOnly: false });
        }
    };
})();
