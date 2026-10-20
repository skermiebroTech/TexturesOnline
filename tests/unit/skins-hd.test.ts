// HD 128x128 skins: size detection, the x2 layout, up/down scaling, editor helpers at scale 2 and
// exports (Java reduced to 64x64, Bedrock kept at 128x128, packs mixing both sizes).
// Run: npx tsx --test tests/unit/skins-hd.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { createImageData, decodePngBytes, encodePng } from '../../src/core/image';
import { downscaleSkin, hdDetail, resizeSkin, sizeLabel, skinSizeOf, upscaleSkin } from '../../src/tools/skins/hd';
import {
  convertArms,
  copyToMirror,
  countBaseHoles,
  countOuterPixels,
  detectSlim,
  faceRect,
  faceRects,
  fillPart,
  isHdSkin,
  maskForParts,
  mirrorFaceRect,
  mirrorMapFor,
  mirrorPixel,
  partAt,
  partBox,
  partOrigin,
  PARTS,
  scaleOf,
} from '../../src/tools/skins/templates';
import { mirrorFootprint, surfaceFootprint, texelPlace } from '../../src/tools/skins/surface';
import { createStarterSkin, STARTERS } from '../../src/tools/skins/starters';
import {
  exportBedrockPack,
  exportBedrockPng,
  exportJavaLegacy,
  exportJavaPng,
  hdLossPercent,
  javaImage,
  legacyLosses,
  legacySource,
  pngSize,
  type SkinProjectData,
} from '../../src/tools/skins/export';
import { normalizeSkinImage, HD_KEPT_NOTE, SkinSourceError } from '../../src/tools/skins/ui/sources';
import { normalizeTotemSkin } from '../../src/tools/totem/totem';

const px = (img: ImageData, x: number, y: number) => Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));

/** A skin with a different colour in every pixel (deterministic noise, all opaque). */
function noisy(w: number, h: number, alpha = () => 255): ImageData {
  const img = createImageData(w, h);
  let seed = 7;
  for (let i = 0; i < w * h; i++) {
    seed = (seed * 16807) % 2147483647;
    img.data.set([seed & 255, (seed >> 8) & 255, (seed >> 16) & 255, alpha()], i * 4);
  }
  return img;
}

test('sizes: 64x64 and 128x128 are skins, HD is told apart by its width', () => {
  assert.equal(skinSizeOf({ width: 64, height: 64 }), 64);
  assert.equal(skinSizeOf({ width: 128, height: 128 }), 128);
  assert.equal(skinSizeOf({ width: 64, height: 32 }), null);
  assert.equal(skinSizeOf({ width: 256, height: 256 }), null);
  assert.equal(scaleOf(128), 2);
  assert.equal(scaleOf(64), 1);
  assert.ok(isHdSkin({ width: 128, height: 128 }));
  assert.ok(!isHdSkin({ width: 128, height: 64 }));
  assert.equal(sizeLabel(128), '128×128 HD');
  assert.equal(sizeLabel(64), '64×64');
});

test('the HD layout is the 64x64 layout scaled x2 (faces, boxes, origins, hit-testing)', () => {
  for (const model of ['classic', 'slim'] as const) {
    const a = faceRects(model, 1);
    const b = faceRects(model, 2);
    assert.equal(a.length, b.length);
    a.forEach((r, i) => assert.deepEqual(b[i], { ...r, x: r.x * 2, y: r.y * 2, w: r.w * 2, h: r.h * 2 }));
    for (const part of PARTS) {
      const box = partBox(part, model, 1);
      assert.deepEqual(partBox(part, model, 2), { w: box.w * 2, h: box.h * 2, d: box.d * 2 });
      assert.deepEqual(partOrigin(part, 'outer', model, 2), partOrigin(part, 'outer', model, 1)!.map((v) => v * 2));
    }
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const hd = partAt(x, y, model, 2);
        const sd = partAt(x >> 1, y >> 1, model, 1);
        assert.equal(hd?.part, sd?.part);
        assert.equal(hd?.face, sd?.face);
        assert.equal(hd?.layer, sd?.layer);
      }
    }
    assert.equal(partAt(128, 0, model, 2), null);
    // Head front: 8,8 8x8 -> 16,16 16x16.
    assert.deepEqual(faceRect('head', 'front', 'base', model, 2), { part: 'head', face: 'front', layer: 'base', x: 16, y: 16, w: 16, h: 16 });
  }
});

test('masks and the body mirror work per HD pixel', () => {
  const sd = maskForParts(['rightArm'], 'classic', 'base', 1);
  const hd = maskForParts(['rightArm'], 'classic', 'base', 2);
  assert.equal(hd.length, 128 * 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) assert.equal(hd[y * 128 + x], sd[(y >> 1) * 64 + (x >> 1)]);

  for (const model of ['classic', 'slim'] as const) {
    const map = mirrorMapFor(model, 2);
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const m1 = mirrorPixel(x >> 1, y >> 1, model, 1);
        const m2 = mirrorPixel(x, y, model, 2);
        if (!m1) {
          assert.equal(m2, null);
          continue;
        }
        // The texel mirrors, and inside it the column flips (rows never change).
        assert.deepEqual(m2, [m1[0] * 2 + (1 - (x & 1)), m1[1] * 2 + (y & 1)]);
        const back = mirrorPixel(m2![0], m2![1], model, 2);
        assert.deepEqual(back, [x, y]);
        const targets = map(x, y);
        if (m2![0] === x && m2![1] === y) assert.equal(targets.length, 0);
        else assert.deepEqual(targets, [m2]);
      }
    }
  }
  const r = faceRect('rightArm', 'front', 'base', 'classic', 2)!;
  assert.deepEqual(mirrorFaceRect(r, 'classic', 2), faceRect('leftArm', 'front', 'base', 'classic', 2));
});

test('upscale doubles every pixel and downscale gives the 64x64 skin back', () => {
  const sd = noisy(64, 64);
  const hd = upscaleSkin(sd);
  assert.equal(hd.width, 128);
  for (const [x, y] of [[0, 0], [9, 12], [63, 63], [44, 22]]) {
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) assert.deepEqual(px(hd, 2 * x + dx, 2 * y + dy), px(sd, x, y));
  }
  const back = downscaleSkin(hd);
  assert.deepEqual(Array.from(back.data), Array.from(sd.data));
  assert.deepEqual(hdDetail(hd), { changed: 0, visible: 64 * 64 });
  assert.deepEqual(resizeSkin(sd, 64).data, sd.data);
  assert.equal(resizeSkin(sd, 128).width, 128);
  assert.throws(() => upscaleSkin(createImageData(64, 32)));
  assert.throws(() => downscaleSkin(createImageData(100, 100)));
});

test('downscale: majority colour, average of mixed blocks, mostly see-through blocks vanish', () => {
  const hd = createImageData(128, 128);
  const set = (x: number, y: number, c: number[]) => hd.data.set(c, (y * 128 + x) * 4);
  const R = [200, 0, 0, 255];
  const B = [0, 0, 200, 255];
  // Block (0,0): three red, one blue -> red
  set(0, 0, R); set(1, 0, R); set(0, 1, R); set(1, 1, B);
  // Block (1,0): two red, two blue -> average
  set(2, 0, R); set(3, 0, B); set(2, 1, R); set(3, 1, B);
  // Block (2,0): one red pixel, three see-through -> see-through
  set(4, 0, R);
  // Block (3,0): two red, two see-through -> red (thin lines survive)
  set(6, 0, R); set(7, 1, R);
  // Block (4,0): half-transparent pixels keep their alpha
  for (const [x, y] of [[8, 0], [9, 0], [8, 1], [9, 1]]) set(x, y, [10, 20, 30, 128]);
  const sd = downscaleSkin(hd);
  assert.deepEqual(px(sd, 0, 0), R);
  assert.deepEqual(px(sd, 1, 0), [100, 0, 100, 255]);
  assert.equal(px(sd, 2, 0)[3], 0);
  assert.deepEqual(px(sd, 3, 0), R);
  assert.deepEqual(px(sd, 4, 0), [10, 20, 30, 128]);
  const d = hdDetail(hd);
  assert.equal(d.visible, 5);
  assert.equal(d.changed, 4);
});

test('editor helpers at HD: slim detection, arm conversion, mirror copy, fills, counts', () => {
  for (const s of STARTERS) {
    for (const model of ['classic', 'slim'] as const) {
      const sd = createStarterSkin(s.id, model);
      const hd = upscaleSkin(sd);
      assert.equal(detectSlim(hd), detectSlim(sd), `${s.id} ${model}`);
      assert.equal(countBaseHoles(hd, model), countBaseHoles(sd, model) * 4);
      assert.equal(countOuterPixels(hd, model), countOuterPixels(sd, model) * 4);
    }
  }
  const sd = noisy(64, 64);
  const hd = upscaleSkin(sd);
  for (const [from, to] of [['classic', 'slim'], ['slim', 'classic']] as const) {
    assert.deepEqual(Array.from(convertArms(hd, from, to).data), Array.from(upscaleSkin(convertArms(sd, from, to)).data), `${from} -> ${to}`);
  }
  assert.deepEqual(Array.from(copyToMirror(hd, 'rightArm', 'classic').data), Array.from(upscaleSkin(copyToMirror(sd, 'rightArm', 'classic')).data));
  const filled = fillPart(hd, 'head', 'outer', 'classic', [1, 2, 3, 255]);
  assert.deepEqual(px(filled, 2 * 40 + 1, 2 * 8 + 1), [1, 2, 3, 255]);
  assert.deepEqual(px(filled, 2 * 8, 2 * 8), px(hd, 16, 16));
});

test('painting on the model at HD: footprints and mirrors use 128-wide pixel indices', () => {
  // Head front centre, a 1 px brush: one HD pixel.
  const one = surfaceFootprint(24.5, 24.5, 1, 'square', 'classic', 2);
  assert.deepEqual(one, [24 * 128 + 24]);
  // A 2 px brush covers a 2x2 block, as the pencil does on the template.
  const two = surfaceFootprint(24.5, 24.5, 2, 'square', 'classic', 2).sort((a, b) => a - b);
  assert.equal(two.length, 4);
  for (const p of two) assert.ok(partAt(p % 128, Math.floor(p / 128), 'classic', 2)?.face === 'front');
  // A big brush at the head's top edge folds onto the top face.
  const edge = surfaceFootprint(24.5, 16.5, 8, 'square', 'classic', 2);
  assert.ok(edge.some((p) => partAt(p % 128, Math.floor(p / 128), 'classic', 2)?.face === 'top'));
  // Mirror of the right arm front lands on the left arm front.
  const arm = surfaceFootprint(2 * 44 + 0.5, 2 * 22 + 0.5, 1, 'square', 'classic', 2);
  const m = mirrorFootprint(arm, 'classic', 2);
  assert.equal(m.length, 1);
  assert.equal(partAt(m[0] % 128, Math.floor(m[0] / 128), 'classic', 2)?.part, 'leftArm');
  const place = texelPlace(2 * 9, 2 * 12, 'classic', 2)!;
  assert.deepEqual(place.box, { w: 16, h: 16, d: 16 });
  assert.deepEqual(place.center, [2.5, 7.5, 16]);
});

test('starters and uploads: HD skins are kept, 64x32 still converted, other sizes refused', () => {
  const hd = upscaleSkin(createStarterSkin('template', 'slim'));
  const loaded = normalizeSkinImage(hd);
  assert.equal(loaded.image.width, 128);
  assert.equal(loaded.model, 'slim');
  assert.ok(loaded.notes.includes(HD_KEPT_NOTE));
  assert.equal(normalizeSkinImage(createImageData(64, 32)).image.height, 64);
  assert.throws(() => normalizeSkinImage(createImageData(256, 256)), (e: unknown) => e instanceof SkinSourceError && /4× enlarged/.test(e.message));
  assert.throws(() => normalizeSkinImage(createImageData(100, 50)), SkinSourceError);
});

test('Java export reduces HD skins to 64x64 with a note; the HD file is only made on request', () => {
  const sd = createStarterSkin('template', 'classic');
  const hd = upscaleSkin(sd);
  // Add finer detail: one HD pixel in the face.
  hd.data.set([255, 0, 0, 255], (20 * 128 + 20) * 4);
  assert.ok(hdLossPercent(hd) > 0);
  const java = exportJavaPng(hd, 'Hero', 'classic');
  assert.equal(java.filename, 'Hero.png');
  assert.ok(java.notes.some((n) => /only shows 64×64 skins without mods/.test(n)), java.notes.join('|'));
  assert.equal(java.meta, '64×64, reduced from HD');
  const keep = exportJavaPng(hd, 'Hero', 'classic', { keepHd: true });
  assert.equal(keep.filename, 'Hero-hd.png');
  assert.ok(keep.notes.some((n) => /HD skin mod/.test(n)));
  // A plain 64x64 skin is written as before.
  const plain = exportJavaPng(sd, 'Hero', 'classic');
  assert.equal(plain.meta, undefined);
  assert.equal(plain.notes.length, 0);
  // javaImage: what Java reads
  assert.equal(javaImage(hd).width, 64);
  assert.equal(javaImage(sd), sd);
});

test('Java export files have the right sizes', async () => {
  const hd = upscaleSkin(createStarterSkin('template', 'slim'));
  const java = decodePngBytes(new Uint8Array(await exportJavaPng(hd, 'A', 'slim').blob.arrayBuffer()));
  assert.deepEqual([java.width, java.height], [64, 64]);
  const keep = decodePngBytes(new Uint8Array(await exportJavaPng(hd, 'A', 'slim', { keepHd: true }).blob.arrayBuffer()));
  assert.deepEqual([keep.width, keep.height], [128, 128]);
  // Legacy 64x32 comes from the reduced skin.
  const legacy = exportJavaLegacy(hd, 'A', 'slim');
  const leg = decodePngBytes(new Uint8Array(await legacy.blob.arrayBuffer()));
  assert.deepEqual([leg.width, leg.height], [64, 32]);
  assert.deepEqual(legacyLosses(hd, 'slim'), legacyLosses(downscaleSkin(hd), 'slim'));
  assert.equal(legacySource(hd, 'slim').width, 64);
});

test('Bedrock PNG keeps HD skins at 128x128', async () => {
  const hd = upscaleSkin(createStarterSkin('template', 'classic'));
  hd.data[(40 * 128 + 80) * 4 + 3] = 20; // faint pixel on the hat
  const res = exportBedrockPng(hd, 'Hero');
  const img = decodePngBytes(new Uint8Array(await res.blob.arrayBuffer()));
  assert.deepEqual([img.width, img.height], [128, 128]);
  assert.equal(res.meta, '128×128 HD');
  assert.ok(res.notes.some((n) => /nearly invisible/.test(n)));
  assert.equal(exportBedrockPng(createStarterSkin('template', 'classic'), 'Hero').meta, undefined);
});

test('skin packs mix 64x64 and HD skins, each keeping its size', async () => {
  const hd = upscaleSkin(createStarterSkin('robot', 'classic'));
  const sd = createStarterSkin('template', 'slim');
  const project: SkinProjectData = { id: 'p', kind: 'skin', name: 'HD Hero', model: 'classic', image: new Blob([encodePng(hd)]), createdAt: 1, updatedAt: 1 };
  const extras = [{ id: 'q', name: 'Small Pal', model: 'slim' as const, image: new Blob([encodePng(sd)], { type: 'image/png' }) }];
  const res = await exportBedrockPack(project, hd, extras);
  const files = unzipSync(new Uint8Array(await res.blob.arrayBuffer()));
  const skins = JSON.parse(strFromU8(files['skins.json'])) as { skins: { texture: string; geometry: string }[] };
  assert.equal(skins.skins.length, 2);
  const sizes = skins.skins.map((s) => {
    const img = decodePngBytes(files[s.texture]);
    return [img.width, img.height];
  });
  assert.deepEqual(sizes, [[128, 128], [64, 64]]);
  // Same stock geometry for every size: the HD texture maps onto the same (normalised) UVs.
  assert.deepEqual(skins.skins.map((s) => s.geometry), ['geometry.humanoid.custom', 'geometry.humanoid.customSlim']);
  assert.equal(res.hdCount, 1);
  assert.match(res.meta ?? '', /2 skins · 1 HD/);
  const solo = await exportBedrockPack({ ...project, id: 'r' }, hd);
  assert.match(solo.meta ?? '', /1 skin · 128×128 HD/);
  assert.deepEqual(pngSize(encodePng(hd)), { width: 128, height: 128 });
  assert.deepEqual(pngSize(new Uint8Array([1, 2, 3])), { width: 0, height: 0 });
});

test('totems read HD skins at 64x64 with the same reduction', () => {
  const sd = noisy(64, 64);
  const hd = upscaleSkin(sd);
  assert.deepEqual(Array.from(normalizeTotemSkin(hd).data), Array.from(sd.data));
});
