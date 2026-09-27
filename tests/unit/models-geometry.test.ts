/**
 * Model engine geometry against the game's rules (FaceBakery / FaceInfo / BlockModelRotation), on
 * synthetic models: default UVs, corner order and winding, face rotation, element rotation with
 * rescale, block state rotations, uvlock keeping textures aligned with the world, and the blockstate
 * helpers (variant keys, multipart conditions, properties, default state).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIRS, cornerUv, defaultFaceUv, type BakedQuad, type Dir, type Vec3 } from '../../src/shared/models/geometry';
import {
  JavaModelSet,
  bakeModel,
  blockstateProperties,
  defaultState,
  matchesCondition,
  modelId,
  parseBlockstate,
  parseVariantKey,
  resolveTextureVar,
  uvLock,
  variantMatrix,
  variantsForState,
  itemOptions,
} from '../../src/shared/models/java-models';
import { labelTextures, textureSuffix } from '../../src/shared/models/labels';
import { atlasTextures, distinctLabels, faceNames, parseLang } from '../../src/shared/models/bedrock-blocks';
import { apply } from '../../src/shared/models/geometry';

const CUBE = {
  parent: 'block/block',
  elements: [
    {
      from: [0, 0, 0],
      to: [16, 16, 16],
      faces: Object.fromEntries(DIRS.map((d) => [d, { texture: `#${d}`, cullface: d }])),
    },
  ],
};

function models(files: Record<string, unknown>): JavaModelSet {
  return new JavaModelSet((p) => files[p]);
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Counter-clockwise seen from the front: the corner winding agrees with the outward normal. */
function frontFacing(q: BakedQuad): boolean {
  const n = cross(sub(q.positions[1], q.positions[0]), sub(q.positions[2], q.positions[0]));
  return dot(n, q.normal) > 0;
}

test('ids: bare blockstate model names live in block/, namespaces default to minecraft', () => {
  assert.equal(modelId('furnace'), 'minecraft:block/furnace');
  assert.equal(modelId('block/furnace'), 'minecraft:block/furnace');
  assert.equal(modelId('minecraft:item/generated'), 'minecraft:item/generated');
  assert.equal(modelId('mymod:block/x'), 'mymod:block/x');
});

test('default face UVs follow the box projection of each face', () => {
  const from: Vec3 = [2, 3, 4];
  const to: Vec3 = [10, 12, 14];
  assert.deepEqual(defaultFaceUv('up', from, to), [2, 4, 10, 14]);
  assert.deepEqual(defaultFaceUv('down', from, to), [2, 2, 10, 12]);
  assert.deepEqual(defaultFaceUv('north', from, to), [6, 4, 14, 13]);
  assert.deepEqual(defaultFaceUv('south', from, to), [2, 4, 10, 13]);
  assert.deepEqual(defaultFaceUv('west', from, to), [4, 4, 14, 13]);
  assert.deepEqual(defaultFaceUv('east', from, to), [2, 4, 12, 13]);
  // rotation shifts which corner takes (u1, v1)
  assert.deepEqual(cornerUv([0, 0, 16, 16], 0, 0), [0, 0]);
  assert.deepEqual(cornerUv([0, 0, 16, 16], 90, 0), [0, 16]);
  assert.deepEqual(cornerUv([0, 0, 16, 16], 180, 0), [16, 16]);
});

test('a cube bakes six outward, counter-clockwise faces with the texture upright', () => {
  const set = models({ 'assets/minecraft/models/block/cube.json': CUBE, 'assets/minecraft/models/block/t.json': { parent: 'block/cube', textures: Object.fromEntries(DIRS.map((d) => [d, `block/${d}`])) } });
  const quads = bakeModel(set.resolve('block/t'));
  assert.equal(quads.length, 6);
  for (const q of quads) {
    assert.ok(frontFacing(q), `${q.dir} winds counter-clockwise`);
    assert.equal(q.worldDir, q.dir);
    assert.equal(q.texture, `assets/minecraft/textures/block/${q.dir}.png`);
    assert.equal(q.role, q.dir);
  }
  // The north face's texture top-left sits at the top east corner (seen from outside, east is on the left).
  const north = quads.find((q) => q.dir === 'north')!;
  const tl = north.positions[north.uvs.findIndex((uv) => uv[0] === 0 && uv[1] === 0)];
  assert.deepEqual(tl, [1, 1, 0]);
  // The top face's texture top points north.
  const up = quads.find((q) => q.dir === 'up')!;
  assert.deepEqual(up.positions[up.uvs.findIndex((uv) => uv[0] === 0 && uv[1] === 0)], [0, 1, 0]);
});

test('texture variables resolve through # chains, child values win', () => {
  const set = models({
    'assets/minecraft/models/block/cube.json': CUBE,
    'assets/minecraft/models/block/orientable.json': { parent: 'block/cube', textures: { north: '#front', up: '#top', down: '#top', east: '#side', west: '#side', south: '#side', particle: '#front' } },
    'assets/minecraft/models/block/furnace.json': { parent: 'block/orientable', textures: { front: 'block/furnace_front', side: 'block/furnace_side', top: 'block/furnace_top' } },
  });
  const m = set.resolve('furnace');
  assert.deepEqual(m.chain, ['minecraft:block/furnace', 'minecraft:block/orientable', 'minecraft:block/cube']);
  assert.deepEqual(resolveTextureVar(m.textures, '#north'), { ref: 'block/furnace_front', via: ['north', 'front'] });
  const north = bakeModel(m).find((q) => q.dir === 'north')!;
  assert.equal(north.role, 'front');
  assert.equal(north.ref, 'block/furnace_front');
  // an undefined variable is reported as missing, not thrown
  assert.equal(resolveTextureVar({ a: '#b' }, 'a').ref, null);
  // a circular chain ends
  assert.equal(resolveTextureVar({ a: '#b', b: '#a' }, 'a').ref, null);
  // missing parents and builtin chains
  assert.equal(set.resolve('block/nope').builtin, 'missing');
  const gen = models({ 'assets/minecraft/models/item/generated.json': { parent: 'builtin/generated' }, 'assets/minecraft/models/item/apple.json': { parent: 'item/generated', textures: { layer0: 'item/apple' } } });
  assert.equal(gen.resolve('minecraft:item/apple').builtin, 'generated');
});

test('block state rotation: y=90 turns north to east, x=90 turns north to down (clockwise, as the game)', () => {
  const r = (x: number, y: number, v: Vec3) => apply(variantMatrix(x, y), v).map((c) => Math.round(c));
  assert.deepEqual(r(0, 90, [0, 0, -1]), [1, 0, 0]);
  assert.deepEqual(r(0, 180, [0, 0, -1]), [0, 0, 1]);
  assert.deepEqual(r(0, 270, [0, 0, -1]), [-1, 0, 0]);
  assert.deepEqual(r(90, 0, [0, 0, -1]), [0, -1, 0]);
  assert.deepEqual(r(270, 0, [0, 0, -1]), [0, 1, 0]);
  // X is applied before Y
  assert.deepEqual(r(90, 90, [0, 0, -1]), [0, -1, 0]);
  assert.deepEqual(r(90, 90, [0, 1, 0]), [1, 0, 0]);
});

test('element rotation with rescale: a 45 degree cross plane spans the block diagonal (inset 0.05 like the game)', () => {
  const set = models({
    'assets/minecraft/models/block/cross.json': {
      elements: [{ from: [0.8, 0, 8], to: [15.2, 16, 8], rotation: { origin: [8, 8, 8], axis: 'y', angle: 45, rescale: true }, faces: { north: { texture: '#cross', uv: [0, 0, 16, 16] } } }],
    },
  });
  const [q] = bakeModel(set.resolve('block/cross'));
  const xs = q.positions.map((p) => p[0]);
  const zs = q.positions.map((p) => p[2]);
  // 14.4 px wide, turned 45 degrees and stretched by sqrt(2): corners at 0.05 and 0.95 on both axes
  assert.ok(Math.abs(Math.min(...xs) - 0.05) < 1e-6 && Math.abs(Math.max(...xs) - 0.95) < 1e-6, JSON.stringify(q.positions));
  assert.ok(Math.abs(Math.min(...zs) - 0.05) < 1e-6 && Math.abs(Math.max(...zs) - 0.95) < 1e-6);
  // full height
  assert.deepEqual([...new Set(q.positions.map((p) => p[1]))].sort(), [0, 1]);
  assert.equal(q.worldDir, null, 'angled faces have no axis direction');
  assert.ok(frontFacing(q));
});

test('uvlock re-maps UVs so rotated faces keep world-aligned textures', () => {
  // top face of a stair-like part rotated a quarter turn: the texture must not turn with it
  for (const y of [90, 180, 270]) {
    const m = variantMatrix(0, y);
    const { uv, rotation } = uvLock([0, 0, 16, 8], 0, 'up', m);
    const set = models({ 'assets/minecraft/models/block/half.json': { elements: [{ from: [0, 0, 0], to: [16, 16, 8], faces: { up: { texture: '#t', uv: [0, 0, 16, 8] } } }] } });
    const [q] = bakeModel(set.resolve('block/half'), { y, uvlock: true });
    q.positions.forEach((p, i) => {
      assert.ok(Math.abs(q.uvs[i][0] - p[0] * 16) < 1e-6 && Math.abs(q.uvs[i][1] - p[2] * 16) < 1e-6, `y=${y} corner ${i}: uv ${q.uvs[i]} at ${p}`);
    });
    assert.ok(uv.every((c) => c >= 0 && c <= 16));
    assert.ok([0, 90, 180, 270].includes(rotation));
  }
});

test('blockstates: variant keys, weighted lists, multipart OR/AND and properties', () => {
  assert.deepEqual(parseVariantKey('facing=east,lit=true'), { facing: 'east', lit: 'true' });
  assert.deepEqual(parseVariantKey('normal'), {});
  assert.deepEqual(parseVariantKey(''), {});
  const furnace = parseBlockstate({
    variants: {
      'facing=east,lit=false': { model: 'block/furnace', y: 90 },
      'facing=north,lit=false': { model: 'block/furnace' },
      'facing=north,lit=true': { model: 'block/furnace_on' },
      'facing=east,lit=true': { model: 'block/furnace_on', y: 90 },
    },
  })!;
  assert.deepEqual(blockstateProperties(furnace), [
    { name: 'facing', values: ['north', 'east'] },
    { name: 'lit', values: ['false', 'true'] },
  ]);
  assert.deepEqual(defaultState(furnace), { facing: 'north', lit: 'false' });
  assert.equal(variantsForState(furnace, { facing: 'east', lit: 'true' })[0].model, 'block/furnace_on');
  assert.equal(variantsForState(furnace, { facing: 'east', lit: 'true' })[0].y, 90);

  const stone = parseBlockstate({ variants: { '': [{ model: 'block/stone' }, { model: 'block/stone_mirrored', weight: 2 }] } })!;
  assert.equal(variantsForState(stone, {}, 1)[0].model, 'block/stone_mirrored');
  assert.equal(variantsForState(stone, {}, 1)[0].weight, 2);

  const fence = parseBlockstate({
    multipart: [
      { apply: { model: 'block/post' } },
      { when: { north: 'true' }, apply: { model: 'block/side', uvlock: true } },
      { when: { OR: [{ east: 'true' }, { west: 'true' }] }, apply: { model: 'block/side', y: 90, uvlock: true } },
      { when: { AND: [{ south: 'true' }, { west: 'false' }] }, apply: { model: 'block/side', y: 180 } },
      { when: { north: 'side|up' }, apply: { model: 'block/dust' } },
    ],
  })!;
  const props = blockstateProperties(fence);
  assert.deepEqual(props.find((p) => p.name === 'east')!.values, ['false', 'true'], 'booleans get their "false" value');
  assert.deepEqual(props.find((p) => p.name === 'north')!.values, ['true', 'none', 'side', 'up'], 'non-boolean connections get "none"');
  assert.equal(variantsForState(fence, { north: 'false', east: 'false', south: 'false', west: 'false' }).length, 1);
  assert.equal(variantsForState(fence, { north: 'true', east: 'true', south: 'true', west: 'false' }).length, 4);
  assert.equal(variantsForState(fence, { north: 'false', east: 'false', south: 'true', west: 'true' }).length, 2);
  assert.ok(matchesCondition({ north: 'side|up' }, { north: 'up' }));
  assert.ok(!matchesCondition({ north: 'side|up' }, { north: 'none' }));
  const def = defaultState(fence);
  assert.equal(def.north, 'true', 'fences show a north-south line by default');
  assert.equal(def.east, 'false');
});

test('item definitions: every look with a label (conditions, selects, ranges, composites)', () => {
  const bow = itemOptions({
    model: {
      type: 'minecraft:condition',
      property: 'minecraft:using_item',
      on_false: { type: 'minecraft:model', model: 'minecraft:item/bow' },
      on_true: {
        type: 'minecraft:range_dispatch',
        property: 'minecraft:use_duration',
        entries: [{ threshold: 0.65, model: { type: 'minecraft:model', model: 'minecraft:item/bow_pulling_1' } }],
        fallback: { type: 'minecraft:model', model: 'minecraft:item/bow_pulling_0' },
      },
    },
  });
  assert.equal(bow.length, 3);
  assert.equal(bow[0].leaves[0].leaf.kind, 'model');
  const bed = itemOptions({
    model: {
      type: 'minecraft:composite',
      models: [
        { type: 'minecraft:model', model: 'minecraft:block/red_bed_head' },
        { type: 'minecraft:model', model: 'minecraft:block/red_bed_foot', transformation: { translation: [0, 0, 1] } },
      ],
    },
  });
  assert.equal(bed.length, 1);
  assert.deepEqual(bed[0].leaves.map((l) => l.offset), [[0, 0, 0], [0, 0, 1]]);
  const chest = itemOptions({
    model: {
      type: 'minecraft:select',
      property: 'minecraft:local_time',
      cases: [{ when: ['12-24', '12-25'], model: { type: 'minecraft:special', base: 'minecraft:item/chest', model: { type: 'minecraft:chest', texture: 'minecraft:christmas' } } }],
      fallback: { type: 'minecraft:special', base: 'minecraft:item/chest', model: { type: 'minecraft:chest', texture: 'minecraft:normal' } },
    },
  });
  assert.equal(chest.length, 2);
  assert.equal(chest[1].label, 'Christmas');
  const tinted = itemOptions({ model: { type: 'minecraft:model', model: 'minecraft:item/potion', tints: [{ type: 'minecraft:potion', default: -13083194 }] } });
  const leaf = tinted[0].leaves[0].leaf;
  assert.ok(leaf.kind === 'model' && leaf.tints[0]?.kind === 'fixed');
  assert.deepEqual(leaf.kind === 'model' && leaf.tints[0]?.kind === 'fixed' ? leaf.tints[0].rgb : null, [0x38, 0x5d, 0xc6]);
});

test('labels: role from the texture name, disambiguated by the state that shows it', () => {
  assert.deepEqual(textureSuffix('furnace', 'furnace_front_on'), ['front', 'on']);
  assert.deepEqual(textureSuffix('oak_stairs', 'oak_planks'), ['planks']);
  assert.equal(textureSuffix('crafting_table', 'oak_planks'), null);
  const all = [
    { facing: 'north', lit: 'false' },
    { facing: 'north', lit: 'true' },
    { facing: 'east', lit: 'false' },
    { facing: 'east', lit: 'true' },
  ];
  const labels = labelTextures(
    'furnace',
    [
      { path: 'x/furnace_front.png', role: 'front', states: [all[0], all[2]] },
      { path: 'x/furnace_front_on.png', role: 'front', states: [all[1], all[3]] },
      { path: 'x/furnace_side.png', role: 'side', states: all },
      { path: 'x/furnace_top.png', role: 'top', states: all },
    ],
    all,
  );
  assert.equal(labels.get('x/furnace_front.png'), 'Front');
  assert.equal(labels.get('x/furnace_front_on.png'), 'Front (lit)');
  assert.equal(labels.get('x/furnace_side.png'), 'Side');
  assert.equal(labels.get('x/furnace_top.png'), 'Top');
  const table = labelTextures('crafting_table', [{ path: 'x/oak_planks.png', role: 'down', states: [{}] }], [{}]);
  assert.equal(table.get('x/oak_planks.png'), 'Bottom');
  const stairs = labelTextures('stone_stairs', [{ path: 'x/stone.png', role: 'top', states: [{}], dirs: ['up', 'down', 'north', 'south', 'east', 'west'] }], [{}]);
  assert.equal(stairs.get('x/stone.png'), 'All sides');
  const door = labelTextures('oak_door', [{ path: 'x/oak_door_top.png', role: 'top', states: [{}] }, { path: 'x/oak_door_bottom.png', role: 'bottom', states: [{}] }], [{}], { halves: true });
  assert.equal(door.get('x/oak_door_top.png'), 'Upper half');
  assert.equal(door.get('x/oak_door_bottom.png'), 'Lower half');
});

test('bedrock helpers: atlas entries, face names, variation labels, .lang files', () => {
  assert.deepEqual(atlasTextures({ textures: 'textures/blocks/stone' }), [{ path: 'textures/blocks/stone' }]);
  assert.deepEqual(atlasTextures({ textures: ['a', { path: 'b', overlay_color: '#79c05a' }] }), [{ path: 'a' }, { path: 'b', overlay: [0x79, 0xc0, 0x5a], tint: undefined }]);
  assert.deepEqual(atlasTextures({ textures: { path: 'c', tint_color: '#208030' } }), [{ path: 'c', overlay: undefined, tint: [0x20, 0x80, 0x30] }]);
  assert.deepEqual(faceNames({ up: 'top', down: 'bottom', side: 'side' }), { up: 'top', down: 'bottom', north: 'side', south: 'side', east: 'side', west: 'side' });
  assert.equal(faceNames('stone')!.east, 'stone');
  assert.deepEqual(distinctLabels(['wool_colored_white', 'wool_colored_light_blue']), ['White', 'Light Blue']);
  assert.deepEqual(distinctLabels(['door_wood_lower', 'door_dark_oak_lower']), ['Wood', 'Dark Oak']);
  assert.deepEqual(parseLang('## comment\ntile.furnace.name=Furnace\t#\nitem.apple.name=Apple\n'), { 'tile.furnace.name': 'Furnace', 'item.apple.name': 'Apple' });
});

test('every baked face of a rotated model still winds counter-clockwise from the front', () => {
  const set = models({ 'assets/minecraft/models/block/cube.json': CUBE, 'assets/minecraft/models/block/t.json': { parent: 'block/cube', textures: Object.fromEntries(DIRS.map((d) => [d, `block/${d}`])) } });
  for (const x of [0, 90, 180, 270])
    for (const y of [0, 90, 180, 270]) {
      for (const q of bakeModel(set.resolve('block/t'), { x, y })) {
        assert.ok(frontFacing(q), `x=${x} y=${y} ${q.dir}`);
        const wd = q.worldDir as Dir;
        assert.ok(DIRS.includes(wd));
      }
    }
});
