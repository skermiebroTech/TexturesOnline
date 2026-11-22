// Packs with their own namespace (server and mod packs): a synthetic pack with the same structures as
// a big server pack (its own namespace's textures, models, item definitions picking a look by custom
// data / use / range, animations, sounds, fonts, core shaders, a licence file) is opened, browsed,
// shown in the model library and exported again unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, unzipSync, strToU8 } from 'fflate';
import { importPack } from '../../src/tools/textures/import';
import { exportTexturePack } from '../../src/tools/textures/export';
import { categoryForPath, isPackTexturePath, javaTextureParts } from '../../src/tools/textures/project';
import { buildEntries, packAnimations, packTextureId, readAnimInfo } from '../../src/tools/textures/ui/meta';
import { describePackForGame, validatePackSection } from '../../src/editions/java/packmeta';
import { itemDefinitionPath, itemIdOfDefinition, itemOptions } from '../../src/shared/models/java-models';
import { loadModelLibrary } from '../../src/shared/models/index';
import { readZip } from '../../src/core/zip';
import { decodeImage, encodePng } from '../../src/core/image';
import { fakeAssets, img, javaSpec, noisy, unzipBlob } from '../tools/texlogic/fixtures';

const NS = 'assets/skyland/';
const enc = (v: unknown) => strToU8(typeof v === 'string' ? v : JSON.stringify(v));
/** A strip of `n` square frames, frame i a solid colour. */
const strip = (w: number, n: number) => img(w, w * n, (_x, y) => [40 * (Math.floor(y / w) + 1), 90, 160, 255]);

/** The files of a server-style pack (format 88 = Java 26.2), every one made up here. */
function serverPack(): Record<string, Uint8Array> {
  const model = (parent: string, layer0: string) => enc({ parent, textures: { layer0 } });
  return {
    'pack.mcmeta': enc({ pack: { pack_format: 88, min_format: 88, max_format: 88, description: 'Skyland' } }),
    'pack.png': encodePng(noisy(64, 64, 9)),
    LICENSE: enc('Example licence text.\nAll rights reserved.\n'),
    // item definitions: a look picked by custom data, a bow drawn in steps, a composite, a select
    [`${NS}items/item/gems/ruby.json`]: enc({
      model: {
        type: 'condition',
        property: 'component',
        predicate: 'custom_data',
        value: '{active:true}',
        on_true: { type: 'model', model: 'skyland:item/gems/ruby_active' },
        on_false: { type: 'model', model: 'skyland:item/gems/ruby' },
      },
    }),
    [`${NS}items/item/tools/sky_bow.json`]: enc({
      model: {
        type: 'condition',
        property: 'using_item',
        on_false: { type: 'model', model: 'skyland:item/tools/sky_bow' },
        on_true: {
          type: 'range_dispatch',
          property: 'use_duration',
          scale: 0.05,
          entries: [{ threshold: 0.65, model: { type: 'model', model: 'skyland:item/tools/sky_bow_pulling_1' } }],
          fallback: { type: 'model', model: 'skyland:item/tools/sky_bow_pulling_0' },
        },
      },
    }),
    [`${NS}items/item/tools/drill.json`]: enc({
      model: {
        type: 'composite',
        models: [
          { type: 'condition', property: 'selected', on_false: { type: 'model', model: 'skyland:item/tools/drill_head' }, on_true: { type: 'model', model: 'skyland:item/tools/drill_head' } },
          { type: 'model', model: 'skyland:item/tools/drill_handle' },
        ],
      },
    }),
    [`${NS}items/item/staff.json`]: enc({
      model: { type: 'select', property: 'display_context', cases: [{ when: ['gui', 'ground'], model: { type: 'model', model: 'skyland:item/staff' } }], fallback: { type: 'model', model: 'skyland:item/staff_in_hand' } },
    }),
    // models: parents across namespaces (the game's item/generated, the pack's own)
    [`${NS}models/item/gems/ruby.json`]: model('item/generated', 'skyland:item/gems/ruby'),
    [`${NS}models/item/gems/ruby_active.json`]: enc({ parent: 'skyland:item/gems/ruby', textures: { layer0: 'skyland:item/gems/ruby_active' } }),
    [`${NS}models/item/tools/sky_bow.json`]: model('item/generated', 'skyland:item/tools/sky_bow'),
    [`${NS}models/item/tools/sky_bow_pulling_0.json`]: model('skyland:item/tools/sky_bow', 'skyland:item/tools/sky_bow_pulling_0'),
    [`${NS}models/item/tools/sky_bow_pulling_1.json`]: model('skyland:item/tools/sky_bow', 'skyland:item/tools/sky_bow_pulling_1'),
    [`${NS}models/item/tools/drill_head.json`]: model('item/handheld', 'skyland:item/tools/drill_head'),
    [`${NS}models/item/tools/drill_handle.json`]: model('item/handheld', 'skyland:item/tools/drill_handle'),
    [`${NS}models/item/staff.json`]: model('item/generated', 'skyland:item/staff'),
    [`${NS}models/item/staff_in_hand.json`]: model('minecraft:item/handheld', 'skyland:item/staff'),
    // textures, one animated (frame time, blending, a timed frame) and one GUI sprite with nine-slice
    [`${NS}textures/item/gems/ruby.png`]: encodePng(noisy(16, 16, 1)),
    [`${NS}textures/item/gems/ruby_active.png`]: encodePng(strip(16, 3)),
    [`${NS}textures/item/gems/ruby_active.png.mcmeta`]: enc('{"animation": {"frametime": 3, "interpolate": true, "frames": [0, 1, {"index": 2, "time": 9}]}}'),
    [`${NS}textures/item/tools/sky_bow.png`]: encodePng(noisy(16, 16, 2)),
    [`${NS}textures/item/tools/sky_bow_pulling_0.png`]: encodePng(noisy(16, 16, 3)),
    [`${NS}textures/item/tools/sky_bow_pulling_1.png`]: encodePng(noisy(16, 16, 4)),
    [`${NS}textures/item/tools/drill_head.png`]: encodePng(noisy(16, 16, 5)),
    [`${NS}textures/item/tools/drill_handle.png`]: encodePng(noisy(16, 16, 6)),
    [`${NS}textures/item/staff.png`]: encodePng(noisy(16, 16, 7)),
    [`${NS}textures/gui/panel.png`]: encodePng(noisy(32, 32, 8)),
    [`${NS}textures/gui/panel.png.mcmeta`]: enc({ gui: { scaling: { type: 'nine_slice', width: 32, height: 32, border: 4 } } }),
    // sounds and fonts of the namespace
    [`${NS}sounds.json`]: enc({ 'music.theme': { sounds: [{ name: 'skyland:music/theme' }] } }),
    [`${NS}sounds/music/theme.ogg`]: new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 2, 0, 0, 1, 2, 3, 4]),
    [`${NS}font/map.json`]: enc({ providers: [{ type: 'bitmap', file: 'skyland:gui/panel.png', ascent: 8, height: 8, chars: [''] }] }),
    // the game's namespace: a sprite, a font using the pack's textures, core shaders
    'assets/minecraft/textures/gui/sprites/tooltip/frame.png': encodePng(noisy(100, 100, 10)),
    'assets/minecraft/textures/gui/sprites/tooltip/frame.png.mcmeta': enc({ gui: { scaling: { type: 'nine_slice', width: 100, height: 100, border: 9 } } }),
    'assets/minecraft/font/default.json': enc({ providers: [{ type: 'bitmap', file: 'skyland:gui/panel.png', ascent: 7, height: 7, chars: [''] }] }),
    'assets/minecraft/shaders/core/item.vsh': enc('#version 330\n#moj_import <minecraft:util.glsl>\nvoid main() {}\n'),
    'assets/minecraft/shaders/core/item.fsh': enc('#version 330\nout vec4 fragColor;\nvoid main() { fragColor = vec4(1.0); }\n'),
    'assets/minecraft/shaders/include/util.glsl': enc('float twice(float x) { return x * 2.0; }\n'),
  };
}

const fileOf = (files: Record<string, Uint8Array>, name = 'skyland.zip') => new File([zipSync(files) as BlobPart], name);
const bytesOf = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

test('a pack\'s own namespace: its textures open as editable textures, everything else is kept', async () => {
  const files = serverPack();
  const { project, warnings } = await importPack(fileOf(files));
  assert.deepEqual(warnings, []);
  assert.equal(project.version, '26.2', 'format 88 is Java 26.2');
  assert.equal(project.compat, undefined);
  assert.equal(project.description, 'Skyland');
  const textures = Object.keys(files).filter((p) => p.endsWith('.png') && p !== 'pack.png');
  assert.deepEqual(Object.keys(project.overrides).sort(), textures.sort());
  for (const [path, bytes] of Object.entries(files)) {
    if (path === 'pack.png') assert.deepEqual(await bytesOf(project.icon!), bytes);
    else assert.deepEqual(await bytesOf(project.overrides[path] ?? project.extraFiles[path]), bytes, path);
  }
});

test('texture paths in any namespace: ids, categories, browser entries and animations', async () => {
  assert.deepEqual(javaTextureParts(`${NS}textures/item/gems/ruby.png`), { ns: 'skyland', rel: 'item/gems/ruby.png' });
  assert.equal(javaTextureParts(`${NS}models/item/gems/ruby.json`), null);
  assert.ok(isPackTexturePath(`${NS}textures/item/gems/ruby.png`, 'java'));
  assert.ok(!isPackTexturePath(`${NS}textures/item/gems/ruby.png.mcmeta`, 'java'));
  assert.ok(!isPackTexturePath(`${NS}textures/item/gems/ruby.png`, 'bedrock'));
  assert.equal(categoryForPath(`${NS}textures/item/gems/ruby.png`, 'java'), 'item');
  assert.equal(categoryForPath(`${NS}textures/gui/panel.png`, 'java'), 'gui');
  assert.equal(categoryForPath('assets/minecraft/textures/block/stone.png', 'java'), 'block');
  assert.equal(packTextureId(`${NS}textures/item/gems/ruby.png`, 'java'), 'skyland:item/gems/ruby');
  assert.equal(packTextureId('assets/minecraft/textures/item/odd.png', 'java'), 'item/odd');
  assert.equal(packTextureId('textures/blocks/odd.tga', 'bedrock'), 'blocks/odd');

  const { project } = await importPack(fileOf(serverPack()));
  const assets = fakeAssets('java', '26.2', javaSpec());
  const animated = await packAnimations(project, assets);
  assert.deepEqual([...animated], [`${NS}textures/item/gems/ruby_active.png`], 'the nine-slice sprite is not an animation');
  const entries = buildEntries(project, assets, categoryForPath, [], animated);
  const ruby = entries.find((e) => e.path === `${NS}textures/item/gems/ruby_active.png`)!;
  assert.ok(ruby.custom && ruby.animated);
  assert.equal(ruby.id, 'skyland:item/gems/ruby_active');
  assert.equal(ruby.category, 'item');
  assert.ok(ruby.hay.includes('skyland'), 'searchable by namespace');
  assert.equal(entries.filter((e) => e.custom).length, 10);

  // its animation plays as the .mcmeta says
  const full = await decodeImage(project.overrides[ruby.path], 'png');
  const anim = (await readAnimInfo(project, assets, ruby, full, null))!;
  assert.equal(anim.count, 3);
  assert.equal(anim.frametime, 3);
  assert.ok(anim.interpolate);
  assert.deepEqual(anim.sequence, [{ index: 0, time: 3 }, { index: 1, time: 3 }, { index: 2, time: 9 }]);
});

test('export: every untouched file comes out byte for byte, pack.mcmeta is valid for the version', async () => {
  const files = serverPack();
  const { project } = await importPack(fileOf(files));
  const res = await exportTexturePack(project, fakeAssets('java', '26.2', javaSpec()));
  const out = await unzipBlob(res.blob);
  assert.deepEqual(Object.keys(out).sort(), Object.keys(files).sort(), 'no file dropped or added');
  for (const [path, bytes] of Object.entries(files)) if (path !== 'pack.mcmeta') assert.deepEqual(out[path], bytes, path);
  const text = new TextDecoder().decode(out['pack.mcmeta']);
  // 26.2 reads min_format / max_format; pack_format is optional from format 65 and left out
  assert.deepEqual(JSON.parse(text).pack, { description: 'Skyland', min_format: 88, max_format: 88 });
  assert.deepEqual(validatePackSection(JSON.parse(text).pack), { min: { major: 88, minor: 0 }, max: { major: 88, minor: 0x7fffffff } });
  assert.equal(describePackForGame(text, { major: 88, minor: 0 }), 'compatible');
  assert.equal(describePackForGame(text, { major: 97, minor: 1 }), 'too-old');

  // retargeted at 26.3 with a range from 26.1: only pack.mcmeta changes
  project.version = '26.3';
  project.compat = { minVersion: '26.1', maxVersion: '26.3' };
  const again = await unzipBlob((await exportTexturePack(project, fakeAssets('java', '26.3', javaSpec()))).blob);
  for (const [path, bytes] of Object.entries(files)) if (path !== 'pack.mcmeta') assert.deepEqual(again[path], bytes, path);
  const ranged = new TextDecoder().decode(again['pack.mcmeta']);
  assert.deepEqual(JSON.parse(ranged).pack, { description: 'Skyland', min_format: 84, max_format: 97 });
  for (const f of [{ major: 84, minor: 0 }, { major: 88, minor: 0 }, { major: 97, minor: 1 }]) assert.equal(describePackForGame(ranged, f), 'compatible');
});

test('item definitions in a pack\'s namespace: paths, ids and a label for every look', () => {
  assert.equal(itemDefinitionPath('apple'), 'assets/minecraft/items/apple.json');
  assert.equal(itemDefinitionPath('skyland:item/gems/ruby'), `${NS}items/item/gems/ruby.json`);
  assert.equal(itemIdOfDefinition(`${NS}items/item/gems/ruby.json`), 'skyland:item/gems/ruby');
  assert.equal(itemIdOfDefinition('assets/minecraft/items/apple.json'), 'apple');
  assert.equal(itemIdOfDefinition(`${NS}models/item/gems/ruby.json`), null);
  const json = (p: string) => JSON.parse(new TextDecoder().decode(serverPack()[p]));
  const ruby = itemOptions(json(`${NS}items/item/gems/ruby.json`));
  assert.deepEqual(ruby.map((o) => o.label), ['', 'Active'], 'a custom data flag names its look');
  const bow = itemOptions(json(`${NS}items/item/tools/sky_bow.json`));
  assert.deepEqual(bow.map((o) => o.label), ['', 'In use · 1', 'In use · 2'], 'the drawing steps are numbered');
  const drill = itemOptions(json(`${NS}items/item/tools/drill.json`));
  assert.equal(drill.length, 1);
  assert.equal(drill[0].leaves.length, 2, 'head and handle drawn together');
  const staff = itemOptions(json(`${NS}items/item/staff.json`));
  assert.deepEqual(staff.map((o) => o.label), ['', 'In the inventory']);
});

test('model library: the pack\'s items are listed and drawn from its textures across namespaces', async () => {
  const assets = fakeAssets('java', '26.2', {
    'assets/minecraft/blockstates/stone.json': JSON.stringify({ variants: { '': { model: 'minecraft:block/stone' } } }),
    'assets/minecraft/models/block/stone.json': JSON.stringify({ parent: 'block/cube_all', textures: { all: 'minecraft:block/stone' } }),
    'assets/minecraft/models/block/cube_all.json': JSON.stringify({ elements: [{ from: [0, 0, 0], to: [16, 16, 16], faces: { up: { texture: '#all' } } }] }),
    'assets/minecraft/items/stick.json': JSON.stringify({ model: { type: 'model', model: 'minecraft:item/stick' } }),
    'assets/minecraft/models/item/generated.json': JSON.stringify({ parent: 'builtin/generated' }),
    'assets/minecraft/models/item/handheld.json': JSON.stringify({ parent: 'item/generated' }),
    'assets/minecraft/models/item/stick.json': JSON.stringify({ parent: 'item/handheld', textures: { layer0: 'minecraft:item/stick' } }),
    'assets/minecraft/textures/block/stone.png': noisy(16, 16, 1),
    'assets/minecraft/textures/item/stick.png': noisy(16, 16, 2),
  });
  const lib = await loadModelLibrary(assets);
  assert.deepEqual(lib.items().map((e) => e.id), ['stick']);
  const pack = serverPack();
  const parsed = new Map<string, unknown>();
  for (const [p, b] of Object.entries(pack)) if (/^assets\/[^/]+\/(models|items|blockstates)\/.+\.json$/.test(p)) parsed.set(p, JSON.parse(new TextDecoder().decode(b)));
  const has = (p: string) => p in pack;
  lib.setPackFiles((p) => parsed.get(p), { files: parsed.keys(), hasTexture: has });
  try {
    const ids = lib.items().map((e) => e.id);
    assert.deepEqual(ids.filter((id) => id.startsWith('skyland:')).sort(), ['skyland:item/gems/ruby', 'skyland:item/staff', 'skyland:item/tools/drill', 'skyland:item/tools/sky_bow']);
    assert.ok(ids.includes('stick'));
    const ruby = lib.item('skyland:item/gems/ruby')!;
    assert.equal(ruby.name, 'Ruby');
    // the default look: a flat sprite through skyland:item/gems/ruby -> minecraft:item/generated
    const v = lib.resolve(ruby);
    assert.equal(v.shape, 'sprite');
    assert.deepEqual(v.sprite.map((s) => s.path), [`${NS}textures/item/gems/ruby.png`]);
    assert.ok(v.textures.every((t) => !t.missing), 'the pack\'s textures are not "missing"');
    assert.deepEqual(lib.properties(ruby)[0].values.map((x) => x.label), ['Default', 'Active']);
    const active = lib.resolve(ruby, { model: '1' });
    assert.deepEqual(active.sprite.map((s) => s.path), [`${NS}textures/item/gems/ruby_active.png`]);
    // a composite of flat parts shows every part
    const drill = lib.resolve(lib.item('skyland:item/tools/drill')!);
    assert.deepEqual(drill.sprite.map((s) => s.path), [`${NS}textures/item/tools/drill_head.png`, `${NS}textures/item/tools/drill_handle.png`]);
    // which items use a texture of the pack
    const usage = await lib.rebuildUsage();
    assert.deepEqual(usage.get(`${NS}textures/item/tools/sky_bow_pulling_1.png`)?.items, ['skyland:item/tools/sky_bow']);
  } finally {
    lib.setPackFiles(null);
  }
  assert.deepEqual(lib.items().map((e) => e.id), ['stick'], 'back to the game\'s items');
});

test('readZip: the same files as a one-shot unzip, for a pack of thousands of files', async () => {
  const files: Record<string, Uint8Array> = {};
  for (let i = 0; i < 3000; i++) files[`assets/skyland/models/item/m${i}.json`] = enc({ parent: 'item/generated', textures: { layer0: `skyland:item/t${i}` } });
  files['assets/skyland/textures/big.png'] = encodePng(noisy(300, 300, 3));
  files['assets/skyland/lang/ünïcode.json'] = enc({ a: 'b' });
  const zipped = zipSync({ ...files, 'folder/': new Uint8Array(0), '__MACOSX/._x': enc('junk') }, { level: 6 });
  const read = await readZip(zipped);
  assert.deepEqual(Object.keys(read).sort(), Object.keys(files).sort());
  const plain = unzipSync(zipped);
  for (const k of Object.keys(files)) assert.deepEqual(read[k], plain[k], k);
  assert.deepEqual(Object.keys(await readZip(zipped, (p) => p.endsWith('.png'))), ['assets/skyland/textures/big.png']);
});
