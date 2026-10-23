// Stamps for the pixel editor's stamp tool: the presets (small pixel brushes drawn in shades of the
// main colour), stamps saved from a selection, turning and flipping them, and how they are stored
// (this browser's list in localStorage, the pack's own in project.stamps, base64 RGBA). No DOM.

import type { TextureStamp } from '../../../core/types';
import { createImageData } from '../../../core/pixels';

export type RGBA = [number, number, number, number];

/** The biggest stamp saved from a selection */
export const STAMP_MAX = 32;
/** Stamps kept in this browser */
export const STAMPS_KEPT = 40;

export type PresetId = 'ore' | 'cracks' | 'moss' | 'dither' | 'sparkles' | 'pebbles';

/**
 * Presets as rows of shades: '.' is left alone, 0..4 are the main colour's shades from darkest to
 * lightest (2 is the colour itself).
 */
const PRESETS: Record<PresetId, readonly string[]> = {
  ore: [
    '..2.....',
    '.231..2.',
    '..21.231',
    '......1.',
    '.2......',
    '231..32.',
    '.1..321.',
    '.....1..',
  ],
  cracks: [
    '....1...',
    '....0...',
    '...0....',
    '...01...',
    '..0..0..',
    '.0....01',
    '.1.....0',
    '0.......',
  ],
  moss: [
    '..3..2..',
    '.2322.3.',
    '2213222.',
    '.21222.3',
    '2.1.21..',
    '...2....',
  ],
  dither: [
    '2.2.2.',
    '.2.2.2',
    '2.2.2.',
    '.2.2.2',
    '2.2.2.',
    '.2.2.2',
  ],
  sparkles: [
    '..3......',
    '..4......',
    '34443....',
    '..4...3..',
    '..3..343.',
    '......3..',
    '.3.......',
  ],
  pebbles: [
    '.12.....',
    '1221..2.',
    '.11..231',
    '......1.',
    '..2.....',
    '.231.12.',
    '..1.1221',
    '.....11.',
  ],
};

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

// ---------------------------------------------------------------------------------------------
// Shades

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, mx ? d / mx : 0, mx / 255];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Moves a hue towards a target hue by up to `deg` degrees (the short way round). */
function hueToward(h: number, target: number, deg: number): number {
  let d = ((target - h + 540) % 360) - 180;
  if (Math.abs(d) > deg) d = Math.sign(d) * deg;
  return (h + d + 360) % 360;
}

/**
 * A shade of a colour `steps` darker (negative) or lighter (positive), the way pixel artists shade:
 * darker shades lean towards blue and get a little more saturated, lighter ones lean towards yellow
 * and get a little paler. Greys stay grey.
 */
export function shade(c: RGBA, steps: number): RGBA {
  if (!steps) return [...c];
  const [h, s, v] = rgbToHsv(c[0], c[1], c[2]);
  const grey = s < 0.08;
  const n = Math.abs(steps);
  let nh = h;
  let ns = s;
  let nv = v;
  for (let i = 0; i < n; i++) {
    if (steps < 0) {
      nv = nv * 0.8;
      if (!grey) {
        ns = Math.min(1, ns * 1.1 + 0.03);
        nh = hueToward(nh, 240, 8);
      }
    } else {
      nv = Math.min(1, nv * 1.16 + 0.04);
      if (!grey) {
        ns = ns * 0.86;
        nh = hueToward(nh, 60, 8);
      }
    }
  }
  const [r, g, b] = hsvToRgb(nh, grey ? s : ns, nv);
  return [r, g, b, c[3]];
}

/** A preset drawn in shades of a colour. */
export function presetImage(id: PresetId, color: RGBA): ImageData {
  const rows = PRESETS[id];
  const w = Math.max(...rows.map((r) => r.length));
  const img = createImageData(w, rows.length);
  const shades = [-2, -1, 0, 1, 2].map((k) => shade(color, k));
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const k = row.charCodeAt(x) - 48;
      if (k < 0 || k > 4) continue;
      img.data.set(shades[k], (y * w + x) * 4);
    }
  });
  return img;
}

// ---------------------------------------------------------------------------------------------
// Turning and flipping

/** How a stamp is turned: quarter turns clockwise, then flipped (left-right, top-bottom). */
export interface StampTransform {
  turns: number;
  flipX: boolean;
  flipY: boolean;
}

export const NO_TRANSFORM: StampTransform = { turns: 0, flipX: false, flipY: false };

/** A quarter turn clockwise. */
export function rotateCW(img: ImageData): ImageData {
  const { width: w, height: h } = img;
  const out = createImageData(h, w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const d = (x * h + (h - 1 - y)) * 4;
      out.data[d] = img.data[s];
      out.data[d + 1] = img.data[s + 1];
      out.data[d + 2] = img.data[s + 2];
      out.data[d + 3] = img.data[s + 3];
    }
  }
  return out;
}

export function flip(img: ImageData, horizontal: boolean): ImageData {
  const { width: w, height: h } = img;
  const out = createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = horizontal ? w - 1 - x : x;
      const sy = horizontal ? y : h - 1 - y;
      out.data.set(img.data.subarray((sy * w + sx) * 4, (sy * w + sx) * 4 + 4), (y * w + x) * 4);
    }
  }
  return out;
}

export function transformStamp(img: ImageData, t: StampTransform): ImageData {
  let out = img;
  for (let i = 0; i < (((t.turns % 4) + 4) % 4); i++) out = rotateCW(out);
  if (t.flipX) out = flip(out, true);
  if (t.flipY) out = flip(out, false);
  return out === img ? createImageData(img.width, img.height, new Uint8ClampedArray(img.data)) : out;
}

/**
 * The transform after one more step, as seen on screen: a quarter turn clockwise of what shows, or a
 * flip of what shows. Flips apply after the turns (on screen axes), so a flip just toggles; a turn
 * after a single flip turns the picture underneath the other way (R F = F R⁻¹).
 */
export function stepTransform(t: StampTransform, step: 'rotate' | 'flipH' | 'flipV'): StampTransform {
  const turns = ((t.turns % 4) + 4) % 4;
  if (step === 'flipH') return { ...t, turns, flipX: !t.flipX };
  if (step === 'flipV') return { ...t, turns, flipY: !t.flipY };
  const flips = Number(t.flipX) + Number(t.flipY);
  return { ...t, turns: (turns + (flips === 1 ? 3 : 1)) % 4 };
}

// ---------------------------------------------------------------------------------------------
// Saved stamps

/** The opaque part of an image (null: nothing in it, or bigger than STAMP_MAX). */
export function trimStamp(img: ImageData): ImageData | null {
  let x0 = img.width;
  let y0 = img.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (!img.data[(y * img.width + x) * 4 + 3]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  if (w > STAMP_MAX || h > STAMP_MAX) return null;
  const out = createImageData(w, h);
  for (let y = 0; y < h; y++) out.data.set(img.data.subarray(((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x0 + w) * 4), y * w * 4);
  return out;
}

function toBase64(bytes: Uint8ClampedArray): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): Uint8ClampedArray | null {
  try {
    const s = atob(b64);
    const out = new Uint8ClampedArray(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

let idCounter = 0;
export function stampId(): string {
  return `s${Date.now().toString(36)}${(++idCounter).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function stampRecord(img: ImageData, name: string, id = stampId()): TextureStamp {
  return { id, name, width: img.width, height: img.height, pixels: toBase64(img.data), updatedAt: Date.now() };
}

export function stampImage(r: TextureStamp): ImageData | null {
  const px = fromBase64(r.pixels);
  if (!px || px.length !== r.width * r.height * 4) return null;
  return createImageData(r.width, r.height, px);
}

/** Stamps from storage or a project file: the readable ones (null when there are none). */
export function checkStampRecords(x: unknown): TextureStamp[] | null {
  if (!Array.isArray(x)) return null;
  const out: TextureStamp[] = [];
  const seen = new Set<string>();
  for (const r of x) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const w = o.width;
    const h = o.height;
    if (typeof o.id !== 'string' || !o.id || seen.has(o.id) || typeof o.pixels !== 'string') continue;
    if (typeof w !== 'number' || typeof h !== 'number' || !Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > STAMP_MAX || h > STAMP_MAX) continue;
    const rec: TextureStamp = { id: o.id, name: typeof o.name === 'string' ? o.name.slice(0, 40) : '', width: w, height: h, pixels: o.pixels, updatedAt: typeof o.updatedAt === 'number' ? o.updatedAt : 0 };
    if (!stampImage(rec)) continue;
    seen.add(rec.id);
    out.push(rec);
  }
  return out.length ? out : null;
}

/** Stamps added to a list (the ones it has already, by id, are kept as they are), newest last. */
export function mergeStamps(list: readonly TextureStamp[], more: readonly TextureStamp[]): TextureStamp[] {
  const have = new Set(list.map((s) => s.id));
  return [...list, ...more.filter((s) => !have.has(s.id))];
}
