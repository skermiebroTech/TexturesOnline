#!/usr/bin/env python3
"""Splits a full Texel build into the file every page loads and an extension loaded on demand.

  <out_base>.woff2      Basic Latin, Latin-1, general punctuation, arrows and the few symbols the UI
                        uses (about 4 KB: preloaded by every page)
  <out_base>-ext.woff2  everything else (Latin Extended, Greek, Cyrillic, symbols); the browser only
                        downloads it for text that needs one of those characters (unicode-range)

The font has no kerning or ligatures, so text renders the same as with the single file. The
unicode-range descriptors in src/styles/tokens.css must match: the script prints the extension's.

Usage (after tests/tools/ui/build-font.py, on its full .ttf output or a full .woff2):
  python3 tests/tools/ui/split-font.py texel-regular.ttf public/fonts/texel-regular
  python3 tests/tools/ui/split-font.py texel-bold.ttf    public/fonts/texel-bold
"""
import sys
from fontTools import subset
from fontTools.ttLib import TTFont

# Keep in step with the first @font-face rules in src/styles/tokens.css.
CORE = [(0x0000, 0x00FF), (0x2000, 0x206F), (0x20AC, 0x20AC), (0x2122, 0x2122), (0x2190, 0x21FF), (0x2212, 0x2212), (0x2318, 0x2318)]


def in_core(cp: int) -> bool:
    return any(a <= cp <= b for a, b in CORE)


def ranges(cps: list[int]) -> str:
    """Whole Unicode blocks (as in build-font.py's FALLBACK_RANGES) that hold the given characters, minus CORE."""
    blocks = [(0x0100, 0x024F), (0x0250, 0x02FF), (0x0370, 0x03FF), (0x0400, 0x04FF), (0x1E00, 0x1EFF), (0x2070, 0x209F), (0x20A0, 0x20CF),
              (0x2100, 0x214F), (0x2150, 0x218F), (0x2200, 0x22FF), (0x2300, 0x23FF), (0x25A0, 0x25FF), (0x2600, 0x26FF), (0x2700, 0x27BF)]
    used = [cp for cp in range(0x2800) if any(a <= cp <= b for a, b in blocks) and not in_core(cp)]
    for cp in cps:
        assert any(a <= cp <= b for a, b in blocks), f"U+{cp:04X} is outside the extension's blocks"
    out: list[str] = []
    i = 0
    while i < len(used):
        j = i
        while j + 1 < len(used) and used[j + 1] == used[j] + 1:
            j += 1
        out.append(f"U+{used[i]:04X}" if i == j else f"U+{used[i]:04X}-{used[j]:04X}")
        i = j + 1
    return ", ".join(out)


def write_subset(src: str, unicodes: list[int], out: str) -> None:
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.name_IDs = ["*"]
    opts.name_languages = ["*"]
    opts.notdef_outline = True
    opts.glyph_names = True
    opts.drop_tables = []
    font = TTFont(src)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=unicodes)
    sub.subset(font)
    font.flavor = "woff2"
    font.save(out)


def main() -> None:
    src, out_base = sys.argv[1], sys.argv[2]
    cmap = TTFont(src).getBestCmap()
    core = [cp for cp in cmap if in_core(cp)]
    ext = [cp for cp in cmap if not in_core(cp)]
    write_subset(src, core, f"{out_base}.woff2")
    write_subset(src, ext, f"{out_base}-ext.woff2")
    print(f"{out_base}.woff2: {len(core)} characters")
    print(f"{out_base}-ext.woff2: {len(ext)} characters")
    print(f"unicode-range: {ranges(ext)};")


if __name__ == "__main__":
    main()
