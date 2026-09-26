# Texel

Texel is the pixel font used by the TexturesOnline interface (`texel-regular.woff2`, `texel-bold.woff2`).

It is a Modified Version of [Monocraft](https://github.com/IdreesInc/Monocraft) by Idrees Hassan,
licensed under the SIL Open Font License 1.1 (see `OFL.txt`). Changes from Monocraft:

- proportional spacing: every glyph is trimmed to its ink and followed by a one pixel gap
- a few narrow letters (`i`, `l`, `t`, `j`, `|`) redrawn for proportional text
- accented Latin, Greek and Cyrillic letters composed from base letters and Monocraft's diacritics
- a double-struck bold weight
- programming ligatures and box-drawing characters removed

Metrics: 8 pixels per em, so a font size of 16px draws each pixel as 2×2 CSS pixels.
Use font sizes that are multiples of 8px (16, 24, 32, 48, 64) for perfectly crisp text.

The font is rebuilt with `tests/tools/ui/build-font.py`.
