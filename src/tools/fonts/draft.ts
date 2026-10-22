// The font maker's current font, kept in this browser between visits (the drawn glyphs, their size
// and the space width; an embedded TrueType file is not kept). Backups read and write it as it is
// stored (src/shared/project-file/records.ts).

import { fromDraft, toDraft, type FontDoc, type FontDraft } from './font';

const DRAFT_KEY = 'to-font-maker-draft';

export function readDraft(): FontDoc | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? fromDraft(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeDraft(doc: FontDoc): void {
  writeDraftJson(toDraft(doc));
}

/** The stored draft as it is, or null when there is none (or it can't be read). */
export function readDraftJson(): FontDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    const d = raw ? (JSON.parse(raw) as FontDraft) : null;
    return d && fromDraft(d) ? d : null;
  } catch {
    return null;
  }
}

/** Returns false when the browser would not store it (private mode, storage full). */
export function writeDraftJson(d: FontDraft): boolean {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}
