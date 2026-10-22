// Pack Doctor: every check finds its problem in a pack built in memory, and the fixes give a pack
// that passes the checks again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, unzipSync } from 'fflate';
import { encodePng, encodeTga } from '../../src/core/image';
import { encode as encodePngRaw } from 'fast-png';
import { openArchive, openFolder } from '../../src/tools/doctor/archive';
import { baseNameOf, looksGood, rebuiltMcmeta, repairedManifest } from '../../src/tools/doctor/checks';
import { buildFixed, fixAll, fixOne, outName, startSession, type CheckContext, type Session } from '../../src/tools/doctor/doctor';
import { inspectPng, sniffImage } from '../../src/tools/doctor/images';
import { checkJson, rewriteRefs } from '../../src/tools/doctor/json';
import type { JavaVanilla, BedrockVanilla } from '../../src/tools/doctor/vanilla';
import type { IssueCode, DoctorTarget } from '../../src/tools/doctor/types';
import { loadJavaRenames } from '../../src/editions/convert/maps';
import { describePackForGame, validatePackSection } from '../../src/editions/java/packmeta';
import { KNOWN_RELEASE_FORMATS } from '../../src/editions/java/packformats';
import { isUuid } from '../../src/core/uuid';
import { solid } from '../tools/texlogic/fixtures';

const J = 'assets/minecraft/textures/';
const enc = new TextEncoder();
const dec = new TextDecoder();
type Spec = Record<string, Uint8Array | string | object>;
const bytes = (v: Uint8Array | string | object) => (v instanceof Uint8Array ? v : enc.encode(typeof v === 'string' ? v : JSON.stringify(v)));
const zip = (spec: Spec) => zipSync(Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, bytes(v)])));
const png = (w = 16, h = 16, c: [number, number, number, number] = [120, 80, 200, 255]) => encodePng(solid(w, h, c));
const MCMETA = { pack: { description: 'Test pack', min_format: [97, 1], max_format: 97 } };
const JAVA263: DoctorTarget = { edition: 'java', version: '26.3' };
const BEDROCK: DoctorTarget = { edition: 'bedrock', version: 'latest' };

const JAVA_VANILLA: JavaVanilla = {
  version: '26.3',
  files: new Set([
    `${J}block/stone.png`,
    `${J}block/dirt.png`,
    `${J}block/short_grass.png`,
    `${J}item/apple.png`,
    `${J}entity/chest/normal.png`,
    'assets/minecraft/models/block/cube_all.json',
    'assets/minecraft/models/block/block.json',
    'assets/minecraft/models/item/generated.json',
    'assets/minecraft/atlases/blocks.json',
    'assets/minecraft/atlases/items.json',
  ]),
  atlas: [
    { type: 'minecraft:directory', source: 'block', prefix: 'block/' },
    { type: 'minecraft:directory', source: 'item', prefix: 'item/' },
  ],
};
const BEDROCK_VANILLA: BedrockVanilla = (() => {
  const files = ['textures/blocks/stone.png', 'textures/blocks/dirt.png', 'textures/items/apple.png', 'textures/blocks/sea_lantern.png', 'textures/terrain_texture.json'];
  return { version: '1.26.50.4', files: new Set(files), lower: new Map(files.map((f) => [f.toLowerCase(), f])) };
})();

const renames = await loadJavaRenames();
const ctxFor = (target: DoctorTarget, extra: Partial<CheckContext> = {}): CheckContext => ({ target, renames, javaVanilla: JAVA_VANILLA, bedrockVanilla: BEDROCK_VANILLA, ...extra });

async function check(spec: Spec | Uint8Array, name = 'Test Pack.zip', target: DoctorTarget = JAVA263, extra: Partial<CheckContext> = {}): Promise<Session> {
  const archive = await openArchive(spec instanceof Uint8Array ? spec : zip(spec), name);
  return startSession(archive, ctxFor(target, extra));
}
const codes = (s: Session, which: 'before' | 'now' = 'now') => s[which].issues.map((i) => i.code);
const issue = (s: Session, code: IssueCode) => s.now.issues.find((i) => i.code === code);
const has = (s: Session, code: IssueCode) => codes(s).includes(code);
const serious = (s: Session) => s.now.issues.filter((i) => i.severity === 'error' || i.severity === 'broken').map((i) => `${i.code}`);
const fileText = (s: Session, path: string) => dec.decode(s.files!.get(path)!);
const fileJson = (s: Session, path: string) => JSON.parse(fileText(s, path));

/** Fixes everything safe, then reopens the downloaded zip and checks it again: nothing serious may be left. */
async function fixAndRecheck(s: Session): Promise<{ fixed: Session; again: Session; zip: Record<string, Uint8Array> }> {
  const fixed = await fixAll(s);
  const out = await buildFixed(fixed);
  const data = new Uint8Array(await out.blob.arrayBuffer());
  const again = await startSession(await openArchive(data, out.name), s.ctx);
  return { fixed, again, zip: unzipSync(data) };
}

const healthyJava = (): Spec => ({
  'pack.mcmeta': MCMETA,
  'pack.png': png(64, 64),
  [`${J}block/stone.png`]: png(),
  [`${J}block/sea_lantern.png`]: png(16, 64),
  [`${J}block/sea_lantern.png.mcmeta`]: { animation: { frametime: 5 } },
  'assets/minecraft/models/block/stone.json': { parent: 'minecraft:block/cube_all', textures: { all: 'minecraft:block/stone' } },
  'assets/minecraft/lang/en_us.json': { 'block.minecraft.stone': 'Rock' },
});

// ---------------------------------------------------------------------------------------------
// Healthy packs

test('a healthy Java pack looks good, and says what was checked', async () => {
  const s = await check(healthyJava());
  assert.deepEqual(codes(s), []);
  assert.ok(looksGood(s.now.issues));
  const checked = s.now.checked.map((c) => c.code);
  for (const c of ['zip', 'layout', 'mcmeta', 'format', 'folders', 'names', 'images', 'json', 'refs', 'animations'] as const) assert.ok(checked.includes(c), c);
  assert.equal(s.now.edition, 'java');
  assert.equal(s.now.description, 'Test pack');
  assert.equal(s.now.packVersion, '26.3');
  assert.equal(s.now.stats.textures, 2);
});

test('a healthy Bedrock pack looks good', async () => {
  const s = await check(healthyBedrock(), 'Phone Pack.mcpack', BEDROCK);
  assert.deepEqual(codes(s), []);
  assert.equal(s.now.name, 'Phone Pack');
  assert.ok(s.now.checked.some((c) => c.code === 'manifest'));
  assert.ok(s.now.checked.some((c) => c.code === 'texture-lists'));
});

// ---------------------------------------------------------------------------------------------
// Archive and layout

test('pack in an extra folder: found, reported, and taken out of it', async () => {
  const spec = Object.fromEntries(Object.entries(healthyJava()).map(([k, v]) => [`My Pack/${k}`, v]));
  const s = await check({ ...spec, 'README.txt': 'hello' });
  const i = issue(s, 'nested-folder')!;
  assert.equal(i.severity, 'error');
  assert.equal(i.params.folder, 'My Pack');
  const { fixed, again, zip: z } = await fixAndRecheck(s);
  assert.ok(z['pack.mcmeta'] && !Object.keys(z).some((k) => k.startsWith('My Pack/')));
  assert.ok(!z['README.txt'], 'files outside the pack stay out');
  assert.deepEqual(codes(again), []);
  assert.ok(fixed.changes.some((c) => c.code === 'extracted'));
});

test('pack zipped inside another zip', async () => {
  const inner = zip(healthyJava());
  const s = await check({ 'Cool Pack.zip': inner, 'Read me.txt': 'Install the zip inside' });
  assert.ok(has(s, 'nested-archive'));
  const { again } = await fixAndRecheck(s);
  assert.deepEqual(codes(again), []);
});

test('Mac junk files are reported and left out', async () => {
  const s = await check({ ...healthyJava(), '__MACOSX/._pack.mcmeta': 'x', '.DS_Store': 'x', 'assets/Thumbs.db': 'x' });
  assert.equal(issue(s, 'junk')!.count, 3);
  const { zip: z, again } = await fixAndRecheck(s);
  assert.ok(!Object.keys(z).some((k) => /MACOSX|DS_Store|Thumbs/.test(k)));
  assert.deepEqual(codes(again), []);
});

test('backslashes in zip entry names', async () => {
  const spec = Object.fromEntries(Object.entries(healthyJava()).map(([k, v]) => [k.replace(/\//g, '\\'), v]));
  const s = await check(spec);
  assert.equal(issue(s, 'zip-backslash')!.severity, 'error');
  const { zip: z, again } = await fixAndRecheck(s);
  assert.ok(z[`${J}block/stone.png`]);
  assert.deepEqual(codes(again), []);
});

test('entries packed with a compression method Minecraft can’t read', async () => {
  const z = zipSync({ 'pack.mcmeta': bytes(MCMETA), [`${J}block/stone.png`]: png() }, { level: 0 });
  // Mark the second entry as LZMA (method 14) in its local header and the central directory.
  const view = new DataView(z.buffer, z.byteOffset, z.byteLength);
  for (let o = 0; o < z.length - 4; o++) {
    const sig = view.getUint32(o, true);
    const nameAt = sig === 0x04034b50 ? o + 30 : sig === 0x02014b50 ? o + 46 : -1;
    if (nameAt < 0) continue;
    const nameLen = view.getUint16(sig === 0x04034b50 ? o + 26 : o + 28, true);
    if (dec.decode(z.subarray(nameAt, nameAt + nameLen)).endsWith('stone.png')) view.setUint16(o + (sig === 0x04034b50 ? 8 : 10), 14, true);
  }
  const s = await check(z);
  const i = issue(s, 'zip-method')!;
  assert.equal(i.params.reason, 'method');
  assert.deepEqual(i.files, [`${J}block/stone.png`]);
});

test('not a zip at all: RAR, damaged', async () => {
  const rar = await check(new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0, 0, 1, 2, 3]), 'pack.zip');
  assert.equal(issue(rar, 'zip-damaged')!.params.reason, 'rar');
  const cut = zip(healthyJava()).slice(0, 200);
  const damaged = await check(cut, 'pack.zip');
  assert.ok(has(damaged, 'zip-damaged'));
});

test('shader packs, data packs and other files are recognised', async () => {
  const shader = await check({ 'shaders/composite.fsh': 'void main(){}', 'shaders/shaders.properties': 'x=1', 'shaders/lang/en_us.lang': 'a=b' }, 'BSL.zip');
  assert.deepEqual(codes(shader), ['shader-pack']);
  const data = await check({ 'pack.mcmeta': { pack: { pack_format: 48, description: 'dp' } }, 'data/my/function/hello.mcfunction': 'say hi' }, 'dp.zip');
  assert.deepEqual(codes(data), ['data-pack']);
  const none = await check({ 'notes.txt': 'hello', 'image.png': png() }, 'stuff.zip');
  assert.deepEqual(codes(none), ['no-pack']);
});

test('several packs in one zip: the one for the chosen version is checked', async () => {
  const s = await check(
    {
      '1.8.9/pack.mcmeta': { pack: { pack_format: 1, description: 'old' } },
      '1.8.9/assets/minecraft/textures/blocks/stone.png': png(),
      '26.3/pack.mcmeta': MCMETA,
      '26.3/assets/minecraft/textures/block/stone.png': png(),
    },
    'Bundle.zip',
    { edition: 'java', version: '1.8.9' },
    { javaVanilla: null },
  );
  assert.equal(s.now.pick!.root, '1.8.9/');
  assert.ok(has(s, 'several-packs'));
  assert.ok(has(s, 'nested-folder'));
  assert.ok(!has(s, 'format-mismatch'));
});

test('a folder dropped as it is (the folder is the pack)', async () => {
  const list = Object.entries(healthyJava()).map(([path, v]) => ({ path, file: new Blob([bytes(v) as Uint8Array<ArrayBuffer>]) }));
  const archive = await openFolder(list, 'My Pack');
  const s = await startSession(archive, ctxFor(JAVA263));
  assert.deepEqual(codes(s), []);
});

test('file extensions: a Java pack named .mcpack, a Bedrock pack named .zip', async () => {
  const j = await check(healthyJava(), 'Java Pack.mcpack');
  assert.ok(has(j, 'java-mcpack'));
  assert.equal(outName(j), 'Java Pack.zip');
  const b = await check(healthyBedrock(), 'Phone Pack.zip', BEDROCK);
  assert.equal(issue(b, 'bedrock-zip')!.severity, 'warning');
  assert.equal(outName(b), 'Phone Pack.mcpack');
});

test('a Java pack checked for Bedrock (and back) points to the converter', async () => {
  const s = await check(healthyJava(), 'Java Pack.zip', BEDROCK);
  const i = issue(s, 'wrong-edition')!;
  assert.equal(i.params.pack, 'java');
  assert.equal(i.link, 'converter');
  const b = await check(healthyBedrock(), 'Phone.mcpack', JAVA263);
  assert.equal(issue(b, 'wrong-edition')!.params.pack, 'bedrock');
});

// ---------------------------------------------------------------------------------------------
// pack.mcmeta

test('missing pack.mcmeta: created for the chosen version', async () => {
  const spec = healthyJava();
  delete spec['pack.mcmeta'];
  const s = await check(spec, 'No Meta.zip');
  assert.equal(issue(s, 'mcmeta-missing')!.severity, 'error');
  const { fixed, again } = await fixAndRecheck(s);
  const meta = fileJson(fixed, 'pack.mcmeta');
  assert.deepEqual(meta.pack.min_format, [97, 1]);
  assert.equal(meta.pack.max_format, 97);
  assert.equal(meta.pack.description, 'No Meta');
  assert.deepEqual(codes(again), []);
});

test('pack.mcmeta under the wrong name (Windows hid ".txt")', async () => {
  const spec = healthyJava();
  spec['pack.mcmeta.txt'] = spec['pack.mcmeta'];
  delete spec['pack.mcmeta'];
  const s = await check(spec);
  assert.equal(issue(s, 'mcmeta-name')!.params.file, 'pack.mcmeta.txt');
  const { again } = await fixAndRecheck(s);
  assert.deepEqual(codes(again), []);
});

test('pack.mcmeta that is not valid JSON keeps its description when rebuilt', async () => {
  const s = await check({ ...healthyJava(), 'pack.mcmeta': '{ "pack": { "pack_format": 97, "description": "My \\"best\\" pack" ' });
  const i = issue(s, 'mcmeta-json')!;
  assert.equal(i.severity, 'error');
  assert.match(i.detail!, /^1:\d+ /);
  const { fixed, again } = await fixAndRecheck(s);
  assert.equal(fileJson(fixed, 'pack.mcmeta').pack.description, 'My "best" pack');
  assert.deepEqual(codes(again), []);
});

test('pack.mcmeta with a byte order mark or comments', async () => {
  const bom = await check({ ...healthyJava(), 'pack.mcmeta': `﻿${JSON.stringify(MCMETA)}` });
  assert.equal(issue(bom, 'mcmeta-strict')!.params.reason, 'bom');
  const comments = await check({ ...healthyJava(), 'pack.mcmeta': `{ // my pack\n "pack": { "description": "x", "min_format": [97, 1], "max_format": 97, } }` });
  assert.equal(issue(comments, 'mcmeta-strict')!.params.reason, 'comments');
  const { fixed, again } = await fixAndRecheck(bom);
  assert.notEqual(fixed.files!.get('pack.mcmeta')![0], 0xef);
  assert.deepEqual(codes(again), []);
});

test('pack.mcmeta the 1.21.9+ rules refuse: the game’s reason is shown', async () => {
  const s = await check({ ...healthyJava(), 'pack.mcmeta': { pack: { pack_format: 70, description: 'x' } } });
  const i = issue(s, 'mcmeta-invalid')!;
  assert.match(i.detail!, /min_format and max_format/);
  assert.deepEqual(i.affects, { edition: 'java', kind: 'from', from: '1.21.9' });
  const noDescription = await check({ ...healthyJava(), 'pack.mcmeta': { pack: { min_format: 97, max_format: 97 } } });
  assert.equal(issue(noDescription, 'mcmeta-invalid')!.detail, 'No key description');
  const { again } = await fixAndRecheck(s);
  assert.deepEqual(codes(again), []);
});

test('a pack made for another version: pack.mcmeta updated, keeping the range when the textures suit both', async () => {
  const s = await check({ ...healthyJava(), 'pack.mcmeta': { pack: { pack_format: 34, description: '1.21 pack' } } });
  const i = issue(s, 'format-mismatch')!;
  assert.equal(i.severity, 'broken');
  assert.equal(i.params.direction, 'old');
  assert.equal(i.params.packVersions, '1.21 – 1.21.1');
  const { fixed, again } = await fixAndRecheck(s);
  const pack = fileJson(fixed, 'pack.mcmeta').pack;
  assert.doesNotThrow(() => validatePackSection(pack));
  const text = fileText(fixed, 'pack.mcmeta');
  assert.equal(describePackForGame(text, KNOWN_RELEASE_FORMATS['26.3']), 'compatible');
  assert.equal(describePackForGame(text, KNOWN_RELEASE_FORMATS['1.21']), 'compatible', 'still works on 1.21');
  assert.equal(pack.description, '1.21 pack');
  assert.deepEqual(codes(again), []);
});

test('a newer pack checked for an older version', async () => {
  const s = await check({ ...healthyJava(), 'pack.mcmeta': { pack: { pack_format: 34, description: 'x' } } }, 'p.zip', { edition: 'java', version: '1.20.1' }, { javaVanilla: null });
  assert.equal(issue(s, 'format-mismatch')!.params.direction, 'new');
  // A 1.21.9+ pack.mcmeta (no pack_format) can't be read by 1.20.1 at all.
  const modern = await check(healthyJava(), 'p.zip', { edition: 'java', version: '1.20.1' }, { javaVanilla: null });
  assert.equal(issue(modern, 'mcmeta-invalid')!.severity, 'error');
  const { again } = await fixAndRecheck(modern);
  assert.ok(!has(again, 'mcmeta-invalid'));
});

// ---------------------------------------------------------------------------------------------
// Texture names and folders

test('pre-1.13 folders on a new version: renamed, with the models that use them', async () => {
  const s = await check({
    'pack.mcmeta': { pack: { pack_format: 3, description: 'Old school' } },
    [`${J}blocks/stone.png`]: png(),
    [`${J}blocks/tallgrass.png`]: png(),
    [`${J}blocks/sea_lantern.png`]: png(16, 80),
    [`${J}blocks/sea_lantern.png.mcmeta`]: { animation: { frametime: 7 } },
    [`${J}items/apple.png`]: png(),
    'assets/minecraft/models/block/stone.json': { parent: 'block/cube_all', textures: { all: 'blocks/stone' } },
  });
  assert.deepEqual(issue(s, 'old-folders')!.affects, { edition: 'java', kind: 'from', from: '1.13' });
  assert.equal(issue(s, 'old-folders')!.count, 4);
  assert.ok(has(s, 'format-mismatch'));
  const { fixed, again, zip: z } = await fixAndRecheck(s);
  assert.ok(z[`${J}block/stone.png`] && z[`${J}block/short_grass.png`] && z[`${J}item/apple.png`]);
  assert.ok(z[`${J}block/sea_lantern.png.mcmeta`], 'the animation goes with its texture');
  assert.ok(!Object.keys(z).some((k) => k.startsWith(`${J}blocks/`)));
  assert.equal(fileJson(fixed, 'assets/minecraft/models/block/stone.json').textures.all, 'block/stone');
  const meta = fileJson(fixed, 'pack.mcmeta').pack;
  assert.deepEqual([meta.min_format, meta.max_format], [[97, 1], 97], 'no range back to 1.12: the names changed');
  assert.deepEqual(serious(again), []);
});

test('1.13+ folders on an old version', async () => {
  const s = await check({ 'pack.mcmeta': { pack: { pack_format: 3, description: 'x' } }, [`${J}block/stone.png`]: png(), [`${J}block/short_grass.png`]: png() }, 'p.zip', { edition: 'java', version: '1.12.2' }, { javaVanilla: null });
  assert.ok(has(s, 'new-folders'));
  const { zip: z, again } = await fixAndRecheck(s);
  assert.ok(z[`${J}blocks/stone.png`] && z[`${J}blocks/tallgrass.png`]);
  assert.deepEqual(serious(again), []);
});

test('textures renamed in a later version (grass → short_grass in 1.20.3)', async () => {
  const s = await check({ 'pack.mcmeta': { pack: { pack_format: 15, description: 'x' } }, [`${J}block/grass.png`]: png() });
  const i = issue(s, 'renamed-textures')!;
  assert.equal(i.params.from, '1.20.1');
  const { zip: z } = await fixAndRecheck(s);
  assert.ok(z[`${J}block/short_grass.png`] && !z[`${J}block/grass.png`]);
});

test('capital letters and spaces in file names', async () => {
  const s = await check({
    ...healthyJava(),
    [`${J}block/Dirt.png`]: png(),
    [`${J}block/my stone.png`]: png(),
    'assets/minecraft/models/block/custom.json': { parent: 'block/cube_all', textures: { all: 'block/my stone' } },
  });
  const i = issue(s, 'bad-names')!;
  assert.equal(i.count, 2);
  assert.deepEqual(i.affects, { edition: 'java', kind: 'from', from: '1.11' });
  const { fixed, zip: z, again } = await fixAndRecheck(s);
  assert.ok(z[`${J}block/dirt.png`] && z[`${J}block/my_stone.png`]);
  assert.equal(fileJson(fixed, 'assets/minecraft/models/block/custom.json').textures.all, 'block/my_stone');
  assert.deepEqual(serious(again), []);
});

test('textures outside assets/minecraft/textures', async () => {
  const s = await check({ 'pack.mcmeta': MCMETA, 'assets/textures/block/stone.png': png(), 'assets/minecraft/item/apple.png': png() });
  assert.equal(issue(s, 'misplaced-textures')!.count, 2);
  const { zip: z } = await fixAndRecheck(s);
  assert.ok(z[`${J}block/stone.png`] && z[`${J}item/apple.png`]);
});

// ---------------------------------------------------------------------------------------------
// JSON and references

test('JSON syntax errors: broken files are listed with the line; comments and trailing commas are cleaned', async () => {
  const s = await check({
    ...healthyJava(),
    'assets/minecraft/models/block/dirt.json': '{\n  "parent": "block/cube_all",\n  "textures": { "all": "block/dirt" \n',
    'assets/minecraft/sounds.json': '{ "block.stone.break": { "sounds": ["a"], }, }',
  });
  const bad = issue(s, 'json-syntax')!;
  assert.deepEqual(bad.files, ['assets/minecraft/models/block/dirt.json']);
  assert.match(bad.detail!, /dirt\.json \d+:\d+/);
  assert.ok(!bad.fix);
  const strict = issue(s, 'json-strict')!;
  assert.deepEqual(strict.files, ['assets/minecraft/sounds.json']);
  const { fixed } = await fixAndRecheck(s);
  assert.deepEqual(fileJson(fixed, 'assets/minecraft/sounds.json'), { 'block.stone.break': { sounds: ['a'] } });
});

test('references to textures and models that don’t exist', async () => {
  const s = await check({
    ...healthyJava(),
    'assets/minecraft/models/block/odd.json': { parent: 'block/not_a_model', textures: { all: 'block/not_a_texture', side: '#all', top: 'block/stone' } },
    'assets/minecraft/blockstates/odd.json': { variants: { '': { model: 'block/also_missing' } } },
  });
  assert.deepEqual(issue(s, 'missing-texture-ref')!.files, ['assets/minecraft/models/block/odd.json → block/not_a_texture']);
  assert.equal(issue(s, 'missing-model-ref')!.count, 2);
  // Without the game's file list, vanilla references can't be checked: nothing is reported.
  const offline = await check({ ...healthyJava(), 'assets/minecraft/models/block/odd.json': { textures: { all: 'block/not_a_texture' } } }, 'p.zip', JAVA263, { javaVanilla: null });
  assert.ok(!has(offline, 'missing-texture-ref'));
  assert.equal(offline.now.vanillaChecked, false);
});

test('old texture names in a model are pointed at the new ones', async () => {
  const s = await check({ ...healthyJava(), 'assets/minecraft/models/block/dirt.json': { parent: 'block/cube_all', textures: { all: 'block/grass' } } });
  const i = issue(s, 'missing-texture-ref')!;
  assert.ok(i.fix);
  const { fixed } = await fixAndRecheck(s);
  assert.equal(fileJson(fixed, 'assets/minecraft/models/block/dirt.json').textures.all, 'block/short_grass');
});

test('1.19.3+: textures of a model outside the block and item atlases', async () => {
  const s = await check({
    ...healthyJava(),
    [`${J}custom/thing.png`]: png(),
    'assets/minecraft/models/block/thing.json': { parent: 'block/cube_all', textures: { all: 'minecraft:custom/thing' } },
    'assets/minecraft/models/block/chest_like.json': { textures: { all: 'entity/chest/normal' } },
  });
  const i = issue(s, 'atlas-missing')!;
  assert.equal(i.params.folders, 'custom, entity/chest');
  const { fixed, again } = await fixAndRecheck(s);
  const blocks = fileJson(fixed, 'assets/minecraft/atlases/blocks.json');
  assert.deepEqual(blocks.sources[0], { type: 'minecraft:directory', source: 'custom', prefix: 'custom/' });
  assert.ok(fixed.files!.has('assets/minecraft/atlases/items.json'));
  assert.ok(!has(again, 'atlas-missing'));
});

test('reference rewriting keeps the style of each reference', () => {
  const model = { parent: 'block/cube', textures: { a: 'blocks/stone', b: 'minecraft:blocks/stone', c: '#a', d: { sprite: 'blocks/stone' } } };
  const changed = rewriteRefs('model', model, new Map([['minecraft:blocks/stone', 'minecraft:block/stone']]), new Map([['minecraft:block/cube', 'minecraft:block/cube_all']]));
  assert.ok(changed);
  assert.deepEqual(model, { parent: 'block/cube_all', textures: { a: 'block/stone', b: 'minecraft:block/stone', c: '#a', d: { sprite: 'block/stone' } } });
});

// ---------------------------------------------------------------------------------------------
// Images, animations, sounds

test('animated texture without its .mcmeta: offered, not applied by Fix all', async () => {
  const s = await check({ ...healthyJava(), [`${J}block/magma.png`]: png(16, 48) });
  const i = issue(s, 'anim-strip')!;
  assert.equal(i.fix!.safe, false);
  const all = await fixAll(s);
  assert.equal(all.files, null, 'nothing safe to do');
  const one = await fixOne(s, i);
  assert.deepEqual(JSON.parse(dec.decode(one.files!.get(`${J}block/magma.png.mcmeta`)!)), { animation: { frametime: 2 } });
  assert.ok(!has(one, 'anim-strip'));
});

test('animation frames that don’t fit the image, and frame numbers that don’t exist', async () => {
  const s = await check({
    ...healthyJava(),
    [`${J}block/lava.png`]: png(16, 40),
    [`${J}block/lava.png.mcmeta`]: { animation: {} },
    [`${J}block/prismarine.png`]: png(16, 32),
    [`${J}block/prismarine.png.mcmeta`]: { animation: { frametime: 0, frames: [0, 1, 5] } },
  });
  assert.ok(issue(s, 'anim-size')!.files[0].startsWith(`${J}block/lava.png`));
  const frames = issue(s, 'anim-frames')!;
  assert.equal(frames.severity, 'warning');
  const { fixed } = await fixAndRecheck(s);
  assert.deepEqual(fileJson(fixed, `${J}block/prismarine.png.mcmeta`).animation, { frametime: 1, frames: [0, 1] });
});

test('images that are not PNGs, broken PNGs, 16-bit PNGs, sizes that are not powers of two', async () => {
  const tga = encodeTga(solid(16, 16, [10, 200, 10, 255]));
  const sixteen = encodePngRaw({ width: 16, height: 16, data: new Uint16Array(16 * 16 * 4).fill(40000), channels: 4, depth: 16 });
  const s = await check({
    ...healthyJava(),
    [`${J}block/dirt.png`]: tga,
    [`${J}block/gravel.tga`]: tga,
    [`${J}block/sand.png`]: png().slice(0, 50),
    [`${J}block/clay.png`]: sixteen,
    [`${J}block/odd.png`]: png(20, 20),
  });
  assert.deepEqual(issue(s, 'not-png')!.files, [`${J}block/dirt.png`]);
  assert.deepEqual(issue(s, 'wrong-image-type')!.files, [`${J}block/gravel.tga`]);
  assert.deepEqual(issue(s, 'broken-image')!.files, [`${J}block/sand.png`]);
  assert.deepEqual(issue(s, 'png-format')!.files, [`${J}block/clay.png`]);
  assert.match(issue(s, 'not-power-of-two')!.files[0], /odd\.png \(20×20\)/);
  const { zip: z, again } = await fixAndRecheck(s);
  assert.equal(sniffImage(z[`${J}block/dirt.png`]), 'png');
  assert.ok(z[`${J}block/gravel.png`] && !z[`${J}block/gravel.tga`]);
  assert.equal(inspectPng(z[`${J}block/clay.png`]).bitDepth, 8);
  assert.deepEqual(codes(again).sort(), ['broken-image', 'not-power-of-two']);
});

test('sounds that are not Ogg Vorbis', async () => {
  const s = await check({ ...healthyJava(), 'assets/minecraft/sounds/dig/stone1.ogg': 'ID3 not ogg', 'assets/minecraft/sounds/custom.mp3': 'ID3', 'assets/minecraft/sounds/good.ogg': 'OggS....' });
  assert.equal(issue(s, 'sound-format')!.count, 2);
});

test('OptiFine files and core shaders are noted', async () => {
  const s = await check({ ...healthyJava(), 'assets/minecraft/optifine/ctm/glass/1.png': png(), 'assets/minecraft/shaders/core/rendertype_solid.fsh': 'x' });
  assert.equal(issue(s, 'optifine')!.severity, 'info');
  assert.equal(issue(s, 'core-shaders')!.severity, 'warning');
});

// ---------------------------------------------------------------------------------------------
// Bedrock

const HEADER = '8f0b5a0e-6c55-4d3b-9b1e-0a4c2f9d7e11';
const MODULE = '2a6d8c1b-3f4e-4a5b-8c7d-9e0f1a2b3c4d';
const manifest = (over: Record<string, unknown> = {}, header: Record<string, unknown> = {}) => ({
  format_version: 2,
  header: { name: 'Phone Pack', description: 'for phones', uuid: HEADER, version: [1, 0, 0], min_engine_version: [1, 21, 0], ...header },
  modules: [{ type: 'resources', uuid: MODULE, version: [1, 0, 0] }],
  ...over,
});
function healthyBedrock(): Spec {
  return {
    'manifest.json': manifest(),
    'pack_icon.png': png(64, 64),
    'textures/blocks/stone.png': png(),
    'textures/blocks/phone_block.png': png(),
    'textures/terrain_texture.json': { resource_pack_name: 'vanilla', texture_name: 'atlas.terrain', texture_data: { phone_block: { textures: 'textures/blocks/phone_block' }, stone: { textures: ['textures/blocks/stone'] } } },
    'texts/en_US.lang': 'pack.name=Phone Pack\n',
  };
}

test('Bedrock: missing manifest.json is created', async () => {
  const spec = healthyBedrock();
  delete spec['manifest.json'];
  const s = await check(spec, 'No Manifest.mcpack', BEDROCK);
  assert.ok(has(s, 'manifest-missing'));
  const { fixed, again } = await fixAndRecheck(s);
  const m = fileJson(fixed, 'manifest.json');
  assert.equal(m.header.name, 'No Manifest');
  assert.ok(isUuid(m.header.uuid) && isUuid(m.modules[0].uuid) && m.header.uuid !== m.modules[0].uuid);
  assert.deepEqual(codes(again), []);
});

test('Bedrock: manifest problems (format, UUIDs, module type, engine version) are repaired', async () => {
  const s = await check(
    { ...healthyBedrock(), 'manifest.json': manifest({ format_version: 5, modules: [{ type: 'resource', uuid: HEADER, version: [1, 0, 0] }] }, { min_engine_version: [1, 99, 0] }) },
    'Phone.mcpack',
    BEDROCK,
  );
  for (const c of ['manifest-format', 'manifest-modules', 'manifest-uuid', 'manifest-engine'] as IssueCode[]) assert.ok(has(s, c), c);
  assert.equal(issue(s, 'manifest-uuid')!.params.reason, 'same');
  assert.equal(issue(s, 'manifest-engine')!.params.reason, 'new');
  const { fixed, again } = await fixAndRecheck(s);
  const m = fileJson(fixed, 'manifest.json');
  assert.equal(m.format_version, 2);
  assert.equal(m.header.uuid, HEADER, 'the pack keeps its own header uuid');
  assert.equal(m.modules[0].type, 'resources');
  assert.notEqual(m.modules[0].uuid, HEADER);
  assert.deepEqual(m.header.min_engine_version, [1, 21, 0]);
  assert.deepEqual(codes(again), []);
});

test('Bedrock: manifest.json that is not JSON keeps the name and UUID it still has', async () => {
  const s = await check({ ...healthyBedrock(), 'manifest.json': `{ "format_version": 2, "header": { "name": "Salvaged", "uuid": "${HEADER}", "version": [1,0,0] ` }, 'p.mcpack', BEDROCK);
  assert.ok(has(s, 'manifest-json'));
  const { fixed, again } = await fixAndRecheck(s);
  const m = fileJson(fixed, 'manifest.json');
  assert.equal(m.header.name, 'Salvaged');
  assert.equal(m.header.uuid, HEADER);
  assert.deepEqual(codes(again), []);
});

test('Bedrock: two packs with the same UUID (a copied pack)', async () => {
  const copy = { ...healthyBedrock(), 'manifest.json': manifest({}, { name: 'Phone Pack copy' }) };
  const addon = zipSync({ 'Phone Pack.mcpack': zip(healthyBedrock()), 'Phone Pack copy.mcpack': zip(copy) });
  const s = await check(addon, 'Packs.mcaddon', BEDROCK);
  const i = issue(s, 'duplicate-uuid')!;
  assert.equal(i.severity, 'error');
  const { fixed, again } = await fixAndRecheck(s);
  assert.notEqual(fileJson(fixed, 'manifest.json').header.uuid, HEADER);
  assert.deepEqual(serious(again), []);
});

test('Bedrock: the same UUID as another pack checked before on this device', async () => {
  const s = await check(healthyBedrock(), 'My Copy.mcpack', BEDROCK, { knownUuids: { [HEADER]: 'Original Pack' } });
  const i = issue(s, 'known-uuid')!;
  assert.equal(i.params.other, 'Original Pack');
  assert.equal(i.fix!.safe, false);
  const fixed = await fixOne(s, i);
  assert.notEqual(JSON.parse(dec.decode(fixed.files!.get('manifest.json')!)).header.uuid, HEADER);
  // The same pack checked again is not a copy.
  const again = await check(healthyBedrock(), 'Phone Pack.mcpack', BEDROCK, { knownUuids: { [HEADER]: 'Phone Pack' } });
  assert.ok(!has(again, 'known-uuid'));
});

test('Bedrock: texture lists with errors, missing textures and letters in the wrong case', async () => {
  const s = await check(
    {
      ...healthyBedrock(),
      'textures/blocks/Dirt.png': png(),
      'textures/terrain_texture.json': { texture_data: { a: { textures: 'textures/blocks/PHONE_BLOCK' }, b: { textures: 'textures/blocks/nothing_here' }, c: { textures: ['textures/blocks/dirt'] } } },
      'textures/item_texture.json': { resource_pack_name: 'vanilla' },
    },
    'p.mcpack',
    BEDROCK,
  );
  assert.deepEqual(issue(s, 'texture-list')!.files, ['textures/item_texture.json']);
  assert.deepEqual(issue(s, 'bedrock-missing-ref')!.files, ['textures/terrain_texture.json → textures/blocks/nothing_here']);
  const cases = s.now.issues.filter((i) => i.code === 'bedrock-case');
  assert.deepEqual(cases.map((i) => i.params.what).sort(), ['files', 'refs']);
  assert.deepEqual(cases[0].affects.kind, 'mobile');
  const { fixed, again } = await fixAndRecheck(s);
  assert.ok(fixed.files!.has('textures/blocks/dirt.png'));
  assert.equal(fileJson(fixed, 'textures/terrain_texture.json').texture_data.a.textures, 'textures/blocks/phone_block');
  assert.ok(!again.now.issues.some((i) => i.code === 'bedrock-case'));
});

test('Bedrock: Java textures inside, .png and .tga twins, long paths, material.bin', async () => {
  const s = await check(
    {
      ...healthyBedrock(),
      [`${J}block/stone.png`]: png(),
      'textures/blocks/stone.tga': encodeTga(solid(16, 16, [1, 2, 3, 255])),
      [`textures/blocks/${'x'.repeat(80)}.png`]: png(),
      'renderer/materials/RenderChunk.material.bin': 'x',
    },
    'p.mcpack',
    BEDROCK,
  );
  for (const c of ['java-in-bedrock', 'tga-png-pair', 'long-paths', 'material-bin'] as IssueCode[]) assert.ok(has(s, c), c);
});

test('Bedrock: a language key as the pack name with no language file', async () => {
  const spec = healthyBedrock();
  delete spec['texts/en_US.lang'];
  spec['manifest.json'] = manifest({}, { name: 'pack.name', description: 'pack.description' });
  const s = await check(spec, 'Keyed.mcpack', BEDROCK);
  assert.ok(has(s, 'pack-name-key'));
  const { fixed } = await fixAndRecheck(s);
  assert.equal(fileJson(fixed, 'manifest.json').header.name, 'Keyed');
});

// ---------------------------------------------------------------------------------------------
// Everything at once, and the helpers

test('a badly broken Java pack: Fix all leaves nothing serious, and the result opens again', async () => {
  const s = await check(
    {
      'Broken Pack/pack.mcmeta': '{ "pack": { "pack_format": 3, "description": "Broken" }, }',
      'Broken Pack/assets/minecraft/textures/blocks/stone.png': png(),
      'Broken Pack/assets/minecraft/textures/blocks/Dirt.png': png(),
      'Broken Pack/assets/minecraft/models/block/stone.json': { parent: 'block/cube_all', textures: { all: 'blocks/stone' } },
      '__MACOSX/Broken Pack/._pack.mcmeta': 'x',
    },
    'Broken Pack.mcpack',
  );
  assert.ok(codes(s).length >= 5, codes(s).join());
  const { fixed, again, zip: z } = await fixAndRecheck(s);
  assert.deepEqual(serious(again), []);
  assert.ok(z['pack.mcmeta'] && z[`${J}block/stone.png`] && z[`${J}block/dirt.png`]);
  assert.ok(fixed.changes.length >= 4, JSON.stringify(fixed.changes));
  assert.equal(outName(fixed), 'Broken Pack.zip');
});

test('helpers: base names, JSON positions, PNG inspection, rebuilt files', () => {
  assert.equal(baseNameOf('Cool Pack (1).mcpack.zip'), 'Cool Pack');
  assert.equal(baseNameOf('x.zip'), 'x');
  const bad = checkJson('{\n  "a": 1\n  "b": 2\n}');
  assert.equal(bad.status, 'invalid');
  if (bad.status === 'invalid') assert.equal(bad.line, 3);
  assert.equal(checkJson('{"a":1,}').status, 'strict');
  assert.equal(inspectPng(png()).problem, null);
  assert.equal(inspectPng(png().slice(0, 40)).problem, 'truncated');
  const meta = JSON.parse(rebuiltMcmeta({ pack: { pack_format: 3, description: { text: 'Hi', color: 'red' } }, language: { x: {} } }, 'fallback', KNOWN_RELEASE_FORMATS['26.3'], null));
  assert.deepEqual(meta.pack.description, { text: 'Hi', color: 'red' });
  assert.ok(meta.language);
  const man = JSON.parse(repairedManifest({ header: { name: 'A', uuid: HEADER, version: '1.2.3' }, format_version: 3, modules: [{ type: 'resources', version: '1.2.3' }] }, 'B'));
  assert.equal(man.format_version, 3);
  assert.equal(man.header.version, '1.2.3');
  assert.ok(isUuid(man.modules[0].uuid));
});

/** The same zip with ZIP64 end records (what some zip tools write for big archives). */
function asZip64(z: Uint8Array): Uint8Array {
  const dv = new DataView(z.buffer, z.byteOffset, z.byteLength);
  const eocd = z.length - 22;
  assert.equal(dv.getUint32(eocd, true), 0x06054b50);
  const count = dv.getUint16(eocd + 10, true);
  const cdSize = dv.getUint32(eocd + 12, true);
  const cdOffset = dv.getUint32(eocd + 16, true);
  const out = new Uint8Array(eocd + 56 + 20 + 22);
  out.set(z.subarray(0, eocd));
  const o = new DataView(out.buffer);
  let p = eocd;
  o.setUint32(p, 0x06064b50, true);
  o.setBigUint64(p + 4, 44n, true);
  o.setUint16(p + 12, 45, true);
  o.setUint16(p + 14, 45, true);
  o.setBigUint64(p + 24, BigInt(count), true);
  o.setBigUint64(p + 32, BigInt(count), true);
  o.setBigUint64(p + 40, BigInt(cdSize), true);
  o.setBigUint64(p + 48, BigInt(cdOffset), true);
  p += 56;
  o.setUint32(p, 0x07064b50, true);
  o.setBigUint64(p + 8, BigInt(eocd), true);
  o.setUint32(p + 16, 1, true);
  p += 20;
  o.setUint32(p, 0x06054b50, true);
  o.setUint16(p + 8, 0xffff, true);
  o.setUint16(p + 10, 0xffff, true);
  o.setUint32(p + 12, 0xffffffff, true);
  o.setUint32(p + 16, 0xffffffff, true);
  return out;
}

test('Bedrock: a ZIP64 archive is written again as a standard zip', async () => {
  const s = await check(asZip64(zip(healthyBedrock())), 'Phone Pack.mcpack', BEDROCK);
  const i = issue(s, 'zip64')!;
  assert.equal(i.severity, 'warning');
  assert.equal(i.affects.kind, 'some');
  const { again } = await fixAndRecheck(s);
  assert.deepEqual(codes(again), []);
});

test('Bedrock: behavior packs, skin packs and world templates are recognised', async () => {
  const kinds: [string, string][] = [
    ['data', 'behavior'],
    ['skin_pack', 'skin'],
    ['world_template', 'world'],
  ];
  for (const [type, kind] of kinds) {
    const s = await check({ 'manifest.json': manifest({ modules: [{ type, uuid: MODULE, version: [1, 0, 0] }] }) }, `${kind}.mcpack`, BEDROCK);
    assert.deepEqual(codes(s), ['other-bedrock-pack'], kind);
    assert.equal(issue(s, 'other-bedrock-pack')!.params.type, kind);
    assert.equal(issue(s, 'other-bedrock-pack')!.link, kind === 'skin' ? 'skins' : 'bedrock-packs');
  }
});

test('Bedrock: manifest.json under the wrong name is renamed', async () => {
  const spec = healthyBedrock();
  spec['Manifest.json.txt'] = spec['manifest.json'];
  delete spec['manifest.json'];
  const s = await check(spec, 'Phone Pack.mcpack', BEDROCK);
  const i = issue(s, 'manifest-name')!;
  assert.equal(i.params.file, 'Manifest.json.txt');
  const { zip: z, again } = await fixAndRecheck(s);
  assert.ok(z['manifest.json'] && !z['Manifest.json.txt']);
  assert.deepEqual(codes(again), []);
});

test('Bedrock: a manifest without a header, with a bad version or without a name is repaired', async () => {
  const noHeader = await check({ ...healthyBedrock(), 'manifest.json': { format_version: 2, modules: [{ type: 'resources', uuid: MODULE, version: [1, 0, 0] }] } }, 'Phone Pack.mcpack', BEDROCK);
  assert.equal(issue(noHeader, 'manifest-header')!.params.reason, 'missing');
  const fixedHeader = await fixAndRecheck(noHeader);
  const m = fileJson(fixedHeader.fixed, 'manifest.json');
  assert.ok(isUuid(m.header.uuid) && m.header.uuid !== m.modules[0].uuid);
  assert.equal(m.modules[0].uuid, MODULE, 'the module keeps its uuid');
  assert.deepEqual(serious(fixedHeader.again), []);

  const badVersion = await check({ ...healthyBedrock(), 'manifest.json': manifest({}, { version: '1.0' }) }, 'Phone Pack.mcpack', BEDROCK);
  assert.equal(issue(badVersion, 'manifest-header')!.params.reason, 'version');
  const v = await fixAndRecheck(badVersion);
  assert.ok(Array.isArray(fileJson(v.fixed, 'manifest.json').header.version));
  assert.deepEqual(codes(v.again), []);

  const noName = await check({ ...healthyBedrock(), 'manifest.json': manifest({}, { name: '  ' }) }, 'Nameless.mcpack', BEDROCK);
  assert.equal(issue(noName, 'manifest-header')!.params.reason, 'name');
  const n = await fixAndRecheck(noName);
  assert.equal(fileJson(n.fixed, 'manifest.json').header.name, 'Nameless');
  assert.deepEqual(codes(n.again), []);
});

test('Bedrock: sub-packs whose folders are missing', async () => {
  const s = await check(
    { ...healthyBedrock(), 'manifest.json': manifest({ subpacks: [{ folder_name: 'low', name: 'Low', memory_tier: 0 }, { folder_name: 'high', name: 'High', memory_tier: 1 }] }), 'subpacks/low/textures/blocks/stone.png': png() },
    'Phone Pack.mcpack',
    BEDROCK,
  );
  const i = issue(s, 'subpack-missing')!;
  assert.equal(i.severity, 'broken');
  assert.deepEqual(i.files, ['subpacks/high/']);
  assert.equal(i.fix, undefined, 'only the pack’s author knows what belongs there');
});

test('Java: overlay folders listed in pack.mcmeta that are not in the pack', async () => {
  const s = await check({
    ...healthyJava(),
    'pack.mcmeta': { ...MCMETA, overlays: { entries: [{ formats: [80, 97], directory: 'overlay_new' }, { formats: [34, 48], directory: 'overlay_old' }] } },
    'overlay_new/assets/minecraft/textures/block/stone.png': png(),
  });
  const i = issue(s, 'overlay-missing')!;
  assert.equal(i.severity, 'warning');
  assert.deepEqual(i.files, ['overlay_old']);
});

test('pack icons that are not working PNGs', async () => {
  const tga = encodeTga(solid(64, 64, [10, 200, 10, 255]));
  const s = await check({ ...healthyJava(), 'pack.png': tga });
  const i = issue(s, 'pack-icon')!;
  assert.equal(i.params.file, 'pack.png');
  assert.ok(i.fix?.safe);
  const { zip: z, again } = await fixAndRecheck(s);
  assert.equal(sniffImage(z['pack.png']), 'png');
  assert.deepEqual(codes(again), []);
  const broken = await check({ ...healthyBedrock(), 'pack_icon.png': png(64, 64).slice(0, 60) }, 'Phone Pack.mcpack', BEDROCK);
  const b = issue(broken, 'pack-icon')!;
  assert.equal(b.params.file, 'pack_icon.png');
  assert.equal(b.fix, undefined, 'a damaged icon can only be replaced');
});

test('what changed: a file renamed in two rounds counts once, updated files once', async () => {
  const s = await check({
    'pack.mcmeta': { pack: { pack_format: 3, description: 'Old' } },
    [`${J}blocks/Dirt.png`]: png(),
    [`${J}blocks/stone.png`]: png(),
    'assets/minecraft/models/block/stone.json': { parent: 'block/cube_all', textures: { all: 'blocks/stone' } },
  });
  const fixed = await fixAll(s);
  const renamed = fixed.changes.filter((c) => c.code === 'renamed');
  assert.equal(renamed.length, 1, JSON.stringify(fixed.changes));
  assert.equal(renamed[0].count, 2, JSON.stringify(fixed.changes));
  assert.ok(fixed.files!.has(`${J}block/dirt.png`) && fixed.files!.has(`${J}block/stone.png`));
  const refs = fixed.changes.filter((c) => c.code === 'refs');
  assert.ok(refs.length <= 1 && (refs[0]?.count ?? 1) === 1, JSON.stringify(refs));
  // Fixing again from a session leaves the earlier session's list as it was.
  const before = JSON.stringify(fixed.changes);
  await fixOne(fixed, fixed.now.issues.find((x) => x.fix) ?? s.before.issues[0]);
  assert.equal(JSON.stringify(fixed.changes), before);
});
