// Where each skin pixel sits on the 3D player model, for painting on the model: the face frames of
// every body-part box (matching skinview3d's BoxGeometry UVs), brush footprints that wrap over box
// edges, and stroke interpolation. Pure; no three.js.
//
// Box space: texel units with the box corner at the origin, x towards the player's left, y up and z
// towards the front, so a part of w x h x d pixels spans [0, w] x [0, h] x [0, d].

import { brushOffsets, brushOrigin, type BrushShape } from '../../shared/pixel-algorithms';
import { faceRect, mirrorPixel, partAt, partBox, type Box, type FaceRect, type SkinFace, type SkinLayout } from './templates';

export type Vec3 = [number, number, number];

export interface FaceFrame {
  /** Box-space position of the face's top-left texture corner */
  origin: Vec3;
  /** Box-space step of one texture column (u) and one texture row (v) */
  u: Vec3;
  v: Vec3;
  /** Outward normal */
  normal: Vec3;
}

/** BoxGeometry face order (+x, -x, +y, -y, +z, -z) as skin faces: +x is the player's left side. */
export const BOX_FACE_ORDER: readonly SkinFace[] = ['left', 'right', 'top', 'bottom', 'front', 'back'];

/** How a face's texture lies on its box (skinview3d / Minecraft orientation). */
export function faceFrame(face: SkinFace, box: Box): FaceFrame {
  const { w, h, d } = box;
  switch (face) {
    case 'front':
      return { origin: [0, h, d], u: [1, 0, 0], v: [0, -1, 0], normal: [0, 0, 1] };
    case 'back':
      return { origin: [w, h, 0], u: [-1, 0, 0], v: [0, -1, 0], normal: [0, 0, -1] };
    case 'left':
      return { origin: [w, h, d], u: [0, 0, -1], v: [0, -1, 0], normal: [1, 0, 0] };
    case 'right':
      return { origin: [0, h, 0], u: [0, 0, 1], v: [0, -1, 0], normal: [-1, 0, 0] };
    case 'top':
      return { origin: [0, h, 0], u: [1, 0, 0], v: [0, 0, 1], normal: [0, 1, 0] };
    case 'bottom':
      return { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1], normal: [0, -1, 0] };
  }
}

/** Box-space point of face-local texture coordinates (i across, j down, in pixels). */
export function facePoint(f: FaceFrame, i: number, j: number): Vec3 {
  return [f.origin[0] + f.u[0] * i + f.v[0] * j, f.origin[1] + f.u[1] * i + f.v[1] * j, f.origin[2] + f.u[2] * i + f.v[2] * j];
}

function faceCoords(f: FaceFrame, p: Vec3): [number, number] {
  const dx = p[0] - f.origin[0];
  const dy = p[1] - f.origin[1];
  const dz = p[2] - f.origin[2];
  return [dx * f.u[0] + dy * f.u[1] + dz * f.u[2], dx * f.v[0] + dy * f.v[1] + dz * f.v[2]];
}

/** The face on each side of the box: [axis][0 = positive side, 1 = negative side]. */
const FACE_ON_SIDE: readonly (readonly [SkinFace, SkinFace])[] = [
  ['left', 'right'],
  ['top', 'bottom'],
  ['front', 'back'],
];

export interface TexelPlace {
  rect: FaceRect;
  box: Box;
  /** Box-space centre of the pixel */
  center: Vec3;
  normal: Vec3;
}

/** Where an image pixel's centre sits on its body part, or null for unused template areas. */
export function texelPlace(x: number, y: number, layout: SkinLayout): TexelPlace | null {
  const r = partAt(x, y, layout);
  if (!r) return null;
  const box = partBox(r.part, layout);
  const f = faceFrame(r.face, box);
  return { rect: r, box, center: facePoint(f, Math.floor(x) - r.x + 0.5, Math.floor(y) - r.y + 0.5), normal: f.normal };
}

/**
 * Pixels (as y * 64 + x) covered by a brush of `size` centred on fractional image coordinates
 * (fx, fy) on the model. The brush is laid out on the face under it the way the 2D pencil lays it out
 * on the template; where it hangs over an edge it folds onto the neighbouring face (same part and
 * layer). It never reaches past a neighbouring face, so thin limbs don't get painted on the far side.
 */
export function surfaceFootprint(fx: number, fy: number, size: number, shape: BrushShape, layout: SkinLayout): number[] {
  const r = partAt(fx, fy, layout);
  if (!r) return [];
  const n = Math.max(1, Math.round(size));
  if (n === 1) return [Math.floor(fy) * 64 + Math.floor(fx)];
  const box = partBox(r.part, layout);
  const dims = [box.w, box.h, box.d];
  const f = faceFrame(r.face, box);
  const na = f.normal[0] ? 0 : f.normal[1] ? 1 : 2;
  const [ox, oy] = brushOrigin(fx - r.x, fy - r.y, n);
  const out = new Set<number>();
  for (const [dx, dy] of brushOffsets(n, shape)) {
    const i = ox + dx;
    const j = oy + dy;
    if (i >= 0 && j >= 0 && i < r.w && j < r.h) {
      out.add((r.y + j) * 64 + r.x + i);
      continue;
    }
    // Hanging over an edge: fold the overhang down the neighbouring face.
    const p = facePoint(f, i + 0.5, j + 0.5);
    let axis = -1;
    let over = 0;
    for (let a = 0; a < 3; a++) {
      const o = p[a] < 0 ? p[a] : p[a] > dims[a] ? p[a] - dims[a] : 0;
      if (!o) continue;
      if (axis >= 0) {
        axis = -2; // over a corner: no single neighbour
        break;
      }
      axis = a;
      over = o;
    }
    if (axis < 0) continue;
    const depth = Math.abs(over);
    if (depth >= dims[na]) continue;
    const q: Vec3 = [p[0], p[1], p[2]];
    q[axis] = over < 0 ? 0 : dims[axis];
    q[na] -= depth * f.normal[na];
    const g = FACE_ON_SIDE[axis][over < 0 ? 1 : 0];
    const gr = faceRect(r.part, g, r.layer, layout);
    if (!gr) continue;
    const [gi, gj] = faceCoords(faceFrame(g, box), q).map(Math.floor);
    if (gi >= 0 && gj >= 0 && gi < gr.w && gj < gr.h) out.add((gr.y + gj) * 64 + gr.x + gi);
  }
  return [...out];
}

/** The mirror image of a set of pixels (true body mirror), without the pixels themselves. */
export function mirrorFootprint(pixels: Iterable<number>, layout: SkinLayout): number[] {
  const out = new Set<number>();
  for (const p of pixels) {
    const m = mirrorPixel(p % 64, Math.floor(p / 64), layout);
    if (m) {
      const k = m[1] * 64 + m[0];
      if (k !== p) out.add(k);
    }
  }
  return [...out];
}

/**
 * Evenly spaced points from a to b (fractional image coordinates on one face), excluding a and
 * including b, close enough that consecutive brush stamps touch.
 */
export function strokeSteps(a: { fx: number; fy: number }, b: { fx: number; fy: number }): [number, number][] {
  const dx = b.fx - a.fx;
  const dy = b.fy - a.fy;
  const n = Math.min(256, Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 2)));
  const out: [number, number][] = [];
  for (let k = 1; k <= n; k++) out.push([a.fx + (dx * k) / n, a.fy + (dy * k) / n]);
  return out;
}
