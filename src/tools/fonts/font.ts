// The font maker's model: glyphs as 1-bit masks on one cell layout for every character, the
// character groups the editor shows, Java's character widths, what each game version can load and
// how glyphs are fitted into the 8-pixel cells of the older formats. Pure: no DOM, unit tested.
//
// How the game reads fonts (checked against the client jars):
// - Java 1.6.1 to 1.12.2: one 16×16 grid, assets/minecraft/textures/font/ascii.png, in a fixed
//   character order (LEGACY_ASCII_CHARS, hardcoded in the game's font renderer). Characters not on
//   it come from the Unicode font (unicode_page_XX.png). The space is always 4 pixels wide.
// - Java 1.13+: font/default.json lists providers. A pack's providers come before the game's own
//   (packs are stacked, the top pack first), so a pack only lists the characters it changes and
//   every other character still comes from the game. "bitmap" (a PNG grid, `height`, `ascent`,
//   `chars`) and "ttf" (a TrueType file with size, oversample, shift, skip) exist since 1.13,
//   "space" since 1.19 (22w11a), "reference" and "unihex" since 1.20 (23w17a; "legacy_unicode" was
//   removed then), and provider filters ("uniform" = Force Unicode Font, "jp") since 1.20.5 (24w06a).
// - Bedrock: font/default8.png (the Java 1.12.2 grid) and font/glyph_XX.png pages (256 characters
//   each, XX = the code point's high byte), optionally per language in texts/<lang>/font/.
//
// Cell layout used for every glyph: S pixels wide, 1.5 × S tall (S = 8, 16 or 32), drawn like
// Java's accented.png: 12 gui pixels high with the baseline 10 down (ascent 10). Rows 3S/8 to
// 11S/8 - 1 are the 8-pixel box of ascii.png (cap height 7, one row below the baseline); the 3
// rows above are room for accents on capitals and the last row a second row below the baseline.

import { compareJavaVersions } from '../convert/paths';

export type GlyphSize = 8 | 16 | 32;
export const GLYPH_SIZES: readonly GlyphSize[] = [8, 16, 32];

/** Gui pixels of a cell (Java's bitmap `height`) and the distance from its top to the baseline. */
export const CELL_HEIGHT = 12;
export const CELL_ASCENT = 10;
/** Gui pixels above the baseline in the game's line box (glyph tops are drawn at y + 7 - ascent). */
export const BASELINE = 7;
/** Rows above the 8-pixel box, in gui pixels. */
export const TOP_EXTRA = CELL_ASCENT - BASELINE;
export const DEFAULT_SPACE = 4;

/** A glyph: S × 1.5S pixels, 1 = ink. */
export type Mask = Uint8Array;

export interface FontTtf {
  /** The TrueType file (TTF outlines; converted from WOFF when needed) */
  bytes: Uint8Array;
  /** Original file name */
  file: string;
  /** Java ttf provider settings */
  size: number;
  oversample: number;
  shift: [number, number];
  /** Characters the file has (from its cmap) */
  chars: Set<number>;
}

export interface FontDoc {
  size: GlyphSize;
  /** Code point -> glyph (only drawn glyphs; empty ones are removed) */
  glyphs: Map<number, Mask>;
  /** Width of the space in gui pixels (Java 1.19+) */
  space: number;
  /** Embedded TrueType font for Java 1.13+ (after the drawn glyphs), or null */
  ttf: FontTtf | null;
}

export const cellW = (size: GlyphSize): number => size;
export const cellH = (size: GlyphSize): number => (size * 3) / 2;
/** Glyph pixels per gui pixel. */
export const unit = (size: GlyphSize): number => size / 8;

export function emptyMask(size: GlyphSize): Mask {
  return new Uint8Array(cellW(size) * cellH(size));
}

export function newFont(size: GlyphSize = 8): FontDoc {
  return { size, glyphs: new Map(), space: DEFAULT_SPACE, ttf: null };
}

export function isEmptyMask(m: Mask): boolean {
  for (let i = 0; i < m.length; i++) if (m[i]) return false;
  return true;
}

export function cloneFont(doc: FontDoc): FontDoc {
  return { size: doc.size, space: doc.space, ttf: doc.ttf, glyphs: new Map([...doc.glyphs].map(([c, m]) => [c, m.slice()])) };
}

/** Sets a glyph; an empty mask removes it. */
export function setGlyph(doc: FontDoc, cp: number, mask: Mask | null): void {
  if (!mask || isEmptyMask(mask)) doc.glyphs.delete(cp);
  else doc.glyphs.set(cp, mask);
}

// ---------------------------------------------------------------------------------------------
// Character widths (Java's BitmapProvider)

/**
 * Ink width in glyph pixels: the rightmost column with a set pixel, plus one (0 when empty). Java
 * scans the cell from the right for any pixel whose alpha (or luminance) is not 0.
 */
export function inkWidth(mask: Mask, w: number, h: number): number {
  for (let x = w - 1; x >= 0; x--) for (let y = 0; y < h; y++) if (mask[y * w + x]) return x + 1;
  return 0;
}

/**
 * Advance in gui pixels of a bitmap glyph: (int)(0.5 + inkWidth × height / cellHeight) + 1, the
 * formula of every Java version (1.6.1's font renderer and 1.13+'s bitmap provider). The bold
 * style adds 1, the shadow does not change it.
 */
export function bitmapAdvance(ink: number, cellHeightPx: number, guiHeight = CELL_HEIGHT): number {
  return Math.floor(0.5 + (ink * guiHeight) / cellHeightPx) + 1;
}

export function glyphAdvance(mask: Mask, size: GlyphSize): number {
  return bitmapAdvance(inkWidth(mask, cellW(size), cellH(size)), cellH(size));
}

/** First and last rows with ink (null when empty). */
export function inkRows(mask: Mask, w: number, h: number): [number, number] | null {
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (mask[y * w + x]) {
        if (top < 0) top = y;
        bottom = y;
        break;
      }
  return top < 0 ? null : [top, bottom];
}

// ---------------------------------------------------------------------------------------------
// Editing helpers

/** A glyph moved by (dx, dy) pixels; what moves out of the cell is lost. */
export function shiftMask(mask: Mask, size: GlyphSize, dx: number, dy: number): Mask {
  const w = cellW(size);
  const h = cellH(size);
  const out = emptyMask(size);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) out[ny * w + nx] = 1;
    }
  return out;
}

export function flipMask(mask: Mask, size: GlyphSize, axis: 'h' | 'v'): Mask {
  const w = cellW(size);
  const h = cellH(size);
  const out = emptyMask(size);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (mask[y * w + x]) out[(axis === 'v' ? h - 1 - y : y) * w + (axis === 'h' ? w - 1 - x : x)] = 1;
  return out;
}

/** A glyph at another glyph size: nearest neighbour (up: each pixel becomes a block). */
export function resizeMask(mask: Mask, from: GlyphSize, to: GlyphSize): Mask {
  if (from === to) return mask.slice();
  const fw = cellW(from);
  const fh = cellH(from);
  const tw = cellW(to);
  const th = cellH(to);
  const out = emptyMask(to);
  for (let y = 0; y < th; y++) {
    const sy = Math.min(fh - 1, Math.floor(((y + 0.5) * fh) / th));
    for (let x = 0; x < tw; x++) {
      const sx = Math.min(fw - 1, Math.floor(((x + 0.5) * fw) / tw));
      out[y * tw + x] = mask[sy * fw + sx];
    }
  }
  // Going down, a thin stroke may fall between samples: keep any block with ink.
  if (to < from) {
    const k = from / to;
    for (let y = 0; y < th; y++)
      for (let x = 0; x < tw; x++) {
        if (out[y * tw + x]) continue;
        let n = 0;
        for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) n += mask[(y * k + yy) * fw + x * k + xx];
        if (n * 2 >= k * k) out[y * tw + x] = 1;
      }
  }
  return out;
}

export function resizeFont(doc: FontDoc, to: GlyphSize): FontDoc {
  if (doc.size === to) return doc;
  const glyphs = new Map<number, Mask>();
  for (const [cp, m] of doc.glyphs) {
    const r = resizeMask(m, doc.size, to);
    if (!isEmptyMask(r)) glyphs.set(cp, r);
  }
  return { ...doc, size: to, glyphs };
}

// ---------------------------------------------------------------------------------------------
// The 8-pixel cells of Java before 1.13 and of Bedrock

/**
 * A glyph in an 8 × 8 gui-pixel box (S × S glyph pixels): the rows of ascii.png. Glyphs that use
 * the room above (accented capitals) lose the empty rows between the accent and the letter and
 * move up just enough to fit; a second row below the baseline is cut.
 */
export function fitBox(mask: Mask, size: GlyphSize): Mask {
  const w = cellW(size);
  const h = cellH(size);
  const k = unit(size);
  const top = TOP_EXTRA * k;
  const box = 8 * k;
  const out = new Uint8Array(w * box);
  const ink = inkRows(mask, w, h);
  if (!ink) return out;
  let rows: number[] = [];
  for (let y = 0; y < h; y++) rows.push(y);
  if (ink[0] < top) {
    // Drop empty rows between the accent and the letter's top.
    const rowEmpty = (y: number) => {
      for (let x = 0; x < w; x++) if (mask[y * w + x]) return false;
      return true;
    };
    rows = rows.filter((y) => !(y > ink[0] && y < top && rowEmpty(y)));
  }
  const firstInk = rows.indexOf(ink[0]);
  const start = Math.min(rows.indexOf(top), firstInk);
  for (let i = 0; i < box; i++) {
    const y = rows[start + i];
    if (y === undefined) break;
    out.set(mask.subarray(y * w, y * w + w), i * w);
  }
  return out;
}

/** Back from an 8 × 8 gui-pixel box (rows of ascii.png) to the glyph cell. */
export function fromBox(box: Uint8Array, size: GlyphSize): Mask {
  const w = cellW(size);
  const out = emptyMask(size);
  out.set(box.subarray(0, w * 8 * unit(size)), TOP_EXTRA * unit(size) * w);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Character groups

export type GroupId = 'basic' | 'latin' | 'cyrillic' | 'kana' | 'symbols' | 'other';
export const GROUP_IDS: readonly GroupId[] = ['basic', 'latin', 'cyrillic', 'kana', 'symbols', 'other'];

const range = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const chars = (s: string): number[] => [...s].map((c) => c.codePointAt(0)!);

/** The characters of each group, in editor order (each character in one group only). */
export const GROUPS: Record<Exclude<GroupId, 'other'>, readonly number[]> = {
  basic: range(0x21, 0x7e),
  latin: [...range(0xa1, 0xac), ...range(0xae, 0xff), ...range(0x100, 0x17f), 0x218, 0x219, 0x21a, 0x21b, 0x1e9e],
  cyrillic: [...range(0x400, 0x45f), 0x490, 0x491],
  kana: [0x3001, 0x3002, 0x300c, 0x300d, 0x300e, 0x300f, ...range(0x3041, 0x3096), 0x309b, 0x309c, ...range(0x30a1, 0x30fa), 0x30fb, 0x30fc, 0xff01, 0xff1f],
  symbols: chars('–—‘’‚“”„†‡•…‰′″‹›‼€₽₴№™←↑→↓↔♠♣♥♦★☆✔✖♪♫☺☻☀☁☂☃⚔⌂░▒▓█▄▀■□▲▶▼◀●○◆∞≠≈≤≥√'),
};

const GROUP_OF = new Map<number, GroupId>();
for (const id of Object.keys(GROUPS) as Exclude<GroupId, 'other'>[]) for (const cp of GROUPS[id]) GROUP_OF.set(cp, id);

export function groupOf(cp: number): GroupId {
  return GROUP_OF.get(cp) ?? 'other';
}

/** Characters that are never glyphs (controls, spaces, joiners, combining marks, surrogates). */
export function isDrawable(cp: number): boolean {
  if (cp < 0x21 || (cp >= 0x7f && cp < 0xa1) || cp === 0xad) return false;
  if (cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return false;
  if ((cp >= 0x2000 && cp <= 0x200f) || (cp >= 0x2028 && cp <= 0x202f) || cp === 0x205f || cp === 0x3000 || cp === 0xfeff) return false;
  if (cp >= 0x300 && cp <= 0x36f) return false;
  if (cp >= 0xfe00 && cp <= 0xfe0f) return false;
  return true;
}

/** Code points of a text, without duplicates, in order. */
export function textChars(text: string): number[] {
  return [...new Set([...text].map((c) => c.codePointAt(0)!))];
}

export const cpLabel = (cp: number): string => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;

// ---------------------------------------------------------------------------------------------
// The legacy grid (Java 1.6.1-1.12.2 ascii.png, Bedrock default8.png)

/**
 * Character of each cell of ascii.png in Java 1.7.2 to 1.12.2 (the font renderer's hardcoded
 * string, read from the 1.7.10, 1.8.9 and 1.12.2 jars). 1.6.x uses the same cells from the space
 * on (from font.txt), only without rows 0-1 and the box-drawing rows.
 */
export const LEGACY_ASCII_CHARS =
  'ÀÁÂÈÊËÍÓÔÕÚßãõğİıŒœŞşŴŵžȇ\0\0\0\0\0\0\0 !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\0ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αβΓπΣσμτΦΘΩδ∞∅∈∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\0';

/** Code point of each of the 256 cells (0 = unused). Bedrock maps rows 0-1 to control codes, so they are unused there. */
export function legacyCells(edition: 'java' | 'bedrock'): number[] {
  const cells = [...LEGACY_ASCII_CHARS].map((c) => c.codePointAt(0)!);
  return cells.map((cp, i) => (cp === 0 || cp === 0x20 || (edition === 'bedrock' && i < 32) ? 0 : cp));
}

// ---------------------------------------------------------------------------------------------
// Versions

/** What a Java version's font loader can read. */
export interface JavaFontSupport {
  /** font/default.json providers (1.13+); otherwise only ascii.png */
  json: boolean;
  /** "ttf" provider (1.13+) */
  ttf: boolean;
  /** "space" provider: the space width can change (1.19+) */
  space: boolean;
  /** Unifont from unifont.zip instead of unicode_page_XX.png (1.20+) */
  unihex: boolean;
  /** Provider filters, e.g. {"uniform": false} (1.20.5+) */
  filters: boolean;
  /** Characters beyond U+FFFF in a bitmap's "chars" (1.16+) */
  astral: boolean;
}

export function javaFontSupport(version: string): JavaFontSupport {
  const after = (v: string) => compareJavaVersions(version, v) > 0;
  const json = after('1.12.2');
  return { json, ttf: json, space: after('1.18.2'), unihex: after('1.19.4'), filters: after('1.20.4'), astral: after('1.15.2') };
}

export interface FontTarget {
  edition: 'java' | 'bedrock';
  /** Java version id; ignored for Bedrock */
  version: string;
}

/** Whether a character of the font reaches the game for a target (and in which cell form). */
export function targetCovers(target: FontTarget, cp: number): boolean {
  // Bedrock's glyph pages cover the Basic Multilingual Plane only.
  if (target.edition === 'bedrock') return cp <= 0xffff;
  if (javaFontSupport(target.version).json) return true;
  return LEGACY_SET.has(cp);
}

const LEGACY_SET = new Set(legacyCells('java').filter(Boolean));
const DEFAULT8_SET = new Set(legacyCells('bedrock').filter(Boolean));

/** Bedrock glyph pages (code point >> 8) the font needs: characters that default8.png doesn't hold. */
export function bedrockPages(cps: Iterable<number>): number[] {
  const pages = new Set<number>();
  for (const cp of cps) if (cp <= 0xffff && !DEFAULT8_SET.has(cp)) pages.add(cp >> 8);
  return [...pages].sort((a, b) => a - b);
}

export function inDefault8(cp: number): boolean {
  return DEFAULT8_SET.has(cp);
}

/** Whether glyphs are squeezed into the 8-pixel box for a target. */
export function usesBox(target: FontTarget): boolean {
  return target.edition === 'bedrock' || !javaFontSupport(target.version).json;
}

/**
 * The glyphs as the game would get them for a target: the characters it can show, fitted into the
 * 8-pixel box where the format needs it (returned in cell form so previews draw them the same way).
 */
export function glyphsFor(doc: FontDoc, target: FontTarget): Map<number, Mask> {
  const box = usesBox(target);
  const out = new Map<number, Mask>();
  for (const [cp, m] of doc.glyphs) {
    if (!targetCovers(target, cp)) continue;
    out.set(cp, box ? fromBox(fitBox(m, doc.size), doc.size) : m);
  }
  return out;
}

/** Whether the embedded TrueType font is used for a target. */
export function ttfUsed(doc: FontDoc, target: FontTarget): boolean {
  return !!doc.ttf && target.edition === 'java' && javaFontSupport(target.version).ttf;
}

/** Space width the game uses for a target. */
export function spaceFor(doc: FontDoc, target: FontTarget): number {
  return target.edition === 'java' && javaFontSupport(target.version).space ? doc.space : DEFAULT_SPACE;
}

// ---------------------------------------------------------------------------------------------
// Drafts (the page keeps the current font in the browser)

export interface FontDraft {
  v: 1;
  size: GlyphSize;
  space: number;
  /** code point -> base64 of the packed bits */
  glyphs: Record<string, string>;
}

function packBits(m: Mask): Uint8Array {
  const out = new Uint8Array(Math.ceil(m.length / 8));
  for (let i = 0; i < m.length; i++) if (m[i]) out[i >> 3] |= 1 << (i & 7);
  return out;
}

function unpackBits(b: Uint8Array, n: number): Mask {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (b[i >> 3] >> (i & 7)) & 1;
  return out;
}

const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function toDraft(doc: FontDoc): FontDraft {
  const glyphs: Record<string, string> = {};
  for (const [cp, m] of doc.glyphs) glyphs[cp.toString(16)] = toB64(packBits(m));
  return { v: 1, size: doc.size, space: doc.space, glyphs };
}

export function fromDraft(d: unknown): FontDoc | null {
  const x = d as FontDraft | null;
  if (!x || x.v !== 1 || !GLYPH_SIZES.includes(x.size) || typeof x.glyphs !== 'object') return null;
  const doc = newFont(x.size);
  doc.space = Number.isFinite(x.space) ? Math.max(0, Math.min(16, Math.round(x.space))) : DEFAULT_SPACE;
  const n = cellW(x.size) * cellH(x.size);
  for (const [k, v] of Object.entries(x.glyphs)) {
    const cp = parseInt(k, 16);
    if (!isDrawable(cp) || typeof v !== 'string') continue;
    try {
      setGlyph(doc, cp, unpackBits(fromB64(v), n));
    } catch {
      /* a damaged entry is skipped */
    }
  }
  return doc;
}
