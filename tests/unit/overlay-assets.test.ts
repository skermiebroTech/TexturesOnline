import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AssetIndex, Edition, EffectLayer, TextureInfo } from '../../src/core/types';
import { createImageData, decodeImage, encodePng, encodeTga } from '../../src/core/image';
import { createOverlayAssets, emptyAssetIndex, isOverlayAssets, mapPackPath } from '../../src/shared/overlay-assets';
import { MAX_TEXTURE_SIZE, limitSize, loadSlotTextures, previewTextureIds } from '../../src/shared/preview/preview-textures';
import { normalizePreviewTextures } from '../../src/tools/shaders/ui/project';
import { isPreviewPackPath, previewVersionFor, sourceLabel } from '../../src/tools/shaders/ui/texture-sources';

type RGBA = [number, number, number, number];

function solid(w: number, h: number, rgba: RGBA): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(rgba, i * 4);
  return createImageData(w, h, data);
}
const pngOf = (w: number, h: number, rgba: RGBA) => encodePng(solid(w, h, rgba));
const tgaOf = (w: number, h: number, rgba: RGBA) => encodeTga(solid(w, h, rgba));
const px = (img: { data: ArrayLike<number> }, i = 0) => [img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2], img.data[i * 4 + 3]];

/** In-memory AssetIndex: path -> bytes. Counts reads so tests can check what was touched. */
function fakeAssets(edition: Edition, files: Record<string, Uint8Array | string>, version = edition === 'java' ? '26.3' : 'latest'): AssetIndex & { reads: string[] } {
  const bytes = new Map<string, Uint8Array>();
  for (const [p, v] of Object.entries(files)) bytes.set(p, typeof v === 'string' ? new TextEncoder().encode(v) : v);
  const root = edition === 'java' ? 'assets/minecraft/textures/' : 'textures/';
  const textures: TextureInfo[] = [...bytes.keys()]
    .filter((p) => p.startsWith(root) && /\.(png|tga)$/.test(p))
    .sort()
    .map((p) => {
      const id = p.slice(root.length).replace(/\.(png|tga)$/, '');
      return { path: p, id, name: id.split('/').pop()!, category: id.startsWith('colormap/') ? 'colormap' : id.startsWith('font/') ? 'font' : 'block', ext: p.endsWith('.tga') ? 'tga' : 'png' };
    });
  const reads: string[] = [];
  const read = async (p: string) => {
    reads.push(p);
    const b = bytes.get(p);
    if (!b) throw new Error(`missing ${p}`);
    return b.slice();
  };
  return {
    edition,
    version,
    textures,
    reads,
    hasFile: (p) => bytes.has(p),
    listFiles: (prefix) => [...bytes.keys()].filter((p) => p.startsWith(prefix)).sort(),
    readFile: read,
    readText: async (p) => new TextDecoder().decode(await read(p)),
    readImage: async (p) => decodeImage(await read(p), p.split('.').pop()),
  };
}

const J = 'assets/minecraft/textures/';
const B = 'textures/';
const GREY: RGBA = [128, 128, 128, 255];
const RED: RGBA = [255, 0, 0, 255];
const BLUE: RGBA = [0, 0, 255, 255];
const invert = (extra: Partial<EffectLayer> = {}): EffectLayer => ({ id: 'fx', type: 'invert', enabled: true, params: { mode: 'rgb', amount: 100 }, ...extra });

test('java: pack files win, vanilla fills the rest, file listing is merged', async () => {
  const base = fakeAssets('java', {
    [`${J}block/stone.png`]: pngOf(16, 16, GREY),
    [`${J}block/dirt.png`]: pngOf(16, 16, GREY),
    [`${J}block/water_still.png.mcmeta`]: '{"animation":{"frametime":2}}',
  });
  const o = createOverlayAssets(base, {
    edition: 'java',
    files: {
      [`${J}block/stone.png`]: new Blob([pngOf(32, 32, RED)]),
      [`${J}block/custom.png`]: pngOf(16, 16, BLUE),
      [`${J}block/water_still.png.mcmeta`]: new TextEncoder().encode('{"animation":{"frametime":5}}'),
      'pack.mcmeta': new TextEncoder().encode('{}'),
    },
  });
  assert.ok(isOverlayAssets(o));
  assert.equal(o.edition, 'java');
  assert.equal(o.version, '26.3');
  assert.equal(o.overrideCount, 2);

  const stone = await o.readImage(`${J}block/stone.png`);
  assert.equal(stone.width, 32, 'a 32x pack texture keeps its resolution');
  assert.deepEqual(px(stone), RED);
  assert.deepEqual(px(await o.readImage(`${J}block/dirt.png`)), GREY, 'vanilla where the pack has nothing');
  assert.ok(o.isOverridden(`${J}block/stone.png`));
  assert.ok(!o.isOverridden(`${J}block/dirt.png`));
  assert.ok(o.hasFile(`${J}block/custom.png`) && o.hasFile(`${J}block/dirt.png`) && !o.hasFile(`${J}block/nope.png`));
  assert.deepEqual(o.listFiles(`${J}block/`), [`${J}block/custom.png`, `${J}block/dirt.png`, `${J}block/stone.png`, `${J}block/water_still.png.mcmeta`]);
  assert.deepEqual(await o.readFile('pack.mcmeta'), new TextEncoder().encode('{}'));
  assert.equal(await o.readText(`${J}block/water_still.png.mcmeta`), '{"animation":{"frametime":5}}', 'the pack .mcmeta wins');
  assert.deepEqual(await o.readFile(`${J}block/stone.png`), pngOf(32, 32, RED), 'raw bytes from a Blob');
  // the pack-only texture is listed after vanilla's
  assert.deepEqual(o.textures.map((t) => t.id), ['block/dirt', 'block/stone', 'block/custom']);
  await assert.rejects(o.readImage(`${J}block/nope.png`));
});

test('effects apply to pack and vanilla images, respecting categories and disabled layers', async () => {
  const base = fakeAssets('java', {
    [`${J}block/dirt.png`]: pngOf(4, 4, [100, 50, 20, 255]),
    [`${J}font/ascii.png`]: pngOf(4, 4, [10, 10, 10, 255]),
    [`${J}colormap/grass.png`]: pngOf(4, 4, [100, 200, 50, 255]),
  });
  const o = createOverlayAssets(base, { edition: 'java', files: { [`${J}block/stone.png`]: pngOf(4, 4, RED) }, effects: [invert(), { ...invert(), id: 'off', enabled: false }] });
  assert.deepEqual(px(await o.readImage(`${J}block/stone.png`)), [0, 255, 255, 255], 'pack texture inverted once (disabled layer skipped)');
  assert.deepEqual(px(await o.readImage(`${J}block/dirt.png`)), [155, 205, 235, 255], 'vanilla texture inverted too, like the export');
  assert.deepEqual(px(await o.readImage(`${J}font/ascii.png`)), [10, 10, 10, 255], 'fonts untouched without an explicit filter');
  assert.deepEqual(px(await o.readImage(`${J}colormap/grass.png`)), [155, 55, 205, 255], 'colour maps take colour effects');

  const onlyItems = createOverlayAssets(base, { edition: 'java', files: {}, effects: [invert({ categories: ['item'] })] });
  assert.deepEqual(px(await onlyItems.readImage(`${J}block/dirt.png`)), [100, 50, 20, 255], 'category filter respected');
  assert.deepEqual(await onlyItems.readFile(`${J}block/dirt.png`), await base.readFile(`${J}block/dirt.png`), 'readFile stays raw');
});

test('bedrock: a pack file replaces vanilla by name whatever its extension; .tga wins over .png', async () => {
  const base = fakeAssets('bedrock', {
    [`${B}blocks/grass_side.tga`]: tgaOf(16, 16, GREY),
    [`${B}blocks/stone.png`]: pngOf(16, 16, GREY),
    [`${B}blocks/sand.png`]: pngOf(16, 16, GREY),
  });
  const o = createOverlayAssets(base, {
    edition: 'bedrock',
    files: {
      [`${B}blocks/grass_side.png`]: pngOf(16, 16, RED),
      [`${B}blocks/stone.tga`]: tgaOf(16, 16, BLUE),
      [`${B}blocks/sand.png`]: pngOf(16, 16, RED),
      [`${B}blocks/sand.tga`]: tgaOf(16, 16, BLUE),
    },
  });
  assert.equal(o.overridePath(`${B}blocks/grass_side.tga`), `${B}blocks/grass_side.png`);
  assert.deepEqual(px(await o.readImage(`${B}blocks/grass_side.tga`)), RED, 'the pack .png beats the vanilla .tga');
  assert.deepEqual(px(await o.readImage(`${B}blocks/stone.png`)), BLUE, 'the pack .tga beats the vanilla .png');
  assert.equal(o.overridePath(`${B}blocks/sand.png`), `${B}blocks/sand.png`, 'an exact name is served as asked');
  assert.equal(o.overridePath(`${B}blocks/sand.tga`), `${B}blocks/sand.tga`);
  assert.equal(o.overridePath(`${B}blocks/dirt.png`), null);
});

test('packs of the other edition are mapped onto the base texture folder', async () => {
  assert.equal(mapPackPath(`${B}blocks/stone.png`, 'bedrock', 'java'), `${J}blocks/stone.png`);
  assert.equal(mapPackPath(`${J}block/stone.png`, 'java', 'bedrock'), `${B}block/stone.png`);
  assert.equal(mapPackPath('manifest.json', 'bedrock', 'java'), 'manifest.json');
  assert.equal(mapPackPath(`${J}block/stone.png`, 'java', 'java'), `${J}block/stone.png`);

  const java = fakeAssets('java', { [`${J}block/stone.png`]: pngOf(16, 16, GREY) });
  const fromBedrock = createOverlayAssets(java, { edition: 'bedrock', files: { [`${B}blocks/stone.tga`]: tgaOf(16, 16, RED) } });
  assert.equal(fromBedrock.packEdition, 'bedrock');
  assert.equal(fromBedrock.edition, 'java');
  assert.equal(fromBedrock.overridePath(`${J}blocks/stone.png`), `${J}blocks/stone.tga`);
  assert.deepEqual(px(await fromBedrock.readImage(`${J}blocks/stone.png`)), RED);

  const bedrock = fakeAssets('bedrock', { [`${B}blocks/stone.png`]: pngOf(16, 16, GREY) });
  const fromJava = createOverlayAssets(bedrock, { edition: 'java', files: { [`${J}block/stone.png`]: pngOf(16, 16, BLUE) } });
  assert.ok(fromJava.hasFile(`${B}block/stone.png`));
  assert.deepEqual(px(await fromJava.readImage(`${B}block/stone.tga`)), BLUE);
});

test('a damaged pack image falls back to vanilla; offline (empty) base still shows the pack', async () => {
  const base = fakeAssets('java', { [`${J}block/stone.png`]: pngOf(16, 16, GREY) });
  const junk = new TextEncoder().encode('not an image');
  const o = createOverlayAssets(base, { edition: 'java', files: { [`${J}block/stone.png`]: junk, [`${J}block/dirt.png`]: junk } });
  assert.deepEqual(px(await o.readImage(`${J}block/stone.png`)), GREY);
  await assert.rejects(o.readImage(`${J}block/dirt.png`), 'no vanilla copy: the error surfaces');

  const empty = emptyAssetIndex('java', '26.3');
  assert.equal(empty.hasFile(`${J}block/stone.png`), false);
  assert.deepEqual(empty.listFiles(''), []);
  await assert.rejects(empty.readImage(`${J}block/stone.png`));
  const offline = createOverlayAssets(empty, { edition: 'java', files: { [`${J}block/sand.png`]: pngOf(16, 16, RED) } });
  assert.deepEqual(px(await offline.readImage(`${J}block/sand.png`)), RED);
  assert.equal(offline.hasFile(`${J}block/stone.png`), false);
});

test('diorama textures: pack first (any version or edition name), any resolution, animated water', async () => {
  const base = fakeAssets('java', {
    [`${J}block/grass_block_top.png`]: pngOf(16, 16, GREY),
    [`${J}block/grass_block_side.png`]: pngOf(16, 16, GREY),
    [`${J}block/grass_block_side_overlay.png`]: pngOf(16, 16, [0, 0, 0, 0]),
    [`${J}block/stone.png`]: pngOf(16, 16, GREY),
    [`${J}block/sand.png`]: pngOf(16, 16, GREY),
    [`${J}block/cornflower.png`]: pngOf(16, 16, BLUE),
    [`${J}block/poppy.png`]: pngOf(16, 16, GREY),
    [`${J}block/water_still.png`]: pngOf(16, 32, GREY),
  });
  const o = createOverlayAssets(base, {
    edition: 'java',
    files: {
      // 1.12 name for the grass top, a 64x stone, a 32x animated water strip of 4 frames
      [`${J}blocks/grass_top.png`]: pngOf(16, 16, RED),
      [`${J}block/stone.png`]: pngOf(64, 64, RED),
      [`${J}block/water_still.png`]: pngOf(32, 128, [200, 200, 200, 255]),
      [`${J}block/water_still.png.mcmeta`]: new TextEncoder().encode('{"animation":{"frametime":3}}'),
      // a legacy rose must not replace the vanilla cornflower (it's only a stand-in for old versions)
      [`${J}blocks/flower_rose.png`]: pngOf(16, 16, RED),
    },
  });
  const slots = await loadSlotTextures(o);
  assert.equal(slots.grass_top.path, `${J}blocks/grass_top.png`);
  assert.equal(slots.grass_top.fromPack, true);
  assert.equal(slots.stone.image.width, 64);
  assert.equal(slots.stone.fromPack, true);
  assert.deepEqual(px(slots.stone.image), RED);
  assert.equal(slots.water.frames, 4);
  assert.equal(slots.water.frametime, 3);
  assert.equal(slots.water.image.width, 32);
  assert.equal(slots.sand.fromPack, false);
  assert.equal(slots.sand.source, 'asset');
  assert.equal(slots.cornflower.path, `${J}block/cornflower.png`);
  assert.equal(slots.cornflower.fromPack, false);
  assert.equal(slots.poppy.path, `${J}blocks/flower_rose.png`, 'the legacy rose is the pack poppy');
  assert.equal(slots.dirt.source, 'procedural', 'nothing anywhere: built-in art');

  // without a pack layer nothing changes
  const plain = await loadSlotTextures(base);
  assert.equal(plain.grass_top.path, `${J}block/grass_block_top.png`);
  assert.equal(plain.grass_top.fromPack, false);
});

test('diorama textures: Java pack on a Bedrock base (grass side overlay composited)', async () => {
  const base = fakeAssets('bedrock', {
    [`${B}blocks/grass_side.tga`]: tgaOf(16, 16, [128, 128, 128, 0]),
    [`${B}blocks/stone.png`]: pngOf(16, 16, GREY),
  });
  const overlayPx = solid(16, 16, [0, 0, 0, 0]);
  overlayPx.data.set([255, 255, 255, 255], 0);
  const o = createOverlayAssets(base, {
    edition: 'java',
    files: { [`${J}block/grass_block_side.png`]: pngOf(16, 16, RED), [`${J}block/grass_block_side_overlay.png`]: encodePng(overlayPx) },
  });
  const slots = await loadSlotTextures(o);
  assert.equal(slots.grass_side.path, `${B}block/grass_block_side.png`);
  assert.equal(slots.grass_side.fromPack, true);
  const [r, g, b] = px(slots.grass_side.image);
  assert.ok(g > r && g > b, `top-left pixel is the tinted overlay (${r},${g},${b})`);
  assert.deepEqual(px(slots.grass_side.image, 20), RED, 'elsewhere the pack side');
  assert.equal(slots.stone.fromPack, false);
});

test('preview texture ids, stored-pack filter, labels and saved preference', () => {
  const ids = previewTextureIds();
  for (const id of ['block/grass_block_top', 'blocks/grass_top', 'block/grass_block_side_overlay', 'blocks/water_still_grey', 'colormap/grass', 'block/blue_orchid']) assert.ok(ids.includes(id), id);

  assert.ok(isPreviewPackPath(`${J}block/stone.png`, 'java'));
  assert.ok(isPreviewPackPath(`${J}block/water_still.png.mcmeta`, 'java'));
  assert.ok(!isPreviewPackPath(`${J}item/apple.png`, 'java'));
  assert.ok(!isPreviewPackPath(`${J}block/stone.png`, 'bedrock'));
  assert.ok(isPreviewPackPath(`${B}blocks/tallgrass.tga`, 'bedrock'));

  assert.equal(previewVersionFor({ id: 'iris', edition: 'java' }, '1.20.1'), '26.3');
  assert.equal(previewVersionFor({ id: 'java-vanilla', edition: 'java' }, '1.21.5'), '1.21.5');
  assert.equal(previewVersionFor({ id: 'bedrock-vibrant', edition: 'bedrock' }, '1.21.120'), 'latest');

  assert.equal(sourceLabel({ kind: 'vanilla' }, 'java', '26.3'), 'Minecraft 26.3');
  assert.equal(sourceLabel({ kind: 'vanilla' }, 'bedrock', 'latest'), 'Minecraft Bedrock');
  assert.equal(sourceLabel({ kind: 'project', projectId: 'x', name: 'Pastel Dream' }, 'java', '26.3'), 'My pack: Pastel Dream');
  assert.equal(sourceLabel({ kind: 'imported', imported: { key: 'k', name: 'Faithful', edition: 'java', size: 1, at: 1 } }, 'java', '26.3'), 'Imported: Faithful');
  assert.equal(sourceLabel({ kind: 'simple' }, 'java', '26.3'), 'Simple');

  assert.deepEqual(normalizePreviewTextures(undefined), { kind: 'vanilla' });
  assert.deepEqual(normalizePreviewTextures({ kind: 'weird' }), { kind: 'vanilla' });
  assert.deepEqual(normalizePreviewTextures({ kind: 'project' }), { kind: 'vanilla' }, 'a project choice needs an id');
  assert.deepEqual(normalizePreviewTextures({ kind: 'imported', name: 'x' }), { kind: 'vanilla' }, 'an imported choice needs its stored pack');
  assert.deepEqual(normalizePreviewTextures({ kind: 'project', projectId: 'abc', name: ' Pastel ' }), { kind: 'project', projectId: 'abc', name: 'Pastel' });
  const imported = { key: 'shader-preview-pack:v1:x', name: 'Faithful', edition: 'bedrock', size: 10, at: 5 };
  assert.deepEqual(normalizePreviewTextures({ kind: 'simple', imported }), { kind: 'simple', imported });
  assert.deepEqual(normalizePreviewTextures({ kind: 'imported', imported }), { kind: 'imported', name: 'Faithful', imported });
});

test('HD textures are reduced for the preview (strip frames stay aligned, colour under alpha kept)', async () => {
  const big = solid(2048, 2048, [10, 20, 30, 255]);
  const small = limitSize(big);
  assert.equal(small.width, MAX_TEXTURE_SIZE);
  assert.equal(small.height, MAX_TEXTURE_SIZE);
  assert.deepEqual(px(small), [10, 20, 30, 255]);
  const strip = limitSize(solid(1024, 4096, GREY));
  assert.deepEqual([strip.width, strip.height], [512, 2048], 'a 4-frame strip keeps 4 square frames');
  const mask = limitSize(solid(1024, 1024, [90, 80, 70, 0]));
  assert.deepEqual(px(mask), [90, 80, 70, 0], 'transparent pixels keep their colour');
  const same = solid(64, 64, GREY);
  assert.equal(limitSize(same), same, 'small textures untouched');

  const base = fakeAssets('java', { [`${J}block/stone.png`]: pngOf(16, 16, GREY) });
  const o = createOverlayAssets(base, { edition: 'java', files: { [`${J}block/stone.png`]: pngOf(1024, 1024, RED) } });
  const slots = await loadSlotTextures(o);
  assert.equal(slots.stone.image.width, MAX_TEXTURE_SIZE);
  assert.deepEqual(px(slots.stone.image), RED);
});
