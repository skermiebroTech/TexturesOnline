/** Regression tests for defects found in review (trims, frame sizes after resize, pack info, Bedrock edge cases). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { applyEffects, createLayer, layerApplies, EFFECT_PRESETS, type EffectContext } from '../../src/tools/textures/effects';
import { exportTexturePack, mergePackMcmeta, effectiveCompat } from '../../src/tools/textures/export';
import { importPack } from '../../src/tools/textures/import';
import { newTextureProject, setOverride, addEffectLayer, applyPreset, imageDims } from '../../src/tools/textures/project';
import type { EffectLayer } from '../../src/core/types';
import { bedrockSpec, fakeAssets, img, javaSpec, json, noisy, solid, unzipBlob } from '../tools/texlogic/fixtures';

const J = 'assets/minecraft/textures/';
const L = (type: string, params: Record<string, number | boolean | string> = {}, categories?: EffectLayer['categories']): EffectLayer => ({
  id: type,
  ...createLayer(type, params),
  categories,
});

test('armor trim patterns and key palettes are never recoloured (the game matches their exact colours)', () => {
  const colour = L('hue');
  const noise = L('noise');
  const up = L('upscale');
  const trimPatterns: EffectContext[] = [
    { path: `${J}trims/items/helmet_trim.png`, category: 'armor' },
    { path: `${J}trims/entity/humanoid/bolt.png`, category: 'armor' },
    { path: `${J}trims/models/armor/coast.png`, category: 'armor' },
    { path: 'textures/trims/bolt.png', category: 'armor' },
  ];
  for (const ctx of trimPatterns) {
    assert.equal(layerApplies(colour, ctx), false, ctx.path);
    assert.equal(layerApplies(noise, ctx), false, ctx.path);
    assert.equal(layerApplies({ ...colour, categories: ['armor'] }, ctx), false, `${ctx.path} even when asked for`);
    assert.equal(layerApplies(up, ctx), true, `${ctx.path}: upscaling only copies pixels`);
  }
  for (const path of [`${J}palettes/trim_base.png`, `${J}trims/color_palettes/trim_palette.png`, 'textures/trims/color_palettes/trim_palette.png']) {
    for (const l of [colour, noise, up]) assert.equal(layerApplies(l, { path, category: 'armor' }), false, `${path} ${l.type}`);
  }
  for (const path of [`${J}palettes/trim/gold.png`, `${J}trims/color_palettes/gold.png`, 'textures/trims/color_palettes/gold.png']) {
    assert.equal(layerApplies(colour, { path, category: 'armor' }), true, `${path}: materials follow the look`);
    assert.equal(layerApplies(noise, { path, category: 'armor' }), false);
    assert.equal(layerApplies(up, { path, category: 'armor' }), false);
  }
});

test('export with a grain preset leaves trim patterns alone but recolours the trim materials', async () => {
  const spec = {
    ...javaSpec(),
    [`${J}trims/items/helmet_trim.png`]: img(16, 16, (x) => (x < 8 ? [224, 224, 224, 255] : [160, 160, 160, 255])),
    [`${J}palettes/trim_base.png`]: img(8, 1, (x) => [224 - x * 32, 224 - x * 32, 224 - x * 32, 255]),
    [`${J}palettes/trim/gold.png`]: img(8, 1, (x) => [250 - x * 20, 200 - x * 20, 40, 255]),
  };
  const p = newTextureProject({ name: 'Noir', edition: 'java', version: '26.3' });
  applyPreset(p, 'noir');
  const zip = await unzipBlob((await exportTexturePack(p, fakeAssets('java', '26.3', spec))).blob);
  assert.equal(zip[`${J}trims/items/helmet_trim.png`], undefined);
  assert.equal(zip[`${J}palettes/trim_base.png`], undefined);
  assert.ok(zip[`${J}palettes/trim/gold.png`]);
});

test('explicit frame sizes follow a resize layer, so later spatial layers keep per-frame edges', () => {
  // 10x4 texture made of four 5x2 frames (like an .mcmeta with width 5, height 2)
  const src = solid(10, 4, [100, 100, 100, 255]);
  const ctx: EffectContext = { path: `${J}gui/sprites/x.png`, category: 'gui', animated: true, frameWidth: 5, frameHeight: 2 };
  const out = applyEffects(src, [L('upscale', { factor: '2', algorithm: 'nearest' }), L('outline', { mode: 'tile', color: '#ff0000', thickness: 1 })], ctx);
  assert.deepEqual([out.width, out.height], [20, 8]);
  const at = (x: number, y: number) => [...out.data.subarray((y * 20 + x) * 4, (y * 20 + x) * 4 + 3)];
  assert.deepEqual(at(0, 0), [255, 0, 0], 'frame corner is bordered');
  assert.deepEqual(at(9, 2), [255, 0, 0], 'right edge of the first 10x4 frame');
  assert.deepEqual(at(5, 1), [100, 100, 100], 'inside a frame: no border where the old 5x2 grid would have put one');
  assert.deepEqual(at(10, 2), [255, 0, 0], 'left edge of the second frame');
});

test('overlays survive for ranges that start at 1.20.1 but reach 1.20.2+, inverted overlay ranges are dropped', () => {
  const warnings: string[] = [];
  const merged = JSON.parse(
    mergePackMcmeta(
      '{"pack":{"pack_format":15,"supported_formats":[15,34],"description":"d"}}',
      JSON.stringify({ overlays: { entries: [{ directory: 'ov', formats: [18, 34] }] } }),
      warnings,
    ),
  );
  assert.deepEqual(merged.overlays, { entries: [{ directory: 'ov', formats: [18, 34] }] });
  assert.deepEqual(warnings, []);
  const bad = JSON.parse(
    mergePackMcmeta(
      '{"pack":{"description":"d","min_format":[97,1],"max_format":97}}',
      JSON.stringify({ overlays: { entries: [{ directory: 'a', min_format: 97, max_format: 80 }, { directory: 'b', min_format: 84, max_format: 97 }] } }),
    ),
  );
  assert.deepEqual(bad.overlays, { entries: [{ directory: 'b', min_format: 84, max_format: 97 }] });
});

test('a compatibility range that leaves out the target version is widened to include it', async () => {
  const w: string[] = [];
  assert.deepEqual(await effectiveCompat('26.3', { minVersion: '1.20.1', maxVersion: '1.21.1' }, w), { minVersion: '1.20.1', maxVersion: '26.3' });
  assert.equal(w.length, 1);
  assert.deepEqual(await effectiveCompat('1.20.1', { minVersion: '1.21.1', maxVersion: '1.20.2' }), { minVersion: '1.20.1', maxVersion: '1.21.1' });
  assert.equal(await effectiveCompat('1.21.1', { minVersion: '1.21', maxVersion: '1.21.1' }), undefined, 'one format needs no range');
  assert.equal(await effectiveCompat('26.3', undefined), undefined);

  const p = newTextureProject({ name: 'Range', edition: 'java', version: '26.3', description: 'd' });
  p.compat = { minVersion: '1.20.1', maxVersion: '1.21.1' };
  const res = await exportTexturePack(p, fakeAssets('java', '26.3', javaSpec()));
  assert.deepEqual(json((await unzipBlob(res.blob))['pack.mcmeta']).pack, { description: 'd', pack_format: 15, supported_formats: [15, 97], min_format: 15, max_format: 97 });
  assert.ok(res.warnings.some((x) => /widened/.test(x)));
});

test('Bedrock: a pack image under another extension is not shadowed by an effect-processed vanilla .tga', async () => {
  const assets = fakeAssets('bedrock', 'latest', bedrockSpec());
  const p = newTextureProject({ name: 'Ext', edition: 'bedrock', version: 'latest' });
  await setOverride(p, 'textures/blocks/grass_side.png', noisy(16, 16, 3));
  addEffectLayer(p, createLayer('invert'));
  const zip = await unzipBlob((await exportTexturePack(p, assets)).blob);
  assert.ok(zip['textures/blocks/grass_side.png']);
  assert.equal(zip['textures/blocks/grass_side.tga'], undefined, '.tga would win over the pack’s .png in game');
  assert.ok(zip['textures/blocks/leaves_oak.tga'], 'other vanilla .tga textures still get the effect');
});

test('Bedrock: the pack’s own nine-slice JSON is scaled with its texture', async () => {
  const assets = fakeAssets('bedrock', 'latest', bedrockSpec());
  const p = newTextureProject({ name: 'UI', edition: 'bedrock', version: 'latest' });
  await setOverride(p, 'textures/ui/button.png', noisy(12, 12, 1));
  p.extraFiles['textures/ui/button.json'] = new Blob(['{ "nineslice_size": 3, "base_size": [12, 12] }']);
  addEffectLayer(p, { ...createLayer('upscale', { factor: '2' }), categories: ['gui'] });
  const zip = await unzipBlob((await exportTexturePack(p, assets)).blob);
  assert.deepEqual(imageDims(zip['textures/ui/button.png']), { w: 24, h: 24 });
  assert.deepEqual(json(zip['textures/ui/button.json']), { nineslice_size: 6, base_size: [24, 24] });
});

test('Bedrock: only flipbook textures are split into frames', async () => {
  const spec = {
    ...bedrockSpec(),
    'textures/blocks/tall.png': solid(16, 32, [90, 90, 90, 255]),
    'textures/blocks/flow.png': solid(16, 32, [90, 90, 90, 255]),
  };
  const assets = fakeAssets('bedrock', 'latest', spec, ['textures/blocks/flow.png']);
  const p = newTextureProject({ name: 'Frames', edition: 'bedrock', version: 'latest' });
  addEffectLayer(p, createLayer('outline', { mode: 'tile', color: '#ffffff' }));
  const { decodeImage } = await import('../../src/core/image');
  const zip = await unzipBlob((await exportTexturePack(p, assets)).blob);
  const row = async (path: string, y: number) => {
    const im = await decodeImage(zip[path]);
    return [...im.data.subarray((y * 16 + 8) * 4, (y * 16 + 8) * 4 + 3)];
  };
  assert.deepEqual(await row('textures/blocks/tall.png', 16), [90, 90, 90], 'a tall still texture is one image');
  assert.deepEqual(await row('textures/blocks/flow.png', 16), [255, 255, 255], 'a flipbook gets a border per frame');
});

test('Bedrock: imported manifest keeps a newer min_engine_version and non-pbr capabilities', async () => {
  const assets = fakeAssets('bedrock', 'latest', bedrockSpec());
  const p = newTextureProject({ name: 'Caps', edition: 'bedrock', version: 'latest' });
  p.extraFiles['manifest.json'] = new Blob([
    JSON.stringify({
      format_version: 2,
      header: { name: 'x', uuid: p.bedrockUuids!.header, version: [1, 0, 0], min_engine_version: [1, 21, 100] },
      modules: [{ type: 'resources', uuid: p.bedrockUuids!.module, version: [1, 0, 0] }],
      capabilities: ['pbr', 'experimental_custom_ui'],
    }),
  ]);
  const manifest = json((await unzipBlob((await exportTexturePack(p, assets)).blob))['manifest.json']);
  assert.deepEqual(manifest.header.min_engine_version, [1, 21, 100]);
  assert.deepEqual(manifest.capabilities, ['experimental_custom_ui']);
});

test('an edited texture that fails to process keeps its vanilla .mcmeta', async () => {
  const assets = fakeAssets('java', '26.3', javaSpec());
  const p = newTextureProject({ name: 'Broken', edition: 'java', version: '26.3' });
  p.overrides[`${J}gui/sprites/widget/button.png`] = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])]);
  addEffectLayer(p, { ...createLayer('invert'), categories: ['gui'] });
  const res = await exportTexturePack(p, assets);
  const zip = await unzipBlob(res.blob);
  assert.ok(zip[`${J}gui/sprites/widget/button.png`]);
  assert.ok(zip[`${J}gui/sprites/widget/button.png.mcmeta`], 'nine-slice metadata kept');
  assert.ok(res.warnings.some((x) => /added as-is/.test(x)));
});

test('an empty pack exports with a friendly note', async () => {
  const res = await exportTexturePack(newTextureProject({ name: 'Empty', edition: 'java', version: '26.3' }), fakeAssets('java', '26.3', javaSpec()));
  assert.ok(res.warnings.some((x) => /doesn't change any textures/.test(x)));
});

test('import: files next to the pack folder are reported as left out', async () => {
  const zip = zipSync({
    'readme.txt': strToU8('hi'),
    'My Pack/pack.mcmeta': strToU8(JSON.stringify({ pack: { pack_format: 15, description: 'd' } })),
    [`My Pack/${J}block/stone.png`]: (await import('../../src/core/image')).encodePng(noisy(16, 16)),
  });
  const { project, warnings } = await importPack(new File([zip as BlobPart], 'x.zip'));
  assert.deepEqual(Object.keys(project.extraFiles), ['pack.mcmeta']);
  assert.ok(warnings.some((w) => /left out/.test(w) && /My Pack/.test(w)), warnings.join('\n'));
});

test('every preset leaves trims intact on a realistic stack', () => {
  const trim = img(16, 16, (x) => (x < 8 ? [224, 224, 224, 255] : [32, 32, 32, 255]));
  for (const preset of EFFECT_PRESETS) {
    const out = applyEffects(trim, preset.layers, { path: `${J}trims/items/helmet_trim.png`, category: 'armor' });
    const colours = new Set<string>();
    for (let i = 0; i < out.data.length; i += 4) colours.add(out.data.subarray(i, i + 4).join(','));
    assert.deepEqual([...colours].sort(), ['224,224,224,255', '32,32,32,255'], preset.id);
  }
});

test('pack.mcmeta is pure ASCII (older games do not read it as UTF-8) and round-trips the text', async () => {
  const { asciiJson } = await import('../../src/tools/textures/export');
  assert.equal(asciiJson('{"a":"Café ✨"}'), '{"a":"Caf\\u00e9 \\u2728"}');
  const p = newTextureProject({ name: 'Uni', edition: 'java', version: '1.12.2', description: 'Café 🌲 pack' });
  const zip = await unzipBlob((await exportTexturePack(p, fakeAssets('java', '1.12.2', javaSpec()))).blob);
  const bytes = zip['pack.mcmeta'];
  assert.ok(bytes.every((b) => b < 0x80));
  assert.deepEqual(json(bytes).pack, { pack_format: 3, description: 'Café 🌲 pack' });
});

test('import keeps the pack’s own description, even an empty one', async () => {
  const { encodePng } = await import('../../src/core/image');
  const tex = { [`${J}block/stone.png`]: encodePng(noisy(16, 16)) };
  const empty = await importPack(new File([zipSync({ 'pack.mcmeta': strToU8('{"pack":{"pack_format":15,"description":""}}'), ...tex }) as BlobPart], 'a.zip'));
  assert.equal(empty.project.description, '');
  const none = await importPack(new File([zipSync(tex) as BlobPart], 'b.zip'));
  assert.ok(none.project.description.length > 0, 'packs without pack.mcmeta get the default');
});

test('stored files that can no longer be read are left out with a note instead of failing the export', async () => {
  const gone = { arrayBuffer: () => Promise.reject(new Error('NotReadableError')), size: 1, type: '' } as unknown as Blob;
  const p = newTextureProject({ name: 'Lost', edition: 'java', version: '26.3' });
  await setOverride(p, `${J}block/stone.png`, noisy(16, 16, 1));
  p.overrides[`${J}block/dirt.png`] = gone;
  p.extraFiles['assets/minecraft/lang/en_us.json'] = gone;
  const res = await exportTexturePack(p, fakeAssets('java', '26.3', javaSpec()));
  const zip = await unzipBlob(res.blob);
  assert.ok(zip[`${J}block/stone.png`]);
  assert.equal(zip[`${J}block/dirt.png`], undefined);
  assert.equal(res.warnings.filter((w) => /couldn't be read from this browser's storage/.test(w)).length, 2, res.warnings.join('\n'));
});

test('versions in the chosen range that cannot accept the pack are named in a warning', async () => {
  const assets = fakeAssets('java', '1.19.4', javaSpec());
  const p = newTextureProject({ name: 'Wide', edition: 'java', version: '1.19.4' });
  p.compat = { minVersion: '1.19.4', maxVersion: '26.3' };
  const res = await exportTexturePack(p, assets);
  assert.ok(res.warnings.some((w) => /Minecraft 1\.19\.4 will list this pack/.test(w)), res.warnings.join('\n'));
  const ok = newTextureProject({ name: 'Fine', edition: 'java', version: '26.3' });
  ok.compat = { minVersion: '1.20.1', maxVersion: '26.3' };
  const res2 = await exportTexturePack(ok, fakeAssets('java', '26.3', javaSpec()));
  assert.ok(!res2.warnings.some((w) => /will list this pack/.test(w)), res2.warnings.join('\n'));
});
