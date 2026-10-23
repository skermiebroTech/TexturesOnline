// The paint layers of the texture open in the pixel editor. The editor paints the active layer
// (one animation frame of it) and shows it with the layers above and below through a compositor;
// changes to the layers are undo steps in the pixel editor's history, so Ctrl+Z takes back strokes
// and layer changes in the order they were made, each on its own layer. Selecting another layer
// is a passive step: undoing a stroke goes back to the layer it was painted on. No DOM.

import type { PixelCompositor, PixelStep } from '../../../shared/pixel-canvas';
import { cropImageData } from '../../../core/pixels';
import { compositeArea, imageBytes, isPlain, type Area, type LayerSource, type LayerStack, type PaintLayer } from './stack';

/** What the session needs of the pixel editor (a PixelCanvas; a stand-in in the unit tests). */
export interface LayerCanvas {
  /** Ends a stroke or move in progress (its pixels reach the session through takeCanvas()) */
  commitSelection(): void;
  /** The pixels the editor holds */
  getImage(): ImageData;
  pushStep(step: PixelStep): void;
  swapImage(img: ImageData): void;
  setCompositor(fn: PixelCompositor | null): void;
  recompose(): void;
  setLocked(v: boolean): void;
}

/** 'pixels': the active layer was painted (in the current area); 'layers': anything else changed. */
export type LayerChange = 'pixels' | 'layers';
/** `fresh`: a new change (not an undo or redo, not a live preview) */
export type LayerListener = (kind: LayerChange, fresh: boolean) => void;

export class LayerSession {
  private canvas: LayerCanvas | null = null;
  private readonly listeners = new Set<LayerListener>();
  /** Layer images painted since takePainted() */
  private painted = new Set<ImageData>();

  constructor(
    public stack: LayerStack,
    /** The area of the layer images the editor shows (an animation frame, else everything) */
    private area: () => Area,
  ) {}

  get active(): PaintLayer {
    return this.stack.layers[this.stack.active];
  }

  get plain(): boolean {
    return isPlain(this.stack);
  }

  /** The active layer's pixels in the editor's area (what the editor edits). */
  canvasImage(): ImageData {
    const a = this.area();
    const img = this.active.image;
    return a.x === 0 && a.y === 0 && a.w === img.width && a.h === img.height ? img : cropImageData(img, a.x, a.y, a.w, a.h);
  }

  /** Connects the editor (null: disconnects it). The editor must show canvasImage() already. */
  attach(canvas: LayerCanvas | null): void {
    if (this.canvas && this.canvas !== canvas) {
      this.canvas.setCompositor(null);
      this.canvas.setLocked(false);
    }
    this.canvas = canvas;
    this.syncCanvas();
  }

  on(fn: LayerListener): () => void {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  private emit(kind: LayerChange, fresh = false): void {
    for (const fn of [...this.listeners]) fn(kind, fresh);
  }

  /** Pixels the editor committed (a stroke, an undo...): into the active layer. */
  takeCanvas(img: ImageData): void {
    if (this.writeArea(this.active.image, img)) this.emit('pixels');
  }

  /** Layer images painted since the last call (their stored PNGs are out of date). */
  takePainted(): ImageData[] {
    const out = [...this.painted];
    this.painted.clear();
    return out;
  }

  private writeArea(dst: ImageData, img: ImageData): boolean {
    const a = this.area();
    if (img.width !== a.w || img.height !== a.h) return false;
    for (let y = 0; y < a.h; y++) {
      const s = y * a.w * 4;
      dst.data.set(img.data.subarray(s, s + a.w * 4), ((a.y + y) * dst.width + a.x) * 4);
    }
    this.painted.add(dst);
    return true;
  }

  /**
   * Changes the layers as one undo step (`next` from the functions of stack.ts). With `live`, the
   * change shows without a step (e.g. while an opacity slider is dragged); a later call without it
   * records the step from `from`.
   */
  apply(next: LayerStack, opts: { live?: boolean; from?: LayerStack } = {}): void {
    if (next === this.stack) return;
    this.canvas?.commitSelection();
    const prev = opts.from ?? this.stack;
    if (!opts.live && this.canvas && prev !== next) {
      const before = new Set(prev.layers.map((l) => l.image));
      const after = new Set(next.layers.map((l) => l.image));
      // memory only one side of the step keeps
      const bytes = imageBytes(prev.layers.filter((l) => !after.has(l.image))) + imageBytes(next.layers.filter((l) => !before.has(l.image)));
      this.canvas.pushStep({ undo: () => this.set(prev), redo: () => this.set(next), bytes });
    }
    this.set(next, !opts.live);
  }

  /** Makes layer i the one painted (a passive undo step). */
  select(i: number): void {
    if (i === this.stack.active || i < 0 || i >= this.stack.layers.length) return;
    this.canvas?.commitSelection();
    const prev = this.stack;
    const next: LayerStack = { layers: prev.layers, active: i };
    this.canvas?.pushStep({ undo: () => this.set(prev), redo: () => this.set(next), passive: true });
    this.set(next);
  }

  /** Puts a stack in place without an undo step (undo / redo, a new animation's frames). */
  set(next: LayerStack, fresh = false): void {
    const prevImage = this.active?.image;
    this.stack = next;
    if (this.canvas && this.active.image !== prevImage) {
      // what the editor holds belongs to the layer it was editing (e.g. a stroke just redone)
      this.writeArea(prevImage, this.canvas.getImage());
      this.canvas.swapImage(this.canvasImage());
    }
    this.syncCanvas();
    this.emit('layers', fresh);
  }

  private syncCanvas(): void {
    const c = this.canvas;
    if (!c) return;
    c.setCompositor(this.plain ? null : this.compose);
    c.setLocked(this.active.locked || this.active.hidden);
    c.recompose();
  }

  /** The editor's view of all layers: the active one from the editor's own (live) pixels. */
  private readonly compose: PixelCompositor = (img, rect, out) => {
    compositeArea(out, rect, this.sources(img, rect));
  };

  private sources(live: ImageData | null, rect: Area): LayerSource[] {
    const a = this.area();
    const out: LayerSource[] = [];
    this.stack.layers.forEach((l, i) => {
      if (l.hidden || l.opacity <= 0) return;
      if (i === this.stack.active && live) out.push({ data: live.data, width: live.width, x: rect.x, y: rect.y, opacity: l.opacity, blend: l.blend });
      else out.push({ data: l.image.data, width: l.image.width, x: a.x + rect.x, y: a.y + rect.y, opacity: l.opacity, blend: l.blend });
    });
    return out;
  }

  /**
   * The editor's area of `full` (the flattened texture) recomputed; `live`: the active layer's
   * pixels there as the editor shows them (a stroke not committed yet).
   */
  flattenInto(full: ImageData, live: ImageData | null = null): void {
    const a = this.area();
    compositeArea(full, a, this.sources(live, { x: 0, y: 0, w: a.w, h: a.h }));
  }
}
