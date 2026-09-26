// Blocky cloud layer drifting below the floating island. Pure geometry generation.

export interface CloudData {
  positions: Float32Array;
  normals: Float32Array;
  /** Per-vertex x of the owning cell centre (the shader wraps whole cells as they drift) */
  centers: Float32Array;
  indices: Uint16Array | Uint32Array;
  /** Width of the wrapped band in world units */
  period: number;
}

function hash2(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smoothNoise(x: number, y: number, scale: number, seed: number): number {
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

export interface CloudOptions {
  seed?: number;
  /** Cell size in blocks */
  cell?: number;
  /** Cells across (the band is cell * cells wide, centred on the origin) */
  cells?: number;
  /** Height of the cloud bottoms */
  y?: number;
  thickness?: number;
  /** 0..1 fraction of cells that hold cloud */
  coverage?: number;
}

export function buildClouds(opts: CloudOptions = {}): CloudData {
  const seed = opts.seed ?? 11;
  const cell = opts.cell ?? 6;
  const n = opts.cells ?? 26;
  const y0 = opts.y ?? -24;
  const th = opts.thickness ?? 2.5;
  const coverage = opts.coverage ?? 0.34;
  const filled = (i: number, j: number): boolean => {
    if (i < 0 || j < 0 || i >= n || j >= n) return false;
    const v = smoothNoise(i, j, 3.2, seed) * 0.72 + hash2(i, j, seed + 5) * 0.28;
    return v > 1 - coverage - 0.16;
  };
  const pos: number[] = [];
  const nrm: number[] = [];
  const ctr: number[] = [];
  const idx: number[] = [];
  const half = (n * cell) / 2;
  const quad = (corners: number[][], normal: number[], cx: number) => {
    const base = pos.length / 3;
    for (const c of corners) {
      pos.push(c[0], c[1], c[2]);
      nrm.push(normal[0], normal[1], normal[2]);
      ctr.push(cx);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (!filled(i, j)) continue;
      const x0 = i * cell - half;
      const x1 = x0 + cell;
      const z0 = j * cell - half;
      const z1 = z0 + cell;
      const y1 = y0 + th;
      const cx = (x0 + x1) / 2;
      quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], cx);
      quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], cx);
      if (!filled(i + 1, j)) quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], cx);
      if (!filled(i - 1, j)) quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], cx);
      if (!filled(i, j + 1)) quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], cx);
      if (!filled(i, j - 1)) quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], cx);
    }
  }
  const count = pos.length / 3;
  return {
    positions: new Float32Array(pos),
    normals: new Float32Array(nrm),
    centers: new Float32Array(ctr),
    indices: count > 65535 ? new Uint32Array(idx) : new Uint16Array(idx),
    period: n * cell,
  };
}
