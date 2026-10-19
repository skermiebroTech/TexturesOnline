// Painting on baked models: a ray against the model's quads (the same two triangles per quad, with the
// same lift for coplanar overlays, that the 3D view draws), the texture point it lands on, and the
// texel of a texture of any size that point is in, kept inside the face's own texture area. Pure, no DOM.

import type { BakedQuad, Vec3 } from './geometry';

export interface QuadHit {
  /** Index into the quads */
  index: number;
  /** Distance along the ray (in ray direction units) */
  t: number;
  /** Texture point within one frame of the face's texture: 0..1, v down */
  uv: [number, number];
  /** Where the ray meets the face (model units) */
  point: Vec3;
}

export interface RaycastOptions {
  /** Also hit faces from behind (the 3D view only draws front faces) */
  twoSided?: boolean;
  /** Leaves a quad out (hidden parts) */
  skip?: (index: number) => boolean;
  /** Return false to look through a hit, e.g. a see-through texel */
  accept?: (hit: QuadHit, quad: BakedQuad) => boolean;
}

export interface Texel {
  x: number;
  y: number;
  /** Continuous texel position (x + fraction), for strokes between samples */
  fx: number;
  fy: number;
}

export interface TexelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Faces lying in the same plane as an earlier face (overlays such as the grass block's tinted side) are
 * lifted a hair along their normal so they draw on top instead of flickering. Returns the lift per quad.
 */
export function coplanarLifts(quads: readonly BakedQuad[]): number[] {
  const seen = new Map<string, number>();
  return quads.map((q) => {
    const n = q.normal;
    const p = q.positions[0];
    const d = n[0] * p[0] + n[1] * p[1] + n[2] * p[2];
    const key = `${n.map((c) => c.toFixed(3)).join(',')}|${d.toFixed(4)}`;
    const k = seen.get(key) ?? 0;
    seen.set(key, k + 1);
    return k * 0.0012;
  });
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The quads' corners as drawn (coplanar overlays lifted). Cache it per model. */
export function liftedPositions(quads: readonly BakedQuad[]): Vec3[][] {
  const lifts = coplanarLifts(quads);
  return quads.map((q, i) => q.positions.map((p) => [p[0] + q.normal[0] * lifts[i], p[1] + q.normal[1] * lifts[i], p[2] + q.normal[2] * lifts[i]] as Vec3));
}

const EPS = 1e-9;

/** Möller–Trumbore: distance and barycentrics (b1 for B, b2 for C) of a ray through triangle ABC. */
function triangle(o: Vec3, d: Vec3, a: Vec3, b: Vec3, c: Vec3, twoSided: boolean): [number, number, number] | null {
  const e1 = sub(b, a);
  const e2 = sub(c, a);
  const p = cross(d, e2);
  const det = dot(e1, p);
  // det > 0: the triangle faces the ray (counter-clockwise seen from the ray's origin)
  if (twoSided ? Math.abs(det) < EPS : det < EPS) return null;
  const inv = 1 / det;
  const s = sub(o, a);
  const u = dot(s, p) * inv;
  if (u < -1e-7 || u > 1 + 1e-7) return null;
  const q = cross(s, e1);
  const v = dot(d, q) * inv;
  if (v < -1e-7 || u + v > 1 + 1e-7) return null;
  const t = dot(e2, q) * inv;
  return t > 1e-7 ? [t, u, v] : null;
}

/**
 * The front-most face a ray meets (origin and direction in model units), with the texture point there.
 * Pass `positions` from liftedPositions() to match the drawn model exactly (computed when omitted).
 */
export function raycastQuads(quads: readonly BakedQuad[], origin: Vec3, dir: Vec3, opts: RaycastOptions = {}, positions?: Vec3[][]): QuadHit | null {
  const pos = positions ?? liftedPositions(quads);
  const hits: QuadHit[] = [];
  for (let i = 0; i < quads.length; i++) {
    if (opts.skip?.(i)) continue;
    const q = quads[i];
    const p = pos[i];
    // Two triangles per quad, as the 3D view draws them: (0, 1, 2) and (0, 2, 3).
    for (const [ia, ib, ic] of [
      [0, 1, 2],
      [0, 2, 3],
    ] as const) {
      const r = triangle(origin, dir, p[ia], p[ib], p[ic], !!opts.twoSided);
      if (!r) continue;
      const [t, b1, b2] = r;
      const b0 = 1 - b1 - b2;
      const ua = q.uvs[ia];
      const ub = q.uvs[ib];
      const uc = q.uvs[ic];
      const uv: [number, number] = [(b0 * ua[0] + b1 * ub[0] + b2 * uc[0]) / 16, (b0 * ua[1] + b1 * ub[1] + b2 * uc[1]) / 16];
      hits.push({ index: i, t, uv, point: [origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t] });
      break;
    }
  }
  hits.sort((a, b) => a.t - b.t || b.index - a.index);
  for (const h of hits) if (!opts.accept || opts.accept(h, quads[h.index])) return h;
  return null;
}

/** The quad's texture area in one frame (0..1, v down) as [u0, v0, u1, v1] with u0 <= u1 and v0 <= v1. */
export function quadUvRect(q: BakedQuad): [number, number, number, number] {
  let u0 = Infinity;
  let v0 = Infinity;
  let u1 = -Infinity;
  let v1 = -Infinity;
  for (const [u, v] of q.uvs) {
    u0 = Math.min(u0, u);
    v0 = Math.min(v0, v);
    u1 = Math.max(u1, u);
    v1 = Math.max(v1, v);
  }
  return [u0 / 16, v0 / 16, u1 / 16, v1 / 16];
}

/** Floor that forgives float dust just under an integer (3.9999999 is texel 4). */
const fl = (v: number): number => Math.floor(v + 1e-6);

/** The texels a quad shows, for a frame of `width` x `height` (clipped to the image). */
export function quadTexelRect(q: BakedQuad, width: number, height: number): TexelRect {
  const [u0, v0, u1, v1] = quadUvRect(q);
  const x0 = Math.max(0, Math.min(width - 1, fl(u0 * width)));
  const y0 = Math.max(0, Math.min(height - 1, fl(v0 * height)));
  const x1 = Math.max(x0 + 1, Math.min(width, Math.ceil(u1 * width - 1e-6)));
  const y1 = Math.max(y0 + 1, Math.min(height, Math.ceil(v1 * height - 1e-6)));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * The texel a texture point is in, for a frame of `width` x `height`. Points on the edge of a face stay
 * inside that face's texture area (a face showing texels 0..7 never paints texel 8).
 */
export function texelAt(q: BakedQuad, uv: readonly [number, number], width: number, height: number): Texel {
  const r = quadTexelRect(q, width, height);
  const fx = Math.min(Math.max(uv[0] * width, r.x), r.x + r.w - 1e-3);
  const fy = Math.min(Math.max(uv[1] * height, r.y), r.y + r.h - 1e-3);
  return { x: fl(fx), y: fl(fy), fx, fy };
}

/**
 * Texels (y * width + x) a square or round brush of `size` covers around texel position (fx, fy), as
 * the pixel editor lays it out (odd sizes centre on the texel, even ones on its nearest corner), kept
 * inside `clip` (a face's own patch of an entity texture sheet) and the image.
 */
export function brushTexels(fx: number, fy: number, size: number, round: boolean, width: number, height: number, clip?: TexelRect | null): number[] {
  const n = Math.max(1, Math.round(size));
  const ox = Math.floor(fx - n / 2 + 0.5);
  const oy = Math.floor(fy - n / 2 + 0.5);
  const x0 = clip ? Math.max(0, clip.x) : 0;
  const y0 = clip ? Math.max(0, clip.y) : 0;
  const x1 = clip ? Math.min(width, clip.x + clip.w) : width;
  const y1 = clip ? Math.min(height, clip.y + clip.h) : height;
  const c = n / 2;
  const limit = c * c - (n <= 3 ? 0.5 : 0);
  const out: number[] = [];
  for (let dy = 0; dy < n; dy++) {
    for (let dx = 0; dx < n; dx++) {
      if (round && n > 2) {
        const ex = dx + 0.5 - c;
        const ey = dy + 0.5 - c;
        if (ex * ex + ey * ey > limit) continue;
      }
      const x = ox + dx;
      const y = oy + dy;
      if (x >= x0 && y >= y0 && x < x1 && y < y1) out.push(y * width + x);
    }
  }
  return out;
}

/** Texels mirrored left-right and / or top-bottom across the image, as the pixel editor's mirror paints them. */
export function mirrorTexels(pixels: readonly number[], width: number, height: number, mx: boolean, my: boolean): number[] {
  if (!mx && !my) return [];
  const own = new Set(pixels);
  const out = new Set<number>();
  for (const p of pixels) {
    const x = p % width;
    const y = (p - x) / width;
    const add = (xx: number, yy: number) => {
      const q = yy * width + xx;
      if (!own.has(q)) out.add(q);
    };
    if (mx) add(width - 1 - x, y);
    if (my) add(x, height - 1 - y);
    if (mx && my) add(width - 1 - x, height - 1 - y);
  }
  return [...out];
}

/** Continuous texel positions from a to b (excluding a), at least two per texel, for strokes between samples. */
export function texelSteps(a: { fx: number; fy: number }, b: { fx: number; fy: number }): [number, number][] {
  const dx = b.fx - a.fx;
  const dy = b.fy - a.fy;
  const n = Math.min(512, Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 2)));
  const out: [number, number][] = [];
  for (let k = 1; k <= n; k++) out.push([a.fx + (dx * k) / n, a.fy + (dy * k) / n]);
  return out;
}

/** Texture point (0..1 of a frame) to the corner of the face showing it, or null when the face doesn't show it. */
export function pointForUv(q: BakedQuad, uv: readonly [number, number], positions?: readonly Vec3[]): Vec3 | null {
  const p = positions ?? q.positions;
  for (const [ia, ib, ic] of [
    [0, 1, 2],
    [0, 2, 3],
  ] as const) {
    const a = q.uvs[ia];
    const b = q.uvs[ib];
    const c = q.uvs[ic];
    const x = uv[0] * 16;
    const y = uv[1] * 16;
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(den) < 1e-12) continue;
    const w0 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / den;
    const w1 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / den;
    const w2 = 1 - w0 - w1;
    if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
    return [0, 1, 2].map((k) => w0 * p[ia][k] + w1 * p[ib][k] + w2 * p[ic][k]) as Vec3;
  }
  return null;
}
