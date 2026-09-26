import type { EffectLayer, OptionDef, OptionValue, TextureCategory } from '../../core/types';

/*
 * Whole-pack texture effects. Every effect is a pure function over straight (non-premultiplied)
 * RGBA ImageData: the input is never mutated and alpha is preserved unless the effect is about
 * alpha (outline outside a shape, glow halo). Pixels with alpha 0 keep their colour, except in
 * Bedrock .tga textures where alpha is a tint/dye mask and the colour underneath is visible.
 */

export interface EffectContext {
  /** Pack path of the texture, e.g. 'assets/minecraft/textures/block/stone.png' */
  path: string;
  category: TextureCategory;
  /** Known animation state (Java: has animation .mcmeta, Bedrock: flipbook). Guessed from the shape when omitted. */
  animated?: boolean;
  /** Explicit frame size (Java mcmeta animation.width/height) when frames are not square vertical tiles. */
  frameWidth?: number;
  frameHeight?: number;
}

/** color: per-pixel colour change; spatial: looks at neighbours; alpha: may change transparency; resize: changes size */
export type EffectKind = 'color' | 'spatial' | 'alpha' | 'resize';

export interface EffectDef {
  type: string;
  label: string;
  icon?: string;
  description?: string;
  kind?: EffectKind;
  /** Categories preselected when this effect is added as a new layer (undefined = every category). */
  defaultCategories?: TextureCategory[];
  params: OptionDef[];
  apply(img: ImageData, params: Record<string, OptionValue>, ctx: EffectContext): ImageData;
}

export interface EffectPreset {
  id: string;
  label: string;
  description: string;
  layers: Omit<EffectLayer, 'id'>[];
  /** Two colours for a preset card gradient */
  swatch?: [string, string];
}

type Px = Uint8ClampedArray<ArrayBuffer>;
type Params = Record<string, OptionValue>;

// ---------------------------------------------------------------------------------------------
// ImageData helpers (work in browsers, workers and Node)

function makeImage(w: number, h: number, data?: Px): ImageData {
  const d = data ?? new Uint8ClampedArray(w * h * 4);
  if (typeof ImageData !== 'undefined') return new ImageData(d, w, h);
  return { width: w, height: h, data: d, colorSpace: 'srgb' } as ImageData;
}

function cloneImage(img: ImageData): ImageData {
  return makeImage(img.width, img.height, new Uint8ClampedArray(img.data));
}

function crop(img: ImageData, x0: number, y0: number, w: number, h: number): ImageData {
  const out = new Uint8ClampedArray(w * h * 4);
  const src = img.data;
  for (let y = 0; y < h; y++) {
    const s = ((y0 + y) * img.width + x0) * 4;
    out.set(src.subarray(s, s + w * 4), y * w * 4);
  }
  return makeImage(w, h, out);
}

function blit(dst: ImageData, src: ImageData, x0: number, y0: number): void {
  const d = dst.data;
  const s = src.data;
  for (let y = 0; y < src.height; y++) {
    const so = y * src.width * 4;
    d.set(s.subarray(so, so + src.width * 4), ((y0 + y) * dst.width + x0) * 4);
  }
}

// ---------------------------------------------------------------------------------------------
// Context helpers

/** Bedrock .tga textures use alpha as data (tint masks, dye masks): the colour under alpha 0 is visible. */
function alphaIsData(ctx: EffectContext): boolean {
  return /\.tga$/i.test(ctx.path);
}

const TILING = new Set<TextureCategory>(['block']);
const STRIP_GUESS = new Set<TextureCategory>(['block', 'item', 'particle']);
/** Tile-sized art where 16 px = 1x; used to scale pixel-width parameters for HD textures. */
const TILE_ART = new Set<TextureCategory>(['block', 'item', 'particle']);

function frameGrid(img: ImageData, ctx: EffectContext): { fw: number; fh: number } {
  const { width: w, height: h } = img;
  const fw = ctx.frameWidth ?? 0;
  const fh = ctx.frameHeight ?? 0;
  if (fw > 0 && fh > 0 && w % fw === 0 && h % fh === 0 && (fw < w || fh < h)) return { fw, fh };
  if (fh > 0 && !fw && h % fh === 0 && fh < h) return { fw: w, fh };
  if (h > w && h % w === 0 && (ctx.animated ?? STRIP_GUESS.has(ctx.category))) return { fw: w, fh: w };
  return { fw: w, fh: h };
}

/** Runs fn on every animation frame separately (so spatial effects never bleed between frames). */
function perFrame(img: ImageData, ctx: EffectContext, fn: (frame: ImageData) => ImageData): ImageData {
  const { fw, fh } = frameGrid(img, ctx);
  if (fw === img.width && fh === img.height) return fn(img);
  const cols = img.width / fw;
  const rows = img.height / fh;
  let out: ImageData | null = null;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const res = fn(crop(img, c * fw, r * fh, fw, fh));
      if (!out) out = makeImage(res.width * cols, res.height * rows);
      blit(out, res, c * res.width, r * res.height);
    }
  }
  return out ?? img;
}

function pixelScale(img: ImageData, ctx: EffectContext): number {
  if (!TILE_ART.has(ctx.category)) return 1;
  return Math.max(1, Math.round(img.width / 16));
}

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic 0..1 value for a pixel. */
function hash01(seed: number, x: number, y: number): number {
  let h = (seed ^ Math.imul(x + 0x9e37, 0x85ebca6b) ^ Math.imul(y + 0x7f4a, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------------------------
// Colour helpers

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
const smooth = (t: number) => t * t * (3 - 2 * t);

const HSL = new Float64Array(3);
function rgbToHsl(r: number, g: number, b: number): void {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = r > g ? (r > b ? r : b) : g > b ? g : b;
  const min = r < g ? (r < b ? r : b) : g < b ? g : b;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  HSL[0] = h;
  HSL[1] = s;
  HSL[2] = l;
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number, out: Float64Array): void {
  if (s <= 0) {
    out[0] = out[1] = out[2] = l * 255;
    return;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  out[0] = hue2rgb(p, q, h + 1 / 3) * 255;
  out[1] = hue2rgb(p, q, h) * 255;
  out[2] = hue2rgb(p, q, h - 1 / 3) * 255;
}

export function parseHexColor(v: OptionValue | undefined, fallback: [number, number, number] = [0, 0, 0]): [number, number, number] {
  if (typeof v !== 'string') return fallback;
  let s = v.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.replace(/./g, (c) => c + c);
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(s)) return fallback;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

const num = (v: OptionValue | undefined, d = 0): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : typeof v === 'boolean' ? (v ? 1 : 0) : d;
  return Number.isFinite(n) ? n : d;
};
const bool = (v: OptionValue | undefined): boolean => v === true || v === 'true' || v === 1;
const str = (v: OptionValue | undefined, d: string): string => (typeof v === 'string' ? v : d);

/**
 * Applies fn to the RGB of every visible pixel (see alphaIsData) and mixes the result with the
 * original by `amount` (0..1). Alpha is never touched.
 */
function colorPass(img: ImageData, ctx: EffectContext, amount: number, fn: (px: Float64Array) => void): ImageData {
  if (!(amount > 0)) return img;
  const out = cloneImage(img);
  const d = out.data;
  const all = alphaIsData(ctx);
  const px = new Float64Array(3);
  const full = amount >= 1;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0 && !all) continue;
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    px[0] = r;
    px[1] = g;
    px[2] = b;
    fn(px);
    if (full) {
      d[i] = px[0];
      d[i + 1] = px[1];
      d[i + 2] = px[2];
    } else {
      d[i] = r + (px[0] - r) * amount;
      d[i + 1] = g + (px[1] - g) * amount;
      d[i + 2] = b + (px[2] - b) * amount;
    }
  }
  return out;
}

/** Per-channel lookup table pass (fast path for curves). */
function lutPass(img: ImageData, ctx: EffectContext, lut: Uint8ClampedArray): ImageData {
  const out = cloneImage(img);
  const d = out.data;
  const all = alphaIsData(ctx);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0 && !all) continue;
    d[i] = lut[d[i]];
    d[i + 1] = lut[d[i + 1]];
    d[i + 2] = lut[d[i + 2]];
  }
  return out;
}

function buildLut(fn: (c: number) => number): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  for (let c = 0; c < 256; c++) lut[c] = fn(c);
  return lut;
}

/**
 * Alpha-weighted box blur of the RGB channels (transparent neighbours don't bleed in).
 * Returns premultiplied-by-weight sums divided back to colour, as Float32 RGB per pixel.
 */
function blurRgb(img: ImageData, radius: number, wrap: boolean, weightAll: boolean): Float32Array {
  const { width: w, height: h, data: d } = img;
  const n = w * h;
  const acc = new Float32Array(n * 4); // r*w, g*w, b*w, w
  for (let i = 0; i < n; i++) {
    const a = weightAll ? 1 : d[i * 4 + 3] / 255;
    acc[i * 4] = d[i * 4] * a;
    acc[i * 4 + 1] = d[i * 4 + 1] * a;
    acc[i * 4 + 2] = d[i * 4 + 2] * a;
    acc[i * 4 + 3] = a;
  }
  const tmp = new Float32Array(n * 4);
  const idx = (v: number, size: number) => (wrap ? ((v % size) + size) % size : clamp(v, 0, size - 1));
  // horizontal
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = -radius; k <= radius; k++) {
        const j = (y * w + idx(x + k, w)) * 4;
        r += acc[j];
        g += acc[j + 1];
        b += acc[j + 2];
        a += acc[j + 3];
      }
      const o = (y * w + x) * 4;
      tmp[o] = r;
      tmp[o + 1] = g;
      tmp[o + 2] = b;
      tmp[o + 3] = a;
    }
  }
  // vertical
  const out = new Float32Array(n * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = -radius; k <= radius; k++) {
        const j = (idx(y + k, h) * w + x) * 4;
        r += tmp[j];
        g += tmp[j + 1];
        b += tmp[j + 2];
        a += tmp[j + 3];
      }
      const i = y * w + x;
      if (a > 1e-6) {
        out[i * 3] = r / a;
        out[i * 3 + 1] = g / a;
        out[i * 3 + 2] = b / a;
      } else {
        out[i * 3] = d[i * 4];
        out[i * 3 + 1] = d[i * 4 + 1];
        out[i * 3 + 2] = d[i * 4 + 2];
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Option builders

const range = (key: string, label: string, def: number, min: number, max: number, extra: Partial<OptionDef> = {}): OptionDef => ({
  key, label, group: 'Effect', type: 'range', default: def, min, max, step: 1, ...extra,
});
const toggle = (key: string, label: string, def: boolean, extra: Partial<OptionDef> = {}): OptionDef => ({
  key, label, group: 'Effect', type: 'toggle', default: def, ...extra,
});
const color = (key: string, label: string, def: string, extra: Partial<OptionDef> = {}): OptionDef => ({
  key, label, group: 'Effect', type: 'color', default: def, ...extra,
});
const choice = (key: string, label: string, def: string, options: [string, string][], extra: Partial<OptionDef> = {}): OptionDef => ({
  key, label, group: 'Effect', type: 'select', default: def, options: options.map(([value, l]) => ({ value, label: l })), ...extra,
});
const amountOpt = (def = 100) => range('amount', 'Amount', def, 0, 100, { unit: '%' });

// ---------------------------------------------------------------------------------------------
// Palettes

function hexList(s: string): [number, number, number][] {
  return s.trim().split(/\s+/).map((h) => parseHexColor(h));
}

export const RETRO_PALETTES: Record<string, { label: string; colors: [number, number, number][] }> = {
  pico8: { label: 'PICO-8', colors: hexList('000000 1d2b53 7e2553 008751 ab5236 5f574f c2c3c7 fff1e8 ff004d ffa300 ffec27 00e436 29adff 83769c ff77a8 ffccaa') },
  endesga32: {
    label: 'Endesga 32',
    colors: hexList('be4a2f d77643 ead4aa e4a672 b86f50 733e39 3e2731 a22633 e43b44 f77622 feae34 fee761 63c74d 3e8948 265c42 193c3e 124e89 0099db 2ce8f5 ffffff c0cbdc 8b9bb4 5a6988 3a4466 262b44 181425 ff0044 68386c b55088 f6757a e8b796 c28569'),
  },
  sweetie16: { label: 'Sweetie 16', colors: hexList('1a1c2c 5d275d b13e53 ef7d57 ffcd75 a7f070 38b764 257179 29366f 3b5dc9 41a6f6 73eff7 f4f4f4 94b0c2 566c86 333c57') },
  nes: {
    label: 'NES',
    colors: hexList(
      '7c7c7c 0000fc 0000bc 4428bc 940084 a80020 a81000 881400 503000 007800 006800 005800 004058 000000 ' +
        'bcbcbc 0078f8 0058f8 6844fc d800cc e40058 f83800 e45c10 ac7c00 00b800 00a800 00a844 008888 ' +
        'f8f8f8 3cbcfc 6888fc 9878f8 f878f8 f85898 f87858 fca044 f8b800 b8f818 58d854 58f898 00e8d8 787878 ' +
        'fcfcfc a4e4fc b8b8f8 d8b8f8 f8b8f8 f8a4c0 f0d0b0 fce0a8 f8d878 d8f878 b8f8b8 b8f8d8 00fcfc f8d8f8',
    ),
  },
  cga: { label: 'CGA', colors: hexList('000000 0000aa 00aa00 00aaaa aa0000 aa00aa aa5500 aaaaaa 555555 5555ff 55ff55 55ffff ff5555 ff55ff ffff55 ffffff') },
  gameboy: { label: 'Game Boy', colors: hexList('0f380f 306230 8bac0f 9bbc0f') },
  mono: { label: '1-bit', colors: hexList('14141c f0ece2') },
};

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
}

// ---------------------------------------------------------------------------------------------
// Effects

const HUE_CENTERS: Record<string, number> = { reds: 0, yellows: 60, greens: 120, cyans: 180, blues: 240, magentas: 300 };

const hueEffect: EffectDef = {
  type: 'hue',
  label: 'Hue shift',
  icon: 'refresh',
  kind: 'color',
  description: 'Rotate colours around the colour wheel — all of them or just one colour range.',
  params: [
    range('degrees', 'Shift', 30, -180, 180, { unit: '°' }),
    choice('range', 'Colours', 'all', [['all', 'All colours'], ['reds', 'Reds'], ['yellows', 'Yellows'], ['greens', 'Greens'], ['cyans', 'Cyans'], ['blues', 'Blues'], ['magentas', 'Magentas']]),
  ],
  apply(img, p, ctx) {
    const deg = num(p.degrees);
    if (!deg) return img;
    const center = HUE_CENTERS[str(p.range, 'all')];
    return colorPass(img, ctx, 1, (px) => {
      rgbToHsl(px[0], px[1], px[2]);
      if (HSL[1] < 1e-3) return;
      let w = 1;
      if (center !== undefined) {
        const hd = Math.abs((((HSL[0] * 360 - center) % 360) + 540) % 360 - 180);
        w = hd <= 25 ? 1 : hd >= 60 ? 0 : 1 - smooth((hd - 25) / 35);
        if (w <= 0) return;
      }
      let h = HSL[0] + (deg * w) / 360;
      h -= Math.floor(h);
      hslToRgb(h, HSL[1], HSL[2], px);
    });
  },
};

const saturationEffect: EffectDef = {
  type: 'saturation',
  label: 'Saturation',
  icon: 'brush',
  kind: 'color',
  description: 'Make colours more vivid or more muted.',
  params: [range('amount', 'Amount', 30, -100, 100, { unit: '%' })],
  apply(img, p, ctx) {
    const f = 1 + num(p.amount) / 100;
    if (f === 1) return img;
    return colorPass(img, ctx, 1, (px) => {
      const y = luma(px[0], px[1], px[2]);
      px[0] = y + (px[0] - y) * f;
      px[1] = y + (px[1] - y) * f;
      px[2] = y + (px[2] - y) * f;
    });
  },
};

const brightnessEffect: EffectDef = {
  type: 'brightness',
  label: 'Brightness',
  icon: 'sun',
  kind: 'color',
  description: 'Lighten or darken every texture.',
  params: [range('amount', 'Amount', 15, -100, 100, { unit: '%' })],
  apply(img, p, ctx) {
    const k = num(p.amount) / 100;
    if (!k) return img;
    const lut = buildLut((c) => {
      if (k < 0) return c * (1 + k);
      const lifted = 255 * Math.pow(c / 255, 1 / (1 + 1.2 * k));
      return lifted + (255 - lifted) * 0.15 * k;
    });
    return lutPass(img, ctx, lut);
  },
};

const contrastEffect: EffectDef = {
  type: 'contrast',
  label: 'Contrast',
  icon: 'sliders',
  kind: 'color',
  description: 'Increase or reduce the difference between light and dark.',
  params: [range('amount', 'Amount', 20, -100, 100, { unit: '%' })],
  apply(img, p, ctx) {
    const a = num(p.amount) / 100;
    if (!a) return img;
    const f = a >= 0 ? 1 + a * 1.5 : 1 + a;
    return lutPass(img, ctx, buildLut((c) => (c - 128) * f + 128));
  },
};

const temperatureEffect: EffectDef = {
  type: 'temperature',
  label: 'Temperature',
  icon: 'thermometer',
  kind: 'color',
  description: 'Warm (orange) or cool (blue) colour balance.',
  params: [range('amount', 'Warmth', 25, -100, 100, { unit: '%', description: 'Negative values cool the textures down' })],
  apply(img, p, ctx) {
    const t = num(p.amount) / 100;
    if (!t) return img;
    const kr = 1 + 0.2 * t;
    const kg = 1 + 0.05 * t;
    const kb = 1 - 0.25 * t;
    return colorPass(img, ctx, 1, (px) => {
      const y0 = luma(px[0], px[1], px[2]);
      const r = px[0] * kr;
      const g = px[1] * kg;
      const b = px[2] * kb;
      const y1 = luma(r, g, b);
      const s = y1 > 0.5 ? lerp(1, y0 / y1, 0.7) : 1;
      px[0] = r * s;
      px[1] = g * s;
      px[2] = b * s;
    });
  },
};

const tintEffect: EffectDef = {
  type: 'tint',
  label: 'Tint / colorize',
  icon: 'spray-image',
  kind: 'color',
  description: 'Wash textures with a colour, or recolour them completely.',
  params: [
    color('color', 'Colour', '#ff9a3c'),
    choice('mode', 'Mode', 'tint', [['tint', 'Soft tint'], ['colorize', 'Colorize'], ['multiply', 'Multiply']]),
    amountOpt(35),
  ],
  apply(img, p, ctx) {
    const amount = num(p.amount, 35) / 100;
    const [cr, cg, cb] = parseHexColor(p.color, [255, 154, 60]);
    const mode = str(p.mode, 'tint');
    if (mode === 'colorize') {
      rgbToHsl(cr, cg, cb);
      const th = HSL[0];
      const ts = HSL[1];
      return colorPass(img, ctx, amount, (px) => {
        rgbToHsl(px[0], px[1], px[2]);
        hslToRgb(th, ts, HSL[2], px);
      });
    }
    if (mode === 'multiply') {
      return colorPass(img, ctx, amount, (px) => {
        px[0] = (px[0] * cr) / 255;
        px[1] = (px[1] * cg) / 255;
        px[2] = (px[2] * cb) / 255;
      });
    }
    const bl = [cr / 255, cg / 255, cb / 255];
    return colorPass(img, ctx, amount, (px) => {
      for (let c = 0; c < 3; c++) {
        const a = px[c] / 255;
        const b = bl[c];
        px[c] = ((1 - 2 * b) * a * a + 2 * b * a) * 255;
      }
    });
  },
};

const grayscaleEffect: EffectDef = {
  type: 'grayscale',
  label: 'Grayscale',
  icon: 'image',
  kind: 'color',
  description: 'Remove colour.',
  params: [amountOpt(100)],
  apply(img, p, ctx) {
    return colorPass(img, ctx, num(p.amount, 100) / 100, (px) => {
      px[0] = px[1] = px[2] = luma(px[0], px[1], px[2]);
    });
  },
};

const sepiaEffect: EffectDef = {
  type: 'sepia',
  label: 'Sepia',
  icon: 'images',
  kind: 'color',
  description: 'Old photograph brown tones.',
  params: [amountOpt(80)],
  apply(img, p, ctx) {
    return colorPass(img, ctx, num(p.amount, 80) / 100, (px) => {
      const r = px[0], g = px[1], b = px[2];
      px[0] = 0.393 * r + 0.769 * g + 0.189 * b;
      px[1] = 0.349 * r + 0.686 * g + 0.168 * b;
      px[2] = 0.272 * r + 0.534 * g + 0.131 * b;
    });
  },
};

const invertEffect: EffectDef = {
  type: 'invert',
  label: 'Invert',
  icon: 'invert',
  kind: 'color',
  description: 'Negative colours, or flip only light and dark while keeping hues.',
  params: [choice('mode', 'Mode', 'rgb', [['rgb', 'Negative (all channels)'], ['lightness', 'Lightness only (keep hues)']]), amountOpt(100)],
  apply(img, p, ctx) {
    const amount = num(p.amount, 100) / 100;
    if (str(p.mode, 'rgb') === 'lightness') {
      return colorPass(img, ctx, amount, (px) => {
        rgbToHsl(px[0], px[1], px[2]);
        hslToRgb(HSL[0], HSL[1], 1 - HSL[2], px);
      });
    }
    if (!(amount > 0)) return img;
    return lutPass(img, ctx, buildLut((c) => lerp(c, 255 - c, amount)));
  },
};

const posterizeEffect: EffectDef = {
  type: 'posterize',
  label: 'Posterize',
  icon: 'grid-2x2-2',
  kind: 'color',
  description: 'Reduce the number of colour steps for a flat, graphic look.',
  params: [range('levels', 'Levels', 5, 2, 16, { description: 'Colour steps per channel' })],
  apply(img, p, ctx) {
    const n = Math.round(clamp(num(p.levels, 5), 2, 256));
    return lutPass(img, ctx, buildLut((c) => (Math.round((c / 255) * (n - 1)) / (n - 1)) * 255));
  },
};

const pastelEffect: EffectDef = {
  type: 'pastel',
  label: 'Pastel',
  icon: 'cloud',
  kind: 'color',
  description: 'Soft, light, candy-coloured tones.',
  params: [amountOpt(60)],
  apply(img, p, ctx) {
    return colorPass(img, ctx, num(p.amount, 60) / 100, (px) => {
      rgbToHsl(px[0], px[1], px[2]);
      const l = 0.6 + 0.34 * HSL[2];
      const s = HSL[1] < 0.06 ? HSL[1] : 0.42 + 0.3 * HSL[1];
      hslToRgb(HSL[0], s, l, px);
    });
  },
};

const vignetteEffect: EffectDef = {
  type: 'vignette',
  label: 'Edges & bevel',
  icon: 'spotlight',
  kind: 'spatial',
  defaultCategories: ['block'],
  description: 'Darken the edges of each texture, or give blocks a raised 3D bevel.',
  params: [
    choice('mode', 'Style', 'vignette', [['vignette', 'Soft vignette'], ['edges', 'Dark edges'], ['bevel', '3D bevel']]),
    range('strength', 'Strength', 40, 0, 100, { unit: '%' }),
    range('width', 'Edge width', 2, 1, 6, { unit: 'px', description: 'Used by the edge and bevel styles' }),
  ],
  apply(img, p, ctx) {
    const strength = clamp(num(p.strength, 40), 0, 100) / 100;
    if (!strength) return img;
    const mode = str(p.mode, 'vignette');
    const all = alphaIsData(ctx);
    return perFrame(img, ctx, (f) => {
      const out = cloneImage(f);
      const d = out.data;
      const { width: w, height: h } = f;
      const width = Math.max(1, Math.round(num(p.width, 2) * pixelScale(f, ctx)));
      const cx = (w - 1) / 2;
      const cy = (h - 1) / 2;
      const maxd = Math.hypot(cx, cy) || 1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (d[i + 3] === 0 && !all) continue;
          let mul = 1;
          let add = 0;
          if (mode === 'vignette') {
            const r = Math.hypot(x - cx, y - cy) / maxd;
            const v = r <= 0.3 ? 0 : Math.pow((r - 0.3) / 0.7, 1.6);
            mul = 1 - strength * 0.85 * v;
          } else {
            const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
            if (edge >= width) continue;
            const t = 1 - edge / width;
            if (mode === 'edges') mul = 1 - strength * 0.75 * t;
            else {
              const lit = Math.min(x, y) <= Math.min(w - 1 - x, h - 1 - y);
              if (lit) add = strength * 0.55 * t;
              else mul = 1 - strength * 0.55 * t;
            }
          }
          for (let c = 0; c < 3; c++) {
            const v = d[i + c] * mul;
            d[i + c] = add ? v + (255 - v) * add : v;
          }
        }
      }
      return out;
    });
  },
};

/**
 * Chamfer distance (in pixels) from every pixel to the nearest set pixel of `seed`:
 * city-block when `diag` is false, chessboard when true. Unreachable pixels get Infinity.
 */
function distanceTo(seed: Uint8Array, w: number, h: number, diag: boolean): Float32Array {
  const dist = new Float32Array(w * h);
  for (let i = 0; i < dist.length; i++) dist[i] = seed[i] ? 0 : Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = dist[i];
      if (x > 0) v = Math.min(v, dist[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, dist[i - w] + 1);
        if (diag && x > 0) v = Math.min(v, dist[i - w - 1] + 1);
        if (diag && x < w - 1) v = Math.min(v, dist[i - w + 1] + 1);
      }
      dist[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = dist[i];
      if (x < w - 1) v = Math.min(v, dist[i + 1] + 1);
      if (y < h - 1) {
        v = Math.min(v, dist[i + w] + 1);
        if (diag && x < w - 1) v = Math.min(v, dist[i + w + 1] + 1);
        if (diag && x > 0) v = Math.min(v, dist[i + w - 1] + 1);
      }
      dist[i] = v;
    }
  }
  return dist;
}

/** Separable box blur of a scalar field; out-of-range samples count as 0. */
function blurScalar(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const norm = 1 / (radius * 2 + 1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < w) s += src[y * w + xx];
      }
      tmp[y * w + x] = s * norm;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -radius; k <= radius; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < h) s += tmp[yy * w + x];
      }
      out[y * w + x] = s * norm;
    }
  }
  return out;
}

const outlineEffect: EffectDef = {
  type: 'outline',
  label: 'Outline',
  icon: 'frame',
  kind: 'alpha',
  defaultCategories: ['block', 'item'],
  description: 'Draw a line around items and shapes, or a border around every block.',
  params: [
    choice('mode', 'Where', 'auto', [['auto', 'Automatic'], ['outside', 'Around shapes'], ['inside', 'Inside shape edges'], ['tile', 'Block border']]),
    color('color', 'Colour', '#000000'),
    range('opacity', 'Opacity', 100, 0, 100, { unit: '%' }),
    range('thickness', 'Thickness', 1, 1, 4, { unit: 'px' }),
    toggle('corners', 'Include corners', false, { description: 'Also outline diagonally touching pixels' }),
  ],
  apply(img, p, ctx) {
    const opacity = clamp(num(p.opacity, 100), 0, 100) / 100;
    if (!opacity) return img;
    const [cr, cg, cb] = parseHexColor(p.color);
    const diag = bool(p.corners);
    const dataAlpha = alphaIsData(ctx);
    const mode = str(p.mode, 'auto');
    if (dataAlpha && (mode === 'outside' || mode === 'inside')) return img;
    return perFrame(img, ctx, (f) => {
      const { width: w, height: h, data: s } = f;
      const n = w * h;
      const thick = Math.max(1, Math.round(clamp(num(p.thickness, 1), 1, 8) * pixelScale(f, ctx)));
      const solid = new Uint8Array(n);
      let solids = 0;
      for (let i = 0; i < n; i++) {
        if (dataAlpha || s[i * 4 + 3] >= 128) {
          solid[i] = 1;
          solids++;
        }
      }
      if (!solids) return f;
      let m = mode;
      if (m === 'auto') {
        // Opaque tiles get a border; sparse cut-outs (items, flowers, torches) an outline around the
        // shape; dense cut-outs (leaves) a line inside so their holes stay open.
        if (dataAlpha || solids === n) m = 'tile';
        else m = ctx.category === 'item' || ctx.category === 'particle' || solids / n < 0.6 ? 'outside' : 'inside';
      }
      const out = cloneImage(f);
      const d = out.data;
      if (m === 'tile') {
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (Math.min(x, y, w - 1 - x, h - 1 - y) >= thick) continue;
            const i = (y * w + x) * 4;
            if (d[i + 3] === 0 && !dataAlpha) continue;
            d[i] = lerp(d[i], cr, opacity);
            d[i + 1] = lerp(d[i + 1], cg, opacity);
            d[i + 2] = lerp(d[i + 2], cb, opacity);
          }
        }
        return out;
      }
      if (m === 'outside') {
        const dist = distanceTo(solid, w, h, diag);
        for (let i = 0; i < n; i++) {
          if (solid[i] || dist[i] > thick) continue;
          const o = i * 4;
          const a = d[o + 3] / 255;
          const oa = opacity * (1 - a);
          const na = a + oa;
          if (na <= 0) continue;
          d[o] = (d[o] * a + cr * oa) / na;
          d[o + 1] = (d[o + 1] * a + cg * oa) / na;
          d[o + 2] = (d[o + 2] * a + cb * oa) / na;
          d[o + 3] = na * 255;
        }
        return out;
      }
      // inside: solid pixels within `thick` of a transparent pixel
      const empty = new Uint8Array(n);
      for (let i = 0; i < n; i++) empty[i] = solid[i] ? 0 : 1;
      const dist = distanceTo(empty, w, h, diag);
      for (let i = 0; i < n; i++) {
        if (!solid[i] || dist[i] > thick) continue;
        const o = i * 4;
        d[o] = lerp(d[o], cr, opacity);
        d[o + 1] = lerp(d[o + 1], cg, opacity);
        d[o + 2] = lerp(d[o + 2], cb, opacity);
      }
      return out;
    });
  },
};

const noiseEffect: EffectDef = {
  type: 'noise',
  label: 'Noise / grain',
  icon: 'shuffle',
  kind: 'spatial',
  description: 'Add film grain or gritty texture. The same on every animation frame.',
  params: [range('amount', 'Amount', 12, 0, 100, { unit: '%' }), toggle('mono', 'Monochrome grain', true)],
  apply(img, p, ctx) {
    const amount = clamp(num(p.amount, 12), 0, 100) / 100;
    if (!amount) return img;
    const mono = bool(p.mono);
    const seed = hashString(ctx.path);
    const all = alphaIsData(ctx);
    const k = amount * 128;
    return perFrame(img, ctx, (f) => {
      const out = cloneImage(f);
      const d = out.data;
      const w = f.width;
      for (let y = 0; y < f.height; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (d[i + 3] === 0 && !all) continue;
          if (mono) {
            const v = (hash01(seed, x, y) - 0.5) * k;
            d[i] += v;
            d[i + 1] += v;
            d[i + 2] += v;
          } else {
            d[i] += (hash01(seed, x, y) - 0.5) * k;
            d[i + 1] += (hash01(seed + 1, x, y) - 0.5) * k;
            d[i + 2] += (hash01(seed + 2, x, y) - 0.5) * k;
          }
        }
      }
      return out;
    });
  },
};

const sharpenEffect: EffectDef = {
  type: 'sharpen',
  label: 'Sharpen',
  icon: 'zoom-in',
  kind: 'spatial',
  description: 'Crisper details and stronger pixel contrast.',
  params: [amountOpt(40)],
  apply(img, p, ctx) {
    const k = (clamp(num(p.amount, 40), 0, 100) / 100) * 1.5;
    if (!k) return img;
    const all = alphaIsData(ctx);
    const wrap = TILING.has(ctx.category);
    return perFrame(img, ctx, (f) => {
      const blur = blurRgb(f, 1, wrap, all);
      const out = cloneImage(f);
      const d = out.data;
      for (let i = 0, n = f.width * f.height; i < n; i++) {
        const o = i * 4;
        if (d[o + 3] === 0 && !all) continue;
        d[o] = d[o] + (d[o] - blur[i * 3]) * k;
        d[o + 1] = d[o + 1] + (d[o + 1] - blur[i * 3 + 1]) * k;
        d[o + 2] = d[o + 2] + (d[o + 2] - blur[i * 3 + 2]) * k;
      }
      return out;
    });
  },
};

const blurEffect: EffectDef = {
  type: 'blur',
  label: 'Soft blur',
  icon: 'zoom-out',
  kind: 'spatial',
  description: 'Soften textures. Block textures blur seamlessly across tile edges.',
  params: [amountOpt(50), range('radius', 'Radius', 1, 1, 3, { unit: 'px' })],
  apply(img, p, ctx) {
    const amount = clamp(num(p.amount, 50), 0, 100) / 100;
    if (!amount) return img;
    const all = alphaIsData(ctx);
    const wrap = TILING.has(ctx.category);
    return perFrame(img, ctx, (f) => {
      const radius = Math.max(1, Math.round(clamp(num(p.radius, 1), 1, 8) * pixelScale(f, ctx)));
      const blur = blurRgb(f, radius, wrap, all);
      const out = cloneImage(f);
      const d = out.data;
      for (let i = 0, n = f.width * f.height; i < n; i++) {
        const o = i * 4;
        if (d[o + 3] === 0 && !all) continue;
        d[o] = lerp(d[o], blur[i * 3], amount);
        d[o + 1] = lerp(d[o + 1], blur[i * 3 + 1], amount);
        d[o + 2] = lerp(d[o + 2], blur[i * 3 + 2], amount);
      }
      return out;
    });
  },
};

const pixelateEffect: EffectDef = {
  type: 'pixelate',
  label: 'Pixelate',
  icon: 'grid-3x3',
  kind: 'spatial',
  description: 'Lower the resolution into bigger pixels, keeping the size and transparency.',
  params: [range('size', 'Pixel size', 2, 2, 8, { unit: 'px' })],
  apply(img, p, ctx) {
    const size = Math.round(clamp(num(p.size, 2), 1, 64));
    if (size <= 1) return img;
    const all = alphaIsData(ctx);
    return perFrame(img, ctx, (f) => {
      const { width: w, height: h } = f;
      const out = cloneImage(f);
      const d = out.data;
      for (let by = 0; by < h; by += size) {
        for (let bx = 0; bx < w; bx += size) {
          let r = 0, g = 0, b = 0, wt = 0;
          const ey = Math.min(h, by + size);
          const ex = Math.min(w, bx + size);
          for (let y = by; y < ey; y++) {
            for (let x = bx; x < ex; x++) {
              const i = (y * w + x) * 4;
              const a = all ? 1 : d[i + 3] / 255;
              r += d[i] * a;
              g += d[i + 1] * a;
              b += d[i + 2] * a;
              wt += a;
            }
          }
          if (wt <= 0) continue;
          r /= wt;
          g /= wt;
          b /= wt;
          for (let y = by; y < ey; y++) {
            for (let x = bx; x < ex; x++) {
              const i = (y * w + x) * 4;
              if (d[i + 3] === 0 && !all) continue;
              d[i] = r;
              d[i + 1] = g;
              d[i + 2] = b;
            }
          }
        }
      }
      return out;
    });
  },
};

/** Packs RGBA into one comparable number; transparent pixels compare equal unless alpha is data. */
function packPixels(f: ImageData, all: boolean): Uint32Array {
  const n = f.width * f.height;
  const out = new Uint32Array(n);
  const d = f.data;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    out[i] = !all && d[o + 3] === 0 ? 0 : ((d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]) >>> 0;
  }
  return out;
}

function scaleNx(f: ImageData, factor: 2 | 3, wrap: boolean, all: boolean): ImageData {
  const { width: w, height: h, data: src } = f;
  const key = packPixels(f, all);
  const ow = w * factor;
  const out = makeImage(ow, h * factor);
  const d = out.data;
  const at = (x: number, y: number) => {
    if (wrap) {
      x = ((x % w) + w) % w;
      y = ((y % h) + h) % h;
    } else {
      x = clamp(x, 0, w - 1);
      y = clamp(y, 0, h - 1);
    }
    return y * w + x;
  };
  const put = (ox: number, oy: number, si: number) => {
    const o = (oy * ow + ox) * 4;
    const s = si * 4;
    d[o] = src[s];
    d[o + 1] = src[s + 1];
    d[o + 2] = src[s + 2];
    d[o + 3] = src[s + 3];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const iA = at(x - 1, y - 1), iB = at(x, y - 1), iC = at(x + 1, y - 1);
      const iD = at(x - 1, y), iE = y * w + x, iF = at(x + 1, y);
      const iG = at(x - 1, y + 1), iH = at(x, y + 1), iI = at(x + 1, y + 1);
      const A = key[iA], B = key[iB], C = key[iC], D = key[iD], E = key[iE], F = key[iF], G = key[iG], H = key[iH], I = key[iI];
      const ox = x * factor;
      const oy = y * factor;
      if (factor === 2) {
        const go = B !== H && D !== F;
        put(ox, oy, go && D === B ? iD : iE);
        put(ox + 1, oy, go && B === F ? iF : iE);
        put(ox, oy + 1, go && D === H ? iD : iE);
        put(ox + 1, oy + 1, go && H === F ? iF : iE);
      } else {
        const go = B !== H && D !== F;
        put(ox, oy, go && D === B ? iD : iE);
        put(ox + 1, oy, go && ((D === B && E !== C) || (B === F && E !== A)) ? iB : iE);
        put(ox + 2, oy, go && B === F ? iF : iE);
        put(ox, oy + 1, go && ((D === B && E !== G) || (D === H && E !== A)) ? iD : iE);
        put(ox + 1, oy + 1, iE);
        put(ox + 2, oy + 1, go && ((B === F && E !== I) || (H === F && E !== C)) ? iF : iE);
        put(ox, oy + 2, go && D === H ? iD : iE);
        put(ox + 1, oy + 2, go && ((D === H && E !== I) || (H === F && E !== G)) ? iH : iE);
        put(ox + 2, oy + 2, go && H === F ? iF : iE);
      }
    }
  }
  return out;
}

function scaleNearest(f: ImageData, factor: number): ImageData {
  const { width: w, height: h, data: s } = f;
  const ow = w * factor;
  const out = makeImage(ow, h * factor);
  const d = out.data;
  for (let y = 0; y < h * factor; y++) {
    const sy = Math.floor(y / factor);
    for (let x = 0; x < ow; x++) {
      const si = (sy * w + Math.floor(x / factor)) * 4;
      const o = (y * ow + x) * 4;
      d[o] = s[si];
      d[o + 1] = s[si + 1];
      d[o + 2] = s[si + 2];
      d[o + 3] = s[si + 3];
    }
  }
  return out;
}

/** Largest texture side the upscaler produces. */
export const MAX_UPSCALED_SIZE = 8192;

const upscaleEffect: EffectDef = {
  type: 'upscale',
  label: 'Smooth HD upscale',
  icon: 'expand',
  kind: 'resize',
  defaultCategories: ['block', 'item', 'particle', 'entity', 'armor', 'painting'],
  description: 'Double or quadruple the resolution with a pixel-art smoothing filter (Scale2x/Scale3x).',
  params: [
    choice('factor', 'Scale', '2', [['2', '2x'], ['3', '3x'], ['4', '4x']]),
    choice('algorithm', 'Filter', 'scale2x', [['scale2x', 'Smooth edges (Scale2x/3x)'], ['nearest', 'Sharp pixels (nearest)']]),
  ],
  apply(img, p, ctx) {
    let factor = Math.round(num(p.factor, 2));
    if (factor !== 2 && factor !== 3 && factor !== 4) factor = 2;
    while (factor > 1 && Math.max(img.width, img.height) * factor > MAX_UPSCALED_SIZE) factor = factor === 4 ? 2 : factor - 1;
    if (factor <= 1) return img;
    const all = alphaIsData(ctx);
    const wrap = TILING.has(ctx.category);
    const nearest = str(p.algorithm, 'scale2x') === 'nearest';
    return perFrame(img, ctx, (f) => {
      if (nearest) return scaleNearest(f, factor);
      if (factor === 3) return scaleNx(f, 3, wrap, all);
      const x2 = scaleNx(f, 2, wrap, all);
      return factor === 4 ? scaleNx(x2, 2, wrap, all) : x2;
    });
  },
};

const ditherEffect: EffectDef = {
  type: 'dither',
  label: 'Dither',
  icon: 'grid-3x2',
  kind: 'spatial',
  description: 'Retro ordered dithering with fewer colour steps.',
  params: [range('levels', 'Levels', 4, 2, 8, { description: 'Colour steps per channel' }), range('strength', 'Pattern strength', 100, 0, 100, { unit: '%' })],
  apply(img, p, ctx) {
    const n = Math.round(clamp(num(p.levels, 4), 2, 32));
    const strength = clamp(num(p.strength, 100), 0, 100) / 100;
    const all = alphaIsData(ctx);
    const step = 255 / (n - 1);
    return perFrame(img, ctx, (f) => {
      const out = cloneImage(f);
      const d = out.data;
      const w = f.width;
      for (let y = 0; y < f.height; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (d[i + 3] === 0 && !all) continue;
          const t = BAYER4[(y & 3) * 4 + (x & 3)] * step * strength;
          for (let c = 0; c < 3; c++) d[i + c] = Math.round(clamp(d[i + c] + t, 0, 255) / step) * step;
        }
      }
      return out;
    });
  },
};

const glowEffect: EffectDef = {
  type: 'glow',
  label: 'Glow',
  icon: 'lightbulb',
  kind: 'alpha',
  description: 'Bright parts shine and bloom, with an optional halo around items.',
  params: [
    range('strength', 'Strength', 50, 0, 100, { unit: '%' }),
    range('threshold', 'Glow from brightness', 60, 0, 100, { unit: '%' }),
    toggle('halo', 'Halo around shapes', true, { description: 'Adds soft light into transparent space next to bright pixels' }),
  ],
  apply(img, p, ctx) {
    const strength = clamp(num(p.strength, 50), 0, 100) / 100;
    if (!strength) return img;
    const thr = clamp(num(p.threshold, 60), 0, 99) / 100;
    const all = alphaIsData(ctx);
    const halo = bool(p.halo) && !all;
    return perFrame(img, ctx, (f) => {
      const { width: w, height: h, data: s } = f;
      const n = w * h;
      const bright = makeImage(w, h);
      const bd = bright.data;
      let any = false;
      for (let i = 0; i < n; i++) {
        const o = i * 4;
        const a = all ? 255 : s[o + 3];
        if (!a) continue;
        const y = luma(s[o], s[o + 1], s[o + 2]) / 255;
        const k = y > thr ? (y - thr) / (1 - thr) : 0;
        if (k <= 0) continue;
        any = true;
        bd[o] = s[o];
        bd[o + 1] = s[o + 1];
        bd[o + 2] = s[o + 2];
        bd[o + 3] = k * a;
      }
      if (!any) return f;
      const radius = Math.max(1, pixelScale(f, ctx));
      const blurred = blurRgb(bright, radius, TILING.has(ctx.category), false);
      const mask = new Float32Array(n);
      for (let i = 0; i < n; i++) mask[i] = bd[i * 4 + 3] / 255;
      const inten = blurScalar(mask, w, h, radius);
      const out = cloneImage(f);
      const d = out.data;
      for (let i = 0; i < n; i++) {
        const o = i * 4;
        const g = Math.min(1, inten[i] * 2.2) * strength;
        if (g <= 0) continue;
        const gr = blurred[i * 3], gg = blurred[i * 3 + 1], gb = blurred[i * 3 + 2];
        if (d[o + 3] > 0 || all) {
          d[o] = 255 - (255 - d[o]) * (1 - (gr / 255) * g);
          d[o + 1] = 255 - (255 - d[o + 1]) * (1 - (gg / 255) * g);
          d[o + 2] = 255 - (255 - d[o + 2]) * (1 - (gb / 255) * g);
        } else if (halo) {
          const m = Math.max(gr, gg, gb, 1);
          const lift = 255 / m;
          d[o] = gr * lift;
          d[o + 1] = gg * lift;
          d[o + 2] = gb * lift;
          d[o + 3] = Math.min(1, g * 0.9) * 255;
        }
      }
      return out;
    });
  },
};

const flipEffect: EffectDef = {
  type: 'flip',
  label: 'Flip',
  icon: 'flip-horizontal-2',
  kind: 'spatial',
  description: 'Mirror textures horizontally and/or vertically (each animation frame separately).',
  params: [toggle('horizontal', 'Flip horizontally', true), toggle('vertical', 'Flip vertically', false)],
  apply(img, p, ctx) {
    const fx = bool(p.horizontal);
    const fy = bool(p.vertical);
    if (!fx && !fy) return img;
    return perFrame(img, ctx, (f) => {
      const { width: w, height: h, data: s } = f;
      const out = makeImage(w, h);
      const d = out.data;
      for (let y = 0; y < h; y++) {
        const sy = fy ? h - 1 - y : y;
        for (let x = 0; x < w; x++) {
          const sx = fx ? w - 1 - x : x;
          const si = (sy * w + sx) * 4;
          const o = (y * w + x) * 4;
          d[o] = s[si];
          d[o + 1] = s[si + 1];
          d[o + 2] = s[si + 2];
          d[o + 3] = s[si + 3];
        }
      }
      return out;
    });
  },
};

const gradientMapEffect: EffectDef = {
  type: 'gradientMap',
  label: 'Gradient map',
  icon: 'magic-edit',
  kind: 'color',
  description: 'Replace dark, middle and light tones with three colours of your choice.',
  params: [color('shadows', 'Shadows', '#1d1135'), color('midtones', 'Midtones', '#b8466a'), color('highlights', 'Highlights', '#ffe7a3'), amountOpt(100)],
  apply(img, p, ctx) {
    const a = parseHexColor(p.shadows, [29, 17, 53]);
    const b = parseHexColor(p.midtones, [184, 70, 106]);
    const c = parseHexColor(p.highlights, [255, 231, 163]);
    const table = new Float64Array(256 * 3);
    for (let v = 0; v < 256; v++) {
      const t = v / 255;
      const [x, y, k] = t < 0.5 ? [a, b, t * 2] : [b, c, (t - 0.5) * 2];
      for (let ch = 0; ch < 3; ch++) table[v * 3 + ch] = lerp(x[ch], y[ch], k);
    }
    return colorPass(img, ctx, num(p.amount, 100) / 100, (px) => {
      const v = Math.round(clamp(luma(px[0], px[1], px[2]), 0, 255)) * 3;
      px[0] = table[v];
      px[1] = table[v + 1];
      px[2] = table[v + 2];
    });
  },
};

const paletteEffect: EffectDef = {
  type: 'palette',
  label: 'Retro palette',
  icon: 'colors-swatch',
  kind: 'spatial',
  description: 'Snap every colour to a classic console or pixel-art palette.',
  params: [
    choice('palette', 'Palette', 'pico8', Object.entries(RETRO_PALETTES).map(([k, v]) => [k, v.label] as [string, string])),
    choice('match', 'Match by', 'color', [['color', 'Closest colour'], ['brightness', 'Brightness (for 2–4 colour palettes)']]),
    toggle('dither', 'Dither', false, { description: 'Ordered dithering between palette colours' }),
    amountOpt(100),
  ],
  apply(img, p, ctx) {
    const amount = clamp(num(p.amount, 100), 0, 100) / 100;
    if (!amount) return img;
    const pal = (RETRO_PALETTES[str(p.palette, 'pico8')] ?? RETRO_PALETTES.pico8).colors;
    const byLuma = str(p.match, 'color') === 'brightness';
    const dither = bool(p.dither);
    const sorted = [...pal].sort((x, y) => luma(x[0], x[1], x[2]) - luma(y[0], y[1], y[2]));
    const lumas = sorted.map((c) => luma(c[0], c[1], c[2]));
    const cache = new Map<number, number>();
    const nearest = (r: number, g: number, b: number): number => {
      const key = (r << 16) | (g << 8) | b;
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      let best = 0;
      if (byLuma) {
        const lo = lumas[0];
        const hi = lumas[lumas.length - 1];
        const y = lo + (luma(r, g, b) / 255) * (hi - lo);
        let bd = Infinity;
        for (let i = 0; i < lumas.length; i++) {
          const dd = Math.abs(lumas[i] - y);
          if (dd < bd) {
            bd = dd;
            best = i;
          }
        }
      } else {
        let bd = Infinity;
        for (let i = 0; i < sorted.length; i++) {
          const c = sorted[i];
          const dd = colorDistance(r, g, b, c[0], c[1], c[2]);
          if (dd < bd) {
            bd = dd;
            best = i;
          }
        }
      }
      cache.set(key, best);
      return best;
    };
    const all = alphaIsData(ctx);
    const spread = byLuma ? 255 / Math.max(1, sorted.length - 1) : 48;
    return perFrame(img, ctx, (f) => {
      const out = cloneImage(f);
      const d = out.data;
      const w = f.width;
      for (let y = 0; y < f.height; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (d[i + 3] === 0 && !all) continue;
          let r = d[i], g = d[i + 1], b = d[i + 2];
          if (dither) {
            const t = BAYER4[(y & 3) * 4 + (x & 3)] * spread;
            r = clamp(Math.round(r + t), 0, 255);
            g = clamp(Math.round(g + t), 0, 255);
            b = clamp(Math.round(b + t), 0, 255);
          }
          const c = sorted[nearest(r, g, b)];
          d[i] = lerp(d[i], c[0], amount);
          d[i + 1] = lerp(d[i + 1], c[1], amount);
          d[i + 2] = lerp(d[i + 2], c[2], amount);
        }
      }
      return out;
    });
  },
};

export const EFFECTS: EffectDef[] = [
  hueEffect,
  saturationEffect,
  brightnessEffect,
  contrastEffect,
  temperatureEffect,
  tintEffect,
  grayscaleEffect,
  sepiaEffect,
  invertEffect,
  posterizeEffect,
  pastelEffect,
  gradientMapEffect,
  paletteEffect,
  vignetteEffect,
  outlineEffect,
  glowEffect,
  noiseEffect,
  sharpenEffect,
  blurEffect,
  pixelateEffect,
  ditherEffect,
  upscaleEffect,
  flipEffect,
];

const EFFECT_MAP = new Map(EFFECTS.map((e) => [e.type, e]));

export function getEffect(type: string): EffectDef | undefined {
  return EFFECT_MAP.get(type);
}

// ---------------------------------------------------------------------------------------------
// Parameters & layers

/** Fills missing params with defaults and clamps/validates every value against its OptionDef. */
export function resolveParams(def: EffectDef, params: Record<string, OptionValue> | undefined): Params {
  const out: Params = {};
  for (const o of def.params) {
    const v = params?.[o.key];
    switch (o.type) {
      case 'range': {
        let n = v === undefined ? num(o.default) : num(v, num(o.default));
        if (o.min !== undefined) n = Math.max(o.min, n);
        if (o.max !== undefined) n = Math.min(o.max, n);
        out[o.key] = n;
        break;
      }
      case 'toggle':
        out[o.key] = v === undefined ? bool(o.default) : bool(v);
        break;
      case 'select': {
        const s = v === undefined ? String(o.default) : String(v);
        out[o.key] = o.options?.some((x) => x.value === s) ? s : String(o.default);
        break;
      }
      case 'color':
        out[o.key] = typeof v === 'string' && /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v.trim()) ? v : String(o.default);
        break;
    }
  }
  return out;
}

export function defaultParams(type: string): Params {
  const def = EFFECT_MAP.get(type);
  return def ? resolveParams(def, undefined) : {};
}

/** A new layer for the given effect with default params (and default categories). */
export function createLayer(type: string, params?: Params): Omit<EffectLayer, 'id'> {
  const def = EFFECT_MAP.get(type);
  if (!def) throw new Error(`Unknown effect "${type}".`);
  return {
    type,
    enabled: true,
    params: resolveParams(def, params),
    ...(def.defaultCategories ? { categories: [...def.defaultCategories] } : {}),
  };
}

/** Overlay/lookup textures whose pixels are data for the renderer rather than art. */
const TECHNICAL = /(^|\/)(misc\/(shadow|vignette|credits_vignette|pumpkinblur|spyglass_scope|nausea|powder_snow_outline|underwater)|effect\/dither)\.(png|tga)$/i;
/** Armor trim key palette: the exact colours the trim pattern textures are drawn with. */
const KEY_PALETTE = /(^|\/)textures\/(palettes\/trim_base|trims\/color_palettes\/trim_palette)\.(png|tga)$/i;
/**
 * Armor trim patterns (Java trims/entity|items|models, Bedrock trims/*): every pixel must stay an
 * exact key-palette colour or the game can't swap in the material colours. Only size changes that
 * copy pixels (upscale) are safe; the look comes from recolouring the material palettes instead.
 */
const PALETTE_KEYED = /(^|\/)textures\/trims\/(?!color_palettes\/).+\.(png|tga)$/i;
/** Material palettes: strips of colours, recolouring is fine but their size and layout are data. */
const PALETTE_LIKE = /(^|\/)textures\/(palettes|trims\/color_palettes)\//i;

/** Whether a layer (enabled, known type, category filter) touches a texture. */
export function layerApplies(layer: EffectLayer | Omit<EffectLayer, 'id'>, ctx: EffectContext): boolean {
  if (!layer.enabled) return false;
  const def = EFFECT_MAP.get(layer.type);
  if (!def) return false;
  if (TECHNICAL.test(ctx.path) || KEY_PALETTE.test(ctx.path)) return false;
  if (PALETTE_KEYED.test(ctx.path) && def.kind !== 'resize') return false;
  if (PALETTE_LIKE.test(ctx.path) && def.kind !== 'color') return false;
  if (layer.categories && layer.categories.length) return layer.categories.includes(ctx.category);
  // No explicit filter: leave fonts alone and only recolour colour maps.
  if (ctx.category === 'font') return false;
  if (ctx.category === 'colormap') return def.kind === 'color';
  return true;
}

export function hasActiveEffects(layers: readonly (EffectLayer | Omit<EffectLayer, 'id'>)[] | undefined): boolean {
  return !!layers?.some((l) => l.enabled && EFFECT_MAP.has(l.type));
}

export function effectsApply(layers: readonly (EffectLayer | Omit<EffectLayer, 'id'>)[] | undefined, ctx: EffectContext): boolean {
  return !!layers?.some((l) => layerApplies(l, ctx));
}

/**
 * Applies the enabled layers in order. Never mutates `img`; returns `img` itself when no layer
 * applies to this texture.
 */
export function applyEffects(img: ImageData, layers: readonly (EffectLayer | Omit<EffectLayer, 'id'>)[], ctx: EffectContext): ImageData {
  let cur = img;
  let c = ctx;
  for (const layer of layers) {
    if (!layerApplies(layer, ctx)) continue;
    const def = EFFECT_MAP.get(layer.type)!;
    const next = def.apply(cur, resolveParams(def, layer.params), c);
    // Explicit frame sizes are in pixels of the current image: keep them in step after a resize.
    if ((next.width !== cur.width || next.height !== cur.height) && (c.frameWidth || c.frameHeight)) {
      c = {
        ...c,
        frameWidth: c.frameWidth ? Math.max(1, Math.round((c.frameWidth * next.width) / cur.width)) : c.frameWidth,
        frameHeight: c.frameHeight ? Math.max(1, Math.round((c.frameHeight * next.height) / cur.height)) : c.frameHeight,
      };
    }
    cur = next;
  }
  return cur;
}

// ---------------------------------------------------------------------------------------------
// Presets

const L = (type: string, params: Params = {}, categories?: TextureCategory[]): Omit<EffectLayer, 'id'> => {
  const def = EFFECT_MAP.get(type);
  if (!def) throw new Error(`Unknown effect "${type}".`);
  return { type, enabled: true, params: resolveParams(def, params), ...(categories ? { categories } : {}) };
};

const WORLD: TextureCategory[] = ['block', 'item', 'entity', 'particle', 'environment', 'painting', 'armor', 'effect', 'map', 'misc', 'other'];

export const EFFECT_PRESETS: EffectPreset[] = [
  {
    id: 'dark-mode',
    label: 'Dark Mode',
    description: 'Moody, darker world and menus with slightly cooler colours.',
    swatch: ['#161a24', '#46506a'],
    layers: [L('brightness', { amount: -32 }), L('contrast', { amount: 10 }), L('saturation', { amount: -12 }), L('temperature', { amount: -10 })],
  },
  {
    id: 'pastel-dream',
    label: 'Pastel Dream',
    description: 'Soft candy colours, light and airy.',
    swatch: ['#ffc8dd', '#bde0fe'],
    layers: [L('pastel', { amount: 70 }), L('hue', { degrees: 8, range: 'all' })],
  },
  {
    id: 'neon-outline',
    label: 'Neon Outline',
    description: 'Dark blocks with glowing cyan borders and outlined, shining items.',
    swatch: ['#0b0f1a', '#39f5ff'],
    layers: [
      L('brightness', { amount: -60 }, ['block', 'entity']),
      L('saturation', { amount: -30 }, ['block']),
      L('outline', { mode: 'auto', color: '#39f5ff', opacity: 100, thickness: 1, corners: false }, ['block', 'item']),
      L('glow', { strength: 55, threshold: 55, halo: true }, ['item', 'particle']),
    ],
  },
  {
    id: 'retro-8bit',
    label: 'Retro 8-bit',
    description: 'Punchy colours snapped to a classic console palette.',
    swatch: ['#124e89', '#e43b44'],
    layers: [L('contrast', { amount: 12 }), L('saturation', { amount: 25 }), L('palette', { palette: 'endesga32', match: 'color', dither: false, amount: 100 })],
  },
  {
    id: 'autumn',
    label: 'Autumn',
    description: 'Orange and red foliage with a warm golden light.',
    swatch: ['#b5541c', '#f2b33d'],
    layers: [
      L('hue', { degrees: -70, range: 'greens' }),
      L('hue', { degrees: -15, range: 'yellows' }),
      L('temperature', { amount: 30 }),
      L('saturation', { amount: 12 }),
    ],
  },
  {
    id: 'winter-frost',
    label: 'Winter Frost',
    description: 'Icy teal leaves, pale colours and a cold blue light.',
    swatch: ['#dff3ff', '#7fb8d8'],
    layers: [
      L('hue', { degrees: 45, range: 'greens' }),
      L('saturation', { amount: -35 }),
      L('temperature', { amount: -45 }),
      L('brightness', { amount: 14 }),
    ],
  },
  {
    id: 'noir',
    label: 'Noir',
    description: 'High-contrast black and white with film grain.',
    swatch: ['#0e0e0e', '#d9d9d9'],
    layers: [L('grayscale', { amount: 100 }), L('contrast', { amount: 30 }), L('vignette', { mode: 'edges', strength: 30, width: 2 }, ['block']), L('noise', { amount: 6, mono: true }, WORLD)],
  },
  {
    id: 'sepia-memories',
    label: 'Sepia Memories',
    description: 'Warm old-photo tones with soft edges.',
    swatch: ['#3b2a1a', '#e3c49a'],
    layers: [L('sepia', { amount: 85 }), L('contrast', { amount: -6 }), L('brightness', { amount: 6 }), L('vignette', { mode: 'vignette', strength: 35 }, ['block']), L('noise', { amount: 5, mono: true }, WORLD)],
  },
  {
    id: 'inverted',
    label: 'Inverted',
    description: 'Photo-negative colours everywhere.',
    swatch: ['#ff6b00', '#0094ff'],
    layers: [L('invert', { mode: 'rgb', amount: 100 })],
  },
  {
    id: 'cartoon',
    label: 'Cartoon',
    description: 'Bold flat colours with dark ink outlines.',
    swatch: ['#ffd23f', '#2b2d42'],
    layers: [
      L('saturation', { amount: 45 }),
      L('contrast', { amount: 12 }),
      L('posterize', { levels: 7 }),
      L('outline', { mode: 'auto', color: '#16161f', opacity: 70, thickness: 1, corners: false }, ['block', 'item']),
    ],
  },
  {
    id: 'smooth-hd',
    label: 'Smooth HD (2x)',
    description: 'Doubles the resolution with smoothed pixel-art edges.',
    swatch: ['#5bd35b', '#2f7d32'],
    layers: [L('upscale', { factor: '2', algorithm: 'scale2x' }, ['block', 'item', 'particle', 'entity', 'armor', 'painting'])],
  },
  {
    id: 'vivid',
    label: 'Vivid',
    description: 'Richer colours, more contrast and crisper details.',
    swatch: ['#ff3d7f', '#3dd9ff'],
    layers: [L('saturation', { amount: 40 }), L('contrast', { amount: 12 }), L('sharpen', { amount: 25 }, ['block', 'item'])],
  },
  {
    id: 'golden-hour',
    label: 'Golden Hour',
    description: 'Sunset glow: warm, bright and a little dreamy.',
    swatch: ['#ff9f43', '#ffe29a'],
    layers: [L('temperature', { amount: 45 }), L('tint', { color: '#ffb347', mode: 'tint', amount: 25 }), L('brightness', { amount: 8 }), L('contrast', { amount: 8 })],
  },
  {
    id: 'game-boy',
    label: 'Game Boy',
    description: 'Four shades of green, like the original handheld.',
    swatch: ['#0f380f', '#9bbc0f'],
    layers: [L('contrast', { amount: 10 }), L('palette', { palette: 'gameboy', match: 'brightness', dither: false, amount: 100 })],
  },
  {
    id: '3d-blocks',
    label: '3D Blocks',
    description: 'A raised bevel on every block for a chunky, tactile look.',
    swatch: ['#8d8d8d', '#e0e0e0'],
    layers: [L('vignette', { mode: 'bevel', strength: 55, width: 1 }, ['block']), L('contrast', { amount: 6 }, ['block'])],
  },
];

export function getPreset(id: string): EffectPreset | undefined {
  return EFFECT_PRESETS.find((p) => p.id === id);
}
