// Project files (.tpmproject) and backups (.tpmbackup): a zip with a manifest and one folder per
// project, so a project can leave the browser and come back exactly as it was. Pure (no DOM, no
// storage): turning stored records into an archive and back. records.ts reads and writes the
// browser's storage; ui.ts has the dialogs.
//
//   manifest.json                    { format, version, tool, app, created, items: [{ type, id, name, dir }] }
//   items/0-texturepack/item.json    { type, id, name, updatedAt, data } with every Blob or byte array
//   items/0-texturepack/project/...  replaced by { "$file": "<path in the folder>" }: images stay PNG,
//                                    sounds Ogg, pack files keep their own names and paths
//
// Only the user's work goes in: the game's own files are downloaded again from Mojang when the
// project opens. Each file keeps the project ids, so restoring a backup can tell what is already
// here. A newer format version than this code knows is refused; older ones are migrated
// (MIGRATIONS).

import { readZip, writeZip } from '../../core/zip';
import { sanitizeFilename } from '../../core/download';
import { SITE_NAME, SITE_URL } from '../../app/site';
import { fmt } from '../../i18n/editor-text';
import { pf } from './i18n/text';
import { PROJECT_FILE_RE, isProjectFileName } from './handoff';

export { PROJECT_FILE_RE, isProjectFileName };

/** Build date, written by vite.config.ts (absent in unit tests). */
declare const __APP_BUILD__: string | undefined;

export const PROJECT_FORMAT = 'texture-pack-maker';
/** Version of the file layout this code writes. Bump it (and add a MIGRATIONS step) when it changes. */
export const FORMAT_VERSION = 1;
export const PROJECT_EXT = '.tpmproject';
export const BACKUP_EXT = '.tpmbackup';
const MANIFEST = 'manifest.json';
const ITEM_JSON = 'item.json';

/** What a stored item is: a project record, or the cape and font makers' single drafts. */
export type ItemType = 'texturepack' | 'skin' | 'shader' | 'cape' | 'font';
export const ITEM_TYPES: readonly ItemType[] = ['texturepack', 'skin', 'shader', 'cape', 'font'];

/** The tool a file was saved from (where it opens), or 'backup' for everything at once. */
export type ProjectTool = 'textures' | 'skins' | 'skinpack' | 'cape' | 'shaders' | 'fonts' | 'backup';
export const PROJECT_TOOLS: readonly ProjectTool[] = ['textures', 'skins', 'skinpack', 'cape', 'shaders', 'fonts', 'backup'];

export interface ManifestItem {
  type: ItemType;
  id: string;
  name: string;
  updatedAt?: number;
  /** Folder of the item inside the archive, e.g. 'items/0-skin/' */
  dir: string;
}

export interface ProjectManifest {
  format: typeof PROJECT_FORMAT;
  version: number;
  tool: ProjectTool;
  app: { name: string; build: string; url: string };
  /** ISO date and time the file was written */
  created: string;
  /** The first item is the one the file opens with (a skin pack's own skin, the project) */
  items: ManifestItem[];
}

/** One project (or draft) with its data: a stored record as it is, Blobs and byte arrays included. */
export interface ProjectItem {
  type: ItemType;
  id: string;
  name: string;
  updatedAt?: number;
  data: Record<string, unknown>;
}

export type ProjectFileErrorCode = 'not-zip' | 'not-project' | 'damaged' | 'newer' | 'empty';

/** A file that can't be opened; `code` tells why (the message is in the page's language). */
export class ProjectFileError extends Error {
  constructor(
    readonly code: ProjectFileErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ProjectFileError';
  }
}

const fail = (code: ProjectFileErrorCode, version?: number): ProjectFileError => {
  const e = pf.errors;
  const message =
    code === 'not-zip' ? e.notZip : code === 'not-project' ? e.notProject : code === 'newer' ? fmt(e.newer, { version: String(version ?? '') }) : code === 'empty' ? e.empty : e.damaged;
  return new ProjectFileError(code, message);
};

/** A download name for a project ('My Pack.tpmproject'). */
export function projectFileName(name: string, ext: string = PROJECT_EXT): string {
  const base = sanitizeFilename((name || '').replace(/§./g, '').trim(), 'project').replace(PROJECT_FILE_RE, '').slice(0, 80).trim() || 'project';
  return `${base}${ext}`;
}

/** A backup's download name, dated: 'Texture Pack Maker backup 2026-10-22.tpmbackup'. */
export function backupFileName(now = new Date()): string {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `${SITE_NAME} backup ${d}${BACKUP_EXT}`;
}

// ---------------------------------------------------------------------------------------------
// Values <-> JSON with files

type FileData = Blob | Uint8Array;
const FILE_KEY = '$file';

/** One path segment for a zip entry: letters, digits and a few safe marks; never '.' or '..'. */
function segment(s: string): string {
  const clean = s.normalize('NFC').replace(/[^\p{L}\p{N}._ +@-]+/gu, '_').trim().slice(0, 100);
  return !clean || clean === '.' || clean === '..' ? '_' : clean;
}

/** Path of a value's file from its keys: path-like keys ('assets/minecraft/...') keep their folders. */
function filePath(keys: (string | number)[]): string {
  const parts = keys.flatMap((k) => String(k).split('/')).filter((p) => p !== '');
  return (parts.length ? parts : ['file']).map(segment).join('/');
}

async function sniffExt(data: FileData): Promise<string> {
  const type = data instanceof Blob ? data.type : '';
  if (/png/.test(type)) return 'png';
  if (/ogg|vorbis/.test(type)) return 'ogg';
  if (/json/.test(type)) return 'json';
  if (/ttf|truetype/.test(type)) return 'ttf';
  const head = data instanceof Blob ? new Uint8Array(await data.slice(0, 4).arrayBuffer()) : data.subarray(0, 4);
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'png';
  if (head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53) return 'ogg';
  return 'bin';
}

interface Encoder {
  files: Map<string, FileData>;
}

async function addFile(enc: Encoder, keys: (string | number)[], data: FileData): Promise<string> {
  let path = filePath(keys);
  const last = path.slice(path.lastIndexOf('/') + 1);
  if (!last.includes('.')) path += `.${await sniffExt(data)}`;
  if (enc.files.has(path)) {
    const dot = path.lastIndexOf('.');
    let n = 2;
    while (enc.files.has(`${path.slice(0, dot)}~${n}${path.slice(dot)}`)) n++;
    path = `${path.slice(0, dot)}~${n}${path.slice(dot)}`;
  }
  enc.files.set(path, data);
  return path;
}

/**
 * A JSON-safe copy of a stored value. Blobs and byte arrays become files ({ "$file": path }), Maps
 * and Sets become { "$map" } / { "$set" }, and keys starting with "$" get another "$" so they can't
 * be taken for one of these.
 */
async function encodeValue(v: unknown, keys: (string | number)[], enc: Encoder): Promise<unknown> {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === undefined || typeof v === 'function' || typeof v === 'symbol' || typeof v === 'bigint') return undefined;
  if (v instanceof Blob) {
    const path = await addFile(enc, keys, v);
    return v.type ? { [FILE_KEY]: path, $type: v.type } : { [FILE_KEY]: path };
  }
  if (ArrayBuffer.isView(v)) {
    const bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    return { [FILE_KEY]: await addFile(enc, keys, bytes), $bytes: true };
  }
  if (v instanceof ArrayBuffer) return { [FILE_KEY]: await addFile(enc, keys, new Uint8Array(v)), $bytes: true };
  if (v instanceof Date) return { $date: v.toISOString() };
  if (Array.isArray(v)) {
    const out: unknown[] = [];
    for (let i = 0; i < v.length; i++) out.push((await encodeValue(v[i], [...keys, i], enc)) ?? null);
    return out;
  }
  if (v instanceof Map) {
    const out: unknown[] = [];
    let i = 0;
    for (const [k, x] of v) out.push([await encodeValue(k, [...keys, i, 'key'], enc), await encodeValue(x, [...keys, i++], enc)]);
    return { $map: out };
  }
  if (v instanceof Set) {
    const out: unknown[] = [];
    let i = 0;
    for (const x of v) out.push(await encodeValue(x, [...keys, i++], enc));
    return { $set: out };
  }
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    const e = await encodeValue(x, [...keys, k], enc);
    if (e !== undefined) out[k.startsWith('$') ? `$${k}` : k] = e;
  }
  return out;
}

function isMarker(o: Record<string, unknown>, key: string, allowed: string[]): boolean {
  return key in o && Object.keys(o).every((k) => k === key || allowed.includes(k));
}

/** Reverses encodeValue; `read` returns a file of the item (throws when it is missing). */
function decodeValue(v: unknown, read: (path: string) => Uint8Array): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => decodeValue(x, read));
  const o = v as Record<string, unknown>;
  if (isMarker(o, FILE_KEY, ['$type', '$bytes']) && typeof o[FILE_KEY] === 'string') {
    const bytes = read(o[FILE_KEY] as string);
    if (o.$bytes === true) return bytes.slice();
    return new Blob([bytes.slice() as Uint8Array<ArrayBuffer>], { type: typeof o.$type === 'string' ? o.$type : '' });
  }
  if (isMarker(o, '$map', []) && Array.isArray(o.$map)) {
    return new Map((o.$map as unknown[]).filter((e): e is unknown[] => Array.isArray(e) && e.length === 2).map(([k, x]) => [decodeValue(k, read), decodeValue(x, read)]));
  }
  if (isMarker(o, '$set', []) && Array.isArray(o.$set)) return new Set((o.$set as unknown[]).map((x) => decodeValue(x, read)));
  if (isMarker(o, '$date', []) && typeof o.$date === 'string') return new Date(o.$date);
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(o)) {
    const key = k.startsWith('$$') ? k.slice(1) : k;
    // a key that would change the object's prototype is never data
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    out[key] = decodeValue(x, read);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Archives

/** The app that wrote a file, for the manifest. */
export function appInfo(): ProjectManifest['app'] {
  return { name: SITE_NAME, build: typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'dev', url: SITE_URL };
}

/** Writes items into a project file or backup (a zip; see the top of this file). */
export async function writeProjectArchive(tool: ProjectTool, items: ProjectItem[], now = new Date()): Promise<Blob> {
  const files: Record<string, string | FileData> = {};
  const listed: ManifestItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const dir = `items/${i}-${it.type}/`;
    const enc: Encoder = { files: new Map() };
    const data = await encodeValue(it.data, [], enc);
    for (const [path, d] of enc.files) files[dir + path] = d;
    files[dir + ITEM_JSON] = JSON.stringify({ type: it.type, id: it.id, name: it.name, updatedAt: it.updatedAt, data }, null, 1);
    listed.push({ type: it.type, id: it.id, name: it.name, ...(it.updatedAt ? { updatedAt: it.updatedAt } : {}), dir });
  }
  const manifest: ProjectManifest = { format: PROJECT_FORMAT, version: FORMAT_VERSION, tool, app: appInfo(), created: now.toISOString(), items: listed };
  // Written first, so a quick look at the archive finds it straight away.
  return writeZip({ [MANIFEST]: JSON.stringify(manifest, null, 2), ...files }, { mimeType: 'application/octet-stream' });
}

/** An archive as read, before it is checked: the manifest's JSON and every file. */
export interface RawArchive {
  manifest: Record<string, unknown> & { version: number };
  files: Record<string, Uint8Array>;
}

/** Turns a file of one format version into the next one. */
export type Migration = (a: RawArchive) => RawArchive;

/**
 * Steps that bring an older file up to date, by the version they read: MIGRATIONS[1] would turn a
 * version 1 file into version 2. Version 1 is the first format, so there are none yet. Records
 * saved by older versions of a tool inside a file of the current format are brought up to date
 * when they are restored (records.ts), as the tools do with what they read from storage.
 */
export const MIGRATIONS: Record<number, Migration> = {};

/** Runs every step from the file's version up to `target`. */
export function migrateArchive(a: RawArchive, target = FORMAT_VERSION, steps: Record<number, Migration> = MIGRATIONS): RawArchive {
  let out = a;
  while (out.manifest.version < target) {
    const from = out.manifest.version;
    const step = steps[from];
    if (!step) throw fail('damaged');
    out = step(out);
    out.manifest.version = from + 1;
  }
  return out;
}

const decoder = new TextDecoder();
function parseJson(bytes: Uint8Array | undefined): unknown {
  if (!bytes) return undefined;
  try {
    return JSON.parse(decoder.decode(bytes).replace(/^﻿/, ''));
  } catch {
    return undefined;
  }
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const SAFE_DIR = /^items\/[^/]+\/$/;

/**
 * Checks a manifest (after migration) and returns it in a known shape. Items of a kind this
 * version doesn't know are left out; a file with none left is 'empty'.
 */
export function validateManifest(m: unknown, opts: { target?: number } = {}): ProjectManifest {
  if (!isObj(m) || m.format !== PROJECT_FORMAT) throw fail('not-project');
  const version = m.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) throw fail('damaged');
  if (version > (opts.target ?? FORMAT_VERSION)) throw fail('newer', version);
  if (!Array.isArray(m.items)) throw fail('damaged');
  const items: ManifestItem[] = [];
  for (const x of m.items) {
    if (!isObj(x) || typeof x.id !== 'string' || !x.id || typeof x.dir !== 'string' || !SAFE_DIR.test(x.dir) || x.dir.includes('..')) continue;
    if (!ITEM_TYPES.includes(x.type as ItemType)) continue;
    items.push({
      type: x.type as ItemType,
      id: x.id.slice(0, 200),
      name: typeof x.name === 'string' ? x.name.slice(0, 200) : '',
      ...(typeof x.updatedAt === 'number' && Number.isFinite(x.updatedAt) ? { updatedAt: x.updatedAt } : {}),
      dir: x.dir,
    });
  }
  if (!items.length) throw fail('empty');
  const tool = PROJECT_TOOLS.includes(m.tool as ProjectTool) ? (m.tool as ProjectTool) : items.length > 1 ? 'backup' : toolOfItem(items[0].type);
  const app = isObj(m.app) ? m.app : {};
  return {
    format: PROJECT_FORMAT,
    version,
    tool,
    app: { name: String(app.name ?? ''), build: String(app.build ?? ''), url: String(app.url ?? '') },
    created: typeof m.created === 'string' ? m.created : '',
    items,
  };
}

/** The tool an item opens in. */
export function toolOfItem(type: ItemType): ProjectTool {
  return type === 'texturepack' ? 'textures' : type === 'skin' ? 'skins' : type === 'shader' ? 'shaders' : type === 'cape' ? 'cape' : 'fonts';
}

/** A project file or backup, read and checked. Items are decoded when they are needed. */
export interface ProjectArchive {
  manifest: ProjectManifest;
  /** The item's data; throws a 'damaged' ProjectFileError when it can't be read */
  load(item: ManifestItem): ProjectItem;
}

/** Reads a project file or backup. Throws a ProjectFileError that says what is wrong with it. */
export async function readProjectArchive(data: Blob | Uint8Array, opts: { target?: number; migrations?: Record<number, Migration> } = {}): Promise<ProjectArchive> {
  let files: Record<string, Uint8Array>;
  try {
    files = await readZip(data);
  } catch {
    throw fail('not-zip');
  }
  const json = parseJson(files[MANIFEST]);
  if (json === undefined) throw fail(files[MANIFEST] ? 'damaged' : 'not-project');
  if (!isObj(json) || json.format !== PROJECT_FORMAT) throw fail('not-project');
  const version = json.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) throw fail('damaged');
  const target = opts.target ?? FORMAT_VERSION;
  if (version > target) throw fail('newer', version);
  const raw = migrateArchive({ manifest: { ...json, version }, files }, target, opts.migrations ?? MIGRATIONS);
  const manifest = validateManifest(raw.manifest, { target });
  return {
    manifest,
    load(item) {
      const it = parseJson(raw.files[item.dir + ITEM_JSON]);
      if (!isObj(it) || !isObj(it.data)) throw fail('damaged');
      const read = (path: string) => {
        const bytes = typeof path === 'string' && !path.split('/').includes('..') ? raw.files[item.dir + path] : undefined;
        if (!bytes) throw fail('damaged');
        return bytes;
      };
      return { type: item.type, id: item.id, name: item.name, ...(item.updatedAt ? { updatedAt: item.updatedAt } : {}), data: decodeValue(it.data, read) as Record<string, unknown> };
    },
  };
}
