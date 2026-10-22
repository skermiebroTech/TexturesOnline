// The font maker: character widths, the 8-row fitting, the files of each version and edition,
// font files (TrueType / WOFF / OpenType), rasterising thresholds, and packs read back. With
// TO_FIXTURES set, checked against the real client jars (read locally, never stored): the game's
// own glyph widths, which font features each version has, and the paths it reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { strToU8, unzipSync, zlibSync } from 'fflate';
import { createImageData, decodePngBytes, encodePng } from '../../src/core/image';
import {
  CELL_ASCENT,
  CELL_HEIGHT,
  GROUPS,
  LEGACY_ASCII_CHARS,
  bedrockPages,
  bitmapAdvance,
  cellH,
  cellW,
  emptyMask,
  fitBox,
  fromDraft,
  glyphAdvance,
  glyphsFor,
  groupOf,
  inkWidth,
  isDrawable,
  javaFontSupport,
  legacyCells,
  newFont,
  resizeMask,
  setGlyph,
  targetCovers,
  toDraft,
  type FontDoc,
  type Mask,
} from '../../src/tools/fonts/font';
import { starterFont, starterGlyph } from '../../src/tools/fonts/starter';
import { BEDROCK_DEFAULT8, JAVA_ASCII_PNG, JAVA_FONT_JSON, addFontToProject, bedrockFontFiles, bedrockPagePath, buildFontPack, fontSlug, javaFontFiles, javaSheets } from '../../src/tools/fonts/pack';
import { importBedrockFont, importFontPack, importJavaFont, mapSource, packRoot } from '../../src/tools/fonts/import';
import { readFontFile, sfntChars, sniffFont, woffToSfnt } from '../../src/tools/fonts/sfnt';
import { alphaToMask } from '../../src/tools/fonts/raster';
import { newTextureProject } from '../../src/tools/textures/project';
import { listJars } from '../tools/vanilla/sources';

const require = createRequire(import.meta.url);
const { makeTinyTtf, TEST_GLYPHS } = require('../tools/fonts/tiny-ttf.cjs') as { makeTinyTtf(o: { name?: string; glyphs: Record<string, string[]> }): Uint8Array; TEST_GLYPHS: Record<string, string[]> };

const cp = (c: string) => c.codePointAt(0)!;
const text = (b: Uint8Array | string | undefined) => (typeof b === 'string' ? b : b ? new TextDecoder().decode(b) : '');

/** A glyph from rows of '#' in the 8-row box (box row 0 = cell row 3). */
function art(rows: string[], size: 8 | 16 | 32 = 8, top = 3): Mask {
  const m = emptyMask(8);
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch === '#' && (m[(top + y) * 8 + x] = 1)));
  return resizeMask(m, 8, size);
}

function rowsOf(m: Mask, w: number, h: number): string[] {
  const out: string[] = [];
  for (let y = 0; y < h; y++) {
    let s = '';
    for (let x = 0; x < w; x++) s += m[y * w + x] ? '#' : '.';
    out.push(s);
  }
  return out;
}

function docWith(chars: Record<string, string[]>, size: 8 | 16 | 32 = 8): FontDoc {
  const d = newFont(size);
  for (const [c, rows] of Object.entries(chars)) setGlyph(d, cp(c), art(rows, size));
  return d;
}

// ------------------------------------------------------------------------------- widths

test('character widths follow Java: rightmost inked column + 1, scaled to the gui', () => {
  const A = art(['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#']);
  assert.equal(inkWidth(A, 8, 12), 5);
  assert.equal(glyphAdvance(A, 8), 6);
  // a glyph whose ink starts at column 2 still counts from the left edge
  const dot = art(['', '', '', '', '', '', '..#']);
  assert.equal(glyphAdvance(dot, 8), 4);
  assert.equal(inkWidth(emptyMask(8), 8, 12), 0);
  assert.equal(bitmapAdvance(0, 12), 1);
  // HD: 16-pixel glyphs (cells 24 tall, drawn 12 gui pixels high) count half
  assert.equal(glyphAdvance(resizeMask(A, 8, 16), 16), 6);
  assert.equal(bitmapAdvance(7, 24), 5); // (int)(0.5 + 7 * 0.5) + 1
  assert.equal(bitmapAdvance(9, 48), 3); // (int)(0.5 + 9 * 0.25) + 1
  // vanilla ascii.png: 8 × 8 cells, height 8
  assert.equal(bitmapAdvance(5, 8, 8), 6);
});

test('glyph sizes scale both ways', () => {
  const A = art(['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#']);
  for (const s of [16, 32] as const) assert.deepEqual(resizeMask(resizeMask(A, 8, s), s, 8), A);
  assert.equal(resizeMask(A, 8, 32).length, 32 * 48);
});

test('the 8-row box keeps ASCII as it is and squeezes accented capitals', () => {
  const A = art(['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#', '']);
  assert.deepEqual(fitBox(A, 8), A.subarray(3 * 8, 11 * 8));
  const Auml = starterGlyph(cp('Ä'), 'classic', 8)!;
  const boxed = fitBox(Auml, 8);
  const r = rowsOf(boxed, 8, 8);
  assert.match(r[0], /#.#/, 'the dots are kept');
  assert.match(r[1], /###/, 'the letter follows without a gap');
  // lowercase accents fit without moving
  const e = starterGlyph(cp('é'), 'classic', 8)!;
  assert.deepEqual(fitBox(e, 8), e.subarray(24, 88));
});

// ------------------------------------------------------------------------------- characters

test('character groups: every character in one group, drawable', () => {
  const seen = new Set<number>();
  for (const [id, list] of Object.entries(GROUPS)) {
    for (const c of list) {
      assert.ok(!seen.has(c), `${c.toString(16)} in one group`);
      seen.add(c);
      assert.ok(isDrawable(c), `${c.toString(16)} drawable`);
      assert.equal(groupOf(c), id);
    }
  }
  assert.equal(GROUPS.basic.length, 94);
  for (const c of 'АЯаяЁё') assert.equal(groupOf(cp(c)), 'cyrillic');
  for (const c of 'あア') assert.equal(groupOf(cp(c)), 'kana');
  for (const c of 'ÄöüßñçãõŁ') assert.equal(groupOf(cp(c)), 'latin');
  assert.equal(groupOf(cp('漢')), 'other');
  assert.ok(!isDrawable(0x20) && !isDrawable(0x301) && !isDrawable(0x200c));
});

test('starter styles cover Basic Latin, the accents of de/es/pt and Russian', () => {
  const doc = starterFont('classic', 8);
  for (const c of GROUPS.basic) assert.ok(doc.glyphs.has(c), `has ${String.fromCodePoint(c)}`);
  for (const c of 'ÄÖÜäöüßÁÉÍÓÚáéíóúÑñ¿¡ÃÕÂÊÔÇãõâêôçàÀ') assert.ok(doc.glyphs.has(cp(c)), `has ${c}`);
  for (const c of 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя') assert.ok(doc.glyphs.has(cp(c)), `has ${c}`);
  // é is e with an acute above it
  const e = rowsOf(doc.glyphs.get(cp('e'))!, 8, 12);
  const eAcute = rowsOf(doc.glyphs.get(cp('é'))!, 8, 12);
  assert.deepEqual(eAcute.slice(5), e.slice(5));
  assert.ok(eAcute.slice(0, 5).some((r) => r.includes('#')));
  // bold is one pixel wider, italic leans
  assert.equal(glyphAdvance(starterGlyph(cp('H'), 'bold', 8)!, 8), glyphAdvance(doc.glyphs.get(cp('H'))!, 8) + 1);
  assert.notDeepEqual(starterGlyph(cp('H'), 'italic', 8), doc.glyphs.get(cp('H')));
  assert.equal(starterFont('classic', 16).glyphs.get(cp('A'))!.length, 16 * 24);
});

// ------------------------------------------------------------------------------- versions

test('font features per Java version', () => {
  assert.deepEqual(javaFontSupport('1.12.2'), { json: false, ttf: false, space: false, unihex: false, filters: false, astral: false });
  assert.equal(javaFontSupport('1.13').json, true);
  assert.equal(javaFontSupport('1.13').ttf, true);
  assert.equal(javaFontSupport('1.18.2').space, false);
  assert.equal(javaFontSupport('1.19').space, true);
  assert.equal(javaFontSupport('22w11a').space, true);
  assert.equal(javaFontSupport('1.19.4').unihex, false);
  assert.equal(javaFontSupport('1.20').unihex, true);
  assert.equal(javaFontSupport('1.20.4').filters, false);
  assert.equal(javaFontSupport('1.20.5').filters, true);
  assert.equal(javaFontSupport('24w06a').filters, true);
  assert.equal(javaFontSupport('1.15.2').astral, false);
  assert.equal(javaFontSupport('1.16').astral, true);
  assert.deepEqual(javaFontSupport('26.3'), { json: true, ttf: true, space: true, unihex: true, filters: true, astral: true });
  assert.ok(!targetCovers({ edition: 'java', version: '1.12.2' }, cp('Ж')));
  assert.ok(targetCovers({ edition: 'java', version: '1.12.2' }, cp('é')));
  assert.ok(targetCovers({ edition: 'java', version: '1.13' }, cp('Ж')));
  assert.ok(!targetCovers({ edition: 'bedrock', version: '' }, 0x1f600));
});

test('the legacy grid: 256 cells, ASCII from the space on, Bedrock without rows 0-1', () => {
  assert.equal([...LEGACY_ASCII_CHARS].length, 256);
  const java = legacyCells('java');
  assert.equal(java[0x41], cp('A'));
  assert.equal(java[0x20], 0, 'the space is not a glyph');
  assert.equal(java[0], cp('À'));
  assert.equal(java[0x80], cp('Ç'));
  const bedrock = legacyCells('bedrock');
  assert.equal(bedrock[0], 0);
  assert.equal(bedrock[0x41], cp('A'));
  assert.deepEqual(bedrockPages([cp('A'), cp('é'), cp('À'), cp('Ж'), cp('あ'), cp('“')]), [0x00, 0x04, 0x20, 0x30]);
});

// ------------------------------------------------------------------------------- Java files

test('Java 1.13+: default.json lists only the drawn characters, on 16-column bitmap sheets', () => {
  const doc = docWith({ A: ['#'], B: ['##'], 'Ж': ['###'] });
  const r = javaFontFiles(doc, '26.3', { slug: 'test_font' });
  const json = JSON.parse(text(r.files[JAVA_FONT_JSON]));
  assert.equal(json.providers.length, 1);
  const p = json.providers[0];
  assert.deepEqual({ type: p.type, file: p.file, height: p.height, ascent: p.ascent, filter: p.filter }, { type: 'bitmap', file: 'minecraft:font/test_font/glyphs_0.png', height: CELL_HEIGHT, ascent: CELL_ASCENT, filter: { uniform: false } });
  assert.equal(p.chars.length, 1);
  assert.equal([...p.chars[0]].length, 16);
  assert.equal(p.chars[0].replace(/\0/g, ''), 'ABЖ');
  // non-ASCII is escaped in the file
  assert.ok(text(r.files[JAVA_FONT_JSON]).includes('\\u0416'));
  const png = decodePngBytes(r.files['assets/minecraft/textures/font/test_font/glyphs_0.png'] as Uint8Array);
  assert.deepEqual([png.width, png.height], [128, 12]);
  // 'A' is a single pixel at row 3 of the first cell, white
  assert.deepEqual([...png.data.subarray((3 * 128 + 0) * 4, (3 * 128 + 0) * 4 + 4)], [255, 255, 255, 255]);
  assert.equal(png.data[(3 * 128 + 1) * 4 + 3], 0);
  // the bitmap provider's ascent must not exceed its height (the game rejects it)
  assert.ok(p.ascent <= p.height);
});

test('Java: filters from 1.20.5, space from 1.19, ttf from 1.13, more sheets past 256', () => {
  const doc = docWith({ A: ['#'] });
  doc.space = 3;
  doc.ttf = { bytes: new Uint8Array([0, 1, 0, 0]), file: 'x.ttf', size: 9, oversample: 4, shift: [0, 1], chars: new Set([cp('Q')]) };
  const at = (v: string) => JSON.parse(text(javaFontFiles(doc, v, { slug: 's' }).files[JAVA_FONT_JSON])).providers as Record<string, unknown>[];
  assert.deepEqual(at('26.3').map((p) => p.type), ['space', 'bitmap', 'ttf']);
  assert.deepEqual(at('26.3')[0], { type: 'space', advances: { ' ': 3, '‌': 0 } });
  assert.deepEqual(at('26.3')[2], { type: 'ttf', file: 'minecraft:s.ttf', size: 9, oversample: 4, shift: [0, 1], filter: { uniform: false } });
  assert.ok(!('filter' in at('1.20.4')[1]));
  assert.deepEqual(at('1.18.2').map((p) => p.type), ['bitmap', 'ttf']);
  assert.deepEqual(at('1.13').map((p) => p.type), ['bitmap', 'ttf']);
  const files = javaFontFiles(doc, '1.13', { slug: 's' });
  assert.ok(files.files['assets/minecraft/font/s.ttf']);
  assert.ok(files.notes.length, 'tells that 1.13 has no space provider');
  // 300 characters -> two sheets (256 + 44)
  const big = newFont(8);
  for (let c = 0x410; c < 0x410 + 300; c++) setGlyph(big, c, art(['#']));
  const sheets = javaSheets(big.glyphs, 8, 'b');
  assert.equal(sheets.length, 2);
  assert.equal(sheets[0].chars.length, 16);
  assert.equal(sheets[1].chars.length, 3);
  assert.equal(sheets[1].image.height, 3 * 12);
});

test('Java before 1.13: one ascii.png in the game order, empty cells filled from the Classic style', () => {
  const doc = docWith({ A: ['#####'], 'Ж': ['#'] });
  const r = javaFontFiles(doc, '1.12.2', { slug: 's', fill: starterFont('classic', 8) });
  assert.deepEqual(Object.keys(r.files), [JAVA_ASCII_PNG]);
  const img = decodePngBytes(r.files[JAVA_ASCII_PNG] as Uint8Array);
  assert.deepEqual([img.width, img.height], [128, 128]);
  // 'A' (cell 0x41: column 1, row 4) is our 5-pixel bar in its first row
  const px = (x: number, y: number) => img.data[(y * 128 + x) * 4 + 3];
  for (let x = 0; x < 5; x++) assert.equal(px(8 + x, 32), 255);
  assert.equal(px(8 + 5, 32), 0);
  // 'B' came from the Classic style
  assert.ok([...Array(64).keys()].some((i) => px(16 + (i % 8), 32 + Math.floor(i / 8))));
  assert.deepEqual(r.dropped, [cp('Ж')]);
  // HD: 16-pixel glyphs give a 256 × 256 grid
  const hd = javaFontFiles(docWith({ A: ['#'] }, 16), '1.8.9', { slug: 's' });
  assert.equal(decodePngBytes(hd.files[JAVA_ASCII_PNG] as Uint8Array).width, 256);
});

// ------------------------------------------------------------------------------- Bedrock files

test('Bedrock: default8.png plus the glyph pages the font needs', () => {
  const doc = docWith({ A: ['#'], 'Ж': ['#'], 'あ': ['#'], 'À': ['#'] });
  const r = bedrockFontFiles(doc, { fill: starterFont('classic', 8) });
  const paths = Object.keys(r.files).sort();
  assert.deepEqual(paths, [BEDROCK_DEFAULT8, bedrockPagePath(0x00), bedrockPagePath(0x04), bedrockPagePath(0x30), bedrockPagePath(0x30, 'ja_JP'), bedrockPagePath(0x30, 'zh_TW')].sort());
  assert.equal(bedrockPagePath(0x04), 'font/glyph_04.png');
  const d8 = decodePngBytes(r.files[BEDROCK_DEFAULT8] as Uint8Array);
  assert.deepEqual([d8.width, d8.height], [128, 128]);
  // rows 0-1 stay empty (control codes on Bedrock)
  assert.ok(![...Array(128 * 16).keys()].some((i) => d8.data[i * 4 + 3]));
  const page = decodePngBytes(r.files[bedrockPagePath(0x04)] as Uint8Array);
  assert.deepEqual([page.width, page.height], [256, 256]);
  // Ж (U+0416: row 1, column 6) drawn 2× in its 16-pixel cell
  const at = (x: number, y: number) => page.data[(y * 256 + x) * 4 + 3];
  assert.equal(at(6 * 16, 16), 255);
  assert.equal(at(6 * 16 + 1, 17), 255);
  // a Cyrillic letter we didn't draw comes from the starter (А, U+0410)
  assert.ok([...Array(256).keys()].some((i) => at(i % 16, 16 + Math.floor(i / 16))));
  // 32-pixel glyphs: 512 pages
  const hd = bedrockFontFiles(docWith({ 'Ж': ['#'] }, 32), {});
  assert.equal(decodePngBytes(hd.files[bedrockPagePath(0x04)] as Uint8Array).width, 512);
});

// ------------------------------------------------------------------------------- packs

test('Java pack: pack.mcmeta for the version, pack.png, font files', async () => {
  const doc = starterFont('classic', 8);
  const r = await buildFontPack(doc, { name: 'Pixel Pal', description: 'Test font', edition: 'java', version: '26.3' });
  assert.equal(r.filename, 'Pixel Pal.zip');
  const files = unzipSync(new Uint8Array(await r.blob.arrayBuffer()));
  const meta = JSON.parse(text(files['pack.mcmeta']));
  assert.equal(meta.pack.description, 'Test font');
  assert.ok(files['pack.png'] && files[JAVA_FONT_JSON] && files['assets/minecraft/textures/font/pixel_pal/glyphs_0.png']);
  assert.equal(decodePngBytes(files['pack.png']).width, 128);
  const legacy = await buildFontPack(doc, { name: 'Old', description: 'x', edition: 'java', version: '1.8.9' });
  const lf = unzipSync(new Uint8Array(await legacy.blob.arrayBuffer()));
  assert.equal(JSON.parse(text(lf['pack.mcmeta'])).pack.pack_format, 1);
  assert.ok(lf[JAVA_ASCII_PNG] && !lf[JAVA_FONT_JSON]);
});

test('Bedrock pack: manifest, icon, stable uuids and a rising version', async () => {
  const doc = starterFont('classic', 8);
  const a = await buildFontPack(doc, { name: 'Пиксель', description: 'x', edition: 'bedrock', version: '' });
  assert.equal(a.filename, 'Пиксель.mcpack');
  const files = unzipSync(new Uint8Array(await a.blob.arrayBuffer()));
  const m = JSON.parse(text(files['manifest.json']));
  assert.equal(m.header.name, 'Пиксель');
  assert.equal(m.modules[0].type, 'resources');
  assert.ok(files['pack_icon.png'] && files[BEDROCK_DEFAULT8] && files['font/glyph_04.png']);
  const b = await buildFontPack(doc, { name: 'Пиксель', description: 'x', edition: 'bedrock', version: '', uuids: a.uuids, packVersion: a.packVersion });
  assert.deepEqual(b.uuids, a.uuids);
  assert.deepEqual(b.packVersion, [1, 0, 1]);
});

test('pack names become safe file names', () => {
  assert.equal(fontSlug('My Font!'), 'my_font');
  assert.equal(fontSlug('Schön & Groß'), 'schon_gro');
  assert.equal(fontSlug('Шрифт'), 'custom_font');
});

test('the font goes into a texture pack project, replacing its old font', () => {
  const p = newTextureProject({ name: 'Pack', edition: 'java', version: '26.3' });
  p.extraFiles['assets/minecraft/font/default.json'] = new Blob(['{}']);
  p.extraFiles['assets/minecraft/textures/font/old/0.png'] = new Blob(['x']);
  p.extraFiles['assets/minecraft/models/item/stick.json'] = new Blob(['{}']);
  const { project, replaced } = addFontToProject(p, docWith({ A: ['#'] }), 'mine');
  assert.ok(replaced);
  assert.deepEqual(Object.keys(project.extraFiles).sort(), ['assets/minecraft/font/default.json', 'assets/minecraft/models/item/stick.json', 'assets/minecraft/textures/font/mine/glyphs_0.png']);
  const b = addFontToProject(newTextureProject({ name: 'B', edition: 'bedrock', version: 'latest' }), docWith({ A: ['#'] }), 'mine');
  assert.ok(!b.replaced);
  assert.ok(b.project.extraFiles[BEDROCK_DEFAULT8]);
});

// ------------------------------------------------------------------------------- reading packs back

test('a Java pack reads back into the same glyphs (any glyph size)', async () => {
  for (const size of [8, 16] as const) {
    const doc = starterFont('bold', size);
    doc.space = 5;
    const r = await buildFontPack(doc, { name: 'Round', description: 'x', edition: 'java', version: '26.3' });
    const back = await importFontPack(r.blob, size);
    assert.equal(back.edition, 'java');
    assert.equal(back.doc.glyphs.size, doc.glyphs.size);
    assert.equal(back.doc.space, 5);
    for (const [c, m] of doc.glyphs) assert.deepEqual(back.doc.glyphs.get(c), m, String.fromCodePoint(c));
  }
  // read at another size: 8-pixel glyphs become 16-pixel blocks
  const small = await buildFontPack(docWith({ A: ['#'] }), { name: 'S', description: 'x', edition: 'java', version: '26.3' });
  const big = await importFontPack(small.blob, 16);
  assert.deepEqual(big.doc.glyphs.get(cp('A')), art(['#'], 16));
});

test('legacy and Bedrock packs read back their 8-row glyphs', async () => {
  const doc = starterFont('classic', 8);
  const legacy = await buildFontPack(doc, { name: 'L', description: 'x', edition: 'java', version: '1.12.2' });
  const l = await importFontPack(legacy.blob, 8);
  const want = glyphsFor(doc, { edition: 'java', version: '1.12.2' });
  for (const [c, m] of want) assert.deepEqual(l.doc.glyphs.get(c), m, String.fromCodePoint(c));
  const bed = await buildFontPack(doc, { name: 'B', description: 'x', edition: 'bedrock', version: '' });
  const b = await importFontPack(bed.blob, 8);
  assert.equal(b.edition, 'bedrock');
  const wantB = glyphsFor(doc, { edition: 'bedrock', version: '' });
  for (const [c, m] of wantB) assert.deepEqual(b.doc.glyphs.get(c), m, String.fromCodePoint(c));
});

test('packs inside a folder, and files that are not packs', async () => {
  assert.deepEqual(packRoot(['My Pack/pack.mcmeta', 'My Pack/assets/minecraft/font/default.json']), { prefix: 'My Pack/', edition: 'java' });
  assert.deepEqual(packRoot(['x/manifest.json', 'x/font/default8.png']), { prefix: 'x/', edition: 'bedrock' });
  assert.deepEqual(packRoot(['font/glyph_04.png']), { prefix: '', edition: 'bedrock' });
  await assert.rejects(importFontPack(new Blob([new Uint8Array([1, 2, 3, 4])]), 8), (e: { code?: string }) => e.code === 'not-pack');
});

test('bitmap providers of any cell size, height and ascent land where the game draws them', async () => {
  // a 16 × 16 cell sheet drawn 8 gui pixels high with ascent 7 (like ascii.png at 2×): one pixel block at the top left
  const img = createImageData(32, 16);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) img.data.set([255, 255, 255, 255], (y * 32 + x) * 4);
  const json = JSON.stringify({ providers: [{ type: 'reference', id: 'minecraft:include/mine' }] });
  const inc = JSON.stringify({ providers: [{ type: 'bitmap', file: 'mine:font/a.png', ascent: 7, chars: ['QR'] }, { type: 'bitmap', file: 'mine:font/a.png', ascent: 7, chars: ['Z\u0000'], filter: { uniform: true } }] });
  const src = mapSource({ 'assets/minecraft/font/default.json': strToU8(json), 'assets/minecraft/font/include/mine.json': strToU8(inc), 'assets/mine/textures/font/a.png': encodePng(img) });
  const r = await importJavaFont(src, 8);
  assert.deepEqual(r.doc.glyphs.get(cp('Q')), art(['#']));
  assert.ok(!r.doc.glyphs.has(cp('R')), 'empty cells are not glyphs');
  assert.ok(!r.doc.glyphs.has(cp('Z')), 'providers for Force Unicode Font are skipped');
  const b = await importBedrockFont(mapSource({}), 8);
  assert.equal(b.doc.glyphs.size, 0);
});

// ------------------------------------------------------------------------------- font files

function woffOf(ttf: Uint8Array): Uint8Array {
  const dv = new DataView(ttf.buffer, ttf.byteOffset, ttf.byteLength);
  const n = dv.getUint16(4);
  const tables: { tag: number[]; data: Uint8Array; check: number; orig: number }[] = [];
  for (let i = 0; i < n; i++) {
    const o = 12 + i * 16;
    const off = dv.getUint32(o + 8);
    const len = dv.getUint32(o + 12);
    const raw = ttf.subarray(off, off + len);
    const z = zlibSync(raw);
    tables.push({ tag: [...ttf.subarray(o, o + 4)], data: z.length < raw.length ? z : raw, check: dv.getUint32(o + 4), orig: len });
  }
  let size = 44 + n * 20;
  for (const t of tables) size += (t.data.length + 3) & ~3;
  const out = new Uint8Array(size);
  const ov = new DataView(out.buffer);
  out.set([0x77, 0x4f, 0x46, 0x46], 0);
  ov.setUint32(4, 0x00010000);
  ov.setUint32(8, size);
  ov.setUint16(12, n);
  let off = 44 + n * 20;
  tables.forEach((t, i) => {
    const o = 44 + i * 20;
    out.set(t.tag, o);
    ov.setUint32(o + 4, off);
    ov.setUint32(o + 8, t.data.length);
    ov.setUint32(o + 12, t.orig);
    ov.setUint32(o + 16, t.check);
    out.set(t.data, off);
    off += (t.data.length + 3) & ~3;
  });
  return out;
}

test('font files: TrueType kept, WOFF unpacked, OpenType (CFF) and WOFF2 only rasterised', () => {
  const ttf = makeTinyTtf({ name: 'Tiny Test', glyphs: TEST_GLYPHS });
  assert.equal(sniffFont(ttf), 'ttf');
  const info = readFontFile(ttf);
  assert.equal(info.name, 'Tiny Test');
  assert.ok(info.truetype);
  for (const c of [...Object.keys(TEST_GLYPHS), ' ']) assert.ok(info.chars!.has(cp(c)), `cmap has ${c}`);
  assert.ok(!info.chars!.has(cp('Z')));
  const woff = woffOf(ttf);
  assert.equal(sniffFont(woff), 'woff');
  const unpacked = woffToSfnt(woff);
  assert.deepEqual(sfntChars(unpacked), info.chars);
  assert.equal(readFontFile(woff).name, 'Tiny Test');
  assert.ok(readFontFile(woff).truetype, 'a WOFF of a TrueType font can go in a pack');
  const otf = ttf.slice();
  otf.set([0x4f, 0x54, 0x54, 0x4f], 0);
  assert.equal(sniffFont(otf), 'otf');
  assert.equal(readFontFile(otf).truetype, null);
  const woff2 = new Uint8Array(48);
  woff2.set([0x77, 0x4f, 0x46, 0x32]);
  assert.deepEqual(readFontFile(woff2), { format: 'woff2', truetype: null, chars: null, name: null });
  assert.equal(readFontFile(new Uint8Array(48)).format, 'unknown');
});

test('rasterising: pixels at least as opaque as the threshold become ink', () => {
  const rgba = new Uint8Array(8 * 12 * 4);
  rgba[3] = 200; // (0,0)
  rgba[7] = 100; // (1,0)
  assert.deepEqual([...alphaToMask(rgba, 8, 128)!.slice(0, 2)], [1, 0]);
  assert.deepEqual([...alphaToMask(rgba, 8, 90)!.slice(0, 2)], [1, 1]);
  assert.equal(alphaToMask(new Uint8Array(8 * 12 * 4), 8, 1), null);
});

test('drafts keep the font between visits', () => {
  const doc = starterFont('italic', 16);
  doc.space = 6;
  const back = fromDraft(JSON.parse(JSON.stringify(toDraft(doc))))!;
  assert.equal(back.size, 16);
  assert.equal(back.space, 6);
  assert.equal(back.glyphs.size, doc.glyphs.size);
  for (const [c, m] of doc.glyphs) assert.deepEqual(back.glyphs.get(c), m);
  assert.equal(fromDraft({ v: 2 }), null);
  assert.equal(fromDraft(null), null);
});

// ------------------------------------------------------------------------------- real game files

const jars = listJars();
const NO_JARS = 'no Minecraft client jars found (set TO_FIXTURES to a folder containing research-cache/jars/<version>.jar)';

function jarFonts(path: string): Record<string, Uint8Array> {
  return unzipSync(new Uint8Array(readFileSync(path)), { filter: (f) => f.name.startsWith('assets/minecraft/font/') || f.name.startsWith('assets/minecraft/textures/font/') });
}

test('real jars: which font files and providers each version has', { skip: jars.length ? false : NO_JARS }, () => {
  for (const jar of jars) {
    const files = jarFonts(jar.path);
    const support = javaFontSupport(jar.version);
    const all = Object.keys(files);
    assert.equal(all.includes(JAVA_FONT_JSON), support.json, `${jar.version}: default.json`);
    assert.ok(all.includes(JAVA_ASCII_PNG), `${jar.version}: ascii.png at the path legacy packs replace`);
    const providers = all.filter((p) => p.endsWith('.json')).flatMap((p) => (JSON.parse(text(files[p])).providers ?? []) as Record<string, unknown>[]);
    const types = new Set(providers.map((p) => p.type));
    if (!support.json) continue;
    assert.ok(types.has('bitmap'), `${jar.version}: bitmap`);
    assert.equal(types.has('space'), support.space, `${jar.version}: space provider`);
    assert.equal(types.has('reference'), support.unihex, `${jar.version}: reference provider (1.20+)`);
    assert.equal(types.has('legacy_unicode'), !support.unihex, `${jar.version}: legacy_unicode until 1.19.4`);
    assert.equal(providers.some((p) => 'filter' in p), support.filters, `${jar.version}: filters`);
    // our bitmap provider uses the same fields as the game's own
    for (const p of providers.filter((x) => x.type === 'bitmap')) {
      assert.ok(typeof p.file === 'string' && /^minecraft:font\/.+\.png$/.test(p.file as string));
      assert.ok(Array.isArray(p.chars) && typeof p.ascent === 'number');
      assert.ok(files[`assets/minecraft/textures/${(p.file as string).slice('minecraft:'.length)}`], `${jar.version}: ${p.file} under textures/`);
    }
  }
});

test('real jars: the legacy character order is the game’s own', { skip: jars.some((j) => /^1\.(7|8|9|10|11|12)/.test(j.version)) ? false : NO_JARS }, () => {
  const needle = Buffer.from('ÀÁÂÈÊË', 'utf8');
  for (const jar of jars.filter((j) => /^1\.(7|8|9|10|11|12)(\.|$)/.test(j.version))) {
    const classes = unzipSync(new Uint8Array(readFileSync(jar.path)), { filter: (f) => f.name.endsWith('.class') && !f.name.includes('/') });
    let found = '';
    for (const data of Object.values(classes)) {
      const buf = Buffer.from(data);
      const i = buf.indexOf(needle);
      if (i < 0) continue;
      const len = buf.readUInt16BE(i - 2);
      // modified UTF-8 writes \0 as C0 80
      const raw = buf.subarray(i, i + len);
      const bytes: number[] = [];
      for (let k = 0; k < raw.length; k++) {
        if (raw[k] === 0xc0 && raw[k + 1] === 0x80) {
          bytes.push(0);
          k++;
        } else bytes.push(raw[k]);
      }
      found = Buffer.from(bytes).toString('utf8');
      break;
    }
    assert.equal(found, LEGACY_ASCII_CHARS, `${jar.version}`);
  }
});

test('real jars: the game’s own glyphs read back with the game’s widths', { skip: jars.some((j) => j.version === '26.3') ? false : NO_JARS }, async () => {
  for (const version of ['26.3', '1.20.1', '1.16.5', '1.13', '1.12.2', '1.8.9', '1.6.1']) {
    const jar = jars.find((j) => j.version === version);
    if (!jar) continue;
    const r = await importJavaFont(mapSource(jarFonts(jar.path)), 8, { modern: javaFontSupport(version).json });
    const adv = (c: string) => glyphAdvance(r.doc.glyphs.get(cp(c))!, 8);
    // the widths every Minecraft player knows: i 2, l 3, t 4, I 4, ! 2, A 6, W 6, k 5, f 5
    assert.deepEqual(['i', 'l', 't', 'I', '!', 'A', 'W', 'k', 'f', '.'].map(adv), [2, 3, 4, 4, 2, 6, 6, 5, 5, 2], version);
    if (javaFontSupport(version).json) {
      assert.ok(r.doc.glyphs.has(cp('Ж')), `${version}: Cyrillic from nonlatin_european.png`);
      assert.ok(r.doc.glyphs.has(cp('Ä')), `${version}: accented.png`);
      // accented capitals rise above the ascii box (ascent 10)
      const Ae = r.doc.glyphs.get(cp('Ä'))!;
      assert.ok([...Ae.subarray(0, 3 * 8)].some(Boolean), `${version}: Ä's dots above the box`);
      // what we write reads back the same way
      const files = javaFontFiles(r.doc, version, { slug: 'rt' }).files;
      const back = await importJavaFont(mapSource(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, typeof v === 'string' ? strToU8(v) : v]))), 8);
      for (const c of 'AiЖÄ') assert.deepEqual(back.doc.glyphs.get(cp(c)), r.doc.glyphs.get(cp(c)), `${version} ${c}`);
    }
  }
});

test('glyph cell geometry', () => {
  assert.deepEqual([cellW(8), cellH(8), cellW(16), cellH(16), cellW(32), cellH(32)], [8, 12, 16, 24, 32, 48]);
  void encodePng;
});
