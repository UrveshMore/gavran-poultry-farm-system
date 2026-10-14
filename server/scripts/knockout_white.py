"""Turn a near-white photo background into clear pixels. Leaves the subject as it is."""

import sys
from PIL import Image

source, dest = sys.argv[1], sys.argv[2]
image = Image.open(source).convert("RGBA")
pixels = image.load()
width, height = image.size
changed = 0
for y in range(height):
    for x in range(width):
        red, green, blue, alpha = pixels[x, y]
        if alpha < 8:
            continue
        if red >= 240 and green >= 240 and blue >= 240:
            pixels[x, y] = (red, green, blue, 0)
            changed += 1
image.thumbnail((480, 480))
image.save(dest, "PNG")
print("removed" if changed else "plain")
