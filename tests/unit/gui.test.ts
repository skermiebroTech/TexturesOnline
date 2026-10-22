/**
 * GUI section of the texture pack editor: which files and atlas areas each interface piece is in
 * per edition and version, splash texts (Java splashes.txt / Bedrock splashes.json), the stretch
 * rules of sprites, the bitmap font, the panorama's cube faces, the enchantment glint, the jar's
 * panorama stand-ins, and what the exported packs contain. The real-jar part checks every Minecraft
 * client jar in the fixtures (TO_FIXTURES) and skips without them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import { createImageData, decodeImage, encodePng } from '../../src/core/image';
import { exportTexturePack } from '../../src/tools/textures/export';
import { newTextureProject, setOverride } from '../../src/tools/textures/project';
import { GUI_SCREENS, guiCatalog, javaAtLeast, javaUsesSprites, partOfPath, pieceRect } from '../../src/tools/textures/gui/catalog';
import { SPLASH_MAX, addSplashes, bedrockSplashesJson, cleanSplash, javaSplashesText, packSplashes, parseBedrockSplashes, parseJavaSplashes, splashPath, splashesBlob } from '../../src/tools/textures/gui/splashes';
import { bedrockScaling, javaScaling } from '../../src/tools/textures/gui/scaling';
import { BitmapFont, LEGACY_CHARS, bitmapProviders, colourRuns, fontTexturePath, legacyProvider } from '../../src/tools/textures/gui/font';
import { faceOf, panoramaHit, renderPanorama } from '../../src/tools/textures/gui/panorama';
import { glintItem, glintLayers } from '../../src/tools/textures/gui/glint';
import { guiScale } from '../../src/tools/textures/gui/render';
import { assetObjectUrls, isStandIn, isStandInImage } from '../../src/editions/java/asset-objects';
import { fakeAssets, img, javaSpec, bedrockSpec, json, noisy, text, unzipBlob } from '../tools/texlogic/fixtures';

const J = 'assets/minecraft/textures/';
const set = (paths: string[]) => {
  const s = new Set(paths);
  return (p: string) => s.has(p);
};

// ---------------------------------------------------------------------------------------------
// Catalogue

/** The files of a 1.20.2+ jar that matter here. */
const MODERN = [
  'gui/sprites/hud/hotbar.png', 'gui/sprites/hud/hotbar_selection.png', 'gui/sprites/hud/hotbar_offhand_left.png', 'gui/sprites/hud/hotbar_offhand_right.png',
  'gui/sprites/hud/crosshair.png', 'gui/sprites/hud/heart/full.png', 'gui/sprites/hud/heart/half.png', 'gui/sprites/hud/heart/container.png', 'gui/sprites/hud/heart/frozen_full.png',
  'gui/sprites/hud/food_full.png', 'gui/sprites/hud/air.png', 'gui/sprites/hud/air_empty.png', 'gui/sprites/hud/experience_bar_background.png', 'gui/sprites/hud/experience_bar_progress.png',
  'gui/sprites/widget/button.png', 'gui/sprites/widget/button_highlighted.png', 'gui/sprites/widget/button_disabled.png',
  'gui/sprites/container/furnace/lit_progress.png', 'gui/sprites/container/furnace/burn_progress.png',
  'gui/container/inventory.png', 'gui/container/generic_54.png', 'gui/container/furnace.png', 'gui/container/crafting_table.png',
  'gui/menu_background.png', 'gui/title/minecraft.png', 'gui/title/background/panorama_0.png', 'misc/enchanted_glint_item.png', 'misc/enchanted_glint_armor.png',
].map((p) => J + p);
const LEGACY = ['gui/icons.png', 'gui/widgets.png', 'gui/container/inventory.png', 'gui/container/furnace.png', 'gui/options_background.png', 'misc/enchanted_item_glint.png', 'gui/title/background/panorama_3.png'].map((p) => J + p);

test('versions: release order and the 1.20.2 switch to sprites', () => {
  assert.ok(javaAtLeast('1.20.2', '1.20.2'));
  assert.ok(!javaAtLeast('1.20.1', '1.20.2'));
  assert.ok(javaAtLeast('26.3', '1.17'));
  assert.ok(!javaAtLeast('1.8.9', '1.9'));
  assert.ok(javaAtLeast('26.4-snapshot-1', '1.9'), 'unknown ids are newer');
  assert.ok(javaUsesSprites(set(MODERN)));
  assert.ok(!javaUsesSprites(set(LEGACY)));
});

test('Java 1.20.2+: one file per sprite', () => {
  const cat = guiCatalog('java', '26.3', set(MODERN));
  assert.equal(cat.atlases, false);
  assert.equal(cat.piece('hearts.full')?.path, `${J}gui/sprites/hud/heart/full.png`);
  assert.equal(cat.piece('hearts.full')?.region, undefined);
  assert.equal(cat.piece('hotbar.bar')?.path, `${J}gui/sprites/hud/hotbar.png`);
  assert.equal(cat.piece('button.hover')?.path, `${J}gui/sprites/widget/button_highlighted.png`);
  assert.equal(cat.piece('air.empty')?.path, `${J}gui/sprites/hud/air_empty.png`);
  assert.equal(cat.piece('furnace.flame')?.path, `${J}gui/sprites/container/furnace/lit_progress.png`);
  assert.equal(cat.piece('glint.item')?.path, `${J}misc/enchanted_glint_item.png`);
  assert.equal(cat.piece('glint.armor')?.path, `${J}misc/enchanted_glint_armor.png`);
  assert.equal(cat.piece('heartsPoisoned.full'), undefined, 'files the version lacks are left out');
  assert.deepEqual(cat.screens, [...GUI_SCREENS]);
  assert.equal(cat.splashPath, 'assets/minecraft/texts/splashes.txt');
  assert.equal(partOfPath(cat, `${J}gui/container/generic_54.png`)?.container, 'chest');
  assert.equal(partOfPath(cat, `${J}gui/menu_background.png`)?.screen, 'menu');
  assert.equal(partOfPath(cat, `${J}block/stone.png`), null);
});

test('Java before 1.20.2: areas of gui/icons.png and gui/widgets.png', () => {
  const cat = guiCatalog('java', '1.20.1', set(LEGACY));
  assert.equal(cat.atlases, true);
  const full = cat.piece('hearts.full')!;
  assert.equal(full.path, `${J}gui/icons.png`);
  assert.deepEqual(full.region, { x: 52, y: 0, w: 9, h: 9 });
  assert.equal(full.atlas, 256);
  assert.deepEqual(cat.piece('heartsFrozen.full')?.region, { x: 178, y: 0, w: 9, h: 9 });
  assert.deepEqual(cat.piece('heartsHardcore.full')?.region, { x: 52, y: 45, w: 9, h: 9 });
  assert.deepEqual(cat.piece('heartsMount.empty')?.region, { x: 52, y: 9, w: 9, h: 9 });
  assert.deepEqual(cat.piece('foodHunger.empty')?.region, { x: 133, y: 27, w: 9, h: 9 });
  assert.deepEqual(cat.piece('armor.full')?.region, { x: 34, y: 9, w: 9, h: 9 });
  assert.deepEqual(cat.piece('xp.full')?.region, { x: 0, y: 69, w: 182, h: 5 });
  assert.deepEqual(cat.piece('crosshair.crosshair')?.region, { x: 0, y: 0, w: 15, h: 15 });
  assert.deepEqual(cat.piece('hotbar.bar')?.region, { x: 0, y: 0, w: 182, h: 22 });
  assert.deepEqual(cat.piece('hotbar.offhandRight')?.region, { x: 53, y: 22, w: 29, h: 24 });
  assert.deepEqual(cat.piece('button.normal')?.region, { x: 0, y: 66, w: 200, h: 20 });
  assert.deepEqual(cat.piece('button.disabled')?.region, { x: 0, y: 46, w: 200, h: 20 });
  assert.deepEqual(cat.piece('furnace.arrow')?.region, { x: 176, y: 14, w: 24, h: 17 });
  assert.equal(cat.piece('furnace.arrow')?.path, `${J}gui/container/furnace.png`);
  assert.equal(cat.piece('air.empty'), undefined, 'no empty bubble before the sprites');
  assert.equal(cat.piece('heartsAbsorbing.fullFlash'), undefined);
  assert.equal(cat.piece('glint.item')?.path, `${J}misc/enchanted_item_glint.png`);
  assert.equal(cat.piece('backgrounds.dirt')?.path, `${J}gui/options_background.png`);
  // the atlas pieces of one file
  assert.ok(cat.piecesOf(`${J}gui/icons.png`).length > 40);
  // frozen hearts came in 1.17, the off-hand in 1.9
  const old = guiCatalog('java', '1.8.9', set(LEGACY));
  assert.equal(old.piece('heartsFrozen.full'), undefined);
  assert.equal(old.piece('hotbar.offhandLeft'), undefined);
  assert.ok(old.piece('hotbar.selected'));
  assert.ok(guiCatalog('java', '1.12.2', set(LEGACY)).piece('hotbar.offhandLeft'));
  assert.equal(old.part('heartsFrozen'), undefined, 'a part without pieces is left out');
});

test('areas scale with HD copies of an atlas', () => {
  const piece = { region: { x: 52, y: 0, w: 9, h: 9 }, atlas: 256 };
  assert.deepEqual(pieceRect(piece, { width: 256, height: 256 }), { x: 52, y: 0, w: 9, h: 9 });
  assert.deepEqual(pieceRect(piece, { width: 512, height: 512 }), { x: 104, y: 0, w: 18, h: 18 });
  assert.deepEqual(pieceRect({}, { width: 9, height: 9 }), { x: 0, y: 0, w: 9, h: 9 });
  // never past the image
  assert.deepEqual(pieceRect({ region: { x: 250, y: 250, w: 20, h: 20 }, atlas: 256 }, { width: 256, height: 256 }), { x: 250, y: 250, w: 6, h: 6 });
});

test('Bedrock: textures/ui files, the crosshair on gui/icons.png, splashes.json', () => {
  const B = (p: string) => `textures/${p}`;
  const files = ['ui/heart.png', 'ui/heart_half.png', 'ui/heart_background.png', 'ui/hotbar_0.png', 'ui/hotbar_8.png', 'ui/selected_hotbar_slot.png', 'gui/icons.png', 'ui/classic-button.png', 'ui/dialog_background_opaque.png', 'ui/cell_image.png', 'ui/panorama_0.png', 'ui/title.png', 'misc/enchanted_item_glint.png', 'misc/enchanted_actor_glint.png'].map(B);
  const cat = guiCatalog('bedrock', '1.21.120', set(files));
  assert.equal(cat.atlases, false);
  assert.equal(cat.piece('hearts.full')?.path, 'textures/ui/heart.png');
  assert.equal(cat.piece('hotbar.slot1')?.path, 'textures/ui/hotbar_0.png');
  assert.equal(cat.piece('hotbar.slot9')?.path, 'textures/ui/hotbar_8.png');
  assert.equal(cat.piece('hotbar.slot2'), undefined);
  assert.deepEqual(cat.piece('crosshair.crosshair')?.region, { x: 0, y: 0, w: 15, h: 15 });
  assert.equal(cat.piece('crosshair.crosshair')?.path, 'textures/gui/icons.png');
  assert.equal(cat.piece('window.slot')?.path, 'textures/ui/cell_image.png');
  assert.equal(cat.piece('glint.entity')?.path, 'textures/misc/enchanted_actor_glint.png');
  assert.equal(cat.splashPath, 'splashes.json');
  assert.ok(!cat.screens.includes('menu'), 'no menu backgrounds on Bedrock');
  assert.ok(cat.screens.includes('title') && cat.screens.includes('inventory'));
});

// ---------------------------------------------------------------------------------------------
// Splash texts

test('splash texts: Java one per line, Bedrock JSON, cleaning and adding', () => {
  assert.deepEqual(parseJavaSplashes('﻿Hello!\r\nWorld\n\n  \nLast'), ['Hello!', 'World', 'Last']);
  assert.equal(javaSplashesText(['A', '  b  ', '', 'c\nd']), 'A\nb\nc d\n');
  assert.equal(javaSplashesText([]), '');
  assert.deepEqual(parseBedrockSplashes('{ "splashes": ["One", "", 2, "Two"] }'), ['One', 'Two']);
  assert.deepEqual(parseBedrockSplashes('["Bare"]'), ['Bare']);
  assert.equal(parseBedrockSplashes('{nope'), null);
  assert.deepEqual(JSON.parse(bedrockSplashesJson(['x', ' y '])), { splashes: ['x', 'y'] });
  assert.equal(cleanSplash('  a\t\tb  '), 'a b');
  assert.equal(cleanSplash('z'.repeat(500)).length, SPLASH_MAX);
  const r = addSplashes(['Hi!'], ['hi!', 'New', '', 'New', 'Other']);
  assert.deepEqual(r, { list: ['Hi!', 'New', 'Other'], added: 2 });
  assert.equal(splashPath('java'), 'assets/minecraft/texts/splashes.txt');
  assert.equal(splashPath('bedrock'), 'splashes.json');
  assert.equal(splashesBlob('java', null), null);
});

test('splash texts: read back from the pack', async () => {
  const p = newTextureProject({ name: 'S', edition: 'java', version: '26.3' });
  assert.equal(await packSplashes(p), null);
  p.extraFiles['assets/minecraft/texts/splashes.txt'] = splashesBlob('java', ['One', 'Two'])!;
  assert.deepEqual(await packSplashes(p), ['One', 'Two']);
  const b = newTextureProject({ name: 'B', edition: 'bedrock', version: '1.21.120' });
  b.extraFiles['splashes.json'] = splashesBlob('bedrock', ['Bedrock!'])!;
  assert.deepEqual(await packSplashes(b), ['Bedrock!']);
});

// ---------------------------------------------------------------------------------------------
// Sprite stretching

test('sprite stretch rules: Java .mcmeta and Bedrock .json', () => {
  assert.deepEqual(javaScaling({ gui: { scaling: { type: 'nine_slice', width: 200, height: 20, border: 3 } } }), { type: 'nine', width: 200, height: 20, border: [3, 3, 3, 3] });
  assert.deepEqual(javaScaling({ gui: { scaling: { type: 'nine_slice', width: 32, height: 32, border: { left: 1, top: 2, right: 3, bottom: 4 }, stretch_inner: true } } }), {
    type: 'nine',
    width: 32,
    height: 32,
    border: [1, 2, 3, 4],
    stretch: true,
  });
  assert.deepEqual(javaScaling({ gui: { scaling: { type: 'tile', width: 16, height: 8 } } }), { type: 'tile', width: 16, height: 8 });
  assert.deepEqual(javaScaling({ gui: { scaling: { type: 'stretch' } } }), { type: 'stretch' });
  assert.equal(javaScaling({ animation: {} }), null);
  assert.deepEqual(bedrockScaling({ nineslice_size: 2, base_size: [5, 5] }, { width: 5, height: 5 }), { type: 'nine', width: 5, height: 5, border: [2, 2, 2, 2], stretch: true });
  assert.deepEqual(bedrockScaling({ nineslice_size: [6, 1, 6, 1] }, { width: 13, height: 5 }), { type: 'nine', width: 13, height: 5, border: [6, 1, 6, 1], stretch: true });
  assert.equal(bedrockScaling({ base_size: [5, 5] }, { width: 5, height: 5 }), null);
});

// ---------------------------------------------------------------------------------------------
// Font

test('font: the old 16 × 16 order, font files with references, glyph widths', () => {
  assert.equal([...LEGACY_CHARS].length, 256);
  assert.equal(LEGACY_CHARS[32], ' ');
  assert.equal(LEGACY_CHARS[65], 'A');
  assert.equal(LEGACY_CHARS[0x80], 'Ç');
  assert.equal(fontTexturePath('minecraft:font/ascii.png'), 'assets/minecraft/textures/font/ascii.png');
  const files: Record<string, unknown> = {
    'assets/minecraft/font/include/default.json': {
      providers: [
        { type: 'bitmap', file: 'minecraft:font/accented.png', height: 12, ascent: 10, chars: ['ÀÁ'] },
        { type: 'bitmap', file: 'minecraft:font/ascii.png', ascent: 7, chars: ['AB'] },
        { type: 'space', advances: { ' ': 4 } },
      ],
    },
  };
  const list = bitmapProviders({ providers: [{ type: 'reference', id: 'minecraft:include/default' }, { type: 'unihex', hex_file: 'x' }] }, (p) => files[p]);
  assert.deepEqual(
    list.map((p) => [p.path, p.height, p.ascent]),
    [
      ['assets/minecraft/textures/font/accented.png', 12, 10],
      ['assets/minecraft/textures/font/ascii.png', 8, 7],
    ],
  );
  // a 2-glyph picture: 'A' 5 columns drawn, 'B' 3
  const pic = img(16, 8, (x) => (x < 5 || (x >= 8 && x < 11) ? [255, 255, 255, 255] : [0, 0, 0, 0]));
  const font = new BitmapFont([{ path: 'p', chars: ['AB'], height: 8, ascent: 7 }], () => pic);
  assert.equal(font.glyph('A')?.advance, 6);
  assert.equal(font.glyph('B')?.advance, 4);
  assert.equal(font.width('AB A'), 6 + 4 + 4 + 6);
  assert.equal(font.width('§eA'), 6, '§ codes take no room');
  assert.ok(font.canDraw('A B'));
  assert.ok(!font.canDraw('AZ'));
  assert.equal(legacyProvider('x').chars.length, 16);
  assert.deepEqual(colourRuns('a§eb§rc', 0xffffff), [
    { text: 'a', colour: 0xffffff },
    { text: 'b', colour: 0xffff55 },
    { text: 'c', colour: 0xffffff },
  ]);
});

// ---------------------------------------------------------------------------------------------
// Panorama

test('panorama: faces around the camera and the edges that meet', () => {
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  const f0 = faceOf(0, 0, -1);
  assert.equal(f0.face, 0);
  assert.ok(near(f0.u, 0.5) && near(f0.v, 0.5));
  assert.equal(faceOf(1, 0, 0).face, 1);
  assert.equal(faceOf(0, 0, 1).face, 2);
  assert.equal(faceOf(-1, 0, 0).face, 3);
  assert.equal(faceOf(0, 1, 0).face, 4);
  assert.equal(faceOf(0, -1, 0).face, 5);
  // the front's right edge meets the right face's left edge
  assert.ok(faceOf(0.999, 0, -1).u > 0.99);
  assert.ok(faceOf(1, 0, -0.999).u < 0.01);
  // the top's bottom edge and the bottom's top edge meet the front
  assert.ok(faceOf(0, 1, -0.999).v > 0.99);
  assert.ok(faceOf(0, -1, -0.999).v < 0.01);
  // turned a quarter to the right, the middle of the screen shows the right face
  assert.equal(panoramaHit(0.5, 0.5, 4 / 3, { yaw: 90, pitch: 0, fov: 85 }).face, 1);
  assert.equal(panoramaHit(0.5, 0.5, 4 / 3, { yaw: 0, pitch: 80, fov: 85 }).face, 4);
  // drawing: each face's colour where it shows, dark where a face is missing
  const faces = [0, 1, 2, 3, 4].map((i) => createImageData(4, 4, new Uint8ClampedArray(64).map((_, k) => (k % 4 === 3 ? 255 : i * 40))));
  const out = createImageData(32, 24);
  renderPanorama(out, [...faces, null], { yaw: 0, pitch: 0, fov: 85 });
  const centre = ((12 * 32 + 16) * 4) | 0;
  assert.equal(out.data[centre], 0, 'front in the middle');
  renderPanorama(out, [...faces, null], { yaw: 0, pitch: -89, fov: 60 });
  assert.equal(out.data[centre], 24, 'missing bottom face is dark');
});

// ---------------------------------------------------------------------------------------------
// Glint

test('glint: added over the item only, scrolling with time', () => {
  const item = img(4, 4, (x, y) => (x === 0 && y === 0 ? [0, 0, 0, 0] : [100, 50, 20, 255]));
  const plain = glintItem(item, null, 2, { time: 0 });
  assert.equal(plain.width, 8);
  assert.deepEqual([...plain.data.slice(8 * 4 * 2, 8 * 4 * 2 + 4)], [100, 50, 20, 255]);
  const glint = img(8, 8, (x) => (x < 4 ? [128, 64, 204, 255] : [0, 0, 0, 255]));
  const a = glintItem(item, glint, 2, { time: 0 });
  assert.equal(a.data[3], 0, 'clear pixels stay clear');
  assert.ok(a.data.some((v, i) => i % 4 === 2 && v > 20), 'the glint brightens the item');
  const b = glintItem(item, glint, 2, { time: 2000 });
  assert.notDeepEqual([...a.data], [...b.data], 'it moves');
  assert.equal(glintLayers(0).length, 1);
  assert.equal(glintLayers(0, true).length, 2);
});

test('GUI scale: the largest whole scale with at least 320 × 240 GUI pixels', () => {
  assert.equal(guiScale(340, 255), 1);
  assert.equal(guiScale(1100, 780), 3);
  assert.equal(guiScale(200, 100), 1);
});

// ---------------------------------------------------------------------------------------------
// The jar's panorama stand-ins

test('panorama stand-ins: 1 × 1 jar pictures are swapped for the real ones', () => {
  const tiny = encodePng(createImageData(1, 1));
  const real = encodePng(createImageData(16, 16));
  assert.ok(isStandIn(`${J}gui/title/background/panorama_0.png`, tiny));
  assert.ok(isStandIn(`${J}gui/title/background/panorama_overlay.png`, tiny));
  assert.ok(!isStandIn(`${J}gui/title/background/panorama_0.png`, real));
  assert.ok(!isStandIn(`${J}block/stone.png`, tiny));
  assert.ok(isStandInImage(`${J}gui/title/background/panorama_5.png`, { width: 1, height: 1 }));
  assert.deepEqual(assetObjectUrls('26.3', 'x/y.png'), ['https://raw.githubusercontent.com/misode/mcmeta/26.3-assets/x/y.png', 'https://cdn.jsdelivr.net/gh/misode/mcmeta@26.3-assets/x/y.png']);
});

// ---------------------------------------------------------------------------------------------
// Export

test('export, Java: GUI sprites, atlas edits and splashes.txt go into the zip; panorama stand-ins never do', async () => {
  const spec = {
    ...javaSpec(),
    [`${J}gui/sprites/hud/heart/full.png`]: noisy(9, 9, 2),
    [`${J}gui/icons.png`]: noisy(32, 32, 3),
    [`${J}gui/title/background/panorama_0.png`]: createImageData(1, 1),
  };
  const assets = fakeAssets('java', '26.3', spec);
  const p = newTextureProject({ name: 'GUI', edition: 'java', version: '26.3' });
  await setOverride(p, `${J}gui/sprites/hud/heart/full.png`, noisy(9, 9, 9));
  await setOverride(p, `${J}gui/title/background/panorama_2.png`, noisy(64, 64, 4));
  p.extraFiles['assets/minecraft/texts/splashes.txt'] = splashesBlob('java', ['Made here!', 'Hello'])!;
  let zip = await unzipBlob((await exportTexturePack(p, assets)).blob);
  assert.ok(zip[`${J}gui/sprites/hud/heart/full.png`]);
  assert.ok(zip[`${J}gui/title/background/panorama_2.png`]);
  assert.equal(text(zip['assets/minecraft/texts/splashes.txt']), 'Made here!\nHello\n');
  // an effect over the whole pack skips the jar's 1 × 1 stand-in instead of writing it into the pack
  p.effects.push({ id: 'g', type: 'grayscale', enabled: true, params: {} });
  zip = await unzipBlob((await exportTexturePack(p, assets)).blob);
  assert.ok(zip[`${J}gui/icons.png`], 'the effect reaches the GUI');
  assert.equal(zip[`${J}gui/title/background/panorama_0.png`], undefined);
});

test('export, Bedrock: textures/ui files and splashes.json at the root of the .mcpack', async () => {
  const spec = { ...bedrockSpec(), 'textures/ui/heart.png': noisy(9, 9, 1) };
  const assets = fakeAssets('bedrock', '1.21.120', spec);
  const p = newTextureProject({ name: 'GUI', edition: 'bedrock', version: '1.21.120' });
  await setOverride(p, 'textures/ui/heart.png', noisy(9, 9, 5));
  p.extraFiles['splashes.json'] = splashesBlob('bedrock', ['Bedrock splash'])!;
  const zip = await unzipBlob((await exportTexturePack(p, assets)).blob);
  assert.ok(zip['textures/ui/heart.png']);
  assert.deepEqual(json(zip['splashes.json']), { splashes: ['Bedrock splash'] });
  assert.ok(zip['manifest.json']);
});

// ---------------------------------------------------------------------------------------------
// Bedrock's file list (shipped with the app) and real jars

test('Bedrock catalogue: each GUI piece is in bedrock-samples (main and preview)', () => {
  for (const ref of ['main', 'preview']) {
    const index = JSON.parse(readFileSync(join(import.meta.dirname, `../../public/data/bedrock/index-${ref}.json`), 'utf8')) as { dirs: Record<string, string[]> };
    const files = Object.entries(index.dirs).flatMap(([dir, names]) => names.map((n) => (dir ? `${dir}/${n}` : n)));
    const cat = guiCatalog('bedrock', ref, set(files));
    for (const id of ['hotbar.slot1', 'hotbar.slot9', 'hotbar.selected', 'hotbar.startCap', 'crosshair.crosshair', 'hearts.full', 'hearts.empty', 'heartsPoisoned.full', 'heartsWithered.full', 'heartsFrozen.full', 'heartsAbsorbing.full', 'heartsHardcore.full', 'heartsMount.full', 'food.full', 'foodHunger.full', 'armor.full', 'air.full', 'xp.empty', 'xp.full', 'xp.nub', 'window.panel', 'window.slot', 'button.normal', 'button.hover', 'button.pressed', 'panorama.front', 'panorama.bottom', 'logo.logo', 'glint.item', 'glint.entity']) {
      assert.ok(cat.piece(id), `${ref}: ${id}`);
    }
  }
});

const FX = (() => {
  const d = process.env.TO_FIXTURES;
  return d && existsSync(join(d, 'research-cache', 'jars')) ? d : null;
})();
const jars = FX
  ? [
      ...readdirSync(join(FX, 'research-cache', 'jars'))
        .filter((f) => /^(1\.\d+(\.\d+)?|2\d\.\d+(\.\d+)?)\.jar$/.test(f))
        .map((f) => ({ v: f.replace(/\.jar$/, ''), jar: join(FX, 'research-cache', 'jars', f) })),
    ]
  : [];
if (FX && existsSync(join(FX, 'client-26.3.jar'))) jars.push({ v: '26.3', jar: join(FX, 'client-26.3.jar') });

test('every jar: each GUI piece is a file of that version, atlas areas hold pixels', { skip: FX ? false : 'set TO_FIXTURES to a folder with research-cache/jars/<version>.jar' }, async () => {
  assert.ok(jars.length >= 5);
  for (const { v, jar } of jars) {
    const names: string[] = [];
    const atlasFiles = new Set([`${J}gui/icons.png`, `${J}gui/widgets.png`, `${J}gui/container/furnace.png`, `${J}gui/title/background/panorama_0.png`]);
    const files = unzipSync(new Uint8Array(readFileSync(jar)), {
      filter: (f) => {
        names.push(f.name);
        return atlasFiles.has(f.name);
      },
    });
    const has = set(names);
    const cat = guiCatalog('java', v, has);
    const sprites = javaAtLeast(v, '1.20.2');
    assert.equal(!cat.atlases, sprites, `${v}: sprites from 1.20.2`);
    for (const id of ['hotbar.bar', 'hotbar.selected', 'crosshair.crosshair', 'hearts.full', 'hearts.half', 'hearts.empty', 'heartsPoisoned.full', 'heartsWithered.full', 'heartsHardcore.full', 'heartsMount.full', 'food.full', 'foodHunger.full', 'armor.full', 'air.full', 'xp.empty', 'xp.full', 'button.normal', 'button.hover', 'button.disabled', 'inventory.window', 'chest.window', 'furnace.window', 'furnace.flame', 'furnace.arrow', 'crafting.window', 'panorama.front', 'logo.logo', 'glint.item']) {
      assert.ok(cat.piece(id), `${v}: ${id}`);
    }
    assert.equal(!!cat.piece('heartsFrozen.full'), javaAtLeast(v, '1.17'), `${v}: frozen hearts from 1.17`);
    assert.equal(!!cat.piece('hotbar.offhandLeft'), javaAtLeast(v, '1.9'), `${v}: off-hand from 1.9`);
    for (const part of cat.parts) for (const piece of part.pieces) assert.ok(has(piece.path), `${v}: ${piece.path}`);
    assert.ok(has(cat.splashPath), `${v}: splashes.txt`);
    // every atlas area has something drawn in it
    for (const path of [`${J}gui/icons.png`, `${J}gui/widgets.png`, `${J}gui/container/furnace.png`]) {
      if (!files[path]) continue;
      const image = await decodeImage(files[path]);
      for (const piece of cat.piecesOf(path)) {
        if (!piece.region) continue;
        const r = pieceRect(piece, image);
        let drawn = 0;
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (image.data[(y * image.width + x) * 4 + 3] > 0) drawn++;
        assert.ok(drawn > 0, `${v}: ${piece.id} at ${JSON.stringify(piece.region)} is empty`);
      }
    }
    // from 1.15 the jar's panorama is a stand-in for the real picture
    const pano = files[`${J}gui/title/background/panorama_0.png`];
    if (pano) assert.equal(isStandIn(`${J}gui/title/background/panorama_0.png`, pano), javaAtLeast(v, '1.15'), `${v}: panorama stand-in`);
  }
});
