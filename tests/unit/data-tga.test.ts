import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { decodeTga, encodeTga, isTga } from '../../src/core/tga';
import { decodeImage, decodePngBytes } from '../../src/core/image';
import { fixturesDir } from '../tools/data/fixtures';

const SCRATCH = fixturesDir();
const TGA_DIR = `${SCRATCH}/research-cache/bedrock/tga`;
const DUAL_DIR = `${SCRATCH}/research-cache/bedrock/dual`;

function sampleImage(w: number, h: number): { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer> } {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      // Runs (for RLE), gradients, and colour hidden under alpha 0 / low alpha.
      data[o] = x < w / 2 ? 200 : (x * 37) & 255;
      data[o + 1] = y * 11 & 255;
      data[o + 2] = x < w / 2 ? 50 : (x ^ y) * 5 & 255;
      data[o + 3] = y % 4 === 0 ? 0 : y % 4 === 1 ? 3 : 255;
    }
  return { width: w, height: h, data };
}

test('TGA round trip: uncompressed, bottom-left origin (vanilla layout)', () => {
  const img = sampleImage(19, 13);
  const bytes = encodeTga(img);
  assert.equal(bytes[2], 2);
  assert.equal(bytes[16], 32);
  assert.equal(bytes[17], 0x08);
  assert.equal(bytes.length, 18 + 19 * 13 * 4 + 26);
  assert.equal(new TextDecoder().decode(bytes.subarray(bytes.length - 18, bytes.length - 1)), 'TRUEVISION-XFILE.');
  // First stored row is the bottom row, BGRA.
  const bottom = (12 * 19 + 0) * 4;
  assert.deepEqual([...bytes.subarray(18, 22)], [img.data[bottom + 2], img.data[bottom + 1], img.data[bottom], img.data[bottom + 3]]);
  const back = decodeTga(bytes);
  assert.equal(back.width, 19);
  assert.equal(back.height, 13);
  assert.deepEqual([...back.data], [...img.data]);
});

test('TGA round trip: RLE and top-left origin', () => {
  const img = sampleImage(300, 7); // rows longer than 128 pixels force several packets per row
  for (const origin of ['bottom-left', 'top-left'] as const) {
    const bytes = encodeTga(img, { rle: true, origin });
    assert.equal(bytes[2], 10);
    assert.equal(bytes[17], origin === 'top-left' ? 0x28 : 0x08);
    assert.ok(bytes.length < 18 + 300 * 7 * 4, 'RLE compresses runs');
    assert.deepEqual([...decodeTga(bytes).data], [...img.data], origin);
  }
  // Solid image collapses to 1 packet per 128 pixels.
  const solid = { width: 256, height: 2, data: new Uint8ClampedArray(256 * 2 * 4).fill(7) };
  assert.equal(encodeTga(solid, { rle: true }).length, 18 + 4 * 5 + 26);
});

test('TGA decoder: RLE packets crossing scanlines, 24-bit, right-to-left', () => {
  // 3x2, type 10, 24bpp, bottom-left; one run packet of 6 pixels spanning both rows.
  const h = new Uint8Array(18);
  h[2] = 10; h[12] = 3; h[14] = 2; h[16] = 24; h[17] = 0;
  const run = new Uint8Array([0x80 | 5, 10, 20, 30]);
  const img = decodeTga(new Uint8Array([...h, ...run]));
  assert.deepEqual([...img.data.subarray(0, 4)], [30, 20, 10, 255]);
  assert.deepEqual([...img.data.subarray(20, 24)], [30, 20, 10, 255]);
  // Right-to-left + top-to-bottom, raw 24-bit 2x1: stored pixels are right then left.
  const h2 = new Uint8Array(18);
  h2[2] = 2; h2[12] = 2; h2[14] = 1; h2[16] = 24; h2[17] = 0x30;
  const img2 = decodeTga(new Uint8Array([...h2, 1, 2, 3, 4, 5, 6]));
  assert.deepEqual([...img2.data], [6, 5, 4, 255, 3, 2, 1, 255]);
});

test('TGA decoder: greyscale, 16-bit and colour-mapped', () => {
  const grey = new Uint8Array(18);
  grey[2] = 3; grey[12] = 2; grey[14] = 1; grey[16] = 8; grey[17] = 0x20;
  assert.deepEqual([...decodeTga(new Uint8Array([...grey, 0, 200])).data], [0, 0, 0, 255, 200, 200, 200, 255]);

  const c16 = new Uint8Array(18);
  c16[2] = 2; c16[12] = 1; c16[14] = 1; c16[16] = 16; c16[17] = 0x21;
  // A=1 R=31 G=0 B=0 -> 0xFC00
  assert.deepEqual([...decodeTga(new Uint8Array([...c16, 0x00, 0xfc])).data], [255, 0, 0, 255]);

  const cm = new Uint8Array(18);
  cm[1] = 1; cm[2] = 1; cm[5] = 2; cm[7] = 32; cm[12] = 2; cm[14] = 1; cm[16] = 8; cm[17] = 0x28;
  const palette = [1, 2, 3, 0, 9, 8, 7, 128]; // BGRA entries
  assert.deepEqual([...decodeTga(new Uint8Array([...cm, ...palette, 1, 0])).data], [7, 8, 9, 128, 3, 2, 1, 0]);
});

test('TGA decoder rejects truncated / unsupported data with readable errors', () => {
  const img = encodeTga(sampleImage(4, 4));
  assert.throws(() => decodeTga(img.subarray(0, 40)), /truncated/);
  const bad = img.slice();
  bad[2] = 5;
  assert.throws(() => decodeTga(bad), /Unsupported TGA image type/);
  assert.equal(isTga(img), true);
  assert.equal(isTga(new Uint8Array(10)), false);
});

test('vanilla Bedrock TGAs decode (uncompressed + RLE), alpha kept as data', { skip: !existsSync(TGA_DIR) && 'bedrock samples missing' }, () => {
  for (const f of readdirSync(TGA_DIR).filter((n) => n.endsWith('.tga'))) {
    const bytes = new Uint8Array(readFileSync(`${TGA_DIR}/${f}`));
    const img = decodeTga(bytes);
    assert.ok(img.width > 0 && img.height > 0, f);
    // Re-encoding and decoding is lossless.
    assert.deepEqual([...decodeTga(encodeTga(img)).data], [...img.data], f);
    assert.deepEqual([...decodeTga(encodeTga(img, { rle: true })).data], [...img.data], f);
    if (f === 'blocks_grass_side.tga') {
      let hidden = 0;
      for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 3] === 0 && (img.data[i] || img.data[i + 1] || img.data[i + 2])) hidden++;
      assert.equal(hidden, 211, 'grass_side tint mask: 211 alpha-0 pixels with colour (research §3.6)');
    }
    if (f === 'items_leather_helmet.tga') {
      let dye = 0;
      for (let i = 3; i < img.data.length; i += 4) if (img.data[i] === 3) dye++;
      assert.equal(dye, 16);
    }
    if (f === 'blocks_grass_side.tga') {
      // Our encoder reproduces the vanilla file byte for byte.
      assert.deepEqual([...encodeTga(img)], [...bytes]);
    }
  }
});

test('TGA and PNG twins of the same vanilla texture share RGB', { skip: !existsSync(DUAL_DIR) && 'dual samples missing' }, async () => {
  for (const stem of ['blocks_grass_side_snowed', 'blocks_tallgrass', 'entity_ghast_ghast_shooting']) {
    const tga = await decodeImage(new Uint8Array(readFileSync(`${DUAL_DIR}/${stem}.tga`)), 'tga');
    const png = decodePngBytes(new Uint8Array(readFileSync(`${DUAL_DIR}/${stem}.png`)));
    assert.equal(tga.width, png.width, stem);
    assert.equal(tga.height, png.height, stem);
    if (stem === 'blocks_grass_side_snowed') {
      let same = 0;
      for (let i = 0; i < tga.data.length; i += 4)
        if (tga.data[i] === png.data[i] && tga.data[i + 1] === png.data[i + 1] && tga.data[i + 2] === png.data[i + 2]) same++;
      assert.equal(same, tga.width * tga.height, 'identical RGB, research §1.3');
      assert.ok([...tga.data].filter((_, i) => i % 4 === 3).every((a) => a === 0), 'tga alpha 0 everywhere');
      assert.ok([...png.data].filter((_, i) => i % 4 === 3).every((a) => a === 255), 'png alpha 255 everywhere');
    }
  }
});
