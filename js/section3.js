//
// ──────────────────────────────────────────────
// SECTION 3 EXAMPLES: Interactive Before/After Split Gallery
// Handles canvas rendering, modal logic, and user interaction
// ──────────────────────────────────────────────


    // Collect all example cards (with data-example attribute)
    const cards = Array.from(document.querySelectorAll('[data-example]'));

    // Modal elements for fullscreen before/after comparison
    const modal = document.getElementById('example-modal');
    const modalCanvas = document.getElementById('example-modal-canvas');
    const modalClose = document.getElementById('example-modal-close');

    let modalInstance = null; // Holds the current modal canvas logic

    // Utility: Load an image and return a Promise
    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    // Utility: Clamp a value between min and max
    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    // Draws the before/after split on the canvas at splitX
    function drawSplit(ctx, canvas, beforeImg, afterImg, splitX) {
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        // Draw right side: after image (base layer)
        ctx.drawImage(afterImg, 0, 0, w, h);

        // Draw left side: before image, clipped to splitX
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, splitX, h);
        ctx.clip();
        ctx.drawImage(beforeImg, 0, 0, w, h);
        ctx.restore();

        // Draw divider line at split
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(splitX - 1, 0, 2, h);

        // Draw subtle draggable handle (circle)
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.arc(splitX, h * 0.5, Math.max(10, h * 0.035), 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(splitX, h * 0.5, Math.max(10, h * 0.035), 0, Math.PI * 2);
        ctx.stroke();
    }

    // Sets up a before/after split canvas for a card or modal
    function setupExampleCanvas(card, canvas, beforeSrc, afterSrc) {
        const ctx = canvas.getContext('2d', { alpha: true });
        let beforeImg = null;
        let afterImg = null;
        // Determine if this is a background remover example (split starts at 50%)
        const exampleId = typeof card?.getAttribute === 'function' ? card.getAttribute('data-example') : '';
        const isBgRemover = (typeof exampleId === 'string' && exampleId.startsWith('bg-')) || (card && card.classList && card.classList.contains('bgremover-card'));
        const defaultSplit = isBgRemover ? 0.5 : 0; // Default split: 0.5 for bg remover, 0 for others
        let split = defaultSplit;

        // Resize canvas to match display size and device pixel ratio
        function resizeToDisplaySize() {
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const nextW = Math.max(1, Math.round(rect.width * dpr));
            const nextH = Math.max(1, Math.round(rect.height * dpr));

            if (canvas.width !== nextW || canvas.height !== nextH) {
                canvas.width = nextW;
                canvas.height = nextH;
            }
        }

        // Render the current split view
        function render() {
            if (!beforeImg || !afterImg) return;
            resizeToDisplaySize();
            const splitX = Math.round(canvas.width * split);
            drawSplit(ctx, canvas, beforeImg, afterImg, splitX);
        }

        // Set split position from mouse/touch event
        function setSplitFromEvent(e) {
            const rect = canvas.getBoundingClientRect();
            const targetX = (e.clientX - rect.left) / rect.width;
            const targetSplit = clamp(targetX, 0, 1);
            // Cancel any ongoing animation
            if (canvas.animationFrameId) {
                cancelAnimationFrame(canvas.animationFrameId);
            }
            // Immediate response to position
            split = targetSplit;
            render();
            // Start a short smooth animation for a natural feel
            canvas.animationFrameId = requestAnimationFrame(() => {
                const startTime = performance.now();
                const startSplit = split;
                const duration = 100; // ms
                function animate(currentTime) {
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    // Ease in-out for smoothness
                    const easeInOutQuad = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
                    split = startSplit + (targetSplit - startSplit) * easeInOutQuad(progress);
                    render();
                    if (progress < 1) {
                        canvas.animationFrameId = requestAnimationFrame(animate);
                    } else {
                        canvas.animationFrameId = null;
                    }
                }
                canvas.animationFrameId = requestAnimationFrame(animate);
            });
        }

        // Reset split to default (on mouse leave)
        function resetToDefault() {
            if (canvas.animationFrameId) {
                cancelAnimationFrame(canvas.animationFrameId);
            }
            const startTime = performance.now();
            const startSplit = split;
            const duration = 150; // ms
            function animate(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // Ease out for smooth deceleration
                const easeOutQuad = t => t * (2 - t);
                split = startSplit + (defaultSplit - startSplit) * easeOutQuad(progress);
                render();
                if (progress < 1) {
                    canvas.animationFrameId = requestAnimationFrame(animate);
                } else {
                    canvas.animationFrameId = null;
                }
            }
            canvas.animationFrameId = requestAnimationFrame(animate);
        }

        // Load both images, then render the split view
        Promise.all([loadImage(beforeSrc), loadImage(afterSrc)])
            .then(([b, a]) => {
                beforeImg = b;
                afterImg = a;
                // Set aspect ratio CSS variable to prevent stretching
                if (beforeImg && beforeImg.naturalWidth && beforeImg.naturalHeight) {
                    canvas.style.setProperty('--example-aspect', `${beforeImg.naturalWidth} / ${beforeImg.naturalHeight}`);
                }
                render();
            })
            .catch(() => {
                // If images fail to load, keep canvas blank
            });

        // Mouse interaction: drag to set split
        card.addEventListener('mousemove', setSplitFromEvent);
        card.addEventListener('mouseenter', setSplitFromEvent);
        card.addEventListener('mouseleave', resetToDefault);

        // Touch interaction: tap to cycle split position
        card.addEventListener('touchstart', function (e) {
            if (!beforeImg || !afterImg) return;
            if (canvas.animationFrameId) {
                cancelAnimationFrame(canvas.animationFrameId);
            }
            // Cycle split: 0 → 0.33 → 0.66 → 1 → 0
            const targetSplit = split >= 0.99 ? 0.01 : split + 0.33;
            const startTime = performance.now();
            const startSplit = split;
            const duration = 150; // ms
            function animate(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // Ease out back for a slight bounce effect
                const easeOutBack = t => {
                    const c1 = 1.7;
                    const c3 = c1 + 1;
                    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
                };
                split = startSplit + (targetSplit - startSplit) * easeOutBack(progress);
                render();
                if (progress < 1) {
                    canvas.animationFrameId = requestAnimationFrame(animate);
                } else {
                    split = clamp(targetSplit, 0.01, 0.99); // Snap to final value
                    render();
                    canvas.animationFrameId = null;
                }
            }
            canvas.animationFrameId = requestAnimationFrame(animate);
        }, { passive: true });

        // Re-render on window resize
        window.addEventListener('resize', render);

        // Expose render and split setter for modal use
        return {
            render,
            setSplit: (value) => {
                split = clamp(value, 0, 1);
                render();
            },
            getImages: () => ({ beforeSrc, afterSrc })
        };
    }

    // Store all card canvas instances for possible future use
    const instances = new Map();

    // Open the fullscreen modal for a before/after example
    function openModal(beforeSrc, afterSrc) {
        if (!modal || !modalCanvas) return;
        modal.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        // Setup modal canvas with the same logic as cards
        const modalCard = { addEventListener: () => {} }; // Dummy card for modal
        modalInstance = setupExampleCanvas(modalCard, modalCanvas, beforeSrc, afterSrc);
        const isBgRemover = typeof beforeSrc === 'string' && beforeSrc.includes('Background Remover Examples');
        modalInstance.setSplit(isBgRemover ? 0.5 : 0);
    }

    // Initialize all example cards
    cards.forEach((card) => {
        const canvas = card.querySelector('canvas');
        const beforeSrc = card.getAttribute('data-before');
        const afterSrc = card.getAttribute('data-after');
        if (!canvas || !beforeSrc || !afterSrc) return;
        const instance = setupExampleCanvas(card, canvas, beforeSrc, afterSrc);
        instances.set(card, instance);
        // Open modal on click
        card.addEventListener('click', function () {
            openModal(beforeSrc, afterSrc);
        });
        // Open modal on Enter/Space for accessibility
        card.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openModal(beforeSrc, afterSrc);
            }
        });
    });

    // Close the modal and clean up
    function closeModal() {
        if (!modal) return;
        modal.classList.remove('is-open');
        document.body.style.overflow = '';
        modalInstance = null;
    }

    // Modal close button
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }

    // Close modal on background click
    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeModal();
        });
    }

    // Close modal on Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal && modal.classList.contains('is-open')) {
            closeModal();
        }
    });

    // Allow mousemove to control split in modal
    if (modal && modalCanvas) {
        modal.addEventListener('mousemove', function (e) {
            if (!modal.classList.contains('is-open')) return;
            if (!modalInstance) return;
            const rect = modalCanvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            modalInstance.setSplit(x);
        });
    }
});
    }
