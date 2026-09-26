// Undo/redo over whole settings snapshots. Pure (no DOM), so it can be tested in Node.

import type { OptionValues } from '../../../core/types';

export interface HistoryEntry {
  values: OptionValues;
  /** What the step did, e.g. "Contrast" or "Preset: Cinematic" */
  label: string;
}

export class SettingsHistory {
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  private lastKey: string | null = null;
  private lastTime = 0;

  constructor(
    private readonly limit = 200,
    /** Changes to the same option closer together than this become one step (slider drags) */
    private readonly mergeMs = 900,
  ) {}

  /**
   * Call with the settings as they were *before* a change. Repeated changes of the same key
   * within `mergeMs` extend the previous step instead of adding a new one.
   */
  record(before: OptionValues, key: string | null, label: string, now = Date.now()): void {
    if (key !== null && key === this.lastKey && now - this.lastTime < this.mergeMs && this.past.length) {
      this.lastTime = now;
      this.future = [];
      return;
    }
    this.past.push({ values: { ...before }, label });
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
    this.lastKey = key;
    this.lastTime = now;
  }

  /** Ends slider merging, so the next change becomes its own step. */
  seal(): void {
    this.lastKey = null;
  }

  undo(current: OptionValues): HistoryEntry | null {
    const e = this.past.pop();
    if (!e) return null;
    this.future.push({ values: { ...current }, label: e.label });
    this.lastKey = null;
    return e;
  }

  redo(current: OptionValues): HistoryEntry | null {
    const e = this.future.pop();
    if (!e) return null;
    this.past.push({ values: { ...current }, label: e.label });
    this.lastKey = null;
    return e;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  peekUndoLabel(): string | null {
    return this.past.at(-1)?.label ?? null;
  }

  peekRedoLabel(): string | null {
    return this.future.at(-1)?.label ?? null;
  }

  clear(): void {
    this.past = [];
    this.future = [];
    this.lastKey = null;
  }
}
