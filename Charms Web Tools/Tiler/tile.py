# tile_image.py
# Place this script in the same folder as the image(s). Run: python tile_image.py
# Requires: Pillow (pip install pillow)

from PIL import Image
import os, sys

PRESET_TARGETS = {"1":"1024", "2":"2048", "3":"4096", "4":"8192", "0":"full", "5":"all"}

def find_images(folder="."):
    exts = (".png", ".jpg", ".jpeg")
    return [f for f in os.listdir(folder) if f.lower().endswith(exts) and os.path.isfile(os.path.join(folder, f))]

def choose_image(files):
    if not files:
        print("No PNG/JPG images found in the current directory.")
        sys.exit(1)
    if len(files) == 1:
        return files[0]
    print("Found these images:")
    for i,f in enumerate(files,1):
        print(f"  {i}. {f}")
    while True:
        sel = input("Enter the image number to use (or filename): ").strip()
        if sel.isdigit():
            idx = int(sel)-1
            if 0 <= idx < len(files):
                return files[idx]
        elif sel in files:
            return sel
        print("Invalid selection.")

def parse_tiles_input(s):
    s = s.strip().lower()
    if "x" in s:
        parts = s.split("x")
        try:
            w = int(parts[0]); h = int(parts[1]); return max(1,w), max(1,h)
        except: return None
    else:
        try:
            n = int(s); return max(1,n), max(1,n)
        except: return None

def get_tile_counts():
    prompt = ("Enter how many times to tile the image.\n"
              " - Single number (e.g. 3) tiles both axes.\n"
              " - Use WxH (e.g. 4x2) for width x height.\n"
              "Enter tiles (default 3): ")
    while True:
        s = input(prompt).strip()
        if s == "": return 3,3
        parsed = parse_tiles_input(s)
        if parsed: return parsed
        print("Couldn't parse input. Examples: 3  or  4x2")

def choose_output_target():
    print("Output resolution target (final image's LONGER side will be this size):")
    print("  0) full (no change except spacing applied)")
    print("  1) 1k  (1024)")
    print("  2) 2k  (2048)")
    print("  3) 4k  (4096)")
    print("  4) 8k  (8192)")
    print("  5) all (produce full + 1k + 2k + 4k + 8k)")
    while True:
        sel = input("Choose 0/1/2/3/4/5 (default 0): ").strip() or "0"
        if sel in PRESET_TARGETS:
            return PRESET_TARGETS[sel]
        print("Invalid choice.")

def ask_spacing():
    while True:
        s = input("Enter horizontal spacing between tiles in pixels (default 0): ").strip()
        if s == "": sx = 0; break
        try:
            sx = int(s); break
        except:
            print("Enter an integer.")
    while True:
        s = input("Enter vertical spacing between tiles in pixels (default 0): ").strip()
        if s == "": sy = 0; break
        try:
            sy = int(s); break
        except:
            print("Enter an integer.")
    return max(0,sx), max(0,sy)

def safe_save(img, base_name, suffix):
    name, ext = os.path.splitext(base_name)
    if ext == "": ext = ".png"
    out_name = f"{name}_tiled_{suffix}{ext}"
    if not os.path.exists(out_name):
        img.save(out_name)
        return out_name
    i = 1
    while True:
        alt = f"{name}_tiled_{suffix}_{i}{ext}"
        if not os.path.exists(alt):
            img.save(alt)
            return alt
        i += 1

def make_gap_from_edge(img, dir, size):
    # dir: 'vertical' -> create (size, img.height) from right-edge column
    # dir: 'horizontal' -> create (img.width, size) from bottom-edge row
    w,h = img.size
    if dir == "vertical":
        col = img.crop((w-1, 0, w, h))  # 1px wide
        return col.resize((size, h), resample=Image.NEAREST)
    else:
        row = img.crop((0, h-1, w, h))  # 1px tall
        return row.resize((w, size), resample=Image.NEAREST)

def make_corner_gap(img, sx, sy):
    w,h = img.size
    pix = img.crop((w-1,h-1,w,h))  # 1x1
    return pix.resize((sx,sy), resample=Image.NEAREST)

def build_tiled_with_spacing(img, tiles_x, tiles_y, sx, sy):
    w,h = img.size
    out_w = tiles_x * w + max(0, tiles_x-1) * sx
    out_h = tiles_y * h + max(0, tiles_y-1) * sy
    canvas = Image.new(img.mode, (out_w, out_h))
    # paste tiles and gaps
    for row in range(tiles_y):
        for col in range(tiles_x):
            x = col * (w + sx)
            y = row * (h + sy)
            canvas.paste(img, (x, y))
            # vertical gap to the right of this tile
            if col < tiles_x - 1 and sx > 0:
                vgap = make_gap_from_edge(img, "vertical", sx)
                canvas.paste(vgap, (x + w, y))
            # horizontal gap below this tile
            if row < tiles_y - 1 and sy > 0:
                hgap = make_gap_from_edge(img, "horizontal", sy)
                canvas.paste(hgap, (x, y + h))
            # corner gap (below-right)
            if col < tiles_x - 1 and row < tiles_y - 1 and sx > 0 and sy > 0:
                cgap = make_corner_gap(img, sx, sy)
                canvas.paste(cgap, (x + w, y + h))
    return canvas

def resize_to_target(img, target_max_side):
    if target_max_side == "full":
        return img
    target = int(target_max_side)
    w,h = img.size
    max_side = max(w,h)
    if max_side == target:
        return img
    scale = target / max_side
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    return img.resize((new_w, new_h), resample=Image.LANCZOS)

def main():
    files = find_images()
    img_name = choose_image(files)
    try:
        src = Image.open(img_name).convert("RGBA")
    except Exception as e:
        print(f"Error opening image '{img_name}': {e}")
        sys.exit(1)

    tiles_x, tiles_y = get_tile_counts()
    target_choice = choose_output_target()
    sx, sy = ask_spacing()

    full_tiled = build_tiled_with_spacing(src, tiles_x, tiles_y, sx, sy)
    fw, fh = full_tiled.size
    print(f"Full tiled (with spacing) resolution: {fw} x {fh}")

    targets = []
    if target_choice == "all":
        targets = ["full","1024","2048","4096","8192"]
    else:
        targets = [target_choice]

    saved = []
    for t in targets:
        out_img = resize_to_target(full_tiled, t)
        suffix = f"{tiles_x}x{tiles_y}"
        if sx or sy:
            suffix += f"_sp{sx}x{sy}"
        suffix += f"_{t}"
        path = safe_save(out_img, img_name, suffix)
        saved.append((t, path, out_img.size))

    print("Saved outputs:")
    for t, path, size in saved:
        print(f"  {t}: {path}  ({size[0]} x {size[1]})")

if __name__ == "__main__":
    main()
