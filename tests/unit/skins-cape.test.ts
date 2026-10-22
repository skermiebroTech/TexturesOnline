// The cape maker's pure parts: the 64x32 layout, starter designs, opening cape files, copying the cape
// onto the elytra, and the files it downloads (cape PNG, Java and Bedrock elytra packs). Also checks
// that Bedrock skin packs carry no cape (Mojang's pack checker reports one in a non-Mojang skin pack).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { createImageData, decodePngBytes, encodePng } from '../../src/core/image';
import {
  BEDROCK_ELYTRA_PATH,
  CAPE_DESIGNS,
  CAPE_H,
  CAPE_REGIONS,
  CAPE_W,
  CapeFileError,
  JAVA_ELYTRA_PATH,
  JAVA_LEGACY_ELYTRA_PATH,
  copyCapeToElytra,
  countSeeThrough,
  createCapeDesign,
  isBlankCape,
  mirrorWithinRegion,
  normalizeCapeImage,
  regionAt,
  regionOf,
  usedMask,
} from '../../src/tools/skins/cape/cape';
import { buildElytraPack, capeIcon, capePngFile, elytraTexture, elytraTexturePath, javaHasElytra } from '../../src/tools/skins/cape/pack';
import { exportBedrockPack, type SkinProjectData } from '../../src/tools/skins/export';

const px = (img: ImageData, x: number, y: number) => [...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];

test('cape layout: faces do not overlap, match the game model and stay inside 64x32', () => {
  const seen = new Uint8Array(CAPE_W * CAPE_H);
  for (const r of CAPE_REGIONS) {
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= CAPE_W && r.y + r.h <= CAPE_H, r.id);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      assert.equal(seen[y * CAPE_W + x], 0, `${r.id} overlaps at ${x},${y}`);
      seen[y * CAPE_W + x] = 1;
    }
  }
  // Cape box 10x16x1 at uv (0,0) and elytra wing 10x20x2 at uv (22,0), as in the game's models.
  assert.deepEqual(regionOf('capeOutside'), { id: 'capeOutside', part: 'cape', x: 1, y: 1, w: 10, h: 16 });
  assert.deepEqual(regionOf('capeInside'), { id: 'capeInside', part: 'cape', x: 12, y: 1, w: 10, h: 16 });
  assert.deepEqual(regionOf('wingOutside'), { id: 'wingOutside', part: 'elytra', x: 36, y: 2, w: 10, h: 20 });
  const used = usedMask().reduce((a, b) => a + b, 0);
  assert.equal(used, 2 * (10 * 16 + 10 * 1 + 1 * 16) + 2 * (10 * 20 + 10 * 2 + 2 * 20));
  assert.equal(regionAt(50, 20), null);
  assert.equal(regionAt(0, 0), null, 'corner of the cape box is unused');
  assert.equal(regionAt(5, 5)?.id, 'capeOutside');
});

test('mirror painting reflects within a face, not across the whole texture', () => {
  assert.deepEqual(mirrorWithinRegion(1, 4), [[10, 4]]);
  assert.deepEqual(mirrorWithinRegion(36, 2), [[45, 2]]);
  assert.deepEqual(mirrorWithinRegion(0, 5), [], 'a 1-pixel-wide edge has no twin');
  assert.deepEqual(mirrorWithinRegion(60, 30), []);
});

test('every starter design paints all used pixels, solid on the cape, and nothing outside', () => {
  const mask = usedMask();
  const outsides = new Set<string>();
  for (const id of CAPE_DESIGNS) {
    const img = createCapeDesign(id);
    assert.equal(img.width, 64);
    assert.equal(img.height, 32);
    for (let i = 0; i < mask.length; i++) assert.equal(img.data[i * 4 + 3], mask[i] ? 255 : 0, `${id} pixel ${i % 64},${Math.floor(i / 64)}`);
    assert.equal(countSeeThrough(img), 0, id);
    assert.equal(isBlankCape(img), false);
    const o = regionOf('capeOutside');
    const face: number[] = [];
    for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) face.push(...px(img, x, y));
    outsides.add(face.join(','));
  }
  assert.ok(CAPE_DESIGNS.length >= 10);
  assert.equal(outsides.size, CAPE_DESIGNS.length, 'designs are distinct');
  // Drawn by code: the same design comes out the same every time.
  assert.deepEqual([...createCapeDesign('stars').data], [...createCapeDesign('stars').data]);
});

test('blank and see-through capes are told apart', () => {
  const img = createImageData(64, 32);
  assert.equal(isBlankCape(img), true);
  // Paint in the unused corner only: still blank.
  img.data.set([255, 0, 0, 255], (31 * 64 + 63) * 4);
  assert.equal(isBlankCape(img), true);
  img.data.set([255, 0, 0, 128], (5 * 64 + 5) * 4);
  assert.equal(isBlankCape(img), false);
  // Half see-through counts too: every cape pixel here.
  assert.equal(countSeeThrough(img), 2 * (10 * 16 + 10 + 16));
  const solid = createCapeDesign('plain');
  solid.data[(5 * 64 + 5) * 4 + 3] = 128;
  solid.data[(10 * 64 + 40) * 4 + 3] = 0; // elytra pixels may be see-through
  assert.equal(countSeeThrough(solid), 1);
});

test('copying the cape onto the elytra stretches the outside and inside and leaves the cape alone', () => {
  const src = createCapeDesign('split'); // top half blue, bottom half white on the outside
  const before = [...src.data];
  const out = copyCapeToElytra(src);
  assert.deepEqual([...src.data], before, 'input untouched');
  const wing = regionOf('wingOutside');
  assert.deepEqual(px(out, wing.x, wing.y), px(src, 1, 1));
  assert.deepEqual(px(out, wing.x + 9, wing.y + 19), px(src, 10, 16));
  assert.notDeepEqual(px(out, wing.x, wing.y), px(out, wing.x, wing.y + 19));
  for (let y = 0; y < 17; y++) for (let x = 0; x < 22; x++) assert.deepEqual(px(out, x, y), px(src, x, y));
});

test('opening cape files: 64x32, HD multiples, OptiFine 46x22 and old 22x17; others are refused', () => {
  const make = (w: number, h: number, fill: (x: number, y: number) => number[]) => {
    const img = createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img.data.set(fill(x, y), (y * w + x) * 4);
    return img;
  };
  const plain = createCapeDesign('stripes');
  const same = normalizeCapeImage(plain);
  assert.equal(same.change, 'none');
  assert.deepEqual([...same.image.data], [...plain.data]);
  // HD 128x64: every second pixel.
  const hd = make(128, 64, (x, y) => px(plain, Math.floor(x / 2), Math.floor(y / 2)));
  const r1 = normalizeCapeImage(hd);
  assert.equal(r1.change, 'reduced');
  assert.deepEqual([...r1.image.data], [...plain.data]);
  // OptiFine 92x44 (2 x 46x22): placed top-left.
  const of = make(92, 44, (x, y) => [x, y, 7, 255]);
  const r2 = normalizeCapeImage(of);
  assert.equal(r2.change, 'placed');
  assert.deepEqual(px(r2.image, 10, 5), [20, 10, 7, 255]);
  assert.deepEqual(px(r2.image, 50, 5), [0, 0, 0, 0]);
  assert.equal(normalizeCapeImage(make(22, 17, () => [1, 2, 3, 255])).change, 'placed');
  assert.throws(() => normalizeCapeImage(make(64, 64, () => [0, 0, 0, 255])), (e: unknown) => e instanceof CapeFileError && e.code === 'size');
  assert.throws(() => normalizeCapeImage(make(100, 50, () => [0, 0, 0, 255])), CapeFileError);
});

test('elytra texture paths follow the version: 1.9 added it, 1.21.2 moved it, Bedrock has its own', () => {
  assert.equal(javaHasElytra('1.8.9'), false);
  assert.equal(javaHasElytra('1.9'), true);
  assert.equal(javaHasElytra('26.3'), true);
  assert.equal(elytraTexturePath('java', '1.12.2'), JAVA_LEGACY_ELYTRA_PATH);
  assert.equal(elytraTexturePath('java', '1.21.1'), JAVA_LEGACY_ELYTRA_PATH);
  assert.equal(elytraTexturePath('java', '1.21.4'), JAVA_ELYTRA_PATH);
  assert.equal(elytraTexturePath('java', '26.3'), JAVA_ELYTRA_PATH);
  assert.equal(elytraTexturePath('bedrock', '1.12.2'), BEDROCK_ELYTRA_PATH);
  assert.equal(BEDROCK_ELYTRA_PATH, 'textures/models/armor/elytra.png');
});

test('the elytra texture keeps only the wing area; the pack icon is the cape outside, opaque', () => {
  const cape = createCapeDesign('flame');
  const el = elytraTexture(cape);
  assert.deepEqual(px(el, 5, 5), [0, 0, 0, 0], 'cape area left empty');
  assert.deepEqual(px(el, 40, 10), px(cape, 40, 10));
  const icon = capeIcon(cape, 128);
  assert.equal(icon.width, 128);
  assert.deepEqual(px(icon, 64, 64).slice(0, 3), px(cape, 1 + 5, 1 + 8).slice(0, 3));
  assert.equal(icon.data[(64 * 128 + 64) * 4 + 3], 255);
});

test('cape PNG download: 64x32 and named after the cape', async () => {
  const cape = createCapeDesign('heart');
  const f = capePngFile(cape, 'Lucky / Heart');
  assert.match(f.filename, /-cape\.png$/);
  assert.ok(!f.filename.includes('/'));
  const back = decodePngBytes(new Uint8Array(await f.blob.arrayBuffer()));
  assert.deepEqual([back.width, back.height], [64, 32]);
  assert.deepEqual([...back.data], [...cape.data]);
});

test('Java elytra pack: pack.mcmeta for the version and the texture at the right path', async () => {
  const cape = createCapeDesign('gem');
  const modern = await buildElytraPack(cape, { name: 'Gem Elytra', description: 'd', edition: 'java', version: '26.3' });
  assert.equal(modern.filename, 'Gem Elytra.zip');
  const files = unzipSync(new Uint8Array(await modern.blob.arrayBuffer()));
  assert.deepEqual(Object.keys(files).sort(), ['assets/minecraft/textures/entity/equipment/wings/elytra.png', 'pack.mcmeta', 'pack.png']);
  const meta = JSON.parse(strFromU8(files['pack.mcmeta']));
  assert.equal(meta.pack.description, 'd');
  const tex = decodePngBytes(files[JAVA_ELYTRA_PATH]);
  assert.deepEqual(px(tex, 40, 10), px(cape, 40, 10));

  const old = await buildElytraPack(cape, { name: 'Old', description: 'd', edition: 'java', version: '1.12.2' });
  assert.ok(unzipSync(new Uint8Array(await old.blob.arrayBuffer()))[JAVA_LEGACY_ELYTRA_PATH]);
  await assert.rejects(buildElytraPack(cape, { name: 'x', description: 'd', edition: 'java', version: '1.8.9' }), (e: { code?: string }) => e.code === 'no-elytra');
});

test('Bedrock elytra pack: a resource pack manifest that keeps its ids and bumps its version', async () => {
  const cape = createCapeDesign('chevron');
  const first = await buildElytraPack(cape, { name: 'Chevron Elytra', description: 'd', edition: 'bedrock', version: '26.3' });
  assert.equal(first.filename, 'Chevron Elytra.mcpack');
  const files = unzipSync(new Uint8Array(await first.blob.arrayBuffer()));
  assert.deepEqual(Object.keys(files).sort(), ['manifest.json', 'pack_icon.png', BEDROCK_ELYTRA_PATH].sort());
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  assert.equal(manifest.modules[0].type, 'resources');
  assert.notEqual(manifest.header.uuid, manifest.modules[0].uuid);
  const again = await buildElytraPack(cape, { name: 'Chevron Elytra', description: 'd', edition: 'bedrock', version: '26.3', uuids: first.uuids, packVersion: first.packVersion });
  const m2 = JSON.parse(strFromU8(unzipSync(new Uint8Array(await again.blob.arrayBuffer()))['manifest.json']));
  assert.equal(m2.header.uuid, manifest.header.uuid);
  assert.notDeepEqual(m2.header.version, manifest.header.version);
});

test('Bedrock skin packs carry no cape field', async () => {
  const skin = createImageData(64, 64);
  skin.data.fill(200);
  const p: SkinProjectData = { id: 'c', kind: 'skin', name: 'Caped', model: 'classic', image: new Blob([encodePng(skin)], { type: 'image/png' }), createdAt: 1, updatedAt: 1 };
  const pack = await exportBedrockPack(p, skin, []);
  const files = unzipSync(new Uint8Array(await pack.blob.arrayBuffer()));
  const skins = JSON.parse(strFromU8(files['skins.json'])) as { skins: Record<string, unknown>[] };
  for (const s of skins.skins) assert.equal('cape' in s, false);
});
