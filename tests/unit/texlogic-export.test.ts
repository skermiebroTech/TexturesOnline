import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportTexturePack, adjustMcmeta, mergePackMcmeta, scaleNineSlice } from '../../src/tools/textures/export';
import { newTextureProject, setOverride, applyPreset, addEffectLayer, imageDims } from '../../src/tools/textures/project';
import { createLayer } from '../../src/tools/textures/effects';
import { decodeImage, isPng } from '../../src/core/image';
import { isUuid } from '../../src/core/uuid';
import type { Progress } from '../../src/core/types';
import { bedrockSpec, fakeAssets, img, javaSpec, json, noisy, text, unzipBlob } from '../tools/texlogic/fixtures';

const J = 'assets/minecraft/textures/';

test('Java 26.3: pack.mcmeta uses min/max format, pack.png, only edited textures without effects', async () => {
  const assets = fakeAssets('java', '26.3', javaSpec());
  const p = newTextureProject({ name: 'Cool Pack', edition: 'java', version: '26.3', description: 'My pack' });
  await setOverride(p, `${J}block/stone.png`, noisy(32, 32, 42));
  p.extraFiles['assets/minecraft/lang/en_us.json'] = new Blob(['{"block.minecraft.stone":"Rock"}']);
  const progress: Progress[] = [];
  const res = await exportTexturePack(p, assets, { onProgress: (x) => progress.push(x) });
  assert.equal(res.filename, 'Cool Pack.zip');
  assert.equal(res.blob.type, 'application/zip');
  const zip = await unzipBlob(res.blob);
  assert.deepEqual(Object.keys(zip).sort(), ['assets/minecraft/lang/en_us.json', `${J}block/stone.png`, 'pack.mcmeta', 'pack.png']);
  assert.deepEqual(json(zip['pack.mcmeta']), { pack: { description: 'My pack', min_format: [97, 1], max_format: 97 } });
  assert.deepEqual(new Uint8Array(zip[`${J}block/stone.png`]), new Uint8Array(await p.overrides[`${J}block/stone.png`].arrayBuffer()));
  assert.ok(isPng(zip['pack.png']));
  assert.deepEqual(imageDims(zip['pack.png']), { w: 128, h: 128 });
  const icon = await decodeImage(zip['pack.png']);
  assert.ok(icon.data.some((v, i) => i % 4 === 3 && v > 0), 'generated icon is not empty');
  assert.equal(res.fileCount, 4);
  assert.equal(progress.at(-1)?.fraction, 1);
  assert.deepEqual(res.warnings, []);
});

test('Java 1.20.1 and a 1.20.1 – 26.3 compatibility range', async () => {
  const assets = fakeAssets('java', '1.20.1', javaSpec());
  const p = newTextureProject({ name: 'Old', edition: 'java', version: '1.20.1', description: 'Old pack' });
  let zip = await unzipBlob((await exportTexturePack(p, assets)).blob);
  assert.deepEqual(json(zip['pack.mcmeta']), { pack: { pack_format: 15, description: 'Old pack' } });

  p.version = '26.3';
  p.compat = { minVersion: '1.20.1', maxVersion: '26.3' };
  zip = await unzipBlob((await exportTexturePack(p, fakeAssets('java', '26.3', javaSpec()))).blob);
  assert.deepEqual(json(zip['pack.mcmeta']).pack, { description: 'Old pack', pack_format: 15, supported_formats: [15, 97], min_format: 15, max_format: 97 });
});

test('Java with effects: every affected vanilla texture, metadata copied, fonts untouched, alpha kept', async () => {
  const spec = javaSpec();
  const assets = fakeAssets('java', '26.3', spec);
  const p = newTextureProject({ name: 'Gray', edition: 'java', version: '26.3' });
  applyPreset(p, 'noir');
  const res = await exportTexturePack(p, assets);
  const zip = await unzipBlob(res.blob);
  const textures = Object.keys(zip).filter((k) => k.startsWith(J) && k.endsWith('.png'));
  assert.ok(textures.includes(`${J}block/stone.png`));
  assert.ok(textures.includes(`${J}block/water_still.png`));
  assert.ok(textures.includes(`${J}colormap/grass.png`), 'colour maps get colour effects');
  assert.ok(!textures.includes(`${J}font/ascii.png`), 'fonts are left alone');
  assert.equal(text(zip[`${J}block/water_still.png.mcmeta`]), spec[`${J}block/water_still.png.mcmeta`]);
  assert.equal(text(zip[`${J}block/glass.png.mcmeta`]), spec[`${J}block/glass.png.mcmeta`]);
  assert.ok(zip[`${J}gui/sprites/widget/button.png.mcmeta`]);
  const apple = await decodeImage(zip[`${J}item/apple.png`]);
  const orig = spec[`${J}item/apple.png`] as ImageData;
  for (let i = 0; i < orig.data.length; i += 4) {
    assert.equal(apple.data[i + 3], orig.data[i + 3]);
    if (orig.data[i + 3] > 0) assert.equal(apple.data[i], apple.data[i + 1], 'grayscale');
  }
});

test('Java upscale: frame sizes in .mcmeta scale with the texture, frame lists are trimmed for edited strips', async () => {
  const spec = javaSpec();
  const assets = fakeAssets('java', '26.3', spec);
  const p = newTextureProject({ name: 'HD', edition: 'java', version: '26.3' });
  addEffectLayer(p, { ...createLayer('upscale', { factor: '2' }), categories: ['block', 'gui'] });
  // edited water: only 2 frames instead of 4
  await setOverride(p, `${J}block/water_still.png`, noisy(16, 32, 3));
  const zip = await unzipBlob((await exportTexturePack(p, assets)).blob);
  assert.deepEqual(imageDims(zip[`${J}gui/sprites/friends/loading.png`]), { w: 10, h: 12 });
  assert.deepEqual(json(zip[`${J}gui/sprites/friends/loading.png.mcmeta`]), { animation: { width: 10, height: 4, frametime: 6 } });
  assert.deepEqual(imageDims(zip[`${J}gui/sprites/widget/button.png`]), { w: 40, h: 8 });
  assert.deepEqual(json(zip[`${J}gui/sprites/widget/button.png.mcmeta`]), json(new TextEncoder().encode(spec[`${J}gui/sprites/widget/button.png.mcmeta`] as string)));
  assert.deepEqual(imageDims(zip[`${J}block/water_still.png`]), { w: 32, h: 64 });
  assert.deepEqual(json(zip[`${J}block/water_still.png.mcmeta`]), { animation: { frametime: 2, frames: [0, 1] } });
});

test('Java: imported pack.mcmeta sections are kept and rewritten for the target', async () => {
  const assets = fakeAssets('java', '26.3', javaSpec());
  const p = newTextureProject({ name: 'Lang', edition: 'java', version: '26.3', description: 'd' });
  p.extraFiles['pack.mcmeta'] = new Blob([
    JSON.stringify({
      pack: { pack_format: 15, description: 'old' },
      language: { xx_xx: { name: 'Xish', region: 'X', bidirectional: false } },
      overlays: { entries: [{ directory: 'ov_new', formats: [18, 97] }, { directory: 'bad/dir', formats: 20 }] },
    }),
  ]);
  const zip = await unzipBlob((await exportTexturePack(p, assets)).blob);
  const meta = json(zip['pack.mcmeta']);
  assert.deepEqual(meta.pack, { description: 'd', min_format: [97, 1], max_format: 97 });
  assert.equal(meta.language.xx_xx.name, 'Xish');
  assert.deepEqual(meta.overlays, { entries: [{ directory: 'ov_new', formats: [18, 97], min_format: 18, max_format: 97 }] });
  // 1.20.1 has no overlays
  const warnings: string[] = [];
  const old = JSON.parse(mergePackMcmeta('{"pack":{"pack_format":15,"description":"d"}}', '{"overlays":{"entries":[{"directory":"a","formats":[15,20]}]}}', warnings));
  assert.equal(old.overlays, undefined);
  assert.equal(warnings.length, 1);
});

test('Bedrock: manifest with stable uuids and bumped version, .tga stays .tga with its alpha mask, icon 256', async () => {
  const spec = bedrockSpec();
  const assets = fakeAssets('bedrock', 'latest', spec);
  const p = newTextureProject({ name: 'Bed Rock', edition: 'bedrock', version: 'latest', description: 'Hello' });
  const uuids = { ...p.bedrockUuids! };
  const tga = img(16, 16, (x, y) => (y < 3 ? [100, 100, 100, 255] : [130 + (x % 4), 90, 60, 0]));
  await setOverride(p, 'textures/blocks/grass_side.tga', tga);
  addEffectLayer(p, createLayer('invert'));

  const res = await exportTexturePack(p, assets);
  assert.equal(res.filename, 'Bed Rock.mcpack');
  assert.equal(res.blob.type, 'application/octet-stream');
  const zip = await unzipBlob(res.blob);
  const manifest = json(zip['manifest.json']);
  assert.equal(manifest.format_version, 2);
  assert.equal(manifest.header.name, 'Bed Rock');
  assert.equal(manifest.header.description, 'Hello');
  assert.equal(manifest.header.uuid, uuids.header);
  assert.deepEqual(manifest.header.version, [1, 0, 0]);
  assert.equal(manifest.modules[0].type, 'resources');
  assert.equal(manifest.modules[0].uuid, uuids.module);
  assert.equal(manifest.capabilities, undefined, 'plain texture packs never declare pbr');
  assert.deepEqual(imageDims(zip['pack_icon.png']), { w: 256, h: 256 });
  assert.ok(!zip['textures/blocks/grass_side.png'], 'no extension change');
  const out = await decodeImage(zip['textures/blocks/grass_side.tga'], 'tga');
  for (let i = 0; i < tga.data.length; i += 4) {
    assert.equal(out.data[i + 3], tga.data[i + 3], 'tint mask kept');
    assert.equal(out.data[i], 255 - tga.data[i], 'visible dirt under alpha 0 is inverted too');
  }
  assert.ok(zip['textures/blocks/leaves_oak.tga'], 'vanilla .tga with effects keeps .tga');
  assert.ok(zip['textures/blocks/stone.png']);
  assert.deepEqual(p.packVersion, [1, 0, 0]);
  assert.deepEqual(p.bedrockUuids, uuids);

  const again = json((await unzipBlob((await exportTexturePack(p, assets)).blob))['manifest.json']);
  assert.deepEqual(again.header.version, [1, 0, 1]);
  assert.deepEqual(again.modules[0].version, [1, 0, 1]);
  assert.equal(again.header.uuid, uuids.header);
});

test('Bedrock: UI nine-slice data scales with upscaled textures; imported manifest extras are merged', async () => {
  const assets = fakeAssets('bedrock', 'latest', bedrockSpec());
  const p = newTextureProject({ name: 'HD', edition: 'bedrock', version: 'latest' });
  addEffectLayer(p, { ...createLayer('upscale', { factor: '2' }), categories: ['gui'] });
  p.extraFiles['manifest.json'] = new Blob([
    JSON.stringify({
      format_version: 2,
      header: { name: 'x', uuid: p.bedrockUuids!.header, version: [1, 0, 0] },
      modules: [{ type: 'resources', uuid: p.bedrockUuids!.module, version: [1, 0, 0] }],
      subpacks: [{ folder_name: 'hd', name: 'HD', memory_tier: 1 }],
      metadata: { authors: ['Someone'] },
    }),
  ]);
  p.extraFiles['texts/en_US.lang'] = new Blob(['pack.name=HD\n']);
  const zip = await unzipBlob((await exportTexturePack(p, assets)).blob);
  assert.deepEqual(imageDims(zip['textures/ui/button.png']), { w: 16, h: 16 });
  assert.deepEqual(json(zip['textures/ui/button.json']), { nineslice_size: 4, base_size: [16, 16] });
  const manifest = json(zip['manifest.json']);
  assert.deepEqual(manifest.subpacks, [{ folder_name: 'hd', name: 'HD', memory_tier: 1 }]);
  assert.deepEqual(manifest.metadata.authors, ['Someone']);
  assert.ok(isUuid(manifest.header.uuid));
  assert.equal(text(zip['texts/en_US.lang']), 'pack.name=HD\n');
});

test('custom icon is used (resized when not square), abort and edition mismatch fail cleanly', async () => {
  const assets = fakeAssets('java', '26.3', javaSpec());
  const p = newTextureProject({ name: 'Icon', edition: 'java', version: '26.3' });
  const { encodePng } = await import('../../src/core/image');
  p.icon = new Blob([encodePng(noisy(64, 32, 1))], { type: 'image/png' });
  const zip = await unzipBlob((await exportTexturePack(p, assets)).blob);
  assert.deepEqual(imageDims(zip['pack.png']), { w: 128, h: 128 });

  const ac = new AbortController();
  ac.abort();
  await assert.rejects(exportTexturePack(p, assets, { signal: ac.signal }), (e: Error) => e.name === 'AbortError');
  const ac2 = new AbortController();
  applyPreset(p, 'vivid');
  const run = exportTexturePack(p, assets, { signal: ac2.signal, onProgress: (x) => { if (x.label.startsWith('Applying')) ac2.abort(); } });
  await assert.rejects(run, (e: Error) => e.name === 'AbortError');
  await assert.rejects(exportTexturePack(p, fakeAssets('bedrock', 'latest', bedrockSpec())), /Bedrock/);
});

test('metadata helpers', () => {
  assert.equal(adjustMcmeta('{"animation":{}}', {}, { w: 16, h: 64 }, 1), null);
  assert.deepEqual(JSON.parse(adjustMcmeta('{"animation":{"width":5,"height":2}}', { width: 5, height: 2 }, { w: 15, h: 6 }, 3)!), { animation: { width: 15, height: 6 } });
  // sizes that no longer divide the texture fall back to square frames
  assert.deepEqual(JSON.parse(adjustMcmeta('{"animation":{"width":5,"height":2,"frames":[0,1,2]}}', { width: 5, height: 2 }, { w: 16, h: 16 }, 1)!), { animation: { frames: [0] } });
  assert.deepEqual(JSON.parse(scaleNineSlice('// c\n{"nineslice_size":[1,2,3,4],"base_size":[4,4],}', 4)!), { nineslice_size: [4, 8, 12, 16], base_size: [16, 16] });
});
