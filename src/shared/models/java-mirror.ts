// Java block models and blockstates for the Bedrock model library (Bedrock builds its block shapes into
// the game; Java describes the same shapes in model files). Downloaded on first use from a public
// mirror of the game's model files (misode/mcmeta summary branch, CORS enabled), cached in IndexedDB,
// never bundled with the app.

import { cacheGet, cacheSet } from '../../core/storage';
import { fetchFirst, fetchText } from '../../core/net';
import type { ProgressFn } from '../../core/types';
import { mirrorJson } from './bedrock-java';
import type { JsonGet } from './java-models';

/** Newest Java release whose shapes are used (the mirror has a branch per version). */
export const JAVA_MIRROR_VERSION = '26.3';

const FILES = ['assets/block_definition/data.min.json', 'assets/model/data.min.json'] as const;

function urls(version: string, file: string): string[] {
  return [`https://raw.githubusercontent.com/misode/mcmeta/${version}-summary/${file}`, `https://cdn.jsdelivr.net/gh/misode/mcmeta@${version}-summary/${file}`];
}

let loading: Promise<JsonGet | null> | null = null;

/** The Java model files as a pack-path lookup, or null when they can't be loaded (offline first run). */
export function loadJavaModelMirror(opts: { onProgress?: ProgressFn; signal?: AbortSignal; version?: string } = {}): Promise<JsonGet | null> {
  if (loading) return loading;
  const version = opts.version ?? JAVA_MIRROR_VERSION;
  const key = `models:java-mirror:${version}`;
  loading = (async () => {
    let texts = await cacheGet<string[]>(key).catch(() => undefined);
    if (!Array.isArray(texts) || texts.length !== FILES.length || texts.some((t) => typeof t !== 'string')) {
      opts.onProgress?.({ label: 'Downloading block shapes', fraction: null });
      texts = await Promise.all(FILES.map((f) => fetchFirst(urls(version, f), (u) => fetchText(u, { signal: opts.signal, timeoutMs: 30_000 }))));
      await cacheSet(key, texts).catch(() => undefined);
    }
    const [defs, models] = texts.map((t) => JSON.parse(t) as Record<string, unknown>);
    return mirrorJson(defs, models);
  })().catch((err) => {
    console.warn('Block shapes could not be loaded', err);
    loading = null;
    return null;
  });
  return loading;
}
