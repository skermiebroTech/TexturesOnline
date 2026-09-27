// Imported packs are saved as shader projects (so they show up with the other projects) with a few
// extra fields; their files live in IndexedDB under keys tied to the project id:
//   <fileKey>:files  original pack files (bytes, never modified)
//   <fileKey>:edits  text edits from the Files tab (path -> text)

import { cacheDelete, cacheGet, cacheKeys, cacheSet, getProject, listProjects } from '../../../core/storage';
import type { OptionValues, ShaderTarget } from '../../../core/types';
import { uuidv4 } from '../../../core/uuid';
import type { PackKind } from '../import/detect';
import type { ShaderProjectData } from '../ui/project';

export const FILE_KEY_PREFIX = 'packedit:v1:';

export interface ImportedPackProject extends ShaderProjectData {
  source: 'imported';
  packFormat: PackKind;
  /** Prefix of the IndexedDB keys that hold this pack's files */
  fileKey: string;
  /** File the pack came from, e.g. 'BSL_v10.1.8.zip' (the settings .txt is named after it) */
  sourceName: string;
  fileCount: number;
  byteSize: number;
  /** Paths of files changed in the Files tab (for the recent-projects card) */
  editedFiles?: number;
}

export interface StoredFiles {
  files: Record<string, Uint8Array>;
  savedAt: number;
}

export interface StoredEdits {
  edits: Record<string, string>;
  savedAt: number;
}

export function targetForKind(kind: PackKind): ShaderTarget {
  return kind === 'iris' ? 'iris' : kind === 'java-vanilla' ? 'java-vanilla' : 'bedrock-vibrant';
}

/** Short name of an imported pack's kind for cards and lists. */
export function importedKindLabel(p: ImportedPackProject): string {
  return p.packFormat === 'iris' ? 'Iris / OptiFine' : p.packFormat === 'java-vanilla' ? 'Java pack' : 'Bedrock pack';
}

export function isImportedPack(p: unknown): p is ImportedPackProject {
  if (!p || typeof p !== 'object') return false;
  const r = p as Partial<ImportedPackProject>;
  return (
    r.kind === 'shader' &&
    r.source === 'imported' &&
    typeof r.id === 'string' &&
    typeof r.fileKey === 'string' &&
    (r.packFormat === 'iris' || r.packFormat === 'java-vanilla' || r.packFormat === 'bedrock')
  );
}

export function newImportedProject(opts: {
  kind: PackKind;
  name: string;
  description?: string;
  sourceName: string;
  fileCount: number;
  byteSize: number;
  settings?: OptionValues;
  version: string;
}): ImportedPackProject {
  const id = uuidv4();
  const now = Date.now();
  return {
    id,
    kind: 'shader',
    name: opts.name.replace(/[\x00-\x1f\x7f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Shader pack',
    createdAt: now,
    updatedAt: now,
    target: targetForKind(opts.kind),
    version: opts.version,
    description: (opts.description ?? '').slice(0, 400),
    settings: { ...(opts.settings ?? {}) },
    source: 'imported',
    packFormat: opts.kind,
    fileKey: `${FILE_KEY_PREFIX}${id}`,
    sourceName: opts.sourceName,
    fileCount: opts.fileCount,
    byteSize: opts.byteSize,
  };
}

const filesKey = (p: { fileKey: string }) => `${p.fileKey}:files`;
const editsKey = (p: { fileKey: string }) => `${p.fileKey}:edits`;

export async function saveImportedFiles(p: ImportedPackProject, files: Record<string, Uint8Array>): Promise<void> {
  await cacheSet(filesKey(p), { files, savedAt: Date.now() } satisfies StoredFiles);
}

export async function loadImportedFiles(p: ImportedPackProject): Promise<Record<string, Uint8Array> | null> {
  const v = await cacheGet<StoredFiles>(filesKey(p));
  if (!v || typeof v !== 'object' || !v.files || typeof v.files !== 'object') return null;
  return v.files;
}

export async function saveEdits(p: ImportedPackProject, edits: Record<string, string>): Promise<void> {
  if (!Object.keys(edits).length) {
    await cacheDelete(editsKey(p));
    return;
  }
  await cacheSet(editsKey(p), { edits, savedAt: Date.now() } satisfies StoredEdits);
}

export async function loadEdits(p: ImportedPackProject): Promise<Record<string, string>> {
  const v = await cacheGet<StoredEdits>(editsKey(p));
  if (!v || typeof v !== 'object' || !v.edits || typeof v.edits !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, t] of Object.entries(v.edits)) if (typeof t === 'string') out[k] = t;
  return out;
}

export async function deleteImportedFiles(p: { fileKey: string }): Promise<void> {
  await Promise.all([cacheDelete(filesKey(p)), cacheDelete(editsKey(p))]);
}

/** A copy of an imported project with its own copy of the files. */
export async function duplicateImported(p: ImportedPackProject): Promise<ImportedPackProject> {
  const files = await loadImportedFiles(p);
  const edits = await loadEdits(p);
  const id = uuidv4();
  const now = Date.now();
  const copy: ImportedPackProject = {
    ...p,
    id,
    name: `${p.name} (copy)`.slice(0, 80),
    createdAt: now,
    updatedAt: now,
    settings: { ...p.settings },
    fileKey: `${FILE_KEY_PREFIX}${id}`,
  };
  delete copy.packVersion;
  delete copy.exportCount;
  delete copy.lastExportAt;
  if (files) await saveImportedFiles(copy, files);
  if (Object.keys(edits).length) await saveEdits(copy, edits);
  return copy;
}

let sweepTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Removes stored files whose project no longer exists (deleted here or on the home page). Waits a
 * little first so an "Undo" of the delete, or an import still being saved, keeps its files.
 */
export function sweepOrphanedPackFiles(delayMs = 20000): void {
  if (sweepTimer) clearTimeout(sweepTimer);
  sweepTimer = setTimeout(() => {
    sweepTimer = null;
    void (async () => {
      try {
        const keys = await cacheKeys(FILE_KEY_PREFIX);
        if (!keys.length) return;
        const live = new Set((await listProjects('shader')).filter(isImportedPack).map((p) => p.fileKey));
        for (const k of keys) {
          const base = k.replace(/:(files|edits)$/, '');
          if (live.has(base)) continue;
          const id = base.slice(FILE_KEY_PREFIX.length);
          if (await getProject(id)) continue;
          await cacheDelete(k);
        }
      } catch {
        /* best effort */
      }
    })();
  }, delayMs);
}
