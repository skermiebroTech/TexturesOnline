import type { AssetIndex, ProgressFn, TextureInfo } from '../../core/types';
import { decodeImage } from '../../core/image';
import { SharedLoader, fetchWithProgress, isAbortError, throwIfAborted } from '../../core/net';
import { BlobSource, HttpRangeSource, MemorySource, RangeZip, type ByteSource, type ZipEntry } from '../../core/rangezip';
import { cacheDeleteMany, cacheGet, cacheGetMany, cacheKeys, cacheSet, cacheSetMany, onAssetCacheCleared } from '../../core/storage';
import { buildJavaTextureList, javaGroupOf, JAVA_TEXTURE_ROOT, refineAnimated } from './textures';
import { getClientJarInfo, type ClientJarInfo } from './versions';
import { KNOWN_RELEASES, KNOWN_RELEASE_FORMATS } from './packformats';

/*
 * Java vanilla assets straight from Mojang's client jar.
 * Range-reads the central directory and the (contiguous) textures block; every other folder
 * (shaders, models, blockstates, items, lang, atlases, ...) is fetched the first time something
 * in it is read. Everything fetched is cached in IndexedDB per version and group, so a second
 * visit works offline. Any range-read failure falls back to downloading the whole jar.
 */

export const JAVA_CACHE_FORMAT = 1;
const key = (versionId: string, part: string) => `java-assets:v${JAVA_CACHE_FORMAT}:${versionId}:${part}`;
const FIELDS = 5; // offset, compressedSize, size, method, extraLength

interface StoredMeta {
  format: number;
  versionId: string;
  jarUrl?: string;
  jarSize: number;
  jarSha1?: string;
  dataEnd: number;
  names: string[];
  /** FIELDS numbers per name */
  table: Float64Array;
  groups: string[];
  savedAt: number;
}

interface StoredGroup {
  names: string[];
  /** names.length + 1 offsets into data */
  offsets: Uint32Array;
  data: Uint8Array;
}

function packGroup(files: Map<string, Uint8Array>): StoredGroup {
  const names = [...files.keys()];
  const offsets = new Uint32Array(names.length + 1);
  let total = 0;
  names.forEach((n, i) => {
    offsets[i] = total;
    total += files.get(n)!.length;
  });
  offsets[names.length] = total;
  const data = new Uint8Array(total);
  names.forEach((n, i) => data.set(files.get(n)!, offsets[i]));
  return { names, offsets, data };
}

function unpackGroup(g: StoredGroup, into: Map<string, Uint8Array>): void {
  for (let i = 0; i < g.names.length; i++) into.set(g.names[i], g.data.subarray(g.offsets[i], g.offsets[i + 1]));
}

function isStoredGroup(v: unknown): v is StoredGroup {
  return !!v && Array.isArray((v as StoredGroup).names) && (v as StoredGroup).offsets instanceof Uint32Array && (v as StoredGroup).data instanceof Uint8Array;
}

function isStoredMeta(v: unknown, versionId: string): v is StoredMeta {
  const m = v as StoredMeta;
  return !!m && m.format === JAVA_CACHE_FORMAT && m.versionId === versionId && Array.isArray(m.names) && m.table instanceof Float64Array && m.table.length === m.names.length * FIELDS;
}

function entriesFromMeta(m: StoredMeta): ZipEntry[] {
  return m.names.map((name, i) => {
    const o = i * FIELDS;
    return { name, offset: m.table[o], compressedSize: m.table[o + 1], size: m.table[o + 2], method: m.table[o + 3], extraLength: m.table[o + 4], flags: 0, crc32: 0 };
  });
}

function metaTable(entries: ZipEntry[]): Float64Array {
  const t = new Float64Array(entries.length * FIELDS);
  entries.forEach((e, i) => {
    const o = i * FIELDS;
    t[o] = e.offset;
    t[o + 1] = e.compressedSize;
    t[o + 2] = e.size;
    t[o + 3] = e.method;
    t[o + 4] = e.extraLength;
  });
  return t;
}

const decoder = new TextDecoder();

class JavaAssets implements AssetIndex {
  readonly edition = 'java' as const;
  readonly textures: TextureInfo[];
  private readonly sorted: string[];
  private readonly nameSet: Set<string>;
  private readonly entries = new Map<string, ZipEntry>();
  private readonly files = new Map<string, Uint8Array>();
  private readonly loaded = new Set<string>();
  private readonly groupLoads = new SharedLoader<void>();

  constructor(
    readonly version: string,
    private meta: StoredMeta,
    private zip: RangeZip | null,
  ) {
    this.sorted = [...meta.names].sort();
    this.nameSet = new Set(meta.names);
    for (const e of entriesFromMeta(meta)) this.entries.set(e.name, e);
    this.textures = buildJavaTextureList(this.sorted);
  }

  addGroup(group: string, files: Map<string, Uint8Array>): void {
    for (const [n, b] of files) this.files.set(n, b);
    this.loaded.add(group);
    if (group === 'core') refineAnimated(this.textures, (p) => this.files.get(p));
  }

  hasGroup(group: string): boolean {
    return this.loaded.has(group);
  }

  get cachedGroups(): string[] {
    return [...this.loaded];
  }

  hasFile(path: string): boolean {
    return this.nameSet.has(path);
  }

  listFiles(prefix: string): string[] {
    // Binary search for the first name >= prefix in the sorted list.
    let lo = 0;
    let hi = this.sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.sorted[mid] < prefix) lo = mid + 1;
      else hi = mid;
    }
    const out: string[] = [];
    for (let i = lo; i < this.sorted.length && this.sorted[i].startsWith(prefix); i++) out.push(this.sorted[i]);
    return out;
  }

  async readFile(path: string): Promise<Uint8Array> {
    const hit = this.files.get(path);
    if (hit) return hit.slice();
    if (!this.nameSet.has(path)) throw new Error(`${path} isn't part of Minecraft ${this.version}.`);
    const group = javaGroupOf(path);
    if (!group) throw new Error(`${path} isn't available.`);
    await this.ensureGroup(group);
    const bytes = this.files.get(path);
    if (!bytes) throw new Error(`${path} couldn't be loaded.`);
    return bytes.slice();
  }

  async readText(path: string): Promise<string> {
    return decoder.decode(await this.readFile(path));
  }

  async readImage(path: string): Promise<ImageData> {
    return decodeImage(await this.readFile(path), 'png');
  }

  /**
   * Makes sure a download group (e.g. 'shaders', 'models') is in memory. Concurrent callers share
   * one download; a caller's signal only cancels it when no other caller still waits for it.
   */
  ensureGroup(group: string, opts: { onProgress?: ProgressFn; signal?: AbortSignal } = {}): Promise<void> {
    if (this.loaded.has(group)) return Promise.resolve();
    return this.groupLoads.load(group, opts.onProgress, (emit, signal) => this.loadGroup(group, { onProgress: emit, signal }), { signal: opts.signal });
  }

  private async loadGroup(group: string, opts: { onProgress?: ProgressFn; signal?: AbortSignal }): Promise<void> {
    const stored = await cacheGet<StoredGroup>(key(this.version, `g:${group}`)).catch(() => undefined);
    if (isStoredGroup(stored)) {
      const files = new Map<string, Uint8Array>();
      unpackGroup(stored, files);
      this.addGroup(group, files);
      return;
    }
    const names = this.meta.names.filter((n) => javaGroupOf(n) === group);
    if (!names.length) {
      this.addGroup(group, new Map());
      return;
    }
    const zip = await this.remoteZip();
    let files: Map<string, Uint8Array>;
    try {
      files = await zip.readMany(names.map((n) => this.entries.get(n)!), {
        label: `Downloading Minecraft ${this.version} ${group.replace(/_/g, ' ')}`,
        onProgress: opts.onProgress,
        signal: opts.signal,
      });
    } catch (err) {
      if (isAbortError(err) || opts.signal?.aborted || !(zip.source instanceof HttpRangeSource)) throw err;
      await this.loadEverything(zip.source, opts);
      return;
    }
    this.addGroup(group, files);
    await persistGroups(this.version, this.meta, { [group]: files }).catch(() => {});
  }

  /** Range reads failed: download the whole jar once and keep every group. */
  private async loadEverything(src: HttpRangeSource, opts: { onProgress?: ProgressFn; signal?: AbortSignal }): Promise<void> {
    const bytes = await fetchWithProgress(src.url, { label: `Downloading Minecraft ${this.version}`, expectedSize: src.size, onProgress: opts.onProgress, signal: opts.signal });
    if (bytes.length !== src.size) throw new Error(`The Minecraft ${this.version} download was incomplete. Try again.`);
    const zip = new RangeZip(new MemorySource(bytes), entriesFromMeta(this.meta), this.meta.dataEnd);
    const all = await zip.readMany(this.meta.names, { signal: opts.signal });
    const byGroup: Record<string, Map<string, Uint8Array>> = {};
    for (const [n, b] of all) (byGroup[javaGroupOf(n)!] ??= new Map()).set(n, b);
    for (const [g, m] of Object.entries(byGroup)) this.addGroup(g, m);
    await persistGroups(this.version, this.meta, byGroup).catch(() => {});
  }

  private async remoteZip(): Promise<RangeZip> {
    if (this.zip) return this.zip;
    let url = this.meta.jarUrl;
    let size = this.meta.jarSize;
    if (!url) {
      const info = await getClientJarInfo(this.version).catch(() => null);
      if (info && (!this.meta.jarSha1 || info.sha1 === this.meta.jarSha1)) {
        url = info.url;
        size = info.size;
      }
    }
    if (!url) throw new Error(`These Minecraft ${this.version} files aren't downloaded yet. Connect to the internet or pick the game's .jar file again.`);
    this.zip = new RangeZip(new HttpRangeSource(url, size, `Downloading Minecraft ${this.version}`), entriesFromMeta(this.meta), this.meta.dataEnd);
    return this.zip;
  }
}

async function persistGroups(versionId: string, meta: StoredMeta, groups: Record<string, Map<string, Uint8Array>>): Promise<void> {
  const names = Object.keys(groups);
  if (!names.length) return;
  const writes: [string, unknown][] = names.map((g) => [key(versionId, `g:${g}`), packGroup(groups[g])]);
  // Groups first, then the meta that says they exist.
  await cacheSetMany(writes);
  meta.groups = [...new Set([...meta.groups, ...names])];
  meta.savedAt = Date.now();
  await cacheSet(key(versionId, 'meta'), meta);
}

const instances = new SharedLoader<JavaAssets>();
onAssetCacheCleared(() => instances.clear());

async function fromCache(versionId: string): Promise<JavaAssets | null> {
  const meta = await cacheGet<StoredMeta>(key(versionId, 'meta')).catch(() => undefined);
  if (!isStoredMeta(meta, versionId) || !meta.groups.includes('core')) return null;
  const groupKeys = meta.groups.map((g) => key(versionId, `g:${g}`));
  const stored = await cacheGetMany<StoredGroup>(groupKeys);
  if (!isStoredGroup(stored[meta.groups.indexOf('core')])) return null;
  const assets = new JavaAssets(versionId, meta, null);
  meta.groups.forEach((g, i) => {
    const s = stored[i];
    if (!isStoredGroup(s)) return;
    const files = new Map<string, Uint8Array>();
    unpackGroup(s, files);
    assets.addGroup(g, files);
  });
  return assets;
}

interface SourceInfo {
  jar?: ClientJarInfo;
  fromFile?: boolean;
}

const wrongJar = (versionId: string, what: string) =>
  new Error(`That jar is ${what}, but Minecraft ${versionId} is selected. Pick the ${versionId} jar (versions/${versionId}/${versionId}.jar in your .minecraft folder) or switch versions.`);

/** Rejects a user-picked jar that belongs to another version, so it isn't cached under the wrong one. */
function checkUserJar(versionId: string, entries: ZipEntry[], versionJson: Uint8Array | undefined): void {
  if (versionJson) {
    let vj: { id?: string; name?: string };
    try {
      vj = JSON.parse(decoder.decode(versionJson));
    } catch {
      return; // unreadable version.json: accept
    }
    if (vj.id && vj.id !== versionId && vj.name !== versionId) throw wrongJar(versionId, `Minecraft ${vj.id}`);
    return;
  }
  // No version.json (1.13.2 and older): only known releases can be checked.
  const i = KNOWN_RELEASES.indexOf(versionId);
  if (i < 0) return;
  if (i >= KNOWN_RELEASES.indexOf('1.14')) throw wrongJar(versionId, 'from an older Minecraft version (it has no version.json)');
  const has = (dir: string) => entries.some((e) => e.name.startsWith(`${JAVA_TEXTURE_ROOT}${dir}/`));
  const flattened = KNOWN_RELEASE_FORMATS[versionId].major >= 4;
  if (flattened && !has('block') && has('blocks')) throw wrongJar(versionId, 'from Minecraft 1.12.2 or older');
  if (!flattened && !has('blocks') && has('block')) throw wrongJar(versionId, 'from Minecraft 1.13 or newer');
}

async function fromSource(versionId: string, source: ByteSource, info: SourceInfo, onProgress: ProgressFn | undefined, signal?: AbortSignal): Promise<JavaAssets> {
  const report = (label: string, fraction: number | null, extra?: { loaded?: number; total?: number }) => onProgress?.({ label, fraction, ...extra });
  report(`Reading the Minecraft ${versionId} file list`, null);
  const zip = await RangeZip.open(source, {
    signal,
    label: `Reading the Minecraft ${versionId} file list`,
    onProgress,
  });
  const listed = zip.entries.filter((e) => javaGroupOf(e.name) !== null);
  if (!listed.some((e) => e.name.startsWith(JAVA_TEXTURE_ROOT))) {
    throw new Error(info.fromFile ? "That file doesn't look like a Minecraft Java client jar (no textures inside)." : `The Minecraft ${versionId} download has no textures.`);
  }
  // Local files and fully downloaded jars are cheap to read completely; remote jars only need textures now.
  const eager = source.kind !== 'http' || !!source.full;
  const wanted = eager ? listed : listed.filter((e) => javaGroupOf(e.name) === 'core');
  const files = await zip.readMany(wanted, {
    signal,
    label: `Downloading Minecraft ${versionId} textures`,
    onProgress,
  });
  throwIfAborted(signal);
  const everything = eager || !!source.full;
  if (!eager && source.full) {
    // The server sent the whole jar; take the rest from memory too.
    const rest = await zip.readMany(listed.filter((e) => !files.has(e.name)), { signal });
    for (const [n, b] of rest) files.set(n, b);
  }

  if (info.fromFile) checkUserJar(versionId, listed, files.get('version.json'));

  const meta: StoredMeta = {
    format: JAVA_CACHE_FORMAT,
    versionId,
    jarUrl: info.jar?.url,
    jarSize: info.jar?.size ?? source.size,
    jarSha1: info.jar?.sha1,
    dataEnd: zip.dataEnd,
    names: listed.map((e) => e.name),
    table: metaTable(listed),
    groups: [],
    savedAt: Date.now(),
  };
  const byGroup: Record<string, Map<string, Uint8Array>> = {};
  for (const e of listed) {
    const g = javaGroupOf(e.name)!;
    if (!everything && g !== 'core') continue;
    const bytes = files.get(e.name);
    if (!bytes) continue;
    (byGroup[g] ??= new Map()).set(e.name, bytes);
  }
  if (!byGroup.core) byGroup.core = new Map();
  if (everything) for (const e of listed) byGroup[javaGroupOf(e.name)!] ??= new Map();
  const assets = new JavaAssets(versionId, meta, everything ? null : zip);
  for (const [g, m] of Object.entries(byGroup)) assets.addGroup(g, m);
  report('Saving for offline use', null);
  try {
    await persistGroups(versionId, meta, byGroup);
  } catch (err) {
    console.warn('Could not cache Minecraft assets for offline use:', err);
  }
  return assets;
}

async function load(versionId: string, opts: { onProgress?: ProgressFn; jarFile?: File; signal?: AbortSignal }): Promise<JavaAssets> {
  const { onProgress, jarFile, signal } = opts;
  if (!jarFile) {
    const cached = await fromCache(versionId);
    if (cached) return cached;
  }
  throwIfAborted(signal);
  if (jarFile) {
    const jar = await getClientJarInfo(versionId).catch(() => undefined);
    return fromSource(versionId, new BlobSource(jarFile), { jar: jar && jar.size === jarFile.size ? jar : undefined, fromFile: true }, onProgress, signal);
  }
  onProgress?.({ label: `Finding Minecraft ${versionId}`, fraction: null });
  const jar = await getClientJarInfo(versionId);
  try {
    return await fromSource(versionId, new HttpRangeSource(jar.url, jar.size, `Downloading Minecraft ${versionId}`), { jar }, onProgress, signal);
  } catch (err) {
    if (isAbortError(err) || signal?.aborted) throw err;
    console.warn('Range download failed, downloading the whole jar instead:', err);
  }
  const bytes = await fetchWithProgress(jar.url, {
    label: `Downloading Minecraft ${versionId}`,
    expectedSize: jar.size,
    onProgress,
    signal,
  });
  if (bytes.length !== jar.size) throw new Error(`The Minecraft ${versionId} download was incomplete. Try again.`);
  return fromSource(versionId, new MemorySource(bytes), { jar }, onProgress, signal);
}

/**
 * Loads (or reuses) the vanilla asset index for a Java version. Concurrent callers share the
 * download; aborting one caller's signal only stops it when nobody else is waiting.
 */
export function loadJavaAssets(versionId: string, opts: { onProgress?: ProgressFn; jarFile?: File; signal?: AbortSignal } = {}): Promise<AssetIndex> {
  return instances.load(
    versionId,
    opts.onProgress,
    (emit, signal) => load(versionId, { jarFile: opts.jarFile, onProgress: emit, signal }),
    { fresh: !!opts.jarFile, signal: opts.signal },
  );
}

export async function isJavaAssetsCached(versionId: string): Promise<boolean> {
  const meta = await cacheGet<StoredMeta>(key(versionId, 'meta')).catch(() => undefined);
  return isStoredMeta(meta, versionId) && meta.groups.includes('core');
}

/**
 * Downloads extra groups of a loaded Java index ahead of time (e.g. ['shaders', 'post_effect']),
 * reporting progress. readFile() does this automatically on first use.
 */
export async function prefetchJavaGroups(index: AssetIndex, groups: string[], opts: { onProgress?: ProgressFn; signal?: AbortSignal } = {}): Promise<void> {
  if (!(index instanceof JavaAssets)) return;
  for (const g of groups) await index.ensureGroup(g, opts);
}

/** Java versions with vanilla assets stored locally. */
export async function listCachedJavaVersions(): Promise<string[]> {
  const prefix = `java-assets:v${JAVA_CACHE_FORMAT}:`;
  return (await cacheKeys(prefix)).filter((k) => k.endsWith(':meta')).map((k) => k.slice(prefix.length, -':meta'.length));
}

/** Removes one version's stored files (they will be downloaded again when needed). */
export async function deleteCachedJavaVersion(versionId: string): Promise<void> {
  instances.forget(versionId);
  await cacheDeleteMany(await cacheKeys(`java-assets:v${JAVA_CACHE_FORMAT}:${versionId}:`));
}

/** A cached text file of a version's jar, without any network access. */
export async function readCachedJarText(versionId: string, path: string): Promise<string | null> {
  const group = javaGroupOf(path);
  if (!group) return null;
  const inst = instances.peek(versionId);
  if (inst) {
    const a = await inst.catch(() => null);
    if (a?.hasGroup(group) && a.hasFile(path)) return a.readText(path);
  }
  const stored = await cacheGet<StoredGroup>(key(versionId, `g:${group}`)).catch(() => undefined);
  if (!isStoredGroup(stored)) return null;
  const i = stored.names.indexOf(path);
  return i < 0 ? null : decoder.decode(stored.data.subarray(stored.offsets[i], stored.offsets[i + 1]));
}

/** Which download group a jar path belongs to (null = not kept). */
export { javaGroupOf };
