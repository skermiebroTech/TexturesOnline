// HD skins: 128x128 is the 64x64 layout at twice the pixel density (Bedrock only; Java Edition shows
// 64x64 skins without mods). Pure helpers to tell the sizes apart and convert between them.
//
// Up: every pixel becomes a 2x2 block (looks the same in game). Down: every 2x2 block becomes one
// pixel; a block of one colour stays that colour, so making a skin HD and back is lossless.

import { HD_SKIN_SIZE, isHdSkin, SKIN_SIZE } from './templates';

export type SkinSize = 64 | 128;

interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

function makeImage(w: number, h: number): ImageData {
  const Ctor = (globalThis as { ImageData?: typeof ImageData }).ImageData;
  if (Ctor) return new Ctor(w, h);
  return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4), colorSpace: 'srgb' } as ImageData;
}

/** 64 or 128 for a square skin of a supported size, else null (64x32 legacy skins are not square). */
export function skinSizeOf(img: { width: number; height: number }): SkinSize | null {
  if (img.width === SKIN_SIZE && img.height === SKIN_SIZE) return 64;
  if (isHdSkin(img)) return 128;
  return null;
}

/** "64×64" / "128×128 HD" */
export function sizeLabel(size: SkinSize): string {
  return size === 128 ? '128×128 HD' : '64×64';
}

/** A 64x64 skin doubled to 128x128 (nearest neighbour: each pixel becomes 2x2). HD input is copied. */
export function upscaleSkin(img: Pixels): ImageData {
  if (isHdSkin(img)) {
    const copy = makeImage(img.width, img.height);
    copy.data.set(img.data);
    return copy;
  }
  if (img.width !== SKIN_SIZE || img.height !== SKIN_SIZE) throw new Error(`Only 64×64 skins can be made HD (this one is ${img.width}×${img.height}).`);
  const N = HD_SKIN_SIZE;
  const out = makeImage(N, N);
  const s = new Uint32Array(img.data.buffer, img.data.byteOffset, SKIN_SIZE * SKIN_SIZE);
  const d = new Uint32Array(out.data.buffer);
  for (let y = 0; y < N; y++) {
    const row = (y >> 1) * SKIN_SIZE;
    for (let x = 0; x < N; x++) d[y * N + x] = s[row + (x >> 1)];
  }
  return out;
}

/** One 2x2 block reduced to one pixel (see the file comment). */
function reduceBlock(src: Uint8ClampedArray, idx: readonly number[], out: Uint8ClampedArray, o: number): void {
  const visible = idx.filter((i) => src[i + 3] > 0);
  if (visible.length < 2) {
    // Mostly see-through: keep a lone pixel only when the block has nothing else.
    out.fill(0, o, o + 4);
    return;
  }
  // The most common colour, when it is the only one covering two or more pixels.
  const counts = new Map<number, { n: number; i: number }>();
  for (const i of visible) {
    const key = ((src[i] << 24) | (src[i + 1] << 16) | (src[i + 2] << 8) | src[i + 3]) >>> 0;
    const c = counts.get(key);
    if (c) c.n++;
    else counts.set(key, { n: 1, i });
  }
  let best: { n: number; i: number } | null = null;
  let tie = false;
  for (const c of counts.values()) {
    if (!best || c.n > best.n) {
      best = c;
      tie = false;
    } else if (c.n === best.n) tie = true;
  }
  if (best && best.n >= 2 && !tie) {
    out.set(src.subarray(best.i, best.i + 4), o);
    return;
  }
  // Otherwise the average of the visible pixels (alpha-weighted colour).
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  for (const i of visible) {
    const w = src[i + 3];
    r += src[i] * w;
    g += src[i + 1] * w;
    b += src[i + 2] * w;
    a += w;
  }
  out[o] = Math.round(r / a);
  out[o + 1] = Math.round(g / a);
  out[o + 2] = Math.round(b / a);
  out[o + 3] = Math.round(a / visible.length);
}

/** An HD 128x128 skin reduced to 64x64 for Java Edition. A 64x64 input is copied. */
export function downscaleSkin(img: Pixels): ImageData {
  if (img.width === SKIN_SIZE && img.height === SKIN_SIZE) {
    const copy = makeImage(img.width, img.height);
    copy.data.set(img.data);
    return copy;
  }
  if (!isHdSkin(img)) throw new Error(`Only 128×128 HD skins can be reduced to 64×64 (this one is ${img.width}×${img.height}).`);
  const N = HD_SKIN_SIZE;
  const out = makeImage(SKIN_SIZE, SKIN_SIZE);
  const idx = [0, 0, 0, 0];
  for (let y = 0; y < SKIN_SIZE; y++) {
    for (let x = 0; x < SKIN_SIZE; x++) {
      const i = (2 * y * N + 2 * x) * 4;
      idx[0] = i;
      idx[1] = i + 4;
      idx[2] = i + N * 4;
      idx[3] = i + N * 4 + 4;
      reduceBlock(img.data, idx, out.data, (y * SKIN_SIZE + x) * 4);
    }
  }
  return out;
}

/**
 * How much HD detail a reduction to 64x64 simplifies: the number of 2x2 blocks whose pixels are not
 * all the same, among blocks with anything visible. 0 means the skin is a doubled 64x64 skin.
 */
export function hdDetail(img: Pixels): { changed: number; visible: number } {
  if (!isHdSkin(img)) return { changed: 0, visible: 0 };
  const N = HD_SKIN_SIZE;
  const s = new Uint32Array(img.data.buffer, img.data.byteOffset, N * N);
  let changed = 0;
  let visible = 0;
  for (let y = 0; y < N; y += 2) {
    for (let x = 0; x < N; x += 2) {
      // Fully see-through pixels count as equal whatever their hidden colour.
      const at = (p: number) => (img.data[p * 4 + 3] ? s[p] : 0);
      const a = at(y * N + x);
      const b = at(y * N + x + 1);
      const c = at((y + 1) * N + x);
      const d = at((y + 1) * N + x + 1);
      if (!a && !b && !c && !d) continue;
      visible++;
      if (a !== b || a !== c || a !== d) changed++;
    }
  }
  return { changed, visible };
}

/** A skin at the requested size: 64x64 skins are doubled for HD, HD skins reduced for 64x64. */
export function resizeSkin(img: Pixels, size: SkinSize): ImageData {
  return size === 128 ? upscaleSkin(img) : downscaleSkin(img);
}
