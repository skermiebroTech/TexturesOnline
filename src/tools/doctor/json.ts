// Pack Doctor: JSON as Minecraft reads it, and the references between a Java pack's JSON files
// (model -> texture, model -> parent model, block state / item definition -> model, font -> bitmap,
// atlas -> texture). Pure.

import { parseLenientJson } from '../../editions/bedrock/catalog';
import { stringifyPretty } from '../../editions/java/packmeta';

/** Keeps a byte order mark, so it can be reported (Minecraft Java's JSON reader refuses it). */
const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });

export function textOf(b: Uint8Array): string {
  return decoder.decode(b);
}

export const hasBom = (text: string) => text.charCodeAt(0) === 0xfeff;

export type JsonCheck =
  | { status: 'ok'; value: unknown }
  /** Readable with comments, trailing commas or a byte order mark removed, which a strict reader refuses */
  | { status: 'strict'; value: unknown; reason: 'bom' | 'comments' }
  | { status: 'invalid'; line: number; column: number; message: string };

/** Line and column (1-based) of a character offset. */
function position(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let last = -1;
  for (let i = 0; i < Math.min(offset, text.length); i++) if (text.charCodeAt(i) === 10) {
    line++;
    last = i;
  }
  return { line, column: offset - last };
}

/** Parses JSON the way Minecraft Java does (strict), saying whether a lenient reader would cope. */
export function checkJson(text: string): JsonCheck {
  try {
    return { status: 'ok', value: JSON.parse(text) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      const value = parseLenientJson(text);
      return { status: 'strict', value, reason: hasBom(text) && safeParse(text.slice(1)) ? 'bom' : 'comments' };
    } catch {
      /* invalid either way */
    }
    const m = /position (\d+)/.exec(message);
    const lc = /line (\d+) column (\d+)/.exec(message);
    const pos = lc ? { line: Number(lc[1]), column: Number(lc[2]) } : m ? position(text, Number(m[1])) : { line: 1, column: 1 };
    const clean = message.replace(/\s*\(line \d+ column \d+\)/, '').replace(/ in JSON at position \d+/, '').replace(/^JSON\.parse: /, '');
    return { status: 'invalid', ...pos, message: clean };
  }
}

function safeParse(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

export { stringifyPretty };

// ---------------------------------------------------------------------------------------------
// Resource locations

/** 'stone', 'minecraft:block/stone' -> canonical 'minecraft:block/stone'. */
export function canonical(ref: string): string {
  const i = ref.indexOf(':');
  return i < 0 ? `minecraft:${ref}` : ref;
}

/** File of a texture reference ('minecraft:block/stone' -> assets/minecraft/textures/block/stone.png). */
export function textureFile(ref: string): string {
  const c = canonical(ref);
  const i = c.indexOf(':');
  const path = c.slice(i + 1);
  return `assets/${c.slice(0, i)}/textures/${path}${/\.png$/i.test(path) ? '' : '.png'}`;
}

/** File of a model reference. */
export function modelFile(ref: string): string {
  const c = canonical(ref);
  const i = c.indexOf(':');
  return `assets/${c.slice(0, i)}/models/${c.slice(i + 1)}.json`;
}

/** Reference of a texture file ('assets/minecraft/textures/block/stone.png' -> 'minecraft:block/stone'), or null. */
export function textureRefOf(path: string): string | null {
  const m = /^assets\/([^/]+)\/textures\/(.+)\.png$/.exec(path);
  return m ? `${m[1]}:${m[2]}` : null;
}

export function modelRefOf(path: string): string | null {
  const m = /^assets\/([^/]+)\/models\/(.+)\.json$/.exec(path);
  return m ? `${m[1]}:${m[2]}` : null;
}

export type JsonFileKind = 'model' | 'blockstate' | 'item' | 'font' | 'atlas' | 'other';

export function jsonKind(path: string): JsonFileKind {
  if (/^assets\/[^/]+\/models\/.+\.json$/.test(path)) return 'model';
  if (/^assets\/[^/]+\/blockstates\/.+\.json$/.test(path)) return 'blockstate';
  if (/^assets\/[^/]+\/items\/.+\.json$/.test(path)) return 'item';
  if (/^assets\/[^/]+\/font\/.+\.json$/.test(path)) return 'font';
  if (/^assets\/[^/]+\/atlases\/.+\.json$/.test(path)) return 'atlas';
  return 'other';
}

export interface Ref {
  kind: 'texture' | 'model';
  /** As written in the file */
  ref: string;
}

type Visit = (holder: Record<string, unknown>, key: string, kind: 'texture' | 'model') => void;

/** Calls `visit` for every reference held by a JSON file of the given kind. */
function walkRefs(kind: JsonFileKind, json: unknown, visit: Visit): void {
  if (!json || typeof json !== 'object') return;
  const o = json as Record<string, unknown>;
  const str = (h: Record<string, unknown>, k: string, as: 'texture' | 'model') => {
    if (typeof h[k] === 'string') visit(h, k, as);
  };
  if (kind === 'model') {
    if (typeof o.parent === 'string' && !o.parent.startsWith('builtin/') && !o.parent.startsWith('minecraft:builtin/')) visit(o, 'parent', 'model');
    const tex = o.textures;
    if (tex && typeof tex === 'object' && !Array.isArray(tex)) {
      for (const [k, v] of Object.entries(tex as Record<string, unknown>)) {
        if (typeof v === 'string') {
          if (!v.startsWith('#')) visit(tex as Record<string, unknown>, k, 'texture');
        } else if (v && typeof v === 'object' && typeof (v as { sprite?: unknown }).sprite === 'string' && !((v as { sprite: string }).sprite.startsWith('#'))) {
          visit(v as Record<string, unknown>, 'sprite', 'texture');
        }
      }
    }
  } else if (kind === 'blockstate') {
    const each = (v: unknown) => {
      for (const x of Array.isArray(v) ? v : [v]) if (x && typeof x === 'object') str(x as Record<string, unknown>, 'model', 'model');
    };
    if (o.variants && typeof o.variants === 'object') for (const v of Object.values(o.variants as Record<string, unknown>)) each(v);
    if (Array.isArray(o.multipart)) for (const part of o.multipart) if (part && typeof part === 'object') each((part as { apply?: unknown }).apply);
  } else if (kind === 'item') {
    const walk = (v: unknown, depth: number) => {
      if (!v || typeof v !== 'object' || depth > 40) return;
      if (Array.isArray(v)) {
        for (const x of v) walk(x, depth + 1);
        return;
      }
      const h = v as Record<string, unknown>;
      const type = typeof h.type === 'string' ? h.type.replace(/^minecraft:/, '') : '';
      if (type === 'model') str(h, 'model', 'model');
      if (type === 'special') str(h, 'base', 'model');
      for (const [k, x] of Object.entries(h)) if (k !== 'model' || typeof x !== 'string') walk(x, depth + 1);
    };
    walk(o, 0);
  } else if (kind === 'font') {
    if (Array.isArray(o.providers)) for (const p of o.providers) if (p && typeof p === 'object' && (p as { type?: unknown }).type !== 'reference') {
      const h = p as Record<string, unknown>;
      if (typeof h.file === 'string' && /\.png$/i.test(h.file)) visit(h, 'file', 'texture');
    }
  } else if (kind === 'atlas') {
    if (Array.isArray(o.sources)) for (const s of o.sources) if (s && typeof s === 'object') {
      const h = s as Record<string, unknown>;
      const type = typeof h.type === 'string' ? h.type.replace(/^minecraft:/, '') : '';
      if (type === 'single') str(h, 'resource', 'texture');
    }
  }
}

export function collectRefs(kind: JsonFileKind, json: unknown): Ref[] {
  const out: Ref[] = [];
  walkRefs(kind, json, (h, k, as) => out.push({ kind: as, ref: h[k] as string }));
  return out;
}

/**
 * Replaces references (canonical old -> canonical new). A reference keeps its style: written
 * without a namespace, it stays without one. Returns true when something changed.
 */
export function rewriteRefs(kind: JsonFileKind, json: unknown, textures: Map<string, string>, models: Map<string, string>): boolean {
  let changed = false;
  walkRefs(kind, json, (h, k, as) => {
    const ref = h[k] as string;
    const map = as === 'texture' ? textures : models;
    const font = kind === 'font';
    const key = canonical(font ? ref.replace(/\.png$/i, '') : ref);
    const next = map.get(key);
    if (!next || next === key) return;
    let out = ref.includes(':') ? next : next.replace(/^minecraft:/, '');
    if (font) out += '.png';
    h[k] = out;
    changed = true;
  });
  return changed;
}

/** Does an atlas source list cover a texture ('block/x' is covered by a directory source "block")? */
export function atlasCovers(sources: unknown[], ref: string): boolean {
  const c = canonical(ref);
  const path = c.slice(c.indexOf(':') + 1);
  for (const s of sources) {
    if (!s || typeof s !== 'object') continue;
    const h = s as Record<string, unknown>;
    const type = typeof h.type === 'string' ? h.type.replace(/^minecraft:/, '') : '';
    if (type === 'directory' && typeof h.source === 'string') {
      const dir = h.source.replace(/\/$/, '');
      if (path.startsWith(`${dir}/`)) return true;
    } else if (type === 'single' && typeof h.resource === 'string') {
      if (canonical(h.resource) === c) return true;
    }
  }
  return atlasGenerates(sources, ref);
}

/** Is the texture made by the atlas itself (armour trim colours: paletted_permutations)? */
export function atlasGenerates(sources: unknown[], ref: string): boolean {
  const c = canonical(ref);
  for (const s of sources) {
    if (!s || typeof s !== 'object') continue;
    const h = s as Record<string, unknown>;
    const type = typeof h.type === 'string' ? h.type.replace(/^minecraft:/, '') : '';
    if (type !== 'paletted_permutations' || !Array.isArray(h.textures) || !h.permutations || typeof h.permutations !== 'object') continue;
    const sep = typeof h.separator === 'string' ? h.separator : '_';
    for (const t of h.textures) {
      if (typeof t !== 'string') continue;
      const base = canonical(t);
      if (!c.startsWith(base + sep)) continue;
      if (Object.keys(h.permutations as object).includes(c.slice(base.length + sep.length))) return true;
    }
  }
  return false;
}
