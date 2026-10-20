import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createImageData, decodePngBytes } from '../../src/core/image';
import {
  BEDROCK_TOTEM_PATH,
  JAVA_LEGACY_TOTEM_PATH,
  JAVA_TOTEM_PATH,
  LAYOUTS,
  activationCurve,
  imageColors,
  popFrame,
  STYLES,
  buildTotemPack,
  defaultPackName,
  javaHasTotem,
  javaTotemPath,
  makeTotem,
  renderFigure,
  sampleIndex,
  totemIcon,
  totemProject,
  totemShape,
  totemTexturePath,
} from '../../src/tools/totem/totem';
import { json, unzipBlob } from '../tools/texlogic/fixtures';

type RGBA = [number, number, number, number];
const at = (img: ImageData, x: number, y: number): RGBA => [...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)] as RGBA;
/** Colour that encodes a skin pixel's coordinates (alpha 255). */
const code = (x: number, y: number): RGBA => [x * 4, y * 4, 100, 255];

/** 64x64 skin where every pixel encodes its coordinates; the outer layer is see-through unless asked. */
function codedSkin(opts: { outer?: boolean; slim?: boolean } = {}): ImageData {
  const img = createImageData(64, 64);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const outerArea = (y < 16 && x >= 32) || (y >= 32 && y < 48) || (y >= 48 && (x < 16 || x >= 48));
      if (outerArea && !opts.outer) continue;
      img.data.set(code(x, y), (y * 64 + x) * 4);
    }
  if (opts.slim) {
    // Slim skins leave the 4th arm column unused (what detectSlim looks for).
    for (const [x0, y0, w, h] of [[54, 20, 2, 12], [46, 52, 2, 12], [50, 16, 2, 4], [42, 48, 2, 4]])
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) img.data.fill(0, (y * 64 + x) * 4, (y * 64 + x) * 4 + 4);
  }
  return img;
}

/** Opaque pixels as a 16-line map ('#' / '.'). */
function occupancy(img: ImageData): string {
  const rows: string[] = [];
  for (let y = 0; y < 16; y++) {
    let r = '';
    for (let x = 0; x < 16; x++) r += at(img, x, y)[3] ? '#' : '.';
    rows.push(r);
  }
  return rows.join('\n');
}

test('sampleIndex keeps both ends and spreads the rest evenly', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((i) => sampleIndex(i, 6, 8)), [0, 1, 3, 4, 6, 7], '8 -> 6 keeps the eye columns 1 and 6');
  assert.deepEqual([0, 1, 2].map((i) => sampleIndex(i, 3, 12)), [0, 6, 11]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map((i) => sampleIndex(i, 8, 8)), [0, 1, 2, 3, 4, 5, 6, 7], 'same size is 1:1');
  assert.equal(sampleIndex(0, 1, 4), 1);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => sampleIndex(i, 10, 8)), [0, 1, 2, 2, 3, 4, 5, 5, 6, 7], '8 -> 10 repeats two rows');
});

test('Classic: head front at full size, body, arms spread sideways, legs (synthetic skin)', () => {
  const skin = codedSkin();
  const t = renderFigure(skin, 'classic', { outer: false, model: 'classic' });
  assert.equal(t.width, 16);
  assert.equal(t.height, 16);
  assert.equal(
    occupancy(t),
    [
      '................',
      '....########....',
      '....########....',
      '....########....',
      '....########....',
      '....########....',
      '....########....',
      '....########....',
      '....########....',
      '.##############.',
      '.##############.',
      '....########....',
      '....########....',
      '....########....',
      '....########....',
      '....########....',
    ].join('\n'),
  );
  // Head front (8,8)-(15,15) unscaled at (4,1)
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) assert.deepEqual(at(t, 4 + x, 1 + y), code(8 + x, 8 + y), `head ${x},${y}`);
  // Body front (20,20) 8x12 -> 8x4 at (4,9): rows 0, 4, 7, 11
  assert.deepEqual(at(t, 4, 9), code(20, 20));
  assert.deepEqual(at(t, 11, 10), code(27, 24));
  assert.deepEqual(at(t, 4, 11), code(20, 27));
  assert.deepEqual(at(t, 11, 12), code(27, 31));
  // Right arm (44,20) held out to the left: hand at the far end, shoulder next to the body,
  // outer side (column 44) on top.
  assert.deepEqual(at(t, 1, 9), code(44, 31), 'right hand');
  assert.deepEqual(at(t, 3, 9), code(44, 20), 'right shoulder');
  assert.deepEqual(at(t, 3, 10), code(47, 20), 'right arm, inner side');
  // Left arm (36,52) held out to the right: its outer side is column 39
  assert.deepEqual(at(t, 12, 9), code(39, 52), 'left shoulder');
  assert.deepEqual(at(t, 14, 9), code(39, 63), 'left hand');
  // Legs: right (4,20), left (20,52), 4 wide, rows 0, 6, 11
  assert.deepEqual(at(t, 4, 13), code(4, 20));
  assert.deepEqual(at(t, 7, 15), code(7, 31));
  assert.deepEqual(at(t, 8, 14), code(20, 58));
  assert.deepEqual(at(t, 11, 15), code(23, 63));
});

test('the mapping is deterministic and every style stays inside 16x16', () => {
  const skin = codedSkin({ outer: true });
  for (const s of STYLES) {
    const a = renderFigure(skin, s.id);
    const b = renderFigure(skin, s.id);
    assert.deepEqual([...a.data], [...b.data], `${s.id} is deterministic`);
    for (const p of LAYOUTS[s.id]) {
      assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= 16 && p.y + p.h <= 16, `${s.id} ${p.part} fits`);
    }
    assert.ok(occupancy(a).includes('#'));
  }
  // Styles differ from each other
  assert.notDeepEqual([...renderFigure(skin, 'classic').data], [...renderFigure(skin, 'bighead').data]);
  assert.notDeepEqual([...renderFigure(skin, 'classic').data], [...renderFigure(skin, 'fullbody').data]);
  // Full body: head 8 -> 6 keeps columns 0, 1, 3, 4, 6, 7 of the face
  const fb = renderFigure(codedSkin(), 'fullbody', { outer: false });
  assert.deepEqual([5, 6, 7, 8, 9, 10].map((x) => at(fb, x, 0)[0] / 4), [8, 9, 11, 12, 14, 15]);
});

test('outer layer: hat over the face when on, base only when off', () => {
  const skin = codedSkin({ outer: true });
  const on = renderFigure(skin, 'classic', { outer: true });
  const off = renderFigure(skin, 'classic', { outer: false });
  assert.deepEqual(at(on, 4, 1), code(40, 8), 'hat front');
  assert.deepEqual(at(off, 4, 1), code(8, 8), 'face');
  assert.deepEqual(at(on, 4, 9), code(20, 36), 'jacket');
  // A half-transparent hat pixel is blended over the face
  const half = codedSkin();
  half.data.set([200, 0, 0, 128], (8 * 64 + 40) * 4);
  const blended = at(renderFigure(half, 'classic', { outer: true }), 4, 1);
  assert.equal(blended[3], 255);
  assert.ok(blended[0] > code(8, 8)[0] && blended[0] < 200, `blend ${blended}`);
});

test('slim arms are read 3 pixels wide (detected or given)', () => {
  const skin = codedSkin({ slim: true });
  const t = renderFigure(skin, 'classic', { outer: false });
  assert.deepEqual(at(t, 3, 10), code(46, 20), 'slim right arm inner side is column 46');
  assert.deepEqual(at(t, 12, 9), code(38, 52), 'slim left arm outer side is column 38');
  const forced = renderFigure(codedSkin(), 'classic', { outer: false, model: 'slim' });
  assert.deepEqual(at(forced, 3, 10), code(46, 20));
});

test('legacy 64x32 skins: left limbs mirror the right ones, only the hat as outer layer', () => {
  const legacy = createImageData(64, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) legacy.data.set(code(x, y), (y * 64 + x) * 4);
  // A hat layer with no see-through pixel at all counts as empty (the game's old-skin rule)
  assert.deepEqual(at(renderFigure(legacy, 'classic', { outer: true, model: 'classic' }), 4, 1), code(8, 8));
  legacy.data[(0 * 64 + 63) * 4 + 3] = 0;
  const t = renderFigure(legacy, 'classic', { outer: true, model: 'classic' });
  assert.deepEqual(at(t, 4, 1), code(40, 8), 'hat');
  assert.deepEqual(at(t, 4, 9), code(20, 20), 'no jacket: the body front shows');
  // Left leg = right leg front mirrored: left leg column 0 is right leg column 3
  assert.deepEqual(at(t, 8, 13), code(7, 20));
  assert.deepEqual(at(t, 11, 15), code(4, 31));
  // Left arm = right arm front mirrored
  assert.deepEqual(at(t, 12, 9), code(44, 20));
  assert.equal(occupancy(t), occupancy(renderFigure(codedSkin(), 'classic', { outer: false })));
  assert.throws(() => renderFigure(createImageData(32, 32), 'classic'), /64×64/);
  // HD 128x128 skins are read at 64x64
  const hd = createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) hd.data.set(code(x >> 1, y >> 1), (y * 128 + x) * 4);
  assert.deepEqual(at(renderFigure(hd, 'classic', { outer: false }), 4, 1), code(8, 8));
});

/** A stand-in totem (original shape): gold box with a dark outline, plus wings. */
function fakeVanilla(): ImageData {
  const v = createImageData(16, 16);
  const inside = (x: number, y: number) => (x >= 4 && x <= 11 && y >= 1 && y <= 14) || (y >= 8 && y <= 10 && x >= 1 && x <= 14);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (inside(x, y)) v.data.set([240, 200, 60, 255], (y * 16 + x) * 4);
  // Darken the outline the way the real texture does
  const shape = totemShape(v);
  for (let i = 0; i < 256; i++) if (shape.outline[i]) v.data.set([130, 60, 15, 255], i * 4);
  return v;
}

test('totemShape: silhouette and 4-neighbour outline', () => {
  const s = totemShape(fakeVanilla());
  const map = (a: Uint8Array) => Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => (a[y * 16 + x] ? '#' : '.')).join('')).join('\n');
  assert.equal(
    map(s.outline),
    [
      '................',
      '....########....',
      '....#......#....',
      '....#......#....',
      '....#......#....',
      '....#......#....',
      '....#......#....',
      '....#......#....',
      '.###........###.',
      '.#............#.',
      '.###........###.',
      '....#......#....',
      '....#......#....',
      '....#......#....',
      '....########....',
      '................',
    ].join('\n'),
  );
  assert.equal(s.mask.reduce((a, b) => a + b, 0), 8 * 14 + 2 * 3 * 3);
  // HD and strip textures are read at 16x16 (first frame)
  const strip = createImageData(32, 64);
  strip.data.fill(255);
  const hd = totemShape(strip);
  assert.equal(hd.image.width, 16);
  assert.equal(hd.image.height, 16);
});

test('gold outline: the vanilla outline is kept exactly and the figure is trimmed to the shape', () => {
  const vanilla = fakeVanilla();
  const shape = totemShape(vanilla);
  const skin = codedSkin({ outer: true });
  const t = makeTotem(skin, { style: 'classic', outer: true, outline: true, wings: false }, shape);
  for (let i = 0; i < 256; i++) {
    const x = i % 16;
    const y = (i / 16) | 0;
    if (shape.outline[i]) assert.deepEqual(at(t, x, y), at(vanilla, x, y), `outline ${x},${y}`);
    else if (!shape.mask[i]) assert.equal(at(t, x, y)[3], 0, `outside ${x},${y}`);
  }
  // Inside the outline the face is untouched
  assert.deepEqual(at(t, 5, 2), code(41, 9));
  // Without the game files the figure is returned as is
  assert.deepEqual([...makeTotem(skin, { style: 'classic', outer: true, outline: true, wings: true }, null).data], [...renderFigure(skin, 'classic').data]);
});

test('gold wings: the vanilla totem fills the gaps the figure leaves', () => {
  const vanilla = fakeVanilla();
  const shape = totemShape(vanilla);
  const skin = codedSkin();
  const t = makeTotem(skin, { style: 'fullbody', outer: false, outline: false, wings: true }, shape);
  // Full body leaves the wing tips (x 1-2, rows 8-10) empty: they stay gold
  assert.deepEqual(at(t, 1, 9), at(vanilla, 1, 9));
  assert.deepEqual(at(t, 14, 8), at(vanilla, 14, 8));
  // The figure is drawn over the totem
  assert.deepEqual(at(t, 5, 0), code(8, 8));
  assert.deepEqual(at(t, 4, 6), code(47, 20), 'right arm hangs over the totem');
  // Without wings those pixels are see-through
  assert.equal(at(makeTotem(skin, { style: 'fullbody', outer: false, outline: false, wings: false }, shape), 1, 9)[3], 0);
});

test('Java versions: totems from 1.11, items/totem.png until 1.12.2, item/totem_of_undying.png after', () => {
  assert.equal(javaHasTotem('1.10.2'), false);
  assert.equal(javaHasTotem('1.8.9'), false);
  assert.equal(javaHasTotem('1.11'), true);
  assert.equal(javaHasTotem('16w39a'), true, '1.11 snapshot');
  assert.equal(javaHasTotem('26.3'), true);
  assert.equal(javaTotemPath('1.11'), JAVA_LEGACY_TOTEM_PATH);
  assert.equal(javaTotemPath('1.12.2'), JAVA_LEGACY_TOTEM_PATH);
  assert.equal(javaTotemPath('1.13'), JAVA_TOTEM_PATH);
  assert.equal(javaTotemPath('1.21.11'), JAVA_TOTEM_PATH);
  assert.equal(javaTotemPath('26.3'), JAVA_TOTEM_PATH);
  assert.equal(JAVA_LEGACY_TOTEM_PATH, 'assets/minecraft/textures/items/totem.png');
  assert.equal(JAVA_TOTEM_PATH, 'assets/minecraft/textures/item/totem_of_undying.png');
  assert.equal(totemTexturePath('bedrock', 'latest'), BEDROCK_TOTEM_PATH);
  assert.equal(BEDROCK_TOTEM_PATH, 'textures/items/totem.png');
  // The game files win when they are known (snapshots around the rename)
  const old = { hasFile: (p: string) => p === JAVA_LEGACY_TOTEM_PATH };
  const flat = { hasFile: (p: string) => p === JAVA_TOTEM_PATH };
  assert.equal(totemTexturePath('java', '17w45a', old), JAVA_LEGACY_TOTEM_PATH);
  assert.equal(totemTexturePath('java', '1.12.2', flat), JAVA_TOTEM_PATH);
  assert.equal(totemTexturePath('java', '1.12.2', { hasFile: () => false }), JAVA_LEGACY_TOTEM_PATH);
});

test('Java pack: pack.mcmeta for the version, pack.png and the texture at the right path', async () => {
  const totem = renderFigure(codedSkin(), 'classic');
  const r = await buildTotemPack(totem, { name: 'Notch Totem', description: 'Totem of Undying that looks like Notch', edition: 'java', version: '26.3' });
  assert.equal(r.filename, 'Notch Totem.zip');
  const zip = await unzipBlob(r.blob);
  assert.deepEqual(Object.keys(zip).sort(), ['assets/minecraft/textures/item/totem_of_undying.png', 'pack.mcmeta', 'pack.png']);
  const meta = json(zip['pack.mcmeta']);
  assert.deepEqual(meta.pack.min_format, [97, 1]);
  assert.equal(meta.pack.max_format, 97);
  assert.equal(meta.pack.description, 'Totem of Undying that looks like Notch');
  const tex = decodePngBytes(zip[JAVA_TOTEM_PATH]);
  assert.deepEqual([tex.width, tex.height], [16, 16]);
  assert.deepEqual([...tex.data], [...totem.data]);
  const icon = decodePngBytes(zip['pack.png']);
  assert.deepEqual([icon.width, icon.height], [128, 128]);
  assert.deepEqual(at(icon, 4 * 8 + 3, 1 * 8 + 5), at(totem, 4, 1), 'icon is the totem at 8x');

  const old = await buildTotemPack(totem, { name: 'Old', edition: 'java', version: '1.12.2' });
  const oz = await unzipBlob(old.blob);
  assert.ok(oz[JAVA_LEGACY_TOTEM_PATH] && !oz[JAVA_TOTEM_PATH], Object.keys(oz).join());
  assert.equal(json(oz['pack.mcmeta']).pack.pack_format, 3);
  await assert.rejects(buildTotemPack(totem, { name: 'Too old', edition: 'java', version: '1.10.2' }), /added in Java 1\.11/);
});

test('Bedrock pack: manifest, pack icon and textures/items/totem.png; uuids kept, version bumped', async () => {
  const totem = renderFigure(codedSkin(), 'bighead');
  const first = await buildTotemPack(totem, { name: 'My: Totem', description: 'Totem of Undying that looks like me', edition: 'bedrock', version: '26.3' });
  assert.equal(first.filename, 'My_ Totem.mcpack');
  const zip = await unzipBlob(first.blob);
  assert.deepEqual(Object.keys(zip).sort(), ['manifest.json', 'pack_icon.png', 'textures/items/totem.png']);
  const m = json(zip['manifest.json']);
  assert.equal(m.format_version, 2);
  assert.equal(m.header.name, 'My: Totem');
  assert.equal(m.modules[0].type, 'resources');
  assert.deepEqual(m.header.version, first.packVersion);
  const icon = decodePngBytes(zip['pack_icon.png']);
  assert.deepEqual([icon.width, icon.height], [256, 256]);
  const again = await buildTotemPack(totem, { name: 'My: Totem', edition: 'bedrock', version: '26.3', uuids: first.uuids, packVersion: first.packVersion });
  const m2 = json((await unzipBlob(again.blob))['manifest.json']);
  assert.equal(m2.header.uuid, m.header.uuid);
  assert.equal(m2.modules[0].uuid, m.modules[0].uuid);
  assert.notDeepEqual(m2.header.version, m.header.version);
});

test('texture project for the editor, icon and names', async () => {
  const totem = renderFigure(codedSkin(), 'classic');
  const p = totemProject(totem, { name: 'Notch Totem', edition: 'java', version: '1.12.2' });
  assert.equal(p.kind, 'texturepack');
  assert.deepEqual(Object.keys(p.overrides), [JAVA_LEGACY_TOTEM_PATH]);
  assert.ok(p.icon instanceof Blob);
  const b = totemProject(totem, { name: '', edition: 'bedrock', version: 'latest' });
  assert.deepEqual(Object.keys(b.overrides), [BEDROCK_TOTEM_PATH]);
  assert.equal(b.name, 'Custom Totem');
  assert.ok(b.bedrockUuids);

  const icon = totemIcon(totem, 40);
  assert.equal(icon.width, 40);
  assert.deepEqual(at(icon, 4 + 4 * 2, 4 + 1 * 2), at(totem, 4, 1), '2x, centred');
  assert.equal(defaultPackName('Notch'), 'Notch Totem');
  assert.equal(defaultPackName("jeb_'s skin"), 'jeb_ Totem');
  assert.equal(defaultPackName(''), 'Custom Totem');
  assert.deepEqual(imageColors(totem, 3).length, 3);
});

test('pop animation curve: starts far away, comes close, ends far again', () => {
  assert.equal(activationCurve(0), 0);
  assert.ok(Math.abs(activationCurve(1) - 1.4) < 1e-9);
  assert.ok(Math.abs(popFrame(0).scale - 0.1) < 1e-9);
  const peak = Math.max(...Array.from({ length: 101 }, (_, i) => popFrame(i / 100).scale));
  assert.ok(peak > 0.9 && peak <= 1, `peak ${peak}`);
  assert.ok(popFrame(1).scale < 0.1);
});
