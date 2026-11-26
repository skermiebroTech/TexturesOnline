// Development versions newer than the bundled release table (26.4 snapshots, pre-releases and release
// candidates): each tool's version rules treat them like the newest release, never as an old or
// unknown version, and the pack format comes from the version itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KNOWN_RELEASES, bundledPackFormat } from '../../src/editions/java/packformats';
import { buildPackMcmeta } from '../../src/editions/java/packmeta';
import { toGameVersions, type ManifestVersion, type MisodeVersion } from '../../src/editions/java/versions';
import { javaPvpRules } from '../../src/tools/textures/pvp/tweaks';
import { modelRules } from '../../src/tools/textures/models/rules';
import { nameRules } from '../../src/tools/textures/names/names';
import { javaAnimRules } from '../../src/tools/textures/anim/pack';
import { colorMapsOf } from '../../src/tools/textures/biomes/biomes';
import { javaAtLeast } from '../../src/tools/textures/gui/catalog';
import { javaHasTotem, javaTotemPath } from '../../src/tools/totem/totem';
import { javaFontSupport } from '../../src/tools/fonts/font';
import { elytraTexturePath, javaHasElytra } from '../../src/tools/skins/cape/pack';
import { supportedFor } from '../../src/tools/shaders/vanilla/support';

const NEWEST = KNOWN_RELEASES[KNOWN_RELEASES.length - 1];
const DEV = ['26.4-snapshot-1', '26.4-snapshot-10', '26.4-pre-1', '26.4-rc-1'];

test('26.4 development versions get the rules of the newest release in every tool', () => {
  const rules = (v: string) => ({
    pvp: javaPvpRules(v),
    models: modelRules(v),
    names: nameRules(v),
    anim: javaAnimRules(v),
    colorMaps: colorMapsOf('java', v),
    guiSprites: javaAtLeast(v, '1.20.2'),
    totem: [javaHasTotem(v), javaTotemPath(v)],
    font: javaFontSupport(v),
    elytra: [javaHasElytra(v), elytraTexturePath('java', v)],
    shaders: supportedFor(v).features,
  });
  const newest = rules(NEWEST);
  for (const v of DEV) assert.deepEqual(rules(v), newest, v);
});

test('a 26.4 pre-release: pack format from the version list, pack.mcmeta for its format alone', () => {
  assert.equal(bundledPackFormat('26.4-pre-1', '2026-11-24T12:48:31+00:00', 'snapshot'), null, 'not in the release table');
  const entry: ManifestVersion = { id: '26.4-pre-1', type: 'snapshot', url: 'https://mock.test/26.4-pre-1.json', time: '2026-11-24T17:04:49+00:00', releaseTime: '2026-11-24T12:48:31+00:00' };
  const misode = new Map<string, MisodeVersion>([['26.4-pre-1', { id: '26.4-pre-1', name: '26.4 Pre-Release 1', type: 'snapshot', resource_pack_version: 104, resource_pack_version_minor: 0 }]]);
  const [gv] = toGameVersions([entry], misode);
  assert.deepEqual(gv, { edition: 'java', id: '26.4-pre-1', name: '26.4 Pre-Release 1', type: 'snapshot', releaseTime: entry.releaseTime, packFormat: { major: 104, minor: 0 } });
  assert.equal(buildPackMcmeta({ description: 'x', target: gv.packFormat! }), '{\n  "pack": {\n    "description": "x",\n    "min_format": 104,\n    "max_format": 104\n  }\n}\n');
  // A pack that also keeps working on 26.3
  assert.match(buildPackMcmeta({ description: 'x', target: gv.packFormat!, range: { min: bundledPackFormat('26.3')!, max: gv.packFormat! } }), /"min_format": \[97, 1\],\n    "max_format": 104/);
});
