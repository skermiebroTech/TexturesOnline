// Skin layout, mirror mapping, arm conversion, starters and exports (pure logic).
// Run: npx tsx --test tests/unit/skins-templates.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { createImageData, decodePngBytes } from '../../src/core/image';
import {
  convertArms,
  copyToMirror,
  countBaseHoles,
  describeRect,
  detectSlim,
  faceRects,
  maskForParts,
  mirrorMapFor,
  mirrorPixel,
  partAt,
  PARTS,
  type SkinLayout,
} from '../../src/tools/skins/templates';
import { createStarterSkin, STARTERS } from '../../src/tools/skins/starters';
import { exportBedrockPack, exportJavaLegacy, exportJavaPng, legacyLosses, type SkinProjectData } from '../../src/tools/skins/export';

const LAYOUTS: SkinLayout[] = ['classic', 'slim', 'legacy'];

test('face rectangles stay inside the texture and never overlap', () => {
  for (const layout of LAYOUTS) {
    const H = layout === 'legacy' ? 32 : 64;
    const seen = new Uint8Array(64 * H);
    for (const r of faceRects(layout)) {
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 64 && r.y + r.h <= H, `${layout} ${describeRect(r)} out of bounds`);
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) {
          assert.equal(seen[y * 64 + x], 0, `${layout} overlap at ${x},${y}`);
          seen[y * 64 + x] = 1;
        }
      }
    }
  }
  assert.equal(faceRects('classic').length, 72);
  assert.equal(faceRects('slim').length, 72);
  assert.equal(faceRects('legacy').length, 30);
});

test('partAt names the standard regions', () => {
  const at = (x: number, y: number, l: SkinLayout = 'classic') => {
    const r = partAt(x, y, l);
    return r ? describeRect(r) : null;
  };
  assert.equal(at(8, 8), 'Head · Front · Base layer');
  assert.equal(at(40, 8), 'Head · Front · Outer layer');
  assert.equal(at(20, 20), 'Body · Front · Base layer');
  assert.equal(at(44, 20), 'Right Arm · Front · Base layer');
  assert.equal(at(36, 52), 'Left Arm · Front · Base layer');
  assert.equal(at(52, 52), 'Left Arm · Front · Outer layer');
  assert.equal(at(4, 36), 'Right Leg · Front · Outer layer');
  assert.equal(at(20, 52), 'Left Leg · Front · Base layer');
  assert.equal(at(0, 0), null, 'unused corner');
  assert.equal(at(60, 20), null, 'unused strip');
  assert.equal(at(47, 20, 'slim'), 'Right Arm · Left side · Base layer');
  assert.equal(at(54, 20, 'slim'), null);
  assert.equal(at(36, 52, 'legacy'), null);
});

test('body mirror is an involution between matching parts and layers', () => {
  for (const layout of ['classic', 'slim'] as SkinLayout[]) {
    let mapped = 0;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const m = mirrorPixel(x, y, layout);
        const src = partAt(x, y, layout);
        if (!src) {
          assert.equal(m, null);
          continue;
        }
        assert.ok(m, `${layout} ${x},${y} should map`);
        mapped++;
        const back = mirrorPixel(m![0], m![1], layout);
        assert.deepEqual(back, [x, y]);
        const dst = partAt(m![0], m![1], layout)!;
        assert.equal(dst.layer, src.layer);
        if (src.part === 'head' || src.part === 'body') assert.equal(dst.part, src.part);
      }
    }
    assert.ok(mapped > 1000);
  }
  // Right arm front, first column → left arm front, last column.
  assert.deepEqual(mirrorPixel(44, 22, 'classic'), [39, 54]);
  assert.deepEqual(mirrorPixel(44, 22, 'slim'), [38, 54]);
  // Head front is symmetric about its middle.
  assert.deepEqual(mirrorPixel(9, 12, 'classic'), [14, 12]);
  // Right side of the right leg ↔ left side of the left leg.
  assert.deepEqual(mirrorPixel(0, 20, 'classic'), [27, 52]);
  // The map for PixelCanvas skips self-mapped and unused pixels.
  const map = mirrorMapFor('classic');
  assert.deepEqual(map(44, 22), [[39, 54]]);
  assert.deepEqual(map(0, 0), []);
});

test('masks cover the chosen parts and layers only', () => {
  const count = (m: Uint8Array) => m.reduce((a, b) => a + b, 0);
  const all = maskForParts(null, 'classic', 'both');
  const base = maskForParts(null, 'classic', 'base');
  const outer = maskForParts(null, 'classic', 'outer');
  assert.equal(count(base) + count(outer), count(all));
  assert.equal(count(maskForParts(['head'], 'classic', 'base')), 8 * 8 * 6);
  assert.equal(count(maskForParts(['rightArm'], 'slim', 'base')), 2 * 3 * 4 + 2 * 4 * 12 + 2 * 3 * 12);
  assert.equal(maskForParts(['head'], 'classic', 'base')[8 * 64 + 8], 1);
  assert.equal(maskForParts(['head'], 'classic', 'base')[8 * 64 + 40], 0);
});

test('starters: every design paints both models, slim ones are detected as slim', () => {
  for (const s of STARTERS) {
    const classic = createStarterSkin(s.id, 'classic');
    const slim = createStarterSkin(s.id, 'slim');
    assert.equal(classic.width, 64);
    assert.equal(countBaseHoles(classic, 'classic'), 0, `${s.id} classic base layer must be opaque`);
    assert.equal(countBaseHoles(slim, 'slim'), 0, `${s.id} slim base layer must be opaque`);
    assert.equal(detectSlim(classic), false, `${s.id} classic`);
    assert.equal(detectSlim(slim), true, `${s.id} slim`);
    // Deterministic
    assert.deepEqual(Array.from(createStarterSkin(s.id, 'classic').data), Array.from(classic.data));
  }
});

test('arm conversion drops or repeats the column next to the body', () => {
  const img = createStarterSkin('template', 'classic');
  const px = (im: ImageData, x: number, y: number) => Array.from(im.data.slice((y * 64 + x) * 4, (y * 64 + x) * 4 + 4));
  const slim = convertArms(img, 'classic', 'slim');
  assert.equal(detectSlim(slim), true);
  // Right arm front keeps its outer column (44) and loses the inner one (47).
  assert.deepEqual(px(slim, 44, 25), px(img, 44, 25));
  assert.deepEqual(px(slim, 46, 25), px(img, 46, 25));
  // Left arm front loses its inner column (36).
  assert.deepEqual(px(slim, 36, 57), px(img, 37, 57));
  const back = convertArms(slim, 'slim', 'classic');
  assert.equal(detectSlim(back), false);
  assert.deepEqual(px(back, 44, 25), px(img, 44, 25));
  assert.equal(countBaseHoles(back, 'classic'), 0);
});

test('copyToMirror copies a limb to the other side, flipped', () => {
  const img = createImageData(64, 64);
  img.data.set([255, 0, 0, 255], (22 * 64 + 44) * 4);
  const out = copyToMirror(img, 'rightArm', 'classic');
  assert.deepEqual(Array.from(out.data.slice((54 * 64 + 39) * 4, (54 * 64 + 39) * 4 + 4)), [255, 0, 0, 255]);
});

test('exports: Java PNG, legacy losses and the Bedrock skin pack', async () => {
  const img = createStarterSkin('explorer', 'slim');
  const java = exportJavaPng(img, 'My: Skin?', 'slim');
  assert.equal(java.filename, 'My_ Skin_.png');
  const decoded = decodePngBytes(new Uint8Array(await java.blob.arrayBuffer()));
  assert.equal(decoded.width, 64);
  assert.deepEqual(Array.from(decoded.data), Array.from(img.data));

  const legacy = exportJavaLegacy(img, 'x', 'slim');
  const l = decodePngBytes(new Uint8Array(await legacy.blob.arrayBuffer()));
  assert.equal(l.height, 32);
  assert.ok(legacy.notes.some((n) => /slim/.test(n)));
  assert.ok(legacyLosses(createStarterSkin('knight', 'classic'), 'classic').some((n) => /Jacket/.test(n)));
  assert.deepEqual(legacyLosses(createStarterSkin('blank', 'classic'), 'classic'), []);

  const project: SkinProjectData = { id: 'p1', kind: 'skin', name: 'Explorer Kid', model: 'slim', image: java.blob, createdAt: 1, updatedAt: 1 };
  const first = await exportBedrockPack(project, img);
  const uuids = project.bedrockUuids;
  assert.ok(uuids);
  assert.deepEqual(project.packVersion, [1, 0, 0]);
  const files = unzipSync(new Uint8Array(await first.blob.arrayBuffer()));
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  const skins = JSON.parse(strFromU8(files['skins.json']));
  assert.equal(manifest.header.uuid, uuids!.header);
  assert.equal(manifest.modules[0].type, 'skin_pack');
  assert.equal(skins.skins[0].geometry, 'geometry.humanoid.customSlim');
  assert.ok(files[skins.skins[0].texture]);
  assert.equal(first.filename, 'Explorer Kid.mcpack');
  const second = await exportBedrockPack(project, img);
  const manifest2 = JSON.parse(strFromU8(unzipSync(new Uint8Array(await second.blob.arrayBuffer()))['manifest.json']));
  assert.equal(manifest2.header.uuid, uuids!.header);
  assert.deepEqual(manifest2.header.version, [1, 0, 1]);
  assert.ok(PARTS.length === 6);
});
