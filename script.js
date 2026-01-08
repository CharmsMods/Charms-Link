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

function initStartupSequence() {
    const overlay = document.getElementById('startupOverlay');
    const startupImg = document.getElementById('startupImage');
    const startupText = document.getElementById('startupText');
    const startupLoader = document.getElementById('startupLoader');
    const placeholderUrl = "images/load.png"; // USER: Replace with your local image link
    const flashImages = ["images/flash1.png", "images/flash2.webp", "images/flash3.webp"]; // USER: Replace with your local image links

    let sequenceFinished = false;

    // Show loader immediately
    if (startupLoader) startupLoader.classList.add('show');

    const terminateStartup = () => {
        if (sequenceFinished) return;
        sequenceFinished = true;

        // Wait a moment after the last flash before starting the fade-out
        setTimeout(() => {
            overlay.classList.add('fade-out');
            startupText.classList.add('fade-out'); // Fast fade for the text

            setTimeout(() => {
                overlay.style.display = 'none';
            }, 2000); // Matches the 2s opacity transition in CSS
        }, 1200); // <--- ADJUST THIS DELAY (How long to show the last flash before fading)
    };

    const startFlashSequence = () => {
        // Flash 1
        setTimeout(() => {
            startupImg.src = flashImages[0];

            // Flash 2
            setTimeout(() => {
                startupImg.src = flashImages[1];

                // Flash 3 (The one that zooms)
                setTimeout(() => {
                    startupImg.src = flashImages[2];
                    terminateStartup();
                }, 400);
            }, 400);
        }, 400);
    };

    // 5-second timeout fallback (increased to 8s to account for flashes)
    const timeoutId = setTimeout(() => {
        console.log("Startup timed out, loading site normally.");
        if (startupLoader) startupLoader.classList.remove('show');
        terminateStartup();
    }, 8000);

    const startAnimationSequence = () => {
        clearTimeout(timeoutId);

        // 1. Fade out loader quickly
        if (startupLoader) {
            startupLoader.classList.remove('show');
            startupLoader.classList.add('fade-out');

            // Definitively hide after transition finishes
            setTimeout(() => {
                startupLoader.classList.add('hidden');
                proceedAfterLoader();
            }, 600); // Matches the 0.5s transition
        } else {
            proceedAfterLoader();
        }

        function proceedAfterLoader() {
            // 2. Fade from black to image
            const imgContainer = document.querySelector('.startup-image-container');
            imgContainer.style.opacity = '1';

            // 3. Start text animation after a delay (1s for image fade + 0.5s pause)
            setTimeout(() => {
                startupText.classList.add('animate');

                // 4. Start flash sequence after the text animation ends
                // Text animation is 1.8s. We wait 2.0s total (1.8s + 0.2s pause)
                setTimeout(() => {
                    startFlashSequence();
                }, 2000);
            }, 1500);
        }
    };

    // Preload all images (Initial + Flashes)
    const allImages = [placeholderUrl, ...flashImages];
    let loadedCount = 0;

    allImages.forEach(url => {
        const img = new Image();
        img.src = url;
        img.onload = () => {
            loadedCount++;
            if (loadedCount === allImages.length) {
                startupImg.src = placeholderUrl;
                startAnimationSequence();
            }
        };
        img.onerror = () => {
            // If any image fails, we still try to proceed or fallback
            console.warn(`Failed to preload: ${url}`);
            loadedCount++;
            if (loadedCount === allImages.length) {
                // If all images have been processed (loaded or errored), proceed
                // We might want to set a default image here if placeholderUrl failed
                if (startupImg.src === "") { // Only set if not already set by a successful load
                    startupImg.src = placeholderUrl;
                }
                startAnimationSequence();
            }
        };
    });
}

// Initialize startup sequence
initStartupSequence();
