// Editor state for one texture pack project: the texture list, pending edits, debounced autosave to
// IndexedDB and the events the panels listen to.

import type { AssetIndex, CustomModel, NameVariant, PbrMaterial, TextureAnimation, TexturePackProject } from '../../../core/types';
import { Emitter } from '../../../core/events';
import { saveProject } from '../../../core/storage';
import { decodeImage, encodePng } from '../../../core/image';
import { friendlyError } from '../../../core/net';
import { categoryForPath, getBaseImage, isEdited, removeOverride, setOverride } from '../project';
import { hasActiveEffects } from '../effects';
import { buildEntries, makeEntry, type TextureEntry } from './meta';
import { customModelKey, resetCustomModel, writeCustomModel } from '../models/pack';
import { isPlain, type LayerStack } from '../layers/stack';
import { recordOf, stackOf } from '../layers/record';
import { te } from './i18n/editor';

export type SaveState = 'saved' | 'saving' | 'dirty' | 'error';
export const ICON_KEY = '@icon';

export interface EditorEvents extends Record<string, unknown> {
  /** A texture's edited state or pixels changed (thumbnails, badges) */
  overrides: { path: string };
  /** Live pixels of the open texture changed (previews) */
  image: { path: string; full: ImageData };
  effects: void;
  /** Name, description, icon, version, compat, resolution */
  meta: void;
  save: SaveState;
  entries: void;
  /** Model, blockstate or item definition files changed (the model editor): paths written or removed */
  models: { paths: string[]; entries: { kind: 'block' | 'item'; id: string }[] };
  /** PBR materials changed (the Material tab): the colour textures they belong to */
  pbr: { paths: string[] };
  /** Name-based looks of items changed (project.nameVariants): their ids */
  names: { ids: string[] };
  /** A texture's animation was made, changed or removed (project.animations) */
  animation: { path: string };
  /**
   * A texture painted on layers was rewritten without them (reset, a tweak, a copy put back...):
   * its layers are gone, and an editor holding them must not write them back.
   */
  layersDropped: { path: string };
}

/** Paint layer stacks kept decoded for textures that aren't being saved (besides those that are) */
const KEPT_LAYER_STACKS = 6;

const SAVE_DELAY = 700;

export class TexStore {
  readonly events = new Emitter<EditorEvents>();
  entries: TextureEntry[] = [];
  byPath = new Map<string, TextureEntry>();
  saveState: SaveState = 'saved';
  lastError = '';

  private stamps = new Map<string, number>();
  private pending = new Map<string, ImageData>();
  private pendingIcon: ImageData | null = null;
  private metaDirty = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing: Promise<void> | null = null;
  private again = false;
  private discarded = false;
  private vanillaCache = new Map<string, Promise<ImageData | null>>();
  /** Paint layers in memory: being painted, waiting to be saved, or read lately */
  private layerStacks = new Map<string, LayerStack>();
  /** Textures whose layers (null: none any more) are waiting to be saved, with a change counter */
  private pendingLayers = new Map<string, number>();
  /** Changes to the pixels of layer images (painting changes them in place) */
  private layerRevs = new WeakMap<ImageData, number>();
  /** PNGs made of layer images, reused while they don't change */
  private layerPngs = new WeakMap<ImageData, { rev: number; blob: Blob }>();

  constructor(
    readonly project: TexturePackProject,
    readonly assets: AssetIndex,
  ) {
    this.rebuildEntries();
  }

  rebuildEntries(): void {
    this.entries = buildEntries(this.project, this.assets, categoryForPath, this.pending.keys());
    this.byPath = new Map(this.entries.map((e) => [e.path, e]));
    this.events.emit('entries');
  }

  /** Adds a custom texture entry (e.g. a pasted texture for a path the version doesn't have). */
  ensureEntry(path: string): TextureEntry | undefined {
    const known = this.byPath.get(path);
    if (known) return known;
    if (path === ICON_KEY) return undefined;
    this.rebuildEntries();
    return this.byPath.get(path) ?? makeEntry({ path, id: path, name: path, category: 'other', ext: 'png' }, true);
  }

  // ---- edited state ----

  isEdited(path: string): boolean {
    return this.pending.has(path) || isEdited(this.project, path);
  }

  editedCount(): number {
    const set = new Set([...Object.keys(this.project.overrides), ...this.pending.keys()]);
    return set.size;
  }

  editedPaths(): Set<string> {
    return new Set([...Object.keys(this.project.overrides), ...this.pending.keys()]);
  }

  stamp(path: string): number {
    return this.stamps.get(path) ?? 0;
  }

  private bump(path: string): void {
    this.stamps.set(path, this.stamp(path) + 1);
  }

  effectsActive(): boolean {
    return hasActiveEffects(this.project.effects);
  }

  // ---- images ----

  /** The pack's version of a texture (pending edit, saved edit, else vanilla). */
  async getFull(path: string): Promise<ImageData> {
    if (path === ICON_KEY) {
      if (this.pendingIcon) return this.pendingIcon;
      if (this.project.icon) return decodeImage(this.project.icon, 'png');
      throw new Error(te.noIcon);
    }
    const p = this.pending.get(path);
    if (p) return p;
    return getBaseImage(this.project, this.assets, path);
  }

  /** Vanilla pixels of a texture, or null when the game version doesn't have it. */
  getVanilla(path: string): Promise<ImageData | null> {
    if (!this.assets.hasFile(path)) return Promise.resolve(null);
    let p = this.vanillaCache.get(path);
    if (!p) {
      p = this.assets.readImage(path).catch(() => null);
      this.vanillaCache.set(path, p);
      if (this.vanillaCache.size > 64) this.vanillaCache.delete(this.vanillaCache.keys().next().value!);
    }
    return p;
  }

  // ---- edits ----

  /**
   * Records new pixels for a texture (saved shortly after). Its paint layers no longer make these
   * pixels and are dropped, unless `keepLayers` (the pixel editor, which sets the layers too).
   */
  setImage(path: string, full: ImageData, opts: { keepLayers?: boolean } = {}): void {
    if (path === ICON_KEY) {
      this.pendingIcon = full;
      this.metaDirty = true;
      this.schedule();
      this.events.emit('meta');
      return;
    }
    const wasEdited = this.isEdited(path);
    const dropped = !opts.keepLayers && this.dropLayers(path);
    this.pending.set(path, full);
    this.bump(path);
    if (!wasEdited && !this.byPath.has(path)) this.rebuildEntries();
    this.schedule();
    this.events.emit('overrides', { path });
    if (dropped) this.events.emit('layersDropped', { path });
  }

  /** Back to vanilla (drops the pack's copy, and the animation made for it). */
  resetToVanilla(path: string): void {
    this.pending.delete(path);
    const dropped = this.dropLayers(path);
    removeOverride(this.project, path);
    if (this.project.animations?.[path]) this.setAnimation(path, null);
    this.bump(path);
    this.metaDirty = true;
    this.schedule();
    this.events.emit('overrides', { path });
    if (dropped) this.events.emit('layersDropped', { path });
  }

  /** Puts a stored copy of a texture back as it was (null: none, the game's own texture shows). */
  setOverrideBlob(path: string, blob: Blob | null): void {
    this.pending.delete(path);
    const dropped = this.dropLayers(path);
    if (blob) this.project.overrides[path] = blob;
    else removeOverride(this.project, path);
    this.bump(path);
    this.metaDirty = true;
    this.schedule();
    // a texture the game doesn't have comes and goes from the list with its copy
    if (!this.assets.hasFile(path)) this.rebuildEntries();
    this.events.emit('overrides', { path });
    if (dropped) this.events.emit('layersDropped', { path });
  }

  /**
   * Writes (blob) or removes (null) files of the pack other than textures: models, .mcmeta. Model
   * files are read again by the previews; `entries` are the blocks and items they show.
   */
  setExtraFiles(files: Record<string, Blob | null>, entries: { kind: 'block' | 'item'; id: string }[] = []): void {
    const paths = Object.keys(files);
    if (!paths.length) return;
    for (const [path, blob] of Object.entries(files)) {
      if (blob) this.project.extraFiles[path] = blob;
      else delete this.project.extraFiles[path];
    }
    this.touch();
    if (paths.some((p) => /\/(models|blockstates|items)\//.test(p))) this.events.emit('models', { paths, entries });
  }

  setIconBlob(blob: Blob | undefined): void {
    this.pendingIcon = null;
    this.project.icon = blob;
    this.touch();
    this.events.emit('meta');
  }

  // ---- custom models (files in extraFiles) ----

  /** Saves a model's files (model, item definition, blockstate) into the pack. */
  saveModel(info: Omit<CustomModel, 'files' | 'originals' | 'updatedAt'>, files: Record<string, string>): void {
    const before = this.project.customModels?.[customModelKey(info.model)]?.files ?? [];
    const saved = writeCustomModel(this.project, info, files);
    const paths = [...new Set([...before, ...saved.files])];
    this.touch();
    this.events.emit('models', { paths, entries: [{ kind: info.kind, id: info.id }] });
  }

  /** Puts back the pack's own (or the game's) model. */
  resetModel(model: string): boolean {
    const info = Object.values(this.project.customModels ?? {}).find((m) => m.model === model);
    if (!info || !resetCustomModel(this.project, model)) return false;
    this.touch();
    this.events.emit('models', { paths: [...info.files], entries: [{ kind: info.kind, id: info.id }] });
    return true;
  }

  // ---- PBR materials (project.pbr) ----

  material(path: string): PbrMaterial | undefined {
    return this.project.pbr?.[path];
  }

  /** Sets (or with null removes) the materials of textures. */
  setMaterials(changes: Record<string, PbrMaterial | null>): void {
    const paths = Object.keys(changes);
    if (!paths.length) return;
    const pbr = (this.project.pbr ??= {});
    for (const [path, m] of Object.entries(changes)) {
      if (m) pbr[path] = { ...m, updatedAt: Date.now() };
      else delete pbr[path];
    }
    if (!Object.keys(pbr).length) delete this.project.pbr;
    this.touch();
    this.events.emit('pbr', { paths });
  }

  // ---- name-based looks (project.nameVariants) ----

  /** Sets (or with null removes) looks items get from their name. */
  setNameVariants(changes: Record<string, NameVariant | null>): void {
    const ids = Object.keys(changes);
    if (!ids.length) return;
    const all = (this.project.nameVariants ??= {});
    for (const [id, v] of Object.entries(changes)) {
      if (v) all[id] = { ...v, names: [...v.names], updatedAt: Date.now() };
      else delete all[id];
    }
    if (!Object.keys(all).length) delete this.project.nameVariants;
    this.touch();
    this.events.emit('names', { ids });
  }

  // ---- animations (project.animations) ----

  animation(path: string): TextureAnimation | undefined {
    return this.project.animations?.[path];
  }

  /** Sets (or with null removes) the animation of a texture; its frames are the texture's pixels. */
  setAnimation(path: string, anim: TextureAnimation | null): void {
    const all = (this.project.animations ??= {});
    const had = !!all[path];
    if (anim) all[path] = { ...anim, ...(anim.frames ? { frames: anim.frames.map((s) => ({ ...s })) } : {}), updatedAt: Date.now() };
    else delete all[path];
    if (!Object.keys(all).length) delete this.project.animations;
    this.touch();
    // the texture list marks animated textures
    if (had !== !!anim) this.rebuildEntries();
    this.events.emit('animation', { path });
  }

  // ---- paint layers (project.layers) ----

  /** True when the texture is painted on layers (more than one, or one with settings of its own). */
  hasLayers(path: string): boolean {
    const mem = this.layerStacks.get(path);
    if (mem) return !isPlain(mem);
    return this.pendingLayers.has(path) ? false : !!this.project.layers?.[path];
  }

  /**
   * The texture's paint layers: the stack being painted (the same object each time while it is in
   * memory), else read from the project. Null when it has none (or they can't be read).
   */
  async loadLayers(path: string): Promise<LayerStack | null> {
    const mem = this.layerStacks.get(path);
    if (mem) {
      this.keepStack(path, mem);
      return mem;
    }
    if (this.pendingLayers.has(path)) return null;
    const rec = this.project.layers?.[path];
    if (!rec) return null;
    const stack = await stackOf(rec, (b) => decodeImage(b, 'png'));
    // painted or dropped while it was being read
    if (this.layerStacks.has(path) || this.pendingLayers.has(path) || this.project.layers?.[path] !== rec) return this.layerStacks.get(path) ?? null;
    if (stack) this.keepStack(path, stack);
    return stack;
  }

  /**
   * Sets a texture's paint layers (saved shortly after; a plain single layer stores nothing, but
   * stays in memory). `painted`: layer images whose pixels changed in place.
   */
  setLayers(path: string, stack: LayerStack | null, painted: readonly ImageData[] = []): void {
    for (const img of painted) this.layerRevs.set(img, (this.layerRevs.get(img) ?? 0) + 1);
    if (stack) this.keepStack(path, stack);
    else this.layerStacks.delete(path);
    this.pendingLayers.set(path, (this.pendingLayers.get(path) ?? 0) + 1);
    this.metaDirty = true;
    this.schedule();
  }

  /** The texture is no longer made of its layers (reset, replaced from elsewhere). True when it had some. */
  private dropLayers(path: string): boolean {
    if (!this.layerStacks.has(path) && !this.project.layers?.[path]) return false;
    this.layerStacks.delete(path);
    this.pendingLayers.set(path, (this.pendingLayers.get(path) ?? 0) + 1);
    return true;
  }

  private keepStack(path: string, stack: LayerStack): void {
    this.layerStacks.delete(path);
    this.layerStacks.set(path, stack);
    let extra = this.layerStacks.size - KEPT_LAYER_STACKS;
    for (const key of this.layerStacks.keys()) {
      if (extra <= 0) break;
      if (key === path || this.pendingLayers.has(key)) continue;
      this.layerStacks.delete(key);
      extra--;
    }
  }

  private layerPng(img: ImageData): Blob {
    const rev = this.layerRevs.get(img) ?? 0;
    const known = this.layerPngs.get(img);
    if (known && known.rev === rev) return known.blob;
    const blob = new Blob([encodePng(img)], { type: 'image/png' });
    this.layerPngs.set(img, { rev, blob });
    return blob;
  }

  /** Writes the layers waiting to be saved into the project record. */
  private storeLayers(): void {
    for (const [path, n] of [...this.pendingLayers]) {
      const stack = this.layerStacks.get(path);
      const all = (this.project.layers ??= {});
      if (stack && !isPlain(stack)) all[path] = recordOf(stack, (img) => this.layerPng(img));
      else delete all[path];
      if (!Object.keys(all).length) delete this.project.layers;
      if (this.pendingLayers.get(path) === n) this.pendingLayers.delete(path);
    }
  }

  /** Project settings changed. */
  touch(event: 'meta' | 'effects' | null = null): void {
    this.metaDirty = true;
    this.schedule();
    if (event) this.events.emit(event);
  }

  // ---- saving ----

  private setState(s: SaveState): void {
    if (this.saveState === s) return;
    this.saveState = s;
    this.events.emit('save', s);
  }

  hasUnsaved(): boolean {
    if (this.discarded) return false;
    return this.metaDirty || this.pending.size > 0 || !!this.pendingIcon || this.pendingLayers.size > 0 || this.timer !== null || this.flushing !== null;
  }

  private schedule(): void {
    if (this.discarded) return;
    this.setState('dirty');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, SAVE_DELAY);
  }

  /**
   * Stops saving for good (the project is being deleted): drops pending edits and waits for a save
   * that is already running, so it can't write the project back after it's gone.
   */
  async discard(): Promise<void> {
    this.discarded = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending.clear();
    this.pendingIcon = null;
    this.pendingLayers.clear();
    this.layerStacks.clear();
    this.metaDirty = false;
    await this.flushing?.catch(() => undefined);
  }

  /** Undoes discard() (deleting failed): saves the project again. */
  revive(): void {
    if (!this.discarded) return;
    this.discarded = false;
    this.touch();
  }

  /** Saves everything now. Never rejects; failures set the 'error' state. */
  flush(): Promise<void> {
    if (this.discarded) return Promise.resolve();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.flushing) {
      this.again = true;
      return this.flushing;
    }
    this.flushing = (async () => {
      do {
        this.again = false;
        await this.saveOnce();
      } while (this.again && this.saveState !== 'error');
    })().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async saveOnce(): Promise<void> {
    if (!this.metaDirty && !this.pending.size && !this.pendingIcon && !this.pendingLayers.size) {
      if (this.saveState !== 'error') this.setState('saved');
      return;
    }
    this.setState('saving');
    try {
      // paint layers as they are now, with the flattened textures they make
      this.storeLayers();
      const batch = [...this.pending.entries()];
      for (const [path, img] of batch) {
        const stamp = this.stamp(path);
        await setOverride(this.project, path, img);
        // Reset to vanilla while this was encoding: don't bring the old pixels back.
        if (this.stamp(path) !== stamp && !this.pending.has(path)) removeOverride(this.project, path);
        if (this.pending.get(path) === img) this.pending.delete(path);
      }
      if (this.pendingIcon) {
        const icon = this.pendingIcon;
        this.project.icon = new Blob([encodePng(icon)], { type: 'image/png' });
        if (this.pendingIcon === icon) this.pendingIcon = null;
      }
      this.metaDirty = false;
      if (this.discarded) return;
      await saveProject(this.project);
      this.lastError = '';
      this.setState(this.pending.size || this.pendingIcon || this.pendingLayers.size || this.metaDirty ? 'dirty' : 'saved');
      if (this.pending.size || this.pendingIcon || this.pendingLayers.size) this.again = true;
    } catch (err) {
      console.error(err);
      this.metaDirty = true;
      this.lastError = friendlyError(err);
      this.setState('error');
    }
  }
}
