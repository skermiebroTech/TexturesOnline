// The 64x32 cape texture: where the cape's and the elytra's faces are, starter designs drawn by code
// (all original), reading uploaded cape files, copying the cape design onto the elytra, and the
// elytra texture pack paths. Pure (ImageData in, ImageData out), so the unit tests run it in Node.
//
// Layout (the game's cape texture; Java's elytra.png uses the same place for the wings):
//   cape box 10 x 16 x 1 at (0, 0): top (1,0) 10x1, bottom (11,0) 10x1, sides (0,1) and (11,1) 1x16,
//   outside (1,1) 10x16 (seen from behind the player), inside (12,1) 10x16 (against the back)
//   elytra wing 10 x 20 x 2 at (22, 0): top (24,0) 10x2, bottom (34,0) 10x2, edges (22,2) and (34,2)
//   2x20, inside (24,2) 10x20 (towards the back) and outside (36,2) 10x20 (seen from behind). The
//   game draws the elytra without culling and with see-through pixels, so the outside face is seen
//   from both sides where the inside one is empty (that is how the game's own elytra is drawn).
//   The left wing uses the texture as it is, the right wing mirrored. Capes are drawn solid: their
//   see-through pixels show up as a colour in game.

export const CAPE_W = 64;
export const CAPE_H = 32;

export type CapeRegionId =
  | 'capeOutside'
  | 'capeInside'
  | 'capeTop'
  | 'capeBottom'
  | 'capeLeft'
  | 'capeRight'
  | 'wingOutside'
  | 'wingInside'
  | 'wingTop'
  | 'wingBottom'
  | 'wingEdgeInner'
  | 'wingEdgeOuter';

export interface CapeRegion {
  id: CapeRegionId;
  part: 'cape' | 'elytra';
  x: number;
  y: number;
  w: number;
  h: number;
}

export const CAPE_REGIONS: readonly CapeRegion[] = [
  { id: 'capeTop', part: 'cape', x: 1, y: 0, w: 10, h: 1 },
  { id: 'capeBottom', part: 'cape', x: 11, y: 0, w: 10, h: 1 },
  { id: 'capeRight', part: 'cape', x: 0, y: 1, w: 1, h: 16 },
  { id: 'capeOutside', part: 'cape', x: 1, y: 1, w: 10, h: 16 },
  { id: 'capeLeft', part: 'cape', x: 11, y: 1, w: 1, h: 16 },
  { id: 'capeInside', part: 'cape', x: 12, y: 1, w: 10, h: 16 },
  { id: 'wingTop', part: 'elytra', x: 24, y: 0, w: 10, h: 2 },
  { id: 'wingBottom', part: 'elytra', x: 34, y: 0, w: 10, h: 2 },
  { id: 'wingEdgeInner', part: 'elytra', x: 22, y: 2, w: 2, h: 20 },
  { id: 'wingInside', part: 'elytra', x: 24, y: 2, w: 10, h: 20 },
  { id: 'wingEdgeOuter', part: 'elytra', x: 34, y: 2, w: 2, h: 20 },
  { id: 'wingOutside', part: 'elytra', x: 36, y: 2, w: 10, h: 20 },
];

export function regionOf(id: CapeRegionId): CapeRegion {
  return CAPE_REGIONS.find((r) => r.id === id)!;
}

/** The region a texture pixel belongs to, or null (unused: the game never shows it). */
export function regionAt(x: number, y: number): CapeRegion | null {
  return CAPE_REGIONS.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) ?? null;
}

/** Which pixels the game uses (1) — painting elsewhere does nothing. */
export function usedMask(): Uint8Array {
  const m = new Uint8Array(CAPE_W * CAPE_H);
  for (const r of CAPE_REGIONS) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) m[y * CAPE_W + x] = 1;
  return m;
}

/** Mirror painting: a pixel's twin across the middle of its face (left and right swap). */
export function mirrorWithinRegion(x: number, y: number): [number, number][] {
  const r = regionAt(x, y);
  if (!r) return [];
  const mx = r.x + r.w - 1 - (x - r.x);
  return mx === x ? [] : [[mx, y]];
}

// ---------------------------------------------------------------------------------------------
// Images

type RGBA = [number, number, number, number];

function newImage(w = CAPE_W, h = CAPE_H): ImageData {
  const Ctor = (globalThis as { ImageData?: typeof ImageData }).ImageData;
  return Ctor ? new Ctor(w, h) : ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4), colorSpace: 'srgb' } as ImageData);
}

function cloneImage(img: ImageData): ImageData {
  const out = newImage(img.width, img.height);
  out.data.set(img.data);
  return out;
}

function put(img: ImageData, x: number, y: number, c: RGBA): void {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  img.data[i] = c[0];
  img.data[i + 1] = c[1];
  img.data[i + 2] = c[2];
  img.data[i + 3] = c[3];
}

function get(img: ImageData, x: number, y: number): RGBA {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

const hex = (s: string): RGBA => {
  const n = parseInt(s.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
};
const shade = (c: RGBA, k: number): RGBA => [Math.round(Math.min(255, c[0] * k)), Math.round(Math.min(255, c[1] * k)), Math.round(Math.min(255, c[2] * k)), c[3]];
const mix = (a: RGBA, b: RGBA, t: number): RGBA => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t), 255];

/** True when no pixel the game uses has any colour. */
export function isBlankCape(img: ImageData): boolean {
  const m = usedMask();
  for (let i = 0; i < m.length; i++) if (m[i] && img.data[i * 4 + 3] > 0) return false;
  return true;
}

/** Cape pixels (not the elytra's) that are see-through or half see-through: capes are drawn solid in game. */
export function countSeeThrough(img: ImageData): number {
  let n = 0;
  for (const r of CAPE_REGIONS) {
    if (r.part !== 'cape') continue;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (img.data[(y * img.width + x) * 4 + 3] < 255) n++;
  }
  return n;
}

// ---------------------------------------------------------------------------------------------
// Starter designs

export type CapeDesignId = 'plain' | 'split' | 'stripes' | 'chevron' | 'sunset' | 'stars' | 'checker' | 'heart' | 'flame' | 'gem' | 'border' | 'pixels';

/** A face pattern: the colour at (u, v) of a face w x h (u to the right, v down). */
type Pattern = (u: number, v: number, w: number, h: number) => RGBA;

interface CapeDesign {
  id: CapeDesignId;
  /** Main colour of the edges and the inside */
  base: RGBA;
  outside: Pattern;
}

/** Deterministic "random" per pixel (same design every time). */
function noise(u: number, v: number, seed: number): number {
  let n = (u * 374761393 + v * 668265263 + seed * 2147483647) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
const GEM = ['..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'];

function stamp(shape: string[], u: number, v: number, w: number, h: number, top: number): boolean {
  const sw = shape[0].length;
  const x0 = Math.floor((w - sw) / 2);
  const y0 = Math.round(h * top);
  const sx = u - x0;
  const sy = v - y0;
  return sy >= 0 && sy < shape.length && sx >= 0 && sx < sw && shape[sy][sx] === '#';
}

const DESIGNS: readonly CapeDesign[] = [
  { id: 'plain', base: hex('#b3262d'), outside: (_u, v) => (v === 0 ? hex('#8f1d23') : hex('#c4303a')) },
  {
    id: 'split',
    base: hex('#22303f'),
    outside: (_u, v, _w, h) => (v < h / 2 ? hex('#2f6fd1') : hex('#f2f2f2')),
  },
  {
    id: 'stripes',
    base: hex('#1f2a44'),
    outside: (u) => [hex('#1f3b7a'), hex('#f1c232'), hex('#1f3b7a'), hex('#e8eef7'), hex('#1f3b7a')][Math.floor(u / 2) % 5],
  },
  {
    id: 'chevron',
    base: hex('#2d2d2d'),
    outside: (u, v, w) => {
      const d = Math.abs(u - (w - 1) / 2);
      const k = (v - d + 40) % 6;
      return k < 2 ? hex('#f5b800') : hex('#303030');
    },
  },
  {
    id: 'sunset',
    base: hex('#3b1a4a'),
    outside: (_u, v, _w, h) => {
      const t = v / Math.max(1, h - 1);
      return t < 0.5 ? mix(hex('#ffd166'), hex('#ef476f'), t * 2) : mix(hex('#ef476f'), hex('#3b1a4a'), (t - 0.5) * 2);
    },
  },
  {
    id: 'stars',
    base: hex('#0d1b3d'),
    outside: (u, v, w, h) => {
      const sky = mix(hex('#0d1b3d'), hex('#23306b'), v / Math.max(1, h - 1));
      const r = noise(u, v, 7);
      if (r > 0.93) return hex('#fff6c9');
      if (r > 0.88) return mix(sky, hex('#9fb6ff'), 0.6);
      // a small crescent near the top
      const cx = w * 0.7;
      const cy = h * 0.2;
      const inMoon = Math.hypot(u - cx, v - cy) < 2.1 && Math.hypot(u - cx - 1, v - cy + 0.5) >= 1.8;
      return inMoon ? hex('#ffe38a') : sky;
    },
  },
  {
    id: 'checker',
    base: hex('#1b5e20'),
    outside: (u, v) => ((Math.floor(u / 2) + Math.floor(v / 2)) % 2 ? hex('#2e7d32') : hex('#a5d6a7')),
  },
  {
    id: 'heart',
    base: hex('#5c1a46'),
    outside: (u, v, w, h) => (stamp(HEART, u, v, w, h, 0.28) ? hex('#ff4f7b') : v % 4 === 0 && u % 4 === 1 ? hex('#7d2a60') : hex('#8e2f6e')),
  },
  {
    id: 'flame',
    base: hex('#1c1c1c'),
    outside: (u, v, _w, h) => {
      // Flames rise from the bottom edge, taller in a few columns.
      const height = h * (0.35 + 0.3 * noise(u, 0, 3) + 0.15 * Math.sin(u * 1.7));
      const fromBottom = h - 1 - v;
      if (fromBottom < height * 0.45) return hex('#ffd23f');
      if (fromBottom < height * 0.75) return hex('#ff8c1a');
      if (fromBottom < height) return hex('#d7263d');
      return noise(u, v, 11) > 0.9 ? hex('#2b2b2b') : hex('#1c1c1c');
    },
  },
  {
    id: 'gem',
    base: hex('#0f3d3e'),
    outside: (u, v, w, h) => (stamp(GEM, u, v, w, h, 0.3) ? (u < w / 2 ? hex('#7ff0e0') : hex('#2ec4b6')) : (u + v) % 7 === 0 ? hex('#16595a') : hex('#124b4c')),
  },
  {
    id: 'border',
    base: hex('#3e2723'),
    outside: (u, v, w, h) => {
      const edge = Math.min(u, v, w - 1 - u, h - 1 - v);
      if (edge === 0) return hex('#d4a017');
      if (edge === 1) return hex('#5d4037');
      return (u + v) % 2 ? hex('#6d4c41') : hex('#795548');
    },
  },
  {
    id: 'pixels',
    base: hex('#263238'),
    outside: (u, v) => {
      const colours = ['#26a69a', '#5c6bc0', '#ef5350', '#ffca28', '#ab47bc', '#42a5f5'];
      return hex(colours[Math.floor(noise(Math.floor(u / 2), Math.floor(v / 2), 5) * colours.length) % colours.length]);
    },
  },
];

export const CAPE_DESIGNS: readonly CapeDesignId[] = DESIGNS.map((d) => d.id);

function fillRegion(img: ImageData, r: CapeRegion, c: (u: number, v: number) => RGBA): void {
  for (let v = 0; v < r.h; v++) for (let u = 0; u < r.w; u++) put(img, r.x + u, r.y + v, c(u, v));
}

/** A new cape with a starter design on the cape and the same design on the elytra. */
export function createCapeDesign(id: CapeDesignId): ImageData {
  const d = DESIGNS.find((x) => x.id === id) ?? DESIGNS[0];
  const img = newImage();
  const out = regionOf('capeOutside');
  fillRegion(img, out, (u, v) => d.outside(u, v, out.w, out.h));
  // Inside: the base colour, a little darker towards the bottom so it reads as cloth.
  fillRegion(img, regionOf('capeInside'), (_u, v) => shade(d.base, 0.95 - v * 0.012));
  for (const id of ['capeTop', 'capeBottom', 'capeLeft', 'capeRight'] as const) fillRegion(img, regionOf(id), () => shade(d.base, 0.8));
  return copyCapeToElytra(img);
}

/** The cape's design stretched onto the elytra (10x16 faces onto 10x20 wings), edges in the edge colour. */
export function copyCapeToElytra(src: ImageData): ImageData {
  const img = cloneImage(src);
  const out = regionOf('capeOutside');
  const inside = regionOf('capeInside');
  const map = (from: CapeRegion, to: CapeRegion) =>
    fillRegion(img, to, (u, v) => get(src, from.x + Math.min(from.w - 1, Math.floor((u * from.w) / to.w)), from.y + Math.min(from.h - 1, Math.floor((v * from.h) / to.h))));
  // The big wing face seen from behind the flying player gets the outside design.
  map(out, regionOf('wingOutside'));
  map(inside, regionOf('wingInside'));
  const edge = get(src, regionOf('capeLeft').x, regionOf('capeLeft').y + 8);
  for (const id of ['wingTop', 'wingBottom', 'wingEdgeInner', 'wingEdgeOuter'] as const) fillRegion(img, regionOf(id), () => edge);
  return img;
}

// ---------------------------------------------------------------------------------------------
// Opening cape files

export class CapeFileError extends Error {
  constructor(
    message: string,
    readonly code: 'size' | 'empty',
  ) {
    super(message);
  }
}

/**
 * A cape file as a 64x32 cape. Accepts the 64x32 layout and its HD multiples (128x64, 256x128…,
 * reduced to 64x32 by taking every n-th pixel), OptiFine's 46x22 (and multiples) and the old
 * 22x17 cape-only files (both placed in the top-left corner, which is where those layouts put the
 * same faces). Returns what was done as a code for the caller's message.
 */
export function normalizeCapeImage(img: ImageData): { image: ImageData; change: 'none' | 'reduced' | 'placed' } {
  const { width: w, height: h } = img;
  const scaleOf = (bw: number, bh: number) => (w % bw === 0 && h % bh === 0 && w / bw === h / bh ? w / bw : 0);
  let k = scaleOf(64, 32);
  if (k === 1) return { image: cloneImage(img), change: 'none' };
  let change: 'reduced' | 'placed' = 'reduced';
  let cw = 64;
  let ch = 32;
  if (!k) {
    k = scaleOf(46, 22) || scaleOf(22, 17);
    if (!k) throw new CapeFileError(`${w}x${h}`, 'size');
    cw = w / k;
    ch = h / k;
    change = 'placed';
  }
  const out = newImage();
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) put(out, x, y, get(img, x * k, y * k));
  return { image: out, change };
}

// ---------------------------------------------------------------------------------------------
// Elytra texture packs (no mods): the elytra's own texture, worn by players without a cape

/** Java versions that have the elytra (1.9 and newer). */
export const FIRST_ELYTRA_VERSION = '1.9';
export const JAVA_ELYTRA_PATH = 'assets/minecraft/textures/entity/equipment/wings/elytra.png';
export const JAVA_LEGACY_ELYTRA_PATH = 'assets/minecraft/textures/entity/elytra.png';
export const BEDROCK_ELYTRA_PATH = 'textures/models/armor/elytra.png';
