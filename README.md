# Charm? Brutalist Landing Page

A standalone, brutalist-styled landing page with a light cream color theme.

## Files Included

- `index.html` - Main HTML structure
- `styles.css` - All styling and design
- `script.js` - Interactive functionality

## How to Use

### Option 1: Direct Opening
Simply open `index.html` in your web browser (double-click the file).

### Option 2: Local Server (Recommended)
Use a local server for the best experience:
- VS Code: Right-click `index.html` → "Open with Live Server"
- Python: `python -m http.server 8000`
- Node.js: `npx serve`
- Then visit `http://localhost:8000` (or your chosen port)

## How to Edit

### Changing Text
Open `index.html` and edit the text content:
- Profile name/subtitle in `<div class="profile-text">`
- Project titles/descriptions in `.project-card` elements
- Bio content in `<div class="bio-text">`

### Changing Colors
Open `styles.css` and modify color values:
- Page background: `background-color: #faf4e1;` (body)
- Text color: `color: #000;`
- Social icons: `.social-icon` styles
- Project cards: `style="background-color: #e07a5f;"` in HTML

### Changing Links
Update the `href` attributes in `index.html`:
```html
<a href="your-new-link.html" ...>
```

### Adding/Removing Projects
Find the `.project-grid` section in `index.html`. Each project is a complete `.project-card` block:
```html
<a href="your-link.html" class="project-card" style="background-color: #your-color;">
    <div class="project-image">
        <span class="project-letter">First Letter</span>
    </div>
    <div class="project-info">
        <h3 class="project-title">Project Name</h3>
        <p class="project-desc">Short description</p>
    </div>
</a>
```

### Adding Images (Optional)
To replace color placeholders with actual images:

1. Add your images to this folder (e.g., `project1.png`)
2. In `index.html`, replace the `.project-image` div content:
```html
<div class="project-image">
    <img src="project1.png" alt="Project Name" class="actual-image">
</div>
```

3. Add to `styles.css`:
```css
.project-image img.actual-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: grayscale(100%);
    transition: filter 0.3s ease;
}

.project-card:hover .project-image img.actual-image {
    filter: grayscale(0%);
}
```

## Design Features

- **Brutalist Style**: Bold borders, heavy shadows, monospace typography
- **Cream Theme**: Light cream background (#faf4e1) with black accents
- **Responsive**: Works on mobile, tablet, and desktop
- **Smooth Scrolling**: Animated scroll to sections
- **Hover Effects**: Interactive cards and buttons
- **Sticky Social Bar**: Social icons that move on scroll

## Customization Tips

### Border Thickness
Search for `border: 4px solid #000;` and change `4px` to your preferred thickness.

### Shadow Intensity
Find `box-shadow: 6px 6px 0px 0px rgba(0, 0, 0, 1);` and adjust the pixel values.

### Font Size
Modify font-size values in `styles.css`:
- `.main-title`: Main heading size
- `.project-title`: Card heading size
- `body`: Base text size

### Spacing
Adjust `gap`, `margin`, and `padding` values to change spacing between elements.

## Browser Support

Works in all modern browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## Technical Details

- **No frameworks** - Pure HTML/CSS/JavaScript
- **No build tools** required
- **No dependencies**
- **Responsive** design with media queries
- **Semantic HTML** structure

## License

Free to use and modify for personal projects.
