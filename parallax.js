document.addEventListener('DOMContentLoaded', function() {
    const container = document.querySelector('.container');
    const intensity = 8; // Lower number = more movement
    const smoothness = 0.1; // Lower number = smoother movement
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    // Initialize the background container if it doesn't exist
    let backgroundContainer = document.querySelector('.background-container');
    if (!backgroundContainer) {
        backgroundContainer = document.createElement('div');
        backgroundContainer.className = 'background-container';
        backgroundContainer.innerHTML = '<div class="background-image"></div>';
        document.body.insertBefore(backgroundContainer, container);
    }

    // Get the background image element
    const backgroundImage = document.querySelector('.background-image');

    // Make the background larger to allow for more movement
    backgroundImage.style.width = '150%';
    backgroundImage.style.height = '150%';
    backgroundImage.style.top = '-25%';
    backgroundImage.style.left = '-25%';

    // Handle mouse movement with requestAnimationFrame for smoother animation
    function updateBackground() {
        // Smooth the movement
        currentX += (targetX - currentX) * smoothness;
        currentY += (targetY - currentY) * smoothness;
        
        // Apply the transform with perspective for a more dynamic effect
        backgroundImage.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        
        requestAnimationFrame(updateBackground);
    }
    
    // Start the animation loop
    updateBackground();

    // Update target position on mouse move
    document.addEventListener('mousemove', function(e) {
        // Calculate position from -1 to 1
        const mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        const mouseY = (e.clientY / window.innerHeight) * 2 - 1;
        
        // Calculate movement (increased range)
        targetX = mouseX * intensity * 2;
        targetY = mouseY * intensity * 2;
    });

    // Update target position on touch move
    document.addEventListener('touchmove', function(e) {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            const mouseX = (touch.clientX / window.innerWidth) * 2 - 1;
            const mouseY = (touch.clientY / window.innerHeight) * 2 - 1;
            
            // Slightly reduced movement for touch devices
            targetX = mouseX * intensity * 1.5;
            targetY = mouseY * intensity * 1.5;
        }
    }, { passive: true });

    // Reset position when mouse/touch leaves the window
    function resetPosition() {
        targetX = 0;
        targetY = 0;
    }

    document.addEventListener('mouseleave', resetPosition);
    document.addEventListener('touchend', resetPosition);
});
