/**
 * Models the game draws with its own code: the entity box builder (box UV unwrap, part poses, mirrored
 * boxes, flat parts), and against real game files (TO_FIXTURES) the chest, shulker box, banner, head,
 * decorated pot and bed shapes with their orientation, version-specific texture paths (1.12.2 / 1.20.1 /
 * 26.3), invisible blocks as item icons, entity-drawn items and the 26.3 heavy core's face textures.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAT4_IDENTITY, bakeEntityModel, cube, cubePolygons, mat4Apply, mat4Chain, mat4Rotation, mat4Scale, mat4Translation, poseMatrix, type EntityModel } from '../../src/shared/models/entity-models';
import { CHEST_SINGLE, javaEntityBlock, yRotOf, type EntityTextureSource } from '../../src/shared/models/block-entities';
import { faceTexture, type ResolvedModel } from '../../src/shared/models/java-models';
import { loadModelLibrary, type BakedQuad, type BlockState, type ModelLibrary, type ModelView } from '../../src/shared/models/index';
import { javaJarAssets } from '../tools/models/fixtures';

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
function bounds(qs: BakedQuad[]) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const q of qs) for (const p of q.positions) for (let i = 0; i < 3; i++) (min[i] = Math.min(min[i], p[i])), (max[i] = Math.max(max[i], p[i]));
  return { min, max };
}
const center = (q: BakedQuad) => [0, 1, 2].map((i) => q.positions.reduce((a, p) => a + p[i], 0) / 4);
/** Texture-pixel rectangle a quad shows (for a texture of the given size). */
function uvRect(q: BakedQuad, w: number, h: number) {
  const us = q.uvs.map((u) => (u[0] / 16) * w);
  const vs = q.uvs.map((u) => (u[1] / 16) * h);
  return [Math.min(...us), Math.min(...vs), Math.max(...us), Math.max(...vs)].map((x) => Math.round(x * 1000) / 1000);
}

// ------------------------------------------------------------------------------------------ builder (no fixtures)

test('entity boxes: the standard box UV unwrap of each face', () => {
  const polys = cubePolygons(cube(0, 19, 1, 0, 1, 14, 10, 14));
  const rect = (d: string) => {
    const p = polys.find((x) => x.dir === d)!;
    const us = p.uvs.map((u) => u[0]);
    const vs = p.uvs.map((u) => u[1]);
    return [Math.min(...us), Math.min(...vs), Math.max(...us), Math.max(...vs)];
  };
  // texOffs (0,19), width 14, height 10, depth 14
  assert.deepEqual(rect('down'), [14, 19, 28, 33]);
  assert.deepEqual(rect('up'), [28, 19, 42, 33]);
  assert.deepEqual(rect('west'), [0, 33, 14, 43]);
  assert.deepEqual(rect('north'), [14, 33, 28, 43]);
  assert.deepEqual(rect('east'), [28, 33, 42, 43]);
  assert.deepEqual(rect('south'), [42, 33, 56, 43]);
  // the up face runs its v backwards (the game flips the top of a box)
  const up = polys.find((x) => x.dir === 'up')!;
  const cornerAtMinZ = up.corners.findIndex((c) => c[2] === 1);
  assert.equal(up.uvs[cornerAtMinZ][1], 33);
});

test('entity boxes: baked quads face outwards, in block units, UVs scaled to the texture', () => {
  const model: EntityModel = { texSize: [64, 64], parts: [{ name: 'box', cubes: [cube(0, 0, 0, 0, 0, 16, 16, 16)] }] };
  const quads = bakeEntityModel(model, MAT4_IDENTITY, { texture: 'a.png', role: 'box' });
  assert.equal(quads.length, 6);
  for (const q of quads) {
    const c = center(q);
    // every normal points away from the box centre
    const out = [c[0] - 0.5, c[1] - 0.5, c[2] - 0.5];
    assert.ok(out[0] * q.normal[0] + out[1] * q.normal[1] + out[2] * q.normal[2] > 0.49, `${q.dir} faces out`);
    assert.ok(q.worldDir, 'axis aligned');
    for (const p of q.positions) for (const v of p) assert.ok(v >= 0 && v <= 1);
    for (const u of q.uvs) assert.ok(u[0] >= 0 && u[0] <= 16 && u[1] >= 0 && u[1] <= 16);
  }
  // a box with no depth only keeps its two big faces
  const flat = bakeEntityModel({ texSize: [16, 16], parts: [{ name: 'p', cubes: [cube(0, 0, 0, 0, 0, 14, 16, 0)] }] }, MAT4_IDENTITY, { texture: 'b.png', role: 'p' });
  assert.deepEqual(flat.map((q) => q.worldDir).sort(), ['north', 'south']);
});

test('entity boxes: mirrored boxes swap the side faces, poses rotate Z·Y·X about the offset', () => {
  const plain = cubePolygons(cube(0, 0, 0, 0, 0, 2, 4, 6));
  const mirror = cubePolygons(cube(0, 0, 0, 0, 0, 2, 4, 6, { mirror: true }));
  const rectOf = (ps: typeof plain, d: string) => ps.find((p) => p.dir === d)!.uvs.map((u) => u.join(',')).sort().join(' ');
  // the mirrored box shows the west texture on its east side
  assert.equal(rectOf(mirror, 'east'), rectOf(plain, 'west'));
  // offset in pixels, then rotations: a quarter turn about Y takes +x to -z
  const m = poseMatrix({ offset: [16, 0, 0], rotation: [0, Math.PI / 2, 0] });
  const p = mat4Apply(m, [1, 0, 0]);
  assert.ok(near(p[0], 1) && near(p[2], -1), JSON.stringify(p));
  // the same as the game's pose stack: translate, then rotate
  const q = mat4Apply(mat4Chain(mat4Translation(1, 0, 0), mat4Rotation('y', Math.PI / 2)), [1, 0, 0]);
  assert.deepEqual(p.map((x) => Math.round(x * 1e6) / 1e6), q.map((x) => Math.round(x * 1e6) / 1e6));
  // a turned-over model (scale 1,-1,-1 is a half turn) keeps its faces pointing out
  const quads = bakeEntityModel({ texSize: [64, 64], parts: [{ name: 'b', cubes: [cube(0, 0, -8, -16, -8, 16, 16, 16)] }] }, mat4Chain(mat4Translation(0.5, 0, 0.5), mat4Scale(1, -1, -1)), { texture: 'c.png', role: 'b' });
  for (const qd of quads) {
    const c = center(qd);
    const out = [c[0] - 0.5, c[1] - 0.5, c[2] - 0.5];
    assert.ok(out[0] * qd.normal[0] + out[1] * qd.normal[1] + out[2] * qd.normal[2] > 0.49);
  }
});

test('chest model (no fixtures): single chest 14x14 wide, 14 high, lock on the facing side', () => {
  const src: EntityTextureSource = { edition: 'java', find: (...r) => `assets/minecraft/textures/${r[0]}.png`, path: (r) => `assets/minecraft/textures/${r}.png` };
  const chest = javaEntityBlock('chest', { src, hasProperty: () => true, legacy: false })!;
  for (const facing of ['north', 'south', 'west', 'east']) {
    const qs = chest.quads({ facing, type: 'single' });
    const b = bounds(qs);
    const across = facing === 'north' || facing === 'south' ? 0 : 2;
    assert.ok(near(b.min[across], 1 / 16) && near(b.max[across], 15 / 16) && near(b.min[1], 0) && near(b.max[1], 14 / 16), facing);
    // the lock is the only part sticking out past 15/16 (or before 1/16)
    const lock = bounds(qs.filter((q) => q.positions.some((p) => p.some((v, i) => i !== 1 && (v < 1 / 16 - 1e-6 || v > 15 / 16 + 1e-6)))));
    const mid = [(lock.min[0] + lock.max[0]) / 2, (lock.min[2] + lock.max[2]) / 2];
    const dir = { north: [0.5, 0], south: [0.5, 1], west: [0, 0.5], east: [1, 0.5] }[facing]!;
    assert.ok(Math.abs(mid[0] - dir[0]) < 0.1 && Math.abs(mid[1] - dir[1]) < 0.1, `${facing}: lock at ${mid}`);
  }
  assert.equal(yRotOf('east'), 270);
  assert.equal(CHEST_SINGLE.texSize[0], 64);
});

test('face textures name texture variables with or without # (heavy core model)', () => {
  const model: ResolvedModel = { id: 'minecraft:block/heavy_core', chain: [], textures: { all: 'block/heavy_core', particle: 'block/heavy_core' }, translucent: [], elements: [], builtin: null, ambientOcclusion: true, missing: [] };
  assert.deepEqual(faceTexture(model, 'all', 'north'), { ref: 'block/heavy_core', role: 'all' });
  assert.deepEqual(faceTexture(model, '#all', 'north'), { ref: 'block/heavy_core', role: 'all' });
  // a value that isn't a variable is not a texture path: the game shows its missing texture
  assert.equal(faceTexture(model, 'block/stone', 'north').ref, null);
});

// ------------------------------------------------------------------------------------------ real game files

const SKIP = (v: string) => `Minecraft ${v} jar not found (set TO_FIXTURES to a folder with research-cache/jars/${v}.jar)`;
const has = (v: string) => !!javaJarAssets(v);
const libs = new Map<string, Promise<ModelLibrary>>();
const lib = (v: string) => {
  let p = libs.get(v);
  if (!p) libs.set(v, (p = loadModelLibrary(javaJarAssets(v)!)));
  return p;
};
async function view(v: string, id: string, state: BlockState = {}): Promise<ModelView> {
  const l = await lib(v);
  const e = l.block(id);
  assert.ok(e, `${id} is listed in ${v}`);
  return l.resolve(e, { ...l.defaultState(e), ...state });
}
const tex = (p: string | null) => (p ? p.replace(/^assets\/minecraft\/textures\//, '').replace(/\.png$/, '') : null);
const texs = (v: ModelView) => [...new Set(v.quads.map((q) => tex(q.texture)))].sort();

test('26.3: every entity-drawn block has its shape; only invisible blocks are icons', { skip: !has('26.3') && SKIP('26.3') }, async () => {
  const l = await lib('26.3');
  const flat: string[] = [];
  const icons: string[] = [];
  for (const e of l.blocks()) {
    const v = l.resolve(e);
    if (v.shape === 'special') flat.push(e.id);
    if (v.shape === 'sprite') icons.push(e.id);
  }
  assert.deepEqual(flat, []);
  assert.deepEqual(icons.sort(), ['barrier', 'light', 'structure_void']);
  const light = await view('26.3', 'light', { level: '7' });
  assert.deepEqual(light.sprite.map((s) => tex(s.path)), ['item/light_07']);
  assert.match(light.note ?? '', /Invisible/);
  assert.ok(!l.block('skull'), 'no pre-1.13 skull block in 26.3');
});

test('26.3: chest types: single, and both halves of a double chest with their own textures', { skip: !has('26.3') && SKIP('26.3') }, async () => {
  const single = await view('26.3', 'chest', { facing: 'north', type: 'single' });
  assert.deepEqual(texs(single), ['entity/chest/normal']);
  assert.equal(single.textures.find((t) => t.faces > 0)?.label, 'Chest');
  const left = await view('26.3', 'chest', { facing: 'north', type: 'left' });
  assert.deepEqual(texs(left), ['entity/chest/normal_left', 'entity/chest/normal_right']);
  // facing north the right half sits to the west... the left half's partner is clockwise: east
  const b = bounds(left.quads);
  assert.ok(near(b.min[0], 1 / 16) && near(b.max[0], 2 - 1 / 16), JSON.stringify(b));
  const rightHalf = bounds(left.quads.filter((q) => q.texture?.endsWith('normal_right.png')));
  assert.ok(rightHalf.min[0] >= 1 - 1e-6, 'right half on the east block');
  const labels = Object.fromEntries(left.textures.map((t) => [tex(t.path), t.label]));
  assert.equal(labels['entity/chest/normal_left'], 'Left half');
  assert.equal(labels['entity/chest/normal_right'], 'Right half');
  const copper = await view('26.3', 'waxed_weathered_copper_chest');
  assert.deepEqual(texs(copper), ['entity/chest/copper_weathered']);
  assert.deepEqual(texs(await view('26.3', 'ender_chest')), ['entity/chest/ender']);
});

test('26.3: shulker box turns with its facing (lid first)', { skip: !has('26.3') && SKIP('26.3') }, async () => {
  const lidOf = (v: ModelView) => v.quads.filter((q) => uvRect(q, 64, 64)[3] <= 28 + 1e-6);
  const up = await view('26.3', 'red_shulker_box', { facing: 'up' });
  assert.deepEqual(texs(up), ['entity/shulker/shulker_red']);
  const b = bounds(up.quads);
  assert.ok(b.min[1] > -0.001 && b.max[1] < 1.001 && b.max[1] > 0.99);
  assert.ok(bounds(lidOf(up)).max[1] > 0.99 && bounds(lidOf(up)).min[1] > 0.2, 'lid on top');
  const north = await view('26.3', 'red_shulker_box', { facing: 'north' });
  assert.ok(bounds(lidOf(north)).min[2] < 0.01 && bounds(lidOf(north)).max[2] < 0.8, 'lid toward north');
  assert.deepEqual(texs(await view('26.3', 'shulker_box')), ['entity/shulker/shulker']);
});

test('26.3: banners: pole, bar and flag, flag coloured by the dye through the colour mask, rotations', { skip: !has('26.3') && SKIP('26.3') }, async () => {
  const v = await view('26.3', 'red_banner', { rotation: '8' });
  assert.deepEqual(texs(v), ['entity/banner/banner_base', 'entity/banner/base']);
  const mask = v.quads.filter((q) => q.texture?.endsWith('banner/base.png'));
  assert.ok(mask.length >= 2 && mask.every((q) => q.tint?.kind === 'fixed' && q.tint.rgb.join() === '176,46,38'), 'red dye colour');
  const b = bounds(v.quads);
  assert.ok(near(b.max[1], 44 * (2 / 3) / 16, 1e-3), `pole and bar reach ${b.max[1]}`);
  // rotation 8 turns the flag's front to the north
  const front = mask.reduce((a, q) => (Math.abs(q.normal[2]) > Math.abs(a.normal[2]) && q.normal[2] < 0 ? q : a), mask[0]);
  assert.ok(front.normal[2] < -0.99);
  const wall = await view('26.3', 'blue_wall_banner', { facing: 'north' });
  const wb = bounds(wall.quads);
  assert.ok(wb.max[2] > 0.95 && wb.min[2] > 0.8 && wb.min[1] < -0.5, `wall banner hangs on the south wall: ${JSON.stringify(wb)}`);
  const labels = Object.fromEntries(v.textures.map((t) => [tex(t.path), t.label]));
  assert.equal(labels['entity/banner/banner_base'], 'Banner');
  assert.equal(labels['entity/banner/base'], 'Colour mask');
});

test('26.3: heads: floor rotation and wall facing, humanoid hat layer, piglin ears, dragon jaw', { skip: !has('26.3') && SKIP('26.3') }, async () => {
  const face = (v: ModelView) => v.quads.find((q) => { const r = uvRect(q, 64, v.quads.some((x) => x.texture?.endsWith('skeleton.png')) ? 32 : 64); return r[0] === 8 && r[1] === 8 && r[2] === 16 && r[3] === 16; })!;
  const skull = await view('26.3', 'skeleton_skull', { rotation: '0' });
  assert.deepEqual(texs(skull), ['entity/skeleton/skeleton']);
  assert.ok(face(skull).normal[2] < -0.99, 'rotation 0 looks north');
  const turned = await view('26.3', 'skeleton_skull', { rotation: '4' });
  assert.ok(face(turned).normal[0] > 0.99, 'rotation 4 looks east');
  const wall = await view('26.3', 'skeleton_wall_skull', { facing: 'east' });
  const wb = bounds(wall.quads);
  assert.ok(near(wb.min[0], 0) && near(wb.max[0], 0.5) && near(wb.min[1], 0.25), `on the west wall: ${JSON.stringify(wb)}`);
  assert.ok(face(wall).normal[0] > 0.99);
  const player = await view('26.3', 'player_head');
  assert.equal(player.quads.length, 12, 'head and hat');
  assert.deepEqual(texs(player), ['entity/player/wide/steve']);
  const piglin = await view('26.3', 'piglin_head');
  assert.ok(bounds(piglin.quads).max[0] - bounds(piglin.quads).min[0] > 10 / 16, 'ears stick out');
  assert.deepEqual(texs(await view('26.3', 'dragon_head')), ['entity/enderdragon/dragon']);
});

test('26.3: decorated pot, conduit, bell body, books, copper golem statue poses, end portal', { skip: !has('26.3') && SKIP('26.3') }, async () => {
  const pot = await view('26.3', 'decorated_pot');
  assert.deepEqual(texs(pot), ['entity/decorated_pot/decorated_pot_base', 'entity/decorated_pot/decorated_pot_side']);
  assert.equal(pot.quads.filter((q) => q.texture?.endsWith('side.png')).length, 4, 'four sherd sides');
  const pb = bounds(pot.quads);
  assert.ok(near(pb.min[1], 0) && near(pb.max[1], 19.9 / 16) && near(pb.min[0], 1 / 16), JSON.stringify(pb));
  assert.deepEqual(texs(await view('26.3', 'conduit')), ['entity/conduit/base']);
  const bell = await view('26.3', 'bell');
  assert.ok(bell.textures.some((t) => tex(t.path) === 'entity/bell/bell_body' && t.label === 'Bell'));
  assert.ok(bell.quads.some((q) => q.texture?.endsWith('dark_oak_planks.png')), 'with its frame');
  const table = await view('26.3', 'enchanting_table');
  assert.ok(table.quads.some((q) => q.texture?.endsWith('entity/enchantment/enchanting_table_book.png')));
  assert.ok(bounds(table.quads).max[1] > 0.9, 'the book floats above the table');
  const lectern = await view('26.3', 'lectern', { has_book: 'false' });
  assert.ok(!lectern.quads.some((q) => q.texture?.includes('book')));
  assert.ok((await view('26.3', 'lectern', { has_book: 'true' })).quads.some((q) => q.texture?.includes('book')));
  for (const pose of ['standing', 'sitting', 'running', 'star']) {
    const g = await view('26.3', 'oxidized_copper_golem_statue', { copper_golem_pose: pose });
    assert.deepEqual(texs(g), ['entity/copper_golem/copper_golem_oxidized'], pose);
    const b = bounds(g.quads);
    assert.ok(b.min[1] > -0.1 && b.max[1] > 0.9, `${pose} stands on the floor: ${JSON.stringify(b)}`);
  }
  const portal = await view('26.3', 'end_portal');
  assert.deepEqual(portal.quads.map((q) => q.worldDir).sort(), ['down', 'up']);
  assert.deepEqual(texs(portal), ['entity/end_portal/end_portal']);
});

test('26.3: heavy core faces use its texture (face textures without #)', { skip: !has('26.3') && SKIP('26.3') }, async () => {
  const v = await view('26.3', 'heavy_core');
  assert.deepEqual(texs(v), ['block/heavy_core']);
  assert.ok(v.textures.every((t) => !t.missing));
});

test('26.3: entity-drawn items show their model', { skip: !has('26.3') && SKIP('26.3') }, async () => {
  const l = await lib('26.3');
  for (const [id, t] of [
    ['chest', 'entity/chest/normal'],
    ['white_banner', 'entity/banner/banner_base'],
    ['shield', 'entity/shield/shield_base_nopattern'],
    ['trident', 'entity/trident/trident'],
    ['player_head', 'entity/player/wide/steve'],
    ['decorated_pot', 'entity/decorated_pot/decorated_pot_base'],
    ['red_shulker_box', 'entity/shulker/shulker_red'],
    ['copper_golem_statue', 'entity/copper_golem/copper_golem'],
  ]) {
    const v = l.resolve(l.item(id)!);
    assert.equal(v.shape, 'model', id);
    assert.ok(v.quads.some((q) => tex(q.texture) === t), `${id}: ${texs(v)}`);
  }
});

test('1.20.1: signs, hanging signs and beds are entity models before 26.2', { skip: !has('1.20.1') && SKIP('1.20.1') }, async () => {
  const sign = await view('1.20.1', 'oak_sign', { rotation: '0' });
  assert.deepEqual(texs(sign), ['entity/signs/oak']);
  assert.ok(bounds(sign.quads).max[1] > 1, 'board above the stick');
  const wall = await view('1.20.1', 'spruce_wall_sign', { facing: 'north' });
  assert.ok(bounds(wall.quads).min[2] > 0.8, 'wall sign on the south wall');
  const hanging = await view('1.20.1', 'oak_hanging_sign', { attached: 'true' });
  assert.deepEqual(texs(hanging), ['entity/signs/hanging/oak']);
  const bed = await view('1.20.1', 'blue_bed', { facing: 'east' });
  assert.deepEqual(texs(bed), ['entity/bed/blue']);
  const b = bounds(bed.quads);
  assert.ok(near(b.min[0], 0) && near(b.max[0], 2) && near(b.max[1], 9 / 16), `head east of the foot: ${JSON.stringify(b)}`);
  assert.deepEqual(texs(await view('1.20.1', 'player_head')), ['entity/player/wide/steve']);
});

test('1.12.2: chest, bed, sign, banner, skull and shulker box blocks the game has no blockstate for', { skip: !has('1.12.2') && SKIP('1.12.2') }, async () => {
  const l = await lib('1.12.2');
  for (const id of ['chest', 'trapped_chest', 'ender_chest', 'bed', 'standing_sign', 'wall_sign', 'skull', 'standing_banner', 'wall_banner', 'white_shulker_box', 'silver_shulker_box', 'end_portal', 'end_gateway', 'barrier']) assert.ok(l.block(id), id);
  const single = await view('1.12.2', 'chest', { facing: 'north', type: 'single' });
  assert.deepEqual(texs(single), ['entity/chest/normal']);
  const sb = bounds(single.quads);
  assert.ok(near(sb.min[0], 1 / 16) && near(sb.max[1], 14 / 16));
  assert.ok(bounds(single.quads.filter((q) => q.positions.every((p) => p[2] < 1 / 16 + 1e-6))).max[2] <= 1 / 16 + 1e-6, 'lock on the north side');
  const dbl = await view('1.12.2', 'chest', { facing: 'north', type: 'double' });
  assert.deepEqual(texs(dbl), ['entity/chest/normal_double']);
  assert.ok(near(bounds(dbl.quads).max[0] - bounds(dbl.quads).min[0], 30 / 16));
  assert.deepEqual(texs(await view('1.12.2', 'skull', { type: 'wither_skeleton' })), ['entity/skeleton/wither_skeleton']);
  assert.deepEqual(texs(await view('1.12.2', 'skull', { type: 'player' })), ['entity/steve']);
  assert.deepEqual(texs(await view('1.12.2', 'bed', { color: 'light_gray' })), ['entity/bed/silver']);
  assert.deepEqual(texs(await view('1.12.2', 'silver_shulker_box')), ['entity/shulker/shulker_silver']);
  assert.deepEqual(texs(await view('1.12.2', 'wall_banner', { color: 'green' })), ['entity/banner/base', 'entity/banner_base']);
  assert.deepEqual(texs(await view('1.12.2', 'standing_sign')), ['entity/sign']);
  const icon = await view('1.12.2', 'barrier');
  assert.equal(icon.shape, 'sprite');
  assert.deepEqual(icon.sprite.map((s) => tex(s.path)), ['items/barrier']);
  const shield = l.resolve(l.item('shield')!);
  assert.equal(shield.shape, 'model');
  assert.deepEqual(texs(shield), ['entity/shield_base_nopattern']);
});
