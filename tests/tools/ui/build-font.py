#!/usr/bin/env python3
"""Builds the "Texel" UI font (public/fonts/texel-regular.woff2, texel-bold.woff2).

Texel is a Modified Version (SIL OFL 1.1, see public/fonts/OFL.txt) of two fonts by Idrees Hassan:
  primary  : IdreesInc/Minecraft-Font (Minecraft.otf / Minecraft-Bold.otf) -> proportional Latin glyphs
  fallback : IdreesInc/Monocraft      (Monocraft.ttf, regular only)        -> extra glyphs (dashes, quotes, arrows,
                                                                              Latin Extended, Greek, Cyrillic ...)
Output grid: UPM 1024, 1 font pixel = 128 units (8 px/em) -> pixel-perfect at font sizes that are multiples of 8 px
(x devicePixelRatio). Advance = ink width + 1 px, space = 4 px (bold 5 px). The line box is exactly 1 em
(ascender 7 px, descender 1 px), so baselines land on whole pixels. Bold fallback glyphs are over-printed 1 px to
the right (Monocraft-Bold is not on the pixel grid).

Setup:  python3 -m venv .venv && .venv/bin/pip install fonttools brotli skia-pathops
Sources (pinned):
  curl -LO https://raw.githubusercontent.com/IdreesInc/Minecraft-Font/261ac77fbf28796ca09c22eb83ecdfe386c4b838/Minecraft.otf
  curl -LO https://raw.githubusercontent.com/IdreesInc/Minecraft-Font/261ac77fbf28796ca09c22eb83ecdfe386c4b838/Minecraft-Bold.otf
  curl -LO https://raw.githubusercontent.com/IdreesInc/Monocraft/v4.2.1/dist/Monocraft-ttf/Monocraft.ttf
Build (writes <out>.ttf and <out>.woff2; ship only the .woff2):
  .venv/bin/python tests/tools/ui/build-font.py Minecraft.otf      Monocraft.ttf public/fonts/texel-regular 400
  .venv/bin/python tests/tools/ui/build-font.py Minecraft-Bold.otf Monocraft.ttf public/fonts/texel-bold    700
Set SOURCE_DATE_EPOCH for byte-reproducible output.
"""
import sys
from fontTools.ttLib import TTFont
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
import pathops   # pip install skia-pathops  (overlap removal + TrueType contour direction)

PX = 128          # font units per pixel in the output
UPM = 8 * PX      # 8 pixels per em
src_primary, src_fallback, out_base, weight = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
family = sys.argv[5] if len(sys.argv) > 5 else "Texel"
bold = weight >= 700

# Which fallback codepoints to take from Monocraft (skip ligature/private-use/SGA ranges)
FALLBACK_RANGES = [(0x00A0, 0x00FF), (0x0100, 0x024F), (0x0250, 0x02FF), (0x0370, 0x03FF), (0x0400, 0x04FF), (0x1E00, 0x1EFF), (0x2070, 0x209F), (0x2150, 0x218F),
                   (0x2000, 0x206F), (0x20A0, 0x20CF), (0x2100, 0x214F), (0x2190, 0x21FF),
                   (0x2200, 0x22FF), (0x2300, 0x23FF), (0x25A0, 0x25FF), (0x2600, 0x26FF), (0x2700, 0x27BF)]

def pix_glyph(gs, name, t, embolden=False):
    """Draw glyph through affine t, optionally overprint +1px (game-style bold), union overlaps, TrueType (clockwise) direction."""
    paths = []
    for dx in ([0, PX] if embolden else [0]):
        p = pathops.Path(); a, b, c, d, e, f = t
        gs[name].draw(TransformPen(p.getPen(), (a, b, c, d, e + dx, f)))
        paths.append(p)
    tt = TTGlyphPen(None)
    pathops.union(paths, tt, clockwise=True)
    glyph = tt.glyph()
    if glyph.numberOfContours > 0:   # snap every point to the pixel grid (a few Monocraft composites sit on half pixels)
        glyph.coordinates.toInt()
        glyph.coordinates = type(glyph.coordinates)([(round(x / PX) * PX, round(y / PX) * PX) for x, y in glyph.coordinates])
    return glyph

def bounds(gs, name):
    bp = BoundsPen(gs); gs[name].draw(bp); return bp.bounds

glyphs, advances, cmap, order = {}, {}, {}, [".notdef"]
# .notdef: hollow 5x7 box
p = TTGlyphPen(None)
for (x0, y0, x1, y1, cw) in [(0, 0, 5, 7, False), (1, 1, 4, 6, True)]:
    pts = [(x0, y0), (x0, y1), (x1, y1), (x1, y0)]
    if cw: pts = pts[::-1]
    p.moveTo((pts[0][0]*PX, pts[0][1]*PX))
    for q in pts[1:]: p.lineTo((q[0]*PX, q[1]*PX))
    p.closePath()
glyphs[".notdef"] = p.glyph(); advances[".notdef"] = 6 * PX

def add(u, pen_glyph, adv):
    name = "space" if u == 0x20 else ("uni%04X" % u if u <= 0xFFFF else "u%05X" % u)
    glyphs[name] = pen_glyph; advances[name] = adv; cmap[u] = name; order.append(name)

# ---- primary: Minecraft-Font (CFF, UPM 18, 1 px = 2 units, every inked glyph has LSB 1 unit / RSB 2 units)
P = TTFont(src_primary); pgs = P.getGlyphSet(); pcmap = P.getBestCmap()
space_adv = (5 if bold else 4) * PX
for u, g in sorted(pcmap.items()):
    if u < 0x20 or u == 0x3000: continue
    b = bounds(pgs, g)
    if b is None:
        add(u, TTGlyphPen(None).glyph(), space_adv); continue   # space, NBSP (source NBSP advance 1.5 px is a bug -> 4 px)
    # x' = (x - 1) * 64, y' = y * 64 : removes the half-pixel left bearing; advance = ink + 1 px
    adv_units = P["hmtx"][g][0]
    add(u, pix_glyph(pgs, g, (PX / 2, 0, 0, PX / 2, -PX / 2, 0)), int((adv_units - 1) * PX / 2))

# ---- fallback: Monocraft (TTF, UPM 1080, 1 px = 120 units, monospaced 6 px cells) -> made proportional
M = TTFont(src_fallback); mgs = M.getGlyphSet(); mcmap = M.getBestCmap()
mpx = 120
for u, g in sorted(mcmap.items()):
    if u in cmap or not any(a <= u <= b for a, b in FALLBACK_RANGES): continue
    b = bounds(mgs, g)
    if b is None:
        add(u, TTGlyphPen(None).glyph(), space_adv if u in (0x2002, 0x2004, 0x2005, 0x2009, 0x202F, 0x205F) else int(M["hmtx"][g][0] / mpx) * PX); continue
    s = PX / mpx
    ink_px = round((b[2] - b[0]) / mpx) + (1 if bold else 0)
    add(u, pix_glyph(mgs, g, (s, 0, 0, s, -b[0] * s, 0), embolden=bold), (ink_px + 1) * PX)

# ---- assemble
fb = FontBuilder(UPM, isTTF=True)
fb.setupGlyphOrder(order)
fb.setupCharacterMap(cmap)
fb.setupGlyf(glyphs)
gl = fb.font["glyf"]
metrics = {}
ymax, ymin = 0, 0
for n in order:
    gg = gl[n]; gg.recalcBounds(gl)
    lsb = getattr(gg, "xMin", 0) if gg.numberOfContours else 0
    if gg.numberOfContours: ymax = max(ymax, gg.yMax); ymin = min(ymin, gg.yMin)
    metrics[n] = (advances[n], lsb)
fb.setupHorizontalMetrics(metrics)
ASC, DESC = 7 * PX, -1 * PX              # content area = exactly 1 em -> integer baselines
fb.setupHorizontalHeader(ascent=ASC, descent=DESC, lineGap=0)
style = "Bold" if bold else "Regular"
copyright_ = ("Copyright (c) 2022, Idrees Hassan (https://github.com/IdreesInc/Minecraft-Font). "
              "Copyright (c) 2022, Idrees Hassan (https://github.com/IdreesInc/Monocraft). "
              "Modifications copyright (c) 2026, TexturesOnline contributors.")
fb.setupNameTable({
    "copyright": copyright_, "familyName": family, "styleName": style,
    "uniqueFontIdentifier": f"{family}-{style};2.000", "fullName": f"{family} {style}",
    "psName": f"{family}-{style}", "version": "Version 2.000",
    "description": "Proportional pixel font. Glyphs from Minecraft-Font and Monocraft by Idrees Hassan, re-gridded to 8 px per em.",
    "licenseDescription": "This Font Software is licensed under the SIL Open Font License, Version 1.1.",
    "licenseInfoURL": "https://openfontlicense.org",
})
fb.setupOS2(version=4, sTypoAscender=ASC, sTypoDescender=DESC, sTypoLineGap=0,
            usWinAscent=max(ymax, ASC), usWinDescent=max(-ymin, -DESC),
            usWeightClass=weight, fsSelection=(0x20 if bold else 0x40) | 0x80,  # BOLD/REGULAR + USE_TYPO_METRICS
            sxHeight=5 * PX, sCapHeight=7 * PX, achVendID="NONE", fsType=0)
fb.setupPost(isFixedPitch=0, underlinePosition=-PX, underlineThickness=PX)
fb.font["head"].macStyle = 1 if bold else 0
fb.save(out_base + ".ttf")
f = TTFont(out_base + ".ttf"); f.flavor = "woff2"; f.save(out_base + ".woff2")
print(out_base, "glyphs:", len(order), "cmap:", len(cmap), "yMax px:", ymax / PX, "yMin px:", ymin / PX)
