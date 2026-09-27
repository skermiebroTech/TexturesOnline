// The small file every Shader Maker export carries so the pack can be opened again as a normal,
// fully editable project. Iris / OptiFine: shaders/texturepackmaker.json (loaders only read program
// sources, .properties and lang/ files, so a .json file there is ignored). Vanilla resource packs
// and Bedrock packs: texturepackmaker.json at the pack root (the games ignore unknown root files).
// Pure: safe to import from the generators, workers and Node.

import type { OptionValue, OptionValues, ShaderTarget } from '../../../core/types';

export const METADATA_FILE = 'texturepackmaker.json';
export const IRIS_METADATA_PATH = `shaders/${METADATA_FILE}`;
export const METADATA_APP = 'TexturePackMaker';
export const METADATA_FORMAT = 1;

export interface PackMetadata {
  app: typeof METADATA_APP;
  format: typeof METADATA_FORMAT;
  target: ShaderTarget;
  /** Game version the project was made for (absent when the generator was not told) */
  version?: string;
  settings: OptionValues;
  preset?: string;
}

const TARGETS: readonly ShaderTarget[] = ['iris', 'java-vanilla', 'bedrock-vibrant'];

/** Where the metadata file sits inside a pack of this target. */
export function metadataPath(target: ShaderTarget): string {
  return target === 'iris' ? IRIS_METADATA_PATH : METADATA_FILE;
}

function isValue(v: unknown): v is OptionValue {
  return typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || typeof v === 'string';
}

/** Short, printable, ASCII-only text (ids and version strings). */
function cleanId(s: unknown, max = 64): string | undefined {
  if (typeof s !== 'string') return undefined;
  const t = s.replace(/[^\x20-\x7e]/g, '').trim().slice(0, max);
  return t || undefined;
}

/**
 * The metadata file text. Deterministic (no timestamps) and ASCII-only: every non-ASCII character
 * is written as a \u escape, so the file is valid in any encoding a loader might assume.
 */
export function packMetadataJson(m: { target: ShaderTarget; version?: string; settings: OptionValues; preset?: string }): string {
  const settings: OptionValues = {};
  for (const [k, v] of Object.entries(m.settings ?? {})) if (isValue(v)) settings[k] = v;
  const doc: Record<string, unknown> = { app: METADATA_APP, format: METADATA_FORMAT, target: m.target };
  const version = cleanId(m.version);
  if (version) doc.version = version;
  const preset = cleanId(m.preset);
  if (preset) doc.preset = preset;
  doc.settings = settings;
  const text = JSON.stringify(doc, null, 2).replace(/[^\x00-\x7e]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  return `${text}\n`;
}

/** Reads a metadata file; null when it is missing, damaged or from another app or format. */
export function parsePackMetadata(content: string | Uint8Array | undefined | null): PackMetadata | null {
  if (content == null) return null;
  let text: string;
  try {
    text = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content);
  } catch {
    return null;
  }
  if (text.length > 512 * 1024) return null;
  let doc: unknown;
  try {
    doc = JSON.parse(text.replace(/^\u{FEFF}/u, ''));
  } catch {
    return null;
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
  const d = doc as Record<string, unknown>;
  if (d.app !== METADATA_APP || d.format !== METADATA_FORMAT) return null;
  if (typeof d.target !== 'string' || !(TARGETS as readonly string[]).includes(d.target)) return null;
  if (!d.settings || typeof d.settings !== 'object' || Array.isArray(d.settings)) return null;
  const settings: OptionValues = {};
  for (const [k, v] of Object.entries(d.settings as Record<string, unknown>)) {
    if (/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(k) && isValue(v)) settings[k] = typeof v === 'string' ? v.slice(0, 256) : v;
  }
  const out: PackMetadata = { app: METADATA_APP, format: METADATA_FORMAT, target: d.target as ShaderTarget, settings };
  const version = cleanId(d.version);
  if (version) out.version = version;
  const preset = cleanId(d.preset);
  if (preset) out.preset = preset;
  return out;
}
