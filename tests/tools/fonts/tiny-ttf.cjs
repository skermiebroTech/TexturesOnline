// Builds a tiny TrueType font for the font maker's tests: each glyph is drawn as pixel squares
// (8 pixels per em, 100 units each), so turning it into pixels at 8 px gives back the same bitmap.
// Original test art, written here; no font file is stored in the repository.
// Usage: makeTinyTtf({ name: 'Tiny Test', glyphs: { A: ['.###.', '#...#', ...], ... } }) -> Uint8Array

const UNIT = 100;
const ASCENT = 700; // 7 pixels above the baseline
const DESCENT = 100;

function u16(v) {
  return [(v >> 8) & 255, v & 255];
}
function i16(v) {
  return u16(v < 0 ? v + 65536 : v);
}
function u32(v) {
  return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
}

/** Rows top to bottom: row 0 is the cap height (7 rows above the baseline, row 7 below it). */
function glyphOutline(rows) {
  const squares = [];
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) if (row[c] === '#') squares.push([c * UNIT, ASCENT - (r + 1) * UNIT, (c + 1) * UNIT, ASCENT - r * UNIT]);
  });
  if (!squares.length) return { bytes: [], xMin: 0, xMax: 0, yMin: 0, yMax: 0, points: 0, contours: 0, width: 0 };
  const xMin = Math.min(...squares.map((s) => s[0]));
  const yMin = Math.min(...squares.map((s) => s[1]));
  const xMax = Math.max(...squares.map((s) => s[2]));
  const yMax = Math.max(...squares.map((s) => s[3]));
  const out = [...i16(squares.length), ...i16(xMin), ...i16(yMin), ...i16(xMax), ...i16(yMax)];
  squares.forEach((_, i) => out.push(...u16(i * 4 + 3)));
  out.push(...u16(0)); // no instructions
  const pts = [];
  // clockwise (y up): bottom-left, top-left, top-right, bottom-right
  for (const [x0, y0, x1, y1] of squares) pts.push([x0, y0], [x0, y1], [x1, y1], [x1, y0]);
  for (let i = 0; i < pts.length; i++) out.push(0x01);
  let px = 0;
  for (const [x] of pts) {
    out.push(...i16(x - px));
    px = x;
  }
  let py = 0;
  for (const [, y] of pts) {
    out.push(...i16(y - py));
    py = y;
  }
  while (out.length % 4) out.push(0);
  return { bytes: out, xMin, xMax, yMin, yMax, points: pts.length, contours: squares.length, width: xMax };
}

function checksum(bytes) {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 4) sum = (sum + ((bytes[i] << 24) | ((bytes[i + 1] ?? 0) << 16) | ((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0))) >>> 0;
  return sum;
}

function nameTable(name) {
  const records = [
    [1, name],
    [2, 'Regular'],
    [4, name],
    [6, name.replace(/[^A-Za-z0-9-]/g, '')],
  ];
  const strings = [];
  const recs = [];
  let offset = 0;
  for (const [id, text] of records) {
    const bytes = [];
    for (const ch of text) bytes.push(...u16(ch.charCodeAt(0)));
    recs.push(...u16(3), ...u16(1), ...u16(0x409), ...u16(id), ...u16(bytes.length), ...u16(offset));
    strings.push(...bytes);
    offset += bytes.length;
  }
  return [...u16(0), ...u16(records.length), ...u16(6 + recs.length), ...recs, ...strings];
}

function makeTinyTtf({ name = 'Tiny Test', glyphs }) {
  const chars = Object.keys(glyphs)
    .map((c) => [c.codePointAt(0), glyphs[c]])
    .sort((a, b) => a[0] - b[0]);
  // glyph 0: .notdef (empty), glyph 1: space, then the drawn ones
  const outlines = [glyphOutline([]), glyphOutline([]), ...chars.map(([, rows]) => glyphOutline(rows))];
  const advances = [500, 400, ...outlines.slice(2).map((o) => o.width + UNIT)];
  const cps = [0x20, ...chars.map(([cp]) => cp)];
  const numGlyphs = outlines.length;

  const glyf = [];
  const loca = [];
  for (const o of outlines) {
    loca.push(...u32(glyf.length));
    glyf.push(...o.bytes);
  }
  loca.push(...u32(glyf.length));
  const xMin = Math.min(0, ...outlines.map((o) => o.xMin));
  const xMax = Math.max(...outlines.map((o) => o.xMax));

  const head = [...u32(0x00010000), ...u32(0x00010000), ...u32(0), ...u32(0x5f0f3cf5), ...u16(0x000b), ...u16(UNIT * 8), ...u32(0), ...u32(0), ...u32(0), ...u32(0), ...i16(xMin), ...i16(-DESCENT), ...i16(xMax), ...i16(ASCENT), ...u16(0), ...u16(8), ...i16(2), ...i16(1), ...i16(0)];
  const hhea = [...u32(0x00010000), ...i16(ASCENT), ...i16(-DESCENT), ...i16(0), ...u16(Math.max(...advances)), ...i16(0), ...i16(0), ...i16(xMax), ...i16(1), ...i16(0), ...i16(0), 0, 0, 0, 0, 0, 0, 0, 0, ...i16(0), ...u16(numGlyphs)];
  const maxp = [...u32(0x00010000), ...u16(numGlyphs), ...u16(Math.max(...outlines.map((o) => o.points))), ...u16(Math.max(...outlines.map((o) => o.contours))), ...u16(0), ...u16(0), ...u16(2), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u16(0)];
  const hmtx = [];
  outlines.forEach((o, i) => hmtx.push(...u16(advances[i]), ...i16(o.xMin)));
  // cmap format 4: one segment per character, then the 0xFFFF end
  const segs = cps.map((cp, i) => [cp, cp, (i + 1 - cp + 65536) % 65536]);
  segs.push([0xffff, 0xffff, 1]);
  const segX2 = segs.length * 2;
  let sr = 1;
  let es = 0;
  while (sr * 2 <= segs.length) {
    sr *= 2;
    es++;
  }
  const sub = [...u16(4), ...u16(0), ...u16(0), ...u16(segX2), ...u16(sr * 2), ...u16(es), ...u16(segX2 - sr * 2)];
  segs.forEach((s) => sub.push(...u16(s[1])));
  sub.push(...u16(0));
  segs.forEach((s) => sub.push(...u16(s[0])));
  segs.forEach((s) => sub.push(...u16(s[2])));
  segs.forEach(() => sub.push(...u16(0)));
  sub[2] = (sub.length >> 8) & 255;
  sub[3] = sub.length & 255;
  const cmap = [...u16(0), ...u16(1), ...u16(3), ...u16(1), ...u32(12), ...sub];
  const os2 = [
    ...u16(4), ...i16(500), ...u16(400), ...u16(5), ...u16(0),
    ...i16(650), ...i16(600), ...i16(0), ...i16(75), ...i16(650), ...i16(600), ...i16(0), ...i16(350), ...i16(50), ...i16(300),
    ...i16(0), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ...u32(1), ...u32(0), ...u32(0), ...u32(0),
    ...[...'TEST'].map((c) => c.charCodeAt(0)),
    ...u16(0x40), ...u16(Math.min(...cps)), ...u16(Math.max(...cps)),
    ...i16(ASCENT), ...i16(-DESCENT), ...i16(0), ...u16(ASCENT), ...u16(DESCENT),
    ...u32(1), ...u32(0),
    ...i16(500), ...i16(700), ...u16(0), ...u16(0x20), ...u16(1),
  ];
  const post = [...u32(0x00030000), ...u32(0), ...i16(-100), ...i16(50), ...u32(0), ...u32(0), ...u32(0), ...u32(0), ...u32(0)];
  const tables = { 'OS/2': os2, cmap, glyf, head, hhea, hmtx, loca, maxp, name: nameTable(name), post };
  const tags = Object.keys(tables).sort();
  const n = tags.length;
  let sr2 = 1;
  let es2 = 0;
  while (sr2 * 2 <= n) {
    sr2 *= 2;
    es2++;
  }
  const dir = [...u32(0x00010000), ...u16(n), ...u16(sr2 * 16), ...u16(es2), ...u16(n * 16 - sr2 * 16)];
  let offset = 12 + n * 16;
  const body = [];
  let headOffset = 0;
  for (const tag of tags) {
    const data = tables[tag].slice();
    const len = data.length;
    while (data.length % 4) data.push(0);
    if (tag === 'head') headOffset = offset;
    dir.push(...[...tag].map((c) => c.charCodeAt(0)), ...u32(checksum(data)), ...u32(offset), ...u32(len));
    body.push(...data);
    offset += data.length;
  }
  const font = new Uint8Array([...dir, ...body]);
  const adj = (0xb1b0afba - checksum(font)) >>> 0;
  font.set(u32(adj), headOffset + 8);
  return font;
}

/** The test font's art: a few letters in 8-row boxes (rows 0-6 above the baseline, row 7 below). */
const TEST_GLYPHS = {
  A: ['.##.', '#..#', '#..#', '####', '#..#', '#..#', '#..#'],
  B: ['###.', '#..#', '###.', '#..#', '#..#', '#..#', '###.'],
  C: ['.###', '#...', '#...', '#...', '#...', '#...', '.###'],
  H: ['#..#', '#..#', '#..#', '####', '#..#', '#..#', '#..#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  a: ['....', '....', '.###', '#..#', '#..#', '#..#', '.###'],
  b: ['#...', '#...', '###.', '#..#', '#..#', '#..#', '###.'],
  g: ['....', '....', '.###', '#..#', '#..#', '.###', '...#', '###.'],
  'Ж': ['#.#.#', '#.#.#', '.###.', '..#..', '.###.', '#.#.#', '#.#.#'],
};

module.exports = { makeTinyTtf, TEST_GLYPHS };
