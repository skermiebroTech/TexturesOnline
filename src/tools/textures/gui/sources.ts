// The pack's pictures for the GUI library and preview: each texture read once (the pack's copy, else
// the game's), kept as pixels and a canvas, swapped live while it is painted and read again when it
// changes. Also the sprites' stretch rules (.mcmeta / .json), the game's font, tinted, isometric and
// glinted variants, and the turning panorama. Anything that arrives later calls `onChange`.

import type { TextureCategory } from '../../../core/types';
import { createImageData } from '../../../core/pixels';
import { applyEffects, effectsApply } from '../effects';
import { categoryForPath, parseJsonLoose } from '../project';
import { renderIsoCube } from '../iso-cube';
import type { TexStore } from '../ui/store';
import { BEDROCK_TEXTURES, JAVA_TEXTURES, javaAtLeast, type GuiCatalog } from './catalog';
import { BitmapFont, bitmapProviders, legacyProvider, type BitmapProvider } from './font';
import { glintItem } from './glint';
import { panoramaYaw, renderPanorama } from './panorama';
import type { GuiImage, RenderSources } from './render';
import { bedrockScaling, javaScaling, type Scaling } from './scaling';

interface Entry {
  img: GuiImage | null;
  /** The image is being read */
  loading: boolean;
  /** Read failed or the texture doesn't exist */
  missing: boolean;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** A picture's pixels with a canvas holding them. */
export function toGuiImage(data: ImageData): GuiImage {
  const c = document.createElement('canvas');
  c.width = data.width;
  c.height = data.height;
  c.getContext('2d')!.putImageData(data, 0, 0);
  return { canvas: c, data, width: data.width, height: data.height };
}

export class GuiSources implements RenderSources {
  private readonly cache = new Map<string, Entry>();
  private readonly derived = new Map<string, { deps: (GuiImage | null)[]; out: CanvasImageSource }>();
  private readonly scales = new Map<string, Scaling | null | 'loading'>();
  /** Changes per picture (the font is measured again when one of its pictures changes) */
  private readonly stamps = new Map<string, number>();
  private seq = 0;
  private fontObj: BitmapFont | null = null;
  private fontKey = '';
  private providers: BitmapProvider[] | null = null;
  private providersLoading = false;
  private glintCanvas = new Map<string, HTMLCanvasElement>();
  private panoCanvas: HTMLCanvasElement | null = null;
  private panoData: ImageData | null = null;
  private readonly offs: (() => void)[] = [];
  private changeTimer: ReturnType<typeof setTimeout> | null = null;
  /** Show the pack's effects (when it has any) */
  effects = true;
  /** Called (shortly) after pictures arrive or change */
  onChange: () => void = () => undefined;

  constructor(
    readonly store: TexStore,
    readonly cat: GuiCatalog,
  ) {
    this.offs.push(
      store.events.on('image', ({ path, full }) => {
        if (!this.cache.has(path)) return;
        this.set(path, full);
        this.changed(0);
      }),
      store.events.on('overrides', ({ path }) => {
        if (!this.cache.has(path)) return;
        this.forget(path);
        this.changed();
      }),
      store.events.on('effects', () => {
        this.reload();
      }),
      store.events.on('meta', () => this.changed()),
    );
  }

  private get root(): string {
    return this.cat.edition === 'java' ? JAVA_TEXTURES : BEDROCK_TEXTURES;
  }

  private changed(ms = 30): void {
    if (this.changeTimer) return;
    this.changeTimer = setTimeout(() => {
      this.changeTimer = null;
      this.onChange();
    }, ms);
  }

  private fxOn(): boolean {
    return this.effects && this.store.effectsActive();
  }

  private withEffects(path: string, img: ImageData): ImageData {
    if (!this.fxOn()) return img;
    const category: TextureCategory = this.store.byPath.get(path)?.category ?? categoryForPath(path, this.cat.edition);
    const ctx = { path, category };
    if (!effectsApply(this.store.project.effects, ctx)) return img;
    try {
      return applyEffects(img, this.store.project.effects, ctx);
    } catch {
      return img;
    }
  }

  private set(path: string, full: ImageData): void {
    this.cache.set(path, { img: toGuiImage(this.withEffects(path, full)), loading: false, missing: false });
    this.stamps.set(path, ++this.seq);
    this.dropDerived(path);
  }

  private dropDerived(path: string): void {
    for (const k of [...this.derived.keys()]) if (k.includes(path)) this.derived.delete(k);
    if (path.includes('/font/')) this.fontKey = '';
  }

  /** Reads a texture again (it changed). */
  forget(path: string): void {
    this.cache.delete(path);
    this.scales.delete(path);
    this.dropDerived(path);
  }

  /** Reads every texture again (effects switched). */
  reload(): void {
    this.cache.clear();
    this.derived.clear();
    this.fontKey = '';
    this.changed(0);
  }

  /** Whether the pack or the game has a texture. */
  has(path: string): boolean {
    return !!this.store.project.overrides[path] || this.store.assets.hasFile(path);
  }

  image(path: string): GuiImage | null {
    const e = this.cache.get(path);
    if (e) return e.img;
    this.cache.set(path, { img: null, loading: true, missing: false });
    void this.store
      .getFull(path)
      .then((full) => {
        if (this.cache.get(path)?.loading) {
          this.set(path, full);
          this.changed();
        }
      })
      .catch(() => {
        this.cache.set(path, { img: null, loading: false, missing: true });
      });
    return null;
  }

  /** The image, read now if needed (thumbnails). */
  async load(path: string): Promise<GuiImage | null> {
    const have = this.image(path);
    if (have) return have;
    try {
      const full = await this.store.getFull(path);
      if (!this.cache.get(path)?.img) this.set(path, full);
      return this.cache.get(path)?.img ?? null;
    } catch {
      return null;
    }
  }

  pick(...names: string[]): string | null {
    for (const n of names) {
      for (const ext of this.cat.edition === 'java' ? ['png'] : ['png', 'tga']) {
        const path = `${this.root}${n}.${ext}`;
        if (this.has(path)) return path;
      }
    }
    return null;
  }

  private memo(key: string, deps: (GuiImage | null)[], make: () => CanvasImageSource | null): CanvasImageSource | null {
    const hit = this.derived.get(key);
    if (hit && hit.deps.length === deps.length && hit.deps.every((d, i) => d === deps[i])) return hit.out;
    const out = make();
    if (out) this.derived.set(key, { deps, out });
    return out;
  }

  tinted(path: string, rgb: [number, number, number]): CanvasImageSource | null {
    const img = this.image(path);
    if (!img) return null;
    return this.memo(`tint|${path}|${rgb.join(',')}`, [img], () => {
      const d = new Uint8ClampedArray(img.data.data);
      for (let i = 0; i < d.length; i += 4) {
        d[i] = (d[i] * rgb[0]) / 255;
        d[i + 1] = (d[i + 1] * rgb[1]) / 255;
        d[i + 2] = (d[i + 2] * rgb[2]) / 255;
      }
      return toGuiImage(createImageData(img.width, img.height, d)).canvas;
    });
  }

  iso(top: string, side: string): CanvasImageSource | null {
    const t = this.image(top);
    const s = this.image(side);
    if (!t || !s) return null;
    return this.memo(`iso|${top}|${side}`, [t, s], () => {
      const sq = (g: GuiImage) => (g.height > g.width ? createImageData(g.width, g.width, g.data.data.slice(0, g.width * g.width * 4)) : g.data);
      return toGuiImage(renderIsoCube(sq(t), sq(s), 64)).canvas;
    });
  }

  /** The glint texture of items (null: the version has none). */
  private glintImage(): GuiImage | null {
    const p = this.cat.piece('glint.item');
    return p ? this.image(p.path) : null;
  }

  glinted(path: string, px: number, time: number): CanvasImageSource | null {
    const item = this.image(path);
    if (!item) return null;
    const frame = item.height > item.width ? createImageData(item.width, item.width, item.data.data.slice(0, item.width * item.width * 4)) : item.data;
    const scale = Math.max(1, Math.round(px / frame.width));
    const legacy = this.cat.edition === 'java' && !javaAtLeast(this.cat.version, '1.15');
    const out = glintItem(frame, this.glintImage()?.data ?? null, scale, { time, legacy });
    const key = `${path}|${out.width}`;
    let c = this.glintCanvas.get(key);
    if (!c) {
      c = document.createElement('canvas');
      this.glintCanvas.set(key, c);
    }
    if (c.width !== out.width || c.height !== out.height) {
      c.width = out.width;
      c.height = out.height;
    }
    c.getContext('2d')!.putImageData(out, 0, 0);
    return c;
  }

  /** The six panorama faces (null where one is missing or still loading). */
  panoramaFaces(): (ImageData | null)[] {
    return (['front', 'right', 'back', 'left', 'top', 'bottom'] as const).map((k) => {
      const p = this.cat.piece(`panorama.${k}`);
      const img = p ? this.image(p.path) : null;
      return img && img.width > 2 ? img.data : null;
    });
  }

  /** Whether the panorama is only the jar's stand-ins (it couldn't be downloaded). */
  panoramaMissing(): boolean {
    const p = this.cat.piece('panorama.front');
    const img = p ? this.image(p.path) : null;
    return !!img && img.width <= 2;
  }

  panorama(w: number, h: number, time: number): CanvasImageSource | null {
    const faces = this.panoramaFaces();
    if (faces.every((f) => !f)) return null;
    // a little smaller than the screen: the game blurs it anyway
    const pw = Math.max(16, Math.min(480, Math.round(w)));
    const ph = Math.max(12, Math.round((pw * h) / w));
    if (!this.panoData || this.panoData.width !== pw || this.panoData.height !== ph) this.panoData = createImageData(pw, ph);
    renderPanorama(this.panoData, faces, { yaw: panoramaYaw(time), pitch: -10, fov: 85 });
    if (!this.panoCanvas) this.panoCanvas = document.createElement('canvas');
    if (this.panoCanvas.width !== pw || this.panoCanvas.height !== ph) {
      this.panoCanvas.width = pw;
      this.panoCanvas.height = ph;
    }
    this.panoCanvas.getContext('2d')!.putImageData(this.panoData, 0, 0);
    return this.panoCanvas;
  }

  scaling(path: string): Scaling | null {
    const have = this.scales.get(path);
    if (have !== undefined) return have === 'loading' ? null : have;
    this.scales.set(path, 'loading');
    const meta = this.cat.edition === 'java' ? `${path}.mcmeta` : path.replace(/\.(png|tga)$/i, '.json');
    void this.readText(meta).then((text) => {
      let sc: Scaling | null = null;
      if (text) {
        const json = parseJsonLoose(text);
        if (this.cat.edition === 'java') sc = javaScaling(json);
        else {
          const img = this.cache.get(path)?.img;
          sc = bedrockScaling(json, img ?? { width: 0, height: 0 });
        }
      }
      this.scales.set(path, sc);
      this.changed();
    });
    return null;
  }

  /** A text file of the pack, else of the game (null: neither has it). */
  async readText(path: string): Promise<string | null> {
    const own = this.store.project.extraFiles[path];
    if (own) return own.text().catch(() => null);
    if (!this.store.assets.hasFile(path)) return null;
    return this.store.assets.readText(path).catch(() => null);
  }

  font(): BitmapFont | null {
    if (!this.providers) {
      void this.loadProviders();
      return null;
    }
    const imgs = this.providers.map((p) => this.image(p.path));
    if (!imgs.some(Boolean)) return null;
    const stamp = this.providers.map((p) => this.stamps.get(p.path) ?? 0).join(',');
    if (this.fontObj && this.fontKey === stamp) return this.fontObj;
    this.fontObj = new BitmapFont(this.providers, (path) => this.cache.get(path)?.img?.data ?? null);
    this.fontKey = stamp;
    return this.fontObj;
  }

  private async loadProviders(): Promise<void> {
    if (this.providersLoading) return;
    this.providersLoading = true;
    let providers: BitmapProvider[] = [];
    if (this.cat.edition === 'java') {
      const files = new Map<string, unknown>();
      const want = ['assets/minecraft/font/default.json'];
      for (let i = 0; i < want.length && i < 8; i++) {
        const text = await this.readText(want[i]);
        const json = text ? parseJsonLoose(text) : undefined;
        files.set(want[i], json);
        const list = isObj(json) && Array.isArray(json.providers) ? json.providers : [];
        for (const p of list) {
          if (isObj(p) && p.type === 'reference' && typeof p.id === 'string') {
            const [ns, rest] = p.id.includes(':') ? p.id.split(':', 2) : ['minecraft', p.id];
            const path = `assets/${ns}/font/${rest}.json`;
            if (!want.includes(path)) want.push(path);
          }
        }
      }
      if (files.get(want[0])) providers = bitmapProviders(files.get(want[0]), (p) => files.get(p)).filter((p) => this.has(p.path));
      if (!providers.length && this.has(`${JAVA_TEXTURES}font/ascii.png`)) providers = [legacyProvider(`${JAVA_TEXTURES}font/ascii.png`)];
    } else {
      const p = this.pick('font/default8');
      if (p) providers = [legacyProvider(p)];
    }
    this.providers = providers;
    this.changed(0);
  }

  destroy(): void {
    this.offs.forEach((f) => f());
    if (this.changeTimer) clearTimeout(this.changeTimer);
    this.cache.clear();
    this.derived.clear();
  }
}
