import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPackMcmeta,
  validatePackSection,
  packCompatibility,
  describePackForGame,
  readPackMcmetaRange,
  buildPackMcmetaForVersions,
  getJavaPackFormat,
} from '../../src/editions/java/packmeta';
import type { PackFormat } from '../../src/core/types';

const pf = (major: number, minor = 0): PackFormat => ({ major, minor });
const parse = (s: string) => JSON.parse(s) as { pack: Record<string, unknown> };

// ---- research/java-packs.md §7 examples (verified with the real 26.3 parser) ----

test('A: only 26.3 -> min_format [97,1], max_format 97', () => {
  const out = buildPackMcmeta({ description: 'My pack for Minecraft 26.3', target: pf(97, 1) });
  assert.deepEqual(parse(out), { pack: { description: 'My pack for Minecraft 26.3', min_format: [97, 1], max_format: 97 } });
  assert.equal(out, '{\n  "pack": {\n    "description": "My pack for Minecraft 26.3",\n    "min_format": [97, 1],\n    "max_format": 97\n  }\n}\n');
  const range = validatePackSection(parse(out).pack);
  assert.equal(packCompatibility(range, pf(97, 1)), 'compatible');
  assert.equal(packCompatibility(range, pf(97, 0)), 'too-new');
  assert.equal(packCompatibility(range, pf(84, 0)), 'too-new');
  assert.equal(packCompatibility(range, pf(98, 0)), 'too-old');
  assert.equal(parse(out).pack.supported_formats, undefined);
});

test('A variant: format without minor -> bare integer min_format', () => {
  const out = parse(buildPackMcmeta({ description: 'x', target: pf(88) }));
  assert.deepEqual(out, { pack: { description: 'x', min_format: 88, max_format: 88 } });
});

test('B: only 1.20.1 -> pack_format 15 only', () => {
  const out = buildPackMcmeta({ description: 'My pack for Minecraft 1.20.1', target: pf(15) });
  assert.deepEqual(parse(out), { pack: { pack_format: 15, description: 'My pack for Minecraft 1.20.1' } });
  assert.deepEqual(Object.keys(parse(out).pack), ['pack_format', 'description']);
  assert.equal(describePackForGame(out, pf(15)), 'compatible');
  assert.equal(describePackForGame(out, pf(97, 1)), 'too-old');
});

test('C: spanning 1.20.1 -> 26.3', () => {
  const out = buildPackMcmeta({ description: 'My pack for Minecraft 1.20.1 - 26.3', target: pf(97, 1), range: { min: pf(15), max: pf(97, 1) } });
  assert.deepEqual(parse(out), {
    pack: { description: 'My pack for Minecraft 1.20.1 - 26.3', pack_format: 15, supported_formats: [15, 97], min_format: 15, max_format: 97 },
  });
  assert.deepEqual(Object.keys(parse(out).pack), ['description', 'pack_format', 'supported_formats', 'min_format', 'max_format']);
  for (const g of [pf(15), pf(18), pf(34), pf(64), pf(69), pf(84), pf(97, 0), pf(97, 1)]) assert.equal(describePackForGame(out, g), 'compatible', `game ${g.major}.${g.minor}`);
  assert.equal(describePackForGame(out, pf(98)), 'too-old');
});

test('spanning range below 15 is clamped (26.3 rejects multi-version mains < 15)', () => {
  const out = parse(buildPackMcmeta({ description: 'd', target: pf(97, 1), range: { min: pf(1), max: pf(97, 1) } }));
  assert.deepEqual(out.pack, { description: 'd', pack_format: 15, supported_formats: [15, 97], min_format: 15, max_format: 97 });
  assert.doesNotThrow(() => validatePackSection(out.pack));
});

test('E: new-only range 1.21.9 -> 26.3 has no supported_formats', () => {
  const out = parse(buildPackMcmeta({ description: 'My pack for Minecraft 1.21.9 - 26.3', target: pf(97, 1), range: { min: pf(69), max: pf(97, 1) } }));
  assert.deepEqual(out, { pack: { description: 'My pack for Minecraft 1.21.9 - 26.3', min_format: 69, max_format: 97 } });
  const range = validatePackSection(out.pack);
  for (const g of [pf(69), pf(75), pf(84), pf(88), pf(97, 0), pf(97, 1)]) assert.equal(packCompatibility(range, g), 'compatible');
  assert.equal(packCompatibility(range, pf(64)), 'too-new');
});

test('new-only range starting at a minor keeps it', () => {
  const out = parse(buildPackMcmeta({ description: 'x', target: pf(98), range: { min: pf(97, 1), max: pf(98) } }));
  assert.deepEqual(out.pack, { description: 'x', min_format: [97, 1], max_format: 98 });
});

test('1.20.2 - 1.21.8 range uses pack_format + supported_formats', () => {
  const out = buildPackMcmeta({ description: 'x', target: pf(34), range: { min: pf(18), max: pf(64) } });
  assert.deepEqual(parse(out).pack, { pack_format: 18, supported_formats: [18, 64], description: 'x' });
  assert.equal(describePackForGame(out, pf(18)), 'compatible');
  assert.equal(describePackForGame(out, pf(46)), 'compatible');
  assert.equal(describePackForGame(out, pf(64)), 'compatible');
  // 26.3 reads the old-style fields: valid, too old.
  assert.equal(describePackForGame(out, pf(97, 1)), 'too-old');
});

test('range entirely before 1.20.2 emits pack_format only (the target format)', () => {
  assert.deepEqual(parse(buildPackMcmeta({ description: 'x', target: pf(3), range: { min: pf(1), max: pf(4) } })).pack, { pack_format: 3, description: 'x' });
  assert.deepEqual(parse(buildPackMcmeta({ description: 'x', target: pf(1), range: { min: pf(1), max: pf(15) } })).pack, { pack_format: 1, description: 'x' });
});

test('a compatibility range never excludes the target version', () => {
  // Target 26.3 with a 1.6-1.13 range: the pack must still load on 26.3.
  const out = buildPackMcmeta({ description: 'x', target: pf(97, 1), range: { min: pf(1), max: pf(4) } });
  assert.deepEqual(parse(out).pack, { description: 'x', pack_format: 15, supported_formats: [15, 97], min_format: 15, max_format: 97 });
  assert.equal(describePackForGame(out, pf(97, 1)), 'compatible');
  // Target below the range: widened downwards.
  const low = buildPackMcmeta({ description: 'x', target: pf(34), range: { min: pf(46), max: pf(64) } });
  assert.deepEqual(parse(low).pack, { pack_format: 34, supported_formats: [34, 64], description: 'x' });
  assert.equal(describePackForGame(low, pf(34)), 'compatible');
});

test('pre-1.20.2 target inside a 1.20.2+ range is the pack_format (no "older version" warning on the target)', () => {
  const out = buildPackMcmeta({ description: 'x', target: pf(15), range: { min: pf(9), max: pf(34) } });
  assert.deepEqual(parse(out).pack, { pack_format: 15, supported_formats: [9, 34], description: 'x' });
  assert.equal(describePackForGame(out, pf(15)), 'compatible');
  for (const g of [pf(18), pf(22), pf(34)]) assert.equal(describePackForGame(out, g), 'compatible', `game ${g.major}`);
  // 26.3 reads it as a valid (too old) pack instead of a broken one.
  assert.equal(describePackForGame(out, pf(97, 1)), 'too-old');
});

test('reversed range is normalised', () => {
  const a = buildPackMcmeta({ description: 'x', target: pf(97, 1), range: { min: pf(97, 1), max: pf(15) } });
  const b = buildPackMcmeta({ description: 'x', target: pf(97, 1), range: { min: pf(15), max: pf(97, 1) } });
  assert.equal(a, b);
});

test('old eras: 1.6.1-1.8.9 = 1, 1.9-1.10.2 = 2, 1.11-1.12.2 = 3, 1.13-1.14.4 = 4', () => {
  for (const f of [1, 2, 3, 4, 6, 13]) assert.deepEqual(parse(buildPackMcmeta({ description: 'd', target: pf(f) })).pack, { pack_format: f, description: 'd' });
});

test('every generated file validates on 1.21.9+ unless it only targets pre-1.20.2 multi-ranges', () => {
  const formats = [pf(1), pf(4), pf(15), pf(18), pf(34), pf(64), pf(69), pf(75), pf(84), pf(88), pf(97, 1), pf(98)];
  for (const lo of formats)
    for (const hi of formats) {
      if (lo.major > hi.major) continue;
      const out = buildPackMcmeta({ description: 'd', target: hi, range: { min: lo, max: hi } });
      const pack = parse(out).pack;
      if (hi.major > 64 || lo.major >= 15 || lo.major === hi.major) {
        const range = validatePackSection(pack);
        if (hi.major > 64) assert.equal(range.max.major, hi.major);
      }
      // The newest game in range always accepts the pack.
      if (hi.major > 64) assert.equal(describePackForGame(out, hi), 'compatible', `${lo.major}->${hi.major}`);
    }
});

test('description: newlines kept, string always (safest for every era)', () => {
  const out = parse(buildPackMcmeta({ description: 'Line 1\r\nLine "2" é', target: pf(97, 1) }));
  assert.equal(out.pack.description, 'Line 1\nLine "2" é');
});

// ---- Validator port vs results of the real 26.3 parser (research-cache/harness, game 97.1) ----

type Expect = ['ok', string, string, string] | ['error', string];
const VECTORS: [string, Record<string, unknown>, Expect][] = [
  ['a01_only263_min971', { description: 'Only 26.3', min_format: [97, 1], max_format: 97 }, ['ok', '97.1', '97.*', 'COMPATIBLE']],
  ['a02_only263_int', { description: 'Only 26.3', min_format: 97, max_format: 97 }, ['ok', '97.0', '97.*', 'COMPATIBLE']],
  ['a03_only263_with_packformat', { description: 'x', pack_format: 97, min_format: 97, max_format: 97 }, ['ok', '97.0', '97.*', 'COMPATIBLE']],
  ['a04_list_of_one', { description: 'x', min_format: [97], max_format: [97] }, ['ok', '97.0', '97.*', 'COMPATIBLE']],
  ['a05_max_971_exact', { description: 'x', min_format: [97, 0], max_format: [97, 1] }, ['ok', '97.0', '97.1', 'COMPATIBLE']],
  ['a06_max_970_exact', { description: 'x', min_format: [97, 0], max_format: [97, 0] }, ['ok', '97.0', '97.0', 'TOO_OLD']],
  ['a07_needs_972', { description: 'x', min_format: [97, 2], max_format: 98 }, ['ok', '97.2', '98.*', 'TOO_NEW']],
  ['b01_1201_only', { description: '1.20.1 only', pack_format: 15 }, ['ok', '15.0', '15.0', 'TOO_OLD']],
  ['b02_1165_only', { description: '1.16.5', pack_format: 6 }, ['ok', '6.0', '6.0', 'TOO_OLD']],
  ['b03_packformat97_only', { description: 'x', pack_format: 97 }, ['error', 'Pack declares support for version newer than 64, but is miss']],
  ['b04_packformat64_only', { description: 'x', pack_format: 64 }, ['ok', '64.0', '64.0', 'TOO_OLD']],
  ['b05_packformat65_only', { description: 'x', pack_format: 65 }, ['error', 'Pack declares support for version newer than 64, but is miss']],
  ['c01_span_15_97', { description: '1.20.1-26.3', pack_format: 15, supported_formats: [15, 97], min_format: 15, max_format: 97 }, ['ok', '15.0', '97.*', 'COMPATIBLE']],
  ['c02_span_sf_64', { description: 'x', pack_format: 15, supported_formats: [15, 64], min_format: 15, max_format: 97 }, ['ok', '15.0', '97.*', 'COMPATIBLE']],
  ['c03_span_obj', { description: 'x', pack_format: 15, supported_formats: { min_inclusive: 15, max_inclusive: 97 }, min_format: 15, max_format: [97, 1] }, ['ok', '15.0', '97.1', 'COMPATIBLE']],
  ['c04_span_no_packformat', { description: 'x', supported_formats: [15, 97], min_format: 15, max_format: 97 }, ['error', 'Pack declares support for formats up to 64, but game version']],
  ['c05_span_no_supported', { description: 'x', pack_format: 15, min_format: 15, max_format: 97 }, ['error', 'Pack declares support for format 15, but game versions suppo']],
  ['c06_span_mismatch_max', { description: 'x', pack_format: 15, supported_formats: [15, 80], min_format: 15, max_format: 97 }, ['error', 'Pack version declaration mismatch between supported_formats ']],
  ['c07_span_from_1', { description: 'x', pack_format: 1, supported_formats: [1, 97], min_format: 1, max_format: 97 }, ['error', 'Multi-version packs cannot support minimum version of less t']],
  ['c08_span_from_13', { description: 'x', pack_format: 13, supported_formats: [13, 97], min_format: 13, max_format: 97 }, ['error', 'Multi-version packs cannot support minimum version of less t']],
  ['c09_span_packformat_97', { description: 'x', pack_format: 97, supported_formats: [15, 97], min_format: 15, max_format: 97 }, ['ok', '15.0', '97.*', 'COMPATIBLE']],
  ['c10_new_only_with_supported', { description: 'x', supported_formats: [65, 97], min_format: 65, max_format: 97 }, ['error', 'Pack key supported_formats is deprecated starting from pack ']],
  ['c11_old_style_sf_to_97', { description: 'x', pack_format: 15, supported_formats: [15, 97] }, ['error', 'Pack declares support for version newer than 64, but is miss']],
  ['c12_old_style_sf_to_64', { description: 'x', pack_format: 34, supported_formats: [15, 64] }, ['ok', '15.0', '64.0', 'TOO_OLD']],
  ['c13_min_only', { description: 'x', min_format: 97 }, ['error', 'Pack missing field, must declare both min_format and max_for']],
  ['c14_sf_int', { description: 'x', pack_format: 15, supported_formats: 15 }, ['ok', '15.0', '15.0', 'TOO_OLD']],
  ['c15_span_18_97', { description: 'x', pack_format: 18, supported_formats: [18, 97], min_format: 18, max_format: 97 }, ['ok', '18.0', '97.*', 'COMPATIBLE']],
  ['d01_desc_obj', { description: { text: 'Hello ', color: 'gold', extra: [{ text: 'World', bold: true }] }, min_format: 97, max_format: 97 }, ['ok', '97.0', '97.*', 'COMPATIBLE']],
  ['d02_desc_array', { description: ['', { text: 'A', color: 'red' }, 'B'], min_format: 97, max_format: 97 }, ['ok', '97.0', '97.*', 'COMPATIBLE']],
  ['d03_no_desc', { min_format: 97, max_format: 97 }, ['error', 'No key description']],
];

const fmtStr = (f: PackFormat) => `${f.major}.${f.minor === 0x7fffffff ? '*' : f.minor}`;

for (const [name, pack, expect] of VECTORS) {
  test(`26.3 parser parity: ${name}`, () => {
    if (expect[0] === 'ok') {
      const range = validatePackSection(pack);
      assert.equal(fmtStr(range.min), expect[1]);
      assert.equal(fmtStr(range.max), expect[2]);
      assert.equal(packCompatibility(range, pf(97, 1)).toUpperCase().replace('-', '_'), expect[3]);
    } else {
      assert.throws(() => validatePackSection(pack), (e: Error) => e.message.startsWith(expect[1].trim()));
    }
  });
}

test('readPackMcmetaRange reads every era', () => {
  assert.deepEqual(readPackMcmetaRange('{"pack":{"pack_format":6,"description":"x"}}'), { min: pf(6), max: pf(6) });
  assert.deepEqual(readPackMcmetaRange('﻿{"pack":{"pack_format":18,"supported_formats":[18,34],"description":"x"}}'), { min: pf(18), max: pf(34) });
  assert.deepEqual(readPackMcmetaRange('{"pack":{"description":"x","min_format":[97,1],"max_format":97}}'), { min: pf(97, 1), max: pf(97, 0x7fffffff) });
  // Lenient for packs 26.3 would reject (still useful to guess a version on import)
  assert.deepEqual(readPackMcmetaRange('{"pack":{"pack_format":97,"description":"x"}}'), { min: pf(97), max: pf(97) });
  assert.equal(readPackMcmetaRange('not json'), null);
});

test('getJavaPackFormat resolves bundled versions without network', async () => {
  assert.deepEqual(await getJavaPackFormat('26.3'), pf(97, 1));
  assert.deepEqual(await getJavaPackFormat('1.20.1'), pf(15));
  assert.deepEqual(await getJavaPackFormat('1.8.9'), pf(1));
  assert.deepEqual(await getJavaPackFormat('1.21.10'), pf(69));
});

test('buildPackMcmetaForVersions (bundled versions)', async () => {
  assert.deepEqual(parse(await buildPackMcmetaForVersions('d', '26.3')).pack, { description: 'd', min_format: [97, 1], max_format: 97 });
  assert.deepEqual(parse(await buildPackMcmetaForVersions('d', '26.3', { minVersion: '1.20.1', maxVersion: '26.3' })).pack, {
    description: 'd', pack_format: 15, supported_formats: [15, 97], min_format: 15, max_format: 97,
  });
  assert.deepEqual(parse(await buildPackMcmetaForVersions('d', '1.21.1', { minVersion: '1.20.2', maxVersion: '1.21.4' })).pack, {
    pack_format: 18, supported_formats: [18, 46], description: 'd',
  });
});
