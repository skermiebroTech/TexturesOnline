// The game's own sounds, fetched by the browser at runtime (never stored in this repository).
//
// Java: the version JSON names an asset index (piston-meta, CORS enabled) listing every sound file
// with its hash. The files live on resources.download.minecraft.net, which sends no CORS headers:
// they can't be read by scripts, but an <audio> element plays them fine, so vanilla Java sounds are
// played straight from Mojang. sounds.json (also not readable there) comes from misode/mcmeta's
// per-version copy (1.14+); older versions list their files instead.
//
// Bedrock: sound_definitions.json and the sounds (FSB5 banks) come from Mojang/bedrock-samples.

import type { AssetIndex } from '../../../core/types';
import { NetError, fetchFirst, fetchJson, isAbortError } from '../../../core/net';
import { cacheGet, cacheSet } from '../../../core/storage';
import { findManifestVersion } from '../../../editions/java/versions';
import { bedrockRefOf, fetchSampleFile } from '../../../editions/bedrock/assets';
import { parseLenientJson } from '../../../editions/bedrock/catalog';
import { fmt } from '../../../i18n/editor-text';
import { errorText } from '../../../shared/i18n/errors';
import { ts } from '../ui/i18n/sounds';
import { javaCatalogFromFiles, javaSoundStem, parseJavaSoundsJson, parseBedrockDefinitions, BEDROCK_DEFINITIONS, type SoundCatalog } from './catalog';

export const MOJANG_RESOURCES = 'https://resources.download.minecraft.net';
const MCMETA_RAW = 'https://raw.githubusercontent.com/misode/mcmeta';
const MCMETA_CDN = 'https://cdn.jsdelivr.net/gh/misode/mcmeta';
const FORMAT = 1;
const BRANCH_FRESH_MS = 24 * 60 * 60 * 1000;

export interface VanillaSounds {
  catalog: SoundCatalog;
  /** Java: Mojang object hash of each file stem, for playback */
  hashes?: Map<string, string>;
  /** Bedrock: bedrock-samples git ref the files come from */
  ref?: string;
}

export class SoundsUnsupportedError extends Error {}

/** Where Mojang serves a Java asset object. */
export function javaSoundUrl(hash: string): string {
  return `${MOJANG_RESOURCES}/${hash.slice(0, 2)}/${hash}`;
}

export function mcmetaSoundsUrls(versionId: string): string[] {
  const tag = encodeURIComponent(`${versionId}-assets`);
  return [`${MCMETA_RAW}/${tag}/assets/minecraft/sounds.json`, `${MCMETA_CDN}@${tag}/assets/minecraft/sounds.json`];
}

export function loadVanillaSounds(assets: AssetIndex, opts: { signal?: AbortSignal } = {}): Promise<VanillaSounds> {
  return assets.edition === 'java' ? loadJava(assets.version, opts.signal) : loadBedrock(assets, opts.signal);
}

// ---------------------------------------------------------------------------------------------
// Java

interface AssetIndexRef {
  id: string;
  url: string;
  sha1: string;
  /** sha1 of the version JSON it came from */
  jsonSha1?: string;
}

interface StoredJavaSounds {
  format: number;
  /** Paths under minecraft/sounds/ without '.ogg' */
  files: string[];
  hashes: string[];
  /** sounds.json; null = known to be unavailable for this version */
  soundsJson?: unknown;
}

async function assetIndexRef(versionId: string, signal?: AbortSignal): Promise<AssetIndexRef> {
  const key = `java:assetindex:${versionId}`;
  const cached = await cacheGet<AssetIndexRef>(key).catch(() => undefined);
  let entry: Awaited<ReturnType<typeof findManifestVersion>>;
  try {
    entry = await findManifestVersion(versionId);
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
  if (!entry) {
    if (cached) return cached;
    throw new Error(fmt(errorText.notInVersionList, { version: versionId }));
  }
  if (cached && (!entry.sha1 || cached.jsonSha1 === entry.sha1)) return cached;
  const vj = await fetchJson<{ assetIndex?: { id?: string; url?: string; sha1?: string } }>(entry.url, { retries: 2, signal });
  const ai = vj.assetIndex;
  if (!ai?.url || !ai.sha1) throw new SoundsUnsupportedError(fmt(ts.errors.noSounds, { version: versionId }));
  const ref: AssetIndexRef = { id: ai.id ?? '', url: ai.url, sha1: ai.sha1, jsonSha1: entry.sha1 };
  cacheSet(key, ref).catch(() => {});
  return ref;
}

/** The sound files of an asset index (paths under minecraft/sounds/ without '.ogg', with hashes). */
export function soundFilesFromIndex(index: unknown): { files: string[]; hashes: string[]; hasSoundsJson: boolean } {
  const objects = (index as { objects?: Record<string, { hash?: string }> })?.objects;
  if (!objects || typeof objects !== 'object') throw new Error(ts.errors.damagedIndex);
  const files: string[] = [];
  const hashes: string[] = [];
  for (const [path, o] of Object.entries(objects)) {
    const m = /^minecraft\/sounds\/(.+)\.ogg$/.exec(path);
    if (!m || typeof o?.hash !== 'string') continue;
    files.push(m[1]);
    hashes.push(o.hash);
  }
  return { files, hashes, hasSoundsJson: !!objects['minecraft/sounds.json'] };
}

async function loadJava(versionId: string, signal?: AbortSignal): Promise<VanillaSounds> {
  const ref = await assetIndexRef(versionId, signal);
  const key = `java-sounds:v${FORMAT}:${ref.sha1}`;
  let stored = await cacheGet<StoredJavaSounds>(key).catch(() => undefined);
  if (!stored || stored.format !== FORMAT || !Array.isArray(stored.files)) {
    const index = await fetchJson(ref.url, { retries: 2, timeoutMs: 45_000, signal });
    const { files, hashes, hasSoundsJson } = soundFilesFromIndex(index);
    if (!files.length || !hasSoundsJson) throw new SoundsUnsupportedError(ts.errors.tooOld);
    stored = { format: FORMAT, files, hashes };
  }
  if (stored.soundsJson === undefined) {
    try {
      stored.soundsJson = await fetchFirst(mcmetaSoundsUrls(versionId), (u) => fetchJson(u, { retries: 1, timeoutMs: 30_000, signal }));
    } catch (err) {
      if (isAbortError(err)) throw err;
      // Not mirrored (before 1.14): use the file list. Other failures: try again next time.
      if (err instanceof NetError && err.kind === 'not-found') stored.soundsJson = null;
      else console.warn('sounds.json unavailable, listing sound files instead:', err);
    }
    if (stored.soundsJson !== undefined) cacheSet(key, stored).catch(() => {});
  }
  const hashes = new Map<string, string>();
  stored.files.forEach((f, i) => hashes.set(javaSoundStem(f), stored!.hashes[i]));
  let catalog: SoundCatalog | null = null;
  if (stored.soundsJson) {
    try {
      catalog = parseJavaSoundsJson(stored.soundsJson, versionId);
    } catch (err) {
      console.warn('sounds.json unreadable:', err);
    }
  }
  catalog ??= javaCatalogFromFiles(stored.files.map((f) => `minecraft/sounds/${f}.ogg`), versionId);
  return { catalog, hashes };
}

// ---------------------------------------------------------------------------------------------
// Bedrock

interface StoredDefinitions {
  format: number;
  at: number;
  json: unknown;
}

async function loadBedrock(assets: AssetIndex, signal?: AbortSignal): Promise<VanillaSounds> {
  const ref = bedrockRefOf(assets) ?? 'main';
  const key = `bedrock-sounds:v${FORMAT}:${ref}`;
  const cached = await cacheGet<StoredDefinitions>(key).catch(() => undefined);
  const usable = cached && cached.format === FORMAT && cached.json && typeof cached.json === 'object';
  const branch = ref === 'main' || ref === 'preview';
  let json: unknown = usable && (!branch || Date.now() - cached!.at < BRANCH_FRESH_MS) ? cached!.json : undefined;
  if (json === undefined) {
    try {
      const bytes = await fetchSampleFile(ref, BEDROCK_DEFINITIONS, signal);
      json = parseLenientJson(new TextDecoder().decode(bytes));
      cacheSet(key, { format: FORMAT, at: Date.now(), json } satisfies StoredDefinitions).catch(() => {});
    } catch (err) {
      if (isAbortError(err) || !usable) throw err;
      json = cached!.json;
    }
  }
  return { catalog: parseBedrockDefinitions(json, assets.version), ref };
}

const SAMPLE_EXTS = ['fsb', 'ogg', 'wav'];

/** A vanilla Bedrock sound file (usually an FSB5 bank), or null when bedrock-samples doesn't have it. */
export async function fetchBedrockSound(ref: string, stem: string, signal?: AbortSignal): Promise<{ bytes: Uint8Array; ext: string } | null> {
  const key = `bedrock-sound:v${FORMAT}:${ref}:${stem}`;
  const cached = await cacheGet<{ bytes: Uint8Array; ext: string } | { missing: true }>(key).catch(() => undefined);
  if (cached && 'missing' in cached) return null;
  if (cached && cached.bytes instanceof Uint8Array) return cached;
  for (const ext of SAMPLE_EXTS) {
    try {
      const bytes = await fetchSampleFile(ref, `${stem}.${ext}`, signal);
      const hit = { bytes, ext };
      cacheSet(key, hit).catch(() => {});
      return hit;
    } catch (err) {
      if (!(err instanceof NetError && err.kind === 'not-found')) throw err;
    }
  }
  cacheSet(key, { missing: true }).catch(() => {});
  return null;
}
