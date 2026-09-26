// Original procedural pixel art for the landing page (no game assets): block textures, the
// animated tool previews and the hero grass block faces.

export type RGB = [number, number, number];

export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp8 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const vary = (c: RGB, k: number): RGB => [clamp8(c[0] * k), clamp8(c[1] * k), clamp8(c[2] * k)];

/** 16x16 RGBA pixel buffer */
export class Tex {
  readonly data: Uint8ClampedArray;
  constructor(
    readonly w = 16,
    readonly h = 16,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }
  set(x: number, y: number, c: RGB, a = 255): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = a;
  }
  get(x: number, y: number): RGB {
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2]];
  }
  toCanvas(canvas?: HTMLCanvasElement): HTMLCanvasElement {
    const c = canvas ?? document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(this.data), this.w, this.h), 0, 0);
    return c;
  }
}

function noiseFill(t: Tex, base: RGB, seed: number, spread = 0.18): void {
  const r = prng(seed);
  for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) t.set(x, y, vary(base, 1 - spread / 2 + r() * spread));
}

export const PALETTE = {
  grass: [96, 190, 64] as RGB,
  grassDark: [72, 158, 48] as RGB,
  dirt: [134, 92, 62] as RGB,
  stone: [128, 130, 134] as RGB,
  plank: [178, 136, 84] as RGB,
  sand: [224, 208, 150] as RGB,
  brick: [160, 74, 58] as RGB,
  leaves: [70, 150, 60] as RGB,
};

export function grassTop(seed = 3): Tex {
  const t = new Tex();
  const r = prng(seed);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const k = 0.82 + r() * 0.3;
      t.set(x, y, vary(r() < 0.12 ? PALETTE.grassDark : PALETTE.grass, k));
    }
  return t;
}

export function dirt(seed = 5): Tex {
  const t = new Tex();
  noiseFill(t, PALETTE.dirt, seed, 0.3);
  const r = prng(seed + 1);
  for (let i = 0; i < 10; i++) t.set((r() * 16) | 0, (r() * 16) | 0, vary(PALETTE.dirt, 0.68));
  for (let i = 0; i < 6; i++) t.set((r() * 16) | 0, (r() * 16) | 0, [150, 140, 128]);
  return t;
}

export function grassSide(seed = 7): Tex {
  const t = dirt(seed);
  const r = prng(seed + 9);
  const g = grassTop(seed + 2);
  for (let x = 0; x < 16; x++) {
    const depth = 3 + (r() < 0.5 ? 1 : 0) + (r() < 0.25 ? 1 : 0);
    for (let y = 0; y < depth; y++) t.set(x, y, g.get(x, y));
    if (r() < 0.3) t.set(x, depth, vary(PALETTE.grassDark, 0.9));
  }
  return t;
}

export function stone(seed = 11): Tex {
  const t = new Tex();
  noiseFill(t, PALETTE.stone, seed, 0.16);
  const r = prng(seed + 3);
  for (let i = 0; i < 7; i++) {
    const x = (r() * 15) | 0;
    const y = (r() * 15) | 0;
    const len = 2 + ((r() * 3) | 0);
    for (let k = 0; k < len; k++) t.set(x + k, y, vary(PALETTE.stone, 0.78));
  }
  return t;
}

export function ore(seed = 13, gem: RGB = [72, 220, 200]): Tex {
  const t = stone(seed);
  const r = prng(seed + 5);
  const spots: [number, number][] = [
    [3, 3],
    [10, 5],
    [5, 10],
    [11, 11],
  ];
  for (const [sx, sy] of spots) {
    const pts: [number, number][] = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ];
    for (const [dx, dy] of pts) if (r() < 0.85) t.set(sx + dx, sy + dy, vary(gem, 0.8 + r() * 0.35));
    t.set(sx + 1, sy, vary(gem, 1.2));
  }
  return t;
}

export function planks(seed = 17): Tex {
  const t = new Tex();
  const r = prng(seed);
  for (let y = 0; y < 16; y++) {
    const board = y >> 2;
    const k = 0.92 + (board % 2) * 0.06;
    for (let x = 0; x < 16; x++) {
      let c = vary(PALETTE.plank, k * (0.93 + r() * 0.12));
      if (y % 4 === 3) c = vary(PALETTE.plank, 0.62);
      const seam = board % 2 === 0 ? 5 : 12;
      if (x === seam && y % 4 !== 3) c = vary(PALETTE.plank, 0.7);
      t.set(x, y, c);
    }
  }
  return t;
}

export function sand(seed = 19): Tex {
  const t = new Tex();
  noiseFill(t, PALETTE.sand, seed, 0.12);
  return t;
}

export function bricks(seed = 23): Tex {
  const t = new Tex();
  const r = prng(seed);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const row = y >> 2;
      const off = row % 2 ? 4 : 0;
      const mortar = y % 4 === 3 || (x + off) % 8 === 7;
      t.set(x, y, mortar ? vary([190, 180, 168], 0.9 + r() * 0.1) : vary(PALETTE.brick, 0.85 + r() * 0.25));
    }
  return t;
}

export function leaves(seed = 29): Tex {
  const t = new Tex();
  const r = prng(seed);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      if (r() < 0.14) t.set(x, y, [26, 52, 24]);
      else t.set(x, y, vary(PALETTE.leaves, 0.72 + r() * 0.45));
    }
  return t;
}

// ---------------------------------------------------------------------------------------------
// Colour effects for the texture showcase

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h /= 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  if (s === 0) return [clamp8(l * 255), clamp8(l * 255), clamp8(l * 255)];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [clamp8(f(h + 1 / 3) * 255), clamp8(f(h) * 255), clamp8(f(h - 1 / 3) * 255)];
}

export type EffectFn = (c: RGB) => RGB;

export const SHOWCASE_EFFECTS: { name: string; fn: EffectFn }[] = [
  { name: 'Original', fn: (c) => c },
  {
    name: 'Pastel Dream',
    fn: ([r, g, b]) => {
      const [h, s, l] = rgbToHsl(r, g, b);
      return hslToRgb(h, Math.min(1, s * 0.7 + 0.15), Math.min(0.92, l * 0.55 + 0.42));
    },
  },
  {
    name: 'Autumn',
    fn: ([r, g, b]) => {
      const [h, s, l] = rgbToHsl(r, g, b);
      const nh = h > 0.15 && h < 0.45 ? h - 0.2 : h;
      return hslToRgb((nh + 1) % 1, Math.min(1, s * 1.15), l * 0.95);
    },
  },
  {
    name: 'Neon',
    fn: ([r, g, b]) => {
      const [h, s, l] = rgbToHsl(r, g, b);
      return hslToRgb((h + 0.55) % 1, Math.min(1, s * 1.6 + 0.35), Math.min(0.75, Math.max(0.12, (l - 0.5) * 1.5 + 0.45)));
    },
  },
  {
    name: 'Noir',
    fn: ([r, g, b]) => {
      const y = 0.3 * r + 0.59 * g + 0.11 * b;
      const v = clamp8((y - 128) * 1.35 + 118);
      return [v, v, clamp8(v * 1.04)];
    },
  },
];

// ---------------------------------------------------------------------------------------------
// Animated previews (canvas based, low frame rate for a pixel feel)

export interface Showcase {
  start(): void;
  stop(): void;
  destroy(): void;
}

function loop(draw: (t: number) => void, fps: number): Showcase {
  let raf = 0;
  let last = 0;
  let running = false;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tick = (now: number) => {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    if (now - last < 1000 / fps) return;
    last = now;
    draw(now / 1000);
  };
  draw(reduce ? 2.2 : 0);
  return {
    start() {
      if (running || reduce) return;
      running = true;
      raf = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}

/** Grid of block textures cycling through one-click effects with a sweeping reveal. */
export function textureShowcase(canvas: HTMLCanvasElement, onEffect?: (name: string) => void): Showcase {
  const cols = 3;
  const rows = 2;
  const gap = 2;
  const W = cols * 16 + (cols + 1) * gap;
  const H = rows * 16 + (rows + 1) * gap;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const tiles = [grassSide(), ore(), planks(), leaves(), bricks(), stone(31)];
  const img = ctx.createImageData(W, H);
  const period = 3.2;
  let lastIdx = -1;

  return loop((t) => {
    const cycle = t / period + 0.5;
    const idx = Math.floor(cycle) % SHOWCASE_EFFECTS.length;
    const prev = (idx - 1 + SHOWCASE_EFFECTS.length) % SHOWCASE_EFFECTS.length;
    const phase = cycle - Math.floor(cycle);
    const sweep = Math.min(1, phase / 0.35) * (W + 4) - 2;
    if (idx !== lastIdx) {
      lastIdx = idx;
      onEffect?.(SHOWCASE_EFFECTS[idx].name);
    }
    img.data.fill(0);
    tiles.forEach((tex, i) => {
      const ox = gap + (i % cols) * (16 + gap);
      const oy = gap + Math.floor(i / cols) * (16 + gap);
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const px = ox + x;
          const fx = px < sweep ? SHOWCASE_EFFECTS[idx].fn : SHOWCASE_EFFECTS[prev].fn;
          const c = fx(tex.get(x, y));
          const o = ((oy + y) * W + px) * 4;
          img.data[o] = c[0];
          img.data[o + 1] = c[1];
          img.data[o + 2] = c[2];
          img.data[o + 3] = 255;
        }
    });
    // sweep line highlight
    if (phase < 0.36) {
      const sx = Math.round(sweep);
      for (let y = 0; y < H; y++)
        for (const dx of [0, 1]) {
          const x = sx + dx;
          if (x < 0 || x >= W) continue;
          const o = (y * W + x) * 4;
          img.data[o] = 255;
          img.data[o + 1] = 255;
          img.data[o + 2] = 255;
          img.data[o + 3] = dx === 0 ? 220 : 90;
        }
    }
    ctx.putImageData(img, 0, 0);
  }, 24);
}

/** A little original character getting a new outfit painted pixel by pixel. */
export function skinShowcase(canvas: HTMLCanvasElement): Showcase {
  const W = 32;
  const H = 36;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const skin: RGB = [198, 140, 104];
  const hair: RGB = [236, 150, 64];
  const pants: RGB = [76, 80, 92];
  const shoes: RGB = [238, 238, 242];
  const outfits: RGB[] = [
    [176, 124, 255],
    [255, 91, 120],
    [91, 211, 91],
    [255, 190, 60],
    [79, 179, 255],
  ];
  const ox = 8;
  const oy = 2;
  // regions of the figure (front view, 16 x 32)
  const shirtCells: [number, number][] = [];
  for (let y = 8; y < 20; y++) {
    for (let x = 4; x < 12; x++) shirtCells.push([x, y]);
    if (y < 13) {
      for (let x = 0; x < 4; x++) shirtCells.push([x, y]);
      for (let x = 12; x < 16; x++) shirtCells.push([x, y]);
    }
  }
  shirtCells.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const r = prng(41);
  const shade = shirtCells.map(() => 0.9 + r() * 0.16);

  const put = (x: number, y: number, c: RGB, a = 255) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 4;
    img.data[o] = c[0];
    img.data[o + 1] = c[1];
    img.data[o + 2] = c[2];
    img.data[o + 3] = a;
  };

  const perCell = 0.035;
  const pause = 1.2;
  const cycleLen = shirtCells.length * perCell + pause;

  return loop((t) => {
    const cycle = Math.floor(t / cycleLen);
    const within = t - cycle * cycleLen;
    const painted = Math.min(shirtCells.length, Math.floor(within / perCell));
    const from = outfits[cycle % outfits.length];
    const to = outfits[(cycle + 1) % outfits.length];
    const bob = Math.round(Math.sin(t * 2.4) * 0.6);
    img.data.fill(0);
    const P = (x: number, y: number, c: RGB) => put(ox + x, oy + y + bob, c);
    // head
    for (let y = 0; y < 8; y++) for (let x = 4; x < 12; x++) P(x, y, y < 2 || (y < 4 && (x === 4 || x === 11)) ? hair : vary(skin, y > 5 ? 0.96 : 1));
    P(5, 4, [255, 255, 255]);
    P(6, 4, [40, 60, 120]);
    P(9, 4, [40, 60, 120]);
    P(10, 4, [255, 255, 255]);
    P(7, 6, vary(skin, 0.8));
    P(8, 6, vary(skin, 0.8));
    // arms skin below the sleeves
    for (let y = 13; y < 20; y++) {
      for (let x = 0; x < 4; x++) P(x, y, vary(skin, x === 0 ? 0.9 : 1));
      for (let x = 12; x < 16; x++) P(x, y, vary(skin, x === 15 ? 0.9 : 1));
    }
    // shirt
    shirtCells.forEach(([x, y], i) => P(x, y, vary(i < painted ? to : from, shade[i] * (x < 4 || x > 11 ? 0.9 : 1))));
    // legs
    for (let y = 20; y < 32; y++)
      for (let x = 4; x < 12; x++) P(x, y, y >= 29 ? shoes : vary(pants, x === 7 || x === 8 ? 0.85 : 1));
    // brush cursor
    if (painted < shirtCells.length) {
      const [cx, cy] = shirtCells[painted];
      const bx = ox + cx + 1;
      const by = oy + cy + bob - 1;
      put(bx, by, [255, 255, 255]);
      put(bx + 1, by - 1, [255, 255, 255]);
      put(bx + 2, by - 2, [255, 207, 74]);
      put(bx + 3, by - 3, [255, 207, 74]);
      put(bx + 4, by - 4, [120, 90, 60]);
      put(bx - 1, by + 1, to);
    }
    ctx.putImageData(img, 0, 0);
  }, 30);
}

/** Tiny landscape going through a day/night cycle, with water, clouds and a tree. */
export function shaderShowcase(canvas: HTMLCanvasElement): Showcase {
  const W = 96;
  const H = 54;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const r = prng(77);
  // blocky terrain height map (2px steps)
  const heights: number[] = [];
  let hgt = 34;
  for (let x = 0; x < W; x += 2) {
    hgt += Math.round((r() - 0.5) * 3);
    hgt = Math.max(28, Math.min(40, hgt));
    heights.push(hgt, hgt);
  }
  const waterLevel = 41;
  for (let x = 54; x < 80; x++) heights[x] = Math.max(heights[x], 43 + Math.round(Math.sin((x - 54) / 4) * 1.2));
  const stars = Array.from({ length: 26 }, () => [Math.floor(r() * W), Math.floor(r() * 26), r()] as const);
  const clouds = Array.from({ length: 4 }, (_, i) => ({ x: r() * W, y: 6 + i * 4 + Math.floor(r() * 3), w: 10 + Math.floor(r() * 10) }));
  const grassNoise = Array.from({ length: W * H }, () => 0.9 + r() * 0.2);

  const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const keys: { t: number; top: RGB; hor: RGB; light: RGB; amb: number }[] = [
    { t: 0.0, top: [10, 14, 38], hor: [30, 36, 78], light: [120, 140, 220], amb: 0.32 },
    { t: 0.22, top: [44, 52, 120], hor: [255, 140, 90], light: [255, 170, 120], amb: 0.62 },
    { t: 0.32, top: [72, 150, 245], hor: [170, 215, 255], light: [255, 250, 235], amb: 1.0 },
    { t: 0.68, top: [72, 150, 245], hor: [170, 215, 255], light: [255, 250, 235], amb: 1.0 },
    { t: 0.8, top: [70, 50, 130], hor: [255, 120, 110], light: [255, 150, 110], amb: 0.62 },
    { t: 0.92, top: [10, 14, 38], hor: [30, 36, 78], light: [120, 140, 220], amb: 0.32 },
    { t: 1.0, top: [10, 14, 38], hor: [30, 36, 78], light: [120, 140, 220], amb: 0.32 },
  ];
  const sample = (tt: number) => {
    let i = 0;
    while (i < keys.length - 2 && keys[i + 1].t <= tt) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const k = (tt - a.t) / (b.t - a.t || 1);
    return { top: mix(a.top, b.top, k), hor: mix(a.hor, b.hor, k), light: mix(a.light, b.light, k), amb: a.amb + (b.amb - a.amb) * k };
  };

  const put = (x: number, y: number, c: RGB) => {
    const o = (y * W + x) * 4;
    img.data[o] = clamp8(c[0]);
    img.data[o + 1] = clamp8(c[1]);
    img.data[o + 2] = clamp8(c[2]);
    img.data[o + 3] = 255;
  };
  const lit = (c: RGB, env: ReturnType<typeof sample>, k = 1): RGB => [
    (c[0] * env.light[0] * env.amb * k) / 255,
    (c[1] * env.light[1] * env.amb * k) / 255,
    (c[2] * env.light[2] * env.amb * k) / 255,
  ];

  return loop((t) => {
    const day = ((t / 14) % 1 + 0.35) % 1;
    const env = sample(day);
    // sky
    for (let y = 0; y < H; y++) {
      const c = mix(env.top, env.hor, Math.min(1, y / 40));
      for (let x = 0; x < W; x++) put(x, y, c);
    }
    // stars
    const night = Math.max(0, 1 - env.amb * 1.6);
    for (const [sx, sy, tw] of stars) {
      const a = night * (0.6 + 0.4 * Math.sin(t * 3 + tw * 10));
      if (a > 0.05) put(sx, sy, mix(env.top, [255, 255, 255], a));
    }
    // sun & moon on arcs across the sky
    const drawDisc = (x0: number, y0: number, c: RGB, size: number) => {
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const px = Math.round(x0 + x - size / 2);
          const py = Math.round(y0 + y - size / 2);
          if (px >= 0 && py >= 0 && px < W && py < H) put(px, py, c);
        }
    };
    const sunT = (day - 0.18) / 0.66;
    if (sunT > 0 && sunT < 1) {
      const a = sunT * Math.PI;
      drawDisc(W / 2 - Math.cos(a) * 42, 40 - Math.sin(a) * 32, [255, 236, 150], 6);
    }
    const moonT = (((day + 1 - 0.78) % 1) / 0.5);
    if (moonT > 0 && moonT < 1) {
      const a = moonT * Math.PI;
      drawDisc(W / 2 - Math.cos(a) * 40, 40 - Math.sin(a) * 30, [225, 230, 250], 4);
    }
    // clouds
    for (const cl of clouds) {
      const x0 = Math.round((cl.x + t * 3) % (W + cl.w)) - cl.w;
      const cc = mix([255, 255, 255], env.hor, 0.35);
      const lc = lit(cc, env, 1.05);
      for (let x = 0; x < cl.w; x++) {
        if (x0 + x < 0 || x0 + x >= W) continue;
        put(x0 + x, cl.y, lc);
        if (x > 2 && x < cl.w - 3) put(x0 + x, cl.y - 1, lc);
      }
    }
    // terrain
    for (let x = 0; x < W; x++) {
      const top = heights[x];
      for (let y = top; y < H; y++) {
        const n = grassNoise[y * W + x];
        const depth = y - top;
        const base: RGB = depth < 2 ? [98, 180, 70] : depth < 6 ? [128, 90, 60] : [118, 118, 122];
        put(x, y, lit(vary(base, n), env, depth < 2 ? 1.05 : 0.9));
      }
    }
    // water with sky reflection + shimmer
    for (let x = 52; x < 82; x++) {
      for (let y = waterLevel; y < heights[x]; y++) {
        const refl = mix(env.hor, [40, 110, 200], 0.55);
        const shimmer = Math.sin(x * 0.9 + t * 4 + y * 1.7) > 0.93 ? 1.4 : 1;
        put(x, y, lit(vary(refl, shimmer), env, 1.1));
      }
    }
    // tree
    const tx = 22;
    const ty = heights[tx];
    for (let y = ty - 7; y < ty; y++) put(tx, y, lit([110, 80, 52], env));
    for (let y = ty - 13; y < ty - 6; y++)
      for (let x = tx - 3; x <= tx + 3; x++) {
        if ((y === ty - 13 || y === ty - 7) && (x === tx - 3 || x === tx + 3)) continue;
        put(x, y, lit(vary([70, 150, 60], grassNoise[y * W + x]), env));
      }
    ctx.putImageData(img, 0, 0);
  }, 20);
}

/** Canvas faces for the hero cube: [top, side, bottom] */
export function heroBlockFaces(): { top: HTMLCanvasElement; side: HTMLCanvasElement; bottom: HTMLCanvasElement } {
  return { top: grassTop(3).toCanvas(), side: grassSide(7).toCanvas(), bottom: dirt(5).toCanvas() };
}
