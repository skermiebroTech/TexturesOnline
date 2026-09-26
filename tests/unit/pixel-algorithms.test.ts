import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  brushOffsets,
  brushOrigin,
  brushOriginAt,
  clearPixels,
  constrainSquare,
  copyRegion,
  createImage,
  diffBounds,
  ellipsePoints,
  extractRect,
  fillRegion,
  flipHorizontal,
  flipVertical,
  floodFill,
  floodRegion,
  getPixel,
  hexToRgba,
  linePoints,
  mirrorPoints,
  mulberry32,
  noiseColor,
  normalizeRect,
  outlineSegments,
  pasteImage,
  pickColor,
  pixelDistance,
  rectPoints,
  rgbaToHex,
  rotate90,
  scaleNearest,
  setPixel,
  shadeChannel,
  shadeColor,
  shadePixel,
  snapLineEnd,
  stampLine,
  stampPoints,
  unionRect,
  writePixel,
  writeRegion,
  type Point,
  type RGBA,
} from '../../src/shared/pixel-algorithms.ts';

const RED: RGBA = [255, 0, 0, 255];
const BLUE: RGBA = [0, 0, 255, 255];
const CLEAR: RGBA = [0, 0, 0, 0];

function solid(w: number, h: number, c: RGBA): ImageData {
  const img = createImage(w, h);
  for (let i = 0; i < w * h; i++) img.data.set(c, i * 4);
  return img;
}

function fromRows(rows: string[], palette: Record<string, RGBA>): ImageData {
  const img = createImage(rows[0].length, rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, x) => setPixel(img, x, y, palette[ch])));
  return img;
}

function toRows(img: ImageData, palette: Record<string, RGBA>): string[] {
  const out: string[] = [];
  for (let y = 0; y < img.height; y++) {
    let row = '';
    for (let x = 0; x < img.width; x++) {
      const c = getPixel(img, x, y);
      const k = Object.entries(palette).find(([, v]) => v.every((n, i) => n === c[i]));
      row += k ? k[0] : '?';
    }
    out.push(row);
  }
  return out;
}

const key = (pts: Point[]) => new Set(pts.map(([x, y]) => `${x},${y}`));

// ---------------------------------------------------------------------------

test('createImage works without a DOM and validates sizes', () => {
  const img = createImage(3, 2);
  assert.equal(img.width, 3);
  assert.equal(img.height, 2);
  assert.equal(img.data.length, 24);
  assert.throws(() => createImage(0, 4));
  assert.throws(() => createImage(2, 2, new Uint8ClampedArray(3)));
});

test('flood fill (contiguous) stops at walls and reports the changed box', () => {
  const P = { '.': CLEAR, '#': BLUE, r: RED };
  const img = fromRows(['..#..', '..#..', '..#..', '#####', '.....'], P);
  const r = floodFill(img, 0, 0, RED);
  assert.deepEqual(toRows(img, P), ['rr#..', 'rr#..', 'rr#..', '#####', '.....']);
  assert.deepEqual(r, { x: 0, y: 0, w: 2, h: 3 });
});

test('flood fill with the same colour is a no-op', () => {
  const img = solid(4, 4, RED);
  assert.equal(floodFill(img, 1, 1, RED), null);
});

test('flood fill tolerance uses the largest channel difference', () => {
  const img = createImage(5, 1);
  [0, 8, 16, 40, 44].forEach((v, x) => setPixel(img, x, 0, [100 + v, 50, 50, 255]));
  const t0 = floodRegion(img, 0, 0, { tolerance: 0 })!;
  assert.deepEqual([...t0], [1, 0, 0, 0, 0]);
  const t10 = floodRegion(img, 0, 0, { tolerance: 10 })!;
  assert.deepEqual([...t10], [1, 1, 0, 0, 0]);
  const t16 = floodRegion(img, 0, 0, { tolerance: 16 })!;
  assert.deepEqual([...t16], [1, 1, 1, 0, 0]);
  // Contiguity: 44 is within 16 of 40 but not of the start colour.
  const g = floodRegion(img, 4, 0, { tolerance: 4 })!;
  assert.deepEqual([...g], [0, 0, 0, 1, 1]);
});

test('flood fill treats all fully transparent pixels as one colour', () => {
  const img = createImage(4, 1);
  setPixel(img, 0, 0, [10, 20, 30, 0]);
  setPixel(img, 1, 0, [200, 100, 0, 0]);
  setPixel(img, 2, 0, [0, 0, 0, 0]);
  setPixel(img, 3, 0, [0, 0, 0, 12]);
  const r = floodRegion(img, 0, 0)!;
  assert.deepEqual([...r], [1, 1, 1, 0]);
  const tol = floodRegion(img, 0, 0, { tolerance: 12 })!;
  assert.deepEqual([...tol], [1, 1, 1, 1]);
  assert.equal(pixelDistance([5, 5, 5, 0], 0, [250, 250, 250, 0]), 0);
  assert.equal(pixelDistance([5, 5, 5, 0], 0, [250, 250, 250, 255]), 255);
});

test('global fill replaces disconnected matches; mask and bounds limit fills', () => {
  const P = { '.': CLEAR, '#': BLUE, r: RED };
  const img = fromRows(['.#.', '###', '.#.'], P);
  floodFill(img, 0, 0, RED, { contiguous: false });
  assert.deepEqual(toRows(img, P), ['r#r', '###', 'r#r']);

  const img2 = solid(4, 1, CLEAR);
  const mask = new Uint8Array([1, 1, 0, 1]);
  floodFill(img2, 0, 0, RED, { mask });
  assert.deepEqual(toRows(img2, P), ['rr..'], 'locked pixel blocks the contiguous fill');
  assert.equal(floodRegion(img2, 2, 0, { mask }), null, 'cannot start on a locked pixel');

  const img3 = solid(4, 4, CLEAR);
  floodFill(img3, 1, 1, RED, { bounds: { x: 1, y: 1, w: 2, h: 2 } });
  assert.deepEqual(toRows(img3, P), ['....', '.rr.', '.rr.', '....']);
  assert.equal(floodRegion(img3, 0, 0, { bounds: { x: 1, y: 1, w: 2, h: 2 } }), null);
});

test('diagonal fill option connects corners', () => {
  const P = { '.': CLEAR, '#': BLUE, r: RED };
  const a = fromRows(['.#', '#.'], P);
  floodFill(a, 0, 0, RED);
  assert.deepEqual(toRows(a, P), ['r#', '#.']);
  const b = fromRows(['.#', '#.'], P);
  floodFill(b, 0, 0, RED, { diagonal: true });
  assert.deepEqual(toRows(b, P), ['r#', '#r']);
});

test('channel modes: rgb keeps alpha, alpha writes grey level as alpha', () => {
  const img = createImage(2, 1);
  setPixel(img, 0, 0, [10, 20, 30, 0]);
  setPixel(img, 1, 0, [10, 20, 30, 0]);
  const region = new Uint8Array([1, 0]);
  fillRegion(img, region, RED, 'rgb');
  assert.deepEqual(getPixel(img, 0, 0), [255, 0, 0, 0]);
  fillRegion(img, new Uint8Array([0, 1]), [128, 128, 128, 255], 'alpha');
  assert.deepEqual(getPixel(img, 1, 0), [10, 20, 30, 128]);
  assert.deepEqual(pickColor(img, 1, 0, 'alpha'), [128, 128, 128, 255]);
  assert.deepEqual(pickColor(img, 0, 0, 'rgb'), [255, 0, 0, 255]);
  const d = new Uint8ClampedArray([1, 2, 3, 4]);
  assert.equal(writePixel(d, 0, [1, 2, 3, 4]), false);
  assert.equal(writePixel(d, 0, [1, 2, 3, 5]), true);
  assert.equal(writePixel(d, 0, [9, 9, 9, 9], 'rgb'), true);
  assert.deepEqual([...d], [9, 9, 9, 5]);
});

// ---------------------------------------------------------------------------

test('Bresenham lines include both endpoints and are 8-connected', () => {
  const cases: [number, number, number, number][] = [
    [0, 0, 7, 3], [7, 3, 0, 0], [2, 9, 2, 1], [0, 0, 5, 5], [5, 0, 0, 5], [-3, 4, 6, -2], [4, 4, 4, 4], [0, 0, 1, 9],
  ];
  for (const [x0, y0, x1, y1] of cases) {
    const pts = linePoints(x0, y0, x1, y1);
    assert.deepEqual(pts[0], [x0, y0]);
    assert.deepEqual(pts[pts.length - 1], [x1, y1]);
    assert.equal(pts.length, Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + 1);
    for (let i = 1; i < pts.length; i++) {
      assert.ok(Math.abs(pts[i][0] - pts[i - 1][0]) <= 1 && Math.abs(pts[i][1] - pts[i - 1][1]) <= 1);
    }
  }
  assert.deepEqual(linePoints(0, 0, 3, 0), [[0, 0], [1, 0], [2, 0], [3, 0]]);
  assert.deepEqual(linePoints(0, 0, 2, 2), [[0, 0], [1, 1], [2, 2]]);
});

test('line snapping picks horizontal, vertical, 45° and 2:1 directions', () => {
  assert.deepEqual(snapLineEnd(0, 0, 10, 1), [10, 0]);
  assert.deepEqual(snapLineEnd(0, 0, 1, -10), [0, -10]);
  assert.deepEqual(snapLineEnd(0, 0, 9, 10), [9, 9]);
  assert.deepEqual(snapLineEnd(0, 0, -10, 5), [-10, 5]);
  assert.deepEqual(snapLineEnd(0, 0, 11, 5), [10, 5]);
  assert.deepEqual(snapLineEnd(3, 3, 3, 3), [3, 3]);
  assert.deepEqual(constrainSquare(0, 0, 5, -2), [5, -5]);
  assert.deepEqual(constrainSquare(4, 4, 1, 6), [1, 7]);
});

test('rectangle outlines visit each pixel once', () => {
  const pts = rectPoints(1, 1, 5, 4);
  assert.equal(pts.length, 2 * 5 + 2 * 4 - 4);
  assert.equal(key(pts).size, pts.length);
  assert.equal(rectPoints(0, 0, 0, 0).length, 1);
  assert.equal(rectPoints(0, 0, 3, 0).length, 4);
  assert.equal(rectPoints(3, 3, 0, 0, true).length, 16);
});

test('ellipses are symmetric, fill their box and stay inside it', () => {
  for (let w = 1; w <= 24; w++) {
    for (let h = 1; h <= 24; h++) {
      for (const filled of [false, true]) {
        const x0 = 3, y0 = 5, x1 = x0 + w - 1, y1 = y0 + h - 1;
        const pts = ellipsePoints(x0, y0, x1, y1, filled);
        const set = key(pts);
        assert.equal(set.size, pts.length, `duplicates in ${w}x${h}`);
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const [x, y] of pts) {
          assert.ok(x >= x0 && x <= x1 && y >= y0 && y <= y1, `outside box ${w}x${h}`);
          assert.ok(set.has(`${x0 + x1 - x},${y}`), `not mirror-symmetric in x for ${w}x${h}`);
          assert.ok(set.has(`${x},${y0 + y1 - y}`), `not mirror-symmetric in y for ${w}x${h}`);
          minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
        assert.deepEqual([minX, maxX, minY, maxY], [x0, x1, y0, y1], `does not touch all sides ${w}x${h}`);
        if (filled) {
          for (const p of ellipsePoints(x0, y0, x1, y1, false)) assert.ok(set.has(`${p[0]},${p[1]}`), 'fill covers outline');
        }
      }
    }
  }
});

test('ellipse outlines are closed, 8-connected loops', () => {
  for (const [w, h] of [[5, 5], [8, 8], [16, 9], [9, 16], [3, 12], [12, 3], [30, 30], [64, 20]]) {
    const pts = ellipsePoints(0, 0, w - 1, h - 1);
    const set = key(pts);
    // Everything is reachable from the first pixel.
    const seen = new Set<string>([`${pts[0][0]},${pts[0][1]}`]);
    const stack = [pts[0]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const k = `${x + dx},${y + dy}`;
        if (set.has(k) && !seen.has(k)) { seen.add(k); stack.push([x + dx, y + dy]); }
      }
    }
    assert.equal(seen.size, set.size, `${w}x${h} outline is connected`);
    // No dead ends except the pointed tips of very thin ellipses.
    if (w >= 5 && h >= 5) {
      for (const [x, y] of pts) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && set.has(`${x + dx},${y + dy}`)) n++;
        assert.ok(n >= 2, `pixel ${x},${y} of ${w}x${h} has ${n} neighbours`);
      }
    }
  }
  assert.deepEqual(ellipsePoints(0, 0, 2, 2).sort(), [[0, 1], [1, 0], [1, 2], [2, 1]].sort());
});

// ---------------------------------------------------------------------------

test('brush footprints: square n², round shapes symmetric', () => {
  for (let n = 1; n <= 12; n++) assert.equal(brushOffsets(n, 'square').length, n * n);
  assert.equal(brushOffsets(1, 'round').length, 1);
  assert.equal(brushOffsets(2, 'round').length, 4);
  assert.equal(brushOffsets(3, 'round').length, 5, 'size 3 round is a plus');
  assert.equal(brushOffsets(5, 'round').length, 21);
  for (let n = 1; n <= 16; n++) {
    const s = key(brushOffsets(n, 'round'));
    for (const k of s) {
      const [x, y] = k.split(',').map(Number);
      assert.ok(x >= 0 && y >= 0 && x < n && y < n);
      assert.ok(s.has(`${n - 1 - x},${y}`) && s.has(`${x},${n - 1 - y}`) && s.has(`${y},${x}`), `round ${n} symmetric`);
    }
  }
  assert.deepEqual(brushOffsets(0.2), [[0, 0]], 'size clamps to 1');
});

test('brush origins centre odd sizes on the pixel and even sizes on the nearest corner', () => {
  assert.deepEqual(brushOrigin(5.3, 7.9, 1), [5, 7]);
  assert.deepEqual(brushOrigin(5.3, 7.9, 3), [4, 6]);
  assert.deepEqual(brushOrigin(5.3, 5.7, 2), [4, 5]);
  assert.deepEqual(brushOrigin(5.7, 5.3, 4), [4, 3]);
  assert.deepEqual(brushOriginAt(5, 5, 1), [5, 5]);
  assert.deepEqual(brushOriginAt(5, 5, 3), [4, 4]);
  assert.deepEqual(brushOriginAt(5, 5, 4), [4, 4]);
});

test('stamping a line with a brush covers a thick stroke without gaps', () => {
  const pts = stampPoints(linePoints(0, 0, 6, 0), 2);
  assert.equal(pts.length, 16, '7 origins of a 2x2 brush cover 8 columns x 2 rows');
  const seen: string[] = [];
  stampLine([0, 0], [3, 0], 1, 'square', (x, y) => seen.push(`${x},${y}`), true);
  assert.deepEqual(seen, ['1,0', '2,0', '3,0'], 'skipFirst omits the start stamp');
});

test('mirror expansion is unique and handles centre lines', () => {
  assert.deepEqual(mirrorPoints(1, 2, 8, 8, true, false), [[1, 2], [6, 2]]);
  assert.deepEqual(mirrorPoints(1, 2, 8, 8, false, true), [[1, 2], [1, 5]]);
  assert.deepEqual(mirrorPoints(1, 2, 8, 8, true, true), [[1, 2], [6, 2], [1, 5], [6, 5]]);
  assert.deepEqual(mirrorPoints(2, 0, 5, 5, true, false), [[2, 0]], 'pixel on the axis of an odd width');
  assert.deepEqual(mirrorPoints(2, 2, 5, 5, true, true), [[2, 2]]);
  assert.deepEqual(mirrorPoints(0, 0, 4, 4, false, false), [[0, 0]]);
});

// ---------------------------------------------------------------------------

test('flip and rotate transform pixels correctly', () => {
  const P = { a: RED, b: BLUE, c: [0, 255, 0, 255] as RGBA, d: CLEAR, e: [9, 9, 9, 255] as RGBA, f: [1, 2, 3, 4] as RGBA };
  const img = fromRows(['abc', 'def'], P);
  const h = fromRows(['abc', 'def'], P);
  flipHorizontal(h);
  assert.deepEqual(toRows(h, P), ['cba', 'fed']);
  const v = fromRows(['abc', 'def'], P);
  flipVertical(v);
  assert.deepEqual(toRows(v, P), ['def', 'abc']);
  const cw = rotate90(img, true);
  assert.equal(cw.width, 2);
  assert.equal(cw.height, 3);
  assert.deepEqual(toRows(cw, P), ['da', 'eb', 'fc']);
  const ccw = rotate90(img, false);
  assert.deepEqual(toRows(ccw, P), ['cf', 'be', 'ad']);
  let r = img;
  for (let i = 0; i < 4; i++) r = rotate90(r);
  assert.deepEqual([...r.data], [...img.data]);
  const part = fromRows(['abcd', 'abcd'], { ...P });
  flipHorizontal(part, { x: 1, y: 0, w: 2, h: 1 });
  assert.deepEqual(toRows(part, P), ['acbd', 'abcd']);
  const pv = fromRows(['ab', 'cd', 'ef'], P);
  flipVertical(pv, { x: 1, y: 0, w: 1, h: 3 });
  assert.deepEqual(toRows(pv, P), ['af', 'cd', 'eb']);
});

test('scaleNearest keeps hard pixel edges', () => {
  const P = { a: RED, b: BLUE };
  const img = fromRows(['ab', 'ba'], P);
  assert.deepEqual(toRows(scaleNearest(img, 4, 4), P), ['aabb', 'aabb', 'bbaa', 'bbaa']);
  assert.deepEqual(toRows(scaleNearest(scaleNearest(img, 4, 4), 2, 2), P), ['ab', 'ba']);
});

// ---------------------------------------------------------------------------

test('lighten / darken clamp to 0..255 and keep alpha', () => {
  assert.equal(shadeChannel(250, 1), 255);
  assert.equal(shadeChannel(250, 5), 255, 'amount is clamped');
  assert.equal(shadeChannel(3, -1), 0);
  assert.equal(shadeChannel(3, -7), 0);
  assert.equal(shadeChannel(100, 0), 100);
  assert.equal(shadeChannel(100, 0.5), 178);
  assert.equal(shadeChannel(100, -0.5), 50);
  assert.equal(shadeChannel(255, 0.3), 255);
  assert.equal(shadeChannel(0, -0.3), 0);
  assert.deepEqual(shadeColor([10, 200, 255, 77], 0.2), [59, 211, 255, 77]);
  for (let c = 0; c <= 255; c += 5) {
    for (const a of [-1, -0.5, -0.1, 0.1, 0.5, 1]) {
      const v = shadeChannel(c, a);
      assert.ok(v >= 0 && v <= 255 && Number.isInteger(v));
      if (a > 0) assert.ok(v >= c); else assert.ok(v <= c);
    }
  }
});

test('shadePixel leaves invisible pixels alone unless editing colour or alpha only', () => {
  const d = new Uint8ClampedArray([100, 100, 100, 0]);
  assert.equal(shadePixel(d, 0, 0.5), false);
  assert.deepEqual([...d], [100, 100, 100, 0]);
  assert.equal(shadePixel(d, 0, 0.5, 'rgb'), true);
  assert.deepEqual([...d], [178, 178, 178, 0]);
  assert.equal(shadePixel(d, 0, 0.5, 'alpha'), true);
  assert.deepEqual([...d], [178, 178, 178, 128]);
  const white = new Uint8ClampedArray([255, 255, 255, 255]);
  assert.equal(shadePixel(white, 0, 0.4), false, 'already at the limit: no change');
});

test('noise is deterministic with a seed and stays within the strength', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const base: RGBA = [120, 80, 40, 200];
  for (let i = 0; i < 200; i++) {
    const n1 = noiseColor(base, 0.2, a);
    const n2 = noiseColor(base, 0.2, b);
    assert.deepEqual(n1, n2);
    assert.equal(n1[3], 200);
    assert.ok(n1[0] >= Math.round(120 * 0.8) - 1 && n1[0] <= Math.round(120 + 135 * 0.2) + 1);
  }
  const r = mulberry32(1);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1);
  }
  assert.deepEqual(noiseColor(base, 0, a), base);
});

// ---------------------------------------------------------------------------

test('selection helpers: extract, clear, paste, diff, region copy', () => {
  const P = { '.': CLEAR, a: RED, b: BLUE };
  const img = fromRows(['aab', 'abb', 'bbb'], P);
  const ex = extractRect(img, { x: 1, y: 1, w: 3, h: 2 });
  assert.deepEqual(toRows(ex, P), ['bb.', 'bb.'], 'outside the image is transparent');
  const masked = extractRect(img, { x: 0, y: 0, w: 2, h: 1 }, new Uint8Array([1, 0, 1, 1, 1, 1, 1, 1, 1]));
  assert.deepEqual(toRows(masked, P), ['a.']);

  const c = fromRows(['aab', 'abb', 'bbb'], P);
  const cr = clearPixels(c, { x: 1, y: 0, w: 5, h: 2 }, new Uint8Array([1, 1, 0, 1, 1, 1, 1, 1, 1]));
  assert.deepEqual(toRows(c, P), ['a.b', 'a..', 'bbb']);
  assert.deepEqual(cr, { x: 1, y: 0, w: 2, h: 2 });

  const dst = solid(3, 3, BLUE);
  const src = fromRows(['a.', '.a'], P);
  const pr = pasteImage(dst, src, 2, 1, { skipTransparent: true });
  assert.deepEqual(toRows(dst, P), ['bbb', 'bba', 'bbb']);
  assert.deepEqual(pr, { x: 2, y: 1, w: 1, h: 2 });
  pasteImage(dst, src, -1, -1);
  assert.deepEqual(toRows(dst, P), ['abb', 'bba', 'bbb'], 'transparent pixels copied when not skipping');

  const a = fromRows(['aaa', 'aaa', 'aaa'], P);
  const b = fromRows(['aaa', 'aba', 'aab'], P);
  assert.deepEqual(diffBounds(a.data, b.data, 3, 3), { x: 1, y: 1, w: 2, h: 2 });
  assert.equal(diffBounds(a.data, a.data, 3, 3), null);
  assert.deepEqual(diffBounds(a.data, b.data, 3, 3, { x: 2, y: 0, w: 1, h: 3 }), { x: 2, y: 2, w: 1, h: 1 });

  const region = copyRegion(b.data, 3, { x: 1, y: 1, w: 2, h: 2 });
  writeRegion(a.data, 3, { x: 1, y: 1, w: 2, h: 2 }, region);
  assert.deepEqual([...a.data], [...b.data]);
});

test('rect helpers', () => {
  assert.deepEqual(normalizeRect(5, 2, 1, 4), { x: 1, y: 2, w: 5, h: 3 });
  assert.deepEqual(unionRect({ x: 0, y: 0, w: 2, h: 2 }, { x: 3, y: 1, w: 1, h: 4 }), { x: 0, y: 0, w: 4, h: 5 });
  assert.deepEqual(unionRect(null, { x: 1, y: 1, w: 1, h: 1 }), { x: 1, y: 1, w: 1, h: 1 });
});

test('hex conversion', () => {
  assert.equal(rgbaToHex([255, 128, 0, 255]), '#ff8000');
  assert.equal(rgbaToHex([255, 128, 0, 16]), '#ff800010');
  assert.deepEqual(hexToRgba('#ff8000'), [255, 128, 0, 255]);
  assert.deepEqual(hexToRgba('f80'), [255, 136, 0, 255]);
  assert.deepEqual(hexToRgba('#ff800010'), [255, 128, 0, 16]);
  assert.equal(hexToRgba('#xyz'), null);
  assert.equal(hexToRgba('#12345'), null);
});

test('outline segments of pixel sets', () => {
  const one = outlineSegments([[2, 3]]);
  assert.equal(one.length, 16, 'single pixel has four edges');
  const sq = outlineSegments([[0, 0], [1, 0], [0, 1], [1, 1]]);
  assert.equal(sq.length, 16, 'a 2x2 block merges into four edges');
  const len = (s: number[]) => { let t = 0; for (let i = 0; i < s.length; i += 4) t += Math.abs(s[i + 2] - s[i]) + Math.abs(s[i + 3] - s[i + 1]); return t; };
  assert.equal(len(sq), 8);
  assert.equal(len(outlineSegments(brushOffsets(3, 'round'))), 12, 'plus shape perimeter');
});

test('moving pixels keeps colour hidden under alpha 0 when landing on empty pixels', () => {
  const HIDDEN: RGBA = [10, 200, 30, 0];
  const OTHER_HIDDEN: RGBA = [90, 90, 90, 0];
  const src = createImage(1, 1);
  src.data.set(HIDDEN, 0);
  const row = (...px: RGBA[]) => { const im = createImage(px.length, 1); px.forEach((c, i) => im.data.set(c, i * 4)); return im; };

  const empty = row(CLEAR);
  pasteImage(empty, src, 0, 0, { skipTransparent: true });
  assert.deepEqual(getPixel(empty, 0, 0), HIDDEN, 'copied over an empty (0,0,0,0) pixel');

  const visible = row(BLUE);
  pasteImage(visible, src, 0, 0, { skipTransparent: true });
  assert.deepEqual(getPixel(visible, 0, 0), BLUE, 'does not cover a visible pixel');

  const hidden = row(OTHER_HIDDEN);
  pasteImage(hidden, src, 0, 0, { skipTransparent: true });
  assert.deepEqual(getPixel(hidden, 0, 0), OTHER_HIDDEN, 'does not overwrite other hidden colour data');

  const plain = row(BLUE);
  pasteImage(plain, src, 0, 0);
  assert.deepEqual(getPixel(plain, 0, 0), HIDDEN, 'without skipping, everything is copied');
});
