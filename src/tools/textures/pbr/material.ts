// PBR materials of the texture pack maker (the Material tab): quick materials, the parts of a texture a
// value covers, and the maps a material makes — metal / glow / roughness / light through per pixel, and
// bumps (a normal map with the height) made from the colour texture. No DOM: the panel, the export and
// the unit tests share it. The edition formats (labPBR _n / _s, Bedrock texture sets) are in ./formats.ts.

import type { PbrBumps, PbrMaterial, PbrSpot, PbrValues, PbrWhere, TextureCategory } from '../../../core/types';
import { createImageData, resizeNearest } from '../../../core/pixels';

/** Channel of each value in a metal / glow / roughness / subsurface map (Bedrock's MERS order). */
export const METAL = 0;
export const GLOW = 1;
export const ROUGH = 2;
export const SSS = 3;

/** What a texture without a material looks like: not metal, no glow, fully rough, no light through. */
export const PLAIN: PbrValues = [0, 0, 255, 0];
export const DEFAULT_BUMPS: PbrBumps = { strength: 1, invert: false, blur: 0 };
/** Default thresholds of the parts a value can cover (0-100) */
export const DEFAULT_AMOUNT = { colourful: 35, bright: 70, dark: 30 } as const;
export const DEFAULT_TOLERANCE = 12;

/** Textures a material makes sense on (the others are drawn flat by the game: GUI, fonts, maps...). */
export const PBR_CATEGORIES: ReadonlySet<TextureCategory> = new Set<TextureCategory>(['block', 'item', 'entity', 'armor', 'painting', 'particle', 'misc', 'other']);

export type PbrPresetId = 'metal' | 'polished' | 'rough' | 'wood' | 'glass' | 'glow' | 'glowSpots' | 'water' | 'plants';

export interface PbrPreset {
  id: PbrPresetId;
  values: PbrValues;
  bumps: PbrBumps | null;
  spots?: PbrSpot[];
  /** Colour of its chip in the panel (CSS) */
  swatch: string;
}

/** Quick materials, in the order the panel shows them. */
export const PBR_PRESETS: readonly PbrPreset[] = [
  { id: 'metal', values: [255, 0, 70, 0], bumps: { strength: 0.5, invert: false, blur: 1 }, swatch: 'linear-gradient(135deg, #f4f6f8, #8d96a0 55%, #e2e6ea)' },
  { id: 'polished', values: [0, 0, 45, 0], bumps: { strength: 0.4, invert: false, blur: 1 }, swatch: 'linear-gradient(135deg, #e8e3dc, #a9a39b 60%, #f2eee8)' },
  { id: 'rough', values: [0, 0, 245, 0], bumps: { strength: 1.4, invert: false, blur: 0 }, swatch: 'repeating-linear-gradient(45deg, #7d7d7d 0 3px, #969696 3px 5px, #6c6c6c 5px 8px)' },
  { id: 'wood', values: [0, 0, 195, 0], bumps: { strength: 0.9, invert: false, blur: 0 }, swatch: 'repeating-linear-gradient(0deg, #a0743f 0 3px, #8a6234 3px 5px, #b5854b 5px 8px)' },
  { id: 'glass', values: [0, 0, 8, 0], bumps: null, swatch: 'linear-gradient(135deg, rgba(190, 230, 255, 0.95), rgba(120, 180, 220, 0.5) 60%, #ffffff)' },
  { id: 'glow', values: [0, 255, 170, 0], bumps: { strength: 0.4, invert: false, blur: 1 }, swatch: 'radial-gradient(circle, #fff8c4, #ffd23c 45%, #e08a12)' },
  {
    id: 'glowSpots',
    values: [0, 0, 225, 0],
    bumps: { strength: 1, invert: false, blur: 0 },
    spots: [{ where: { kind: 'colourful', amount: DEFAULT_AMOUNT.colourful }, values: [0, 255, 80, 0] }],
    swatch: 'radial-gradient(circle at 30% 35%, #6ef2ff 0 18%, transparent 20%), radial-gradient(circle at 70% 65%, #6ef2ff 0 16%, transparent 18%), #7f7f7f',
  },
  { id: 'water', values: [0, 0, 12, 0], bumps: { strength: 0.6, invert: false, blur: 2 }, swatch: 'linear-gradient(160deg, #5aa7ff, #2b5fd6 60%, #7cc4ff)' },
  { id: 'plants', values: [0, 0, 200, 170], bumps: { strength: 0.6, invert: false, blur: 0 }, swatch: 'radial-gradient(circle at 40% 40%, #a5e86a, #4a9a2a 60%, #2f6b1a)' },
];

export const presetById = (id: string | undefined): PbrPreset | undefined => PBR_PRESETS.find((p) => p.id === id);

/** A new material made from a quick material (or a plain one, without bumps). */
export function materialFromPreset(preset: PbrPreset | null): PbrMaterial {
  return {
    base: preset ? [...preset.values] : [...PLAIN],
    spots: (preset?.spots ?? []).map(cloneSpot),
    bumps: preset?.bumps ? { ...preset.bumps } : null,
    ...(preset ? { preset: preset.id } : {}),
    updatedAt: Date.now(),
  };
}

export function cloneSpot(s: PbrSpot): PbrSpot {
  const w = s.where;
  const where: PbrWhere =
    w.kind === 'colour' ? { kind: 'colour', colours: [...w.colours], tolerance: w.tolerance } : w.kind === 'area' ? { kind: 'area', rect: [...w.rect], size: [...w.size] } : { ...w };
  return { where, values: [...s.values] };
}

/** A copy of a material (maps and the pack's original files are shared: they are never changed in place). */
export function cloneMaterial(m: PbrMaterial): PbrMaterial {
  return {
    ...m,
    base: [...m.base],
    spots: m.spots.map(cloneSpot),
    bumps: m.bumps ? { ...m.bumps } : null,
    ...(m.original ? { original: { ...m.original } } : {}),
  };
}

/**
 * The same material for another texture ("Use on similar textures"): values, parts and bumps. Maps
 * belong to their own texture and stay behind; areas scale with the texture.
 */
export function copyForTexture(m: PbrMaterial): PbrMaterial {
  return {
    base: [...m.base],
    spots: m.spots.map(cloneSpot),
    bumps: m.bumps ? { ...m.bumps } : null,
    ...(m.preset ? { preset: m.preset } : {}),
    updatedAt: Date.now(),
  };
}

/** One value for the whole texture (no map, no parts): Bedrock can write it into the texture set. */
export function uniformValues(m: PbrMaterial): PbrValues | null {
  return m.map || m.spots.length ? null : m.base;
}

/** The material changes nothing a plain texture doesn't have. */
export function isPlainMaterial(m: PbrMaterial): boolean {
  return !m.map && !m.normal && !m.bumps && !m.spots.length && sameValues(m.base, PLAIN);
}

export const sameValues = (a: PbrValues, b: PbrValues): boolean => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];

// ---------------------------------------------------------------------------------------------
// Parts of a texture

const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** 1 for each pixel `where` covers (fully transparent pixels never are). */
export function maskFor(img: ImageData, where: PbrWhere): Uint8Array {
  const { width: w, height: h, data: d } = img;
  const out = new Uint8Array(w * h);
  if (where.kind === 'area') {
    const [sw, sh] = where.size;
    const kx = sw > 0 ? w / sw : 1;
    const ky = sh > 0 ? h / sh : 1;
    const x0 = Math.max(0, Math.round(where.rect[0] * kx));
    const y0 = Math.max(0, Math.round(where.rect[1] * ky));
    const x1 = Math.min(w, Math.round((where.rect[0] + where.rect[2]) * kx));
    const y1 = Math.min(h, Math.round((where.rect[1] + where.rect[3]) * ky));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) out[y * w + x] = d[(y * w + x) * 4 + 3] > 0 ? 1 : 0;
    return out;
  }
  const amount = where.kind === 'colour' ? 0 : Math.max(0, Math.min(100, where.amount)) / 100;
  const colours = where.kind === 'colour' ? where.colours.map((c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255]) : [];
  const reach = where.kind === 'colour' ? (Math.max(0, Math.min(100, where.tolerance)) / 100) * 441.7 + 0.5 : 0;
  for (let i = 0, p = 0; p < w * h; p++, i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    let hit = false;
    if (where.kind === 'colourful') {
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      // saturation, less for very dark pixels (whose hue is noise)
      hit = max > 0 && ((max - min) / max) * Math.min(1, max / 64) >= amount;
    } else if (where.kind === 'bright') hit = luma(r, g, b) / 255 >= amount;
    else if (where.kind === 'dark') hit = luma(r, g, b) / 255 <= amount;
    else hit = colours.some(([cr, cg, cb]) => Math.hypot(r - cr, g - cg, b - cb) <= reach);
    if (hit) out[p] = 1;
  }
  return out;
}

/** The texture's colours, most common first (opaque-ish pixels only), for picking parts by colour. */
export function paletteOf(img: ImageData, max = 24): number[] {
  const counts = new Map<number, number>();
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const c = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([c]) => c);
  // merge near-identical shades so the swatches show different colours
  const out: number[] = [];
  for (const c of sorted) {
    if (out.length >= max) break;
    const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    if (out.some((o) => Math.hypot(((o >> 16) & 255) - r, ((o >> 8) & 255) - g, (o & 255) - b) < 10)) continue;
    out.push(c);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Maps

/**
 * Metal / glow / roughness / subsurface per pixel (RGBA = M, E, R, S) at the colour texture's size:
 * the material's map (or base values), then each part painted over it.
 */
export function bakeMers(colour: ImageData, m: Pick<PbrMaterial, 'base' | 'spots'>, map?: ImageData | null): ImageData {
  const { width: w, height: h } = colour;
  let out: ImageData;
  if (map) {
    const fitted = map.width === w && map.height === h ? map : resizeNearest(map, w, h);
    out = createImageData(w, h, new Uint8ClampedArray(fitted.data));
  } else {
    out = createImageData(w, h);
    const [a, b, c, e] = m.base;
    for (let i = 0; i < out.data.length; i += 4) {
      out.data[i] = a;
      out.data[i + 1] = b;
      out.data[i + 2] = c;
      out.data[i + 3] = e;
    }
  }
  for (const spot of m.spots) {
    const mask = maskFor(colour, spot.where);
    const [a, b, c, e] = spot.values;
    for (let p = 0; p < mask.length; p++) {
      if (!mask[p]) continue;
      const i = p * 4;
      out.data[i] = a;
      out.data[i + 1] = b;
      out.data[i + 2] = c;
      out.data[i + 3] = e;
    }
  }
  return out;
}

/** Height of a vertical animation strip's frames (the whole height for a single image). */
export function frameHeight(img: { width: number; height: number }): number {
  return img.height > img.width && img.width > 0 && img.height % img.width === 0 ? img.width : img.height;
}

/**
 * Height of each pixel (0-1) from its brightness, smoothed; fully transparent pixels are low. Each
 * frame of an animation strip is its own picture; `wrap` makes the edges meet like tiling blocks do.
 */
export function heightField(colour: ImageData, bumps: Pick<PbrBumps, 'invert' | 'blur'>, wrap: boolean): Float32Array {
  const { width: w, height: h, data: d } = colour;
  let hf: Float32Array = new Float32Array(w * h);
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    const v = d[i + 3] === 0 ? 0 : luma(d[i], d[i + 1], d[i + 2]) / 255;
    hf[p] = bumps.invert ? 1 - v : v;
  }
  const radius = Math.max(0, Math.min(3, Math.round(bumps.blur)));
  if (radius > 0) {
    const fh = frameHeight(colour);
    // two box blurs come close to a gaussian
    for (let pass = 0; pass < 2; pass++) hf = boxBlur(hf, w, h, fh, radius, wrap);
  }
  return hf;
}

function boxBlur(src: Float32Array, w: number, h: number, fh: number, r: number, wrap: boolean): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += src[y * w + sx(x + k, w, wrap)];
      tmp[y * w + x] = s / n;
    }
  }
  for (let y = 0; y < h; y++) {
    const f0 = Math.floor(y / fh) * fh;
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[(f0 + sx(y - f0 + k, fh, wrap)) * w + x];
      out[y * w + x] = s / n;
    }
  }
  return out;
}

/** A coordinate inside 0..size-1: wrapped around (tiling) or held at the edge. */
function sx(v: number, size: number, wrap: boolean): number {
  if (wrap) return ((v % size) + size) % size;
  return v < 0 ? 0 : v >= size ? size - 1 : v;
}

/**
 * Normal map from a height field, in labPBR's _n layout: R / G the normal's X / Y in the DirectX
 * convention (green 0 = up, the same in Bedrock), B ambient occlusion (255: none), A the height
 * (255: the surface, 1: deepest; never 0, which some shaders misread).
 */
export function normalFromHeight(hf: Float32Array, w: number, h: number, strength: number, wrap: boolean, fh = h): ImageData {
  const out = createImageData(w, h);
  const k = Math.max(0, strength) * 1.5;
  const at = (x: number, y: number, f0: number) => hf[(f0 + sx(y - f0, fh, wrap)) * w + sx(x, w, wrap)];
  for (let y = 0; y < h; y++) {
    const f0 = Math.floor(y / fh) * fh;
    for (let x = 0; x < w; x++) {
      // Sobel slopes; y grows downwards, like the DirectX green channel
      const gx = at(x + 1, y - 1, f0) + 2 * at(x + 1, y, f0) + at(x + 1, y + 1, f0) - at(x - 1, y - 1, f0) - 2 * at(x - 1, y, f0) - at(x - 1, y + 1, f0);
      const gy = at(x - 1, y + 1, f0) + 2 * at(x, y + 1, f0) + at(x + 1, y + 1, f0) - at(x - 1, y - 1, f0) - 2 * at(x, y - 1, f0) - at(x + 1, y - 1, f0);
      let nx = (-gx / 4) * k;
      let ny = (-gy / 4) * k;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * w + x) * 4;
      out.data[i] = encodeUnit(nx);
      out.data[i + 1] = encodeUnit(ny);
      out.data[i + 2] = 255;
      out.data[i + 3] = 1 + Math.round(Math.max(0, Math.min(1, hf[y * w + x])) * 254);
    }
  }
  return out;
}

/** -1..1 to 0..255 with 0 at 128 (so a flat normal is exactly 128, 128). */
export const encodeUnit = (v: number): number => Math.max(0, Math.min(255, Math.round(v * 127 + 128)));
export const decodeUnit = (c: number): number => Math.max(-1, Math.min(1, (c - 128) / 127));

/** Bumps of a colour texture as a labPBR-layout normal map (see normalFromHeight). */
export function bumpMap(colour: ImageData, bumps: PbrBumps, wrap: boolean): ImageData {
  const hf = heightField(colour, bumps, wrap);
  return normalFromHeight(hf, colour.width, colour.height, bumps.strength, wrap, frameHeight(colour));
}

/** Blocks tile, so their bumps wrap around the edges; items and mobs don't. */
export const wrapsFor = (category: TextureCategory | undefined): boolean => category === 'block';

// ---------------------------------------------------------------------------------------------
// Similar textures

/** Words at the end of a texture name that name a side or a state, not what it is. */
const SIDE_WORDS = new Set([
  'top', 'bottom', 'side', 'sides', 'front', 'back', 'end', 'inner', 'outer', 'inside', 'outside', 'on', 'off', 'lit', 'unlit',
  'base', 'overlay', 'particle', 'open', 'closed', 'upper', 'lower', 'left', 'right', 'north', 'south', 'east', 'west', 'up', 'down',
  'tip', 'middle', 'frustum', 'merge', 'still', 'flow', 'carried', 'active', 'inactive', 'powered', 'empty', 'full', 'normal', 'turned',
]);

/** A texture's name without the side / state / stage words at its end ('furnace_front_on' -> 'furnace'). */
export function familyStem(name: string): string {
  const words = name.toLowerCase().split('_').filter(Boolean);
  while (words.length > 1 && (SIDE_WORDS.has(words[words.length - 1]) || /^(stage|age)?\d+$/.test(words[words.length - 1]))) words.pop();
  return words.join('_');
}

export interface SimilarGroup {
  kind: 'sides' | 'suffix' | 'prefix';
  /** The shared word ('ore', 'oak'), or the shared name for the other sides */
  word: string;
  paths: string[];
}

/**
 * Textures like `path` in the same folder and category: the other sides of the same block, names that
 * end with the same word ('diamond_ore' -> every *_ore) and names that start with the same word.
 */
export function similarGroups(path: string, all: readonly { path: string; category: TextureCategory }[]): SimilarGroup[] {
  const dirOf = (p: string) => p.slice(0, p.lastIndexOf('/') + 1);
  const nameOf = (p: string) => p.slice(p.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
  const dir = dirOf(path);
  const self = all.find((t) => t.path === path);
  const pool = all.filter((t) => t.path !== path && dirOf(t.path) === dir && (!self || t.category === self.category) && PBR_CATEGORIES.has(t.category));
  const stem = familyStem(nameOf(path));
  const words = stem.split('_');
  const groups: SimilarGroup[] = [];
  const taken = new Set<string>();
  const add = (kind: SimilarGroup['kind'], word: string, test: (stem: string) => boolean) => {
    const paths = pool.filter((t) => test(familyStem(nameOf(t.path)))).map((t) => t.path);
    if (!paths.length) return;
    // a group only lists what the groups before it didn't (the sides of the same block come first)
    const fresh = paths.filter((p) => !taken.has(p));
    if (kind !== 'sides' && !fresh.length) return;
    paths.forEach((p) => taken.add(p));
    groups.push({ kind, word, paths: kind === 'sides' ? paths : paths.sort() });
  };
  add('sides', stem, (s) => s === stem);
  if (words.length > 1) {
    const last = words[words.length - 1];
    const first = words[0];
    add('suffix', last, (s) => s !== stem && (s === last || s.endsWith(`_${last}`)));
    add('prefix', first, (s) => s !== stem && (s === first || s.startsWith(`${first}_`)));
  }
  return groups;
}
