document.addEventListener('DOMContentLoaded', function () {
    const cards = Array.from(document.querySelectorAll('[data-example]'));

    const modal = document.getElementById('example-modal');
    const modalCanvas = document.getElementById('example-modal-canvas');
    const modalClose = document.getElementById('example-modal-close');

    let modalInstance = null;

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function drawSplit(ctx, canvas, beforeImg, afterImg, splitX) {
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        // Right side: after (base)
        ctx.drawImage(afterImg, 0, 0, w, h);

        // Left side: before (clipped)
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, splitX, h);
        ctx.clip();
        ctx.drawImage(beforeImg, 0, 0, w, h);
        ctx.restore();

        // divider
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(splitX - 1, 0, 2, h);

        // subtle handle
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

    function setupExampleCanvas(card, canvas, beforeSrc, afterSrc) {
        const ctx = canvas.getContext('2d', { alpha: true });
        let beforeImg = null;
        let afterImg = null;
        const exampleId = typeof card?.getAttribute === 'function' ? card.getAttribute('data-example') : '';
        const isBgRemover = (typeof exampleId === 'string' && exampleId.startsWith('bg-')) || (card && card.classList && card.classList.contains('bgremover-card'));
        const defaultSplit = isBgRemover ? 0.5 : 0;
        let split = defaultSplit;

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

        function render() {
            if (!beforeImg || !afterImg) return;
            resizeToDisplaySize();
            const splitX = Math.round(canvas.width * split);
            drawSplit(ctx, canvas, beforeImg, afterImg, splitX);
        }

        function setSplitFromEvent(e) {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            split = clamp(x, 0, 1);
            render();
        }

        function resetToDefault() {
            split = defaultSplit;
            render();
        }

        Promise.all([loadImage(beforeSrc), loadImage(afterSrc)])
            .then(([b, a]) => {
                beforeImg = b;
                afterImg = a;

                // Match element aspect ratio to the image so it isn't stretched.
                // Prefer the before image dimensions.
                if (beforeImg && beforeImg.naturalWidth && beforeImg.naturalHeight) {
                    canvas.style.setProperty('--example-aspect', `${beforeImg.naturalWidth} / ${beforeImg.naturalHeight}`);
                }

                render();
            })
            .catch(() => {
                // If images fail to load, keep canvas blank.
            });

        card.addEventListener('mousemove', setSplitFromEvent);
        card.addEventListener('mouseenter', setSplitFromEvent);
        card.addEventListener('mouseleave', resetToDefault);

        // fallback behavior on touch: tap cycles split
        card.addEventListener('touchstart', function (e) {
            if (!beforeImg || !afterImg) return;
            split = split >= 0.99 ? 0.01 : split + 0.33;
            split = clamp(split, 0.01, 0.99);
            render();
        }, { passive: true });

        window.addEventListener('resize', render);

        return {
            render,
            setSplit: (value) => {
                split = clamp(value, 0, 1);
                render();
            },
            getImages: () => ({ beforeSrc, afterSrc })
        };
    }

    const instances = new Map();

    function openModal(beforeSrc, afterSrc) {
        if (!modal || !modalCanvas) return;

        modal.classList.add('is-open');
        document.body.style.overflow = 'hidden';

        // Setup (or re-setup) modal canvas with same sources
        const modalCard = { addEventListener: () => {} };
        modalInstance = setupExampleCanvas(modalCard, modalCanvas, beforeSrc, afterSrc);
        const isBgRemover = typeof beforeSrc === 'string' && beforeSrc.includes('Background Remover Examples');
        modalInstance.setSplit(isBgRemover ? 0.5 : 0);
    }

    cards.forEach((card) => {
        const canvas = card.querySelector('canvas');
        const beforeSrc = card.getAttribute('data-before');
        const afterSrc = card.getAttribute('data-after');
        if (!canvas || !beforeSrc || !afterSrc) return;

        const instance = setupExampleCanvas(card, canvas, beforeSrc, afterSrc);
        instances.set(card, instance);

        card.addEventListener('click', function () {
            openModal(beforeSrc, afterSrc);
        });

        card.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openModal(beforeSrc, afterSrc);
            }
        });
    });

    function closeModal() {
        if (!modal) return;
        modal.classList.remove('is-open');
        document.body.style.overflow = '';
        modalInstance = null;
    }

    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }

    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeModal();
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal && modal.classList.contains('is-open')) {
            closeModal();
        }
    });

    // Allow mousemove to control split when modal is open
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
