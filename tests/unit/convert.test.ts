import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertPack, convertedName, isSameTarget, type ConvertMaps } from '../../src/tools/convert/convert';
import { buildPairIndex, compareJavaVersions, renameChain, rewriteModelTextures, type JavaBedrockMap, type JavaRenames } from '../../src/tools/convert/paths';
import { flipbookEntries, flipbookToJava, javaToFlipbook, parseJavaAnimation, terrainTiles } from '../../src/tools/convert/anim';
import { importLoosePngs } from '../../src/tools/convert/loose';
import { exportTexturePack } from '../../src/tools/textures/export';
import { imageDims, newTextureProject, parseJsonLoose } from '../../src/tools/textures/project';
import { stringifyPretty } from '../../src/editions/java/packmeta';
import { decodeImage, encodePng, isPng } from '../../src/core/image';
import { isTga } from '../../src/core/tga';
import { zipSync } from 'fflate';
import type { TexturePackProject } from '../../src/core/types';
import { fakeAssets, img, json, noisy, solid, text, unzipBlob } from '../tools/texlogic/fixtures';

const J = 'assets/minecraft/textures/';
const png = (d: ImageData) => new Blob([encodePng(d)], { type: 'image/png' });
const textBlob = (s: string) => new Blob([s], { type: 'application/json' });
const blobJson = async (b: Blob | undefined) => (b ? JSON.parse(await b.text()) : undefined);

/** Frames of a vertical strip, each a solid colour (frame i has red = 10 * (i + 1)). */
const strip = (w: number, frames: number) => img(w, w * frames, (_x, y) => [10 * (Math.floor(y / w) + 1), 50, 50, 255]);

const RENAMES: JavaRenames = {
  format: 1,
  steps: [
    {
      version: '1.13',
      renames: {
        'blocks/stone': 'block/stone',
        'blocks/grass_top': 'block/grass_block_top',
        'blocks/grass_side': 'block/grass_block_side',
        'blocks/sea_lantern': 'block/sea_lantern',
        'blocks/split': ['block/split_a', 'block/split_b'],
        'items/apple': 'item/apple',
        'items/clock': 'item/clock',
      },
      removed: ['blocks/gone'],
    },
    { version: '1.14', renames: { 'block/split_a': 'block/split_a2' } },
  ],
};

const MAP: JavaBedrockMap = {
  format: 1,
  java: '26.3',
  bedrock: '1.26.50',
  pairs: [
    ['block/stone', 'blocks/stone'],
    ['block/grass_block_top', 'blocks/grass_top'],
    ['block/grass_block_top', 'blocks/grass_carried'],
    ['block/grass_block_side', 'blocks/grass_side'],
    ['block/sea_lantern', 'blocks/sea_lantern'],
    ['block/magma', 'blocks/magma'],
    ['item/apple', 'items/apple'],
    ['item/clock', 'items/clock_item'],
    ['entity/pig', 'entity/pig/pig'],
  ],
  layoutDiffers: [['entity/chest/normal', 'entity/chest/normal']],
};
const MAPS: ConvertMaps = { javaBedrock: MAP, renames: RENAMES };

// ---------------------------------------------------------------------------------------------
// Paths

test('Java versions sort as releases, with snapshots before their release', () => {
  const order = ['1.6.1', '1.12.2', '17w43a', '1.13', '1.13.2', '1.20.1', '1.21.11', '26.1', '26.3', '26.4-snapshot-1', '26.4'];
  for (let i = 1; i < order.length; i++) assert.equal(compareJavaVersions(order[i - 1], order[i]), -1, `${order[i - 1]} < ${order[i]}`);
  assert.equal(compareJavaVersions('1.13', '1.13.0'), 0);
});

test('rename chain: upgrades apply each newer step, splits, removals', () => {
  const up = renameChain(RENAMES, '1.12.2', '26.3');
  assert.equal(up.direction, 'up');
  assert.deepEqual(up.steps, ['1.13', '1.14']);
  assert.deepEqual(up.map('blocks/stone'), { kind: 'paths', paths: ['block/stone'], renamed: true });
  assert.deepEqual(up.map('blocks/split'), { kind: 'paths', paths: ['block/split_a2', 'block/split_b'], renamed: true });
  assert.deepEqual(up.map('blocks/gone'), { kind: 'removed', version: '1.13' });
  assert.deepEqual(up.map('entity/pig'), { kind: 'paths', paths: ['entity/pig'], renamed: false });
  // starting after 1.13 only applies 1.14
  const from113 = renameChain(RENAMES, '1.13.2', '26.3');
  assert.deepEqual(from113.steps, ['1.14']);
  assert.deepEqual(from113.map('blocks/stone'), { kind: 'paths', paths: ['blocks/stone'], renamed: false });
  assert.deepEqual(from113.map('block/split_a'), { kind: 'paths', paths: ['block/split_a2'], renamed: true });
  // stopping before 1.14
  assert.deepEqual(renameChain(RENAMES, '1.12.2', '1.13.2').map('blocks/split'), { kind: 'paths', paths: ['block/split_a', 'block/split_b'], renamed: true });
});

test('rename chain: downgrades undo steps newest first; same version is a no-op', () => {
  const down = renameChain(RENAMES, '26.3', '1.12.2');
  assert.equal(down.direction, 'down');
  assert.deepEqual(down.steps, ['1.14', '1.13']);
  assert.deepEqual(down.map('block/stone'), { kind: 'paths', paths: ['blocks/stone'], renamed: true });
  assert.deepEqual(down.map('block/split_a2'), { kind: 'paths', paths: ['blocks/split'], renamed: true });
  assert.deepEqual(down.map('block/split_b'), { kind: 'paths', paths: ['blocks/split'], renamed: true });
  assert.deepEqual(down.map('block/cherry_planks'), { kind: 'paths', paths: ['block/cherry_planks'], renamed: false });
  assert.deepEqual(renameChain(RENAMES, '26.3', '1.13').map('block/split_a2'), { kind: 'paths', paths: ['block/split_a'], renamed: true });
  const none = renameChain(RENAMES, '26.3', '26.3');
  assert.equal(none.direction, 'none');
  assert.deepEqual(none.map('blocks/stone'), { kind: 'paths', paths: ['blocks/stone'], renamed: false });
  assert.deepEqual(renameChain(null, '1.12.2', '26.3').map('blocks/stone'), { kind: 'paths', paths: ['blocks/stone'], renamed: false });
});

test('pair index: many-to-many both ways, convertible pairs first', () => {
  const idx = buildPairIndex({ ...MAP, layoutDiffers: [['block/stone', 'blocks/stone_alt']] });
  assert.deepEqual(idx.toBedrock.get('block/grass_block_top'), ['blocks/grass_top', 'blocks/grass_carried']);
  assert.deepEqual(idx.toBedrock.get('block/stone'), ['blocks/stone', 'blocks/stone_alt']);
  assert.deepEqual(idx.toJava.get('blocks/grass_top'), ['block/grass_block_top']);
  assert.ok(idx.layoutDiffers.has('block/stone\nblocks/stone_alt'));
});

test('model texture references are rewritten with and without the minecraft: prefix', () => {
  const chain = renameChain(RENAMES, '1.12.2', '26.3');
  const model = JSON.stringify({
    parent: 'block/cube_all',
    textures: { all: 'minecraft:blocks/stone', side: 'blocks/grass_side', particle: '#all', mod: 'mymod:blocks/stone', keep: 'blocks/custom', layer: { sprite: 'items/apple', force_translucent: true } },
  });
  const map = (rel: string) => {
    const r = chain.map(rel);
    return r.kind === 'paths' && r.renamed ? r.paths[0] : null;
  };
  const out = JSON.parse(rewriteModelTextures(model, map, parseJsonLoose, stringifyPretty)!);
  assert.deepEqual(out.textures, {
    all: 'minecraft:block/stone',
    side: 'block/grass_block_side',
    particle: '#all',
    mod: 'mymod:blocks/stone',
    keep: 'blocks/custom',
    layer: { sprite: 'item/apple', force_translucent: true },
  });
  assert.equal(out.parent, 'block/cube_all');
  assert.equal(rewriteModelTextures(JSON.stringify({ textures: { all: 'block/stone' } }), map, parseJsonLoose, stringifyPretty), null);
  assert.equal(rewriteModelTextures('{"parent":"item/generated"}', map, parseJsonLoose, stringifyPretty), null);
});

// ---------------------------------------------------------------------------------------------
// Animations

test('Java animation -> Bedrock flipbook: speed, order, per-frame times, interpolation', () => {
  const simple = parseJavaAnimation({ animation: { frametime: 5 } })!;
  assert.deepEqual(javaToFlipbook(simple, 4, { stem: 'textures/blocks/x', atlasTile: 'x' }), { flipbook_texture: 'textures/blocks/x', atlas_tile: 'x', ticks_per_frame: 5, blend_frames: false });
  const ordered = parseJavaAnimation({ animation: { frametime: 2, interpolate: true, frames: [0, 1, 2, 1] } })!;
  assert.deepEqual(javaToFlipbook(ordered, 3, { stem: 's', atlasTile: 't' }), { flipbook_texture: 's', atlas_tile: 't', ticks_per_frame: 2, frames: [0, 1, 2, 1], blend_frames: true });
  const timed = parseJavaAnimation({ animation: { frametime: 4, frames: [{ index: 0, time: 8 }, 1, { index: 3, time: 12 }, { index: 9 }] } })!;
  // gcd(8, 4, 12) = 4 ticks; frame 9 doesn't exist in a 4-frame strip
  assert.deepEqual(javaToFlipbook(timed, 4, { stem: 's', atlasTile: 't', extra: { atlas_index: 2 } }).frames, [0, 0, 1, 3, 3, 3]);
  assert.equal(javaToFlipbook(timed, 4, { stem: 's', atlasTile: 't', extra: { atlas_index: 2 } }).atlas_index, 2);
  // a sequential frame list is left out
  assert.equal(javaToFlipbook(parseJavaAnimation({ animation: { frames: [0, 1, 2] } })!, 3, { stem: 's', atlasTile: 't' }).frames, undefined);
  assert.equal(parseJavaAnimation({ texture: { blur: true } }), null);
});

test('Bedrock flipbook -> Java animation: runs become timed frames, blending becomes interpolate', () => {
  assert.deepEqual(flipbookToJava({ ticks_per_frame: 10 }, 4), { animation: { frametime: 10, interpolate: true } });
  assert.deepEqual(flipbookToJava({ ticks_per_frame: 2, blend_frames: false, frames: [0, 0, 0, 1, 2, 2, 7] }, 3), {
    animation: { frametime: 2, frames: [{ index: 0, time: 6 }, 1, { index: 2, time: 4 }] },
  });
  assert.deepEqual(flipbookToJava({ frames: [0, 1, 2], blend_frames: false }, 3), { animation: { frametime: 1 } });
  const entries = flipbookEntries([{ flipbook_texture: 'textures/blocks/magma.png', atlas_tile: 'magma', ticks_per_frame: 10 }, { atlas_tile: 'broken' }]);
  assert.deepEqual([...entries.keys()], ['textures/blocks/magma']);
  const tiles = terrainTiles({ texture_data: { stone: { textures: ['textures/blocks/stone', { path: 'textures/blocks/stone_granite' }] }, magma: { textures: 'textures/blocks/magma' } } });
  assert.deepEqual(tiles.get('textures/blocks/stone_granite'), { tile: 'stone', index: 1 });
  assert.deepEqual(tiles.get('textures/blocks/magma'), { tile: 'magma' });
});

// ---------------------------------------------------------------------------------------------
// Whole packs

function java112Pack(): TexturePackProject {
  const p = newTextureProject({ name: 'Faithful Old', edition: 'java', version: '1.12.2', description: 'Old but gold', resolution: 32 });
  p.overrides[`${J}blocks/stone.png`] = png(noisy(32, 32, 1));
  p.overrides[`${J}blocks/grass_side.png`] = png(noisy(32, 32, 2));
  p.overrides[`${J}blocks/sea_lantern.png`] = png(strip(32, 5));
  p.extraFiles[`${J}blocks/sea_lantern.png.mcmeta`] = textBlob('{"animation":{"frametime":5}}');
  p.overrides[`${J}blocks/gone.png`] = png(noisy(32, 32, 3));
  p.overrides[`${J}blocks/split.png`] = png(noisy(32, 32, 4));
  p.overrides[`${J}blocks/my_custom.png`] = png(noisy(32, 32, 5));
  p.overrides[`${J}items/clock.png`] = png(strip(32, 4));
  p.extraFiles[`${J}items/clock.png.mcmeta`] = textBlob('{"animation":{"frames":[2,0,1,3]}}');
  p.overrides[`${J}entity/pig.png`] = png(noisy(64, 64, 6));
  p.overrides[`${J}entity/chest/normal.png`] = png(noisy(64, 64, 7));
  p.extraFiles['assets/minecraft/models/block/stone.json'] = textBlob('{"parent":"block/cube_all","textures":{"all":"blocks/stone"}}');
  p.extraFiles['assets/minecraft/sounds/dig.ogg'] = new Blob([new Uint8Array([1, 2, 3])]);
  p.extraFiles['pack.mcmeta'] = textBlob('{"pack":{"pack_format":3,"description":"Old but gold"}}');
  p.icon = png(solid(64, 64, [200, 0, 0, 255]));
  return p;
}

function java263Assets() {
  return fakeAssets('java', '26.3', {
    'version.json': JSON.stringify({ id: '26.3', pack_version: { resource_major: 97, resource_minor: 1 } }),
    [`${J}block/stone.png`]: noisy(16, 16, 1),
    [`${J}block/grass_block_side.png`]: noisy(16, 16, 2),
    [`${J}block/sea_lantern.png`]: strip(16, 5),
    [`${J}block/sea_lantern.png.mcmeta`]: '{"animation":{"frametime":5}}',
    [`${J}block/split_a2.png`]: noisy(16, 16, 3),
    [`${J}block/split_b.png`]: noisy(16, 16, 3),
    [`${J}item/clock.png`]: noisy(16, 16, 4),
    [`${J}entity/pig.png`]: noisy(64, 32, 6),
  });
}

test('Java 1.12.2 -> Java 26.3: renamed paths, moved .mcmeta, rewritten models, removed and custom textures', async () => {
  const src = java112Pack();
  const { project, report } = await convertPack(src, { edition: 'java', version: '26.3' }, java263Assets(), MAPS);
  assert.equal(project.name, 'Faithful Old (Java 26.3)');
  assert.equal(project.edition, 'java');
  assert.equal(project.version, '26.3');
  assert.equal(project.description, 'Old but gold');
  assert.equal(project.resolution, 32);
  assert.equal(project.icon, src.icon);
  assert.notEqual(project.id, src.id);
  assert.deepEqual(Object.keys(project.overrides).sort(), [
    `${J}block/grass_block_side.png`,
    `${J}block/sea_lantern.png`,
    `${J}block/split_a2.png`,
    `${J}block/split_b.png`,
    `${J}block/stone.png`,
    `${J}blocks/my_custom.png`,
    `${J}item/clock.png`,
  ]);
  assert.equal(await project.extraFiles[`${J}block/sea_lantern.png.mcmeta`]?.text(), '{"animation":{"frametime":5}}');
  assert.ok(project.extraFiles[`${J}item/clock.png.mcmeta`]);
  assert.deepEqual((await blobJson(project.extraFiles['assets/minecraft/models/block/stone.json'])).textures, { all: 'block/stone' });
  assert.ok(project.extraFiles['assets/minecraft/sounds/dig.ogg'], 'Java -> Java keeps sounds');
  assert.ok(project.extraFiles['pack.mcmeta'], 'the original pack.mcmeta is kept for its language/overlay sections');
  assert.equal(report.total, 9);
  const skipped = Object.fromEntries(report.skipped.map((s) => [s.source.slice(J.length), [s.reason, s.detail]]));
  assert.deepEqual(skipped, {
    'blocks/gone.png': ['removed', 'Removed in Java 1.13'],
    'entity/chest/normal.png': ['missing', 'Not in Java 26.3'],
    'entity/pig.png': ['layout', 'Its size doesn’t fit the Java 26.3 texture'],
  });
  assert.deepEqual(report.converted.find((c) => c.source.endsWith('split.png'))?.targets, [`${J}block/split_a2.png`, `${J}block/split_b.png`]);
  assert.deepEqual(report.kept.map((k) => k.source.slice(J.length)), ['blocks/my_custom.png']);
  assert.equal(report.converted.length, 5);
  assert.ok(report.notes.some((n) => /1 model file had its texture names updated/.test(n)), report.notes.join(' | '));

  // The existing exporter turns it into a 26.3 pack.
  const zip = await unzipBlob((await exportTexturePack(project, java263Assets())).blob);
  assert.deepEqual(json(zip['pack.mcmeta']).pack, { description: 'Old but gold', min_format: [97, 1], max_format: 97 });
  assert.ok(zip[`${J}block/stone.png`] && zip['pack.png']);
});

test('Java 26.3 -> Java 1.12.2 downgrade: old names, newer textures skipped as missing', async () => {
  const src = newTextureProject({ name: 'New', edition: 'java', version: '26.3' });
  src.overrides[`${J}block/stone.png`] = png(noisy(16, 16, 1));
  src.overrides[`${J}block/split_a2.png`] = png(noisy(16, 16, 2));
  src.overrides[`${J}block/magma.png`] = png(noisy(16, 16, 3));
  src.extraFiles['assets/minecraft/models/item/thing.json'] = textBlob('{"textures":{"layer0":"minecraft:item/apple"}}');
  const assets = fakeAssets('java', '1.12.2', { [`${J}blocks/stone.png`]: noisy(16, 16, 1), [`${J}blocks/split.png`]: noisy(16, 16, 2) });
  const { project, report } = await convertPack(src, { edition: 'java', version: '1.12.2' }, assets, MAPS);
  assert.deepEqual(Object.keys(project.overrides).sort(), [`${J}blocks/split.png`, `${J}blocks/stone.png`]);
  assert.deepEqual(report.skipped.map((s) => [s.source, s.reason, s.detail]), [[`${J}block/magma.png`, 'missing', 'Not in Java 1.12.2']]);
  assert.deepEqual((await blobJson(project.extraFiles['assets/minecraft/models/item/thing.json'])).textures, { layer0: 'minecraft:items/apple' });
});

function bedrockAssets() {
  return fakeAssets(
    'bedrock',
    'latest',
    {
      'textures/blocks/stone.png': noisy(16, 16, 1),
      'textures/blocks/grass_top.png': noisy(16, 16, 2),
      'textures/blocks/grass_carried.png': noisy(16, 16, 2),
      'textures/blocks/grass_side.tga': noisy(16, 16, 3),
      'textures/blocks/sea_lantern.png': noisy(16, 16, 4),
      'textures/blocks/magma.png': strip(16, 3),
      'textures/items/apple.png': noisy(16, 16, 5),
      'textures/items/clock_item.png': noisy(16, 16, 6),
      'textures/entity/pig/pig.png': noisy(64, 64, 7),
      'textures/entity/chest/normal.png': noisy(64, 64, 8),
      'textures/flipbook_textures.json': JSON.stringify([{ flipbook_texture: 'textures/blocks/magma', atlas_tile: 'magma', ticks_per_frame: 10, frames: [0, 1, 2, 1] }]),
      'textures/terrain_texture.json': '// comment\n' + JSON.stringify({ texture_data: { sea_lantern: { textures: 'textures/blocks/sea_lantern' }, magma: { textures: 'textures/blocks/magma' } } }),
    },
    ['textures/blocks/magma.png'],
  );
}

test('Java 1.12.2 -> Bedrock: renames then pairs, .tga targets, flipbook entries, first frames, dropped files', async () => {
  const src = java112Pack();
  src.overrides[`${J}blocks/grass_top.png`] = png(noisy(32, 32, 9));
  src.overrides[`${J}block/magma.png`] = png(noisy(32, 32, 10));
  src.version = '1.12.2';
  const assets = bedrockAssets();
  const { project, report } = await convertPack(src, { edition: 'bedrock', version: 'latest' }, assets, MAPS);
  assert.equal(project.name, 'Faithful Old (Bedrock)');
  assert.equal(project.edition, 'bedrock');
  assert.equal(project.version, 'latest');
  assert.ok(project.bedrockUuids && project.bedrockUuids.header !== project.bedrockUuids.module);
  assert.equal(project.description, 'Old but gold');
  assert.deepEqual(Object.keys(project.overrides).sort(), [
    'textures/blocks/grass_carried.png',
    'textures/blocks/grass_side.tga',
    'textures/blocks/grass_top.png',
    'textures/blocks/magma.png',
    'textures/blocks/sea_lantern.png',
    'textures/blocks/stone.png',
    'textures/entity/pig/pig.png',
    'textures/items/clock_item.png',
  ]);
  // TGA target is a real TGA with the pack's pixels
  const tga = new Uint8Array(await project.overrides['textures/blocks/grass_side.tga'].arrayBuffer());
  assert.ok(isTga(tga) && !isPng(tga));
  const side = await decodeImage(tga, 'tga');
  assert.deepEqual([...side.data.slice(0, 4)], [...noisy(32, 32, 2).data.slice(0, 4)]);
  // animated sea lantern: strip kept, flipbook entry from the .mcmeta
  assert.deepEqual(imageDims(new Uint8Array(await project.overrides['textures/blocks/sea_lantern.png'].arrayBuffer())), { w: 32, h: 160 });
  const flip = await blobJson(project.extraFiles['textures/flipbook_textures.json']);
  assert.deepEqual(flip, [
    // static magma replaces a 3-frame flipbook whose frame list must shrink
    { flipbook_texture: 'textures/blocks/magma', atlas_tile: 'magma', ticks_per_frame: 10 },
    { flipbook_texture: 'textures/blocks/sea_lantern', atlas_tile: 'sea_lantern', ticks_per_frame: 5, blend_frames: false },
  ]);
  // animated item: Bedrock can't animate items, so the first frame of the .mcmeta order (frame 2)
  const clock = await decodeImage(project.overrides['textures/items/clock_item.png']);
  assert.deepEqual([clock.width, clock.height, clock.data[0]], [32, 32, 30]);
  assert.ok(report.converted.find((c) => c.source.endsWith('items/clock.png'))?.notes[0].startsWith('first frame only'));
  const skipped = Object.fromEntries(report.skipped.map((s) => [s.source.slice(J.length), s.reason]));
  assert.deepEqual(skipped, {
    'blocks/gone.png': 'removed',
    'blocks/my_custom.png': 'no-counterpart',
    'blocks/split.png': 'no-counterpart',
    'entity/chest/normal.png': 'layout',
  });
  assert.equal(report.total, 11);
  assert.equal(report.converted.length, 7);
  assert.deepEqual(report.dropped.map((d) => [d.source, d.kind]), [
    ['assets/minecraft/models/block/stone.json', 'Model'],
    ['assets/minecraft/sounds/dig.ogg', 'Sound'],
  ]);
  assert.equal(project.icon, src.icon);

  // The existing exporter writes the .mcpack.
  const res = await exportTexturePack(project, assets);
  assert.ok(res.filename.endsWith('.mcpack'));
  const zip = await unzipBlob(res.blob);
  const manifest = json(zip['manifest.json']);
  assert.equal(manifest.header.name, 'Faithful Old (Bedrock)');
  assert.equal(manifest.header.description, 'Old but gold');
  assert.equal(manifest.modules[0].type, 'resources');
  assert.ok(zip['pack_icon.png'] && zip['textures/blocks/stone.png'] && zip['textures/blocks/grass_side.tga']);
  assert.equal(json(zip['textures/flipbook_textures.json']).length, 2);
});

test('Java non-square or grid animations are restacked into a column for Bedrock', async () => {
  const src = newTextureProject({ name: 'Grid', edition: 'java', version: '26.3' });
  // 2x2 grid of 16px frames: frame i has red 10*(i+1)
  src.overrides[`${J}block/sea_lantern.png`] = png(img(32, 32, (x, y) => [10 * ((y >> 4) * 2 + (x >> 4) + 1), 0, 0, 255]));
  src.extraFiles[`${J}block/sea_lantern.png.mcmeta`] = textBlob('{"animation":{"width":16,"height":16,"frametime":3}}');
  const { project } = await convertPack(src, { edition: 'bedrock', version: 'latest' }, bedrockAssets(), MAPS);
  const out = await decodeImage(project.overrides['textures/blocks/sea_lantern.png']);
  assert.deepEqual([out.width, out.height], [16, 64]);
  assert.deepEqual([0, 1, 2, 3].map((i) => out.data[i * 16 * 16 * 4]), [10, 20, 30, 40]);
  assert.equal((await blobJson(project.extraFiles['textures/flipbook_textures.json']))[0].ticks_per_frame, 3);
});

test('Bedrock -> Java: reverse pairs, TGA to PNG, flipbook to .mcmeta, renames down to an old version', async () => {
  const src = newTextureProject({ name: 'Bedrock Pack (Bedrock)', edition: 'bedrock', version: 'latest', description: 'From phone' });
  src.overrides['textures/blocks/stone.png'] = png(noisy(16, 16, 1));
  src.overrides['textures/blocks/grass_side.tga'] = new Blob([new Uint8Array(await (await import('../../src/core/image')).encodeTga(noisy(16, 16, 2)))]);
  src.overrides['textures/blocks/sea_lantern.png'] = png(strip(16, 4));
  src.overrides['textures/blocks/grass_carried.png'] = png(noisy(16, 16, 3));
  src.overrides['textures/blocks/grass_top.png'] = png(noisy(16, 16, 4));
  src.overrides['textures/ui/hotbar.png'] = png(noisy(16, 16, 5));
  src.extraFiles['textures/flipbook_textures.json'] = textBlob(JSON.stringify([{ flipbook_texture: 'textures/blocks/sea_lantern', atlas_tile: 'sea_lantern', ticks_per_frame: 4, frames: [0, 1, 1, 2, 3], blend_frames: false }]));
  src.extraFiles['manifest.json'] = textBlob('{}');
  src.extraFiles['texts/en_US.lang'] = textBlob('pack.name=x');
  src.extraFiles['textures/blocks/stone_mer.png'] = png(noisy(16, 16, 6));
  src.icon = png(solid(256, 256, [0, 0, 200, 255]));

  const assets = fakeAssets('java', '1.12.2', {
    [`${J}blocks/stone.png`]: noisy(16, 16, 1),
    [`${J}blocks/grass_side.png`]: noisy(16, 16, 2),
    [`${J}blocks/grass_top.png`]: noisy(16, 16, 3),
    [`${J}blocks/sea_lantern.png`]: strip(16, 5),
    [`${J}blocks/sea_lantern.png.mcmeta`]: '{"animation":{"frametime":5}}',
  });
  const { project, report } = await convertPack(src, { edition: 'java', version: '1.12.2' }, assets, MAPS);
  assert.equal(project.name, 'Bedrock Pack (Java 1.12.2)');
  assert.equal(project.description, 'From phone');
  assert.equal(project.icon, src.icon);
  assert.deepEqual(Object.keys(project.overrides).sort(), [`${J}blocks/grass_side.png`, `${J}blocks/grass_top.png`, `${J}blocks/sea_lantern.png`, `${J}blocks/stone.png`]);
  const side = new Uint8Array(await project.overrides[`${J}blocks/grass_side.png`].arrayBuffer());
  assert.ok(isPng(side));
  assert.deepEqual(json(new Uint8Array(await project.extraFiles[`${J}blocks/sea_lantern.png.mcmeta`].arrayBuffer())), { animation: { frametime: 4, frames: [0, { index: 1, time: 8 }, 2, 3] } });
  // grass_top and grass_carried both map to grass_block_top: the first one wins
  const dup = report.skipped.find((s) => s.reason === 'duplicate');
  assert.ok(dup && /grass_(top|carried)/.test(dup.source), JSON.stringify(report.skipped));
  assert.ok(report.skipped.some((s) => s.source === 'textures/ui/hotbar.png' && s.reason === 'no-counterpart'));
  assert.deepEqual(report.dropped.map((d) => d.kind).sort(), ['Language file', 'Vibrant Visuals (PBR) file']);
  assert.ok(report.notes.some((n) => /1 TGA image was saved as PNG/.test(n)));

  const zip = await unzipBlob((await exportTexturePack(project, assets)).blob);
  assert.deepEqual(json(zip['pack.mcmeta']), { pack: { pack_format: 3, description: 'From phone' } });
  assert.equal(text(zip[`${J}blocks/sea_lantern.png.mcmeta`])?.includes('"frametime": 4'), true);
});

test('same edition and version is refused; names; loose PNGs become a Java project', async () => {
  assert.ok(isSameTarget({ edition: 'java', version: '1.13' }, { edition: 'java', version: '1.13.0' }));
  assert.ok(isSameTarget({ edition: 'bedrock', version: 'latest' }, { edition: 'bedrock', version: '1.21.0' }));
  assert.ok(!isSameTarget({ edition: 'java', version: '1.13' }, { edition: 'bedrock', version: 'latest' }));
  assert.equal(convertedName('Cool (Java 1.12.2)', { edition: 'bedrock', version: 'latest' }), 'Cool (Bedrock)');
  const p = newTextureProject({ name: 'X', edition: 'java', version: '26.3' });
  await assert.rejects(convertPack(p, { edition: 'java', version: '26.3' }, java263Assets(), MAPS), /already for Java 26.3/);

  const zip = zipSync({
    'my textures/stone.png': encodePng(noisy(32, 32, 1)),
    'my textures/items/apple.png': encodePng(noisy(32, 32, 2)),
    'my textures/sea_lantern.png': encodePng(strip(32, 5)),
    'my textures/sea_lantern.png.mcmeta': new TextEncoder().encode('{"animation":{"frametime":2}}'),
    'my textures/selfie.png': encodePng(noisy(8, 8, 3)),
    'my textures/pack.png': encodePng(noisy(64, 64, 4)),
  });
  const known = new Set(['block/stone', 'item/apple', 'block/sea_lantern', 'items/apple']);
  const loose = await importLoosePngs(new File([zip], 'my_textures.zip'), known, '26.3');
  assert.equal(loose.project.name, 'my textures');
  assert.equal(loose.project.version, '26.3');
  assert.equal(loose.project.resolution, 32);
  assert.deepEqual(Object.keys(loose.project.overrides).sort(), [`${J}block/sea_lantern.png`, `${J}block/stone.png`, `${J}items/apple.png`]);
  assert.ok(loose.project.extraFiles[`${J}block/sea_lantern.png.mcmeta`]);
  assert.ok(loose.project.icon);
  assert.deepEqual(loose.unmatched, ['my textures/selfie.png']);
  const single = await importLoosePngs(new File([encodePng(noisy(16, 16, 1))], 'stone.png'), known, '26.3');
  assert.deepEqual(Object.keys(single.project.overrides), [`${J}block/stone.png`]);
  await assert.rejects(importLoosePngs(new File([encodePng(noisy(16, 16, 1))], 'me.png'), known, '26.3'), /named like Minecraft textures/);
  // to Bedrock straight away; and packaging as a Java pack of the same version is allowed for loose sources
  const { project } = await convertPack(loose.project, { edition: 'bedrock', version: 'latest' }, bedrockAssets(), MAPS);
  assert.ok(project.overrides['textures/blocks/stone.png'] && project.overrides['textures/blocks/sea_lantern.png']);
  const same = await convertPack(single.project, { edition: 'java', version: '26.3' }, java263Assets(), MAPS, { allowSameVersion: true });
  assert.ok(same.project.overrides[`${J}block/stone.png`]);
});
