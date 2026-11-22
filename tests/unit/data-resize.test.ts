// The resizers against the straightforward versions they replaced (a premultiplied float copy of
// the whole picture, then one pass per axis; 'cover' cropped first): the same pixels to the bit, on
// random pictures, sizes and crops.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createImageData, cloneImageData, resizeNearest, resizeSmooth, fitToSize, cropImageData, blitImageData } from '../../src/core/image';

// ---- the versions they replaced ----
function refNearest(img: ImageData, w: number, h: number): ImageData {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  if (w === img.width && h === img.height) return cloneImageData(img);
  const out = createImageData(w, h);
  const data = img.data.byteOffset % 4 === 0 ? img.data : new Uint8ClampedArray(img.data);
  const src = new Uint32Array(data.buffer, data.byteOffset, img.width * img.height);
  const dst = new Uint32Array(out.data.buffer);
  const xs = new Uint32Array(w);
  for (let x = 0; x < w; x++) xs[x] = Math.min(img.width - 1, Math.floor(((x + 0.5) * img.width) / w));
  for (let y = 0; y < h; y++) {
    const sy = Math.min(img.height - 1, Math.floor(((y + 0.5) * img.height) / h));
    const sRow = sy * img.width;
    const dRow = y * w;
    for (let x = 0; x < w; x++) dst[dRow + x] = src[sRow + xs[x]];
  }
  return out;
}

/** One-axis resample of premultiplied float RGBA: box filter when shrinking, linear when growing. */
function resampleAxis(src: Float32Array, sw: number, sh: number, dw: number, dh: number, horizontal: boolean): Float32Array {
  const out = new Float32Array(dw * dh * 4);
  const sLen = horizontal ? sw : sh;
  const dLen = horizontal ? dw : dh;
  const lines = horizontal ? sh : sw;
  const scale = sLen / dLen;
  const idx = (line: number, i: number, lw: number) => (horizontal ? line * lw + i : i * lw + line) * 4;
  for (let d = 0; d < dLen; d++) {
    const weights: number[] = [];
    const taps: number[] = [];
    if (scale > 1) {
      const start = d * scale;
      const end = start + scale;
      for (let s = Math.floor(start); s < Math.ceil(end); s++) {
        const wgt = Math.min(end, s + 1) - Math.max(start, s);
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
    let total = 0;
    for (const wgt of weights) total += wgt;
    for (let line = 0; line < lines; line++) {
      let r = 0, gg = 0, b = 0, a = 0;
      for (let k = 0; k < taps.length; k++) {
        const si = idx(line, taps[k], sw);
        const wgt = weights[k];
        r += src[si] * wgt;
        gg += src[si + 1] * wgt;
        b += src[si + 2] * wgt;
        a += src[si + 3] * wgt;
      }
      const di = idx(line, d, dw);
      out[di] = r / total;
      out[di + 1] = gg / total;
      out[di + 2] = b / total;
      out[di + 3] = a / total;
    }
  }
  return out;
}

function refSmooth(img: ImageData, w: number, h: number): ImageData {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  if (w === img.width && h === img.height) return cloneImageData(img);
  const n = img.width * img.height;
  const pm = new Float32Array(n * 4);
  const d = img.data;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const a = d[o + 3] / 255;
    pm[o] = d[o] * a;
    pm[o + 1] = d[o + 1] * a;
    pm[o + 2] = d[o + 2] * a;
    pm[o + 3] = a;
  }
  const hPass = resampleAxis(pm, img.width, img.height, w, img.height, true);
  const vPass = resampleAxis(hPass, w, img.height, w, h, false);
  const out = createImageData(w, h);
  const od = out.data;
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const a = vPass[o + 3];
    if (a > 0) {
      od[o] = vPass[o] / a;
      od[o + 1] = vPass[o + 1] / a;
      od[o + 2] = vPass[o + 2] / a;
      od[o + 3] = a * 255;
    }
  }
  return out;
}

/**
 * Scales img to exactly w x h. 'contain' keeps the aspect ratio and centres the image on a
 * transparent canvas, 'cover' crops to fill, 'stretch' ignores the aspect ratio.
 */
function refFit(img: ImageData, w: number, h: number, mode: 'nearest' | 'smooth', fit: 'contain' | 'cover' | 'stretch' = 'contain'): ImageData {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  const resize = mode === 'nearest' ? refNearest : refSmooth;
  if (fit === 'stretch' || img.width * h === img.height * w) return resize(img, w, h);
  if (fit === 'cover') {
    const s = Math.max(w / img.width, h / img.height);
    const cw = Math.min(img.width, Math.round(w / s));
    const ch = Math.min(img.height, Math.round(h / s));
    const cropped = cropImageData(img, Math.floor((img.width - cw) / 2), Math.floor((img.height - ch) / 2), cw, ch);
    return resize(cropped, w, h);
  }
  const s = Math.min(w / img.width, h / img.height);
  const sw = Math.max(1, Math.round(img.width * s));
  const sh = Math.max(1, Math.round(img.height * s));
  const scaled = resize(img, sw, sh);
  const out = createImageData(w, h);
  blitImageData(out, scaled, Math.floor((w - sw) / 2), Math.floor((h - sh) / 2));
  return out;
}

// ---- the comparison ----
/** A small deterministic random generator (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomImage(r: () => number, w: number, h: number): ImageData {
  const img = createImageData(w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    // some fully transparent and fully opaque pixels, the rest anything
    const kind = r();
    d[i] = (r() * 256) | 0;
    d[i + 1] = (r() * 256) | 0;
    d[i + 2] = (r() * 256) | 0;
    d[i + 3] = kind < 0.2 ? 0 : kind < 0.5 ? 255 : (r() * 256) | 0;
  }
  return img;
}

function same(a: ImageData, b: ImageData, what: string): void {
  assert.equal(a.width, b.width, `${what}: width`);
  assert.equal(a.height, b.height, `${what}: height`);
  const i = a.data.findIndex((v, k) => v !== b.data[k]);
  assert.equal(i, -1, `${what}: first different byte at ${i}`);
}

test('resizeSmooth and resizeNearest give the same pixels as before', () => {
  const r = rng(7);
  const sizes = [1, 2, 3, 5, 7, 16, 17, 31, 64, 100];
  for (let n = 0; n < 120; n++) {
    const sw = sizes[(r() * sizes.length) | 0];
    const sh = sizes[(r() * sizes.length) | 0];
    const img = randomImage(r, sw, sh);
    const w = Math.max(1, Math.round(r() * 80));
    const h = Math.max(1, Math.round(r() * 80));
    same(resizeSmooth(img, w, h), refSmooth(img, w, h), `smooth ${sw}×${sh} → ${w}×${h}`);
    same(resizeNearest(img, w, h), refNearest(img, w, h), `nearest ${sw}×${sh} → ${w}×${h}`);
  }
  // one side kept, a big shrink, fractional sizes
  const big = randomImage(r, 403, 299);
  for (const [w, h] of [[403, 50], [16, 299], [16, 16], [7, 3], [200.4, 150.6], [800, 9]]) {
    same(resizeSmooth(big, w, h), refSmooth(big, w, h), `smooth big → ${w}×${h}`);
    same(resizeNearest(big, w, h), refNearest(big, w, h), `nearest big → ${w}×${h}`);
  }
});

test('fitToSize gives the same pixels as before (cover read in place)', () => {
  const r = rng(11);
  for (let n = 0; n < 80; n++) {
    const sw = 1 + ((r() * 120) | 0);
    const sh = 1 + ((r() * 120) | 0);
    const img = randomImage(r, sw, sh);
    const w = 1 + ((r() * 48) | 0);
    const h = 1 + ((r() * 48) | 0);
    for (const mode of ['nearest', 'smooth'] as const) {
      for (const fit of ['stretch', 'contain', 'cover'] as const) same(fitToSize(img, w, h, mode, fit), refFit(img, w, h, mode, fit), `${mode} ${fit} ${sw}×${sh} → ${w}×${h}`);
    }
  }
  // cover that keeps the crop's size
  const img = randomImage(r, 40, 20);
  for (const mode of ['nearest', 'smooth'] as const) same(fitToSize(img, 20, 20, mode, 'cover'), refFit(img, 20, 20, mode, 'cover'), `${mode} cover, no resize`);
});
