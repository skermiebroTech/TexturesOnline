// Pack Doctor: what an image file really is, and whether a PNG is whole, without decoding its
// pixels (a pack can hold thousands of large textures). Pure.

export type ImageKind = 'png' | 'jpeg' | 'gif' | 'webp' | 'bmp' | 'tga' | 'other';

export function sniffImage(b: Uint8Array): ImageKind {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'gif';
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  if (b.length > 26 && b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
  if (looksLikeTga(b)) return 'tga';
  return 'other';
}

/** A TGA header with a known image type and a size (TGA has no signature). */
export function looksLikeTga(b: Uint8Array): boolean {
  return b.length >= 18 && b[1] <= 1 && [1, 2, 3, 9, 10, 11].includes(b[2]) && (b[12] | (b[13] << 8)) > 0 && (b[14] | (b[15] << 8)) > 0 && [8, 15, 16, 24, 32].includes(b[16]);
}

export interface PngInfo {
  /** null when the file is a whole PNG */
  problem: null | 'header' | 'truncated' | 'no-data' | 'no-end';
  width: number;
  height: number;
  bitDepth: number;
  /** 0 grey, 2 RGB, 3 palette, 4 grey + alpha, 6 RGBA */
  colorType: number;
  interlaced: boolean;
}

const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const DEPTHS: Record<number, number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };

/** Walks the chunks of a PNG: header, sizes, that the data is there and the file is not cut off. */
export function inspectPng(b: Uint8Array): PngInfo {
  const info: PngInfo = { problem: null, width: 0, height: 0, bitDepth: 0, colorType: 0, interlaced: false };
  if (b.length < 33 || u32(b, 12) !== 0x49484452 || u32(b, 8) !== 13) return { ...info, problem: 'header' };
  info.width = u32(b, 16);
  info.height = u32(b, 20);
  info.bitDepth = b[24];
  info.colorType = b[25];
  info.interlaced = b[28] === 1;
  if (!info.width || !info.height || info.width > 0x7fffffff || info.height > 0x7fffffff || !DEPTHS[info.colorType]?.includes(info.bitDepth)) return { ...info, problem: 'header' };
  let o = 8;
  let data = false;
  while (o + 8 <= b.length) {
    const len = u32(b, o);
    const type = u32(b, o + 4);
    if (o + 12 + len > b.length) return { ...info, problem: 'truncated' };
    if (type === 0x49444154) data = true;
    if (type === 0x49454e44) return data ? info : { ...info, problem: 'no-data' };
    o += 12 + len;
  }
  if (o !== b.length) return { ...info, problem: 'truncated' };
  return { ...info, problem: data ? 'no-end' : 'no-data' };
}

/** Width and height of a TGA (header only). */
export function tgaSize(b: Uint8Array): { w: number; h: number } | null {
  if (!looksLikeTga(b)) return null;
  return { w: b[12] | (b[13] << 8), h: b[14] | (b[15] << 8) };
}

export const isPowerOfTwo = (n: number) => n > 0 && (n & (n - 1)) === 0;

/** Ogg (Vorbis) files start with "OggS". */
export function isOgg(b: Uint8Array): boolean {
  return b.length >= 4 && b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53;
}
