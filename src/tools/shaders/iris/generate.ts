// Builds the Iris / OptiFine shader pack: every file under 'shaders/' plus README.txt at the
// zip root. Pure and synchronous; the result is a FileMap of strings.

import { zipSync, strToU8, type Zippable } from 'fflate';
import type { FileMap, OptionValues } from '../../../core/types';
import { sanitizeFilename } from '../../../core/download';
import { readSettings } from './options';
import { LIB_FILES } from './glsl-lib';
import { PROGRAM_FILES } from './glsl-programs';
import {
  buildBlockProperties, buildEntityProperties, buildItemProperties, buildLang, buildReadme, buildSettingsGlsl,
  buildShadersProperties, cleanMeta, type PackMeta,
} from './pack-files';

/** Folder that must sit at the root of the zip. */
export const SHADERS_DIR = 'shaders/';

/**
 * Generates the complete shader pack. `v` are the web UI option values (missing or invalid values
 * fall back to the defaults); they become the defaults of the in-game options.
 * Paths are relative to the zip root: 'README.txt' and 'shaders/...'.
 */
export function generateIrisPack(v: OptionValues, meta: { name: string; description: string }): FileMap {
  const settings = readSettings(v);
  const m: PackMeta = cleanMeta(meta);
  const files: Record<string, string> = {
    'README.txt': buildReadme(m),
    [`${SHADERS_DIR}shaders.properties`]: buildShadersProperties(m),
    [`${SHADERS_DIR}block.properties`]: buildBlockProperties(m),
    [`${SHADERS_DIR}item.properties`]: buildItemProperties(),
    [`${SHADERS_DIR}entity.properties`]: buildEntityProperties(),
    [`${SHADERS_DIR}lang/en_US.lang`]: buildLang(settings, m),
    [`${SHADERS_DIR}lib/settings.glsl`]: buildSettingsGlsl(settings, m),
  };
  for (const [path, src] of Object.entries(LIB_FILES)) files[SHADERS_DIR + path] = src;
  for (const [path, src] of Object.entries(PROGRAM_FILES)) files[SHADERS_DIR + path] = src;
  return files;
}

/** A file name for the pack zip, e.g. 'My Shaders.zip'. */
export function irisPackFileName(name: string): string {
  const base = sanitizeFilename(cleanMeta({ name, description: '' }).name, 'TexturesOnline Shaders').replace(/\.zip$/i, '');
  return `${base}.zip`;
}

/**
 * Zips a generated pack with explicit directory entries ('shaders/', 'shaders/lib/', ...), which
 * OptiFine uses to find the pack's base folder. Text is deflated, the result is a .zip file body.
 */
export function zipIrisPack(files: FileMap, opts: { mtime?: Date } = {}): Uint8Array {
  const root: Zippable = {};
  const mtime = opts.mtime ?? new Date();
  for (const [rawPath, value] of Object.entries(files)) {
    const path = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!path || path.endsWith('/') || path.split('/').some((seg) => seg === '..' || seg === '.')) continue;
    let bytes: Uint8Array;
    if (typeof value === 'string') bytes = strToU8(value);
    else if (value instanceof Uint8Array) bytes = value;
    else throw new Error(`zipIrisPack: ${path} is a Blob; pass strings or bytes`);
    const parts = path.split('/');
    let dir = root;
    for (const part of parts.slice(0, -1)) {
      const next = dir[part];
      if (next === undefined) dir[part] = {};
      else if (next instanceof Uint8Array || Array.isArray(next)) throw new Error(`zipIrisPack: ${part} is both a file and a folder`);
      dir = dir[part] as Zippable;
    }
    dir[parts[parts.length - 1]] = [bytes, { level: 6 }];
  }
  return zipSync(root, { mtime });
}
