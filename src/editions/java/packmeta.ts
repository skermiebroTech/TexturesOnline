import type { PackFormat } from '../../core/types';
import { bundledPackFormat, comparePackFormats, legacyRpFormatForRelease, legacyRpFormatForSnapshot, packFormatFromVersionJson, FIRST_VERSION_JSON_TIME } from './packformats';

/*
 * pack.mcmeta rules (Java):
 *  - ≤ 1.20.1 (formats ≤ 15): pack_format only, exact match.
 *  - 1.20.2 – 1.21.8 (16 – 64): pack_format (required) + optional supported_formats.
 *  - 1.21.9+ (65+): min_format + max_format required. A range reaching below 65 must also carry
 *    pack_format + supported_formats (and the main format must be ≥ 15); a new-only range must not
 *    carry supported_formats.
 */

/** Resource formats ≤ this are "old style" (no minor versions). */
export const LAST_OLD_FORMAT = 64;
/** Main format floor for multi-version packs checked by 1.21.9+. */
export const MIN_MULTI_VERSION_FORMAT = 15;
const ANY_MINOR = 0x7fffffff;

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** JSON with two-space indent, keeping short number arrays on one line. */
export function stringifyPretty(value: unknown): string {
  const walk = (v: unknown, indent: string): string => {
    if (Array.isArray(v)) {
      if (v.every((x) => typeof x === 'number' || typeof x === 'string')) return `[${v.map((x) => JSON.stringify(x)).join(', ')}]`;
      const inner = indent + '  ';
      return `[\n${v.map((x) => inner + walk(x, inner)).join(',\n')}\n${indent}]`;
    }
    if (v && typeof v === 'object') {
      const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
      if (!entries.length) return '{}';
      const inner = indent + '  ';
      return `{\n${entries.map(([k, x]) => `${inner}${JSON.stringify(k)}: ${walk(x, inner)}`).join(',\n')}\n${indent}}`;
    }
    return JSON.stringify(v);
  };
  return walk(value, '') + '\n';
}

function minFormatValue(f: PackFormat): Json {
  return f.minor > 0 ? [f.major, f.minor] : f.major;
}

function cleanDescription(description: string): string {
  return (description ?? '').replace(/\r\n?/g, '\n');
}

/**
 * Builds pack.mcmeta for one target format, or for a compatibility range of formats.
 * max_format is always a bare integer (= any minor), min_format carries a minor only when > 0.
 * The range is widened to include the target: the pack always works on the version it was made for.
 */
export function buildPackMcmeta(opts: { description: string; target: PackFormat; range?: { min: PackFormat; max: PackFormat } }): string {
  const description = cleanDescription(opts.description);
  const target = opts.target;
  let lo = opts.range?.min ?? target;
  let hi = opts.range?.max ?? target;
  if (comparePackFormats(lo, hi) > 0) [lo, hi] = [hi, lo];
  if (comparePackFormats(target, lo) < 0) lo = target;
  if (comparePackFormats(target, hi) > 0) hi = target;
  const pack: Record<string, Json> = {};

  if (lo.major > LAST_OLD_FORMAT) {
    // 1.21.9+ only.
    pack.description = description;
    pack.min_format = minFormatValue(lo);
    pack.max_format = hi.major;
  } else if (hi.major > LAST_OLD_FORMAT) {
    // Spans old and new eras: every field, main format clamped to ≥ 15 (1.21.9+ rejects lower).
    const main = Math.max(lo.major, MIN_MULTI_VERSION_FORMAT);
    pack.description = description;
    pack.pack_format = main;
    pack.supported_formats = [main, hi.major];
    pack.min_format = main;
    pack.max_format = hi.major;
  } else if (lo.major === hi.major || hi.major <= MIN_MULTI_VERSION_FORMAT) {
    // Single format, or a range only pre-1.20.2 games read (they compare pack_format exactly).
    pack.pack_format = target.major;
    pack.description = description;
  } else {
    // 1.20.2 – 1.21.8 style range. Older games in range compare pack_format exactly, so it names
    // the target when the target is one of them, else the oldest format in range.
    pack.pack_format = target.major <= MIN_MULTI_VERSION_FORMAT ? target.major : lo.major;
    pack.supported_formats = [lo.major, hi.major];
    pack.description = description;
  }
  return stringifyPretty({ pack });
}

// ---- Validation (port of 26.3 PackFormat.IntermediaryFormat.validate for resource packs) ----

export interface PackRange {
  min: PackFormat;
  max: PackFormat;
}

function parseFormatField(v: unknown, defaultMinor: number): PackFormat | null | 'invalid' {
  if (v === undefined) return null;
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return { major: v, minor: defaultMinor };
  if (Array.isArray(v) && v.length >= 1 && v.length <= 256 && v.every((x) => typeof x === 'number' && Number.isInteger(x) && x >= 0))
    return { major: v[0], minor: v.length > 1 ? v[1] : defaultMinor };
  return 'invalid';
}

function parseInterval(v: unknown): { min: number; max: number } | null | 'invalid' {
  if (v === undefined) return null;
  if (typeof v === 'number' && Number.isInteger(v)) return { min: v, max: v };
  if (Array.isArray(v)) {
    if (v.length !== 2 || !v.every((x) => typeof x === 'number' && Number.isInteger(x))) return 'invalid';
    return v[0] <= v[1] ? { min: v[0], max: v[1] } : 'invalid';
  }
  if (v && typeof v === 'object') {
    const o = v as { min_inclusive?: unknown; max_inclusive?: unknown };
    if (typeof o.min_inclusive === 'number' && typeof o.max_inclusive === 'number' && o.min_inclusive <= o.max_inclusive)
      return { min: o.min_inclusive, max: o.max_inclusive };
  }
  return 'invalid';
}

function fmtLabel(f: PackFormat): string {
  return `${f.major}.${f.minor === ANY_MINOR ? '*' : f.minor}`;
}

/**
 * Validates the `pack` section exactly as Minecraft 1.21.9 – 26.3 does and returns the declared
 * range. Throws with the game's reason when the pack would show as "(Broken or incompatible)".
 */
export function validatePackSection(pack: unknown): PackRange {
  if (!pack || typeof pack !== 'object') throw new Error('Missing "pack" section.');
  const p = pack as Record<string, unknown>;
  if (p.description === undefined) throw new Error('No key description');
  const min = parseFormatField(p.min_format, 0);
  const max = parseFormatField(p.max_format, ANY_MINOR);
  if (min === 'invalid' || max === 'invalid') throw new Error('Invalid min_format/max_format.');
  if (p.pack_format !== undefined && !(typeof p.pack_format === 'number' && Number.isInteger(p.pack_format))) throw new Error('Invalid pack_format.');
  const fmt = p.pack_format as number | undefined;
  const sup = parseInterval(p.supported_formats);
  if (sup === 'invalid') throw new Error('Invalid supported_formats.');
  const checkMain = (f: number, lo: number, hi: number) => {
    if (f < lo || f > hi) throw new Error(`Pack declared support for versions ${lo} to ${hi} but declared main format is ${f}`);
    if (f < MIN_MULTI_VERSION_FORMAT)
      throw new Error('Multi-version packs cannot support minimum version of less than 15, since this will leave versions in range unable to load pack.');
  };
  if (!!min !== !!max) throw new Error('Pack missing field, must declare both min_format and max_format');
  if (min && max) {
    if (comparePackFormats(min, max) > 0) throw new Error('min_format is greater than max_format');
    if (min.major > LAST_OLD_FORMAT) {
      if (sup) throw new Error('Pack key supported_formats is deprecated starting from pack format 65. Remove supported_formats from your pack.mcmeta.');
      if (fmt !== undefined) checkMain(fmt, min.major, max.major);
    } else {
      if (!sup)
        throw new Error(`Pack declares support for format ${min.major}, but game versions supporting formats ${min.major} to ${LAST_OLD_FORMAT} require a supported_formats field. Add "supported_formats": [${min.major}, ${LAST_OLD_FORMAT}] or require a version greater or equal to ${LAST_OLD_FORMAT + 1}.0.`);
      if (sup.min !== min.major) throw new Error(`Pack version declaration mismatch between supported_formats (from ${sup.min}) and min_format (${fmtLabel(min)})`);
      if (sup.max !== max.major && sup.max !== LAST_OLD_FORMAT) throw new Error(`Pack version declaration mismatch between supported_formats (up to ${sup.max}) and max_format (${fmtLabel(max)})`);
      if (fmt === undefined)
        throw new Error(`Pack declares support for formats up to ${LAST_OLD_FORMAT}, but game versions supporting formats ${min.major} to ${LAST_OLD_FORMAT} require a pack_format field. Add "pack_format": ${min.major} or require a version greater or equal to ${LAST_OLD_FORMAT + 1}.0.`);
      checkMain(fmt, min.major, max.major);
    }
    return { min, max };
  }
  if (sup) {
    if (sup.max > LAST_OLD_FORMAT) throw new Error('Pack declares support for version newer than 64, but is missing mandatory fields min_format and max_format');
    if (fmt === undefined) throw new Error('Pack requires a pack_format field');
    checkMain(fmt, sup.min, sup.max);
    return { min: { major: sup.min, minor: 0 }, max: { major: sup.max, minor: 0 } };
  }
  if (fmt !== undefined) {
    if (fmt > LAST_OLD_FORMAT) throw new Error('Pack declares support for version newer than 64, but is missing mandatory fields min_format and max_format');
    return { min: { major: fmt, minor: 0 }, max: { major: fmt, minor: 0 } };
  }
  throw new Error('Pack could not be parsed, missing format version information');
}

export type PackCompatibility = 'compatible' | 'too-old' | 'too-new';

export function packCompatibility(range: PackRange, game: PackFormat): PackCompatibility {
  if (comparePackFormats(range.max, game) < 0) return 'too-old';
  if (comparePackFormats(game, range.min) < 0) return 'too-new';
  return 'compatible';
}

/**
 * How a given game version reads a pack.mcmeta: 1.21.9+ uses the validation above; 1.20.2 – 1.21.8
 * use pack_format + supported_formats (lenient); older versions compare pack_format exactly.
 */
export function describePackForGame(mcmetaText: string, game: PackFormat): PackCompatibility | 'broken' {
  let root: { pack?: Record<string, unknown> };
  try {
    root = JSON.parse(mcmetaText);
  } catch {
    return 'broken';
  }
  const pack = root?.pack;
  if (!pack || typeof pack !== 'object') return 'broken';
  if (game.major > LAST_OLD_FORMAT) {
    try {
      return packCompatibility(validatePackSection(pack), game);
    } catch {
      return 'broken';
    }
  }
  const fmt = pack.pack_format;
  if (typeof fmt !== 'number') return 'broken';
  if (game.major >= 16) {
    const sup = parseInterval(pack.supported_formats);
    const range = sup && sup !== 'invalid' && fmt >= sup.min && fmt <= sup.max ? sup : { min: fmt, max: fmt };
    if (range.max < game.major) return 'too-old';
    if (game.major < range.min) return 'too-new';
    return 'compatible';
  }
  return fmt === game.major ? 'compatible' : fmt < game.major ? 'too-old' : 'too-new';
}

/** The format range a pack.mcmeta declares (for importing packs); lenient about older layouts. */
export function readPackMcmetaRange(mcmetaText: string): PackRange | null {
  let root: { pack?: Record<string, unknown> };
  try {
    const t = mcmetaText.charCodeAt(0) === 0xfeff ? mcmetaText.slice(1) : mcmetaText;
    root = JSON.parse(t);
  } catch {
    return null;
  }
  const pack = root?.pack;
  if (!pack || typeof pack !== 'object') return null;
  try {
    return validatePackSection(pack);
  } catch {
    const fmt = pack.pack_format;
    if (typeof fmt !== 'number') return null;
    const sup = parseInterval(pack.supported_formats);
    if (sup && sup !== 'invalid') return { min: { major: sup.min, minor: 0 }, max: { major: sup.max, minor: 0 } };
    return { min: { major: fmt, minor: 0 }, max: { major: fmt, minor: 0 } };
  }
}

// ---- Version -> format ----

const formatMem = new Map<string, Promise<PackFormat | null>>();

async function resolvePackFormat(versionId: string): Promise<PackFormat | null> {
  const bundled = bundledPackFormat(versionId);
  if (bundled) return bundled;
  const { fetchMisodeSummary, misodePackFormat, findManifestVersion, getClientJarInfo } = await import('./versions');
  const { cacheGet, cacheSet } = await import('../../core/storage');
  const misode = await fetchMisodeSummary();
  const fromMisode = misodePackFormat(misode?.get(versionId));
  if (fromMisode) return fromMisode;
  const key = `java:packformat:${versionId}`;
  const cached = await cacheGet<PackFormat>(key).catch(() => undefined);
  if (cached) return cached;
  const { readCachedJarText } = await import('./assets');
  const cachedJson = await readCachedJarText(versionId, 'version.json').catch(() => null);
  if (cachedJson) {
    const f = safeParseFormat(cachedJson);
    if (f) return f;
  }
  let entry;
  try {
    entry = await findManifestVersion(versionId);
  } catch {
    return null;
  }
  if (!entry) return null;
  if (Date.parse(entry.releaseTime) < Date.parse(FIRST_VERSION_JSON_TIME)) {
    const legacy = entry.type === 'release' ? legacyRpFormatForRelease(versionId) : legacyRpFormatForSnapshot(entry.releaseTime);
    return legacy === null ? null : { major: legacy, minor: 0 };
  }
  try {
    const jar = await getClientJarInfo(versionId);
    const { openHttpZip } = await import('../../core/rangezip');
    const zip = await openHttpZip(jar.url, jar.size);
    if (!zip.has('version.json')) return null;
    const f = safeParseFormat(new TextDecoder().decode(await zip.read('version.json')));
    if (f) cacheSet(key, f).catch(() => {});
    return f;
  } catch {
    return null;
  }
}

function safeParseFormat(text: string): PackFormat | null {
  try {
    return packFormatFromVersionJson(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Resource pack format of a Java version: bundled table, misode summary, then the jar's version.json. */
export function getJavaPackFormat(versionId: string): Promise<PackFormat | null> {
  let p = formatMem.get(versionId);
  if (!p) {
    p = resolvePackFormat(versionId).then((f) => {
      if (!f) formatMem.delete(versionId);
      return f;
    });
    formatMem.set(versionId, p);
  }
  return p;
}

/** pack.mcmeta for a target version, optionally declaring compatibility with a version range. */
export async function buildPackMcmetaForVersions(description: string, targetVersion: string, compat?: { minVersion: string; maxVersion: string }): Promise<string> {
  const target = await getJavaPackFormat(targetVersion);
  if (!target) throw new Error(`Couldn't find the pack format for Minecraft ${targetVersion}. Check your connection and try again.`);
  if (!compat) return buildPackMcmeta({ description, target });
  const [min, max] = await Promise.all([getJavaPackFormat(compat.minVersion), getJavaPackFormat(compat.maxVersion)]);
  if (!min) throw new Error(`Couldn't find the pack format for Minecraft ${compat.minVersion}.`);
  if (!max) throw new Error(`Couldn't find the pack format for Minecraft ${compat.maxVersion}.`);
  return buildPackMcmeta({ description, target, range: { min, max } });
}
