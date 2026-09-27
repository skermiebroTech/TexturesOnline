# Texel

Texel is the pixel font used by the Texture Pack Maker interface (`texel-regular.woff2`, `texel-bold.woff2`).

It is a Modified Version of two fonts by Idrees Hassan, both under the SIL Open Font License 1.1 (see `OFL.txt`):
[Minecraft-Font](https://github.com/IdreesInc/Minecraft-Font) (Latin glyphs) and
[Monocraft](https://github.com/IdreesInc/Monocraft) (extra punctuation, Latin Extended, Greek, Cyrillic, symbols).

Changes: re-gridded to 8 pixels per em (advance = glyph width + 1 pixel), Monocraft glyphs made proportional,
bold for Monocraft glyphs drawn by over-printing one pixel to the right, metrics set so the line box is exactly 1 em.

Use font sizes that are multiples of 8px (16, 24, 32, 48, 64) and letter-spacing in whole font pixels
(multiples of `0.125em`) for perfectly crisp text. Rebuild with `tests/tools/ui/build-font.py`.

Not an official Minecraft product; not approved by or associated with Mojang or Microsoft.
