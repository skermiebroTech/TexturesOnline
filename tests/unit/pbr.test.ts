// PBR materials of the texture pack maker (src/tools/textures/pbr): normal maps made from the colours,
// the parts a value covers, labPBR channel packing, Bedrock texture sets (writing and reading), the
// files each edition's export writes, and an opened pack's PBR files taken into its materials.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createImageData, decodeImage } from '../../src/core/image';
import type { PbrMaterial } from '../../src/core/types';
import { exportTexturePack } from '../../src/tools/textures/export';
import { newTextureProject, setOverride } from '../../src/tools/textures/project';
import {
  PLAIN,
  bakeMers,
  bumpMap,
  copyForTexture,
  familyStem,
  heightField,
  maskFor,
  materialFromPreset,
  normalFromHeight,
  paletteOf,
  presetById,
  similarGroups,
} from '../../src/tools/textures/pbr/material';
import {
  bedrockNormal,
  buildTextureSet,
  fromLabSpecular,
  labColourPath,
  labPaths,
  labSpecular,
  layerNames,
  parseTextureSet,
  textureSetPath,
} from '../../src/tools/textures/pbr/formats';
import { adoptPackPbr, decodeMap, gameMaterial, hasMaterials } from '../../src/tools/textures/pbr/pack';
import { PBR_ENGINE, PBR_TEXTURE_SET, PBR_UNIFORM_SET } from '../../src/tools/guides/pbr-files';
import { PBR_MIN_ENGINE } from '../../src/editions/bedrock/manifest';
import { bedrockSpec, fakeAssets, img, javaSpec, json, noisy, solid, text, unzipBlob } from '../tools/texlogic/fixtures';

const J = 'assets/minecraft/textures/';
const px = (im: ImageData, x: number, y: number) => Array.from(im.data.slice((y * im.width + x) * 4, (y * im.width + x) * 4 + 4));

// ---------------------------------------------------------------------------------------------
// Normal maps

test('normal map from the colours: flat is flat, slopes point the DirectX way, height in alpha', () => {
  const flat = bumpMap(solid(8, 8, [120, 120, 120, 255]), { strength: 1, invert: false, blur: 0 }, true);
  for (let i = 0; i < flat.data.length; i += 4) assert.deepEqual(Array.from(flat.data.slice(i, i + 3)), [128, 128, 255]);

  // brighter to the right: the surface faces left (red below 128), green stays
  const right = bumpMap(img(8, 8, (x) => [x * 30, x * 30, x * 30, 255]), { strength: 1, invert: false, blur: 0 }, false);
  const [r, g, ao, hgt] = px(right, 4, 4);
  assert.ok(r < 120, `red ${r}`);
  assert.equal(g, 128);
  assert.equal(ao, 255, 'no ambient occlusion');
  assert.ok(hgt > 100 && hgt < 255);

  // brighter downwards: the surface faces up the picture, which is green below 128 in DirectX
  const down = bumpMap(img(8, 8, (_x, y) => [y * 30, y * 30, y * 30, 255]), { strength: 1, invert: false, blur: 0 }, false);
  assert.ok(px(down, 4, 4)[1] < 120, 'DirectX: green 0 = up');
  assert.equal(px(down, 4, 4)[0], 128);

  // "dark parts stick out" flips both the slope and the height
  const inv = bumpMap(img(8, 8, (x) => [x * 30, x * 30, x * 30, 255]), { strength: 1, invert: true, blur: 0 }, false);
  assert.ok(px(inv, 4, 4)[0] > 136);
  assert.ok(px(inv, 1, 4)[3] > px(inv, 6, 4)[3]);

  // strength 0 is flat, more strength tilts more
  const none = bumpMap(img(8, 8, (x) => [x * 30, x * 30, x * 30, 255]), { strength: 0, invert: false, blur: 0 }, false);
  assert.deepEqual(px(none, 4, 4).slice(0, 2), [128, 128]);
  const strong = bumpMap(img(8, 8, (x) => [x * 30, x * 30, x * 30, 255]), { strength: 3, invert: false, blur: 0 }, false);
  assert.ok(px(strong, 4, 4)[0] < r);
  // the height is never 0 (some shaders misread it)
  assert.ok(Math.min(...Array.from(right.data.filter((_v, i) => i % 4 === 3))) >= 1);
});

test('normal map: smoothing softens, tiles wrap, animation frames stay apart', () => {
  const dots = img(16, 16, (x, y) => ((x + y) % 4 === 0 ? [255, 255, 255, 255] : [0, 0, 0, 255]));
  const sharp = bumpMap(dots, { strength: 1, invert: false, blur: 0 }, true);
  const soft = bumpMap(dots, { strength: 1, invert: false, blur: 2 }, true);
  const tilt = (m: ImageData) => {
    let t = 0;
    for (let i = 0; i < m.data.length; i += 4) t += Math.abs(m.data[i] - 128) + Math.abs(m.data[i + 1] - 128);
    return t;
  };
  assert.ok(tilt(soft) < tilt(sharp) / 2, 'smoothing flattens the bumps');

  // a step at the edge: wrapped (a block) the edge pixels see the other side, held (an item) they don't
  const edge = img(8, 8, (x) => [x === 7 ? 255 : 0, x === 7 ? 255 : 0, x === 7 ? 255 : 0, 255]);
  assert.notEqual(px(bumpMap(edge, { strength: 1, invert: false, blur: 0 }, true), 0, 3)[0], 128);
  assert.equal(px(bumpMap(edge, { strength: 1, invert: false, blur: 0 }, false), 0, 3)[0], 128);

  // two flat frames of different brightness: no slope where they meet
  const strip = img(8, 16, (_x, y) => (y < 8 ? [40, 40, 40, 255] : [220, 220, 220, 255]));
  const n = bumpMap(strip, { strength: 2, invert: false, blur: 1 }, true);
  for (let y = 0; y < 16; y++) assert.deepEqual(px(n, 3, y).slice(0, 2), [128, 128], `row ${y}`);

  // transparent pixels are low
  const hf = heightField(img(2, 1, (x) => [255, 255, 255, x ? 255 : 0]), { invert: false, blur: 0 }, false);
  assert.deepEqual(Array.from(hf), [0, 1]);
  assert.equal(normalFromHeight(new Float32Array([0, 1]), 2, 1, 1, false).data[3], 1);
});

// ---------------------------------------------------------------------------------------------
// Parts and maps

test('parts of a texture: colourful, bright, dark, colours and an area; baked over the base', () => {
  const ore = img(4, 4, (x, y) => (x === 1 && y === 1 ? [40, 220, 230, 255] : x === 3 && y === 3 ? [250, 250, 250, 255] : x === 0 && y === 3 ? [10, 10, 10, 255] : [128, 128, 128, x === 2 && y === 0 ? 0 : 255]));
  const count = (m: Uint8Array) => m.reduce((a, b) => a + b, 0);
  assert.equal(count(maskFor(ore, { kind: 'colourful', amount: 35 })), 1);
  assert.equal(maskFor(ore, { kind: 'colourful', amount: 35 })[5], 1);
  assert.equal(count(maskFor(ore, { kind: 'bright', amount: 90 })), 1);
  assert.equal(count(maskFor(ore, { kind: 'dark', amount: 10 })), 1);
  assert.equal(count(maskFor(ore, { kind: 'colour', colours: [0x808080], tolerance: 2 })), 12, 'the transparent grey pixel is left out');
  // an area keeps its place when the texture is twice as big
  assert.equal(count(maskFor(ore, { kind: 'area', rect: [0, 0, 2, 2], size: [4, 4] })), 4);
  const big = solid(8, 8, [128, 128, 128, 255]);
  assert.equal(count(maskFor(big, { kind: 'area', rect: [0, 0, 2, 2], size: [4, 4] })), 16);
  assert.deepEqual(paletteOf(ore)[0], 0x808080);

  const m = materialFromPreset(presetById('glowSpots')!);
  const mers = bakeMers(ore, m);
  assert.deepEqual(px(mers, 1, 1), [0, 255, 80, 0], 'the gem glows');
  assert.deepEqual(px(mers, 0, 0), [0, 0, 225, 0], 'the stone is rough');
  // a map replaces the base, at the texture's size
  const map = solid(2, 2, [255, 0, 10, 0]);
  assert.deepEqual(px(bakeMers(ore, { base: PLAIN, spots: [] }, map), 3, 3), [255, 0, 10, 0]);

  // copies for similar textures keep values, parts and bumps, not maps or the pack's files
  const copy = copyForTexture({ ...m, map: { image: new Blob(), layout: 'mers' }, original: { a: new Blob() } });
  assert.equal(copy.map, undefined);
  assert.equal(copy.original, undefined);
  assert.deepEqual(copy.spots, m.spots);
  assert.notEqual(copy.spots[0], m.spots[0]);
});

test('similar textures: other sides, names ending and starting with the same word, same folder', () => {
  const all = ['diamond_ore', 'deepslate_diamond_ore', 'iron_ore', 'nether_gold_ore', 'furnace_front', 'furnace_front_on', 'furnace_side', 'furnace_top', 'oak_planks', 'oak_log', 'oak_log_top', 'stone'].map((n) => ({ path: `${J}block/${n}.png`, category: 'block' as const }));
  all.push({ path: `${J}item/iron_ore.png`, category: 'item' as const });
  const ores = similarGroups(`${J}block/diamond_ore.png`, all);
  const suffix = ores.find((g) => g.kind === 'suffix')!;
  assert.equal(suffix.word, 'ore');
  assert.deepEqual(suffix.paths.map((p) => p.split('/').pop()), ['deepslate_diamond_ore.png', 'iron_ore.png', 'nether_gold_ore.png']);
  const furnace = similarGroups(`${J}block/furnace_front_on.png`, all);
  assert.equal(furnace[0].kind, 'sides');
  assert.deepEqual(furnace[0].paths.map((p) => p.split('/').pop()).sort(), ['furnace_front.png', 'furnace_side.png', 'furnace_top.png']);
  const oak = similarGroups(`${J}block/oak_planks.png`, all);
  assert.deepEqual(oak.find((g) => g.kind === 'prefix')?.paths.map((p) => p.split('/').pop()), ['oak_log.png', 'oak_log_top.png']);
  assert.equal(familyStem('wheat_stage7'), 'wheat');
  assert.equal(familyStem('planks_oak'), 'planks_oak');
  assert.deepEqual(similarGroups(`${J}block/stone.png`, all), []);
});

// ---------------------------------------------------------------------------------------------
// labPBR

test('labPBR _s: smoothness, F0 / metal, subsurface and emission in the right channels', () => {
  // metal 255, glow 0, roughness 30 | not metal, glow 255, rough, light through 255 | plain
  const mers = img(3, 1, (x) => (x === 0 ? [255, 0, 30, 0] : x === 1 ? [0, 255, 255, 255] : [0, 0, 255, 0]));
  const s = labSpecular(mers);
  assert.deepEqual(px(s, 0, 0), [225, 255, 0, 255], 'smooth albedo metal, no emission = 255');
  assert.deepEqual(px(s, 1, 0), [0, 10, 255, 254], 'F0 4 %, subsurface 65-255, full emission = 254');
  assert.deepEqual(px(s, 2, 0), [0, 10, 0, 255]);
  // half subsurface and a little glow
  const half = labSpecular(img(1, 1, () => [0, 1, 128, 128]));
  assert.deepEqual(px(half, 0, 0), [127, 10, 65 + Math.round((128 * 190) / 255), 1]);
  // metals can't let light through
  assert.equal(labSpecular(img(1, 1, () => [255, 0, 0, 255])).data[2], 0);
  // read back
  const back = fromLabSpecular(s);
  assert.deepEqual(px(back, 0, 0), [255, 0, 30, 0]);
  assert.deepEqual(px(back, 1, 0), [0, 255, 255, 255]);
  // predefined metals (230-254) are metals; porosity is not subsurface
  assert.deepEqual(px(fromLabSpecular(img(2, 1, (x) => (x ? [100, 231, 40, 255] : [100, 50, 64, 255]))), 1, 0), [255, 0, 155, 0]);
  assert.deepEqual(px(fromLabSpecular(img(1, 1, () => [100, 50, 64, 255])), 0, 0), [0, 0, 155, 0]);

  assert.deepEqual(labPaths(`${J}block/stone.png`), { normal: `${J}block/stone_n.png`, specular: `${J}block/stone_s.png` });
  assert.deepEqual(labPaths(`${J}blocks/stone.png`).specular, `${J}blocks/stone_s.png`);
  assert.deepEqual(labColourPath(`${J}block/stone_n.png`), { colour: `${J}block/stone.png`, kind: 'normal' });
  assert.equal(labColourPath(`${J}block/stone.png`), null);
});

// ---------------------------------------------------------------------------------------------
// Bedrock texture sets

test('texture sets: MER uniform, MERS image, normal; read back with hex values', () => {
  const uniform = buildTextureSet({ color: 'iron_block', mers: [255, 0, 40] });
  assert.match(uniform, /"metalness_emissive_roughness": \[255, 0, 40\]/);
  assert.deepEqual(JSON.parse(uniform), { format_version: '1.16.100', 'minecraft:texture_set': { color: 'iron_block', metalness_emissive_roughness: [255, 0, 40] } });
  const mers = JSON.parse(buildTextureSet({ color: 'leaves', mers: 'leaves_mers', subsurface: true, normal: 'leaves_normal' }));
  assert.deepEqual(mers, { format_version: '1.21.30', 'minecraft:texture_set': { color: 'leaves', metalness_emissive_roughness_subsurface: 'leaves_mers', normal: 'leaves_normal' } });
  assert.equal(JSON.parse(buildTextureSet({ color: 'x', mers: 'x_mer' }))['minecraft:texture_set'].metalness_emissive_roughness, 'x_mer');
  assert.deepEqual(JSON.parse(buildTextureSet({ color: 'x' })), { format_version: '1.16.100', 'minecraft:texture_set': { color: 'x' } });

  const parsed = parseTextureSet('﻿{"format_version":"1.16.100","minecraft:texture_set":{"color":[180,140,190,255],"metalness_emissive_roughness":"#FBA34C","normal":"grass_carried_normal"}}');
  assert.deepEqual(parsed, { formatVersion: '1.16.100', layers: { color: [180, 140, 190, 255], mer: [0xfb, 0xa3, 0x4c], normal: 'grass_carried_normal' } });
  assert.deepEqual(parseTextureSet({ 'minecraft:texture_set': { color: 'c', metalness_emissive_roughness_subsurface: '#80FF0010' } })?.layers.mers, [0xff, 0x00, 0x10, 0x80], 'ARGB');
  assert.deepEqual(parseTextureSet({ 'minecraft:texture_set': { color: 'c', heightmap: 'c_heightmap' } })?.layers.heightmap, 'c_heightmap');
  assert.equal(parseTextureSet('{"format_version":"1.16.100"}'), null);
  assert.equal(parseTextureSet('not json'), null);

  assert.equal(textureSetPath('textures/blocks/stone.png'), 'textures/blocks/stone.texture_set.json');
  // the guide's examples are what the export writes
  assert.equal(PBR_TEXTURE_SET, buildTextureSet({ color: 'diamond_ore', mers: 'diamond_ore_mer', normal: 'diamond_ore_normal' }));
  assert.equal(PBR_UNIFORM_SET, buildTextureSet({ color: 'iron_block', mers: [255, 0, 70] }));
  assert.deepEqual(PBR_ENGINE, PBR_MIN_ENGINE);
  // vanilla has colour textures named like layers (piston_top_normal.png): never write over one
  const taken = (stem: string) => stem === 'textures/blocks/piston_top_normal';
  assert.deepEqual(layerNames('textures/blocks/piston_top.png', taken), { mer: 'piston_top_mer', mers: 'piston_top_mers', normal: 'piston_top_pbr_normal' });

  const n = bedrockNormal(img(1, 1, () => [128, 128, 255, 200]));
  assert.deepEqual(px(n, 0, 0), [128, 128, 255, 255]);
  const tilted = bedrockNormal(img(1, 1, () => [218, 128, 255, 255]));
  assert.ok(tilted.data[2] > 128 && tilted.data[2] < 255, 'Z rebuilt from X and Y');
});

// ---------------------------------------------------------------------------------------------
// Export

const glowStone = (): PbrMaterial => ({ ...materialFromPreset(presetById('glowSpots')!), updatedAt: 1 });

test('Java 26.3: _n and _s next to the textures, nothing for plain materials, sizes follow the export', async () => {
  const assets = fakeAssets('java', '26.3', { ...javaSpec(), [`${J}block/diamond_ore.png`]: img(16, 16, (x, y) => ((x + y) % 5 ? [120, 120, 120, 255] : [40, 220, 230, 255])) });
  const p = newTextureProject({ name: 'Shiny', edition: 'java', version: '26.3' });
  await setOverride(p, `${J}block/stone.png`, noisy(32, 32, 4));
  p.pbr = {
    [`${J}block/stone.png`]: { ...materialFromPreset(presetById('rough')!), updatedAt: 1 },
    [`${J}block/diamond_ore.png`]: glowStone(),
    // glass with no bumps: only _s
    [`${J}block/glass.png`]: { ...materialFromPreset(presetById('glass')!), updatedAt: 1 },
    // plain: nothing to write
    [`${J}item/apple.png`]: { base: [...PLAIN], spots: [], bumps: null, updatedAt: 1 },
    // animated: the maps are strips with the texture's animation
    [`${J}block/water_still.png`]: { ...materialFromPreset(presetById('water')!), updatedAt: 1 },
  };
  const res = await exportTexturePack(p, assets);
  const zip = await unzipBlob(res.blob);
  for (const f of ['block/stone_n.png', 'block/stone_s.png', 'block/diamond_ore_n.png', 'block/diamond_ore_s.png', 'block/glass_s.png']) assert.ok(zip[J + f], f);
  assert.ok(!zip[`${J}block/glass_n.png`]);
  assert.ok(!zip[`${J}item/apple_s.png`] && !zip[`${J}item/apple_n.png`]);
  // vanilla colours are not added to a Java pack (the shader finds them in the game)
  assert.ok(!zip[`${J}block/diamond_ore.png`]);
  const n = await decodeImage(zip[`${J}block/stone_n.png`]);
  assert.deepEqual([n.width, n.height], [32, 32], 'maps at the size of the exported texture');
  const s = await decodeImage(zip[`${J}block/diamond_ore_s.png`]);
  assert.deepEqual(px(s, 0, 0), [255 - 80, 10, 0, 254], 'gem: shiny and glowing');
  assert.deepEqual(px(s, 1, 0), [255 - 225, 10, 0, 255], 'stone: rough, no emission');
  const water = await decodeImage(zip[`${J}block/water_still_n.png`]);
  assert.deepEqual([water.width, water.height], [16, 64]);
  assert.deepEqual(json(zip[`${J}block/water_still_n.png.mcmeta`]), json(zip[`${J}block/water_still.png.mcmeta`] ?? new TextEncoder().encode(javaSpec()[`${J}block/water_still.png.mcmeta`] as string)));
  assert.ok(zip[`${J}block/water_still_s.png.mcmeta`]);
  assert.ok(!zip[`${J}block/glass_s.png.mcmeta`], 'only animations are copied');
  assert.deepEqual(res.warnings, []);
});

test('Java 1.12.2: maps next to textures/blocks/', async () => {
  const assets = fakeAssets('java', '1.12.2', { [`${J}blocks/stone.png`]: noisy(16, 16, 2) });
  const p = newTextureProject({ name: 'Old', edition: 'java', version: '1.12.2' });
  p.pbr = { [`${J}blocks/stone.png`]: { ...materialFromPreset(presetById('polished')!), updatedAt: 1 } };
  const zip = await unzipBlob((await exportTexturePack(p, assets)).blob);
  assert.ok(zip[`${J}blocks/stone_n.png`] && zip[`${J}blocks/stone_s.png`]);
});

test('Bedrock: texture sets, layers, the colour in the pack, the "pbr" capability and the game’s sets for edited textures', async () => {
  const spec = {
    ...bedrockSpec(),
    'textures/blocks/diamond_ore.png': img(16, 16, (x, y) => ((x + y) % 5 ? [120, 120, 120, 255] : [40, 220, 230, 255])),
    'textures/blocks/stone.texture_set.json': '{"format_version":"1.21.30","minecraft:texture_set":{"color":"stone","metalness_emissive_roughness_subsurface":"stone_mers"}}',
    'textures/blocks/stone_mers.tga': solid(16, 16, [0, 0, 200, 0]),
    'textures/blocks/grass_carried.texture_set.json': '{"format_version":"1.21.30","minecraft:texture_set":{"color":"grass_carried","metalness_emissive_roughness_subsurface":"grass_carried_mers"}}',
  };
  const assets = fakeAssets('bedrock', '1.21.120', spec);
  const p = newTextureProject({ name: 'Vibrant', edition: 'bedrock', version: '1.21.120' });
  // edited, without a material: the game's set (and its layer) comes along, scaled to the new size
  await setOverride(p, 'textures/blocks/stone.png', noisy(32, 32, 3));
  // edited, and the game's set names a layer that isn't there: a plain set keeps the edit visible
  await setOverride(p, 'textures/blocks/grass_carried.png', solid(16, 16, [90, 170, 70, 255]));
  p.pbr = {
    'textures/blocks/diamond_ore.png': glowStone(),
    'textures/items/apple.png': { base: [255, 0, 60, 0], spots: [], bumps: null, updatedAt: 1 },
    'textures/blocks/leaves_oak.tga': { ...materialFromPreset(presetById('plants')!), updatedAt: 1 },
  };
  assert.ok(hasMaterials(p));
  const res = await exportTexturePack(p, assets);
  const zip = await unzipBlob(res.blob);
  const manifest = json(zip['manifest.json']);
  assert.deepEqual(manifest.capabilities, ['pbr']);
  assert.ok(manifest.header.min_engine_version[1] > 21 || manifest.header.min_engine_version[2] >= 120);

  // a part that glows: an image layer (MER, no subsurface) and a normal map
  assert.deepEqual(json(zip['textures/blocks/diamond_ore.texture_set.json']), {
    format_version: '1.16.100',
    'minecraft:texture_set': { color: 'diamond_ore', metalness_emissive_roughness: 'diamond_ore_mer', normal: 'diamond_ore_normal' },
  });
  assert.ok(zip['textures/blocks/diamond_ore.png'], 'the colour texture goes into the pack with its set');
  const mer = await decodeImage(zip['textures/blocks/diamond_ore_mer.png']);
  assert.equal(mer.data[3], 255);
  const normal = await decodeImage(zip['textures/blocks/diamond_ore_normal.png']);
  assert.equal(normal.data[3], 255);
  // one value for the whole texture: no image
  assert.deepEqual(json(zip['textures/items/apple.texture_set.json'])['minecraft:texture_set'], { color: 'apple', metalness_emissive_roughness: [255, 0, 60] });
  assert.ok(!zip['textures/items/apple_mer.png']);
  // light through: MERS as TGA (alpha kept) and format 1.21.30
  const leaves = json(zip['textures/blocks/leaves_oak.texture_set.json']);
  assert.equal(leaves.format_version, '1.21.30');
  assert.equal(leaves['minecraft:texture_set'].metalness_emissive_roughness_subsurface, 'leaves_oak_mers');
  const mers = await decodeImage(zip['textures/blocks/leaves_oak_mers.tga'], 'tga');
  assert.equal(mers.data[3], 170);
  // the game's material for an edited texture, at the texture's size
  assert.equal(text(zip['textures/blocks/stone.texture_set.json']), spec['textures/blocks/stone.texture_set.json']);
  const stoneMers = await decodeImage(zip['textures/blocks/stone_mers.tga'], 'tga');
  assert.deepEqual([stoneMers.width, stoneMers.height], [32, 32]);
  assert.deepEqual(json(zip['textures/blocks/grass_carried.texture_set.json']), { format_version: '1.16.100', 'minecraft:texture_set': { color: 'grass_carried' } });
  assert.equal(res.warnings.length, 1, res.warnings.join(' | '));

  // without materials nothing of this happens
  const plain = newTextureProject({ name: 'Plain', edition: 'bedrock', version: '1.21.120' });
  await setOverride(plain, 'textures/blocks/stone.png', noisy(16, 16, 3));
  const z2 = await unzipBlob((await exportTexturePack(plain, assets)).blob);
  assert.equal(json(z2['manifest.json']).capabilities, undefined);
  assert.ok(!z2['textures/blocks/stone.texture_set.json']);
});

test('the game’s Bedrock material is read from its texture set', async () => {
  const assets = fakeAssets('bedrock', '1.21.120', {
    'textures/blocks/stone.png': noisy(16, 16, 1),
    'textures/blocks/stone.texture_set.json': '{"minecraft:texture_set":{"color":"stone","metalness_emissive_roughness_subsurface":"stone_mers","normal":"stone_normal"}}',
    'textures/blocks/stone_mers.tga': solid(16, 16, [10, 20, 30, 40]),
    'textures/blocks/stone_normal.png': solid(16, 16, [128, 0, 200, 255]),
    'textures/blocks/glass.png': noisy(16, 16, 1),
    'textures/blocks/glass.texture_set.json': '{"minecraft:texture_set":{"color":"glass","metalness_emissive_roughness":[0, 0, 12]}}',
  });
  const stone = await gameMaterial(assets, 'textures/blocks/stone.png');
  assert.equal(stone?.map?.layout, 'mers');
  assert.equal(stone?.normal?.layout, 'normal');
  assert.deepEqual(px(await decodeMap(stone!.map!, true), 0, 0), [10, 20, 30, 40]);
  assert.deepEqual(px(await decodeMap(stone!.normal!, true), 0, 0), [128, 0, 255, 255], 'as a labPBR-layout normal map');
  assert.deepEqual((await gameMaterial(assets, 'textures/blocks/glass.png'))?.values, [0, 0, 12, 0]);
  assert.equal(await gameMaterial(assets, 'textures/blocks/dirt.png'), null);
});

// ---------------------------------------------------------------------------------------------
// Opened packs

test('opened Java pack: _n / _s go into the materials and export unchanged; the game’s *_n textures stay', async () => {
  const spec = { ...javaSpec(), [`${J}particle/sga_n.png`]: solid(8, 8, [255, 255, 255, 255]) };
  const assets = fakeAssets('java', '26.3', spec);
  const p = newTextureProject({ name: 'Imported', edition: 'java', version: '26.3' });
  const n = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
  const s = new Blob([new Uint8Array([4, 5, 6])], { type: 'image/png' });
  p.overrides[`${J}block/stone_n.png`] = n;
  p.overrides[`${J}block/stone_s.png`] = s;
  p.overrides[`${J}block/custom_n.png`] = n; // no colour texture anywhere: stays a texture
  p.overrides[`${J}particle/sga_n.png`] = n; // a game texture
  assert.equal(await adoptPackPbr(p, assets), 1);
  assert.deepEqual(Object.keys(p.overrides).sort(), [`${J}block/custom_n.png`, `${J}particle/sga_n.png`]);
  const m = p.pbr![`${J}block/stone.png`];
  assert.equal(m.map?.layout, 'specular');
  assert.equal(m.normal?.layout, 'labpbr');
  assert.deepEqual(Object.keys(m.original!).sort(), [`${J}block/stone_n.png`, `${J}block/stone_s.png`]);
  const zip = await unzipBlob((await exportTexturePack(p, assets)).blob);
  assert.deepEqual(Array.from(zip[`${J}block/stone_n.png`]), [1, 2, 3]);
  assert.deepEqual(Array.from(zip[`${J}block/stone_s.png`]), [4, 5, 6]);
});

test('opened Bedrock pack: texture sets with their layers go into the materials', async () => {
  const assets = fakeAssets('bedrock', '1.21.120', bedrockSpec());
  const p = newTextureProject({ name: 'Imported', edition: 'bedrock', version: '1.21.120' });
  const blob = (t: string) => new Blob([t], { type: 'application/json' });
  p.overrides['textures/blocks/stone.png'] = new Blob([new Uint8Array([9])], { type: 'image/png' });
  p.extraFiles['textures/blocks/stone.texture_set.json'] = blob('{"format_version":"1.16.100","minecraft:texture_set":{"color":"stone","metalness_emissive_roughness":"stone_mer","heightmap":"stone_heightmap"}}');
  p.extraFiles['textures/blocks/stone_mer.png'] = new Blob([new Uint8Array([1])], { type: 'image/png' });
  p.extraFiles['textures/blocks/stone_heightmap.png'] = new Blob([new Uint8Array([2])], { type: 'image/png' });
  // uniform values
  p.overrides['textures/blocks/glass.png'] = new Blob([new Uint8Array([9])], { type: 'image/png' });
  p.extraFiles['textures/blocks/glass.texture_set.json'] = blob('{"minecraft:texture_set":{"color":"glass","metalness_emissive_roughness":[0,0,9]}}');
  // its colour texture isn't in the pack: left as it is
  p.extraFiles['textures/blocks/dirt.texture_set.json'] = blob('{"minecraft:texture_set":{"color":"dirt"}}');
  assert.equal(await adoptPackPbr(p, assets), 2);
  assert.deepEqual(Object.keys(p.extraFiles), ['textures/blocks/dirt.texture_set.json']);
  const stone = p.pbr!['textures/blocks/stone.png'];
  assert.equal(stone.map?.layout, 'mer');
  assert.equal(stone.normal?.layout, 'heightmap');
  assert.deepEqual(p.pbr!['textures/blocks/glass.png'].base, [0, 0, 9, 0]);
  const zip = await unzipBlob((await exportTexturePack(p, assets)).blob);
  assert.deepEqual(Array.from(zip['textures/blocks/stone_mer.png']), [1]);
  assert.ok(zip['textures/blocks/stone.texture_set.json'] && zip['textures/blocks/dirt.texture_set.json']);
  assert.deepEqual(json(zip['manifest.json']).capabilities, ['pbr']);
  // a heightmap opens as a normal map made from it
  const hm = createImageData(4, 1);
  [0, 80, 160, 255].forEach((v, i) => hm.data.set([v, v, v, 255], i * 4));
  const { encodePng } = await import('../../src/core/image');
  const normal = await decodeMap({ image: new Blob([encodePng(hm)], { type: 'image/png' }), layout: 'heightmap' }, false);
  assert.ok(normal.data[4] < 128, 'rising to the right faces left');
});
