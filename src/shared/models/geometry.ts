// Edition-agnostic model geometry: the baked quad format every model engine produces (Java block and
// item models, Bedrock engine shapes) plus the small amount of 3D math they share. Pure, no DOM.

export type Dir = 'down' | 'up' | 'north' | 'south' | 'west' | 'east';
export const DIRS: readonly Dir[] = ['down', 'up', 'north', 'south', 'west', 'east'];
export type Vec3 = [number, number, number];
export type Vec2 = [number, number];
/** Texture rectangle in 1/16 units of one frame: [u1, v1, u2, v2] (v grows downwards). */
export type UV4 = [number, number, number, number];
export type RGB = [number, number, number];

/** How a face is coloured by the game: a biome colour map, a fixed colour, or none. */
export type Tint =
  | { kind: 'grass' }
  | { kind: 'foliage' }
  | { kind: 'dry_foliage' }
  | { kind: 'water' }
  | { kind: 'fixed'; rgb: RGB };

export interface BakedQuad {
  /** Four corners in block units (1 = one block, the first block spans 0..1), counter-clockwise seen from the front */
  positions: [Vec3, Vec3, Vec3, Vec3];
  /** Per-corner texture coordinates in 1/16 of one texture frame (0..16, v down) */
  uvs: [Vec2, Vec2, Vec2, Vec2];
  /** Outward unit normal after every rotation */
  normal: Vec3;
  /** Direction of the face in its model, before the block state's rotation */
  dir: Dir;
  /** Closest axis direction after rotation (null when the face is angled, e.g. plants) */
  worldDir: Dir | null;
  /** Pack path of the texture (null when the model points at a texture that doesn't exist) */
  texture: string | null;
  /** The texture as the model names it, e.g. 'minecraft:block/furnace_front' or a Bedrock short name */
  ref: string;
  /** Texture variable / role that picked it, e.g. 'front', 'side', 'all', 'layer0' (Bedrock: the face key) */
  role: string;
  /** Index into the tints of the model (-1 = none) */
  tintindex: number;
  /** Resolved tint, when the game colours this face */
  tint: Tint | null;
  /** Bedrock: the texture's alpha channel is a tint mask (overlay_color) rather than transparency */
  tintMask?: boolean;
  /** Directional shading applies (Java "shade": false turns it off) */
  shade: boolean;
  /** Shade as if facing this way (26.x "shade_direction_override", e.g. plants lit like a top face) */
  shadeDir?: Dir;
  /** Which model part and element it came from */
  part: number;
  element: number;
}

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

// ---- 3x3 rotation matrices (row-major) ----

export type Mat3 = [number, number, number, number, number, number, number, number, number];

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** cos / sin of an angle in degrees, exact for multiples of 90 so quarter turns stay integral. */
function cosSin(deg: number): [number, number] {
  const q = deg / 90;
  if (Number.isInteger(q)) {
    const k = ((q % 4) + 4) % 4;
    return [[1, 0, -1, 0][k], [0, 1, 0, -1][k]];
  }
  const r = (deg * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r)];
}

/** Right-handed rotation about +X by `deg` degrees. */
export function rotX(deg: number): Mat3 {
  const [c, s] = cosSin(deg);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}
export function rotY(deg: number): Mat3 {
  const [c, s] = cosSin(deg);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
export function rotZ(deg: number): Mat3 {
  const [c, s] = cosSin(deg);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

export function mul(a: Mat3, b: Mat3): Mat3 {
  const o = new Array(9).fill(0) as Mat3;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return o;
}

export function transpose(a: Mat3): Mat3 {
  return [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]];
}

export function apply(m: Mat3, v: Vec3): Vec3 {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}

/** Rotates `p` about `origin`, then scales the offset component-wise. */
export function rotateAbout(p: Vec3, origin: Vec3, m: Mat3, scale: Vec3 = [1, 1, 1]): Vec3 {
  const v = apply(m, [p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]]);
  return [v[0] * scale[0] + origin[0], v[1] * scale[1] + origin[1], v[2] * scale[2] + origin[2]];
}

export const DIR_VEC: Record<Dir, Vec3> = {
  down: [0, -1, 0],
  up: [0, 1, 0],
  north: [0, 0, -1],
  south: [0, 0, 1],
  west: [-1, 0, 0],
  east: [1, 0, 0],
};

/** Closest axis direction of a vector (Minecraft's Direction.getNearest). */
export function nearestDir(v: Vec3): Dir {
  let best: Dir = 'north';
  let bestDot = -Infinity;
  for (const d of DIRS) {
    const n = DIR_VEC[d];
    const dot = n[0] * v[0] + n[1] * v[1] + n[2] * v[2];
    if (dot > bestDot) {
      bestDot = dot;
      best = d;
    }
  }
  return best;
}

export function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Snaps values within 1e-6 of a multiple of 1/64 block, so rotations don't leave float dust. */
export function snap(v: number): number {
  const r = Math.round(v * 1024) / 1024;
  return Math.abs(r - v) < 1e-6 ? r : v;
}

// ---- Minecraft face geometry (FaceInfo / BlockElement defaults) ----

/**
 * Corner order of each face (Minecraft's FaceInfo): counter-clockwise from the front, starting at the
 * corner that takes (u1, v1). Entries pick min (0) or max (1) per axis.
 */
const FACE_CORNERS: Record<Dir, [number, number, number][]> = {
  down: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]],
  up: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]],
  north: [[1, 1, 0], [1, 0, 0], [0, 0, 0], [0, 1, 0]],
  south: [[0, 1, 1], [0, 0, 1], [1, 0, 1], [1, 1, 1]],
  west: [[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]],
  east: [[1, 1, 1], [1, 0, 1], [1, 0, 0], [1, 1, 0]],
};

/** Corner i (0..3) of the face of a box (block units). */
export function faceCorner(dir: Dir, i: number, min: Vec3, max: Vec3): Vec3 {
  const c = FACE_CORNERS[dir][i];
  return [c[0] ? max[0] : min[0], c[1] ? max[1] : min[1], c[2] ? max[2] : min[2]];
}

/** The texture area a face shows when the model gives no "uv" (projection of the box, 1/16 units). */
export function defaultFaceUv(dir: Dir, from: Vec3, to: Vec3): UV4 {
  switch (dir) {
    case 'down':
      return [from[0], 16 - to[2], to[0], 16 - from[2]];
    case 'up':
      return [from[0], from[2], to[0], to[2]];
    case 'north':
      return [16 - to[0], 16 - to[1], 16 - from[0], 16 - from[1]];
    case 'south':
      return [from[0], 16 - to[1], to[0], 16 - from[1]];
    case 'west':
      return [from[2], 16 - to[1], to[2], 16 - from[1]];
    case 'east':
      return [16 - to[2], 16 - to[1], 16 - from[2], 16 - from[1]];
  }
}

/** UV of corner i for a face uv rectangle rotated by `rotation` degrees (Minecraft's BlockFaceUV). */
export function cornerUv(uv: UV4, rotation: number, i: number): Vec2 {
  const s = (i + Math.round(rotation / 90)) % 4;
  return [s === 0 || s === 1 ? uv[0] : uv[2], s === 0 || s === 3 ? uv[1] : uv[3]];
}

export function normRotation(r: unknown): 0 | 90 | 180 | 270 {
  const n = typeof r === 'number' && Number.isFinite(r) ? ((Math.round(r / 90) * 90) % 360 + 360) % 360 : 0;
  return n as 0 | 90 | 180 | 270;
}

/** Axis-aligned bounds of a set of quads (a unit block when empty). */
export function quadBounds(quads: readonly BakedQuad[]): Bounds {
  if (!quads.length) return { min: [0, 0, 0], max: [1, 1, 1] };
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const q of quads)
    for (const p of q.positions)
      for (let a = 0; a < 3; a++) {
        if (p[a] < min[a]) min[a] = p[a];
        if (p[a] > max[a]) max[a] = p[a];
      }
  return { min, max };
}

/** Builds an axis-aligned box's faces (block units) — used by engine-defined shapes. */
export function boxQuads(
  from: Vec3,
  to: Vec3,
  faces: Partial<Record<Dir, { texture: string | null; ref: string; role: string; uv?: UV4; rotation?: number; tint?: Tint | null; tintMask?: boolean }>>,
  opts: { part?: number; element?: number; offset?: Vec3; rotateY?: number } = {},
): BakedQuad[] {
  const out: BakedQuad[] = [];
  const min: Vec3 = [from[0] / 16, from[1] / 16, from[2] / 16];
  const max: Vec3 = [to[0] / 16, to[1] / 16, to[2] / 16];
  const off = opts.offset ?? [0, 0, 0];
  const m = opts.rotateY ? rotY(-opts.rotateY) : IDENTITY;
  for (const dir of DIRS) {
    const f = faces[dir];
    if (!f) continue;
    const uv = f.uv ?? defaultFaceUv(dir, from, to);
    const rot = normRotation(f.rotation);
    const positions = [0, 1, 2, 3].map((i) => {
      const p = rotateAbout(faceCorner(dir, i, min, max), [0.5, 0.5, 0.5], m);
      return [snap(p[0] + off[0]), snap(p[1] + off[1]), snap(p[2] + off[2])] as Vec3;
    }) as BakedQuad['positions'];
    const uvs = [0, 1, 2, 3].map((i) => cornerUv(uv, rot, i)) as BakedQuad['uvs'];
    const normal = apply(m, DIR_VEC[dir]);
    out.push({
      positions,
      uvs,
      normal,
      dir,
      worldDir: nearestDir(normal),
      texture: f.texture,
      ref: f.ref,
      role: f.role,
      tintindex: f.tint ? 0 : -1,
      tint: f.tint ?? null,
      tintMask: f.tintMask,
      shade: true,
      part: opts.part ?? 0,
      element: opts.element ?? 0,
    });
  }
  return out;
}
