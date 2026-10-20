// The example files in the guides are what the app writes: the skin pack of the "make a Bedrock skin
// pack" guide, and the model files of the "make 3D items" guide.
// Run: npx tsx --test tests/unit/seo-guide-files.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSkinPackFiles } from '../../src/editions/bedrock/manifest';
import { SKIN_PACK_EXAMPLE, SKIN_PACK_LANG, SKIN_PACK_LANGUAGES, SKIN_PACK_MANIFEST, SKIN_PACK_SKINS_JSON, SKIN_PACK_TREE } from '../../src/tools/guides/skin-pack-files';
import { addElement, emptyModel, modelJson, modelText, newElement, prettyJson, setDisplay, setFace, textureVarFor } from '../../src/tools/textures/models/doc';
import { spriteTo3d } from '../../src/tools/textures/models/presets';
import { planBlock, planFiles, planItem } from '../../src/tools/textures/models/targets';
import { modelRules } from '../../src/tools/textures/models/rules';
import { MODEL_BLOCK_EXAMPLE, MODEL_FILES, MODEL_FLAT_DEFINITION, MODEL_SPRITE_CUBE, MODEL_STONE_BLOCKSTATE } from '../../src/tools/guides/model-files';
import { javaJarAssets } from '../tools/models/fixtures';

test('the skin pack guide shows the files the Skin Pack Maker writes', () => {
  const e = SKIN_PACK_EXAMPLE;
  const files = buildSkinPackFiles({
    name: e.name,
    uuids: e.uuids,
    version: e.version,
    skins: e.skins.map((s) => ({ ...s, png: new Blob([new Uint8Array(1)], { type: 'image/png' }) })),
  });
  assert.equal(files['manifest.json'], SKIN_PACK_MANIFEST);
  assert.equal(files['skins.json'], SKIN_PACK_SKINS_JSON);
  assert.equal(files['texts/en_US.lang'], SKIN_PACK_LANG);
  assert.equal(files['texts/languages.json'], SKIN_PACK_LANGUAGES);
  // Every file of the pack is in the folder tree, and nothing else.
  const names = Object.keys(files).map((f) => f.split('/').pop()!).sort();
  const tree = SKIN_PACK_TREE.split('\n')
    .slice(1)
    .map((l) => l.replace(/^[│├└─\s]+/, ''))
    .filter((l) => !l.endsWith('/'))
    .sort();
  assert.deepEqual(tree, names);
});

// ---------------------------------------------------------------- 3D items guide

/** The game's own files the examples start from (checked against the real jars below when TO_FIXTURES has them). */
const SWORD_DEFINITION = { model: { type: 'minecraft:model', model: 'minecraft:item/diamond_sword' } };
const STONE_BLOCKSTATE = {
  variants: {
    '': [{ model: 'minecraft:block/stone' }, { model: 'minecraft:block/stone_mirrored' }, { model: 'minecraft:block/stone', y: 180 }, { model: 'minecraft:block/stone_mirrored', y: 180 }],
  },
};
const VANILLA: Record<string, unknown> = {
  'assets/minecraft/items/diamond_sword.json': SWORD_DEFINITION,
  'assets/minecraft/blockstates/stone.json': STONE_BLOCKSTATE,
};
const vanilla = (path: string) => VANILLA[path];

test('the 3D items guide shows the model files the model editor writes', () => {
  // a new cube with oak planks, cull faces on the block's edges and an inventory pose
  const block = emptyModel();
  const planks = textureVarFor(block, 'minecraft:block/oak_planks');
  addElement(block, newElement(block, { from: [0, 0, 0], to: [16, 8, 16], texture: planks }));
  for (const d of ['down', 'north', 'south', 'west', 'east'] as const) setFace(block, 0, d, { cullface: d });
  setDisplay(block, 'gui', { rotation: [30, 225, 0], translation: [0, 0, 0], scale: [0.625, 0.625, 0.625] });
  assert.equal(modelText(block), MODEL_BLOCK_EXAMPLE);

  // "3D item from sprite" on three pixels in a row
  const data = new Uint8ClampedArray(16 * 16 * 4);
  for (const x of [5, 6, 7]) data[(3 * 16 + x) * 4 + 3] = 255;
  const item = spriteTo3d({ ...emptyModel(), textures: { layer0: 'minecraft:item/diamond_sword' } }, [{ texture: '#layer0', image: { width: 16, height: 16, data }, tintindex: 0 }]);
  const cubes = modelJson(item).elements as unknown[];
  assert.equal(cubes.length, 1);
  assert.equal(prettyJson(cubes[0]), MODEL_SPRITE_CUBE);

  // "Flat in the inventory" on the diamond sword (26.3)
  const flat = planFiles(planItem({ itemId: 'diamond_sword', rules: modelRules('26.3'), json: vanilla, flatGui: true }), '{}');
  assert.equal(flat['assets/minecraft/items/diamond_sword.json'], MODEL_FLAT_DEFINITION);

  // "Use for every random variant" on stone
  const stone = planFiles(planBlock({ blockId: 'stone', model: 'minecraft:block/stone', json: vanilla, everyVariant: true }), '{}');
  assert.equal(stone['assets/minecraft/blockstates/stone.json'], MODEL_STONE_BLOCKSTATE);
});

test('the 3D items guide lists the files each change puts in the pack', () => {
  const short = (files: Record<string, string>) => Object.keys(files).map((p) => p.replace(/^assets\/minecraft\//, ''));
  const item = (version: string, flatGui: boolean) => short(planFiles(planItem({ itemId: 'diamond_sword', rules: modelRules(version), json: vanilla, flatGui }), '{}'));
  const block = (blockId: string, model: string, everyVariant: boolean) => short(planFiles(planBlock({ blockId, model, json: vanilla, everyVariant }), '{}'));
  for (const [version, key] of [['26.3', 'latest'], ['1.21.4', 'latest'], ['1.21.1', 'older'], ['1.8.9', 'older']] as const) {
    const rules = modelRules(version);
    assert.equal(rules.itemDefinitions, key === 'latest', `${version} item definitions`);
    assert.deepEqual(item(version, false), MODEL_FILES.sword[key], `${version} 3D sword`);
    const flat = MODEL_FILES.swordFlat[key];
    if (flat) assert.deepEqual(item(version, true), flat, `${version} flat in the inventory`);
    assert.deepEqual(block('oak_slab', 'minecraft:block/oak_slab', false), MODEL_FILES.slab[key]);
    assert.deepEqual(block('stone', 'minecraft:block/stone', true), MODEL_FILES.stoneEvery[key]);
  }
});

test('the 3D items guide starts from the real game files', { skip: !javaJarAssets('26.3') && 'Minecraft 26.3 jar not found (set TO_FIXTURES)' }, async () => {
  for (const version of ['26.3', '1.21.4', '1.21.1']) {
    const assets = javaJarAssets(version);
    if (!assets) continue;
    const read = async (p: string) => (assets.hasFile(p) ? JSON.parse(await assets.readText(p)) : undefined);
    assert.deepEqual(await read('assets/minecraft/blockstates/stone.json'), STONE_BLOCKSTATE, `${version} stone blockstate`);
    if (modelRules(version).itemDefinitions) assert.deepEqual(await read('assets/minecraft/items/diamond_sword.json'), SWORD_DEFINITION, `${version} sword definition`);
  }
});
