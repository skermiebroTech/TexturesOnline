// Skin Pack Maker (/skin-pack-maker): the .mcpack it writes is a valid Bedrock skin pack, existing
// skin packs open (with clear errors for files that aren't), and a pack survives export → import.
// Run: npx tsx --test tests/unit/skins-pack-builder.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { createImageData, decodePngBytes, encodePng } from '../../src/core/image';
import type { SkinModel, SkinPackProject } from '../../src/core/types';
import { exportSkinPack, faceIcon, moveItem, newPackSkin, newSkinPack, syncPackSkin } from '../../src/tools/skins/pack/pack';
import { SkinPackImportError, parseLang, readSkinPackFile } from '../../src/tools/skins/pack/import';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** A skin with a solid colour, a face colour at (8..15, 8..15) and a hat pixel at (40, 8). */
function skin(rgba: [number, number, number, number], size = 64, h = size): ImageData {
  const img = createImageData(size, h);
  for (let i = 0; i < size * h; i++) img.data.set(rgba, i * 4);
  if (h >= 16) {
    const k = size / 64;
    for (let y = 8 * k; y < 16 * k; y++) for (let x = 8 * k; x < 16 * k; x++) img.data.set([250, 200, 150, 255], (y * size + x) * 4);
    for (let y = 8 * k; y < 16 * k; y++) for (let x = 40 * k; x < 48 * k; x++) img.data.set([0, 0, 0, 0], (y * size + x) * 4);
    img.data.set([10, 20, 30, 255], (8 * k * size + 40 * k) * 4);
  }
  return img;
}
const pngBlob = (img: ImageData) => new Blob([encodePng(img)], { type: 'image/png' });

function pack(skins: { name: string; model: SkinModel; img: ImageData }[], extra: Partial<SkinPackProject> = {}): SkinPackProject {
  const p = newSkinPack('Adventure Crew');
  p.description = 'Three friends\nfor the Dressing Room';
  p.skins = skins.map((s) => newPackSkin({ name: s.name, model: s.model, image: pngBlob(s.img) }));
  return Object.assign(p, extra);
}

/** Checks the files against what current Bedrock reads in a skin pack. */
function checkSkinPack(files: Record<string, Uint8Array>): { manifest: any; skins: any; lang: Map<string, string> } {
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  assert.equal(manifest.format_version, 2);
  assert.match(manifest.header.uuid, UUID);
  assert.equal(manifest.modules.length, 1);
  assert.equal(manifest.modules[0].type, 'skin_pack');
  assert.match(manifest.modules[0].uuid, UUID);
  assert.notEqual(manifest.header.uuid, manifest.modules[0].uuid);
  assert.deepEqual(manifest.modules[0].version, manifest.header.version);
  assert.ok(manifest.header.version.length === 3 && manifest.header.version.every(Number.isInteger));
  const skins = JSON.parse(strFromU8(files['skins.json']));
  assert.equal(skins.serialize_name, skins.localization_name);
  assert.match(skins.localization_name, /^[A-Za-z_][A-Za-z0-9_]*$/);
  const lang = parseLang(strFromU8(files['texts/en_US.lang']));
  assert.ok(lang.get(`skinpack.${skins.localization_name}`), 'the pack name is in en_US.lang');
  assert.deepEqual(JSON.parse(strFromU8(files['texts/languages.json'])), ['en_US']);
  const ids = new Set<string>();
  for (const s of skins.skins) {
    assert.ok(['geometry.humanoid.custom', 'geometry.humanoid.customSlim'].includes(s.geometry), s.geometry);
    assert.equal(s.type, 'free');
    assert.match(s.localization_name, /^[A-Za-z_][A-Za-z0-9_]*$/);
    assert.ok(!ids.has(s.localization_name), 'skin ids are unique');
    ids.add(s.localization_name);
    assert.ok(lang.get(`skin.${skins.localization_name}.${s.localization_name}`), `${s.localization_name} has a name`);
    const img = decodePngBytes(files[s.texture]);
    assert.ok((img.width === 64 && img.height === 64) || (img.width === 128 && img.height === 128), `${s.texture} is ${img.width}x${img.height}`);
    assert.equal(s.cape, undefined, 'no capes');
  }
  return { manifest, skins, lang };
}

test('the exported .mcpack is a valid Bedrock skin pack', async () => {
  const p = pack([
    { name: 'Wizard', model: 'classic', img: skin([90, 40, 160, 255]) },
    { name: 'Robot', model: 'slim', img: skin([150, 150, 160, 255], 128) },
    { name: 'Old Timer', model: 'classic', img: skin([20, 160, 40, 255], 64, 32) },
  ]);
  const res = await exportSkinPack(p);
  assert.equal(res.filename, 'Adventure Crew.mcpack');
  assert.equal(res.skinCount, 3);
  assert.equal(res.hdCount, 1);
  assert.equal(res.meta, 'Pack v1.0.0 · 3 skins · 1 HD');
  const files = unzipSync(new Uint8Array(await res.blob.arrayBuffer()));
  assert.deepEqual(Object.keys(files).sort(), ['manifest.json', 'old_timer.png', 'pack_icon.png', 'robot.png', 'skins.json', 'texts/en_US.lang', 'texts/languages.json', 'wizard.png']);
  const { manifest, skins, lang } = checkSkinPack(files);
  assert.equal(manifest.header.name, 'Adventure Crew');
  assert.equal(manifest.header.description, 'Three friends\nfor the Dressing Room');
  assert.deepEqual(manifest.header.version, [1, 0, 0]);
  assert.deepEqual(skins.skins.map((s: { geometry: string }) => s.geometry), ['geometry.humanoid.custom', 'geometry.humanoid.customSlim', 'geometry.humanoid.custom']);
  assert.deepEqual(skins.skins.map((s: { localization_name: string }) => lang.get(`skin.${skins.localization_name}.${s.localization_name}`)), ['Wizard', 'Robot', 'Old Timer']);
  // HD stays HD, the old 64x32 skin is converted to 64x64
  assert.equal(decodePngBytes(files['robot.png']).width, 128);
  const old = decodePngBytes(files['old_timer.png']);
  assert.deepEqual([old.width, old.height], [64, 64]);
  // The default icon is the first skin's face with its hat
  const icon = decodePngBytes(files['pack_icon.png']);
  assert.deepEqual([icon.width, icon.height], [128, 128]);
  assert.deepEqual([...icon.data.subarray(0, 4)], [10, 20, 30, 255], 'hat pixel on top');
  assert.deepEqual([...icon.data.subarray(16 * 4, 16 * 4 + 4)], [250, 200, 150, 255], 'face next to it');
  // The uuids are kept and the version goes up, so the installed pack is replaced
  const uuids = p.bedrockUuids!;
  const again = await exportSkinPack(p);
  const m2 = JSON.parse(strFromU8(unzipSync(new Uint8Array(await again.blob.arrayBuffer()))['manifest.json']));
  assert.equal(m2.header.uuid, uuids.header);
  assert.equal(m2.modules[0].uuid, uuids.module);
  assert.deepEqual(m2.header.version, [1, 0, 1]);
});

test('a custom icon is used as it is, and an empty description is left out', async () => {
  const icon = encodePng(skin([1, 2, 3, 255], 64, 32));
  const p = pack([{ name: 'A', model: 'classic', img: skin([5, 5, 5, 255]) }], { description: '  ', icon: new Blob([icon]) });
  const files = unzipSync(new Uint8Array(await (await exportSkinPack(p)).blob.arrayBuffer()));
  assert.deepEqual([...files['pack_icon.png']], [...icon]);
  assert.equal(JSON.parse(strFromU8(files['manifest.json'])).header.description, undefined);
});

test('an empty pack or a broken skin is refused, and the version stays', async () => {
  const empty = newSkinPack('Nothing');
  await assert.rejects(() => exportSkinPack(empty), /Add at least one skin/);
  const p = pack([{ name: 'Good', model: 'classic', img: skin([5, 5, 5, 255]) }]);
  p.skins.push(newPackSkin({ name: 'Broken', model: 'slim', image: new Blob([new Uint8Array([1, 2, 3])]) }));
  await assert.rejects(() => exportSkinPack(p), /"Broken" could not be added/);
  assert.equal(p.packVersion, undefined);
  p.skins[1].image = pngBlob(createImageData(32, 32));
  await assert.rejects(() => exportSkinPack(p), /64x64 or 128x128/);
});

test('export → import gives the same pack back', async () => {
  const imgs = [skin([200, 30, 30, 255]), skin([30, 30, 200, 255], 128), skin([30, 200, 30, 255])];
  const p = pack([
    { name: 'Red Knight', model: 'classic', img: imgs[0] },
    { name: 'Blue Mage', model: 'slim', img: imgs[1] },
    { name: 'Zoë ☆', model: 'slim', img: imgs[2] },
  ]);
  const res = await exportSkinPack(p);
  const back = await readSkinPackFile(res.blob, res.filename);
  assert.equal(back.name, 'Adventure Crew');
  assert.equal(back.description, 'Three friends\nfor the Dressing Room');
  assert.deepEqual(back.uuids, p.bedrockUuids);
  assert.deepEqual(back.version, [1, 0, 0]);
  assert.deepEqual(back.notes, []);
  assert.deepEqual(back.skins.map((s) => [s.name, s.model]), [['Red Knight', 'classic'], ['Blue Mage', 'slim'], ['Zoë ☆', 'slim']]);
  back.skins.forEach((s, i) => assert.deepEqual([...decodePngBytes(s.png).data], [...imgs[i].data], `pixels of ${s.name}`));
  assert.ok(back.icon && decodePngBytes(back.icon).width === 128);
  // ...and exporting what came back makes the same skins again, as a newer version of the same pack.
  const again = newSkinPack(back.name);
  again.description = back.description;
  again.bedrockUuids = back.uuids;
  again.packVersion = back.version;
  again.skins = back.skins.map((s) => newPackSkin({ name: s.name, model: s.model, image: new Blob([s.png.slice()]) }));
  const files1 = unzipSync(new Uint8Array(await res.blob.arrayBuffer()));
  const files2 = unzipSync(new Uint8Array(await (await exportSkinPack(again)).blob.arrayBuffer()));
  assert.equal(strFromU8(files2['skins.json']), strFromU8(files1['skins.json']));
  assert.equal(strFromU8(files2['texts/en_US.lang']), strFromU8(files1['texts/en_US.lang']));
  assert.deepEqual(JSON.parse(strFromU8(files2['manifest.json'])).header.version, [1, 0, 1]);
});

/** A hand-made skin pack, the way other tools and people write them. */
function handMade(files: Record<string, string | Uint8Array>): Uint8Array {
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, typeof v === 'string' ? strToU8(v) : v])));
}

test('packs made elsewhere open: a folder inside the zip, comments, lang comments, other geometry, capes, missing pictures', async () => {
  const a = encodePng(skin([1, 1, 1, 255]));
  const b = encodePng(skin([2, 2, 2, 255], 64, 32));
  const zip = handMade({
    'MyPack/manifest.json': `{
      // made by hand
      "format_version": 1,
      "header": { "name": "pack.name", "uuid": "3f1c8a52-6b0e-4d7a-9c21-5e8f0b4d2a17", "version": [2, 1, 0] },
      "modules": [{ "type": "skin_pack", "uuid": "a94e27d0-1c3b-4f6e-8d55-2b7c9e0f6a83", "version": [2, 1, 0] }],
    }`,
    'MyPack/skins.json': `{ "serialize_name": "Crew", "localization_name": "Crew", "skins": [
      { "localization_name": "Alpha", "geometry": "geometry.humanoid.customSlim", "texture": "Skins/Alpha.PNG", "type": "free" },
      { "localization_name": "Beta", "geometry": "geometry.custom.wings", "texture": "beta.png", "type": "paid", "cape": "cape.png" },
      { "localization_name": "Gamma", "geometry": "geometry.humanoid.custom", "texture": "gone.png", "type": "free" }
    ] }`,
    'MyPack/texts/en_US.lang': '## names\nskinpack.Crew=The Crew\t## pack\nskin.Crew.Alpha=Alpha Wolf\nskin.Crew.Beta=Beta\npack.name=Ignored\n',
    'MyPack/skins/alpha.png': a,
    'MyPack/beta.png': b,
  });
  const p = await readSkinPackFile(zip, 'crew.mcpack');
  assert.equal(p.name, 'The Crew');
  assert.deepEqual(p.uuids, { header: '3f1c8a52-6b0e-4d7a-9c21-5e8f0b4d2a17', module: 'a94e27d0-1c3b-4f6e-8d55-2b7c9e0f6a83' });
  assert.deepEqual(p.version, [2, 1, 0]);
  assert.deepEqual(p.skins.map((s) => [s.name, s.model]), [['Alpha Wolf', 'slim'], ['Beta', 'classic']]);
  assert.equal(decodePngBytes(p.skins[1].png).height, 64, 'the 64x32 skin is converted');
  assert.equal(p.notes.length, 3, p.notes.join('\n'));
  assert.match(p.notes[0], /“Gamma” was left out: its picture gone\.png isn’t in the pack/);
  assert.match(p.notes[1], /1 skin had its own 3D model/);
  assert.match(p.notes[2], /Capes were left out/);
});

test('without a manifest or names the pack still opens, with new ids', async () => {
  const p = await readSkinPackFile(handMade({ 'skins.json': '{"skins":[{"texture":"s.png","geometry":"geometry.humanoid.custom"}]}', 's.png': encodePng(skin([3, 3, 3, 255])) }), 'Old Pack.zip');
  assert.equal(p.name, 'Old Pack');
  assert.equal(p.uuids, undefined);
  assert.equal(p.version, undefined);
  assert.equal(p.skins[0].name, 'Skin 1');
  assert.match(p.notes[0], /no usable manifest/);
});

test('files that are not skin packs are refused with a reason', async () => {
  const code = async (data: Uint8Array) => {
    try {
      await readSkinPackFile(data);
      return 'opened';
    } catch (err) {
      assert.ok(err instanceof SkinPackImportError, String(err));
      return `${err.code}: ${err.message}`;
    }
  };
  assert.match(await code(strToU8('not a zip at all')), /^not-zip: .*\.mcpack or \.zip/);
  assert.match(await code(handMade({ 'manifest.json': '{"modules":[{"type":"resources"}]}', 'textures/blocks/stone.png': new Uint8Array(4) })), /^resource-pack: This is a texture pack/);
  assert.match(await code(handMade({ 'bp/manifest.json': '{"modules":[{"type":"data"}]}' })), /^other-pack:/);
  assert.match(await code(handMade({ 'readme.txt': 'hi' })), /^no-skins-json:/);
  assert.match(await code(handMade({ 'skins.json': '{ "skins": [ }' })), /^bad-json:/);
  assert.match(await code(handMade({ 'skins.json': '{ "skins": [] }' })), /^no-skins:/);
  assert.match(await code(handMade({ 'skins.json': '{ "skins": [{ "texture": "x.png" }] }', 'x.png': encodePng(createImageData(32, 32)) })), /^no-usable-skins: .*64x64 or 128x128 pixels \(this one is 32x32\)/);
});

test('saved skins keep the pack up to date; an arm style picked in the pack stays', () => {
  const s = newPackSkin({ name: 'Mine', model: 'classic', image: new Blob(['a']), from: { id: 'p1', updatedAt: 10, model: 'classic' } });
  assert.equal(s.skinId, 'p1');
  assert.equal(syncPackSkin(s, { image: new Blob(['b']), model: 'classic', updatedAt: 10 }), false, 'nothing new');
  s.model = 'slim'; // picked in the pack
  const later = new Blob(['c']);
  assert.equal(syncPackSkin(s, { image: later, model: 'classic', updatedAt: 20 }), true);
  assert.equal(s.image, later);
  assert.equal(s.model, 'slim', 'the pack’s choice stays while the editor kept its arms');
  assert.equal(syncPackSkin(s, { image: later, model: 'slim', updatedAt: 30 }), true);
  assert.equal(s.model, 'slim');
  s.model = 'classic';
  syncPackSkin(s, { image: later, model: 'classic', updatedAt: 40 });
  assert.equal(s.model, 'classic', 'arms changed in the editor come along');
  assert.equal(syncPackSkin(s, undefined), false, 'a deleted skin leaves the picture as it was');
});

test('moving skins and the face icon', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 1, 9), ['a', 'c', 'b']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 5, 0), ['a', 'b', 'c']);
  const hd = faceIcon(skin([0, 0, 0, 255], 128), 32);
  assert.deepEqual([hd.width, hd.height], [32, 32]);
  assert.deepEqual([...hd.data.subarray(0, 4)], [10, 20, 30, 255]);
  assert.deepEqual([...hd.data.subarray(4, 8)], [10, 20, 30, 255], "each HD face pixel is 2x2 here");
  assert.deepEqual([...hd.data.subarray(8, 12)], [250, 200, 150, 255]);
});
