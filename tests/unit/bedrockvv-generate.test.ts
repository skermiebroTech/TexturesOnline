// Bedrock Vibrant Visuals generator tests.
// Vanilla comparison tests read a local checkout of Mojang/bedrock-samples when the
// BEDROCK_SAMPLES environment variable points at it (the folder that contains resource_pack/);
// they are skipped otherwise, since no game files are stored in this repository.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  OPTIONS, PRESETS, bedrockManifestOptions, defaults, generateBedrockVisuals, normalizeOptions, presetValues, validateBedrockVisuals,
} from '../../src/tools/shaders/bedrock/index';
import { BLOCK_LIGHTS } from '../../src/tools/shaders/bedrock/generate';
import { METADATA_FILE, parsePackMetadata } from '../../src/tools/shaders/import/metadata';
import { buildResourceManifest } from '../../src/editions/bedrock/manifest';
import type { OptionValues } from '../../src/core/types';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const SAMPLES = process.env.BEDROCK_SAMPLES ? join(process.env.BEDROCK_SAMPLES, 'resource_pack') : '';
const HAVE_SAMPLES = SAMPLES !== '' && existsSync(join(SAMPLES, 'lighting'));
const skipNoSamples = HAVE_SAMPLES ? false : 'set BEDROCK_SAMPLES to a bedrock-samples checkout to compare with vanilla';

const VV_FOLDERS = ['lighting', 'atmospherics', 'color_grading', 'water'] as const;
const ROOT: Record<string, string> = {
  lighting: 'minecraft:lighting_settings',
  atmospherics: 'minecraft:atmosphere_settings',
  color_grading: 'minecraft:color_grading_settings',
  water: 'minecraft:water_settings',
  fogs: 'minecraft:fog_settings',
};
const EXPECTED_FORMAT: Record<string, string> = {
  lighting: '1.21.80',
  atmospherics: '1.21.40',
  color_grading: '1.21.90',
  water: '1.21.120',
};

// Identifier list from the research notes (bedrock-visuals §6), independent of the generator's tables.
const RESEARCH_IDS: Record<string, string[]> = {
  lighting: ['default', 'cold', 'coolish', 'desert', 'end', 'hot', 'ice_plains_spikes', 'mangrove_swamp', 'mesa',
    'mushroom_island', 'nether', 'pale_garden', 'roofed_forest', 'swampland', 'warmish'].map((n) => `minecraft:${n}_lighting`),
  atmospherics: ['default', 'basalt_deltas', 'crimson_forest', 'desert', 'end', 'hell', 'hot', 'ice_plains_spikes', 'mangrove_swamp',
    'mesa', 'mushroom_island', 'pale_garden', 'roofed_forest', 'soulsand_valley', 'swampland', 'warmish', 'warped_forest']
    .map((n) => `minecraft:${n}_atmospherics`),
  color_grading: ['default', 'cold', 'coolish', 'desert', 'hot', 'ice_plains_spikes', 'lush_caves', 'mangrove_swamp', 'mesa',
    'mushroom_island', 'pale_garden', 'roofed_forest', 'swampland', 'warmish'].map((n) => `minecraft:${n}_color_grading`),
  water: ['minecraft:default_water'],
};

const parse = (content: unknown): Obj => {
  assert.equal(typeof content, 'string');
  return JSON.parse(content as string) as Obj;
};

function jsonFiles(files: Record<string, unknown>, folder: string): Array<[string, Obj]> {
  return Object.entries(files)
    .filter(([p]) => p.startsWith(`${folder}/`) && p.endsWith('.json'))
    .map(([p, c]) => [p, parse(c)]);
}

function identifiersOf(files: Record<string, unknown>, folder: string): string[] {
  return jsonFiles(files, folder)
    .map(([, doc]) => ((doc[ROOT[folder]] as Obj).description as Obj).identifier as string)
    .sort();
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomValues(rand: () => number): OptionValues {
  const v: OptionValues = {};
  for (const o of OPTIONS) {
    const r = rand();
    if (o.type === 'range') {
      const min = o.min ?? 0;
      const max = o.max ?? 1;
      v[o.key] = r < 0.35 ? min : r < 0.7 ? max : min + rand() * (max - min);
    } else if (o.type === 'toggle') {
      v[o.key] = r < 0.5;
    } else if (o.type === 'select') {
      const opts = o.options ?? [];
      v[o.key] = opts[Math.floor(r * opts.length)].value;
    } else {
      const pick = rand();
      v[o.key] = pick < 0.25 ? '#000000' : pick < 0.5 ? '#ffffff' : '#' + Math.floor(rand() * 0xffffff).toString(16).padStart(6, '0');
    }
  }
  return v;
}

// ------------------------------------------------------------------ structure

test('default pack contains one file per vanilla identifier with the right format_version', () => {
  const files = generateBedrockVisuals(defaults());
  for (const folder of VV_FOLDERS) {
    assert.deepEqual(identifiersOf(files, folder), [...RESEARCH_IDS[folder]].sort(), `${folder} identifiers`);
    for (const [path, doc] of jsonFiles(files, folder)) {
      assert.equal(doc.format_version, EXPECTED_FORMAT[folder], `${path} format_version`);
    }
  }
  assert.ok(files['lighting/global.json'], 'default lighting lives in the reserved global.json');
  assert.ok(files['atmospherics/atmospherics.json']);
  assert.ok(files['color_grading/color_grading.json']);
  assert.ok(files['water/water.json']);
  const shadows = parse(files['shadows/global.json']);
  assert.deepEqual(shadows, { format_version: '1.21.80', 'minecraft:shadow_settings': { shadow_style: 'soft_shadows', texel_size: 16 } });
  assert.equal(Object.keys(files).filter((p) => p.startsWith('fogs/')).length, 0, 'no fog overrides at default');
  assert.equal(files['local_lighting/local_lighting.json'], undefined);
  assert.equal(typeof files['README.txt'], 'string');
  assert.deepEqual(validateBedrockVisuals(files), []);
});

test('output is strict JSON with 2-space indentation and explicit 0.0/1.0 keyframes', () => {
  const files = generateBedrockVisuals(presetValues('fantasy'), { includeUnchangedFogs: true, version: '1.26.30', preset: 'fantasy' });
  // texturepackmaker.json (read back by the Shader Maker, ignored by the game) is not a settings file
  const meta = parsePackMetadata(files[METADATA_FILE] as string);
  assert.equal(meta?.target, 'bedrock-vibrant');
  assert.equal(meta?.version, '1.26.30');
  assert.equal(meta?.preset, 'fantasy');
  assert.deepEqual(meta?.settings, normalizeOptions(presetValues('fantasy')));
  for (const [path, content] of Object.entries(files)) {
    if (!path.endsWith('.json') || path === METADATA_FILE) continue;
    const text = content as string;
    assert.ok(text.startsWith('{\n  "format_version": '), `${path} starts with format_version`);
    assert.ok(!/\/\/|\/\*/.test(text), `${path} has no comments`);
    assert.doesNotThrow(() => JSON.parse(text), path);
    const walk = (x: Json, where: string): void => {
      if (Array.isArray(x)) return x.forEach((y, i) => walk(y, `${where}[${i}]`));
      if (x && typeof x === 'object') {
        const keys = Object.keys(x);
        if (keys.length && keys.every((k) => /^\d\.\d+$/.test(k))) {
          assert.ok(keys.includes('0.0') && keys.includes('1.0'), `${path} ${where} keyframes need 0.0 and 1.0`);
          const times = keys.map(Number);
          assert.deepEqual(times, [...times].sort((a, b) => a - b), `${path} ${where} keyframes sorted`);
          for (const k of keys) assert.ok(/^\d\.\d{1,6}$/.test(k), `${path} ${where} key ${k}`);
        }
        for (const k of keys) walk((x as Obj)[k], `${where}.${k}`);
      } else if (typeof x === 'number') {
        assert.ok(Number.isFinite(x), `${path} ${where} finite`);
      }
    };
    walk(JSON.parse(text) as Json, '');
  }
});

test('every preset validates and keeps identical tone mapping / orbit / water settings across files', () => {
  for (const p of PRESETS) {
    const files = generateBedrockVisuals(presetValues(p.id), { includeUnchangedFogs: true });
    assert.deepEqual(validateBedrockVisuals(files), [], p.id);
    const ops = new Set(jsonFiles(files, 'color_grading').map(([, d]) => ((d[ROOT.color_grading] as Obj).tone_mapping as Obj).operator));
    assert.equal(ops.size, 1, `${p.id} tone mapping`);
    const offsets = new Set(jsonFiles(files, 'lighting').map(([, d]) =>
      JSON.stringify((((d[ROOT.lighting] as Obj).directional_lights as Obj).orbital as Obj).orbital_offset_degrees)));
    assert.equal(offsets.size, 1, `${p.id} orbital offset`);
    for (const folder of VV_FOLDERS) assert.deepEqual(identifiersOf(files, folder), [...RESEARCH_IDS[folder]].sort());
  }
});

test('randomized and extreme option values always stay within documented ranges', () => {
  const rand = mulberry32(20260926);
  const extremes: OptionValues[] = [{}, {}];
  for (const o of OPTIONS) {
    if (o.type === 'range') { extremes[0][o.key] = o.min ?? 0; extremes[1][o.key] = o.max ?? 1; }
    if (o.type === 'toggle') { extremes[0][o.key] = false; extremes[1][o.key] = true; }
    if (o.type === 'color') { extremes[0][o.key] = '#000000'; extremes[1][o.key] = '#ffffff'; }
  }
  const cases = [...extremes, ...Array.from({ length: 250 }, () => randomValues(rand))];
  for (const [i, v] of cases.entries()) {
    const files = generateBedrockVisuals(v, { includeUnchangedFogs: true });
    const problems = validateBedrockVisuals(files);
    assert.deepEqual(problems, [], `case ${i}: ${JSON.stringify(v)}`);
  }
});

test('garbage input falls back to defaults instead of producing invalid files', () => {
  const junk: OptionValues = {};
  for (const o of OPTIONS) junk[o.key] = o.type === 'range' ? 'abc' : o.type === 'color' ? 'not a colour' : o.type === 'select' ? 'nope' : 'maybe';
  junk.sunBrightness = Number.POSITIVE_INFINITY;
  junk.fogAmount = -5;
  const files = generateBedrockVisuals(junk, { includeUnchangedFogs: true });
  assert.deepEqual(validateBedrockVisuals(files), []);
  const def = generateBedrockVisuals(defaults(), { includeUnchangedFogs: true });
  assert.equal(files['lighting/global.json'], def['lighting/global.json']);
});

test('validator reports out-of-range values, bad formats and inconsistent files', () => {
  const files = generateBedrockVisuals(defaults(), { includeUnchangedFogs: true });
  const broken = { ...files };
  const cg = parse(files['color_grading/desert_color_grading.json']);
  ((((cg[ROOT.color_grading] as Obj).color_grading as Obj).midtones as Obj).contrast as number[])[0] = 9;
  ((cg[ROOT.color_grading] as Obj).tone_mapping as Obj).operator = 'aces';
  broken['color_grading/desert_color_grading.json'] = JSON.stringify(cg);
  const water = parse(files['water/water.json']);
  (water[ROOT.water] as Obj).biome_water_color_contribution = 0.5;
  broken['water/water.json'] = JSON.stringify(water);
  const light = parse(files['lighting/global.json']);
  delete (((((light[ROOT.lighting] as Obj).directional_lights as Obj).orbital as Obj).sun as Obj).illuminance as Obj)['1.0'];
  broken['lighting/global.json'] = JSON.stringify(light);
  broken['fogs/default_fog_setting.json'] = '{ "format_version": "1.16.100", // comment\n }';
  const problems = validateBedrockVisuals(broken).join('\n');
  assert.match(problems, /midtones\.contrast\[0\] is 9/);
  assert.match(problems, /tone mapping differs/);
  assert.match(problems, /biome_water_color_contribution needs format_version 1\.26\.0/);
  assert.match(problems, /missing the "1\.0" keyframe/);
  assert.match(problems, /default_fog_setting\.json: invalid JSON/);
});

// ------------------------------------------------------------------ behaviour

const settingsOf = (files: Record<string, unknown>, path: string, root: string): Obj => parse(files[path])[root] as Obj;

test('adjustments are relative to each biome and Nether/End keep their own sun', () => {
  const files = generateBedrockVisuals({ ...defaults(), sunBrightness: 2, warmth: 30, contrast: 1.5 });
  const sun = (p: string) => ((((settingsOf(files, p, ROOT.lighting).directional_lights as Obj).orbital as Obj).sun as Obj).illuminance as Obj);
  assert.equal(sun('lighting/global.json')['0.0'], 200);
  assert.equal(sun('lighting/ice_plains_spikes_lighting.json')['0.0'], 100);
  assert.equal(sun('lighting/pale_garden_lighting.json')['0.0'], 10);
  assert.equal(sun('lighting/nether_lighting.json')['0.0'], 100);
  assert.equal(sun('lighting/end_lighting.json')['0.0'], 100);
  const grade = (p: string) => (settingsOf(files, p, ROOT.color_grading).color_grading as Obj);
  const t = (p: string) => (grade(p).temperature as Obj).temperature as number;
  assert.ok(t('color_grading/color_grading.json') < 6500, 'warmer = lower kelvin');
  assert.ok(t('color_grading/desert_color_grading.json') < 4400);
  assert.ok(t('color_grading/cold_color_grading.json') < 10000 && t('color_grading/cold_color_grading.json') > t('color_grading/color_grading.json'));
  const contrast = (p: string) => ((grade(p).midtones as Obj).contrast as number[])[0];
  assert.equal(contrast('color_grading/color_grading.json'), 1.5);
  assert.ok(Math.abs(contrast('color_grading/hot_color_grading.json') - 1.3 * 1.5 / 1.15) < 1e-5);
});

test('colour shifts touch only their time window', () => {
  const files = generateBedrockVisuals({ ...defaults(), daylightColor: '#ffffff', nightSkyColor: '#000030' });
  const s = settingsOf(files, 'lighting/global.json', ROOT.lighting);
  const color = (((s.directional_lights as Obj).orbital as Obj).sun as Obj).color as Obj;
  assert.deepEqual(color['1.0'], [255, 255, 255]);
  assert.deepEqual(color['0.242908'], [255, 127, 0], 'sunset key untouched');
  const a = settingsOf(files, 'atmospherics/atmospherics.json', ROOT.atmospherics);
  const zen = a.sky_zenith_color as Obj;
  assert.deepEqual(zen['0.0'], [103, 130, 170], 'day sky untouched');
  assert.deepEqual(zen['0.35256'], [0, 0, 48]);
  const hell = settingsOf(files, 'atmospherics/hell_atmospherics.json', ROOT.atmospherics);
  assert.deepEqual((hell.sky_zenith_color as Obj)['0.0'], [51, 8, 8], 'Nether sky untouched');
});

test('26.0 features raise format versions and the manifest minimum engine', () => {
  const base = defaults();
  assert.deepEqual(bedrockManifestOptions(base), { capabilities: ['pbr'], minEngine: [1, 21, 120] });

  const night = { ...base, nightBrightness: 0.5 };
  const nf = generateBedrockVisuals(night);
  for (const [path, doc] of jsonFiles(nf, 'lighting')) assert.equal(doc.format_version, '1.26.0', path);
  const amb = (settingsOf(nf, 'lighting/global.json', ROOT.lighting).ambient as Obj).illuminance as Obj;
  assert.equal(amb['0.0'], 0.02);
  assert.equal(amb['0.5'] ?? amb['0.3'], 0.17);
  assert.equal(typeof (settingsOf(nf, 'lighting/nether_lighting.json', ROOT.lighting).ambient as Obj).illuminance, 'number');
  assert.deepEqual(bedrockManifestOptions(night).minEngine, [1, 26, 0]);
  assert.deepEqual(validateBedrockVisuals(nf), []);

  const water = { ...base, biomeWaterColor: 0.3 };
  const wf = generateBedrockVisuals(water);
  const wdoc = parse(wf['water/water.json']);
  assert.equal(wdoc.format_version, '1.26.0');
  assert.equal((wdoc[ROOT.water] as Obj).biome_water_color_contribution, 0.3);
  assert.deepEqual(bedrockManifestOptions(water).minEngine, [1, 26, 0]);
});

test('fog overrides: volumetric changes, classic fog toggle and underwater visibility', () => {
  const vol = generateBedrockVisuals({ ...defaults(), fogAmount: 2 });
  const fogPaths = Object.keys(vol).filter((p) => p.startsWith('fogs/'));
  assert.ok(fogPaths.length > 30, 'fogs with volumetric density are written');
  const swamp = settingsOf(vol, 'fogs/swampland_fog_setting.json', ROOT.fogs);
  assert.equal(((((swamp.volumetric as Obj).density as Obj).air as Obj).max_density), 0.1);
  assert.equal((((swamp.distance as Obj).water as Obj).fog_end), 30, 'distance fog kept while classic fog is off');
  assert.equal(vol['fogs/desert_fog_setting.json'], undefined, 'zero-density fog unchanged, not written');

  const ignored = generateBedrockVisuals({ ...defaults(), fogDistance: 0.5, underwaterVisibility: 3 });
  assert.equal(Object.keys(ignored).filter((p) => p.startsWith('fogs/')).length, 0, 'classic fog controls need the toggle');

  const classic = generateBedrockVisuals({ ...defaults(), classicFog: true, fogDistance: 0.5, underwaterVisibility: 2 });
  const def = settingsOf(classic, 'fogs/default_fog_setting.json', ROOT.fogs).distance as Obj;
  assert.equal((def.air as Obj).fog_start, 0.46);
  assert.equal((def.air as Obj).fog_end, 0.5);
  assert.equal((def.water as Obj).fog_end, 120);
  assert.equal((def.lava as Obj).fog_end, 0.64, 'lava fog untouched');
  const hell = settingsOf(classic, 'fogs/hell_fog_setting.json', ROOT.fogs).distance as Obj;
  assert.equal((hell.air as Obj).fog_end, 48);
  assert.deepEqual(validateBedrockVisuals(classic), []);

  const far = generateBedrockVisuals({ ...defaults(), classicFog: true, fogDistance: 2 });
  const air = (settingsOf(far, 'fogs/default_fog_setting.json', ROOT.fogs).distance as Obj).air as Obj;
  assert.equal(air.fog_start, 0.99, 'fog keeps a small ramp at the edge of render distance');
  assert.equal(air.fog_end, 1);
});

test('shadows, colored lights, split toning and water options map onto their files', () => {
  const files = generateBedrockVisuals({
    ...defaults(), blockyShadows: true, shadowTexel: '32', coloredLights: true, torchColor: '#ff0000',
    splitTone: true, waves: true, waveHeight: 2, caustics: false, causticsStrength: 4, waterStyle: 'muddy',
  });
  assert.deepEqual(parse(files['shadows/global.json'])['minecraft:shadow_settings'], { shadow_style: 'blocky_shadows', texel_size: 32 });
  const lights = settingsOf(files, 'local_lighting/local_lighting.json', 'minecraft:local_light_settings');
  assert.equal((lights['minecraft:torch'] as Obj).light_type, 'point_light');
  assert.deepEqual((lights['minecraft:torch'] as Obj).light_color, [255, 0, 0]);
  assert.deepEqual((lights['minecraft:soul_torch'] as Obj).light_color, [0, 255, 255], 'soul fire keeps its colour');
  assert.equal((lights['minecraft:glowstone'] as Obj).light_type, 'static_light');
  const cg = settingsOf(files, 'color_grading/mesa_color_grading.json', ROOT.color_grading).color_grading as Obj;
  assert.equal((cg.highlights as Obj).enabled, true);
  assert.equal((cg.shadows as Obj).enabled, true);
  const w = settingsOf(files, 'water/water.json', ROOT.water);
  assert.equal((w.waves as Obj).enabled, true);
  assert.equal((w.waves as Obj).depth, 2);
  assert.equal((w.caustics as Obj).enabled, false);
  assert.equal((w.caustics as Obj).power, 4);
  assert.ok(((w.particle_concentrations as Obj).suspended_sediment as number) > 50);
  assert.deepEqual(validateBedrockVisuals(files), []);
});

test('saturated tints do not flood the image; black tint is neutral', () => {
  const gainOf = (files: Record<string, unknown>) =>
    ((((settingsOf(files, 'color_grading/color_grading.json', ROOT.color_grading).color_grading as Obj).midtones as Obj).gain) as number[]);
  const red = gainOf(generateBedrockVisuals({ ...defaults(), tint: '#ff0000' }));
  assert.ok(red[0] > 1.2 && red[0] <= 1.5 && red[1] >= 0.5 && red[2] >= 0.5, `red tint gain ${red}`);
  assert.deepEqual(gainOf(generateBedrockVisuals({ ...defaults(), tint: '#000000' })), [1, 1, 1]);
  const split = settingsOf(generateBedrockVisuals({ ...defaults(), splitTone: true, shadowTint: '#0000ff', highlightTint: '#ff0000' }),
    'color_grading/color_grading.json', ROOT.color_grading).color_grading as Obj;
  for (const band of ['shadows', 'highlights']) {
    for (const g of (split[band] as Obj).gain as number[]) assert.ok(g >= 0.5 && g <= 1.5, `${band} gain ${g}`);
  }
});

test('classic fog toggle alone writes nothing and the readme does not claim fog changes', () => {
  const files = generateBedrockVisuals({ ...defaults(), classicFog: true });
  assert.equal(Object.keys(files).filter((p) => p.startsWith('fogs/')).length, 0);
  assert.doesNotMatch(files['README.txt'] as string, /Simple and Fancy/);
  const changed = generateBedrockVisuals({ ...defaults(), classicFog: true, underwaterVisibility: 2 });
  assert.match(changed['README.txt'] as string, /Simple and Fancy/);
});

test('colored block light covers lava and other common light sources with unique namespaced ids', () => {
  const ids = BLOCK_LIGHTS.map((l) => l.block);
  assert.equal(new Set(ids).size, ids.length, 'unique block ids');
  for (const id of ids) assert.match(id, /^minecraft:[a-z0-9_]+$/);
  for (const id of ['minecraft:lava', 'minecraft:flowing_lava', 'minecraft:magma', 'minecraft:lit_redstone_ore', 'minecraft:copper_bulb',
    'minecraft:waxed_oxidized_copper_bulb', 'minecraft:cave_vines_head_with_berries', 'minecraft:torch', 'minecraft:glowstone']) {
    assert.ok(ids.includes(id), id);
  }
  // Blocks the game always treats as point lights must keep that type (it cannot be changed).
  for (const id of ['torch', 'redstone_torch', 'end_rod', 'lantern', 'soul_lantern', 'soul_torch', 'candle', 'sea_pickle', 'copper_torch', 'copper_lantern']) {
    assert.equal(BLOCK_LIGHTS.find((l) => l.block === `minecraft:${id}`)?.type, 'point_light', id);
  }
  const files = generateBedrockVisuals({ ...defaults(), coloredLights: true });
  const lights = settingsOf(files, 'local_lighting/local_lighting.json', 'minecraft:local_light_settings');
  assert.equal(Object.keys(lights).length, ids.length);
  const distinct = new Set(Object.values(lights).map((l) => JSON.stringify((l as Obj).light_color)));
  assert.ok(distinct.size <= 32, `few distinct light colours (${distinct.size})`);
});

test('full pack with the manifest from bedrockManifestOptions validates; bad manifests are reported', () => {
  const uuids = { header: '11111111-1111-4111-8111-111111111111', module: '22222222-2222-4222-8222-222222222222' };
  for (const v of [defaults(), { ...defaults(), nightBrightness: 0.5 }, { ...defaults(), biomeWaterColor: 0.4 }, presetValues('fantasy')]) {
    const files = {
      ...generateBedrockVisuals(v),
      'manifest.json': buildResourceManifest({ name: 'Visuals', description: 'Test', uuids, version: [1, 0, 0], ...bedrockManifestOptions(v) }),
      'pack_icon.png': new Uint8Array([137, 80, 78, 71]),
      'textures/blocks/stone.texture_set.json': '{"format_version":"1.21.30","minecraft:texture_set":{"color":"stone"}}',
    };
    assert.deepEqual(validateBedrockVisuals(files), [], JSON.stringify(bedrockManifestOptions(v)));
  }
  const night = generateBedrockVisuals({ ...defaults(), nightBrightness: 0.5 });
  const old = buildResourceManifest({ name: 'V', description: '', uuids, version: [1, 0, 0], capabilities: ['pbr'], minEngine: [1, 21, 120] });
  assert.match(validateBedrockVisuals({ ...night, 'manifest.json': old }).join('\n'), /older than format_version 1\.26\.0/);
  const plain = buildResourceManifest({ name: 'V', description: '', uuids, version: [1, 0, 0] });
  const problems = validateBedrockVisuals({ ...generateBedrockVisuals(defaults()), 'manifest.json': plain }).join('\n');
  assert.match(problems, /capabilities must include "pbr"/);
  assert.match(problems, /need 1\.21\.120 or newer/);
});

// ------------------------------------------------------------------ vanilla comparison

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function readVanilla(folder: string): Array<[string, Obj]> {
  return readdirSync(join(SAMPLES, folder))
    .filter((f) => f.endsWith('.json'))
    .map((f) => [f, JSON.parse(stripComments(readFileSync(join(SAMPLES, folder, f), 'utf8'))) as Obj]);
}

const isHex = (x: Json): x is string => typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x);
const hexToRgb = (h: string): number[] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const isKeyframes = (x: Json): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length > 0 &&
  Object.keys(x).every((k) => /^\d(\.\d+)?$/.test(k));

/** Asserts that every value present in `vanilla` is reproduced in `generated` (float tolerance). */
function assertCovers(vanilla: Json, generated: Json, where: string): void {
  if (isHex(vanilla) && (Array.isArray(generated) || isHex(generated))) {
    assert.deepEqual(isHex(generated) ? hexToRgb(generated) : generated, hexToRgb(vanilla), where);
    return;
  }
  if (typeof vanilla === 'number') {
    assert.equal(typeof generated, 'number', `${where} should be a number`);
    assert.ok(Math.abs((generated as number) - vanilla) <= 1e-5 * Math.max(1, Math.abs(vanilla)), `${where}: ${generated} vs vanilla ${vanilla}`);
    return;
  }
  if (Array.isArray(vanilla)) {
    assert.ok(Array.isArray(generated) && generated.length === vanilla.length, `${where} array`);
    vanilla.forEach((x, i) => assertCovers(x, (generated as Json[])[i], `${where}[${i}]`));
    return;
  }
  if (isKeyframes(vanilla)) {
    assert.ok(isKeyframes(generated), `${where} should be keyframes`);
    const gen = new Map(Object.entries(generated as Obj).map(([k, v]) => [Number(k).toFixed(6), v]));
    for (const [k, v] of Object.entries(vanilla)) {
      const key = Number(k).toFixed(6);
      assert.ok(gen.has(key), `${where} missing keyframe ${k}`);
      assertCovers(v, gen.get(key) as Json, `${where}["${k}"]`);
    }
    const vanillaKeys = new Set(Object.keys(vanilla).map((k) => Number(k).toFixed(6)));
    for (const k of gen.keys()) {
      assert.ok(vanillaKeys.has(k) || k === '0.000000' || k === '1.000000', `${where} unexpected keyframe ${k}`);
    }
    return;
  }
  if (vanilla && typeof vanilla === 'object') {
    assert.ok(generated && typeof generated === 'object' && !Array.isArray(generated), `${where} should be an object`);
    for (const [k, v] of Object.entries(vanilla)) {
      assert.ok(k in (generated as Obj), `${where}.${k} missing`);
      assertCovers(v, (generated as Obj)[k], `${where}.${k}`);
    }
    return;
  }
  assert.deepEqual(generated, vanilla, where);
}

/** Legacy (1.21.40-1.21.70) lighting puts sun/moon/offset directly under directional_lights. */
function modernLighting(doc: Obj): Obj {
  const s = doc[ROOT.lighting] as Obj;
  const dl = s.directional_lights as Obj;
  if (dl.orbital) return s;
  const { sun, moon, orbital_offset_degrees, ...rest } = dl;
  const orbital: Obj = { sun, moon };
  if (orbital_offset_degrees !== undefined) orbital.orbital_offset_degrees = orbital_offset_degrees;
  return { ...s, directional_lights: { ...rest, orbital } };
}

test('vanilla identifiers derived from bedrock-samples match the generated set', { skip: skipNoSamples }, () => {
  const files = generateBedrockVisuals(defaults(), { includeUnchangedFogs: true });
  for (const folder of [...VV_FOLDERS, 'fogs']) {
    const vanillaIds = readVanilla(folder).map(([, d]) => ((d[ROOT[folder]] as Obj).description as Obj).identifier as string).sort();
    assert.deepEqual(identifiersOf(files, folder), vanillaIds, folder);
    const vanillaFiles = readVanilla(folder).map(([f]) => f).sort();
    assert.deepEqual(jsonFiles(files, folder).map(([p]) => p.slice(folder.length + 1)).sort(), vanillaFiles, `${folder} file names`);
  }
});

test('Default preset reproduces every vanilla value (lighting, sky, grading, water, fog)', { skip: skipNoSamples }, () => {
  const files = generateBedrockVisuals(presetValues('default'), { includeUnchangedFogs: true });
  for (const folder of [...VV_FOLDERS, 'fogs']) {
    for (const [name, vanilla] of readVanilla(folder)) {
      const path = `${folder}/${name}`;
      const generated = parse(files[path]);
      if (folder === 'lighting') {
        assertCovers(modernLighting(vanilla) as Json, generated[ROOT.lighting], path);
      } else {
        assert.equal(generated.format_version, vanilla.format_version, `${path} format_version`);
        assertCovers(vanilla[ROOT[folder]], generated[ROOT[folder]], path);
      }
    }
  }
});

test('default lighting fills fields that per-biome vanilla files omit from the global defaults', { skip: skipNoSamples }, () => {
  const files = generateBedrockVisuals(defaults());
  const global = modernLighting(readVanilla('lighting').find(([f]) => f === 'global.json')![1]);
  for (const [path, doc] of jsonFiles(files, 'lighting')) {
    const s = doc[ROOT.lighting] as Obj;
    for (const k of ['emissive', 'ambient', 'sky']) assert.ok(s[k], `${path} has ${k}`);
    assert.ok((s.directional_lights as Obj).flash, `${path} has flash`);
    if (path.endsWith('_lighting.json') && !/(nether|end)_lighting/.test(path)) {
      assertCovers(global.sky as Json, s.sky, `${path} sky`);
      assertCovers(global.emissive as Json, s.emissive, `${path} emissive`);
    }
  }
});

test('colored block light ids exist in the engine block list', { skip: skipNoSamples }, () => {
  const meta = join(SAMPLES, '..', 'metadata', 'doc_modules', 'addons.json');
  if (!existsSync(meta)) return;
  const known = new Set(readFileSync(meta, 'utf8').match(/minecraft:[a-z0-9_]+/g) ?? []);
  for (const l of BLOCK_LIGHTS) assert.ok(known.has(l.block), `${l.block} is not a known block`);
});
