import { decode as decodePngRaw, encode as encodePngRaw, type DecodedPng } from 'fast-png';
import { decodeTga, encodeTga as encodeTgaRaw, isTga } from './tga';
import { createImageData, isPng } from './pixels';

/*
 * Pixels are straight RGBA end to end. PNG and TGA are decoded/encoded in JS so colour under
 * transparent pixels (Bedrock tint and dye masks) survives. Canvas is used for display only.
 */

export * from './pixels';

type Pixels = Uint8ClampedArray<ArrayBuffer>;

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

// ---- Data URLs ----

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
