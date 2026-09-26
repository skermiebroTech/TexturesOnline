import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildResourceManifest, buildSkinPackFiles, buildSkinPackFilesAsync, bumpPackVersion, toSkinIdentifier } from '../../src/editions/bedrock/manifest';
import { createImageData, decodePngBytes, encodePng } from '../../src/core/image';
import { readZip, writeZip } from '../../src/core/zip';
import { openBytesZip } from '../../src/core/rangezip';
import { uuidv4, isUuid } from '../../src/core/uuid';

const U1 = '8b0f1a52-6c3e-4f2a-9d57-2f5e9a1c0b11';
const U2 = '3d9c7e20-51a4-4c8b-8f0e-7a6b2c4d9e22';

test('uuidv4 produces distinct lowercase v4 UUIDs', () => {
  const a = uuidv4();
  const b = uuidv4();
  assert.ok(isUuid(a) && isUuid(b));
  assert.notEqual(a, b);
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('resource pack manifest matches research §2.3', () => {
  const text = buildResourceManifest({
    name: 'My Texture Pack',
    description: 'Made with TexturesOnline',
    uuids: { header: U1, module: U2 },
    version: [1, 0, 0],
    authors: ['Someone'],
  });
  assert.ok(!text.startsWith('﻿'));
  assert.deepEqual(JSON.parse(text), {
    format_version: 2,
    header: { name: 'My Texture Pack', description: 'Made with TexturesOnline', uuid: U1, version: [1, 0, 0], min_engine_version: [1, 21, 0] },
    modules: [{ type: 'resources', uuid: U2, version: [1, 0, 0] }],
    metadata: { authors: ['Someone'], generated_with: { texturesonline: ['1.0.0'] } },
  });
  assert.ok(!('capabilities' in JSON.parse(text)), 'no pbr capability on texture packs');
  const noAuthor = JSON.parse(buildResourceManifest({ name: 'x', description: '', uuids: { header: U1, module: U2 }, version: [1, 0, 3], minEngine: [1, 26, 50] }));
  assert.deepEqual(noAuthor.metadata, { generated_with: { texturesonline: ['1.0.0'] } });
  assert.deepEqual(noAuthor.header.min_engine_version, [1, 26, 50]);
  assert.deepEqual(noAuthor.modules[0].version, [1, 0, 3]);
});

test('capabilities: pbr raises min_engine_version to 1.21.120 (never lowers it)', () => {
  const vv = JSON.parse(buildResourceManifest({ name: 'VV', description: 'd', uuids: { header: U1, module: U2 }, version: [1, 0, 0], capabilities: ['pbr'] }));
  assert.deepEqual(vv.capabilities, ['pbr']);
  assert.deepEqual(vv.header.min_engine_version, [1, 21, 120]);
  const vv2 = JSON.parse(buildResourceManifest({ name: 'VV', description: 'd', uuids: { header: U1, module: U2 }, version: [1, 0, 0], capabilities: ['pbr', 'pbr'], minEngine: [1, 26, 50] }));
  assert.deepEqual(vv2.capabilities, ['pbr']);
  assert.deepEqual(vv2.header.min_engine_version, [1, 26, 50]);
});

test('manifest input validation', () => {
  assert.throws(() => buildResourceManifest({ name: 'x', description: '', uuids: { header: 'nope', module: U2 }, version: [1, 0, 0] }), /IDs are invalid/);
  assert.throws(() => buildResourceManifest({ name: 'x', description: '', uuids: { header: U1, module: U1 }, version: [1, 0, 0] }), /must be different/);
  assert.deepEqual(bumpPackVersion(undefined), [1, 0, 0]);
  assert.deepEqual(bumpPackVersion([1, 0, 4]), [1, 0, 5]);
  const m = JSON.parse(buildResourceManifest({ name: '  Multi\nline  ', description: 'a\r\nb', uuids: { header: U1.toUpperCase(), module: U2 }, version: [1, 0, 0] }));
  assert.equal(m.header.name, 'Multi line');
  assert.equal(m.header.description, 'a\nb');
  assert.equal(m.header.uuid, U1);
});

function skin(w: number, h: number, rgba = [200, 30, 30, 255]): Uint8Array {
  const img = createImageData(w, h);
  for (let i = 0; i < w * h; i++) img.data.set(rgba, i * 4);
  return encodePng(img);
}

test('skin pack files match research §5.7', () => {
  const files = buildSkinPackFiles({
    name: 'TexturesOnline Example Skins',
    skins: [
      { name: 'Red (Classic)', model: 'classic', png: skin(64, 64) },
      { name: 'Blue (Slim)', model: 'slim', png: skin(64, 64, [30, 30, 200, 255]) },
    ],
    uuids: { header: U1, module: U2 },
    version: [1, 0, 0],
    author: 'Example Author',
  });
  assert.deepEqual(Object.keys(files).sort(), ['blue_slim.png', 'manifest.json', 'red_classic.png', 'skins.json', 'texts/en_US.lang', 'texts/languages.json']);
  assert.deepEqual(JSON.parse(files['manifest.json'] as string), {
    format_version: 2,
    header: { name: 'TexturesOnline Example Skins', uuid: U1, version: [1, 0, 0] },
    modules: [{ type: 'skin_pack', uuid: U2, version: [1, 0, 0] }],
  });
  const skins = JSON.parse(files['skins.json'] as string);
  const packId = 'TexturesOnlineExampleSkins_8b0f1a52';
  assert.equal(skins.serialize_name, packId);
  assert.equal(skins.localization_name, skins.serialize_name);
  assert.match(skins.serialize_name, /^[A-Za-z0-9_]+$/);
  assert.deepEqual(skins.skins, [
    { localization_name: 'RedClassic', geometry: 'geometry.humanoid.custom', texture: 'red_classic.png', type: 'free' },
    { localization_name: 'BlueSlim', geometry: 'geometry.humanoid.customSlim', texture: 'blue_slim.png', type: 'free' },
  ]);
  assert.equal(
    files['texts/en_US.lang'],
    `skinpack.${packId}=TexturesOnline Example Skins\nskinpack.${packId}.by=Example Author\nskin.${packId}.RedClassic=Red (Classic)\nskin.${packId}.BlueSlim=Blue (Slim)\n`,
  );
  assert.deepEqual(JSON.parse(files['texts/languages.json'] as string), ['en_US']);
});

test('skin pack: legacy 64x32 skins are converted, duplicates made unique, bad sizes rejected', async () => {
  const files = buildSkinPackFiles({
    name: '!!!',
    skins: [
      { name: 'Hero', model: 'classic', png: skin(64, 32) },
      { name: 'Hero', model: 'classic', png: skin(128, 128) },
      { name: '', model: 'slim', png: skin(64, 64) },
    ],
    uuids: { header: U1, module: U2 },
    version: [2, 0, 1],
  });
  const skins = JSON.parse(files['skins.json'] as string);
  assert.equal(skins.serialize_name, 'Skins_8b0f1a52');
  assert.deepEqual(skins.skins.map((s: { localization_name: string }) => s.localization_name), ['Hero', 'Hero2', 'Skin3']);
  assert.deepEqual(skins.skins.map((s: { texture: string }) => s.texture), ['hero.png', 'hero_2.png', 'skin_3.png']);
  const converted = decodePngBytes(files['hero.png'] as Uint8Array);
  assert.equal(converted.width, 64);
  assert.equal(converted.height, 64);
  assert.equal(decodePngBytes(files['hero_2.png'] as Uint8Array).width, 128);
  assert.throws(
    () => buildSkinPackFiles({ name: 'x', skins: [{ name: 'a', model: 'classic', png: skin(32, 32) }], uuids: { header: U1, module: U2 }, version: [1, 0, 0] }),
    /64x64 or 128x128/,
  );
  assert.throws(() => buildSkinPackFiles({ name: 'x', skins: [], uuids: { header: U1, module: U2 }, version: [1, 0, 0] }), /at least one skin/);
  // Blob skins: async variant validates and converts them.
  const blobFiles = await buildSkinPackFilesAsync({
    name: 'Blobs',
    skins: [{ name: 'Old', model: 'classic', png: new Blob([skin(64, 32) as Uint8Array<ArrayBuffer>], { type: 'image/png' }) }],
    uuids: { header: U1, module: U2 },
    version: [1, 0, 0],
  });
  assert.equal(decodePngBytes(blobFiles['old.png'] as Uint8Array).height, 64);
  assert.equal(toSkinIdentifier('Épée du Roi', 'X'), 'EpeeDuRoi');
  assert.equal(toSkinIdentifier('9 lives', 'X'), '_9Lives');
});

test('.mcpack zip: manifest at the root, PNG stored, JSON deflated, round trip', async () => {
  const files = buildSkinPackFiles({
    name: 'Zip Test',
    skins: [{ name: 'A', model: 'classic', png: skin(64, 64) }],
    uuids: { header: U1, module: U2 },
    version: [1, 0, 0],
  });
  files['textures/blocks/extra.tga'] = new Blob([new Uint8Array([1, 2, 3])]);
  const blob = await writeZip(files);
  assert.equal(blob.type, 'application/zip');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const zip = await openBytesZip(bytes);
  assert.equal(zip.get('manifest.json')?.method, 8);
  assert.equal(zip.get('a.png')?.method, 0);
  assert.ok(zip.names().every((n) => !n.startsWith('/') && !n.endsWith('/')));
  const back = await readZip(blob);
  assert.deepEqual(Object.keys(back).sort(), Object.keys(files).sort());
  assert.equal(new TextDecoder().decode(back['manifest.json']), files['manifest.json']);
  assert.deepEqual([...back['textures/blocks/extra.tga']], [1, 2, 3]);
  // Filter + junk entries
  const junk = await writeZip({ 'pack/manifest.json': '{}', '__MACOSX/pack/._manifest.json': 'x', 'pack/.DS_Store': 'x' });
  assert.deepEqual(Object.keys(await readZip(junk)), ['pack/manifest.json']);
  assert.deepEqual(Object.keys(await readZip(blob, (p) => p.endsWith('.json'))).sort(), ['manifest.json', 'skins.json', 'texts/languages.json']);
  await assert.rejects(readZip(new Uint8Array([1, 2, 3, 4])), /isn't a \.zip/);
});
