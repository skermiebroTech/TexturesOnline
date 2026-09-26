import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import type { AssetIndex } from '../../src/core/types';
import { BOX_FACE_ORDER } from '../../src/shared/preview/block-preview';
import { limitStrip, loadSlotTextures, MAX_STRIP_HEIGHT, neutralizeWater } from '../../src/shared/preview/preview-textures';
import { makePixelTexture } from '../../src/shared/preview/three-utils';
import { BLOCK, meshWorld, VoxelWorld } from '../../src/shared/preview/voxel-world';
import { parseSkinPart } from '../../src/tools/skins/skin-preview';

type Img = { width: number; height: number; data: Uint8ClampedArray };
const solid = (w: number, h: number, rgba: [number, number, number, number]): Img => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(rgba, i * 4);
  return { width: w, height: h, data };
};

function fakeAssets(edition: 'java' | 'bedrock', files: Record<string, Img | string>): AssetIndex {
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
      const v = files[p];
      if (!v || typeof v === 'string') throw new Error('missing');
      return v as unknown as ImageData;
    },
  };
}

/** Minecraft default face UVs (research java-packs §5.3) as texture coords with v = 1 at the image top. */
function expectedUv(face: string, x: number, y: number, z: number): [number, number] {
  switch (face) {
    case 'up': return [x, 1 - z];
    case 'down': return [x, z];
    case 'north': return [1 - x, y];
    case 'south': return [x, y];
    case 'west': return [z, y];
    case 'east': return [1 - z, y];
  }
  throw new Error(face);
}
const faceOfNormal = (n: number[]): string =>
  n[0] > 0.5 ? 'east' : n[0] < -0.5 ? 'west' : n[1] > 0.5 ? 'up' : n[1] < -0.5 ? 'down' : n[2] > 0.5 ? 'south' : 'north';

test('diorama faces use the game default UV orientation on every side', () => {
  const w = new VoxelWorld(3, 3, 3);
  w.set(1, 1, 1, BLOCK.STONE);
  const [mesh] = meshWorld(w);
  const seen = new Set<string>();
  for (let i = 0; i < mesh.positions.length / 3; i++) {
    const n = [mesh.normals[i * 3], mesh.normals[i * 3 + 1], mesh.normals[i * 3 + 2]];
    const face = faceOfNormal(n);
    seen.add(face);
    const [x, y, z] = [mesh.positions[i * 3] - 1, mesh.positions[i * 3 + 1] - 1, mesh.positions[i * 3 + 2] - 1];
    assert.deepEqual([mesh.uvs[i * 2], mesh.uvs[i * 2 + 1]], expectedUv(face, x, y, z), `${face} at ${x},${y},${z}`);
  }
  assert.equal(seen.size, 6);
});

test('block preview cube: BoxGeometry groups map to the right faces with game UVs', () => {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  const normal = geo.getAttribute('normal');
  assert.equal(geo.groups.length, 6);
  for (const g of geo.groups) {
    const face = BOX_FACE_ORDER[g.materialIndex ?? 0];
    for (let k = g.start; k < g.start + g.count; k++) {
      const i = geo.index!.getX(k);
      assert.equal(faceOfNormal([normal.getX(i), normal.getY(i), normal.getZ(i)]), face, `group ${g.materialIndex}`);
      const [eu, ev] = expectedUv(face, pos.getX(i) + 0.5, pos.getY(i) + 0.5, pos.getZ(i) + 0.5);
      assert.ok(Math.abs(uv.getX(i) - eu) < 1e-6 && Math.abs(uv.getY(i) - ev) < 1e-6, `${face} uv`);
    }
  }
  geo.dispose();
});

test('makePixelTexture: image top row ends up at uv v = 1, nearest filtering', () => {
  const img = solid(1, 2, [0, 0, 255, 255]);
  img.data.set([255, 0, 0, 255], 0); // top row red
  const tex = makePixelTexture(img);
  const data = tex.image.data as Uint8Array;
  assert.deepEqual([...data.slice(0, 4)], [0, 0, 255, 255], 'texture row 0 (v = 0) is the image bottom');
  assert.deepEqual([...data.slice(4, 8)], [255, 0, 0, 255]);
  assert.equal(tex.magFilter, THREE.NearestFilter);
  assert.equal(tex.flipY, false);
  tex.dispose();
});

test('Bedrock slots follow the engine extension priority (.tga before .png)', async () => {
  const tga = solid(16, 16, [120, 120, 120, 255]);
  const png = solid(16, 16, [30, 30, 30, 255]);
  const slots = await loadSlotTextures(fakeAssets('bedrock', {
    'textures/blocks/tallgrass.png': png,
    'textures/blocks/tallgrass.tga': tga,
  }));
  assert.equal(slots.short_grass.path, 'textures/blocks/tallgrass.tga');
});

test('pre-1.13 blue water is neutralised so waterColor drives the colour; grey water untouched', async () => {
  const blue = solid(16, 64, [47, 69, 244, 180]);
  blue.data.set([53, 79, 244, 190], 4);
  const n = neutralizeWater(blue);
  assert.notEqual(n, blue);
  for (let i = 0; i < n.data.length; i += 4) {
    assert.equal(n.data[i], n.data[i + 1]);
    assert.equal(n.data[i + 1], n.data[i + 2]);
  }
  assert.ok(Math.abs(n.data[0] - 185) <= 3, `mean brightness near modern grey water (${n.data[0]})`);
  assert.ok(n.data[4] > n.data[0], 'light/dark detail kept');
  assert.equal(n.data[3], 180, 'alpha kept');
  const grey = solid(16, 16, [180, 180, 180, 180]);
  assert.equal(neutralizeWater(grey), grey);

  const legacy = await loadSlotTextures(fakeAssets('java', {
    'assets/minecraft/textures/blocks/water_still.png': solid(16, 512, [47, 69, 244, 180]),
    'assets/minecraft/textures/blocks/water_still.png.mcmeta': '{"animation":{"frametime":2}}',
    'assets/minecraft/textures/blocks/flower_rose.png': solid(16, 16, [200, 0, 0, 255]),
  }));
  const w = legacy.water.image.data;
  assert.equal(w[0], w[2], 'legacy water loaded as grey');
  assert.equal(legacy.water.frames, 32);
  assert.equal(legacy.cornflower.path, 'assets/minecraft/textures/blocks/flower_rose.png', '1.6 has no blue flower: rose reused');
});

test('oversized water strips are cut to fit the GPU texture limit', async () => {
  const strip = solid(512, 512 * 32, [180, 180, 180, 180]);
  const limited = limitStrip(strip, 32);
  assert.equal(limited.frames, MAX_STRIP_HEIGHT / 512);
  assert.equal(limited.image.height, MAX_STRIP_HEIGHT);
  assert.equal(limited.image.data.length, 512 * MAX_STRIP_HEIGHT * 4);
  const small = solid(16, 512, [1, 1, 1, 1]);
  assert.equal(limitStrip(small, 32).image, small);
  const slots = await loadSlotTextures(fakeAssets('java', { 'assets/minecraft/textures/block/water_still.png': strip }));
  assert.ok(slots.water.image.height <= MAX_STRIP_HEIGHT);
  assert.equal(slots.water.image.height, slots.water.frames * 512);
});

test('parseSkinPart understands numbered layer names', () => {
  assert.deepEqual(parseSkinPart('head:layer2'), { part: 'head', layer: 'outer' });
  assert.deepEqual(parseSkinPart('left_arm_layer1'), { part: 'leftArm', layer: 'inner' });
  assert.deepEqual(parseSkinPart('Right Leg (layer 2)'), { part: 'rightLeg', layer: 'outer' });
});
