import os
import re
import json
import sys
from pathlib import Path

def find_image_files(directory='.'):
    """Find all image files following the naming convention."""
    image_files = set()
    for filename in os.listdir(directory):
        if filename.endswith('.png') and not filename.endswith(' compare.png'):
            base_name = filename[:-4]  # Remove .png extension
            image_files.add(base_name)
    return sorted(list(image_files))

def update_html_file(html_path, image_names):
    """Update the HTML file with the new image names."""
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Create the new FILE_BASE_NAMES array
    new_array = 'const FILE_BASE_NAMES = [\n' + \
                ',\n'.join(f'    "{name}"' for name in image_names) + '\n];'
    
    # Use a more robust regex pattern to find and replace the array
    pattern = r'(const\s+FILE_BASE_NAMES\s*=\s*\[[^\]]*\])'
    new_content, count = re.subn(
        pattern,
        new_array,
        content,
        flags=re.DOTALL
    )
    
    if count == 0:
        print("Error: Could not find FILE_BASE_NAMES array in the HTML file.")
        return False
    
    # Create a backup of the original file
    backup_path = html_path + '.bak'
    if not os.path.exists(backup_path):
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Created backup at: {backup_path}")
    
    # Write the updated content
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    return True

def main():
    # Get the directory of the current script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    html_path = os.path.join(script_dir, 'index.html')
    
    if not os.path.exists(html_path):
        print(f"Error: Could not find index.html at {html_path}")
        return
    
    print("Scanning for image files...")
    image_names = find_image_files(script_dir)
    
    if not image_names:
        print("No image files found in the directory.")
        return
    
    print(f"Found {len(image_names)} images:")
    for name in image_names:
        print(f"  - {name}")
    
    print("\nUpdating HTML file...")
    if update_html_file(html_path, image_names):
        print("Successfully updated index.html")
    else:
        print("Failed to update index.html")

if __name__ == "__main__":
    # Keep the console window open after execution
    try:
        main()
    except Exception as e:
        print(f"An error occurred: {str(e)}")
    finally:
        if sys.platform == 'win32':
            input("\nPress Enter to exit...")