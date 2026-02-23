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
    const interactiveElements = 'a, button, .project-card, .social-icon, .popup-link, .popup-close, .mod-grid-item';

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
// CREAM MOD POPUP LOGIC
// ============================================

const creamModOverlay = document.getElementById('creamModOverlay');
const closeCreamPopup = document.getElementById('closeCreamPopup');

function confirmDownload() {
    if (creamModOverlay) {
        creamModOverlay.classList.add('active');
    }
}

if (closeCreamPopup && creamModOverlay) {
    closeCreamPopup.addEventListener('click', () => {
        creamModOverlay.classList.remove('active');
    });

    creamModOverlay.addEventListener('click', (e) => {
        if (e.target === creamModOverlay) {
            creamModOverlay.classList.remove('active');
        }
    });

    // Share escape key logic with Architecture popup
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            creamModOverlay.classList.remove('active');
        }
    });
}

function startDownload() {
    const url = "Cream Mod.zip";
    const link = document.createElement('a');
    link.href = url;
    link.download = "Cream Mod.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================
// IMAGE VIEWER LOGIC
// ============================================

const imageViewerOverlay = document.getElementById('imageViewerOverlay');
const fullscreenImage = document.getElementById('fullscreenImage');
const closeImageViewer = document.getElementById('closeImageViewer');

function openFullscreen(src) {
    if (imageViewerOverlay && fullscreenImage) {
        fullscreenImage.src = src;
        imageViewerOverlay.classList.add('active');
    }
}

if (closeImageViewer && imageViewerOverlay) {
    closeImageViewer.addEventListener('click', () => {
        imageViewerOverlay.classList.remove('active');
    });

    imageViewerOverlay.addEventListener('click', () => {
        imageViewerOverlay.classList.remove('active');
    });

    // Share escape logic
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            imageViewerOverlay.classList.remove('active');
        }
    });
}
// ============================================
// CURSOR CONNECTION LINES
// ============================================

const canvas = document.getElementById('line-canvas');
const ctx = canvas.getContext('2d');
let mouseX = 0;
let mouseY = 0;
let targetsCached = [];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function updateTargets() {
    targetsCached = Array.from(document.querySelectorAll('.highlight, .bordered')).filter(el => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        // Skip elements that are effectively invisible or have no size
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) <= 0) return false;
        if (rect.width === 0 || rect.height === 0) return false;

        // Skip elements inside inactive popups/overlays
        const overlay = el.closest('.popup-overlay');
        if (overlay && !overlay.classList.contains('active')) return false;

        // Ensure it has a valid position in the DOM (unless fixed)
        if (el.offsetParent === null && style.position !== 'fixed') return false;

        // Ensure it doesn't contain a large image (muffin-image is okay)
        const images = Array.from(el.getElementsByTagName('img'));
        const hasLargeImage = images.some(img => !img.classList.contains('muffin-image'));

        return !hasLargeImage && el.tagName !== 'IMG';
    });
}

// Initial setup
window.addEventListener('resize', () => {
    resizeCanvas();
    updateTargets();
});

window.addEventListener('scroll', () => {
    updateTargets();
    // Manual redraw trigger for high-frequency scroll events
    if (targetsCached.length > 0) {
        drawLines();
    }
}, { passive: true });

document.addEventListener('DOMContentLoaded', updateTargets);
document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

// Watch for popup changes
const observer = new MutationObserver(updateTargets);
observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });

function drawLines() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Disable lines if any popup overlay is open
    const anyActivePopup = document.querySelector('.popup-overlay.active');
    if (anyActivePopup) {
        requestAnimationFrame(drawLines);
        return;
    }

    const threshold = 250;

    targetsCached.forEach(target => {
        const rect = target.getBoundingClientRect();

        // Skip if the element is completely outside the viewport
        if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
            return;
        }

        const targetX = rect.left + rect.width / 2;
        const targetY = rect.top + rect.height / 2;

        const distance = Math.sqrt(Math.pow(mouseX - targetX, 2) + Math.pow(mouseY - targetY, 2));

        if (distance < threshold) {
            ctx.beginPath();
            ctx.moveTo(mouseX, mouseY);
            ctx.lineTo(targetX, targetY);

            const opacity = 1 - (distance / threshold);
            ctx.strokeStyle = `rgba(0, 0, 0, ${opacity * 0.9})`;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    });

    requestAnimationFrame(drawLines);
}

// Kick off
resizeCanvas();
updateTargets();
drawLines();
