// Editor state for one texture pack project: the texture list, pending edits, debounced autosave to
// IndexedDB and the events the panels listen to.

import type { AssetIndex, TexturePackProject } from '../../../core/types';
import { Emitter } from '../../../core/events';
import { saveProject } from '../../../core/storage';
import { decodeImage, encodePng } from '../../../core/image';
import { friendlyError } from '../../../core/net';
import { categoryForPath, getBaseImage, isEdited, removeOverride, setOverride } from '../project';
import { hasActiveEffects } from '../effects';
import { buildEntries, makeEntry, type TextureEntry } from './meta';

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
}

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
  private vanillaCache = new Map<string, Promise<ImageData | null>>();

  constructor(
    readonly project: TexturePackProject,
    readonly assets: AssetIndex,
  ) {
    this.rebuildEntries();
  }

  rebuildEntries(): void {
    this.entries = buildEntries(this.project, this.assets, categoryForPath);
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
      throw new Error('This pack has no icon yet.');
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

  /** Records new pixels for a texture (saved shortly after). */
  setImage(path: string, full: ImageData): void {
    if (path === ICON_KEY) {
      this.pendingIcon = full;
      this.metaDirty = true;
      this.schedule();
      this.events.emit('meta');
      return;
    }
    const wasEdited = this.isEdited(path);
    this.pending.set(path, full);
    this.bump(path);
    if (!wasEdited && !this.byPath.has(path)) this.rebuildEntries();
    this.schedule();
    this.events.emit('overrides', { path });
  }

  /** Back to vanilla (drops the pack's copy). */
  resetToVanilla(path: string): void {
    this.pending.delete(path);
    removeOverride(this.project, path);
    this.bump(path);
    this.metaDirty = true;
    this.schedule();
    this.events.emit('overrides', { path });
  }

  setIconBlob(blob: Blob | undefined): void {
    this.pendingIcon = null;
    this.project.icon = blob;
    this.touch();
    this.events.emit('meta');
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
    return this.metaDirty || this.pending.size > 0 || !!this.pendingIcon || this.timer !== null || this.flushing !== null;
  }

  private schedule(): void {
    this.setState('dirty');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, SAVE_DELAY);
  }

  /** Saves everything now. Never rejects; failures set the 'error' state. */
  flush(): Promise<void> {
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
    if (!this.metaDirty && !this.pending.size && !this.pendingIcon) {
      if (this.saveState !== 'error') this.setState('saved');
      return;
    }
    this.setState('saving');
    try {
      const batch = [...this.pending.entries()];
      for (const [path, img] of batch) {
        await setOverride(this.project, path, img);
        if (this.pending.get(path) === img) this.pending.delete(path);
      }
      if (this.pendingIcon) {
        const icon = this.pendingIcon;
        this.project.icon = new Blob([encodePng(icon)], { type: 'image/png' });
        if (this.pendingIcon === icon) this.pendingIcon = null;
      }
      this.metaDirty = false;
      await saveProject(this.project);
      this.lastError = '';
      this.setState(this.pending.size || this.pendingIcon || this.metaDirty ? 'dirty' : 'saved');
      if (this.pending.size || this.pendingIcon) this.again = true;
    } catch (err) {
      console.error(err);
      this.metaDirty = true;
      this.lastError = friendlyError(err);
      this.setState('error');
    }
  }
}
