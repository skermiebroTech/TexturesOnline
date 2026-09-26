import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AssetIndex } from '../../src/core/types';
import {
  PROCEDURAL_TEXTURE_NAMES, WATER_FRAMES, proceduralBlockFaces, proceduralTexture, toImageData,
} from '../../src/shared/preview/procedural-textures';
import {
  DEFAULT_FOLIAGE_TINT, DEFAULT_GRASS_TINT, compositeOverlay, firstFrame, loadSlotTextures, proceduralSlotTextures,
  sampleColormap, tintByAlphaMask, tintImage,
} from '../../src/shared/preview/preview-textures';
import { BLOCK, TEXTURE_SLOTS, WATER_SURFACE, buildDiorama, generateDiorama, isOpaque, meshWorld, VoxelWorld } from '../../src/shared/preview/voxel-world';

type Img = { width: number; height: number; data: Uint8ClampedArray };
const solid = (w: number, h: number, rgba: [number, number, number, number]): Img => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(rgba, i * 4);
  return { width: w, height: h, data };
};

test('procedural textures: sizes, determinism, alpha semantics', () => {
  for (const name of PROCEDURAL_TEXTURE_NAMES) {
    const a = proceduralTexture(name);
    const b = proceduralTexture(name);
    assert.equal(a.width, 16, name);
    assert.equal(a.height, name === 'water' ? 16 * WATER_FRAMES : 16, name);
    assert.equal(a.data.length, a.width * a.height * 4);
    assert.deepEqual(a.data, b.data, `${name} deterministic`);
    assert.notEqual(a.data, b.data, 'returns copies');
  }
  const alphaCount = (img: Img, pred: (a: number) => boolean) => {
    let n = 0;
    for (let i = 3; i < img.data.length; i += 4) if (pred(img.data[i])) n++;
    return n;
  };
  for (const opaque of ['grass_top', 'grass_side', 'dirt', 'stone', 'cobblestone', 'gravel', 'sand', 'oak_log', 'oak_log_top', 'oak_planks'] as const) {
    assert.equal(alphaCount(proceduralTexture(opaque), (a) => a !== 255), 0, `${opaque} opaque`);
  }
  const holes = alphaCount(proceduralTexture('oak_leaves'), (a) => a === 0);
  assert.ok(holes > 20 && holes < 160, `leaves have holes (${holes})`);
  for (const sprite of ['short_grass', 'poppy', 'dandelion', 'cornflower', 'torch'] as const) {
    const t = proceduralTexture(sprite);
    assert.ok(alphaCount(t, (a) => a === 0) > 100, `${sprite} mostly transparent`);
    assert.ok(alphaCount(t, (a) => a === 255) > 4, `${sprite} has pixels`);
  }
  // different seeds differ
  assert.notDeepEqual(proceduralTexture('stone', { seed: 1 }).data, proceduralTexture('stone', { seed: 2 }).data);
  const faces = proceduralBlockFaces('grass_block');
  assert.deepEqual(Object.keys(faces).sort(), ['down', 'east', 'north', 'south', 'up', 'west']);
  const id = toImageData(faces.up);
  assert.equal(id.width, 16);
  assert.equal(id.data.length, 1024);
});

test('image helpers: tint, overlay, alpha mask, frames, colormap', () => {
  const grey = solid(2, 2, [200, 200, 200, 255]);
  const t = tintImage(grey, [255, 128, 0]);
  assert.deepEqual([...t.data.slice(0, 4)], [200, 100, 0, 255]);

  const base = solid(2, 2, [100, 50, 20, 255]);
  const overlay = solid(1, 1, [255, 255, 255, 0]);
  assert.deepEqual([...compositeOverlay(base, overlay, [0, 255, 0]).data.slice(0, 4)], [100, 50, 20, 255], 'transparent overlay keeps base');
  overlay.data[3] = 255;
  assert.deepEqual([...compositeOverlay(base, overlay, [0, 255, 0]).data.slice(0, 4)], [0, 255, 0, 255], 'overlay resampled + tinted');

  const mask = solid(2, 1, [200, 200, 200, 0]);
  mask.data[7] = 255;
  const m = tintByAlphaMask(mask, [0, 255, 0]);
  assert.deepEqual([...m.data], [200, 200, 200, 255, 0, 200, 0, 255], 'alpha 0 untinted, 255 tinted, output opaque');

  const strip = solid(4, 12, [1, 2, 3, 4]);
  strip.data.set([9, 9, 9, 9], 0);
  const f = firstFrame(strip);
  assert.equal(f.width, 4);
  assert.equal(f.height, 4);
  assert.deepEqual([...f.data.slice(0, 4)], [9, 9, 9, 9]);

  const cm = solid(256, 256, [0, 0, 0, 255]);
  const x = Math.floor((1 - 0.8) * 255);
  const y = Math.floor((1 - 0.32) * 255);
  cm.data.set([145, 189, 89, 255], (y * 256 + x) * 4);
  assert.deepEqual(sampleColormap(cm, 0.8, 0.4), [145, 189, 89]);
});

function fakeAssets(edition: 'java' | 'bedrock', files: Record<string, Img | string>, failing: string[] = []): AssetIndex {
  return {
    edition,
    version: 'test',
    textures: [],
    hasFile: (p) => p in files,
    listFiles: (prefix) => Object.keys(files).filter((f) => f.startsWith(prefix)),
    readFile: async () => new Uint8Array(),
    readText: async (p) => {
      const v = files[p];
      if (typeof v !== 'string') throw new Error('not text');
      return v;
    },
    readImage: async (p) => {
      if (failing.includes(p)) throw new Error('corrupt');
      const v = files[p];
      if (!v || typeof v === 'string') throw new Error('missing');
      return v as unknown as ImageData;
    },
  };
}

test('slot textures: Java (modern names), tints, overlay, animated water, fallbacks', async () => {
  const root = 'assets/minecraft/textures/';
  const overlay = solid(16, 16, [0, 0, 0, 0]);
  overlay.data.set([200, 200, 200, 255], 0);
  const assets = fakeAssets('java', {
    [root + 'block/grass_block_top.png']: solid(16, 16, [255, 255, 255, 255]),
    [root + 'block/grass_block_side.png']: solid(16, 16, [120, 80, 50, 255]),
    [root + 'block/grass_block_side_overlay.png']: overlay,
    [root + 'block/oak_leaves.png']: solid(16, 16, [255, 255, 255, 255]),
    [root + 'block/water_still.png']: solid(16, 512, [180, 180, 180, 180]),
    [root + 'block/water_still.png.mcmeta']: '{"animation":{"frametime":2}}',
    [root + 'block/stone.png']: solid(32, 32, [120, 120, 120, 128]),
    [root + 'block/dirt.png']: solid(16, 16, [1, 1, 1, 255]),
  }, [root + 'block/dirt.png']);
  const slots = await loadSlotTextures(assets);
  assert.deepEqual(Object.keys(slots).sort(), [...TEXTURE_SLOTS].sort());
  assert.equal(slots.grass_top.source, 'asset');
  assert.deepEqual([...slots.grass_top.image.data.slice(0, 3)], DEFAULT_GRASS_TINT, 'grass tinted');
  assert.deepEqual([...slots.leaves.image.data.slice(0, 3)], DEFAULT_FOLIAGE_TINT, 'foliage tinted');
  const side = slots.grass_side.image.data;
  assert.deepEqual([...side.slice(4, 8)], [120, 80, 50, 255], 'side keeps base where overlay is clear');
  assert.notDeepEqual([...side.slice(0, 3)], [120, 80, 50], 'overlay applied');
  assert.equal(slots.water.frames, 32);
  assert.equal(slots.water.frametime, 2);
  assert.equal(slots.water.image.height, 512);
  assert.equal(slots.stone.image.width, 32, 'HD textures keep their resolution');
  assert.equal(slots.stone.image.data[3], 255, 'solid blocks forced opaque');
  assert.equal(slots.dirt.source, 'procedural', 'decode failure falls back');
  assert.equal(slots.sand.source, 'procedural', 'missing falls back');
});

test('slot textures: legacy Java names and Bedrock tga masks', async () => {
  const legacy = await loadSlotTextures(fakeAssets('java', {
    'assets/minecraft/textures/blocks/grass_top.png': solid(16, 16, [255, 255, 255, 255]),
    'assets/minecraft/textures/blocks/tallgrass.png': solid(16, 16, [255, 255, 255, 255]),
    'assets/minecraft/textures/blocks/flower_rose.png': solid(16, 16, [200, 0, 0, 255]),
  }));
  assert.equal(legacy.grass_top.source, 'asset');
  assert.equal(legacy.short_grass.path, 'assets/minecraft/textures/blocks/tallgrass.png');
  assert.equal(legacy.poppy.source, 'asset');

  const side = solid(16, 16, [180, 180, 180, 0]);
  side.data[3] = 255;
  const bedrock = await loadSlotTextures(fakeAssets('bedrock', {
    'textures/blocks/grass_side.tga': side,
    'textures/blocks/leaves_oak.tga': solid(16, 16, [255, 255, 255, 255]),
    'textures/blocks/water_still_grey.png': solid(16, 32, [150, 150, 150, 240]),
  }));
  assert.equal(bedrock.grass_side.path, 'textures/blocks/grass_side.tga');
  const d = bedrock.grass_side.image.data;
  assert.equal(d[7], 255, 'mask output is opaque');
  assert.deepEqual([...d.slice(4, 7)], [180, 180, 180], 'alpha-0 pixels stay untinted');
  assert.notDeepEqual([...d.slice(0, 3)], [180, 180, 180], 'masked pixels tinted');
  assert.equal(bedrock.water.frames, 2);
  assert.equal(bedrock.leaves.source, 'asset');

  const none = await loadSlotTextures(null);
  assert.ok(Object.values(none).every((s) => s.source === 'procedural'));
  assert.equal(proceduralSlotTextures().water.frames, WATER_FRAMES);
});

test('diorama generation is deterministic and contains every feature', () => {
  const a = generateDiorama(7);
  const b = generateDiorama(7);
  assert.deepEqual(a.world.blocks, b.world.blocks);
  const counts = new Map<number, number>();
  for (const v of a.world.blocks) counts.set(v, (counts.get(v) ?? 0) + 1);
  for (const [name, id] of Object.entries(BLOCK)) {
    if (id === BLOCK.AIR) continue;
    assert.ok((counts.get(id) ?? 0) > 0, `has ${name}`);
  }
  assert.equal(a.torches.length, 2);
  // no plant floats: every plant sits on grass
  const w = a.world;
  for (let y = 1; y < w.sy; y++) for (let z = 0; z < w.sz; z++) for (let x = 0; x < w.sx; x++) {
    const blk = w.get(x, y, z);
    if (blk >= BLOCK.SHORT_GRASS && blk <= BLOCK.CORNFLOWER) assert.equal(w.get(x, y - 1, z), BLOCK.GRASS);
  }
});

test('meshing: consistent buffers, culled faces, AO, water depth', () => {
  const d = buildDiorama();
  let tris = 0;
  const slots = new Set<string>();
  for (const m of d.meshes) {
    const n = m.positions.length / 3;
    assert.equal(m.normals.length, n * 3);
    assert.equal(m.uvs.length, n * 2);
    assert.equal(m.ao.length, n);
    assert.equal(m.wave.length, n);
    assert.equal(m.indices.length % 3, 0);
    for (const i of m.indices) assert.ok(i < n);
    for (const v of m.ao) assert.ok(v > 0 && v <= 1);
    if (m.kind === 'water') {
      assert.ok(m.depth && m.depth.length === n);
      assert.ok(Math.max(...m.depth!) > 1.5, 'pond has depth');
    }
    tris += m.indices.length / 3;
    slots.add(m.slot);
  }
  assert.ok(tris > 3000 && tris < 40000, `triangle budget (${tris})`);
  for (const s of TEXTURE_SLOTS) assert.ok(slots.has(s), `slot ${s} used`);
  assert.ok(d.bounds.max[1] > 6 && d.bounds.min[1] < -8, 'hills above, floating underside below');
  assert.ok(Math.abs(d.waterLevel - (WATER_SURFACE - 1)) < 1e-6);

  // Two touching stone blocks expose 10 faces, not 12; AO darkens the inner corner.
  const w = new VoxelWorld(4, 4, 4);
  w.set(1, 1, 1, BLOCK.STONE);
  w.set(2, 1, 1, BLOCK.STONE);
  const meshes = meshWorld(w);
  assert.equal(meshes.length, 1);
  assert.equal(meshes[0].positions.length / 3, 10 * 4);
  assert.ok(isOpaque(BLOCK.STONE) && !isOpaque(BLOCK.LEAVES) && !isOpaque(BLOCK.WATER));
  const w2 = new VoxelWorld(4, 4, 4);
  w2.set(1, 1, 1, BLOCK.STONE);
  w2.set(2, 2, 1, BLOCK.STONE);
  const top = meshWorld(w2).find((m) => m.slot === 'stone')!;
  assert.ok(Math.min(...top.ao) < 1, 'occluded vertex darker');
});

test('cloud layer geometry', async () => {
  const { buildClouds } = await import('../../src/shared/preview/clouds');
  const c = buildClouds({ cells: 20, cell: 6, y: -30, thickness: 2 });
  const n = c.positions.length / 3;
  assert.ok(n > 0 && n % 4 === 0);
  assert.equal(c.normals.length, n * 3);
  assert.equal(c.centers.length, n);
  assert.equal(c.period, 120);
  for (const i of c.indices) assert.ok(i < n);
  for (let i = 1; i < c.positions.length; i += 3) assert.ok(c.positions[i] === -30 || c.positions[i] === -28);
  for (let i = 0; i < c.positions.length; i += 3) assert.ok(Math.abs(c.positions[i]) <= 60);
  assert.deepEqual(buildClouds().positions, buildClouds().positions, 'deterministic');
});
