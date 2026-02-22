import { state, UI } from './store.js';
import { loadNewImage, reallocateBuffers } from '../webgl/core.js';
import { requestRender, renderFrame } from '../webgl/pipeline.js';
import { updateUIMode } from '../ui/dom_helpers.js';

export async function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.src = url;
        img.onload = () => {
            loadNewImage(img);
            URL.revokeObjectURL(url);
            resolve();
        };
        img.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(err);
        };
    });
}

export async function loadFolder() {
    try {
        const dirHandle = await window.showDirectoryPicker();
        const imageFiles = [];
        const allFiles = [];

        async function scan(handle, path = "") {
            for await (const entry of handle.values()) {
                if (entry.kind === 'file') {
                    const file = await entry.getFile();
                    file.relativePath = path; // Store for export
                    allFiles.push(file);
                    if (file.type.startsWith('image/')) {
                        imageFiles.push(file);
                    }
                } else if (entry.kind === 'directory') {
                    await scan(entry, path + entry.name + "/");
                }
            }
        }

        UI.loading.textContent = 'SCANNING FOLDER...';
        UI.loading.style.display = 'block';
        await scan(dirHandle);
        UI.loading.style.display = 'none';

        if (imageFiles.length > 0) {
            state.imageFiles = imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
            state.allFiles = allFiles; // Store all files for replica export
            state.isMultiImageMode = true;
            state.currentImageIndex = 0;
            await loadImageFromFile(state.imageFiles[0]);
            updateUIMode();
        } else {
            alert('No images found in the selected folder.');
        }
    } catch (err) {
        console.error('Error loading folder:', err);
        UI.loading.style.display = 'none';
        if (err.name !== 'AbortError') {
            alert('Could not load folder. Please ensure your browser supports the File System Access API and you have granted permission.');
        }
    }
}

export async function changeImage(direction) {
    if (!state.isMultiImageMode || state.imageFiles.length === 0) return;

    let newIndex = state.currentImageIndex + direction;

    if (newIndex < 0) return;
    if (newIndex >= state.imageFiles.length) return;

    state.currentImageIndex = newIndex;
    await loadImageFromFile(state.imageFiles[state.currentImageIndex]);
    updateUIMode();
}

export async function downloadSingleImage() {
    UI.loading.textContent = 'PROCESSING GPU...';
    UI.loading.style.display = 'block';
    await new Promise(r => setTimeout(r, 50));

    reallocateBuffers(true);
    renderFrame(true);

    const link = document.createElement('a');
    const originalName = state.isMultiImageMode ? state.imageFiles[state.currentImageIndex].name.split('.')[0] : 'grain-export';
    link.download = `${originalName}-processed.png`;
    link.href = state.canvas.toDataURL('image/png', 1.0);
    link.click();

    reallocateBuffers(false);
    requestRender();
    UI.loading.style.display = 'none';
}

export async function downloadAllImages() {
    let dirHandle;
    try {
        dirHandle = await window.showDirectoryPicker();
    } catch (err) {
        if (err.name === 'AbortError') return;
        alert('Could not open directory. Permission denied.');
        return;
    }

    state.isExporting = true;
    const overlay = UI['export-overlay'];
    overlay.style.display = 'flex';

    const stopExportHandler = () => {
        state.isExporting = false;
    };
    UI.stopExportBtn.addEventListener('click', stopExportHandler);

    const originalIndex = state.currentImageIndex;
    const filesToExport = state.keepFolderStructure ? state.allFiles : state.imageFiles;

    try {
        for (let i = 0; i < filesToExport.length; i++) {
            if (!state.isExporting) {
                alert('Export cancelled.');
                break;
            }

            const file = filesToExport[i];
            UI['export-status'].textContent = `EXPORTING ${i + 1}/${filesToExport.length}...`;

            try {
                let targetDir = dirHandle;
                if (state.keepFolderStructure && file.relativePath) {
                    const parts = file.relativePath.split("/").filter(p => p !== "");
                    for (const part of parts) {
                        targetDir = await targetDir.getDirectoryHandle(part, { create: true });
                    }
                }

                // Check if this file is one of the images we should process
                const isProcessableImage = state.imageFiles.includes(file);

                if (isProcessableImage) {
                    await loadImageFromFile(file);
                    reallocateBuffers(true);
                    renderFrame(true);

                    const blob = await new Promise(resolve => state.canvas.toBlob(resolve, 'image/png'));
                    const exportName = state.keepFolderStructure ? file.name : `${i + 1}.png`;
                    const fileHandle = await targetDir.getFileHandle(exportName, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                } else if (state.keepFolderStructure) {
                    // Non-image file or non-processable: Copy directly
                    const fileHandle = await targetDir.getFileHandle(file.name, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(file);
                    await writable.close();
                }
            } catch (err) {
                console.error(`Error exporting ${file.name}:`, err);
            }
            await new Promise(r => setTimeout(r, 10)); // Yield to main thread
        }
        if (state.isExporting) {
            alert(`Export Complete. Processed ${state.imageFiles.length} images and copied ${state.allFiles.length - state.imageFiles.length} other files.`);
        }
    } finally {
        state.isExporting = false;
        overlay.style.display = 'none';
        UI.stopExportBtn.removeEventListener('click', stopExportHandler);

        // Restore to the image that was active before downloading
        await loadImageFromFile(state.imageFiles[originalIndex]);
        state.currentImageIndex = originalIndex;
        updateUIMode();
        reallocateBuffers(false);
        requestRender();
    }
}

