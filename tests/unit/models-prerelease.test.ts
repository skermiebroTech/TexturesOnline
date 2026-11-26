/**
 * The newest development version's jar (TO_FIXTURES/client-26.4-pre-1.jar, never stored in the repo)
 * against the model library and the texture list: every model finds its parents, the blocks and items
 * that are new since 26.3 resolve to real textures in every state, and their textures get categories.
 * Skips when the jar is missing. When 26.4 is out, point PRE at the release (or the next pre-release).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModelLibrary } from '../../src/shared/models/index';
import { javaJarAssets } from '../tools/models/fixtures';

const PRE = '26.4-pre-1';
const OLD = '26.3';
const pre = javaJarAssets(PRE);
const old = javaJarAssets(OLD);
const SKIP = `Minecraft ${PRE} jar not found (set TO_FIXTURES to a folder with client-${PRE}.jar)`;
const SKIP_BOTH = `Minecraft ${PRE} and ${OLD} jars not found (set TO_FIXTURES to a folder with client-${PRE}.jar and client-${OLD}.jar)`;

const ids = (files: string[], prefix: string) => files.filter((p) => p.endsWith('.json')).map((p) => p.slice(prefix.length, -5));
const BLOCKSTATES = 'assets/minecraft/blockstates/';
const ITEMS = 'assets/minecraft/items/';
const TEX = 'assets/minecraft/textures/';

test(`${PRE}: every block and item model finds its parents`, { skip: pre ? false : SKIP }, async () => {
  const lib = await loadModelLibrary(pre!);
  const models = lib.javaFiles()!.models;
  const broken: string[] = [];
  for (const path of pre!.listFiles('assets/minecraft/models/')) {
    if (!path.endsWith('.json')) continue;
    const r = models.resolve(`minecraft:${path.slice('assets/minecraft/models/'.length, -5)}`);
    if (r.missing.length) broken.push(`${path}: ${r.missing.join(', ')}`);
  }
  assert.deepEqual(broken, []);
});

test(`${PRE}: blocks and items new since ${OLD} resolve to textures of the version in every state`, { skip: pre && old ? false : SKIP_BOTH }, async () => {
  const lib = await loadModelLibrary(pre!);
  const before = new Set(ids(old!.listFiles(BLOCKSTATES), BLOCKSTATES));
  const blocks = ids(pre!.listFiles(BLOCKSTATES), BLOCKSTATES).filter((id) => !before.has(id));
  assert.ok(blocks.includes('icicle') && blocks.includes('snow_bricks'), blocks.join(', '));
  const bad: string[] = [];
  for (const id of blocks) {
    const e = lib.block(id);
    if (!e) {
      bad.push(`${id}: not listed`);
      continue;
    }
    // every combination of the block's properties (icicles have 20)
    let states: Record<string, string>[] = [lib.defaultState(e)];
    for (const p of lib.properties(e)) states = states.flatMap((s) => p.values.map((v) => ({ ...s, [p.name]: v.value })));
    const first = lib.resolve(e);
    if (first.shape !== 'model' || !first.quads.length) bad.push(`${id}: ${first.shape}, ${first.quads.length} faces in its default state`);
    for (const st of states) {
      // (a wall with no post and no sides is a state with nothing to draw, in the game too)
      const v = lib.resolve(e, st);
      for (const q of v.quads) if (!q.texture || !pre!.hasFile(q.texture)) bad.push(`${id} ${JSON.stringify(st)}: texture ${q.texture}`);
    }
  }
  const itemsBefore = new Set(ids(old!.listFiles(ITEMS), ITEMS));
  const items = ids(pre!.listFiles(ITEMS), ITEMS).filter((id) => !itemsBefore.has(id));
  assert.ok(items.includes('ice_ball') && items.includes('music_disc_flurry'), items.join(', '));
  for (const id of items) {
    const e = lib.item(id);
    if (!e) {
      bad.push(`item ${id}: not listed`);
      continue;
    }
    const v = lib.resolve(e);
    const textures = [...v.quads.map((q) => q.texture), ...v.sprite.map((s) => s.path)];
    if (!textures.length) bad.push(`item ${id}: ${v.shape} without textures`);
    for (const t of textures) if (!t || !pre!.hasFile(t)) bad.push(`item ${id}: texture ${t}`);
  }
  assert.deepEqual(bad, []);
});

test(`${PRE}: its new textures are listed with a category`, { skip: pre && old ? false : SKIP_BOTH }, () => {
  const known = new Set(old!.textures.map((t) => t.path));
  const added = pre!.textures.filter((t) => !known.has(t.path));
  assert.ok(added.length > 50, `${added.length} new textures`);
  const cat = (p: string) => added.find((t) => t.path === `${TEX}${p}.png`)?.category;
  assert.equal(cat('block/icicle_tip'), 'block');
  assert.equal(cat('item/ice_ball'), 'item');
  assert.equal(cat('entity/zombie/frostbite'), 'entity');
  assert.equal(cat('particle/freezing_0'), 'particle');
  assert.equal(cat('mob_effect/freezing'), 'effect');
  assert.equal(cat('gui/sprites/friends/tab'), 'gui');
  assert.deepEqual(added.filter((t) => !t.category), []);
});
