import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  bedrockTexturesFromFiles,
  bedrockTextureCategory,
  catalogFromIndex,
  indexFromPaths,
  isBedrockIndexFile,
  parseLenientJson,
  pathsFromGitTree,
  stripJsonComments,
  texturePathsFromAtlases,
  flipbookStems,
  type BedrockIndexFile,
} from '../../src/editions/bedrock/catalog';
import {
  buildBedrockVersionList,
  bedrockDisplayVersion,
  engineVersionOf,
  normalizeVersion,
  samplesDateToIso,
  type BedrockVersionsSnapshot,
  type SamplesVersionJson,
} from '../../src/editions/bedrock/versions';
import { bedrockFileUrls } from '../../src/editions/bedrock/assets';
import { fixturesDir } from '../tools/data/fixtures';

const ROOT = new URL('../../', import.meta.url).pathname;
const SCRATCH = fixturesDir();
const CACHE = `${SCRATCH}/research-cache/bedrock`;
const INDEX_MAIN = `${ROOT}public/data/bedrock/index-main.json`;
const INDEX_PREVIEW = `${ROOT}public/data/bedrock/index-preview.json`;
const VERSIONS = `${ROOT}public/data/bedrock/versions.json`;

const readJson = <T>(p: string) => JSON.parse(readFileSync(p, 'utf8')) as T;

test('lenient JSON: // and /* */ comments, trailing commas, strings untouched', () => {
  const text = '// header comment\n{\n  "a": "http://x//y", /* block */ "b": [1, 2,],\n  "c": "a, }", // tail\n}\n';
  assert.deepEqual(parseLenientJson(text), { a: 'http://x//y', b: [1, 2], c: 'a, }' });
  assert.equal(stripJsonComments('"\\"//"'), '"\\"//"');
});

test('shipped index files are valid, paths only, and complete', { skip: !existsSync(INDEX_MAIN) && 'index not generated' }, () => {
  for (const file of [INDEX_MAIN, INDEX_PREVIEW]) {
    const idx = readJson<BedrockIndexFile>(file);
    assert.ok(isBedrockIndexFile(idx), file);
    assert.match(idx.version ?? '', /^1\.\d+\.\d+\.\d+$/);
    assert.match(idx.commit ?? '', /^[0-9a-f]{40}$/);
    const cat = catalogFromIndex(idx);
    assert.ok(cat.files.length > 13000, `${file}: ${cat.files.length}`);
    assert.ok(cat.files.includes('manifest.json'));
    assert.ok(cat.files.includes('textures/terrain_texture.json'));
    assert.ok(!cat.files.some((f) => f.startsWith('sounds/')));
    assert.deepEqual([...cat.files].sort(), cat.files);
    assert.ok(cat.flipbook.has('textures/blocks/water_still_grey'));
  }
});

test('texture list from the main index: counts, PBR maps excluded, TGA preferred', { skip: !existsSync(INDEX_MAIN) && 'index not generated' }, () => {
  const cat = catalogFromIndex(readJson<BedrockIndexFile>(INDEX_MAIN));
  const tex = bedrockTexturesFromFiles(cat.files, cat.flipbook);
  const byId = new Map(tex.map((t) => [t.id, t]));
  // research §1.3: 5,080 base images incl. 18 jpg -> 5,062 png/tga files, minus 7 stems shipped in both formats.
  // Seven *_normal.png colour textures that research counted as PBR are kept (they have their own texture sets or no base).
  assert.ok(tex.length > 5000 && tex.length < 5100, `count ${tex.length}`);
  assert.ok(!tex.some((t) => /_mers?$/.test(t.id)), 'no MER/MERS maps');
  assert.equal(byId.get('blocks/stone')?.ext, 'png');
  assert.equal(byId.get('blocks/stone')?.path, 'textures/blocks/stone.png');
  assert.equal(byId.get('blocks/leaves_oak')?.ext, 'tga');
  assert.equal(byId.get('blocks/tallgrass')?.ext, 'tga', 'both formats -> tga');
  assert.equal(byId.get('blocks/grass_side_snowed')?.path, 'textures/blocks/grass_side_snowed.tga');
  assert.ok(byId.has('blocks/piston_top_normal'), 'colour texture with its own texture set');
  assert.ok(byId.has('ui/buy_now_normal'), 'ui image without a base texture set');
  assert.ok(!byId.has('blocks/lava_flow_normal'), 'normal map of lava_flow');
  assert.ok(!byId.has('blocks/water_still_grey_normal'));
  assert.equal(byId.get('blocks/water_still_grey')?.animated, true);
  assert.equal(byId.get('blocks/stone')?.animated, undefined);
  assert.equal(byId.get('entity/sheep/sheep')?.category, 'entity');
  assert.equal(byId.get('ui/heart_new')?.category ?? byId.get('ui/heart')?.category, 'gui');
  assert.equal(tex.filter((t) => t.ext === 'tga').length > 150, true);
  assert.ok(!tex.some((t) => t.path.endsWith('.jpg') || t.path.endsWith('.hdr')));
  // Sorted by category order then id
  const cats = tex.map((t) => t.category);
  assert.equal(cats[0], 'block');
  assert.ok(cats.indexOf('item') > cats.lastIndexOf('block'));
});

test('bedrock categories', () => {
  assert.equal(bedrockTextureCategory('blocks/stone'), 'block');
  assert.equal(bedrockTextureCategory('items/apple'), 'item');
  assert.equal(bedrockTextureCategory('entity/pig/pig'), 'entity');
  assert.equal(bedrockTextureCategory('ui/heart'), 'gui');
  assert.equal(bedrockTextureCategory('gui/newgui/x'), 'gui');
  assert.equal(bedrockTextureCategory('particle/particles'), 'particle');
  assert.equal(bedrockTextureCategory('models/armor/iron_1'), 'armor');
  assert.equal(bedrockTextureCategory('trims/x'), 'armor');
  assert.equal(bedrockTextureCategory('environment/sun'), 'environment');
  assert.equal(bedrockTextureCategory('painting/kz'), 'painting');
  assert.equal(bedrockTextureCategory('colormap/grass'), 'colormap');
  assert.equal(bedrockTextureCategory('map/map_background'), 'map');
  assert.equal(bedrockTextureCategory('misc/pumpkinblur'), 'misc');
  assert.equal(bedrockTextureCategory('flame_atlas'), 'misc');
  assert.equal(bedrockTextureCategory('persona_thumbnails/x'), 'other');
});

test('index round trip and GitHub tree parsing', () => {
  const paths = ['manifest.json', 'textures/blocks/a.png', 'textures/blocks/a.texture_set.json', 'textures/blocks/a_mers.tga', 'textures/items/b.tga'];
  const idx = indexFromPaths(paths, { ref: 'v1.2.3.4', version: '1.2.3.4' });
  assert.deepEqual(idx.dirs, { '': ['manifest.json'], 'textures/blocks': ['a.png', 'a.texture_set.json', 'a_mers.tga'], 'textures/items': ['b.tga'] });
  assert.deepEqual(catalogFromIndex(idx).files, [...paths].sort());
  const tex = bedrockTexturesFromFiles(catalogFromIndex(idx).files);
  assert.deepEqual(tex.map((t) => t.path), ['textures/blocks/a.png', 'textures/items/b.tga']);
  const tree = { sha: 'abc', tree: [
    { path: 'README.md', type: 'blob' },
    { path: 'resource_pack', type: 'tree' },
    { path: 'resource_pack/textures/blocks/a.png', type: 'blob' },
    { path: 'resource_pack/sounds/x.fsb', type: 'blob' },
    { path: 'behavior_pack/x.json', type: 'blob' },
  ] };
  assert.deepEqual(pathsFromGitTree(tree), ['textures/blocks/a.png']);
  assert.throws(() => pathsFromGitTree({ message: 'rate limited' }));
});

test('atlas fallback reads vanilla terrain/item/flipbook JSON (with comments)', { skip: !existsSync(`${CACHE}/main-terrain_texture.json`) && 'atlas samples missing' }, () => {
  const terrainText = readFileSync(`${CACHE}/main-terrain_texture.json`, 'utf8');
  assert.throws(() => JSON.parse(terrainText));
  const terrain = parseLenientJson(terrainText);
  const item = parseLenientJson(readFileSync(`${CACHE}/main-item_texture.json`, 'utf8'));
  const flipbook = parseLenientJson(readFileSync(`${CACHE}/main-flipbook_textures.json`, 'utf8'));
  const { paths, flipbook: flip } = texturePathsFromAtlases({ terrain, item, flipbook });
  assert.ok(paths.length > 2000, `atlas paths ${paths.length}`);
  assert.ok(paths.includes('textures/blocks/stone'));
  assert.ok(paths.includes('textures/blocks/grass_side'), 'object entries with overlay_color');
  assert.ok(paths.includes('textures/items/apple'));
  assert.equal(flip.length, flipbookStems(flipbook).length);
  assert.ok(flip.includes('textures/blocks/water_still_grey'));
});

test('version helpers', () => {
  assert.equal(bedrockDisplayVersion('1.26.50.4'), '26.50');
  assert.equal(bedrockDisplayVersion('1.26.0.2'), '26.0');
  assert.equal(bedrockDisplayVersion('1.26.1.1'), '26.1');
  assert.equal(bedrockDisplayVersion('1.21.120.4'), '1.21.120');
  assert.deepEqual(engineVersionOf('1.26.50.4'), [1, 26, 50]);
  assert.equal(normalizeVersion('1.26.40.05'), '1.26.40.5');
  assert.equal(normalizeVersion('v1.21.110.25a-preview'), '1.21.110.25');
  assert.equal(samplesDateToIso('15-09-2026'), '2026-09-15T00:00:00Z');
  assert.equal(samplesDateToIso('bad'), undefined);
  const urls = bedrockFileUrls('main', 'textures/blocks/stone.png');
  assert.deepEqual(urls, [
    'https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/blocks/stone.png',
    'https://cdn.jsdelivr.net/gh/Mojang/bedrock-samples@main/resource_pack/textures/blocks/stone.png',
  ]);
});

test('version list from version.json + jsDelivr tags (irregular tag names)', { skip: !existsSync(`${CACHE}/jsd-versions.json`) && 'fixtures missing' }, () => {
  const main = readJson<SamplesVersionJson>(`${CACHE}/version-main.json`);
  const preview = readJson<SamplesVersionJson>(`${CACHE}/version-preview.json`);
  const tags = readJson<{ versions: { version: string }[] }>(`${CACHE}/jsd-versions.json`).versions.map((v) => v.version);
  const releasesOnly = buildBedrockVersionList({ main, preview, tags }, false);
  assert.deepEqual(releasesOnly[0], { edition: 'bedrock', id: 'latest', name: 'Latest release (26.50)', type: 'release', ref: 'main', releaseTime: '2026-09-15T00:00:00Z' });
  assert.ok(releasesOnly.every((v) => v.type === 'release'));
  const byId = new Map(releasesOnly.map((v) => [v.id, v]));
  assert.equal(byId.get('1.26.40.5')?.ref, 'v1.26.40.05', 'tag name from jsDelivr, not built from version.json');
  assert.equal(byId.get('1.26.40.5')?.name, '26.40');
  assert.equal(byId.get('1.21.120.4')?.name, '1.21.120');
  assert.equal(byId.get('1.21.120.4')?.releaseTime, '2025-10-28T00:00:00Z');
  assert.ok(!byId.has('1.26.50.4'), 'current release is the "latest" entry');
  assert.ok(!byId.has('1.26.20.26'), 'preview tag without suffix is not a release');
  // Newest first
  assert.equal(releasesOnly[1].id, '1.26.40.5');
  const all = buildBedrockVersionList({ main, preview, tags }, true);
  assert.equal(all[1].id, 'preview');
  assert.equal(all[1].ref, 'preview');
  assert.equal(all[1].name, 'Latest preview (26.60.28)');
  const allById = new Map(all.map((v) => [v.id, v]));
  assert.equal(allById.get('1.26.20.26-preview')?.ref, 'v1.26.20.26');
  assert.equal(allById.get('1.26.10.23-preview')?.ref, 'v1.26.10.23-preview.1');
  assert.equal(allById.get('1.21.90.26-preview')?.ref, 'v1.21.90.26-preview2');
  assert.equal(allById.get('1.26.50.27-preview')?.name, 'Preview 26.50.27');
  assert.equal(new Set(all.map((v) => v.id)).size, all.length, 'ids are unique');
  // Degrades to the "latest" entry when nothing can be fetched
  assert.deepEqual(buildBedrockVersionList({}, false).map((v) => v.id), ['latest']);
});

test('shipped versions.json snapshot works as a fallback', { skip: !existsSync(VERSIONS) && 'snapshot not generated' }, () => {
  const snap = readJson<BedrockVersionsSnapshot>(VERSIONS);
  assert.ok(snap.tags && snap.tags.length > 200);
  assert.ok(snap.tags.includes('1.26.40.05'));
  const list = buildBedrockVersionList({ main: snap.main, preview: snap.preview, tags: snap.tags }, false);
  assert.equal(list[0].id, 'latest');
  assert.ok(list.length > 25);
});
