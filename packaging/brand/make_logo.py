"""Draws the ReVibe mark: a bold pixel R in a yellow-to-red ramp on a dark
rounded tile.

    python packaging/brand/make_logo.py   # writes the SVGs next to this file

The PNG, ICO and tray sizes are rendered from these SVGs by build_icons.sh.
"""
from pathlib import Path

HERE = Path(__file__).parent
BITMAP = [
    "XXXXXXX.",
    "XXXXXXXX",
    "XX....XX",
    "XX....XX",
    "XXXXXXXX",
    "XXXXXXX.",
    "XX..XX..",
    "XX...XX.",
    "XX....XX",
    "XX....XX",
]
COLS, ROWS = len(BITMAP[0]), len(BITMAP)
R = [(c, r) for r, line in enumerate(BITMAP) for c, ch in enumerate(line) if ch == "X"]
RAMP = ["#FFD800", "#FFC800", "#FFB600", "#FFA301", "#FF8F04", "#FF7A06", "#FA640A", "#F44B0C", "#EC2E09", "#E10500"]


def cells(cell: float, ox: float, oy: float, gap: float) -> str:
    out = []
    for col, row in R:
        x = ox + col * cell
        y = oy + row * cell
        out.append(f'<rect x="{x + gap / 2:.1f}" y="{y + gap / 2:.1f}" width="{cell - gap:.1f}" '
                   f'height="{cell - gap:.1f}" rx="{cell * 0.14:.1f}" fill="{RAMP[row]}"/>')
    return "\n    ".join(out)


def tile(size: int = 512) -> str:
    cell = size * 0.058
    width, height = COLS * cell, ROWS * cell
    ox, oy = (size - width) / 2, (size - height) / 2
    r = size * 0.22
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#232327"/>
      <stop offset="1" stop-color="#121214"/>
    </linearGradient>
  </defs>
  <rect width="{size}" height="{size}" rx="{r:.0f}" fill="url(#bg)"/>
  <rect x="1.5" y="1.5" width="{size - 3}" height="{size - 3}" rx="{r - 1.5:.0f}" fill="none" stroke="#ffffff" stroke-opacity="0.07" stroke-width="3"/>
  <g>
    {cells(cell, ox, oy, cell * 0.1)}
  </g>
</svg>
'''


def glyph(size: int = 64) -> str:
    """The R alone, transparent, for the favicon and small UI places."""
    cell = size / (ROWS + 0.6)
    ox, oy = (size - COLS * cell) / 2, (size - ROWS * cell) / 2
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">
  {cells(cell, ox, oy, cell * 0.06)}
</svg>
'''


def tray(size: int = 64) -> str:
    """Monochrome R for the system tray (the desktop tints template icons)."""
    cell = size / (ROWS + 0.6)
    ox, oy = (size - COLS * cell) / 2, (size - ROWS * cell) / 2
    rects = "".join(
        f'<rect x="{ox + c * cell:.1f}" y="{oy + r * cell:.1f}" width="{cell:.1f}" height="{cell:.1f}" fill="#ffffff"/>'
        for c, r in R)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">{rects}</svg>\n'


if __name__ == "__main__":
    (HERE / "revibe.svg").write_text(tile())
    (HERE / "revibe-glyph.svg").write_text(glyph())
    (HERE / "revibe-tray.svg").write_text(tray())
    print("wrote", ", ".join(p.name for p in sorted(HERE.glob("*.svg"))))
