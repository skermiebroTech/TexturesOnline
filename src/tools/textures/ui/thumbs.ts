// Thumbnail pipeline for the texture browser: decode on demand (limited concurrency), first frame,
// optional effect preview, byte-bounded LRU caches for decoded and processed images.

import { createLimiter } from '../../../core/net';
import { resizeSmooth } from '../../../core/pixels';
import { applyEffects, effectsApply } from '../effects';
import { displayAlphaData, firstSquare, isBedrockStrip, type TextureEntry } from './meta';
import type { TexStore } from './store';
import { nextTask } from '../../../core/yield';

const MAX_THUMB = 128;

class ByteLru<V extends { data: { byteLength: number } }> {
  private map = new Map<string, V>();
  private bytes = 0;
  constructor(private readonly budget: number) {}
  get(k: string): V | undefined {
    const v = this.map.get(k);
    if (v) {
      this.map.delete(k);
      this.map.set(k, v);
    }
    return v;
  }
  set(k: string, v: V): void {
    const old = this.map.get(k);
    if (old) {
      this.bytes -= old.data.byteLength;
      this.map.delete(k);
    }
    this.map.set(k, v);
    this.bytes += v.data.byteLength;
    while (this.bytes > this.budget && this.map.size > 1) {
      const [key, val] = this.map.entries().next().value!;
      this.map.delete(key);
      this.bytes -= val.data.byteLength;
    }
  }
  clear(): void {
    this.map.clear();
    this.bytes = 0;
  }
}

function hashString(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export class ThumbService {
  private base = new ByteLru<ImageData>(40 * 1024 * 1024);
  private out = new ByteLru<ImageData>(40 * 1024 * 1024);
  private inflight = new Map<string, Promise<ImageData | null>>();
  private limit = createLimiter(6);
  private fxKey = '';
  /** Show effect previews in thumbnails */
  showEffects = true;

  constructor(private readonly store: TexStore) {
    this.updateEffects();
  }

  updateEffects(): void {
    const layers = this.store.project.effects.filter((l) => l.enabled);
    this.fxKey = layers.length ? hashString(JSON.stringify(layers.map((l) => [l.type, l.params, l.categories ?? null]))) : '';
  }

  private withEffects(): boolean {
    return this.showEffects && this.fxKey !== '';
  }

  key(e: TextureEntry): string {
    return `${e.path}|${this.store.stamp(e.path)}|${this.withEffects() ? this.fxKey : ''}`;
  }

  /** Cached thumbnail without waiting (null when it still needs decoding). */
  peek(e: TextureEntry): ImageData | null {
    return this.out.get(this.key(e)) ?? null;
  }

  get(e: TextureEntry): Promise<ImageData | null> {
    const key = this.key(e);
    const hit = this.out.get(key);
    if (hit) return Promise.resolve(hit);
    let p = this.inflight.get(key);
    if (!p) {
      p = this.limit(async () => {
        // a task per thumbnail: a screenful of them (with effects) doesn't hold up a tap
        await nextTask();
        const src = await this.source(e);
        if (!src) return null;
        let img = src;
        if (this.withEffects()) {
          const layers = this.store.project.effects;
          const ctx = { path: e.path, category: e.category, animated: false };
          if (effectsApply(layers, ctx)) {
            try {
              img = applyEffects(src, layers, ctx);
            } catch {
              img = src;
            }
          }
        }
        if (img.width > MAX_THUMB || img.height > MAX_THUMB) {
          const s = MAX_THUMB / Math.max(img.width, img.height);
          img = resizeSmooth(img, Math.max(1, Math.round(img.width * s)), Math.max(1, Math.round(img.height * s)));
        }
        this.out.set(key, img);
        return img;
      }).finally(() => this.inflight.delete(key));
      this.inflight.set(key, p);
    }
    return p;
  }

  private async source(e: TextureEntry): Promise<ImageData | null> {
    const k = `${e.path}|${this.store.stamp(e.path)}`;
    const hit = this.base.get(k);
    if (hit) return hit;
    try {
      let img = await this.store.getFull(e.path);
      if (e.animated || isBedrockStrip(e, img)) img = firstSquare(img);
      if (e.ext === 'tga') img = displayAlphaData(img, e.category);
      if (img.width > 256 || img.height > 256) {
        const s = 256 / Math.max(img.width, img.height);
        img = resizeSmooth(img, Math.max(1, Math.round(img.width * s)), Math.max(1, Math.round(img.height * s)));
      }
      this.base.set(k, img);
      return img;
    } catch {
      return null;
    }
  }

  clear(): void {
    this.base.clear();
    this.out.clear();
  }
}

/**
 * A small display canvas's 2D context, kept in memory (willReadFrequently): the browser then draws it
 * with the page instead of giving each one its own GPU layer, so a list of a hundred thumbnails
 * doesn't make every frame composite a hundred layers (slow taps on phones).
 */
export function thumbContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  return canvas.getContext('2d', { willReadFrequently: true });
}

/** Draws an ImageData into a canvas at its own size (display only). */
export function paintCanvas(canvas: HTMLCanvasElement, img: ImageData): void {
  if (canvas.width !== img.width) canvas.width = img.width;
  if (canvas.height !== img.height) canvas.height = img.height;
  const ctx = thumbContext(canvas);
  if (!ctx) return;
  ctx.clearRect(0, 0, img.width, img.height);
  ctx.putImageData(img, 0, 0);
}

const urls = new WeakMap<ImageData, string>();

/**
 * The image as a `data:` URL (an uncompressed 32-bit BMP with alpha: quick to make, and the browser
 * shows a data URL in the same frame). For lists of thumbnails: an <img> is painted with the page,
 * where every <canvas> needs a texture of its own from the GPU process (slow taps on phones when a
 * tap shows dozens of new tiles). Kept per ImageData, so a tile built again reuses it.
 */
export function thumbUrl(img: ImageData): string {
  let url = urls.get(img);
  if (url) return url;
  const w = img.width;
  const h = img.height;
  const HEAD = 14 + 108; // file header + BITMAPV4HEADER (bit masks with alpha)
  const bytes = new Uint8Array(HEAD + w * h * 4);
  const v = new DataView(bytes.buffer);
  v.setUint16(0, 0x4d42, true); // 'BM'
  v.setUint32(2, bytes.length, true);
  v.setUint32(10, HEAD, true);
  v.setUint32(14, 108, true);
  v.setInt32(18, w, true);
  v.setInt32(22, -h, true); // top-down rows
  v.setUint16(26, 1, true);
  v.setUint16(28, 32, true);
  v.setUint32(30, 3, true); // BI_BITFIELDS
  v.setUint32(34, w * h * 4, true);
  v.setUint32(54, 0x00ff0000, true);
  v.setUint32(58, 0x0000ff00, true);
  v.setUint32(62, 0x000000ff, true);
  v.setUint32(66, 0xff000000, true);
  v.setUint32(70, 0x73524742, true); // 'sRGB'
  const src = img.data;
  for (let i = 0, o = HEAD; i < src.length; i += 4, o += 4) {
    bytes[o] = src[i + 2];
    bytes[o + 1] = src[i + 1];
    bytes[o + 2] = src[i];
    bytes[o + 3] = src[i + 3];
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000) as unknown as number[]);
  url = `data:image/bmp;base64,${btoa(bin)}`;
  urls.set(img, url);
  return url;
}

/** A small crisp canvas showing an image, scaled with CSS. */
export function thumbCanvas(img: ImageData | null, cls = ''): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.className = `tx-thumb-canvas ${cls}`.trim();
  c.setAttribute('aria-hidden', 'true');
  if (img) paintCanvas(c, img);
  return c;
}
