// Original procedural 16x16 pixel textures used by the previews when no game assets are loaded.
// Pure logic: no DOM access, runs in workers and under Node.

export interface RGBAImage {
  width: number;
  height: number;
  /** Straight (non-premultiplied) RGBA, row-major, top row first */
  data: Uint8ClampedArray;
}

export type ProceduralTextureName =
  | 'grass_top' | 'grass_side' | 'dirt' | 'stone' | 'cobblestone' | 'gravel' | 'sand' | 'water'
  | 'oak_log' | 'oak_log_top' | 'oak_leaves' | 'short_grass' | 'poppy' | 'dandelion' | 'cornflower'
  | 'torch' | 'oak_planks';

export const PROCEDURAL_TEXTURE_NAMES: readonly ProceduralTextureName[] = [
  'grass_top', 'grass_side', 'dirt', 'stone', 'cobblestone', 'gravel', 'sand', 'water', 'oak_log', 'oak_log_top',
  'oak_leaves', 'short_grass', 'poppy', 'dandelion', 'cornflower', 'torch', 'oak_planks',
];

/** Number of animation frames in the procedural water strip (16 x 16*N). */
export const WATER_FRAMES = 16;

const S = 16;
type RGB = [number, number, number];

function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Tileable smooth value noise with the given integer period (cells across 16px). */
function valueNoise(x: number, y: number, cells: number, seed: number): number {
  const fx = (x / S) * cells;
  const fy = (y / S) * cells;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const w = (v: number) => ((v % cells) + cells) % cells;
  const a = hash2(w(x0), w(y0), seed);
  const b = hash2(w(x0 + 1), w(y0), seed);
  const c = hash2(w(x0), w(y0 + 1), seed);
  const d = hash2(w(x0 + 1), w(y0 + 1), seed);
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}

class Canvas16 {
  readonly data: Uint8ClampedArray;
  constructor(readonly width = S, readonly height = S) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }
  set(x: number, y: number, c: RGB, a = 255): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = a;
  }
  get(x: number, y: number): RGB {
    const i = (y * this.width + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2]];
  }
  alpha(x: number, y: number): number {
    return this.data[(y * this.width + x) * 4 + 3];
  }
  image(): RGBAImage {
    return { width: this.width, height: this.height, data: this.data };
  }
}

function pick(pal: RGB[], v: number): RGB {
  const i = Math.max(0, Math.min(pal.length - 1, Math.floor(v * pal.length)));
  return pal[i];
}

function shade(c: RGB, f: number): RGB {
  return [Math.round(c[0] * f), Math.round(c[1] * f), Math.round(c[2] * f)];
}

const GRASS = ['#3f7a2a', '#4b8a2f', '#579a34', '#63a73a', '#72b542', '#82c24d'].map(hex);
const DIRT = ['#5a3b22', '#694528', '#78502f', '#865b36', '#95683f'].map(hex);
const STONE = ['#66666c', '#717177', '#7c7c82', '#87878d', '#929298', '#9d9da3'].map(hex);
const SAND = ['#d3bf88', '#dbc893', '#e2d09c', '#e8d7a5', '#eedfb0'].map(hex);
const BARK = ['#3e2d1a', '#4b3720', '#584127', '#664c2e', '#735735'].map(hex);
const WOOD = ['#9c7646', '#aa8350', '#b8905b', '#c49c66'].map(hex);
const LEAF = ['#2a6420', '#337326', '#3c822c', '#469133', '#52a13b'].map(hex);

function grassTop(seed: number): RGBAImage {
  const c = new Canvas16();
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = valueNoise(x, y, 4, seed) * 0.55 + hash2(x, y, seed + 7) * 0.45;
      c.set(x, y, pick(GRASS, n));
    }
  }
  // a few bright blade tips
  const r = mulberry32(seed + 3);
  for (let i = 0; i < 9; i++) c.set(Math.floor(r() * S), Math.floor(r() * S), GRASS[5]);
  return c.image();
}

function dirtInto(c: Canvas16, seed: number, fromY = 0): void {
  for (let y = fromY; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = valueNoise(x, y, 4, seed) * 0.5 + hash2(x, y, seed + 11) * 0.5;
      c.set(x, y, pick(DIRT, n));
    }
  }
  const r = mulberry32(seed + 5);
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(r() * S);
    const y = fromY + Math.floor(r() * (S - fromY));
    c.set(x, y, hex('#a98a6a'));
    if (r() < 0.5) c.set(x + 1, y, hex('#8e7255'));
  }
  for (let i = 0; i < 5; i++) c.set(Math.floor(r() * S), fromY + Math.floor(r() * (S - fromY)), hex('#44301c'));
}

function dirt(seed: number): RGBAImage {
  const c = new Canvas16();
  dirtInto(c, seed);
  return c.image();
}

function grassSide(seed: number): RGBAImage {
  const c = new Canvas16();
  dirtInto(c, seed);
  const r = mulberry32(seed + 9);
  for (let x = 0; x < S; x++) {
    let depth = 3 + Math.floor(r() * 2);
    if (r() < 0.3) depth += 1 + Math.floor(r() * 2);
    for (let y = 0; y < depth; y++) {
      const n = hash2(x, y, seed + 21);
      const col = y === 0 ? GRASS[4 + (n > 0.5 ? 1 : 0)] : y === depth - 1 ? GRASS[Math.floor(n * 2)] : pick(GRASS.slice(1, 5), n);
      c.set(x, y, col);
    }
  }
  return c.image();
}

function stone(seed: number): RGBAImage {
  const c = new Canvas16();
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = valueNoise(x, y, 4, seed) * 0.45 + valueNoise(x, y, 8, seed + 1) * 0.25 + hash2(x, y, seed + 2) * 0.3;
      c.set(x, y, pick(STONE, n));
    }
  }
  const r = mulberry32(seed + 4);
  for (let i = 0; i < 7; i++) {
    const x = Math.floor(r() * S);
    const y = Math.floor(r() * S);
    const len = 2 + Math.floor(r() * 3);
    const dark = r() < 0.6;
    for (let k = 0; k < len; k++) c.set((x + k) % S, y, dark ? STONE[0] : STONE[5]);
  }
  return c.image();
}

interface Cell { x: number; y: number; shade: number }

function voronoi(c: Canvas16, cells: Cell[], colorFor: (cell: Cell, edge: number, dx: number, dy: number) => RGB): void {
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let d1 = 1e9;
      let d2 = 1e9;
      let best: Cell = cells[0];
      let bdx = 0;
      let bdy = 0;
      for (const p of cells) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const dx = x + 0.5 - (p.x + ox * S);
            const dy = y + 0.5 - (p.y + oy * S);
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < d1) {
              d2 = d1;
              d1 = d;
              best = p;
              bdx = dx;
              bdy = dy;
            } else if (d < d2) d2 = d;
          }
        }
      }
      c.set(x, y, colorFor(best, d2 - d1, bdx, bdy));
    }
  }
}

function cobblestone(seed: number): RGBAImage {
  const c = new Canvas16();
  const r = mulberry32(seed);
  const cells: Cell[] = [];
  for (let i = 0; i < 9; i++) cells.push({ x: r() * S, y: r() * S, shade: r() });
  voronoi(c, cells, (cell, edge, dx, dy) => {
    if (edge < 1.1) return hex('#4a4a50');
    const base = pick(STONE.slice(1), cell.shade);
    const light = -dx - dy > 2.2 ? 1.12 : dx + dy > 2.6 ? 0.86 : 1;
    return shade(base, light);
  });
  return c.image();
}

function gravel(seed: number): RGBAImage {
  const c = new Canvas16();
  const r = mulberry32(seed);
  const cells: Cell[] = [];
  for (let i = 0; i < 22; i++) cells.push({ x: r() * S, y: r() * S, shade: r() });
  const pal = ['#5f5a58', '#6e6866', '#7d7875', '#8b8683', '#9a9491', '#7a6f66'].map(hex);
  voronoi(c, cells, (cell, edge, dx, dy) => {
    if (edge < 0.55) return hex('#4d4845');
    const base = pick(pal, cell.shade);
    return shade(base, -dx - dy > 1.2 ? 1.12 : 1);
  });
  return c.image();
}

function sand(seed: number): RGBAImage {
  const c = new Canvas16();
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = valueNoise(x, y, 8, seed) * 0.35 + hash2(x, y, seed + 3) * 0.65;
      c.set(x, y, pick(SAND, n));
    }
  }
  const r = mulberry32(seed + 1);
  for (let i = 0; i < 5; i++) c.set(Math.floor(r() * S), Math.floor(r() * S), hex('#c2ab74'));
  return c.image();
}

/** Light grey, semi-transparent water strip (tinted at render time), WATER_FRAMES frames stacked vertically. */
function water(seed: number): RGBAImage {
  const c = new Canvas16(S, S * WATER_FRAMES);
  const TAU = Math.PI * 2;
  for (let f = 0; f < WATER_FRAMES; f++) {
    const t = f / WATER_FRAMES;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const w1 = Math.sin(TAU * (x / S + (2 * y) / S + t));
        const w2 = Math.sin(TAU * ((2 * x) / S - y / S - 2 * t) + 1.3);
        const w3 = Math.sin(TAU * ((3 * y) / S + t) + x * 0.4);
        const n = hash2(x, y, seed + f) * 0.18;
        const v = 0.62 + w1 * 0.1 + w2 * 0.08 + w3 * 0.05 + n;
        const g = Math.round(Math.max(0, Math.min(1, v)) * 255);
        const hi = w1 + w2 > 1.45;
        c.set(x, f * S + y, hi ? [236, 236, 236] : [g, g, g], hi ? 210 : 188);
      }
    }
  }
  return c.image();
}

function oakLog(seed: number): RGBAImage {
  const c = new Canvas16();
  const r = mulberry32(seed);
  const colBase: number[] = [];
  for (let x = 0; x < S; x++) colBase.push(r());
  for (let x = 0; x < S; x++) {
    let run = 0;
    let v = colBase[x];
    for (let y = 0; y < S; y++) {
      if (run-- <= 0) {
        run = 2 + Math.floor(r() * 4);
        v = colBase[x] * 0.6 + r() * 0.4;
      }
      c.set(x, y, pick(BARK, v));
    }
  }
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(r() * S);
    const y0 = Math.floor(r() * S);
    const len = 3 + Math.floor(r() * 6);
    for (let k = 0; k < len; k++) c.set(x, (y0 + k) % S, hex('#2f2213'));
  }
  return c.image();
}

function oakLogTop(seed: number): RGBAImage {
  const c = new Canvas16();
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = Math.abs(x - 7.5);
      const dy = Math.abs(y - 7.5);
      const edge = Math.max(dx, dy);
      if (edge > 6.6) {
        c.set(x, y, pick(BARK, hash2(x, y, seed)));
        continue;
      }
      const d = Math.max(dx, dy) * 0.7 + Math.sqrt(dx * dx + dy * dy) * 0.3;
      const ring = Math.floor(d / 1.5);
      const base = ring % 2 === 0 ? WOOD[2] : WOOD[1];
      const n = hash2(x, y, seed + 1);
      c.set(x, y, n > 0.85 ? WOOD[3] : n < 0.12 ? WOOD[0] : base);
    }
  }
  c.set(7, 7, WOOD[0]);
  c.set(8, 8, WOOD[0]);
  return c.image();
}

function oakPlanks(seed: number): RGBAImage {
  const c = new Canvas16();
  const r = mulberry32(seed);
  for (let y = 0; y < S; y++) {
    const board = Math.floor(y / 4);
    const seam = y % 4 === 3;
    const joint = [4, 11, 1, 8][board];
    for (let x = 0; x < S; x++) {
      if (seam) {
        c.set(x, y, hex('#6e5231'));
        continue;
      }
      if (x === joint) {
        c.set(x, y, hex('#7d5e39'));
        continue;
      }
      const n = hash2(x, y, seed) * 0.5 + valueNoise(x, y * 4, 4, seed + board) * 0.5;
      c.set(x, y, pick(WOOD, n * 0.9 + 0.05));
    }
  }
  for (let i = 0; i < 3; i++) c.set(Math.floor(r() * S), Math.floor(r() * 4) * 4 + 1, hex('#8a6a40'));
  return c.image();
}

function leaves(seed: number): RGBAImage {
  const c = new Canvas16();
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const clump = valueNoise(x, y, 8, seed);
      const n = hash2(x, y, seed + 1);
      if ((clump < 0.42 && n < 0.7) || n < 0.08) {
        c.set(x, y, [0, 0, 0], 0);
        continue;
      }
      const v = clump * 0.6 + n * 0.4;
      c.set(x, y, pick(LEAF, v));
    }
  }
  const r = mulberry32(seed + 2);
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(r() * S);
    const y = Math.floor(r() * S);
    if (c.alpha(x, y) > 0) c.set(x, y, hex('#5fb046'));
  }
  return c.image();
}

function shortGrass(seed: number): RGBAImage {
  const c = new Canvas16();
  const r = mulberry32(seed);
  const blades = [1, 3, 4, 6, 8, 9, 11, 12, 14];
  for (const bx of blades) {
    const h = 5 + Math.floor(r() * 9);
    const lean = r() < 0.5 ? -1 : 1;
    const bend = 3 + Math.floor(r() * 4);
    for (let k = 0; k < h; k++) {
      const y = S - 1 - k;
      const x = bx + (k > bend ? lean : 0) + (k > bend + 4 ? lean : 0);
      const tip = k >= h - 2;
      c.set(x, y, tip ? GRASS[5] : k < 3 ? GRASS[1] : GRASS[3]);
    }
  }
  return c.image();
}

function flower(seed: number, petals: RGB[], center: RGB, shape: 'cup' | 'round' | 'star'): RGBAImage {
  const c = new Canvas16();
  const stem = hex('#3f7f2b');
  const stemDark = hex('#2f6621');
  for (let y = 7; y < S; y++) c.set(7, y, y % 3 === 0 ? stemDark : stem);
  c.set(6, 11, stem);
  c.set(5, 10, stem);
  c.set(8, 12, stem);
  c.set(9, 11, stem);
  c.set(10, 10, stemDark);
  const cx = 7;
  const cy = shape === 'cup' ? 5 : 5;
  const r = mulberry32(seed);
  if (shape === 'cup') {
    const rows: [number, number, number][] = [
      [2, 6, 8], [3, 5, 9], [4, 5, 9], [5, 5, 9], [6, 6, 8],
    ];
    for (const [y, x0, x1] of rows) for (let x = x0; x <= x1; x++) c.set(x, y, pick(petals, r()));
    c.set(cx, 4, center);
    c.set(cx, 3, petals[petals.length - 1]);
  } else if (shape === 'round') {
    for (let y = cy - 2; y <= cy + 2; y++) {
      for (let x = cx - 2; x <= cx + 2; x++) {
        if (Math.abs(x - cx) === 2 && Math.abs(y - cy) === 2) continue;
        c.set(x, y, pick(petals, r()));
      }
    }
    c.set(cx, cy, center);
  } else {
    const pts: [number, number][] = [[0, -2], [0, -1], [-2, 0], [-1, 0], [1, 0], [2, 0], [0, 1], [0, 2], [-1, -1], [1, 1], [1, -1], [-1, 1]];
    for (const [dx, dy] of pts) c.set(cx + dx, cy + dy, pick(petals, r()));
    c.set(cx, cy, center);
  }
  return c.image();
}

function torch(): RGBAImage {
  const c = new Canvas16();
  const stick = [hex('#6a4a29'), hex('#86613a')];
  for (let y = 8; y < S; y++) {
    c.set(7, y, stick[1]);
    c.set(8, y, stick[0]);
  }
  c.set(7, 6, hex('#fff7d1'));
  c.set(8, 6, hex('#ffe58a'));
  c.set(7, 7, hex('#ffc54a'));
  c.set(8, 7, hex('#ff9d2e'));
  return c.image();
}

const GENERATORS: Record<ProceduralTextureName, (seed: number) => RGBAImage> = {
  grass_top: grassTop,
  grass_side: grassSide,
  dirt,
  stone,
  cobblestone,
  gravel,
  sand,
  water,
  oak_log: oakLog,
  oak_log_top: oakLogTop,
  oak_planks: oakPlanks,
  oak_leaves: leaves,
  short_grass: shortGrass,
  poppy: (s) => flower(s, ['#c8242c', '#de3a36', '#b01a22'].map(hex), hex('#2a1210'), 'cup'),
  dandelion: (s) => flower(s, ['#f2c928', '#ffe050', '#e2ae1c'].map(hex), hex('#c98a12'), 'round'),
  cornflower: (s) => flower(s, ['#4468d6', '#5f86ef', '#3552b4'].map(hex), hex('#27327a'), 'star'),
  torch: () => torch(),
};

const cache = new Map<string, RGBAImage>();

/**
 * Returns an original procedural texture (16x16; water is a 16x(16*WATER_FRAMES) animation strip).
 * Results are deterministic for a given seed. A fresh copy is returned each call.
 */
export function proceduralTexture(name: ProceduralTextureName, opts: { seed?: number } = {}): RGBAImage {
  const seed = opts.seed ?? 1337;
  const key = `${name}:${seed}`;
  let img = cache.get(key);
  if (!img) {
    const gen = GENERATORS[name];
    if (!gen) throw new Error(`Unknown procedural texture: ${name}`);
    img = gen(seed);
    cache.set(key, img);
  }
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
}

export type ProceduralBlock = 'grass_block' | 'dirt' | 'stone' | 'cobblestone' | 'gravel' | 'sand' | 'oak_log' | 'oak_leaves' | 'oak_planks';
export type CubeFaceName = 'up' | 'down' | 'north' | 'south' | 'east' | 'west';

/** Six face textures for a simple procedural block (e.g. for a hero or placeholder cube preview). */
export function proceduralBlockFaces(block: ProceduralBlock, opts: { seed?: number } = {}): Record<CubeFaceName, RGBAImage> {
  const t = (n: ProceduralTextureName) => proceduralTexture(n, opts);
  switch (block) {
    case 'grass_block': {
      const side = t('grass_side');
      return { up: t('grass_top'), down: t('dirt'), north: side, south: t('grass_side'), east: t('grass_side'), west: t('grass_side') };
    }
    case 'oak_log': {
      return { up: t('oak_log_top'), down: t('oak_log_top'), north: t('oak_log'), south: t('oak_log'), east: t('oak_log'), west: t('oak_log') };
    }
    default: {
      const name = block as ProceduralTextureName;
      return { up: t(name), down: t(name), north: t(name), south: t(name), east: t(name), west: t(name) };
    }
  }
}

/** Converts to a real ImageData in browsers (falls back to a structurally identical object elsewhere). */
export function toImageData(img: RGBAImage): ImageData {
  if (typeof ImageData !== 'undefined') {
    return new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
  }
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data), colorSpace: 'srgb' } as ImageData;
}
