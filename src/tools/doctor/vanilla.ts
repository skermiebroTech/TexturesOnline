// Pack Doctor: the game's own file names, so references to vanilla textures and models can be told
// from missing ones. Java: the central directory of the version's client jar (one small range
// read, or the texture tool's offline copy when it has one) plus its block and item atlas lists.
// Bedrock: the bundled bedrock-samples index (public/data/bedrock). Both are optional: without
// them (offline) those checks are skipped.

import { openHttpZip } from '../../core/rangezip';
import { fetchJson } from '../../core/net';
import { appDataUrl } from '../../editions/bedrock/versions';
import { catalogFromIndex, isBedrockIndexFile, parseLenientJson } from '../../editions/bedrock/catalog';

export interface JavaVanilla {
  version: string;
  files: Set<string>;
  /** Sources of the blocks and items atlases (1.19.3 and newer), null for older versions */
  atlas: unknown[] | null;
}

export interface BedrockVanilla {
  version: string;
  files: Set<string>;
  /** Lowercase path -> path */
  lower: Map<string, string>;
}

const ATLASES = ['assets/minecraft/atlases/blocks.json', 'assets/minecraft/atlases/items.json'];
const decoder = new TextDecoder();
const javaMem = new Map<string, Promise<JavaVanilla | null>>();
let bedrockMem: Promise<BedrockVanilla | null> | null = null;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

function atlasSources(texts: (string | null)[]): unknown[] | null {
  const all: unknown[] = [];
  let any = false;
  for (const t of texts) {
    if (!t) continue;
    try {
      const sources = (parseLenientJson(t) as { sources?: unknown }).sources;
      if (Array.isArray(sources)) {
        all.push(...sources);
        any = true;
      }
    } catch {
      /* skip */
    }
  }
  return any ? all : null;
}

async function loadJava(version: string): Promise<JavaVanilla | null> {
  // The texture tool's offline copy, when this version was opened there before.
  try {
    const { isJavaAssetsCached, loadJavaAssets } = await import('../../editions/java/assets');
    if (await isJavaAssetsCached(version)) {
      const a = await loadJavaAssets(version);
      const files = new Set(a.listFiles('assets/'));
      const texts = await Promise.all(ATLASES.map((p) => (a.hasFile(p) ? withTimeout(a.readText(p), 8000).catch(() => null) : Promise.resolve(null))));
      return { version, files, atlas: atlasSources(texts) };
    }
  } catch {
    /* fall back to the jar */
  }
  const { getClientJarInfo } = await import('../../editions/java/versions');
  const jar = await getClientJarInfo(version);
  const zip = await openHttpZip(jar.url, jar.size);
  const files = new Set(zip.names().filter((n) => n.startsWith('assets/') && !n.endsWith('/')));
  const present = ATLASES.filter((p) => zip.has(p));
  const read = present.length ? await zip.readMany(present).catch(() => new Map<string, Uint8Array>()) : new Map<string, Uint8Array>();
  return { version, files, atlas: atlasSources(present.map((p) => (read.get(p) ? decoder.decode(read.get(p)) : null))) };
}

/** The file names of a Java version, or null when they can't be fetched (offline). */
export function javaVanilla(version: string): Promise<JavaVanilla | null> {
  let p = javaMem.get(version);
  if (!p) {
    p = withTimeout(loadJava(version), 25_000)
      .catch(() => null)
      .then((v) => {
        if (!v) javaMem.delete(version);
        return v;
      });
    javaMem.set(version, p);
  }
  return p;
}

/** The file names of the current Bedrock release, or null. */
export function bedrockVanilla(): Promise<BedrockVanilla | null> {
  bedrockMem ??= fetchJson(appDataUrl('data/bedrock/index-main.json'), { retries: 1, timeoutMs: 20_000 })
    .then((json) => {
      if (!isBedrockIndexFile(json)) return null;
      const cat = catalogFromIndex(json);
      const files = new Set(cat.files);
      return { version: cat.version ?? '', files, lower: new Map(cat.files.map((f) => [f.toLowerCase(), f])) };
    })
    .catch(() => null)
    .then((v) => {
      if (!v) bedrockMem = null;
      return v;
    });
  return bedrockMem;
}
