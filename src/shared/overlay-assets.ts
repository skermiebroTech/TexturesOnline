// A texture pack layered over vanilla assets, as one AssetIndex: files the pack has win, everything
// else comes from the vanilla index underneath. The pack's whole-pack effects (Texture Pack Maker
// projects) are applied to every image read, vanilla ones included, exactly like its export does.
//
// Works for Java ('assets/minecraft/textures/...') and Bedrock ('textures/...') packs, including a
// pack of the other edition (its texture folder is mapped onto the base's). For Bedrock a pack's
// file replaces vanilla by name whatever its extension, and .tga wins over .png like in the engine.

import type { AssetIndex, Edition, EffectLayer, TextureCategory, TextureInfo } from '../core/types';
import { decodeImage } from '../core/image';
import { javaTextureCategory } from '../editions/java/textures';
import { bedrockTextureCategory } from '../editions/bedrock/catalog';
import { applyEffects, effectsApply, type EffectContext } from '../tools/textures/effects';

export const JAVA_TEXTURE_ROOT = 'assets/minecraft/textures/';
export const BEDROCK_TEXTURE_ROOT = 'textures/';

export type OverlayFile = Blob | Uint8Array;

export interface OverlayPack {
  /** Edition the pack's paths are laid out for */
  edition: Edition;
  /** Pack path -> contents (textures, their .mcmeta files, anything else) */
  files: Record<string, OverlayFile> | Map<string, OverlayFile>;
  /** Non-destructive effects applied to every image read (pack and vanilla) */
  effects?: readonly EffectLayer[];
}

export interface OverlayAssets extends AssetIndex {
  readonly base: AssetIndex;
  /** Edition the pack was made for (may differ from `edition`, the base's) */
  readonly packEdition: Edition;
  /** Pack images under the base's texture root */
  readonly overrideCount: number;
  /** True when the pack (rather than vanilla) supplies this path */
  isOverridden(path: string): boolean;
  /** The pack file actually served for `path` (same name, maybe another image extension), or null */
  overridePath(path: string): string | null;
}

export function textureRootOf(edition: Edition): string {
  return edition === 'java' ? JAVA_TEXTURE_ROOT : BEDROCK_TEXTURE_ROOT;
}

/** A pack path in the layout of another edition (only the texture folder moves). */
export function mapPackPath(path: string, from: Edition, to: Edition): string {
  if (from === to) return path;
  const src = textureRootOf(from);
  return path.startsWith(src) ? textureRootOf(to) + path.slice(src.length) : path;
}

const IMAGE_RE = /\.(png|tga)$/i;
/** Engine priority when one name exists with several image extensions. */
const IMAGE_EXTS = ['tga', 'png'] as const;

function extOf(path: string): string {
  const slash = path.lastIndexOf('/');
  const dot = path.lastIndexOf('.');
  return dot > slash ? path.slice(dot + 1).toLowerCase() : '';
}

async function toBytes(f: OverlayFile): Promise<Uint8Array> {
  return f instanceof Uint8Array ? f.slice() : new Uint8Array(await f.arrayBuffer());
}

const utf8 = new TextDecoder();

function categoryFor(path: string, edition: Edition): TextureCategory {
  const root = textureRootOf(edition);
  const rel = path.startsWith(root) ? path.slice(root.length) : path;
  return edition === 'java' ? javaTextureCategory(rel) : bedrockTextureCategory(rel);
}

class Overlay implements OverlayAssets {
  readonly edition: Edition;
  readonly version: string;
  readonly packEdition: Edition;
  readonly overrideCount: number;
  private readonly files = new Map<string, OverlayFile>();
  private readonly keys: string[];
  private readonly effects: readonly EffectLayer[];
  private infos: Map<string, TextureInfo> | null = null;
  private list: TextureInfo[] | null = null;

  constructor(
    readonly base: AssetIndex,
    pack: OverlayPack,
  ) {
    this.edition = base.edition;
    this.version = base.version;
    this.packEdition = pack.edition;
    const entries = pack.files instanceof Map ? pack.files.entries() : Object.entries(pack.files);
    for (const [path, file] of entries) {
      if (!path || path.endsWith('/') || !file) continue;
      this.files.set(mapPackPath(path, pack.edition, base.edition), file);
    }
    this.keys = [...this.files.keys()].sort();
    const root = textureRootOf(base.edition);
    this.overrideCount = this.keys.filter((k) => k.startsWith(root) && IMAGE_RE.test(k)).length;
    this.effects = (pack.effects ?? []).filter((l) => l && l.enabled);
  }

  get textures(): TextureInfo[] {
    if (this.list) return this.list;
    const root = textureRootOf(this.edition);
    const extra: TextureInfo[] = [];
    for (const k of this.keys) {
      if (!k.startsWith(root) || !IMAGE_RE.test(k) || this.base.hasFile(k)) continue;
      const rel = k.slice(root.length);
      const id = rel.replace(IMAGE_RE, '');
      extra.push({
        path: k,
        name: id.slice(id.lastIndexOf('/') + 1),
        id,
        category: categoryFor(k, this.edition),
        ext: extOf(k) === 'tga' ? 'tga' : 'png',
        ...(this.files.has(`${k}.mcmeta`) ? { animated: true } : {}),
      });
    }
    extra.sort((a, b) => a.id.localeCompare(b.id));
    this.list = extra.length ? [...this.base.textures, ...extra] : this.base.textures;
    return this.list;
  }

  overridePath(path: string): string | null {
    if (this.files.has(path)) return path;
    const m = IMAGE_RE.exec(path);
    if (!m) return null;
    const stem = path.slice(0, m.index);
    for (const ext of IMAGE_EXTS) {
      const p = `${stem}.${ext}`;
      if (this.files.has(p)) return p;
    }
    return null;
  }

  isOverridden(path: string): boolean {
    return this.overridePath(path) !== null;
  }

  hasFile(path: string): boolean {
    return this.overridePath(path) !== null || this.base.hasFile(path);
  }

  listFiles(prefix: string): string[] {
    const own = this.keys.filter((k) => k.startsWith(prefix));
    const base = this.base.listFiles(prefix);
    if (!own.length) return base;
    return [...new Set([...base, ...own])].sort();
  }

  async readFile(path: string): Promise<Uint8Array> {
    const key = this.overridePath(path);
    return key ? toBytes(this.files.get(key)!) : this.base.readFile(path);
  }

  async readText(path: string): Promise<string> {
    const text = utf8.decode(await this.readFile(path));
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  }

  async readImage(path: string): Promise<ImageData> {
    const key = this.overridePath(path);
    let img: ImageData | null = null;
    if (key) {
      try {
        img = await decodeImage(this.files.get(key)!, extOf(key));
      } catch (err) {
        // a damaged pack image falls back to vanilla, like the Texture Pack Maker does
        if (!this.base.hasFile(path)) throw err;
      }
    }
    img ??= await this.base.readImage(path);
    return this.withEffects(key ?? path, img);
  }

  private info(path: string): TextureInfo | undefined {
    if (!this.infos) this.infos = new Map(this.base.textures.map((t) => [t.path, t]));
    return this.infos.get(path);
  }

  private withEffects(path: string, img: ImageData): ImageData {
    if (!this.effects.length) return img;
    const info = this.info(path);
    const animated = this.edition === 'java' ? this.hasFile(`${path}.mcmeta`) : info?.animated;
    const ctx: EffectContext = { path, category: info?.category ?? categoryFor(path, this.edition), ...(animated !== undefined ? { animated } : {}) };
    if (!effectsApply(this.effects, ctx)) return img;
    return applyEffects(img, this.effects, ctx);
  }
}

/** `pack` over `base`: the pack's files first, vanilla for the rest. */
export function createOverlayAssets(base: AssetIndex, pack: OverlayPack): OverlayAssets {
  return new Overlay(base, pack);
}

export function isOverlayAssets(a: AssetIndex | null | undefined): a is OverlayAssets {
  return a instanceof Overlay;
}

/**
 * An index without any files, for showing a pack when the vanilla files can't be loaded (offline):
 * the pack's own textures still show, everything else keeps the built-in art.
 */
export function emptyAssetIndex(edition: Edition, version: string): AssetIndex {
  const missing = (path: string) => Promise.reject(new Error(`${path} isn't available offline.`));
  return {
    edition,
    version,
    textures: [],
    hasFile: () => false,
    listFiles: () => [],
    readFile: missing,
    readText: missing,
    readImage: missing,
  };
}
