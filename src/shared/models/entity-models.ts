// Entity-style models, the way the game builds the ones it draws with its own code (chests, banners,
// heads, shulker boxes...): parts with boxes (texture offset, origin and size in pixels, inflation,
// mirroring, visible faces) unwrapped with the standard box UV layout, part poses (offset, Euler
// rotation applied X then Y then Z, scale) and a pose matrix for the whole model. Baked into the same
// BakedQuads block models produce, so they can be shown, hovered and clicked like any other model.
// Pure, no DOM.

import { DIR_VEC, DIRS, nearestDir, snap, type BakedQuad, type Dir, type Tint, type Vec3 } from './geometry';

// ---------------------------------------------------------------------------------------------
// Affine pose matrices (row-major 3x4: rotation/scale columns plus translation)

export type Mat4 = [number, number, number, number, number, number, number, number, number, number, number, number];

export const MAT4_IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

export function mat4Mul(a: Mat4, b: Mat4): Mat4 {
  const o = new Array(12).fill(0) as Mat4;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      let v = a[r * 4] * b[c] + a[r * 4 + 1] * b[4 + c] + a[r * 4 + 2] * b[8 + c];
      if (c === 3) v += a[r * 4 + 3];
      o[r * 4 + c] = v;
    }
  }
  return o;
}

export function mat4Translation(x: number, y: number, z: number): Mat4 {
  return [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
}

export function mat4Scale(x: number, y: number, z: number): Mat4 {
  return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0];
}

/** cos / sin of radians, exact for quarter turns so boxes keep integral corners. */
function cs(rad: number): [number, number] {
  const q = rad / (Math.PI / 2);
  if (Math.abs(q - Math.round(q)) < 1e-9) {
    const k = ((Math.round(q) % 4) + 4) % 4;
    return [[1, 0, -1, 0][k], [0, 1, 0, -1][k]];
  }
  return [Math.cos(rad), Math.sin(rad)];
}

/** Right-handed rotation about an axis, in radians. */
export function mat4Rotation(axis: 'x' | 'y' | 'z', rad: number): Mat4 {
  const [c, s] = cs(rad);
  if (axis === 'x') return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0];
  if (axis === 'y') return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0];
  return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0];
}

export const deg = (d: number): number => (d * Math.PI) / 180;

/** Composes transforms left to right, like the game's pose stack (the last one applies first to a point). */
export function mat4Chain(...ms: Mat4[]): Mat4 {
  return ms.reduce((a, b) => mat4Mul(a, b), MAT4_IDENTITY);
}

/** Rotation about a pivot point (Matrix4f.rotateAround). */
export function mat4RotateAround(axis: 'x' | 'y' | 'z', rad: number, px: number, py: number, pz: number): Mat4 {
  return mat4Chain(mat4Translation(px, py, pz), mat4Rotation(axis, rad), mat4Translation(-px, -py, -pz));
}

export function mat4Apply(m: Mat4, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + m[3],
    m[4] * v[0] + m[5] * v[1] + m[6] * v[2] + m[7],
    m[8] * v[0] + m[9] * v[1] + m[10] * v[2] + m[11],
  ];
}

function det3(m: Mat4): number {
  return m[0] * (m[5] * m[10] - m[6] * m[9]) - m[1] * (m[4] * m[10] - m[6] * m[8]) + m[2] * (m[4] * m[9] - m[5] * m[8]);
}

// ---------------------------------------------------------------------------------------------
// Model definitions (numbers in model pixels, 16 per block, exactly as the game lists them)

export interface EntityCube {
  /** Texture offset (texOffs) in texture pixels */
  uv: [number, number];
  /** Box origin (addBox x, y, z) */
  from: Vec3;
  /** Box size (width, height, depth) */
  size: Vec3;
  /** Grows the box on every side without changing its texture area (CubeDeformation) */
  inflate?: number | Vec3;
  /** Mirrors the texture left-right (CubeListBuilder.mirror) */
  mirror?: boolean;
  /** Faces to build (default all six), in the model's own directions */
  faces?: readonly Dir[];
}

export interface EntityPose {
  /** Pivot / offset in pixels */
  offset?: Vec3;
  /** Euler angles in radians, applied X first, then Y, then Z (ModelPart.translateAndRotate) */
  rotation?: Vec3;
  scale?: Vec3;
}

export interface EntityPart {
  name: string;
  cubes?: EntityCube[];
  pose?: EntityPose;
  children?: EntityPart[];
}

export interface EntityModel {
  /** Texture size the UVs refer to (LayerDefinition.create width / height) */
  texSize: [number, number];
  parts: EntityPart[];
}

/** Shorthand for a box: texture offset, origin, size and options. */
export function cube(u: number, v: number, x: number, y: number, z: number, w: number, h: number, d: number, opts: Omit<EntityCube, 'uv' | 'from' | 'size'> = {}): EntityCube {
  return { uv: [u, v], from: [x, y, z], size: [w, h, d], ...opts };
}

/** Every face except the listed ones (Util.allOfEnumExcept). */
export function facesExcept(...dirs: Dir[]): Dir[] {
  return DIRS.filter((d) => !dirs.includes(d));
}

/** A pose's matrix: translate(offset / 16), rotate Z·Y·X, scale. */
export function poseMatrix(p: EntityPose | undefined): Mat4 {
  if (!p) return MAT4_IDENTITY;
  const o = p.offset ?? [0, 0, 0];
  const r = p.rotation ?? [0, 0, 0];
  const s = p.scale ?? [1, 1, 1];
  let m = mat4Translation(o[0] / 16, o[1] / 16, o[2] / 16);
  if (r[2]) m = mat4Mul(m, mat4Rotation('z', r[2]));
  if (r[1]) m = mat4Mul(m, mat4Rotation('y', r[1]));
  if (r[0]) m = mat4Mul(m, mat4Rotation('x', r[0]));
  if (s[0] !== 1 || s[1] !== 1 || s[2] !== 1) m = mat4Mul(m, mat4Scale(s[0], s[1], s[2]));
  return m;
}

// ---------------------------------------------------------------------------------------------
// Box UV unwrap (ModelPart.Cube / Polygon)

export interface EntityPolygon {
  /** Face of the box in the model's own axes (mirrored boxes swap west and east) */
  dir: Dir;
  /** Corners in pixels, counter-clockwise seen from outside */
  corners: [Vec3, Vec3, Vec3, Vec3];
  /** Texture pixel coordinates per corner */
  uvs: [[number, number], [number, number], [number, number], [number, number]];
}

/** The six polygons of a box with their texture corners, exactly as the game unwraps them. */
export function cubePolygons(c: EntityCube): EntityPolygon[] {
  const [w, h, d] = c.size;
  const g: Vec3 = typeof c.inflate === 'number' ? [c.inflate, c.inflate, c.inflate] : (c.inflate ?? [0, 0, 0]);
  let x0 = c.from[0] - g[0];
  const y0 = c.from[1] - g[1];
  const z0 = c.from[2] - g[2];
  let x1 = c.from[0] + w + g[0];
  const y1 = c.from[1] + h + g[1];
  const z1 = c.from[2] + d + g[2];
  const mirror = !!c.mirror;
  if (mirror) [x0, x1] = [x1, x0];
  const t0: Vec3 = [x0, y0, z0];
  const t1: Vec3 = [x1, y0, z0];
  const t2: Vec3 = [x1, y1, z0];
  const t3: Vec3 = [x0, y1, z0];
  const l0: Vec3 = [x0, y0, z1];
  const l1: Vec3 = [x1, y0, z1];
  const l2: Vec3 = [x1, y1, z1];
  const l3: Vec3 = [x0, y1, z1];
  const [u, v] = [Math.trunc(c.uv[0]), Math.trunc(c.uv[1])];
  const u0 = u;
  const u1 = u + d;
  const u2 = u + d + w;
  const u22 = u + d + w + w;
  const u3 = u + d + w + d;
  const u4 = u + d + w + d + w;
  const v0 = v;
  const v1 = v + d;
  const v2 = v + d + h;
  const faces = c.faces ?? DIRS;
  const out: EntityPolygon[] = [];
  const poly = (dir: Dir, corners: [Vec3, Vec3, Vec3, Vec3], a: number, b: number, cc: number, dd: number) => {
    if (!faces.includes(dir)) return;
    const uvs: EntityPolygon['uvs'] = [
      [cc, b],
      [a, b],
      [a, dd],
      [cc, dd],
    ];
    let cs2 = corners;
    let uv2 = uvs;
    if (mirror) {
      cs2 = [corners[3], corners[2], corners[1], corners[0]];
      uv2 = [uvs[3], uvs[2], uvs[1], uvs[0]];
    }
    // The game gives a mirrored box's side faces the opposite normal (Polygon.mirrorFacing).
    const faceDir: Dir = mirror && dir === 'west' ? 'east' : mirror && dir === 'east' ? 'west' : dir;
    out.push({ dir: faceDir, corners: cs2, uvs: uv2 });
  };
  poly('down', [l1, l0, t0, t1], u1, v0, u2, v1);
  poly('up', [t2, t3, l3, l2], u2, v1, u22, v0);
  poly('west', [t0, l0, l3, t3], u0, v1, u1, v2);
  poly('north', [t1, t0, t3, t2], u1, v1, u2, v2);
  poly('east', [l1, t1, t2, l2], u2, v1, u3, v2);
  poly('south', [l0, l1, l2, l3], u3, v1, u4, v2);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Baking

export interface EntityBakeOptions {
  /** Pack path of the texture (null = missing) */
  texture: string | null;
  /** How the texture is named for display / reverse lookups (defaults to the path) */
  ref?: string;
  /** Texture role of every quad, or per part path ('lid', 'head/hat') */
  role: string | ((partPath: string) => string);
  tint?: Tint | null;
  /** Texture size to map the UVs with (defaults to the model's; a pack at another resolution scales with it) */
  texSize?: [number, number];
  /** Model part index given to the quads */
  part?: number;
  /** Only these part paths (and their children) */
  only?: (partPath: string) => boolean;
  /** Replaces a part's pose (animation state such as an open book or a turned ear) */
  pose?: (partPath: string, pose: EntityPose | undefined) => EntityPose | undefined;
}

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/**
 * Bakes an entity model through `transform` (block units: the model's pixels are divided by 16 by the
 * part poses, like ModelPart). Faces with no area (the thin sides of flat parts) are left out.
 */
export function bakeEntityModel(model: EntityModel, transform: Mat4, opts: EntityBakeOptions): BakedQuad[] {
  const out: BakedQuad[] = [];
  const [tw, th] = opts.texSize ?? model.texSize;
  const flip = det3(transform) < 0;
  let element = 0;
  const walk = (parts: EntityPart[], parent: Mat4, prefix: string) => {
    for (const p of parts) {
      const path = prefix ? `${prefix}/${p.name}` : p.name;
      const pose = opts.pose ? opts.pose(path, p.pose) : p.pose;
      const m = mat4Mul(parent, poseMatrix(pose));
      const included = !opts.only || opts.only(path);
      if (included) {
        const role = typeof opts.role === 'function' ? opts.role(path) : opts.role;
        for (const c of p.cubes ?? []) {
          const el = element++;
          for (const poly of cubePolygons(c)) {
            let corners = poly.corners.map((v) => mat4Apply(m, [v[0] / 16, v[1] / 16, v[2] / 16])) as [Vec3, Vec3, Vec3, Vec3];
            let uvs = poly.uvs;
            if (flip) {
              corners = [corners[3], corners[2], corners[1], corners[0]];
              uvs = [uvs[3], uvs[2], uvs[1], uvs[0]];
            }
            const n = cross(sub(corners[2], corners[0]), sub(corners[3], corners[1]));
            const len = Math.hypot(n[0], n[1], n[2]);
            if (len < 1e-10) continue;
            const normal = n.map((x) => snap(x / len)) as Vec3;
            const axis = nearestDir(normal);
            const dv = DIR_VEC[axis];
            const aligned = dv[0] * normal[0] + dv[1] * normal[1] + dv[2] * normal[2] > 0.999;
            out.push({
              positions: corners.map((v) => v.map(snap)) as BakedQuad['positions'],
              uvs: uvs.map(([uu, vv]) => [(uu / tw) * 16, (vv / th) * 16]) as BakedQuad['uvs'],
              normal,
              dir: axis,
              worldDir: aligned ? axis : null,
              texture: opts.texture,
              ref: opts.ref ?? opts.texture ?? '',
              role,
              tintindex: opts.tint ? 0 : -1,
              tint: opts.tint ?? null,
              shade: true,
              part: opts.part ?? 0,
              element: el,
            });
          }
        }
      } else element += p.cubes?.length ?? 0;
      if (p.children) walk(p.children, m, path);
    }
  };
  walk(model.parts, transform, '');
  return out;
}

/** Moves quads by whole blocks (the second half of a double chest, the head of a bed). */
export function offsetQuads(quads: BakedQuad[], off: Vec3): BakedQuad[] {
  if (!off[0] && !off[1] && !off[2]) return quads;
  return quads.map((q) => ({ ...q, positions: q.positions.map((p) => [snap(p[0] + off[0]), snap(p[1] + off[1]), snap(p[2] + off[2])]) as BakedQuad['positions'] }));
}
