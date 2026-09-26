// Thumbnail pipeline for the texture browser: decode on demand (limited concurrency), first frame,
// optional effect preview, byte-bounded LRU caches for decoded and processed images.

import { createLimiter } from '../../../core/net';
import { resizeSmooth } from '../../../core/image';
import { applyEffects, effectsApply } from '../effects';
import { firstSquare, type TextureEntry } from './meta';
import type { TexStore } from './store';

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
      if (e.animated) img = firstSquare(img);
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

/** Draws an ImageData into a canvas at its own size (display only). */
export function paintCanvas(canvas: HTMLCanvasElement, img: ImageData): void {
  if (canvas.width !== img.width) canvas.width = img.width;
  if (canvas.height !== img.height) canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, img.width, img.height);
  ctx.putImageData(img, 0, 0);
}

/** A small crisp canvas showing an image, scaled with CSS. */
export function thumbCanvas(img: ImageData | null, cls = ''): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.className = `tx-thumb-canvas ${cls}`.trim();
  c.setAttribute('aria-hidden', 'true');
  if (img) paintCanvas(c, img);
  return c;
}
