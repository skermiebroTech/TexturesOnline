// Opening packs: packs exported by the Shader Maker (all three targets) come back as the same
// project; archives with several packs, nested folders or zipped packs are found; files that are no
// pack get a friendly error; Bedrock manifests keep their uuids and get a higher version; JSON tools.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync, type Zippable } from 'fflate';
import type { FileMap, OptionValues } from '../../src/core/types';
import { zipPack } from '../../src/tools/shaders/ui/pack-zip';
import { findPacks, PackImportError } from '../../src/tools/shaders/import/detect';
import { IRIS_METADATA_PATH, METADATA_FILE, packMetadataJson, parsePackMetadata } from '../../src/tools/shaders/import/metadata';
import { packTexts, projectFromCandidate } from '../../src/tools/shaders/import/restore';
import { bumpManifestVersion, checkJson, minifyJson, prettyJson, readBedrockManifest } from '../../src/tools/shaders/packedit/json-tools';
import { PackWorkspace } from '../../src/tools/shaders/packedit/workspace';
import * as iris from '../../src/tools/shaders/iris/index';
import * as vanilla from '../../src/tools/shaders/vanilla/index';
import * as bedrock from '../../src/tools/shaders/bedrock/index';
import { buildResourceManifest } from '../../src/editions/bedrock/manifest';
import { listJars, loadVersionShaders } from '../tools/vanilla/sources';

async function zipBytes(files: FileMap): Promise<Uint8Array> {
  return new Uint8Array(await (await zipPack(files)).arrayBuffer());
}

function tweak(v: OptionValues, defs: { key: string; type: string; min?: number; max?: number; options?: { value: string }[] }[]): OptionValues {
  const out = { ...v };
  for (const d of defs.slice(0, 12)) {
    if (d.type === 'toggle') out[d.key] = !out[d.key];
    else if (d.type === 'range' && d.max !== undefined) out[d.key] = d.max;
    else if (d.type === 'select' && d.options?.length) out[d.key] = d.options[d.options.length - 1].value;
    else if (d.type === 'color') out[d.key] = '#123456';
  }
  return out;
}

test('metadata file: deterministic ASCII JSON that only this app reads back', () => {
  const json = packMetadataJson({ target: 'iris', version: '26.3', settings: { a: 1, b: true, c: '#ff00ff', d: 'Crème' }, preset: 'golden' });
  assert.match(json, /^[\x0a\x20-\x7e]*$/);
  assert.equal(json, packMetadataJson({ target: 'iris', version: '26.3', settings: { a: 1, b: true, c: '#ff00ff', d: 'Crème' }, preset: 'golden' }));
  const back = parsePackMetadata(json)!;
  assert.deepEqual(back, { app: 'TexturePackMaker', format: 1, target: 'iris', version: '26.3', preset: 'golden', settings: { a: 1, b: true, c: '#ff00ff', d: 'Crème' } });
  assert.equal(parsePackMetadata('{"app":"Other","format":1,"target":"iris","settings":{}}'), null);
  assert.equal(parsePackMetadata('{"app":"TexturePackMaker","format":2,"target":"iris","settings":{}}'), null);
  assert.equal(parsePackMetadata('{"app":"TexturePackMaker","format":1,"target":"nope","settings":{}}'), null);
  assert.equal(parsePackMetadata('not json'), null);
  // hostile keys and values are dropped
  const odd = parsePackMetadata('{"app":"TexturePackMaker","format":1,"target":"iris","settings":{"__proto__":1,"ok":2,"bad key":3,"obj":{}}}')!;
  assert.deepEqual(Object.keys(odd.settings), ['ok']);
});

test('Iris: an exported pack opens again as the same project', async () => {
  const v = tweak(iris.presetValues('golden'), iris.OPTIONS);
  const files = iris.generateIrisPack(v, { name: 'Round Trip ✨', description: 'Warm evenings.', version: '1.21.4', preset: 'golden' });
  assert.ok(files[IRIS_METADATA_PATH], 'shaders/texturepackmaker.json');
  // not a shader program, include or properties file: the loaders never read it
  assert.ok(!/\.(vsh|fsh|gsh|csh|glsl|properties|lang)$/.test(IRIS_METADATA_PATH));
  for (const [p, c] of Object.entries(files)) if (typeof c === 'string' && /\.(glsl|vsh|fsh|properties)$/.test(p)) assert.ok(!c.includes('texturepackmaker.json'), p);
  const bytes = await zipBytes(files);
  const [c, ...rest] = await findPacks(bytes, 'Round Trip ✨ (1).zip');
  assert.equal(rest.length, 0);
  assert.equal(c.kind, 'iris');
  assert.equal(c.metadata?.target, 'iris');
  const p = projectFromCandidate(c, { normalize: iris.normalizeOptions, presetIds: iris.PRESETS.map((x) => x.id), defaultVersion: '26.3' });
  assert.equal(p.kind, 'shader');
  assert.equal(p.target, 'iris');
  assert.equal(p.version, '1.21.4');
  assert.equal(p.preset, 'golden');
  assert.deepEqual(p.settings, iris.normalizeOptions(v));
  assert.equal(p.name, 'Round Trip ✨');
  assert.equal(p.description, 'Warm evenings.');
  // exporting the recreated project gives the same pack again
  const again = iris.generateIrisPack(p.settings, { name: p.name, description: p.description, version: p.version, preset: p.preset });
  assert.deepEqual(again, files);
});

test('Iris: packs one folder down, several packs and zipped packs in one archive', async () => {
  const pack = iris.generateIrisPack(iris.defaults(), { name: 'A', description: '' }) as Record<string, string>;
  const inFolder: Zippable = {};
  for (const [p, t] of Object.entries(pack)) inFolder[`Pack-main/${p}`] = strToU8(t);
  const one = await findPacks(zipSync(inFolder), 'download.zip');
  assert.equal(one.length, 1);
  assert.equal(one[0].location, 'Pack-main');
  assert.equal(one[0].fileName, 'Pack-main.zip');
  assert.ok(one[0].files['shaders/final.fsh'], 'paths are relative to the pack');

  const bundle: Zippable = { 'readme.txt': strToU8('two packs') };
  for (const [p, t] of Object.entries(pack)) {
    bundle[`First/${p}`] = strToU8(t);
    bundle[`Second/${p.replace('texturepackmaker.json', 'other.json')}`] = strToU8(t);
  }
  bundle['Zipped/Third.zip'] = zipSync(Object.fromEntries(Object.entries(pack).map(([p, t]) => [p, strToU8(t)])));
  bundle['Bedrock.mcpack'] = zipSync({ 'manifest.json': strToU8(buildResourceManifest({ name: 'BR', description: '', uuids: { header: '11111111-1111-4111-8111-111111111111', module: '22222222-2222-4222-8222-222222222222' }, version: [1, 0, 0] })) });
  const many = await findPacks(zipSync(bundle), 'bundle.zip');
  assert.deepEqual(many.map((c) => [c.kind, c.location, Boolean(c.metadata)]), [
    ['iris', 'First', true],
    ['iris', 'Second', false],
    ['iris', 'Zipped › Third.zip', true],
    ['bedrock', 'Bedrock.mcpack', false],
  ]);
  assert.equal(many[2].fileName, 'Third.zip');
  assert.equal(many[3].name, 'BR');
  // zips inside a pack are part of it, not more packs
  const withZip: Zippable = { ...Object.fromEntries(Object.entries(pack).map(([p, t]) => [p, strToU8(t)])), 'shaders/tex/extra.zip': bundle['Zipped/Third.zip'] };
  assert.equal((await findPacks(zipSync(withZip), 'one.zip')).length, 1);
});

test('friendly errors for files that are no pack', async () => {
  await assert.rejects(findPacks(strToU8('hello'), 'notes.txt'), (e: Error) => e instanceof PackImportError && /isn't a \.zip/.test(e.message));
  await assert.rejects(findPacks(zipSync({ 'photo.png': new Uint8Array([1, 2]) }), 'pics.zip'), (e: Error) => /No pack was found in “pics\.zip”/.test(e.message));
  await assert.rejects(findPacks(zipSync({ 'World/level.dat': new Uint8Array([1]) }), 'world.zip'), (e: Error) => /is a world/.test(e.message));
  await assert.rejects(findPacks(zipSync({ 'fabric.mod.json': strToU8('{}'), 'a/B.class': new Uint8Array([1]) }), 'mod.jar'), (e: Error) => /looks like a mod/.test(e.message));
  // a texture pack is found, but flagged as having no shaders
  const [tex] = await findPacks(zipSync({ 'pack.mcmeta': strToU8('{"pack":{"pack_format":46,"description":"Tex"}}'), 'assets/minecraft/textures/block/stone.png': new Uint8Array([1]) }), 'tex.zip');
  assert.equal(tex.kind, 'java-vanilla');
  assert.equal(tex.hasShaders, false);
});

test('Vanilla Java: an exported pack opens again as the same project', async () => {
  const v = tweak(vanilla.presetValues('vivid'), vanilla.OPTIONS);
  const sources = { 'assets/minecraft/shaders/core/position.vsh': '#version 150\nvoid main() {}\n' };
  const res = vanilla.generateVanillaShaderFiles(sources, v, { versionId: '1.21.4', packFormat: { major: 46, minor: 0 }, preset: 'vivid' });
  assert.equal(res.supported, true);
  const files: FileMap = { ...res.files, 'pack.mcmeta': JSON.stringify({ pack: { pack_format: 46, description: 'Bright days (Java 1.21.4 only)' } }), 'pack.png': new Uint8Array([0x89, 0x50]) };
  const [c] = await findPacks(await zipBytes(files), 'Bright Days.zip');
  assert.equal(c.kind, 'java-vanilla');
  assert.equal(c.hasShaders, false, 'no shader files at default-like settings, but it is ours');
  const p = projectFromCandidate(c, { normalize: vanilla.normalizeOptions, presetIds: vanilla.PRESETS.map((x) => x.id), defaultVersion: '26.3' });
  assert.equal(p.target, 'java-vanilla');
  assert.equal(p.version, '1.21.4');
  assert.equal(p.preset, 'vivid');
  assert.deepEqual(p.settings, vanilla.normalizeOptions(v));
  assert.equal(p.name, 'Bright Days');
  assert.equal(p.description, 'Bright days');
});

const jar = listJars().find((j) => j.version === '26.3');
test('Vanilla Java 26.3 (real game shaders): round trip with patched files', { skip: jar ? false : 'set TO_FIXTURES to a folder with research-cache/jars/26.3.jar or client-26.3.jar' }, async () => {
  const vs = loadVersionShaders(jar!);
  const v = vanilla.presetValues('cinematic');
  const res = vanilla.generateVanillaShaderFiles(vs.sources, v, { versionId: '26.3', packFormat: vs.packFormat ?? { major: 97, minor: 1 }, preset: 'cinematic' });
  const files: FileMap = { ...res.files, 'pack.mcmeta': '{"pack":{"description":"x"}}' };
  const [c] = await findPacks(await zipBytes(files), 'Cinematic.zip');
  assert.equal(c.hasShaders, true);
  const p = projectFromCandidate(c, { normalize: vanilla.normalizeOptions, presetIds: vanilla.PRESETS.map((x) => x.id), defaultVersion: '26.3' });
  assert.deepEqual(p.settings, vanilla.normalizeOptions(v));
  assert.equal(p.preset, 'cinematic');
});

test('Bedrock: an exported .mcpack opens again with the same settings and uuids', async () => {
  const v = tweak(bedrock.presetValues('vivid'), bedrock.OPTIONS);
  const uuids = { header: 'aaaaaaaa-1111-4111-8111-111111111111', module: 'bbbbbbbb-2222-4222-8222-222222222222' };
  const files: FileMap = {
    ...bedrock.generateBedrockVisuals(v, { version: '1.21.120', preset: 'vivid' }),
    'manifest.json': buildResourceManifest({ name: 'Glow Up', description: 'Brighter nights', uuids, version: [1, 0, 3], capabilities: ['pbr'] }),
  };
  assert.equal(parsePackMetadata(files[METADATA_FILE] as string)?.target, 'bedrock-vibrant');
  assert.deepEqual(bedrock.validateBedrockVisuals(files), [], 'the metadata file does not upset the validator');
  const [c] = await findPacks(await zipBytes(files), 'Glow Up.mcpack');
  assert.equal(c.kind, 'bedrock');
  assert.equal(c.note, 'Resource pack');
  const p = projectFromCandidate(c, { normalize: bedrock.normalizeOptions, presetIds: bedrock.PRESETS.map((x) => x.id), defaultVersion: 'latest' });
  assert.equal(p.target, 'bedrock-vibrant');
  assert.equal(p.version, '1.21.120');
  assert.deepEqual(p.settings, bedrock.normalizeOptions(v));
  assert.deepEqual(p.bedrockUuids, uuids);
  assert.deepEqual(p.packVersion, [1, 0, 3]);
  assert.deepEqual(packTexts(c), { name: 'Glow Up', description: 'Brighter nights' });
});

test('Bedrock packs from elsewhere: export keeps uuids and raises the version', async () => {
  const manifest = '{\n    "format_version": 2,\n    "header": { "name": "pack.name", "uuid": "u1", "version": [2, 1, 9], "min_engine_version": [1, 20, 0] },\n    "modules": [{ "type": "resources", "uuid": "u2", "version": [2, 1, 9] }, { "type": "script", "uuid": "u3", "version": [0, 1, 0] }]\n}';
  const bumped = bumpManifestVersion(manifest)!;
  const doc = JSON.parse(bumped.text);
  assert.deepEqual(bumped.version, [2, 1, 10]);
  assert.deepEqual(doc.header.version, [2, 1, 10]);
  assert.deepEqual(doc.modules.map((m: { version: number[] }) => m.version), [[2, 1, 10], [0, 1, 0]]);
  assert.deepEqual([doc.header.uuid, doc.modules[0].uuid], ['u1', 'u2']);
  assert.ok(bumped.text.startsWith('{\n    "format_version"'), 'keeps the 4-space indentation');
  // never below a version already exported
  assert.deepEqual(bumpManifestVersion(manifest, [2, 1, 12])!.version, [2, 1, 13]);
  // version strings (manifest format 3) stay strings; comments are allowed
  assert.equal(JSON.parse(bumpManifestVersion('{ // c\n"header":{"version":"1.2.3"}}')!.text).header.version, '1.2.4');
  assert.equal(bumpManifestVersion('{ broken'), null);
  // localized names
  const info = readBedrockManifest(manifest, new Map([['pack.name', 'Nice Pack']]))!;
  assert.equal(info.name, 'Nice Pack');
  assert.equal(info.moduleType, 'resources');
  // through the workspace: manifest bumped, every other file untouched
  const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
  const ws = new PackWorkspace('bedrock', { 'manifest.json': strToU8(manifest), 'pack_icon.png': png, 'texts/en_US.lang': strToU8('pack.name=Nice Pack') });
  const out = ws.buildExport({ bedrockAtLeast: [2, 1, 10] });
  assert.deepEqual(out.version, [2, 1, 11]);
  assert.deepEqual(out.files['pack_icon.png'], png);
  assert.deepEqual(out.files['texts/en_US.lang'], strToU8('pack.name=Nice Pack'));
  assert.deepEqual(JSON.parse(new TextDecoder().decode(out.files['manifest.json'] as Uint8Array)).header.uuid, 'u1');
});

test('JSON tools: errors with line and column, Bedrock-style comments, pretty and minify', () => {
  assert.deepEqual(checkJson('{"a": 1}'), { ok: true });
  assert.deepEqual(checkJson('{\n  // note\n  "a": 1,\n}'), { ok: true, lenient: true });
  const bad = checkJson('{\n  "a": 1\n  "b": 2\n}');
  assert.equal(bad.ok, false);
  assert.equal(bad.line, 3);
  assert.ok(bad.message);
  // with comments in the file, the error points at the real mistake, not at the comment
  const withComment = checkJson('{\n  // Bedrock allows this\n  "a": 1\n}\n}');
  assert.equal(withComment.ok, false);
  assert.equal(withComment.line, 5);
  assert.equal(prettyJson('{"a":[1,2],"b":{"c":true}}'), '{\n  "a": [\n    1,\n    2\n  ],\n  "b": {\n    "c": true\n  }\n}\n');
  assert.equal(prettyJson('{\n    "a": 1\n}\n'), '{\n    "a": 1\n}\n', 'keeps 4-space indentation');
  assert.equal(minifyJson('{\n  "a": [1, 2]\n}\n'), '{"a":[1,2]}');
  assert.throws(() => prettyJson('{ nope'));
});

