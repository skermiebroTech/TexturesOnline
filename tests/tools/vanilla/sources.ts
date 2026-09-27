/**
 * Real game shader sources for the vanilla shader tests, read from Minecraft client jars at runtime
 * (never stored in the repo). Extracted files are cached next to the jars.
 *
 * Fixture directory: $TO_FIXTURES (a directory holding research-cache/jars/<version>.jar and
 * optionally client-26.3.jar). Tests skip when it is unset or missing.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import type { PackFormat } from '../../../src/core/types';

export function fixturesDir(): string | null {
  const dir = process.env.TO_FIXTURES;
  return dir && existsSync(join(dir, 'research-cache', 'jars')) ? dir : null;
}

export interface JarRef {
  version: string;
  path: string;
}

/** All client jars available as fixtures, keyed by version id (file name without .jar). */
export function listJars(): JarRef[] {
  const dir = fixturesDir();
  if (!dir) return [];
  const out = new Map<string, string>();
  const jars = join(dir, 'research-cache', 'jars');
  if (existsSync(jars)) {
    for (const f of readdirSync(jars)) {
      if (!f.endsWith('.jar') || /optifine/i.test(f)) continue;
      out.set(f.slice(0, -4), join(jars, f));
    }
  }
  const extra = join(dir, 'client-26.3.jar');
  if (existsSync(extra) && !out.has('26.3')) out.set('26.3', extra);
  return [...out.entries()].map(([version, path]) => ({ version, path })).sort((a, b) => compareVersions(a.version, b.version));
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  const pb = b.split(/[.-]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (typeof x === 'number' && typeof y === 'number') {
      if (x !== y) return x - y;
    } else if (String(x) !== String(y)) {
      return typeof x === 'number' ? 1 : typeof y === 'number' ? -1 : String(x).localeCompare(String(y));
    }
  }
  return 0;
}

export interface VersionShaders {
  version: string;
  packFormat: PackFormat | null;
  sources: Record<string, string>;
}

const PREFIXES = ['assets/minecraft/shaders/', 'assets/minecraft/post_effect/'];
const CACHE_FORMAT = 1;

function packFormatFromVersionJson(text: string | undefined): PackFormat | null {
  if (!text) return null;
  try {
    const pv = (JSON.parse(text) as { pack_version?: unknown }).pack_version;
    if (typeof pv === 'number') return { major: pv, minor: 0 };
    if (pv && typeof pv === 'object') {
      const o = pv as Record<string, unknown>;
      if (typeof o.resource_major === 'number') return { major: o.resource_major, minor: typeof o.resource_minor === 'number' ? o.resource_minor : 0 };
      if (typeof o.resource === 'number') return { major: o.resource, minor: 0 };
    }
  } catch {
    /* not JSON */
  }
  return null;
}

/** Shader + post effect sources of one jar (cached as JSON under <fixtures>/vanilla-shader-cache). */
export function loadVersionShaders(jar: JarRef): VersionShaders {
  const dir = fixturesDir() ?? '/tmp';
  const cacheDir = join(dir, 'vanilla-shader-cache');
  const st = statSync(jar.path);
  const cacheFile = join(cacheDir, `${jar.version}.json`);
  const stamp = `${CACHE_FORMAT}:${st.size}:${Math.trunc(st.mtimeMs)}`;
  if (existsSync(cacheFile)) {
    try {
      const c = JSON.parse(readFileSync(cacheFile, 'utf8')) as VersionShaders & { stamp: string };
      if (c.stamp === stamp) return { version: c.version, packFormat: c.packFormat, sources: c.sources };
    } catch {
      /* re-extract */
    }
  }
  const files = unzipSync(new Uint8Array(readFileSync(jar.path)), {
    filter: (f) => f.name === 'version.json' || PREFIXES.some((p) => f.name.startsWith(p) && !f.name.endsWith('/')),
  });
  const sources: Record<string, string> = {};
  for (const [name, data] of Object.entries(files)) if (name !== 'version.json') sources[name] = strFromU8(data);
  const result: VersionShaders = { version: jar.version, packFormat: packFormatFromVersionJson(files['version.json'] ? strFromU8(files['version.json']) : undefined), sources };
  try {
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(cacheFile, JSON.stringify({ ...result, stamp }));
  } catch {
    /* cache is optional */
  }
  return result;
}
