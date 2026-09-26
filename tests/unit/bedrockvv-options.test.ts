import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BEDROCK_VV_NOTES, GROUPS, OPTIONS, PRESETS, bedrockCompatibilityNotes, bedrockManifestOptions, defaults,
  normalizeOptions, presetValues, readSettings, toPreviewParams,
} from '../../src/tools/shaders/bedrock/index';
import type { OptionValues, PreviewParams } from '../../src/core/types';

const HEX = /^#[0-9a-f]{6}$/i;

test('options are well formed, grouped and beginner sized', () => {
  const keys = new Set<string>();
  const groups = new Set(Object.values(GROUPS));
  for (const o of OPTIONS) {
    assert.ok(!keys.has(o.key), `duplicate key ${o.key}`);
    keys.add(o.key);
    assert.ok(groups.has(o.group as never), `${o.key} group ${o.group}`);
    assert.ok(o.label.length > 0 && o.label.length <= 28, `${o.key} label length`);
    if (o.type === 'range') {
      assert.equal(typeof o.default, 'number');
      assert.ok(o.min !== undefined && o.max !== undefined && o.min < o.max, `${o.key} range`);
      assert.ok((o.default as number) >= o.min! && (o.default as number) <= o.max!, `${o.key} default in range`);
      assert.ok(o.step !== undefined && o.step > 0, `${o.key} step`);
    } else if (o.type === 'toggle') {
      assert.equal(typeof o.default, 'boolean');
    } else if (o.type === 'select') {
      assert.ok(o.options && o.options.length > 1, `${o.key} options`);
      assert.ok(o.options.some((x) => x.value === o.default), `${o.key} default is an option`);
    } else {
      assert.match(String(o.default), HEX, `${o.key} colour default`);
    }
    if (o.dependsOn) {
      const parent = OPTIONS.find((p) => p.key === o.dependsOn);
      assert.equal(parent?.type, 'toggle', `${o.key} depends on a toggle`);
    }
  }
  for (const g of groups) assert.ok(OPTIONS.some((o) => o.group === g), `group ${g} used`);
  const visible = OPTIONS.filter((o) => !o.dependsOn).length;
  assert.ok(visible >= 20 && visible <= 34, `visible controls: ${visible}`);
});

test('presets cover the planned looks and only use valid values', () => {
  const ids = PRESETS.map((p) => p.id);
  for (const id of ['default', 'cinematic', 'vivid', 'soft', 'noir', 'golden', 'fantasy', 'clearwater', 'performance']) {
    assert.ok(ids.includes(id), `preset ${id}`);
  }
  assert.equal(new Set(ids).size, ids.length, 'unique preset ids');
  assert.deepEqual(PRESETS[0].values, {}, 'Default preset is vanilla');
  for (const p of PRESETS) {
    assert.ok(p.label && p.description, p.id);
    assert.match(p.swatch[0], HEX);
    assert.match(p.swatch[1], HEX);
    for (const [k, v] of Object.entries(p.values)) {
      const o = OPTIONS.find((x) => x.key === k);
      assert.ok(o, `${p.id}: unknown option ${k}`);
      if (o.type === 'range') {
        assert.equal(typeof v, 'number', `${p.id}.${k}`);
        assert.ok((v as number) >= o.min! && (v as number) <= o.max!, `${p.id}.${k} in range`);
      } else if (o.type === 'toggle') assert.equal(typeof v, 'boolean', `${p.id}.${k}`);
      else if (o.type === 'select') assert.ok(o.options!.some((x) => x.value === v), `${p.id}.${k} option`);
      else assert.match(String(v), HEX, `${p.id}.${k}`);
    }
    assert.deepEqual(normalizeOptions(presetValues(p.id)), presetValues(p.id), `${p.id} survives normalization`);
  }
});

test('defaults() and normalizeOptions() agree and clean bad input', () => {
  const d = defaults();
  assert.equal(Object.keys(d).length, OPTIONS.length);
  assert.deepEqual(normalizeOptions({}), d);
  assert.deepEqual(normalizeOptions(null), d);
  const n = normalizeOptions({ sunBrightness: 99, contrast: '1.3', skyColor: '#ABC', toneMapper: 'bogus', waves: 'true', causticsStrength: 2.6, extra: 1 });
  assert.equal(n.sunBrightness, 4);
  assert.equal(n.contrast, 1.3);
  assert.equal(n.skyColor, '#aabbcc');
  assert.equal(n.toneMapper, 'generic');
  assert.equal(n.waves, true);
  assert.equal(n.causticsStrength, 3);
  assert.equal('extra' in n, false);
  const s = readSettings({ fogAmount: Number.NaN, shadowTexel: 64 });
  assert.equal(s.fogAmount, 1);
  assert.equal(s.shadowTexel, 64);
});

function assertSaneParams(p: PreviewParams, label: string): void {
  const unit = (x: number, name: string) => assert.ok(Number.isFinite(x) && x >= 0 && x <= 1, `${label} ${name}=${x}`);
  const rgb = (c: [number, number, number], name: string) => {
    assert.equal(c.length, 3, `${label} ${name}`);
    c.forEach((x, i) => unit(x, `${name}[${i}]`));
  };
  assert.ok(p.exposure > 0 && p.exposure <= 3, `${label} exposure ${p.exposure}`);
  assert.ok(p.contrast > 0 && p.contrast <= 2.5, `${label} contrast`);
  assert.ok(p.saturation >= 0 && p.saturation <= 2.5, `${label} saturation`);
  assert.ok(p.gamma > 0, `${label} gamma`);
  assert.ok(p.temperature >= -1 && p.temperature <= 1, `${label} temperature`);
  p.tint.forEach((x) => assert.ok(Number.isFinite(x) && x >= 0 && x <= 2, `${label} tint`));
  for (const k of ['vignette', 'bloom', 'shadowStrength', 'fogDensity', 'waterClarity', 'waving', 'godrays', 'grayscale', 'sepia'] as const) unit(p[k], k);
  for (const k of ['sunColor', 'skyTop', 'skyHorizon', 'fogColor', 'waterColor'] as const) rgb(p[k], k);
  assert.ok(p.timeOfDay >= 0 && p.timeOfDay <= 24000, `${label} timeOfDay`);
  assert.ok(p.posterize === 0 || (p.posterize >= 2 && p.posterize <= 32), `${label} posterize`);
}

test('toPreviewParams returns sane values for defaults, presets and extremes', () => {
  const d = toPreviewParams(defaults());
  assertSaneParams(d, 'default');
  assert.equal(d.exposure, 1);
  assert.equal(d.temperature, 0);
  assert.deepEqual(d.tint, [1, 1, 1]);
  assert.deepEqual(d.skyTop.map((x) => Math.round(x * 255)), [103, 130, 170]);
  for (const p of PRESETS) assertSaneParams(toPreviewParams(presetValues(p.id)), p.id);
  const lo: OptionValues = {};
  const hi: OptionValues = {};
  for (const o of OPTIONS) {
    if (o.type === 'range') { lo[o.key] = o.min!; hi[o.key] = o.max!; }
    if (o.type === 'toggle') { lo[o.key] = false; hi[o.key] = true; }
    if (o.type === 'color') { lo[o.key] = '#000000'; hi[o.key] = '#ffffff'; }
  }
  assertSaneParams(toPreviewParams(lo), 'min');
  assertSaneParams(toPreviewParams(hi), 'max');
  assert.ok(toPreviewParams(presetValues('noir')).saturation < 0.3);
  assert.ok(toPreviewParams(presetValues('golden')).temperature > 0);
  assert.ok(toPreviewParams({ ...defaults(), fogAmount: 3 }).fogDensity > d.fogDensity);
});

test('manifest options and user notes', () => {
  for (const p of PRESETS) {
    const m = bedrockManifestOptions(presetValues(p.id));
    assert.deepEqual(m.capabilities, ['pbr']);
    assert.ok(m.minEngine[0] === 1 && (m.minEngine[1] > 21 || (m.minEngine[1] === 21 && m.minEngine[2] >= 120)), `${p.id} min engine`);
  }
  assert.deepEqual(bedrockCompatibilityNotes(defaults()), []);
  const notes = bedrockCompatibilityNotes({ ...defaults(), nightBrightness: 0.4, coloredLights: true, classicFog: true, fogDistance: 0.8 });
  assert.equal(notes.length, 3);
  assert.match(notes[0], /26\.0/);
  // The toggle alone changes nothing, so it must not claim fog changes.
  assert.deepEqual(bedrockCompatibilityNotes({ ...defaults(), classicFog: true }), []);
  const ids = BEDROCK_VV_NOTES.map((n) => n.id);
  for (const id of ['devices', 'graphics', 'activate', 'limits']) assert.ok(ids.includes(id as never), id);
  const text = BEDROCK_VV_NOTES.map((n) => n.title + ' ' + n.text).join(' ');
  assert.match(text, /Vibrant Visuals/);
  assert.match(text, /Global Resources/);
  assert.match(text, /GLSL/);
});

test('color tints stay gentle, keep brightness and treat black/grey/white as neutral', () => {
  for (const neutral of ['#000000', '#808080', '#ffffff', '#010101']) {
    assert.deepEqual(toPreviewParams({ ...defaults(), tint: neutral }).tint, [1, 1, 1], neutral);
  }
  for (const c of ['#ff0000', '#00ff00', '#0000ff', '#ff00ff', '#123456']) {
    const t = toPreviewParams({ ...defaults(), tint: c }).tint;
    for (const x of t) assert.ok(x >= 0.5 - 1e-9 && x <= 1.5 + 1e-9, `${c} channel ${x}`);
    const lum = 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2];
    assert.ok(Math.abs(lum - 1) < 1e-4, `${c} keeps luminance (${lum})`);
  }
  const red = toPreviewParams({ ...defaults(), tint: '#ff0000' }).tint;
  assert.ok(red[0] > 1.2 && red[1] < 1 && red[2] < 1, 'red tint still reads as red');
  const subtle = toPreviewParams({ ...defaults(), tint: '#f7f0ff' }).tint;
  assert.ok(subtle.every((x) => Math.abs(x - 1) < 0.05), 'subtle tints are not amplified');
});

test('preview shows no foliage sway (Bedrock packs cannot add it)', () => {
  for (const p of PRESETS) assert.equal(toPreviewParams(presetValues(p.id)).waving, 0, p.id);
  assert.equal(toPreviewParams({ ...defaults(), waves: true, waveHeight: 3 }).waving, 0);
});

test('every option has a short help text', () => {
  for (const o of OPTIONS) {
    assert.ok(o.description && o.description.length >= 10 && o.description.length <= 200, `${o.key} description`);
  }
});
