// Voxel diorama generation + meshing for the shader preview. Pure logic (no three.js, no DOM).

export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WATER: 5,
  LOG: 6,
  LEAVES: 7,
  COBBLESTONE: 8,
  GRAVEL: 9,
  SHORT_GRASS: 10,
  POPPY: 11,
  DANDELION: 12,
  CORNFLOWER: 13,
  TORCH: 14,
} as const;
export type BlockId = (typeof BLOCK)[keyof typeof BLOCK];

export type TextureSlot =
  | 'grass_top' | 'grass_side' | 'dirt' | 'stone' | 'cobblestone' | 'gravel' | 'sand' | 'water'
  | 'log' | 'log_top' | 'leaves' | 'short_grass' | 'poppy' | 'dandelion' | 'cornflower' | 'torch';

export const TEXTURE_SLOTS: readonly TextureSlot[] = [
  'grass_top', 'grass_side', 'dirt', 'stone', 'cobblestone', 'gravel', 'sand', 'water',
  'log', 'log_top', 'leaves', 'short_grass', 'poppy', 'dandelion', 'cornflower', 'torch',
];

/** solid = opaque cube faces, cutout = alpha-tested cube faces (leaves), plant = crossed quads, torch = small emissive box */
export type MeshKind = 'solid' | 'cutout' | 'plant' | 'torch' | 'water';

export interface MeshData {
  slot: TextureSlot;
  kind: MeshKind;
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  /** Per-vertex ambient occlusion, 0..1 (1 = fully open) */
  ao: Float32Array;
  /** Per-vertex flags: 0 none, 1 leaves (whole vertex sways), 2 plant top, 3 water surface, 4 underwater face */
  wave: Float32Array;
  /** Water only: water depth below the surface at each vertex, in blocks */
  depth?: Float32Array;
  indices: Uint16Array | Uint32Array;
}

export interface DioramaData {
  meshes: MeshData[];
  /** Flame positions of torches, world space */
  torches: [number, number, number][];
  /** World-space axis-aligned bounds of all geometry */
  bounds: { min: [number, number, number]; max: [number, number, number] };
  /** World-space height of the water surface */
  waterLevel: number;
}

export const WATER_SURFACE = 0.875;

export class VoxelWorld {
  readonly blocks: Uint8Array;
  constructor(readonly sx: number, readonly sy: number, readonly sz: number) {
    this.blocks = new Uint8Array(sx * sy * sz);
  }
  inside(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz;
  }
  get(x: number, y: number, z: number): number {
    if (!this.inside(x, y, z)) return BLOCK.AIR;
    return this.blocks[(y * this.sz + z) * this.sx + x];
  }
  set(x: number, y: number, z: number, b: number): void {
    if (!this.inside(x, y, z)) return;
    this.blocks[(y * this.sz + z) * this.sx + x] = b;
  }
  /** Highest non-air, non-plant block in a column, or -1 */
  surface(x: number, z: number): number {
    for (let y = this.sy - 1; y >= 0; y--) {
      const b = this.get(x, y, z);
      if (b !== BLOCK.AIR && !isPlant(b) && b !== BLOCK.TORCH) return y;
    }
    return -1;
  }
}

export function isOpaque(b: number): boolean {
  return b === BLOCK.GRASS || b === BLOCK.DIRT || b === BLOCK.STONE || b === BLOCK.SAND || b === BLOCK.LOG ||
    b === BLOCK.COBBLESTONE || b === BLOCK.GRAVEL;
}
export function isPlant(b: number): boolean {
  return b === BLOCK.SHORT_GRASS || b === BLOCK.POPPY || b === BLOCK.DANDELION || b === BLOCK.CORNFLOWER;
}
function occludes(b: number): boolean {
  return isOpaque(b) || b === BLOCK.LEAVES;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function noise2(x: number, y: number, scale: number, seed: number): number {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}

/** Island grid size (x, z) and vertical size */
export const DIORAMA_SIZE = 24;
const HEIGHT = 32;
/** y index of the base ground layer (its top face is world y = 0) */
const BASE = 14;

export interface DioramaLayout {
  world: VoxelWorld;
  torches: [number, number, number][];
}

/** Generates the island. Deterministic for a given seed. */
export function generateDiorama(seed = 7): DioramaLayout {
  const N = DIORAMA_SIZE;
  const w = new VoxelWorld(N, HEIGHT, N);
  const rnd = mulberry32(seed);
  const c = (N - 1) / 2;
  const pond = { x: 7.8, z: 15.0, rx: 4.4, rz: 3.3 };
  const tops: number[] = new Array(N * N).fill(-1);

  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      const dx = (x - c) / 11.9;
      const dz = (z - c) / 11.9;
      const p = 2.7;
      let d = Math.pow(Math.pow(Math.abs(dx), p) + Math.pow(Math.abs(dz), p), 1 / p);
      d += (noise2(x, z, 3.5, seed) - 0.5) * 0.18;
      if (d > 1) continue;

      const pdx = (x - pond.x) / pond.rx;
      const pdz = (z - pond.z) / pond.rz;
      const pd = Math.sqrt(pdx * pdx + pdz * pdz) + (noise2(x, z, 2.5, seed + 3) - 0.5) * 0.22;
      const nearPond = Math.min(1, Math.max(0, (pd - 1.4) / 1.4));

      const hill1 = 4.6 * Math.exp(-((x - 17) ** 2 + (z - 6.5) ** 2) / 22);
      const hill2 = 1.9 * Math.exp(-((x - 19.5) ** 2 + (z - 16.5) ** 2) / 9);
      const crag = 3.2 * Math.exp(-((x - 3.8) ** 2 + (z - 5.2) ** 2) / 5.5);
      let h = BASE + Math.round((hill1 + hill2 + crag) * nearPond + (noise2(x, z, 4, seed + 1) - 0.5) * 1.3 * nearPond);
      if (d > 0.93) h = Math.min(h, BASE);
      const isCrag = crag * nearPond > 0.9 && h > BASE;

      const bottom = BASE - 3 - Math.floor(Math.pow(Math.max(0, 1 - d), 0.6) * 9 + noise2(x, z, 2, seed + 5) * 2.6);
      const water = pd < 1;
      const beach = !water && pd < 1.55;

      if (water) {
        const floorTop = BASE - 1 - (pd < 0.62 ? 1 : 0) - (pd < 0.3 ? 1 : 0);
        for (let y = Math.max(1, bottom); y <= floorTop; y++) {
          let b: number = y >= floorTop - 1 ? BLOCK.DIRT : BLOCK.STONE;
          if (y === floorTop) b = pd > 0.62 ? BLOCK.SAND : hash2(x, z, seed + 9) < 0.5 ? BLOCK.GRAVEL : BLOCK.DIRT;
          w.set(x, y, z, b);
        }
        for (let y = floorTop + 1; y <= BASE; y++) w.set(x, y, z, BLOCK.WATER);
        tops[z * N + x] = floorTop;
        continue;
      }
      if (beach) h = BASE;

      for (let y = Math.max(1, bottom); y <= h; y++) {
        let b: number;
        if (isCrag) {
          b = y >= h - 1 && hash2(x * 7 + y, z, seed + 13) < 0.28 ? BLOCK.COBBLESTONE : BLOCK.STONE;
          if (y <= BASE - 1 && y >= BASE - 2) b = BLOCK.DIRT;
        } else if (beach) {
          b = y >= h - 1 ? BLOCK.SAND : y >= h - 3 ? BLOCK.DIRT : BLOCK.STONE;
        } else {
          b = y === h ? BLOCK.GRASS : y >= h - 2 ? BLOCK.DIRT : BLOCK.STONE;
        }
        if (b === BLOCK.STONE && y < BASE - 3 && hash2(x + y * 31, z, seed + 17) < 0.06) b = BLOCK.GRAVEL;
        w.set(x, y, z, b);
      }
      tops[z * N + x] = h;
    }
  }

  const trees: { x: number; z: number; trunk: number }[] = [
    { x: 17, z: 7, trunk: 6 },
    { x: 19, z: 17, trunk: 5 },
  ];
  for (const t of trees) {
    const g = w.surface(t.x, t.z);
    if (g < 0) continue;
    w.set(t.x, g, t.z, BLOCK.DIRT);
    const base = g + 1;
    const top = base + t.trunk - 1;
    const layers: { y: number; r: number; corners: 'none' | 'random' | 'all' }[] = [
      { y: top - 2, r: 2, corners: 'random' },
      { y: top - 1, r: 2, corners: 'random' },
      { y: top, r: 1, corners: 'random' },
      { y: top + 1, r: 1, corners: 'none' },
    ];
    for (const L of layers) {
      for (let dz = -L.r; dz <= L.r; dz++) {
        for (let dx = -L.r; dx <= L.r; dx++) {
          const corner = Math.abs(dx) === L.r && Math.abs(dz) === L.r;
          if (corner && (L.corners === 'none' || (L.corners === 'random' && rnd() < 0.55))) continue;
          if (w.get(t.x + dx, L.y, t.z + dz) === BLOCK.AIR) w.set(t.x + dx, L.y, t.z + dz, BLOCK.LEAVES);
        }
      }
    }
    for (let y = base; y <= top; y++) w.set(t.x, y, t.z, BLOCK.LOG);
  }

  const torches: [number, number, number][] = [];
  const torchSpots: [number, number][] = [[13, 19], [7, 9]];
  for (const [x, z] of torchSpots) {
    const g = w.surface(x, z);
    if (g < 0 || w.get(x, g, z) === BLOCK.WATER) continue;
    w.set(x, g + 1, z, BLOCK.TORCH);
    torches.push([x, g + 1, z]);
  }

  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      const g = w.surface(x, z);
      if (g < 0 || w.get(x, g, z) !== BLOCK.GRASS || w.get(x, g + 1, z) !== BLOCK.AIR) continue;
      const r = hash2(x, z, seed + 23);
      const clump = noise2(x, z, 3, seed + 29);
      let plant = 0;
      if (r < 0.1 * clump + 0.02) plant = r < 0.035 ? BLOCK.POPPY : r < 0.06 ? BLOCK.DANDELION : BLOCK.CORNFLOWER;
      else if (r < 0.22 + clump * 0.35) plant = BLOCK.SHORT_GRASS;
      if (plant) w.set(x, g + 1, z, plant);
    }
  }
  return { world: w, torches };
}

// ---- Meshing ----

class MeshBuilder {
  pos: number[] = [];
  nrm: number[] = [];
  uv: number[] = [];
  ao: number[] = [];
  wave: number[] = [];
  depth: number[] = [];
  idx: number[] = [];
  constructor(readonly slot: TextureSlot, readonly kind: MeshKind) {}
  vertex(p: [number, number, number], n: [number, number, number], uv: [number, number], ao: number, wave: number, depth = 0): number {
    const i = this.pos.length / 3;
    this.pos.push(p[0], p[1], p[2]);
    this.nrm.push(n[0], n[1], n[2]);
    this.uv.push(uv[0], uv[1]);
    this.ao.push(ao);
    this.wave.push(wave);
    if (this.kind === 'water') this.depth.push(depth);
    return i;
  }
  build(): MeshData | null {
    const count = this.pos.length / 3;
    if (!count) return null;
    return {
      slot: this.slot,
      kind: this.kind,
      positions: new Float32Array(this.pos),
      normals: new Float32Array(this.nrm),
      uvs: new Float32Array(this.uv),
      ao: new Float32Array(this.ao),
      wave: new Float32Array(this.wave),
      depth: this.kind === 'water' ? new Float32Array(this.depth) : undefined,
      indices: count > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx),
    };
  }
}

type Vec3 = [number, number, number];
interface FaceDef {
  dir: Vec3;
  corners: Vec3[];
  uvs: [number, number][];
}
// Corners are listed counter-clockwise seen from outside; uv v = 1 is the texture's top row.
const FACES: Record<'east' | 'west' | 'up' | 'down' | 'south' | 'north', FaceDef> = {
  east: { dir: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  west: { dir: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  south: { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  north: { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  up: { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  down: { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]] },
};
const FACE_LIST = Object.entries(FACES) as [keyof typeof FACES, FaceDef][];
const AO_CURVE = [0.42, 0.62, 0.81, 1];

function slotFor(b: number, face: keyof typeof FACES): TextureSlot {
  switch (b) {
    case BLOCK.GRASS: return face === 'up' ? 'grass_top' : face === 'down' ? 'dirt' : 'grass_side';
    case BLOCK.DIRT: return 'dirt';
    case BLOCK.STONE: return 'stone';
    case BLOCK.SAND: return 'sand';
    case BLOCK.LOG: return face === 'up' || face === 'down' ? 'log_top' : 'log';
    case BLOCK.LEAVES: return 'leaves';
    case BLOCK.COBBLESTONE: return 'cobblestone';
    case BLOCK.GRAVEL: return 'gravel';
    case BLOCK.WATER: return 'water';
    case BLOCK.SHORT_GRASS: return 'short_grass';
    case BLOCK.POPPY: return 'poppy';
    case BLOCK.DANDELION: return 'dandelion';
    case BLOCK.CORNFLOWER: return 'cornflower';
    default: return 'torch';
  }
}

function vertexAO(w: VoxelWorld, x: number, y: number, z: number, f: FaceDef, corner: Vec3): number {
  const n = f.dir;
  const axis = n[0] !== 0 ? 0 : n[1] !== 0 ? 1 : 2;
  const t1 = (axis + 1) % 3;
  const t2 = (axis + 2) % 3;
  const base: Vec3 = [x + n[0], y + n[1], z + n[2]];
  const s1: Vec3 = [0, 0, 0];
  const s2: Vec3 = [0, 0, 0];
  s1[t1] = corner[t1] ? 1 : -1;
  s2[t2] = corner[t2] ? 1 : -1;
  const a = occludes(w.get(base[0] + s1[0], base[1] + s1[1], base[2] + s1[2])) ? 1 : 0;
  const b = occludes(w.get(base[0] + s2[0], base[1] + s2[1], base[2] + s2[2])) ? 1 : 0;
  const cc = occludes(w.get(base[0] + s1[0] + s2[0], base[1] + s1[1] + s2[1], base[2] + s1[2] + s2[2])) ? 1 : 0;
  const level = a && b ? 0 : 3 - (a + b + cc);
  return AO_CURVE[level];
}

/**
 * Builds render meshes (one per texture slot and kind) for a world.
 * `offset` is added to every vertex so the scene can be centred.
 */
export function meshWorld(w: VoxelWorld, offset: Vec3 = [0, 0, 0], seed = 7): MeshData[] {
  const builders = new Map<string, MeshBuilder>();
  const get = (slot: TextureSlot, kind: MeshKind): MeshBuilder => {
    const key = `${kind}:${slot}`;
    let mb = builders.get(key);
    if (!mb) builders.set(key, (mb = new MeshBuilder(slot, kind)));
    return mb;
  };

  const waterDepth = (x: number, z: number): number => {
    let top = -1;
    let floor = -1;
    for (let y = w.sy - 1; y >= 0; y--) {
      const b = w.get(x, y, z);
      if (b === BLOCK.WATER && top < 0) top = y;
      if (top >= 0 && b !== BLOCK.WATER) {
        floor = y;
        break;
      }
    }
    if (top < 0) return 0;
    return top + WATER_SURFACE - (floor + 1);
  };
  const depthCache = new Map<number, number>();
  const cornerDepth = (cx: number, cz: number): number => {
    const key = cz * 1000 + cx;
    const hit = depthCache.get(key);
    if (hit !== undefined) return hit;
    let sum = 0;
    let n = 0;
    for (const [ox, oz] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
      sum += waterDepth(cx + ox, cz + oz);
      n++;
    }
    const v = sum / n;
    depthCache.set(key, v);
    return v;
  };

  for (let y = 0; y < w.sy; y++) {
    for (let z = 0; z < w.sz; z++) {
      for (let x = 0; x < w.sx; x++) {
        const b = w.get(x, y, z);
        if (b === BLOCK.AIR) continue;

        if (isPlant(b)) {
          const mb = get(slotFor(b, 'up'), 'plant');
          const jx = (hash2(x, z, seed + 41) - 0.5) * 0.36;
          const jz = (hash2(z, x, seed + 43) - 0.5) * 0.36;
          const lo = 0.05;
          const hi = 0.95;
          const planes: [number, number, number, number][] = [
            [lo, lo, hi, hi],
            [lo, hi, hi, lo],
          ];
          for (const [ax, az, bx, bz] of planes) {
            const p = (px: number, py: number, pz: number): Vec3 => [x + px + jx + offset[0], y + py + offset[1], z + pz + jz + offset[2]];
            const up: Vec3 = [0, 1, 0];
            const i0 = mb.vertex(p(ax, 0, az), up, [0, 0], 0.72, 0);
            const i1 = mb.vertex(p(bx, 0, bz), up, [1, 0], 0.72, 0);
            const i2 = mb.vertex(p(bx, 1, bz), up, [1, 1], 1, 2);
            const i3 = mb.vertex(p(ax, 1, az), up, [0, 1], 1, 2);
            mb.idx.push(i0, i1, i2, i0, i2, i3);
          }
          continue;
        }

        if (b === BLOCK.TORCH) {
          const mb = get('torch', 'torch');
          const x0 = 7 / 16;
          const x1 = 9 / 16;
          const y1 = 10 / 16;
          const box = (px: number, py: number, pz: number): Vec3 => [
            x + x0 + px * (x1 - x0) + offset[0],
            y + py * y1 + offset[1],
            z + x0 + pz * (x1 - x0) + offset[2],
          ];
          for (const [name, f] of FACE_LIST) {
            let uvs: [number, number][];
            if (name === 'up') uvs = [[7 / 16, 8 / 16], [9 / 16, 8 / 16], [9 / 16, 10 / 16], [7 / 16, 10 / 16]];
            else if (name === 'down') uvs = [[7 / 16, 1 / 16], [9 / 16, 1 / 16], [9 / 16, 3 / 16], [7 / 16, 3 / 16]];
            else uvs = [[7 / 16, 0], [9 / 16, 0], [9 / 16, 10 / 16], [7 / 16, 10 / 16]];
            const ids = f.corners.map((cn, k) => mb.vertex(box(cn[0], cn[1], cn[2]), f.dir, uvs[k], 1, 0));
            mb.idx.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
          }
          continue;
        }

        if (b === BLOCK.WATER) {
          const mb = get('water', 'water');
          for (const [name, f] of FACE_LIST) {
            const nb = w.get(x + f.dir[0], y + f.dir[1], z + f.dir[2]);
            if (nb === BLOCK.WATER || isOpaque(nb)) continue;
            if (name === 'down') continue;
            if (name !== 'up' && nb !== BLOCK.AIR && !isPlant(nb)) continue;
            const ids = f.corners.map((cn, k) => {
              const cy = cn[1] === 1 ? WATER_SURFACE : cn[1];
              const d = name === 'up' ? cornerDepth(x + cn[0], z + cn[2]) : 1;
              return mb.vertex([x + cn[0] + offset[0], y + cy + offset[1], z + cn[2] + offset[2]], f.dir, f.uvs[k], 1, name === 'up' ? 3 : 0, d);
            });
            mb.idx.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
          }
          continue;
        }

        const leaves = b === BLOCK.LEAVES;
        for (const [name, f] of FACE_LIST) {
          const nb = w.get(x + f.dir[0], y + f.dir[1], z + f.dir[2]);
          if (isOpaque(nb)) continue;
          const mb = get(slotFor(b, name), leaves ? 'cutout' : 'solid');
          const ao = f.corners.map((cn) => vertexAO(w, x, y, z, f, cn));
          const wave = leaves ? 1 : nb === BLOCK.WATER ? 4 : 0;
          const ids = f.corners.map((cn, k) =>
            mb.vertex([x + cn[0] + offset[0], y + cn[1] + offset[1], z + cn[2] + offset[2]], f.dir, f.uvs[k], ao[k], wave),
          );
          if (ao[0] + ao[2] < ao[1] + ao[3]) mb.idx.push(ids[1], ids[2], ids[3], ids[1], ids[3], ids[0]);
          else mb.idx.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
        }
      }
    }
  }
  const out: MeshData[] = [];
  for (const mb of builders.values()) {
    const m = mb.build();
    if (m) out.push(m);
  }
  return out;
}

/** Generates and meshes the diorama, centred so the base ground surface is at y = 0. */
export function buildDiorama(seed = 7): DioramaData {
  const { world, torches } = generateDiorama(seed);
  const c = DIORAMA_SIZE / 2;
  const offset: Vec3 = [-c, -(BASE + 1), -c];
  const meshes = meshWorld(world, offset, seed);
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const m of meshes) {
    const p = m.positions;
    for (let i = 0; i < p.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        if (p[i + k] < min[k]) min[k] = p[i + k];
        if (p[i + k] > max[k]) max[k] = p[i + k];
      }
    }
  }
  return {
    meshes,
    torches: torches.map(([x, y, z]) => [x + 0.5 + offset[0], y + 0.68 + offset[1], z + 0.5 + offset[2]]),
    bounds: { min, max },
    waterLevel: BASE + WATER_SURFACE + offset[1],
  };
}
