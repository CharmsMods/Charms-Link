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
// STARTUP SEQUENCE
// ============================================

async function initStartupSequence() {
    const overlay = document.getElementById('startupOverlay');
    const startupImg = document.getElementById('startupImage');
    const startupText = document.getElementById('startupText');
    const startupLoader = document.getElementById('startupLoader');
    const placeholderUrl = "images/load.png";
    const flashImages = ["images/flash1.png", "images/flash2.webp", "images/flash3.webp"];

    if (!overlay || !startupImg || !startupText) return;

    // Helper: Wait for a specific duration
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Step 1: Preload all images
    const preloadImages = () => {
        return new Promise((resolve) => {
            const allImages = [placeholderUrl, ...flashImages];
            let loadedCount = 0;

            // Fallback timeout to ensure we don't get stuck forever
            const timeoutId = setTimeout(() => {
                console.warn("Preload timed out. Proceeding...");
                resolve();
            }, 8000);

            allImages.forEach(url => {
                const img = new Image();
                img.src = url;
                img.onload = img.onerror = () => {
                    loadedCount++;
                    if (loadedCount === allImages.length) {
                        clearTimeout(timeoutId);
                        resolve();
                    }
                };
            });
        });
    };

    // Step 2: Fade out the loader
    const hideLoader = async () => {
        if (!startupLoader) return;
        startupLoader.classList.remove('show');
        startupLoader.classList.add('fade-out');
        await wait(600); // Wait for CSS transition (0.5s + buffer)
        startupLoader.classList.add('hidden');
        await wait(200); // Small "black screen" pause for separation
    };

    // Step 3: Fade in the initial image
    const fadeInInitialImage = async () => {
        startupImg.src = placeholderUrl;
        const imgContainer = document.querySelector('.startup-image-container');
        if (imgContainer) {
            imgContainer.style.opacity = '1';
            await wait(1000); // wait for fade-in transition
        }
    };

    // Step 4: Animate and wait for text
    const runTextAnimation = async () => {
        startupText.classList.add('animate');
        await wait(1800); // Length of the CSS animation
        await wait(200);  // Post-animation pause
    };

    // Step 5: Flash sequence
    const runFlashSequence = async () => {
        for (const url of flashImages) {
            startupImg.src = url;
            await wait(400); // Delay between each flash
        }
        await wait(800); // Delay after the last flash
    };

    // Step 6: Reveal the main site
    const transitionToSite = async () => {
        overlay.classList.add('fade-out');
        startupText.classList.add('fade-out');
        await wait(2000); // Matches the 2s opacity transition in CSS
        overlay.style.display = 'none';
    };

    // --- EXECUTE THE STORY ---

    // Show loader immediately
    if (startupLoader) startupLoader.classList.add('show');

    // 1. Wait for loading
    await preloadImages();

    // 2. Hide loader and clear the stage
    await hideLoader();

    // 3. Show the first image
    await fadeInInitialImage();

    // 4. Run the text animation
    await runTextAnimation();

    // 5. Run the flash images
    await runFlashSequence();

    // 6. Goodnight overlay
    await transitionToSite();
}

// Initialize startup sequence
initStartupSequence();
