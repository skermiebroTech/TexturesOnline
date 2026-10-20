// Skin UV layout: every body part × face × layer for the classic and slim 64x64 layouts and the
// legacy 64x32 layout, plus hit-testing, masks, true body mirroring, arm conversion and the part
// overlay drawn on top of the pixel editor. Pure apart from drawPartOverlay (takes a 2D context).
//
// HD skins (128x128, Bedrock) use the same layout scaled x2: every function that works in image
// pixels takes a `scale` (1 for 64x64, 2 for 128x128), or reads it from the image width.

import type { SkinModel } from '../../core/types';

export type SkinPart = 'head' | 'body' | 'rightArm' | 'leftArm' | 'rightLeg' | 'leftLeg';
export type SkinFace = 'top' | 'bottom' | 'right' | 'front' | 'left' | 'back';
export type SkinLayer = 'base' | 'outer';
/** 'legacy' is the old 64x32 layout (classic arms, no left limbs, only the hat as outer layer). */
export type SkinLayout = SkinModel | 'legacy';
/** Which layer(s) the user paints on. */
export type LayerSelection = 'base' | 'outer' | 'both';

export interface FaceRect {
  part: SkinPart;
  face: SkinFace;
  layer: SkinLayer;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Box {
  w: number;
  h: number;
  d: number;
}

export const SKIN_SIZE = 64;
/** Width and height of an HD skin (Bedrock only). */
export const HD_SKIN_SIZE = 128;

/** Image pixels per template texel: 1 for 64x64 (and 64x32) skins, 2 for HD 128x128 skins. */
export type SkinScale = 1 | 2;

/** The scale of a skin image from its width (128 wide = HD). */
export function scaleOf(width: number): SkinScale {
  return width === HD_SKIN_SIZE ? 2 : 1;
}

/** True for a 128x128 HD skin. */
export function isHdSkin(img: { width: number; height: number }): boolean {
  return img.width === HD_SKIN_SIZE && img.height === HD_SKIN_SIZE;
}

export const PARTS: readonly SkinPart[] = ['head', 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg'];
export const FACES: readonly SkinFace[] = ['top', 'bottom', 'right', 'front', 'left', 'back'];

export interface PartInfo {
  label: string;
  /** Name of the outer layer piece, as the game's skin customisation calls it */
  outerLabel: string;
  short: string;
  outerShort: string;
  /** Overlay / UI colour */
  color: string;
  /** The part on the other side of the body (itself for head and body) */
  mirror: SkinPart;
}

export const PART_INFO: Record<SkinPart, PartInfo> = {
  head: { label: 'Head', outerLabel: 'Hat', short: 'Head', outerShort: 'Hat', color: '#ffcf4a', mirror: 'head' },
  body: { label: 'Body', outerLabel: 'Jacket', short: 'Body', outerShort: 'Jacket', color: '#4fb3ff', mirror: 'body' },
  rightArm: { label: 'Right Arm', outerLabel: 'Right Sleeve', short: 'R arm', outerShort: 'R sleeve', color: '#5bd35b', mirror: 'leftArm' },
  leftArm: { label: 'Left Arm', outerLabel: 'Left Sleeve', short: 'L arm', outerShort: 'L sleeve', color: '#2ed8c3', mirror: 'rightArm' },
  rightLeg: { label: 'Right Leg', outerLabel: 'Right Pants', short: 'R leg', outerShort: 'R pants', color: '#b07cff', mirror: 'leftLeg' },
  leftLeg: { label: 'Left Leg', outerLabel: 'Left Pants', short: 'L leg', outerShort: 'L pants', color: '#ff7ab8', mirror: 'rightLeg' },
};

export const FACE_LABELS: Record<SkinFace, string> = {
  top: 'Top',
  bottom: 'Bottom',
  right: 'Right side',
  front: 'Front',
  left: 'Left side',
  back: 'Back',
};

export const LAYER_LABELS: Record<SkinLayer, string> = { base: 'Base layer', outer: 'Outer layer' };

/** Size of a part's box in image pixels (w = across, h = tall, d = deep). */
export function partBox(part: SkinPart, model: SkinLayout, scale: SkinScale = 1): Box {
  const k = scale;
  switch (part) {
    case 'head':
      return { w: 8 * k, h: 8 * k, d: 8 * k };
    case 'body':
      return { w: 8 * k, h: 12 * k, d: 4 * k };
    case 'rightArm':
    case 'leftArm':
      return { w: (model === 'slim' ? 3 : 4) * k, h: 12 * k, d: 4 * k };
    default:
      return { w: 4 * k, h: 12 * k, d: 4 * k };
  }
}

// UV origin (top-left of the unwrapped box) of every part and layer in the 64x64 layout.
const ORIGINS: Record<SkinPart, Record<SkinLayer, [number, number]>> = {
  head: { base: [0, 0], outer: [32, 0] },
  body: { base: [16, 16], outer: [16, 32] },
  rightArm: { base: [40, 16], outer: [40, 32] },
  leftArm: { base: [32, 48], outer: [48, 48] },
  rightLeg: { base: [0, 16], outer: [0, 32] },
  leftLeg: { base: [16, 48], outer: [0, 48] },
};

/** UV origin of a part's layer, or null when the layout doesn't have it (legacy left limbs/overlays). */
export function partOrigin(part: SkinPart, layer: SkinLayer, layout: SkinLayout, scale: SkinScale = 1): [number, number] | null {
  if (layout === 'legacy') {
    if (part === 'leftArm' || part === 'leftLeg') return null;
    if (layer === 'outer' && part !== 'head') return null;
  }
  const o = ORIGINS[part][layer];
  return [o[0] * scale, o[1] * scale];
}

/** Image width and height of a layout at a scale. */
function dims(layout: SkinLayout, scale: SkinScale): [number, number] {
  return [64 * scale, (layout === 'legacy' ? 32 : 64) * scale];
}

const cacheKey = (layout: SkinLayout, scale: SkinScale) => `${layout}@${scale}`;

/** The six faces of a box unwrapped at (u, v) — Minecraft's standard box UV layout. */
export function boxFaces(u: number, v: number, b: Box): Record<SkinFace, { x: number; y: number; w: number; h: number }> {
  const { w, h, d } = b;
  return {
    top: { x: u + d, y: v, w, h: d },
    bottom: { x: u + d + w, y: v, w, h: d },
    right: { x: u, y: v + d, w: d, h },
    front: { x: u + d, y: v + d, w, h },
    left: { x: u + d + w, y: v + d, w: d, h },
    back: { x: u + 2 * d + w, y: v + d, w, h },
  };
}

const rectCache = new Map<string, FaceRect[]>();

/** Every face rectangle of a layout, in image pixels at `scale`. */
export function faceRects(layout: SkinLayout, scale: SkinScale = 1): readonly FaceRect[] {
  const key = cacheKey(layout, scale);
  let list = rectCache.get(key);
  if (list) return list;
  list = [];
  for (const layer of ['base', 'outer'] as SkinLayer[]) {
    for (const part of PARTS) {
      const o = partOrigin(part, layer, layout, scale);
      if (!o) continue;
      const faces = boxFaces(o[0], o[1], partBox(part, layout, scale));
      for (const face of FACES) list.push({ part, face, layer, ...faces[face] });
    }
  }
  rectCache.set(key, list);
  return list;
}

export function partRects(part: SkinPart, layer: SkinLayer, layout: SkinLayout, scale: SkinScale = 1): FaceRect[] {
  return faceRects(layout, scale).filter((r) => r.part === part && r.layer === layer);
}

export function faceRect(part: SkinPart, face: SkinFace, layer: SkinLayer, layout: SkinLayout, scale: SkinScale = 1): FaceRect | null {
  return faceRects(layout, scale).find((r) => r.part === part && r.face === face && r.layer === layer) ?? null;
}

/** Bounding box of a part's unwrapped layer in UV space. */
export function partBounds(part: SkinPart, layer: SkinLayer, layout: SkinLayout, scale: SkinScale = 1): { x: number; y: number; w: number; h: number } | null {
  const o = partOrigin(part, layer, layout, scale);
  if (!o) return null;
  const b = partBox(part, layout, scale);
  return { x: o[0], y: o[1], w: 2 * (b.w + b.d), h: b.d + b.h };
}

const hitCache = new Map<string, Int16Array>();

function hitMap(layout: SkinLayout, scale: SkinScale): Int16Array {
  const key = cacheKey(layout, scale);
  let m = hitCache.get(key);
  if (m) return m;
  const [W, H] = dims(layout, scale);
  m = new Int16Array(W * H).fill(-1);
  faceRects(layout, scale).forEach((r, i) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) m![y * W + x] = i;
  });
  hitCache.set(key, m);
  return m;
}

/** The face under an image pixel, or null for unused template areas. */
export function partAt(x: number, y: number, model: SkinLayout, scale: SkinScale = 1): FaceRect | null {
  x = Math.floor(x);
  y = Math.floor(y);
  const [W, H] = dims(model, scale);
  if (x < 0 || y < 0 || x >= W || y >= H) return null;
  const i = hitMap(model, scale)[y * W + x];
  return i >= 0 ? faceRects(model, scale)[i] : null;
}

/** "Right Arm · Front · Outer layer" */
export function describeRect(r: FaceRect): string {
  return `${PART_INFO[r.part].label} · ${FACE_LABELS[r.face]} · ${LAYER_LABELS[r.layer]}`;
}

/**
 * Paint mask (1 = editable) covering the given parts (all parts when null/empty) on the given
 * layer(s). Unused template areas are always locked.
 */
export function maskForParts(parts: Iterable<SkinPart> | null, model: SkinLayout, layers: LayerSelection, scale: SkinScale = 1): Uint8Array {
  const [W, H] = dims(model, scale);
  const mask = new Uint8Array(W * H);
  const set = parts ? new Set(parts) : null;
  const all = !set || set.size === 0;
  for (const r of faceRects(model, scale)) {
    if (!all && !set!.has(r.part)) continue;
    if (layers !== 'both' && r.layer !== layers) continue;
    for (let y = r.y; y < r.y + r.h; y++) mask.fill(1, y * W + r.x, y * W + r.x + r.w);
  }
  return mask;
}

// ---- True body mirror ----
// Reflecting the body across its middle (x -> -x) swaps right and left limbs. On each face the
// texture column flips; the right and left side faces swap with each other. Rows never change.

const MIRROR_FACE: Record<SkinFace, SkinFace> = { top: 'top', bottom: 'bottom', front: 'front', back: 'back', right: 'left', left: 'right' };

const mirrorCache = new Map<string, Int32Array>();

function mirrorTable(layout: SkinLayout, scale: SkinScale): Int32Array {
  const key = cacheKey(layout, scale);
  let t = mirrorCache.get(key);
  if (t) return t;
  const [W, H] = dims(layout, scale);
  t = new Int32Array(W * H).fill(-1);
  for (const r of faceRects(layout, scale)) {
    const target = faceRect(PART_INFO[r.part].mirror, MIRROR_FACE[r.face], r.layer, layout, scale);
    if (!target || target.w !== r.w || target.h !== r.h) continue;
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) {
        t[(r.y + y) * W + r.x + x] = (target.y + y) * W + target.x + (r.w - 1 - x);
      }
    }
  }
  mirrorCache.set(key, t);
  return t;
}

/** The pixel on the other side of the body, or null (unused area / no counterpart). */
export function mirrorPixel(x: number, y: number, model: SkinLayout, scale: SkinScale = 1): [number, number] | null {
  const [W, H] = dims(model, scale);
  if (x < 0 || y < 0 || x >= W || y >= H) return null;
  const i = mirrorTable(model, scale)[y * W + x];
  if (i < 0) return null;
  return [i % W, Math.floor(i / W)];
}

/** MirrorMap for PixelCanvas.setMirrorMap: painting one arm paints the other, and so on. */
export function mirrorMapFor(model: SkinLayout, scale: SkinScale = 1): (x: number, y: number) => ReadonlyArray<readonly [number, number]> {
  const table = mirrorTable(model, scale);
  const [W, H] = dims(model, scale);
  return (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return [];
    const i = table[y * W + x];
    if (i < 0 || i === y * W + x) return [];
    return [[i % W, Math.floor(i / W)]];
  };
}

/** The face on the other side of the body (null when it is the same face, e.g. the head front). */
export function mirrorFaceRect(r: FaceRect, model: SkinLayout, scale: SkinScale = 1): FaceRect | null {
  const t = faceRect(PART_INFO[r.part].mirror, MIRROR_FACE[r.face], r.layer, model, scale);
  if (!t || (t.x === r.x && t.y === r.y)) return null;
  return t;
}

/**
 * Copies a part onto its mirror partner (e.g. right arm → left arm), flipped the way the body
 * mirror works. Returns a new image; both layers are copied.
 */
export function copyToMirror(img: Pixels, part: SkinPart, model: SkinLayout): ImageData {
  const out = copyImage(img);
  const scale = scaleOf(img.width);
  const W = img.width;
  const table = mirrorTable(model, scale);
  for (const r of faceRects(model, scale)) {
    if (r.part !== part) continue;
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const t = table[y * W + x];
        if (t < 0) continue;
        const s = (y * W + x) * 4;
        out.data.set(img.data.subarray(s, s + 4), t * 4);
      }
    }
  }
  return out;
}

/** Fills (or clears, with rgba null) every face of the given part and layer. */
export function fillPart(img: Pixels, part: SkinPart, layer: SkinLayer, model: SkinLayout, rgba: readonly [number, number, number, number] | null): ImageData {
  const out = copyImage(img);
  for (const r of faceRects(model, scaleOf(img.width))) {
    if (r.part !== part || r.layer !== layer) continue;
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const i = (y * img.width + x) * 4;
        if (rgba) out.data.set(rgba, i);
        else out.data.fill(0, i, i + 4);
      }
    }
  }
  return out;
}

/** Parts plus their mirror partners. */
export function withMirrorParts(parts: Iterable<SkinPart>): Set<SkinPart> {
  const out = new Set<SkinPart>();
  for (const p of parts) {
    out.add(p);
    out.add(PART_INFO[p].mirror);
  }
  return out;
}

// ---- Image helpers (straight RGBA, no canvas) ----

interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

function makeImage(w: number, h: number): ImageData {
  const Ctor = (globalThis as { ImageData?: typeof ImageData }).ImageData;
  if (Ctor) return new Ctor(w, h);
  return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4), colorSpace: 'srgb' } as ImageData;
}

function copyImage(img: Pixels): ImageData {
  const out = makeImage(img.width, img.height);
  out.data.set(img.data);
  return out;
}

function alphaAt(img: Pixels, x: number, y: number): number {
  return img.data[(y * img.width + x) * 4 + 3];
}

/**
 * Guesses the arm model of a 64x64 skin: slim skins leave the 4th arm column of the base layer
 * unused (research/bedrock-packs.md §6.1). Fully transparent there = slim.
 */
export function detectSlim(img: Pixels): boolean {
  if (!((img.width === 64 && img.height === 64) || isHdSkin(img))) return false;
  const k = scaleOf(img.width);
  const regions: [number, number, number, number][] = [
    [54, 20, 2, 12], // right arm back, unused columns
    [46, 52, 2, 12], // left arm back
    [50, 16, 2, 4], // right arm bottom
    [42, 48, 2, 4], // left arm bottom
  ];
  for (const [x0, y0, w, h] of regions.map((r) => r.map((v) => v * k))) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (alphaAt(img, x, y) !== 0) return false;
  }
  return true;
}

/** Number of see-through pixels on the base layer (Java shows those as solid, usually black). */
export function countBaseHoles(img: Pixels, model: SkinModel): number {
  let n = 0;
  for (const r of faceRects(model, scaleOf(img.width))) {
    if (r.layer !== 'base') continue;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (alphaAt(img, x, y) < 255) n++;
  }
  return n;
}

/** Count of non-transparent pixels on the outer layer. */
export function countOuterPixels(img: Pixels, model: SkinLayout): number {
  let n = 0;
  for (const r of faceRects(model, scaleOf(img.width))) {
    if (r.layer !== 'outer') continue;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (alphaAt(img, x, y) > 0) n++;
  }
  return n;
}

/**
 * Converts the arm pixels between the classic (4px) and slim (3px) layouts. Classic → slim drops
 * the column next to the body on the front, back, top and bottom; slim → classic repeats it.
 * Pixels that fall outside the new arm areas are cleared.
 */
export function convertArms(img: Pixels, from: SkinModel, to: SkinModel): ImageData {
  const out = copyImage(img);
  if (from === to || !((img.width === 64 && img.height === 64) || isHdSkin(img))) return out;
  const k = scaleOf(img.width);
  const W = img.width;
  const src = img.data;
  const dst = out.data;
  const idx = (x: number, y: number) => (y * W + x) * 4;
  for (const part of ['rightArm', 'leftArm'] as SkinPart[]) {
    for (const layer of ['base', 'outer'] as SkinLayer[]) {
      const o = partOrigin(part, layer, to, k)!;
      const fromFaces = boxFaces(o[0], o[1], partBox(part, from, k));
      const toFaces = boxFaces(o[0], o[1], partBox(part, to, k));
      // Clear the whole 16x16 arm area (32x32 in HD) first.
      for (let y = o[1]; y < o[1] + 16 * k; y++) for (let x = o[0]; x < o[0] + 16 * k; x++) dst.fill(0, idx(x, y), idx(x, y) + 4);
      for (const face of FACES) {
        const f = fromFaces[face];
        const t = toFaces[face];
        // Column next to the body: the right arm's inner edge is on its left side (+x), the left arm's
        // on its right. Worked out in texel columns (k pixels wide each).
        const fw = f.w / k;
        let inner: number;
        if (face === 'right' || face === 'left') inner = -1;
        else if (face === 'back') inner = part === 'rightArm' ? 0 : fw - 1;
        else inner = part === 'rightArm' ? fw - 1 : 0;
        for (let y = 0; y < t.h; y++) {
          for (let x = 0; x < t.w; x++) {
            let sx = x;
            if (inner >= 0 && f.w !== t.w) {
              const tx = Math.floor(x / k);
              let stx: number;
              if (f.w > t.w) stx = inner === 0 ? tx + 1 : tx; // drop the inner column
              else stx = inner === 0 ? Math.max(0, tx - 1) : Math.min(fw - 1, tx); // repeat it
              sx = stx * k + (x % k);
            }
            const s = idx(f.x + sx, f.y + y);
            const d = idx(t.x + x, t.y + y);
            dst[d] = src[s];
            dst[d + 1] = src[s + 1];
            dst[d + 2] = src[s + 2];
            dst[d + 3] = src[s + 3];
          }
        }
      }
    }
  }
  return out;
}

// ---- Overlay ----

export interface OverlayView {
  scale: number;
  offsetX: number;
  offsetY: number;
  toScreen(x: number, y: number): [number, number];
}

export interface OverlayOptions {
  model: SkinLayout;
  /** Image pixels per template texel (2 for HD skins). Default 1 */
  scale?: SkinScale;
  /** Face outlines (default true) */
  outlines?: boolean;
  /** Part name tags (default true) */
  labels?: boolean;
  /** Layer(s) being painted; the other layer is drawn fainter */
  layers?: LayerSelection;
  /** Face under the cursor */
  hover?: FaceRect | null;
  /** Its mirror counterpart (when mirror painting is on) */
  hoverMirror?: FaceRect | null;
  /** Emphasised parts (e.g. locked or highlighted) */
  focus?: ReadonlySet<SkinPart> | null;
  /** Hovered image pixel; tags under it fade so the pixels stay visible */
  pointer?: { x: number; y: number } | null;
  /** 'dark' | 'light' UI theme */
  theme?: 'dark' | 'light';
  font?: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Draws face outlines, part tags and the hover highlight in screen space (CSS px). */
export function drawPartOverlay(ctx: CanvasRenderingContext2D, view: OverlayView, opts: OverlayOptions): void {
  const layout = opts.model;
  const k = opts.scale ?? 1;
  // Screen px per template texel (an HD image pixel is half a texel).
  const s = view.scale * k;
  if (s < 2) return;
  const outlines = opts.outlines !== false;
  const labels = opts.labels !== false;
  const layers = opts.layers ?? 'both';
  const focus = opts.focus && opts.focus.size ? opts.focus : null;
  const px = (v: number) => Math.round(v);
  const rectScreen = (x: number, y: number, w: number, h: number) => {
    const [sx, sy] = view.toScreen(x, y);
    const [ex, ey] = view.toScreen(x + w, y + h);
    return [px(sx), px(sy), px(ex) - px(sx), px(ey) - px(sy)] as const;
  };
  const active = (l: SkinLayer) => layers === 'both' || layers === l;

  ctx.save();
  ctx.lineJoin = 'miter';

  if (outlines) {
    // Faces: thin outlines in the part colour; the inactive layer and unfocused parts stay faint.
    for (const r of faceRects(layout, k)) {
      const on = active(r.layer) && (!focus || focus.has(r.part));
      const [x, y, w, h] = rectScreen(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = rgba(PART_INFO[r.part].color, on ? 0.7 : 0.22);
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
    // Part outlines (thicker) around each unwrapped box.
    for (const layer of ['base', 'outer'] as SkinLayer[]) {
      for (const part of PARTS) {
        const o = partOrigin(part, layer, layout, k);
        if (!o) continue;
        const f = boxFaces(o[0], o[1], partBox(part, layout, k));
        const on = active(layer) && (!focus || focus.has(part));
        ctx.strokeStyle = rgba(PART_INFO[part].color, on ? 0.95 : 0.3);
        ctx.lineWidth = on ? 2 : 1;
        const off = on ? 1 : 0.5;
        ctx.beginPath();
        // Outline of the cross shape: top+bottom strip and the side strip.
        const [tx, ty, tw] = rectScreen(f.top.x, f.top.y, f.top.w + f.bottom.w, f.top.h);
        const [sx, sy, sw, sh] = rectScreen(f.right.x, f.right.y, f.right.w + f.front.w + f.left.w + f.back.w, f.right.h);
        ctx.moveTo(tx + off, sy + off);
        ctx.lineTo(tx + off, ty + off);
        ctx.lineTo(tx + tw - off, ty + off);
        ctx.lineTo(tx + tw - off, sy + off);
        ctx.lineTo(sx + sw - off, sy + off);
        ctx.lineTo(sx + sw - off, sy + sh - off);
        ctx.lineTo(sx + off, sy + sh - off);
        ctx.lineTo(sx + off, sy + off);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  // Hover highlight: the face under the cursor and its mirror partner.
  const drawFaceHighlight = (r: FaceRect, dashed: boolean) => {
    const color = PART_INFO[r.part].color;
    const [x, y, w, h] = rectScreen(r.x, r.y, r.w, r.h);
    ctx.fillStyle = rgba(color, dashed ? 0.08 : 0.16);
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dashed ? [4, 3] : []);
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.setLineDash([]);
  };
  if (opts.hoverMirror) drawFaceHighlight(opts.hoverMirror, true);
  if (opts.hover) drawFaceHighlight(opts.hover, false);

  if (labels && s >= 3.5) {
    const light = opts.theme === 'light';
    const fontPx = s >= 6 ? 16 : 8;
    ctx.font = `${fontPx}px ${opts.font ?? "'Texel', monospace"}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const padX = fontPx >= 16 ? 6 : 3;
    const tagH = fontPx >= 16 ? 22 : 12;
    for (const layer of ['base', 'outer'] as SkinLayer[]) {
      for (const part of PARTS) {
        const o = partOrigin(part, layer, layout, k);
        if (!o) continue;
        const b = partBox(part, layout);
        const info = PART_INFO[part];
        // Tags sit in the unused corner left of the top face (d x d pixels).
        // Keep tags over the unused corner and the top face; fall back to short names.
        let text = layer === 'base' ? info.label : info.outerLabel;
        let tw = ctx.measureText(text).width + padX * 2;
        const maxW = (b.d + b.w) * s - 4;
        if (tw > maxW) {
          text = layer === 'base' ? info.short : info.outerShort;
          tw = ctx.measureText(text).width + padX * 2;
        }
        if (tw > (2 * b.d + 2 * b.w) * s - 6) continue;
        const [cx, cy] = view.toScreen(o[0], o[1]);
        const x = px(cx) + 3;
        const y = px(cy) + Math.max(3, Math.round((Math.min(b.d * s, 40) - tagH) / 2));
        const on = active(layer) && (!focus || focus.has(part));
        // Fade when the pointer is over the tag.
        let alpha = on ? 1 : 0.55;
        if (opts.pointer) {
          const [ppx, ppy] = view.toScreen(opts.pointer.x + 0.5, opts.pointer.y + 0.5);
          if (ppx >= x - s && ppx <= x + tw + s && ppy >= y - s && ppy <= y + tagH + s) alpha = 0.12;
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = light ? rgba(info.color, 0.95) : rgba(info.color, 0.92);
        ctx.fillRect(x, y, Math.round(tw), tagH);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(x, y + tagH - 2, Math.round(tw), 2);
        ctx.fillStyle = '#0b0e14';
        ctx.fillText(text, x + padX, y + tagH / 2 - (fontPx >= 16 ? 1 : 0));
        ctx.globalAlpha = 1;
      }
    }
  }
  ctx.restore();
}
