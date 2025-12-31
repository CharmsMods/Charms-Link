// ============================================
// BRUTALIST LANDING PAGE - JAVASCRIPT
// ============================================

// Social bar scroll behavior
const socialBar = document.getElementById('socialBar');

window.addEventListener('scroll', () => {
    const heroSection = document.getElementById('hero');
    const heroHeight = heroSection.offsetHeight;

    if (window.scrollY > heroHeight / 2) {
        socialBar.classList.add('scrolled');
    } else {
        socialBar.classList.remove('scrolled');
    }
});

// Smooth scroll to bio section
function scrollToBio() {
    const bioSection = document.getElementById('bio');
    bioSection.scrollIntoView({ behavior: 'smooth' });
}

// Add loading animation
document.addEventListener('DOMContentLoaded', () => {
    const projectCards = document.querySelectorAll('.project-card');

    projectCards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';

        setTimeout(() => {
            card.style.transition = 'opacity 0.6s ease, transform 0.6s ease, box-shadow 0.15s ease, transform 0.15s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 100 * index);
    });
});
