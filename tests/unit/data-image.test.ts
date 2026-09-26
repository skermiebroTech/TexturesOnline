import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zlibSync } from 'fflate';
import {
  createImageData,
  cloneImageData,
  decodeImage,
  decodePngBytes,
  encodePng,
  encodeImage,
  resizeNearest,
  resizeSmooth,
  fitToSize,
  cropImageData,
  blitImageData,
  imageDataToDataUrl,
} from '../../src/core/image';

// ---- tiny PNG writer for exotic formats (palette, low bit depth, 16-bit, tRNS) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (const x of b) c = CRC_TABLE[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function makePng(w: number, h: number, depth: number, colorType: number, rows: number[][], extra: [string, number[]][] = []): Uint8Array {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = depth;
  ihdr[9] = colorType;
  const raw: number[] = [];
  for (const r of rows) raw.push(0, ...r);
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    ...extra.map(([t, d]) => chunk(t, new Uint8Array(d))),
    chunk('IDAT', zlibSync(new Uint8Array(raw))),
    chunk('IEND', new Uint8Array(0)),
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const px = (img: ImageData, x: number, y: number) => [...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];

test('createImageData works in Node (polyfill) and validates sizes', () => {
  const img = createImageData(3, 2);
  assert.equal(img.width, 3);
  assert.equal(img.height, 2);
  assert.equal(img.data.length, 24);
  assert.ok(img instanceof ImageData);
  assert.throws(() => createImageData(2, 2, new Uint8ClampedArray(3)));
  const c = cloneImageData(img);
  c.data[0] = 9;
  assert.equal(img.data[0], 0);
});

test('PNG round trip keeps colour under fully transparent pixels', () => {
  const img = createImageData(4, 4);
  for (let i = 0; i < 16; i++) img.data.set([i * 16, 255 - i * 10, (i * 7) & 255, i % 3 === 0 ? 0 : i * 15], i * 4);
  const png = encodePng(img);
  const back = decodePngBytes(png);
  assert.deepEqual([...back.data], [...img.data]);
  assert.deepEqual(px(back, 0, 0), [0, 255, 0, 0]);
  assert.deepEqual(px(back, 3, 0), [48, 225, 21, 0]);
});

test('PNG decode: palette with tRNS, 1/2/4-bit palette and greyscale, 16-bit, grey+alpha, RGB tRNS', async () => {
  // 8-bit palette, tRNS for the first entry only.
  const pal = makePng(2, 1, 8, 3, [[0, 1]], [['PLTE', [10, 20, 30, 40, 50, 60]], ['tRNS', [0]]]);
  let img = decodePngBytes(pal);
  assert.deepEqual([...img.data], [10, 20, 30, 0, 40, 50, 60, 255]);
  // 2-bit palette, 3 pixels packed in one byte: indices 3,1,2
  const pal2 = makePng(3, 1, 2, 3, [[0b11011000]], [['PLTE', [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3]]]);
  assert.deepEqual([...decodePngBytes(pal2).data], [3, 3, 3, 255, 1, 1, 1, 255, 2, 2, 2, 255]);
  // 1-bit greyscale, 10 pixels (2 bytes per row)
  img = decodePngBytes(makePng(10, 1, 1, 0, [[0b10100000, 0b01000000]]));
  assert.deepEqual(px(img, 0, 0), [255, 255, 255, 255]);
  assert.deepEqual(px(img, 1, 0), [0, 0, 0, 255]);
  assert.deepEqual(px(img, 9, 0), [255, 255, 255, 255]);
  // 4-bit greyscale with tRNS key 0
  img = decodePngBytes(makePng(2, 1, 4, 0, [[0x0f]], [['tRNS', [0, 0]]]));
  assert.deepEqual([...img.data], [0, 0, 0, 0, 255, 255, 255, 255]);
  // 16-bit RGBA
  img = decodePngBytes(makePng(1, 1, 16, 6, [[0xff, 0xff, 0x80, 0x00, 0x00, 0x00, 0x7f, 0xff]]));
  assert.deepEqual([...img.data], [255, 128, 0, 127]);
  // 8-bit grey + alpha
  img = decodePngBytes(makePng(1, 1, 8, 4, [[77, 9]]));
  assert.deepEqual([...img.data], [77, 77, 77, 9]);
  // RGB with tRNS colour key
  img = decodePngBytes(makePng(4, 1, 8, 2, [[1, 2, 3, 4, 5, 6, 1, 2, 3, 7, 8, 9]], [['tRNS', [0, 1, 0, 2, 0, 3]]]));
  assert.deepEqual([...img.data], [1, 2, 3, 0, 4, 5, 6, 255, 1, 2, 3, 0, 7, 8, 9, 255]);
  // decodeImage sniffs PNG regardless of extension hint
  assert.deepEqual([...(await decodeImage(pal, 'tga')).data], [10, 20, 30, 0, 40, 50, 60, 255]);
});

test('decodeImage: TGA by extension, friendly errors', async () => {
  const { encodeTga } = await import('../../src/core/tga');
  const img = createImageData(2, 2, new Uint8ClampedArray([1, 2, 3, 0, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 255]));
  const t = await decodeImage(encodeTga(img), 'tga');
  assert.deepEqual([...t.data], [...img.data]);
  const blob = await encodeImage(img, 'tga');
  assert.equal(blob.type, 'image/x-tga');
  assert.deepEqual([...(await decodeImage(blob, 'tga')).data], [...img.data]);
  await assert.rejects(decodeImage(new Uint8Array(0)), /empty/);
  await assert.rejects(decodeImage(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20])), /supported image/);
  await assert.rejects(decodeImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])), /PNG file couldn't be read/);
});

test('resizeNearest scales pixel art exactly', () => {
  const img = createImageData(2, 2, new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 0, 0, 0, 0]));
  const big = resizeNearest(img, 4, 4);
  assert.deepEqual(px(big, 0, 0), [255, 0, 0, 255]);
  assert.deepEqual(px(big, 1, 1), [255, 0, 0, 255]);
  assert.deepEqual(px(big, 2, 0), [0, 255, 0, 255]);
  assert.deepEqual(px(big, 3, 3), [0, 0, 0, 0]);
  const small = resizeNearest(big, 2, 2);
  assert.deepEqual([...small.data], [...img.data]);
});

test('resizeSmooth averages with premultiplied alpha', () => {
  const img = createImageData(2, 1, new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 0]));
  const one = resizeSmooth(img, 1, 1);
  // The transparent blue pixel must not tint the result.
  assert.deepEqual(px(one, 0, 0), [255, 0, 0, 128]);
  const flat = createImageData(3, 3);
  flat.data.fill(100);
  const up = resizeSmooth(flat, 7, 5);
  assert.ok([...up.data].every((v) => v === 100));
});

test('fitToSize contain / cover / stretch', () => {
  const wide = createImageData(4, 2);
  wide.data.fill(255);
  const contain = fitToSize(wide, 4, 4, 'nearest');
  assert.equal(contain.width, 4);
  assert.deepEqual(px(contain, 0, 0), [0, 0, 0, 0]);
  assert.deepEqual(px(contain, 0, 1), [255, 255, 255, 255]);
  assert.deepEqual(px(contain, 0, 3), [0, 0, 0, 0]);
  const cover = fitToSize(wide, 4, 4, 'nearest', 'cover');
  assert.ok([...cover.data].every((v) => v === 255));
  const stretch = fitToSize(wide, 2, 2, 'smooth', 'stretch');
  assert.ok([...stretch.data].every((v) => v === 255));
});

test('crop and blit clip at the edges', () => {
  const img = createImageData(3, 3);
  for (let i = 0; i < 9; i++) img.data[i * 4] = i;
  const c = cropImageData(img, 1, 1, 3, 3);
  assert.deepEqual([px(c, 0, 0)[0], px(c, 1, 0)[0], px(c, 0, 1)[0], px(c, 1, 1)[0]], [4, 5, 7, 8]);
  assert.deepEqual(px(c, 2, 2), [0, 0, 0, 0]);
  const dst = createImageData(2, 2);
  blitImageData(dst, img, -1, -1);
  assert.deepEqual([px(dst, 0, 0)[0], px(dst, 1, 1)[0]], [4, 8]);
});

test('imageDataToDataUrl encodes exact PNG bytes', () => {
  const img = createImageData(1, 1, new Uint8ClampedArray([10, 20, 30, 0]));
  const url = imageDataToDataUrl(img);
  assert.ok(url.startsWith('data:image/png;base64,'));
  const bytes = Uint8Array.from(atob(url.slice(22)), (ch) => ch.charCodeAt(0));
  assert.deepEqual([...decodePngBytes(bytes).data], [10, 20, 30, 0]);
});
