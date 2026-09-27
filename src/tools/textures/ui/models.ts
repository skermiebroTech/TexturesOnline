// Model support for the texture pack editor: loads the version's block / item model library, turns a
// resolved model into a 3D scene made of the pack's own textures (edits, effects, animation strips,
// biome colours from the pack's colour maps) and draws inventory-style icons for the browser.

import type { Progress } from '../../../core/types';
import { Emitter } from '../../../core/events';
import { createImageData, resizeNearest } from '../../../core/image';
import { friendlyError } from '../../../core/net';
import { prefetchJavaGroups } from '../../../editions/java/assets';
import { loadModelLibrary, type ModelEntry, type ModelLibrary, type ModelView, type Tint } from '../../../shared/models/index';
import { extrudeSprite } from '../../../shared/models/sprite';
import { DEFAULT_BIOME_COLORS, tintColor, type BiomeColors } from '../../../shared/models/tints';
import type { ModelIconRenderer } from '../../../shared/models/model-icons';
import type { ModelScene } from '../../../shared/preview/block-preview';
import type { ModelTextureImage } from '../../../shared/models/model-mesh';
import { sampleColormap } from '../../../shared/preview/preview-textures';
import { applyEffects, effectsApply } from '../effects';
import { displayAlphaData, getFrame, makeEntry, readAnimInfo, type AnimInfo } from './meta';
import type { TexStore } from './store';

export interface LiveTexture {
  path: string;
  full: ImageData;
  anim: AnimInfo | null;
}

export interface BuiltScene {
  scene: ModelScene;
  view: 'block' | 'item';
  /** Flat image for 'special' entries (the game's own model code) */
  flat?: ImageData;
}

type Icon = HTMLCanvasElement | ImageData;

const ICON_SIZE = 96;

export class ModelService {
  readonly events = new Emitter<{ progress: Progress; ready: void; failed: string; usage: void }>();
  lib: ModelLibrary | null = null;
  error: string | null = null;
  private loading: Promise<ModelLibrary | null> | null = null;
  private biomeP: Promise<Partial<BiomeColors>> | null = null;
  private anims = new Map<string, AnimInfo | null>();
  private iconRenderer: Promise<ModelIconRenderer | null> | null = null;
  private iconCache = new Map<string, Icon>();
  private iconWaits = new Map<string, Promise<Icon | null>>();
  private iconQueue: Promise<unknown> = Promise.resolve();
  private viewPaths = new Map<string, string[]>();
  private disposed = false;

  constructor(private readonly store: TexStore) {}

  /** Loads the model library once (Java downloads its model files on first use). */
  load(): Promise<ModelLibrary | null> {
    if (!this.loading) {
      this.error = null;
      this.loading = loadModelLibrary(this.store.assets, {
        onProgress: (p) => this.events.emit('progress', p),
        prefetch: (groups, opts) => prefetchJavaGroups(this.store.assets, groups, opts),
      }).then(
        (lib) => {
          this.lib = lib;
          this.events.emit('ready');
          // Which blocks use which texture: built in slices so the editor stays responsive.
          void lib.usageAsync().then(() => {
            if (!this.disposed) this.events.emit('usage');
          });
          return lib;
        },
        (err) => {
          console.error(err);
          this.error = friendlyError(err);
          this.loading = null;
          this.events.emit('failed', this.error);
          return null;
        },
      );
    }
    return this.loading;
  }

  get effectsKey(): string {
    return this.store.effectsActive() ? JSON.stringify(this.store.project.effects.filter((l) => l.enabled).map((l) => [l.type, l.params, l.categories ?? null])) : '';
  }

  // ------------------------------------------------------------------ colours

  /** Grass / foliage colours sampled from the pack's colour maps (with effects), like the texture preview. */
  biome(fx: boolean): Promise<Partial<BiomeColors>> {
    if (!this.biomeP) {
      this.biomeP = (async () => {
        const root = this.store.project.edition === 'java' ? 'assets/minecraft/textures/' : 'textures/';
        const read = async (name: string) => {
          const p = `${root}colormap/${name}.png`;
          if (!this.store.assets.hasFile(p) && !this.store.isEdited(p)) return undefined;
          try {
            const img = this.fx(await this.store.getFull(p), p, false, fx);
            return sampleColormap(img, 0.8, 0.4) ?? undefined;
          } catch {
            return undefined;
          }
        };
        const [grass, foliage, dry] = await Promise.all([read('grass'), read('foliage'), read('dry_foliage')]);
        return { grass, foliage, dry_foliage: dry };
      })();
    }
    return this.biomeP;
  }

  resetBiome(): void {
    this.biomeP = null;
  }

  tintFn(biome: Partial<BiomeColors>): (t: Tint) => [number, number, number] {
    const b: Partial<BiomeColors> = {};
    for (const k of Object.keys(DEFAULT_BIOME_COLORS) as (keyof BiomeColors)[]) if (biome[k]) b[k] = biome[k];
    return (t) => tintColor(t, b);
  }

  // ------------------------------------------------------------------ textures

  private fx(img: ImageData, path: string, animated: boolean, on: boolean): ImageData {
    if (!on || !this.store.effectsActive()) return img;
    const e = this.store.byPath.get(path);
    const ctx = { path, category: e?.category ?? 'block', animated };
    if (!effectsApply(this.store.project.effects, ctx)) return img;
    try {
      return applyEffects(img, this.store.project.effects, ctx);
    } catch {
      return img;
    }
  }

  private async animOf(path: string, full: ImageData): Promise<AnimInfo | null> {
    const key = `${path}|${full.width}x${full.height}`;
    if (this.anims.has(key)) return this.anims.get(key)!;
    const entry = this.store.byPath.get(path) ?? makeEntry({ path, id: path, name: path, category: 'block', ext: path.endsWith('.tga') ? 'tga' : 'png' }, true);
    let anim: AnimInfo | null = null;
    try {
      const vanilla = await this.store.getVanilla(path);
      anim = await readAnimInfo(this.store.project, this.store.assets, entry, full, vanilla?.width ?? null);
      if (anim?.still) anim = null;
    } catch {
      anim = null;
    }
    this.anims.set(key, anim);
    return anim;
  }

  /** A texture as the 3D view needs it: a strip of square frames, effects applied, alpha data made visible. */
  textureFromPixels(path: string, full: ImageData, anim: AnimInfo | null, opts: { fx: boolean; mask?: boolean }): ModelTextureImage {
    let img = full;
    let frames = 1;
    let frametime = 0;
    if (anim && anim.count > 1) {
      if (anim.cols === 1 && anim.frameW === full.width && anim.frameH === anim.frameW) {
        frames = anim.count;
      } else if (anim.frameW === anim.frameH) {
        const strip = createImageData(anim.frameW, anim.frameH * anim.count);
        for (let i = 0; i < anim.count; i++) strip.data.set(getFrame(full, anim, i).data, i * anim.frameW * anim.frameH * 4);
        img = strip;
        frames = anim.count;
      } else img = getFrame(full, anim, 0);
      frametime = frames > 1 ? anim.frametime : 0;
    } else if (full.height > full.width && full.height % full.width === 0) {
      img = getFrame(full, { frameW: full.width, frameH: full.width, count: full.height / full.width, cols: 1, frametime: 1, sequence: [] }, 0);
    }
    img = this.fx(img, path, frames > 1, opts.fx);
    if (/\.tga$/i.test(path) && !opts.mask) img = displayAlphaData(img, this.store.byPath.get(path)?.category ?? 'block');
    // Very large textures are only a preview here: keep uploads small.
    if (img.width > 512 && frames === 1) img = resizeNearest(img, 512, Math.max(1, Math.round((img.height * 512) / img.width)));
    return { image: img, frames, frametime };
  }

  async texture(path: string, opts: { fx: boolean; mask?: boolean; live?: LiveTexture | null }): Promise<ModelTextureImage | null> {
    try {
      if (opts.live && opts.live.path === path) return this.textureFromPixels(path, opts.live.full, opts.live.anim, opts);
      const full = await this.store.getFull(path);
      return this.textureFromPixels(path, full, await this.animOf(path, full), opts);
    } catch {
      return null;
    }
  }

  /** Scene for a resolved model: its quads (extruded for flat items) plus every texture image. */
  async scene(view: ModelView, opts: { fx: boolean; live?: LiveTexture | null }): Promise<BuiltScene | null> {
    const biome = await this.biome(opts.fx);
    const tint = this.tintFn(biome);
    if (view.shape === 'special') {
      const first = view.sprite[0];
      if (!first) return null;
      const t = await this.texture(first.path, opts);
      return t ? { scene: { quads: [], textures: new Map(), tint }, view: 'item', flat: firstFrame(t) } : null;
    }
    const textures = new Map<string, ModelTextureImage>();
    if (view.shape === 'sprite') {
      const layers = [];
      for (const s of view.sprite) {
        const t = await this.texture(s.path, opts);
        if (!t) continue;
        textures.set(s.path, t);
        layers.push({ ...s, image: firstFrame(t) });
      }
      if (!layers.length) return null;
      return { scene: { quads: extrudeSprite(layers), textures, tint }, view: 'item' };
    }
    const masks = new Set(view.quads.filter((q) => q.tintMask && q.texture).map((q) => q.texture!));
    const paths = [...new Set(view.quads.map((q) => q.texture).filter((p): p is string => !!p))];
    await Promise.all(
      paths.map(async (p) => {
        if (!this.store.assets.hasFile(p) && !this.store.isEdited(p)) return;
        const t = await this.texture(p, { ...opts, mask: masks.has(p) });
        if (t) textures.set(p, t);
      }),
    );
    return { scene: { quads: view.quads, textures, tint }, view: view.entry.kind === 'item' ? 'item' : 'block' };
  }

  // ------------------------------------------------------------------ icons

  /** The shared icon renderer, loaded with the 3D code on first use (null without WebGL). */
  private renderer(): Promise<ModelIconRenderer | null> {
    this.iconRenderer ??= import('../../../shared/models/model-icons')
      .then((m) => {
        if (this.disposed) return null;
        const r = new m.ModelIconRenderer(ICON_SIZE);
        return r.available ? r : null;
      })
      .catch(() => null);
    return this.iconRenderer;
  }

  private pathsOf(entry: ModelEntry): string[] {
    const k = `${entry.kind}:${entry.id}`;
    let p = this.viewPaths.get(k);
    if (!p && this.lib) {
      try {
        const e = (entry.kind === 'block' && this.lib.item(entry.id)) || entry;
        const v = this.lib.resolve(e, this.lib.defaultState(e));
        p = [...new Set([...v.quads.map((q) => q.texture).filter((x): x is string => !!x), ...v.sprite.map((s) => s.path)])];
      } catch {
        p = [];
      }
      this.viewPaths.set(k, p);
    }
    return p ?? [];
  }

  /** Cache key of an entry's icon: changes when any of its textures or the effects change. */
  iconKey(entry: ModelEntry, fx: boolean): string {
    const stamps = this.pathsOf(entry).map((p) => this.store.stamp(p)).join('.');
    return `${entry.kind}:${entry.id}|${stamps}|${fx ? this.effectsKey : ''}`;
  }

  peekIcon(entry: ModelEntry, fx: boolean): Icon | null {
    return this.iconCache.get(this.iconKey(entry, fx)) ?? null;
  }

  /** Inventory-style icon (3D for block models, the sprite for items, the texture sheet for special blocks). */
  icon(entry: ModelEntry, fx: boolean): Promise<Icon | null> {
    const key = this.iconKey(entry, fx);
    const hit = this.iconCache.get(key);
    if (hit) return Promise.resolve(hit);
    let p = this.iconWaits.get(key);
    if (!p) {
      const run = async (): Promise<Icon | null> => {
        if (this.disposed || !this.lib) return null;
        // Blocks look like their item in the inventory (doors and torches are flat sprites there).
        const asItem = entry.kind === 'block' ? this.lib.item(entry.id) : undefined;
        let view = this.lib.resolve(asItem ?? entry, this.lib.defaultState(asItem ?? entry));
        if (asItem && view.shape === 'special' && !view.sprite.length) view = this.lib.resolve(entry, this.lib.defaultState(entry));
        const built = await this.scene(view, { fx });
        let icon: Icon | null = null;
        if (built?.flat) icon = built.flat;
        else if (built && built.view === 'item' && view.shape === 'sprite') icon = composeSprite(built.scene, view);
        else if (built) icon = (await this.renderer())?.render(built.scene) ?? null;
        if (!icon) {
          const thumb = this.lib.thumbnail(entry);
          if (thumb) {
            const t = await this.texture(thumb, { fx });
            if (t) icon = firstFrame(t);
          }
        }
        if (icon) {
          this.iconCache.set(key, icon);
          if (this.iconCache.size > 400) this.iconCache.delete(this.iconCache.keys().next().value!);
        }
        return icon;
      };
      // One at a time: the icon renderer is shared, and thumbnails shouldn't starve the editor.
      p = this.iconQueue.then(run, run).finally(() => this.iconWaits.delete(key));
      this.iconQueue = p.catch(() => undefined);
      this.iconWaits.set(key, p);
    }
    return p;
  }

  /** Blocks / items whose icon shows a texture (for refreshing after an edit). */
  entriesUsing(path: string): ModelEntry[] {
    if (!this.lib?.usageReady) return [];
    const u = this.lib.usageOf(path);
    return [...u.blocks.map((id) => this.lib!.block(id)), ...u.items.map((id) => this.lib!.item(id))].filter((e): e is ModelEntry => !!e);
  }

  dispose(): void {
    this.disposed = true;
    void this.iconRenderer?.then((r) => r?.dispose());
    this.iconCache.clear();
  }
}

export function firstFrame(t: ModelTextureImage): ImageData {
  const img = t.image;
  const h = Math.floor(img.height / Math.max(1, t.frames));
  const out = createImageData(img.width, h);
  out.data.set(img.data.subarray(0, img.width * h * 4));
  return out;
}

/** Flat item icon: layers drawn over each other with their tints, like the inventory. */
function composeSprite(scene: ModelScene, view: ModelView): ImageData | null {
  const layers = view.sprite.map((s) => ({ s, t: scene.textures.get(s.path) })).filter((x) => x.t);
  if (!layers.length) return null;
  const base = firstFrame(layers[0].t!);
  const out = createImageData(base.width, base.height);
  for (const { s, t } of layers) {
    let img = firstFrame(t!);
    if (img.width !== out.width || img.height !== out.height) img = resizeNearest(img, out.width, out.height);
    const rgb = s.tint ? scene.tint(s.tint) : null;
    const d = img.data;
    const o = out.data;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3] / 255;
      if (!a) continue;
      const r = rgb ? (d[i] * rgb[0]) / 255 : d[i];
      const g = rgb ? (d[i + 1] * rgb[1]) / 255 : d[i + 1];
      const b = rgb ? (d[i + 2] * rgb[2]) / 255 : d[i + 2];
      const oa = o[i + 3] / 255;
      const na = a + oa * (1 - a);
      o[i] = (r * a + o[i] * oa * (1 - a)) / na;
      o[i + 1] = (g * a + o[i + 1] * oa * (1 - a)) / na;
      o[i + 2] = (b * a + o[i + 2] * oa * (1 - a)) / na;
      o[i + 3] = na * 255;
    }
  }
  return out;
}
