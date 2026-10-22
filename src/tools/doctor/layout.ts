// Pack Doctor: where the pack is inside what was dropped, and what kind of pack it is. Finds every
// folder that looks like the top of a pack (pack.mcmeta, manifest.json, an assets/ or textures/
// folder, a shader pack's shaders/ folder, a data pack's data/ folder), also inside zips in the zip,
// and picks the one to check. Pure.

import type { Edition } from '../../core/types';
import { parseJsonLoose } from '../textures/project';
import type { PackArchive } from './types';

export type PackKind = 'java' | 'bedrock' | 'shader' | 'data' | 'behavior' | 'skin' | 'world' | 'unknown';

export interface PackRoot {
  kind: PackKind;
  /** Folder of the pack ('' = top of the archive, else 'Folder/') */
  root: string;
  /** Path of the zip inside the archive that holds it, when it is one */
  inner?: string;
  depth: number;
  /** The archive the files come from (the dropped one, or an inner zip) */
  archive: PackArchive;
  /** Java: pack.mcmeta found under a wrong name ('Pack.mcmeta', 'pack.mcmeta.txt') */
  misnamedMcmeta?: string;
  /** Bedrock: manifest.json found under a wrong name */
  misnamedManifest?: string;
  /** Bedrock: module types of the manifest */
  modules?: string[];
  /** Bedrock: header uuid of the manifest */
  uuid?: string;
}

const MCMETA_LIKE = /^pack\.mcmeta(\.(txt|json))?$/i;
const MANIFEST_LIKE = /^manifest(\s*\(\d+\))?\.json(\.txt)?$/i;
const JAVA_ASSETS = /^(.*?)assets\/[^/]+\/(textures|models|blockstates|sounds|lang|font|items|shaders|atlases|optifine|mcpatcher|texts|particles|equipment|post_effect|sounds\.json)(\/|$)/;
const BEDROCK_TEXTURES = /^(.*?)textures\/(blocks|items|entity|ui|environment|particle|painting|models|map|gui|colormap|misc|armor)\/[^/]+/i;
const SHADER_FILE = /^(.*?)shaders\/([^/]+\.(fsh|vsh|gsh|csh|glsl)|shaders\.properties|world-?\d+\/.+|lang\/.+)$/i;
const DATA_FILE = /^(.*?)data\/[^/]+\/(recipes?|loot_tables?|advancements?|functions?|tags|worldgen|structures?|predicates?|item_modifiers?|dimension|dimension_type|damage_type|enchantment|trim_pattern|trim_material|chat_type|painting_variant|jukebox_song|banner_pattern)\//;

const decoder = new TextDecoder('utf-8');
const textOf = (b: Uint8Array) => {
  const t = decoder.decode(b);
  return t.charCodeAt(0) === 0xfeff ? t.slice(1) : t;
};

function moduleTypes(manifest: unknown): string[] {
  const modules = (manifest as { modules?: unknown } | null)?.modules;
  if (!Array.isArray(modules)) return [];
  return modules.map((m) => (m && typeof m === 'object' ? String((m as { type?: unknown }).type ?? '') : '')).filter(Boolean);
}

const depthOf = (root: string) => (root ? root.split('/').length - 1 : 0);

/** Every pack-like folder of an archive (not of its inner zips). */
function scan(archive: PackArchive, inner: string | undefined, out: PackRoot[]): void {
  const roots = new Map<string, PackRoot>();
  /** Folders with a pack.mcmeta or manifest.json: their kind is decided by that file */
  const marked = new Set<string>();
  const at = (root: string, kind: PackKind): PackRoot => {
    let r = roots.get(root);
    if (!r) {
      r = { kind, root, depth: depthOf(root) + (inner ? 1 : 0), archive, ...(inner ? { inner } : {}) };
      roots.set(root, r);
    }
    return r;
  };
  const rank: Record<PackKind, number> = { bedrock: 7, java: 7, behavior: 5, skin: 5, world: 5, data: 4, shader: 3, unknown: 0 };
  const upgrade = (r: PackRoot, kind: PackKind) => {
    if (!marked.has(r.root) && rank[kind] > rank[r.kind]) r.kind = kind;
  };
  const mark = (r: PackRoot, kind: PackKind) => {
    r.kind = kind;
    marked.add(r.root);
  };
  for (const path of archive.files.keys()) {
    const slash = path.lastIndexOf('/');
    const base = path.slice(slash + 1);
    const dir = path.slice(0, slash + 1);
    if (base === 'pack.mcmeta' || (MCMETA_LIKE.test(base) && !archive.files.has(`${dir}pack.mcmeta`))) {
      const r = at(dir, 'java');
      if (!marked.has(dir)) mark(r, 'java');
      if (base !== 'pack.mcmeta') r.misnamedMcmeta = path;
      continue;
    }
    if (base === 'manifest.json' || (MANIFEST_LIKE.test(base) && !archive.files.has(`${dir}manifest.json`))) {
      const manifest = parseJsonLoose(textOf(archive.files.get(path)!));
      const types = moduleTypes(manifest).map((t) => t.toLowerCase());
      const kind: PackKind =
        types.some((t) => /^resources?$|^texture/.test(t)) || !types.length ? 'bedrock'
        : types.some((t) => t === 'data' || t === 'script' || t === 'javascript' || t === 'client_data') ? 'behavior'
        : types.includes('skin_pack') ? 'skin'
        : types.includes('world_template') ? 'world'
        : 'bedrock';
      // A manifest inside subpacks/ belongs to its parent.
      if (/(^|\/)subpacks\//.test(dir)) continue;
      const r = at(dir, kind);
      mark(r, kind);
      r.modules = types;
      const uuid = (manifest as { header?: { uuid?: unknown } } | null)?.header?.uuid;
      if (typeof uuid === 'string') r.uuid = uuid.toLowerCase();
      if (base !== 'manifest.json') r.misnamedManifest = path;
      continue;
    }
    let m = JAVA_ASSETS.exec(path);
    if (m) {
      upgrade(at(m[1], 'unknown'), 'java');
      continue;
    }
    m = BEDROCK_TEXTURES.exec(path);
    if (m && !/(^|\/)subpacks\//.test(m[1]) && /\.(png|tga|jpe?g)$/i.test(path)) {
      upgrade(at(m[1], 'unknown'), 'bedrock');
      continue;
    }
    m = SHADER_FILE.exec(path);
    if (m && !/assets\/$/.test(m[1])) {
      upgrade(at(m[1], 'unknown'), 'shader');
      continue;
    }
    m = DATA_FILE.exec(path);
    if (m) upgrade(at(m[1], 'unknown'), 'data');
  }
  for (const r of roots.values()) {
    // A pack.mcmeta next to data/ but no assets/: a data pack.
    if (r.kind === 'java') {
      const hasAssets = [...archive.files.keys()].some((p) => p.startsWith(`${r.root}assets/`));
      const hasData = [...archive.files.keys()].some((p) => p.startsWith(`${r.root}data/`));
      if (!hasAssets && hasData) r.kind = 'data';
    }
    if (r.kind !== 'unknown') out.push(r);
  }
}

/** True when `inner` lies inside `outer` (overlays, subpacks, a pack's own folders). */
function contains(outer: PackRoot, inner: PackRoot): boolean {
  return outer.archive === inner.archive && inner.root !== outer.root && inner.root.startsWith(outer.root);
}

/** Every pack found, outermost first, without the folders that belong to another pack. */
export function findPacks(archive: PackArchive): PackRoot[] {
  const all: PackRoot[] = [];
  scan(archive, undefined, all);
  for (const [path, inner] of archive.inner) scan(inner, path, all);
  all.sort((a, b) => a.depth - b.depth || a.root.localeCompare(b.root));
  const real = (k: PackKind) => k === 'java' || k === 'bedrock';
  return all.filter((r) => !all.some((o) => o !== r && contains(o, r) && (real(o.kind) || !real(r.kind))));
}

/**
 * The pack to check: the edition the visitor plays when there is one of it, else the edition the
 * file name suggests; then the shallowest, then (several Java packs) one that suits the version.
 */
export function pickPack(packs: PackRoot[], fileName: string, prefer?: Edition, suits?: (r: PackRoot) => boolean): PackRoot | null {
  if (!packs.length) return null;
  const resource = packs.filter((p) => p.kind === 'java' || p.kind === 'bedrock');
  const pool = resource.length ? resource : packs;
  const byExt: Edition = /\.(mcpack|mcaddon|mcworld)$/i.test(fileName) ? 'bedrock' : 'java';
  const want = prefer ?? byExt;
  const score = (p: PackRoot) => (p.kind === want ? 0 : p.kind === 'java' || p.kind === 'bedrock' ? 1 : 2);
  return [...pool].sort((a, b) => score(a) - score(b) || Number(!!suits && !suits(a)) - Number(!!suits && !suits(b)) || a.depth - b.depth || a.root.localeCompare(b.root))[0];
}

/** The pack's files, with paths from the pack's own top folder. Files outside it are counted. */
export function packFiles(pick: PackRoot): { files: Map<string, Uint8Array>; outside: number } {
  const files = new Map<string, Uint8Array>();
  let outside = 0;
  for (const [path, bytes] of pick.archive.files) {
    if (path.startsWith(pick.root)) files.set(path.slice(pick.root.length), bytes);
    else outside++;
  }
  return { files, outside };
}
