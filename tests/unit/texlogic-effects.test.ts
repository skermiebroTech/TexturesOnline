import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EFFECTS,
  EFFECT_PRESETS,
  applyEffects,
  createLayer,
  defaultParams,
  effectsApply,
  getEffect,
  layerApplies,
  resolveParams,
  type EffectContext,
} from '../../src/tools/textures/effects';
import type { EffectLayer, TextureCategory } from '../../src/core/types';

type Img = ImageData;

function makeImg(w: number, h: number, fill: (x: number, y: number) => [number, number, number, number]): Img {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const px = fill(x, y);
      data.set(px, (y * w + x) * 4);
    }
  return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
}

/** A 16x16 item-like texture: a coloured diamond on transparent background, with coloured alpha-0 pixels. */
function itemTexture(): Img {
  return makeImg(16, 16, (x, y) => {
    const inside = Math.abs(x - 7.5) + Math.abs(y - 7.5) < 6;
    if (!inside) return [(x * 13) & 255, (y * 29) & 255, 77, 0]; // hidden colour under alpha 0
    return [40 + x * 12, 200 - y * 9, 90 + ((x * y) % 50), y > 10 ? 180 : 255];
  });
}

function blockTexture(w = 16, h = 16): Img {
  return makeImg(w, h, (x, y) => [100 + ((x * 37 + y * 11) % 90), 90 + ((x * 7 + y * 23) % 80), 70 + ((x * 3 + y * 5) % 60), 255]);
}

const PNG_CTX: EffectContext = { path: 'assets/minecraft/textures/item/test.png', category: 'item' };
const BLOCK_CTX: EffectContext = { path: 'assets/minecraft/textures/block/test.png', category: 'block' };

function layer(type: string, params: Record<string, number | boolean | string> = {}, categories?: TextureCategory[]): EffectLayer {
  return { id: type, ...createLayer(type, params), ...(categories ? { categories } : { categories: undefined }) } as EffectLayer;
}

test('registry: every effect has unique type, label and valid option defs', () => {
  const types = new Set<string>();
  for (const e of EFFECTS) {
    assert.ok(!types.has(e.type), `duplicate ${e.type}`);
    types.add(e.type);
    assert.ok(e.label.length > 0);
    const keys = new Set<string>();
    for (const o of e.params) {
      assert.ok(!keys.has(o.key), `${e.type}.${o.key} duplicated`);
      keys.add(o.key);
      if (o.type === 'range') {
        assert.equal(typeof o.default, 'number');
        assert.ok(o.min! <= (o.default as number) && (o.default as number) <= o.max!, `${e.type}.${o.key} default out of range`);
      }
      if (o.type === 'select') assert.ok(o.options!.some((x) => x.value === o.default), `${e.type}.${o.key} default not an option`);
      if (o.type === 'color') assert.match(String(o.default), /^#[0-9a-f]{6}$/i);
    }
  }
  for (const t of ['hue', 'saturation', 'brightness', 'contrast', 'temperature', 'tint', 'grayscale', 'sepia', 'invert', 'posterize', 'pastel', 'vignette', 'outline', 'noise', 'sharpen', 'blur', 'pixelate', 'upscale', 'dither', 'glow', 'flip', 'gradientMap', 'palette']) {
    assert.ok(getEffect(t), `missing effect ${t}`);
  }
});

test('every effect is deterministic, pure and keeps alpha-0 pixels intact (unless it is about alpha)', () => {
  for (const e of EFFECTS) {
    for (const [ctx, img] of [
      [PNG_CTX, itemTexture()],
      [BLOCK_CTX, blockTexture()],
    ] as const) {
      const before = new Uint8ClampedArray(img.data);
      const params = defaultParams(e.type);
      const a = e.apply(img, params, ctx);
      const b = e.apply(img, params, ctx);
      assert.deepEqual(img.data, before, `${e.type} mutated its input`);
      assert.deepEqual(a.data, b.data, `${e.type} is not deterministic`);
      if (e.kind === 'resize') continue;
      assert.equal(a.width, img.width);
      assert.equal(a.height, img.height);
      if (e.type === 'flip') continue;
      for (let i = 0; i < img.data.length; i += 4) {
        if (e.kind !== 'alpha') assert.equal(a.data[i + 3], img.data[i + 3], `${e.type} changed alpha at ${i / 4}`);
        if (img.data[i + 3] === 0 && e.kind !== 'alpha') {
          assert.deepEqual([...a.data.subarray(i, i + 4)], [...img.data.subarray(i, i + 4)], `${e.type} touched a transparent pixel`);
        }
        if (img.data[i + 3] > 0) assert.equal(a.data[i + 3], img.data[i + 3], `${e.type} changed alpha of a visible pixel`);
      }
    }
  }
});

test('Bedrock .tga textures: colour under alpha 0 is graded, alpha (tint mask) is kept exactly', () => {
  const img = makeImg(4, 4, (x, y) => [120 + x * 10, 80 + y * 10, 60, x < 2 ? 0 : 255]); // like grass_side.tga
  const ctx: EffectContext = { path: 'textures/blocks/grass_side.tga', category: 'block' };
  const out = applyEffects(img, [layer('invert')], ctx);
  for (let i = 0; i < img.data.length; i += 4) {
    assert.equal(out.data[i + 3], img.data[i + 3]);
    assert.equal(out.data[i], 255 - img.data[i]);
  }
  // alpha-shaping effects never paint over tint masks
  const outlined = applyEffects(img, [layer('outline', { mode: 'outside' })], ctx);
  assert.deepEqual(outlined.data, img.data);
  const glowing = applyEffects(img, [layer('glow', { strength: 100, threshold: 0, halo: true })], ctx);
  for (let i = 3; i < img.data.length; i += 4) assert.equal(glowing.data[i], img.data[i]);
});

test('colour effects produce the expected colours', () => {
  const px = (r: number, g: number, b: number) => makeImg(1, 1, () => [r, g, b, 255]);
  const ctx = BLOCK_CTX;
  const run = (type: string, params: Record<string, number | boolean | string>, img: Img) => [...applyEffects(img, [layer(type, params)], ctx).data];
  assert.deepEqual(run('invert', {}, px(10, 20, 30)), [245, 235, 225, 255]);
  assert.deepEqual(run('grayscale', {}, px(255, 0, 0)), [76, 76, 76, 255]);
  const hue = run('hue', { degrees: 120 }, px(255, 0, 0));
  assert.deepEqual(hue, [0, 255, 0, 255]);
  // selective hue: greens move, reds stay
  assert.deepEqual(run('hue', { degrees: 120, range: 'greens' }, px(255, 0, 0)), [255, 0, 0, 255]);
  assert.deepEqual(run('hue', { degrees: -120, range: 'greens' }, px(0, 255, 0)), [255, 0, 0, 255]);
  const post = run('posterize', { levels: 2 }, px(100, 200, 30));
  assert.deepEqual(post, [0, 255, 0, 255]);
  const dark = run('brightness', { amount: -50 }, px(200, 100, 50));
  assert.deepEqual(dark, [100, 50, 25, 255]);
  const warm = run('temperature', { amount: 100 }, px(128, 128, 128));
  assert.ok(warm[0] > warm[2], 'warm makes red > blue');
  const gb = run('palette', { palette: 'gameboy', match: 'brightness' }, px(255, 255, 255));
  assert.deepEqual(gb, [0x9b, 0xbc, 0x0f, 255]);
});

test('spatial effects run per animation frame', () => {
  // 16x64 strip: 4 frames, each a solid colour
  const colors = [[200, 0, 0], [0, 200, 0], [0, 0, 200], [200, 200, 0]];
  const strip = makeImg(16, 64, (_x, y) => [...colors[Math.floor(y / 16)], 255] as [number, number, number, number]);
  const ctx: EffectContext = { path: 'assets/minecraft/textures/block/water_still.png', category: 'block', animated: true };
  const blurred = applyEffects(strip, [layer('blur', { amount: 100, radius: 2 })], ctx);
  assert.deepEqual(blurred.data, strip.data, 'blur must not bleed between frames');
  const bordered = applyEffects(strip, [layer('outline', { mode: 'tile', color: '#ffffff' })], ctx);
  for (let f = 0; f < 4; f++) {
    const top = (f * 16 * 16 + 5) * 4; // row 0 of the frame
    const mid = ((f * 16 + 8) * 16 + 8) * 4;
    assert.deepEqual([...bordered.data.subarray(top, top + 3)], [255, 255, 255]);
    assert.deepEqual([...bordered.data.subarray(mid, mid + 3)], colors[f]);
  }
  const up = applyEffects(strip, [layer('upscale', { factor: '2' })], ctx);
  assert.equal(up.width, 32);
  assert.equal(up.height, 128);
  // Noise grain is identical in every frame (no flicker)
  const gray = makeImg(16, 32, () => [128, 128, 128, 255]);
  const noisy = applyEffects(gray, [layer('noise', { amount: 50 })], { ...ctx, path: 'x/block/a.png' });
  assert.deepEqual(noisy.data.subarray(0, 16 * 16 * 4), noisy.data.subarray(16 * 16 * 4));
  assert.notDeepEqual(noisy.data, gray.data);
  // Explicit (non-square) frame sizes from .mcmeta
  const grid = makeImg(10, 4, (x, y) => [x < 5 ? 200 : 0, y < 2 ? 200 : 0, 50, 255]);
  const flipped = applyEffects(grid, [layer('flip', { horizontal: false, vertical: true })], { path: 'x/gui/a.png', category: 'gui', animated: true, frameWidth: 5, frameHeight: 2 });
  assert.deepEqual(flipped.data, grid.data, 'vertical flip of uniform-row 5x2 frames keeps them identical');
});

test('Scale2x smooths diagonal edges and keeps colours from the palette', () => {
  const img = makeImg(2, 2, (x, y) => (x === y ? [255, 255, 255, 255] : [0, 0, 0, 255]));
  const out = applyEffects(img, [layer('upscale', { factor: '2', algorithm: 'scale2x' })], PNG_CTX);
  assert.equal(out.width, 4);
  const colors = new Set<string>();
  for (let i = 0; i < out.data.length; i += 4) colors.add(out.data.subarray(i, i + 4).join(','));
  assert.ok([...colors].every((c) => c === '255,255,255,255' || c === '0,0,0,255'));
  const nearest = applyEffects(img, [layer('upscale', { factor: '4', algorithm: 'nearest' })], PNG_CTX);
  assert.equal(nearest.width, 8);
  assert.deepEqual([...nearest.data.subarray(0, 4)], [255, 255, 255, 255]);
});

test('outline modes', () => {
  const item = itemTexture();
  const out = applyEffects(item, [layer('outline', { mode: 'outside', color: '#ff0000', thickness: 1 })], PNG_CTX);
  let added = 0;
  for (let i = 0; i < item.data.length; i += 4) {
    if (item.data[i + 3] === 0 && out.data[i + 3] > 0) {
      added++;
      assert.deepEqual([...out.data.subarray(i, i + 4)], [255, 0, 0, 255]);
    }
  }
  assert.ok(added > 10);
  // auto on an opaque block = border around the tile
  const block = blockTexture();
  const bordered = applyEffects(block, [layer('outline', { mode: 'auto', color: '#000000' })], BLOCK_CTX);
  assert.deepEqual([...bordered.data.subarray(0, 4)], [0, 0, 0, 255]);
  const c = (8 * 16 + 8) * 4;
  assert.deepEqual([...bordered.data.subarray(c, c + 4)], [...block.data.subarray(c, c + 4)]);
});

test('layer filtering: categories, disabled layers, fonts, colour maps and technical textures', () => {
  const img = blockTexture(4, 4);
  const inv = layer('invert');
  assert.equal(applyEffects(img, [], BLOCK_CTX), img);
  assert.equal(applyEffects(img, [{ ...inv, enabled: false }], BLOCK_CTX), img);
  assert.equal(applyEffects(img, [{ ...inv, categories: ['item'] }], BLOCK_CTX), img);
  assert.notEqual(applyEffects(img, [{ ...inv, categories: ['block'] }], BLOCK_CTX), img);
  assert.equal(applyEffects(img, [{ ...inv, type: 'no-such-effect' }], BLOCK_CTX), img);
  const font: EffectContext = { path: 'assets/minecraft/textures/font/ascii.png', category: 'font' };
  assert.equal(layerApplies(inv, font), false);
  assert.equal(layerApplies({ ...inv, categories: ['font'] }, font), true);
  const cmap: EffectContext = { path: 'assets/minecraft/textures/colormap/grass.png', category: 'colormap' };
  assert.equal(layerApplies(layer('hue'), cmap), true);
  assert.equal(layerApplies(layer('blur'), cmap), false);
  assert.equal(layerApplies(layer('upscale'), { path: 'assets/minecraft/textures/palettes/trim/gold.png', category: 'armor' }), false);
  assert.equal(layerApplies(inv, { path: 'assets/minecraft/textures/misc/vignette.png', category: 'misc' }), false);
  assert.equal(layerApplies(inv, { path: 'textures/misc/shadow.png', category: 'misc' }), false);
  assert.equal(effectsApply([inv], BLOCK_CTX), true);
});

test('resolveParams fills defaults and clamps values', () => {
  const def = getEffect('brightness')!;
  assert.deepEqual(resolveParams(def, {}), { amount: 15 });
  assert.deepEqual(resolveParams(def, { amount: 500 }), { amount: 100 });
  assert.deepEqual(resolveParams(def, { amount: 'abc' }), { amount: 15 });
  const tint = getEffect('tint')!;
  const p = resolveParams(tint, { mode: 'nope', color: 'red' });
  assert.equal(p.mode, 'tint');
  assert.equal(p.color, '#ff9a3c');
});

test('presets: at least 10, unique ids, every layer valid and in range', () => {
  assert.ok(EFFECT_PRESETS.length >= 10);
  const ids = new Set(EFFECT_PRESETS.map((p) => p.id));
  assert.equal(ids.size, EFFECT_PRESETS.length);
  for (const preset of EFFECT_PRESETS) {
    assert.ok(preset.label && preset.description, preset.id);
    assert.ok(preset.layers.length > 0, preset.id);
    for (const l of preset.layers) {
      const def = getEffect(l.type);
      assert.ok(def, `${preset.id}: unknown effect ${l.type}`);
      assert.equal(l.enabled, true);
      for (const [key, value] of Object.entries(l.params)) {
        const o = def!.params.find((x) => x.key === key);
        assert.ok(o, `${preset.id}: ${l.type}.${key} is not a parameter`);
        if (o!.type === 'range') {
          assert.equal(typeof value, 'number');
          assert.ok((value as number) >= o!.min! && (value as number) <= o!.max!, `${preset.id}: ${l.type}.${key}=${value} out of range`);
        }
        if (o!.type === 'select') assert.ok(o!.options!.some((x) => x.value === value), `${preset.id}: ${l.type}.${key}=${value}`);
        if (o!.type === 'toggle') assert.equal(typeof value, 'boolean');
        if (o!.type === 'color') assert.match(String(value), /^#[0-9a-f]{6}$/i);
      }
      assert.deepEqual(resolveParams(def!, l.params), l.params, `${preset.id}: ${l.type} params are not normalised`);
    }
    // every preset visibly changes a typical block texture
    const img = blockTexture();
    const out = applyEffects(img, preset.layers.map((x, i) => ({ ...x, id: String(i) })), BLOCK_CTX);
    assert.ok(out.width !== img.width || out.data.some((v, i) => v !== img.data[i]), `${preset.id} does nothing`);
  }
});

test('performance: 4000 16x16 textures through heavy presets in a few seconds', () => {
  const textures = Array.from({ length: 4000 }, (_, i) => (i % 3 === 0 ? itemTexture() : blockTexture()));
  for (const id of ['neon-outline', 'cartoon', 'smooth-hd', 'retro-8bit', 'noir']) {
    const preset = EFFECT_PRESETS.find((p) => p.id === id)!;
    const layers = preset.layers.map((x, i) => ({ ...x, id: String(i) }));
    const t0 = performance.now();
    for (let i = 0; i < textures.length; i++) {
      applyEffects(textures[i], layers, i % 3 === 0 ? PNG_CTX : BLOCK_CTX);
    }
    const ms = performance.now() - t0;
    assert.ok(ms < 6000, `${id} took ${ms.toFixed(0)} ms`);
  }
});
