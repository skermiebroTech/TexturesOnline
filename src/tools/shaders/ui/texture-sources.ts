// Where the live preview's block textures come from: the real game (default), the built-in art, a
// Texture Pack Maker project, or a pack imported just for the preview. Imported packs keep only the
// few textures the diorama shows, in the asset cache under a key saved on the shader project.
// None of this touches exports.

import type { AssetIndex, Edition, TexturePackProject } from '../../../core/types';
import { cacheGet, cacheSet } from '../../../core/storage';
import { DEFAULT_JAVA_VERSION } from '../../../editions/index';
import { formatBytes } from '../../../ui/format';
import { createOverlayAssets, textureRootOf, type OverlayAssets } from '../../../shared/overlay-assets';
import { previewTextureIds } from '../../../shared/preview/preview-textures';
import type { ShaderTargetInfo } from '../targets';
import type { ImportedPreviewPack, PreviewTexturesPref } from './project';

/** Larger files are refused before reading (the whole archive has to be unpacked in memory). */
export const MAX_PACK_FILE_BYTES = 300 * 1024 * 1024;
/** Upper bound for the textures kept for the preview (only reachable with huge resolutions). */
export const MAX_STORED_BYTES = 32 * 1024 * 1024;
export const PACK_ACCEPT = '.zip,.mcpack,.mcaddon';

const STORE_FORMAT = 1;

/** Game version whose vanilla textures the preview uses: Iris 26.3, vanilla shaders their version, Bedrock the latest. */
export function previewVersionFor(target: Pick<ShaderTargetInfo, 'id' | 'edition'>, projectVersion: string): string {
  if (target.edition === 'bedrock') return 'latest';
  if (target.id === 'java-vanilla' && projectVersion) return projectVersion;
  return DEFAULT_JAVA_VERSION;
}

export function editionLabel(e: Edition): string {
  return e === 'java' ? 'Java' : 'Bedrock';
}

/** "Minecraft 26.3" / "Minecraft Bedrock" */
export function vanillaLabel(edition: Edition, version: string): string {
  return edition === 'java' ? `Minecraft ${version}` : 'Minecraft Bedrock';
}

/** Short label for the stage button. */
export function sourceLabel(pref: PreviewTexturesPref, edition: Edition, version: string): string {
  switch (pref.kind) {
    case 'simple':
      return 'Simple';
    case 'project':
      return `My pack: ${pref.name || 'Texture pack'}`;
    case 'imported':
      return `Imported: ${pref.imported?.name || pref.name || 'Texture pack'}`;
    default:
      return vanillaLabel(edition, version);
  }
}

// ---------------------------------------------------------------------------------------------
// Overlays

/** A Texture Pack Maker project (its edits and effects) over the vanilla textures. */
export function overlayFromProject(base: AssetIndex, p: TexturePackProject): OverlayAssets {
  const files = new Map<string, Blob>();
  for (const [path, blob] of Object.entries(p.extraFiles ?? {})) files.set(path, blob);
  for (const [path, blob] of Object.entries(p.overrides ?? {})) files.set(path, blob);
  return createOverlayAssets(base, { edition: p.edition, files, effects: p.effects ?? [] });
}

export interface StoredPreviewPack {
  format: number;
  name: string;
  edition: Edition;
  /** Game version the pack says it is for (Java; Bedrock 'latest') */
  version: string;
  resolution: number;
  /** Pack path -> bytes: the diorama's textures, their .mcmeta files and colour maps */
  files: Record<string, Uint8Array>;
  icon?: Uint8Array;
  /** Uses the texture names of Java 1.12 and older ('textures/blocks/') */
  legacyNames: boolean;
  savedAt: number;
}

export function overlayFromStored(base: AssetIndex, pack: StoredPreviewPack): OverlayAssets {
  return createOverlayAssets(base, { edition: pack.edition, files: pack.files });
}

export function isTexturePackProject(p: unknown): p is TexturePackProject {
  const r = p as Partial<TexturePackProject> | null;
  return !!r && r.kind === 'texturepack' && typeof r.id === 'string' && (r.edition === 'java' || r.edition === 'bedrock') && !!r.overrides && typeof r.overrides === 'object';
}

// ---------------------------------------------------------------------------------------------
// Importing a pack for the preview

let keepIds: Set<string> | null = null;

/** Whether a pack file is one the preview can show (a diorama texture, its .mcmeta, or a colour map). */
export function isPreviewPackPath(path: string, edition: Edition): boolean {
  const root = textureRootOf(edition);
  if (!path.startsWith(root)) return false;
  const m = /^(.+)\.(png|tga)(\.mcmeta)?$/i.exec(path.slice(root.length));
  if (!m) return false;
  keepIds ??= new Set(previewTextureIds());
  return keepIds.has(m[1]);
}

function tooBigMessage(size: number): string {
  return `This pack is ${formatBytes(size)}, which is too big to preview here (the limit is ${formatBytes(MAX_PACK_FILE_BYTES)}). Try a lower-resolution version of it.`;
}

/**
 * Opens a .zip / .mcpack / .mcaddon and keeps the textures the preview can show. Throws friendly
 * errors (not a pack, too big, nothing the preview uses).
 */
export async function readPreviewPack(file: File): Promise<StoredPreviewPack> {
  if (file.size > MAX_PACK_FILE_BYTES) throw new Error(tooBigMessage(file.size));
  const { importPack } = await import('../../textures/import');
  const { project } = await importPack(file);
  const files: Record<string, Uint8Array> = {};
  let total = 0;
  const all: [string, Blob][] = [...Object.entries(project.extraFiles ?? {}), ...Object.entries(project.overrides ?? {})];
  for (const [path, blob] of all) {
    if (!isPreviewPackPath(path, project.edition)) continue;
    total += blob.size;
    if (total > MAX_STORED_BYTES) {
      throw new Error(`The textures in this pack are too large to preview (over ${formatBytes(MAX_STORED_BYTES)} just for the blocks shown). Try a lower-resolution version of it.`);
    }
    files[path] = new Uint8Array(await blob.arrayBuffer());
  }
  const images = Object.keys(files).filter((p) => !p.endsWith('.mcmeta'));
  if (!images.length) {
    throw new Error(
      `“${project.name}” doesn't change any of the blocks in the preview (grass, dirt, stone, sand, water, trees, flowers and torches), so the preview would look the same.`,
    );
  }
  return {
    format: STORE_FORMAT,
    name: project.name,
    edition: project.edition,
    version: project.version,
    resolution: project.resolution,
    files,
    ...(project.icon ? { icon: new Uint8Array(await project.icon.arrayBuffer()) } : {}),
    legacyNames: project.edition === 'java' && images.some((p) => p.startsWith('assets/minecraft/textures/blocks/')),
    savedAt: Date.now(),
  };
}

export function storedSize(pack: StoredPreviewPack): number {
  let n = pack.icon?.byteLength ?? 0;
  for (const b of Object.values(pack.files)) n += b.byteLength;
  return n;
}

export async function saveStoredPack(key: string, pack: StoredPreviewPack): Promise<ImportedPreviewPack> {
  await cacheSet(key, pack);
  return { key, name: pack.name, edition: pack.edition, size: storedSize(pack), at: pack.savedAt };
}

function isStoredPack(v: unknown): v is StoredPreviewPack {
  const r = v as StoredPreviewPack | null;
  return !!r && r.format === STORE_FORMAT && typeof r.name === 'string' && (r.edition === 'java' || r.edition === 'bedrock') && !!r.files && typeof r.files === 'object';
}

/** The stored pack, or null when it is gone (cache cleared, another browser). */
export async function loadStoredPack(key: string): Promise<StoredPreviewPack | null> {
  const v = await cacheGet<unknown>(key);
  return isStoredPack(v) ? v : null;
}
