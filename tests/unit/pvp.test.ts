/**
 * PvP / FPS tweaks of the texture pack editor: which files each tweak writes per game version, the
 * pixel and model changes themselves, switching them on and off through the editor's store (files
 * changed in between are kept), and what the exported pack contains. The real-jar part runs against
 * every Minecraft client jar in the fixtures (TO_FIXTURES) and skips without them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import type { AssetIndex } from '../../src/core/types';
import { createImageData, decodeImage } from '../../src/core/image';
import { buildJavaTextureList } from '../../src/editions/java/textures';
import { applyEffects } from '../../src/tools/textures/effects';
import { exportTexturePack, withoutAnimation } from '../../src/tools/textures/export';
import { newTextureProject } from '../../src/tools/textures/project';
import { TexStore } from '../../src/tools/textures/ui/store';
import { createPvpEngine } from '../../src/tools/textures/pvp/apply';
import {
  PVP_TWEAKS,
  clearGlassImage,
  crosshairCell,
  crosshairPixels,
  crosshairTarget,
  fireModelUsingCopy,
  fireOverlayPath,
  firstPersonModels,
  firstPersonSlots,
  glassTextures,
  imageHash,
  javaPvpRules,
  lowFireImage,
  lowerShield,
  pumpkinPath,
  smallerHeld,
  tweakSupport,
  weaponItems,
  withCrosshair,
  CROSSHAIRS,
} from '../../src/tools/textures/pvp/tweaks';
import { PVP_EXAMPLE_FILES, PVP_SWORD_189, PVP_SWORD_LATEST } from '../../src/tools/guides/pvp-files';
import { fakeAssets, javaSpec, unzipBlob, json, text } from '../tools/texlogic/fixtures';

const J = 'assets/minecraft/textures/';

// ---------------------------------------------------------------------------------------------
// Versions and files

test('version rules: models from 1.8, shields from 1.9, the flattening in 1.13, HUD sprites in 1.20.2, item definitions in 1.21.4', () => {
  const r = (v: string) => javaPvpRules(v);
  assert.deepEqual(r('1.7.10'), { models: false, legacyDisplay: false, shield: false, flattened: false, hudSprites: false, itemDefinitions: false });
  assert.deepEqual(r('1.8.9'), { models: true, legacyDisplay: true, shield: false, flattened: false, hudSprites: false, itemDefinitions: false });
  assert.equal(r('1.9.4').shield, true);
  assert.equal(r('1.9.4').legacyDisplay, false);
  assert.equal(r('1.12.2').flattened, false);
  assert.equal(r('1.13').flattened, true);
  assert.equal(r('1.20.1').hudSprites, false);
  assert.equal(r('1.20.2').hudSprites, true);
  assert.equal(r('1.21.3').itemDefinitions, false);
  assert.equal(r('1.21.4').itemDefinitions, true);
  assert.deepEqual(r('26.3'), { models: true, legacyDisplay: false, shield: true, flattened: true, hudSprites: true, itemDefinitions: true });
  // a snapshot the table doesn't know gets the newest rules
  assert.equal(r('99w01a').itemDefinitions, true);
});

test('what each edition and version supports', () => {
  for (const id of PVP_TWEAKS) assert.equal(tweakSupport(id, 'java', '26.3'), null, id);
  for (const id of PVP_TWEAKS) assert.equal(tweakSupport(id, 'java', '1.9.4'), null, id);
  assert.equal(tweakSupport('shield', 'java', '1.8.9'), 'noShield');
  assert.equal(tweakSupport('swords', 'java', '1.8.9'), null);
  assert.equal(tweakSupport('swords', 'java', '1.7.10'), 'noModels');
  assert.equal(tweakSupport('lowFire', 'java', '1.6.1'), null);
  assert.equal(tweakSupport('lowFire', 'bedrock', 'latest'), 'bedrockFire');
  assert.equal(tweakSupport('swords', 'bedrock', 'latest'), 'bedrockHeld');
  assert.equal(tweakSupport('shield', 'bedrock', 'latest'), 'bedrockHeld');
  assert.equal(tweakSupport('still', 'bedrock', 'latest'), 'bedrockAnimations');
  for (const id of ['clearGlass', 'noPumpkin', 'crosshair', 'lowRes'] as const) assert.equal(tweakSupport(id, 'bedrock', 'latest'), null, id);
});

test('file paths per version', () => {
  assert.equal(fireOverlayPath('1.8.9'), `${J}blocks/fire_layer_1.png`);
  assert.equal(fireOverlayPath('1.12.2'), `${J}blocks/fire_layer_1.png`);
  assert.equal(fireOverlayPath('1.13'), `${J}block/fire_1.png`);
  assert.equal(fireOverlayPath('26.3'), `${J}block/fire_1.png`);
  assert.equal(crosshairTarget('java', '1.8.9').path, `${J}gui/icons.png`);
  assert.equal(crosshairTarget('java', '1.20.1').path, `${J}gui/icons.png`);
  assert.equal(crosshairTarget('java', '1.20.2').path, `${J}gui/sprites/hud/crosshair.png`);
  assert.equal(crosshairTarget('bedrock', 'latest').path, 'textures/gui/icons.png');
  assert.equal(pumpkinPath('java'), `${J}misc/pumpkinblur.png`);
  assert.equal(pumpkinPath('bedrock'), 'textures/misc/pumpkinblur.png');
  const g189 = glassTextures('java', '1.8.9').map((g) => g.path);
  assert.equal(g189.length, 17);
  assert.ok(g189.includes(`${J}blocks/glass.png`) && g189.includes(`${J}blocks/glass_silver.png`) && g189.includes(`${J}blocks/glass_light_blue.png`));
  const g263 = glassTextures('java', '26.3').map((g) => g.path);
  assert.ok(g263.includes(`${J}block/glass.png`) && g263.includes(`${J}block/light_gray_stained_glass.png`));
  assert.ok(glassTextures('bedrock', 'latest').some((g) => g.path === 'textures/blocks/glass_silver.png'));
  assert.deepEqual(firstPersonSlots('1.8.9'), ['firstperson']);
  assert.deepEqual(firstPersonSlots('1.9.4'), ['firstperson_righthand', 'firstperson_lefthand']);
  const files = ['diamond_sword', 'iron_axe', 'mace', 'iron_spear', 'iron_spear_in_hand', 'stick', 'netherite_sword'].map((i) => `assets/minecraft/models/item/${i}.json`);
  assert.deepEqual(weaponItems(files, 'swords'), ['diamond_sword', 'netherite_sword']);
  assert.deepEqual(weaponItems(files, 'weapons'), ['diamond_sword', 'iron_axe', 'iron_spear', 'mace', 'netherite_sword']);
});

test('the guide’s example paths are the ones the tweaks write', () => {
  for (const ex of PVP_EXAMPLE_FILES) {
    const want = ex.files;
    const got: Record<string, string> = {
      lowFire: fireOverlayPath(ex.version),
      crosshair: crosshairTarget(ex.edition, ex.version).path,
      pumpkin: pumpkinPath(ex.edition),
      glass: glassTextures(ex.edition, ex.version)[0].path,
      ...(ex.edition === 'java' && javaPvpRules(ex.version).models ? { sword: `assets/minecraft/models/item/diamond_sword.json` } : {}),
      ...(ex.edition === 'java' && javaPvpRules(ex.version).shield ? { shield: `assets/minecraft/models/item/shield.json` } : {}),
    };
    for (const [k, v] of Object.entries(want)) {
      if (ex.edition === 'bedrock' && k === 'lowFire') continue;
      assert.equal(v, got[k], `${ex.label} ${k}`);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Pixels and models

const px = (img: ImageData, x: number, y: number) => Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));

test('low fire moves every frame down and keeps the strip', () => {
  const img = createImageData(16, 64);
  for (let i = 0; i < img.data.length; i += 4) img.data.set([200, 100, 20, 255], i);
  const out = lowFireImage(img, 'lower');
  assert.equal(out.width, 16);
  assert.equal(out.height, 64);
  for (let f = 0; f < 4; f++) {
    assert.equal(px(out, 3, f * 16 + 7)[3], 0, 'top half of each frame is clear');
    assert.equal(px(out, 3, f * 16 + 8)[3], 255, 'flames from the middle down');
  }
});

test('clear glass keeps the border ring and clears the inside', () => {
  const img = createImageData(32, 32);
  for (let i = 0; i < img.data.length; i += 4) img.data.set([150, 50, 50, 160], i);
  const clear = clearGlassImage(img, true, 'clear');
  assert.equal(px(clear, 0, 10)[3], 160);
  assert.equal(px(clear, 1, 10)[3], 160, 'a 32× texture keeps a 2-pixel border');
  assert.equal(px(clear, 2, 10)[3], 0);
  assert.equal(px(clear, 16, 16)[3], 0);
  assert.equal(px(clearGlassImage(img, true, 'tint'), 16, 16)[3], 48);
  assert.equal(px(clearGlassImage(img, false, 'tint'), 16, 16)[3], 0, 'plain glass has no tint to keep');
});

test('crosshair designs are centred and fill only the crosshair square of the sheet', () => {
  for (const d of CROSSHAIRS) {
    const p = crosshairPixels(d);
    assert.ok(p.length > 3, d);
    assert.ok(p.every(([x, y]) => x >= 0 && y >= 0 && x < 15 && y < 15), d);
    // symmetric around (7, 7)
    const set = new Set(p.map(([x, y]) => `${x},${y}`));
    assert.ok(p.every(([x, y]) => set.has(`${14 - x},${y}`) && set.has(`${x},${14 - y}`)), d);
  }
  const sheet = createImageData(512, 512);
  sheet.data.fill(255);
  const out = withCrosshair(sheet, 'sheet', 'dot');
  assert.deepEqual(crosshairCell(sheet, 'sheet'), { x: 0, y: 0, w: 32, h: 32, scale: 2 });
  assert.equal(px(out, 0, 0)[3], 0, 'old crosshair cleared');
  assert.deepEqual(px(out, 14, 14), [255, 255, 255, 255], 'centre pixel (7, 7) at 2×');
  assert.deepEqual(px(out, 40, 0), [255, 255, 255, 255], 'the rest of the sheet stays');
  const sprite = withCrosshair(createImageData(15, 15), 'sprite', 'cross');
  assert.equal(px(sprite, 7, 7)[3], 255);
  assert.equal(px(sprite, 7, 2)[3], 0);
});

test('held weapons get smaller and lower, the shield lower; limits of the version', () => {
  const t = { rotation: [0, -90, 25] as [number, number, number], translation: [1.13, 3.2, 1.13] as [number, number, number], scale: [0.68, 0.68, 0.68] as [number, number, number] };
  assert.deepEqual(smallerHeld(t, 'smaller', false), { rotation: [0, -90, 25], translation: [1.13, 1.8, 1.13], scale: [0.442, 0.442, 0.442] });
  assert.deepEqual(lowerShield({ rotation: [0, 180, 5], translation: [-10, 1.75, -10], scale: [1.25, 1.25, 1.25] }, 'lower').translation, [-10, -4.25, -10]);
  assert.equal(smallerHeld({ ...t, translation: [0, -23, 0] }, 'tiny', true).translation[1], -24, '1.8 clamps to 24 sixteenths');
});

test('first-person models of item definitions', () => {
  assert.deepEqual(firstPersonModels({ model: { type: 'minecraft:model', model: 'minecraft:item/diamond_sword' } }), ['minecraft:item/diamond_sword']);
  // a spear: the in-hand model is the fallback of a display-context select
  const spear = {
    model: { type: 'minecraft:select', property: 'minecraft:display_context', cases: [{ when: ['gui', 'ground', 'fixed', 'on_shelf'], model: { type: 'minecraft:model', model: 'minecraft:item/iron_spear' } }], fallback: { type: 'minecraft:model', model: 'minecraft:item/iron_spear_in_hand' } },
  };
  assert.deepEqual(firstPersonModels(spear), ['minecraft:item/iron_spear_in_hand']);
  // a shield: both looks the game's code draws, with the transforms of their base models
  const shield = { model: { type: 'minecraft:condition', property: 'minecraft:using_item', on_false: { type: 'minecraft:special', base: 'minecraft:item/shield', model: { type: 'minecraft:shield' } }, on_true: { type: 'minecraft:special', base: 'minecraft:item/shield_blocking', model: { type: 'minecraft:shield' } } } };
  assert.deepEqual(firstPersonModels(shield).sort(), ['minecraft:item/shield', 'minecraft:item/shield_blocking']);
  // "flat in the inventory" (model editor): first person shows the 3D model
  const flat = { model: { type: 'minecraft:select', property: 'minecraft:display_context', cases: [{ when: ['gui', 'ground', 'fixed'], model: { type: 'minecraft:model', model: 'minecraft:item/diamond_sword' } }], fallback: { type: 'minecraft:model', model: 'minecraft:item/diamond_sword_3d' } } };
  assert.deepEqual(firstPersonModels(flat), ['minecraft:item/diamond_sword_3d']);
});

test('fire block models point at the copy of the overlay texture', () => {
  // the particle keeps the original, which keeps it in the texture atlas before 1.13
  assert.deepEqual(fireModelUsingCopy({ parent: 'block/fire_n', textures: { particle: 'blocks/fire_layer_1', fire: 'blocks/fire_layer_1' } }), { parent: 'block/fire_n', textures: { particle: 'blocks/fire_layer_1', fire: 'blocks/fire_layer_1_world' } });
  assert.deepEqual(fireModelUsingCopy({ parent: 'minecraft:block/template_fire_floor', textures: { fire: 'minecraft:block/fire_1' } })!.textures, { fire: 'minecraft:block/fire_1_world' });
  assert.equal(fireModelUsingCopy({ textures: { fire: 'minecraft:block/fire_0' } }), null);
  assert.equal(fireModelUsingCopy({ textures: { fire: 'minecraft:block/soul_fire_1' } }), null);
});

test('FPS effects: 8× keeps cut-out edges and strips, no animations keeps one frame (Java only)', () => {
  const strip = createImageData(16, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) strip.data.set(x < 8 ? [10, 20, 30, 255] : [0, 0, 0, 0], (y * 16 + x) * 4);
  const ctx = { path: `${J}block/water_still.png`, category: 'block' as const, animated: true };
  const low = applyEffects(strip, [{ type: 'downscale', enabled: true, params: { size: '8' } }], ctx);
  assert.equal(low.width, 8);
  assert.equal(low.height, 16, 'two frames stay two frames');
  assert.deepEqual(px(low, 3, 12), [10, 20, 30, 255]);
  assert.equal(px(low, 5, 12)[3], 0, 'alpha stays 0 or 255');
  const still = applyEffects(strip, [{ type: 'stillFrames', enabled: true, params: {} }], ctx);
  assert.deepEqual([still.width, still.height], [16, 16]);
  assert.equal(applyEffects(strip, [{ type: 'stillFrames', enabled: true, params: {} }], { ...ctx, path: 'textures/blocks/water_still_grey.png' }), strip, 'Bedrock textures keep their frames');
  assert.equal(applyEffects(strip, [{ type: 'stillFrames', enabled: true, params: {} }], { ...ctx, path: `${J}items/compass.png`, category: 'item' }), strip, 'the game picks compass frames itself');
  assert.equal(withoutAnimation('{"animation":{"frametime":2}}'), null);
  assert.deepEqual(JSON.parse(withoutAnimation('{"animation":{},"texture":{"blur":true}}')!), { texture: { blur: true } });
});

test('image hash ignores the colour under clear pixels', () => {
  const a = createImageData(2, 1, new Uint8ClampedArray([1, 2, 3, 0, 9, 9, 9, 255]));
  const b = createImageData(2, 1, new Uint8ClampedArray([7, 7, 7, 0, 9, 9, 9, 255]));
  assert.equal(imageHash(a), imageHash(b));
  assert.notEqual(imageHash(a), imageHash(createImageData(2, 1, new Uint8ClampedArray([1, 2, 3, 0, 9, 9, 8, 255]))));
});

// ---------------------------------------------------------------------------------------------
// Switching tweaks in a pack (synthetic files)

function syntheticJava(): AssetIndex {
  const spec = javaSpec();
  const solid = (w: number, h: number, c: [number, number, number, number]) => {
    const img = createImageData(w, h);
    for (let i = 0; i < img.data.length; i += 4) img.data.set(c, i);
    return img;
  };
  spec[`${J}block/fire_1.png`] = solid(16, 64, [230, 120, 20, 255]);
  spec[`${J}block/fire_1.png.mcmeta`] = '{"animation":{}}';
  spec[`${J}block/red_stained_glass.png`] = solid(16, 16, [153, 51, 51, 163]);
  spec[`${J}misc/pumpkinblur.png`] = solid(32, 32, [0, 0, 0, 200]);
  spec[`${J}gui/sprites/hud/crosshair.png`] = solid(15, 15, [255, 255, 255, 255]);
  spec['assets/minecraft/models/block/fire_floor1.json'] = JSON.stringify({ parent: 'minecraft:block/template_fire_floor', textures: { fire: 'minecraft:block/fire_1' } });
  spec['assets/minecraft/models/block/template_fire_floor.json'] = JSON.stringify({ textures: { particle: '#fire' }, elements: [] });
  spec['assets/minecraft/models/item/generated.json'] = JSON.stringify({ parent: 'builtin/generated' });
  spec['assets/minecraft/models/item/handheld.json'] = JSON.stringify({ parent: 'item/generated', display: { firstperson_righthand: { rotation: [0, -90, 25], translation: [1.13, 3.2, 1.13], scale: [0.68, 0.68, 0.68] }, firstperson_lefthand: { rotation: [0, 90, -25], translation: [1.13, 3.2, 1.13], scale: [0.68, 0.68, 0.68] } } });
  spec['assets/minecraft/models/item/diamond_sword.json'] = JSON.stringify({ parent: 'minecraft:item/handheld', textures: { layer0: 'minecraft:item/diamond_sword' } });
  spec['assets/minecraft/items/diamond_sword.json'] = JSON.stringify({ model: { type: 'minecraft:model', model: 'minecraft:item/diamond_sword' } });
  spec['assets/minecraft/models/item/shield.json'] = JSON.stringify({ display: { firstperson_righthand: { rotation: [0, 180, 5], translation: [-10, 1.75, -10], scale: [1.25, 1.25, 1.25] } } });
  spec['assets/minecraft/models/item/shield_blocking.json'] = JSON.stringify({ display: { firstperson_righthand: { rotation: [0, 180, -5], translation: [-15, 3.25, -11], scale: [1.25, 1.25, 1.25] } } });
  spec['assets/minecraft/items/shield.json'] = JSON.stringify({ model: { type: 'minecraft:condition', property: 'minecraft:using_item', on_false: { type: 'minecraft:special', base: 'minecraft:item/shield', model: { type: 'minecraft:shield' } }, on_true: { type: 'minecraft:special', base: 'minecraft:item/shield_blocking', model: { type: 'minecraft:shield' } } } });
  return fakeAssets('java', '26.3', spec);
}

test('tweaks switch on and off through the store; files changed since are kept; undo', async () => {
  const assets = syntheticJava();
  const p = newTextureProject({ name: 'PvP', edition: 'java', version: '26.3' });
  const store = new TexStore(p, assets);
  const pvp = createPvpEngine(store);

  const res = await pvp.applyPreset(true);
  assert.deepEqual(res.tweaks.sort(), ['clearGlass', 'crosshair', 'lowFire', 'lowRes', 'noPumpkin', 'shield', 'still', 'swords']);
  for (const id of res.tweaks) assert.ok(pvp.isOn(id), id);
  await store.flush();
  assert.ok(p.overrides[`${J}block/fire_1.png`] && p.overrides[`${J}block/fire_1_world.png`]);
  assert.equal(await p.extraFiles[`${J}block/fire_1_world.png.mcmeta`].text(), '{"animation":{}}');
  assert.deepEqual(JSON.parse(await p.extraFiles['assets/minecraft/models/block/fire_floor1.json'].text()).textures, { fire: 'minecraft:block/fire_1_world' });
  const sword = JSON.parse(await p.extraFiles['assets/minecraft/models/item/diamond_sword.json'].text());
  assert.equal(sword.parent, 'minecraft:item/handheld', 'the sword keeps its parent (still a flat item)');
  assert.deepEqual(sword.display.firstperson_righthand.scale, [0.442, 0.442, 0.442]);
  assert.deepEqual(JSON.parse(await p.extraFiles['assets/minecraft/models/item/shield_blocking.json'].text()).display.firstperson_righthand.translation, [-15, 0.25, -11]);
  assert.deepEqual(p.effects.map((l) => [l.type, l.categories]), [['downscale', ['block']], ['stillFrames', ['block', 'item']]]);

  // export: the files are in the zip, the animation .mcmeta of still textures is gone
  const zip = await unzipBlob((await exportTexturePack(p, assets)).blob);
  assert.ok(zip[`${J}block/fire_1.png`] && zip[`${J}block/fire_1_world.png`] && zip[`${J}misc/pumpkinblur.png`] && zip[`${J}gui/sprites/hud/crosshair.png`]);
  assert.equal(json(zip['assets/minecraft/models/item/diamond_sword.json']).display.firstperson_lefthand.translation[1], 1.8);
  assert.equal(zip[`${J}block/water_still.png.mcmeta`], undefined, 'a still texture has no animation');
  assert.equal(zip[`${J}block/fire_1.png.mcmeta`], undefined);
  assert.equal(text(zip[`${J}block/glass.png.mcmeta`]) && JSON.parse(text(zip[`${J}block/glass.png.mcmeta`])!).texture.mipmap_strategy, 'mean', 'other .mcmeta sections stay');
  const water = await decodeImage(zip[`${J}block/water_still.png`]);
  assert.deepEqual([water.width, water.height], [8, 8], '8× and one frame');

  // options: a new crosshair replaces the old one
  const before = imageHash(await store.getFull(`${J}gui/sprites/hud/crosshair.png`));
  const ch = await pvp.set('crosshair', true, { design: 'circle' });
  assert.notEqual(imageHash(await store.getFull(`${J}gui/sprites/hud/crosshair.png`)), before);
  ch.undo();
  assert.equal(imageHash(await store.getFull(`${J}gui/sprites/hud/crosshair.png`)), before);
  assert.equal(pvp.options('crosshair').design, 'gap');

  // a texture painted after the tweak is kept when it goes off
  const glass = `${J}block/red_stained_glass.png`;
  const painted = createImageData(16, 16);
  painted.data.fill(255);
  store.setImage(glass, painted);
  const off = await pvp.set('clearGlass', false);
  assert.equal(off.change.kept, 1);
  assert.equal(imageHash(await store.getFull(glass)), imageHash(painted));
  assert.equal(p.overrides[`${J}block/glass.png`], undefined, 'untouched glass goes back to the game’s');

  // a sword edited in the model editor since: only the slots still as written go back
  const path = 'assets/minecraft/models/item/diamond_sword.json';
  const edited = JSON.parse(await p.extraFiles[path].text());
  edited.display.firstperson_lefthand.scale = [1, 1, 1];
  edited.elements = [];
  p.extraFiles[path] = new Blob([JSON.stringify(edited)]);
  await pvp.set('swords', false);
  const after = JSON.parse(await p.extraFiles[path].text());
  assert.equal(after.display.firstperson_righthand, undefined, 'the tweak’s slot is gone');
  assert.deepEqual(after.display.firstperson_lefthand.scale, [1, 1, 1], 'the edited slot stays');
  assert.deepEqual(after.elements, []);

  // everything else off: the pack is back to the game's files
  for (const id of PVP_TWEAKS) if (pvp.isOn(id)) await pvp.set(id, false);
  await store.flush();
  assert.deepEqual(Object.keys(p.overrides).sort(), [glass]);
  assert.deepEqual(Object.keys(p.extraFiles).sort(), [path]);
  assert.equal(p.effects.length, 0);
  assert.equal(p.pvp, undefined);
});

test('a model the model editor made keeps its shape when the sword tweak changes its pose', async () => {
  const assets = syntheticJava();
  const p = newTextureProject({ name: 'PvP', edition: 'java', version: '26.3' });
  const path = 'assets/minecraft/models/item/diamond_sword.json';
  const custom = { textures: { layer0: 'minecraft:item/diamond_sword' }, elements: [{ from: [7, 0, 7], to: [9, 16, 9], faces: { north: { texture: '#layer0' } } }], display: { gui: { rotation: [0, 0, 0], translation: [0, 0, 0], scale: [1, 1, 1] }, firstperson_righthand: { rotation: [0, -90, 25], translation: [1, 2, 3], scale: [1, 1, 1] } } };
  p.extraFiles[path] = new Blob([JSON.stringify(custom)]);
  p.customModels = { [path]: { kind: 'item', id: 'diamond_sword', model: 'minecraft:item/diamond_sword', saved: 'minecraft:item/diamond_sword', files: [path], originals: { [path]: null }, updatedAt: 1 } };
  const store = new TexStore(p, assets);
  const pvp = createPvpEngine(store);
  await pvp.set('swords', true);
  const out = JSON.parse(await p.extraFiles[path].text());
  assert.deepEqual(out.elements, custom.elements);
  assert.deepEqual(out.display.firstperson_righthand, { rotation: [0, -90, 25], translation: [1, 0.6, 3], scale: [0.65, 0.65, 0.65] });
  assert.deepEqual(out.display.gui, custom.display.gui);
  assert.ok(p.customModels?.[path], 'the model editor still knows its model');
  await pvp.set('swords', false);
  assert.deepEqual(JSON.parse(await p.extraFiles[path].text()), custom, 'switching off gives the model editor’s file back');
});

// ---------------------------------------------------------------------------------------------
// The real game files

function fixtures(): string | null {
  const d = process.env.TO_FIXTURES;
  return d && existsSync(join(d, 'research-cache', 'jars')) ? d : null;
}

function jarAssets(version: string, jar: string): AssetIndex {
  const names: string[] = [];
  const files = unzipSync(new Uint8Array(readFileSync(jar)), {
    filter: (f) => {
      if (f.name.endsWith('/')) return false;
      names.push(f.name);
      return /^assets\/minecraft\/(models|items|textures\/(block|blocks|item|items|misc|gui))\//.test(f.name) && !/\/gui\/(title|advancements|container)\//.test(f.name);
    },
  });
  const sorted = names.sort();
  const set = new Set(sorted);
  const read = async (p: string) => {
    const b = files[p];
    if (!b) throw new Error(`not loaded in the test fixture: ${p}`);
    return b;
  };
  return {
    edition: 'java',
    version,
    textures: buildJavaTextureList(sorted).filter((t) => files[t.path]),
    hasFile: (p) => set.has(p),
    listFiles: (prefix) => sorted.filter((p) => p.startsWith(prefix)),
    readFile: read,
    readText: async (p) => new TextDecoder().decode(await read(p)),
    readImage: async (p) => decodeImage(await read(p), 'png'),
  };
}

const FX = fixtures();
const VERSIONS = ['1.6.1', '1.7.10', '1.8.9', '1.9.4', '1.12.2', '1.13', '1.16.5', '1.20.1', '1.20.2', '1.21.3', '1.21.4', '1.21.11', '26.3'];
const jars = FX ? VERSIONS.map((v) => ({ v, jar: v === '26.3' && existsSync(join(FX, 'client-26.3.jar')) ? join(FX, 'client-26.3.jar') : join(FX, 'research-cache', 'jars', `${v}.jar`) })).filter((x) => existsSync(x.jar)) : [];

test('real jars are there', { skip: FX ? false : 'set TO_FIXTURES to a folder with research-cache/jars/<version>.jar' }, () => {
  assert.ok(jars.length >= 5, readdirSync(join(FX!, 'research-cache', 'jars')).join(', '));
});

for (const { v, jar } of jars) {
  test(`every tweak on Java ${v}: the files the game reads are written`, async () => {
    const assets = jarAssets(v, jar);
    const p = newTextureProject({ name: 'PvP', edition: 'java', version: v });
    const store = new TexStore(p, assets);
    const pvp = createPvpEngine(store);
    const rules = javaPvpRules(v);
    // the paths the tweaks name exist in this version
    assert.ok(assets.hasFile(fireOverlayPath(v)), fireOverlayPath(v));
    assert.ok(assets.hasFile(crosshairTarget('java', v).path), crosshairTarget('java', v).path);
    assert.ok(assets.hasFile(pumpkinPath('java')));
    const glass = glassTextures('java', v).filter((g) => assets.hasFile(g.path));
    assert.ok(glass.length === 17 || (v === '1.6.1' && glass.length === 1), `${glass.length} glass textures`);

    const res = await pvp.applyPreset(true);
    const want = PVP_TWEAKS.filter((id) => !tweakSupport(id, 'java', v));
    assert.deepEqual(res.tweaks.sort(), [...want].sort());
    await store.flush();
    const zip = await unzipBlob((await exportTexturePack(p, assets)).blob);

    // fire lower on screen; fire blocks keep a copy (1.8+)
    const fire = await decodeImage(zip[fireOverlayPath(v)]);
    assert.equal(fire.data[3], 0, 'top of the first frame is clear');
    if (rules.models) {
      const world = fireOverlayPath(v).replace('.png', '_world.png');
      assert.ok(zip[world] && zip[`${world}.mcmeta`] === undefined, 'the copy is in the pack, still (no animations)');
      const models = Object.keys(zip).filter((f) => /models\/block\/fire_/.test(f));
      assert.ok(models.length > 0, 'fire block models');
      for (const f of models) assert.ok(JSON.stringify(json(zip[f])).includes('_world'), f);
      // no fire model still draws the lowered texture, but the overlay texture stays in the atlas:
      // before 1.13 only textures that models name (the particle too) are loaded
      let named = false;
      for (const f of assets.listFiles('assets/minecraft/models/block/')) {
        if (!/\/fire_[a-z0-9_]*\.json$/.test(f)) continue;
        const own = (zip[f] ? json(zip[f]) : JSON.parse(await assets.readText(f))) as { textures?: Record<string, string> };
        for (const [k, t] of Object.entries(own.textures ?? {})) {
          if (!/fire(_layer)?_1$/.test(t)) continue;
          if (k === 'particle') named = true;
          else assert.fail(`${f} still draws ${t}`);
        }
      }
      if (!rules.flattened) assert.ok(named, 'a model still names the overlay texture (its particle)');
    }
    // glass: border kept, inside clear
    for (const g of glass) {
      const img = await decodeImage(zip[g.path]);
      assert.equal(img.data[((img.height >> 1) * img.width + (img.width >> 1)) * 4 + 3], 0, g.path);
    }
    // pumpkin view clear
    const pumpkin = await decodeImage(zip[pumpkinPath('java')]);
    assert.ok(pumpkin.data.every((x, i) => i % 4 !== 3 || x === 0));
    // crosshair: the design's centre pixel
    const ch = await decodeImage(zip[crosshairTarget('java', v).path]);
    assert.equal(ch.data[(7 * ch.width + 7) * 4 + 3], 255);
    // first-person transforms in the model files
    if (rules.models) {
      const slots = firstPersonSlots(v);
      const sword = json(zip['assets/minecraft/models/item/diamond_sword.json']);
      for (const s of slots) assert.ok(sword.display?.[s]?.scale?.[0] < (rules.legacyDisplay ? 1.7 : 0.68), `${s} ${JSON.stringify(sword.display)}`);
      // no other slot is set by the tweak (third person, inventory keep the game's)
      const vanilla = JSON.parse(await assets.readText('assets/minecraft/models/item/diamond_sword.json'));
      for (const k of Object.keys(sword.display)) if (!slots.includes(k)) assert.deepEqual(sword.display[k], vanilla.display[k], k);
      assert.equal(sword.parent, vanilla.parent);
    }
    if (rules.shield) {
      for (const m of ['shield', 'shield_blocking']) {
        const own = json(zip[`assets/minecraft/models/item/${m}.json`]);
        const vanilla = JSON.parse(await assets.readText(`assets/minecraft/models/item/${m}.json`));
        assert.equal(own.display.firstperson_righthand.translation[1], vanilla.display.firstperson_righthand.translation[1] - 3, m);
        assert.equal(own.parent, vanilla.parent);
        assert.deepEqual(own.overrides, vanilla.overrides, 'the blocking switch stays (before 1.21.4)');
      }
    }
    // 8× blocks, animations gone
    const stone = await decodeImage(zip[`${J}${rules.flattened ? 'block' : 'blocks'}/stone.png`]);
    assert.equal(stone.width, 8);
    const water = rules.flattened ? `${J}block/water_still.png` : `${J}blocks/water_still.png`;
    assert.ok(zip[water] && !zip[`${water}.mcmeta`]);

    // and all off again: nothing of the tweaks is left
    for (const id of PVP_TWEAKS) if (pvp.isOn(id)) await pvp.set(id, false);
    await store.flush();
    assert.deepEqual(Object.keys(p.overrides), []);
    assert.deepEqual(Object.keys(p.extraFiles), []);
    assert.equal(p.effects.length, 0);
  });
}

test('Bedrock: clear glass, no pumpkin blur, the crosshair in icons.png and 8× textures', async () => {
  const spec: Record<string, ImageData | string> = {
    'textures/blocks/glass.png': createImageData(16, 16, new Uint8ClampedArray(16 * 16 * 4).fill(255)),
    'textures/blocks/glass_silver.png': createImageData(16, 16, new Uint8ClampedArray(16 * 16 * 4).fill(200)),
    'textures/blocks/stone.png': createImageData(16, 16, new Uint8ClampedArray(16 * 16 * 4).fill(120)),
    'textures/misc/pumpkinblur.png': createImageData(256, 256, new Uint8ClampedArray(256 * 256 * 4).fill(90)),
    'textures/gui/icons.png': createImageData(256, 256, new Uint8ClampedArray(256 * 256 * 4).fill(255)),
  };
  const assets = fakeAssets('bedrock', 'latest', spec);
  const p = newTextureProject({ name: 'PvP', edition: 'bedrock', version: 'latest' });
  const store = new TexStore(p, assets);
  const pvp = createPvpEngine(store);
  const res = await pvp.applyPreset(true);
  assert.deepEqual(res.tweaks.sort(), ['clearGlass', 'crosshair', 'lowRes', 'noPumpkin']);
  await store.flush();
  const zip = await unzipBlob((await exportTexturePack(p, assets)).blob);
  assert.ok(zip['manifest.json']);
  const glass = await decodeImage(zip['textures/blocks/glass_silver.png']);
  assert.equal(glass.width, 8, '8× on Bedrock too');
  assert.equal(glass.data[(4 * 8 + 4) * 4 + 3], 0);
  assert.ok(zip['textures/misc/pumpkinblur.png']);
  const icons = await decodeImage(zip['textures/gui/icons.png']);
  assert.equal(icons.data[3], 0);
  assert.equal(icons.data[(7 * 256 + 7) * 4 + 3], 255);
  await assert.rejects(pvp.set('swords', true), /isn't available/);
});

test('the guide’s sword files are what the tweak writes', async () => {
  const latest = new TexStore(newTextureProject({ name: 'PvP', edition: 'java', version: '26.3' }), syntheticJava());
  await createPvpEngine(latest).set('swords', true);
  assert.equal(await latest.project.extraFiles['assets/minecraft/models/item/diamond_sword.json'].text(), PVP_SWORD_LATEST);
  // 1.8.9: the sword's own file has its hand poses
  const old = PVP_SWORD_189.replace('"translation": [0, 2.6, 2]', '"translation": [0, 4, 2]').replace(/1\.105/g, '1.7');
  const assets189 = fakeAssets('java', '1.8.9', { 'assets/minecraft/models/item/diamond_sword.json': old, [`${J}items/diamond_sword.png`]: createImageData(16, 16) });
  const s189 = new TexStore(newTextureProject({ name: 'PvP', edition: 'java', version: '1.8.9' }), assets189);
  await createPvpEngine(s189).set('swords', true);
  assert.equal(await s189.project.extraFiles['assets/minecraft/models/item/diamond_sword.json'].text(), PVP_SWORD_189);
});

test('undoing an older change leaves later changes to other tweaks alone', async () => {
  const assets = syntheticJava();
  const p = newTextureProject({ name: 'PvP', edition: 'java', version: '26.3' });
  const store = new TexStore(p, assets);
  const pvp = createPvpEngine(store);
  await pvp.applyPreset(false);
  const a = await pvp.set('swords', true, { size: 'tiny' });
  await pvp.set('noPumpkin', false);
  await pvp.set('lowRes', true);
  a.undo();
  assert.equal(pvp.options('swords').size, 'smaller');
  assert.equal(pvp.isOn('noPumpkin'), false, 'still off');
  assert.equal(p.overrides[`${J}misc/pumpkinblur.png`], undefined);
  assert.equal(pvp.isOn('lowRes'), true, 'the FPS layer added later stays');
});
