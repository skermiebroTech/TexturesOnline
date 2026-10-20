/**
 * Armour trims on worn humanoid armour: the game's palette swap reproduced exactly (checked against a
 * literal port of PaletteMapping / PalettedPermutations on every vanilla pattern and palette), the
 * darker palette on armour of the trim's own material (against the game's trim material and equipment
 * data), the versions that have trims and where each keeps its files, the trim over each piece on the
 * armour's own boxes (drawn above it, never z-fighting), the textures list, "Used by", the 3D mesh
 * colouring and live palette edits, and the Bedrock equivalents (TO_FIXTURES for the game files).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import { decodePngBytes } from '../../src/core/image';
import { paletteMapping, paletteSwatches, patternNames, materialNames, recolorTrim, sortPatterns, trimPaletteName, TRIM_PATTERNS, type RgbaImage } from '../../src/shared/models/trims';
import { JavaEntities, BedrockEntities } from '../../src/shared/models/entities';
import { mobLayer } from '../../src/shared/models/mob-geometry';
import { coplanarLifts } from '../../src/shared/models/model-paint';
import { ModelMesh, type ModelTextureImage } from '../../src/shared/models/model-mesh';
import { loadModelLibrary, type ModelLibrary } from '../../src/shared/models/index';
import { parseLenientJson } from '../../src/editions/bedrock/catalog';
import type { BakedQuad } from '../../src/shared/models/geometry';
import { bedrockSamplesDir, javaJarAssets, javaJarPath } from '../tools/models/fixtures';

const ROOT = new URL('../../', import.meta.url).pathname;
const T = 'assets/minecraft/textures/';
const SET = (m: string) => ({ helmet: m, chestplate: m, leggings: m, boots: m });
const img = (w: number, h: number, px: number[]): RgbaImage => ({ width: w, height: h, data: new Uint8ClampedArray(px.flatMap((c) => [(c >>> 16) & 255, (c >>> 8) & 255, c & 255, c >>> 24])) });
const argb = (d: RgbaImage['data'], i: number) => ((d[i * 4 + 3] << 24) | (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2]) >>> 0;

/** A literal port of the game's PaletteMapping.create / apply (26.3; PalettedPermutations before). */
function gameMapping(keys: number[], values: number[]) {
  if (keys.length !== values.length) throw new Error('sizes');
  const palette = new Map<number, number>();
  const opaque = (c: number) => (c | 0xff000000) >>> 0;
  const alpha = (c: number) => c >>> 24;
  for (let i = 0; i < keys.length; i++) if (alpha(keys[i]) !== 0) palette.set(opaque(keys[i]), values[i]);
  return (base: number) => {
    const baseAlpha = alpha(base);
    if (baseAlpha === 0) return base;
    const baseRgb = opaque(base);
    const target = palette.get(baseRgb) ?? baseRgb;
    return (((Math.trunc((baseAlpha * alpha(target)) / 255) << 24) | (target & 0xffffff)) >>> 0);
  };
}
const pixels = (im: RgbaImage) => Array.from({ length: im.width * im.height }, (_, i) => argb(im.data, i));

test('palette swap: the game rules (RGB match, alpha multiplied, others kept, transparent kept, later keys win)', () => {
  const key = img(4, 1, [0xffe0e0e0, 0xffc0c0c0, 0x00a0a0a0, 0xffe0e0e0]);
  const values = img(4, 1, [0xff111111, 0x80222222, 0xff333333, 0xff444444]);
  const f = paletteMapping(key, values)!;
  // the last of two equal keys wins; a key with alpha 0 maps nothing
  assert.equal(f(0xffe0e0e0), 0xff444444);
  assert.equal(f(0xffa0a0a0), 0xffa0a0a0);
  // a half-transparent value halves the alpha; a half-transparent pixel keeps its share
  assert.equal(f(0xffc0c0c0), 0x80222222);
  assert.equal(f(0x80c0c0c0), ((Math.floor((0x80 * 0x80) / 255) << 24) | 0x222222) >>> 0);
  // matching ignores the pixel's alpha; other colours stay as painted; transparent pixels stay
  assert.equal(f(0x40e0e0e0), 0x40444444);
  assert.equal(f(0xff123456), 0xff123456);
  assert.equal(f(0x00e0e0e0), 0x00e0e0e0);
  // palettes of different sizes: no mapping (the pattern is drawn grey)
  assert.equal(paletteMapping(key, img(3, 1, [0, 0, 0])), null);
  const pat = img(2, 1, [0xffe0e0e0, 0xff00ff00]);
  assert.deepEqual([...recolorTrim(pat, key, img(3, 1, [0, 0, 0])).data], [...pat.data]);
  assert.deepEqual(pixels(recolorTrim(pat, key, values)), [0xff444444, 0xff00ff00]);
  // the swatches pair each used key with its colour
  assert.deepEqual(
    paletteSwatches(key, values).map((s) => s.key),
    [
      [0xe0, 0xe0, 0xe0],
      [0xc0, 0xc0, 0xc0],
      [0xe0, 0xe0, 0xe0],
    ],
  );
});

const jar263 = javaJarPath('26.3');
const jar262 = javaJarPath('26.2');
function jarFiles(jar: string, re: RegExp): Record<string, Uint8Array> {
  return unzipSync(new Uint8Array(readFileSync(jar)), { filter: (f) => re.test(f.name) });
}

test('palette swap matches the game on every vanilla pattern and palette (26.3 and 26.2 layouts)', { skip: !(jar263 && jar262) && 'jars not found (set TO_FIXTURES)' }, () => {
  let n = 0;
  for (const [jar, keyPath, palDir] of [
    [jar263!, `${T}palettes/trim_base.png`, `${T}palettes/trim/`],
    [jar262!, `${T}trims/color_palettes/trim_palette.png`, `${T}trims/color_palettes/`],
  ] as const) {
    const files = jarFiles(jar, /^assets\/minecraft\/textures\/(trims\/entity|palettes|trims\/color_palettes)\/.*\.png$/);
    const key = decodePngBytes(files[keyPath]);
    assert.equal(key.width * key.height, 8, 'eight key greys');
    const pals = Object.keys(files).filter((p) => p.startsWith(palDir) && p !== keyPath && !p.slice(palDir.length).includes('/'));
    assert.ok(pals.length >= 16, `${pals.length} palettes`);
    const patterns = Object.keys(files).filter((p) => /trims\/entity\/humanoid(_leggings)?\/\w+\.png$/.test(p));
    assert.equal(patterns.length, 36, '18 patterns, each with a leggings layout');
    for (const pp of patterns) {
      const pat = decodePngBytes(files[pp]);
      assert.deepEqual([pat.width, pat.height], [64, 32], pp);
      // every opaque texel is one of the key greys
      for (const c of pixels(pat)) if (c >>> 24) assert.ok(pixels(key).includes(c), `${pp}: ${c.toString(16)} is a key grey`);
      for (const pal of pals) {
        const values = decodePngBytes(files[pal]);
        const game = gameMapping(pixels(key), pixels(values));
        const ours = pixels(recolorTrim(pat, key, values));
        assert.deepEqual(ours, pixels(pat).map(game), `${pp} with ${pal}`);
        n++;
      }
    }
  }
  assert.ok(n >= 36 * 16 * 2, `${n} pattern × palette pairs`);
});

test('darker palette: the game data says it, the library does it', { skip: !(jar263 && jar262) && 'jars not found (set TO_FIXTURES)' }, async () => {
  // the rule
  const has = (n: string) => ['iron', 'iron_darker', 'gold', 'gold_darker', 'copper', 'amethyst'].includes(n);
  assert.equal(trimPaletteName('iron', 'iron', has), 'iron_darker');
  assert.equal(trimPaletteName('iron', 'gold', has), 'iron');
  assert.equal(trimPaletteName('gold', 'gold', has), 'gold_darker');
  assert.equal(trimPaletteName('copper', 'copper', has), 'copper', 'no darker palette: the plain one');
  assert.equal(trimPaletteName('amethyst', 'amethyst', has), 'amethyst');
  // 26.3: equipment/<material>.json trim_overrides; 26.2: trim_material override_armor_assets
  const eq = jarFiles(jar263!, /^assets\/minecraft\/equipment\/\w+\.json$/);
  const overrides263 = new Map<string, string>();
  for (const [p, b] of Object.entries(eq)) {
    const j = JSON.parse(new TextDecoder().decode(b)) as { trim_overrides?: { palette: string; when: { material: string } }[] };
    for (const o of j.trim_overrides ?? []) overrides263.set(`${p.match(/(\w+)\.json$/)![1]}|${o.when.material.replace('minecraft:', '')}`, o.palette.replace('minecraft:trim/', ''));
  }
  const tm = jarFiles(jar262!, /^data\/minecraft\/trim_material\/\w+\.json$/);
  const overrides262 = new Map<string, string>();
  for (const [p, b] of Object.entries(tm)) {
    const j = JSON.parse(new TextDecoder().decode(b)) as { override_armor_assets?: Record<string, string> };
    for (const [armor, pal] of Object.entries(j.override_armor_assets ?? {})) overrides262.set(`${armor.replace('minecraft:', '')}|${p.match(/(\w+)\.json$/)![1]}`, pal);
  }
  assert.deepEqual([...overrides263.keys()].sort(), ['copper|copper', 'diamond|diamond', 'gold|gold', 'iron|iron', 'netherite|netherite']);
  assert.deepEqual(new Map([...overrides262].sort()), new Map([...overrides263].sort()));
  for (const version of ['26.3', '26.2']) {
    const lib = await loadModelLibrary(javaJarAssets(version)!);
    const z = lib.entity('zombie')!;
    await lib.prepare(z);
    const armors = lib.properties(z).find((p) => p.name === 'chestplate')!.values.map((v) => v.value).filter((v) => v !== 'none');
    const mats = lib.properties(z).find((p) => p.name === 'trim_material')!.values.map((v) => v.value);
    for (const a of armors)
      for (const m of mats) {
        const v = lib.resolve(z, { ...SET(a), trim: 'coast', trim_material: m });
        const used = [...new Set(v.quads.filter((q) => q.palette).map((q) => q.palette!.values.match(/(\w+)\.png$/)![1]))];
        const want = (version === '26.3' ? overrides263 : overrides262).get(`${a}|${m}`) ?? m;
        assert.deepEqual(used, [want], `${version}: ${m} trim on ${a} armour`);
      }
  }
  // mixed armour: each piece by its own material
  const lib = await loadModelLibrary(javaJarAssets('26.3')!);
  const z = lib.entity('zombie')!;
  await lib.prepare(z);
  const v = lib.resolve(z, { ...SET('diamond'), helmet: 'iron', trim: 'eye', trim_material: 'iron' });
  const byPiece = new Map(v.quads.filter((q) => q.palette).map((q) => [q.texture!.replace(T, '') + '|' + q.palette!.values.replace(T, ''), true]));
  assert.deepEqual([...byPiece.keys()].sort(), ['trims/entity/humanoid/eye.png|palettes/trim/iron.png', 'trims/entity/humanoid/eye.png|palettes/trim/iron_darker.png', 'trims/entity/humanoid_leggings/eye.png|palettes/trim/iron.png']);
});

const libs = new Map<string, Promise<ModelLibrary>>();
const lib = (v: string) => {
  let p = libs.get(v);
  if (!p) libs.set(v, (p = loadModelLibrary(javaJarAssets(v)!)));
  return p;
};
const has = (v: string) => !!javaJarAssets(v);
const trimProps = async (version: string, id = 'zombie') => {
  const l = await lib(version);
  const e = l.entity(id)!;
  const props = l.properties(e);
  return { l, e, trim: props.find((p) => p.name === 'trim'), mat: props.find((p) => p.name === 'trim_material') };
};

test('Java versions: trims only where the version has them, from where it keeps them', { skip: !['1.19.3', '1.19.4', '1.20.1', '1.21.1', '1.21.4', '26.3'].every(has) && 'jars not found (set TO_FIXTURES)' }, async () => {
  assert.equal((await trimProps('1.19.3')).trim, undefined, 'no trims before 1.19.4');
  assert.equal((await trimProps('1.19.3')).mat, undefined);
  const counts: Record<string, [number, number]> = { '1.19.4': [11, 10], '1.20.1': [16, 10], '1.21.1': [18, 10], '1.21.4': [18, 11], '26.3': [18, 11] };
  for (const [v, [np, nm]] of Object.entries(counts)) {
    const { trim, mat } = await trimProps(v);
    assert.equal(trim!.values.length - 1, np, `${v} patterns`);
    assert.equal(mat!.values.length, nm, `${v} materials`);
    assert.deepEqual(
      trim!.values.slice(1).map((x) => x.value),
      TRIM_PATTERNS.slice(0, np === 11 ? 11 : np === 16 ? 17 : 18).filter((p) => np !== 16 || p !== 'flow'),
    );
  }
  assert.ok((await trimProps('1.21.4')).mat!.values.some((x) => x.value === 'resin') && !(await trimProps('1.21.1')).mat!.values.some((x) => x.value === 'resin'));
  const paths = async (v: string) => {
    const { l, e } = await trimProps(v);
    await l.prepare(e);
    const view = l.resolve(e, { ...SET('gold'), trim: 'sentry', trim_material: 'lapis' });
    return [...new Set(view.quads.filter((q) => q.palette).flatMap((q) => [q.texture!, q.palette!.key, q.palette!.values]))].map((p) => p.replace(T, '')).sort();
  };
  assert.deepEqual(await paths('1.20.1'), ['trims/color_palettes/lapis.png', 'trims/color_palettes/trim_palette.png', 'trims/models/armor/sentry.png', 'trims/models/armor/sentry_leggings.png']);
  assert.deepEqual(await paths('1.21.4'), ['trims/color_palettes/lapis.png', 'trims/color_palettes/trim_palette.png', 'trims/entity/humanoid/sentry.png', 'trims/entity/humanoid_leggings/sentry.png']);
  assert.deepEqual(await paths('26.3'), ['palettes/trim/lapis.png', 'palettes/trim_base.png', 'trims/entity/humanoid/sentry.png', 'trims/entity/humanoid_leggings/sentry.png']);
  // offered only with armour on, on adults; the material only with a pattern picked
  const { trim, mat } = await trimProps('26.3');
  assert.ok(!trim!.showIf!({ age: 'adult' }) && trim!.showIf!({ age: 'adult', helmet: 'iron' }) && !trim!.showIf!({ age: 'baby', helmet: 'iron' }));
  assert.ok(!mat!.showIf!({ age: 'adult', helmet: 'iron', trim: 'none' }) && mat!.showIf!({ age: 'adult', helmet: 'iron', trim: 'vex' }));
  // babies' armour shows no trim; no armour, no trim
  const { l, e } = await trimProps('26.3');
  assert.ok(!l.resolve(e, { ...SET('iron'), age: 'baby', trim: 'vex' }).quads.some((q) => q.palette));
  assert.ok(!l.resolve(e, { trim: 'vex' }).quads.some((q) => q.palette));
});

test('Java 26.3: the trim goes over each piece on its boxes, drawn above the armour, a part of its own', { skip: !has('26.3') && 'Java 26.3 client jar not found (set TO_FIXTURES)' }, async () => {
  const l = await lib('26.3');
  for (const id of ['zombie', 'armor_stand', 'piglin', 'skeleton', 'drowned', 'giant']) {
    const e = l.entity(id)!;
    await l.prepare(e);
    const v = l.resolve(e, { ...SET('leather'), trim: 'ward', trim_material: 'redstone' });
    const trims = v.quads.map((q, i) => [q, i] as const).filter(([q]) => q.palette);
    assert.ok(trims.length > 0, id);
    // the parts list ends with the trim, its own entry
    assert.equal(v.parts!.at(-1)!.label, 'Trim');
    assert.ok(trims.every(([q]) => v.parts![q.part].label === 'Trim'));
    // each trim face is an armour face (same corners, same UVs) drawn after it, so the 3D view lifts it above
    const lifts = coplanarLifts(v.quads);
    const key = (q: BakedQuad) => JSON.stringify([q.positions, q.uvs]);
    for (const [q, i] of trims) {
      const under = v.quads.findIndex((a, j) => j < i && !a.palette && key(a) === key(q));
      assert.ok(under >= 0, `${id}: trim face over an armour face`);
      assert.ok(lifts[i] > lifts[under], `${id}: trim above the armour (and the leather overlay)`);
      for (const [u, w] of q.uvs) assert.ok(u >= 0 && u <= 16 && w >= 0 && w <= 16, `${id}: trim UV on its texture`);
      // leggings trims on the leggings layout, the others on the humanoid one
      const piece = v.parts![v.quads[under].part].name;
      assert.equal(q.texture!.includes('humanoid_leggings'), piece === 'gear:leggings', `${id}: ${piece} trim texture`);
      assert.deepEqual(v.texSizes!.get(q.texture!), mobLayer(`${id}#leggings`)!.texSize);
    }
    // the trim, its key and colours are listed as in use, labelled
    const listed = v.textures.filter((t) => t.faces > 0).map((t) => t.label);
    for (const label of ['Trim', 'Leggings trim', 'Trim colour key', 'Trim colours']) assert.ok(listed.includes(label), `${id}: ${listed.join()}`);
  }
});

test('Java 26.3: trim textures open on the armour stand in iron armour with that trim; "Used by" lists the wearers', { skip: !has('26.3') && 'Java 26.3 client jar not found (set TO_FIXTURES)' }, async () => {
  const l = await lib('26.3');
  l.usage();
  for (const p of ['trims/entity/humanoid/wild.png', 'trims/entity/humanoid_leggings/wild.png', 'palettes/trim/emerald.png', 'palettes/trim/gold_darker.png', 'palettes/trim_base.png']) {
    const u = l.usageOf(T + p).entities;
    assert.equal(u[0], 'armor_stand', p);
    for (const id of ['zombie', 'skeleton', 'piglin', 'drowned', 'husk', 'stray', 'wither_skeleton', 'zombified_piglin']) assert.ok(u.includes(id), `${p} used by ${id}`);
  }
  const stand = l.entity('armor_stand')!;
  await l.prepare(stand);
  const all = l.resolve(stand, l.defaultState(stand)).textures;
  const st = (p: string) => all.find((t) => t.path === T + p)!.state!;
  assert.deepEqual({ ...st('trims/entity/humanoid/wild.png') }, { ...SET('iron'), dye: 'none', trim: 'wild', trim_material: 'amethyst' });
  assert.equal(st('trims/entity/humanoid_leggings/tide.png').trim, 'tide');
  // a palette on armour of another material, a darker palette on its own
  assert.deepEqual([st('palettes/trim/emerald.png').chestplate, st('palettes/trim/emerald.png').trim_material], ['iron', 'emerald']);
  assert.deepEqual([st('palettes/trim/iron.png').chestplate, st('palettes/trim/iron.png').trim_material], ['gold', 'iron']);
  assert.deepEqual([st('palettes/trim/gold_darker.png').chestplate, st('palettes/trim/gold_darker.png').trim_material], ['gold', 'gold']);
  // each of those states shows the texture
  for (const p of ['trims/entity/humanoid/wild.png', 'palettes/trim/iron.png', 'palettes/trim/gold_darker.png']) {
    const v = l.resolve(stand, st(p));
    assert.ok(v.textures.some((t) => t.path === T + p && t.faces > 0), p);
  }
});

test('Java: trim patterns and materials newer than the lists are found in the version’s folders', { skip: !has('26.3') && 'Java 26.3 client jar not found (set TO_FIXTURES)' }, async () => {
  const a = javaJarAssets('26.3')!;
  const extra = [`${T}trims/entity/humanoid/zigzag.png`, `${T}trims/entity/humanoid_leggings/zigzag.png`, `${T}palettes/trim/echo.png`];
  const files = new Set([...a.listFiles(''), ...extra]);
  const java = new JavaEntities({ hasFile: (p) => files.has(p), listFiles: (p) => [...files].filter((f) => f.startsWith(p)) });
  const props = java.properties('zombie');
  assert.equal(props.find((p) => p.name === 'trim')!.values.at(-1)!.value, 'zigzag');
  assert.ok(props.find((p) => p.name === 'trim_material')!.values.some((v) => v.value === 'echo'));
  assert.ok(java.textureStates('armor_stand').some((t) => t.path === extra[0] && t.home));
  // the helpers behind it
  assert.deepEqual(patternNames(['d/a.png', 'd/a_leggings.png', 'd/b_mers.tga', 'd/x/c.png', 'd/b_mers.png'], 'd/'), ['a']);
  assert.deepEqual(materialNames(['d/iron.png', 'd/iron_darker.png', 'd/trim_palette.png', 'd/trim_base.png'], 'd/'), ['iron']);
  assert.deepEqual(sortPatterns(['bolt', 'zigzag', 'sentry', 'apple']), ['sentry', 'bolt', 'apple', 'zigzag']);
});

test('3D mesh: trims are recoloured by their palettes, per piece, and follow live pattern and palette edits', () => {
  const tex = (w: number, h: number, px: number[]): ModelTextureImage => ({ image: img(w, h, px), frames: 1, frametime: 0 });
  const quad = (texture: string, values: string, z: number): BakedQuad => ({
    positions: [
      [0, 0, z],
      [1, 0, z],
      [1, 1, z],
      [0, 1, z],
    ],
    uvs: [
      [0, 0],
      [16, 0],
      [16, 16],
      [0, 16],
    ],
    normal: [0, 0, 1],
    dir: 'south',
    worldDir: 'south',
    texture,
    ref: texture,
    role: 'trim',
    tintindex: -1,
    tint: null,
    shade: false,
    part: 0,
    element: 0,
    palette: { key: 'key.png', values },
  });
  const textures = new Map<string, ModelTextureImage>([
    ['pat.png', tex(2, 1, [0xffe0e0e0, 0xffc0c0c0])],
    ['key.png', tex(2, 1, [0xffe0e0e0, 0xffc0c0c0])],
    ['iron.png', tex(2, 1, [0xff111111, 0xff222222])],
    ['iron_darker.png', tex(2, 1, [0xff010101, 0xff020202])],
  ]);
  const mesh = new ModelMesh();
  mesh.build([quad('pat.png', 'iron.png', 0), quad('pat.png', 'iron_darker.png', 1)], textures, () => [255, 255, 255]);
  type G = { path: string; image: RgbaImage; palette: { values: string } | null };
  const groups = () => [...(mesh as unknown as { groups: Map<string, G> }).groups.values()];
  const shown = (values: string) => pixels(groups().find((g) => g.palette?.values === values)!.image);
  assert.equal(groups().length, 2, 'one draw per palette pair');
  assert.deepEqual(shown('iron.png'), [0xff111111, 0xff222222]);
  assert.deepEqual(shown('iron_darker.png'), [0xff010101, 0xff020202]);
  assert.deepEqual(mesh.frameSize('pat.png'), [2, 1]);
  // painting the pattern: both pieces recolour it; a non-key colour stays as painted
  assert.ok(mesh.updateTexture('pat.png', tex(2, 1, [0xffc0c0c0, 0xff00ff00])));
  assert.deepEqual(shown('iron.png'), [0xff222222, 0xff00ff00]);
  assert.deepEqual(shown('iron_darker.png'), [0xff020202, 0xff00ff00]);
  // painting a palette recolours the trims using it
  assert.ok(mesh.updateTexture('iron.png', tex(2, 1, [0xff111111, 0xffabcdef])));
  assert.deepEqual(shown('iron.png'), [0xffabcdef, 0xff00ff00]);
  assert.deepEqual(shown('iron_darker.png'), [0xff020202, 0xff00ff00]);
  assert.ok(!mesh.updateTexture('other.png', tex(1, 1, [0])));
  // without its palettes a trim draws its grey pattern (as the game does)
  const bare = new ModelMesh();
  bare.build([quad('pat.png', 'missing.png', 0)], textures, () => [255, 255, 255]);
  assert.deepEqual(pixels((bare as unknown as { groups: Map<string, G> }).groups.get('pat.png')!.image), [0xffe0e0e0, 0xffc0c0c0]);
  mesh.dispose();
  bare.dispose();
});

// ------------------------------------------------------------------------------------------ Bedrock

const BEDROCK = bedrockSamplesDir() ?? '/nonexistent';
const bedrockReady = existsSync(join(BEDROCK, 'attachables')) && existsSync(join(BEDROCK, 'textures', 'trims', 'sentry.png'));

test('Bedrock: trims from textures/trims over each adult piece, darker on their own material', { skip: !bedrockReady && 'Bedrock samples not found (set TO_FIXTURES)' }, async () => {
  const idx = JSON.parse(readFileSync(join(ROOT, 'public/data/bedrock/index-main.json'), 'utf8')) as { dirs: Record<string, string[]> };
  const files: string[] = [];
  for (const [dir, list] of Object.entries(idx.dirs)) for (const f of list) files.push(dir ? `${dir}/${f}` : f);
  const set = new Set(files);
  const be = new BedrockEntities({
    hasFile: (p) => set.has(p),
    listFiles: (p) => files.filter((f) => f.startsWith(p)),
    readJson: async (p) => (existsSync(join(BEDROCK, p)) ? parseLenientJson(readFileSync(join(BEDROCK, p), 'utf8')) : undefined),
  });
  assert.ok(await be.load('zombie'));
  const props = be.properties('zombie');
  const trim = props.find((p) => p.name === 'trim')!;
  assert.deepEqual(
    trim.values.slice(1).map((v) => v.value),
    [...TRIM_PATTERNS],
  );
  assert.equal(props.find((p) => p.name === 'trim_material')!.values.length, 11);
  let v = be.resolve('zombie', { ...be.defaultState('zombie'), ...SET('iron'), trim: 'host', trim_material: 'iron' });
  const t = v.quads.filter((q) => q.palette);
  assert.deepEqual([...new Set(t.map((q) => q.texture))].sort(), ['textures/trims/host.png', 'textures/trims/host_leggings.png']);
  assert.deepEqual([...new Set(t.map((q) => q.palette!.values))], ['textures/trims/color_palettes/iron_darker.png']);
  assert.equal(t[0].palette!.key, 'textures/trims/color_palettes/trim_palette.png');
  assert.equal(v.parts.at(-1)!.label, 'Trim');
  v = be.resolve('zombie', { ...be.defaultState('zombie'), ...SET('diamond'), trim: 'host', trim_material: 'quartz' });
  assert.deepEqual([...new Set(v.quads.filter((q) => q.palette).map((q) => q.palette!.values))], ['textures/trims/color_palettes/quartz.png']);
  // babies wear none; the trim's files open on the armour stand
  v = be.resolve('zombie', { ...be.defaultState('zombie'), look: 'baby', ...SET('iron'), trim: 'host' });
  assert.ok(!v.quads.some((q) => q.palette));
  assert.ok(await be.load('armor_stand'));
  const ts = be.textureStates('armor_stand');
  for (const p of ['textures/trims/host.png', 'textures/trims/color_palettes/lapis.png', 'textures/trims/color_palettes/gold_darker.png']) assert.ok(ts.some((x) => x.path === p && x.gear && x.home), p);
  // the Bedrock palettes are the Java ones (same key, eight colours each)
  const key = decodePngBytes(new Uint8Array(readFileSync(join(BEDROCK, 'textures/trims/color_palettes/trim_palette.png'))));
  assert.deepEqual(pixels(key), [0xffe0e0e0, 0xffc0c0c0, 0xffa0a0a0, 0xff808080, 0xff606060, 0xff404040, 0xff202020, 0xff000000]);
});
