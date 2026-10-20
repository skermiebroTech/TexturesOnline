// Start points for a model: an empty model, a full cube, a slab, a cross-shaped plant, and a 3D item
// made from the item's flat sprite (each opaque pixel becomes part of a 1-pixel-deep cube; runs of
// pixels are merged into rectangles to keep the number of cubes low). Each keeps the textures and
// display of the model it starts from. Pure.

import { DIRS, type Dir, type UV4, type Vec3 } from '../../../shared/models/geometry';
import { cloneModel, mainTextureVar, type EditElement, type EditFace, type EditModel } from './doc';

export type PresetId = 'blank' | 'cube' | 'slab' | 'cross' | 'sprite3d';

/** Texture variable for a side of a box, from the names vanilla templates use. */
export function varFor(m: EditModel, dir: Dir): string {
  const keys = Object.keys(m.textures);
  const pick = (...names: string[]) => names.find((n) => keys.includes(n));
  const side = pick('side', 'all', 'texture', 'front', 'cross', 'plant', 'layer0', 'top', 'end', 'particle');
  let v: string | undefined;
  if (dir === 'up') v = pick('top', 'up', 'end', 'all') ?? side;
  else if (dir === 'down') v = pick('bottom', 'down', 'end', 'all') ?? side;
  else if (dir === 'north') v = pick('front', 'north') ?? side;
  else v = pick(dir, 'side') ?? side;
  return v ? `#${v}` : mainTextureVar(m);
}

function base(from: EditModel): EditModel {
  const m = cloneModel(from);
  m.elements = [];
  return m;
}

export function blankModel(from: EditModel): EditModel {
  return base(from);
}

/** A box with every face, its texture variable per side and the cull faces of a full block side. */
export function boxElement(m: EditModel, from: Vec3, to: Vec3, cull: boolean): EditElement {
  const faces: Partial<Record<Dir, EditFace>> = {};
  for (const d of DIRS) {
    const touches = (d === 'down' && from[1] === 0) || (d === 'up' && to[1] === 16) || (d === 'north' && from[2] === 0) || (d === 'south' && to[2] === 16) || (d === 'west' && from[0] === 0) || (d === 'east' && to[0] === 16);
    faces[d] = { texture: varFor(m, d), ...(cull && touches ? { cullface: d } : {}) };
  }
  return { from, to, faces };
}

export function fullCube(from: EditModel): EditModel {
  const m = base(from);
  m.elements.push(boxElement(m, [0, 0, 0], [16, 16, 16], true));
  return m;
}

export function slab(from: EditModel): EditModel {
  const m = base(from);
  m.elements.push(boxElement(m, [0, 0, 0], [16, 8, 16], true));
  return m;
}

/** Two crossed planes, like flowers and saplings (vanilla block/cross). */
export function cross(from: EditModel): EditModel {
  const m = base(from);
  const t = varFor(m, 'north');
  const rot = { origin: [8, 8, 8] as Vec3, axis: 'y' as const, angle: 45, rescale: true };
  m.elements.push(
    { from: [0.8, 0, 8], to: [15.2, 16, 8], rotation: { ...rot, origin: [8, 8, 8] }, shade: false, faces: { north: { texture: t, uv: [0, 0, 16, 16] }, south: { texture: t, uv: [0, 0, 16, 16] } } },
    { from: [8, 0, 0.8], to: [8, 16, 15.2], rotation: { ...rot, origin: [8, 8, 8] }, shade: false, faces: { west: { texture: t, uv: [0, 0, 16, 16] }, east: { texture: t, uv: [0, 0, 16, 16] } } },
  );
  m.ambientOcclusion = false;
  return m;
}

// ---------------------------------------------------------------------------------------------
// 3D item from a sprite

export interface SpriteImage {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

export interface SpriteLayerInput {
  /** Texture variable, e.g. '#layer0' */
  texture: string;
  image: SpriteImage;
  /** tintindex the faces keep (generated items tint layer n with index n) */
  tintindex?: number;
}

/** Opaque pixel rectangles of the first frame, merged: runs along rows, then equal runs down columns. */
export function opaqueRects(img: SpriteImage): { x: number; y: number; w: number; h: number }[] {
  const w = img.width;
  const h = Math.min(img.height, img.width) || img.height;
  const solid = (x: number, y: number) => img.data[(y * img.width + x) * 4 + 3] > 0;
  const open = new Map<string, { x: number; y: number; w: number; h: number }>();
  const done: { x: number; y: number; w: number; h: number }[] = [];
  for (let y = 0; y < h; y++) {
    const runs: [number, number][] = [];
    for (let x = 0; x < w; ) {
      if (!solid(x, y)) {
        x++;
        continue;
      }
      const x0 = x;
      while (x < w && solid(x, y)) x++;
      runs.push([x0, x]);
    }
    const next = new Map<string, { x: number; y: number; w: number; h: number }>();
    for (const [x0, x1] of runs) {
      const key = `${x0}:${x1}`;
      const r = open.get(key);
      if (r) {
        r.h++;
        next.set(key, r);
        open.delete(key);
      } else next.set(key, { x: x0, y, w: x1 - x0, h: 1 });
    }
    done.push(...open.values());
    open.clear();
    for (const [k, v] of next) open.set(k, v);
  }
  done.push(...open.values());
  return done.sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Cubes of a sprite extruded `depth` pixels deep, centred like the game's flat items (z 7.5 - 8.5 for
 * one pixel). Faces hidden by a neighbouring opaque pixel along a whole edge are left out.
 */
export function spriteElements(layer: SpriteLayerInput, opts: { depth?: number; inflate?: number } = {}): EditElement[] {
  const img = layer.image;
  const w = img.width;
  const h = Math.min(img.height, img.width) || img.height;
  if (!w || !h) return [];
  const sx = 16 / w;
  const sy = 16 / h;
  const depth = Math.max(0.25, opts.depth ?? 1);
  const inflate = opts.inflate ?? 0;
  const z0 = 8 - depth / 2 - inflate;
  const z1 = 8 + depth / 2 + inflate;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && img.data[(y * img.width + x) * 4 + 3] > 0;
  const tint = layer.tintindex !== undefined && layer.tintindex >= 0 ? { tintindex: layer.tintindex } : {};
  const face = (uv: UV4): EditFace => ({ texture: layer.texture, uv: uv.map((v) => Math.round(v * 1e4) / 1e4) as UV4, ...tint });
  const out: EditElement[] = [];
  for (const r of opaqueRects(img)) {
    const u0 = r.x * sx;
    const u1 = (r.x + r.w) * sx;
    const v0 = r.y * sy;
    const v1 = (r.y + r.h) * sy;
    const faces: Partial<Record<Dir, EditFace>> = {
      south: face([u0, v0, u1, v1]),
      north: face([u1, v0, u0, v1]),
    };
    const coveredRow = (y: number) => Array.from({ length: r.w }, (_, k) => solid(r.x + k, y)).every(Boolean);
    const coveredCol = (x: number) => Array.from({ length: r.h }, (_, k) => solid(x, r.y + k)).every(Boolean);
    if (!coveredRow(r.y - 1)) faces.up = face([u0, v0, u1, v0 + sy]);
    if (!coveredRow(r.y + r.h)) faces.down = face([u0, v1 - sy, u1, v1]);
    if (!coveredCol(r.x - 1)) faces.west = face([u0, v0, u0 + sx, v1]);
    if (!coveredCol(r.x + r.w)) faces.east = face([u1 - sx, v0, u1, v1]);
    out.push({
      from: [u0 - inflate, 16 - v1 - inflate, z0],
      to: [u1 + inflate, 16 - v0 + inflate, z1],
      faces,
    });
  }
  return out;
}

/**
 * A 3D model of a flat item: every layer extruded (later layers a hair bigger so they sit on top, as
 * the game draws them), keeping the item's textures and its display (how it is held).
 */
export function spriteTo3d(from: EditModel, layers: SpriteLayerInput[], opts: { depth?: number } = {}): EditModel {
  const m = base(from);
  layers.forEach((l, i) => {
    m.elements.push(...spriteElements(l, { depth: opts.depth, inflate: i * 0.05 }));
  });
  if (!m.textures.particle && layers[0]) m.textures.particle = layers[0].texture;
  return m;
}
