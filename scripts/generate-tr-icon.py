"""Prints the SVG body of the TR (terraform rating) icon used in app.js RES_ICONS.tr.

After the game's icon: a gridded globe with the Mars arrow, framed by two laurel branches whose leaves
point up the stem, with "TM" centred between the branch ends. Drawn in a 24x24 viewBox on the orange
.res-tr box. Run: python scripts/generate-tr-icon.py [preview.svg] and paste the output into app.js.
"""
import math
import sys

INK = "#1a0f08"
CX, CY, R = 12.0, 10.8, 8.3      # laurel circle, around the globe
NODES = 5                         # leaf pairs per branch
LEAF_LEN, LEAF_W = 2.3, 0.95
SPLAY = math.radians(38)          # how far leaves angle off the stem


def leaf(bx, by, dx, dy):
    """A pointed leaf from base (bx, by) along unit direction (dx, dy)."""
    tx, ty = bx + dx * LEAF_LEN, by + dy * LEAF_LEN
    mx, my = (bx + tx) / 2, (by + ty) / 2
    nx, ny = -dy * LEAF_W, dx * LEAF_W
    return (f"M{bx:.2f} {by:.2f}Q{mx + nx:.2f} {my + ny:.2f} {tx:.2f} {ty:.2f}"
            f"Q{mx - nx:.2f} {my - ny:.2f} {bx:.2f} {by:.2f}Z")


def branch(a0, a1):
    """Stem from the bottom (a0) up the side (a1), degrees; leaves in pairs pointing up the stem."""
    step = 1 if a1 > a0 else -1
    pts, leaves = [], []
    for i in range(NODES + 1):
        a = math.radians(a0 + (a1 - a0) * i / NODES)
        x, y = CX + R * math.cos(a), CY + R * math.sin(a)
        pts.append((x, y))
        if i == 0:
            continue
        ux, uy = -math.sin(a) * step, math.cos(a) * step          # along the stem, toward its top
        rx, ry = math.cos(a), math.sin(a)                         # outward from the circle's centre
        for side in (1, -1):                                      # outside leaf, inside leaf
            dx = ux * math.cos(SPLAY) + side * rx * math.sin(SPLAY)
            dy = uy * math.cos(SPLAY) + side * ry * math.sin(SPLAY)
            leaves.append(leaf(x, y, dx, dy))
    # A single leaf continuing the tip of the branch.
    a = math.radians(a1)
    tx, ty = pts[-1]
    leaves.append(leaf(tx, ty, -math.sin(a) * step, math.cos(a) * step))
    stem = "M" + " ".join(f"{x:.2f} {y:.2f}" for x, y in pts)
    return stem, "".join(leaves)


def arrow():
    """The Mars arrow: a shaft from the globe's upper-right edge to a filled triangular head."""
    d = (math.sqrt(0.5), -math.sqrt(0.5))                    # up and to the right, 45 degrees
    start = (12 + 5 * d[0], 10.4 + 5 * d[1])                  # on the globe's edge
    tip = (start[0] + 4.6 * d[0], start[1] + 4.6 * d[1])      # a little shorter than before
    head_len, head_half = 2.2, 1.35
    base = (tip[0] - head_len * d[0], tip[1] - head_len * d[1])
    px, py = -d[1] * head_half, d[0] * head_half
    return (f'<path fill="none" stroke="{INK}" stroke-width="1.25" stroke-linecap="round" '
            f'd="M{start[0]:.2f} {start[1]:.2f}L{base[0] + 0.3 * d[0]:.2f} {base[1] + 0.3 * d[1]:.2f}"/>'
            f'<path fill="{INK}" stroke="{INK}" stroke-width=".4" stroke-linejoin="round" '
            f'd="M{tip[0]:.2f} {tip[1]:.2f}L{base[0] + px:.2f} {base[1] + py:.2f}L{base[0] - px:.2f} {base[1] - py:.2f}Z"/>')


def svg_body():
    # Branches span 94 degrees in 6 segments; the top segment is trimmed so the right tip stays clear of the arrow.
    seg = 94 / 6
    ls, ll = branch(118, 212 - seg)
    rs, rl = branch(62, -32 + seg)
    return (
        f'<g fill="none" stroke="{INK}" stroke-width="1.1">'
        '<circle cx="12" cy="10.4" r="5"/><ellipse cx="12" cy="10.4" rx="2.05" ry="5"/>'
        '<path d="M7 10.4h10M7.8 7.85h8.4M7.8 12.95h8.4"/></g>'
        + arrow() +
        f'<path fill="none" stroke="{INK}" stroke-width=".6" stroke-linecap="round" d="{ls}{rs}"/>'
        f'<path fill="{INK}" d="{ll}{rl}"/>'
        # Centred between the branch ends, just under the globe.
        f'<text x="12" y="19.5" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" '
        f'font-size="3.3" font-weight="700" fill="{INK}">TM</text>'
    )


if __name__ == "__main__":
    body = svg_body()
    print(body)
    if len(sys.argv) > 1:
        bg = ('<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f59a3a"/>'
              '<stop offset="1" stop-color="#d9651c"/></linearGradient></defs><rect width="24" height="24" rx="2" fill="url(#g)"/>')
        with open(sys.argv[1], "w") as f:
            f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="240" height="240">{bg}{body}</svg>')
