// Finds the packs inside an archive the user opened: Iris / OptiFine shader packs (a shaders/
// folder at the root or one folder down), Java resource packs (pack.mcmeta) and Bedrock packs
// (manifest.json), also when several packs or zipped packs sit inside one zip. Nothing from the
// archive is ever executed; files are only read as bytes. Pure: no DOM.

import { isZip, readZip } from '../../../core/zip';
import { decodeText } from './text';
import { IRIS_METADATA_PATH, METADATA_FILE, parsePackMetadata, type PackMetadata } from './metadata';
import { parseProperties } from '../packedit/properties';
import { readBedrockManifest } from '../packedit/json-tools';

export type PackKind = 'iris' | 'java-vanilla' | 'bedrock';

export interface PackCandidate {
  /** Unique within one archive */
  id: string;
  kind: PackKind;
  /** Display name */
  name: string;
  /** Name of the pack file as the game sees it (e.g. 'BSL_v10.1.8.zip'), for the settings .txt */
  fileName: string;
  /** Where it was found, e.g. 'BSL/' or 'packs.zip › Complementary.zip' ('' at the root) */
  location: string;
  /** Pack files, paths relative to the pack root */
  files: Record<string, Uint8Array>;
  byteSize: number;
  /** Present when the pack was made with Texture Pack Maker */
  metadata: PackMetadata | null;
  /** Java: the pack changes shaders (assets/<ns>/shaders or post_effect). Iris/Bedrock: always true */
  hasShaders: boolean;
  /** Short description of the kind, e.g. 'Behavior pack' */
  note?: string;
}

export class PackImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PackImportError';
  }
}

export { PACK_ACCEPT } from './accept';
const NESTED_ARCHIVE = /\.(zip|mcpack)$/i;
const IRIS_SOURCE = /\.(vsh|fsh|gsh|csh|glsl)$/i;
const MAX_NESTED = 24;
/** Zipped packs inside the archive stop being opened once this much has been unpacked. */
const NESTED_BUDGET = 1024 * 1024 * 1024;

export function baseName(fileName: string): string {
  const name = fileName.replace(/\\/g, '/').split('/').pop() ?? fileName;
  return (
    name
      .replace(/\.(zip|mcpack|mcaddon)$/i, '')
      .replace(/\s*\(\d{1,3}\)$/, '')
      .trim() || 'Shader pack'
  );
}

function under(files: Record<string, Uint8Array>, root: string): Record<string, Uint8Array> {
  if (!root) return files;
  const out: Record<string, Uint8Array> = {};
  for (const [p, b] of Object.entries(files)) if (p.startsWith(root)) out[p.slice(root.length)] = b;
  return out;
}

function sizeOf(files: Record<string, Uint8Array>): number {
  let n = 0;
  for (const b of Object.values(files)) n += b.length;
  return n;
}

function textOf(b: Uint8Array | undefined): string | undefined {
  return b ? decodeText(b).text : undefined;
}

/** Roots (''/'X/') that hold a pack of each kind in a flat file list. */
function findRoots(paths: string[]): { root: string; kind: PackKind }[] {
  const roots = new Map<string, PackKind>();
  const consider = (root: string, kind: PackKind) => {
    const prev = roots.get(root);
    // one root, one kind: Bedrock manifest > Java resource pack > Iris shaders folder
    const rank: Record<PackKind, number> = { bedrock: 3, 'java-vanilla': 2, iris: 1 };
    if (!prev || rank[kind] > rank[prev]) roots.set(root, kind);
  };
  for (const p of paths) {
    const segs = p.split('/');
    for (let depth = 0; depth <= 1 && depth < segs.length - 1; depth++) {
      const root = depth ? `${segs.slice(0, depth).join('/')}/` : '';
      const rest = segs.slice(depth);
      if (rest.length === 1) continue;
      if (rest[0] === 'shaders' && (IRIS_SOURCE.test(p) || rest[rest.length - 1] === 'shaders.properties')) consider(root, 'iris');
    }
    if (segs.length <= 2 && segs[segs.length - 1] === 'manifest.json') consider(segs.length === 2 ? `${segs[0]}/` : '', 'bedrock');
    if (segs.length <= 2 && segs[segs.length - 1] === 'pack.mcmeta') consider(segs.length === 2 ? `${segs[0]}/` : '', 'java-vanilla');
  }
  // a pack.mcmeta next to a shaders/ folder without assets/ is an Iris pack that ships an mcmeta
  for (const [root, kind] of roots) {
    if (kind !== 'java-vanilla') continue;
    const hasAssets = paths.some((p) => p.startsWith(`${root}assets/`));
    const hasShaders = paths.some((p) => p.startsWith(`${root}shaders/`) && IRIS_SOURCE.test(p));
    if (!hasAssets && hasShaders) roots.set(root, 'iris');
  }
  return [...roots.entries()].map(([root, kind]) => ({ root, kind })).sort((a, b) => a.root.localeCompare(b.root));
}

function describe(files: Record<string, Uint8Array>, kind: PackKind, fallbackName: string): { name: string; hasShaders: boolean; note?: string; metadata: PackMetadata | null } {
  if (kind === 'iris') {
    const metadata = parsePackMetadata(files[IRIS_METADATA_PATH]);
    return { name: fallbackName, hasShaders: true, metadata: metadata?.target === 'iris' ? metadata : null };
  }
  if (kind === 'java-vanilla') {
    const hasShaders = Object.keys(files).some((p) => /^assets\/[^/]+\/(shaders|post_effect)\//.test(p));
    const metadata = parsePackMetadata(files[METADATA_FILE]);
    return { name: fallbackName, hasShaders, metadata: metadata?.target === 'java-vanilla' ? metadata : null };
  }
  let lang: Map<string, string> | undefined;
  const langPath = Object.keys(files).find((p) => /^texts\/en_us\.lang$/i.test(p));
  if (langPath) lang = parseProperties(textOf(files[langPath]) ?? '');
  const info = readBedrockManifest(textOf(files['manifest.json']) ?? '', lang);
  const name = info?.name ? info.name.replace(/§./g, '').trim() : '';
  const type = info?.moduleType;
  const note =
    type === 'resources' ? 'Resource pack' : type === 'data' || type === 'script' ? 'Behavior pack' : type === 'skin_pack' ? 'Skin pack' : type ? `${type} pack` : undefined;
  const metadata = parsePackMetadata(files[METADATA_FILE]);
  return { name: name || fallbackName, hasShaders: true, note, metadata: metadata?.target === 'bedrock-vibrant' ? metadata : null };
}

async function candidatesIn(
  files: Record<string, Uint8Array>,
  fileName: string,
  location: string,
  nextId: () => string,
): Promise<PackCandidate[]> {
  const out: PackCandidate[] = [];
  for (const { root, kind } of findRoots(Object.keys(files))) {
    const packFiles = under(files, root);
    const folder = root.replace(/\/$/, '');
    const fallback = folder || baseName(fileName);
    const d = describe(packFiles, kind, fallback);
    out.push({
      id: nextId(),
      kind,
      name: d.name,
      fileName: root ? `${folder}.zip` : fileName.replace(/\\/g, '/').split('/').pop() || fileName,
      location: [location, folder].filter(Boolean).join(' › '),
      files: packFiles,
      byteSize: sizeOf(packFiles),
      metadata: d.metadata,
      hasShaders: d.hasShaders,
      note: d.note,
    });
  }
  return out;
}

/**
 * Finds every pack in an archive. Zipped packs inside the archive are opened one level deep.
 * Throws PackImportError with a friendly message when nothing usable is inside.
 */
export async function findPacks(data: Uint8Array, fileName: string, onStep?: (label: string) => void): Promise<PackCandidate[]> {
  if (!isZip(data)) {
    throw new PackImportError(`“${fileName}” isn't a .zip or .mcpack file. Shader packs are zip archives; pick the pack file itself, not a single file from it.`);
  }
  onStep?.('Unpacking');
  let files: Record<string, Uint8Array>;
  try {
    files = await readZip(data);
  } catch (err) {
    throw new PackImportError(err instanceof Error ? err.message : "The archive couldn't be read.");
  }
  let n = 0;
  const nextId = () => `c${++n}`;
  const found = await candidatesIn(files, fileName, '', nextId);
  // zips inside a pack belong to that pack; only loose ones next to (or instead of) packs are opened
  const claimed = found.map((c) => c.location);
  const rootClaimed = claimed.includes('');

  // zipped packs inside the zip (a download that bundles several packs)
  const nested = Object.keys(files)
    .filter((p) => !rootClaimed && NESTED_ARCHIVE.test(p) && !claimed.some((root) => p.startsWith(`${root}/`)))
    .slice(0, MAX_NESTED);
  let unpacked = Object.values(files).reduce((n, b) => n + b.length, 0);
  for (const p of nested) {
    const bytes = files[p];
    if (!isZip(bytes) || unpacked > NESTED_BUDGET) continue;
    onStep?.(`Opening ${p.split('/').pop()}`);
    let inner: Record<string, Uint8Array>;
    try {
      inner = await readZip(bytes);
    } catch {
      continue;
    }
    unpacked += Object.values(inner).reduce((n, b) => n + b.length, 0);
    const innerName = p.split('/').pop() ?? p;
    found.push(...(await candidatesIn(inner, innerName, p.replace(/\//g, ' › '), nextId)));
  }

  if (!found.length) {
    const names = Object.keys(files);
    if (!names.length) throw new PackImportError(`“${fileName}” is empty.`);
    if (names.some((p) => /(^|\/)level\.dat$/.test(p))) throw new PackImportError(`“${fileName}” is a world, not a pack. Open a shader pack, resource pack or .mcpack instead.`);
    if (names.some((p) => /\.class$/.test(p)) || names.some((p) => /(^|\/)fabric\.mod\.json$|(^|\/)META-INF\/mods\.toml$/.test(p))) {
      throw new PackImportError(`“${fileName}” looks like a mod or a game file, not a pack. Shader packs have a “shaders” folder inside.`);
    }
    throw new PackImportError(
      `No pack was found in “${fileName}”. A shader pack has a “shaders” folder (Iris / OptiFine), a resource pack has a pack.mcmeta file, and a Bedrock pack has a manifest.json.`,
    );
  }
  return found;
}
