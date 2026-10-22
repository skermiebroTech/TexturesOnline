// Pack Doctor: the checks. Takes an opened archive and the game the visitor plays, finds the pack in
// it and returns every problem with how bad it is, which versions it affects and a fix plan where a
// fix is safe to make automatically. Version rules come from src/editions (pack formats, pack.mcmeta
// validation as the game does it) and the converter's texture rename data. Pure (no DOM, no
// network: the game's file lists are passed in), so the unit tests run it in Node.

import type { Edition, PackFormat } from '../../core/types';
import { isUuid } from '../../core/uuid';
import { KNOWN_RELEASES, KNOWN_RELEASE_FORMATS, bundledPackFormat, comparePackFormats, formatPackFormat, guessReleaseForFormat } from '../../editions/java/packformats';
import { LAST_OLD_FORMAT, buildPackMcmeta, describePackForGame, readPackMcmetaRange, validatePackSection, type PackRange } from '../../editions/java/packmeta';
import { DEFAULT_MIN_ENGINE, buildResourceManifest } from '../../editions/bedrock/manifest';
import { engineVersionOf } from '../../editions/bedrock/versions';
import { parseLenientJson } from '../../editions/bedrock/catalog';
import { DEFAULT_JAVA_VERSION } from '../../editions/versions';
import { compareJavaVersions, renameChain, type JavaRenames, type RenameChain } from '../convert/paths';
import { javaFrameSize, parseJavaAnimation } from '../convert/anim';
import { newBedrockUuids, parseBedrockVersion } from '../textures/project';
import { findPacks, packFiles, pickPack, type PackKind, type PackRoot } from './layout';
import { inspectPng, isOgg, isPowerOfTwo, sniffImage, tgaSize } from './images';
import { atlasCovers, atlasGenerates, canonical, checkJson, collectRefs, jsonKind, modelFile, stringifyPretty, textOf, textureFile, type JsonFileKind } from './json';
import type { BedrockVanilla, JavaVanilla } from './vanilla';
import { MAX_FILES, type Affects, type Checked, type DoctorTarget, type Fix, type Issue, type IssueCode, type IssueLink, type PackArchive, type Severity } from './types';

export interface DiagnoseInput {
  archive: PackArchive;
  target: DoctorTarget;
  /** Pack format of the Java target, when it is not a bundled release */
  targetFormat?: PackFormat | null;
  javaVanilla?: JavaVanilla | null;
  bedrockVanilla?: BedrockVanilla | null;
  renames?: JavaRenames | null;
  /** UUIDs of Bedrock packs checked before on this device -> their names */
  knownUuids?: Record<string, string>;
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
}

export interface Diagnosis {
  packs: PackRoot[];
  pick: PackRoot | null;
  kind: PackKind | null;
  /** Edition of the pack that was checked */
  edition: Edition | null;
  /** The pack's files, from its own top folder */
  files: Map<string, Uint8Array>;
  name: string;
  description: string;
  icon: Uint8Array | null;
  /** Java: newest release the pack.mcmeta accepts, and the formats it declares ('34', '34–46') */
  packVersion: string | null;
  packFormats: string | null;
  /** Bedrock: header uuid */
  uuid: string | null;
  issues: Issue[];
  checked: Checked[];
  stats: { files: number; textures: number; json: number; refs: number };
  /** Name for the fixed download, without extension */
  baseName: string;
  /** Whether the game's own file names were available for the reference checks */
  vanillaChecked: boolean;
}

const JAVA_TEX = 'assets/minecraft/textures/';
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|tga)$/i;
const SOUND_EXT = /\.(mp3|wav|m4a|aac|flac|wma|opus)$/i;
const ATLAS_DIRS = /^(block|blocks|item|items)\//;
const LANG_KEY = /^[\w-]+(\.[\w-]+)+$/;

// ---------------------------------------------------------------------------------------------
// Small helpers

function isAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
}

/** Yields to the page now and then so a big pack doesn't freeze it. */
function yielder(signal?: AbortSignal) {
  let last = Date.now();
  return async () => {
    if (Date.now() - last < 12) return;
    isAbort(signal);
    await new Promise((r) => setTimeout(r, 0));
    last = Date.now();
  };
}

const ext = (p: string) => {
  const m = /\.([^./]+)$/.exec(p);
  return m ? m[1].toLowerCase() : '';
};

/** 'Cool Pack (1).mcpack.zip' -> 'Cool Pack'. */
export function baseNameOf(fileName: string): string {
  let n = (fileName.split(/[\\/]/).pop() ?? fileName).trim();
  for (let i = 0; i < 3; i++) n = n.replace(/\.(zip|mcpack|mcaddon|mcworld|rar|7z)$/i, '');
  n = n.replace(/\s*\(\d+\)$/, '').replace(/§./g, '').replace(/[\u0000-\u001f<>:"/\\|?*]+/g, ' ').replace(/\s+/g, ' ').trim();
  return n || 'pack';
}

function plain(v: unknown): string {
  if (typeof v === 'string') return v.replace(/§./g, '');
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(plain).join('');
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const own = typeof o.text === 'string' ? plain(o.text) : typeof o.translate === 'string' ? (typeof o.fallback === 'string' ? plain(o.fallback) : o.translate) : '';
    return own + (Array.isArray(o.extra) ? o.extra.map(plain).join('') : '');
  }
  return '';
}

/** Target format of a Java release (bundled table first). */
function javaFormat(version: string, given?: PackFormat | null): PackFormat | null {
  return given ?? KNOWN_RELEASE_FORMATS[version] ?? bundledPackFormat(version);
}

const inRange = (f: PackFormat, r: PackRange) => comparePackFormats(f, r.min) >= 0 && comparePackFormats(f, r.max) <= 0;

/** Newest bundled release a declared range accepts (for texture renames and messages). */
export function guessPackVersion(range: PackRange | null): string | null {
  if (!range) return null;
  const hit = [...KNOWN_RELEASES].reverse().find((id) => inRange(KNOWN_RELEASE_FORMATS[id], range));
  if (hit) return hit;
  if (comparePackFormats(range.min, KNOWN_RELEASE_FORMATS[KNOWN_RELEASES[KNOWN_RELEASES.length - 1]]) > 0) return KNOWN_RELEASES[KNOWN_RELEASES.length - 1];
  return guessReleaseForFormat(range.max) ?? KNOWN_RELEASES[0];
}

/** '1.20 – 1.20.1' for a declared range (bundled releases), or null. */
function versionsOf(range: PackRange): string | null {
  const ids = KNOWN_RELEASES.filter((id) => inRange(KNOWN_RELEASE_FORMATS[id], range));
  if (!ids.length) return null;
  return ids.length === 1 ? ids[0] : `${ids[0]} – ${ids[ids.length - 1]}`;
}

function formatsOf(range: PackRange): string {
  const max = range.max.minor >= 0x7fffffff ? { major: range.max.major, minor: 0 } : range.max;
  const a = formatPackFormat(range.min);
  const b = formatPackFormat(max);
  return a === b ? a : `${a}–${b}`;
}

const isFlattened = (v: string) => compareJavaVersions(v, '1.13') >= 0;
const isVec3 = (v: unknown) => Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number' && Number.isInteger(x) && x >= 0);

// ---------------------------------------------------------------------------------------------
// Fixed files

/**
 * pack.mcmeta for the target, keeping the pack's description and every other section (language,
 * filter, overlays). `range` keeps a multi-version declaration when the textures suit both ends.
 */
export function rebuiltMcmeta(value: unknown, fallbackDescription: string, target: PackFormat, range: PackRange | null): string {
  const root: Record<string, unknown> = value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
  const old = root.pack && typeof root.pack === 'object' && !Array.isArray(root.pack) ? (root.pack as Record<string, unknown>) : {};
  const description = typeof old.description === 'string' || (old.description && typeof old.description === 'object') ? old.description : fallbackDescription;
  const built = (JSON.parse(buildPackMcmeta({ description: '', target, range: range ?? undefined })) as { pack: Record<string, unknown> }).pack;
  const pack: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(built)) pack[k] = k === 'description' ? description : v;
  if (!('description' in pack)) pack.description = description;
  for (const [k, v] of Object.entries(old)) if (!['description', 'pack_format', 'supported_formats', 'min_format', 'max_format'].includes(k)) pack[k] = v;
  root.pack = pack;
  // "pack" first, as the game's own files have it
  const { pack: p, ...rest } = root;
  return stringifyPretty({ pack: p, ...rest });
}

/** What a broken pack.mcmeta still says: its description. */
function salvageDescription(text: string): string | null {
  const m = /"description"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text);
  if (!m) return null;
  try {
    return JSON.parse(`"${m[1]}"`) as string;
  } catch {
    return m[1];
  }
}

function salvageField(text: string, key: string): string | null {
  const m = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(text);
  return m ? m[1] : null;
}

/**
 * manifest.json that Bedrock accepts, keeping everything valid of the pack's own: name,
 * description, UUIDs, version, capabilities, subpacks, metadata. `name` replaces the header name.
 */
export function repairedManifest(value: unknown, fallbackName: string, opts: { name?: string; newestEngine?: [number, number, number] | null; raw?: string } = {}): string {
  const m: Record<string, unknown> = value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
  const fv = m.format_version === 1 || m.format_version === 2 || m.format_version === 3 ? m.format_version : 2;
  const header: Record<string, unknown> = m.header && typeof m.header === 'object' && !Array.isArray(m.header) ? { ...(m.header as Record<string, unknown>) } : {};
  const raw = opts.raw ?? '';
  const salvaged = (k: string) => (raw ? salvageField(raw, k) : null);
  const uuids = newBedrockUuids();
  const name = opts.name ?? (typeof header.name === 'string' && header.name.trim() ? header.name : salvaged('name') || fallbackName);
  header.name = name;
  if (typeof header.description !== 'string') header.description = salvaged('description') ?? '';
  const huuid = isUuid(header.uuid) ? header.uuid : isUuid(salvaged('uuid')) ? salvaged('uuid')! : uuids.header;
  header.uuid = huuid.toLowerCase();
  const version = fv === 3 && typeof header.version === 'string' && /^\d+\.\d+\.\d+/.test(header.version) ? header.version : (parseBedrockVersion(header.version) ?? [1, 0, 0]);
  header.version = version;
  if (fv >= 2) {
    const engine = Array.isArray(header.min_engine_version) && isVec3(header.min_engine_version) ? (header.min_engine_version as number[]) : typeof header.min_engine_version === 'string' ? parseBedrockVersion(header.min_engine_version) : null;
    const tooNew = engine && opts.newestEngine && engineTooNew(engine as [number, number, number], opts.newestEngine);
    header.min_engine_version = engine && !tooNew ? engine : [...DEFAULT_MIN_ENGINE];
  }
  const modules = (Array.isArray(m.modules) ? m.modules : []).filter((x) => x && typeof x === 'object').map((x) => ({ ...(x as Record<string, unknown>) }));
  let res = modules.find((x) => typeof x.type === 'string' && /^resources?$|^textures?$/i.test(x.type.trim()));
  if (!res) {
    res = { type: 'resources' };
    modules.unshift(res);
  }
  res.type = 'resources';
  const taken = new Set([header.uuid as string]);
  for (const mod of modules) {
    if (!isUuid(mod.uuid) || taken.has(String(mod.uuid).toLowerCase())) mod.uuid = mod === res ? uuids.module : newBedrockUuids().module;
    mod.uuid = String(mod.uuid).toLowerCase();
    taken.add(mod.uuid as string);
    if (!(fv === 3 && typeof mod.version === 'string') && !parseBedrockVersion(mod.version)) mod.version = version;
    else if (Array.isArray(mod.version)) mod.version = parseBedrockVersion(mod.version);
  }
  const { format_version: _f, header: _h, modules: _m, ...rest } = m;
  void _f;
  void _h;
  void _m;
  return stringifyPretty({ format_version: fv, header, modules, ...rest });
}

function engineTooNew(engine: [number, number, number], newest: [number, number, number]): boolean {
  if (engine[0] !== 1) return engine[0] > 1;
  return engine[1] > newest[1];
}

// ---------------------------------------------------------------------------------------------
// The checker

export async function diagnose(input: DiagnoseInput): Promise<Diagnosis> {
  const { archive, target } = input;
  const step = yielder(input.signal);
  const issues: Issue[] = [];
  const checked: Checked[] = [];
  const baseName = baseNameOf(archive.fileName);
  const out: Diagnosis = {
    packs: [],
    pick: null,
    kind: null,
    edition: null,
    files: new Map(),
    name: baseName,
    description: '',
    icon: null,
    packVersion: null,
    packFormats: null,
    uuid: null,
    issues,
    checked,
    stats: { files: 0, textures: 0, json: 0, refs: 0 },
    baseName,
    vanillaChecked: false,
  };
  const add = (code: IssueCode, severity: Severity, affects: Affects, o: { params?: Issue['params']; files?: string[]; count?: number; fix?: Fix; detail?: string; link?: IssueLink } = {}) => {
    const files = o.files ?? [];
    issues.push({ code, severity, affects, params: o.params ?? {}, files: files.slice(0, MAX_FILES), count: o.count ?? files.length, ...(o.fix ? { fix: o.fix } : {}), ...(o.detail ? { detail: o.detail } : {}), ...(o.link ? { link: o.link } : {}) });
  };
  const all = (edition: Edition = target.edition): Affects => ({ edition, kind: 'all' });
  const rebuild: Fix = { safe: true, plan: { kind: 'rebuild' } };

  // ---- the archive itself
  if (archive.damaged) {
    const reason = (archive as { notZip?: string }).notZip ?? 'damaged';
    add('zip-damaged', 'error', all(), { params: { reason } });
    return out;
  }
  const unreadable = archive.unreadable;
  if (unreadable.length) {
    const reason = unreadable.some((u) => u.reason === 'encrypted') ? 'encrypted' : unreadable.some((u) => u.reason === 'method') ? 'method' : 'damaged';
    add('zip-method', 'error', all(), { params: { reason, count: unreadable.length }, files: unreadable.map((u) => u.path) });
  }

  // ---- where the pack is
  const packs = findPacks(archive);
  out.packs = packs;
  const suits = (r: PackRoot) => {
    if (r.kind !== 'java' || target.edition !== 'java') return true;
    const f = r.archive.files.get(`${r.root}pack.mcmeta`);
    const tf = javaFormat(target.version, input.targetFormat);
    const range = f ? readPackMcmetaRange(textOf(f)) : null;
    return !!(range && tf && inRange(tf, range));
  };
  const pick = pickPack(packs, archive.fileName, target.edition, suits);
  out.pick = pick;
  if (!pick || !['java', 'bedrock'].includes(pick.kind)) {
    const kind = pick?.kind ?? 'unknown';
    if (kind === 'shader') add('shader-pack', 'error', all('java'), { link: 'shaders-help' });
    else if (kind === 'data') add('data-pack', 'error', all('java'), { link: 'install' });
    else if (kind === 'behavior' || kind === 'skin' || kind === 'world') add('other-bedrock-pack', 'error', all('bedrock'), { params: { type: kind }, link: kind === 'skin' ? 'skins' : 'bedrock-packs' });
    else add('no-pack', 'error', all(), { link: 'converter' });
    out.kind = kind;
    return out;
  }
  const edition: Edition = pick.kind === 'java' ? 'java' : 'bedrock';
  out.kind = pick.kind;
  out.edition = edition;
  const { files, outside } = packFiles(pick);
  out.files = files;
  out.stats.files = files.size;
  void outside;
  const isAddon = /\.mcaddon$/i.test(archive.fileName);

  if (archive.junk.length) add('junk', 'warning', all(edition), { files: archive.junk, fix: rebuild });
  const backslash = archive.entries.filter((e) => e.name.includes('\\'));
  if (backslash.length) add('zip-backslash', edition === 'java' ? 'error' : 'warning', edition === 'java' ? all('java') : { edition, kind: 'some' }, { files: backslash.map((e) => e.name), fix: rebuild });
  if (archive.zip64 && edition === 'bedrock') add('zip64', 'warning', { edition, kind: 'some' }, { fix: rebuild });
  if (pick.inner && !(isAddon && edition === 'bedrock')) {
    add('nested-archive', edition === 'java' ? 'error' : 'warning', all(edition), { params: { inner: pick.inner }, files: [pick.inner], fix: rebuild });
  } else if (pick.root && !(isAddon && edition === 'bedrock')) {
    add('nested-folder', edition === 'java' ? 'error' : 'warning', edition === 'java' ? all('java') : { edition, kind: 'some' }, { params: { folder: pick.root.replace(/\/$/, '') }, fix: rebuild });
  }
  const others = packs.filter((p) => p !== pick && (p.kind === 'java' || p.kind === 'bedrock' || p.kind === 'behavior'));
  if (others.length) {
    add('several-packs', 'info', all(edition), { params: { count: others.length + 1, checked: pick.inner ? `${pick.inner}${pick.root ? `/${pick.root}` : ''}` : pick.root || '/' }, files: others.map((p) => (p.inner ? `${p.inner}/${p.root}` : p.root || '/')) });
  }
  if (edition === 'java' && /\.(mcpack|mcaddon)$/i.test(archive.fileName)) add('java-mcpack', 'error', all('java'), { params: { ext: archive.fileName.slice(archive.fileName.lastIndexOf('.')) }, fix: rebuild });
  if (edition === 'bedrock' && /\.zip$/i.test(archive.fileName) && !pick.inner) add('bedrock-zip', 'warning', { edition: 'bedrock', kind: 'mobile' }, { fix: rebuild });
  checked.push({ code: 'zip' }, { code: 'layout' });

  readIdentity();
  if (edition !== target.edition) {
    add('wrong-edition', 'error', all(target.edition), { params: { pack: edition, game: target.edition }, link: 'converter' });
    return out;
  }

  if (edition === 'java') await checkJava();
  else await checkBedrock();
  return out;

  // -------------------------------------------------------------------------------------------

  function readIdentity() {
    const icon = files.get(edition === 'java' ? 'pack.png' : 'pack_icon.png');
    if (icon && sniffImage(icon) === 'png') out.icon = icon;
    if (edition === 'java') {
      const meta = files.get('pack.mcmeta');
      const v = meta ? (() => { try { return parseLenientJson(textOf(meta)) as { pack?: { description?: unknown } }; } catch { return null; } })() : null;
      out.description = plain(v?.pack?.description).trim();
    } else {
      const man = files.get('manifest.json');
      const v = man ? (() => { try { return parseLenientJson(textOf(man)) as { header?: { name?: unknown; description?: unknown; uuid?: unknown } }; } catch { return null; } })() : null;
      const lang = langMap(files.get('texts/en_US.lang'));
      const resolve = (x: unknown) => {
        const s = typeof x === 'string' ? x.trim() : '';
        return LANG_KEY.test(s) && lang.has(s) ? lang.get(s)! : s.replace(/§./g, '');
      };
      const name = resolve(v?.header?.name);
      if (name && !LANG_KEY.test(name)) out.name = name;
      out.description = resolve(v?.header?.description);
      if (typeof v?.header?.uuid === 'string') out.uuid = v.header.uuid.toLowerCase();
    }
  }

  // ===========================================================================================
  // Java

  async function checkJava() {
    const version = target.version;
    const tf = javaFormat(version, input.targetFormat);
    const flatTarget = isFlattened(version);
    const vanilla = input.javaVanilla ?? null;
    out.vanillaChecked = !!vanilla;

    // ---- pack.mcmeta (the fix is planned once the texture renames are known)
    const metaBytes = files.get('pack.mcmeta');
    let metaValue: unknown = null;
    let metaText = '';
    let range: PackRange | null = null;
    let metaProblem: { code: IssueCode; detail?: string; params?: Issue['params'] } | null = null;
    if (!metaBytes) {
      const misnamed = pick!.misnamedMcmeta ? pick!.misnamedMcmeta.slice(pick!.root.length) : null;
      metaProblem = misnamed ? { code: 'mcmeta-name', params: { file: misnamed } } : { code: 'mcmeta-missing' };
      if (misnamed) {
        const c = checkJson(textOf(files.get(misnamed)!));
        if (c.status !== 'invalid') {
          metaValue = c.value;
          range = readPackMcmetaRange(JSON.stringify(c.value));
        }
      }
    } else {
      metaText = textOf(metaBytes);
      const c = checkJson(metaText);
      if (c.status === 'invalid') metaProblem = { code: 'mcmeta-json', detail: `${c.line}:${c.column} ${c.message}` };
      else {
        metaValue = c.value;
        if (c.status === 'strict') metaProblem = { code: 'mcmeta-strict', params: { reason: c.reason } };
        const pack = (c.value as { pack?: unknown } | null)?.pack;
        const strictText = JSON.stringify(c.value);
        range = readPackMcmetaRange(strictText);
        if (!metaProblem) {
          if (!pack || typeof pack !== 'object' || Array.isArray(pack)) metaProblem = { code: 'mcmeta-invalid', detail: 'Missing "pack" section.' };
          else if ((pack as { description?: unknown }).description === undefined) metaProblem = { code: 'mcmeta-invalid', detail: 'No key description' };
          else if (tf && tf.major > LAST_OLD_FORMAT) {
            try {
              validatePackSection(pack);
            } catch (err) {
              metaProblem = { code: 'mcmeta-invalid', detail: err instanceof Error ? err.message : String(err) };
            }
          } else if (typeof (pack as { pack_format?: unknown }).pack_format !== 'number' || !Number.isInteger((pack as { pack_format: number }).pack_format)) {
            metaProblem = { code: 'mcmeta-invalid', detail: 'Pack requires a pack_format field' };
          }
        }
        if (!metaProblem && tf) {
          const compat = describePackForGame(strictText, tf);
          if (compat === 'broken') metaProblem = { code: 'mcmeta-invalid', detail: 'Pack could not be parsed, missing format version information' };
          else if (compat !== 'compatible') metaProblem = { code: 'format-mismatch', params: { direction: compat === 'too-old' ? 'old' : 'new' } };
        }
      }
    }
    if (range) {
      out.packFormats = formatsOf(range);
      out.packVersion = guessPackVersion(range);
    }
    const packVersion = out.packVersion;
    await step();

    // ---- texture names for the version (1.13 folders and every later rename)
    const textures = [...files.keys()].filter((p) => p.startsWith(JAVA_TEX) && p.endsWith('.png'));
    out.stats.textures = textures.length;
    const legacy = textures.filter((p) => /^assets\/minecraft\/textures\/(blocks|items)\//.test(p));
    const flat = textures.filter((p) => /^assets\/minecraft\/textures\/(block|item)\//.test(p));
    const chains = new Map<string, RenameChain>();
    const chainFrom = (from: string) => {
      let c = chains.get(from);
      if (!c) chains.set(from, (c = renameChain(input.renames, from, version)));
      return c;
    };
    const sourceOf = (rel: string): string => {
      if (/^(blocks|items)\//.test(rel)) return packVersion && !isFlattened(packVersion) ? packVersion : '1.12.2';
      if (/^(block|item)\//.test(rel)) return packVersion && isFlattened(packVersion) ? packVersion : flatTarget ? '1.13' : DEFAULT_JAVA_VERSION;
      return packVersion ?? (flatTarget ? (legacy.length > flat.length ? '1.12.2' : version) : version);
    };
    const moves = { old: [] as [string, string][], new: [] as [string, string][], renamed: [] as [string, string][] };
    const texMap: Record<string, string> = {};
    if (input.renames) {
      const taken = new Set(files.keys());
      for (const path of textures) {
        const rel = path.slice(JAVA_TEX.length, -4);
        const r = chainFrom(sourceOf(rel)).map(rel);
        if (r.kind !== 'paths' || !r.renamed || r.paths[0] === rel) continue;
        const dest = `${JAVA_TEX}${r.paths[0]}.png`;
        if (taken.has(dest)) continue;
        taken.add(dest);
        const list = /^(blocks|items)\//.test(rel) && flatTarget ? moves.old : /^(block|item)\//.test(rel) && !flatTarget ? moves.new : moves.renamed;
        list.push([path, dest]);
        if (files.has(`${path}.mcmeta`)) list.push([`${path}.mcmeta`, `${dest}.mcmeta`]);
        texMap[`minecraft:${rel}`] = `minecraft:${r.paths[0]}`;
      }
    }
    const moveFix = (m: [string, string][]): Fix => ({ safe: true, plan: { kind: 'move', moves: m } });
    const onlyPng = (m: [string, string][]) => m.filter(([a]) => a.endsWith('.png')).map(([a]) => a);
    if (flatTarget && legacy.length) {
      add('old-folders', 'broken', { edition: 'java', kind: 'from', from: '1.13' }, { params: { count: legacy.length, version }, files: legacy, ...(moves.old.length ? { fix: moveFix(moves.old) } : { link: 'converter' }) });
    } else if (!flatTarget && flat.length) {
      add('new-folders', 'broken', { edition: 'java', kind: 'upTo', to: '1.12.2' }, { params: { count: flat.length, version }, files: flat, ...(moves.new.length ? { fix: moveFix(moves.new) } : { link: 'converter' }) });
    }
    if (moves.renamed.length) {
      add('renamed-textures', 'broken', { edition: 'java', kind: 'target' }, { params: { count: onlyPng(moves.renamed).length, version, from: packVersion ?? '?' }, files: onlyPng(moves.renamed).map((p) => `${p} → ${moves.renamed.find(([a]) => a === p)![1]}`), fix: moveFix(moves.renamed) });
    }
    checked.push({ code: 'folders', count: textures.length });
    const needsRenames = moves.old.length + moves.new.length + moves.renamed.length > 0 || (flatTarget && legacy.length > 0) || (!flatTarget && flat.length > 0);

    // ---- now the pack.mcmeta fix
    if (tf) {
      const keep = range && !needsRenames ? { min: comparePackFormats(range.min, tf) < 0 ? range.min : tf, max: comparePackFormats(range.max, tf) > 0 ? range.max : tf } : null;
      // A range that reaches below 1.20.2 is read exactly by those versions: keep it only from 15 up.
      const safeKeep = keep && keep.min.major >= 15 ? keep : null;
      const fallback = salvageDescription(metaText) ?? baseName;
      const content = rebuiltMcmeta(metaValue, fallback, tf, safeKeep);
      if (metaProblem) {
        const fix: Fix =
          metaProblem.code === 'mcmeta-name'
            ? { safe: true, plan: { kind: 'move', moves: [[String(metaProblem.params!.file), 'pack.mcmeta']] } }
            : { safe: true, plan: { kind: 'write', files: { 'pack.mcmeta': content } } };
        const severity: Severity = metaProblem.code === 'format-mismatch' ? 'broken' : 'error';
        const affects: Affects = metaProblem.code === 'format-mismatch' ? { edition: 'java', kind: 'target' } : metaProblem.code === 'mcmeta-invalid' && tf.major > LAST_OLD_FORMAT ? { edition: 'java', kind: 'from', from: '1.21.9' } : all('java');
        add(metaProblem.code, severity, affects, {
          params: { ...(metaProblem.params ?? {}), version, format: formatPackFormat(tf), packFormats: out.packFormats ?? '?', packVersions: (range && versionsOf(range)) ?? '?' },
          files: ['pack.mcmeta'],
          fix,
          ...(metaProblem.detail ? { detail: metaProblem.detail } : {}),
        });
      }
    }
    checked.push({ code: 'mcmeta' }, { code: 'format' });

    // ---- file names Java refuses (capital letters, spaces, other characters)
    const strictNames = compareJavaVersions(version, '1.11') >= 0;
    const badNames: [string, string][] = [];
    const unfixable: string[] = [];
    {
      const taken = new Set(files.keys());
      for (const path of files.keys()) {
        if (!path.startsWith('assets/')) continue;
        const bad = strictNames ? /[^a-z0-9_.\-/]/.test(path) : /[A-Z]/.test(path) && path.startsWith(JAVA_TEX);
        if (!bad) continue;
        const fixed = path.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_.\-/]/g, '_');
        if (fixed === path || taken.has(fixed)) {
          unfixable.push(path);
          continue;
        }
        taken.add(fixed);
        badNames.push([path, fixed]);
      }
    }
    if (badNames.length || unfixable.length) {
      add('bad-names', 'broken', strictNames ? { edition: 'java', kind: 'from', from: '1.11' } : all('java'), {
        params: { count: badNames.length + unfixable.length },
        files: [...badNames.map(([a]) => a), ...unfixable],
        ...(badNames.length ? { fix: { safe: true, plan: { kind: 'move', moves: badNames } } } : {}),
      });
    }
    checked.push({ code: 'names', count: files.size });

    // ---- textures in the wrong folder
    const misplaced: [string, string][] = [];
    {
      const rules: [RegExp, string][] = [
        [/^textures\/((?:block|blocks|item|items|entity|gui|environment|misc|painting|particle|mob_effect|models|font|colormap|map)\/.+)$/, JAVA_TEX],
        [/^assets\/textures\/(.+)$/, JAVA_TEX],
        [/^minecraft\/textures\/(.+)$/, JAVA_TEX],
        [/^assets\/minecraft\/texture\/(.+)$/, JAVA_TEX],
        [/^assets\/minecraft\/((?:block|blocks|item|items|entity|gui)\/.+\.png(?:\.mcmeta)?)$/, JAVA_TEX],
      ];
      for (const path of files.keys()) {
        for (const [re, prefix] of rules) {
          const m = re.exec(path);
          if (!m) continue;
          const dest = prefix + m[1];
          if (!files.has(dest)) misplaced.push([path, dest]);
          break;
        }
      }
    }
    if (misplaced.length) add('misplaced-textures', 'broken', all('java'), { params: { count: misplaced.length }, files: misplaced.map(([a, b]) => `${a} → ${b}`), fix: { safe: true, plan: { kind: 'move', moves: misplaced } } });
    await step();

    // ---- JSON files
    const parsed = new Map<string, unknown>();
    const invalid: { path: string; detail: string }[] = [];
    const strict: Record<string, string> = {};
    for (const [path, bytes] of files) {
      if (path === 'pack.mcmeta' || !/\.(json|mcmeta)$/i.test(path)) continue;
      out.stats.json++;
      const c = checkJson(textOf(bytes));
      if (c.status === 'invalid') invalid.push({ path, detail: `${path} ${c.line}:${c.column} ${c.message}` });
      else {
        parsed.set(path, c.value);
        if (c.status === 'strict') strict[path] = stringifyPretty(c.value);
      }
      await step();
    }
    if (invalid.length) add('json-syntax', 'broken', all('java'), { params: { count: invalid.length }, files: invalid.map((i) => i.path), detail: invalid[0].detail });
    if (Object.keys(strict).length) add('json-strict', 'warning', all('java'), { params: { count: Object.keys(strict).length }, files: Object.keys(strict), fix: { safe: true, plan: { kind: 'write', files: strict } } });
    checked.push({ code: 'json', count: out.stats.json });

    // ---- references between files (needs the game's own file names for minecraft: references)
    const has = (file: string) => files.has(file) || !!vanilla?.files.has(file);
    const packAtlas: unknown[] = [];
    for (const p of ['assets/minecraft/atlases/blocks.json', 'assets/minecraft/atlases/items.json']) {
      const v = parsed.get(p) as { sources?: unknown } | undefined;
      if (Array.isArray(v?.sources)) packAtlas.push(...v.sources);
    }
    const atlas = vanilla?.atlas ? [...vanilla.atlas, ...packAtlas] : null;
    const missingTex: string[] = [];
    const missingModel: string[] = [];
    const refFix = { textures: {} as Record<string, string>, models: {} as Record<string, string> };
    const outsideAtlas = new Set<string>();
    const atlasFiles: string[] = [];
    let refCount = 0;
    // An old name in a model: renamed from the oldest version that used that folder layout.
    const refSource = (rel: string): string => {
      if (/^(blocks|items)\//.test(rel)) return packVersion && !isFlattened(packVersion) ? packVersion : '1.12.2';
      if (/^(block|item)\//.test(rel)) return flatTarget ? '1.13' : DEFAULT_JAVA_VERSION;
      return packVersion ?? version;
    };
    const renamed = (rel: string): string | null => {
      const r = chainFrom(refSource(rel)).map(rel);
      return r.kind === 'paths' && r.renamed ? r.paths[0] : null;
    };
    for (const [path, value] of parsed) {
      const kind: JsonFileKind = jsonKind(path);
      if (kind === 'other') continue;
      for (const r of collectRefs(kind, value)) {
        refCount++;
        const c = canonical(kind === 'font' ? r.ref.replace(/\.png$/i, '') : r.ref);
        const ns = c.slice(0, c.indexOf(':'));
        const rel = c.slice(ns.length + 1);
        if (r.kind === 'texture') {
          const file = textureFile(c);
          const generated = !!atlas && atlasGenerates(atlas, c);
          if (ns === 'minecraft' && vanilla && !has(file) && !generated && !texMap[c]) {
            const next = renamed(rel);
            if (next && has(textureFile(`minecraft:${next}`))) refFix.textures[c] = `minecraft:${next}`;
            missingTex.push(`${path} → ${r.ref}`);
          }
          // 1.19.3+: textures of block and item models must be on an atlas.
          if (kind === 'model' && atlas && has(file) && !ATLAS_DIRS.test(rel) && !atlasCovers(atlas, c)) {
            outsideAtlas.add(rel.slice(0, rel.lastIndexOf('/')) || rel);
            atlasFiles.push(`${path} → ${r.ref}`);
          }
        } else {
          const ref = kind === 'blockstate' && !flatTarget && !rel.includes('/') ? `${ns}:block/${rel}` : c;
          const file = modelFile(ref);
          if (ns === 'minecraft' && vanilla && !has(file)) missingModel.push(`${path} → ${r.ref}`);
        }
      }
      await step();
    }
    out.stats.refs = refCount;
    if (missingTex.length) {
      const fixable = Object.keys(refFix.textures).length;
      add('missing-texture-ref', 'broken', { edition: 'java', kind: 'target' }, { params: { count: missingTex.length, version }, files: missingTex, ...(fixable ? { fix: { safe: true, plan: { kind: 'move', moves: [], refs: refFix } } } : {}) });
    }
    if (missingModel.length) add('missing-model-ref', 'broken', { edition: 'java', kind: 'target' }, { params: { count: missingModel.length, version }, files: missingModel });
    if (outsideAtlas.size) {
      const dirs = [...outsideAtlas].sort();
      const write: Record<string, string> = {};
      const targets = ['assets/minecraft/atlases/blocks.json', ...(vanilla?.files.has('assets/minecraft/atlases/items.json') ? ['assets/minecraft/atlases/items.json'] : [])];
      for (const p of targets) {
        const own = (parsed.get(p) as Record<string, unknown> | undefined) ?? {};
        const sources = Array.isArray(own.sources) ? [...own.sources] : [];
        for (const d of dirs) sources.push({ type: 'minecraft:directory', source: d, prefix: `${d}/` });
        write[p] = stringifyPretty({ ...own, sources });
      }
      add('atlas-missing', 'broken', { edition: 'java', kind: 'from', from: '1.19.3' }, { params: { count: atlasFiles.length, folders: dirs.join(', ') }, files: atlasFiles, fix: { safe: true, plan: { kind: 'write', files: write } } });
    }
    if (vanilla || refCount) checked.push({ code: 'refs', count: refCount });

    // ---- images
    await checkImages('java');

    // ---- sounds
    const badSounds: string[] = [];
    let sounds = 0;
    for (const [path, bytes] of files) {
      if (!/^assets\/[^/]+\/sounds\//.test(path)) continue;
      if (path.endsWith('.ogg')) {
        sounds++;
        if (!isOgg(bytes)) badSounds.push(path);
      } else if (SOUND_EXT.test(path)) badSounds.push(path);
    }
    if (badSounds.length) add('sound-format', 'broken', all('java'), { params: { count: badSounds.length }, files: badSounds, link: 'sounds' });
    if (sounds) checked.push({ code: 'sounds', count: sounds });

    // ---- overlays, shaders, OptiFine
    const overlays = (metaValue as { overlays?: { entries?: unknown } } | null)?.overlays?.entries;
    if (Array.isArray(overlays)) {
      const missing = overlays.map((e) => (e && typeof e === 'object' ? (e as { directory?: unknown }).directory : null)).filter((d): d is string => typeof d === 'string' && ![...files.keys()].some((p) => p.startsWith(`${d}/`)));
      if (missing.length) add('overlay-missing', 'warning', all('java'), { params: { count: missing.length }, files: missing });
    }
    const shaders = [...files.keys()].filter((p) => /^assets\/minecraft\/(shaders\/(core|program|include|post)|post_effect)\//.test(p));
    if (shaders.length) add('core-shaders', 'warning', { edition: 'java', kind: 'target' }, { params: { count: shaders.length, from: packVersion ?? version }, files: shaders, link: 'shaders-help' });
    const optifine = [...files.keys()].filter((p) => /^assets\/minecraft\/(optifine|mcpatcher)\//.test(p));
    if (optifine.length) add('optifine', 'info', all('java'), { params: { count: optifine.length } });
  }

  // ===========================================================================================
  // Bedrock

  async function checkBedrock() {
    const vanilla = input.bedrockVanilla ?? null;
    out.vanillaChecked = !!vanilla;
    const newest = vanilla?.version ? engineVersionOf(vanilla.version) : null;

    // ---- manifest.json
    const bytes = files.get('manifest.json');
    let value: unknown = null;
    let raw = '';
    if (!bytes) {
      const misnamed = pick!.misnamedManifest ? pick!.misnamedManifest.slice(pick!.root.length) : null;
      if (misnamed) add('manifest-name', 'error', all('bedrock'), { params: { file: misnamed }, files: [misnamed], fix: { safe: true, plan: { kind: 'move', moves: [[misnamed, 'manifest.json']] } } });
      else {
        const uuids = newBedrockUuids();
        add('manifest-missing', 'error', all('bedrock'), { files: ['manifest.json'], fix: { safe: true, plan: { kind: 'write', files: { 'manifest.json': buildResourceManifest({ name: baseName, description: '', uuids, version: [1, 0, 0], minEngine: [...DEFAULT_MIN_ENGINE] }) } } } });
      }
    } else {
      raw = textOf(bytes);
      try {
        value = parseLenientJson(raw);
      } catch {
        const c = checkJson(raw);
        add('manifest-json', 'error', all('bedrock'), { files: ['manifest.json'], detail: c.status === 'invalid' ? `${c.line}:${c.column} ${c.message}` : undefined, fix: { safe: true, plan: { kind: 'write', files: { 'manifest.json': repairedManifest(null, baseName, { raw, newestEngine: newest }) } } } });
      }
    }
    if (value !== null) {
      const fix: Fix = { safe: true, plan: { kind: 'write', files: { 'manifest.json': repairedManifest(value, baseName, { newestEngine: newest }) } } };
      const m = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
      const fv = m.format_version;
      const one = (code: IssueCode, severity: Severity, params: Issue['params'] = {}) => add(code, severity, all('bedrock'), { params, files: ['manifest.json'], fix });
      if (fv !== 1 && fv !== 2 && fv !== 3) one('manifest-format', 'error', { value: fv === undefined ? '—' : JSON.stringify(fv) });
      const header = m.header && typeof m.header === 'object' && !Array.isArray(m.header) ? (m.header as Record<string, unknown>) : null;
      if (!header) one('manifest-header', 'error', { reason: 'missing' });
      else {
        const versionOk = fv === 3 ? typeof header.version === 'string' ? /^\d+\.\d+\.\d+/.test(header.version) : isVec3(header.version) : isVec3(header.version);
        if (!versionOk) one('manifest-header', 'error', { reason: 'version' });
        else if (typeof header.name !== 'string' || !header.name.trim()) one('manifest-header', 'error', { reason: 'name' });
        const modules = Array.isArray(m.modules) ? (m.modules as unknown[]).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];
        const res = modules.find((x) => x.type === 'resources');
        if (!res) one('manifest-modules', 'error', { found: modules.map((x) => String(x.type ?? '?')).join(', ') || '—' });
        const ids = [header.uuid, ...modules.map((x) => x.uuid)];
        if (!ids.every(isUuid)) one('manifest-uuid', 'error', { reason: 'invalid' });
        else if (new Set(ids.map((x) => String(x).toLowerCase())).size < ids.length) one('manifest-uuid', 'error', { reason: 'same' });
        else if (res && !isUuid(res.uuid)) one('manifest-uuid', 'error', { reason: 'invalid' });
        if (fv !== 1) {
          const e = header.min_engine_version;
          const vec = isVec3(e) ? (e as [number, number, number]) : typeof e === 'string' ? parseBedrockVersion(e) : null;
          if (e === undefined) add('manifest-engine', 'warning', all('bedrock'), { params: { reason: 'missing', engine: DEFAULT_MIN_ENGINE.join('.') }, files: ['manifest.json'], fix });
          else if (!vec) one('manifest-engine', 'error', { reason: 'invalid', engine: DEFAULT_MIN_ENGINE.join('.') });
          else if (newest && engineTooNew(vec, newest)) one('manifest-engine', 'error', { reason: 'new', value: vec.join('.'), newest: vanilla!.version.split('.').slice(0, 3).join('.'), engine: DEFAULT_MIN_ENGINE.join('.') });
        }
        // Name shown as a language key that the pack doesn't define
        const name = typeof header.name === 'string' ? header.name.trim() : '';
        if (name && LANG_KEY.test(name) && !langMap(files.get('texts/en_US.lang')).has(name)) {
          add('pack-name-key', 'warning', all('bedrock'), { params: { key: name, name: baseName }, files: ['manifest.json'], fix: { safe: true, plan: { kind: 'write', files: { 'manifest.json': repairedManifest(value, baseName, { name: baseName, newestEngine: newest }) } } } });
        }
        // Sub-packs that point at missing folders
        if (Array.isArray(m.subpacks)) {
          const missing = (m.subpacks as unknown[]).map((s) => (s && typeof s === 'object' ? (s as { folder_name?: unknown }).folder_name : null)).filter((d): d is string => typeof d === 'string' && ![...files.keys()].some((p) => p.startsWith(`subpacks/${d}/`)));
          if (missing.length) add('subpack-missing', 'broken', all('bedrock'), { params: { count: missing.length }, files: missing.map((d) => `subpacks/${d}/`) });
        }
      }
    }
    checked.push({ code: 'manifest' });

    // ---- UUIDs shared with another pack
    const uuid = pick!.uuid ?? null;
    if (uuid) {
      const twins = out.packs.filter((p) => p !== pick && p.uuid === uuid);
      if (twins.length) add('duplicate-uuid', 'error', all('bedrock'), { params: { count: twins.length + 1 }, files: twins.map((p) => `${p.inner ? `${p.inner}/` : ''}${p.root}manifest.json`), fix: { safe: true, plan: { kind: 'uuids' } } });
      else {
        const seen = input.knownUuids?.[uuid];
        if (seen !== undefined && seen !== out.name && seen !== baseName) add('known-uuid', 'warning', all('bedrock'), { params: { other: seen }, fix: { safe: false, plan: { kind: 'uuids' } } });
      }
      checked.push({ code: 'uuids' });
    }
    await step();

    // ---- JSON (Bedrock reads comments; only what no reader understands is broken)
    const parsed = new Map<string, unknown>();
    const invalid: { path: string; detail: string }[] = [];
    for (const [path, b] of files) {
      if (path === 'manifest.json' || !path.endsWith('.json')) continue;
      out.stats.json++;
      try {
        parsed.set(path, parseLenientJson(textOf(b)));
      } catch {
        const c = checkJson(textOf(b));
        invalid.push({ path, detail: c.status === 'invalid' ? `${path} ${c.line}:${c.column} ${c.message}` : path });
      }
      await step();
    }
    if (invalid.length) add('json-syntax', 'broken', all('bedrock'), { params: { count: invalid.length }, files: invalid.map((i) => i.path), detail: invalid[0].detail });
    checked.push({ code: 'json', count: out.stats.json });

    // ---- texture lists and their paths
    const lower = new Map<string, string>();
    for (const p of files.keys()) lower.set(p.toLowerCase(), p);
    const exists = (stem: string) => files.has(`${stem}.png`) || files.has(`${stem}.tga`) || files.has(stem) || !!vanilla && (vanilla.files.has(`${stem}.png`) || vanilla.files.has(`${stem}.tga`) || vanilla.files.has(stem));
    const caseOf = (stem: string): string | null => {
      for (const e of ['.png', '.tga', '']) {
        const hit = lower.get(`${stem}${e}`.toLowerCase()) ?? vanilla?.lower.get(`${stem}${e}`.toLowerCase());
        if (hit) return e ? hit.slice(0, -e.length) : hit;
      }
      return null;
    };
    const structure: string[] = [];
    const missingRefs: string[] = [];
    const caseRefs: Record<string, Record<string, string>> = {};
    let caseCount = 0;
    let refCount = 0;
    const checkPath = (file: string, p: unknown) => {
      if (typeof p !== 'string' || !p) return;
      refCount++;
      const stem = p.replace(/\.(png|tga)$/i, '');
      if (exists(stem)) return;
      const actual = caseOf(stem);
      if (actual && actual !== stem) {
        (caseRefs[file] ??= {})[p] = actual + (p.length > stem.length ? p.slice(stem.length) : '');
        caseCount++;
      } else if (vanilla) missingRefs.push(`${file} → ${p}`);
    };
    for (const file of ['textures/terrain_texture.json', 'textures/item_texture.json']) {
      if (!parsed.has(file)) continue;
      const v = parsed.get(file) as { texture_data?: unknown } | null;
      const data = v?.texture_data;
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        structure.push(file);
        continue;
      }
      for (const entry of Object.values(data as Record<string, unknown>)) {
        const t = (entry as { textures?: unknown } | null)?.textures;
        const list = Array.isArray(t) ? t : [t];
        for (const x of list) {
          if (typeof x === 'string') checkPath(file, x);
          else if (x && typeof x === 'object') {
            const o = x as { path?: unknown; variations?: unknown };
            if (typeof o.path === 'string') checkPath(file, o.path);
            if (Array.isArray(o.variations)) for (const vv of o.variations) checkPath(file, (vv as { path?: unknown } | null)?.path);
          } else if (x !== undefined) structure.push(file);
        }
      }
    }
    const flip = 'textures/flipbook_textures.json';
    if (parsed.has(flip)) {
      const v = parsed.get(flip);
      if (!Array.isArray(v)) structure.push(flip);
      else for (const e of v) checkPath(flip, (e as { flipbook_texture?: unknown } | null)?.flipbook_texture);
    }
    if (structure.length) add('texture-list', 'broken', all('bedrock'), { params: { count: structure.length }, files: [...new Set(structure)] });
    if (missingRefs.length) add('bedrock-missing-ref', 'broken', all('bedrock'), { params: { count: missingRefs.length }, files: missingRefs });
    if (caseCount) add('bedrock-case', 'broken', { edition: 'bedrock', kind: 'mobile' }, { params: { count: caseCount, what: 'refs' }, files: Object.entries(caseRefs).flatMap(([f, m]) => Object.entries(m).map(([a, b]) => `${f}: ${a} → ${b}`)), fix: { safe: true, plan: { kind: 'refs', files: caseRefs } } });
    out.stats.refs = refCount;
    if (refCount || structure.length) checked.push({ code: 'texture-lists', count: refCount });

    // ---- texture files whose case differs from the game's
    if (vanilla) {
      const moves: [string, string][] = [];
      for (const path of files.keys()) {
        if (!/^textures\//i.test(path) || vanilla.files.has(path)) continue;
        const v = vanilla.lower.get(path.toLowerCase());
        if (v && v !== path && !files.has(v)) moves.push([path, v]);
      }
      if (moves.length) add('bedrock-case', 'broken', { edition: 'bedrock', kind: 'mobile' }, { params: { count: moves.length, what: 'files' }, files: moves.map(([a, b]) => `${a} → ${b}`), fix: { safe: true, plan: { kind: 'move', moves } } });
    }

    // ---- other Bedrock things
    const javaTex = [...files.keys()].filter((p) => p.startsWith(JAVA_TEX));
    if (javaTex.length) add('java-in-bedrock', 'broken', all('bedrock'), { params: { count: javaTex.length }, files: javaTex, link: 'converter' });
    const stems = new Map<string, string[]>();
    for (const p of files.keys()) {
      const m = /^(textures\/.+)\.(png|tga)$/i.exec(p);
      if (m) stems.set(m[1], [...(stems.get(m[1]) ?? []), p]);
    }
    const pairs = [...stems.values()].filter((l) => l.length > 1);
    if (pairs.length) add('tga-png-pair', 'warning', all('bedrock'), { params: { count: pairs.length }, files: pairs.map((l) => l.join(' + ')) });
    const long = [...files.keys()].filter((p) => p.length > 80);
    if (long.length) add('long-paths', 'warning', { edition: 'bedrock', kind: 'some' }, { params: { count: long.length }, files: long });
    const materials = [...files.keys()].filter((p) => /\.material\.bin$/i.test(p));
    if (materials.length) add('material-bin', 'warning', all('bedrock'), { params: { count: materials.length }, files: materials });
    out.stats.textures = [...files.keys()].filter((p) => /^textures\/.+\.(png|tga)$/i.test(p)).length;

    await checkImages('bedrock');
  }

  // ===========================================================================================
  // Images (both editions)

  async function checkImages(ed: Edition) {
    const root = ed === 'java' ? 'assets/' : 'textures/';
    const atlasTex = ed === 'java' ? /^assets\/minecraft\/textures\/(block|blocks|item|items)\// : /^textures\/(blocks|items)\//;
    const notPng: string[] = [];
    const wrongType: [string, string][] = [];
    const broken: string[] = [];
    const format: string[] = [];
    const npot: string[] = [];
    const strips: Record<string, string> = {};
    const stripFiles: string[] = [];
    const animSize: string[] = [];
    const animFix: Record<string, string> = {};
    let images = 0;
    let animations = 0;
    const flipbook = new Set<string>();
    if (ed === 'bedrock') {
      try {
        const v = parseLenientJson(textOf(files.get('textures/flipbook_textures.json') ?? new Uint8Array())) as unknown[];
        if (Array.isArray(v)) for (const e of v) if (typeof (e as { flipbook_texture?: unknown })?.flipbook_texture === 'string') flipbook.add((e as { flipbook_texture: string }).flipbook_texture);
      } catch {
        /* reported with the JSON */
      }
    }
    for (const [path, bytes] of files) {
      if (!path.startsWith(root) || !IMAGE_EXT.test(path)) continue;
      const e = ext(path);
      if (ed === 'bedrock' && /_(mers?|normal|heightmap)\.(png|tga)$/i.test(path)) continue;
      images++;
      const kind = sniffImage(bytes);
      if (e === 'png') {
        if (kind !== 'png') {
          if (kind === 'other') broken.push(path);
          else notPng.push(path);
          continue;
        }
      } else if (e === 'tga' && ed === 'bedrock') {
        if (kind !== 'tga') {
          if (kind === 'png') continue; // a PNG named .tga: Bedrock reads it by content
          broken.push(path);
        }
        const size = tgaSize(bytes);
        if (size && atlasTex.test(path) && !isPowerOfTwo(size.w)) npot.push(path);
        continue;
      } else {
        if (ed === 'bedrock' && (e === 'jpg' || e === 'jpeg')) continue;
        const dest = path.replace(/\.[^./]+$/, '.png');
        if (!files.has(dest) && kind !== 'other') wrongType.push([path, dest]);
        else broken.push(path);
        continue;
      }
      const info = inspectPng(bytes);
      if (info.problem) {
        broken.push(path);
        continue;
      }
      if (info.bitDepth === 16 || info.interlaced) format.push(path);
      const { width: w, height: h } = info;
      const meta = ed === 'java' ? files.get(`${path}.mcmeta`) : undefined;
      if (ed === 'java' && meta) {
        animations++;
        let anim = null;
        try {
          anim = parseJavaAnimation(parseLenientJson(textOf(meta)));
        } catch {
          /* reported with the JSON */
        }
        if (anim) {
          const { fw, fh } = javaFrameSize(anim, w, h);
          if (!fw || !fh || w % fw || h % fh) animSize.push(`${path} (${w}×${h}, ${fw}×${fh})`);
          else {
            const count = (w / fw) * (h / fh);
            const raw = (parseLenientJson(textOf(meta)) as { animation?: Record<string, unknown> }).animation ?? {};
            const frames = Array.isArray(raw.frames) ? raw.frames : null;
            const bad = frames?.filter((f) => {
              const i = typeof f === 'number' ? f : (f as { index?: unknown } | null)?.index;
              return typeof i !== 'number' || i < 0 || i >= count;
            });
            const badTime = raw.frametime !== undefined && !(typeof raw.frametime === 'number' && raw.frametime >= 1);
            if ((bad && bad.length) || badTime) {
              const next = { ...raw };
              if (frames && bad?.length) {
                const kept = frames.filter((f) => !bad.includes(f));
                if (kept.length) next.frames = kept;
                else delete next.frames;
              }
              if (badTime) next.frametime = 1;
              const root = parseLenientJson(textOf(meta)) as Record<string, unknown>;
              animFix[`${path}.mcmeta`] = stringifyPretty({ ...root, animation: next });
            }
          }
        }
      }
      if (!atlasTex.test(path)) continue;
      const strip = h > w && h % w === 0;
      if (!isPowerOfTwo(w) || (!strip && !meta && !isPowerOfTwo(h))) npot.push(`${path} (${w}×${h})`);
      if (ed === 'java' && strip && !meta && h >= w * 2) {
        strips[`${path}.mcmeta`] = stringifyPretty({ animation: { frametime: 2 } });
        stripFiles.push(`${path} (${w}×${h})`);
      }
      if (ed === 'bedrock' && strip && flipbook.size && !flipbook.has(path.replace(/\.png$/i, ''))) {
        /* Bedrock strips are listed in flipbook_textures.json; vanilla ones may be animated by the game's own list */
      }
      await step();
    }
    const icon = files.get(ed === 'java' ? 'pack.png' : 'pack_icon.png');
    const iconName = ed === 'java' ? 'pack.png' : 'pack_icon.png';
    if (icon) {
      const k = sniffImage(icon);
      if (k !== 'png') add('pack-icon', 'warning', all(ed), { params: { file: iconName }, files: [iconName], ...(k !== 'other' ? { fix: { safe: true, plan: { kind: 'images', images: [[iconName, iconName]] } } } : {}) });
      else if (inspectPng(icon).problem) add('pack-icon', 'warning', all(ed), { params: { file: iconName }, files: [iconName] });
    }
    const affected: Affects = all(ed);
    if (notPng.length) add('not-png', 'broken', affected, { params: { count: notPng.length }, files: notPng, fix: { safe: true, plan: { kind: 'images', images: notPng.map((p) => [p, p]) } } });
    if (wrongType.length) add('wrong-image-type', 'broken', affected, { params: { count: wrongType.length }, files: wrongType.map(([a]) => a), fix: { safe: true, plan: { kind: 'images', images: wrongType } } });
    if (broken.length) add('broken-image', 'broken', affected, { params: { count: broken.length }, files: broken });
    if (format.length) add('png-format', 'warning', { edition: ed, kind: 'some' }, { params: { count: format.length }, files: format, fix: { safe: true, plan: { kind: 'images', images: format.map((p) => [p, p]) } } });
    if (npot.length) add('not-power-of-two', 'warning', affected, { params: { count: npot.length }, files: npot, link: 'textures' });
    if (stripFiles.length) add('anim-strip', 'broken', affected, { params: { count: stripFiles.length }, files: stripFiles, fix: { safe: false, plan: { kind: 'write', files: strips } } });
    if (animSize.length) add('anim-size', 'broken', affected, { params: { count: animSize.length }, files: animSize });
    if (Object.keys(animFix).length) add('anim-frames', 'warning', affected, { params: { count: Object.keys(animFix).length }, files: Object.keys(animFix), fix: { safe: true, plan: { kind: 'write', files: animFix } } });
    checked.push({ code: 'images', count: images });
    if (animations) checked.push({ code: 'animations', count: animations });
  }
}

function langMap(bytes: Uint8Array | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!bytes) return map;
  for (const line of textOf(bytes).split(/\r?\n/)) {
    if (!line || line.startsWith('##')) continue;
    const eq = line.indexOf('=');
    if (eq > 0) map.set(line.slice(0, eq).trim(), line.slice(eq + 1).replace(/\t+#.*$/, '').trim());
  }
  return map;
}

// ---------------------------------------------------------------------------------------------
// Counting

export function countBySeverity(issues: Issue[]): Record<Severity, number> {
  const out: Record<Severity, number> = { error: 0, broken: 0, warning: 0, info: 0 };
  for (const i of issues) out[i.severity]++;
  return out;
}

/** No problem that matters: notes ('info') don't count. */
export function looksGood(issues: Issue[]): boolean {
  return !issues.some((i) => i.severity !== 'info');
}
