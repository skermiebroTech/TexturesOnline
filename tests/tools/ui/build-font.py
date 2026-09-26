#!/usr/bin/env python3
"""Builds the "Texel" UI font (public/fonts/texel-*.woff2).

Texel is a proportional adaptation of Monocraft (SIL OFL 1.1,
https://github.com/IdreesInc/Monocraft). Monocraft's monospaced pixel glyph data
is trimmed to each glyph's ink, re-spaced with a single pixel gap, a few narrow
letters are redrawn for proportional text, missing accented Latin/Cyrillic
letters are composed from base glyphs + diacritics, and a double-struck bold
is derived from the regular bitmaps.

Usage (needs Python 3 with fonttools + brotli):
  python3 -m venv .venv && .venv/bin/pip install fonttools brotli
  .venv/bin/python tests/tools/ui/build-font.py [path/to/characters.json path/to/diacritics.json]
Without arguments the data files are downloaded from the pinned Monocraft commit.
"""
from __future__ import annotations

import json
import os
import sys
import unicodedata
import urllib.request

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

MONOCRAFT_COMMIT = "e498bf70aeb25b4bdcff1e44d878fb2cb4f7c2a9"
RAW = f"https://raw.githubusercontent.com/IdreesInc/Monocraft/{MONOCRAFT_COMMIT}/src/"

PX = 128            # font units per pixel
UPM = 8 * PX        # 8 pixels per em -> font-size 16px draws 2 CSS px per pixel
ASCENT = 8 * PX
DESCENT = 1 * PX
SPACE_ADVANCE = 4   # pixels
VERSION = "1.000"

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUT_DIR = os.path.join(ROOT, "public", "fonts")

COMBINING = {
    "̀": "grave", "́": "acute", "̂": "circumflex", "̃": "tilde",
    "̈": "diaeresis", "̊": "ring_above", "̋": "double_acute",
    "̆": "breve", "̄": "macron", "̌": "caron", "̇": "dot_above",
}

# Glyphs redrawn for proportional spacing (rows top->bottom, baseline under the last row
# unless a descent is given).
OVERRIDES: dict[str, tuple[list[str], int]] = {
    "i": (["#", ".", "#", "#", "#", "#", "#"], 0),
    "l": (["#.", "#.", "#.", "#.", "#.", "#.", ".#"], 0),
    "t": ([".#.", ".#.", "###", ".#.", ".#.", ".#.", "..#"], 0),
    "ı": (["#", "#", "#", "#", "#"], 0),  # dotless i
    "ȷ": (["..#", "..#", "..#", "#.#", "#.#", ".#."], 1),  # dotless j
    "j": (["..#", "...", "..#", "..#", "..#", "#.#", "#.#", ".#."], 1),
    "|": (["#", "#", "#", "#", "#", "#", "#", "#"], 1),
    "¦": (["#", "#", "#", ".", "#", "#", "#", "#"], 1),
}

# Pixel set: {(x, y)} with y = 0 the first row above the baseline, negative = descender.
Pixels = set[tuple[int, int]]


def load_json(arg_index: int, name: str):
    if len(sys.argv) > arg_index:
        with open(sys.argv[arg_index], encoding="utf-8") as f:
            return json.load(f)
    with urllib.request.urlopen(RAW + name) as r:
        return json.loads(r.read().decode("utf-8"))


def rows_to_pixels(rows, descent: int) -> Pixels:
    h = len(rows)
    out: Pixels = set()
    for r, row in enumerate(rows):
        for x, v in enumerate(row):
            if v in (1, "#") or v is True:
                out.add((x, h - descent - r - 1))
    return out


def centred_in_cell(px: Pixels, cell: int = 5) -> Pixels:
    """Place a narrow glyph in the middle of a Monocraft cell so diacritics line up."""
    if not px:
        return px
    minx = min(x for x, _ in px)
    maxx = max(x for x, _ in px)
    off = (cell - (maxx - minx + 1)) // 2 - minx
    return {(x + off, y) for x, y in px}


def top_of(px: Pixels) -> int:
    return max(y for _, y in px)


def compose(base: Pixels, mark_rows, gap: int = 1) -> Pixels:
    mark = rows_to_pixels(mark_rows, 0)
    mark_bottom = min(y for _, y in mark)
    shift = top_of(base) + 1 + gap - mark_bottom
    return base | {(x, y + shift) for x, y in mark}


def trace(px: Pixels) -> list[list[tuple[int, int]]]:
    """Outline a pixel set as closed contours (clockwise outer, counter-clockwise holes)."""
    edges: dict[tuple[tuple[int, int], tuple[int, int]], int] = {}

    def add(a, b):
        if (b, a) in edges:
            del edges[(b, a)]
        else:
            edges[(a, b)] = 1

    for x, y in px:
        # clockwise in y-up space: filled pixel stays on the right-hand side
        add((x, y + 1), (x + 1, y + 1))
        add((x + 1, y + 1), (x + 1, y))
        add((x + 1, y), (x, y))
        add((x, y), (x, y + 1))

    outgoing: dict[tuple[int, int], list[tuple[int, int]]] = {}
    for a, b in edges:
        outgoing.setdefault(a, []).append(b)

    def turn_rank(d_in, d_out):
        cross = d_in[0] * d_out[1] - d_in[1] * d_out[0]
        dot = d_in[0] * d_out[0] + d_in[1] * d_out[1]
        if cross < 0:
            return 0  # right turn
        if dot > 0:
            return 1  # straight
        return 2      # left turn

    contours = []
    while outgoing:
        start = next(iter(outgoing))
        path = [start]
        prev = None
        cur = start
        while True:
            options = outgoing.get(cur)
            if not options:
                break
            if prev is not None and len(options) > 1:
                d_in = (cur[0] - prev[0], cur[1] - prev[1])
                options.sort(key=lambda n: turn_rank(d_in, (n[0] - cur[0], n[1] - cur[1])))
            nxt = options.pop(0)
            if not options:
                del outgoing[cur]
            prev, cur = cur, nxt
            if cur == start:
                break
            path.append(cur)
        # drop collinear points
        simplified = []
        n = len(path)
        for i in range(n):
            p0, p1, p2 = path[i - 1], path[i], path[(i + 1) % n]
            if (p1[0] - p0[0]) * (p2[1] - p1[1]) - (p1[1] - p0[1]) * (p2[0] - p1[0]) != 0:
                simplified.append(p1)
        if len(simplified) >= 3:
            contours.append(simplified)
    return contours


def make_glyph(px: Pixels):
    pen = TTGlyphPen(None)
    for contour in trace(px):
        pen.moveTo((contour[0][0] * PX, contour[0][1] * PX))
        for x, y in contour[1:]:
            pen.lineTo((x * PX, y * PX))
        pen.closePath()
    return pen.glyph()


def build_bitmaps(chars, diacritics) -> dict[int, Pixels]:
    by_cp = {c["codepoint"]: c for c in chars}
    bitmaps: dict[int, Pixels] = {}

    for c in chars:
        cp = c["codepoint"]
        if 0x2500 <= cp <= 0x259F or cp in (0xFFFD,):
            continue
        if "pixels" in c:
            bitmaps[cp] = rows_to_pixels(c["pixels"], c.get("descent", 0))

    for ch, (rows, descent) in OVERRIDES.items():
        bitmaps[ord(ch)] = rows_to_pixels(rows, descent)

    # Monocraft's own references (base + diacritic)
    for c in chars:
        if "reference" in c and c["codepoint"] not in bitmaps:
            base = bitmaps.get(c["reference"])
            if base is None:
                continue
            if "diacritic" in c:
                bitmaps[c["codepoint"]] = compose(base, diacritics[c["diacritic"]]["pixels"], c.get("diacriticSpace", 1))
            else:
                bitmaps[c["codepoint"]] = set(base)

    # Compose missing accented letters (Latin-1, Latin Extended-A/B/Additional, Greek, Cyrillic)
    ranges = list(range(0x00C0, 0x0250)) + list(range(0x0370, 0x0530)) + list(range(0x1E00, 0x1F00))
    for cp in ranges:
        if cp in bitmaps:
            continue
        decomposed = unicodedata.normalize("NFD", chr(cp))
        if len(decomposed) != 2 or decomposed[1] not in COMBINING:
            continue
        base_ch, mark = decomposed[0], COMBINING[decomposed[1]]
        if base_ch == "i":
            base_ch = "ı"
        elif base_ch == "j":
            base_ch = "ȷ"
        base = bitmaps.get(ord(base_ch))
        if base is None or mark not in diacritics:
            continue
        if mark == "caron" and base_ch in "dLlt":
            # apostrophe-style caron beside tall letters
            w = max(x for x, _ in base) + 2
            top = top_of(base)
            bitmaps[cp] = base | {(w, top), (w, top - 1)}
            continue
        narrow = max(x for x, _ in base) - min(x for x, _ in base) < 2
        b = centred_in_cell(base) if narrow else base
        bitmaps[cp] = compose(b, diacritics[mark]["pixels"], 1)

    # Stroked letters Monocraft lacks
    def add_bar(src: str, dst: str, row: int, x0: int | None = None, x1: int | None = None):
        base = bitmaps.get(ord(src))
        if base is None or ord(dst) in bitmaps:
            return
        xs = [x for x, _ in base]
        a = min(xs) if x0 is None else x0
        b = max(xs) if x1 is None else x1
        bitmaps[ord(dst)] = base | {(x, row) for x in range(a, b + 1)}

    add_bar("h", "ħ", 5, 0, 2)   # ħ
    add_bar("H", "Ħ", 4)         # Ħ
    add_bar("d", "đ", 5, 2, 4)   # đ
    add_bar("t", "ŧ", 2)         # ŧ
    add_bar("T", "Ŧ", 3, 1, 3)   # Ŧ
    if ord("Ð") in bitmaps and ord("Đ") not in bitmaps:
        bitmaps[0x0110] = set(bitmaps[0x00D0])  # Đ looks like Ð
    return bitmaps


def trim(px: Pixels) -> tuple[Pixels, int]:
    if not px:
        return px, SPACE_ADVANCE
    minx = min(x for x, _ in px)
    maxx = max(x for x, _ in px)
    return {(x - minx, y) for x, y in px}, (maxx - minx + 1) + 1


def glyph_name(cp: int) -> str:
    return "uni%04X" % cp if cp <= 0xFFFF else "u%06X" % cp


def build(style: str, bitmaps: dict[int, Pixels]):
    bold = style == "Bold"
    glyph_order = [".notdef", "space"]
    cmap = {0x20: "space", 0xA0: "space"}
    glyphs = {}
    metrics = {}

    notdef = {(x, y) for x in range(5) for y in range(7) if x in (0, 4) or y in (0, 6)}
    glyphs[".notdef"] = make_glyph(notdef)
    metrics[".notdef"] = (6 * PX, 0)
    glyphs["space"] = TTGlyphPen(None).glyph()
    metrics["space"] = (SPACE_ADVANCE * PX + (PX if bold else 0), 0)

    for cp in sorted(bitmaps):
        if cp in (0x20, 0xA0):
            continue
        px, adv = trim(bitmaps[cp])
        if not px:
            continue
        if bold:
            px = px | {(x + 1, y) for x, y in px}
            adv += 1
        name = glyph_name(cp)
        glyph_order.append(name)
        cmap[cp] = name
        glyphs[name] = make_glyph(px)
        metrics[name] = (adv * PX, 0)

    # Extra spaces
    for cp, width in ((0x2002, 5), (0x2003, 8), (0x2009, 2), (0x200A, 1), (0x202F, 2), (0x2007, 6)):
        name = glyph_name(cp)
        glyph_order.append(name)
        cmap[cp] = name
        glyphs[name] = TTGlyphPen(None).glyph()
        metrics[name] = (width * PX, 0)

    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(glyph_order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    # every glyph is trimmed to start at x = 0, so left side bearings are 0
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=ASCENT, descent=-DESCENT, lineGap=0)
    family = "Texel"
    fb.setupNameTable({
        "copyright": "Copyright (c) 2022, Idrees Hassan (Monocraft). Proportional adaptation copyright (c) 2026, TexturesOnline contributors.",
        "familyName": family,
        "styleName": style,
        "uniqueFontIdentifier": f"{family}-{style};{VERSION}",
        "fullName": f"{family} {style}",
        "psName": f"{family}-{style}",
        "version": f"Version {VERSION}",
        "licenseDescription": "This Font Software is licensed under the SIL Open Font License, Version 1.1.",
        "licenseInfoURL": "https://openfontlicense.org",
        "description": "Proportional pixel font adapted from Monocraft by Idrees Hassan.",
    })
    fb.setupOS2(
        version=4,
        usWeightClass=700 if bold else 400,
        sTypoAscender=ASCENT,
        sTypoDescender=-DESCENT,
        sTypoLineGap=0,
        usWinAscent=11 * PX,
        usWinDescent=3 * PX,
        sxHeight=5 * PX,
        sCapHeight=7 * PX,
        fsSelection=(0x20 if bold else 0x40) | 0x80,
        achVendID="TXOL",
        fsType=0,
    )
    fb.setupPost(underlinePosition=-PX, underlineThickness=PX)
    fb.font["head"].macStyle = 1 if bold else 0
    return fb.font


def main():
    chars = load_json(1, "characters.json")
    diacritics = load_json(2, "diacritics.json")
    bitmaps = build_bitmaps(chars, diacritics)
    os.makedirs(OUT_DIR, exist_ok=True)
    for style in ("Regular", "Bold"):
        font = build(style, bitmaps)
        base = os.path.join(OUT_DIR, f"texel-{style.lower()}")
        font.save(base + ".ttf")
        woff = TTFont(base + ".ttf")
        woff.flavor = "woff2"
        woff.save(base + ".woff2")
        os.remove(base + ".ttf")
        print(f"{style}: {len(font.getGlyphOrder())} glyphs -> {base}.woff2 ({os.path.getsize(base + '.woff2')} bytes)")


if __name__ == "__main__":
    main()
