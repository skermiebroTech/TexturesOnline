// Painting on the 3D model: face frames against skinview3d's real geometry, brush footprints that
// wrap over box edges, mirroring and stroke steps (pure logic).
// Run: npx tsx --test tests/unit/skins-surface.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SkinObject } from 'skinview3d/libs/model.js';
import type { BufferGeometry, Mesh } from 'three';
import { BOX_FACE_ORDER, faceFrame, facePoint, mirrorFootprint, strokeSteps, surfaceFootprint, texelPlace } from '../../src/tools/skins/surface';
import { faceRect, mirrorPixel, partAt, partBox, PARTS, type SkinLayer } from '../../src/tools/skins/templates';

const px = (x: number, y: number) => y * 64 + x;
const sorted = (a: Iterable<number>) => [...a].sort((p, q) => p - q);

test('face frames match the UVs skinview3d puts on every box (classic and slim)', () => {
  for (const model of ['classic', 'slim'] as const) {
    const skin = new SkinObject();
    skin.modelType = model === 'slim' ? 'slim' : 'default';
    for (const part of PARTS) {
      for (const layer of ['base', 'outer'] as SkinLayer[]) {
        const mesh = (layer === 'base' ? skin[part].innerLayer : skin[part].outerLayer) as Mesh;
        const geo = mesh.geometry as BufferGeometry;
        geo.computeBoundingBox();
        const bb = geo.boundingBox!;
        const size = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];
        const box = partBox(part, model);
        const dims = [box.w, box.h, box.d];
        const pos = geo.attributes.position;
        const uv = geo.attributes.uv;
        assert.equal(pos.count, 24);
        for (let v = 0; v < 24; v++) {
          const face = BOX_FACE_ORDER[Math.floor(v / 4)];
          const r = faceRect(part, face, layer, model)!;
          const tx = uv.getX(v) * 64;
          const ty = (1 - uv.getY(v)) * 64;
          // Every vertex is a corner of its face rectangle in the texture...
          assert.ok(Math.abs(tx - r.x) < 1e-4 || Math.abs(tx - (r.x + r.w)) < 1e-4, `${model} ${part} ${layer} ${face} u ${tx}`);
          assert.ok(Math.abs(ty - r.y) < 1e-4 || Math.abs(ty - (r.y + r.h)) < 1e-4, `${model} ${part} ${layer} ${face} v ${ty}`);
          // ...and sits where the frame says that texture corner goes on the box.
          const expected = facePoint(faceFrame(face, box), tx - r.x, ty - r.y);
          const p = [pos.getX(v), pos.getY(v), pos.getZ(v)];
          const actual = p.map((c, a) => (c / size[a] + 0.5) * dims[a]);
          for (let a = 0; a < 3; a++) {
            assert.ok(Math.abs(actual[a] - expected[a]) < 1e-4, `${model} ${part} ${layer} ${face} vertex ${v}: ${actual} vs ${expected}`);
          }
        }
      }
    }
  }
});

test('texel centres sit on their faces', () => {
  // Head front, top-left pixel: left edge, top row, front plane.
  assert.deepEqual(texelPlace(8, 8, 'classic')?.center, [0.5, 7.5, 8]);
  // Head top, bottom-left pixel adjoins the front's top edge.
  assert.deepEqual(texelPlace(8, 7, 'classic')?.center, [0.5, 8, 7.5]);
  // Right arm front on a slim model is 3 wide.
  const p = texelPlace(46, 20, 'slim')!;
  assert.equal(p.rect.part, 'rightArm');
  assert.equal(p.rect.face, 'front');
  assert.deepEqual(p.center, [2.5, 11.5, 4]);
  assert.equal(texelPlace(60, 4, 'classic'), null);
});

test('a 1px brush is exactly the pixel under the cursor', () => {
  assert.deepEqual(surfaceFootprint(10.3, 12.9, 1, 'square', 'classic'), [px(10, 12)]);
  assert.deepEqual(surfaceFootprint(3.5, 3.5, 1, 'square', 'classic'), []); // unused area
});

test('square brushes are laid out like the 2D pencil inside a face', () => {
  // Head front centre (12, 12): a 2px brush lands on the pixel corner nearest the pointer.
  assert.deepEqual(sorted(surfaceFootprint(12.2, 12.2, 2, 'square', 'classic')), sorted([px(11, 11), px(12, 11), px(11, 12), px(12, 12)]));
  assert.deepEqual(sorted(surfaceFootprint(12.5, 12.5, 3, 'square', 'classic')), sorted([11, 12, 13].flatMap((y) => [11, 12, 13].map((x) => px(x, y)))));
});

test('brushes fold over box edges onto the neighbouring faces', () => {
  // 3px brush on the head front's top-left pixel: 4 front pixels, 2 on the top face's front row,
  // 2 on the right side's front column; the corner cell has no single neighbour.
  const got = sorted(surfaceFootprint(8.5, 8.5, 3, 'square', 'classic'));
  assert.deepEqual(got, sorted([px(8, 8), px(9, 8), px(8, 9), px(9, 9), px(8, 7), px(9, 7), px(7, 8), px(7, 9)]));
  for (const p of got) {
    const r = partAt(p % 64, Math.floor(p / 64), 'classic')!;
    assert.equal(r.part, 'head');
    assert.equal(r.layer, 'base');
  }
  // Outer layer footprints stay on the outer layer.
  for (const p of surfaceFootprint(40.5, 8.5, 3, 'square', 'classic')) assert.equal(partAt(p % 64, Math.floor(p / 64), 'classic')!.layer, 'outer');
});

test('big brushes never reach the far side of a limb', () => {
  for (const model of ['classic', 'slim'] as const) {
    const front = faceRect('rightArm', 'front', 'base', model)!;
    const back = faceRect('rightArm', 'back', 'base', model)!;
    const got = surfaceFootprint(front.x + front.w / 2, front.y + 6, 8, 'square', model);
    assert.ok(got.length > front.w * 6, `${model}: ${got.length}`);
    for (const p of got) {
      const x = p % 64;
      const y = Math.floor(p / 64);
      const r = partAt(x, y, model)!;
      assert.equal(r.part, 'rightArm');
      assert.notEqual(r.face, 'back');
      assert.ok(!(x >= back.x && x < back.x + back.w && y >= back.y && y < back.y + back.h));
    }
    // It does wrap onto both sides of the arm.
    const faces = new Set(got.map((p) => partAt(p % 64, Math.floor(p / 64), model)!.face));
    assert.ok(faces.has('left') && faces.has('right'), [...faces].join(','));
  }
});

test('round brushes are round', () => {
  const got = surfaceFootprint(12.5, 12.5, 5, 'round', 'classic');
  assert.ok(!got.includes(px(10, 10)) && got.includes(px(12, 10)) && got.includes(px(12, 12)));
});

test('mirror footprints use the true body mirror', () => {
  const right = [px(44, 22), px(45, 22)];
  const got = mirrorFootprint(right, 'classic');
  assert.deepEqual(sorted(got), sorted(right.map((p) => mirrorPixel(p % 64, Math.floor(p / 64), 'classic')!).map(([x, y]) => px(x, y))));
  // The head front mirrors onto itself (column flip); the pixel itself is left out.
  assert.deepEqual(mirrorFootprint([px(8, 8)], 'classic'), [px(15, 8)]);
  assert.deepEqual(mirrorFootprint([px(11, 8), px(12, 8)], 'classic').length, 2);
});

test('stroke steps are at most half a pixel apart and end on the target', () => {
  const steps = strokeSteps({ fx: 8.5, fy: 8.5 }, { fx: 14.2, fy: 10.1 });
  assert.deepEqual(steps[steps.length - 1], [14.2, 10.1]);
  let last = [8.5, 8.5];
  for (const s of steps) {
    assert.ok(Math.abs(s[0] - last[0]) <= 0.5 + 1e-9 && Math.abs(s[1] - last[1]) <= 0.5 + 1e-9);
    last = s;
  }
  assert.equal(strokeSteps({ fx: 1, fy: 1 }, { fx: 1, fy: 1 }).length, 1);
});
