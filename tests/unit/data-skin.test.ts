import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertLegacySkin, createImageData, forceOpaqueSkinBase, toLegacySkin } from '../../src/core/image';

/** 64x32 skin where every pixel encodes its coordinates. */
function legacySkin(alpha = 255): ImageData {
  const img = createImageData(64, 32);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 64; x++) img.data.set([x * 4, y * 8, 77, alpha], (y * 64 + x) * 4);
  return img;
}
const at = (img: ImageData, x: number, y: number) => [...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];
const rgbOf = (x: number, y: number) => [x * 4, y * 8, 77];

/** Independent restatement of research §6.2: source rect -> destination rect, mirrored horizontally. */
const RECTS: [number, number, number, number, number, number][] = [
  // srcX, srcY, dstX, dstY, w, h
  [4, 16, 20, 48, 4, 4], [8, 16, 24, 48, 4, 4], [0, 20, 24, 52, 4, 12], [4, 20, 20, 52, 4, 12], [8, 20, 16, 52, 4, 12], [12, 20, 28, 52, 4, 12],
  [44, 16, 36, 48, 4, 4], [48, 16, 40, 48, 4, 4], [40, 20, 40, 52, 4, 12], [44, 20, 36, 52, 4, 12], [48, 20, 32, 52, 4, 12], [52, 20, 44, 52, 4, 12],
];

test('64x32 -> 64x64: left limbs are mirrored copies of the right limbs (Java algorithm)', () => {
  const out = convertLegacySkin(legacySkin());
  assert.equal(out.width, 64);
  assert.equal(out.height, 64);
  for (const [sx, sy, dx, dy, w, h] of RECTS)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) assert.deepEqual(at(out, dx + (w - 1 - x), dy + y).slice(0, 3), rgbOf(sx + x, sy + y), `rect ${sx},${sy} px ${x},${y}`);
  // Hand-checked corners
  assert.deepEqual(at(out, 23, 48).slice(0, 3), rgbOf(4, 16));
  assert.deepEqual(at(out, 20, 48).slice(0, 3), rgbOf(7, 16));
  assert.deepEqual(at(out, 27, 52).slice(0, 3), rgbOf(0, 20));
  assert.deepEqual(at(out, 35, 52).slice(0, 3), rgbOf(48, 20));
  assert.deepEqual(at(out, 32, 52).slice(0, 3), rgbOf(51, 20));
  // Top half is kept, unmapped bottom areas stay transparent.
  assert.deepEqual(at(out, 5, 5), [...rgbOf(5, 5), 255]);
  assert.deepEqual(at(out, 0, 32), [0, 0, 0, 0]);
  assert.deepEqual(at(out, 0, 48), [0, 0, 0, 0]);
  assert.deepEqual(at(out, 50, 50), [0, 0, 0, 0]);
  assert.deepEqual(at(out, 20, 48)[3], 255);
});

test('Notch transparency hack: an all-opaque hat layer becomes transparent (RGB kept)', () => {
  const out = convertLegacySkin(legacySkin());
  assert.deepEqual(at(out, 40, 8), [...rgbOf(40, 8), 0]);
  assert.deepEqual(at(out, 63, 15), [...rgbOf(63, 15), 0]);
  // y 16..31 of that region is forced opaque again afterwards.
  assert.deepEqual(at(out, 40, 20), [...rgbOf(40, 20), 255]);
});

test('Hat with any transparency is left alone', () => {
  const img = legacySkin();
  img.data[(3 * 64 + 45) * 4 + 3] = 0;
  const out = convertLegacySkin(img);
  assert.deepEqual(at(out, 40, 8), [...rgbOf(40, 8), 255]);
  assert.deepEqual(at(out, 45, 3), [...rgbOf(45, 3), 0]);
});

test('Base layer is forced opaque (head, body/arms/legs), can be disabled', () => {
  const img = legacySkin(0);
  const out = convertLegacySkin(img);
  assert.deepEqual(at(out, 5, 5), [...rgbOf(5, 5), 255]);
  assert.deepEqual(at(out, 20, 20), [...rgbOf(20, 20), 255]);
  assert.equal(at(out, 20, 50)[3], 255);
  // Hat was transparent already: stays so.
  assert.equal(at(out, 40, 8)[3], 0);
  const raw = convertLegacySkin(legacySkin(0), { forceOpaqueBase: false });
  assert.equal(at(raw, 5, 5)[3], 0);
});

test('64x64 input is returned unchanged; other sizes are rejected', () => {
  const modern = createImageData(64, 64);
  modern.data[3] = 17;
  const out = convertLegacySkin(modern);
  assert.notEqual(out, modern);
  assert.deepEqual([...out.data], [...modern.data]);
  assert.throws(() => convertLegacySkin(createImageData(32, 32)), /64x64 or 64x32/);
  assert.equal(forceOpaqueSkinBase(modern).data[3], 255);
  const legacy = toLegacySkin(convertLegacySkin(legacySkin()));
  assert.equal(legacy.height, 32);
  assert.deepEqual(at(legacy, 5, 5), [...rgbOf(5, 5), 255]);
});
