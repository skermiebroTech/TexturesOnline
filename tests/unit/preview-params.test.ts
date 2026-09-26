import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultPreviewParams, sanitizePreviewParams, sunDirection } from '../../src/shared/preview/shader-preview';
import { parseSkinPart, SKIN_PARTS } from '../../src/tools/skins/skin-preview';

test('defaultPreviewParams is neutral and complete', () => {
  const p = defaultPreviewParams();
  assert.equal(p.exposure, 1);
  assert.equal(p.contrast, 1);
  assert.equal(p.saturation, 1);
  assert.equal(p.gamma, 1);
  assert.equal(p.temperature, 0);
  assert.deepEqual(p.tint, [1, 1, 1]);
  assert.equal(p.grayscale, 0);
  assert.equal(p.sepia, 0);
  assert.equal(p.posterize, 0);
  assert.deepEqual(sanitizePreviewParams(p), p);
  assert.notEqual(defaultPreviewParams(), defaultPreviewParams());
});

test('sanitizePreviewParams clamps, fills and normalises', () => {
  const p = sanitizePreviewParams({
    exposure: -3,
    bloom: 7,
    fogDensity: Number.NaN,
    timeOfDay: -6000,
    posterize: 1.4,
    tint: [2, -1, 9] as [number, number, number],
    sunColor: [1, 1] as unknown as [number, number, number],
  });
  const d = defaultPreviewParams();
  assert.equal(p.exposure, 0);
  assert.equal(p.bloom, 1);
  assert.equal(p.fogDensity, d.fogDensity);
  assert.equal(p.timeOfDay, 18000);
  assert.equal(p.posterize, 0);
  assert.deepEqual(p.tint, [2, 0, 4]);
  assert.deepEqual(p.sunColor, d.sunColor);
  assert.equal(sanitizePreviewParams({ posterize: 7.6 }).posterize, 8);
  assert.equal(sanitizePreviewParams({ timeOfDay: 30000 }).timeOfDay, 6000);
  assert.deepEqual(sanitizePreviewParams(null), d);
});

test('sunDirection follows the Minecraft day', () => {
  const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  const rise = sunDirection(0);
  assert.ok(close(rise[0], 1) && close(rise[1], 0), 'sunrise in the east on the horizon');
  const noon = sunDirection(6000);
  assert.ok(noon[1] > 0.85, 'high at noon');
  const set = sunDirection(12000);
  assert.ok(set[0] < -0.99 && Math.abs(set[1]) < 1e-9, 'sunset in the west');
  assert.ok(sunDirection(18000)[1] < -0.85, 'below the horizon at midnight');
  for (const t of [0, 3000, 6000, 13000]) assert.ok(Math.abs(Math.hypot(...sunDirection(t)) - 1) < 1e-9);
});

test('parseSkinPart accepts many spellings', () => {
  assert.deepEqual(parseSkinPart('head'), { part: 'head', layer: 'both' });
  assert.deepEqual(parseSkinPart('Left Arm'), { part: 'leftArm', layer: 'both' });
  assert.deepEqual(parseSkinPart('right_leg'), { part: 'rightLeg', layer: 'both' });
  assert.deepEqual(parseSkinPart('arm-left:overlay'), { part: 'leftArm', layer: 'outer' });
  assert.deepEqual(parseSkinPart('head:inner'), { part: 'head', layer: 'inner' });
  assert.deepEqual(parseSkinPart('hat'), { part: 'head', layer: 'outer' });
  assert.deepEqual(parseSkinPart('jacket'), { part: 'body', layer: 'outer' });
  assert.deepEqual(parseSkinPart('torso'), { part: 'body', layer: 'both' });
  assert.deepEqual(parseSkinPart('cape'), { part: 'cape', layer: 'both' });
  assert.equal(parseSkinPart('arm'), null, 'side required for limbs');
  assert.equal(parseSkinPart('tail'), null);
  assert.equal(parseSkinPart(null), null);
  for (const p of SKIN_PARTS) assert.equal(parseSkinPart(p.id)?.part, p.id);
});
