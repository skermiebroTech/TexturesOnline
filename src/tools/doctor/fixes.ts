// Pack Doctor: runs the fix plans the checks worked out, on the pack's files (paths from the pack's
// own top folder). Moving a file also updates every reference to it (models, block states, item
// definitions, fonts and atlases on Java; texture lists on Bedrock). Pure apart from image
// decoding, which uses the browser for JPEG / WebP / GIF / BMP.

import { decodeImage, encodePng } from '../../core/image';
import { parseLenientJson } from '../../editions/bedrock/catalog';
import { newBedrockUuids } from '../textures/project';
import { jsonKind, modelRefOf, rewriteRefs, stringifyPretty, textOf, textureRefOf } from './json';
import type { Change, ChangeCode, FixPlan, Issue, IssueCode } from './types';

export type Files = Map<string, Uint8Array>;

const encoder = new TextEncoder();
const bytesOf = (text: string) => encoder.encode(text);

/** Change lines for the problems a clean re-zip fixes by itself. */
const REBUILD_CHANGE: Partial<Record<IssueCode, ChangeCode>> = {
  'nested-folder': 'extracted',
  'nested-archive': 'extracted',
  junk: 'junk',
  'zip-backslash': 'rebuilt',
  zip64: 'rebuilt',
  'bedrock-zip': 'extension',
  'java-mcpack': 'extension',
};

export function rebuildChanges(issues: Issue[]): Change[] {
  const out: Change[] = [];
  for (const i of issues) {
    const code = REBUILD_CHANGE[i.code];
    if (!code || out.some((c) => c.code === code)) continue;
    out.push({ code, count: i.count || 1, ...(i.code === 'nested-folder' ? { file: String(i.params.folder) } : i.code === 'nested-archive' ? { file: String(i.params.inner) } : {}) });
  }
  return out;
}

/** Paths a plan writes or moves (to keep two plans of one round from undoing each other). */
export function touchedBy(plan: FixPlan): string[] {
  switch (plan.kind) {
    case 'write':
      return Object.keys(plan.files);
    case 'move':
      return plan.moves.flat();
    case 'images':
      return plan.images.flat();
    case 'uuids':
      return ['manifest.json'];
    case 'refs':
      return Object.keys(plan.files);
    default:
      return [];
  }
}

/** Runs one plan on `files` (changed in place) and says what changed. */
export async function applyPlan(files: Files, plan: FixPlan, code: IssueCode): Promise<Change[]> {
  switch (plan.kind) {
    case 'rebuild':
      return [];
    case 'write': {
      const created: string[] = [];
      const rewritten: string[] = [];
      for (const [path, text] of Object.entries(plan.files)) {
        (files.has(path) ? rewritten : created).push(path);
        files.set(path, bytesOf(text));
      }
      const out: Change[] = [];
      if (created.length) out.push({ code: 'created', count: created.length, ...(created.length === 1 ? { file: created[0] } : {}) });
      if (rewritten.length) out.push({ code: 'rewritten', count: rewritten.length, ...(rewritten.length === 1 ? { file: rewritten[0] } : {}) });
      return out;
    }
    case 'move': {
      const { moved, done, rewritten } = moveFiles(files, plan.moves, plan.refs);
      const out: Change[] = [];
      if (moved) out.push({ code: code === 'misplaced-textures' || code === 'mcmeta-name' || code === 'manifest-name' ? 'moved' : 'renamed', count: moved, moves: done });
      if (rewritten.length) out.push({ code: 'refs', count: rewritten.length, paths: rewritten });
      return out;
    }
    case 'images': {
      let n = 0;
      for (const [from, to] of plan.images) {
        const bytes = files.get(from);
        if (!bytes) continue;
        try {
          const img = await decodeImage(bytes, from.slice(from.lastIndexOf('.') + 1));
          const png = encodePng(img);
          if (from !== to) files.delete(from);
          files.set(to, png);
          n++;
        } catch {
          /* left as it is: still reported */
        }
        if (n % 25 === 0) await new Promise((r) => setTimeout(r, 0));
      }
      return n ? [{ code: 'converted', count: n }] : [];
    }
    case 'uuids': {
      const bytes = files.get('manifest.json');
      if (!bytes) return [];
      let m: Record<string, unknown>;
      try {
        m = parseLenientJson(textOf(bytes)) as Record<string, unknown>;
      } catch {
        return [];
      }
      const ids = newBedrockUuids();
      const header = { ...((m.header as Record<string, unknown>) ?? {}), uuid: ids.header };
      const modules = Array.isArray(m.modules) ? m.modules.map((x, i) => (x && typeof x === 'object' ? { ...(x as Record<string, unknown>), uuid: i === 0 ? ids.module : newBedrockUuids().module } : x)) : m.modules;
      files.set('manifest.json', bytesOf(stringifyPretty({ ...m, header, modules })));
      return [{ code: 'uuids', count: 1 }];
    }
    case 'refs': {
      const changed: string[] = [];
      for (const [path, map] of Object.entries(plan.files)) {
        const bytes = files.get(path);
        if (!bytes) continue;
        let v: unknown;
        try {
          v = parseLenientJson(textOf(bytes));
        } catch {
          continue;
        }
        const count = replaceStrings(v, (s) => map[s]);
        if (count) {
          files.set(path, bytesOf(stringifyPretty(v)));
          changed.push(path);
        }
      }
      return changed.length ? [{ code: 'refs', count: changed.length, paths: changed }] : [];
    }
  }
}

/** Replaces string values (not keys) anywhere in a JSON value; returns how many. */
function replaceStrings(v: unknown, map: (s: string) => string | undefined): number {
  let n = 0;
  const walk = (x: unknown) => {
    if (Array.isArray(x)) {
      x.forEach((y, i) => {
        if (typeof y === 'string') {
          const r = map(y);
          if (r !== undefined && r !== y) {
            x[i] = r;
            n++;
          }
        } else walk(y);
      });
    } else if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      for (const [k, y] of Object.entries(o)) {
        if (typeof y === 'string') {
          const r = map(y);
          if (r !== undefined && r !== y) {
            o[k] = r;
            n++;
          }
        } else walk(y);
      }
    }
  };
  walk(v);
  return n;
}

/**
 * Moves files and points every reference at the new names. Java: texture and model references in
 * models, block states, item definitions, fonts and atlases. Bedrock: texture paths (no extension)
 * in textures/*.json.
 */
export function moveFiles(files: Files, moves: [string, string][], extra?: { textures: Record<string, string>; models: Record<string, string> }): { moved: number; refs: number; done: [string, string][]; rewritten: string[] } {
  const textures = new Map<string, string>(Object.entries(extra?.textures ?? {}));
  const models = new Map<string, string>(Object.entries(extra?.models ?? {}));
  const stems = new Map<string, string>();
  let moved = 0;
  const done: [string, string][] = [];
  const rewritten = new Set<string>();
  for (const [from, to] of moves) {
    const bytes = files.get(from);
    if (!bytes || from === to) continue;
    if (files.has(to) && from.toLowerCase() !== to.toLowerCase()) continue;
    files.delete(from);
    files.set(to, bytes);
    moved++;
    done.push([from, to]);
    const ta = textureRefOf(from);
    const tb = textureRefOf(to);
    if (ta && tb) textures.set(ta, tb);
    const ma = modelRefOf(from);
    const mb = modelRefOf(to);
    if (ma && mb) models.set(ma, mb);
    if (/^textures\/.+\.(png|tga)$/i.test(from)) stems.set(from.replace(/\.(png|tga)$/i, ''), to.replace(/\.(png|tga)$/i, ''));
  }
  let refs = 0;
  if (textures.size || models.size) {
    for (const [path, bytes] of files) {
      const kind = jsonKind(path);
      if (kind === 'other') continue;
      let v: unknown;
      try {
        v = parseLenientJson(textOf(bytes));
      } catch {
        continue;
      }
      if (rewriteRefs(kind, v, textures, models)) {
        files.set(path, bytesOf(stringifyPretty(v)));
        refs++;
        rewritten.add(path);
      }
    }
  }
  if (stems.size) {
    for (const [path, bytes] of files) {
      if (!/^textures\/[^/]+\.json$/.test(path)) continue;
      let v: unknown;
      try {
        v = parseLenientJson(textOf(bytes));
      } catch {
        continue;
      }
      if (replaceStrings(v, (s) => stems.get(s.replace(/\.(png|tga)$/i, '')))) {
        files.set(path, bytesOf(stringifyPretty(v)));
        refs++;
        rewritten.add(path);
      }
    }
  }
  return { moved, refs, done, rewritten: [...rewritten] };
}

/**
 * Adds change lines together. Lines with the same code and no file name add up; moves and
 * rewritten files are counted once per file, so a file renamed in two rounds (Dirt.png ->
 * dirt.png -> block/dirt.png) is one renamed file.
 */
export function mergeChanges(into: Change[], more: Change[]): Change[] {
  for (const c of more) {
    const same = into.find((x) => x.code === c.code && !x.file && !c.file);
    if (!same) {
      into.push({ ...c, ...(c.moves ? { moves: c.moves.map((m) => [...m] as [string, string]) } : {}), ...(c.paths ? { paths: [...c.paths] } : {}) });
      continue;
    }
    if (same.moves && c.moves) {
      for (const [from, to] of c.moves) {
        const earlier = same.moves.find((m) => m[1] === from);
        if (earlier) earlier[1] = to;
        else same.moves.push([from, to]);
      }
      same.count = same.moves.length;
    } else if (same.paths && c.paths) {
      same.paths = [...new Set([...same.paths, ...c.paths])];
      same.count = same.paths.length;
    } else same.count += c.count;
  }
  return into;
}
