export class UI {
    constructor(callbacks) {
        this.callbacks = Object.assign({
            onTextChange: () => { },
            onDepthChange: () => { },
            onBevelChange: () => { },
            onCameraModeChange: () => { },
            onMaterialModeChange: () => { },
            onExport: () => { }
        }, callbacks);

        this.container = document.getElementById('ui-container');
        this.textInput = document.getElementById('text-input');
        this.depthSlider = document.getElementById('extrude-slider');
        this.bevelSlider = document.getElementById('bevel-slider');
        this.cameraMode = document.getElementById('camera-mode');
        this.materialMode = document.getElementById('material-mode');

        this.exportWidth = document.getElementById('export-width');
        this.exportHeight = document.getElementById('export-height');
        this.exportDpi = document.getElementById('export-dpi');
        this.exportBtn = document.getElementById('export-btn');

        this.initListeners();
        this.initFadeLogic();
    }

    initListeners() {
        this.textInput.addEventListener('input', () => {
            this.callbacks.onTextChange(this.textInput.value);
        });

        this.depthSlider.addEventListener('input', () => {
            this.callbacks.onDepthChange(parseFloat(this.depthSlider.value));
        });

        this.bevelSlider.addEventListener('input', () => {
            this.callbacks.onBevelChange(parseFloat(this.bevelSlider.value));
        });

        this.cameraMode.addEventListener('change', () => {
            this.callbacks.onCameraModeChange(this.cameraMode.value);
        });

        this.materialMode.addEventListener('change', () => {
            this.callbacks.onMaterialModeChange(this.materialMode.value);
        });

        this.exportBtn.addEventListener('click', () => {
            this.callbacks.onExport({
                width: parseInt(this.exportWidth.value, 10),
                height: parseInt(this.exportHeight.value, 10),
                dpi: parseInt(this.exportDpi.value, 10)
            });
        });
    }

    initFadeLogic() {
        let fadeTimeout;
        const resetFade = () => {
            this.container.classList.remove('faded');
            clearTimeout(fadeTimeout);
            fadeTimeout = setTimeout(() => {
                if (
                    document.activeElement !== this.textInput &&
                    document.activeElement !== this.exportWidth &&
                    document.activeElement !== this.exportHeight
                ) {
                    this.container.classList.add('faded');
                }
            }, 3000);
        };

        window.addEventListener('mousemove', resetFade);
        window.addEventListener('keydown', resetFade);
        window.addEventListener('click', resetFade);
        this.container.addEventListener('mouseenter', resetFade);
        resetFade();
    }
}
