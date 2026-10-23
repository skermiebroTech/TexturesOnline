// The stamps saved from selections: this browser's list (localStorage) and the pack's own
// (project.stamps, so the pack's project file brings them along). Opening a pack adds its stamps to
// the browser's list; deleting a stamp takes it out of both.

import type { TextureStamp } from '../../../core/types';
import { Emitter } from '../../../core/events';
import type { TexStore } from '../ui/store';
import { STAMPS_KEPT, checkStampRecords, mergeStamps, stampImage, stampRecord } from './stamps';

const KEY = 'to-tex-stamps';

function readKept(): TextureStamp[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (checkStampRecords(JSON.parse(raw)) ?? []) : [];
  } catch {
    return [];
  }
}

function writeKept(list: readonly TextureStamp[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export class StampLibrary {
  readonly events = new Emitter<{ change: void }>();
  private list: TextureStamp[];

  constructor(private readonly store: TexStore) {
    const own = checkStampRecords(store.project.stamps) ?? [];
    const kept = readKept();
    this.list = mergeStamps(kept, own).slice(-STAMPS_KEPT);
    if (this.list.length !== kept.length) writeKept(this.list);
  }

  /** The stamps, oldest first */
  all(): readonly TextureStamp[] {
    return this.list;
  }

  get(id: string): TextureStamp | undefined {
    return this.list.find((s) => s.id === id);
  }

  image(id: string): ImageData | null {
    const r = this.get(id);
    return r ? stampImage(r) : null;
  }

  /** Saves a picture as a stamp (in this browser and in the pack). */
  add(img: ImageData, name: string): TextureStamp {
    const rec = stampRecord(img, name);
    this.put(rec, this.list.length);
    return rec;
  }

  /** Takes a stamp out of this browser and the pack; returns where it was (for Undo). */
  remove(id: string): { rec: TextureStamp; index: number; inPack: boolean } | null {
    const index = this.list.findIndex((s) => s.id === id);
    if (index < 0) return null;
    const rec = this.list[index];
    this.list = this.list.filter((s) => s.id !== id);
    writeKept(this.list);
    const p = this.store.project;
    const inPack = !!p.stamps?.some((s) => s.id === id);
    if (inPack) {
      p.stamps = p.stamps!.filter((s) => s.id !== id);
      if (!p.stamps.length) delete p.stamps;
      this.store.touch();
    }
    this.events.emit('change');
    return { rec, index, inPack };
  }

  /** Puts a removed stamp back where it was. */
  restore(r: { rec: TextureStamp; index: number; inPack: boolean }): void {
    this.put(r.rec, r.index, r.inPack);
  }

  private put(rec: TextureStamp, index: number, inPack = true): void {
    const list = this.list.filter((s) => s.id !== rec.id);
    list.splice(Math.min(index, list.length), 0, rec);
    this.list = list.slice(-STAMPS_KEPT);
    writeKept(this.list);
    if (inPack) {
      const p = this.store.project;
      p.stamps = [...(p.stamps ?? []).filter((s) => s.id !== rec.id), rec];
      this.store.touch();
    }
    this.events.emit('change');
  }
}
