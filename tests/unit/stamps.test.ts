// Stamps: turning and flipping (as seen on screen, any order), presets in shades of a colour, saving
// a selection (trimmed, size limit), storage records and merging the pack's stamps with a browser's.
// Run: npx tsx --test tests/unit/stamps.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createImageData } from '../../src/core/pixels';
import {
  NO_TRANSFORM,
  PRESET_IDS,
  STAMP_MAX,
  checkStampRecords,
  flip,
  mergeStamps,
  presetImage,
  rotateCW,
  shade,
  stampImage,
  stampRecord,
  stepTransform,
  transformStamp,
  trimStamp,
  type StampTransform,
} from '../../src/tools/textures/stamps/stamps';

/** A 3 x 2 picture whose pixels are all different: R = x, G = y */
function sample(): ImageData {
  const img = createImageData(3, 2);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) img.data.set([x * 10 + 1, y * 10 + 1, 5, 255], (y * 3 + x) * 4);
  return img;
}
const px = (img: ImageData, x: number, y: number) => Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));
const same = (a: ImageData, b: ImageData) => a.width === b.width && a.height === b.height && a.data.every((v, i) => v === b.data[i]);

test('a quarter turn clockwise and flips', () => {
  const s = sample();
  const r = rotateCW(s);
  assert.equal(r.width, 2);
  assert.equal(r.height, 3);
  // the top-left pixel goes to the top-right, the bottom-left to the top-left
  assert.deepEqual(px(r, 1, 0), px(s, 0, 0));
  assert.deepEqual(px(r, 0, 0), px(s, 0, 1));
  assert.deepEqual(px(r, 0, 2), px(s, 2, 1));
  assert.ok(same(rotateCW(rotateCW(rotateCW(rotateCW(s)))), s), 'four turns are none');
  const fh = flip(s, true);
  assert.deepEqual(px(fh, 0, 0), px(s, 2, 0));
  const fv = flip(s, false);
  assert.deepEqual(px(fv, 0, 0), px(s, 0, 1));
  assert.ok(same(transformStamp(s, NO_TRANSFORM), s));
});

test('stepping the transform turns and flips what shows, in any order', () => {
  const s = sample();
  const steps = ['rotate', 'flipH', 'flipV'] as const;
  // every sequence of up to 4 steps: the transform gives the same picture as doing the steps to the picture
  const seqs: (typeof steps[number])[][] = [[]];
  for (let n = 0; n < 4; n++) for (const q of [...seqs]) if (q.length === n) for (const st of steps) seqs.push([...q, st]);
  for (const seq of seqs) {
    let t: StampTransform = NO_TRANSFORM;
    let shown = s;
    for (const st of seq) {
      t = stepTransform(t, st);
      shown = st === 'rotate' ? rotateCW(shown) : flip(shown, st === 'flipH');
    }
    assert.ok(same(transformStamp(s, t), shown), seq.join(' → ') || 'none');
    assert.ok(t.turns >= 0 && t.turns < 4);
  }
});

test('presets: shades of the main colour, transparent around', () => {
  const green: [number, number, number, number] = [80, 160, 60, 255];
  for (const id of PRESET_IDS) {
    const img = presetImage(id, green);
    assert.ok(img.width >= 4 && img.width <= 12 && img.height >= 4 && img.height <= 12, id);
    let opaque = 0;
    let clear = 0;
    for (let i = 3; i < img.data.length; i += 4) img.data[i] ? opaque++ : clear++;
    assert.ok(opaque > 3 && clear > 3, `${id}: ${opaque} pixels`);
  }
  assert.deepEqual(shade(green, 0), green);
  const dark = shade(green, -1);
  const light = shade(green, 1);
  const lum = (c: number[]) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  assert.ok(lum(dark) < lum(green) && lum(green) < lum(light));
  // hue-shifted: the darker shade's hue leans towards blue (240°), the lighter one's towards yellow (60°)
  const hue = (c: number[]) => {
    const [r, g2, b] = c.map((v) => v / 255);
    const mx = Math.max(r, g2, b);
    const d = mx - Math.min(r, g2, b);
    const h = mx === r ? ((g2 - b) / d) % 6 : mx === g2 ? (b - r) / d + 2 : (r - g2) / d + 4;
    return (h * 60 + 360) % 360;
  };
  assert.ok(hue(dark) > hue(green) + 3, `darker leans blue: ${hue(green)} -> ${hue(dark)}`);
  assert.ok(hue(light) < hue(green) - 3, `lighter leans yellow: ${hue(green)} -> ${hue(light)}`);
  // greys stay grey
  const g = shade([128, 128, 128, 255], -2);
  assert.ok(g[0] === g[1] && g[1] === g[2] && g[0] < 128);
});

test('saving a selection: trimmed to its pixels, up to 32 x 32', () => {
  const img = createImageData(10, 8);
  img.data.set([1, 2, 3, 255], (2 * 10 + 3) * 4);
  img.data.set([4, 5, 6, 255], (5 * 10 + 6) * 4);
  const t = trimStamp(img)!;
  assert.equal(t.width, 4);
  assert.equal(t.height, 4);
  assert.deepEqual(px(t, 0, 0), [1, 2, 3, 255]);
  assert.deepEqual(px(t, 3, 3), [4, 5, 6, 255]);
  assert.equal(trimStamp(createImageData(5, 5)), null, 'nothing to stamp');
  const big = createImageData(STAMP_MAX + 2, 4);
  big.data.set([9, 9, 9, 255], 0);
  big.data.set([9, 9, 9, 255], (STAMP_MAX + 1) * 4);
  assert.equal(trimStamp(big), null, 'too wide');
});

test('records: base64 round trip, checks, merging', () => {
  const s = sample();
  const r = stampRecord(s, 'Ore');
  assert.ok(same(stampImage(r)!, s));
  assert.deepEqual(checkStampRecords([r])?.map((x) => x.id), [r.id]);
  assert.equal(checkStampRecords([{ ...r, width: 4 }]), null, 'pixels of another size');
  assert.equal(checkStampRecords([{ ...r, width: 40, height: 1 }]), null, 'too big');
  assert.equal(checkStampRecords('nope'), null);
  assert.equal(checkStampRecords([r, r])?.length, 1, 'one of each id');
  const other = stampRecord(s, 'Moss');
  const merged = mergeStamps([r], [{ ...r, name: 'changed' }, other]);
  assert.deepEqual(merged.map((x) => x.name), ['Ore', 'Moss']);
});
