document.addEventListener('DOMContentLoaded', function() {
    // Get the scroll down button and target section
    const scrollButton = document.querySelector('.scroll-circle');
    const targetSection = document.getElementById('editing-section');

    // Add click event listener to the scroll button
    if (scrollButton && targetSection) {
        scrollButton.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Scroll to the target section with smooth behavior
            targetSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            
            // Add a class to the scroll button when clicked
            this.classList.add('clicked');
            
            // Remove the class after animation completes
            setTimeout(() => {
                this.classList.remove('clicked');
            }, 300);
        });
    }
});
