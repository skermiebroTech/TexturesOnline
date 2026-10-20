"""Writes the smaller AVIF copies of the guide screenshots that the pages offer through srcset.

For each public/screenshots/guides/<name>.jpg (made by tests/harness/seo/guide-screenshots.cjs) it
writes <name>-640w.avif (phones) and <name>-<width>w.avif at the original width. A 960px copy is not
worth it: these UI shots compress about as well at full size. The JPEG stays as the fallback and the
link-preview image. The widths must match VARIANT_WIDTHS in src/app/responsive-image.ts.

Run after changing a screenshot (needs Pillow 11.3+ with AVIF support):
    python3 scripts/screenshot-variants.py [--force]
"""

import sys
from pathlib import Path

from PIL import Image, features

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "public" / "screenshots" / "guides"
VARIANT_WIDTHS = (640,)
QUALITY = 55  # visually the same as the source JPEG (which already has q80 artifacts) at about half the size
SPEED = 4


def widths_for(width: int) -> list[int]:
    return [w for w in VARIANT_WIDTHS if w < width] + [width]


def main() -> None:
    if not features.check("avif"):
        sys.exit("This Pillow has no AVIF support (pip install --upgrade pillow)")
    force = "--force" in sys.argv[1:]
    wanted: set[Path] = set()
    for jpg in sorted(SHOTS.glob("*.jpg")):
        with Image.open(jpg) as src:
            im = src.convert("RGB")
        for w in widths_for(im.width):
            out = jpg.with_name(f"{jpg.stem}-{w}w.avif")
            wanted.add(out)
            if not force and out.exists() and out.stat().st_mtime >= jpg.stat().st_mtime:
                continue
            h = round(im.height * w / im.width)
            img = im if w == im.width else im.resize((w, h), Image.Resampling.LANCZOS)
            img.save(out, "AVIF", quality=QUALITY, speed=SPEED)
            print(f"{out.relative_to(ROOT)}  {w}x{h}  {out.stat().st_size // 1024} KB")
    for stale in SHOTS.glob("*.avif"):
        if stale not in wanted:
            stale.unlink()
            print(f"removed {stale.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
