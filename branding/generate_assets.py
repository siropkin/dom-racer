from __future__ import annotations

import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
BRANDING_DIR = ROOT / "branding"
ICONS_DIR = ROOT / "public" / "icons"
MARKETPLACE_DIR = ROOT / "public" / "marketplace"


ICON_SIZES = (16, 32, 48, 128, 256, 512)


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.strip() + "\n", encoding="utf-8")


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


def build_icon_svg() -> str:
    return """
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="144" y1="96" x2="908" y2="928" gradientUnits="userSpaceOnUse">
      <stop stop-color="#8B5CF6"/>
      <stop offset="0.52" stop-color="#2563EB"/>
      <stop offset="1" stop-color="#06B6D4"/>
    </linearGradient>
    <linearGradient id="carBody" x1="512" y1="226" x2="512" y2="776" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FB7185"/>
      <stop offset="0.58" stop-color="#F43F5E"/>
      <stop offset="1" stop-color="#BE123C"/>
    </linearGradient>
    <linearGradient id="glass" x1="512" y1="314" x2="512" y2="566" gradientUnits="userSpaceOnUse">
      <stop stop-color="#E0F2FE"/>
      <stop offset="1" stop-color="#93C5FD"/>
    </linearGradient>
    <filter id="shadow" x="138" y="142" width="748" height="756" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="22" stdDeviation="26" flood-color="#0F172A" flood-opacity="0.28"/>
    </filter>
    <pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse">
      <path d="M56 0H0V56" stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="2"/>
    </pattern>
  </defs>

  <rect x="72" y="72" width="880" height="880" rx="240" fill="url(#bg)"/>
  <rect x="72" y="72" width="880" height="880" rx="240" fill="url(#grid)"/>

  <path d="M352 178C393 126 473 92 552 92C631 92 710 126 752 178L826 270C839 287 829 312 808 316L216 432C194 436 176 413 184 392L217 309C246 237 297 210 352 178Z" fill="#0F172A" fill-opacity="0.22"/>
  <path d="M470 186C485 160 539 160 554 186L612 286C625 309 608 338 582 338H442C416 338 399 309 412 286L470 186Z" fill="#F8FAFC" fill-opacity="0.2"/>
  <path d="M762 186L836 264" stroke="#FFFFFF" stroke-opacity="0.22" stroke-width="16" stroke-linecap="round"/>
  <path d="M262 280L176 388" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="18" stroke-linecap="round"/>

  <g filter="url(#shadow)">
    <ellipse cx="512" cy="792" rx="252" ry="78" fill="#0F172A" fill-opacity="0.26"/>
    <rect x="294" y="228" width="436" height="560" rx="174" fill="url(#carBody)"/>
    <rect x="346" y="286" width="332" height="218" rx="96" fill="url(#glass)"/>
    <rect x="384" y="320" width="94" height="126" rx="34" fill="#DBEAFE"/>
    <rect x="546" y="320" width="94" height="126" rx="34" fill="#BFDBFE"/>
    <path d="M352 560C352 523 382 494 419 494H605C642 494 672 523 672 560V642C672 679 642 708 605 708H419C382 708 352 679 352 642V560Z" fill="#1F2937" fill-opacity="0.18"/>
    <path d="M442 594C467 621 557 621 582 594" stroke="#FDE68A" stroke-width="22" stroke-linecap="round"/>
    <rect x="326" y="542" width="64" height="114" rx="28" fill="#F59E0B"/>
    <rect x="634" y="542" width="64" height="114" rx="28" fill="#F59E0B"/>
    <circle cx="388" cy="588" r="18" fill="#FFF7ED"/>
    <circle cx="636" cy="588" r="18" fill="#FFF7ED"/>
    <rect x="332" y="706" width="88" height="58" rx="24" fill="#111827"/>
    <rect x="604" y="706" width="88" height="58" rx="24" fill="#111827"/>
    <rect x="362" y="238" width="300" height="26" rx="13" fill="#FFFFFF" fill-opacity="0.28"/>
  </g>

  <g>
    <circle cx="778" cy="252" r="74" fill="#F59E0B"/>
    <circle cx="778" cy="252" r="58" fill="#FCD34D"/>
    <path d="M778 216V288" stroke="#7C2D12" stroke-width="18" stroke-linecap="round"/>
    <path d="M744 252H812" stroke="#7C2D12" stroke-width="18" stroke-linecap="round"/>
  </g>

  <g fill="#FFFFFF">
    <path d="M254 212L266 244L298 256L266 268L254 300L242 268L210 256L242 244L254 212Z" fill-opacity="0.88"/>
    <path d="M188 544L196 564L216 572L196 580L188 600L180 580L160 572L180 564L188 544Z" fill-opacity="0.72"/>
    <path d="M820 650L830 676L856 686L830 696L820 722L810 696L784 686L810 676L820 650Z" fill-opacity="0.82"/>
  </g>

  <rect x="142" y="142" width="740" height="740" rx="208" stroke="#FFFFFF" stroke-opacity="0.18" stroke-width="8"/>
</svg>
"""


def build_store_tile_svg() -> str:
    return """
<svg width="440" height="280" viewBox="0 0 440 280" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="20" y1="18" x2="420" y2="262" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0F172A"/>
      <stop offset="0.5" stop-color="#312E81"/>
      <stop offset="1" stop-color="#0EA5E9"/>
    </linearGradient>
    <linearGradient id="panel" x1="54" y1="48" x2="180" y2="202" gradientUnits="userSpaceOnUse">
      <stop stop-color="#8B5CF6"/>
      <stop offset="1" stop-color="#2563EB"/>
    </linearGradient>
    <linearGradient id="car" x1="118" y1="82" x2="118" y2="192" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FB7185"/>
      <stop offset="1" stop-color="#E11D48"/>
    </linearGradient>
  </defs>

  <rect x="8" y="8" width="424" height="264" rx="36" fill="url(#bg)"/>
  <path d="M34 220C86 172 130 144 192 128C237 116 304 100 404 72" stroke="#67E8F9" stroke-opacity="0.24" stroke-width="18" stroke-linecap="round"/>
  <path d="M26 84C62 102 88 120 126 154" stroke="#A78BFA" stroke-opacity="0.24" stroke-width="12" stroke-linecap="round"/>

  <rect x="38" y="40" width="160" height="160" rx="38" fill="url(#panel)"/>
  <rect x="38" y="40" width="160" height="160" rx="38" stroke="#FFFFFF" stroke-opacity="0.16"/>
  <ellipse cx="118" cy="172" rx="46" ry="14" fill="#0F172A" fill-opacity="0.26"/>
  <rect x="74" y="70" width="88" height="110" rx="32" fill="url(#car)"/>
  <rect x="84" y="82" width="68" height="44" rx="18" fill="#BFDBFE"/>
  <rect x="91" y="88" width="18" height="24" rx="8" fill="#E0F2FE"/>
  <rect x="127" y="88" width="18" height="24" rx="8" fill="#DBEAFE"/>
  <path d="M100 138C105 146 131 146 136 138" stroke="#FDE68A" stroke-width="7" stroke-linecap="round"/>
  <rect x="74" y="122" width="14" height="34" rx="7" fill="#F59E0B"/>
  <rect x="148" y="122" width="14" height="34" rx="7" fill="#F59E0B"/>
  <circle cx="81" cy="138" r="4" fill="#FFF7ED"/>
  <circle cx="155" cy="138" r="4" fill="#FFF7ED"/>
  <circle cx="166" cy="70" r="18" fill="#FBBF24"/>
  <path d="M166 60V80" stroke="#7C2D12" stroke-width="5" stroke-linecap="round"/>
  <path d="M156 70H176" stroke="#7C2D12" stroke-width="5" stroke-linecap="round"/>

  <text x="224" y="102" fill="#F8FAFC" font-size="36" font-weight="800" font-family="Arial, sans-serif">DOM Racer</text>
  <text x="224" y="132" fill="#BFDBFE" font-size="16" font-weight="600" font-family="Arial, sans-serif">Turn page elements into a playful racer.</text>

  <rect x="224" y="156" width="90" height="32" rx="16" fill="#111827" fill-opacity="0.52" stroke="#FFFFFF" stroke-opacity="0.12"/>
  <text x="239" y="177" fill="#FDE68A" font-size="13" font-weight="700" font-family="Arial, sans-serif">LINK LOOT</text>

  <rect x="320" y="156" width="104" height="32" rx="16" fill="#111827" fill-opacity="0.52" stroke="#FFFFFF" stroke-opacity="0.12"/>
  <text x="336" y="177" fill="#BFDBFE" font-size="13" font-weight="700" font-family="Arial, sans-serif">BUTTON BONUS</text>

  <rect x="224" y="198" width="84" height="32" rx="16" fill="#111827" fill-opacity="0.52" stroke="#FFFFFF" stroke-opacity="0.12"/>
  <text x="243" y="219" fill="#FCA5A5" font-size="13" font-weight="700" font-family="Arial, sans-serif">POLICE</text>

  <rect x="316" y="198" width="108" height="32" rx="16" fill="#111827" fill-opacity="0.52" stroke="#FFFFFF" stroke-opacity="0.12"/>
  <text x="336" y="219" fill="#86EFAC" font-size="13" font-weight="700" font-family="Arial, sans-serif">COLOR POWERS</text>
</svg>
"""


def build_store_cover_svg() -> str:
    return """
<svg width="1280" height="800" viewBox="0 0 1280 800" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="84" y1="64" x2="1180" y2="756" gradientUnits="userSpaceOnUse">
      <stop stop-color="#020617"/>
      <stop offset="0.48" stop-color="#312E81"/>
      <stop offset="1" stop-color="#0891B2"/>
    </linearGradient>
    <linearGradient id="browser" x1="152" y1="140" x2="1120" y2="658" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0F172A"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="arena" x1="220" y1="186" x2="1048" y2="610" gradientUnits="userSpaceOnUse">
      <stop stop-color="#111827"/>
      <stop offset="1" stop-color="#1E293B"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#1F2937"/>
      <stop offset="1" stop-color="#0F172A"/>
    </linearGradient>
    <linearGradient id="car" x1="694" y1="286" x2="694" y2="504" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FB7185"/>
      <stop offset="1" stop-color="#E11D48"/>
    </linearGradient>
    <pattern id="grid" width="38" height="38" patternUnits="userSpaceOnUse">
      <path d="M38 0H0V38" stroke="#FFFFFF" stroke-opacity="0.06" stroke-width="1.5"/>
    </pattern>
  </defs>

  <rect width="1280" height="800" fill="url(#bg)"/>
  <path d="M72 648C252 548 386 454 574 420C796 380 1010 430 1214 600" stroke="#67E8F9" stroke-opacity="0.14" stroke-width="28" stroke-linecap="round"/>
  <path d="M138 120C344 172 452 260 630 400" stroke="#A78BFA" stroke-opacity="0.14" stroke-width="18" stroke-linecap="round"/>

  <rect x="140" y="114" width="1000" height="560" rx="34" fill="url(#browser)" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="2"/>
  <rect x="140" y="114" width="1000" height="58" rx="34" fill="#0B1120"/>
  <circle cx="178" cy="143" r="8" fill="#FB7185"/>
  <circle cx="206" cy="143" r="8" fill="#FBBF24"/>
  <circle cx="234" cy="143" r="8" fill="#34D399"/>
  <rect x="274" y="130" width="326" height="26" rx="13" fill="#111827" stroke="#FFFFFF" stroke-opacity="0.08"/>
  <text x="304" y="147" fill="#94A3B8" font-size="14" font-weight="600" font-family="Arial, sans-serif">https://example.com</text>

  <rect x="176" y="186" width="928" height="452" rx="26" fill="url(#arena)"/>
  <rect x="176" y="186" width="928" height="452" rx="26" fill="url(#grid)"/>

  <rect x="214" y="220" width="150" height="86" rx="22" fill="url(#card)" stroke="#FFFFFF" stroke-opacity="0.08"/>
  <text x="238" y="256" fill="#E2E8F0" font-size="19" font-weight="800" font-family="Arial, sans-serif">TIME 01:28</text>
  <text x="238" y="286" fill="#FDE68A" font-size="18" font-weight="700" font-family="Arial, sans-serif">SCORE 170</text>

  <rect x="882" y="216" width="178" height="124" rx="22" fill="url(#card)" stroke="#FFFFFF" stroke-opacity="0.08"/>
  <text x="906" y="250" fill="#BFDBFE" font-size="18" font-weight="800" font-family="Arial, sans-serif">POWERS</text>
  <rect x="906" y="268" width="132" height="18" rx="9" fill="#111827"/>
  <rect x="906" y="268" width="108" height="18" rx="9" fill="#22D3EE"/>
  <text x="906" y="310" fill="#FCA5A5" font-size="16" font-weight="700" font-family="Arial, sans-serif">BLACKOUT 04s</text>

  <rect x="894" y="530" width="166" height="74" rx="22" fill="url(#card)" stroke="#FFFFFF" stroke-opacity="0.08"/>
  <text x="918" y="560" fill="#E2E8F0" font-size="16" font-weight="800" font-family="Arial, sans-serif">PAGE BEST 240</text>
  <text x="918" y="586" fill="#94A3B8" font-size="14" font-weight="700" font-family="Arial, sans-serif">LIFE BEST 780</text>

  <rect x="252" y="336" width="128" height="76" rx="20" fill="#111827" stroke="#A78BFA" stroke-opacity="0.26"/>
  <text x="284" y="381" fill="#E9D5FF" font-size="18" font-weight="700" font-family="Arial, sans-serif">&lt;div&gt;</text>
  <rect x="414" y="268" width="204" height="42" rx="21" fill="#1F2937" stroke="#FCD34D" stroke-opacity="0.26"/>
  <text x="456" y="295" fill="#FDE68A" font-size="16" font-weight="700" font-family="Arial, sans-serif">Link loot</text>
  <rect x="824" y="384" width="112" height="48" rx="18" fill="#1E3A8A" stroke="#93C5FD" stroke-opacity="0.42"/>
  <text x="844" y="414" fill="#DBEAFE" font-size="16" font-weight="700" font-family="Arial, sans-serif">Button</text>
  <rect x="458" y="468" width="164" height="98" rx="22" fill="#0F172A" stroke="#67E8F9" stroke-opacity="0.26"/>
  <text x="496" y="522" fill="#A5F3FC" font-size="18" font-weight="700" font-family="Arial, sans-serif">Boost zone</text>

  <circle cx="810" cy="272" r="24" fill="#FBBF24"/>
  <circle cx="810" cy="272" r="17" fill="#FDE68A"/>
  <path d="M810 258V286" stroke="#7C2D12" stroke-width="7" stroke-linecap="round"/>
  <path d="M796 272H824" stroke="#7C2D12" stroke-width="7" stroke-linecap="round"/>

  <ellipse cx="694" cy="530" rx="128" ry="34" fill="#020617" fill-opacity="0.34"/>
  <rect x="598" y="284" width="192" height="226" rx="70" fill="url(#car)"/>
  <rect x="624" y="312" width="140" height="88" rx="34" fill="#BFDBFE"/>
  <rect x="638" y="326" width="36" height="46" rx="14" fill="#E0F2FE"/>
  <rect x="714" y="326" width="36" height="46" rx="14" fill="#DBEAFE"/>
  <path d="M650 420C664 438 724 438 738 420" stroke="#FDE68A" stroke-width="12" stroke-linecap="round"/>
  <rect x="598" y="390" width="18" height="62" rx="9" fill="#F59E0B"/>
  <rect x="772" y="390" width="18" height="62" rx="9" fill="#F59E0B"/>
  <circle cx="607" cy="420" r="7" fill="#FFF7ED"/>
  <circle cx="781" cy="420" r="7" fill="#FFF7ED"/>
  <rect x="614" y="492" width="44" height="22" rx="11" fill="#020617"/>
  <rect x="730" y="492" width="44" height="22" rx="11" fill="#020617"/>
  <rect x="634" y="288" width="120" height="10" rx="5" fill="#FFFFFF" fill-opacity="0.24"/>

  <path d="M1024 422L1088 394" stroke="#FCA5A5" stroke-width="10" stroke-linecap="round"/>
  <path d="M1034 398L1088 394L1056 442" stroke="#FCA5A5" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="928" y="448" fill="#FCA5A5" font-size="20" font-weight="800" font-family="Arial, sans-serif">WEE-OO</text>

  <text x="140" y="734" fill="#F8FAFC" font-size="54" font-weight="900" font-family="Arial, sans-serif">DOM Racer</text>
  <text x="140" y="772" fill="#BFDBFE" font-size="24" font-weight="600" font-family="Arial, sans-serif">A playful page-overlay racer with loot, powers, and police chases.</text>

  <g fill="#FFFFFF">
    <path d="M1090 106L1102 138L1134 150L1102 162L1090 194L1078 162L1046 150L1078 138L1090 106Z" fill-opacity="0.82"/>
    <path d="M1182 234L1192 258L1216 268L1192 278L1182 302L1172 278L1148 268L1172 258L1182 234Z" fill-opacity="0.66"/>
  </g>
</svg>
"""


def generate_assets() -> None:
    icon_svg = BRANDING_DIR / "dom-racer-icon.svg"
    tile_svg = BRANDING_DIR / "dom-racer-store-tile.svg"
    cover_svg = BRANDING_DIR / "dom-racer-store-cover.svg"

    write_text(icon_svg, build_icon_svg())
    write_text(tile_svg, build_store_tile_svg())
    write_text(cover_svg, build_store_cover_svg())

    for size in ICON_SIZES:
        render_svg(icon_svg, ICONS_DIR / f"icon{size}.png", size)

    render_svg(icon_svg, MARKETPLACE_DIR / "dom-racer-icon-512.png", 512)
    render_svg(tile_svg, MARKETPLACE_DIR / "dom-racer-promo-tile-440x280.png")
    render_svg(cover_svg, MARKETPLACE_DIR / "dom-racer-store-cover-1280x800.png")


if __name__ == "__main__":
    generate_assets()
    print("DOM Racer branding assets generated.")
