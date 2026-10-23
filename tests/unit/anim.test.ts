// Animated textures (src/tools/textures/anim): the GIF decoder against GIFs Pillow wrote (partial
// frames, disposal, transparency, interlacing) and encode / decode round trips; frame timing (ticks,
// seconds, GIF delays, the play order as frames are added, removed and moved, typed orders, Bedrock's
// repeated frames); the .mcmeta written for each Java version and read back; Bedrock flipbook entries
// tied to terrain tiles and merged with the game's list; the export of both editions, opening the
// exported packs again, project files, and the example files of the guide.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { TextureAnimation, TexturePackProject } from '../../src/core/types';
import { createImageData, decodePngBytes, encodePng } from '../../src/core/image';
import { decodeGif, encodeGif, GifError, isGif } from '../../src/tools/textures/anim/gif';
import {
  clampTicks,
  flipbookTiming,
  formatOrder,
  frameTime,
  gifDelayToTicks,
  insertFrames,
  isPlainOrder,
  loopTicks,
  moveFrame,
  movedIndex,
  normalizeFrames,
  parseOrder,
  playSteps,
  removeFrame,
  ticksToGifDelay,
  ticksToSeconds,
  timingFromFlipbook,
  withFrameTime,
} from '../../src/tools/textures/anim/timing';
import {
  animationFromFlipbook,
  animationFromMcmeta,
  animationMcmeta,
  flipbookEntry,
  flipbookJson,
  javaAnimLosses,
  javaAnimRules,
  lowestJavaVersion,
  mergeFlipbooks,
  parseFlipbooks,
  terrainTilesOf,
} from '../../src/tools/textures/anim/pack';
import { blendFrames, joinFrames, sliceSheet, splitFrames } from '../../src/tools/textures/anim/frames';
import { exportTexturePack } from '../../src/tools/textures/export';
import { importPack } from '../../src/tools/textures/import';
import { newTextureProject } from '../../src/tools/textures/project';
import { readProjectArchive, writeProjectArchive } from '../../src/shared/project-file/format';
import { ANIM_FLIPBOOK, ANIM_MCMETA, ANIM_MCMETA_WIDE } from '../../src/tools/guides/anim-files';
import { bedrockSpec, fakeAssets, img, javaSpec, json, solid, text, unzipBlob } from '../tools/texlogic/fixtures';

const J = 'assets/minecraft/textures/';
const FIX = path.join(import.meta.dirname, '../tools/anim');
const anim = (a: Partial<TextureAnimation> = {}): TextureAnimation => ({ frameWidth: 16, frameHeight: 16, frametime: 1, updatedAt: 0, ...a });

/** A strip of `n` 16 x 16 frames, frame k a flat colour. */
const strip = (n: number, w = 16, h = 16) => joinFrames(Array.from({ length: n }, (_, k) => solid(w, h, [k * 40, 255 - k * 30, 60, 255])));
const pngBlob = (im: ImageData) => new Blob([encodePng(im)], { type: 'image/png' });

// ---------------------------------------------------------------------------------------------
// GIF

test('GIF: decodes what Pillow wrote, frame by frame as browsers show it', () => {
  for (const [name, delays] of [['small', [10, 5, 20, 7]], ['big', [4, 4, 4]]] as const) {
    const gif = decodeGif(new Uint8Array(fs.readFileSync(path.join(FIX, `anim-${name}.gif`))));
    const want = decodePngBytes(new Uint8Array(fs.readFileSync(path.join(FIX, `anim-${name}-frames.png`))));
    assert.equal(gif.frames.length, want.height / gif.height, name);
    gif.frames.forEach((f, i) => {
      const exp = want.data.subarray(i * gif.width * gif.height * 4, (i + 1) * gif.width * gif.height * 4);
      // see-through pixels only need to be see-through
      for (let k = 0; k < f.data.length; k += 4) {
        if (exp[k + 3] === 0) assert.equal(f.data[k + 3], 0, `${name} frame ${i} pixel ${k / 4} alpha`);
        else assert.deepEqual([...f.data.subarray(k, k + 4)], [...exp.subarray(k, k + 4)], `${name} frame ${i} pixel ${k / 4}`);
      }
      assert.equal(f.delay, delays[i], `${name} delay ${i}`);
    });
  }
});

test('GIF: encode and decode give the same frames, delays and see-through pixels', () => {
  const frames = [0, 1, 2].map((k) => ({
    data: img(12, 9, (x, y) => ((x + y + k) % 4 === 0 ? [0, 0, 0, 0] : [x * 20, y * 25, k * 100, 255])).data,
    delay: [5, 10, 35][k],
  }));
  const bytes = encodeGif(12, 9, frames);
  assert.ok(isGif(bytes));
  const back = decodeGif(bytes);
  assert.equal(back.width, 12);
  assert.equal(back.height, 9);
  assert.deepEqual(back.frames.map((f) => f.delay), [5, 10, 35]);
  back.frames.forEach((f, i) => assert.deepEqual([...f.data], [...frames[i].data], `frame ${i}`));
  // a lone colour, and a big frame that needs the code table cleared (LZW past 4096 codes)
  const one = decodeGif(encodeGif(3, 2, [{ data: solid(3, 2, [9, 8, 7, 255]).data, delay: 0 }]));
  assert.deepEqual([...one.frames[0].data.subarray(0, 4)], [9, 8, 7, 255]);
  const noise = img(200, 150, (x, y) => [(x * 7 + y * 13) % 251, (x * x + y) % 256, (y * 3) % 256, 255]);
  const many = decodeGif(encodeGif(200, 150, [{ data: noise.data, delay: 3 }]));
  // more than 256 colours: quantized, each pixel close to the original
  let worst = 0;
  for (let k = 0; k < noise.data.length; k += 4) for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(many.frames[0].data[k + c] - noise.data[k + c]));
  assert.ok(worst < 96, `worst channel error ${worst}`);
  // up to 256 exact colours stay exact
  const pal = img(16, 16, (x, y) => [x * 16, y * 16, 128, 255]);
  assert.deepEqual([...decodeGif(encodeGif(16, 16, [{ data: pal.data, delay: 2 }])).frames[0].data], [...pal.data]);
});

test('GIF: not a GIF, damaged and too big', () => {
  assert.throws(() => decodeGif(encodePng(solid(2, 2, [1, 2, 3, 255]))), (e: unknown) => e instanceof GifError && e.code === 'not-gif');
  const good = encodeGif(4, 4, [{ data: solid(4, 4, [1, 2, 3, 255]).data, delay: 1 }]);
  assert.throws(() => decodeGif(good.subarray(0, 20)), (e: unknown) => e instanceof GifError && e.code === 'damaged');
  const huge = good.slice();
  huge[6] = 0xff;
  huge[7] = 0xff;
  assert.throws(() => decodeGif(huge), (e: unknown) => e instanceof GifError && e.code === 'too-big');
});

// ---------------------------------------------------------------------------------------------
// Timing

test('ticks, seconds and GIF delays', () => {
  assert.equal(ticksToSeconds(20), 1);
  assert.equal(ticksToSeconds(5), 0.25);
  assert.equal(ticksToGifDelay(2), 10);
  assert.equal(gifDelayToTicks(10), 2);
  assert.equal(gifDelayToTicks(7), 1);
  assert.equal(gifDelayToTicks(8), 2);
  assert.equal(gifDelayToTicks(100), 20);
  // 0 and 1 play as 10 in browsers
  assert.equal(gifDelayToTicks(0), 2);
  assert.equal(gifDelayToTicks(1), 2);
  assert.equal(clampTicks(0), 1);
  assert.equal(clampTicks(2.6), 3);
  assert.equal(clampTicks(1e9), 12000);
  for (const t of [1, 2, 3, 7, 40]) assert.equal(gifDelayToTicks(ticksToGifDelay(t)), t);
});

test('play order: plain lists, per-frame times, normalizing', () => {
  assert.deepEqual(playSteps({ frametime: 2 }, 3), [{ index: 0, time: 2 }, { index: 1, time: 2 }, { index: 2, time: 2 }]);
  assert.deepEqual(playSteps({ frametime: 2, frames: [{ index: 2 }, { index: 9 }, { index: 0, time: 5 }] }, 3), [{ index: 2, time: 2 }, { index: 0, time: 5 }]);
  assert.equal(loopTicks({ frametime: 2, frames: [{ index: 1, time: 10 }] }, 2), 10);
  assert.ok(isPlainOrder(undefined, 4));
  assert.ok(isPlainOrder([{ index: 0, time: 3 }, { index: 1 }], 2));
  assert.ok(!isPlainOrder([{ index: 1 }, { index: 0 }], 2));
  assert.equal(normalizeFrames([{ index: 0, time: 2 }, { index: 1 }], 2, 2), undefined);
  assert.deepEqual(normalizeFrames([{ index: 0, time: 4 }, { index: 1, time: 2 }], 2, 2), [{ index: 0, time: 4 }, { index: 1 }]);
  const a = { frametime: 2 };
  const f = withFrameTime(a, 3, 1, 10);
  assert.deepEqual(f, [{ index: 0 }, { index: 1, time: 10 }, { index: 2 }]);
  assert.equal(frameTime({ ...a, frames: f }, 1), 10);
  assert.equal(frameTime({ ...a, frames: f }, 2), 2);
  assert.equal(withFrameTime({ ...a, frames: f }, 3, 1, 2), undefined);
});

test('play order follows frames as they are added, removed and moved', () => {
  const timed = { frametime: 2, frames: [{ index: 0 }, { index: 1, time: 10 }, { index: 2 }] };
  // plain: steps follow the frames, the new one gets its time
  assert.deepEqual(insertFrames(timed, 3, 1, 1, [7]), [{ index: 0 }, { index: 1, time: 7 }, { index: 2, time: 10 }, { index: 3 }]);
  assert.equal(insertFrames({ frametime: 2 }, 3, 3, 2), undefined);
  assert.deepEqual(removeFrame(timed, 3, 1), undefined);
  assert.deepEqual(removeFrame(timed, 3, 0), [{ index: 0, time: 10 }, { index: 1 }]);
  assert.deepEqual(moveFrame(timed, 3, 1, 2), [{ index: 0 }, { index: 1 }, { index: 2, time: 10 }]);
  assert.deepEqual([0, 1, 2, 3].map((i) => movedIndex(i, 0, 2)), [2, 0, 1, 3]);
  assert.deepEqual([0, 1, 2, 3].map((i) => movedIndex(i, 3, 1)), [0, 2, 3, 1]);
  // a list of its own (water: 0 1 2 3 3 2): new frames play after the frame before them, deleted ones go
  const own = { frametime: 2, frames: [0, 1, 2, 3, 3, 2].map((index) => ({ index })) };
  assert.deepEqual(insertFrames(own, 4, 2, 1)!.map((s) => s.index), [0, 1, 2, 3, 4, 4, 3]);
  assert.deepEqual(insertFrames(own, 4, 0, 1)!.map((s) => s.index), [0, 1, 2, 3, 4, 4, 3]);
  assert.deepEqual(insertFrames(own, 4, 4, 1)!.map((s) => s.index), [0, 1, 2, 3, 3, 4, 2]);
  assert.deepEqual(removeFrame(own, 4, 2)!.map((s) => s.index), [0, 1, 2, 2]);
  assert.deepEqual(moveFrame(own, 4, 0, 3), own.frames);
});

test('typed play order', () => {
  assert.deepEqual(parseOrder('1, 2 3:40,2', 4), [{ index: 0 }, { index: 1 }, { index: 2, time: 40 }, { index: 1 }]);
  assert.deepEqual(parseOrder('1-3, 3-1', 3).valueOf(), [0, 1, 2, 2, 1, 0].map((index) => ({ index })));
  assert.deepEqual(parseOrder('2-3:5', 3), [{ index: 1, time: 5 }, { index: 2, time: 5 }]);
  assert.deepEqual(parseOrder('', 3), []);
  assert.deepEqual(parseOrder('1, 5', 3), { error: 'range', token: '5' });
  assert.deepEqual(parseOrder('1, x', 3), { error: 'syntax', token: 'x' });
  assert.equal(formatOrder([{ index: 0 }, { index: 2, time: 40 }, { index: 1 }], 2, 3), '1, 3:40, 2');
  assert.equal(formatOrder([{ index: 0 }, { index: 1 }], 2, 2), '');
  const back = parseOrder(formatOrder([{ index: 1, time: 3 }, { index: 0 }], 2, 2), 2);
  assert.deepEqual(back, [{ index: 1, time: 3 }, { index: 0 }]);
});

test('Bedrock timing: one speed, longer frames repeated, and back', () => {
  assert.deepEqual(flipbookTiming({ frametime: 3 }, 4), { ticks: 3 });
  assert.deepEqual(flipbookTiming({ frametime: 2, frames: [{ index: 0 }, { index: 1, time: 6 }] }, 2), { ticks: 2, frames: [0, 1, 1, 1] });
  assert.deepEqual(flipbookTiming({ frametime: 2, frames: [{ index: 1 }, { index: 0 }] }, 2), { ticks: 2, frames: [1, 0] });
  assert.deepEqual(flipbookTiming({ frametime: 4, frames: [{ index: 0, time: 6 }, { index: 1 }] }, 2), { ticks: 2, frames: [0, 0, 0, 1, 1] });
  assert.deepEqual(timingFromFlipbook(2, [0, 1, 1, 1], 2), { frametime: 2, frames: [{ index: 0 }, { index: 1, time: 6 }] });
  assert.deepEqual(timingFromFlipbook(undefined, undefined, 3), { frametime: 1 });
  assert.deepEqual(timingFromFlipbook(1, [16, 17, 0, 1], 32).frames!.map((s) => s.index), [16, 17, 0, 1]);
  // every step's time survives the trip
  const a = { frametime: 3, frames: [{ index: 0, time: 9 }, { index: 2 }, { index: 1, time: 12 }] };
  const fb = flipbookTiming(a, 3);
  assert.deepEqual(playSteps(timingFromFlipbook(fb.ticks, fb.frames, 3), 3), playSteps(a, 3));
  // a 10-minute frame at a 1-tick step: the list is capped (time rounded to a coarser step)
  const long = flipbookTiming({ frametime: 1, frames: [{ index: 0, time: 12000 }, { index: 1 }] }, 2);
  assert.ok(long.frames!.length <= 4096 && long.ticks > 1);
});

// ---------------------------------------------------------------------------------------------
// Pixels

test('frames: split, join, blend like the game, sheets', () => {
  const s = strip(3);
  const fr = splitFrames(s, { frameW: 16, frameH: 16, cols: 1, count: 3 });
  assert.deepEqual([...fr[2].data.subarray(0, 4)], [80, 195, 60, 255]);
  assert.deepEqual([...joinFrames(fr).data], [...s.data]);
  const a = solid(1, 1, [0, 0, 0, 255]);
  const b = solid(1, 1, [200, 100, 50, 0]);
  assert.deepEqual([...blendFrames(a, b, 0.5, 'rgba').data], [100, 50, 25, 128]);
  // before 1.21.2 the first frame's alpha stays
  assert.deepEqual([...blendFrames(a, b, 0.5, 'rgb').data], [100, 50, 25, 255]);
  assert.equal(sliceSheet(solid(64, 16, [1, 1, 1, 255]), 16, 16).length, 4);
  assert.equal(sliceSheet(solid(32, 96, [1, 1, 1, 255]), 16, 16).length, 12, 'whole frames of the texture size, row by row');
  assert.equal(sliceSheet(solid(30, 90, [1, 1, 1, 255]), 16, 16).length, 3, 'squares of the short side');
  assert.equal(sliceSheet(solid(30, 40, [1, 1, 1, 255]), 16, 16).length, 1);
});

// ---------------------------------------------------------------------------------------------
// Java .mcmeta per version

test('Java versions: interpolate from 1.8, frame sizes from 1.13, full blending from 1.21.2', () => {
  assert.deepEqual(javaAnimRules('1.7.10'), { interpolate: false, layout: false, blend: 'rgb' });
  assert.deepEqual(javaAnimRules('1.8.9'), { interpolate: true, layout: false, blend: 'rgb' });
  assert.deepEqual(javaAnimRules('1.12.2'), { interpolate: true, layout: false, blend: 'rgb' });
  assert.deepEqual(javaAnimRules('1.13'), { interpolate: true, layout: true, blend: 'rgb' });
  assert.deepEqual(javaAnimRules('1.21.1'), { interpolate: true, layout: true, blend: 'rgb' });
  assert.deepEqual(javaAnimRules('1.21.2'), { interpolate: true, layout: true, blend: 'rgba' });
  assert.deepEqual(javaAnimRules('26.3'), { interpolate: true, layout: true, blend: 'rgba' });
  assert.equal(lowestJavaVersion({ version: '26.3', compat: { minVersion: '1.8.9', maxVersion: '26.3' } }), '1.8.9');
  assert.equal(lowestJavaVersion({ version: '1.20.1', compat: { minVersion: '26.1', maxVersion: '1.19.4' } }), '1.19.4');
});

test('Java .mcmeta: written for each version and read back', () => {
  const a = anim({ frametime: 4, interpolate: true, frames: [{ index: 0 }, { index: 1, time: 10 }, { index: 2 }] });
  const text = animationMcmeta(a, null, 16, 48, javaAnimRules('26.3'));
  assert.deepEqual(JSON.parse(text), { animation: { interpolate: true, frametime: 4, frames: [0, { index: 1, time: 10 }, 2] } });
  const back = animationFromMcmeta(text, 16, 48)!;
  assert.deepEqual({ ...back }, { frameWidth: 16, frameHeight: 16, frametime: 4, frames: [{ index: 0 }, { index: 1, time: 10 }, { index: 2 }], interpolate: true });
  // 1.7.10: no interpolate
  assert.deepEqual(JSON.parse(animationMcmeta(a, null, 16, 48, javaAnimRules('1.7.10'))).animation.interpolate, undefined);
  assert.deepEqual(javaAnimLosses(a, 16, javaAnimRules('1.7.10')), ['interpolate']);
  // frames that aren't squares: width and height from 1.13; older versions lose them
  const wide = anim({ frameWidth: 32, frameHeight: 8, frametime: 2 });
  assert.deepEqual(JSON.parse(animationMcmeta(wide, null, 32, 24, javaAnimRules('1.13'))), { animation: { width: 32, height: 8, frametime: 2 } });
  assert.deepEqual(JSON.parse(animationMcmeta(wide, null, 32, 24, javaAnimRules('1.12.2'))), { animation: { frametime: 2 } });
  assert.deepEqual(javaAnimLosses(wide, 32, javaAnimRules('1.12.2')), ['size']);
  assert.deepEqual(javaAnimLosses(wide, 32, javaAnimRules('1.13')), []);
  // the default frame time (1) and every frame in order need nothing
  assert.deepEqual(JSON.parse(animationMcmeta(anim(), null, 16, 32, javaAnimRules('26.3'))), { animation: {} });
  // the texture's other sections stay (a GUI sprite's scaling, blur): the pack's file replaces the game's
  const gui = animationMcmeta(anim({ frameWidth: 20, frameHeight: 4, frametime: 3 }), '{"gui":{"scaling":{"type":"stretch"}},"animation":{"frametime":9}}', 20, 12, javaAnimRules('26.3'));
  assert.deepEqual(JSON.parse(gui), { animation: { width: 20, height: 4, frametime: 3 }, gui: { scaling: { type: 'stretch' } } });
  // the game's own files read as it does: squares of the short side, frames past the end skipped
  assert.deepEqual(animationFromMcmeta('{"animation":{"frametime":2,"frames":[0,1,2,3,3,2,9]}}', 16, 64)!.frames!.map((s) => s.index), [0, 1, 2, 3, 3, 2]);
  assert.equal(animationFromMcmeta('{"animation":{"width":5,"height":2,"frametime":6}}', 5, 6)!.frameHeight, 2);
  assert.equal(animationFromMcmeta('{"animation":{"width":7}}', 16, 16), null);
  assert.equal(animationFromMcmeta('{"texture":{"blur":true}}', 16, 16), null);
  // an HD copy of a 16 x strip: sizes scaled
  assert.equal(animationFromMcmeta('{"animation":{"width":5,"height":2}}', 10, 12, 2)!.frameWidth, 10);
});

// ---------------------------------------------------------------------------------------------
// Bedrock flipbooks

const TERRAIN = {
  texture_data: {
    magma: { textures: 'textures/blocks/magma' },
    stone: { textures: 'textures/blocks/stone' },
    firefly_bush: { textures: ['textures/blocks/firefly_bush', 'textures/blocks/firefly_bush_firefly'] },
    dirt: { textures: [{ variations: [{ path: 'textures/blocks/dirt_va' }, { path: 'textures/blocks/dirt0' }] }] },
    grass_carried: { textures: { path: 'textures/blocks/grass_carried', overlay_color: '#79c05a' } },
  },
};

test('Bedrock: the terrain tiles that show a texture', () => {
  assert.deepEqual(terrainTilesOf(TERRAIN, 'textures/blocks/magma'), [{ tile: 'magma' }]);
  assert.deepEqual(terrainTilesOf(TERRAIN, 'textures/blocks/firefly_bush_firefly'), [{ tile: 'firefly_bush', index: 1 }]);
  assert.deepEqual(terrainTilesOf(TERRAIN, 'textures/blocks/dirt0'), [{ tile: 'dirt', index: 0, variant: 1 }]);
  assert.deepEqual(terrainTilesOf(TERRAIN, 'textures/blocks/grass_carried'), [{ tile: 'grass_carried' }]);
  assert.deepEqual(terrainTilesOf(TERRAIN, 'textures/items/apple'), []);
});

test('Bedrock: flipbook entries and the merged list', () => {
  const game = parseFlipbooks('// a comment\n[{"flipbook_texture":"textures/blocks/magma","atlas_tile":"magma","ticks_per_frame":10},{"flipbook_texture":"textures/blocks/lava_flow","atlas_tile":"flowing_lava","ticks_per_frame":10,"replicate":2}]');
  assert.equal(game.length, 2);
  const e = flipbookEntry(anim({ frametime: 4 }), 'textures/blocks/stone', { tile: 'stone' }, 3);
  assert.deepEqual(e, { flipbook_texture: 'textures/blocks/stone', atlas_tile: 'stone', ticks_per_frame: 4, blend_frames: false });
  const second = flipbookEntry(anim({ frametime: 2, interpolate: true }), 'textures/blocks/firefly_bush_firefly', { tile: 'firefly_bush', index: 1 }, 2);
  assert.deepEqual(second, { flipbook_texture: 'textures/blocks/firefly_bush_firefly', atlas_tile: 'firefly_bush', atlas_index: 1, ticks_per_frame: 2 });
  const own = [
    { stem: 'textures/blocks/magma', anim: anim({ frametime: 3, frames: [{ index: 0, time: 6 }, { index: 1 }] }), count: 2 },
    { stem: 'textures/blocks/stone', anim: anim({ frametime: 5 }), count: 4 },
    { stem: 'textures/items/apple', anim: anim({ frametime: 5 }), count: 2 },
  ];
  const pack = [{ flipbook_texture: 'textures/blocks/sea_lantern', atlas_tile: 'sea_lantern', ticks_per_frame: 5 }];
  const { entries, unplaced } = mergeFlipbooks(game, pack, own, TERRAIN);
  assert.deepEqual(unplaced, ['textures/items/apple']);
  assert.deepEqual(entries.map((x) => x.atlas_tile), ['magma', 'flowing_lava', 'sea_lantern', 'stone']);
  assert.deepEqual(entries[0], { flipbook_texture: 'textures/blocks/magma', atlas_tile: 'magma', ticks_per_frame: 3, frames: [0, 0, 1], blend_frames: false });
  assert.equal(entries[1].replicate, 2, 'the game’s other entries stay as they are');
  // read back, the editor's animation comes out again
  const back = animationFromFlipbook(entries[0], 16, 2);
  assert.deepEqual(playSteps(back, 2), playSteps(own[0].anim, 2));
  assert.equal(back.interpolate, undefined);
  // the game's entries blend unless they say not to; replicate is kept
  assert.equal(animationFromFlipbook(game[1], 16, 32).interpolate, true);
  assert.equal(animationFromFlipbook(game[1], 16, 32).replicate, 2);
});

// ---------------------------------------------------------------------------------------------
// Export, opening again, project files

function animatedJava(version: string, a: Partial<TextureAnimation> = {}): TexturePackProject {
  const p = newTextureProject({ name: 'Anim', edition: 'java', version });
  p.overrides[`${J}block/stone.png`] = pngBlob(strip(3));
  p.animations = { [`${J}block/stone.png`]: anim({ frametime: 4, interpolate: true, frames: [{ index: 0 }, { index: 1, time: 10 }, { index: 2 }], ...a }) };
  return p;
}

test('export Java 26.3: the strip and its .mcmeta; a GUI sprite keeps its scaling; opened again it plays the same', async () => {
  const assets = fakeAssets('java', '26.3', javaSpec());
  const p = animatedJava('26.3');
  const button = `${J}gui/sprites/widget/button.png`;
  p.overrides[button] = pngBlob(joinFrames([solid(20, 4, [1, 2, 3, 255]), solid(20, 4, [4, 5, 6, 255])]));
  p.animations![button] = anim({ frameWidth: 20, frameHeight: 4, frametime: 6 });
  const res = await exportTexturePack(p, assets);
  const zip = await unzipBlob(res.blob);
  assert.ok(zip[`${J}block/stone.png`]);
  assert.deepEqual(json(zip[`${J}block/stone.png.mcmeta`]), { animation: { interpolate: true, frametime: 4, frames: [0, { index: 1, time: 10 }, 2] } });
  assert.deepEqual(json(zip[`${button}.mcmeta`]), { animation: { width: 20, height: 4, frametime: 6 }, gui: { scaling: { type: 'nine_slice', width: 200, height: 20, border: 3 } } });
  assert.deepEqual(res.warnings.filter((w) => /animation/i.test(w)), []);
  const { project: q } = await importPack(new File([res.blob], 'anim.zip'));
  const meta = await q.extraFiles[`${J}block/stone.png.mcmeta`].text();
  const back = animationFromMcmeta(meta, 16, 48)!;
  assert.deepEqual(playSteps(back, 3), playSteps(p.animations![`${J}block/stone.png`], 3));
  assert.equal(back.interpolate, true);
});

test('export Java: the oldest version of the range decides, with warnings', async () => {
  const p = animatedJava('26.3');
  p.compat = { minVersion: '1.7.10', maxVersion: '26.3' };
  const res = await exportTexturePack(p, fakeAssets('java', '26.3', javaSpec()));
  const zip = await unzipBlob(res.blob);
  assert.equal(json(zip[`${J}block/stone.png.mcmeta`]).animation.interpolate, undefined);
  assert.ok(res.warnings.some((w) => /1 animation blends its frames, which Minecraft before 1\.8/.test(w)), res.warnings.join(' | '));
  const old = newTextureProject({ name: 'Old', edition: 'java', version: '1.12.2' });
  const path = 'assets/minecraft/textures/blocks/stone.png';
  old.overrides[path] = pngBlob(joinFrames([solid(16, 8, [9, 9, 9, 255]), solid(16, 8, [99, 9, 9, 255])]));
  old.animations = { [path]: anim({ frameWidth: 16, frameHeight: 8, frametime: 2 }) };
  const r2 = await exportTexturePack(old, fakeAssets('java', '1.12.2', { [path]: solid(16, 16, [5, 5, 5, 255]) }));
  assert.ok(r2.warnings.some((w) => /before 1\.13 can't play: stone\.png/.test(w)), r2.warnings.join(' | '));
});

test('export Java: a texture with one frame left writes no animation', async () => {
  const p = newTextureProject({ name: 'Still', edition: 'java', version: '26.3' });
  p.overrides[`${J}block/stone.png`] = pngBlob(solid(16, 16, [1, 1, 1, 255]));
  p.animations = { [`${J}block/stone.png`]: anim({ frametime: 3 }) };
  const zip = await unzipBlob((await exportTexturePack(p, fakeAssets('java', '26.3', javaSpec()))).blob);
  assert.equal(zip[`${J}block/stone.png.mcmeta`], undefined);
});

test('export Bedrock: flipbook entries merged with the game’s list and the pack’s own; items are left out', async () => {
  const spec = {
    ...bedrockSpec(),
    'textures/blocks/magma.png': strip(3),
    'textures/terrain_texture.json': JSON.stringify(TERRAIN),
    'textures/flipbook_textures.json': '[{"flipbook_texture":"textures/blocks/magma","atlas_tile":"magma","ticks_per_frame":10}]',
  };
  const assets = fakeAssets('bedrock', '1.26.50', spec, ['textures/blocks/magma.png']);
  const p = newTextureProject({ name: 'Flip', edition: 'bedrock', version: '1.26.50' });
  p.overrides['textures/blocks/stone.png'] = pngBlob(strip(4));
  p.overrides['textures/blocks/magma.png'] = pngBlob(strip(2));
  p.overrides['textures/items/apple.png'] = pngBlob(strip(2));
  p.extraFiles['textures/flipbook_textures.json'] = new Blob(['[{"flipbook_texture":"textures/blocks/sea_lantern","atlas_tile":"sea_lantern","ticks_per_frame":5}]']);
  p.animations = {
    'textures/blocks/stone.png': anim({ frametime: 2, frames: [{ index: 0, time: 4 }, { index: 1 }, { index: 2 }, { index: 3 }] }),
    'textures/blocks/magma.png': anim({ frametime: 6, interpolate: true }),
    'textures/items/apple.png': anim({ frametime: 2 }),
  };
  const res = await exportTexturePack(p, assets);
  const zip = await unzipBlob(res.blob);
  const list = json(zip['textures/flipbook_textures.json']);
  assert.deepEqual(list, [
    { flipbook_texture: 'textures/blocks/magma', atlas_tile: 'magma', ticks_per_frame: 6 },
    { flipbook_texture: 'textures/blocks/sea_lantern', atlas_tile: 'sea_lantern', ticks_per_frame: 5 },
    { flipbook_texture: 'textures/blocks/stone', atlas_tile: 'stone', ticks_per_frame: 2, frames: [0, 0, 1, 2, 3], blend_frames: false },
  ]);
  assert.ok(res.warnings.some((w) => /Bedrock only animates textures that blocks use: apple/.test(w)), res.warnings.join(' | '));
  assert.match(text(zip['textures/flipbook_textures.json'])!, /^\[\n/);
});

test('project files carry animations', async () => {
  const p = animatedJava('26.3');
  const blob = await writeProjectArchive('textures', [{ type: 'texturepack', id: p.id, name: p.name, updatedAt: p.updatedAt, data: { project: p } }]);
  const archive = await readProjectArchive(blob);
  const q = (archive.load(archive.manifest.items[0]).data as { project: TexturePackProject }).project;
  assert.deepEqual(q.animations, p.animations);
  assert.ok(q.overrides[`${J}block/stone.png`]);
  assert.ok(createImageData(1, 1));
});

test('the guide’s example files are what the export writes', () => {
  const rules = javaAnimRules('26.3');
  assert.equal(animationMcmeta(anim({ frametime: 4, interpolate: true, frames: [{ index: 0 }, { index: 1 }, { index: 2, time: 10 }, { index: 1 }] }), null, 16, 48, rules), ANIM_MCMETA);
  assert.equal(animationMcmeta(anim({ frameWidth: 32, frameHeight: 16, frametime: 2 }), null, 32, 64, rules), ANIM_MCMETA_WIDE);
  const glow = flipbookEntry(anim({ frametime: 4, frames: [{ index: 0 }, { index: 1, time: 8 }] }), 'textures/blocks/glowstone', { tile: 'glowstone' }, 2);
  assert.equal(flipbookJson([glow]), ANIM_FLIPBOOK);
});
