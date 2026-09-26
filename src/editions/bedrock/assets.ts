import type { AssetIndex, ProgressFn, TextureInfo } from '../../core/types';
import { decodeImage } from '../../core/image';
import { NetError, SharedLoader, createLimiter, fetchBytes, fetchJson, isAbortError, throwIfAborted } from '../../core/net';
import { cacheDeleteMany, cacheGet, cacheGetMany, cacheKeys, cacheSet, cacheSetMany, onAssetCacheCleared } from '../../core/storage';
import {
  bedrockTexturesFromFiles,
  catalogFromIndex,
  flipbookStems,
  indexFromPaths,
  isBedrockIndexFile,
  parseLenientJson,
  pathsFromGitTree,
  texturePathsFromAtlases,
  type BedrockCatalog,
  type BedrockIndexFile,
} from './catalog';
import { SAMPLES_CDN, SAMPLES_RAW, appDataUrl, bedrockGameVersion, normalizeVersion, resolveBedrockVersion } from './versions';

/*
 * Bedrock vanilla assets from Mojang/bedrock-samples, fetched lazily per file by the user's
 * browser (raw.githubusercontent.com, falling back to jsDelivr), with memory + IndexedDB caching.
 */

export const BEDROCK_CACHE_FORMAT = 1;
const indexKey = (ref: string) => `bedrock-index:v${BEDROCK_CACHE_FORMAT}:${ref}`;
const fileKey = (refKey: string, path: string) => `bedrock-file:v${BEDROCK_CACHE_FORMAT}:${refKey}:${path}`;
const TREE_API = 'https://api.github.com/repos/Mojang/bedrock-samples/git/trees/';
const IMAGE_PROBE_ORDER = ['tga', 'png', 'jpg', 'jpeg'];

interface StoredCatalog {
  at: number;
  source: BedrockCatalog['source'];
  index: BedrockIndexFile;
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

export function bedrockFileUrls(ref: string, path: string): string[] {
  const p = encodePath(path);
  return [`${SAMPLES_RAW}/${encodeURIComponent(ref)}/resource_pack/${p}`, `${SAMPLES_CDN}@${encodeURIComponent(ref)}/resource_pack/${p}`];
}

const limit = createLimiter(8);

/** One vanilla file: raw.githubusercontent first; jsDelivr on network errors / rate limits (not on 404). */
export async function fetchSampleFile(ref: string, path: string, signal?: AbortSignal): Promise<Uint8Array> {
  const [raw, cdn] = bedrockFileUrls(ref, path);
  try {
    return await fetchBytes(raw, { retries: 0, timeoutMs: 20_000, signal });
  } catch (err) {
    if (isAbortError(err)) throw err;
    if (err instanceof NetError && err.kind === 'not-found') throw err;
    return fetchBytes(cdn, { retries: 1, timeoutMs: 30_000, signal });
  }
}

// ---- Batched IndexedDB access (thousands of thumbnails at once) ----

const readQueue = new Map<string, ((v: unknown) => void)[]>();
let readTimer: ReturnType<typeof setTimeout> | null = null;
function batchedGet(key: string): Promise<unknown> {
  return new Promise((resolve) => {
    const waiters = readQueue.get(key);
    if (waiters) waiters.push(resolve);
    else readQueue.set(key, [resolve]);
    readTimer ??= setTimeout(flushReads, 0);
  });
}
async function flushReads(): Promise<void> {
  readTimer = null;
  const batch = [...readQueue.entries()];
  readQueue.clear();
  const values = await cacheGetMany(batch.map(([k]) => k)).catch(() => batch.map(() => undefined));
  batch.forEach(([, waiters], i) => waiters.forEach((w) => w(values[i])));
}

const writeQueue = new Map<string, unknown>();
let writeTimer: ReturnType<typeof setTimeout> | null = null;
function batchedSet(key: string, value: unknown): void {
  writeQueue.set(key, value);
  if (writeQueue.size >= 200) void flushWrites();
  else writeTimer ??= setTimeout(flushWrites, 400);
}
async function flushWrites(): Promise<void> {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = null;
  const batch = [...writeQueue.entries()];
  writeQueue.clear();
  if (batch.length) await cacheSetMany(batch).catch(() => {});
}

// ---- Asset index ----

const decoder = new TextDecoder();

class BedrockAssets implements AssetIndex {
  readonly edition = 'bedrock' as const;
  readonly textures: TextureInfo[];
  private readonly fileSet: Set<string>;
  private readonly mem = new Map<string, Promise<Uint8Array>>();
  private readonly refKey: string;

  constructor(
    readonly version: string,
    readonly ref: string,
    readonly catalog: BedrockCatalog,
  ) {
    this.fileSet = new Set(catalog.files);
    this.textures = bedrockTexturesFromFiles(catalog.files, catalog.flipbook);
    // Branch refs move: key cached files by commit when known so updates are picked up.
    this.refKey = catalog.commit ? `${ref}@${catalog.commit.slice(0, 12)}` : ref;
  }

  hasFile(path: string): boolean {
    return this.fileSet.has(path);
  }

  listFiles(prefix: string): string[] {
    const files = this.catalog.files;
    let lo = 0;
    let hi = files.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (files[mid] < prefix) lo = mid + 1;
      else hi = mid;
    }
    const out: string[] = [];
    for (let i = lo; i < files.length && files[i].startsWith(prefix); i++) out.push(files[i]);
    return out;
  }

  async readFile(path: string): Promise<Uint8Array> {
    if (!this.fileSet.has(path) && this.catalog.source !== 'atlas') throw new Error(`${path} isn't part of this Bedrock version.`);
    let p = this.mem.get(path);
    if (!p) {
      p = this.load(path);
      this.mem.set(path, p);
      p.catch(() => this.mem.delete(path));
    }
    return (await p).slice();
  }

  async readText(path: string): Promise<string> {
    return decoder.decode(await this.readFile(path));
  }

  async readImage(path: string): Promise<ImageData> {
    const ext = path.slice(path.lastIndexOf('.') + 1);
    return decodeImage(await this.readFile(path), ext);
  }

  private async load(path: string): Promise<Uint8Array> {
    const key = fileKey(this.refKey, path);
    const cached = await batchedGet(key);
    if (cached instanceof Uint8Array) return cached;
    let bytes: Uint8Array;
    try {
      bytes = await limit(() => fetchSampleFile(this.ref, path));
    } catch (err) {
      // Catalogues rebuilt from atlases guess extensions: try the others in engine priority order.
      if (this.catalog.source === 'atlas' && err instanceof NetError && err.kind === 'not-found' && /\.(png|tga|jpe?g)$/.test(path)) {
        bytes = await this.probe(path);
      } else throw err;
    }
    batchedSet(key, bytes);
    return bytes;
  }

  private async probe(path: string): Promise<Uint8Array> {
    const stem = path.slice(0, path.lastIndexOf('.'));
    const tried = path.slice(stem.length + 1);
    for (const ext of IMAGE_PROBE_ORDER) {
      if (ext === tried) continue;
      try {
        return await limit(() => fetchSampleFile(this.ref, `${stem}.${ext}`));
      } catch (err) {
        if (!(err instanceof NetError && err.kind === 'not-found')) throw err;
      }
    }
    throw new NetError('not-found', path, `${path} doesn't exist in this Bedrock version.`, 404);
  }
}

// ---- Catalogue loading ----

async function saveCatalog(ref: string, index: BedrockIndexFile, source: BedrockCatalog['source']): Promise<void> {
  await cacheSet(indexKey(ref), { at: Date.now(), source, index } satisfies StoredCatalog).catch(() => {});
}

async function fetchStaticIndex(ref: string): Promise<BedrockIndexFile | null> {
  let url: string;
  try {
    url = appDataUrl(`data/bedrock/index-${encodeURIComponent(ref)}.json`);
  } catch {
    return null;
  }
  const json = await fetchJson(url, { retries: 1, timeoutMs: 20_000 }).catch(() => null);
  return isBedrockIndexFile(json) ? json : null;
}

async function fetchFlipbook(ref: string): Promise<string[]> {
  try {
    const bytes = await fetchSampleFile(ref, 'textures/flipbook_textures.json');
    return flipbookStems(parseLenientJson(decoder.decode(bytes)));
  } catch {
    return [];
  }
}

async function fetchTreeIndex(ref: string, version: string | undefined, signal?: AbortSignal): Promise<BedrockIndexFile | null> {
  try {
    const tree = await fetchJson<{ sha?: string }>(`${TREE_API}${encodeURIComponent(ref)}?recursive=1`, { retries: 0, timeoutMs: 30_000, signal });
    const paths = pathsFromGitTree(tree);
    if (!paths.some((p) => p.startsWith('textures/'))) return null;
    const flipbook = await fetchFlipbook(ref);
    return indexFromPaths(paths, { ref, commit: tree.sha, version, flipbook, generated: new Date().toISOString() });
  } catch (err) {
    if (isAbortError(err)) throw err;
    return null;
  }
}

/** Last resort: texture paths referenced by the atlas JSONs, extensions taken from any known index. */
async function atlasIndex(ref: string, version: string | undefined, hint: BedrockCatalog | null): Promise<BedrockIndexFile | null> {
  const read = async (p: string) => {
    try {
      return parseLenientJson(decoder.decode(await fetchSampleFile(ref, p)));
    } catch {
      return undefined;
    }
  };
  const [terrain, item, flipbook] = await Promise.all([
    read('textures/terrain_texture.json'),
    read('textures/item_texture.json'),
    read('textures/flipbook_textures.json'),
  ]);
  if (!terrain && !item) return null;
  const { paths, flipbook: flip } = texturePathsFromAtlases({ terrain, item, flipbook });
  const known = new Map<string, string>();
  if (hint) {
    for (const f of hint.files) {
      const m = /^(.*)\.(tga|png)$/.exec(f);
      if (m && (!known.has(m[1]) || m[2] === 'tga')) known.set(m[1], m[2]);
    }
  }
  const files = paths.map((p) => `${p}.${known.get(p) ?? 'png'}`);
  files.push('textures/terrain_texture.json', 'textures/item_texture.json', 'textures/flipbook_textures.json');
  return indexFromPaths(files, { ref, version, flipbook: flip, generated: new Date().toISOString() });
}

async function loadCatalog(ref: string, gameVersion: string | undefined, signal?: AbortSignal): Promise<BedrockCatalog> {
  const isBranch = ref === 'main' || ref === 'preview';
  const stored = await cacheGet<StoredCatalog>(indexKey(ref)).catch(() => undefined);
  const storedOk = stored && isBedrockIndexFile(stored.index) ? stored : undefined;
  // Tags never change: a full cached listing is final.
  if (storedOk && !isBranch && storedOk.source !== 'atlas') return catalogFromIndex(storedOk.index, storedOk.source);

  const matches = (v?: string) => !isBranch || !gameVersion || !v || normalizeVersion(v) === normalizeVersion(gameVersion);
  const bundled = await fetchStaticIndex(ref);
  throwIfAborted(signal);
  if (bundled && matches(bundled.version)) {
    void saveCatalog(ref, bundled, 'index');
    return catalogFromIndex(bundled, 'index');
  }
  if (storedOk && storedOk.source !== 'atlas' && matches(storedOk.index.version)) return catalogFromIndex(storedOk.index, storedOk.source);

  const tree = await fetchTreeIndex(ref, gameVersion, signal);
  if (tree) {
    void saveCatalog(ref, tree, 'tree');
    return catalogFromIndex(tree, 'tree');
  }
  // A slightly outdated full listing beats a partial one.
  if (bundled) return catalogFromIndex(bundled, 'index');
  if (storedOk && storedOk.source !== 'atlas') return catalogFromIndex(storedOk.index, storedOk.source);

  const hintIndex = isBranch ? null : await fetchStaticIndex('main');
  const atlas = await atlasIndex(ref, gameVersion, hintIndex ? catalogFromIndex(hintIndex) : null);
  if (atlas) {
    void saveCatalog(ref, atlas, 'atlas');
    return catalogFromIndex(atlas, 'atlas');
  }
  if (storedOk) return catalogFromIndex(storedOk.index, storedOk.source);
  throw new Error("Couldn't load the list of Bedrock textures. Check your internet connection and try again.");
}

const instances = new SharedLoader<BedrockAssets>();
onAssetCacheCleared(() => {
  instances.clear();
  // Don't write files fetched before the clear back into the emptied cache.
  writeQueue.clear();
});

async function load(versionId: string, opts: { onProgress?: ProgressFn; signal?: AbortSignal }): Promise<BedrockAssets> {
  opts.onProgress?.({ label: 'Loading the Bedrock texture list', fraction: null });
  const v = await resolveBedrockVersion(versionId);
  const gameVersion = await bedrockGameVersion(versionId).catch(() => undefined);
  const catalog = await loadCatalog(v.ref, gameVersion, opts.signal);
  opts.onProgress?.({ label: 'Loading the Bedrock texture list', fraction: 1 });
  return new BedrockAssets(versionId, v.ref, catalog);
}

export function loadBedrockAssets(versionId: string, opts: { onProgress?: ProgressFn; signal?: AbortSignal } = {}): Promise<AssetIndex> {
  return instances.load(versionId, opts.onProgress, (emit, signal) => load(versionId, { onProgress: emit, signal }), { signal: opts.signal });
}

/** True when the texture list for this version is stored locally (textures load lazily and are cached as used). */
export async function isBedrockAssetsCached(versionId: string): Promise<boolean> {
  const ref = versionId === 'latest' ? 'main' : versionId === 'preview' ? 'preview' : (await resolveBedrockVersion(versionId).catch(() => null))?.ref;
  if (!ref) return false;
  const stored = await cacheGet<StoredCatalog>(indexKey(ref)).catch(() => undefined);
  return !!stored && isBedrockIndexFile(stored.index);
}

/** Git ref an asset index reads from (for pinning exports / display). */
export function bedrockRefOf(index: AssetIndex): string | null {
  return index instanceof BedrockAssets ? index.ref : null;
}

/**
 * Where the file list came from: 'index' (prebuilt), 'tree' (GitHub API) or 'atlas'
 * (reconstructed from atlas JSONs: blocks/items only, extensions guessed).
 */
export function bedrockCatalogSource(index: AssetIndex): BedrockCatalog['source'] | null {
  return index instanceof BedrockAssets ? index.catalog.source : null;
}

/** Removes the stored file list and textures of one Bedrock version. */
export async function deleteCachedBedrockVersion(versionId: string): Promise<void> {
  const ref = versionId === 'latest' ? 'main' : versionId === 'preview' ? 'preview' : (await resolveBedrockVersion(versionId).catch(() => null))?.ref;
  instances.forget(versionId);
  if (!ref) return;
  const keys = [indexKey(ref), ...(await cacheKeys(`bedrock-file:v${BEDROCK_CACHE_FORMAT}:${ref}@`)), ...(await cacheKeys(`bedrock-file:v${BEDROCK_CACHE_FORMAT}:${ref}:`))];
  await cacheDeleteMany(keys);
}

/** Writes pending cache entries now (e.g. before the page unloads). */
export function flushBedrockCache(): Promise<void> {
  return flushWrites();
}
