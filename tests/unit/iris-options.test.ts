// Iris / OptiFine shader maker: option schema, presets, normalisation and preview mapping.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  GROUPS, OPTIONS, PRESETS, defaults, normalizeOptions, presetValues, readSettings, toPreviewParams, parseHexColor, toHexColor,
} from '../../src/tools/shaders/iris/index';
import { defaultPreviewParams, sanitizePreviewParams } from '../../src/shared/preview/shader-preview';
import type { OptionValues, PreviewParams } from '../../src/core/types';
import { mulberry32, randomOptions } from '../tools/iris/fixtures';

const HEX = /^#[0-9a-f]{6}$/;

test('OPTIONS: well-formed, grouped and beginner friendly', () => {
  const keys = new Set<string>();
  const groups = new Set<string>(Object.values(GROUPS));
  assert.ok(OPTIONS.length >= 30 && OPTIONS.length <= 50, `option count ${OPTIONS.length}`);
  for (const o of OPTIONS) {
    assert.ok(!keys.has(o.key), `duplicate key ${o.key}`);
    keys.add(o.key);
    assert.ok(groups.has(o.group), `${o.key}: unknown group ${o.group}`);
    assert.ok(o.label.length > 2 && o.label.length <= 32, `${o.key}: label`);
    assert.ok(o.description && o.description.length >= 10 && o.description.length <= 200, `${o.key}: description`);
    if (o.type === 'range') {
      assert.equal(typeof o.default, 'number');
      assert.ok(o.min !== undefined && o.max !== undefined && o.step !== undefined && o.min < o.max && o.step > 0, `${o.key}: range`);
      const d = o.default as number;
      assert.ok(d >= o.min! && d <= o.max!, `${o.key}: default in range`);
      const k = (d - o.min!) / o.step!;
      assert.ok(Math.abs(k - Math.round(k)) < 1e-6, `${o.key}: default on a step`);
    } else if (o.type === 'toggle') {
      assert.equal(typeof o.default, 'boolean');
    } else if (o.type === 'select') {
      assert.ok(o.options && o.options.length >= 2, `${o.key}: options`);
      assert.ok(o.options.some((x) => x.value === o.default), `${o.key}: default is an option`);
    } else {
      assert.match(o.default as string, HEX, `${o.key}: colour default`);
    }
    if (o.dependsOn) {
      const parent = OPTIONS.find((p) => p.key === o.dependsOn);
      assert.ok(parent && parent.type === 'toggle', `${o.key}: dependsOn must name a toggle`);
    }
  }
  for (const g of groups) assert.ok(OPTIONS.some((o) => o.group === g), `group ${g} is empty`);
  // Every feature the pack offers has a control.
  for (const k of ['shadows', 'shadowBrightness', 'shadowSoftness', 'shadowResolution', 'shadowDistance', 'cloudShadows', 'handLight',
    'wavingLeaves', 'wavingPlants', 'wavingCrops', 'wavingVines', 'wavingAmount', 'wavingSpeed', 'waterColor', 'waterTransparency',
    'waterWaves', 'waterReflections', 'skyColor', 'horizonColor', 'sunsetColor', 'nightSkyColor', 'fogDensity', 'rainFog',
    'bloomStrength', 'bloomThreshold', 'tonemap', 'exposure', 'contrast', 'saturation', 'vibrance', 'temperature', 'tint', 'gamma',
    'vignette', 'godrays', 'nightBrightness', 'torchColor', 'torchStrength']) {
    assert.ok(keys.has(k), `missing option ${k}`);
  }
});

test('defaults(): every option, fresh object each call, already normalised', () => {
  const d = defaults();
  assert.deepEqual(Object.keys(d).sort(), OPTIONS.map((o) => o.key).sort());
  assert.notEqual(defaults(), defaults());
  assert.deepEqual(normalizeOptions(d), d);
});

test('PRESETS: the nine looks, valid values that survive normalisation', () => {
  assert.deepEqual(PRESETS.map((p) => p.id), ['default', 'cinematic', 'vibrant', 'soft', 'noir', 'fantasy', 'golden', 'performance', 'ultra']);
  const labels = PRESETS.map((p) => p.label);
  for (const l of ['Default', 'Cinematic', 'Vibrant', 'Soft & Dreamy', 'Noir', 'Fantasy', 'Golden Hour', 'Performance', 'Ultra']) {
    assert.ok(labels.includes(l), `preset label ${l}`);
  }
  const keys = new Set(OPTIONS.map((o) => o.key));
  for (const p of PRESETS) {
    assert.ok(p.description.length > 20, `${p.id}: description`);
    assert.match(p.swatch[0], HEX);
    assert.match(p.swatch[1], HEX);
    for (const k of Object.keys(p.values)) assert.ok(keys.has(k), `${p.id}: unknown option ${k}`);
    const values = presetValues(p.id);
    assert.deepEqual(normalizeOptions(values), values, `${p.id}: values are valid as given`);
  }
  assert.deepEqual(presetValues('default'), defaults());
  assert.deepEqual(presetValues('no-such-preset'), defaults());
  // Presets really differ from each other.
  const seen = new Set(PRESETS.map((p) => JSON.stringify(presetValues(p.id))));
  assert.equal(seen.size, PRESETS.length);
  assert.equal(presetValues('performance').shadows, false);
  assert.equal(presetValues('ultra').shadowResolution, '4096');
  assert.equal(presetValues('noir').saturation, 0);
});

test('normalizeOptions / readSettings: clamps, snaps, repairs and drops garbage', () => {
  const messy = {
    sunStrength: 99, exposure: -7, contrast: '1.234', saturation: Number.NaN, shadows: 'false', handLight: 0, cloudShadows: 1,
    tonemap: 'nope', shadowResolution: 4096, effectQuality: 'ULTRA', skyColor: '#ABC', waterColor: 'blue', sunAngle: -33,
    shadowDistance: 100, unknownKey: 5, __proto__: { polluted: true },
  } as unknown as OptionValues;
  const n = normalizeOptions(messy);
  assert.equal(n.sunStrength, 3);
  assert.equal(n.exposure, -2);
  assert.equal(n.contrast, 1.23);
  assert.equal(n.saturation, 1);
  assert.equal(n.shadows, false);
  assert.equal(n.handLight, false);
  assert.equal(n.cloudShadows, true);
  assert.equal(n.tonemap, 'aces');
  assert.equal(n.shadowResolution, '4096');
  assert.equal(n.effectQuality, 'medium');
  assert.equal(n.skyColor, '#aabbcc');
  assert.equal(n.waterColor, '#2f7ac4');
  assert.equal(n.sunAngle, -35);
  assert.equal(n.shadowDistance, 96);
  assert.ok(!('unknownKey' in n));
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.deepEqual(normalizeOptions(null), defaults());
  assert.deepEqual(normalizeOptions(undefined), defaults());
  const s = readSettings({ sunColor: '#102030' });
  assert.deepEqual(s.sunColor, [16, 32, 48]);
  assert.equal(readSettings({}).tonemap, 'aces');
  assert.deepEqual(parseHexColor('fff'), [255, 255, 255]);
  assert.equal(parseHexColor('#12345'), null);
  assert.equal(toHexColor([300, -4, 127.6]), '#ff0080');
  const rand = mulberry32(7);
  for (let i = 0; i < 50; i++) {
    const v = normalizeOptions(randomOptions(rand));
    assert.deepEqual(normalizeOptions(v), v, 'normalisation is idempotent');
  }
});

function assertParamsValid(p: PreviewParams, label: string): void {
  assert.deepEqual(sanitizePreviewParams(p), p, `${label}: already within the preview's ranges`);
  for (const [k, v] of Object.entries(p)) {
    if (Array.isArray(v)) for (const x of v) assert.ok(Number.isFinite(x), `${label}: ${k}`);
    else assert.ok(Number.isFinite(v), `${label}: ${k}`);
  }
}

test('toPreviewParams: valid for defaults, presets and random options', () => {
  const d = toPreviewParams(defaults());
  assertParamsValid(d, 'defaults');
  // Defaults resemble the preview's own neutral look.
  const n = defaultPreviewParams();
  assert.ok(Math.abs(d.exposure - n.exposure) < 0.1);
  assert.equal(d.contrast, 1);
  assert.ok(d.shadowStrength > 0.5);
  assert.ok(d.waving > 0.3);
  assert.deepEqual(d.skyTop.map((x) => Math.round(x * 100)), [39, 60, 93]);
  for (const p of PRESETS) assertParamsValid(toPreviewParams(presetValues(p.id)), p.id);
  const rand = mulberry32(42);
  for (let i = 0; i < 100; i++) assertParamsValid(toPreviewParams(randomOptions(rand, i % 2 === 0)), `random ${i}`);
  assertParamsValid(toPreviewParams({}), 'empty');
});

test('toPreviewParams: follows the options in the expected direction', () => {
  const base = toPreviewParams(defaults());
  const p = (id: string): PreviewParams => toPreviewParams(presetValues(id));
  assert.equal(p('performance').shadowStrength, 0);
  assert.equal(p('performance').bloom, 0);
  assert.equal(p('performance').godrays, 0);
  assert.equal(p('noir').grayscale, 1);
  assert.ok(p('noir').vignette > base.vignette);
  assert.ok(p('vibrant').saturation > base.saturation);
  assert.ok(p('golden').temperature > 0);
  assert.ok(p('soft').bloom > base.bloom);
  assert.ok(p('cinematic').godrays > base.godrays);
  const noWaving = toPreviewParams({ ...defaults(), wavingLeaves: false, wavingPlants: false, wavingCrops: false, wavingVines: false });
  assert.equal(noWaving.waving, 0);
  const brighter = toPreviewParams({ ...defaults(), exposure: 1 });
  assert.ok(brighter.exposure > base.exposure * 1.8);
  const clear = toPreviewParams({ ...defaults(), waterTransparency: 1, waterColor: '#ff0000' });
  assert.equal(clear.waterClarity, 1);
  assert.deepEqual(clear.waterColor, [1, 0, 0]);
  const vanillaSky = toPreviewParams({ ...defaults(), customSky: 0, skyColor: '#ff0000' });
  assert.ok(vanillaSky.skyTop[2] > vanillaSky.skyTop[0], 'customSky 0 shows the vanilla sky');
  const warmTint = toPreviewParams({ ...defaults(), tint: 1 });
  assert.ok(warmTint.tint[0] > warmTint.tint[1] && warmTint.tint[2] > warmTint.tint[1], 'positive tint is magenta');
});
