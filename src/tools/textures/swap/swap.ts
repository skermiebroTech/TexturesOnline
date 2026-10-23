// Colour swap: replaces a colour (and colours close to it, within a tolerance) with another,
// keeping each pixel's small difference from the colour so shading inside the range survives.
// Optionally the colour's whole shade ramp goes along: its darker and lighter shades in the texture
// (same hue family, like the palette groups them) move by the same hue, saturation and brightness
// change, so the ramp's own hue shift is kept. No DOM.

import { createImageData } from '../../../core/pixels';

export type RGBA = [number, number, number, number];

/** One colour of the swap: pixels near `from` become `to` (plus their difference from `from`). */
export interface SwapPair {
  from: RGBA;
  to: RGBA;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The biggest tolerance offered (channel difference) */
export const TOLERANCE_MAX = 100;

/** How far apart two colours are: the largest difference of red, green and blue. */
export function colorDistance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

/** Whether a pixel is in a colour's range (see-through pixels never are). */
export function inRange(px: ArrayLike<number>, color: ArrayLike<number>, tolerance: number): boolean {
  return px[3] > 0 && colorDistance(px, color) <= tolerance;
}

/** The pair a pixel belongs to (the closest `from` within the tolerance), or -1. */
export function pairOf(px: ArrayLike<number>, pairs: readonly SwapPair[], tolerance: number): number {
  if (!px[3]) return -1;
  let best = -1;
  let bestD = tolerance + 1;
  for (let i = 0; i < pairs.length; i++) {
    const d = colorDistance(px, pairs[i].from);
    if (d < bestD) {
      best = i;
      bestD = d;
      if (!d) break;
    }
  }
  return best;
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

/** What a pixel of a pair becomes: the new colour plus its own difference from the old one. */
export function swapped(px: ArrayLike<number>, p: SwapPair): RGBA {
  const a = p.to[3] === 0 ? 0 : clamp((px[3] * p.to[3]) / Math.max(1, p.from[3]));
  return [clamp(p.to[0] + px[0] - p.from[0]), clamp(p.to[1] + px[1] - p.from[1]), clamp(p.to[2] + px[2] - p.from[2]), a];
}

/**
 * Swaps the pairs' colours in an image (in `rect` only, when given; `mask`: editable pixels). Returns
 * a new image and how many pixels changed.
 */
export function swapImage(img: ImageData, pairs: readonly SwapPair[], tolerance: number, opts: { rect?: Rect | null; mask?: Uint8Array | null } = {}): { image: ImageData; changed: number } {
  const out = createImageData(img.width, img.height, new Uint8ClampedArray(img.data));
  if (!pairs.length) return { image: out, changed: 0 };
  const W = img.width;
  const r = opts.rect ?? { x: 0, y: 0, w: W, h: img.height };
  const x0 = Math.max(0, r.x);
  const y0 = Math.max(0, r.y);
  const x1 = Math.min(W, r.x + r.w);
  const y1 = Math.min(img.height, r.y + r.h);
  const d = out.data;
  let changed = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const p = y * W + x;
      if (opts.mask && !opts.mask[p]) continue;
      const i = p * 4;
      const px = d.subarray(i, i + 4);
      const k = pairOf(px, pairs, tolerance);
      if (k < 0) continue;
      const n = swapped(px, pairs[k]);
      if (n[0] === px[0] && n[1] === px[1] && n[2] === px[2] && n[3] === px[3]) continue;
      d[i] = n[0];
      d[i + 1] = n[1];
      d[i + 2] = n[2];
      d[i + 3] = n[3];
      changed++;
    }
  }
  return { image: out, changed };
}

/** How many pixels of an image the swap would change. */
export function countSwapped(img: ImageData, pairs: readonly SwapPair[], tolerance: number, rect?: Rect | null): number {
  if (!pairs.length) return 0;
  const W = img.width;
  const r = rect ?? { x: 0, y: 0, w: W, h: img.height };
  let n = 0;
  const d = img.data;
  for (let y = Math.max(0, r.y); y < Math.min(img.height, r.y + r.h); y++) {
    for (let x = Math.max(0, r.x); x < Math.min(W, r.x + r.w); x++) {
      const i = (y * W + x) * 4;
      if (pairOf(d.subarray(i, i + 4), pairs, tolerance) >= 0) n++;
    }
  }
  return n;
}

// ---------------------------------------------------------------------------------------------
// Shade ramps

export function toHsv(c: ArrayLike<number>): [number, number, number] {
  const r = c[0] / 255;
  const g = c[1] / 255;
  const b = c[2] / 255;
  const mx = Math.max(r, g, b);
  const d = mx - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, mx ? d / mx : 0, mx];
}

export function fromHsv(h: number, s: number, v: number, a = 255): RGBA {
  h = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [clamp((r + m) * 255), clamp((g + m) * 255), clamp((b + m) * 255), a];
}

/** Below this saturation a colour counts as grey (as the palette sorts them) */
const GREY = 0.14;
/**
 * How far a shade's hue may lean from the colour's: shade ramps shift hue as they get darker or
 * lighter, so the further a shade's brightness is from the colour's, the more it may lean.
 */
const rampHue = (dv: number) => Math.min(60, 20 + 60 * Math.abs(dv));

const hueGap = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

/**
 * The colour's shade ramp among a palette: the colour and the palette's darker and lighter colours
 * of its family (greys with greys; else hues close to its own, see rampHue, and a similar saturation),
 * darkest first. Always holds the colour itself.
 */
export function shadeRamp(color: RGBA, palette: readonly RGBA[]): RGBA[] {
  const [h, s, v] = toHsv(color);
  const grey = s < GREY;
  const out: RGBA[] = [];
  const seen = new Set<string>();
  const add = (c: RGBA) => {
    const k = c.join(',');
    if (seen.has(k)) return;
    seen.add(k);
    out.push(c);
  };
  add([...color]);
  for (const c of palette) {
    if (!c[3]) continue;
    const [ch, cs, cv] = toHsv(c);
    if (grey ? cs >= GREY : cs < GREY || hueGap(ch, h) > rampHue(cv - v) || Math.abs(cs - s) > 0.4) continue;
    add([...c]);
  }
  return out.sort((a, b) => toHsv(a)[2] - toHsv(b)[2] || a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
}

/**
 * The pairs that move a whole ramp from `from` to `to`: `from` becomes `to` exactly; every other
 * shade turns by the same hue change, scales its saturation and brightness by the same amounts
 * (shifts them, from a grey or black), so the ramp keeps its spacing and its own hue shift.
 */
export function rampPairs(ramp: readonly RGBA[], from: RGBA, to: RGBA): SwapPair[] {
  const [fh, fs, fv] = toHsv(from);
  const [th, ts, tv] = toHsv(to);
  const greyFrom = fs < GREY;
  return ramp.map((c) => {
    if (c[0] === from[0] && c[1] === from[1] && c[2] === from[2]) return { from: [...c], to: [to[0], to[1], to[2], to[3] === 0 ? 0 : c[3]] };
    const [h, s, v] = toHsv(c);
    // a grey ramp takes the new colour's hue; a colourful one turns by the same amount
    const nh = greyFrom ? th : h + (th - fh);
    const ns = greyFrom ? Math.min(1, Math.max(0, ts + (s - fs))) : Math.min(1, s * (fs > 0 ? ts / fs : 1));
    const nv = fv > 0.02 ? Math.min(1, v * (tv / fv)) : Math.min(1, Math.max(0, tv + (v - fv)));
    return { from: [...c], to: fromHsv(nh, ns, nv, to[3] === 0 ? 0 : c[3]) };
  });
}
