/**
 * Real game files as AssetIndex objects for the model tests: Java client jars and the Bedrock vanilla
 * JSON from the research fixtures (TO_FIXTURES). Nothing here is stored in the repository; callers skip
 * when the files are missing.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import type { AssetIndex } from '../../../src/core/types';
import { buildJavaTextureList } from '../../../src/editions/java/textures';
import { bedrockTexturesFromFiles, catalogFromIndex, flipbookStems, parseLenientJson, type BedrockIndexFile } from '../../../src/editions/bedrock/catalog';
import { fixturesDir } from '../data/fixtures';

const ROOT = new URL('../../../', import.meta.url).pathname;

export function javaJarPath(version: string): string | null {
  const dir = fixturesDir();
  const candidates = [join(dir, 'research-cache', 'jars', `${version}.jar`)];
  if (version === '26.3') candidates.unshift(join(dir, 'client-26.3.jar'));
  return candidates.find((p) => existsSync(p)) ?? null;
}

const javaCache = new Map<string, AssetIndex>();

/** Model JSON, language files and the list of every file of a Java client jar. */
export function javaJarAssets(version: string): AssetIndex | null {
  const hit = javaCache.get(version);
  if (hit) return hit;
  const jar = javaJarPath(version);
  if (!jar) return null;
  const names: string[] = [];
  const files = unzipSync(new Uint8Array(readFileSync(jar)), {
    filter: (f) => {
      if (f.name.endsWith('/')) return false;
      names.push(f.name);
      return /^assets\/minecraft\/(blockstates|models|items|lang)\//.test(f.name) && /\.(json|lang)$/.test(f.name);
    },
  });
  const sorted = [...names].sort();
  const set = new Set(sorted);
  const read = async (p: string) => {
    const b = files[p];
    if (!b) throw new Error(`not loaded in the test fixture: ${p}`);
    return b;
  };
  const assets: AssetIndex = {
    edition: 'java',
    version,
    textures: buildJavaTextureList(sorted),
    hasFile: (p) => set.has(p),
    listFiles: (prefix) => sorted.filter((p) => p.startsWith(prefix)),
    readFile: read,
    readText: async (p) => new TextDecoder().decode(await read(p)),
    readImage: async () => {
      throw new Error('images are not loaded in the model fixture');
    },
  };
  javaCache.set(version, assets);
  return assets;
}

let bedrockCache: AssetIndex | null | undefined;

/** The Bedrock samples resource pack (entities, geometry, entity textures) in the fixtures, if there. */
export function bedrockSamplesDir(): string | null {
  const dir = join(fixturesDir(), 'research-cache', 'bedrock-samples-v1.26.50.4', 'resource_pack');
  return existsSync(join(dir, 'entity')) ? dir : null;
}

/** Width and height of a PNG from its header. */
export function pngSize(b: Uint8Array): [number, number] {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return [v.getUint32(16), v.getUint32(20)];
}

/** Sizes of the entity textures of a Java jar (pack path to [width, height]). */
export function javaEntityTextureSizes(version: string): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>();
  const jar = javaJarPath(version);
  if (!jar) return out;
  const files = unzipSync(new Uint8Array(readFileSync(jar)), { filter: (f) => /^assets\/minecraft\/textures\/entity\/.*\.png$/.test(f.name) });
  for (const [name, data] of Object.entries(files)) out.set(name, pngSize(data));
  return out;
}

/** Bedrock vanilla file list (bundled index) plus blocks.json and the atlases from the fixtures. */
export function bedrockAssets(): AssetIndex | null {
  if (bedrockCache !== undefined) return bedrockCache;
  const dir = join(fixturesDir(), 'research-cache', 'bedrock');
  const src: Record<string, string> = {
    'blocks.json': join(dir, 'main-blocks.json'),
    'textures/terrain_texture.json': join(dir, 'main-terrain_texture.json'),
    'textures/item_texture.json': join(dir, 'main-item_texture.json'),
    'textures/flipbook_textures.json': join(dir, 'main-flipbook_textures.json'),
  };
  const indexFile = join(ROOT, 'public/data/bedrock/index-main.json');
  if (!Object.values(src).every(existsSync) || !existsSync(indexFile)) {
    bedrockCache = null;
    return null;
  }
  const catalog = catalogFromIndex(JSON.parse(readFileSync(indexFile, 'utf8')) as BedrockIndexFile);
  const flip = new Set(flipbookStems(parseLenientJson(readFileSync(src['textures/flipbook_textures.json'], 'utf8'))));
  const set = new Set(catalog.files);
  // mob files (entities, geometry, animations...) from the Bedrock samples, when present
  const samples = bedrockSamplesDir();
  const read = async (p: string) => {
    if (src[p]) return new Uint8Array(readFileSync(src[p]));
    if (samples && /^(entity|models|animations|animation_controllers|render_controllers|attachables)\//.test(p) && existsSync(join(samples, p))) return new Uint8Array(readFileSync(join(samples, p)));
    throw new Error(`not in the Bedrock fixture: ${p}`);
  };
  bedrockCache = {
    edition: 'bedrock',
    version: 'latest',
    textures: bedrockTexturesFromFiles(catalog.files, flip),
    hasFile: (p) => set.has(p),
    listFiles: (prefix) => catalog.files.filter((p) => p.startsWith(prefix)),
    readFile: read,
    readText: async (p) => new TextDecoder().decode(await read(p)),
    readImage: async () => {
      throw new Error('images are not loaded in the model fixture');
    },
  };
  return bedrockCache;
}

const javaJsonCache = new Map<string, ((path: string) => unknown) | null>();

/**
 * Java blockstates and block models of a client jar as a JSON lookup by pack path: what the Bedrock
 * library borrows its built-in shapes from (instead of downloading the model mirror).
 */
export function javaModelJson(version = '26.3'): ((path: string) => unknown) | null {
  if (javaJsonCache.has(version)) return javaJsonCache.get(version)!;
  const jar = javaJarPath(version);
  if (!jar) {
    javaJsonCache.set(version, null);
    return null;
  }
  const files = unzipSync(new Uint8Array(readFileSync(jar)), { filter: (f) => /^assets\/minecraft\/(blockstates|models)\/.*\.json$/.test(f.name) });
  const parsed = new Map<string, unknown>();
  const get = (path: string): unknown => {
    if (parsed.has(path)) return parsed.get(path);
    const b = files[path];
    let v: unknown;
    try {
      v = b ? JSON.parse(new TextDecoder().decode(b)) : undefined;
    } catch {
      v = undefined;
    }
    parsed.set(path, v);
    return v;
  };
  javaJsonCache.set(version, get);
  return get;
}
