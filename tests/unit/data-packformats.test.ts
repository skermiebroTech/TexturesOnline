import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  KNOWN_RELEASE_FORMATS,
  legacyRpFormatForRelease,
  legacyRpFormatForSnapshot,
  bundledPackFormat,
  packFormatFromVersionJson,
  guessReleaseForFormat,
  releasesForFormat,
} from '../../src/editions/java/packformats';
import { filterResourcePackVersions, toGameVersions, type VersionManifest, type MisodeVersion } from '../../src/editions/java/versions';
import { buildJavaTextureList, javaTextureCategory, javaGroupOf } from '../../src/editions/java/textures';
import { fixturesDir } from '../tools/data/fixtures';

const SCRATCH = fixturesDir();
const MANIFEST = `${SCRATCH}/manifest.json`;
const MISODE = `${SCRATCH}/versions.json`;

test('legacy release table (research §2.1 / §2.3)', () => {
  const expect: Record<string, number> = {
    '1.6.1': 1, '1.6.4': 1, '1.7.3': 1, '1.7.10': 1, '1.8': 1, '1.8.9': 1,
    '1.9': 2, '1.9.4': 2, '1.10.2': 2,
    '1.11': 3, '1.11.2': 3, '1.12.2': 3,
    '1.13': 4, '1.13.1': 4, '1.13.2': 4,
  };
  for (const [id, f] of Object.entries(expect)) {
    assert.equal(legacyRpFormatForRelease(id), f, id);
    assert.deepEqual(KNOWN_RELEASE_FORMATS[id], { major: f, minor: 0 }, id);
  }
  assert.equal(legacyRpFormatForRelease('1.5.2'), null);
  assert.equal(legacyRpFormatForRelease('b1.7.3'), null);
  assert.equal(legacyRpFormatForRelease('1.20.1'), null);
});

test('bundled modern releases', () => {
  const expect: [string, number, number][] = [
    ['1.14', 4, 0], ['1.15', 5, 0], ['1.16.1', 5, 0], ['1.16.2', 6, 0], ['1.17.1', 7, 0], ['1.18.2', 8, 0], ['1.19.2', 9, 0],
    ['1.19.3', 12, 0], ['1.19.4', 13, 0], ['1.20', 15, 0], ['1.20.1', 15, 0], ['1.20.2', 18, 0], ['1.20.4', 22, 0], ['1.20.6', 32, 0],
    ['1.21.1', 34, 0], ['1.21.3', 42, 0], ['1.21.4', 46, 0], ['1.21.5', 55, 0], ['1.21.6', 63, 0], ['1.21.8', 64, 0],
    ['1.21.9', 69, 0], ['1.21.10', 69, 0], ['1.21.11', 75, 0], ['26.1', 84, 0], ['26.1.2', 84, 0], ['26.2', 88, 0], ['26.3', 97, 1],
  ];
  for (const [id, major, minor] of expect) assert.deepEqual(bundledPackFormat(id), { major, minor }, id);
});

test('snapshot thresholds by release time', () => {
  assert.equal(legacyRpFormatForSnapshot('2013-06-13T15:32:23+00:00'), 1); // 13w24a
  assert.equal(legacyRpFormatForSnapshot('2013-06-01T00:00:00+00:00'), null); // texture-pack era
  assert.equal(legacyRpFormatForSnapshot('2015-07-29T13:24:33+00:00'), 2); // 15w31a
  assert.equal(legacyRpFormatForSnapshot('2016-08-10T12:30:10+00:00'), 3); // 16w32a
  assert.equal(legacyRpFormatForSnapshot('2017-11-27T15:36:33+00:00'), 4); // 17w48a
  assert.equal(legacyRpFormatForSnapshot('2018-11-21T15:45:22+00:00'), 4); // 18w47a
  assert.equal(legacyRpFormatForSnapshot('2018-11-23T10:46:41+00:00'), null); // 18w47b has version.json
  assert.deepEqual(bundledPackFormat('15w31a', '2015-07-29T13:24:33+00:00', 'snapshot'), { major: 2, minor: 0 });
});

test('version.json pack_version shapes (research §3)', () => {
  assert.deepEqual(packFormatFromVersionJson({ id: '1.14.4', pack_version: 4 }), { major: 4, minor: 0 });
  assert.deepEqual(packFormatFromVersionJson({ id: '1.17.1', pack_version: { resource: 7, data: 7 } }), { major: 7, minor: 0 });
  assert.deepEqual(packFormatFromVersionJson({ id: '1.21.10', pack_version: { resource_major: 69, resource_minor: 0, data_major: 88, data_minor: 0 } }), { major: 69, minor: 0 });
  assert.deepEqual(packFormatFromVersionJson({ id: '26.3', pack_version: { resource_major: 97, resource_minor: 1, data_major: 121, data_minor: 0 } }), { major: 97, minor: 1 });
  assert.equal(packFormatFromVersionJson({ id: '1.13.2' }), null);
});

test('guess a release for a format', () => {
  assert.equal(guessReleaseForFormat({ major: 15, minor: 0 }), '1.20.1');
  assert.equal(guessReleaseForFormat({ major: 97, minor: 1 }), '26.3');
  assert.equal(guessReleaseForFormat({ major: 16, minor: 0 }), '1.20.1');
  assert.deepEqual(releasesForFormat(3), ['1.11', '1.11.1', '1.11.2', '1.12', '1.12.1', '1.12.2']);
});

test('bundled table covers every manifest release since 1.6.1', { skip: !existsSync(MANIFEST) && 'manifest fixture missing' }, () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as VersionManifest;
  const releases = filterResourcePackVersions(manifest, false);
  assert.equal(releases.length, 87);
  for (const v of releases) assert.ok(bundledPackFormat(v.id, v.releaseTime, v.type), `missing ${v.id}`);
  const all = filterResourcePackVersions(manifest, true);
  assert.ok(all.length > 800);
  assert.equal(all[0].id, '26.4-snapshot-1');
  assert.ok(!all.some((v) => v.type === 'old_alpha' || v.type === 'old_beta'));
  assert.equal(all[all.length - 1].id, '13w24a');
});

test('bundled table matches misode for every release it has', { skip: !existsSync(MISODE) && 'misode fixture missing' }, () => {
  const misode = JSON.parse(readFileSync(MISODE, 'utf8')) as MisodeVersion[];
  let checked = 0;
  for (const m of misode) {
    if (m.type !== 'release') continue;
    const known = KNOWN_RELEASE_FORMATS[m.id];
    assert.ok(known, `bundled table lacks ${m.id}`);
    assert.deepEqual(known, { major: m.resource_pack_version, minor: m.resource_pack_version_minor ?? 0 }, m.id);
    checked++;
  }
  assert.equal(checked, 48);
});

test('GameVersion list from manifest + misode', { skip: (!existsSync(MANIFEST) || !existsSync(MISODE)) && 'fixtures missing' }, () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as VersionManifest;
  const misode = new Map((JSON.parse(readFileSync(MISODE, 'utf8')) as MisodeVersion[]).map((v) => [v.id, v]));
  const releases = toGameVersions(filterResourcePackVersions(manifest, false), misode);
  assert.equal(releases[0].id, '26.3');
  assert.deepEqual(releases[0].packFormat, { major: 97, minor: 1 });
  assert.equal(releases[0].edition, 'java');
  assert.equal(releases[0].type, 'release');
  assert.ok(releases.every((v) => v.packFormat), 'every release has a format');
  const snaps = toGameVersions(filterResourcePackVersions(manifest, true), misode);
  const s = snaps.find((v) => v.id === '26.4-snapshot-1')!;
  assert.equal(s.type, 'snapshot');
  assert.equal(s.name, '26.4 Snapshot 1');
  assert.deepEqual(s.packFormat, { major: 98, minor: 0 });
  assert.deepEqual(snaps.find((v) => v.id === '15w31a')?.packFormat, { major: 2, minor: 0 });
});

test('Java texture categories and groups', () => {
  assert.equal(javaTextureCategory('block/stone.png'), 'block');
  assert.equal(javaTextureCategory('blocks/stone.png'), 'block');
  assert.equal(javaTextureCategory('items/diamond.png'), 'item');
  assert.equal(javaTextureCategory('entity/equipment/humanoid/iron.png'), 'armor');
  assert.equal(javaTextureCategory('models/armor/iron_layer_1.png'), 'armor');
  assert.equal(javaTextureCategory('entity/bat/bat.png'), 'entity');
  assert.equal(javaTextureCategory('gui/sprites/hud/heart/full.png'), 'gui');
  assert.equal(javaTextureCategory('mob_effect/speed.png'), 'effect');
  assert.equal(javaTextureCategory('palettes/trim/gold.png'), 'armor');
  assert.equal(javaTextureCategory('colormap/grass.png'), 'colormap');
  assert.equal(javaTextureCategory('whatever/x.png'), 'other');
  assert.equal(javaGroupOf('assets/minecraft/textures/block/stone.png'), 'core');
  assert.equal(javaGroupOf('version.json'), 'core');
  assert.equal(javaGroupOf('assets/minecraft/shaders/core/terrain.vsh'), 'shaders');
  assert.equal(javaGroupOf('assets/minecraft/post_effect/blur.json'), 'post_effect');
  assert.equal(javaGroupOf('assets/minecraft/lang/en_us.json'), 'lang');
  assert.equal(javaGroupOf('assets/minecraft/regional_compliancies.json'), 'mc-root');
  assert.equal(javaGroupOf('net/minecraft/client/Main.class'), null);
  assert.equal(javaGroupOf('data/minecraft/recipe/stone.json'), null);
  assert.equal(javaGroupOf('assets/minecraft/font/'), null);
  const list = buildJavaTextureList([
    'assets/minecraft/textures/item/diamond.png',
    'assets/minecraft/textures/block/water_still.png',
    'assets/minecraft/textures/block/water_still.png.mcmeta',
    'assets/minecraft/textures/block/stone.png',
    'assets/minecraft/models/block/stone.json',
  ]);
  assert.deepEqual(list.map((t) => t.id), ['block/stone', 'block/water_still', 'item/diamond']);
  assert.equal(list[1].animated, true);
  assert.equal(list[0].animated, undefined);
  assert.deepEqual(list[0], { path: 'assets/minecraft/textures/block/stone.png', name: 'stone', id: 'block/stone', category: 'block', ext: 'png' });
});
