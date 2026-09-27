import type { GameVersion } from '../../core/types';
import { fetchJson } from '../../core/net';
import { cacheGet, cacheSet } from '../../core/storage';
import { appBaseUrl } from '../../core/base';

export const SAMPLES_RAW = 'https://raw.githubusercontent.com/Mojang/bedrock-samples';
export const SAMPLES_CDN = 'https://cdn.jsdelivr.net/gh/Mojang/bedrock-samples';
export const SAMPLES_TAGS_API = 'https://data.jsdelivr.com/v1/packages/gh/Mojang/bedrock-samples';

/** Version ids that track the moving branches of bedrock-samples. */
export const BEDROCK_LATEST_ID = 'latest';
export const BEDROCK_PREVIEW_ID = 'preview';

export interface SamplesVersionEntry {
  version: string;
  /** DD-MM-YYYY */
  date?: string;
  type?: string;
}
export type SamplesVersionJson = Record<string, SamplesVersionEntry>;

/** Shape of public/data/bedrock/versions.json (snapshot written by scripts/bedrock-index.mjs). */
export interface BedrockVersionsSnapshot {
  format: number;
  generated?: string;
  main?: SamplesVersionJson;
  preview?: SamplesVersionJson;
  /** Tag names without the leading 'v', exactly as in git (e.g. "1.26.40.05") */
  tags?: string[];
}

export interface BedrockVersionSources {
  main?: SamplesVersionJson | null;
  preview?: SamplesVersionJson | null;
  tags?: string[] | null;
}

/** '1.26.40.05' -> [1, 26, 40, 5]; tolerant of suffixes like '25a' or '-preview.1'. */
export function versionParts(v: string): number[] {
  return v.replace(/^v/, '').split(/[-+]/)[0].split('.').map((x) => parseInt(x, 10) || 0);
}

export function normalizeVersion(v: string): string {
  return versionParts(v).join('.');
}

export function compareVersions(a: string, b: string): number {
  const pa = versionParts(a);
  const pb = versionParts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Marketing name: 1.26.50.4 -> "26.50", 1.26.0.2 -> "26.0" (year-based from 2026), 1.21.120.4 -> "1.21.120". */
export function bedrockDisplayVersion(v: string): string {
  const p = versionParts(v);
  if (p[0] === 1 && p[1] >= 26) return `${p[1]}.${p[2] ?? 0}`;
  return p.slice(0, 3).join('.');
}

/** Engine version for manifests: 1.26.50.4 -> [1, 26, 50]. */
export function engineVersionOf(v: string): [number, number, number] {
  const p = versionParts(v);
  return [p[0] ?? 1, p[1] ?? 0, p[2] ?? 0];
}

/** "15-09-2026" -> ISO date string. */
export function samplesDateToIso(d?: string): string | undefined {
  const m = d && /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(d.trim());
  if (!m) return undefined;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T00:00:00Z`;
}

function entries(json: SamplesVersionJson | null | undefined): SamplesVersionEntry[] {
  if (!json || typeof json !== 'object') return [];
  return Object.entries(json)
    .filter(([k, v]) => k !== 'latest' && v && typeof v.version === 'string')
    .map(([, v]) => v);
}

/**
 * Builds the picker list: "Latest release" (branch main), optionally "Latest preview" (branch
 * preview), then every tagged version. Tag names come from jsDelivr/git (they are irregular, e.g.
 * v1.26.40.05); versions from version.json without a matching tag are left out.
 */
export function buildBedrockVersionList(src: BedrockVersionSources, includePreviews: boolean): GameVersion[] {
  const releases = new Map(entries(src.main).map((e) => [normalizeVersion(e.version), e]));
  const previews = new Map(entries(src.preview).map((e) => [normalizeVersion(e.version), e]));
  const latestRelease = src.main?.latest?.version;
  const latestPreview = src.preview?.latest?.version;
  const out: GameVersion[] = [];
  out.push({
    edition: 'bedrock',
    id: BEDROCK_LATEST_ID,
    name: latestRelease ? `Latest release (${bedrockDisplayVersion(latestRelease)})` : 'Latest release',
    type: 'release',
    ref: 'main',
    releaseTime: samplesDateToIso(src.main?.latest?.date),
  });
  if (includePreviews) {
    out.push({
      edition: 'bedrock',
      id: BEDROCK_PREVIEW_ID,
      name: latestPreview ? `Latest preview (${bedrockDisplayVersion(latestPreview)}.${versionParts(latestPreview)[3] ?? 0})` : 'Latest preview',
      type: 'preview',
      ref: 'preview',
      releaseTime: samplesDateToIso(src.preview?.latest?.date),
    });
  }
  const seen = new Set<string>();
  const tagged: GameVersion[] = [];
  for (const raw of src.tags ?? []) {
    if (typeof raw !== 'string' || !/^v?\d/.test(raw)) continue;
    const tag = raw.replace(/^v/, '');
    const norm = normalizeVersion(tag);
    const isPreview = /preview/i.test(tag) || (previews.has(norm) && !releases.has(norm));
    if (isPreview && !includePreviews) continue;
    if (!isPreview && latestRelease && norm === normalizeVersion(latestRelease)) continue;
    if (isPreview && latestPreview && norm === normalizeVersion(latestPreview)) continue;
    const id = isPreview ? `${norm}-preview` : norm;
    if (seen.has(id)) continue;
    seen.add(id);
    const info = isPreview ? previews.get(norm) : releases.get(norm);
    const display = bedrockDisplayVersion(norm);
    tagged.push({
      edition: 'bedrock',
      id,
      name: isPreview ? `Preview ${display}.${versionParts(norm)[3] ?? 0}` : display,
      type: isPreview ? 'preview' : 'release',
      ref: `v${tag}`,
      releaseTime: samplesDateToIso(info?.date),
    });
  }
  tagged.sort((a, b) => compareVersions(b.id, a.id) || (a.type === 'release' ? -1 : 1));
  // Several builds of one release (hotfixes) would share a name: add the build number.
  const counts = new Map<string, number>();
  for (const v of tagged) counts.set(v.name, (counts.get(v.name) ?? 0) + 1);
  for (const v of tagged) if ((counts.get(v.name) ?? 0) > 1) v.name = `${v.name} (${v.id.replace(/-preview$/, '')})`;
  return out.concat(tagged);
}

// ---- Fetching ----

const CACHE_KEY = 'bedrock:versions';
const FRESH_MS = 15 * 60 * 1000;

interface CachedSources {
  at: number;
  src: BedrockVersionSources;
}

/** URL of a file bundled with the app (public/), relative to the site root (pages can be nested). */
export function appDataUrl(path: string): string {
  return new URL(path, appBaseUrl()).href;
}

let sourcesMem: Promise<BedrockVersionSources> | null = null;
let sourcesAt = 0;

async function loadSources(): Promise<BedrockVersionSources> {
  const cached = await cacheGet<CachedSources>(CACHE_KEY).catch(() => undefined);
  if (cached && Date.now() - cached.at < FRESH_MS) return cached.src;
  const opt = { retries: 1, timeoutMs: 15_000 };
  const [main, preview, tagsJson] = await Promise.all([
    fetchJson<SamplesVersionJson>(`${SAMPLES_RAW}/main/version.json`, opt).catch(() => null),
    fetchJson<SamplesVersionJson>(`${SAMPLES_RAW}/preview/version.json`, opt).catch(() => null),
    fetchJson<{ versions?: { version?: string }[] }>(SAMPLES_TAGS_API, opt).catch(() => null),
  ]);
  const tags = tagsJson?.versions?.map((v) => v.version).filter((v): v is string => typeof v === 'string') ?? null;
  let src: BedrockVersionSources = { main, preview, tags };
  if (!main || !preview || !tags) {
    const snap = await fetchJson<BedrockVersionsSnapshot>(appDataUrl('data/bedrock/versions.json'), { retries: 0, timeoutMs: 10_000 }).catch(() => null);
    const fallback = cached?.src;
    src = {
      main: main ?? fallback?.main ?? snap?.main ?? null,
      preview: preview ?? fallback?.preview ?? snap?.preview ?? null,
      tags: tags ?? fallback?.tags ?? snap?.tags ?? null,
    };
  }
  if (main && preview && tags) cacheSet(CACHE_KEY, { at: Date.now(), src }).catch(() => {});
  return src;
}

export function fetchBedrockVersionSources(): Promise<BedrockVersionSources> {
  // Refresh now and then in long sessions.
  if (!sourcesMem || Date.now() - sourcesAt > FRESH_MS) {
    sourcesAt = Date.now();
    const p = loadSources();
    sourcesMem = p;
    p.catch(() => {
      if (sourcesMem === p) sourcesMem = null;
    });
  }
  return sourcesMem;
}

export async function listBedrockVersions(opts: { includeSnapshots?: boolean } = {}): Promise<GameVersion[]> {
  const src = await fetchBedrockVersionSources().catch(() => ({}) as BedrockVersionSources);
  return buildBedrockVersionList(src, !!opts.includeSnapshots);
}

/** Git ref and details for a version id ('latest', 'preview', '1.26.40.5', '1.26.60.28-preview', or a raw 'v…' tag). */
export async function resolveBedrockVersion(id: string): Promise<GameVersion & { ref: string }> {
  if (id === BEDROCK_LATEST_ID || id === 'main') {
    const src = await fetchBedrockVersionSources().catch(() => ({}) as BedrockVersionSources);
    const v = buildBedrockVersionList(src, false)[0];
    return { ...v, ref: 'main' };
  }
  if (id === BEDROCK_PREVIEW_ID) {
    const src = await fetchBedrockVersionSources().catch(() => ({}) as BedrockVersionSources);
    const v = buildBedrockVersionList(src, true)[1];
    return { ...v, ref: 'preview' };
  }
  const src = await fetchBedrockVersionSources().catch(() => ({}) as BedrockVersionSources);
  const all = buildBedrockVersionList(src, true);
  const hit = all.find((v) => v.id === id) ?? all.find((v) => v.ref === id || v.ref === `v${id}`);
  if (hit?.ref) return { ...hit, ref: hit.ref };
  const isPreview = /preview/i.test(id);
  // The current latest release/preview is listed as 'latest'/'preview', not by number: map its number to
  // the real (irregular) tag name, else to the branch that holds it.
  const norm = normalizeVersion(id);
  const latest = isPreview ? src.preview?.latest?.version : src.main?.latest?.version;
  if (/^v?\d/.test(id) && latest && normalizeVersion(latest) === norm) {
    const tag = (src.tags ?? []).find((t) => normalizeVersion(t) === norm && /preview/i.test(t) === isPreview);
    const base = all[isPreview ? 1 : 0];
    return { ...base, id, ref: tag ? `v${tag.replace(/^v/, '')}` : isPreview ? 'preview' : 'main' };
  }
  return {
    edition: 'bedrock',
    id,
    name: bedrockDisplayVersion(id),
    type: isPreview ? 'preview' : 'release',
    ref: id.startsWith('v') ? id : `v${id}`,
  };
}

/** Full game version string behind a version id (e.g. 'latest' -> '1.26.50.4'), when known. */
export async function bedrockGameVersion(id: string): Promise<string | undefined> {
  if (id === BEDROCK_LATEST_ID || id === BEDROCK_PREVIEW_ID) {
    const src = await fetchBedrockVersionSources().catch(() => ({}) as BedrockVersionSources);
    return (id === BEDROCK_LATEST_ID ? src.main : src.preview)?.latest?.version;
  }
  return /^\d/.test(id) ? normalizeVersion(id) : undefined;
}

export async function getDefaultBedrockVersion(): Promise<string> {
  return BEDROCK_LATEST_ID;
}
