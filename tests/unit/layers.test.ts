// Paint layers of the texture editor (src/tools/textures/layers): blend modes against the W3C
// compositing formulas, compositing step by step, flattening (hidden layers, strength), merge down,
// flatten, the changes to a stack (images shared, never changed in place), the stored record and
// its checks, a project file round trip, and the editor session: painting reaches the active
// layer's frame, the compositor shows the other layers, and layer changes are undo steps that put
// back the layers and the image being edited.
// Run: npx tsx --test tests/unit/layers.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createImageData, decodePngBytes, encodePng } from '../../src/core/image';
import type { TexturePackProject } from '../../src/core/types';
import {
  addLayer,
  blendPixel,
  canMergeDown,
  compositeArea,
  duplicateLayer,
  flatten,
  flattenStack,
  isPlain,
  makeLayer,
  mergeDown,
  moveLayer,
  nextLayerName,
  removeLayer,
  singleLayer,
  sourcesOf,
  updateLayer,
  type LayerBlend,
  type LayerStack,
} from '../../src/tools/textures/layers/stack';
import { checkLayerRecords, checkLayers, recordOf, stackOf } from '../../src/tools/textures/layers/record';
import { LayerSession, type LayerCanvas } from '../../src/tools/textures/layers/session';
import type { PixelCompositor, PixelStep } from '../../src/shared/pixel-canvas';
import { readProjectArchive, writeProjectArchive } from '../../src/shared/project-file/format';

type RGBA = [number, number, number, number];

function solid(w: number, h: number, c: RGBA): ImageData {
  const img = createImageData(w, h);
  for (let i = 0; i < w * h; i++) img.data.set(c, i * 4);
  return img;
}
const px = (img: ImageData, x: number, y: number): RGBA => {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
};
const blendOne = (under: RGBA, over: RGBA, mode: LayerBlend, opacity = 1): RGBA => {
  const out = new Uint8ClampedArray(under);
  blendPixel(out, 0, new Uint8ClampedArray(over), 0, opacity, mode);
  return [out[0], out[1], out[2], out[3]];
};

/** The W3C "compositing and blending" result in floats (what canvas 2D draws), rounded once. */
function reference(under: RGBA, over: RGBA, mode: LayerBlend, opacity = 1): RGBA {
  const ab = under[3] / 255;
  const as = (over[3] / 255) * opacity;
  const ao = as + ab * (1 - as);
  if (ao === 0) return [0, 0, 0, 0];
  const B = (b: number, s: number) =>
    mode === 'multiply' ? b * s : mode === 'screen' ? b + s - b * s : mode === 'lighten' ? Math.max(b, s) : mode === 'overlay' ? (b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s)) : s;
  const out: number[] = [];
  for (let c = 0; c < 3; c++) {
    const cs = over[c] / 255;
    const cb = under[c] / 255;
    const mixed = (1 - ab) * cs + ab * B(cb, cs);
    out.push(Math.round(((as * mixed + ab * (1 - as) * cb) / ao) * 255));
  }
  return [out[0], out[1], out[2], Math.round(ao * 255)];
}

test('blend modes follow the W3C formulas (opaque, see-through, with strength)', () => {
  const pairs: [RGBA, RGBA][] = [
    [[200, 100, 50, 255], [100, 150, 250, 255]],
    [[20, 220, 128, 255], [128, 64, 255, 128]],
    [[90, 90, 90, 100], [250, 10, 140, 200]],
    [[0, 0, 0, 0], [33, 66, 99, 77]],
    [[255, 255, 255, 255], [0, 0, 0, 0]],
  ];
  for (const mode of ['normal', 'multiply', 'screen', 'lighten', 'overlay'] as LayerBlend[]) {
    for (const [under, over] of pairs) {
      for (const opacity of [1, 0.5]) {
        const got = blendOne(under, over, mode, opacity);
        const want = reference(under, over, mode, opacity);
        for (let c = 0; c < 4; c++) assert.ok(Math.abs(got[c] - want[c]) <= 1, `${mode} ${under} + ${over} @${opacity}: ${got} vs ${want}`);
      }
    }
  }
  // known values
  assert.deepEqual(blendOne([200, 100, 50, 255], [128, 128, 128, 255], 'multiply'), [100, 50, 25, 255]);
  assert.deepEqual(blendOne([0, 0, 0, 255], [255, 255, 255, 255], 'screen'), [255, 255, 255, 255]);
  assert.deepEqual(blendOne([10, 200, 30, 255], [100, 100, 100, 255], 'lighten'), [100, 200, 100, 255]);
  assert.deepEqual(blendOne([255, 0, 0, 255], [0, 0, 255, 255], 'normal', 0.5), [128, 0, 128, 255]);
  // over nothing, every mode is a plain copy
  for (const mode of ['multiply', 'screen', 'overlay'] as LayerBlend[]) assert.deepEqual(blendOne([0, 0, 0, 0], [40, 80, 120, 255], mode), [40, 80, 120, 255]);
});

test('flattening skips hidden layers, applies strength, and matches compositing step by step', () => {
  const base = solid(4, 4, [200, 100, 50, 255]);
  const top = solid(4, 4, [0, 0, 0, 0]);
  top.data.set([0, 0, 255, 255], 0);
  top.data.set([255, 255, 255, 128], 4);
  const shade = solid(4, 4, [128, 128, 128, 255]);
  const s: LayerStack = {
    layers: [makeLayer('Base', base), makeLayer('Top', top), makeLayer('Shade', shade, { blend: 'multiply', opacity: 0.5 }), makeLayer('Hidden', solid(4, 4, [0, 255, 0, 255]), { hidden: true })],
    active: 1,
  };
  const flat = flatten(s);
  // by hand, one layer after the other
  const want = blendOne(blendOne([200, 100, 50, 255], [0, 0, 255, 255], 'normal'), [128, 128, 128, 255], 'multiply', 0.5);
  assert.deepEqual(px(flat, 0, 0), want);
  assert.deepEqual(px(flat, 3, 3), blendOne([200, 100, 50, 255], [128, 128, 128, 255], 'multiply', 0.5));
  // compositing an area gives the same bytes as the whole
  const part = createImageData(4, 4);
  compositeArea(part, { x: 1, y: 0, w: 2, h: 2 }, sourcesOf(s.layers, { x: 1, y: 0 }));
  assert.deepEqual(px(part, 1, 0), px(flat, 1, 0));
  assert.deepEqual(px(part, 2, 1), px(flat, 2, 1));
  assert.deepEqual(px(part, 0, 0), [0, 0, 0, 0], 'outside the area stays as it was');
  // a plain stack is its own image (copied)
  const one = singleLayer(base, 'Layer 1');
  assert.ok(isPlain(one));
  const f1 = flatten(one);
  assert.notEqual(f1, base);
  assert.deepEqual(Array.from(f1.data), Array.from(base.data));
  assert.ok(!isPlain(updateLayer(one, 0, { opacity: 0.5 })));
  assert.ok(!isPlain(updateLayer(one, 0, { locked: true })));
});

test('stack changes keep the active layer right and never change images in place', () => {
  const a = makeLayer('A', solid(2, 2, [255, 0, 0, 255]));
  const s0: LayerStack = { layers: [a], active: 0 };
  const s1 = addLayer(s0, makeLayer('B', createImageData(2, 2)), 1);
  assert.equal(s1.active, 1);
  assert.equal(s0.layers.length, 1, 'the stack given is left as it was');
  const s2 = duplicateLayer(s1, 0, 'A copy');
  assert.deepEqual(s2.layers.map((l) => l.name), ['A', 'A copy', 'B']);
  assert.equal(s2.active, 1);
  assert.notEqual(s2.layers[1].image, a.image);
  assert.deepEqual(Array.from(s2.layers[1].image.data), Array.from(a.image.data));
  assert.equal(s2.layers[0].image, a.image, 'other layers share their images');
  const s3 = moveLayer({ ...s2, active: 2 }, 2, 0);
  assert.deepEqual(s3.layers.map((l) => l.name), ['B', 'A', 'A copy']);
  assert.equal(s3.layers[s3.active].name, 'B', 'the active layer moves along');
  const s4 = removeLayer(s3, 0);
  assert.equal(s4.layers[s4.active].name, 'A', 'deleting the active layer selects the one under it, else above');
  assert.equal(removeLayer(singleLayer(a.image, 'x'), 0).layers.length, 1, 'the last layer stays');
  const s5 = addLayer(s4, makeLayer('Ref', createImageData(2, 2), { locked: true }), 0, true);
  assert.equal(s5.layers[0].name, 'Ref');
  assert.equal(s5.layers[s5.active].name, 'A', 'a layer put underneath keeps the active one');
  assert.equal(nextLayerName(s5, (n) => `Layer ${n}`), 'Layer 4');
  assert.equal(nextLayerName({ layers: [makeLayer('Layer 2', a.image)], active: 0 }, (n) => `Layer ${n}`), 'Layer 3');
});

test('merge down paints the layer into the one under it with its strength and blend mode', () => {
  const lower = makeLayer('Lower', solid(2, 1, [200, 100, 50, 255]), { name: 'Lower' });
  const upper = makeLayer('Upper', solid(2, 1, [128, 128, 128, 255]), { blend: 'multiply', opacity: 0.5 });
  upper.image.data.set([0, 0, 0, 0], 4);
  const top = makeLayer('Top', solid(2, 1, [0, 0, 0, 0]));
  const s: LayerStack = { layers: [lower, upper, top], active: 2 };
  assert.ok(canMergeDown(s, 1));
  assert.ok(!canMergeDown(s, 0), 'nothing under the bottom layer');
  assert.ok(!canMergeDown(updateLayer(s, 1, { hidden: true }), 1), 'a hidden layer isn’t merged');
  const m = mergeDown(s, 1);
  assert.deepEqual(m.layers.map((l) => l.name), ['Lower', 'Top']);
  assert.equal(m.active, 0);
  assert.equal(m.layers[0].blend, 'normal');
  assert.deepEqual(px(m.layers[0].image, 0, 0), blendOne([200, 100, 50, 255], [128, 128, 128, 255], 'multiply', 0.5));
  assert.deepEqual(px(m.layers[0].image, 1, 0), [200, 100, 50, 255]);
  assert.deepEqual(Array.from(flatten(m).data), Array.from(flatten(s).data), 'it looks the same');
  assert.deepEqual(px(lower.image, 0, 0), [200, 100, 50, 255], 'the lower layer’s own image is kept (for undo)');
});

test('flatten makes one plain layer of what shows; hidden layers are dropped', () => {
  const s: LayerStack = {
    layers: [makeLayer('Hidden', solid(2, 2, [0, 255, 0, 255]), { hidden: true }), makeLayer('Paint', solid(2, 2, [10, 20, 30, 255]), { locked: true }), makeLayer('Glow', solid(2, 2, [200, 200, 200, 255]), { blend: 'screen', opacity: 0.4 })],
    active: 2,
  };
  const f = flattenStack(s, 'Layer 1');
  assert.equal(f.layers.length, 1);
  assert.ok(isPlain(f));
  assert.equal(f.layers[0].name, 'Layer 1');
  assert.deepEqual(Array.from(f.layers[0].image.data), Array.from(flatten(s).data));
});

test('the stored record: PNG layers with their settings, and back', async () => {
  const img1 = solid(3, 2, [1, 2, 3, 255]);
  const img2 = solid(3, 2, [0, 0, 0, 0]);
  img2.data.set([250, 0, 0, 90], 8);
  const s: LayerStack = { layers: [makeLayer('Game texture', img1, { locked: true }), makeLayer('Shine', img2, { blend: 'overlay', opacity: 0.25, hidden: true })], active: 1 };
  let encodes = 0;
  const rec = recordOf(s, (img) => {
    encodes++;
    return new Blob([encodePng(img)], { type: 'image/png' });
  });
  assert.equal(encodes, 2);
  assert.deepEqual(
    rec.layers.map(({ image: _i, ...r }) => r),
    [
      { id: s.layers[0].id, name: 'Game texture', locked: true },
      { id: s.layers[1].id, name: 'Shine', hidden: true, opacity: 0.25, blend: 'overlay' },
    ],
  );
  const back = await stackOf(rec, async (b) => decodePngBytes(new Uint8Array(await b.arrayBuffer())));
  assert.ok(back);
  assert.equal(back.active, 1);
  assert.deepEqual(back.layers.map(({ image: _i, ...l }) => l), s.layers.map(({ image: _i, ...l }) => l));
  assert.deepEqual(Array.from(back.layers[1].image.data), Array.from(img2.data));
  // layers of different sizes, or that don't decode, can't be used
  const odd = { ...rec, layers: [rec.layers[0], { ...rec.layers[1], image: new Blob([encodePng(solid(2, 2, [0, 0, 0, 0]))]) }] };
  assert.equal(await stackOf(odd, async (b) => decodePngBytes(new Uint8Array(await b.arrayBuffer()))), null);
  assert.equal(await stackOf(rec, async () => Promise.reject(new Error('bad'))), null);
  // checking stored records
  assert.equal(checkLayers({ layers: [{ name: 'x', image: 'not a blob' }], active: 0 }), null);
  assert.equal(checkLayers({ layers: [], active: 0 }), null);
  const fixed = checkLayers({ layers: [{ image: new Blob([]), opacity: 2, blend: 'dodge', hidden: 'yes' }], active: 9 });
  assert.deepEqual(fixed && { ...fixed, layers: fixed.layers.map(({ image: _i, ...l }) => l) }, { layers: [{ id: 'l0', name: '' }], active: 0, updatedAt: 0 });
  assert.equal(checkLayerRecords({ 'a.png': { layers: [] } }), undefined);
  assert.deepEqual(Object.keys(checkLayerRecords({ 'a.png': rec, 'b.png': 5 }) ?? {}), ['a.png']);
});

test('a project file carries the layers (their PNGs) and they come back the same', async () => {
  const s: LayerStack = { layers: [makeLayer('Layer 1', solid(2, 2, [9, 9, 9, 255])), makeLayer('Layer 2', solid(2, 2, [0, 0, 0, 0]), { opacity: 0.5 })], active: 1 };
  const rec = recordOf(s, (img) => new Blob([encodePng(img)], { type: 'image/png' }));
  const project = { id: 'p1', kind: 'texturepack', name: 'P', edition: 'java', version: '26.3', description: '', resolution: 16, overrides: {}, extraFiles: {}, effects: [], layers: { 'assets/minecraft/textures/block/stone.png': rec } } as unknown as TexturePackProject;
  const archive = await readProjectArchive(await writeProjectArchive('textures', [{ type: 'texturepack', id: 'p1', name: 'P', data: { project } }]));
  const back = archive.load(archive.manifest.items[0]).data.project as TexturePackProject;
  const r = back.layers?.['assets/minecraft/textures/block/stone.png'];
  assert.ok(r && r.layers[1].image instanceof Blob);
  assert.equal(r.layers[1].image.type, 'image/png');
  const stack = await stackOf(checkLayers(r)!, async (b) => decodePngBytes(new Uint8Array(await b.arrayBuffer())));
  assert.deepEqual(Array.from(flatten(stack!).data), Array.from(flatten(s).data));
});

/** A pixel editor stand-in: keeps the image it edits and the undo steps given to it. */
function fakeCanvas(img: ImageData) {
  const steps: PixelStep[] = [];
  const c = {
    img,
    steps,
    compositor: null as PixelCompositor | null,
    locked: false,
    commitSelection() {},
    getImage: () => c.img,
    pushStep(s: PixelStep) {
      steps.push(s);
    },
    swapImage(i: ImageData) {
      c.img = i;
    },
    setCompositor(fn: PixelCompositor | null) {
      c.compositor = fn;
    },
    recompose() {},
    setLocked(v: boolean) {
      c.locked = v;
    },
    /** What the editor shows */
    shown(): ImageData {
      if (!c.compositor) return c.img;
      const out = createImageData(c.img.width, c.img.height);
      c.compositor(c.img, { x: 0, y: 0, w: c.img.width, h: c.img.height }, out);
      return out;
    },
  };
  return c satisfies LayerCanvas;
}

test('session: painting goes into the active layer’s frame; layer changes are undo steps', () => {
  // an animation of two 2×2 frames, stacked
  const strip = solid(2, 4, [100, 100, 100, 255]);
  let frame = 1;
  const area = () => ({ x: 0, y: frame * 2, w: 2, h: 2 });
  const session = new LayerSession(singleLayer(strip, 'Layer 1'), area);
  const changes: string[] = [];
  session.on((k) => changes.push(k));
  const canvas = fakeCanvas(session.canvasImage());
  session.attach(canvas);
  assert.equal(canvas.compositor, null, 'one plain layer: shown as it is');

  // add a layer: one undo step, the editor now edits the new (empty) layer
  const before = session.stack;
  session.apply(addLayer(before, makeLayer('Layer 2', createImageData(2, 4)), 1));
  assert.equal(canvas.steps.length, 1);
  assert.ok(canvas.steps[0].bytes! >= 2 * 4 * 4);
  assert.equal(canvas.img.width, 2);
  assert.equal(canvas.img.height, 2);
  assert.deepEqual(px(canvas.img, 0, 0), [0, 0, 0, 0]);
  assert.ok(canvas.compositor, 'more layers: shown through the compositor');
  assert.deepEqual(px(canvas.shown(), 0, 0), [100, 100, 100, 255], 'the layer under it shows');

  // paint the new layer's frame 2
  const painted = createImageData(2, 2);
  painted.data.set([255, 0, 0, 255], 0);
  session.takeCanvas(painted);
  assert.deepEqual(px(session.active.image, 0, 2), [255, 0, 0, 255], 'into the frame being edited');
  assert.deepEqual(px(session.active.image, 0, 0), [0, 0, 0, 0], 'other frames untouched');
  const full = flatten(session.stack);
  assert.deepEqual(px(full, 0, 2), [255, 0, 0, 255]);
  assert.deepEqual(px(full, 1, 2), [100, 100, 100, 255]);

  // the shown pixels follow the editor's live pixels for the active layer
  const live = createImageData(2, 2);
  live.data.set([0, 0, 255, 255], 12);
  canvas.img = live;
  assert.deepEqual(px(canvas.shown(), 1, 1), [0, 0, 255, 255]);
  const flat = flatten(session.stack);
  session.flattenInto(flat, live);
  assert.deepEqual(px(flat, 1, 3), [0, 0, 255, 255], 'flattenInto uses the live pixels');
  assert.deepEqual(px(flat, 0, 2), [100, 100, 100, 255]);
  canvas.img = painted;

  // select the bottom layer: a passive step, the editor switches images
  session.select(0);
  assert.equal(canvas.steps.length, 2);
  assert.ok(canvas.steps[1].passive);
  assert.deepEqual(px(canvas.img, 0, 0), [100, 100, 100, 255]);
  // lock it: painting is refused
  session.apply(updateLayer(session.stack, 0, { locked: true }));
  assert.equal(canvas.locked, true);

  // undo the lock, the selection, the added layer
  canvas.steps[2].undo();
  assert.equal(canvas.locked, false);
  canvas.steps[1].undo();
  assert.equal(session.stack.active, 1);
  assert.deepEqual(px(canvas.img, 0, 0), [255, 0, 0, 255], 'back on the layer the stroke was painted on');
  canvas.steps[0].undo();
  assert.equal(session.stack, before);
  assert.equal(canvas.compositor, null);
  assert.deepEqual(px(canvas.img, 0, 0), [100, 100, 100, 255]);
  // and redo it
  canvas.steps[0].redo();
  assert.equal(session.stack.layers.length, 2);
  assert.deepEqual(px(session.active.image, 0, 2), [255, 0, 0, 255], 'its pixels come back with it');
  assert.ok(changes.includes('pixels') && changes.includes('layers'));

  // a live change (slider) shows without a step; the final one records one step from where it began
  const start = session.stack;
  session.apply(updateLayer(start, 1, { opacity: 0.3 }), { live: true });
  session.apply(updateLayer(start, 1, { opacity: 0.6 }), { live: true });
  assert.equal(canvas.steps.length, 3);
  session.apply(updateLayer(start, 1, { opacity: 0.5 }), { from: start });
  assert.equal(canvas.steps.length, 4);
  canvas.steps[3].undo();
  assert.equal(session.stack.layers[1].opacity, 1);

  // another frame: the same layers, another area
  frame = 0;
  assert.deepEqual(px(session.canvasImage(), 0, 0), [0, 0, 0, 0]);
  // a hidden active layer can't be painted either
  session.apply(updateLayer(session.stack, 1, { hidden: true }));
  assert.equal(canvas.locked, true);
});

test('session: switching layers first keeps what the editor holds on the layer it was editing', () => {
  const session = new LayerSession(singleLayer(solid(2, 2, [10, 10, 10, 255]), 'Layer 1'), () => ({ x: 0, y: 0, w: 2, h: 2 }));
  const canvas = fakeCanvas(session.canvasImage());
  session.attach(canvas);
  session.apply(addLayer(session.stack, makeLayer('Layer 2', createImageData(2, 2)), 1));
  session.select(0);
  session.select(1);
  canvas.steps[2].undo();
  assert.equal(session.stack.active, 0);
  session.takePainted();
  // a stroke on Layer 1 is redone, then the selection of Layer 2 after it, before the editor reports a change
  canvas.img = solid(2, 2, [200, 0, 0, 255]);
  canvas.steps[2].redo();
  assert.equal(session.stack.active, 1);
  assert.deepEqual(px(session.stack.layers[0].image, 0, 0), [200, 0, 0, 255], 'the redone stroke stays on Layer 1');
  assert.deepEqual(px(canvas.img, 0, 0), [0, 0, 0, 0], 'the editor edits Layer 2 now');
  assert.deepEqual(session.takePainted(), [session.stack.layers[0].image], 'Layer 1 is saved again');
});
