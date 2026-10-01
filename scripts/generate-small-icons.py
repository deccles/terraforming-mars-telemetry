"""Draws the small icons, where the full app icon's detail is lost.

- Tray (src/main/resources/tray/tray-N.png): Mars filling the square with the three tiles as a lower-right badge.
- Desktop (src/main/icons/desktop-N.png): the same on a trimmed navy tile; generate-windows-installer-icon.ps1
  puts these in the .ico for 16-48 px and uses the full icon.png for larger sizes.
- Page logo (src/main/resources/web/logo.png): the tray art at 96 px, shown at 48 px in the page header.

The planet's surface (its darker patches) is the app icon's Mars from src/main/icons/icon-base.png, with the
teal arc and the cream hex removed. Everything else is drawn at 8x from shapes and scaled down once per size,
so each size is as sharp as it can be.
Requires Pillow and NumPy: python scripts/generate-small-icons.py
"""
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
TRAY_SIZES = (16, 20, 24, 32, 40, 48)
DESKTOP_SIZES = (16, 32, 48)

NAVY = (14, 33, 66)
PLANET = (191, 82, 42)
RIM = (92, 34, 16)
EDGE = (60, 22, 10)
CITY = (205, 211, 218)
FOREST = (46, 140, 58)
OCEAN = (40, 118, 200)
SUPER = 8
BASE = ROOT / "src" / "main" / "icons" / "icon-base.png"
BASE_PLANET = (512, 509, 268)        # centre and radius of Mars in icon-base.png
BASE_HEX_BOX = (570, 628, 671, 718)  # its cream hex, padded
PATCH_CONTRAST = 1.6
LOWER_RIGHT = (0.55, 0.835)  # same direction as the tiles on the app icon


def hex_points(x, y, r):
    return [(x + r * math.cos(math.radians(a)), y + r * math.sin(math.radians(a))) for a in range(-90, 270, 60)]


def mars_surface():
    """The artwork's Mars as a square RGB image, without the teal arc or the cream hex."""
    im = Image.open(BASE).convert("RGB")
    ImageDraw.Draw(im).rectangle(BASE_HEX_BOX, fill=PLANET)
    cx, cy, r = BASE_PLANET
    c = np.asarray(im.crop((cx - r, cy - r, cx + r, cy + r))).astype(float)
    yy, xx = np.mgrid[0:2 * r, 0:2 * r]
    inside = (xx - r + 0.5) ** 2 + (yy - r + 0.5) ** 2 < (r - 3) ** 2
    arc = (c[..., 1] > c[..., 0] - 60) & inside  # teal: green close to red; the surface is all red
    arc = np.asarray(Image.fromarray((arc * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(17))) > 0
    # Fill the arc from the surface around it, a wider blur at a time, so the patches it crossed carry on under it.
    valid = inside & ~arc
    for radius in (3, 6, 10, 16, 24, 40):
        todo = arc & ~valid
        weight = np.asarray(Image.fromarray((valid * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))) / 255
        sums = np.stack([np.asarray(Image.fromarray((c[..., k] * valid).astype(np.uint8))
                                    .filter(ImageFilter.GaussianBlur(radius))) for k in range(3)], -1).astype(float)
        ok = todo & (weight > 0.02)
        c[ok] = sums[ok] / weight[ok][:, None]
        valid = valid | ok
    # Deepen the darker patches a little so they still read at tray sizes.
    c = PLANET + (c - PLANET) * PATCH_CONTRAST
    return Image.fromarray(c.clip(0, 255).astype(np.uint8))


SURFACE = mars_surface()


def draw_planet(img, d, cx, cy, radius, rim):
    d.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=RIM)
    inner = radius - rim
    box = (round(cx - inner), round(cy - inner), round(cx + inner), round(cy + inner))
    size = box[2] - box[0]
    disk = Image.new("L", (size, size), 0)
    ImageDraw.Draw(disk).ellipse((0, 0, size - 1, size - 1), fill=255)
    img.paste(SURFACE.resize((size, size), Image.LANCZOS), box[:2], disk)


def draw_tiles(d, pcx, pcy, planet_r, r, gap, outline, bounds):
    """Three touching pointy-top tiles, shifted toward the lower right as far as `bounds` allows."""
    dist = math.sqrt(3) * r + gap
    k = dist / math.sqrt(3)
    ux, uy = LOWER_RIGHT
    lo, hi = bounds

    def centres(t):
        x0, y0 = pcx + ux * t, pcy + uy * t
        return ((x0, y0 - k), (x0 - dist / 2, y0 + k / 2), (x0 + dist / 2, y0 + k / 2))

    def fits(t):
        return all(lo <= px <= hi and lo <= py <= hi for c in centres(t) for px, py in hex_points(c[0], c[1], r))

    t, step = 0.0, planet_r * 0.004
    while t < planet_r * 0.5 and fits(t + step):  # half the radius: as far out as the app icon's tiles
        t += step
    for (x, y), color in zip(centres(t), (CITY, FOREST, OCEAN)):
        d.polygon(hex_points(x, y, r), fill=EDGE)
        d.polygon(hex_points(x, y, r - outline), fill=color)


def tray(size):
    s = size * SUPER
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rim = max(1.0, size / 16) * SUPER
    draw_planet(img, d, s / 2, s / 2, s / 2 - 0.5, rim)
    # Over the rim like a badge, into the square's empty lower-right corner.
    draw_tiles(d, s / 2, s / 2, s / 2, r=0.165 * s, gap=0.025 * s,
               outline=max(0.9, size / 20) * SUPER, bounds=(0.02 * s, s - 0.02 * s))
    return img.resize((size, size), Image.LANCZOS)


def desktop(size):
    s = size * SUPER
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    margin = 0.03 * s                              # the full icon's margin is ~8%; trimmed to give the planet room
    d.rounded_rectangle((margin, margin, s - margin, s - margin), radius=0.2 * s, fill=NAVY)
    planet_r = 0.36 * s
    draw_planet(img, d, s / 2, s / 2, planet_r, max(0.6, size / 32) * SUPER)
    draw_tiles(d, s / 2, s / 2, planet_r, r=0.13 * s, gap=0.02 * s,
               outline=max(0.8, size / 24) * SUPER, bounds=(margin + 0.05 * s, s - margin - 0.05 * s))
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    tray_dir = ROOT / "src" / "main" / "resources" / "tray"
    desktop_dir = ROOT / "src" / "main" / "icons"
    tray_dir.mkdir(parents=True, exist_ok=True)
    desktop_dir.mkdir(parents=True, exist_ok=True)
    for size in TRAY_SIZES:
        tray(size).save(tray_dir / f"tray-{size}.png")
    for size in DESKTOP_SIZES:
        desktop(size).save(desktop_dir / f"desktop-{size}.png")
    # The page header's logo mark: the tray art, at 2x its 48 px display size for sharp high-DPI screens.
    tray(96).save(ROOT / "src" / "main" / "resources" / "web" / "logo.png")
    print(f"wrote {len(TRAY_SIZES)} tray and {len(DESKTOP_SIZES)} desktop icons, and the page logo")
