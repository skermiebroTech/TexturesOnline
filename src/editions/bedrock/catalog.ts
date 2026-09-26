import type { TextureCategory, TextureInfo } from '../../core/types';
import { compareTextures } from '../java/textures';

/*
 * Bedrock vanilla file catalogue: paths relative to bedrock-samples' resource_pack/.
 * Built at deploy time by scripts/bedrock-index.mjs (git ls-tree; paths only), or at runtime
 * from GitHub's tree API / the atlas JSONs when no prebuilt index exists for a version.
 */

export const BEDROCK_TEXTURE_ROOT = 'textures/';
export const BEDROCK_INDEX_FORMAT = 1;

/** Prebuilt index file shape (public/data/bedrock/index-<ref>.json). */
export interface BedrockIndexFile {
  format: number;
  ref: string;
  commit?: string;
  /** Full game version of the ref, e.g. "1.26.50.4" */
  version?: string;
  minEngine?: [number, number, number];
  generated?: string;
  /** Flipbook texture paths (no extension) from textures/flipbook_textures.json */
  flipbook?: string[];
  /** Directory ('' = pack root) -> file names */
  dirs: Record<string, string[]>;
}

export interface BedrockCatalog {
  ref: string;
  commit?: string;
  version?: string;
  /** Sorted relative paths */
  files: string[];
  flipbook: Set<string>;
  /** 'index' = full listing; 'atlas' = reconstructed from atlas JSONs (extensions guessed) */
  source: 'index' | 'tree' | 'atlas';
}

export function isBedrockIndexFile(v: unknown): v is BedrockIndexFile {
  const o = v as BedrockIndexFile;
  return !!o && typeof o === 'object' && o.format === BEDROCK_INDEX_FORMAT && typeof o.ref === 'string' && !!o.dirs && typeof o.dirs === 'object';
}

export function catalogFromIndex(index: BedrockIndexFile, source: BedrockCatalog['source'] = 'index'): BedrockCatalog {
  const files: string[] = [];
  for (const [dir, names] of Object.entries(index.dirs)) {
    if (!Array.isArray(names)) continue;
    for (const n of names) if (typeof n === 'string' && n) files.push(dir ? `${dir}/${n}` : n);
  }
  files.sort();
  return {
    ref: index.ref,
    commit: index.commit,
    version: index.version,
    files,
    flipbook: new Set((index.flipbook ?? []).filter((p) => typeof p === 'string')),
    source,
  };
}

/** Groups relative paths by directory into the compact index shape. */
export function indexFromPaths(paths: string[], meta: Omit<BedrockIndexFile, 'dirs' | 'format'>): BedrockIndexFile {
  const dirs: Record<string, string[]> = {};
  for (const p of [...paths].sort()) {
    const slash = p.lastIndexOf('/');
    const dir = slash < 0 ? '' : p.slice(0, slash);
    (dirs[dir] ??= []).push(p.slice(slash + 1));
  }
  return { format: BEDROCK_INDEX_FORMAT, ...meta, dirs };
}

/** Paths from a GitHub git-trees API response (recursive), relative to resource_pack/. */
export function pathsFromGitTree(tree: unknown): string[] {
  const items = (tree as { tree?: { path?: string; type?: string }[] })?.tree;
  if (!Array.isArray(items)) throw new Error('Unexpected file list format.');
  const out: string[] = [];
  for (const it of items) {
    if (it?.type !== 'blob' || typeof it.path !== 'string') continue;
    if (!it.path.startsWith('resource_pack/')) continue;
    const rel = it.path.slice('resource_pack/'.length);
    if (rel.startsWith('sounds/')) continue;
    out.push(rel);
  }
  return out;
}

// ---- Lenient JSON (vanilla atlas files start with // comments) ----

/** Removes // and /* *\/ comments outside strings, and trailing commas. */
export function stripJsonComments(text: string): string {
  let out = '';
  let i = 0;
  const n = text.length;
  if (text.charCodeAt(0) === 0xfeff) i = 1;
  while (i < n) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < n && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < n && text[i] !== '\n') i++;
    } else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? n : end + 2;
    } else {
      out += c;
      i++;
    }
  }
  return removeTrailingCommas(out);
}

function removeTrailingCommas(text: string): string {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < n && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === ',') {
      let j = i + 1;
      while (j < n && /\s/.test(text[j])) j++;
      if (text[j] === '}' || text[j] === ']') {
        i++;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

export function parseLenientJson<T = unknown>(text: string): T {
  return JSON.parse(stripJsonComments(text)) as T;
}

// ---- Textures ----

const IMAGE_EXT = /\.(png|tga)$/i;
const PBR_SUFFIX = /_(mers?|heightmap|normal)$/;

export function bedrockTextureCategory(rel: string): TextureCategory {
  const segs = rel.split('/');
  if (segs.length === 1) return 'misc';
  switch (segs[0]) {
    case 'blocks':
      return 'block';
    case 'items':
      return 'item';
    case 'entity':
      return 'entity';
    case 'ui':
    case 'gui':
      return 'gui';
    case 'particle':
    case 'particles':
      return 'particle';
    case 'environment':
      return 'environment';
    case 'painting':
      return 'painting';
    case 'models':
    case 'trims':
      return 'armor';
    case 'misc':
      return 'misc';
    case 'colormap':
      return 'colormap';
    case 'map':
      return 'map';
    case 'effect':
    case 'mob_effect':
      return 'effect';
    case 'font':
      return 'font';
    default:
      return 'other';
  }
}

/**
 * PBR maps are not editable textures: *_mer/_mers/_heightmap without their own texture set, and
 * *_normal when the base texture has a texture set (vanilla also has colour textures like
 * piston_top_normal.png, which have their own texture set, or ui/*_normal.png, which have no base).
 */
export function isPbrMap(stem: string, hasTextureSet: (stem: string) => boolean): boolean {
  const m = PBR_SUFFIX.exec(stem);
  if (!m) return false;
  if (hasTextureSet(stem)) return false;
  if (m[1] === 'normal') return hasTextureSet(stem.slice(0, -'_normal'.length));
  return true;
}

/** Editable textures (PNG/TGA colour images) from a catalogue; stems with both formats use the TGA (it wins in-game). */
export function bedrockTexturesFromFiles(files: Iterable<string>, flipbook: Set<string> = new Set()): TextureInfo[] {
  const exts = new Map<string, Set<string>>();
  for (const f of files) {
    if (!f.startsWith(BEDROCK_TEXTURE_ROOT)) continue;
    let stem: string;
    let ext: string;
    if (f.endsWith('.texture_set.json')) {
      stem = f.slice(0, -'.texture_set.json'.length);
      ext = 'texture_set.json';
    } else {
      const dot = f.lastIndexOf('.');
      if (dot < 0 || dot < f.lastIndexOf('/')) continue;
      stem = f.slice(0, dot);
      ext = f.slice(dot + 1).toLowerCase();
    }
    let s = exts.get(stem);
    if (!s) exts.set(stem, (s = new Set()));
    s.add(ext);
  }
  const hasSet = (stem: string) => exts.get(stem)?.has('texture_set.json') ?? false;
  const list: TextureInfo[] = [];
  for (const [stem, set] of exts) {
    const ext: 'png' | 'tga' | null = set.has('tga') ? 'tga' : set.has('png') ? 'png' : null;
    if (!ext) continue;
    if (isPbrMap(stem, hasSet)) continue;
    const id = stem.slice(BEDROCK_TEXTURE_ROOT.length);
    const info: TextureInfo = {
      path: `${stem}.${ext}`,
      name: id.slice(id.lastIndexOf('/') + 1),
      id,
      category: bedrockTextureCategory(id),
      ext,
    };
    if (flipbook.has(stem)) info.animated = true;
    list.push(info);
  }
  return list.sort(compareTextures);
}

export function isBedrockImagePath(path: string): boolean {
  return IMAGE_EXT.test(path);
}

// ---- Atlas fallback ----

function collectTexturePaths(value: unknown, out: Set<string>): void {
  if (typeof value === 'string') {
    if (value.startsWith('textures/')) out.add(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectTexturePaths(v, out);
  } else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.path === 'string') collectTexturePaths(o.path, out);
    for (const k of ['textures', 'variations']) if (k in o) collectTexturePaths(o[k], out);
  }
}

/** Texture paths (no extension) referenced by terrain_texture.json / item_texture.json / flipbook_textures.json. */
export function texturePathsFromAtlases(atlases: { terrain?: unknown; item?: unknown; flipbook?: unknown }): { paths: string[]; flipbook: string[] } {
  const out = new Set<string>();
  for (const atlas of [atlases.terrain, atlases.item]) {
    const data = (atlas as { texture_data?: Record<string, unknown> })?.texture_data;
    if (!data || typeof data !== 'object') continue;
    for (const entry of Object.values(data)) collectTexturePaths((entry as { textures?: unknown })?.textures ?? entry, out);
  }
  const flip: string[] = [];
  if (Array.isArray(atlases.flipbook)) {
    for (const e of atlases.flipbook) {
      const p = (e as { flipbook_texture?: unknown })?.flipbook_texture;
      if (typeof p === 'string' && p.startsWith('textures/')) {
        flip.push(p);
        out.add(p);
      }
    }
  }
  return { paths: [...out].sort(), flipbook: flip };
}

/** Flipbook stems from a flipbook_textures.json array. */
export function flipbookStems(flipbook: unknown): string[] {
  return texturePathsFromAtlases({ flipbook }).flipbook;
}
