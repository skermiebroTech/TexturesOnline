/**
 * Model library against Bedrock's vanilla blocks.json and texture atlases (TO_FIXTURES research cache +
 * the bundled file index): per-face textures, lit/unlit pairs as a state, variations, tint masks,
 * engine-drawn shapes rebuilt (plants, doors, stairs) or shown as cubes with a note, items, usage.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModelLibrary, type ModelLibrary, type ModelView, type BlockState } from '../../src/shared/models/index';
import { bedrockShape } from '../../src/shared/models/bedrock-blocks';
import { bedrockAssets } from '../tools/models/fixtures';

const assets = bedrockAssets();
const SKIP = !assets && 'Bedrock vanilla JSON not found (set TO_FIXTURES to the research folder with research-cache/bedrock/main-*.json)';
let libP: Promise<ModelLibrary> | null = null;
const lib = () => (libP ??= loadModelLibrary(assets!));

async function view(id: string, state: BlockState = {}): Promise<ModelView> {
  const l = await lib();
  const e = l.block(id);
  assert.ok(e, `${id} is listed`);
  return l.resolve(e, { ...l.defaultState(e), ...state });
}
const tex = (p: string | null) => (p ? p.replace(/^textures\//, '').replace(/\.(png|tga)$/, '') : null);
function faceMap(v: ModelView): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const q of v.quads) if (q.worldDir && !(q.worldDir in out)) out[q.worldDir] = tex(q.texture);
  return out;
}

test('bedrock: blocks from blocks.json, lit_ variants folded into their block', { skip: SKIP }, async () => {
  const l = await lib();
  assert.ok(l.blocks().length > 1000);
  assert.ok(l.block('furnace') && !l.block('lit_furnace') && !l.block('air'));
  assert.ok(l.block('repeater'), 'powered/unpowered repeater become one block');
  assert.ok(l.items().length > 300);
});

test('bedrock: crafting and cartography tables map every face', { skip: SKIP }, async () => {
  const t = faceMap(await view('crafting_table'));
  assert.equal(t.up, 'blocks/crafting_table_top');
  assert.equal(t.down, 'blocks/planks_oak');
  assert.equal(t.north, 'blocks/crafting_table_front');
  assert.equal(t.east, 'blocks/crafting_table_side');
  const c = faceMap(await view('cartography_table'));
  assert.equal(new Set(Object.values(c)).size, 5);
  assert.equal(c.south, 'blocks/cartography_table_side1');
  assert.equal(c.west, 'blocks/cartography_table_side2');
});

test('bedrock: furnace front turned to the camera; lit state uses furnace_front_on', { skip: SKIP }, async () => {
  const off = await view('furnace', { lit: 'false' });
  const on = await view('furnace', { lit: 'true' });
  assert.equal(faceMap(off).north, 'blocks/furnace_front_off', 'blocks.json puts the front south; the preview turns it to face the camera');
  assert.equal(faceMap(on).north, 'blocks/furnace_front_on');
  const labels = Object.fromEntries(off.textures.map((t) => [tex(t.path), t.label]));
  assert.equal(labels['blocks/furnace_front_off'], 'Front');
  assert.equal(labels['blocks/furnace_front_on'], 'Front (lit)');
  assert.equal(labels['blocks/furnace_top'], 'Top');
});

test('bedrock: grass side tint mask, biome-tinted top', { skip: SKIP }, async () => {
  const v = await view('grass', { look: 'world' });
  const side = v.quads.find((q) => q.worldDir === 'east')!;
  assert.equal(side.texture, 'textures/blocks/grass_side.tga', 'the .tga wins over .png like in the game');
  assert.equal(side.tintMask, true);
  assert.equal(side.tint?.kind, 'grass');
  assert.equal(v.quads.find((q) => q.worldDir === 'up')!.tint?.kind, 'grass');
  assert.equal(tex(v.quads.find((q) => q.worldDir === 'down')!.texture), 'blocks/dirt');
});

test('bedrock: engine shapes: plants cross, doors two blocks tall, stairs, torch; others approximate', { skip: SKIP }, async () => {
  assert.equal(bedrockShape('poppy').shape, 'cross');
  assert.equal(bedrockShape('oak_stairs').shape, 'stairs');
  assert.equal(bedrockShape('stone_slab').shape, 'slab');
  assert.equal(bedrockShape('double_stone_slab').shape, 'cube');
  assert.equal(bedrockShape('iron_trapdoor').shape, 'trapdoor');
  assert.equal(bedrockShape('torchflower').shape, 'cross');
  const poppy = await view('poppy');
  assert.equal(poppy.category, 'plant');
  assert.ok(poppy.quads.every((q) => q.worldDir === null && q.texture === 'textures/blocks/flower_rose.png'));
  assert.equal(poppy.textures[0].label, 'Plant');
  const door = await view('wooden_door');
  const ys = door.quads.flatMap((q) => q.positions.map((p) => p[1]));
  assert.equal(Math.max(...ys), 2);
  assert.deepEqual(door.textures.slice(0, 2).map((t) => t.label), ['Lower half (Wood)', 'Upper half (Wood)']);
  const stairs = await view('oak_stairs');
  assert.equal(stairs.textures[0].label, 'All sides');
  assert.equal(stairs.quads.length, 11);
  const torch = await view('torch');
  assert.ok(Math.max(...torch.quads.flatMap((q) => q.positions.map((p) => p[1]))) <= 10 / 16 + 1e-9);
  const anvil = await view('anvil');
  assert.equal(anvil.approximate, true);
  assert.ok(anvil.note && /own shape/.test(anvil.note));
});

test('bedrock: variations are a state with readable names', { skip: SKIP }, async () => {
  const l = await lib();
  const wool = l.block('wool')!;
  const variant = l.properties(wool).find((p) => p.name === 'variant')!;
  assert.equal(variant.values.length, 16);
  assert.equal(variant.values[0].label, 'White');
  assert.equal(faceMap(l.resolve(wool, { variant: '14' })).up, 'blocks/wool_colored_red');
});

test('bedrock: items are flat sprites, usage links textures to blocks and items', { skip: SKIP }, async () => {
  const l = await lib();
  const apple = l.resolve(l.item('apple')!);
  assert.equal(apple.shape, 'sprite');
  assert.equal(apple.sprite[0].path, 'textures/items/apple.png');
  const u = l.usage();
  assert.deepEqual(u.get('textures/blocks/furnace_front_on.png')?.blocks, ['furnace']);
  assert.ok(u.get('textures/blocks/planks_oak.png')!.blocks.includes('crafting_table'));
  assert.ok(u.get('textures/items/apple.png')!.items.includes('apple'));
});
