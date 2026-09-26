import type { GameVersion, PackFormat } from '../../core/types';
import { fetchJson, fetchFirst, NetError } from '../../core/net';
import { cacheGet, cacheSet } from '../../core/storage';
import { bundledPackFormat, FIRST_RESOURCE_PACK_TIME, KNOWN_RELEASE_FORMATS } from './packformats';

export const MANIFEST_URLS = [
  'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json',
  'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json',
];
export const MISODE_SUMMARY_URLS = [
  'https://raw.githubusercontent.com/misode/mcmeta/summary/versions/data.min.json',
  'https://cdn.jsdelivr.net/gh/misode/mcmeta@summary/versions/data.min.json',
];

export interface ManifestVersion {
  id: string;
  type: string;
  url: string;
  time: string;
  releaseTime: string;
  sha1?: string;
}
export interface VersionManifest {
  latest: { release: string; snapshot: string };
  versions: ManifestVersion[];
}
export interface MisodeVersion {
  id: string;
  name: string;
  type: string;
  resource_pack_version: number;
  resource_pack_version_minor?: number;
  release_time?: string;
}
export interface ClientJarInfo {
  id: string;
  url: string;
  size: number;
  sha1: string;
  releaseTime?: string;
  type?: string;
  /** sha1 of the version JSON this came from (manifest entry) */
  jsonSha1?: string;
}

const MANIFEST_KEY = 'java:manifest';
const MISODE_KEY = 'java:misode';
const FRESH_MS = 10 * 60 * 1000;
const MISODE_FRESH_MS = 6 * 60 * 60 * 1000;

interface Stamped<T> {
  at: number;
  data: T;
}

let manifestMem: Promise<VersionManifest> | null = null;
let misodeMem: Promise<Map<string, MisodeVersion> | null> | null = null;

/** Fresh-enough cached copy, else network, else any cached copy (offline). */
async function cachedFetch<T>(key: string, freshMs: number, load: () => Promise<T>, validate: (v: unknown) => v is T): Promise<T> {
  const cached = await cacheGet<Stamped<T>>(key).catch(() => undefined);
  if (cached && validate(cached.data) && Date.now() - cached.at < freshMs) return cached.data;
  try {
    const data = await load();
    if (!validate(data)) throw new Error('Unexpected data');
    cacheSet(key, { at: Date.now(), data }).catch(() => {});
    return data;
  } catch (err) {
    if (cached && validate(cached.data)) return cached.data;
    throw err;
  }
}

function isManifest(v: unknown): v is VersionManifest {
  return !!v && Array.isArray((v as VersionManifest).versions) && !!(v as VersionManifest).latest;
}

export function fetchVersionManifest(): Promise<VersionManifest> {
  if (!manifestMem) {
    manifestMem = cachedFetch(
      MANIFEST_KEY,
      FRESH_MS,
      () => fetchFirst(MANIFEST_URLS, (u) => fetchJson<VersionManifest>(u, { retries: 2 })),
      isManifest,
    ).catch((err) => {
      manifestMem = null;
      throw err;
    });
  }
  return manifestMem;
}

/** misode's per-version summary (1.14+). Resolves to null when unreachable; never required. */
export function fetchMisodeSummary(): Promise<Map<string, MisodeVersion> | null> {
  if (!misodeMem) {
    misodeMem = cachedFetch(
      MISODE_KEY,
      MISODE_FRESH_MS,
      () => fetchFirst(MISODE_SUMMARY_URLS, (u) => fetchJson<MisodeVersion[]>(u, { retries: 1, timeoutMs: 15_000 })),
      (v): v is MisodeVersion[] => Array.isArray(v),
    )
      .then((list) => new Map(list.filter((v) => v && typeof v.id === 'string').map((v) => [v.id, v])))
      .catch(() => {
        misodeMem = null;
        return null;
      });
  }
  return misodeMem;
}

export function misodePackFormat(v: MisodeVersion | undefined): PackFormat | undefined {
  if (!v || typeof v.resource_pack_version !== 'number') return undefined;
  return { major: v.resource_pack_version, minor: v.resource_pack_version_minor ?? 0 };
}

/** Manifest entries that support resource packs (13w24a and later), newest first. */
export function filterResourcePackVersions(manifest: VersionManifest, includeSnapshots: boolean): ManifestVersion[] {
  const min = Date.parse(FIRST_RESOURCE_PACK_TIME);
  return manifest.versions
    .filter((v) => (v.type === 'release' || (includeSnapshots && v.type === 'snapshot')) && Date.parse(v.releaseTime) >= min)
    .sort((a, b) => Date.parse(b.releaseTime) - Date.parse(a.releaseTime));
}

/** Pure mapping used by listJavaVersions (exported for tests). */
export function toGameVersions(entries: ManifestVersion[], misode: Map<string, MisodeVersion> | null): GameVersion[] {
  return entries.map((v) => {
    const m = misode?.get(v.id);
    const packFormat = misodePackFormat(m) ?? bundledPackFormat(v.id, v.releaseTime, v.type) ?? undefined;
    const gv: GameVersion = {
      edition: 'java',
      id: v.id,
      name: v.type === 'release' ? v.id : m?.name && m.name !== v.id ? m.name : v.id,
      type: v.type === 'release' ? 'release' : 'snapshot',
      releaseTime: v.releaseTime,
    };
    if (packFormat) gv.packFormat = packFormat;
    return gv;
  });
}

/** Offline fallback: bundled releases only. */
function bundledVersions(): GameVersion[] {
  return Object.keys(KNOWN_RELEASE_FORMATS)
    .reverse()
    .map((id) => ({ edition: 'java' as const, id, name: id, type: 'release' as const, packFormat: { ...KNOWN_RELEASE_FORMATS[id] } }));
}

/** How long the version list waits for misode's (optional) pack formats before showing without them. */
const MISODE_WAIT_MS = 4000;

export async function listJavaVersions(opts: { includeSnapshots?: boolean } = {}): Promise<GameVersion[]> {
  let manifest: VersionManifest;
  try {
    manifest = await fetchVersionManifest();
  } catch (err) {
    // Mojang unreachable (offline, outage, rate limit, garbled reply) and nothing cached: the bundled
    // releases still work (their assets may be cached, or a local .jar can be used).
    if (err instanceof NetError || (err instanceof Error && err.message === 'Unexpected data')) return bundledVersions();
    throw err;
  }
  // misode only adds pack formats for snapshots; don't let a slow mirror hold up the list.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const misode = await Promise.race([
    fetchMisodeSummary(),
    new Promise<null>((r) => {
      timer = setTimeout(() => r(null), MISODE_WAIT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
  return toGameVersions(filterResourcePackVersions(manifest, !!opts.includeSnapshots), misode);
}

export async function findManifestVersion(id: string): Promise<ManifestVersion | undefined> {
  const manifest = await fetchVersionManifest();
  return manifest.versions.find((v) => v.id === id);
}

interface VersionJson {
  id: string;
  type?: string;
  releaseTime?: string;
  downloads?: { client?: { url: string; size: number; sha1: string } };
}

/** Client jar URL/size/sha1 for a version, from its version JSON (cached; immutable per sha1). */
export async function getClientJarInfo(id: string): Promise<ClientJarInfo> {
  const key = `java:jarinfo:${id}`;
  const cached = await cacheGet<ClientJarInfo>(key).catch(() => undefined);
  let entry: ManifestVersion | undefined;
  try {
    entry = await findManifestVersion(id);
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
  if (!entry) {
    if (cached) return cached;
    throw new Error(`Minecraft ${id} isn't in Mojang's version list.`);
  }
  if (cached && (!entry.sha1 || cached.jsonSha1 === entry.sha1)) return cached;
  const vj = await fetchJson<VersionJson>(entry.url, { retries: 2 });
  const client = vj.downloads?.client;
  if (!client?.url || !client.size) throw new Error(`Mojang doesn't provide a client download for Minecraft ${id}.`);
  const info: ClientJarInfo = { id, url: client.url, size: client.size, sha1: client.sha1, releaseTime: entry.releaseTime, type: entry.type, jsonSha1: entry.sha1 };
  cacheSet(key, info).catch(() => {});
  return info;
}

export async function getDefaultJavaVersion(preferred: string): Promise<string> {
  try {
    const manifest = await fetchVersionManifest();
    if (manifest.versions.some((v) => v.id === preferred)) return preferred;
    return manifest.latest.release || preferred;
  } catch {
    return preferred;
  }
}
