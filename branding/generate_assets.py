from __future__ import annotations

import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
BRANDING_DIR = ROOT / "branding"
ICONS_DIR = ROOT / "public" / "icons"
MARKETPLACE_DIR = ROOT / "public" / "marketplace"


ICON_SIZES = (16, 32, 48, 128, 256, 512)


def render_svg(svg_path: Path, out_path: Path, size: int | None = None) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    command = ["/usr/bin/sips"]
    if size is not None:
        command.extend(["-z", str(size), str(size)])
    command.extend(["-s", "format", "png", str(svg_path), "--out", str(out_path)])

    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(
            f"Failed to render {svg_path.name}: {result.stderr or result.stdout}".strip()
        )


def generate_assets() -> None:
    icon_svg = BRANDING_DIR / "dom-racer-icon.svg"
    tile_svg = BRANDING_DIR / "dom-racer-store-tile.svg"
    cover_svg = BRANDING_DIR / "dom-racer-store-cover.svg"

    for size in ICON_SIZES:
        render_svg(icon_svg, ICONS_DIR / f"icon{size}.png", size)

    render_svg(icon_svg, MARKETPLACE_DIR / "dom-racer-icon-512.png", 512)
    render_svg(tile_svg, MARKETPLACE_DIR / "dom-racer-promo-tile-440x280.png")
    render_svg(cover_svg, MARKETPLACE_DIR / "dom-racer-store-cover-1280x800.png")


if __name__ == "__main__":
    generate_assets()
    print("DOM Racer branding assets generated.")
