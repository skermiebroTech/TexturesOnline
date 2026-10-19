/**
 * Painting on models: rays against baked quads land on the texture and texel the face shows, for
 * synthetic boxes (default and rotated face UVs, overlays) and for real Java 26.3 blocks when the jar is
 * available (stone, a turned furnace with its lit state, stairs, the grass block overlay, a chest drawn
 * with its entity box UVs). Plus the brush footprint, mirroring and screen-independent helpers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boxQuads, type BakedQuad, type Vec3 } from '../../src/shared/models/geometry';
import { brushTexels, coplanarLifts, mirrorTexels, pointForUv, quadTexelRect, quadUvRect, raycastQuads, texelAt, texelSteps } from '../../src/shared/models/model-paint';
import { bakeEntityModel, cube, mat4Scale } from '../../src/shared/models/entity-models';
import { loadModelLibrary, type BlockState, type ModelLibrary } from '../../src/shared/models/index';
import { javaJarAssets } from '../tools/models/fixtures';

const T = 'assets/minecraft/textures/';
const face = (texture: string, extra: Record<string, unknown> = {}) => ({ texture, ref: texture, role: 'all', ...extra });

/** The texture and texel a ray from `from` going `dir` paints, for a texture of `size`. */
function paintAt(quads: BakedQuad[], from: Vec3, dir: Vec3, size: [number, number] = [16, 16]) {
  const hit = raycastQuads(quads, from, dir);
  if (!hit) return null;
  const q = quads[hit.index];
  const t = texelAt(q, hit.uv, size[0], size[1]);
  return { texture: q.texture, x: t.x, y: t.y, dir: q.worldDir, point: hit.point };
}

const down: Vec3 = [0, -1, 0];
const towardsSouth: Vec3 = [0, 0, 1]; // looks at the north face
const towardsNorth: Vec3 = [0, 0, -1]; // looks at the south face

// ------------------------------------------------------------------------------------------ synthetic

test('raycast: a full cube maps each face with the game default UVs', () => {
  const all = Object.fromEntries(['down', 'up', 'north', 'south', 'west', 'east'].map((d) => [d, face(`${d}.png`)]));
  const quads = boxQuads([0, 0, 0], [16, 16, 16], all);
  // south face: u = x, v = 1 - y
  assert.deepEqual(paintAt(quads, [0.25, 0.75, 5], towardsNorth), { texture: 'south.png', x: 4, y: 4, dir: 'south', point: [0.25, 0.75, 1] });
  // north face, seen from the north: u runs east to west
  const n = paintAt(quads, [0.25, 0.5, -5], towardsSouth)!;
  assert.equal(n.texture, 'north.png');
  assert.deepEqual([n.x, n.y], [12, 8]);
  // top: u = x, v = z
  const u = paintAt(quads, [0.3, 5, 0.6], down)!;
  assert.deepEqual([u.texture, u.x, u.y], ['up.png', 4, 9]);
  // east face: u = 1 - z
  const e = paintAt(quads, [5, 0.9, 0.2], [-1, 0, 0])!;
  assert.deepEqual([e.texture, e.x, e.y], ['east.png', 12, 1]);
  // behind a face: the ray from inside doesn't hit back faces (the 3D view draws front faces only)
  assert.equal(raycastQuads(quads, [0.5, 0.5, 0.5], towardsNorth)?.index !== undefined, false);
});

test('raycast: rotated face UVs turn the texture clockwise', () => {
  const quads = boxQuads([0, 0, 0], [16, 16, 16], { up: face('up.png', { uv: [0, 0, 16, 16], rotation: 90 }) });
  // rotation 90: the texture's top-left corner sits at the north-east corner of the top face
  const ne = paintAt(quads, [0.97, 5, 0.03], down)!;
  assert.deepEqual([ne.x, ne.y], [0, 0]);
  const at = paintAt(quads, [0.9, 5, 0.1], down)!;
  assert.deepEqual([at.x, at.y], [1, 1]);
  const sw = paintAt(quads, [0.03, 5, 0.97], down)!;
  assert.deepEqual([sw.x, sw.y], [15, 15]);
  const r180 = boxQuads([0, 0, 0], [16, 16, 16], { up: face('up.png', { uv: [0, 0, 16, 16], rotation: 180 }) });
  const t180 = paintAt(r180, [0.03, 5, 0.03], down)!;
  assert.deepEqual([t180.x, t180.y], [15, 15]);
});

test('raycast: partial faces keep to their own texels; flipped UVs mirror', () => {
  // a slab's side shows the bottom half of the texture
  const slab = boxQuads([0, 0, 0], [16, 8, 16], { south: face('side.png') });
  const s = slab[0];
  assert.deepEqual(quadTexelRect(s, 16, 16), { x: 0, y: 8, w: 16, h: 8 });
  // a ray at the very top edge of the slab still paints row 8, not row 7
  const top = raycastQuads(slab, [0.5, 0.49999, 5], towardsNorth)!;
  assert.equal(texelAt(s, [top.uv[0], 0.4999], 16, 16).y, 8);
  // an HD texture: the same point lands on the matching texel of 32x32
  const hd = paintAt(slab, [0.25, 0.25, 5], towardsNorth, [32, 32])!;
  assert.deepEqual([hd.x, hd.y], [8, 24]);
  // uv given right to left mirrors the face
  const flipped = boxQuads([0, 0, 0], [16, 16, 16], { south: face('s.png', { uv: [16, 0, 0, 16] }) });
  const f = paintAt(flipped, [0.1, 0.9, 5], towardsNorth)!;
  assert.deepEqual([f.x, f.y], [14, 1]);
});

test('raycast: a coplanar overlay is hit first, and a see-through texel lets the ray through', () => {
  const quads = [...boxQuads([0, 0, 0], [16, 16, 16], { south: face('side.png') }), ...boxQuads([0, 0, 0], [16, 16, 16], { south: face('overlay.png') })];
  assert.deepEqual(coplanarLifts(quads), [0, 0.0012]);
  assert.equal(paintAt(quads, [0.5, 0.95, 5], towardsNorth)!.texture, 'overlay.png');
  // the overlay is transparent below its top rows
  const opaque = (_h: unknown, q: BakedQuad) => q.texture !== 'overlay.png';
  const hit = raycastQuads(quads, [0.5, 0.2, 5], towardsNorth, { accept: opaque })!;
  assert.equal(quads[hit.index].texture, 'side.png');
});

test('raycast: entity box UVs land in the face patch of the sheet', () => {
  // A 8x8x8 head at texture offset (0, 0) of a 64x32 sheet, posed like a mob facing south (entity
  // models have y down; the renderer turns them over): the face is u 8..16, v 8..16, the top u 8..16, v 0..8.
  const quads = bakeEntityModel({ texSize: [64, 32], parts: [{ name: 'head', cubes: [cube(0, 0, -4, -8, -4, 8, 8, 8)] }] }, mat4Scale(1, -1, -1), { texture: 'mob.png', role: 'head' });
  assert.ok(quads.every((q) => q.boxUv));
  const front = paintAt(quads, [0, 0.25, 5], towardsNorth, [64, 32])!;
  assert.equal(front.dir, 'south');
  assert.ok(front.x >= 8 && front.x < 16 && front.y >= 8 && front.y < 16, `${front.x}, ${front.y}`);
  // the face's left column, seen from the front, is the mob's right (the -x side)
  assert.equal(paintAt(quads, [-0.2, 0.25, 5], towardsNorth, [64, 32])!.x, 8);
  assert.equal(paintAt(quads, [0.2, 0.25, 5], towardsNorth, [64, 32])!.x, 15);
  const top = paintAt(quads, [0, 5, 0], down, [64, 32])!;
  assert.ok(top.x >= 8 && top.x < 16 && top.y >= 0 && top.y < 8, `${top.x}, ${top.y}`);
  // a patch's last texel at the face edge stays in the patch
  const edge = raycastQuads(quads, [0.2499, 0.25, 5], towardsNorth)!;
  const r = quadTexelRect(quads[edge.index], 64, 32);
  const t = texelAt(quads[edge.index], edge.uv, 64, 32);
  assert.ok(t.x >= r.x && t.x < r.x + r.w);
});

test('texture point back to the face: pointForUv inverts the ray mapping', () => {
  const quads = boxQuads([0, 0, 0], [16, 16, 16], { up: face('up.png', { rotation: 270 }), north: face('n.png') });
  for (const q of quads) {
    const p = pointForUv(q, [(5 + 0.5) / 16, (11 + 0.5) / 16])!;
    const n = q.normal;
    const hit = raycastQuads([q], [p[0] + n[0] * 3, p[1] + n[1] * 3, p[2] + n[2] * 3], [-n[0], -n[1], -n[2]])!;
    const t = texelAt(q, hit.uv, 16, 16);
    assert.deepEqual([t.x, t.y], [5, 11], q.dir);
  }
});

test('brush footprint, mirror and stroke steps', () => {
  assert.deepEqual(brushTexels(4.5, 4.5, 1, false, 16, 16), [4 * 16 + 4]);
  // odd sizes centre on the texel, even sizes on its nearest corner (like the pixel editor's pencil)
  assert.deepEqual(brushTexels(4.5, 4.5, 3, false, 16, 16).sort((a, b) => a - b), [51, 52, 53, 67, 68, 69, 83, 84, 85]);
  assert.deepEqual(brushTexels(4.9, 4.9, 2, false, 16, 16).sort((a, b) => a - b), [68, 69, 84, 85]);
  assert.equal(brushTexels(8.5, 8.5, 5, true, 16, 16).length, 21);
  // clipped to a face patch and to the image
  assert.deepEqual(brushTexels(0.5, 0.5, 3, false, 16, 16), [0, 1, 16, 17]);
  assert.deepEqual(brushTexels(8.5, 8.5, 3, false, 64, 32, { x: 8, y: 8, w: 8, h: 8 }).sort((a, b) => a - b), [8 * 64 + 8, 8 * 64 + 9, 9 * 64 + 8, 9 * 64 + 9]);
  assert.deepEqual(mirrorTexels([0, 17], 16, 16, true, false).sort((a, b) => a - b), [15, 30]);
  assert.deepEqual(mirrorTexels([0], 16, 16, true, true).sort((a, b) => a - b), [15, 240, 255]);
  assert.deepEqual(mirrorTexels([7], 15, 1, true, false), []);
  const steps = texelSteps({ fx: 1, fy: 1 }, { fx: 4, fy: 1 });
  assert.equal(steps.length, 6);
  assert.deepEqual(steps[steps.length - 1], [4, 1]);
  assert.deepEqual(quadUvRect(boxQuads([0, 0, 0], [16, 16, 16], { up: face('u', { uv: [12, 4, 2, 10] }) })[0]), [2 / 16, 4 / 16, 12 / 16, 10 / 16]);
});

// ------------------------------------------------------------------------------------------ real models (26.3 jar)

const V = '26.3';
const has = !!javaJarAssets(V);
const SKIP = `Minecraft ${V} jar not found (set TO_FIXTURES)`;
let libP: Promise<ModelLibrary> | null = null;
const lib = () => (libP ??= loadModelLibrary(javaJarAssets(V)!));
async function quadsOf(id: string, state: BlockState = {}): Promise<BakedQuad[]> {
  const l = await lib();
  const e = l.block(id);
  assert.ok(e, id);
  return l.resolve(e, { ...l.defaultState(e), ...state }).quads;
}

test('26.3 models: stone, a furnace (lit, turned), stairs and the grass block overlay', { skip: !has && SKIP }, async () => {
  const stone = await quadsOf('stone');
  assert.deepEqual(paintAt(stone, [0.25, 0.75, 5], towardsNorth)?.texture, `${T}block/stone.png`);

  const furnace = await quadsOf('furnace');
  const front = paintAt(furnace, [0.25, 0.5, -5], towardsSouth)!;
  assert.equal(front.texture, `${T}block/furnace_front.png`);
  assert.deepEqual([front.x, front.y], [12, 8]);
  assert.equal(paintAt(furnace, [5, 0.5, 0.5], [-1, 0, 0])!.texture, `${T}block/furnace_side.png`);
  assert.equal(paintAt(furnace, [0.5, 5, 0.5], down)!.texture, `${T}block/furnace_top.png`);
  const lit = await quadsOf('furnace', { lit: 'true' });
  assert.equal(paintAt(lit, [0.25, 0.5, -5], towardsSouth)!.texture, `${T}block/furnace_front_on.png`);
  // facing east: the front turns to +x and shows the same texel layout there
  const east = await quadsOf('furnace', { facing: 'east' });
  const ef = paintAt(east, [5, 0.5, 0.25], [-1, 0, 0])!;
  assert.equal(ef.texture, `${T}block/furnace_front.png`);
  assert.deepEqual([ef.x, ef.y], [12, 8]);

  // stairs (facing east, bottom): the low step's top at y 0.5 on the west half, the high step's top at y 1
  const stairs = await quadsOf('oak_stairs', { facing: 'east', half: 'bottom', shape: 'straight' });
  const low = paintAt(stairs, [0.25, 5, 0.5], down)!;
  assert.equal(low.texture, `${T}block/oak_planks.png`);
  assert.ok(Math.abs(low.point[1] - 0.5) < 1e-3, `low step at ${low.point[1]}`);
  assert.deepEqual([low.x, low.y], [4, 8]);
  const high = paintAt(stairs, [0.75, 5, 0.5], down)!;
  assert.ok(Math.abs(high.point[1] - 1) < 1e-2, `high step at ${high.point[1]}`);
  assert.deepEqual([high.x, high.y], [12, 8]);
  // the riser between the steps faces west
  const riser = paintAt(stairs, [-5, 0.75, 0.5], [1, 0, 0])!;
  assert.ok(Math.abs(riser.point[0] - 0.5) < 1e-3, `riser at x ${riser.point[0]}`);
  assert.equal(riser.dir, 'west');

  // grass block: the tinted overlay's top rows take paint; below them, the plain side
  const grass = await quadsOf('grass_block');
  const over = paintAt(grass, [0.5, 0.97, 5], towardsNorth)!;
  assert.equal(over.texture, `${T}block/grass_block_side_overlay.png`);
  assert.deepEqual([over.x, over.y], [8, 0]);
  const side = raycastQuads(grass, [0.5, 0.3, 5], towardsNorth, { accept: (_h, q) => !q.texture?.endsWith('_overlay.png') })!;
  assert.equal(grass[side.index].texture, `${T}block/grass_block_side.png`);
});

test('26.3 models: a chest maps the lid front, lock and sides to their patches of the 64x64 sheet', { skip: !has && SKIP }, async () => {
  const chest = await quadsOf('chest', { facing: 'north', type: 'single' });
  const sheet = `${T}entity/chest/normal.png`;
  assert.ok(chest.every((q) => q.texture === sheet && q.boxUv));
  // Facing north, the front (with the latch) faces -z. The lid box is texture offset (0, 0), 14 x 5 x
  // 14: its front is the fourth patch of the box unwrap, u 42..56, v 14..19 (where the sheet draws the
  // latch's shadow); the base (offset 0, 19, 10 high) has its front at u 42..56, v 33..43.
  const lid = paintAt(chest, [0.3, 12 / 16, -5], towardsSouth, [64, 64])!;
  assert.ok(lid.x >= 42 && lid.x < 56 && lid.y >= 14 && lid.y < 19, `lid front at ${lid.x}, ${lid.y}`);
  // seen from the front, the chest's left (west, x 0.3) is the patch's left
  assert.ok(lid.x < 49, `${lid.x}`);
  const base = paintAt(chest, [0.3, 4 / 16, -5], towardsSouth, [64, 64])!;
  assert.ok(base.x >= 42 && base.x < 56 && base.y >= 33 && base.y < 43, `base front at ${base.x}, ${base.y}`);
  // the latch sticks out in front of the lid: offset (0, 0), 2 x 4 x 1, its front at u 4..6, v 1..5
  const lock = paintAt(chest, [0.5, 8.5 / 16, -5], towardsSouth, [64, 64])!;
  assert.ok(lock.x >= 4 && lock.x < 6 && lock.y >= 1 && lock.y < 5, `latch at ${lock.x}, ${lock.y}`);
  // the lid's outer top is u 28..42, v 0..14 (its underside, dark, is u 14..28)
  const top = paintAt(chest, [0.5, 5, 0.5], down, [64, 64])!;
  assert.ok(top.x >= 28 && top.x < 42 && top.y >= 0 && top.y < 14, `lid top at ${top.x}, ${top.y}`);
});
