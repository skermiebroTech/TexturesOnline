import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compatRange,
  defaultMergeVersion,
  editionOf,
  mergeConcat,
  mergeDescription,
  mergeFlipbooks,
  mergeKeyed,
  mergeLangText,
  mergePacks,
  unionArrays,
} from '../../src/tools/merge/merge';
import type { JavaRenames } from '../../src/tools/convert/paths';
import { exportTexturePack } from '../../src/tools/textures/export';
import { newTextureProject } from '../../src/tools/textures/project';
import { encodePng } from '../../src/core/image';
import type { TexturePackProject } from '../../src/core/types';
import { fakeAssets, solid, unzipBlob } from '../tools/texlogic/fixtures';

const J = 'assets/minecraft/textures/';
const png = (c: [number, number, number, number], w = 16, h = 16) => new Blob([encodePng(solid(w, h, c))], { type: 'image/png' });
const RED = png([200, 0, 0, 255]);
const BLUE = png([0, 0, 200, 255]);
const GREEN = png([0, 200, 0, 255]);
const text = (s: string) => new Blob([s], { type: 'text/plain' });
const jsonBlob = (v: unknown) => new Blob([JSON.stringify(v)], { type: 'application/json' });
const read = async (b: Blob | undefined) => (b ? new Uint8Array(await b.arrayBuffer()) : undefined);
const readJson = async (b: Blob | undefined) => (b ? JSON.parse(await b.text()) : undefined);
const same = async (a: Blob | undefined, b: Blob) => {
  const x = await read(a);
  const y = await read(b);
  return !!x && !!y && x.length === y.length && x.every((v, i) => v === y[i]);
};

function java(name: string, version: string, overrides: Record<string, Blob>, extra: Record<string, Blob> = {}): TexturePackProject {
  const p = newTextureProject({ name, edition: 'java', version });
  p.overrides = overrides;
  p.extraFiles = extra;
  return p;
}
function bedrock(name: string, overrides: Record<string, Blob>, extra: Record<string, Blob> = {}): TexturePackProject {
  const p = newTextureProject({ name, edition: 'bedrock', version: 'latest' });
  p.overrides = overrides;
  p.extraFiles = extra;
  return p;
}

const RENAMES: JavaRenames = {
  format: 1,
  steps: [
    { version: '1.13', renames: { 'blocks/stone': 'block/stone', 'blocks/dirt': 'block/dirt', 'blocks/sea_lantern': 'block/sea_lantern', 'blocks/split': ['block/split_a', 'block/split_b'] }, removed: ['blocks/gone'] },
  ],
};

// ---------------------------------------------------------------------------------------------
// Priority

test('the top pack wins every file both packs have; the rest comes from the pack that has it', async () => {
  const top = java('Top', '26.3', { [`${J}block/stone.png`]: RED, [`${J}block/sand.png`]: GREEN });
  const bottom = java('Bottom', '26.3', { [`${J}block/stone.png`]: BLUE, [`${J}block/dirt.png`]: BLUE }, { 'assets/minecraft/models/block/stone.json': text('{"parent":"block/cube_all"}') });
  const { project, report } = await mergePacks([top, bottom]);
  assert.equal(project.edition, 'java');
  assert.equal(project.version, '26.3');
  assert.equal(project.name, 'Merged Pack');
  assert.equal(project.description, 'Merged from Top and Bottom');
  assert.ok(await same(project.overrides[`${J}block/stone.png`], RED), 'stone from the top pack');
  assert.ok(await same(project.overrides[`${J}block/dirt.png`], BLUE), 'dirt from the bottom pack');
  assert.ok(project.overrides[`${J}block/sand.png`]);
  assert.ok(project.extraFiles['assets/minecraft/models/block/stone.json'], 'non-texture files carried over');
  assert.deepEqual(report.conflicts, [{ path: `${J}block/stone.png`, winner: 0, losers: [1] }]);
  assert.equal(report.packs[0].kept, 2);
  assert.equal(report.packs[1].kept, 2);
  assert.equal(report.packs[1].overridden, 1);
  assert.equal(report.files, 4);
  assert.equal(report.textures, 3);

  // Reversed order: the other pack wins.
  const again = await mergePacks([bottom, top], { name: '  My mix ' });
  assert.ok(await same(again.project.overrides[`${J}block/stone.png`], BLUE));
  assert.equal(again.project.name, 'My mix');
});

test('three packs: the highest one that has a file wins, and each lower copy is listed', async () => {
  const a = java('A', '26.3', { [`${J}block/stone.png`]: RED });
  const b = java('B', '26.3', { [`${J}block/stone.png`]: GREEN, [`${J}block/dirt.png`]: GREEN });
  const c = java('C', '26.3', { [`${J}block/stone.png`]: BLUE, [`${J}block/dirt.png`]: BLUE });
  const { project, report } = await mergePacks([a, b, c]);
  assert.ok(await same(project.overrides[`${J}block/stone.png`], RED));
  assert.ok(await same(project.overrides[`${J}block/dirt.png`], GREEN));
  assert.deepEqual(report.conflicts.find((x) => x.path.endsWith('dirt.png')), { path: `${J}block/dirt.png`, winner: 1, losers: [2] });
  assert.deepEqual(report.conflicts.find((x) => x.path.endsWith('stone.png'))?.losers, [1, 2]);
  assert.equal(report.packs[2].kept, 0);
  assert.equal(report.packs[2].overridden, 2);
});

test('needs two to eight packs of one edition', async () => {
  const j = java('J', '26.3', {});
  const b = bedrock('B', {});
  await assert.rejects(() => mergePacks([j]), /at least two/);
  await assert.rejects(() => mergePacks(Array.from({ length: 9 }, () => j)), /Up to 8/);
  await assert.rejects(() => mergePacks([j, b]), /Java and Bedrock/);
  assert.deepEqual(editionOf([j, b, j]), { edition: null, java: [0, 2], bedrock: [1] });
  assert.equal(editionOf([b, b]).edition, 'bedrock');
});

test('pack icon from the top pack with one, another pack, or generated', async () => {
  const iconA = png([1, 2, 3, 255], 64, 64);
  const iconB = png([4, 5, 6, 255], 64, 64);
  const a = java('A', '26.3', {});
  const b = java('B', '26.3', {});
  b.icon = iconB;
  assert.equal((await mergePacks([a, b])).project.icon, iconB, 'the top pack has none, so the next one’s');
  a.icon = iconA;
  assert.equal((await mergePacks([a, b])).project.icon, iconA);
  assert.equal((await mergePacks([a, b], { iconFrom: 1 })).project.icon, iconB);
  assert.equal((await mergePacks([a, b], { iconFrom: null })).project.icon, undefined);
});

// ---------------------------------------------------------------------------------------------
// Textures and their .mcmeta

test('a texture keeps the .mcmeta of the pack it comes from, never another pack’s', async () => {
  const anim = (t: number) => jsonBlob({ animation: { frametime: t } });
  const top = java('Top', '26.3', { [`${J}block/sea_lantern.png`]: RED, [`${J}block/magma.png`]: RED }, { [`${J}block/magma.png.mcmeta`]: anim(2), [`${J}block/water_still.png.mcmeta`]: anim(9), [`${J}block/fire_0.png.mcmeta`]: anim(7) });
  const bottom = java(
    'Bottom',
    '26.3',
    { [`${J}block/sea_lantern.png`]: png([0, 0, 1, 255], 16, 80), [`${J}block/magma.png`]: BLUE, [`${J}block/fire_0.png`]: png([0, 0, 2, 255], 16, 64) },
    { [`${J}block/sea_lantern.png.mcmeta`]: anim(5), [`${J}block/magma.png.mcmeta`]: anim(3), [`${J}block/fire_0.png.mcmeta`]: anim(4) },
  );
  const { project, report } = await mergePacks([top, bottom]);
  // The top sea lantern is a still image: the bottom pack's animation must not be applied to it.
  assert.ok(await same(project.overrides[`${J}block/sea_lantern.png`], RED));
  assert.equal(project.extraFiles[`${J}block/sea_lantern.png.mcmeta`], undefined);
  // Both have an animated magma: the top's image with the top's .mcmeta.
  assert.equal((await readJson(project.extraFiles[`${J}block/magma.png.mcmeta`])).animation.frametime, 2);
  // Only the top pack tweaks water's animation (no image of its own): kept.
  assert.equal((await readJson(project.extraFiles[`${J}block/water_still.png.mcmeta`])).animation.frametime, 9);
  // The top pack's fire .mcmeta was made for vanilla fire, but fire's image comes from the bottom pack.
  assert.equal((await readJson(project.extraFiles[`${J}block/fire_0.png.mcmeta`])).animation.frametime, 4);
  assert.ok(project.overrides[`${J}block/fire_0.png`]);
  const lantern = report.conflicts.find((c) => c.path === `${J}block/sea_lantern.png`);
  assert.deepEqual(lantern, { path: `${J}block/sea_lantern.png`, winner: 0, losers: [1] });
  assert.equal(report.conflicts.find((c) => c.path === `${J}block/fire_0.png`)?.winner, 1);
  assert.equal(report.packs[1].overridden, 4, 'sea lantern + its .mcmeta, magma + its .mcmeta');
});

// ---------------------------------------------------------------------------------------------
// Java JSON merges

test('Java language files merge key by key, top pack first', async () => {
  const top = java('Top', '26.3', {}, { 'assets/minecraft/lang/en_us.json': jsonBlob({ 'block.minecraft.stone': 'Rock', 'menu.title': 'Hi' }) });
  const bottom = java('Bottom', '26.3', {}, { 'assets/minecraft/lang/en_us.json': jsonBlob({ 'block.minecraft.stone': 'Pebble', 'block.minecraft.dirt': 'Soil' }), 'assets/minecraft/lang/de_de.json': jsonBlob({ a: 'b' }) });
  const { project, report } = await mergePacks([top, bottom]);
  assert.deepEqual(await readJson(project.extraFiles['assets/minecraft/lang/en_us.json']), { 'block.minecraft.stone': 'Rock', 'menu.title': 'Hi', 'block.minecraft.dirt': 'Soil' });
  assert.deepEqual(await readJson(project.extraFiles['assets/minecraft/lang/de_de.json']), { a: 'b' });
  assert.deepEqual(report.merged.map((m) => [m.path, m.packs]), [['assets/minecraft/lang/en_us.json', [0, 1]]]);
  assert.equal(report.packs[0].merged, 1);
  assert.equal(report.packs[1].merged, 1);
  assert.equal(report.conflicts.length, 0);
});

test('old .lang files merge line by line', () => {
  const r = mergeLangText(['# top\ntile.stone.name=Rock\r\n', 'tile.stone.name=Pebble\ntile.dirt.name=Soil\n']);
  assert.equal(r.text, '# top\ntile.stone.name=Rock\ntile.dirt.name=Soil\n');
  assert.deepEqual(r.used, [0, 1]);
  assert.deepEqual(mergeLangText(['a=1\n', 'a=2\n']), { text: 'a=1\n', used: [0] });
});

test('sounds.json merges event by event; atlases and fonts concatenate', async () => {
  const top = java('Top', '26.3', {}, {
    'assets/minecraft/sounds.json': jsonBlob({ 'block.stone.break': { sounds: ['top/stone'] } }),
    'assets/minecraft/atlases/blocks.json': jsonBlob({ sources: [{ type: 'directory', source: 'top', prefix: 'top/' }, { type: 'directory', source: 'shared', prefix: 'shared/' }] }),
    'assets/minecraft/font/default.json': jsonBlob({ providers: [{ type: 'bitmap', file: 'minecraft:font/top.png', chars: ['a'] }] }),
  });
  const bottom = java('Bottom', '26.3', {}, {
    'assets/minecraft/sounds.json': jsonBlob({ 'block.stone.break': { sounds: ['bottom/stone'] }, 'block.dirt.break': { replace: true, sounds: ['bottom/dirt'] } }),
    'assets/minecraft/atlases/blocks.json': jsonBlob({ sources: [{ type: 'directory', source: 'shared', prefix: 'shared/' }, { type: 'single', resource: 'bottom:x' }] }),
    'assets/minecraft/font/default.json': jsonBlob({ providers: [{ type: 'bitmap', file: 'minecraft:font/bottom.png', chars: ['b'] }] }),
  });
  const { project, report } = await mergePacks([top, bottom]);
  assert.deepEqual(await readJson(project.extraFiles['assets/minecraft/sounds.json']), { 'block.stone.break': { sounds: ['top/stone'] }, 'block.dirt.break': { replace: true, sounds: ['bottom/dirt'] } });
  // Atlas sources: the lower pack's first, the top pack's last (later sources win), no duplicates.
  assert.deepEqual((await readJson(project.extraFiles['assets/minecraft/atlases/blocks.json'])).sources, [
    { type: 'directory', source: 'shared', prefix: 'shared/' },
    { type: 'single', resource: 'bottom:x' },
    { type: 'directory', source: 'top', prefix: 'top/' },
  ]);
  const font = await readJson(project.extraFiles['assets/minecraft/font/default.json']);
  assert.deepEqual(font.providers.map((p: { file: string }) => p.file), ['minecraft:font/top.png', 'minecraft:font/bottom.png']);
  assert.equal(report.merged.length, 3);
  assert.ok(report.merged.every((m) => m.packs.join() === '0,1'));
});

test('an unreadable JSON copy falls back to the top pack’s file', async () => {
  const top = java('Top', '26.3', {}, { 'assets/minecraft/sounds.json': text('{ not json') });
  const bottom = java('Bottom', '26.3', {}, { 'assets/minecraft/sounds.json': jsonBlob({ a: {} }) });
  const { project, report } = await mergePacks([top, bottom]);
  assert.equal(await project.extraFiles['assets/minecraft/sounds.json'].text(), '{ not json');
  assert.deepEqual(report.conflicts, [{ path: 'assets/minecraft/sounds.json', winner: 0, losers: [1] }]);
  assert.match(report.notes.join(' '), /couldn’t be read/);
});

test('mergeKeyed, mergeConcat and unionArrays', () => {
  assert.deepEqual(mergeKeyed([{ a: 1, n: { x: 1 } }, { a: 2, b: 3, n: { y: 2 } }], '*'), { value: { a: 1, n: { x: 1 }, b: 3 }, used: [0, 1] });
  assert.deepEqual(mergeKeyed([{ a: 1, n: { x: 1 } }, { n: { x: 9, y: 2 } }], { n: '*' }).value, { a: 1, n: { x: 1, y: 2 } });
  assert.deepEqual(mergeKeyed([{ a: 1 }, { a: 2 }], '*').used, [0]);
  // A "__proto__" key is data, not a prototype.
  const tricky = mergeKeyed([JSON.parse('{"__proto__": {"polluted": 1}}'), { a: 1 }], '*').value as Record<string, unknown>;
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.ok(Object.prototype.hasOwnProperty.call(tricky, '__proto__'));
  assert.deepEqual(mergeConcat([{ list: [1, 2], keep: 'top' }, { list: [2, 3], keep: 'bottom' }], 'list', true)?.value, { list: [1, 2, 3], keep: 'top' });
  assert.deepEqual(mergeConcat([{ list: [1] }, { list: [2] }], 'list', false)?.value, { list: [2, 1] });
  assert.equal(mergeConcat([{ list: 1 }, { list: [2] }], 'list', true), null);
  assert.deepEqual(unionArrays([['en_US', 'de_DE'], ['de_DE', 'fr_FR']]), { value: ['en_US', 'de_DE', 'fr_FR'], used: [0, 1] });
});

test('pack.mcmeta language, filter and overlay sections are combined', async () => {
  const assets = fakeAssets('java', '26.3', { [`${J}block/stone.png`]: solid(16, 16, [9, 9, 9, 255]) });
  const top = java('Top', '26.3', { [`${J}block/stone.png`]: RED }, {
    'pack.mcmeta': jsonBlob({ pack: { pack_format: 97, description: 'x' }, language: { tp_tp: { name: 'Top', region: 'T', bidirectional: false } }, filter: { block: [{ namespace: 'minecraft', path: 'a' }] } }),
  });
  const bottom = java('Bottom', '26.3', {}, {
    'pack.mcmeta': jsonBlob({ pack: { pack_format: 97, description: 'y' }, language: { bt_bt: { name: 'Bottom', region: 'B', bidirectional: false } }, filter: { block: [{ namespace: 'minecraft', path: 'b' }] } }),
  });
  const { project } = await mergePacks([top, bottom]);
  const r = await exportTexturePack(project, assets);
  const zip = await unzipBlob(r.blob);
  const mcmeta = JSON.parse(new TextDecoder().decode(zip['pack.mcmeta']));
  assert.equal(mcmeta.pack.description, 'Merged from Top and Bottom');
  assert.equal(mcmeta.pack.max_format, 97);
  assert.deepEqual(Object.keys(mcmeta.language), ['tp_tp', 'bt_bt']);
  assert.deepEqual(mcmeta.filter.block.map((b: { path: string }) => b.path), ['a', 'b']);
  assert.ok(zip[`${J}block/stone.png`]);
  assert.ok(zip['pack.png'], 'icon generated for packs without one');
});

// ---------------------------------------------------------------------------------------------
// Bedrock

test('Bedrock texture lists, blocks and sounds merge entry by entry, top pack first', async () => {
  const terrain = (data: Record<string, unknown>, name: string) => jsonBlob({ resource_pack_name: name, texture_name: 'atlas.terrain', padding: 8, num_mip_levels: 4, texture_data: data });
  const top = bedrock('Top', { 'textures/blocks/stone.png': RED }, {
    'textures/terrain_texture.json': terrain({ stone: { textures: 'textures/blocks/stone' }, custom_a: { textures: 'textures/blocks/a' } }, 'top'),
    'textures/item_texture.json': jsonBlob({ texture_data: { apple: { textures: 'textures/items/apple_top' } } }),
    'blocks.json': jsonBlob({ format_version: [1, 1, 0], stone: { textures: 'stone', sound: 'stone' } }),
    'sounds/sound_definitions.json': jsonBlob({ format_version: '1.20.20', sound_definitions: { 'dig.stone': { sounds: ['sounds/top/stone'] } } }),
    'sounds.json': jsonBlob({ block_sounds: { stone: { volume: 1, events: { break: 'dig.stone' } } }, entity_sounds: { entities: { pig: { volume: 1 } } } }),
    'texts/en_US.lang': text('pack.name=Top\nitem.apple.name=Red apple\n'),
    'texts/languages.json': jsonBlob(['en_US']),
  });
  const bottom = bedrock('Bottom', { 'textures/blocks/stone.png': BLUE, 'textures/blocks/dirt.png': BLUE }, {
    'textures/terrain_texture.json': terrain({ stone: { textures: 'textures/blocks/stone_old' }, custom_b: { textures: 'textures/blocks/b' } }, 'bottom'),
    'textures/item_texture.json': jsonBlob({ texture_data: { apple: { textures: 'textures/items/apple_bottom' }, stick: { textures: 'textures/items/stick' } } }),
    'blocks.json': jsonBlob({ format_version: [1, 1, 0], stone: { textures: 'old_stone' }, dirt: { textures: 'dirt' } }),
    'sounds/sound_definitions.json': jsonBlob({ 'dig.stone': { sounds: ['sounds/bottom/stone'] }, 'dig.dirt': { sounds: ['sounds/bottom/dirt'] } }),
    'sounds.json': jsonBlob({ block_sounds: { stone: { volume: 0.5 }, dirt: { volume: 1 } }, entity_sounds: { entities: { cow: { volume: 1 } } } }),
    'texts/en_US.lang': text('pack.name=Bottom\nitem.stick.name=Twig'),
    'texts/languages.json': jsonBlob(['en_US', 'de_DE']),
  });
  const { project, report } = await mergePacks([top, bottom]);
  assert.equal(project.edition, 'bedrock');
  assert.ok(await same(project.overrides['textures/blocks/stone.png'], RED));
  assert.ok(project.overrides['textures/blocks/dirt.png']);
  const t = await readJson(project.extraFiles['textures/terrain_texture.json']);
  assert.equal(t.resource_pack_name, 'top');
  assert.deepEqual(t.texture_data, { stone: { textures: 'textures/blocks/stone' }, custom_a: { textures: 'textures/blocks/a' }, custom_b: { textures: 'textures/blocks/b' } });
  assert.deepEqual((await readJson(project.extraFiles['textures/item_texture.json'])).texture_data, { apple: { textures: 'textures/items/apple_top' }, stick: { textures: 'textures/items/stick' } });
  assert.deepEqual(await readJson(project.extraFiles['blocks.json']), { format_version: [1, 1, 0], stone: { textures: 'stone', sound: 'stone' }, dirt: { textures: 'dirt' } });
  const defs = await readJson(project.extraFiles['sounds/sound_definitions.json']);
  assert.equal(defs.format_version, '1.20.20');
  assert.deepEqual(defs.sound_definitions, { 'dig.stone': { sounds: ['sounds/top/stone'] }, 'dig.dirt': { sounds: ['sounds/bottom/dirt'] } });
  const sounds = await readJson(project.extraFiles['sounds.json']);
  assert.deepEqual(sounds.block_sounds, { stone: { volume: 1, events: { break: 'dig.stone' } }, dirt: { volume: 1 } });
  assert.deepEqual(Object.keys(sounds.entity_sounds.entities), ['pig', 'cow']);
  assert.equal(await project.extraFiles['texts/en_US.lang'].text(), 'pack.name=Top\nitem.apple.name=Red apple\nitem.stick.name=Twig\n');
  assert.deepEqual(await readJson(project.extraFiles['texts/languages.json']), ['en_US', 'de_DE']);
  assert.equal(report.merged.length, 7);
});

test('Bedrock: one texture name is one file, whatever its extension, with its UI .json', async () => {
  const top = bedrock('Top', { 'textures/blocks/grass_side.png': RED, 'textures/ui/button.png': RED }, { 'textures/ui/button.json': jsonBlob({ nineslice_size: 4, base_size: [16, 16] }) });
  const bottom = bedrock('Bottom', { 'textures/blocks/grass_side.tga': BLUE, 'textures/ui/button.png': BLUE, 'textures/ui/panel.png': BLUE }, { 'textures/ui/button.json': jsonBlob({ nineslice_size: 2, base_size: [8, 8] }) });
  const { project, report } = await mergePacks([top, bottom]);
  // Bedrock prefers .tga inside one pack, so the bottom pack's .tga must not come along.
  assert.ok(project.overrides['textures/blocks/grass_side.png']);
  assert.equal(project.overrides['textures/blocks/grass_side.tga'], undefined);
  assert.equal((await readJson(project.extraFiles['textures/ui/button.json'])).nineslice_size, 4);
  assert.ok(project.overrides['textures/ui/panel.png']);
  assert.deepEqual(report.conflicts.find((c) => c.path === 'textures/blocks/grass_side.png'), { path: 'textures/blocks/grass_side.png', winner: 0, losers: [1] });
});

test('Bedrock flipbook entries follow their texture', async () => {
  const entry = (stem: string, ticks: number) => ({ flipbook_texture: `textures/blocks/${stem}`, atlas_tile: stem, ticks_per_frame: ticks });
  const top = bedrock('Top', { 'textures/blocks/sea_lantern.png': png([1, 1, 1, 255], 16, 64), 'textures/blocks/magma.png': RED }, { 'textures/flipbook_textures.json': jsonBlob([entry('sea_lantern', 2), entry('lava_still', 9)]) });
  const bottom = bedrock('Bottom', { 'textures/blocks/magma.png': png([2, 2, 2, 255], 16, 48), 'textures/blocks/fire_0.png': png([3, 3, 3, 255], 16, 64) }, { 'textures/flipbook_textures.json': jsonBlob([entry('sea_lantern', 5), entry('magma', 4), entry('fire_0', 3)]) });
  const { project, report } = await mergePacks([top, bottom]);
  const flip = (await readJson(project.extraFiles['textures/flipbook_textures.json'])) as { flipbook_texture: string; ticks_per_frame: number }[];
  const by = Object.fromEntries(flip.map((e) => [e.flipbook_texture.replace('textures/blocks/', ''), e.ticks_per_frame]));
  // sea_lantern: the top pack's texture with the top's entry; lava_still: only the top has one;
  // magma: the top's still image wins, so the bottom's animation is left out; fire_0: bottom's own.
  assert.deepEqual(by, { sea_lantern: 2, lava_still: 9, fire_0: 3 });
  assert.ok(report.dropped.some((d) => d.path === 'textures/flipbook_textures.json' && d.pack === 1 && /magma/.test(d.reason)));
  assert.match(report.notes.join(' '), /animation entry/);
  assert.deepEqual(report.merged.find((m) => m.path === 'textures/flipbook_textures.json')?.packs, [0, 1]);

  // A single pack's flipbook loses the entries of textures another pack replaced.
  const plain = bedrock('Plain', { 'textures/blocks/magma.png': RED });
  const solo = bedrock('Anim', { 'textures/blocks/magma.png': png([2, 2, 2, 255], 16, 48) }, { 'textures/flipbook_textures.json': jsonBlob([entry('magma', 4)]) });
  const r2 = await mergePacks([plain, solo]);
  assert.equal(r2.project.extraFiles['textures/flipbook_textures.json'], undefined);
  assert.deepEqual(mergeFlipbooks([[entry('a', 1)]], [3], () => undefined).value, [entry('a', 1)]);
});

test('Bedrock: fresh uuids, sub-packs, dependencies and the newest engine version are kept', async () => {
  const manifest = (name: string, extra: Record<string, unknown>) =>
    jsonBlob({ format_version: 2, header: { name, uuid: '00000000-0000-4000-8000-000000000001', version: [1, 0, 0], min_engine_version: extra.engine }, modules: [{ type: 'resources', uuid: '00000000-0000-4000-8000-000000000002', version: [1, 0, 0] }], ...extra.rest as object });
  const top = bedrock('Top', { 'textures/blocks/stone.png': RED }, { 'manifest.json': manifest('Top', { engine: [1, 21, 0], rest: { subpacks: [{ folder_name: 'low', name: 'Low', memory_tier: 0 }], metadata: { authors: ['Ann'] } } }) });
  const bottom = bedrock('Bottom', {}, { 'manifest.json': manifest('Bottom', { engine: [1, 21, 50], rest: { subpacks: [{ folder_name: 'low', name: 'Other low', memory_tier: 1 }, { folder_name: 'high', name: 'High', memory_tier: 2 }], dependencies: [{ uuid: '11111111-1111-4111-8111-111111111111', version: [1, 0, 0] }], metadata: { authors: ['Bo', 'Ann'] } } }), 'contents.json': jsonBlob({ content: [] }) });
  top.bedrockUuids = { header: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', module: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' };
  const { project, report } = await mergePacks([top, bottom]);
  assert.ok(project.bedrockUuids);
  assert.notEqual(project.bedrockUuids!.header, top.bedrockUuids.header);
  assert.notEqual(project.bedrockUuids!.header, bottom.bedrockUuids!.header);
  assert.equal(project.extraFiles['contents.json'], undefined);
  assert.ok(report.dropped.some((d) => d.path === 'contents.json'));

  const assets = fakeAssets('bedrock', 'latest', { 'textures/blocks/stone.png': solid(16, 16, [9, 9, 9, 255]) });
  const r = await exportTexturePack(project, assets);
  const zip = await unzipBlob(r.blob);
  const m = JSON.parse(new TextDecoder().decode(zip['manifest.json']));
  assert.equal(m.header.name, 'Merged Pack');
  assert.equal(m.header.description, 'Merged from Top and Bottom');
  assert.equal(m.header.uuid, project.bedrockUuids!.header);
  assert.deepEqual(m.header.min_engine_version, [1, 21, 50]);
  assert.deepEqual(m.subpacks.map((s: { folder_name: string; name: string }) => `${s.folder_name}:${s.name}`), ['low:Low', 'high:High']);
  assert.deepEqual(m.dependencies.map((d: { uuid: string }) => d.uuid), ['11111111-1111-4111-8111-111111111111']);
  assert.deepEqual(m.metadata.authors, ['Ann', 'Bo']);
  assert.ok(zip['textures/blocks/stone.png']);
});

// ---------------------------------------------------------------------------------------------
// Java versions

test('packs for older Java versions get the target version’s texture names first', async () => {
  const anim = jsonBlob({ animation: { frametime: 6 } });
  const modern = java('Modern', '26.3', { [`${J}block/stone.png`]: RED });
  const old = java(
    'Old',
    '1.12.2',
    { [`${J}blocks/stone.png`]: BLUE, [`${J}blocks/dirt.png`]: BLUE, [`${J}blocks/sea_lantern.png`]: png([5, 5, 5, 255], 16, 80), [`${J}blocks/gone.png`]: BLUE, [`${J}blocks/split.png`]: GREEN, [`${J}custom/thing.png`]: GREEN },
    { [`${J}blocks/sea_lantern.png.mcmeta`]: anim, 'assets/minecraft/models/block/dirt.json': jsonBlob({ parent: 'block/cube_all', textures: { all: 'blocks/dirt' } }) },
  );
  assert.equal(defaultMergeVersion([old, modern]), '26.3');
  assert.equal(defaultMergeVersion([]), '26.3');
  const { project, report } = await mergePacks([modern, old], { renames: RENAMES });
  assert.equal(project.version, '26.3');
  assert.ok(await same(project.overrides[`${J}block/stone.png`], RED), 'the top pack still wins after renaming');
  assert.ok(await same(project.overrides[`${J}block/dirt.png`], BLUE));
  assert.equal(project.overrides[`${J}blocks/dirt.png`], undefined, 'no old names left');
  assert.ok(project.overrides[`${J}block/sea_lantern.png`]);
  assert.equal((await readJson(project.extraFiles[`${J}block/sea_lantern.png.mcmeta`])).animation.frametime, 6, '.mcmeta renamed with its texture');
  assert.ok(project.overrides[`${J}block/split_a.png`] && project.overrides[`${J}block/split_b.png`], 'split textures');
  assert.ok(project.overrides[`${J}custom/thing.png`], 'custom textures keep their path');
  assert.equal(project.overrides[`${J}blocks/gone.png`], undefined);
  assert.ok(report.dropped.some((d) => d.path === `${J}blocks/gone.png` && d.pack === 1));
  assert.equal((await readJson(project.extraFiles['assets/minecraft/models/block/dirt.json'])).textures.all, 'block/dirt', 'model texture names updated');
  assert.equal(report.packs[1].renamed, 4);
  assert.equal(report.packs[1].removed, 1);
  assert.deepEqual(report.conflicts.map((c) => c.path), [`${J}block/stone.png`]);
  assert.match(report.notes.join(' '), /Old was made for another version: 4 textures got their Java 26\.3 name/);
  assert.match(report.notes.join(' '), /1 texture isn’t part of Java 26\.3/);
});

test('merging for an older Java version renames the newer pack’s textures back', async () => {
  const modern = java('Modern', '26.3', { [`${J}block/stone.png`]: RED });
  const old = java('Old', '1.12.2', { [`${J}blocks/dirt.png`]: BLUE });
  const { project } = await mergePacks([modern, old], { renames: RENAMES, version: '1.12.2' });
  assert.equal(project.version, '1.12.2');
  assert.ok(project.overrides[`${J}blocks/stone.png`]);
  assert.ok(project.overrides[`${J}blocks/dirt.png`]);
});

test('Java compatibility range: the versions every pack supports', () => {
  assert.equal(compatRange([{ version: '26.3' }, { version: '26.3' }], '26.3'), undefined);
  assert.deepEqual(
    compatRange([{ version: '1.21.4', compat: { minVersion: '1.20', maxVersion: '1.21.4' } }, { version: '1.21.4', compat: { minVersion: '1.21', maxVersion: '1.21.4' } }], '1.21.4'),
    { minVersion: '1.21', maxVersion: '1.21.4' },
  );
  // A pack renamed for the target counts as made for the target only.
  assert.equal(compatRange([{ version: '1.21.4', compat: { minVersion: '1.20', maxVersion: '1.21.4' } }, { version: '1.12.2' }], '1.21.4'), undefined);
  assert.equal(compatRange([{ version: '1.21.4', compat: { minVersion: '1.20', maxVersion: '1.21.4' } }, { version: '1.21.4' }], '1.21.4'), undefined);
});

test('merged project: description, resolution and notes', async () => {
  const a = java('Alpha', '26.3', {});
  a.resolution = 32;
  const b = java('Beta', '26.3', {});
  const c = java('Gamma', '26.3', {});
  c.name = '';
  const { project, report } = await mergePacks([a, b, c]);
  assert.equal(project.description, 'Merged from Alpha, Beta and Untitled pack');
  assert.equal(project.resolution, 32);
  assert.match(report.notes.join(' '), /different resolutions \(16× and 32×\)/);
  assert.equal(mergeDescription(['A']), 'Merged from A');
});
