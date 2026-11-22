/*
 * Pixel helpers without the PNG / TGA codecs: ImageData creation, resizing, cropping, canvas
 * display and skin layout fixes. Pixels are straight RGBA. image.ts re-exports all of this next to
 * the codecs; screens that only draw pixels import this module, so the codecs load only when a
 * file is actually read or written.
 */

import { errorText } from '../shared/i18n/errors';
import { fmt } from '../i18n/editor-text';

type Pixels = Uint8ClampedArray<ArrayBuffer>;

class ImageDataShim {
  readonly width: number;
  readonly height: number;
  readonly data: Pixels;
  readonly colorSpace: PredefinedColorSpace = 'srgb';
  constructor(a: Pixels | number, b: number, c?: number) {
    if (typeof a === 'number') {
      this.width = a;
      this.height = b;
      this.data = new Uint8ClampedArray(a * b * 4);
    } else {
      this.width = b;
      this.height = c ?? a.length / 4 / b;
      if (a.length !== this.width * this.height * 4) throw new RangeError('Pixel data length does not match width x height.');
      this.data = a;
    }
  }
}

// Node and some worker contexts lack ImageData; a structural stand-in keeps pure code testable.
const g = globalThis as { ImageData?: unknown };
if (typeof g.ImageData === 'undefined') g.ImageData = ImageDataShim;

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  for (let i = 0; i < 8; i++) if (bytes[i] !== PNG_SIG[i]) return false;
  return true;
}

export function createImageData(w: number, h: number, data?: Uint8ClampedArray): ImageData {
  w = Math.max(1, Math.floor(w));
  h = Math.max(1, Math.floor(h));
  let px: Pixels;
  if (data) {
    if (data.length !== w * h * 4) throw new RangeError(`Expected ${w * h * 4} bytes of pixel data, got ${data.length}.`);
    px = data.buffer instanceof ArrayBuffer ? (data as Pixels) : new Uint8ClampedArray(data);
  } else px = new Uint8ClampedArray(w * h * 4);
  const Ctor = (globalThis as { ImageData: typeof ImageData }).ImageData;
  return new Ctor(px, w, h);
}

export function cloneImageData(img: ImageData): ImageData {
  return createImageData(img.width, img.height, new Uint8ClampedArray(img.data));
}

// ---- Geometry ----

/** Source rectangle of a resize: the whole image, or the part that 'cover' keeps. */
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Nearest-neighbour resize of a rectangle of the image (a copy when the size stays). */
function nearestRect(img: ImageData, r: Rect, w: number, h: number): ImageData {
  const out = createImageData(w, h);
  const data = img.data.byteOffset % 4 === 0 ? img.data : new Uint8ClampedArray(img.data);
  const src = new Uint32Array(data.buffer, data.byteOffset, img.width * img.height);
  const dst = new Uint32Array(out.data.buffer);
  const xs = new Uint32Array(w);
  for (let x = 0; x < w; x++) xs[x] = r.x + Math.min(r.w - 1, Math.floor(((x + 0.5) * r.w) / w));
  for (let y = 0; y < h; y++) {
    const sy = r.y + Math.min(r.h - 1, Math.floor(((y + 0.5) * r.h) / h));
    const sRow = sy * img.width;
    const dRow = y * w;
    for (let x = 0; x < w; x++) dst[dRow + x] = src[sRow + xs[x]];
  }
  return out;
}

export function resizeNearest(img: ImageData, w: number, h: number): ImageData {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  if (w === img.width && h === img.height) return cloneImageData(img);
  return nearestRect(img, { x: 0, y: 0, w: img.width, h: img.height }, w, h);
}

/**
 * The taps of a one-axis resample from `sLen` to `dLen` samples: box filter when shrinking, linear
 * when growing. Output d reads taps[start[d] .. start[d + 1]) with their weights; total[d] is their sum.
 */
function axisTaps(sLen: number, dLen: number): { start: Uint32Array; taps: Uint32Array; weights: Float64Array; total: Float64Array } {
  const scale = sLen / dLen;
  const start = new Uint32Array(dLen + 1);
  const taps: number[] = [];
  const weights: number[] = [];
  const total = new Float64Array(dLen);
  for (let d = 0; d < dLen; d++) {
    start[d] = taps.length;
    if (scale > 1) {
      const s0 = d * scale;
      const end = s0 + scale;
      for (let s = Math.floor(s0); s < Math.ceil(end); s++) {
        const wgt = Math.min(end, s + 1) - Math.max(s0, s);
        if (wgt > 0) {
          taps.push(Math.min(sLen - 1, s));
          weights.push(wgt);
        }
      }
    } else {
      const c = (d + 0.5) * scale - 0.5;
      const s0 = Math.floor(c);
      const f = c - s0;
      taps.push(Math.max(0, Math.min(sLen - 1, s0)), Math.max(0, Math.min(sLen - 1, s0 + 1)));
      weights.push(1 - f, f);
    }
    let t = 0;
    for (let k = start[d]; k < taps.length; k++) t += weights[k];
    total[d] = t;
  }
  start[dLen] = taps.length;
  return { start, taps: Uint32Array.from(taps), weights: Float64Array.from(weights), total };
}

/**
 * Every colour value premultiplied by every alpha, as 32-bit floats: c × (a / 255) at a × 257 + c,
 * and a / 255 itself at a × 257 + 256.
 */
let premultipliedLut: Float32Array | null = null;
function premultiplied(): Float32Array {
  if (!premultipliedLut) {
    const t = new Float32Array(256 * 257);
    for (let a = 0; a < 256; a++) {
      const al = a / 255;
      for (let c = 0; c < 256; c++) t[a * 257 + c] = c * al;
      t[a * 257 + 256] = al;
    }
    premultipliedLut = t;
  }
  return premultipliedLut;
}

/**
 * Smooth resize of a rectangle of the image, in premultiplied alpha: a horizontal pass straight from
 * the pixels (premultiplied as they are read: no float copy of the whole picture), then a vertical
 * pass row by row. Every value is rounded to 32-bit floats where a premultiplied float copy of the
 * picture would hold it, so the result is the same to the bit.
 */
function smoothRect(img: ImageData, r: Rect, w: number, h: number): ImageData {
  const d = img.data;
  const stride = img.width;
  const fround = Math.fround;
  // horizontal: r.w × r.h → w × r.h
  const { start, taps, weights, total } = axisTaps(r.w, w);
  const pm = premultiplied();
  const hPass = new Float32Array(w * r.h * 4);
  for (let line = 0; line < r.h; line++) {
    const row = (r.y + line) * stride + r.x;
    const outRow = line * w;
    for (let x = 0; x < w; x++) {
      let rr = 0, gg = 0, b = 0, a = 0;
      for (let k = start[x], e = start[x + 1]; k < e; k++) {
        const si = (row + taps[k]) * 4;
        const wgt = weights[k];
        const p = d[si + 3] * 257;
        rr += pm[p + d[si]] * wgt;
        gg += pm[p + d[si + 1]] * wgt;
        b += pm[p + d[si + 2]] * wgt;
        a += pm[p + 256] * wgt;
      }
      const wt = total[x];
      const di = (outRow + x) * 4;
      hPass[di] = rr / wt;
      hPass[di + 1] = gg / wt;
      hPass[di + 2] = b / wt;
      hPass[di + 3] = a / wt;
    }
  }
  // vertical: w × r.h → w × h, a whole output row at a time (the taps' rows are read in order)
  const vy = axisTaps(r.h, h);
  const out = createImageData(w, h);
  const od = out.data;
  const acc = new Float64Array(w * 4);
  const n = w * 4;
  for (let y = 0; y < h; y++) {
    acc.fill(0);
    for (let k = vy.start[y], e = vy.start[y + 1]; k < e; k++) {
      const so = vy.taps[k] * n;
      const wgt = vy.weights[k];
      for (let i = 0; i < n; i++) acc[i] += hPass[so + i] * wgt;
    }
    const wt = vy.total[y];
    const o0 = y * n;
    for (let i = 0; i < n; i += 4) {
      const a = fround(acc[i + 3] / wt);
      if (a > 0) {
        od[o0 + i] = fround(acc[i] / wt) / a;
        od[o0 + i + 1] = fround(acc[i + 1] / wt) / a;
        od[o0 + i + 2] = fround(acc[i + 2] / wt) / a;
        od[o0 + i + 3] = a * 255;
      }
    }
  }
  return out;
}

export function resizeSmooth(img: ImageData, w: number, h: number): ImageData {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  if (w === img.width && h === img.height) return cloneImageData(img);
  return smoothRect(img, { x: 0, y: 0, w: img.width, h: img.height }, w, h);
}

/**
 * Scales img to exactly w x h. 'contain' keeps the aspect ratio and centres the image on a
 * transparent canvas, 'cover' crops to fill, 'stretch' ignores the aspect ratio.
 */
export function fitToSize(img: ImageData, w: number, h: number, mode: 'nearest' | 'smooth', fit: 'contain' | 'cover' | 'stretch' = 'contain'): ImageData {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  const resize = mode === 'nearest' ? resizeNearest : resizeSmooth;
  if (fit === 'stretch' || img.width * h === img.height * w) return resize(img, w, h);
  if (fit === 'cover') {
    const s = Math.max(w / img.width, h / img.height);
    const cw = Math.min(img.width, Math.round(w / s));
    const ch = Math.min(img.height, Math.round(h / s));
    // the middle of the picture, read in place (a copy of it first would cost as much as the resize)
    const r = { x: Math.floor((img.width - cw) / 2), y: Math.floor((img.height - ch) / 2), w: cw, h: ch };
    if (w === cw && h === ch) return cropImageData(img, r.x, r.y, cw, ch);
    return mode === 'nearest' ? nearestRect(img, r, w, h) : smoothRect(img, r, w, h);
  }
  const s = Math.min(w / img.width, h / img.height);
  const sw = Math.max(1, Math.round(img.width * s));
  const sh = Math.max(1, Math.round(img.height * s));
  const scaled = resize(img, sw, sh);
  const out = createImageData(w, h);
  blitImageData(out, scaled, Math.floor((w - sw) / 2), Math.floor((h - sh) / 2));
  return out;
}

/** Copy of a rectangle (clipped to the image; pixels outside are transparent). */
export function cropImageData(img: ImageData, x: number, y: number, w: number, h: number): ImageData {
  const out = createImageData(w, h);
  blitImageData(out, img, -x, -y);
  return out;
}

/** Overwrites dst pixels with src placed at (dx, dy). No blending. */
export function blitImageData(dst: ImageData, src: ImageData, dx: number, dy: number): void {
  const x0 = Math.max(0, dx), y0 = Math.max(0, dy);
  const x1 = Math.min(dst.width, dx + src.width), y1 = Math.min(dst.height, dy + src.height);
  if (x1 <= x0 || y1 <= y0) return;
  for (let y = y0; y < y1; y++) {
    const s = ((y - dy) * src.width + (x0 - dx)) * 4;
    dst.data.set(src.data.subarray(s, s + (x1 - x0) * 4), (y * dst.width + x0) * 4);
  }
}

// ---- Display helpers (browser only) ----

export function imageDataToCanvas(img: ImageData, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas ?? document.createElement('canvas');
  if (c.width !== img.width) c.width = img.width;
  if (c.height !== img.height) c.height = img.height;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  const real = img instanceof ImageDataShim ? new ImageData(new Uint8ClampedArray(img.data), img.width, img.height) : img;
  ctx.putImageData(real, 0, 0);
  return c;
}


// ---- Skins ----

/** Java's NativeImage.copyRect with mirrorX: copies (sx,sy,w,h) to (sx+dx, sy+dy) flipped horizontally. */
function copyRectMirrorX(px: Uint32Array, stride: number, sx: number, sy: number, dx: number, dy: number, w: number, h: number): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      px[(sy + dy + y) * stride + sx + dx + (w - 1 - x)] = px[(sy + y) * stride + sx + x];
    }
  }
}

function setNoAlpha(d: Uint8ClampedArray, stride: number, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) d[(y * stride + x) * 4 + 3] = 255;
}

/** Java forces these base-layer regions opaque when it loads any skin. */
export function forceOpaqueSkinBase(img: ImageData): ImageData {
  const out = cloneImageData(img);
  if (out.width !== 64 || (out.height !== 64 && out.height !== 32)) return out;
  setNoAlpha(out.data, 64, 0, 0, 32, 16);
  setNoAlpha(out.data, 64, 0, 16, 64, 32);
  if (out.height === 64) setNoAlpha(out.data, 64, 16, 48, 48, 64);
  return out;
}

/**
 * Converts a legacy 64x32 skin to the 64x64 layout exactly like Java's SkinTextureDownloader:
 * mirrored copies of the right leg/arm into the left limb slots, the "Notch transparency hack"
 * on the hat area and (optionally) the opaque base-layer fix. 64x64 input is returned as a copy.
 */
export function convertLegacySkin(img: ImageData, opts: { forceOpaqueBase?: boolean } = {}): ImageData {
  if (img.width === 64 && img.height === 64) return cloneImageData(img);
  if (img.width !== 64 || img.height !== 32) throw new Error(fmt(errorText.skinSize, { width: String(img.width), height: String(img.height) }));
  const out = createImageData(64, 64);
  out.data.set(img.data, 0);
  const px = new Uint32Array(out.data.buffer);
  // Legs
  copyRectMirrorX(px, 64, 4, 16, 16, 32, 4, 4);
  copyRectMirrorX(px, 64, 8, 16, 16, 32, 4, 4);
  copyRectMirrorX(px, 64, 0, 20, 24, 32, 4, 12);
  copyRectMirrorX(px, 64, 4, 20, 16, 32, 4, 12);
  copyRectMirrorX(px, 64, 8, 20, 8, 32, 4, 12);
  copyRectMirrorX(px, 64, 12, 20, 16, 32, 4, 12);
  // Arms
  copyRectMirrorX(px, 64, 44, 16, -8, 32, 4, 4);
  copyRectMirrorX(px, 64, 48, 16, -8, 32, 4, 4);
  copyRectMirrorX(px, 64, 40, 20, 0, 32, 4, 12);
  copyRectMirrorX(px, 64, 44, 20, -8, 32, 4, 12);
  copyRectMirrorX(px, 64, 48, 20, -16, 32, 4, 12);
  copyRectMirrorX(px, 64, 52, 20, -8, 32, 4, 12);
  const d = out.data;
  const force = opts.forceOpaqueBase !== false;
  if (force) setNoAlpha(d, 64, 0, 0, 32, 16);
  // Notch transparency hack: an all-opaque hat layer becomes fully transparent.
  let anyTransparent = false;
  for (let y = 0; y < 32 && !anyTransparent; y++) for (let x = 32; x < 64; x++) if (d[(y * 64 + x) * 4 + 3] < 128) { anyTransparent = true; break; }
  if (!anyTransparent) for (let y = 0; y < 32; y++) for (let x = 32; x < 64; x++) d[(y * 64 + x) * 4 + 3] = 0;
  if (force) {
    setNoAlpha(d, 64, 0, 16, 64, 32);
    setNoAlpha(d, 64, 16, 48, 48, 64);
  }
  return out;
}

/** Top half of a 64x64 skin: the legacy 64x32 layout (left limbs and extra overlays are dropped). */
export function toLegacySkin(img: ImageData): ImageData {
  if (img.width === 64 && img.height === 32) return cloneImageData(img);
  if (img.width !== 64 || img.height !== 64) throw new Error(errorText.legacySkin);
  return cropImageData(img, 0, 0, 64, 32);
}
