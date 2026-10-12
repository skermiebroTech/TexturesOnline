// Skin pack maker: choosing and ordering the extra skins, and multi-skin .mcpack exports.
// Run: npx tsx --test tests/unit/skins-pack.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { createImageData, decodePngBytes, encodePng } from '../../src/core/image';
import { exportBedrockPack, orderPackSkinIds, packNameOf, pickPackSkins, skinCountLabel, type SkinProjectData } from '../../src/tools/skins/export';

function solidSkin(rgba: [number, number, number, number], w = 64, h = 64): ImageData {
  const img = createImageData(w, h);
  for (let i = 0; i < w * h; i++) img.data.set(rgba, i * 4);
  return img;
}
const pngBlob = (img: ImageData) => new Blob([encodePng(img)], { type: 'image/png' });
const project = (id: string, name: string, model: 'classic' | 'slim', img: ImageData): SkinProjectData => ({ id, kind: 'skin', name, model, image: pngBlob(img), createdAt: 1, updatedAt: 1 });

test('pickPackSkins keeps the saved order and skips deleted, duplicate and self ids', () => {
  const available = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(pickPackSkins(['c', 'gone', 'a', 'c', 'self'], [...available, { id: 'self' }], 'self').map((p) => p.id), ['c', 'a']);
  assert.deepEqual(pickPackSkins(undefined, available, 'x'), []);
  assert.deepEqual(pickPackSkins([], available, 'x'), []);
});

test('orderPackSkinIds keeps existing pack order and appends newly ticked skins', () => {
  assert.deepEqual(orderPackSkinIds(undefined, ['b', 'a']), ['b', 'a']);
  assert.deepEqual(orderPackSkinIds(['a', 'c'], ['c', 'b', 'a']), ['a', 'c', 'b']);
  // Unticked and deleted ones drop out.
  assert.deepEqual(orderPackSkinIds(['a', 'gone', 'c'], ['c']), ['c']);
  assert.deepEqual(orderPackSkinIds(['a'], []), []);
});

test('pack name falls back to the project name', () => {
  assert.equal(packNameOf({ name: 'Red Arms' }), 'Red Arms');
  assert.equal(packNameOf({ name: 'Red Arms', packName: '  ' }), 'Red Arms');
  assert.equal(packNameOf({ name: 'Red Arms', packName: ' Squad ' }), 'Squad');
  assert.equal(packNameOf({ name: '' }), 'My Skin');
  assert.equal(skinCountLabel(1), '1 skin');
  assert.equal(skinCountLabel(3), '3 skins');
});

test('multi-skin .mcpack: every skin keeps its name and arm model, current skin first', async () => {
  const red = solidSkin([200, 20, 20, 255]);
  const main = project('main', 'Red Arms', 'slim', red);
  main.packName = 'My Squad';
  const blue = project('b', 'Blue Knight', 'classic', solidSkin([20, 20, 200, 255]));
  // A legacy 64x32 skin is converted to 64x64 on the way in.
  const old = project('o', 'Old Timer', 'classic', solidSkin([20, 200, 20, 255], 64, 32));

  const first = await exportBedrockPack(main, red, [blue, old]);
  assert.equal(first.filename, 'My Squad.mcpack');
  assert.equal(first.skinCount, 3);
  assert.equal(first.meta, 'Pack v1.0.0 · 3 skins');
  const files = unzipSync(new Uint8Array(await first.blob.arrayBuffer()));
  const skins = JSON.parse(strFromU8(files['skins.json']));
  assert.deepEqual(
    skins.skins.map((s: { geometry: string }) => s.geometry),
    ['geometry.humanoid.customSlim', 'geometry.humanoid.custom', 'geometry.humanoid.custom'],
  );
  const lang = strFromU8(files['texts/en_US.lang']);
  assert.ok(lang.includes(`skinpack.${skins.localization_name}=My Squad`), lang);
  for (const name of ['Red Arms', 'Blue Knight', 'Old Timer']) assert.ok(lang.includes(`=${name}\n`), `${name} in ${lang}`);
  const textures = skins.skins.map((s: { texture: string }) => decodePngBytes(files[s.texture]));
  assert.deepEqual(textures.map((t: ImageData) => [t.width, t.height]), [[64, 64], [64, 64], [64, 64]]);
  assert.deepEqual([...textures[0].data.subarray(0, 4)], [200, 20, 20, 255]);
  assert.deepEqual([...textures[1].data.subarray(0, 4)], [20, 20, 200, 255]);

  // Re-export: same uuids, version bumped.
  const uuids = main.bedrockUuids!;
  const second = await exportBedrockPack(main, red, [blue]);
  const manifest2 = JSON.parse(strFromU8(unzipSync(new Uint8Array(await second.blob.arrayBuffer()))['manifest.json']));
  assert.equal(manifest2.header.uuid, uuids.header);
  assert.deepEqual(manifest2.header.version, [1, 0, 1]);
  assert.equal(second.meta, 'Pack v1.0.1 · 2 skins');
});

test('a broken saved skin names itself in the error and leaves the pack version alone', async () => {
  const red = solidSkin([200, 20, 20, 255]);
  const main = project('main', 'Red Arms', 'classic', red);
  const broken: SkinProjectData = { ...project('x', 'Broken One', 'classic', red), image: new Blob([new Uint8Array([1, 2, 3])]) };
  await assert.rejects(() => exportBedrockPack(main, red, [broken]), /"Broken One" could not be added/);
  assert.equal(main.packVersion, undefined);
  const single = await exportBedrockPack(main, red);
  assert.equal(single.meta, 'Pack v1.0.0 · 1 skin');
  assert.equal(single.filename, 'Red Arms.mcpack');
});
