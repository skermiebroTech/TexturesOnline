import { decode as decodePngRaw, encode as encodePngRaw, type DecodedPng } from 'fast-png';
import { decodeTga, encodeTga as encodeTgaRaw, isTga } from './tga';

/*
 * Pixels are straight RGBA end to end. PNG and TGA are decoded/encoded in JS so colour under
 * transparent pixels (Bedrock tint and dye masks) survives. Canvas is used for display only.
 */

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

// ---- PNG ----

function sampleTo8(v: number, depth: number): number {
  if (depth === 8) return v;
  if (depth === 16) return (v * 255 + 32767) / 65535 | 0;
  return Math.round((v * 255) / ((1 << depth) - 1));
}

/** Converts any fast-png result (palette, grey, grey+alpha, RGB, RGBA; 1-16 bit; tRNS) to RGBA8. */
function pngToRgba(png: DecodedPng): Pixels {
  const { width, height, depth, channels } = png;
  const src = png.data;
  const out = new Uint8ClampedArray(width * height * 4);
  const palette = png.palette;
  const trns = png.transparency;
  if (palette) {
    const rowBytes = Math.ceil((width * depth) / 8);
    const mask = (1 << depth) - 1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let idx: number;
        if (depth === 8) idx = src[y * rowBytes + x];
        else {
          const bit = x * depth;
          const byte = src[y * rowBytes + (bit >> 3)];
          idx = (byte >> (8 - depth - (bit & 7))) & mask;
        }
        const c = palette[idx];
        const o = (y * width + x) * 4;
        if (!c) continue;
        out[o] = c[0];
        out[o + 1] = c[1];
        out[o + 2] = c[2];
        out[o + 3] = c.length > 3 ? c[3] : 255;
      }
    }
    return out;
  }
  if (depth < 8) {
    // Sub-byte greyscale (channels === 1), rows padded to whole bytes.
    const rowBytes = Math.ceil((width * depth) / 8);
    const mask = (1 << depth) - 1;
    const key = trns && trns.length >= 1 ? trns[0] : -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const bit = x * depth;
        const byte = src[y * rowBytes + (bit >> 3)];
        const v = (byte >> (8 - depth - (bit & 7))) & mask;
        const g8 = sampleTo8(v, depth);
        const o = (y * width + x) * 4;
        out[o] = out[o + 1] = out[o + 2] = g8;
        out[o + 3] = v === key ? 0 : 255;
      }
    }
    return out;
  }
  const n = width * height;
  if (channels === 4 && depth === 8) {
    out.set(src as ArrayLike<number>);
    return out;
  }
  for (let i = 0; i < n; i++) {
    const s = i * channels;
    const o = i * 4;
    if (channels === 1 || channels === 2) {
      const v = src[s];
      const g8 = sampleTo8(v, depth);
      out[o] = out[o + 1] = out[o + 2] = g8;
      if (channels === 2) out[o + 3] = sampleTo8(src[s + 1], depth);
      else out[o + 3] = trns && trns.length >= 1 && v === trns[0] ? 0 : 255;
    } else {
      const r = src[s], gg = src[s + 1], b = src[s + 2];
      out[o] = sampleTo8(r, depth);
      out[o + 1] = sampleTo8(gg, depth);
      out[o + 2] = sampleTo8(b, depth);
      if (channels === 4) out[o + 3] = sampleTo8(src[s + 3], depth);
      else out[o + 3] = trns && trns.length >= 3 && r === trns[0] && gg === trns[1] && b === trns[2] ? 0 : 255;
    }
  }
  return out;
}

function pngIsInterlaced(bytes: Uint8Array): boolean {
  return bytes.length > 28 && bytes[28] === 1;
}

export function decodePngBytes(bytes: Uint8Array): ImageData {
  let png: DecodedPng;
  try {
    png = decodePngRaw(bytes);
  } catch (err) {
    throw new Error(`This PNG file couldn't be read${err instanceof Error && err.message ? ` (${err.message})` : ''}.`);
  }
  if (png.depth < 8 && !png.palette && png.channels !== 1) throw new Error('This PNG uses an unsupported bit depth.');
  if (png.depth < 8 && pngIsInterlaced(bytes)) throw new Error('Interlaced PNGs with fewer than 8 bits per sample are not supported. Re-save the image as a normal PNG.');
  return createImageData(png.width, png.height, pngToRgba(png));
}

/** PNG from straight RGBA via fast-png (no canvas). Works in workers and Node. */
export function encodePng(img: ImageData): Uint8Array<ArrayBuffer> {
  const data = new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength);
  return encodePngRaw({ width: img.width, height: img.height, data, channels: 4, depth: 8 }, { zlib: { level: 6 } }) as Uint8Array<ArrayBuffer>;
}

export function encodeTga(img: ImageData): Uint8Array<ArrayBuffer> {
  return encodeTgaRaw(img);
}

export async function encodeImage(img: ImageData, ext: 'png' | 'tga'): Promise<Blob> {
  if (ext === 'tga') return new Blob([encodeTga(img)], { type: 'image/x-tga' });
  return new Blob([encodePng(img)], { type: 'image/png' });
}

// ---- Decode any image ----

function sniff(bytes: Uint8Array): 'png' | 'jpeg' | 'gif' | 'webp' | 'bmp' | null {
  if (isPng(bytes)) return 'png';
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length > 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'gif';
  if (bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'webp';
  if (bytes.length > 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp';
  return null;
}

/** Browser decode for formats without alpha-as-data concerns (JPEG, GIF, WebP, BMP uploads). */
async function decodeWithBrowser(bytes: Uint8Array, mime: string): Promise<ImageData> {
  if (typeof createImageBitmap !== 'function') throw new Error('This image format is not supported here. Use a PNG file.');
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime }), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  } catch {
    throw new Error("This image couldn't be read. Try saving it as a PNG.");
  }
  const w = bmp.width;
  const h = bmp.height;
  let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (typeof OffscreenCanvas !== 'undefined') ctx = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true });
  else {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    ctx = c.getContext('2d', { willReadFrequently: true });
  }
  if (!ctx) throw new Error("This image couldn't be read. Try saving it as a PNG.");
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const id = ctx.getImageData(0, 0, w, h);
  return createImageData(w, h, id.data);
}

export async function decodeImage(data: Uint8Array | Blob | ArrayBuffer, ext?: 'png' | 'tga' | string): Promise<ImageData> {
  const bytes = data instanceof Uint8Array ? data : data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(await data.arrayBuffer());
  if (!bytes.length) throw new Error('The image file is empty.');
  const kind = sniff(bytes);
  if (kind === 'png') return decodePngBytes(bytes);
  const e = (ext ?? '').toLowerCase().replace(/^\./, '');
  if (!kind && (e === 'tga' || isTga(bytes))) {
    const t = decodeTga(bytes);
    return createImageData(t.width, t.height, t.data);
  }
  if (kind) return decodeWithBrowser(bytes, `image/${kind}`);
  throw new Error("This file isn't a supported image. Use a PNG file.");
}

/** Sync decode for PNG/TGA bytes (throws for other formats). */
export function decodeImageSync(bytes: Uint8Array, ext?: string): ImageData {
  if (isPng(bytes)) return decodePngBytes(bytes);
  if ((ext ?? '').toLowerCase().replace(/^\./, '') === 'tga' || isTga(bytes)) {
    const t = decodeTga(bytes);
    return createImageData(t.width, t.height, t.data);
  }
  throw new Error("This file isn't a PNG or TGA image.");
}

// ---- Geometry ----

export function resizeNearest(img: ImageData, w: number, h: number): ImageData {
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

export function resizeSmooth(img: ImageData, w: number, h: number): ImageData {
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
export function fitToSize(img: ImageData, w: number, h: number, mode: 'nearest' | 'smooth', fit: 'contain' | 'cover' | 'stretch' = 'contain'): ImageData {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  const resize = mode === 'nearest' ? resizeNearest : resizeSmooth;
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

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)));
  return btoa(s);
}

/** Exact PNG data URL (encoded in JS, so no canvas colour loss). */
export function imageDataToDataUrl(img: ImageData): string {
  return 'data:image/png;base64,' + bytesToBase64(encodePng(img));
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
  if (img.width !== 64 || img.height !== 32) throw new Error(`Skins must be 64x64 or 64x32 pixels (this one is ${img.width}x${img.height}).`);
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
  if (img.width !== 64 || img.height !== 64) throw new Error('Only 64x64 skins can be saved in the legacy 64x32 format.');
  return cropImageData(img, 0, 0, 64, 32);
}
