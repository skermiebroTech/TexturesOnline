import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { importPack, guessJavaVersion } from '../../src/tools/textures/import';
import { exportTexturePack } from '../../src/tools/textures/export';
import { newTextureProject, setOverride, addEffectLayer } from '../../src/tools/textures/project';
import { createLayer } from '../../src/tools/textures/effects';
import { encodePng, encodeTga } from '../../src/core/image';
import { bedrockSpec, fakeAssets, img, javaSpec, json, noisy, unzipBlob } from '../tools/texlogic/fixtures';

const J = 'assets/minecraft/textures/';
const bytesOf = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
const fileOf = (data: Uint8Array | Blob, name: string) => new File([data as BlobPart], name);
const mcmeta = (pack: object, extra: object = {}) => strToU8(JSON.stringify({ pack, ...extra }));

test('Java round trip: export then import gives back the same pack', async () => {
  const assets = fakeAssets('java', '26.3', javaSpec());
  const p = newTextureProject({ name: 'Round Trip', edition: 'java', version: '26.3', description: 'Line one', resolution: 32 });
  await setOverride(p, `${J}block/stone.png`, noisy(32, 32, 1));
  await setOverride(p, `${J}item/apple.png`, noisy(32, 32, 2));
  p.extraFiles['assets/minecraft/models/block/stone.json'] = new Blob(['{"parent":"block/cube_all"}']);
  p.icon = new Blob([encodePng(noisy(64, 64, 3))], { type: 'image/png' });
  const { blob, filename } = await exportTexturePack(p, assets);

  const { project: q, warnings } = await importPack(fileOf(blob, filename));
  assert.deepEqual(warnings, []);
  assert.equal(q.edition, 'java');
  assert.equal(q.version, '26.3');
  assert.equal(q.name, 'Round Trip');
  assert.equal(q.description, 'Line one');
  assert.equal(q.resolution, 32);
  assert.equal(q.compat, undefined);
  assert.deepEqual(Object.keys(q.overrides).sort(), [`${J}block/stone.png`, `${J}item/apple.png`]);
  for (const k of Object.keys(q.overrides)) assert.deepEqual(await bytesOf(q.overrides[k]), await bytesOf(p.overrides[k]));
  assert.deepEqual(Object.keys(q.extraFiles).sort(), ['assets/minecraft/models/block/stone.json', 'pack.mcmeta']);
  assert.deepEqual(await bytesOf(q.icon!), await bytesOf(p.icon));
  assert.notEqual(q.id, p.id);

  // exporting the imported project again reproduces the same files
  const again = await unzipBlob((await exportTexturePack(q, assets)).blob);
  const first = await unzipBlob(blob);
  assert.deepEqual(Object.keys(again).sort(), Object.keys(first).sort());
  assert.deepEqual(json(again['pack.mcmeta']), json(first['pack.mcmeta']));
});

test('Java: version guessed from every pack.mcmeta era', async () => {
  const cases: [object, string, { minVersion: string; maxVersion: string } | undefined][] = [
    [{ pack_format: 1, description: 'a' }, '1.8.9', undefined],
    [{ pack_format: 15, description: 'a' }, '1.20.1', undefined],
    [{ pack_format: 34, description: 'a' }, '1.21.1', undefined],
    [{ pack_format: 18, supported_formats: [18, 34], description: 'a' }, '1.21.1', { minVersion: '1.20.2', maxVersion: '1.21.1' }],
    [{ min_format: 69, max_format: 97, description: 'a' }, '26.3', { minVersion: '1.21.9', maxVersion: '26.3' }],
    [{ min_format: [97, 1], max_format: 97, description: 'a' }, '26.3', undefined],
    [{ pack_format: 15, supported_formats: [15, 97], min_format: 15, max_format: 97, description: 'a' }, '26.3', { minVersion: '1.20', maxVersion: '26.3' }],
  ];
  for (const [pack, version, compat] of cases) {
    const zip = zipSync({ 'pack.mcmeta': mcmeta(pack), [`${J}block/dirt.png`]: encodePng(noisy(16, 16)) });
    const { project, warnings } = await importPack(fileOf(zip, 'p.zip'));
    assert.equal(project.version, version, JSON.stringify(pack));
    assert.deepEqual(project.compat, compat, JSON.stringify(pack));
    assert.deepEqual(warnings, [], JSON.stringify(pack));
  }
  // snapshot-only format: closest release, with a note
  const w: string[] = [];
  assert.equal((await guessJavaVersion({ min: { major: 14, minor: 0 }, max: { major: 14, minor: 0 } }, w)).version, '1.19.4');
  assert.equal(w.length, 1);
});

test('Java: nested single folder, junk entries, formatted description, OptiFine files', async () => {
  const zip = zipSync({
    '__MACOSX/Fancy/._pack.mcmeta': strToU8('junk'),
    'Fancy Pack/pack.mcmeta': mcmeta({ pack_format: 15, description: [{ text: 'Fancy', color: 'gold' }, { text: ' §lPack' }] }),
    'Fancy Pack/pack.png': encodePng(noisy(16, 16)),
    [`Fancy Pack/${J}block/stone.png`]: encodePng(noisy(16, 16)),
    [`Fancy Pack/${J}block/stone.png.mcmeta`]: strToU8('{"animation":{}}'),
    'Fancy Pack/assets/minecraft/optifine/ctm/glass/1.properties': strToU8('method=ctm'),
    'Fancy Pack/assets/mymod/textures/item/gem.png': encodePng(noisy(16, 16)),
    'Fancy Pack/.DS_Store': strToU8('x'),
  });
  const { project, warnings } = await importPack(fileOf(zip, 'Fancy_Pack (1).zip'));
  assert.equal(project.name, 'Fancy Pack');
  assert.equal(project.version, '1.20.1');
  assert.equal(project.description, 'Fancy Pack');
  assert.deepEqual(Object.keys(project.overrides), [`${J}block/stone.png`]);
  assert.ok(project.extraFiles[`${J}block/stone.png.mcmeta`]);
  assert.ok(project.extraFiles['assets/mymod/textures/item/gem.png']);
  assert.ok(project.icon);
  assert.equal(warnings.length, 3, warnings.join('\n'));
  assert.ok(warnings.some((x) => /formatting/.test(x)));
  assert.ok(warnings.some((x) => /OptiFine/.test(x)));
  assert.ok(warnings.some((x) => /mods/.test(x)));
});

test('Bedrock round trip keeps uuids, bumps from the imported version, keeps .tga', async () => {
  const assets = fakeAssets('bedrock', 'latest', bedrockSpec());
  const p = newTextureProject({ name: 'Bedrock Trip', edition: 'bedrock', version: 'latest', description: 'Desc' });
  const mask = img(16, 16, (x, y) => (y < 4 ? [200, 200, 200, 255] : [120 + x, 80, 50, 0]));
  await setOverride(p, 'textures/blocks/grass_side.tga', mask);
  await setOverride(p, 'textures/blocks/stone.png', noisy(16, 16, 5));
  p.extraFiles['textures/blocks/stone.texture_set.json'] = new Blob(['{}']);
  const { blob, filename } = await exportTexturePack(p, assets);
  assert.match(filename, /\.mcpack$/);

  const { project: q, warnings } = await importPack(fileOf(blob, filename));
  assert.deepEqual(warnings, []);
  assert.equal(q.edition, 'bedrock');
  assert.equal(q.version, 'latest');
  assert.equal(q.name, 'Bedrock Trip');
  assert.equal(q.description, 'Desc');
  assert.deepEqual(q.bedrockUuids, p.bedrockUuids);
  assert.deepEqual(q.packVersion, [1, 0, 0]);
  assert.deepEqual(Object.keys(q.overrides).sort(), ['textures/blocks/grass_side.tga', 'textures/blocks/stone.png']);
  assert.deepEqual(await bytesOf(q.overrides['textures/blocks/grass_side.tga']), encodeTga(mask));
  assert.ok(q.extraFiles['manifest.json']);
  assert.ok(q.extraFiles['textures/blocks/stone.texture_set.json']);
  assert.ok(q.icon);

  addEffectLayer(q, createLayer('saturation'));
  const manifest = json((await unzipBlob((await exportTexturePack(q, assets)).blob))['manifest.json']);
  assert.deepEqual(manifest.header.version, [1, 0, 1]);
  assert.equal(manifest.header.uuid, p.bedrockUuids!.header);
});

test('Bedrock: .mcaddon with behavior + resource packs, lang names, format 3 versions, PBR maps', async () => {
  const header = '4f1c3b3e-8a0b-4d0e-9a53-3a2b1c0d9e8f';
  const module = '0b2d6c1e-5f4a-4b3c-8d2e-1f0a9b8c7d6e';
  const rp = zipSync({
    'manifest.json': strToU8(JSON.stringify({
      format_version: 3,
      header: { name: 'pack.name', description: 'pack.description', uuid: header, version: '2.4.0', min_engine_version: '1.21.0' },
      modules: [{ type: 'resources', uuid: module, version: '2.4.0' }],
      capabilities: ['pbr'],
    })),
    'texts/en_US.lang': strToU8('## comment\npack.name=Shiny Blocks\t#note\npack.description=So shiny\n'),
    'textures/blocks/stone.png': encodePng(noisy(32, 32)),
    'textures/blocks/stone_mers.tga': encodeTga(noisy(32, 32)),
    'textures/blocks/stone.texture_set.json': strToU8('{"format_version":"1.21.30","minecraft:texture_set":{"color":"stone","metalness_emissive_roughness_subsurface":"stone_mers"}}'),
  });
  const bp = zipSync({
    'manifest.json': strToU8(JSON.stringify({ format_version: 2, header: { name: 'BP', uuid: '11111111-2222-4333-8444-555555555555', version: [1, 0, 0] }, modules: [{ type: 'data', uuid: '66666666-7777-4888-9999-000000000000', version: [1, 0, 0] }] })),
  });
  const addon = zipSync({ 'Behavior.mcpack': bp, 'Shiny.mcpack': rp });
  const { project, warnings } = await importPack(fileOf(addon, 'bundle.mcaddon'));
  assert.equal(project.edition, 'bedrock');
  assert.equal(project.name, 'Shiny Blocks');
  assert.equal(project.description, 'So shiny');
  assert.deepEqual(project.bedrockUuids, { header, module });
  assert.deepEqual(project.packVersion, [2, 4, 0]);
  assert.equal(project.resolution, 32);
  assert.deepEqual(Object.keys(project.overrides), ['textures/blocks/stone.png']);
  assert.ok(project.extraFiles['textures/blocks/stone_mers.tga'], 'PBR maps are kept as extra files');
  assert.ok(warnings.some((w) => /Vibrant Visuals/.test(w)));
});

test('friendly errors for things that are not resource packs', async () => {
  const skin = zipSync({ 'manifest.json': strToU8(JSON.stringify({ format_version: 1, header: { name: 's', uuid: '11111111-2222-4333-8444-555555555555', version: [1, 0, 0] }, modules: [{ type: 'skin_pack', uuid: '66666666-7777-4888-9999-000000000000', version: [1, 0, 0] }] })), 'skins.json': strToU8('{}') });
  await assert.rejects(importPack(fileOf(skin, 'skins.mcpack')), /skin pack/);
  const bp = zipSync({ 'manifest.json': strToU8(JSON.stringify({ header: { name: 'b' }, modules: [{ type: 'data' }] })) });
  await assert.rejects(importPack(fileOf(bp, 'bp.mcpack')), /behavior pack/);
  await assert.rejects(importPack(fileOf(zipSync({ 'readme.txt': strToU8('hi') }), 'x.zip')), /doesn't contain a Minecraft resource pack/);
  await assert.rejects(importPack(fileOf(encodePng(noisy(4, 4)), 'x.png')), /single image/);
  await assert.rejects(importPack(fileOf(strToU8('not a zip at all'), 'x.zip')), /isn't a \.zip/);
  await assert.rejects(importPack(fileOf(new Uint8Array(0), 'x.zip')), /empty/);
});

test('packs without pack.mcmeta / manifest.json are recognised by their folders', async () => {
  const java = zipSync({ [`MyPack/${J}block/stone.png`]: encodePng(noisy(16, 16)) });
  const a = await importPack(fileOf(java, 'MyPack.zip'));
  assert.equal(a.project.edition, 'java');
  assert.equal(a.project.version, '26.3');
  assert.deepEqual(Object.keys(a.project.overrides), [`${J}block/stone.png`]);
  assert.ok(a.warnings.some((w) => /pack\.mcmeta/.test(w)));
  const bed = zipSync({ 'textures/blocks/stone.png': encodePng(noisy(16, 16)) });
  const b = await importPack(fileOf(bed, 'Rocks.mcpack'));
  assert.equal(b.project.edition, 'bedrock');
  assert.equal(b.project.name, 'Rocks');
  assert.ok(b.project.bedrockUuids);
  assert.ok(b.warnings.some((w) => /manifest\.json/.test(w)));
});
