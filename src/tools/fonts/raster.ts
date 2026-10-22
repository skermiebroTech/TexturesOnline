// Turning a font into pixel glyphs in the browser: the font file is loaded as a FontFace (any
// format the browser reads: TTF, OTF, WOFF, WOFF2), each character is drawn on a canvas at the
// chosen pixel size with its baseline on the cell's baseline, and pixels at least as opaque as the
// threshold become ink. A font on this device can be used the same way by its CSS family.

import { CELL_ASCENT, cellH, cellW, emptyMask, isEmptyMask, unit, type GlyphSize, type Mask } from './font';

export interface RasterOptions {
  /** Font size in glyph pixels (the em) */
  px: number;
  /** 1..255: alpha from which a pixel is ink */
  threshold: number;
  /** Moves the baseline down (glyph pixels) */
  offsetY: number;
}

let faceCount = 0;

/** Loads font bytes as a FontFace and returns its CSS family name. */
export async function loadFontFace(bytes: Uint8Array): Promise<string> {
  const family = `tpm-font-${++faceCount}`;
  const face = new FontFace(family, bytes.slice().buffer as ArrayBuffer);
  await face.load();
  document.fonts.add(face);
  return family;
}

export const cssFamily = (family: string): string => (/^(serif|sans-serif|monospace|cursive|fantasy|system-ui)$/.test(family) ? family : `"${family}"`);

let scratch: HTMLCanvasElement | null = null;
function ctx2d(w: number, h: number): CanvasRenderingContext2D {
  scratch ??= document.createElement('canvas');
  if (scratch.width < w) scratch.width = w;
  if (scratch.height < h) scratch.height = h;
  const ctx = scratch.getContext('2d', { willReadFrequently: true })!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, scratch.width, scratch.height);
  return ctx;
}

/** Font size (glyph pixels) that makes capital letters 7 gui pixels tall, like the game's font. */
export function fitSize(family: string, size: GlyphSize): number {
  const ctx = ctx2d(8, 8);
  ctx.font = `100px ${cssFamily(family)}`;
  const probe = ['H', 'Н', 'あ'].map((c) => ctx.measureText(c).actualBoundingBoxAscent).find((v) => v > 1);
  const cap = probe ? probe / 100 : 0.7;
  return Math.max(4, Math.round((7 * unit(size)) / cap));
}

/** One character as a glyph (null when it draws nothing). */
export function rasterGlyph(family: string, cp: number, size: GlyphSize, opts: RasterOptions): Mask | null {
  const w = cellW(size);
  const h = cellH(size);
  const ch = String.fromCodePoint(cp);
  const ctx = ctx2d(w * 3, h);
  ctx.font = `${opts.px}px ${cssFamily(family)}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  const m = ctx.measureText(ch);
  // the ink starts in the first column
  const x = Math.round(m.actualBoundingBoxLeft);
  ctx.fillText(ch, x, CELL_ASCENT * unit(size) + opts.offsetY);
  return alphaToMask(ctx.getImageData(0, 0, w, h).data, size, opts.threshold);
}

/** A drawn cell (RGBA, the cell's size) to a glyph: pixels at least `threshold` opaque are ink. */
export function alphaToMask(rgba: ArrayLike<number>, size: GlyphSize, threshold: number): Mask | null {
  const n = cellW(size) * cellH(size);
  const out = emptyMask(size);
  for (let i = 0; i < n; i++) if (rgba[i * 4 + 3] >= threshold) out[i] = 1;
  return isEmptyMask(out) ? null : out;
}

/**
 * Whether the font itself has a character (not a fallback font): the character drawn with two
 * different fallbacks looks the same only when neither fallback was used. For files whose
 * character map can't be read (WOFF2) and for checking a few characters.
 */
export function fontHasChar(family: string, cp: number): boolean {
  const ch = String.fromCodePoint(cp);
  const draw = (fallback: string): string => {
    const ctx = ctx2d(48, 48);
    ctx.font = `32px ${cssFamily(family)}, ${fallback}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(ch, 8, 36);
    const d = ctx.getImageData(0, 0, 48, 48).data;
    let s = '';
    for (let i = 3; i < d.length; i += 16) s += d[i] > 127 ? '1' : '0';
    return s;
  };
  return draw('serif') === draw('monospace');
}

/** Glyphs for many characters. */
export function rasterFont(family: string, cps: Iterable<number>, size: GlyphSize, opts: RasterOptions): Map<number, Mask> {
  const out = new Map<number, Mask>();
  for (const cp of cps) {
    const m = rasterGlyph(family, cp, size, opts);
    if (m) out.set(cp, m);
  }
  return out;
}
