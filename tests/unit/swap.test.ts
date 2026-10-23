// Colour swap: matching a colour and a range of similar ones, keeping each pixel's difference,
// the selection and paint mask, finding a colour's shade ramp and moving the whole ramp.
// Run: npx tsx --test tests/unit/swap.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createImageData } from '../../src/core/pixels';
import { colorDistance, countSwapped, inRange, pairOf, rampPairs, shadeRamp, swapImage, swapped, toHsv, type RGBA } from '../../src/tools/textures/swap/swap';

/** A row of pixels */
function row(...cs: RGBA[]): ImageData {
  const img = createImageData(cs.length, 1);
  cs.forEach((c, i) => img.data.set(c, i * 4));
  return img;
}
const px = (img: ImageData, i: number) => Array.from(img.data.slice(i * 4, i * 4 + 4));

const RED: RGBA = [200, 40, 40, 255];
const BLUE: RGBA = [40, 60, 200, 255];

test('a colour and the range around it (largest channel difference, see-through pixels never)', () => {
  assert.equal(colorDistance(RED, [205, 30, 40, 255]), 10);
  assert.ok(inRange([205, 30, 40, 255], RED, 10));
  assert.ok(!inRange([205, 30, 40, 255], RED, 9));
  assert.ok(!inRange([200, 40, 40, 0], RED, 255), 'a see-through pixel is never swapped');
  // the closest colour wins when ranges overlap
  const pairs = [{ from: RED, to: BLUE }, { from: [210, 40, 40, 255] as RGBA, to: RED }];
  assert.equal(pairOf([208, 40, 40, 255], pairs, 20), 1);
  assert.equal(pairOf([201, 40, 40, 255], pairs, 20), 0);
  assert.equal(pairOf([100, 100, 100, 255], pairs, 20), -1);
});

test('exact colours become the new colour; near ones keep their difference; alpha follows', () => {
  const img = row(RED, [206, 34, 40, 255], [100, 100, 100, 255], [200, 40, 40, 128]);
  const { image, changed } = swapImage(img, [{ from: RED, to: BLUE }], 8);
  assert.equal(changed, 3);
  assert.deepEqual(px(image, 0), BLUE);
  assert.deepEqual(px(image, 1), [46, 54, 200, 255], 'the +6 / -6 difference is kept');
  assert.deepEqual(px(image, 2), [100, 100, 100, 255], 'other colours stay');
  assert.deepEqual(px(image, 3), [40, 60, 200, 128], 'a half see-through pixel stays half see-through');
  assert.deepEqual(px(img, 0), RED, 'the source image is left alone');
  // to see-through: the pixels go
  assert.deepEqual(swapped(RED, { from: RED, to: [0, 0, 0, 0] })[3], 0);
  // clamped at the ends
  assert.deepEqual(swapped([255, 10, 10, 255], { from: [250, 10, 10, 255], to: [252, 0, 0, 255] }), [255, 0, 0, 255]);
  assert.equal(countSwapped(img, [{ from: RED, to: BLUE }], 0), 2);
});

test('only the selection, only editable pixels', () => {
  const img = row(RED, RED, RED, RED);
  const a = swapImage(img, [{ from: RED, to: BLUE }], 0, { rect: { x: 1, y: 0, w: 2, h: 1 } });
  assert.deepEqual([0, 1, 2, 3].map((i) => px(a.image, i)[2]), [40, 200, 200, 40]);
  const mask = new Uint8Array([1, 0, 1, 0]);
  const b = swapImage(img, [{ from: RED, to: BLUE }], 0, { mask });
  assert.deepEqual([0, 1, 2, 3].map((i) => px(b.image, i)[2]), [200, 40, 200, 40]);
  assert.equal(countSwapped(img, [{ from: RED, to: BLUE }], 0, { x: 0, y: 0, w: 1, h: 1 }), 1);
});

test('a shade ramp: the colour family (hue-shifted shades too), greys with greys, darkest first', () => {
  // a hue-shifted green ramp: darker leans blue, lighter leans yellow
  const ramp: RGBA[] = [
    [35, 80, 55, 255],
    [50, 110, 60, 255],
    [80, 160, 60, 255],
    [140, 200, 70, 255],
  ];
  const others: RGBA[] = [[200, 40, 40, 255], [128, 128, 128, 255], [60, 60, 60, 255]];
  const found = shadeRamp(ramp[2], [...others, ...ramp]);
  assert.deepEqual(found, ramp);
  const greys = shadeRamp([128, 128, 128, 255], [...others, ...ramp]);
  assert.deepEqual(greys, [[60, 60, 60, 255], [128, 128, 128, 255]]);
  assert.deepEqual(shadeRamp(RED, []), [RED], 'always the colour itself');
});

test('moving a ramp keeps its spacing and hue shift', () => {
  const ramp: RGBA[] = [
    [35, 80, 55, 255],
    [50, 110, 60, 255],
    [80, 160, 60, 255],
    [140, 200, 70, 255],
  ];
  const to: RGBA = [180, 60, 60, 255];
  const pairs = rampPairs(ramp, ramp[2], to);
  assert.equal(pairs.length, 4);
  assert.deepEqual(pairs[2].to, to, 'the colour itself becomes the new colour exactly');
  const v = (c: RGBA) => toHsv(c)[2];
  const h = (c: RGBA) => toHsv(c)[0];
  // still darkest to lightest
  for (let i = 1; i < 4; i++) assert.ok(v(pairs[i].to) >= v(pairs[i - 1].to), `ramp order ${i}`);
  // every shade turned by the same hue amount (the ramp's own hue shift kept)
  const turn = (h(to) - h(ramp[2]) + 360) % 360;
  for (const p of pairs) {
    const d = (h(p.to) - h(p.from) + 360) % 360;
    assert.ok(Math.abs(d - turn) < 4 || Math.abs(d - turn) > 356, `hue turn ${d} vs ${turn}`);
  }
  // a grey ramp takes the new colour's hue
  const greys = rampPairs([[60, 60, 60, 255], [128, 128, 128, 255], [200, 200, 200, 255]], [128, 128, 128, 255], [40, 80, 200, 255]);
  for (const p of greys) assert.ok(Math.abs(h(p.to) - h([40, 80, 200, 255])) < 3, `grey -> ${p.to}`);
  assert.ok(v(greys[0].to) < v(greys[1].to) && v(greys[1].to) < v(greys[2].to));
  // swapping the image with the ramp's pairs
  const img = row(...ramp);
  const out = swapImage(img, pairs, 0).image;
  for (let i = 0; i < 4; i++) assert.deepEqual(px(out, i), pairs[i].to);
});
