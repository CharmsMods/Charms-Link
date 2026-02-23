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
// ============================================
// ARCHITECTURE POPUP LOGIC
// ============================================

const architectureBtn = document.getElementById('architectureBtn');
const architectureOverlay = document.getElementById('architectureOverlay');
const closePopup = document.getElementById('closePopup');

if (architectureBtn && architectureOverlay) {
    architectureBtn.addEventListener('click', (e) => {
        e.preventDefault();
        architectureOverlay.classList.add('active');
    });

    closePopup.addEventListener('click', () => {
        architectureOverlay.classList.remove('active');
    });

    architectureOverlay.addEventListener('click', (e) => {
        if (e.target === architectureOverlay) {
            architectureOverlay.classList.remove('active');
        }
    });

    // Handle escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && architectureOverlay.classList.contains('active')) {
            architectureOverlay.classList.remove('active');
        }
    });
}

// ============================================
// CUSTOM CURSOR LOGIC
// ============================================

const cursor = document.getElementById('cursor');

if (cursor) {
    // Track mouse movement
    document.addEventListener('mousemove', (e) => {
        cursor.style.transform = `translate3d(calc(${e.clientX}px - 50%), calc(${e.clientY}px - 50%), 0)`;
    });

    // Handle hover states for interactive elements
    const interactiveElements = 'a, button, .project-card, .social-icon, .popup-link, .popup-close';

    document.addEventListener('mouseover', (e) => {
        if (e.target.closest(interactiveElements)) {
            cursor.classList.add('hovered');
        }
    });

    document.addEventListener('mouseout', (e) => {
        if (e.target.closest(interactiveElements)) {
            cursor.classList.remove('hovered');
        }
    });
}

// ============================================
// MAGNETIC ELEMENTS LOGIC
// ============================================

document.addEventListener('mousemove', (e) => {
    const magneticElements = document.querySelectorAll('.magnetic');

    magneticElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const deltaX = e.clientX - centerX;
        const deltaY = e.clientY - centerY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        const maxDistance = 100; // Pull radius
        const strength = 15;    // Max pull strength in pixels

        if (distance < maxDistance) {
            const pullX = (deltaX / maxDistance) * strength;
            const pullY = (deltaY / maxDistance) * strength;
            el.style.transform = `translate3d(${pullX}px, ${pullY}px, 0)`;
        } else {
            el.style.transform = `translate3d(0, 0, 0)`;
        }
    });

    // Parallax Dot Background
    const body = document.body;
    const moveX = (e.clientX / window.innerWidth - 0.5) * 20; // max 10px shift
    const moveY = (e.clientY / window.innerHeight - 0.5) * 20;
    body.style.backgroundPosition = `calc(50% + ${moveX}px) calc(50% + ${moveY}px)`;
});

// ============================================
// SCROLL ANIMATION OBSERVER
// ============================================

const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
        } else {
            entry.target.classList.remove('reveal-visible');
        }
    });
}, {
    root: null,
    threshold: 0.15, // Trigger when 15% visible
    rootMargin: "0px"
});

document.addEventListener('DOMContentLoaded', () => {
    const revealElements = document.querySelectorAll('.reveal-on-scroll');
    revealElements.forEach(el => revealObserver.observe(el));
});
// ============================================
// DOWNLOAD CONFIRMATION
// ============================================

function confirmDownload() {
    const url = "Cream Mod.zip";
    if (confirm("Would you like to download Cream Mod made by Charm?")) {
        const link = document.createElement('a');
        link.href = url;
        link.download = "Cream Mod.zip";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
