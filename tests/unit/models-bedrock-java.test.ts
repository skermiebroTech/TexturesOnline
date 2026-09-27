/**
 * Bedrock block shapes built from the matching Java block models (the app downloads them from a model
 * mirror; here they come from the 26.3 client jar in TO_FIXTURES), with Bedrock's own textures mapped
 * onto the faces and Bedrock block states mapped to Java states. Block entities use the entity models
 * with Bedrock's entity textures.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModelLibrary, type BakedQuad, type BlockState, type ModelLibrary, type ModelView } from '../../src/shared/models/index';
import { javaTargetFor } from '../../src/shared/models/bedrock-java';
import { bedrockAssets, javaModelJson } from '../tools/models/fixtures';

const assets = bedrockAssets();
const java = javaModelJson('26.3');
const SKIP = (!assets || !java) && 'Bedrock vanilla JSON or the Minecraft 26.3 jar not found (set TO_FIXTURES to the research folder)';
let libP: Promise<ModelLibrary> | null = null;
const lib = () => (libP ??= loadModelLibrary(assets!, { javaModels: async () => java }));

async function view(id: string, state: BlockState = {}): Promise<ModelView> {
  const l = await lib();
  const e = l.block(id);
  assert.ok(e, `${id} is listed`);
  return l.resolve(e, { ...l.defaultState(e), ...state });
}
const tex = (p: string | null) => (p ? p.replace(/^textures\//, '').replace(/\.(png|tga)$/, '') : null);
const texs = (v: ModelView) => [...new Set(v.quads.map((q) => tex(q.texture)))].sort();
function bounds(qs: BakedQuad[]) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const q of qs) for (const p of q.positions) for (let i = 0; i < 3; i++) (min[i] = Math.min(min[i], p[i])), (max[i] = Math.max(max[i], p[i]));
  return { min, max };
}
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

test('bedrock ids and states map to Java blocks (renames, flattened variants)', () => {
  const javaIds = new Set(['oak_fence_gate', 'lily_pad', 'chain', 'iron_chain', 'smooth_stone_slab', 'lit_redstone_lamp', 'redstone_lamp', 'stonecutter']);
  const has = (id: string) => javaIds.has(id);
  assert.equal(javaTargetFor('fence_gate', has)?.id, 'oak_fence_gate');
  assert.equal(javaTargetFor('waterlily', has)?.id, 'lily_pad');
  assert.equal(javaTargetFor('chain', has)?.id, 'iron_chain');
  assert.equal(javaTargetFor('chain', (id) => id === 'chain')?.id, 'chain', 'before the copper update the chain was just chain');
  assert.deepEqual(javaTargetFor('lit_redstone_lamp', has)?.state, { lit: 'true' });
  assert.equal(javaTargetFor('stonecutter_block', has)?.id, 'stonecutter');
  assert.equal(javaTargetFor('no_such_block', has), null);
});

test('bedrock + Java shapes: no block is left as an approximate cube', { skip: SKIP }, async () => {
  const l = await lib();
  const approx: string[] = [];
  for (const e of l.blocks()) if (l.resolve(e).approximate) approx.push(e.id);
  assert.deepEqual(approx, []);
});

test('bedrock + Java shapes: fence gates (open, in a wall) with planks', { skip: SKIP }, async () => {
  const closed = await view('fence_gate', { facing: 'north', open: 'false', in_wall: 'false' });
  assert.equal(closed.shape, 'model');
  assert.ok(!closed.approximate);
  assert.deepEqual(texs(closed), ['blocks/planks_oak']);
  assert.ok(near(bounds(closed.quads).max[1], 1));
  const wall = await view('fence_gate', { facing: 'north', open: 'false', in_wall: 'true' });
  assert.ok(near(bounds(wall.quads).max[1], 13 / 16), 'lowered in a wall');
  const open = await view('fence_gate', { facing: 'north', open: 'true', in_wall: 'false' });
  assert.ok(near(bounds(open.quads).min[2], 1 / 16) && near(bounds(closed.quads).min[2], 7 / 16), 'the doors swing out to the north');
  assert.deepEqual(texs(await view('spruce_fence_gate')), ['blocks/planks_spruce']);
});

test('bedrock + Java shapes: anvil with the base and damage top, turned with its facing', { skip: SKIP }, async () => {
  const v = await view('anvil', { facing: 'north' });
  assert.deepEqual(texs(v), ['blocks/anvil_base', 'blocks/anvil_top_damaged_0']);
  const top = v.quads.filter((q) => q.worldDir === 'up' && near(q.positions[0][1], 1));
  assert.ok(top.length === 1 && tex(top[0].texture) === 'blocks/anvil_top_damaged_0');
  const n = bounds(v.quads);
  const e = bounds((await view('anvil', { facing: 'east' })).quads);
  const long = (b: typeof n) => (b.max[0] - b.min[0] > b.max[2] - b.min[2] ? 'x' : 'z');
  assert.notEqual(long(n), long(e), 'a quarter turn');
  assert.match(v.note ?? '', /builds this/);
});

test('bedrock + Java shapes: candle count and lit texture, sea pickles, cake bites', { skip: SKIP }, async () => {
  const one = await view('candle', { candles: '1', lit: 'false' });
  const four = await view('candle', { candles: '4', lit: 'false' });
  assert.equal(four.quads.length, one.quads.length * 4);
  assert.deepEqual(texs(one), ['blocks/candles/candle']);
  assert.deepEqual(texs(await view('candle', { candles: '2', lit: 'true' })), ['blocks/candles/candle_lit']);
  assert.deepEqual(texs(await view('red_candle', { lit: 'false' })), ['blocks/candles/red_candle']);
  const p1 = await view('sea_pickle', { pickles: '1' });
  const p4 = await view('sea_pickle', { pickles: '4' });
  assert.ok(p4.quads.length > p1.quads.length * 3);
  const whole = bounds((await view('cake', { bites: '0' })).quads);
  const bitten = bounds((await view('cake', { bites: '3' })).quads);
  assert.ok(near(whole.min[0], 1 / 16) && near(bitten.min[0], 7 / 16), `bites eat from the west: ${bitten.min[0]}`);
});

test('bedrock + Java shapes: hanging lantern hangs from its chain', { skip: SKIP }, async () => {
  const floor = await view('lantern', { hanging: 'false' });
  const hanging = await view('lantern', { hanging: 'true' });
  assert.deepEqual(texs(floor), ['blocks/lantern']);
  assert.ok(near(bounds(floor.quads).min[1], 0));
  assert.ok(bounds(hanging.quads).min[1] > 0 && hanging.quads.length > floor.quads.length);
  assert.deepEqual(texs(await view('soul_lantern')), ['blocks/soul_lantern']);
});

test('bedrock block entities: signs and chests with Bedrock entity textures', { skip: SKIP }, async () => {
  const sign = await view('standing_sign');
  assert.equal(sign.shape, 'model');
  assert.deepEqual(texs(sign), ['entity/sign']);
  assert.ok(bounds(sign.quads).max[1] > 1, 'board above the post');
  const wall = await view('wall_sign');
  assert.ok(bounds(wall.quads).max[1] < 1 && wall.quads.length === 6, 'board only');
  const spruce = await view('spruce_standing_sign');
  assert.deepEqual(texs(spruce), ['entity/sign_spruce']);
  const chest = await view('chest', { facing: 'north', type: 'single' });
  assert.deepEqual(texs(chest), ['entity/chest/normal']);
  assert.ok(near(bounds(chest.quads).max[1], 14 / 16));
  const double = await view('chest', { facing: 'north', type: 'double' });
  assert.deepEqual(texs(double), ['entity/chest/double_normal']);
  const b = bounds(double.quads);
  assert.ok(near(b.max[0] - b.min[0], 30 / 16), JSON.stringify(b));
  assert.deepEqual(texs(await view('trapped_chest', { type: 'double' })), ['entity/chest/trapped_double']);
  assert.deepEqual(texs(await view('ender_chest')), ['entity/chest/ender']);
});

test('bedrock without the Java models falls back to cubes with a note', { skip: !assets && 'Bedrock vanilla JSON not found' }, async () => {
  // a copy of the index: the library is cached per asset index
  const l = await loadModelLibrary({ ...assets! }, { javaModels: async () => null });
  const e = l.block('fence_gate')!;
  const v = l.resolve(e);
  assert.ok(v.approximate);
  assert.match(v.note ?? '', /./);
  // the built-in shapes and block entities stay
  assert.ok(!l.resolve(l.block('chest')!).approximate);
  assert.ok(!l.resolve(l.block('oak_stairs')!).approximate);
});
