import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPreset,
  categoryForPath,
  getBaseImage,
  imageDims,
  newTextureProject,
  normalizeResolution,
  packFileName,
  parseBedrockVersion,
  removeOverride,
  scaleForResolution,
  setOverride,
} from '../../src/tools/textures/project';
import { createImageData, decodeImage, encodePng, isPng } from '../../src/core/image';
import { isUuid } from '../../src/core/uuid';
import type { AssetIndex } from '../../src/core/types';

function img(w: number, h: number, fn: (x: number, y: number) => [number, number, number, number]): ImageData {
  const out = createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.data.set(fn(x, y), (y * w + x) * 4);
  return out;
}

function assetsWith(files: Record<string, ImageData>): AssetIndex {
  return {
    edition: 'java',
    version: '26.3',
    textures: [],
    hasFile: (p) => p in files,
    listFiles: (prefix) => Object.keys(files).filter((p) => p.startsWith(prefix)),
    readFile: async (p) => encodePng(files[p]),
    readText: async () => '',
    readImage: async (p) => {
      if (!(p in files)) throw new Error('missing');
      return files[p];
    },
  };
}

test('newTextureProject: Java and Bedrock defaults', () => {
  const j = newTextureProject({ name: '  My Pack ', edition: 'java', version: '26.3' });
  assert.equal(j.kind, 'texturepack');
  assert.equal(j.name, 'My Pack');
  assert.equal(j.resolution, 16);
  assert.ok(j.description.length > 0);
  assert.deepEqual(j.overrides, {});
  assert.deepEqual(j.effects, []);
  assert.equal(j.bedrockUuids, undefined);
  assert.ok(isUuid(j.id));
  const b = newTextureProject({ name: '', edition: 'bedrock', version: 'latest', resolution: 64, description: 'Hi' });
  assert.equal(b.name, 'My Texture Pack');
  assert.equal(b.resolution, 64);
  assert.equal(b.description, 'Hi');
  assert.ok(isUuid(b.bedrockUuids!.header) && isUuid(b.bedrockUuids!.module));
  assert.notEqual(b.bedrockUuids!.header, b.bedrockUuids!.module);
  assert.equal(normalizeResolution(20), 16);
  assert.equal(normalizeResolution(100), 128);
  assert.equal(normalizeResolution(9999), 512);
});

test('scaleForResolution: nearest upscale of 16x art, strips keep square frames, never downscales', () => {
  const src = img(16, 16, (x, y) => [x * 16, y * 16, 0, x === 0 ? 0 : 255]);
  const big = scaleForResolution(src, 64);
  assert.equal(big.width, 64);
  assert.equal(big.height, 64);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const s = ((y >> 2) * 16 + (x >> 2)) * 4;
      const d = (y * 64 + x) * 4;
      assert.deepEqual([...big.data.subarray(d, d + 4)], [...src.data.subarray(s, s + 4)]);
    }
  const strip = img(16, 64, () => [1, 2, 3, 255]);
  const s32 = scaleForResolution(strip, 32, true);
  assert.deepEqual([s32.width, s32.height], [32, 128]);
  const hdStrip = img(32, 128, () => [1, 2, 3, 255]);
  assert.deepEqual([scaleForResolution(hdStrip, 64, true).width, scaleForResolution(hdStrip, 64, true).height], [64, 256]);
  const same = scaleForResolution(hdStrip, 16, true);
  assert.deepEqual([same.width, same.height], [32, 128]);
  assert.notEqual(same, hdStrip);
  const entity = img(64, 32, () => [9, 9, 9, 255]);
  assert.deepEqual([scaleForResolution(entity, 32).width, scaleForResolution(entity, 32).height], [128, 64]);
});

test('setOverride keeps the path format: PNG, and TGA for Bedrock .tga paths (alpha-0 colour survives)', async () => {
  const p = newTextureProject({ name: 'x', edition: 'bedrock', version: 'latest' });
  const tex = img(4, 4, (x) => [200, 100 + x, 50, x < 2 ? 0 : 255]);
  await setOverride(p, 'textures/blocks/grass_side.tga', tex);
  await setOverride(p, 'textures/blocks/stone.png', tex);
  const tgaBytes = new Uint8Array(await p.overrides['textures/blocks/grass_side.tga'].arrayBuffer());
  const pngBytes = new Uint8Array(await p.overrides['textures/blocks/stone.png'].arrayBuffer());
  assert.ok(!isPng(tgaBytes));
  assert.equal(tgaBytes[2], 2); // uncompressed true-colour TGA
  assert.ok(isPng(pngBytes));
  assert.deepEqual(imageDims(tgaBytes, 'tga'), { w: 4, h: 4 });
  for (const bytes of [tgaBytes, pngBytes]) {
    const back = await decodeImage(bytes, bytes === tgaBytes ? 'tga' : 'png');
    assert.deepEqual([...back.data], [...tex.data]);
  }
  removeOverride(p, 'textures/blocks/stone.png');
  assert.deepEqual(Object.keys(p.overrides), ['textures/blocks/grass_side.tga']);
});

test('getBaseImage: override first, then vanilla, friendly error otherwise', async () => {
  const vanilla = img(2, 2, () => [1, 1, 1, 255]);
  const edited = img(4, 4, () => [9, 9, 9, 255]);
  const assets = assetsWith({ 'assets/minecraft/textures/block/stone.png': vanilla });
  const p = newTextureProject({ name: 'x', edition: 'java', version: '26.3' });
  assert.equal((await getBaseImage(p, assets, 'assets/minecraft/textures/block/stone.png')).width, 2);
  await setOverride(p, 'assets/minecraft/textures/block/stone.png', edited);
  assert.equal((await getBaseImage(p, assets, 'assets/minecraft/textures/block/stone.png')).width, 4);
  await assert.rejects(getBaseImage(p, assets, 'assets/minecraft/textures/block/nope.png'), /isn't a texture/);
  p.overrides['assets/minecraft/textures/block/stone.png'] = new Blob([new Uint8Array([1, 2, 3])]);
  assert.equal((await getBaseImage(p, assets, 'assets/minecraft/textures/block/stone.png')).width, 2, 'damaged override falls back to vanilla');
});

test('applyPreset replaces or appends layers with fresh ids', () => {
  const p = newTextureProject({ name: 'x', edition: 'java', version: '26.3' });
  const a = applyPreset(p, 'noir');
  assert.ok(a.length > 1);
  assert.equal(p.effects.length, a.length);
  applyPreset(p, 'vivid', 'append');
  assert.ok(p.effects.length > a.length);
  assert.equal(new Set(p.effects.map((l) => l.id)).size, p.effects.length);
  applyPreset(p, 'inverted');
  assert.deepEqual(p.effects.map((l) => l.type), ['invert']);
  assert.throws(() => applyPreset(p, 'missing'));
});

test('file names, categories and versions', () => {
  assert.equal(packFileName({ name: 'My:Pack/§6Cool', edition: 'java' }), 'My_Pack_Cool.zip');
  assert.equal(packFileName({ name: '   ', edition: 'bedrock' }), 'texture-pack.mcpack');
  assert.equal(packFileName({ name: 'con', edition: 'java' }), 'texture-pack.zip');
  assert.equal(packFileName({ name: 'x'.repeat(200), edition: 'java' }).length, 84);
  assert.equal(categoryForPath('assets/minecraft/textures/block/stone.png', 'java'), 'block');
  assert.equal(categoryForPath('assets/minecraft/textures/entity/equipment/humanoid/iron.png', 'java'), 'armor');
  assert.equal(categoryForPath('textures/blocks/stone.png', 'bedrock'), 'block');
  assert.equal(categoryForPath('textures/ui/button.png', 'bedrock'), 'gui');
  assert.deepEqual(parseBedrockVersion([1, 2, 3]), [1, 2, 3]);
  assert.deepEqual(parseBedrockVersion('2.5'), [2, 5, 0]);
  assert.equal(parseBedrockVersion('x'), null);
});
