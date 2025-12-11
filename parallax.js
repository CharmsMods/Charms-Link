document.addEventListener('DOMContentLoaded', function() {
    const intensity = 6; // Lower number = more movement
    const smoothness = 0.15; // Lower number = smoother movement
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    // Check if we're on mobile/tablet
    function isMobileDevice() {
        return window.innerWidth <= 1024;
    }

    // Get the mobile background element
    const mobileBg = document.getElementById('mobile-bg');
    
    // Only initialize parallax on mobile devices with mobile background
    if (!isMobileDevice() || !mobileBg) {
        return; // Exit if not mobile or no mobile background element
    }

    // Make the background larger to allow for more movement
    mobileBg.style.backgroundSize = '150%';
    mobileBg.style.backgroundPosition = 'center';
    
    // Store original background size
    const originalBgSize = mobileBg.style.backgroundSize;

    // Handle mouse/touch movement with requestAnimationFrame for smoother animation
    function updateBackground() {
        // Smooth the movement
        currentX += (targetX - currentX) * smoothness;
        currentY += (targetY - currentY) * smoothness;
        
        // Apply the background position shift for parallax effect
        const centerX = 50; // Center position percentage
        const centerY = 50; // Center position percentage
        
        // Calculate new background position
        const newX = centerX + currentX;
        const newY = centerY + currentY;
        
        mobileBg.style.backgroundPosition = `${newX}% ${newY}%`;
        
        requestAnimationFrame(updateBackground);
    }
    
    // Start the animation loop
    updateBackground();

    // Update target position on mouse move
    document.addEventListener('mousemove', function(e) {
        if (!isMobileDevice()) return; // Only work on mobile devices
        
        // Calculate position from -1 to 1
        const mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        const mouseY = (e.clientY / window.innerHeight) * 2 - 1;
        
        // Calculate movement
        targetX = mouseX * intensity;
        targetY = mouseY * intensity;
    });

    // Update target position on touch move
    document.addEventListener('touchmove', function(e) {
        if (!isMobileDevice() || e.touches.length === 0) return;
        
        const touch = e.touches[0];
        const touchX = (touch.clientX / window.innerWidth) * 2 - 1;
        const touchY = (touch.clientY / window.innerHeight) * 2 - 1;
        
        // Slightly reduced movement for touch devices
        targetX = touchX * intensity * 0.8;
        targetY = touchY * intensity * 0.8;
    }, { passive: true });

    // Reset position when mouse/touch leaves the window
    function resetPosition() {
        targetX = 0;
        targetY = 0;
    }

    document.addEventListener('mouseleave', resetPosition);
    document.addEventListener('touchend', resetPosition);

    // Handle window resize - check if still mobile
    window.addEventListener('resize', function() {
        if (!isMobileDevice()) {
            // Reset background if no longer mobile
            mobileBg.style.backgroundSize = originalBgSize;
            mobileBg.style.backgroundPosition = 'center';
        }
    });
});
