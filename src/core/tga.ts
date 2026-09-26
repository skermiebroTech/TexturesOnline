/**
 * Truevision TGA decoder/encoder working on straight (non-premultiplied) RGBA.
 * Decodes image types 1/2/3 (raw) and 9/10/11 (RLE) at 8/15/16/24/32 bpp with any origin.
 * Encodes 32-bit BGRA the way Bedrock's vanilla files are written: bottom-left origin,
 * descriptor 0x08, TGA 2.0 footer; RLE (type 10) optional.
 */

export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

export interface TgaEncodeOptions {
  /** Run-length encode (type 10). Default false (type 2, like most vanilla files). */
  rle?: boolean;
  /** Row order in the file. Default 'bottom-left' (what Bedrock ships). */
  origin?: 'bottom-left' | 'top-left';
}

const FOOTER_SIG = 'TRUEVISION-XFILE.\0';

export function isTga(bytes: Uint8Array): boolean {
  if (bytes.length < 18) return false;
  const cmapType = bytes[1];
  const type = bytes[2];
  const w = bytes[12] | (bytes[13] << 8);
  const h = bytes[14] | (bytes[15] << 8);
  const bpp = bytes[16];
  if (cmapType > 1 || ![1, 2, 3, 9, 10, 11].includes(type)) return false;
  if (!w || !h) return false;
  return [8, 15, 16, 24, 32].includes(bpp);
}

export function decodeTga(bytes: Uint8Array): RgbaImage {
  if (bytes.length < 18) throw new Error('This TGA file is truncated.');
  const idLength = bytes[0];
  const cmapType = bytes[1];
  const type = bytes[2];
  const cmapFirst = bytes[3] | (bytes[4] << 8);
  const cmapLength = bytes[5] | (bytes[6] << 8);
  const cmapDepth = bytes[7];
  const width = bytes[12] | (bytes[13] << 8);
  const height = bytes[14] | (bytes[15] << 8);
  const bpp = bytes[16];
  const desc = bytes[17];
  const alphaBits = desc & 0x0f;
  const rightToLeft = (desc & 0x10) !== 0;
  const topToBottom = (desc & 0x20) !== 0;

  const rle = type >= 9;
  const base = rle ? type - 8 : type;
  if (base !== 1 && base !== 2 && base !== 3) throw new Error(`Unsupported TGA image type ${type}.`);
  if (!width || !height) throw new Error('This TGA file has no pixels.');
  if (width * height > 16384 * 16384) throw new Error('This TGA image is too large.');

  let pos = 18 + idLength;
  let palette: Uint8Array | null = null;
  if (cmapType === 1) {
    const entryBytes = Math.ceil(cmapDepth / 8);
    palette = new Uint8Array((cmapFirst + cmapLength) * 4);
    for (let i = 0; i < cmapLength; i++) {
      readColor(bytes, pos + i * entryBytes, cmapDepth, alphaBits, palette, (cmapFirst + i) * 4);
    }
    pos += cmapLength * entryBytes;
  }
  if (base === 1 && !palette) throw new Error('This colour-mapped TGA has no palette.');

  const pixelBytes = Math.ceil(bpp / 8);
  if (base === 1 && bpp !== 8 && bpp !== 16) throw new Error(`Unsupported TGA colour-map index size ${bpp}.`);
  if (base === 3 && bpp !== 8 && bpp !== 16) throw new Error(`Unsupported TGA greyscale depth ${bpp}.`);

  const count = width * height;
  // Pixels in file order (first pixel = first stored pixel), as RGBA.
  const linear = new Uint8ClampedArray(count * 4);
  const tmp = new Uint8Array(4);
  const decodePixel = (at: number, out: Uint8Array | Uint8ClampedArray, o: number) => {
    if (base === 2) readColor(bytes, at, bpp, alphaBits, out, o);
    else if (base === 3) {
      const v = bytes[at];
      out[o] = out[o + 1] = out[o + 2] = v;
      out[o + 3] = bpp === 16 ? bytes[at + 1] : 255;
    } else {
      const idx = bpp === 16 ? bytes[at] | (bytes[at + 1] << 8) : bytes[at];
      const p = idx * 4;
      if (!palette || p + 3 >= palette.length) {
        out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0;
      } else {
        out[o] = palette[p];
        out[o + 1] = palette[p + 1];
        out[o + 2] = palette[p + 2];
        out[o + 3] = palette[p + 3];
      }
    }
  };

  if (!rle) {
    if (pos + count * pixelBytes > bytes.length) throw new Error('This TGA file is truncated.');
    for (let i = 0; i < count; i++) decodePixel(pos + i * pixelBytes, linear, i * 4);
  } else {
    let i = 0;
    while (i < count) {
      if (pos >= bytes.length) throw new Error('This TGA file is truncated.');
      const header = bytes[pos++];
      const n = (header & 0x7f) + 1;
      if (header & 0x80) {
        if (pos + pixelBytes > bytes.length) throw new Error('This TGA file is truncated.');
        decodePixel(pos, tmp, 0);
        pos += pixelBytes;
        const end = Math.min(count, i + n);
        for (; i < end; i++) {
          const o = i * 4;
          linear[o] = tmp[0];
          linear[o + 1] = tmp[1];
          linear[o + 2] = tmp[2];
          linear[o + 3] = tmp[3];
        }
      } else {
        const end = Math.min(count, i + n);
        if (pos + (end - i) * pixelBytes > bytes.length) throw new Error('This TGA file is truncated.');
        for (; i < end; i++, pos += pixelBytes) decodePixel(pos, linear, i * 4);
      }
    }
  }

  if (!topToBottom || rightToLeft) {
    const out = new Uint8ClampedArray(count * 4);
    const src32 = new Uint32Array(linear.buffer);
    const dst32 = new Uint32Array(out.buffer);
    for (let y = 0; y < height; y++) {
      const srcRow = y * width;
      const dy = topToBottom ? y : height - 1 - y;
      const dstRow = dy * width;
      if (!rightToLeft) dst32.set(src32.subarray(srcRow, srcRow + width), dstRow);
      else for (let x = 0; x < width; x++) dst32[dstRow + (width - 1 - x)] = src32[srcRow + x];
    }
    return { width, height, data: out };
  }
  return { width, height, data: linear };
}

/** Reads one BGR(A) colour of `depth` bits at bytes[at] into out[o..o+3] as RGBA. */
function readColor(bytes: Uint8Array, at: number, depth: number, alphaBits: number, out: Uint8Array | Uint8ClampedArray, o: number): void {
  if (depth === 32) {
    out[o] = bytes[at + 2];
    out[o + 1] = bytes[at + 1];
    out[o + 2] = bytes[at];
    out[o + 3] = bytes[at + 3];
  } else if (depth === 24) {
    out[o] = bytes[at + 2];
    out[o + 1] = bytes[at + 1];
    out[o + 2] = bytes[at];
    out[o + 3] = 255;
  } else if (depth === 15 || depth === 16) {
    const v = bytes[at] | (bytes[at + 1] << 8);
    const r = (v >> 10) & 0x1f;
    const g = (v >> 5) & 0x1f;
    const b = v & 0x1f;
    out[o] = (r << 3) | (r >> 2);
    out[o + 1] = (g << 3) | (g >> 2);
    out[o + 2] = (b << 3) | (b >> 2);
    out[o + 3] = depth === 16 && alphaBits > 0 ? (v & 0x8000 ? 255 : 0) : 255;
  } else if (depth === 8) {
    out[o] = out[o + 1] = out[o + 2] = bytes[at];
    out[o + 3] = 255;
  } else {
    throw new Error(`Unsupported TGA pixel depth ${depth}.`);
  }
}

/** Encodes straight RGBA as a 32-bit TGA. Colour under fully transparent pixels is preserved. */
export function encodeTga(img: { width: number; height: number; data: ArrayLike<number> }, opts: TgaEncodeOptions = {}): Uint8Array<ArrayBuffer> {
  const { width, height, data } = img;
  if (width < 1 || height < 1 || width > 65535 || height > 65535) throw new Error('TGA images must be 1 to 65535 pixels wide and tall.');
  if (data.length < width * height * 4) throw new Error('Pixel data is smaller than width x height.');
  const topLeft = opts.origin === 'top-left';
  const rle = !!opts.rle;
  const count = width * height;
  const body = new Uint8Array(rle ? count * 4 + Math.ceil(count / 128) * (1 + 4) + height : count * 4);
  let p = 0;

  const rowStart = (fileRow: number) => (topLeft ? fileRow : height - 1 - fileRow) * width * 4;
  for (let fr = 0; fr < height; fr++) {
    const rs = rowStart(fr);
    if (!rle) {
      for (let x = 0; x < width; x++) {
        const s = rs + x * 4;
        body[p++] = data[s + 2];
        body[p++] = data[s + 1];
        body[p++] = data[s];
        body[p++] = data[s + 3];
      }
      continue;
    }
    // RLE packets never cross scanlines (TGA 2.0 recommendation).
    let x = 0;
    const same = (a: number, b: number) => {
      const sa = rs + a * 4;
      const sb = rs + b * 4;
      return data[sa] === data[sb] && data[sa + 1] === data[sb + 1] && data[sa + 2] === data[sb + 2] && data[sa + 3] === data[sb + 3];
    };
    while (x < width) {
      let run = 1;
      while (x + run < width && run < 128 && same(x, x + run)) run++;
      if (run >= 2) {
        const s = rs + x * 4;
        body[p++] = 0x80 | (run - 1);
        body[p++] = data[s + 2];
        body[p++] = data[s + 1];
        body[p++] = data[s];
        body[p++] = data[s + 3];
        x += run;
      } else {
        let n = 1;
        while (x + n < width && n < 128 && !(x + n + 1 < width && same(x + n, x + n + 1))) n++;
        body[p++] = n - 1;
        for (let i = 0; i < n; i++) {
          const s = rs + (x + i) * 4;
          body[p++] = data[s + 2];
          body[p++] = data[s + 1];
          body[p++] = data[s];
          body[p++] = data[s + 3];
        }
        x += n;
      }
    }
  }

  const out = new Uint8Array(18 + p + 26);
  out[2] = rle ? 10 : 2;
  out[12] = width & 0xff;
  out[13] = width >> 8;
  out[14] = height & 0xff;
  out[15] = height >> 8;
  out[16] = 32;
  out[17] = 0x08 | (topLeft ? 0x20 : 0);
  out.set(body.subarray(0, p), 18);
  // TGA 2.0 footer: no extension/developer areas.
  const f = 18 + p + 8;
  for (let i = 0; i < FOOTER_SIG.length; i++) out[f + i] = FOOTER_SIG.charCodeAt(i);
  return out;
}
