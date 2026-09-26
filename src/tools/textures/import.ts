import type { Edition, GameVersion, PackFormat, TexturePackProject } from '../../core/types';
import { isPng } from '../../core/image';
import { isZip, readZip } from '../../core/zip';
import { isUuid } from '../../core/uuid';
import { readPackMcmetaRange } from '../../editions/java/packmeta';
import { KNOWN_RELEASES, KNOWN_RELEASE_FORMATS, comparePackFormats, formatPackFormat } from '../../editions/java/packformats';
import { isPbrMap } from '../../editions/bedrock/catalog';
import { BEDROCK_LATEST_ID } from '../../editions/bedrock/versions';
import { DEFAULT_JAVA_VERSION, listVersions } from '../../editions/index';
import {
  BEDROCK_TEXTURE_ROOT,
  JAVA_TEXTURE_ROOT,
  extOf,
  imageDims,
  newBedrockUuids,
  newTextureProject,
  normalizeResolution,
  parseBedrockVersion,
  parseJsonLoose,
} from './project';

export interface ImportResult {
  project: TexturePackProject;
  /** Friendly notes about anything unusual in the pack */
  warnings: string[];
}

type Files = Record<string, Uint8Array>;

interface Candidate {
  edition: Edition;
  /** Folder of the pack inside `files` ('' or 'Folder/') */
  root: string;
  files: Files;
  depth: number;
  manifest?: Record<string, unknown>;
  /** Where it was found, for messages */
  source: string;
}

const MAX_FILE_SIZE = 1024 * 1024 * 1024;
const LIVE_VERSIONS_TIMEOUT = 6000;

/**
 * Opens an existing resource pack (.zip for Java, .mcpack/.mcaddon/.zip for Bedrock) as a new
 * texture project. Handles packs inside a single folder, add-ons with several packs, every Java
 * pack.mcmeta era and Bedrock manifest formats 1-3. Textures under the texture root become
 * editable overrides; everything else is kept as extra files and written back on export.
 */
export async function importPack(file: File): Promise<ImportResult> {
  const warnings: string[] = [];
  const fileName = file.name || 'pack.zip';
  if (/\.(png|jpe?g|gif|webp|tga|bmp)$/i.test(fileName)) {
    throw new Error('That is a single image. To use it, open a texture in the editor and upload it there. To open a whole pack, choose its .zip or .mcpack file.');
  }
  if (/\.jar$/i.test(fileName)) {
    throw new Error("That is a game or mod .jar file, not a resource pack. Choose a pack's .zip or .mcpack file instead.");
  }
  if (file.size > MAX_FILE_SIZE) throw new Error('This file is larger than 1 GB, which is too big to open in the browser.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!bytes.length) throw new Error('This file is empty.');
  if (!isZip(bytes)) throw new Error("This file isn't a .zip, .mcpack or .mcaddon archive, so it can't be opened as a pack.");

  const files = await readZip(bytes);
  if (!Object.keys(files).length) throw new Error('This archive is empty.');

  const found: Candidate[] = [];
  const otherTypes = new Set<string>();
  scan(files, fileName, 0, found, otherTypes);
  if (!found.length) {
    // An add-on (.mcaddon) or a zip that wraps .mcpack/.zip files.
    for (const [path, data] of Object.entries(files)) {
      if (!/\.(mcpack|zip)$/i.test(path) || path.split('/').length > 2 || !isZip(data)) continue;
      try {
        scan(await readZip(data), path.split('/').pop()!, 1, found, otherTypes);
      } catch {
        warnings.push(`"${path}" inside the archive couldn't be read and was skipped.`);
      }
    }
  }

  let cand = pickCandidate(found, fileName);
  if (!cand) cand = guessWithoutMetadata(files);
  if (!cand) {
    if (otherTypes.has('skin_pack')) throw new Error('This is a Bedrock skin pack. Open it in the Skins tool instead.');
    if (otherTypes.has('data') || otherTypes.has('script')) throw new Error('This is a behavior pack (it changes how the game plays, not how it looks), so it has no textures to edit.');
    if (otherTypes.has('world_template')) throw new Error("This is a world template, not a resource pack.");
    throw new Error("This archive doesn't contain a Minecraft resource pack (there is no pack.mcmeta or manifest.json).");
  }
  const sameEdition = found.filter((c) => c.edition === cand!.edition && c !== cand);
  if (sameEdition.length) {
    warnings.push(`This file contains ${sameEdition.length + 1} resource packs. Opened the one in "${cand.root || cand.source}"; open the others separately.`);
  }

  const rel: Files = {};
  let outside = 0;
  for (const [path, data] of Object.entries(cand.files)) {
    if (path.startsWith(cand.root)) rel[path.slice(cand.root.length)] = data;
    else outside++;
  }
  if (outside && !sameEdition.length && cand.root) {
    warnings.push(`${count(outside, 'file')} outside the pack's "${cand.root.replace(/\/$/, '')}" folder ${outside === 1 ? 'was' : 'were'} left out.`);
  }

  const baseName = nameFromFile(fileName);
  const project = cand.edition === 'java' ? await importJava(rel, baseName, warnings) : importBedrock(rel, cand.manifest, baseName, warnings);
  if (!Object.keys(project.overrides).length) {
    warnings.push('This pack has no textures of its own yet. You can start editing any vanilla texture.');
  }
  return { project, warnings };
}

// ---------------------------------------------------------------------------------------------
// Detection

function scan(files: Files, source: string, depthOffset: number, out: Candidate[], otherTypes: Set<string>): void {
  for (const path of Object.keys(files)) {
    const slash = path.lastIndexOf('/');
    const base = path.slice(slash + 1);
    const root = path.slice(0, slash + 1);
    const depth = (root ? root.split('/').length - 1 : 0) + depthOffset;
    if (base === 'pack.mcmeta') {
      out.push({ edition: 'java', root, files, depth, source });
    } else if (base === 'manifest.json') {
      const manifest = parseJsonLoose(decodeText(files[path])) as Record<string, unknown> | null;
      const types = moduleTypes(manifest);
      if (types.includes('resources') || types.includes('resource')) out.push({ edition: 'bedrock', root, files, depth, manifest: manifest!, source });
      else types.forEach((t) => otherTypes.add(t));
    }
  }
}

function moduleTypes(manifest: Record<string, unknown> | null): string[] {
  const modules = manifest?.modules;
  if (!Array.isArray(modules)) return [];
  return modules.map((m) => (m && typeof m === 'object' ? String((m as { type?: unknown }).type ?? '') : '')).filter(Boolean);
}

function pickCandidate(found: Candidate[], fileName: string): Candidate | null {
  if (!found.length) return null;
  const preferBedrock = /\.(mcpack|mcaddon|mcworld)$/i.test(fileName);
  return [...found].sort((a, b) => a.depth - b.depth || (a.edition === b.edition ? 0 : (a.edition === 'bedrock') === preferBedrock ? -1 : 1) || a.root.localeCompare(b.root))[0];
}

/** Packs without pack.mcmeta / manifest.json: recognise them by their texture folders. */
function guessWithoutMetadata(files: Files): Candidate | null {
  const paths = Object.keys(files);
  const java = paths.find((p) => /(^|\/)assets\/minecraft\/textures\/.+\.png$/.test(p));
  if (java) {
    const root = java.slice(0, java.indexOf('assets/minecraft/textures/'));
    return { edition: 'java', root, files, depth: 0, source: 'textures' };
  }
  const bedrock = paths.find((p) => /(^|\/)textures\/(blocks|items|entity|ui)\/.+\.(png|tga)$/.test(p));
  if (bedrock) {
    const m = /(^|\/)textures\/(blocks|items|entity|ui)\//.exec(bedrock)!;
    return { edition: 'bedrock', root: bedrock.slice(0, m.index + m[1].length), files, depth: 0, source: 'textures' };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Java

async function importJava(rel: Files, baseName: string, warnings: string[]): Promise<TexturePackProject> {
  let description: string | null = null;
  let range: { min: PackFormat; max: PackFormat } | null = null;
  const mcmeta = rel['pack.mcmeta'];
  if (!mcmeta) {
    warnings.push('The pack has no pack.mcmeta file. A correct one will be created when you export.');
  } else {
    const json = parseJsonLoose(decodeText(mcmeta)) as { pack?: { description?: unknown } } | null;
    if (!json || typeof json !== 'object') {
      warnings.push("The pack's pack.mcmeta file is damaged. A correct one will be created when you export.");
    } else {
      const d = flattenText(json.pack?.description);
      description = d.text;
      if (d.formatted) warnings.push('The pack description used colours or formatting codes; it was converted to plain text.');
      range = readPackMcmetaRange(JSON.stringify(json));
    }
  }
  const { version, compat } = await guessJavaVersion(range, warnings);

  const overrides: Record<string, Blob> = {};
  const extraFiles: Record<string, Blob> = {};
  let icon: Blob | undefined;
  let modTextures = 0;
  let badImages = 0;
  let optifine = false;
  let overlays = false;
  for (const [path, data] of Object.entries(rel)) {
    if (path === 'pack.png') {
      if (isPng(data)) icon = toBlob(data, 'image/png');
      else warnings.push("The pack icon (pack.png) isn't a valid PNG, so a new icon will be generated.");
      continue;
    }
    if (path.startsWith(JAVA_TEXTURE_ROOT) && path.endsWith('.png')) {
      if (isPng(data)) {
        overrides[path] = toBlob(data, 'image/png');
        continue;
      }
      badImages++;
    }
    if (/^assets\/(?!minecraft\/)[^/]+\/textures\/.+\.png$/.test(path)) modTextures++;
    if (/^assets\/minecraft\/(optifine|mcpatcher)\//.test(path)) optifine = true;
    if (/^[^/]+\/assets\//.test(path)) overlays = true;
    extraFiles[path] = toBlob(data, mimeFor(path));
  }
  if (badImages) warnings.push(`${count(badImages, 'texture')} ${badImages === 1 ? "isn't a real PNG image" : "aren't real PNG images"} and will be kept as-is but can't be edited.`);
  if (modTextures) warnings.push(`${count(modTextures, 'texture')} for mods (other namespaces) will be kept but can't be edited here.`);
  if (optifine) warnings.push('OptiFine features (connected textures, custom item textures, …) are kept but not shown in the preview.');
  if (overlays && rel['pack.mcmeta'] && /"overlays"/.test(decodeText(rel['pack.mcmeta']))) {
    warnings.push('Overlay folders (version-specific extras) are kept as they are; only the main textures are editable.');
  }

  const project = newTextureProject({ name: baseName, edition: 'java', version, resolution: guessResolution(overrides, 'java', rel) });
  // Keep the pack's own description as it is (even empty); only packs without one get the default.
  if (description !== null) project.description = description;
  project.overrides = overrides;
  project.extraFiles = extraFiles;
  if (icon) project.icon = icon;
  if (compat) project.compat = compat;
  return project;
}

/**
 * Newest release whose pack format the pack accepts. Uses the bundled release table and, only for
 * packs newer than it, the live version list.
 */
export async function guessJavaVersion(
  range: { min: PackFormat; max: PackFormat } | null,
  warnings: string[] = [],
): Promise<{ version: string; compat?: { minVersion: string; maxVersion: string } }> {
  if (!range) {
    warnings.push(`The pack doesn't say which Minecraft version it's for, so it was set to ${DEFAULT_JAVA_VERSION}. You can change this in the Pack settings.`);
    return { version: DEFAULT_JAVA_VERSION };
  }
  const fmtOf = (id: string) => KNOWN_RELEASE_FORMATS[id];
  const inRange = (f: PackFormat) => comparePackFormats(f, range.min) >= 0 && comparePackFormats(f, range.max) <= 0;
  const newestFirst = [...KNOWN_RELEASES].reverse();
  const newestKnown = fmtOf(KNOWN_RELEASES[KNOWN_RELEASES.length - 1]);
  let version = newestFirst.find((id) => inRange(fmtOf(id))) ?? null;
  let versionFormat = version ? fmtOf(version) : null;

  // Only a newer major format can belong to a release this build doesn't know yet.
  if (range.max.major > newestKnown.major) {
    const live = await liveJavaReleases();
    const hit = live.find((v) => v.packFormat && inRange(v.packFormat));
    if (hit?.packFormat && (!versionFormat || comparePackFormats(hit.packFormat, versionFormat) > 0)) {
      version = hit.id;
      versionFormat = hit.packFormat;
    }
  }
  const declared = describeRange(range);
  if (!version) {
    if (comparePackFormats(range.min, newestKnown) > 0) {
      warnings.push(`This pack is for a newer Minecraft version than this app knows (pack format ${declared}). It was set to ${DEFAULT_JAVA_VERSION}; check the version in the Pack settings.`);
      return { version: DEFAULT_JAVA_VERSION };
    }
    const below = newestFirst.find((id) => comparePackFormats(fmtOf(id), range.max) <= 0);
    version = below ?? KNOWN_RELEASES[0];
    warnings.push(`This pack was made for a development snapshot (pack format ${declared}). It was set to the closest release, Minecraft ${version}.`);
    return { version };
  }

  // Keep a declared multi-version range.
  if (range.min.major < range.max.major) {
    let min = range.min;
    if (range.max.major > 64 && min.major < 15) {
      min = { major: 15, minor: 0 };
      warnings.push('The pack claimed support for very old versions together with new ones, which new versions reject. Its range now starts at Minecraft 1.20.');
    }
    const minVersion = KNOWN_RELEASES.find((id) => comparePackFormats(fmtOf(id), min) >= 0 && comparePackFormats(fmtOf(id), versionFormat!) <= 0);
    if (minVersion && minVersion !== version && fmtOf(minVersion).major !== versionFormat!.major) {
      return { version, compat: { minVersion, maxVersion: version } };
    }
  }
  return { version };
}

function describeRange(r: { min: PackFormat; max: PackFormat }): string {
  const max = r.max.minor >= 0x7fffffff ? { major: r.max.major, minor: 0 } : r.max;
  const a = formatPackFormat(r.min);
  const b = formatPackFormat(max);
  return a === b ? a : `${a}–${b}`;
}

async function liveJavaReleases(): Promise<GameVersion[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const list = await Promise.race([
      listVersions('java'),
      new Promise<GameVersion[]>((resolve) => {
        timer = setTimeout(() => resolve([]), LIVE_VERSIONS_TIMEOUT);
      }),
    ]);
    return list.filter((v) => v.type === 'release' && v.packFormat);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------------------------
// Bedrock

const IMAGE_EXT = new Set(['png', 'tga']);

function importBedrock(rel: Files, manifestArg: Record<string, unknown> | undefined, baseName: string, warnings: string[]): TexturePackProject {
  const manifest = manifestArg ?? (rel['manifest.json'] ? (parseJsonLoose(decodeText(rel['manifest.json'])) as Record<string, unknown> | null) : null) ?? null;
  const header = (manifest?.header ?? {}) as Record<string, unknown>;
  const lang = readLang(rel['texts/en_US.lang']);
  const resolveText = (v: unknown): string => {
    const s = typeof v === 'string' ? v : '';
    const key = s.trim();
    if (key && /^[\w.-]+$/.test(key) && key.includes('.') && lang.has(key)) return lang.get(key)!;
    return flattenText(s).text;
  };
  const name = resolveText(header.name).trim() || baseName;
  const description = resolveText(header.description).trim();

  let uuids: { header: string; module: string } | undefined;
  const modules = Array.isArray(manifest?.modules) ? (manifest!.modules as Record<string, unknown>[]) : [];
  const resModule = modules.find((m) => m && (m.type === 'resources' || m.type === 'resource'));
  if (isUuid(header.uuid) && resModule && isUuid(resModule.uuid) && String(header.uuid).toLowerCase() !== String(resModule.uuid).toLowerCase()) {
    uuids = { header: String(header.uuid).toLowerCase(), module: String(resModule.uuid).toLowerCase() };
  } else if (manifest) {
    warnings.push("The pack's IDs in manifest.json are missing or invalid, so it got new ones. It will install as a separate pack.");
  } else {
    warnings.push('The pack has no manifest.json. A new one will be created when you export.');
  }
  const packVersion = parseBedrockVersion(header.version) ?? undefined;

  const capabilities = Array.isArray(manifest?.capabilities) ? (manifest!.capabilities as unknown[]).map(String) : [];
  if (capabilities.includes('pbr')) {
    warnings.push('This pack has Vibrant Visuals (PBR) data. It is kept, but exported packs switch Vibrant Visuals off so your texture edits show up.');
  }
  if (Array.isArray(manifest?.subpacks) && (manifest!.subpacks as unknown[]).length) {
    warnings.push('This pack has sub-packs (in-game options). Their folders are kept as they are; only the main textures are editable.');
  }

  const overrides: Record<string, Blob> = {};
  const extraFiles: Record<string, Blob> = {};
  let icon: Blob | undefined;
  let badImages = 0;
  const all = new Set(Object.keys(rel));
  const hasTextureSet = (stem: string) => all.has(`${stem}.texture_set.json`);
  for (const [path, data] of Object.entries(rel)) {
    if (path === 'pack_icon.png') {
      if (isPng(data)) icon = toBlob(data, 'image/png');
      else warnings.push("The pack icon (pack_icon.png) isn't a valid PNG, so a new icon will be generated.");
      continue;
    }
    const ext = extOf(path);
    if (path.startsWith(BEDROCK_TEXTURE_ROOT) && IMAGE_EXT.has(ext) && !isPbrMap(path.slice(0, -(ext.length + 1)), hasTextureSet)) {
      const ok = ext === 'png' ? isPng(data) : looksLikeTga(data);
      if (ok) {
        overrides[path] = toBlob(data, ext === 'png' ? 'image/png' : 'image/x-tga');
        continue;
      }
      badImages++;
    }
    extraFiles[path] = toBlob(data, mimeFor(path));
  }
  if (badImages) warnings.push(`${count(badImages, 'texture')} couldn't be recognised as images and will be kept as-is but can't be edited.`);

  const project = newTextureProject({ name, edition: 'bedrock', version: BEDROCK_LATEST_ID, resolution: guessResolution(overrides, 'bedrock', rel) });
  if (manifest) project.description = description;
  project.overrides = overrides;
  project.extraFiles = extraFiles;
  project.bedrockUuids = uuids ?? newBedrockUuids();
  if (packVersion) project.packVersion = packVersion;
  if (icon) project.icon = icon;
  return project;
}

function readLang(bytes: Uint8Array | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!bytes) return map;
  for (const line of decodeText(bytes).split(/\r?\n/)) {
    if (!line || line.startsWith('##')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    map.set(line.slice(0, eq).trim(), line.slice(eq + 1).replace(/\t+#.*$/, '').trim());
  }
  return map;
}

function looksLikeTga(b: Uint8Array): boolean {
  return b.length >= 18 && b[1] <= 1 && [1, 2, 3, 9, 10, 11].includes(b[2]) && (b[12] | (b[13] << 8)) > 0 && (b[14] | (b[15] << 8)) > 0;
}

// ---------------------------------------------------------------------------------------------
// Shared helpers

/** Most common block/item texture width, snapped to a supported resolution. */
function guessResolution(overrides: Record<string, Blob>, edition: Edition, rel: Files): number {
  const tile = edition === 'java' ? /^assets\/minecraft\/textures\/(block|blocks|item|items)\// : /^textures\/(blocks|items)\//;
  const counts = new Map<number, number>();
  for (const path of Object.keys(overrides)) {
    if (!tile.test(path)) continue;
    const dims = imageDims(rel[path], extOf(path));
    if (!dims || dims.w < 8) continue;
    counts.set(dims.w, (counts.get(dims.w) ?? 0) + 1);
  }
  let best = 16;
  let bestCount = 0;
  for (const [w, n] of counts) if (n > bestCount || (n === bestCount && w > best)) [best, bestCount] = [w, n];
  return normalizeResolution(Math.max(16, best));
}

/** Plain text from a Minecraft text component / Bedrock string; § formatting codes removed. */
function flattenText(v: unknown): { text: string; formatted: boolean } {
  let formatted = false;
  const walk = (x: unknown): string => {
    if (typeof x === 'string') {
      if (/§./.test(x)) formatted = true;
      return x.replace(/§./g, '');
    }
    if (typeof x === 'number' || typeof x === 'boolean') return String(x);
    if (Array.isArray(x)) return x.map(walk).join('');
    if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      if (['color', 'bold', 'italic', 'underlined', 'strikethrough', 'obfuscated', 'font'].some((k) => k in o)) formatted = true;
      const own = typeof o.text === 'string' ? walk(o.text) : typeof o.translate === 'string' ? (typeof o.fallback === 'string' ? walk(o.fallback) : o.translate) : '';
      return own + (Array.isArray(o.extra) ? o.extra.map(walk).join('') : '');
    }
    return '';
  };
  return { text: walk(v).replace(/\r\n?/g, '\n').trim(), formatted };
}

function nameFromFile(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const name = base
    .replace(/\.(zip|mcpack|mcaddon|mcworld)$/i, '')
    .replace(/\s*\(\d+\)$/, '')
    .replace(/§./g, '')
    .replace(/[_+]+/g, ' ')
    .replace(/^[!\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return name || 'Imported pack';
}

function mimeFor(path: string): string {
  switch (extOf(path)) {
    case 'png':
      return 'image/png';
    case 'tga':
      return 'image/x-tga';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'json':
    case 'mcmeta':
      return 'application/json';
    case 'ogg':
      return 'audio/ogg';
    case 'lang':
    case 'txt':
    case 'properties':
    case 'fsh':
    case 'vsh':
    case 'glsl':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}

function toBlob(data: Uint8Array, type: string): Blob {
  return new Blob([data as Uint8Array<ArrayBuffer>], { type });
}

const utf8 = new TextDecoder('utf-8');
function decodeText(bytes: Uint8Array): string {
  const t = utf8.decode(bytes);
  return t.charCodeAt(0) === 0xfeff ? t.slice(1) : t;
}

function count(n: number, word: string): string {
  return `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
}
