// Shader project records (stored in IndexedDB) and per-browser view preferences.

import type { OptionValues, ShaderProject, ShaderTarget } from '../../../core/types';
import { uuidv4 } from '../../../core/uuid';

/** Extra fields the Shader Maker keeps on its projects (IndexedDB stores them as-is). */
export interface ShaderProjectData extends ShaderProject {
  /** Bedrock manifest version, bumped on each export so re-imports replace the installed copy */
  packVersion?: [number, number, number];
  /** Small preview image for the recent projects grid */
  thumb?: Blob;
  exportCount?: number;
  lastExportAt?: number;
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

// ---------------------------------------------------------------------------------------------
// Preferences (per browser, never required for correctness)

export interface ShaderPrefs {
  autoRotate: boolean;
  animateDay: boolean;
  /** Use the real game textures in the preview (per edition). undefined = on when already downloaded */
  realTextures: { java?: boolean; bedrock?: boolean };
  showHelp: boolean;
  timeOfDay: number;
  /** Collapsed option groups, per target */
  collapsed: Record<string, string[]>;
}

const PREFS_KEY = 'to-shaders-prefs';
const DEFAULT_PREFS: ShaderPrefs = {
  autoRotate: true,
  animateDay: false,
  realTextures: {},
  showHelp: true,
  timeOfDay: 4800,
  collapsed: {},
};

export function loadPrefs(): ShaderPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return structuredClone(DEFAULT_PREFS);
    const p = JSON.parse(raw) as Partial<ShaderPrefs>;
    return {
      ...structuredClone(DEFAULT_PREFS),
      ...p,
      realTextures: { ...(p.realTextures ?? {}) },
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
