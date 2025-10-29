// Debug script to check button functionality
console.log('=== Button Debug Script ===');

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    
    // Check if elements exist
    const filePickerBtn = document.getElementById('file-picker-btn');
    const imagePickerBtn = document.getElementById('image-picker-btn');
    const fileInput = document.getElementById('file-input');
    const imageInput = document.getElementById('image-input');
    
    console.log('Elements found:', {
        filePickerBtn: !!filePickerBtn,
        imagePickerBtn: !!imagePickerBtn,
        fileInput: !!fileInput,
        imageInput: !!imageInput
    });
    
    if (filePickerBtn) {
        console.log('File picker button properties:', {
            id: filePickerBtn.id,
            className: filePickerBtn.className,
            disabled: filePickerBtn.disabled,
            style: filePickerBtn.style.cssText,
            offsetWidth: filePickerBtn.offsetWidth,
            offsetHeight: filePickerBtn.offsetHeight,
            visible: filePickerBtn.offsetParent !== null
        });
        
        // Test click handler
        filePickerBtn.addEventListener('click', (e) => {
            console.log('File picker button clicked!', e);
            if (fileInput) {
                console.log('Triggering file input click');
                fileInput.click();
            } else {
                console.error('File input not found!');
            }
        });
        
        // Test if button is clickable
        setTimeout(() => {
            console.log('Testing programmatic click on file picker button');
            filePickerBtn.click();
        }, 1000);
    } else {
        console.error('File picker button not found!');
    }
    
    if (imagePickerBtn) {
        console.log('Image picker button properties:', {
            id: imagePickerBtn.id,
            className: imagePickerBtn.className,
            disabled: imagePickerBtn.disabled,
            style: imagePickerBtn.style.cssText,
            offsetWidth: imagePickerBtn.offsetWidth,
            offsetHeight: imagePickerBtn.offsetHeight,
            visible: imagePickerBtn.offsetParent !== null
        });
        
        // Test click handler
        imagePickerBtn.addEventListener('click', (e) => {
            console.log('Image picker button clicked!', e);
            if (imageInput) {
                console.log('Triggering image input click');
                imageInput.click();
            } else {
                console.error('Image input not found!');
            }
        });
        
        // Test if button is clickable
        setTimeout(() => {
            console.log('Testing programmatic click on image picker button');
            imagePickerBtn.click();
        }, 2000);
    } else {
        console.error('Image picker button not found!');
    }
    
    // Check if file inputs work
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            console.log('File input changed:', e.target.files[0]);
        });
    }
    
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            console.log('Image input changed:', e.target.files[0]);
        });
    }
    
    // Check if app is initialized
    setTimeout(() => {
        console.log('App instance:', window.app);
        if (window.app) {
            console.log('App properties:', {
                currentMode: window.app.currentMode,
                currentInputType: window.app.currentInputType,
                selectedFile: window.app.selectedFile,
                selectedImage: window.app.selectedImage
            });
        }
    }, 3000);
});

// Check for any JavaScript errors
window.addEventListener('error', (e) => {
    console.error('JavaScript Error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled Promise Rejection:', e.reason);
});