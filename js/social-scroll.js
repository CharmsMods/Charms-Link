document.addEventListener('DOMContentLoaded', function() {
    const socialBar = document.querySelector('.social-bar');
    const body = document.body;
    let ticking = false;

    // Function to update the social bar position
    function updateSocialBar() {
        const scrollPosition = window.scrollY || window.pageYOffset;
        const halfWindowHeight = window.innerHeight / 2;
        
        if (scrollPosition > halfWindowHeight) {
            body.classList.add('scrolled');
        } else {
            body.classList.remove('scrolled');
        }
        
        ticking = false;
    }

    // Throttle the scroll event
    function onScroll() {
        if (!ticking) {
            window.requestAnimationFrame(updateSocialBar);
            ticking = true;
        }
    }

    // Add scroll event listener
    window.addEventListener('scroll', onScroll);

    // Initial check
    updateSocialBar();
});
