"""Builds src/main/resources/icon.png: the original Mars artwork with three tiles (city, greenery, ocean).

Starts from src/main/icons/icon-base.png (the artwork before the tiles, with its small cream hex),
paints over that hex, and draws the three tiles clustered where it was, in the planet's lower right.
Afterwards, regenerate the .ico: scripts/generate-windows-installer-icon.ps1.
Requires Pillow: python scripts/generate-app-icon.py
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / "src" / "main" / "icons" / "icon-base.png"
OUT = ROOT / "src" / "main" / "resources" / "icon.png"

PLANET = (191, 82, 42, 255)
PLANET_CENTER = (512, 509)
PLANET_RADIUS = 268
OLD_HEX_CENTER = (620, 673)
OLD_HEX_BOX = (570, 628, 671, 718)   # the original cream hex, padded

CITY = (192, 198, 206)
FOREST = (46, 122, 56)
OCEAN = (33, 108, 186)
EDGE = (96, 38, 18)

R = 58          # tile circumradius
GAP = 7         # space between tiles
OUTLINE = 4     # dark edge around each tile
SCALE = 4       # supersampling for smooth, rounded edges


def hex_points(x, y, r):
    return [(x + r * math.cos(math.radians(a)), y + r * math.sin(math.radians(a))) for a in range(-90, 270, 60)]


def main():
    im = Image.open(BASE).convert("RGBA")
    ImageDraw.Draw(im).rectangle(OLD_HEX_BOX, fill=PLANET)

    # Cluster centre: toward the old hex, pulled in far enough that every tile stays on the planet.
    dx, dy = OLD_HEX_CENTER[0] - PLANET_CENTER[0], OLD_HEX_CENTER[1] - PLANET_CENTER[1]
    dist = math.hypot(dx, dy)
    reach = (math.sqrt(3) * R + GAP) / math.sqrt(3) + R + 14
    pull = min(dist, PLANET_RADIUS - reach)
    cx = PLANET_CENTER[0] + dx / dist * pull
    cy = PLANET_CENTER[1] + dy / dist * pull

    # Pointy-top tiles, all touching: city on top, greenery and ocean below, like tiles on the Mars board.
    d = math.sqrt(3) * R + GAP
    k = d / math.sqrt(3)
    tiles = [((cx, cy - k), CITY), ((cx - d / 2, cy + k / 2), FOREST), ((cx + d / 2, cy + k / 2), OCEAN)]

    w, h = im.size
    layer = Image.new("RGBA", (w * SCALE, h * SCALE), (0, 0, 0, 0))
    for (x, y), color in tiles:
        for r, fill in ((R, EDGE), (R - OUTLINE, color)):
            mask = Image.new("L", layer.size, 0)
            ImageDraw.Draw(mask).polygon(hex_points(x * SCALE, y * SCALE, r * SCALE), fill=255)
            # Blur then threshold: rounded corners like the original hex.
            mask = mask.filter(ImageFilter.GaussianBlur(5 * SCALE)).point(lambda v: 255 if v > 128 else 0)
            layer.paste(Image.new("RGBA", layer.size, fill + (255,)), (0, 0), mask)

    im.alpha_composite(layer.resize((w, h), Image.LANCZOS))
    im.save(OUT)
    print(f"wrote {OUT.relative_to(ROOT)} (tiles centred at {cx:.0f}, {cy:.0f})")


if __name__ == "__main__":
    main()
