// Paint layers of a texture: blend modes, compositing, and the changes made to a stack of layers
// (add, duplicate, delete, move, merge down, flatten). Each layer holds the whole texture, every
// animation frame included, so layers span all frames. The game only ever sees the layers
// flattened (the texture in the pack). No DOM.
//
// Images are shared between copies of a stack (undo steps keep the stacks they lead back to): only
// painting changes a layer's image in place, every other change here makes a new image.

import type { TextureLayerBlend } from '../../../core/types';
import { cloneImageData, createImageData } from '../../../core/pixels';

export type LayerBlend = TextureLayerBlend;
export const LAYER_BLENDS: readonly LayerBlend[] = ['normal', 'multiply', 'screen', 'lighten', 'overlay'];

export interface PaintLayer {
  /** Stable id (copies of the stack, undo steps and the stored record keep it) */
  id: string;
  name: string;
  /** Straight RGBA, the size of the texture (every animation frame) */
  image: ImageData;
  hidden: boolean;
  /** Can't be painted (moved, renamed and merged it can) */
  locked: boolean;
  /** 0..1 */
  opacity: number;
  blend: LayerBlend;
}

export interface LayerStack {
  /** Bottom to top */
  layers: PaintLayer[];
  /** Index of the layer being painted */
  active: number;
}

export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One layer's pixels for compositeArea(): `x`, `y` is where the area starts in this image. */
export interface LayerSource {
  data: Uint8ClampedArray;
  width: number;
  x: number;
  y: number;
  opacity: number;
  blend: LayerBlend;
}

let idCounter = 0;
export function layerId(): string {
  return `${Date.now().toString(36)}${(++idCounter).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** A new layer (transparent unless `image` is given; the image is used as it is). */
export function makeLayer(name: string, image: ImageData, props: Partial<Omit<PaintLayer, 'id' | 'name' | 'image'>> = {}): PaintLayer {
  return { id: layerId(), name, image, hidden: false, locked: false, opacity: 1, blend: 'normal', ...props };
}

/** A texture as one layer: how every texture starts. */
export function singleLayer(image: ImageData, name: string): LayerStack {
  return { layers: [makeLayer(name, image)], active: 0 };
}

/** One visible layer painted normally at full strength: the stack is just its image (nothing to store). */
export function isPlain(s: LayerStack): boolean {
  if (s.layers.length !== 1) return false;
  const l = s.layers[0];
  return !l.hidden && !l.locked && l.opacity >= 1 && l.blend === 'normal';
}

/** A copy of the stack's structure (layers and their settings); images are shared. */
export function copyStack(s: LayerStack): LayerStack {
  return { layers: s.layers.map((l) => ({ ...l })), active: s.active };
}

// ---------------------------------------------------------------------------------------------
// Blending (straight alpha in and out; the W3C compositing formulas canvas 2D uses too)

function blendChannel(mode: LayerBlend, b: number, s: number): number {
  switch (mode) {
    case 'multiply':
      return b * s;
    case 'screen':
      return b + s - b * s;
    case 'lighten':
      return b > s ? b : s;
    case 'overlay':
      return b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s);
    default:
      return s;
  }
}

/**
 * Blends pixel `si` of `src` over pixel `oi` of `out` (in place). `opacity` scales the source's
 * alpha. The result is rounded to bytes, so compositing step by step gives the same bytes as
 * compositing all at once.
 */
export function blendPixel(out: Uint8ClampedArray, oi: number, src: Uint8ClampedArray, si: number, opacity: number, mode: LayerBlend): void {
  const as = (src[si + 3] / 255) * opacity;
  if (as <= 0) return;
  const ab = out[oi + 3] / 255;
  if (mode === 'normal' && (ab === 0 || as >= 1)) {
    // (what the formula below gives, without the rounding of a division)
    out[oi] = src[si];
    out[oi + 1] = src[si + 1];
    out[oi + 2] = src[si + 2];
    out[oi + 3] = Math.round(as * 255);
    return;
  }
  const ao = as + ab * (1 - as);
  for (let c = 0; c < 3; c++) {
    const cs = src[si + c] / 255;
    const cb = out[oi + c] / 255;
    // the source colour after blending with what is under it (where there is something under it)
    const mixed = mode === 'normal' ? cs : (1 - ab) * cs + ab * blendChannel(mode, cb, cs);
    out[oi + c] = Math.round(((as * mixed + ab * (1 - as) * cb) / ao) * 255);
  }
  out[oi + 3] = Math.round(ao * 255);
}

/**
 * Composites layers (bottom to top) into an area of `out`, starting from transparent pixels. Area
 * coordinates are `out`'s; each source reads its own image from its `x`, `y`.
 */
export function compositeArea(out: { data: Uint8ClampedArray; width: number }, area: Area, sources: readonly LayerSource[]): void {
  const od = out.data;
  const ow = out.width;
  for (let y = 0; y < area.h; y++) {
    const row = ((area.y + y) * ow + area.x) * 4;
    od.fill(0, row, row + area.w * 4);
  }
  for (const s of sources) {
    if (s.opacity <= 0) continue;
    const sd = s.data;
    for (let y = 0; y < area.h; y++) {
      let oi = ((area.y + y) * ow + area.x) * 4;
      let si = ((s.y + y) * s.width + s.x) * 4;
      for (let x = 0; x < area.w; x++, oi += 4, si += 4) blendPixel(od, oi, sd, si, s.opacity, s.blend);
    }
  }
}

/** The visible layers as compositeArea() sources reading the same area of their images. */
export function sourcesOf(layers: readonly PaintLayer[], at: { x: number; y: number } = { x: 0, y: 0 }): LayerSource[] {
  return layers.filter((l) => !l.hidden && l.opacity > 0).map((l) => ({ data: l.image.data, width: l.image.width, x: at.x, y: at.y, opacity: l.opacity, blend: l.blend }));
}

/** The layers flattened into one image (what the game gets). Hidden layers are left out. */
export function flatten(s: LayerStack): ImageData {
  const { width, height } = s.layers[0].image;
  if (isPlain(s)) return cloneImageData(s.layers[0].image);
  const out = createImageData(width, height);
  compositeArea(out, { x: 0, y: 0, w: width, h: height }, sourcesOf(s.layers));
  return out;
}

/** Recomputes one area of a flattened image (e.g. the animation frame being painted). */
export function flattenArea(s: LayerStack, out: ImageData, area: Area): void {
  compositeArea(out, area, sourcesOf(s.layers, area));
}

// ---------------------------------------------------------------------------------------------
// Changes (each returns a new stack; the one given is left as it was)

const clampIndex = (s: LayerStack, i: number) => Math.max(0, Math.min(s.layers.length - 1, i));

/** `layer` put in at index `at` (0 = bottom) and made the active one unless `keepActive`. */
export function addLayer(s: LayerStack, layer: PaintLayer, at: number, keepActive = false): LayerStack {
  const layers = s.layers.map((l) => ({ ...l }));
  const i = Math.max(0, Math.min(layers.length, at));
  layers.splice(i, 0, layer);
  return { layers, active: keepActive ? (s.active >= i ? s.active + 1 : s.active) : i };
}

/** A copy of layer i (pixels and settings, unlocked) above it, made active. */
export function duplicateLayer(s: LayerStack, i: number, name: string): LayerStack {
  const src = s.layers[i];
  return addLayer(s, { ...src, id: layerId(), name, image: cloneImageData(src.image), locked: false }, i + 1);
}

/** Layer i deleted (never the last one); the layer under it (else above) becomes active. */
export function removeLayer(s: LayerStack, i: number): LayerStack {
  if (s.layers.length < 2) return s;
  const layers = s.layers.map((l) => ({ ...l }));
  layers.splice(i, 1);
  let active = s.active;
  if (active > i || (active === i && active > 0)) active--;
  return { layers, active: Math.max(0, Math.min(layers.length - 1, active)) };
}

/** Layer `from` moved to index `to`; the active layer stays the same layer. */
export function moveLayer(s: LayerStack, from: number, to: number): LayerStack {
  to = clampIndex(s, to);
  if (from === to || from < 0 || from >= s.layers.length) return s;
  const layers = s.layers.map((l) => ({ ...l }));
  const activeId = layers[s.active].id;
  const [l] = layers.splice(from, 1);
  layers.splice(to, 0, l);
  return { layers, active: layers.findIndex((x) => x.id === activeId) };
}

/** Settings of layer i changed (name, hidden, locked, opacity, blend). */
export function updateLayer(s: LayerStack, i: number, patch: Partial<Pick<PaintLayer, 'name' | 'hidden' | 'locked' | 'opacity' | 'blend'>>): LayerStack {
  const layers = s.layers.map((l, k) => (k === i ? { ...l, ...patch } : { ...l }));
  if (patch.opacity !== undefined) layers[i].opacity = Math.max(0, Math.min(1, patch.opacity));
  return { layers, active: s.active };
}

/** The stack with layer i active. */
export function selectLayer(s: LayerStack, i: number): LayerStack {
  return { layers: s.layers.map((l) => ({ ...l })), active: clampIndex(s, i) };
}

/** Layer i can be merged into the one under it (both shown). */
export function canMergeDown(s: LayerStack, i: number): boolean {
  return i > 0 && i < s.layers.length && !s.layers[i].hidden && !s.layers[i - 1].hidden;
}

/**
 * Layer i painted into the layer under it, with its own strength and blend mode. The merged layer
 * keeps the lower layer's name and settings (so it looks the same when that layer is a normal one
 * at full strength), and becomes active.
 */
export function mergeDown(s: LayerStack, i: number): LayerStack {
  if (!canMergeDown(s, i)) return s;
  const upper = s.layers[i];
  const lower = s.layers[i - 1];
  const image = cloneImageData(lower.image);
  const { width, height } = image;
  const area = { x: 0, y: 0, w: width, h: height };
  const od = image.data;
  const sd = upper.image.data;
  if (upper.opacity > 0) for (let p = 0; p < area.w * area.h * 4; p += 4) blendPixel(od, p, sd, p, upper.opacity, upper.blend);
  const layers = s.layers.map((l) => ({ ...l }));
  layers.splice(i - 1, 2, { ...lower, image });
  return { layers, active: i - 1 };
}

/** Every visible layer flattened into one normal layer (hidden layers are dropped). */
export function flattenStack(s: LayerStack, name: string): LayerStack {
  const image = flatten({ layers: s.layers, active: s.active });
  const keep = s.layers.find((l) => !l.hidden) ?? s.layers[0];
  return { layers: [{ ...keep, name: name || keep.name, image, hidden: false, locked: false, opacity: 1, blend: 'normal' }], active: 0 };
}

/** The first "<base> <n>" name the stack doesn't use yet (n from the layer count up). */
export function nextLayerName(s: LayerStack, base: (n: number) => string): string {
  const used = new Set(s.layers.map((l) => l.name));
  let n = s.layers.length + 1;
  while (used.has(base(n))) n++;
  return base(n);
}

/** Bytes of image data a set of layers holds (undo steps count it against the history budget). */
export function imageBytes(layers: readonly PaintLayer[]): number {
  return layers.reduce((n, l) => n + l.image.data.byteLength, 0);
}
