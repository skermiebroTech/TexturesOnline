/**
 * Model editor logic: editable models resolved from their parent chain (real jars from TO_FIXTURES when
 * present), editing, writing self-contained files that keep unknown keys, version rules and checks,
 * start points (3D item from a sprite with merged runs), where models go in a pack (item definitions,
 * blockstates), the project files with put-back, export checks, imported models round-tripping and the
 * Bedrock geometry export.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, zipSync, strToU8 } from 'fflate';
import { decodeImage } from '../../src/core/image';
import { existsSync, readFileSync } from 'node:fs';
import { loadModelLibrary, type ModelLibrary } from '../../src/shared/models/index';
import { bakeModel, modelPath } from '../../src/shared/models/java-models';
import {
  addElement,
  cloneModel,
  deleteElement,
  duplicateElement,
  emptyModel,
  modelFromJson,
  modelFromResolved,
  modelJson,
  modelText,
  moveElement,
  newElement,
  pruneTextures,
  reorderElement,
  setExtent,
  setFace,
  setPositionSize,
  textureVarFor,
  toResolved,
  type EditModel,
} from '../../src/tools/textures/models/doc';
import { allowedAngle, atlasDirsFrom, modelRules, validateModel, type ValidateContext } from '../../src/tools/textures/models/rules';
import { cross, fullCube, opaqueRects, slab, spriteElements, spriteTo3d } from '../../src/tools/textures/models/presets';
import { blockModelChoices, blockstateUsingEverywhere, planBlock, planFiles, planItem, randomSiblings, replaceLeaves } from '../../src/tools/textures/models/targets';
import { customModelWarnings, resetCustomModel, writeCustomModel } from '../../src/tools/textures/models/pack';
import { toBedrockGeometry } from '../../src/tools/textures/models/bedrock';
import { newTextureProject } from '../../src/tools/textures/project';
import { exportTexturePack } from '../../src/tools/textures/export';
import { importPack } from '../../src/tools/textures/import';
import { javaJarAssets, javaJarPath } from '../tools/models/fixtures';
import { fakeAssets, javaSpec, unzipBlob } from '../tools/texlogic/fixtures';

const SKIP = (v: string) => `Minecraft ${v} jar not found (set TO_FIXTURES)`;
const has = (v: string) => !!javaJarAssets(v);
const libs = new Map<string, Promise<ModelLibrary>>();
const lib = (v: string) => {
  let p = libs.get(v);
  if (!p) libs.set(v, (p = loadModelLibrary(javaJarAssets(v)!)));
  return p;
};
async function files(v: string) {
  const f = (await lib(v)).javaFiles();
  assert.ok(f);
  return f;
}
async function editable(v: string, id: string): Promise<EditModel> {
  const f = await files(v);
  return modelFromResolved(f.models.resolve(id), f.json(modelPath(id)));
}

/** RGBA image from rows of '#' (opaque) and '.' (clear). */
function sprite(rows: string[]) {
  const w = rows[0].length;
  const h = rows.length;
  const data = new Uint8ClampedArray(w * h * 4);
  rows.forEach((r, y) => [...r].forEach((c, x) => data.set(c === '.' ? [0, 0, 0, 0] : [200, 100, 50, 255], (y * w + x) * 4)));
  return { width: w, height: h, data };
}

const ctx = (version: string, extra: Partial<ValidateContext> = {}): ValidateContext => ({ rules: modelRules(version), hasTexture: () => true, ...extra });

// ------------------------------------------------------------------------------------------ resolution

test('26.3: a slab resolves through its parents with its textures, one cube and block display', { skip: !has('26.3') && SKIP('26.3') }, async () => {
  const m = await editable('26.3', 'minecraft:block/oak_slab');
  assert.equal(m.elements.length, 1);
  assert.deepEqual(m.elements[0].from, [0, 0, 0]);
  assert.deepEqual(m.elements[0].to, [16, 8, 16]);
  assert.equal(m.textures.side, 'minecraft:block/oak_planks');
  assert.equal(m.elements[0].faces.north?.texture, '#side');
  assert.equal(m.elements[0].faces.north?.cullface, 'north');
  assert.deepEqual(m.display.gui.rotation, [30, 225, 0]);
  assert.deepEqual(m.display.gui.scale, [0.625, 0.625, 0.625]);
  assert.equal(m.guiLight, 'side');
  // baked like the library bakes it
  const quads = bakeModel(toResolved(m));
  assert.equal(quads.length, 6);
  assert.ok(quads.every((q) => q.texture === 'assets/minecraft/textures/block/oak_planks.png'));
});

test('26.3: a sword is a flat item: no cubes, handheld display, front light', { skip: !has('26.3') && SKIP('26.3') }, async () => {
  const m = await editable('26.3', 'minecraft:item/diamond_sword');
  assert.equal(m.elements.length, 0);
  assert.equal(m.textures.layer0, 'minecraft:item/diamond_sword');
  assert.deepEqual(m.display.thirdperson_righthand.rotation, [0, -90, 55]);
  assert.deepEqual(m.display.ground.translation, [0, 2, 0]);
  assert.equal(m.guiLight, 'front');
});

test('1.8.9: models name the hands without left / right and textures live in blocks/', { skip: !has('1.8.9') && SKIP('1.8.9') }, async () => {
  const m = await editable('1.8.9', 'minecraft:item/stone_slab');
  assert.ok(m.elements.length >= 1);
  assert.ok('thirdperson' in m.display, Object.keys(m.display).join());
  assert.ok(Object.values(m.textures).some((t) => t.startsWith('blocks/')));
  assert.equal(modelRules('1.8.9').legacyDisplay, true);
});

// ------------------------------------------------------------------------------------------ writing

test('a written model is self-contained, keeps unknown keys and reads back the same', () => {
  const own = { parent: 'item/generated', credit: 'Made by me', overrides: [{ predicate: { pulling: 1 }, model: 'item/bow_pulling_0' }] };
  const m = modelFromJson({ ...own, textures: { layer0: 'item/bow' } });
  m.extra = { credit: 'Made by me', overrides: own.overrides };
  m.elements.push({ name: 'Grip', from: [7, 0, 7.5], to: [9, 10, 8.5], rotation: { origin: [8, 8, 8], axis: 'z', angle: 22.5, rescale: true }, faces: { north: { texture: '#layer0', uv: [7, 0, 9, 10], tintindex: 0 } }, extra: { light_emission: 4 } });
  m.display.gui = { rotation: [0, 0, 0], translation: [0, 0, 0], scale: [1, 1, 1] };
  m.display.head = { rotation: [0, 180, 0], translation: [0, 13, 7], scale: [1, 1, 1] };
  const json = modelJson(m);
  assert.ok(!('parent' in json), 'no parent');
  assert.equal(json.credit, 'Made by me');
  assert.deepEqual(json.overrides, own.overrides);
  assert.deepEqual(Object.keys(json.display as object), ['head'], 'a slot that does nothing is left out');
  const el = (json.elements as Record<string, unknown>[])[0];
  assert.equal(el.name, 'Grip');
  assert.equal(el.light_emission, 4);
  assert.deepEqual(el.rotation, { angle: 22.5, axis: 'z', origin: [8, 8, 8], rescale: true });
  const text = modelText(m);
  assert.match(text, /"from": \[7, 0, 7\.5\]/, 'number lists stay on one line');
  const back = modelFromJson(JSON.parse(text));
  assert.deepEqual(back.elements, m.elements);
  assert.deepEqual(back.textures, m.textures);
  assert.deepEqual(back.extra, m.extra);
  assert.deepEqual(back.display.head, m.display.head);
});

test('26.1 sprite objects keep force_translucent', () => {
  const m = modelFromJson({ textures: { glass: { sprite: 'block/glass', force_translucent: true } }, elements: [{ from: [0, 0, 0], to: [16, 16, 16], faces: { up: { texture: '#glass' } } }] });
  assert.deepEqual(m.translucent, ['glass']);
  assert.deepEqual((modelJson(m).textures as Record<string, unknown>).glass, { sprite: 'block/glass', force_translucent: true });
});

test('float dust is tidied', () => {
  const m = emptyModel();
  m.textures.all = 'block/stone';
  m.elements.push({ from: [0.1 + 0.2, 0, -0], to: [16, 16, 16], faces: { up: { texture: '#all' } } });
  assert.match(modelText(m), /"from": \[0\.3, 0, 0\]/);
});

// ------------------------------------------------------------------------------------------ editing

test('edits: add, duplicate, move, resize past the other side, reorder, delete', () => {
  const m = emptyModel();
  m.textures.all = 'minecraft:block/stone';
  const a = addElement(m, newElement(m));
  assert.equal(m.elements[a].faces.up?.texture, '#all');
  const b = duplicateElement(m, a);
  assert.equal(b, 1);
  moveElement(m, b, [2, 0, -1]);
  assert.deepEqual(m.elements[b].from, [8, 0, 5]);
  assert.deepEqual(m.elements[a].from, [6, 0, 6], 'the copy is its own');
  setExtent(m, b, 0, 'to', 4);
  assert.deepEqual([m.elements[b].from[0], m.elements[b].to[0]], [4, 8], 'dragging a face past the other swaps them');
  setPositionSize(m, b, [1, 2, 3], [4, 5, 6]);
  assert.deepEqual([m.elements[b].from, m.elements[b].to], [[1, 2, 3], [5, 7, 9]]);
  assert.equal(reorderElement(m, b, -1), 0);
  deleteElement(m, 0);
  assert.equal(m.elements.length, 1);
  assert.deepEqual(m.elements[0].from, [6, 0, 6]);
});

test('textures: a new texture gets its own variable, unused ones are dropped', () => {
  const m = emptyModel();
  m.textures = { all: 'minecraft:block/stone', particle: '#all', old: 'minecraft:block/dirt' };
  addElement(m, newElement(m));
  const v = textureVarFor(m, 'minecraft:block/custom/ruby_ore');
  assert.equal(v, '#ruby_ore');
  assert.equal(textureVarFor(m, 'minecraft:block/stone'), '#all', 'reuses a variable');
  setFace(m, 0, 'up', { texture: v, uv: [0, 0, 8, 8] });
  setFace(m, 0, 'up', { uv: undefined });
  assert.deepEqual(m.elements[0].faces.up, { texture: '#ruby_ore' });
  setFace(m, 0, 'down', null);
  assert.ok(!m.elements[0].faces.down);
  pruneTextures(m);
  assert.deepEqual(Object.keys(m.textures).sort(), ['all', 'particle', 'ruby_ore']);
});

// ------------------------------------------------------------------------------------------ rules

test('version rules', () => {
  assert.equal(modelRules('1.7.10').models, false);
  assert.equal(modelRules('1.8.9').models, true);
  assert.equal(modelRules('1.12.2').rotation, 'steps');
  assert.equal(modelRules('1.21.5').rotation, 'steps');
  assert.equal(modelRules('1.21.6').rotation, 'range');
  assert.equal(modelRules('1.21.10').rotation, 'range');
  assert.equal(modelRules('1.21.11').rotation, 'free');
  assert.equal(modelRules('26.3').rotation, 'free');
  assert.equal(modelRules('26.4-snapshot-1').rotation, 'free', 'unknown newer versions get the newest rules');
  assert.equal(modelRules('1.21.3').itemDefinitions, false);
  assert.equal(modelRules('1.21.4').itemDefinitions, true);
  assert.equal(modelRules('1.14.4').guiLight, false);
  assert.equal(modelRules('1.15.2').guiLight, true);
  assert.equal(allowedAngle(modelRules('1.20.1'), 30), 22.5);
  assert.equal(allowedAngle(modelRules('1.21.8'), 60), 45);
  assert.equal(allowedAngle(modelRules('26.3'), 60), 60);
});

test('checks: bounds, rotation per version, faces, textures and atlases', () => {
  const m = emptyModel();
  m.textures = { all: 'minecraft:block/stone', gem: 'minecraft:item/diamond' };
  m.elements.push({ from: [0, 0, 0], to: [16, 33, 16], faces: { up: { texture: '#all' } } });
  m.elements.push({ from: [0, 0, 0], to: [1, 1, 1], rotation: { origin: [8, 8, 8], axis: 'y', angle: 30 }, faces: { up: { texture: '#nope' } } });
  m.elements.push({ from: [0, 0, 0], to: [1, 1, 1], rotation: { origin: [8, 8, 8], x: 10, y: 0, z: 0 }, faces: {} });
  m.elements.push({ from: [0, 0, 0], to: [1, 1, 1], faces: { up: { texture: '#gem' } } });
  const old = validateModel(m, ctx('1.20.1'));
  const msgs = old.map((i) => `${i.level}:${i.element ?? '-'}:${i.message}`).join('\n');
  assert.match(msgs, /error:0:.*-16 to 32/);
  assert.match(msgs, /error:1:.*only allows -45, -22\.5, 0, 22\.5 or 45/);
  assert.match(msgs, /error:2:.*1\.21\.11/);
  assert.match(msgs, /error:2:.*no faces/);
  assert.match(msgs, /error:-:.*#nope/);
  const mid = validateModel(m, ctx('1.21.8'));
  assert.ok(!mid.some((i) => i.element === 1 && /turned/.test(i.message)), '30° is fine from 1.21.6');
  const now = validateModel(m, ctx('26.3', { atlasDirs: ['block/'], hasTexture: (p) => !p.includes('diamond') }));
  assert.ok(!now.some((i) => i.element === 2 && /1\.21\.11/.test(i.message)));
  assert.ok(now.some((i) => i.level === 'warning' && /minecraft:item\/diamond.*isn't in the game/.test(i.message)));
  const atlas = validateModel(m, ctx('26.3', { atlasDirs: ['block/'] }));
  assert.ok(atlas.some((i) => /isn't in a folder the game uses/.test(i.message)));
  assert.deepEqual(validateModel(emptyModel(), ctx('26.3')).map((i) => i.level), ['warning']);
});

test('atlas folders from the atlas files', () => {
  assert.deepEqual(atlasDirsFrom([{ sources: [{ type: 'minecraft:directory', source: 'block', prefix: 'block/' }, { type: 'single', resource: 'minecraft:entity/bell/bell_body' }] }]), ['block/', 'entity/bell/bell_body']);
  assert.equal(atlasDirsFrom([null]), null);
});

// ------------------------------------------------------------------------------------------ presets

test('start points: full cube, slab, cross', () => {
  const m = emptyModel();
  m.textures = { top: 'block/a', bottom: 'block/b', side: 'block/c', particle: '#side' };
  const c = fullCube(m);
  assert.equal(c.elements.length, 1);
  assert.equal(c.elements[0].faces.up?.texture, '#top');
  assert.equal(c.elements[0].faces.down?.texture, '#bottom');
  assert.equal(c.elements[0].faces.east?.texture, '#side');
  assert.equal(c.elements[0].faces.east?.cullface, 'east');
  const s = slab(m);
  assert.deepEqual(s.elements[0].to, [16, 8, 16]);
  assert.equal(s.elements[0].faces.up?.cullface, undefined, 'the slab top is inside the block');
  const x = cross(m);
  assert.equal(x.elements.length, 2);
  assert.equal(x.elements[0].rotation?.angle, 45);
  assert.equal(x.ambientOcclusion, false);
  assert.deepEqual(validateModel(x, ctx('1.12.2')), []);
});

test('sprite to 3D: runs merge into rectangles that cover every opaque pixel once', () => {
  const img = sprite([
    '........',
    '.####...',
    '.####...',
    '.##.##..',
    '......#.',
    '......#.',
    '........',
    '........',
  ]);
  const rects = opaqueRects(img);
  const cover = new Map<string, number>();
  for (const r of rects) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) cover.set(`${x},${y}`, (cover.get(`${x},${y}`) ?? 0) + 1);
  let opaque = 0;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (img.data[(y * 8 + x) * 4 + 3]) opaque++;
  assert.equal(cover.size, opaque);
  assert.ok([...cover.values()].every((n) => n === 1));
  assert.equal(rects.length, 4, JSON.stringify(rects));
  const els = spriteElements({ texture: '#layer0', image: img, tintindex: 0 });
  assert.equal(els.length, 4);
  // the 4x2 block: 8 / 16 units per pixel, from z 7.5 to 8.5
  const big = els[0];
  assert.deepEqual(big.from, [2, 10, 7.5]);
  assert.deepEqual(big.to, [10, 14, 8.5]);
  assert.deepEqual(big.faces.south?.uv, [2, 2, 10, 6]);
  assert.deepEqual(big.faces.north?.uv, [10, 2, 2, 6]);
  assert.ok(big.faces.up && big.faces.west && big.faces.east, 'open edges have faces');
  assert.ok(big.faces.down, 'its bottom edge is only partly covered by the row below');
  const below = els.find((e) => e.from[0] === 2 && e.to[0] === 6)!;
  assert.ok(below && !below.faces.up, 'a face fully covered by its neighbour is left out');
  assert.equal(big.faces.south?.tintindex, 0);
  const full = spriteElements({ texture: '#layer0', image: sprite(Array(16).fill('#'.repeat(16))) });
  assert.equal(full.length, 1);
  assert.deepEqual(Object.keys(full[0].faces).sort(), ['down', 'east', 'north', 'south', 'up', 'west']);
});

test('sprite to 3D of the real diamond sword stays small and valid on every version', { skip: !javaJarPath('26.3') && SKIP('26.3') }, async () => {
  const jar = unzipSync(new Uint8Array(readFileSync(javaJarPath('26.3')!)), { filter: (f) => f.name === 'assets/minecraft/textures/item/diamond_sword.png' });
  const img = await decodeImage(jar['assets/minecraft/textures/item/diamond_sword.png']);
  let opaque = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i]) opaque++;
  const base = await editable('26.3', 'minecraft:item/diamond_sword');
  const m = spriteTo3d(base, [{ texture: '#layer0', image: img, tintindex: 0 }]);
  assert.ok(m.elements.length > 5 && m.elements.length < opaque / 2, `${m.elements.length} cubes for ${opaque} pixels`);
  assert.deepEqual(m.display, base.display, 'held like the flat sword');
  for (const v of ['1.12.2', '1.20.1', '26.3']) assert.deepEqual(validateModel(m, ctx(v)).filter((i) => i.level === 'error'), [], v);
  const back = modelFromJson(JSON.parse(modelText(m)));
  assert.equal(back.elements.length, m.elements.length);
});

// ------------------------------------------------------------------------------------------ targets

test('26.3 items: in place, block items and special items get an item definition, flat in the inventory', { skip: !has('26.3') && SKIP('26.3') }, async () => {
  const { json } = await files('26.3');
  const rules = modelRules('26.3');
  const sword = planItem({ itemId: 'diamond_sword', rules, json });
  assert.equal(sword.target, 'minecraft:item/diamond_sword');
  assert.equal(sword.definition, null);
  const grass = planItem({ itemId: 'grass_block', rules, json });
  assert.equal(grass.source, 'minecraft:block/grass_block');
  assert.equal(grass.target, 'minecraft:item/grass_block');
  const gm = grass.definition!.model as Record<string, unknown>;
  assert.equal(gm.model, 'minecraft:item/grass_block');
  assert.ok(Array.isArray(gm.tints), 'the grass tint is kept');
  const chest = planItem({ itemId: 'chest', rules, json });
  assert.equal(chest.replacesSpecial, true);
  assert.equal(chest.target, 'minecraft:item/chest');
  assert.ok(!JSON.stringify(chest.definition).includes('minecraft:special'), JSON.stringify(chest.definition));
  const flat = planItem({ itemId: 'diamond_sword', rules, json, flatGui: true });
  assert.equal(flat.target, 'minecraft:item/diamond_sword_3d');
  const fm = flat.definition!.model as Record<string, unknown>;
  assert.equal(fm.type, 'minecraft:select');
  assert.equal(fm.property, 'minecraft:display_context');
  assert.deepEqual((fm.cases as { when: string[] }[])[0].when, ['gui', 'ground', 'fixed']);
  assert.deepEqual(fm.fallback, { type: 'minecraft:model', model: 'minecraft:item/diamond_sword_3d' });
  const bow = planItem({ itemId: 'bow', rules, json, option: 1 });
  assert.ok(/bow_pulling_0$/.test(bow.target), bow.target);
  const out = planFiles(flat, '{}');
  assert.deepEqual(Object.keys(out).sort(), ['assets/minecraft/items/diamond_sword.json', 'assets/minecraft/models/item/diamond_sword_3d.json']);
  assert.ok(JSON.parse(out['assets/minecraft/items/diamond_sword.json']).model);
});

test('1.12.2 items: the model file or one of its overrides, never an item definition', { skip: !has('1.12.2') && SKIP('1.12.2') }, async () => {
  const { json } = await files('1.12.2');
  const rules = modelRules('1.12.2');
  const bow = planItem({ itemId: 'bow', rules, json, option: 2 });
  assert.equal(bow.definition, null);
  assert.equal(bow.target, 'minecraft:item/bow_pulling_1');
  const m = await editable('1.12.2', 'minecraft:item/bow');
  assert.ok(Array.isArray(m.extra.overrides), 'the bow keeps its overrides when written');
});

test('blocks: the models a block uses, random variants and the blockstate that puts the shape on all of them', { skip: !has('26.3') && SKIP('26.3') }, async () => {
  const { json } = await files('26.3');
  const slabs = blockModelChoices(json('assets/minecraft/blockstates/oak_slab.json'));
  assert.equal(slabs[0].model, 'minecraft:block/oak_slab');
  assert.deepEqual(slabs.map((c) => c.model).sort(), ['minecraft:block/oak_planks', 'minecraft:block/oak_slab', 'minecraft:block/oak_slab_top']);
  assert.match(slabs[0].label, /Bottom/);
  const stone = json('assets/minecraft/blockstates/stone.json');
  assert.deepEqual(randomSiblings(stone, 'minecraft:block/stone'), ['minecraft:block/stone_mirrored']);
  const bs = blockstateUsingEverywhere(stone, 'minecraft:block/stone')!;
  assert.ok(!JSON.stringify(bs).includes('mirrored'));
  assert.equal(blockstateUsingEverywhere(json('assets/minecraft/blockstates/oak_slab.json'), 'minecraft:block/oak_slab'), null, 'nothing random: no blockstate');
  const plan = planBlock({ blockId: 'stone', model: 'minecraft:block/stone', json, everyVariant: true });
  assert.ok(plan.blockstate);
  assert.equal(planBlock({ blockId: 'stone', model: 'minecraft:block/stone', json }).blockstate, null);
});

test('1.8.9 blockstates keep naming models without the block/ folder', { skip: !has('1.8.9') && SKIP('1.8.9') }, async () => {
  const { json } = await files('1.8.9');
  const bs = blockstateUsingEverywhere(json('assets/minecraft/blockstates/stone.json'), 'minecraft:block/stone');
  assert.ok(bs);
  const text = JSON.stringify(bs);
  assert.ok(text.includes('"model":"stone"') && !text.includes('stone_mirrored') && !text.includes('block/'), text.slice(0, 300));
});

test('item definition leaves: special and model leaves are swapped, the rest kept', () => {
  const def = { type: 'minecraft:condition', property: 'minecraft:using_item', on_false: { type: 'minecraft:model', model: 'minecraft:item/x' }, on_true: { type: 'minecraft:special', model: { type: 'minecraft:shield' }, base: 'minecraft:item/shield' } };
  const r = replaceLeaves(def, { kind: 'special' }, 'minecraft:item/shield');
  assert.equal(r.replaced, 1);
  assert.deepEqual((r.node as Record<string, unknown>).on_true, { type: 'minecraft:model', model: 'minecraft:item/shield' });
  assert.deepEqual((r.node as Record<string, unknown>).on_false, def.on_false);
});

// ------------------------------------------------------------------------------------------ project files

test('project: model files go to extraFiles, the pack\'s own copies come back on reset', async () => {
  const p = newTextureProject({ name: 'M', edition: 'java', version: '26.3' });
  const own = new Blob(['{"parent":"item/handheld","textures":{"layer0":"item/stick"}}']);
  p.extraFiles['assets/minecraft/models/item/diamond_sword.json'] = own;
  const info = { kind: 'item' as const, id: 'diamond_sword', model: 'minecraft:item/diamond_sword', saved: 'minecraft:item/diamond_sword' };
  writeCustomModel(p, info, { 'assets/minecraft/models/item/diamond_sword.json': '{"elements":[]}' });
  assert.equal(await p.extraFiles['assets/minecraft/models/item/diamond_sword.json'].text(), '{"elements":[]}');
  // moved to _3d with an item definition: the in-place file gets the pack's own copy back
  writeCustomModel(p, { ...info, saved: 'minecraft:item/diamond_sword_3d', flatGui: true }, { 'assets/minecraft/models/item/diamond_sword_3d.json': '{"elements":[]}', 'assets/minecraft/items/diamond_sword.json': '{"model":{}}' });
  assert.equal(p.extraFiles['assets/minecraft/models/item/diamond_sword.json'], own);
  assert.ok(p.extraFiles['assets/minecraft/items/diamond_sword.json']);
  assert.deepEqual(p.customModels!['assets/minecraft/models/item/diamond_sword.json'].files.sort(), ['assets/minecraft/items/diamond_sword.json', 'assets/minecraft/models/item/diamond_sword_3d.json']);
  assert.ok(resetCustomModel(p, 'minecraft:item/diamond_sword'));
  assert.equal(p.extraFiles['assets/minecraft/models/item/diamond_sword.json'], own);
  assert.ok(!p.extraFiles['assets/minecraft/items/diamond_sword.json']);
  assert.ok(!p.extraFiles['assets/minecraft/models/item/diamond_sword_3d.json']);
  assert.equal(p.customModels, undefined);
});

test('export: model files are written as they are, problems become warnings, textures unchanged', async () => {
  const assets = fakeAssets('java', '1.20.1', javaSpec());
  const p = newTextureProject({ name: 'Shapes', edition: 'java', version: '1.20.1' });
  const m = emptyModel();
  m.textures = { all: 'minecraft:block/stone' };
  m.elements.push({ from: [0, 0, 0], to: [16, 8, 16], rotation: { origin: [8, 8, 8], axis: 'y', angle: 30 }, faces: { up: { texture: '#all' } } });
  const text = modelText(m);
  writeCustomModel(p, { kind: 'block', id: 'stone', model: 'minecraft:block/stone', saved: 'minecraft:block/stone' }, { 'assets/minecraft/models/block/stone.json': text });
  const res = await exportTexturePack(p, assets);
  const zip = await unzipBlob(res.blob);
  assert.equal(new TextDecoder().decode(zip['assets/minecraft/models/block/stone.json']), text);
  assert.ok(res.warnings.some((w) => /block\/stone.*-45, -22\.5/.test(w)), res.warnings.join('\n'));
  assert.ok(!Object.keys(zip).some((k) => k.endsWith('.png') && k !== 'pack.png'), 'no textures added');
});

test('import: a pack\'s models load into the editor and every file round-trips unchanged', { skip: !has('26.3') && SKIP('26.3') }, async () => {
  const model = '{\n  "parent": "block/cube_all",\n  "textures": {"all": "block/dirt"},\n  "elements": [{"from": [0,0,0], "to": [16,4,16], "faces": {"up": {"texture": "#all"}}, "__comment": "keep me"}]\n}';
  const files = {
    'pack.mcmeta': strToU8(JSON.stringify({ pack: { pack_format: 97, description: 'x' } })),
    'assets/minecraft/models/block/stone.json': strToU8(model),
    'assets/minecraft/optifine/cit/odd.properties': strToU8('type=item\n'),
    'assets/minecraft/models/item/odd.json': strToU8('{ not json'),
  };
  const zip = zipSync(files);
  const { project } = await importPack(new File([zip], 'shapes.zip'));
  for (const [path, bytes] of Object.entries(files)) {
    if (path === 'pack.mcmeta') continue;
    assert.deepEqual(new Uint8Array(await project.extraFiles[path].arrayBuffer()), bytes, path);
  }
  // the library reads the pack's model over the game's
  const l = await loadModelLibrary(javaJarAssets('26.3')!);
  const parsed = new Map<string, unknown>([['assets/minecraft/models/block/stone.json', JSON.parse(model)]]);
  l.setPackFiles((path) => parsed.get(path));
  try {
    const v = l.resolve(l.block('stone')!);
    const ys = v.quads.flatMap((q) => q.positions.map((pos) => pos[1]));
    assert.equal(Math.max(...ys), 0.25, 'the pack\'s 4-pixel-high shape');
    const f = l.javaFiles()!;
    const m = modelFromResolved(f.models.resolve('minecraft:block/stone'), f.json('assets/minecraft/models/block/stone.json'));
    assert.equal(m.elements.length, 1);
    assert.deepEqual(m.elements[0].extra, { __comment: 'keep me' });
    assert.equal(m.textures.all, 'block/dirt');
  } finally {
    l.setPackFiles(null);
  }
  const back = l.resolve(l.block('stone')!);
  assert.equal(Math.max(...back.quads.flatMap((q) => q.positions.map((pos) => pos[1]))), 1, 'back to the game\'s cube');
  // writing it back keeps the extra key
  const f = l.javaFiles()!;
  assert.ok(f);
  const again = modelFromJson(JSON.parse(model));
  assert.equal((modelJson(again).elements as Record<string, unknown>[])[0].__comment, 'keep me');
});

test('pack warnings name the model and its first problem', async () => {
  const p = newTextureProject({ name: 'W', edition: 'java', version: '26.3' });
  const m = emptyModel();
  m.elements.push({ from: [0, 0, 0], to: [40, 1, 1], faces: { up: { texture: '#x' } } });
  writeCustomModel(p, { kind: 'block', id: 'stone', model: 'minecraft:block/stone', saved: 'minecraft:block/stone' }, { 'assets/minecraft/models/block/stone.json': modelText(m) });
  const w = await customModelWarnings(p, async (path) => (p.extraFiles[path] ? await p.extraFiles[path].text() : null), () => true);
  assert.equal(w.length, 1);
  assert.match(w[0], /^Model block\/stone: Cube 1 reaches outside .* \(1 more problem/);
});

// ------------------------------------------------------------------------------------------ bedrock

test('Bedrock geometry: centred, mirrored x, per-face UVs', () => {
  const m = emptyModel();
  m.textures.all = 'block/stone';
  m.elements.push({ from: [0, 0, 0], to: [4, 2, 16], rotation: { origin: [8, 8, 8], axis: 'y', angle: 22.5 }, faces: { north: { texture: '#all', uv: [0, 0, 4, 2] }, up: { texture: '#all' } } });
  const g = toBedrockGeometry(m, 'My Thing');
  const geo = (g['minecraft:geometry'] as Record<string, unknown>[])[0] as { description: { identifier: string }; bones: { cubes: Record<string, unknown>[] }[] };
  assert.equal(geo.description.identifier, 'geometry.my_thing');
  const c = geo.bones[0].cubes[0];
  assert.deepEqual(c.origin, [4, 0, -8]);
  assert.deepEqual(c.size, [4, 2, 16]);
  assert.deepEqual(c.pivot, [0, 8, 0]);
  assert.deepEqual(c.rotation, [0, -22.5, 0]);
  assert.deepEqual((c.uv as Record<string, unknown>).north, { uv: [0, 0], uv_size: [4, 2] });
  assert.deepEqual((c.uv as Record<string, unknown>).up, { uv: [4, 16], uv_size: [-4, -16] });
});

test('cloned models are independent', () => {
  const m = emptyModel();
  m.elements.push(newElement(m));
  const c = cloneModel(m);
  c.elements[0].from[0] = 1;
  assert.equal(m.elements[0].from[0], 6);
  assert.ok(existsSync || true);
});
