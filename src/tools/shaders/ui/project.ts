// Shader project records (stored in IndexedDB) and per-browser view preferences.

import type { Edition, OptionValues, ShaderProject, ShaderTarget } from '../../../core/types';
import { cacheDeleteMany, cacheKeys } from '../../../core/storage';
import { uuidv4 } from '../../../core/uuid';

export type PreviewTexturesKind = 'vanilla' | 'simple' | 'project' | 'imported';

/** A texture pack imported for the preview only (its files live in the asset cache under `key`). */
export interface ImportedPreviewPack {
  key: string;
  name: string;
  edition: Edition;
  /** Bytes kept for the preview */
  size: number;
  at: number;
}

/**
 * Textures the live preview uses (never part of the export). Missing = 'vanilla', the real game
 * textures of the project's version.
 */
export interface PreviewTexturesPref {
  kind: PreviewTexturesKind;
  /** kind 'project': a Texture Pack Maker project */
  projectId?: string;
  /** Display name of the project / imported pack when it was picked */
  name?: string;
  /** The last imported pack, kept while another source is picked so it can be chosen again */
  imported?: ImportedPreviewPack;
}

/** Extra fields the Shader Maker keeps on its projects (IndexedDB stores them as-is). */
export interface ShaderProjectData extends ShaderProject {
  /** Bedrock manifest version, bumped on each export so re-imports replace the installed copy */
  packVersion?: [number, number, number];
  /** Small preview image for the recent projects grid */
  thumb?: Blob;
  exportCount?: number;
  lastExportAt?: number;
  previewTextures?: PreviewTexturesPref;
}

const KINDS: readonly PreviewTexturesKind[] = ['vanilla', 'simple', 'project', 'imported'];

/** A valid preference from whatever was stored (unknown shapes fall back to the game's textures). */
export function normalizePreviewTextures(x: unknown): PreviewTexturesPref {
  const r = (x && typeof x === 'object' ? x : {}) as Partial<PreviewTexturesPref>;
  const str = (v: unknown, max = 120) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
  const imp = r.imported && typeof r.imported === 'object' ? r.imported : undefined;
  const imported: ImportedPreviewPack | undefined =
    imp && str(imp.key, 200)
      ? {
          key: str(imp.key, 200)!,
          name: str(imp.name) ?? 'Imported pack',
          edition: imp.edition === 'bedrock' ? 'bedrock' : 'java',
          size: typeof imp.size === 'number' && imp.size >= 0 ? imp.size : 0,
          at: typeof imp.at === 'number' ? imp.at : 0,
        }
      : undefined;
  let kind: PreviewTexturesKind = KINDS.includes(r.kind as PreviewTexturesKind) ? (r.kind as PreviewTexturesKind) : 'vanilla';
  const projectId = str(r.projectId, 80);
  if (kind === 'project' && !projectId) kind = 'vanilla';
  if (kind === 'imported' && !imported) kind = 'vanilla';
  const out: PreviewTexturesPref = { kind };
  if (kind === 'project') out.projectId = projectId;
  const name = kind === 'imported' ? imported!.name : kind === 'project' ? str(r.name) : undefined;
  if (name) out.name = name;
  if (imported) out.imported = imported;
  return out;
}

export const SHADER_TARGETS: readonly ShaderTarget[] = ['iris', 'java-vanilla', 'bedrock-vibrant'];

export function isShaderTarget(x: unknown): x is ShaderTarget {
  return typeof x === 'string' && (SHADER_TARGETS as readonly string[]).includes(x);
}

export function isShaderProject(p: unknown): p is ShaderProjectData {
  if (!p || typeof p !== 'object') return false;
  const r = p as Partial<ShaderProjectData>;
  return r.kind === 'shader' && typeof r.id === 'string' && isShaderTarget(r.target);
}

export function newShaderProject(opts: {
  target: ShaderTarget;
  version: string;
  name: string;
  description: string;
  settings: OptionValues;
  preset?: string;
}): ShaderProjectData {
  const now = Date.now();
  const p: ShaderProjectData = {
    id: uuidv4(),
    kind: 'shader',
    name: cleanName(opts.name) || 'My shaders',
    createdAt: now,
    updatedAt: now,
    target: opts.target,
    version: opts.version,
    description: opts.description.trim(),
    settings: { ...opts.settings },
    ...(opts.preset ? { preset: opts.preset } : {}),
  };
  if (opts.target === 'bedrock-vibrant') p.bedrockUuids = { header: uuidv4(), module: uuidv4() };
  return p;
}

/** A copy with a fresh id (and fresh Bedrock uuids so both packs can be installed side by side). */
export function duplicateShaderProject(p: ShaderProjectData): ShaderProjectData {
  const now = Date.now();
  const copy: ShaderProjectData = { ...p, id: uuidv4(), name: `${p.name} (copy)`.slice(0, 80), createdAt: now, updatedAt: now, settings: { ...p.settings } };
  delete copy.packVersion;
  delete copy.exportCount;
  delete copy.lastExportAt;
  if (p.target === 'bedrock-vibrant') copy.bedrockUuids = { header: uuidv4(), module: uuidv4() };
  return copy;
}

export function cleanName(s: string): string {
  return s.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/** Asset-cache keys of packs imported for the preview (texture-sources.ts). */
const PREVIEW_PACK_PREFIX = 'shader-preview-pack:v1:';

/** Cache key for a new import: '<prefix><time base36>-<uuid>' (the time lets cleanup skip fresh ones). */
export function newPackKey(now = Date.now()): string {
  return `${PREVIEW_PACK_PREFIX}${now.toString(36)}-${uuidv4()}`;
}

function packKeyTime(key: string): number {
  const t = parseInt(key.slice(PREVIEW_PACK_PREFIX.length).split('-')[0] ?? '', 36);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Removes packs imported for the preview that no shader project refers to any more (deleted
 * projects, replaced or removed imports). Copies of a project share its pack, so only unreferenced
 * keys go, and imports younger than an hour are kept (another tab may not have saved yet).
 */
export async function cleanupPreviewPacks(projects: readonly ShaderProjectData[], now = Date.now()): Promise<number> {
  const used = new Set(projects.map((p) => p.previewTextures?.imported?.key).filter((k): k is string => !!k));
  const stale = (await cacheKeys(PREVIEW_PACK_PREFIX)).filter((k) => !used.has(k) && now - packKeyTime(k) > 60 * 60 * 1000);
  if (stale.length) await cacheDeleteMany(stale);
  return stale.length;
}

// ---------------------------------------------------------------------------------------------
// Preferences (per browser, never required for correctness)

export interface ShaderPrefs {
  autoRotate: boolean;
  animateDay: boolean;
  showHelp: boolean;
  timeOfDay: number;
  /** Collapsed option groups, per target */
  collapsed: Record<string, string[]>;
}

const PREFS_KEY = 'to-shaders-prefs';
const DEFAULT_PREFS: ShaderPrefs = {
  autoRotate: true,
  animateDay: false,
  showHelp: true,
  timeOfDay: 4800,
  collapsed: {},
};

export function loadPrefs(): ShaderPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return structuredClone(DEFAULT_PREFS);
    const { realTextures: _old, ...p } = JSON.parse(raw) as Partial<ShaderPrefs> & { realTextures?: unknown };
    return {
      ...structuredClone(DEFAULT_PREFS),
      ...p,
      collapsed: { ...(p.collapsed ?? {}) },
      timeOfDay: typeof p.timeOfDay === 'number' && Number.isFinite(p.timeOfDay) ? ((p.timeOfDay % 24000) + 24000) % 24000 : DEFAULT_PREFS.timeOfDay,
    };
  } catch {
    return structuredClone(DEFAULT_PREFS);
  }
}

export function savePrefs(p: ShaderPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* private mode or storage full: preferences are optional */
  }
}
