/**
 * Model library against real Minecraft Java jars (TO_FIXTURES): 26.3, 1.20.1 and 1.12.2 (pre-flattening),
 * plus 1.8.9 and 1.6.1 when present. Checks that blocks resolve to the textures the game puts on each face:
 * crafting / cartography tables, lit furnaces, stairs, slabs, torches, flowers, doors, fences, grass
 * block overlays and tints, redstone wire, observers, chests (drawn by the game's code) and items.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModelLibrary, type ModelLibrary, type ModelView, type BakedQuad, type BlockState } from '../../src/shared/models/index';
import { javaJarAssets } from '../tools/models/fixtures';

const SKIP = (v: string) => `Minecraft ${v} jar not found (set TO_FIXTURES to a folder with research-cache/jars/${v}.jar)`;
const libs = new Map<string, Promise<ModelLibrary>>();
function lib(v: string): Promise<ModelLibrary> {
  let p = libs.get(v);
  if (!p) {
    p = loadModelLibrary(javaJarAssets(v)!);
    libs.set(v, p);
  }
  return p;
}
const has = (v: string) => !!javaJarAssets(v);

async function view(v: string, id: string, state: BlockState = {}): Promise<ModelView> {
  const l = await lib(v);
  const e = l.block(id);
  assert.ok(e, `${id} is listed in ${v}`);
  return l.resolve(e, { ...l.defaultState(e), ...state });
}

const tex = (p: string | null) => (p ? p.replace(/^assets\/minecraft\/textures\//, '').replace(/\.png$/, '') : null);
/** texture per axis-aligned face direction of a single-element cube */
function faceMap(v: ModelView): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const q of v.quads) if (q.worldDir && !(q.worldDir in out)) out[q.worldDir] = tex(q.texture);
  return out;
}
function bounds(qs: BakedQuad[]) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const q of qs) for (const p of q.positions) for (let i = 0; i < 3; i++) (min[i] = Math.min(min[i], p[i])), (max[i] = Math.max(max[i], p[i]));
  return { min, max };
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const label = (v: ModelView, texture: string) => v.textures.find((t) => tex(t.path) === texture)?.label;

// ------------------------------------------------------------------------------------------ 26.3

const V = '26.3';

test('26.3: library lists blocks with game names and items', { skip: !has(V) && SKIP(V) }, async () => {
  const l = await lib(V);
  assert.ok(l.blocks().length > 1200, `${l.blocks().length} blocks`);
  assert.ok(l.items().length > 1500, `${l.items().length} items`);
  assert.equal(l.block('furnace')?.name, 'Furnace');
  assert.equal(l.block('wall_torch')?.name, 'Wall Torch');
  assert.ok(!l.block('air'), 'air is not a block to paint');
});

test('26.3: crafting table has distinct front, side, top and an oak planks bottom', { skip: !has(V) && SKIP(V) }, async () => {
  const v = await view(V, 'crafting_table');
  assert.equal(v.shape, 'model');
  assert.equal(v.category, 'cube');
  assert.deepEqual(faceMap(v), {
    down: 'block/oak_planks',
    up: 'block/crafting_table_top',
    north: 'block/crafting_table_front',
    south: 'block/crafting_table_side',
    west: 'block/crafting_table_front',
    east: 'block/crafting_table_side',
  });
  assert.deepEqual(v.textures.map((t) => t.label), ['Front', 'Top', 'Side', 'Bottom']);
});

test('26.3: cartography table uses a different texture on every side', { skip: !has(V) && SKIP(V) }, async () => {
  const v = await view(V, 'cartography_table');
  const f = faceMap(v);
  assert.deepEqual(f, {
    down: 'block/dark_oak_planks',
    up: 'block/cartography_table_top',
    north: 'block/cartography_table_side3',
    south: 'block/cartography_table_side1',
    west: 'block/cartography_table_side2',
    east: 'block/cartography_table_side3',
  });
  assert.equal(new Set(Object.values(f)).size, 5);
  assert.equal(label(v, 'block/cartography_table_side2'), 'Side 2');
});

test('26.3: furnace lit=false shows furnace_front, lit=true furnace_front_on, facing turns it', { skip: !has(V) && SKIP(V) }, async () => {
  const l = await lib(V);
  const e = l.block('furnace')!;
  const props = l.properties(e);
  assert.deepEqual(props.find((p) => p.name === 'lit')?.values.map((x) => x.label), ['Off', 'On']);
  assert.deepEqual(l.defaultState(e), { facing: 'north', lit: 'false' });
  const off = l.resolve(e, { facing: 'north', lit: 'false' });
  const on = l.resolve(e, { facing: 'north', lit: 'true' });
  assert.equal(faceMap(off).north, 'block/furnace_front');
  assert.equal(faceMap(on).north, 'block/furnace_front_on');
  assert.equal(faceMap(off).up, 'block/furnace_top');
  assert.equal(faceMap(off).down, 'block/furnace_top');
  assert.equal(faceMap(off).east, 'block/furnace_side');
  const east = l.resolve(e, { facing: 'east', lit: 'true' });
  assert.equal(faceMap(east).east, 'block/furnace_front_on');
  assert.equal(faceMap(east).north, 'block/furnace_side');
  // every texture of the block is listed, the other state's front labelled with its state
  assert.equal(label(off, 'block/furnace_front'), 'Front');
  assert.equal(label(off, 'block/furnace_front_on'), 'Front (lit)');
  const other = off.textures.find((t) => tex(t.path) === 'block/furnace_front_on')!;
  assert.equal(other.faces, 0);
  assert.deepEqual(other.state, { facing: 'north', lit: 'true' }, 'switching keeps the current facing');
});

test('26.3: stairs are two boxes whose tall part faces the facing direction', { skip: !has(V) && SKIP(V) }, async () => {
  const north = await view(V, 'oak_stairs', { facing: 'north', half: 'bottom', shape: 'straight' });
  assert.equal(north.category, 'shape');
  const tall = north.quads.filter((q) => q.part === 0 && q.element === 1);
  assert.ok(tall.length >= 4);
  const tb = bounds(tall);
  assert.ok(near(tb.min[2], 0) && near(tb.max[2], 0.5), `tall part on the north half: ${JSON.stringify(tb)}`);
  assert.ok(near(tb.min[1], 0.5) && near(tb.max[1], 1));
  const top = await view(V, 'oak_stairs', { facing: 'north', half: 'top', shape: 'straight' });
  const low = bounds(top.quads.filter((q) => q.element === 0));
  assert.ok(near(low.min[1], 0.5) && near(low.max[1], 1), 'upside-down stairs have the slab on top');
  assert.equal(north.textures[0].label, 'Planks');
  // slabs
  assert.ok(near(bounds((await view(V, 'oak_slab', { type: 'bottom' })).quads).max[1], 0.5));
  assert.ok(near(bounds((await view(V, 'oak_slab', { type: 'top' })).quads).min[1], 0.5));
  assert.equal((await view(V, 'oak_slab', { type: 'double' })).category, 'cube');
});

test('26.3: torch is a thin post, wall torch leans away from its wall', { skip: !has(V) && SKIP(V) }, async () => {
  const t = await view(V, 'torch');
  const b = bounds(t.quads);
  assert.ok(near(b.min[0], 7 / 16) && near(b.max[0], 9 / 16) && near(b.max[1], 10 / 16), JSON.stringify(b));
  assert.equal(t.textures[0].label, 'Torch');
  const w = await view(V, 'wall_torch', { facing: 'north' });
  const pts = w.quads.flatMap((q) => q.positions);
  const high = pts.filter((p) => p[1] > 0.8);
  const low = pts.filter((p) => p[1] < 0.3);
  const avgZ = (ps: number[][]) => ps.reduce((a, p) => a + p[2], 0) / ps.length;
  assert.ok(avgZ(high) < avgZ(low), 'facing north: the flame end leans north, the base sits on the south wall');
  assert.ok(avgZ(low) > 0.8);
});

test('26.3: flowers are crossed planes (plants)', { skip: !has(V) && SKIP(V) }, async () => {
  const v = await view(V, 'poppy');
  assert.equal(v.category, 'plant');
  assert.equal(v.quads.length, 4);
  assert.ok(v.quads.every((q) => q.worldDir === null && q.texture?.endsWith('block/poppy.png')));
  assert.equal(v.textures[0].label, 'Plant');
});

test('26.3: doors show both halves; the half property is not a choice', { skip: !has(V) && SKIP(V) }, async () => {
  const l = await lib(V);
  const e = l.block('oak_door')!;
  assert.ok(!l.properties(e).some((p) => p.name === 'half'));
  const v = l.resolve(e);
  const b = bounds(v.quads);
  assert.ok(near(b.min[1], 0) && near(b.max[1], 2));
  for (const q of v.quads) {
    const y = q.positions.reduce((a, p) => a + p[1], 0) / 4;
    if (y < 0.9) assert.ok(q.texture?.endsWith('oak_door_bottom.png'), `${q.texture} at y ${y}`);
    if (y > 1.1) assert.ok(q.texture?.endsWith('oak_door_top.png'), `${q.texture} at y ${y}`);
  }
  assert.equal(label(v, 'block/oak_door_bottom'), 'Lower half');
  assert.equal(label(v, 'block/oak_door_top'), 'Upper half');
  const open = l.resolve(e, { ...l.defaultState(e), open: 'true' });
  assert.notDeepEqual(bounds(open.quads), b, 'an open door swings');
});

test('26.3: fences are multipart: a post plus one arm per connection', { skip: !has(V) && SKIP(V) }, async () => {
  const post = await view(V, 'oak_fence', { north: 'false', east: 'false', south: 'false', west: 'false' });
  const pb = bounds(post.quads);
  assert.ok(near(pb.min[0], 6 / 16) && near(pb.max[0], 10 / 16) && near(pb.min[2], 6 / 16));
  const line = await view(V, 'oak_fence');
  const lb = bounds(line.quads);
  assert.ok(near(lb.min[2], 0) && near(lb.max[2], 1), 'default connects north and south');
  const all = await view(V, 'oak_fence', { north: 'true', east: 'true', south: 'true', west: 'true' });
  assert.ok(all.quads.length > line.quads.length);
  assert.ok(near(bounds(all.quads).min[0], 0) && near(bounds(all.quads).max[0], 1));
});

test('26.3: grass block: tinted top, tinted side overlay on the side, dirt bottom', { skip: !has(V) && SKIP(V) }, async () => {
  const v = await view(V, 'grass_block', { snowy: 'false' });
  assert.equal(v.quads.length, 10);
  const top = v.quads.find((q) => q.worldDir === 'up')!;
  assert.equal(tex(top.texture), 'block/grass_block_top');
  assert.equal(top.tintindex, 0);
  assert.deepEqual(top.tint, { kind: 'grass' });
  const overlays = v.quads.filter((q) => q.texture?.endsWith('grass_block_side_overlay.png'));
  assert.equal(overlays.length, 4);
  assert.ok(overlays.every((q) => q.tint?.kind === 'grass'));
  const sides = v.quads.filter((q) => q.texture?.endsWith('grass_block_side.png'));
  assert.ok(sides.every((q) => q.tintindex < 0));
  assert.equal(tex(v.quads.find((q) => q.worldDir === 'down')!.texture), 'block/dirt');
  assert.equal(label(v, 'block/grass_block_side_overlay'), 'Side Overlay');
  const snowy = await view(V, 'grass_block', { snowy: 'true' });
  assert.ok(snowy.quads.some((q) => q.texture?.endsWith('grass_block_snow.png')));
});

test('26.3: redstone wire is multipart: a dot alone, lines when connected, tinted red', { skip: !has(V) && SKIP(V) }, async () => {
  const dot = await view(V, 'redstone_wire', { north: 'none', east: 'none', south: 'none', west: 'none' });
  assert.ok(dot.quads.some((q) => q.texture?.endsWith('redstone_dust_dot.png')));
  const line = await view(V, 'redstone_wire', { north: 'side', east: 'none', south: 'side', west: 'none' });
  assert.ok(line.quads.some((q) => /redstone_dust_line[01]\.png$/.test(q.texture ?? '')));
  assert.ok(!line.quads.some((q) => q.texture?.endsWith('redstone_dust_dot.png')));
  const up = await view(V, 'redstone_wire', { north: 'up', east: 'none', south: 'side', west: 'none' });
  assert.ok(bounds(up.quads).max[1] > 0.9, 'climbing the wall');
  const tinted = line.quads.find((q) => q.tintindex === 0)!;
  assert.equal(tinted.tint?.kind, 'fixed');
});

test('26.3: observer: front north by default, back lights up when powered, facing up turns it', { skip: !has(V) && SKIP(V) }, async () => {
  const v = await view(V, 'observer');
  const f = faceMap(v);
  assert.equal(f.north, 'block/observer_front');
  assert.equal(f.south, 'block/observer_back');
  assert.equal(f.up, 'block/observer_top');
  const on = await view(V, 'observer', { powered: 'true' });
  assert.equal(faceMap(on).south, 'block/observer_back_on');
  assert.equal(label(v, 'block/observer_back_on'), 'Back (powered)');
  const up = await view(V, 'observer', { facing: 'up' });
  assert.equal(faceMap(up).up, 'block/observer_front');
});

test('26.3: chest, banners and heads are drawn by the game: flat texture sheet with a note', { skip: !has(V) && SKIP(V) }, async () => {
  const chest = await view(V, 'chest');
  assert.equal(chest.shape, 'special');
  assert.equal(chest.category, 'special');
  assert.deepEqual(chest.sprite.map((s) => tex(s.path)), ['entity/chest/normal']);
  assert.ok(chest.note && /own code/.test(chest.note));
  assert.deepEqual((await view(V, 'ender_chest')).sprite.map((s) => tex(s.path)), ['entity/chest/ender']);
  assert.deepEqual((await view(V, 'red_banner')).sprite.map((s) => tex(s.path)), ['entity/banner/banner_base']);
  assert.deepEqual((await view(V, 'zombie_head')).sprite.map((s) => tex(s.path)), ['entity/zombie/zombie']);
  const water = await view(V, 'water');
  assert.equal(water.shape, 'model');
  assert.ok(water.quads.every((q) => q.tint?.kind === 'water'));
});

test('26.3: beds are block models since 26.2 (both parts shown)', { skip: !has(V) && SKIP(V) }, async () => {
  const bed = await view(V, 'red_bed', { facing: 'north' });
  assert.equal(bed.shape, 'model');
  const b = bounds(bed.quads);
  assert.ok(near(b.min[2], -1) && near(b.max[2], 1), `head in front of the foot: ${JSON.stringify(b)}`);
  assert.ok(bed.textures.some((t) => tex(t.path) === 'block/red_bed_head_up'));
});

test('26.3: texture usage index (texture -> blocks and items)', { skip: !has(V) && SKIP(V) }, async () => {
  const l = await lib(V);
  const u = l.usage();
  const on = u.get('assets/minecraft/textures/block/furnace_front_on.png')!;
  assert.deepEqual(on.blocks, ['furnace']);
  const top = u.get('assets/minecraft/textures/block/furnace_top.png')!;
  assert.equal(top.blocks[0], 'furnace');
  const planks = u.get('assets/minecraft/textures/block/oak_planks.png')!;
  assert.equal(planks.blocks[0], 'oak_planks');
  for (const id of ['crafting_table', 'oak_stairs', 'oak_fence', 'oak_slab']) assert.ok(planks.blocks.includes(id), id);
  assert.ok(planks.items.includes('oak_planks'));
  assert.ok(u.get('assets/minecraft/textures/entity/chest/normal.png')?.blocks.includes('chest'));
  assert.ok(u.get('assets/minecraft/textures/item/diamond_sword.png')?.items.includes('diamond_sword'));
});

test('26.3: items: generated sprites, block items, special items, several looks', { skip: !has(V) && SKIP(V) }, async () => {
  const l = await lib(V);
  const sword = l.resolve(l.item('diamond_sword')!);
  assert.equal(sword.shape, 'sprite');
  assert.deepEqual(sword.sprite.map((s) => tex(s.path)), ['item/diamond_sword']);
  const furnace = l.resolve(l.item('furnace')!);
  assert.equal(furnace.shape, 'model');
  assert.equal(faceMap(furnace).north, 'block/furnace_front');
  const chest = l.resolve(l.item('chest')!);
  assert.equal(chest.shape, 'special');
  assert.deepEqual(chest.sprite.map((s) => tex(s.path)), ['entity/chest/normal']);
  const bow = l.properties(l.item('bow')!);
  assert.equal(bow[0]?.values.length, 4, 'bow: standby and three pulling stages');
  const helmet = l.resolve(l.item('leather_helmet')!);
  assert.equal(helmet.shape, 'sprite');
  assert.ok(helmet.sprite[0].tint?.kind === 'fixed', 'dyed layer uses the default leather colour');
  const bed = l.resolve(l.item('red_bed')!);
  assert.equal(bed.shape, 'model');
  assert.ok(bounds(bed.quads).max[2] > 1.5, 'bed item draws head and foot');
});

// ------------------------------------------------------------------------------------------ 1.20.1

const M = '1.20.1';

test('1.20.1: tables, furnace, stairs and entity-drawn beds, signs and chests', { skip: !has(M) && SKIP(M) }, async () => {
  const table = await view(M, 'crafting_table');
  assert.equal(faceMap(table).north, 'block/crafting_table_front');
  assert.equal(faceMap(table).down, 'block/oak_planks');
  const cart = await view(M, 'cartography_table');
  assert.equal(new Set(Object.values(faceMap(cart))).size, 5);
  assert.equal(faceMap(await view(M, 'furnace', { lit: 'true' })).north, 'block/furnace_front_on');
  const bed = await view(M, 'red_bed');
  assert.equal(bed.shape, 'special');
  assert.deepEqual(bed.sprite.map((s) => tex(s.path)), ['entity/bed/red']);
  assert.deepEqual((await view(M, 'oak_sign')).sprite.map((s) => tex(s.path)), ['entity/signs/oak']);
  assert.equal((await view(M, 'chest')).shape, 'special');
  const door = await view(M, 'oak_door');
  assert.ok(near(bounds(door.quads).max[1], 2));
  const fence = await view(M, 'oak_fence');
  assert.ok(near(bounds(fence.quads).min[2], 0));
  const grass = await view(M, 'grass_block');
  assert.ok(grass.quads.some((q) => q.tint?.kind === 'grass'));
});

// ------------------------------------------------------------------------------------------ 1.12.2

const L = '1.12.2';

test('1.12.2: pre-flattening names: blocks/ textures, "normal" variants, lit furnace merged as a state', { skip: !has(L) && SKIP(L) }, async () => {
  const l = await lib(L);
  assert.ok(!l.block('lit_furnace'), 'lit_furnace is a state of Furnace');
  const e = l.block('furnace')!;
  assert.ok(l.properties(e).some((p) => p.name === 'lit'));
  assert.equal(faceMap(l.resolve(e, { facing: 'north', lit: 'false' })).north, 'blocks/furnace_front_off');
  assert.equal(faceMap(l.resolve(e, { facing: 'north', lit: 'true' })).north, 'blocks/furnace_front_on');
  const table = await view(L, 'crafting_table');
  assert.deepEqual(faceMap(table), {
    down: 'blocks/planks_oak',
    up: 'blocks/crafting_table_top',
    north: 'blocks/crafting_table_front',
    south: 'blocks/crafting_table_side',
    west: 'blocks/crafting_table_front',
    east: 'blocks/crafting_table_side',
  });
  assert.equal(l.block('crafting_table')?.name, 'Crafting Table');
});

test('1.12.2: stairs, torch, flower, door, fence, grass, redstone, observer, chest', { skip: !has(L) && SKIP(L) }, async () => {
  const stairs = await view(L, 'oak_stairs', { facing: 'north' });
  const tall = bounds(stairs.quads.filter((q) => q.element === 1));
  assert.ok(near(tall.max[2], 0.5));
  const torch = await view(L, 'torch');
  assert.equal(torch.state.facing, 'up', 'the standing torch');
  // before 1.13 the standing torch is a 10px post plus two full-height planes
  assert.ok(near(bounds(torch.quads.filter((q) => q.element === 0)).max[1], 10 / 16));
  assert.ok(torch.quads.every((q) => q.texture?.endsWith('blocks/torch_on.png')));
  const poppy = await view(L, 'poppy');
  assert.ok(poppy.quads.every((q) => q.texture?.endsWith('blocks/flower_rose.png') && q.worldDir === null));
  const door = await view(L, 'wooden_door');
  assert.ok(near(bounds(door.quads).max[1], 2));
  assert.equal(label(door, 'blocks/door_wood_upper'), 'Upper half');
  const fence = await view(L, 'fence');
  assert.ok(near(bounds(fence.quads).min[2], 0), 'multipart fence connects north-south');
  const grass = await view(L, 'grass');
  assert.equal(grass.quads.length, 10);
  assert.ok(grass.quads.some((q) => q.texture?.endsWith('grass_side_overlay.png') && q.tint?.kind === 'grass'));
  const dot = await view(L, 'redstone_wire', { north: 'none', east: 'none', south: 'none', west: 'none' });
  assert.ok(dot.quads.some((q) => q.texture?.endsWith('redstone_dust_dot.png')));
  const obs = await view(L, 'observer', { powered: 'true' });
  assert.equal(faceMap(obs).north, 'blocks/observer_front');
  assert.ok(obs.quads.some((q) => q.texture?.endsWith('observer_back_lit.png')));
  const chest = await view(L, 'chest');
  assert.equal(chest.shape, 'special');
  assert.deepEqual(chest.sprite.map((s) => tex(s.path)), ['entity/chest/normal']);
  const water = await view(L, 'water');
  assert.ok(water.quads.length === 6 && water.quads.every((q) => q.texture?.endsWith('blocks/water_still.png')));
});

test('1.12.2: items (overrides as looks) and usage', { skip: !has(L) && SKIP(L) }, async () => {
  const l = await lib(L);
  assert.deepEqual(l.resolve(l.item('diamond_sword')!).sprite.map((s) => tex(s.path)), ['items/diamond_sword']);
  assert.equal(l.properties(l.item('bow')!)[0]?.values.length, 4);
  assert.ok(!l.item('bow_pulling_0'), 'override-only models are not separate items');
  assert.equal(l.resolve(l.item('chest')!).shape, 'special');
  const u = l.usage();
  assert.deepEqual(u.get('assets/minecraft/textures/blocks/furnace_front_on.png')?.blocks, ['furnace']);
});

// ------------------------------------------------------------------------------------------ oldest

test('1.8.9: the first versions with block models resolve', { skip: !has('1.8.9') && SKIP('1.8.9') }, async () => {
  const v = await view('1.8.9', 'furnace', { lit: 'true' });
  assert.equal(faceMap(v).north, 'blocks/furnace_front_on');
  const fence = await view('1.8.9', 'fence');
  assert.ok(fence.quads.length > 6, 'fences before multipart connect through variants');
});

test('1.6.1: no block models, explained', { skip: !has('1.6.1') && SKIP('1.6.1') }, async () => {
  const l = await lib('1.6.1');
  assert.equal(l.available, false);
  assert.match(l.unavailable ?? '', /1\.8/);
  assert.equal(l.blocks().length, 0);
});

// ------------------------------------------------------------------------------------------ same checks per era

interface Names {
  table: string;
  furnaceFront: [string, string];
  stairs: string;
  slab: string | null;
  torch: string;
  wallTorch: string | null;
  flower: [string, string];
  door: string;
  fence: string;
  grass: string;
  overlay: string;
  observer: [string, string];
}

const ERAS: Record<string, Names> = {
  '26.3': { table: 'block/crafting_table_front', furnaceFront: ['block/furnace_front', 'block/furnace_front_on'], stairs: 'oak_stairs', slab: 'oak_slab', torch: 'torch', wallTorch: 'wall_torch', flower: ['poppy', 'block/poppy'], door: 'oak_door', fence: 'oak_fence', grass: 'grass_block', overlay: 'block/grass_block_side_overlay', observer: ['block/observer_back', 'block/observer_back_on'] },
  '1.20.1': { table: 'block/crafting_table_front', furnaceFront: ['block/furnace_front', 'block/furnace_front_on'], stairs: 'oak_stairs', slab: 'oak_slab', torch: 'torch', wallTorch: 'wall_torch', flower: ['poppy', 'block/poppy'], door: 'oak_door', fence: 'oak_fence', grass: 'grass_block', overlay: 'block/grass_block_side_overlay', observer: ['block/observer_back', 'block/observer_back_on'] },
  '1.12.2': { table: 'blocks/crafting_table_front', furnaceFront: ['blocks/furnace_front_off', 'blocks/furnace_front_on'], stairs: 'oak_stairs', slab: null, torch: 'torch', wallTorch: null, flower: ['poppy', 'blocks/flower_rose'], door: 'wooden_door', fence: 'fence', grass: 'grass', overlay: 'blocks/grass_side_overlay', observer: ['blocks/observer_back', 'blocks/observer_back_lit'] },
};

for (const [v, n] of Object.entries(ERAS)) {
  test(`${v}: core blocks resolve like the game (table, furnace, stairs, slab, torches, flower, door, fence, grass, redstone, observer, chest)`, { skip: !has(v) && SKIP(v) }, async () => {
    assert.equal(faceMap(await view(v, 'crafting_table')).north, n.table);
    assert.equal(faceMap(await view(v, 'furnace', { facing: 'north', lit: 'false' })).north, n.furnaceFront[0]);
    assert.equal(faceMap(await view(v, 'furnace', { facing: 'north', lit: 'true' })).north, n.furnaceFront[1]);
    const stairs = await view(v, n.stairs, { facing: 'north', half: 'bottom', shape: 'straight' });
    assert.ok(near(bounds(stairs.quads.filter((q) => q.element === 1)).max[2], 0.5), 'stairs: tall part on the north half');
    if (n.slab) assert.ok(near(bounds((await view(v, n.slab, { type: 'bottom' })).quads).max[1], 0.5), 'bottom slab is half a block');
    const torch = await view(v, n.torch);
    assert.ok(torch.quads.length >= 2 && torch.quads.every((q) => q.texture), 'torch has faces');
    if (n.wallTorch) {
      const w = await view(v, n.wallTorch, { facing: 'south' });
      const low = w.quads.flatMap((q) => q.positions).filter((p) => p[1] < 0.3);
      assert.ok(low.reduce((a, p) => a + p[2], 0) / low.length < 0.2, 'facing south: base on the north wall');
    }
    const flower = await view(v, n.flower[0]);
    assert.ok(flower.quads.length === 4 && flower.quads.every((q) => tex(q.texture) === n.flower[1] && q.worldDir === null), 'flower is a cross');
    assert.ok(near(bounds((await view(v, n.door)).quads).max[1], 2), 'door shows both halves');
    assert.ok(near(bounds((await view(v, n.fence, { north: 'true', south: 'true', east: 'false', west: 'false' })).quads).min[2], 0), 'fence arm reaches the north edge');
    const grass = await view(v, n.grass, { snowy: 'false' });
    assert.ok(grass.quads.some((q) => tex(q.texture) === n.overlay && q.tint?.kind === 'grass' && q.tintindex === 0), 'tinted side overlay');
    assert.equal(grass.quads.find((q) => q.worldDir === 'up')?.tint?.kind, 'grass');
    const dot = await view(v, 'redstone_wire', { north: 'none', east: 'none', south: 'none', west: 'none' });
    assert.ok(dot.quads.some((q) => /redstone_dust_dot\.png$/.test(q.texture ?? '')), 'unconnected redstone is a dot');
    const obs = await view(v, 'observer', { facing: 'north', powered: 'false' });
    assert.equal(faceMap(obs).south, n.observer[0]);
    assert.equal(faceMap(await view(v, 'observer', { facing: 'north', powered: 'true' })).south, n.observer[1]);
    const chest = await view(v, 'chest');
    assert.equal(chest.shape, 'special');
    assert.equal(tex(chest.sprite[0]?.path ?? null), 'entity/chest/normal');
  });
}
