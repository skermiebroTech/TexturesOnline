import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import {
  EDIT_HINT,
  createTexturePackTool,
  getTextureTool,
  inspectPackTool,
  listEffectsTool,
  listTexturesTool,
  pixelArtToImage,
  resolveTexturePath,
  type ToolDeps,
} from '../../mcp/tools';
import { decodeImage, isPng } from '../../src/core/image';
import { bedrockSpec, fakeAssets, javaSpec, json, noisy } from '../tools/texlogic/fixtures';

const J = 'assets/minecraft/textures/';

async function withDeps(fn: (deps: ToolDeps, dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'tpm-mcp-'));
  const java = javaSpec();
  java[`${J}entity/villager/profession_level/stone.png`] = noisy(16, 16, 9);
  const deps: ToolDeps = {
    listVersions: async () => [],
    loadAssets: async (edition, version) => fakeAssets(edition, version, edition === 'java' ? java : bedrockSpec()),
    loadConvertMaps: async () => ({}),
    outputDir: dir,
  };
  try {
    await fn(deps, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('texture references: full path, id, bare name (block first), typos get suggestions', async () => {
  const assets = fakeAssets('java', '26.3', { ...javaSpec(), [`${J}entity/villager/profession_level/stone.png`]: noisy(16, 16) });
  assert.deepEqual(resolveTexturePath(assets, `${J}item/apple.png`), { path: `${J}item/apple.png`, known: true });
  assert.equal(resolveTexturePath(assets, 'block/stone').path, `${J}block/stone.png`);
  assert.equal(resolveTexturePath(assets, 'minecraft:block/stone').path, `${J}block/stone.png`);
  assert.equal(resolveTexturePath(assets, 'stone').path, `${J}block/stone.png`, 'the block wins over the villager badge');
  assert.deepEqual(resolveTexturePath(assets, `${J}block/custom_thing.png`), { path: `${J}block/custom_thing.png`, known: false });
  assert.throws(() => resolveTexturePath(assets, 'apples'), /No texture "apples".*item\/apple/);
});

test('pixel art: palette characters, transparent dots, mistakes reported', () => {
  const img = pixelArtToImage({ palette: { r: '#ff0000', h: '#0f08' }, rows: ['r.', 'h '] });
  assert.equal(img.width, 2);
  assert.deepEqual([...img.data], [255, 0, 0, 255, 0, 0, 0, 0, 0, 255, 0, 136, 0, 0, 0, 0]);
  assert.throws(() => pixelArtToImage({ palette: {}, rows: ['ab', 'a'] }), /same number/);
  assert.throws(() => pixelArtToImage({ palette: { a: '#fff' }, rows: ['ab'] }), /"b"/);
  assert.throws(() => pixelArtToImage({ palette: { a: 'red' }, rows: ['a'] }), /not a colour/);
});

test('list_textures searches words and categories; get_texture enlarges without blurring', async () => {
  await withDeps(async (deps) => {
    const res = await listTexturesTool(deps, { edition: 'java', search: 'grass block' });
    assert.equal(res.version, '26.3');
    assert.deepEqual(res.textures.map((t) => t.id).sort(), ['block/grass_block_side', 'block/grass_block_top']);
    assert.deepEqual((await listTexturesTool(deps, { edition: 'java', category: 'item' })).textures.map((t) => t.id), ['item/apple']);
    const tex = await getTextureTool(deps, { edition: 'java', texture: 'apple', preview_size: 64 });
    assert.equal(tex.info.width, 16);
    assert.equal(tex.info.preview_scale, 4);
    const preview = await decodeImage(tex.preview, 'png');
    const orig = await decodeImage(tex.png, 'png');
    assert.equal(preview.width, 64);
    for (let i = 0; i < 4; i++) assert.equal(preview.data[(5 * 4 * 64 + 7 * 4 + i) * 4], orig.data[(5 * 16 + 7) * 4], 'nearest neighbour');
  });
});

test('list_effects lists every effect with its settings and every preset', () => {
  const res = listEffectsTool();
  const hue = res.effects.find((e) => e.type === 'hue');
  assert.ok(hue?.params.some((p) => p.key === 'degrees' && p.min === -180));
  assert.ok(res.presets.some((p) => p.id === 'dark-mode'));
});

test('create_texture_pack: Java pack with pixel art, a recoloured vanilla texture and a preset', async () => {
  await withDeps(async (deps, dir) => {
    const res = await createTexturePackTool(deps, {
      edition: 'java',
      name: 'Agent Pack',
      description: 'Made by an assistant',
      preset: 'noir',
      textures: [
        { texture: 'stone', pixel_art: { palette: { a: '#ff0000', b: '#0000ff' }, rows: ['ab', 'ba'] } },
        { texture: 'item/apple', effects: [{ type: 'invert' }] },
      ],
    });
    assert.equal(res.file, join(dir, 'Agent Pack.zip'));
    assert.equal(res.next, EDIT_HINT);
    assert.equal(res.edited_textures, 2);
    const zip = unzipSync(await readFile(res.file));
    assert.deepEqual(json(zip['pack.mcmeta']), { pack: { description: 'Made by an assistant', min_format: [97, 1], max_format: 97 } });
    assert.ok(isPng(zip['pack.png']));
    const stone = await decodeImage(zip[`${J}block/stone.png`], 'png');
    assert.equal(stone.width, 2);
    assert.ok(zip[`${J}block/grass_block_top.png`], 'the preset changes vanilla textures too');
  });
});

test('create_texture_pack: Bedrock .mcpack, and clear errors for wrong names', async () => {
  await withDeps(async (deps) => {
    const res = await createTexturePackTool(deps, { edition: 'bedrock', name: 'Rock', textures: [{ texture: 'stone', effects: [{ type: 'grayscale' }] }] });
    assert.match(res.file, /Rock\.mcpack$/);
    const zip = unzipSync(await readFile(res.file));
    assert.ok(zip['manifest.json'] && zip['textures/blocks/stone.png']);
    const info = await inspectPackTool(deps, { file: res.file });
    assert.equal(info.edition, 'bedrock');
    assert.equal(info.textures, 1);

    await assert.rejects(createTexturePackTool(deps, { edition: 'java', name: 'x' }), /Nothing to put/);
    await assert.rejects(createTexturePackTool(deps, { edition: 'java', name: 'x', preset: 'pastel' }), /Unknown preset "pastel".*pastel-dream/);
    await assert.rejects(createTexturePackTool(deps, { edition: 'java', name: 'x', effects: [{ type: 'hue', params: { amount: 1 } }] }), /no setting "amount".*degrees/);
    await assert.rejects(createTexturePackTool(deps, { edition: 'bedrock', name: 'x', preset: 'noir', compat: { min_version: '1.20', max_version: '26.3' } }), /Java setting/);
  });
});

test('inspect_pack: Java releases that accept the pack', async () => {
  await withDeps(async (deps) => {
    const res = await createTexturePackTool(deps, { edition: 'java', version: '1.20.1', name: 'Old', preset: 'noir' });
    const info = await inspectPackTool(deps, { file: res.file });
    assert.deepEqual(info.java_releases?.works_on, ['1.20', '1.20.1']);
  });
});
