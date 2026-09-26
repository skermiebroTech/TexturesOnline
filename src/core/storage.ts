import { createStore, get, set, setMany, getMany, del, delMany, keys, values, clear, type UseStore } from 'idb-keyval';
import type { Project } from './types';

/*
 * Two IndexedDB databases: 'to-cache' (re-downloadable game files, version lists) and
 * 'to-projects' (user work). When IndexedDB is unavailable (some private windows, Node)
 * everything falls back to memory so the app still works for the session.
 */

type Backend = { idb: UseStore } | { mem: Map<string, unknown> };

const backends = new Map<string, Promise<Backend>>();
let persistent = true;

function hasIndexedDb(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function backend(db: string): Promise<Backend> {
  let b = backends.get(db);
  if (!b) {
    b = (async (): Promise<Backend> => {
      if (!hasIndexedDb()) {
        persistent = false;
        return { mem: new Map() };
      }
      const store = createStore(db, 'kv');
      try {
        // Probe once: opening can fail in private modes or when storage is blocked.
        await store('readonly', (s) => s.count());
        return { idb: store };
      } catch {
        persistent = false;
        return { mem: new Map() };
      }
    })();
    backends.set(db, b);
  }
  return b;
}

const cacheDb = () => backend('to-cache');
const projectsDb = () => backend('to-projects');

/** False once we know data only lives in memory (IndexedDB unavailable). */
export function isStoragePersistent(): boolean {
  return persistent;
}

function storageError(err: unknown): Error {
  if (err instanceof Error && (err.name === 'QuotaExceededError' || /quota/i.test(err.message))) {
    const e = new Error('Your browser is out of storage space for this site. Clear cached game files in Settings or free up disk space.');
    e.name = 'QuotaExceededError';
    return e;
  }
  return err instanceof Error ? err : new Error(String(err));
}

// ---- Cache (re-downloadable data) ----

export async function cacheGet<T = unknown>(key: string): Promise<T | undefined> {
  const b = await cacheDb();
  if ('mem' in b) return b.mem.get(key) as T | undefined;
  try {
    return await get<T>(key, b.idb);
  } catch {
    return undefined;
  }
}

export async function cacheGetMany<T = unknown>(keyList: string[]): Promise<(T | undefined)[]> {
  if (!keyList.length) return [];
  const b = await cacheDb();
  if ('mem' in b) return keyList.map((k) => b.mem.get(k) as T | undefined);
  try {
    return await getMany<T>(keyList, b.idb);
  } catch {
    return keyList.map(() => undefined);
  }
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  const b = await cacheDb();
  if ('mem' in b) {
    b.mem.set(key, value);
    return;
  }
  try {
    await set(key, value, b.idb);
  } catch (err) {
    throw storageError(err);
  }
}

export async function cacheSetMany(entries: [string, unknown][]): Promise<void> {
  if (!entries.length) return;
  const b = await cacheDb();
  if ('mem' in b) {
    for (const [k, v] of entries) b.mem.set(k, v);
    return;
  }
  try {
    await setMany(entries, b.idb);
  } catch (err) {
    throw storageError(err);
  }
}

export async function cacheDelete(key: string): Promise<void> {
  const b = await cacheDb();
  if ('mem' in b) {
    b.mem.delete(key);
    return;
  }
  await del(key, b.idb);
}

export async function cacheDeleteMany(keyList: string[]): Promise<void> {
  if (!keyList.length) return;
  const b = await cacheDb();
  if ('mem' in b) {
    for (const k of keyList) b.mem.delete(k);
    return;
  }
  await delMany(keyList, b.idb);
}

export async function cacheKeys(prefix?: string): Promise<string[]> {
  const b = await cacheDb();
  let all: string[];
  if ('mem' in b) all = [...b.mem.keys()];
  else {
    try {
      all = (await keys(b.idb)).filter((k): k is string => typeof k === 'string');
    } catch {
      return [];
    }
  }
  return prefix ? all.filter((k) => k.startsWith(prefix)) : all;
}

/** Removes every cached game file and version list. Projects are kept. */
export async function clearAssetCache(): Promise<void> {
  const b = await cacheDb();
  if ('mem' in b) b.mem.clear();
  else await clear(b.idb);
  for (const fn of clearListeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

const clearListeners = new Set<() => void>();
/** Lets in-memory caches drop their contents when the asset cache is cleared. */
export function onAssetCacheCleared(fn: () => void): () => void {
  clearListeners.add(fn);
  return () => clearListeners.delete(fn);
}

// ---- Projects ----

const PROJECT_PREFIX = 'project:';

export async function listProjects(kind?: Project['kind']): Promise<Project[]> {
  const b = await projectsDb();
  let all: unknown[];
  if ('mem' in b) all = [...b.mem.values()];
  else all = await values(b.idb);
  const list = all.filter((p): p is Project => !!p && typeof p === 'object' && typeof (p as Project).id === 'string' && typeof (p as Project).kind === 'string');
  return list.filter((p) => !kind || p.kind === kind).sort((a, b2) => (b2.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getProject<T extends Project = Project>(id: string): Promise<T | undefined> {
  const b = await projectsDb();
  if ('mem' in b) return b.mem.get(PROJECT_PREFIX + id) as T | undefined;
  return get<T>(PROJECT_PREFIX + id, b.idb);
}

export async function saveProject(p: Project): Promise<void> {
  p.updatedAt = Date.now();
  if (!p.createdAt) p.createdAt = p.updatedAt;
  const b = await projectsDb();
  if ('mem' in b) {
    b.mem.set(PROJECT_PREFIX + p.id, p);
    return;
  }
  try {
    await set(PROJECT_PREFIX + p.id, p, b.idb);
  } catch (err) {
    throw storageError(err);
  }
}

export async function deleteProject(id: string): Promise<void> {
  const b = await projectsDb();
  if ('mem' in b) {
    b.mem.delete(PROJECT_PREFIX + id);
    return;
  }
  await del(PROJECT_PREFIX + id, b.idb);
}

// ---- Quota ----

export async function estimateUsage(): Promise<{ usage: number; quota: number } | null> {
  try {
    const nav = (globalThis as { navigator?: Navigator }).navigator;
    if (!nav?.storage?.estimate) return null;
    const e = await nav.storage.estimate();
    return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
  } catch {
    return null;
  }
}

/** Asks the browser not to evict our data under storage pressure. Resolves to whether it is persisted. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const nav = (globalThis as { navigator?: Navigator }).navigator;
    if (!nav?.storage?.persist) return false;
    if (await nav.storage.persisted()) return true;
    return await nav.storage.persist();
  } catch {
    return false;
  }
}
