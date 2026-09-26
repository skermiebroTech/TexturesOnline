// Pure pixel algorithms on straight (non-premultiplied) RGBA buffers.
// No DOM access at import time, so everything here runs under Node for tests.

export type RGBA = [number, number, number, number];
export type Point = [number, number];
export interface Rect { x: number; y: number; w: number; h: number }
/** Structural image type: ImageData satisfies it, and so do plain objects under Node. */
export interface PixelBuffer { readonly width: number; readonly height: number; readonly data: Uint8ClampedArray }
export type BrushShape = 'square' | 'round';
/** Which channels painting reads and writes: all, colour only (alpha kept), or alpha only (colour kept). */
export type ChannelMode = 'rgba' | 'rgb' | 'alpha';
export type Plot = (x: number, y: number) => void;

// ---------------------------------------------------------------------------
// Image containers

/** Creates an ImageData (or a structurally identical object when ImageData is unavailable, e.g. Node). */
export function createImage(width: number, height: number, data?: Uint8ClampedArray<ArrayBuffer>): ImageData {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError(`Invalid image size ${width}x${height}`);
  }
  const buf = data ?? new Uint8ClampedArray(width * height * 4);
  if (buf.length !== width * height * 4) throw new RangeError('Pixel data length does not match image size');
  if (typeof ImageData === 'function') return new ImageData(buf, width, height);
  return { width, height, data: buf, colorSpace: 'srgb' } as ImageData;
}

export function cloneImage(img: PixelBuffer): ImageData {
  return createImage(img.width, img.height, new Uint8ClampedArray(img.data));
}

export function clampByte(v: number): number {
  return v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Positive modulo, for wrapping coordinates on tiled textures. */
export function mod(v: number, m: number): number {
  const r = v % m;
  return r < 0 ? r + m : r;
}

export function getPixel(img: PixelBuffer, x: number, y: number): RGBA {
  const i = (y * img.width + x) * 4;
  const d = img.data;
  return [d[i], d[i + 1], d[i + 2], d[i + 3]];
}

export function setPixel(img: PixelBuffer, x: number, y: number, c: ArrayLike<number>): void {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  const d = img.data;
  d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3];
}

// ---------------------------------------------------------------------------
// Colour helpers

/** Rec. 601 luma of an sRGB colour, 0..255. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Distance between the pixel at byte offset `i` of `d` and colour `t`, as the largest channel difference (0..255).
 * Fully transparent pixels all look the same, so their hidden RGB is ignored in 'rgba' mode.
 */
export function pixelDistance(d: ArrayLike<number>, i: number, t: ArrayLike<number>, channels: ChannelMode = 'rgba'): number {
  const pa = d[i + 3];
  const ta = t[3];
  if (channels === 'alpha') return Math.abs(pa - ta);
  const dr = Math.abs(d[i] - t[0]);
  const dg = Math.abs(d[i + 1] - t[1]);
  const db = Math.abs(d[i + 2] - t[2]);
  const rgb = dr > dg ? (dr > db ? dr : db) : dg > db ? dg : db;
  if (channels === 'rgb') return rgb;
  if (pa === 0 && ta === 0) return 0;
  const da = Math.abs(pa - ta);
  if (pa === 0 || ta === 0) return da;
  return rgb > da ? rgb : da;
}

/**
 * Writes colour `c` into the pixel at byte offset `i`, restricted to `channels`.
 * In 'alpha' mode the colour's grey level (scaled by its own alpha) becomes the pixel's alpha.
 * Returns true when anything changed.
 */
export function writePixel(d: Uint8ClampedArray, i: number, c: ArrayLike<number>, channels: ChannelMode = 'rgba'): boolean {
  if (channels === 'alpha') {
    const a = clampByte((luma(c[0], c[1], c[2]) * c[3]) / 255);
    if (d[i + 3] === a) return false;
    d[i + 3] = a;
    return true;
  }
  let changed = d[i] !== c[0] || d[i + 1] !== c[1] || d[i + 2] !== c[2];
  d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
  if (channels === 'rgba') {
    if (d[i + 3] !== c[3]) changed = true;
    d[i + 3] = c[3];
  }
  return changed;
}

/** The colour the picker reports for a pixel in the given channel mode. */
export function pickColor(img: PixelBuffer, x: number, y: number, channels: ChannelMode = 'rgba'): RGBA {
  const [r, g, b, a] = getPixel(img, x, y);
  if (channels === 'rgb') return [r, g, b, 255];
  if (channels === 'alpha') return [a, a, a, 255];
  return [r, g, b, a];
}

export function rgbaToHex(c: ArrayLike<number>, withAlpha = c[3] !== 255): string {
  const hx = (v: number) => clampByte(v).toString(16).padStart(2, '0');
  return `#${hx(c[0])}${hx(c[1])}${hx(c[2])}${withAlpha ? hx(c[3]) : ''}`;
}

/** Parses #rgb, #rgba, #rrggbb or #rrggbbaa (leading # optional). */
export function hexToRgba(hex: string): RGBA | null {
  let h = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-f]+$/i.test(h)) return null;
  if (h.length === 3 || h.length === 4) h = h.split('').map((ch) => ch + ch).join('');
  if (h.length !== 6 && h.length !== 8) return null;
  const n = (k: number) => parseInt(h.slice(k, k + 2), 16);
  return [n(0), n(2), n(4), h.length === 8 ? n(6) : 255];
}

export function sameColor(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

// ---------------------------------------------------------------------------
// Shading and noise

/** Lightens (amount > 0) or darkens (amount < 0) one channel value; amount is clamped to -1..1. */
export function shadeChannel(c: number, amount: number): number {
  const a = clamp(amount, -1, 1);
  return clampByte(a >= 0 ? c + (255 - c) * a : c * (1 + a));
}

/** Returns the colour lightened/darkened by `amount` (-1..1); alpha is unchanged. */
export function shadeColor(c: ArrayLike<number>, amount: number): RGBA {
  return [shadeChannel(c[0], amount), shadeChannel(c[1], amount), shadeChannel(c[2], amount), c[3]];
}

/** Shades a pixel in place according to the channel mode. Returns true when it changed. */
export function shadePixel(d: Uint8ClampedArray, i: number, amount: number, channels: ChannelMode = 'rgba'): boolean {
  if (channels === 'alpha') {
    const a = shadeChannel(d[i + 3], amount);
    if (a === d[i + 3]) return false;
    d[i + 3] = a;
    return true;
  }
  // Invisible pixels carry hidden colour data (e.g. Bedrock tint masks); leave them alone in 'rgba' mode.
  if (channels === 'rgba' && d[i + 3] === 0) return false;
  const r = shadeChannel(d[i], amount);
  const g = shadeChannel(d[i + 1], amount);
  const b = shadeChannel(d[i + 2], amount);
  if (r === d[i] && g === d[i + 1] && b === d[i + 2]) return false;
  d[i] = r; d[i + 1] = g; d[i + 2] = b;
  return true;
}

/** The colour with a random brightness change in [-strength, strength]. */
export function noiseColor(c: ArrayLike<number>, strength: number, rand: () => number = Math.random): RGBA {
  return shadeColor(c, (rand() * 2 - 1) * clamp(strength, 0, 1));
}

/** Small, fast seeded PRNG (mulberry32); returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Flood fill

export interface FillOptions {
  /** Max channel difference still considered the same colour, 0..255 (default 0). */
  tolerance?: number;
  /** false = replace every matching pixel in the image (global fill). Default true. */
  contiguous?: boolean;
  /** Non-zero = editable. Non-editable pixels are never included and block contiguous fills. */
  mask?: Uint8Array | null;
  /** Restrict to this rectangle (e.g. the selection). */
  bounds?: Rect | null;
  /** Also connect through diagonal neighbours. Default false. */
  diagonal?: boolean;
  channels?: ChannelMode;
}

/**
 * Computes the region a fill starting at (x, y) would cover.
 * Returns a w*h array with 1 for included pixels, or null when the start is outside/locked.
 */
export function floodRegion(img: PixelBuffer, x: number, y: number, opts: FillOptions = {}): Uint8Array | null {
  const { width: w, height: h, data } = img;
  x = Math.floor(x);
  y = Math.floor(y);
  const b = opts.bounds ? intersectRect(opts.bounds, { x: 0, y: 0, w, h }) : { x: 0, y: 0, w, h };
  if (!b || !rectContains(b, x, y)) return null;
  const mask = opts.mask ?? null;
  const start = y * w + x;
  if (mask && !mask[start]) return null;
  const tol = clamp(opts.tolerance ?? 0, 0, 255);
  const ch = opts.channels ?? 'rgba';
  const target = [data[start * 4], data[start * 4 + 1], data[start * 4 + 2], data[start * 4 + 3]];
  const region = new Uint8Array(w * h);
  const bx1 = b.x + b.w;
  const by1 = b.y + b.h;
  const accepts = (p: number) => (!mask || mask[p] !== 0) && pixelDistance(data, p * 4, target, ch) <= tol;

  if (opts.contiguous === false) {
    for (let yy = b.y; yy < by1; yy++) {
      for (let xx = b.x; xx < bx1; xx++) {
        const p = yy * w + xx;
        if (accepts(p)) region[p] = 1;
      }
    }
    return region;
  }

  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  stack[sp++] = start;
  seen[start] = 1;
  const diagonal = !!opts.diagonal;
  const push = (q: number) => {
    if (!seen[q]) {
      seen[q] = 1;
      stack[sp++] = q;
    }
  };
  while (sp > 0) {
    const p = stack[--sp];
    if (!accepts(p)) continue;
    region[p] = 1;
    const px = p % w;
    const py = (p - px) / w;
    const left = px > b.x;
    const right = px < bx1 - 1;
    const up = py > b.y;
    const down = py < by1 - 1;
    if (left) push(p - 1);
    if (right) push(p + 1);
    if (up) push(p - w);
    if (down) push(p + w);
    if (diagonal) {
      if (left && up) push(p - w - 1);
      if (right && up) push(p - w + 1);
      if (left && down) push(p + w - 1);
      if (right && down) push(p + w + 1);
    }
  }
  return region;
}

/** Writes `color` into every pixel of `region`. Returns the bounding box of pixels that changed. */
export function fillRegion(img: PixelBuffer, region: Uint8Array, color: ArrayLike<number>, channels: ChannelMode = 'rgba'): Rect | null {
  const { width: w, height: h, data } = img;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let p = 0, n = w * h; p < n; p++) {
    if (!region[p]) continue;
    if (writePixel(data, p * 4, color, channels)) {
      const x = p % w;
      const y = (p - x) / w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Flood fill in place. Returns the changed bounding box, or null if nothing changed. */
export function floodFill(img: PixelBuffer, x: number, y: number, color: ArrayLike<number>, opts: FillOptions = {}): Rect | null {
  const region = floodRegion(img, x, y, opts);
  return region ? fillRegion(img, region, color, opts.channels ?? 'rgba') : null;
}

// ---------------------------------------------------------------------------
// Lines and shapes

/** Bresenham line; calls plot for every pixel from (x0,y0) to (x1,y1) inclusive. */
export function forEachLinePoint(x0: number, y0: number, x1: number, y1: number, plot: Plot): void {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    plot(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export function linePoints(x0: number, y0: number, x1: number, y1: number): Point[] {
  const out: Point[] = [];
  forEachLinePoint(x0, y0, x1, y1, (x, y) => out.push([x, y]));
  return out;
}

// Pixel-art friendly directions: 0°, ~26.6° (2:1), 45°, ~63.4° (1:2), 90° and their mirrors.
const SNAP_DIRS: Point[] = [[1, 0], [2, 1], [1, 1], [1, 2], [0, 1]];

/** Snaps a line end so the line runs horizontal, vertical, diagonal or at clean 2:1 / 1:2 steps. */
export function snapLineEnd(x0: number, y0: number, x1: number, y1: number): Point {
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (dx === 0 && dy === 0) return [x1, y1];
  const len = Math.hypot(dx, dy);
  let best: Point = [x1, y1];
  let bestCos = -2;
  for (const [a, b] of SNAP_DIRS) {
    for (const sx of [1, -1]) {
      for (const sy of [1, -1]) {
        const ux = a * sx;
        const uy = b * sy;
        const ul = Math.hypot(ux, uy);
        const cos = (dx * ux + dy * uy) / (len * ul);
        if (cos > bestCos + 1e-9) {
          bestCos = cos;
          const k = Math.max(0, Math.round((dx * ux + dy * uy) / (ul * ul)));
          best = [x0 + k * ux, y0 + k * uy];
        }
      }
    }
  }
  return best;
}

/** Moves (x1,y1) so the box from (x0,y0) is square (for shift-constrained rectangles and circles). */
export function constrainSquare(x0: number, y0: number, x1: number, y1: number): Point {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const s = Math.max(Math.abs(dx), Math.abs(dy));
  return [x0 + (dx < 0 ? -s : s), y0 + (dy < 0 ? -s : s)];
}

/** Rectangle between two inclusive corners; outline pixels are visited once each. */
export function forEachRectPoint(x0: number, y0: number, x1: number, y1: number, filled: boolean, plot: Plot): void {
  const ax = Math.min(x0, x1), bx = Math.max(x0, x1);
  const ay = Math.min(y0, y1), by = Math.max(y0, y1);
  if (filled) {
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) plot(x, y);
    return;
  }
  for (let x = ax; x <= bx; x++) plot(x, ay);
  if (by !== ay) for (let x = ax; x <= bx; x++) plot(x, by);
  for (let y = ay + 1; y < by; y++) {
    plot(ax, y);
    if (bx !== ax) plot(bx, y);
  }
}

export function rectPoints(x0: number, y0: number, x1: number, y1: number, filled = false): Point[] {
  const out: Point[] = [];
  forEachRectPoint(x0, y0, x1, y1, filled, (x, y) => out.push([x, y]));
  return out;
}

/**
 * Ellipse inscribed in the box with inclusive corners (x0,y0)-(x1,y1), using the integer midpoint
 * algorithm generalised to any box size (even or odd), so results are exactly symmetric.
 * Outline pixels are visited once; filled ellipses are drawn as horizontal spans.
 */
export function forEachEllipsePoint(x0: number, y0: number, x1: number, y1: number, filled: boolean, plot: Plot): void {
  const left = Math.min(x0, x1), right = Math.max(x0, x1);
  const top = Math.min(y0, y1), bottom = Math.max(y0, y1);
  if (right - left < 2 || bottom - top < 2) {
    // Too small to have a curved outline: it is a (filled) rectangle.
    forEachRectPoint(left, top, right, bottom, true, plot);
    return;
  }
  const rows = bottom - top + 1;
  const minX = new Int32Array(rows).fill(0x7fffffff);
  const maxX = new Int32Array(rows).fill(-0x7fffffff);
  const W = right - left + 3;
  const outline = filled ? null : new Set<number>();
  const put = (x: number, y: number) => {
    if (y < top || y > bottom) return;
    const r = y - top;
    if (x < minX[r]) minX[r] = x;
    if (x > maxX[r]) maxX[r] = x;
    outline?.add(r * W + (x - left + 1));
  };
  // Midpoint ellipse in a rectangle (A. Zingl, "A Rasterizing Algorithm for Drawing Curves").
  let xa = left, xb = right;
  let a = right - left;
  const b = bottom - top;
  let b1 = b & 1;
  let dx = 4 * (1 - a) * b * b;
  let dy = 4 * (b1 + 1) * a * a;
  let err = dx + dy + b1 * a * a;
  let e2: number;
  let ya = top + ((b + 1) >> 1);
  let yb = ya - b1;
  a = 8 * a * a;
  b1 = 8 * b * b;
  do {
    put(xb, ya);
    put(xa, ya);
    put(xa, yb);
    put(xb, yb);
    e2 = 2 * err;
    if (e2 <= dy) { ya++; yb--; err += dy += a; }
    if (e2 >= dx || 2 * err > dy) { xa++; xb--; err += dx += b1; }
  } while (xa <= xb);
  while (ya - yb <= b) {
    put(xa - 1, ya);
    put(xb + 1, ya++);
    put(xa - 1, yb);
    put(xb + 1, yb--);
  }
  if (filled) {
    for (let r = 0; r < rows; r++) {
      if (maxX[r] < minX[r]) continue;
      for (let x = minX[r]; x <= maxX[r]; x++) plot(x, top + r);
    }
    return;
  }
  for (const key of outline!) {
    const r = Math.floor(key / W);
    plot(left - 1 + (key - r * W), top + r);
  }
}

export function ellipsePoints(x0: number, y0: number, x1: number, y1: number, filled = false): Point[] {
  const out: Point[] = [];
  forEachEllipsePoint(x0, y0, x1, y1, filled, (x, y) => out.push([x, y]));
  return out;
}

// ---------------------------------------------------------------------------
// Brushes and mirroring

const brushCache = new Map<string, Point[]>();

/**
 * Pixel offsets covered by a brush, relative to the top-left of its size x size box.
 * Round brushes: 1 = dot, 2 = 2x2, 3 = plus, 4+ = pixel circles.
 */
export function brushOffsets(size: number, shape: BrushShape = 'square'): Point[] {
  const n = Math.max(1, Math.round(size));
  const key = `${shape}:${n}`;
  const cached = brushCache.get(key);
  if (cached) return cached;
  const out: Point[] = [];
  if (shape === 'square' || n <= 2) {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out.push([x, y]);
  } else {
    const c = n / 2;
    const limit = c * c - (n <= 3 ? 0.5 : 0);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const dx = x + 0.5 - c;
        const dy = y + 0.5 - c;
        if (dx * dx + dy * dy <= limit) out.push([x, y]);
      }
    }
  }
  brushCache.set(key, out);
  return out;
}

/**
 * Top-left of the brush box for a pointer at fractional pixel coords (fx, fy): odd sizes centre on the
 * pixel under the pointer, even sizes centre on the nearest pixel corner.
 */
export function brushOrigin(fx: number, fy: number, size: number): Point {
  const n = Math.max(1, Math.round(size));
  return [Math.floor(fx - n / 2 + 0.5), Math.floor(fy - n / 2 + 0.5)];
}

/** Top-left of the brush box centred on integer pixel (px, py). */
export function brushOriginAt(px: number, py: number, size: number): Point {
  const k = (Math.max(1, Math.round(size)) - 1) >> 1;
  return [px - k, py - k];
}

/** Stamps the brush at every Bresenham step between two brush origins. */
export function stampLine(o0: Point, o1: Point, size: number, shape: BrushShape, plot: Plot, skipFirst = false): void {
  const offs = brushOffsets(size, shape);
  let first = true;
  forEachLinePoint(o0[0], o0[1], o1[0], o1[1], (x, y) => {
    if (first) {
      first = false;
      if (skipFirst) return;
    }
    for (let k = 0; k < offs.length; k++) plot(x + offs[k][0], y + offs[k][1]);
  });
}

/** Unique pixels covered by stamping the brush along a list of origins. */
export function stampPoints(origins: Point[], size: number, shape: BrushShape = 'square'): Point[] {
  const offs = brushOffsets(size, shape);
  const seen = new Set<string>();
  const out: Point[] = [];
  for (const [ox, oy] of origins) {
    for (const [dx, dy] of offs) {
      const k = `${ox + dx},${oy + dy}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push([ox + dx, oy + dy]);
      }
    }
  }
  return out;
}

/** The pixel plus its mirror images across the vertical (mx) and/or horizontal (my) centre lines. Unique. */
export function mirrorPoints(x: number, y: number, width: number, height: number, mx: boolean, my: boolean): Point[] {
  const out: Point[] = [[x, y]];
  const X = width - 1 - x;
  const Y = height - 1 - y;
  if (mx && X !== x) out.push([X, y]);
  if (my && Y !== y) out.push([x, Y]);
  if (mx && my && X !== x && Y !== y) out.push([X, Y]);
  return out;
}

// ---------------------------------------------------------------------------
// Rectangles

/** Rect from two inclusive pixel corners in any order. */
export function normalizeRect(x0: number, y0: number, x1: number, y1: number): Rect {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  return { x, y, w: Math.abs(x1 - x0) + 1, h: Math.abs(y1 - y0) + 1 };
}

export function intersectRect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  return x2 > x && y2 > y ? { x, y, w: x2 - x, h: y2 - y } : null;
}

export function clampRect(r: Rect, width: number, height: number): Rect | null {
  return intersectRect(r, { x: 0, y: 0, w: width, h: height });
}

export function unionRect(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b ? { ...b } : null;
  if (!b) return { ...a };
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

export function rectContains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}

export function rectsEqual(a: Rect | null | undefined, b: Rect | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

// ---------------------------------------------------------------------------
// Region copy / diff (used by undo history)

function u32(a: Uint8ClampedArray): Uint32Array | null {
  return a.byteOffset % 4 === 0 && a.length % 4 === 0 ? new Uint32Array(a.buffer, a.byteOffset, a.length / 4) : null;
}

/** Bounding box of pixels that differ between two same-sized RGBA buffers (optionally only inside `within`). */
export function diffBounds(a: Uint8ClampedArray, b: Uint8ClampedArray, width: number, height: number, within?: Rect | null): Rect | null {
  const r = within ? clampRect(within, width, height) : { x: 0, y: 0, w: width, h: height };
  if (!r) return null;
  const A = u32(a);
  const B = u32(b);
  const differs = A && B
    ? (p: number) => A[p] !== B[p]
    : (p: number) => { const i = p * 4; return a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]; };
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  const xEnd = r.x + r.w;
  for (let y = r.y, yEnd = r.y + r.h; y < yEnd; y++) {
    const row = y * width;
    let first = -1;
    for (let x = r.x; x < xEnd; x++) {
      if (differs(row + x)) { first = x; break; }
    }
    if (first < 0) continue;
    let last = first;
    for (let x = xEnd - 1; x > first; x--) {
      if (differs(row + x)) { last = x; break; }
    }
    if (first < minX) minX = first;
    if (last > maxX) maxX = last;
    if (y < minY) minY = y;
    maxY = y;
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Copies a rectangle (must lie inside the image) out of an RGBA buffer. */
export function copyRegion(data: Uint8ClampedArray, width: number, r: Rect): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(r.w * r.h * 4);
  const rowBytes = r.w * 4;
  for (let y = 0; y < r.h; y++) {
    const s = ((r.y + y) * width + r.x) * 4;
    out.set(data.subarray(s, s + rowBytes), y * rowBytes);
  }
  return out;
}

/** Writes a buffer produced by copyRegion back into an RGBA buffer. */
export function writeRegion(data: Uint8ClampedArray, width: number, r: Rect, src: Uint8ClampedArray): void {
  const rowBytes = r.w * 4;
  for (let y = 0; y < r.h; y++) {
    data.set(src.subarray(y * rowBytes, (y + 1) * rowBytes), ((r.y + y) * width + r.x) * 4);
  }
}

// ---------------------------------------------------------------------------
// Selection operations

/** Copies `r` out of the image into a new image; pixels outside the image or locked by `mask` become transparent. */
export function extractRect(img: PixelBuffer, r: Rect, mask?: Uint8Array | null): ImageData {
  const out = createImage(Math.max(1, r.w), Math.max(1, r.h));
  const clipped = clampRect(r, img.width, img.height);
  if (!clipped) return out;
  const s = img.data;
  const d = out.data;
  for (let y = clipped.y; y < clipped.y + clipped.h; y++) {
    for (let x = clipped.x; x < clipped.x + clipped.w; x++) {
      const p = y * img.width + x;
      if (mask && !mask[p]) continue;
      const si = p * 4;
      const di = ((y - r.y) * out.width + (x - r.x)) * 4;
      d[di] = s[si]; d[di + 1] = s[si + 1]; d[di + 2] = s[si + 2]; d[di + 3] = s[si + 3];
    }
  }
  return out;
}

/** Clears the editable pixels of `r` (restricted to `channels`). Returns the changed bounding box. */
export function clearPixels(img: PixelBuffer, r: Rect, mask?: Uint8Array | null, channels: ChannelMode = 'rgba'): Rect | null {
  const c = clampRect(r, img.width, img.height);
  if (!c) return null;
  const region = new Uint8Array(img.width * img.height);
  for (let y = c.y; y < c.y + c.h; y++) {
    for (let x = c.x; x < c.x + c.w; x++) {
      const p = y * img.width + x;
      if (!mask || mask[p]) region[p] = 1;
    }
  }
  return fillRegion(img, region, [0, 0, 0, 0], channels);
}

export interface PasteOptions {
  /** 1 = editable destination pixel. */
  mask?: Uint8Array | null;
  /**
   * Fully transparent source pixels do not cover visible destination pixels (moving selections).
   * Over empty (0,0,0,0) destination pixels they are still copied, so colour hidden under alpha 0
   * (Bedrock tint masks) survives a move.
   */
  skipTransparent?: boolean;
  /** Only write inside this destination rectangle. */
  clip?: Rect | null;
  channels?: ChannelMode;
}

/** Copies `src` into `dst` with its top-left at (dx, dy). Returns the destination bounding box written. */
export function pasteImage(dst: PixelBuffer, src: PixelBuffer, dx: number, dy: number, opts: PasteOptions = {}): Rect | null {
  let area = clampRect({ x: dx, y: dy, w: src.width, h: src.height }, dst.width, dst.height);
  if (area && opts.clip) area = intersectRect(area, opts.clip);
  if (!area) return null;
  const { mask, skipTransparent } = opts;
  const channels = opts.channels ?? 'rgba';
  const s = src.data;
  const d = dst.data;
  for (let y = area.y; y < area.y + area.h; y++) {
    for (let x = area.x; x < area.x + area.w; x++) {
      const p = y * dst.width + x;
      if (mask && !mask[p]) continue;
      const si = ((y - dy) * src.width + (x - dx)) * 4;
      const di = p * 4;
      if (skipTransparent && s[si + 3] === 0 && (d[di + 3] !== 0 || d[di] !== 0 || d[di + 1] !== 0 || d[di + 2] !== 0)) continue;
      if (channels === 'alpha') { d[di + 3] = s[si + 3]; continue; }
      d[di] = s[si]; d[di + 1] = s[si + 1]; d[di + 2] = s[si + 2];
      if (channels === 'rgba') d[di + 3] = s[si + 3];
    }
  }
  return area;
}

// ---------------------------------------------------------------------------
// Flip / rotate / scale

/** Mirrors the image (or a rectangle of it) left-right, in place. */
export function flipHorizontal(img: PixelBuffer, r?: Rect | null): void {
  const c = r ? clampRect(r, img.width, img.height) : { x: 0, y: 0, w: img.width, h: img.height };
  if (!c) return;
  const A = u32(img.data);
  const d = img.data;
  for (let y = c.y; y < c.y + c.h; y++) {
    let l = y * img.width + c.x;
    let rr = l + c.w - 1;
    while (l < rr) {
      if (A) {
        const t = A[l]; A[l] = A[rr]; A[rr] = t;
      } else {
        for (let k = 0; k < 4; k++) { const t = d[l * 4 + k]; d[l * 4 + k] = d[rr * 4 + k]; d[rr * 4 + k] = t; }
      }
      l++; rr--;
    }
  }
}

/** Mirrors the image (or a rectangle of it) top-bottom, in place. */
export function flipVertical(img: PixelBuffer, r?: Rect | null): void {
  const c = r ? clampRect(r, img.width, img.height) : { x: 0, y: 0, w: img.width, h: img.height };
  if (!c) return;
  const d = img.data;
  const rowBytes = c.w * 4;
  const tmp = new Uint8ClampedArray(rowBytes);
  for (let t = c.y, b = c.y + c.h - 1; t < b; t++, b--) {
    const ti = (t * img.width + c.x) * 4;
    const bi = (b * img.width + c.x) * 4;
    tmp.set(d.subarray(ti, ti + rowBytes));
    d.copyWithin(ti, bi, bi + rowBytes);
    d.set(tmp, bi);
  }
}

/** Returns a new image rotated by 90 degrees (clockwise by default); width and height swap. */
export function rotate90(img: PixelBuffer, clockwise = true): ImageData {
  const { width: w, height: h } = img;
  const out = createImage(h, w);
  const S = u32(img.data);
  const D = u32(out.data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = clockwise ? h - 1 - y : y;
      const ny = clockwise ? x : w - 1 - x;
      const sp = y * w + x;
      const dp = ny * h + nx;
      if (S && D) D[dp] = S[sp];
      else for (let k = 0; k < 4; k++) out.data[dp * 4 + k] = img.data[sp * 4 + k];
    }
  }
  return out;
}

/** Nearest-neighbour resample. */
export function scaleNearest(img: PixelBuffer, width: number, height: number): ImageData {
  const out = createImage(width, height);
  const S = u32(img.data);
  const D = u32(out.data);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(img.height - 1, Math.floor(((y + 0.5) * img.height) / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(img.width - 1, Math.floor(((x + 0.5) * img.width) / width));
      const sp = sy * img.width + sx;
      const dp = y * width + x;
      if (S && D) D[dp] = S[sp];
      else for (let k = 0; k < 4; k++) out.data[dp * 4 + k] = img.data[sp * 4 + k];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Outline of a pixel set (for brush footprint previews)

/**
 * Edges between pixels in the set and pixels outside it, as flat [x0, y0, x1, y1, ...] segments in pixel units.
 * Collinear neighbouring edges are merged.
 */
export function outlineSegments(pixels: Iterable<Point>): number[] {
  const set = new Set<string>();
  const list: Point[] = [];
  for (const p of pixels) {
    const k = `${p[0]},${p[1]}`;
    if (!set.has(k)) { set.add(k); list.push(p); }
  }
  const has = (x: number, y: number) => set.has(`${x},${y}`);
  // Collect unit edges keyed by line, then merge runs.
  const horiz = new Map<number, number[]>(); // y (edge line) -> x starts
  const vert = new Map<number, number[]>();  // x (edge line) -> y starts
  const add = (m: Map<number, number[]>, k: number, v: number) => {
    const arr = m.get(k);
    if (arr) arr.push(v); else m.set(k, [v]);
  };
  for (const [x, y] of list) {
    if (!has(x, y - 1)) add(horiz, y * 2, x);       // top edge (even key)
    if (!has(x, y + 1)) add(horiz, (y + 1) * 2 + 1, x); // bottom edge (odd key keeps sides separate)
    if (!has(x - 1, y)) add(vert, x * 2, y);
    if (!has(x + 1, y)) add(vert, (x + 1) * 2 + 1, y);
  }
  const out: number[] = [];
  const merge = (m: Map<number, number[]>, horizontal: boolean) => {
    for (const [key, starts] of m) {
      const line = key >> 1;
      starts.sort((a, b) => a - b);
      let s = starts[0];
      let e = s + 1;
      for (let i = 1; i <= starts.length; i++) {
        if (i < starts.length && starts[i] === e) { e++; continue; }
        if (horizontal) out.push(s, line, e, line);
        else out.push(line, s, line, e);
        if (i < starts.length) { s = starts[i]; e = s + 1; }
      }
    }
  };
  merge(horiz, true);
  merge(vert, false);
  return out;
}
