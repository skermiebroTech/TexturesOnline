// Pack Doctor: a checking session. Checks the dropped pack, applies fixes (one, or every safe one
// in a few rounds, checking again in between because one fix can reveal the next problem), keeps
// the before and after, and writes the fixed pack. The page (view.ts) loads this module when a pack
// is dropped.

import { writeZip } from '../../core/zip';
import type { Edition } from '../../core/types';
import { archiveFromFiles } from './archive';
import { countBySeverity, diagnose, type DiagnoseInput, type Diagnosis } from './checks';
import { applyPlan, mergeChanges, rebuildChanges, touchedBy, type Files } from './fixes';
import type { Change, Issue, PackArchive, Severity } from './types';

export type CheckContext = Omit<DiagnoseInput, 'archive'>;

export interface Session {
  archive: PackArchive;
  ctx: CheckContext;
  /** The pack as it was dropped */
  before: Diagnosis;
  /** The pack now (the same as `before` until something is fixed) */
  now: Diagnosis;
  /** The fixed pack's files, once something was fixed */
  files: Files | null;
  changes: Change[];
  /** Number of fixes applied */
  applied: number;
}

export function extensionFor(edition: Edition | null): '.zip' | '.mcpack' {
  return edition === 'bedrock' ? '.mcpack' : '.zip';
}

/** File name of the fixed pack. */
export function outName(s: Session): string {
  return `${s.before.baseName}${extensionFor(s.before.edition)}`;
}

export async function startSession(archive: PackArchive, ctx: CheckContext): Promise<Session> {
  const before = await diagnose({ ...ctx, archive });
  return { archive, ctx, before, now: before, files: null, changes: [], applied: 0 };
}

async function recheck(s: Session, files: Files): Promise<Diagnosis> {
  const clean = archiveFromFiles(files, outName(s));
  // Only the dropped pack itself: other packs of an add-on stay out of the fixed one.
  return diagnose({ ...s.ctx, archive: clean });
}

/** The fixed files so far, or the pack's own files to start fixing from. */
function working(s: Session): { files: Files; changes: Change[] } {
  if (s.files) return { files: new Map(s.files), changes: mergeChanges([], s.changes) };
  return { files: new Map(s.before.files), changes: rebuildChanges(s.before.issues) };
}

/** Applies one problem's fix (also an unsafe one: the visitor asked for it). */
export async function fixOne(s: Session, issue: Issue): Promise<Session> {
  if (!issue.fix) return s;
  const { files, changes } = working(s);
  mergeChanges(changes, await applyPlan(files, issue.fix.plan, issue.code));
  const now = await recheck(s, files);
  return { ...s, now, files, changes, applied: s.applied + 1 };
}

/** Applies every safe fix, checking again between rounds, until none is left (at most 5 rounds). */
export async function fixAll(s: Session, onRound?: (round: number) => void): Promise<Session> {
  const { files, changes } = working(s);
  let now = s.files ? s.now : s.before;
  let applied = s.applied;
  let started = !!s.files;
  for (let round = 1; round <= 5; round++) {
    const safe = now.issues.filter((i) => i.fix?.safe);
    if (!safe.length) break;
    onRound?.(round);
    const touched = new Set<string>();
    let any = false;
    for (const issue of safe) {
      const paths = touchedBy(issue.fix!.plan);
      if (paths.some((p) => touched.has(p))) continue;
      paths.forEach((p) => touched.add(p));
      mergeChanges(changes, await applyPlan(files, issue.fix!.plan, issue.code));
      applied++;
      any = true;
    }
    started = true;
    now = await recheck(s, files);
    if (!any) break;
  }
  if (!started) return s;
  return { ...s, now, files, changes, applied };
}

/** The fixed pack as a zip (.zip for Java, .mcpack for Bedrock). */
export async function buildFixed(s: Session): Promise<{ blob: Blob; name: string; count: number }> {
  const files = s.files ?? s.before.files;
  const map: Record<string, Uint8Array> = {};
  for (const [p, b] of files) map[p] = b;
  const blob = await writeZip(map, { mimeType: s.before.edition === 'bedrock' ? 'application/octet-stream' : 'application/zip' });
  return { blob, name: outName(s), count: files.size };
}

export function summary(d: Diagnosis): Record<Severity, number> {
  return countBySeverity(d.issues);
}

export { looksGood } from './checks';
