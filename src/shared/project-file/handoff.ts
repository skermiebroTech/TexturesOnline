// The small part of project files every page may need straight away: their names, and how a file
// reaches the cape and font makers (each keeps one design in the browser, so the page that is open
// takes it, or picks it up when it opens). No imports: drop zones and start screens load this
// with the page; the reading and writing (format.ts, records.ts, ui.ts) load on first use.

import type { ItemType, ProjectItem } from './format';

/** File names project files and backups end with (.tpmproject / .tpmbackup) */
export const PROJECT_FILE_RE = /\.(tpmproject|tpmbackup)$/i;
/** For file inputs */
export const PROJECT_ACCEPT = '.tpmproject,.tpmbackup';

/** True for a file that is a project file or a backup. */
export function isProjectFileName(name: string): boolean {
  return PROJECT_FILE_RE.test(name);
}

/** Window event after projects were added from a file, so lists of projects can update. */
export const PROJECTS_CHANGED = 'tpm:projects-changed';

export function projectsChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PROJECTS_CHANGED));
}

/** Runs `fn` when projects were added from a file. Returns a remover. */
export function onProjectsChanged(fn: () => void): () => void {
  window.addEventListener(PROJECTS_CHANGED, fn);
  return () => window.removeEventListener(PROJECTS_CHANGED, fn);
}

const BACKUP_KEY = 'to-backup-at';

/** When this browser last made a backup (ms), or 0. */
export function lastBackupAt(): number {
  try {
    return Number(localStorage.getItem(BACKUP_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Window event after a backup was downloaded. */
export const BACKED_UP = 'tpm:backed-up';

export function markBackedUp(at = Date.now()): void {
  try {
    localStorage.setItem(BACKUP_KEY, String(at));
  } catch {
    /* private mode */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(BACKED_UP));
}

type Opener = (item: ProjectItem) => void | Promise<void>;
const openers = new Map<ItemType, Opener>();
let pending: ProjectItem | null = null;

/** The cape or font maker, while it is open, takes files for it. Returns a remover. */
export function registerOpener(type: ItemType, fn: Opener): () => void {
  openers.set(type, fn);
  return () => {
    if (openers.get(type) === fn) openers.delete(type);
  };
}

export function openerFor(type: ItemType): Opener | undefined {
  return openers.get(type);
}

/** Keeps a design for its page, which is being opened. */
export function setPending(item: ProjectItem): void {
  pending = item;
}

/** The design waiting for this page, once. */
export function takePending(type: ItemType): ProjectItem | null {
  if (pending?.type !== type) return null;
  const p = pending;
  pending = null;
  return p;
}
